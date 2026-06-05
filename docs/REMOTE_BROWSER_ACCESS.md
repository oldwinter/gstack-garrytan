# Remote Browser Access：如何与 GStack Browser 配对

GStack Browser server 可以分享给任何能发 HTTP requests 的 AI agent。Agent 会获得对真实 Chromium browser 的 scoped access：导航页面、读取内容、点击元素、填写表单、截图。每个 agent 都有自己的 tab。

本文档是 remote agents 的 reference。Quick-start instructions 由 `$B pair-agent` 生成，并内置实际 credentials。

## 架构

```
Your Machine                          Remote Agent
─────────────                         ────────────
GStack Browser Server                 Any AI agent
  ├── Chromium (Playwright)           (OpenClaw, Hermes, Codex, etc.)
  ├── Local listener  127.0.0.1:LOCAL         │
  │    (bootstrap, CLI, sidebar, cookies)      │
  ├── Tunnel listener 127.0.0.1:TUNNEL ◄───────┤
  │    (pair-agent only: /connect, /command,   │
  │     /sidebar-chat — locked allowlist)      │
  ├── ngrok tunnel (forwards tunnel port only) │
  │     https://xxx.ngrok.dev ─────────────────┘
  └── Token Registry
        ├── Root token (local listener only)
        ├── Setup keys (5 min, one-time)
        ├── Session tokens (24h, scoped)
        └── SSE session cookies (30 min, stream-scope)
```

### 双 listener 架构（v1.6.0.0）

Daemon 绑定两个 HTTP sockets。**Local listener** 只向 127.0.0.1 提供完整 command surface，永不 forward。**Tunnel listener** 在 `/tunnel/start` 上 lazy bind（并在 `/tunnel/stop` 时拆除），带 locked path allowlist。ngrok 只 forward tunnel port。

误撞到你的 ngrok URL 的 caller 访问不到 `/health`、`/cookie-picker`、`/inspector/*` 或 `/welcome`，因为这些 paths 在那个 TCP socket 上不存在。通过 tunnel 发送 root token 会得到 403。Tunnel listener 只接受 `/connect`、`/command`（scoped token + 26-command browser-driving allowlist）和 `/sidebar-chat`。

完整 endpoint table 见 [ARCHITECTURE.md](../ARCHITECTURE.md#dual-listener-tunnel-architecture-v1600)。

## 连接流程

1. **User runs（用户运行）** `$B pair-agent`（或 Claude Code 中的 `/pair-agent`）
2. **Server creates（server 创建）** one-time setup key（5 分钟过期）
3. **User copies（用户复制）** instruction block 到另一个 agent 的 chat
4. **Remote agent runs（remote agent 运行）** `POST /connect`，携带 setup key
5. **Server returns（server 返回）** scoped session token（默认 24h）
6. **Remote agent creates（remote agent 创建）** 自己的 tab，通过 `POST /command` 执行 `newtab`
7. **Remote agent browses（remote agent 浏览）** 使用 session token + tabId 调用 `POST /command`

## API 参考

### 认证

所有 command endpoints 都需要 Bearer token：

```
Authorization: Bearer gsk_sess_...
```

`/connect` unauthenticated（rate-limited），remote agent 用它把 setup key exchange 成 scoped session token。`/health` 在 local listener 上 unauthenticated（bootstrap），但 tunnel listener 上不存在（404）。

SSE endpoints（`/activity/stream`、`/inspector/events`）接受 Bearer token 或 HttpOnly `gstack_sse` cookie（通过 `POST /sse-session` mint，30-minute TTL，仅 stream-scope，不能用于 `/command`）。从 v1.6.0.0 起，不再接受 `?token=<ROOT>` query-string auth。

### 端点

#### POST /connect
用 setup key exchange session token。不需要 auth。Rate-limited to 300/minute（flood defense，setup keys 是 24 random bytes，不可 brute force）。

```json
Request:  {"setup_key": "gsk_setup_..."}
Response: {"token": "gsk_sess_...", "expires": "ISO8601", "scopes": ["read","write"], "agent": "agent-name"}
```

#### POST /command
发送 browser command。需要 Bearer auth。

```json
Request:  {"command": "goto", "args": ["https://example.com"], "tabId": 1}
Response: (plain text result of the command)
```

#### GET /health
Server status。不需要 auth。返回 status、tabs、mode、uptime。

### 命令

#### 导航
| Command | Args | 说明 |
|---------|------|-------------|
| `goto` | `["URL"]` | 导航到 URL |
| `back` | `[]` | 后退 |
| `forward` | `[]` | 前进 |
| `reload` | `[]` | 重新加载页面 |

#### 读取内容
| Command | Args | 说明 |
|---------|------|-------------|
| `snapshot` | `["-i"]` | 带 @ref labels 的 interactive snapshot（最有用） |
| `text` | `[]` | Full page text |
| `html` | `["selector?"]` | Element HTML 或 full page |
| `links` | `[]` | 页面上的所有 links |
| `screenshot` | `["/tmp/s.png"]` | 截图 |
| `url` | `[]` | Current URL |

#### 交互
| Command | Args | 说明 |
|---------|------|-------------|
| `click` | `["@e3"]` | 点击 element（使用 snapshot 中的 @ref） |
| `fill` | `["@e5", "text"]` | 填写 form field |
| `select` | `["@e7", "option"]` | 选择 dropdown value |
| `type` | `["text"]` | 输入 text（keyboard） |
| `press` | `["Enter"]` | 按 key |
| `scroll` | `["down"]` | 滚动页面 |

#### Tabs（标签页）
| Command | Args | 说明 |
|---------|------|-------------|
| `newtab` | `["URL?"]` | 创建 new tab（write 前 required） |
| `tabs` | `[]` | 列出所有 tabs |
| `closetab` | `["id?"]` | 关闭 tab |

## Snapshot -> @ref 模式

这是最强大的 browsing pattern。不要手写 CSS selectors：

1. 运行 `snapshot -i`，获得带 labeled elements 的 interactive snapshot
2. Snapshot 返回类似：
   ```
   [Page Title]
   @e1 [link] "Home"
   @e2 [button] "Sign In"
   @e3 [input] "Search..."
   ```
3. 在 commands 中直接使用 `@e` refs：`click @e2`、`fill @e3 "search query"`

这就是 snapshot system 的工作方式，比猜 CSS selectors 可靠得多。始终先 `snapshot -i`，再使用 refs。

## 权限范围

| Scope | 允许的内容 |
|-------|------------|
| `read` | snapshot、text、html、links、screenshot、url、tabs、console 等 |
| `write` | goto、click、fill、scroll、newtab、closetab 等 |
| `admin` | eval、js、cookies、storage、cookie-import、useragent 等 |
| `meta` | tab、diff、frame、responsive、watch |

默认 tokens 获得 `read` + `write`。Admin 需要 pairing 时使用 `--admin` flag。

## Tab 隔离

每个 agent 拥有自己创建的 tabs。规则：
- **Read：**任何 agent 都可以 read any tab（snapshot、text、screenshot）
- **Write：**只有 tab owner 可以 write（click、fill、goto 等）
- **Unowned tabs：**Pre-existing tabs 的 writes 仅 root 可用
- **First step：**尝试 interact 前始终 `newtab`

## 错误码

| Code | 含义 | 处理方式 |
|------|---------|------------|
| 401 | Token invalid、expired 或 revoked | 让用户重新运行 /pair-agent |
| 403 | Command not in scope，或 tab 不是你的 | 使用 newtab，或请求 --admin |
| 429 | Rate limit exceeded（>10 req/s） | 等待 Retry-After header |

## 安全模型

- **Physical port separation。** Local listener 和 tunnel listener 是独立 TCP sockets。ngrok 只 forward tunnel port。Tunnel callers 完全无法访问 bootstrap endpoints（404，wrong port）。
- **Tunnel command allowlist。** Tunnel 上的 `/command` 只接受 26 个 browser-driving commands（goto、click、fill、snapshot、text、newtab、tabs、back、forward、reload、closetab 等）。Server-management commands（tunnel、pair、token、useragent、js）在 tunnel 上 denied。
- **Root token is tunnel-blocked。** 通过 tunnel listener 携带 root token 的 request 会返回 403，并附 pairing hint。Tunnel 上只有 scoped session tokens 可用。
- **Setup keys** 5 分钟过期且只能使用一次。
- **Session tokens** 24 小时过期（可配置）。
- Root token 永远不会出现在 instruction blocks 或 connection strings 中。
- **Admin scope**（JS execution、cookie access）默认 denied。
- Tokens 可即时 revoked：`$B tunnel revoke agent-name`
- **SSE auth** 使用 30-minute HttpOnly SameSite=Strict cookie，仅 stream-scope（永远不能用于 `/command`）。
- **Path traversal guarded** on `/welcome`：`GSTACK_SLUG` 必须匹配 `^[a-z0-9_-]+$`，否则 fallback 到 built-in template。
- **SSRF guards** on `goto`、`download` 和 scrape paths：根据 localhost/private-range blocklist validate URL target。
- **Tunnel surface denial logging。** Tunnel listener 上每个 rejection（`path_not_on_tunnel`、`root_token_on_tunnel`、`missing_scoped_token`、`disallowed_command:*`）都会 append 到 `~/.gstack/security/attempts.jsonl`，包含 timestamp、source IP、path、method。Rate-capped at 60 writes/min。
- 所有 agent activity 都带 attribution logged（clientId）。

**Known non-goal（tracked as #1136）：**在 Windows 上，cookie-import-browser path 会用 `--remote-debugging-port=<random>` 启动 Chrome。配合 App-Bound Encryption v20，同用户 local process 可以连接到该 port 并 exfiltrate decrypted v20 cookies，这是相对直接读取 SQLite DB 的 elevation path。修复方向是用 `--remote-debugging-pipe` 替代 TCP。

## 同机快捷方式

如果两个 agents 在同一台机器上，跳过 copy-paste：

```bash
$B pair-agent --local openclaw    # writes to ~/.openclaw/skills/gstack/browse-remote.json
$B pair-agent --local codex       # writes to ~/.codex/skills/gstack/browse-remote.json
$B pair-agent --local cursor      # writes to ~/.cursor/skills/gstack/browse-remote.json
```

不需要 tunnel。直接使用 localhost。

## ngrok tunnel 设置

对于不同机器上的 remote agents：

1. 在 [ngrok.com](https://ngrok.com) 注册（free tier 可用）
2. 从 dashboard copy auth token
3. 保存：`echo 'NGROK_AUTHTOKEN=your_token' > ~/.gstack/ngrok.env`
4. 可选 claim stable domain：`echo 'NGROK_DOMAIN=your-name.ngrok-free.dev' >> ~/.gstack/ngrok.env`
5. 带 tunnel 启动：`BROWSE_TUNNEL=1 $B restart`
6. 运行 `$B pair-agent`，它会自动使用 tunnel URL
