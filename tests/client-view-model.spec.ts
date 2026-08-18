import { describe, expect, it } from 'vitest'
import type { RuntimeNutritionReport } from '../src/report.ts'
import { buildNutritionViewModel, formatBytes, formatDuration } from '../src/client/view-model.ts'

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
    expect(formatDuration(0, 0)).toBe('—')
    expect(formatDuration(125, 1)).toBe('125 ms')
    expect(formatDuration(1_250, 1)).toBe('1.25 s')
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
    expect(view.toolColumns).toEqual(['Tool', 'State', 'Usage', 'Avg', 'P95', 'Input / Output', 'Effect'])
    expect(view.attribution).toBe('unattributed')
    expect(view.capabilities[0]).toEqual({ capability: 'Network', declared: 'Not declared', observed: '0 domains' })
    expect(view.tools[0]).toMatchObject({ state: 'Idle', usage: '0 calls' })
  })

  it('expands call metrics when the current window has observed calls', () => {
    const observed = report({
      calls: [{
        ordinal: 1,
        name: 'read',
        ownerId: 'unattributed',
        startedAt: '2026-08-18T00:00:00.000Z',
        status: 'started',
        argumentBytes: 12,
        effect: 'read',
      }],
    })
    const view = buildNutritionViewModel(observed)
    expect(view.state).toBe('observed')
    expect(view.toolColumns).toEqual(['Tool', 'State', 'Usage', 'Avg', 'P95', 'Input / Output', 'Effect'])
    expect(view.metrics.calls).toBe(0)
    expect(view.callTraceOpen).toBe(false)
    expect(view.tools[0]).toMatchObject({ state: 'Active', usage: '1 in flight' })
  })

  it('marks completed failures and successful usage in the tool row', () => {
    const observed = report({
      labels: [{
        ...report().labels[0]!,
        observed: {
          ...report().labels[0]!.observed,
          tools: [{
            ...report().labels[0]!.observed.tools[0]!,
            calls: 3,
            timedCalls: 3,
            successes: 2,
            failures: 1,
            averageDurationMs: 150,
            p95DurationMs: 200,
            argumentBytes: 34,
            resultBytes: 56,
          }],
        },
      }],
      calls: [{
        ordinal: 1,
        name: 'read',
        ownerId: 'unattributed',
        startedAt: '2026-08-18T00:00:00.000Z',
        finishedAt: '2026-08-18T00:00:01.000Z',
        durationMs: 1_000,
        status: 'failed',
        argumentBytes: 12,
        resultBytes: 20,
        effect: 'read',
        failureCode: 'tool-error',
      }],
    })
    expect(buildNutritionViewModel(observed).tools[0]).toMatchObject({
      state: 'Failed',
      usage: '3 calls · 2 ok · 1 failed',
      averageDurationMs: 150,
      p95DurationMs: 200,
      argumentBytes: 34,
      resultBytes: 56,
      records: [expect.objectContaining({ status: 'failed', durationMs: 1_000 })],
    })
  })
})
