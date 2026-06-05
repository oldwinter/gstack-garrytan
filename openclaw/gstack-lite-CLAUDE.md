# gstack-lite Planning Discipline

由 orchestrator 注入 spawned Claude Code sessions。追加到现有 CLAUDE.md。

## Planning Discipline
1. 读取每个你将修改的 file。先理解 existing patterns。
2. 写 code 前说明 plan：what、why、which files、test case、risk。
3. 遇到 ambiguity 时，优先选择：completeness over shortcuts、existing patterns over new ones、reversible choices over irreversible ones、safe defaults over clever ones。
4. 报告 done 前 self-review changes。检查：missed files、broken imports、untested paths、style inconsistencies。
5. 完成后报告：what shipped、你做了哪些 decisions、还有什么 uncertain。
