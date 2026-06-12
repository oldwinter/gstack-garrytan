#!/usr/bin/env bun
/**
 * 从 .tmpl templates 生成 SKILL.md files。
 *
 * Pipeline:
 *   read .tmpl → find {{PLACEHOLDERS}} → resolve from source → format → write .md
 *
 * 支持 --dry-run：生成到 memory；如果和 committed file 不同则 exit 1。
 * 供 skill:check 和 CI freshness checks 使用。
 */

import { COMMAND_DESCRIPTIONS } from '../browse/src/commands';
import { SNAPSHOT_FLAGS } from '../browse/src/snapshot';
import { discoverTemplates, discoverSectionTemplates } from './discover-skills';
import { writeLlmsTxt } from './gen-llms-txt';
import * as fs from 'fs';
import * as path from 'path';
import type { Host, TemplateContext } from './resolvers/types';
import { HOST_PATHS, unwrapResolver } from './resolvers/types';
import { RESOLVERS } from './resolvers/index';
import { externalSkillName, extractHookSafetyProse as _extractHookSafetyProse, extractNameAndDescription as _extractNameAndDescription, condenseOpenAIShortDescription as _condenseOpenAIShortDescription, generateOpenAIYaml as _generateOpenAIYaml } from './resolvers/codex-helpers';
import { generatePlanCompletionAuditShip, generatePlanCompletionAuditReview, generatePlanVerificationExec } from './resolvers/review';
import { ALL_HOST_CONFIGS, ALL_HOST_NAMES, resolveHostArg, getHostConfig } from '../hosts/index';
import type { HostConfig } from './host-config';

const ROOT = path.resolve(import.meta.dir, '..');
const DRY_RUN = process.argv.includes('--dry-run');

// ─── GBrain Detection Override ──────────────────────────────
// 传入 --respect-detection 时，读取 ~/.gstack/gbrain-detection.json，
// 并对静态 suppress GBRAIN_CONTEXT_LOAD + GBRAIN_SAVE_RESULTS 的 hosts
//（claude、codex、slate、factory、opencode、openclaw、cursor、kiro）
// 取消 suppress。Detection state 由 bin/gstack-gbrain-detect 生成，并由
// `gstack-config gbrain-refresh` 或 ./setup 持久化。
//
// 默认（无 flag）：按原样尊重 static suppressedResolvers。`bun run gen:skill-docs`
//（CI + canonical checked-in SKILL.md files）使用此模式，因此无论开发者本机
// gbrain installation state 如何，committed output 都 reproducible。user-local
// installs 使用 `bun run gen:skill-docs:user`（会添加 --respect-detection）。
const RESPECT_DETECTION = process.argv.includes('--respect-detection');

function loadGbrainOverride(): { detected: boolean } {
  if (!RESPECT_DETECTION) return { detected: false };
  const stateDir = process.env.GSTACK_HOME || path.join(process.env.HOME || '', '.gstack');
  const detectionPath = path.join(stateDir, 'gbrain-detection.json');
  try {
    const json = JSON.parse(fs.readFileSync(detectionPath, 'utf-8')) as { gbrain_local_status?: string };
    return { detected: json.gbrain_local_status === 'ok' };
  } catch {
    return { detected: false };
  }
}

const GBRAIN_OVERRIDE = loadGbrainOverride();

/**
 * 计算某个 host 的 effective suppressedResolvers，并在启用时应用 gbrain
 * detection override。override 触发时，GBRAIN_* resolvers 会从 suppression
 * set 中移除，以便渲染进 generated SKILL.md。
 */
function effectiveSuppressedResolvers(hostConfig: HostConfig): Set<string> {
  let list = hostConfig.suppressedResolvers || [];
  if (GBRAIN_OVERRIDE.detected) {
    list = list.filter(r => r !== 'GBRAIN_CONTEXT_LOAD' && r !== 'GBRAIN_SAVE_RESULTS');
  }
  return new Set(list);
}

// ─── Host Detection (config-driven) ─────────────────────────

const HOST_ARG = process.argv.find(a => a.startsWith('--host'));
type HostArg = Host | 'all';
const HOST_ARG_VAL: HostArg = (() => {
  if (!HOST_ARG) return 'claude';
  const val = HOST_ARG.includes('=') ? HOST_ARG.split('=')[1] : process.argv[process.argv.indexOf(HOST_ARG) + 1];
  if (val === 'all') return 'all';
  try {
    return resolveHostArg(val) as Host;
  } catch {
    throw new Error(`Unknown host: ${val}. Use ${ALL_HOST_NAMES.join(', ')}, or all.`);
  }
})();

// single-host mode 下，HOST 就是该 host。--host all 时，下方每次 iteration 会设置它。
let HOST: Host = HOST_ARG_VAL === 'all' ? 'claude' : HOST_ARG_VAL;

// ─── Model Overlay Selection ────────────────────────────────
// --model 是 explicit。不要从 host auto-detect（host ≠ model）。
// 默认是 'claude'。overlay file 缺失 → empty string（graceful）。
import { ALL_MODEL_NAMES, resolveModel, type Model } from './models';
const MODEL_ARG = process.argv.find(a => a.startsWith('--model'));
const MODEL_ARG_VAL: Model = (() => {
  if (!MODEL_ARG) return 'claude';
  const val = MODEL_ARG.includes('=') ? MODEL_ARG.split('=')[1] : process.argv[process.argv.indexOf(MODEL_ARG) + 1];
  const resolved = resolveModel(val);
  if (!resolved) {
    throw new Error(`Unknown model: ${val}. Use ${ALL_MODEL_NAMES.join(', ')}, or a family variant (e.g., claude-opus-4-7, gpt-5.4-mini, o3).`);
  }
  return resolved;
})();

// ─── Catalog Mode (v1.45.0.0 T4) ────────────────────────────
// 'trim'（默认）：将 frontmatter description 缩短到 lead sentence，
// 把 routing/voice prose 移入 "## When to invoke" body section，并 emit
// scripts/proactive-suggestions.json（跨所有 skills 的 single file）。
// 'full'：legacy v1.44 behavior，full description 保留在 frontmatter 中。
const CATALOG_MODE_ARG = process.argv.find(a => a.startsWith('--catalog-mode'));
const CATALOG_MODE: 'trim' | 'full' = (() => {
  if (!CATALOG_MODE_ARG) return 'trim';
  const val = CATALOG_MODE_ARG.includes('=')
    ? CATALOG_MODE_ARG.split('=')[1]
    : process.argv[process.argv.indexOf(CATALOG_MODE_ARG) + 1];
  if (val !== 'trim' && val !== 'full') {
    throw new Error(`Unknown catalog mode: ${val}. Use 'trim' (default) or 'full'.`);
  }
  return val;
})();

// ─── Explain-level Overlay ──────────────────────────────────
// --explain-level=terse 在 gen time 将 preamble prose（writing-style、completeness、
// confusion-protocol、context-health）压缩为单行 pointer。
// 默认保留 runtime-conditional behavior（sections 无条件 render；当 preamble echo 中
// 出现 EXPLAIN_LEVEL: terse 时，model 跳过它们）。
// 通过 build flag opt-in，让大多数用户获得 runtime-flexible default。
const EXPLAIN_LEVEL_ARG = process.argv.find(a => a.startsWith('--explain-level'));
const EXPLAIN_LEVEL: 'default' | 'terse' = (() => {
  if (!EXPLAIN_LEVEL_ARG) return 'default';
  const val = EXPLAIN_LEVEL_ARG.includes('=')
    ? EXPLAIN_LEVEL_ARG.split('=')[1]
    : process.argv[process.argv.indexOf(EXPLAIN_LEVEL_ARG) + 1];
  if (val !== 'default' && val !== 'terse') {
    throw new Error(`Unknown explain level: ${val}. Use 'default' or 'terse'.`);
  }
  return val;
})();

// ─── Out-dir（dev workspace render isolation）───────────────
// --out-dir <abs-dir> 会把 Claude SKILL.md + section output 重定向到单独的
// untracked 目录，而不是原地写入；同时会把 generated content 中的 literal
// section-base path（`~/.claude/skills/gstack/<skill>/sections/`）改指向 out-dir，
// 让 section Reads 读取 rendered copy，而不是 global install。bin/dev-setup 用它
// 为 Conductor workspace 渲染 gbrain `:user` variant，同时不 dirty tracked source。
// 默认（未设置）= 原地写入，行为不变。仅 Claude host。
const OUT_DIR_ARG = process.argv.find(a => a.startsWith('--out-dir'));
const OUT_DIR: string | null = (() => {
  if (!OUT_DIR_ARG) return null;
  const val = OUT_DIR_ARG.includes('=')
    ? OUT_DIR_ARG.split('=')[1]
    : process.argv[process.argv.indexOf(OUT_DIR_ARG) + 1];
  if (!val) throw new Error('--out-dir requires a directory path');
  return path.resolve(val);
})();

/**
 * 渲染到 out-dir 时，把 literal section-base path 指向 out-dir，让 section Reads
 * resolve 到 rendered copy，而不是 global install。
 * 这是精准 rewrite：只改包含 `/sections/` 的 paths；bin/、browse/、docs/
 * references 继续指向 `~/.claude/skills/gstack`（仍可工作的 global install）。
 * --out-dir 未设置时为 no-op。
 */
function rewriteSectionBase(content: string): string {
  if (!OUT_DIR) return content;
  return content.replace(
    /~\/\.claude\/skills\/gstack\/([^\s)`"'*]+\/sections\/)/g,
    `${OUT_DIR}/$1`,
  );
}

// HostPaths、HOST_PATHS 和 TemplateContext 从 ./resolvers/types import（line 7-8）。
// Design constants（AI_SLOP_BLACKLIST、OPENAI_HARD_REJECTIONS、OPENAI_LITMUS_CHECKS）
// 位于 ./resolvers/constants，并由 resolvers 直接消费。

// ─── External Host Helpers ───────────────────────────────────

// Re-export local copy，供此文件使用（匹配 codex-helpers.ts）。
// 接受 optional frontmatter name，以支持 directory/invocation name divergence。
function externalSkillName(skillDir: string, frontmatterName?: string): string {
  // Root skill（skillDir === '' 或 '.'）无论 frontmatter 如何都映射到 'gstack'。
  if (skillDir === '.' || skillDir === '') return 'gstack';
  // frontmatter name 与 directory name 不同时使用前者（例如 run-tests/ 且 name: test）。
  const baseName = frontmatterName && frontmatterName !== skillDir ? frontmatterName : skillDir;
  // 不要 double-prefix：gstack-upgrade → gstack-upgrade（不是 gstack-gstack-upgrade）。
  if (baseName.startsWith('gstack-')) return baseName;
  return `gstack-${baseName}`;
}

function extractNameAndDescription(content: string): { name: string; description: string } {
  const fmStart = content.indexOf('---\n');
  if (fmStart !== 0) return { name: '', description: '' };
  const fmEnd = content.indexOf('\n---', fmStart + 4);
  if (fmEnd === -1) return { name: '', description: '' };

  const frontmatter = content.slice(fmStart + 4, fmEnd);
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim() : '';

  let description = '';
  const lines = frontmatter.split('\n');
  let inDescription = false;
  const descLines: string[] = [];
  for (const line of lines) {
    if (line.match(/^description:\s*\|?\s*$/)) {
      inDescription = true;
      continue;
    }
    if (line.match(/^description:\s*\S/)) {
      description = line.replace(/^description:\s*/, '').trim();
      break;
    }
    if (inDescription) {
      if (line === '' || line.match(/^\s/)) {
        descLines.push(line.replace(/^  /, ''));
      } else {
        break;
      }
    }
  }
  if (descLines.length > 0) {
    description = descLines.join('\n').trim();
  }

  return { name, description };
}

// ─── Voice Trigger Processing ────────────────────────────────

/**
 * 从 frontmatter 提取 voice-triggers YAML list。
 * 返回 trigger strings array；没有 voice-triggers field 时返回 []。
 */
function extractVoiceTriggers(content: string): string[] {
  const fmStart = content.indexOf('---\n');
  if (fmStart !== 0) return [];
  const fmEnd = content.indexOf('\n---', fmStart + 4);
  if (fmEnd === -1) return [];
  const frontmatter = content.slice(fmStart + 4, fmEnd);

  const triggers: string[] = [];
  let inVoice = false;
  for (const line of frontmatter.split('\n')) {
    if (/^voice-triggers:/.test(line)) { inVoice = true; continue; }
    if (inVoice) {
      const m = line.match(/^\s+-\s+"(.+)"$/);
      if (m) triggers.push(m[1]);
      else if (!/^\s/.test(line)) break;
    }
  }
  return triggers;
}

/**
 * 预处理 voice triggers：把 voice-triggers YAML field fold 进 description，
 * 然后从 frontmatter strip 此 field。必须在 transformFrontmatter 和
 * extractNameAndDescription 之前运行，确保所有 hosts 都看到更新后的 description。
 */
function processVoiceTriggers(content: string): string {
  const triggers = extractVoiceTriggers(content);
  if (triggers.length === 0) return content;

  // 从 frontmatter strip voice-triggers block
  content = content.replace(/^voice-triggers:\n(?:\s+-\s+"[^"]*"\n?)*/m, '');

  // 获取当前 description（strip voice-triggers 后，因此是 clean 的）
  const { description } = extractNameAndDescription(content);
  if (!description) return content;

  // 构建追加了 voice triggers 的新 description
  const voiceLine = `Voice triggers (speech-to-text aliases): ${triggers.map(t => `"${t}"`).join(', ')}.`;
  const newDescription = description + '\n' + voiceLine;

  // 用新 description 替换 frontmatter 中的旧 indented description
  const oldIndented = description.split('\n').map(l => `  ${l}`).join('\n');
  const newIndented = newDescription.split('\n').map(l => `  ${l}`).join('\n');
  content = content.replace(oldIndented, newIndented);

  return content;
}

// Export for testing（供测试使用）
export { extractVoiceTriggers, processVoiceTriggers };

// ─── Catalog Trim (v1.45.0.0 T4) ─────────────────────────────
//
// 目前 frontmatter `description:` blocks 会堆进：一行 outcome、"Use when
// asked to..." voice triggers、"Proactively..." routing guidance，以及
// "(gstack)" tag。这堆内容是 always-loaded catalog surface，每个 session 都要为全文付费。
// catalog trim 会把 description 拆成留在 frontmatter 中的一行 catalog entry
//（lead sentence + "(gstack)"），以及承载 routing/voice triggers prose 的
// "## When to invoke" body section，供 in-skill discovery 使用。写入
// scripts/proactive-suggestions.json 的 registry（每个 skill 一条 entry）让需要 routing
// 的 agents 可用，而无需支付 always-loaded cost。
//
// Opt-out：`--catalog-mode=full` 保留 v1.44 behavior（no trim，full description
// 留在 frontmatter）。调试 routing regressions，或向依赖 legacy fat catalog 的 hosts
// shipping skills 时使用。

export interface CatalogParts {
  lead: string;            // First sentence — 保留在 catalog 中
  routingProse: string;    // "Use when asked to...", "Proactively..." paragraphs
  voiceLine: string | null; // "Voice triggers (speech-to-text aliases): ..." line if present
  hasGstackTag: boolean;
}

export function splitCatalogDescription(description: string): CatalogParts {
  // Voice triggers line（前面由 processVoiceTriggers fold 进来）
  const voiceMatch = description.match(/Voice triggers \(speech-to-text aliases\):[^\n]+/);
  const voiceLine = voiceMatch ? voiceMatch[0] : null;
  let working = voiceLine ? description.replace(voiceLine, '').trim() : description.trim();

  const hasGstackTag = /\(gstack\)/.test(working);
  if (hasGstackTag) working = working.replace(/\(gstack\)/, '').trim();

  // Lead = first sentence（到第一个后接 space 或 string end 的 period）。
  // 为容忍 embedded periods（URLs、"v1.45.0.0"），要求 period 后接 whitespace 或 end-of-text。
  // 先 normalize 为 single-line 做 sentence detection，然后再还原。
  const collapsed = working.replace(/\s+/g, ' ').trim();
  const sentenceMatch = collapsed.match(/^([^.!?]*[.!?])(?:\s|$)/);
  // sentenceLead 是完整 first sentence（不 truncate）。我们从此位置计算 routing，
  // 然后可选 truncate displayed lead。先 truncate 再计算 routing 是 v1.45.0.0 bug：
  // 当 first sentence 超过 200 chars 时，routing extraction 会丢失 description 的整个 tail
  //（design-consultation 的 "Use when..." routing prose 被静默丢弃）。
  const sentenceLead = sentenceMatch ? sentenceMatch[1].trim() : collapsed.split(/\s/).slice(0, 20).join(' ');

  // Routing prose：collapsed view 中 first sentence boundary 之后的所有内容。
  const leadInCollapsed = collapsed.indexOf(sentenceLead);
  const routingCollapsed = leadInCollapsed >= 0
    ? collapsed.slice(leadInCollapsed + sentenceLead.length).trim()
    : '';

  // Now produce the displayed lead — truncated if too long. The original
  // sentenceLead is preserved for routing extraction below.
  let lead = sentenceLead;
  if (lead.length > 200) {
    const trunc = lead.slice(0, 197);
    const lastSpace = trunc.lastIndexOf(' ');
    lead = (lastSpace > 60 ? trunc.slice(0, lastSpace) : trunc) + '...';
  }
  // 通过映射回 original layout 来恢复 routing prose 的 line breaks。
  // 尽可能使用 original whitespace structure；否则 fallback 到 collapsed。
  // Anchor recovery 使用 sentenceLead（未 truncate 的 first sentence），而不是
  // `lead`（可能有 "..." suffix，无法 substring-match `working`）。
  let routingProse = routingCollapsed;
  const collapsedLeadIdx = working.replace(/\s+/g, ' ').indexOf(sentenceLead);
  if (collapsedLeadIdx >= 0) {
    let consumed = 0;
    let cut = 0;
    for (let i = 0; i < working.length && consumed < collapsedLeadIdx + sentenceLead.length; i++) {
      if (/\s/.test(working[i])) {
        if (i === 0 || /\s/.test(working[i - 1])) continue;
        consumed += 1;
      } else {
        consumed += 1;
      }
      cut = i + 1;
    }
    const tail = working.slice(cut).trim();
    if (tail.length > 0) routingProse = tail;
  }

  return { lead, routingProse, voiceLine, hasGstackTag };
}

/** 构建 catalog-trimmed `description:` block。 */
export function buildTrimmedDescription(parts: CatalogParts): string {
  const lead = parts.lead.trim();
  const suffix = parts.hasGstackTag ? ' (gstack)' : '';
  return `${lead}${suffix}`;
}

/** 构建承载 routing/voice prose 的 body section。 */
export function buildWhenToInvokeSection(parts: CatalogParts): string {
  const lines: string[] = ['## When to invoke this skill（何时调用此 skill）', ''];
  lines.push('Use when this request matches the routing prose below. Proactively suggest this skill when the user intent fits, unless proactive routing is disabled.（当请求匹配下方 routing prose 时使用；除非禁用主动路由，否则在用户意图匹配时主动建议此 skill。）');
  lines.push('');
  if (parts.routingProse) {
    lines.push(parts.routingProse);
    lines.push('');
  }
  if (parts.voiceLine) {
    lines.push(parts.voiceLine);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * 将 string 渲染为 YAML inline scalar value（`key: ` 后面的文本），
 * 仅当 plain scalar 无效或 ambiguous 时加引号。
 *
 * 此处防护的 bug（#1778）：像 "Ship workflow: detect..." 这样的 description
 * 如果作为 plain scalar emit，会带有 interior ": "；strict YAML parser
 *（Codex/OpenAI skill loading）会把它读成 nested mapping，并用
 * "mapping values are not allowed in this context" 拒绝。需要 quoting 时，
 * fallback 到 JSON.stringify，生成 YAML 可 verbatim 接受的 double-quoted scalar
 *（YAML 是 JSON flow scalars 的 superset）。已经是 valid plain scalars 的字符串
 * 保持不变，以减少 regen diffs。
 */
export function toYamlInlineScalar(s: string): string {
  const needsQuote =
    s.length === 0 ||
    s !== s.trim() ||                       // leading/trailing whitespace
    /:(\s|$)/.test(s) ||                    // "foo: bar" / trailing colon → mapping ambiguity
    /\s#/.test(s) ||                        // " #" → inline comment
    /[^\x00-\x7F]/.test(s) ||               // strict YAML parsers 会拒绝部分 UTF-8 plain scalars
    /^[\s>|&*!%@`"'#,\[\]{}?-]/.test(s);    // leading YAML indicator char
  return needsQuote ? JSON.stringify(s) : s;
}

/**
 * 对 SKILL.md body 应用 catalog trim：
 *  - 将 frontmatter `description:` 缩短为 lead + (gstack)
 *  - 在 generated header 之后插入 "## When to invoke" body section
 *    （让它落在 body content 靠前位置，也就是 routing guidance 应在的位置）
 *
 * 返回 rewritten content 和 parts（用于 run 末尾的 proactive-suggestions JSON aggregation）。
 */
export function applyCatalogTrim(content: string, skillName: string): { content: string; parts: CatalogParts } | null {
  // 在 frontmatter 中定位 description block
  if (!content.startsWith('---\n')) return null;
  const fmEnd = content.indexOf('\n---', 4);
  if (fmEnd === -1) return null;
  const frontmatter = content.slice(4, fmEnd);

  // 匹配 `description: |` block + indented body lines
  const descMatch = frontmatter.match(/^description:\s*\|?\s*\n((?:\s{2,}.*(?:\n|$))+)/m)
                    || frontmatter.match(/^description:\s+(.+)$/m);
  if (!descMatch) return null;

  // 提取 full description text
  let descText: string;
  if (descMatch[0].startsWith('description: |') || /^description:\s*\|/.test(descMatch[0])) {
    descText = descMatch[1].split('\n').map(l => l.replace(/^\s{2}/, '')).join('\n').trim();
  } else {
    descText = descMatch[1].trim();
  }

  // 跳过 description 很短的 skills（已 trimmed，或没有 routing prose）。
  // 低于约 120 chars 时，拆分没有价值。
  if (descText.length < 120) return null;

  const parts = splitCatalogDescription(descText);
  // 如果 lead + (gstack) 已经占据大部分文本，则无需 trim。
  const trimmedLen = buildTrimmedDescription(parts).length;
  if (trimmedLen >= descText.length - 20) return null;

  // 替换 frontmatter 中的 description；保留 trailing newline，避免下一个
  // YAML field 与 description value 出现在同一行。
  // 当 value 会成为 invalid YAML plain scalar 时加引号（常见 case：像
  // "Ship workflow: detect..." 这样的 interior ": "，strict YAML parser 会把它
  // 读成 nested mapping 并拒绝，见 #1778）。toYamlInlineScalar 只在需要时加引号，
  // 因此没有 special chars 的 descriptions 仍保持 plain。
  const newDesc = buildTrimmedDescription(parts);
  // 使用 function replacer（不是 string），避免 description 中的 `$`（例如未来某个
  // skill 引用 `$B`/`$D`）被解释为 `$&`/`$1` replacement pattern，从而静默 corrupt
  // frontmatter。
  const newDescLine = `description: ${toYamlInlineScalar(newDesc)}\n`;
  const newFrontmatter = frontmatter.replace(descMatch[0], () => newDescLine);
  let newContent = '---\n' + newFrontmatter + content.slice(fmEnd);

  // 在 frontmatter 后插入 body section（closing ---\n 和任何 existing GENERATED header 之后）。
  // 插入到第一条 non-comment line 之前。
  const bodyStart = newContent.indexOf('\n---\n') + 5;
  const whenToInvoke = '\n' + buildWhenToInvokeSection(parts).trim() + '\n';
  // 如果存在 generated header，则跳过它（它位于 frontmatter close 之后）。
  const headerMatch = newContent.slice(bodyStart).match(/^(<!--[^>]*-->\s*\n)+/);
  const insertAt = bodyStart + (headerMatch ? headerMatch[0].length : 0);
  newContent = newContent.slice(0, insertAt) + whenToInvoke + '\n' + newContent.slice(insertAt);

  return { content: newContent, parts };
}

const OPENAI_SHORT_DESCRIPTION_LIMIT = 120;

function condenseOpenAIShortDescription(description: string): string {
  const firstParagraph = description.split(/\n\s*\n/)[0] || description;
  const collapsed = firstParagraph.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= OPENAI_SHORT_DESCRIPTION_LIMIT) return collapsed;

  const truncated = collapsed.slice(0, OPENAI_SHORT_DESCRIPTION_LIMIT - 3);
  const lastSpace = truncated.lastIndexOf(' ');
  const safe = lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated;
  return `${safe}...`;
}

function generateOpenAIYaml(displayName: string, shortDescription: string): string {
  return `interface:
  display_name: ${JSON.stringify(displayName)}
  short_description: ${JSON.stringify(shortDescription)}
  default_prompt: ${JSON.stringify(`Use ${displayName} for this task.`)}
policy:
  allow_implicit_invocation: true
`;
}

/**
 * 为 external hosts transform frontmatter。
 * Claude：strip `sensitive:` field（只有 Factory 使用它）。
 * Codex：仅保留 name + description，并强制 1024-char limit。
 * Factory：保留 name + description + user-invocable，并按条件添加 disable-model-invocation。
 */
function transformFrontmatter(content: string, host: Host): string {
  const hostConfig = getHostConfig(host);
  const fm = hostConfig.frontmatter;

  if (fm.mode === 'denylist') {
    // Denylist mode：strip listed fields，保留其他所有内容
    for (const field of fm.stripFields || []) {
      if (field === 'voice-triggers') {
        content = content.replace(/^voice-triggers:\n(?:\s+-\s+"[^"]*"\n?)*/m, '');
      } else {
        content = content.replace(new RegExp(`^${field}:\\s*.*\\n`, 'm'), '');
      }
    }
    return content;
  }

  // Allowlist mode：仅用 allowed fields reconstruct frontmatter
  const fmStart = content.indexOf('---\n');
  if (fmStart !== 0) return content;
  const fmEnd = content.indexOf('\n---', fmStart + 4);
  if (fmEnd === -1) return content;
  const frontmatter = content.slice(fmStart + 4, fmEnd);
  const body = content.slice(fmEnd + 4);
  const { name, description } = extractNameAndDescription(content);

  // Description limit enforcement（描述长度限制）
  if (fm.descriptionLimit) {
    const behavior = fm.descriptionLimitBehavior || 'error';
    if (description.length > fm.descriptionLimit) {
      if (behavior === 'error') {
        throw new Error(
          `${hostConfig.displayName} description for "${name}" is ${description.length} chars (max ${fm.descriptionLimit}). ` +
          `Compress the description in the .tmpl file.`
        );
      } else if (behavior === 'warn') {
        console.warn(`WARNING: ${hostConfig.displayName} description for "${name}" exceeds ${fm.descriptionLimit} chars`);
      }
      // 'truncate' — 静默继续
    }
  }

  // 用 allowed fields 构建 frontmatter
  const indentedDesc = description.split('\n').map(l => `  ${l}`).join('\n');
  let newFm = `---\nname: ${name}\ndescription: |\n${indentedDesc}\n`;

  // 添加 extra fields（host-wide）
  if (fm.extraFields) {
    for (const [key, value] of Object.entries(fm.extraFields)) {
      if (key !== 'name' && key !== 'description') {
        newFm += `${key}: ${value}\n`;
      }
    }
  }

  // 添加 conditional fields
  if (fm.conditionalFields) {
    for (const rule of fm.conditionalFields) {
      const match = Object.entries(rule.if).every(([k, v]) =>
        new RegExp(`^${k}:\\s*${v}`, 'm').test(frontmatter)
      );
      if (match) {
        for (const [key, value] of Object.entries(rule.add)) {
          newFm += `${key}: ${value}\n`;
        }
      }
    }
  }

  // 保留 name 和 description 之外的 additional keepFields
  if (fm.keepFields) {
    for (const field of fm.keepFields) {
      if (field === 'name' || field === 'description') continue;
      // 匹配可能带 multi-line/array value 的 YAML field（colon 后的 indented lines）
      const fieldMatch = frontmatter.match(new RegExp(`^${field}:(.*(?:\\n(?:[ \\t]+.+))*)`, 'm'));
      if (fieldMatch) {
        newFm += `${field}:${fieldMatch[1]}\n`;
      }
    }
  }

  // Rename fields（用 new keys 复制 template frontmatter 中的 values）
  if (fm.renameFields) {
    for (const [oldName, newName] of Object.entries(fm.renameFields)) {
      const fieldMatch = frontmatter.match(new RegExp(`^${oldName}:(.+(?:\\n(?:\\s+.+)*)?)`, 'm'));
      if (fieldMatch) {
        newFm += `${newName}:${fieldMatch[1]}\n`;
      }
    }
  }

  newFm += '---';
  return newFm + body;
}

/**
 * 从 frontmatter 提取 hook descriptions，用于 inline safety prose。
 * 返回 hooks 行为描述；没有 hooks 时返回 null。
 */
function extractHookSafetyProse(tmplContent: string): string | null {
  if (!tmplContent.match(/^hooks:/m)) return null;

  // Parse hook matchers，以构建 human-readable safety description
  const matchers: string[] = [];
  const matcherRegex = /matcher:\s*"(\w+)"/g;
  let m;
  while ((m = matcherRegex.exec(tmplContent)) !== null) {
    if (!matchers.includes(m[1])) matchers.push(m[1]);
  }

  if (matchers.length === 0) return null;

  // 根据 hooked tools 构建 safety prose
  const toolDescriptions: Record<string, string> = {
    Bash: '在执行前检查 bash commands 是否包含 destructive operations（rm -rf、DROP TABLE、force-push、git reset --hard 等）',
    Edit: '在应用前确认 file edits 位于允许的 scope boundary 内',
    Write: '在应用前确认 file writes 位于允许的 scope boundary 内',
  };

  const safetyChecks = matchers
    .map(t => toolDescriptions[t] || `check ${t} operations for safety`)
    .join(', and ');

  return `> **Safety Advisory:** 此 skill 包含 safety checks：${safetyChecks}。使用此 skill 时，在执行 potentially destructive operations 前始终暂停并验证。如果不确定某条 command 是否安全，先向用户确认再继续。`;
}

// ─── External Host Config (now derived from hosts/*.ts) ──────
// EXTERNAL_HOST_CONFIG 已由 hosts/index.ts 中的 getHostConfig() 替代

// ─── Template Processing ────────────────────────────────────

const GENERATED_HEADER = `<!-- AUTO-GENERATED from {{SOURCE}} — do not edit directly -->\n<!-- Regenerate: bun run gen:skill-docs -->\n`;

/**
 * 应用 host 配置的 path + tool rewrites。抽出此函数，让 SKILL.md
 *（通过 processExternalHost）和 section files（通过 processSectionTemplate）获得
 * 完全一致的 per-host treatment；section 的 cross-references 必须和 parent skill
 * 以同样方式 rewrite，否则 external hosts 会得到错误 paths。
 */
function applyHostRewrites(content: string, hostConfig: HostConfig): string {
  let result = content;
  for (const rewrite of hostConfig.pathRewrites) {
    result = result.replaceAll(rewrite.from, rewrite.to);
  }
  if (hostConfig.toolRewrites) {
    for (const [from, to] of Object.entries(hostConfig.toolRewrites)) {
      result = result.replaceAll(from, to);
    }
  }
  return result;
}

/**
 * 用 RESOLVERS registry resolve {{PLACEHOLDER}} / {{NAME:arg}} tokens，
 * 同时尊重 host suppression 和 appliesTo gating，然后断言没有 unresolved 剩余。
 * 抽出此函数，让 SKILL.md 和 section templates 走完全相同 path；这样针对一侧的
 * security/sanitization fix 不会漏掉另一侧。
 */
function resolvePlaceholders(
  tmplContent: string,
  ctx: TemplateContext,
  hostConfig: HostConfig,
  relTmplPath: string,
): string {
  // effectiveSuppressedResolvers() 尊重 --respect-detection：本地检测到 gbrain 时，
  // GBRAIN_* resolvers 会 un-suppress。SKILL.md 和 section generation 共用此逻辑，
  // 因此两条路径获得相同的 gbrain-aware behavior。
  const suppressed = effectiveSuppressedResolvers(hostConfig);
  const onePass = (input: string): string =>
    input.replace(/\{\{(\w+(?::[^}]+)?)\}\}/g, (_match, fullKey) => {
      const parts = fullKey.split(':');
      const resolverName = parts[0];
      const args = parts.slice(1);
      if (suppressed.has(resolverName)) return '';
      const entry = RESOLVERS[resolverName];
      if (!entry) throw new Error(`Unknown placeholder {{${resolverName}}} in ${relTmplPath}`);
      const { resolve, appliesTo } = unwrapResolver(entry);
      if (appliesTo && !appliesTo(ctx)) return '';
      return args.length > 0 ? resolve(ctx, args) : resolve(ctx);
    });

  // Multi-pass：resolver 可能 emit 自身包含 {{TOKENS}} 的 content；
  // {{SECTION:id}} resolver 会为 non-Claude hosts inline section template
  //（带自己的 resolvers）。.replace() 不会重新扫描 inserted text，所以循环直到
  // output 稳定。加 bound 是为避免 resolver emit 自己 placeholder 时无限循环；
  // 6 passes 已远超任何 skill 所需 nesting。
  let content = tmplContent;
  for (let pass = 0; pass < 6; pass++) {
    const next = onePass(content);
    if (next === content) break;
    content = next;
  }

  const remaining = content.match(/\{\{(\w+(?::[^}]+)?)\}\}/g);
  if (remaining) {
    throw new Error(`Unresolved placeholders in ${relTmplPath}: ${remaining.join(', ')}`);
  }
  return content;
}

/**
 * 从 template frontmatter 构建 TemplateContext。SKILL.md 和 section generation 共用，
 * 因此 sections 会继承 parent skill resolve 时使用的同一个 context
 *（skillName、tier、benefitsFrom、interactive）；由 test/template-context-parity.test.ts
 * enforce。skillNameOverride 让 section generation pin parent skill name，
 * 而不是派生出 "sections"。
 */
function buildContext(
  tmplContent: string,
  tmplPath: string,
  host: Host,
  skillNameOverride?: string,
): TemplateContext {
  const { name: extractedName } = extractNameAndDescription(tmplContent);
  const skillName = skillNameOverride || extractedName || path.basename(path.dirname(tmplPath));
  const benefitsMatch = tmplContent.match(/^benefits-from:\s*\[([^\]]*)\]/m);
  const benefitsFrom = benefitsMatch
    ? benefitsMatch[1].split(',').map(s => s.trim()).filter(Boolean)
    : undefined;
  const tierMatch = tmplContent.match(/^preamble-tier:\s*(\d+)$/m);
  const preambleTier = tierMatch ? parseInt(tierMatch[1], 10) : undefined;
  const interactiveMatch = tmplContent.match(/^interactive:\s*(true|false)\s*$/m);
  const interactive = interactiveMatch ? interactiveMatch[1] === 'true' : undefined;
  return {
    skillName, tmplPath, benefitsFrom, host, paths: HOST_PATHS[host],
    preambleTier, model: MODEL_ARG_VAL, interactive, explainLevel: EXPLAIN_LEVEL,
  };
}

/**
 * 处理 external host output：routing、frontmatter、path rewrites、metadata。
 * Codex、Factory 和未来 external hosts 共用。
 */
function processExternalHost(
  content: string,
  tmplContent: string,
  host: Host,
  skillDir: string,
  extractedDescription: string,
  ctx: TemplateContext,
  frontmatterName?: string,
): { content: string; outputPath: string; outputDir: string; symlinkLoop: boolean } {
  const hostConfig = getHostConfig(host);

  const name = externalSkillName(skillDir === '.' ? '' : skillDir, frontmatterName);
  const outputDir = path.join(ROOT, hostConfig.hostSubdir, 'skills', name);
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'SKILL.md');

  // 防止 symlink loops
  let symlinkLoop = false;
  const claudePath = ctx.tmplPath.replace(/\.tmpl$/, '');
  try {
    const resolvedClaude = fs.realpathSync(claudePath);
    const resolvedExternal = fs.realpathSync(path.dirname(outputPath)) + '/' + path.basename(outputPath);
    if (resolvedClaude === resolvedExternal) {
      symlinkLoop = true;
    }
  } catch {
    // 文件尚不存在时 realpathSync 会失败；此时没有 symlink loop
  }

  // 在 transform frontmatter 前提取 hook safety prose（transform 会 strip hooks）
  const safetyProse = extractHookSafetyProse(tmplContent);

  // Transform frontmatter（host-aware）
  let result = transformFrontmatter(content, host);

  // 在 body 顶部插入 safety advisory（frontmatter 之后）
  if (safetyProse) {
    const bodyStart = result.indexOf('\n---') + 4;
    result = result.slice(0, bodyStart) + '\n' + safetyProse + '\n' + result.slice(bodyStart);
  }

  // Config-driven path + tool rewrites（与 processSectionTemplate 共用，
  // 让 section cross-references 获得与 SKILL.md 相同的 per-host treatment）。
  result = applyHostRewrites(result, hostConfig);

  // Config-driven：生成 metadata（例如 Codex 的 openai.yaml）
  if (hostConfig.generation.generateMetadata && !symlinkLoop) {
    const agentsDir = path.join(outputDir, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    const shortDescription = condenseOpenAIShortDescription(extractedDescription);
    fs.writeFileSync(path.join(agentsDir, 'openai.yaml'), generateOpenAIYaml(name, shortDescription));
  }

  return { content: result, outputPath, outputDir, symlinkLoop };
}

function processTemplate(tmplPath: string, host: Host = 'claude'): { outputPath: string; content: string; symlinkLoop?: boolean; catalogParts?: CatalogParts | null } {
  const tmplContent = fs.readFileSync(tmplPath, 'utf-8');
  const relTmplPath = path.relative(ROOT, tmplPath);
  let outputPath = tmplPath.replace(/\.tmpl$/, '');

  // Determine skill directory relative to ROOT
  const skillDir = path.relative(ROOT, path.dirname(tmplPath));

  // --out-dir (Claude only): mirror the skill tree into the out-dir instead of
  // writing in place. External hosts compute their own paths below.
  if (OUT_DIR && host === 'claude') {
    outputPath = path.join(OUT_DIR, skillDir, path.basename(tmplPath).replace(/\.tmpl$/, ''));
  }

  // Extract name/description: name drives external skill naming + setup symlinks
  // (and TemplateContext.skillName via buildContext); description feeds external
  // host metadata. When frontmatter name: differs from directory name (e.g.
  // run-tests/ with name: test), the frontmatter name wins.
  const { name: extractedName, description: extractedDescription } = extractNameAndDescription(tmplContent);

  const currentHostConfig = getHostConfig(host);
  const ctx = buildContext(tmplContent, tmplPath, host);
  const skillName = ctx.skillName;

  // Replace placeholders + assert none remain (shared path with section generation).
  let content = resolvePlaceholders(tmplContent, ctx, currentHostConfig, relTmplPath);

  // Preprocess voice triggers: fold into description, strip field from frontmatter.
  // Must run BEFORE transformFrontmatter so all hosts see the updated description,
  // and BEFORE extractedDescription is used by external host metadata.
  content = processVoiceTriggers(content);

  // Re-extract description AFTER voice trigger preprocessing so Codex openai.yaml
  // metadata gets the updated description with voice triggers included.
  const postProcessDescription = extractNameAndDescription(content).description;

  // For Claude: strip sensitive: field (only Factory uses it)
  // For external hosts: route output, transform frontmatter, rewrite paths
  let symlinkLoop = false;
  if (host === 'claude') {
    content = transformFrontmatter(content, host);
  } else {
    const result = processExternalHost(content, tmplContent, host, skillDir, postProcessDescription, ctx, extractedName || undefined);
    content = result.content;
    outputPath = result.outputPath;
    symlinkLoop = result.symlinkLoop;
  }

  // Prepend generated header (after frontmatter)
  const header = GENERATED_HEADER.replace('{{SOURCE}}', path.basename(tmplPath));
  const fmEnd = content.indexOf('---', content.indexOf('---') + 3);
  if (fmEnd !== -1) {
    const insertAt = content.indexOf('\n', fmEnd) + 1;
    content = content.slice(0, insertAt) + header + content.slice(insertAt);
  } else {
    content = header + content;
  }

  // Catalog trim (Claude only — external hosts have their own frontmatter shapes)
  let catalogParts: CatalogParts | null = null;
  if (host === 'claude' && CATALOG_MODE === 'trim') {
    const trimmed = applyCatalogTrim(content, skillName);
    if (trimmed) {
      content = trimmed.content;
      catalogParts = trimmed.parts;
    }
  }

  // --out-dir: repoint section-base paths to the out-dir (no-op otherwise).
  if (host === 'claude') content = rewriteSectionBase(content);

  return { outputPath, content, symlinkLoop, catalogParts };
}

/**
 * Generate one on-demand section file (`<skill>/sections/<name>.md.tmpl` →
 * `<name>.md`). Sections are BODY FRAGMENTS — no frontmatter, no catalog trim,
 * no voice triggers. They resolve placeholders through the SAME path as
 * SKILL.md (resolvePlaceholders) using the PARENT skill's TemplateContext
 * (so appliesTo gating + tier behave identically — a section's {{PREAMBLE}}-
 * style resolver renders the same content it would in the parent, not empty).
 *
 * Output routing mirrors SKILL.md: Claude writes in-tree at
 * `<skill>/sections/<name>.md`; external hosts write to
 * `<hostSubdir>/skills/<externalName>/sections/<name>.md`. External hosts get
 * applyHostRewrites so cross-references resolve per host.
 */
function processSectionTemplate(
  sectionTmplPath: string,
  skillDir: string,
  host: Host = 'claude',
): { outputPath: string; content: string } {
  const tmplContent = fs.readFileSync(sectionTmplPath, 'utf-8');
  const relTmplPath = path.relative(ROOT, sectionTmplPath);
  const hostConfig = getHostConfig(host);

  // Read the owning SKILL.md.tmpl so the section inherits the parent's name +
  // tier + benefits-from (TemplateContext parity). Fall back to the dir name.
  const parentTmplPath = path.join(ROOT, skillDir, 'SKILL.md.tmpl');
  const parentContent = fs.existsSync(parentTmplPath) ? fs.readFileSync(parentTmplPath, 'utf-8') : '';
  const parentName = (parentContent && extractNameAndDescription(parentContent).name) || skillDir;
  const ctx = buildContext(parentContent || tmplContent, parentTmplPath, host, parentName);

  // Resolve placeholders against the section body (shared guard catches stragglers).
  let content = resolvePlaceholders(tmplContent, ctx, hostConfig, relTmplPath);

  // External hosts: rewrite cross-reference paths/tools (no frontmatter to transform).
  if (host !== 'claude') {
    content = applyHostRewrites(content, hostConfig);
  } else {
    // --out-dir: a section may cross-reference another section by absolute path;
    // repoint those to the out-dir too (no-op when --out-dir is unset).
    content = rewriteSectionBase(content);
  }

  // Plain generated header (no frontmatter to insert after).
  content = GENERATED_HEADER.replace('{{SOURCE}}', path.basename(sectionTmplPath)) + content;

  const fileName = path.basename(sectionTmplPath).replace(/\.tmpl$/, '');
  let outputPath: string;
  if (host === 'claude') {
    outputPath = path.join(OUT_DIR || ROOT, skillDir, 'sections', fileName);
  } else {
    const externalName = externalSkillName(skillDir, parentName);
    outputPath = path.join(ROOT, hostConfig.hostSubdir, 'skills', externalName, 'sections', fileName);
  }
  if (!DRY_RUN) fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  return { outputPath, content };
}

// ─── Main ───────────────────────────────────────────────────

function findTemplates(): string[] {
  return discoverTemplates(ROOT).map(t => path.join(ROOT, t.tmpl));
}

const ALL_HOSTS: Host[] = ALL_HOST_NAMES as Host[];
const hostsToRun: Host[] = HOST_ARG_VAL === 'all' ? ALL_HOSTS : [HOST];
const failures: { host: string; error: Error }[] = [];

for (const currentHost of hostsToRun) {
  HOST = currentHost;

  try {
    let hasChanges = false;
    const tokenBudget: Array<{ skill: string; lines: number; tokens: number }> = [];

    // T4 catalog trim: collect routing/voice parts across all Claude skills,
    // then write scripts/proactive-suggestions.json once per gen-skill-docs run.
    const proactiveAggregate: Record<string, {
      lead: string;
      routing: string;
      voice_line: string | null;
    }> = {};

    const currentHostConfig = getHostConfig(currentHost);
    for (const tmplPath of findTemplates()) {
      const dir = path.basename(path.dirname(tmplPath));

      // includeSkills allowlist (union logic: include minus skip)
      if (currentHostConfig.generation.includeSkills?.length) {
        if (!currentHostConfig.generation.includeSkills.includes(dir)) continue;
      }
      // skipSkills denylist (subtracts from includeSkills or full set)
      if (currentHostConfig.generation.skipSkills?.length) {
        if (currentHostConfig.generation.skipSkills.includes(dir)) continue;
      }

      const { outputPath, content, symlinkLoop, catalogParts } = processTemplate(tmplPath, currentHost);
      if (catalogParts) {
        // Root-skill detection: when the template lives at ROOT/SKILL.md.tmpl,
        // path.basename(path.dirname(tmplPath)) returns the repo's directory
        // name (e.g. "seville-v3" in a Conductor worktree, "gstack" on CI).
        // That's non-deterministic across machines and breaks CI freshness
        // checks. Use the frontmatter `name` field as the registry key — the
        // root SKILL.md.tmpl declares `name: gstack` explicitly. For all other
        // skills, `dir` matches the directory name which matches the
        // frontmatter name by convention.
        const isRoot = path.dirname(tmplPath) === ROOT;
        const key = isRoot ? 'gstack' : dir;
        proactiveAggregate[key] = {
          lead: catalogParts.lead,
          routing: catalogParts.routingProse,
          voice_line: catalogParts.voiceLine,
        };
      }
      const relOutput = path.relative(OUT_DIR || ROOT, outputPath);

      if (symlinkLoop) {
        console.log(`SKIPPED (symlink loop): ${relOutput}`);
      } else if (DRY_RUN) {
        const existing = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf-8') : '';
        if (existing !== content) {
          console.log(`STALE: ${relOutput}`);
          hasChanges = true;
        } else {
          console.log(`FRESH: ${relOutput}`);
        }
      } else {
        // In-place writes land in existing dirs; --out-dir needs the mirrored
        // skill dir created first.
        if (OUT_DIR) fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, content);
        console.log(`GENERATED: ${relOutput}`);
      }

      // Track token budget
      const lines = content.split('\n').length;
      const tokens = Math.round(content.length / 4); // ~4 chars per token
      tokenBudget.push({ skill: relOutput, lines, tokens });

      // Token ceiling check: warn if any generated SKILL.md exceeds ~40K tokens (160KB).
      // The ceiling is a "watch for feature bloat" guardrail, not a hard gate. Modern
      // flagship models have 200K-1M context windows, so 40K (4-20% of window) is fine.
      // Prompt caching further reduces the marginal cost of larger skills. This ceiling
      // exists to catch a runaway preamble or resolver that's grown by 10K+ tokens in
      // a release, not to force compression on carefully-tuned big skills (ship,
      // plan-ceo-review, office-hours all legitimately pack 25-35K tokens of behavior).
      const TOKEN_CEILING_BYTES = 160_000;
      if (content.length > TOKEN_CEILING_BYTES) {
        console.warn(`⚠️  TOKEN CEILING: ${relOutput} is ${content.length} bytes (~${tokens} tokens), exceeds ${TOKEN_CEILING_BYTES} byte ceiling (~40K tokens)`);
      }
    }

    // ─── Section generation (v2 plan T9, Claude-first carve) ───
    // On-demand sections/*.md for carved skills. Generated for CLAUDE ONLY:
    // every other host inlines section content via the {{SECTION:id}} resolver
    // (keeping the full monolith skill), so they need no section files and we
    // sidestep host-portable section paths until that plumbing lands. No-op for
    // any skill without a sections/ dir. Mirrors the SKILL.md DRY_RUN handling so
    // sections participate in the freshness gate.
    for (const sec of currentHost === 'claude' ? discoverSectionTemplates(ROOT) : []) {
      if (currentHostConfig.generation.includeSkills?.length &&
          !currentHostConfig.generation.includeSkills.includes(sec.skillDir)) continue;
      if (currentHostConfig.generation.skipSkills?.length &&
          currentHostConfig.generation.skipSkills.includes(sec.skillDir)) continue;

      const { outputPath, content } = processSectionTemplate(path.join(ROOT, sec.tmpl), sec.skillDir, currentHost);
      const relOutput = path.relative(OUT_DIR || ROOT, outputPath);

      if (DRY_RUN) {
        const existing = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf-8') : '';
        if (existing !== content) {
          console.log(`STALE: ${relOutput}`);
          hasChanges = true;
        } else {
          console.log(`FRESH: ${relOutput}`);
        }
      } else {
        fs.writeFileSync(outputPath, content);
        console.log(`GENERATED: ${relOutput}`);
      }

      tokenBudget.push({
        skill: relOutput,
        lines: content.split('\n').length,
        tokens: Math.round(content.length / 4),
      });
    }

    // Generate gstack-lite and gstack-full for OpenClaw host
    if (currentHost === 'openclaw' && !DRY_RUN) {
      const openclawDir = path.join(ROOT, 'openclaw');
      if (!fs.existsSync(openclawDir)) fs.mkdirSync(openclawDir, { recursive: true });

      const gstackLite = `# gstack-lite Planning Discipline

由 orchestrator 注入 spawned Claude Code sessions。追加到现有 CLAUDE.md。

## Planning Discipline
1. 阅读你将修改的每个 file。先理解 existing patterns。
2. 写 code 前说明 plan：做什么、为什么、哪些 files、test case、risk。
3. 遇到 ambiguous 情况时，优先：completeness over shortcuts、existing patterns over new ones、
   reversible choices over irreversible ones、safe defaults over clever ones。
4. 报告完成前先 self-review changes。检查：missed files、broken imports、untested paths、style inconsistencies。
5. 完成后报告：ship 了什么、做了哪些 decisions、还有什么 uncertain。
`;
      fs.writeFileSync(path.join(openclawDir, 'gstack-lite-CLAUDE.md'), gstackLite);
      console.log('GENERATED: openclaw/gstack-lite-CLAUDE.md');

      const gstackFull = `# gstack-full Pipeline

由 orchestrator 为 complete feature builds 注入。追加到现有 CLAUDE.md。

## Full Pipeline
1. 阅读 CLAUDE.md 并理解 project context。
2. 运行 /autoplan review 你的 approach（CEO + eng + design review pipeline）。
3. 实现 approved plan。遵循上面的 planning discipline。
4. 运行 /ship 创建带 tests、changelog 和 version bump 的 PR。
5. 回报：PR URL、ship 了什么、做了哪些 decisions、还有什么 uncertain。

PR ready for review 之前，不要请求 human input。
`;
      fs.writeFileSync(path.join(openclawDir, 'gstack-full-CLAUDE.md'), gstackFull);
      console.log('GENERATED: openclaw/gstack-full-CLAUDE.md');

      const gstackPlan = `# gstack-plan: Full Review Gauntlet

当用户想规划 Claude Code project 时由 orchestrator 注入。
追加到现有 CLAUDE.md。

## Planning Pipeline
1. 阅读 CLAUDE.md 并理解 project context。
2. 运行 /office-hours 生成 design doc（problem statement、premises、alternatives）。
3. 运行 /autoplan review design（CEO + eng + design + DX reviews + codex adversarial）。
4. 将最终 reviewed plan 保存到 orchestrator 后续可引用的 file。
   写入当前 repo 的：plans/<project-slug>-plan-<date>.md。
   包含 design doc、所有 review decisions 和 implementation sequence。
5. 回报 orchestrator：
   - Plan file path
   - 一段话 summary：设计了什么，以及 key decisions
   - List of accepted scope expansions (if any)
   - Recommended next step (usually: spawn a new session with gstack-full to implement)

Do not implement anything. This is planning only.
The orchestrator will persist the plan link to its own memory/knowledge store.
`;
      fs.writeFileSync(path.join(openclawDir, 'gstack-plan-CLAUDE.md'), gstackPlan);
      console.log('GENERATED: openclaw/gstack-plan-CLAUDE.md');
    }

    if (DRY_RUN && hasChanges) {
      console.error(`\nGenerated SKILL.md files are stale (${currentHost} host). Run: bun run gen:skill-docs --host ${currentHost}`);
      if (HOST_ARG_VAL !== 'all') process.exit(1);
      failures.push({ host: currentHost, error: new Error('Stale files detected') });
    }

    // T4 catalog trim: write aggregated proactive-suggestions.json (Claude only).
    // The JSON registry lets agents pull voice triggers / routing prose for any
    // skill on demand instead of paying for it always-loaded in the catalog.
    //
    // No timestamp field — keeps the file content-deterministic across runs so
    // CI dry-run freshness checks don't flap on regen. If a per-run timestamp
    // is ever needed for debugging, write it to a separate `.gen-stamp` file.
    // Skip the global proactive-suggestions.json in --out-dir mode: it lives at
    // a repo path (scripts/) and the dev workspace render doesn't need it.
    if (currentHost === 'claude' && CATALOG_MODE === 'trim' && Object.keys(proactiveAggregate).length > 0 && !DRY_RUN && !OUT_DIR) {
      const proactivePath = path.join(ROOT, 'scripts', 'proactive-suggestions.json');
      // Sort keys alphabetically so the serialized JSON is identical across
      // machines regardless of filesystem-iteration order. Without this, CI
      // freshness checks fail when the local dev machine and CI runner
      // discover templates in different orders.
      const sortedSkills: typeof proactiveAggregate = {};
      for (const key of Object.keys(proactiveAggregate).sort()) {
        sortedSkills[key] = proactiveAggregate[key];
      }
      const payload = {
        $schema: 'https://gstack.dev/schemas/proactive-suggestions.json',
        catalog_mode: 'trim',
        note: 'Routing / voice-trigger prose 在 catalog trim 期间从 SKILL.md frontmatter descriptions 抽取。需要 routing guidance 时按需加载。',
        skills: sortedSkills,
      };
      const serialized = JSON.stringify(payload, null, 2) + '\n';
      // Only write if content actually changed — prevents needless touches that
      // would flap CI freshness checks. Read existing file, compare, skip write
      // when identical.
      let existing = '';
      try { existing = fs.readFileSync(proactivePath, 'utf-8'); } catch { /* first run */ }
      if (existing !== serialized) {
        fs.writeFileSync(proactivePath, serialized);
      }
    }

    // Print token budget summary
    if (!DRY_RUN && tokenBudget.length > 0) {
      tokenBudget.sort((a, b) => b.lines - a.lines);
      const totalLines = tokenBudget.reduce((s, t) => s + t.lines, 0);
      const totalTokens = tokenBudget.reduce((s, t) => s + t.tokens, 0);

      console.log('');
      console.log(`Token Budget (${currentHost} host)`);
      console.log('═'.repeat(60));
      for (const t of tokenBudget) {
        const hostSubdirs = ALL_HOST_CONFIGS.map(c => c.hostSubdir.replace('.', '\\.')).join('|');
        const name = t.skill.replace(/\/SKILL\.md$/, '').replace(new RegExp(`^\\.(${hostSubdirs})\\/skills\\/`), '');
        console.log(`  ${name.padEnd(30)} ${String(t.lines).padStart(5)} lines  ~${String(t.tokens).padStart(6)} tokens`);
      }
      console.log('─'.repeat(60));
      console.log(`  ${'TOTAL'.padEnd(30)} ${String(totalLines).padStart(5)} lines  ~${String(totalTokens).padStart(6)} tokens`);
      console.log('');
    }
  } catch (e) {
    failures.push({ host: currentHost, error: e as Error });
    console.error(`WARNING: ${currentHost} generation failed: ${(e as Error).message}`);
  }
}

// --host all: any host failure fails the build. Previously only claude failures
// exited nonzero, which let a stale or broken external-host output (e.g. a
// section that failed to generate for Factory) slip through the freshness gate
// silently. With sections fanned out across every host, "all hosts regenerated
// in the same commit" is only a real gate if every host failure is fatal here.
if (failures.length > 0 && HOST_ARG_VAL === 'all') {
  console.error(`\n${failures.length} host(s) failed: ${failures.map(f => f.host).join(', ')}`);
  process.exit(1);
}
// Single host dry-run failure already handled above

// After all hosts processed, warn if prefix patches may need re-applying
if (!DRY_RUN) {
  try {
    const configPath = path.join(process.env.HOME || '', '.gstack', 'config.yaml');
    if (fs.existsSync(configPath)) {
      const config = fs.readFileSync(configPath, 'utf-8');
      if (/^skill_prefix:\s*true/m.test(config)) {
        console.log('\nNote: skill_prefix is true. Run gstack-relink to re-apply name: patches.');
      }
    }
  } catch { /* non-fatal */ }
}

// Regenerate gstack/llms.txt — single-file capability index for AI agents.
// Runs after SKILL.md generation so it sees current skill descriptions and
// browse command list. Wrapped in an IIFE so the await-import doesn't make
// this module async (test/gen-skill-docs.test.ts uses require() to pull
// extractVoiceTriggers/processVoiceTriggers, which fails on async modules).
// Freshness is asserted in test/llms-txt-shape.test.ts.
if (!DRY_RUN) {
  void (async () => {
    try {
      const result = await writeLlmsTxt();
      if (result.warnings.length > 0) {
        for (const w of result.warnings) console.error(`[gen-llms-txt] WARN: ${w}`);
      } else {
        console.log(`[gen-llms-txt] gstack/llms.txt: ${result.skills.length} skills, ${result.browseCommands.length} browse commands`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[gen-llms-txt] FAILED: ${msg}`);
    }
  })();
}
