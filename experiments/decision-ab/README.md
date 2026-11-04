# 新版提示词与判断案例 A/B（2026-11-04）

本组与 `../prompt-ab/results/natural-v3` 的旧A/B不同，不能混合算作同一实验。A为73caf61d59287cf019c02daadded46b6d2a87a0f，B为ac75a51009c3bd95cd3320eff0dc7f44442afaa4。

从各提交逐字节提取运行源码/数据，使用其原始buildMessages，不重写或融合。manifest包含来源、请求与harness SHA256。固定同题、张雪峰/雷军/王德峰/杜素娟顺序、四阶段16条、相同回复图。Flash、非思考、JSON、max_tokens4500；temperature/top_p均不发送，沿用服务端默认，与当前生产请求一致。每版仅一次；A先完成并交付全文，再B；失败保留，不自动重试、回退或手改成成功。

B不仅新增张/杜各两个判断案例，也将supportedPositions压缩为position字符串并新增案例边界指令；这是版本整体比较，不能把差异仅归因于新增案例。案例来源保留在B快照，但runtime只发送四个短句，scope等并未逐条进入模型；系统有总边界，不能声称每条来源已独立核实或画像负责人验收。

A请求21886、B21773bytes（其中messages约21743/21630），均低生产24KB；4500输出预算，输入按请求字节+512保守预留，峰值全部输入未命中缓存上界约$0.0121194/$0.0120855，合计$0.0242049。API实际tokens与缓存计数用于事后估算。保守上界计算不等于供应商账单。

[官方价格](https://api-docs.deepseek.com/quick_start/pricing/)于2026-11-04核对：Flash峰时每百万输入未命中$0.30、命中$0.006、输出$1.20；非高峰减半，按请求时间给估算并保留峰时上界。不读取余额或配置额外服务。

离线：`node --test experiments/decision-ab/test.mjs`。真实调用必须显式`run-once.mjs A --live`或B，并设置本机私有绝对报告目录；Key仅由已授权Node --env-file在子进程载入，不能出现在参数、日志或Git。持久attempt.lock禁止重复请求。无临时服务，脚本退出即停止。

本组是直接上游/生产结构校验的提示词对照，不是本次浏览器联调。结构通过不代表语义/自然度通过，各一次不说明稳定率或统计优劣。完整原文、校验、用量、费用与人工审阅将另存results及docs/chat-logs。
