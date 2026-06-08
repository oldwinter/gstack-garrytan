---
name: freeze
version: 0.1.0
description: "将本 session 的文件编辑限制在指定目录内. (gstack)"
triggers:
  - freeze edits to directory
  - lock editing scope
  - restrict file changes
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
hooks:
  PreToolUse:
    - matcher: "Edit"
      hooks:
        - type: command
          command: "bash $HOME/.claude/skills/gstack/freeze/bin/check-freeze.sh"
          statusMessage: "Checking freeze boundary..."
    - matcher: "Write"
      hooks:
        - type: command
          command: "bash $HOME/.claude/skills/gstack/freeze/bin/check-freeze.sh"
          statusMessage: "Checking freeze boundary..."
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->


## When to invoke this skill（何时调用此 skill）

Use when this request matches the routing prose below. Proactively suggest this skill when the user intent fits, unless proactive routing is disabled.（当请求匹配下方 routing prose 时使用；除非禁用主动路由，否则在用户意图匹配时主动建议此 skill。）

阻止允许路径之外的 Edit 和 Write。
适用于调试时防止意外“修复”无关代码，或想把变更范围限定到一个模块内。
用户要求 "freeze"、"restrict edits"、"only edit this folder" 或
"lock down edits" 时使用。

# /freeze — 将编辑限制到一个目录

将文件编辑锁定到指定目录。任何指向允许路径之外文件的 Edit 或 Write 操作都会被**阻止**，而不只是警告。

```bash
mkdir -p ~/.gstack/analytics
echo '{"skill":"freeze","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
```

## 设置

询问用户应将编辑限制到哪个目录。使用 AskUserQuestion：

- Question: "应将编辑限制到哪个目录？该路径之外的文件将被禁止编辑。"
- 文本输入（不是多选）——用户输入一个路径。

用户提供目录路径后：

1. 将其解析为绝对路径：
```bash
FREEZE_DIR=$(cd "<user-provided-path>" 2>/dev/null && pwd)
echo "$FREEZE_DIR"
```

2. 确保尾部 slash，并保存到 freeze state file：
```bash
FREEZE_DIR="${FREEZE_DIR%/}/"
eval "$(~/.claude/skills/gstack/bin/gstack-paths)"
STATE_DIR="$GSTACK_STATE_ROOT"
mkdir -p "$STATE_DIR"
echo "$FREEZE_DIR" > "$STATE_DIR/freeze-dir.txt"
echo "Freeze boundary set: $FREEZE_DIR"
```

告诉用户："Edits 现在已限制在 `<path>/`。这个 directory 之外的任何 Edit 或 Write 都会被 block。要更改 boundary，请再次运行 `/freeze`；要移除它，请运行 `/unfreeze` 或结束 session。"

## 工作方式

hook 从 Edit/Write 工具输入 JSON 中读取 `file_path`，然后检查该路径是否以 freeze directory 开头。如果不是，则返回 `permissionDecision: "deny"` 阻止操作。

freeze boundary 通过 state file 在 session 内持续存在。hook script 会在每次 Edit/Write 调用时读取它。

## 注意事项

- freeze directory 末尾的 `/` 可防止 `/src` 匹配 `/src-old`
- Freeze 只适用于 Edit 和 Write 工具；Read、Bash、Glob、Grep 不受影响
- 这用于防止意外编辑，不是安全边界；像 `sed` 这样的 Bash 命令仍可修改边界外文件
- 要停用，请运行 `/unfreeze` 或结束对话
