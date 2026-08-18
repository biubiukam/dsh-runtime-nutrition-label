/** Shared structured report and presentation contracts for the runtime label command. */

import type { RuntimeNutritionLabel, RuntimeNutritionSnapshot, SideEffectLevel } from './types.ts'

type RuntimeCallStatus = 'started' | 'success' | 'failed' | 'discarded'

/** Safe, bounded metadata for one tool execution observed during a command window. */
export interface RuntimeCallTrace {
  readonly ordinal: number
  readonly callId?: string
  readonly rootCallId?: string
  readonly name: string
  readonly ownerId: string
  readonly startedAt: string
  readonly finishedAt?: string
  readonly durationMs?: number
  readonly status: RuntimeCallStatus
  readonly argumentBytes: number
  readonly resultBytes?: number
  readonly effect: SideEffectLevel
  /** Stable category only; never the raw error message. */
  readonly failureCode?: 'tool-error'
}

/** Projection payload attached to one command/done record through sourceEventSeq. */
export interface RuntimeNutritionReport {
  readonly schemaVersion: 1
  readonly commandId: string
  readonly scope: string
  readonly revision: number
  readonly generatedAt: string
  readonly window: {
    readonly startedAt: string
    readonly generatedAt: string
  }
  readonly labels: readonly RuntimeNutritionLabel[]
  readonly calls: readonly RuntimeCallTrace[]
  readonly truncation: {
    readonly calls: boolean
    readonly evidence: boolean
  }
}

export interface RuntimeNutritionProjection {
  readonly reports: readonly RuntimeNutritionReport[]
}

/** A bounded last-wins projection state for command-linked reports. */
export function applyRuntimeNutritionProjection(
  state: RuntimeNutritionProjection,
  event: { readonly type: string; readonly data?: unknown },
  reportLimit = 20,
): RuntimeNutritionProjection {
  if (event.type !== 'runtime-nutrition-label/report') return state
  const data = event.data
  if (typeof data !== 'object' || data === null || !('report' in data)) return state
  const report = (data as { report?: unknown }).report
  if (typeof report !== 'object' || report === null) return state
  const commandId = (report as { commandId?: unknown }).commandId
  if (typeof commandId !== 'string') return state
  const reports = state.reports.filter(candidate => candidate.commandId !== commandId)
  reports.push(report as RuntimeNutritionReport)
  return { reports: reports.slice(-reportLimit) }
}

export function reportForSnapshot(
  snapshot: RuntimeNutritionSnapshot,
  commandId: string,
  scope: string,
  calls: readonly RuntimeCallTrace[],
  callsTruncated: boolean,
  evidenceTruncated: boolean,
): RuntimeNutritionReport {
  const startedAt = snapshot.labels.map(label => label.window.startedAt).sort()[0] ?? snapshot.generatedAt
  return Object.freeze({
    schemaVersion: 1 as const,
    commandId,
    scope,
    revision: snapshot.revision,
    generatedAt: snapshot.generatedAt,
    window: {
      startedAt,
      generatedAt: snapshot.generatedAt,
    },
    labels: snapshot.labels,
    calls: Object.freeze([...calls]),
    truncation: {
      calls: callsTruncated,
      evidence: evidenceTruncated,
    },
  })
}
