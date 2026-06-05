---
name: unfreeze
version: 0.1.0
description: "清除 /freeze 设置的 freeze boundary. (gstack)"
triggers:
  - unfreeze edits
  - unlock all directories
  - remove edit restrictions
allowed-tools:
  - Bash
  - Read
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->


## When to invoke this skill（何时调用此 skill）

重新允许编辑所有目录。适用于想在不结束 session
的情况下扩大编辑范围。用户要求 "unfreeze"、"unlock edits"、"remove freeze"
或 "allow all edits" 时使用。

# /unfreeze — 清除 Freeze Boundary

移除 `/freeze` 设置的编辑限制，允许编辑所有目录。

```bash
mkdir -p ~/.gstack/analytics
echo '{"skill":"unfreeze","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
```

## 清除边界

```bash
eval "$(~/.claude/skills/gstack/bin/gstack-paths)"
STATE_DIR="$GSTACK_STATE_ROOT"
if [ -f "$STATE_DIR/freeze-dir.txt" ]; then
  PREV=$(cat "$STATE_DIR/freeze-dir.txt")
  rm -f "$STATE_DIR/freeze-dir.txt"
  echo "Freeze boundary cleared (was: $PREV). Edits are now allowed everywhere."
else
  echo "No freeze boundary was set."
fi
```

告诉用户结果。注意，`/freeze` hooks 仍会在当前 session 注册；由于 state file 不存在，它们只会允许所有操作。要重新 freeze，请再次运行 `/freeze`。
