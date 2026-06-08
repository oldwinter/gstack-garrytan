import type { TemplateContext } from '../types';

export function generateContextRecovery(ctx: TemplateContext): string {
  const binDir = ctx.host === 'codex' ? '$GSTACK_BIN' : ctx.paths.binDir;

  return `## Context Recovery（上下文恢复）

在 session start 或 compaction 后，恢复最近的 project context。

\`\`\`bash
eval "$(${binDir}/gstack-slug 2>/dev/null)"
_PROJ="\${GSTACK_HOME:-$HOME/.gstack}/projects/\${SLUG:-unknown}"
if [ -d "$_PROJ" ]; then
  echo "--- RECENT ARTIFACTS ---"
  find "$_PROJ/ceo-plans" "$_PROJ/checkpoints" -type f -name "*.md" 2>/dev/null | xargs ls -t 2>/dev/null | head -3
  [ -f "$_PROJ/\${_BRANCH}-reviews.jsonl" ] && echo "REVIEWS: $(wc -l < "$_PROJ/\${_BRANCH}-reviews.jsonl" | tr -d ' ') entries"
  [ -f "$_PROJ/timeline.jsonl" ] && tail -5 "$_PROJ/timeline.jsonl"
  if [ -f "$_PROJ/timeline.jsonl" ]; then
    _LAST=$(grep "\\"branch\\":\\"\${_BRANCH}\\"" "$_PROJ/timeline.jsonl" 2>/dev/null | grep '"event":"completed"' | tail -1)
    [ -n "$_LAST" ] && echo "LAST_SESSION: $_LAST"
    _RECENT_SKILLS=$(grep "\\"branch\\":\\"\${_BRANCH}\\"" "$_PROJ/timeline.jsonl" 2>/dev/null | grep '"event":"completed"' | tail -3 | grep -o '"skill":"[^"]*"' | sed 's/"skill":"//;s/"//' | tr '\\n' ',')
    [ -n "$_RECENT_SKILLS" ] && echo "RECENT_PATTERN: $_RECENT_SKILLS"
  fi
  _LATEST_CP=$(find "$_PROJ/checkpoints" -name "*.md" -type f 2>/dev/null | xargs ls -t 2>/dev/null | head -1)
  [ -n "$_LATEST_CP" ] && echo "LATEST_CHECKPOINT: $_LATEST_CP"
  if [ -f "$_PROJ/decisions.active.json" ]; then
    echo "--- ACTIVE DECISIONS (recent, scope-relevant) ---"
    ${binDir}/gstack-decision-search --recent 5 2>/dev/null
    echo "--- END DECISIONS ---"
  fi
  echo "--- END ARTIFACTS ---"
fi
\`\`\`

如果列出了 artifacts，读取最新且有用的一个。如果出现 \`LAST_SESSION\` 或 \`LATEST_CHECKPOINT\`，给出 2 句 welcome back summary。如果 \`RECENT_PATTERN\` 明确指向下一个 skill，只建议一次。

**Cross-session decisions.** 如果列出了 \`ACTIVE DECISIONS\`，把它们视为带 rationale 的已定 prior calls，不要静默重新争论；如果你准备 reverse 某个 decision，要明确说明。任何问题触及 past decision（"what did we decide / why / did we try"）时，使用 \`${binDir}/gstack-decision-search\`。当你或用户做出 DURABLE decision（architecture、scope、tool/vendor choice，或 reversal）时记录它；turn-level 或 trivial choice 不记录。使用 \`${binDir}/gstack-decision-log\`（reversal 用 \`--supersede <id>\`）。这是 reliable local path，不需要 gbrain。`;
}
