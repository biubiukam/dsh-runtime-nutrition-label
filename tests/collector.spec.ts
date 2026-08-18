import type { FsTarget } from '@deepseek-ai/dsh-fs'
import type { ToolExecution, ToolExecutionResult, ToolSchema } from '@deepseek-ai/dsh-tools'
import { describe, expect, it } from 'vitest'
import { resolveConfig } from '../src/config.ts'
import { RuntimeNutritionCollector } from '../src/collector.ts'

const result = (isError = false): ToolExecutionResult => ({
  isError,
  content: [{ type: 'text', text: isError ? 'failed' : 'ok' }],
})

function execution(name: string, argumentsValue: unknown, token = Symbol(name)): ToolExecution {
  return { name, arguments: argumentsValue, token }
}

function target(displayPath: string, targetKey = displayPath): FsTarget {
  return { displayPath, targetKey }
}

function setup(options: {
  pathDisplay?: 'omit' | 'basename' | 'full'
  evidenceLimit?: number
  fileSampleLimit?: number
  domainSampleLimit?: number
  argumentScanMaxDepth?: number
  argumentScanMaxNodes?: number
} = {}) {
  let now = 1_000
  const config = resolveConfig({
    plugins: [{
      id: 'github',
      displayName: 'GitHub MCP',
      tools: { prefixes: ['mcp__github__'] },
      declared: { network: true, credentials: true, domains: ['api.github.com'] },
      effects: [{ prefixes: ['mcp__github__write_'], effect: 'write' }],
    }],
    ...options,
  })
  const collector = new RuntimeNutritionCollector(config, { now: () => now })
  return {
    collector,
    advance: (ms: number) => { now += ms },
  }
}

describe('RuntimeNutritionCollector', () => {
  it('records successful and failed calls with duration statistics', () => {
    const { collector, advance } = setup()
    const first = execution('mcp__github__list', { page: 1 })
    collector.begin(first)
    advance(100)
    collector.finish(first, result())

    const second = execution('mcp__github__list', { page: 2 })
    collector.begin(second)
    advance(200)
    collector.finish(second, result(true))

    const metric = collector.snapshot('github').labels[0]?.observed.tools[0]
    expect(metric).toMatchObject({
      calls: 2,
      timedCalls: 2,
      successes: 1,
      failures: 1,
      averageDurationMs: 150,
      p95DurationMs: 200,
    })
    expect(metric?.argumentBytes).toBeGreaterThan(0)
    expect(metric?.resultBytes).toBeGreaterThan(0)
  })

  it('attributes schemas, side effects, and nested URL hostnames without retaining raw values', () => {
    const { collector } = setup()
    const schemas: readonly ToolSchema[] = [{
      name: 'mcp__github__write_issue',
      description: 'Create an issue',
      parameters: { type: 'object', properties: { title: { type: 'string' } } },
    }]
    collector.syncSchemas(schemas)
    const exec = execution('mcp__github__write_issue', {
      title: 'private title should not be retained',
      metadata: { callback: 'https://api.github.com/repos/org/repo' },
    })
    collector.begin(exec)
    collector.finish(exec, result())

    const label = collector.snapshot('github').labels[0]
    expect(label?.observed.tools[0]).toMatchObject({ effect: 'write', schemaBytes: expect.any(Number) })
    expect(label?.observed.network).toMatchObject({ callsWithUrls: 1, uniqueDomains: 1 })
    expect(label?.observed.network.domains).toEqual([{ hostname: 'api.github.com', calls: 1 }])
    expect(JSON.stringify(label)).not.toContain('private title should not be retained')
  })

  it('publishes zero-duration metrics for schema-only tools and ignores non-http URLs', () => {
    const { collector } = setup({ argumentScanMaxDepth: 1, argumentScanMaxNodes: 2 })
    collector.syncSchemas([{
      name: 'mcp__github__list',
      description: 'List issues',
      parameters: {},
    }])
    const exec = execution('mcp__github__list', {
      ftp: 'ftp://example.com/file',
      invalid: 'not-a-url',
      deep: { nested: { callback: 'https://ignored.example.com' } },
    })
    collector.begin(exec)
    collector.finish(exec, result())
    const tool = collector.snapshot('github').labels[0]?.observed.tools[0]
    expect(tool?.averageDurationMs).toBe(0)
    expect(tool?.p95DurationMs).toBe(0)
    expect(collector.snapshot('github').labels[0]?.observed.network.uniqueDomains).toBe(0)
  })

  it.each([
    ['basename', 'file.ts'],
    ['full', '/workspace/src/file.ts'],
  ] as const)('records file %s samples and distinguishes reads from writes', (pathDisplay, expected) => {
    const { collector } = setup({ pathDisplay })
    const writeExec = execution('mcp__github__write_file', { path: '/workspace/src/file.ts' })
    const writeTarget = target('/workspace/src/file.ts')
    collector.begin(writeExec)
    collector.noteWriteIntent(writeTarget, writeExec)
    collector.observeFile(writeTarget, writeExec)
    collector.finish(writeExec, result())

    const readExec = execution('mcp__github__read_file', { path: '/workspace/src/file.ts' })
    collector.begin(readExec)
    collector.observeFile(writeTarget, readExec)
    collector.finish(readExec, result())

    const files = collector.snapshot('github').labels[0]?.observed.filesystem
    expect(files).toMatchObject({ observations: 2, reads: 1, writes: 1, uniqueTargets: 1, samples: [expected] })
  })

  it('omits file samples and bounds evidence records', () => {
    const { collector } = setup({ pathDisplay: 'omit', evidenceLimit: 1 })
    const exec = execution('mcp__github__list', {})
    collector.begin(exec)
    collector.observeFile(target('/private/secret.txt'), exec)
    collector.finish(exec, result())
    const label = collector.snapshot('github').labels[0]
    expect(label?.observed.filesystem.samples).toEqual([])
    expect(label?.evidence).toHaveLength(1)
    expect(label?.evidence[0]?.summary).toContain('succeeded')
  })

  it('returns deeply immutable snapshots and resets only observations', () => {
    const { collector } = setup()
    const exec = execution('mcp__github__list', {})
    collector.begin(exec)
    collector.finish(exec, result())
    const snapshot = collector.snapshot()
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.labels)).toBe(true)
    expect(Object.isFrozen(snapshot.labels[0])).toBe(true)
    expect(() => {
      ;(snapshot as unknown as { revision: number }).revision = 0
    }).toThrow()

    collector.reset('github')
    const reset = collector.snapshot('github').labels[0]
    expect(reset?.declared.network).toBe(true)
    expect(reset?.observed.tools).toEqual([])
    expect(reset?.observed.filesystem.observations).toBe(0)

    const pending = execution('mcp__github__list', {})
    collector.begin(pending)
    collector.reset()
    collector.finish(pending, result())
    expect(collector.snapshot('github').labels[0]?.observed.tools).toEqual([])
  })

  it('rejects unknown label queries', () => {
    const { collector } = setup()
    expect(() => collector.snapshot('missing')).toThrow(/unknown label/)
    expect(() => collector.reset('missing')).toThrow(/unknown label/)
  })

  it('ignores unowned calls and incomplete filesystem actors', () => {
    const config = resolveConfig({
      includeUnattributed: false,
      plugins: [{ id: 'known', tools: { names: ['known'] } }],
    })
    const collector = new RuntimeNutritionCollector(config)
    const unknown = execution('unknown', {})
    collector.begin(unknown)
    collector.finish(unknown, result())
    collector.noteWriteIntent(target('/tmp/file'), undefined)
    collector.observeFile(target('/tmp/file'), undefined)
    collector.observeFile(target('/tmp/file'), {})
    collector.syncSchemas([{ name: 'unknown', description: '', parameters: {} }])
    expect(collector.snapshot().labels).toHaveLength(1)
    expect(collector.snapshot('known').labels[0]?.observed.tools).toEqual([])
  })
})
