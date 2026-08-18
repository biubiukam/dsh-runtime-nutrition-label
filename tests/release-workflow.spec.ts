import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

interface WorkflowStep {
  readonly name?: string
  readonly run?: string
}

interface ReleaseWorkflow {
  readonly on?: {
    readonly push?: { readonly tags?: readonly string[] }
    readonly workflow_dispatch?: {
      readonly inputs?: {
        readonly release_tag?: { readonly required?: boolean }
      }
    }
  }
  readonly permissions?: {
    readonly contents?: string
    readonly 'id-token'?: string
  }
  readonly jobs?: {
    readonly publish?: { readonly steps?: readonly WorkflowStep[] }
  }
}

const root = fileURLToPath(new URL('../', import.meta.url))

describe('npm release workflow', () => {
  it('publishes only version-matched tags with the derived npm dist-tag', async () => {
    const workflow = parse(await readFile(`${root}/.github/workflows/release.yml`, 'utf8')) as ReleaseWorkflow
    const steps = workflow.jobs?.publish?.steps ?? []
    const versionStep = steps.find(step => step.name === 'Resolve and validate release version')
    const publishStep = steps.find(step => step.run?.startsWith('pnpm publish '))

    expect(workflow.on?.push?.tags).toEqual(['v*.*.*'])
    expect(workflow.on?.workflow_dispatch?.inputs?.release_tag?.required).toBe(true)
    expect(workflow.permissions).toMatchObject({ contents: 'read', 'id-token': 'write' })
    expect(versionStep?.run).toContain('package.json')
    expect(versionStep?.run).toContain('npm_tag=latest')
    expect(publishStep?.run).toContain('--tag "${{ steps.release.outputs.npm_tag }}"')
  })
})
