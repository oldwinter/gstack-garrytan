# 为 gstack 贡献

感谢你愿意让 gstack 变得更好。无论你只是修一个 skill prompt 里的 typo，还是要构建一个全新的 workflow，这份指南都会帮你快速跑起来。

## 快速开始

gstack skills 是 Markdown 文件，Claude Code 会从 `skills/` 目录发现它们。通常它们位于 `~/.claude/skills/gstack/`（你的 global install）。但当你开发 gstack 本身时，你希望 Claude Code 使用 *working tree* 里的 skills，这样编辑可以立即生效，不需要复制或部署。

这就是 dev mode 的作用。它会把你的 repo symlink 到本地 `.claude/skills/` 目录，让 Claude Code 直接从 checkout 读取 skills。

```bash
git clone https://github.com/garrytan/gstack.git && cd gstack
bun install                    # 安装依赖
bin/dev-setup                  # 激活 dev mode
```

> **Full clone vs shallow。** README 面向用户的安装为了速度使用 `--depth 1`。作为 contributor，请使用 full clone（不带 `--depth` flag），因为你会需要 `git log`、`git blame`、`git bisect` 的历史，以及基于旧版本 review PR。如果你已经按 README 做了 `--depth 1` clone，可以用 `git fetch --unshallow` 提升为 full clone。

现在编辑任意 `SKILL.md`，在 Claude Code 中调用它（例如 `/review`），就能实时看到变更。开发完成后：

```bash
bin/dev-teardown               # 停用，回到 global install
```

## Operational self-improvement（运行中的自我改进）

gstack 会自动从失败中学习。每个 skill session 结束时，agent 会反思哪里出了问题（CLI errors、错误方法、项目 quirks），并把 operational learnings 记录到 `~/.gstack/projects/{slug}/learnings.jsonl`。未来 sessions 会自动浮现这些 learnings，让 gstack 随着使用对你的 codebase 越来越聪明。

不需要额外 setup。Learnings 会自动记录。用 `/learn` 查看。

### Contributor workflow（贡献者工作流）

1. **正常使用 gstack**，operational learnings 会自动捕获。
2. **检查 learnings：**`/learn` 或 `ls ~/.gstack/projects/*/learnings.jsonl`。
3. **Fork 并 clone gstack**（如果还没有）。
4. **把你的 fork symlink 到触发 bug 的项目中：**
   ```bash
   # 在你的 core project 中（也就是 gstack 惹你烦的那个项目）
   ln -sfn /path/to/your/gstack-fork .claude/skills/gstack
   cd .claude/skills/gstack && bun install && bun run build && ./setup
   ```
   Setup 会创建每个 skill 的目录，并在里面放 SKILL.md symlink（`qa/SKILL.md -> gstack/qa/SKILL.md`），然后询问你的 prefix preference。传 `--no-prefix` 可跳过 prompt 并使用短名称。
5. **修复问题**，你的改动会立即在这个项目中生效。
6. **通过真实使用 gstack 来测试**，重做让你烦的那件事，确认它已修好。
7. **从你的 fork 打开 PR。**

这是最好的贡献方式：在你真实工作的项目里、真实感到痛点的地方修复 gstack。

### Session awareness（session 感知）

当你同时打开 3+ 个 gstack sessions 时，每个问题都会告诉你是哪个项目、哪个 branch、正在发生什么。不需要再盯着问题想“等等，这是哪个窗口？”所有 skills 的格式一致。

## 在 gstack repo 内开发 gstack

当你编辑 gstack skills，并希望在同一个 repo 中通过实际使用 gstack 来测试时，`bin/dev-setup` 会完成 wiring。它创建 `.claude/skills/` symlinks（gitignored），指回你的 working tree，因此 Claude Code 会使用你的本地编辑，而不是 global install。

```
gstack/                          <- your working tree
├── .claude/skills/              <- created by dev-setup (gitignored)
│   ├── gstack -> ../../         <- symlink back to repo root
│   ├── review/                  <- real directory (short name, default)
│   │   └── SKILL.md -> gstack/review/SKILL.md
│   ├── ship/                    <- or gstack-review/, gstack-ship/ if --prefix
│   │   └── SKILL.md -> gstack/ship/SKILL.md
│   └── ...                      <- one directory per skill
├── review/
│   └── SKILL.md                 <- edit this, test with /review
├── ship/
│   └── SKILL.md
├── browse/
│   ├── src/                     <- TypeScript source
│   └── dist/                    <- compiled binary (gitignored)
└── ...
```

Setup 会在顶层创建真实目录（不是 symlinks），并在里面放一个 SKILL.md symlink。这能确保 Claude 把它们发现为 top-level skills，而不是嵌套在 `gstack/` 下面。名称取决于你的 prefix setting（`~/.gstack/config.yaml`）。短名称（`/review`、`/ship`）是默认值。如果你更喜欢 namespaced names（`/gstack-review`、`/gstack-ship`），运行 `./setup --prefix`。

## 日常 workflow

```bash
# 1. 进入 dev mode
bin/dev-setup

# 2. 编辑一个 skill
vim review/SKILL.md

# 3. 在 Claude Code 中测试，改动会实时生效
#    > /review

# 4. 改了 browse source？重新构建 binary
bun run build

# 5. 今天结束？清理 dev mode
bin/dev-teardown
```

### Dev workspace 中的 brain-aware blocks（已安装 gbrain）

如果 gbrain 已安装且可用（`bin/gstack-gbrain-detect --is-ok` exit 0），
`bin/dev-setup` 会保持 tracked `SKILL.md` files 为 canonical，同时把
brain-aware variant（`GBRAIN_CONTEXT_LOAD` / `GBRAIN_SAVE_RESULTS` blocks）
渲染到 `.claude/gstack-rendered/`（gitignored，per-workspace）。随后它会把
workspace 的 `SKILL.md` symlinks 指向该 render，让 Claude sessions 获得完整
gbrain experience，同时保持 `git status` 干净。底层实现是：dev-setup 给嵌套
`./setup` inline 传入 `GSTACK_SKIP_GBRAIN_REGEN=1`（避免 dirty tracked source），
并运行 `gen:skill-docs:user --out-dir .claude/gstack-rendered`，只把 section-base
paths 改指向该 render。`bin/dev-teardown` 会移除 render。要让这些 blocks 在其他
projects 的 Claude sessions 中生效，运行 `gstack-config gbrain-refresh`；它会把它们
渲染进 global install（`~/.claude/skills/gstack`），并通过 guard 确保不会碰
symlinked 或 non-gstack directory。

## Testing & evals（测试与 evals）

### Setup（设置）

```bash
# 1. 复制 .env.example 并添加你的 API key
cp .env.example .env
# 编辑 .env -> 设置 ANTHROPIC_API_KEY=sk-ant-...

# 2. 安装 deps（如果还没装）
bun install
```

Bun 会自动加载 `.env`，不需要额外配置。Conductor workspaces 会自动从 main worktree 继承 `.env`（见下方 “Conductor workspaces”）。

### Test tiers（测试层级）

| Tier | Command | Cost | 测试内容 |
|------|---------|------|----------|
| 1 — Static | `bun test` | Free | Command validation、snapshot flags、SKILL.md correctness、TODOS-format.md refs、observability unit tests |
| 2 — E2E | `bun run test:e2e` | ~$3.85 | 通过 `claude -p` subprocess 执行完整 skill |
| 3 — LLM eval | `bun run test:evals` | ~$0.15 standalone | 对生成的 SKILL.md docs 做 LLM-as-judge 评分 |
| 2+3 | `bun run test:evals` | ~$4 combined | E2E + LLM-as-judge（两者都运行） |

```bash
bun test                     # 仅 Tier 1（每次 commit 前运行，<5s）
bun run test:e2e             # Tier 2：仅 E2E（需要 EVALS=1，不能在 Claude Code 内运行）
bun run test:evals           # Tier 2 + 3 combined（~$4/run）
```

### Tier 1: Static validation（free）

`bun test` 会自动运行。无需 API keys。

- **Skill parser tests**（`test/skill-parser.test.ts`）：从 SKILL.md bash code blocks 中抽取每个 `$B` command，并对照 `browse/src/commands.ts` 中的 command registry 校验。捕捉 typo、已移除 commands 和无效 snapshot flags。
- **Skill validation tests**（`test/skill-validation.test.ts`）：校验 SKILL.md 文件只引用真实 commands 和 flags，并检查 command descriptions 达到质量阈值。
- **Generator tests**（`test/gen-skill-docs.test.ts`）：测试 template system，确认 placeholders 正确 resolve，输出包含 flags 的 value hints（例如 `-d <N>` 而不是只有 `-d`），并对关键 commands 提供丰富描述（例如 `is` 列出 valid states，`press` 列出 key examples）。

### Tier 2: E2E via `claude -p`（~$3.85/run）

以 subprocess 生成 `claude -p`，使用 `--output-format stream-json --verbose`，实时 stream NDJSON，并扫描 browse errors。这最接近“这个 skill 是否真的端到端工作？”

```bash
# 必须从普通 terminal 运行，不能嵌套在 Claude Code 或 Conductor 内
EVALS=1 bun test test/skill-e2e-*.test.ts
```

- 由 `EVALS=1` env var gate，防止意外产生费用。
- 如果在 Claude Code 内运行会自动 skip（`claude -p` 不能嵌套）。
- API connectivity pre-check 会在烧预算前快速失败。
- 实时进度写到 stderr：`[Ns] turn T tool #C: Name(...)`。
- 保存完整 NDJSON transcripts 和 failure JSON，便于 debug。
- 测试位于 `test/skill-e2e-*.test.ts`（按类别拆分），runner logic 在 `test/helpers/session-runner.ts`。

### E2E observability（E2E 可观测性）

E2E tests 运行时，会在 `~/.gstack-dev/` 中生成 machine-readable artifacts：

| Artifact | Path | Purpose |
|----------|------|---------|
| Heartbeat | `e2e-live.json` | 当前 test status（每次 tool call 更新） |
| Partial results | `evals/_partial-e2e.json` | 已完成 tests（能 survive kills） |
| Progress log | `e2e-runs/{runId}/progress.log` | Append-only text log |
| NDJSON transcripts | `e2e-runs/{runId}/{test}.ndjson` | 每个 test 的原始 `claude -p` 输出 |
| Failure JSON | `e2e-runs/{runId}/{test}-failure.json` | 失败时的 diagnostic data |

**Live dashboard：**在第二个 terminal 运行 `bun run eval:watch`，可看到 completed tests、currently running test 和 cost。加 `--tail` 可显示 progress.log 最后 10 行。

**Eval history tools：**

```bash
bun run eval:list            # 列出所有 eval runs（turns、duration、cost per run）
bun run eval:compare         # 比较两次 run，显示 per-test deltas + Takeaway commentary
bun run eval:summary         # 汇总 stats + 跨 runs 的 per-test efficiency averages
```

**Eval comparison commentary：**`eval:compare` 会生成自然语言 Takeaway sections，解释两次 run 之间的变化：标记 regressions、说明 improvements、指出 efficiency gains（更少 turns、更快、更便宜），并给出 overall summary。由 `eval-store.ts` 中的 `generateCommentary()` 驱动。

Artifacts 不会自动清理，会累积在 `~/.gstack-dev/` 中，供 post-mortem debugging 和 trend analysis 使用。

### Tier 3: LLM-as-judge（~$0.15/run）

使用 Claude Sonnet 从三个维度给生成的 SKILL.md docs 打分：

- **Clarity**：AI agent 能否无歧义地理解指令？
- **Completeness**：是否记录了所有 commands、flags 和 usage patterns？
- **Actionability**：agent 能否只凭文档信息执行任务？

每个维度评分 1-5。阈值：每个维度都必须 **≥ 4**。还有一个 regression test，会把生成文档与 `origin/main` 中的 hand-maintained baseline 比较，生成结果必须同分或更高。

```bash
# 需要 .env 中的 ANTHROPIC_API_KEY；包含在 bun run test:evals 中
```

- 使用 `claude-sonnet-4-6` 保证 scoring stability。
- 测试位于 `test/skill-llm-eval.test.ts`。
- 直接调用 Anthropic API（不是 `claude -p`），所以包括 Claude Code 内在内的任何地方都能运行。

### CI（持续集成）

GitHub Action（`.github/workflows/skill-docs.yml`）会在每次 push 和 PR 上运行 `bun run gen:skill-docs --dry-run`。如果生成的 SKILL.md 文件与 committed 文件不同，CI 会失败。这样可以在 merge 前捕捉 stale docs。

Tests 直接针对 browse binary 运行，不需要 dev mode。

## 编辑 SKILL.md 文件

SKILL.md 文件由 `.tmpl` templates **生成**。不要直接编辑 `.md`，下一次 build 会覆盖你的改动。

```bash
# 1. 编辑模板
vim SKILL.md.tmpl              # 或 browse/SKILL.md.tmpl

# 2. 为所有 hosts 重新生成
bun run gen:skill-docs --host all

# 3. 检查 health（报告所有 hosts）
bun run skill:check

# 或使用 watch mode，保存时自动重新生成
bun run dev:skill
```

Template authoring best practices（自然语言优先于 bash-isms、动态 branch detection、`{{BASE_BRANCH_DETECT}}` 用法）见 CLAUDE.md 的 “Writing SKILL templates” section。

新增 browse command 时，把它加到 `browse/src/commands.ts`。新增 snapshot flag 时，把它加到 `SNAPSHOT_FLAGS`（`browse/src/snapshot.ts`）。然后重新构建。

**不要在 skill 中捆绑自己的 puppeteer/Chromium。** `browse` 是每台机器上共享的
Chromium，也覆盖 offline local-render workloads。需要 rasterize 自己的 HTML/JSON
（diagrams、cards、og-images）的 skill 应通过 `browse`：visual output 用
`screenshot --selector`，render function 返回 bytes 时用 `load-html` + `js --out`。
不要 `npm i puppeteer` 再下载第二份可能版本漂移的 Chromium。只需要 pin 一个 install、
管理一个 daemon。

## Jargon list（V1 writing style）

gstack 的 Writing Style section（注入到每个 tier-≥2 skill 的 preamble）会在每次 skill invocation 中首次出现时解释技术术语。需要解释的术语列表位于 `scripts/jargon-list.json`，约 50 个精选高频术语（idempotent、race condition、N+1、backpressure 等）。不在列表中的术语会被认为足够 plain-English。

**新增或移除术语：**打开一个 PR 修改 `scripts/jargon-list.json`。修改后运行 `bun run gen:skill-docs`，术语会在 gen time baked into 每个生成的 SKILL.md，因此只有重新生成后才生效。没有 runtime loading，也没有 user-side override。Repo list 是 source of truth。

适合新增的术语：非技术用户在 review output 中常见但缺少上下文的高频术语（常见 database/concurrency terminology、security jargon、frontend framework concepts）。不要添加只出现在一两个 niche skills 中的术语，cost-to-value 不值得 review overhead。

## Multi-host development（多 host 开发）

gstack 从同一组 `.tmpl` templates 为 8 个 hosts 生成 SKILL.md 文件。每个 host 都是 `hosts/*.ts` 中的 typed config。Generator 读取这些 configs，生成 host-appropriate output（不同 frontmatter、paths、tool names）。

**Supported hosts:** Claude（primary）、Codex、Factory、Kiro、OpenCode、Slate、Cursor、OpenClaw。

### 为所有 hosts 生成

```bash
# 为特定 host 生成
bun run gen:skill-docs                    # Claude (default)
bun run gen:skill-docs --host codex       # Codex
bun run gen:skill-docs --host opencode    # OpenCode
bun run gen:skill-docs --host all         # All 8 hosts

# 或使用 build：生成所有 hosts 并编译 binaries
bun run build
```

### Hosts 之间的差异

每个 host config（`hosts/*.ts`）控制：

| Aspect | Example（Claude vs Codex） |
|--------|-----------------------------|
| Output directory | `{skill}/SKILL.md` vs `.agents/skills/gstack-{skill}/SKILL.md` |
| Frontmatter | Full（name、description、hooks、version）vs minimal（name + description） |
| Paths | `~/.claude/skills/gstack` vs `$GSTACK_ROOT` |
| Tool names | "use the Bash tool" vs same（Factory 改写为 "run this command"） |
| Hook skills | `hooks:` frontmatter vs inline safety advisory prose |
| Suppressed sections | None vs Codex self-invocation sections stripped |

完整 `HostConfig` interface 见 `scripts/host-config.ts`。

### Testing host output（测试 host 输出）

```bash
# 运行所有 static tests（包含所有 hosts 的 parameterized smoke tests）
bun test

# 检查所有 hosts 的 freshness
bun run gen:skill-docs --host all --dry-run

# Health dashboard 覆盖所有 hosts
bun run skill:check
```

### 添加新 host

完整指南见 [docs/ADDING_A_HOST.md](docs/ADDING_A_HOST.md)。简版：

1. 创建 `hosts/myhost.ts`（从 `hosts/opencode.ts` 复制）。
2. 添加到 `hosts/index.ts`。
3. 把 `.myhost/` 加到 `.gitignore`。
4. 运行 `bun run gen:skill-docs --host myhost`。
5. 运行 `bun test`（parameterized tests 会自动覆盖它）。

不需要修改 generator、setup 或 tooling code。

### 添加新 skill

添加新 skill template 时，所有 hosts 都会自动获得：

1. 创建 `{skill}/SKILL.md.tmpl`。
2. 运行 `bun run gen:skill-docs --host all`。
3. Dynamic template discovery 会自动发现它，不需要更新 static list。
4. Commit `{skill}/SKILL.md`；external host output 在 setup time 生成并 gitignored。

## Conductor workspaces（Conductor workspaces）

如果你使用 [Conductor](https://conductor.build) 并行运行多个 Claude Code sessions，`conductor.json` 会自动 wiring workspace lifecycle：

| Hook | Script | 作用 |
|------|--------|------|
| `setup` | `bin/dev-setup` | 从 main worktree 复制 `.env`、安装 deps、symlink skills、非交互运行 `./setup`，并在已安装 gbrain 时把 brain-aware blocks 渲染到 `.claude/gstack-rendered/`，不 dirty tracked source |
| `archive` | `bin/dev-teardown` | 移除 skill symlinks、`.claude/gstack-rendered/` render，并清理 `.claude/` 目录 |

Conductor 创建新 workspace 时，`bin/dev-setup` 会自动运行。它会检测 main worktree（通过 `git worktree list`），复制 `.env` 以带上 API keys，并设置 dev mode，不需要手动步骤。

`bin/dev-setup` 会完全非交互地运行 `./setup`（传 `--plan-tune-hooks=prompt` 并关闭 stdin），因此 forwarded Conductor TTY 永远不会卡在隐藏 setup prompt 上。它也永远不会安装 plan-tune Claude Code hooks，这意味着 throwaway workspace 不能把你的 global `~/.claude/settings.json` 改写为指向 ephemeral worktree path。要有意安装 plan-tune hooks，请在 dev-setup 外运行 `./setup --plan-tune-hooks`（或 `gstack-config set plan_tune_hooks yes`）。

**首次 setup：**把你的 `ANTHROPIC_API_KEY` 放进 main repo 的 `.env`（见 `.env.example`）。每个 Conductor workspace 会自动继承它。

**`GSTACK_*` env prefix（Conductor-injected keys）。** Conductor 会从每个 workspace 的 process env 中显式剥离 `ANTHROPIC_API_KEY` 和 `OPENAI_API_KEY`。`.env` 复制路径也无法恢复它们，因为剥离发生在 env inheritance 之后。想让 paid evals、`/sync-gbrain` embeddings 或 `claude-agent-sdk` calls 在 Conductor workspace 中工作，必须在 Conductor workspace env config 中设置 `GSTACK_ANTHROPIC_API_KEY` 和 `GSTACK_OPENAI_API_KEY`；Conductor 会原样传入。gstack 侧的 TS entry points 会以 side effect import `lib/conductor-env-shim.ts`，当 canonical name 为空时将 `GSTACK_FOO_API_KEY` 提升为 `FOO_API_KEY`。如果你添加会调用付费 API 的新 TS entry point，请在文件顶部添加 `import "../lib/conductor-env-shim";`。当前 shim 被 `bin/gstack-gbrain-sync.ts`、`bin/gstack-model-benchmark`、`scripts/preflight-agent-sdk.ts` 和 `test/helpers/e2e-helpers.ts` import。

## 需要知道的事

- **SKILL.md files are generated.** 编辑 `.tmpl` template，不要编辑 `.md`。运行 `bun run gen:skill-docs` 重新生成。
- **TODOS.md 是统一 backlog。** 按 skill/component 组织，使用 P0-P4 priorities。`/ship` 会自动检测 completed items。所有 planning/review/retro skills 都会读取它作为 context。
- **Browse source changes need a rebuild.** 如果改了 `browse/src/*.ts`，运行 `bun run build`。
- **Dev mode shadows your global install.** Project-local skills 优先于 `~/.claude/skills/gstack`。`bin/dev-teardown` 会恢复 global one。
- **Conductor workspaces are independent.** 每个 workspace 都是自己的 git worktree。`bin/dev-setup` 会通过 `conductor.json` 自动运行。
- **`.env` propagates across worktrees.** 在 main repo 设置一次，所有 Conductor workspaces 都会获得它。
- **`.claude/skills/` is gitignored.** Symlinks 永远不会 commit。
- **Never write raw `ln -snf` in `setup`.** `setup` 中每个 link site 都必须通过 `IS_WINDOWS` detection 附近的 `_link_or_copy SRC DST` helper。该 helper 在 Unix 上保留 `ln -snf`，在没有 Developer Mode 的 Windows 上切换为 `cp -R` / `cp -f`；普通 `ln -snf` 在那里会产生不会随 `git pull` 刷新的 frozen file copies。`test/setup-windows-fallback.test.ts` 用 static invariant 强制这一点：helper body 外任何单个 raw `ln` 调用都会让 CI 失败。

## 在真实项目中测试你的变更

**这是推荐的 gstack 开发方式。**把你的 gstack checkout symlink 到你真实使用它的项目中，这样改动会在真实工作时立即生效。

### Step 1: Symlink your checkout（链接你的 checkout）

```bash
# 在你的 core project 中（不是 gstack repo）
ln -sfn /path/to/your/gstack-checkout .claude/skills/gstack
```

### Step 2: 运行 setup 创建 per-skill symlinks

单独的 `gstack` symlink 不够。Claude Code 通过独立 top-level directories（`qa/SKILL.md`、`ship/SKILL.md` 等）发现 skills，而不是通过 `gstack/` 目录本身。运行 `./setup` 创建它们：

```bash
cd .claude/skills/gstack && bun install && bun run build && ./setup
```

Setup 会询问你想用短名称（`/qa`）还是 namespaced（`/gstack-qa`）。选择会保存到 `~/.gstack/config.yaml` 并在未来 runs 中记住。要跳过 prompt，传 `--no-prefix`（短名称）或 `--prefix`（namespaced）。

### Step 3: Develop（开发）

编辑 template，运行 `bun run gen:skill-docs`，下一次 `/review` 或 `/qa` 调用就会立即使用它。不需要重启。

### 回到稳定 global install

移除 project-local symlink。Claude Code 会 fallback 到 `~/.claude/skills/gstack/`：

```bash
rm .claude/skills/gstack
```

per-skill directories（`qa/`、`ship/` 等）包含指向 `gstack/...` 的 SKILL.md symlinks，因此会自动解析到 global install。

### Switching prefix mode（切换 prefix mode）

如果你安装 gstack 时使用了某个 prefix setting，后来想切换：

```bash
cd .claude/skills/gstack && ./setup --no-prefix   # switch to /qa, /ship
cd .claude/skills/gstack && ./setup --prefix       # switch to /gstack-qa, /gstack-ship
```

Setup 会自动清理旧 symlinks。无需手动清理。

### Alternative: point your global install at a branch（替代方案：让 global install 指向某个 branch）

如果你不想使用 per-project symlinks，也可以切换 global install：

```bash
cd ~/.claude/skills/gstack
git fetch origin
git checkout origin/<branch>
bun install && bun run build && ./setup
```

这会影响所有项目。要恢复：`git checkout main && git pull && bun run build && ./setup`。

## Community PR triage（wave process）

当 community PRs 积累起来时，把它们按主题分批处理：

1. **Categorize**：按主题分组（security、features、infra、docs）。
2. **Deduplicate**：如果两个 PR 修同一件事，选改动行数更少的那个。关闭另一个，并留言指向胜出者。
3. **Collector branch**：创建 `pr-wave-N`，merge 干净 PR，解决 dirty PR 的 conflicts，用 `bun test && bun run build` 验证。
4. **Close with context**：每个关闭的 PR 都要留言说明为什么关闭，以及（如果有）什么替代了它。Contributors 付出了真实工作，要用清晰沟通尊重他们。
5. **Ship as one PR**：对 main 开一个单独 PR，保留所有 attributions 到 merge commits。包含一个 summary table，列出 merge 了什么、关闭了什么。

第一波示例见 [PR #205](../../pull/205)（v0.8.3）。

## Upgrade migrations（升级迁移）

当某个 release 改变 on-disk state（目录结构、config 格式、stale files），且 `./setup` 本身无法修复时，添加 migration script，让现有用户获得干净升级。

### 什么时候添加 migration

- 改变了 skill directories 创建方式（symlinks vs real dirs）。
- 重命名或移动了 `~/.gstack/config.yaml` 中的 config keys。
- 需要删除旧版本留下的 orphaned files。
- 改变了 `~/.gstack/` state files 的格式。

不要为以下情况添加 migration：新功能（用户会自动获得）、新 skills（setup 会发现它们）、或纯代码变更（无 on-disk state）。

### 如何添加

1. 创建 `gstack-upgrade/migrations/v{VERSION}.sh`，其中 `{VERSION}` 匹配需要修复的 release 的 VERSION 文件。
2. 使其可执行：`chmod +x gstack-upgrade/migrations/v{VERSION}.sh`。
3. 脚本必须是 **idempotent**（多次运行安全）且 **non-fatal**（失败会记录但不阻塞升级）。
4. 在顶部包含 comment block，说明改了什么、为什么需要 migration、影响哪些用户。

Example:

```bash
#!/usr/bin/env bash
# Migration: v0.15.2.0 — 修复 skill directory structure
# Affected: 使用 --no-prefix 安装旧版本的用户（v0.15.2.0 之前）
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
"$SCRIPT_DIR/bin/gstack-relink" 2>/dev/null || true
```

### 如何运行

在 `/gstack-upgrade` 期间，`./setup` 完成后（Step 4.75），upgrade skill 会扫描 `gstack-upgrade/migrations/`，并运行所有版本新于用户旧版本的 `v*.sh` scripts。Scripts 按版本顺序运行。失败会记录，但不会阻塞升级。

### Testing migrations（测试 migrations）

Migrations 作为 `bun test` 的一部分测试（tier 1，free）。Test suite 会验证 `gstack-upgrade/migrations/` 中所有 migration scripts 都可执行且没有 shell syntax errors。

## Shipping your changes（发布你的变更）

当你满意自己的 skill edits：

```bash
/ship
```

这会运行 tests、review diff、triage Greptile comments（带 2-tier escalation）、管理 TODOS.md、bump version，并打开 PR。完整 workflow 见 `ship/SKILL.md`。
