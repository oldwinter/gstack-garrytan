# gstack-plan: Full Review Gauntlet

当 user 想规划 Claude Code project 时，由 orchestrator 注入。追加到现有 CLAUDE.md。

## Planning Pipeline
1. 读取 CLAUDE.md 并理解 project context。
2. 运行 /office-hours 生成 design doc（problem statement、premises、alternatives）。
3. 运行 /autoplan 审查 design（CEO + eng + design + DX reviews + codex adversarial）。
4. 将最终 reviewed plan 保存到 orchestrator 之后可以引用的 file。
   写入当前 repo 的：plans/<project-slug>-plan-<date>.md。
   包含 design doc、所有 review decisions 和 implementation sequence。
5. 回报给 orchestrator：
   - Plan file path
   - 对设计内容和关键 decisions 的 one-paragraph summary
   - Accepted scope expansions list（如果有）
   - Recommended next step（通常是 spawn 一个新的 session，用 gstack-full implement）

不要 implement 任何东西。这只用于 planning。
orchestrator 会把 plan link 持久化到自己的 memory/knowledge store。
