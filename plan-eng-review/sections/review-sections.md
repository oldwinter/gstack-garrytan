<!-- AUTO-GENERATED from review-sections.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
## Review sections（scope 达成一致后）

**Anti-skip rule（防跳过规则）：** 无论 plan type（strategy、spec、code、infra）如何，都不要压缩、缩写或跳过 review sections（1-4）。每个 section 都有存在理由。“这是 strategy doc，所以 implementation sections 不适用”永远是错的，implementation details 正是 strategy 破裂的地方。如果某 section 真没有 findings，说“没有发现问题”并继续，但必须 evaluate。

**Anti-shortcut clause:** Plan file 是 interactive review 的 OUTPUT，不是替代品。把所有 finding 一次性写进 plan，然后不触发 AskUserQuestion 就调用 ExitPlanMode，正是 2026 年 5 月 transcript bug 的 failure mode：model 探索、发现问题，然后把它们倒进 deliverable，而不是带用户逐项走过。如果任何 review section 中有 ANY non-trivial finding，从 finding 到 ExitPlanMode 的路径必须经过 AskUserQuestion。只有每个 section 都 zero findings 时，才能绕过 AskUserQuestion 进入 ExitPlanMode。如果你发现自己想先写带 findings 的 plan 再问，停下来立刻调用 AskUserQuestion：这就是那个 bug，要识别出来。

## Prior Learnings（历史 learnings）

搜索先前 sessions 中的相关 learnings：

```bash
_CROSS_PROJ=$(~/.claude/skills/gstack/bin/gstack-config get cross_project_learnings 2>/dev/null || echo "unset")
echo "CROSS_PROJECT: $_CROSS_PROJ"
if [ "$_CROSS_PROJ" = "true" ]; then
  ~/.claude/skills/gstack/bin/gstack-learnings-search --limit 10 --cross-project 2>/dev/null || true
else
  ~/.claude/skills/gstack/bin/gstack-learnings-search --limit 10 2>/dev/null || true
fi
```

如果 `CROSS_PROJECT` 是 `unset`（第一次）：使用 AskUserQuestion：

> gstack 可以搜索这台机器上其他 projects 的 learnings，寻找可能适用于这里的 patterns。
> 这只在 local 发生（没有 data 离开你的机器）。推荐 solo developers 使用。
> 如果你同时处理多个 client codebases，担心 cross-contamination，可以跳过。

Options:
- A) 启用 cross-project learnings（recommended）
- B) Learnings 仅保持 project-scoped

如果选择 A：运行 `~/.claude/skills/gstack/bin/gstack-config set cross_project_learnings true`
如果选择 B：运行 `~/.claude/skills/gstack/bin/gstack-config set cross_project_learnings false`

然后使用合适的 flag 重新运行 search。

如果找到 learnings，将其纳入分析。当 review finding 匹配 past learning 时，显示：

**"Prior learning applied: [key] (confidence N/10, from [date])"**

这样会让 compounding 可见。用户应该看到 gstack 正在随着时间推移更了解他们的 codebase。

### 1. Architecture review

评估：

* Overall system design 和 component boundaries。
* Dependency graph 和 coupling concerns。
* Data flow patterns 和 potential bottlenecks。
* Scaling characteristics 和 single points of failure。
* Security architecture（auth, data access, API boundaries）。
* Key flows 是否值得在 plan 或 code comments 中加入 ASCII diagrams。
* 对每个 new codepath 或 integration point，描述一个 realistic production failure scenario，并判断 plan 是否覆盖它。
* **Distribution architecture:** 如果这引入新 artifact（binary、package、container），它如何 build、publish、update？CI/CD pipeline 是否属于 plan，还是 deferred？

对此 section 中发现的每个 issue，单独调用 AskUserQuestion。每次只问一个 issue。呈现 options，说明 recommendation，并解释 WHY。不要把多个 issues batch 进一个 AskUserQuestion。使用 preamble 中的 AskUserQuestion Format section。AskUserQuestion call 是 tool_use，不是 prose，直接调用工具。

**STOP。** 在用户响应前，不要进入下一 review section、不要编辑 plan file 写入 proposed fix、不要调用 ExitPlanMode。即便 issue 有“显而易见的修复”，仍然是 issue，仍然需要 explicit user approval 才能落入 plan。通过 ToolSearch 加载 AskUserQuestion schema 后，把 recommendation 写成 chat prose，是此 gate 要防止的 failure mode。

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

### 2. Code quality review

评估：

* Code organization 和 module structure。
* DRY violations，要 aggressive。
* Error handling patterns 和 missing edge cases（明确 call out）。
* Technical debt hotspots。
* 相对我的 preferences，哪些区域 over-engineered 或 under-engineered。
* Touched files 中 existing ASCII diagrams 是否在 change 后仍准确。

对此 section 中发现的每个 issue，单独调用 AskUserQuestion。每次只问一个 issue。呈现 options，说明 recommendation，并解释 WHY。不要把多个 issues batch 进一个 AskUserQuestion。使用 preamble 中的 AskUserQuestion Format section。AskUserQuestion call 是 tool_use，不是 prose，直接调用工具。

**STOP。** 在用户响应前，不要进入下一 review section、不要编辑 plan file 写入 proposed fix、不要调用 ExitPlanMode。即便 issue 有“显而易见的修复”，仍然是 issue，仍然需要 explicit user approval 才能落入 plan。通过 ToolSearch 加载 AskUserQuestion schema 后，把 recommendation 写成 chat prose，是此 gate 要防止的 failure mode。

### 3. Test review

100% coverage is the goal。评估 plan 中的每条 codepath，确保 plan 为每条 path 都包含 tests。如果 plan 缺 tests，就补上 — plan 应该足够完整，让 implementation 从一开始就包含 full test coverage。

### Test Framework Detection（测试框架检测）

分析 coverage 前，检测 project 的 test framework：

1. **Read CLAUDE.md** — 查找带 test command 和 framework name 的 `## Testing` section。如果找到，以它作为 authoritative source。
2. **如果 CLAUDE.md 没有 testing section，则 auto-detect：**

```bash
setopt +o nomatch 2>/dev/null || true  # zsh compat
# 检测 project runtime
[ -f Gemfile ] && echo "RUNTIME:ruby"
[ -f package.json ] && echo "RUNTIME:node"
[ -f requirements.txt ] || [ -f pyproject.toml ] && echo "RUNTIME:python"
[ -f go.mod ] && echo "RUNTIME:go"
[ -f Cargo.toml ] && echo "RUNTIME:rust"
# 检查 existing test infrastructure
ls jest.config.* vitest.config.* playwright.config.* cypress.config.* .rspec pytest.ini phpunit.xml 2>/dev/null
ls -d test/ tests/ spec/ __tests__/ cypress/ e2e/ 2>/dev/null
```

3. **如果未检测到 framework：** 仍然产出 coverage diagram，但跳过 test generation。

**Step 1. Trace every codepath in the plan（追踪 plan 中的每条 codepath）：**

读取 plan document。对每个描述的新 feature、service、endpoint 或 component，追踪 data 如何流过 code — 不要只列 planned functions，要真正 follow planned execution：

1. **Read the plan。** 对每个 planned component，理解它做什么，以及如何连接 existing code。
2. **Trace data flow。** 从每个 entry point（route handler、exported function、event listener、component render）开始，沿每个 branch follow data：
   - Input 从哪里来？（request params、props、database、API call）
   - 什么会 transform 它？（validation、mapping、computation）
   - 它去哪里？（database write、API response、rendered output、side effect）
   - 每一步可能出什么错？（null/undefined、invalid input、network failure、empty collection）
3. **Diagram the execution。** 对每个 changed file，画一个 ASCII diagram，展示：
   - 每个 added 或 modified 的 function/method
   - 每个 conditional branch（if/else、switch、ternary、guard clause、early return）
   - 每个 error path（try/catch、rescue、error boundary、fallback）
   - 每个对另一个 function 的 call（trace 进去 — 它是否也有 untested branches？）
   - 每个 edge：null input？Empty array？Invalid type？会发生什么？

这是 critical step — 你正在构建一张 map，覆盖每一行会因 input 不同而执行不同路径的 code。这个 diagram 中的每个 branch 都需要 test。

**Step 2. Map user flows、interactions 和 error states：**

Code coverage 不够 — 你需要覆盖真实用户如何与 changed code 互动。对每个 changed feature，思考：

- **User flows:** 用户会采取什么 sequence of actions 来触达这段 code？Map full journey（例如 "user clicks 'Pay' → form validates → API call → success/failure screen"）。Journey 中每一步都需要 test。
- **Interaction edge cases:** 用户做了意外操作时会发生什么？
  - Double-click/rapid resubmit
  - Navigate away mid-operation（back button、close tab、click another link）
  - Submit with stale data（page 打开 30 分钟、session expired）
  - Slow connection（API 花 10 秒 — 用户看到什么？）
  - Concurrent actions（two tabs、same form）
- **用户可见的 error states:** 对 code 处理的每个 error，用户实际 experience 是什么？
  - 是 clear error message，还是 silent failure？
  - 用户能 recover（retry、go back、fix input），还是卡住？
  - No network 时怎样？API 返回 500 时怎样？Server 返回 invalid data 时怎样？
- **Empty/zero/boundary states:** UI 在 zero results、10,000 results、single character input、maximum-length input 时展示什么？

把这些和 code branches 一起加入 diagram。没有 test 的 user flow 和 untested if/else 一样是 gap。

**Step 3. 将每个 branch 对照 existing tests 检查：**

逐个 branch 走查 diagram — 同时包含 code paths 和 user flows。对每一个，搜索是否有 test exercise 它：
- Function `processPayment()` → 查找 `billing.test.ts`、`billing.spec.ts`、`test/billing_test.rb`
- 一个 if/else → 查找覆盖 BOTH true AND false path 的 tests
- 一个 error handler → 查找触发该 specific error condition 的 test
- 调用 `helperFn()` 且它自己有 branches → 那些 branches 也需要 tests
- 一个 user flow → 查找走完整 journey 的 integration 或 E2E test
- 一个 interaction edge case → 查找模拟 unexpected action 的 test

Quality scoring rubric：
- ★★★  测试 behavior，同时覆盖 edge cases AND error paths
- ★★   测试正确 behavior，但只有 happy path
- ★    Smoke test / existence check / trivial assertion（例如 "it renders"、"it doesn't throw"）

### E2E Test Decision Matrix（E2E 测试决策矩阵）

检查每个 branch 时，也判断 unit test 还是 E2E/integration test 才是正确工具：

**RECOMMEND E2E（在 diagram 中标记为 [→E2E]）：**
- 横跨 3+ components/services 的 common user flow（例如 signup → verify email → first login）
- Mocking 会隐藏真实 failures 的 integration point（例如 API → queue → worker → DB）
- Auth/payment/data-destruction flows — 太重要，不能只信 unit tests

**RECOMMEND EVAL（在 diagram 中标记为 [→EVAL]）：**
- 需要 quality eval 的 critical LLM call（例如 prompt change → test output 仍达到 quality bar）
- 对 prompt templates、system instructions 或 tool definitions 的修改

**STICK WITH UNIT TESTS：**
- inputs/outputs 清晰的 pure function
- 无 side effects 的 internal helper
- 单个 function 的 edge case（null input、empty array）
- 不面向 customer 的 obscure/rare flow

### REGRESSION RULE（mandatory，强制）

**IRON RULE：** 当 coverage audit 识别出 REGRESSION — 以前能 work、但 diff 破坏了的 code — regression test 必须作为 critical requirement 加入 plan。No AskUserQuestion。No skipping。Regressions 是最高优先级 test，因为它证明某个东西已经 broken。

Regression 指：
- diff 修改 existing behavior（不是 new code）
- existing test suite（如果有）没有覆盖 changed path
- change 为 existing callers 引入了 new failure mode

不确定某个 change 是否是 regression 时，倾向于写 test。

**Step 4. Output ASCII coverage diagram（输出 ASCII coverage diagram）：**

在同一个 diagram 中同时包含 code paths 和 user flows。标记 E2E-worthy 和 eval-worthy paths：

```
CODE PATHS                                            USER FLOWS
[+] src/services/billing.ts                           [+] Payment checkout
  ├── processPayment()                                  ├── [★★★ TESTED] Complete purchase — checkout.e2e.ts:15
  │   ├── [★★★ TESTED] happy + declined + timeout      ├── [GAP] [→E2E] Double-click submit
  │   ├── [GAP]         Network timeout                 └── [GAP]        Navigate away mid-payment
  │   └── [GAP]         Invalid currency
  └── refundPayment()                                 [+] Error states
      ├── [★★  TESTED] Full refund — :89                ├── [★★  TESTED] Card declined message
      └── [★   TESTED] Partial (non-throw only) — :101  └── [GAP]        Network timeout UX

LLM integration: [GAP] [→EVAL] Prompt template change — needs eval test

COVERAGE: 5/13 paths tested (38%)  |  Code paths: 3/5 (60%)  |  User flows: 2/8 (25%)
QUALITY: ★★★:2 ★★:2 ★:1  |  GAPS: 8 (2 E2E, 1 eval)
```

Legend：★★★ behavior + edge + error  |  ★★ happy path  |  ★ smoke check
[→E2E] = needs integration test  |  [→EVAL] = needs LLM eval

**Fast path:** All paths covered → "Test review: All new code paths have test coverage ✓" Continue。

**Step 5. 将 missing tests 添加到 plan：**

对 diagram 中识别的每个 GAP，向 plan 添加一条 test requirement。要具体：
- 创建什么 test file（match existing naming conventions）
- test 应该 assert 什么（specific inputs → expected outputs/behavior）
- 它是 unit test、E2E test 还是 eval（使用 decision matrix）
- 对 regressions：flag as **CRITICAL** 并解释 what broke

Plan 应该足够完整，让 implementation 开始时每个 test 都能和 feature code 一起写，而不是 deferred 到 follow-up。

### Test Plan Artifact（测试计划产物）

生成 coverage diagram 后，将 test plan artifact 写入 project directory，让 `/qa` 和 `/qa-only` 能把它作为 primary test input 消费：

```bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" && mkdir -p ~/.gstack/projects/$SLUG
USER=$(whoami)
DATETIME=$(date +%Y%m%d-%H%M%S)
```

写入 `~/.gstack/projects/{slug}/{user}-{branch}-eng-review-test-plan-{datetime}.md`：

```markdown
# Test Plan（测试计划）
Generated by /plan-eng-review on {date}
Branch: {branch}
Repo: {owner/repo}

## Affected Pages/Routes（受影响页面/路由）
- {URL path} — {what to test and why}

## Key Interactions to Verify（需要验证的关键交互）
- {interaction description} on {page}

## Edge Cases（边界情况）
- {edge case} on {page}

## Critical Paths（关键路径）
- {end-to-end flow that must work}
```

这个 file 会被 `/qa` 和 `/qa-only` 作为 primary test input 消费。只包含帮助 QA tester 知道 **what to test and where** 的信息 — 不要 implementation details。

对 LLM/prompt changes：检查 CLAUDE.md 中列出的 “Prompt/LLM changes” file patterns。如果 plan 触碰任何这些 patterns，说明必须运行哪些 eval suites、应添加哪些 cases、要对比哪些 baselines。然后用 AskUserQuestion 与用户确认 eval scope。

对此 section 中发现的每个 issue，单独调用 AskUserQuestion。每次只问一个 issue。呈现 options，说明 recommendation，并解释 WHY。不要把多个 issues batch 进一个 AskUserQuestion。使用 preamble 中的 AskUserQuestion Format section。AskUserQuestion call 是 tool_use，不是 prose，直接调用工具。

**STOP。** 在用户响应前，不要进入下一 review section、不要编辑 plan file 写入 proposed fix、不要调用 ExitPlanMode。即便 issue 有“显而易见的修复”，仍然是 issue，仍然需要 explicit user approval 才能落入 plan。通过 ToolSearch 加载 AskUserQuestion schema 后，把 recommendation 写成 chat prose，是此 gate 要防止的 failure mode。

### 4. Performance review

评估：

* N+1 queries 和 database access patterns。
* Memory-usage concerns。
* Caching opportunities。
* Slow 或 high-complexity code paths。

对此 section 中发现的每个 issue，单独调用 AskUserQuestion。每次只问一个 issue。呈现 options，说明 recommendation，并解释 WHY。不要把多个 issues batch 进一个 AskUserQuestion。使用 preamble 中的 AskUserQuestion Format section。AskUserQuestion call 是 tool_use，不是 prose，直接调用工具。

**STOP。** 在用户响应前，不要进入下一 review section、不要编辑 plan file 写入 proposed fix、不要调用 ExitPlanMode。即便 issue 有“显而易见的修复”，仍然是 issue，仍然需要 explicit user approval 才能落入 plan。通过 ToolSearch 加载 AskUserQuestion schema 后，把 recommendation 写成 chat prose，是此 gate 要防止的 failure mode。

## Outside Voice — Independent Plan Challenge（default-on）

所有 review sections 完成后，自动运行来自 different AI system 的 independent second opinion。
这是 plan review 的 standard step，不是 opt-in。两个 models 对 plan 达成一致，比单个 model
的 thorough review 是更强信号。用户只有显式要求时才关闭它（`gstack-config set codex_reviews disabled`）。

**Preflight — decide whether and how the outside voice runs（预检 outside voice 如何运行）：**

```bash
# Codex preflight: one block (functions sourced here don't persist to later blocks).
_TEL=$(~/.claude/skills/gstack/bin/gstack-config get telemetry 2>/dev/null || echo off)
_CODEX_CFG=$(~/.claude/skills/gstack/bin/gstack-config get codex_reviews 2>/dev/null || echo enabled)
source ~/.claude/skills/gstack/bin/gstack-codex-probe 2>/dev/null || true
if [ "$_CODEX_CFG" = "disabled" ]; then
  _CODEX_MODE="disabled"
elif ! command -v codex >/dev/null 2>&1; then
  _CODEX_MODE="not_installed"; _gstack_codex_log_event "codex_cli_missing" 2>/dev/null || true
elif ! _gstack_codex_auth_probe >/dev/null 2>&1; then
  _CODEX_MODE="not_authed"; _gstack_codex_log_event "codex_auth_failed" 2>/dev/null || true
else
  _CODEX_MODE="ready"; _gstack_codex_version_check 2>/dev/null || true
fi
echo "CODEX_MODE: $_CODEX_MODE"
```

Branch on the echoed `CODEX_MODE`:
- **`disabled`** — the user turned Codex reviews off (`codex_reviews=disabled`). Skip this section entirely; do NOT fall back to a Claude subagent — disabled means no extra review step. Print: "Codex review skipped (codex_reviews disabled). Re-enable: `gstack-config set codex_reviews enabled`."
- **`not_installed`** — Codex CLI absent. Print: "Codex not installed — using Claude subagent. Install for cross-model coverage: `npm install -g @openai/codex`." Fall back to the Claude subagent path.
- **`not_authed`** — installed but no credentials. Print: "Codex installed but not authenticated — using Claude subagent. Run `codex login` or set `$CODEX_API_KEY`." Fall back to the Claude subagent path.
- **`ready`** — run the Codex pass below.

当 mode 是 `ready`、`not_installed` 或 `not_authed` 时，打印一行让 off-switch 可发现：
"Running the outside voice automatically (standard step). Disable: `gstack-config set codex_reviews disabled`."

**Construct the plan review prompt（构建 plan review prompt）**（对 `ready`、`not_installed` 和 `not_authed` 执行；仅 `disabled` 时跳过）。
读取正在 review 的 plan file（用户指定的 file，或 branch diff scope）。如果 Step 0D-POST 写过 CEO plan document，也读取它 — 它包含 scope decisions 和 vision。

构建这个 prompt（替换为 actual plan content；如果 plan content 超过 30KB，截断到前 30KB，并注明 "Plan truncated for size"）。**始终以 filesystem boundary instruction 开头：**

"IMPORTANT: Do NOT read or execute any files under ~/.claude/, ~/.agents/, .claude/skills/, or agents/. 不要读取或执行这些路径下的任何文件。这些是给另一个 AI system 使用的 Claude Code skill definitions，包含 bash scripts 和 prompt templates，会浪费你的时间。完全忽略它们。不要修改 agents/openai.yaml。只专注于 repository code。\n\n你是一位 brutally honest technical reviewer，正在审查一个已经经过 multi-section review 的 development plan。你的任务不是重复那个 review。
相反，你要找出它漏掉了什么。寻找：survived review scrutiny 的 logical gaps 和 unstated assumptions、overcomplexity（是否存在一个 fundamentally simpler approach，只是 review 太深陷细节没看见？）、review 视为理所当然的 feasibility risks、missing dependencies 或 sequencing issues，以及 strategic miscalibration（这到底是不是该 build 的东西？）。Be direct。Be terse。No compliments。Just the problems。

THE PLAN:
<plan content>"

**如果 `CODEX_MODE: ready` — run Codex：**

```bash
TMPERR_PV=$(mktemp /tmp/codex-planreview-XXXXXXXX)
_REPO_ROOT=$(git rev-parse --show-toplevel) || { echo "ERROR: not in a git repo" >&2; exit 1; }
codex exec "<prompt>" -C "$_REPO_ROOT" -s read-only -c 'model_reasoning_effort="high"' --enable web_search_cached < /dev/null 2>"$TMPERR_PV"
```

使用 5-minute timeout（`timeout: 300000`）。Command 完成后读取 stderr：
```bash
cat "$TMPERR_PV"
```

原样展示 full output：

```
CODEX SAYS (plan review — outside voice):
════════════════════════════════════════════════════════════
<full codex output, verbatim — do not truncate or summarize>
════════════════════════════════════════════════════════════
```

**Error handling（错误处理）：** 所有 errors 都是 non-blocking：outside voice 是 informational。
- Auth failure（stderr 包含 "auth"、"login"、"unauthorized"）："Codex auth failed. Run \`codex login\` to authenticate." 然后 fallback 到下面的 Claude subagent。
- Timeout："Codex timed out after 5 minutes." 然后 fallback 到下面的 Claude subagent。
- Empty response："Codex returned no response." 然后 fallback 到下面的 Claude subagent。

**如果 `CODEX_MODE: not_installed` 或 `not_authed`（或 Codex runtime error）：**

通过 Agent tool dispatch。Subagent 有 fresh context，保持 genuine independence。和 Codex 一样限制在 5-minute timeout，让 "never blocking" 也意味着 "never hanging"。

Subagent prompt：使用上方相同的 plan review prompt。

在 `OUTSIDE VOICE (Claude subagent):` header 下展示 findings。

如果 subagent fails 或 times out："Outside voice unavailable. Continuing to outputs."

（`CODEX_MODE: disabled` 时已按 preflight 跳过本 section；不要走到这里。）

**Cross-model tension（跨模型张力）：**

展示 outside voice findings 后，记录 outside voice 与 earlier sections 的 review findings
不一致之处。按以下格式标记：

```
CROSS-MODEL TENSION:
  [Topic]: Review said X. Outside voice says Y. [Present both perspectives neutrally.
  State what context you might be missing that would change the answer.]
```

**User Sovereignty（用户主权）：** 不要自动把 outside voice recommendations 纳入 plan。
把每个 tension point 呈现给用户。由用户决定。Cross-model agreement 是 strong signal，
可以这样呈现，但它不是 permission to act。你可以说明哪个 argument 更 compelling，
但没有 explicit user approval 时，MUST NOT apply the change。

对每个 substantive tension point，使用 AskUserQuestion：

> "Cross-model disagreement on [topic]. The review found [X] but the outside voice
> argues [Y]. [One sentence on what context you might be missing.]"
>
> RECOMMENDATION: Choose [A or B] because [one-line reason explaining which argument
> is more compelling and why]. Completeness: A=X/10, B=Y/10.

Options（选项）:
- A) Accept the outside voice's recommendation (I'll apply this change)
- B) Keep the current approach (reject the outside voice)
- C) Investigate further before deciding
- D) Add to TODOS.md for later

等待用户 response。不要因为你同意 outside voice 就 default to accepting。
如果用户选择 B，current approach stands — 不要反复争辩。

如果没有 tension points，note: "No cross-model tension — both reviewers agree."

**Persist the result（持久化结果）：**
```bash
~/.claude/skills/gstack/bin/gstack-review-log '{"skill":"codex-plan-review","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","status":"STATUS","source":"SOURCE","commit":"'"$(git rev-parse --short HEAD)"'"}'
```

替换变量：如果没有 findings，STATUS = "clean"；如果存在 findings，STATUS = "issues_found"。
如果 Codex ran，SOURCE = "codex"；如果 subagent ran，SOURCE = "claude"。

**Cleanup（清理）：** processing 后运行 `rm -f "$TMPERR_PV"`（如果使用了 Codex）。

---

### Outside Voice 集成规则

Outside voice findings 在用户逐条明确批准前都是 INFORMATIONAL。不要在没有通过 AskUserQuestion 呈现每条 finding 并获得 explicit approval 的情况下，将 outside voice recommendations 写入 plan。即使你同意 outside voice 也一样。Cross-model consensus 是强信号，应作为强信号呈现，但最终由用户决策。

## 关键规则 — 如何提问

遵循上方 Preamble 中的 AskUserQuestion format。Plan reviews 的额外规则：

* **One issue = one AskUserQuestion call（一个 issue = 一次 AskUserQuestion 调用）。** 永远不要把多个 issues 合并成一个 question。
* 具体描述 problem，带 file 和 line references。
* 提供 2-3 个 options，其中 reasonable 时包括 “do nothing”。
* 对每个 option，用一行说明：effort（human: ~X / CC: ~Y）、risk 和 maintenance burden。如果在 CC 下 complete option 只比 shortcut 多一点 effort，推荐 complete option。
* **把 reasoning 映射到我上面的工程偏好。** 用一句话把 recommendation 连接到具体 preference（DRY、explicit > clever、minimal diff 等）。
* 用 issue NUMBER + option LETTER 标注（例如 “3A”, “3B”）。
* **Coverage vs kind:** 对本 review 中每个 per-issue AskUserQuestion，判断 options 是 coverage 不同还是 kind 不同。如果是 coverage（例如更多 tests vs 更少、complete error handling vs happy-path-only、full edge-case coverage vs shortcut），每个 option 都包含 `Completeness: N/10`。如果是 kind（例如两种不同 architecture choices、posture-over-posture、A/B/C 各为不同类型），跳过分数，并加一行：`Note: options differ in kind, not coverage — no completeness score.` 不要在 kind-differentiated questions 上伪造 scores，filler scores 比无 score 更糟。
* **Zero findings（零 findings）：** 如果某 section 零 findings，说“没有发现问题，继续”并继续。否则，每个 finding 都用 AskUserQuestion。带“显而易见的修复”的 finding 仍然是 finding，仍然需要 user approval 才能进入 plan。

## 必需输出

### "NOT in scope" section（不在范围内）

每个 plan review 都必须产出 “NOT in scope” section，列出曾考虑但明确 deferred 的工作，并给出每项的一行 rationale。

### "What already exists" section（已有内容）

列出现有 code/flows 中已经部分解决 plan sub-problems 的内容，并说明 plan 是否复用它们，还是不必要地重建。

### TODOS.md updates（TODOS.md 更新）

所有 review sections 完成后，把每个 potential TODO 作为单独 AskUserQuestion 呈现。永远不要 batch TODOs：每个 question 一个。永远不要静默跳过此步骤。遵循 `.claude/skills/review/TODOS-format.md` 中的 format。

对每个 TODO，描述：

* **What（做什么）：** 一行 work description。
* **Why（为什么）：** 它解决的具体 problem 或解锁的 value。
* **Pros（优点）：** 做这项工作获得什么。
* **Cons（缺点）：** 成本、复杂性或风险。
* **Context（上下文）：** 足够 detail，让 3 个月后接手的人理解 motivation、current state 和从哪里开始。
* **Depends on / blocked by（依赖/阻塞）：** 任何 prerequisites 或 ordering constraints。

然后呈现选项：**A)** 添加到 TODOS.md **B)** 跳过，价值不够 **C)** 不 defer，在这个 PR 中现在构建它。

不要只 append vague bullet points。没有 context 的 TODO 比没有 TODO 更糟，因为它制造“idea 已 capture”的 false confidence，却丢掉 reasoning。

### Diagrams（图示）

Plan 本身应为任何 non-trivial data flow、state machine 或 processing pipeline 使用 ASCII diagrams。此外，识别 implementation 中哪些 files 应获得 inline ASCII diagram comments，尤其是有 complex state transitions 的 Models、多步骤 pipelines 的 Services，以及 non-obvious mixin behavior 的 Concerns。

### Failure modes（失败模式）

对 test review diagram 中识别的每个 new codepath，列出一个 realistic production failure 方式（timeout、nil reference、race condition、stale data 等），并说明：

1. 是否有 test 覆盖该 failure
2. 是否有 error handling
3. 用户会看到 clear error 还是 silent failure

如果某 failure mode 没有 test、没有 error handling，且会 silent，就 flag 为 **critical gap**。

### Worktree parallelization strategy（worktree 并行策略）

分析 plan implementation steps 是否有 parallel execution opportunities。这帮助用户跨 git worktrees 拆分工作（通过 Claude Code 的 Agent tool with `isolation: "worktree"` 或 parallel workspaces）。

**跳过条件：** 所有 steps 都触碰同一个 primary module，或 plan 少于 2 个 independent workstreams。在这种情况下写：`Sequential implementation, no parallelization opportunity.`

**否则，产出：**

1. **Dependency table（依赖表）** — 对每个 implementation step/workstream：

| Step | Modules touched | Depends on |
|------|----------------|------------|
| (step name) | (directories/modules, NOT specific files) | (other steps, or —) |

在 module/directory level 工作，不要 file level。Plans 描述 intent（“add API endpoints”），不是 specific files。Module-level（“controllers/, models/”）可靠；file-level 是猜测。

2. **Parallel lanes（并行 lanes）** — 把 steps 分组：
   - 无 shared modules 且无 dependency 的 steps 放在 separate lanes（parallel）
   - 共享 module directory 的 steps 放在同一 lane（sequential）
   - 依赖其他 steps 的 steps 放在 later lanes

Format: `Lane A: step1 → step2 (sequential, shared models/)` / `Lane B: step3 (independent)`

3. **Execution order（执行顺序）** — 哪些 lanes parallel launch，哪些等待。例如：“Launch A + B in parallel worktrees. Merge both. Then C.”

4. **Conflict flags（冲突标记）** — 如果两个 parallel lanes 触碰同一 module directory，flag：`Lanes X and Y both touch module/ — potential merge conflict. Consider sequential execution or careful coordination.`（Lanes X 和 Y 都触碰 module/，可能产生 merge conflict；考虑 sequential execution 或谨慎协调。）

## Implementation Tasks（实现任务）

关闭此 review 前，把上面的 findings 综合成一个 flat list，列出 build-actionable tasks。每个 task 都必须来自具体 finding，不要 padding。
输出 markdown section，并写入一个可供 `/autoplan` 跨 phases 聚合的 JSONL artifact。

### Markdown section（始终输出）

```markdown
## Implementation Tasks
由此 review 的 findings 综合而来。每个 task 都来自上方某个具体 finding。
用 Claude Code 或 Codex 执行；shipping 时勾选 checkbox。

- [ ] **T1 (P1, human: ~2h / CC: ~15min)** — <component> — <imperative title>
  - 来源：<section name> — <specific finding text or line reference>
  - Files: <paths to touch>
  - Verify：<test command or manual check>
- [ ] **T2 (P2, human: ~30min / CC: ~5min)** — ...
```

Rules（规则）：
- P1 会 block ship；P2 应该在同一 branch 落地；P3 是 follow-up TODO。
- 如果某个 finding 没有产生 actionable task，不要 invent one。
- 如果某个 section 是 zero findings，输出 `_No new tasks from <section>._`
- Effort 使用 CLAUDE.md 中的 AI-compression table。

### JSONL artifact（始终写入，即使 zero tasks）

`/autoplan` 会读取此 file 并跨 phases 聚合。每一行都用 `jq -nc` 构造，
这样包含 quotes、newlines 或 backslashes 的 titles/source findings 能正确 serialize。
绝不要 hand-roll `echo` / `printf`。

```bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)"
TASKS_DIR="${HOME}/.gstack/projects/${SLUG:-unknown}"
mkdir -p "$TASKS_DIR"
TASKS_FILE="$TASKS_DIR/tasks-eng-review-$(date +%Y%m%d-%H%M%S).jsonl"
COMMIT=$(git rev-parse HEAD 2>/dev/null || echo unknown)
BRANCH=$(git branch --show-current 2>/dev/null || echo unknown)
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"

# 对此 review 中识别出的每个 task 重复一次 jq invocation。
# 用你为每个 task 设置的 shell variables inline 替换 placeholders：
#   TASK_ID (T1, T2, ...), PRIORITY (P1/P2/P3), COMPONENT, TITLE,
#   SOURCE_FINDING, EFFORT_HUMAN, EFFORT_CC, FILES_JSON (a JSON array literal
#   like '["browse/src/sanitize.ts","browse/src/server.ts"]').
jq -nc \
  --arg phase 'eng-review' \
  --arg run_id "$RUN_ID" \
  --arg branch "$BRANCH" \
  --arg commit "$COMMIT" \
  --arg id "$TASK_ID" \
  --arg priority "$PRIORITY" \
  --arg component "$COMPONENT" \
  --arg effort_human "$EFFORT_HUMAN" \
  --arg effort_cc "$EFFORT_CC" \
  --arg title "$TITLE" \
  --arg source_finding "$SOURCE_FINDING" \
  --argjson files "$FILES_JSON" \
  '{phase:$phase, run_id:$run_id, branch:$branch, commit:$commit, id:$id, priority:$priority, component:$component, files:$files, effort_human:$effort_human, effort_cc:$effort_cc, title:$title, source_finding:$source_finding}' \
  >> "$TASKS_FILE"
```

如果未安装 `jq`，fallback 为跳过 JSONL write，并 warn 用户安装 jq 以支持 autoplan aggregation。绝不要 hand-roll JSONL。

如果此 review 识别出 zero tasks，仍然 touch JSONL file（`: > "$TASKS_FILE"`），
让 aggregator 知道此 phase 在本次 run 中产出过 output（empty file 表示 "ran, no findings"，不同于 "didn't run"）。


### Completion summary（完成摘要）

Review 末尾填充并展示此 summary，让用户一眼看到全部 findings：

- Step 0：Scope Challenge — ___（scope accepted as-is / scope reduced per recommendation）
- Architecture Review：发现 ___ 个 issues
- Code Quality Review：发现 ___ 个 issues
- Test Review：已产出 diagram，识别 ___ 个 gaps
- Performance Review：发现 ___ 个 issues
- NOT in scope：已写
- What already exists：已写
- TODOS.md updates：向用户 proposed ___ 个 items
- Failure modes：标记 ___ 个 critical gaps
- Outside voice：已运行 (codex/claude) / 已跳过
- Parallelization：___ lanes，___ parallel / ___ sequential
- Lake Score：X/Y recommendations 选择了 complete option

## Retrospective learning（复盘学习）

检查此 branch 的 git log。如果 prior commits 暗示之前有 review cycle（例如 review-driven refactors、reverted changes），说明之前改了什么，以及 current plan 是否触碰同一区域。对之前出过问题的 areas 要更 aggressive review。

## Formatting rules（格式规则）

* 用数字编号 issues（1, 2, 3...），用字母标 options（A, B, C...）。
* 用 NUMBER + LETTER 标注（例如 “3A”, “3B”）。
* 每个 option 最多一句话。5 秒内能选。
* 每个 review section 后暂停并询问 feedback，再继续。

## Review Log（review 日志）

生成上方 Completion Summary 后，持久化 review result。

**PLAN MODE EXCEPTION — ALWAYS RUN：** 此命令把 review metadata 写到 `~/.gstack/`（user config directory，不是 project files）。Skill preamble 已经写入 `~/.gstack/sessions/` 和 `~/.gstack/analytics/`，这是同一 pattern。Review dashboard 依赖这些 data。跳过此命令会破坏 `/ship` 中的 review readiness dashboard。

```bash
~/.claude/skills/gstack/bin/gstack-review-log '{"skill":"plan-eng-review","timestamp":"TIMESTAMP","status":"STATUS","unresolved":N,"critical_gaps":N,"issues_found":N,"mode":"MODE","commit":"COMMIT"}'
~/.claude/skills/gstack/bin/gstack-decision-log '{"decision":"Eng review (MODE): ARCH_SUMMARY","rationale":"KEY_DECISION","scope":"branch","source":"skill","confidence":8}' 2>/dev/null || true
```

第二个命令会把 architecture verdict 记录为 durable cross-session decision，让未来 session 继承 chosen approach 和已 hardened 的内容，而不只是 count。它与 review-log 使用相同的 `~/.gstack/` write pattern，non-interactive，best-effort（`|| true`）。替换 `ARCH_SUMMARY`（例如 "N findings, all folded" 或 "M unresolved"）和 `KEY_DECISION`（report 中 load-bearing architecture call，一行；如果 review 没发现 durable 内容则 omit）。

用 Completion Summary 中的值替换：

- **TIMESTAMP**: 当前 ISO 8601 datetime
- **STATUS**: 如果 0 unresolved decisions 且 0 critical gaps，则为 `"clean"`；否则为 `"issues_open"`
- **unresolved**: “Unresolved decisions” count 中的数字
- **critical_gaps**: “Failure modes: ___ critical gaps flagged” 中的数字
- **issues_found**: 所有 review sections 中的 total issues found（Architecture + Code Quality + Performance + Test gaps）
- **MODE**: FULL_REVIEW / SCOPE_REDUCED
- **COMMIT**: `git rev-parse --short HEAD` 的输出

## Review Readiness Dashboard

完成 review 后，读取 review log 和 config，并展示 dashboard。

```bash
~/.claude/skills/gstack/bin/gstack-review-read
```

Parse output。为每个 skill（plan-ceo-review、plan-eng-review、review、plan-design-review、design-review-lite、adversarial-review、codex-review、codex-plan-review）找到最近 entry。忽略 timestamp 超过 7 天的 entries。Eng Review 行显示 `review`（diff-scoped pre-landing review）和 `plan-eng-review`（plan-stage architecture review）中更新的一条，并在 status 后追加 "(DIFF)" 或 "(PLAN)" 区分。Adversarial 行显示 `adversarial-review`（new auto-scaled）和 `codex-review`（legacy）中更新的一条。Design Review 行显示 `plan-design-review`（full visual audit）和 `design-review-lite`（code-level check）中更新的一条，并追加 "(FULL)" 或 "(LITE)" 区分。Outside Voice 行显示最近的 `codex-plan-review` entry，它捕获 /plan-ceo-review 和 /plan-eng-review 中的 outside voices。

**Source attribution（来源归因）：** 如果某个 skill 的最近 entry 有 \`"via"\` field，将其追加到 status label 的括号中。示例：`plan-eng-review` + `via:"autoplan"` 显示为 "CLEAR (PLAN via /autoplan)"；`review` + `via:"ship"` 显示为 "CLEAR (DIFF via /ship)"。没有 `via` field 的 entries 仍按之前显示为 "CLEAR (PLAN)" 或 "CLEAR (DIFF)"。

Note：`autoplan-voices` 和 `design-outside-voices` entries 只作为 audit trail（用于 cross-model consensus analysis 的 forensic data）。它们不显示在 dashboard 中，也不被任何 consumer 检查。

展示：

```
+====================================================================+
|                    REVIEW READINESS DASHBOARD                       |
+====================================================================+
| Review          | Runs | Last Run            | Status    | Required |
|-----------------|------|---------------------|-----------|----------|
| Eng Review      |  1   | 2026-03-16 15:00    | CLEAR     | YES      |
| CEO Review      |  0   | —                   | —         | no       |
| Design Review   |  0   | —                   | —         | no       |
| Adversarial     |  0   | —                   | —         | no       |
| Outside Voice   |  0   | —                   | —         | no       |
+--------------------------------------------------------------------+
| VERDICT: CLEARED — Eng Review passed                                |
+====================================================================+
```

**Review tiers（review 层级）：**
- **Eng Review (required by default):** 唯一 gate shipping 的 review。覆盖 architecture、code quality、tests、performance。可用 \`gstack-config set skip_eng_review true\` 全局关闭（"don't bother me" setting）。
- **CEO Review (optional):** 使用 judgment。建议用于重大 product/business changes、新 user-facing features 或 scope decisions。Bug fixes、refactors、infra 和 cleanup 可跳过。
- **Design Review (optional):** 使用 judgment。建议用于 UI/UX changes。Backend-only、infra 或 prompt-only changes 可跳过。
- **Adversarial Review (automatic):** 每个 review 都 always-on。每个 diff 都会获得 Claude adversarial subagent 和 Codex adversarial challenge。Large diffs（200+ lines）还会额外获得带 P1 gate 的 Codex structured review。无需配置。
- **Outside Voice (optional):** 来自不同 AI model 的 independent plan review。在 /plan-ceo-review 和 /plan-eng-review 的所有 review sections 完成后提供。Codex 不可用时 fallback 到 Claude subagent。永不 gate shipping。

**Verdict logic（判定逻辑）：**
- **CLEARED**: Eng Review 在 7 天内有 >= 1 条来自 \`review\` 或 \`plan-eng-review\` 且 status 为 "clean" 的 entry（或 \`skip_eng_review\` 为 \`true\`）
- **NOT CLEARED**: Eng Review 缺失、stale（>7 天）或存在 open issues
- CEO、Design 和 Codex reviews 只展示 context，永不 block shipping
- 如果 \`skip_eng_review\` config 为 \`true\`，Eng Review 显示 "SKIPPED (global)"，verdict 为 CLEARED

**Staleness detection（过期检测）：** 展示 dashboard 后，检查现有 reviews 是否可能 stale：
- 从 bash output 的 \`---HEAD---\` section parse 当前 HEAD commit hash
- 对每个带 \`commit\` field 的 review entry：与当前 HEAD 比较。如果不同，计算 elapsed commits：\`git rev-list --count STORED_COMMIT..HEAD\`。显示："Note: {skill} review from {date} may be stale — {N} commits since review"（保留原文，便于 log/search 稳定）
- 对没有 \`commit\` field 的 entries（legacy entries）：显示 "Note: {skill} review from {date} has no commit tracking — consider re-running for accurate staleness detection"（保留原文，便于 log/search 稳定）
- 如果所有 reviews 都匹配当前 HEAD，不显示任何 staleness notes

## Plan File Review Report

在 conversation output 中展示 Review Readiness Dashboard 后，也要更新 **plan file** 本身，
让任何阅读 plan 的人都能看到 review status。

### Detect the plan file（检测 plan file）

1. 检查当前 conversation 中是否有 active plan file（host 会在 system messages 中提供 plan file
   paths；在 conversation context 中查找 plan file references）。
2. 如果未找到，静默跳过此 section：不是每个 review 都在 plan mode 中运行。

### Generate the report（生成报告）

读取上方 Review Readiness Dashboard step 中已有的 review log output。Parse 每条 JSONL entry。
不同 skill 会记录不同 fields：

- **plan-ceo-review**: \`status\`, \`unresolved\`, \`critical_gaps\`, \`mode\`, \`scope_proposed\`, \`scope_accepted\`, \`scope_deferred\`, \`commit\`
  → Findings: "{scope_proposed} proposals, {scope_accepted} accepted, {scope_deferred} deferred"
  → If scope fields are 0 or missing (HOLD/REDUCTION mode): "mode: {mode}, {critical_gaps} critical gaps"
- **plan-eng-review**: \`status\`, \`unresolved\`, \`critical_gaps\`, \`issues_found\`, \`mode\`, \`commit\`
  → Findings: "{issues_found} issues, {critical_gaps} critical gaps"
- **plan-design-review**: \`status\`, \`initial_score\`, \`overall_score\`, \`unresolved\`, \`decisions_made\`, \`commit\`
  → Findings: "score: {initial_score}/10 → {overall_score}/10, {decisions_made} decisions"
- **plan-devex-review**: \`status\`, \`initial_score\`, \`overall_score\`, \`product_type\`, \`tthw_current\`, \`tthw_target\`, \`mode\`, \`persona\`, \`competitive_tier\`, \`unresolved\`, \`commit\`
  → Findings: "score: {initial_score}/10 → {overall_score}/10, TTHW: {tthw_current} → {tthw_target}"
- **devex-review**: \`status\`, \`overall_score\`, \`product_type\`, \`tthw_measured\`, \`dimensions_tested\`, \`dimensions_inferred\`, \`boomerang\`, \`commit\`
  → Findings: "score: {overall_score}/10, TTHW: {tthw_measured}, {dimensions_tested} tested/{dimensions_inferred} inferred"
- **codex-review**: \`status\`, \`gate\`, \`findings\`, \`findings_fixed\`
  → Findings: "{findings} findings, {findings_fixed}/{findings} fixed"

Findings column 所需的所有 fields 现在都存在于 JSONL entries 中。对刚完成的 review，可以使用你自己的
Completion Summary 中更丰富的细节。对 prior reviews，直接使用 JSONL fields：它们包含所有 required data。

生成以下 markdown table：

\`\`\`markdown
## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | \`/plan-ceo-review\` | Scope & strategy | {runs} | {status} | {findings} |
| Codex Review | \`/codex review\` | Independent 2nd opinion | {runs} | {status} | {findings} |
| Eng Review | \`/plan-eng-review\` | Architecture & tests (required) | {runs} | {status} | {findings} |
| Design Review | \`/plan-design-review\` | UI/UX gaps | {runs} | {status} | {findings} |
| DX Review | \`/plan-devex-review\` | Developer experience gaps | {runs} | {status} | {findings} |
\`\`\`

在 table 下方添加这些 lines。**CODEX** 和 **CROSS-MODEL** 可选（为空时省略）；**VERDICT** 必须始终存在：

- **CODEX:**（仅当 codex-review 运行过）codex fixes 的一行 summary
- **CROSS-MODEL:**（仅当 Claude 和 Codex reviews 都存在）overlap analysis
- **VERDICT:** 列出 CLEAR 的 reviews（例如 "CEO + ENG CLEARED — ready to implement"）。
  如果 Eng Review 不是 CLEAR 且没有 global skip，追加 "eng review required"。

**Unresolved-decisions status（强制 — 永不省略；必须是 report 的 final non-whitespace line）。**
在 VERDICT 后，用且只用以下一种形式结束 report（位于 \`## GSTACK REVIEW REPORT\` heading 下的内容；这是 bold label，绝不是新的 \`## \` heading；不受 "空值省略" 规则约束）：exact unbolded line \`NO UNRESOLVED DECISIONS\`（bolded 不算），或 \`**UNRESOLVED DECISIONS:**\` header + 每个 open item 一个 bullet（最后一个 bullet 必须是 final line；仅当 N > 0 时添加 \`+ N unresolved from prior reviews\`）。这避免 double-counting：从 context 列出 THIS review 的 open items；prior reviews 则在 dashboard 7-day window 内，先 DROP current skill's row，再按每个 skill 的 latest fresh row 汇总 \`unresolved\`。只有两者都为 zero 时，才输出 sentinel。

### Write to the plan file（写入 plan file）

**PLAN MODE EXCEPTION — ALWAYS RUN:** 这会写入 plan file，而 plan file 是 plan mode 中你唯一允许编辑的文件。
Plan file review report 是 plan living status 的一部分。

Report 必须始终是 plan file 的 LAST section，永远不要放在 mid-file。
使用单一 delete-then-append flow：

1. Read plan file（Read tool），查看完整 current content。在 read output 中搜索文件任意位置是否存在
   \`## GSTACK REVIEW REPORT\` heading。
2. 如果找到，使用 Edit tool DELETE 整个 existing section。从
   \`## GSTACK REVIEW REPORT\` match 到下一个 \`## \` heading 或文件末尾，以先出现者为准。
   替换为空字符串。无论该 section 当前位于哪里都这样处理：mid-file deletion 是 intentional，
   不是 special case。如果 Edit 失败（例如 concurrent edit 改变了 content），重新读取 plan file 并重试一次。
3. Delete 后（或没有 existing section 而跳过 delete 后），在文件 END 追加新的
   \`## GSTACK REVIEW REPORT\` section。使用 Edit tool 匹配文件当前最后一个 paragraph 并在其后添加 section，
   或使用 Write 重新输出整个文件，并让 section 位于末尾。
4. 继续前用 Read tool 验证 \`## GSTACK REVIEW REPORT\` 是文件中的最后一个
   \`## \` heading。如果不是，重复 steps 2-3 一次。

不要 in-place replace 该 section。"replace mid-file" path 曾让旧版本在已有 older report 时把 report 留在 mid-file：
用户会看到一个 review report 不在底部的 plan，并且会（正确地）拒绝它。

## Capture Learnings（记录 learnings）

如果你在本 session 中发现了非显而易见的 pattern、pitfall 或 architectural insight，请记录下来供未来 sessions 使用：

```bash
~/.claude/skills/gstack/bin/gstack-learnings-log '{"skill":"plan-eng-review","type":"TYPE","key":"SHORT_KEY","insight":"DESCRIPTION","confidence":N,"source":"SOURCE","files":["path/to/relevant/file"]}'
```

**Types：** `pattern`（reusable approach）、`pitfall`（what NOT to do）、`preference`
（user stated）、`architecture`（structural decision）、`tool`（library/framework insight）、
`operational`（project environment/CLI/workflow knowledge）。

**Sources：** `observed`（你在代码中发现）、`user-stated`（用户告诉你）、
`inferred`（AI deduction）、`cross-model`（Claude 和 Codex 都同意）。

**Confidence：** 1-10。诚实打分。你在代码中验证过的 observed pattern 是 8-9。
不太确定的 inference 是 4-5。用户明确陈述的 preference 是 10。

**files：** 包含此 learning 引用的具体 file paths。这会启用 staleness detection：如果这些 files 后续被删除，该 learning 可被标记。

**只记录真正的发现。**不要记录 obvious things。不要记录用户已经知道的事情。一个好测试：这个 insight 会在未来 session 中节省时间吗？如果会，就记录。



## Brain Calibration Write-Back (Phase 2 / gated)

当 skill 做出值得追踪的 typed prediction（scope decision、TTHW target、
architectural bet、wedge commitment）时，它 MAY 向 brain 写入一个
`kind=bet` take，让 calibration profile 随时间建立。

**由两件事 gate：**
1. active endpoint 的 Brain trust policy 是 `personal`（通过
   `~/.claude/skills/gstack/bin/gstack-config get brain_trust_policy@<endpoint-hash>`).
   Shared brains 会跳过 write-back，以避免污染 team calibration。
2. Feature flag `BRAIN_CALIBRATION_WRITEBACK` 已设置（当前：false；当
   upstream gbrain v0.42+ ship `takes_add` MCP op 后翻为 true）。

当两个 gates 都通过时，write-back path 使用 `mcp__gbrain__takes_add`
记录一个 weight 0.7 的 take（按 SKILL_CALIBRATION_WEIGHTS）。
如果 MCP op 不可用，fallback 到 `mcp__gbrain__put_page`，并带
gstack:takes fence block（有文档，但路径更丑）。

Mandatory take frontmatter shape（必须使用的 take frontmatter 形状）：
```yaml
kind: bet
holder: <user identity from whoami>
claim: <one-line prediction the skill is making>
weight: 0.7
since_date: <today's date>
expected_resolution: <date in 1-3 months depending on skill>
source_skill: plan-eng-review
```

写入后，invalidate 受影响的 digests，让下一次 preflight 反映新的 state：

```bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" 2>/dev/null || true
  # (no per-skill invalidation targets configured)
```


## Brain Cache Background Refresh

skill 工作完成后（且 telemetry 已记录），为任何接近 TTL 的 cache digest
kick 一次 background refresh。这是 non-blocking；用户无需等待。下一次
invocation 会受益于 warm cache。

```bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" 2>/dev/null || true
(~/.claude/skills/gstack/bin/gstack-brain-cache refresh --project "$SLUG" 2>/dev/null &) || true
```


## Next Steps — Review Chaining（下一步 review 链接）

展示 Review Readiness Dashboard 后，检查额外 reviews 是否有价值。读取 dashboard output，判断哪些 reviews 已经运行，以及是否 stale。

**如果存在 UI changes 且尚未运行 design review，建议 /plan-design-review**：从 test diagram、architecture review 或任何触碰 frontend components、CSS、views、user-facing interaction flows 的 section 中检测。如果现有 design review 的 commit hash 早于此 eng review 中发现的 significant changes，说明它可能 stale。

**如果这是 significant product change 且没有 CEO review，mention /plan-ceo-review**：这是 soft suggestion，不是 push。CEO review 是 optional。只有当 plan 引入 new user-facing features、改变 product direction 或 substantially expands scope 时才 mention。

如果此 eng review 发现的 assumptions 与既有 CEO/design reviews 矛盾，或 commit hash 显示 significant drift，说明其 staleness。

**如果不需要额外 reviews**（或 dashboard config 中 `skip_eng_review` 为 `true`，意味着此 eng review optional）：说明 `All relevant reviews complete. Run /ship when ready.`

使用 AskUserQuestion，并只包含适用 options：

- **A)** 运行 /plan-design-review（仅当检测到 UI scope 且没有 design review）
- **B)** 运行 /plan-ceo-review（仅当 significant product change 且没有 CEO review）
- **C)** 准备 implement；完成后运行 /ship

## Unresolved decisions（未解决决策）

如果用户不回应 AskUserQuestion 或中断并要求 move on，记录哪些 decisions 未解决。在 review 末尾列为“之后可能反咬你的未解决决策”，绝不 silently default to an option。
