# Greptile Comment Triage（Greptile 评论分诊）

用于 fetching、filtering 和 classifying GitHub PR 上 Greptile review comments 的共享参考。`/review`（Step 2.5）和 `/ship`（Step 3.75）都会引用本文档。

---

## Fetch（获取）

运行以下 commands 检测 PR 并 fetch comments。两个 API calls 并行运行。

```bash
REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null)
PR_NUMBER=$(gh pr view --json number --jq '.number' 2>/dev/null)
```

**如果任一命令失败或为空：** 静默跳过 Greptile triage。这个 integration 是 additive；没有它 workflow 仍能工作。

```bash
# 并行 fetch line-level review comments 和 top-level PR comments
gh api repos/$REPO/pulls/$PR_NUMBER/comments \
  --jq '.[] | select(.user.login == "greptile-apps[bot]") | select(.position != null) | {id: .id, path: .path, line: .line, body: .body, html_url: .html_url, source: "line-level"}' > /tmp/greptile_line.json &
gh api repos/$REPO/issues/$PR_NUMBER/comments \
  --jq '.[] | select(.user.login == "greptile-apps[bot]") | {id: .id, body: .body, html_url: .html_url, source: "top-level"}' > /tmp/greptile_top.json &
wait
```

**如果 API 报错，或两个 endpoints 都没有 Greptile comments：** 静默跳过。

line-level comments 上的 `position != null` filter 会自动跳过 force-pushed code 产生的 outdated comments。

---

## Suppressions Check（抑制检查）

派生 project-specific history path：
```bash
REMOTE_SLUG=$(browse/bin/remote-slug 2>/dev/null || ~/.claude/skills/gstack/browse/bin/remote-slug 2>/dev/null || basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")
PROJECT_HISTORY="$HOME/.gstack/projects/$REMOTE_SLUG/greptile-history.md"
```

如果 `$PROJECT_HISTORY` 存在，读取它（per-project suppressions）。每行记录一个 previous triage outcome：

```
<date> | <repo> | <type:fp|fix|already-fixed> | <file-pattern> | <category>
```

**Categories**（固定集合）：`race-condition`、`null-check`、`error-handling`、`style`、`type-safety`、`security`、`performance`、`correctness`、`other`

将每条 fetched comment 与符合以下条件的 entries 匹配：
- `type == fp`（只 suppress known false positives，不 suppress previously fixed real issues）
- `repo` 匹配当前 repo
- `file-pattern` 匹配 comment 的 file path
- `category` 匹配 comment 中的 issue type

将匹配的 comments 作为 **SUPPRESSED** 跳过。

如果 history file 不存在，或存在无法 parse 的 lines，跳过这些 lines 并继续；绝不要因为 malformed history file 失败。

---

## Classify（分类）

对每条 non-suppressed comment：

1. **Line-level comments：** 读取指定 `path:line` 处的 file 和周边 context（±10 lines）
2. **Top-level comments：** 读取完整 comment body
3. 将 comment 与 full diff（`git diff origin/main`）和 review checklist 交叉检查
4. Classify：
   - **VALID & ACTIONABLE** — 当前 code 中真实存在的 bug、race condition、security issue 或 correctness problem
   - **VALID BUT ALREADY FIXED** — branch 后续 commit 已处理的真实 issue。识别 fixing commit SHA。
   - **FALSE POSITIVE** — comment 误解了 code、flag 了其他地方已处理的问题，或只是 stylistic noise
   - **SUPPRESSED** — 已在上方 suppressions check 中过滤

---

## Reply APIs

回复 Greptile comments 时，根据 comment source 使用正确 endpoint：

**Line-level comments**（来自 `pulls/$PR/comments`）：
```bash
gh api repos/$REPO/pulls/$PR_NUMBER/comments/$COMMENT_ID/replies \
  -f body="<reply text>"
```

**Top-level comments**（来自 `issues/$PR/comments`）：
```bash
gh api repos/$REPO/issues/$PR_NUMBER/comments \
  -f body="<reply text>"
```

**如果 reply POST 失败**（例如 PR 已关闭、没有 write permission）：warn 并继续。不要因为一次 reply 失败而停止 workflow。

---

## Reply Templates（回复模板）

每次 Greptile reply 都使用这些 templates。始终包含 concrete evidence；绝不要发布 vague replies。

### Tier 1（首次回复）— 友好，包含 evidence

**For FIXES（用户选择修复 issue）：**

```
**Fixed** in `<commit-sha>`.

\`\`\`diff
- <old problematic line(s)>
+ <new fixed line(s)>
\`\`\`

**Why:** <1-sentence explanation of what was wrong and how the fix addresses it>
```

**For ALREADY FIXED（issue 已在 branch 上的 prior commit 中处理）：**

```
**Already fixed** in `<commit-sha>`.

**What was done:** <1-2 sentences describing how the existing commit addresses this issue>
```

**For FALSE POSITIVES（comment 不正确）：**

```
**Not a bug.** <1 sentence directly stating why this is incorrect>

**Evidence:**
- <specific code reference showing the pattern is safe/correct>
- <e.g., "The nil check is handled by `ActiveRecord::FinderMethods#find` which raises RecordNotFound, not nil">

**Suggested re-rank:** This appears to be a `<style|noise|misread>` issue, not a `<what Greptile called it>`. Consider lowering severity.
```

### Tier 2（先前回复后 Greptile 再次 flag）— 坚定，给出充分 evidence

当下面的 escalation detection 识别出同一 thread 上已有 prior GStack reply 时，使用 Tier 2。包含尽可能充分的 evidence 来结束讨论。

```
**This has been reviewed and confirmed as [intentional/already-fixed/not-a-bug].**

\`\`\`diff
<full relevant diff showing the change or safe pattern>
\`\`\`

**Evidence chain:**
1. <file:line permalink showing the safe pattern or fix>
2. <commit SHA where it was addressed, if applicable>
3. <architecture rationale or design decision, if applicable>

**Suggested re-rank:** Please recalibrate — this is a `<actual category>` issue, not `<claimed category>`. [Link to specific file change permalink if helpful]
```

---

## Escalation Detection（升级检测）

撰写 reply 前，检查此 comment thread 上是否已经存在 prior GStack reply：

1. **For line-level comments：** 通过 `gh api repos/$REPO/pulls/$PR_NUMBER/comments/$COMMENT_ID/replies` 获取 replies。检查是否有 reply body 包含 GStack markers：`**Fixed**`、`**Not a bug.**`、`**Already fixed**`。

2. **For top-level comments：** 扫描 fetched issue comments，查找 Greptile comment 之后发布且包含 GStack markers 的 replies。

3. **如果 prior GStack reply 存在，且 Greptile 在同一 file+category 上再次发帖：** 使用 Tier 2（firm）templates。

4. **如果没有 prior GStack reply：** 使用 Tier 1（friendly）templates。

如果 escalation detection 失败（API error、ambiguous thread）：默认使用 Tier 1。绝不要在 ambiguity 下升级。

---

## Severity Assessment & Re-ranking（严重程度评估与重排）

classifying comments 时，也要评估 Greptile 暗示的 severity 是否符合现实：

- 如果 Greptile 把某事 flag 为 **security/correctness/race-condition** issue，但它实际只是 **style/performance** nit：在 reply 中包含 `**Suggested re-rank:**`，要求修正 category。
- 如果 Greptile 把 low-severity style issue 说得像 critical：在 reply 中 push back。
- 始终具体说明为什么 re-ranking 合理；引用 code 和 line numbers，而不是 opinions。

---

## History File Writes（写入历史文件）

写入前，确保两个 directories 都存在：
```bash
REMOTE_SLUG=$(browse/bin/remote-slug 2>/dev/null || ~/.claude/skills/gstack/browse/bin/remote-slug 2>/dev/null || basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")
mkdir -p "$HOME/.gstack/projects/$REMOTE_SLUG"
mkdir -p ~/.gstack
```

Append one line per triage outcome to **both** files (per-project for suppressions, global for retro):
- `~/.gstack/projects/$REMOTE_SLUG/greptile-history.md` (per-project)
- `~/.gstack/greptile-history.md` (global aggregate)

Format:
```
<YYYY-MM-DD> | <owner/repo> | <type> | <file-pattern> | <category>
```

Example entries:
```
2026-03-13 | garrytan/myapp | fp | app/services/auth_service.rb | race-condition
2026-03-13 | garrytan/myapp | fix | app/models/user.rb | null-check
2026-03-13 | garrytan/myapp | already-fixed | lib/payments.rb | error-handling
```

---

## Output Format

Include a Greptile summary in the output header:
```
+ N Greptile comments (X valid, Y fixed, Z FP)
```

For each classified comment, show:
- Classification tag: `[VALID]`, `[FIXED]`, `[FALSE POSITIVE]`, `[SUPPRESSED]`
- File:line reference (for line-level) or `[top-level]` (for top-level)
- One-line body summary
- Permalink URL (the `html_url` field)
