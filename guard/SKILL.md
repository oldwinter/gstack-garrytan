---
name: guard
version: 0.1.0
description: "完整 safety mode：破坏性命令警告 + 目录范围内编辑. (gstack)"
triggers:
  - full safety mode
  - guard against mistakes
  - maximum safety
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "bash $HOME/.claude/skills/gstack/careful/bin/check-careful.sh"
          statusMessage: "Checking for destructive commands..."
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

组合 /careful
（在 rm -rf、DROP TABLE、force-push 等操作前警告）和 /freeze
（阻止指定目录外的编辑）。接触 prod 或调试 live systems 时用于最大安全性。
用户要求 "guard mode"、"full safety"、"lock it down" 或 "maximum safety" 时使用。

# /guard — 完整 Safety Mode

同时激活破坏性命令警告和目录范围内编辑限制。这是 `/careful` + `/freeze` 的单命令组合。

**依赖说明：**此 skill 引用相邻 `/careful` 和 `/freeze` skill 目录中的 hook scripts。两者都必须安装（gstack setup script 会一起安装它们）。

```bash
mkdir -p ~/.gstack/analytics
echo '{"skill":"guard","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
```

## 设置

询问用户应将编辑限制到哪个目录。使用 AskUserQuestion：

- Question: "Guard mode：应将编辑限制到哪个目录？破坏性命令警告会始终开启。所选路径之外的文件将被禁止编辑。"
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

告诉用户：
- "**Guard mode active.** Two protections are now running:"
- "1. **Destructive command warnings** — rm -rf, DROP TABLE, force-push, etc. will warn before executing (you can override)"
- "2. **Edit boundary** — file edits restricted to `<path>/`. Edits outside this directory are blocked."
- "To remove the edit boundary, run `/unfreeze`. To deactivate everything, end the session."

## 保护范围

完整的破坏性命令模式和安全例外见 `/careful`。编辑边界 enforcement 的工作方式见 `/freeze`。
