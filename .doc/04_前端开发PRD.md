# Perspecta 前端功能与联调说明

本文件描述当前前端交付状态。运行步骤见 [README](../README.md)，接口类型与校验实现见 `src/data.ts`。团队原始产品需求与 API 契约保留在 `.doc/01_PRD_产品需求.md`、`.doc/02_API_联调契约.md`；以下列出当前页面行为及待统一项。

## 页面与交互

页面采用暖木色书房、左右纸质书页和中间圆桌的固定构图。品牌标志不可点击，顶部导航包含“圆桌讨论”和“关于我们”。主要操作采用米金色纸张、双线细边框与箭头样式。

流程为：输入问题 → 选择嘉宾 → 开启对话 → 等待完整结果 → 播放两轮发言 → 查看总结与记录 → 保存 PNG 或复制文本。

| 状态 | 行为 |
| --- | --- |
| 准备 | 输入去除首尾空格后 10–300 字的问题；可用推荐议题填充；邀请 2–4 位嘉宾 |
| 加载 | 确定本场名单与场景，锁定问题及人选，显示“观点正在酝酿，请稍候…” |
| 播放 | 中间展示当前发言；支持暂停、继续、下一位、跳过；右侧已完成发言可展开 |
| 完成 | 右侧默认展示总结，可切换完整记录；允许保存图片、复制文本或调整议题与嘉宾 |
| 失败 | 显示错误，保留问题与嘉宾选择，允许手动重新发起 |

等待说明为“正在围绕你的问题，准备不同视角的讨论。”。前端等待完整 JSON 返回后播放，不展示模型生成百分比。请求超时为 60 秒（后端模型时限保持 45 秒，预留 15 秒处理和传输余量），不自动 POST 重试，也不把失败结果替换为模拟成功。

讨论中的长问题限制展示高度，支持滚动阅读并保留全文，不挤占嘉宾列表与底部操作。重新发起需要确认，清除当前结果但保留问题与嘉宾选择。

舞台尺寸为 1671×941，按窗口可用尺寸整体等比缩放。当前布局面向电脑端，未提供独立手机布局。开启系统减少动态效果时，发言通过按钮手动推进。

## 嘉宾与素材

| 人物 | 当前 ID |
| --- | --- |
| 张雪峰 | `zhang_xuefeng` |
| 雷军 | `lei_jun` |
| 王德峰 | `wang_defeng` |
| 杜素娟 | `du_sujuan` |

嘉宾列表和圆桌预览共用 `guest-portrait-source.png` 中的头像。勾选只更新人选及头像预览，合法点击“开启这场对话”后加载本场对谈图片；重新发起后恢复空桌。素材加载失败时保留头像与姓名预览。

`public/assets/` 包含 16 张正式使用的图片：

| 路径或文件组 | 数量 | 用途 |
| --- | --- | --- |
| `brand/perspecta-gold.png` | 1 | 品牌标志 |
| `scenes/two.png`、`three.png`、`four.png` | 3 | 不同人数的空桌背景 |
| `characters/guest-portrait-source.png` | 1 | 四位嘉宾头像 |
| `characters/two-conversation-2-1.png` 至 `two-conversation-2-6.png` | 6 | 所有两人组合 |
| `characters/warm-conversation-patch.png`、`three-conversation-3-2.png` 至 `three-conversation-3-4.png` | 4 | 所有三人组合 |
| `characters/four-conversation.png` | 1 | 四人组合 |

组合匹配不受选择顺序影响。定位、原图尺寸与柔化参数集中在 `src/scene-artwork.ts`。调整场景时以该配置为准，保持图片比例。

## 接口与响应结构

所有请求使用同源 `/api` 路径，开发代理在 `vite.config.ts` 配置。默认目标为 `http://127.0.0.1:3001`，可通过启动终端的 `API_PROXY_TARGET` 环境变量覆盖。已与后端默认 3001 对齐；仅后端地址变更时需要覆盖。

### GET /api/roles

返回 `{ roles: Role[] }`：

```typescript
type Role = {
  id: string;
  name: string;
  tagline: string;
  description?: string;
  avatar?: string;
};
```

前端从返回数据渲染嘉宾；本地头像和合成场景依赖上述四个 ID。四位嘉宾固定使用本地头像，不使用后端 `avatar` 覆盖，后端无需提供图片。未匹配本地头像的其他 ID 才会尝试使用可选 `avatar` 图片 URL；交接范围仍为上述四位嘉宾。

### GET /api/topics

返回 `{ topics: { id: string; title: string; prompt: string }[] }`。点击推荐议题时将完整 `prompt` 填入输入框。

### POST /api/debate

请求：

```typescript
{ topic: string; roleIds: string[] }
```

响应：

```typescript
{
  discussionId: string;
  topic: string;
  messages: {
    id: string;
    round: 1 | 2;
    roleId: string;
    content: string;
    replyTo: string | null;
  }[];
  summary: {
    consensus: string[];
    disagreements: string[];
    decisionFactors: string[];
    nextActions: string[];
  };
  usage: { inputTokens: number; outputTokens: number } | null;
}
```

前端校验每位所选嘉宾每轮各一条发言、第一轮后接第二轮、消息 ID 唯一、正文非空、第一轮 `replyTo=null`、第二轮引用另一位嘉宾的第一轮消息，以及四项非空总结。按返回的发言顺序播放，`usage` 当前不在页面展示。

非成功响应使用 `{ error: { code, message } }`，前端展示 `message`。超时显示“讨论生成超时，请重试”。

### 模式标识

成功响应头使用 `X-Perspecta-Mode: mock|live`，无需修改 JSON 响应体。

- 前端本地模拟固定使用 mock；数据不会针对新问题实时生成。
- 请求后端时，角色与议题接口共同决定准备阶段的说明，两者不一致时为 unknown。
- 讨论响应头决定该场结果及导出图片的说明，不根据前端连接开关猜测模型是否被调用。
- 缺失或非法标识显示“数据模式待确认”。

`VITE_API_MODE=live` 只表示启用后端请求。产品固定支持 2–4 位嘉宾，前端允许提交四人请求；后端需支持四人输入与两轮共八条发言。

## 结果展示与导出

总结的四项依次为“主要共识、核心分歧、关键变量、下一步行动”。讨论记录保留所有返回发言，可展开阅读，并在有回应关系时显示被回应者。

PNG 由独立札记模板生成，不是整页截图；包含品牌、议题、嘉宾、四项总结、数据模式说明和日期。导出宽度为 1000px、像素倍率为 2，总结正文字号为 23px。生成后尝试下载并显示图片预览，可再次下载。

“复制完整讨论”包含问题、全部发言与四项总结。页面未提供登录、云端保存或跨刷新恢复，刷新前应保存所需结果。

## 待联调项

1. 将后端代码与前端集成，使用默认 3001 端口并保持模式响应头透传。
2. 后端统一四位嘉宾的 ID 并补齐画像；头像使用前端本地素材。
3. 确认四人请求与八条发言支持，保持消息和总结字段一致。
4. 先使用后端模拟模式验证输入、等待、播放、记录、总结和导出，再验证真实模型。
5. 当前前后端尚未完成联调；模型密钥仅在后端保存。


> 2026-11-04 实现增量：依据用户后续要求，整合页改为四阶段连续接话（2/3/4人8/12/16条）。POST新增可选rounds:2|3|4，省略仍2；显式3保留队友成果。原字段保持，详细差异、画像来源和验证见[整合审计](../docs/conversation-integration-audit.md)。用户仍不可中途发言；实现与资料未宣称产品负责人终验，原文保留作版本追溯。

> 后续质量修订：四阶段首阶段全null，后续混合跨轮，第三阶段回接他人对自己早前论点的回应；旧2/3模式保持，旧4历史须显式加载。新增完整重复正文拒绝；语义仍人工验收，字段未扩展。详见[最终质量报告](../docs/threaded-quality-validation-20261104.md)。
