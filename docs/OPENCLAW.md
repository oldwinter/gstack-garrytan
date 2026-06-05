# gstack x OpenClaw 集成

gstack 以 methodology source 的形式与 OpenClaw 集成，而不是作为 ported codebase。
OpenClaw 的 ACP runtime 会原生 spawn Claude Code sessions。gstack 提供 planning
discipline 和 methodology，让这些 sessions 表现更好。

这是一个编码为 prompt text 的 lightweight protocol。没有 daemon。没有 JSON-RPC。
没有 compatibility matrices。Prompt 就是 bridge。

## 架构

```
  OpenClaw                               gstack repo
  ─────────────────────                    ──────────────
  Orchestrator: messaging,                 Source of truth for
  calendar, memory, EA                     methodology + planning
       │                                        │
       ├── Native skills (conversational)       ├── Generates native skills
       │   office-hours, ceo-review,            │   via gen-skill-docs pipeline
       │   investigate, retro                   │
       │                                        ├── Generates gstack-lite
       ├── sessions_spawn(runtime: "acp")       │   (planning discipline)
       │       │                                │
       │       └── Claude Code                  ├── Generates gstack-full
       │           └── gstack installed at      │   (complete pipeline)
       │               ~/.claude/skills/gstack  │
       │                                        └── docs/OPENCLAW.md (this file)
       └── Dispatch routing (AGENTS.md)
```

## Dispatch Routing（分发路由）

OpenClaw 会在 spawn time 决定使用哪个 tier 的 gstack support：

| Tier | 使用时机 | Prompt prefix |
|------|------|---------------|
| **Simple** | One-file edits、typos、config changes | 不注入 gstack context |
| **Medium** | Multi-file features、refactors | append gstack-lite CLAUDE.md |
| **Heavy** | 需要 specific gstack skill | "Load gstack. Run /X" |
| **Full** | Complete features、objectives、projects | append gstack-full pipeline |
| **Plan** | "Help me plan a Claude Code project" | append gstack-plan pipeline |

### Decision heuristic（决策启发式）

- 是否能用 <10 lines of code 完成？-> **Simple**
- 是否 touch multiple files，但 approach 明显？-> **Medium**
- 用户是否点名 specific skill（/cso、/review、/qa）？-> **Heavy**
- 它是否是 feature、project 或 objective（不是 task）？-> **Full**
- 用户是否想为 Claude Code PLAN 某件事，但暂不 implement？-> **Plan**

### Dispatch routing guide（用于 AGENTS.md）

完整 ready-to-paste section 位于 `openclaw/agents-gstack-section.md`。
把它 copy 到你的 OpenClaw AGENTS.md。

Key behavioral rules（这些放在 dispatch tiers 上方）：

1. **Always spawn, never redirect。** 当用户要求使用任何 gstack skill 时，
   始终 spawn 一个 Claude Code session。永远不要让用户自己打开 Claude Code。
2. **Resolve the repo。** 如果用户指定 repo，设置 working directory。如果未知，
   询问使用哪个 repo。
3. **Autoplan runs end-to-end。** Spawn，让它运行完整 pipeline，并在 chat 中汇报。
   用户永远不应离开 Telegram。

### CLAUDE.md collision handling（CLAUDE.md 冲突处理）

当在已有 CLAUDE.md 的 repo 中 spawn Claude Code 时，把 gstack-lite/full 作为新 section
APPEND。不要替换 repo 现有 instructions。

## gstack 为 OpenClaw 生成什么

所有 artifacts 都位于 `openclaw/` directory，并由
`bun run gen:skill-docs --host openclaw` 生成：

### gstack-lite（Medium tier）
`openclaw/gstack-lite-CLAUDE.md`：约 15 行 planning discipline：
1. 修改前阅读 every file
2. 写 5-line plan：what、why、which files、test case、risk
3. 使用 decision principles 解决 ambiguity
4. 报告 done 前 self-review
5. Completion report：what shipped、decisions made、anything uncertain

A/B tested：耗时约 2x，但 output 明显更好。

### gstack-full（Full tier）
`openclaw/gstack-full-CLAUDE.md`：串联 existing gstack skills：
1. 阅读 CLAUDE.md 并理解 project
2. 运行 /autoplan（CEO + eng + design review）
3. 实现 approved plan
4. 运行 /ship 创建 PR
5. 回报 PR URL 和 decisions

### gstack-plan（Plan tier）
`openclaw/gstack-plan-CLAUDE.md`：full review gauntlet，不 implementation：
1. 运行 /office-hours 产出 design doc
2. 运行 /autoplan（CEO + eng + design + DX reviews + codex adversarial）
3. 把 reviewed plan 保存到 `plans/<project-slug>-plan-<date>.md`
4. 回报：plan path、summary、key decisions、recommended next step

Orchestrator 会把 plan link 持久化到自己的 memory store（brain repo、knowledge base，
或 AGENTS.md 中配置的任何位置）。当用户 ready to build 时，spawn 一个引用 saved plan
的 FULL session。

### Native methodology skills（原生 methodology skills）
发布到 ClawHub。使用 `clawhub install` 安装：
- `gstack-openclaw-office-hours`：Product interrogation（6 forcing questions）
- `gstack-openclaw-ceo-review`：Strategic challenge（10-section review，4 modes）
- `gstack-openclaw-investigate`：Operational debugging（4-phase methodology）
- `gstack-openclaw-retro`：Operational retrospective（weekly review）

Source 位于 gstack repo 的 `openclaw/skills/`。这些是针对 OpenClaw conversational
context 手工制作的 gstack methodology adaptations。没有 gstack infrastructure
（no browse、no telemetry、no preamble）。

## Spawned session detection（spawned session 检测）

当 Claude Code 在 OpenClaw spawned session 内运行时，应设置 `OPENCLAW_SESSION`
environment variable。gstack 会检测它并调整：
- 跳过 interactive prompts（自动选择 recommended options）
- 跳过 upgrade checks 和 telemetry prompts
- 聚焦 task completion 和 prose reporting

在 sessions_spawn 中设置 env var：`env: { OPENCLAW_SESSION: "1" }`

## 安装

OpenClaw users：告诉你的 OpenClaw agent "install gstack for openclaw."

Agent 应该：
1. 把 gstack-lite CLAUDE.md 安装到 coding session templates
2. 安装 4 个 native methodology skills
3. 把 dispatch routing 添加到 AGENTS.md
4. 用 test spawn 验证

gstack developers：`./setup --host openclaw` 会输出本文档。
实际 artifacts 由 `bun run gen:skill-docs --host openclaw` 生成。

## 我们不做什么

- No dispatch daemon（ACP 负责 session spawning）
- No Clawvisor relay（不需要 security layer）
- No bidirectional learnings bridge（brain repo 是 knowledge store）
- No JSON schemas 或 protocol versioning
- No gstack SOUL.md（OpenClaw 有自己的）
- No full skill porting（coding skills 保持 Claude Code native）
