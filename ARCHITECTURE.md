# Architecture（架构）

本文解释 gstack 为什么这样构建。Setup 和 commands 见 CLAUDE.md；贡献指南见 CONTRIBUTING.md。

## 核心想法

gstack 给 Claude Code 一个 persistent browser，以及一组 opinionated workflow skills。浏览器是困难部分，其他都是 Markdown。

关键洞察：AI agent 与浏览器交互时，需要**亚秒级 latency** 和 **persistent state**。如果每个 command 都 cold-start 一个浏览器，每次 tool call 都要等 3-5 秒。如果浏览器在 commands 之间死亡，你会丢失 cookies、tabs 和 login sessions。因此 gstack 运行一个 long-lived Chromium daemon，CLI 通过 localhost HTTP 与它通信。

```
Claude Code                     gstack
─────────                      ──────
                               ┌──────────────────────┐
  Tool call: $B snapshot -i    │  CLI (compiled binary)│
  ─────────────────────────→   │  • reads state file   │
                               │  • POST /command      │
                               │    to localhost:PORT   │
                               └──────────┬───────────┘
                                          │ HTTP
                               ┌──────────▼───────────┐
                               │  Server (Bun.serve)   │
                               │  • dispatches command  │
                               │  • talks to Chromium   │
                               │  • returns plain text  │
                               └──────────┬───────────┘
                                          │ CDP
                               ┌──────────▼───────────┐
                               │  Chromium (headless)   │
                               │  • persistent tabs     │
                               │  • cookies carry over  │
                               │  • 30min idle timeout  │
                               └───────────────────────┘
```

第一次调用会启动全部组件（约 3 秒）。之后每次调用约 100-200ms。

## 为什么是 Bun

Node.js 也能工作。但 Bun 在这里更好，原因有四点：

1. **Compiled binaries。** `bun build --compile` 产出单个约 58MB executable。Runtime 不需要 `node_modules`、不需要 `npx`、不需要 PATH 配置。binary 直接运行。这很重要，因为 gstack 安装到 `~/.claude/skills/`，用户不期望在那里管理 Node.js project。

2. **Native SQLite。** Cookie decryption 会直接读取 Chromium 的 SQLite cookie database。Bun 内置 `new Database()`，不需要 `better-sqlite3`、native addon compilation 或 gyp。少一个会在不同机器上坏掉的环节。

3. **Native TypeScript。** 开发时 server 通过 `bun run server.ts` 运行。不需要 compilation step、`ts-node` 或 source maps。Compiled binary 用于部署，source files 用于开发。

4. **Built-in HTTP server。** `Bun.serve()` 快、简单，不需要 Express 或 Fastify。server 总共处理约 10 个 routes；framework 会是额外 overhead。

瓶颈始终是 Chromium，不是 CLI 或 server。Bun 的启动速度很好（compiled binary 约 1ms，Node 约 100ms），但这不是选择它的主要原因。Compiled binary 和 native SQLite 才是。

## Daemon model（daemon 模型）

### 为什么不每个 command 启动一个浏览器？

Playwright 可以在约 2-3 秒内启动 Chromium。单张 screenshot 没问题。但一次有 20+ commands 的 QA session，就会有 40+ 秒浏览器启动 overhead。更糟的是，commands 之间所有 state 都会丢失。Cookies、localStorage、login sessions、open tabs，全没了。

Daemon model 意味着：

- **Persistent state。** 登录一次，保持登录。打开 tab，它会保留。localStorage 跨 commands 持久化。
- **Sub-second commands。** 第一次调用之后，每个 command 都只是 HTTP POST。包括 Chromium 工作在内，round-trip 约 100-200ms。
- **Automatic lifecycle。** server 首次使用时自动启动，idle 30 分钟后自动关闭。不需要 process management。

### State file（状态文件）

server 写入 `.gstack/browse.json`（通过 tmp + rename 原子写入，mode 0o600）：

```json
{ "pid": 12345, "port": 34567, "token": "uuid-v4", "startedAt": "...", "binaryVersion": "abc123" }
```

CLI 读取此文件来找到 server。如果文件缺失，或 server HTTP health check 失败，CLI 会生成新 server。在 Windows 上，Bun binaries 中基于 PID 的 process detection 不可靠，因此 health check（GET /health）是所有平台上的主要 liveness signal。

### Port selection（端口选择）

随机选择 10000-60000 之间的 port（冲突时最多 retry 5 次）。这意味着 10 个 Conductor workspaces 可以各自运行自己的 browse daemon，零配置、零 port conflicts。旧方案（扫描 9400-9409）在 multi-workspace setups 中经常坏。

### Version auto-restart（版本变更自动重启）

build 会把 `git rev-parse HEAD` 写入 `browse/dist/.version`。每次 CLI invocation 时，如果 binary version 与 running server 的 `binaryVersion` 不一致，CLI 会 kill old server 并启动新 server。这完全避免了 “stale binary” 类 bug：重新构建 binary 后，下一个 command 会自动使用它。

## Security model（安全模型）

### 仅 localhost

HTTP server 绑定到 `127.0.0.1`，不是 `0.0.0.0`。网络上无法访问。

### Dual-listener tunnel architecture（v1.6.0.0）

当用户运行 `pair-agent --client` 时，daemon 会启动 ngrok tunnel，让 remote paired agent 可以驱动浏览器。把完整 daemon surface 暴露到 internet（即使在随机 ngrok subdomain 后面）意味着任何 Origin spoof 都会让 `/health` 泄露 root token，而 `/cookie-picker` 会把 token 嵌入 HTML，任何 caller 都能 fetch。

修复方式是**两个 HTTP listeners**，而不是一个：

- **Local listener**（`127.0.0.1:LOCAL_PORT`）：始终绑定。提供 bootstrap（带 token delivery 的 `/health`）、`/cookie-picker`、`/inspector/*`、`/welcome`、`/refs`、sidebar-agent API，以及完整 command surface。永不 forward。
- **Tunnel listener**（`127.0.0.1:TUNNEL_PORT`）：在 `/tunnel/start` 上 lazy bind，在 `/tunnel/stop` 上 teardown。只提供 locked allowlist：`/connect`（pairing ceremony，unauth + rate-limited）、`/command`（仅 scoped tokens，且进一步限制到 browser-driving command allowlist）、`/sidebar-chat`。其他全部 404。

ngrok 只 forward tunnel port。安全属性来自**物理 port 分离**：tunnel caller 无法访问 `/health` 或 `/cookie-picker`，因为这些 paths 在那个 TCP socket 上不存在。Header inference（检查 `x-forwarded-for`、检查 origin）不可靠（ngrok header behavior 会变；local proxies 也能添加这些 headers）；socket separation 则可靠。

| Endpoint | Local listener | Tunnel listener | Notes |
|---|---|---|---|
| `GET /health` | public (no token unless headed/extension) | 404 | Token bootstrap for extension happens locally only |
| `GET /connect` | public (`{alive:true}`) | public (`{alive:true}`) | Probe path for tunnel liveness |
| `POST /connect` | public (rate-limited 300/min) | public (rate-limited) | Setup-key exchange for pair-agent |
| `POST /command` | auth (Bearer root OR scoped) | auth (scoped only, allowlisted commands) | Root token on tunnel = 403 |
| `POST /sidebar-chat` | auth | auth | Lets remote agent post into local sidebar |
| `POST /pair` | root-only | 404 | Pairing mint — local operator action |
| `POST /tunnel/{start,stop}` | root-only | 404 | Daemon configuration |
| `POST /token`, `DELETE /token/:id` | root-only | 404 | Scoped token mint/revoke |
| `GET /cookie-picker`, `GET /cookie-picker/*` | public UI, auth API | 404 | Local-only — reads local browser DBs |
| `GET /inspector`, `/inspector/events`, etc. | auth | 404 | Extension callback, local-only |
| `GET /welcome` | public | 404 | GStack Browser landing page, local-only |
| `GET /refs` | auth | 404 | Ref map — internal state |
| `GET /activity/stream` | Bearer OR HttpOnly `gstack_sse` cookie | 404 | SSE. ?token= query param no longer accepted |
| `GET /inspector/events` | Bearer OR HttpOnly `gstack_sse` cookie | 404 | SSE. Same cookie as /activity/stream |
| `POST /sse-session` | auth (Bearer) | 404 | Mints the view-only 30-min SSE session cookie |

**Tunnel surface denial logs。** Tunnel listener 上的每次拒绝（`path_not_on_tunnel`、`root_token_on_tunnel`、`missing_scoped_token`、`disallowed_command:*`）都会异步记录到 `~/.gstack/security/attempts.jsonl`，包含 timestamp、source IP（来自 `x-forwarded-for`）、path 和 method。全局 rate capped 为 60 writes/min，以防 log-flood DoS。它与 prompt-injection scanner 共享 attempt log。

**SSE session cookies。** EventSource 无法发送 Authorization headers，因此 extension 在 bootstrap 时用 root Bearer POST 一次 `/sse-session`，获得一个 30 分钟 view-only cookie（`gstack_sse`、HttpOnly、SameSite=Strict）。该 cookie **只**对 `/activity/stream` 和 `/inspector/events` 有效；它不是 scoped token，不能用于 `/command`。Scope isolation 由 module boundary enforcement：`sse-session-cookie.ts` 不 import `token-registry.ts`。

**本波 non-goal**（tracked as #1136）：cookie-import-browser path 使用 `--remote-debugging-port=<random>` 启动 Chrome。在带 App-Bound Encryption v20 的 Windows 上，同一用户的本地 process 可以连接该 port 并 exfiltrate decrypted v20 cookies；相对于直接读取 SQLite DB（没有 DPAPI context 不能 decrypt v20）这是一条 elevation path。修复方向是 `--remote-debugging-pipe` 而不是 TCP，需要重构 CDP client。

### Bearer token auth（Bearer token 认证）

每个 server session 生成随机 UUID token，以 mode 0o600（owner-only read）写入 state file。每个会 mutate browser state 的 HTTP request 都必须包含 `Authorization: Bearer <token>`。token 不匹配时，server 返回 401。

这防止同一机器上的其他 processes 与你的 browse server 通信。Cookie picker UI（`/cookie-picker`）和 health check（`/health`）在 local listener 上 exempt，因为它们绑定到 127.0.0.1 且不执行 commands。在 tunnel listener 上，除 `/connect` 外没有 exempt。

### Cookie security（Cookie 安全）

Cookies 是 gstack 处理的最敏感数据。设计如下：

1. **Keychain access requires user approval。** 每个浏览器首次 cookie import 会触发 macOS Keychain dialog。用户必须点击 “Allow” 或 “Always Allow”。gstack 永远不会静默访问 credentials。

2. **Decryption happens in-process。** Cookie values 在内存中 decrypt（PBKDF2 + AES-128-CBC），加载到 Playwright context，永不以 plaintext 写盘。Cookie picker UI 永远不显示 cookie values，只显示 domain names 和 counts。

3. **Database is read-only。** gstack 将 Chromium cookie DB 复制到 temp file（避免与正在运行的 browser 发生 SQLite lock conflicts），并以 read-only 打开。它永远不修改真实 browser cookie database。

4. **Key caching is per-session。** Keychain password + derived AES key 在 server lifetime 内缓存在内存中。server 关闭时（idle timeout 或 explicit stop），cache 消失。

5. **No cookie values in logs。** Console、network 和 dialog logs 永不包含 cookie values。`cookies` command 输出 cookie metadata（domain、name、expiry），但 values 会 truncate。

### Shell injection prevention（防止 shell injection）

Browser registry（Comet、Chrome、Arc、Brave、Edge）是 hardcoded。Database paths 由已知 constants 构造，永不来自 user input。Keychain access 使用带 explicit argument arrays 的 `Bun.spawn()`，不是 shell string interpolation。

### Unicode sanitization at server egress（v1.38.0.0）

通过 CDP 采集的 page content 可能包含 lone UTF-16 surrogate halves（来自页面中 broken JavaScript string handling 的 orphaned high 或 low surrogates）。当这些内容进入 `JSON.stringify` 时，Bun 会把它们输出成 `\uD800` 风格 escape sequences；downstream consumer 的 `JSON.parse` 会接受，但 Anthropic API 会以 400 拒绝，让一个奇怪页面杀掉整个 session。防御是 single-point，应用在所有发送 page-derived strings 的 server egress 上。

| Egress path | Module | Sanitization point |
|---|---|---|
| `POST /command` (HTTP) | `browse/src/server.ts` | `handleCommandInternal` wrapper (sanitizes the result of `handleCommandInternalImpl`) |
| `POST /command/batch` | `browse/src/server.ts` | Same wrapper — batch consumers inherit it |
| `GET /activity/stream` (SSE) | `browse/src/server.ts` | `sanitizeReplacer` passed to `JSON.stringify` |
| `GET /inspector/events` (SSE) | `browse/src/server.ts` | `sanitizeReplacer` passed to `JSON.stringify` |

`sanitizeReplacer` 是 `JSON.stringify` replacer function，会在 encoding 期间清理每个 string value。Post-stringify regex 在这里无效，因为 `JSON.stringify` 已经把 `\uD800` 转成 literal escape sequence `"\\ud800"`，regex 已无法匹配，所以 replacer 必须在 encoding pipeline 内运行。Pure-string helper `sanitizeLoneSurrogates` 直接用于 `text/plain` responses。

**Architectural invariant。** 每个新的 SSE/WebSocket writer 或发送 page-content-derived strings 的 HTTP response，都必须走两个路径之一：object payload 用 `JSON.stringify(payload, sanitizeReplacer)`，text body 用 `sanitizeLoneSurrogates(body)`。绕过两者的新 surface 会让系统 desync。`server.ts` 中两个 SSE producers 旁边的 inline comments 也说明了这一点；`browse/test/server-sanitize-surrogates.test.ts` 用 bug-repro + invariant tests 固定 wiring（`handleCommandInternalImpl` rename、central sanitization line、replacer existence、SSE producers stringify with replacer）。

### Prompt injection defense（sidebar agent）

Chrome sidebar agent 拥有 tools（Bash、Read、Glob、Grep、WebFetch）并读取 hostile web pages，因此它是 gstack 最暴露于 prompt injection 的部分。防御是 layered，不是 single-point。

1. **L1-L3 content security（`browse/src/content-security.ts`）。** 在每个 page-content command 和每个 tool output 上运行：datamarking、hidden-element strip、ARIA regex、URL blocklist、trust-boundary envelope wrapper。server 和 agent 两侧都应用。

2. **L4 ML classifier — TestSavantAI（`browse/src/security-classifier.ts`）。** 一个随 agent 捆绑的 22MB BERT-small ONNX model（int8 quantized）。本地运行，无网络。在 Claude 看到之前扫描每条 user message 和每个 Read/Glob/Grep/WebFetch tool output。可通过 `GSTACK_SECURITY_ENSEMBLE=deberta` opt-in 721MB DeBERTa-v3 ensemble。

3. **L4b transcript classifier。** 一个 Claude Haiku pass，会查看完整 conversation shape（user message、tool calls、tool output），而不只是文本。由 `LOG_ONLY: 0.40` gate，所以大多数干净流量会跳过 paid call。

4. **L5 canary token（`browse/src/security.ts`）。** session start 时将随机 token 注入 system prompt。Rolling-buffer detection 会跨 `text_delta` 和 `input_json_delta` streams 捕捉该 token 是否出现在 Claude output、tool arguments、URLs 或 file writes 中。Deterministic BLOCK：如果 token 泄露，说明攻击者说服 Claude 暴露了 system prompt，session 结束。

5. **L6 ensemble combiner（`combineVerdict`）。** BLOCK 需要两个 ML classifiers 都在 >= `WARN`（0.75）达成一致，而不是单个 confident hit。这是针对 Stack Overflow instruction-writing false-positive 的 mitigation。在 tool-output scans 上，single-layer high confidence BLOCK 会直接触发，因为内容不是 user-authored，所以 FP concern 不适用。

**Critical constraint：**`security-classifier.ts` 只在 sidebar-agent process 中运行，永不进入 compiled browse binary。`@huggingface/transformers` v4 需要 `onnxruntime-node`，而它会在 Bun compile 的 temp extract directory 中 `dlopen` 失败。只有 pure-string pieces（canary inject/check、verdict combiner、attack log、status）位于 `security.ts`，可安全从 `server.ts` import。

**Env knobs：**`GSTACK_SECURITY_OFF=1` 是真正的 kill switch（跳过 ML scan，canary 仍会 inject）。Model cache 位于 `~/.gstack/models/testsavant-small/`（112MB，首次运行）和 `~/.gstack/models/deberta-v3-injection/`（721MB，仅 opt-in）。Attack log 位于 `~/.gstack/security/attempts.jsonl`（salted sha256 + domain，10MB rotate，5 generations）。Per-device salt 位于 `~/.gstack/security/device-salt`（0600），并在 process 内 cache，以 survive FS-unwritable environments。

**Visibility。** sidebar header 显示 shield icon（green/amber/red），通过 `/sidebar-chat` poll。canary leak 或 BLOCK verdict 时，居中 banner 会显示 exact layer scores。`bin/gstack-security-dashboard` 聚合 local attempts；`supabase/functions/community-pulse` 聚合用户 opt-in community telemetry。

## Ref system（ref 系统）

Refs（`@e1`、`@e2`、`@c1`）让 agent 可以在不写 CSS selectors 或 XPath 的情况下定位页面元素。

### 工作方式

```
1. Agent runs: $B snapshot -i
2. Server calls Playwright's page.accessibility.snapshot()
3. Parser walks the ARIA tree, assigns sequential refs: @e1, @e2, @e3...
4. For each ref, builds a Playwright Locator: getByRole(role, { name }).nth(index)
5. Stores Map<string, RefEntry> on the BrowserManager instance (role + name + Locator)
6. Returns the annotated tree as plain text

Later:
7. Agent runs: $B click @e3
8. Server resolves @e3 → Locator → locator.click()
```

### 为什么是 Locators，而不是 DOM mutation

显而易见的做法是向 DOM 注入 `data-ref="@e1"` attributes。但这会在以下情况下坏掉：

- **CSP（Content Security Policy）。** 很多 production sites 会阻止 scripts 修改 DOM。
- **React/Vue/Svelte hydration。** Framework reconciliation 可能剥离 injected attributes。
- **Shadow DOM。** 外部无法进入 shadow roots。

Playwright Locators 位于 DOM 之外。它们使用 accessibility tree（Chromium 内部维护）和 `getByRole()` queries。没有 DOM mutation，没有 CSP 问题，也没有 framework conflicts。

### Ref lifecycle（ref 生命周期）

主 frame 的 `framenavigated` event 触发 navigation 时，refs 会被清空。这是正确的：navigation 后所有 locators 都 stale。agent 必须重新运行 `snapshot` 获取 fresh refs。这是设计意图：stale refs 应该 loud failure，而不是点击错误元素。

### Ref staleness detection（ref 过期检测）

SPAs 可以在不触发 `framenavigated` 的情况下 mutate DOM（例如 React router transitions、tab switches、modal opens）。这会让 refs stale，即使 page URL 未变。为了捕捉这种情况，`resolveRef()` 在使用任何 ref 前会执行 async `count()` check：

```
resolveRef(@e3) → entry = refMap.get("e3")
                → count = await entry.locator.count()
                → if count === 0: throw "Ref @e3 is stale — element no longer exists. Run 'snapshot' to get fresh refs."
                → if count > 0: return { locator }
```

这会快速失败（约 5ms overhead），而不是让 Playwright 的 30 秒 action timeout 在 missing element 上耗尽。`RefEntry` 会把 `role` 和 `name` metadata 与 Locator 一起存储，因此 error message 可以告诉 agent 该元素原本是什么。

### Cursor-interactive refs（@c）

`-C` flag 会寻找 clickable 但不在 ARIA tree 中的元素：例如 styled with `cursor: pointer` 的元素、带 `onclick` attributes 的元素，或 custom `tabindex`。这些元素使用单独 namespace 中的 `@c1`、`@c2` refs。这能捕捉 frameworks 渲染成 `<div>` 但实际是 buttons 的 custom components。

## Logging architecture（日志架构）

三个 ring buffers（每个 50,000 entries，O(1) push）：

```
Browser events → CircularBuffer (in-memory) → Async flush to .gstack/*.log
```

Console messages、network requests 和 dialog events 各自拥有 buffer。每 1 秒 flush 一次；server 只 append 自上次 flush 以来的新 entries。这意味着：

- HTTP request handling 永不被 disk I/O 阻塞
- Logs survive server crashes（最多丢失 1 秒数据）
- Memory bounded（50K entries × 3 buffers）
- Disk files append-only，可被 external tools 读取

`console`、`network` 和 `dialog` commands 从 in-memory buffers 读取，而不是从 disk。Disk files 用于 post-mortem debugging。

## SKILL.md template system（SKILL.md 模板系统）

### 问题

SKILL.md 文件告诉 Claude 如何使用 browse commands。如果 docs 列出了不存在的 flag，或漏掉新增 command，agent 就会撞 errors。手工维护 docs 总会与代码 drift。

### 方案

```
SKILL.md.tmpl          (human-written prose + placeholders)
       ↓
gen-skill-docs.ts      (reads source code metadata)
       ↓
SKILL.md               (committed, auto-generated sections)
```

Templates 包含需要 human judgment 的 workflows、tips 和 examples。Placeholders 在 build time 从 source code 填充：

| Placeholder | Source | 生成内容 |
|-------------|--------|----------|
| `{{COMMAND_REFERENCE}}` | `commands.ts` | 分类 command table |
| `{{SNAPSHOT_FLAGS}}` | `snapshot.ts` | 带 examples 的 flag reference |
| `{{PREAMBLE}}` | `gen-skill-docs.ts` | Startup block：update check、session tracking、contributor mode、AskUserQuestion format |
| `{{BROWSE_SETUP}}` | `gen-skill-docs.ts` | Binary discovery + setup instructions |
| `{{BASE_BRANCH_DETECT}}` | `gen-skill-docs.ts` | 面向 PR-targeting skills（ship、review、qa、plan-ceo-review）的 dynamic base branch detection |
| `{{QA_METHODOLOGY}}` | `gen-skill-docs.ts` | /qa 和 /qa-only 共用的 QA methodology block |
| `{{DESIGN_METHODOLOGY}}` | `gen-skill-docs.ts` | /plan-design-review 和 /design-review 共用的 design audit methodology |
| `{{REVIEW_DASHBOARD}}` | `gen-skill-docs.ts` | /ship pre-flight 的 Review Readiness Dashboard |
| `{{TEST_BOOTSTRAP}}` | `gen-skill-docs.ts` | /qa、/ship、/design-review 的 test framework detection、bootstrap、CI/CD setup |
| `{{CODEX_PLAN_REVIEW}}` | `gen-skill-docs.ts` | /plan-ceo-review 和 /plan-eng-review 的 optional cross-model plan review（Codex 或 Claude subagent fallback） |
| `{{DESIGN_SETUP}}` | `resolvers/design.ts` | `$D` design binary 的 discovery pattern，mirrors `{{BROWSE_SETUP}}` |
| `{{DESIGN_SHOTGUN_LOOP}}` | `resolvers/design.ts` | /design-shotgun、/plan-design-review、/design-consultation 共用的 comparison board feedback loop |
| `{{UX_PRINCIPLES}}` | `resolvers/design.ts` | /design-html、/design-shotgun、/design-review、/plan-design-review 使用的 user behavioral foundations（scanning、satisficing、goodwill reservoir、trunk test） |
| `{{GBRAIN_CONTEXT_LOAD}}` | `resolvers/gbrain.ts` | Brain-first context search，包含 keyword extraction、health awareness 和 data-research routing。注入 10 个 brain-aware skills；在 non-brain hosts 上 suppress。 |
| `{{GBRAIN_SAVE_RESULTS}}` | `resolvers/gbrain.ts` | Post-skill brain persistence，包含 entity enrichment、throttle handling 和 per-skill save instructions。8 种 skill-specific save formats。 |

这个结构是可靠的：如果 command 存在于代码，它就会出现在 docs 中。如果不存在，就不可能出现。

### Preamble（前置块）

每个 skill 都以 `{{PREAMBLE}}` block 开头，在 skill 自身逻辑前运行。它用一个 bash command 处理五件事：

1. **Update check**：调用 `gstack-update-check`，在有 upgrade 时报告。
2. **Session tracking**：touch `~/.gstack/sessions/$PPID` 并统计 active sessions（过去 2 小时内 modified 的 files）。当有 3+ sessions 运行时，所有 skills 进入 “ELI16 mode”：每个问题都会重新 grounding 用户上下文，因为他们正在 juggling windows。
3. **Operational self-improvement**：每个 skill session 结束时，agent 反思 failures（CLI errors、wrong approaches、project quirks），并把 operational learnings 记录到项目 JSONL file，供未来 sessions 使用。
4. **AskUserQuestion format**：统一格式：context、question、`RECOMMENDATION: Choose X because ___`、lettered options。所有 skills 一致。
5. **Search Before Building**：构建 infrastructure 或 unfamiliar patterns 前，先搜索。三层知识：tried-and-true（Layer 1）、new-and-popular（Layer 2）、first-principles（Layer 3）。当 first-principles reasoning 显示 conventional wisdom 是错的，agent 会命名 “eureka moment” 并记录。完整 builder philosophy 见 `ETHOS.md`。

### 为什么 commit，而不是 runtime generate？

三个原因：

1. **Claude 在 skill load time 读取 SKILL.md。** 用户调用 `/browse` 时没有 build step。文件必须已经存在且正确。
2. **CI 可以校验 freshness。** `gen:skill-docs --dry-run` + `git diff --exit-code` 会在 merge 前捕捉 stale docs。
3. **Git blame 可用。** 你可以看到 command 何时添加、在哪个 commit 添加。

### Template test tiers（模板测试层级）

| Tier | What | Cost | Speed |
|------|------|------|-------|
| 1 — Static validation | Parse every `$B` command in SKILL.md, validate against registry | Free | <2s |
| 2 — E2E via `claude -p` | Spawn real Claude session, run each skill, check for errors | ~$3.85 | ~20min |
| 3 — LLM-as-judge | Sonnet scores docs on clarity/completeness/actionability | ~$0.15 | ~30s |

Tier 1 在每次 `bun test` 中运行。Tiers 2+3 由 `EVALS=1` gate。思路是：免费捕捉 95% 的问题，只在需要 judgment calls 时使用 LLMs。

## Command dispatch（命令分发）

Commands 按 side effects 分类：

- **READ**（text、html、links、console、cookies 等）：无 mutations。可安全 retry。返回 page state。
- **WRITE**（goto、click、fill、press 等）：mutates page state。非 idempotent。
- **META**（snapshot、screenshot、tabs、chain 等）：不完全属于 read/write 的 server-level operations。

这不只是组织方式。server 会用它 dispatch：

```typescript
if (READ_COMMANDS.has(cmd))  → handleReadCommand(cmd, args, bm)
if (WRITE_COMMANDS.has(cmd)) → handleWriteCommand(cmd, args, bm)
if (META_COMMANDS.has(cmd))  → handleMetaCommand(cmd, args, bm, shutdown)
```

`help` command 返回全部三组 commands，让 agents 可以 self-discover available commands。

## Error philosophy（错误设计哲学）

Errors 是给 AI agents 看的，不是给人看的。每条 error message 都必须 actionable：

- "Element not found" → "Element not found or not interactable. Run `snapshot -i` to see available elements."
- "Selector matched multiple elements" → "Selector matched multiple elements. Use @refs from `snapshot` instead."
- Timeout → "Navigation timed out after 30s. The page may be slow or the URL may be wrong."

Playwright native errors 会通过 `wrapError()` rewrite，去掉 internal stack traces 并添加 guidance。agent 应该能读懂 error，并在无需人介入的情况下知道下一步。

### Crash recovery（崩溃恢复）

server 不尝试 self-heal。如果 Chromium crashes（`browser.on('disconnected')`），server 会立即退出。CLI 会在下一个 command 检测 dead server 并 auto-restart。相比尝试 reconnect 到 half-dead browser process，这更简单、更可靠。

## E2E test infrastructure（E2E 测试基础设施）

### Session runner（`test/helpers/session-runner.ts`）

E2E tests 以完全独立的 subprocess 生成 `claude -p`，不通过 Agent SDK，因为 Agent SDK 不能嵌套在 Claude Code sessions 内。runner：

1. 将 prompt 写入 temp file（避免 shell escaping issues）
2. 生成 `sh -c 'cat prompt | claude -p --output-format stream-json --verbose'`
3. 从 stdout stream NDJSON，以获得 real-time progress
4. 与 configurable timeout race
5. 将完整 NDJSON transcript parse 为 structured results

`parseNDJSON()` function 是 pure：无 I/O、无 side effects，因此可独立测试。

### Observability data flow（可观测性数据流）

```
  skill-e2e-*.test.ts
        │
        │ generates runId, passes testName + runId to each call
        │
  ┌─────┼──────────────────────────────┐
  │     │                              │
  │  runSkillTest()              evalCollector
  │  (session-runner.ts)         (eval-store.ts)
  │     │                              │
  │  per tool call:              per addTest():
  │  ┌──┼──────────┐              savePartial()
  │  │  │          │                   │
  │  ▼  ▼          ▼                   ▼
  │ [HB] [PL]    [NJ]          _partial-e2e.json
  │  │    │        │             (atomic overwrite)
  │  │    │        │
  │  ▼    ▼        ▼
  │ e2e-  prog-  {name}
  │ live  ress   .ndjson
  │ .json .log
  │
  │  on failure:
  │  {name}-failure.json
  │
  │  ALL files in ~/.gstack-dev/
  │  Run dir: e2e-runs/{runId}/
  │
  │         eval-watch.ts
  │              │
  │        ┌─────┴─────┐
  │     read HB     read partial
  │        └─────┬─────┘
  │              ▼
  │        render dashboard
  │        (stale >10min? warn)
```

**Split ownership：**session-runner 拥有 heartbeat（当前 test state），eval-store 拥有 partial results（已完成 test state）。watcher 读取两者。两个组件互不知道对方，只通过 filesystem 共享数据。

**Non-fatal everything：**所有 observability I/O 都包在 try/catch 中。write failure 永远不会导致 test failure。tests 自身才是 source of truth；observability 是 best-effort。

**Machine-readable diagnostics：**每个 test result 都包含 `exit_reason`（success、timeout、error_max_turns、error_api、exit_code_N）、`timeout_at_turn` 和 `last_tool_call`。这支持如下 `jq` queries：

```bash
jq '.tests[] | select(.exit_reason == "timeout") | .last_tool_call' ~/.gstack-dev/evals/_partial-e2e.json
```

### Eval persistence（`test/helpers/eval-store.ts`）

`EvalCollector` 累积 test results，并以两种方式写入：

1. **Incremental：**`savePartial()` 在每个 test 后写入 `_partial-e2e.json`（atomic：写 `.tmp`，再 `fs.renameSync`）。能 survive kills。
2. **Final：**`finalize()` 写入 timestamped eval file（例如 `e2e-20260314-143022.json`）。partial file 永不清理，会与 final file 一起保留，供 observability 使用。

`eval:compare` 比较两个 eval runs。`eval:summary` 汇总 `~/.gstack-dev/evals/` 中所有 runs 的 stats。

### Test tiers（测试层级）

| Tier | What | Cost | Speed |
|------|------|------|-------|
| 1 — Static validation | Parse `$B` commands, validate against registry, observability unit tests | Free | <5s |
| 2 — E2E via `claude -p` | Spawn real Claude session, run each skill, scan for errors | ~$3.85 | ~20min |
| 3 — LLM-as-judge | Sonnet scores docs on clarity/completeness/actionability | ~$0.15 | ~30s |

Tier 1 在每次 `bun test` 中运行。Tiers 2+3 由 `EVALS=1` gate。思路是：免费捕捉 95% 的问题，只在 judgment calls 和 integration testing 上使用 LLMs。

## 有意不做什么

- **不做 WebSocket streaming。** HTTP request/response 更简单，可用 curl debug，并且足够快。Streaming 会为 marginal benefit 增加 complexity。
- **不做 MCP protocol。** MCP 每个 request 都增加 JSON schema overhead，并需要 persistent connection。Plain HTTP + plain text output 对 tokens 更轻，也更易 debug。
- **不做 multi-user support。** 每个 workspace 一个 server、一个 user。Token auth 是 defense-in-depth，不是 multi-tenancy。
- **不做 Windows/Linux cookie decryption。** macOS Keychain 是唯一支持的 credential store。Linux（GNOME Keyring/kwallet）和 Windows（DPAPI）在架构上可行，但尚未实现。
- **不做 iframe auto-discovery。** `$B frame` 支持 cross-frame interaction（CSS selector、@ref、`--name`、`--url` matching），但 ref system 在 `snapshot` 期间不会 auto-crawl iframes。你必须先显式进入 frame context。
