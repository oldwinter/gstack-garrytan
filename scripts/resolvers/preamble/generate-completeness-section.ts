import type { TemplateContext } from '../types';

export function generateCompletenessSection(ctx?: TemplateContext): string {
  if (ctx?.explainLevel === 'terse') return '';
  return `## Completeness Principle — Boil the Ocean（完整性原则）

AI 让 completeness 变便宜，因此目标是把完整的事做完。推荐 full coverage（tests、edge cases、error paths），一次 boil 一个 lake，把 ocean 做完。唯一 out of scope 的是真正无关的 work（rewrites、multi-quarter migrations）；把它标记为 separate scope，绝不要把它当成 shortcut 的借口。

当 options 的区别在 coverage 时，包含 \`Completeness: X/10\`（10 = all edge cases，7 = happy path，3 = shortcut）。当 options 的区别在 kind 时，写：\`Note: options differ in kind, not coverage — no completeness score.\` Do not fabricate scores（不要编造分数）。`;
}
