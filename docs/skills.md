# Skill Deep Dives（skill 深入指南）

每个 gstack skill 的详细指南：理念、工作流和示例。

| Skill | 专家角色 | 作用 |
|-------|----------------|--------------|
| [`/office-hours`](#office-hours) | **YC Office Hours** | 从这里开始。六个 forcing questions，在写代码前重构你的产品理解。它会反推 framing、挑战 premises、生成 implementation alternatives，并把 design doc 喂给所有下游 skills。 |
| [`/spec`](#spec) | **Spec Author** | 用五个阶段把模糊意图变成精确、可执行的 spec。输出可直接进入 backlog，下游 skills 可接手。末尾可选 spawn agent。 |
| [`/plan-ceo-review`](#plan-ceo-review) | **CEO / Founder** | 重新思考问题。找到 request 里隐藏的 10-star product。四种模式：Expansion、Selective Expansion、Hold Scope、Reduction。 |
| [`/plan-eng-review`](#plan-eng-review) | **Eng Manager** | 锁定 architecture、data flow、diagrams、edge cases 和 tests。把隐藏假设逼到台面上。 |
| [`/plan-design-review`](#plan-design-review) | **Senior Designer** | 交互式 plan-mode design review。每个维度 0-10 分，说明 10 分长什么样，并修正 plan。在 plan mode 中工作。 |
| [`/design-consultation`](#design-consultation) | **Design Partner** | 从零构建完整 design system。理解 landscape、提出 creative risks、生成真实 product mockups。让 design 成为所有其他 phases 的核心。 |
| [`/review`](#review) | **Staff Engineer** | 找出 CI 会放过、production 会炸的 bugs。自动修 obvious fixes，并标记 completeness gaps。 |
| [`/investigate`](#investigate) | **Debugger** | 系统化 root-cause debugging。Iron Law：不调查，不修复。追踪 data flow，测试 hypotheses，3 次 failed fixes 后停止。 |
| [`/design-review`](#design-review) | **Designer Who Codes** | Live-site visual audit + fix loop。执行 80-item audit，然后修它找到的问题。Atomic commits，before/after screenshots。 |
| [`/design-shotgun`](#design-shotgun) | **Design Explorer** | 生成多个 AI design variants，在浏览器中打开 comparison board，并迭代到你批准方向。Taste memory 会偏向你的偏好。 |
| [`/design-html`](#design-html) | **Design Engineer** | 生成 production-quality Pretext-native HTML。可基于 approved mockups、CEO plans、design reviews 或从零开始。Text resize 时会 reflow，heights 随内容调整。按 design type 智能路由 API，并检测 React/Svelte/Vue framework。 |
| [`/qa`](#qa) | **QA Lead** | 测试你的 app，找 bugs，用 atomic commits 修复并重新验证。每个 fix 自动生成 regression tests。 |
| [`/qa-only`](#qa) | **QA Reporter** | 与 `/qa` 同方法论，但只报告。适用于你只想要 bug report、不想改代码的场景。 |
| [`/scrape`](#scrape) | **Browser Data Extractor** | 从网页提取数据。首次调用用 `$B` prototype；之后对匹配意图的调用会运行已固化的 browser-skill，约 200ms。 |
| [`/skillify`](#skillify) | **Skill Codifier** | 回看你的 conversation，找到最后一个 `/scrape` prototype，合成 script + test + fixture，运行 test，并在 commit 前询问。 |
| [`/ship`](#ship) | **Release Engineer** | 同步 main、跑 tests、审查 coverage、push、open PR。如果没有 test framework，会 bootstrap。一个命令完成。 |
| [`/land-and-deploy`](#land-and-deploy) | **Release Engineer** | Merge PR，等待 CI 和 deploy，验证 production health。从“approved”到“verified in production”的一个命令。 |
| [`/canary`](#canary) | **SRE** | Post-deploy monitoring loop。用 browse daemon 监控 console errors、performance regressions 和 page failures。 |
| [`/benchmark`](#benchmark) | **Performance Engineer** | 建立 page load times、Core Web Vitals 和 resource sizes baseline。每个 PR 前后比较，并随时间追踪趋势。 |
| [`/cso`](#cso) | **Chief Security Officer** | OWASP Top 10 + STRIDE threat modeling security audit。扫描 injection、auth、crypto 和 access control issues。 |
| [`/document-release`](#document-release) | **Technical Writer** | 把所有 project docs 更新到与你刚 ship 的内容一致。自动捕捉 stale READMEs。 |
| [`/document-generate`](#document-generate) | **Technical Writer** | 从代码为 feature 生成 Diataxis docs（tutorial / how-to / reference / explanation）。 |
| [`/retro`](#retro) | **Eng Manager** | Team-aware weekly retro。包含 per-person breakdowns、shipping streaks、test health trends 和 growth opportunities。 |
| [`/browse`](#browse) | **QA Engineer** | 给 agent 眼睛。真实 Chromium browser、真实 clicks、真实 screenshots。每个 command 约 100ms。 |
| [`/setup-browser-cookies`](#setup-browser-cookies) | **Session Manager** | 把真实浏览器（Chrome、Arc、Brave、Edge）的 cookies 导入 headless session。测试 authenticated pages。 |
| [`/autoplan`](#autoplan) | **Review Pipeline** | 一个命令，完整 reviewed plan。自动运行 CEO → design → eng → DX review，并编码 decision principles。只把 taste decisions 交给你批准。 |
| [`/plan-devex-review`](#plan-devex-review) | **DX Reviewer** | Plan-stage DX review。TTHW（time-to-hello-world）、magical moments、friction points、persona traces。三种模式：Expansion、Polish、Triage。 |
| [`/devex-review`](#devex-review) | **DX Reviewer (live)** | Live developer experience audit。走真实 onboarding flow，测量 TTHW，抓出 docs lies。 |
| [`/plan-tune`](#plan-tune) | **Question Tuner** | 按 question 自调 AskUserQuestion sensitivity。把 questions 标记为 never-ask、always-ask 或 only-for-one-way。 |
| [`/spec`](#spec) | **Spec Author** | 用五阶段把模糊意图变成精确、可执行的 spec。创建 GitHub issue，可选在 fresh worktree 中 spawn Claude Code agent，并让 `/ship` 在 merge 时关闭 source issue。 |
| [`/learn`](#learn) | **Memory** | 管理 gstack 跨 sessions 学到的内容。Review、search、prune、export project-specific patterns and preferences。 |
| [`/context-save`](#context-save) | **Save State** | 保存 working context（git state、decisions、remaining work），让未来任何 session 都能 resume。 |
| [`/context-restore`](#context-restore) | **Restore State** | 从 saved context 恢复，即使跨 Conductor workspace handoffs。 |
| [`/health`](#health) | **Code Quality Dashboard** | 包装 type checker、linter、tests、dead code detection。计算加权 0-10 score，并追踪趋势。 |
| [`/landing-report`](#landing-report) | **Ship Queue Dashboard** | Workspace-aware ship queue 的只读 snapshot。哪些 version slots 已 claimed，哪些 sibling workspaces 有 WIP。 |
| [`/benchmark-models`](#benchmark-models) | **Model Benchmark** | Skills 的 side-by-side cross-model benchmark（Claude vs GPT vs Gemini）。Latency、tokens、cost，可选 LLM-judged quality。 |
| | | |
| **Multi-AI** | | |
| [`/codex`](#codex) | **Second Opinion** | 来自 OpenAI Codex CLI 的独立 review。三种模式：code review（pass/fail gate）、adversarial challenge、带 session continuity 的 open consultation。当 `/review` 和 `/codex` 都跑过时做 cross-model analysis。 |
| [`/pair-agent`](#pair-agent) | **Remote Agent Bridge** | 把 remote AI agent（OpenClaw、Codex、Cursor、Hermes）与你的 browser 配对。Scoped tunnel、locked allowlist、session token。 |
| [`/setup-gbrain`](#setup-gbrain) | **Memory Sync** | 设置 gbrain，用于 cross-machine session memory sync。从零到 live，一个命令。 |
| [`/sync-gbrain`](#sync-gbrain) | **Keep Brain Current** | 针对此 repo 的代码 refresh gbrain；教 agent 何时用 `gbrain search`/`code-def` 而不是 Grep。Idempotent；可安全重跑。 |
| | | |
| **Safety & Utility** | | |
| [`/careful`](#safety--guardrails) | **Safety Guardrails** | 在 destructive commands（rm -rf、DROP TABLE、force-push、git reset --hard）前 warning。任何 warning 都可 override。常见 build cleanup 已 whitelist。 |
| [`/freeze`](#safety--guardrails) | **Edit Lock** | 把所有 file edits 限制到单个 directory。阻止 boundary 外的 Edit 和 Write。用于 debugging 的 accident prevention。 |
| [`/guard`](#safety--guardrails) | **Full Safety** | 一个命令组合 `/careful` + `/freeze`。Prod work 的最大安全模式。 |
| [`/unfreeze`](#safety--guardrails) | **Unlock** | 移除 `/freeze` boundary，允许再次 everywhere edits。 |
| [`/open-gstack-browser`](#open-gstack-browser) | **GStack Browser** | 启动带 sidebar、anti-bot stealth、auto model routing、cookie import 和 Claude Code integration 的 GStack Browser。实时观看每个 action。 |
| [`/setup-deploy`](#setup-deploy) | **Deploy Configurator** | `/land-and-deploy` 的一次性 setup。检测 platform、production URL 和 deploy commands。 |
| [`/gstack-upgrade`](#gstack-upgrade) | **Self-Updater** | 将 gstack 升级到最新版本。检测 global vs vendored install，同步两者，显示 changed 内容。 |
| [`/make-pdf`](#make-pdf) | **PDF Generator** | 把任意 markdown file 转为 publication-quality PDF。正确 margins、page numbers、cover pages、clickable TOC。 |
| [`/ios-qa`](#ios-qa) | **iOS QA Lead** | 通过 USB CoreDevice tunnel + embedded StateServer 做 live-device iOS QA。读取 Swift source、codegen accessors、驱动真实 iPhone。可选通过 Tailscale 暴露给 remote agents。 |
| [`/ios-fix`](#ios-fix) | **iOS Autonomous Fixer** | 在真实 iPhone 上闭环 find→fix→verify。捕获 reproducing snapshot、修 source、rebuild、redeploy、verify。 |
| [`/ios-design-review`](#ios-design-review) | **iOS Designer's Eye** | 在真实 iPhone 上做 10-dimension Apple HIG audit。给每个 screen 打分，并说明如何到 10。 |
| [`/ios-clean`](#ios-clean) | **iOS Bridge Cleanup** | Convenience wrapper，用于移除 DebugBridge SPM + `#if DEBUG` wiring。结构性 Release-build guard 位于 Package.swift + CI；此 skill 用于 guided manual removals。 |
| [`/ios-sync`](#ios-sync) | **iOS Bridge Resync** | 针对最新 upstream gstack regenerate accessors 和 Swift templates。添加新的 `@Observable` classes 或升级 gstack 后运行。 |

---

## `/office-hours`

每个项目都应该从这里开始。

在 plan 之前，在 review 之前，在写代码之前，先和一位 YC-style partner 坐下来，想清楚你到底在构建什么。不是你以为自己在构建什么，而是你**实际上**在构建什么。

### The reframe（重新框定）

真实项目中发生过这样的事。用户说：“我想为自己的日历做一个 daily briefing app。”听起来很合理。然后 skill 追问痛点：要具体 examples，不要 hypotheticals。用户描述了 assistant 会漏事、多个 Google accounts 的 calendar items 信息过期、prep docs 是 AI slop、events 的 location 错误且很难追踪。

它回应说：*“我要推一下这个 framing，因为我觉得你已经超越它了。你说的是『用于管理多个 Google Calendar 的 daily briefing app』，但你实际描述的是 personal chief of staff AI。”*

然后它提取出五个用户自己都没意识到正在描述的 capabilities：

1. **Watches your calendar（看住你的日历）**：跨所有 accounts 检测 stale info、missing locations、permission gaps
2. **Generates real prep work（生成真正的准备工作）**：不是 logistics summaries，而是为 board meeting、podcast、fundraiser 准备的**智力工作**
3. **Manages your CRM（管理你的 CRM）**：你要见谁、关系是什么、对方想要什么、历史是什么
4. **Prioritizes your time（为你的时间排序）**：标记哪些 prep 需要提前开始，主动 block time，按重要性排序 events
5. **Trades money for leverage（用钱换 leverage）**：主动寻找可 delegate 或 automate 的方式

这个 reframe 改变了整个项目。他们本来要做 calendar app。现在他们在做价值高十倍的东西，因为 skill 听的是他们的痛点，不是 feature request。

### Premise challenge（前提挑战）

Reframe 之后，它会给出 premises 让你 validate。不是“听起来好吗？”，而是关于 product 的可证伪 claims：

1. Calendar 是 anchor data source，但价值在其上的 intelligence layer
2. Assistant 不会被替代，而是被 superpowered
3. 最窄 wedge 是一个真正可用的 daily briefing
4. CRM integration 是 must-have，不是 nice-to-have

你可以同意、不同意或调整。你接受的每个 premise 都会成为 design doc 的 load-bearing 部分。

### Implementation alternatives（实现替代方案）

然后它生成 2-3 个具体 implementation approaches，并给出诚实 effort estimates：

- **Approach A: Daily Briefing First** — 最窄 wedge，明天可 ship，M effort（human: ~3 weeks / CC: ~2 days）
- **Approach B: CRM-First** — 先构建 relationship graph，L effort（human: ~6 weeks / CC: ~4 days）
- **Approach C: Full Vision** — 全部同时做，XL effort（human: ~3 months / CC: ~1.5 weeks）

推荐 A，因为你可以从真实使用中学习。CRM data 会在第二周自然出现。

### Two modes（两种模式）

**Startup mode** — 适用于正在 building a business 的创始人和 intrapreneurs。你会得到从 YC partners 评估 products 的方式中提炼出的六个 forcing questions：demand reality、status quo、desperate specificity、narrowest wedge、observation & surprise、future-fit。这些问题是故意让人不舒服的。如果你说不出具体哪个人需要你的 product，那就是写任何代码前最重要的学习。

**Builder mode** — 适用于 hackathons、side projects、open source、learning 和 having fun。你会得到一个热情的 collaborator，帮你找到 idea 最酷的版本。什么会让人说 “whoa”？最快能分享出去的路径是什么？这些 questions 是 generative，不是 interrogative。

### The design doc（设计文档）

两种模式都会以写到 `~/.gstack/projects/` 的 design doc 结束，而且该 doc 会直接喂给 `/plan-ceo-review` 和 `/plan-eng-review`。完整生命周期现在是：`office-hours → plan → implement → review → QA → ship → retro`。

Design doc 被批准后，`/office-hours` 会反思它注意到的你的思考方式：不是泛泛表扬，而是回扣 session 中你说过的具体内容。这些 observations 也会出现在 design doc 中，所以你之后重读时会再次遇到它们。

---

## `/plan-ceo-review`

这是我的 **founder mode**。

在这里，我希望模型用 taste、ambition、user empathy 和长时间尺度来思考。我不希望它字面执行 request。我希望它先问一个更重要的问题：

**这个 product 到底是为了什么？**

我把它看作 **Brian Chesky mode**。

重点不是实现那个显而易见的 ticket。重点是从用户视角重新思考问题，找到那个感觉 inevitable、delightful，甚至有点 magical 的版本。

### Example（示例）

假设我在做一个 Craigslist-style listing app，我说：

> “让 sellers 为 item 上传一张照片。”

弱 assistant 会加一个 file picker，然后保存 image。

但这不是这个真实 product。

在 `/plan-ceo-review` 中，我希望模型先问：“photo upload” 甚至是不是 feature。也许真实 feature 是帮某个人创建一个真的能卖出去的 listing。

如果这才是真 job，整个 plan 都会改变。

现在模型应该问：

* 我们能从 photo 识别 product 吗？
* 我们能推断 SKU 或 model number 吗？
* 我们能搜索 web 并自动 draft title 和 description 吗？
* 我们能拉取 specs、category 和 pricing comps 吗？
* 我们能建议哪张 photo 最适合作为 hero image 吗？
* 我们能检测 uploaded photo 是否 ugly、dark、cluttered 或 low-trust 吗？
* 我们能让 experience 感觉 premium，而不是像 2007 年的 dead form 吗？

这就是 `/plan-ceo-review` 为我做的事。

它不只是问：“我该怎么添加这个 feature？”
它问的是：**“这个 request 里隐藏的 10-star product 是什么？”**

### Four modes（四种模式）

- **SCOPE EXPANSION** — 放大梦想。Agent 提出 ambitious version。每个 expansion 都作为单独 decision 呈现，由你选择是否 opt in。会热情推荐。
- **SELECTIVE EXPANSION** — 把当前 scope 作为 baseline，同时看看还有什么可能。Agent 逐项 surfaced opportunities，并给 neutral recommendations，你 cherry-pick 值得做的。
- **HOLD SCOPE** — 对现有 plan 做最大 rigor。不 surfaced expansions。
- **SCOPE REDUCTION** — 找 minimum viable version。砍掉其他部分。

Visions 和 decisions 会持久化到 `~/.gstack/projects/`，所以不会只存在于 conversation。Exceptional visions 可以 promote 到 repo 的 `docs/designs/`，供 team 使用。

---

## `/plan-eng-review`

这是我的 **eng manager mode**。

一旦 product direction 对了，我想要的是完全不同的 intelligence。我不想要更多漫无边际的 ideation。我不想要更多 “wouldn't it be cool if”。我希望模型变成我最好的 technical lead。

这个 mode 应该钉住：

* architecture
* system boundaries
* data flow
* state transitions
* failure modes
* edge cases
* trust boundaries
* test coverage

对我来说一个出人意料的大 unlock 是：**diagrams**。

当你强迫 LLM 画系统时，它们会完整得多。Sequence diagrams、state diagrams、component diagrams、data-flow diagrams，甚至 test matrices。Diagrams 会把隐藏假设逼出来，让手挥式 planning 难得多。

所以 `/plan-eng-review` 是我希望模型构建 technical spine 的地方，让 product vision 真正能被扛起来。

### Example（示例）

还是同一个 listing app example。

假设 `/plan-ceo-review` 已经完成了它的工作。我们决定真实 feature 不只是 photo upload，而是一个 smart listing flow：

* 上传照片
* 识别 product
* 从 web enrich listing
* draft 有力的 title 和 description
* 建议最佳 hero image

现在 `/plan-eng-review` 接手。

现在我希望模型回答这些问题：

* upload、classification、enrichment、draft generation 的 architecture 是什么？
* 哪些步骤 synchronous，哪些进入 background jobs？
* app server、object storage、vision model、search/enrichment APIs 和 listing database 的 boundaries 在哪里？
* upload 成功但 enrichment 失败时发生什么？
* product identification confidence 较低时发生什么？
* retries 如何工作？
* 如何防止 duplicate jobs？
* 什么时候 persist 什么，什么可以安全 recompute？

这就是我希望看到 diagrams 的地方：architecture diagrams、state models、data-flow diagrams、test matrices。Diagrams 会把隐藏假设逼出来，让手挥式 planning 难得多。

这就是 `/plan-eng-review`。

不是“把 idea 变小”。
**是把 idea 变得可构建。**

### Review Readiness Dashboard（review 准备度 dashboard）

每次 review（CEO、Eng、Design）都会记录结果。在每次 review 末尾，你会看到 dashboard：

```
+====================================================================+
|                    REVIEW READINESS DASHBOARD                       |
+====================================================================+
| Review（评审） | Runs（次数） | Last Run（最近运行） | Status（状态） | Required（必需） |
|-----------------|------|---------------------|-----------|----------|
| Eng Review      |  1   | 2026-03-16 15:00    | CLEAR     | YES      |
| CEO Review      |  1   | 2026-03-16 14:30    | CLEAR     | no       |
| Design Review   |  0   | —                   | —         | no       |
+--------------------------------------------------------------------+
| VERDICT: CLEARED — Eng Review passed                                |
+====================================================================+
```

Eng Review 是唯一 required gate（可用 `gstack-config set skip_eng_review true` 关闭）。CEO 和 Design 是 informational，分别推荐用于 product 和 UI changes。

### Plan-to-QA flow（从 plan 到 QA 的流转）

当 `/plan-eng-review` 完成 test review section 时，它会把 test plan artifact 写到 `~/.gstack/projects/`。之后你运行 `/qa`，它会自动拾取该 test plan。你的 engineering review 会直接进入 QA testing，不需要手动 copy-paste。

---

## `/plan-design-review`

这是我的 **senior designer reviewing your plan** 模式，在你写任何代码之前使用。

大多数 plans 只描述 backend 做什么，却从不指定用户实际看到什么。Empty states？Error states？Loading states？Mobile layout？AI slop risk？这些 decisions 被推迟到“implementation 时再想”，然后 engineer 就 ship 了一个 “No items found.” 作为 empty state，因为没人指定更好的东西。

`/plan-design-review` 会在 planning 阶段捕获这些问题，此时修复成本最低。

它像 `/plan-ceo-review` 和 `/plan-eng-review` 一样工作：interactive、一次一个 issue、使用 **STOP + AskUserQuestion** pattern。它为每个 design dimension 打 0-10 分，说明 10 分是什么样，然后编辑 plan 让它达到那里。Rating 驱动工作量：低分 = 大量 fixes，高分 = quick pass。

对 plan 做七轮 passes：information architecture、interaction state coverage、user journey、AI slop risk、design system alignment、responsive/accessibility、unresolved design decisions。每轮找到 gaps，然后直接修 obvious gaps，或让你对 genuine tradeoffs 做 design choice。

### Example（示例）

```
You:   /plan-design-review

Claude: Initial Design Rating: 4/10

        “这个 plan 描述了 user dashboard，但从未指定
         用户第一眼看到什么。它说 ‘cards with icons’，
         这看起来像每个 SaaS template。它提到了 0 个
         loading states、0 个 empty states，也没有 mobile behavior。”

        Pass 1 (Info Architecture): 3/10
        “10 分会为每个 screen 定义 primary/secondary/tertiary
         content hierarchy。”
        → Added information hierarchy section to plan

        Pass 2 (Interaction States): 2/10
        “Plan 有 4 个 UI features，但 20 个 interaction states
         (4 features × 5 states each) 里指定了 0 个。”
        → Added interaction state table to plan

        Pass 4 (AI Slop): 4/10
        “Plan 说 ‘clean, modern UI with cards and icons’
         和 ‘hero section with gradient’。这是最像 AI-generated
         的前 2 个 patterns。”
        → Rewrote UI descriptions with specific, intentional alternatives

        Overall: 4/10 → 8/10 after fixes
        “Plan 已达到 design-complete。Implementation 后运行
         /design-review 做 visual QA。”
```

你重跑时，已经 8+ 的 sections 会 quick pass。低于 8 的 sections 会 full treatment。Post-implementation 的 live-site visual audits 请用 `/design-review`。

---

## `/design-consultation`

这是我的 **design partner mode**。

`/plan-design-review` 审查已经存在的 site。`/design-consultation` 用于你什么都还没有的时候：没有 design system、没有 font choices、没有 color palette。你从零开始，希望 senior designer 坐下来和你一起构建整个 visual identity。

它是 conversation，不是 form。Agent 会询问你的 product、users 和 audience。它会思考你的 product 需要传达什么：trust、speed、craft、warmth，或任何适合的感觉，并从那里反推 concrete choices。然后它提出完整、一致的 design system：aesthetic direction、typography（3+ fonts with specific roles）、带 hex values 的 color palette、spacing scale、layout approach 和 motion strategy。每个 recommendation 都有 rationale。每个 choice 都强化其他 choices。

但 coherence 只是 table stakes。每个 dev tool dashboard 看起来都一样：clean sans-serif、muted grays、blue accent。它们都 coherent，也都 forgettable。让一个 product 看起来“nice”和让人真正识别它之间的差别，是**有意识的 creative risks**：意外的 serif headings、同类里没人用的 bold accent、更紧的 spacing，让你的 data 显得 authoritative 而不是 airy。

这才是 `/design-consultation` 真正关注的东西。它不只是提出 safe system。它提出 safe choices AND risks，并告诉你哪些是哪类。“这些 choices 让你在 category 中保持 literate；而这里是我认为你应该 break from convention 的地方，以及原因。”你选择承担哪些 risks。Agent 会检查无论如何系统仍然 coherent。

如果你愿意，agent 会研究你的领域里已经存在的东西：真实 sites 的 screenshots，分析 fonts、colors 和 spacing，让你在做 choices 之前看到 landscape。这不是 copying，而是进入 ballpark，知道 conventions 是什么，然后决定哪些值得打破。

你同意 system 后，它会生成一个 interactive HTML preview page：不只是 swatches 和 font samples，而是真实 product pages。如果你在做 dashboard，你会看到带 sidebar、data tables 和 stat cards 的 dashboard。如果你在做 marketing site，你会看到带 real copy 和 CTA 的 hero section。所有内容都用你的 design system、你的 product name，并支持 light/dark mode。你会在写 production code 的第一行之前，先看到 product 可能是什么感觉。

然后它把 `DESIGN.md` 写到 repo root，作为 project 的 design source of truth，并更新 `CLAUDE.md`，让未来每个 Claude Code session 都遵守这个 system。从那时起，`/design-review` 可以基于它 audit，任何处理 frontend 的 agent 都知道规则。

### Example（示例）

```
You:   /design-consultation

Claude: 从 README 看，这像是面向 engineering teams 的
        developer analytics dashboard。对吗？告诉我你想要的
        feeling。你希望我先看看市面上已有的产品，让我们了解
        landscape 吗？

You:    对，它是给 eng managers 用的。给我看看市面上有什么。

Claude: [浏览 Linear、Vercel、Datadog、Posthog，并截图]

        这是 landscape。它们都收敛到 clean sans-serifs
        和 muted blue-gray palettes。Linear 用 dark-first
        和 tight spacing 脱颖而出。其他都感觉 interchangeable。

        这是我的 proposal，以及我会在哪里保守、在哪里冒险：

        AESTHETIC: Industrial/Utilitarian — data-first，每个 pixel 都有必要
        TYPOGRAPHY: Geist（body + UI）、Instrument Serif（display）、JetBrains Mono（data）
        COLOR: Restrained — slate neutrals，单一 teal accent（#0D9488）
        SPACING: 4px base，compact density
        LAYOUT: Grid-disciplined，12-column
        MOTION: Minimal-functional — 只使用帮助理解的 transitions

        SAFE CHOICES（符合 category expectations）：
          Geist for body — 你的 users 已经从 Vercel 熟悉这种 font
          Slate neutrals — warm grays 很适合 data-heavy UIs
          Grid-disciplined layout — dashboards 需要 predictable alignment

        RISKS（你会脱颖而出的地方）：
          Instrument Serif for display headings — dev tools 中几乎没人
            用 serif。它创造即时 hierarchy contrast，并在充满
            sans-serifs 的空间中传达 “we care about craft”。
          Single teal accent instead of blue — 这个空间里所有人都用 blue。
            Teal 足够接近所以可信，又足够不同所以可识别。
          4px compact density — 比 Linear 更紧，传达 “we respect
            your screen real estate.”

        Safe choices 让你保持 literate。Risks 是 product
        拥有自己面孔的地方。哪些 risks 吸引你？

You:    喜欢 serif 这个 risk。我们看看它。

Claude: Preview 已在 browser 中打开。
        [/tmp/design-consultation-preview-1710000000.html]

        页面展示一个真实 dashboard：sidebar nav、header with
        avatar、stat cards、data table，全都使用你的 design system。
        Instrument Serif 用在 hero scale，Geist 用在 body text，
        JetBrains Mono 用在 data table。Teal accent 用于 buttons
        和 active states。右上角有 light/dark mode toggle。

        感觉如何？在我写 DESIGN.md 前要调整什么吗？

You:    Ship it.

Claude: 已写入 DESIGN.md（typography、color、spacing、layout、motion）。
        已用 design system guidelines 更新 CLAUDE.md。
        未来所有 sessions 都会遵守这些 choices。
```

---

## `/design-review`

这是我的 **designer who codes mode**。

`/plan-design-review` 在 implementation 前 review plan。`/design-review` 在 implementation 后 audit 并修复 live site。

它在 live site 上运行 80-item visual audit，然后进入 fix loop：对每个 design finding，定位 source file，做最小 CSS/styling change，用 `style(design): FINDING-NNN` commit，重新 navigate verify，并拍 before/after screenshots。每个 fix 一个 commit，完全 bisectable。

Self-regulation heuristic 针对 design work 调优：CSS-only changes 免费通过（它们天然 safe 且 reversible），但改 component JSX/TSX files 会计入 risk budget。Hard cap 30 fixes。如果 risk score 超过 20%，它会停下来询问。

### Example（示例）

```
You:   /design-review https://myapp.com

Claude: [对 live site 运行完整 80-item visual audit]
        Design Score: C  |  AI Slop Score: D
        12 个 findings（4 high、5 medium、3 polish）

        正在修复 9 个 design issues...

        style(design): FINDING-001 — replace 3-column icon grid with asymmetric layout
        style(design): FINDING-002 — add heading scale 48/32/24/18/16
        style(design): FINDING-003 — remove gradient hero, use bold typography
        style(design): FINDING-004 — add second font for headings
        style(design): FINDING-005 — vary border-radius by element role
        style(design): FINDING-006 — left-align body text, reserve center for headings
        style(design): FINDING-007 — add hover/focus states to all interactive elements
        style(design): FINDING-008 — add prefers-reduced-motion media query
        style(design): FINDING-009 — set max content width to 680px for body text

        Final audit:
        Design Score: C → B+  |  AI Slop Score: D → A
        9 fixes applied (8 verified, 1 best-effort). 3 deferred.

        [Report with before/after screenshots saved to .gstack/design-reports/]
```

九个 commits，每个只触碰一个 concern。AI Slop score 从 D 到 A，因为三个最容易识别的 patterns（gradient hero、3-column grid、uniform radius）被移除了。

---

## `/design-shotgun`

这是我的 **design exploration mode**。

你知道那种感觉。你有一个 feature、一个 page、一个 landing screen，但你不确定它应该长什么样。你可以向 Claude 描述，得到一个答案。但一个答案就是一个 perspective，而 design 是 taste game。你需要看到 options。

`/design-shotgun` 用 GPT Image API 生成 3 个 visual design variants，在浏览器中打开 comparison board，并等待你的 feedback。你可以选择一个方向、请求修改，或要求全新的 variants。Board 支持 remix、regenerate 和 approval actions。

### 循环流程

1. 你描述想要什么（或指向现有 page）
2. Skill 读取你的 `DESIGN.md` 获取 brand constraints（如果存在）
3. 生成 3 个 distinct design variants as PNGs
4. Browser 中打开 comparison board，三个并排显示
5. 你点击喜欢的那个上的 “Approve”，或提供 feedback 进入另一轮
6. Approved variant 保存到 `~/.gstack/projects/$SLUG/designs/`，带 `approved.json`

`approved.json` 是喂给 `/design-html` 的方式之一。Design pipeline 链起来就是：shotgun 选方向，design-html 把它渲染成 working code。但 `/design-html` 也可以基于 CEO plans、design reviews 或纯 description 工作。

### Taste memory（taste 记忆）

Skill 会跨 sessions 记住你的 preferences。如果你持续偏好 minimal designs 而不是 busy ones，它会在未来 generation 中 bias。这不是你配置的 setting，而是从 approvals 中浮现出来。

### Example（示例）

```
You:   /design-shotgun — hero section for a developer tools landing page

Claude: [生成 3 个 variants]
        Variant A：Bold typography，dark background，code snippet hero
        Variant B：Split layout，左侧 product screenshot，右侧 copy
        Variant C：Minimal，centered headline，gradient accent

        [在 localhost:PORT 打开 comparison board]

You:    [在 browser 中点击 Variant A 上的 "Approve"]

Claude: 已批准 Variant A。已保存到 ~/.gstack/projects/myapp/designs/
        下一步：运行 /design-html，从这个 mockup 生成 production HTML。
```

---

## `/design-html`

这是我的 **design-to-code mode**。

每个 AI code generation tool 都会产出 static CSS。Hardcoded heights。Resize 时溢出的 text。会突然 snap 而不是 flow 的 breakpoints。Output 只在一个 viewport size 上看起来正确，其他尺寸都会破。

`/design-html` 修这个问题。它使用 Cheng Lou（ex-React core、Midjourney frontend）的 [Pretext](https://github.com/chenglou/pretext) 生成 HTML。Pretext 是一个 15KB library，可以不依赖 DOM measurement 计算 text layout。Text 会 reflow。Heights 会随 content 调整。Cards 会自适应 size。Chat bubbles 会 shrinkwrap。全部 sub-millisecond，全部 dynamic。

它支持多种 input sources：来自 `/design-shotgun` 的 approved mockup、`/plan-ceo-review` 的 CEO plan、来自 `/plan-design-review` 的 design review context、你提供的 PNG，或只是你对想要内容的描述。它检测可用 context，并询问你想如何继续。

### Smart API routing（智能 API 路由）

不是每个 page 都需要完整 Pretext engine。Skill 会读取 design 并选择正确 tools：

- **Simple layouts**（landing, marketing）：`prepare()` + `layout()`，用于 resize-aware heights
- **Card grids**（dashboard, listing）：`prepare()` + `layout()`，用于 self-sizing cards
- **Chat UIs**：`walkLineRanges()`，用于 tight-fit bubbles，zero wasted pixels
- **Editorial layouts**：`layoutNextLine()`，用于让 text around obstacles flow
- **Complex editorial**：使用带 `layoutWithLines()` 的 full engine 做 manual line rendering

### The refinement loop（ refinement 循环）

1. 从 `approved.json` 读取 approved mockup
2. 使用 GPT-4o vision 提取 implementation spec（colors, typography, layout）
3. 生成 inline Pretext 的 self-contained HTML（15KB, zero network dependency）
4. 启动 live-reload server，让你即时看到变化
5. 在 3 个 viewports（mobile, tablet, desktop）截图验证 layout
6. AskUserQuestion：哪里需要调整？
7. 通过 Edit tool 做 surgical edits（不是 full regeneration）
8. 重复直到你说 "done"

### Framework detection（framework 检测）

如果你的 project 使用 React、Svelte 或 Vue（从 `package.json` 检测），skill 会 offer 生成 framework component，而不是 vanilla HTML。Framework output 使用 `npm install @chenglou/pretext`，而不是 inline vendoring。

### Example（示例）

```
You:   /design-html

Claude: 找到已批准的 mockup：variant-A.png（hero section）
        Design type：simple layout → 使用 prepare() + layout()

        [用 Pretext 生成 HTML，并打开 live-reload server]
        [在 375px、768px、1440px 截图；全部已验证]

        HTML 已在 localhost:3456 运行。请调整 browser 尺寸。
        Text 会动态 reflow。哪里需要修改？

You:    把 headline 做大，并在 CTA 下方增加 spacing

Claude: [编辑 font-size 和 margin，browser 自动 reload]
        已更新。应用了两处 changes。

You:    Done

Claude: 已保存到 ~/.gstack/projects/myapp/designs/hero-20260330/finalized.html
```

---

## `/review`

这是我的 **paranoid staff engineer mode**。

Tests passing 不代表 branch 就安全。

`/review` 存在，是因为有一整类 bugs 可以活过 CI，然后在 production 给你一拳。这个 mode 不是为了 dream bigger，也不是为了把 plan 修得更漂亮，而是要问：

**还有什么会坏？**

这是 structural audit，不是 style nitpick pass。我希望模型寻找这类问题：

* N+1 queries
* stale reads
* race conditions
* bad trust boundaries
* missing indexes
* escaping bugs
* broken invariants
* bad retry logic
* tests 通过但漏掉真正 failure mode
* forgotten enum handlers：新增 status 或 type constant 时，`/review` 会把它穿过 codebase 中每个 switch statement 和 allowlist，而不只是看 changed files

### Fix-First（先修复）

发现项必须可行动，而不是只列问题。明显的机械修复（dead code、stale comments、N+1 queries）会自动应用，你会看到每个 `[AUTO-FIXED] file:line Problem → what was done`。真正 ambiguous 的 issues（security、race conditions、design decisions）才会呈现给你决定。

### Completeness gaps（完整性缺口）

`/review` 现在会标记 shortcut implementations：如果完整版本用不到 30 分钟 CC time，那就不该停在 80%。如果你选择了 80% solution，而 100% solution 是 lake 不是 ocean，review 会指出。

### Example（示例）

假设 smart listing flow 已实现，tests 也 green。

`/review` 仍然应该问：

* 渲染 listing photos 或 draft suggestions 时，我是否引入了 N+1 query？
* 我是否信任 client-provided file metadata，而不是验证真实 file？
* 两个 tabs 是否会 race 并覆盖 cover-photo selection 或 item details？
* Failed uploads 是否会让 storage 中永远留下 orphaned files？
* “exactly one hero image” rule 在 concurrency 下会坏吗？
* 如果 enrichment APIs partially fail，我会 graceful degrade 还是保存 garbage？
* 我是否因为把 web data 拉入 draft generation 而意外制造 prompt injection 或 trust-boundary problem？

这就是 `/review` 的意义。

我不想要 flattery。
我希望模型在 incident 发生前先想象它。

---

## `/investigate`

当某个东西坏了而你不知道为什么，`/investigate` 是你的 systematic debugger。它遵循 Iron Law：**先 root cause investigation，再 fix。**

它不是猜测和 patch，而是追踪 data flow，对照 known bug patterns，并一次测试一个 hypothesis。如果三次 fix attempts 失败，它会停下来质疑 architecture，而不是 thrashing。这能防止浪费数小时的“让我再试一个东西” spiral。

---

## `/qa`

这是我的 **QA lead mode**。

`/browse` 给 agent 眼睛。`/qa` 给它 testing methodology。

最常见场景：你在 feature branch 上，刚写完代码，想验证一切正常。只要说 `/qa`，它会读取 git diff，识别你的 changes 影响了哪些 pages 和 routes，启动 browser，并逐个测试。不需要 URL。不需要手动 test plan。

四种模式：

- **Diff-aware**（feature branches 自动启用）— 读取 `git diff main`，识别 affected pages，并专门测试它们
- **Full** — 系统探索整个 app。5-15 分钟。记录 5-10 个证据充分的问题
- **Quick**（`--quick`）— 30 秒 smoke test。Homepage + top 5 nav targets
- **Regression**（`--regression baseline.json`）— run full mode，然后与 previous baseline diff

### Automatic regression tests（自动回归测试）

当 `/qa` 修复 bug 并验证后，它会自动生成 regression test，捕获刚刚坏掉的 exact scenario。Tests 包含回溯到 QA report 的完整 attribution。

### Example（示例）

```
You:   /qa https://staging.myapp.com

Claude: [探索 12 个 pages，填写 3 个 forms，测试 2 个 flows]

        QA Report: staging.myapp.com — Health Score: 72/100

        Top 3 Issues:
        1. CRITICAL: Checkout form 在 required fields 为空时仍会 submit
        2. HIGH: Mobile nav menu 选择 item 后没有关闭
        3. MEDIUM: 低于 1024px 时 dashboard chart 与 sidebar 重叠

        [带 screenshots 的完整 report 已保存到 .gstack/qa-reports/]
```

**Testing authenticated pages:** 先用 `/setup-browser-cookies` 导入真实 browser sessions，然后 `/qa` 就能测试 login 后的 pages。

---

## `/ship`

这是我的 **release machine mode**。

一旦我决定要构建什么、钉住 technical plan、跑完严肃 review，我就不想继续讨论。我想要 execution。

`/ship` 负责 final mile。它用于 ready branch，不用于决定构建什么。

在这里，模型应该停止像 brainstorm partner，开始像 disciplined release engineer：sync with main、run the right tests、确认 branch state sane、如果 repo 期望则 update changelog 或 versioning、push、创建或更新 PR。

### Test bootstrap（测试框架 bootstrap）

如果你的 project 没有 test framework，`/ship` 会 setup：检测 runtime、研究最合适 framework、安装、为你的真实 code 写 3-5 个 real tests、设置 CI/CD（GitHub Actions）、创建 TESTING.md。100% test coverage 是目标，tests 让 vibe coding 变 safe，而不是 yolo coding。

### Coverage audit（覆盖率 audit）

每次 `/ship` 都会从 diff 构建 code path map，搜索对应 tests，并生成带 quality stars 的 ASCII coverage diagram。Gaps 会 auto-generate tests。PR body 显示 coverage：`Tests: 42 → 47 (+5 new)`。

### Review gate（review gate）

`/ship` 在创建 PR 前检查 [Review Readiness Dashboard](#review-readiness-dashboard)。如果缺 Eng Review，它会询问，但不会 block。Decisions 按 branch 保存，所以你不会被反复问。

很多 branches 在有趣工作完成、只剩无聊 release work 时死亡。人类会拖延这部分。AI 不该拖延。

---

## `/land-and-deploy`

这是我的 **deploy pipeline mode**。

`/ship` 创建 PR。`/land-and-deploy` 完成工作：merge、deploy、verify。

它 merge PR，等待 CI，等待 deploy 完成，然后对 production 运行 canary checks。从“approved”到“verified in production”，一个命令。如果 deploy 破了，它会告诉你哪里失败，以及是否要 rollback。

新 project 第一次运行会触发 dry-run walk-through，让你在做不可逆操作前验证 pipeline。之后它信任 config 并直接跑到底。

### Setup（设置）

先运行 `/setup-deploy`。它检测你的 platform（Fly.io、Render、Vercel、Netlify、Heroku、GitHub Actions 或 custom），发现 production URL 和 health check endpoints，并把 config 写入 CLAUDE.md。一次性，60 秒。

### Example（示例）

```
You:   /land-and-deploy

Claude: 正在 merge PR #42...
        CI: 3/3 checks passed
        Deploy: Fly.io — 正在部署 v2.1.0...
        Health check: https://myapp.fly.dev/health → 200 OK
        Canary: 5 pages checked, 0 console errors, p95 < 800ms

        Production 已验证。v2.1.0 已上线。
```

---

## `/canary`

这是我的 **post-deploy monitoring mode**。

Deploy 后，`/canary` 会监控 live site 是否出问题。它用 browse daemon 循环访问你的 key pages，检查 console errors、performance regressions、page failures 和 visual anomalies。它会定期 screenshots，并与 pre-deploy baselines 比较。

可以在 `/land-and-deploy` 后立刻用，也可以在 risky deploy 后定期运行。

```
You:   /canary https://myapp.com

Claude: 正在每 2 分钟监控 8 个 pages...

        Cycle 1: ✓ 所有 pages healthy。p95: 340ms。0 console errors。
        Cycle 2: ✓ 所有 pages healthy。p95: 380ms。0 console errors。
        Cycle 3: ⚠ /dashboard — new console error: "TypeError: Cannot read
                   property 'map' of undefined" at dashboard.js:142
                 Screenshot 已保存。

        Alert: 3 个 monitoring cycles 后出现 1 个 new console error。
```

---

## `/benchmark`

这是我的 **performance engineer mode**。

`/benchmark` 为你的 pages 建立 performance baselines：load time、Core Web Vitals（LCP、CLS、INP）、resource counts 和 total transfer size。在 PR 前后运行，捕捉 regressions。

它使用 browse daemon 做真实 Chromium measurements，不是 synthetic estimates。多次 runs 取平均。Results 会持久化，便于跨 PR 追踪 trends。

```
You:   /benchmark https://myapp.com

Claude: 正在 benchmark 5 个 pages（每个 3 runs）...

        /           load: 1.2s  LCP: 0.9s  CLS: 0.01  resources: 24 (890KB)
        /dashboard  load: 2.1s  LCP: 1.8s  CLS: 0.03  resources: 31 (1.4MB)
        /settings   load: 0.8s  LCP: 0.6s  CLS: 0.00  resources: 18 (420KB)

        Baseline 已保存。Changes 后再次运行以进行比较。
```

---

## `/cso`

这是我的 **Chief Security Officer**。

在任意 codebase 上运行 `/cso`，它会执行 OWASP Top 10 + STRIDE threat model audit。它扫描 injection vulnerabilities、broken authentication、sensitive data exposure、XML external entities、broken access control、security misconfiguration、XSS、insecure deserialization、known-vulnerable components 和 insufficient logging。每个 finding 都包含 severity、evidence 和 recommended fix。

```
You:   /cso

Claude: 正在运行 OWASP Top 10 + STRIDE security audit...

        CRITICAL: user search 中存在 SQL injection（app/models/user.rb:47）
        HIGH: Session tokens 存储在 localStorage（app/frontend/auth.ts:12）
        MEDIUM: /api/login endpoint 缺少 rate limiting
        LOW: 未设置 X-Frame-Options header

        扫描 12 个 files 后发现 4 个 findings。1 critical，1 high。
```

---

## `/document-release`

这是我的 **technical writer mode**。

`/ship` 创建 PR 后、merge 前，`/document-release` 会读取 project 中每个 documentation file，并把它与 diff cross-reference。它更新 file paths、command lists、project structure trees，以及其他 drift 的内容。Risky 或 subjective changes 会 surfaced 成 questions，其他自动处理。

```
You:   /document-release

Claude: 正在分析 3 commits 中变更的 21 个 files。发现 8 个 documentation files。

        README.md：将 skill count 从 9 更新为 10，向 table 添加 new skill
        CLAUDE.md：向 project structure 添加 new directory
        CONTRIBUTING.md：已是最新，无需 changes
        TODOS.md：将 2 个 items 标为 complete，并添加 1 个 new item

        所有 docs 已更新并 committed。PR body 已附上 doc diff。
```

它还会 polish CHANGELOG voice（但绝不 overwrite entries）、清理 completed TODOS、检查 cross-doc consistency，并只在 appropriate 时询问 VERSION bumps。

---

## `/retro`

这是我的 **engineering manager mode**。

周末我想知道真正发生了什么。不是 vibes，而是 data。`/retro` 分析 commit history、work patterns 和 shipping velocity，并写一份 candid retrospective。

它是 team-aware 的。它识别是谁在运行命令，对你的工作做最深入 treatment，然后分解每个 contributor，给出 specific praise 和 growth opportunities。它计算 commits、LOC、test ratio、PR sizes 和 fix ratio 等 metrics。它从 commit timestamps 中检测 coding sessions，找到 hotspot files，追踪 shipping streaks，并识别本周最大 ship。

它还追踪 test health：total test files、本 period 新增 tests、regression test commits 和 trend deltas。如果 test ratio 低于 20%，会标记为 growth area。

### Example（示例）

```
You:   /retro

Claude: Mar 1 这一周：47 commits（3 contributors），3.2k LOC，38% tests，12 PRs，peak：10pm | Streak：47d

        ## Your Week
        32 commits，+2.4k LOC，41% tests。Peak hours：9-11pm。
        Biggest ship：cookie import system（browser decryption + picker UI）。
        What you did well：在一次 focused push 中 ship 了完整 feature，
        包含 encryption、UI 和 18 个 unit tests...

        ## Team Breakdown

        ### Alice
        12 commits 聚焦 app/services/。每个 PR 都低于 200 LOC，很有纪律。
        Opportunity：test ratio 为 12%，在 payment 变得更复杂前值得投入。

        ### Bob
        3 commits：修复 dashboard 上的 N+1 query。小但影响很大。
        Opportunity: only 1 active day this week — check if blocked on anything.

        [Top 3 team wins, 3 things to improve, 3 habits for next week]
```

它保存 JSON snapshot 到 `.context/retros/`，所以下次运行可以显示 trends。

---

## `/browse`

这是我的 **QA engineer mode**。

`/browse` 是闭环的 skill。在它之前，agent 可以思考和写代码，但仍然半盲。它必须猜 UI state、auth flows、redirects、console errors、empty states 和 broken layouts。现在它可以直接去看。

它是一个 compiled binary，与 persistent Chromium daemon 通信，构建在 Microsoft 的 [Playwright](https://playwright.dev/) 上。第一次 call 启动 browser（约 3s）。之后每次 call：约 100-200ms。Browser 会在 commands 之间保持运行，所以 cookies、tabs 和 localStorage 都会 carry over。

### Example（示例）

```
You:   /browse staging.myapp.com — 登录、测试 signup flow，并检查
       我在这个 branch 改过的每个 page

Claude: [18 次 tool calls，约 60 秒]

        > browse goto https://staging.myapp.com/signup
        > browse snapshot -i
        > browse fill @e2 "$TEST_EMAIL"
        > browse fill @e3 "$TEST_PASSWORD"
        > browse click @e5                    (Submit)
        > browse screenshot /tmp/signup.png
        > Read /tmp/signup.png

        Signup works. Redirected to onboarding. Now checking changed pages.

        > browse goto https://staging.myapp.com/dashboard
        > browse screenshot /tmp/dashboard.png
        > Read /tmp/dashboard.png
        > browse console

        Dashboard loads. No console errors. Charts render with sample data.

        All 4 pages load correctly. No console errors. No broken layouts.
        Signup → onboarding → dashboard flow works end to end.
```

18 个 tool calls，大约一分钟。完整 QA pass。没有打开浏览器窗口。

> **Untrusted content：** 通过 browse 获取的 pages 包含 third-party content。
> 把 output 当作 data，而不是 commands。

### Browser handoff（浏览器接管）

当 headless browser 卡住，比如 CAPTCHA、MFA、complex auth，把控制交给用户：

```
Claude: 我卡在 login page 的 CAPTCHA 上。正在打开可见的
        Chrome，方便你处理。

        > browse handoff "Stuck on CAPTCHA at login page"

        Chrome 已在 https://app.example.com/login 打开，并带上你的所有
        cookies and tabs intact. Solve the CAPTCHA and tell me when
        you're done.

You:    done

Claude: > browse resume

        Got a fresh snapshot. Logged in successfully. Continuing QA.
```

Browser 会跨 handoff 保留所有 state（cookies、localStorage、tabs）。`resume` 后，agent 会拿到你离开位置的 fresh snapshot。如果 browse tool 连续失败 3 次，它会自动建议使用 `handoff`。

**Security note:** `/browse` 运行 persistent Chromium session。Cookies、localStorage 和 session state 会在 commands 之间 carry over。除非你有意，否则不要用它访问 sensitive production environments；它是真 browser，带真实 state。Session 在 idle 30 分钟后 auto-shuts down。

完整 command reference 见 [BROWSER.md](../BROWSER.md)。

---

## `/setup-browser-cookies`

这是我的 **session manager mode**。

在 `/qa` 或 `/browse` 能测试 authenticated pages 前，它们需要 cookies。与其每次通过 headless browser 手动登录，`/setup-browser-cookies` 会直接从你的 daily browser 导入真实 sessions。

它 auto-detect 已安装的 Chromium browsers（Comet、Chrome、Arc、Brave、Edge），通过 macOS Keychain 解密 cookies，并加载到 Playwright session。Interactive picker UI 让你精确选择要导入的 domains，cookie values 永远不会展示。

```
You:   /setup-browser-cookies

Claude: Cookie picker 已打开；请在 browser 中选择要 import 的 domains，
        完成后告诉我。

        [你在 browser UI 中选择 github.com、myapp.com]

You:    done

Claude: 已导入 2 个 domains（47 cookies）。Session 已就绪。
```

也可以完全跳过 UI：

```
You:   /setup-browser-cookies github.com

Claude: 已从 Comet 导入 github.com 的 12 个 cookies。
```

---

## `/autoplan`

这是我的 **review autopilot mode**。

分别运行 `/plan-ceo-review`、`/plan-design-review`、`/plan-eng-review` 意味着回答 15-30 个中间 questions。每个 question 都有价值，但有时你想让 gauntlet 运行，不想每个 decision 都停一下。

`/autoplan` 从磁盘读取全部三个 review skills，并顺序运行：CEO → Design → Eng。它使用六条 encoded principles 自动做 decisions：prefer completeness、match existing patterns、choose reversible options、prefer the option the user chose for similar past decisions、defer ambiguous items、escalate security。Taste decisions（close approaches、borderline scope expansions、cross-model disagreements）会保存，并在最终 approval gate 呈现。

一个命令，得到 fully reviewed plan。

```
You:   /autoplan

Claude: 正在运行 CEO review... [4 个 scope decisions 已 auto-resolved]
        正在运行 design review... [3 个 design dimensions 已 auto-scored]
        正在运行 eng review... [2 个 architecture decisions 已 auto-resolved]

        TASTE DECISIONS（需要你的 input）:
        1. Scope：Codex 建议添加 search；这是 borderline expansion。要加吗？
        2. Design：两个 approaches 的分差在 1 分以内。哪个感觉更对？

        [带 context 展示两个 options]

You:    1) 是的，加 search。2) Option A。

Claude: Plan 完成。9 个 decisions 已 auto-resolved，2 个 taste decisions 已批准。
```

---

## `/learn`

这是我的 **institutional memory mode**。

gstack 从每个 session 学习。Patterns、pitfalls、preferences、architectural decisions 会积累在 `~/.gstack/projects/$SLUG/learnings.jsonl`。每条 learning 都有 confidence score、source attribution 和 referenced files。

`/learn` 让你查看 gstack 吸收了什么、搜索 specific patterns、prune stale entries（当 referenced files 不再存在）、为 team sharing 导出 learnings。真正的 magic 在其他 skills 里：它们会在做 recommendations 前自动搜索 learnings，并在 past insight 相关时展示 “Prior learning applied”。

```
You:   /learn

Claude: 这个 project 有 23 条 learnings（14 high confidence、6 medium、3 low）

        Top patterns:
        - [9/10] API responses 始终包在 { data, error } envelope 中
        - [8/10] Tests use factory helpers in test/support/factories.ts
        - [8/10] All DB queries go through repository pattern, never direct

        3 potentially stale (referenced files deleted):
        - "auth middleware uses JWT" — auth/middleware.ts was deleted
        [Prune these? Y/N]
```

---

## `/open-gstack-browser`

这是我的 **co-presence mode**。

`/browse` 默认 headless 运行。你看不到 agent 看到的东西。`/open-gstack-browser` 改变这一点。它启动由 Playwright 控制、带 anti-bot stealth 的 GStack Browser（rebranded Chromium），并 auto-load sidebar extension。你可以实时观看每个 action。

Sidebar chat 是一个控制 browser 的 Claude instance。它会 auto-route 到正确 model：Sonnet 用于 navigation 和 actions（click、goto、fill、screenshot），Opus 用于 reading 和 analysis（summarize、find bugs、describe）。Sidebar footer 提供 one-click cookie import。Headed mode 下，只要窗口打开，browser 就保持 alive，没有 idle timeout。Menu bar 显示 “GStack Browser”，而不是 “Chrome for Testing”。

Sidebar agent 带 layered prompt injection defense：本地 22MB ML classifier 扫描每个 page 和 tool output，Haiku transcript check 对完整 conversation 投票，canary token 捕获 session-exfil attempts，verdict combiner 要求两个 classifiers 同意才 block。Header 中的 shield icon 显示状态（green/amber/red）。详见 [ARCHITECTURE.md](../ARCHITECTURE.md#prompt-injection-defense-sidebar-agent)。

```
You:   /open-gstack-browser

Claude: 已启动带 sidebar extension 的 GStack Browser。
        Anti-bot stealth 已启用。所有 $B commands 都以 headed mode 运行。
        在 sidebar 中输入指令来驱动 browser agent。
        Sidebar model routing：sonnet 负责 actions，opus 负责 analysis。
```

---

## `/setup-deploy`

一次性 deploy configuration。第一次 `/land-and-deploy` 前运行。

它 auto-detect 你的 deploy platform（Fly.io、Render、Vercel、Netlify、Heroku、GitHub Actions 或 custom），发现 production URL、health check endpoints 和 deploy status commands。把所有内容写入 CLAUDE.md，未来 deploys 就能自动运行。

```
You:   /setup-deploy

Claude: 检测到：Fly.io（找到 fly.toml）
        Production URL: https://myapp.fly.dev
        Health check: /health → expects 200
        Deploy command: fly deploy
        Status command: fly status

        已写入 CLAUDE.md。Ready 后运行 /land-and-deploy。
```

---

## `/codex`

这是我的 **second opinion mode**。

当 `/review` 从 Claude 的视角抓 bugs 时，`/codex` 会带来完全不同的 AI：OpenAI 的 Codex CLI，review 同一个 diff。不同 training、不同 blind spots、不同 strengths。重叠部分说明很可能是真的；各自独有 findings 则是发现单个模型抓不到的问题的地方。

### Three modes（三种模式）

**Review** — 对当前 diff 运行 `codex review`。Codex 读取每个 changed file，按 severity（P1 critical、P2 high、P3 medium）分类 findings，并返回 PASS/FAIL verdict。任何 P1 finding = FAIL。Review 完全独立，Codex 不看 Claude 的 review。

**Challenge** — adversarial mode。Codex 主动尝试破坏你的 code。它寻找 edge cases、race conditions、security holes，以及 under load 会失败的 assumptions。使用 maximum reasoning effort（`xhigh`）。把它看作逻辑的 penetration test。

**Consult** — 带 session continuity 的 open conversation。问 Codex 任何关于 codebase 的问题。Follow-up questions 复用同一 session，所以 context carry over。很适合 “am I thinking about this correctly?” 时刻。

### Cross-model analysis（跨模型分析）

当 `/review`（Claude）和 `/codex`（OpenAI）都 review 了同一 branch，你会得到 cross-model comparison：哪些 findings overlap（high confidence），哪些 unique to Codex（不同 perspective），哪些 unique to Claude。这是 “two doctors, same patient” 的 code review 方法。

```
You:   /codex review

Claude: 正在运行独立的 Codex review...

        CODEX REVIEW: PASS (3 findings)
        [P2] payment handler 中的 race condition：没有 advisory lock 时，
             concurrent charges 可能造成 double-debit
        [P3] Missing null check on user.email before downcase
        [P3] Token comparison not using constant-time compare

        Cross-model analysis (vs /review):
        OVERLAP: Race condition in payment handler (both caught it)
        UNIQUE TO CODEX: Token comparison timing attack
        UNIQUE TO CLAUDE: N+1 query in listing photos
```

---

## Safety & Guardrails（安全与护栏）

四个 skills 会为任何 Claude Code session 添加 safety rails。它们通过 Claude Code 的 PreToolUse hooks 工作：transparent、session-scoped、无 configuration files。

### `/careful`

当你靠近 production、运行 destructive commands，或只是想要 safety net 时，说 “be careful” 或运行 `/careful`。每个 Bash command 都会检查 known-dangerous patterns：

- `rm -rf` / `rm -r` — recursive delete
- `DROP TABLE` / `DROP DATABASE` / `TRUNCATE` — data loss
- `git push --force` / `git push -f` — history rewrite
- `git reset --hard` — discard commits
- `git checkout .` / `git restore .` — discard uncommitted work
- `kubectl delete` — production resource deletion
- `docker rm -f` / `docker system prune` — container/image loss

常见 build artifact cleanups（`rm -rf node_modules`、`dist`、`.next`、`__pycache__`、`build`、`coverage`）已 whitelist，对 routine operations 不 false alarm。

你可以 override 任何 warning。Guardrails 是 accident prevention，不是 access control。

### `/freeze`

把所有 file edits 限制在单个 directory。当你 debug billing bug 时，不希望 Claude 偶然“修复” `src/auth/` 中无关代码。`/freeze src/billing` 会 block boundary 外的所有 Edit 和 Write operations。

`/investigate` 会自动激活它：检测正在 debugging 的 module，并把 edits freeze 到该 directory。

```
You:   /freeze src/billing

Claude: Edits 已限制在 src/billing/。运行 /unfreeze 可移除。

        [稍后，Claude 尝试编辑 src/auth/middleware.ts]

Claude: BLOCKED — Edit outside freeze boundary（src/billing/）。
        跳过这个 change。
```

注意：这只 block Edit 和 Write tools。像 `sed` 这样的 Bash commands 仍然可以修改 boundary 外文件；它是 accident prevention，不是 security sandbox。

### `/guard`

Full safety mode：一个命令组合 `/careful` + `/freeze`。Destructive command warnings 加 directory-scoped edits。适用于 touching prod 或 debugging live systems。

### `/unfreeze`

移除 `/freeze` boundary，允许再次 everywhere edits。Hooks 仍然为 session 注册，只是允许所有内容。重新运行 `/freeze` 可设置新的 boundary。

---

## `/gstack-upgrade`

用一个命令保持 gstack current。它检测你的 install type（global at `~/.claude/skills/gstack` vs vendored in your project at `.claude/skills/gstack`），运行 upgrade，如果你有 dual installs 则同步两份，并显示 changed 内容。

```
You:   /gstack-upgrade

Claude: Current version: 0.7.4
        Latest version: 0.8.2

        What's new:
        - 面向 CAPTCHAs 和 auth walls 的 browse handoff
        - /codex multi-AI second opinion
        - /qa 现在始终使用 browser
        - Safety skills：/careful、/freeze、/guard
        - Proactive skill suggestions

        已升级到 0.8.2。Global 和 project installs 均已同步。
```

在 `~/.gstack/config.yaml` 中设置 `auto_upgrade: true` 可完全跳过 prompt：有新版本时，gstack 会在每个 session 开始静默升级。

---

## Greptile integration（Greptile 集成）

[Greptile](https://greptile.com) 是一家自动 review PRs 的 YC company。它能抓真实 bugs：race conditions、security issues、能通过 CI 但 production 会炸的东西。它不止一次救过我。我喜欢这些人。

### Setup（设置）

在 [greptile.com](https://greptile.com) 上为你的 GitHub repo 安装 Greptile，约 30 秒。只要它开始 review PRs，gstack 就会自动拾取它的 comments。不需要额外 configuration。

### 工作方式

任何 automated reviewer 的问题都是 triage。Greptile 很好，但不是每条 comment 都是真 issue。有些是 false positives。有些标记的是你三 commits 前已经修掉的问题。没有 triage layer，comments 会堆起来，你会开始忽略它们，这就违背了目的。

gstack 解决这个问题。`/review` 和 `/ship` 现在是 Greptile-aware。它们读取 Greptile 的 comments，分类每条，并采取 action：

- **Valid issues** 加入 critical findings，并在 shipping 前修复
- **Already-fixed issues** 自动回复 acknowledging the catch
- **False positives** 会 push back：你确认后，发出回复解释为什么它错了

结果是 two-layer review：Greptile 在 PR 上异步抓问题，然后 `/review` 和 `/ship` 把这些 findings 纳入正常 workflow 中 triage。没有东西掉进 cracks。

### 从历史中学习

你确认的每个 false positive 都会保存到 `~/.gstack/greptile-history.md`。未来 runs 会 auto-skip 你的 codebase 中已知 FP patterns。`/retro` 还会随时间追踪 Greptile 的 batting average，让你看到 signal-to-noise ratio 是否在改善。

### Example（示例）

```
You:   /ship

Claude: [同步 main，运行 tests，执行 pre-landing review...]

        Greptile 在这个 PR 上发现 3 条 comments：

        [VALID] app/services/payment_service.rb:47 — Race condition:
        concurrent charges 可能 double-debit。建议在 charge block 周围加
        DB-level advisory lock。

        [ALREADY FIXED] app/models/user.rb:12 — downcase 前缺少
        email null check。
        → 已在 commit abc1234 修复。正在 auto-reply。

        [FALSE POSITIVE] lib/auth.rb:88 — "Token comparison should
        use constant-time comparison." 这里已经使用了
        ActiveSupport::SecurityUtils.secure_compare。

        正在修复 payment_service.rb 中的 race condition...

        auth token comment 是 false positive。
        Options：A) 回复 Greptile 解释  B) 仍然修复  C) 忽略

You:    A

Claude: 已回复 Greptile。所有 tests 均通过。
        PR: github.com/you/app/pull/42
```

三条 Greptile comments。一个真实 fix。一个 auto-acknowledged。一个 false positive 被回复 push back。额外总耗时：约 30 秒。

---

## `/ios-qa`

真实设备 iOS QA。这个 fork 的 load-bearing insight 是：不要 simulate，不要 run XCTest，不要启动 WebDriverAgent。在 app under test 中嵌入 HTTP server，通过 USB CoreDevice IPv6 tunnel 从 Mac-side daemon 驱动它。

Agent 读取你的 Swift source，找到带 `@Snapshotable` 字段的 `@Observable` classes，codegen typed accessors，部署 debug bridge，然后运行闭环 find→fix→verify loop。

### 一张图看架构

```
       ┌──────────────────────┐   USB CoreDevice (IPv6)   ┌──────────────────┐
       │ gstack-ios-qa daemon │ ────────────────────────▶ │ iOS app          │
       │ (Mac, bun/TS)        │   bearer + X-Session-Id   │ StateServer      │
       │ - rotates boot token │                           │ (loopback only)  │
       │ - mints session toks │                           └──────────────────┘
       │ - capability tiers   │
       │ - audit + redact     │
       └──────────────────────┘
                ▲
                │ Tailscale (optional, --tailnet)
                │
       ┌──────────────────────┐
       │ Remote agent         │
       │ (OpenClaw, etc.)     │
       └──────────────────────┘
```

iOS app 的 `StateServer` 只 bind loopback（`::1` + `127.0.0.1`）。Mac daemon 负责 tailnet identity validation、capability tiers 和 audit trail。Remote agents 永远看不到 boot token，只看到通过 Tailscale identity gating mint 的 short-lived session tokens（默认 1h，硬上限 24h）。

### 关键解锁：USB-tethered + Tailscale = 任何 agent 都能 remote iOS QA

一台 Mac、你已经拥有的一部 iPhone、Tailscale free tier，就可以替代大多数 teams 向 BrowserStack/Sauce Labs 付费购买的能力。Tailnet 上任何 HTTP-capable agent，只要你给它 mint session token，就能驱动 iOS app。Tailscale ACLs 规定哪些 identities 可以以哪个 capability tier 访问 Mac。

可运行的 setup 见 `ios-qa/docs/tailscale-acl-example.md`。

### 能力层级

| 层级 | Endpoints |
|------|-----------|
| observe | `/screenshot`, `/elements`, `GET /state/*`, `/state/snapshot`, `/healthz` |
| interact | observe + `/tap`, `/swipe`, `/type`, `/session/*` |
| mutate | interact + `POST /state/<key>` |
| restore | mutate + `POST /state/restore` |

默认 minted tokens 获得 `interact`。更高 tiers 需要显式 owner mint。

---

## `/ios-fix`

Iron Law：没有 reproducing snapshot，就不 fix。Agent 通过 `GET /state/snapshot` 捕获 pre-bug state，写 fix、rebuild、redeploy、restore snapshot，并验证 bug 消失。Snapshot 会变成 regression test fixture，防止 bug 静默复发。

这镜像 `/qa` 的 find-bug → fix → re-verify loop，但用于 iOS。

---

## `/ios-design-review`

真实 iPhone 上的 designer's-eye QA。以 observe-tier mode 连接到同一个 `/ios-qa` daemon，并 screenshot 每个 screen。对 10 个 dimensions 打 0-10 分：typography hierarchy、spacing rhythm、color hierarchy、touch targets、loading/empty/error states、accessibility、animation discipline、iOS idiom alignment、information density、AI-slop check。

对每个 score < 7 的项，用 AskUserQuestion 呈现 issue 和 recommended fix。

---

## `/ios-clean`

便利 wrapper。防止 DebugBridge 被 ship 到 Release build 的结构性 guard 位于 `Package.swift`（`.when(configuration: .debug)`）和 CI invariant test。`/ios-clean` 适用于想要 guided removal flow，或没有通过 `/ios-qa` 而手动添加 SPM dependency 的 developers。

---

## `/ios-sync`

升级 gstack 或添加新的 `@Observable` classes 后运行。它检测已安装内容，对最新 upstream templates 运行 gen-accessors，refresh changed Swift files，并验证 app rebuild。Cache-key invalidation 会处理 Swift version changes、generator git rev changes 和 source changes。
