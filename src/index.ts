/** DeepSeek Harness service collecting evidence-backed runtime plugin nutrition labels. */

import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import type { FsTarget } from '@deepseek-ai/dsh-fs'
import type { ToolExecution, ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import { ConfigSchema, resolveConfig } from './config.ts'
import type { ResolvedConfig } from './config.ts'
import { RuntimeNutritionCollector } from './collector.ts'
import { applyRuntimeNutritionProjection, type RuntimeNutritionReport } from './report.ts'
import type { Config, RuntimeNutritionSnapshot } from './types.ts'

export type * from './types.ts'
export type { RuntimeCallTrace, RuntimeNutritionProjection, RuntimeNutritionReport } from './report.ts'
export { ConfigSchema as Config }

declare module '@deepseek-ai/cordis' {
  interface Context {
    runtimeNutritionLabels: RuntimeNutritionLabelService
  }
}

/** Public type augmentations consumed by the Host projection driver and Web client. */
declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'runtime-nutrition-label/report': {
      readonly commandId: string
      readonly report: import('./report.ts').RuntimeNutritionReport
    }
  }
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    runtimeNutritionLabel: import('./report.ts').RuntimeNutritionProjection
  }
}

/** Runtime nutrition label service and Cordis plugin. */
export class RuntimeNutritionLabelService extends Service {
  static inject = ['tools']
  static Config = ConfigSchema

  private readonly config: ResolvedConfig
  private readonly collector: RuntimeNutritionCollector
  private readonly agentCollectors = new Map<object, RuntimeNutritionCollector>()
  private readonly actorCollectors = new WeakMap<object, RuntimeNutritionCollector>()

  /**
   * Create the collector and subscribe to tool and optional filesystem events.
   * @param ctx - Cordis context carrying the DSH tool registry.
   * @param config - plugin attribution, privacy, and retention policy.
   */
  constructor(ctx: Context, config: Config = {}) {
    super(ctx, 'runtimeNutritionLabels')
    this.config = resolveConfig(config)
    this.collector = new RuntimeNutritionCollector(this.config)

    ctx.inject(['sessionProjections'], (projectionCtx) => {
      const projections = projectionCtx.sessionProjections
      if (projections === undefined) return
      projections.register({
        key: 'runtimeNutritionLabel',
        schema: {
          parse(value: unknown) {
            return value as import('./report.ts').RuntimeNutritionProjection
          },
        },
        init: () => ({ reports: [] }),
        apply: (state, event) => applyRuntimeNutritionProjection(state, event),
        view: state => state,
        stateVersion: 1,
      })
    })

    ctx.on('tools/pre-execute', async (exec, next) => {
      this.collector.begin(exec)
      if (exec.agent !== undefined) {
        const collector = this.collectorFor(exec.agent)
        this.actorCollectors.set(exec, collector)
        collector.begin(exec)
      }
      return next()
    }, { prepend: true })
    ctx.on('tools/result', (exec: Readonly<ToolExecution>, result: Readonly<ToolExecutionResult>) => {
      this.collector.finish(exec as ToolExecution, result as ToolExecutionResult)
      if (exec.agent !== undefined) {
        this.collectorFor(exec.agent).finish(exec as ToolExecution, result as ToolExecutionResult)
      }
    })
    ctx.on('tools/change', () => this.syncSchemas())
    ctx.on('agent/disposed', ({ agent }) => {
      this.agentCollectors.delete(agent)
    })
    ctx.on('fs/write-intent', (target: FsTarget, actor: object | undefined, next) => {
      this.collector.noteWriteIntent(target, actor)
      if (actor !== undefined) this.actorCollectors.get(actor)?.noteWriteIntent(target, actor)
      return next()
    }, { prepend: true })
    ctx.on('fs/edit-intent', (target: FsTarget, actor: object | undefined, next) => {
      this.collector.noteWriteIntent(target, actor)
      if (actor !== undefined) this.actorCollectors.get(actor)?.noteWriteIntent(target, actor)
      return next()
    }, { prepend: true })
    ctx.on('fs/observed', (target: FsTarget, _observation, actor: object | undefined) => {
      this.collector.observeFile(target, actor)
      if (actor !== undefined) this.actorCollectors.get(actor)?.observeFile(target, actor)
    })
    this.syncSchemas()
  }

  /** Return an immutable JSON snapshot, optionally for one configured label. */
  snapshot(pluginId?: string): RuntimeNutritionSnapshot {
    return this.collector.snapshot(pluginId)
  }

  /** Return an immutable snapshot for one agent's visible tool registry. */
  snapshotFor(agent: object, pluginId?: string): RuntimeNutritionSnapshot {
    return this.collectorFor(agent).snapshot(pluginId)
  }

  /** Return the bounded structured report used by command adapters and projections. */
  reportFor(agent: object, commandId: string, scope: string, pluginId?: string): RuntimeNutritionReport {
    return this.collectorFor(agent).report(pluginId, commandId, scope)
  }

  /** Clear collected observations while preserving configuration. */
  reset(pluginId?: string): void {
    this.collector.reset(pluginId)
    for (const [agent, collector] of this.agentCollectors) {
      collector.reset(pluginId)
      this.syncSchemasFor(agent, collector)
    }
    this.syncSchemas()
  }

  /** Clear observations for one agent while preserving its configuration. */
  resetFor(agent: object, pluginId?: string): void {
    const collector = this.collectorFor(agent)
    collector.reset(pluginId)
    this.syncSchemasFor(agent, collector)
  }

  /** Resolve the configured owner for one public tool name. */
  ownerOfTool(toolName: string): string | undefined {
    return this.collector.ownerOfTool(toolName)
  }

  private syncSchemas(): void {
    this.syncSchemasFor(undefined, this.collector)
    for (const [agent, collector] of this.agentCollectors) this.syncSchemasFor(agent, collector)
  }

  private syncSchemasFor(agent: object | undefined, collector: RuntimeNutritionCollector): void {
    try {
      collector.syncSchemas(this.ctx.tools.schemas(agent))
    } catch (error: unknown) {
      this.ctx.logger.warn(
        'runtime-nutrition-label: tool schema snapshot failed: %s',
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  private collectorFor(agent: object | undefined): RuntimeNutritionCollector {
    if (agent === undefined) return this.collector
    const existing = this.agentCollectors.get(agent)
    if (existing !== undefined) return existing
    const collector = new RuntimeNutritionCollector(this.config)
    this.agentCollectors.set(agent, collector)
    this.syncSchemasFor(agent, collector)
    return collector
  }
}

export default RuntimeNutritionLabelService
