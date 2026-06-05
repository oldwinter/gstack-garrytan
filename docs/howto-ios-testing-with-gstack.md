# 如何使用 GStack iOS 测试 iOS apps

这是 gstack 随附的 iOS QA capability 的端到端 walkthrough：把 canonical Swift templates 安装进你的 app，通过 USB 连接真实 iPhone，并从任何 agent 驱动它（本地 Claude Code，或通过 Tailscale 的任何 HTTP-capable agent）。不需要 simulators，不需要 XCTest harness，不需要 WebDriverAgent。

下方所有流程都已在运行 iOS 26.5 的真实 iPhone 17 Pro Max 上完成端到端验证。同样流程适用于任何 iOS 16+ device。

## 你需要准备什么

- 已安装 Xcode 16.0+ 的 macOS（`xcrun devicectl --version` 必须成功）。Xcode 16 提供 CoreDevice tunnel，`devicectl` 会用它通过 USB 访问 device。
- 运行 iOS 16 或更高版本的真实 iPhone。已解锁、已与 Mac paired，并在 Settings -> Privacy & Security 中启用 **Developer Mode**。
- Apple developer team，free personal team 对 live-device debug deploys 已足够。你需要 team ID（例如 `623FYQ2M88`），不是 certificate ID。可在 Xcode -> Settings -> Accounts -> your Apple ID -> team list 找到。Setup 首次 deploy 时会通过 `-allowProvisioningUpdates -allowProvisioningDeviceRegistration` 为你的 device 签名 app。
- 已安装 gstack（`./setup` 完成；`bin/gstack-ios-qa-daemon` 必须存在且 executable）。
- PATH 上有 Bun runtime（`bun --version`）。Mac-side daemon 是 bun process。

对于 optional remote-agent（Tailscale）mode，还需要 Mac 已安装 Tailscale，且 `/var/run/tailscale.sock` 可读。

## 一句话架构

```
┌─────────────────┐   tailnet (opt)    ┌──────────────────────┐   USB CoreDevice    ┌─────────────────────┐
│ Remote agent    │ ─────────────────▶ │ gstack-ios-qa-daemon │ ──────────────────▶ │ iOS app StateServer │
│ (Claude, GPT,   │  bearer + session  │  (Mac, bun/TS)       │  IPv6 ULA tunnel    │  (loopback only)    │
│  OpenClaw, ...) │                    │                      │                     │                     │
└─────────────────┘                    └──────────────────────┘                     └─────────────────────┘
```

- iOS app 嵌入 `StateServer`（`DebugBridge` SPM library，仅 `#if DEBUG`），监听 `::1` + `127.0.0.1` port 9999。Bearer-token gated。Boot token 会在 daemon spawn 后约 5 秒内 rotate，因此之后 scrape `os_log` 的任何东西都会看到 dead credential。
- Mac daemon 通过 paired device 连接时 `xcrun devicectl` 自动打开的 CoreDevice IPv6 tunnel broker traffic。
- 在 Tailscale mode 中，daemon 会暴露绑定到 tailnet IP 的 separate listener，并按 session token enforce capability tiers（observe / interact / mutate / restore）。Tokens 由 Mac owner 通过 `gstack-ios-qa-mint` 显式 mint；remote callers 永远不会 auto-allowlist。

iOS `StateServer` **始终**是 loopback-only，即使在 remote mode 中也是如此。Identity validation 发生在 Mac-side，因为 iPhone 无法验证 Tailscale identity。

## Step 1：把 DebugBridge templates 添加到 iOS app

`./setup` 后，templates 位于 `~/.claude/skills/gstack/ios-qa/templates/`。最快安装方式是在 app root 中从 Claude Code invoke `/ios-qa` skill：它会读取 Swift source，codegen typed `@Observable` state accessors，并用你的 bundle ID 放置 templates。也可以手动操作：

1. 把这些文件 copy 到 app workspace 内的 `DebugBridge/` SPM package：
   - `Sources/DebugBridgeCore/StateServer.swift`（来自 `StateServer.swift.template`）
   - `Sources/DebugBridgeCore/DebugBridgeManager.swift`（来自 `DebugBridgeManager.swift.template`）
   - `Sources/DebugBridgeTouch/DebugBridgeTouch.m` + `Sources/DebugBridgeTouch/include/DebugBridgeTouch.h`（来自两个 `.template` files）
   - `Sources/DebugBridgeUI/Bridges.swift`（来自 `Bridges.swift.template`）
   - `Sources/DebugBridgeUI/DebugOverlay.swift`（来自 `DebugOverlay.swift.template`）
   - `Package.swift`（来自 `Package.swift.template`）
2. 把 package 作为 app 的 local dependency 添加。依赖 `DebugBridgeUI` product，并设置 `condition: .when(configuration: .debug)`。`DebugBridgeCore` 和 `DebugBridgeTouch` 会 transitively 引入。
3. 在 `@main` App init 中，用 `#if DEBUG` gate wiring：

   ```swift
   #if DEBUG
   import DebugBridgeCore
   StateServer.shared.start()
   #if canImport(UIKit)
   import DebugBridgeUI
   DebugBridgeUIWiring.installAll()
   #endif
   #endif
   ```

三个 Swift targets 的拆分是：`DebugBridgeCore` cross-platform（因此 CI Mac host 上的 `swift build` 可以不依赖 UIKit 验证大部分代码），`DebugBridgeUI` 和 `DebugBridgeTouch` iOS-only（它们 link UIKit）。`DebugBridgeTouch` 是 Objective-C，它承载 KIF-derived UITouch synthesis，并带有 iOS 18+ `_UIHitTestContext` fix，使 SwiftUI Button taps 能真正触发。

Structural Release-build guard 是 `Package.swift` 中的 `.when(configuration: .debug)` clause。SwiftPM 会拒绝在 Release build 中 link 任何 `DebugBridge*` target，因此即使忘记 cleanup，bridge 也无法 ship 到 TestFlight。

## Step 2：Build + install 到 device

在 app project directory 中运行：

```
xcodebuild \
  -scheme YourAppScheme \
  -configuration Debug \
  -destination 'generic/platform=iOS' \
  -derivedDataPath /tmp/build \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=YOUR_TEAM_ID \
  build
```

然后安装并启动：

```
UDID=$(xcrun devicectl list devices 2>/dev/null | awk 'NR>2 && $0!="" {print $(NF-2); exit}')
xcrun devicectl device install app --device "$UDID" /tmp/build/Build/Products/Debug-iphoneos/YourApp.app
xcrun devicectl device process launch --device "$UDID" --terminate-existing your.bundle.id
```

如果 phone locked，会看到 `FBSOpenApplicationServiceErrorDomain error 1 — Locked`。解锁后 retry。首次 install 会在 phone 上出现 Trust dialog；点击 Trust，然后重新运行。

## Step 3：启动 Mac-side daemon

有两个选项。

**Option A：让 skill spawn 它。** 从任意位置在 Claude Code 中运行 `/ios-qa`；skill 会按需 spawn daemon、bootstrap tunnel、rotate boot token，并通过 proxy 暴露 device。这是 local-USB use 最干净的路径。

**Option B：自己启动。** 运行：

```
gstack-ios-qa-daemon
```

当两个 loopback listeners 都已 bound，daemon 会打印 `READY: port=<n> pid=<pid>`。默认 port 是 9099。Spawners 可用约 5 秒 timeout 读取该行确认 readiness；你也可以把 `curl` 指向打印出的 port。

无论哪种方式，daemon 都会在 `~/.gstack/ios-qa-daemon.pid` 上拿 exclusive flock。从两个 Claude Code sessions 运行两次是安全的；第二次 invocation 会发现 running daemon 的 port 并 join。

设置这些 env vars 可指定 device 或 bundle：

```
GSTACK_IOS_TARGET_UDID=248C3A58-B843-5BDB-8F5D-89ADB7D7BF6A
GSTACK_IOS_TARGET_BUNDLE_ID=com.yourorg.yourapp
GSTACK_IOS_DAEMON_PORT=9099       # loopback listener port; default 9099
```

如果 `GSTACK_IOS_TARGET_UDID` 未设置，daemon 会选择第一个 paired connected device。

## Step 4：驱动 device

Daemon 运行后，你会在 `http://127.0.0.1:9099`（或 `[::1]:9099`）得到 HTTP surface。Skill flow 会帮你处理这些，但 raw endpoints 如下：

| Endpoint | 作用 | Auth |
|---|---|---|
| `GET /healthz` | Version probe。 | none（loopback） |
| `POST /auth/rotate` | Daemon-only；把 boot token rotate 成 in-memory-only value。 | boot token |
| `POST /session/acquire` | Acquire per-device session lock。返回 `{session_id, ttl_seconds}`。 | bearer |
| `POST /session/release` | Release lock。 | bearer + session |
| `GET /screenshot` | Capture active window PNG。返回 `{png_base64: "..."}`。 | bearer |
| `GET /elements` | Accessibility-tree snapshot。 | bearer |
| `GET /state/snapshot` | Dump every `@Snapshotable` field as JSON。 | bearer |
| `POST /state/restore` | Atomically restore full snapshot。 | bearer + session, mutate tier |
| `POST /tap` `{x,y}` | 在 window coordinates synthesize real UITouch。SwiftUI Buttons 会触发。 | bearer + session, interact tier |
| `POST /swipe` `{from_x,from_y,to_x,to_y}` | Scroll nearest enclosing UIScrollView。 | bearer + session, interact tier |
| `POST /type` `{text}` | 设置 current first responder 上的 text。 | bearer + session, interact tier |

Mutating requests 同时需要 `Authorization: Bearer <token>` header 和 `X-Session-Id` header。Read endpoints（`/screenshot`、`/elements`、`GET /state/*`）只需要 bearer。

State snapshot 通过 canonical state struct 上的 `@Snapshotable` property wrapper 按 field opt-in。未 annotate 的 fields 永远不会出现在 snapshot 中，因此 tokens、PII 和 auth state 默认不会进入 recorded fixtures。

## Step 5：让 remote agents 工作（optional）

要让另一台机器上的 agent drive device，使用 `--tailnet` 运行 daemon：

```
gstack-ios-qa-daemon --tailnet
```

Daemon 会先 probe `/var/run/tailscale.sock`；如果 socket 缺失或 unreadable，它会拒绝打开 tailnet listener（loopback 仍会运行）。Remote mode 永远不会 half-start。

然后为应该连接的 identity mint session token：

```
gstack-ios-qa-mint grant --remote 'alice@example.com' --capability interact
gstack-ios-qa-mint grant --remote 'tag:ci' --capability mutate --ttl 86400 --note 'nightly'
gstack-ios-qa-mint list
```

Capability tiers 是 nested：`observe`（read endpoints only）⊂ `interact`（taps、swipes、type）⊂ `mutate`（`POST /state/*`）⊂ `restore`（`POST /state/restore`）。选择能完成任务的最小 tier。Allowlist file 位于 `~/.gstack/ios-qa-allowlist.json`（mode 0600），daemon 会在每次 `/auth/mint` request 时读取它，因此 changes 无需 restart 即可生效。

Remote agent 随后向 daemon 的 tailnet listener 发送 `POST /auth/mint`。Daemon 通过 tailscaled 的 WhoIs endpoint canonicalize caller identity，检查 allowlist，并返回 short-lived session token（默认 1 小时，cap 24 小时）。每个 authenticated mutating request 都会落入 `~/.gstack/security/ios-qa-audit.jsonl`；rejected requests 会落入 `~/.gstack/security/attempts.jsonl`。

## Step 6：Ship release build

Ship 到 TestFlight 或 App Store 前，运行 `/ios-clean`。它会移除 `DebugBridge` SPM dependency，并从 `@main` App 中 strip `#if DEBUG` wiring。`Package.swift` 中的 structural guard（`condition: .when(configuration: .debug)`）意味着 Release build 即使你忘记 cleanup 也不会 link bridge，但 `/ios-clean` 会给你一个干净 diff 供 review 和 ship。

## Common failures（常见失败）

| 症状 | 出了什么问题 |
|---|---|
| `xcodebuild` fails with `Could not locate device support files for iOS X.Y` | 运行 `xcodebuild -downloadPlatform iOS`，为 iPhone 的 iOS version fetch device support package（约 8GB）。 |
| Install succeeds, `process launch` fails with `Locked` | Phone locked。解锁并 retry。 |
| First install on a paired device fails with no clear error | Phone 需要 Trust 这台 Mac。在 phone 上打开 Settings -> General -> VPN & Device Management 并确认。 |
| `Developer Mode` toggle missing from Settings -> Privacy | 连接 device 到 Xcode -> Window -> Devices and Simulators 一次，或对它尝试任意 `devicectl device install`。iOS 会在第一次 attempt 后显示 toggle。 |
| `xcrun devicectl device copy from` returns ERROR 7000 | Source path 错了，boot token 位于 app data container（NSTemporaryDirectory）内的 `tmp/gstack-ios-qa.token`，不是 path root。 |
| `/healthz` returns 200 but `/tap` returns ok:true with no UI change | Phone 已 paired，但 StateServer port 可能跨 launches 改变。重新 resolve CoreDevice IPv6（`dscacheutil -q host -a name '<DeviceName>.coredevice.local'`）。 |
| `403 identity_not_allowed` from `/auth/mint` | Remote caller identity 不在 Mac allowlist 中。在 Mac 上运行 `gstack-ios-qa-mint grant --remote <identity> --capability interact`。 |
| Daemon won't open the tailnet listener | Tailscale 未安装，或 `/var/run/tailscale.sock` unreadable。修复 Tailscale，然后 restart daemon。期间 loopback 仍会运行。 |
| SwiftUI Button tap returns `ok:true` but the action never fires | 你在 iOS 17 或更旧版本，那里不存在 `_UIHitTestContext`。DebugBridgeTouch implementation 会 fallback 到 plain `hitTest:`，它无法 resolve 到 SwiftUI gesture container。把 device 更新到 iOS 18+，或改 tap UIKit control。 |

## 这会带来什么

你可以用任何支持 HTTP 的语言写 agent loop：take screenshot，问 model 下一步做什么，再 send tap。在操作前后 capture state snapshots，为 `/ios-fix` regression tests 记录 deterministic fixtures。把 colleague 加进 allowlist，他们就能通过 Tailscale 从自己的 laptop drive 你的 iPhone，而无需接触 hardware。通过 mint 一个带 mutate-tier capability 和 24-hour TTL 的 `tag:ci` session token，同一个 daemon 也能接入 CI。

整套 stack 只需要你已有的 Mac、已有的 iPhone、free Apple developer account 和 gstack。No paid testing service。No simulator drift。用户看到的东西，就是 agent 驱动的东西。
