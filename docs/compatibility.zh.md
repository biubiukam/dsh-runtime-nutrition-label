# 兼容性

[English](compatibility.md) | 中文

## 运行时

该包面向 Node `^22.19.0 || >=24.0.0`、ESM、TypeScript strict 模式和 pnpm 11。支持的包管理器记录在 `package.json` 中。

## DSH 版本

公共 API 面向本仓库使用的 DSH RC 工具、文件系统、命令和 invariant 事件契约。插件要求兼容的 `@deepseek-ai/cordis` 4.x runtime。

部署必须提供的 DSH 包名和版本范围记录在 `package.json` → `dsh.runtimePeers` 中。它们不是普通 peer dependencies，因为当前公开 RC 依赖图没有发布独立安装所需的全部传递类型包。

## 安装路径

npm 发布包包含构建后的 `lib/` 产物和根级 bundle patch，因此 `dsh plugin --profile <name> add dsh-runtime-nutrition-label` 无需安装时构建即可完成安装和激活。从 GitHub 源码安装时使用 `github:biubiukam/dsh-runtime-nutrition-label#<commit>`，并运行包的 `prepare` 构建；pnpm 10 及更高版本要求用户显式允许该构建。授予安装时执行权限前应固定 commit。

## 事件要求

服务消费 `tools/pre-execute`、`tools/result`、`tools/change`、`fs/write-intent`、`fs/edit-intent` 和 `fs/observed`。没有文件系统事件的部署仍可获得工具和 schema 指标；文件系统字段会保持为空。

## 兼容性限制

- 插件不会检查私有 Cordis fiber 内部来分配归属。
- 绕过 DSH 工具或文件系统事件的提供方无法被本包观察。
- DSH 发布版本改变事件 payload 字段时，需要匹配的兼容性更新和测试 fixture。
- 命令消费者要求存在 `ctx.commands` service；采集服务不要求它。

## 验证

在独立仓库中运行 `CI=1 pnpm check`。发布检查还应打包该包，通过 `dsh plugin` 将 tarball 安装到一次性 profile，确认 profile 在 `dsh.profile.bundles` 中列出 `dsh-runtime-nutrition-label`，并检查组合配置包含两个 bundle 行。
