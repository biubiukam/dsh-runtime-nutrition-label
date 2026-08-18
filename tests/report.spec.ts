import { describe, expect, it } from 'vitest'
import { applyRuntimeNutritionProjection, reportForSnapshot } from '../src/report.ts'
import type { RuntimeNutritionProjection, RuntimeNutritionReport } from '../src/report.ts'

function report(commandId: string): RuntimeNutritionReport {
  return {
    schemaVersion: 1,
    commandId,
    scope: 'receiving agent',
    revision: 1,
    generatedAt: '2026-08-18T00:00:00.000Z',
    window: {
      startedAt: '2026-08-18T00:00:00.000Z',
      generatedAt: '2026-08-18T00:00:00.000Z',
    },
    labels: [],
    calls: [],
    truncation: { calls: false, evidence: false },
  }
}

describe('runtime nutrition report projection', () => {
  it('last-wins by command id and keeps a bounded tail', () => {
    let state: RuntimeNutritionProjection = { reports: [] }
    state = applyRuntimeNutritionProjection(state, { type: 'runtime-nutrition-label/report', data: { report: report('cmd-1') } }, 2)
    state = applyRuntimeNutritionProjection(state, { type: 'runtime-nutrition-label/report', data: { report: report('cmd-2') } }, 2)
    state = applyRuntimeNutritionProjection(state, { type: 'runtime-nutrition-label/report', data: { report: report('cmd-1') } }, 2)
    state = applyRuntimeNutritionProjection(state, { type: 'runtime-nutrition-label/report', data: { report: report('cmd-3') } }, 2)
    expect(state.reports.map(value => value.commandId)).toEqual(['cmd-1', 'cmd-3'])
  })

  it('ignores unrelated or malformed events', () => {
    const state: RuntimeNutritionProjection = { reports: [] }
    expect(applyRuntimeNutritionProjection(state, { type: 'tool/result' })).toBe(state)
    expect(applyRuntimeNutritionProjection(state, { type: 'runtime-nutrition-label/report', data: {} })).toBe(state)
    expect(applyRuntimeNutritionProjection(state, { type: 'runtime-nutrition-label/report', data: { report: null } })).toBe(state)
    expect(applyRuntimeNutritionProjection(state, { type: 'runtime-nutrition-label/report', data: { report: { commandId: 1 } } })).toBe(state)
  })

  it('uses the generated time for an empty snapshot window', () => {
    const generatedAt = '2026-08-18T00:00:00.000Z'
    const result = {
      schemaVersion: 1 as const,
      revision: 0,
      generatedAt,
      labels: [],
    }
    expect(reportForSnapshot(result, 'empty', 'test', [], false, false).window.startedAt).toBe(generatedAt)
  })
})
