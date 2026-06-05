<!-- AUTO-GENERATED from test-coverage.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
## Step 7：Test Coverage Audit（测试覆盖审计）

**使用 Agent tool 以 `subagent_type: "general-purpose"` 将此 step dispatch 为 subagent。**
Subagent 在 fresh context window 中运行 coverage audit；parent 只看到 conclusion，
不看 intermediate file reads。这是 context-rot defense。

**Subagent prompt：**将以下 instructions 传给 subagent，并用 base branch 替换 `<base>`：

> 你正在运行 ship-workflow test coverage audit。按需运行 `git diff <base>...HEAD`。不要 commit 或 push，只 report。
>
> 100% coverage is the goal — 每条未测试 path 都是 bug 藏身处，也会让 vibe coding 变成 yolo coding。评估 ACTUALLY coded 的内容（来自 diff），不是 planned 的内容。

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

3. **如果未检测到 framework：** 进入 Test Framework Bootstrap step（Step 4），由它处理 full setup。

**0. Before/after test count：**

```bash
# 生成前统计 test files
find . -name '*.test.*' -o -name '*.spec.*' -o -name '*_test.*' -o -name '*_spec.*' | grep -v node_modules | wc -l
```

保存这个 number，供 PR body 使用。

**1. Trace every codepath changed（追踪每条 changed codepath）**，使用 `git diff origin/<base>...HEAD`：

读取每个 changed file。对每个文件，追踪 data 如何流过 code — 不要只列 functions，要真正 follow execution：

1. **Read the diff。** 对每个 changed file，读取 full file（不只是 diff hunk）来理解 context。
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

**2. Map user flows、interactions 和 error states：**

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

**3. 将每个 branch 对照 existing tests 检查：**

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

**IRON RULE：** 当 coverage audit 识别出 REGRESSION — 以前能 work、但 diff 破坏了的 code — regression test 必须立即写出。No AskUserQuestion。No skipping。Regressions 是最高优先级 test，因为它证明某个东西已经 broken。

Regression 指：
- diff 修改 existing behavior（不是 new code）
- existing test suite（如果有）没有覆盖 changed path
- change 为 existing callers 引入了 new failure mode

不确定某个 change 是否是 regression 时，倾向于写 test。

Format: commit as `test: regression test for {what broke}`

**4. Output ASCII coverage diagram（输出 ASCII coverage diagram）：**

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

**Fast path:** All paths covered → "Step 7: All new code paths have test coverage ✓" Continue。

**5. 为 uncovered paths 生成 tests：**

如果检测到 test framework（或在 Step 4 bootstrapped）：
- 优先处理 error handlers 和 edge cases（happy paths 更可能已经 tested）
- 读取 2-3 个 existing test files，精确匹配 conventions
- 生成 unit tests。Mock all external dependencies（DB、API、Redis）。
- 对标记 [→E2E] 的 paths：使用 project 的 E2E framework（Playwright、Cypress、Capybara 等）生成 integration/E2E tests
- 对标记 [→EVAL] 的 paths：使用 project 的 eval framework 生成 eval tests；如果没有，则 flag for manual eval
- 写出 tests，用 real assertions exercise specific uncovered path
- 运行每个 test。Passes → commit as `test: coverage for {feature}`
- Fails → fix once。Still fails → revert，并在 diagram 中 note gap。

Caps：最多 30 code paths，最多生成 20 tests（code + user flow 合并计算），每个 test 的 exploration cap 为 2 分钟。

如果没有 test framework 且用户 declined bootstrap → 只产出 diagram，不生成。Note："Test generation skipped — no test framework configured."

**Diff is test-only changes:** 完全跳过 Step 7："No new application code paths to audit."

**6. After-count and coverage summary：**

```bash
# 生成后统计 test files
find . -name '*.test.*' -o -name '*.spec.*' -o -name '*_test.*' -o -name '*_spec.*' | grep -v node_modules | wc -l
```

用于 PR body：`Tests: {before} → {after} (+{delta} new)`
Coverage line：`Test Coverage Audit: N new code paths. M covered (X%). K tests generated, J committed.`

**7. Coverage gate：**

继续前，检查 CLAUDE.md 中是否有带 `Minimum:` 和 `Target:` fields 的 `## Test Coverage` section。如果找到，使用这些 percentages。否则使用 defaults：Minimum = 60%，Target = 80%。

使用 substep 4 diagram 中的 coverage percentage（`COVERAGE: X/Y (Z%)` line）：

- **>= target:** Pass。"Coverage gate: PASS ({X}%)." Continue。
- **>= minimum, < target:** 使用 AskUserQuestion：
  - "AI-assessed coverage is {X}%. {N} code paths are untested. Target is {target}%."
  - RECOMMENDATION: Choose A，因为 untested code paths 是 production bugs 最容易藏身的地方。
  - Options：
    A) 为 remaining gaps 生成更多 tests（recommended）
    B) 仍然 ship — 我接受 coverage risk
    C) 这些 paths 不需要 tests — 标记为 intentionally uncovered
  - 如果 A：loop back to substep 5（generate tests），target remaining gaps。第二轮后如果仍低于 target，用 updated numbers 再次 present AskUserQuestion。总计最多 2 generation passes。
  - 如果 B：Continue。在 PR body 中包含："Coverage gate: {X}% — user accepted risk."
  - 如果 C：Continue。在 PR body 中包含："Coverage gate: {X}% — {N} paths intentionally uncovered."

- **< minimum:** 使用 AskUserQuestion：
  - "AI-assessed coverage is critically low ({X}%). {N} of {M} code paths have no tests. Minimum threshold is {minimum}%."
  - RECOMMENDATION: Choose A，因为低于 {minimum}% 意味着 untested code 比 tested code 更多。
  - Options：
    A) 为 remaining gaps 生成 tests（recommended）
    B) Override — 以 low coverage ship（我理解风险）
  - 如果 A：Loop back to substep 5。最多 2 passes。如果 2 passes 后仍低于 minimum，再次 present override choice。
  - 如果 B：Continue。在 PR body 中包含："Coverage gate: OVERRIDDEN at {X}%."

**Coverage percentage undetermined：** 如果 coverage diagram 没有产出清晰 numeric percentage（ambiguous output、parse error），用这句 **skip the gate**："Coverage gate: could not determine percentage — skipping." 不要 default to 0%，也不要 block。

**Test-only diffs：** Skip the gate（与 existing fast-path 相同）。

**100% coverage：** "Coverage gate: PASS (100%)." Continue。

### Test Plan Artifact（测试计划产物）

生成 coverage diagram 后，写入 test plan artifact，让 `/qa` 和 `/qa-only` 能消费它：

```bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" && mkdir -p ~/.gstack/projects/$SLUG
USER=$(whoami)
DATETIME=$(date +%Y%m%d-%H%M%S)
```

写入 `~/.gstack/projects/{slug}/{user}-{branch}-ship-test-plan-{datetime}.md`：

```markdown
# Test Plan（测试计划）
Generated by /ship on {date}
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
>
> 分析完成后，在 response 的 LAST LINE 输出单个 JSON object（之后不要再输出其他 text）：
> `{"coverage_pct":N,"gaps":N,"diagram":"<full markdown coverage diagram for PR body>","tests_added":["path",...]}`

**Parent processing（父流程处理）：**

1. 读取 subagent final output。将 LAST line parse 为 JSON。
2. 存储 `coverage_pct`（用于 Step 20 metrics）、`gaps`（user summary）、`tests_added`（用于 commit）。
3. 将 `diagram` 原样嵌入 PR body 的 `## Test Coverage` section（Step 19）。
4. 打印一行 summary：`Coverage: {coverage_pct}%, {gaps} gaps. {tests_added.length} tests added.`

**如果 subagent fails、times out 或返回 invalid JSON：**fallback 到在 parent 中 inline 运行 audit。
不要因为 subagent failure 阻塞 /ship：partial results better than none。

---
