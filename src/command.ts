/** Optional human command consumer for runtime nutrition label snapshots. */

import type { Context } from '@deepseek-ai/cordis'
import type { RuntimeNutritionLabel, RuntimeNutritionSnapshot } from './types.ts'

export const name = 'runtime-nutrition-label-command'
export const inject = ['commands', 'runtimeNutritionLabels']

function renderLabel(label: RuntimeNutritionLabel): string {
  const calls = label.observed.tools.reduce((sum, tool) => sum + tool.calls, 0)
  const failures = label.observed.tools.reduce((sum, tool) => sum + tool.failures, 0)
  const schemaBytes = label.observed.tools.reduce((sum, tool) => sum + tool.schemaBytes, 0)
  const declared = [
    label.declared.network ? 'network' : undefined,
    label.declared.credentials ? 'credentials' : undefined,
    label.declared.subprocess ? 'subprocess' : undefined,
    label.declared.persistence ? 'persistence' : undefined,
  ].filter((value): value is string => value !== undefined)
  return [
    `## ${label.displayName} (${label.id})`,
    '',
    `- Tool schemas: ${label.observed.tools.length} tools / ${schemaBytes} bytes`,
    `- Calls: ${calls} total / ${failures} failed`,
    `- Filesystem: ${label.observed.filesystem.reads} reads / ${label.observed.filesystem.writes} writes`,
    `- Network: ${label.observed.network.uniqueDomains} observed domains`,
    `- Declared capabilities: ${declared.join(', ') || 'none'}`,
  ].join('\n')
}

/** Render a snapshot as compact Markdown for interactive command adapters. */
export function renderSnapshotMarkdown(snapshot: RuntimeNutritionSnapshot): string {
  return [
    '# Runtime Nutrition Label',
    '',
    `Schema version: ${snapshot.schemaVersion}; revision: ${snapshot.revision}; generated: ${snapshot.generatedAt}`,
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
    handler: ({ rawInput }) => {
      const pluginId = rawInput.trim() || undefined
      try {
        return { kind: 'success', text: renderSnapshotMarkdown(ctx.runtimeNutritionLabels.snapshot(pluginId)) }
      } catch (error: unknown) {
        return {
          kind: 'error',
          text: error instanceof Error ? error.message : String(error),
        }
      }
    },
  })
}
