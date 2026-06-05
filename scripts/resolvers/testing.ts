import type { TemplateContext } from './types';

export function generateTestBootstrap(_ctx: TemplateContext): string {
  return `## Test Framework Bootstrap（测试框架引导）

**检测现有 test framework 和 project runtime：**

\`\`\`bash
setopt +o nomatch 2>/dev/null || true  # zsh compat
# 检测 project runtime
[ -f Gemfile ] && echo "RUNTIME:ruby"
[ -f package.json ] && echo "RUNTIME:node"
[ -f requirements.txt ] || [ -f pyproject.toml ] && echo "RUNTIME:python"
[ -f go.mod ] && echo "RUNTIME:go"
[ -f Cargo.toml ] && echo "RUNTIME:rust"
[ -f composer.json ] && echo "RUNTIME:php"
[ -f mix.exs ] && echo "RUNTIME:elixir"
# 检测 sub-frameworks
[ -f Gemfile ] && grep -q "rails" Gemfile 2>/dev/null && echo "FRAMEWORK:rails"
[ -f package.json ] && grep -q '"next"' package.json 2>/dev/null && echo "FRAMEWORK:nextjs"
# 检查 existing test infrastructure
ls jest.config.* vitest.config.* playwright.config.* .rspec pytest.ini pyproject.toml phpunit.xml 2>/dev/null
ls -d test/ tests/ spec/ __tests__/ cypress/ e2e/ 2>/dev/null
# 检查 opt-out marker
[ -f .gstack/no-test-bootstrap ] && echo "BOOTSTRAP_DECLINED"
\`\`\`

**如果检测到 test framework**（找到 config files 或 test directories）：
打印 "Test framework detected: {name} ({N} existing tests). Skipping bootstrap."（保留 exact status text）
读取 2-3 个现有 test files，学习 conventions（naming、imports、assertion style、setup patterns）。
将 conventions 作为 prose context 保存，供 Phase 8e.5 或 Step 7 使用。**跳过 bootstrap 剩余部分。**

**如果出现 BOOTSTRAP_DECLINED**：打印 "Test bootstrap previously declined — skipping."（保留 exact status text）**跳过 bootstrap 剩余部分。**

**如果没有检测到 runtime**（没找到 config files）：使用 AskUserQuestion：
"我无法检测这个 project 的语言。你使用什么 runtime？"
Options：A) Node.js/TypeScript B) Ruby/Rails C) Python D) Go E) Rust F) PHP G) Elixir H) This project doesn't need tests.
如果用户选择 H → 写入 \`.gstack/no-test-bootstrap\`，并在没有 tests 的情况下继续。

**如果检测到 runtime 但没有 test framework — bootstrap：**

### B2. Research best practices（研究最佳实践）

使用 WebSearch 查找 detected runtime 的当前 best practices：
- \`"[runtime] best test framework 2025 2026"\`
- \`"[framework A] vs [framework B] comparison"\`

如果 WebSearch 不可用，使用这个内置 knowledge table：

| Runtime | Primary recommendation（主要推荐） | Alternative（备选） |
|---------|----------------------|-------------|
| Ruby/Rails | minitest + fixtures + capybara | rspec + factory_bot + shoulda-matchers |
| Node.js | vitest + @testing-library | jest + @testing-library |
| Next.js | vitest + @testing-library/react + playwright | jest + cypress |
| Python | pytest + pytest-cov | unittest |
| Go | stdlib testing + testify | stdlib only |
| Rust | cargo test (built-in) + mockall | — |
| PHP | phpunit + mockery | pest |
| Elixir | ExUnit (built-in) + ex_machina | — |

### B3. Framework selection（选择框架）

使用 AskUserQuestion：
"我检测到这是一个 [Runtime/Framework] project，但没有 test framework。我研究了当前 best practices。可选项如下：
A) [Primary] — [rationale]。包含：[packages]。支持：unit、integration、smoke、e2e
B) [Alternative] — [rationale]。包含：[packages]
C) Skip — don't set up testing right now
RECOMMENDATION: Choose A because [reason based on project context]"（保留 exact recommendation marker）

如果用户选择 C → 写入 \`.gstack/no-test-bootstrap\`。告诉用户："If you change your mind later, delete \`.gstack/no-test-bootstrap\` and re-run."（保留 exact status text）然后在没有 tests 的情况下继续。

如果检测到多个 runtimes（monorepo）→ 询问先设置哪个 runtime，并提供 sequentially 设置两者的选项。

### B4. Install and configure（安装并配置）

1. 安装 chosen packages（npm/bun/gem/pip/etc.）
2. 创建 minimal config file
3. 创建 directory structure（test/、spec/ 等）
4. 创建一个匹配 project code 的 example test，用于验证 setup works

如果 package installation 失败 → debug 一次。如果仍失败 → 用 \`git checkout -- package.json package-lock.json\`（或该 runtime 的等价方式）revert。Warn user，并在没有 tests 的情况下继续。

### B4.5. First real tests（第一批真实测试）

为 existing code 生成 3-5 个 real tests：

1. **Find recently changed files：** \`git log --since=30.days --name-only --format="" | sort | uniq -c | sort -rn | head -10\`
2. **Prioritize by risk：** Error handlers > 带 conditionals 的 business logic > API endpoints > pure functions
3. **For each file（逐文件）：** 写一个测试 real behavior 的 test，使用 meaningful assertions。Never \`expect(x).toBeDefined()\` — test what the code DOES.
4. 运行每个 test。Passes → keep。Fails → fix once。Still fails → delete silently。
5. 至少生成 1 个 test，最多 5 个。

Never 在 test files 中 import secrets、API keys 或 credentials。使用 environment variables 或 test fixtures。

### B5. Verify（验证）

\`\`\`bash
# 运行 full test suite，确认 everything works
{detected test command}
\`\`\`

如果 tests fail → debug 一次。如果仍失败 → revert all bootstrap changes 并 warn user。

### B5.5. CI/CD pipeline

\`\`\`bash
# 检查 CI provider
ls -d .github/ 2>/dev/null && echo "CI:github"
ls .gitlab-ci.yml .circleci/ bitrise.yml 2>/dev/null
\`\`\`

如果 \`.github/\` 存在（或没有检测到 CI — 默认 GitHub Actions）：
创建 \`.github/workflows/test.yml\`，包含：
- \`runs-on: ubuntu-latest\`
- 适合该 runtime 的 setup action（setup-node、setup-ruby、setup-python 等）
- B5 中 verified 的同一个 test command
- Trigger：push + pull_request

如果检测到 non-GitHub CI → skip CI generation，并 note："Detected {provider} — CI pipeline generation supports GitHub Actions only. Add test step to your existing pipeline manually."（保留 exact note）

### B6. Create TESTING.md（创建测试文档）

First check：如果 TESTING.md 已存在 → 读取并 update/append，不要 overwrite。Never destroy existing content。

写入 TESTING.md，包含：
- Philosophy："100% test coverage is the key to great vibe coding. Tests let you move fast, trust your instincts, and ship with confidence — without them, vibe coding is just yolo coding. With tests, it's a superpower."（保留 exact docs copy）
- Framework name and version
- How to run tests（B5 中 verified 的 command）
- Test layers：Unit tests（what、where、when）、Integration tests、Smoke tests、E2E tests
- Conventions：file naming、assertion style、setup/teardown patterns

### B7. Update CLAUDE.md（更新 CLAUDE.md）

First check：如果 CLAUDE.md 已经有 \`## Testing\` section → skip。不要 duplicate。

Append 一个 \`## Testing\` section：
- 运行命令和测试目录
- 引用 TESTING.md
- Test expectations：
  - 目标是 100% test coverage — tests 让 vibe coding 更安全
  - 写 new functions 时，写对应 test
  - 修 bug 时，写 regression test
  - 添加 error handling 时，写一个触发该 error 的 test
  - 添加 conditional（if/else、switch）时，为 BOTH paths 写 tests
  - 不要 commit 会让现有 tests fail 的 code

### B8. Commit（提交）

\`\`\`bash
git status --porcelain
\`\`\`

只有存在 changes 时才 commit。Stage all bootstrap files（config、test directory、TESTING.md、CLAUDE.md、如果创建了 .github/workflows/test.yml 也包含）：
\`git commit -m "chore: bootstrap test framework ({framework name})"\`

---`;
}

// ─── Test Coverage Audit（测试覆盖审计） ──────────────────────
//
// 用于 codepath tracing、ASCII diagrams 和 test gap analysis 的共享方法。
// 三种 modes、三个 placeholders、一个 inner function：
//
//   {{TEST_COVERAGE_AUDIT_PLAN}}   → plan-eng-review: adds missing tests to the plan
//   {{TEST_COVERAGE_AUDIT_SHIP}}   → ship: auto-generates tests, coverage summary
//   {{TEST_COVERAGE_AUDIT_REVIEW}} → review: generates tests via Fix-First (ASK)
//
//   ┌────────────────────────────────────────────────┐
//   │  generateTestCoverageAuditInner(mode)          │
//   │                                                │
//   │  SHARED: framework detect, codepath trace,     │
//   │    ASCII diagram, quality rubric, E2E matrix,  │
//   │    regression rule                             │
//   │                                                │
//   │  plan:   edit plan file, write artifact        │
//   │  ship:   auto-generate tests, write artifact   │
//   │  review: Fix-First ASK, INFORMATIONAL gaps     │
//   └────────────────────────────────────────────────┘

type CoverageAuditMode = 'plan' | 'ship' | 'review';

function generateTestCoverageAuditInner(mode: CoverageAuditMode): string {
  const sections: string[] = [];

  // ── Intro (mode-specific) ──
  if (mode === 'ship') {
    sections.push(`100% coverage is the goal — 每条未测试 path 都是 bug 藏身处，也会让 vibe coding 变成 yolo coding。评估 ACTUALLY coded 的内容（来自 diff），不是 planned 的内容。`);
  } else if (mode === 'plan') {
    sections.push(`100% coverage is the goal。评估 plan 中的每条 codepath，确保 plan 为每条 path 都包含 tests。如果 plan 缺 tests，就补上 — plan 应该足够完整，让 implementation 从一开始就包含 full test coverage。`);
  } else {
    sections.push(`100% coverage is the goal。评估 diff 中每条 changed codepath，并识别 test gaps。Gaps 会成为 INFORMATIONAL findings，遵循 Fix-First flow。`);
  }

  // ── Test framework detection (shared) ──
  sections.push(`
### Test Framework Detection（测试框架检测）

分析 coverage 前，检测 project 的 test framework：

1. **Read CLAUDE.md** — 查找带 test command 和 framework name 的 \`## Testing\` section。如果找到，以它作为 authoritative source。
2. **如果 CLAUDE.md 没有 testing section，则 auto-detect：**

\`\`\`bash
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
\`\`\`

3. **如果未检测到 framework：**${mode === 'ship' ? ' 进入 Test Framework Bootstrap step（Step 4），由它处理 full setup。' : ' 仍然产出 coverage diagram，但跳过 test generation。'}`);

  // ── Before/after count (ship only) ──
  if (mode === 'ship') {
    sections.push(`
**0. Before/after test count：**

\`\`\`bash
# 生成前统计 test files
find . -name '*.test.*' -o -name '*.spec.*' -o -name '*_test.*' -o -name '*_spec.*' | grep -v node_modules | wc -l
\`\`\`

保存这个 number，供 PR body 使用。`);
  }

  // ── Codepath tracing methodology (shared, with mode-specific source) ──
  const traceSource = mode === 'plan'
    ? `**Step 1. Trace every codepath in the plan（追踪 plan 中的每条 codepath）：**

读取 plan document。对每个描述的新 feature、service、endpoint 或 component，追踪 data 如何流过 code — 不要只列 planned functions，要真正 follow planned execution：`
    : `**${mode === 'ship' ? '1' : 'Step 1'}. Trace every codepath changed（追踪每条 changed codepath）**，使用 \`git diff origin/<base>...HEAD\`：

读取每个 changed file。对每个文件，追踪 data 如何流过 code — 不要只列 functions，要真正 follow execution：`;

  const traceStep1 = mode === 'plan'
    ? `1. **Read the plan。** 对每个 planned component，理解它做什么，以及如何连接 existing code。`
    : `1. **Read the diff。** 对每个 changed file，读取 full file（不只是 diff hunk）来理解 context。`;

  sections.push(`
${traceSource}

${traceStep1}
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

这是 critical step — 你正在构建一张 map，覆盖每一行会因 input 不同而执行不同路径的 code。这个 diagram 中的每个 branch 都需要 test。`);

  // ── User flow coverage (shared) ──
  sections.push(`
**${mode === 'ship' ? '2' : 'Step 2'}. Map user flows、interactions 和 error states：**

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

把这些和 code branches 一起加入 diagram。没有 test 的 user flow 和 untested if/else 一样是 gap。`);

  // ── Check branches against tests + quality rubric (shared) ──
  sections.push(`
**${mode === 'ship' ? '3' : 'Step 3'}. 将每个 branch 对照 existing tests 检查：**

逐个 branch 走查 diagram — 同时包含 code paths 和 user flows。对每一个，搜索是否有 test exercise 它：
- Function \`processPayment()\` → 查找 \`billing.test.ts\`、\`billing.spec.ts\`、\`test/billing_test.rb\`
- 一个 if/else → 查找覆盖 BOTH true AND false path 的 tests
- 一个 error handler → 查找触发该 specific error condition 的 test
- 调用 \`helperFn()\` 且它自己有 branches → 那些 branches 也需要 tests
- 一个 user flow → 查找走完整 journey 的 integration 或 E2E test
- 一个 interaction edge case → 查找模拟 unexpected action 的 test

Quality scoring rubric：
- ★★★  测试 behavior，同时覆盖 edge cases AND error paths
- ★★   测试正确 behavior，但只有 happy path
- ★    Smoke test / existence check / trivial assertion（例如 "it renders"、"it doesn't throw"）`);

  // ── E2E test decision matrix (shared) ──
  sections.push(`
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
- 不面向 customer 的 obscure/rare flow`);

  // ── Regression rule (shared) ──
  sections.push(`
### REGRESSION RULE（mandatory，强制）

**IRON RULE：** 当 coverage audit 识别出 REGRESSION — 以前能 work、但 diff 破坏了的 code — regression test 必须${mode === 'plan' ? '作为 critical requirement 加入 plan' : '立即写出'}。No AskUserQuestion。No skipping。Regressions 是最高优先级 test，因为它证明某个东西已经 broken。

Regression 指：
- diff 修改 existing behavior（不是 new code）
- existing test suite（如果有）没有覆盖 changed path
- change 为 existing callers 引入了 new failure mode

不确定某个 change 是否是 regression 时，倾向于写 test。${mode !== 'plan' ? '\n\nFormat: commit as `test: regression test for {what broke}`' : ''}`);

  // ── ASCII coverage diagram (shared) ──
  sections.push(`
**${mode === 'ship' ? '4' : 'Step 4'}. Output ASCII coverage diagram（输出 ASCII coverage diagram）：**

在同一个 diagram 中同时包含 code paths 和 user flows。标记 E2E-worthy 和 eval-worthy paths：

\`\`\`
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
\`\`\`

Legend：★★★ behavior + edge + error  |  ★★ happy path  |  ★ smoke check
[→E2E] = needs integration test  |  [→EVAL] = needs LLM eval

**Fast path:** All paths covered → "${mode === 'ship' ? 'Step 7' : mode === 'review' ? 'Step 4.75' : 'Test review'}: All new code paths have test coverage ✓" Continue。`);

  // ── Mode-specific action section ──
  if (mode === 'plan') {
    sections.push(`
**Step 5. 将 missing tests 添加到 plan：**

对 diagram 中识别的每个 GAP，向 plan 添加一条 test requirement。要具体：
- 创建什么 test file（match existing naming conventions）
- test 应该 assert 什么（specific inputs → expected outputs/behavior）
- 它是 unit test、E2E test 还是 eval（使用 decision matrix）
- 对 regressions：flag as **CRITICAL** 并解释 what broke

Plan 应该足够完整，让 implementation 开始时每个 test 都能和 feature code 一起写，而不是 deferred 到 follow-up。`);

    // ── Test plan artifact (plan + ship) ──
    sections.push(`
### Test Plan Artifact（测试计划产物）

生成 coverage diagram 后，将 test plan artifact 写入 project directory，让 \`/qa\` 和 \`/qa-only\` 能把它作为 primary test input 消费：

\`\`\`bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" && mkdir -p ~/.gstack/projects/$SLUG
USER=$(whoami)
DATETIME=$(date +%Y%m%d-%H%M%S)
\`\`\`

写入 \`~/.gstack/projects/{slug}/{user}-{branch}-eng-review-test-plan-{datetime}.md\`：

\`\`\`markdown
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
\`\`\`

这个 file 会被 \`/qa\` 和 \`/qa-only\` 作为 primary test input 消费。只包含帮助 QA tester 知道 **what to test and where** 的信息 — 不要 implementation details。`);
  } else if (mode === 'ship') {
    sections.push(`
**5. 为 uncovered paths 生成 tests：**

如果检测到 test framework（或在 Step 4 bootstrapped）：
- 优先处理 error handlers 和 edge cases（happy paths 更可能已经 tested）
- 读取 2-3 个 existing test files，精确匹配 conventions
- 生成 unit tests。Mock all external dependencies（DB、API、Redis）。
- 对标记 [→E2E] 的 paths：使用 project 的 E2E framework（Playwright、Cypress、Capybara 等）生成 integration/E2E tests
- 对标记 [→EVAL] 的 paths：使用 project 的 eval framework 生成 eval tests；如果没有，则 flag for manual eval
- 写出 tests，用 real assertions exercise specific uncovered path
- 运行每个 test。Passes → commit as \`test: coverage for {feature}\`
- Fails → fix once。Still fails → revert，并在 diagram 中 note gap。

Caps：最多 30 code paths，最多生成 20 tests（code + user flow 合并计算），每个 test 的 exploration cap 为 2 分钟。

如果没有 test framework 且用户 declined bootstrap → 只产出 diagram，不生成。Note："Test generation skipped — no test framework configured."

**Diff is test-only changes:** 完全跳过 Step 7："No new application code paths to audit."

**6. After-count and coverage summary：**

\`\`\`bash
# 生成后统计 test files
find . -name '*.test.*' -o -name '*.spec.*' -o -name '*_test.*' -o -name '*_spec.*' | grep -v node_modules | wc -l
\`\`\`

用于 PR body：\`Tests: {before} → {after} (+{delta} new)\`
Coverage line：\`Test Coverage Audit: N new code paths. M covered (X%). K tests generated, J committed.\`

**7. Coverage gate：**

继续前，检查 CLAUDE.md 中是否有带 \`Minimum:\` 和 \`Target:\` fields 的 \`## Test Coverage\` section。如果找到，使用这些 percentages。否则使用 defaults：Minimum = 60%，Target = 80%。

使用 substep 4 diagram 中的 coverage percentage（\`COVERAGE: X/Y (Z%)\` line）：

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

**100% coverage：** "Coverage gate: PASS (100%)." Continue。`);

    // ── Test plan artifact (ship mode) ──
    sections.push(`
### Test Plan Artifact（测试计划产物）

生成 coverage diagram 后，写入 test plan artifact，让 \`/qa\` 和 \`/qa-only\` 能消费它：

\`\`\`bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" && mkdir -p ~/.gstack/projects/$SLUG
USER=$(whoami)
DATETIME=$(date +%Y%m%d-%H%M%S)
\`\`\`

写入 \`~/.gstack/projects/{slug}/{user}-{branch}-ship-test-plan-{datetime}.md\`：

\`\`\`markdown
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
\`\`\``);
  } else {
    // review mode
    sections.push(`
**Step 5. 为 gaps 生成 tests（Fix-First）：**

如果检测到 test framework 且识别出 gaps：
- 按 Fix-First Heuristic 将每个 gap 分类为 AUTO-FIX 或 ASK：
  - **AUTO-FIX:** pure functions 的 simple unit tests，或 existing tested functions 的 edge cases
  - **ASK:** E2E tests、需要 new test infrastructure 的 tests、ambiguous behavior 的 tests
- 对 AUTO-FIX gaps：生成 test、运行它、commit as \`test: coverage for {feature}\`
- 对 ASK gaps：与其他 review findings 一起放进 Fix-First batch question
- 对标记 [→E2E] 的 paths：always ASK（E2E tests effort 更高，需要 user confirmation）
- 对标记 [→EVAL] 的 paths：always ASK（eval tests 需要用户确认 quality criteria）

如果未检测到 test framework → 仅将 gaps 作为 INFORMATIONAL findings 包含，不生成。

**Diff is test-only changes:** 完全跳过 Step 4.75："No new application code paths to audit."

### Coverage Warning（覆盖率警告）

生成 coverage diagram 后，检查 coverage percentage。读取 CLAUDE.md 中带 \`Minimum:\` field 的 \`## Test Coverage\` section。如果找不到，使用 default：60%。

如果 coverage 低于 minimum threshold，在 regular review findings **之前** 输出醒目 warning：

\`\`\`
⚠️ COVERAGE WARNING: AI-assessed coverage is {X}%. {N} code paths untested.
Consider writing tests before running /ship.
\`\`\`

这是 INFORMATIONAL — 不会 block /review。但它会提前暴露 low coverage，让 developer 在到达 /ship coverage gate 前处理。

如果 coverage percentage 无法确定，静默跳过 warning。`);
  }

  return sections.join('\n');
}

export function generateTestCoverageAuditPlan(_ctx: TemplateContext): string {
  return generateTestCoverageAuditInner('plan');
}

export function generateTestCoverageAuditShip(_ctx: TemplateContext): string {
  return generateTestCoverageAuditInner('ship');
}

export function generateTestCoverageAuditReview(_ctx: TemplateContext): string {
  return generateTestCoverageAuditInner('review');
}
