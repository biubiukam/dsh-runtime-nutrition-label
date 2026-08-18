import type { RuntimeNutritionReport } from '../report.ts'
import type { RuntimeNutritionLabel, SideEffectLevel } from '../types.ts'

type NutritionState = 'idle' | 'observed'
type NutritionAttribution = 'configured' | 'unattributed' | 'mixed'

interface NutritionMetrics {
  readonly tools: number
  readonly schemaBytes: number
  readonly calls: number
  readonly failures: number
  readonly fileReads: number
  readonly fileWrites: number
  readonly domains: number
}

interface NutritionCapabilityRow {
  readonly capability: string
  readonly declared: string
  readonly observed: string
}

export interface NutritionToolRow {
  readonly ownerId: string
  readonly name: string
  readonly schemaBytes: number
  readonly calls: number
  readonly successes: number
  readonly failures: number
  readonly effect: SideEffectLevel
}

export interface NutritionViewModel {
  readonly state: NutritionState
  readonly attribution: NutritionAttribution
  readonly metrics: NutritionMetrics
  readonly capabilities: readonly NutritionCapabilityRow[]
  readonly tools: readonly NutritionToolRow[]
  readonly toolColumns: readonly string[]
  readonly callTraceOpen: boolean
}

export function formatBytes(bytes: number): string {
  if (bytes < 1_000) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB'] as const
  let value = bytes
  let unitIndex = -1
  while (value >= 1_000 && unitIndex < units.length - 1) {
    value /= 1_000
    unitIndex += 1
  }
  const precision = value >= 10 ? 1 : 2
  return `${value.toFixed(precision).replace(/\.?0+$/u, '')} ${units[unitIndex]}`
}

function sumTools(labels: readonly RuntimeNutritionLabel[], selector: (tool: RuntimeNutritionLabel['observed']['tools'][number]) => number): number {
  return labels.reduce((sum, label) => sum + label.observed.tools.reduce((toolSum, tool) => toolSum + selector(tool), 0), 0)
}

function declared(value: boolean): string {
  return value ? 'Declared' : 'Not declared'
}

function capabilityRows(labels: readonly RuntimeNutritionLabel[]): readonly NutritionCapabilityRow[] {
  const networkDomains = labels.reduce((sum, label) => sum + label.observed.network.uniqueDomains, 0)
  const any = (selector: (label: RuntimeNutritionLabel) => boolean): boolean => labels.some(selector)
  return [
    { capability: 'Network', declared: declared(any(label => label.declared.network)), observed: `${networkDomains} ${networkDomains === 1 ? 'domain' : 'domains'}` },
    { capability: 'Credentials', declared: declared(any(label => label.declared.credentials)), observed: 'No runtime evidence' },
    { capability: 'Subprocess', declared: declared(any(label => label.declared.subprocess)), observed: 'No runtime evidence' },
    { capability: 'Persistence', declared: declared(any(label => label.declared.persistence)), observed: 'No runtime evidence' },
  ]
}

function attribution(labels: readonly RuntimeNutritionLabel[]): NutritionAttribution {
  const configured = labels.some(label => label.id !== 'unattributed')
  const unmatched = labels.some(label => label.id === 'unattributed')
  if (configured && unmatched) return 'mixed'
  return configured ? 'configured' : 'unattributed'
}

export function buildNutritionViewModel(report: RuntimeNutritionReport): NutritionViewModel {
  const metrics: NutritionMetrics = {
    tools: report.labels.reduce((sum, label) => sum + label.observed.tools.length, 0),
    schemaBytes: sumTools(report.labels, tool => tool.schemaBytes),
    calls: sumTools(report.labels, tool => tool.calls),
    failures: sumTools(report.labels, tool => tool.failures),
    fileReads: report.labels.reduce((sum, label) => sum + label.observed.filesystem.reads, 0),
    fileWrites: report.labels.reduce((sum, label) => sum + label.observed.filesystem.writes, 0),
    domains: report.labels.reduce((sum, label) => sum + label.observed.network.uniqueDomains, 0),
  }
  const state: NutritionState = report.calls.length > 0 || metrics.calls > 0 ? 'observed' : 'idle'
  const tools = report.labels.flatMap(label => label.observed.tools.map(tool => ({
    ownerId: label.id,
    name: tool.name,
    schemaBytes: tool.schemaBytes,
    calls: tool.calls,
    successes: tool.successes,
    failures: tool.failures,
    effect: tool.effect,
  })))
  return {
    state,
    attribution: attribution(report.labels),
    metrics,
    capabilities: capabilityRows(report.labels),
    tools,
    toolColumns: state === 'idle'
      ? ['Tool', 'Schema', 'Effect']
      : ['Tool', 'Schema', 'Calls', 'Success', 'Failed', 'Effect'],
    callTraceOpen: state === 'observed',
  }
}
