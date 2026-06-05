<!-- AUTO-GENERATED from plan-completion.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
## Step 8：Plan Completion Audit（计划完成度审计）

**使用 Agent tool 以 `subagent_type: "general-purpose"` 将此 step dispatch 为 subagent。**
Subagent 在自己的 fresh context 中读取 plan file 和每个 referenced code file。Parent 只获得 conclusion。

**Subagent prompt：**将这些 instructions 传给 subagent：

> 你正在运行 ship-workflow plan completion audit。Base branch 是 `<base>`。使用 `git diff <base>...HEAD` 查看已 ship 内容。不要 commit 或 push，只 report。
>
> ### Plan File Discovery（Plan file 发现）

1. **Conversation context (primary)（conversation context，primary）：** 检查当前 conversation 中是否有 active plan file。Host agent 的 system messages 在 plan mode 时会包含 plan file paths。找到后直接使用 — 这是最可靠的 signal。

2. **Content-based search (fallback)（content-based search，fallback）：** 如果 conversation context 中没有引用 plan file，则按 content search：

```bash
setopt +o nomatch 2>/dev/null || true  # zsh compat
BRANCH=$(git branch --show-current 2>/dev/null | tr '/' '-')
REPO=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)")
# 为 ~/.gstack/projects/ lookup 计算 project slug
_PLAN_SLUG=$(git remote get-url origin 2>/dev/null | sed 's|.*[:/]\([^/]*/[^/]*\)\.git$|\1|;s|.*[:/]\([^/]*/[^/]*\)$|\1|' | tr '/' '-' | tr -cd 'a-zA-Z0-9._-') || true
_PLAN_SLUG="${_PLAN_SLUG:-$(basename "$PWD" | tr -cd 'a-zA-Z0-9._-')}"
# 搜索 common plan file locations（project designs 优先，然后 personal/local）
for PLAN_DIR in "$HOME/.gstack/projects/$_PLAN_SLUG" "$HOME/.claude/plans" "$HOME/.codex/plans" ".gstack/plans"; do
  [ -d "$PLAN_DIR" ] || continue
  PLAN=$(ls -t "$PLAN_DIR"/*.md 2>/dev/null | xargs grep -l "$BRANCH" 2>/dev/null | head -1)
  [ -z "$PLAN" ] && PLAN=$(ls -t "$PLAN_DIR"/*.md 2>/dev/null | xargs grep -l "$REPO" 2>/dev/null | head -1)
  [ -z "$PLAN" ] && PLAN=$(find "$PLAN_DIR" -name '*.md' -mmin -1440 -maxdepth 1 2>/dev/null | xargs ls -t 2>/dev/null | head -1)
  [ -n "$PLAN" ] && break
done
[ -n "$PLAN" ] && echo "PLAN_FILE: $PLAN" || echo "NO_PLAN_FILE"
```

3. **Validation（验证）：** 如果 plan file 是通过 content-based search 找到的（不是 conversation context），读取前 20 行并确认它与当前 branch 的 work 相关。如果看起来属于 different project 或 feature，视为 "no plan file found"。

**Error handling（错误处理）：**
- No plan file found → skip with "No plan file detected — skipping."（保留 exact output）
- Plan file found but unreadable（permissions、encoding）→ skip with "Plan file found but unreadable — skipping."

### Actionable Item Extraction（可执行事项提取）

读取 plan file。提取每个 actionable item — 任何描述待完成工作的内容。查找：

- **Checkbox items:** `- [ ] ...` or `- [x] ...`
- **Numbered steps** under implementation headings: "1. Create ...", "2. Add ...", "3. Modify ..."
- **Imperative statements:** "Add X to Y", "Create a Z service", "Modify the W controller"
- **File-level specifications:** "New file: path/to/file.ts", "Modify path/to/existing.rb"
- **Test requirements:** "Test that X", "Add test for Y", "Verify Z"
- **Data model changes:** "Add column X to table Y", "Create migration for Z"

**Ignore（忽略）：**
- Context/Background sections (`## Context`, `## Background`, `## Problem`)
- Questions and open items (marked with ?, "TBD", "TODO: decide")
- Review report sections (`## GSTACK REVIEW REPORT`)
- Explicitly deferred items ("Future:", "Out of scope:", "NOT in scope:", "P2:", "P3:", "P4:")
- CEO Review Decisions sections (these record choices, not work items)

**Cap（上限）：** 提取 at most 50 items。如果 plan 更多，note: "Showing top 50 of N plan items — full list in plan file."

**No items found（未找到 items）：** 如果 plan 没有可提取 actionable items，skip with: "Plan file contains no actionable items — skipping completion audit."

对每个 item，记录：
- Item text（verbatim 或 concise summary）
- Category：CODE | TEST | MIGRATION | CONFIG | DOCS

### Verification Mode（验证模式）

判断 completion 前，先分类每个 item 如何被 verified。Diff alone 无法证明所有类型的 work。当前 repo 或 system 之外的 items 对 `git diff` 来说 structurally invisible。

- **DIFF-VERIFIABLE** — 此 repo 中的 code change 会体现在 `git diff <base>...HEAD` 中。Examples: "add UserService" (file appears), "validate input X" (validation logic appears), "create users table" (migration file appears).
- **CROSS-REPO** — Item 指向 sibling repo 中的 file 或 change（例如 `domain-hq/docs/dashboard.md`、`~/Development/<other-repo>/...`）。Current diff CANNOT prove this.
- **EXTERNAL-STATE** — Item 指向 external system 中的 state：Supabase config/RLS、Cloudflare DNS、Vercel env vars、OAuth provider allowlists、third-party SaaS、DNS records。Current diff CANNOT prove this.
- **CONTENT-SHAPE** — Item 要求 file 遵循 specific convention。如果 file 在此 repo：diff-verifiable。如果在另一个 repo 或 system：see CROSS-REPO / EXTERNAL-STATE。

**Verification dispatch（验证分发）：**

- **DIFF-VERIFIABLE** → 与 diff cross-reference（下一 section）。
- **CROSS-REPO** → 如果 sibling repo 在 disk 上 reachable（尝试 `~/Development/<repo>/`、`~/code/<repo>/`、当前 repo 的 parent），运行 `[ -f <path> ]` 检查 file existence。File exists → DONE（cite path）。File missing → NOT DONE（cite path）。Path unreachable → UNVERIFIABLE（cite 需要 manual check 的内容）。
- **EXTERNAL-STATE** → UNVERIFIABLE。Cite system 和用户必须执行的 specific check。
- **CONTENT-SHAPE in another repo** → 如果 file exists，fallback 到 UNVERIFIABLE 前先运行任何 project-detected validator（见下方 "Validator detection"）。有 validator：pass → DONE；fail → NOT DONE（cite validator output）。无 validator：classify UNVERIFIABLE，并 cite 需要确认的 file path 和 convention。

**Path concreteness rule（路径具体性规则）。** 如果 plan item 指向 *concrete filesystem path*（absolute、`~/...` 或 `<sibling-repo>/<file>`），MUST 基于 `[ -f <path> ]` 分类为 DONE 或 NOT DONE。只有 path 真正 abstract（"Cloudflare DNS"、"Supabase allowlist"）或 sibling root 在这台机器上 unreachable 时，UNVERIFIABLE 才 valid。"I don't want to check" 不是 unreachable。

**Validator detection（验证器检测）。** 对 CONTENT-SHAPE item fallback 到 UNVERIFIABLE 前，扫描 target repo 的 `package.json`，寻找匹配 `validate-*`、`lint-wiki`、`check-docs` 或类似名称的 script。如果找到，带相关 path argument 调用（例如 `npm run validate-wiki -- <path>`）。对 multi-target validators（例如 `validate-wiki --all`），运行一次并从 output 对每个 item reconcile。Passing validator 将 item 从 UNVERIFIABLE 提升为 DONE；failing validator 降为 NOT DONE。

**Honesty rule（诚实规则）。** 不要因为 related code shipped 就把 item classify as DONE。能 *handle* deliverable 的 code 不是 deliverable 本身。Shipping a markdown-extraction library 不等于 shipping the markdown file。在 DONE 和 UNVERIFIABLE 之间不确定时，prefer UNVERIFIABLE — surface confirmation prompt 好过 silently miss deliverable。

### Cross-Reference Against Diff（与 diff 交叉核对）

运行 `git diff origin/<base>...HEAD` 和 `git log origin/<base>..HEAD --oneline`，理解实际 implemented 的内容。

对每个 extracted plan item，运行上一 section 的 verification dispatch，然后 classify：

- **DONE** — 有 clear evidence 表明 item 已 shipped。Cite the specific file(s) changed in the diff for DIFF-VERIFIABLE items；reachable sibling repo 中的 CROSS-REPO items cite 已验证存在的 path。
- **PARTIAL** — 此 item 有部分 work，但不完整（例如 model created but controller missing、function exists but edge cases not handled）。
- **NOT DONE** — Verification 已运行并产生 negative evidence（file missing、code absent in diff、sibling-repo file confirmed absent）。
- **CHANGED** — Item 用不同于 plan 描述的 approach 实现，但同一 goal 已达成。Note the difference。
- **UNVERIFIABLE** — Diff 和任何 reachable sibling-repo checks 都无法 prove 或 disprove。始终适用于 EXTERNAL-STATE items，以及 sibling repo 不 reachable 的 CROSS-REPO items。Cite 用户必须执行的 specific manual verification（例如 "check Cloudflare DNS shows DNS-only mode for dashboard.example.com"、"confirm /docs/dashboard.md exists in domain-hq repo"）。

**Be conservative with DONE** — require clear evidence。File touched 不够；必须存在描述的 specific functionality。
**Be generous with CHANGED** — 如果 goal 用不同方式达成，也算 addressed。
**Be honest with UNVERIFIABLE** — surface 5 个需要用户 manually confirm 的 items，好过 silently classify them DONE。

### Output Format（输出格式）

```
PLAN COMPLETION AUDIT
═══════════════════════════════
Plan: {plan file path}

## Implementation Items
  [DONE]         Create UserService — src/services/user_service.rb (+142 lines)
  [PARTIAL]      Add validation — model validates but missing controller checks
  [NOT DONE]     Add caching layer — no cache-related changes in diff
  [CHANGED]      "Redis queue" → implemented with Sidekiq instead

## Test Items
  [DONE]         Unit tests for UserService — test/services/user_service_test.rb
  [NOT DONE]    E2E test for signup flow

## Migration Items
  [DONE]         Create users table — db/migrate/20240315_create_users.rb

## Cross-Repo / External Items
  [DONE]         sibling-repo has /docs/dashboard.md — verified at ~/Development/sibling-repo/docs/dashboard.md
  [UNVERIFIABLE] Cloudflare DNS-only on api.example.com — external system, manual check required
  [UNVERIFIABLE] Supabase auth allowlist contains user email — external system, confirm in Supabase dashboard

─────────────────────────────────
COMPLETION: 5/9 DONE, 1 PARTIAL, 1 NOT DONE, 1 CHANGED, 2 UNVERIFIABLE
─────────────────────────────────
```

### Gate Logic（门禁逻辑）

生成 completion checklist 后，按 priority order 评估：

1. **Any NOT DONE items**（最高 priority：known missing work）。使用 AskUserQuestion：
   - 展示上方 completion checklist
   - "{N} items from the plan are NOT DONE. These were part of the original plan but are missing from the implementation."
   - RECOMMENDATION: 取决于 item count 和 severity。如果是 1-2 个 minor items（docs、config），recommend B。如果 core functionality missing，recommend A。
   - Options:
     A) Stop — implement the missing items before shipping
     B) Ship anyway — defer these to a follow-up (will create P1 TODOs in Step 5.5)
     C) These items were intentionally dropped — remove from scope
   - 如果 A：STOP。列出 missing items 供用户 implement。
   - 如果 B：Continue。对每个 NOT DONE item，在 Step 5.5 创建一个 P1 TODO，并写入 "Deferred from plan: {plan file path}"。
   - 如果 C：Continue。在 PR body 中 note: "Plan items intentionally dropped: {list}."

2. **Any UNVERIFIABLE items**（silent gaps：diff 无法双向证明）。仅在 NOT DONE resolved 或 absent 后触发。

   **Per-item confirmation is mandatory。** 不要用单个 AskUserQuestion blanket-confirm 所有 UNVERIFIABLE items。Blanket confirmation 是 VAS-449 暴露出的 failure mode（user clicks A without opening any file）。Instead：

   - 逐个 loop through UNVERIFIABLE items。
   - 对每个 item，使用带有该 item *specific* manual check 的 AskUserQuestion（例如 "Confirm: does `~/Development/domain-hq/docs/dashboard.md` exist?"，不是 "Have you checked all items?"）。
   - Options per item：
     Y) Confirmed done — cite what you verified (free-text, embedded in PR body)
     N) Not done — block ship; treat as NOT DONE and re-enter the priority-1 gate
     D) Intentionally dropped — note in PR body: "Plan item intentionally dropped: {item}"
   - RECOMMENDATION per item：如果 item concrete 且 easily verified，recommend Y；如果是 critical-path（auth、DNS、deliverables to other repos）且用户表现出 hesitation，recommend N。

   **Exit conditions（退出条件）：**
   - Any N：STOP。Surface missing items，建议 address 后 re-run /ship。
   - All Y or D：Continue。在 PR body 中嵌入 `## Plan Completion — Manual Verifications` section，列出每个 Y'd item 及用户 free-text evidence，以及每个 D'd item 的 "intentionally dropped"。

   **Cap（上限）。** 如果 UNVERIFIABLE items 超过 5 个，先以 numbered list 呈现，然后询问用户是否要 (1) 逐个 confirm，(2) stop and reduce scope，或 (3) 带着这是 VAS-449 failure shape 的 warning 显式接受 blanket-confirmation。Default 和 recommended option 是 (1)。

3. **Only PARTIAL items（没有 NOT DONE、没有 UNVERIFIABLE）：** Continue，并在 PR body note。Not blocking。

4. **All DONE or CHANGED:** Pass。"Plan completion: PASS — all items addressed." Continue。

**No plan file found：** 完全 skip。"No plan file detected — skipping plan completion audit."（保留 exact output）

**Include in PR body (Step 8):** 添加 `## Plan Completion` section，包含 checklist summary。
>
> 分析完成后，在 response 的 LAST LINE 输出单个 JSON object（之后不要再输出其他 text）：
> `{"total_items":N,"done":N,"changed":N,"deferred":N,"unverifiable":N,"summary":"<markdown checklist for PR body>"}`

**Parent processing（父流程处理）：**

1. 将 subagent output 的 LAST line parse 为 JSON。
2. 存储 `done`、`deferred`、`unverifiable`，用于 Step 20 metrics；在 PR body 中使用 `summary`。
3. 如果 `deferred > 0` 或 `unverifiable > 0`，且没有 user override，继续前通过适当的
   AskUserQuestion 呈现这些 items（见上方 Gate Logic priority order）。
4. 将 `summary` 嵌入 PR body 的 `## Plan Completion` section（Step 19）。如果
   `unverifiable > 0` 且用户在 UNVERIFIABLE gate 中选择 option A，也嵌入
   `## Plan Completion — Manual Verifications`，列出每个 user-confirmed item。

**如果 subagent fails 或返回 invalid JSON：**fallback 到 inline 运行 audit（parent 处理相同的
plan-extraction + classification logic）。如果 inline fallback 也失败（例如 plan file unreadable、
parser error），不要 silent pass：通过明确 AskUserQuestion 暴露 failure：
"Plan Completion audit 无法运行（{reason}）。Options: (A) 跳过 audit 并继续 ship — 在 PR body 和 Step 20 metrics 中记录 audit 已跳过；(B) 停下并修复 audit。"
默认且推荐 option 是 (B)。Silent fail-open 正是 VAS-449 暴露的 failure shape。

---

## Step 8.1：Plan Verification（计划验证）

使用 `/qa-only` skill 自动 verify plan 中的 testing/verification steps。

### 1. Check for verification section（检查 verification section）

使用 Step 8 已发现的 plan file，查找 verification section。匹配任意 headings：`## Verification`、`## Test plan`、`## Testing`、`## How to test`、`## Manual testing`，或任何包含 verification-flavored items 的 section（URLs to visit、things to check visually、interactions to test）。

**如果未找到 verification section：** Skip with "No verification steps found in plan — skipping auto-verification."
**如果 Step 8 没有找到 plan file：** Skip（already handled）。

### 2. Check for running dev server（检查运行中的 dev server）

调用 browse-based verification 前，检查 dev server 是否 reachable：

```bash
curl -s -o /dev/null -w '%{http_code}' http://localhost:3000 2>/dev/null || \
curl -s -o /dev/null -w '%{http_code}' http://localhost:8080 2>/dev/null || \
curl -s -o /dev/null -w '%{http_code}' http://localhost:5173 2>/dev/null || \
curl -s -o /dev/null -w '%{http_code}' http://localhost:4000 2>/dev/null || echo "NO_SERVER"
```

**如果 NO_SERVER：** Skip with "No dev server detected — skipping plan verification. Run /qa separately after deploying."

### 3. Invoke /qa-only inline（内联调用 /qa-only）

从 disk 读取 `/qa-only` skill：

```bash
cat ${CLAUDE_SKILL_DIR}/../qa-only/SKILL.md
```

**如果 unreadable：** Skip with "Could not load /qa-only — skipping plan verification."

按以下 modifications 遵循 /qa-only workflow：
- **Skip the preamble**（已由 /ship 处理）
- **Use the plan's verification section as the primary test input**：将每个 verification item 视为 test case
- **Use the detected dev server URL** 作为 base URL
- **Skip the fix loop**：这是 /ship 期间的 report-only verification
- **Cap at the verification items from the plan**：不要扩展成 general site QA

### 4. Gate logic（门禁逻辑）

- **All verification items PASS:** 静默 continue。"Plan verification: PASS."
- **Any FAIL:** 使用 AskUserQuestion：
  - 展示 failures 和 screenshot evidence
  - RECOMMENDATION: 如果 failures 表明 broken functionality，Choose A；如果只是 cosmetic，Choose B。
  - Options:
    A) Shipping 前修复 failures（functional issues 时 recommended）
    B) 仍然 ship — known issues（cosmetic issues 可接受）
- **No verification section / no server / unreadable skill:** Skip（non-blocking）。

### 5. Include in PR body（纳入 PR body）

向 PR body（Step 19）添加 `## Verification Results` section：
- 如果 verification ran：results summary（N PASS, M FAIL, K SKIPPED）
- 如果 skipped：skipping reason（no plan, no server, no verification section）

## Prior Learnings（历史 learnings）

搜索先前 sessions 中的相关 learnings：

```bash
_CROSS_PROJ=$(~/.claude/skills/gstack/bin/gstack-config get cross_project_learnings 2>/dev/null || echo "unset")
echo "CROSS_PROJECT: $_CROSS_PROJ"
if [ "$_CROSS_PROJ" = "true" ]; then
  ~/.claude/skills/gstack/bin/gstack-learnings-search --limit 10 --query "release ship version changelog merge pr" --cross-project 2>/dev/null || true
else
  ~/.claude/skills/gstack/bin/gstack-learnings-search --limit 10 --query "release ship version changelog merge pr" 2>/dev/null || true
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

## Step 8.2: Scope Drift Detection

Review code quality 前，先检查：**他们是否构建了被要求的内容，不多也不少？**

1. 读取 `TODOS.md`（如果存在）。读取 PR description（`gh pr view --json body --jq .body 2>/dev/null || true`）。
   读取 commit messages（`git log origin/<base>..HEAD --oneline`）。
   **如果没有 PR：**依赖 commit messages 和 TODOS.md 判断 stated intent；这是常见情况，因为 /review 在 /ship 创建 PR 前运行。
2. 识别 **stated intent**：这个 branch 原本应该完成什么？
3. 运行 `DIFF_BASE=$(git merge-base origin/<base> HEAD) && git diff "$DIFF_BASE" --stat`，并将 changed files 与 stated intent 对比。

4. 带着 skepticism 评估（如果 earlier step 或 adjacent section 有 plan completion results，也纳入判断）：

   **SCOPE CREEP detection:**
   - 与 stated intent 无关的 changed files
   - Plan 中未提到的新 features 或 refactors
   - 扩大 blast radius 的 "While I was in there..." changes

   **MISSING REQUIREMENTS detection:**
   - TODOS.md/PR description 中的 requirements 未在 diff 中 addressed
   - stated requirements 的 test coverage gaps
   - Partial implementations（开始了但未完成）

5. Output（在 main review 开始前）：
   \`\`\`
   Scope Check: [CLEAN / DRIFT DETECTED / REQUIREMENTS MISSING]
   Intent: <1-line summary of what was requested>
   Delivered: <1-line summary of what the diff actually does>
   [If drift: list each out-of-scope change]
   [If missing: list each unaddressed requirement]
   \`\`\`

6. 这是 **INFORMATIONAL**：不 block review。继续下一步。

---

---
