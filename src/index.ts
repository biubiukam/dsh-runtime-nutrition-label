/** DeepSeek Harness service collecting evidence-backed runtime plugin nutrition labels. */

import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import type { FsTarget } from '@deepseek-ai/dsh-fs'
import type { ToolExecution, ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import { ConfigSchema, resolveConfig } from './config.ts'
import { RuntimeNutritionCollector } from './collector.ts'
import type { Config, RuntimeNutritionSnapshot } from './types.ts'

export type * from './types.ts'
export { ConfigSchema as Config }

declare module '@deepseek-ai/cordis' {
  interface Context {
    runtimeNutritionLabels: RuntimeNutritionLabelService
  }
}

/** Runtime nutrition label service and Cordis plugin. */
export class RuntimeNutritionLabelService extends Service {
  static inject = ['tools']
  static Config = ConfigSchema

  private readonly collector: RuntimeNutritionCollector

  /**
   * Create the collector and subscribe to tool and optional filesystem events.
   * @param ctx - Cordis context carrying the DSH tool registry.
   * @param config - plugin attribution, privacy, and retention policy.
   */
  constructor(ctx: Context, config: Config = {}) {
    super(ctx, 'runtimeNutritionLabels')
    this.collector = new RuntimeNutritionCollector(resolveConfig(config))

    ctx.on('tools/pre-execute', async (exec, next) => {
      this.collector.begin(exec)
      return next()
    }, { prepend: true })
    ctx.on('tools/result', (exec: Readonly<ToolExecution>, result: Readonly<ToolExecutionResult>) => {
      this.collector.finish(exec as ToolExecution, result as ToolExecutionResult)
    })
    ctx.on('tools/change', () => this.syncSchemas())
    ctx.on('fs/write-intent', (target: FsTarget, actor: object | undefined, next) => {
      this.collector.noteWriteIntent(target, actor)
      return next()
    }, { prepend: true })
    ctx.on('fs/edit-intent', (target: FsTarget, actor: object | undefined, next) => {
      this.collector.noteWriteIntent(target, actor)
      return next()
    }, { prepend: true })
    ctx.on('fs/observed', (target: FsTarget, _observation, actor: object | undefined) => {
      this.collector.observeFile(target, actor)
    })
    this.syncSchemas()
  }

  /** Return an immutable JSON snapshot, optionally for one configured label. */
  snapshot(pluginId?: string): RuntimeNutritionSnapshot {
    return this.collector.snapshot(pluginId)
  }

  /** Clear collected observations while preserving configuration. */
  reset(pluginId?: string): void {
    this.collector.reset(pluginId)
    this.syncSchemas()
  }

  /** Resolve the configured owner for one public tool name. */
  ownerOfTool(toolName: string): string | undefined {
    return this.collector.ownerOfTool(toolName)
  }

  private syncSchemas(): void {
    try {
      this.collector.syncSchemas(this.ctx.tools.schemas())
    } catch (error: unknown) {
      this.ctx.logger.warn(
        'runtime-nutrition-label: tool schema snapshot failed: %s',
        error instanceof Error ? error.message : String(error),
      )
    }
  }
}

export default RuntimeNutritionLabelService
