import type { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { apply, renderSnapshotMarkdown } from '../src/command.ts'
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

describe('runtime nutrition label command', () => {
  it('renders a compact human-readable Markdown report', () => {
    const markdown = renderSnapshotMarkdown(snapshot)
    expect(markdown).toContain('# Runtime Nutrition Label')
    expect(markdown).toContain('GitHub MCP (github)')
    expect(markdown).toContain('Tool schemas: 1 tools / 42 bytes')
    expect(markdown).toContain('Calls: 3 total / 1 failed')
    expect(markdown).toContain('Declared capabilities: network, credentials')
  })

  it('registers the command and returns an actionable unknown-label error', () => {
    let handler: ((invocation: { readonly rawInput: string }) => unknown) | undefined
    const context = {
      commands: {
        register(definition: { readonly handler: (invocation: { readonly rawInput: string }) => unknown }) {
          handler = definition.handler
          return () => undefined
        },
      },
      runtimeNutritionLabels: {
        snapshot(pluginId?: string) {
          if (pluginId === 'missing') throw new RangeError('runtime-nutrition-label: unknown label "missing"')
          return snapshot
        },
      },
    } as unknown as Context

    apply(context)
    expect(handler).toBeDefined()
    const successResponse = handler?.({ rawInput: '' }) as { kind: string; text: string }
    expect(successResponse.kind).toBe('success')
    const response = handler?.({ rawInput: 'missing' }) as { kind: string; text: string }
    expect(response).toEqual({
      kind: 'error',
      text: 'runtime-nutrition-label: unknown label "missing"',
    })
  })
})
