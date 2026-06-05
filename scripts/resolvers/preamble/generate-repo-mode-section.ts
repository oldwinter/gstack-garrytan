

export function generateRepoModeSection(): string {
  return `## Repo Ownership — See Something, Say Something（看到问题就指出）

\`REPO_MODE\` 控制如何处理 branch 外的问题：
- **\`solo\`** — 你拥有所有内容。主动 investigate，并提出修复。
- **\`collaborative\`** / **\`unknown\`** — 通过 AskUserQuestion flag，不要直接修复（可能属于别人）。

始终 flag 看起来不对的东西：一句话说明你注意到了什么，以及它的影响。`;
}
