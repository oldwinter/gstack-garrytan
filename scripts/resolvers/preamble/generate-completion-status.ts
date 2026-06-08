import type { TemplateContext } from '../types';

/**
 * Plan-mode-skill semantics block.
 *
 * Lives at the TOP of the preamble (position 1) so models read the authoritative
 * plan-mode rule before any other instructions. Replaces the vestigial
 * generate-plan-mode-handshake.ts that used to sit at this position and told
 * interactive review skills to emit an exit-and-rerun handshake instead of
 * running their interactive STOP-Ask workflow.
 *
 * Text is the same "Plan Mode Safe Operations" + "Skill Invocation During Plan
 * Mode" blocks that previously lived at the tail of generateCompletionStatus().
 * Only the position changes. All skills (not just interactive: true) see this.
 *
 * Composition position: index 1 in scripts/resolvers/preamble.ts — after
 * generatePreambleBash (so _SESSION_ID / _BRANCH / _TEL env vars exist before
 * any plan-mode-aware telemetry) and before generateUpgradeCheck + onboarding
 * gates. See ceo-plan 2026-04-24 "remove vestigial plan-mode handshake" for
 * the full rationale.
 */
export function generatePlanModeInfo(_ctx: TemplateContext): string {
  return `## Plan Mode Safe Operations（Plan mode 安全操作）

在 plan mode 中，以下操作允许执行，因为它们用于补充计划信息：\`$B\`、\`$D\`、\`codex exec\`/\`codex review\`、写入 \`~/.gstack/\`、写入 plan file，以及对生成 artifacts 使用 \`open\`。

## Skill Invocation During Plan Mode（Plan mode 中的 skill 调用）

如果用户在 plan mode 中调用 skill，skill 优先于通用 plan mode 行为。**把 skill 文件视为可执行指令，而不是参考资料。**从 Step 0 开始逐步执行；第一次 AskUserQuestion 是工作流进入 plan mode 的方式，不是违规。AskUserQuestion（任意变体：\`mcp__*__AskUserQuestion\` 或 native；见 "AskUserQuestion Format → Tool resolution"）满足 plan mode 的 turn-end 要求。如果 AskUserQuestion 不可用或 call fails，遵循 AskUserQuestion Format failure fallback：\`headless\` → BLOCKED；\`interactive\` → prose fallback（同样满足 end-of-turn）。遇到 STOP 点时立即停止。不要继续工作流，也不要在那里调用 ExitPlanMode。标记为 "PLAN MODE EXCEPTION — ALWAYS RUN" 的命令需要执行。仅在 skill 工作流完成后，或用户要求取消 skill / 离开 plan mode 时，才调用 ExitPlanMode。`;
}

export function generateCompletionStatus(ctx: TemplateContext): string {
  return `## Completion Status Protocol（完成状态协议）

完成 skill 工作流时，使用以下之一报告状态：
- **DONE** — 已完成，并附证据。
- **DONE_WITH_CONCERNS** — 已完成，但列出顾虑。
- **BLOCKED** — 无法继续；说明阻塞点和已尝试的操作。
- **NEEDS_CONTEXT** — 缺少信息；精确说明需要什么。

如果 3 次尝试失败、涉及不确定的安全敏感改动，或范围无法验证，则升级处理。格式：\`STATUS\`、\`REASON\`、\`ATTEMPTED\`、\`RECOMMENDATION\`。

## Operational Self-Improvement（操作自我改进）

完成前，如果你发现了可长期复用的项目 quirks 或命令修复、下次可节省 5 分钟以上，请记录：

\`\`\`bash
${ctx.paths.binDir}/gstack-learnings-log '{"skill":"SKILL_NAME","type":"operational","key":"SHORT_KEY","insight":"DESCRIPTION","confidence":N,"source":"observed"}'
\`\`\`

不要记录显而易见的事实或一次性 transient errors。

## Telemetry (run last)（Telemetry，最后运行）

工作流完成后记录 telemetry。使用 frontmatter 中的 skill \`name:\`。OUTCOME 为 success/error/abort/unknown。

**PLAN MODE EXCEPTION — ALWAYS RUN:** 此命令把 telemetry 写入
\`~/.gstack/analytics/\`，与 preamble analytics 写入一致。

运行以下 bash：

\`\`\`bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
rm -f ~/.gstack/analytics/.pending-"$_SESSION_ID" 2>/dev/null || true
# Session timeline：记录 skill 完成情况（仅本地，绝不发送到任何地方）
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"SKILL_NAME","event":"completed","branch":"'$(git branch --show-current 2>/dev/null || echo unknown)'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
# Local analytics（受 telemetry 设置控制）
if [ "$_TEL" != "off" ]; then
echo '{"skill":"SKILL_NAME","duration_s":"'"$_TEL_DUR"'","outcome":"OUTCOME","browse":"USED_BROWSE","session":"'"$_SESSION_ID"'","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
# Remote telemetry（opt-in，需要 binary）
if [ "$_TEL" != "off" ] && [ -x ~/.claude/skills/gstack/bin/gstack-telemetry-log ]; then
  ~/.claude/skills/gstack/bin/gstack-telemetry-log \\
    --skill "SKILL_NAME" --duration "$_TEL_DUR" --outcome "OUTCOME" \\
    --used-browse "USED_BROWSE" --session-id "$_SESSION_ID" 2>/dev/null &
fi
\`\`\`

运行前替换 \`SKILL_NAME\`、\`OUTCOME\` 和 \`USED_BROWSE\`。

## Plan Status Footer（计划状态页脚）

运行 plan reviews 的 skills（\`/plan-*-review\`、\`/codex review\`）会在 skill 末尾包含 EXIT PLAN MODE GATE 阻塞 checklist；它会在调用 ExitPlanMode 前验证 plan file 以 \`## GSTACK REVIEW REPORT\` 结尾。不运行 plan reviews 的 skills（如 \`/ship\`、\`/qa\`、\`/review\` 这类 operational skills）通常不在 plan mode 中运行，也没有 review report 需要验证；此 footer 对它们是 no-op。写入 plan file 是 plan mode 中唯一允许的编辑。`;
}
