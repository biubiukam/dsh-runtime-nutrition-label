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

该包对 `@deepseek-ai/cordis` 声明普通 peer dependency。由于当前公开 DSH RC 依赖图没有发布独立安装所需的全部传递类型包，DSH runtime 包被列在包专用的 `dsh.runtimePeers` 元数据中。启用结构化 Web 报告路径时，DSH 部署还必须提供兼容的 `@deepseek-ai/dsh-tools`、`@deepseek-ai/dsh-fs`、`@deepseek-ai/dsh-commands`、`@deepseek-ai/dsh-invariants`、`@deepseek-ai/dsh-session` 和 `@deepseek-ai/dsh-session-projection` 实现。公开依赖图完整后，可以将这些元数据恢复为普通 peer dependencies。

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

`evidenceLimit`、`callSampleLimit`、`fileSampleLimit`、`domainSampleLimit`、`argumentScanMaxDepth` 和 `argumentScanMaxNodes` 会在加载时校验为正数或非负安全整数。`callSampleLimit` 限制当前窗口工具轨迹长度；`pathDisplay` 接受 `omit`、`basename` 或 `full`；共享报告建议使用 `omit`。

## 快照契约

服务提供以下 API：

```ts
ctx.runtimeNutritionLabels.snapshot()
ctx.runtimeNutritionLabels.snapshot('mcp-github')
ctx.runtimeNutritionLabels.snapshotFor(agent)
ctx.runtimeNutritionLabels.snapshotFor(agent, 'mcp-github')
ctx.runtimeNutritionLabels.reset()
ctx.runtimeNutritionLabels.ownerOfTool('mcp__github__create_issue')
```

按 agent 作用域生成的快照会使用 DSH 的真实 agent scope 查询 schema，并关联同一个 agent 的运行时事件。`/nutrition-label` 命令会自动使用接收命令的 agent，因此只挂载在 Web preset 中的工具会出现在该 agent 的报告中，而不会继续显示为空的 root 报告。

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

`/nutrition-label` 会为接收命令的 agent 返回摘要优先的报告。只支持文本的 adapter 会收到 Unicode 线框表格；Web 客户端可以通过 keyed command slot 将同一份 Host 报告渲染成真正的 HTML 表格。报告开头显示 scope、command id、snapshot revision、生成时间和每个标签的统计窗口。每个标签随后包含：

- 状态区，明确工具是否已加载、当前窗口是否观察到调用，以及是否配置了插件归属；
- 运行摘要，展示可见工具、schema 大小、调用、成功、失败、文件系统活动和观察到的网络域名；
- 能力表，将作者或部署声明与运行时观察分开。`No runtime evidence` 表示采集器没有观察到证据，不表示该能力绝对不可能存在；
- 工具目录，列出每个可见工具名称、schema 大小、调用次数、成功次数、失败次数和配置的副作用分类；
- 有界的当前窗口工具轨迹，列出 call id 元数据、耗时、参数/结果字节数、状态、副作用分类和安全的失败类别；
- 证据与调用轨迹是否达到上限的标记，使“已截断”和“当前窗口完整”可区分；
- 归属说明。未匹配工具会显示为 `Unattributed tools`，并明确说明工具已经加载，但仍等待 profile 配置归属。

命令会自动使用接收命令的 agent，因此报告的 scope 和工具目录与实际调用它的 agent 一致。底层 snapshot JSON 契约保持不变；如果 session API 可用，结构化报告会作为独立的 log-only 事件写入，并通过 `sourceEventSeq` 与命令结果关联。

Web renderer 会先呈现产品标签，再提供调试细节。默认打开时显示运行时身份、紧凑状态徽章、一句话结论，以及一条只包含工具、schema、调用和失败的摘要行；文件与域名活动降为次级信息。声明与观察能力矩阵、归属提示都采用扁平区块，不再堆叠指标卡片；工具目录和当前窗口调用轨迹通过渐进展开进入。当前窗口没有调用时，工具目录使用紧凑的 `Tool`、`Schema`、`Effect` 列，不再重复大量零值调用列。这次视觉调整不会改变 Host report、Unicode fallback、snapshot schema、有界证据或原始 payload 保留策略。

#### 模型看到的内容

没有。命令和报告事件都只面向人工调试，不会增加 prompt 内容。

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
- 聚合 snapshot 保持进程内；可选的报告事件是有界的 log-only 记录，不是长期审计归档。

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
