# gstack-full Pipeline

由 orchestrator 为 complete feature builds 注入。追加到现有 CLAUDE.md。

## Full Pipeline
1. 阅读 CLAUDE.md 并理解 project context。
2. 运行 /autoplan review 你的 approach（CEO + eng + design review pipeline）。
3. 实现 approved plan。遵循上面的 planning discipline。
4. 运行 /ship 创建带 tests、changelog 和 version bump 的 PR。
5. 回报：PR URL、ship 了什么、做了哪些 decisions、还有什么 uncertain。

PR ready for review 之前，不要请求 human input。
