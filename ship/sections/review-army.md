<!-- AUTO-GENERATED from review-army.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
## Step 9：Pre-Landing Review（落地前审查）

Review diff，查找 tests 捕捉不到的 structural issues。

1. 读取 `.claude/skills/review/checklist.md`。如果无法读取该 file，**STOP** 并报告 error。

2. 运行 `git diff origin/<base>` 获取 full diff（相对 freshly-fetched base branch 的 feature changes）。

3. 分两轮应用 review checklist：
   - **Pass 1 (CRITICAL):** SQL & Data Safety, LLM Output Trust Boundary
   - **Pass 2 (INFORMATIONAL):** All remaining categories

## Confidence Calibration（置信度校准）

每个 finding 都必须包含 confidence score（1-10）：

| Score | Meaning（含义） | Display rule（展示规则） |
|-------|---------|-------------|
| 9-10 | 已通过阅读 specific code 验证。已证明 concrete bug 或 exploit。 | 正常展示 |
| 7-8 | High confidence pattern match。非常可能正确。 | 正常展示 |
| 5-6 | Moderate。可能是 false positive。 | 带 caveat 展示："Medium confidence, verify this is actually an issue" |
| 3-4 | Low confidence。Pattern suspicious，但可能没问题。 | 从 main report suppress。仅放入 appendix。 |
| 1-2 | Speculation。 | 仅当 severity 会是 P0 时报告。 |

**Finding format（发现格式）：**

\`[SEVERITY] (confidence: N/10) file:line — description\`

Example:
\`[P1] (confidence: 9/10) app/models/user.rb:42 — SQL injection via string interpolation in where clause\`
\`[P2] (confidence: 5/10) app/controllers/api/v1/users_controller.rb:18 — Possible N+1 query, verify with production logs\`

### Pre-emit verification gate（#1539 — 消灭 "field doesn't exist" FP class）

任何 finding promote 到 report 之前，此 gate 要求：

1. **Quote 触发 finding 的 specific code line** — file:line 加触发它的 line(s)
   的 verbatim text。如果 finding 是 "field X doesn't exist on model Y"，
   quote class Y 中该 field 应该存在的位置。如果是 "dict.get() might return None"，
   quote dict initialization。如果是 "race condition between A and B"，quote A 和 B。

2. **如果无法 quote motivating line(s)，该 finding 就是 unverified。**
   强制将 confidence 设为 4-5（从 main report suppress）。它仍进入 appendix，
   方便 reviewers audit calibration，但用户不会在 critical-pass output 中看到它。
   不要通过编造 speculative confidence 7+ 绕过此规则；那会击败 gate。

**Framework-meta nudge：** 当 symbol 由 framework metaclass、descriptor、
ORM Meta inner-class 或 migration history 生成时（Django `Meta`、Rails
`has_many`/`scope`、SQLAlchemy `relationship`/`Column`、TypeORM decorators、
Sequelize `init`/`belongsTo`、Prisma generated client），quote meta-construct
（`Meta` block、migration、decorator、schema file），而不是期待 class body 中出现
literal name。Verification 是 "I read the source that creates this symbol"，
不是 "I grep'd for the name and didn't find it." 更深的 framework-aware verification
（model introspection、migration-history-aware checks、ORM dialect detection）有意不属于
lighter gate 的 scope；见 deferred
`~/.gstack-dev/plans/1539-framework-aware-review.md` design doc。

此 gate 消灭的 FP classes（基于 Django Sprint 2.5 #1539 测量）：

| FP class | 为什么 gate 能抓住它 |
|---|---|
| "field doesn't exist on model" | 要求 quote model class body 或 Meta；field 是否缺失会变得 obvious |
| "dict.get() might be None" | 要求 quote dict initialization（例如 Django form 的 `cleaned_data` 以 `{}` 初始化） |
| "save() might lose fields" | 要求 quote ORM signature 或 model definition |
| "update_fields might miss X" | 要求 quote field set；如果 X 不存在，FP 会 self-evident |

**Calibration learning（校准学习）：** 如果你报告了 confidence < 7 的 finding，
且用户确认它确实是真 issue，这就是 calibration event。你的 initial confidence 太低。
把 corrected pattern 记录为 learning，让 future reviews 以更高 confidence 抓住它。

## Design Review（条件执行，diff-scoped）

使用 `gstack-diff-scope` 检查 diff 是否触碰 frontend files：

```bash
source <(~/.claude/skills/gstack/bin/gstack-diff-scope <base> 2>/dev/null)
```

**如果 `SCOPE_FRONTEND=false`：** 静默跳过 design review。无 output。

**如果 `SCOPE_FRONTEND=true`：**

1. **检查 DESIGN.md。** 如果 repo root 中存在 `DESIGN.md` 或 `design-system.md`，读取它。所有 design findings 都按它校准：DESIGN.md 中已 blessed 的 patterns 不 flag。找不到时，使用 universal design principles。

2. **读取 `.claude/skills/review/design-checklist.md`。** 如果无法读取该 file，用 note 跳过 design review："Design checklist not found — skipping design review."

3. **读取每个 changed frontend file**（full file，不只是 diff hunks）。Frontend files 由 checklist 中列出的 patterns 识别。

4. **对 changed files 应用 design checklist。** 对每个 item：
   - **[HIGH] mechanical CSS fix**（`outline: none`、`!important`、`font-size < 16px`）：classify as AUTO-FIX
   - **[HIGH/MEDIUM] design judgment needed**：classify as ASK
   - **[LOW] intent-based detection**：展示为 "Possible — verify visually or run /design-review"（保留 exact finding label）

5. **Include findings（包含发现）**：在 review output 的 "Design Review" header 下包含 findings，遵循 checklist 中的 output format。Design findings 会与 code review findings 合并到同一个 Fix-First flow。

6. **Log result** 到 Review Readiness Dashboard：

```bash
~/.claude/skills/gstack/bin/gstack-review-log '{"skill":"design-review-lite","timestamp":"TIMESTAMP","status":"STATUS","findings":N,"auto_fixed":M,"commit":"COMMIT"}'
```

替换：TIMESTAMP = ISO 8601 datetime；STATUS = 0 findings 时为 "clean"，否则为 "issues_found"；N = total findings；M = auto-fixed count；COMMIT = `git rev-parse --short HEAD` 的 output。

7. **Codex design voice**（可选；available 时自动运行）：

```bash
command -v codex >/dev/null 2>&1 && echo "CODEX_AVAILABLE" || echo "CODEX_NOT_AVAILABLE"
```

如果 Codex available，对 diff 运行 lightweight design check：

```bash
TMPERR_DRL=$(mktemp /tmp/codex-drl-XXXXXXXX)
_REPO_ROOT=$(git rev-parse --show-toplevel) || { echo "ERROR: not in a git repo" >&2; exit 1; }
codex exec "审查这个 branch 上的 git diff。执行 7 项 litmus checks（每项 YES/NO）：1. Brand/product unmistakable in first screen? 2. One strong visual anchor present? 3. Page understandable by scanning headlines only? 4. Each section has one job? 5. Are cards actually necessary? 6. Does motion improve hierarchy or atmosphere? 7. Would design feel premium with all decorative shadows removed? 标出任何 hard rejections：1. Generic SaaS card grid as first impression 2. Beautiful image with weak brand 3. Strong headline with no clear action 4. Busy imagery behind text 5. Sections repeating same mood statement 6. Carousel with no narrative purpose 7. App UI made of stacked cards instead of layout 只给出 5 个最重要的 design findings。引用 file:line。" -C "$_REPO_ROOT" -s read-only -c 'model_reasoning_effort="high"' --enable web_search_cached < /dev/null 2>"$TMPERR_DRL"
```

使用 5-minute timeout（`timeout: 300000`）。Command 完成后读取 stderr：
```bash
cat "$TMPERR_DRL" && rm -f "$TMPERR_DRL"
```

**Error handling（错误处理）：** 所有 errors 都 non-blocking。Auth failure、timeout 或 empty response 时，简短 note 后 skip 并继续。

在 `CODEX (design):` header 下展示 Codex output，并与上方 checklist findings 合并。

   将任何 design findings 与 code review findings 一起包含。它们遵循下面同样的 Fix-First flow。

## Step 9.1: Review Army — Specialist Dispatch（专家派发）

### Detect stack and scope（检测 stack 和 scope）

```bash
source <(~/.claude/skills/gstack/bin/gstack-diff-scope <base> 2>/dev/null) || true
# 检测 stack，供 specialist context 使用
STACK=""
[ -f Gemfile ] && STACK="${STACK}ruby "
[ -f package.json ] && STACK="${STACK}node "
[ -f requirements.txt ] || [ -f pyproject.toml ] && STACK="${STACK}python "
[ -f go.mod ] && STACK="${STACK}go "
[ -f Cargo.toml ] && STACK="${STACK}rust "
echo "STACK: ${STACK:-unknown}"
DIFF_BASE=$(git merge-base origin/<base> HEAD)
DIFF_INS=$(git diff "$DIFF_BASE" --stat | tail -1 | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo "0")
DIFF_DEL=$(git diff "$DIFF_BASE" --stat | tail -1 | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' || echo "0")
DIFF_LINES=$((DIFF_INS + DIFF_DEL))
echo "DIFF_LINES: $DIFF_LINES"
# 检测 test framework，供 specialist test stub generation 使用
TEST_FW=""
{ [ -f jest.config.ts ] || [ -f jest.config.js ]; } && TEST_FW="jest"
[ -f vitest.config.ts ] && TEST_FW="vitest"
{ [ -f spec/spec_helper.rb ] || [ -f .rspec ]; } && TEST_FW="rspec"
{ [ -f pytest.ini ] || [ -f conftest.py ]; } && TEST_FW="pytest"
[ -f go.mod ] && TEST_FW="go-test"
echo "TEST_FW: ${TEST_FW:-unknown}"
```

### 读取 specialist hit rates（adaptive gating）

```bash
~/.claude/skills/gstack/bin/gstack-specialist-stats 2>/dev/null || true
```

### Select specialists（选择专家）

基于上方 scope signals，选择要 dispatch 的 specialists。

**Always-on（每次 review 有 50+ changed lines 时都 dispatch）：**
1. **Testing** — 读取 `~/.claude/skills/gstack/review/specialists/testing.md`
2. **Maintainability** — 读取 `~/.claude/skills/gstack/review/specialists/maintainability.md`

**如果 DIFF_LINES < 50：** 跳过所有 specialists。打印："Small diff ($DIFF_LINES lines) — specialists skipped." Continue to Fix-First flow（item 4）。

**Conditional（matching scope signal 为 true 时 dispatch）：**
3. **Security** — 如果 SCOPE_AUTH=true，或 SCOPE_BACKEND=true 且 DIFF_LINES > 100。读取 `~/.claude/skills/gstack/review/specialists/security.md`
4. **Performance** — 如果 SCOPE_BACKEND=true 或 SCOPE_FRONTEND=true。读取 `~/.claude/skills/gstack/review/specialists/performance.md`
5. **Data Migration** — 如果 SCOPE_MIGRATIONS=true。读取 `~/.claude/skills/gstack/review/specialists/data-migration.md`
6. **API Contract** — 如果 SCOPE_API=true。读取 `~/.claude/skills/gstack/review/specialists/api-contract.md`
7. **Design** — 如果 SCOPE_FRONTEND=true。使用现有 design review checklist：`~/.claude/skills/gstack/review/design-checklist.md`

### Adaptive gating

完成 scope-based selection 后，基于 specialist hit rates 应用 adaptive gating：

对每个通过 scope gating 的 conditional specialist，检查上方 `gstack-specialist-stats` output：
- 如果标记 `[GATE_CANDIDATE]`（10+ dispatches 中 0 findings）：跳过它。打印："[specialist] auto-gated (0 findings in N reviews)."
- 如果标记 `[NEVER_GATE]`：无论 hit rate 如何都 always dispatch。Security 和 data-migration 是 insurance policy specialists — 即使经常 silent 也应该运行。

**Force flags:** 如果用户 prompt 包含 `--security`、`--performance`、`--testing`、`--maintainability`、`--data-migration`、`--api-contract`、`--design` 或 `--all-specialists`，无论 gating 如何都 force-include 对应 specialist。

记录哪些 specialists 被 selected、gated 和 skipped。打印 selection：
"Dispatching N specialists: [names]. Skipped: [names] (scope not detected). Gated: [names] (0 findings in N+ reviews)."

---

### Dispatch specialists in parallel（并行派发 specialists）

对每个 selected specialist，通过 Agent tool launch 一个 independent subagent。
**在一条 message 中 launch ALL selected specialists**（multiple Agent tool calls），
让它们 parallel 运行。每个 subagent 都有 fresh context — 没有 prior review bias。

**Each specialist subagent prompt（每个 specialist subagent 的 prompt）：**

为每个 specialist 构造 prompt。Prompt 包含：

1. specialist 的 checklist content（你已经读取了上方 file）
2. Stack context："This is a {STACK} project."
3. 该 domain 的 past learnings（如果存在）：

```bash
~/.claude/skills/gstack/bin/gstack-learnings-search --type pitfall --query "{specialist domain}" --limit 5 2>/dev/null || true
```

如果找到 learnings，包含它们："Past learnings for this domain: {learnings}"

4. Instructions（指令）：

"你是 specialist code reviewer。阅读下方 checklist，然后运行
`DIFF_BASE=$(git merge-base origin/<base> HEAD) && git diff "$DIFF_BASE"` 获取完整 diff。将 checklist 应用于该 diff。

对每个 finding，单独一行输出一个 JSON object：
{\"severity\":\"CRITICAL|INFORMATIONAL\",\"confidence\":N,\"path\":\"file\",\"line\":N,\"category\":\"category\",\"summary\":\"description\",\"fix\":\"recommended fix\",\"fingerprint\":\"path:line:category\",\"specialist\":\"name\"}

Required fields：severity、confidence、path、category、summary、specialist。
Optional：line、fix、fingerprint、evidence、test_stub。

如果你能写一个会捕获此 issue 的 test，把它放进 `test_stub` field。
使用检测到的 test framework（{TEST_FW}）。写 minimal skeleton：describe/it/test
blocks 要有明确 intent。Architectural 或 design-only findings 跳过 test_stub。

如果没有 findings：只输出 `NO FINDINGS`，不要输出其他内容。
不要输出任何其他内容：no preamble、no summary、no commentary。

Stack context: {STACK}
Past learnings: {learnings or 'none'}

CHECKLIST:
{checklist content}"

**Subagent configuration（subagent 配置）：**
- 使用 `subagent_type: "general-purpose"`
- Do NOT use `run_in_background` — merge 前所有 specialists 必须完成
- 如果任何 specialist subagent 失败或 timeout，记录 failure，并用 successful specialists 的 results 继续。Specialists 是 additive — partial results 比 no results 更好。

---

### Step 9.2: Collect and merge findings（收集并合并 findings）

所有 specialist subagents 完成后，收集它们的 outputs。

**Parse findings（解析 findings）：**
对每个 specialist 的 output：
1. 如果 output 是 "NO FINDINGS" — skip，这个 specialist 没有发现问题
2. 否则，将每一行 parse 为 JSON object。跳过 invalid JSON lines。
3. 将所有 parsed findings 收集到单个 list，并带上 specialist name tag。

**Fingerprint and deduplicate（指纹与去重）：**
对每个 finding，计算 fingerprint：
- 如果存在 `fingerprint` field，使用它
- 否则：`{path}:{line}:{category}`（如果存在 line）或 `{path}:{category}`

按 fingerprint group findings。对共享同一 fingerprint 的 findings：
- 保留 confidence score 最高的 finding
- 标记："MULTI-SPECIALIST CONFIRMED ({specialist1} + {specialist2})"
- Confidence +1（cap at 10）
- 在 output 中 note confirming specialists

**Apply confidence gates（应用置信度 gates）：**
- Confidence 7+：在 findings output 中正常展示
- Confidence 5-6：带 caveat 展示："Medium confidence — verify this is actually an issue"
- Confidence 3-4：移到 appendix（从 main findings 中 suppress）
- Confidence 1-2：完全 suppress

**Compute PR Quality Score（计算 PR 质量分）：**
Merge 后，计算 quality score：
`quality_score = max(0, 10 - (critical_count * 2 + informational_count * 0.5))`
Cap at 10。在最后的 review result 中记录它。

**Output merged findings（输出合并后的 findings）：**
用与当前 review 相同的 format 呈现 merged findings：

```
SPECIALIST REVIEW: N findings (X critical, Y informational) from Z specialists

[For each finding, in order: CRITICAL first, then INFORMATIONAL, sorted by confidence descending]
[SEVERITY] (confidence: N/10, specialist: name) path:line — summary
  Fix: recommended fix
  [If MULTI-SPECIALIST CONFIRMED: show confirmation note]

PR Quality Score: X/10
```

这些 findings 会和 checklist pass（Step 9） 一起进入 Fix-First flow（item 4）。
Fix-First heuristic 同样适用 — specialist findings 遵循相同 AUTO-FIX vs ASK classification。

**Compile per-specialist stats（编译每个 specialist 的 stats）：**
Merge findings 后，为 review-log persist 编译 `specialists` object。
对每个 specialist（testing、maintainability、security、performance、data-migration、api-contract、design、red-team）：
- 如果 dispatched：`{"dispatched": true, "findings": N, "critical": N, "informational": N}`
- 如果因为 scope skipped：`{"dispatched": false, "reason": "scope"}`
- 如果因为 gating skipped：`{"dispatched": false, "reason": "gated"}`
- 如果 not applicable（例如 red-team 未 activated）：从 object 中 omit

包含 Design specialist，即使它使用 `design-checklist.md` 而不是 specialist schema files。
记住这些 stats — Step 5.8 的 review-log entry 会需要它们。

---

### Red Team dispatch（conditional）

**Activation:** 仅当 DIFF_LINES > 200，或任一 specialist 产生 CRITICAL finding。

如果 activated，通过 Agent tool 再 dispatch 一个 subagent（foreground，不是 background）。

Red Team subagent 接收：
1. 来自 `~/.claude/skills/gstack/review/specialists/red-team.md` 的 red-team checklist
2. Step 9.2 的 merged specialist findings（让它知道哪些已经 caught）
3. git diff command

Prompt: "你是 red team reviewer。这段 code 已经由 N 个 specialists review 过，他们发现了以下 issues：{merged findings summary}。你的工作是找出他们 MISSED 的内容。阅读 checklist，运行 `DIFF_BASE=$(git merge-base origin/<base> HEAD) && git diff "$DIFF_BASE"`，并寻找 gaps。
Findings 以 JSON objects 输出（与 specialists 使用相同 schema）。重点关注 specialist checklists 没覆盖的 cross-cutting concerns、integration boundary issues 和 failure modes。"

如果 Red Team 找到 additional issues，在 Fix-First flow（item 4） 之前将它们 merge 进 findings list。
Red Team findings 标记为 `"specialist":"red-team"`。

如果 Red Team 返回 NO FINDINGS，note："Red Team review: no additional issues found."（保留 exact note）
如果 Red Team subagent 失败或 timeout，静默 skip 并继续。

### Step 9.3: Cross-review finding dedup（跨 review finding 去重）

分类 findings 前，检查是否有 finding 在此 branch 的 prior review 中已被用户 skipped。

```bash
~/.claude/skills/gstack/bin/gstack-review-read
```

Parse output：只有 `---CONFIG---` 之前的 lines 是 JSONL entries（output 还包含 `---CONFIG---` 和 `---HEAD---` footer sections，它们不是 JSONL — ignore those）。

对每个带 `findings` array 的 JSONL entry：
1. Collect 所有 `action: "skipped"` 的 fingerprints
2. Note 该 entry 的 `commit` field

如果存在 skipped fingerprints，获取从该 review 以来 changed files 的 list：

```bash
git diff --name-only <prior-review-commit> HEAD
```

对每个 current finding（来自 the checklist pass (Step 9) and specialist review (Step 9.1-9.2)），检查：
- 它的 fingerprint 是否匹配 previously skipped finding？
- Finding 的 file path 是否不在 changed-files set 中？

如果两个条件都为 true：suppress the finding。它之前被 intentionally skipped，且相关 code 没变。

Print: "Suppressed N findings from prior reviews (previously skipped by user)"

**只 suppress `skipped` findings，不要 suppress `fixed` 或 `auto-fixed`**（后两者可能 regress，应重新检查）。

如果没有 prior reviews，或没有任何 review 带 `findings` array，静默 skip this step。

输出 summary header：`Pre-Landing Review: N issues (X critical, Y informational)`

4. **按 checklist.md 中的 Fix-First Heuristic，将 checklist pass 和 specialist review
   （Step 9.1-Step 9.2）中的每条 finding 分类为 AUTO-FIX 或 ASK。**
   Critical findings 倾向 ASK；informational 倾向 AUTO-FIX。

5. **Auto-fix 所有 AUTO-FIX items。**应用每个 fix。每个 fix 输出一行：
   `[AUTO-FIXED] [file:line] Problem → what you did`

6. **如果仍有 ASK items，**用一个 AskUserQuestion 呈现：
   - 每项列出 number、severity、problem、recommended fix
   - Per-item options（逐项选项）：A) Fix  B) Skip
   - Overall RECOMMENDATION
   - 如果 ASK items 不超过 3 个，可以改用 individual AskUserQuestion calls

7. **所有 fixes（auto + user-approved）处理后：**
   - 如果应用了任何 fixes：按名称 commit fixed files（`git add <fixed-files> && git commit -m "fix: pre-landing review fixes"`），然后 **STOP**，告诉用户重新运行 `/ship` 以 re-test。
   - 如果没有应用 fixes（所有 ASK items skipped，或没有 issues found）：继续 Step 12。

8. 输出 summary：`Pre-Landing Review: N issues — M auto-fixed, K asked (J fixed, L skipped)`

   如果没有 issues found：`Pre-Landing Review: No issues found.`（保留 exact output）

9. 将 review result 持久化到 review log：
```bash
~/.claude/skills/gstack/bin/gstack-review-log '{"skill":"review","timestamp":"TIMESTAMP","status":"STATUS","issues_found":N,"critical":N,"informational":N,"quality_score":SCORE,"specialists":SPECIALISTS_JSON,"findings":FINDINGS_JSON,"commit":"'"$(git rev-parse --short HEAD)"'","via":"ship"}'
```
替换 TIMESTAMP（ISO 8601）、STATUS（无 issues 时为 "clean"，否则为 "issues_found"），
以及上方 summary counts 中的 N values。`via:"ship"` 用于区别 standalone `/review` runs。
- `quality_score` = Step 9.2 计算的 PR Quality Score（例如 7.5）。如果 specialists 被 skipped（small diff），使用 `10.0`
- `specialists` = Step 9.2 编译的 per-specialist stats object。每个 considered specialist 都有一个 entry：如果 dispatched，则为 `{"dispatched":true/false,"findings":N,"critical":N,"informational":N}`；如果 skipped，则为 `{"dispatched":false,"reason":"scope|gated"}`。Example：`{"testing":{"dispatched":true,"findings":2,"critical":0,"informational":2},"security":{"dispatched":false,"reason":"scope"}}`
- `findings` = per-finding records array。对每条 finding（来自 checklist pass 和 specialists），包含：`{"fingerprint":"path:line:category","severity":"CRITICAL|INFORMATIONAL","action":"ACTION"}`。ACTION 为 `"auto-fixed"`、`"fixed"`（user approved）或 `"skipped"`（user chose Skip）。

保存 review output：它会进入 Step 19 的 PR body。

---
