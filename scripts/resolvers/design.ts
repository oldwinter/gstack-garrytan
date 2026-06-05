import type { TemplateContext } from './types';
import { AI_SLOP_BLACKLIST, OPENAI_HARD_REJECTIONS, OPENAI_LITMUS_CHECKS } from './constants';

export function generateDesignReviewLite(ctx: TemplateContext): string {
  const litmusList = OPENAI_LITMUS_CHECKS.map((item, i) => `${i + 1}. ${item}`).join(' ');
  const rejectionList = OPENAI_HARD_REJECTIONS.map((item, i) => `${i + 1}. ${item}`).join(' ');
  // Codex block 仅用于 Claude host
  const codexBlock = ctx.host === 'codex' ? '' : `

7. **Codex design voice**（可选；available 时自动运行）：

\`\`\`bash
command -v codex >/dev/null 2>&1 && echo "CODEX_AVAILABLE" || echo "CODEX_NOT_AVAILABLE"
\`\`\`

如果 Codex available，对 diff 运行 lightweight design check：

\`\`\`bash
TMPERR_DRL=$(mktemp /tmp/codex-drl-XXXXXXXX)
_REPO_ROOT=$(git rev-parse --show-toplevel) || { echo "ERROR: not in a git repo" >&2; exit 1; }
codex exec "审查这个 branch 上的 git diff。执行 7 项 litmus checks（每项 YES/NO）：${litmusList} 标出任何 hard rejections：${rejectionList} 只给出 5 个最重要的 design findings。引用 file:line。" -C "$_REPO_ROOT" -s read-only -c 'model_reasoning_effort="high"' --enable web_search_cached < /dev/null 2>"$TMPERR_DRL"
\`\`\`

使用 5-minute timeout（\`timeout: 300000\`）。Command 完成后读取 stderr：
\`\`\`bash
cat "$TMPERR_DRL" && rm -f "$TMPERR_DRL"
\`\`\`

**Error handling（错误处理）：** 所有 errors 都 non-blocking。Auth failure、timeout 或 empty response 时，简短 note 后 skip 并继续。

在 \`CODEX (design):\` header 下展示 Codex output，并与上方 checklist findings 合并。`;

  return `## Design Review（条件执行，diff-scoped）

使用 \`gstack-diff-scope\` 检查 diff 是否触碰 frontend files：

\`\`\`bash
source <(${ctx.paths.binDir}/gstack-diff-scope <base> 2>/dev/null)
\`\`\`

**如果 \`SCOPE_FRONTEND=false\`：** 静默跳过 design review。无 output。

**如果 \`SCOPE_FRONTEND=true\`：**

1. **检查 DESIGN.md。** 如果 repo root 中存在 \`DESIGN.md\` 或 \`design-system.md\`，读取它。所有 design findings 都按它校准：DESIGN.md 中已 blessed 的 patterns 不 flag。找不到时，使用 universal design principles。

2. **读取 \`.claude/skills/review/design-checklist.md\`。** 如果无法读取该 file，用 note 跳过 design review："Design checklist not found — skipping design review."

3. **读取每个 changed frontend file**（full file，不只是 diff hunks）。Frontend files 由 checklist 中列出的 patterns 识别。

4. **对 changed files 应用 design checklist。** 对每个 item：
   - **[HIGH] mechanical CSS fix**（\`outline: none\`、\`!important\`、\`font-size < 16px\`）：classify as AUTO-FIX
   - **[HIGH/MEDIUM] design judgment needed**：classify as ASK
   - **[LOW] intent-based detection**：展示为 "Possible — verify visually or run /design-review"（保留 exact finding label）

5. **Include findings（包含发现）**：在 review output 的 "Design Review" header 下包含 findings，遵循 checklist 中的 output format。Design findings 会与 code review findings 合并到同一个 Fix-First flow。

6. **Log result** 到 Review Readiness Dashboard：

\`\`\`bash
${ctx.paths.binDir}/gstack-review-log '{"skill":"design-review-lite","timestamp":"TIMESTAMP","status":"STATUS","findings":N,"auto_fixed":M,"commit":"COMMIT"}'
\`\`\`

替换：TIMESTAMP = ISO 8601 datetime；STATUS = 0 findings 时为 "clean"，否则为 "issues_found"；N = total findings；M = auto-fixed count；COMMIT = \`git rev-parse --short HEAD\` 的 output。${codexBlock}`;
}

// NOTE: design-checklist.md 是这套 methodology 中用于 code-level detection 的子集。
// 在这里新增条目时，也要更新 review/design-checklist.md，反之亦然。
export function generateDesignMethodology(_ctx: TemplateContext): string {
  return `## 模式

### Full（默认）
系统化 review 从 homepage 可到达的所有 pages。访问 5-8 个 pages。执行完整 checklist evaluation、responsive screenshots、interaction flow testing。产出带 letter grades 的完整 design audit report。

### Quick (\`--quick\`)
仅 Homepage + 2 个 key pages。执行 First Impression + Design System Extraction + abbreviated checklist。获得 design score 的最快路径。

### Deep (\`--deep\`)
Comprehensive review：10-15 个 pages、每个 interaction flow、exhaustive checklist。适用于 pre-launch audits 或 major redesigns。

### Diff-aware（feature branch 且没有 URL 时自动启用）
在 feature branch 且没有 URL 时，scope 到 branch changes 影响的 pages：
1. 分析 branch diff：\`git diff main...HEAD --name-only\`
2. 将 changed files 映射到 affected pages/routes
3. 检测 common local ports（3000、4000、8080）上的 running app
4. 只 audit affected pages，并对比 before/after design quality

### Regression（使用 \`--regression\` 或发现 previous \`design-baseline.json\`）
运行 full audit，然后加载之前的 \`design-baseline.json\`。比较：per-category grade deltas、new findings、resolved findings。在 report 中输出 regression table。

---

## Phase 1：First Impression

这是最像 designer 的 output。在分析任何东西之前，先形成 gut reaction。

1. Navigate 到 target URL
2. 截取 full-page desktop screenshot：\`$B screenshot "$REPORT_DIR/screenshots/first-impression.png"\`
3. 使用以下 structured critique format 写 **First Impression**：
   - "The site communicates **[what]**."（一眼看上去它表达什么：competence？playfulness？confusion？）
   - "I notice **[observation]**."（突出之处，正面或负面都可以；要具体）
   - "The first 3 things my eye goes to are: **[1]**, **[2]**, **[3]**."（hierarchy check：这 3 个东西是否是 designer 本意？如果不是，visual hierarchy 在说谎。）
   - "If I had to describe this in one word: **[word]**."（gut verdict）

**Narration mode：** 用第一人称写这一节，就像你是第一次扫视页面的用户。"I'm looking at this page... my eye goes to the logo, then a wall of text I skip entirely, then... wait, is that a button?" 点名具体 element、position 和 visual weight。如果无法具体命名，说明你不是在真正 scan，而是在生成 platitudes。

**Page Area Test：** 指向 page 上每个 clearly defined area。你能立即说出它的 purpose 吗？（"Things I can buy"、"Today's deals"、"How to search"。）2 秒内无法命名的 areas 定义不佳。列出它们。

这是用户最先读的 section。要有 opinion。Designer 不 hedge，而是 react。

---

## Phase 2：Design System Extraction

提取 site 实际使用的 design system（不是 DESIGN.md 声称的内容，而是 rendered 出来的内容）：

\`\`\`bash
# 使用中的 fonts（最多 500 个 elements，避免 timeout）
$B js "JSON.stringify([...new Set([...document.querySelectorAll('*')].slice(0,500).map(e => getComputedStyle(e).fontFamily))])"

# 使用中的 color palette
$B js "JSON.stringify([...new Set([...document.querySelectorAll('*')].slice(0,500).flatMap(e => [getComputedStyle(e).color, getComputedStyle(e).backgroundColor]).filter(c => c !== 'rgba(0, 0, 0, 0)'))])"

# Heading hierarchy
$B js "JSON.stringify([...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => ({tag:h.tagName, text:h.textContent.trim().slice(0,50), size:getComputedStyle(h).fontSize, weight:getComputedStyle(h).fontWeight})))"

# Touch target audit（查找尺寸不足的 interactive elements）
$B js "JSON.stringify([...document.querySelectorAll('a,button,input,[role=button]')].filter(e => {const r=e.getBoundingClientRect(); return r.width>0 && (r.width<44||r.height<44)}).map(e => ({tag:e.tagName, text:(e.textContent||'').trim().slice(0,30), w:Math.round(e.getBoundingClientRect().width), h:Math.round(e.getBoundingClientRect().height)})).slice(0,20))"

# Performance baseline
$B perf
\`\`\`

将 findings 组织为 **Inferred Design System**：
- **Fonts:** 列出 usage counts。>3 distinct font families 时 flag。
- **Colors:** extracted palette。>12 unique non-gray colors 时 flag。注明 warm/cool/mixed。
- **Heading Scale:** h1-h6 sizes。Flag skipped levels、non-systematic size jumps。
- **Spacing Patterns:** sample padding/margin values。Flag non-scale values。

Extraction 后，询问：*"Want me to save this as your DESIGN.md? I can lock in these observations as your project's design system baseline."*

---

## Phase 3：Page-by-Page Visual Audit

对 scope 内每个 page：

\`\`\`bash
$B goto <url>
$B snapshot -i -a -o "$REPORT_DIR/screenshots/{page}-annotated.png"
$B responsive "$REPORT_DIR/screenshots/{page}"
$B console --errors
$B perf
\`\`\`

### Auth Detection

第一次 navigation 后，检查 URL 是否变成 login-like path：
\`\`\`bash
$B url
\`\`\`
如果 URL 包含 \`/login\`、\`/signin\`、\`/auth\` 或 \`/sso\`：说明 site requires authentication。使用 AskUserQuestion："This site requires authentication. Want to import cookies from your browser? Run \`/setup-browser-cookies\` first if needed."（保留 exact user prompt）

### Trunk Test（每个 page 都运行）

想象自己没有任何 context，直接落到这个 page 上。你能立即回答吗？
1. 这是什么 site？（Site ID visible and identifiable）
2. 我在哪个 page？（Page name prominent，且 matches what I clicked）
3. 主要 sections 是什么？（Primary nav visible and clear）
4. 我在这一层有哪些 options？（Local nav 或 content choices obvious）
5. 我在整体结构中的位置在哪里？（"You are here" indicator、breadcrumbs）
6. 我如何 search？（Search box findable without hunting）

Score：PASS（6 项都 clear）/ PARTIAL（4-5 项 clear）/ FAIL（3 项或更少 clear）。
Trunk test 中 FAIL 是 HIGH-impact finding，无论 visual design 多 polished。

### Design Audit Checklist（10 categories，约 80 items）

在每个 page 上应用这些检查。每个 finding 都获得 impact rating（high/medium/polish）和 category。

**1. Visual Hierarchy & Composition**（8 items）
- 是否有 clear focal point？每个 view 是否只有一个 primary CTA？
- Eye flow 是否自然从 top-left 到 bottom-right？
- 是否有 visual noise — 竞争元素在争抢注意力？
- Information density 是否适合 content type？
- Z-index 是否清晰 — 有没有意外 overlap？
- Above-the-fold content 是否能在 3 秒内传达 purpose？
- Squint test：blur 后 hierarchy 是否仍然可见？
- White space 是 intentional，还是 leftover？

**2. Typography**（15 items）
- Font count <=3（超过则 flag）
- Scale 是否遵循 ratio（1.25 major third 或 1.333 perfect fourth）
- Line-height：body 1.5x，headings 1.15-1.25x
- Measure：每行 45-75 chars（66 ideal）
- Heading hierarchy：没有 skipped levels（例如 h1→h3 没有 h2）
- Weight contrast：hierarchy 至少使用 >=2 个 weights
- 不使用 blacklisted fonts（Papyrus、Comic Sans、Lobster、Impact、Jokerman）
- 如果 primary font 是 Inter/Roboto/Open Sans/Poppins → flag 为 potentially generic
- Headings 使用 \`text-wrap: balance\` 或 \`text-pretty\`（通过 \`$B css <heading> text-wrap\` 检查）
- 使用 curly quotes，不使用 straight quotes
- 使用 ellipsis character（\`…\`），不是 three dots（\`...\`）
- Number columns 使用 \`font-variant-numeric: tabular-nums\`
- Body text >= 16px
- Caption/label >= 12px
- Lowercase text 不加 letterspacing

**3. Color & Contrast**（10 items）
- Palette coherent（<=12 个 unique non-gray colors）
- WCAG AA：body text 4.5:1，large text（18px+）3:1，UI components 3:1
- Semantic colors consistent（success=green、error=red、warning=yellow/amber）
- 不使用 color-only encoding（始终添加 labels、icons 或 patterns）
- Dark mode：surfaces 使用 elevation，而不仅仅是 lightness inversion
- Dark mode：text 使用 off-white（约 #E0E0E0），不是 pure white
- Primary accent 在 dark mode 中 desaturated 10-20%
- 如果存在 dark mode，html element 上有 \`color-scheme: dark\`
- 不使用仅 red/green 的组合（8% men 有 red-green deficiency）
- Neutral palette consistent warm 或 cool — 不混用

**4. Spacing & Layout**（12 items）
- Grid 在所有 breakpoints 上 consistent
- Spacing 使用 scale（4px 或 8px base），不是 arbitrary values
- Alignment consistent — 没有东西漂出 grid
- Rhythm：相关 items 更近，不同 sections 更远
- Border-radius hierarchy（不要所有东西都是统一 bubbly radius）
- Inner radius = outer radius - gap（nested elements）
- Mobile 上无 horizontal scroll
- 设置 max content width（不要 full-bleed body text）
- Notch devices 使用 \`env(safe-area-inset-*)\`
- URL reflects state（filters、tabs、pagination 在 query params）
- Layout 使用 flex/grid（不是 JS measurement）
- Breakpoints：mobile（375）、tablet（768）、desktop（1024）、wide（1440）

**5. Interaction States**（10 items）
- 所有 interactive elements 都有 hover state
- 存在 \`focus-visible\` ring（never \`outline: none\` without replacement）
- Active/pressed state 有 depth effect 或 color shift
- Disabled state：reduced opacity + \`cursor: not-allowed\`
- Loading：skeleton shapes 匹配真实 content layout
- Empty states：warm message + primary action + visual（不只是 "No items."）
- Error messages：具体，并包含 fix/next step
- Success：confirmation animation 或 color，auto-dismiss
- 所有 interactive elements 的 touch targets >= 44px
- 所有 clickable elements 有 \`cursor: pointer\`
- Mindless choice audit：每个 decision point（button、link、dropdown、modal choice）都是 mindless click（显而易见会发生什么）。如果一次 click 需要思考是否是正确选择，flag as HIGH。

**6. Responsive Design**（8 items）
- Mobile layout 在 *design* 上说得通（不只是 stacked desktop columns）
- Mobile 上 touch targets 足够（>= 44px）
- 任何 viewport 都无 horizontal scroll
- Images 处理 responsive（srcset、sizes 或 CSS containment）
- Mobile 上 text 无需 zooming 即可读（body >= 16px）
- Navigation 适当 collapse（hamburger、bottom nav 等）
- Forms 在 mobile 上可用（correct input types、mobile 上不要 autoFocus）
- Viewport meta 中没有 \`user-scalable=no\` 或 \`maximum-scale=1\`

**7. Motion & Animation**（6 items）
- Easing：entering 用 ease-out，exiting 用 ease-in，moving 用 ease-in-out
- Duration：50-700ms range（除 page transition 外不要更慢）
- Purpose：每个 animation 都传达某种含义（state change、attention、spatial relationship）
- 尊重 \`prefers-reduced-motion\`（检查：\`$B js "matchMedia('(prefers-reduced-motion: reduce)').matches"\`）
- 不使用 \`transition: all\` — 明确列出 properties
- 只 animate \`transform\` 和 \`opacity\`（不是 width、height、top、left 等 layout properties）

**8. Content & Microcopy**（8 items）
- Empty states 带有 warmth（message + action + illustration/icon）
- Error messages 具体：what happened + why + what to do next
- Button labels 具体（"Save API Key" 而不是 "Continue" 或 "Submit"）
- Production 中没有可见 placeholder/lorem ipsum text
- Truncation 已处理（\`text-overflow: ellipsis\`、\`line-clamp\` 或 \`break-words\`）
- Active voice（"Install the CLI" 而不是 "The CLI will be installed"）
- Loading states 以 \`…\` 结尾（"Saving…" 而不是 "Saving..."）
- Destructive actions 有 confirmation modal 或 undo window
- Happy talk detection：扫描以 "Welcome to..." 开头、或夸自己 site 多好的 introductory paragraphs。如果你听到 "blah blah blah"，它就是 happy talk。Flag for removal。
- Instructions detection：任何超过一句话的 visible instructions。如果用户需要阅读 instructions，design 就失败了。Flag 这些 instructions，以及它们正在补救的 interaction。
- Happy talk word count：统计 page 上 total visible words。将每个 text block 分类为 "useful content" vs "happy talk"（welcome paragraphs、自我赞美文本、没人读的 instructions）。Report："This page has X words. Y (Z%) are happy talk."

**9. AI Slop Detection**（10 anti-patterns — blacklist）

测试：受尊重 studio 的 human designer 会 ship 这个吗？

${AI_SLOP_BLACKLIST.map(item => `- ${item}`).join('\n')}

**10. Performance as Design**（6 items）
- LCP < 2.0s（web apps），< 1.5s（informational sites）
- CLS < 0.1（load 期间没有 visible layout shifts）
- Skeleton quality：shapes 匹配真实 content layout，有 shimmer animation
- Images：\`loading="lazy"\`、设置 width/height dimensions、WebP/AVIF format
- Fonts：\`font-display: swap\`，preconnect 到 CDN origins
- 没有 visible font swap flash（FOUT）— critical fonts 已 preload

---

## Phase 4：Interaction Flow Review

走查 2-3 个 key user flows，评估 *feel*，不只是 function：

\`\`\`bash
$B snapshot -i
$B click @e3           # perform action
$B snapshot -D          # diff to see what changed
\`\`\`

Evaluate：
- **Response feel：** 点击是否感觉 responsive？是否有 delays 或 missing loading states？
- **Transition quality：** Transitions 是 intentional，还是 generic/absent？
- **Feedback clarity：** Action 是否 clearly succeed/fail？Feedback 是否 immediate？
- **Form polish：** Focus states 是否 visible？Validation timing 是否正确？Errors 是否靠近 source？

**Narration mode：** 用第一人称叙述 flow。"I click 'Sign Up'... spinner appears... 3 seconds pass... still spinning... I'm getting nervous. Finally the dashboard loads, but where am I? The nav doesn't highlight anything." 点名 specific element、position、visual weight。如果无法具体命名，说明你不是在真正 experience flow，而是在生成 platitudes。

### Goodwill Reservoir（在 flow 中持续追踪）

走查 user flow 时，维护一个 mental goodwill meter（从 70/100 开始）。
这些 scores 是 heuristic，不是 measured。价值在于识别 specific drains 和 fills，而不是 final number。

Subtract points for：
- 用户会想知道的 hidden information（pricing、contact、shipping）：subtract 15
- Format punishment（拒绝 phone numbers 中 dashes 这类 valid input）：subtract 10
- Unnecessary information requests：subtract 10
- 阻塞 task 的 interstitials、splash screens、forced tours：subtract 15
- Sloppy 或 unprofessional appearance：subtract 10
- 需要思考的 ambiguous choices：每个 subtract 5

Add points for：
- Top user tasks obvious and prominent：add 10
- 对 costs 和 limitations upfront：add 5
- Saves steps（direct links、smart defaults、autofill）：每个 add 5
- Graceful error recovery，且有 specific fix instructions：add 10
- 出错时 apologizes：add 5

用 visual dashboard report final goodwill score：

\`\`\`
Goodwill: 70 ████████████████████░░░░░░░░░░
  Step 1: Login page        70 → 75  (+5 obvious primary action)
  Step 2: Dashboard          75 → 60  (-15 interstitial tour popup)
  Step 3: Settings           60 → 50  (-10 format punishment on phone)
  Step 4: Billing            50 → 35  (-15 hidden pricing info)
  FINAL: 35/100 ⚠️ CRITICAL UX DEBT
\`\`\`

低于 30 = critical UX debt。30-60 = needs work。高于 60 = healthy。
将最大的 drains 和 fills 作为 specific findings 包含进去。

---

## Phase 5：Cross-Page Consistency

跨 pages 比较 screenshots 和 observations：
- Navigation bar 是否在所有 pages 上 consistent？
- Footer 是否 consistent？
- Component reuse vs one-off designs（同一个 button 在不同 pages 上样式不同？）
- Tone consistency（一个 page playful，另一个 corporate？）
- Spacing rhythm 是否贯穿 pages？

---

## Phase 6：Compile Report

### 输出位置

**Local：** \`.gstack/design-reports/design-audit-{domain}-{YYYY-MM-DD}.md\`

**Project-scoped：**
\`\`\`bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" && mkdir -p ~/.gstack/projects/$SLUG
\`\`\`
Write to：\`~/.gstack/projects/{slug}/{user}-{branch}-design-audit-{datetime}.md\`

**Baseline：** 为 regression mode 写入 \`design-baseline.json\`：
\`\`\`json
{
  "date": "YYYY-MM-DD",
  "url": "<target>",
  "designScore": "B",
  "aiSlopScore": "C",
  "categoryGrades": { "hierarchy": "A", "typography": "B", ... },
  "findings": [{ "id": "FINDING-001", "title": "...", "impact": "high", "category": "typography" }]
}
\`\`\`

### 评分系统

**Dual headline scores：**
- **Design Score: {A-F}**：10 个 categories 的 weighted average
- **AI Slop Score: {A-F}**：standalone grade，附 pithy verdict

**Per-category grades：**
- **A:** Intentional、polished、delightful。展现 design thinking。
- **B:** Solid fundamentals，有 minor inconsistencies。看起来 professional。
- **C:** Functional but generic。没有 major problems，也没有 design point of view。
- **D:** 有明显 problems。感觉 unfinished 或 careless。
- **F:** 正在伤害 user experience。需要 significant rework。

**Grade computation：** 每个 category 从 A 开始。每个 High-impact finding 降一个 letter grade。每个 Medium-impact finding 降半个 letter grade。Polish findings 会记录，但不影响 grade。最低为 F。

**Category weights for Design Score：**
| Category | Weight |
|----------|--------|
| Visual Hierarchy | 15% |
| Typography | 15% |
| Spacing & Layout | 15% |
| Color & Contrast | 10% |
| Interaction States | 10% |
| Responsive | 10% |
| Content Quality | 10% |
| AI Slop | 5% |
| Motion | 5% |
| Performance Feel | 5% |

AI Slop 占 Design Score 的 5%，但也作为 headline metric 独立评分。

### Regression 输出

当 previous \`design-baseline.json\` 存在，或使用 \`--regression\` flag 时：
- Load baseline grades
- Compare：per-category deltas、new findings、resolved findings
- Append regression table to report

---

## Design Critique Format

使用 structured feedback，而不是泛泛 opinions：
- "I notice..."：observation（例如 "I notice the primary CTA competes with the secondary action"）
- "I wonder..."：question（例如 "I wonder if users will understand what 'Process' means here"）
- "What if..."：suggestion（例如 "What if we moved search to a more prominent position?"）
- "I think... because..."：reasoned opinion（例如 "I think the spacing between sections is too uniform because it doesn't create hierarchy"）

把所有内容都连到 user goals 和 product objectives。指出 problems 时，总是同时建议 specific improvements。

---

## 重要规则

1. **像 designer 一样思考，不像 QA engineer。** 你关心东西是否 feel right、look intentional、respect the user。不只是关心它是否 "work"。
2. **Screenshots are evidence。** 每个 finding 至少需要一张 screenshot。使用 annotated screenshots（\`snapshot -a\`）highlight elements。
3. **具体且 actionable。** "Change X to Y because Z"，而不是 "the spacing feels off"。
4. **不要读取 source code。** 评估 rendered site，而不是 implementation。（例外：可提议从 extracted observations 写 DESIGN.md。）
5. **AI Slop detection 是你的 superpower。** 大多数 developers 无法判断他们的 site 是否看起来 AI-generated。你可以。直接说。
6. **Quick wins matter。** 始终包含 "Quick Wins" section：3-5 个最高 impact、每个 <30 分钟的 fixes。
7. **用 \`snapshot -C\` 处理 tricky UIs。** 它能发现 accessibility tree 漏掉的 clickable divs。
8. **Responsive 是 design，不只是 "not broken"。** Mobile 上 stacked desktop layout 不是 responsive design，而是 lazy。评估 mobile layout 是否有 *design* sense。
9. **Incremental document。** 发现每个 finding 时就写入 report。不要 batch。
10. **Depth over breadth。** 5-10 个有 screenshots 和 specific suggestions 的 well-documented findings > 20 个 vague observations。
11. **向用户展示 screenshots。** 每次运行 \`$B screenshot\`、\`$B snapshot -a -o\` 或 \`$B responsive\` 后，用 Read tool 读取 output file(s)，让用户能 inline 看到。对 \`responsive\`（3 个 files），三个都 Read。这很关键：否则 screenshots 对用户不可见。`;
}

export function generateDesignSketch(_ctx: TemplateContext): string {
  return `## Visual Sketch（仅 UI ideas）

如果 chosen approach 涉及 user-facing UI（screens、pages、forms、dashboards 或 interactive elements），
生成 rough wireframe 帮助用户 visualize。
如果 idea 是 backend-only、infrastructure，或没有 UI component，静默跳过此 section。

**Step 1：收集 design context**

1. 检查 repo root 中是否存在 \`DESIGN.md\`。如果存在，读取其中的 design system constraints
   （colors、typography、spacing、component patterns）。在 wireframe 中使用这些 constraints。
2. 应用 core design principles：
   - **Information hierarchy**：用户第一、第二、第三眼看到什么？
   - **Interaction states**：loading、empty、error、success、partial
   - **Edge case paranoia**：如果 name 是 47 个字符？Zero results？Network fails？
   - **Subtraction default**："as little design as possible" (Rams)。每个 element 都必须 earn its pixels。
   - **Design for trust**：每个 interface element 都会 build 或 erode user trust。

**Step 2：生成 wireframe HTML**

生成 single-page HTML file，并遵守这些 constraints：
- **Intentionally rough aesthetic**：使用 system fonts、thin gray borders、no color、hand-drawn-style elements。这是 sketch，不是 polished mockup。
- Self-contained：无 external dependencies、无 CDN links、只用 inline CSS
- 展示 core interaction flow（最多 1-3 screens/states）
- 包含 realistic placeholder content（不要用 "Lorem ipsum"，而是用匹配 actual use case 的 content）
- 添加 HTML comments 解释 design decisions

写入 temp file：
\`\`\`bash
SKETCH_FILE="/tmp/gstack-sketch-$(date +%s).html"
\`\`\`

**Step 3：Render and capture**

\`\`\`bash
$B goto "file://$SKETCH_FILE"
$B screenshot /tmp/gstack-sketch.png
\`\`\`

如果 \`$B\` 不 available（browse binary 未设置），跳过 render step。告诉用户：
"Visual sketch requires the browse binary. Run the setup script to enable it."（保留 exact status text；中文语义：visual sketch 需要 browse binary，请运行 setup script 启用。）

**Step 4：展示并 iterate**

向用户展示 screenshot。询问："Does this feel right? Want to iterate on the layout?"

如果用户想改，根据 feedback regenerate HTML 并 re-render。
如果用户 approve 或说 "good enough"，继续。

**Step 5：纳入 design doc**

在 design doc 的 "Recommended Approach" section（推荐方案）中引用 wireframe screenshot。
\`/tmp/gstack-sketch.png\` 中的 screenshot file 可被 downstream skills
（\`/plan-design-review\`、\`/design-review\`）引用，用来查看最初 envisioned 的内容。

**Step 6：Outside design voices**（可选）

Wireframe approved 后，提供 outside design perspectives：

\`\`\`bash
command -v codex >/dev/null 2>&1 && echo "CODEX_AVAILABLE" || echo "CODEX_NOT_AVAILABLE"
\`\`\`

如果 Codex available，使用 AskUserQuestion：
> "要为 chosen approach 获取 outside design perspectives 吗？Codex 会提出 visual thesis、content plan 和 interaction ideas。Claude subagent 会提出另一个 aesthetic direction。"
>
> A) Yes — get outside design voices
> B) No — proceed without

如果用户选择 A，同时 launch 两个 voices：

1. **Codex** (via Bash, \`model_reasoning_effort="medium"\`):
\`\`\`bash
TMPERR_SKETCH=$(mktemp /tmp/codex-sketch-XXXXXXXX)
_REPO_ROOT=$(git rev-parse --show-toplevel) || { echo "ERROR: not in a git repo" >&2; exit 1; }
codex exec "针对这个 product approach，提供：visual thesis（一句话说明 mood、material、energy）、content plan（hero → support → detail → CTA），以及 2 个会改变 page feel 的 interaction ideas。应用 beautiful defaults：composition-first、brand-first、cardless、poster not document。观点要鲜明。" -C "$_REPO_ROOT" -s read-only -c 'model_reasoning_effort="medium"' --enable web_search_cached < /dev/null 2>"$TMPERR_SKETCH"
\`\`\`
使用 5-minute timeout（\`timeout: 300000\`）。完成后：\`cat "$TMPERR_SKETCH" && rm -f "$TMPERR_SKETCH"\`

2. **Claude subagent** (via Agent tool):
"针对这个 product approach，你推荐什么 design direction？什么 aesthetic、typography 和 interaction patterns 最适合？什么会让这个 approach 对用户来说 feels inevitable？要具体：font names、hex colors、spacing values。"

在 \`CODEX SAYS (design sketch):\` 下展示 Codex output，在 \`CLAUDE SUBAGENT (design direction):\` 下展示 subagent output。
Error handling：全部 non-blocking。失败时 skip 并继续。`;
}

export function generateDesignOutsideVoices(ctx: TemplateContext): string {
  // Codex host：完全移除，Codex 不应调用自身
  if (ctx.host === 'codex') return '';

  const rejectionList = OPENAI_HARD_REJECTIONS.map((item, i) => `${i + 1}. ${item}`).join('\n');
  const litmusList = OPENAI_LITMUS_CHECKS.map((item, i) => `${i + 1}. ${item}`).join('\n');

  // Skill-specific configuration
  const isPlanDesignReview = ctx.skillName === 'plan-design-review';
  const isDesignReview = ctx.skillName === 'design-review';
  const isDesignConsultation = ctx.skillName === 'design-consultation';

  // Determine opt-in behavior and reasoning effort
  const isAutomatic = isDesignReview; // design-review 自动运行
  const reasoningEffort = isDesignConsultation ? 'medium' : 'high'; // creative vs analytical

  // Build skill-specific Codex prompt
  let codexPrompt: string;
  let subagentPrompt: string;

  if (isPlanDesignReview) {
    codexPrompt = `读取 [plan-file-path] 的 plan file。按以下标准评估这个 plan 的 UI/UX design。

HARD REJECTION — 如果任何一条适用就标记：
${rejectionList}

LITMUS CHECKS — 每一条回答 YES 或 NO：
${litmusList}

HARD RULES — 先分类为 MARKETING/LANDING PAGE、APP UI 或 HYBRID，然后标出对应规则集的违规项：
- MARKETING：首屏像一个完整 composition、brand-first hierarchy、full-bleed hero、2-3 个 intentional motions、composition-first layout
- APP UI：克制的 surface hierarchy、高密度但可读、utility language、minimal chrome
- UNIVERSAL：颜色使用 CSS variables、不要 default font stacks、每个 section 只有一个 job、cards 必须有存在理由

每个 finding 都说明：哪里错了、如果原样上线会发生什么、具体怎么修。观点要鲜明。不要含糊。`;

    subagentPrompt = `读取 [plan-file-path] 的 plan file。你是一位独立的 senior product designer，正在审查这个 plan。你没有看过任何先前 review。请评估：

1. Information hierarchy：用户第一眼、第二眼、第三眼分别看到什么？这个顺序对吗？
2. Missing states：loading、empty、error、success、partial 哪些没有说明？
3. User journey：情绪弧线是什么？在哪里断裂？
4. Specificity：plan 描述的是 SPECIFIC UI（"48px Söhne Bold header, #1a1a1a on white"）还是 generic patterns（"clean modern card-based layout"）？
5. 哪些 design decisions 如果继续模糊，会在实现时折磨 implementer？

每个 finding 都说明：哪里错了、severity（critical/high/medium）和修法。`;
  } else if (isDesignReview) {
    codexPrompt = `审查这个 repo 的 frontend source code。按这些 design hard rules 评估：
- Spacing：系统化（design tokens / CSS variables）还是 magic numbers？
- Typography：有表现力且目的明确的 fonts，还是 default stacks？
- Color：有定义好的 CSS variables system，还是散落 hardcoded hex？
- Responsive：breakpoints 是否定义？hero 是否使用 calc(100svh - header)？是否测试 mobile？
- A11y：ARIA landmarks、alt text、contrast ratios、44px touch targets？
- Motion：2-3 个 intentional animations，还是没有 / 只有装饰性 motion？
- Cards：是否只在 card IS the interaction 时使用？有没有 decorative card grids？

先分类为 MARKETING/LANDING PAGE、APP UI 或 HYBRID，再应用匹配规则。

LITMUS CHECKS — answer YES/NO:
${litmusList}

HARD REJECTION — 如果任何一条适用就标记：
${rejectionList}

要具体。每个 finding 都引用 file:line。`;

    subagentPrompt = `审查这个 repo 的 frontend source code。你是一位独立的 senior product designer，正在做 source-code design audit。重点看跨文件的 CONSISTENCY PATTERNS，而不是单个违规：
- 整个 codebase 的 spacing values 是否系统化？
- 是否有 ONE color system，还是做法分散？
- responsive breakpoints 是否遵循一致集合？
- accessibility approach 是否一致，还是时有时无？

每个 finding 都说明：哪里错了、severity（critical/high/medium）和 file:line。`;
  } else if (isDesignConsultation) {
    codexPrompt = `基于这个 product context，提出一个完整 design direction：
- Visual thesis：用一句话描述 mood、material 和 energy
- Typography：具体 font names（不是 defaults — 不要 Inter/Roboto/Arial/system）+ hex colors
- Color system：background、surface、primary text、muted text、accent 的 CSS variables
- Layout：composition-first，而不是 component-first。首屏像 poster，不像 document
- Differentiation：2 个刻意偏离 category norms 的选择
- Anti-slop：不要 purple gradients、不要 3-column icon grids、不要 everything centered、不要 decorative blobs

观点要鲜明。要具体。不要含糊。这是 YOUR design direction — 承担它。`;

    subagentPrompt = `基于这个 product context，提出一个会让人 SURPRISE 的 design direction。cool indie studio 会做什么，而 enterprise UI team 不会？
- 提出 aesthetic direction、typography stack（具体 font names）、color palette（hex values）
- 2 个刻意偏离 category norms 的选择
- 用户前 3 秒应该产生什么 emotional reaction？

大胆。具体。不要含糊。`;
  } else {
    // Unknown skill — return empty
    return '';
  }

  // Build the opt-in section
  const optInSection = isAutomatic ? `
**Automatic：** Codex 可用时，outside voices 会自动运行。不需要 opt-in。` : `
使用 AskUserQuestion：
> "要${isPlanDesignReview ? '在 detailed review 前' : ''}运行 outside design voices 吗？Codex 会按 OpenAI 的 design hard rules + litmus checks 评估；Claude subagent 会做独立的 ${isDesignConsultation ? 'design direction proposal' : 'completeness review'}。"
>
> A) Yes — run outside design voices
> B) No — proceed without

如果用户选择 B，跳过这一步并继续。`;

  // Build the synthesis section
  const synthesisSection = isPlanDesignReview ? `
**Synthesis — Litmus scorecard：**

\`\`\`
DESIGN OUTSIDE VOICES — LITMUS SCORECARD:
═══════════════════════════════════════════════════════════════
  Check                                    Claude  Codex  Consensus
  ─────────────────────────────────────── ─────── ─────── ─────────
  1. Brand unmistakable in first screen?   —       —      —
  2. One strong visual anchor?             —       —      —
  3. Scannable by headlines only?          —       —      —
  4. Each section has one job?             —       —      —
  5. Cards actually necessary?             —       —      —
  6. Motion improves hierarchy?            —       —      —
  7. Premium without decorative shadows?   —       —      —
  ─────────────────────────────────────── ─────── ─────── ─────────
  Hard rejections triggered:               —       —      —
═══════════════════════════════════════════════════════════════
\`\`\`

根据 Codex 和 subagent outputs 填写每个 cell。CONFIRMED = 两者同意。DISAGREE = models 不一致。NOT SPEC'D = 信息不足，无法评估。

**Pass integration（遵守现有 7-pass contract）：**
- Hard rejections → 作为 Pass 1 的 FIRST items 提出，标记 \`[HARD REJECTION]\`
- Litmus DISAGREE items → 在相关 pass 中带上双方视角提出
- Litmus CONFIRMED failures → 作为 known issues 预加载到相关 pass
- 对预先识别的问题，passes 可以跳过 discovery，直接进入 fixing` :
    isDesignConsultation ? `
**Synthesis：** Claude main 在 Phase 3 proposal 中引用 Codex 和 subagent 两方建议。呈现：
- 三方（Claude main + Codex + subagent）都同意的 areas
- 真正分歧，作为给用户选择的 creative alternatives
- "Codex and I agree on X. Codex suggested Y where I'm proposing Z — here's why..."` : `
**Synthesis — Litmus scorecard：**

使用与 /plan-design-review 相同的 scorecard format（见上方）。根据双方 outputs 填写。
把 findings 合并进 triage，并使用 \`[codex]\` / \`[subagent]\` / \`[cross-model]\` tags。`;

  const escapedCodexPrompt = codexPrompt.replace(/`/g, '\\`').replace(/\$/g, '\\$');

  return `## Design Outside Voices（parallel）
${optInSection}

**检查 Codex availability：**
\`\`\`bash
command -v codex >/dev/null 2>&1 && echo "CODEX_AVAILABLE" || echo "CODEX_NOT_AVAILABLE"
\`\`\`

**如果 Codex 可用**，同时启动两个 voices：

1. **Codex design voice**（通过 Bash）：
\`\`\`bash
TMPERR_DESIGN=$(mktemp /tmp/codex-design-XXXXXXXX)
_REPO_ROOT=$(git rev-parse --show-toplevel) || { echo "ERROR: not in a git repo" >&2; exit 1; }
codex exec "${escapedCodexPrompt}" -C "$_REPO_ROOT" -s read-only -c 'model_reasoning_effort="${reasoningEffort}"' --enable web_search_cached < /dev/null 2>"$TMPERR_DESIGN"
\`\`\`
使用 5-minute timeout（\`timeout: 300000\`）。命令完成后读取 stderr：
\`\`\`bash
cat "$TMPERR_DESIGN" && rm -f "$TMPERR_DESIGN"
\`\`\`

2. **Claude design subagent**（通过 Agent tool）：
用这个 prompt dispatch 一个 subagent：
"${subagentPrompt}"

**Error handling（全部 non-blocking）：**
- **Auth failure:** 如果 stderr 包含 "auth"、"login"、"unauthorized" 或 "API key"："Codex authentication failed. Run \`codex login\` to authenticate."
- **Timeout:** "Codex timed out after 5 minutes."
- **Empty response:** "Codex returned no response."
- 任何 Codex error：只使用 Claude subagent output 继续，并标记 \`[single-model]\`。
- 如果 Claude subagent 也失败："Outside voices unavailable — continuing with primary review."

在 \`CODEX SAYS (design ${isPlanDesignReview ? 'critique' : isDesignReview ? 'source audit' : 'direction'}):\` header 下呈现 Codex output。
在 \`CLAUDE SUBAGENT (design ${isPlanDesignReview ? 'completeness' : isDesignReview ? 'consistency' : 'direction'}):\` header 下呈现 subagent output。
${synthesisSection}

**记录结果：**
\`\`\`bash
${ctx.paths.binDir}/gstack-review-log '{"skill":"design-outside-voices","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","status":"STATUS","source":"SOURCE","commit":"'"$(git rev-parse --short HEAD)"'"}'
\`\`\`
将 STATUS 替换为 "clean" 或 "issues_found"，SOURCE 替换为 "codex+subagent"、"codex-only"、"subagent-only" 或 "unavailable"。`;
}

// ─── Design Hard Rules（OpenAI framework + gstack slop blacklist）───
export function generateDesignHardRules(_ctx: TemplateContext): string {
  const slopItems = AI_SLOP_BLACKLIST.map((item, i) => `${i + 1}. ${item}`).join('\n');
  const rejectionItems = OPENAI_HARD_REJECTIONS.map((item, i) => `${i + 1}. ${item}`).join('\n');
  const litmusItems = OPENAI_LITMUS_CHECKS.map((item, i) => `${i + 1}. ${item}`).join('\n');

  return `### Design Hard Rules

**Classifier — 评估前先确定 rule set：**
- **MARKETING/LANDING PAGE**（hero-driven、brand-forward、conversion-focused）→ 应用 Landing Page Rules
- **APP UI**（workspace-driven、data-dense、task-focused：dashboards、admin、settings）→ 应用 App UI Rules
- **HYBRID**（带 app-like sections 的 marketing shell）→ hero/marketing sections 应用 Landing Page Rules，functional sections 应用 App UI Rules

**Hard rejection criteria**（instant-fail patterns — 如果 ANY apply 就标记）：
${rejectionItems}

**Litmus checks**（每一条回答 YES/NO — 用于 cross-model consensus scoring）：
${litmusItems}

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
${slopItems}

Source: [OpenAI "Designing Delightful Frontends with GPT-5.4"](https://developers.openai.com/blog/designing-delightful-frontends-with-gpt-5-4)（Mar 2026）+ gstack design methodology.`;
}

export function generateDesignSetup(ctx: TemplateContext): string {
  return `## DESIGN SETUP（在任何 design mockup command 之前运行这个检查）

\`\`\`bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
D=""
[ -n "$_ROOT" ] && [ -x "$_ROOT/${ctx.paths.localSkillRoot}/design/dist/design" ] && D="$_ROOT/${ctx.paths.localSkillRoot}/design/dist/design"
[ -z "$D" ] && D="$HOME${ctx.paths.designDir.replace(/^~/, '')}/design"
if [ -x "$D" ]; then
  echo "DESIGN_READY: $D"
else
  echo "DESIGN_NOT_AVAILABLE"
fi
B=""
[ -n "$_ROOT" ] && [ -x "$_ROOT/${ctx.paths.localSkillRoot}/browse/dist/browse" ] && B="$_ROOT/${ctx.paths.localSkillRoot}/browse/dist/browse"
[ -z "$B" ] && B="$HOME${ctx.paths.browseDir.replace(/^~/, '')}/browse"
if [ -x "$B" ]; then
  echo "BROWSE_READY: $B"
else
  echo "BROWSE_NOT_AVAILABLE (will use 'open' to view comparison boards)"
fi
\`\`\`

如果 \`DESIGN_NOT_AVAILABLE\`：跳过 visual mockup generation，回退到现有
HTML wireframe approach（\`DESIGN_SKETCH\`）。Design mockups 是 progressive
enhancement，不是 hard requirement。

如果 \`BROWSE_NOT_AVAILABLE\`：使用 \`open file://...\` 代替 \`$B goto\` 打开
comparison boards。用户只需要在任意 browser 中看到 HTML file。

如果 \`DESIGN_READY\`：design binary 可用于 visual mockup generation。
Commands：
- \`$D generate --brief "..." --output /path.png\` — 生成单个 mockup
- \`$D variants --brief "..." --count 3 --output-dir /path/\` — 生成 N 个 style variants
- \`$D compare --images "a.png,b.png,c.png" --output /path/board.html --serve\` — comparison board + HTTP server
- \`$D serve --html /path/board.html\` — serve comparison board，并通过 HTTP 收集 feedback
- \`$D check --image /path.png --brief "..."\` — vision quality gate
- \`$D iterate --session /path/session.json --feedback "..." --output /path.png\` — iterate

**CRITICAL PATH RULE:** 所有 design artifacts（mockups、comparison boards、approved.json）
MUST 保存到 \`~/.gstack/projects/$SLUG/designs/\`，NEVER 保存到 \`.context/\`、
\`docs/designs/\`、\`/tmp/\` 或任何 project-local directory。Design artifacts 是 USER
data，不是 project files。它们跨 branches、conversations 和 workspaces 持久存在。`;
}

export function generateDesignMockup(ctx: TemplateContext): string {
  return `## Visual Design Exploration

\`\`\`bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
D=""
[ -n "$_ROOT" ] && [ -x "$_ROOT/${ctx.paths.localSkillRoot}/design/dist/design" ] && D="$_ROOT/${ctx.paths.localSkillRoot}/design/dist/design"
[ -z "$D" ] && D="$HOME${ctx.paths.designDir.replace(/^~/, '')}/design"
[ -x "$D" ] && echo "DESIGN_READY" || echo "DESIGN_NOT_AVAILABLE"
\`\`\`

**如果 \`DESIGN_NOT_AVAILABLE\`：** 回退到下方 HTML wireframe approach
（现有 DESIGN_SKETCH section）。Visual mockups 需要 design binary。

**如果 \`DESIGN_READY\`：** 为用户生成 visual mockup explorations。

正在生成 proposed design 的 visual mockups...（如果不需要 visuals，请说 "skip"）

**Step 1：设置 design directory**

\`\`\`bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)"
_DESIGN_DIR="$HOME/.gstack/projects/$SLUG/designs/mockup-$(date +%Y%m%d)"
mkdir -p "$_DESIGN_DIR"
echo "DESIGN_DIR: $_DESIGN_DIR"
\`\`\`

**Step 2：构建设计 brief**

如果 DESIGN.md 存在，先读取它 — 用它约束 visual style。如果没有 DESIGN.md，
则在多种 directions 中广泛探索。

**Step 3：生成 3 个 variants**

\`\`\`bash
$D variants --brief "<assembled brief>" --count 3 --output-dir "$_DESIGN_DIR/"
\`\`\`

这会基于同一个 brief 生成 3 个 style variations（总计约 40 秒）。

**Step 4：先 inline 展示 variants，再打开 comparison board**

先把每个 variant inline 展示给用户（用 Read tool 读取 PNGs），然后
创建并 serve comparison board：

\`\`\`bash
$D compare --images "$_DESIGN_DIR/variant-A.png,$_DESIGN_DIR/variant-B.png,$_DESIGN_DIR/variant-C.png" --output "$_DESIGN_DIR/design-board.html" --serve
\`\`\`

这会在用户默认 browser 中打开 board，并阻塞直到收到 feedback。
读取 stdout 中的 structured JSON result。不需要 polling。

如果 \`$D serve\` 不可用或失败，回退到 AskUserQuestion：
"我已经打开 design board。你更喜欢哪个 variant？还有什么 feedback？"

**Step 5：处理 feedback**

如果 JSON 包含 \`"regenerated": true\`：
1. 读取 \`regenerateAction\`（remix requests 则读取 \`remixSpec\`）
2. 使用 updated brief，通过 \`$D iterate\` 或 \`$D variants\` 生成新 variants
3. 用 \`$D compare\` 创建新 board
4. 将新的 HTML POST 到正在运行的 board。从 stderr 解析 board URL
   （\`BOARD_URL: http://127.0.0.1:N/boards/<id>/\` — daemon path），或回退到
   legacy port（\`SERVE_STARTED: port=N\` — 仅在 \`--no-daemon\` 下输出，
   命中 \`/api/reload\` root）。Daemon path：
   \`curl -X POST "\${BOARD_URL}api/reload" -H 'Content-Type: application/json' -d '{"html":"$_DESIGN_DIR/design-board.html"}'\`
5. Board 会在同一个 tab 自动刷新

如果 \`"regenerated": false\`：继续使用 approved variant。

**Step 6：保存 approved choice**

\`\`\`bash
echo '{"approved_variant":"<VARIANT>","feedback":"<FEEDBACK>","date":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","screen":"mockup","branch":"'$(git branch --show-current 2>/dev/null)'"}' > "$_DESIGN_DIR/approved.json"
\`\`\`

在 design doc 或 plan 中引用保存好的 mockup。`;
}

export function generateDesignShotgunLoop(_ctx: TemplateContext): string {
  return `### Comparison Board + Feedback Loop

创建 comparison board，并通过 HTTP serve：

\`\`\`bash
$D compare --images "$_DESIGN_DIR/variant-A.png,$_DESIGN_DIR/variant-B.png,$_DESIGN_DIR/variant-C.png" --output "$_DESIGN_DIR/design-board.html" --serve
\`\`\`

这个 command 会生成 board HTML，在随机 port 启动 HTTP server，
并在用户默认 browser 中打开。用 \`&\` **后台运行它**，
因为用户与 board 交互时 server 需要保持运行。

从 stderr output 解析 board URL。默认 daemon path：
\`BOARD_URL: http://127.0.0.1:N/boards/<id>/\`（已经包含 per-board
path；既用于 AskUserQuestion URL，也作为 reload endpoint 的 base）。
Legacy \`--no-daemon\` path 会输出 \`SERVE_STARTED: port=XXXXX\`，
并在 \`/\` serve 单个 board，reload 位于 \`/api/reload\` — 只有外部 caller
显式传入 \`--no-daemon\` 时才相关。

**PRIMARY WAIT：带 board URL 的 AskUserQuestion**

board serving 后，使用 AskUserQuestion 等待用户。包含 board URL，
这样如果 browser tab 丢了，他们还能点击打开：

"我已经打开包含 design variants 的 comparison board：
<BOARD_URL> — 请评分、留下 comments、remix 你喜欢的 elements，完成后点击 Submit。
提交 feedback 后告诉我（或直接把偏好粘贴在这里）。如果你在 board 上点击了
Regenerate 或 Remix，也告诉我，我会生成新的 variants。"

将 \`<BOARD_URL>\` 替换为从 stderr 解析出的 URL（daemon path 会输出
\`BOARD_URL: http://127.0.0.1:N/boards/<id>/\`）。

**不要用 AskUserQuestion 询问用户更喜欢哪个 variant。** Comparison
board 本身就是 chooser。AskUserQuestion 只是 blocking wait mechanism。

**用户响应 AskUserQuestion 后：**

检查 board HTML 旁边的 feedback files：
- \`$_DESIGN_DIR/feedback.json\` — 用户点击 Submit（final choice）时写入
- \`$_DESIGN_DIR/feedback-pending.json\` — 用户点击 Regenerate/Remix/More Like This 时写入

\`\`\`bash
if [ -f "$_DESIGN_DIR/feedback.json" ]; then
  echo "SUBMIT_RECEIVED"
  cat "$_DESIGN_DIR/feedback.json"
elif [ -f "$_DESIGN_DIR/feedback-pending.json" ]; then
  echo "REGENERATE_RECEIVED"
  cat "$_DESIGN_DIR/feedback-pending.json"
  rm "$_DESIGN_DIR/feedback-pending.json"
else
  echo "NO_FEEDBACK_FILE"
fi
\`\`\`

feedback JSON 形状如下：
\`\`\`json
{
  "preferred": "A",
  "ratings": { "A": 4, "B": 3, "C": 2 },
  "comments": { "A": "Love the spacing" },
  "overall": "Go with A, bigger CTA",
  "regenerated": false
}
\`\`\`

**如果找到 \`feedback.json\`：** 用户在 board 上点击了 Submit。
从 JSON 读取 \`preferred\`、\`ratings\`、\`comments\`、\`overall\`。继续使用
approved variant。

**如果找到 \`feedback-pending.json\`：** 用户在 board 上点击了 Regenerate/Remix。
1. 从 JSON 读取 \`regenerateAction\`（\`"different"\`、\`"match"\`、\`"more_like_B"\`、
   \`"remix"\` 或 custom text）
2. 如果 \`regenerateAction\` 是 \`"remix"\`，读取 \`remixSpec\`（例如 \`{"layout":"A","colors":"B"}\`）
3. 使用 updated brief，通过 \`$D iterate\` 或 \`$D variants\` 生成新 variants
4. 创建新 board：\`$D compare --images "..." --output "$_DESIGN_DIR/design-board.html"\`
5. 在用户 browser（同一个 tab）中 reload board — daemon mode 下 URL 是 per-board，
   所以使用 \`<BOARD_URL>\`（来自 \`BOARD_URL:\` stderr line）作为 base：
   \`curl -s -X POST "\${BOARD_URL}api/reload" -H 'Content-Type: application/json' -d '{"html":"$_DESIGN_DIR/design-board.html"}'\`
   在 \`--no-daemon\` 下，reload endpoint 是 legacy port 的 \`/api/reload\`；
   只有 caller 显式 opt out daemon 时这个 path 才相关。
6. Board 自动刷新。用相同 board URL **再次 AskUserQuestion**，等待下一轮
   feedback。重复直到 \`feedback.json\` 出现。

**如果 \`NO_FEEDBACK_FILE\`：** 用户没有使用 board，而是直接在
AskUserQuestion response 中输入偏好。将他们的 text response 作为 feedback。

**POLLING FALLBACK：** 只有 \`$D serve\` 失败（没有可用 port）时才使用 polling。
这种情况下，用 Read tool inline 展示每个 variant（确保用户能看到），
然后使用 AskUserQuestion：
"Comparison board server 启动失败。我已经在上方展示了 variants。
你更喜欢哪个？还有什么 feedback？"

**收到 feedback 后（任一路径）：** 输出清晰 summary，确认理解内容：

"这是我从你的 feedback 中理解到的内容：
PREFERRED: Variant [X]
RATINGS: [list]
YOUR NOTES: [comments]
DIRECTION: [overall]

这样理解对吗？"

继续前用 AskUserQuestion 验证。

**保存 approved choice：**
\`\`\`bash
echo '{"approved_variant":"<V>","feedback":"<FB>","date":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","screen":"<SCREEN>","branch":"'$(git branch --show-current 2>/dev/null)'"}' > "$_DESIGN_DIR/approved.json"
\`\`\``;
}

export function generateTasteProfile(ctx: TemplateContext): string {
  return `如果 persistent taste profile 存在，读取它：

\`\`\`bash
_TASTE_PROFILE=~/.gstack/projects/$SLUG/taste-profile.json
if [ -f "$_TASTE_PROFILE" ]; then
  # Schema v1: { dimensions: { fonts, colors, layouts, aesthetics }, sessions: [] }
  # Each dimension has approved[] and rejected[] entries with
  # { value, confidence, approved_count, rejected_count, last_seen }
  # Confidence decays 5% per week of inactivity — computed at read time.
  cat "$_TASTE_PROFILE" 2>/dev/null | head -200
  echo "TASTE_PROFILE_FOUND"
else
  echo "NO_TASTE_PROFILE"
fi
\`\`\`

**如果 TASTE_PROFILE_FOUND：** 总结最强 signals（每个 dimension 按 confidence * approved_count
排序的 top 3 approved entries）。将它们纳入 design brief：

"基于 ${'\\${SESSION_COUNT}'} 次 prior sessions，这位用户的 taste 倾向于：
fonts [top-3]、colors [top-3]、layouts [top-3]、aesthetics [top-3]。除非用户明确要求不同方向，
generation 应向这些偏好倾斜。也要避开他们强烈 rejected 的方向：[top-3 rejected per dimension]。"

**如果 NO_TASTE_PROFILE：** 回退到 per-session approved.json files（legacy）。

**Conflict handling：** 如果当前 user request 与 strong persistent signal 冲突
（例如 taste profile 强烈偏好 minimal，但用户说 "make it playful"），标出：
"Note：你的 taste profile 强烈偏好 minimal。你这次要求 playful，我会继续；你希望我更新 taste profile，还是把这次当作 one-off？"

**Decay：** Confidence scores 每周衰减 5%。一个 6 个月前被批准、已有
10 次 approvals 的 font，权重低于上周刚批准的 font。衰减计算发生在
read time，而不是 write time，因此文件只在变化时增长。

**Schema migration：** 如果文件没有 \`version\` field 或为 \`version: 0\`，
它就是 legacy approved.json aggregate — \`${ctx.paths.binDir}/gstack-taste-update\`
会在下一次 write 时将它迁移到 schema v1。`;
}

// ─── UX Behavioral Foundations（Krug + HCI research）───
export function generateUXPrinciples(_ctx: TemplateContext): string {
  return `## UX Principles: 用户真实行为方式

这些 principles 决定真实用户如何与 interfaces 互动。它们是被观察到的
behavior，不是偏好。每个 design decision 之前、之中、之后都应用它们。

### The Three Laws of Usability

1. **Don't make me think.** 每个页面都应该 self-evident。如果用户停下来想
   "What do I click?" 或 "What does this mean?"，design 就失败了。
   Self-evident > self-explanatory > requires explanation。

2. **Clicks don't matter, thinking does.** 三个无需思考、毫不含糊的 clicks
   胜过一个需要思考的 click。每一步都应该像显而易见的选择，而不是 puzzle。

3. **Omit, then omit again.** 删除每个页面一半的文字，再删除剩下文字的一半。
   Happy talk（自我赞美式文本）必须消失。Instructions 必须消失。如果它们需要
   被阅读，design 就已经失败。

### 用户真实行为

- **Users scan, they don't read.** 为 scanning 设计：visual hierarchy
  （prominence = importance）、清晰定义的 areas、headings 和 bullet lists、
  高亮的 key terms。我们设计的是 60 mph 掠过的 billboards，不是用户会细读的
  product brochures。
- **Users satisfice.** 他们选择第一个足够合理的选项，而不是最佳选项。
  让正确选择成为最显眼的选择。
- **Users muddle through.** 他们不会弄清楚东西如何运作。他们会直接试。
  如果他们误打误撞完成目标，就不会寻找 "right" way。一旦找到可行方法，
  无论多糟，都会坚持使用。
- **Users don't read instructions.** 他们会直接进入。Guidance 必须简短、
  及时、不可错过，否则就不会被看见。

### Interface 的 Billboard Design

- **Use conventions.** Logo 在 top-left，nav 在 top/left，search = magnifying glass。
  不要为了聪明而创新 navigation。只有在你 KNOW 有更好想法时才创新，否则使用
  conventions。即使跨语言和文化，web conventions 也能让人识别 logo、nav、
  search 和 main content。
- **Visual hierarchy is everything.** 相关内容在视觉上 grouped。嵌套内容被
  contained。越重要 = 越 prominent。如果所有东西都在喊，就什么也听不见。
  从“所有东西都是 visual noise，有罪直到证明无罪”的假设开始。
- **Make clickable things obviously clickable.** 不要依赖 hover states 来提高
  discoverability，尤其 mobile 没有 hover。Shape、location 和 formatting
  （color、underlining）必须在无需 interaction 的情况下传达 clickability。
- **Eliminate noise.** 三个来源：太多东西争抢注意力（shouting）、组织不合逻辑
  （disorganization）、内容太多（clutter）。通过移除解决 noise，而不是添加。
- **Clarity trumps consistency.** 如果为了显著提高清晰度需要轻微不一致，
  每次都选择 clarity。

### Navigation as Wayfinding

Web 用户没有 scale、direction 或 location 感。Navigation 必须始终回答：
这是什么 site？我在哪个 page？主要 sections 是什么？我在这一层有哪些 options？
我在哪里？如何 search？

每个页面都有 persistent navigation。深层 hierarchy 使用 breadcrumbs。
当前 section 要视觉标识。"trunk test"：遮住 navigation 以外的一切。你仍应知道
这是什么 site、当前是什么 page、主要 sections 是什么。如果不能，navigation 就失败了。

### The Goodwill Reservoir

用户一开始带着一池 goodwill。每个 friction point 都会消耗它。

**Deplete faster:** 隐藏用户想要的信息（pricing、contact、shipping）。
因为用户没有按你的方式做事而惩罚他们（phone numbers 的 formatting requirements）。
索要不必要信息。把噱头挡在用户面前（splash screens、forced tours、interstitials）。
不专业或粗糙的外观。

**Replenish:** 理解用户想做什么，并让它 obvious。提前告诉他们想知道的信息。
尽可能节省步骤。让 error recovery 变容易。拿不准时，道歉。

### Mobile: Same Rules, Higher Stakes

以上全部适用于 mobile，而且更严格。Real estate 稀缺，但绝不能为了节省空间牺牲
usability。Affordances 必须 VISIBLE：没有 cursor 就意味着不能靠 hover-to-discover。
Touch targets 必须足够大（44px minimum）。Flat design 可能剥掉暗示 interactivity 的
有用视觉信息。无情优先排序：赶时间时需要的东西放在触手可及处，其他内容离用户几次
tap，但必须有 obvious path 可达。`;
}
