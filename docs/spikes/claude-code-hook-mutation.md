# Spike: Claude Code hook mutation for plan-tune cathedral

**Status:** complete (2026-05-27)
**Surfaces:** D10 (does PreToolUse allow mutating AUQ input?), D19/Codex (matcher must cover MCP variants)
**Downstream consumers:** T3, T5, T6, T8

## Question this spike answers（本 spike 回答的问题）

`AskUserQuestion` 上的 PreToolUse hook 能否真的通过 `updatedInput`
替换用户回答？如果可以，准确协议是什么？

## Answer（答案）

**可以。** `updatedInput` 是受支持的机制。来源：
https://code.claude.com/docs/en/hooks（已确认 2026-04 reference）。

## Hook stdin schema（PreToolUse + PostToolUse）

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/current/working/dir",
  "permission_mode": "default",
  "effort": { "level": "medium" },
  "hook_event_name": "PreToolUse",
  "tool_name": "AskUserQuestion",
  "tool_input": { /* tool-specific */ },
  "tool_use_id": "unique-id-12345"
}
```

Subagent context 中可选：`agent_id`、`agent_type`。

## PreToolUse hook stdout schema（用于 `allow + updatedInput`）

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "auto-decided by plan-tune preference",
    "updatedInput": { /* shallow-merged into original tool_input */ },
    "additionalContext": "optional context for Claude"
  }
}
```

**permissionDecision values（取值）：**
- `"allow"` — 继续执行，可选携带 `updatedInput`
- `"deny"` — 阻止（反馈给 Claude；按 Codex 对 D-prefixed decisions 的修正，这不是 synthetic answer）
- `"ask"` — 升级询问用户
- `"defer"` — 让 permission flow 继续

**`updatedInput` semantics（语义）：** 把返回 object 中出现的字段 shallow merge
到原始 `tool_input` 上。仅在 `permissionDecision: "allow"` 时有效。
这让我们能为 `never-ask` preferences 替换成 auto-decided answer。

## Matcher schema（matcher 结构）

`~/.claude/settings.json` 中的 `matcher` field 在 **包含 regex
metacharacters 时** 支持 JS-regex syntax。只包含字母/下划线的 matcher 是 exact match。

要同时覆盖 native + MCP `AskUserQuestion`：
```json
"matcher": "(AskUserQuestion|mcp__.*__AskUserQuestion)"
```

Conductor 会通过 `--disallowedTools` 禁用 native `AskUserQuestion`，
并路由到 `mcp__conductor__AskUserQuestion`；因此必须包含 MCP suffix，
我们的 hook 才会在那里触发。

## Multiple-hook concurrency caveat（多 hook 并发 caveat）

> All matching hooks run in parallel, and identical handlers are
> deduplicated automatically.

**For our use case:**
- gstack 会在 AUQ-shaped tool names 上恰好注册一个 PreToolUse hook 和一个 PostToolUse hook。
- 如果用户自己的 hook 也在 AskUserQuestion 上返回 `updatedInput`，merge order 未定义。
- 缓解：在 `bin/gstack-settings-hook` install prompt 中记录该约束。用户可在接受前从 diff preview 中发现冲突。

**`permissionDecision` precedence（多个 hook 同时决策时）：**
`deny > ask > allow > defer` — 最严格者胜出。

## Implementation hookSpecificOutput examples（实现中的 hookSpecificOutput 示例）

**Auto-decide（PreToolUse，`never-ask` preference + non-one-way）：**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "plan-tune: never-ask preference on ship-test-failure-triage",
    "updatedInput": {
      "questions": [{ /* same as input, but with auto-selected answer */ }]
    }
  }
}
```

**Pass-through（没有 preference，或 one-way safety override）：**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "defer"
  }
}
```

**PostToolUse capture（始终执行）：**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse"
  }
}
```
（PostToolUse hooks 也可以设置 `additionalContext` 追加到 tool result；
v1 capture 不需要这个。）

## Settings.json snippet for T8 hook installer（T8 hook installer 的 settings.json 片段）

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "(AskUserQuestion|mcp__.*__AskUserQuestion)",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/skills/gstack/hosts/claude/hooks/question-preference-hook",
            "timeout": 5
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "(AskUserQuestion|mcp__.*__AskUserQuestion)",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/skills/gstack/hosts/claude/hooks/question-log-hook",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

Hook commands 底层会调用 `bun`；Claude Code 的 hook runner 需要 absolute
paths（或 `$CLAUDE_PROJECT_DIR` substitution）。Hooks 本身是 TypeScript
files，由 bash wrapper shell 到 bun 中执行。

## Open questions deferred to implementation（留到实现阶段的 open questions）

1. **Recommended-option parsing scope（推荐项解析范围）。** D2 要求先解析
   `(recommended)` label。按 AskUserQuestion Format，label 在 option 的
   `label` field 上。Implementation 需要遍历
   `tool_input.questions[*].options[*]` 寻找 label suffix。Worked examples：
   ship/SKILL.md.tmpl 会 emit 类似 `"A) Fix now" (recommended)` 的 options。

2. **Auto-decided event tagging（自动决策事件标记）。** 当 hook 返回
   `updatedInput` 时，PostToolUse hook 会看到 resolved input，并记录一条
   normal event。需要 PostToolUse payload 上有额外 field（例如
   `was_auto_decided: true`），hook 可通过 session state tracking 设置：
   从 PreToolUse 写入 marker file
   `~/.gstack/sessions/<id>/.auto-decided-<tool_use_id>`，PostToolUse 读取后删除。

3. **Timeout behavior（超时行为）。** Default hook timeout 是 60s，但 docs 对
   timeout 后会发生什么说明很薄。设置显式 `timeout: 5`，避免用户在 hook
   misfire 时等待超过 5s。失败时 fallback 到 pass-through。

## References

- https://code.claude.com/docs/en/hooks（canonical，latest as of 2026-04）
- WebSearch results 2026-05-27
- Existing `bin/gstack-settings-hook`（SessionStart-only impl，将由 T3 schema-aware rewrite 取代）
