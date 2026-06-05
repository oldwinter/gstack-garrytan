

export function generateTestFailureTriage(): string {
  return `## Test Failure Ownership Triage（测试失败归属分流）

Tests fail 时，不要立即停止。先判断 failure ownership：

### Step T1: Classify each failure（分类每个 failure）

对每个 failing test：

1. **获取此 branch 上改过的 files：**
   \`\`\`bash
   git diff origin/<base>...HEAD --name-only
   \`\`\`

2. **Classify the failure（分类 failure）：**
   - **In-branch**：failing test file 本身在此 branch 修改过，或 test output 引用了此 branch 修改过的 code，或你能把 failure 追溯到 branch diff 中的改动。
   - **Likely pre-existing**：test file 和它测试的 code 都没有在此 branch 修改，且 failure 与你能识别的任何 branch change 无关。
   - **When ambiguous, default to in-branch.** 阻止 developer 比放行 broken test 更安全。只有在有把握时才 classify 为 pre-existing。

   这是 heuristic classification：阅读 diff 和 test output 后用 judgment 判断。你没有 programmatic dependency graph。

### Step T2: Handle in-branch failures（处理 branch 内 failures）

**STOP.** 这些是当前 branch 的 failures。展示它们，不要继续。Developer 必须先修复自己的 broken tests 才能 ship。

### Step T3: Handle pre-existing failures（处理既有 failures）

检查 preamble output 中的 \`REPO_MODE\`。

**If REPO_MODE is \`solo\`:**

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

**If REPO_MODE is \`collaborative\` or \`unknown\`:**

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
- 与此 branch changes 分开提交该 fix：\`git commit -m "fix: pre-existing test failure in <test-file>"\`
- 继续 workflow。

**If "Add as P0 TODO":**
- 如果 \`TODOS.md\` 存在，按 \`review/TODOS-format.md\`（或 \`.claude/skills/review/TODOS-format.md\`）格式添加 entry。
- 如果 \`TODOS.md\` 不存在，创建带 standard header 的文件并添加 entry。
- Entry 应包含：title、error output、在哪个 branch 上发现、priority P0。
- 继续 workflow，把 pre-existing failure 视为 non-blocking。

**If "Blame + assign GitHub issue" (collaborative only):**
- 找出可能是谁 broke it。必须同时检查 test file 和它测试的 production code：
  \`\`\`bash
  # Who last touched the failing test?
  git log --format="%an (%ae)" -1 -- <failing-test-file>
  # Who last touched the production code the test covers? (often the actual breaker)
  git log --format="%an (%ae)" -1 -- <source-file-under-test>
  \`\`\`
  如果两者是不同的人，优先 production code author：他们更可能引入 regression。
- 创建 assigned 给该人的 issue（使用 Step 0 检测到的平台）：
  - **If GitHub:**
    \`\`\`bash
    gh issue create \\
      --title "Pre-existing test failure: <test-name>" \\
      --body "Found failing on branch <current-branch>. Failure is pre-existing.\\n\\n**Error:**\\n\`\`\`\\n<first 10 lines>\\n\`\`\`\\n\\n**Last modified by:** <author>\\n**Noticed by:** gstack /ship on <date>" \\
      --assignee "<github-username>"
    \`\`\`
  - **If GitLab:**
    \`\`\`bash
    glab issue create \\
      -t "Pre-existing test failure: <test-name>" \\
      -d "Found failing on branch <current-branch>. Failure is pre-existing.\\n\\n**Error:**\\n\`\`\`\\n<first 10 lines>\\n\`\`\`\\n\\n**Last modified by:** <author>\\n**Noticed by:** gstack /ship on <date>" \\
      -a "<gitlab-username>"
    \`\`\`
- 如果两个 CLI 都不可用，或 \`--assignee\`/\`-a\` 失败（user 不在 org 等），就创建无 assignee 的 issue，并在 body 中说明谁应该查看。
- 继续 workflow。

**If "Skip":**
- 继续 workflow。
- 在 output 中注明：\`Pre-existing test failure skipped: <test-name>\``;
}
