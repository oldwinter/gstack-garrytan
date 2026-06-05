# Domain Skills（domain skills）

Agent 为自己写的 per-site notes。它会跨 sessions compound：一旦 agent 发现某个 website 上不明显的东西，就保存一个 skill，未来在该 host 上的 sessions 会把这条 note 注入 prompt context。

这是 gstack 从 [browser-use/browser-harness](https://github.com/browser-use/browser-harness) 借来的模式。gstack 复制的是 per-site-notes pattern，**不是** self-modifying-runtime pattern。Skills 是加载进 prompts 的 markdown text；它们不是 executable code。

## Agents 如何使用

```bash
# Agent 在成功完成 task 后写下它对某个 site 的学习。
# Host 自动来自 active tab（没有 agent argument）。
echo "# LinkedIn Apply Button

The Apply button on /jobs/view pages is inside an iframe with a class
matching 'jobs-apply-button-iframe'. Use \$B frame --url 'apply' first,
then snapshot." | $B domain-skill save

# 查看已保存内容
$B domain-skill list

# 读取 specific host skill 的 body
$B domain-skill show linkedin.com

# 在 $EDITOR 中 interactively edit
$B domain-skill edit linkedin.com

# 把 active per-project skill promote 到 global（cross-project）
$B domain-skill promote-to-global linkedin.com

# 回滚最近一次编辑
$B domain-skill rollback linkedin.com

# Delete（tombstone，可通过 rollback recover）
$B domain-skill rm linkedin.com
```

## State machine（状态机）

```
  ┌──────────────┐  3 successful uses        ┌────────┐  promote-to-global   ┌────────┐
  │ quarantined  │ ─────────────────────▶  │ active │ ──────────────────▶  │ global │
  │ (per-project)│  (no classifier flags)   │(project)│  (manual command)    │        │
  └──────────────┘                          └────────┘                      └────────┘
         ▲                                       │
         │  classifier flag during use           │  rollback (version log)
         └───────────────────────────────────────┘
```

新 save 会落在 **quarantined**，不会在 prompts 中 auto-fire。在这个 host 上 3 次 use 且 L4 ML classifier 没有 flag skill content 后，该 skill 会在 project 中 auto-promote 为 **active**。Active skills 会在该 hostname 的每个新 sidebar-agent session 中 fire。

要让 skill 跨 projects fire（例如 “我想在每个 gstack project 中都使用我的 LinkedIn skill”），显式运行 `$B domain-skill promote-to-global <host>`。这是 by design opt-in（Codex T4 outside-voice review）：blanket cross-project compounding 会在 unrelated work 之间 leak context。

## Storage（存储）

Skills 位于两个位置：

- **Per-project**：`~/.gstack/projects/<slug>/learnings.jsonl`，也就是 `/learn` skill 使用的同一个 JSONL file。Domain skills 是 `type:"domain"` rows。
- **Global**：`~/.gstack/global-domain-skills.jsonl`，只包含 `state:"global"` rows。

两个 files 都是 append-only JSONL。Deletes 使用 tombstones；idle compactor 会周期性 rewrite files。Tolerant parser 在 read 时丢弃 partial trailing lines，因此 mid-write crash 不会 poison 后续 reads。

## Security model（安全模型）

Skills 是 agent-authored content，会加载到 future prompt context。这让它们成为 classic agent-to-agent prompt-injection vector。Plan 用多层防护明确处理这一点：

| Layer | What | Where |
|-------|------|-------|
| L1-L3 | Datamarking、hidden-element strip、ARIA regex、URL blocklist | `content-security.ts`（compiled binary） |
| L4 | TestSavantAI ONNX classifier | `security-classifier.ts`（sidebar-agent，non-compiled） |
| L4b | Claude Haiku transcript classifier | `security-classifier.ts`（sidebar-agent） |
| L5 | Canary token leak detection | `security.ts` |

L1-L3 checks 在 **save time** 运行（daemon 中）。L4 ML classifier 在 **load time** 运行（sidebar-agent 中），因此每个把 skill 加载到 prompt 的 session 也会重新 validate content。这能捕捉 classifier model update 后才显现的问题。

Save command 从 **active tab 的 top-level origin** derive hostname，而不是从 agent arguments 读取。这修复了 Codex flagged 的 confused-deputy bug：否则 malicious page redirect chain 可能 trick agent poisoning different domain。

## 错误参考

| Error | 原因 | 处理 |
|-------|-------|--------|
| `Save blocked: classifier flagged content as potential injection` | Save 时 L4 score >= 0.85 | Rewrite skill，移除 instruction-like prose，然后 retry。 |
| `Save blocked: <L1-L3 message>` | Save 时 URL blocklist match 或 ARIA injection | Review skill body，查找 suspicious patterns。 |
| `Save failed: empty body` | 没有通过 stdin 或 `--from-file` 提供 content | Pipe markdown into `$B domain-skill save`，或传 `--from-file <path>`。 |
| `Cannot save domain-skill: no top-level URL on active tab` | Tab 是 `about:blank` 或 `chrome://...` | 先 `$B goto <target-site>`，再 save。 |
| `Cannot promote: skill is in state "quarantined"` | Skill 尚未 auto-promoted | 在该 project 中使用它，直到 3 次 successful runs 且无 classifier flags。 |
| `Cannot rollback: <host> has fewer than 2 versions` | 只有一个 version exists | 改用 `$B domain-skill rm` delete。 |

## Telemetry（遥测）

Telemetry enabled 时（默认 `community` mode，除非关闭），以下 events 会写入 `~/.gstack/analytics/browse-telemetry.jsonl`：

- `domain_skill_saved {host, scope, state, bytes}`
- `domain_skill_save_blocked {host, reason}`
- `domain_skill_fired {host, source, version}`
- `domain_skill_state_changed {host, from_state, to_state}`（planned）

只记录 hostname，不记录 body content，不记录 agent text。可用 `gstack-config set telemetry off` 或 `GSTACK_TELEMETRY_OFF=1` 完全关闭。
