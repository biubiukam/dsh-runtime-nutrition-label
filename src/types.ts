/** Public JSON contracts for runtime nutrition label configuration and snapshots. */

/** How strongly a configured or observed tool may mutate external state. */
export type SideEffectLevel = 'none' | 'read' | 'write' | 'destructive' | 'unknown'

/** Privacy policy for representative file paths in exported labels. */
export type PathDisplayMode = 'omit' | 'basename' | 'full'

/** Tool-name matcher used for plugin attribution and effect rules. */
export interface ToolMatcherConfig {
  /** Exact public tool names owned by the plugin. */
  readonly names?: string[]
  /** Public tool-name prefixes owned by the plugin. */
  readonly prefixes?: string[]
}

/** Author-declared capabilities that runtime events cannot prove reliably. */
export interface DeclaredCapabilitiesConfig {
  /** The plugin may contact remote network services. */
  readonly network?: boolean
  /** The plugin may resolve credential references or other secrets. */
  readonly credentials?: boolean
  /** The plugin may start operating-system subprocesses. */
  readonly subprocess?: boolean
  /** The plugin may persist data outside the canonical Session log. */
  readonly persistence?: boolean
  /** Expected remote hostnames, without schemes or paths. */
  readonly domains?: string[]
}

/** Per-tool side-effect classifier scoped to one configured plugin. */
export interface ToolEffectRuleConfig extends ToolMatcherConfig {
  /** Effect assigned to matching calls. */
  readonly effect: SideEffectLevel
}

/** One plugin or tool namespace represented by a runtime nutrition label. */
export interface PluginLabelConfig {
  /** Stable label id used by commands and JSON consumers. */
  readonly id: string
  /** Optional human-facing name. */
  readonly displayName?: string
  /** Exact names and prefixes attributed to this plugin. */
  readonly tools: ToolMatcherConfig
  /** Capabilities declared by the plugin author or deployer. */
  readonly declared?: DeclaredCapabilitiesConfig
  /** Ordered side-effect overrides; exact names win over prefixes. */
  readonly effects?: ToolEffectRuleConfig[]
}

/** Runtime collector configuration. */
export interface Config {
  /** Plugin identities and tool-namespace attribution rules. */
  readonly plugins?: PluginLabelConfig[]
  /** Collect unmatched tools under the reserved `unattributed` label. */
  readonly includeUnattributed?: boolean
  /** Maximum evidence records retained per label. */
  readonly evidenceLimit?: number
  /** Maximum single-call trace records retained per collector window. */
  readonly callSampleLimit?: number
  /** Maximum representative file paths retained per label. */
  readonly fileSampleLimit?: number
  /** Maximum representative domains retained per label. */
  readonly domainSampleLimit?: number
  /** File-path disclosure policy. */
  readonly pathDisplay?: PathDisplayMode
  /** Maximum nested object depth scanned for URL strings in tool arguments. */
  readonly argumentScanMaxDepth?: number
  /** Maximum array items and object properties scanned in one tool call. */
  readonly argumentScanMaxNodes?: number
}

/** Resolved capability declaration in a published label. */
export interface DeclaredCapabilities {
  readonly network: boolean
  readonly credentials: boolean
  readonly subprocess: boolean
  readonly persistence: boolean
  readonly domains: readonly string[]
}

/** Aggregated execution figures for one tool. */
export interface ToolRuntimeMetric {
  readonly name: string
  readonly schemaBytes: number
  readonly calls: number
  readonly timedCalls: number
  readonly successes: number
  readonly failures: number
  readonly averageDurationMs: number
  readonly p95DurationMs: number
  readonly argumentBytes: number
  readonly resultBytes: number
  readonly effect: SideEffectLevel
}

/** Aggregated observed filesystem activity. */
export interface FileAccessSummary {
  readonly observations: number
  readonly reads: number
  readonly writes: number
  readonly uniqueTargets: number
  readonly samples: readonly string[]
}

/** Aggregated observed network destinations extracted from URL arguments. */
export interface NetworkAccessSummary {
  readonly callsWithUrls: number
  readonly uniqueDomains: number
  readonly domains: readonly { readonly hostname: string; readonly calls: number }[]
}

/** Aggregated calls by side-effect classification. */
export interface SideEffectSummary {
  readonly none: number
  readonly read: number
  readonly write: number
  readonly destructive: number
  readonly unknown: number
}

/** Bounded evidence record supporting a label field. */
export interface RuntimeEvidence {
  readonly time: string
  readonly source: 'observed' | 'inferred'
  readonly category: 'tool' | 'filesystem' | 'network' | 'schema'
  readonly summary: string
}

/** Evidence-backed runtime nutrition label for one configured plugin identity. */
export interface RuntimeNutritionLabel {
  readonly id: string
  readonly displayName: string
  readonly window: {
    readonly startedAt: string
    readonly generatedAt: string
  }
  readonly declared: DeclaredCapabilities
  readonly observed: {
    readonly tools: readonly ToolRuntimeMetric[]
    readonly filesystem: FileAccessSummary
    readonly network: NetworkAccessSummary
    readonly sideEffects: SideEffectSummary
  }
  readonly evidence: readonly RuntimeEvidence[]
}

/** Complete immutable service snapshot. */
export interface RuntimeNutritionSnapshot {
  readonly schemaVersion: 1
  readonly revision: number
  readonly generatedAt: string
  readonly labels: readonly RuntimeNutritionLabel[]
}
