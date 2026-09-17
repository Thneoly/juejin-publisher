---
name: article-pipeline
description: 文章生产线：输入材料+主题，自动完成撰写→三路评审（锋利度/事实纪律/平台文风）→修订→对抗复审→提问与升级清单。当用户要"写文章/产出一篇/批量生产内容"时使用。
---

# article-pipeline：把「材料 + 主题」变成可发布的终稿

六个阶段对应六个动词：**撰写、校对、纠正、提问、升级、发布**。发布永远经过人工门禁。

## 输入（向用户要齐，缺哪问哪）

- **材料**：文件路径（调研笔记/事实库/文档节选均可）
- **主题**：一句话命题 + 立场
- **workdir**：写作项目根目录（产物落在 `<workdir>/_wf/pipeline/<slug>/`）
- **定位**：目标平台（掘金/知乎/其他）、目标字数（默认 4500~5500）
- **体例纪律文件**：默认用本插件自带 `conventions-default.md`（事实标注版）；技术博客向可换 `conventions-tech-blog.md`（平台文风基线版）；用户有自己的写作规范就用自己的

## 运行

调用 Workflow 工具执行本插件的 `workflows/article-pipeline.js`：

```
args: {
  slug: "文章短名",
  topic: "一句话命题——立场",
  material: "<材料绝对路径>",
  workdir: "<写作项目根目录绝对路径>",
  style_ref: "<可选：风格参考文章路径>",
  length: "<可选：目标字数>",
  conventions: "<体例纪律文件绝对路径>"
}
```

产物：`<workdir>/_wf/pipeline/<slug>/draft.md`（终稿）+ 结构化报告（评审发现数/已修/延后/预埋反对/升级清单）。

## 升级门禁（workflow 结束后必停，向用户呈现三样东西）

1. **事实待核清单**：每条带核验建议（搜什么关键词、一手信源长什么样）；能代核的用 WebSearch/webReader 亲自核，核完回填并升/降来源标注档位
2. **判断取舍项**：标题分叉、断言强度、案例去留——必须作者拍板
3. **发布前用户项**：封面、时点、运营动作

用户点头后才进入发布。配 juejin-publisher 插件即可一键 `preview → publish → status`；其他平台用对应工具。

## 设计原则

- workflow 只做**确定性编排**（阶段、循环、门禁）；写作与评审交给 agent
- 评审是三路**异构视角**（锋利度/事实与纪律/平台文风），互不通气，各自带 schema 强制结构化输出
- 复审是**对抗性**的（立场=「修订者可能在糊弄」），残留问题自动打回修订，最多两轮
- 提问装置（预埋反对+作者必答题）和升级清单是标配产物——一个防评论区，一个防自嗨

## 批量生产模式（实战沉淀）

单篇走 `workflows/article-pipeline.js`；批量按「并行写 → 分批评审 → 定向修复 → **逐日发布**」：

1. **并行写初稿**：所有文章同时写（每篇 1 个 agent，`parallel()`）；每篇要 slug（文件名）/ topic（一句话命题）/ material（素材路径）
2. **分批评审**：每批 3 篇跑完整 pipeline（三路评审并行 → 修订 → 对抗复审）
3. **NEEDS_WORK 修复**：复审不过的派修复 agent 按遗留清单逐条修，不重跑全流程
4. **发布**：每篇加 frontmatter → `publish.py preview` 批量校验 → 逐日逐篇 publish（见下）

实测（9 篇 × 完整流水线）：54 个 agent、约 2 小时（含修复轮）；评审共发现 206 个问题；5 篇一轮 PASS、4 篇 NEEDS_WORK → 修复后全部可发。

## 与 juejin-publisher 的集成

```
article-pipeline 产出 draft.md
    ↓ 加 frontmatter（title_juejin/description/category_id/tags）
    ↓ publish.py preview（离线校验）
    ↓ publish.py columns --use <专栏ID>（切换目标专栏）
    ↓ publish.py publish（全自动：封面/标签/专栏/发布/审核状态）
```

注意：`column_id` 写在 frontmatter 里**无效**（publish.py 不读取），必须用 `columns --use` 预设。

## ⚠️ 发布纪律

批量精修没问题，**发布必须逐日逐篇**——产出先存 workdir（如 `_wf/pipeline/`），每天取 1 篇手动/定时发布。**Pipeline 产 ≠ 立刻发**：上游批量精修、下游逐日发布，是两个独立节奏。节奏表见 juejin-publisher SKILL.md 的「发布纪律」。
