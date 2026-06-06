<!-- AUTO-GENERATED from review-sections.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
## Review Sections（7 passes，scope 达成一致后）

**Anti-skip rule（防跳过规则）：** 无论 plan type（strategy、spec、code、infra）是什么，都绝不要压缩、缩写或跳过任何 review pass（1-7）。此 skill 中每个 pass 都有存在理由。“这是 strategy doc，所以 design passes 不适用”永远是错的，design gaps 正是 implementation 崩溃的地方。如果某个 pass 真的没有 findings，就说“没有发现问题”并继续，但你必须评估它。

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

### Pass 1: Information Architecture（信息架构）
评分 0-10：plan 是否定义用户先看见什么、第二看见什么、第三看见什么？
修到 10 分：向 plan 添加 information hierarchy。包含 screen/page structure 和 navigation flow 的 ASCII diagram。应用 "constraint worship"：如果只能展示 3 件事，哪 3 件最重要？
**STOP。** 每个 issue 调用一次 AskUserQuestion。不要 batch。给出 recommendation + WHY。如果没有 issues，就说明并继续。用户回应前不要继续。

### Pass 2: Interaction State Coverage（交互状态覆盖）
评分 0-10：plan 是否指定 loading、empty、error、success、partial states？
修到 10 分：向 plan 添加 interaction state table：
```
  FEATURE              | LOADING | EMPTY | ERROR | SUCCESS | PARTIAL
  ---------------------|---------|-------|-------|---------|--------
  [each UI feature]    | [spec]  | [spec]| [spec]| [spec]  | [spec]
```
对每个 state：描述用户看到什么，而不是 backend behavior。
Empty states 是 features：指定 warmth、primary action、context。
**STOP。** 每个 issue 调用一次 AskUserQuestion。不要 batch。给出 recommendation + WHY。

### Pass 3: User Journey & Emotional Arc（用户旅程与情绪弧线）
评分 0-10：plan 是否考虑用户的 emotional experience？
修到 10 分：添加 user journey storyboard：
```
  STEP | USER DOES        | USER FEELS      | PLAN SPECIFIES?
  -----|------------------|-----------------|----------------
  1    | Lands on page    | [what emotion?] | [what supports it?]
  ...
```
应用 time-horizon design：5-sec visceral、5-min behavioral、5-year reflective。
**STOP。** 每个 issue 调用一次 AskUserQuestion。不要 batch。给出 recommendation + WHY。

### Pass 4: AI Slop Risk（AI slop 风险）
评分 0-10：plan 描述的是 specific、intentional UI，还是 generic patterns？
修到 10 分：用 specific alternatives 重写模糊 UI descriptions。

### Design Hard Rules

**Classifier — 评估前先确定 rule set：**
- **MARKETING/LANDING PAGE**（hero-driven、brand-forward、conversion-focused）→ 应用 Landing Page Rules
- **APP UI**（workspace-driven、data-dense、task-focused：dashboards、admin、settings）→ 应用 App UI Rules
- **HYBRID**（带 app-like sections 的 marketing shell）→ hero/marketing sections 应用 Landing Page Rules，functional sections 应用 App UI Rules

**Hard rejection criteria**（instant-fail patterns — 如果 ANY apply 就标记）：
1. Generic SaaS card grid as first impression
2. Beautiful image with weak brand
3. Strong headline with no clear action
4. Busy imagery behind text
5. Sections repeating same mood statement
6. Carousel with no narrative purpose
7. App UI made of stacked cards instead of layout

**Litmus checks**（每一条回答 YES/NO — 用于 cross-model consensus scoring）：
1. Brand/product unmistakable in first screen?
2. One strong visual anchor present?
3. Page understandable by scanning headlines only?
4. Each section has one job?
5. Are cards actually necessary?
6. Does motion improve hierarchy or atmosphere?
7. Would design feel premium with all decorative shadows removed?

**Landing page rules**（classifier = MARKETING/LANDING 时应用）：
- First viewport 读起来像一个完整 composition，而不是 dashboard
- Brand-first hierarchy：brand > headline > body > CTA
- Typography：有表现力、有目的 — 不要 default stacks（Inter、Roboto、Arial、system）
- 不要 flat single-color backgrounds — 使用 gradients、images、subtle patterns
- Hero：full-bleed、edge-to-edge，不要 inset/tiled/rounded variants
- Hero budget：brand、一个 headline、一个 supporting sentence、一个 CTA group、一个 image
- Hero 里不要 cards。只有当 card IS the interaction 时才使用 cards
- 每个 section 只有一个 job：一个 purpose、一个 headline、一个简短 supporting sentence
- Motion：至少 2-3 个 intentional motions（entrance、scroll-linked、hover/reveal）
- Color：定义 CSS variables，避免 purple-on-white defaults，默认一个 accent color
- Copy：使用 product language，不要 design commentary。"If deleting 30% improves it, keep deleting"
- Beautiful defaults：composition-first、brand 是最响亮的 text、最多 two typefaces、默认 cardless、first viewport 像 poster 而不是 document

**App UI rules**（classifier = APP UI 时应用）：
- 克制的 surface hierarchy、强 typography、少量 colors
- 高密度但可读，minimal chrome
- Organize：primary workspace、navigation、secondary context、one accent
- 避免：dashboard-card mosaics、thick borders、decorative gradients、ornamental icons
- Copy：utility language — orientation、status、action。不是 mood/brand/aspiration
- 只有当 card IS the interaction 时才使用 cards
- Section headings 说明这个 area 是什么，或用户能做什么（"Selected KPIs", "Plan status"）

**Universal rules**（应用于 ALL types）：
- 为 color system 定义 CSS variables
- 不要 default font stacks（Inter、Roboto、Arial、system）
- 每个 section 只有一个 job
- "If deleting 30% of the copy improves it, keep deleting"
- Cards 必须有存在理由 — 不要 decorative card grids
- NEVER 使用小号、低对比文字（body text < 16px 或 body text contrast ratio < 4.5:1）
- NEVER 把 form fields 里的 labels 只放在 placeholder 内（placeholder-as-label pattern — field 有内容时 labels 必须仍然可见）
- ALWAYS 保留 visited vs unvisited link 区分（visited links 必须有不同颜色）
- NEVER 让 headings 悬浮在两个 paragraphs 中间（heading 必须在视觉上更接近它引入的 section，而不是前一个 section）

**AI Slop blacklist**（10 个一眼 "AI-generated" 的 patterns）：
1. Purple/violet/indigo gradient backgrounds or blue-to-purple color schemes
2. **The 3-column feature grid:** icon-in-colored-circle + bold title + 2-line description, repeated 3x symmetrically. THE most recognizable AI layout.
3. Colored circles 里的 icons 作为 section decoration（SaaS starter template look）
4. Centered everything (`text-align: center` on all headings, descriptions, cards)
5. 每个 element 都使用统一 bubbly border-radius（所有地方都是同一个 large radius）
6. Decorative blobs、floating circles、wavy SVG dividers（如果 section 觉得空，需要的是更好的 content，不是 decoration）
7. Emoji as design elements (rockets in headings, emoji as bullet points)
8. Colored left-border on cards (`border-left: 3px solid <accent>`)
9. Generic hero copy ("Welcome to [X]", "Unlock the power of...", "Your all-in-one solution for...")
10. Cookie-cutter section rhythm (hero → 3 features → testimonials → pricing → CTA, every section same height)
11. system-ui or `-apple-system` as the PRIMARY display/body font — the "I gave up on typography" signal. Pick a real typeface.

Source: [OpenAI "Designing Delightful Frontends with GPT-5.4"](https://developers.openai.com/blog/designing-delightful-frontends-with-gpt-5-4)（Mar 2026）+ gstack design methodology.
- "Cards with icons" -> 这些与每个 SaaS template 有何区别？
- "Hero section" -> 什么让这个 hero 感觉属于 THIS product？
- "Clean, modern UI" -> 没意义。替换为实际 design decisions。
- "Dashboard with widgets" -> 什么让它不是 every other dashboard？
如果 Step 0.5 生成了 visual mockups，就用上面的 AI slop blacklist 评估它们。用 Read tool 读取每张 mockup image。mockup 是否落入 generic patterns（3-column grid、centered hero、stock-photo feel）？如果是，标记它，并提出用 `$D iterate --feedback "..."` 加更具体 direction 重新生成。
**STOP。** 每个 issue 调用一次 AskUserQuestion。不要 batch。给出 recommendation + WHY。

### Pass 5: Design System Alignment（设计系统对齐）
评分 0-10：plan 是否与 DESIGN.md 对齐？
修到 10 分：如果 DESIGN.md 存在，用 specific tokens/components 注释。如果没有 DESIGN.md，标记 gap 并推荐 `/design-consultation`。
标记任何 new component：它是否 fit existing vocabulary？
**STOP。** 每个 issue 调用一次 AskUserQuestion。不要 batch。给出 recommendation + WHY。

### Pass 6: Responsive & Accessibility（响应式与无障碍）
评分 0-10：plan 是否指定 mobile/tablet、keyboard nav、screen readers？
修到 10 分：为每个 viewport 添加 responsive specs，不是 "stacked on mobile"，而是 intentional layout changes。添加 a11y：keyboard nav patterns、ARIA landmarks、touch target sizes（44px min）、color contrast requirements。
**STOP。** 每个 issue 调用一次 AskUserQuestion。不要 batch。给出 recommendation + WHY。

### Pass 7: Unresolved Design Decisions（未解决设计决策）
浮现会 haunt implementation 的 ambiguities：
```
  需要决策                     | 如果 defer，会发生什么
  -----------------------------|---------------------------
  Empty state 长什么样？       | Engineer ship "No items found."
  Mobile nav pattern？         | Desktop nav 藏进 hamburger
  ...
```
如果 Step 0.5 生成了 visual mockups，在浮现 unresolved decisions 时引用它们作为 evidence。Mockup 让 decisions 具体，例如："你批准的 mockup 展示了 sidebar nav，但 plan 没有指定 mobile behavior。这个 sidebar 在 375px 下会发生什么？"
每个 decision = 一个带 recommendation + WHY + alternatives 的 AskUserQuestion。每做出一个 decision，就编辑 plan。

### Post-Pass: Update Mockups（如果已生成）

如果 Step 0.5 生成了 mockups，且 review passes 改变了 significant design decisions（information architecture restructure、new states、layout changes），提出 regenerate（one-shot，不是 loop）：

AskUserQuestion: "review passes 改变了 [list major design changes]。要我重新生成 mockups 来反映 updated plan 吗？这样可以确保 visual reference 和我们实际要构建的内容一致。"

如果 yes，使用 `$D iterate` 并用 feedback 总结 changes，或用 updated brief 调用 `$D variants`。保存到同一个 `$_DESIGN_DIR` 目录。

## CRITICAL RULE — How to ask questions（关键规则：如何提问）
遵循上方 Preamble 的 AskUserQuestion 格式。Plan design reviews 的额外规则：
* **一个 issue = 一次 AskUserQuestion 调用。** 绝不要把多个 issues 合并成一个 question。
* 具体描述 design gap：缺什么，如果不指定，用户会体验到什么。
* 呈现 2-3 个 options。对每个说明：现在 specify 的 effort、defer 的 risk。
* **映射到上方 Design Principles。** 用一句话把 recommendation 连接到某个具体 principle。
* 用 issue NUMBER + option LETTER 标记（例如 "3A"、"3B"）。
* **Zero findings（零 findings）：** 如果某个 section 没有 findings，说 "No issues, moving on" 并继续。否则，对每个 gap 使用 AskUserQuestion；即使 gap 有 "obvious fix"，它仍是 gap，仍需用户批准后才能进入 plan。
* **绝不要用 AskUserQuestion 询问用户喜欢哪个 variant。** 始终先创建 comparison board（`$D compare --serve`）并在浏览器打开。Board 有 rating controls、comments、remix/regenerate buttons 和 structured feedback output。AskUserQuestion 只用于通知用户 board 已打开并等待他们完成，不用于 inline 呈现 variants 并问 "which do you prefer?" 那是 degraded experience。

## Required Outputs（必需输出）

### "NOT in scope" section（不在范围内）
列出已考虑并明确 deferred 的 design decisions，每项附一行 rationale。

### "What already exists" section（已有内容）
列出现有 DESIGN.md、UI patterns 和 plan 应复用的 components。

### TODOS.md updates（TODOS.md 更新）
所有 review passes 完成后，把每个潜在 TODO 作为独立 AskUserQuestion 呈现。绝不要 batch TODOs，一次一个问题。绝不要静默跳过此步骤。

对于 design debt：missing a11y、unresolved responsive behavior、deferred empty states。每个 TODO 包含：
* **What：** work 的一行描述。
* **Why：** 它解决的具体问题或 unlock 的 value。
* **Pros：** 做这项 work 会获得什么。
* **Cons：** 成本、复杂性或风险。
* **Context：** 足够细节，让 3 个月后接手的人理解动机。
* **Depends on / blocked by：** 任何 prerequisites。

然后呈现选项：**A)** 添加到 TODOS.md **B)** 跳过，价值不够 **C)** 不 defer，在这个 PR 中现在构建它。

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
TASKS_FILE="$TASKS_DIR/tasks-design-review-$(date +%Y%m%d-%H%M%S).jsonl"
COMMIT=$(git rev-parse HEAD 2>/dev/null || echo unknown)
BRANCH=$(git branch --show-current 2>/dev/null || echo unknown)
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"

# 对此 review 中识别出的每个 task 重复一次 jq invocation。
# 用你为每个 task 设置的 shell variables inline 替换 placeholders：
#   TASK_ID (T1, T2, ...), PRIORITY (P1/P2/P3), COMPONENT, TITLE,
#   SOURCE_FINDING, EFFORT_HUMAN, EFFORT_CC, FILES_JSON (a JSON array literal
#   like '["browse/src/sanitize.ts","browse/src/server.ts"]').
jq -nc \
  --arg phase 'design-review' \
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


### Completion Summary（完成摘要）
```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | [DESIGN.md status, UI scope]                |
  | Step 0               | [initial rating, focus areas]               |
  | Pass 1  (Info Arch)  | ___/10 → ___/10 after fixes                |
  | Pass 2  (States)     | ___/10 → ___/10 after fixes                |
  | Pass 3  (Journey)    | ___/10 → ___/10 after fixes                |
  | Pass 4  (AI Slop)    | ___/10 → ___/10 after fixes                |
  | Pass 5  (Design Sys) | ___/10 → ___/10 after fixes                |
  | Pass 6  (Responsive) | ___/10 → ___/10 after fixes                |
  | Pass 7  (Decisions)  | ___ resolved, ___ deferred                 |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (___ items)                         |
  | What already exists  | written                                     |
  | TODOS.md updates     | ___ items proposed                          |
  | Approved Mockups     | ___ generated, ___ approved                  |
  | Decisions made       | ___ added to plan                           |
  | Decisions deferred   | ___ (listed below)                          |
  | Overall design score | ___/10 → ___/10                             |
  +====================================================================+
```

如果所有 passes 都是 8+："Plan is design-complete. Run /design-review after implementation for visual QA."
如果任何 pass 低于 8：记录未解决内容及原因（用户选择 defer）。

### Unresolved Decisions（未解决决策）
如果任何 AskUserQuestion 未被回答，在这里记录。绝不要静默 default 到某个 option。

### Approved Mockups（已批准 mockups）

如果此 review 期间生成了 visual mockups，向 plan file 添加：

```
## Approved Mockups（已批准 mockups）

| Screen/Section | Mockup Path | Direction | Notes |
|----------------|-------------|-----------|-------|
| [screen name]  | ~/.gstack/projects/$SLUG/designs/[folder]/[filename].png | [brief description] | [constraints from review] |
```

包含每个 approved mockup 的完整路径（用户选择的 variant）、direction 的一行描述和任何 constraints。Implementer 读取此内容，就能确切知道该按哪个 visual 构建。这些内容会跨 conversations 和 workspaces 持久存在。如果没有生成 mockups，省略此 section。

## Review Log（评审日志）

产出上方 Completion Summary 后，持久化 review result。

**PLAN MODE EXCEPTION - ALWAYS RUN：** 此命令将 review metadata 写入 `~/.gstack/`（user config directory，不是 project files）。skill preamble 已经写入 `~/.gstack/sessions/` 和 `~/.gstack/analytics/`，这是同一模式。Review dashboard 依赖此数据。跳过此命令会破坏 /ship 中的 review readiness dashboard。

```bash
~/.claude/skills/gstack/bin/gstack-review-log '{"skill":"plan-design-review","timestamp":"TIMESTAMP","status":"STATUS","initial_score":N,"overall_score":N,"unresolved":N,"decisions_made":N,"commit":"COMMIT"}'
```

用 Completion Summary 中的值替换：
- **TIMESTAMP**：当前 ISO 8601 datetime
- **STATUS**：如果 overall score 8+ 且 unresolved 为 0，则为 "clean"；否则为 "issues_open"
- **initial_score**：fix 前的 initial overall design score（0-10）
- **overall_score**：fix 后的 final overall design score（0-10）
- **unresolved**：unresolved design decisions 数量
- **decisions_made**：加入 plan 的 design decisions 数量
- **COMMIT**：`git rev-parse --short HEAD` 的输出

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

在 table 下方添加这些 lines（空值或不适用时省略）：

- **CODEX:**（仅当 codex-review 运行过）codex fixes 的一行 summary
- **CROSS-MODEL:**（仅当 Claude 和 Codex reviews 都存在）overlap analysis
- **UNRESOLVED:** 所有 reviews 的 unresolved decisions 总数
- **VERDICT：** 列出 CLEAR 的 reviews（例如 "CEO + ENG CLEARED — ready to implement"）。
  如果 Eng Review 不是 CLEAR 且没有 global skip，追加 "eng review required"。

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
~/.claude/skills/gstack/bin/gstack-learnings-log '{"skill":"plan-design-review","type":"TYPE","key":"SHORT_KEY","insight":"DESCRIPTION","confidence":N,"source":"SOURCE","files":["path/to/relevant/file"]}'
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
记录一个 weight 0.5 的 take（按 SKILL_CALIBRATION_WEIGHTS）。
如果 MCP op 不可用，fallback 到 `mcp__gbrain__put_page`，并带
gstack:takes fence block（有文档，但路径更丑）。

Mandatory take frontmatter shape（必须使用的 take frontmatter 形状）：
```yaml
kind: bet
holder: <user identity from whoami>
claim: <one-line prediction the skill is making>
weight: 0.5
since_date: <today's date>
expected_resolution: <date in 1-3 months depending on skill>
source_skill: plan-design-review
```

写入后，invalidate 受影响的 digests，让下一次 preflight 反映新的 state：

```bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" 2>/dev/null || true
  ~/.claude/skills/gstack/bin/gstack-brain-cache invalidate brand --project "$SLUG" 2>/dev/null || true
```


## Brain Cache Background Refresh

skill 工作完成后（且 telemetry 已记录），为任何接近 TTL 的 cache digest
kick 一次 background refresh。这是 non-blocking；用户无需等待。下一次
invocation 会受益于 warm cache。

```bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" 2>/dev/null || true
(~/.claude/skills/gstack/bin/gstack-brain-cache refresh --project "$SLUG" 2>/dev/null &) || true
```


## Next Steps — Review Chaining（下一步：review 链接）

显示 Review Readiness Dashboard 后，基于此 design review 的发现推荐下一步 review。读取 dashboard output，看看哪些 reviews 已运行，以及它们是否 stale。

**如果 eng review 未被全局跳过，推荐 /plan-eng-review** - 检查 dashboard output 中的 `skip_eng_review`。如果为 `true`，表示 eng review 已 opt out，不要推荐。否则，eng review 是 required shipping gate。如果此 design review 添加了 significant interaction specifications、new user flows，或改变了 information architecture，强调 eng review 需要验证 architectural implications。如果已有 eng review，但 commit hash 显示它早于此 design review，说明它可能 stale，应重新运行。

**考虑推荐 /plan-ceo-review** - 但只在此 design review 揭示 fundamental product direction gaps 时。具体来说：overall design score 起始低于 4/10、information architecture 有 major structural problems，或 review 浮现了是否在解决正确问题的疑问。并且 dashboard 中没有 CEO review。这是 selective recommendation；多数 design reviews 不应触发 CEO review。

**如果两者都需要，先推荐 eng review**（required gate）。

**在适当时推荐 design exploration skills** - /design-shotgun 和 /design-html 产出 design artifacts（mockups、HTML previews），不是 application code。它们与 reviews 一样属于 plan mode。如果此 design review 发现 visual issues，且探索新方向会有帮助，推荐 /design-shotgun。如果存在 approved mockups 且需要转换成 working HTML，推荐 /design-html。

使用 AskUserQuestion 呈现下一步。只包含适用 options：
- **A)** 接下来运行 /plan-eng-review（required gate）
- **B)** 运行 /plan-ceo-review（仅当发现 fundamental product gaps 时）
- **C)** 运行 /design-shotgun：为发现的问题探索 visual design variants
- **D)** 运行 /design-html：根据 approved mockups 生成 Pretext-native HTML
- **E)** 跳过，我会手动处理 next steps

## Formatting Rules（格式规则）
* issues 用 NUMBER（1、2、3...），options 用 LETTERS（A、B、C...）。
* 使用 NUMBER + LETTER 标记（例如 "3A"、"3B"）。
* 每个 option 最多一句话。
* 每个 pass 后暂停并等待反馈。
* 每个 pass 前后都评分，提升可扫读性。
