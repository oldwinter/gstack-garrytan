# Conductor Session Streaming API Proposal（提案）

## 问题

当 Claude 通过 CDP 控制你的真实 browser（gstack `$B connect`）时，你会看两个 windows：**Conductor**（看 Claude thinking）和 **Chrome**（看 Claude actions）。

gstack 的 Chrome extension Side Panel 会展示 browse activity：每条 command、result 和 error。但要做 *full* session mirroring（Claude thinking、tool calls、code edits），Side Panel 需要 Conductor 暴露 conversation stream。

## 这会带来什么

gstack Chrome extension Side Panel 中的 "Session" tab，显示：
- Claude thinking/content（出于 performance 会截断）
- Tool call names + icons（Edit、Bash、Read 等）
- 带 cost estimates 的 turn boundaries
- Conversation progress 的 real-time updates

用户在一个地方看到所有东西：browser 中的 Claude actions + Side Panel 中的 Claude thinking，无需切换 windows。

## Proposed API（拟议 API）

### `GET http://127.0.0.1:{PORT}/workspace/{ID}/session/stream`

Server-Sent Events endpoint，把 Claude Code conversation 重新 emit 为 NDJSON events。

**Event types（事件类型）**（复用 Claude Code 的 `--output-format stream-json` format）：

```
event: assistant
data: {"type":"assistant","content":"Let me check that page...","truncated":true}

event: tool_use
data: {"type":"tool_use","name":"Bash","input":"$B snapshot","truncated_input":true}

event: tool_result
data: {"type":"tool_result","name":"Bash","output":"[snapshot output...]","truncated_output":true}

event: turn_complete
data: {"type":"turn_complete","input_tokens":1234,"output_tokens":567,"cost_usd":0.02}
```

**Content truncation：**Stream 中 tool inputs/outputs capped at 500 chars。Full data 留在 Conductor UI 中。Side Panel 是 summary view，不是 replacement。

### `GET http://127.0.0.1:{PORT}/api/workspaces`

Discovery endpoint，列出 active workspaces。

```json
{
  "workspaces": [
    {
      "id": "abc123",
      "name": "gstack",
      "branch": "garrytan/chrome-extension-ctrl",
      "directory": "/Users/garry/gstack",
      "pid": 12345,
      "active": true
    }
  ]
}
```

Chrome extension 会通过把 browse server 的 git repo（来自 `/health` response）匹配到 workspace directory 或 name，auto-select workspace。

## Security（安全）

- **Localhost-only。** 与 Claude Code 自身 debug output 相同的 trust model。
- **No auth required（无需认证）。** 如果 Conductor 想要 auth，在 workspace listing 中 include Bearer token，extension 会在 SSE requests 中传递。
- **Content truncation（内容截断）** 是 privacy feature：long code outputs、file contents 和 sensitive tool results 永远不会离开 Conductor full UI。

## gstack 构建什么（extension side）

Side Panel "Session" tab 已 scaffold（目前显示 placeholder）。

当 Conductor API 可用时：
1. Side Panel 通过 port probe 或 manual entry discover Conductor
2. Fetch `/api/workspaces`，match 到 browse server repo
3. 打开到 `/workspace/{id}/session/stream` 的 `EventSource`
4. Render：assistant messages、tool names + icons、turn boundaries、cost
5. 优雅 fallback："Connect Conductor for full session view"

Estimated effort（工作量估计）：`sidepanel.js` 中约 200 LOC。

## Conductor 构建什么（server side）

1. SSE endpoint，按 workspace re-emit Claude Code stream-json
2. `/api/workspaces` discovery endpoint，包含 active workspace list
3. Content truncation（tool inputs/outputs 500 char cap）

如果 Conductor 已经 internally captures Claude Code stream（它确实为了自己的 UI rendering 这么做），estimated effort（工作量估计）约 100-200 LOC。

## Design decisions（设计决策）

| Decision（决策） | Choice（选择） | Rationale（理由） |
|----------|--------|-----------|
| Transport | SSE（not WebSocket） | Unidirectional、auto-reconnect、simpler |
| Format | Claude's stream-json | Conductor 已 parse 这个；不需要 new schema |
| Discovery | HTTP endpoint（not file） | Chrome extensions 不能读取 filesystem |
| Auth | None（localhost） | 与 browse server、CDP port、Claude Code 相同 |
| Truncation | 500 chars | Side Panel 约 300px wide；long content useless |
