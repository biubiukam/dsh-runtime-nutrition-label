/** Configuration normalization and unambiguous tool attribution. */

import z from '@deepseek-ai/schemastery'
import type {
  Config,
  DeclaredCapabilities,
  PathDisplayMode,
  PluginLabelConfig,
  SideEffectLevel,
  ToolEffectRuleConfig,
  ToolMatcherConfig,
} from './types.ts'

const DEFAULT_EVIDENCE_LIMIT = 100
const DEFAULT_FILE_SAMPLE_LIMIT = 20
const DEFAULT_DOMAIN_SAMPLE_LIMIT = 20
const DEFAULT_ARGUMENT_SCAN_MAX_DEPTH = 8
const DEFAULT_ARGUMENT_SCAN_MAX_NODES = 1_000

const matcherSchema = z.object({
  names: z.array(z.string()).default([]),
  prefixes: z.array(z.string()).default([]),
})

const declaredSchema = z.object({
  network: z.boolean().default(false),
  credentials: z.boolean().default(false),
  subprocess: z.boolean().default(false),
  persistence: z.boolean().default(false),
  domains: z.array(z.string()).default([]),
})

const effectSchema = z.object({
  names: z.array(z.string()).default([]),
  prefixes: z.array(z.string()).default([]),
  effect: z.union(['none', 'read', 'write', 'destructive', 'unknown'] as const).required(),
})

const pluginSchema = z.object({
  id: z.string().required(),
  displayName: z.string(),
  tools: matcherSchema.required(),
  declared: declaredSchema,
  effects: z.array(effectSchema).default([]),
})

/** Loader schema for the main service plugin. */
export const ConfigSchema: z<Config> = z.object({
  plugins: z.array(pluginSchema).default([]),
  includeUnattributed: z.boolean().default(true),
  evidenceLimit: z.number().step(1).min(1).default(DEFAULT_EVIDENCE_LIMIT),
  fileSampleLimit: z.number().step(1).min(0).default(DEFAULT_FILE_SAMPLE_LIMIT),
  domainSampleLimit: z.number().step(1).min(0).default(DEFAULT_DOMAIN_SAMPLE_LIMIT),
  pathDisplay: z.union(['omit', 'basename', 'full'] as const).default('basename'),
  argumentScanMaxDepth: z.number().step(1).min(1).default(DEFAULT_ARGUMENT_SCAN_MAX_DEPTH),
  argumentScanMaxNodes: z.number().step(1).min(1).default(DEFAULT_ARGUMENT_SCAN_MAX_NODES),
})

export interface ResolvedPluginConfig {
  readonly id: string
  readonly displayName: string
  readonly tools: ResolvedMatcher
  readonly declared: DeclaredCapabilities
  readonly effects: readonly ResolvedEffectRule[]
}

export interface ResolvedConfig {
  readonly plugins: readonly ResolvedPluginConfig[]
  readonly includeUnattributed: boolean
  readonly evidenceLimit: number
  readonly fileSampleLimit: number
  readonly domainSampleLimit: number
  readonly pathDisplay: PathDisplayMode
  readonly argumentScanMaxDepth: number
  readonly argumentScanMaxNodes: number
}

interface ResolvedMatcher {
  readonly names: ReadonlySet<string>
  readonly prefixes: readonly string[]
}

interface ResolvedEffectRule {
  readonly matcher: ResolvedMatcher
  readonly effect: SideEffectLevel
}

function assertNonBlank(field: string, value: string): void {
  if (value.length === 0 || value.trim() !== value) {
    throw new Error(`runtime-nutrition-label: ${field} must be non-blank and have no surrounding whitespace`)
  }
}

function uniqueStrings(field: string, values: readonly string[]): readonly string[] {
  const seen = new Set<string>()
  for (const value of values) {
    assertNonBlank(field, value)
    if (seen.has(value)) {
      throw new Error(`runtime-nutrition-label: ${field} contains duplicate ${JSON.stringify(value)}`)
    }
    seen.add(value)
  }
  return [...seen]
}

function matcher(field: string, value: ToolMatcherConfig): ResolvedMatcher {
  const names = uniqueStrings(`${field}.names`, value.names ?? [])
  const prefixes = uniqueStrings(`${field}.prefixes`, value.prefixes ?? [])
  if (names.length === 0 && prefixes.length === 0) {
    throw new Error(`runtime-nutrition-label: ${field} must contain at least one exact name or prefix`)
  }
  return { names: new Set(names), prefixes: [...prefixes].sort((left, right) => right.length - left.length) }
}

function declared(value: PluginLabelConfig['declared']): DeclaredCapabilities {
  const domains = uniqueStrings('declared.domains', value?.domains ?? [])
  for (const hostname of domains) {
    if (hostname.includes('://') || hostname.includes('/') || hostname.includes('@')) {
      throw new Error(`runtime-nutrition-label: declared domain ${JSON.stringify(hostname)} must be a hostname without scheme, path, or credentials`)
    }
  }
  return Object.freeze({
    network: value?.network ?? false,
    credentials: value?.credentials ?? false,
    subprocess: value?.subprocess ?? false,
    persistence: value?.persistence ?? false,
    domains: Object.freeze([...domains].sort()),
  })
}

function effects(pluginId: string, values: readonly ToolEffectRuleConfig[]): readonly ResolvedEffectRule[] {
  return values.map((value, index) => ({
    matcher: matcher(`plugins[${JSON.stringify(pluginId)}].effects[${index}]`, value),
    effect: value.effect,
  }))
}

function positiveInteger(field: string, value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`runtime-nutrition-label: ${field} must be a positive safe integer`)
  }
  return value
}

function nonNegativeInteger(field: string, value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`runtime-nutrition-label: ${field} must be a non-negative safe integer`)
  }
  return value
}

/** Validate programmatic construction and resolve every default once at load. */
export function resolveConfig(config: Config = {}): ResolvedConfig {
  const plugins: ResolvedPluginConfig[] = []
  const ids = new Set<string>()
  const exactOwners = new Map<string, string>()
  const prefixes: { prefix: string; owner: string }[] = []

  for (const [index, value] of (config.plugins ?? []).entries()) {
    assertNonBlank(`plugins[${index}].id`, value.id)
    if (value.id === 'unattributed') {
      throw new Error('runtime-nutrition-label: plugin id "unattributed" is reserved')
    }
    if (ids.has(value.id)) {
      throw new Error(`runtime-nutrition-label: duplicate plugin id ${JSON.stringify(value.id)}`)
    }
    ids.add(value.id)
    const tools = matcher(`plugins[${index}].tools`, value.tools)
    for (const name of tools.names) {
      const prior = exactOwners.get(name)
      if (prior !== undefined) {
        throw new Error(`runtime-nutrition-label: tool ${JSON.stringify(name)} is owned by both ${JSON.stringify(prior)} and ${JSON.stringify(value.id)}`)
      }
      exactOwners.set(name, value.id)
    }
    for (const prefix of tools.prefixes) {
      for (const prior of prefixes) {
        if (prefix.startsWith(prior.prefix) || prior.prefix.startsWith(prefix)) {
          throw new Error(`runtime-nutrition-label: prefixes ${JSON.stringify(prior.prefix)} (${prior.owner}) and ${JSON.stringify(prefix)} (${value.id}) overlap`)
        }
      }
      prefixes.push({ prefix, owner: value.id })
    }
    plugins.push({
      id: value.id,
      displayName: value.displayName?.trim() || value.id,
      tools,
      declared: declared(value.declared),
      effects: effects(value.id, value.effects ?? []),
    })
  }

  const includeUnattributed = config.includeUnattributed ?? true
  if (plugins.length === 0 && !includeUnattributed) {
    throw new Error('runtime-nutrition-label: configure at least one plugin or enable includeUnattributed')
  }

  return {
    plugins,
    includeUnattributed,
    evidenceLimit: positiveInteger('evidenceLimit', config.evidenceLimit ?? DEFAULT_EVIDENCE_LIMIT),
    fileSampleLimit: nonNegativeInteger('fileSampleLimit', config.fileSampleLimit ?? DEFAULT_FILE_SAMPLE_LIMIT),
    domainSampleLimit: nonNegativeInteger('domainSampleLimit', config.domainSampleLimit ?? DEFAULT_DOMAIN_SAMPLE_LIMIT),
    pathDisplay: config.pathDisplay ?? 'basename',
    argumentScanMaxDepth: positiveInteger('argumentScanMaxDepth', config.argumentScanMaxDepth ?? DEFAULT_ARGUMENT_SCAN_MAX_DEPTH),
    argumentScanMaxNodes: positiveInteger('argumentScanMaxNodes', config.argumentScanMaxNodes ?? DEFAULT_ARGUMENT_SCAN_MAX_NODES),
  }
}

function matches(value: string, candidate: ResolvedMatcher): boolean {
  return candidate.names.has(value) || candidate.prefixes.some(prefix => value.startsWith(prefix))
}

/** Resolve a tool to one configured plugin id, or the reserved fallback. */
export function ownerOf(config: ResolvedConfig, toolName: string): string | undefined {
  for (const plugin of config.plugins) {
    if (plugin.tools.names.has(toolName)) return plugin.id
  }
  for (const plugin of config.plugins) {
    if (plugin.tools.prefixes.some(prefix => toolName.startsWith(prefix))) return plugin.id
  }
  return config.includeUnattributed ? 'unattributed' : undefined
}

/** Resolve the configured side-effect classification for one attributed tool. */
export function effectOf(config: ResolvedConfig, ownerId: string, toolName: string): SideEffectLevel {
  const plugin = config.plugins.find(candidate => candidate.id === ownerId)
  if (plugin === undefined) return 'unknown'
  for (const rule of plugin.effects) {
    if (rule.matcher.names.has(toolName)) return rule.effect
  }
  for (const rule of plugin.effects) {
    if (matches(toolName, rule.matcher)) return rule.effect
  }
  return 'unknown'
}
