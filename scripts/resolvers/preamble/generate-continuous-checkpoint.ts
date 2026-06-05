

export function generateContinuousCheckpoint(): string {
  return `## Continuous Checkpoint Mode（连续 checkpoint 模式）

如果 \`CHECKPOINT_MODE\` 是 \`"continuous"\`：用 \`WIP:\` prefix 自动提交已完成的 logical units。

在新增 intentional files、完成 functions/modules、验证 bug fixes 后提交；在 long-running install/build/test commands 前也提交。

Commit format（提交格式）：

\`\`\`
WIP: <concise description of what changed>

[gstack-context]
Decisions: <key choices made this step>
Remaining: <what's left in the logical unit>
Tried: <failed approaches worth recording> (omit if none)
Skill: </skill-name-if-running>
[/gstack-context]
\`\`\`

规则：只 stage intentional files，绝不 \`git add -A\`；不要提交 broken tests 或 mid-edit state；只有 \`CHECKPOINT_PUSH\` 为 \`"true"\` 时才 push。不要逐个宣布 WIP commit。

\`/context-restore\` 会读取 \`[gstack-context]\`；\`/ship\` 会把 WIP commits squash 成 clean commits。

如果 \`CHECKPOINT_MODE\` 是 \`"explicit"\`：忽略此 section，除非某个 skill 或用户要求 commit。`;
}
