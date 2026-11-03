# 前后端 API 联调契约 v0.1

**锁定原则**：前端和后端按本文件并行。优先使用同源相对路径；字段用英文 camelCase；返回 JSON（UTF-8）。为快速交付，首版不做 SSE/流式生成。

## 1. `GET /api/roles`

响应 `200`：

```json
{
  "roles": [
    {
      "id": "career_realist",
      "name": "现实规划派",
      "tagline": "先考虑约束和机会成本",
      "description": "强调资源投入、选择成本和现实结果",
      "avatar": "career"
    },
    {
      "id": "growth_explorer",
      "name": "成长探索派",
      "tagline": "为长期能力留出试错空间",
      "description": "强调兴趣、探索和持续成长",
      "avatar": "growth"
    },
    {
      "id": "risk_analyst",
      "name": "审慎权衡派",
      "tagline": "先确认你缺少哪些信息",
      "description": "强调证据、可逆性与差异化条件",
      "avatar": "risk"
    }
  ]
}
```

`avatar` 只是前端本地资产键，当前不需要真实图片链接。

## 2. `GET /api/topics`

响应 `200`：

```json
{
  "topics": [
    {"id":"postgraduate_or_work","title":"考研还是就业？","prompt":"对大二学生而言，何时开始确定考研还是就业方向更合理？"},
    {"id":"gpa_or_projects","title":"绩点还是项目实践？","prompt":"大学阶段时间有限，应该优先投入绩点还是项目实践？"},
    {"id":"stability_or_exploration","title":"稳定还是探索？","prompt":"大学生应该尽早确定未来方向，还是广泛尝试？"}
  ]
}
```

## 3. `POST /api/debate`

请求体：

```json
{
  "topic": "大学阶段时间有限，应该优先投入绩点还是项目实践？",
  "roleIds": ["career_realist", "growth_explorer", "risk_analyst"]
}
```

约束：`topic` 去除首尾空格后 10–300 字符；`roleIds` 必须是 2–3 个不同的有效角色 ID。不要求用户登录。

成功响应 `200`（**字段结构固定，文案只是占位示例**）：

```json
{
  "discussionId": "demo-001",
  "topic": "大学阶段时间有限，应该优先投入绩点还是项目实践？",
  "messages": [
    {
      "id": "m1",
      "round": 1,
      "roleId": "career_realist",
      "content": "如果目标是申请有明确绩点门槛的项目，维持成绩底线通常应优先；在此基础上再选择能形成成果的项目。",
      "replyTo": null
    },
    {
      "id": "m2",
      "round": 1,
      "roleId": "growth_explorer",
      "content": "只追求绩点可能缺少解决真实问题的机会。若课程成绩已满足目标，投入一次完整项目更有助于发现兴趣和能力短板。",
      "replyTo": null
    },
    {
      "id": "m3",
      "round": 1,
      "roleId": "risk_analyst",
      "content": "不能脱离目标判断。先看升学门槛、现有成绩、项目的实际内容，再决定调整投入比例。",
      "replyTo": null
    },
    {
      "id": "m4",
      "round": 2,
      "roleId": "career_realist",
      "content": "回应成长探索派：项目当然重要，但如果成绩仍低于目标门槛，额外项目未必能补偿硬性条件。",
      "replyTo": "m2"
    },
    {
      "id": "m5",
      "round": 2,
      "roleId": "growth_explorer",
      "content": "回应现实规划派：我同意门槛存在，但应避免把所有时间用于边际提升很小的分数，而放弃有实际产出的机会。",
      "replyTo": "m1"
    },
    {
      "id": "m6",
      "round": 2,
      "roleId": "risk_analyst",
      "content": "两方的分歧主要不在绩点或项目孰优，而在当前是否已跨过必要门槛，以及项目能否形成可验证成果。",
      "replyTo": "m4"
    }
  ],
  "summary": {
    "consensus": ["需要先明确个人目标和已有基础。"],
    "disagreements": ["成绩门槛与项目能力在当前阶段的优先顺序不同。"],
    "decisionFactors": ["目标项目是否有绩点硬门槛", "当前绩点距离门槛的差距", "项目能否产出可展示成果"],
    "nextActions": ["列出目标与硬性条件", "评估未来四周可投入时间", "选一个能够交付的最小项目任务"]
  },
  "usage": {"inputTokens": 0, "outputTokens": 0}
}
```

**实现约定**：正常返回时 `messages` 应为所选每个角色各 2 条，先全体第一轮再全体第二轮；第二轮 `replyTo` 必须指向第一轮实际存在的消息 ID；`summary` 四个数组均不能缺失。`usage` 允许为 `null`（提供商未返回计数时），不能虚报 token。

生成流程建议：一次模型调用输出结构化 JSON → 服务端 schema 校验 → 返回前端。若校验不通过，可以有限次数重试或返回错误；禁止返回未经校验的自由文本。

## 4. 失败响应

统一格式：

```json
{ "error": { "code": "MODEL_TIMEOUT", "message": "讨论生成超时，请重试" } }
```

| HTTP | code | 触发条件 |
|---|---|---|
| 400 | `INVALID_INPUT` | 议题或角色 ID 不合法 |
| 429 | `RATE_LIMITED` | 超出调用频率限制 |
| 502 | `INVALID_MODEL_OUTPUT` | 模型结果无法通过 schema 校验 |
| 504 | `MODEL_TIMEOUT` | 上游生成超时 |
| 500 | `INTERNAL_ERROR` | 其他服务器异常 |

前端处理：生成中禁用提交按钮；失败后保留议题和角色；用户点击重试才再次调用；不要自动无限重试。

## 5. 快速联调流程

1. 后端先写固定响应，不接模型；前端用它验证所有页面状态。
2. 前端可在后端完成前用 `03_人物画像与讨论规则.md` 中的固定角色、此处 JSON 模拟。
3. 后端接模型后保持同一 API，不要求前端适配模型输出的原始格式。
4. 演示兜底数据建议存入前端 `/public/demo-debate.json`，仅在演示模式显式调用；不可冒充现场实时生成。

## 6. 最小目录建议（非强制）

```text
src/
  app/
    page.tsx                 # 圆桌讨论页
    api/
      roles/route.ts
      topics/route.ts
      debate/route.ts
  components/
    RoleSelector.tsx
    DebateTimeline.tsx
    DebateSummary.tsx
  server/
    roles.json
    debatePrompt.ts
    debateService.ts
```

若沿用既有代码结构，优先遵守相同 API 合同，不必为了目录一致而重构。
