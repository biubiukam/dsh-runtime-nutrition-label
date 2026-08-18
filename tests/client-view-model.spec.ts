import { describe, expect, it } from 'vitest'
import type { RuntimeNutritionReport } from '../src/report.ts'
import { buildNutritionViewModel, formatBytes } from '../src/client/view-model.ts'

function report(overrides: Partial<RuntimeNutritionReport> = {}): RuntimeNutritionReport {
  const label = {
    id: 'unattributed',
    displayName: 'Unattributed tools',
    window: { startedAt: '2026-08-18T00:00:00.000Z', generatedAt: '2026-08-18T00:00:00.000Z' },
    declared: { network: false, credentials: false, subprocess: false, persistence: false, domains: [] },
    observed: {
      tools: [{
        name: 'read', schemaBytes: 120, calls: 0, timedCalls: 0,
        successes: 0, failures: 0, averageDurationMs: 0, p95DurationMs: 0,
        argumentBytes: 0, resultBytes: 0, effect: 'unknown' as const,
      }],
      filesystem: { observations: 0, reads: 0, writes: 0, uniqueTargets: 0, samples: [] },
      network: { callsWithUrls: 0, uniqueDomains: 0, domains: [] },
      sideEffects: { none: 0, read: 0, write: 0, destructive: 0, unknown: 0 },
    },
    evidence: [],
  }
  return {
    schemaVersion: 1,
    commandId: 'cmd-1',
    scope: 'receiving agent',
    revision: 1,
    generatedAt: '2026-08-18T00:00:00.000Z',
    window: { startedAt: '2026-08-18T00:00:00.000Z', generatedAt: '2026-08-18T00:00:00.000Z' },
    labels: [label],
    calls: [],
    truncation: { calls: false, evidence: false },
    ...overrides,
  }
}

describe('runtime nutrition client view model', () => {
  it('formats schema sizes for the product label', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(25_541)).toBe('25.5 KB')
  })

  it('uses a compact idle directory and aggregates summary metrics', () => {
    const view = buildNutritionViewModel(report())
    expect(view.state).toBe('idle')
    expect(view.metrics).toEqual({
      tools: 1,
      schemaBytes: 120,
      calls: 0,
      failures: 0,
      fileReads: 0,
      fileWrites: 0,
      domains: 0,
    })
    expect(view.toolColumns).toEqual(['Tool', 'Schema', 'Effect'])
    expect(view.attribution).toBe('unattributed')
    expect(view.capabilities[0]).toEqual({ capability: 'Network', declared: 'Not declared', observed: '0 domains' })
  })

  it('expands call metrics when the current window has observed calls', () => {
    const observed = report({
      calls: [{
        ordinal: 1,
        name: 'read',
        ownerId: 'unattributed',
        startedAt: '2026-08-18T00:00:00.000Z',
        status: 'success',
        argumentBytes: 12,
        effect: 'read',
      }],
    })
    const view = buildNutritionViewModel(observed)
    expect(view.state).toBe('observed')
    expect(view.toolColumns).toEqual(['Tool', 'Schema', 'Calls', 'Success', 'Failed', 'Effect'])
    expect(view.metrics.calls).toBe(0)
    expect(view.callTraceOpen).toBe(true)
  })
})
