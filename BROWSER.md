# Browser — 完整参考

gstack 的 browser surface 集中在这一份文档中：headless Chromium daemon、70+ commands、基于 ref 的 element selection、可固化的 browser-skills、带 Chrome side panel 的真实浏览器模式、sidebar 中的 Claude PTY、ngrok pair-agent flow，以及分层 prompt-injection defense。这一切都藏在一个 compiled CLI 后面，输出 plain text 到 stdout。每次调用约 100-200ms。零 context-token overhead。

如果你在最近一两个 release 中用过 gstack，新的 headline 是 productivity loop：`/scrape <intent>` 先驱动页面一次，`/skillify` 把 flow 固化成 deterministic Playwright script，下一次相同 intent 的 `/scrape` 就不再需要 agent 重新探索 30 秒，而是约 200ms 完成。

---

## 快速开始

```bash
# 一次性：构建 binary（browse/dist/browse，约 58MB）
bun install && bun run build

# 设置一次 $B，之后直接使用
B=./browse/dist/browse           # 或 ~/.claude/skills/gstack/browse/dist/browse

# 驱动页面
$B goto https://news.ycombinator.com
$B snapshot -i                   # 生成之后可 click/fill/inspect 的 @e refs
$B click @e30                    # 点击 snapshot 中的 ref 30
$B text                          # 获取干净 page text
$B screenshot /tmp/hn.png

# 将重复 flow codify
/scrape latest hacker news stories
/skillify                        # 写入 ~/.gstack/browser-skills/hn-front/...
/scrape hacker news front page   # 第二次调用：通过已固化 skill 约 200ms 完成

# 实时观看 Claude 工作
$B connect                       # headed Chromium + Side Panel extension
```

---

## 目录

1. [它是什么](#它是什么)
2. [Productivity loop（生产力循环）— `/scrape` + `/skillify`](#productivity-loop)
3. [Architecture（架构）](#architecture)
4. [命令参考](#命令参考)
5. [Snapshot system + ref-based selection（快照系统与基于 ref 的选择）](#snapshot-system)
6. [Browser-skills runtime（browser-skills 运行时）](#browser-skills-runtime)
7. [Domain-skills（每个站点的 agent notes）](#domain-skills)
8. [Real-browser mode（真实浏览器模式，`$B connect`）](#real-browser-mode) — 包含 [`--headed` + `--proxy` + `--navigate` (v1.28.0.0)](#headed-mode--proxy--browser-native-downloads-v12800)
9. [Side Panel + sidebar agent（侧边栏与 sidebar agent）](#side-panel--sidebar-agent)
10. [Pair-agent（通过 ngrok tunnel 的 remote agents）](#pair-agent)
11. [Authentication + tokens（认证与 tokens）](#authentication)
12. [Prompt-injection security stack（L1–L6）](#security-stack)
13. [Screenshots、PDFs、visual inspection（截图、PDF 与视觉检查）](#screenshots-pdfs-visual)
14. [Local HTML（`goto file://` vs `load-html`）](#local-html)
15. [Batch endpoint（批量 endpoint）](#batch-endpoint)
16. [Console、network、dialog capture（console、network、dialog 捕获）](#capture)
17. [JS execution（`js` + `eval`）](#js-execution)
18. [Tabs、frames、state、watch、inbox](#tabs-frames-state)
19. [CDP escape hatch + CSS inspector（CDP 逃生口与 CSS 检查器）](#cdp)
20. [Performance + scale（性能与规模）](#performance)
21. [Multi-workspace isolation（多 workspace 隔离）](#multi-workspace)
22. [Environment variables（环境变量）](#environment-variables)
23. [Source map（源码索引）](#source-map)
24. [Development + testing（开发与测试）](#development)
25. [Cross-references（交叉引用）](#cross-references)
26. [致谢](#致谢)

---

## 它是什么

一个 compiled CLI binary，通过 HTTP 与 persistent local Chromium daemon 通信。CLI 是 thin client：读取 state file，发送 command，把 response 打印到 stdout。真正工作由 daemon 通过 [Playwright](https://playwright.dev/) 完成。

早期作为 Chrome MCP server 的所有事情，现在都通过 plain stdout 完成。没有 JSON-schema framing，没有 protocol negotiation，没有 persistent WebSocket。Claude 的 Bash tool 已经存在，所以直接用它。

三种逐级增强的模式：

- **Headless**（默认）。Daemon 运行无可见窗口的 Chromium。最快、最便宜，`/qa`、`/design-review`、`/benchmark` 等 skills 默认使用。
- **Headed via `$B connect`**。同一个 daemon，但 Chromium 可见（rebranded as “GStack Browser”），并 auto-load Side Panel extension。你可以实时看到每个 command 发生。
- **Pair-agent over a tunnel**。Daemon 绑定第二个 listener，由 ngrok 转发。Remote agent（Codex、OpenClaw、Hermes，任何能 speak HTTP 的 agent）通过 26-command allowlist 和 scoped single-use token 驱动你的 local browser。

---

## Productivity loop（生产力循环）

v1.19.0.0 的 shipped headline。两个 gstack skills 包装 browser-skills runtime，所以第二次让 Claude scrape 同一个页面时，约 200ms 完成。

### `/scrape <intent>`

提取 page data 的统一入口。底层有三条路径：

1. **Match path (~200ms)** — agent 运行 `$B skill list`，把 intent 与每个 skill 的 `triggers:` array + `description` + `host` 做 semantic match；如果存在 confident match，就运行 `$B skill run <name>`。
2. **Prototype path (~30s)** — 没有 match 时，agent 用 `$B goto`、`$B text`、`$B html`、`$B links` 等驱动页面，返回 JSON，并追加一行 “say `/skillify`” suggestion。
3. **Mutating-intent refusal** — *submit*、*click*、*fill* 等动词路由到 `/automate`（Phase 2b，`TODOS.md` 中的 P0）。`/scrape` 按 contract 是 read-only。

### `/skillify`

把最近一次成功的 `/scrape` prototype 固化成磁盘上的永久 browser-skill。十一步，三个 locked contracts：

- **D1 — Provenance guard.** 回溯 ≤10 个 agent turns，寻找 clearly-bounded 的 `/scrape` result。冷启动时用一条具体 message 拒绝。绝不从 chat fragments 静默 synthesis。
- **D2 — Synthesis input slice.** 只提取产生用户接受 JSON 的 final-attempt `$B` calls，加上用户 intent string。丢弃 failed selectors、chat 和 earlier-session content。
- **D3 — Atomic write.** 先把所有内容 stage 到 `~/.gstack/.tmp/skillify-<spawnId>/`，针对 temp dir 运行 `$B skill test`，只有 test pass + user approval 后才 rename 到 final tier path。Test fail 或 rejection：完整 `rm -rf` temp dir。`$B skill list` 中永远不会出现 half-written skill。

Mutating-flow sibling `/automate` 被拆成 `TODOS.md` 中的 P0，下一分支发布。它复用同一套 skillify machinery，但运行未固化的 mutating steps 时会对每一步做 confirmation gate。

完整设计和 decision trail 见 [`docs/designs/BROWSER_SKILLS_V1.md`](docs/designs/BROWSER_SKILLS_V1.md)。

---

## Architecture（架构）

```
┌─────────────────────────────────────────────────────────────────┐
│  Claude Code                                                    │
│                                                                 │
│  $B goto https://staging.myapp.com                              │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────┐    HTTP POST     ┌──────────────┐                 │
│  │ browse   │ ──────────────── │ Bun HTTP     │                 │
│  │ CLI      │  127.0.0.1:rand  │ daemon       │                 │
│  │          │  Bearer token    │              │                 │
│  │ compiled │ ◄──────────────  │  Playwright  │──── Chromium    │
│  │ binary   │  plain text      │  API calls   │    (headless    │
│  └──────────┘                  └──────────────┘     or headed)  │
│   ~1ms startup                  persistent daemon               │
│                                 auto-starts on first call       │
│                                 auto-stops after 30 min idle    │
└─────────────────────────────────────────────────────────────────┘
```

### Daemon lifecycle（daemon 生命周期）

1. **First call.** CLI 检查 `<project>/.gstack/browse.json` 是否有 running server。没有则在 background spawn `bun run browse/src/server.ts`。Daemon 通过 Playwright 启动 headless Chromium，选择 random port（10000-60000），生成 bearer token，写 state file（chmod 600），开始接收 requests。约 3 秒。
2. **Subsequent calls.** CLI 读取 state file，带 bearer token 发送 HTTP POST，并打印 response。Round trip 约 100-200ms。
3. **Idle shutdown.** 30 分钟没有 commands 后，daemon shutdown 并清理 state file。下一次 call 会重启。
4. **Crash recovery.** 如果 Chromium crash，daemon 立刻退出。没有 self-healing，不隐藏 failure。CLI 在下一次 call 检测 dead daemon，并启动 fresh one。

### Multi-workspace isolation（多 workspace 隔离）

每个 project root（通过 `git rev-parse --show-toplevel` 检测）都有自己的 daemon、port、state file、cookies 和 logs。不会 cross-workspace collisions。State 位于 `<project>/.gstack/browse.json`。

| Workspace | State file | Port |
|-----------|-----------|------|
| `/code/project-a` | `/code/project-a/.gstack/browse.json` | random (10000-60000) |
| `/code/project-b` | `/code/project-b/.gstack/browse.json` | random (10000-60000) |

---

## 命令参考

约 70 个 commands，覆盖 read、write 和 meta。Selectors 接受 CSS、来自 `snapshot` 的 `@e` refs，或来自 `snapshot -C` 的 `@c` refs。完整表：

### Reading（读取）

| Command | Description |
|---------|-------------|
| `text [sel]` | 干净 page text（或限定到 selector） |
| `html [sel]` | innerHTML；无 selector 时为 full page HTML |
| `links` | 所有 links，格式为 `text → href` |
| `forms` | Form fields，输出为 JSON |
| `accessibility` | 完整 ARIA tree |
| `media [--images\|--videos\|--audio] [sel]` | Media elements，包含 URLs、dimensions、types |
| `data [--jsonld\|--og\|--meta\|--twitter]` | Structured data：JSON-LD、OG、Twitter Cards、meta tags |

### Inspection（检查）

| Command | Description |
|---------|-------------|
| `js <expr> [--out <file>] [--raw]` | 在 page context 运行 inline JavaScript expression，并以 string 返回。带 `--out <file>` 时，结果写入 disk 而不是返回；`data:*;base64,...` 会解码成 raw bytes，除非传 `--raw`。`--out` 会让调用变成 WRITE（需要 `write` scope，且绝不允许通过 tunnel 使用）。 |
| `eval <file> [--out <file>] [--raw]` | 从 file 运行 JS（path under /tmp or cwd；与 `js` 相同 sandbox）。`--out`/`--raw` 行为同 `js`。 |
| `css <sel> <prop>` | Computed CSS value |
| `attrs <sel\|@ref>` | Element attributes，输出为 JSON |
| `is <prop> <sel\|@ref>` | State check：visible、hidden、enabled、disabled、checked、editable、focused |
| `console [--clear\|--errors]` | Captured console messages |
| `network [--clear]` | Captured network requests |
| `dialog [--clear]` | Captured dialog messages |
| `cookies` | All cookies，输出为 JSON |
| `storage` / `storage set <key> <val>` | 读取 localStorage + sessionStorage；设置 localStorage |
| `perf` | Page load timings |
| `inspect [sel] [--all] [--history]` | Deep CSS via CDP：full rule cascade、box model、computed styles |
| `ux-audit` | 用于 behavioral analysis 的 page structure：site ID、nav、headings、text blocks、interactive elements |
| `cdp <Domain.method> [json-params]` | Raw CDP method dispatch（deny-default；allowlist in `cdp-allowlist.ts`） |

### Navigation（导航）

| Command | Description |
|---------|-------------|
| `goto <url>` | Navigate to URL（`http://`、`https://`、`file://`） |
| `load-html <file>` | 在 memory 中加载 local HTML（没有 `file://` URL；viewport scale changes 后仍保留） |
| `back`, `forward`, `reload` | Standard nav |
| `url` | Current page URL |
| `wait <sel\|--networkidle\|--load>` | 等待 element、network idle 或 page load（15s timeout） |

### Interaction（交互）

| Command | Description |
|---------|-------------|
| `click <sel\|@ref>` | Click element |
| `fill <sel> <val>` | Fill input |
| `select <sel> <val>` | Select dropdown option（value、label 或 visible text） |
| `hover <sel>` | Hover element |
| `type <text>` | Type into focused element |
| `press <key>` | Playwright keyboard key（case-sensitive: Enter, Tab, ArrowUp, Shift+Enter, Control+A, ...） |
| `scroll [sel\|@ref]` | Scroll element into view；无 selector 时跳到 page bottom |
| `viewport [<WxH>] [--scale <n>]` | 设置 viewport size + optional `deviceScaleFactor` 1-3（retina screenshots） |
| `upload <sel> <file> [...]` | Upload file(s) |
| `dialog-accept [text]` | Auto-accept next alert/confirm/prompt；text 用于 prompts |
| `dialog-dismiss` | Auto-dismiss next dialog |

### Style + cleanup（样式与清理）

| Command | Description |
|---------|-------------|
| `style <sel> <prop> <val>` | 修改 CSS property（支持 undo） |
| `style --undo [N]` | Undo last N style changes |
| `cleanup [--ads\|--cookies\|--sticky\|--social\|--all]` | Remove page clutter |
| `prettyscreenshot [--scroll-to <sel\|text>] [--cleanup] [--hide <sel>...] [path]` | Clean screenshot，支持 cleanup、scroll、hide |

### Visual（视觉输出）

| Command | Description |
|---------|-------------|
| `screenshot [--selector <css>] [--viewport] [--clip x,y,w,h] [--base64] [sel\|@ref] [path]` | 五种模式：full page、viewport、element crop、region clip、base64 |
| `pdf [path] [--format letter\|a4\|legal] [...]` | 带 full layout 的 PDF：format、width/height、margins、header/footer templates、page numbers，`--tagged` 用于 accessibility，`--toc` waits for Paged.js |
| `responsive [prefix]` | 三张 screenshots：mobile (375x812)、tablet (768x1024)、desktop (1280x720) |
| `diff <url1> <url2>` | 两个 URLs 之间的 text diff |

### Cookies + headers（cookies 与 headers）

| Command | Description |
|---------|-------------|
| `cookie <name>=<value>` | 在 current page domain 设置 cookie |
| `cookie-import <json>` | 从 JSON file 导入 cookies |
| `cookie-import-browser [browser] [--domain d]` | 从已安装 Chromium browsers 导入（interactive picker，或 `--domain` direct import） |
| `header <name>:<value>` | 设置 custom request header（sensitive values auto-redacted） |
| `useragent <string>` | 设置 user agent（触发 context recreation，invalidates refs） |

### Tabs + frames（tabs 与 frames）

| Command | Description |
|---------|-------------|
| `tabs` | 列出 open tabs |
| `tab <id>` | 切换到指定 tab |
| `newtab [url] [--json]` | 打开新 tab；`--json` 返回 `{tabId, url}` 供 programmatic use |
| `closetab [id]` | 关闭 tab |
| `tab-each <command> [args...]` | 在每个 open tab 上 fan out command；返回 JSON |
| `frame <sel\|@ref\|--name n\|--url pattern\|main>` | 切换到 iframe context（或回 main）；清除 refs |

### Extraction（提取）

| Command | Description |
|---------|-------------|
| `download <url\|@ref> [path] [--base64]` | 使用 browser cookies 下载 URL 或 media element |
| `scrape <images\|videos\|media> [--selector] [--dir] [--limit]` | 从 page bulk download 所有 media；写入 `manifest.json` |
| `archive [path]` | 通过 CDP 保存 complete page as MHTML |

### Snapshot（快照）

| Command | Description |
|---------|-------------|
| `snapshot [-i] [-c] [-d N] [-s sel] [-D] [-a] [-o path] [-C]` | 带 `@e` refs 的 accessibility tree；`-i` 仅 interactive，`-c` compact，`-d N` depth，`-s` scope，`-D` 与上次 diff，`-a` annotated screenshot，`-C` cursor-interactive `@c` refs |

### Server lifecycle（server 生命周期）

| Command | Description |
|---------|-------------|
| `status` | Daemon health + mode（headless / headed / cdp） |
| `stop` | 关闭 daemon |
| `restart` | 重启 daemon |
| `connect` | 启动带 Side Panel extension 的 headed GStack Browser |
| `disconnect` | 关闭 headed Chrome，回到 headless |
| `focus [@ref]` | 将 headed Chrome 带到前台（macOS）；`@ref` 同时 scroll into view |
| `state save\|load <name>` | 保存或加载 browser state（cookies + URLs） |
| `memory [--json]` | Snapshot Bun heap + per-tab JS heap + Chromium process tree + bounded buffer sizes。`--json` 用于 programmatic consumers；text mode 渲染 sorted top-10 tabs，并显示 “and N more” tail。 |

### Handoff（人工接管）

| Command | Description |
|---------|-------------|
| `handoff [reason]` | 在当前 page 打开 visible Chrome 让用户接管（CAPTCHA、MFA、complex auth） |
| `resume` | 用户接管后重新 snapshot，并把控制权交回 AI |

### Meta + chains（元命令与链式执行）

| Command | Description |
|---------|-------------|
| `chain` (JSON via stdin) | 运行 commands sequence。把 `[["cmd","arg1",...],...]` pipe 给 `$B chain`。遇到第一个 error 停止。 |
| `inbox [--clear]` | 列出 sidebar scout inbox 中的 messages |
| `watch [stop]` | Passive observation：用户浏览时 periodic snapshots；`stop` 返回 summary |

### Browser-skills runtime（browser-skills 运行时）

| Command | Description |
|---------|-------------|
| `skill list` | 列出所有 browser-skills，带 resolved tier（project > global > bundled） |
| `skill show <name>` | 打印 SKILL.md |
| `skill run <name> [--arg k=v...] [--timeout=Ns]` | 用 per-spawn scoped token spawn skill script |
| `skill test <name>` | 针对 bundled fixtures 运行 skill 的 `script.test.ts` |
| `skill rm <name> [--global]` | Tombstone user-tier skill |

### Domain-skills（domain notes）

| Command | Description |
|---------|-------------|
| `domain-skill save\|list\|show\|edit\|promote-to-global\|rollback\|rm <host?>` | Per-site agent notes（host derived from active tab）。Lifecycle: quarantined → active（N=3 successful uses without classifier flag 后）→ global（explicit promote） |

Aliases: `setcontent`, `set-content`, `setContent` → `load-html`（scope checks 前 canonicalized，所以 read-scoped token 不能用 alias 运行 write command）。

---

## Snapshot system（快照系统）

Browser 的关键创新是基于 Playwright accessibility tree API 的 **ref-based element selection**。不修改 DOM。不注入 scripts。只用 Playwright 原生 AX API。

### `@ref` 如何工作

1. `page.locator(scope).ariaSnapshot()` 返回 YAML-like accessibility tree。
2. Snapshot parser 为每个 element 分配 refs（`@e1`、`@e2` ...）。
3. 对每个 ref，构建 Playwright `Locator`（使用 `getByRole` + nth-child）。
4. ref→Locator map 存在 `BrowserManager` 上。
5. 之后 `click @e3` 这样的 commands 会查 Locator 并调用 `locator.click()`。

### Ref staleness detection（ref 过期检测）

SPAs 可以在不 navigation 的情况下 mutate DOM（React router、tab switches、modals）。发生这种情况时，之前 `snapshot` 收集的 refs 可能指向已不存在的 elements。`resolveRef()` 在使用任何 ref 前运行 async `count()` check；如果 element count 为 0，立刻抛出错误并提示 agent 重新运行 `snapshot`。这样快速失败（约 5ms），而不是等待 Playwright 30 秒 action timeout。

### Extended snapshot features（扩展快照能力）

- **`--diff` (`-D`).** 每次 snapshot 存为 baseline。下一次 `-D` call 返回 unified diff，显示变化。用它验证 action（click、fill 等）是否真的生效。
- **`--annotate` (`-a`).** 在每个 ref bounding box 注入临时 overlay div，拍一张带 ref labels 的 screenshot，然后移除 overlays。用 `-o <path>` 控制 output。
- **`--cursor-interactive` (`-C`).** 用 `page.evaluate` 扫描 non-ARIA interactive elements（`cursor:pointer`、`onclick`、`tabindex>=0` 的 divs）。分配 `@c1`、`@c2`... refs，使用 deterministic `nth-child` CSS selectors。这些是 ARIA tree 漏掉但用户仍可 click 的 elements。

---

## Browser-skills runtime（browser-skills 运行时）

把重复 browser flow 固化成 deterministic Playwright script 的 per-task directories。这是 compounding layer。

### Browser-skill anatomy（browser-skill 结构）

```
browser-skills/<name>/
├── SKILL.md                        # frontmatter + prose contract
├── script.ts                       # deterministic Playwright-via-browse-client logic
├── _lib/browse-client.ts           # vendored copy of the SDK (~3KB, byte-identical to canonical)
├── fixtures/<host>-<date>.html     # captured page for fixture-replay tests
└── script.test.ts                  # parser tests against the fixture (no daemon required)
```

Bundled reference 是 `browser-skills/hackernews-frontpage/`：scrape HN front page，并以 JSON 返回 30 条 stories。试试：

```bash
$B skill list                            # 显示 hackernews-frontpage (bundled)
$B skill show hackernews-frontpage
$B skill run hackernews-frontpage        # JSON of 30 stories in ~200ms
$B skill test hackernews-frontpage       # 针对 fixture 运行 script.test.ts
```

### Three-tier storage（三层存储）

`$B skill list` 按 priority 遍历三层；first hit wins。Resolved tier 会 inline 打印在每个 skill name 旁边：

| Tier | Path | When |
|------|------|------|
| **Project** | `<project>/.gstack/browser-skills/<name>/` | Project-specific skills（committed or gitignored） |
| **Global** | `~/.gstack/browser-skills/<name>/` | Per-user skills，适用于所有 projects |
| **Bundled** | `<gstack-install>/browser-skills/<name>/` | 随 gstack ship，read-only |

### Trust model（信任模型）

两个正交轴：daemon-side capability 和 process-side env，彼此独立配置。

| Axis | Mechanism | Default |
|------|-----------|---------|
| **Daemon-side capability** | Per-spawn scoped token，绑定 read+write scope（browser-driving commands minus admin: `eval`, `js`, `cookies`, `storage`）。Single-use clientId 编码 skill name + spawn id。Spawn 退出时 revoked。 | 始终 scoped，绝不使用 daemon root token |
| **Process-side env** | `trusted: true` frontmatter 传递 `process.env` minus `GSTACK_TOKEN`。`trusted: false`（默认）丢弃除 minimal allowlist（LANG、LC_ALL、TERM、TZ）外所有 env，并按 pattern stripping secrets（TOKEN/KEY/SECRET/PASSWORD、AWS_*、ANTHROPIC_*、OPENAI_*、GITHUB_* 等）。 | Untrusted（必须 opt in） |

`GSTACK_PORT` 和 `GSTACK_SKILL_TOKEN` 最后注入，所以 parent process 不能 override 它们。

### Output protocol（输出协议）

stdout = JSON。stderr = streaming logs。Exit 0 / non-zero。默认 60s timeout，可用 `--timeout=Ns` override。Max stdout 1MB（超出则 truncate + non-zero exit）。匹配 `gh` / `kubectl` / `docker` conventions。

### SDK distribution 工作方式

每个 skill 都自带一份 `_lib/browse-client.ts`，与 canonical `browse/src/browse-client.ts` byte-identical。`/skillify` 会把 canonical SDK 与每个 generated script 一起复制。每个 skill 完全 self-contained：目录复制到哪里都能运行。Version drift 不可能，因为 SDK frozen 在 skill authoring 时的版本。

### Atomic write discipline（`/skillify` D3）

`browse/src/browser-skill-write.ts` 提供三个 primitives：

- `stageSkill(opts)` — 把 files 写到 `~/.gstack/.tmp/skillify-<spawnId>/<name>/`，使用 restrictive perms。
- `commitSkill(opts)` — atomic `fs.renameSync` 到 final tier path。拒绝 follow symlinked staging dirs（`lstat` check），拒绝 clobber existing skills，对 tier root 使用 `realpath` discipline。
- `discardStaged(stagedDir)` — `rm -rf` staged dir + per-spawn wrapper。Idempotent。Test failure 或 approval rejection 时调用。

没有 “almost shipped” 状态。Tests pass + user approves = atomic rename。Tests fail 或 user rejects = staging 消失。

完整设计 rationale 见 [`docs/designs/BROWSER_SKILLS_V1.md`](docs/designs/BROWSER_SKILLS_V1.md)。

---

## Domain-skills（domain notes）

与 browser-skills 不同的 mental model：agent-authored 的 site *notes*（不是 deterministic scripts）。每个 hostname 一个。Lifecycle：

1. `domain-skill save <host>` — agent 写一条关于 site 的 note（例如 “GitHub: PR creation needs `--draft` flag for non-staff”，“X.com: timeline uses cursor pagination, not page numbers”）。默认状态：**quarantined**。
2. 连续 **N=3** 次 successful uses 且 L4 prompt-injection classifier 没有 flag 这条 note 后，auto-promotes to **active**。
3. `domain-skill promote-to-global <host>` 把它提升到 global tier（machine-wide，all projects）。
4. `domain-skill rollback <host>` demotes；`domain-skill rm <host>` tombstones。

Classifier flag 由 L4 prompt-injection scan 自动设置；agents 不手动设置。

Storage（存储位置）:

- Per-project: `<project>/.gstack/domain-skills/<host>.md`
- Global: `~/.gstack/domain-skills/<host>.md`

Source（源码）: `browse/src/domain-skills.ts`, `domain-skill-commands.ts`。

---

## Real-browser mode（真实浏览器模式）

`$B connect` 启动 **GStack Browser**：一个由 Playwright 控制、auto-load Side Panel extension、应用 anti-bot stealth patches 的 rebranded Chromium。你可以在 visible window 中实时观看每个 command。

```bash
$B connect              # 启动 headed GStack Browser
$B goto https://app.com # 在 visible window 中导航
$B snapshot -i          # 来自 real page 的 refs
$B click @e3            # 在 real window 中点击
$B focus                # 将 window 带到前台（macOS）
$B status               # 显示 Mode: cdp
$B disconnect           # 回到 headless mode
```

Window 顶部有一条 subtle golden shimmer line，右下角有 floating “gstack” pill，让你总能知道哪个 Chrome window 正被控制。

### "GStack Browser" 是什么意思

它不是你的日常 Chrome，而是 Playwright-managed Chromium，带 Dock 和 menu bar custom branding、anti-bot stealth（Google 和 NYTimes 等 sites 无 captchas）、custom user agent，并通过 `launchPersistentContext` preload gstack extension。你的常规 Chrome、tabs 和 bookmarks 不受影响。

### 何时使用 headed mode

- **QA testing**：你想观看 Claude click through your app
- **Design review**：你需要看到 Claude 看到的 exact 内容
- **Debugging**：headless behavior 与 real Chrome 不同时
- **Demos**：你正在 share screen
- **Pair-agent** sessions（remote agent drives your local browser）

### CDP-aware skills（CDP 感知 skills）

在 real-browser mode 中，`/qa` 和 `/design-review` 会自动跳过 cookie import prompts 和 headless workarounds，因为 headed browser 已经带有你登录的 session。

### Headed mode + proxy + browser-native downloads（v1.28.0.0）

三个协调 flags，面向 block headless browsers、fingerprint Playwright defaults，或位于 authenticated upstream proxies 后的网站：

```bash
# 可见 Chromium。在没有 DISPLAY 的 Linux containers 中自动 spawn Xvfb。
$B --headed goto https://example.com

# 带 auth 的 SOCKS5。Chromium 无法提示输入 SOCKS5 creds，因此 $B 会运行一个
# local 127.0.0.1 bridge 来处理 auth handshake。
$B --proxy socks5://user:pass@residential.proxy.host:1080 goto https://example.com

# HTTP/HTTPS proxy 会直接透传给 Chromium。
$B --proxy http://corp-proxy:3128 goto https://example.com

# Browser-native download，用于 Content-Disposition、redirect chains，以及
# page.request.fetch() 失效的 anti-bot CDNs。
$B download "https://protected.example.com/file" /tmp/file.bin --navigate

# 组合使用。
$B --headed --proxy socks5://user:pass@host:1080 \
   download "https://protected.example.com/file" /tmp/file.bin --navigate
```

**Credential policy（凭据策略）。** Creds 通过 URL（`socks5://user:pass@host`）或 env vars `BROWSE_PROXY_USER` / `BROWSE_PROXY_PASS` 传入，二选一，不能同时设置。两者都存在时，`$B` 会拒绝并给出明确 hint；silent override 会制造 “works on my machine” debugging traps。

**Daemon discipline（daemon 纪律）。** `--proxy` 和 `--headed` 是 daemon-startup config。运行中的 daemon 若以 config A 启动，而新 invocation 带 config B，会 exit 1 并提示 `browse disconnect`，而不是 silent restart 导致 tab state、cookies 或 sessions 丢失。

**Stealth scope（隐身范围）。** 设置 `--headed` 或 `--proxy` 时，`$B` 只 mask `navigator.webdriver`：通过 Chromium 的 `--disable-blink-features=AutomationControlled` 加一个小 init script。我们**不**伪造 `navigator.plugins`、`navigator.languages` 或 `window.chrome`。Modern fingerprinters 会检查一致性，合成 fixed values 反而可能更像 bot。ChromeDriver 的 `cdc_` runtime artifacts 和 Permissions API patch 仍会清理。

**Container support（容器支持）。** Linux 上 `--headed` 且没有 `DISPLAY` 时，会遍历 display range（`:99`、`:100` 等），直到 `xdpyinfo` 报告空闲 slot，然后 spawn Xvfb。Cleanup-on-disconnect 在发送任何 signal 前，会验证 recorded PID 的 `/proc/<pid>/cmdline` 匹配 `Xvfb` 且 start-time 匹配，避免 PID-reuse footguns。如果设置了 `WAYLAND_DISPLAY`，跳过 spawn（Chromium 原生使用 Wayland）。标准 Debian/Ubuntu containers 开箱即用；minimal images（alpine、distroless）可能需要 fonts/dbus/gtk libs 才能 render headed Chromium。

**Failure modes（失败模式）。** SOCKS5 upstream rejected 或 unreachable：startup 阶段在 3 retries（5s budget）后 fail-fast，并 redacted error。Mid-stream upstream drop：bridge 只 kill affected client connection；不做可能 corrupt browser traffic 的 transport retries。

---

## Side Panel + sidebar agent（侧边栏 agent）

内置于 GStack Browser 的 Chrome extension 会在 Side Panel 中展示 browse command 的 live activity feed、页面上的 `@ref` overlays，以及 sidebar 内的 interactive Claude PTY。

### Terminal pane（核心入口）

Side Panel 的 primary surface 是 **Terminal pane**：一个 live `claude -p` PTY，你可以直接从 sidebar 输入。Activity / Refs / Inspector 是 footer `debug` toggle 后的 debug overlays。WebSocket auth 使用 `Sec-WebSocket-Protocol`（browsers 不能在 WebSocket upgrade 上设置 `Authorization`），PTY session token 是通过 `POST /pty-session` minted 的 30-minute HttpOnly cookie。

Toolbar 的 Cleanup button 和 Inspector 的 “Send to Code” action 都会通过 `window.gstackInjectToTerminal(text)` 把 text pipe 进 live Claude PTY；该函数由 `sidepanel-terminal.js` 暴露。没有单独的 `/sidebar-command` POST，live REPL 是唯一 execution surface。

### Activity feed（活动流）

滚动 feed，显示每个 browse command 的 name、args、duration、status、errors。Claude 工作时实时出现。底层是 SSE（`/activity/stream`），接受 Bearer token 或 HttpOnly `gstack_sse` session cookie（通过 `POST /sse-session` minted 的 30-minute stream-scope cookie）。

### Refs tab（Refs 标签页）

`$B snapshot` 后显示当前 `@ref` list（role + name），让你看到 Claude 正在 target 什么。

### CSS Inspector（CSS 检查器）

由 `$B inspect` 驱动（CDP-based）。点击 page 上任意 element，可看到 full CSS rule cascade、computed styles、box model 和 modification history。“Send to Code” button 会把 description 注入 Claude PTY。

### Sidebar architecture（sidebar 架构）

| Component | Where it lives | Notes |
|-----------|----------------|-------|
| Side Panel UI | `extension/sidepanel.js`, `sidepanel-terminal.js` | Chrome extension surface |
| Background SW | `extension/background.js` | Manages tab events, port management |
| Content script | `extension/content.js` | Page overlays, `gstack` pill |
| Terminal agent | `browse/src/terminal-agent.ts` | PTY spawn, lifecycle, auth |
| Sidebar utilities | `browse/src/sidebar-utils.ts` | URL sanitization, helpers |

修改这些文件前，先读 `CLAUDE.md` 中 “Sidebar architecture” 下的 comment block。这里的 silent failures 通常来自不理解 cross-component flow。

### Manual install（用于你的日常 Chrome）

如果你想在日常 Chrome（不是 Playwright-controlled one）中使用 extension：

```bash
bin/gstack-extension    # opens chrome://extensions, copies path to clipboard
```

也可以手动：`chrome://extensions` → toggle Developer mode → Load unpacked → navigate to `~/.claude/skills/gstack/extension` → pin extension → 输入 `$B status` 中的 port。

---

## Pair-agent（远程 agent 配对）

Remote AI agents（Codex、OpenClaw、Hermes，任何 speak HTTP 的 agent）可以通过 ngrok tunnel 驱动你的 local browser。整个 flow 由 26-command allowlist、scoped tokens 和 denial log 保护。

### 工作方式

```bash
/pair-agent                     # generates a setup key, prints connection instructions
# 将 instructions 复制给 remote agent
# Remote agent 运行：
#   POST <tunnel-url>/connect with setup key → gets a scoped token (24h, single client)
#   POST <tunnel-url>/command with token → runs allowed commands
```

### Dual-listener architecture（v1.6.0.0+）

当 `pair-agent` 激活时，daemon 绑定**两个 HTTP listeners**：

- **Local listener**（`127.0.0.1:LOCAL_PORT`）。Full command surface。绝不由 ngrok 转发。供你的 Claude Code、Side Panel 和本机任何工具使用。
- **Tunnel listener**（`127.0.0.1:TUNNEL_PORT`）。Locked allowlist：`/connect`、`/command`（scoped tokens + 26-command browser-driving allowlist）、`/sidebar-chat`。ngrok 只转发这个 port。

通过 tunnel 发送 root tokens 会返回 403。SSE endpoints 使用 30-minute HttpOnly `gstack_sse` cookie（对 `/command` 永远无效）。

### 26-command tunnel allowlist

在 `browse/src/server.ts` 中定义为 `TUNNEL_COMMANDS`。Pure gate function `canDispatchOverTunnel(command)` 已导出用于 unit testing。集合：

```
goto, click, text, screenshot, html, links, forms, accessibility,
attrs, media, data, scroll, press, type, select, wait, eval,
newtab, tabs, back, forward, reload, snapshot, fill, url, closetab
```

刻意缺席：`pair`、`unpair`、`cookies`、`setup`、`launch`、`restart`、`stop`、`tunnel-start`、`token-mint`、`state`、`connect`、`disconnect`。Remote agent 尝试它们时会得到 403，并在 denial log 中写入新 entry。

### Tunnel denial log（tunnel 拒绝日志）

`~/.gstack/security/attempts.jsonl`：append-only，只记录 source + domain 的 salted SHA-256（无 raw IP、无 full request body），10MB 轮转，保留 5 generations。Per-device salt 位于 `~/.gstack/security/device-salt`（mode 0600）。

完整 operator guide 见 [`docs/REMOTE_BROWSER_ACCESS.md`](docs/REMOTE_BROWSER_ACCESS.md)。

### Tab ownership（tab 所有权）

Scoped tokens 默认 `tabPolicy: 'own-only'`。Paired agent 可以 `newtab` 创建自己的 tab 并自由驱动该 tab，但不能在其他 caller 拥有的 tabs 上 `goto`、`fill` 或 `click`。`tabs` 会列出所有 tab metadata（这是 accepted tradeoff，见 ARCHITECTURE.md），但 unowned tabs 的 `text`/`html`/`snapshot` content 会被 ownership checks 阻止。

---

## Authentication（认证）

三种 token types，三种 lifetimes，三种 scopes。

| Token | Generated by | Lifetime | Scope |
|-------|--------------|----------|-------|
| **Root token** | Daemon startup（random UUID） | Daemon process lifetime | Full command surface，仅 local listener；tunnel 上 403 |
| **Setup key** | `POST /pair` | 5 minutes, one-time use | Single redemption：在 `/connect` present，换取 scoped token |
| **Scoped token** | `POST /connect`（with setup key） | 24 hours | Per-client、allowlist-bound、可选 tab-scoped |

Root token 以 chmod 600 写到 `<project>/.gstack/browse.json`。每个 mutates browser state 的 command 都必须带 `Authorization: Bearer <token>`。

### SSE session cookie（v1.6.0.0+）

SSE endpoints（`/activity/stream`、`/inspector/events`）接受 Bearer token 或通过 `POST /sse-session` minted 的 30-minute HttpOnly `gstack_sse` cookie。不再支持 `?token=<ROOT>` query-param auth。这让 Chrome extension 可以 subscribe activity feed，而不把 root token 放进 extension storage。

### PTY session cookie（PTY session cookie）

Terminal pane 使用单独 session cookie：`gstack_pty`，由 `POST /pty-session` minted。Scope 不同：可以 spawn / drive live `claude` PTY，不能 dispatch arbitrary `/command` calls。`/health` endpoint 绝不能暴露此 token。

### Token registry（token 注册表）

`browse/src/token-registry.ts` 负责 mint/validate/revoke 三种 token，并做 per-token rate limiting。Setup keys 是 single-use；scoped tokens 有 sliding 24h window；root token 在每次 daemon startup 轮换。

---

## Security stack（安全栈）

针对 prompt injection 的 layered defense。每一层都同步运行在每条 user message 以及每个可能携带 untrusted content 的 tool output 上（Read、Glob、Grep、WebFetch、来自 `$B` 的 page text）。

| Layer | Module | Lives in |
|-------|--------|----------|
| **L1** Datamarking | `content-security.ts` | both server + sidebar agent |
| **L2** Hidden-element strip | `content-security.ts` | both |
| **L3** ARIA + URL blocklist + envelope wrapping | `content-security.ts` | both |
| **L4** TestSavantAI ML classifier (22MB ONNX) | `security-classifier.ts` | sidebar-agent only* |
| **L4b** Claude Haiku transcript check | `security-classifier.ts` | sidebar-agent only |
| **L5** Canary token (session-exfil detection) | `security.ts` | both — inject in compiled, check in agent |
| **L6** `combineVerdict` ensemble | `security.ts` | both |

\* `security-classifier.ts` 不能从 compiled browse binary import：`@huggingface/transformers` v4 需要 `onnxruntime-node`，而它在 Bun compile temp extract dir 中 `dlopen` 失败。Compiled binary 只运行 L1-L3、L5、L6。

### Thresholds（阈值）

- `BLOCK: 0.85` — 如果 cross-confirmed，会导致 BLOCK 的 single-layer score
- `WARN: 0.75` — cross-confirm threshold。当 L4 和 L4b 都 >= 0.75 → BLOCK
- `LOG_ONLY: 0.40` — gates transcript classifier（所有 layers < 0.40 时跳过 Haiku）
- `SOLO_CONTENT_BLOCK: 0.92` — label-less content classifiers 的 single-layer threshold

### Ensemble rule（ensemble 规则）

只有当 ML content classifier 和 transcript classifier 都 report >= WARN 时才 BLOCK。Single-layer high confidence 降级为 WARN，这是 Stack Overflow instruction-writing FP mitigation。**Canary leak 永远 BLOCK（deterministic）。**

### Env knobs（环境变量开关）

- `GSTACK_SECURITY_OFF=1` — emergency kill switch。Classifier 即使 warmed 也保持 off。Canary 仍然注入；只是跳过 ML scan。
- `GSTACK_SECURITY_ENSEMBLE=deberta` — opt-in DeBERTa-v3 ensemble。把 ProtectAI DeBERTa-v3-base-injection-onnx 加为 L4c classifier。首次运行下载 721MB。开启 ensemble 后，BLOCK 需要 3 个 ML classifiers 中 2 个同意且 >= WARN。
- Classifier model cache: `~/.gstack/models/testsavant-small/`（112MB，仅首次运行）加 `~/.gstack/models/deberta-v3-injection/`（721MB，仅 ensemble enabled 时）。
- Attack log: `~/.gstack/security/attempts.jsonl`（salted SHA-256 + domain only，10MB 轮转，5 generations）。
- Per-device salt: `~/.gstack/security/device-salt`（0600）。
- Session state: `~/.gstack/security/session-state.json`（cross-process，atomic）。

Sidebar header 中的 shield icon 显示 live status。完整 threat model 见 ARCHITECTURE.md § “Prompt injection defense”。

---

## Screenshots、PDFs 与视觉检查

### Screenshot modes（截图模式）

| Mode | Syntax | Playwright API |
|------|--------|----------------|
| Full page (default) | `screenshot [path]` | `page.screenshot({ fullPage: true })` |
| Viewport only | `screenshot --viewport [path]` | `page.screenshot({ fullPage: false })` |
| Element crop (flag) | `screenshot --selector <css> [path]` | `locator.screenshot()` |
| Element crop (positional) | `screenshot "#sel" [path]` or `screenshot @e3 [path]` | `locator.screenshot()` |
| Region clip | `screenshot --clip x,y,w,h [path]` | `page.screenshot({ clip })` |

Element crop 接受 CSS selectors（`.class`、`#id`、`[attr]`）或 `@e`/`@c` refs。**像 `button` 这样的 tag selectors 不会被 positional heuristic 捕获**，请使用 `--selector` flag form。

`--base64` 返回 `data:image/png;base64,...`，而不是写到磁盘；可与 `--selector`、`--clip`、`--viewport` 组合。

Mutual exclusion：`--clip` + selector、`--viewport` + `--clip`、`--selector` + positional selector 都会 throw。

### Retina screenshots（Retina 截图）— `viewport --scale`

`viewport --scale <n>` 设置 Playwright 的 `deviceScaleFactor`（context-level，cap 1-3）：

```bash
$B viewport 480x600 --scale 2
$B load-html /tmp/card.html
$B screenshot /tmp/card.png --selector .card
# .card at 400x200 CSS pixels → card.png is 800x400 pixels
```

单独 `--scale N`（无 `WxH`）会保留当前 viewport size。Scale changes 会触发 context recreation，从而 invalidates `@e`/`@c` refs；之后需要重跑 `snapshot`。通过 `load-html` 加载的 HTML 会通过 in-memory replay 保留。Headed mode 中拒绝（real browser controls scale）。

### PDF generation（PDF 生成）

`pdf` 接受完整 Playwright surface，并增加少量能力：

- **Layout:** `--format letter|a4|legal`、`--width <dim>`、`--height <dim>`、`--margins <dim>`、`--margin-top/right/bottom/left <dim>`
- **Structure:** `--toc`（如果 loaded 则等待 Paged.js）、`--outline`、`--tagged`（PDF/A accessibility）、`--print-background`、`--prefer-css-page-size`
- **Branding:** `--header-template <html>`、`--footer-template <html>`、`--page-numbers`
- **Tabs:** `--tab-id <N>` 渲染指定 tab
- **Large payloads:** `--from-file <payload.json>`（避免 shell argv limits）

### Responsive screenshots（响应式截图）

`responsive [prefix]`：一次调用三张 screenshots，mobile（375x812）、tablet（768x1024）、desktop（1280x720）。保存为 `{prefix}-mobile.png` 等。

### `prettyscreenshot`

把 cleanup + scroll + element hide 组合成一次调用：

```bash
$B prettyscreenshot --cleanup --scroll-to "hero section" --hide ".cookie-banner" /tmp/clean.png
```

---

## Local HTML（本地 HTML）

两种渲染非 web server HTML 的方式：

| Approach | When | URL after | Relative assets |
|----------|------|-----------|-----------------|
| `goto file://<abs-path>` | File already on disk | `file:///...` | Resolve against file's directory |
| `goto file://./<rel>`, `goto file://~/<rel>` | Smart-parsed to absolute | `file:///...` | Same |
| `load-html <file>` | 在 memory 中生成 HTML，不需要 parent-dir context | `about:blank` | Broken（仅 self-contained HTML） |

两者都通过与 `eval` 相同的 safe-dirs policy 限制在 cwd 或 `$TMPDIR` 下。`file://` URLs 保留 query strings 和 fragments（SPA routes 可用）。

`load-html` 有 extension allowlist（`.html`、`.htm`、`.xhtml`、`.svg`）和 magic-byte sniff，用于拒绝被误改名为 HTML 的 binary files。50MB size cap（可通过 `GSTACK_BROWSE_MAX_HTML_BYTES` override）。

`load-html` content 会通过 in-memory replay 保留在之后的 `viewport --scale` calls 中（TabSession 追踪 loaded HTML + waitUntil）。Replay 纯 in-memory；HTML 永远不会通过 `state save` 持久化到磁盘，以避免泄露 secrets 或 customer data。

---

## Batch endpoint（批处理 endpoint）

`POST /batch` 在单个 HTTP request 中发送多个 commands。它消除 per-command round-trip latency，对 ngrok 上的 remote agents 很关键，因为每个 HTTP call 需要 2-5s。

```json
POST /batch
Authorization: Bearer <token>

{
  "commands": [
    {"command": "text", "tabId": 1},
    {"command": "text", "tabId": 2},
    {"command": "snapshot", "args": ["-i"], "tabId": 3},
    {"command": "click", "args": ["@e5"], "tabId": 4}
  ]
}
```

每个 command 都通过 `handleCommandInternal` 路由，完整 security pipeline（scope checks、domain validation、tab ownership、content wrapping）按 command 强制。Per-command error isolation：一个 failure 不 abort 整个 batch。每个 batch 最多 50 commands。拒绝 nested batches。Rate limiting：1 batch = 1 request，计入 per-agent limit。

Pattern：agent crawl 20 pages，先打开 20 tabs（单独 `newtab` 或 batch），再 `POST /batch` 带 20 个 `text` commands → 约 2-3 秒拿到 20 个 page contents，而不是 serial 的 40-100 秒。

---

## Capture（console/network/dialog 捕获）

Console、network 和 dialog events 流入 O(1) circular buffers（各 50,000 capacity），并通过 `Bun.write()` async flushed to disk：

- Console: `.gstack/browse-console.log`
- Network: `.gstack/browse-network.log`
- Dialog: `.gstack/browse-dialog.log`

`console`、`network`、`dialog` commands 从 in-memory buffers 读取（不是 disk），所以即便 disk 慢，capture 仍是 real-time。

Dialogs（alert、confirm、prompt）默认 auto-accepted，以防 browser lockup。`dialog-accept <text>` 控制 prompt response text。

---

## JS execution（JS 执行）

`js` 运行 inline expression。`eval` 运行 JS file。两者运行在**同一 JS sandbox**，唯一差异是 inline-vs-file。两者都支持 `await`；包含 `await` 的 expressions 会 auto-wrapped 到 async context：

```bash
$B js "await fetch('/api/data').then(r => r.json())"   # auto-wrapped
$B js "document.title"                                  # no wrap needed
$B eval my-script.js                                    # file with await
```

对 `eval` files，single-line files 直接返回 expression value。Multi-line files 使用 `await` 时需要显式 `return`。包含 literal token “await” 的 comments 不触发 wrapping。

Path safety：`eval` 拒绝 cwd 或 `/tmp` 外的 paths。`js` 完全不读 files。

---

## Tabs、frames 与 state

### Tabs（标签页）

```bash
$B tabs                          # list all open tabs
$B tab 3                         # switch to tab 3
$B newtab https://example.com    # open new tab, switch to it
$B newtab --json                 # programmatic: returns {"tabId":N,"url":...}
$B closetab                      # close current
$B closetab 2                    # close tab 2
$B tab-each "text"               # run "text" on every tab, return JSON
```

`tab-each <command>` 在每个 open tab 上 fan out command，并返回 JSON array，适合“给我所有 open tabs 的 text”。

### Frames（frames）

```bash
$B frame "#stripe-iframe"        # switch to iframe by selector
$B frame @e7                     # by ref
$B frame --name "checkout"       # by name attribute
$B frame --url "stripe.com"      # by URL pattern match
$B frame main                    # back to top frame
```

Switch 时 refs 会清空（iframe 有自己的 AX tree）。

### State save/load（状态保存/加载）

```bash
$B state save my-session         # save cookies + URLs to .gstack/browse-state-my-session.json
$B state load my-session         # restore
```

In-memory `load-html` content 故意不持久化（避免 secrets 泄露到 disk）。

### Watch（观察）

```bash
$B watch                         # passive observation: snapshot every 5s while user browses
$B watch stop                    # return summary of what changed
```

当你手动驱动 browser，又想让 Claude 在结束时看到你做了什么，但不想 spam `snapshot` calls 时很有用。

### Inbox（收件箱）

```bash
$B inbox                         # list messages from sidebar scout
$B inbox --clear                 # clear after reading
```

Sidebar scout（Chrome extension 可 spawn 的 background process）会在用户 surfaced 想让 Claude 注意的东西时留下 notes。存储在 `.gstack/browser-scout.jsonl`。

---

## CDP（Chrome DevTools Protocol）

### `$B cdp` — raw Chrome DevTools Protocol dispatch

Deny-default。只有 `browse/src/cdp-allowlist.ts`（`CDP_ALLOWLIST` const）枚举的方法可访问；其他方法返回 403。每个 allowlist entry 声明 scope（tab vs browser）和 output（trusted vs untrusted）。Untrusted methods（data-exfil-shaped，例如 `Network.getResponseBody`）会得到 UNTRUSTED-envelope wrapped output。

```bash
$B cdp Page.getLayoutMetrics
$B cdp Network.enable
$B cdp Accessibility.getFullAXTree --json '{"max_depth":5}'
```

要发现 allowed methods，请读 `browse/src/cdp-allowlist.ts`。

### `$B inspect` — CDP-based CSS inspector

```bash
$B inspect ".header"                # full rule cascade for the header
$B inspect ".header" --all          # include user-agent rules
$B inspect ".header" --history      # show modification history
```

返回 matched rule cascade（带 specificity）、computed styles、box model，以及（使用 `--history` 时）page loaded 后通过 `$B style` 做过的每个 CSS modification。由 `browse/src/cdp-inspector.ts` 中每个 page 的 persistent CDP session 驱动。

### `$B ux-audit`

```bash
$B ux-audit
```

返回 JSON，包含 site identity、navigation、headings（cap 50）、text blocks、interactive elements（cap 200）。用于 behavioral analysis 的 page structure，不 dump full HTML。`/qa` 和 `/design-review` 用它做 cheap coverage maps。

---

## Performance（性能）

| Tool | First call | Subsequent calls | Context overhead per call |
|------|-----------|------------------|---------------------------|
| Chrome MCP | ~5s | ~2-5s | ~2000 tokens (schema + protocol) |
| Playwright MCP | ~3s | ~1-3s | ~1500 tokens (schema + protocol) |
| **gstack browse** | **~3s** | **~100-200ms** | **0 tokens** (plain text stdout) |
| **gstack browse + codified skill** | **~3s** | **~200ms** | **0 tokens** (single skill invocation) |

一个 20-command browser session 中，MCP tools 光 protocol framing 就烧 30,000-40,000 tokens。gstack 为零。Codified-skill path 把 20-command session 降到单个 `$B skill run` call。

### 为什么选择 CLI 而不是 MCP

MCP 很适合 remote services。对 local browser automation，它增加的是纯 overhead：

- **Context bloat** — 每个 MCP call 都包含完整 JSON schemas。一个简单的 “get the page text” 消耗的 context tokens 是应有水平的 10 倍。
- **Connection fragility** — persistent WebSocket/stdio connections 会 drop，且重连失败。
- **Unnecessary abstraction** — Claude 已经有 Bash tool。打印 stdout 的 CLI 是最简单的 interface。

gstack 跳过这一切。Compiled binary。Plain text in，plain text out。无 protocol。无 schema。无 connection management。

---

## Multi-workspace（多 workspace）

每个 project root（通过 `git rev-parse --show-toplevel` 检测）获得自己的 daemon、port、state file、cookies 和 logs。没有 cross-workspace collisions。

| Workspace | State file | Port |
|-----------|-----------|------|
| `/code/project-a` | `/code/project-a/.gstack/browse.json` | random (10000-60000) |
| `/code/project-b` | `/code/project-b/.gstack/browse.json` | random (10000-60000) |

Browser-skills three-tier lookup 按 project → global → bundled 遍历，所以 `/code/project-a/.gstack/browser-skills/foo/` 中的 project-tier skill 只在 project-a 内 shadow global `~/.gstack/browser-skills/foo/`。

---

## Environment variables（环境变量）

| Variable | Default | Description |
|----------|---------|-------------|
| `BROWSE_PORT` | 0 (random 10000-60000) | HTTP server 固定 port（debug override） |
| `BROWSE_IDLE_TIMEOUT` | 1800000 (30 min) | Idle shutdown timeout in ms |
| `BROWSE_STATE_FILE` | `.gstack/browse.json` | Path to state file |
| `BROWSE_SERVER_SCRIPT` | auto-detected | Path to `server.ts` |
| `BROWSE_CDP_URL` | (none) | Set to `channel:chrome` for real-browser mode |
| `BROWSE_CDP_PORT` | 0 | CDP port（used internally） |
| `BROWSE_HEADLESS_SKIP` | 0 | 完全跳过 Chromium launch（test harness only） |
| `BROWSE_TUNNEL` | 0 | 激活 dual-listener tunnel architecture（requires `NGROK_AUTHTOKEN`） |
| `BROWSE_TUNNEL_LOCAL_ONLY` | 0 | Test-only：本地 bind both listeners without ngrok |
| `GSTACK_BROWSE_MAX_HTML_BYTES` | 52428800 (50MB) | `load-html` size cap |
| `GSTACK_SECURITY_OFF` | unset | Emergency kill switch：disable ML classifier |
| `GSTACK_SECURITY_ENSEMBLE` | unset | Set to `deberta` for 3-classifier ensemble（721MB download） |

---

## Source map（源码地图）

```
browse/
├── src/
│   ├── cli.ts                   # Thin client — reads state, sends HTTP, prints
│   ├── server.ts                # Bun HTTP daemon — routes commands, dual-listener
│   ├── browser-manager.ts       # Chromium lifecycle, tabs, ref map, crash detection
│   ├── socks-bridge.ts          # Local 127.0.0.1 SOCKS5 bridge that handles auth handshakes Chromium can't speak
│   ├── proxy-config.ts          # --proxy URL parsing + cred resolution (URL vs env, fail-fast on both)
│   ├── proxy-redact.ts          # Cred-redaction helper for any proxy URL surfaced to logs/errors
│   ├── xvfb.ts                  # Xvfb auto-spawn + orphan cleanup with PID + start-time validation
│   ├── stealth.ts               # navigator.webdriver mask + cdc_ cleanup + Permissions API patch
│   ├── browse-client.ts         # Canonical SDK — what skills import as _lib/browse-client.ts
│   ├── snapshot.ts              # AX tree → @e/@c refs → Locator map; -D/-a/-C handling
│   ├── read-commands.ts         # Non-mutating: text, html, links, js, css, is, dialog, ...
│   ├── write-commands.ts        # Mutating: goto, click, fill, upload, dialog-accept, ...
│   ├── meta-commands.ts         # state, watch, inbox, frame, ux-audit, chain, diff, ...
│   ├── browser-skills.ts        # 3-tier walk + frontmatter parser + tombstones
│   ├── browser-skill-commands.ts # $B skill list/show/run/test/rm + spawnSkill
│   ├── browser-skill-write.ts   # D3 atomic stage/commit/discard helper for /skillify
│   ├── skill-token.ts           # mintSkillToken / revokeSkillToken (per-spawn, scoped)
│   ├── domain-skills.ts         # Per-site agent notes (state machine: quarantined→active→global)
│   ├── domain-skill-commands.ts # $B domain-skill save/list/show/edit/promote/rollback/rm
│   ├── cdp-allowlist.ts         # Deny-default CDP method allowlist
│   ├── cdp-bridge.ts            # CDP session lifecycle bridge
│   ├── cdp-commands.ts          # $B cdp dispatcher
│   ├── cdp-inspector.ts         # $B inspect — persistent CDP session per page
│   ├── activity.ts              # ActivityEntry, CircularBuffer, SSE subscribers, privacy filtering
│   ├── buffers.ts               # Console/network/dialog circular buffers (O(1) ring)
│   ├── tab-session.ts           # Per-tab session state (load-html replay, ref map scope)
│   ├── token-registry.ts        # Mint/validate/revoke for root + setup keys + scoped tokens
│   ├── sse-session-cookie.ts    # 30-min HttpOnly cookie for /activity/stream + /inspector/events
│   ├── pty-session-cookie.ts    # Separate scope: live Claude PTY auth
│   ├── tunnel-denial-log.ts     # ~/.gstack/security/attempts.jsonl writer (salted)
│   ├── path-security.ts         # validateOutputPath / validateReadPath / validateTempPath
│   ├── url-validation.ts        # URL safety checks for goto
│   ├── content-security.ts      # L1-L3: datamarking, hidden strip, ARIA, URL blocklist, envelopes
│   ├── security.ts              # L5 canary + L6 verdict combiner + thresholds
│   ├── security-classifier.ts   # L4 ML classifier (TestSavant + optional DeBERTa ensemble)
│   ├── terminal-agent.ts        # Side Panel Claude PTY manager (auth + lifecycle)
│   ├── sidebar-utils.ts         # Sidebar URL sanitization + helpers
│   ├── cookie-import-browser.ts # Decrypt + import cookies from real Chromium browsers
│   ├── cookie-picker-routes.ts  # HTTP routes for /cookie-picker/*
│   ├── cookie-picker-ui.ts      # Self-contained HTML/CSS/JS for cookie picker
│   ├── network-capture.ts       # Network request capture for $B network
│   ├── media-extract.ts         # Media element extraction for $B media
│   ├── project-slug.ts          # Project slug derivation for state paths
│   ├── error-handling.ts        # safeUnlink / safeKill / isProcessAlive
│   ├── platform.ts              # OS detection (macOS, Linux, Windows)
│   ├── telemetry.ts             # Anonymous opt-in usage telemetry
│   ├── find-browse.ts           # Locate running daemon or bootstrap
│   └── config.ts                # Config resolution (env / files)
├── test/                        # Integration tests + HTML fixtures
└── dist/
    └── browse                   # Compiled binary (~58MB, Bun --compile)

browser-skills/
└── hackernews-frontpage/        # Bundled reference skill
    ├── SKILL.md
    ├── script.ts
    ├── _lib/browse-client.ts
    ├── fixtures/hn-2026-04-26.html
    └── script.test.ts

scrape/SKILL.md.tmpl             # /scrape gstack skill — match-or-prototype entry point
skillify/SKILL.md.tmpl           # /skillify gstack skill — codify last /scrape into permanent skill
```

---

## Development（开发）

### Prerequisites（前置条件）

- [Bun](https://bun.sh/) v1.0+
- Playwright's Chromium（`bun install` 自动安装）

### 快速开始

```bash
bun install                      # install deps + Playwright Chromium
bun test                         # all integration tests (~3s for browse-only)
bun run dev <cmd>                # run CLI from source (no compile)
bun run build                    # compile to browse/dist/browse
```

### Dev mode vs compiled binary（开发模式与 compiled binary）

开发期间使用 `bun run dev`，而不是 compiled binary。它直接用 Bun 运行 `browse/src/cli.ts`，所以能即时反馈：

```bash
bun run dev goto https://example.com
bun run dev text
bun run dev snapshot -i
bun run dev click @e3
```

Compiled binary（`bun run build`）只在 distribution 时需要。它使用 Bun 的 `--compile` flag 在 `browse/dist/browse` 生成一个约 58MB executable。

### Running tests（运行测试）

```bash
bun test                                    # all tests
bun test browse/test/commands               # command integration tests
bun test browse/test/snapshot               # snapshot tests
bun test browse/test/cookie-import-browser  # cookie import unit tests
bun test browse/test/browser-skill-write    # D3 atomic-write helper tests
bun test browse/test/tunnel-gate-unit       # canDispatchOverTunnel pure tests
```

Tests 会启动 local HTTP server（`browse/test/test-server.ts`），从 `browse/test/fixtures/` serve HTML fixtures，然后针对这些 pages exercise CLI。

### 添加新 command

1. 在 `read-commands.ts`（non-mutating）、`write-commands.ts`（mutating）或 `meta-commands.ts`（server / lifecycle）中添加 handler。
2. 在 `server.ts` 中注册 route。
3. 在 `browse/src/commands.ts` 的 `COMMAND_DESCRIPTIONS` 中添加 entry（带清晰 `description` 和 `usage`；`gen-skill-docs` validation suite 会强制 `description` 中不能有 `|` 字符）。
4. 如有需要，在 `browse/test/commands.test.ts` 中添加 test case 和 HTML fixture。
5. 运行 `bun test` 验证。
6. 运行 `bun run build` 编译。
7. 运行 `bun run gen:skill-docs` regenerate SKILL.md（command 会出现在下游 command-reference table）。

### 添加新 browser-skill

手写 skill：复制 `browser-skills/hackernews-frontpage/`，更新 SKILL.md frontmatter，针对目标 site 重写 `script.ts`，重新 capture fixture，更新 parser test。`bun test` 会验证 SKILL.md contract（sibling SDK byte-identity、frontmatter schema）。

Agent-written skill：先用 `/scrape <intent>` 驱动页面一次，说 `/skillify`，在 approval gate 中接受 proposed name。Test pass 后，skill 会落到 `~/.gstack/browser-skills/<name>/`。

### Deploying to the active skill（部署到 active skill）

Active skill 位于 `~/.claude/skills/gstack/`。修改后：

```bash
cd ~/.claude/skills/gstack
git fetch origin && git reset --hard origin/main
bun run build
```

或直接复制 binary：

```bash
cp browse/dist/browse ~/.claude/skills/gstack/browse/dist/browse
```

---

## Cross-references（交叉引用）

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — system-level architecture、dual-listener tunnel design、prompt-injection defense threat model
- [`CLAUDE.md`](CLAUDE.md) — project-level instructions、sidebar architecture notes、security-stack constraints
- [`docs/REMOTE_BROWSER_ACCESS.md`](docs/REMOTE_BROWSER_ACCESS.md) — `/pair-agent` operator guide（setup keys、scoped tokens、denial log）
- [`docs/designs/BROWSER_SKILLS_V1.md`](docs/designs/BROWSER_SKILLS_V1.md) — browser-skills runtime design doc（Phase 1 + 2a + roadmap）
- [`scrape/SKILL.md`](scrape/SKILL.md) — `/scrape` skill: match-or-prototype data extraction
- [`skillify/SKILL.md`](skillify/SKILL.md) — `/skillify` skill: codify last `/scrape` into permanent skill
- [`TODOS.md`](TODOS.md) — `/automate`（Phase 2b P0）、Phase 3 resolver injection、Phase 4 eval + sandbox

---

## 致谢

Browser automation layer 构建在 Microsoft 的 [Playwright](https://playwright.dev/) 之上。Playwright 的 accessibility tree API、locator system 和 headless Chromium management 让 ref-based interaction 成为可能。Snapshot system：把 `@ref` labels 分配给 AX tree nodes，并把它们映射回 Playwright Locators，完全建立在 Playwright primitives 之上。感谢 Playwright team 构建了如此扎实的 foundation。

Prompt-injection L4 layer 使用 [TestSavantAI/distilbert-v1.1-32](https://huggingface.co/TestSavantAI/distilbert-v1.1-32)（112MB ONNX），optional ensemble layer 使用 [ProtectAI/deberta-v3-base-prompt-injection-v2](https://huggingface.co/protectai/deberta-v3-base-prompt-injection-v2)（721MB ONNX）。两者都通过 `@huggingface/transformers` 在本地运行。

CDP escape hatch 的 allowlist gate 直接受 v1.4 design pass 中 Codex T2 outside-voice review 启发：deny-default with explicit allowlist，而不是 allow-default with denylist。
