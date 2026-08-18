/** Runtime event fold for evidence-backed plugin nutrition labels. */

import { basename } from 'node:path'
import type { FsTarget } from '@deepseek-ai/dsh-fs'
import type { ToolExecution, ToolExecutionResult, ToolSchema } from '@deepseek-ai/dsh-tools'
import { effectOf, ownerOf } from './config.ts'
import type { ResolvedConfig, ResolvedPluginConfig } from './config.ts'
import { reportForSnapshot, type RuntimeCallTrace, type RuntimeNutritionReport } from './report.ts'
import type {
  DeclaredCapabilities,
  FileAccessSummary,
  NetworkAccessSummary,
  RuntimeEvidence,
  RuntimeNutritionLabel,
  RuntimeNutritionSnapshot,
  SideEffectLevel,
  ToolRuntimeMetric,
} from './types.ts'

interface ToolState {
  schemaBytes: number
  calls: number
  timedCalls: number
  successes: number
  failures: number
  durations: number[]
  argumentBytes: number
  resultBytes: number
  effect: SideEffectLevel
}

interface MutableSideEffectSummary {
  none: number
  read: number
  write: number
  destructive: number
  unknown: number
}

interface FileState {
  observations: number
  reads: number
  writes: number
  targets: Set<string>
  samples: Set<string>
}

interface LabelState {
  readonly id: string
  readonly displayName: string
  readonly declared: DeclaredCapabilities
  startedAt: number
  tools: Map<string, ToolState>
  files: FileState
  domains: Map<string, number>
  callsWithUrls: number
  sideEffects: MutableSideEffectSummary
  evidence: RuntimeEvidence[]
  evidenceTruncated: boolean
}

interface StartedCall {
  readonly ownerId: string
  readonly startedAt: number
  readonly ledgerIndex?: number
}

interface MutableCallTrace {
  ordinal: number
  readonly callId?: string
  readonly rootCallId?: string
  readonly name: string
  readonly ownerId: string
  readonly startedAt: string
  finishedAt?: string
  durationMs?: number
  status: RuntimeCallTrace['status']
  readonly argumentBytes: number
  resultBytes?: number
  readonly effect: SideEffectLevel
  failureCode?: 'tool-error'
}

interface PendingWrite {
  readonly targetKey: string
}

interface CollectorInternals {
  readonly now?: () => number
}

const encoder = new TextEncoder()

function jsonBytes(value: unknown): number {
  const json = JSON.stringify(value)
  return json === undefined ? 0 : encoder.encode(json).byteLength
}

function emptySideEffects(): MutableSideEffectSummary {
  return { none: 0, read: 0, write: 0, destructive: 0, unknown: 0 }
}

function emptyFiles(): FileState {
  return { observations: 0, reads: 0, writes: 0, targets: new Set(), samples: new Set() }
}

function emptyDeclared(): DeclaredCapabilities {
  return { network: false, credentials: false, subprocess: false, persistence: false, domains: [] }
}

function labelState(plugin: ResolvedPluginConfig | undefined, now: number): LabelState {
  return {
    id: plugin?.id ?? 'unattributed',
    displayName: plugin?.displayName ?? 'Unattributed tools',
    declared: plugin?.declared ?? emptyDeclared(),
    startedAt: now,
    tools: new Map(),
    files: emptyFiles(),
    domains: new Map(),
    callsWithUrls: 0,
    sideEffects: emptySideEffects(),
    evidence: [],
    evidenceTruncated: false,
  }
}

function percentile95(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1)
  return sorted[index] ?? 0
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function toolMetric(name: string, state: ToolState): ToolRuntimeMetric {
  return Object.freeze({
    name,
    schemaBytes: state.schemaBytes,
    calls: state.calls,
    timedCalls: state.timedCalls,
    successes: state.successes,
    failures: state.failures,
    averageDurationMs: Math.round(average(state.durations) * 100) / 100,
    p95DurationMs: percentile95(state.durations),
    argumentBytes: state.argumentBytes,
    resultBytes: state.resultBytes,
    effect: state.effect,
  })
}

function displayPath(target: FsTarget, mode: ResolvedConfig['pathDisplay']): string | undefined {
  if (mode === 'omit') return undefined
  if (mode === 'full') return target.displayPath
  try {
    const url = new URL(target.displayPath)
    return basename(url.pathname) || url.hostname
  } catch {
    return basename(target.displayPath)
  }
}

function freezeSnapshot<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) freezeSnapshot(child)
  return Object.freeze(value)
}

/** Collect runtime facts without retaining raw tool arguments, results, or file contents. */
export class RuntimeNutritionCollector {
  private readonly config: ResolvedConfig
  private readonly now: () => number
  private readonly labels = new Map<string, LabelState>()
  private readonly startedCalls = new Map<symbol, StartedCall>()
  private readonly discardedCalls = new Set<symbol>()
  private readonly callLedger: MutableCallTrace[] = []
  private callsTruncated = false
  private actorOwners = new WeakMap<object, string>()
  private pendingWrites = new WeakMap<object, PendingWrite[]>()
  private revision = 0

  constructor(config: ResolvedConfig, internals: CollectorInternals = {}) {
    this.config = config
    this.now = internals.now ?? Date.now
    this.reset()
  }

  /** Resolve the configured owner for one public tool name. */
  ownerOfTool(toolName: string): string | undefined {
    return ownerOf(this.config, toolName)
  }

  /** Record admission-time facts before another policy may deny the call. */
  begin(exec: ToolExecution): void {
    const ownerId = this.ownerOfTool(exec.name)
    if (ownerId === undefined) return
    const state = this.requireLabel(ownerId)
    const startedAt = this.now()
    const ledgerIndex = this.callLedger.length < this.config.callSampleLimit
      ? this.callLedger.push({
          ordinal: this.callLedger.length + 1,
          ...exec.callId === undefined ? {} : { callId: exec.callId },
          ...exec.rootCallId === undefined ? {} : { rootCallId: exec.rootCallId },
          name: exec.name,
          ownerId,
          startedAt: new Date(startedAt).toISOString(),
          status: 'started',
          argumentBytes: jsonBytes(exec.arguments),
          effect: effectOf(this.config, ownerId, exec.name),
        }) - 1
      : undefined
    if (ledgerIndex === undefined) this.callsTruncated = true
    this.startedCalls.set(exec.token, {
      ownerId,
      startedAt,
      ...ledgerIndex === undefined ? {} : { ledgerIndex },
    })
    this.actorOwners.set(exec, ownerId)
    const metric = this.requireTool(state, exec.name)
    metric.argumentBytes += jsonBytes(exec.arguments)
    const effect = effectOf(this.config, ownerId, exec.name)
    metric.effect = effect
    state.sideEffects[effect] += 1
    if (effect !== 'none' && effect !== 'unknown') {
      this.evidence(state, 'inferred', 'tool', `${exec.name} classified as ${effect}`)
    }
    const domains = this.scanDomains(exec.arguments)
    if (domains.size > 0) state.callsWithUrls += 1
    for (const hostname of domains) {
      state.domains.set(hostname, (state.domains.get(hostname) ?? 0) + 1)
      this.evidence(state, 'observed', 'network', `${exec.name} received URL for ${hostname}`)
    }
    this.revision += 1
  }

  /** Record the final frozen tool outcome and release call timing state. */
  finish(exec: ToolExecution, result: ToolExecutionResult): void {
    if (this.discardedCalls.delete(exec.token)) return
    const started = this.startedCalls.get(exec.token)
    const ownerId = started?.ownerId ?? this.ownerOfTool(exec.name)
    if (ownerId === undefined) return
    this.startedCalls.delete(exec.token)
    const finishedAt = this.now()
    const state = this.requireLabel(ownerId)
    const metric = this.requireTool(state, exec.name)
    metric.calls += 1
    metric.resultBytes += jsonBytes(result)
    if (result.isError) metric.failures += 1
    else metric.successes += 1
    if (started !== undefined) {
      metric.timedCalls += 1
      metric.durations.push(Math.max(0, finishedAt - started.startedAt))
    }
    if (started?.ledgerIndex !== undefined) {
      const trace = this.callLedger[started.ledgerIndex]
      if (trace !== undefined) {
        trace.finishedAt = new Date(finishedAt).toISOString()
        trace.durationMs = Math.max(0, finishedAt - started.startedAt)
        trace.status = result.isError ? 'failed' : 'success'
        trace.resultBytes = jsonBytes(result)
        if (result.isError) trace.failureCode = 'tool-error'
      }
    }
    this.evidence(state, 'observed', 'tool', `${exec.name} ${result.isError ? 'failed' : 'succeeded'}`)
    this.revision += 1
  }

  /** Mark a filesystem mutation intent; only a later observation counts it as a write. */
  noteWriteIntent(target: FsTarget, actor: object | undefined): void {
    if (actor === undefined || this.actorOwners.get(actor) === undefined) return
    const writes = this.pendingWrites.get(actor) ?? []
    writes.push({ targetKey: target.targetKey })
    this.pendingWrites.set(actor, writes)
  }

  /** Record an authoritative file observation against its attributed tool call. */
  observeFile(target: FsTarget, actor: object | undefined): void {
    if (actor === undefined) return
    const ownerId = this.actorOwners.get(actor)
    if (ownerId === undefined) return
    const state = this.requireLabel(ownerId)
    const writes = this.pendingWrites.get(actor) ?? []
    const writeIndex = writes.findIndex(candidate => candidate.targetKey === target.targetKey)
    const isWrite = writeIndex >= 0
    if (isWrite) writes.splice(writeIndex, 1)
    state.files.observations += 1
    if (isWrite) state.files.writes += 1
    else state.files.reads += 1
    state.files.targets.add(target.targetKey)
    const sample = displayPath(target, this.config.pathDisplay)
    if (sample !== undefined && state.files.samples.size < this.config.fileSampleLimit) {
      state.files.samples.add(sample)
    }
    this.evidence(state, 'observed', 'filesystem', `${isWrite ? 'wrote' : 'observed'} ${sample ?? 'a file target'}`)
    this.revision += 1
  }

  /** Replace schema byte figures from the complete visible tool registry snapshot. */
  syncSchemas(schemas: readonly ToolSchema[]): void {
    for (const state of this.labels.values()) {
      for (const tool of state.tools.values()) tool.schemaBytes = 0
    }
    for (const schema of schemas) {
      const ownerId = this.ownerOfTool(schema.name)
      if (ownerId === undefined) continue
      const state = this.requireLabel(ownerId)
      const metric = this.requireTool(state, schema.name)
      metric.schemaBytes = jsonBytes(schema)
      this.evidence(state, 'observed', 'schema', `${schema.name} schema is ${metric.schemaBytes} bytes`)
    }
    this.revision += 1
  }

  /** Return an immutable JSON snapshot, optionally restricted to one label id. */
  snapshot(pluginId?: string): RuntimeNutritionSnapshot {
    if (pluginId !== undefined && !this.labels.has(pluginId)) {
      throw new RangeError(`runtime-nutrition-label: unknown label ${JSON.stringify(pluginId)}`)
    }
    const generatedAtMs = this.now()
    const labels = [...this.labels.values()]
      .filter(state => pluginId === undefined || state.id === pluginId)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(state => this.publishLabel(state, generatedAtMs))
    return freezeSnapshot({
      schemaVersion: 1 as const,
      revision: this.revision,
      generatedAt: new Date(generatedAtMs).toISOString(),
      labels,
    })
  }

  /** Clear runtime observations while preserving configured declarations and attribution. */
  reset(pluginId?: string): void {
    const now = this.now()
    if (pluginId !== undefined && !this.labels.has(pluginId)) {
      throw new RangeError(`runtime-nutrition-label: unknown label ${JSON.stringify(pluginId)}`)
    }
    const selected = pluginId === undefined
      ? [...this.config.plugins.map(plugin => plugin.id), ...this.config.includeUnattributed ? ['unattributed'] : []]
      : [pluginId]
    if (pluginId === undefined) {
      this.labels.clear()
      for (const token of this.startedCalls.keys()) this.discardedCalls.add(token)
      this.startedCalls.clear()
      this.actorOwners = new WeakMap<object, string>()
      this.pendingWrites = new WeakMap<object, PendingWrite[]>()
      this.callLedger.length = 0
      this.callsTruncated = false
    } else {
      for (const [token, started] of this.startedCalls) {
        if (started.ownerId === pluginId) {
          this.discardedCalls.add(token)
          this.startedCalls.delete(token)
        }
      }
      const resetAt = new Date(now).toISOString()
      for (const trace of this.callLedger) {
        if (trace.ownerId === pluginId && trace.status === 'started') {
          trace.status = 'discarded'
          trace.finishedAt = resetAt
        }
      }
    }
    for (const id of selected) {
      const plugin = this.config.plugins.find(candidate => candidate.id === id)
      this.labels.set(id, labelState(plugin, now))
    }
    this.revision += 1
  }

  private requireLabel(ownerId: string): LabelState {
    const state = this.labels.get(ownerId)
    if (state === undefined) {
      throw new Error(`runtime-nutrition-label: attributed owner ${JSON.stringify(ownerId)} has no label state`)
    }
    return state
  }

  private requireTool(state: LabelState, name: string): ToolState {
    let metric = state.tools.get(name)
    if (metric === undefined) {
      metric = {
        schemaBytes: 0,
        calls: 0,
        timedCalls: 0,
        successes: 0,
        failures: 0,
        durations: [],
        argumentBytes: 0,
        resultBytes: 0,
        effect: effectOf(this.config, state.id, name),
      }
      state.tools.set(name, metric)
    }
    return metric
  }

  private evidence(
    state: LabelState,
    source: RuntimeEvidence['source'],
    category: RuntimeEvidence['category'],
    summary: string,
  ): void {
    state.evidence.push({ time: new Date(this.now()).toISOString(), source, category, summary })
    if (state.evidence.length > this.config.evidenceLimit) {
      state.evidence.shift()
      state.evidenceTruncated = true
    }
  }

  /** Build a bounded structured report for a command-linked presentation. */
  report(pluginId: string | undefined, commandId: string, scope: string): RuntimeNutritionReport {
    const snapshot = this.snapshot(pluginId)
    const ownerIds = new Set(snapshot.labels.map(label => label.id))
    const calls = this.callLedger
      .filter(trace => ownerIds.has(trace.ownerId) && trace.status !== 'discarded')
      .map(trace => Object.freeze({ ...trace }))
    const evidenceTruncated = snapshot.labels.some(label => this.labels.get(label.id)?.evidenceTruncated === true)
    return reportForSnapshot(snapshot, commandId, scope, calls, this.callsTruncated, evidenceTruncated)
  }

  private scanDomains(value: unknown): Set<string> {
    const domains = new Set<string>()
    const seen = new Set<object>()
    let nodes = 0
    const visit = (candidate: unknown, depth: number): void => {
      if (depth > this.config.argumentScanMaxDepth || nodes >= this.config.argumentScanMaxNodes) return
      nodes += 1
      if (typeof candidate === 'string') {
        try {
          const url = new URL(candidate)
          if (url.protocol === 'http:' || url.protocol === 'https:') domains.add(url.hostname)
        } catch {
          return
        }
        return
      }
      if (typeof candidate !== 'object' || candidate === null || seen.has(candidate)) return
      seen.add(candidate)
      const children = Array.isArray(candidate) ? candidate : Object.values(candidate)
      for (const child of children) {
        visit(child, depth + 1)
        if (nodes >= this.config.argumentScanMaxNodes) break
      }
    }
    visit(value, 0)
    return domains
  }

  private publishLabel(state: LabelState, generatedAt: number): RuntimeNutritionLabel {
    const tools = [...state.tools.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, metric]) => toolMetric(name, metric))
    const files: FileAccessSummary = {
      observations: state.files.observations,
      reads: state.files.reads,
      writes: state.files.writes,
      uniqueTargets: state.files.targets.size,
      samples: [...state.files.samples].sort(),
    }
    const domains: NetworkAccessSummary['domains'] = [...state.domains.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, this.config.domainSampleLimit)
      .map(([hostname, calls]) => ({ hostname, calls }))
    const network: NetworkAccessSummary = {
      callsWithUrls: state.callsWithUrls,
      uniqueDomains: state.domains.size,
      domains,
    }
    return {
      id: state.id,
      displayName: state.displayName,
      window: {
        startedAt: new Date(state.startedAt).toISOString(),
        generatedAt: new Date(generatedAt).toISOString(),
      },
      declared: state.declared,
      observed: {
        tools,
        filesystem: files,
        network,
        sideEffects: { ...state.sideEffects },
      },
      evidence: [...state.evidence],
    }
  }
}
