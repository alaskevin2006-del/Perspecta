# Perspecta 服务器部署记录

最新修复版本：`357cd33`（2026-11-05），已修复短议题与进程累计用量保护；现状及验证见 [故障修复记录](incident-20261105.md)。以下保留初次部署和前次更新的验证证据。

部署日期：2026-11-04（北京时间）。

- 访问地址：http://124.221.230.69:8888/
- 服务器用户：ubuntu。
- 当前发布目录：`/home/ubuntu/perspecta/releases/20261105-357cd33`；`/home/ubuntu/perspecta/current` 指向该版本。
- 当前来源提交：`357cd33`，前端以 `VITE_API_MODE=live` 构建，实际请求本项目后端。
- 后端模式：`DEBATE_MODE=live`，DeepSeek 官方接口、`deepseek-flash`、非思考 JSON 输出；用户提供密钥后已从初始模拟部署切换到真实生成。
- 密钥仅在服务器 `/home/ubuntu/perspecta/shared/api.env`，文件权限 0600、目录 0700，通过服务端 `env_file` 注入。未写入前端、镜像、Git 或日志。
- 独立 Compose 项目：`perspecta`；独立网络：`perspecta_default`；容器：`perspecta-api-1`、`perspecta-web-1`。
- 只公开本项目 Web 端口 8888；API 不发布宿主端口，由本项目 Nginx 转发 `/api/`。
- 已配置容器自动启动、日志轮转、健康检查及资源限制，未配置域名或 HTTPS。

## 本次更新验证（02c65da）

更新当前整合版讨论规则、人物资料、诊断与张雪峰表达风格；沿用原 DeepSeek 配置文件，没有修改模型、密钥、供应商、预算、超时或限流参数。保留旧发布目录和镜像供回退。

前端构建、18 项测试、代理联调通过；服务器隔离 Linux 容器中的后端 178/178 测试通过。资料来源按 Git 原始字节打包，避免 Windows 换行转换破坏溯源哈希，未改变测试断言。

新版两个容器健康，公网首页、JS、CSS、角色、议题、头像图片均返回 200，静态资源与本地构建一致；目录接口显示 live 模式及最新四个人物。只读健康检查通过，没有新增真实生成调用。

部署前后核对服务器配置文件哈希保持一致，容器实际环境变量与原配置逐项一致。其他项目容器 ID、启动时间和重启次数及 chip-diplomacy 系统服务启动时间保持不变。

## 初次部署验证

前端构建、18 项前端测试及前后端代理联调通过。后端在服务器 Linux 容器中 150/150 测试通过。Windows 本机的资料哈希与 SIGTERM 差异经 Git 原始资料及 Linux 环境复核通过，没有修改业务代码或测试断言。

公网 GET 首页、JS、CSS、角色和议题接口均为 200。公网 POST 模拟讨论分别验证 2/3/4 位嘉宾，返回 8/12/16 条发言和四类总结，响应明确标识 mock。服务端 health 和 smoke 均通过。

部署前后逐项对比原有容器 ID、启动时间和重启次数，以及 chip-diplomacy 服务启动时间，全部保持一致。未修改其他项目文件、入口配置、容器或服务。18888 公网不通，最终改用已空闲且公网可达的 8888；测试端口容器已移除，没有调整服务器或云端防火墙。

## 运维

SSH 登录后仅在本项目目录操作：

```sh
cd /home/ubuntu/perspecta/current
docker compose ps
docker compose logs --tail 100
docker compose exec -T api node scripts/health.mjs
```

停止本项目：`docker compose stop`。恢复：`docker compose up -d --pull never`。以上命令须在上述目录执行，不操作其他 Compose 项目。发布目录内保留 `compose.yaml`、`Dockerfile.api` 和 `nginx.conf`。

回退到初次部署版本：进入 `/home/ubuntu/perspecta/releases/20261104-4724de2`，执行 `docker compose up -d --pull never --force-recreate --wait --wait-timeout 90`，然后将 `current` 链接指回该目录。该操作只更新 `perspecta` Compose 项目，继续复用同一服务端 DeepSeek 配置。

## DeepSeek 真实生成验证

同日用户提供 DeepSeek 密钥后，保留官方模型适配和既有保护设置，重建本项目两个容器，未重建镜像或修改其他项目。

- 公网目录接口均返回 HTTP 200 和 `X-Perspecta-Mode: live`。
- 只执行一次真实 POST：四位嘉宾、四阶段、16 条发言，HTTP 200，端到端 14.34 秒。
- 讨论 ID：`18e57605-54ea-4ca3-a903-e37d344bbd05`。
- 实际用量：输入 4698、输出 2041，总计 6739 tokens；上游 HTTP 200，模型 `deepseek-flash`。未查询余额或账单，未估算费用。
- 既有保护：45 秒上游超时、4500 输出上限、并发 2、来源每分钟 5 次、全局每分钟 20 次、进程 200000 token 预算及 100 次调用上限。进程重启会重置计数，不能当作账户费用硬上限。
- 本次没有付费重试；健康检查只读目录，不生成。两个容器均健康，原有项目容器 ID、启动时间与重启次数再次核对不变。

日常只读健康检查仍可使用上面的 health 命令。`smoke --live` 会产生真实调用，不用于自动健康检查。服务配置只恢复初始模拟模式可使用目录中的 `compose.mock.yaml`，必须同步重新创建本项目 Web 容器以刷新后端连接。生成结果的结构通过不等于人物风格或摘要内容已完成产品验收。
