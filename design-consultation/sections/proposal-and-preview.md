<!-- AUTO-GENERATED from proposal-and-preview.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
## Phase 3: The Complete Proposal（完整提案）

这是本 skill 的核心。把所有内容作为一个 coherent package 一次性提出。

**AskUserQuestion Q2 — 以 SAFE/RISK breakdown 呈现完整提案：**

```
Based on [product context] and [research findings / my design knowledge]:

AESTHETIC: [direction] — [one-line rationale]
DECORATION: [level] — [why this pairs with the aesthetic]
LAYOUT: [approach] — [why this fits the product type]
COLOR: [approach] + proposed palette (hex values) — [rationale]
TYPOGRAPHY: [3 font recommendations with roles] — [why these fonts]
SPACING: [base unit + density] — [rationale]
MOTION: [approach] — [rationale]

This system is coherent because [explain how choices reinforce each other].

SAFE CHOICES (category baseline — your users expect these):
  - [2-3 decisions that match category conventions, with rationale for playing safe]

RISKS (where your product gets its own face):
  - [2-3 deliberate departures from convention]
  - For each risk: what it is, why it works, what you gain, what it costs

The safe choices keep you literate in your category. The risks are where
your product becomes memorable. Which risks appeal to you? Want to see
different ones? Or adjust anything else?
```

SAFE/RISK breakdown 很关键。Design coherence 只是基本门槛，同一 category 里的每个产品都可以 coherent，却仍然长得一模一样。真正的问题是：你在哪些地方承担 creative risks？Agent 必须始终提出至少 2 个 risks，并清楚解释为什么这个 risk 值得、用户能得到什么、要放弃什么。Risks 可以包括：对该 category 来说意外的 typeface、别人不用的 bold accent color、比行业常态更紧或更松的 spacing、跳出 convention 的 layout approach、能增加 personality 的 motion choices。

**Options:** A) Looks great — generate the preview page. B) I want to adjust [section]. C) I want different risks — show me wilder options. D) Start over with a different direction. E) Skip the preview, just write DESIGN.md.

### Your Design Knowledge（用于形成提案，不要以表格展示）

**Aesthetic directions**（选择最适合该 product 的方向）:
- Brutally Minimal — 只用 type 和 whitespace。无 decoration。Modernist。
- Maximalist Chaos — Dense、layered、pattern-heavy。Y2K meets contemporary。
- Retro-Futuristic — Vintage tech nostalgia。CRT glow、pixel grids、warm monospace。
- Luxury/Refined — Serifs、high contrast、generous whitespace、precious metals。
- Playful/Toy-like — Rounded、bouncy、bold primaries。Approachable and fun。
- Editorial/Magazine — Strong typographic hierarchy、asymmetric grids、pull quotes。
- Brutalist/Raw — Exposed structure、system fonts、visible grid、no polish。
- Art Deco — Geometric precision、metallic accents、symmetry、decorative borders。
- Organic/Natural — Earth tones、rounded forms、hand-drawn texture、grain。
- Industrial/Utilitarian — Function-first、data-dense、monospace accents、muted palette。

**Decoration levels:** minimal（typography 承担所有表达）/ intentional（subtle texture、grain 或 background treatment）/ expressive（完整 creative direction、layered depth、patterns）

**Layout approaches:** grid-disciplined（严格 columns、predictable alignment）/ creative-editorial（asymmetry、overlap、grid-breaking）/ hybrid（app 用 grid，marketing 用 creative）

**Color approaches:** restrained（1 个 accent + neutrals，color 稀少且有明确意义）/ balanced（primary + secondary，用 semantic colors 建立 hierarchy）/ expressive（color 是主要 design tool，bold palettes）

**Motion approaches:** minimal-functional（只保留有助理解的 transitions）/ intentional（subtle entrance animations、meaningful state transitions）/ expressive（full choreography、scroll-driven、playful）

**Font recommendations by purpose:**
- Display/Hero: Satoshi, General Sans, Instrument Serif, Fraunces, Clash Grotesk, Cabinet Grotesk
- Body: Instrument Sans, DM Sans, Source Sans 3, Geist, Plus Jakarta Sans, Outfit
- Data/Tables: Geist (tabular-nums), DM Sans (tabular-nums), JetBrains Mono, IBM Plex Mono
- Code: JetBrains Mono, Fira Code, Berkeley Mono, Geist Mono

**Font blacklist**（永不推荐）:
Papyrus, Comic Sans, Lobster, Impact, Jokerman, Bleeding Cowboys, Permanent Marker, Bradley Hand, Brush Script, Hobo, Trajan, Raleway, Clash Display, Courier New (for body)

**Overused fonts**（永不作为 primary 推荐，除非用户明确要求）:
Inter, Roboto, Arial, Helvetica, Open Sans, Lato, Montserrat, Poppins, Space Grotesk.

Space Grotesk 在列表里，是因为每个 AI design tool 都会把它收敛成 "the safe alternative to Inter"。这就是 convergence trap。像对待 Inter 一样对待它：只有用户点名时才用。

**Anti-convergence directive:** 同一项目的多次 generations 中，要变化 light/dark、fonts 和 aesthetic directions。没有明确 justification 时，不要连续两次提出相同 choices。如果用户之前 session 用的是 Geist + dark + editorial，这次就提出不同组合（或明确说明你在 doubling down，因为它确实适合 brief）。跨 generations 的收敛就是 slop。

**AI slop anti-patterns**（永远不要纳入推荐）:
- 默认使用 purple/violet gradients 作为 accent
- 3-column feature grid，icons 放在 colored circles 里
- 所有内容居中，spacing 统一无变化
- 所有元素统一 bubbly border-radius
- Gradient buttons 作为 primary CTA pattern
- Generic stock-photo-style hero sections
- system-ui / -apple-system 作为 primary display 或 body font（"I gave up on typography" signal）
- "Built for X" / "Designed for Y" marketing copy patterns

### Coherence Validation（一致性校验）

当用户覆盖某个 section 时，检查其他部分是否仍然 coherent。用温和提示指出 mismatch，不要 block：

- Brutalist/Minimal aesthetic + expressive motion -> "Heads up: brutalist aesthetics usually pair with minimal motion. Your combo is unusual — which is fine if intentional. Want me to suggest motion that fits, or keep it?"
- Expressive color + restrained decoration -> "Bold palette with minimal decoration can work, but the colors will carry a lot of weight. Want me to suggest decoration that supports the palette?"
- Creative-editorial layout + data-heavy product -> "Editorial layouts are gorgeous but can fight data density. Want me to show how a hybrid approach keeps both?"
- 始终接受用户最终选择。绝不拒绝继续。

---

## Phase 4: Drill-downs（仅当用户要求调整时）

当用户想修改某个具体 section，就深入该 section：

- **Fonts:** 提供 3-5 个具体 candidates 和 rationale，解释每个会唤起什么感受，并提供 preview page
- **Colors:** 提供 2-3 个 palette options（含 hex values），解释 color theory reasoning
- **Aesthetic:** 讲清哪些 directions 适合他们的 product，以及为什么
- **Layout/Spacing/Motion:** 针对他们的 product type 提供 approaches 和具体 tradeoffs

每个 drill-down 是一次 focused AskUserQuestion。用户决定后，重新检查它与系统其他部分的 coherence。

---

## Phase 5: Design System Preview（默认开启）

这一 phase 会为 proposed design system 生成 visual previews。根据 gstack designer 是否可用，走两条路径。

### Path A: AI Mockups（如果 DESIGN_READY）

生成 AI-rendered mockups，展示 proposed design system 应用于该 product 的 realistic screens。这比 HTML preview 强得多：用户能看到自己的 product 可能实际长什么样。

```bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)"
_DESIGN_DIR="$HOME/.gstack/projects/$SLUG/designs/design-system-$(date +%Y%m%d)"
mkdir -p "$_DESIGN_DIR"
echo "DESIGN_DIR: $_DESIGN_DIR"
```

用 Phase 3 proposal（aesthetic、colors、typography、spacing、layout）和 Phase 1 product context 构造 design brief：

```bash
$D variants --brief "<product name: [name]. Product type: [type]. Aesthetic: [direction]. Colors: primary [hex], secondary [hex], neutrals [range]. Typography: display [font], body [font]. Layout: [approach]. Show a realistic [page type] screen with [specific content for this product].>" --count 3 --output-dir "$_DESIGN_DIR/"
```

对每个 variant 运行 quality check：

```bash
$D check --image "$_DESIGN_DIR/variant-A.png" --brief "<the original brief>"
```

Inline 展示每个 variant（对每张 PNG 使用 Read tool）以便即时 preview。

**Before presenting to the user, self-gate:** 对每个 variant，问自己：*"Would a human designer be embarrassed to put their name on this?"* 如果答案是 yes，丢弃该 variant 并 regenerate。这是 hard gate。平庸的 AI mockup 比没有 mockup 更糟。Embarrassment triggers 包括：purple gradient hero、3-column SaaS grid、centered-everything、Inter body text、generic stock-photo vibe、system-ui font、gradient CTA button、bubble-radius everything。任何一个出现 = reject and regenerate。

告诉用户："I've generated 3 visual directions applying your design system to a realistic [product type] screen. Pick your favorite in the comparison board that just opened in your browser. You can also remix elements across variants."

### Comparison Board + Feedback Loop

创建 comparison board，并通过 HTTP serve：

```bash
$D compare --images "$_DESIGN_DIR/variant-A.png,$_DESIGN_DIR/variant-B.png,$_DESIGN_DIR/variant-C.png" --output "$_DESIGN_DIR/design-board.html" --serve
```

这个 command 会生成 board HTML，在随机 port 启动 HTTP server，
并在用户默认 browser 中打开。用 `&` **后台运行它**，
因为用户与 board 交互时 server 需要保持运行。

从 stderr output 解析 board URL。默认 daemon path：
`BOARD_URL: http://127.0.0.1:N/boards/<id>/`（已经包含 per-board
path；既用于 AskUserQuestion URL，也作为 reload endpoint 的 base）。
Legacy `--no-daemon` path 会输出 `SERVE_STARTED: port=XXXXX`，
并在 `/` serve 单个 board，reload 位于 `/api/reload` — 只有外部 caller
显式传入 `--no-daemon` 时才相关。

**PRIMARY WAIT：带 board URL 的 AskUserQuestion**

board serving 后，使用 AskUserQuestion 等待用户。包含 board URL，
这样如果 browser tab 丢了，他们还能点击打开：

"我已经打开包含 design variants 的 comparison board：
<BOARD_URL> — 请评分、留下 comments、remix 你喜欢的 elements，完成后点击 Submit。
提交 feedback 后告诉我（或直接把偏好粘贴在这里）。如果你在 board 上点击了
Regenerate 或 Remix，也告诉我，我会生成新的 variants。"

将 `<BOARD_URL>` 替换为从 stderr 解析出的 URL（daemon path 会输出
`BOARD_URL: http://127.0.0.1:N/boards/<id>/`）。

**不要用 AskUserQuestion 询问用户更喜欢哪个 variant。** Comparison
board 本身就是 chooser。AskUserQuestion 只是 blocking wait mechanism。

**用户响应 AskUserQuestion 后：**

检查 board HTML 旁边的 feedback files：
- `$_DESIGN_DIR/feedback.json` — 用户点击 Submit（final choice）时写入
- `$_DESIGN_DIR/feedback-pending.json` — 用户点击 Regenerate/Remix/More Like This 时写入

```bash
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
```

feedback JSON 形状如下：
```json
{
  "preferred": "A",
  "ratings": { "A": 4, "B": 3, "C": 2 },
  "comments": { "A": "Love the spacing" },
  "overall": "Go with A, bigger CTA",
  "regenerated": false
}
```

**如果找到 `feedback.json`：** 用户在 board 上点击了 Submit。
从 JSON 读取 `preferred`、`ratings`、`comments`、`overall`。继续使用
approved variant。

**如果找到 `feedback-pending.json`：** 用户在 board 上点击了 Regenerate/Remix。
1. 从 JSON 读取 `regenerateAction`（`"different"`、`"match"`、`"more_like_B"`、
   `"remix"` 或 custom text）
2. 如果 `regenerateAction` 是 `"remix"`，读取 `remixSpec`（例如 `{"layout":"A","colors":"B"}`）
3. 使用 updated brief，通过 `$D iterate` 或 `$D variants` 生成新 variants
4. 创建新 board：`$D compare --images "..." --output "$_DESIGN_DIR/design-board.html"`
5. 在用户 browser（同一个 tab）中 reload board — daemon mode 下 URL 是 per-board，
   所以使用 `<BOARD_URL>`（来自 `BOARD_URL:` stderr line）作为 base：
   `curl -s -X POST "${BOARD_URL}api/reload" -H 'Content-Type: application/json' -d '{"html":"$_DESIGN_DIR/design-board.html"}'`
   在 `--no-daemon` 下，reload endpoint 是 legacy port 的 `/api/reload`；
   只有 caller 显式 opt out daemon 时这个 path 才相关。
6. Board 自动刷新。用相同 board URL **再次 AskUserQuestion**，等待下一轮
   feedback。重复直到 `feedback.json` 出现。

**如果 `NO_FEEDBACK_FILE`：** 用户没有使用 board，而是直接在
AskUserQuestion response 中输入偏好。将他们的 text response 作为 feedback。

**POLLING FALLBACK：** 只有 `$D serve` 失败（没有可用 port）时才使用 polling。
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
```bash
echo '{"approved_variant":"<V>","feedback":"<FB>","date":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","screen":"<SCREEN>","branch":"'$(git branch --show-current 2>/dev/null)'"}' > "$_DESIGN_DIR/approved.json"
```

用户选定 direction 后：

- 使用 `$D extract --image "$_DESIGN_DIR/variant-<CHOSEN>.png"` 分析 approved mockup，提取将填入 DESIGN.md 的 design tokens（colors、typography、spacing）。这让 design system grounded in 用户实际批准的视觉，而不只是文字描述。
- 如果用户想继续 iterate：`$D iterate --feedback "<user's feedback>" --output "$_DESIGN_DIR/refined.png"`

**Plan mode vs. implementation mode:**
- **如果在 plan mode:** 将 approved mockup path（完整 `$_DESIGN_DIR` path）和 extracted tokens 加到 plan file 的 "## Approved Design Direction" section。Design system 会在 plan implementation 时写入 DESIGN.md。
- **如果不在 plan mode:** 直接进入 Phase 6，用 extracted tokens 写 DESIGN.md。

### Path B: HTML Preview Page（如果 DESIGN_NOT_AVAILABLE 则 fallback）

生成 polished HTML preview page 并在用户浏览器中打开。这是该 skill 产出的第一个 visual artifact，必须好看。

```bash
PREVIEW_FILE="/tmp/design-consultation-preview-$(date +%s).html"
```

把 preview HTML 写入 `$PREVIEW_FILE`，然后打开：

```bash
open "$PREVIEW_FILE"
```

### Preview Page Requirements（仅 Path B）

Agent 编写一个 **single, self-contained HTML file**（无 framework dependencies），要求：

1. 通过 `<link>` tags 从 Google Fonts（或 Bunny Fonts）加载 proposed fonts
2. 全站使用 proposed color palette —— dogfood the design system
3. Hero heading 显示 product name（不是 "Lorem Ipsum"）
4. **Font specimen section:**
   - 每个 font candidate 都以其 proposed role 展示（hero heading、body paragraph、button label、data table row）
   - 如果一个 role 有多个 candidates，side-by-side comparison
   - 使用匹配 product 的真实内容（例如 civic tech -> government data examples）
5. **Color palette section:**
   - Swatches 包含 hex values 和 names
   - 用该 palette 渲染 sample UI components：buttons（primary、secondary、ghost）、cards、form inputs、alerts（success、warning、error、info）
   - 展示 background/text color combinations 的 contrast
6. **Realistic product mockups** —— 这是 preview page 的力量来源。基于 Phase 1 的 project type，用完整 design system 渲染 2-3 个 realistic page layouts：
   - **Dashboard / web app:** 带 metrics 的 sample data table、sidebar nav、带 user avatar 的 header、stat cards
   - **Marketing site:** hero section with real copy、feature highlights、testimonial block、CTA
   - **Settings / admin:** 带 labeled inputs、toggle switches、dropdowns、save button 的 form
   - **Auth / onboarding:** login form with social buttons、branding、input validation states
   - 使用 product name、该 domain 的 realistic content，以及 proposed spacing/layout/border-radius。用户在写任何代码前就应大致看到自己的 product。
7. 使用 CSS custom properties 和 JS toggle button 提供 light/dark mode toggle
8. **Clean, professional layout** —— preview page 本身就是 skill 的 taste signal
9. **Responsive** —— 任意 screen width 都要好看

这个页面应该让用户觉得 "oh nice, they thought of this." 它通过展示 product 可能的 feel 来销售 design system，而不是只列 hex codes 和 font names。

如果 `open` 失败（headless environment），告诉用户：*"I wrote the preview to [path] — open it in your browser to see the fonts and colors rendered."*

如果用户说 skip preview，直接进入 Phase 6。

---

## Phase 6: Write DESIGN.md & Confirm

如果 Phase 5（Path A）使用了 `$D extract`，以 extracted tokens 作为 DESIGN.md values 的 primary source —— colors、typography、spacing 都要 grounded in approved mockup，而不是只依赖 text descriptions。将 extracted tokens 与 Phase 3 proposal merge（proposal 提供 rationale 和 context；extraction 提供 exact values）。

**如果在 plan mode:** 将 DESIGN.md content 写入 plan file 的 "## Proposed DESIGN.md" section。不要写实际 file；implementation time 才会写。

**如果不在 plan mode:** 在 repo root 写入 `DESIGN.md`，结构如下：

```markdown
# Design System — [Project Name]

## Product Context
- **What this is:** [1-2 sentence description]
- **Who it's for:** [target users]
- **Space/industry:** [category, peers]
- **Project type:** [web app / dashboard / marketing site / editorial / internal tool]

## Aesthetic Direction
- **Direction:** [name]
- **Decoration level:** [minimal / intentional / expressive]
- **Mood:** [1-2 sentence description of how the product should feel]
- **Reference sites:** [URLs, if research was done]

## Typography
- **Display/Hero:** [font name] — [rationale]
- **Body:** [font name] — [rationale]
- **UI/Labels:** [font name or "same as body"]
- **Data/Tables:** [font name] — [rationale, must support tabular-nums]
- **Code:** [font name]
- **Loading:** [CDN URL or self-hosted strategy]
- **Scale:** [modular scale with specific px/rem values for each level]

## Color
- **Approach:** [restrained / balanced / expressive]
- **Primary:** [hex] — [what it represents, usage]
- **Secondary:** [hex] — [usage]
- **Neutrals:** [warm/cool grays, hex range from lightest to darkest]
- **Semantic:** success [hex], warning [hex], error [hex], info [hex]
- **Dark mode:** [strategy — redesign surfaces, reduce saturation 10-20%]

## Spacing
- **Base unit:** [4px or 8px]
- **Density:** [compact / comfortable / spacious]
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64)

## Layout
- **Approach:** [grid-disciplined / creative-editorial / hybrid]
- **Grid:** [columns per breakpoint]
- **Max content width:** [value]
- **Border radius:** [hierarchical scale — e.g., sm:4px, md:8px, lg:12px, full:9999px]

## Motion
- **Approach:** [minimal-functional / intentional / expressive]
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(50-100ms) short(150-250ms) medium(250-400ms) long(400-700ms)

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| [today] | Initial design system created | Created by /design-consultation based on [product context / research] |
```

**Update CLAUDE.md**（如果不存在则创建）—— append this section：

```markdown
## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.
```

**AskUserQuestion Q-final — show summary and confirm:**

列出所有 decisions。Flag 任何使用 agent defaults、但没有被用户 explicit confirmation 的 decisions（用户应该知道自己在 ship 什么）。Options:
- A) Ship it — write DESIGN.md and CLAUDE.md
- B) I want to change something (specify what)
- C) Start over

Shipping DESIGN.md 后，如果本 session 产出了 screen-level mockups 或 page layouts（不只是 system-level tokens），建议：
"Want to see this design system as working Pretext-native HTML? Run /design-html."
