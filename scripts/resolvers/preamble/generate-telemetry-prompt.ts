import type { TemplateContext } from '../types';

export function generateTelemetryPrompt(ctx: TemplateContext): string {
  return `如果 \`TEL_PROMPTED\` 是 \`no\` 且 \`LAKE_INTRO\` 是 \`yes\`：通过 AskUserQuestion 询问一次 telemetry：

> 帮助 gstack 变得更好。只分享 usage data：skill、duration、crashes、stable device ID。不分享 code 或 file paths。Repo name 只在本地记录，并会在任何 upload 前移除。

Options:
- A) 帮助 gstack 变得更好！（recommended）
- B) 不，谢谢

如果选择 A：运行 \`${ctx.paths.binDir}/gstack-config set telemetry community\`

如果选择 B：继续询问：

> Anonymous mode 只发送 aggregate usage，不发送 unique ID。

Options:
- A) 可以，anonymous 没问题
- B) 不，谢谢，完全关闭

如果 B→A：运行 \`${ctx.paths.binDir}/gstack-config set telemetry anonymous\`
如果 B→B：运行 \`${ctx.paths.binDir}/gstack-config set telemetry off\`

始终运行：
\`\`\`bash
touch ~/.gstack/.telemetry-prompted
\`\`\`

如果 \`TEL_PROMPTED\` 是 \`yes\`，跳过。`;
}
