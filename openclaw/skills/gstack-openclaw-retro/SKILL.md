---
name: gstack-openclaw-retro
description: "Weekly engineering retrospective。分析 commit history、work patterns 和 code quality metrics，带持久化 history 与 trend tracking。Team-aware：按人拆分 contributions、praise 和 growth areas。当用户要求 weekly retro、what shipped this week 或 engineering retrospective 时使用。"
---

# Weekly Engineering Retrospective（每周工程复盘）

生成完整 engineering retrospective，分析 commit history、work patterns 和 code quality metrics。Team-aware：先识别运行命令的用户，再分析每位 contributor，给出 per-person praise 和 growth opportunities。

## Arguments（参数）

- Default：last 7 days
- `24h`：last 24 hours
- `14d`：last 14 days
- `30d`：last 30 days
- `compare`：比较 current window 与 prior same-length window

## Instructions（说明）

解析 argument，确定 time window。默认 7 天。所有时间都应按用户的 **local timezone** 报告。

**Midnight-aligned windows：**对 day units，在 local midnight 计算 absolute start date。例如今天是 2026-03-18，window 是 7 天，则 start date 是 2026-03-11。git log queries 使用 `--since="2026-03-11T00:00:00"`。对 hour units，使用 `--since="N hours ago"`。

---

### Step 1：Gather Raw Data

首先 fetch origin，并识别 current user：

```bash
git fetch origin main --quiet
git config user.name
git config user.email
```

`git config user.name` 返回的 name 是 **"you"**，也就是阅读此 retro 的人。所有其他 authors 都是 teammates。

运行以下全部 git commands（它们彼此独立）：

```bash
# 所有 commits：timestamps、subject、hash、author、files changed
git log origin/main --since="<window>" --format="%H|%aN|%ae|%ai|%s" --shortstat

# 每个 commit 的 test vs total LOC breakdown，包含 author
git log origin/main --since="<window>" --format="COMMIT:%H|%aN" --numstat

# 用于 session detection 和 hourly distribution 的 commit timestamps
git log origin/main --since="<window>" --format="%at|%aN|%ai|%s" | sort -n

# 最常变更文件（hotspot analysis）
git log origin/main --since="<window>" --format="" --name-only | grep -v '^$' | sort | uniq -c | sort -rn

# 从 commit messages 提取 PR numbers
git log origin/main --since="<window>" --format="%s" | grep -oE '[#!][0-9]+' | sort -t'#' -k1 | uniq

# Per-author file hotspots
git log origin/main --since="<window>" --format="AUTHOR:%aN" --name-only

# Per-author commit counts
git shortlog origin/main --since="<window>" -sn --no-merges

# Test file count
find . -name '*.test.*' -o -name '*.spec.*' -o -name '*_test.*' -o -name '*_spec.*' 2>/dev/null | grep -v node_modules | wc -l

# window 内变更过的 test files
git log origin/main --since="<window>" --format="" --name-only | grep -E '\.(test|spec)\.' | sort -u | wc -l
```

---

### Step 2：Compute Metrics

计算并在 summary 中展示这些 metrics：

- **Commits to main:** N
- **Contributors:** N
- **PRs merged:** N
- **Total insertions:** N
- **Total deletions:** N
- **Net LOC added:** N
- **Test LOC (insertions):** N
- **Test LOC ratio:** N%
- **Version range:** vX.Y.Z → vX.Y.Z
- **Active days:** N
- **Detected sessions:** N
- **Avg LOC/session-hour:** N

然后紧接着展示 **per-author leaderboard**：

```
Contributor         Commits   +/-          Top area
You (garry)              32   +2400/-300   browse/
alice                    12   +800/-150    app/services/
bob                       3   +120/-40     tests/
```

按 commits 降序排序。Current user 始终放在第一位，label 为 `You (name)`。

---

### Step 3：Commit Time Distribution

按 local time 展示 hourly histogram：

```
Hour  Commits  ████████████████
 00:    4      ████
 07:    5      █████
 ...
```

识别：
- Peak hours
- Dead zones
- Bimodal pattern（morning / evening）vs continuous
- Late-night coding clusters（晚上 10 点后）

---

### Step 4：Work Session Detection

使用连续 commits 之间 **45-minute gap** 的 threshold 检测 sessions。

分类 sessions：
- **Deep sessions**（50+ min）
- **Medium sessions**（20-50 min）
- **Micro sessions**（<20 min，single-commit）

计算：
- Total active coding time
- Average session length
- LOC per hour of active time

---

### Step 5：Commit Type Breakdown

按 conventional commit prefix（feat / fix / refactor / test / chore / docs）分类，并展示 percentage bar：

```
feat:     20  (40%)  ████████████████████
fix:      27  (54%)  ███████████████████████████
refactor:  2  ( 4%)  ██
```

如果 fix ratio 超过 50%，标记它。这表示 `ship fast, fix fast` pattern，可能暗示 review gaps。

---

### Step 6：Hotspot Analysis

展示 top 10 most-changed files。标记：
- 变更 5+ 次的 files（churn hotspots）
- Hotspot list 中的 test files vs production files
- VERSION / CHANGELOG frequency

---

### Step 7：PR Size Distribution

估算 PR sizes，并分桶：
- **Small**（<100 LOC）
- **Medium**（100-500 LOC）
- **Large**（500-1500 LOC）
- **XL**（1500+ LOC）

---

### Step 8：Focus Score + Ship of the Week

**Focus score：**触碰 single most-changed top-level directory 的 commits 百分比。越高表示更深的 focused work；越低表示 scattered context-switching。

**Ship of the week：**window 内 single highest-LOC PR。突出 PR number、LOC changed，以及为什么重要。

---

### Step 9：Team Member Analysis

对每位 contributor（包括 current user），计算：

1. **Commits and LOC**：total commits、insertions、deletions、net LOC
2. **Areas of focus**：他们最常触碰哪些 directories / files（top 3）
3. **Commit type mix**：个人 feat / fix / refactor / test breakdown
4. **Session patterns**：他们何时写 code（peak hours）、session count
5. **Test discipline**：个人 test LOC ratio
6. **Biggest ship**：他们 single highest-impact commit 或 PR

**对 current user（"You"）：**做最深入分析。包含所有 session analysis、time patterns、focus score。用第一人称 framing。

**对每位 teammate：**用 2-3 句覆盖他们 ship 了什么以及 pattern。然后：

- **Praise**（1-2 个 specific things）：anchor in actual commits。不要说 `great work`，要说具体好在哪里。
- **Opportunity for growth**（1 个 specific thing）：framing 为 leveling-up，而不是 criticism。Anchor in actual data。

**如果是 solo repo：**跳过 team breakdown。

**AI collaboration：**如果 commits 有 `Co-Authored-By` AI trailers，将 `AI-assisted commits` 作为 separate metric 追踪。

---

### Step 10：Week-over-Week Trends（如果 window >= 14d）

拆成 weekly buckets 并展示 trends：
- Commits per week（total 和 per-author）
- LOC per week
- Test ratio per week
- Fix ratio per week
- Session count per week

---

### Step 11：Streak Tracking

从今天往回数，统计至少有 1 个 commit 的 consecutive days：

```bash
# Team streak
git log origin/main --format="%ad" --date=format:"%Y-%m-%d" | sort -u

# Personal streak
git log origin/main --author="<user_name>" --format="%ad" --date=format:"%Y-%m-%d" | sort -u
```

同时展示：
- `Team shipping streak: 47 consecutive days`
- `Your shipping streak: 32 consecutive days`

---

### Step 12：Load History & Compare

检查 `memory/` 中是否有 prior retro history：

如果 prior retros 存在，加载最近一次并计算 deltas：

```
                    Last        Now         Delta
Test ratio:         22%    →    41%         ↑19pp
Sessions:           10     →    14          ↑4
LOC/hour:           200    →    350         ↑75%
Fix ratio:          54%    →    30%         ↓24pp (improving)
```

如果没有 prior retros，说明：`First retro recorded, run again next week to see trends.`（保留 exact note）

---

### Step 13：Save Retro History

将 JSON snapshot 保存到 `memory/retro-YYYY-MM-DD.json`，包含 metrics、authors、version range、streak 和 tweetable summary。

---

### Step 14：Write the Narrative

**Format for Telegram**（bullets、bold，final output 不使用 markdown tables）。

结构：

**Tweetable summary**（第一行）：
> Week of Mar 1: 47 commits (3 contributors), 3.2k LOC, 38% tests, 12 PRs, peak: 10pm | Streak: 47d

然后包含以下 sections：

- **Summary**：key metrics
- **Trends vs Last Retro**：deltas（如果是 first retro 则跳过）
- **Time & Session Patterns**：team 何时写 code、session lengths、deep vs micro
- **Shipping Velocity**：commit types、PR sizes、fix-chain detection
- **Code Quality Signals**：test ratio、hotspots、churn
- **Focus & Highlights**：focus score、ship of the week
- **Your Week**：current user 的 personal deep-dive
- **Team Breakdown**：per-teammate analysis，包含 praise + growth（如果 solo 则跳过）
- **Top 3 Team Wins**：highest-impact things shipped
- **3 Things to Improve**：specific、actionable、anchored in commits
- **3 Habits for Next Week**：small、practical、realistic（<5 min to adopt）

---

## Compare Mode（比较模式）

当用户说 `compare` 时：
- 为 current window 运行 retro
- 为 prior same-length window 运行 retro
- 并排呈现 metrics，用 arrows 表示 improvement / regression
- 简短叙述 biggest changes

---

## 重要规则

- **所有时间使用 local timezone。** 永远不要设置 `TZ`。
- **Format for Telegram。** 使用 bullets 和 bold。Final output 避免 markdown tables。
- **Praise anchored in commits。** 不命名具体好在哪里，就不要说 "great work"。
- **Growth areas anchored in data。** 没有 evidence 就不要批评。
- **Save history。** 每次 retro 都保存到 `memory/`，用于 trend tracking。
- **Completion status：**
  - DONE ... retro 已生成，history 已保存
  - DONE_WITH_CONCERNS ... 已生成但缺少数据（例如 no prior retros for comparison）
  - BLOCKED ... 不在 git repo 中，或 window 内没有 commits
