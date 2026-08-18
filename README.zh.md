# dsh-runtime-nutrition-label

[English](README.md) | 中文

为 DeepSeek Harness 工具命名空间与插件身份提供基于证据的运行时营养标签。

这是由 [`biubiukam/dsh-runtime-nutrition-label`](https://github.com/biubiukam/dsh-runtime-nutrition-label) 发布的社区维护插件，不是 DeepSeek AI 官方包，也不代表官方背书。

## 提供的能力

该插件监听 DSH 工具与文件系统事件 seam，为每个已配置的插件身份发布有界 JSON 快照。标签会区分作者或部署者声明，以及当前进程窗口中观察到的事实。

- 声明能力：网络、凭据、子进程、持久化和预期域名。
- 观察到的工具指标：schema 字节数、调用次数、成功数、失败数、耗时统计、参数/结果字节总数和配置的副作用分类。
- 观察到的文件系统指标：读取、写入、唯一目标数和受隐私策略控制的路径样本。
- 观察到的网络目标：从 HTTP(S) URL 参数中提取的主机名，绝不保存完整 URL。
- 带有 `declared`、`observed` 和 `inferred` 来源的有界证据记录。

首个版本不会把这些字段压缩成单一总分。声明、运行时观察和部署策略具有不同的证据质量，必须保持可区分。

## 使用 DSH 安装

```sh
dsh plugin --profile web add dsh-runtime-nutrition-label
dsh --profile web
```

该包声明了 `dsh.bundle` patch，因此 `dsh plugin` 会将它安装到指定 profile、追加到 `dsh.profile.bundles`，并自动挂载 `ctx.runtimeNutritionLabels` 服务和 `/nutrition-label` 命令。在 profile 提供显式映射前，默认配置会把可见工具归入保留标签 `unattributed`。

对于不使用 DSH profile 的直接 Cordis 组合，可将包安装为普通依赖：

```sh
pnpm add dsh-runtime-nutrition-label
```

该包对 `@deepseek-ai/cordis` 声明普通 peer dependency。由于当前公开 DSH RC 依赖图没有发布独立安装所需的全部传递类型包，DSH runtime 包被列在包专用的 `dsh.runtimePeers` 元数据中。DSH 部署必须提供兼容的 `@deepseek-ai/dsh-tools`、`@deepseek-ai/dsh-fs`、`@deepseek-ai/dsh-commands` 和 `@deepseek-ai/dsh-invariants` 实现。公开依赖图完整后，可以将这些元数据恢复为普通 peer dependencies。

## 组合

包内的 [`cordis.patch.yml`](cordis.patch.yml) 会插入服务和命令行。归属关系是显式的：该插件不会从不透明的运行时对象推断 Cordis fiber 归属，因此 profile 需要在自己的 `cordis.patch.yml` 中覆盖 `runtime-nutrition-label` 行，配置精确工具名或前缀：

```yaml
- id: runtime-nutrition-label
  config:
    plugins:
      - id: mcp-github
        displayName: GitHub MCP
        tools:
          prefixes:
            - mcp__github__
        declared:
          network: true
          credentials: true
          domains:
            - api.github.com
        effects:
          - prefixes:
              - mcp__github__create_
              - mcp__github__merge_
            effect: write
```

Bundle 默认启用独立的人工命令消费者。如果 profile 只需要采集标签而不暴露 `/nutrition-label [plugin-id]`，可以只禁用该行：

```yaml
- id: runtime-nutrition-label-command
  disabled: true
```

完整 profile 覆盖示例见 [`examples/cordis.patch.yml`](examples/cordis.patch.yml)。

## 配置

`plugins[].tools` 至少需要一个精确名称或前缀。精确工具归属不能重复，前缀范围也不能重叠。未匹配工具会在 `includeUnattributed` 开启时归入保留标签 id `unattributed`。

`effects` 是限定在一个配置插件内的有序规则。精确名称优先于前缀；没有匹配规则的工具副作用为 `unknown`。该副作用是配置的分类，不是提供方实际执行操作的证明。

`evidenceLimit`、`fileSampleLimit`、`domainSampleLimit`、`argumentScanMaxDepth` 和 `argumentScanMaxNodes` 会在加载时校验为正数或非负安全整数。`pathDisplay` 接受 `omit`、`basename` 或 `full`；共享报告建议使用 `omit`。

## 快照契约

服务提供以下 API：

```ts
ctx.runtimeNutritionLabels.snapshot()
ctx.runtimeNutritionLabels.snapshot('mcp-github')
ctx.runtimeNutritionLabels.reset()
ctx.runtimeNutritionLabels.ownerOfTool('mcp__github__create_issue')
```

快照会深度冻结，并带有 `schemaVersion: 1`。其中包括 ISO 时间戳、进程内单调递增的 `revision`、配置声明、观察聚合结果和有界证据记录。服务绝不保存原始工具参数、原始工具结果、文件内容、凭据值或完整 URL。

## 证据语义

### Declared

`declared` 字段来自插件作者或部署配置。它们描述预期或可能的能力，即使当前进程尚未使用这些能力，也会保留。

### Observed

`observed` 字段来自 DSH 事件 payload 或可见工具 schema 注册表。只有写入或编辑意图之后又收到权威 `fs/observed` 事件，文件系统写入才会计入。

### Inferred

`inferred` 证据记录解释由显式配置推导出的分类，例如效果规则将某工具标记为 `write`。推断不会被呈现为提供方已经观察到的事实。

## 隐私模型

- 工具和结果只保留字节数，不保留 payload。
- URL 扫描只保留主机名，忽略 URL 路径、查询串、片段和凭据。
- 文件样本是可选的，可以完全省略；采集器不会读取文件内容。
- 每个标签的证据记录都有上限，定位是本地诊断资料，不是审计归档。
- 凭据声明只包含布尔值和预期引用元数据；秘密值永远不会进入快照。

## 模型体验

该包不会添加面向模型的工具或 prompt section。可选的 `/nutrition-label` 命令由人工命令消费者调度，不会改变模型历史。

### 人工命令报告

#### 模型看到的内容

没有，因为该命令面向人，并向命令适配器返回 Markdown。

#### Token 影响

直接 token 数为零。调用方可以选择将报告复制到对话中，但这不属于本包。

#### KV Cache 影响

不会直接发起模型请求，也不会使缓存失效。运行时观察独立于模型 prompt 组装继续进行。

## 已知限制与暂缓事项

- 工具归属依赖部署提供的精确名称和前缀；通用运行时事件不能证明 Cordis 插件归属。
- 通用 DSH 事件无法完整证明子进程创建、凭据解析、持久化或提供方内部网络活动。
- 网络证据只覆盖有界工具参数中发现的 HTTP(S) URL 字符串。
- 该包有意不发布单一安全或信任总分。
- 在公开 DSH RC 依赖图完整前，独立包使用 `dsh.runtimePeers`。
- 快照只存在于进程内；持久化 session 事件和长期存储不属于本包。

## 扩展点

采集器是纯状态 fold，可以脱离命令插件使用。部署可以添加其他渲染器、将快照导出到本地 telemetry sink，或在相同的 `tools/*` 与 `fs/*` 事件上附加策略决策，而无需改变 JSON 契约。

## 开发

```sh
CI=1 pnpm install --frozen-lockfile
CI=1 pnpm check
```

`pnpm check` 会运行 `oxlint`、TypeScript、覆盖率、构建和包 hygiene。贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)，实现模型见 [docs/architecture.md](docs/architecture.md)。

## 许可证

MIT，详见 [LICENSE](LICENSE)。
