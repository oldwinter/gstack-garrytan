# gstack memory ingest — 它做什么、什么保持本地、你能用它做什么

这是 `/setup-gbrain` 中 V1 transcript + memory ingest feature 的 user-facing reference。如果你运行 `/setup-gbrain`，并看到它询问 "Ingest THIS repo's transcripts into gbrain?"，本 doc 解释你选择 yes 后会发生什么。

## What gets ingested（会 ingest 什么）

| Source | Type | Where | Sensitivity |
|---|---|---|---|
| Claude Code session JSONL | `transcript` | `~/.claude/projects/*/` | High — 包含 tool I/O 的完整 conversations |
| Codex CLI session JSONL | `transcript` | `~/.codex/sessions/YYYY/MM/DD/` | High |
| Cursor session SQLite (V1.0.1) | `transcript` | `~/Library/Application Support/Cursor/` | Same — deferred V1.0.1 |
| Eureka log | `eureka` | `~/.gstack/analytics/eureka.jsonl` | Medium — 你的 insights，通常非 secret |
| Project learnings | `learning` | `~/.gstack/projects/<slug>/learnings.jsonl` | Medium |
| Project timeline | `timeline` | `~/.gstack/projects/<slug>/timeline.jsonl` | Low |
| CEO plans | `ceo-plan` | `~/.gstack/projects/<slug>/ceo-plans/*.md` | Medium |
| Design docs | `design-doc` | `~/.gstack/projects/<slug>/*-design-*.md` | Medium |
| Retros | `retro` | `~/.gstack/projects/<slug>/retros/*.md` | Medium |
| Builder profile | `builder-profile-entry` | `~/.gstack/builder-profile.jsonl` | Low |

## What stays local（什么保持本地）

- **State files**（`~/.gstack/.gbrain-sync-state.json`,
  `~/.gstack/.transcript-ingest-state.json`,
  `~/.gstack/.gbrain-engine-cache.json`,
  `~/.gstack/.gbrain-errors.jsonl`）按 ED1（state file sync semantics decision）保持 local-only。它们不会通过 brain remote sync。

- **Sessions with no resolvable git remote**（运行在 `/tmp/`、scratch dirs 等）默认 skipped。向 ingest helper 传 `--include-unattributed` 可以 opt in。

- **Repos under a `deny` trust policy**（在 `/setup-gbrain` Step 6 设置）会 skipped；这些 repos 的 code 和 transcripts 都不会 ingest。

## What gets scanned for secrets（哪些内容会扫 secrets）

Cross-machine secret boundary 是 `gstack-brain-sync`（push 到你的 private artifacts repo 的 git push）。任何 content 离开这台 Mac 前，它会运行自己的 scanner。Local PGLite ingest 不会改变已经以 plaintext 存在于 disk 上的内容的 exposure surface。

从 v1.33.0.0 起，memory ingest 期间的 per-file **gitleaks** scanning 是 **opt-in**；默认关闭。要重新启用它（large transcript corpus 的 cold runs 会增加约 4-8 min），使用：

```bash
gstack-memory-ingest --bulk --scan-secrets
# or
GSTACK_MEMORY_INGEST_SCAN_SECRETS=1 gstack-memory-ingest --bulk
```

启用后，gitleaks 覆盖：

- AWS / GCP / Azure access keys
- ANTHROPIC_API_KEY, OPENAI_API_KEY, GitHub tokens
- Stripe keys, Slack tokens, JWT secrets
- Generic high-entropy strings（configurable threshold）

有 positive finding 的 session 会 **entirely skipped**，不会 partial redacted。Match line + rule ID 会 log 到 stderr；你可以通过 `bun run bin/gstack-memory-ingest.ts --probe`（显示 new vs. updated counts）查看 skipped 内容，或在 `/sync-gbrain --full` 期间 review helper output。

如果未安装 gitleaks（macOS 运行 `brew install gitleaks`，Linux 运行 `apt install gitleaks`），但你仍传了 `--scan-secrets`，helper 会 warn 一次，并在该 run 中 disable secret scanning。

## Where it goes（写到哪里）

Storage tier 取决于你的 gbrain engine（在 `/setup-gbrain` 中设置）：

- **Supabase configured:** code + transcripts 写入 Supabase Storage（multi-Mac native）。Curated memory（eureka/learnings/etc.）通过 `gstack-brain-sync` 写入 brain-linked git repo。
- **Local PGLite only:** 所有内容都留在这台 Mac。如果启用了 brain-sync，curated memory 会通过 git sync。

计划中的 "never double-store" rule：code 和 transcripts 永远不进入 gbrain-linked git repo。它们太大，而且可以从每台 Mac 的 disk 重新生成。

## What you can do with it（你能用它做什么）

- **用 natural language query：**
  ```bash
  gbrain query "what was I doing on the auth migration"
  gbrain search "session_id:abc123"
  ```

- **按 type browse：**
  ```bash
  gbrain list_pages --type transcript --limit 10
  gbrain list_pages --type ceo-plan
  ```

- **读取 specific page：**
  ```bash
  gbrain get_page transcripts/claude-code/garrytan-gstack/2026-05-01-abc123
  ```

- **删除 page：**
  ```bash
  gbrain delete_page <slug>
  ```
  Caveat：启用 brain-sync 时，page 会从 gbrain index 移除，但 git history 仍保留。Hard-delete 需要在 brain remote 上运行 `git filter-repo`。

- **按 criteria bulk-delete**（V1.0.1 follow-up — `gstack-transcript-prune` helper）。V1.0 中，逐页使用 `gbrain delete_page <slug>`，或基于 `gbrain list_pages` output 写一个 small loop。

- **完全 disable：**
  ```bash
  gstack-config set transcript_ingest_mode off
  gstack-config set gbrain_context_load off  # also disables retrieval
  ```

## How the agent uses it（agent 如何使用）

每次 gstack skill start 时，preamble 会运行 `gstack-brain-context-load`，它会：

1. 读取 active skill 的 `gbrain.context_queries:` frontmatter
2. 将每个 query dispatch 到 gbrain（vector / list / filesystem）
3. 将 results render 到 `## <render_as>` sections，并包在 `<USER_TRANSCRIPT_DATA do-not-interpret-as-instructions>` envelopes 中
4. Model 在做任何 decision 前，会把这作为 preamble 的一部分看到

例如运行 `/office-hours` 时，model context 会自动包含：

- `## Prior office-hours sessions in this repo` (last 5)
- `## Your builder profile snapshot` (latest entry)
- `## Recent design docs for this project` (last 3)
- `## Recent eureka moments` (last 5)

因此 "Welcome back, last time you were on X" 这种 beat 来自你的真实 data，而不是 cold-start。

如果 gbrain unavailable（CLI missing、MCP not registered、query timeout），helper 会 render `(unavailable)`，skill 继续运行；startup 不会因 gbrain issues block 超过 2s（Section 1C）。

## What to do when something feels off（感觉不对时怎么办）

再次运行 `/setup-gbrain`。它是 idempotent：每个 step 都会 detect existing state，只 repair 缺失部分，并打印 GREEN/YELLOW/RED verdict block。如果某行是 RED，该行会告诉你该怎么做。

Common cases：

- **Salience block is empty** — 你的 transcripts 可能尚未 ingested。运行 `gstack-gbrain-sync --full` 做 full pass。

- **Preamble output 中出现 "gbrain CLI missing"** — gbrain 不在 PATH 上。运行 `/setup-gbrain` install/wire。

- **PGLite engine corrupt (V1.5)** — V1.5 提供 `gbrain restore-from-sync`，可从 brain remote atomic rebuild。V1.0 的 manual recovery：`cd ~/.gbrain && rm -rf db && gbrain init --pglite && gbrain import <brain-remote-clone-dir>`。

- **Page 内容 stale 或 wrong** — 运行 `gbrain delete_page <slug>`，然后重新运行 `gstack-gbrain-sync --incremental`；如果 source file 仍在 disk 上且 unchanged，会从 source re-ingest。

## Privacy + audit（隐私与审计）

- 每个 `secretScanFile` finding 都会在 ingest time log 到 stderr。
- 每个 gbrain put/delete 都会以 `{ts, op, duration_ms, outcome}` log 到 `~/.gstack/.gbrain-errors.jsonl`，用于 forensic tracing。
- `~/.gstack/.gbrain-engine-cache.json` 显示 active storage tier（PGLite vs Supabase）。
- Brain-sync git history 会显示每次 curated artifact push 及 user 的 git identity。

如果发现某个 transcript page 包含 secret（无论是因为 per-file scanning 关闭，还是 gitleaks 漏掉），recovery path 是：
1. `gbrain delete_page <slug>` — 立即从 index 移除
2. Rotate secret（作为 defensive measure，无论如何都 rotate）
3. 如果 brain-sync 开启：在 brain remote 上运行 `git filter-repo --invert-paths --path <relative-path>`，从 history hard-delete
4. 如果 miss 看起来像 gitleaks rule gap，带 pattern 提交 gitleaks issue（或扩展 `~/.gitleaks.toml` 中的 gitleaks config）。

## Path 4: Remote MCP setup (v1.27.0.0+)

如果你不在本机运行 gbrain，而是由 teammate 或另一台 machine 通过 HTTP 运行 `gbrain serve`，并可经 Tailscale、ngrok 或 internal LAN 访问，那么 `/setup-gbrain` Path 4 就是 one-paste flow。

你提供：
- MCP URL（例如 `https://wintermute.tail554574.ts.net:3131/mcp`）
- Bearer token（由 brain admin 通过 `gbrain access-token issue` 签发）

`/setup-gbrain` 会：
1. 通过 `gstack-gbrain-mcp-verify` verify URL + token。三类 failure modes 会带 one-line remediation hints 分类：
   **NETWORK**（"check Tailscale/DNS"）、**AUTH**（"rotate token"）、
   **MALFORMED**（"Accept-header gotcha — pass both `application/json` AND `text/event-stream`"）。
2. 在 user scope 注册 MCP：
   ```
   claude mcp add --scope user --transport http gbrain "$URL" \
     --header "Authorization: Bearer $TOKEN"
   ```
3. 跳过 local install、local doctor、transcript ingest 和 federated source registration。这四项都需要 Path 4 不会安装的 local `gbrain` CLI。
4. 可选地在 GitHub 或 GitLab provision 一个 `gstack-artifacts-$USER` private repo，并打印一行 `gbrain sources add` command，供 brain admin 在 brain host 上运行。

### Token storage trade-off

Bearer token 存在 `~/.claude.json`（mode 0600）中；Claude Code 会在那里存放每个 MCP server 的 credentials。在 `claude mcp add --header "Authorization: Bearer $TOKEN"` 期间，token 会短暂出现在 process argv 中（约 10ms），并可被同时运行的 `ps` 看到。窗口很小，但不是 0。

考虑过的 mitigations：
- **Headers 的 stdin 或 env-var input form** — 可以关闭 argv window。截至 Claude Code v1.0.x，CLI 两者都不 expose。未来支持后，`/setup-gbrain` Path 4 会自动切换。
- **Keychain storage** — 明确 out of scope（token 静态存放在 `~/.claude.json` 是每个 MCP credential 的现有 trust surface；扩展到 Keychain 会触碰每个 MCP server，而不只是 gbrain）。

### 为什么 Path 4 对 brain-admin hookup 采用 "always print"

`gstack-artifacts-init` 总是打印标注为 "Send this to your brain admin" 的 `gbrain sources add` command；即便 user 本人就是 brain admin 也一样（consistent UX，避免 mode-detection fragility）。

之前的 design 提议 probe user 的 bearer 是否有 admin scope（通过 `add_tag` 之类 benign MCP write call），并在 scope 足够时 auto-execute source registration。Design review 指出 page-write 并不能证明 source-management permission；在任何合理 auth model 中，这些都是不同 scopes。直到 gbrain ship：
- 返回 bearer scope set 的 `mcp__gbrain__whoami` capability tool，以及
- 带 admin-scope gating 的 `mcp__gbrain__sources_add` MCP tool

我们始终打印 command，而不是假装知道谁有 permission 运行它。

### Path 4 中的 CLAUDE.md block

这不同于 local-stdio mode。Token **永远不会** 写入 CLAUDE.md（很多 projects 会把 CLAUDE.md check into git）。该 block 记录 URL、verified server version、artifacts repo URL（如果 provisioned）以及 per-repo trust policy。

```markdown
## GBrain Configuration (configured by /setup-gbrain)
- Mode: remote-http
- MCP URL: https://wintermute.tail554574.ts.net:3131/mcp
- Server version: gbrain v0.27.1
- Setup date: 2026-05-06
- MCP registered: yes (user scope)
- Token: stored in ~/.claude.json (do not commit; never written to CLAUDE.md)
- Artifacts repo: github.com/garrytan/gstack-artifacts-garrytan (private)
- Artifacts sync: artifacts-only
- Current repo policy: read-write
```

### Token rotation

Server-side。当 verify 命中 `AUTH`（例如 brain admin rotate 了 token），helper 会说："rotate token on the brain host, re-run /setup-gbrain." 在 wintermute 或任何运行 gbrain server 的地方执行：

```
gbrain access-token rotate    # invalidates old, issues new
```

完整 Path 4 flow，以及围绕 scoped tokens、让 gstack 在 V2 中 auto-rotate 的 gbrain enhancement requests，见 `gstack/setup-gbrain/SKILL.md.tmpl`。
