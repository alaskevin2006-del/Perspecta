# DeepSeek 接入说明（官方资料核对：2026-11-03）

用户已选择 DeepSeek，并自行将 key 保存到本机私有文件。此前在明确批准的 US$0.32 保守上界内，只执行了一次 Flash 真实请求：HTTP 200、结构校验通过。没有显示 key，没有查询模型列表、余额或账单。该次授权已经用完；后续代码/质量增量只做离线或假上游测试，不追加模型调用。

## 已处理的兼容性差异

按 [DeepSeek 官方 Chat Completions 接口](https://api-docs.deepseek.com/api/create-chat-completion/) 和 [Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/)：

- 配置 `LLM_PROVIDER=deepseek`，默认根地址 `https://api.deepseek.com`，后端追加 `/chat/completions`。
- DeepSeek 请求使用 `max_tokens`，不发送 OpenAI 适配的 `max_completion_tokens`。
- 本产品无需额外思考输出，显式发送 `thinking:{type:"disabled"}` 控制时延与成本；不依赖供应商默认模式。只取最终 `message.content`，不返回或记录 `reasoning_content`。
- 使用非流式 JSON object 模式。提示词附所选角色的完整两轮结构示例；2 人为 4 条、3 人为 6 条，引用指向另一角色第一轮。
- `usage` 直接取 `prompt_tokens` 和 `completion_tokens`；缓存命中/未命中是明细，不再次相加。未返回费用时仍为 null，不根据未确认价格猜测账单。

按 [JSON Output 指南](https://api-docs.deepseek.com/guides/json_mode/)，JSON 模式可能返回空白 content。服务端将空白/空值、截断、格式或引用不合格结果返回既有 502 `INVALID_MODEL_OUTPUT`，保留可获得的计数，没有自动再次付费重试。

## 当前配置模板

`backend/.env.example` 仅为已提交的空凭据模板，不是实际 `.env`：

```dotenv
DEBATE_MODE=mock
LLM_PROVIDER=deepseek
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=
LLM_API_KEY=
LLM_TIMEOUT_MS=45000
LLM_MAX_OUTPUT_TOKENS=3000
```

**`deepseek-flash` 已在该账户的单次测试中成功。** [官方入门页](https://api-docs.deepseek.com/) 列出 `deepseek-flash` 和 `deepseek-v4-pro`；本次没有测试 Pro 或其他模型。本代码没有隐式选模型、没有锁死可用模型白名单，不能凭 Flash 成功推定其他模型可用。

本机 key 由用户用隐藏输入助手保存，权限 0600、被 Git/Docker 忽略；仅授权的 Node `--env-file` 启动读取到服务端 `LLM_API_KEY`。没有把 key 发到聊天、前端或 Git。代码不自动读取其他应用配置，也不自动发现 `DEEPSEEK_API_KEY` 或密钥文件。前端没有密钥字段。

供应商与另一家的官方地址错配会启动失败；如确需自有 HTTPS 代理，应明确设置正确的 `LLM_PROVIDER` 和经确认的基础 URL。不能在未审阅代理可信性时把真实 key 送给它。

## 错误处理与排查

参考 [DeepSeek 官方错误码](https://api-docs.deepseek.com/quick_start/error_codes/)。前端响应仍只含 `{error:{code,message}}`，不增加供应商字段或错误码。服务端日志中的诊断来自固定映射，不复制上游错误正文：

| 上游 HTTP | 前端 HTTP / code | 安全日志 `upstreamError` | 管理侧下一步 |
| --- | --- | --- | --- |
| 400 / 422 | 500 / `INTERNAL_ERROR` | `UPSTREAM_INVALID_REQUEST` | 检查模型、供应商及参数兼容性 |
| 401 | 500 / `INTERNAL_ERROR` | `UPSTREAM_AUTH_FAILED` | 由授权人员检查服务端 key 注入 |
| 402 | 500 / `INTERNAL_ERROR` | `UPSTREAM_INSUFFICIENT_BALANCE` | 用户自行确认余额/预算，不自动充值 |
| 429 | 429 / `RATE_LIMITED` | `UPSTREAM_RATE_LIMITED` | 稍后由用户重试，后端不自动重发 |
| 500 / 503 | 500 / `INTERNAL_ERROR` | `UPSTREAM_UNAVAILABLE` | 检查上游状态，保留失败给前端 |

所有错误都不透传密钥、原始错误、提示词或推理内容。45 秒上游超时和断线取消、单次调用、进程预算/调用次数限制、重复提交保护保持不变。供应商取消不保证零计费，失败未知用量仍保留预算预留。

## 已验证与未验证

初版适配先观察到 10 个预期失败，再完成参数和诊断适配，73 项自动化测试通过。本轮新增数值明细日志、一致性检查和需求回归后，完整本地假上游/离线测试为 **88/88 PASS**。这些自动化测试不读私有 key，也不请求真实供应商；唯一真实调用证据另见 [样本质量审阅](live-quality-review.md)。

前端契约、错误响应字段、角色数据及原始四份文档未修改；默认服务仍为 mock。现有 OpenAI 参数路径保留，以免破坏此前联调。

独立只读审阅已批准，无 Critical/Important/Minor；额外独立运行 24 个内存用例，覆盖两种供应商及全部有序 2/3 角色选择，核对参数、示例引用、响应字段、用量与推理隔离。它们同样没有请求真实提供商。

本轮日志只增加安全数值 `usageDetails`，前端 `usage` 仍只有输入/输出计数。缺少明细返回 null，不推测；矛盾明细拒绝，但保留已知核心 token/费用以供排查。

剩余条件：改后提示词及其他主题的真实质量验证需要另次授权；产品负责人、画像组需验收内容。部署目标、访问范围及部署授权仍未确定。Docker 镜像运行、团队前端页面联调、公网部署仍未验证。
