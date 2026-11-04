> 现行混合跨轮规则、150/18项测试、最新两次真实验证与语义局限见[最终质量报告](../docs/threaded-quality-validation-20261104.md)。较早紧邻图与调用次数作为历史记录保留。

> 当前调用、测试和部署状态以[2026-11-04连续辩论报告](../docs/conversation-validation-20261104.md)为准。后文旧次数和未真实联调等是此前阶段证据，不代表当前状态。

# Perspecta 后端 v0.1

方弈琪负责的独立后端：三个固定 API → 一次模型调用 → 可选两/三/四阶段讨论及总结。只使用 Node.js 内置模块，不依赖 npm 包或数据库，当前整合版在独立分支适配前端与团队画像，来源可追溯。开发基线为 `.doc` 四份核心文件。

## 连续模式（2026-11-04）

rounds=4每阶段每人一条，四阶段为抛出争点、质疑与反例、回应与修正、条件与未决。首阶段全无回应，后续混合跨轮引用此前不同嘉宾；第三阶段回接他人对自己早前消息的回应；3/4人还须至少与两位不同嘉宾交锋。2/3/4人共8/12/16条。用户不可中途发言。

显式rounds=3保留队友三轮语义：首轮全null，后两轮回应此前异人，至少一条第三轮回应第二轮。字段、错误和一次调用原则不变。

新3/4模式有效输出cap来自`LLM_DEBATE_OUTPUT_TOKENS`（128–8000，默认4500）；若运维显式配置旧`LLM_MAX_OUTPUT_TOKENS`且未设新值，新模式继承旧上限。旧两轮默认3000。相同有效cap同时用于上游请求和调用前预算预留，较低cap可能截断并返回502，不自动增额或重试。24000byte提示、64KiB响应、45秒超时和原限流仍生效。

当前3/4画像投影保留supportedPositions，省略会引发照念的typicalQuestions，附加有来源的discussionGuidance。来源本身留库不当系统指令。[审计](../docs/conversation-integration-audit.md) · [真实结果及费用](../docs/conversation-validation-20261104.md)。

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
npm run health
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

POST 请求为 `{topic,roleIds,rounds?}`。rounds可为2、3、4，省略仍为2；当前页面显式4。去除首尾空格后 topic 为 10–300 个 Unicode 码点（包括 emoji）；roleIds 为 2–4 个不同的有效 ID。客户端额外传来的画像不会进入提示词。

旧rounds=2时，`messages` 每人两条，先全体第一轮再全体第二轮；每条只含 `id,round,roleId,content,replyTo`。第一轮 `replyTo=null`，第二轮必须引用另一角色的第一轮消息。`summary` 只含 `consensus,disagreements,decisionFactors,nextActions` 四个非空数组（各 1–3 条）。服务器拒绝缺字段、额外字段、重复 ID、缺失角色、不合法引用或空文本。每条内容上限 600 码点，提示词要求约 60–140 汉字；语义质量仍须人工验收。

`usage` 有真实上游计数时为 `{inputTokens,outputTokens}`，没有时为 `null`。mock 为零计数，`discussionId=demo-001`；live 使用服务器生成的 UUID。错误统一为 `{error:{code,message}}`：

| HTTP | code | 含义 |
| --- | --- | --- |
| 400 | `INVALID_INPUT` | 非法输入、无效 JSON/UTF-8、超过 8 KiB 的请求体 |
| 429 | `RATE_LIMITED` | 本地频率/并发/重复提交/预算/调用次数限制，或上游 429；含 `Retry-After: 60` |
| 502 | `INVALID_MODEL_OUTPUT` | JSON、schema、引用、明确引语来源或计数异常、拒答、截断或响应超过 64 KiB |
| 504 | `MODEL_TIMEOUT` | 上游超时或调用方中断 |
| 500 | `INTERNAL_ERROR` | 配置以外的服务器错误、上游鉴权/服务异常或网络失败 |

未知路由/错误方法返回 JSON 404，使用 `INTERNAL_ERROR`，不扩展锁定的错误码。所有 API 响应 `Cache-Control: no-store`，成功响应有 `X-Perspecta-Mode: mock|live`，响应体不增加模式字段。

## 前端联调

前端继续使用同源相对路径 `/api/...`。开发时在前端开发服务器将 `/api` 代理到 `http://127.0.0.1:3001`；生产时在反向代理做同一路由。后端没有开放跨源 CORS。整合版已有同源Vite代理；原独立后端阶段未改前端。

例如供前端负责人采用的 Vite 配置片段（未改动前端）：

```js
server: { proxy: { '/api': 'http://127.0.0.1:3001' } }
```

固定 mock 的讨论文案来自“绩点还是项目实践”示例，自定义 topic 仅回显，不能作为真实回答。联调页面应明确展示“模拟数据”。[data/demo-debate.json](data/demo-debate.json) 同样只是文档占位案例，不能称为历史真实生成；正式演示应由产品负责人验收一次真实生成后，交前端显式展示“历史案例”。本服务不会把实时失败偷偷替换成 mock。

文档示例最后一条 `m6.replyTo=m4` 与正式“只能引用第一轮”约定冲突，fixture 已改为 `m1`。2 人选择会过滤角色、重新映射引用，并在原目标不在所选角色时使用固定补充文案。

## 角色 JSON 接入

[data/roles.json](data/roles.json) 仅收录张雪峰、杜素娟、雷军、王德峰四个人物视角。三个抽象测试立场已归档到 `examples/retired-prototype-roles.json`，不再出现在目录，也不能用旧 ID 发起新讨论；历史记录保留原样。原始资料、结构化适配及来源提交/SHA-256 留在人物画像目录；两份新适配待画像负责人验收，引用来源未逐条核实。更新后须同步该文件并重启。GET 投影仍只保留五个卡片字段。

画像必需字段遵守 `.doc/03`：`id,name,tagline,description,coreValues,typicalQuestions,speakingStyle,boundaries,sources`。`avatar` 可省略：三个原型自动映射到 `career/growth/risk`，新 ID 默认 `career`，可显式给出前端已支持的资产键。ID 必须是 1–64 位英文、数字、`_` 或 `-`，目录至少有 2 个角色；重复 ID、缺少必需字段在启动时失败。

模型仅接收八个讨论字段：`id,name,tagline,description,coreValues,typicalQuestions,speakingStyle,boundaries`。`referencePerson/supportedPositions/sources/provenance/avatar` 不进入提示词；完整来源只作服务端仓库存档，不会自动检索或执行 MD 模板。四人真实资料的长输入也保持原 24000-byte 限制。新增适配不复制示例数值、未核名言或效果保证；正式内容与来源仍须负责人确认。

## 模型配置（需另行授权真实凭据）

[.env.example](.env.example) 只含空凭据与默认值。用户已自行将真实 key 保存至本机被忽略的 `.env.local`，权限 0600；该文件、输入助手和私有执行报告都不进入 Git 或镜像。普通启动不会自动加载它，必须由授权的启动操作显式指定 `--env-file`。2026-11-03的一次及额外三次授权均已使用完；2026-11-04用户另行授权必要联调后，仅执行一次四画像生成并停止（累计五次），详见文末最新报告。不沿用旧锁或自动重试/重启继续调用。

live 必须显式设置 `DEBATE_MODE=live`、`LLM_MODEL`、`LLM_API_KEY`；缺失时启动失败，不静默降级。`LLM_PROVIDER` 支持 `openai`（保留旧配置的默认值）或 `deepseek`；两者默认地址分别为 `https://api.openai.com/v1` 和 `https://api.deepseek.com`。只支持 HTTPS（本机测试 localhost 可 HTTP），禁止 URL 内凭据、查询与片段、禁止上游重定向。显式供应商与另一家的官方主机不匹配时启动失败，避免误用旧配置。

两种适配均使用非流式 `POST {LLM_BASE_URL}/chat/completions`、`response_format:{type:"json_object"}` 和标准 `choices/usage` 字段。OpenAI 使用 `max_completion_tokens`；DeepSeek 使用 `max_tokens` 并显式设置 `thinking:{type:"disabled"}`。默认不指定模型，避免未经确认选择模型或价格。每次请求只发送一次调用，没有自动重试或修复调用。

参数依据 [Chat Completions 官方接口](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create/)；JSON 模式本身不保证 schema，服务端再次校验结构，见 [官方结构化输出说明](https://developers.openai.com/api/docs/guides/structured-outputs)。

用户已选择 DeepSeek，`.env.example` 仍保持 mock、模型与 key 留空。2026-11-03的历史阶段完成一次及额外三议题共四次Flash测试，稳定主题暴露明确引语来源缺陷后做离线修复，见 [三议题报告](../docs/three-topic-validation.md)。2026-11-04在新授权下再完成一次四画像真实前后端联调（累计五次），见 [最新报告](../docs/live-four-personas-20261104.md)。没有查询余额或账单，人物及产品未终验；配置说明见 [DeepSeek 接入](../docs/deepseek-integration.md)。

## 保护措施与实际边界

| 设置 | 默认值 | 作用 |
| --- | --- | --- |
| `LLM_PROVIDER` | `openai`（模板为 `deepseek`） | 明确选择请求参数适配及默认 API 地址 |
| `HOST` / `PORT` | `127.0.0.1` / `3001` | 监听地址；容器覆盖为 `0.0.0.0` |
| `LLM_TIMEOUT_MS` | 45000 | 包含响应体读取的总上游超时，最多 120000 |
| `LLM_MAX_OUTPUT_TOKENS` | 3000 | 输出（含推理）token 上限，允许 128–8000 |
| `MAX_CONCURRENT` | 2 | 同时在生成中的请求 |
| `CLIENT_REQUESTS_PER_MINUTE` | 5 | 单连接来源地址的一分钟固定窗口额度 |
| `GLOBAL_REQUESTS_PER_MINUTE` | 20 | 全进程一分钟固定窗口额度 |
| `SESSION_TOKEN_BUDGET` | 200000 | 当前进程 token 预算 |
| `SESSION_CALL_LIMIT` | 100 | 当前进程真实上游调用次数上限 |

同一议题/角色组合的并发重复提交返回 429，不再次调用。无论角色数组顺序如何都算同一组合。调用方断开时取消上游，并释放并发名额；取消不代表上游绝不计费。

调用前按提示词 JSON 的 UTF-8 字节数 + 512 开销 + 输出上限预留保守 token 额度；提示词上限 24000 字节。有上游 token 计数时按实际数量结算；缺计数、网络失败及超时保留整个预留额。预留数仅用于保护，不充当真实 `usage`。日志只有随机讨论 ID、模式/供应商/模型、耗时、结果码、上游 HTTP 状态及预定义诊断、实际用量及提供商返回的数值 `usage.cost`（缺失为 null；单位以提供商为准），不会猜测价格，不存议题/发言、推理内容、原始错误正文、来源 IP、提示词或 key。格式不合格的模型结果如已返回计数，也会记录计数。

内部日志的 `usageDetails` 只包含数值或 null：`cacheHitTokens,cacheMissTokens,totalTokens,reasoningTokens`，用于人工按供应商价格核算；不扩展前端 `usage`。缺失计数不推测；缓存明细、合计或推理计数矛盾时返回既有 502，并保留已知核心用量/费用。缓存和推理数是明细，不再次计入预算总量。日志为结构化 stdout；生产环境的采集/留存需要目标托管环境配置。

明确引语的来源检查只覆盖有限的句首/分句首“你所说”等直接归属形式及 6–80 字符双引号片段；不匹配目标第一轮时拒绝。它不替代事实/语义审阅，不把普通转述或新引入的概念引号当作错误。新增规则已用真实失败样本离线验证，尚无修复后的新真实生成。

这些控制仅用于单进程演示，重启重置。多个实例没有共享计数；反向代理后按 socket 地址计数（同一代理的所有用户共享额度），不信任客户端伪造的 `X-Forwarded-For`。来源地址桶最多 1000 个、每分钟清理。正式公开服务需要按实际托管方式评估网关限流/共享预算；货币硬上限应在提供商账户侧设置。本次未做这些外部配置。

## 部署准备

没有实际部署。获得部署授权后，可选择直接启动上述 Node 服务，或从仓库根目录执行：

```sh
docker build -t perspecta-api backend
docker run --rm -p 127.0.0.1:3001:3001 perspecta-api
```

Dockerfile 使用非 root 用户，只拷贝服务代码、包描述及 JSON 数据；不安装依赖，不拷贝 `.env`，不在镜像里写 key。`GET /api/roles` 为无费用健康检查。反向代理超时应大于 `LLM_TIMEOUT_MS` 并预留传输余量。本环境没有 Docker，镜像尚未实际构建或启动。

待完成项与验证记录见 [后端交接记录](../docs/backend-handoff.md)。

继续推进时的已验证条件、真实调用/部署所需最小信息见 [模型与部署准备检查](../docs/backend-readiness.md)。新增传输测试经过本地 HTTP 代理验证三个接口，并检查真实 socket 取消；启动测试验证独立服务的健康检查与 SIGTERM。它们不使用真实供应商，不能替代实际模型或前端页面验收。

逐项完成度、时间线对照及未完成责任见 [需求核对表](../docs/requirements-audit.md)。前端可用的历史原始响应见 [examples](examples/README.md)，包含已知质量限制，需显式标记历史案例；不自动兜底，不代表产品负责人已验收。

零费用 GET 健康检查用 `npm run health`，不加载 Key、不触发生成，输出明确标明未测试供应商连通性；完整上线顺序见 [部署操作清单](../docs/deployment-runbook.md)，等队友就绪后的对接步骤见 [前端接入交接](../docs/frontend-integration.md)。本轮只做本机 mock 与离线验证，未部署。


2026-11-04：用户另行授权必要的真实前后端联调后，四份真人画像已完成一次Flash生成及浏览器验证；单次保护已耗尽并停止服务，没有继续调用。最新用量、估算费用及未验收质量项见 [四人真实联调报告](../docs/live-four-personas-20261104.md)。当前模型请求名为 deepseek-flash，来源/溯源元数据不进入提示词。

离线审阅：`node scripts/review.mjs examples/live-gpa-threaded-final-20261104.json`。近似重复/绝对措辞仅提示，永远需要人工语义判断；flags为空也不等于通过。旧四轮历史可显式legacyFour，不能从HTTP请求启用。
