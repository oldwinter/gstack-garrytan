# Design: Design Shotgun — Browser-to-Agent Feedback Loop（Browser 到 Agent 的反馈循环）

Generated（生成时间）：2026-03-27
Branch（分支）：garrytan/agent-design-tools
Status（状态）：LIVING DOCUMENT — 发现和修复 bugs 时持续更新

## 这个 feature 做什么

Design Shotgun 会生成多个 AI design mockups，在用户的真实 browser 中 side-by-side 打开为 comparison board，并收集 structured feedback（选择 favorite、给 alternatives 评分、留下 notes、请求 regeneration）。Feedback 会流回 coding agent，agent 根据 feedback 行动：要么继续 approved variant，要么生成 new variants 并 reload board。

用户永远不离开 browser tab。Agent 永远不问冗余问题。Board 本身就是 feedback mechanism。

## 核心问题：两个世界必须对话

```
  ┌─────────────────────┐          ┌──────────────────────┐
  │   USER'S BROWSER    │          │   CODING AGENT       │
  │   (real Chrome)     │          │   (Claude Code /     │
  │                     │          │    Conductor)         │
  │  Comparison board   │          │                      │
  │  with buttons:      │   ???    │  Needs to know:      │
  │  - Submit           │ ──────── │  - What was picked   │
  │  - Regenerate       │          │  - Star ratings      │
  │  - More like this   │          │  - Comments          │
  │  - Remix            │          │  - Regen requested?  │
  └─────────────────────┘          └──────────────────────┘
```

"???" 是困难部分。用户在 Chrome 中点击 button。运行在 terminal 里的 agent 需要知道这件事。这是两个完全分离的 processes，没有 shared memory、没有 shared event bus、没有 WebSocket connection。

## 架构：linkage 如何工作

```
  USER'S BROWSER                    $D serve (Bun HTTP)              AGENT
  ═══════════════                   ═══════════════════              ═════
       │                                   │                           │
       │  GET /                            │                           │
       │ ◄─────── serves board HTML ──────►│                           │
       │    (with __GSTACK_SERVER_URL      │                           │
       │     injected into <head>)         │                           │
       │                                   │                           │
       │  [user rates, picks, comments]    │                           │
       │                                   │                           │
       │  POST /api/feedback               │                           │
       │ ─────── {preferred:"A",...} ─────►│                           │
       │                                   │                           │
       │  ◄── {received:true} ────────────│                           │
       │                                   │── writes feedback.json ──►│
       │  [inputs disabled,                │   (or feedback-pending    │
       │   "Return to agent" shown]        │    .json for regen)       │
       │                                   │                           │
       │                                   │                  [agent polls
       │                                   │                   every 5s,
       │                                   │                   reads file]
```

### 三个文件

| File（文件） | Written when（写入时机） | Means（含义） | Agent action（agent 动作） |
|------|-------------|-------|-------------|
| `feedback.json` | User 点击 Submit | Final selection，已完成 | 读取它，然后继续 |
| `feedback-pending.json` | User 点击 Regenerate/More Like This | 想要 new options | 读取它，删除它，generate new variants，reload board |
| `feedback.json` (round 2+) | User 在 regeneration 后点击 Submit | Iteration 后的 final selection | 读取它，然后继续 |

### State Machine（状态机）

```
  $D serve starts
       │
       ▼
  ┌──────────┐
  │ SERVING  │◄──────────────────────────────────────┐
  │          │                                        │
  │ Board is │  POST /api/feedback                    │
  │ live,    │  {regenerated: true}                   │
  │ waiting  │──────────────────►┌──────────────┐     │
  │          │                   │ REGENERATING │     │
  │          │                   │              │     │
  └────┬─────┘                   │ Agent has    │     │
       │                         │ 10 min to    │     │
       │  POST /api/feedback     │ POST new     │     │
       │  {regenerated: false}   │ board HTML   │     │
       │                         └──────┬───────┘     │
       ▼                                │             │
  ┌──────────┐                POST /api/reload        │
  │  DONE    │                {html: "/new/board"}    │
  │          │                          │             │
  │ exit 0   │                          ▼             │
  └──────────┘                   ┌──────────────┐     │
                                 │  RELOADING   │─────┘
                                 │              │
                                 │ Board auto-  │
                                 │ refreshes    │
                                 │ (same tab)   │
                                 └──────────────┘
```

### Port Discovery（端口发现）

Agent 在后台运行 `$D serve`，并从 stderr 读取 port：

```
SERVE_STARTED: port=54321 html=/path/to/board.html
SERVE_BROWSER_OPENED: url=http://127.0.0.1:54321
```

Agent 从 stderr parse `port=XXXXX`。用户请求 regeneration 时，之后 POST `/api/reload` 需要这个 port。如果 agent 丢失 port number，就不能 reload board。

### 为什么是 127.0.0.1，而不是 localhost

`localhost` 在某些系统上会 resolve 到 IPv6 `::1`，而 Bun.serve() 只 listen IPv4。更重要的是，`localhost` 会发送 developer 正在处理的所有 domain 的 dev cookies。在 active sessions 很多的机器上，这会超过 Bun default header size limit（HTTP 431 error）。`127.0.0.1` 避免两个问题。

## 所有边界情况与陷阱

### 1. 僵尸表单问题

**现象：** 用户提交 feedback，POST 成功，server exits。但 HTML page 仍在 Chrome 中打开。它看起来仍可交互。用户可能编辑 feedback 并再次点击 Submit。什么都不会发生，因为 server 已经 gone。

**修复：** Successful POST 后，board JS：
- Disable ALL inputs（buttons、radios、textareas、star ratings）
- 完全隐藏 Regenerate bar
- 把 Submit button 替换为："Feedback received! Return to your coding agent."
- 显示："Want to make more changes? Run `/design-shotgun` again."
- Page 成为已提交内容的 read-only record

**实现位置：** `compare.ts:showPostSubmitState()` (line 484)

### 2. 服务器失联问题

**现象：** Server timeout（default 10 min）或 crash，而用户仍打开着 board。用户点击 Submit。fetch() 会静默失败。

**修复：** `postFeedback()` function 有 `.catch()` handler。Network failure 时：
- 显示 red error banner："Connection lost"
- 在可 copy 的 `<pre>` block 中显示 collected feedback JSON
- 用户可直接 copy-paste 到 coding agent

**实现位置：** `compare.ts:showPostFailure()` (line 546)

### 3. Stale regeneration spinner

**现象：** 用户点击 Regenerate。Board 显示 spinner，并每 2 秒 poll `/api/progress`。Agent crash 或生成 new variants 太久。Spinner 永远转。

**修复：** Progress polling 有 hard 5-minute timeout（150 polls x 2s interval）。5 分钟后：
- Spinner 替换为："Something went wrong."
- 显示："Run `/design-shotgun` again in your coding agent."
- Polling stops。Page 变为 informational。

**实现位置：** `compare.ts:startProgressPolling()` (line 511)

### 4. file:// URL 问题（THE ORIGINAL BUG）

**现象：** Skill template 最初使用 `$B goto file:///path/to/board.html`。但 `browse/src/url-validation.ts:71` 出于 security 会 block `file://` URLs。Fallback `open file://...` 打开用户的 macOS browser，但 `$B eval` poll 的是 Playwright headless browser（不同 process，根本没加载 page）。Agent 永远 poll empty DOM。

**修复：** `$D serve` 通过 HTTP serve。Board 永远不要用 `file://`。`$D compare` 上的 `--serve` flag 把 board generation 和 HTTP serving 合并为一个 command。

**证据：** 见 `.context/attachments/image-v2.png` — 真实用户 hit 了这个 exact bug。Agent 正确诊断：(1) `$B goto` rejects `file://` URLs，(2) 即使 browse daemon 存在也没有 polling loop。

### 5. Double-Click Race

**现象：** 用户快速点击 Submit 两次。两个 POST requests 到达 server。第一个把 state 设为 "done" 并安排 100ms 后 exit(0)。第二个在这个 100ms window 中到达。

**当前状态：** NOT fully guarded。`handleFeedback()` function 在 processing 前不检查 state 是否已经 "done"。第二个 POST 会成功，并写第二个 `feedback.json`（harmless，同样的数据）。Exit 仍在 100ms 后发生。

**风险：** Low。Board 在第一个 successful POST response 后会 disable all inputs，所以第二次 click 必须在约 1ms 内到达。而且两个 writes 会包含同样 feedback data。

**潜在修复：** 在 `handleFeedback()` 顶部添加 `if (state === 'done') return Response.json({error: 'already submitted'}, {status: 409})`。

### 6. 端口协调问题

**现象：** Agent 在后台运行 `$D serve` 并从 stderr parse `port=54321`。Regeneration 期间 agent 之后需要这个 port 来 POST `/api/reload`。如果 agent 丢失 context（conversation compresses、context window fills up），它可能不记得 port。

**当前状态：** Port 只打印到 stderr 一次。Agent 必须记住它。没有 port file 写入 disk。

**潜在修复：** Startup 时在 board HTML 旁写 `serve.pid` 或 `serve.port` file。Agent 随时可读取：
```bash
cat "$_DESIGN_DIR/serve.port"  # → 54321
```

### 7. Feedback file cleanup 问题

**现象：** Regeneration round 留下 `feedback-pending.json`。如果 agent 在读取前 crash，下一次 `$D serve` session 会看到 stale file。

**当前状态：** Resolver template 中的 polling loop 说读取后删除 `feedback-pending.json`。但这依赖 agent 完美遵循 instructions。Stale files 会 confuse new session。

**潜在修复：** `$D serve` startup 时检查并删除 stale feedback files。或者：用 timestamps 命名 files（`feedback-pending-1711555200.json`）。

### 8. Sequential Generate Rule

**现象：** 底层 OpenAI GPT Image API rate-limits concurrent image generation requests。当 3 个 `$D generate` calls parallel 运行时，1 个成功，2 个 aborted。

**修复：** Skill template 必须明确说："Generate mockups ONE AT A TIME. Do not parallelize `$D generate` calls." 这是 prompt-level instruction，不是 code-level lock。Design binary 不 enforce sequential execution。

**风险：** Agents 被训练为 parallelize independent work。如果没有 explicit instruction，它们会尝试同时运行 3 个 generates。这样浪费 API calls 和 money。

### 9. AskUserQuestion 冗余

**现象：** 用户通过 board 提交 feedback 后（preferred variant、ratings、comments 都在 JSON 中），agent 又问他们："Which variant do you prefer?" 这很烦。Board 的全部意义就是避免这个。

**修复：** Skill template 必须说："不要用 AskUserQuestion 询问用户偏好。读取 `feedback.json`，其中包含用户的 selection。AskUserQuestion 只用于确认你理解正确，不要重复询问。"

### 10. CORS 问题

**现象：** 如果 board HTML 引用 external resources（fonts、CDN images），browser 会带 `Origin: http://127.0.0.1:PORT` 发送 requests。大多数 CDNs 允许，但有些可能 block。

**当前状态：** Server 不设置 CORS headers。Board HTML 是 self-contained（images base64-encoded、styles inline），所以实践中没出现问题。

**风险：** 对 current design 低。如果 board 加载 external resources 才重要。

### 11. 大 payload 问题

**现象：** `/api/feedback` 的 POST bodies 没有 size limit。如果 board somehow 发送 multi-MB payload，`req.json()` 会全部 parse 到 memory。

**当前状态：** 实践中 feedback JSON 约 500 bytes 到 2KB。风险是 theoretical，不 practical。Board JS 构造 fixed-shape JSON object。

### 12. fs.writeFileSync Error

**现象：** `serve.ts:138` 中写 `feedback.json` 使用 `fs.writeFileSync()`，没有 try/catch。如果 disk full 或 directory read-only，会 throw 并 crash server。用户看到 spinner forever（server dead，但 board 不知道）。

**风险：** 实践中低（board HTML 刚刚写到同一 directory，证明 writable）。但 try/catch 加 500 response 更干净。

## Complete Flow（完整流程，Step by Step）

### Happy Path：用户第一次就选中

```
1. Agent 运行：$D compare --images "A.png,B.png,C.png" --output board.html --serve &
2. $D serve 在随机 port（例如 54321）启动 Bun.serve()
3. $D serve 在用户 browser 中打开 http://127.0.0.1:54321
4. $D serve 向 stderr 打印：SERVE_STARTED: port=54321 html=/path/board.html
5. $D serve 写入已注入 __GSTACK_SERVER_URL 的 board HTML
6. User 看到包含 3 个 variants 的 side-by-side comparison board
7. User 选择 Option B，并为 A: 3/5、B: 5/5、C: 2/5 评分
8. User 在 overall feedback 中写入 "B has better spacing, go with that"
9. User 点击 Submit
10. Board JS POST 到 http://127.0.0.1:54321/api/feedback
    Body: {"preferred":"B","ratings":{"A":3,"B":5,"C":2},"overall":"B has better spacing","regenerated":false}
11. Server 把 feedback.json 写到 disk（board.html 旁边）
12. Server 把 feedback JSON 打印到 stdout
13. Server 响应 {received:true, action:"submitted"}
14. Board 禁用所有 inputs，并显示 "Return to your coding agent"
15. Server 在 100ms 后以 code 0 退出
16. Agent 的 polling loop 找到 feedback.json
17. Agent 读取它，向 user 总结，然后继续
```

### Regeneration Path（重新生成路径）：用户想要不同 options

```
1-6.  同上
7.  User 点击 "Totally different" chiclet
8.  User 点击 Regenerate
9.  Board JS POST 到 /api/feedback
    Body: {"regenerated":true,"regenerateAction":"different","preferred":"","ratings":{},...}
10. Server 把 feedback-pending.json 写到 disk
11. Server state → "regenerating"
12. Server 响应 {received:true, action:"regenerate"}
13. Board 显示 spinner："Generating new designs..."
14. Board 开始每 2s polling GET /api/progress

    同时，在 agent 侧：
15. Agent 的 polling loop 找到 feedback-pending.json
16. Agent 读取并删除它
17. Agent 运行：$D variants --brief "totally different direction" --count 3
    （ONE AT A TIME，不要 parallel）
18. Agent 运行：$D compare --images "new-A.png,new-B.png,new-C.png" --output board-v2.html
19. Agent POST：curl -X POST http://127.0.0.1:54321/api/reload -d '{"html":"/path/board-v2.html"}'
20. Server 把 htmlContent 切换为 new board
21. Server state → "serving"（来自 reloading）
22. Board 下一次 /api/progress poll 返回 {"status":"serving"}
23. Board 自动刷新：window.location.reload()
24. User 看到包含 3 个 fresh variants 的 new board
25. User 选择一个并点击 Submit → 从 step 10 进入 happy path
```

### "More Like This" Path（更多类似方案路径）

```
Same as regeneration, except:
与 regeneration 相同，区别是：
- regenerateAction 是 "more_like_B"（引用该 variant）
- Agent 使用 $D iterate --image B.png --brief "more like this, keep the spacing"
  而不是 $D variants
```

### Fallback Path（降级路径）：$D serve fails

```
1. Agent 尝试 $D compare --serve，但失败（binary missing、port error 等）
2. Agent fallback 到：open file:///path/board.html
3. Agent 使用 AskUserQuestion："I've opened the design board. Which variant
   do you prefer? Any feedback?"
4. User 用 text 回复
5. Agent 基于 text feedback 继续（没有 structured JSON）
```

## 实现文件

| File（文件） | Role（职责） |
|------|------|
| `design/src/serve.ts` | HTTP server、state machine、file writing、browser launch |
| `design/src/compare.ts` | Board HTML generation、ratings/picks/regen 用 JS、POST logic、post-submit lifecycle |
| `design/src/cli.ts` | CLI entry point，连接 `serve` 和 `compare --serve` commands |
| `design/src/commands.ts` | Command registry，定义 `serve` 和 `compare` 及其 args |
| `scripts/resolvers/design.ts` | `generateDesignShotgunLoop()` — 输出 polling loop 和 reload instructions 的 template resolver |
| `design-shotgun/SKILL.md.tmpl` | 编排完整 flow 的 skill template：context gathering、variant generation、`{{DESIGN_SHOTGUN_LOOP}}`、feedback confirmation |
| `design/test/serve.test.ts` | HTTP endpoints 和 state transitions 的 unit tests |
| `design/test/feedback-roundtrip.test.ts` | E2E test：browser click → JS fetch → HTTP POST → file on disk |
| `browse/test/compare-board.test.ts` | Comparison board UI 的 DOM-level tests |

## 仍可能出什么问题

### Known Risks（按 likelihood 排序）

1. **Agent 不遵循 sequential generate rule** — 大多数 LLMs 倾向 parallelize。没有 binary enforcement 时，这条 prompt-level instruction 可能被忽略。

2. **Agent 丢失 port number** — context compression 丢掉 stderr output。Agent 无法 reload board。Mitigation：把 port 写入 file。

3. **Stale feedback files** — crashed session 留下的 `feedback-pending.json` 会 confuse next run。Mitigation：startup 时 clean。

4. **fs.writeFileSync crash** — feedback file write 没有 try/catch。Disk full 时 server 会 silent death。用户看到 infinite spinner。

5. **Progress polling drift** — `setInterval(fn, 2000)` 持续 5 分钟。实践中 JavaScript timers 足够准确。但如果 browser tab backgrounded，Chrome 可能 throttle intervals 到每分钟一次。

### Things That Work Well（效果好的部分）

1. **Dual-channel feedback** — foreground mode 用 stdout，background mode 用 files。二者始终 active。Agent 用哪个都行。

2. **Self-contained HTML** — board 把 CSS、JS、base64-encoded images 全部 inline。无 external dependencies。Offline works。

3. **Same-tab regeneration** — 用户留在一个 tab。Board 通过 `/api/progress` polling + `window.location.reload()` auto-refresh。没有 tab explosion。

4. **Graceful degradation** — POST failure 显示 copyable JSON。Progress timeout 显示 clear error message。没有 silent failures。

5. **Post-submit lifecycle** — submit 后 board 变 read-only。没有 zombie forms。清楚提示 “what to do next”。

## Test Coverage（测试覆盖）

### 已测试什么

| Flow（流程） | Test（测试） | File（文件） |
|------|------|------|
| Submit → feedback.json on disk | browser click → file | `feedback-roundtrip.test.ts` |
| Post-submit UI lockdown | inputs disabled, success shown | `feedback-roundtrip.test.ts` |
| Regenerate → feedback-pending.json | chiclet + regen click → file | `feedback-roundtrip.test.ts` |
| "More like this" → specific action | JSON 中的 more_like_B | `feedback-roundtrip.test.ts` |
| Spinner after regenerate | DOM 显示 loading text | `feedback-roundtrip.test.ts` |
| Full regen → reload → submit | 2-round trip | `feedback-roundtrip.test.ts` |
| Server starts on random port | port 0 binding | `serve.test.ts` |
| HTML injection of server URL | __GSTACK_SERVER_URL check | `serve.test.ts` |
| Invalid JSON rejection | 400 response | `serve.test.ts` |
| HTML file validation | 缺失时 exit 1 | `serve.test.ts` |
| Timeout behavior | timeout 后 exit 1 | `serve.test.ts` |
| Board DOM structure | radios、stars、chiclets | `compare-board.test.ts` |

### 未测试什么

| 缺口 | 风险 | 优先级 |
|-----|------|----------|
| Double-click submit race | Low — inputs 在 first response 后 disable | P3 |
| Progress polling timeout（150 iterations） | Medium — 5 min 在 test 里等待很久 | P2 |
| Server crash during regeneration | Medium — user 会看到 infinite spinner | P2 |
| Network timeout during POST | Low — localhost 很快 | P3 |
| Backgrounded Chrome tab throttling intervals | Medium — 可能把 5-min timeout 拉长到 30+ min | P2 |
| Large feedback payload | Low — board 构造 fixed-shape JSON | P3 |
| Concurrent sessions（two boards, one server） | Low — 每个 $D serve 都有自己的 port | P3 |
| Stale feedback file from prior session | Medium — 可能 confuse new polling loop | P2 |

## Potential Improvements（潜在改进）

### Short-term（this branch）

1. **Write port to file** — `serve.ts` startup 时把 `serve.port` 写到 disk。Agent 随时可读。5 行。
2. **Clean stale files on startup** — `serve.ts` starting 前删除 `feedback*.json`。3 行。
3. **Guard double-click** — 在 `handleFeedback()` 顶部检查 `state === 'done'`。2 行。
4. **try/catch file write** — 用 try/catch 包住 `fs.writeFileSync`，失败时 return 500。5 行。

### Medium-term（follow-up）

5. **WebSocket instead of polling** — 用 WebSocket connection 替换 `setInterval` + `GET /api/progress`。New HTML ready 时 board 获得 instant notification。Eliminates polling drift and backgrounded-tab throttling。serve.ts 约 50 行 + compare.ts 约 20 行。

6. **Port file for agent** — 向 `$_DESIGN_DIR/serve.json` 写 `{"port": 54321, "pid": 12345, "html": "/path/board.html"}`。Agent 读取它，而不是 parse stderr。让系统对 context loss 更 robust。

7. **Feedback schema validation** — 写入前用 JSON schema validate POST body。早期捕获 malformed feedback，避免 downstream confuse agent。

### Long-term（design direction）

8. **Persistent design server** — 不再每次 session launch `$D serve`，而是运行 long-lived design daemon（像 browse daemon）。多个 boards 共享一个 server。Eliminates cold start。但增加 daemon lifecycle management complexity。

9. **Real-time collaboration** — 两个 agents（或一个 agent + 一个 human）同时在同一个 board 上工作。Server 通过 WebSocket broadcast state changes。需要 feedback conflict resolution。
