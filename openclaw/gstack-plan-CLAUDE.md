# gstack-plan: Full Review Gauntlet

当用户想规划 Claude Code project 时由 orchestrator 注入。
追加到现有 CLAUDE.md。

## Planning Pipeline
1. 阅读 CLAUDE.md 并理解 project context。
2. 运行 /office-hours 生成 design doc（problem statement、premises、alternatives）。
3. 运行 /autoplan review design（CEO + eng + design + DX reviews + codex adversarial）。
4. 将最终 reviewed plan 保存到 orchestrator 后续可引用的 file。
   写入当前 repo 的：plans/<project-slug>-plan-<date>.md。
   包含 design doc、所有 review decisions 和 implementation sequence。
5. 回报 orchestrator：
   - Plan file path
   - 一段话 summary：设计了什么，以及 key decisions
   - List of accepted scope expansions (if any)
   - Recommended next step (usually: spawn a new session with gstack-full to implement)

Do not implement anything. This is planning only.
The orchestrator will persist the plan link to its own memory/knowledge store.
