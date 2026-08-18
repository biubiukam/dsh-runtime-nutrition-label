import { describe, expect, it } from 'vitest'
import { effectOf, ownerOf, resolveConfig } from '../src/config.ts'

describe('resolveConfig', () => {
  it('resolves defaults and gives exact names precedence over prefixes', () => {
    const config = resolveConfig({
      plugins: [{
        id: 'github',
        tools: { prefixes: ['mcp__github__'], names: ['mcp__github__special'] },
        effects: [
          { prefixes: ['mcp__github__'], effect: 'read' },
          { names: ['mcp__github__special'], effect: 'write' },
        ],
      }],
    })

    expect(config.evidenceLimit).toBe(100)
    expect(config.pathDisplay).toBe('basename')
    expect(ownerOf(config, 'mcp__github__issues')).toBe('github')
    expect(effectOf(config, 'github', 'mcp__github__issues')).toBe('read')
    expect(effectOf(config, 'github', 'mcp__github__special')).toBe('write')
    expect(ownerOf(config, 'other_tool')).toBe('unattributed')
  })

  it.each([
    ['duplicate plugin id', { plugins: [
      { id: 'same', tools: { names: ['one'] } },
      { id: 'same', tools: { names: ['two'] } },
    ] }],
    ['duplicate exact tool', { plugins: [
      { id: 'one', tools: { names: ['same'] } },
      { id: 'two', tools: { names: ['same'] } },
    ] }],
    ['overlapping prefixes', { plugins: [
      { id: 'one', tools: { prefixes: ['mcp__'] } },
      { id: 'two', tools: { prefixes: ['mcp__github__'] } },
    ] }],
    ['reserved unattributed id', { plugins: [
      { id: 'unattributed', tools: { names: ['one'] } },
    ] }],
  ] as const)('rejects %s', (_name, value) => {
    expect(() => resolveConfig(value as never)).toThrow()
  })

  it('rejects blank matchers, invalid limits, and malformed domains', () => {
    expect(() => resolveConfig({ plugins: [{ id: 'x', tools: { names: [' '] } }] })).toThrow(/non-blank/)
    expect(() => resolveConfig({ evidenceLimit: 0 })).toThrow(/positive safe integer/)
    expect(() => resolveConfig({ fileSampleLimit: -1 })).toThrow(/non-negative safe integer/)
    expect(() => resolveConfig({ plugins: [{
      id: 'x',
      tools: { names: ['tool'] },
      declared: { domains: ['https://example.com/path'] },
    }] })).toThrow(/must be a hostname/)
    expect(() => resolveConfig({ plugins: [{ id: 'x', tools: {} }] })).toThrow(/at least one exact name or prefix/)
    expect(() => resolveConfig({ plugins: [{ id: 'x', tools: { names: ['tool', 'tool'] } }] })).toThrow(/duplicate/)
    expect(() => resolveConfig({ plugins: [{ id: 'x', tools: { names: ['tool'] }, effects: [
      { prefixes: ['write_', 'write_'], effect: 'write' },
    ] }] })).toThrow(/duplicate/)
  })

  it('can disable the unattributed fallback', () => {
    const config = resolveConfig({
      includeUnattributed: false,
      plugins: [{ id: 'known', tools: { names: ['known_tool'] } }],
    })
    expect(ownerOf(config, 'unknown_tool')).toBeUndefined()
    expect(effectOf(config, 'missing', 'unknown_tool')).toBe('unknown')
    expect(() => resolveConfig({ includeUnattributed: false })).toThrow(/configure at least one plugin/)
  })
})
