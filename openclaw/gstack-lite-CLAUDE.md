# gstack-lite Planning Discipline

由 orchestrator 注入 spawned Claude Code sessions。追加到现有 CLAUDE.md。

## Planning Discipline
1. 阅读你将修改的每个 file。先理解 existing patterns。
2. 写 code 前说明 plan：做什么、为什么、哪些 files、test case、risk。
3. 遇到 ambiguous 情况时，优先：completeness over shortcuts、existing patterns over new ones、
   reversible choices over irreversible ones、safe defaults over clever ones。
4. 报告完成前先 self-review changes。检查：missed files、broken imports、untested paths、style inconsistencies。
5. 完成后报告：ship 了什么、做了哪些 decisions、还有什么 uncertain。
