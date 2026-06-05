# Sidebar Flow（侧边栏流程）

GStack Browser sidebar 实际如何工作。修改 `sidepanel.js`、`background.js`、`content.js`、`terminal-agent.ts` 或 sidebar-related server endpoints 前，请先阅读本文。

Sidebar 有一个 primary surface：**Terminal** pane，也就是 interactive `claude` PTY。Activity / Refs / Inspector 作为 debug overlays 保留在 footer 的 `debug` toggle 后面。一旦 PTY proved out，chat queue path（one-shot `claude -p`、sidebar-agent.ts）就被移除了，因为 Terminal pane strictly more capable。

## Components（组件）

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────────┐
│  sidepanel.js + │────▶│  server.ts   │────▶│terminal-agent.ts │
│  -terminal.js   │     │  (compiled)  │     │  (non-compiled)  │
│  (xterm.js)     │     │              │     │  PTY listener    │
└─────────────────┘     └──────────────┘     └──────────────────┘
        ▲                       │                      │
        │  ws://127.0.0.1:<termPort>/ws (Sec-WebSocket-Protocol auth)
        └───────────────────────┼──────────────────────▶│ Bun.spawn(claude)
                                │                      │  terminal: {data}
                                │                      ▼
                                │              ┌──────────────────┐
                                │              │  claude PTY      │
                                │              └──────────────────┘
            POST /pty-session   │
            (Bearer AUTH_TOKEN) │
                                ▼
                       ┌──────────────────┐
                       │ pty-session-     │
                       │ cookie.ts        │
                       │ (in-memory token │
                       │  registry)       │
                       └──────────────────┘
                                │
                                │ POST /internal/grant (loopback)
                                ▼
                       ┌──────────────────┐
                       │  validTokens Set │
                       │  in agent memory │
                       └──────────────────┘
```

Compiled browse server 不能 `posix_spawn` external executables，因此 `terminal-agent.ts` 作为 separate non-compiled `bun run` process 运行，并拥有 `claude` subprocess。

## Startup + first-keystroke timeline（启动与首次按键时间线）

```
T+0ms     CLI runs `$B connect`
            ├── Server starts (compiled)
            └── Spawns terminal-agent.ts via `bun run`

T+500ms   terminal-agent.ts boots
            ├── Bun.serve on 127.0.0.1:0 (random port)
            ├── Writes <stateDir>/terminal-port (server reads it for /health)
            ├── Writes <stateDir>/terminal-internal-token (loopback handshake)
            └── Probes claude → writes claude-available.json

T+1-3s    Extension loads, sidebar opens
            ├── sidepanel-terminal.js: setState(IDLE), shows "Starting Claude Code..."
            └── tryAutoConnect() polls until window.gstackServerPort + token are set

T+ready   tryAutoConnect calls connect()
            ├── POST /pty-session (Authorization: Bearer AUTH_TOKEN)
            │   └── server mints session token, posts /internal/grant to agent
            │   └── responds with {terminalPort, ptySessionToken}
            ├── GET /claude-available (preflight)
            ├── new WebSocket(`ws://127.0.0.1:<terminalPort>/ws`,
            │                 [`gstack-pty.<token>`])
            │   └── Browser sends Sec-WebSocket-Protocol + Origin
            │   └── Agent validates Origin AND token BEFORE upgrading
            │   └── Agent echoes the protocol back (REQUIRED — browser
            │       closes the connection without it)
            ├── On open: send {type:"resize"} then a single \n byte
            └── Agent message handler sees the byte → spawnClaude()
```

## Auth：WebSocket 不能发送 Authorization headers

Browser WebSocket clients 不能设置 `Authorization`。但它们可以通过 `new WebSocket(url, protocols)` 的第二个参数设置 `Sec-WebSocket-Protocol`。我们利用这一点：

1. `POST /pty-session`（auth: Bearer AUTH_TOKEN）-> server mint short-lived session token，通过 loopback push 给 agent，并在 JSON body 中返回。
2. Extension 调用 `new WebSocket(url, ['gstack-pty.<token>'])`。
3. Agent 读取 `Sec-WebSocket-Protocol`，strip `gstack-pty.`，对 `validTokens` validate，然后 echo protocol back。Echo 是 mandatory，没有它 Chromium 会在收到 upgrade response 后关闭 connection。

还会返回一个 `Set-Cookie: gstack_pty=...` header，供 non-browser callers（curl、integration tests）使用。Cookie path 是原始 v1 design，但 `SameSite=Strict` cookies 无法从 chrome-extension origin 跨 port jump（server.ts:34567 -> agent:<random>）保留。Protocol-token path 是 browser 实际使用的路径。

### Dual-token model（双 token 模型）

| Token | Lives in（存放位置） | Used for（用途） | Lifetime（生命周期） |
|-------|----------|----------|----------|
| `AUTH_TOKEN` | `<stateDir>/browse.json`; in-memory in server.ts | `/pty-session` POST（mint cookie + token） | server lifetime |
| `gstack-pty.<...>` (Sec-WebSocket-Protocol) | Browser memory only; agent `validTokens` Set | `/ws` upgrade auth | 30 min, auto-revoked on WS close |
| `INTERNAL_TOKEN` | `<stateDir>/terminal-internal-token`; in agent memory | server -> agent loopback `/internal/grant` | agent lifetime |

`AUTH_TOKEN` **永远不能**直接用于 `/ws`。Session token **永远不能**用于 `/pty-session` 或 `/command`。Strict separation 防止 SSE 或 page-content token leak escalate 成 shell access。

## Threat model（威胁模型）

Terminal pane **有意 bypass prompt-injection security stack**，因为用户直接向 claude typing，loop 中没有 untrusted page content。Trust source 是 keyboard，和任何 local terminal 一样。

这个 trust assumption 依赖三个 transport guarantees：

1. **Local-only listener。** terminal-agent.ts 只绑定 `127.0.0.1`。Dual-listener tunnel surface（server.ts `TUNNEL_PATHS`）不包含 `/pty-session` 或 `/terminal/*`，所以 tunnel 默认 deny 并返回 404。
2. **Origin gate。** `/ws` upgrades 要求 `Origin: chrome-extension://<id>`。Localhost web page 无法对 shell 发起 cross-site WebSocket hijack，因为它的 Origin 是普通 `http(s)://...`。
3. **Session token auth。** 只能由 authenticated `/pty-session` POST mint，scoped to one WS，close 时 auto-revoked。

丢掉其中任意一个，整个 tab 就不安全。

## Lifecycle（生命周期）

- **Eager auto-connect。** Sidebar opens -> tryAutoConnect polls bootstrap globals，并在它们设置后立即 connect。不需要 keypress。
- **One PTY per WS。** 关闭 WebSocket 会 SIGINT claude，3s 后 SIGKILL。Session token revoked，因此 stolen token 不能 replay。
- **No auto-reconnect on close。** 用户会看到 "Session ended, click to start a new session."（Session 已结束，点击以启动新 session。）Auto-reconnect 会在每次 reload 时 burn fresh claude session。v1.1 可能基于 tab/session id 添加 session resumption（见 TODOS）。
- **Manual restart anytime。** Always-visible terminal toolbar 中有 `↻ Restart` button，可在 mid-session 工作，不只在 ENDED state。

## Quick-action toolbar（快速操作工具栏）

Terminal pane 顶部 Restart button 旁有三个 browser-action buttons：

| Button（按钮） | Behavior（行为） |
|--------|----------|
| 🧹 Cleanup | `window.gstackInjectToTerminal(prompt)`：把 “remove ads/banners” instruction pipe 到 live PTY。Terminal 中的 claude 会看到并执行。 |
| 📸 Screenshot | `POST /command screenshot`：直接调用 browse-server，不涉及 PTY。 |
| 🍪 Cookies | Navigate 到 `/cookie-picker` page。 |

Inspector 的 "Send to Code" button 使用同样的 `gstackInjectToTerminal` path，把 CSS inspector data forward 给 claude。

## Debug surfaces（Activity / Refs / Inspector，调试界面）

位于 footer 的 `debug` toggle 后。SSE-driven，独立于 Terminal pane：

- **Activity**：通过 `/activity/stream` SSE stream 每个 browse command。
- **Refs**：REST：`GET /refs`，当前 page 的 `@ref` element labels。
- **Inspector**：CDP-based element picker；SSE on `/inspector/events`。

Debug strip 关闭时，Terminal pane 重新可见。xterm.js 不会在 container 从 `display:none` 变回 `display:flex` 时 auto-redraw，所以 sidepanel-terminal.js 会在 `#tab-terminal` 的 class attribute 上运行 `MutationObserver`，并在 `.active` 返回时 force fit + refresh。

## Files（文件）

| Component（组件） | File（文件） | Runs in（运行位置） |
|-----------|------|---------|
| Sidebar UI shell | `extension/sidepanel.html` + `sidepanel.js` + `sidepanel.css` | Chrome side panel |
| Terminal UI | `extension/sidepanel-terminal.js` + `extension/lib/xterm.js` | Chrome side panel |
| Service worker | `extension/background.js` | Chrome background |
| Content script | `extension/content.js` | Page context |
| HTTP server | `browse/src/server.ts` | Bun (compiled binary) |
| PTY agent | `browse/src/terminal-agent.ts` | Bun (non-compiled) |
| PTY token store | `browse/src/pty-session-cookie.ts` | Bun (compiled, in server.ts) |
| CLI entry | `browse/src/cli.ts` | Bun (compiled binary) |
| State file | `<stateDir>/browse.json` | Filesystem |
| Terminal port | `<stateDir>/terminal-port` | Filesystem |
| Internal token | `<stateDir>/terminal-internal-token` | Filesystem |
| Claude probe | `<stateDir>/claude-available.json` | Filesystem |
| Active tab | `<stateDir>/active-tab.json` | Filesystem (claude reads) |
