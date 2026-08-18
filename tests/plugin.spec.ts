import { Context } from '@deepseek-ai/cordis'
import type { ToolExecution, ToolExecutionResult, ToolSchema } from '@deepseek-ai/dsh-tools'
import { describe, expect, it } from 'vitest'
import { RuntimeNutritionLabelService } from '../src/index.ts'

const schema: ToolSchema = {
  name: 'mcp__github__list',
  description: 'List issues',
  parameters: { type: 'object' },
}

const exec: ToolExecution = {
  name: schema.name,
  arguments: { page: 1 },
  token: Symbol('tool-call'),
}

const success: ToolExecutionResult = {
  isError: false,
  content: [{ type: 'text', text: 'ok' }],
}

describe('RuntimeNutritionLabelService composition', () => {
  it('projects schemas from the command agent scope instead of the root scope', async () => {
    const ctx = new Context()
    const agent = { id: 'web-agent' }
    ctx.provide('tools', {
      schemas: (scope?: object) => scope === agent ? [schema] : [],
    })
    const fiber = ctx.plugin(RuntimeNutritionLabelService, {
      plugins: [{ id: 'github', tools: { prefixes: ['mcp__github__'] } }],
    })
    await fiber.await()

    const service = ctx.get('runtimeNutritionLabels')
    const label = service?.snapshotFor(agent, 'github').labels[0]
    expect(label?.observed.tools[0]).toMatchObject({ name: schema.name, schemaBytes: expect.any(Number) })

    const agentExec = { ...exec, agent }
    const admitted = await ctx.waterfall('tools/pre-execute', agentExec, async () => ({ kind: 'allow' }))
    expect(admitted).toEqual({ kind: 'allow' })
    ctx.emit('tools/result', agentExec, success)
    expect(service?.snapshotFor(agent, 'github').labels[0]?.observed.tools[0]?.calls).toBe(1)
    expect(service?.snapshot('github').labels[0]?.observed.tools[0]?.calls).toBe(1)

    service?.reset('github')
    expect(service?.snapshotFor(agent, 'github').labels[0]?.observed.tools[0]?.calls).toBe(0)
    service?.resetFor(agent, 'github')
    expect(service?.snapshotFor(agent, 'github').labels[0]?.observed.tools[0]?.calls).toBe(0)
    ctx.emit('agent/disposed', { agent })

    await Promise.resolve(fiber.dispose())
  })

  it('loads through Cordis, observes the real event pipeline, and unregisters on disposal', async () => {
    const ctx = new Context()
    let failSchemas = false
    const removeTools = ctx.provide('tools', { schemas: () => {
      if (failSchemas) throw new Error('schema service unavailable')
      return [schema]
    } })
    const fiber = ctx.plugin(RuntimeNutritionLabelService, {
      plugins: [{ id: 'github', tools: { prefixes: ['mcp__github__'] } }],
    })
    await fiber.await()

    const admitted = await ctx.waterfall('tools/pre-execute', exec, async () => ({ kind: 'allow' }))
    expect(admitted).toEqual({ kind: 'allow' })
    ctx.emit('tools/result', exec, success)
    const service = ctx.get('runtimeNutritionLabels')
    expect(service).toBeDefined()
    expect(service?.snapshot('github').labels[0]?.observed.tools[0]?.calls).toBe(1)
    expect(service?.ownerOfTool(schema.name)).toBe('github')

    const file = { displayPath: '/workspace/file.ts', targetKey: 'file.ts' }
    ctx.waterfall('fs/write-intent', file, exec, () => undefined)
    ctx.emit('fs/observed', file, { kind: 'present' }, exec)
    ctx.waterfall('fs/edit-intent', file, exec, () => undefined)
    ctx.emit('tools/change')
    service?.reset('github')
    expect(service?.snapshot('github').labels[0]?.observed.tools).toHaveLength(1)
    expect(service?.snapshot('github').labels[0]?.observed.tools[0]?.calls).toBe(0)

    failSchemas = true
    ctx.emit('tools/change')

    await Promise.resolve(fiber.dispose())
    expect(ctx.get('runtimeNutritionLabels')).toBeUndefined()
    removeTools()
  })
})
