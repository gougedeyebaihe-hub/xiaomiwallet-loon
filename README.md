# 小米钱包每日任务（Loon 插件版）

将 [xiaomiwallet-auto](https://github.com/gougedeyebaihe-hub/xiaomiwallet-auto)（小米钱包「看视频得会员」每日任务）移植为 Loon 插件。核心逻辑与 Python 原版完全一致（`main.py` / `gui.py` 中的接口 URL、请求参数、设备参数、任务流程均照抄），仅将运行环境从 Python/Flet 换为 Loon 的脚本环境。

**当前版本：1.5.0**

## 文件说明

| 文件 | 说明 |
|---|---|
| `xiaomiwallet.js` | 核心脚本（cron 定时执行 + generic 手动触发，同一文件按状态分派） |
| `xiaomiwallet_status.js` | 账号状态查看脚本（generic 手动触发，通知显示已接入账号数量与 ID） |
| `xiaomiwallet.plugin` | Loon 插件配置（参数 + 脚本声明） |

## 安装

1. 将 `xiaomiwallet.js` 和 `xiaomiwallet.plugin` 放入同一目录（或传到可访问的 URL）
2. Loon → 配置 → 插件 → 添加，填入 `xiaomiwallet.plugin` 的本地路径或远程 URL
3. 在插件参数页填写账号凭证（见下）
4. 启用插件；`cron_time` 修改后需重新加载插件生效

## 获取账号凭证（passToken / userId）

Loon 内无法完成扫码登录，需在原 Python 项目里获取一次凭证（凭证长期有效，过期后重新获取即可）：

**方式一：跑原项目 login.py（推荐）**

```bash
git clone https://github.com/gougedeyebaihe-hub/xiaomiwallet-auto.git
cd xiaomiwallet-auto
pip install qrcode requests
python3 login.py 你的账号别名   # 终端显示二维码，用小米手机 App 扫码
```

完成后打开 `xiaomiconfig.json`，取 `data.userId` 和 `data.passToken` 填入插件参数。

**方式二：已有 xiaomiconfig.json**

直接从中提取 `userId` / `passToken` 填入即可。

**多账号**：`pass_token` 和 `user_id` 用 `|` 分隔，两组数量必须一致，按顺序一一对应，例如：

```
pass_token = tokenA|tokenB
user_id = 10001|10002
```

## 参数说明

| 参数 | 默认 | 说明 |
|---|---|---|
| `pass_token` | 空 | 账号长期凭证，多账号 `|` 分隔 |
| `user_id` | 空 | 账号 ID，与 pass_token 一一对应 |
| `watch_mode` | auto | `auto`：脚本自动等待广告时长后提交；`manual`：发通知提醒，看完后手动触发提交 |
| `browse_seconds` | 30 | auto 模式广告等待时长（5-120 秒），实际等待在 ±10 秒内随机 |
| `cron_time` | `30 8 * * *` | 每日执行时间（cron 格式），改后需重载插件 |

## 使用方式

### auto 模式（全自动）

每天到点后脚本自动执行：登录换 Cookie → 查询任务 → 等待广告时长 → 提交任务 → 领取奖励，最后推送结果通知（通知副标题会显示本次执行的账号数）。也可以随时手动触发 `小米钱包手动提交` 立即执行一次（用于测试）。

### 代理指向的策略

插件 `[Rule]` 中使用 `PROXY` 策略，Loon 会在**插件详情页显示「代理指向的策略」块**：点击框（默认 `PROXY`）跳转到策略选择页，可把 PROXY 映射到策略组或内置策略（直连 / 节点 / Auto 等）。

- 脚本每次运行时读取该映射（`$config.getConfig()` 的 `policy_select`），**任务请求自动跟随你选择的策略**——想直连选 DIRECT，想走代理选节点，无需改插件
- 优先级：从节点/策略组入口触发脚本（官方 generic 机制）> 代理指向的策略 > 默认 `DIRECT` 直连
- 规则用的是保留域名（`xiaomiwallet-task.invalid`），不会产生真实流量
- 风控提醒：走代理时出站 IP 为节点 IP，可能被小米风控识别为机房/异常 IP，建议小号验证

### 查看已接入的账号

手动触发 `小米钱包账号状态`，结果打印在 **Loon 日志**（带 `[小米钱包]` 前缀，不弹通知）：显示当前配置了几个账号、每个账号的 ID 和观看模式；未配置或 token/ID 数量不一致时也会提示。

### manual 模式（手动看完后确认）

原版 manual 模式是终端里按回车确认，Loon 里改成两段式（generic 脚本在 Loon 内手动触发，官方文档定义："在 App 中手动触发，可将节点、策略组或规则作为上下文传给脚本"）：

1. cron 到点后，脚本发通知「请打开小米钱包观看视频任务广告」
2. 你在小米钱包里把广告/视频完整看完
3. 返回 Loon，手动触发 `小米钱包手动提交`，脚本提交任务并领奖
4. 若当天还有第二轮浏览任务，会再次提醒，重复 2-3 步

**请求策略**：任务请求默认 `DIRECT` 直连（出站 IP 为手机当前网络 IP，相当于本地运行，风控最安全）。如果从 Loon 的节点/策略组入口触发该脚本（官方 generic 机制，见 [generic_example.js](https://github.com/Loon0x00/LoonExampleConfig/blob/master/Script/generic_example.js)），本次任务请求自动使用被点击的策略组。

## 实现细节（与原版一致）

- 接口全部请求 `m.jr.airstarfinance.net`（活动 `2211-videoWelfare`）：`getTaskList`(POST) / `getTask` / `completeTask` / `luckDraw` / `queryUserGoldRichSum` / `queryUserJoinList`
- 每次运行用 `passToken` + `userId` 访问 `account.xiaomi.com/pass/serviceLogin` 逐跳跟随 302，换取 `cUserId` + `jrairstar_serviceToken` 会话 Cookie
- 每个账号持久化一套固定设备参数（oaid/imei/androidId/regId 随机生成，device/model 固定 M2012K11AC，`jrairstar_ph` 固定值），重启后不变，避免多账号共用设备指纹
- 所有请求默认 **`DIRECT` 直连**（出站 IP 为手机当前网络 IP，相当于本地运行；从节点/策略组入口触发 generic 时自动跟随被点击的策略）。原版 README 明确警告服务器/机房 IP 会被风控
- 任务接口使用小米钱包移动端 UA，登录使用桌面 UA

## 风险与限制

- **接口有风控，可能封号**（原版 README 原话：`code 110005` 或直接封号，本质是小米新增服务端风控）。请务必先用小号测试，不要拿主账号跑
- 默认 `DIRECT` 直连（出站 IP 为手机当前网络 IP，相当于本地运行）。**若从节点/策略组入口触发脚本走代理，出站 IP 变为节点 IP，被风控识别为机房/异常 IP 的风险自负**
- 若接口风控升级导致失效（`110005` 等），需要按原项目 [CAPTURE_GUIDE.md](https://github.com/gougedeyebaihe-hub/xiaomiwallet-auto/blob/main/CAPTURE_GUIDE.md) 抓包更新脚本中的接口参数
- `passToken` 过期后任务会失败（通知提示），需重新执行原项目 login.py 更新参数
- manual 模式为「通知提醒 + 手动触发」两段式，与原版终端回车体验不同
- 登录换取 Cookie 依赖逐跳解析 302 响应头；Loon 的 `$httpClient` 支持 `auto-cookie` 参数（Build 662+，默认开启）自动管理 Cookie，若手动解析异常可作为排查备选；若问题依旧请查看脚本日志（Loon → 日志）后反馈

## 免责声明

本插件仅用于个人学习与技术研究。小米官方接口可能随时变化，不保证长期可用；使用本插件造成的账号异常或封禁等风险由使用者自行承担。
