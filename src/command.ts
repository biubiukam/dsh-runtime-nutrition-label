/** Optional human command consumer for runtime nutrition label snapshots. */

import type { Context } from '@deepseek-ai/cordis'
import { reportForSnapshot, type RuntimeNutritionReport, type RuntimeCallTrace } from './report.ts'
import type { RuntimeNutritionLabel, RuntimeNutritionSnapshot, ToolRuntimeMetric } from './types.ts'

export const name = 'runtime-nutrition-label-command'
export const inject = ['commands', 'runtimeNutritionLabels']

export interface SnapshotRenderOptions {
  /** Human-readable scope that produced the snapshot. */
  readonly scope?: string
}

interface UnicodeTableOptions {
  readonly numericColumns?: readonly number[]
  readonly maxColumnWidth?: number
}

function displayWidth(value: string): number {
  let width = 0
  for (const character of value) {
    width += /[\u1100-\u115f\u2329\u232a\u2e80-\u303e\u3040-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe19\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6]/u.test(character) ? 2 : 1
  }
  return width
}

function cropCell(value: string, maxWidth: number): string {
  if (displayWidth(value) <= maxWidth) return value
  if (maxWidth <= 1) return '…'.slice(0, maxWidth)
  let result = ''
  for (const character of value) {
    if (displayWidth(`${result}${character}…`) > maxWidth) break
    result += character
  }
  return `${result}…`
}

function padCell(value: string, width: number, numeric: boolean): string {
  const padding = ' '.repeat(Math.max(0, width - displayWidth(value)))
  return numeric ? `${padding}${value}` : `${value}${padding}`
}

function unicodeTable(headers: readonly string[], rows: readonly (readonly string[])[], options: UnicodeTableOptions = {}): string {
  const maxWidth = options.maxColumnWidth ?? 32
  const numeric = new Set(options.numericColumns ?? [])
  const values = [headers, ...rows]
  const widths = headers.map((header, index) => Math.min(maxWidth, Math.max(...values.map(row => displayWidth(cropCell(row[index] ?? '', maxWidth)), 0), displayWidth(header))))
  const line = (left: string, fill: string, middle: string, right: string): string => `${left}${widths.map(width => fill.repeat(width + 2)).join(middle)}${right}`
  const renderRow = (row: readonly string[]): string => `│ ${row.map((value, index) => padCell(cropCell(value, maxWidth), widths[index] ?? maxWidth, numeric.has(index))).join(' │ ')} │`
  return [
    line('┌', '─', '┬', '┐'),
    renderRow(headers),
    line('├', '─', '┼', '┤'),
    ...rows.map(renderRow),
    line('└', '─', '┴', '┘'),
  ].join('\n')
}

function labelSummary(label: RuntimeNutritionLabel): { calls: number; successes: number; failures: number; schemaBytes: number } {
  return label.observed.tools.reduce((summary, tool) => ({
    calls: summary.calls + tool.calls,
    successes: summary.successes + tool.successes,
    failures: summary.failures + tool.failures,
    schemaBytes: summary.schemaBytes + tool.schemaBytes,
  }), { calls: 0, successes: 0, failures: 0, schemaBytes: 0 })
}

function effectLabel(effect: RuntimeCallTrace['effect']): string {
  return effect === 'unknown' ? 'unknown' : effect
}

/** Render a safe report as a Unicode table for text-only adapters and fallback cards. */
export function renderRuntimeNutritionReport(report: RuntimeNutritionReport): string {
  const lines = [
    'Runtime Nutrition Label',
    `Scope: ${report.scope}`,
    `Command: ${report.commandId}`,
    `Revision: ${report.revision}`,
    `Window: ${report.window.startedAt} — ${report.window.generatedAt}`,
    '',
    report.labels.length > 0 ? 'Status' : 'Status: no labels observed',
  ]
  for (const label of report.labels) {
    const summary = labelSummary(label)
    lines.push(`${label.displayName} (${label.id})`)
    lines.push(summary.schemaBytes > 0 ? '  ✅ tools loaded' : '  ⏳ no tools observed')
    lines.push(summary.calls > 0 ? `  ✅ ${summary.calls} tool ${summary.calls === 1 ? 'call' : 'calls'} observed` : '  ⏳ no tool calls observed in this window')
    lines.push(label.id === 'unattributed' ? '  ℹ️ attribution not configured' : '  ✅ plugin attribution configured')
  }
  lines.push('', 'Runtime summary')
  const summaryRows = report.labels.map(label => {
    const summary = labelSummary(label)
    return [label.id, String(label.observed.tools.length), formatBytes(summary.schemaBytes), String(summary.calls), String(summary.successes), String(summary.failures), String(label.observed.filesystem.reads), String(label.observed.filesystem.writes), String(label.observed.network.uniqueDomains)]
  })
  lines.push(unicodeTable(['Label', 'Tools', 'Schema', 'Calls', 'Success', 'Failed', 'File read', 'File write', 'Domains'], summaryRows, { numericColumns: [1, 3, 4, 5, 6, 7, 8], maxColumnWidth: 24 }))
  lines.push('', 'Capability observation')
  const capabilityRows = report.labels.flatMap(label => [
    [label.id, 'Network', declaredValue(label.declared.network), `${label.observed.network.uniqueDomains} domain${label.observed.network.uniqueDomains === 1 ? '' : 's'}`],
    [label.id, 'Credentials', declaredValue(label.declared.credentials), 'No runtime evidence'],
    [label.id, 'Subprocess', declaredValue(label.declared.subprocess), 'No runtime evidence'],
    [label.id, 'Persistence', declaredValue(label.declared.persistence), 'No runtime evidence'],
  ])
  lines.push(unicodeTable(['Label', 'Capability', 'Declared', 'Observed'], capabilityRows, { maxColumnWidth: 28 }))
  lines.push('', 'Tool directory')
  const toolRows = report.labels.flatMap(label => label.observed.tools.map(tool => [label.id, tool.name, formatBytes(tool.schemaBytes), String(tool.calls), String(tool.successes), String(tool.failures), tool.effect]))
  lines.push(toolRows.length === 0 ? 'No tools observed in this window.' : unicodeTable(['Label', 'Tool', 'Schema', 'Calls', 'Success', 'Failed', 'Effect'], toolRows, { numericColumns: [3, 4, 5], maxColumnWidth: 28 }))
  lines.push('', `Tool call trace (current window)${report.truncation.calls ? ' (capped)' : ''}`)
  const callRows = report.calls.map(call => [String(call.ordinal), call.name, call.ownerId, call.status, call.durationMs === undefined ? '—' : `${call.durationMs} ms`, formatBytes(call.argumentBytes), call.resultBytes === undefined ? '—' : formatBytes(call.resultBytes), effectLabel(call.effect), call.failureCode ?? '—'])
  lines.push(callRows.length === 0 ? 'No tool calls recorded for this command.' : unicodeTable(['#', 'Tool', 'Owner', 'Status', 'Duration', 'Args', 'Result', 'Effect', 'Failure'], callRows, { numericColumns: [0, 4], maxColumnWidth: 28 }))
  lines.push('', `Evidence buffer: ${report.truncation.evidence ? 'capped; oldest records omitted' : 'bounded and complete for this window'}`)
  return lines.join('\n')
}

function formatBytes(bytes: number): string {
  if (bytes < 1_000) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB'] as const
  let value = bytes
  let unitIndex = -1
  while (value >= 1_000 && unitIndex < units.length - 1) {
    value /= 1_000
    unitIndex += 1
  }
  const precision = value >= 10 ? 1 : 2
  const formatted = value.toFixed(precision).replace(/\.?0+$/, '')
  return `${formatted} ${units[unitIndex]}`
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm
}

function declaredValue(value: boolean): string {
  return value ? 'yes' : 'no'
}

function failureStatus(calls: number, failures: number): string {
  if (calls === 0) return '⏳ Not observed'
  if (failures === 0) return '✅ 0% failure rate'
  const rate = Math.round((failures / calls) * 1_000) / 10
  return `⚠️ ${rate}% failure rate`
}

function callStatus(calls: number): string {
  return calls === 0 ? '⏳ Not observed' : '✅ Observed'
}

function sumTools(label: RuntimeNutritionLabel, selector: (tool: ToolRuntimeMetric) => number): number {
  return label.observed.tools.reduce((sum, tool) => sum + selector(tool), 0)
}

function renderStatus(label: RuntimeNutritionLabel, calls: number): string {
  const toolStatus = label.observed.tools.length > 0 ? '✅ Tools loaded' : '⏳ No tools observed'
  const callStatusText = calls > 0 ? '✅ Tool calls observed' : '⏳ No tool calls observed in this window'
  const attributionStatus = label.id === 'unattributed'
    ? 'ℹ️ Attribution not configured'
    : '✅ Plugin attribution configured'
  return [
    '### Current status',
    '',
    toolStatus,
    callStatusText,
    attributionStatus,
  ].join('\n')
}

function renderSummary(label: RuntimeNutritionLabel, calls: number, successes: number, failures: number, schemaBytes: number): string {
  return [
    '### Runtime summary',
    '',
    '| Metric | Current value | Status |',
    '| --- | ---: | --- |',
    `| Visible tools | ${label.observed.tools.length} | ${label.observed.tools.length > 0 ? '✅ Loaded' : '⏳ Not observed'} |`,
    `| Tool schemas | ${formatBytes(schemaBytes)} | ${schemaBytes > 0 ? '✅ Loaded' : '⏳ Not observed'} |`,
    `| Tool calls | ${calls} | ${callStatus(calls)} |`,
    `| Successful calls | ${successes} | — |`,
    `| Failed calls | ${failures} | ${failureStatus(calls, failures)} |`,
    `| Filesystem reads | ${label.observed.filesystem.reads} | — |`,
    `| Filesystem writes | ${label.observed.filesystem.writes} | — |`,
    `| Network domains | ${label.observed.network.uniqueDomains} | — |`,
  ].join('\n')
}

function renderCapabilities(label: RuntimeNutritionLabel): string {
  const observedNetwork = `${label.observed.network.uniqueDomains} ${plural(label.observed.network.uniqueDomains, 'domain')}`
  return [
    '### Capability observation',
    '',
    '| Capability | Declared | Observed |',
    '| --- | --- | --- |',
    `| Network | ${declaredValue(label.declared.network)} | ${observedNetwork} |`,
    `| Credentials | ${declaredValue(label.declared.credentials)} | No runtime evidence |`,
    `| Subprocess | ${declaredValue(label.declared.subprocess)} | No runtime evidence |`,
    `| Persistence | ${declaredValue(label.declared.persistence)} | No runtime evidence |`,
  ].join('\n')
}

function renderTools(label: RuntimeNutritionLabel): string {
  const rows = label.observed.tools.length === 0
    ? ['No tools observed in this window.']
    : [
        '| Tool | Schema | Calls | Success | Failed | Effect |',
        '| --- | ---: | ---: | ---: | ---: | --- |',
        ...label.observed.tools.map(tool => `| \`${tool.name}\` | ${formatBytes(tool.schemaBytes)} | ${tool.calls} | ${tool.successes} | ${tool.failures} | ${tool.effect} |`),
      ]
  return ['### Tool directory', '', ...rows].join('\n')
}

function renderAttribution(label: RuntimeNutritionLabel): string {
  if (label.id === 'unattributed') {
    return [
      '### Attribution',
      '',
      'These tools are loaded, but the profile has not mapped them to a plugin.',
      'Configure exact tool names or prefixes in the profile to assign a plugin id.',
    ].join('\n')
  }
  return [
    '### Attribution',
    '',
    `Tools in this report are attributed to \`${label.id}\` (${label.displayName}) by profile configuration.`,
  ].join('\n')
}

function renderLabel(label: RuntimeNutritionLabel): string {
  const calls = sumTools(label, tool => tool.calls)
  const successes = sumTools(label, tool => tool.successes)
  const failures = sumTools(label, tool => tool.failures)
  const schemaBytes = sumTools(label, tool => tool.schemaBytes)
  return [
    `## ${label.displayName} (${label.id})`,
    '',
    `Window: ${label.window.startedAt} — ${label.window.generatedAt}`,
    '',
    renderStatus(label, calls),
    '',
    renderSummary(label, calls, successes, failures, schemaBytes),
    '',
    renderCapabilities(label),
    '',
    renderTools(label),
    '',
    renderAttribution(label),
  ].join('\n')
}

/** Render a snapshot as summary-first Markdown for interactive command adapters. */
export function renderSnapshotMarkdown(snapshot: RuntimeNutritionSnapshot, options: SnapshotRenderOptions = {}): string {
  const scope = options.scope ?? 'runtime snapshot'
  return [
    '# Runtime Nutrition Label',
    '',
    `Scope: ${scope}`,
    `Revision: ${snapshot.revision}`,
    `Generated: ${snapshot.generatedAt}`,
    '',
    ...snapshot.labels.flatMap((label, index) => [renderLabel(label), ...index < snapshot.labels.length - 1 ? ['', '---', ''] : []]),
  ].join('\n')
}

/** Register `/nutrition-label [plugin-id]` without adding model-visible context. */
export function apply(ctx: Context): void {
  ctx.commands.register({
    name: 'nutrition-label',
    description: 'Show evidence-backed runtime behavior for configured plugins',
    input: { hint: '[plugin-id]' },
    handler: ({ agent, commandId, rawInput }) => {
      const pluginId = rawInput.trim() || undefined
      try {
        const service = ctx.runtimeNutritionLabels
        const report = typeof service.reportFor === 'function'
          ? service.reportFor(agent, commandId ?? 'unavailable', 'receiving agent', pluginId)
          : reportForSnapshot(service.snapshotFor(agent, pluginId), commandId ?? 'unavailable', 'receiving agent', [], false, false)
        const session = (agent as { readonly session?: { append?: (type: string, data: unknown) => { readonly seq: number } } }).session
        let reportEvent: { readonly seq: number } | undefined
        try {
          reportEvent = session?.append?.('runtime-nutrition-label/report', { commandId, report })
        } catch {
          // Older/headless adapters may not mount the optional session event seam.
          reportEvent = undefined
        }
        return {
          kind: 'success',
          text: renderRuntimeNutritionReport(report),
          ...reportEvent?.seq === undefined ? {} : { sourceEventSeq: reportEvent.seq },
        }
      } catch (error: unknown) {
        return {
          kind: 'error',
          text: error instanceof Error ? error.message : String(error),
        }
      }
    },
  })
}
