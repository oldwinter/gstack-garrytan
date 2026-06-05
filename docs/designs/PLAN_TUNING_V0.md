# Plan Tuning v0 — Design Doc（设计文档）

**Status（状态）：** 已批准进入 v1 implementation
**Branch（分支）：** garrytan/plan-tune-skill
**Authors（作者）：** Garry Tan（user），评审由 Claude Opus 4.7 + OpenAI Codex gpt-5.4 协助
**Date（日期）：** 2026-04-16

## 本文档是什么

这是 `/plan-tune` v1 的 canonical record：它是什么、不是什么、我们考虑过什么，以及为什么做出每个决定。提交到 repo 中，是为了让未来 contributors（以及未来的 Garry）不需要考古就能追踪推理。它取代两个 `~/.gstack/projects/` artifacts（office-hours design doc + CEO plan），后者是每个用户本地保存的记录。

## 一段话说明这个 feature

gstack 的 40+ skills 会频繁触发 AskUserQuestion。Power users 一遍又一遍以同样方式回答同样问题，却没有办法告诉 gstack “stop asking me this”。更根本的是，gstack 没有模型来理解每个用户偏好如何 steer their work：scope-appetite、risk-tolerance、detail-preference、autonomy、architecture-care。因此每个 skill 的 defaults 都对所有人采用 middle-of-the-road。`/plan-tune` v1 构建 schema + observation layer：typed question registry、per-question explicit preferences、inline "tune:" feedback，以及可用 plain English inspect 的 profile（declared + inferred dimensions）。它还不会基于 profile 适配 skill behavior。那是 v2 的事，要等 v1 证明 substrate 可用之后。

## 为什么我们构建更小版本

这个 feature 一开始是完整 adaptive substrate：psychographic dimensions 驱动 auto-decisions、blind-spot coaching、LANDED celebration HTML page，全都打包进去。四轮 review（office-hours、CEO EXPANSION、DX POLISH、eng review）都 cleared。然后 outside voice（Codex）给出了 20-point critique。Critical findings 按优先级如下：

1. **"Substrate" 是假的。** Plan 让 5 个 skills 在 preamble 中读取 profile，但 AskUserQuestion 是 prompt convention，不是 middleware。Agents 可以静默跳过 instructions。你不能在无法强制执行的 convention 上可靠构建 auto-decide。没有 typed question registry 且每个 AskUserQuestion 都 route through 它，substrate claim 就只是 marketing。
2. **Internal logical contradictions。** E4（blind-spot）+ E6（mismatch）+ declared dimensions 上的 ±0.2 clamp 不能组合。如果 user self-declaration 通过 clamp 成为 ground truth，E6 的 mismatch detection 只是在检测 noise。如果 behavior 可以修正 profile，那么 clamp 又 suppress 了 E6 需要的 signal。
3. **Profile poisoning。** Inline "tune: never ask" 可能由 malicious repo content（README、PR description、tool output）发出，agent 会 dutifully write it。之前没有 review 抓到这个 security gap。
4. **E5 LANDED page in preamble。** 每个 skill 的 preamble 中运行 `gh pr view` + HTML write + browser open，会把 latency、auth failures、rate limits、surprise browser opens 和 nondeterminism 注入 hottest path。
5. **Implementation order was backwards。** Plan 从 classifiers 和 bins 开始。正确顺序：先构建 integration point（typed question registry），再 infrastructure，最后 consumers。

权衡 Codex 的论点后，我们选择回滚 CEO EXPANSION，ship 一个 observational v1，以真实 typed registry 作为 foundation。Psychographic 只有在 registry 证明 production durable 后，才会变成 behavioral。

## v1 Scope（现在构建什么）

1. **Typed question registry**（`scripts/question-registry.ts`）。gstack 使用的每个 AskUserQuestion 都声明为 `{id, skill, category, door_type, options[], signal_key?}`。Schema-governed。
2. **CI enforcement。** Lint test（gate tier）断言 SKILL.md.tmpl files 中的每个 AskUserQuestion pattern 都有 matching registry entry。Drift、renames 或 duplicates 会让 CI fail。
3. **Question logging（问题记录）**（`bin/gstack-question-log`）。向 `~/.gstack/projects/{SLUG}/question-log.jsonl` append `{ts, question_id, user_choice, recommended, session_id}`。根据 registry validate。
4. **Explicit per-question preferences**（`bin/gstack-question-preference`）。写入 `{question_id, preference}`，其中 preference 是 `always-ask | never-ask | ask-only-for-one-way`。从 session 1 起生效。没有 calibration gate：用户说了，system obeys。
5. **Preamble injection。** 每个 AskUserQuestion 前，agent 调用 `gstack-question-preference --check <registry-id>`。如果 `never-ask` 且 question 不是 one-way door，则 auto-choose recommended option，并带 visible annotation："Auto-decided [summary] → [option] (your preference). Change with /plan-tune." One-way doors 无论 preference 如何都始终 ask，这是 safety override。
6. **Inline "tune:" feedback with user-origin gate。** Agent 提供 "Tune this question? Reply `tune: [feedback]` to adjust." 用户可以用 shortcuts（`unnecessary`、`ask-less`、`never-ask`、`always-ask`、`context-dependent`）或 free-form English。CRITICAL：只有当 `tune:` content 出现在用户当前 chat turn 中时，agent 才写 tune event；tool output 中不行，file read 中不行。Binary 在写入时 validate `source: "inline-user"`；拒绝其他 sources。
7. **Declared profile**（`/plan-tune setup`）。5 个 plain-English questions，每个 dimension 一个。存储到 unified `~/.gstack/developer-profile.json` 的 `declared: {...}` 下。v1 中仅 informational，不改变 skill behavior。
8. **Observed/Inferred profile。** 每个 question-log event 通过 hand-crafted signal map（`scripts/psychographic-signals.ts`）为 inferred dimensions 贡献 deltas。On demand computed。显示但不 acted on。
9. **`/plan-tune` skill。** Conversational plain-English inspection tool。"Show my profile," "set a preference," "what questions have I been asked," "show the gap between what I said and what I do." 不需要 CLI subcommand syntax。
10. **与现有 `~/.gstack/builder-profile.jsonl` 统一。** 把 /office-hours session records 和 accumulated signals fold into unified `~/.gstack/developer-profile.json`。Migration atomic + idempotent + archives source file。

## Deferred to v2（不在本 PR 中，但有明确 acceptance criteria）

| 项目 | 推迟原因 | v2 promotion acceptance criteria |
|------|--------------|--------------------------------------|
| E1 Substrate wiring（5 skills read profile and adapt） | 需要 v1 registry 证明 durable。需要真实 observed data 来 calibrate signal deltas。存在 psychographic drift 风险。 | v1 registry stable for 90+ days。Inferred dimensions 在 3+ skills 上表现出 clear stability。User dogfood 验证由 profile informed 的 defaults 感觉正确。 |
| E3 `/plan-tune narrative` + `/plan-tune vibe` | Event-anchored narrative 需要 stable profile。没有 v1 data，输出会是 generic slop。 | Profile diversity check 连续 2+ weeks real usage 通过。Narrative test 证明它引用 specific events，而不是 clichés。 |
| E4 Blind-spot coach | 没有 explicit interaction-budget design 时，与 E1/E6 逻辑冲突。需要 global session budget、escalation rules、exclusion from mismatch detection。 | Interaction budget + escalation 的 design spec。Dogfood 确认 challenges 感觉像 coaching，而不是 nagging。 |
| E5 LANDED celebration HTML page | 不能放在 preamble 中（Codex #9, #10）。Promote 时移到 explicit command `/plan-tune show-landed` 或 post-ship hook，而不是 hot path 中的 passive detection。 | Explicit command 或 hook design。/design-shotgun → /design-html 形成 visual direction。PR data aggregation 经过 security + privacy review。 |
| E6 Auto-adjustment based on mismatch | v1 中 /plan-tune 只显示 declared 和 inferred 之间的 gap。v2 可以 suggest declaration updates。需要 dual-track profile stable。 | v1 的真实 mismatch data 显示 consistent patterns。Suggestion UX 单独设计。 |
| Psychographic-driven auto-decide | v1 中 zero behavioral change。只有 explicit preferences 生效。 | Real usage 显示 explicit preferences 覆盖大多数 cases。Inferred profile 稳定到可信。 |

## 完全拒绝（Codex 是对的，我们不做）

| 项目 | 拒绝原因 |
|------|--------------|
| Substrate-as-prompt-convention（vs. typed registry） | Codex #1。Agents 可以 silently skip instructions。在其上构建 psychographic 是 sand。 |
| ±0.2 clamp on declared dimensions | Codex #6。与 E6 mismatch detection 产生逻辑矛盾。只能二选一：editable preference 或 inferred behavior。现在：两者都保留，但 separately tracked（dual-track profile）。 |
| 通过 parsing prose summaries 判断 one-way door classification | Codex #4。Safety 依赖 wording。door_type 必须在 question definition site（registry）声明，而不是 inferred。 |
| Single event-schema file 混合 declarations + overrides + verdicts + feedback | Codex #5。Incompatible domain objects。现在拆成三个文件：question-log.jsonl、question-preferences.json、question-events.jsonl。 |
| /plan-tune onboarding 的 TTHW telemetry | Codex #14。与 local-first framing 矛盾。只做 local logging。 |
| Inline tune: writes without user-origin verification | Codex #16。Profile poisoning attack。现在：user-origin gate 不可选。 |

## 架构

```
~/.gstack/
  developer-profile.json            # unified: declared + inferred + sessions (from office-hours)

~/.gstack/projects/{SLUG}/
  question-log.jsonl                # every AskUserQuestion, append-only, registry-validated
  question-preferences.json         # explicit per-question user choices
  question-events.jsonl             # tune: feedback events, user-origin gated
```

**Unified profile schema**（superseding both v0.16.2.0 builder-profile.jsonl and the proposed developer-profile.json）：

```json
{
  "identity": {"email": "..."},
  "declared": {
    "scope_appetite": 0.9,
    "risk_tolerance": 0.7,
    "detail_preference": 0.4,
    "autonomy": 0.5,
    "architecture_care": 0.7
  },
  "inferred": {
    "values": {"scope_appetite": 0.72, "risk_tolerance": 0.58, "...": "..."},
    "sample_size": 47,
    "diversity": {
      "skills_covered": 5,
      "question_ids_covered": 14,
      "days_span": 23
    }
  },
  "gap": {"scope_appetite": 0.18, "...": "..."},
  "sessions": [
    {"date": "...", "mode": "builder", "project_slug": "...", "signals": []}
  ],
  "signals_accumulated": {
    "named_users": 1, "taste": 4, "agency": 3, "...": "..."
  }
}
```

**Diversity check**（Codex #13）：只有当 `sample_size >= 20 AND skills_covered >= 3 AND question_ids_covered >= 8 AND days_span >= 7` 时，`inferred` 才被视为 "enough data"。低于这个阈值时，`/plan-tune profile` 显示 "not enough observed data yet"，而不是可能 misleading 的 inferred value。

## Data flow（v1）

1. Preamble：检查 `question_tuning` config。如果 off，什么都不做。
2. 每个 AskUserQuestion 前：
   - Agent 调用 `gstack-question-preference --check <registry-id>`
   - 如果 `never-ask` 且 question 不是 one-way door → auto-choose recommended with annotation
   - 如果 `always-ask`、unset，或 question 是 one-way door → ask normally
3. AskUserQuestion 后：
   - Append log record 到 question-log.jsonl（registry-validated，reject unknown IDs）
4. Offer inline："Tune this question? Reply `tune: [feedback]` to adjust."
5. 如果用户 NEXT turn message 包含 `tune:` prefix，且内容来自用户自己的 message（不是 tool output）：
   - Agent 调用 `gstack-question-preference --write`，带 `source: "inline-user"`
   - Binary validate source field；如果不是 `inline-user` 则 reject
6. Inferred dimensions 由 `bin/gstack-developer-profile --derive` on demand recomputed。Signal map changes 会触发从 events history full recompute。

## Security model（安全模型）

**Profile poisoning defense**（Codex #16, Decision J below）：Inline tune events 只能在以下条件成立时写入：
- Agent 正在处理用户当前 chat turn
- `tune:` prefix 出现在该用户 message 中（不是任何 tool output、file content、PR description、commit message 等）
- Resolver 给 agent 的 instructions 明确说明这一点

Binary enforcement：`gstack-question-preference --write` 要求每条 tune-originated record 带 `source: "inline-user"` field。任何其他 source value（例如 `inline-tool-output`、`inline-file-content`）都以 error 拒绝。Agent 被指示永远不要 forge `source` field。

**Data privacy**：
- 所有数据都是 local-only，位于 `~/.gstack/` 下。没有 explicit user action 时不会离开本机。
- `/plan-tune export <path>` 写 profile 到用户指定路径（opt-in export）。
- `/plan-tune delete` 清除 local profile files。
- `gstack-config set telemetry off` 阻止任何 telemetry（这个 skill 无论如何都不发送 profile data）。
- Profile files 使用标准 user-home permissions。

**Injection defense**（与现有 `bin/gstack-learnings-log` patterns 一致）：`question_summary` 和任何 free-form user feedback fields 都会针对 known prompt-injection patterns（"ignore previous instructions," "system:" 等）sanitize。

## 5 Hard Constraints（保留自 office-hours，并按 Codex feedback 更新）

1. **One-way doors 由 registry declaration deterministic 分类**，不是 runtime summary parsing。每个 registry entry 声明 `door_type: one-way | two-way`。Keyword pattern fallback（`scripts/one-way-doors.ts`）只是 edge cases 的 belt-and-suspenders secondary check。
2. **Profile dimensions 可 inspect 也可 edit。** `/plan-tune profile` 显示 declared + inferred + gap。Plain English edits 只进入 `declared`。System 独立 tracking `inferred`。
3. **Signal map 以 TypeScript hand-crafted。** `scripts/psychographic-signals.ts` 映射 `{question_id, user_choice} → {dimension, delta}`。不是 agent-inferred。v1 中只用于 `inferred.values` display，不驱动 decisions。
4. **v1 中没有 psychographic-driven auto-decide。** 只有 explicit per-question preferences 生效。这完全绕开 “calibration gate can be gamed” critique（Codex #13），因为 v1 没有 gate 可 pass。
5. **Per-project preferences beat global preferences。** `~/.gstack/projects/{SLUG}/question-preferences.json` 优先于任何未来 global preference file。Global profile（`~/.gstack/developer-profile.json`）只是跨 projects diversity 的 starting point。

## 为什么 event-sourced + dual-track

**为什么 inferred profile 使用 event-sourced**：
- Signal map 会在 gstack versions 之间变化。从 events recompute，不需要 data migration。
- Auditable：`/plan-tune profile --trace autonomy` 显示贡献该 value 的每个 event。
- 面向未来：新 dimensions 可从 existing history derive。

**为什么 dual-track（declared + inferred，separately）**（Decision B below）：
- 解决 Codex #6 指出的 logical contradiction。
- `declared` 是 user sovereignty。用户陈述自己是谁。System 对任何 user-driven 事项（preferences、declarations、overrides）都 obey。
- `inferred` 是 observation。System tracking behavioral patterns。v1 中显示但不 acted on。
- `gap` 是有趣 signal。Large gaps 暗示用户 self-description 与 behavior 不匹配，是有价值的 self-insight，但不会 auto-correct。

## Interaction model（交互模型）— plain English everywhere

（From /plan-devex-review, user correction on CLI syntax）

`/plan-tune`（无 args）进入 conversational mode。不需要 CLI subcommand syntax。

Plain language menu：
- "Show me my profile"
- "Review questions I've been asked"
- "Set a preference about a question"
- "Update my profile — I've changed my mind about something"
- "Show me the gap between what I said and what I do"
- "Turn it off"

用户用 conversational replies。Agent interpret、确认 intended change，然后写入。例如：
- User: "I'm more of a boil-the-ocean person than 0.5 suggests"
- Agent: "Got it — update `declared.scope_appetite` from 0.5 to 0.8? [Y/n]"
- User: "Yes"
- Agent writes the update

任何由 free-form input 触发的 `declared` mutation 都必须有 confirmation step（Codex #15 trust boundary）。

Power users 可以输入 shortcuts（`narrative`、`vibe`、`reset`、`stats`、`enable`、`disable`、`diff`）。二者都不是必须的。两者都可用。

## Files to Create（要创建的文件）

### Core schema（核心 schema）
- `scripts/question-registry.ts` — typed registry。Seeded from audit of all SKILL.md.tmpl AskUserQuestion invocations。
- `scripts/one-way-doors.ts` — secondary keyword fallback。Primary：registry 中的 `door_type`。
- `scripts/psychographic-signals.ts` — 用于 inferred computation 的 hand-crafted signal map。

### Binaries（二进制工具）
- `bin/gstack-question-log` — append log record，validate against registry。
- `bin/gstack-question-preference` — read/write/check/clear explicit preferences。
- `bin/gstack-developer-profile` — supersedes `bin/gstack-builder-profile`。Subcommands：`--read`（legacy compat）、`--derive`、`--gap`、`--profile`。

### Resolvers（解析器）
- `scripts/resolvers/question-tuning.ts` — 三个 generators：`generateQuestionPreferenceCheck(ctx)`（pre-question check）、`generateQuestionLog(ctx)`（post-question log）、`generateInlineTuneFeedback(ctx)`（post-question tune: prompt with user-origin gate instructions）。

### Skill（技能）
- `plan-tune/SKILL.md.tmpl` — conversational、plain-English inspection and preference tool。

### Tests（测试）
- `test/plan-tune.test.ts` — registry completeness、duplicate ID check、preference precedence（never-ask + not-one-way → AUTO_DECIDE；never-ask + one-way → ASK_NORMALLY）、user-origin gate（rejects non-inline-user sources）、derivation + recompute、unified profile schema、7-session fixture 的 migration regression。

## Files to Modify（要修改的文件）

- `scripts/resolvers/index.ts` — register 3 new resolvers。
- `scripts/resolvers/preamble.ts` — `_QUESTION_TUNING` config read；为 tier >= 2 inject 3 resolvers。
- `bin/gstack-builder-profile` — legacy shim delegates to `bin/gstack-developer-profile --read`。
- Migration script — 把 existing builder-profile.jsonl fold into unified developer-profile.json。Atomic、idempotent、archives source as `.migrated-YYYY-MM-DD`。

## v1 不触碰什么

明确 unchanged：没有 `{{PROFILE_ADAPTATION}}` placeholders，也没有基于 profile 的 behavior change：

- `ship/SKILL.md.tmpl`、`review/SKILL.md.tmpl`、`office-hours/SKILL.md.tmpl`、`plan-ceo-review/SKILL.md.tmpl`、`plan-eng-review/SKILL.md.tmpl`

这些 skills 只获得用于 logging / preference checking / tune feedback 的 preamble injection。没有 profile-driven defaults。这是 v2 work。

## Decisions log（每项都包含优缺点）

### Decision A：Bundle all three（question-log + sensitivity + psychographic）vs. ship smaller wedge — INITIAL ANSWER: BUNDLE; REVISED: REGISTRY-FIRST OBSERVATIONAL

Initial user position（office-hours）："The psychographic IS the differentiation. Ship the whole thing so the feedback loop can actually tune behavior." 这推动了 CEO EXPANSION。

**打包交付的优点：** Ambition。Learning layer 让它不只是 config。没有 psychographic，它只是 fancy settings menu。

**打包交付的缺点（Codex 指出）：** Substrate 不存在。Prompt-convention 上的 psychographic 是 sand。E1/E4/E6 组合不 coherent。Profile poisoning 未处理。Preamble 中的 E5 是 hidden hot-path side effect。Implementation order 围绕 unenforceable convention 构建 machinery。

**Revised answer（修订答案）：** Registry-first observational v1（本文档）。保留 ambition 作为 v2 target，并有明确 acceptance criteria。Ship 一个 defensible foundation。用户看到 Codex 的 20-point critique 后接受了这个方向。

### Decision B：Event-sourced vs. stored dimensions vs. hybrid — ANSWER: EVENT-SOURCED + USER-DECLARED ANCHOR (B+C)

**Approach A（stored dimensions）：** Mutate in place。简单。
- 优点：最小 data model。容易 reasoning。
- 缺点：Lossy。没有 history。Signal map changes 需要 migration。Profile changes 对用户 opaque。

**Approach B（event-sourced）：** 存 raw events，derive dimensions。
- 优点：Auditable。Signal map changes 时 recomputable。永不需要 data migration。匹配现有 learnings.jsonl pattern。
- 缺点：Derivation 更复杂。Events file 会随时间增长（compaction deferred to v2）。

**Approach C（hybrid — user-declared anchor, events refine）：** Initial profile 由 user-stated；events 在 ±0.2 内 refine。
- 优点：Day-1 value。User sovereignty。Calibration anchor，而不是从零开始。
- 缺点：±0.2 clamp 与 mismatch detection 产生 logical conflict（Codex #6 抓到）。

**Chosen（选择）：B+C 组合，并移除 ±0.2 clamp。** 底层是 event-sourced，declared profile 作为 first-class separate field。没有 clamp。Declared 和 inferred 作为 independent values 存在。二者之间的 gap 会显示，但 v1 不 auto-correct。

### Decision C：One-way door classification — runtime prose parsing vs. registry declaration — ANSWER: REGISTRY DECLARATION（post-Codex）

**Runtime prose parsing（original）：** `isOneWayDoor(skill, category, summary)` 加 keyword patterns。
- 优点：Skill authors friction 最小。不需要维护 schema。
- 缺点（Codex #4）：Safety 依赖 wording。一个 destructive-op question 如果措辞温和，就可能被 misclassified。对 safety gate 不可接受。

**Registry declaration（revised）：** 每个 registry entry 声明 `door_type`。
- 优点：Deterministic。Auditable。CI-enforceable（所有 questions 必须声明）。
- 缺点：Maintenance burden。每个新 skill question 都必须 classify。

**Chosen（选择）：registry declaration as primary, keyword patterns as fallback。** Schema governance 是 safety 的成本。

### Decision D：Inline tune feedback grammar — structured keywords vs. free-form natural language — ANSWER: STRUCTURED WITH FREE-FORM FALLBACK

**Structured keywords only（仅结构化关键词）：** `tune: unnecessary | ask-less | never-ask | always-ask | context-dependent`。
- 优点：Unambiguous。Clean profile data。
- 缺点：用户必须 memorize。

**Free-form only（仅自由文本）：** Agent interpret 用户说的任何内容。
- 优点：自然。无需学习 syntax。
- 缺点：Profile data inconsistent。难以 debug 为什么 tune 没生效。

**Chosen（选择）：both。** Shortcuts 记录给 power users；agent 接受并 normalize free English。Plain-English interaction 是 default；structured keywords 是 optional fast-path。

### Decision E：CLI subcommand structure for /plan-tune — ANSWER: PLAIN ENGLISH CONVERSATIONAL（no subcommand syntax required）

**`/plan-tune profile`, `/plan-tune profile set autonomy 0.4`, etc.**（original）：
- 优点：Power users 快。通过 --help self-documenting。
- 缺点：用户必须 memorize。每次 invocation 感觉像 CLI session，不像 conversation。

**Plain-English conversational（revised after user correction）：** `/plan-tune` 进入 menu。用户用 natural language 说想要什么。
- 优点：Zero memorization。感觉像和 coach 对话，不像 shell。
- 缺点：对 power users 更慢。需要 good agent interpretation。

**Chosen（选择）：conversational with optional shortcuts。** 两种路径都不是必须。大多数用户永远看不到 shortcuts。Mutating declared profile 前必须 confirmation step（防止 agent misinterpretation，Codex #15 trust boundary）。

### Decision F：Landed celebration — passive preamble detection vs. explicit command vs. post-ship hook — ANSWER: DEFERRED TO v2; WHEN PROMOTED, NOT IN PREAMBLE

**Passive detection in preamble（original）：** 每个 skill 的 preamble 运行 `gh pr view` 来检测 recent merges。
- 优点：无论用户运行哪个 skill 都能工作。用户不需要做任何特殊操作。
- 缺点（Codex #9）：Latency、auth failures、rate limits、surprise browser opens、nondeterminism 注入每个 skill 的 preamble。Hot path 中的 side effect。

**Explicit command（`/plan-tune show-landed`）：** 用户 opt in。
- 优点：无 hot-path side effects。用户控制何时查看。
- 缺点：需要 user discovery。“在你 earned it 时 surprise you”的 magic 消失。

**Post-ship hook（`/ship` triggers detection after PR creation）：** 绑定到 /ship。
- 优点：时机自然。没有 preamble cost。
- 缺点：/ship 不总是 landing event（manual merges、team members merging 等）。

**Chosen（选择）：DEFERRED entirely。** v2 会正确设计这个。Promote 时移出 preamble。用户接受了 Codex 的论点：把 celebration page 放在 preamble 中，对一个已经有风险的 feature 来说是 strategic misfit。

### Decision G：Calibration gate — 20 events vs. diversity-checked — ANSWER: DIVERSITY-CHECKED

**"20 events"（original）：** 简单计数。
- 优点：实现 trivial。
- 缺点（Codex #13）：Gameable。对同一个 question 连续 20 次 inline "unnecessary" 不应该 calibrate 五个 dimensions。

**Diversity check（revised）：** `sample_size >= 20 AND skills_covered >= 3 AND question_ids_covered >= 8 AND days_span >= 7`。
- 优点：Profile 在系统中实际被 exercised 后才 trusted。
- 缺点：稍微复杂。

**Chosen（选择）：diversity check。** v1 中只作为 “enough data to display” threshold。v2 中会成为 psychographic-driven auto-decide 的 gate。

### Decision H：Implementation order — classifiers first vs. integration point first — ANSWER: INTEGRATION POINT FIRST（registry + CI lint）

**Classifiers first（original）：** 先 build bin tools，再 resolvers，再 skill template。
- 优点：Atomic building blocks。Integration 前可 unit-test。
- 缺点（Codex #19）：围绕 unenforceable convention 构建 machinery。如果 convention 不成立，所有工作都浪费。

**Integration point first（revised）：** 先 build typed registry + CI lint。证明 integration 可用后，再在其上构建 infrastructure。
- 优点：Foundation 被证明。Infrastructure 有 durable 的依赖。
- 缺点：需要 audit gstack 中每个 existing AskUserQuestion，这是大量 upfront work。

**Chosen（选择）：integration point first。** Codex 的论点是决定性的。Audit 正是重点：它迫使我们 catalog 实际拥有的内容，再在其上构建 adaptation。

### Decision I：Telemetry for TTHW — opt-in telemetry vs. local-only — ANSWER: LOCAL-ONLY

**Opt-in telemetry（original, suggested in DX review）：** 通过 telemetry event instrument TTHW。
- 优点：量化所有用户的 onboarding experience。
- 缺点（Codex #14）：与 local-first OSS framing 矛盾。专门为这个 skill 增加 telemetry surface。

**Local-only（revised）：** Logging 是 local。尊重现有 `telemetry` config；skill 不新增 telemetry channels。
- 优点：与 gstack 的 local-first ethos 一致。
- 缺点：没有 onboarding time 的 aggregate view。

**Chosen（选择）：local-only。** 如果之后需要 TTHW data，作为 gstack-wide telemetry event 放到 existing opt-in 后面，而不是 skill-specific。

### Decision J：Profile poisoning defense — no defense vs. confirmation gate vs. user-origin gate — ANSWER: USER-ORIGIN GATE

**无防护（原方案，由 Codex 发现）：** Agent 写入任何看到的 tune event。
- 优点：最简单。没有额外 trust checks。
- 缺点（Codex #16）：Malicious repo content、PR descriptions、tool output 可以 inject `tune: never ask` 并 poison profile。这是真实 attack surface。

**Confirmation gate：** 每次 tune write 都问 "Confirmed? [Y/n]"。
- 优点：Universal defense。
- 缺点：每次 legitimate use 都有 friction。

**User-origin gate：** 只有当 `tune:` prefix 出现在当前 turn 的用户自己的 chat message 中时，agent 才写 tune events（不是 tool output，不是 file content）。Binary validate `source: "inline-user"`。
- 优点：阻挡 attack，同时不增加 legitimate use friction。
- 缺点：依赖 agent 正确识别 source。Binary-level validation 是 enforcement。

**Chosen（选择）：user-origin gate。** 匹配 threat model（automated inputs 中的 malicious content），同时不破坏 normal flow。

## 成功标准

- `bun test` passes including new `test/plan-tune.test.ts`。
- 每个 SKILL.md.tmpl 中的每个 AskUserQuestion invocation 都有 registry entry。CI lint enforce。
- 从 `~/.gstack/builder-profile.jsonl` migration 时保留 100% sessions + signals_accumulated。使用 7-session fixture 的 regression test。
- One-way door registry-declared entries：100% destructive ops、architecture forks、scope-adds > 1 day CC effort、security/compliance choices 分类为 `one-way`。
- User-origin gate test：尝试用 `source: "inline-tool-output"` 写 tune event 会被 rejected。
- Dogfood：Garry 使用 `/plan-tune` 2+ weeks。回报：
  - `tune: never-ask` 打起来是否自然，或是否被 ignored
  - Registry maintenance（adding new questions）感觉是 reasonable discipline 还是 schema bureaucracy
  - Inferred dimensions 跨 sessions 是 stable 还是 noisy
  - Plain-English interaction 感觉像 coach，还是像在和 chatbot 争论

## Implementation Order（实现顺序）

1. Audit 每个 gstack SKILL.md.tmpl 中的每个 `AskUserQuestion` invocation。构建初始 `scripts/question-registry.ts`，含 IDs、categories、door_types、options。这是 foundation；其他一切在其上。
2. 写 `test/plan-tune.test.ts` registry-completeness test（gate tier）。验证它能抓 drift：临时移除一个 registry entry，确认 CI fails。
3. 用 keyword-pattern fallback classifier seed `scripts/one-way-doors.ts`。
4. 用 initial `{question_id, user_choice} → {dimension, delta}` mappings seed `scripts/psychographic-signals.ts`。Numbers tentative；v1 ships，v2 recalibrates。
5. Seed `scripts/archetypes.ts` with archetype definitions（future v2 `/plan-tune vibe` 会引用）。
6. `bin/gstack-question-log` — validate against registry，reject unknown IDs。
7. `bin/gstack-question-preference` — all subcommands + tests。
8. `bin/gstack-developer-profile` — `--read`（legacy）、`--derive`、`--gap`、`--profile`。
9. Migration script — builder-profile.jsonl → unified developer-profile.json。Atomic、idempotent、archives source。Fixture regression test。
10. `scripts/resolvers/question-tuning.ts` — 三个 generators（preference check、log、inline tune with user-origin gate instructions）。
11. 在 `scripts/resolvers/index.ts` 注册 3 个 resolvers。
12. 更新 `scripts/resolvers/preamble.ts` — `_QUESTION_TUNING` config read；针对 tier >= 2 skills conditional inject。
13. `plan-tune/SKILL.md.tmpl` — conversational plain-English skill。
14. `bun run gen:skill-docs` — regenerate all SKILL.md files；验证每个保持在 100KB token ceiling 以下。
15. `bun test` — all 45+ test cases green。
16. Dogfood 2+ weeks。收集真实 question-log + preferences data。按 success criteria measure。
17. `/ship` v1。Dogfood 后讨论 v2 scope。

## 开放问题（v2 scope decisions，deferred until real data）

1. Exact signal map deltas。v1 用 initial guesses ship；v2 根据 observed data recalibrates。
2. 当 `inferred` 和 `declared` gap 变大时，是否 auto-suggest updating `declared`？还是只 display？
3. Signal map version 改变时，是否 auto-recompute 或 prompt user？默认：auto-recompute with diff display。
4. Cross-project profile inheritance vs. isolation。v1 是 per-project preferences + global profile；v2 可能加 explicit cross-project learning opt-ins。
5. /plan-tune 是否应支持 "team profile" mode，用 shared developer-profile 影响 collaboration？v2+。

## Reviews incorporated（已纳入的评审）

- **/office-hours（2026-04-16, 1 session）：** Set 5 hard constraints，选择 event-sourced + user-declared architecture。
- **/plan-ceo-review（2026-04-16, EXPANSION mode）：** 6 expansions accepted，后来在 Codex review 后 rolled back。
- **/plan-devex-review（2026-04-16, POLISH mode）：** Plain-English interaction model；保留到 v1。
- **/plan-eng-review（2026-04-16）：** Test plan 和 completeness checks；部分被 registry-first rewrite superseded。
- **/codex（2026-04-16, gpt-5.4 high reasoning）：** 20-point critique 推动 rollback。15+ legitimate findings 是 Claude reviews 漏掉的。

## Credits and caveats（致谢与说明）

这个 plan 通过约 6 小时 planning 的 iterative AI-collaboration loop 形成。Author（Garry Tan）directed every scope decision；AI voices（Claude Opus 4.7 和 OpenAI Codex gpt-5.4）challenge 并 refine 了 plan。没有 Codex 的 outside voice，一个更大且更不可 defense 的 plan 会被 shipped。Cross-model review 在 high-stakes architectural changes 上的价值是真实且可测量的。
