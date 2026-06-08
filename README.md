# gstack

> "I don't think I've typed like a line of code probably since December, basically, which is an extremely large change." — [Andrej Karpathy](https://fortune.com/2026/03/21/andrej-karpathy-openai-cofounder-ai-agents-coding-state-of-psychosis-openclaw/), No Priors podcast, March 2026

听到 Karpathy 这句话时，我想知道他是怎么做到的。一个人如何像二十人的团队一样 ship？Peter Steinberger 基本靠 AI agents 单人构建了 [OpenClaw](https://github.com/openclaw/openclaw)，它有 247K GitHub stars。革命已经到来。一个拥有正确工具的 single builder，可以比传统团队移动得更快。

我是 [Garry Tan](https://x.com/garrytan)，[Y Combinator](https://www.ycombinator.com/) 的 President & CEO。我和数千家 startups 合作过，包括 Coinbase、Instacart、Rippling，那时它们还只是车库里的一两个人。在 YC 之前，我是 Palantir 最早的 eng/PM/designer 之一，共同创办了 Posterous（后卖给 Twitter），并构建了 YC 内部社交网络 Bookface。

**gstack 是我的答案。**我构建产品已经二十年，而现在我 ship 的产品比以往任何时候都多。过去 60 天：3 个 production services、40+ shipped features，而且是在全职运营 YC 的同时 part-time 完成。按 logical code change 计算，而不是 AI 会膨胀的 raw LOC，我 2026 年的 run rate 是 **~810× 我 2013 年的速度**（11,417 vs 14 logical lines/day）。Year-to-date（截至 4 月 18 日），2026 年已经产出了 **整个 2013 年的 240×**。这个统计覆盖包含 Bookface 在内的 40 个 public + private `garrytan/*` repos，并排除了一个 demo repo。大多数代码由 AI 编写。重点不是谁敲了代码，而是什么被 ship 了。

> LOC 批评者说 raw line counts 会被 AI 膨胀，这并没错。他们错在认为归一化通胀之后，我的生产力下降了。实际上我生产力大幅提高。完整方法、注意事项和复现脚本见：**[On the LOC Controversy](docs/ON_THE_LOC_CONTROVERSY.md)**。

**2026 — 1,237 contributions，并且还在增加：**

![GitHub contributions 2026 — 1,237 contributions, massive acceleration in Jan-Mar](docs/images/github-2026.png)

**2013 — 我在 YC 构建 Bookface 的那一年（772 contributions）：**

![GitHub contributions 2013 — 772 contributions building Bookface at YC](docs/images/github-2013.png)

同一个人。不同的时代。差别在工具。

**gstack 是我做到这一点的方法。**它把 Claude Code 变成一个虚拟工程团队：重新思考产品的 CEO、锁定架构的 eng manager、捕捉 AI slop 的 designer、发现 production bugs 的 reviewer、打开真实浏览器的 QA lead、运行 OWASP + STRIDE audits 的 security officer，以及负责 ship PR 的 release engineer。二十三个 specialists 和八个 power tools，全都是 slash commands，全都是 Markdown，全都免费，MIT license。

这是我的 open source software factory。我每天都用它。分享它，是因为这些工具应该属于每个人。

Fork 它。改进它。让它成为你的东西。如果你想攻击免费的 open source software，也可以，但我更希望你先试试看。

**适合谁：**
- **创始人和 CEO** — 尤其是仍然想亲自 ship 的 technical founders
- **第一次使用 Claude Code 的用户** — 用结构化角色代替空白 prompt
- **Tech leads 和 staff engineers** — 在每个 PR 上获得严谨 review、QA 和 release automation

## 快速开始

1. 安装 gstack（30 秒，见下方）
2. 运行 `/office-hours`，描述你正在构建什么
3. 对任意 feature idea 运行 `/plan-ceo-review`
4. 对任意有变更的 branch 运行 `/review`
5. 对你的 staging URL 运行 `/qa`
6. 到这里先停下。你会知道它是否适合你。

## 安装 — 30 秒

**要求：**[Claude Code](https://docs.anthropic.com/en/docs/claude-code)、[Git](https://git-scm.com/)、[Bun](https://bun.sh/) v1.0+、[Node.js](https://nodejs.org/)（仅 Windows）

### Step 1：在你的机器上安装

打开 Claude Code 并粘贴下面内容。剩下的交给 Claude。

> Install gstack: run **`git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup`**，然后在 CLAUDE.md 中添加一个 "gstack" section，说明所有 web browsing 都使用 gstack 的 /browse skill，永远不要使用 mcp\_\_claude-in-chrome\_\_\* tools，并列出可用 skills：/office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review, /design-consultation, /design-shotgun, /design-html, /review, /ship, /land-and-deploy, /canary, /benchmark, /browse, /connect-chrome, /qa, /qa-only, /design-review, /setup-browser-cookies, /setup-deploy, /setup-gbrain, /retro, /investigate, /document-release, /document-generate, /codex, /cso, /autoplan, /plan-devex-review, /devex-review, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade, /learn。然后询问用户是否也想把 gstack 添加到当前项目，以便 teammates 也能使用。

### Step 2：Team mode — shared repos 自动更新（推荐）

在你的 repo 内粘贴下面命令。它会切换到 team mode，bootstrap repo，让 teammates 自动获得 gstack，并提交变更：

```bash
(cd ~/.claude/skills/gstack && ./setup --team) && ~/.claude/skills/gstack/bin/gstack-team-init required && git add .claude/ CLAUDE.md && git commit -m "require gstack for AI-assisted work"
```

你的 repo 中不会有 vendored files，没有 version drift，也不需要手动升级。每个 Claude Code session 启动时都会进行快速 auto-update check（限制为每小时一次，网络失败安全，完全静默）。

如果你更想提醒 teammates 而不是阻止他们，把 `required` 换成 `optional`。

### OpenClaw（OpenClaw 支持）

OpenClaw 通过 ACP 生成 Claude Code sessions，因此只要 Claude Code 已安装 gstack，每个 gstack skill 都能直接工作。把下面内容粘贴给你的 OpenClaw agent：

> Install gstack: run `git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup` 为 Claude Code 安装 gstack。然后在 AGENTS.md 中添加 "Coding Tasks" section，说明：为 coding work 生成 Claude Code sessions 时，告诉 session 使用 gstack skills。包含这些示例：security audit: "Load gstack. Run /cso"，code review: "Load gstack. Run /review"，QA test a URL: "Load gstack. Run /qa https://..."，build a feature end-to-end: "Load gstack. Run /autoplan, implement the plan, then run /ship"，plan before building: "Load gstack. Run /office-hours then /autoplan. Save the plan, don't implement."

**设置完成后，直接自然地和 OpenClaw agent 对话：**

| 你说 | 会发生什么 |
|---------|-------------|
| "Fix the typo in README" | 简单任务：Claude Code session，不需要 gstack |
| "Run a security audit on this repo" | 用 `Run /cso` 生成 Claude Code |
| "Build me a notifications feature" | 生成 Claude Code，执行 /autoplan → implement → /ship |
| "Help me plan the v2 API redesign" | 生成 Claude Code，执行 /office-hours → /autoplan，并保存 plan |

高级 dispatch routing 和 gstack-lite/gstack-full prompt templates 见 [docs/OPENCLAW.md](docs/OPENCLAW.md)。

### Native OpenClaw Skills（通过 ClawHub）

四个 methodology skills 可直接在你的 OpenClaw agent 中工作，不需要 Claude Code session。通过 ClawHub 安装：

```
clawhub install gstack-openclaw-office-hours gstack-openclaw-ceo-review gstack-openclaw-investigate gstack-openclaw-retro
```

| Skill | 作用 |
|-------|-------------|
| `gstack-openclaw-office-hours` | 用 6 个 forcing questions 做 product interrogation |
| `gstack-openclaw-ceo-review` | 带 4 种 scope modes 的 strategic challenge |
| `gstack-openclaw-investigate` | Root cause debugging methodology |
| `gstack-openclaw-retro` | Weekly engineering retrospective |

这些是 conversational skills。你的 OpenClaw agent 会直接通过 chat 运行它们。

### 其他 AI Agents

gstack 不只支持 Claude，还支持 10 个 AI coding agents。Setup 会自动检测你安装了哪些 agents：

```bash
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/gstack
cd ~/gstack && ./setup
```

或者用 `./setup --host <name>` 指定 agent：

| Agent | Flag | Skills 安装到 |
|-------|------|-------------------|
| OpenAI Codex CLI | `--host codex` | `~/.codex/skills/gstack-*/` |
| OpenCode | `--host opencode` | `~/.config/opencode/skills/gstack-*/` |
| Cursor | `--host cursor` | `~/.cursor/skills/gstack-*/` |
| Factory Droid | `--host factory` | `~/.factory/skills/gstack-*/` |
| Slate | `--host slate` | `~/.slate/skills/gstack-*/` |
| Kiro | `--host kiro` | `~/.kiro/skills/gstack-*/` |
| Hermes | `--host hermes` | `~/.hermes/skills/gstack-*/` |
| GBrain (mod) | `--host gbrain` | `~/.gbrain/skills/gstack-*/` |

**想增加另一个 agent 的支持？**见 [docs/ADDING_A_HOST.md](docs/ADDING_A_HOST.md)。只需要一个 TypeScript config file，零代码改动。

## 看它如何工作

```
You:    我想为我的日历构建一个 daily briefing app。
You:    /office-hours
Claude: [询问痛点 — 具体例子，而不是假设]

You:    多个 Google calendars，events 信息过期、地点错误。
        准备过程永远做不完，结果也不够好……

Claude: 我要挑战一下这个 framing。你说的是 "daily briefing app"，
        但你实际描述的是一个 personal chief of staff AI。
        [提取 5 个你没意识到自己正在描述的 capabilities]
        [挑战 4 个 premises — 你可以同意、不同意或调整]
        [生成 3 个 implementation approaches，并附 effort estimates]
        RECOMMENDATION: 明天先 ship 最窄切入点，从真实使用中学习。
        完整 vision 是一个 3 个月项目 — 先从真正可用的 daily briefing 开始。
        [写出 design doc → 自动流入 downstream skills]

You:    /plan-ceo-review
        [读取 design doc，挑战 scope，运行 10-section review]

You:    /plan-eng-review
        [为 data flow、state machines、error paths 生成 ASCII diagrams]
        [test matrix、failure modes、security concerns]

You:    Approve plan. Exit plan mode.
        [跨 11 个 files 写入 2,400 行。约 8 分钟。]

You:    /review
        [AUTO-FIXED] 2 issues。[ASK] Race condition → 你批准 fix。

You:    /qa https://staging.myapp.com
        [打开真实 browser，点击 flows，发现并修复一个 bug]

You:    /ship
        Tests: 42 → 51 (+9 new). PR: github.com/you/app/pull/42
```

你说的是 “daily briefing app”。agent 说的是“你在构建 chief of staff AI”，因为它听的是你的痛点，而不是你的 feature request。八个命令，端到端。这不是 copilot。这是一个团队。

## Sprint 流程

gstack 是一个 process，不是一组工具集合。skills 按 sprint 的顺序运行：

**Think → Plan → Build → Review → Test → Ship → Reflect**

每个 skill 都会喂给下一个。`/office-hours` 写出 `/plan-ceo-review` 会读取的 design doc。`/plan-eng-review` 写出 `/qa` 会接手的 test plan。`/review` 捕捉 bugs，`/ship` 验证它们已修复。不会有东西掉进缝隙，因为每一步都知道前面发生了什么。

| Skill | 你的 specialist | 作用 |
|-------|----------------|--------------|
| `/office-hours` | **YC Office Hours** | 从这里开始。用六个 forcing questions 在写代码前重新框定产品。它会挑战你的 framing、质疑 premises、生成实现替代方案。Design doc 会流入所有 downstream skills。 |
| `/plan-ceo-review` | **CEO / Founder** | 重新思考问题。在需求里找出隐藏的 10-star product。四种模式：Expansion、Selective Expansion、Hold Scope、Reduction。 |
| `/plan-eng-review` | **Eng Manager** | 锁定架构、数据流、图、edge cases 和测试。把隐藏假设强制摊开。 |
| `/plan-design-review` | **Senior Designer** | 对每个设计维度按 0-10 评分，解释 10 分长什么样，然后编辑 plan 让它达到那个水平。检测 AI Slop。Interactive：每个设计选择一个 AskUserQuestion。 |
| `/plan-devex-review` | **Developer Experience Lead** | Interactive DX review：探索 developer personas，与竞品 TTHW benchmark，设计 magical moment，逐步追踪摩擦点。三种模式：DX EXPANSION、DX POLISH、DX TRIAGE。20-45 个 forcing questions。 |
| `/design-consultation` | **Design Partner** | 从零构建完整设计系统。研究 landscape，提出 creative risks，生成 realistic product mockups。 |
| `/review` | **Staff Engineer** | 找出能通过 CI 但会在 production 中炸掉的 bugs。自动修复显而易见的问题，并标记 completeness gaps。 |
| `/investigate` | **Debugger** | 系统化 root-cause debugging。铁律：没有调查就不修复。追踪 data flow，测试 hypotheses，三次修复失败后停止。 |
| `/design-review` | **Designer Who Codes** | 执行与 /plan-design-review 相同的 audit，然后修复发现的问题。原子 commits，before/after screenshots。 |
| `/devex-review` | **DX Tester** | Live developer experience audit。真实测试 onboarding：浏览 docs、尝试 getting started flow、计时 TTHW、截图 errors。对比 `/plan-devex-review` 分数，形成检验 plan 是否匹配现实的 boomerang。 |
| `/design-shotgun` | **Design Explorer** | “给我看选项。”生成 4-6 个 AI mockup variants，在浏览器中打开 comparison board，收集反馈并迭代。Taste memory 会学习你喜欢什么。重复直到你喜欢某个方案，再交给 `/design-html`。 |
| `/design-html` | **Design Engineer** | 把 mockup 转成真正可用的 production HTML。Pretext computed layout：文本会随 resize reflow，高度随内容调整，布局是动态的。30KB，zero deps。检测 React/Svelte/Vue。按 landing page、dashboard、form、card layout 等设计类型 smart API routing。输出是可 ship 的，不是 demo。 |
| `/qa` | **QA Lead** | 测试你的 app，找 bugs，用原子 commits 修复并重新验证。为每个 fix 自动生成 regression tests。 |
| `/qa-only` | **QA Reporter** | 方法与 /qa 相同，但只报告，不改代码。纯 bug report。 |
| `/pair-agent` | **Multi-Agent Coordinator** | 与任何 AI agent 共享你的浏览器。一个命令、一段粘贴，即可连接。支持 OpenClaw、Hermes、Codex、Cursor 或任何能 curl 的工具。每个 agent 都有自己的 tab。自动启动 headed mode 让你观看全过程。为远程 agents 自动启动 ngrok tunnel。Scoped tokens、tab isolation、rate limiting、activity attribution。 |
| `/cso` | **Chief Security Officer** | OWASP Top 10 + STRIDE threat model。Zero-noise：17 个 false positive exclusions、8/10+ confidence gate、独立 finding verification。每条 finding 都包含具体 exploit scenario。 |
| `/ship` | **Release Engineer** | Sync main、run tests、audit coverage、push、open PR。如果项目没有 test framework，会自动 bootstrap。 |
| `/land-and-deploy` | **Release Engineer** | Merge PR，等待 CI 和部署，验证 production health。一个命令从 “approved” 到 “verified in production”。 |
| `/canary` | **SRE** | Post-deploy monitoring loop。监控 console errors、performance regressions 和 page failures。 |
| `/benchmark` | **Performance Engineer** | Baseline page load times、Core Web Vitals 和 resource sizes。每个 PR 做 before/after 对比。 |
| `/document-release` | **Technical Writer** | 更新所有项目文档，使其匹配刚刚 ship 的内容。自动捕捉 stale READMEs。构建 Diataxis coverage map（reference / how-to / tutorial / explanation），让 PR body 中的 gaps 可见。 |
| `/document-generate` | **Documentation Author** | 使用 Diataxis framework 从零生成缺失文档。先研究 codebase，再写出真正匹配代码的 reference / how-to / tutorial / explanation docs。可独立调用，也可在 `/document-release` 发现 coverage gaps 时串联调用。更多：[tutorial](docs/tutorial-document-generate.md) • [how-to](docs/howto-document-a-shipped-feature.md) • [why Diataxis](docs/explanation-diataxis-in-gstack.md)。 |
| `/retro` | **Eng Manager** | Team-aware weekly retro。按人拆分、shipping streaks、test health trends、growth opportunities。`/retro global` 会跨所有项目和 AI tools（Claude Code、Codex、Gemini）运行。 |
| `/browse` | **QA Engineer** | 给 agent 眼睛。真实 Chromium browser、真实点击、真实 screenshots。每个 command 约 100ms。`/open-gstack-browser` 启动带 sidebar、anti-bot stealth 和 auto model routing 的 GStack Browser。 |
| `/setup-browser-cookies` | **Session Manager** | 从你的真实浏览器（Chrome、Arc、Brave、Edge）导入 cookies 到 headless session。测试 authenticated pages。 |
| `/autoplan` | **Review Pipeline** | 一个命令得到完整 review 后的 plan。用 encoded decision principles 自动运行 CEO → design → eng review。只把 taste decisions 暴露给你批准。 |
| `/spec` | **Spec Author** | 将模糊意图转为五阶段精确可执行 spec（why、scope、technical with mandatory code-reading、draft、file）。写入 file 前有 Codex quality gate（低于 7/10 阻止），fail-closed secret redaction，针对既有 issues 去重，并归档到 `$GSTACK_STATE_ROOT/projects/$SLUG/specs/` 供 team-corpus recall。`--execute` 会在 fresh worktree 中生成 `claude -p`；`/ship` 在 merge 后自动关闭 source issue。Plan-mode aware。 |
| `/learn` | **Memory** | 管理 gstack 跨 sessions 学到的内容。Review、search、prune 并导出 project-specific patterns、pitfalls 和 preferences。Learnings 会跨 sessions 复利，让 gstack 随着时间更懂你的 codebase。 |

### 我该用哪个 review？

| 构建对象 | Plan stage（写代码前） | Live audit（shipping 后） |
|-----------------|--------------------------|----------------------------|
| **End users**（UI、web app、mobile） | `/plan-design-review` | `/design-review` |
| **Developers**（API、CLI、SDK、docs） | `/plan-devex-review` | `/devex-review` |
| **架构**（data flow、perf、tests） | `/plan-eng-review` | `/review` |
| **以上全部** | `/autoplan`（运行 CEO → design → eng → DX，并自动检测适用项） | — |

### Power tools（增强工具）

| Skill | 作用 |
|-------|-------------|
| `/codex` | **Second Opinion** — 来自 OpenAI Codex CLI 的独立 code review。三种模式：review（pass/fail gate）、adversarial challenge、open consultation。当 `/review` 和 `/codex` 都 review 过同一 branch 时，会做 cross-model analysis。 |
| `/careful` | **Safety Guardrails** — 在破坏性命令前警告（rm -rf、DROP TABLE、force-push）。说 “be careful” 即可激活。任何警告都可 override。 |
| `/freeze` | **Edit Lock** — 将文件编辑限制到一个目录。调试时防止意外改到 scope 外代码。 |
| `/guard` | **Full Safety** — 一个命令启用 `/careful` + `/freeze`。适合 prod work 的最大安全性。 |
| `/unfreeze` | **Unlock** — 移除 `/freeze` boundary。 |
| `/open-gstack-browser` | **GStack Browser** — 启动 GStack Browser，带 sidebar、anti-bot stealth、auto model routing（Sonnet 做 actions，Opus 做 analysis）、one-click cookie import 和 Claude Code integration。清理页面、拍 smart screenshots、编辑 CSS，并把信息传回 terminal。 |
| `/setup-deploy` | **Deploy Configurator** — 为 `/land-and-deploy` 做一次性 setup。检测你的平台、production URL 和 deploy commands。 |
| `/setup-gbrain` | **GBrain Onboarding** — 5 分钟内从零到运行 gbrain。PGLite local、已有 Supabase URL，或通过 Management API 自动 provision 新 Supabase project。为 Claude Code 注册 MCP，并设置 per-repo trust triad（read-write/read-only/deny）。[完整指南](USING_GBRAIN_WITH_GSTACK.md)。 |
| `/sync-gbrain` | **Keep Brain Current** — 通过 `gbrain sources add` + `gbrain sync --strategy code` 将本 repo 代码重新索引进 gbrain，刷新 CLAUDE.md 中的 `## GBrain Search Guidance` block，并在 capability check 失败时自动移除 guidance。`--incremental`（默认）、`--full`、`--dry-run`。Idempotent，可安全重复运行。 |
| `/gstack-upgrade` | **Self-Updater** — 将 gstack 升级到最新版。检测 global vs vendored install，同步两者，并展示变更。 |
| `/ios-qa` | **iOS Live-Device QA（v1.43.0.0+）** — 通过 USB CoreDevice 和 app 内 embedded `StateServer` 驱动真实 iPhone。读取 Swift source，codegen typed `@Observable` accessors，运行 agent loop。可选 `--tailnet` flag 将设备暴露给 OpenClaw 或任何 HTTP-capable agent，让远程 agents 可通过 Tailscale tailnet 运行 iOS QA，而无需接触硬件。Capability-tier allowlist（observe/interact/mutate/restore）、per-device session lock、audit log。 |
| `/ios-fix`, `/ios-design-review`, `/ios-clean`, `/ios-sync` | iOS bug-fix loop、designer's-eye HIG audit、debug-bridge cleanup 和 accessor resync。见 `docs/skills.md`。端到端 walkthrough：[docs/howto-ios-testing-with-gstack.md](docs/howto-ios-testing-with-gstack.md)。 |

### 新 binaries（v0.19）

除了 slash-command skills，gstack 还提供 standalone CLIs，用于那些不适合放在 session 内的 workflows：

| Command | 作用 |
|---------|-------------|
| `gstack-model-benchmark` | **Cross-model benchmark** — 用同一个 prompt 跑 Claude、GPT（通过 Codex CLI）和 Gemini；比较 latency、tokens、cost，以及可选的 LLM-judge quality score。按 provider 检测 auth，不可用 provider 会干净 skip。输出为 table、JSON 或 markdown。`--dry-run` 会验证 flags + auth，不消耗 API calls。 |
| `gstack-taste-update` | **Design taste learning** — 将 `/design-shotgun` 中的 approvals 和 rejections 写入持久 per-project taste profile。每周衰减 5%。回流到未来 variant generation，让系统学习你实际选择什么。 |
| `gstack-ios-qa-daemon` | **iOS QA daemon** — Mac-side broker，连接 agent 与通过 USB CoreDevice 连接的 iPhone。默认 loopback；`--tailnet` 打开面向 Tailscale 的 listener，带 identity-gated capability tiers。通过 `~/.gstack/ios-qa-daemon.pid` 上的 flock 保证 single-instance。见 [docs/howto-ios-testing-with-gstack.md](docs/howto-ios-testing-with-gstack.md)。 |
| `gstack-ios-qa-mint` | **iOS allowlist manager** — tailnet allowlist 的 owner-grant CLI。针对 `~/.gstack/ios-qa-allowlist.json`（mode 0600）执行 `grant`/`revoke`/`list`。Remote agents 永远不会 auto-allowlist；这是 explicit-intent path。 |

### Continuous checkpoint mode（opt-in，默认 local）

设置 `gstack-config set checkpoint_mode continuous` 后，skills 会随着工作自动 commit，使用 `WIP:` prefix，并带结构化 `[gstack-context]` body（decisions、remaining work、failed approaches）。它可以 survive crashes 和 context switches。`/context-restore` 读取这些 commits 来重建 session state。`/ship` 会在 PR 前 filter-squash WIP commits（保留 non-WIP commits），让 bisect 保持干净。Push 需要通过 `checkpoint_push=true` opt-in；默认 local-only，避免每个 WIP commit 都触发 CI。

### Domain skills + raw CDP escape hatch（Domain skills 与 raw CDP 逃生口）

两个新的 browser primitives 会让 gstack agent 随时间复利：

- **`$B domain-skill save`** — agent 保存 per-site note（例如 “LinkedIn's Apply button lives in an iframe”），下次访问同一 hostname 时自动触发。Quarantined → 3 次成功使用后 active → 可选通过 `$B domain-skill promote-to-global` 做 cross-project promotion。存储位置与 `/learn` 的 per-project learnings file 相邻。完整 reference：**[docs/domain-skills.md](docs/domain-skills.md)**。
- **`$B cdp <Domain.method>`** — raw Chrome DevTools Protocol escape hatch，用于 curated commands 漏掉的少数情况。Deny-default：methods 必须显式添加到 `browse/src/cdp-allowlist.ts`，并附一行 justification。Two-tier mutex 会把 browser-scoped CDP calls 与 per-tab work 串行化。Data-exfil methods 的输出会包在 UNTRUSTED envelope 中。

> 想要没有 rails、没有 allowlist、没有 daemon 的 raw CDP，只要 agent 到 Chrome 的 thin transport？[browser-use/browser-harness-js](https://github.com/browser-use/browser-harness-js) 是另一种哲学（agent-authored helpers vs gstack 的 curated commands），如果你不想要 gstack 的 security stack，它很合适。两者可以共存：gstack 的 `$B cdp` 和 harness 都可以通过 Playwright 的 `newCDPSession` attach 到同一个 Chrome。

**[每个 skill 的深入指南、示例和哲学 →](docs/skills.md)**

### Karpathy 的四种 failure modes？已经覆盖。

Andrej Karpathy 的 [AI coding rules](https://github.com/forrestchang/andrej-karpathy-skills)（17K stars）精准指出四种 failure modes：wrong assumptions、overcomplexity、orthogonal edits、imperative over declarative。gstack 的 workflow skills 会 enforce 这四点。`/office-hours` 在写代码前强制把 assumptions 摊开。Confusion Protocol 阻止 Claude 在 architectural decisions 上猜测。`/review` 捕捉 unnecessary complexity 和 drive-by edits。`/ship` 用 test-first execution 把 tasks 转成 verifiable goals。如果你已经使用 Karpathy-style CLAUDE.md rules，gstack 就是 workflow enforcement layer，让它们贯穿整个 sprints，而不只是单个 prompts。

## Parallel sprints（并行 sprint）

gstack 对一个 sprint 很有用。当十个 sprint 同时运行时，它会变得有趣。

**Design 是核心。**`/design-consultation` 从零构建你的 design system，研究已有方案，提出 creative risks，并写入 `DESIGN.md`。但真正的魔法是 shotgun-to-HTML pipeline。

**`/design-shotgun` 是探索方式。**你描述想要什么。它用 GPT Image 生成 4-6 个 AI mockup variants，然后在浏览器中打开 comparison board，把所有 variants 并排展示。你选择 favorites，留下反馈（“more whitespace”、“bolder headline”、“lose the gradient”），它再生成新一轮。重复直到你喜欢某个方案。几轮后 taste memory 生效，开始偏向你实际喜欢的东西。不再需要用文字描述愿景并祈祷 AI 理解；你会看到选项，挑出好的，并用视觉方式迭代。

**`/design-html` 让它变成现实。**把已批准的 mockup（来自 `/design-shotgun`、CEO plan、design review，或只是一段描述）转成 production-quality HTML/CSS。不是那种只在一个 viewport width 看起来正常、到处都会坏的 AI HTML。它使用 Pretext 做 computed text layout：文本真的会在 resize 时 reflow，高度随内容调整，布局是动态的。30KB overhead，zero dependencies。它检测你的 framework（React、Svelte、Vue），并输出正确格式。Smart API routing 会根据 landing page、dashboard、form 或 card layout 选择不同 Pretext patterns。输出是你真的会 ship 的东西，不是 demo。

**`/qa` 是巨大 unlock。**它让我从 6 个 parallel workers 提升到 12 个。Claude Code 说 *"I SEE THE ISSUE"*，然后真的修复它、生成 regression test、验证 fix，这改变了我的工作方式。现在 agent 有眼睛了。

**Smart review routing。**就像运营良好的 startup：CEO 不必看 infra bug fixes，backend changes 不需要 design review。gstack 跟踪已运行的 reviews，判断什么适用，然后做聪明的事。Review Readiness Dashboard 会在 ship 前告诉你当前位置。

**测试一切。**如果你的项目没有 test framework，`/ship` 会从零 bootstrap。每次 `/ship` run 都会生成 coverage audit。每个 `/qa` bug fix 都会生成 regression test。目标是 100% test coverage；tests 让 vibe coding 变得安全，而不是 yolo coding。

**`/document-release` 是你从未拥有过的 engineer。**它读取项目中的每个 doc file，对照 diff，并更新所有 drifted 内容。README、ARCHITECTURE、CONTRIBUTING、CLAUDE.md、TODOS 都会自动保持最新。现在 `/ship` 会 auto-invoke 它，docs 无需额外命令也能保持 current。

**Real browser mode。**`/open-gstack-browser` 启动 GStack Browser，一个 AI-controlled Chromium，内置 anti-bot stealth、custom branding 和 sidebar extension。Google、NYTimes 这类站点无需 captcha 即可工作。菜单栏显示 “GStack Browser”，而不是 “Chrome for Testing”。你的常规 Chrome 不受影响。所有现有 browse commands 保持不变。`$B disconnect` 返回 headless。只要窗口打开，浏览器就保持 alive，不会有 idle timeout 在你工作时杀掉它。

**Sidebar agent — 你的 AI browser assistant。**在 Chrome side panel 中输入自然语言，一个 child Claude instance 会执行它。“Navigate to the settings page and screenshot it.” “Fill out this form with test data.” “Go through every item in this list and extract the prices.” sidebar 会 auto-route 到正确 model：Sonnet 做快速 actions（click、navigate、screenshot），Opus 做 reading 和 analysis。每个 task 最多 5 分钟。sidebar agent 在 isolated session 中运行，不会干扰你的主 Claude Code window。sidebar footer 可 one-click cookie import。

**Personal automation。**sidebar agent 不只服务 dev workflows。例如：“Browse my kid's school parent portal and add all the other parents' names, phone numbers, and photos to my Google Contacts.” 有两种 authenticated 方式：（1）在 headed browser 中登录一次，session 会持久化；（2）点击 sidebar footer 的 “cookies” 按钮，从真实 Chrome 导入 cookies。Authenticated 后，Claude 会浏览 directory、抽取数据并创建 contacts。

**Prompt injection defense。**恶意网页会试图劫持你的 sidebar agent。gstack 提供 layered defense：随浏览器捆绑的 22MB ML classifier 会本地扫描每个 page 和 tool output；Claude Haiku transcript check 会对完整 conversation shape 投票；system prompt 中的随机 canary token 会跨 text、tool args、URLs、file writes 捕捉 session exfil attempts；verdict combiner 要求两个 classifiers 同意才 block（避免 Stack Overflow-style instruction pages 上的 single-model false positives）。sidebar header 的 shield icon 显示状态（green/amber/red）。通过 `GSTACK_SECURITY_ENSEMBLE=deberta` opt in 721MB DeBERTa-v3 ensemble，获得 2-of-3 agreement。Emergency kill switch：`GSTACK_SECURITY_OFF=1`。完整 stack 见 [ARCHITECTURE.md](ARCHITECTURE.md#prompt-injection-defense-sidebar-agent)。

**AI 卡住时的 browser handoff。**遇到 CAPTCHA、auth wall 或 MFA prompt？`$B handoff` 会在完全相同页面打开一个可见 Chrome，并保留所有 cookies 和 tabs。你解决问题，告诉 Claude 完成，然后 `$B resume` 从中断处继续。连续 3 次失败后，agent 甚至会自动建议这样做。

**`/pair-agent` 是 cross-agent coordination。**你在 Claude Code 中，同时也运行着 OpenClaw，或者 Hermes，或者 Codex。你想让它们都看同一个网站。输入 `/pair-agent`，选择你的 agent，一个 GStack Browser window 会打开供你观看。skill 会打印一段 instructions。把那段粘贴到另一个 agent 的 chat 中。它用 one-time setup key 交换 session token，创建自己的 tab 并开始 browsing。你会看到两个 agents 在同一浏览器中工作，各自拥有自己的 tab，彼此无法干扰。如果安装了 ngrok，tunnel 会自动启动，让另一个 agent 可以在完全不同的机器上。Same-machine agents 有零摩擦 shortcut，可直接写入 credentials。这是第一次来自不同 vendors 的 AI agents 能通过共享浏览器安全协作：scoped tokens、tab isolation、rate limiting、domain restrictions、activity attribution。

**Multi-AI second opinion。**`/codex` 从 OpenAI 的 Codex CLI 获取独立 review，也就是让完全不同的 AI 看同一个 diff。三种模式：带 pass/fail gate 的 code review、主动尝试破坏代码的 adversarial challenge、带 session continuity 的 open consultation。当 `/review`（Claude）和 `/codex`（OpenAI）都 review 过同一 branch 时，你会得到 cross-model analysis，展示哪些 findings 重叠，哪些是各自独有。

**按需 safety guardrails。**说 “be careful”，`/careful` 就会在任何破坏性命令前警告：rm -rf、DROP TABLE、force-push、git reset --hard。`/freeze` 在调试时把 edits 锁到一个目录，避免 Claude 意外“修复”无关代码。`/guard` 同时激活两者。`/investigate` 会自动 freeze 到正在调查的 module。

**Proactive skill suggestions。**gstack 会注意你处于什么阶段：brainstorming、reviewing、debugging、testing，然后建议正确 skill。不喜欢？说 “stop suggesting”，它会跨 sessions 记住。

## 10-15 parallel sprints

gstack 对一个 sprint 已经很强。当十个同时运行时，它会产生质变。

[Conductor](https://conductor.build) 并行运行多个 Claude Code sessions，每个都有自己的 isolated workspace。一个 session 对新想法运行 `/office-hours`，另一个对 PR 做 `/review`，第三个实现 feature，第四个在 staging 上跑 `/qa`，还有六个在其他 branches 上工作。全部同时发生。我经常运行 10-15 个 parallel sprints，这是目前的实际上限。

sprint structure 让 parallelism 能工作。没有 process，十个 agents 就是十个混乱源。有了 process：think、plan、build、review、test、ship，每个 agent 都知道该做什么、何时停止。你像 CEO 管理团队一样管理它们：检查重要决策，其余让它们运行。

### Voice input（AquaVoice、Whisper 等）

gstack skills 有 voice-friendly trigger phrases。自然地说你想要什么：“run a security check”、“test the website”、“do an engineering review”，正确 skill 就会激活。你不需要记住 slash command names 或 acronyms。

## 卸载

### Option 1：运行 uninstall script

如果你的机器已安装 gstack：

```bash
~/.claude/skills/gstack/bin/gstack-uninstall
```

它会处理 skills、symlinks、global state（`~/.gstack/`）、project-local state、browse daemons 和 temp files。使用 `--keep-state` 保留 config 和 analytics。使用 `--force` 跳过确认。

### Option 2：手动移除（没有 local repo）

如果你没有 clone repo（例如通过 Claude Code paste 安装，后来删除了 clone）：

```bash
# 1. Stop browse daemons
pkill -f "gstack.*browse" 2>/dev/null || true

# 2. Remove per-skill directories whose SKILL.md points into gstack/
find ~/.claude/skills -mindepth 1 -maxdepth 1 -type d ! -name gstack 2>/dev/null |
while IFS= read -r dir; do
  link="$dir/SKILL.md"
  [ -L "$link" ] || continue
  target=$(readlink "$link" 2>/dev/null) || continue
  case "$target" in
    gstack/*|*/gstack/*)
      rm -f "$link"
      rmdir "$dir" 2>/dev/null || true
      ;;
  esac
done

# 3. 移除 gstack
rm -rf ~/.claude/skills/gstack

# 4. 移除 global state
rm -rf ~/.gstack

# 5. 移除 integrations（跳过从未安装的项）
rm -rf ~/.codex/skills/gstack* 2>/dev/null
rm -rf ~/.factory/skills/gstack* 2>/dev/null
rm -rf ~/.kiro/skills/gstack* 2>/dev/null
rm -rf ~/.openclaw/skills/gstack* 2>/dev/null

# 6. 移除 temp files
rm -f /tmp/gstack-* 2>/dev/null

# 7. Per-project cleanup（在每个 project root 中运行）
rm -rf .gstack .gstack-worktrees .claude/skills/gstack 2>/dev/null
rm -rf .agents/skills/gstack* .factory/skills/gstack* 2>/dev/null
```

### 清理 CLAUDE.md

uninstall script 不会编辑 CLAUDE.md。在每个添加过 gstack 的项目中，移除 `## gstack` 和 `## Skill routing` sections。

### Playwright（Playwright 说明）

`~/Library/Caches/ms-playwright/`（macOS）会保留，因为其他工具可能共享它。如果没有其他工具需要，可以删除。

---

免费，MIT licensed，open source。没有 premium tier，没有 waitlist。

我 open sourced 了我构建软件的方式。你可以 fork 它，让它成为自己的东西。

> **We're hiring.** 想以 AI-coding speed ship 真实产品，并帮助 harden gstack？
> 来 YC 工作：[ycombinator.com/software](https://ycombinator.com/software)
> 极具竞争力的 salary 和 equity。San Francisco，Dogpatch District。

## GBrain — 给 coding agent 的 persistent knowledge

[GBrain](https://github.com/garrytan/gbrain) 是 AI agents 的 persistent knowledge base，可以把它理解成 agent 在 sessions 之间真正保留下来的 memory。GStack 提供一个命令，让你从零走到“它已经运行，我的 agent 可以调用它”。

```bash
/setup-gbrain
```

四条路径，选一条：

- **Supabase, existing URL** — 你的 cloud agent 已经 provisioned 一个 brain；粘贴 Session Pooler URL，这台 laptop 就会使用同一份数据。
- **Supabase, auto-provision** — 粘贴 Supabase Personal Access Token；skill 创建新 project，轮询到 healthy，获取 pooler URL，并交给 `gbrain init`。端到端约 90 秒。
- **PGLite local** — 零账号、零网络，约 30 秒。只在这台 Mac 上隔离使用的 brain。适合先试用；之后可用 `/setup-gbrain --switch` 迁移到 Supabase。
- **Remote gbrain MCP** — 你的 brain 运行在另一台机器（Tailscale、ngrok、internal LAN）或 teammate 的 server 上；粘贴 MCP URL 和 bearer token。可选搭配 local PGLite，在 split-engine mode 中做 symbol-aware code search。最适合不搭本地 DB 的 cross-machine memory。

init 后，skill 会提示把 gbrain 注册为 Claude Code 的 MCP server（`claude mcp add gbrain -- gbrain serve`），这样 `gbrain search`、`gbrain put` 等会作为 first-class typed tools 出现，而不是 bash shell-outs。

**保持 brain current。**在任意 repo 中运行 `/sync-gbrain`，即可将代码重新索引进 gbrain（默认 incremental，`--full` 做 full reindex，`--dry-run` 预览）。该 skill 通过 `gbrain sources add` 将 cwd 注册为 federated source，运行 `gbrain sync --strategy code`，并向项目 CLAUDE.md 写入 `## GBrain Search Guidance` block，让 agent 优先使用 `gbrain search`/`code-def`/`code-refs` 而不是 Grep。如果 capability check 失败，该 block 会自动移除，避免 stale guidance 指向未安装工具。

**Per-remote trust policy。**你机器上的每个 repo 都会获得三种 tier 之一：

- `read-write` — agent 可以搜索 brain，也可以从这个 repo 写入新 pages。
- `read-only` — agent 可以搜索但永不写入（适合 multi-client consultants：搜索 shared brain，但在 Client B repo 中工作时不要用 Client A 的内容污染它）。
- `deny` — 完全不与 gbrain 交互。

skill 对每个 repo 只问一次。决策会在同一 remote 的 worktrees 和 branches 间保持 sticky。

**GStack memory sync（另一个 feature，但使用同一套 private-repo infra）。**可选把你的 gstack state（learnings、CEO plans、design docs、retros、developer profile）push 到 private git repo，让 memory 跨机器跟随你。它带一次性 privacy prompt（everything allowlisted / artifacts only / off），以及 defense-in-depth secret scanner，在内容离开机器前阻止 AWS keys、tokens、PEM blocks 和 JWTs。

```bash
gstack-brain-init
```

**在 Conductor 中运行 gstack？**Conductor 会显式从每个 workspace 的 process env 中剥离 `ANTHROPIC_API_KEY` 和 `OPENAI_API_KEY`，因此 paid evals 和 gbrain embeddings 默认无法工作。请改在 Conductor 的 workspace env config 中设置 `GSTACK_ANTHROPIC_API_KEY` 和 `GSTACK_OPENAI_API_KEY`；gstack 的 TS entry points 会在 runtime 将它们提升为 canonical names。完整细节和给新 entry points 添加 import 的 contributor checklist 见：[Conductor + GSTACK_* env vars](USING_GBRAIN_WITH_GSTACK.md#conductor--gstack_-env-vars)。

**完整版：每个 scenario、每个 flag、每个 bin helper、每个 troubleshooting step：**[USING_GBRAIN_WITH_GSTACK.md](USING_GBRAIN_WITH_GSTACK.md)

其他 reference：[docs/gbrain-sync.md](docs/gbrain-sync.md)（sync-specific guide）• [docs/gbrain-sync-errors.md](docs/gbrain-sync-errors.md)（error index）

## 文档

| Doc | 覆盖内容 |
|-----|---------------|
| [Skill Deep Dives](docs/skills.md) | 每个 skill 的理念、示例和工作流（包含 Greptile integration） |
| [Builder Ethos](ETHOS.md) | Builder philosophy：Boil the Ocean、Search Before Building、三层知识 |
| [Using GBrain with GStack](USING_GBRAIN_WITH_GSTACK.md) | `/setup-gbrain` 的所有 path、flag、bin helper 和 troubleshooting step |
| [GBrain Sync](docs/gbrain-sync.md) | 跨机器 memory setup、privacy modes 和 troubleshooting |
| [Architecture](ARCHITECTURE.md) | 设计决策和系统内部机制 |
| [Browser Reference](BROWSER.md) | `/browse` 的完整 command reference |
| [Contributing](CONTRIBUTING.md) | Dev setup、testing、contributor mode 和 dev mode |
| [Changelog](CHANGELOG.md) | 每个版本的新内容 |

## Privacy & Telemetry（隐私与遥测）

gstack 包含 **opt-in** usage telemetry，用于帮助改进项目。具体如下：

- **默认关闭。**除非你明确同意，否则不会向任何地方发送任何内容。
- **首次运行时，**gstack 会询问你是否愿意分享 anonymous usage data。你可以拒绝。
- **会发送什么（如果 opt in）：**skill name、duration、success/fail、gstack version、OS。仅此而已。
- **永远不会发送什么：**代码、file paths、repo names、branch names、prompts，或任何 user-generated content。
- **随时更改：**`gstack-config set telemetry off` 会立即禁用全部 telemetry。

数据存储在 [Supabase](https://supabase.com)（open source Firebase alternative）。schema 位于 [`supabase/migrations/`](supabase/migrations/)，你可以精确验证收集了什么。Repo 中的 Supabase publishable key 是 public key（类似 Firebase API key）；row-level security policies 会拒绝所有直接访问。Telemetry 通过 validated edge functions 流转，强制执行 schema checks、event type allowlists 和 field length limits。

**Local analytics 始终可用。**运行 `gstack-analytics` 可从本地 JSONL file 查看个人 usage dashboard，无需 remote data。

## 故障排查

**Skill 没出现？** `cd ~/.claude/skills/gstack && ./setup`

**`/browse` 失败？** `cd ~/.claude/skills/gstack && bun install && bun run build`

**Install 过旧？**运行 `/gstack-upgrade`，或在 `~/.gstack/config.yaml` 中设置 `auto_upgrade: true`。

**想要更短命令？** `cd ~/.claude/skills/gstack && ./setup --no-prefix`，会从 `/gstack-qa` 切到 `/qa`。你的选择会在未来 upgrades 中记住。

**想要 namespaced commands？** `cd ~/.claude/skills/gstack && ./setup --prefix`，会从 `/qa` 切到 `/gstack-qa`。如果你同时运行其他 skill packs，这很有用。

**Codex 说 “Skipped loading skill(s) due to invalid SKILL.md”？**你的 Codex skill descriptions 过旧。修复：`cd ~/.codex/skills/gstack && git pull && ./setup --host codex`；repo-local installs 则用：`cd "$(readlink -f .agents/skills/gstack)" && git pull && ./setup --host codex`。

**Windows users：**gstack 可通过 Git Bash 或 WSL 在 Windows 11 上工作。除了 Bun 还需要 Node.js，因为 Bun 在 Windows 上的 Playwright pipe transport 有已知 bug（[bun#4253](https://github.com/oven-sh/bun/issues/4253)）。browse server 会自动 fallback 到 Node.js。请确认 `bun` 和 `node` 都在 PATH 中。

在没有 Developer Mode 的 Windows（MSYS2 / Git Bash）上，`setup` 会 fallback 到 file copies 而不是 symlinks，因为 `ln -snf` 会产生不会随 `git pull` 刷新的 frozen copies。**每次 `git pull` 后重新运行 `cd ~/.claude/skills/gstack && ./setup`**，确保 skill files 匹配 repo。`setup` 会打印一行 note 提醒你。Unix 和 WSL 保持 symlinks，不需要重新运行。

**Claude 说看不到 skills？**确认项目的 `CLAUDE.md` 有 gstack section。添加：

```
## gstack（项目说明）
Use /browse from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.
Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review,
/design-consultation, /design-shotgun, /design-html, /review, /ship, /land-and-deploy,
/canary, /benchmark, /browse, /open-gstack-browser, /qa, /qa-only, /design-review,
/setup-browser-cookies, /setup-deploy, /setup-gbrain, /sync-gbrain, /retro, /investigate,
/document-release, /document-generate, /codex, /cso, /autoplan, /pair-agent, /careful, /freeze,
/guard, /unfreeze, /gstack-upgrade, /learn.
```

## License（许可证）

MIT。永久免费。去构建点什么。
