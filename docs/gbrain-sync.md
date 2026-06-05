# 使用 GBrain sync 实现跨机器 memory

gstack 会把大量有用 state 写到 `~/.gstack/`：learnings、retros、CEO plans、design
docs、developer profile。默认情况下，换 laptop 后这些都会留在原机器上。**GBrain
sync** 会把 curated subset push 到 private git repo，让你的 memory 跨机器跟随你，
并被 GBrain index。

## 你会得到什么

- 在 machine A 工作，在 machine B seamless pick up。
- Learnings、plans 和 designs 在 GBrain 中可见（如果你使用它）。
- 干净的 off-ramp（`gstack-brain-uninstall`），永远不触碰你的 data。
- 无 daemon、无 system service、无 background process。

## 哪些内容不会离开你的机器

By design，即使 sync 开启，这些也保持 local：

- Credentials：`.auth.json`, `auth-token.json`, `sidebar-sessions/`,
  `security/device-salt`, consumer tokens in `config.yaml`
- Machine-specific state：Chromium profiles、ONNX model weights、
  caches、eval-cache、CDP-profile、one-time prompt markers
  (`.welcome-seen`, `.telemetry-prompted`, `.vendoring-warned-*`, etc.)
- Question-preferences：per-machine UX preferences
  (`question-preferences.json`, `question-log.jsonl`, `question-events.jsonl`).

精确 allowlist 位于 `~/.gstack/.brain-allowlist`。CLI 会管理它；你可以在 marker line
下方 append 自己的 entries。

## 首次 setup（30-90 秒）

```bash
gstack-brain-init
```

该命令会：

1. 把 `~/.gstack/` 变成 git repo。
2. 询问 remote URL（默认：`gh repo create --private
   gstack-brain-$USER`）。任何 git remote 都可以：GitHub、GitLab、Gitea、
   self-hosted.
3. Push 一个只包含 config 的 initial commit。
4. 写入 `~/.gstack-brain-remote.txt`（URL-only，无 secrets，可安全 copy 到另一台机器）。
5. 把 gstack-brain repo 接入你的 local gbrain，作为 federated source（通过
   `gbrain sources add` + `git worktree`），让 `gbrain search` 可以 index 已同步的
   learnings、plans 和 designs。实现位于 `bin/gstack-gbrain-source-wireup`。旧的
   `gstack-brain-reader add --ingest-url ...` HTTP path 已在 v1.15.1.0 移除，
   因为它依赖 gbrain 从未 shipped 的 `/ingest-repo` endpoint。

Init 后，**下一次运行 skill** 会问你一个 privacy mode 问题：

- **Everything allowlisted（recommended）**：learnings、reviews、plans、designs、
  retros、timelines 和 developer profile 都会 sync。
- **Only artifacts**：plans、designs、retros、learnings，跳过 behavioral data
  （timelines、developer profile）。
- **Decline**：全部保持 local。之后可用
  `gstack-config set artifacts_sync_mode full`.

你的答案会持久化。之后不会再次询问。

## 跨机器工作流

在 machine A：运行一次 `gstack-brain-init`。就这样。之后每次 skill invocation 都会在
开始和结束边界 drain sync queue（每个 skill 约 200-800 ms network pause）。

在 machine B：

1. 把 `~/.gstack-brain-remote.txt` 从 machine A copy 到 machine B
   （password manager、dotfile repo、USB stick，任选）。
2. 运行任意 gstack skill。Preamble 看到 URL file 后会打印：
   ```
   BRAIN_SYNC: brain repo detected: <url>
   BRAIN_SYNC: run 'gstack-brain-restore' to pull your cross-machine memory
   ```
3. 运行 `gstack-brain-restore`。它会 clone repo，rehydrate 你的
   learnings/plans/retros，并重新注册 git merge drivers。
4. 重新输入 consumer tokens（它们是 machine-local，且不会同步：
   `gstack-config set gbrain_token <your-token>`).
5. 下一个 skill：你昨天在 machine A 上得到的 learning 会浮现。这就是 magical moment。

## Status、health 和 queue depth

```bash
gstack-brain-sync --status
```

显示：last successful push、pending queue depth、任何 sync blocks，以及 current privacy mode。

每次 skill run 都会在 preamble output 顶部附近打印一行 `BRAIN_SYNC:`。扫一眼看是否有问题。

## Privacy modes 详情

| Mode | 同步内容 |
|------|------------|
| `off` | Nothing（默认）。 |
| `artifacts-only` | Plans、designs、retros、learnings、reviews。跳过 timelines + developer-profile。 |
| `full` | Allowlist 中的一切，包括 behavioral state。 |

随时修改：
```bash
gstack-config set artifacts_sync_mode full
gstack-config set artifacts_sync_mode off
```

## Secret 保护

每个 commit 离开机器前都会扫描 credential-shaped content。Blocked patterns 包括：

- AWS access keys (`AKIA…`)
- GitHub tokens (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`)
- OpenAI keys (`sk-…`)
- PEM blocks (`-----BEGIN …-----`)
- JWTs (`eyJ…`)
- Bearer tokens in JSON (`"authorization": "…"`, `"api_key": "…"`, etc.)

如果 scan hit，sync 会停止，queue 会保留，preamble 会打印：

```
BRAIN_SYNC: blocked: <pattern-family>:<snippet>
```

修复方式：

1. Review offending file。
2. 如果 match 是 false positive，且内容是你明确想 sync 的，运行
   `gstack-brain-sync --skip-file <path>` 永久 exclude 该 path。
3. 否则，编辑 file 移除 secret，然后重新运行任意 skill。

`~/.gstack/.git/hooks/pre-commit` 有 defense-in-depth hook。如果你在该 repo 中手动
`git commit`，它会运行同样 scan。

## 双机器冲突

如果同一天在 machine A 和 machine B 写入，两边都会 push append commits。Git 默认会在
file tail conflict，但 `.jsonl` 和 markdown files 已注册 custom merge drivers：

- JSONL files 使用 sort-and-dedup driver，按 ISO timestamp 排序 appends
  （为 determinism，会 fallback 到每行 SHA-256 hash）。
- Markdown artifacts（retros、plans、designs）使用 union merge driver，
  concatenate both sides。

你通常不应看到 conflict prompts。如果看到（真正 semantic conflict，例如两台机器编辑同一个 plan），git 会停止并 prompt。

## 跨机器 pull 节奏

Preamble 每 24 小时运行一次 `git fetch` + `git merge --ff-only`
（通过 `~/.gstack/.brain-last-pull` cached）。你不需要考虑它：每天第一次 skill invocation
会自动发生。

## 卸载

```bash
gstack-brain-uninstall
```

这会：

- 移除 `~/.gstack/.git/` 和所有 `.brain-*` config files。
- 清除 `gstack-config` 中的 `artifacts_sync_mode`。
- 不会触碰你的 learnings、plans、retros 或 developer profile。

添加 `--delete-remote` 也会删除 private GitHub repo（仅 GitHub，使用 `gh repo delete`）。

随时可用 `gstack-brain-init` 重新 init。

## 故障排查

每条 gstack-brain 可能打印的 error message 索引见
[gbrain-sync-errors.md](gbrain-sync-errors.md)，其中包含 problem / cause / fix。

## 底层实现

这个 feature 背后的 architectural decisions（allowlist vs denylist、daemon vs
preamble-boundary sync、JSONL merge driver、privacy stop-gate）见 gstack plans
directory 中的 [approved plan](../system-instruction-you-are-working-jaunty-kahn.md)。
