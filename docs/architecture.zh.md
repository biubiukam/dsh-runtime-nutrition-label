# 技术架构

[English](architecture.md) | 中文

## 位置

Runtime Nutrition Label 是一个 out-of-tree Cordis service plugin。它消费 DSH 工具注册表和事件流，但不修改 Agent Loop、工具实现、文件系统提供方或 session 持久化。

npm 包同时也是 DSH bundle。`package.json` 声明 `dsh.bundle.patch`，发布的根级 `cordis.patch.yml` 会插入服务与命令行。因此，官方 CLI 在 `dsh plugin add` 成功后会把该包记录到 profile 的有序 bundle 列表中；后续 profile 和 home patch 层可以替换服务配置或禁用命令行。

## 组件

- `RuntimeNutritionLabelService` 注册 `ctx.runtimeNutritionLabels`，订阅生命周期事件，并暴露公共 snapshot API。
- `RuntimeNutritionCollector` 持有可变状态，并发布深度冻结的 snapshot。
- `config.ts` 在加载时校验声明、归属范围、副作用规则和保留上限。
- `command.ts` 是可选的人工命令消费者，不增加模型可见上下文。
- `invariant.ts` 注册包自有 invariant companion。聚合一致性由采集器负责；事件 payload 有效性仍由 DSH 生产方负责。
- `cordis.patch.yml` 是 profile bundle 层，从已安装 npm 包挂载服务和命令。

## 事件流

1. `tools/pre-execute` 在下游策略运行前记录配置归属、参数字节数、效果分类、URL 主机名和开始时间。
2. `tools/result` 记录成功或失败、结果字节数和耗时。
3. `tools/change` 从完整的可见工具注册表刷新 schema 字节数。agent 所有的采集器通过 `ctx.tools.schemas(agent)` 查询；root 采集器查询 root 注册表。
4. `fs/write-intent` 与 `fs/edit-intent` 将目标与当前工具 actor 关联。
5. `fs/observed` 提交读取或写入观察。只有同一目标之前存在意图时，观察才会计为写入。
6. `snapshot()` 将 root 状态 fold 为排序、有界且深度冻结的 JSON 值；`snapshotFor(agent)` fold 对应的 agent 状态。人工命令始终使用 invocation 中的 agent。

Waterfall 监听器会在前面执行观察，并始终通过 `next()` 委派。采集器不会拒绝或改写调用。

## 归属

DSH 事件暴露工具执行和 actor 关系，但不提供通用的插件拥有者身份。因此配置通过精确工具名和不重叠前缀映射到稳定标签 id。未匹配工具可以归入 `unattributed`，也可以忽略。精确效果规则优先于前缀规则。

Agent 作用域和插件归属是两个独立维度：即使 profile 尚未配置明确的插件映射，agent 作用域快照仍可能包含保留的 `unattributed` 标签。

## 隐私与边界

采集器会计算 JSON 字节数，但不会保存序列化 payload。URL 遍历受深度和节点数限制，只保留主机名。文件样本遵循 `pathDisplay` 和 `fileSampleLimit`。证据记录和输出域名样本受配置限制。

## 生命周期与释放

该服务是 Cordis `Service`；服务注册和事件监听器都是由插件 fiber 所有的 effect。卸载 fiber 会移除服务和全部监听器。可选命令插件单独拥有命令注册。

Bundle 层使用稳定行 id `runtime-nutrition-label` 和 `runtime-nutrition-label-command`。Profile 覆盖通过这些 id 定位；使用 `dsh plugin` 移除包时，会同时移除依赖和 bundle 层。

## 失败行为

无效配置在加载时失败。未知标签 id 的 snapshot 和 reset 查询会抛出 `RangeError`。工具 schema 刷新失败时写入日志，并保留上一次成功的观察状态。采集只负责观察，不会把 instrumentation 失败转化成工具拒绝。

## 兼容性边界

由于当前公开 DSH RC 依赖图缺少传递类型包，独立包只将 Cordis 作为普通 peer dependency。`dsh.runtimePeers` 元数据记录真实部署必须提供的 DSH runtime 包，而 `src/*compat.d.ts` 为独立开发提供编译期声明。
