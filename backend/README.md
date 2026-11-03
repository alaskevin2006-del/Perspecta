# Perspecta 后端 v0.1

方弈琪负责的独立后端：三个固定 API → 一次模型调用 → 两轮讨论及总结。只使用 Node.js 内置模块，不依赖 npm 包或数据库，不改前端页面和画像组的资料。开发基线为 `.doc` 四份核心文件。

## 启动与验证

Node.js 22 或更新版本，在仓库根目录执行：

```sh
cd backend
npm start
```

默认 `http://127.0.0.1:3001`，`DEBATE_MODE=mock`，无需密钥，不调用上游。另一个终端执行：

```sh
cd backend
npm test
npm run smoke
```

无需 `npm install`。`node src/server.js`、`node --test` 等价。测试只连接本地假上游，不读真实密钥、不产生模型费用。`API_BASE_URL` 可指定 smoke 目标；发现 live 服务时脚本会停止，只有显式 `npm run smoke -- --live` 才调用一次真实生成。

## 锁定接口

正式契约仍为 [02_API_联调契约.md](../.doc/02_API_联调契约.md)，可供前端导入的类型为 [api-contract.d.ts](api-contract.d.ts)。

| 路由 | 成功响应字段 |
| --- | --- |
| `GET /api/roles` | `roles: [{id,name,tagline,description,avatar}]` |
| `GET /api/topics` | `topics: [{id,title,prompt}]` |
| `POST /api/debate` | `discussionId, topic, messages, summary, usage` |

POST 请求为 `{topic,roleIds}`。去除首尾空格后 topic 为 10–300 个 Unicode 码点（包括 emoji）；roleIds 为 2–3 个不同的有效 ID。客户端额外传来的画像不会进入提示词。

`messages` 每人两条，先全体第一轮再全体第二轮；每条只含 `id,round,roleId,content,replyTo`。第一轮 `replyTo=null`，第二轮必须引用另一角色的第一轮消息。`summary` 只含 `consensus,disagreements,decisionFactors,nextActions` 四个非空数组（各 1–3 条）。服务器拒绝缺字段、额外字段、重复 ID、缺失角色、不合法引用或空文本。每条内容上限 600 码点，提示词要求约 60–140 汉字；语义质量仍须人工验收。

`usage` 有真实上游计数时为 `{inputTokens,outputTokens}`，没有时为 `null`。mock 为零计数，`discussionId=demo-001`；live 使用服务器生成的 UUID。错误统一为 `{error:{code,message}}`：

| HTTP | code | 含义 |
| --- | --- | --- |
| 400 | `INVALID_INPUT` | 非法输入、无效 JSON/UTF-8、超过 8 KiB 的请求体 |
| 429 | `RATE_LIMITED` | 本地频率/并发/重复提交/预算/调用次数限制，或上游 429；含 `Retry-After: 60` |
| 502 | `INVALID_MODEL_OUTPUT` | JSON、schema、引用、计数异常、拒答、截断或响应超过 64 KiB |
| 504 | `MODEL_TIMEOUT` | 上游超时或调用方中断 |
| 500 | `INTERNAL_ERROR` | 配置以外的服务器错误、上游鉴权/服务异常或网络失败 |

未知路由/错误方法返回 JSON 404，使用 `INTERNAL_ERROR`，不扩展锁定的错误码。所有 API 响应 `Cache-Control: no-store`，成功响应有 `X-Perspecta-Mode: mock|live`，响应体不增加模式字段。

## 前端联调

前端继续使用同源相对路径 `/api/...`。开发时在前端开发服务器将 `/api` 代理到 `http://127.0.0.1:3001`；生产时在反向代理做同一路由。后端没有开放跨源 CORS。没有提交前端或根目录构建配置，避免与 `feat/ui` 冲突。

例如供前端负责人采用的 Vite 配置片段（未改动前端）：

```js
server: { proxy: { '/api': 'http://127.0.0.1:3001' } }
```

固定 mock 的讨论文案来自“绩点还是项目实践”示例，自定义 topic 仅回显，不能作为真实回答。联调页面应明确展示“模拟数据”。[data/demo-debate.json](data/demo-debate.json) 同样只是文档占位案例，不能称为历史真实生成；正式演示应由产品负责人验收一次真实生成后，交前端显式展示“历史案例”。本服务不会把实时失败偷偷替换成 mock。

文档示例最后一条 `m6.replyTo=m4` 与正式“只能引用第一轮”约定冲突，fixture 已改为 `m1`。2 人选择会过滤角色、重新映射引用，并在原目标不在所选角色时使用固定补充文案。

## 角色 JSON 接入

[data/roles.json](data/roles.json) 直接使用文档的三种立场原型，仅补充已有本地头像键，没有重新编写人物画像。画像组交付时替换该文件并重启即可。所有完整画像只在服务端进入提示词，GET 投影只保留五个卡片字段。

画像必需字段遵守 `.doc/03`：`id,name,tagline,description,coreValues,typicalQuestions,speakingStyle,boundaries,sources`。`avatar` 可省略：三个原型自动映射到 `career/growth/risk`，新 ID 默认 `career`，可显式给出前端已支持的资产键。ID 必须是 1–64 位英文、数字、`_` 或 `-`，目录至少有 2 个角色；重复 ID、缺少必需字段在启动时失败。新增 `referencePerson/supportedPositions` 和来源内容会随完整画像送入模型，不更改 API。

目前不存在正式真人画像；若以后启用，画像组和前端须完成来源核查及“基于公开资料的 AI 模拟观点，非本人发言”的展示。后端不将生成内容称为真人原话。

## 模型配置（需另行授权真实凭据）

[.env.example](.env.example) 只含空凭据与默认值。本次没有创建 `.env` 或配置任何真实 key。获准后可用托管平台的服务端环境变量；本地手动填写被忽略的 `.env`，然后 `node --env-file=.env src/server.js`。

live 必须显式设置 `DEBATE_MODE=live`、`LLM_MODEL`、`LLM_API_KEY`；缺失时启动失败，不静默降级。`LLM_BASE_URL` 默认 `https://api.openai.com/v1`，只支持 HTTPS（本机测试 localhost 可 HTTP），禁止 URL 内凭据、查询与片段、禁止上游重定向。

供应商必须支持非流式 `POST {LLM_BASE_URL}/chat/completions`、`response_format:{type:"json_object"}`、`max_completion_tokens` 和标准 `choices/usage` 字段。默认不指定模型，避免未经确认选择供应商或价格。不兼容这些字段的供应商需要另行验证适配，不能宣称已接通。每次请求只发送一次调用，没有自动重试或修复调用。

参数依据 [Chat Completions 官方接口](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create/)；JSON 模式本身不保证 schema，服务端再次校验结构，见 [官方结构化输出说明](https://developers.openai.com/api/docs/guides/structured-outputs)。

## 保护措施与实际边界

| 设置 | 默认值 | 作用 |
| --- | --- | --- |
| `HOST` / `PORT` | `127.0.0.1` / `3001` | 监听地址；容器覆盖为 `0.0.0.0` |
| `LLM_TIMEOUT_MS` | 45000 | 包含响应体读取的总上游超时，最多 120000 |
| `LLM_MAX_OUTPUT_TOKENS` | 3000 | 输出（含推理）token 上限，允许 128–8000 |
| `MAX_CONCURRENT` | 2 | 同时在生成中的请求 |
| `CLIENT_REQUESTS_PER_MINUTE` | 5 | 单连接来源地址的一分钟固定窗口额度 |
| `GLOBAL_REQUESTS_PER_MINUTE` | 20 | 全进程一分钟固定窗口额度 |
| `SESSION_TOKEN_BUDGET` | 200000 | 当前进程 token 预算 |
| `SESSION_CALL_LIMIT` | 100 | 当前进程真实上游调用次数上限 |

同一议题/角色组合的并发重复提交返回 429，不再次调用。无论角色数组顺序如何都算同一组合。调用方断开时取消上游，并释放并发名额；取消不代表上游绝不计费。

调用前按提示词 JSON 的 UTF-8 字节数 + 512 开销 + 输出上限预留保守 token 额度；提示词上限 24 KiB。有上游 token 计数时按实际数量结算；缺计数、网络失败及超时保留整个预留额。预留数仅用于保护，不充当真实 `usage`。日志只有随机讨论 ID、模式/模型、耗时、结果码、实际用量及提供商返回的数值 `usage.cost`（缺失为 null；单位以提供商为准），不会猜测价格，不存议题/发言、来源 IP、提示词或 key。格式不合格的模型结果如已返回计数，也会记录计数。

这些控制仅用于单进程演示，重启重置。多个实例没有共享计数；反向代理后按 socket 地址计数（同一代理的所有用户共享额度），不信任客户端伪造的 `X-Forwarded-For`。来源地址桶最多 1000 个、每分钟清理。正式公开服务需要按实际托管方式评估网关限流/共享预算；货币硬上限应在提供商账户侧设置。本次未做这些外部配置。

## 部署准备

没有实际部署。获得部署授权后，可选择直接启动上述 Node 服务，或：

```sh
docker build -t perspecta-api backend
docker run --rm -p 3001:3001 perspecta-api
```

Dockerfile 使用非 root 用户，只拷贝服务代码、包描述及 JSON 数据；不安装依赖，不拷贝 `.env`，不在镜像里写 key。`GET /api/roles` 为无费用健康检查。反向代理超时应大于 `LLM_TIMEOUT_MS` 并预留传输余量。本环境没有 Docker，镜像尚未实际构建或启动。

待完成项与验证记录见 [后端交接记录](../docs/backend-handoff.md)。

继续推进时的已验证条件、真实调用/部署所需最小信息见 [模型与部署准备检查](../docs/backend-readiness.md)。新增传输测试经过本地 HTTP 代理验证三个接口，并检查真实 socket 取消；启动测试验证独立服务的健康检查与 SIGTERM。它们不使用真实供应商，不能替代实际模型或前端页面验收。
