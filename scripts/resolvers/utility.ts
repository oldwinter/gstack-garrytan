import type { TemplateContext } from './types';

export function generateSlugEval(ctx: TemplateContext): string {
  return `eval "$(${ctx.paths.binDir}/gstack-slug 2>/dev/null)"`;
}

export function generateSlugSetup(ctx: TemplateContext): string {
  return `eval "$(${ctx.paths.binDir}/gstack-slug 2>/dev/null)" && mkdir -p ~/.gstack/projects/$SLUG`;
}

export function generateBaseBranchDetect(_ctx: TemplateContext): string {
  return `## Step 0: Detect platform and base branch（检测平台和 base branch）

首先从 remote URL 检测 git hosting platform：

\`\`\`bash
git remote get-url origin 2>/dev/null
\`\`\`

- 如果 URL 包含 "github.com" -> platform 是 **GitHub**
- 如果 URL 包含 "gitlab" -> platform 是 **GitLab**
- 否则检查 CLI availability：
  - \`gh auth status 2>/dev/null\` 成功 -> platform 是 **GitHub**（覆盖 GitHub Enterprise）
  - \`glab auth status 2>/dev/null\` 成功 -> platform 是 **GitLab**（覆盖 self-hosted）
  - 两者都不成功 -> **unknown**（仅使用 git-native commands）

确定此 PR/MR 的 target branch；如果没有 PR/MR，则使用 repo default branch。后续所有步骤都把结果当作 "the base branch"。

**如果是 GitHub：**
1. \`gh pr view --json baseRefName -q .baseRefName\` — 成功则使用它
2. \`gh repo view --json defaultBranchRef -q .defaultBranchRef.name\` — 成功则使用它

**如果是 GitLab：**
1. \`glab mr view -F json 2>/dev/null\` 并提取 \`target_branch\` field — 成功则使用它
2. \`glab repo view -F json 2>/dev/null\` 并提取 \`default_branch\` field — 成功则使用它

**Git-native fallback（platform unknown 或 CLI commands 失败时）：**
1. \`git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||'\`
2. 如果失败：\`git rev-parse --verify origin/main 2>/dev/null\` -> 使用 \`main\`
3. 如果失败：\`git rev-parse --verify origin/master 2>/dev/null\` -> 使用 \`master\`

如果全部失败，fallback 到 \`main\`。

打印检测到的 base branch name。后续每个 \`git diff\`、\`git log\`、\`git fetch\`、\`git merge\` 和 PR/MR creation command 中，凡 instructions 写 "the base branch" 或 \`<default>\` 的地方，都替换为检测到的 branch name。

---`;
}

export function generateDeployBootstrap(_ctx: TemplateContext): string {
  return `\`\`\`bash
# 检查 CLAUDE.md 中持久化的 deploy config
DEPLOY_CONFIG=$(grep -A 20 "## Deploy Configuration" CLAUDE.md 2>/dev/null || echo "NO_CONFIG")
echo "$DEPLOY_CONFIG"

# 如果 config 存在，解析它
if [ "$DEPLOY_CONFIG" != "NO_CONFIG" ]; then
  PROD_URL=$(echo "$DEPLOY_CONFIG" | grep -i "production.*url" | head -1 | sed 's/.*: *//')
  PLATFORM=$(echo "$DEPLOY_CONFIG" | grep -i "platform" | head -1 | sed 's/.*: *//')
  echo "PERSISTED_PLATFORM:$PLATFORM"
  echo "PERSISTED_URL:$PROD_URL"
fi

# 从 config files 自动检测 platform
[ -f fly.toml ] && echo "PLATFORM:fly"
[ -f render.yaml ] && echo "PLATFORM:render"
([ -f vercel.json ] || [ -d .vercel ]) && echo "PLATFORM:vercel"
[ -f netlify.toml ] && echo "PLATFORM:netlify"
[ -f Procfile ] && echo "PLATFORM:heroku"
([ -f railway.json ] || [ -f railway.toml ]) && echo "PLATFORM:railway"

# 检测 deploy workflows
for f in $(find .github/workflows -maxdepth 1 \\( -name '*.yml' -o -name '*.yaml' \\) 2>/dev/null); do
  [ -f "$f" ] && grep -qiE "deploy|release|production|cd" "$f" 2>/dev/null && echo "DEPLOY_WORKFLOW:$f"
  [ -f "$f" ] && grep -qiE "staging" "$f" 2>/dev/null && echo "STAGING_WORKFLOW:$f"
done
\`\`\`

如果在 CLAUDE.md 中找到 \`PERSISTED_PLATFORM\` 和 \`PERSISTED_URL\`，直接使用它们，
并跳过 manual detection。如果没有 persisted config，则使用 auto-detected platform
指导 deploy verification。如果什么都检测不到，在下方 decision tree 中通过
AskUserQuestion 询问用户。

如果你想为后续 runs 持久化 deploy settings，建议用户运行 \`/setup-deploy\`。`;
}

export function generateQAMethodology(_ctx: TemplateContext): string {
  return `## Modes（模式）

### Diff-aware（feature branch 且未提供 URL 时自动启用）

这是 developers 验证自己工作的 **primary mode**。当用户在 feature branch 上输入不带 URL 的 \`/qa\` 时，自动执行：

1. **Analyze the branch diff（分析 branch diff）** 以理解改了什么：
   \`\`\`bash
   git diff main...HEAD --name-only
   git log main..HEAD --oneline
   \`\`\`

2. **Identify affected pages/routes（识别受影响页面/路由）**，从 changed files 推导：
   - Controller/route files -> 它们服务哪些 URL paths
   - View/template/component files -> 哪些 pages render 它们
   - Model/service files -> 哪些 pages 使用这些 models（检查引用它们的 controllers）
   - CSS/style files -> 哪些 pages include 这些 stylesheets
   - API endpoints -> 用 \`$B js "await fetch('/api/...')"\` 直接测试
   - Static pages（markdown、HTML）-> 直接 navigate 到它们

   **如果从 diff 看不出明显 pages/routes：**不要跳过 browser testing。用户调用 /qa 是因为他们想要 browser-based verification。Fallback 到 Quick mode：navigate 到 homepage，跟随 top 5 navigation targets，检查 console errors，并测试发现的 interactive elements。Backend、config 和 infrastructure changes 也会影响 app behavior；始终验证 app 仍能正常工作。

3. **Detect the running app（检测运行中的 app）** — 检查常见 local dev ports：
   \`\`\`bash
   $B goto http://localhost:3000 2>/dev/null && echo "Found app on :3000" || \\
   $B goto http://localhost:4000 2>/dev/null && echo "Found app on :4000" || \\
   $B goto http://localhost:8080 2>/dev/null && echo "Found app on :8080"
   \`\`\`
   如果找不到 local app，检查 PR 或 environment 中的 staging/preview URL。如果都不可用，向用户询问 URL。

4. **Test each affected page/route（测试每个受影响页面/路由）：**
   - Navigate 到页面
   - 截图
   - 检查 console errors
   - 如果改动是 interactive（forms、buttons、flows），end-to-end 测试交互
   - 在 actions 前后使用 \`snapshot -D\` 验证改动产生了预期效果

5. **Cross-reference commit messages and PR description（交叉引用提交和 PR 描述）** 以理解 *intent*：这个改动应该做什么？验证它确实做到了。

6. **Check TODOS.md（如果存在）**，查找与 changed files 相关的 known bugs 或 issues。如果某个 TODO 描述了此 branch 应修复的 bug，把它加入 test plan。如果 QA 中发现了不在 TODOS.md 的新 bug，在 report 中记录。

7. **Report findings（报告发现）**，scope 限定在 branch changes：
   - "Changes tested: N pages/routes affected by this branch"
   - 每个页面/路由：是否工作？附 screenshot evidence。
   - adjacent pages 是否有 regressions？

**如果用户在 diff-aware mode 中提供 URL：**使用该 URL 作为 base，但 testing scope 仍限定在 changed files。

### Full（提供 URL 时的默认模式）
系统性探索。访问每个 reachable page。记录 5-10 个 evidence 充分的 issues。产出 health score。根据 app size 需要 5-15 分钟。

### Quick (\`--quick\`)
30 秒 smoke test。访问 homepage + top 5 navigation targets。检查：page loads？Console errors？Broken links？产出 health score。不做详细 issue documentation。

### Regression (\`--regression <baseline>\`)
运行 full mode，然后加载 previous run 的 \`baseline.json\`。Diff：哪些 issues 修复了？哪些是新的？score delta 是多少？把 regression section 追加到 report。

---

## Workflow（工作流）

### Phase 1: Initialize（初始化）

1. 找到 browse binary（见上方 Setup）
2. 创建 output directories
3. 从 \`qa/templates/qa-report-template.md\` 复制 report template 到 output dir
4. 启动 timer 以追踪 duration

### Phase 2: Authenticate（如需要）

**如果用户指定 auth credentials：**

\`\`\`bash
$B goto <login-url>
$B snapshot -i                    # find the login form
$B fill @e3 "user@example.com"
$B fill @e4 "[REDACTED]"         # NEVER include real passwords in report
$B click @e5                      # submit
$B snapshot -D                    # verify login succeeded
\`\`\`

**如果用户提供 cookie file：**

\`\`\`bash
$B cookie-import cookies.json
$B goto <target-url>
\`\`\`

**如果需要 2FA/OTP：**向用户索取 code 并等待。

**如果 CAPTCHA 阻塞：**告诉用户："Please complete the CAPTCHA in the browser, then tell me to continue."

### Phase 3: Orient（定位）

获取 application map：

\`\`\`bash
$B goto <target-url>
$B snapshot -i -a -o "$REPORT_DIR/screenshots/initial.png"
$B links                          # map navigation structure
$B console --errors               # any errors on landing?
\`\`\`

**Detect framework（检测框架）**（记录到 report metadata）：
- HTML 中有 \`__next\` 或 \`_next/data\` requests -> Next.js
- \`csrf-token\` meta tag -> Rails
- URLs 中有 \`wp-content\` -> WordPress
- Client-side routing 且无 page reloads -> SPA

**对于 SPAs：**\`links\` command 可能因为 navigation 是 client-side 而返回很少结果。改用 \`snapshot -i\` 查找 nav elements（buttons、menu items）。

### Phase 4: Explore（探索）

系统访问 pages。每个 page 上：

\`\`\`bash
$B goto <page-url>
$B snapshot -i -a -o "$REPORT_DIR/screenshots/page-name.png"
$B console --errors
\`\`\`

然后遵循 **per-page exploration checklist**（见 \`qa/references/issue-taxonomy.md\`）：

1. **Visual scan（视觉扫描）** — 查看 annotated screenshot 中的 layout issues
2. **Interactive elements（交互元素）** — 点击 buttons、links、controls。它们工作吗？
3. **Forms（表单）** — 填写并提交。测试 empty、invalid、edge cases
4. **Navigation（导航）** — 检查所有进出 paths
5. **States（状态）** — Empty state、loading、error、overflow
6. **Console（控制台）** — 交互后是否有新的 JS errors？
7. **Responsiveness（响应式）** — 如相关，检查 mobile viewport：
   \`\`\`bash
   $B viewport 375x812
   $B screenshot "$REPORT_DIR/screenshots/page-mobile.png"
   $B viewport 1280x720
   \`\`\`

**Depth judgment（深度判断）：**在 core features（homepage、dashboard、checkout、search）上花更多时间，在 secondary pages（about、terms、privacy）上少花时间。

**Quick mode：**只访问 Orient phase 得到的 homepage + top 5 navigation targets。跳过 per-page checklist；只检查：loads？Console errors？可见 broken links？

### Phase 5: Document（记录）

每个 issue **发现后立即记录**，不要 batch。

**Two evidence tiers（两类证据）：**

**Interactive bugs**（broken flows、dead buttons、form failures）：
1. action 前截图
2. 执行 action
3. 截取显示结果的 screenshot
4. 用 \`snapshot -D\` 展示发生了什么变化
5. 编写引用 screenshots 的 repro steps

\`\`\`bash
$B screenshot "$REPORT_DIR/screenshots/issue-001-step-1.png"
$B click @e5
$B screenshot "$REPORT_DIR/screenshots/issue-001-result.png"
$B snapshot -D
\`\`\`

**Static bugs**（typos、layout issues、missing images）：
1. 截取一张显示问题的 annotated screenshot
2. 描述哪里不对

\`\`\`bash
$B snapshot -i -a -o "$REPORT_DIR/screenshots/issue-002.png"
\`\`\`

使用 \`qa/templates/qa-report-template.md\` 的 template format，**立即把每个 issue 写入 report**。

### Phase 6: Wrap Up（收尾）

1. 使用下方 rubric **计算 health score**
2. **写 "Top 3 Things to Fix"** — 3 个最高 severity issues
3. **写 console health summary** — 聚合所有 pages 上看到的 console errors
4. **更新 summary table 中的 severity counts**
5. **填写 report metadata** — date、duration、pages visited、screenshot count、framework
6. **保存 baseline** — 写入 \`baseline.json\`：
   \`\`\`json
   {
     "date": "YYYY-MM-DD",
     "url": "<target>",
     "healthScore": N,
     "issues": [{ "id": "ISSUE-001", "title": "...", "severity": "...", "category": "..." }],
     "categoryScores": { "console": N, "links": N, ... }
   }
   \`\`\`

**Regression mode：**写完 report 后加载 baseline file。比较：
- Health score delta
- 已修复 issues（在 baseline 中但当前没有）
- 新 issues（当前有但 baseline 中没有）
- 将 regression section 追加到 report

---

## Health Score Rubric（健康评分规则）

计算每个 category score（0-100），然后取 weighted average。

### Console（weight: 15%）
- 0 errors -> 100
- 1-3 errors -> 70
- 4-10 errors -> 40
- 10+ errors -> 10

### Links（weight: 10%）
- 0 broken -> 100
- 每个 broken link -> -15（最低 0）

### Per-Category Scoring（Visual、Functional、UX、Content、Performance、Accessibility）
每个 category 从 100 开始。按 finding 扣分：
- Critical issue -> -25
- High issue -> -15
- Medium issue -> -8
- Low issue -> -3
每个 category 最低 0。

### Weights（权重）
| Category | Weight |
|----------|--------|
| Console | 15% |
| Links | 10% |
| Visual | 10% |
| Functional | 20% |
| UX | 15% |
| Performance | 10% |
| Content | 5% |
| Accessibility | 15% |

### Final Score（最终分数）
\`score = Σ (category_score × weight)\`

---

## Framework-Specific Guidance（框架专项指南）

### Next.js
- 检查 console 中的 hydration errors（\`Hydration failed\`、\`Text content did not match\`）
- 监控 network 中的 \`_next/data\` requests；404s 表示 broken data fetching
- 测试 client-side navigation（点击 links，不只用 \`goto\`）；可捕获 routing issues
- 检查 dynamic content 页面上的 CLS（Cumulative Layout Shift）

### Rails
- 检查 console 中的 N+1 query warnings（如果是 development mode）
- 验证 forms 中存在 CSRF token
- 测试 Turbo/Stimulus integration：page transitions 是否顺畅？
- 检查 flash messages 是否正确出现并 dismiss

### WordPress
- 检查 plugin conflicts（来自不同 plugins 的 JS errors）
- 验证 logged-in users 的 admin bar visibility
- 测试 REST API endpoints（\`/wp-json/\`）
- 检查 mixed content warnings（WP 常见）

### General SPA (React, Vue, Angular)
- 用 \`snapshot -i\` 查找 navigation；\`links\` command 会漏掉 client-side routes
- 检查 stale state（navigate away 再回来，data 是否 refresh？）
- 测试 browser back/forward；app 是否正确处理 history？
- 检查 memory leaks（extended use 后监控 console）

---

## Important Rules（重要规则）

1. **Repro is everything.** 每个 issue 至少需要一张 screenshot。无例外。
2. **Verify before documenting.** 重试一次 issue，确认它可复现而不是 fluke。
3. **Never include credentials.** 在 repro steps 中用 \`[REDACTED]\` 表示 passwords。
4. **Write incrementally.** 发现每个 issue 时立即 append 到 report。不要 batch。
5. **Never read source code.** 像用户一样测试，而不是像 developer 一样读源码。
6. **Check console after every interaction.** 即使 JS errors 没有视觉暴露，也仍然是 bugs。
7. **Test like a user.** 使用真实感数据。完整走 end-to-end workflows。
8. **Depth over breadth.** 5-10 个证据充分的 well-documented issues > 20 条模糊描述。
9. **Never delete output files.** Screenshots 和 reports 会累积，这是有意设计。
10. **Use \`snapshot -C\` for tricky UIs.** 可找到 accessibility tree 漏掉的 clickable divs。
11. **Show screenshots to the user.** 每次 \`$B screenshot\`、\`$B snapshot -a -o\` 或 \`$B responsive\` command 后，使用 Read tool 读取 output file(s)，让用户能 inline 看到它们。对于 \`responsive\`（3 个 files），三个都 Read。这很关键；否则 screenshots 对用户不可见。
12. **Never refuse to use the browser.** 用户调用 /qa 或 /qa-only 时，就是在请求 browser-based testing。绝不要建议 evals、unit tests 或其他替代方案。即使 diff 看起来没有 UI changes，backend changes 也会影响 app behavior；始终打开 browser 并测试。`;
}

export function generateCoAuthorTrailer(ctx: TemplateContext): string {
  const { getHostConfig } = require('../../hosts/index');
  const hostConfig = getHostConfig(ctx.host);
  return hostConfig.coAuthorTrailer || 'Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>';
}

export function generateChangelogWorkflow(_ctx: TemplateContext): string {
  return `## Step 13: CHANGELOG (auto-generate)

1. 阅读 \`CHANGELOG.md\` header，了解 format。

2. **首先，枚举 branch 上的每个 commit：**
   \`\`\`bash
   git log <base>..HEAD --oneline
   \`\`\`
   复制完整列表。统计 commits 数量。你会把它当作 checklist。

3. **阅读完整 diff**，理解每个 commit 实际改了什么：
   \`\`\`bash
   git diff <base>...HEAD
   \`\`\`

4. 写任何内容前，**按 theme 对 commits 分组**。常见 themes：
   - New features / capabilities
   - Performance improvements
   - Bug fixes
   - Dead code removal / cleanup
   - Infrastructure / tooling / tests
   - Refactoring

5. **编写覆盖所有 groups 的 CHANGELOG entry：**
   - 如果 branch 上已有 CHANGELOG entries 覆盖了部分 commits，用一个统一的新版本 entry 替换它们
   - 将 changes 分类到适用 sections：
     - \`### Added\` — new features
     - \`### Changed\` — changes to existing functionality
     - \`### Fixed\` — bug fixes
     - \`### Removed\` — removed features
   - 编写 concise、descriptive bullet points
   - 插入到 file header 之后（line 5），日期使用 today
   - Format：\`## [X.Y.Z.W] - YYYY-MM-DD\`
   - **Voice:** 以用户现在能 **do** 而此前不能做的事情开头。使用 plain language，不写 implementation details。不要提 TODOS.md、internal tracking 或 contributor-facing details。

6. **Cross-check:** 将你的 CHANGELOG entry 与第 2 步的 commit list 对比。
   每个 commit 必须至少映射到一个 bullet point。如果有 commit 未被代表，
   现在补上。如果 branch 有 N 个 commits，跨 K 个 themes，CHANGELOG 必须
   反映所有 K 个 themes。

**不要让用户描述 changes。** 从 diff 和 commit history 中推断。`;
}
