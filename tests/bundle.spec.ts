import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

interface PackageManifest {
  readonly name?: string
  readonly repository?: { readonly url?: string }
  readonly exports?: Readonly<Record<string, unknown>>
  readonly files?: readonly string[]
  readonly scripts?: Readonly<Record<string, string>>
  readonly dsh?: {
    readonly bundle?: { readonly patch?: string }
  }
}

interface PatchEntry {
  readonly id?: string
  readonly name?: string
}

interface PatchOperation {
  readonly insert?: readonly PatchEntry[]
}

const root = fileURLToPath(new URL('../', import.meta.url))

describe('DSH bundle package', () => {
  it('publishes a discoverable bundle patch under the community package identity', async () => {
    const manifest = JSON.parse(await readFile(`${root}/package.json`, 'utf8')) as PackageManifest
    expect(manifest.name).toBe('dsh-runtime-nutrition-label')
    expect(manifest.repository?.url).toBe('git+https://github.com/biubiukam/dsh-runtime-nutrition-label.git')
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(manifest.exports?.['./cordis.patch.yml']).toBe('./cordis.patch.yml')
    expect(manifest.files).toContain('cordis.patch.yml')
    expect(manifest.scripts?.prepare).toBe('pnpm build')

    const parsed: unknown = parse(await readFile(`${root}/cordis.patch.yml`, 'utf8'))
    expect(Array.isArray(parsed)).toBe(true)
    if (!Array.isArray(parsed)) throw new Error('cordis.patch.yml must contain a patch array')
    const operations = parsed as readonly PatchOperation[]
    const rows = operations.flatMap(operation => operation.insert ?? [])
    expect(rows).toEqual([
      { id: 'runtime-nutrition-label', name: 'dsh-runtime-nutrition-label' },
      { id: 'runtime-nutrition-label-command', name: 'dsh-runtime-nutrition-label/command' },
    ])
  })
})
