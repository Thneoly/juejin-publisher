# juejin-publisher

> **掘金没有官方发布 API——这套工具把浏览器能做的，全做成了命令。** 全部口径经真实账号全链路逆向验证（2026-09），并已用它实际发布文章过审。

```
Markdown + frontmatter
   │
   ├─ login ──── CDP 拉起浏览器扫码 ──→ Cookie(≈1年) + 设备uuid 自动收割
   │
   ├─ publish ──→ 建草稿(分类+双标签+摘要) → PIL 生成封面 → CDP 上传
   │              → 挂专栏(column_ids) → 发布 → 审核状态自检
   │
   └─ zhihu ────→ CDP 开写文章页 → 自动填标题 + Markdown→HTML 注入编辑器
                   → 人工点发布（无公开 API，尊重风控）
```

## 两个插件

| 插件 | 是什么 |
|---|---|
| **juejin-publisher** | 发布器本体：掘金 API 全自动 + 知乎 CDP 半自动（`scripts/publish.py`，标准库+websockets+pillow） |
| **article-pipeline** | 配套文章生产线 workflow：材料+主题 → 初稿 → 三路评审 → 修订 → 对抗复审 → 提问与升级清单（发布必过人工门禁） |

## 安装

**方式一：Claude Code 插件市场（推荐）**

```
/plugin marketplace add Thneoly/juejin-publisher
/plugin install juejin-publisher@juejin-publisher
```

**方式二：独立脚本（不依赖 Claude Code）**

```bash
git clone https://github.com/Thneoly/juejin-publisher
cd juejin-publisher && uv sync
cp plugins/juejin-publisher/scripts/publish.py <你的写作目录>/
cd <你的写作目录> && uv add websockets pillow
uv run publish.py login
```

## 快速开始

```bash
uv run publish.py login                 # 扫码：掘金抓 Cookie + 知乎顺手登录
uv run publish.py preview 我的文章.md    # 离线校验：摘要/checklist 剥离/标签映射/URL 门禁
uv run publish.py draft  我的文章.md     # 建草稿（后台核对后再手动发）
uv run publish.py publish 我的文章.md    # 全自动发布 + 审核状态
uv run publish.py status <article_id>   # 0=审核中，1/2=已上线
```

文章格式（frontmatter）：

```yaml
title_zhihu: 知乎版标题
title_juejin: 掘金版标题
description: 50~100 字摘要（掘金硬限制）
category_id: "6809637773935378440"   # 人工智能
tags: "AI,职业发展"                    # 上限 2 个，自动映射到掘金真实标签
```

正文 Markdown；**HTML 注释自动剥离**（内部笔记不外发）；封面不给就 PIL 自动生成 192×128。

## 踩坑速查（这份表格才是本体）

全部真机踩出来的，每一行都值一次调试：

| 现象 | 口径 |
|---|---|
| `SSL: UNEXPECTED_EOF` 重试无效 | 请求缺 `?aid=2608&uuid=<真实设备uuid>`，随机 uuid 被 WAF 掐 TLS；login 自动从浏览器收割真实值 |
| 建草稿返回 `draft_id=0` | 响应里 `article_id` 恒为 `"0"`（未发布语义），真实 ID 在 `data.id`；字符串 `"0"` 是真值，取值顺序会踩坑 |
| 标签解析失败 | 正确接口是 `tag_api/v1/query_tag_list {key_word}`，名字嵌在 `tag.tag_name`；**每篇上限 2 个标签**（err 4031） |
| 发布成功但前台 404、专栏显示空 | `status:0`=审核中，属正常；1/2 才上线；**先看 `audit_status:-1`=驳回（此时 status 仍是 0，别误读）** |
| 审核被按「推广类」驳回 | 正文含招聘平台 URL/域名字符串+薪资数字；**标题含「高薪/招聘」组合同样触发**；正文「招聘语汇×钱数」同段落也触发（「开出高薪招」紧挨营收数字）——publish 的 audit_guard 会预警 |
| 被驳后重发又被秒拒 | 与被驳版本相似度过高的重发会被越来越快地拒（实测第 4 次秒拒）且伤账号信用——实质重写（换标题+全文重措辞+结构重排）+ 隔天错峰；点名上市公司＋负面财务数字也建议匿名化 |
| 专栏挂不上 | 发布体的 `column_ids` 字段；专栏可用 `column-new` 直接建：`column/publish` 无 column_id=新建（data 返回新 id）、带 column_id=更新；`column/delete` 删除；专栏头图 16:9，`column-cover` 自动生成上传 |
| websockets 弃用告警 | v17 要求 connect() 走上下文管理器，直连会告警 |

## article-pipeline：从材料到终稿

```
材料 + 主题
  → ① 撰写（带体例纪律）
  → ② 三路评审并行（锋利度 / 事实与纪律 / 平台文风，schema 强制结构化）
  → ③ 修订（P0/P1 修复，P2 延后）
  → ④ 对抗复审（「修订者可能在糊弄」立场，残留自动打回，最多两轮）
  → ⑤ 提问装置（3 条预埋高赞反对 + 作者必答题）+ 升级清单（事实待核/判断取舍）
  → 人工门禁 → 发布
```

体例纪律外置成 `conventions-default.md`——改这份文件就等于改整条生产线的质量标准。实测：材料里故意埋的三个陷阱（无来源数字、违规 URL、错误措辞）在初稿和评审阶段全部被拦截。

## 边界与声明

- 接口为浏览器抓包逆向所得，无官方文档，平台随时可能变更；**仅供个人内容发布自动化**，控制频率（内置 ≥2.5s 间隔），勿批量营销号式使用
- 知乎无公开 API，工具只做「自动填充 + 人工点发布」
- Cookie/凭据只存本地 `.juejin.env`（已 gitignore），绝不外传

## English Quickstart

A reverse-engineered (fully verified against a real account, Sep 2026) Juejin auto-publisher + Zhihu semi-auto filler for Claude Code, plus an article-pipeline workflow that turns raw material into publish-ready drafts with three-way critique, adversarial re-verification, and a human escalation gate.

```
/plugin marketplace add Thneoly/juejin-publisher
uv run publish.py login && uv run publish.py publish my-post.md
```

Key gotchas documented in the table above (device-uuid WAF quirk, the `article_id:"0"` trap, 2-tag limit, review status machine, promo-class rejection triggers). Python 3.10+, deps: `websockets`, `pillow`.

## License

MIT © Thneonl
