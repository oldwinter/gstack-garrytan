# iOS QA daemon 的 Tailscale ACL 示例

只有传入 `--tailnet` 时，Mac 侧 daemon 才会绑定 Tailscale interface。默认情况下，daemon 只支持 local USB。本 doc 会走一遍如何安全地把 iPhone 暴露给 remote agents，让它们可以通过 tailnet 运行 iOS QA。

## Threat model recap（威胁模型回顾）

- **iOS app StateServer:** 永远只监听 loopback。Mac 可以通过 CoreDevice IPv6 tunnel 访问它。它永不直接绑定到 tailnet。
- **Mac daemon:** 持有 tailnet interface。绑定两个 listeners：loopback（完整 surface，永不转发）和 tailnet（带 capability tiers 的 locked allowlist）。
- **Auth:** 通过本地 `tailscaled` socket（`/var/run/tailscale.sock` LocalAPI WhoIs）做 Tailscale identity validation。`~/.gstack/ios-qa-allowlist.json` allowlist file 是“谁能做什么”的 single source of truth。

## Step 1: 安装并运行 Tailscale

```bash
brew install --cask tailscale
# Login + start tailscaled, then verify:
tailscale status
```

确认 daemon 可以读取 LocalAPI socket：

```bash
test -S /var/run/tailscale.sock && echo "socket present" || echo "MISSING"
```

如果缺失，daemon 会拒绝打开 tailnet listener（fail-closed）。

## Step 2: 设置 daemon 的 ACL

daemon 需要知道哪些 Tailscale identities 允许以哪个 capability tier 控制哪些 devices。allowlist file 是 JSON：

```json
{
  "version": 1,
  "entries": [
    {
      "identity": "you@example.com",
      "capabilities": ["restore"],
      "expires_at": null,
      "note": "Owner — full access"
    },
    {
      "identity": "ci@example.com",
      "capabilities": ["mutate"],
      "expires_at": "2026-12-31T00:00:00Z",
      "note": "CI runner — can write state but not full restore"
    },
    {
      "identity": "tag:claude-readonly",
      "capabilities": ["observe"],
      "expires_at": null,
      "note": "Agents that should only read"
    }
  ]
}
```

Identities 会通过 WhoIs canonicalize：

- **User OAuth:** `user@example.com`（没有 `acct:`，也不重写 domain）。
- **Tagged nodes:** `tag:<tagname>`（lowercased）。
- **Node keys:** `node:<nodekey-hex>`（少见；优先用 tags）。

Capability tiers 有顺序：`observe` < `interact` < `mutate` < `restore`。授予 `restore` 意味着包含所有更低 tiers。

## Step 3: 为 remote agent mint session token

可以让 agents self-mint（前提是它们的 identity 在 allowlist 中），也可以替它们 server-side mint：

```bash
# Server-side mint (owner-only, runs locally on the Mac with the device):
gstack-ios-qa-mint --remote ci@example.com --capability mutate --ttl 1h

# Self-service mint (agent over tailnet):
curl -X POST http://<mac-tailnet-ip>:9999/auth/mint \
  -H "Content-Type: application/json" \
  -d '{"capability": "interact"}'
# → {"session_token": "...", "expires_at": "...", "capability": "interact"}
```

## Step 4: 收紧 Tailscale ACL（defense in depth）

daemon 的 allowlist 是 primary access control。再加一层 belt-and-suspenders：限制 tailnet ACL，让只有指定身份能 *reach* daemon port。

```jsonc
// In your tailscale admin console:
{
  "acls": [
    // Allow CI runner to reach the iOS QA Mac on port 9999 only.
    {
      "action": "accept",
      "src": ["ci@example.com"],
      "dst": ["ios-qa-mac:9999"]
    },
    // Tagged Claude agents — observe tier only (enforced by daemon, not ACL).
    {
      "action": "accept",
      "src": ["tag:claude-readonly"],
      "dst": ["ios-qa-mac:9999"]
    },
    // Default deny.
    {
      "action": "drop",
      "src": ["*"],
      "dst": ["ios-qa-mac:9999"]
    }
  ]
}
```

## Step 5: Audit trail（审计轨迹）

每个通过 tailnet listener 的 authenticated mutating request 都会向 `~/.gstack/security/ios-qa-audit.jsonl` 写入一行：

```jsonl
{"ts":"2026-05-18T14:23:00Z","identity":"ci@example.com","device_udid":"00008101-XXXX","endpoint":"/tap","session_id":"abc...","capability":"interact","request_id":"req_001","status":200}
```

Rejections（no token、expired token、capability-insufficient、identity not allowlisted、rate limit hit）会写入 `~/.gstack/security/attempts.jsonl`。

## Rate limits（速率限制）

- `/auth/mint`：每个 identity 60s 内最多 10 次 mint。第 11 次返回 429。
- Per-tailnet-request body：1MB hard cap（超过返回 413）。
- Screenshot response：10MB hard cap（超过返回 500，并带 sanitized error）。

## Token lifetime

- Daemon-minted session tokens：默认 1h TTL，可通过 `--tailnet-session-ttl` 设到最多 24h。
- 可通过 `POST /session/heartbeat` refresh（按 `ttl_seconds` 延长，但 capped at 原始 max）。
- Boot token（iOS app launch 和 daemon rotation 之间）：约 5s lifetime；daemon 会在第一次 scrape 时立即 rotate。

## Failure modes（失败模式）

| Symptom | Cause | Action |
|---|---|---|
| Daemon refuses to open tailnet listener | `/var/run/tailscale.sock` 缺失或 permission-denied | 安装 Tailscale；确认运行 daemon 的用户可以执行 `tailscale status` |
| `403 identity_not_allowed` | identity 不在 allowlist 中 | Owner mint：`gstack-ios-qa-mint --remote <identity>` |
| `403 capability_insufficient` | token tier 低于 endpoint requirement | 用更高的 `--capability` tier 做 owner mint |
| `429 rate_limited` | 单个 identity >10 mints/min | 等 60s；调查 agent 为什么频繁 re-mint |
| `409 schema_mismatch` on `/state/restore` | snapshot 来自较旧 app build | 丢弃 snapshot；用当前 app build 重新 capture |
