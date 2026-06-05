import type { TemplateContext } from '../types';

export function generateCompletenessSection(ctx?: TemplateContext): string {
  if (ctx?.explainLevel === 'terse') return '';
  return `## Completeness Principle — Boil the Lake（完整性原则）

AI 让 completeness 变便宜。推荐 complete lakes（tests、edge cases、error paths）；标记 oceans（rewrites、multi-quarter migrations）。

当 options 的区别在 coverage 时，包含 \`Completeness: X/10\`（10 = all edge cases，7 = happy path，3 = shortcut）。当 options 的区别在 kind 时，写：\`Note: options differ in kind, not coverage — no completeness score.\` 不要编造分数。`;
}
