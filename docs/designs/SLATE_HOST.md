# Slate Host Integration — Research & Design Doc（研究与设计文档）

**Date（日期）：** 2026-04-02
**Branch（分支）：** garrytan/slate-agent-support
**Status（状态）：** Research complete，blocked on host config refactor
**Supersedes（取代）：** None

## Slate 是什么

Slate 是 Random Labs 的 proprietary coding agent CLI。
Install：`npm i -g @randomlabs/slate` 或 `brew install anthropic/tap/slate`。
License：Proprietary。85MB compiled Bun binary（arm64/x64，darwin/linux/windows）。
npm package：`@randomlabs/slate@1.0.25`（thin 8.8KB launcher + platform-specific optional deps）。

Multi-model：动态选择 Claude Sonnet/Opus/Haiku，以及其他 models。
为带 extended multi-hour sessions 的 "swarm orchestration" 构建。

## Slate 是 OpenCode fork

**通过 85MB Mach-O arm64 binary 的 binary strings analysis confirmed：**

- Internal name：`name: "opencode"`（binary 中 literal string）
- 所有 `OPENCODE_*` env vars 与 `SLATE_*` equivalents 同时存在
- 共享 OpenCode 的 tool/skill architecture、LSP integration、terminal management
- 自有 branding、API endpoints（`api.randomlabs.ai`、`agent-worker-prod.randomlabs.workers.dev`）和 config paths

这对 integration 很重要：OpenCode conventions 基本适用，但 Slate 在其上添加自己的 paths 和 env vars。

## Skill Discovery（从 binary 确认）

Slate 会 scan 全部四个 directory families 查找 skills。Binary 中的 error messages confirm：

```
"failed .slate directory scan for skills"
"failed .claude directory scan for skills"
"failed .agents directory scan for skills"
"failed .opencode directory scan for skills"
```

**Discovery paths（发现路径，来自 Slate docs 的 priority order）：**

1. `.slate/skills/<name>/SKILL.md`：project-level，highest priority
2. `~/.slate/skills/<name>/SKILL.md`：global
3. `.opencode/skills/`、`.agents/skills/`：compatibility fallback
4. `.claude/skills/`：Claude Code compatibility fallback（lowest）
5. Custom paths via `slate.json`

**Glob patterns（匹配模式）：** `**/SKILL.md` 和 `{skill,skills}/**/SKILL.md`

**Commands（命令）：** 相同 directory structure，但位于 `commands/` subdirs：
`/.slate/commands/`、`/.claude/commands/`、`/.agents/commands/`、`/.opencode/commands/`

**Skill frontmatter（skill 前置元数据）：** YAML，包含 `name` 和 `description` fields（per Slate docs）。
两者都没有 documented length limits。

## 项目说明

Slate 会读取 `CLAUDE.md` 和 `AGENTS.md` 作为 project instructions。
两个 literal strings 都已在 binary 中 confirmed。现有 gstack projects 不需要 changes，CLAUDE.md works as-is。

## 配置

**Config file（配置文件）：** `slate.json` / `slate.jsonc`（不是 opencode.json）

**配置选项（from Slate docs）：**
- `privacy`（boolean）：disable telemetry/logging
- Permissions：per tool 的 `allow`、`ask`、`deny`（`read`、`edit`、`bash`、`grep`、`webfetch`、`websearch`、`*`）
- Model slots：`models.main`、`models.subagent`、`models.search`、`models.reasoning`
- MCP servers：local 或 remote，带 custom commands 和 headers
- Custom commands：带 templates 的 `/commands`

Setup script 不应 create `slate.json`。Users configure their own permissions。

## CLI Flags（Headless Mode，无头模式）

```
--stream-json / --output-format stream-json  — JSONL output, "compatible with Anthropic Claude Code SDK"
--dangerously-skip-permissions               — bypass all permission checks (CI/automation)
--input-format stream-json                   — programmatic input
-q                                           — non-interactive mode
-w <dir>                                     — workspace directory
--output-format text                         — plain text output (default)
```

**Stream-JSON format（格式）：** Slate docs 声称 "compatible with Anthropic Claude Code SDK"。尚未 empirically verified。考虑到 OpenCode heritage，可能匹配 Claude Code 的 NDJSON event schema（type: "assistant"、type: "tool_result"、type: "result"）。

**Need to verify（待验证）：** 使用 valid credits 运行 `slate -q "hello" --stream-json`，capture actual JSONL events，然后再构建 session runner parser。

## Environment Variables（环境变量，from binary strings）

### Slate-specific（Slate 专属）
```
SLATE_API_KEY                              — API key
SLATE_AGENT                                — agent selection
SLATE_AUTO_SHARE                           — auto-share setting
SLATE_CLIENT                               — client identifier
SLATE_CONFIG                               — config override
SLATE_CONFIG_CONTENT                       — inline config
SLATE_CONFIG_DIR                           — config directory
SLATE_DANGEROUSLY_SKIP_PERMISSIONS         — bypass permissions
SLATE_DIR                                  — data directory override
SLATE_DISABLE_AUTOUPDATE                   — disable auto-update
SLATE_DISABLE_CLAUDE_CODE                  — disable Claude Code integration entirely
SLATE_DISABLE_CLAUDE_CODE_PROMPT           — disable Claude Code prompt loading
SLATE_DISABLE_CLAUDE_CODE_SKILLS           — disable .claude/skills/ loading
SLATE_DISABLE_DEFAULT_PLUGINS              — disable default plugins
SLATE_DISABLE_FILETIME_CHECK               — disable file time checks
SLATE_DISABLE_LSP_DOWNLOAD                 — disable LSP auto-download
SLATE_DISABLE_MODELS_FETCH                 — disable models config fetch
SLATE_DISABLE_PROJECT_CONFIG               — disable project-level config
SLATE_DISABLE_PRUNE                        — disable session pruning
SLATE_DISABLE_TERMINAL_TITLE               — disable terminal title updates
SLATE_ENABLE_EXA                           — enable Exa search
SLATE_ENABLE_EXPERIMENTAL_MODELS           — enable experimental models
SLATE_EXPERIMENTAL                         — enable experimental features
SLATE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS — bash timeout override
SLATE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT  — disable copy on select
SLATE_EXPERIMENTAL_DISABLE_FILEWATCHER     — disable file watcher
SLATE_EXPERIMENTAL_EXA                     — Exa search (alt flag)
SLATE_EXPERIMENTAL_FILEWATCHER             — enable file watcher
SLATE_EXPERIMENTAL_ICON_DISCOVERY          — icon discovery
SLATE_EXPERIMENTAL_LSP_TOOL               — LSP tool
SLATE_EXPERIMENTAL_LSP_TY                 — LSP type checking
SLATE_EXPERIMENTAL_MARKDOWN               — markdown mode
SLATE_EXPERIMENTAL_OUTPUT_TOKEN_MAX       — output token limit
SLATE_EXPERIMENTAL_OXFMT                  — oxfmt integration
SLATE_EXPERIMENTAL_PLAN_MODE              — plan mode
SLATE_FAKE_VCS                            — fake VCS for testing
SLATE_GIT_BASH_PATH                       — git bash path (Windows)
SLATE_MODELS_URL                          — models config URL
SLATE_PERMISSION                          — permission override
SLATE_SERVER_PASSWORD                     — server auth
SLATE_SERVER_USERNAME                     — server auth
SLATE_TELEMETRY_DISABLED                  — disable telemetry
SLATE_TEST_HOME                           — test home directory
SLATE_TOKEN_DIR                           — token storage directory
```

### OpenCode legacy（仍可用）
```
OPENCODE_DISABLE_LSP_DOWNLOAD
OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER
OPENCODE_EXPERIMENTAL_FILEWATCHER
OPENCODE_EXPERIMENTAL_ICON_DISCOVERY
OPENCODE_EXPERIMENTAL_LSP_TY
OPENCODE_EXPERIMENTAL_OXFMT
OPENCODE_FAKE_VCS
OPENCODE_GIT_BASH_PATH
OPENCODE_LIBC
OPENCODE_TERMINAL
```

### gstack integration 的 critical env vars（关键环境变量）

**`SLATE_DISABLE_CLAUDE_CODE_SKILLS`**：设置后会 disable `.claude/skills/` loading。
这让 publishing to `.slate/skills/` 成为 load-bearing，而不只是 optimization。
没有 native `.slate/` publishing 时，设置该 flag 会让 gstack skills disappear。

**`SLATE_TEST_HOME`**：对 E2E tests 有用。可以把 Slate home directory redirect 到 isolated temp directory，类似 Codex tests 使用 temp HOME。

**`SLATE_DANGEROUSLY_SKIP_PERMISSIONS`**：headless E2E tests 需要它。

## Model References（模型引用，from binary）

```
anthropic/claude-sonnet-4.6
anthropic/claude-opus-4
anthropic/claude-haiku-4
anthropic/slate              — Slate's own model routing
openai/gpt-5.3-codex
google/nano-banana
randomlabs/fast-default-alpha
```

## API Endpoints（API 端点，from binary）

```
https://api.randomlabs.ai                          — main API
https://api.randomlabs.ai/exaproxy                 — Exa search proxy
https://agent-worker-prod.randomlabs.workers.dev   — production worker
https://agent-worker-dev.randomlabs.workers.dev    — dev worker
https://dashboard.randomlabs.ai                    — dashboard
https://docs.randomlabs.ai                         — documentation
https://randomlabs.ai/config.json                  — remote config
```

Brew tap：`anthropic/tap/slate`（notable：位于 Anthropic tap 下，而不是 Random Labs）

## npm Package Structure（npm package 结构）

```
@randomlabs/slate (8.8 kB, thin launcher)
├── bin/slate           — Node.js launcher (finds platform binary in node_modules)
├── bin/slate1          — Bun launcher (same logic, import.meta.filename)
├── postinstall.mjs     — Verifies platform binary exists, symlinks if needed
└── package.json        — Declares optionalDependencies for all platforms

Platform packages (85MB each):
├── @randomlabs/slate-darwin-arm64
├── @randomlabs/slate-darwin-x64
├── @randomlabs/slate-linux-arm64
├── @randomlabs/slate-linux-x64
├── @randomlabs/slate-linux-x64-musl
├── @randomlabs/slate-linux-arm64-musl
├── @randomlabs/slate-linux-x64-baseline
├── @randomlabs/slate-linux-x64-baseline-musl
├── @randomlabs/slate-darwin-x64-baseline
├── @randomlabs/slate-windows-x64
└── @randomlabs/slate-windows-x64-baseline
```

Binary override：`SLATE_BIN_PATH` env var 会 skip all discovery，直接运行指定 binary。

## 当前已经可用的内容

gstack skills 已经可以通过 `.claude/skills/` fallback path 在 Slate 中工作。Basic functionality 不需要 changes。安装了 gstack for Claude Code 且同时使用 Slate 的 users，会发现两个 agents 都能使用这些 skills。

## First-Class Support 会增加什么

1. **Reliability**：`.slate/skills/` 是 Slate highest-priority path，不受 `SLATE_DISABLE_CLAUDE_CODE_SKILLS` 影响。
2. **Optimized frontmatter**：Strip Slate 不使用的 Claude-specific fields（allowed-tools、hooks、version）。只保留 `name` 和 `description`。
3. **Setup script**：Auto-detect `slate` binary，install skills to `~/.slate/skills/`。
4. **E2E tests**：验证 skills 被 Slate 直接 invoke 时可用。

## Blocked On：Host Config Refactor

Codex outside voice review 指出，把 Slate 作为第 4 个 host（继 Claude、Codex、Factory 之后）添加，是 “host explosion for a path alias”。当前 architecture 有：

- `type Host = 'claude' | 'codex' | 'factory'` 中 hard-coded host names
- `transformFrontmatter()` 中 per-host branches，逻辑 near-duplicate
- `EXTERNAL_HOST_CONFIG` 中 per-host config，patterns 相似
- Setup script 中 per-host functions（`create_codex_runtime_root`、`link_codex_skill_dirs`）
- `bin/gstack-platform-detect`、`bin/gstack-uninstall`、`bin/dev-setup` 中 duplicated host names

添加 Slate 意味着再次 copy 所有这些 patterns。把 hosts 改成 data-driven（config objects instead of if/else branches）的 refactor 会让 Slate integration trivial，也让 future hosts（任何 new OpenCode fork、任何 new agent）zero-effort。

### Plan 中缺失内容（由 Codex identified）

- `lib/worktree.ts` 只 copy `.agents/`，不 copy `.slate/`，因此 worktrees 中的 E2E tests 不会有 Slate skills
- `bin/gstack-uninstall` 不知道 `.slate/`
- `bin/dev-setup` 不为 contributor dev mode wire `.slate/`
- `bin/gstack-platform-detect` 不 detect Slate
- E2E tests 应设置 `SLATE_DISABLE_CLAUDE_CODE_SKILLS=1`，证明 `.slate/` path 真的有效（而不是 fallback 到 `.claude/`）

## Session Runner Design（for later）

JSONL format verified 后，session runner 应该：

- Spawn：`slate -q "<prompt>" --stream-json --dangerously-skip-permissions -w <dir>`
- Parse：Claude Code SDK-compatible NDJSON（assumed，needs verification）
- Skills：在 test fixture 中 install 到 `.slate/skills/`（不是 `.claude/skills/`）
- Auth：使用 `SLATE_API_KEY` 或 existing `~/.slate/` credentials
- Isolation：使用 `SLATE_TEST_HOME` 做 home directory isolation
- Timeout：默认 300s（与 Codex 相同）

```typescript
export interface SlateResult {
  output: string;
  toolCalls: string[];
  tokens: number;
  exitCode: number;
  durationMs: number;
  sessionId: string | null;
  rawLines: string[];
  stderr: string;
}
```

## 文档参考

- Slate docs: https://docs.randomlabs.ai
- Quickstart: https://docs.randomlabs.ai/en/getting-started/quickstart
- Skills: https://docs.randomlabs.ai/en/using-slate/skills
- Configuration（配置）：https://docs.randomlabs.ai/en/using-slate/configuration
- Hotkeys: https://docs.randomlabs.ai/en/using-slate/hotkey_reference
