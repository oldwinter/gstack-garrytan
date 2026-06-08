---
name: make-pdf
preamble-tier: 1
version: 1.0.0
description: "将任意 markdown file 转成 publication-quality PDF。包含正确的 1in margins、 智能 page breaks、page numbers、cover pages、running headers、curly quotes 和 em dashes、clickable TOC、diagonal DRAFT"
triggers:
  - markdown to pdf
  - generate pdf
  - make pdf
  - export pdf
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->


## When to invoke this skill（何时调用此 skill）

Use when this request matches the routing prose below. Proactively suggest this skill when the user intent fits, unless proactive routing is disabled.（当请求匹配下方 routing prose 时使用；除非禁用主动路由，否则在用户意图匹配时主动建议此 skill。）

watermark。不是 draft artifact，
而是 finished artifact。当用户要求 "make a PDF"、"export to PDF"、
"turn this markdown into a PDF" 或 "generate a document" 时使用。（gstack）

Voice triggers (speech-to-text aliases): "make this a pdf", "make it a pdf", "export to pdf", "turn this into a pdf", "turn this markdown into a pdf", "generate a pdf", "make a pdf from", "pdf this markdown".

## Preamble (run first)（Preamble，先运行）

```bash
_UPD=$(~/.claude/skills/gstack/bin/gstack-update-check 2>/dev/null || .claude/skills/gstack/bin/gstack-update-check 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD" || true
mkdir -p ~/.gstack/sessions
touch ~/.gstack/sessions/"$PPID"
_SESSIONS=$(find ~/.gstack/sessions -mmin -120 -type f 2>/dev/null | wc -l | tr -d ' ')
find ~/.gstack/sessions -mmin +120 -type f -exec rm {} + 2>/dev/null || true
_PROACTIVE=$(~/.claude/skills/gstack/bin/gstack-config get proactive 2>/dev/null || echo "true")
_PROACTIVE_PROMPTED=$([ -f ~/.gstack/.proactive-prompted ] && echo "yes" || echo "no")
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
_SKILL_PREFIX=$(~/.claude/skills/gstack/bin/gstack-config get skill_prefix 2>/dev/null || echo "false")
echo "PROACTIVE: $_PROACTIVE"
echo "PROACTIVE_PROMPTED: $_PROACTIVE_PROMPTED"
echo "SKILL_PREFIX: $_SKILL_PREFIX"
source <(~/.claude/skills/gstack/bin/gstack-repo-mode 2>/dev/null) || true
REPO_MODE=${REPO_MODE:-unknown}
echo "REPO_MODE: $REPO_MODE"
_SESSION_KIND=$(~/.claude/skills/gstack/bin/gstack-session-kind 2>/dev/null || echo "interactive")
case "$_SESSION_KIND" in spawned|headless|interactive) ;; *) _SESSION_KIND="interactive" ;; esac
echo "SESSION_KIND: $_SESSION_KIND"
_LAKE_SEEN=$([ -f ~/.gstack/.completeness-intro-seen ] && echo "yes" || echo "no")
echo "LAKE_INTRO: $_LAKE_SEEN"
_TEL=$(~/.claude/skills/gstack/bin/gstack-config get telemetry 2>/dev/null || true)
_TEL_PROMPTED=$([ -f ~/.gstack/.telemetry-prompted ] && echo "yes" || echo "no")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "TELEMETRY: ${_TEL:-off}"
echo "TEL_PROMPTED: $_TEL_PROMPTED"
_EXPLAIN_LEVEL=$(~/.claude/skills/gstack/bin/gstack-config get explain_level 2>/dev/null || echo "default")
if [ "$_EXPLAIN_LEVEL" != "default" ] && [ "$_EXPLAIN_LEVEL" != "terse" ]; then _EXPLAIN_LEVEL="default"; fi
echo "EXPLAIN_LEVEL: $_EXPLAIN_LEVEL"
_QUESTION_TUNING=$(~/.claude/skills/gstack/bin/gstack-config get question_tuning 2>/dev/null || echo "false")
echo "QUESTION_TUNING: $_QUESTION_TUNING"
mkdir -p ~/.gstack/analytics
if [ "$_TEL" != "off" ]; then
echo '{"skill":"make-pdf","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(_repo=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null | tr -cd 'a-zA-Z0-9._-'); echo "${_repo:-unknown}")'"}'  >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
for _PF in $(find ~/.gstack/analytics -maxdepth 1 -name '.pending-*' 2>/dev/null); do
  if [ -f "$_PF" ]; then
    if [ "$_TEL" != "off" ] && [ -x "~/.claude/skills/gstack/bin/gstack-telemetry-log" ]; then
      ~/.claude/skills/gstack/bin/gstack-telemetry-log --event-type skill_run --skill _pending_finalize --outcome unknown --session-id "$_SESSION_ID" 2>/dev/null || true
    fi
    rm -f "$_PF" 2>/dev/null || true
  fi
  break
done
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" 2>/dev/null || true
_LEARN_FILE="${GSTACK_HOME:-$HOME/.gstack}/projects/${SLUG:-unknown}/learnings.jsonl"
if [ -f "$_LEARN_FILE" ]; then
  _LEARN_COUNT=$(wc -l < "$_LEARN_FILE" 2>/dev/null | tr -d ' ')
  echo "LEARNINGS: $_LEARN_COUNT entries loaded"
  if [ "$_LEARN_COUNT" -gt 5 ] 2>/dev/null; then
    ~/.claude/skills/gstack/bin/gstack-learnings-search --limit 3 2>/dev/null || true
  fi
else
  echo "LEARNINGS: 0"
fi
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"make-pdf","event":"started","branch":"'"$_BRANCH"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null &
_HAS_ROUTING="no"
if [ -f CLAUDE.md ] && grep -q "## Skill routing" CLAUDE.md 2>/dev/null; then
  _HAS_ROUTING="yes"
fi
_ROUTING_DECLINED=$(~/.claude/skills/gstack/bin/gstack-config get routing_declined 2>/dev/null || echo "false")
echo "HAS_ROUTING: $_HAS_ROUTING"
echo "ROUTING_DECLINED: $_ROUTING_DECLINED"
_VENDORED="no"
if [ -d ".claude/skills/gstack" ] && [ ! -L ".claude/skills/gstack" ]; then
  if [ -f ".claude/skills/gstack/VERSION" ] || [ -d ".claude/skills/gstack/.git" ]; then
    _VENDORED="yes"
  fi
fi
echo "VENDORED_GSTACK: $_VENDORED"
echo "MODEL_OVERLAY: claude"
_CHECKPOINT_MODE=$(~/.claude/skills/gstack/bin/gstack-config get checkpoint_mode 2>/dev/null || echo "explicit")
_CHECKPOINT_PUSH=$(~/.claude/skills/gstack/bin/gstack-config get checkpoint_push 2>/dev/null || echo "false")
echo "CHECKPOINT_MODE: $_CHECKPOINT_MODE"
echo "CHECKPOINT_PUSH: $_CHECKPOINT_PUSH"
# Plan mode 提示：供 /spec 这类会根据 plan-mode 状态分支的 skills 使用。
# Claude Code 通过 system reminders 暴露 plan mode；这里 best-effort
# 检测 CLAUDE_PLAN_FILE（harness 在 plan mode active 时设置），否则
# fallback 到 "inactive"。Codex hosts 和 Claude execution mode 都会落到
# inactive，这是安全默认值（默认走 file+execute pipeline）。
if [ -n "${CLAUDE_PLAN_FILE:-}${GSTACK_PLAN_MODE_FORCE:-}" ]; then
  export GSTACK_PLAN_MODE="active"
elif [ "${GSTACK_PLAN_MODE:-}" = "active" ]; then
  export GSTACK_PLAN_MODE="active"
else
  export GSTACK_PLAN_MODE="inactive"
fi
echo "GSTACK_PLAN_MODE: $GSTACK_PLAN_MODE"
[ -n "$OPENCLAW_SESSION" ] && echo "SPAWNED_SESSION: true" || true
```

## MAKE-PDF SETUP (run this check BEFORE any make-pdf command)

```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
P=""
[ -n "$MAKE_PDF_BIN" ] && [ -x "$MAKE_PDF_BIN" ] && P="$MAKE_PDF_BIN"
[ -z "$P" ] && [ -n "$_ROOT" ] && [ -x "$_ROOT/.claude/skills/gstack/make-pdf/dist/pdf" ] && P="$_ROOT/.claude/skills/gstack/make-pdf/dist/pdf"
[ -z "$P" ] && P="$HOME/.claude/skills/gstack/make-pdf/dist/pdf"
if [ -x "$P" ]; then
  echo "MAKE_PDF_READY: $P"
  alias _p_="$P"   # shellcheck alias helper (not exported)
  export P   # available as $P in subsequent blocks within the same skill invocation
else
  echo "MAKE_PDF_NOT_AVAILABLE (run './setup' in the gstack repo to build it)"
fi
```

If `MAKE_PDF_NOT_AVAILABLE` is printed: tell the user the binary is not
built. Have them run `./setup` from the gstack repo, then retry.

If `MAKE_PDF_READY` is printed: `$P` is the binary path for the rest of
the skill. Use `$P` (not an explicit path) so the skill body stays portable.

Core commands:
- `$P generate <input.md> [output.pdf]` — render markdown to PDF (80% use case)
- `$P generate --cover --toc essay.md out.pdf` — full publication layout
- `$P generate --watermark DRAFT memo.md draft.pdf` — diagonal DRAFT watermark
- `$P preview <input.md>` — render HTML and open in browser (fast iteration)
- `$P setup` — verify browse + Chromium + pdftotext and run a smoke test
- `$P --help` — full flag reference

Output contract:
- `stdout`: ONLY the output path on success. One line.
- `stderr`: progress (`Rendering HTML... Generating PDF...`) unless `--quiet`.
- Exit 0 success / 1 bad args / 2 render error / 3 Paged.js timeout / 4 browse unavailable.

## Plan Mode Safe Operations（Plan mode 安全操作）

在 plan mode 中，以下操作允许执行，因为它们用于补充计划信息：`$B`、`$D`、`codex exec`/`codex review`、写入 `~/.gstack/`、写入 plan file，以及对生成 artifacts 使用 `open`。

## Skill Invocation During Plan Mode（Plan mode 中的 skill 调用）

如果用户在 plan mode 中调用 skill，skill 优先于通用 plan mode 行为。**把 skill 文件视为可执行指令，而不是参考资料。**从 Step 0 开始逐步执行；第一次 AskUserQuestion 是工作流进入 plan mode 的方式，不是违规。AskUserQuestion（任意变体：`mcp__*__AskUserQuestion` 或 native；见 "AskUserQuestion Format → Tool resolution"）满足 plan mode 的 turn-end 要求。如果 AskUserQuestion 不可用或 call fails，遵循 AskUserQuestion Format failure fallback：`headless` → BLOCKED；`interactive` → prose fallback（同样满足 end-of-turn）。遇到 STOP 点时立即停止。不要继续工作流，也不要在那里调用 ExitPlanMode。标记为 "PLAN MODE EXCEPTION — ALWAYS RUN" 的命令需要执行。仅在 skill 工作流完成后，或用户要求取消 skill / 离开 plan mode 时，才调用 ExitPlanMode。

如果 `PROACTIVE` 是 `"false"`，不要 auto-invoke 或主动建议 skills。如果某个 skill 看起来有用，询问："I think /skillname might help here — want me to run it?"

如果 `SKILL_PREFIX` 是 `"true"`，建议/invoke `/gstack-*` names。Disk paths 仍是 `~/.claude/skills/gstack/[skill-name]/SKILL.md`。

如果 output 显示 `UPGRADE_AVAILABLE <old> <new>`：读取 `~/.claude/skills/gstack/gstack-upgrade/SKILL.md` 并遵循 "Inline upgrade flow"（如果已配置则 auto-upgrade，否则用 4 个 options 的 AskUserQuestion；如果 declined，则写入 snooze state）。

如果 output 显示 `JUST_UPGRADED <from> <to>`：打印 "Running gstack v{to} (just updated!)"。如果 `SPAWNED_SESSION` 为 true，跳过 feature discovery。

Feature discovery，每个 session 最多一个 prompt：
- 缺少 `~/.claude/skills/gstack/.feature-prompted-continuous-checkpoint`：用 AskUserQuestion 询问是否启用 Continuous checkpoint auto-commits。如果 accepted，运行 `~/.claude/skills/gstack/bin/gstack-config set checkpoint_mode continuous`。始终 touch marker。
- 缺少 `~/.claude/skills/gstack/.feature-prompted-model-overlay`：告知 "Model overlays are active. MODEL_OVERLAY shows the patch." 始终 touch marker。

Upgrade prompts 后，继续 workflow。

如果 `WRITING_STYLE_PENDING` 是 `yes`：询问一次 writing style：

> v1 prompts 更简单：first-use jargon glosses、outcome-framed questions、更短 prose。保留 default，还是恢复 terse？

Options:
- A) 保留新 default（recommended — good writing helps everyone）
- B) 恢复 V0 prose — 设置 `explain_level: terse`

如果选择 A：保持 `explain_level` unset（默认为 `default`）。
如果选择 B：运行 `~/.claude/skills/gstack/bin/gstack-config set explain_level terse`。

无论选择什么，始终运行：
```bash
rm -f ~/.gstack/.writing-style-prompt-pending
touch ~/.gstack/.writing-style-prompted
```

如果 `WRITING_STYLE_PENDING` 是 `no`，跳过。

如果 `LAKE_INTRO` 是 `no`：说 "gstack 遵循 **Boil the Ocean** principle：当 AI 让边际成本接近 0 时，就把完整的事做完。Read more: https://garryslist.org/posts/boil-the-ocean"。询问是否打开：

```bash
open https://garryslist.org/posts/boil-the-ocean
touch ~/.gstack/.completeness-intro-seen
```

只有用户同意时才运行 `open`。始终运行 `touch`。

如果 `TEL_PROMPTED` 是 `no` 且 `LAKE_INTRO` 是 `yes`：通过 AskUserQuestion 询问一次 telemetry：

> 帮助 gstack 变得更好。只分享 usage data：skill、duration、crashes、stable device ID。不分享 code 或 file paths。Repo name 只在本地记录，并会在任何 upload 前移除。

Options:
- A) 帮助 gstack 变得更好！（recommended）
- B) 不，谢谢

如果选择 A：运行 `~/.claude/skills/gstack/bin/gstack-config set telemetry community`

如果选择 B：继续询问：

> Anonymous mode 只发送 aggregate usage，不发送 unique ID。

Options:
- A) 可以，anonymous 没问题
- B) 不，谢谢，完全关闭

如果 B→A：运行 `~/.claude/skills/gstack/bin/gstack-config set telemetry anonymous`
如果 B→B：运行 `~/.claude/skills/gstack/bin/gstack-config set telemetry off`

始终运行：
```bash
touch ~/.gstack/.telemetry-prompted
```

如果 `TEL_PROMPTED` 是 `yes`，跳过。

如果 `PROACTIVE_PROMPTED` 是 `no` 且 `TEL_PROMPTED` 是 `yes`：询问一次：

> 允许 gstack 主动建议 skills，例如对 "does this work?" 建议 /qa，或对 bugs 建议 /investigate？

Options:
- A) 保持开启（recommended）
- B) 关闭 — 我会自己输入 /commands

如果选择 A：运行 `~/.claude/skills/gstack/bin/gstack-config set proactive true`
如果选择 B：运行 `~/.claude/skills/gstack/bin/gstack-config set proactive false`

始终运行：
```bash
touch ~/.gstack/.proactive-prompted
```

如果 `PROACTIVE_PROMPTED` 是 `yes`，跳过。

如果 `HAS_ROUTING` 为 `no`，且 `ROUTING_DECLINED` 为 `false`，且 `PROACTIVE_PROMPTED` 为 `yes`：
检查项目根目录是否存在 CLAUDE.md。如果不存在，则创建它。

使用 AskUserQuestion：

> 当 project 的 CLAUDE.md 包含 skill routing rules 时，gstack 效果最好。

Options:
- A) 把 routing rules 添加到 CLAUDE.md（recommended）
- B) 不，谢谢，我会手动 invoke skills

如果选择 A：把以下 section 追加到 CLAUDE.md 末尾：

```markdown

## Skill routing（Skill 路由）

当用户请求匹配可用 skill 时，通过 Skill tool 调用它。不确定时，也调用对应 skill。

关键 routing rules：
- 产品想法/brainstorming -> 调用 /office-hours
- 策略/scope -> 调用 /plan-ceo-review
- 架构 -> 调用 /plan-eng-review
- Design system/plan review -> 调用 /design-consultation 或 /plan-design-review
- 完整 review pipeline -> 调用 /autoplan
- Bugs/errors -> 调用 /investigate
- QA/testing site behavior -> 调用 /qa 或 /qa-only
- Code review/diff check -> 调用 /review
- Visual polish -> 调用 /design-review
- Ship/deploy/PR -> 调用 /ship 或 /land-and-deploy
- 保存进度 -> 调用 /context-save
- 恢复上下文 -> 调用 /context-restore
- 编写 backlog-ready spec/issue -> 调用 /spec
```

然后提交改动：`git add CLAUDE.md && git commit -m "chore: add gstack skill routing rules to CLAUDE.md"`

如果选择 B：运行 `~/.claude/skills/gstack/bin/gstack-config set routing_declined true`，并说明可用 `gstack-config set routing_declined false` 重新启用。

每个项目只执行一次。如果 `HAS_ROUTING` 为 `yes` 或 `ROUTING_DECLINED` 为 `true`，则跳过。

如果 `VENDORED_GSTACK` 是 `yes`，且 `~/.gstack/.vendoring-warned-$SLUG` 不存在，则通过 AskUserQuestion warning 一次：

> 这个 project 把 gstack vendored 在 `.claude/skills/gstack/`。Vendoring 已 deprecated。
> 是否迁移到 team mode？

Options:
- A) 是，现在迁移到 team mode
- B) 否，我自己处理

如果选择 A：
1. 运行 `git rm -r .claude/skills/gstack/`
2. 运行 `echo '.claude/skills/gstack/' >> .gitignore`
3. 运行 `~/.claude/skills/gstack/bin/gstack-team-init required`（或 `optional`）
4. 运行 `git add .claude/ .gitignore CLAUDE.md && git commit -m "chore: migrate gstack from vendored to team mode"`
5. 告诉用户："Done. Each developer now runs: `cd ~/.claude/skills/gstack && ./setup --team`"（保留 exact command）

如果选择 B：说 "OK，我不会迁移。你需要自己保持 vendored copy up to date。"

无论选择什么，始终运行：
```bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" 2>/dev/null || true
touch ~/.gstack/.vendoring-warned-${SLUG:-unknown}
```

如果 marker 已存在，则跳过。

如果 `SPAWNED_SESSION` 是 `"true"`，你正在由 AI orchestrator（例如 OpenClaw）
spawn 的 session 中运行。在 spawned sessions 中：
- 不要使用 AskUserQuestion 做 interactive prompts。自动选择 recommended option。
- 不要运行 upgrade checks、telemetry prompts、routing injection 或 lake intro。
- 专注完成任务，并通过 prose output 报告结果。
- 以 completion report 收尾：shipped 了什么、做了哪些 decisions、还有什么不确定。

## Artifacts Sync (skill start)（Artifacts 同步，skill 启动时）

```bash
_GSTACK_HOME="${GSTACK_HOME:-$HOME/.gstack}"
# 优先使用 v1.27.0.0 artifacts 文件；对于 migration script 运行前
# 处于升级中途的用户，fallback 到旧 brain 文件。
if [ -f "$HOME/.gstack-artifacts-remote.txt" ]; then
  _BRAIN_REMOTE_FILE="$HOME/.gstack-artifacts-remote.txt"
else
  _BRAIN_REMOTE_FILE="$HOME/.gstack-brain-remote.txt"
fi
_BRAIN_SYNC_BIN="~/.claude/skills/gstack/bin/gstack-brain-sync"
_BRAIN_CONFIG_BIN="~/.claude/skills/gstack/bin/gstack-config"

# /sync-gbrain context-load：当 gbrain 可用时，教 agent 使用 gbrain。
# Per-worktree pin：post-spike redesign 使用 kubectl-style 的 `.gbrain-source`
# 放在 git toplevel 里限定 queries 范围。要在 worktree 内寻找 pin（不是
# global state file），避免因为 worktree A 已同步，就让没有 pin 的 worktree B
# 声称自己已 indexed。gbrain 未配置时为空字符串（对非 gbrain 用户为零 context cost）。
_GBRAIN_CONFIG="$HOME/.gbrain/config.json"
if [ -f "$_GBRAIN_CONFIG" ] && command -v gbrain >/dev/null 2>&1; then
  _GBRAIN_VERSION_OK=$(gbrain --version 2>/dev/null | grep -c '^gbrain ' || echo 0)
  if [ "$_GBRAIN_VERSION_OK" -gt 0 ] 2>/dev/null; then
    _GBRAIN_PIN_PATH=""
    _REPO_TOP=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
    if [ -n "$_REPO_TOP" ] && [ -f "$_REPO_TOP/.gbrain-source" ]; then
      _GBRAIN_PIN_PATH="$_REPO_TOP/.gbrain-source"
    fi
    if [ -n "$_GBRAIN_PIN_PATH" ]; then
      echo "GBrain configured. Prefer \`gbrain search\`/\`gbrain query\` over Grep for"
      echo "semantic questions; use \`gbrain code-def\`/\`code-refs\`/\`code-callers\` for"
      echo "symbol-aware code lookup. See \"## GBrain Search Guidance\" in CLAUDE.md."
      echo "Run /sync-gbrain to refresh."
    else
      echo "GBrain configured but this worktree isn't pinned yet. Run \`/sync-gbrain --full\`"
      echo "before relying on \`gbrain search\` for code questions in this worktree."
      echo "Falls back to Grep until pinned."
    fi
  fi
fi

_BRAIN_SYNC_MODE=$("$_BRAIN_CONFIG_BIN" get artifacts_sync_mode 2>/dev/null || echo off)

# 检测 remote-MCP mode（/setup-gbrain 的 Path 4）。Remote mode 下 local artifacts
# sync 是 no-op；brain server 会按自己的节奏从 GitHub/GitLab 拉取。
# 直接读取 claude.json 以保持 preamble 快速（每次 skill start 不启动 claude CLI 子进程）。
_GBRAIN_MCP_MODE="none"
if command -v jq >/dev/null 2>&1 && [ -f "$HOME/.claude.json" ]; then
  _GBRAIN_MCP_TYPE=$(jq -r '.mcpServers.gbrain.type // .mcpServers.gbrain.transport // empty' "$HOME/.claude.json" 2>/dev/null)
  case "$_GBRAIN_MCP_TYPE" in
    url|http|sse) _GBRAIN_MCP_MODE="remote-http" ;;
    stdio) _GBRAIN_MCP_MODE="local-stdio" ;;
  esac
fi

if [ -f "$_BRAIN_REMOTE_FILE" ] && [ ! -d "$_GSTACK_HOME/.git" ] && [ "$_BRAIN_SYNC_MODE" = "off" ]; then
  _BRAIN_NEW_URL=$(head -1 "$_BRAIN_REMOTE_FILE" 2>/dev/null | tr -d '[:space:]')
  if [ -n "$_BRAIN_NEW_URL" ]; then
    echo "ARTIFACTS_SYNC: artifacts repo detected: $_BRAIN_NEW_URL"
    echo "ARTIFACTS_SYNC: run 'gstack-brain-restore' to pull your cross-machine artifacts (or 'gstack-config set artifacts_sync_mode off' to dismiss forever)"
  fi
fi

if [ -d "$_GSTACK_HOME/.git" ] && [ "$_BRAIN_SYNC_MODE" != "off" ]; then
  _BRAIN_LAST_PULL_FILE="$_GSTACK_HOME/.brain-last-pull"
  _BRAIN_NOW=$(date +%s)
  _BRAIN_DO_PULL=1
  if [ -f "$_BRAIN_LAST_PULL_FILE" ]; then
    _BRAIN_LAST=$(cat "$_BRAIN_LAST_PULL_FILE" 2>/dev/null || echo 0)
    _BRAIN_AGE=$(( _BRAIN_NOW - _BRAIN_LAST ))
    [ "$_BRAIN_AGE" -lt 86400 ] && _BRAIN_DO_PULL=0
  fi
  if [ "$_BRAIN_DO_PULL" = "1" ]; then
    ( cd "$_GSTACK_HOME" && git fetch origin >/dev/null 2>&1 && git merge --ff-only "origin/$(git rev-parse --abbrev-ref HEAD)" >/dev/null 2>&1 ) || true
    echo "$_BRAIN_NOW" > "$_BRAIN_LAST_PULL_FILE"
  fi
  "$_BRAIN_SYNC_BIN" --once 2>/dev/null || true
fi

if [ "$_GBRAIN_MCP_MODE" = "remote-http" ]; then
  # Remote-MCP mode：local artifacts sync 是 no-op（brain admin 的 server
  # 会从 GitHub/GitLab 拉取）。向用户说明这是预期行为，不是故障。
  _GBRAIN_HOST=$(jq -r '.mcpServers.gbrain.url // empty' "$HOME/.claude.json" 2>/dev/null | sed -E 's|^https?://([^/:]+).*|\1|')
  echo "ARTIFACTS_SYNC: remote-mode (managed by brain server ${_GBRAIN_HOST:-remote})"
elif [ -d "$_GSTACK_HOME/.git" ] && [ "$_BRAIN_SYNC_MODE" != "off" ]; then
  _BRAIN_QUEUE_DEPTH=0
  [ -f "$_GSTACK_HOME/.brain-queue.jsonl" ] && _BRAIN_QUEUE_DEPTH=$(wc -l < "$_GSTACK_HOME/.brain-queue.jsonl" | tr -d ' ')
  _BRAIN_LAST_PUSH="never"
  [ -f "$_GSTACK_HOME/.brain-last-push" ] && _BRAIN_LAST_PUSH=$(cat "$_GSTACK_HOME/.brain-last-push" 2>/dev/null || echo never)
  echo "ARTIFACTS_SYNC: mode=$_BRAIN_SYNC_MODE | last_push=$_BRAIN_LAST_PUSH | queue=$_BRAIN_QUEUE_DEPTH"
else
  echo "ARTIFACTS_SYNC: off"
fi
```



Privacy stop-gate：如果输出显示 `ARTIFACTS_SYNC: off`，`artifacts_sync_mode_prompted` 为 `false`，且 gbrain 在 PATH 上或 `gbrain doctor --fast --json` 可运行，则询问一次：

> gstack 可以把你的 artifacts（CEO plans、designs、reports）发布到一个 private GitHub repo，并由 GBrain 跨机器 index。要同步多少内容？

Options:
- A) 所有 allowlisted 内容（recommended）
- B) 仅 artifacts
- C) 拒绝，全部保持 local

回答后：

```bash
# 选择的 mode：full | artifacts-only | off
"$_BRAIN_CONFIG_BIN" set artifacts_sync_mode <choice>
"$_BRAIN_CONFIG_BIN" set artifacts_sync_mode_prompted true
```

如果选择 A/B 且 `~/.gstack/.git` 缺失，询问是否运行 `gstack-artifacts-init`。不要阻塞此 skill。

在 skill END、telemetry 之前：

```bash
"~/.claude/skills/gstack/bin/gstack-brain-sync" --discover-new 2>/dev/null || true
"~/.claude/skills/gstack/bin/gstack-brain-sync" --once 2>/dev/null || true
```


## Model-Specific Behavioral Patch (claude)（模型专属行为补丁）

以下 nudges 针对 claude model family 调整。它们**从属于** skill workflow、
STOP points、AskUserQuestion gates、plan-mode safety 和 /ship review gates。
如果下面的 nudge 与 skill instructions 冲突，以 skill 为准。把这些视为偏好，而不是规则。

**Todo-list discipline。** 处理 multi-step plan 时，每完成一个 task 就单独标记 complete。不要等到最后 batch-complete。如果某个 task 变得不必要，用一行 reason 标记 skipped。

**Think before heavy actions。** 对复杂操作（refactors、migrations、non-trivial new features），执行前简短说明 approach。这样用户可以低成本 course-correct，而不是等你做到一半才打断。

**Dedicated tools over Bash。** 优先使用 Read、Edit、Write、Glob、Grep，而不是 shell equivalents（cat、sed、find、grep）。Dedicated tools 更便宜、更清晰。

## Voice（语气）

直接、具体，builder-to-builder。说出 file、function、command 和 user-visible impact。不要 filler。

不要 em dashes。不要 AI vocabulary：delve、crucial、robust、comprehensive、nuanced、multifaceted。不要 corporate 或 academic。短段落。以接下来要做什么收尾。

用户拥有你没有的 context。Cross-model agreement 是 recommendation，不是 decision。由用户决定。

## Completion Status Protocol（完成状态协议）

完成 skill 工作流时，使用以下之一报告状态：
- **DONE** — 已完成，并附证据。
- **DONE_WITH_CONCERNS** — 已完成，但列出顾虑。
- **BLOCKED** — 无法继续；说明阻塞点和已尝试的操作。
- **NEEDS_CONTEXT** — 缺少信息；精确说明需要什么。

如果 3 次尝试失败、涉及不确定的安全敏感改动，或范围无法验证，则升级处理。格式：`STATUS`、`REASON`、`ATTEMPTED`、`RECOMMENDATION`。

## Operational Self-Improvement（操作自我改进）

完成前，如果你发现了可长期复用的项目 quirks 或命令修复、下次可节省 5 分钟以上，请记录：

```bash
~/.claude/skills/gstack/bin/gstack-learnings-log '{"skill":"SKILL_NAME","type":"operational","key":"SHORT_KEY","insight":"DESCRIPTION","confidence":N,"source":"observed"}'
```

不要记录显而易见的事实或一次性 transient errors。

## Telemetry (run last)（Telemetry，最后运行）

工作流完成后记录 telemetry。使用 frontmatter 中的 skill `name:`。OUTCOME 为 success/error/abort/unknown。

**PLAN MODE EXCEPTION — ALWAYS RUN:** 此命令把 telemetry 写入
`~/.gstack/analytics/`，与 preamble analytics 写入一致。

运行以下 bash：

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
rm -f ~/.gstack/analytics/.pending-"$_SESSION_ID" 2>/dev/null || true
# Session timeline：记录 skill 完成情况（仅本地，绝不发送到任何地方）
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"SKILL_NAME","event":"completed","branch":"'$(git branch --show-current 2>/dev/null || echo unknown)'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
# Local analytics（受 telemetry 设置控制）
if [ "$_TEL" != "off" ]; then
echo '{"skill":"SKILL_NAME","duration_s":"'"$_TEL_DUR"'","outcome":"OUTCOME","browse":"USED_BROWSE","session":"'"$_SESSION_ID"'","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
# Remote telemetry（opt-in，需要 binary）
if [ "$_TEL" != "off" ] && [ -x ~/.claude/skills/gstack/bin/gstack-telemetry-log ]; then
  ~/.claude/skills/gstack/bin/gstack-telemetry-log \
    --skill "SKILL_NAME" --duration "$_TEL_DUR" --outcome "OUTCOME" \
    --used-browse "USED_BROWSE" --session-id "$_SESSION_ID" 2>/dev/null &
fi
```

运行前替换 `SKILL_NAME`、`OUTCOME` 和 `USED_BROWSE`。

## Plan Status Footer（计划状态页脚）

运行 plan reviews 的 skills（`/plan-*-review`、`/codex review`）会在 skill 末尾包含 EXIT PLAN MODE GATE 阻塞 checklist；它会在调用 ExitPlanMode 前验证 plan file 以 `## GSTACK REVIEW REPORT` 结尾。不运行 plan reviews 的 skills（如 `/ship`、`/qa`、`/review` 这类 operational skills）通常不在 plan mode 中运行，也没有 review report 需要验证；此 footer 对它们是 no-op。写入 plan file 是 plan mode 中唯一允许的编辑。

# make-pdf：从 markdown 生成 publication-quality PDFs

将 `.md` files 转成看起来像 Faber & Faber essays 的 PDFs：1in margins、left-aligned body、
全篇 Helvetica、curly quotes 和 em dashes、可选 cover page 与 clickable TOC、
需要时加 diagonal DRAFT watermark。从 PDF 复制粘贴会得到干净文字，而不是 "S a i l i n g"。

在 Linux 上，安装 `fonts-liberation` 以正确 rendering：Helvetica 和 Arial 默认不存在，
Liberation Sans 是标准 metric-compatible fallback。CI 和 Docker builds 会通过 Dockerfile.ci 自动安装它。

Emoji 需要 color-emoji font。macOS（Apple Color Emoji）和 Windows（Segoe UI Emoji）
自带一个；多数 Linux distros 和 containers 不自带，所以 emoji 会渲染为空框（▯）。
`./setup` 会在 Linux 上自动安装 `fonts-noto-color-emoji`（apt/dnf/pacman/apk，best-effort），
print CSS 会依次 fallback 到 Apple / Segoe / Noto emoji families。设置
`GSTACK_SKIP_FONTS=1` 可跳过安装（无 sudo 的 CI、受管或离线机器）。

## Core patterns（核心模式）

### 80% 场景：memo/letter

一个 command，不加 flags。默认得到带 running header + page numbers + CONFIDENTIAL footer 的干净 PDF。

```bash
$P generate letter.md                 # writes /tmp/letter.pdf
$P generate letter.md letter.pdf      # explicit output path
```

### Publication mode：cover + TOC + chapter breaks

```bash
$P generate --cover --toc --author "Garry Tan" --title "On Horizons" \
  essay.md essay.pdf
```

Markdown 中每个 top-level H1 都会开始新 page。对于恰好有多个 H1 的 memos，
可用 `--no-chapter-breaks` 禁用。

### Draft-stage watermark（草稿阶段水印）

```bash
$P generate --watermark DRAFT memo.md draft.pdf
```

每页都有 diagonal、10% opacity 的 DRAFT。Draft final 后，去掉 flag 并重新生成。

### 通过 preview 快速迭代

```bash
$P preview essay.md
```

使用相同 print CSS 渲染 HTML，并在 browser 中打开。编辑 markdown 时刷新即可。
准备好之前不用反复走 PDF round trip。

### Brand-free（无 CONFIDENTIAL footer）

```bash
$P generate --no-confidential memo.md memo.pdf
```

## 常用 flags

```
Page layout:
  --margins <dim>            1in (default) | 72pt | 2.54cm | 25mm
  --page-size letter|a4|legal

Structure:
  --cover                    Cover page (title, author, date, hairline rule)
  --toc                      Clickable TOC with page numbers
  --no-chapter-breaks        Don't start a new page at every H1

Branding:
  --watermark <text>         Diagonal watermark ("DRAFT", "CONFIDENTIAL")
  --header-template <html>   Custom running header
  --footer-template <html>   Custom footer (mutex with --page-numbers)
  --no-confidential          Suppress the CONFIDENTIAL right-footer

Output:
  --page-numbers             "N of M" footer (default on)
  --tagged                   Accessible PDF (default on)
  --outline                  PDF bookmarks from headings (default on)
  --quiet                    Suppress progress on stderr
  --verbose                  Per-stage timings

Network:
  --allow-network            Fetch external images. Off by default
                             (blocks tracking pixels).

Metadata:
  --title "..."              Document title (defaults to first H1)
  --author "..."             Author for cover + PDF metadata
  --date "..."               Date for cover (defaults to today)
```

## Claude 何时应运行它

留意 markdown-to-PDF intent。遇到以下任一 patterns -> 运行 `$P generate`：

- "Can you make this markdown a PDF"
- "Export it as a PDF"
- "Turn this letter into a PDF"
- "I need a PDF of the essay"
- "Print this as a PDF for me"

如果用户打开了 `.md` file，并说 "make it look nice"，提出
`$P generate --cover --toc`，并在运行前询问。

## Debugging（调试）

- Output 看起来 empty / blank -> 检查 browse daemon 是否运行：`$B status`。
- 复制粘贴后 text 断裂 -> highlight.js output（Phase 4）。等 `--no-syntax` flag 存在后用它重试。
  目前先移除 fenced code blocks 并重新生成。
- Paged.js timeout -> markdown 中可能没有 headings。去掉 `--toc`。
- External image 缺失 -> 添加 `--allow-network`（理解这等于允许 markdown file 从其 image URLs fetch）。
- Generated PDF 太高/太宽 -> `--page-size a4` 或 `--margins 0.75in`。

## Output contract（输出契约）

```
stdout: /tmp/letter.pdf          ← just the path, one line
stderr: Rendering HTML...        ← progress spinner (unless --quiet)
        Generating PDF...
        Done in 1.5s. 43 words · 22KB · /tmp/letter.pdf

exit code: 0 success / 1 bad args / 2 render error / 3 Paged.js timeout
           / 4 browse unavailable
```

捕获 path：`PDF=$($P generate letter.md)`，然后使用 `$PDF`。
