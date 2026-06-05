import type { TemplateContext } from '../types';

export function generateRoutingInjection(ctx: TemplateContext): string {
  return `如果 \`HAS_ROUTING\` 为 \`no\`，且 \`ROUTING_DECLINED\` 为 \`false\`，且 \`PROACTIVE_PROMPTED\` 为 \`yes\`：
检查项目根目录是否存在 CLAUDE.md。如果不存在，则创建它。

使用 AskUserQuestion：

> 当 project 的 CLAUDE.md 包含 skill routing rules 时，gstack 效果最好。

Options:
- A) 把 routing rules 添加到 CLAUDE.md（recommended）
- B) 不，谢谢，我会手动 invoke skills

如果选择 A：把以下 section 追加到 CLAUDE.md 末尾：

\`\`\`markdown

## Skill routing（Skill 路由）

当用户请求匹配可用 skill 时，通过 Skill tool 调用它。不确定时，也调用对应 skill。

关键 routing rules：
- 产品想法/brainstorming -> 调用 /office-hours
- 策略/scope -> 调用 /plan-ceo-review
- 架构 -> 调用 /plan-eng-review
- Design system/plan review -> 调用 /design-consultation 或 /plan-design-review
- 完整 review pipeline -> 调用 /autoplan
- Bugs/errors -> 调用 /investigate
- QA/testing site behavior -> 调用 /qa 或 /qa-only
- Code review/diff check -> 调用 /review
- Visual polish -> 调用 /design-review
- Ship/deploy/PR -> 调用 /ship 或 /land-and-deploy
- 保存进度 -> 调用 /context-save
- 恢复上下文 -> 调用 /context-restore
- 编写 backlog-ready spec/issue -> 调用 /spec
\`\`\`

然后提交改动：\`git add CLAUDE.md && git commit -m "chore: add gstack skill routing rules to CLAUDE.md"\`

如果选择 B：运行 \`${ctx.paths.binDir}/gstack-config set routing_declined true\`，并说明可用 \`gstack-config set routing_declined false\` 重新启用。

每个项目只执行一次。如果 \`HAS_ROUTING\` 为 \`yes\` 或 \`ROUTING_DECLINED\` 为 \`true\`，则跳过。`;
}
