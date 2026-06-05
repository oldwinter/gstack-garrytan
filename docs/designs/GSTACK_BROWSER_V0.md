# GStack Browser V0 — The AI-Native Development Browser（AI-native 开发浏览器）

**Date（日期）：** 2026-03-30
**Author（作者）：** Garry Tan + Claude Code
**Status（状态）：** Phase 1a 已 shipped，Phase 1b in progress
**Branch（分支）：** garrytan/gstack-as-browser

## Thesis（论点）

其他所有 AI browser（Atlas、Dia、Comet、Chrome Auto Browse）都是从 consumer browser 开始，再把 AI bolt onto it。GStack Browser 反过来。它从 Claude Code 这个 runtime 出发，再给它一个 browser viewport。

Agent 是 primary citizen。Browser 是 canvas。Skills 是 first-class capabilities。你不是“使用一个带 AI help 的 browser”。你是在使用一个能看到并交互 web 的 AI。

这是 post-IDE era 的 IDE。Code 活在 terminal。Product 活在 browser。AI 同时跨两者工作。Cursor 为 text editors 做了什么，GStack Browser 就为 browser 做什么。

## 今天它是什么（Phase 1a, shipped）

一个可 double-click 的 macOS .app，把 Playwright 的 Chromium 和内置的 gstack sidebar extension 包在一起。打开后，Claude Code 能看到你的 screen、navigate pages、fill forms、take screenshots、inspect CSS、clean up overlays，并运行任何 gstack skill。全程不需要碰 terminal。

```
GStack Browser.app (389MB, 189MB DMG)
├── Compiled browse binary (58MB) — CLI + HTTP server
├── Chrome extension (172KB) — sidebar, activity feed, inspector
├── Playwright's Chromium (330MB) — the actual browser
└── Launcher script — binds project dir, sets env vars
```

Launch → Chromium opens with sidebar → extension auto-connects to browse server
→ agent ready in ~5 seconds。

## 它将成为什么

### Phase 1b：Developer UX（next）

**Command Palette（命令面板，Cmd+K）：** 核心交互。打开 fuzzy-filtered skill picker。输入 "/qa" 开始 QA testing，输入 "/investigate" debug，输入 "/ship" 创建 PR。Skills 从 browse server fetch，不是 hardcoded。Palette 是 everything 的入口。

**Quick Screenshot（快速截图，Cmd+Shift+S）：** 捕获 current viewport，并连同 "What do you see?" context pipe 到 sidebar chat。AI 分析 screenshot 并给你可执行 feedback。一键生成 visual bug report。

**Status Bar（状态栏）：** 每个 page 底部 persistent 30px bar。显示 agent status（idle/thinking）、workspace name、current branch 和 auto-detected dev servers。点击 dev server pill 即可 navigate。始终可见 AI 正在做什么的 context。

**Auto-Detect Dev Servers（自动检测开发服务器）：** Launch 时扫描 common ports（3000、3001、4200、5173、5174、8000、8080）。如果只找到一个 server，auto-navigate 到它。Status bar 中的 dev server pills 支持一键切换。

### Phase 2：BoomLooper Integration

Sidebar 连接到 BoomLooper 的 Phoenix/Elixir APIs，而不是 local `claude -p` subprocess。BoomLooper 提供：

- **Multi-agent orchestration。** 并行 spawn 5 个 agents，每个都有自己的 browser tab。一个跑 QA，一个做 design review，一个 watch regressions。
- **Docker infrastructure。** 每个 agent 获得 isolated container。Container 内的 browser 测试 dev server。无 port conflicts，无 state leakage。
- **Session persistence。** Agent conversations 穿过 browser restarts。可以从离开的地方继续。
- **Team visibility。** Teammates 可以 real-time watch 你的 agents 在做什么。像 pair programming，但 pair 是 5 个 AI agents，你是 conductor。

### Phase 3：Browse as BoomLooper Tool

Browse binary 成为 BoomLooper 中的 MCP tool。Docker containers 中的 agents 使用 browse commands 测试 dev servers、take screenshots、fill forms、verify deployments。需要 cross-platform compilation（linux-arm64/x64）。

### Phase 4：Chromium Fork（trigger-gated）

当 extension side panel 碰到 hard API limits、GStack Browser ship 给 external users、build infra 存在、business 足以 justify maintenance 时：fork Chromium。使用 Brave 的 `chromium_src` override pattern、CC-powered 6-week rebases（CC 2-4 hours vs human 1-2 weeks）。约 20-30 files modified。

### Phase 5：Native Shell

SwiftUI/AppKit app shell，带 native sidebar 和 isolated Chromium service。Full platform integration。如果 Chromium fork 包含 native sidebar，可能被 Phase 4 superseded。

## Vision：AI Browser 能做什么

### 1. 看见你所看见的

Browser 是 AI 的 eyes。它不只是看 screenshots（虽然也能这么做），还会通过 DOM access、CSS inspection、network monitoring 和 accessibility tree parsing 理解页面。AI 理解的是 page structure，而不只是 pixels。

**今天：** `snapshot` command 返回任意 page 的 accessibility-tree representation。AI 可以“see”每个 button、link、form field 和 text element。Element references（`@e1`、`@e2`）让 AI 能 click、fill 和 interact。

**下一步：** Real-time page observation。AI 会注意到 page changes、console error 和 network request failure。无需被问就能 proactive debugging。

**未来：** Visual understanding。AI 对比 before/after screenshots 来抓 visual regressions。Pixel-level design review。“This button moved 3px left and the font changed from 14px to 13px.”

### 2. 基于所见行动

不只是读取 pages，而是像 human user 一样与它们交互。

**今天：** Click、fill、select、hover、type、scroll、upload files、handle dialogs、navigate、manage tabs。全部通过 browse server 的简单 commands。

**下一步：** Multi-step user flows。“登录、前往 settings、更改 timezone、验证 confirmation message。” AI 把 commands 串起来，并在每一步 verify。

**未来：** Autonomous QA agent。“Test every link on this page. Fill every form. Try to break it.” AI 无需 script 就运行 exhaustive interaction testing。它会尝试 humans 想不到的 combinations，从而找到 human tester 会漏掉的 bugs。

### 3. 一边浏览一边写代码

这是 key differentiator。AI 可以在 browser 中看到 bug，同时在 code 中修复它。

**今天：** Sidebar chat 连接到 Claude Code。你说“this button is misaligned”，AI 读取 CSS、识别 issue 并提出 fix。`/design-review` skill 会 take screenshots、识别 visual issues，并用 before/after evidence commit fixes。

**下一步：** Live reload loop。AI 编辑 CSS/HTML，browser auto-reloads，AI visually verify fix。简单 visual fixes 不需要 human in the loop。“Fix every spacing issue on this page” 变成 30 秒 task。

**未来：** Full-stack debugging。AI 在 browser 中看到 500 error，读取 server logs，trace 到 failing line，写 fix，并在 browser 中 verify。一个 command：“This page is broken. Fix it.”

### 4. 理解整个 stack

Browser 不只是 viewport。它是通向 application health 的窗口。

**今天：**
- Console log capture — 每个 `console.log`、`console.error` 和 warning
- Network request monitoring — 每个 XHR、fetch、websocket 和 static asset
- Performance metrics — Core Web Vitals、resource timing、paint events
- Cookie and storage inspection — 读写 localStorage、sessionStorage
- CSS inspection — computed styles、box model、rule cascade

**下一步：**
- Network request replay — “用不同 params replay 这个 failing request”
- Performance regression detection — “这个 page 比昨天慢 200ms”
- Dependency auditing — “这个 page 加载了 47 个 third-party scripts”
- Accessibility auditing — “这个 form 没有 labels，这些 colors 没通过 contrast”

**未来：**
- Full application telemetry — 实时 CPU、memory、GPU usage
- Cross-browser testing — 同一 test suite 跑 Chrome、Firefox、Safari
- Real user monitoring correlation — “this bug affects 12% of production users”

### 5. Workspace Model

Browser 就是 workspace。不是 workspace 里的一个 tab，而是 workspace 本身。

**今天：** 每个 browser session 绑定到一个 project directory。Sidebar 显示 current branch。Status bar 显示 detected dev servers。

**下一步：** Multi-project support。不关闭 browser 就能在 projects 间切换。每个 project 拥有自己的 tabs、agent 和 context。像 VSCode workspaces，但属于 browser。

**未来：** Team workspaces。多个 developers 共享 browser workspace。看到彼此的 agents 正在工作。一个人 navigate，另一个人实时看 AI fix things，形成 collaborative debugging。

### 6. Skills as Browser Capabilities

每个 gstack skill 都成为 browser capability。

| Skill（技能） | Browser Capability（浏览器能力） |
|-------|-------------------|
| `/qa` | 测试每个 page → 找 bugs → 修复 → 验证 fixes |
| `/design-review` | Screenshot → analyze → fix CSS → screenshot again |
| `/investigate` | 在 browser 中看到 error → trace 到 code → fix → verify |
| `/benchmark` | 测量 page performance → detect regressions → alert |
| `/canary` | Monitor deployed site → periodic screenshot → alert on changes |
| `/ship` | Run tests → review diff → create PR → 在 browser 中 verify deployment |
| `/cso` | 在 real browser 中 audit page for XSS、open redirects、clickjacking |
| `/office-hours` | Browse competitor sites → synthesize observations → design doc |

Command palette（Cmd+K）是 hub。你不需要知道 skills 存在。输入你想要的东西，fuzzy filter 找到合适 skill，AI 带着 browser context 运行它。

### 7. Design Loop（设计循环）

AI-powered design 是 loop，不是 handoff。

```
Generate mockup (GPT Image API)
  → Review in browser (side-by-side with live site)
  → Iterate with feedback ("make the header taller")
  → Approve direction
  → Generate production HTML/CSS
  → Preview in browser
  → Fine-tune with /design-review
  → Ship
```

Browser 关闭了“Figma 里长什么样”和“production 中长什么样”之间的 gap。因为 AI 可以同时看到两者。

### 8. Security Loop（安全循环）

在 real browser 中做 CSO review，而不只是 static analysis。

- 向每个 input field 注入 XSS payloads，检查是否 execute
- 通过从 different origin replaying requests 测试 CSRF
- 通过导航到 crafted URLs 检查 open redirects
- 验证 CSP headers 是否真的 enforced（而不只是 present）
- 通过实时 manipulating cookies 和 tokens 测试 auth flows
- 通过把 site 加载到 iframe 中检查 clickjacking

Static analysis catches patterns。Browser testing catches reality。

### 9. Monitoring Loop（监控循环）

在 real browser 中做 post-deploy canary monitoring。

```
Deploy → Browser loads production URL
  → Screenshot baseline
  → Every 5 minutes: screenshot, compare, check console
  → Alert on: visual regression, new console errors, performance drop
  → Auto-rollback if critical error detected
```

Synthetic monitoring with AI judgment。不只是“page 是否 return 200”，而是“page 看起来是否正确、工作是否正确”。

## 架构

```
+-------------------------------------------------------+
|                  GStack Browser                        |
|                                                        |
|  +------------------+  +---------------------------+  |
|  |   Chromium        |  |   Extension Side Panel    |  |
|  |   (Playwright)    |  |   ├── Chat (Claude Code)  |  |
|  |                   |  |   ├── Activity Feed        |  |
|  |   ┌────────────┐  |  |   ├── Element Refs         |  |
|  |   │ Status Bar  │  |  |   ├── CSS Inspector        |  |
|  |   └────────────┘  |  |   ├── Command Palette      |  |
|  +--------┬──────────+  |   └── Settings             |  |
|           │              +-------------┬--------------+  |
+-----------┼────────────────────────────┼─────────────────+
            │                            │
            v                            v
  +---------┴-----------+    +-----------┴-----------+
  |  Browse Server      |    |  Sidebar Agent        |
  |  (HTTP + SSE)       |    |  (claude -p wrapper)  |
  |  :34567             |    |  Runs gstack skills   |
  |                     |    |  Per-tab isolation     |
  |  Commands:          |    |                       |
  |  goto, click, fill  |    |  Future: BoomLooper   |
  |  snapshot, screenshot|   |  GenServer agents     |
  |  css, inspect, eval |    |                       |
  +---------┬-----------+    +-----------┬-----------+
            │                            │
            v                            v
  +---------┴-----------+    +-----------┴-----------+
  |  User's App         |    |  Claude Code          |
  |  localhost:3000     |    |  (reads/writes code)  |
  |  (or any URL)       |    |                       |
  +---------------------+    +-----------------------+
```

## Competitive Landscape（竞争格局）

| Browser（浏览器） | Approach（路径） | Differentiator（差异点） | Weakness（弱点） |
|---------|----------|---------------|----------|
| **Atlas** | Chromium fork + AI layer | Agentic browser, "OWL" isolated Chromium | Consumer-focused，无 code integration |
| **Dia** | AI-native browser | Clean UI，为 AI interaction 构建 | 无 dev tools，无 code editing |
| **Comet** | AI browser | Multi-agent browsing | 早期阶段，dev workflow 不明确 |
| **Chrome Auto Browse** | Extension | Google 自家，deep Chrome integration | Extension-only，无 code editing |
| **Cursor** | VSCode fork + AI | Best-in-class code editing | 无 browser viewport |
| **GStack Browser** | CC runtime + browser viewport | 在 browser 中看 bug，在 code 中修复，再 verify | 当前 macOS-only，无 consumer features |

GStack Browser 不和 consumer browsers 竞争。它竞争的是在 browser 和 editor 之间切换的 workflow。目标是让这种切换消失。

## Design System（设计系统）

From DESIGN.md:
- **Primary accent:** Amber-500 (#F59E0B) — agent active、focus states、pulse
- **Background:** Zinc-950 (#09090B) through Zinc-800 (#27272A) — dark、dense
- **Typography:** JetBrains Mono（code/status）、DM Sans（UI/labels）
- **Border radius:** 8px（md）、12px（lg）、full（pills）
- **Motion:** agent active 时 pulse animation、200ms transitions
- **Layout:** Sidebar（right）、status bar（bottom）、palette（centered overlay）

## Implementation Status（实现状态）

| Component（组件） | Status（状态） | Notes（说明） |
|-----------|--------|-------|
| .app bundle | **SHIPPED** | 389MB, launches in ~5s |
| DMG packaging | **SHIPPED** | 189MB compressed |
| `GSTACK_CHROMIUM_PATH` | **SHIPPED** | Custom Chromium binary support |
| `BROWSE_EXTENSIONS_DIR` | **SHIPPED** | Extension path override |
| Auth via `/health` | **SHIPPED** | 取代 .auth.json file approach，在 server restart 时 auto-refresh |
| Build script | **SHIPPED** | `scripts/build-app.sh` |
| Model routing | **SHIPPED** | actions 用 Sonnet，analysis 用 Opus（`pickSidebarModel`） |
| Debug logging | **SHIPPED** | 40+ silent catches → prefixed console logging across 4 files |
| No idle timeout (headed) | **SHIPPED** | 只要 window 打开，browser 就保持 alive |
| Cookie import button | **SHIPPED** | One-click in sidebar footer, opens `/cookie-picker` |
| Sidebar arrow hint | **SHIPPED** | 指向 sidebar，只有 sidebar 真的打开时才隐藏 |
| 架构文档 | **SHIPPED** | `docs/designs/SIDEBAR_MESSAGE_FLOW.md` |
| Command palette | Planned | Phase 1b |
| Quick screenshot | Planned | Phase 1b |
| Status bar | Planned | Phase 1b |
| Dev server detection | Planned | Phase 1b |
| BoomLooper integration | Future（未来） | Phase 2 |
| Cross-platform | Future（未来） | Phase 3 |
| Chromium fork | Trigger-gated | Phase 4 |
| Native shell | Deferred | Phase 5 |

## 12-Month Vision（12 个月愿景）

```
今天（Phase 1）               6 个月（Phase 2-3）             12 个月（Phase 4-5）
─────────────                 ──────────────────              ────────────────────
macOS .app wrapper            BoomLooper multi-agent           Chromium fork 或
Extension sidebar             Docker containers                Native SwiftUI shell
本地 claude -p agent          Team workspaces                  Cross-platform
单个 project                  Linux/x64 browse                 Auto-update
手动 skill invocation         Autonomous QA loops              Skill marketplace
                              Performance monitoring          Plugin API
                              Real-time collaboration         Enterprise features
```

12 个月 ideal：你打开 GStack Browser，它检测你的 project、启动你的 dev server、运行 test suite，并报告哪里 broken。你说“fix it”，AI 修复每个 bug、visually verify 每个 fix，并创建 PR。你在同一个 browser 中 review PR、approve 它，然后 AI deploy 并 monitor canary。全部在一个 window 中完成。

这就是 browser as AI workspace。不是 bolt on AI 的 browser，而是 bolt on browser 的 AI。

## Review History（评审历史）

这个 plan 经历了 4 次 reviews：

1. **CEO Review**（`/plan-ceo-review`, SELECTIVE EXPANSION）— 9 个 scope proposals，3 accepted（Cmd+K、Cmd+Shift+S、status bar）、5 deferred、1 skipped
2. **Design Review**（`/plan-design-review`）— score 5/10 → 8/10，新增 9 个 design decisions，生成 2 个 approved mockups
3. **Eng Review**（`/plan-eng-review`）— 发现 4 issues，0 critical gaps，产出 test plan
4. **Codex Review**（outside voice）— 9 findings，抓到 3 critical gaps（server bundling、auth file location、project binding）。全部 resolved。

Codex review 抓到了 3 个真实 architecture gaps，而它们穿过了前 3 次 reviews。Cross-model review works。
