# Chrome Sidebar + Conductor：我们需要什么

## 我们在构建什么

现在，当 Claude 在 Conductor workspace 中工作时，例如编辑文件、运行测试、浏览你的 app，你只能从 Conductor 的 chat window 里看进度。如果 Claude 正在对你的网站做 QA，你会看到 tool calls 不断滚动，但你无法真正*看见*浏览器。

我们构建了一个 Chrome sidebar 来解决这个问题。运行 `$B connect` 时，Chrome 会打开一个 side panel，实时显示 Claude 正在做的所有事。你可以在 sidebar 里输入消息，Claude 会照做，例如“click the signup button”、“go to the settings page”、“summarize what you see”。

问题是：sidebar 目前运行自己的独立 Claude instance。它看不到主 Conductor session 在做什么，主 session 也看不到 sidebar 在做什么。它们是两个互不通信的独立 agents。

修复思路很简单：让 sidebar 成为 Conductor session 的一个*窗口*，而不是一个独立事物。

## 我们需要 Conductor 提供什么（3 件事）

### 1. 让我们看到 agent 正在做什么

我们需要一种方式订阅 active session 的 events。类似 SSE stream 或 WebSocket，在事件发生时把它们发给我们：

- "Claude is editing `src/App.tsx`"
- "Claude is running `npm test`"
- "Claude says: I'll fix the CSS issue..."

sidebar 已经知道如何渲染这些 events：tool calls 显示为紧凑 badges，文本显示为 chat bubbles。我们只需要一条从 Conductor session 到 extension 的管道。

### 2. 让我们向 session 发送消息

当用户在 Chrome sidebar 中输入“click the other button”时，这条消息应该出现在 Conductor session 中，就像用户在 workspace chat 里输入的一样。agent 在下一轮接收它并执行。

这是关键体验：用户正在看 Chrome，发现有地方不对，在 sidebar 中输入修正，Claude 立刻响应，而用户完全不需要切换窗口。

### 3. 让我们从目录创建 workspace

`$B connect` 启动时会创建一个 git worktree 用于文件隔离。我们希望把这个 worktree 注册为 Conductor workspace，让用户能在 Conductor 的 file tree 中看到 sidebar agent 的文件改动。这也为多个 browser sessions 打基础：每个 session 都有自己的 workspace。

## 为什么重要

今天，`/qa` 和 `/design-review` 感觉像黑箱。Claude 说“I found 3 issues”，但你看不到它正在看什么。sidebar 连接到 Conductor 后：

- **你可以实时看 Claude 测试你的 app**：每一次点击、每一次导航、每一张截图都会出现在 Chrome 里。
- **你可以打断它**：比如“no, test the mobile view”或“skip that page”，不需要切换窗口。
- **一个 agent，两个视图**：同一个正在编辑代码的 Claude 也在控制浏览器。没有 context duplication，也没有 stale state。

## gstack 侧已经构建了什么

我们这边的内容已经完成并正在 shipping：

- 运行 `$B connect` 时会 auto-load 的 Chrome extension
- 会 auto-open 的 side panel（用户 zero setup）
- Streaming event renderer（tool calls、text、results）
- Chat input with message queuing
- 带 status banners 的 reconnect logic
- 带 persistent chat history 的 session management
- Agent lifecycle（spawn、stop、kill、timeout detection）

我们这边唯一需要改的是：把数据源从“local `claude -p` subprocess”切换为“Conductor session stream”。extension code 保持不变。

**预估工作量：** Conductor engineering 2-3 天，gstack integration 1 天。
