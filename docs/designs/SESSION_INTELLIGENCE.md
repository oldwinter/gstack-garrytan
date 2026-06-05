# Session Intelligence Layer（Session 智能层）

## 问题

Claude Code 的 context window 是 ephemeral。每个 session 都从空白开始。当 auto-compaction 在约 167K tokens 触发时，它会保留 generic summary，但会销毁 file reads、reasoning chains 和 intermediate decisions。

gstack 已经会产出能在磁盘上存活的有价值 artifacts：CEO plans、eng reviews、design reviews、QA reports、learnings。这些文件包含塑造当前工作的 decisions、constraints 和 context。但 Claude 不知道它们存在。Compaction 后，曾经支撑每个决定的 plans 和 reviews 会从 context 中静默消失。

生态系统正在处理这个方向。claude-mem（9K+ stars）捕获 tool usage，并把 context 注入未来 sessions。Claude HUD 显示实时 agent status。Anthropic 自己的 `claude-progress.txt` pattern 使用一个 progress file，让 agents 在每个 session 开始时读取。

没人正在解决一个特定问题：让 **skill-produced artifacts** 在 compaction 后继续存活。因为没人拥有 gstack 的 artifact architecture。

## 洞察

gstack 已经把 structured artifacts 写入 `~/.gstack/projects/$SLUG/`：
- CEO plans：`ceo-plans/`
- Design reviews：`design-reviews/`
- Eng reviews：`eng-reviews/`
- Learnings：`learnings.jsonl`
- Skill usage：`../analytics/skill-usage.jsonl`

缺失的不是 storage，而是 awareness。Preamble 需要告诉 agent：“这些文件存在。它们包含你已经做过的 decisions。Compaction 后，重新读取它们。”

## 架构

```
                   ┌─────────────────────────────────────┐
                   │        Claude Context Window         │
                   │   (ephemeral, ~167K token limit)     │
                   │                                      │
                   │   Compaction fires ──► summary only   │
                   └──────────────┬──────────────────────┘
                                  │
                          reads on start / after compaction
                                  │
                   ┌──────────────▼──────────────────────┐
                   │    ~/.gstack/projects/$SLUG/         │
                   │    (persistent, survives everything) │
                   │                                      │
                   │  ceo-plans/         ← /plan-ceo-review
                   │  eng-reviews/       ← /plan-eng-review
                   │  design-reviews/    ← /plan-design-review
                   │  checkpoints/       ← /checkpoint (new)
                   │  timeline.jsonl     ← every skill (new)
                   │  learnings.jsonl    ← /learn
                   └─────────────────────────────────────┘
                                  │
                          rolled up weekly
                                  │
                   ┌──────────────▼──────────────────────┐
                   │           /retro                      │
                   │  Timeline: 3 /review, 2 /ship, ...   │
                   │  Health trends: compile 8/10 (↑2)     │
                   │  Learnings applied: 4 this week       │
                   └─────────────────────────────────────┘
```

## Features（功能）

### Layer 1：Context Recovery（preamble, all skills）

Preamble 中约 10 行 prose。Compaction 或 context degradation 后，agent 检查 `~/.gstack/projects/$SLUG/` 中最近的 plans、reviews 和 checkpoints。列出目录，读取最新文件。

Cost：接近零。Benefit：每个 skill 的 plans/reviews 都能穿过 compaction。

### Layer 2：Session Timeline（preamble, all skills）

每个 skill 向 `timeline.jsonl` 追加一行 JSONL entry：timestamp、skill name、branch、key outcome。`/retro` 渲染它。

让项目的 AI-assisted work history 可见。“This week: 3 /review, 2 /ship, 1 /investigate across branches feature-auth and fix-billing.”

### Layer 3：Cross-Session Injection（preamble, all skills）

当一个新 session 在有 recent artifacts 的 branch 上开始时，preamble 打印一行：“Last session: implemented JWT auth, 3/5 tasks done. Plan: ~/.gstack/projects/$SLUG/checkpoints/latest.md”

Agent 在读取任何文件之前，就知道你上次停在哪里。

### Layer 4：/checkpoint（opt-in skill）

手动保存 working state snapshot：正在做什么、正在编辑哪些文件、做过哪些 decisions、剩余什么。适用于离开前、复杂操作前、workspace handoffs，或几天后回来继续。

### Layer 5：/health（opt-in skill）

Code quality dashboard：type-check、lint、test suite、dead code scan。Composite 0-10 score。跟踪随时间变化。`/retro` 显示 trends。`/ship` 按 configurable threshold gate。

## Compounding Effect（复利效应）

每个 feature 都独立有用。组合起来，它们会产生 compound：

Session 1：/plan-ceo-review 产出 plan。保存到磁盘。
Session 2：Agent 在 preamble 后读取 plan。不重新询问 decisions。
Session 3：/checkpoint 保存进度。Timeline 显示 2 /review、1 /ship。
Session 4：Compaction 在 refactor 中途触发。Agent 重新读取 checkpoint。
           恢复 key decisions、types、remaining work。继续执行。
Session 5：/retro 汇总这一周。Health trend：6/10 → 8/10。
           Timeline 显示跨 3 branches 的 12 次 skill invocations。

项目的 AI history 不再 ephemeral。它会持久化、compound，并让未来每个 session 更聪明。这就是 session intelligence layer。

## 这不是什么

- 不是 Claude built-in compaction 的替代品（它处理 session state；我们处理 gstack artifacts）
- 不是 claude-mem 那样的完整 memory system（它通过 SQLite 处理 cross-session memory；我们处理 structured skill artifacts）
- 不是 database 或 service（只是磁盘上的 markdown files）

## Research Sources（研究来源）

- [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Anthropic: Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [claude-mem](https://github.com/thedotmack/claude-mem)
- [Claude HUD](https://github.com/jarrodwatts/claude-hud)
- [CodeScene: Agentic AI coding best practices](https://codescene.com/blog/agentic-ai-coding-best-practice-patterns-for-speed-with-quality)
- [Post-compaction recovery via git-persisted state (Beads)](https://dev.to/jeremy_longshore/building-post-compaction-recovery-for-ai-agent-workflows-with-beads-207l)
