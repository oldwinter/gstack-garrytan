# gstack development（gstack 开发）

## Commands（命令）

```bash
bun install          # 安装依赖
bun test             # 运行免费测试（browse + snapshot + skill validation）
bun run test:evals   # 运行付费 evals：LLM judge + E2E（基于 diff，最多约 ~$4/run）
bun run test:evals:all  # 无视 diff，运行所有付费 evals
bun run test:gate    # 仅运行 gate-tier tests（CI 默认，阻止 merge）
bun run test:periodic  # 仅运行 periodic-tier tests（weekly cron / manual）
bun run test:e2e     # 仅运行 E2E tests（基于 diff，最多约 ~$3.85/run）
bun run test:e2e:all # 无视 diff，运行所有 E2E tests
bun run eval:select  # 根据当前 diff 显示会运行哪些 tests
bun run dev <cmd>    # 以 dev mode 运行 CLI，例如 bun run dev goto https://example.com
bun run build        # 生成 docs + 编译 binaries
bun run gen:skill-docs  # 从 templates 重新生成 SKILL.md files
bun run skill:check  # 所有 skills 的 health dashboard
bun run dev:skill    # watch mode：变更时自动 regen + validate
bun run eval:list    # 列出 ~/.gstack-dev/evals/ 中的所有 eval runs
bun run eval:compare # 比较两个 eval runs（自动选择最近两次）
bun run eval:summary # 聚合所有 eval runs 的 stats
bun run slop          # 完整 slop-scan report（所有文件）
bun run slop:diff     # 仅检查当前 branch changed files 的 slop findings
```

`test:evals` 需要 `ANTHROPIC_API_KEY`。Codex E2E tests（`test/codex-e2e.test.ts`）使用 `~/.codex/` config 中 Codex 自己的 auth，不需要 `OPENAI_API_KEY` env var。

**Conductor workspaces 中的 env keys。** `GSTACK_*` env-shim（v1.39.2.0+，`lib/conductor-env-shim.ts`）会在 gstack 的 TS binaries 内把 `GSTACK_ANTHROPIC_API_KEY` / `GSTACK_OPENAI_API_KEY` 提升为 canonical names。通过 gstack entrypoints 运行的 tests 会自动继承这个提升。不要把 key value echo 到 stdout、logs 或 shell history。传给 test 的 Agent SDK 时，不要把 `env: {...}` 传给 `runAgentSdkTest`，因为以 object 形式提供 env 时，SDK 的 auth pipeline 不会以同样方式获取 key（已确认的 failure mode）。应在调用前 ambiently 修改 `process.env.ANTHROPIC_API_KEY`，并在 `finally` 中 restore。

E2E tests 会实时 stream progress（通过 `--output-format stream-json --verbose`，逐 tool 输出）。结果持久化到 `~/.gstack-dev/evals/`，并自动与上一次 run 比较。

**Diff-based test selection：**`test:evals` 和 `test:e2e` 会根据相对 base branch 的 `git diff` 自动选择 tests。每个 test 在 `test/helpers/touchfiles.ts` 中声明文件依赖。global touchfiles（session-runner、eval-store、touchfiles.ts 本身）的变更会触发所有 tests。使用 `EVALS_ALL=1` 或 `:all` script variants 可强制运行所有 tests。运行 `eval:select` 可预览会运行哪些 tests。

**Two-tier system：**Tests 在 `E2E_TIERS`（位于 `test/helpers/touchfiles.ts`）中分类为 `gate` 或 `periodic`。CI 只运行 gate tests（`EVALS_TIER=gate`）；periodic tests 每周通过 cron 或手动运行。使用 `EVALS_TIER=gate` 或 `EVALS_TIER=periodic` 过滤。新增 E2E tests 时这样分类：
1. Safety guardrail 或 deterministic functional test？-> `gate`
2. Quality benchmark、Opus model test 或 non-deterministic？-> `periodic`
3. 需要 external service（Codex、Gemini）？-> `periodic`

## Testing（测试）

```bash
bun test             # 每次 commit 前运行，免费，<2s
bun run test:evals   # ship 前运行，付费，基于 diff（最多约 $4/run）
```

`bun test` 会运行 skill validation、gen-skill-docs quality checks 和 browse integration tests。`bun run test:evals` 会运行 LLM-judge quality evals，并通过 `claude -p` 运行 E2E tests。创建 PR 前两者都必须通过。

## Project structure（项目结构）

```
gstack/
├── browse/          # Headless browser CLI (Playwright)
│   ├── src/         # CLI + server + commands
│   │   ├── commands.ts  # Command registry (single source of truth)
│   │   └── snapshot.ts  # SNAPSHOT_FLAGS metadata array
│   ├── test/        # Integration tests + fixtures
│   └── dist/        # Compiled binary
├── hosts/           # Typed host configs（每个 AI agent 一个）
│   ├── claude.ts    # Primary host config
│   ├── codex.ts, factory.ts, kiro.ts  # Existing hosts
│   ├── opencode.ts, slate.ts, cursor.ts, openclaw.ts  # IDE hosts
│   ├── hermes.ts, gbrain.ts  # Agent runtime hosts
│   └── index.ts     # Registry：exports all，derives Host type
├── scripts/         # Build + DX tooling
│   ├── gen-skill-docs.ts  # Template -> SKILL.md generator（config-driven）
│   ├── host-config.ts     # HostConfig interface + validator
│   ├── host-config-export.ts  # setup script 的 shell bridge
│   ├── host-adapters/     # Host-specific adapters（OpenClaw tool mapping）
│   ├── resolvers/   # Template resolver modules（preamble、design、review、gbrain 等）
│   ├── skill-check.ts     # Health dashboard
│   └── dev-skill.ts       # Watch mode
├── test/            # Skill validation + eval tests
│   ├── helpers/     # skill-parser.ts、session-runner.ts、llm-judge.ts、eval-store.ts
│   ├── fixtures/    # Ground truth JSON、planted-bug fixtures、eval baselines
│   ├── skill-validation.test.ts  # Tier 1：static validation（free，<1s）
│   ├── gen-skill-docs.test.ts    # Tier 1：generator quality（free，<1s）
│   ├── skill-llm-eval.test.ts   # Tier 3：LLM-as-judge（~$0.15/run）
│   └── skill-e2e-*.test.ts       # Tier 2：E2E via claude -p（~$3.85/run，按 category 拆分）
├── qa-only/         # /qa-only skill（report-only QA，不修复）
├── plan-design-review/  # /plan-design-review skill（report-only design audit）
├── design-review/    # /design-review skill（design audit + fix loop）
├── ship/            # Ship workflow skill
├── review/          # PR review skill
├── plan-ceo-review/ # /plan-ceo-review skill
├── plan-eng-review/ # /plan-eng-review skill
├── autoplan/        # /autoplan skill (auto-review pipeline: CEO → design → eng)
├── benchmark/       # /benchmark skill (performance regression detection)
├── canary/          # /canary skill (post-deploy monitoring loop)
├── codex/           # /codex skill (multi-AI second opinion via OpenAI Codex CLI)
├── land-and-deploy/ # /land-and-deploy skill (merge → deploy → canary verify)
├── office-hours/    # /office-hours skill (YC Office Hours — startup diagnostic + builder brainstorm)
├── investigate/     # /investigate skill (systematic root-cause debugging)
├── spec/            # /spec skill (five-phase spec → GitHub issue, optional agent spawn, /ship auto-closes)
├── retro/           # Retrospective skill (includes /retro global cross-project mode)
├── bin/             # CLI utilities（gstack-repo-mode、gstack-slug、gstack-config 等）
├── document-release/ # /document-release skill（post-ship doc updates + Diataxis coverage map）
├── document-generate/ # /document-generate skill（Diataxis doc generator：tutorial/how-to/reference/explanation）
├── cso/             # /cso skill（OWASP Top 10 + STRIDE security audit）
├── design-consultation/ # /design-consultation skill（从零构建设计系统）
├── design-shotgun/  # /design-shotgun skill（visual design exploration）
├── open-gstack-browser/  # /open-gstack-browser skill（启动 GStack Browser）
├── connect-chrome/  # symlink -> open-gstack-browser（backwards compat）
├── design/          # Design binary CLI（GPT Image API）
│   ├── src/         # CLI + commands（generate、variants、compare、serve 等）
│   ├── test/        # Integration tests
│   └── dist/        # Compiled binary
├── extension/       # Chrome extension（side panel + activity feed + CSS inspector）
├── lib/             # Shared libraries（worktree.ts）
├── docs/designs/    # Design documents
├── setup-deploy/    # /setup-deploy skill（one-time deploy config）
├── .github/         # CI workflows + Docker image
│   ├── workflows/   # evals.yml（E2E on Ubicloud）、skill-docs.yml、actionlint.yml
│   └── docker/      # Dockerfile.ci（pre-baked toolchain + Playwright/Chromium）
├── contrib/         # Contributor-only tools（永不为用户安装）
│   └── add-host/    # /gstack-contrib-add-host skill
├── setup            # One-time setup：build binary + symlink skills
├── SKILL.md         # 从 SKILL.md.tmpl 生成（不要直接编辑）
├── SKILL.md.tmpl    # Template：编辑此文件，运行 gen:skill-docs
├── ETHOS.md         # Builder philosophy（Boil the Ocean、Search Before Building）
└── package.json     # browse 的 build scripts
```

## SKILL.md workflow（SKILL.md 工作流）

SKILL.md files 由 `.tmpl` templates **生成**。更新 docs 时：

1. 编辑 `.tmpl` file（例如 `SKILL.md.tmpl` 或 `browse/SKILL.md.tmpl`）
2. 运行 `bun run gen:skill-docs`（或运行会自动执行它的 `bun run build`）
3. 同时 commit `.tmpl` 和生成的 `.md` files

新增 browse command：添加到 `browse/src/commands.ts` 并 rebuild。新增 snapshot flag：添加到 `browse/src/snapshot.ts` 中的 `SNAPSHOT_FLAGS` 并 rebuild。

**Token ceiling：**生成的 SKILL.md files 超过 160KB（约 40K tokens）会触发 warning。这是 “watch for feature bloat” guardrail，不是 hard gate。现代旗舰 models 有 200K-1M context windows，因此 40K 只占 window 的 4-20%，prompt caching 也让更大 skills 的 marginal cost 很小。ceiling 用来捕捉 runaway preamble/resolver growth，不是强迫 carefully-tuned big skills 压缩（`ship`、`plan-ceo-review`、`office-hours` 合理地包含 25-35K tokens 的 behavior）。如果超过 40K，正确修复通常是：（1）看清楚是什么增长了；（2）如果某个 resolver 在一个 PR 中增加 10K+，质疑它是否应该 inline 或改成 reference doc；（3）只有作为 last resort 才压缩 carefully-tuned prose，因为删减 coverage audit、review army 或 voice directive 会有真实 quality cost。

**SKILL.md files 的 merge conflicts：**永远不要通过接受任一 side 来解决 generated SKILL.md files 的 conflicts。应当：（1）解决 `.tmpl` templates 和 `scripts/gen-skill-docs.ts`（sources of truth）上的 conflicts；（2）运行 `bun run gen:skill-docs` 重新生成所有 SKILL.md files；（3）stage regenerated files。接受某一 side 的 generated output 会静默丢掉另一 side 的 template changes。

## Platform-agnostic design（平台无关设计）

Skills 永远不要 hardcode framework-specific commands、file patterns 或 directory structures。应当：

1. **读取 CLAUDE.md** 获取 project-specific config（test commands、eval commands 等）
2. **如果缺失，AskUserQuestion**，让用户告诉你，或让 gstack 搜索 repo
3. **把答案持久化到 CLAUDE.md**，以后不必再问

这适用于 test commands、eval commands、deploy commands，以及任何 project-specific behavior。项目拥有自己的 config；gstack 读取它。

## Writing SKILL templates（编写 SKILL templates）

SKILL.md.tmpl files 是 **Claude 读取的 prompt templates**，不是 bash scripts。每个 bash code block 都在独立 shell 中运行，variables 不会在 blocks 之间持久化。

Rules（规则）:
- **用自然语言表达 logic 和 state。**不要用 shell variables 在 code blocks 之间传 state。改为告诉 Claude 要记住什么，并在 prose 中引用它（例如 “the base branch detected in Step 0”）。
- **不要 hardcode branch names。**通过 `gh pr view` 或 `gh repo view` 动态检测 `main`/`master` 等。PR-targeting skills 使用 `{{BASE_BRANCH_DETECT}}`。prose 中使用 “the base branch”，code block placeholders 中使用 `<base>`。
- **保持 bash blocks self-contained。**每个 code block 都应独立工作。如果 block 需要上一 step 的 context，请在上方 prose 中重述。
- **用英文表达 conditionals。**不要在 bash 中嵌套 `if/elif/else`，写 numbered decision steps：“1. If X, do Y. 2. Otherwise, do Z.”

## Writing style（V1 写作风格）

每个 tier-≥2 skill 的默认输出遵循 `scripts/resolvers/preamble.ts` 中的 Writing Style section：首次使用时解释 jargon（精选列表在 `scripts/jargon-list.json`，gen-skill-docs time baked in），问题用 outcome terms 表述（“what breaks for your users if...”）而不是 implementation terms，短句，decision 以 user impact 收尾。想使用更紧凑 V0 prose 的 power users 可设置 `gstack-config set explain_level terse`（binary switch，无 middle mode）。完整 design rationale 见 `docs/designs/PLAN_TUNING_V1.md`。最初尝试与 writing-style 并行的 review pacing overhaul 已抽出为 V1.1，见 `docs/designs/PACING_UPDATES_V0.md`。

## Browser interaction（浏览器交互）

需要与浏览器交互时（QA、dogfooding、cookie setup），使用 `/browse` skill，或通过 `$B <command>` 直接运行 browse binary。永远不要使用 `mcp__claude-in-chrome__*` tools，它们慢、不可靠，也不是本项目使用的路径。

**Sidebar architecture：**修改 `sidepanel.js`、`background.js`、`content.js`、`terminal-agent.ts` 或 sidebar-related server endpoints 前，先读 `docs/designs/SIDEBAR_MESSAGE_FLOW.md`。sidebar 只有一个 primary surface：**Terminal** pane（interactive `claude` PTY）；Activity / Refs / Inspector 是 footer `debug` toggle 后面的 debug overlays。PTY 证明可行后，chat queue path 已被移除；`sidebar-agent.ts` 和 `/sidebar-command` / `/sidebar-chat` / `/sidebar-agent/event` endpoints 已不存在。该文档覆盖 WS auth flow、dual-token model 和 threat-model boundary；这里的 silent failures 通常源于不理解 cross-component flow。

**Embedder terminal-agent ownership**（v1.42.1.0+，identity-based kill v1.44.0.0+）。`browse/src/server.ts` 中的 `buildFetchHandler` 接受 `ServerConfig.ownsTerminalAgent?: boolean`（默认 `true`）。当它为 `true` 时，factory shutdown 会运行完整 teardown：通过 `browse/src/terminal-agent-control.ts` 中的 `killAgentByRecord(readAgentRecord(stateDir))` 做 identity-based kill，并对 `<stateDir>/terminal-port`、`<stateDir>/terminal-internal-token`、`<stateDir>/terminal-agent-pid`（v1.44 引入的 per-boot agent record）运行 `safeUnlinkQuiet`。预启动自己 PTY server 的 embedders（例如 gbrowser phoenix overlay）必须传 `false`，让 discovery files 在 gstack teardown cycles 后仍然保留。该 flag 是 `ServerConfig` 中第三个 caller-owned teardown gate（与 `xvfb?` 和 `proxyBridge?` 并列）；polarity 反转（explicit bool vs presence），并在字段 JSDoc 中记录。CLI `start()` 始终显式传 `true`；如果重构丢掉它，`browse/test/server-embedder-terminal-port.test.ts` 中的 static-grep test 会让 CI 失败。v1.44 前使用 `pkill -f terminal-agent\.ts`（regex match），会杀掉同 host 上的 sibling gstack sessions；新的 `browse/test/terminal-agent-pid-identity.test.ts` static-grep tripwire 会在任何 source file 重新引入 `pkill ... terminal-agent` 或 `spawnSync('pkill', ...)` 时让 CI 失败。

**WebSocket auth 使用 Sec-WebSocket-Protocol，而不是 cookies。** Browsers 无法在 WebSocket upgrade 上设置 `Authorization`，但可以通过 `new WebSocket(url, [token])` 设置 `Sec-WebSocket-Protocol`。agent 读取它，对 `validTokens` 校验，并且必须在 upgrade response 中 echo protocol；没有 echo 时 Chromium 会立即关闭连接。`Set-Cookie: gstack_pty=...` 作为 non-browser callers 的 fallback 保留（从 chrome-extension origin 出发的 cross-port `SameSite=Strict` cookie path 无法存活）。

**Cross-pane PTY injection。** toolbar 的 Cleanup button 和 Inspector 的 "Send to Code" action 都会通过 `sidepanel-terminal.js` 暴露的 `window.gstackInjectToTerminal(text)` 将文本 pipe 到 live claude PTY。不再有 `/sidebar-command` POST；live REPL 现在是 sidebar 中唯一 execution surface。

**`/health` 绝不能暴露任何 shell-grant token。** 它在 headed mode 中已经向 localhost callers 泄露 `AUTH_TOKEN`（v1.1+ TODO）。不要通过在那里添加 PTY session token 让情况更糟。PTY auth 只通过 `POST /pty-session` 流转。

**Transport-layer security**（v1.6.0.0+）。当 `pair-agent` 启动 ngrok tunnel 时，daemon 绑定两个 HTTP listeners：local listener（127.0.0.1，完整 command surface，永不 forward）和 tunnel listener（locked allowlist：`/connect`、带 scoped token + 26-command browser-driving allowlist 的 `/command`、`/sidebar-chat`）。ngrok 只 forward tunnel port。通过 tunnel 使用 root token 会返回 403。SSE endpoints 使用通过 `POST /sse-session` mint 的 30 分钟 HttpOnly `gstack_sse` cookie（永不对 `/command` 有效）。Tunnel-surface rejections 通过 `tunnel-denial-log.ts` 写入 `~/.gstack/security/attempts.jsonl`。编辑 `server.ts`、`sse-session-cookie.ts` 或 `tunnel-denial-log.ts` 前，先读 [ARCHITECTURE.md](ARCHITECTURE.md#dual-listener-tunnel-architecture-v1600)。module boundary（`sse-session-cookie.ts` 不 import `token-registry.ts`）对 scope isolation 是 load-bearing。

**Unicode sanitization at server egress**（v1.38.0.0+）。每个发送 page-content-derived strings 的 server egress 都必须使用 object payload 的 `JSON.stringify(payload, sanitizeReplacer)`，或 text body 的 `sanitizeLoneSurrogates(body)`。否则来自 CDP page content 的 lone UTF-16 surrogate halves 会以 `\uD800` 风格 escape 到达 Anthropic API，并触发 400。当前 wiring 在四个 egress points：`handleCommandInternal`（HTTP + batch，经 `handleCommandInternalImpl` 外层 sanitizing wrapper）和两个 SSE producers（`/activity/stream`、`/inspector/events`）。Post-stringify regex 是 no-op，因为 `JSON.stringify` 已经在 regex 匹配前 escape surrogate；replacer 必须在 encoding pipeline 内运行。在 `server.ts` 中新增 SSE/WebSocket writer 或 HTTP response 前，先读 [ARCHITECTURE.md](ARCHITECTURE.md#unicode-sanitization-at-server-egress-v13800)。`browse/test/server-sanitize-surrogates.test.ts` 用 invariant tests 固定 wiring，绕过会让 CI 失败。

**SSE endpoint helper**（v1.51.0.0+）。`server.ts` 中的新 SSE endpoints 必须通过 `browse/src/sse-helpers.ts` 的 `createSseEndpoint(req, config)` route。helper 拥有 cleanup contract（abort + enqueue-throw + heartbeat-throw，全部 idempotent），并在每个 JSON.stringify 中 baked in `sanitizeLoneSurrogates`，因此新 subscribers 不会意外回归任一 invariant。Inline `ReadableStream` wiring 曾在 TCP connection 死亡但未触发 `req.signal.abort` 时泄漏 subscribers（Chromium MV3 service-worker suspend、intermediate proxy half-close）。`/activity/stream`、`/inspector/events` 和 `/memory`（SSE-eligible）都通过它 route。`browse/test/sse-helpers.test.ts` 固定 cleanup contract。

**CDP session lifecycle**（v1.51.0.0+）。在 `browse/src/cdp-bridge.ts` 外直接调用 `page.context().newCDPSession(page)` 会通过 `browse/test/cdp-session-cleanup.test.ts` 中的 static-grep tripwire 让 CI 失败。一次性 CDP work 使用 `withCdpSession(page, async (s) => {...})`（try/finally detach）；与 page lifetime 绑定的 cached sessions 使用 `getOrCreateCdpSession(page, cache)`（通过 `Map<page, session>` close-detach）。已迁移三处：cdp-bridge frame events、write-commands archive capture、cdp-inspector。helpers 防止 successful-path detach 有而 error-path detach 漏掉的 per-session leak class。

**Setup symlink hardening**（v1.38.0.0+）。`setup` 中每个 link site 都必须通过 `IS_WINDOWS` detection 附近的 `_link_or_copy SRC DST` helper。在没有 Developer Mode 的 Windows 上，普通 `ln -snf` 会产生不会随 `git pull` 刷新的 frozen file copies，导致每个 host adapter silent staleness。helper 在 Unix 上保留 `ln -snf`，在 Windows 上切换到 `cp -R` / `cp -f`。`test/setup-windows-fallback.test.ts` enforce static invariant：helper body 外任何一个 raw `ln` call 都会让 CI 失败。Windows users 会从 `_print_windows_copy_note_once` 得到一行 note，提醒他们每次 `git pull` 后重新运行 `./setup`。

**Sidebar security stack（sidebar 安全栈）**（针对 prompt injection 的 layered defense）：

| Layer | Module | 位置 |
|-------|--------|----------|
| L1-L3 | `content-security.ts` | server 和 agent 两侧 — datamarking、hidden element strip、ARIA regex、URL blocklist、envelope wrapping |
| L4 | `security-classifier.ts` (TestSavantAI ONNX) | **sidebar-agent only** |
| L4b | `security-classifier.ts` (Claude Haiku transcript) | **sidebar-agent only** |
| L5 | `security.ts` (canary) | both — inject in compiled, check in agent |
| L6 | `security.ts` (combineVerdict ensemble) | both |

**Critical constraint（关键约束）：**`security-classifier.ts` 不能从 compiled browse binary import。`@huggingface/transformers` v4 需要 `onnxruntime-node`，它会在 Bun compile 的 temp extract dir 中 `dlopen` 失败。只有 `security.ts`（pure-string operations：canary、verdict combiner、attack log、status）对 `server.ts` 是安全的。完整 architectural decision 见 `~/.gstack/projects/garrytan-gstack/ceo-plans/2026-04-19-prompt-injection-guard.md` §"Pre-Impl Gate 1 Outcome"。

**Thresholds**（在 `security.ts` 中）：
- `BLOCK: 0.85`：single-layer score，如果 cross-confirmed 会导致 BLOCK
- `WARN: 0.75`：cross-confirm threshold。当 L4 和 L4b 都 >= 0.75 时 -> BLOCK
- `LOG_ONLY: 0.40`：gates transcript classifier（所有 layers < 0.40 时跳过 Haiku）
- `SOLO_CONTENT_BLOCK: 0.92`：label-less content classifiers（testsavant、deberta）的 single-layer threshold。故意高于 `BLOCK`，因为这些 layers 无法区分“这是 injection”和“这看起来像针对用户的 phishing”。transcript classifier 保留独立的 label-gated solo path，阈值为 `BLOCK`（0.85）。

**Ensemble rule（ensemble 规则）：**只有 ML content classifier 和 transcript classifier 都报告 >= WARN 时才 BLOCK。Single-layer high confidence 降级为 WARN，这是 Stack Overflow instruction-writing FP mitigation。Canary leak 始终 BLOCK（deterministic）。

**Env knobs（环境开关）：**
- `GSTACK_SECURITY_OFF=1`：emergency kill switch。Classifier 即使已 warmed 也保持 off。Canary 仍会 inject，只跳过 ML scan。
- `GSTACK_SECURITY_ENSEMBLE=deberta`：opt-in DeBERTa-v3 ensemble。添加 ProtectAI DeBERTa-v3-base-injection-onnx 作为 L4c classifier，用于 cross-model agreement。首次下载 721MB。启用 ensemble 时，BLOCK 需要 2-of-3 ML classifiers 在 >= WARN 达成一致（testsavant、deberta、transcript）。未启用 ensemble（默认）时，BLOCK 需要 testsavant + transcript >= WARN。
- Classifier model cache：`~/.gstack/models/testsavant-small/`（112MB，仅首次运行）加 `~/.gstack/models/deberta-v3-injection/`（721MB，仅启用 ensemble 时）
- Attack log：`~/.gstack/security/attempts.jsonl`（仅 salted sha256 + domain，10MB rotate，5 generations）
- Per-device salt：`~/.gstack/security/device-salt`（0600）
- Session state：`~/.gstack/security/session-state.json`（cross-process，atomic）

## Dev symlink awareness（开发 symlink 感知）

开发 gstack 时，`.claude/skills/gstack` 可能是指回当前 working directory 的 symlink（gitignored）。这意味着 skill changes 会**立即 live**，适合快速迭代；但大型 refactors 时有风险，因为半写完的 skills 可能破坏并发使用 gstack 的其他 Claude Code sessions。

**每个 session 检查一次：**运行 `ls -la .claude/skills/gstack`，确认它是 symlink 还是真实 copy。如果它 symlink 到你的 working directory，注意：
- Template changes + `bun run gen:skill-docs` 会立即影响所有 gstack invocations
- 对 SKILL.md.tmpl files 的 breaking changes 会破坏 concurrent gstack sessions
- 大型 refactors 期间，移除 symlink（`rm .claude/skills/gstack`），让系统改用 `~/.claude/skills/gstack/` 的 global install

**Prefix setting（前缀设置）：**Setup 会在 top level 创建真实 directories（不是 symlinks），并在里面放一个 SKILL.md symlink（例如 `qa/SKILL.md -> gstack/qa/SKILL.md`）。这确保 Claude 把它们发现为 top-level skills，而不是嵌套在 `gstack/` 下。名称可以是 short（`qa`）或 namespaced（`gstack-qa`），由 `~/.gstack/config.yaml` 中的 `skill_prefix` 控制。传 `--no-prefix` 或 `--prefix` 可跳过 interactive prompt。

**Note（说明）：**不再推荐把 gstack vendoring 到项目 repo 中。请使用 global install + `./setup --team`。team mode instructions 见 README.md。

**For plan reviews（针对 plan reviews）：**review 会修改 skill templates 或 gen-skill-docs pipeline 的 plans 时，考虑这些变更是否应在 live 前隔离测试，尤其当用户正在其他窗口主动使用 gstack 时。

**Upgrade migrations：**当变更修改 on-disk state（directory structure、config format、stale files），且可能破坏现有 user installs 时，添加 migration script 到 `gstack-upgrade/migrations/`。格式和测试要求见 CONTRIBUTING.md 的 "Upgrade migrations" section。upgrade skill 在 `/gstack-upgrade` 期间、`./setup` 后会自动运行这些脚本。

## Compiled binaries（编译产物）— NEVER commit browse/dist/ or design/dist/

`browse/dist/` 和 `design/dist/` directories 包含 compiled Bun binaries（`browse`、`find-browse`、`design`，每个约 58MB）。它们仅适用于 Mach-O arm64，**不能**在 Linux、Windows 或 Intel Macs 上工作。`./setup` script 已经会为每个平台从 source build，因此 checked-in binaries 是冗余的。它们因历史错误被 git tracked，最终应使用 `git rm --cached` 移除。

**永远不要 stage 或 commit 这些文件。**它们会出现在 `git status` 中，因为尽管 `.gitignore` 存在，它们仍被 tracked；忽略它们。staging files 时，始终使用具体文件名（`git add file1 file2`），永远不要 `git add .` 或 `git add -A`，否则会意外包含 binaries。

## Redaction guard（PII / secrets / legal content 脱敏防线）

Shared redaction engine 会在内容到达 external sink（codex dispatch、GitHub issue/PR body、pushed commit）之前捕捉 credentials、PII 和 legal/damaging content。它是**护栏，不是 airtight enforcement**：`git push --no-verify`、直接 `gh issue create` 和 `GSTACK_REDACT_PREPUSH=skip` 都会绕过它。它捕捉的是 accidents 和 carelessness，也就是 99% case。不要声称它能阻止 determined leaker（这样写在 CHANGELOG 里会被 hostile screenshotter 击穿）。

- **Engine + taxonomy：**`lib/redact-patterns.ts`（single source of truth，3 tiers；HIGH = 真正 secret credentials，会 block；MEDIUM = PII/legal/internal + high-FP credential shapes，需要通过 AskUserQuestion confirm；LOW = FYI）和 `lib/redact-engine.ts`（pure `scan()` + `applyRedactions()`）。Calibration 很重要：cry wolf 的 gate 会被忽略，所以 context-variable shapes（Stripe `pk_live_`、Google `AIza`、JWT、env `*_KEY=`）位于 MEDIUM。
- **CLI：**`bin/gstack-redact`（exit 0 clean / 2 MEDIUM / 3 HIGH；`--json`、`--auto-redact`、`--repo-visibility`、`--from-file`）。`bin/gstack-redact-prepush` 是 opt-in git hook。
- **Skill docs are generated（skill docs 由生成器生成）** from `scripts/resolvers/redact-doc.ts`（`{{REDACT_TAXONOMY_TABLE}}`、`{{REDACT_INVOCATION_BLOCK:<sink>}}`），因此 /spec、/cso、/ship、/document-release、/document-generate 不会与 engine drift。
- **Scan-at-sink：**始终 scan 即将发送的 EXACT bytes：写入 temp file，scan 该 file，把同一个 file 传给 `gh`/`git`。不要 scan 一个 string 后再 re-render，那会重新打开 scan-vs-send gap。
- **Visibility（no tier promotion）：**每次 run 解析一次，顺序 = local config（`gstack-config get redact_repo_visibility`，在 ~/.gstack 中，永不 commit）→ gh → glab → unknown（=public-strict）。Public repos 需要更严格的 per-finding confirmation（no batch-acknowledge、no silent-proceed）；MEDIUM 永远不会 auto-promoted to HIGH。
- **Tool-attributed fences：**把 Codex/Greptile/eval output 包在 ` ```codex-review ` / ` ```greptile ` fences 中，让这些工具引用的 example credentials WARN-degrade 而不是 blocking。fence 内 live-format credential 仍会 block。
- **Config keys：**`redact_repo_visibility`（public|private|unknown，对 gh/glab 无法读取的 repos 做 local-only override）、`redact_prepush_hook`（true|false）。故意没有 disable HIGH blocking 的 key。
- **Audit：**/spec semantic pass 会向 `~/.gstack/security/semantic-reviews.jsonl`（0600）append content-free record（categories + body sha256，无 spec text）。

## Commit style（提交风格）

**Always bisect commits（始终拆分可 bisect 的 commits）。**每个 commit 都应是单一 logical change。当你做了多个变更（例如 rename + rewrite + new tests），push 前把它们拆成 separate commits。每个 commit 都应 independently understandable and revertable。

好的 bisection 示例：
- Rename/move 与 behavior changes 分开
- Test infrastructure（touchfiles、helpers）与 test implementations 分开
- Template changes 与 generated file regeneration 分开
- Mechanical refactors 与 new features 分开

当用户说 “bisect commit” 或 “bisect and push” 时，把 staged/unstaged changes 拆成 logical commits 并 push。

## Slop-scan：AI code quality，不是隐藏 AI code

我们使用 [slop-scan](https://github.com/benvinegar/slop-scan) 捕捉那些 AI-generated code 确实比人类会写出的代码更差的模式。我们不是试图伪装成人类写的 code。我们就是 AI-coded，并且以此为傲。目标是 code quality。

```bash
npx slop-scan scan .          # human-readable report
npx slop-scan scan . --json   # machine-readable for diffing
```

Config：repo root 下的 `slop-scan.config.json`（当前排除 `**/vendor/**`）。

### 应该修复什么（真正的 quality improvements）

- **File ops 周围的 empty catches**：使用 `safeUnlink()`（忽略 ENOENT，重新抛出 EPERM/EIO）。cleanup 中吞掉 EPERM 意味着 silent data loss。
- **Process kills 周围的 empty catches**：使用 `safeKill()`（忽略 ESRCH，重新抛出 EPERM）。吞掉 EPERM 意味着你以为杀掉了某个进程，但其实没有。
- **冗余的 `return await`**：没有 enclosing try block 时移除。节省一个 microtask，也传达 intent。
- **Typed exception catches**：当 try block 做 URL parsing 或 DOM work 时，`catch (err) { if (!(err instanceof TypeError)) throw err }` 确实比 `catch {}` 更好。你知道预期的 error，就写出来。

### 不要修复什么（linter gaming，不是 quality）

- **对 error messages 做 string-matching**：`err.message.includes('closed')` 很脆。Playwright/Chrome 随时可能改 wording。如果一个 fire-and-forget operation 可能因为任何原因失败，而你并不关心，`catch {}` 就是正确模式。
- **为了豁免 pass-through wrappers 而加 comments**：在 method 上方写 "alias for active session" 只为触发 slop-scan 的 exemption rule，是 noise，不是 documentation。
- **把 extension catch-and-log 改成 selective rethrow**：Chrome extensions 遇到 uncaught errors 会整体 crash。如果 catch 会 log 并继续，这对 extension code 来说就是正确模式。不要让它 throw。
- **收紧 best-effort cleanup paths**：shutdown、emergency cleanup 和 disconnect code 应使用 `safeUnlinkQuiet()`（吞掉所有 errors）。cleanup path 在 EPERM 上 throw 会导致剩余 cleanup 不运行，更糟。

### `browse/src/error-handling.ts` 中的 utilities

| Function | 使用场景 | 行为 |
|----------|----------|----------|
| `safeUnlink(path)` | Normal file deletion | 忽略 ENOENT，重新抛出其他错误 |
| `safeUnlinkQuiet(path)` | Shutdown/emergency cleanup | 吞掉所有 errors |
| `safeKill(pid, signal)` | Sending signals | 忽略 ESRCH，重新抛出其他错误 |
| `isProcessAlive(pid)` | Boolean process checks | 返回 true/false，永不 throw |

### Score tracking（分数追踪）

Baseline（2026-04-09，cleanup 前）：100 findings，432.8 score，2.38 score/file。
Cleanup 后：90 findings，358.1 score，1.96 score/file。

不要追数字。修复代表真实 code quality problems 的模式。当 “sloppy” pattern 是正确 engineering choice 时，接受对应 findings。

## Community PR guardrails（社区 PR 防护栏）

Review 或 merge community PRs 时，接受任何属于以下类别的 commit 前，**始终 AskUserQuestion**：

1. **Touches ETHOS.md**：这个文件是 Garry 的个人 builder philosophy。外部 contributors 或 AI agents 都不得编辑，句号。
2. **移除或软化 promotional material**：YC references、founder perspective 和 product voice 都是 intentional。把这些说成 “unnecessary” 或 “too promotional” 的 PRs 必须拒绝。
3. **改变 Garry's voice**：skill templates、CHANGELOG 和 docs 中的 tone、humor、directness 和 perspective 不是 generic 的。把 voice 改得更 “neutral” 或 “professional” 的 PRs 必须拒绝。

即使 agent 强烈认为某个 change 改进了项目，这三类也必须通过 AskUserQuestion 获得 explicit user approval。没有例外。不要 auto-merge。不要说 “I'll just clean this up.”

## Checking out PRs from garrytan-agents（检出 garrytan-agents PR）

当用户说 “check out <PR link>”，并且 PR 来自 `garrytan-agents/gstack`（或任何不是 `garrytan/gstack` collaborator 的 fork）时，不要直接 `gh pr checkout`。Fork PRs 收不到 base-repo secrets（`ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 等），因此 eval/E2E CI jobs 会因为 empty-env auth errors 失败，不管 base repo 上设置了什么。

**Workflow：**把 branch push 到 `garrytan/gstack`（base repo），然后从那里重新 target PR。

具体来说，`gh pr checkout <N>` 之后：

1. 记录原始 PR number 和 head branch name。
2. 把同一个 branch push 到 base repo：`git push origin HEAD:<branch-name>`（origin = `garrytan/gstack`，因为 worktree 用这个 remote 设置）。
3. 关闭 fork PR（`gh pr close <N> --comment "moving to base-repo branch for secret access"`）。
4. 从 base-repo branch 打开新 PR：`gh pr create --base main --head <branch-name>`。
5. 新 PR 的 workflows 会自动拿到 secrets。

为什么不在 fork side 修？`garrytan-agents` 不是 `garrytan/gstack` 的 collaborator。把它加为 collaborator（option A），或打开 repo-wide “send secrets to fork PRs” toggle（option B），都会让 secrets 可以到达任何人的 fork PRs，blast radius 比只移动这一条 branch 大得多。Option C（本节）让 secret-distribution scope 保持紧凑。

如果用户要求跳过移动（例如 “just leave it as a fork PR”），尊重这个要求。eval CI 会因 empty-env auth 失败，但 check-freshness、workflow-lint 和 windows-tests 仍会在 fork PR 上通过。

## CHANGELOG + VERSION style（CHANGELOG 与 VERSION 风格）

**Versioning invariant（workspace-aware ship）。** VERSION 是 monotonic ordered release identifier，不是严格的 semver commitment。Bump level（major/minor/patch/micro）表达 ship time 的 intent。在同一个 bump level 内，明确允许 queue-advancing 越过已声明版本：如果 branch A 以 MINOR 声明 v1.7.0.0，而 branch B 也是 MINOR，B 会落在 v1.8.0.0（相对 main 仍是 MINOR）。Downstream consumers 不能把 “MINOR = feature-only, PATCH = fix-only” 当成严格 contract。这就是 `bin/gstack-next-version` 在发生 collisions 时会在选定 bump level 内推进，而不是重新选择 level 的原因。

**Scale-aware bumps：使用 common sense。** 当 diff 很大时，bump MINOR（或 MAJOR），不要 bump PATCH。PATCH 用于 bug fixes 和 small additions；MINOR 用于 substantial new capability 或 substantial reduction；MAJOR 用于 breaking changes。粗略 guideposts（不要当 rules，当 smell-checks）：

- **PATCH（X.Y.Z+1.0）**：bug fix、doc tweak、small additive change、单个 test/file added。Net diff 少于约 500 行，没有新的 user-facing capability。
- **MINOR（X.Y+1.0.0）**：shipped new capability（skill、harness、command、big refactor）、substantial code reduction（compression、migration），或 coordinated multi-file change。Net diff 超过约 2000 行 added/removed，或有一个你会发 tweet 的 user-visible feature。
- **MAJOR（X+1.0.0.0）**：public surface 的 breaking change（CLI flag rename、skill removed、config format changed），或足以成为 blog post headline 的 release。

如果你发现自己在争论 “10K added + 24K removed 真的是 PATCH 吗？”：不是。Bump MINOR。“this adds a whole new test harness with 6 new E2E tests + helper utilities” 也一样，是 MINOR。Bump level 是向用户沟通这个 release 的类型，不要低估它。

当 merge origin/main 带来更高 VERSION 时，根据 branch work 的 SCALE 重新评估 bump level，而不只是看 main 是否前进。如果 main bumped MINOR，而你的 branch 也是 substantial change，就在其上再次 bump MINOR（例如 main at v1.14.0.0，你的 branch lands v1.15.0.0）。

**VERSION 和 CHANGELOG 是 branch-scoped。** 每个 shipping feature branch 都有自己的 version bump 和 CHANGELOG entry。该 entry 描述 THIS branch 增加了什么，而不是 main 上已经有什么。

**CHANGELOG entry 是 main 和 shipping branch 之间的 diff，也就是用户 upgrade 后获得的东西。不是 branch 如何到达那里。** 读者打开这个 entry 应该知道现在能做什么以前不能做的事；他们不应该读到 branch 的 internal version bumps、中途捕捉并修复的 bugs、做过的 plan reviews，或 squash 了哪些 commits。这些是 branch development narrative，属于 PR descriptions 和 commit messages，不属于 CHANGELOG。

**永远不要在 CHANGELOG entry 中引用 branch-internal versions。** 如果你的 branch 在开发过程中把 VERSION 从 v1.5.0.0 bump 到 v1.5.1.0 再到 v1.6.0.0，而最终只有 v1.6.0.0 ship 到 main，entry 必须读起来像 v1.5.1.0 从未存在过。具体来说，永远不要写：
- "v1.5.1.0 had a bug that v1.6.0.0 fixes"：读者不知道 v1.5.1.0；它是 branch-internal artifact。
- "The shipping headline of v1.5.1.0 was broken because..."：同样原因。从 main 的视角看，v1.5.1.0 从未 released。
- "Pre-fix tests encoded the broken behavior"：这是 contributor 的 victory lap，不是 user benefit。
- "Two surgical edits, both in the dispatch path"：patch 的 micro-narrative。

改为描述 released system："Browser-skills run end-to-end with the expected tab-access semantics." 如果 shipped system 的某个 property 值得点出（例如 "skill spawns get permissive tab access; pair-agent tunnel tokens require ownership"），把它作为 property 记录，而不是作为 fix。Shipped system 才是用户得到的东西；通往它的路径对用户不可见。

**什么时候写 CHANGELOG entry：**
- 在 `/ship` time（Step 13），不要在 development 或 mid-branch 时写。
- Entry 覆盖这个 branch 相对 base branch 的所有 commits。
- 永远不要把新 work 折进 prior version 已经 landed on main 的 existing CHANGELOG entry。如果 main 有 v0.10.0.0，而你的 branch adds features，就 bump 到 v0.10.1.0 并写新 entry，不要编辑 v0.10.0.0 entry。

**写之前的关键问题：**
1. 我在哪个 branch？THIS branch 改了什么？
2. Base branch version 是否已经 released？（如果是，bump 并创建 new entry。）
3. 这个 branch 上是否已有 entry 覆盖 earlier work？（如果是，用 final version 的 unified entry 替换它。）

**Merging main 不代表采用 main 的 version。** 当你把 origin/main merge 到 feature branch，main 可能带来 new CHANGELOG entries 和更高 VERSION。你的 branch 仍需要在其上做 OWN version bump。如果 main 是 v0.13.8.0，而你的 branch adds features，就 bump 到 v0.13.9.0 并写新 entry。永远不要把你的 changes 塞进已经 landed on main 的 entry。你的 entry 放在顶部，因为你的 branch 接下来 land。

**Merging main 后始终检查：**
- CHANGELOG 是否有你的 branch 自己的 entry，并与 main entries 分开？
- VERSION 是否高于 main 的 VERSION？
- 你的 entry 是否是 CHANGELOG 顶部 entry（在 main latest 之上）？
如果任何答案是否，继续前先修复。

**任何移动、增加或删除 entries 的 CHANGELOG edit 之后，**立即运行 `grep "^## \[" CHANGELOG.md`，确认没有 duplicates，且 reverse-chronological order 合理。Version numbers 之间有 gaps 没关系。某个 branch 以 v1.6.4.0 ship，而 main 上没有 prior v1.5.2.0 或 v1.5.3.0 entry，这是正确的，因为那些是从未 landed 的 branch-internal version numbers。不要用 placeholder entries 回填 gaps。

**永远不要 orphan branch-internal versions。** 如果你的 branch 在 development 中多次 bump VERSION（例如 v1.5.1.0 -> v1.5.2.0 -> v1.6.4.0），而那些 earlier entries 从未 released to main，final ship 要把它们全部 consolidated 到 final version（v1.6.4.0）的 single entry 中。Collapse them：删除 old entries，把它们的 content 移到 final entry，并相应调整 version table columns。读者看到的是一个 release，不是 branch diary。Gaps 没关系（v1.6.3.0 -> v1.6.4.0，中间 main 上没有 v1.5.x 是正确的）。

CHANGELOG.md 是**给 users**看的，不是给 contributors。像 product release notes 一样写：

- 先写用户现在可以**做**什么以前做不到的事。Sell the feature。
- 使用 plain language，不要 implementation details。写 "You can now..."，不要写 "Refactored the..."
- **永远不要提 TODOS.md、internal tracking、eval infrastructure 或 contributor-facing details。** 这些对 users 不可见，也没有意义。
- Contributor/internal changes 放在底部单独的 "For contributors" section。
- 每个 entry 都应该让人觉得 “oh nice, I want to try that.”
- 不要 jargon：说 "every question now tells you which project and branch you're in"，不要说 "AskUserQuestion format standardized across skill templates via preamble resolver."

**只记录 main 和此 change 之间 shipped 的内容。** 读者不关心我们怎么走到这里。以下内容始终不要写进 CHANGELOG：

- Branch resyncs、merge commits with main、rebase activity。
- Plan approvals、review outcomes（CEO / eng / design / outside-voice / codex findings）、AskUserQuestion decisions、scope negotiations。
- "Work queued," "plan approved," "in-progress," "will ship later"：CHANGELOG 记录 DID ship 的东西，不记录 MIGHT ship 的东西。
- 没有实际 user-facing work landed 时的 version-bump housekeeping。

如果 base branch version 和这个 version 之间的 diff 没有 user-facing change（只有 merges、只有 CHANGELOG edits、只有 placeholder work），诚实的 entry 就一句话："Version bump for branch-ahead discipline. No user-facing changes yet." 到此为止。不要填充。不要解释最终会 ship 的 plan。不要叙述 branch history。真正 work landed 后，entry 会在 /ship time 替换它。

### Release-summary format (every `## [X.Y.Z]` entry)

`CHANGELOG.md` 中每个 version entry 都必须以 release-summary section 开始，使用 GStack/Garry voice，一屏左右的 prose + tables，落点像 verdict，而不是 marketing。Itemized changelog（subsections、bullets、files）放在 summary 下方，并用 `### Itemized changes` header 分隔。

Release-summary section 会被 humans、auto-update agent，以及任何决定是否 upgrade 的人阅读。Itemized list 是给需要准确知道 changed 内容的 agents 看。

每个 `## [X.Y.Z]` entry 顶部结构：

1. **Two-line bold headline**（总计 10-14 words）。应该像 verdict，不像 marketing。听起来像今天 ship 了且关心它是否有效的人。
2. **Lead paragraph**（3-5 sentences）。写清 shipped 什么，对用户改变了什么。Specific、concrete、无 AI vocabulary、无 em dashes、无 hype。
3. **一个 "The X numbers that matter" section**，包含：
   - 一个短 setup paragraph，说明数字来源（real production deployment 或 reproducible benchmark，并写出要运行的 file/command）。
   - 一个包含 3-6 个 key metrics 的 table，列为 BEFORE / AFTER / Δ。
   - 如相关，可加第二个 per-category breakdown table。
   - 1-2 句用具体 user terms 解释最突出的数字。
4. **一个 "What this means for [audience]" closing paragraph**（2-4 sentences），把 metrics 和真实 workflow shift 绑定。以 what to do 结束。

Release summary 的 voice rules（表达规则）：
- 不要 em dashes（使用逗号、句号、"..."）。
- 不要 AI vocabulary（delve、robust、comprehensive、nuanced、fundamental 等）或 banned phrases（"here's the kicker"、"the bottom line" 等）。
- 使用真实 numbers、真实 file names、真实 commands。不要写 "fast"，写 "~30s on 30K pages."
- 短 paragraphs，把 one-sentence punches 和 2-3 sentence runs 混合。
- 连接到 user outcomes："the agent does ~3x less reading" 比 "improved precision" 更好。
- 对 quality 直接。写 "Well-designed" 或 "this is a mess." 不要 dancing。

Source material（素材来源）：
- CHANGELOG previous entry，用于 prior context。
- Benchmark files 或 `/retro` output，用于 headline numbers。
- Recent commits（`git log <prev-version>..HEAD --oneline`），用于确认 shipped 内容。
- 不要编造 numbers。如果 metric 不在 benchmark 或 production data 中，就不要包含。被问到时说 "no measurement yet"。

Target length（目标长度）：summary 约 250-350 words。应渲染为一屏。

### Itemized changes（位于 release summary 下方）

写 `### Itemized changes`，然后继续 detailed subsections（Added、Changed、Fixed、For contributors）。遵循上方 user-facing voice guidance 的同样 rules，另加：

- **始终 credit community contributions。** 当 entry 包含来自 community PR 的 work 时，用 `Contributed by @username` 指名 contributor。Contributors 做了真实 work。每次都公开感谢，没有例外。

## AI effort compression（AI effort 压缩）

估算或讨论 effort 时，始终同时展示 human-team 和 CC+gstack time：

| Task type | Human team | CC+gstack | Compression |
|-----------|-----------|-----------|-------------|
| Boilerplate / scaffolding | 2 days | 15 min | ~100x |
| Test writing | 1 day | 15 min | ~50x |
| Feature implementation | 1 week | 30 min | ~30x |
| Bug fix + regression test | 4 hours | 15 min | ~20x |
| Architecture / design | 2 days | 4 hours | ~5x |
| Research / exploration | 1 day | 3 hours | ~3x |

Completeness 很便宜。当 complete implementation 可达成时，不要建议 shortcuts。Boil the ocean：完整的事就是目标；只有真正无关的 multi-quarter migrations 才是 separate scope，绝不是 shortcut 的借口。完整 philosophy 见 skill preamble 中的 Completeness Principle。

## Search before building（构建前先搜索）

在设计任何涉及 concurrency、unfamiliar patterns、infrastructure，或 runtime/framework 可能已有 built-in 的 solution 之前：

1. Search for "{runtime} {thing} built-in"
2. Search for "{thing} best practice {current year}"
3. Check official runtime/framework docs

中文语义：先找 runtime/framework 是否已有 built-in 能力，再查当前年份的最佳实践，最后核对官方文档。

三层知识：tried-and-true（Layer 1）、new-and-popular（Layer 2）、first-principles（Layer 3）。最重视 Layer 3。完整 builder philosophy 见 ETHOS.md。

## Local plans（本地计划）

Contributors 可以把 long-range vision docs 和 design documents 存在 `~/.gstack-dev/plans/`。这些是 local-only（不 check in）。Review TODOS.md 时，检查 `plans/`，寻找可能已经 ready to promote to TODOs 或 implement 的 candidates。

## E2E eval failure blame protocol（E2E eval 失败归因协议）

当 E2E eval 在 `/ship` 或任何其他 workflow 中失败时，**没有证明前，永远不要声称 "not related to our changes"。** 这些系统有 invisible couplings：preamble text change 会影响 agent behavior，new helper 会改变 timing，regenerated SKILL.md 会移动 prompt context。

**把 failure 归因于 "pre-existing" 前必须做到：**
1. 在 main（或 base branch）上运行同一个 eval，并展示它在那里也失败
2. 如果它在 main 上通过但在 branch 上失败，这就是你的 change。Trace the blame。
3. 如果不能在 main 上运行，说 "unverified — may or may not be related"，并在 PR body 中标成 risk

没有 receipts 的 "Pre-existing" 是 lazy claim。证明它，或者不要说。

## Long-running tasks：不要放弃

运行 evals、E2E tests 或任何 long-running background task 时，**poll until completion**。每 3 分钟循环使用 `sleep 180 && echo "ready"` + `TaskOutput`。不要切到 blocking mode，然后因为 poll times out 就放弃。不要说 "I'll be notified when it completes" 后停止检查；保持 loop，直到 task finishes 或用户告诉你停止。

完整 E2E suite 可能需要 30-45 分钟，也就是 10-15 个 polling cycles。全部做完。每次 check 都报告 progress（哪些 tests passed、哪些 running、目前有哪些 failures）。用户想看到 run complete，而不是一个以后会检查的承诺。

## E2E test fixtures：extract，不要 copy

**永远不要把完整 SKILL.md file copy 到 E2E test fixture。** SKILL.md files 有 1500-2000 行。当 `claude -p` 读取这么大的 file 时，context bloat 会导致 timeouts、flaky turn limits，以及比必要情况慢 5-10x 的 tests。

改为只 extract test 实际需要的 section：

```typescript
// BAD：agent 读取 1900 行，把 tokens 花在 irrelevant sections 上
fs.copyFileSync(path.join(ROOT, 'ship', 'SKILL.md'), path.join(dir, 'ship-SKILL.md'));

// GOOD：agent 读取约 60 行，38s 完成而不是 timeout
const full = fs.readFileSync(path.join(ROOT, 'ship', 'SKILL.md'), 'utf-8');
const start = full.indexOf('## Review Readiness Dashboard');
const end = full.indexOf('\n---\n', start);
fs.writeFileSync(path.join(dir, 'ship-SKILL.md'), full.slice(start, end > start ? end : undefined));
```

另外，在运行 targeted E2E tests 调试 failures 时：
- 在 **foreground** 运行（`bun test ...`），不要用 `&` 和 `tee` 放到 background
- 永远不要 `pkill` running eval processes 后 restart：你会丢掉 results 并浪费钱
- One clean run 胜过 three killed-and-restarted runs

## Publishing native OpenClaw skills to ClawHub（发布 native OpenClaw skills 到 ClawHub）

Native OpenClaw skills 位于 `openclaw/skills/gstack-openclaw-*/SKILL.md`。这些是 hand-crafted methodology skills（不是 pipeline 生成的），发布到 ClawHub，供任何 OpenClaw user 安装。

**Publishing：**命令是 `clawhub publish`（不是 `clawhub skill publish`）：

```bash
clawhub publish openclaw/skills/gstack-openclaw-office-hours \
  --slug gstack-openclaw-office-hours --name "gstack Office Hours" \
  --version 1.0.0 --changelog "description of changes"
```

对每个 skill 重复执行：`gstack-openclaw-ceo-review`、`gstack-openclaw-investigate`、`gstack-openclaw-retro`。每次 update 都 bump `--version`。

**Auth：**`clawhub login`（打开 browser 做 GitHub auth）。用 `clawhub whoami` 验证。

**Updating：**使用同一个 `clawhub publish` command，配合更高的 `--version` 和 `--changelog`。

**Verification：**运行 `clawhub search gstack` 确认它们 live。

## Deploying to the active skill（部署到 active skill）

Active skill 位于 `~/.claude/skills/gstack/`。做出 changes 后：

1. Push your branch
2. 在 skill directory 中 fetch and reset：`cd ~/.claude/skills/gstack && git fetch origin && git reset --hard origin/main`
3. Rebuild：`cd ~/.claude/skills/gstack && bun run build`

**如果你使用 gbrain：**第 2 步中的 `git reset --hard` 会还原 `gstack-config
gbrain-refresh` 渲染到 install 中的 brain-aware（`GBRAIN_CONTEXT_LOAD` /
`GBRAIN_SAVE_RESULTS`）blocks（这些 generated blocks 设计上就与 `main` 不同）。
部署后重新运行 `gstack-config gbrain-refresh`，即可在所有 projects 的 Claude
sessions 中恢复这些 blocks。该命令是 idempotent。

或直接 copy binaries：
- `cp browse/dist/browse ~/.claude/skills/gstack/browse/dist/browse`
- `cp design/dist/design ~/.claude/skills/gstack/design/dist/design`

## Skill routing（Skill 路由）

当用户请求匹配 available skill 时，通过 Skill tool 调用它。不确定时，调用 skill。

Key routing rules：
- Product ideas/brainstorming -> invoke /office-hours
- Strategy/scope -> invoke /plan-ceo-review
- Architecture -> invoke /plan-eng-review
- Design system/plan review -> invoke /design-consultation or /plan-design-review
- Full review pipeline -> invoke /autoplan
- Bugs/errors -> invoke /investigate
- QA/testing site behavior -> invoke /qa or /qa-only
- Code review/diff check -> invoke /review
- Visual polish -> invoke /design-review
- Ship/deploy/PR -> invoke /ship or /land-and-deploy
- Save progress -> invoke /context-save
- Resume context -> invoke /context-restore

## Cross-session decision memory

Durable decisions 及其 rationale 记录在 append-only、event-sourced store：`~/.gstack/projects/<slug>/decisions.jsonl`，这样你和用户都不会跨 session 重新争论已定决定，也不会丢掉 “why”。这是可靠的 file-only path：gbrain 关闭时也能工作。（gbrain semantic recall 是叠加在上面的可选增强，绝不是 dependency。）

- **重新决定前先 resurface** active decisions：`bin/gstack-decision-search`（`--recent N`、`--scope repo|branch|issue`、`--query KW`、`--all`、`--json`）。gbrain 启动时可加 `--semantic`（配合 `--query`）追加来自 gbrain memory 的 related hits；gbrain 关闭时会静默退化到可靠的 file results。Session start 已经通过 Context Recovery 浮出 scope-relevant active decisions。如果列出某个 decision，就把它视为带 rationale 的已定结论；如果你准备 reverse，明确说明。
- **当你或用户做出 DURABLE decision 时 capture**：`bin/gstack-decision-log '{"decision":"...","rationale":"...","scope":"repo|branch|issue","source":"user|skill|agent","confidence":1-10}'`。用 `--supersede <id>` reverse prior call；用 `--redact <id>` expunge accidental secret；用 `--compact` 把 log rewrite 到 active set。它 non-interactive（never prompts）、injection-sanitized，并在 write 时阻止 HIGH secrets。
- **Durable means：**architecture choice、scope cut、tool/vendor choice，或 prior call 的 reversal。不包括 turn-level edit、phrasing tweak，或任何 trivially re-derivable 的事。Capture 在 source 处 curated：只记录 durable decisions，否则 store 会变成 noise。

## GBrain Search Guidance（由 /sync-gbrain 配置）
<!-- gstack-gbrain-search-guidance:start -->

GBrain 已在这台机器上设置并同步。当问题是 semantic 的，或还不知道 exact identifier 时，agent 应优先使用 gbrain，而不是 Grep。

**This worktree 通过 repo root 中的 `.gbrain-source` file pin 到 worktree-scoped code source**（kubectl-style context）。在这个 worktree 下任何位置调用 `gbrain code-def`、`code-refs`、`code-callers`、`code-callees` 或 `query`，默认都会 route 到该 source，不需要 `--source` flag。同一 repo 的 Conductor sibling worktrees 各自有自己的 pin 和 indexed pages，因此 semantic results 会匹配这个 worktree 磁盘上的实际 code。

通过 `gbrain` CLI 可用的两个 indexed corpora：
- This worktree's code（通过 `.gbrain-source` auto-pinned）。
- `~/.gstack/` curated memory（通过 existing federation pipeline 注册为 `gstack-brain-<user>` source）。

以下情况优先使用 gbrain：
- "Where is X handled?" / semantic intent，尚无 exact string：
    `gbrain search "<terms>"` or `gbrain query "<question>"`
- "Where is symbol Y defined?" / symbol-based code questions：
    `gbrain code-def <symbol>` or `gbrain code-refs <symbol>`
- "What calls Y?" / "What does Y depend on?"：
    `gbrain code-callers <symbol>` / `gbrain code-callees <symbol>`
- "What did we decide last time?" / past plans、retros、learnings：
    `gbrain search "<terms>" --source gstack-brain-<user>`

对于 known exact strings、regex、multiline patterns 和 file globs，Grep 仍然正确。Meaningful code changes 后运行 `/sync-gbrain`；如果需要跨所有 worktrees 持续 auto-sync，每台机器运行一次 `gbrain autopilot --install`，gbrain 的 daemon 会按 schedule 处理 incremental refresh。

Safety：当 `gbrain autopilot` active 时，不要运行 `/sync-gbrain`。orchestrator 检测到 running autopilot 时会拒绝 destructive source ops，以避免 race（#1734）。注册 user repos 时优先使用 `gbrain sources add --path <dir>`（不要 `--url`）：URL-managed sources 可能 auto-reclone，而对它们执行 sync code walk 需要显式 `--allow-reclone` opt-in。

<!-- gstack-gbrain-search-guidance:end -->
