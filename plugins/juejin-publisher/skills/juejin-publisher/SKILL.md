---
name: juejin-publisher
description: 把 Markdown 文章自动发布到掘金（API 全自动：分类/标签/摘要/封面/专栏/审核状态）和知乎（CDP 半自动）。当用户要"发文章到掘金/知乎、建草稿、查审核状态、配置掘金专栏"时使用。
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
| `draft 文章.md` | 建草稿（分类+双标签+摘要+自动封面），后台核对后手动发 |
| `publish 文章.md` | 全自动：建稿→传封面→挂专栏→发布→报审核状态（`--no-column` `--no-cover` 可关） |
| `status <article_id>` | 查审核：0=审核中（前台 404 属正常），1/2=已上线；audit_status -1=驳回 |
| `zhihu 文章.md` | CDP 开知乎写文章页，自动填标题+注入正文（Markdown→HTML），人工点发布 |
| `cover 文章.md` | 手动补封面（PIL 生成+CDP 上传） |
| `cleanup` | 关闭 CDP 浏览器堆积的标签（防长期运行卡死；`--all` 连知乎写作页一起清） |

## 踩坑速查（逆向实测，2026-09）

- **请求必须带 `?aid=2608&uuid=<真实设备uuid>`**：随机 uuid 会被 WAF 直接掐 TLS 连接（表现为 SSL: UNEXPECTED_EOF）。login 会自动从浏览器请求收割
- **建草稿响应里 `article_id` 恒为 `"0"`**（未发布语义），真实草稿 ID 在 `data.id`
- **每篇最多 2 个标签**（err 4031）；标签搜索接口是 `tag_api/v1/query_tag_list {key_word}`，名字嵌在 `tag.tag_name`
- **发布成功 ≠ 上线**：掘金先机审。`status 0` 时前台 404、专栏对外显示空——属正常，过审自动可见
- **机审驳回重灾区「推广类」**：正文含招聘平台 URL/域名字符串 + 薪资数字会被按招聘推广驳回。preview/publish 的 url_guard 会警告；修法=把 URL 降为纯文字（「在 XX 平台搜 YY 可复核」），删旧文重发
- 接口间隔 ≥2.5 秒防风控（已内置）；401/403 = Cookie 失效，重跑 login
- 知乎无公开 API：走 CDP 页面注入（独立浏览器 profile，不动日常 Chrome）

## 伦理边界

仅供个人内容发布自动化。接口为浏览器抓包逆向所得，无官方文档，平台随时可能变更；控制频率、不要批量营销号式发布。
