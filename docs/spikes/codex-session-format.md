# Spike：Codex session storage format for plan-tune cathedral

**Status:** complete (2026-05-27)
**Surfaces:** D5 (Codex import parses structured files, not regex)
**Downstream consumers:** T9 (gstack-codex-session-import)

## 本 spike 回答的问题

Codex sessions 的真实 on-disk format 是什么？我们如何从中 recover AskUserQuestion-shaped events，供 `gstack-codex-session-import` 使用？

## Storage layout

```
~/.codex/
├── auth.json                     # Codex auth (do not touch)
├── config.toml                   # User config
├── goals_1.sqlite                # ~24KB, internal goals DB (not relevant)
├── logs_2.sqlite                 # ~16MB, structured logs (target=*, see schema)
├── history.jsonl                 # ~9KB, command history
└── sessions/
    └── 2026/05/27/
        └── rollout-<iso8601>-<uuid>.jsonl   # per-session transcript
```

Session files：每个 `codex exec` 或 interactive session 对应一个 JSONL。Cwd path 嵌在 `session_meta` event 中。CLI version 会被记录。

## Session JSONL event types（在 Garry 机器上 measured，2026-05-27）

| type           | count | meaning |
|----------------|------:|---------|
| `response_item`|   382 | model response stream（约 76%） |
| `event_msg`    |    97 | high-level session events（约 19%） |
| `turn_context` |     6 | per-turn context snapshot |
| `session_meta` |     6 | session header（每个 session 一个） |

### response_item subtypes

| subtype                  | count | meaning |
|--------------------------|------:|---------|
| `function_call`          | 148   | model invoked tool |
| `function_call_output`   | 148   | tool result returned to model |
| `reasoning`              |  44   | reasoning summary |
| `message`                |  40   | text message（input_text 或 output_text） |
| `web_search_call`        |   2   | web search tool call |

### event_msg subtypes

| subtype           | count | meaning |
|-------------------|------:|---------|
| `token_count`     | 55    | per-step token accounting |
| `agent_message`   | 22    | agent prose output |
| `user_message`    |  6    | user prose input |
| `task_started`    |  6    | task start（每个 top-level task 一个） |
| `task_complete`   |  6    | task complete |
| `web_search_end`  |  2    | web search completion |

## Critical finding：Codex 没有 `AskUserQuestion` tool

Codex 不会在 `response_item` stream 中把 AskUserQuestion surface 为 tool call。运行在 Codex 上的 GStack skills 会把 AskUserQuestion-shaped Decision Briefs 作为 plain prose emit 到 `agent_message` events 中（来自 preamble 的 `AskUserQuestion Format`）。用户答案会回到下一个 `user_message`。

这意味着从 Codex sessions import AUQ events，在结构上不同于从 Claude Code import（在那里它们是 tool calls）：

- **Claude Code：**hook 捕获 `AskUserQuestion` 的 structured `tool_input`/`tool_output`。Question + options + answer 全部分离。
- **Codex：**parser 必须从 `agent_message.text` body extract，detect D-numbered Decision Brief pattern，然后 match subsequent `user_message` 作为 answer。

## `gstack-codex-session-import` 的 recovery strategy

**Two-tier extraction：**

1. **Marker-first（D18 mechanism）。** 搜索 `agent_message` text 中的 `<gstack-qid:foo-bar>` marker。如果存在，我们有 exact question_id，可以可靠 recover。（当 T14 把 markers 添加到 top 10 registry questions 且 Codex 通过 host-aware preamble path 开始 emit 后可用。）

2. **Pattern fallback。** 没有 marker 时，parse：
   - `D<N> — <title>` line（AskUserQuestion Format 中的 D-number）
   - `Recommendation: ...` line
   - Option block `A) ...`、`B) ...` 等
   - Next `user_message` event，用于 chosen option label

   仅用它 populate hash-based question_id（与 Claude 上 Layer 1 使用的 `hook-<sha1(skill+text+sorted_options)[:10]>` shape 相同）。Tagged `source: "codex-pattern-fallback"`，永不作为 preference key 使用（per D18 hash drift guidance）。

## 从 Codex import 写入 question-log.jsonl 的 schema

基于 existing `bin/gstack-question-log` schema，扩展：
- `source: "codex-import-marker"`（找到 qid marker 时）
- `source: "codex-import-pattern"`（使用 fallback regex 时）
- `codex_session_id`（来自 session_meta 的 UUID）
- `codex_cwd`（来自 session_meta 的 working dir，用于 disambiguate project）
- `codex_ts`（event timestamp）

## Sqlite logs_2.sqlite schema（Sqlite logs_2.sqlite schema）

```sql
CREATE TABLE logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  ts_nanos INTEGER NOT NULL,
  level TEXT NOT NULL,
  target TEXT NOT NULL,
  feedback_log_body TEXT,
  module_path TEXT,
  file TEXT,
  line INTEGER,
  thread_id TEXT,
  process_uuid TEXT,
  estimated_bytes INTEGER NOT NULL DEFAULT 0
);
```

`logs_2.sqlite` 是 internal telemetry，不是 session content。**不要用于 AUQ extraction。** Sessions JSONL 才是 authoritative。

## Project-slug derivation（project slug 推导）

从 `session_meta.payload.cwd` 读取，并对 cwd path 使用 existing `bin/gstack-slug` logic derive。Conductor worktrees 在 cwd 中 encode 自己的 slug naming convention；该 bin 已处理。

## Versioning safety

`session_meta.payload.cli_version` 记录 Codex CLI version（例如 `0.130.0`）。当 importer 遇到 unknown version，向 stderr log warning 但继续执行，因为 JSONL 中的 schema additions 通常 backwards-compatible。

如果 future version 中 `type` 或 `payload.type` values 改变，我们会在 importer audit log 中把它们看作 `unknown`。在 importer 中添加 guarded `KNOWN_VERSIONS = ["0.130.x", "0.131.x", ...]` constant，并在 re-testing 时显式 bump。

## Implementation open questions（实现 open questions）

1. **Codex 到底把 “user's answer” 存在哪里？** 需要用真实 `codex exec` run 触发 Decision Brief，并 inspect next event。可能是 subtype `user_message` 的 `event_msg`，或 subtype `message` 且 `role: "user"` 的 `response_item`。T9 implementation 期间确认。

2. **“Other” 的 free-text extraction。** Decision Brief prose 不会 structurally separate “Other” responses 和 named options。Pattern fallback 需要在 answer 中 detect "Other: <text>" wording。T10（dream cycle distill）仅在 source 是 `codex-import-marker` 时对它触发，这样可以信任 data。

3. **Conductor cwd handling。** Conductor worktrees 共享 project state，但 cwd 各不相同。Import 应按 project slug bucket events，而不是直接按 cwd，这样 sibling worktrees 的 events 会 accumulate 到同一 project view。

## References

- Live inspection of `~/.codex/sessions/2026/05/*/`
- `sqlite3 ~/.codex/logs_2.sqlite ".schema"`（2026-05-27）
- Codex CLI 0.130.0（spike time current）
- See also：plan file 中的 D5 cross-model tension decision。
