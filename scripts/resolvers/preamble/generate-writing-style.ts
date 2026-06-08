import type { TemplateContext } from '../types';

/**
 * Writing Style preamble section.
 *
 * v1.45.0.0 changes (T3):
 * - Jargon list is referenced by path, not inlined. The 80-term list was
 *   duplicated into every tier-2+ skill (~1.5-2 KB × 48 skills = ~80 KB
 *   across the corpus). The pointer asks the agent to Read the JSON on
 *   first jargon term encountered — one extra Read per session, but the
 *   per-corpus payload is ~30 bytes.
 * - When `ctx.explainLevel === 'terse'`, the entire section is replaced
 *   with a one-line pointer. Saves ~1.5 KB per tier-2+ skill in the
 *   opt-in terse build.
 */
export function generateWritingStyle(ctx: TemplateContext): string {
  if (ctx.explainLevel === 'terse') {
    return `## Writing Style（写作风格）\n\nTerse mode (build-time)：跳过 jargon glossing、outcome-framing layer 和 decision-impact closers。直接先给答案。\n`;
  }

  const jargonPath = `${ctx.paths.skillRoot}/scripts/jargon-list.json`;

  return `## Writing Style（写作风格；如果 preamble echo 中出现 \`EXPLAIN_LEVEL: terse\`，或用户当前 message 明确要求 terse / no-explanations output，则整段跳过）

适用于 AskUserQuestion、user replies 和 findings。AskUserQuestion Format 是 structure；这里是 prose quality。

- 每次 skill invocation 中首次使用 curated jargon 时解释一次，即使该 term 是用户粘贴的。
- 用 outcome terms 表述问题：避免什么 pain、解锁什么 capability、user experience 有什么变化。
- 使用短句、具体名词和 active voice。
- 用 user impact 收束 decisions：用户会看到什么、等待什么、失去什么或获得什么。
- User-turn override 优先：如果当前 message 要求 terse / no explanations / just the answer，跳过本 section。
- Terse mode（EXPLAIN_LEVEL: terse）：no glosses、no outcome-framing layer，更短 responses。

Curated jargon list 位于 \`${jargonPath}\`（80+ terms）。本 session 中首次遇到 jargon term 时，Read 该 file 一次；把 \`terms\` array 当作 canonical list。该 list 由 repo 拥有，可能在 releases 间增长。
`;
}
