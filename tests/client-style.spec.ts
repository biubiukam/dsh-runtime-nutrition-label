import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('../src/client/index.module.css', import.meta.url), 'utf8')

describe('runtime nutrition client tool grid styles', () => {
  it('resets disclosure summary spacing so rows align with the header grid', () => {
    expect(styles).toMatch(/\.toolDisclosure > summary \{[\s\S]*?gap: 0;/u)
    expect(styles).toMatch(/\.toolDisclosure > summary \{[\s\S]*?min-height: 0;/u)
  })
})
