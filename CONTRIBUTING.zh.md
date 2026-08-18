# 贡献指南

[English](CONTRIBUTING.md) | 中文

感谢你为 `dsh-runtime-nutrition-label` 做出贡献。

## 范围

除非明确与父级 `deepseek-harness` checkout 协调，否则请将改动限制在这个独立仓库内。不要将凭据、原始工具 payload、文件内容或带签名 URL 加入源码、fixture、snapshot、issue 或 pull request。

## 本地设置

```sh
corepack enable
CI=1 pnpm install --frozen-lockfile
CI=1 pnpm check
```

支持的 Node 版本列在 `.node-version` 和 `package.json` 中。仓库使用 pnpm、TypeScript、Vitest、tsdown、publint、Knip 以及带类型感知检查的 `oxlint`。

## 改动要求

- 为行为改动增加或更新测试。
- 公共契约变化时同时更新 `README.md` 和 `README.zh.md`。
- 设计变化时同时更新对应设计文档及中文版本。
- 保持 snapshot 有界并符合隐私策略。
- 保留可撤销的 Cordis effect，并在 waterfall 监听器中调用 `next()`。
- 为用户可见变化在 `CHANGELOG.md` 增加聚焦条目。

## Pull request

说明用户可见契约、失败行为、隐私影响、兼容性假设和实际运行的命令。改变运行时行为的 pull request 应包含证明组合插件路径的测试，而不只是纯函数测试。

## Commit 消息

使用简洁的祈使句主题，例如 `Add bounded domain evidence`。不要把无关格式化和依赖 churn 混入提交。

## 文档

英文和简体中文文档必须一起维护。编辑一对文档后运行：

```sh
pnpm run verify-translation-pairing --write README.md
```

父级 harness 文档规则仍是措辞、链接和配对文件的权威来源。
