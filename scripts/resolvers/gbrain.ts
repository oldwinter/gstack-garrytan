/**
 * GBrain resolver — 为 thinking skills 提供 brain-first lookup 和 save-to-brain。
 *
 * GBrain 是 gstack 的一个 "mod"。安装后，coding skills 会变成 brain-aware：
 * 开始前搜索 brain 获取 context，结束后保存 results。
 *
 * 在不支持 brain features 的 hosts 上，这些 resolvers 会被 suppressed
 * （通过各 host config 中的 suppressedResolvers）。对这些 hosts，
 * {{GBRAIN_CONTEXT_LOAD}}, {{GBRAIN_SAVE_RESULTS}}, {{BRAIN_PREFLIGHT}},
 * {{BRAIN_CACHE_REFRESH}} 和 {{BRAIN_WRITE_BACK}} 都会 resolve 为空字符串。
 *
 * 兼容 GBrain >= v0.10.0（search CLI、doctor --fast --json、entity enrichment）。
 *
 * Brain-aware planning（T4 / v1.48 plan）：新增三个 resolver，由
 * bin/gstack-brain-cache CLI 和 scripts/brain-cache-spec.ts 驱动。新的
 * resolvers 只对注册在
 * SKILL_DIGEST_SUBSETS (office-hours, plan-ceo-review, plan-eng-review,
 * plan-design-review, plan-devex-review) 中的 5 个 planning skills 触发。
 */
import type { TemplateContext } from './types';
import {
  SKILL_DIGEST_SUBSETS,
  SKILL_CALIBRATION_WEIGHTS,
  BRAIN_CACHE_ENTITIES,
  getSkillSubset,
  getInvalidationTargets,
} from '../brain-cache-spec';

// SAVE_RESULTS 使用的 per-skill slug + title + tag metadata。完整 save
// template（heredoc body、entity-stub instructions、throttle handling、
// backlinks）位于 docs/gbrain-write-surfaces.md §Save Template，由 agent
// 按需读取。压缩 inline prose 可把 token footprint 保持在每个 skill 约 150 tokens
//（从约 500 降低），因此安装了 gbrain 的用户只付出小额 overhead；未安装用户
//（其 hosts 在 gen-time suppressed GBRAIN_SAVE_RESULTS）不付出成本。
interface SkillSaveMeta {
  slugPrefix: string;
  title: string;
  tag: string;
}

const skillSaveMap: Record<string, SkillSaveMeta> = {
  'office-hours':         { slugPrefix: 'office-hours',    title: 'Office Hours',    tag: 'design-doc' },
  'investigate':          { slugPrefix: 'investigations',  title: 'Investigation',   tag: 'investigation' },
  'plan-ceo-review':      { slugPrefix: 'ceo-plans',       title: 'CEO Plan',        tag: 'ceo-plan' },
  'plan-eng-review':      { slugPrefix: 'eng-reviews',     title: 'Eng Review',      tag: 'eng-review' },
  'plan-design-review':   { slugPrefix: 'design-reviews',  title: 'Design Review',   tag: 'design-review' },
  'plan-devex-review':    { slugPrefix: 'devex-reviews',   title: 'Devex Review',    tag: 'devex-review' },
  'retro':                { slugPrefix: 'retros',          title: 'Retro',           tag: 'retro' },
  'ship':                 { slugPrefix: 'releases',        title: 'Release',         tag: 'release' },
  'cso':                  { slugPrefix: 'security-audits', title: 'Security Audit',  tag: 'security-audit' },
  'design-consultation':  { slugPrefix: 'design-systems',  title: 'Design System',   tag: 'design-system' },
};

export function generateGBrainContextLoad(ctx: TemplateContext): string {
  let base = `## Brain Context Load

**如果 \`gbrain\` 不在 PATH 上，跳过整个 section。**

从用户请求中提取 2-4 个 keywords。搜索 brain：
\`gbrain search "<keywords>"\`。用 \`gbrain get_page "<slug>"\`
读取 top 3 results。使用这些 context 支撑你的 analysis。

如果 \`gbrain search\` 没有返回结果，或以任何 non-zero exit 退出，
就不带 brain context 继续。完整 search/read protocol + examples：
见 \`docs/gbrain-write-surfaces.md\` §Context Load。`;

  if (ctx.skillName === 'investigate') {
    base += `\n\n对于 structured-data extraction requests（"track this"、"extract from emails"、"build a tracker"），改为 route 到 GBrain 的 data-research skill：\`gbrain call data-research\`。`;
  }

  return base;
}

export function generateGBrainSaveResults(ctx: TemplateContext): string {
  // gbrain v0.18+ 使用 `gbrain put <slug>`（不是 deprecated `put_page`
  // MCP op）。v1.50.0.0 中压缩：inline heredoc + entity-stub + throttle +
  // backlink prose 已移到 docs/gbrain-write-surfaces.md §Save Template，
  // agent 真正保存时按需读取。这个 compact pointer 让 non-gbrain users 在其
  // host 的 static suppression 被 detection 覆盖时，token overhead 仍接近 0。
  const meta = skillSaveMap[ctx.skillName];

  if (!meta) {
    return `## Save Results to Brain

**如果 \`gbrain\` 不在 PATH 上，跳过整个 section。**

如果 skill output 值得保留，通过
\`gbrain put "<slug>" --content "<frontmatter + markdown>"\` 保存。完整 template
（heredoc body、frontmatter shape、entity-stub instructions、throttle
handling）：见 \`docs/gbrain-write-surfaces.md\` §Save Template。`;
  }

  return `## Save Results to Brain

**如果 \`gbrain\` 不在 PATH 上，跳过整个 section。**

完成此 skill 后，保存 output：

\`\`\`bash
gbrain put "${meta.slugPrefix}/<feature-slug>" --content "$(cat <<'EOF'
---
title: "${meta.title}: <feature name>"
tags: [${meta.tag}, <feature-slug>]
---
<skill output in markdown>
EOF
)"
\`\`\`

然后提取 person/org entities，并为每个 entity 创建 stub pages。
Throttle errors（exit 1 且包含 "throttle"/"rate limit"/"busy"）和任何
其他 non-zero exit 都是 transient；不要 inline retry。完整 entity-stub
template、throttle handling 和 backlink protocol：
见 \`docs/gbrain-write-surfaces.md\` §Save Template。`;
}

// ────────────────────────────────────────────────────────────────────
// Brain-aware planning resolvers（T4 / v1.48 plan）
// ────────────────────────────────────────────────────────────────────

/**
 * 当此 skill 已注册 brain preflight 时返回 true。不在 SKILL_DIGEST_SUBSETS 中的
 * skills 会得到空的 BRAIN_PREFLIGHT block（无行为）。
 */
function isPreflightSkill(skillName: string): boolean {
  return Object.prototype.hasOwnProperty.call(SKILL_DIGEST_SUBSETS, skillName);
}

/**
 * 渲染 per-skill BRAIN_PREFLIGHT block。渲染结果是单个 bash script：
 *   1. 从 gstack-brain-cache get 读取每个 digest file（每个 digest 一次调用）
 *   2. 缺失时 fallback 到 "(brain context unavailable)"
 *   3. 将输出拼接成单个 ## Brain Context block，并注入 skill 的 prompt context
 *   4. 告诉 agent："use this context to skip already-known questions"
 *
 * cache CLI 内部处理 cold-refresh + lock dedup + stale-but-usable fallback。
 * 从 resolver 视角看，每个 digest 只是一个 shell command。
 */
export function generateBrainPreflight(ctx: TemplateContext): string {
  if (!isPreflightSkill(ctx.skillName)) return '';
  const subset = getSkillSubset(ctx.skillName);
  const binDir = ctx.paths.binDir;
  // 构建加载每个 digest 的 bash。Per-skill subset 很小（2-5 entries）。
  const loadLines = subset.map((entityName) => {
    const entity = BRAIN_CACHE_ENTITIES[entityName];
    if (!entity) return '';
    const projectFlag = entity.scope === 'per-project' ? '--project "$SLUG"' : '';
    return `  printf '\\n### %s\\n\\n' "${entityName}"\n  ${binDir}/gstack-brain-cache get ${entityName} ${projectFlag} 2>/dev/null || printf '_(no ${entityName} digest available yet)_\\n'`;
  }).join('\n');

  return `## Brain Context (preflight)

提出任何 clarifying questions 前，加载此 project 的 brain structured context。
cache layer 会自动处理 staleness、refresh 和 stale-but-usable fallback。
如果 loaded context 中已经有答案，就跳过对应 questions；recommendations
要 grounded in brain 已经知道的 user、product、goals 和 recent decisions。

\`\`\`bash
eval "$(${binDir}/gstack-slug 2>/dev/null)" 2>/dev/null || true
{
  printf '## Brain Context\\n\\n'
${loadLines}
} > /tmp/.gstack-brain-context-$$.md 2>/dev/null
[ -s /tmp/.gstack-brain-context-$$.md ] && cat /tmp/.gstack-brain-context-$$.md
rm -f /tmp/.gstack-brain-context-$$.md 2>/dev/null || true
\`\`\`

**如何使用此 context：**
- 如果 \`product\` digest 已说明 value prop、target user 或 stage，不要重复询问。
- 如果 \`goals\` digest 列出了 active goals，基于这些 goals framing recommendations。
- 如果 \`recent-decisions\` digest 提到了既有 scope/architecture choice，而当前 plan 与其冲突，要标记出来。
- 如果 \`user-profile\` digest 带有 calibration pattern statements（"tends to over-engineer security"），在相关时 surfaced。
- 如果某个 digest 是 \`(no X digest available yet)\`，把该 section 当作 cold，询问用户。

**Privacy:** Salience digest 通过 allowlist 过滤（D9 default：仅 \`projects/\`、
\`gstack/\`、\`concepts/\`）。Personal/family/therapy content 永远不会泄漏到这里。
`;
}

/**
 * 渲染 at-skill-end background refresh hook。它在 skill 自身工作完成后触发
 *（telemetry 已记录）；kick 那些 age 超过半个 TTL 但尚未过期的 digest，
 * 让下一次 invocation 获得 fresh cache，且无需支付 cold-miss tax。
 *
 * Subordinate to {{TELEMETRY}} — 在其之后运行。不会 block 用户。
 */
export function generateBrainCacheRefresh(ctx: TemplateContext): string {
  if (!isPreflightSkill(ctx.skillName)) return '';
  const binDir = ctx.paths.binDir;
  return `## Brain Cache Background Refresh

skill 工作完成后（且 telemetry 已记录），为任何接近 TTL 的 cache digest
kick 一次 background refresh。这是 non-blocking；用户无需等待。下一次
invocation 会受益于 warm cache。

\`\`\`bash
eval "$(${binDir}/gstack-slug 2>/dev/null)" 2>/dev/null || true
(${binDir}/gstack-brain-cache refresh --project "$SLUG" 2>/dev/null &) || true
\`\`\`
`;
}

/**
 * 渲染 calibration write-back block。仅当 skill 做出值得记录 kind=bet take
 * 的 typed decisions，且 brain trust policy 是 personal 时才 emit。
 * Phase 2 / E5 cross-skill calibration。
 *
 * 在 resolver output 中由 BRAIN_CALIBRATION_WRITEBACK feature flag gated；
 * 此 flag 在 upstream gbrain ship takes_add MCP op（T8）之前保持 false。
 * flag 翻转后，existing skill templates 会无需 template changes 就获得
 * write-back behavior。
 */
export function generateBrainWriteBack(ctx: TemplateContext): string {
  if (!isPreflightSkill(ctx.skillName)) return '';
  const weight = SKILL_CALIBRATION_WEIGHTS[ctx.skillName];
  if (weight == null) return '';
  // 列出此 skill 写入后应 invalidate 的 cache digests。多个 skills 会写入多个
  // entities；invalidation map 捕获这个关系。
  const invalidatesEntities = getInvalidationTargets(`/${ctx.skillName}`);
  const invalidateBash = invalidatesEntities
    .map((e) => `  ${ctx.paths.binDir}/gstack-brain-cache invalidate ${e} --project "$SLUG" 2>/dev/null || true`)
    .join('\n');

  return `## Brain Calibration Write-Back (Phase 2 / gated)

当 skill 做出值得追踪的 typed prediction（scope decision、TTHW target、
architectural bet、wedge commitment）时，它 MAY 向 brain 写入一个
\`kind=bet\` take，让 calibration profile 随时间建立。

**由两件事 gate：**
1. active endpoint 的 Brain trust policy 是 \`personal\`（通过
   \`${ctx.paths.binDir}/gstack-config get brain_trust_policy@<endpoint-hash>\`).
   Shared brains 会跳过 write-back，以避免污染 team calibration。
2. Feature flag \`BRAIN_CALIBRATION_WRITEBACK\` 已设置（当前：false；当
   upstream gbrain v0.42+ ship \`takes_add\` MCP op 后翻为 true）。

当两个 gates 都通过时，write-back path 使用 \`mcp__gbrain__takes_add\`
记录一个 weight ${weight} 的 take（按 SKILL_CALIBRATION_WEIGHTS）。
如果 MCP op 不可用，fallback 到 \`mcp__gbrain__put_page\`，并带
gstack:takes fence block（有文档，但路径更丑）。

Mandatory take frontmatter shape（必须使用的 take frontmatter 形状）：
\`\`\`yaml
kind: bet
holder: <user identity from whoami>
claim: <one-line prediction the skill is making>
weight: ${weight}
since_date: <today's date>
expected_resolution: <date in 1-3 months depending on skill>
source_skill: ${ctx.skillName}
\`\`\`

写入后，invalidate 受影响的 digests，让下一次 preflight 反映新的 state：

\`\`\`bash
eval "$(${ctx.paths.binDir}/gstack-slug 2>/dev/null)" 2>/dev/null || true
${invalidateBash || '  # (no per-skill invalidation targets configured)'}
\`\`\`
`;
}
