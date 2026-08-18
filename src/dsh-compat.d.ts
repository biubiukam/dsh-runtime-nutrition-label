/**
 * Compile-time contract used by the standalone repository when the published
 * DSH RC packages are not available from npm. Consumers resolve these names
 * from the peer dependencies declared by package.json.
 */

declare module '@deepseek-ai/dsh-tools' {
  export interface ToolSchema {
    readonly name: string
    readonly description: string
    readonly parameters: unknown
  }

  export interface ToolExecution {
    readonly name: string
    readonly arguments: unknown
    readonly token: symbol
    readonly agent?: object
  }

  export interface ToolExecutionResult {
    readonly isError: boolean
    readonly value?: unknown
    readonly content?: unknown
  }
}

declare module '@deepseek-ai/dsh-fs' {
  export interface FsTarget {
    readonly targetKey: string
    readonly displayPath: string
  }
}

declare module '@deepseek-ai/dsh-invariants' {
  export interface InvariantInstaller {
    readonly inject?: readonly string[]
    (ctx: import('@deepseek-ai/cordis').Context, fail: (message: string) => never): void | Promise<void>
  }
}
