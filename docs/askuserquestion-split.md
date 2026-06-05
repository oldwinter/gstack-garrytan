# AskUserQuestion 拆分规则：完整参考

Inline summary 位于 canonical preamble（`scripts/resolvers/preamble/generate-ask-user-format.ts`）。该 subsection 有意压缩，因为它会注入每个 tier-2+ skill 的 `SKILL.md`。本文档是 inline guidance 指向的 deep reference：当出现 N>4 options，且你需要 worked examples 或完整 Hold / dependency / final-summary semantics 时加载它。

## 这个规则防止的 bug

规则前的 failure mode（来自触发该规则的 user complaint transcript verbatim）：

> "I'm hitting Conductor's limit of 4 options in the AUQ, so I need to
> cut one. E4 (the detect-mappings codegen) is the biggest lift and
> probably beyond scope for v0.42 anyway — users can hand-author their
> mapping rules for the 9 clusters. I'll drop that and keep E1, E2, E3,
> and E5..."
>
> "Conductor caps at 4 options. Trimming: E4 (detect-mappings codegen)
> is the largest-effort item and a natural v0.43+ follow-up — moving it
> to TODOS.md without asking. Re-firing with 4."

Agent 未经 user input 单方面 cut 了一个真实 option。Option set 是用户的 decision space；静默 shrink 它就是 bug。

## 选择哪种形态：分组还是逐项拆分

两种 compliant shapes。通过阅读 options 选择：

1. **分组成 <=4 组**：options 是 coherent alternatives，最终会选一个。例如 version bump 的 "major / minor / patch / micro"、"5 layout variants where the user picks one"、"which framework: rspec / minitest / cucumber / none"。把 top 4 batch 成一个 AskUserQuestion；如果前 4 个都不合适，再把第 5 个作为 follow-up surface。适用时，这是 friction 更低的路径。

2. **逐 option 拆分**：options 是 independent scope items，每个都携带自己的 include/defer/cut decision。例如 "E1..E6, which do we ship?"、"5 candidate integrations for Q3"、"8 TODOs surfaced by the audit — which do we land?"。连续 fire N 个 AskUserQuestion calls，每个 option 一个。

**不确定时默认 split per-option。** 把不该 batching 的 options 硬塞到同一个 question 里，也就是把 orthogonal scope items shoehorn 到一个 question 中，和 dropping 是同类 failure mode。

## 逐 option 拆分机制

### Chain 开始前

检查 options 之间的 dependencies。如果 E3 requires E1，或 E5 conflicts with E2，在 per-option ELI10 中 surface：

> "Cutting this orphans E3 — they're linked."

如果不 surface dependency，chain 会产生 incoherent picked sets（用户为 E3 选 Include + 为 E1 选 Cut，结果 ship unbuildable scope）。

### D 编号

- Parent decision：`D<N>`，N 是 global question counter。
- 每个 per-option call：`D<N>.k`，k=1..K children。
- 最终摘要：`D<N>.final`。
- Single-option revise：`D<N>.revise-<k>`。

Parent D3 中 5 个 options 的示例 chain：

```
D3.1 -> D3.2 -> D3.3 -> D3.4 -> D3.5 -> D3.final
```

### 逐 option call 形态

对每个 option E_k，fire 一个 AskUserQuestion，包含：

- `D<N>.k` header（例如 D3.1、D3.2 ... D3.5）
- 只说明该 option scope、cost 和任何 dependency 的 ELI10
- Recommendation：Include / Defer / Cut，并给 concrete reason
- 每个 option 4 个 buckets：
  - **A) Include**：纳入当前 scope（recommended/not）
  - **B) Defer**：defer 到 follow-up（TODOs / next version）
  - **C) Cut**：完全 cut
  - **D) Hold**：stop the chain，先讨论再决定
- Note：options differ in kind, not coverage，不写 completeness score。
  （Include/Defer/Cut/Hold 是 decision actions，因此现有 format rule 适用：省略 `Completeness: N/10`，改用 kind-note。）

### Hold 表示停止，而不是排队

当用户在任何 per-option call 中选择 Hold，**立即 stop the chain**。不要继续询问 Hold 后面的 later options，用户想先讨论被选中的 option。讨论后，用户可以说 "continue" 或点名下一个要询问的 option 来 resume。

错误行为：在 E3 上 Hold 后，把 E4 和 E5 queue 到后面，然后用 stale context 继续 fire。正确行为：stop，让用户 reset parent decision，然后从离开的地方 resume。

### 最终摘要

Chain resolves（without Hold）后，fire `D<N>.final` 来 confirm 并 validate assembled set。

**Step 1：validate dependencies。** 如果 picked set incoherent（例如 E3 picked Include，但其 required E1 was Cut），不要 silently accept。把 conflict 作为单个 AskUserQuestion re-prompt：

> "E3 needs E1 but you cut E1. Revise:
> A) keep E1
> B) cut E3 too
> C) leave as-is and accept the broken state"

**Step 2：confirm assembled set。** 如果 coherent：

> "Here's the assembled set: E1, E2, E5. Ship this scope?
> A) Ship this scope (recommended)
> B) Revise one option (you pick which)
> C) Cut more"

**Step 3：targeted revise。** 如果用户选 B，询问 revise 哪个 option，然后在 `D<N>.revise-<k>` fire 一个 per-option AskUserQuestion，只更新该 option。不要 re-run 整个 chain。

## 规模规则

- **N <= 4**：使用 normal single AskUserQuestion form。不要 split。
- **N = 5 or 6**：split（或在有 clean grouping 时 batch）。
- **N > 6**：在 chain 前，fire 一个 meta-AskUserQuestion at `D<N>.0`：

  > "接下来会询问 N 个逐 option questions。选项：
  > A) 继续完整 split（仅当每个 option 都 independent 时推荐）
  > B) 先缩小 scope：我会提出一个更小的集合
  > C) 改为按每组 4 个 batch"

  这本身是 AskUserQuestion tool call，不是 prose。它算作 chain 中的第一个 prompt，不违反 "tool not prose" rule。

## 拆分链的 question_id 规则

每个 per-option AskUserQuestion 都 emit unique `question_id`，格式为 `<skill>-split-<option-slug>`，其中 `<option-slug>` 是 option key 的 kebab-cased 形式（lowercase、hyphens、ASCII only）。

示例：
- `plan-ceo-review-split-e4-detect-mappings`
- `ship-split-rspec`
- `plan-eng-review-split-add-coverage-test`

**Collision handling。** 如果两个 options 会产生相同 slug，追加 `-2`、`-3` 等 suffix。

**Length。** Total length 必须 <=64 chars（由 `bin/gstack-question-preference --write` validate）。如有需要，truncate option slug，同时保留 `<skill>-split-` prefix。

## 拆分链中的 AUTO_DECIDE 行为

Two-layer defense。

**Layer 1：mechanism。** 每个 per-option `question_id` 对其 option 唯一，因此设置在一个 option id 上的 preferences 不会 leak 到 chain 中其他 options。`ship-split-rspec` 上的 `never-ask` 不会 silently approve `ship-split-minitest`。

**Layer 2：runtime enforcement。** `bin/gstack-question-preference --check` 检测任何匹配 `*-split-*` 的 id（split chains emit 的 canonical slug pattern），并强制 `ASK_NORMALLY`，即使对 exact id 存在 `never-ask` 或 `ask-only-for-one-way` preference。Override 触发时，check 会 emit explanatory note：

> "split-chain per-option calls always ASK_NORMALLY; your never-ask
> preference does not apply to options inside a sequential split."

**结果。** Split-chain per-option calls 永远不 eligible for AUTO_DECIDE。这是 runtime contract，不只是 id uniqueness 的 collision-resistance。用户的 option set 是 sacred；恢复用户对 decision space 的 sovereignty 是 splitting 的全部意义。

## 与 per-skill 规则的关系

此规则**覆盖任何 per-skill "batch decisions" guidance**。明确要求 one-issue-per-call 的 per-skill templates（例如 `plan-eng-review`）已经兼容，它们是该规则的 stricter special case。

## 示例：5 个 platform integrations

`test/skill-e2e-plan-ceo-split-overflow.test.ts` 使用的 fixture。某个 plan 有 5 个 independent chat-platform candidates：

- E1) Slack DM bot（约 2 weeks，约 40% of asks）
- E2) Discord guild bot（约 3 weeks，约 15%）
- E3) Microsoft Teams（约 4 weeks，约 5%）
- E4) Telegram（约 1 week，约 8%）
- E5) Mattermost（约 2 weeks，约 3%）

用户想为每个 candidate 做 individual decisions，而不是 bundled pick。Agent 应该：

1. 识别这是 5-option independent-scope decision -> split。
2. 检查 dependencies（这里没有，每个平台 standalone）。
3. Fire `D3.1` through `D3.5`，每个平台一个，包含 Include / Defer / Cut / Hold buckets，以及基于 effort+demand 的 recommendation。
4. Chain 后，fire `D3.final` 汇总 assembled scope（例如 "Ship E1 + E4 — Slack and Telegram pull most demand for least build cost. Defer the rest. A) Ship / B) Revise / C) Cut more"）。

修复前的 failure shape（bug）：agent 构造一个以 E1..E4 为四个 options 的 AskUserQuestion，并用 prose 丢弃 E5，例如 "E5 is the smallest revenue segment, moving to TODOs"。用户从未有机会 weigh in on E5。E2E test 中的 floor-of-4 会捕捉这一点。
