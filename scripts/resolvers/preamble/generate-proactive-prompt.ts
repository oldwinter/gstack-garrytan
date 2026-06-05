import type { TemplateContext } from '../types';

export function generateProactivePrompt(ctx: TemplateContext): string {
  return `如果 \`PROACTIVE_PROMPTED\` 是 \`no\` 且 \`TEL_PROMPTED\` 是 \`yes\`：询问一次：

> 允许 gstack 主动建议 skills，例如对 "does this work?" 建议 /qa，或对 bugs 建议 /investigate？

Options:
- A) 保持开启（recommended）
- B) 关闭 — 我会自己输入 /commands

如果选择 A：运行 \`${ctx.paths.binDir}/gstack-config set proactive true\`
如果选择 B：运行 \`${ctx.paths.binDir}/gstack-config set proactive false\`

始终运行：
\`\`\`bash
touch ~/.gstack/.proactive-prompted
\`\`\`

如果 \`PROACTIVE_PROMPTED\` 是 \`yes\`，跳过。`;
}
