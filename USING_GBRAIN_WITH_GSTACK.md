# 在 GStack 中使用 GBrain

让你的 coding agent 真正拥有可保留的 memory。

[GBrain](https://github.com/garrytan/gbrain) 是为 AI agents 设计的 persistent knowledge base。它保存 agent 学到的内容、你做过的决定、哪些做法有效和无效，并允许 agent 按需搜索这一切。GStack 提供一条 one-command 路径，从零到 “gbrain is running, and my agent can call it”，覆盖 try-it-local、share-with-your-team，以及中间所有场景。

这是完整指南：每个 scenario、每个 flag、每个 helper bin、每个 troubleshooting step。快速介绍见 [README 的 GBrain section](README.md#gbrain--persistent-knowledge-for-your-coding-agent)。错误码和 sync-specific issues 见 [docs/gbrain-sync.md](docs/gbrain-sync.md)。

---

## 一条命令安装

```bash
/setup-gbrain
```

就这样。这个 skill 会检测当前状态，最多问三个问题，并引导你完成 install、init、Claude Code 的 MCP registration，以及 per-repo trust policy。在一台什么都没安装的干净 Mac 上，它会在五分钟内完成。在已经有部分配置的 Mac 上只需要几秒钟，因为它会检测 existing state 并跳过已完成工作。

## Setup 后你会得到什么

`/setup-gbrain` 完成后，你的 coding agent 会获得之前没有的两个 retrieval surfaces：

- **跨当前 repo 的 semantic code search。** `gbrain search "browser security canary"` 返回 ranked file regions，而不是 exact-match grep hits。`gbrain code-def`、`code-refs`、`code-callers`、`code-callees` 会按 symbol 遍历 call graph。当你不知道实现在哪个文件、但知道它做什么时很有用。当问题是 semantic 的，agent 会优先使用这些，而不是 Grep；CLAUDE.md 会得到一个 `## GBrain Search Guidance` block，教它 routing rules。
- **Cross-session memory。** 过去 sessions 中的 plans、retros、decisions 和 learnings 位于 `~/.gstack/`，并且如果你 opt in artifacts sync，会 push 到 gbrain 可索引的 private git repo。`gbrain search "what did we decide about auth?"` 会真正找到之前的 CEO plan，而不是让你每次 session 都重新描述 context。

如果你还启用了 remote MCP（下方 Path 4），brain queries 会 route 到其他机器也能写入的 shared brain server：你的 laptop、desktop 和 teammate 的机器都能看到同一份 memory。

## 四条路径

当 skill 问 “Where should your brain live?” 时，你选择其中一条。

### Path 1：Supabase，已有 connection string

适合：你（或 teammate 的 cloud agent）已经 provisioned 一个 Supabase brain，并希望这台本地机器使用同一份数据。

**会发生什么：**粘贴 Session Pooler URL（Settings -> Database -> Connection Pooler -> Session -> copy URI，port 6543）。Skill 会以 echo off 读取它，显示 redacted preview（`aws-0-us-east-1.pooler.supabase.com:6543/postgres`，host 可见，password masked），通过 `GBRAIN_DATABASE_URL` environment variable 交给 `gbrain init`，而 URL 永远不会写入 argv 或 shell history。

**Trust warning：**粘贴这个 URL 会让本地 Claude Code 对 shared brain 中的 every page 拥有 full read/write access。如果这不是你想要的 trust level，改选 PGLite local（Path 3），并接受 brains 是 disjoint 的。

### Path 2a：Supabase，自动 provision 新 project

适合：全新的 Supabase account，希望 zero clicking 得到一个干净的新 project。

**会发生什么：**你粘贴 Supabase Personal Access Token（PAT）。Skill 会先显示 scope disclosure：*the token grants full access to every project in your Supabase account, not just the one we're about to create*。它列出 organizations，询问使用哪个 organization 和 region（默认 `us-east-1`），生成 database password，调用 `POST /v1/projects`，每 5 秒 poll `GET /v1/projects/{ref}` 直到 project 是 `ACTIVE_HEALTHY`（180s timeout），fetch pooler URL，然后交给 `gbrain init`。端到端约 90 秒。

最后：明确提醒你在 https://supabase.com/dashboard/account/tokens revoke PAT。Skill 已经从 memory 中丢弃它。

**如果你在 provision 中途 Ctrl-C：**SIGINT trap 会打印 in-flight project ref + resume command。你可以在 Supabase dashboard 删除 orphan，也可以运行 `/setup-gbrain --resume-provision <ref>` 从离开的地方继续。

### Path 2b：Supabase，手动创建

适合：你宁愿自己在 supabase.com 上点击创建，也不想粘贴 PAT。

**会发生什么：**Skill 引导你完成四个 manual steps（signup -> new project -> wait ~2 min -> copy Session Pooler URL），然后从 Path 1 的 paste step 接管。Security treatment 与 Path 1 相同。

### Path 3：本地 PGLite

适合：try-it-first、no account、no cloud、no sharing。也适合一个 dedicated “this Mac's brain”，与任何 cloud agent 隔离。

**会发生什么：**`gbrain init --pglite`。Brain 位于 `~/.gbrain/brain.pglite`。Init 本身不做 network calls。30 秒完成。

**Embedding model。** 当设置了 `VOYAGE_API_KEY`，gstack 会用 `voyage-code-3`（1024-dim）初始化 PGLite，这是 Voyage 的 code-specialized embedding model，在这个 codebase 的 symbol queries 上正面对比超过其 general-purpose `voyage-4-large` 和 OpenAI `text-embedding-3-large`。没有 `VOYAGE_API_KEY` 时，gbrain 会 auto-select（存在 `OPENAI_API_KEY` 时使用 OpenAI 1536-dim，否则沿 provider chain fallback）。无论哪种方式，embeddings 都会在 sync 时调用所选 provider 的 API，所以在运行 `/sync-gbrain` 前设置你想用的 provider key。

如果你只是想在投入 cloud 前感受 gbrain，这是最佳 first choice。之后总可以用 `/setup-gbrain --switch` migrate。

### Path 4：Remote gbrain MCP（split-engine）

适合：brain 运行在你控制的另一台机器上（Tailscale、ngrok、internal LAN），或 teammate 的 server 上。你想获得 cross-machine memory benefit，但不想在本地搭 database，同时仍希望这台 Mac 上有 symbol-aware code search。

**会发生什么：**你粘贴一个 MCP URL（例如 `https://wintermute.tail554574.ts.net:3131/mcp`）和 bearer token。Skill 会 over the wire 验证 URL，在 user scope 的 `~/.claude.json` 中把 gbrain 注册为 HTTP MCP，并询问是否同时搭建一个 tiny local PGLite 用于 code search（约 30 秒，约 120 MB disk）。

如果接受 local PGLite，你会进入 **split-engine mode**：

- **Brain/context queries**（`mcp__gbrain__search`、`mcp__gbrain__query`、`mcp__gbrain__get_page`）route 到 remote MCP。Plans、retros、learnings、cross-machine memory 都在 shared server 上。
- **Code queries**（`gbrain code-def`、`code-refs`、`code-callers`、`code-callees`、用于 code 的 `gbrain search`）通过每个 worktree 中的 `.gbrain-source` pin route 到 local PGLite。本地索引、速度快、永不离开机器。

两个 engines 相互独立。清空 local PGLite 不会触碰 remote brain；轮换 remote MCP bearer 不会影响 local code search。如果 remote brain admin 不能（或不应）索引每个 developer 的 checkout，这也是正确配置：local code stays local。

## Claude Code 的 MCP registration

默认情况下，skill 会问 “Give Claude Code a typed tool surface for gbrain?” 如果你回答 yes，它会运行：

```bash
claude mcp add gbrain -- gbrain serve
```

这会把 gbrain 的 stdio MCP server 注册到 Claude Code。现在 `gbrain search`、`gbrain put`、`gbrain get` 等会作为每个 session 中的 first-class tools 出现，而不是 bash shell-outs。

**如果 `claude` 不在 PATH 上**，skill 会 gracefully skip MCP registration，并给出 manual-register hint。CLI resolver 仍然可供任何 shell out 到 `gbrain` 的 skill 使用。MCP 是 upgrade，不是 prerequisite。

**其他 local agents**（Cursor、Codex CLI 等）需要各自的 MCP registration。该 skill 的 v1 目标是 Claude Code；其他 hosts 可以在自己的 MCP config 中手动注册 `gbrain serve`。

## Per-remote trust policy（三元组）

你机器上的每个 repo 都会有一个 policy decision：**read-write**、**read-only** 或 **deny**。

- **read-write**：agent 可以从这个 repo 的 context 中 `gbrain search`，也可以把 new pages 写回 brain。你自己的 projects 默认使用它。
- **read-only**：agent 可以 search brain，但不会从这个 repo 的 sessions 写入 new pages。适合 multi-client consultants：可以搜索 shared brain，但在 Client B 的 repo 中工作时，不会用 Client A 的 code 污染它。
- **deny**：完全没有 gbrain interaction。这个 repo 对 gbrain tooling 不可见。

你第一次在某个 repo 中运行 gstack skill 时，skill 会对该 repo 询问一次。之后 decision 是 sticky 的：同一个 git remote 的 every worktree + branch 共享同一个 policy，所以只需设置一次，它会跟随你。

SSH 和 HTTPS remote variants 会 collapse 到同一个 key：`https://github.com/foo/bar.git` 和 `git@github.com:foo/bar.git` 是同一个 repo。

**修改 policy：**

```bash
/setup-gbrain --repo      # re-prompt for this repo only

# 或直接：
~/.claude/skills/gstack/bin/gstack-gbrain-repo-policy set "github.com/foo/bar" read-only
```

**查看所有 policy：**

```bash
~/.claude/skills/gstack/bin/gstack-gbrain-repo-policy list
```

Storage：`~/.gstack/gbrain-repo-policy.json`，mode 0600，schema-versioned，确保 future migrations deterministic。

## 用 `/sync-gbrain` 保持 brain current

`/setup-gbrain` 是 one-time onboarding。每当你希望 gbrain 看到当前 repo code 中的 fresh changes，就运行 `/sync-gbrain`。

```bash
/sync-gbrain                # incremental: mtime fast-path, ~seconds on a clean tree
/sync-gbrain --full         # full reindex (~25-35 minutes on a big Mac)
/sync-gbrain --code-only    # only the code stage; skip memory + brain-sync
/sync-gbrain --dry-run      # preview what would sync; no writes
```

Skill 会独立运行三个 stages：code、memory、brain-sync。某个 stage failure 不会阻塞其他 stages。State 持久化到 `~/.gstack/.gbrain-sync-state.json`，因此重新运行可以干净接续。

**它在 fresh worktree 中会做什么：**

1. **Pre-flight。** 检查 `gbrain_local_status`（local engine health）。如果 engine 是 `broken-db` 或 `broken-config`，skill 会带着 remediation menu STOP，拒绝 silently degrade。如果 local engine 缺失且你处于 remote-MCP mode（Path 4），code stage 会干净 SKIP，只运行 brain-sync。
2. **Code stage。** 通过 `gbrain sources add` 把 cwd 注册为 federated source，在 repo root 写入 `.gbrain-source` pin file（kubectl-style context，每个 worktree 都有自己的 pin，所以 Conductor sibling worktrees 不会 collide），运行 `gbrain sync --strategy code`。
3. **Memory stage。** Stage 你的 `~/.gstack/` transcripts + curated memory。在 local-stdio MCP mode 中，ingest 到 local engine。在 remote-http MCP mode 中，把 staged markdown 持久化到 `~/.gstack/transcripts/run-<pid>-<ts>/`，供 remote brain admin 的 pull pipeline 使用。Ingest timeout 默认 30 分钟；big brain 可用 `GSTACK_INGEST_TIMEOUT_MS` 提高（接受 1 min-24h）。Timeout 时 gbrain import checkpoint 会保留，下一次 `/sync-gbrain` 会 resume，而不是从头开始。
4. **Brain-sync stage。** 如果配置了 private artifacts repo，会把 curated artifacts（plans、designs、retros）push 到那里。
5. **CLAUDE.md guidance。** Capability-check round-trip（write a page -> search -> find it）。如果 green，就把 `## GBrain Search Guidance` block 写入项目 CLAUDE.md。如果 red，则移除该 block，agent 不应被告知使用一个未安装的 tool。

**Watermark。** Sync state 按 commit hash 前进。如果 gbrain 遇到无法 index 的 file（每个 file 5 MB hard limit，或 file 在 mid-sync 消失），watermark 会停住，后续 syncs 会 retry。要 acknowledge 一个无法修复的 failure 并越过它：

```bash
gbrain sync --source <source-id> --skip-failed
```

可重新运行、idempotent，并且可以从同一台机器上的多个 terminals 安全运行（通过 `~/.gstack/.sync-gbrain.lock` lock）。

## 后续切换 engines

选了 PGLite，现在想加入 team brain？一条命令：

```bash
/setup-gbrain --switch
```

Skill 会运行包在 `timeout 180s` 中的 `gbrain migrate --to supabase --url "$URL"`。Migration 是 bidirectional 的（Supabase -> PGLite 也可用）且 lossless，pages、chunks、embeddings、links、tags 和 timeline 都会 copy。原 brain 会保留为 backup。

**如果 migration hangs：**另一个 gstack session 可能持有 source brain 上的 lock。Timeout 会在 3 分钟触发，并给出 actionable message。关闭其他 workspaces 后重新运行。

## GStack memory sync（独立关注点）

这和 gbrain 本身不同。你的 gstack state（`~/.gstack/`：learnings、plans、retros、timeline、developer profile）默认是 machine-local。“GStack memory sync” 可选地把 curated、secret-scanned subset push 到 private git repo，让 memory 跨机器跟随你。如果你运行 gbrain，该 git repo 也会在那里变得可索引。

开启方式：

```bash
gstack-brain-init
```

你会看到 one-time privacy prompt：**everything allowlisted** / **artifacts only**（plans、designs、retros、learnings，跳过 timelines 等 behavioral data）/ **off**。每次 skill run 会在开始和结束时 sync queue，没有 daemon，没有 background process。

Secret-shaped content（AWS keys、GitHub tokens、PEM blocks、JWTs、bearer tokens）会在离开机器前被 blocked from sync。

**在新机器上：**复制 `~/.gstack-brain-remote.txt`，运行 `gstack-brain-restore`，昨天的 learnings 就会出现在今天的 laptop 上。

完整 guide：[docs/gbrain-sync.md](docs/gbrain-sync.md)。Error index：[docs/gbrain-sync-errors.md](docs/gbrain-sync-errors.md)。

`/setup-gbrain` 会在 initial setup 结束时询问是否为你 wire this up。这只是多一个 AskUserQuestion，并会整合到同一套 private-repo infrastructure。

## 清理 orphan projects

如果你曾在 mid-provision 时 Ctrl-C，试了三个不同名字才定下来，或以其他方式积累了不用的 gbrain-shaped Supabase projects，有一个 subcommand 专门处理：

```bash
/setup-gbrain --cleanup-orphans
```

Skill 会重新收集 PAT（one-time，之后丢弃），列出 Supabase account 中所有 name 以 `gbrain` 开头、且 ref 不匹配 active `~/.gbrain/config.json` pooler URL 的 projects。对每个 orphan，它都会逐 project 询问：*"Delete orphan project `<ref>` (`<name>`, created `<date>`)?"*，没有 batching，没有 “delete all” shortcut。Active brain 永远不会被提供为 deletion 选项。

## 命令与 flag 参考

### `/setup-gbrain` 入口模式

| Invocation | 作用 |
|---|---|
| `/setup-gbrain` | 完整流程：detect state、pick path、install、init、MCP、policy、optional memory-sync |
| `/setup-gbrain --repo` | 仅切换当前 repo 的 per-remote trust policy |
| `/setup-gbrain --switch` | 迁移 engine（PGLite <-> Supabase），不重新运行其他 steps |
| `/setup-gbrain --resume-provision <ref>` | 恢复在 polling 中断的 path-2a auto-provision |
| `/setup-gbrain --cleanup-orphans` | List + per-project delete orphan Supabase projects |

### Bin helpers（用于 scripting）

| Bin | 用途 |
|---|---|
| `gstack-gbrain-detect` | 以 JSON 输出 current state：gbrain on PATH、version、config engine、doctor status、sync mode |
| `gstack-gbrain-install` | Detect-first installer（依次 probe `~/git/gbrain`、`~/gbrain`，然后 fresh clone）。有 `--dry-run` 和 `--validate-only` flags。PATH-shadow check 会带 remediation menu 以 exit 3 退出。 |
| `gstack-gbrain-lib.sh` | 被 source，不被 executed。提供 `read_secret_to_env VARNAME "prompt" [--echo-redacted "<sed-expr>"]` |
| `gstack-gbrain-supabase-verify` | Structural URL check。拒绝 direct-connection URLs（`db.*.supabase.co:5432`），exit 3 |
| `gstack-gbrain-supabase-provision` | Management API wrapper。Subcommands：`list-orgs`、`create`、`wait`、`pooler-url`、`list-orphans`、`delete-project`。全部要求 env 中有 `SUPABASE_ACCESS_TOKEN`。`create` 和 `pooler-url` 还要求 `DB_PASS`。每个 subcommand 都有 `--json` mode。 |
| `gstack-gbrain-repo-policy` | Per-remote trust triad。Subcommands：`get`、`set`、`list`、`normalize` |
| `gstack-gbrain-source-wireup` | 通过 `gbrain sources add` + `git worktree` 把你的 `~/.gstack/` brain repo 注册为 gbrain federated source，然后运行 initial `gbrain sync`。Idempotent。替代 v1.12.x 中失效的 `consumers.json + /ingest-repo` HTTP wireup。Flags：`--strict`、`--source-id <id>`、`--no-pull`、`--uninstall`、`--probe`。 |

### gbrain CLI（upstream tool）

Gbrain 自带这些由 gstack wrap 的命令：

| Command | 用途 |
|---|---|
| `gbrain init --pglite` | 初始化 local PGLite brain |
| `gbrain init --non-interactive` | 通过 env（`GBRAIN_DATABASE_URL` 或 `DATABASE_URL`）初始化。永远不要把 URL 作为 argv 传入，它会 leak 到 shell history。 |
| `gbrain doctor --json` | Health check。返回 `{status: "ok"|"warnings"|"error", health_score: 0-100, checks: [...]}` |
| `gbrain migrate --to supabase --url ...` | 把 PGLite brain 移到 Supabase（lossless，保留 source 作为 backup） |
| `gbrain migrate --to pglite` | Reverse migration |
| `gbrain search "query"` | Search the brain |
| `gbrain put "<slug>" --content "<markdown-with-frontmatter>"` | 写入 page（title/tags 放在 `--content` 内的 YAML frontmatter） |
| `gbrain get "<slug>"` | Fetch page |
| `gbrain serve` | 启动 MCP stdio server（供 `claude mcp add` 使用） |

### 配置文件与状态

| Path | 内容 |
|---|---|
| `~/.gbrain/config.json` | Engine（pglite/postgres）、database URL 或 path、API keys。Mode 0600。由 `gbrain init` 写入。 |
| `~/.gstack/gbrain-repo-policy.json` | Per-remote trust triad。Schema v2。Mode 0600。 |
| `~/.gstack/.setup-gbrain.lock.d` | Concurrent-run lock（atomic mkdir）。Normal exit + SIGINT 时释放。 |
| `~/.gstack/.brain-queue.jsonl` | gstack memory sync 的 pending sync entries |
| `~/.gstack/.brain-last-push` | last sync push 的 timestamp（用于 `/health` scoring） |
| `~/.gstack-brain-remote.txt` | gstack memory sync remote 的 URL（可安全地在机器之间 copy） |
| `~/.gstack/.setup-gbrain-inflight.json` | 为未来 `--resume-provision` persisted state 保留 |

### 环境变量

| Var | 读取位置 | 作用 |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | `gstack-gbrain-supabase-provision` | Management API calls 的 PAT。每次 setup run 后丢弃。 |
| `DB_PASS` | `gstack-gbrain-supabase-provision`（create、pooler-url） | Generated DB password。永不进入 argv。 |
| `GBRAIN_DATABASE_URL` | `gbrain init`、`gbrain doctor` 等 | Postgres connection string（这里是 Supabase pooler URL）。Env 优先于 `~/.gbrain/config.json`。 |
| `DATABASE_URL` | `gbrain init`（fallback） | 语义同 `GBRAIN_DATABASE_URL`，第二顺位检查。 |
| `SUPABASE_API_BASE` | `gstack-gbrain-supabase-provision` | Override Management API host。Tests 用它指向 mock server。 |
| `GBRAIN_INSTALL_DIR` | `gstack-gbrain-install` | Override default install path（`~/gbrain`） |
| `GSTACK_HOME` | every bin helper | Override `~/.gstack` state dir。Tests 大量使用。 |
| `VOYAGE_API_KEY` | `gbrain embed` subprocess；gstack PGLite init | 设置后，gstack 用 `voyage-code-3`（1024-dim）初始化 PGLite，这是 Voyage 的 code-specialized embedding model。在这个 codebase 的 symbol queries 上正面对比超过 `voyage-4-large` 和 OpenAI `text-embedding-3-large`。A/B numbers 见 CHANGELOG v1.43.1.0。 |
| `OPENAI_API_KEY` | `gbrain embed` subprocess | 未设置 `VOYAGE_API_KEY` 时，在 `gbrain sync` / `/sync-gbrain` 期间用于 embeddings（gbrain auto-selected fallback，`text-embedding-3-large` 1536-dim）。两个 key 都没有时，pages 会以结构形式导入（symbol tables、chunks），但 semantic search 会 degrade。Sync log 中会看到 `[gbrain] embedding failed for code file ...`。 |
| `ANTHROPIC_API_KEY` | `claude-agent-sdk`、paid evals | `bun run test:evals` 以及任何直接针对 Claude 的 `query()` call 都需要它。 |
| `GSTACK_OPENAI_API_KEY` | `lib/conductor-env-shim.ts` | Conductor-injected fallback。当 canonical name 为空时提升为 `OPENAI_API_KEY`。 |
| `GSTACK_ANTHROPIC_API_KEY` | `lib/conductor-env-shim.ts` | Anthropic 的同样模式。 |

## Conductor + GSTACK_* env vars

如果你在 [Conductor](https://conductor.build) workspace 中运行 gstack，**Conductor 会明确从 workspace env 中 strip `ANTHROPIC_API_KEY` 和 `OPENAI_API_KEY`。** 把它们设置在 `~/.zshrc` 或 `.env` 没有用，因为 strip 发生在 env inheritance 之后。要把可用 API key 放进 workspace，请改为在 Conductor 的 workspace env config 中设置 `GSTACK_ANTHROPIC_API_KEY` 和 `GSTACK_OPENAI_API_KEY`。Conductor 会原样传递这些变量。

`lib/conductor-env-shim.ts` 在 gstack side bridge 这个 gap：当作为 side effect import（`import "../lib/conductor-env-shim";`）时，它会为看不到 canonical name 的任何 subprocess 把 `GSTACK_FOO_API_KEY` 提升为 `FOO_API_KEY`。Shim 已接入：

- `bin/gstack-gbrain-sync.ts`：让 `/sync-gbrain` 能获取 OpenAI 做 embeddings
- `bin/gstack-model-benchmark`：让 `--judge` runs 无需 manual env mapping
- `scripts/preflight-agent-sdk.ts`：让 paid-eval auth probes 可用
- `test/helpers/e2e-helpers.ts`：让 `bun run test:evals` 能找到 Anthropic

如果新增会 hit paid API 或需要 gbrain embeddings 的 TS entry point，请在顶部添加同样的一行 import。Contributor checklist 见 [CONTRIBUTING.md "Conductor workspaces"](CONTRIBUTING.md#conductor-workspaces)。

`bin/gstack-codex-probe` 是 bash，不会直接读取这些变量；它依赖 Codex CLI 管理的 `~/.codex/` auth。

## 安全模型

这个 skill 触碰的每个 secret 都遵循一条规则：**只用 env var，永不进 argv，永不 logged，永不由我们写入 disk。** 唯一 persistent storage 是 gbrain 自己的 `~/.gbrain/config.json`，mode 0600；这是 gbrain 的 discipline，不是 ours。

**在 code 中 enforcement：**

- `test/skill-validation.test.ts` 中的 CI grep test 会在 `$SUPABASE_ACCESS_TOKEN` 或 `$GBRAIN_DATABASE_URL` 出现在 argv position 时让 build fail
- 如果 `--insecure`、`-k` 或 `NODE_TLS_REJECT_UNAUTHORIZED=0` 出现在 `bin/gstack-gbrain-supabase-provision` 中，CI grep test 会 fail
- Provision helper 顶部的 `set +x` 防止 debug tracing leak PAT
- Telemetry payload 只包含 enumerated categorical values（scenario、install result、MCP opt-in、trust tier），永不包含可能有 secrets 的 free-form strings

**通过 tests enforcement：**

- `test/secret-sink-harness.test.ts` 会用 seeded secret 运行每个 secret-handling bin，并 assert 该 seed 不出现在任何 captured channel（stdout、stderr、`$HOME` 下 files、telemetry JSONL）。每个 seed 有四个 match rules：exact、URL-decoded、first-12-char prefix、base64。
- 同一 test file 中的 positive controls 会故意在每个 covered channel leak seeds，并 assert harness 捕获每一个。没有 positive controls 时，一个 silently under-reports 的 harness 看起来会和 working harness 一样。

**你仍可能 leak 什么**（v1 的诚实 limits）：

- 如果你把 secret 粘贴到 `read -s` 之外的普通 chat message 中，它会进入 conversation transcript 和任何 host-side logging
- Leak harness 不 dump subprocess environment，因此执行 `env >> ~/.log` 的 bin 会 evade detection（v1 中没有 bin 这么做；grep tests 会阻止）
- 你的 shell 自己的 `HISTFILE` behavior 属于你的 shell，不属于我们。我们永远不会把 secrets 传给 argv，因此它们不会通过我们的 code 落到那里，但没有什么能阻止你自己把 secret 粘贴进 raw `curl` command

## 故障排查

### Install 时出现 "PATH SHADOWING DETECTED"

另一个 `gbrain` binary 在 PATH 中早于 installer 刚 link 的 binary。Installer 的 version check 捕获到了它。任选一种方式修复：

- 如果不需要另一个，运行 `rm $(which gbrain)`
- 在 shell rc 中把 `~/.bun/bin` prepend 到 PATH，让 linked binary 获胜
- 把 `GBRAIN_INSTALL_DIR` 设为 shadowing binary 的 install directory，然后 re-run

然后重新运行 `/setup-gbrain`。

### "rejected direct-connection URL"

你粘贴了 `db.<ref>.supabase.co:5432` URL。这些是 IPv6-only，在大多数 environments 中会失败。改用 Session Pooler URL：Supabase dashboard -> Settings -> Database -> Connection Pooler -> **Session** -> copy URI（port 6543）。

### Auto-provision 在 180s timeout

Supabase project 仍在 initializing。Exit message 中已打印 ref。等一分钟，然后：

```bash
/setup-gbrain --resume-provision <ref>
```

Skill 会重新收集 PAT，跳过 project creation，并 resume polling。

### "Another `/setup-gbrain` instance is running"

你有 stale lock directory。如果确定没有其他 instance 实际运行：

```bash
rm -rf ~/.gstack/.setup-gbrain.lock.d
```

然后重新运行。

### Policy file 上出现 "No cross-model tension"

你手动编辑了 `~/.gstack/gbrain-repo-policy.json`，并用了 legacy `allow` values？没问题。下一次读取时，gstack 会 auto-migrate `allow` -> `read-write`，并添加 `_schema_version: 2`。stderr 上一行 log，idempotent、deterministic。

### `gbrain doctor` 显示 "warnings"

`/health` 把它当作 yellow，不是 red。运行 `gbrain doctor --json | jq .checks` 查看哪些 sub-checks 是 warning。典型原因：resolver MECE overlap（skill names clashing）或 DB connection 尚未 configured。

### `/sync-gbrain` reports `OK` 但 `gbrain search` 不返回 semantic 结果

Embeddings 可能在 import 期间 failed。Symbol queries（`code-def`、`code-refs`）仍可工作，因为它们不需要 embeddings，但 `gbrain search "<terms>"` 会 fallback 到 degraded BM25 path。查看 sync output 中类似这样的 lines：

```
[gbrain] embedding failed for code file <name>: OpenAI embedding requires OPENAI_API_KEY
```

修复方法是在 re-running 前把 provider API key 放进 process env。Code 首选 `VOYAGE_API_KEY`（设置时，gstack 默认让 PGLite 使用 `voyage-code-3`）；否则 `OPENAI_API_KEY` fallback 到 `text-embedding-3-large`。在 bare Mac shell 上，调用前从 `~/.zshrc` source key。在 Conductor 中，`lib/conductor-env-shim.ts` shim 会自动把 `GSTACK_ANTHROPIC_API_KEY` / `GSTACK_OPENAI_API_KEY` 提升为 canonical names；对于 `VOYAGE_API_KEY`，请直接在 Conductor workspace env 中设置。重新运行 `/sync-gbrain --code-only`，为已经 imported pages backfill embeddings。

### `gbrain sync` blocked at a commit hash — `FILE_TOO_LARGE`

Tree 中有 file 超过 gbrain 的 5 MB hard limit（`gbrain/src/core/import-file.ts` 中的 `MAX_FILE_SIZE`）。常见 culprits：response replay caches、captured screenshots、large JSON fixtures。Gbrain 对 code sync 不 honor `.gitignore`-style exclude lists；唯一 knob 是 acknowledge 这个 failure：

```bash
gbrain sync --source <source-id> --skip-failed
```

Watermark 会越过 offending commit。如果同一个 file 改动，它会再次 fail；那时重新 skip。

### Switching PGLite -> Supabase hangs

Sibling Conductor workspace 中的另一个 gstack session 可能通过其 preamble 中的 `gstack-brain-sync` call 持有 local PGLite file 上的 lock。关闭其他 workspaces，重新运行 `/setup-gbrain --switch`。Timeout bounded at 180s，所以你不会真的永远等待。

## 为什么这样设计

**为什么是 per-remote trust triad，而不是 binary allow/deny？** Multi-client consultants 需要 search without write-back。一个上午为 Client A、下午为 Client B 工作的 freelance dev，不能让 A 的 code insights leak 到 Client B 可以搜索的 brain 中。Read-only 干净地解决这个问题。

**为什么不把 gbrain bundle 到 gstack？** Gbrain 是单独且 actively-developed 的 project，有自己的 release cadence、schema migrations 和 MCP surface。Bundling 意味着 gstack 必须 gate gbrain updates，会减慢 gbrain improvements 到达 users 的速度。Separate-but-integrated 让两者按各自 cadence ship。

**为什么通过 env var 使用 `gbrain init --non-interactive`，而不是 flag？** Connection strings 包含 database passwords。作为 argv 传入会让 password 落入 `ps`、shell history 和 process listings。Env-var handoff 让 secret 只保留在 process memory 中。Gbrain 同时支持 `GBRAIN_DATABASE_URL` 和 `DATABASE_URL`；我们使用前者以避免和 non-gbrain tooling collision。

**为什么 PATH shadowing 时 fail-hard，而不是 warn-and-continue？** Shadowed `gbrain` 意味着后续每个 command 调用的 binary 都不是我们刚安装的那个。这是 silent version-drift bug，几周后会表现为神秘的 feature gaps。Setup skills 只有一个 job：set up a working environment。拒绝安装到 broken environment 是 setup-skill-correct behavior。

**为什么不 auto-import every repo？** Privacy + noise。一个 ingest 你接触的每个 repo 的 auto-import preamble hook 会：（a）未经 consent 把 work code leak 到 shared brain；（b）用 throwaway repos clog search。Per-remote policy 让 ingestion 成为 explicit、per-repo decision。`/setup-gbrain` 今天不会安装任何 auto-import hook，但 policy store 为未来兼容。

## 相关 skills 与下一步

- `/health`：在 0-10 composite score 中包含 GBrain dimension（doctor status、sync queue depth、last-push age）。未安装 gbrain 时省略该 dimension；在 non-gbrain machine 上运行 `/health` 不会惩罚这个选择。
- `/gstack-upgrade`：让 gstack 本身保持 up to date。不会独立 upgrade gbrain。gbrain 默认安装 latest HEAD；要刷新它，请在 gbrain clone（默认 `~/gbrain`）中 `git pull`，然后重新运行 `/setup-gbrain`。如需 reproducibility，可用 `gstack-gbrain-install --pinned-commit <sha>` pin specific commit。低于 minimum tested version 的 installs 会被拒绝。
- `/retro`：当 memory sync 开启时，weekly retrospective 会从 gbrain 拉取 learnings 和 plans，让 retro 能 reference cross-machine history。

运行 `/setup-gbrain`，看看哪些东西留下来。
