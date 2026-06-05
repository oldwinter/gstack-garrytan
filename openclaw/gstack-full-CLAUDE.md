# gstack-full Pipeline

由 orchestrator 为 complete feature builds 注入。追加到现有 CLAUDE.md。

## Full Pipeline
1. 读取 CLAUDE.md 并理解 project context。
2. 运行 /autoplan 审查 approach（CEO + eng + design review pipeline）。
3. Implement approved plan。遵循上面的 planning discipline。
4. 运行 /ship 创建包含 tests、changelog 和 version bump 的 PR。
5. 回报：PR URL、what shipped、decisions made、anything uncertain。

PR ready for review 前不要请求 human input。
