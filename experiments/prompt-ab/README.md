# 自然口语 A/B 实验（独立分支）

当前冻结版本是 `snapshots/natural-v3`。v1/v2只做过离线预检，从未调用模型，不计作实验结果。A为现有融合资料、固定混合回复图与逐条焦点的口语修订；B完整装入两份队友v3和张/杜原JSON，自由选此前异人的回复目标，不施加A的第三阶段回接。

共同固定：同题、同人物和逐条发言顺序、四轮16条、80–130字目标、Flash非思考、temperature0.8、top_p1、max_tokens4500、45秒、64KiB响应；不称兄，不先报幕，正文少用冒号，真实人物引用/亲历/数字及医疗等边界一致。完整B输入较长，两方案共用实验60000byte和70000token保守预留；不改生产24000byte保护。

B保留原topic/roster/rounds/utterances和speaker/text/u编号，新增共同summary任务；原稿没有摘要。严格校验原始B后才机械映射到messages/roleId/content/m编号，原文不改。B的格式与全文负担亦是方案差别，不能把结果归因于单一提示词。

## 离线验证

```sh
node --test experiments/prompt-ab/test.mjs experiments/prompt-ab/runner.test.mjs
```

固定请求和来源SHA256在各版本manifest；活动版请求A/B分别21579、55164bytes，调用前的峰时估算上界约US$0.01203、0.02210。旧v1/v2不匹配当前代码是预检演进记录，CLI只加载v3并拒绝源码/请求漂移。

`run-once.mjs`必须显式A或B及`--live`，密钥仅经授权的Node私有env文件载入，不能放CLI参数或Git。每版私有目录原子attempt.lock只允许一次，不会自动重试或换模型。失败/截断同样记录，先查报告再继续，不能删锁重跑。脚本仅直连官方API，不启动服务器，不等同浏览器联调。

## 结果解释

只各一次，不估计稳定率、统计显著性或盲测识别率。`speechMetrics`只记录指定称谓、报幕词和正文冒号，永远是HUMAN_REVIEW_REQUIRED；没有命中也不能证明像真人。先逐条审正文的直接回应、推进、风格、曲解和改判，再审摘要的归因与条件。保留原始响应、映射结果、时间、用量、费用和完整可读聊天，不以删改后内容冒充生成成功。
