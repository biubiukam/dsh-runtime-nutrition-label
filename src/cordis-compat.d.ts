export {}

declare module '@deepseek-ai/cordis' {
  interface Context {
    readonly tools: {
      schemas(scope?: object): import('@deepseek-ai/dsh-tools').ToolSchema[]
    }
    readonly commands: {
      register(definition: {
        readonly name: string
        readonly description: string
        readonly input?: { readonly hint: string }
        readonly handler: (invocation: {
          readonly agent: object
          readonly rawInput: string
        }) => unknown
      }): () => void
    }
    readonly invariants: {
      register(packageName: string, installer: import('@deepseek-ai/dsh-invariants').InvariantInstaller): () => void
    }
  }

  interface Events {
    'tools/pre-execute'(
      exec: import('@deepseek-ai/dsh-tools').ToolExecution,
      next: () => Promise<{ readonly kind: string }>,
    ): Promise<{ readonly kind: string }>
    'tools/result'(
      exec: Readonly<import('@deepseek-ai/dsh-tools').ToolExecution>,
      result: Readonly<import('@deepseek-ai/dsh-tools').ToolExecutionResult>,
    ): undefined
    'tools/change'(): void
    'agent/disposed'(payload: { readonly agent: object }): void
    'fs/write-intent'(
      target: import('@deepseek-ai/dsh-fs').FsTarget,
      actor: object | undefined,
      next: () => unknown,
    ): unknown
    'fs/edit-intent'(
      target: import('@deepseek-ai/dsh-fs').FsTarget,
      actor: object | undefined,
      next: () => unknown,
    ): unknown
    'fs/observed'(
      target: import('@deepseek-ai/dsh-fs').FsTarget,
      observation: unknown,
      actor: object | undefined,
    ): void
  }
}
