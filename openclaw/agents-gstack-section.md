## Coding Tasks (gstack)

### Rules（non-negotiable）

1. **Always spawn, never redirect.** 当 user 要求使用任何 gstack skill 时，始终通过 sessions_spawn spawn 一个 Claude Code session。不要告诉 user 自己打开 Claude Code。不要说 "this needs to run in Claude Code." 也不要说 "you'll need to open Claude Code for that." 直接执行。

2. **Resolve the repo.** 如果 user 提到 repo 或 project，把 working directory 设到对应 repo path。如果不知道 repo path，就询问哪个 repo；不要把问题推回成让 user 打开 Claude Code。

3. **Autoplan runs end-to-end.** 对 `/autoplan`：spawn session，让它跑完整 review pipeline（CEO → design → eng），完成后把 plan 回报到当前 chat。把 plan 写入 memory，方便 user 之后找到。User 永远不应该为了这个离开 Telegram。

### Dispatch Routing

当收到 coding work 请求时，选择 dispatch tier：

**SIMPLE:** "fix this typo," "update that config," single-file changes
→ sessions_spawn(runtime: "acp", prompt: "<just the task>")

**MEDIUM:** multi-file features, refactors, skill edits
→ sessions_spawn(runtime: "acp", prompt: "<gstack-lite content>\n\n<task>")

**HEAVY:** needs a specific gstack methodology
→ sessions_spawn(runtime: "acp", prompt: "Load gstack. Run /qa https://...")
  Skills: /cso, /review, /qa, /ship, /investigate, /design-review, /benchmark, /gstack-upgrade

**FULL:** 构建完整 feature、multi-day scope、需要 planning + review
→ sessions_spawn(runtime: "acp", prompt: "<gstack-full content>\n\n<task>")
  Claude Code runs: /autoplan → implement → /ship → report back

**PLAN:** user 想在写任何 code 之前规划 Claude Code project、spec out feature，或设计某个方案
→ sessions_spawn(runtime: "acp", prompt: "<gstack-plan content>\n\n<task>")
  Claude Code runs: /office-hours → /autoplan → saves plan file → reports back
  将 plan link 持久化到 memory/knowledge store。
  当 user 准备 implement 时，spawn 一个新的 FULL session 指向该 plan。

### Decision Heuristic

- 是否能用 <10 lines of code 完成？→ **SIMPLE**
- 是否触碰 multiple files 但 approach 很明确？→ **MEDIUM**
- user 是否点名 specific skill（/cso、/review、/qa）？→ **HEAVY**
- "Upgrade gstack", "update gstack" → **HEAVY** with `Run /gstack-upgrade`
- 它是 feature、project 或 objective（不是单个 task）吗？→ **FULL**
- user 是否想先 PLAN 而暂不 implement？→ **PLAN**
