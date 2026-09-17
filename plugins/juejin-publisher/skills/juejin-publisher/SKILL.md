---
name: juejin-publisher
description: 把 Markdown 文章自动发布到掘金（API 全自动：分类/标签/摘要/封面/专栏/审核状态/建专栏/专栏封面）和知乎（CDP 半自动）。当用户要"发文章到掘金/知乎、建草稿、查审核状态、新建或配置掘金专栏"时使用。
---

# juejin-publisher 操作手册

零依赖思维、真机全链路验证过的掘金发布器。核心脚本：`scripts/publish.py`（标准库 + websockets + pillow）。

## 首次配置（对用户说的话）

1. 把 `scripts/publish.py` 复制到用户的写作项目根目录（或直接在本插件目录用）
2. `uv add websockets pillow`（或 pip install）
3. `uv run publish.py login` ——会拉起一个独立 profile 的 Chrome/Edge：扫码登掘金（自动抓 Cookie 存 `.juejin.env`，实测有效期约 1 年）、顺手扫知乎（zhihu 命令依赖）
4. `uv run publish.py columns --use <id>` 设默认专栏（可选，不设则发布不挂专栏）

## 文章格式（frontmatter 硬性要求）

```yaml
title_zhihu: 知乎版标题
title_juejin: 掘金版标题
description: 50~100 字摘要（掘金接口硬限制，不足拒绝、超限截断）
category_id: "6809637773935378440"   # 人工智能；后端 6809637769959178254；前端 6809637767543259144
tags: "AI,职业发展"                    # 掘金上限 2 个，自动映射（见下）
# cover: https://...（可选，封面图 URL；不给则 PIL 自动生成 192×128）
```

正文为 Markdown；**所有 HTML 注释会被剥离**（内部笔记不外发）。

标签映射（掘金标签库有限）：职业发展→程序员、求职面试→面试、企业管理→团队管理、系统架构→架构、行业观察/转型→程序员、AI→人工智能；不存在的丢弃，只解析到一个时自动补「人工智能」。

## 命令速查

| 命令 | 用途 |
|---|---|
| `login` | 扫码抓 Cookie（掘金+知乎），记录设备 uuid |
| `whoami` | 验 Cookie、记 user_id |
| `preview 文章.md` | 离线校验：摘要长度/checklist 剥离/标签映射/URL 门禁 |
| `tags 关键词` | 搜掘金标签 ID |
| `columns` / `columns --use <id>` | 专栏列表 / 设默认 |
| `column-new 标题` | 新建专栏（纯 API），`--intro 简介` `--use` 建完设为默认 |
| `column-cover` | 专栏上 PIL 封面（16:9，1280×720），`--column <id>` 指定、`--subtitle` 副标题 |
| `draft 文章.md` | 建草稿（分类+双标签+摘要+自动封面），后台核对后手动发 |
| `publish 文章.md` | 全自动：建稿→传封面→挂专栏→发布→报审核状态（`--no-column` `--no-cover` 可关） |
| `status <article_id>` | 查审核：audit_status -1=已驳回（此时 status 仍是 0，别误读）；status 0=审核中（前台 404 属正常），1/2=已上线 |
| `zhihu 文章.md` | CDP 开知乎写文章页，自动填标题+注入正文（Markdown→HTML），人工点发布；`--auto` 连发布也自动点 |
| `cover 文章.md` | 手动补封面（PIL 生成+CDP 上传） |
| `cleanup` | 关闭 CDP 浏览器堆积的标签（防长期运行卡死；`--all` 连知乎写作页一起清） |

## 踩坑速查（逆向实测，2026-09）

- **请求必须带 `?aid=2608&uuid=<真实设备uuid>`**：随机 uuid 会被 WAF 直接掐 TLS 连接（表现为 SSL: UNEXPECTED_EOF）。login 会自动从浏览器请求收割
- **建草稿响应里 `article_id` 恒为 `"0"`**（未发布语义），真实草稿 ID 在 `data.id`
- **每篇最多 2 个标签**（err 4031）；标签搜索接口是 `tag_api/v1/query_tag_list {key_word}`，名字嵌在 `tag.tag_name`
- **发布成功 ≠ 上线**：掘金先机审。`status 0` 时前台 404、专栏对外显示空——属正常，过审自动可见
- **机审驳回重灾区「推广类」**：正文含招聘平台 URL/域名字符串 + 薪资数字会被按招聘推广驳回。preview/publish 的 url_guard 会警告；修法=把 URL 降为纯文字（「在 XX 平台搜 YY 可复核」），删旧文重发
- **标题级关键词同样触发**（2026-09-17 实测）：掘金标题含「高薪＋养不住」组合被按推广类驳回（正文干净也拦）——标题用金句钩子
- **正文里「招聘语汇×钱数」同段落也是雷**（2026-09-17 辩七实测）：正文「开出高薪招」紧挨着营收数字同样被驳——改写参考：高薪招→真金白银请、招聘预算→预算、求职者→看机会的读者。publish 的 audit_guard 会预警
- **被驳后别反复重发相似内容**（辩七四连驳回实测）：与被驳版本相似度极高的重发会被越来越快地拒（第 4 次秒拒），且伤账号信用——要改就实质重写（换标题+全文重新措辞+结构重排），隔天错峰再发
- **点名上市公司＋负面财务数字慎写**（推断雷区）：唱空具体公司的亏损/市值/撤材料等数字易触发财经类审核，匿名化（「CV 四小龙之一的某算法上市公司」）保留数字与出处更稳
- **审核状态先看 audit_status 再看 status**：驳回的文章 status 仍是 0（审核中假象），只有 audit_status=-1 才是驳回
- **专栏 API**：`column/publish` 无 column_id=新建（data 返回新 id）、带 column_id=更新（title/content/cover）；`column/delete {column_id}` 删除。专栏头图 16:9（源图 1920×1080），column-cover 按 1280×720 生成
- 接口间隔 ≥2.5 秒防风控（已内置）；401/403 = Cookie 失效，重跑 login
- 知乎无公开 API：走 CDP 页面注入（独立浏览器 profile，不动日常 Chrome）。**发布可一键直发**（2026-09-18 实测）：知乎记住此前的创作声明等设置，点「发布」不弹设置弹窗直接成功——`zhihu --auto` 即全自动；新环境首次发布可能弹创作声明弹窗，工具会检测到并提示人工补选。封面预览探针在 /edit 态常误报「未见预览」，以浏览器实际显示/发布后 og:image 为准

## 发布纪律（批量内容必读，真实事故沉淀）

**不要一次性发布多篇文章。** 2026-09 实测：一次性发 9 篇到 3 个专栏 → 只能全部删除重来。

- 平台算法不会同时推荐多篇文章，批量发 = 每篇的曝光都被稀释
- 短时间大量发布触发营销号画像，影响账号信用
- 已发文章无法事后挂进专栏，只能删除重发（伤数据）

节奏建议：

| 指标 | 建议 |
|---|---|
| 每日发布量 | 1 篇（最多 2 篇且分属不同专栏） |
| 同专栏间隔 | ≥2 天 |
| 发布时段 | 工作日 20:00-22:00（通勤后高峰） |
| 首周节奏 | 先发 1 篇观察数据，确认审核/曝光正常再继续 |

定时发布：cron / Windows 计划任务每天触发一条 publish 命令，或 Claude Code 的 CronCreate。批量产出先落盘，逐日取 1 篇发。

## 定时发布模式（Windows + Python，无需 Claude 在线）

要「每天固定时间自动发一篇」？用 Windows 计划任务 + 纯 Python 驱动（确定性逻辑，不花 token）：

1. 把 `scripts/auto_publish.py` 和 `scripts/auto_publish.bat` 复制到项目根目录，bat 里的 `cd` 改成项目路径
2. 建计划任务（Git Bash 里命令要加 `MSYS_NO_PATHCONV=1` 前缀，否则 `/create` 被转成路径）：
   ```
   schtasks /create /tn "Blog_morning" /tr "D:\your\blog\auto_publish.bat" /sc daily /st 09:15
   ```
3. 驱动逻辑：自然排序 `posts/*.md`（第9辩 < 第10辩）→ 按掘金标题去重 → 发第一篇未发布的
4. 护栏（内置）：每日上限（默认 2）/ 距最近一篇 ≥1 小时 / 队列发完自动注销 `--task-names` 列出的任务
5. 一次性补发用 `--only 文件.md`；日志在 `_wf/auto_publish.log`

**实测坑（2026-09）**：Claude 内置 CronCreate 只在 REPL 打开且空闲时触发，不适合无人值守——用 OS 级计划任务；**驱动没有干跑模式，跑一次就是真发一次**；Cookie 过期驱动日志会记 401/403，重跑 `login`；`ctime` 是字符串要 `float()`。

## 伦理边界

仅供个人内容发布自动化。接口为浏览器抓包逆向所得，无官方文档，平台随时可能变更；控制频率、不要批量营销号式发布。
