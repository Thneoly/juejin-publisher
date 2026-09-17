---
name: juejin-publisher-pro
description: 掘金全自动发布 + 知乎 CDP 半自动。login 扫码抓 Cookie，publish 一条龙：建稿（分类/双标签/摘要）→ PIL 生成封面并上传 → 挂专栏 → 发布 → 审核状态自检。全部接口口径经真实账号逆向实测（2026-09），含机审驳回避坑。
license: MIT
---

# juejin-publisher-pro 操作手册

零框架依赖（Python 标准库 + websockets + pillow），真机全链路验证：本 skill 的每个接口口径都用真实账号发布过文章并过审。

## 首次配置

1. 把 `scripts/publish.py` 复制到写作项目根目录，`uv add websockets pillow`
2. `uv run publish.py login` ——拉起独立 profile 的 Chrome/Edge：扫码登掘金（自动抓 Cookie 存 `.juejin.env`，实测有效期约 1 年）、顺手扫知乎
3. `uv run publish.py columns --use <id>` 设默认专栏（可选）

## 文章格式（frontmatter 硬性要求）

```yaml
title_zhihu: 知乎版标题
title_juejin: 掘金版标题
description: 50~100 字摘要（掘金接口硬限制，不足拒绝、超限截断）
category_id: "6809637773935378440"   # 人工智能；速查表见 references/category_ids.md
tags: "AI,职业发展"                    # 掘金上限 2 个，自动映射（职业发展→程序员 等）
```

正文 Markdown；**所有 HTML 注释自动剥离**（内部笔记不外发）；封面不给就 PIL 自动生成 192×128。

## 命令速查

| 命令 | 用途 |
|---|---|
| `login` | 扫码抓 Cookie（掘金+知乎），记录设备 uuid |
| `whoami` | 验 Cookie、记 user_id |
| `preview 文章.md` | 离线校验：摘要长度/checklist 剥离/标签映射/URL 门禁 |
| `tags 关键词` | 搜掘金标签 ID |
| `columns` / `--use <id>` | 专栏列表 / 设默认 |
| `draft 文章.md` | 建草稿（分类+双标签+摘要+自动封面） |
| `publish 文章.md` | 全自动：建稿→传封面→挂专栏→发布→报审核状态 |
| `status <article_id>` | 0=审核中（前台 404 属正常），1/2=已上线，audit_status -1=驳回 |
| `zhihu 文章.md` | CDP 开知乎写文章页，自动填标题+注入正文，人工点发布 |
| `cover 文章.md` | 手动补封面 |
| `cleanup` | 关闭 CDP 浏览器堆积的标签（防长期运行卡死；`--all` 连知乎写作页一起清） |

## 踩坑速查（逆向实测，2026-09）

- **请求必须带 `?aid=2608&uuid=<真实设备uuid>`**：随机 uuid 被 WAF 掐 TLS（SSL UNEXPECTED_EOF，重试无效）；login 自动收割真实值
- **建草稿响应 `article_id` 恒为 `"0"`**（未发布语义），真实草稿 ID 在 `data.id`
- **每篇最多 2 个标签**（err 4031）；标签搜索 = `tag_api/v1/query_tag_list {key_word}`，名字嵌在 `tag.tag_name`
- **发布成功 ≠ 上线**：`status 0`=审核中，前台 404、专栏对外空属正常；1/2 才可见
- **机审驳回重灾区「推广类」**：正文含招聘平台 URL/域名字符串+薪资数字会被按招聘广告驳回。url_guard 会警告；修法=URL 降为纯文字（「在 XX 平台搜 YY 可复核」），删旧文重发（实测有效）
- **标题级关键词同样触发**（2026-09-17 实测）：掘金标题含「高薪＋养不住」组合被按推广类驳回（正文干净也拦）——标题用金句钩子，敏感词留在正文（正文低密度实测无碍）
- 接口间隔 ≥2.5 秒防风控（内置）；401/403=Cookie 失效重跑 login

## 伦理边界

仅供个人内容发布自动化。接口为抓包逆向所得、无官方文档，平台可能变更；控制频率，勿批量营销号式发布。
