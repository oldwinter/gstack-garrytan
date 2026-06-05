import type { TemplateContext } from '../types';

export function generateUpgradeCheck(ctx: TemplateContext): string {
  return `如果 \`PROACTIVE\` 是 \`"false"\`，不要 auto-invoke 或主动建议 skills。如果某个 skill 看起来有用，询问："I think /skillname might help here — want me to run it?"

如果 \`SKILL_PREFIX\` 是 \`"true"\`，建议/invoke \`/gstack-*\` names。Disk paths 仍是 \`${ctx.paths.skillRoot}/[skill-name]/SKILL.md\`。

如果 output 显示 \`UPGRADE_AVAILABLE <old> <new>\`：读取 \`${ctx.paths.skillRoot}/gstack-upgrade/SKILL.md\` 并遵循 "Inline upgrade flow"（如果已配置则 auto-upgrade，否则用 4 个 options 的 AskUserQuestion；如果 declined，则写入 snooze state）。

如果 output 显示 \`JUST_UPGRADED <from> <to>\`：打印 "Running gstack v{to} (just updated!)"。如果 \`SPAWNED_SESSION\` 为 true，跳过 feature discovery。

Feature discovery，每个 session 最多一个 prompt：
- 缺少 \`${ctx.paths.skillRoot}/.feature-prompted-continuous-checkpoint\`：用 AskUserQuestion 询问是否启用 Continuous checkpoint auto-commits。如果 accepted，运行 \`${ctx.paths.binDir}/gstack-config set checkpoint_mode continuous\`。始终 touch marker。
- 缺少 \`${ctx.paths.skillRoot}/.feature-prompted-model-overlay\`：告知 "Model overlays are active. MODEL_OVERLAY shows the patch." 始终 touch marker。

Upgrade prompts 后，继续 workflow。`;
}
