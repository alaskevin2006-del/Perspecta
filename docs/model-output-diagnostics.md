# 定位模型输出格式错误

本改动只增加服务器安全诊断，不改变公共接口的错误码、中文消息或 HTTP 状态，不放宽输出校验，也不增加自动重试或模型请求。

## 先确认失败发生在哪一层

- `502` / `INVALID_MODEL_OUTPUT` / “讨论结果格式不符合要求，请重试”：后端已拒绝模型结果。
- 前端显示“讨论发言格式有误”“讨论缺少跨轮回接”：成功响应未通过前端检查。
- “服务返回格式异常”：检查是否收到 HTML、代理错误页或其他非 JSON 响应。

保存失败请求的状态码、响应错误对象、服务器运行提交以及同时间的 `debate_call` 日志。不要发送密钥、环境文件、原始上游响应或私人对话。

## 新增日志字段

`debate_call.outputDiagnostic` 成功时为 `null`。模型输出校验失败时包含固定枚举 `reason` 和受白名单约束的 `path`，例如：

```json
{"outcome":"INVALID_MODEL_OUTPUT","upstreamStatus":200,"outputDiagnostic":{"reason":"SUMMARY_COUNT","path":"summary.decisionFactors"}}
```

常见类别：

- `OUTPUT_TRUNCATED`：上游 finish_reason 为 length；检查输出预算和要求长度。
- `OUTPUT_REFUSED`：上游声明拒绝输出；不记录拒绝正文。
- `UPSTREAM_JSON_INVALID`：响应外层不是有效 JSON、不可完整读取、非法 UTF-8 或超响应体限制；该类别暂不进一步区分这些情况。
- `CONTENT_JSON_INVALID`：模型 content 不是有效 JSON。
- `USAGE_INVALID`：usage 计数或缓存细项不合法。
- `OUTPUT_STRUCTURE` / `MESSAGE_STRUCTURE` / `MESSAGE_COUNT`：结构、字段、轮次/人物或条数错误。未进一步细分的结构或跨轮覆盖错误保留 `OUTPUT_STRUCTURE`。
- `REFERENCE_INVALID` / `QUOTE_MISMATCH`：回应关系或明确引用不符合现有规则。
- `DUPLICATE_CONTENT`：四阶段正文完全重复。
- `SUMMARY_COUNT` / `SUMMARY_CONTENT`：总结数组条数或文本不合格。

路径只记录固定字段名和数字下标，不记录实际 ID、未知字段名、角色、正文、提示词或密钥。公共 JSON 仍只有原来的 error.code / error.message。

本改动帮助定位失败，不等于提高模型合规率或证明自然度。应先读取具体原因，再做针对性修复；不要为了通过而截断摘要、改写原文或盲目重试收费调用。

## 本地验证

后端新增测试覆盖两/三/四轮摘要、截断、拒绝、内外 JSON、未知字段、引用、用量和日志脱敏，验证单次失败不重试且公共错误不变。测试使用内存假上游，不读取 `.env.local` 或调用供应商。
