# DX Hall of Fame Reference

只阅读当前 review pass 对应的 section。不要 load 整个 file。

## Pass 1: Getting Started

**Gold standards：**
- **Stripe**：7 lines of code 即可 charge a card。登录后 docs 会 pre-fill 你的 test API keys。Stripe Shell 可在 docs page 内运行 CLI。无需 local install。
- **Vercel**：`git push` = global CDN + HTTPS 上的 live site。每个 PR 都有 preview URL。一个 CLI command：`vercel`。
- **Clerk**：`<SignIn />`、`<SignUp />`、`<UserButton />`。3 个 JSX components，开箱即有 email、social、MFA auth。
- **Supabase**：创建一个 Postgres table，立即 auto-generates REST API + Realtime + self-documenting docs。
- **Firebase**：`onSnapshot()`。3 行实现所有 clients 的 real-time sync，并内置 offline persistence。
- **Twilio**：Console 里的 Virtual Phone。不买号码、无需 credit card 即可 send/receive SMS。结果：activation 提升 62%。

**Anti-patterns：**
- 在产生任何 value 前要求 email verification（breaks flow）
- Sandbox 前要求 credit card
- 多路径的 "Choose your own adventure"（decision fatigue；one golden path wins）
- API keys 藏在 settings 中（Stripe 会把它们 pre-fill 到 code examples）
- Static code examples 没有 language switching
- Docs site 与 dashboard 分离（context switching）

## Pass 2: API/CLI/SDK Design

**Gold standards：**
- **Stripe prefixed IDs**：charges 用 `ch_`，customers 用 `cus_`。Self-documenting。不可能传错 ID type。
- **Stripe expandable objects**：默认返回 ID strings。`expand[]` 可 inline 获取 full objects。Nested expansion 最多 4 levels。
- **Stripe idempotency keys**：Mutations 传 `Idempotency-Key` header。Safe retries。没有 "did I double-charge?" anxiety。
- **Stripe API versioning**：第一次调用把 account pin 到当天 version。通过 `Stripe-Version` header 按 request 测试 new versions。
- **GitHub CLI**：Auto-detects terminal vs pipe。Terminal 中 human-readable，pipe 时 tab-delimited。`gh pr <tab>` 显示所有 PR actions。
- **SwiftUI progressive disclosure**：从 `Button("Save") { save() }` 到 full customization，每个 level 都是同一 API。
- **htmx**：HTML attributes 替代 JS。总共 14KB。`hx-get="/search" hx-trigger="keyup changed delay:300ms"`。Zero build step。
- **shadcn/ui**：把 source code copy 到你的 project。你拥有每一行。No dependency，no version conflicts。

**Anti-patterns：**
- Chatty API：一个 user-visible action 需要 5 次 calls
- Inconsistent naming：`/users`（plural）vs `/user/123`（singular）vs `/create-order`（verb in URL）
- Implicit failure：200 OK，但 error nested in response body
- God endpoint：47 种 parameter combinations，每个 subset 行为不同
- Documentation-required API：第一次 call 前要读 3 pages docs = too much ceremony

## Pass 3: Error Messages & Debugging

**Three tiers of error quality：**

**Tier 1, Elm (Conversational Compiler):**
```
-- TYPE MISMATCH ---- src/Main.elm
I cannot do addition with String values like this one:
42|   "hello" + 1
     ^^^^^^^
Hint: To put strings together, use the (++) operator instead.
```
First person、complete sentences、exact location、suggested fix、further reading。

**Tier 2, Rust (Annotated Source):**
```
error[E0308]: mismatched types
 --> src/main.rs:4:20
help: consider borrowing here
  |
4 |     let name: &str = &get_name();
  |                       +
```
Error code 链接到 tutorial。Primary + secondary labels。Help section 展示 exact edit。

**Tier 3, Stripe API (Structured with doc_url):**
```json
{"error":{"type":"invalid_request_error","code":"resource_missing","message":"No such customer: 'cus_nonexistent'","param":"customer","doc_url":"https://stripe.com/docs/error-codes/resource-missing"}}
```
Five fields，zero ambiguity。

**The formula：** What happened + Why + How to fix + Where to learn more + Actual values that caused it。

**Anti-pattern：** TypeScript 把 "Did you mean?" 埋在 long error chains 的底部。Most actionable info 应该放在最前面。

## Pass 4: Documentation & Learning

**Gold standards：**
- **Stripe docs**：Three-column layout（nav / content / live code）。登录后注入 API keys。Language switcher 在所有 pages 间保持。Hover-to-highlight。Stripe Shell 支持 in-browser API calls。构建并开源 Markdoc。Docs finalized 前 features 不 ship。Docs contributions 会影响 performance reviews。
- 52% of developers 因缺少 documentation 被 blocked（Postman 2023）
- 拥有 world-class docs 的 companies adoption 提升 2.5x
- "Docs as product"：随 feature 一起 ship，否则 feature 不 ship

## Pass 5: Upgrade & Migration Path

**Gold standards：**
- **Next.js**：`npx @next/codemod upgrade major`。一个 command 升级 Next.js、React、React DOM，并运行所有 relevant codemods。
- **AG Grid**：v31+ 每个 release 都包含 codemod。
- **Stripe API versioning**：内部一个 codebase。按 account 做 version pinning。Breaking changes 永远不会突然砸到你。
- **Martin Fowler's pipeline pattern**：组合 small、testable transformations，而不是一个 monolithic codemod。
- Maven Central 中 21.9% 的 breaking changes 没有 documentation（Ochoa et al., 2021）

## Pass 6: Developer Environment & Tooling

**Gold standards：**
- **Bun**：比 npm install 快 100x，比 Node.js runtime 快 4x。Speed IS DX。
- 平均每天 87 次 interruptions；每次恢复需要 25 minutes。Devs 每天实际 code 只有 2-4 hours。
- DXI 每提升 1 point = 每位 developer 每周节省 13 minutes。
- **GitHub Copilot**：task completion 快 55.8%。PR time 从 9.6 days 降到 2.4 days。

## Pass 7: Community & Ecosystem

- Dev tools 在 purchase 前需要约 14 次 exposures（Matt Biilmann, Netlify）。这与 quarterly OKR cycles 不兼容。
- 拥有 strong developer experience 的 teams 有 4-5x performance multiplier（DevEx framework）。

## Pass 8: DX Measurement

**Three academic frameworks：**
1. **SPACE**（Microsoft Research, 2021）：Satisfaction、Performance、Activity、Communication、Efficiency。至少 measure 3 dimensions。
2. **DevEx**（ACM Queue, 2023）：Feedback Loops、Cognitive Load、Flow State。结合 perceptual + workflow data。
3. **Fagerholm & Munch**（IEEE, 2012）：Cognition、Affect、Conation。心理学里的 "trilogy of mind"。

## Claude Code Skill DX Checklist

Review Claude Code skills、MCP servers 或 AI agent tools 的 plans 时使用。

- [ ] **AskUserQuestion design**：每次 call 一个 issue。重新 ground context（project、branch、task）。Visual feedback 使用 browser handoff。
- [ ] **State storage**：Global（~/.tool/）vs per-project（$SLUG/）vs per-session。Audit trails 使用 append-only JSONL。
- [ ] **Progressive consent**：带 marker files 的 one-time prompts。Never re-ask。Reversible。
- [ ] **Auto-upgrade**：带 cache + snooze backoff 的 version check。Migration scripts。Inline offer。
- [ ] **Skill composition**：Benefits-from chains。Review chaining。Inline invocation with section skipping。
- [ ] **Error recovery**：从 failure resume。Partial results preserved。Checkpoint-safe。
- [ ] **Session continuity**：Timeline events。Compaction recovery。Cross-session learnings。
- [ ] **Bounded autonomy**：Clear operational limits。Destructive actions 必须 escalation。Audit trails。

Reference implementations：gstack 的 design-shotgun loop、auto-upgrade flow、progressive consent、hierarchical storage。
