/** Browser presentation for the nutrition-label command. */

// The standalone package intentionally keeps the browser-side framework a peer
// boundary. The Host package can still typecheck without installing the full
// Web workspace; the parent Harness client build resolves these imports.
import type { RuntimeNutritionProjection, RuntimeNutritionReport } from '../report.ts'
import type { SideEffectLevel } from '../types.ts'
import css from './index.module.css'
import { buildNutritionViewModel, formatBytes, type NutritionToolRow } from './view-model.ts'

interface ReactApi {
  createElement(type: string, props: Record<string, unknown> | null, ...children: readonly unknown[]): unknown
}

// The clientBundle factory provides the loader-scoped require function. Keeping
// this as a require call avoids making React a standalone Host dependency.
const React = require('react') as ReactApi

interface CommandNode {
  readonly commandId: string
  readonly outcome: { readonly kind: 'success' | 'error'; readonly text?: string } | null
}

interface NutritionProps {
  readonly node: CommandNode
  readonly useProjection: (key: string) => unknown
}

interface ClientContext {
  readonly slots: {
    inject(name: string, factory: () => unknown): void
    register(options: { readonly name: string; readonly key: string }, component: unknown): unknown
  }
}

function classNames(...values: readonly (string | undefined | false)[]): string {
  return values.filter(Boolean).join(' ')
}

function table(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
  numericColumns: readonly number[] = [],
  extraClass?: string,
): unknown {
  const numeric = new Set(numericColumns)
  const head = React.createElement(
    'thead',
    { key: 'head' },
    React.createElement('tr', null, headers.map((header, index) => React.createElement(
      'th',
      { key: `${header}-${index}`, scope: 'col', className: numeric.has(index) ? css.numeric : undefined },
      header,
    ))),
  )
  const bodyRows = rows.map((row, rowIndex) => React.createElement(
    'tr',
    { key: rowIndex },
    row.map((value, column) => React.createElement(
      'td',
      { key: `${rowIndex}-${column}`, className: numeric.has(column) ? css.numeric : undefined },
      value,
    )),
  ))
  return React.createElement('div', { className: css.tableWrap }, React.createElement(
    'table',
    { className: classNames(css.table, extraClass) },
    [head, React.createElement('tbody', { key: 'body' }, bodyRows)],
  ))
}

function pill(label: string, variant: 'ready' | 'warning' | 'danger' | undefined, key: string): unknown {
  return React.createElement('span', { className: classNames(css.pill, variant === undefined ? undefined : css[variant]), key }, label)
}

function reportFor(props: NutritionProps): RuntimeNutritionReport | undefined {
  const projection = props.useProjection('runtimeNutritionLabel') as RuntimeNutritionProjection | undefined
  return projection?.reports.find(report => report.commandId === props.node.commandId)
}

function fallback(props: NutritionProps): unknown {
  return React.createElement('section', { className: classNames(css.card, css.fallback), 'data-state': props.node.outcome?.kind ?? 'running' }, [
    React.createElement('strong', { className: css.fallbackTitle, key: 'title' }, 'Runtime Nutrition Label'),
    props.node.outcome?.text === undefined ? null : React.createElement('pre', { className: css.fallbackBody, key: 'body' }, props.node.outcome.text),
  ])
}

function effect(effect: SideEffectLevel): unknown {
  return React.createElement('span', { className: css.effect }, effect)
}

function summaryStrip(view: ReturnType<typeof buildNutritionViewModel>): unknown {
  return React.createElement('div', { className: css.summaryStrip, 'aria-label': 'Runtime summary' }, [
    React.createElement('p', { className: css.summaryPrimary, key: 'primary' }, [
      React.createElement('strong', { key: 'tools' }, `${view.metrics.tools} tools`),
      ' · ', React.createElement('strong', { key: 'schema' }, `${formatBytes(view.metrics.schemaBytes)} schema`),
      ' · ', React.createElement('strong', { key: 'calls' }, `${view.metrics.calls} calls`),
      ' · ', React.createElement('strong', { key: 'failures' }, `${view.metrics.failures} failures`),
    ]),
    React.createElement('p', { className: css.summarySecondary, key: 'secondary' }, `Files ${view.metrics.fileReads} read / ${view.metrics.fileWrites} write · ${view.metrics.domains} domains observed`),
  ])
}

function capabilityTable(view: ReturnType<typeof buildNutritionViewModel>): unknown {
  const rows = view.capabilities.map(row => [
    row.capability,
    row.declared,
    React.createElement('span', {
      className: classNames(css.evidence, row.observed !== 'No runtime evidence' ? css.evidenceObserved : undefined),
      key: `${row.capability}-observed`,
    }, row.observed),
  ])
  return React.createElement('section', { className: css.panel, key: 'capabilities' }, [
    React.createElement('div', { className: css.panelTitle, key: 'title' }, [
      React.createElement('h3', { key: 'heading' }, 'Declared vs. observed'),
      React.createElement('span', { key: 'hint' }, 'facts and declarations'),
    ]),
    table(['Capability', 'Declared', 'Observed'], rows),
  ])
}

function attributionCallout(attribution: ReturnType<typeof buildNutritionViewModel>['attribution']): unknown {
  const configured = attribution === 'configured'
  const mixed = attribution === 'mixed'
  const title = configured ? 'Plugin attribution configured' : mixed ? 'Some tools need attribution' : 'Attribution not configured'
  const body = configured
    ? 'Tools in this report are mapped to configured plugin identities.'
    : mixed
      ? 'Some tools are mapped, while unmatched tools remain under the reserved unattributed label.'
      : 'Tools are loaded, but the profile has not mapped them to a plugin. Configure exact names or prefixes in the profile.'
  return React.createElement('section', { className: css.attribution, key: 'attribution' }, [
    React.createElement('div', { className: classNames(css.callout, configured ? css.calloutConfigured : undefined), key: 'callout' }, [
      React.createElement('strong', { key: 'title' }, title),
      React.createElement('p', { key: 'body' }, body),
    ]),
    React.createElement('p', { className: css.readingNote, key: 'note' }, 'No runtime evidence means this window did not observe proof; it does not prove the capability is impossible.'),
  ])
}

function toolDirectory(view: ReturnType<typeof buildNutritionViewModel>): unknown {
  const ownerIds = new Set(view.tools.map(tool => tool.ownerId))
  const includeOwner = ownerIds.size > 1
  const headers = [
    ...(includeOwner ? ['Owner'] : []),
    ...view.toolColumns,
  ]
  const rows = view.tools.map((tool: NutritionToolRow) => [
    ...(includeOwner ? [tool.ownerId] : []),
    React.createElement('code', { className: css.toolName, key: `${tool.ownerId}-${tool.name}` }, tool.name),
    formatBytes(tool.schemaBytes),
    ...(view.state === 'idle' ? [] : [tool.calls, tool.successes, tool.failures]),
    effect(tool.effect),
  ])
  const numericColumns = includeOwner
    ? [2, ...(view.state === 'idle' ? [] : [3, 4, 5])]
    : [1, ...(view.state === 'idle' ? [] : [2, 3, 4])]
  return React.createElement('details', { key: 'tools' }, [
    React.createElement('summary', { key: 'summary' }, [
      'Tool directory',
      React.createElement('span', { className: css.count, key: 'count' }, String(view.tools.length)),
      React.createElement('span', { className: css.summaryHint, key: 'hint' }, 'Full registry, shown on demand'),
    ]),
    React.createElement('div', { className: css.detailsBody, key: 'body' }, view.tools.length === 0
      ? React.createElement('div', { className: css.empty }, 'No tools observed in this window.')
      : table(headers, rows, numericColumns)),
  ])
}

function callTrace(report: RuntimeNutritionReport, view: ReturnType<typeof buildNutritionViewModel>): unknown {
  const rows = report.calls.map(call => [
    call.ordinal,
    React.createElement('code', { key: `${call.ordinal}-name` }, call.name),
    call.ownerId,
    call.status,
    call.durationMs === undefined ? '—' : `${call.durationMs} ms`,
    formatBytes(call.argumentBytes),
    call.resultBytes === undefined ? '—' : formatBytes(call.resultBytes),
    effect(call.effect),
    call.failureCode ?? '—',
  ])
  return React.createElement('details', { key: 'calls', open: view.callTraceOpen }, [
    React.createElement('summary', { key: 'summary' }, [
      'Tool call trace',
      React.createElement('span', { className: css.count, key: 'count' }, String(report.calls.length)),
      React.createElement('span', { className: css.summaryHint, key: 'hint' }, report.calls.length === 0 ? 'No calls in this window' : report.truncation.calls ? 'Capped sample' : 'Current window only'),
    ]),
    React.createElement('div', { className: css.detailsBody, key: 'body' }, rows.length === 0
      ? React.createElement('div', { className: css.empty }, [
          React.createElement('div', { key: 'empty-copy' }, [
            React.createElement('strong', { key: 'title' }, 'No calls observed'),
            'A call will appear here with order, duration, status, and safe metadata.',
          ]),
        ])
      : table(['#', 'Tool', 'Owner', 'Status', 'Duration', 'Args', 'Result', 'Effect', 'Failure'], rows, [0, 4, 5, 6])),
  ])
}

/** Real HTML-table renderer for `/nutrition-label` command rows. */
export function NutritionCommandCard(props: NutritionProps): unknown {
  const report = reportFor(props)
  if (report === undefined) return fallback(props)
  const view = buildNutritionViewModel(report)
  const stateLabel = view.state === 'idle' ? 'Idle window' : 'Observed activity'
  const statusPills = [
    pill(view.metrics.tools > 0 ? 'Ready' : 'No tools', view.metrics.tools > 0 ? 'ready' : undefined, 'ready'),
    pill(stateLabel, undefined, 'state'),
    ...(view.metrics.failures > 0 ? [pill(`${view.metrics.failures} failure${view.metrics.failures === 1 ? '' : 's'}`, 'danger', 'failures')] : []),
    ...(view.attribution === 'configured' ? [] : [pill(view.attribution === 'mixed' ? 'Mixed attribution' : 'Needs attribution', 'warning', 'attribution')]),
  ]
  const observedEvents = Math.max(view.metrics.calls, report.calls.length)
  const verdictTitle = view.state === 'idle'
    ? 'Runtime ready; no tool calls observed in this window.'
    : `${observedEvents} tool event${observedEvents === 1 ? '' : 's'} recorded in this window.`
  const verdictBody = view.state === 'idle'
    ? `${view.metrics.tools} tool${view.metrics.tools === 1 ? '' : 's'} registered. The collector is active and idle.`
    : `${view.metrics.failures} failure${view.metrics.failures === 1 ? '' : 's'} observed across the current bounded window.`
  return React.createElement('section', { className: css.card, 'data-state': view.state }, [
    React.createElement('header', { className: css.header, key: 'header' }, [
      React.createElement('div', { className: css.identity, key: 'identity' }, [
        React.createElement('div', { key: 'copy' }, [
          React.createElement('h2', { className: css.identityTitle, key: 'title' }, 'Runtime Nutrition Label'),
          React.createElement('p', { className: css.identityMeta, key: 'meta' }, [
            React.createElement('span', { className: css.mono, key: 'scope' }, report.scope),
            ' · ', report.window.startedAt, ' — ', report.window.generatedAt,
          ]),
        ]),
      ]),
      React.createElement('div', { className: css.statusList, 'aria-label': 'Runtime states', key: 'status' }, statusPills),
    ]),
    React.createElement('div', { className: css.verdict, key: 'verdict' }, [
      React.createElement('strong', { key: 'title' }, verdictTitle),
      React.createElement('p', { key: 'body' }, verdictBody),
    ]),
    summaryStrip(view),
    React.createElement('div', { className: css.overview, key: 'overview' }, [
      capabilityTable(view),
      attributionCallout(view.attribution),
    ]),
    React.createElement('section', { className: css.debug, 'aria-label': 'Debug details', key: 'debug' }, [
      toolDirectory(view),
      callTrace(report, view),
    ]),
    React.createElement('footer', { className: css.footer, key: 'footer' }, [
      React.createElement('span', { key: 'evidence' }, [React.createElement('strong', { key: 'label' }, 'Evidence'), ' ', report.truncation.evidence ? 'capped; oldest records omitted' : 'complete for this window']),
      React.createElement('span', { key: 'revision' }, [React.createElement('strong', { key: 'label' }, 'Revision'), ' ', report.revision]),
      React.createElement('span', { key: 'retention' }, [React.createElement('strong', { key: 'label' }, 'Retention'), ' bounded']),
      React.createElement('span', { key: 'payloads' }, [React.createElement('strong', { key: 'label' }, 'Raw payloads'), ' never retained']),
    ]),
  ])
}

export const inject = ['slots']

/** Register the command-name keyed renderer in the Web conversation slot. */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('conversation.chat.commandview', () => ctx.slots.register({
    name: 'conversation.chat.commandview',
    key: 'nutrition-label',
  }, NutritionCommandCard))
}
