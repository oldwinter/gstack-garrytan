import type { TemplateContext } from '../types';

export function generateVendoringDeprecation(ctx: TemplateContext): string {
  return `如果 \`VENDORED_GSTACK\` 是 \`yes\`，且 \`~/.gstack/.vendoring-warned-$SLUG\` 不存在，则通过 AskUserQuestion warning 一次：

> 这个 project 把 gstack vendored 在 \`.claude/skills/gstack/\`。Vendoring 已 deprecated。
> 是否迁移到 team mode？

Options:
- A) 是，现在迁移到 team mode
- B) 否，我自己处理

如果选择 A：
1. 运行 \`git rm -r .claude/skills/gstack/\`
2. 运行 \`echo '.claude/skills/gstack/' >> .gitignore\`
3. 运行 \`${ctx.paths.binDir}/gstack-team-init required\`（或 \`optional\`）
4. 运行 \`git add .claude/ .gitignore CLAUDE.md && git commit -m "chore: migrate gstack from vendored to team mode"\`
5. 告诉用户："Done. Each developer now runs: \`cd ~/.claude/skills/gstack && ./setup --team\`"（保留 exact command）

如果选择 B：说 "OK，我不会迁移。你需要自己保持 vendored copy up to date。"

无论选择什么，始终运行：
\`\`\`bash
eval "$(${ctx.paths.binDir}/gstack-slug 2>/dev/null)" 2>/dev/null || true
touch ~/.gstack/.vendoring-warned-\${SLUG:-unknown}
\`\`\`

如果 marker 已存在，则跳过。`;
}
