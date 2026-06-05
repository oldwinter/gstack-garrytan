<!-- AUTO-GENERATED from tests.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
## Step 4：Test Framework Bootstrap（测试框架引导）

## Test Framework Bootstrap（测试框架引导）

**检测现有 test framework 和 project runtime：**

```bash
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
```

**如果检测到 test framework**（找到 config files 或 test directories）：
打印 "Test framework detected: {name} ({N} existing tests). Skipping bootstrap."（保留 exact status text）
读取 2-3 个现有 test files，学习 conventions（naming、imports、assertion style、setup patterns）。
将 conventions 作为 prose context 保存，供 Phase 8e.5 或 Step 7 使用。**跳过 bootstrap 剩余部分。**

**如果出现 BOOTSTRAP_DECLINED**：打印 "Test bootstrap previously declined — skipping."（保留 exact status text）**跳过 bootstrap 剩余部分。**

**如果没有检测到 runtime**（没找到 config files）：使用 AskUserQuestion：
"我无法检测这个 project 的语言。你使用什么 runtime？"
Options：A) Node.js/TypeScript B) Ruby/Rails C) Python D) Go E) Rust F) PHP G) Elixir H) This project doesn't need tests.
如果用户选择 H → 写入 `.gstack/no-test-bootstrap`，并在没有 tests 的情况下继续。

**如果检测到 runtime 但没有 test framework — bootstrap：**

### B2. Research best practices（研究最佳实践）

使用 WebSearch 查找 detected runtime 的当前 best practices：
- `"[runtime] best test framework 2025 2026"`
- `"[framework A] vs [framework B] comparison"`

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

如果用户选择 C → 写入 `.gstack/no-test-bootstrap`。告诉用户："If you change your mind later, delete `.gstack/no-test-bootstrap` and re-run."（保留 exact status text）然后在没有 tests 的情况下继续。

如果检测到多个 runtimes（monorepo）→ 询问先设置哪个 runtime，并提供 sequentially 设置两者的选项。

### B4. Install and configure（安装并配置）

1. 安装 chosen packages（npm/bun/gem/pip/etc.）
2. 创建 minimal config file
3. 创建 directory structure（test/、spec/ 等）
4. 创建一个匹配 project code 的 example test，用于验证 setup works

如果 package installation 失败 → debug 一次。如果仍失败 → 用 `git checkout -- package.json package-lock.json`（或该 runtime 的等价方式）revert。Warn user，并在没有 tests 的情况下继续。

### B4.5. First real tests（第一批真实测试）

为 existing code 生成 3-5 个 real tests：

1. **Find recently changed files：** `git log --since=30.days --name-only --format="" | sort | uniq -c | sort -rn | head -10`
2. **Prioritize by risk：** Error handlers > 带 conditionals 的 business logic > API endpoints > pure functions
3. **For each file（逐文件）：** 写一个测试 real behavior 的 test，使用 meaningful assertions。Never `expect(x).toBeDefined()` — test what the code DOES.
4. 运行每个 test。Passes → keep。Fails → fix once。Still fails → delete silently。
5. 至少生成 1 个 test，最多 5 个。

Never 在 test files 中 import secrets、API keys 或 credentials。使用 environment variables 或 test fixtures。

### B5. Verify（验证）

```bash
# 运行 full test suite，确认 everything works
{detected test command}
```

如果 tests fail → debug 一次。如果仍失败 → revert all bootstrap changes 并 warn user。

### B5.5. CI/CD pipeline

```bash
# 检查 CI provider
ls -d .github/ 2>/dev/null && echo "CI:github"
ls .gitlab-ci.yml .circleci/ bitrise.yml 2>/dev/null
```

如果 `.github/` 存在（或没有检测到 CI — 默认 GitHub Actions）：
创建 `.github/workflows/test.yml`，包含：
- `runs-on: ubuntu-latest`
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

First check：如果 CLAUDE.md 已经有 `## Testing` section → skip。不要 duplicate。

Append 一个 `## Testing` section：
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

```bash
git status --porcelain
```

只有存在 changes 时才 commit。Stage all bootstrap files（config、test directory、TESTING.md、CLAUDE.md、如果创建了 .github/workflows/test.yml 也包含）：
`git commit -m "chore: bootstrap test framework ({framework name})"`

---

---

## Step 5：运行 tests（on merged code）

**不要运行 `RAILS_ENV=test bin/rails db:migrate`**：`bin/test-lane` 内部已经调用
`db:test:prepare`，会将 schema 加载到正确的 lane database。没有 INSTANCE 的裸 test migrations
会打到 orphan DB，并 corrupt structure.sql。

并行运行两个 test suites：

```bash
bin/test-lane 2>&1 | tee /tmp/ship_tests.txt &
npm run test 2>&1 | tee /tmp/ship_vitest.txt &
wait
```

两者都完成后，读取 output files 并检查 pass/fail。

**如果任何 test fails：**不要立即停止。应用 Test Failure Ownership Triage：

## Test Failure Ownership Triage（测试失败归属分流）

Tests fail 时，不要立即停止。先判断 failure ownership：

### Step T1: Classify each failure（分类每个 failure）

对每个 failing test：

1. **获取此 branch 上改过的 files：**
   ```bash
   git diff origin/<base>...HEAD --name-only
   ```

2. **Classify the failure（分类 failure）：**
   - **In-branch**：failing test file 本身在此 branch 修改过，或 test output 引用了此 branch 修改过的 code，或你能把 failure 追溯到 branch diff 中的改动。
   - **Likely pre-existing**：test file 和它测试的 code 都没有在此 branch 修改，且 failure 与你能识别的任何 branch change 无关。
   - **When ambiguous, default to in-branch.** 阻止 developer 比放行 broken test 更安全。只有在有把握时才 classify 为 pre-existing。

   这是 heuristic classification：阅读 diff 和 test output 后用 judgment 判断。你没有 programmatic dependency graph。

### Step T2: Handle in-branch failures（处理 branch 内 failures）

**STOP.** 这些是当前 branch 的 failures。展示它们，不要继续。Developer 必须先修复自己的 broken tests 才能 ship。

### Step T3: Handle pre-existing failures（处理既有 failures）

检查 preamble output 中的 `REPO_MODE`。

**If REPO_MODE is `solo`:**

Use AskUserQuestion:

> These test failures appear pre-existing (not caused by your branch changes):
>
> [list each failure with file:line and brief error description]
>
> Since this is a solo repo, you're the only one who will fix these.
>
> RECOMMENDATION：选择 A — context 还新鲜时立刻修复。Completeness: 9/10.
> A) Investigate and fix now (human: ~2-4h / CC: ~15min) — Completeness: 10/10
> B) Add as P0 TODO — fix after this branch lands — Completeness: 7/10
> C) Skip — I know about this, ship anyway — Completeness: 3/10

**If REPO_MODE is `collaborative` or `unknown`:**

Use AskUserQuestion:

> These test failures appear pre-existing (not caused by your branch changes):
>
> [list each failure with file:line and brief error description]
>
> This is a collaborative repo — these may be someone else's responsibility.
>
> RECOMMENDATION：选择 B — 分配给真正破坏它的人，这样正确的人来修。Completeness: 9/10.
> A) Investigate and fix now anyway — Completeness: 10/10
> B) Blame + assign GitHub issue to the author — Completeness: 9/10
> C) Add as P0 TODO — Completeness: 7/10
> D) Skip — ship anyway — Completeness: 3/10

### Step T4: Execute the chosen action（执行所选动作）

**If "Investigate and fix now":**
- 切换到 /investigate mindset：先 root cause，再 minimal fix。
- 修复 pre-existing failure。
- 与此 branch changes 分开提交该 fix：`git commit -m "fix: pre-existing test failure in <test-file>"`
- 继续 workflow。

**If "Add as P0 TODO":**
- 如果 `TODOS.md` 存在，按 `review/TODOS-format.md`（或 `.claude/skills/review/TODOS-format.md`）格式添加 entry。
- 如果 `TODOS.md` 不存在，创建带 standard header 的文件并添加 entry。
- Entry 应包含：title、error output、在哪个 branch 上发现、priority P0。
- 继续 workflow，把 pre-existing failure 视为 non-blocking。

**If "Blame + assign GitHub issue" (collaborative only):**
- 找出可能是谁 broke it。必须同时检查 test file 和它测试的 production code：
  ```bash
  # Who last touched the failing test?
  git log --format="%an (%ae)" -1 -- <failing-test-file>
  # Who last touched the production code the test covers? (often the actual breaker)
  git log --format="%an (%ae)" -1 -- <source-file-under-test>
  ```
  如果两者是不同的人，优先 production code author：他们更可能引入 regression。
- 创建 assigned 给该人的 issue（使用 Step 0 检测到的平台）：
  - **If GitHub:**
    ```bash
    gh issue create \
      --title "Pre-existing test failure: <test-name>" \
      --body "Found failing on branch <current-branch>. Failure is pre-existing.\n\n**Error:**\n```\n<first 10 lines>\n```\n\n**Last modified by:** <author>\n**Noticed by:** gstack /ship on <date>" \
      --assignee "<github-username>"
    ```
  - **If GitLab:**
    ```bash
    glab issue create \
      -t "Pre-existing test failure: <test-name>" \
      -d "Found failing on branch <current-branch>. Failure is pre-existing.\n\n**Error:**\n```\n<first 10 lines>\n```\n\n**Last modified by:** <author>\n**Noticed by:** gstack /ship on <date>" \
      -a "<gitlab-username>"
    ```
- 如果两个 CLI 都不可用，或 `--assignee`/`-a` 失败（user 不在 org 等），就创建无 assignee 的 issue，并在 body 中说明谁应该查看。
- 继续 workflow。

**If "Skip":**
- 继续 workflow。
- 在 output 中注明：`Pre-existing test failure skipped: <test-name>`

**Triage 后：**如果仍有任何 branch 内 failures 未修复，**STOP**。不要继续。如果所有 failures
都是 pre-existing 且已处理（fixed、TODOed、assigned 或 skipped），继续 Step 6。

**如果全部 pass：**静默继续，只简短记录 counts。

---

## Step 6：Eval Suites（条件执行）

当 prompt-related files 改变时，evals 是 mandatory。如果 diff 中没有 prompt files，则完全跳过此 step。

**1. 检查 diff 是否触碰 prompt-related files：**

```bash
git diff origin/<base> --name-only
```

匹配这些 patterns（来自 CLAUDE.md）：
- `app/services/*_prompt_builder.rb`
- `app/services/*_generation_service.rb`, `*_writer_service.rb`, `*_designer_service.rb`
- `app/services/*_evaluator.rb`, `*_scorer.rb`, `*_classifier_service.rb`, `*_analyzer.rb`
- `app/services/concerns/*voice*.rb`, `*writing*.rb`, `*prompt*.rb`, `*token*.rb`
- `app/services/chat_tools/*.rb`, `app/services/x_thread_tools/*.rb`
- `config/system_prompts/*.txt`
- `test/evals/**/*` (eval infrastructure changes affect all suites)

**如果没有 matches：**打印 `No prompt-related files changed — skipping evals.`，并继续 Step 9。

**2. 识别 affected eval suites：**

每个 eval runner（`test/evals/*_eval_runner.rb`）都会声明 `PROMPT_SOURCE_FILES`，列出影响它的 source files。
Grep 这些文件，找出哪些 suites 匹配 changed files：

```bash
grep -l "changed_file_basename" test/evals/*_eval_runner.rb
```

Map runner -> test file：`post_generation_eval_runner.rb` -> `post_generation_eval_test.rb`。

**Special cases：**
- 对 `test/evals/judges/*.rb`、`test/evals/support/*.rb` 或 `test/evals/fixtures/` 的改动，会影响所有使用这些 judges/support files 的 suites。检查 eval test files 中的 imports 来确定范围。
- 对 `config/system_prompts/*.txt` 的改动：grep eval runners 中的 prompt filename，找出 affected suites。
- 如果不确定哪些 suites 受影响，运行所有可能被影响的 suites。Over-testing 好过漏掉 regression。

**3. 以 `EVAL_JUDGE_TIER=full` 运行 affected suites：**

`/ship` 是 pre-merge gate，因此始终使用 full tier（Sonnet structural + Opus persona judges）。

```bash
EVAL_JUDGE_TIER=full EVAL_VERBOSE=1 bin/test-lane --eval test/evals/<suite>_eval_test.rb 2>&1 | tee /tmp/ship_evals.txt
```

如果需要运行多个 suites，顺序运行（每个都需要 test lane）。如果第一个 suite fails，立即停止：
不要在 remaining suites 上继续 burn API cost。

**4. 检查 results：**

- **如果任何 eval fails：**展示 failures 和 cost dashboard，并 **STOP**。不要继续。
- **如果全部 pass：**记录 pass counts 和 cost。继续 Step 9。

**5. 保存 eval output**：在 PR body（Step 19）中包含 eval results 和 cost dashboard。

**Tier reference（仅作 context：/ship 始终使用 `full`）：**
| Tier | When | Speed (cached) | Cost |
|------|------|----------------|------|
| `fast` (Haiku) | Dev iteration, smoke tests | ~5s (14x faster) | ~$0.07/run |
| `standard` (Sonnet) | Default dev, `bin/test-lane --eval` | ~17s (4x faster) | ~$0.37/run |
| `full` (Opus persona) | **`/ship` and pre-merge** | ~72s (baseline) | ~$1.27/run |

---
