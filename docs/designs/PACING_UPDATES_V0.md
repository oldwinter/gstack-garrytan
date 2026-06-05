# Pacing Updates v0 — Design Doc（设计文档）

**Status（状态）：** V1.1 plan（尚未实现）。
**Extracted from（来源）：** 实现期间从 [PLAN_TUNING_V1.md](./PLAN_TUNING_V1.md) 抽出；当时严格 review 发现 pacing workstream 存在结构性缺口，无法只靠 plan-text editing 修复。
**Authors（作者）：** Garry Tan（user），并包含 Claude Opus 4.7 + OpenAI Codex gpt-5.4 协助的 reviews。
**Review plan（评审计划）：** CEO + Codex + DX + Eng cycle，与 V1 保持同等 rigor。

## Credit（致谢）

这个 plan 因 **[Louise de Sadeleer](https://x.com/LouiseDSadeleer/status/2045139351227478199)** 而存在。她在 architecture review 中的 “yes yes yes” 不只是关于 jargon（V1 已处理），也是关于 pacing 和 agency。太多 interruptive decisions，且 review 时间过长。V1.1 处理 pacing 这一半。

## 问题

Louise 阅读 gstack review output 的 fatigue 来自两个来源：

1. **Jargon density**：technical terms 出现时没有解释。*已在 V1 中处理（ELI10 writing）。*
2. **Interruption volume**：`/autoplan` 运行 4 phases（CEO + Design + Eng + DX），每个 phase 有 5-10 个 AskUserQuestion prompts。总计约 30-50 个 prompts，持续约 45 分钟。Non-technical users 在约 10-15 次 interruptions 后会 check out。**这就是 V1.1。**

仅靠翻译不能修复 interruption volume。翻译后的 interruption 仍然是 interruption。Fix 需要改变 findings surface 的 WHEN，而不只是 HOW wording（措辞方式）。

## 为什么它被 extract（来自 V1 第三轮 eng review + Codex pass 2 的 structural gaps）

V1 planning 中曾 draft 一个 pacing workstream：rank findings、auto-accept two-way doors、每个 review phase 最多 3 个 AskUserQuestion prompts、为 auto-accepted items 提供 Silent Decisions block、用 "flip <id>" command post-hoc re-open auto-accepted decisions。第三轮 eng-review pass + 第二轮 Codex pass surface 了 10 个无法通过 plan-text edits 关闭的 gaps：

1. **Session-state model undefined。** Pacing 需要 per-phase state（哪些 findings surfaced、哪些 auto-accepted、哪些 user 可 flip）。V1 有 glossing 用的 per-skill-invocation state，但没有 per-phase pacing memory 的 backing store。
2. **Phase identifier missing from question-log。** Silent Eng #8 想在一个 phase 内 > 3 prompts 时 warn。V0 的 `question-log.jsonl` 没有 `phase` field。V1 声称 “no schema change”，与 enforcement target 矛盾。
3. **Question registry != finding registry。** V0 的 `scripts/question-registry.ts` 覆盖的是 *questions*（skill definition time registered）。Review findings 是 *dynamic*（runtime discovered）。通过 registry enforce `door_type: one-way` 不能覆盖 ad-hoc findings。Agent 在 mid-review 生成的 findings 无法 enforce one-way-door safety。
4. **Pacing as prose 不能 invert existing control flow。** V1 计划向 preamble prose 添加 “rank findings, then ask” rule。但现有 skill templates（如 `plan-eng-review/SKILL.md.tmpl`）有 per-section STOP/AskUserQuestion sequences。Preamble 中的 prose rule 无法可靠 override hardcoded per-section STOP。Behavioral change 是 sequencing，不是 prompt wording。
5. **Flip mechanism has no implementation。** “Reply `flip <id>` to change” 只是 prose。没有 command parser、state store 或 replay behavior。如果 conversation compacts，Silent Decisions block 离开 context，original decision 就 lost。
6. **Migration prompt 本身是 interrupt。** V1 的 post-upgrade migration prompt（offering to restore V0 prose）会计入 V1.1 正要减少的 interruption budget。V1.1 必须决定：exempt from budget，还是 include as interrupt-1-of-N。
7. **First-run preamble prompts 也计数。** Louise 在 first run 看到所有这些：lake intro、telemetry、proactive、routing injection。它们是第一个 real skill 运行前的 interruptions。V1.1 必须 audit 哪些对 new users load-bearing，哪些可 defer 到 session N。
8. **Ranking formula 未用真实 data calibrate。** V1 考虑过 `product 0-8`（broken：`{0,1,2,4,8}` distribution），后来是 threshold >= 4 的 `sum 0-6`。但两者都未用 actual finding distribution validate。V1.1 应 instrument V0 question-log，measure real findings 的样子，再 calibrate。
9. **“Every one-way door surfaces” vs “max 3 per phase” 矛盾。** One-way cap = uncapped（safety）；two-way cap = 3。但 plan 同时有两条 rules，未说明 precedence。V1.1 必须声明：one-way doors surface uncapped regardless of phase budget。
10. **Undefined verification values。** V1 plan 中有 “Silent Decisions block >= N entries”，但 N 未定义；throughput JSON 中的 `active: true` field 也未定义。V1.1 要给出 concrete values。

## Scope for V1.1（范围）

1. **Define session-state model。** Per-skill-invocation vs per-phase vs per-conversation。Backing store：可能是 `~/.gstack/sessions/<session_id>/pacing-state.json`，记录每个 phase 中哪些 findings surfaced vs. auto-accepted。Cleanup：与 preamble 中现有 session tracking 相同 TTL。

2. **Add `phase` field to question-log.jsonl schema。** 按 review phase（CEO / Design / Eng / DX / other）classify 每个 AskUserQuestion。Migration：existing entries default to `"unknown"`。Non-breaking schema extension。

3. **Extend registry coverage for dynamic findings。** 两个选项，CEO review 时选择：
   - (a) Widen `scripts/question-registry.ts`，允许 runtime registration（ad-hoc IDs 仍会 logged + classified）。
   - (b) 添加 secondary runtime classifier `scripts/finding-classifier.ts`，用 pattern matching 把 finding text -> risk tier。

4. **Move pacing from preamble prose into skill-template control flow。** 更新每个 review skill template，使其：(i) internally complete phase，(ii) 用 `gstack-pacing-rank` binary rank findings，(iii) emit 最多 3 个 AskUserQuestion prompts，(iv) emit 包含其余 items 的 Silent Decisions block。不是 preamble rule，而是每个 template 中的 explicit sequence。

5. **Flip mechanism implementation。** 新 binary `bin/gstack-flip-decision`。Command parser 接受 user message 中的 `flip <id>`。从 pacing-state.json 查找 original decision。重新 open 为 explicit AskUserQuestion。New choice persists。

6. **Migration-prompt budget decision。** Explicit rule：one-shot migration prompts exempt from per-phase interruption budget。Rationale：它们在 review phases 开始前 fire，不在期间。

7. **First-run preamble audit。** Audit lake intro、telemetry、proactive、routing injection。逐项判断：对 first-time user 是否 load-bearing，还是 deferrable？Likely outcome：除 lake intro 外，全部 suppress until session 2+。Remaining ones 通过用户可 voluntary invoke 的 `/plan-tune first-run` command 提供。

8. **Ranking threshold calibration。** Instrument V0 question-log（已经运行，有 history）。Measure recent CEO + Eng + DX + Design reviews 中 `severity × irreversibility × user-decision-matters` 的 actual distribution。基于真实 data 选择 threshold。Target：约 20% findings surface，约 80% auto-accept。

9. **Explicit rule：one-way doors uncapped。** 在 skill template prose 中 hard-code：“one-way doors surface regardless of phase interruption budget.” Two-way findings cap at 3 per phase。

10. **Concrete verification values。** 为 Silent Decisions 定义 `N`（例如 non-trivial plan 期望 >= 5 entries），并用 concrete field names 定义 throughput JSON schema。

## Acceptance criteria for V1.1（验收标准）

- **Interruption count：** Louise（或类似 non-technical collaborator）在与 V0-baseline 相当的 plan 上 end-to-end rerun `/autoplan`。AskUserQuestion count <= V0 baseline 的 50%。（V1 会捕获这个 baseline transcript，供 V1.1 calibration 使用。）
- **One-way-door coverage：** 100% safety-critical decisions（`door_type: one-way` OR classifier-flagged dynamic findings）以 full technical detail 单独 surface。Uncapped。
- **Flip round-trip：** 用户输入 `flip test-coverage-bookclub-form`。Original auto-accepted decision 重新 open 为 AskUserQuestion。用户 new choice persists 到 Silent Decisions block（或如果用户 flip to explicit surfacing，则 removed）。
- **Per-phase observability：** `/plan-tune` 可以从 question-log.jsonl 的 new `phase` field 读取并显示任意 session 的 per-phase AskUserQuestion counts。
- **First-run reduction：** New users 在第一个 real skill 运行前看到 <= 1 个 meta-prompt（lake intro），相比 V1 的 4 个（lake + telemetry + proactive + routing）。
- **Human rerun：** Louise + Garry 独立做 qualitative reviews，与 V1 相同 pattern。

## Dependencies on V1（对 V1 的依赖）

V1.1 构建在 V1 infrastructure 上：
- `explain_level` config key + preamble echo pattern（A4）。
- Jargon list + Writing Style section（V1.1 的 interruption language 应遵守 ELI10 rules）。
- V0 dormancy negative tests（V1.1 也不会唤醒 5D psychographic machinery）。
- V1 captured Louise transcript（acceptance criterion calibration baseline）。

V1.1 不依赖任何 V2 items（E1 substrate wiring、narrative/vibe 等）。

## Review plan（评审计划）

- **Pre-work：** 从当前 V0 data capture real question-log distribution。作为 Scope #8 的 calibration input。
- **CEO review。** Premise challenge：pacing 是否是正确 fix，还是 V1.1 应考虑完全移除 phases？（例如，把 CEO + Design + Eng + DX collapse 为 single unified review pass。）Scope mode：SELECTIVE EXPANSION likely（pacing 是 core，相关 improvements cherry-pick）。
- **Codex review。** 对 V1.1 plan 做 independent pass。预计会特别 scrutinize control-flow change（Scope #4），因为这是 V1 struggled 的 area。
- **DX review。** Focus on flip mechanism 的 DX：`flip <id>` 是否 discoverable，command syntax 是否 natural，error path 是否清晰？
- **Eng review xN。** 预计 multiple passes，与 V1 相同。

## NOT touched in V1.1（V1.1 不涉及）

V2 items 继续 deferred：
- Confusion-signal detection
- 5D psychographic-driven skill adaptation（V0 E1）
- /plan-tune narrative + /plan-tune vibe（V0 E3）
- Per-skill 或 per-topic 的 explain levels
- Team profiles
- AST-based "delivered features" metric
