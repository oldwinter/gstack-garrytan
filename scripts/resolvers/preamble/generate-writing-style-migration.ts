import type { TemplateContext } from '../types';

export function generateWritingStyleMigration(ctx: TemplateContext): string {
  return `如果 \`WRITING_STYLE_PENDING\` 是 \`yes\`：询问一次 writing style：

> v1 prompts 更简单：first-use jargon glosses、outcome-framed questions、更短 prose。保留 default，还是恢复 terse？

Options:
- A) 保留新 default（recommended — good writing helps everyone）
- B) 恢复 V0 prose — 设置 \`explain_level: terse\`

如果选择 A：保持 \`explain_level\` unset（默认为 \`default\`）。
如果选择 B：运行 \`${ctx.paths.binDir}/gstack-config set explain_level terse\`。

无论选择什么，始终运行：
\`\`\`bash
rm -f ~/.gstack/.writing-style-prompt-pending
touch ~/.gstack/.writing-style-prompted
\`\`\`

如果 \`WRITING_STYLE_PENDING\` 是 \`no\`，跳过。`;
}
