import type { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { apply, renderRuntimeNutritionReport, renderSnapshotMarkdown } from '../src/command.ts'
import { reportForSnapshot, type RuntimeNutritionReport } from '../src/report.ts'
import type { RuntimeNutritionSnapshot } from '../src/types.ts'

const snapshot: RuntimeNutritionSnapshot = {
  schemaVersion: 1,
  revision: 4,
  generatedAt: '2026-08-18T00:00:00.000Z',
  labels: [{
    id: 'github',
    displayName: 'GitHub MCP',
    window: { startedAt: '2026-08-18T00:00:00.000Z', generatedAt: '2026-08-18T00:00:00.000Z' },
    declared: { network: true, credentials: true, subprocess: false, persistence: false, domains: ['api.github.com'] },
    observed: {
      tools: [{
        name: 'mcp__github__list', schemaBytes: 42, calls: 3, timedCalls: 3,
        successes: 2, failures: 1, averageDurationMs: 12, p95DurationMs: 20,
        argumentBytes: 10, resultBytes: 20, effect: 'read',
      }],
      filesystem: { observations: 2, reads: 2, writes: 0, uniqueTargets: 1, samples: ['file.ts'] },
      network: { callsWithUrls: 3, uniqueDomains: 1, domains: [{ hostname: 'api.github.com', calls: 3 }] },
      sideEffects: { none: 0, read: 3, write: 0, destructive: 0, unknown: 0 },
    },
    evidence: [],
  }],
}

const zeroCallSnapshot: RuntimeNutritionSnapshot = {
  schemaVersion: 1,
  revision: 2,
  generatedAt: '2026-08-18T00:00:00.000Z',
  labels: [{
    id: 'unattributed',
    displayName: 'Unattributed tools',
    window: { startedAt: '2026-08-18T00:00:00.000Z', generatedAt: '2026-08-18T00:00:00.000Z' },
    declared: { network: false, credentials: false, subprocess: false, persistence: false, domains: [] },
    observed: {
      tools: [{
        name: 'read', schemaBytes: 120, calls: 0, timedCalls: 0,
        successes: 0, failures: 0, averageDurationMs: 0, p95DurationMs: 0,
        argumentBytes: 0, resultBytes: 0, effect: 'unknown',
      }],
      filesystem: { observations: 0, reads: 0, writes: 0, uniqueTargets: 0, samples: [] },
      network: { callsWithUrls: 0, uniqueDomains: 0, domains: [] },
      sideEffects: { none: 0, read: 0, write: 0, destructive: 0, unknown: 0 },
    },
    evidence: [],
  }],
}

const emptySnapshot: RuntimeNutritionSnapshot = {
  schemaVersion: 1,
  revision: 3,
  generatedAt: '2026-08-18T00:00:00.000Z',
  labels: [{
    id: 'empty',
    displayName: 'Empty plugin',
    window: { startedAt: '2026-08-18T00:00:00.000Z', generatedAt: '2026-08-18T00:00:00.000Z' },
    declared: { network: false, credentials: false, subprocess: false, persistence: false, domains: [] },
    observed: {
      tools: [],
      filesystem: { observations: 0, reads: 0, writes: 0, uniqueTargets: 0, samples: [] },
      network: { callsWithUrls: 0, uniqueDomains: 0, domains: [] },
      sideEffects: { none: 0, read: 0, write: 0, destructive: 0, unknown: 0 },
    },
    evidence: [],
  }],
}

const largeSchemaSnapshot: RuntimeNutritionSnapshot = {
  schemaVersion: 1,
  revision: 5,
  generatedAt: '2026-08-18T00:00:00.000Z',
  labels: [{
    id: 'large-schema',
    displayName: 'Large schema plugin',
    window: { startedAt: '2026-08-18T00:00:00.000Z', generatedAt: '2026-08-18T00:00:00.000Z' },
    declared: { network: false, credentials: false, subprocess: false, persistence: false, domains: [] },
    observed: {
      tools: [{
        name: 'large', schemaBytes: 25_541, calls: 2, timedCalls: 2,
        successes: 2, failures: 0, averageDurationMs: 1, p95DurationMs: 1,
        argumentBytes: 0, resultBytes: 0, effect: 'none',
      }],
      filesystem: { observations: 0, reads: 0, writes: 0, uniqueTargets: 0, samples: [] },
      network: { callsWithUrls: 0, uniqueDomains: 0, domains: [] },
      sideEffects: { none: 2, read: 0, write: 0, destructive: 0, unknown: 0 },
    },
    evidence: [],
  }],
}

describe('runtime nutrition label command', () => {
  it('renders a complete Unicode table fallback with a current-window trace', () => {
    const report: RuntimeNutritionReport = {
      schemaVersion: 1,
      commandId: 'cmd-1',
      scope: 'receiving agent',
      revision: 4,
      generatedAt: snapshot.generatedAt,
      window: snapshot.labels[0]?.window ?? { startedAt: snapshot.generatedAt, generatedAt: snapshot.generatedAt },
      labels: snapshot.labels,
      calls: [{
        ordinal: 1,
        callId: 'call-1',
        rootCallId: 'root-1',
        name: 'mcp__github__list',
        ownerId: 'github',
        startedAt: snapshot.generatedAt,
        finishedAt: snapshot.generatedAt,
        durationMs: 12,
        status: 'success',
        argumentBytes: 10,
        resultBytes: 20,
        effect: 'read',
      }, {
        ordinal: 2,
        name: 'mcp__github__pending',
        ownerId: 'github',
        startedAt: snapshot.generatedAt,
        status: 'started',
        argumentBytes: 0,
        effect: 'unknown',
      }],
      truncation: { calls: true, evidence: true },
    }
    const text = renderRuntimeNutritionReport(report)
    expect(text).toContain('┌')
    expect(text).toContain('└')
    expect(text).toContain('Tool call trace (current window)')
    expect(text).toContain('mcp__github__list')
    expect(text).not.toContain('| Tool | Schema |')

    const longText = renderRuntimeNutritionReport({
      ...report,
      calls: [{ ...report.calls[0]!, name: '工具名称-very-long-tool-name-that-is-bounded-by-the-renderer' }],
    })
    expect(longText).toContain('…')

    const emptyText = renderRuntimeNutritionReport({ ...report, labels: [], calls: [] })
    expect(emptyText).toContain('Status: no labels observed')
  })

  it('renders a summary-first report with declared and observed capability sections', () => {
    const markdown = renderSnapshotMarkdown(snapshot, { scope: 'receiving agent' })
    expect(markdown).toContain('# Runtime Nutrition Label')
    expect(markdown).toContain('Scope: receiving agent')
    expect(markdown).toContain('GitHub MCP (github)')
    expect(markdown).toContain('Window: 2026-08-18T00:00:00.000Z — 2026-08-18T00:00:00.000Z')
    expect(markdown).toContain('✅ Plugin attribution configured')
    expect(markdown).toContain('| Visible tools | 1 | ✅ Loaded |')
    expect(markdown).toContain('| Tool schemas | 42 B | ✅ Loaded |')
    expect(markdown).toContain('| Tool calls | 3 | ✅ Observed |')
    expect(markdown).toContain('| Failed calls | 1 | ⚠️ 33.3% failure rate |')
    expect(markdown).toContain('| Network | yes | 1 domain |')
    expect(markdown).toContain('| Credentials | yes | No runtime evidence |')
    expect(markdown).toContain('| `mcp__github__list` | 42 B | 3 | 2 | 1 | read |')
  })

  it('explains an unloaded attribution mapping and a zero-call observation window', () => {
    const markdown = renderSnapshotMarkdown(zeroCallSnapshot)
    expect(markdown).toContain('## Unattributed tools (unattributed)')
    expect(markdown).toContain('⏳ No tool calls observed in this window')
    expect(markdown).toContain('ℹ️ Attribution not configured')
    expect(markdown).toContain('| Tool calls | 0 | ⏳ Not observed |')
    expect(markdown).toContain('These tools are loaded, but the profile has not mapped them to a plugin.')
    expect(markdown).toContain('| `read` | 120 B | 0 | 0 | 0 | unknown |')
  })

  it('renders empty registries, large schema sizes, and successful-call status', () => {
    const emptyMarkdown = renderSnapshotMarkdown(emptySnapshot)
    expect(emptyMarkdown).toContain('⏳ No tools observed')
    expect(emptyMarkdown).toContain('| Tool schemas | 0 B | ⏳ Not observed |')
    expect(emptyMarkdown).toContain('No tools observed in this window.')

    const largeMarkdown = renderSnapshotMarkdown(largeSchemaSnapshot)
    expect(largeMarkdown).toContain('| Tool schemas | 25.5 KB | ✅ Loaded |')
    expect(largeMarkdown).toContain('| Failed calls | 0 | ✅ 0% failure rate |')
  })

  it('registers the command and returns an actionable unknown-label error', () => {
    let handler: ((invocation: { readonly agent: object; readonly rawInput: string }) => unknown) | undefined
    const agent = { id: 'web-agent' }
    const context = {
      commands: {
        register(definition: { readonly handler: (invocation: { readonly agent: object; readonly rawInput: string }) => unknown }) {
          handler = definition.handler
          return () => undefined
        },
      },
      runtimeNutritionLabels: {
        snapshotFor(_agent: object, pluginId?: string) {
          if (pluginId === 'missing') throw new RangeError('runtime-nutrition-label: unknown label "missing"')
          return snapshot
        },
      },
    } as unknown as Context

    apply(context)
    expect(handler).toBeDefined()
    const successResponse = handler?.({ agent, rawInput: '' }) as { kind: string; text: string }
    expect(successResponse.kind).toBe('success')
    expect(successResponse.text).toContain('Scope: receiving agent')
    const response = handler?.({ agent, rawInput: 'missing' }) as { kind: string; text: string }
    expect(response).toEqual({
      kind: 'error',
      text: 'runtime-nutrition-label: unknown label "missing"',
    })
  })

  it('links a structured report event without making the text adapter depend on it', () => {
    let handler: ((invocation: { readonly agent: object; readonly commandId: string; readonly rawInput: string }) => unknown) | undefined
    const events: unknown[] = []
    const agent = { session: { append(type: string, data: unknown) { events.push({ type, data }); return { seq: 12 } } } }
    const context = {
      commands: {
        register(definition: { readonly handler: (invocation: { readonly agent: object; readonly commandId: string; readonly rawInput: string }) => unknown }) {
          handler = definition.handler
          return () => undefined
        },
      },
      runtimeNutritionLabels: {
        reportFor() {
          return reportForSnapshot(snapshot, 'cmd-1', 'receiving agent', [], false, false)
        },
      },
    } as unknown as Context

    apply(context)
    const response = handler?.({ agent, commandId: 'cmd-1', rawInput: '' }) as { kind: string; sourceEventSeq?: number; text: string }
    expect(response.kind).toBe('success')
    expect(response.sourceEventSeq).toBe(12)
    expect(events).toHaveLength(1)
    expect(JSON.stringify(events[0])).not.toContain('raw')
  })

  it('still succeeds when the optional report event cannot be appended', () => {
    let handler: ((invocation: { readonly agent: object; readonly commandId: string; readonly rawInput: string }) => unknown) | undefined
    const agent = { session: { append() { throw new Error('session event unsupported') } } }
    const context = {
      commands: {
        register(definition: { readonly handler: (invocation: { readonly agent: object; readonly commandId: string; readonly rawInput: string }) => unknown }) {
          handler = definition.handler
          return () => undefined
        },
      },
      runtimeNutritionLabels: {
        reportFor() {
          return reportForSnapshot(snapshot, 'cmd-2', 'receiving agent', [], false, false)
        },
      },
    } as unknown as Context
    apply(context)
    const response = handler?.({ agent, commandId: 'cmd-2', rawInput: '' }) as { kind: string; sourceEventSeq?: number }
    expect(response.kind).toBe('success')
    expect(response).not.toHaveProperty('sourceEventSeq')
  })
})
