# 更新日志

[English](CHANGELOG.md) | 中文

## 未发布

- `/nutrition-label` 使用接收命令的 DSH agent 作用域读取 schema 和运行时观察，同时保留 root snapshot API。
- 在 npm 发布前校验 tag 与包版本，并将预发布版本路由到对应的 npm dist-tag。

## [0.1.0] - 2026-08-18

### 新增

- 为配置的 DSH 工具命名空间提供基于证据的运行时标签。
- 提供有界的工具、文件系统、网络、副作用和证据指标。
- 提供可选的 `/nutrition-label [plugin-id]` 人工命令。
- 提供 DSH bundle 元数据和根级 patch，使 `dsh plugin add` 安装后自动激活服务与命令。
- 使用 `biubiukam/dsh-runtime-nutrition-label` 社区仓库和非 scope npm 包名 `dsh-runtime-nutrition-label`。
- 提供独立的 TypeScript、Vitest、tsdown、publint、Knip 和 `oxlint` 工作流。
