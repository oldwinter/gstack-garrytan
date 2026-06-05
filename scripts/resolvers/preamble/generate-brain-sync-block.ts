/**
 * artifacts-sync preamble block（v1.27.0.0 从 gbrain-sync 改名）。
 *
 * 生成每次 skill invocation 都会运行的 bash：
 *   0. Live gbrain-availability hint（按 /plan-eng-review）：gbrain 已配置时，
 *      输出两种 variant 之一（steady-state vs empty-corpus emergency）。
 *      未配置 gbrain 时为零 context cost。
 *   1. 如果 ~/.gstack-artifacts-remote.txt（或 v1.27.0.0 migration window
 *      内的 legacy ~/.gstack-brain-remote.txt）存在，且 ~/.gstack/.git 缺失，
 *      则暴露 restore-available hint（不会 auto-run restore）。
 *   2. 如果 sync 开启，运行 `gstack-brain-sync --once`（drain + push）。
 *      script 保留旧名；只翻转 config-key + state-file names。
 *   3. 当天第一个 skill（通过 .brain-last-pull 做 24h cache）执行：
 *      `git fetch` + ff-only merge（JSONL merge driver 处理 conflicts）。
 *   4. 输出 `ARTIFACTS_SYNC:` status line，让每个 skill 都暴露 health。
 *      remote-MCP mode 下，该行是 `ARTIFACTS_SYNC: remote-mode
 *      (managed by brain server <host>)`，因为本机不做 local sync；
 *      brain admin 的 server 会从 GitHub/GitLab 拉取。
 *
 * 当 artifacts_sync_mode 未设置且 host 上可用 gbrain 时，还会生成 prose
 * instructions，要求 host LLM 通过 AskUserQuestion 触发一次性 privacy stop-gate。
 *
 * 该 block 在所有 tiers 中生成。feature disabled 时 internal bash 会 short-circuit；
 * cost <5ms。
 *
 * Skill-end sync 由 completion-status generator 通过调用
 * `gstack-brain-sync --discover-new` + `--once` 处理。
 */
import type { TemplateContext } from '../types';

export function generateBrainSyncBlock(ctx: TemplateContext): string {
  const isBrainHost = ctx.host === 'gbrain' || ctx.host === 'hermes';
  return `## Artifacts Sync (skill start)（Artifacts 同步，skill 启动时）

\`\`\`bash
_GSTACK_HOME="\${GSTACK_HOME:-$HOME/.gstack}"
# 优先使用 v1.27.0.0 artifacts 文件；对于 migration script 运行前
# 处于升级中途的用户，fallback 到旧 brain 文件。
if [ -f "$HOME/.gstack-artifacts-remote.txt" ]; then
  _BRAIN_REMOTE_FILE="$HOME/.gstack-artifacts-remote.txt"
else
  _BRAIN_REMOTE_FILE="$HOME/.gstack-brain-remote.txt"
fi
_BRAIN_SYNC_BIN="${ctx.paths.binDir}/gstack-brain-sync"
_BRAIN_CONFIG_BIN="${ctx.paths.binDir}/gstack-config"

# /sync-gbrain context-load：当 gbrain 可用时，教 agent 使用 gbrain。
# Per-worktree pin：post-spike redesign 使用 kubectl-style 的 \`.gbrain-source\`
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
      echo "GBrain configured. Prefer \\\`gbrain search\\\`/\\\`gbrain query\\\` over Grep for"
      echo "semantic questions; use \\\`gbrain code-def\\\`/\\\`code-refs\\\`/\\\`code-callers\\\` for"
      echo "symbol-aware code lookup. See \\"## GBrain Search Guidance\\" in CLAUDE.md."
      echo "Run /sync-gbrain to refresh."
    else
      echo "GBrain configured but this worktree isn't pinned yet. Run \\\`/sync-gbrain --full\\\`"
      echo "before relying on \\\`gbrain search\\\` for code questions in this worktree."
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
  _GBRAIN_HOST=$(jq -r '.mcpServers.gbrain.url // empty' "$HOME/.claude.json" 2>/dev/null | sed -E 's|^https?://([^/:]+).*|\\1|')
  echo "ARTIFACTS_SYNC: remote-mode (managed by brain server \${_GBRAIN_HOST:-remote})"
elif [ -d "$_GSTACK_HOME/.git" ] && [ "$_BRAIN_SYNC_MODE" != "off" ]; then
  _BRAIN_QUEUE_DEPTH=0
  [ -f "$_GSTACK_HOME/.brain-queue.jsonl" ] && _BRAIN_QUEUE_DEPTH=$(wc -l < "$_GSTACK_HOME/.brain-queue.jsonl" | tr -d ' ')
  _BRAIN_LAST_PUSH="never"
  [ -f "$_GSTACK_HOME/.brain-last-push" ] && _BRAIN_LAST_PUSH=$(cat "$_GSTACK_HOME/.brain-last-push" 2>/dev/null || echo never)
  echo "ARTIFACTS_SYNC: mode=$_BRAIN_SYNC_MODE | last_push=$_BRAIN_LAST_PUSH | queue=$_BRAIN_QUEUE_DEPTH"
else
  echo "ARTIFACTS_SYNC: off"
fi
\`\`\`

${isBrainHost ? `如果输出显示 \`ARTIFACTS_SYNC: artifacts repo detected\`，通过 AskUserQuestion 提供 \`gstack-brain-restore\`；否则继续。` : ''}

Privacy stop-gate：如果输出显示 \`ARTIFACTS_SYNC: off\`，\`artifacts_sync_mode_prompted\` 为 \`false\`，且 gbrain 在 PATH 上或 \`gbrain doctor --fast --json\` 可运行，则询问一次：

> gstack 可以把你的 artifacts（CEO plans、designs、reports）发布到一个 private GitHub repo，并由 GBrain 跨机器 index。要同步多少内容？

Options:
- A) 所有 allowlisted 内容（recommended）
- B) 仅 artifacts
- C) 拒绝，全部保持 local

回答后：

\`\`\`bash
# 选择的 mode：full | artifacts-only | off
"$_BRAIN_CONFIG_BIN" set artifacts_sync_mode <choice>
"$_BRAIN_CONFIG_BIN" set artifacts_sync_mode_prompted true
\`\`\`

如果选择 A/B 且 \`~/.gstack/.git\` 缺失，询问是否运行 \`gstack-artifacts-init\`。不要阻塞此 skill。

在 skill END、telemetry 之前：

\`\`\`bash
"${ctx.paths.binDir}/gstack-brain-sync" --discover-new 2>/dev/null || true
"${ctx.paths.binDir}/gstack-brain-sync" --once 2>/dev/null || true
\`\`\`
`;
}
