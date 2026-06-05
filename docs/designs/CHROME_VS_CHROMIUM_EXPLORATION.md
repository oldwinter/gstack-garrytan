# Chrome vs Chromium：为什么使用 Playwright bundled Chromium

## Original Vision（原始设想）

构建 `$B connect` 时，plan 是连接到用户的**真实 Chrome browser**，也就是带着他们 cookies、sessions、extensions 和 open tabs 的那个。不再需要 cookie import。设计要求：

1. `chromium.connectOverCDP(wsUrl)` 通过 CDP 连接到 running Chrome
2. Gracefully quit Chrome，并用 `--remote-debugging-port=9222` relaunch
3. 访问用户的真实 browsing context

这就是为什么 `chrome-launcher.ts` 曾存在（361 LOC browser binary discovery、CDP port probing、runtime detection），也是为什么 method 叫 `connectCDP()`。

## 实际发生了什么

通过 Playwright 的 `channel: 'chrome'` launch 时，real Chrome 会 silent block `--load-extension`。Extension 无法 load。我们需要 extension 提供 side panel（activity feed、refs、chat）。

Implementation fallback 到 `chromium.launchPersistentContext()` + Playwright bundled Chromium。它可以可靠地通过 `--load-extension` 和 `--disable-extensions-except` load extensions。但 naming 留了下来：`connectCDP()`、`connectionMode: 'cdp'`、`BROWSE_CDP_URL`、`chrome-launcher.ts`。

Original vision（访问用户真实 browser state）从未实现。我们每次都 launch fresh browser，functionally identical to Playwright's Chromium，却带着 361 行 dead code 和 misleading names。

## Discovery（2026-03-22）

在一次 `/office-hours` design session 中，我们 trace architecture 并发现：

1. `connectCDP()` 不使用 CDP，而是调用 `launchPersistentContext()`
2. `connectionMode: 'cdp'` misleading，它只是 “headed mode”
3. `chrome-launcher.ts` 是 dead code，唯一 import 位于 unreachable `attemptReconnect()` method
4. `preExistingTabIds` 是为了保护我们从未连接过的 real Chrome tabs 而设计
5. `$B handoff`（headless -> headed）使用不同 API（`launch()` + `newContext()`），无法 load extensions，造成两种不同的 “headed” experiences

## 修复

### 重命名
- `connectCDP()` -> `launchHeaded()`
- `connectionMode: 'cdp'` -> `connectionMode: 'headed'`
- `BROWSE_CDP_URL` -> `BROWSE_HEADED`

### Deleted（删除）
- `chrome-launcher.ts`（361 LOC）
- `attemptReconnect()`（dead method）
- `preExistingTabIds`（dead concept）
- `reconnecting` field（dead state）
- `cdp-connect.test.ts`（deleted code 的 tests）

### Converged（收敛）
- `$B handoff` 现在使用 `launchPersistentContext()` + extension loading（与 `$B connect` 相同）
- One headed mode，不是 two
- Handoff 免费得到 extension + side panel

### Gated（受 flag 控制）
- Sidebar chat 放在 `--chat` flag 后
- `$B connect`（default）：只有 activity feed + refs
- `$B connect --chat`：再加 experimental standalone chat agent

## 架构（after，修复后）

```
Browser States:
  HEADLESS (default) ←→ HEADED ($B connect or $B handoff)
     Playwright            Playwright (same engine)
     launch()              launchPersistentContext()
     invisible             visible + extension + side panel

Sidebar (orthogonal add-on, headed only):
  Activity tab    — always on, shows live browse commands
  Refs tab        — always on, shows @ref overlays
  Chat tab        — opt-in via --chat, experimental standalone agent

Data Bridge (sidebar → workspace):
  Sidebar writes to .context/sidebar-inbox/*.json
  Workspace reads via $B inbox
```

## 为什么不是 Real Chrome？

Playwright launch real Chrome 时，Chrome 会 block `--load-extension`。这是 Chrome security feature：通过 command-line args load 的 extensions 会在 Chromium-based browsers 中受限，以防 malicious extension injection。

Playwright bundled Chromium 没有这个限制，因为它是为 testing 和 automation 设计的。`ignoreDefaultArgs` option 让我们绕过 Playwright 自己的 extension-blocking flags。

如果未来想访问用户真实 cookies/sessions，路径是：
1. Cookie import（已经通过 `$B cookie-import` 可用）
2. Conductor session injection（future，sidebar sends messages to workspace agent）

不是 reconnecting to real Chrome。
