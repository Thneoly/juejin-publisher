export const meta = {
  name: 'article-pipeline',
  description: '材料+主题 → 初稿 → 三路评审 → 修订 → 对抗复审 → 提问与升级清单（不自动发布）',
  phases: [
    { title: '初稿', detail: '读材料与体例纪律，写出带 frontmatter 的初稿' },
    { title: '三路评审', detail: '锋利度 / 事实与纪律 / 平台文风 并行找问题' },
    { title: '修订', detail: '按 P0/P1 修复，P2 进延后清单' },
    { title: '复审', detail: '对抗验证：修复是否落地、有无新违规（最多两轮）' },
    { title: '提问与升级', detail: '预埋反对+作者问题 | 事实待核+判断取舍清单' },
  ],
}

const args_ = args || {}
const slug = args_.slug
const topic = args_.topic
const material = args_.material
const workdir = args_.workdir
const conventions = args_.conventions
const styleRef = args_.style_ref || material
const length = args_.length || '4500~5500 字'
if (!slug || !topic || !material || !workdir || !conventions) {
  throw new Error('args 需要 slug / topic / material / workdir / conventions')
}
const dir = `${workdir}/_wf/pipeline/${slug}`

const CONV = `【体例纪律文件——先完整阅读，它是评审与写作的唯一标尺】：${conventions}`

const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    path: { type: 'string' },
    thesis: { type: 'string', description: '一句话核心判断' },
    word_count: { type: 'number' },
    title_juejin: { type: 'string' },
    title_zhihu: { type: 'string' },
  },
  required: ['path', 'thesis', 'word_count'],
}

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          priority: { type: 'string', enum: ['P0', 'P1', 'P2'] },
          location: { type: 'string', description: '小节/引文定位' },
          issue: { type: 'string' },
          fix: { type: 'string', description: '可直接执行的修法' },
        },
        required: ['priority', 'location', 'issue', 'fix'],
      },
    },
  },
  required: ['findings'],
}

const REVISE_SCHEMA = {
  type: 'object',
  properties: {
    path: { type: 'string' },
    applied: { type: 'number', description: '已修复的 P0/P1 条数' },
    deferred: { type: 'array', items: { type: 'string' }, description: '延后未修的 P2 及理由' },
  },
  required: ['path', 'applied', 'deferred'],
}

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    pass: { type: 'boolean' },
    residuals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          priority: { type: 'string', enum: ['P0', 'P1'] },
          location: { type: 'string' },
          issue: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['priority', 'location', 'issue', 'fix'],
      },
    },
  },
  required: ['pass', 'residuals'],
}

const QUESTIONS_SCHEMA = {
  type: 'object',
  properties: {
    reader_opposition: {
      type: 'array',
      items: {
        type: 'object',
        properties: { objection: { type: 'string' }, response: { type: 'string' } },
        required: ['objection', 'response'],
      },
    },
    author_questions: { type: 'array', items: { type: 'string' } },
    cta: { type: 'string' },
  },
  required: ['reader_opposition', 'author_questions', 'cta'],
}

const ESCALATE_SCHEMA = {
  type: 'object',
  properties: {
    facts_to_verify: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string' },
          suggestion: { type: 'string', description: '怎么核：搜什么关键词、信源长什么样' },
        },
        required: ['claim', 'suggestion'],
      },
    },
    judgment_calls: { type: 'array', items: { type: 'string' } },
    user_side_items: { type: 'array', items: { type: 'string' } },
  },
  required: ['facts_to_verify', 'judgment_calls', 'user_side_items'],
}

// ─────────────────────────────────────────────────────────── 流程

phase('初稿')
log(`主题：${topic}`)
const draft = await agent(`你是观点鲜明的作者型编辑，文风：判断直接、禁正确的废话。

任务：基于材料写一篇博客终稿。
- 主题：${topic}
- 材料（先完整阅读）：${material}
- 风格参考（读它的结构感与语气，不抄内容）：${styleRef}
- 目标长度：${length}
- 输出目录：${dir}/draft.md（目录建好，含 frontmatter）
${CONV}

要求：
1. 材料里的事实逐条按体例纪律标注来源档——材料自带出处的用之；没出处又不删的必须标【从业者判断】
2. 引用任何规范文档的判据时逐字保真
3. 你的最终产物是落盘文件；返回结构化摘要即可`,
  { label: 'draft', phase: '初稿', schema: DRAFT_SCHEMA })
if (!draft) throw new Error('初稿 agent 失败')
log(`初稿完成：${draft.word_count} 字｜${draft.thesis}`)

phase('三路评审')
const critics = [
  { key: 'sharpness', name: '锋利度', focus: `判断是否鲜明（每节有一句可被引用的判断句）；开头 3 行是否有钩子；有无「正确的废话」（删掉不影响论证的段落）；预埋的高赞反对是否至少两条且给了回应；金句是否可脱离正文传播` },
  { key: 'facts', name: '事实与纪律', focus: `逐条核对来源标注四档+时点；数字是否裸引；引用文档判据是否逐字；有无 URL/域名字符串（按体例纪律判定严重级）；构造案例有无标注` },
  { key: 'style', name: '平台文风', focus: `frontmatter（description 50~100 字硬性、tags 数量与映射）；加粗 ≤30 字；移动端短段；双平台标题分工是否成立；结尾 CTA 是否给了读者可参与的行动` },
]
const reviews = await parallel(critics.map(c => () => agent(`你是苛刻的评审官【${c.name}】，评审对象：${dir}/draft.md（先读全文）。

只查这类问题：${c.focus}
${CONV}

规则：只报真问题不凑数；每条给可直接执行的修法；P0=违反体例纪律或事实错误，P1=明显削弱文章，P2=可改可不改。你的返回值是结构化 findings，不是给人看的散文。`,
  { label: `critique:${c.key}`, phase: '三路评审', schema: FINDINGS_SCHEMA })))
const findings = reviews.filter(Boolean).flatMap(r => r.findings)
const n0 = findings.filter(f => f.priority === 'P0').length
log(`评审发现 ${findings.length} 条（P0 ${n0} / P1 ${findings.filter(f => f.priority === 'P1').length} / P2 ${findings.filter(f => f.priority === 'P2').length}）`)

async function revise(residualList, tag) {
  return await agent(`你是执行修订的编辑。对象：${dir}/draft.md（先读全文）。

要修的问题清单（JSON）：
${JSON.stringify(residualList, null, 1)}

规则：P0/P1 逐条修复（直接编辑 draft.md）；修不动的或属于作者判断取舍的，放进 deferred 并说明；不许引入新的违规。${CONV}
返回结构化摘要。`,
    { label: `revise:${tag}`, phase: '修订', schema: REVISE_SCHEMA })
}

phase('修订')
let report = await revise(findings, 'r1')
if (!report) throw new Error('修订 agent 失败')
log(`修订完成：修复 ${report.applied} 条，延后 ${(report.deferred || []).length} 条`)

let verify = null
for (let round = 1; round <= 2; round++) {
  phase('复审')
  verify = await agent(`你是对抗性复审员，立场是「修订者可能在糊弄」。对象：${dir}/draft.md（先读全文）。

上一轮问题清单（JSON）：
${JSON.stringify(findings, null, 1)}

逐条核验：①每条 P0/P1 是否真修了（不是嘴上说修了）②全篇扫新违规（对照体例纪律逐条）。
全干净才 pass=true；有残留就逐条列出（带修法）。${CONV}`,
    { label: `verify:${round}`, phase: '复审', schema: VERIFY_SCHEMA })
  if (!verify) throw new Error('复审 agent 失败')
  log(`复审第 ${round} 轮：${verify.pass ? '通过' : `残留 ${verify.residuals.length} 条`}`)
  if (verify.pass) break
  if (round < 2) {
    phase('修订')
    report = await revise(verify.residuals, `r${round + 1}`)
    if (!report) throw new Error(`第 ${round + 1} 轮修订失败`)
  }
}

phase('提问与升级')
const [questions, escalations] = await parallel([
  () => agent(`读 ${dir}/draft.md，为它配「提问装置」：
1. reader_opposition：3 条评论区最可能出现的高赞反对 + 文中已有的回应（或应补的回应，标出来）
2. author_questions：2~4 条必须由作者本人拍板的问题（口径取舍、案例去留、断言强度）
3. cta：一句收尾 CTA，给读者一个可参与的行动`,
    { label: 'questions', phase: '提问与升级', schema: QUESTIONS_SCHEMA }),
  () => agent(`读 ${dir}/draft.md，产出「升级清单」（给人看的决策材料）：
1. facts_to_verify：文中所有值得人工核验的事实性数字/引语——每条给核验建议（搜什么关键词、一手信源长什么样、核到后标注升档还是降档）
2. judgment_calls：无法自动决策的取舍项（标题、删弱论据、敏感措辞、断言强度）
3. user_side_items：发布前需用户动手的事（封面偏好、发布时点、平台运营动作）
宁可多列不可漏列。`,
    { label: 'escalations', phase: '提问与升级', schema: ESCALATE_SCHEMA }),
])

return {
  slug,
  dir,
  draft: { thesis: draft.thesis, word_count: draft.word_count, title_juejin: draft.title_juejin, title_zhihu: draft.title_zhihu },
  review_stats: { total: findings.length, p0: n0, applied: report ? report.applied : 0, deferred: report ? report.deferred : [] },
  verify_pass: verify ? verify.pass : false,
  verify_residuals: verify ? verify.residuals : [],
  questions: questions || null,
  escalations: escalations || null,
  final_path: `${dir}/draft.md`,
  next: '升级清单过人 → 用发布插件/工具执行（发布必须用户点头）',
}
