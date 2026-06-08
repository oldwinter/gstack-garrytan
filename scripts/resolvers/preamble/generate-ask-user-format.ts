import type { TemplateContext } from '../types';

export function generateAskUserFormat(_ctx: TemplateContext): string {
  return `## AskUserQuestion Format（AskUserQuestion 格式）

### Tool resolution（工具解析，先读）

"AskUserQuestion" 在 runtime 可解析为两类工具：**host MCP variant**（例如 \`mcp__conductor__AskUserQuestion\`，host 注册后会出现在你的 tool list 中）或 **native** Claude Code tool。

**规则：**如果 tool list 中存在任何 \`mcp__*__AskUserQuestion\` 变体，优先使用它。Hosts 可能通过 \`--disallowedTools AskUserQuestion\` 禁用 native AUQ（Conductor 默认如此），并改走 MCP variant；在这种 host 中调用 native 会静默失败。questions/options shape 相同；decision-brief 格式也相同。

如果 AskUserQuestion 不可用（tool list 中没有任何变体），或调用失败，不要静默 auto-decide，也不要把 decision 写进 plan file 作为替代。按下面的 **failure fallback** 处理。

### When AskUserQuestion is unavailable or a call fails（AskUserQuestion 不可用或调用失败时）

区分三种结果：

1. **Auto-decide denial（NOT a failure，不是 failure）。** 结果包含 \`[plan-tune auto-decide] <id> → <option>\`，表示 preference hook 按设计工作。继续使用该 option。不要 retry，不要 fallback 到 prose。
2. **真实 failure**：tool list 中没有变体，或存在变体但调用返回 error / missing result（MCP transport error、empty result、host bug，例如 Conductor 的 MCP AskUserQuestion 不稳定并返回 \`[Tool result missing due to internal error]\`）。
   - 如果变体存在且 **errored**（不是 absent），retry the SAME call **once**（同一个 call 只 retry 一次），但前提是 no answer could have surfaced（没有答案可能已经浮出）。missing-result error 可能在用户已经看到问题后到达；retry 会 double-prompt，所以如果它可能已经到达用户，就视为 pending，不要 retry。
   - 然后按 \`SESSION_KIND\` 分支（由 preamble echo；empty/absent ⇒ \`interactive\`）：
     - \`spawned\` → 交给 **Spawned session** block：auto-choose recommended option。Never prose，never BLOCKED。
     - \`headless\` → \`BLOCKED — AskUserQuestion unavailable\`；停止并等待（没有 human 可以回答）。
     - \`interactive\` → **prose fallback**（见下）。

**Prose fallback：把 decision brief 渲染成 markdown message，而不是 tool call。** 信息与下方 tool format 相同，但结构不同（paragraphs，不是 ✅/❌ bullets）。必须浮出这组三项：

1. **ELI10 of the issue itself（清楚解释 issue 本身的 ELI10）**：用 plain English/中文说明正在决定什么、为什么重要（是 question 本身，不是逐 choice），并命名 stakes。放在最前。
2. **Completeness scores per choice（每个 choice 的 Completeness scores）**：on EACH choice（每个 choice）都显式写 \`Completeness: X/10\`（10 complete，7 happy-path，3 shortcut）；当 options 是 kind 不同而非 coverage 不同时使用 kind-note，但绝不静默丢掉 score。
3. **Recommendation 和原因**：一行 \`Recommendation: <choice> because <reason>\`，并在该 choice 上带 \`(recommended)\` marker on that choice。

Layout：\`D<N>\` title + 一行说明 AskUserQuestion 失败并请用户用 letter 回复；issue ELI10；Recommendation line；然后 ONE paragraph per choice（每个 choice 一个 paragraph），包含 \`(recommended)\` marker、\`Completeness: X/10\` 和 2-4 句 reasoning，never a bare bullet list（绝不是 bare bullet list）；最后一行 \`Net:\`。Split chains / 5+ options：按顺序为每个 per-option call 输出一个 prose block。然后 STOP and wait，用户 typed answer 就是 decision。在 plan mode 中，这和 tool call 一样满足 end-of-turn。

### Format（格式）

每个 AskUserQuestion 都是 decision brief，must be sent as tool_use, not prose — unless the documented failure fallback（必须作为 tool_use 发送，而不是 prose，除非上方记录的 failure fallback）适用时（interactive session + call unavailable/erroring），此时 prose fallback 才是正确 output。

\`\`\`
D<N> — <一行问题标题>
Project/branch/task（项目/分支/任务）: <用 _BRANCH 写 1 句简短定位>
ELI10: <16 岁读者也能理解的 plain English/中文，2-4 句，点明 stakes>
Stakes if we pick wrong（选错的代价）: <一句话说明会坏什么、用户会看到什么、会失去什么>
Recommendation: <choice> because <一行理由>
Completeness（完整度）: A=X/10, B=Y/10   (or: Note: options differ in kind, not coverage — no completeness score)
Pros / cons:
A) <option label> (recommended)
  ✅ <pro — concrete, observable, ≥40 chars>
  ❌ <con — honest, ≥40 chars>
B) <option label>
  ✅ <pro>
  ❌ <con>
Net: <一行总结真正的 tradeoff>
\`\`\`

D-numbering：the first question in a skill invocation is \`D1\`（一次 skill invocation 中的第一个问题是 \`D1\`）；自行递增。这是 model-level instruction，不是 runtime counter；count your own questions。

ELI10 always present（始终存在），用 plain English 或中文表达；plain English enough for a 16-year-old，不使用函数名。Recommendation (ALWAYS) / Recommendation always present（始终存在）。保留 \`(recommended)\` label；AUTO_DECIDE 依赖它。

Completeness：仅当 options 的 coverage 不同时使用 \`Completeness: N/10\`。10 = complete，7 = happy path，3 = shortcut。如果 options 是类型不同而非 coverage 不同，写：\`Note: options differ in kind, not coverage — no completeness score.\`

Pros / cons: use ✅ and ❌. 真实选择中，Minimum 2 pros and minimum 1 con per option（每个 option 至少 2 个 pros 和 1 个 con）；Minimum 40 characters per bullet（每条 bullet 至少 40 个字符）。单向/破坏性 confirmations 的 hard-stop escape：\`✅ No cons — this is a hard-stop choice\`。

Neutral posture：\`Recommendation: <default> — 这是 taste call，两边都没有强偏好\`；为 AUTO_DECIDE，\`(recommended)\` label STAYS on default option。

Effort both-scales：当 option 涉及 effort 时，同时标注 human-team 和 CC+gstack 时间，例如 \`(human: ~2 days / CC: ~15 min)\`。这样在 decision time 能看见 AI compression。

Net line 用来收束 synthesis / tradeoff。Per-skill instructions may add 更严格规则。

### Handling 5+ options（5 个以上选项）— split，绝不丢弃

AskUserQuestion caps every call at **4 options**。遇到 5 个以上真实 options 时，NEVER
drop, merge, or silently defer（绝不丢弃、合并或静默延后）某个 option 来凑数。选择一种合规形态：

- **Batch into <=4-groups** — 用于 coherent alternatives（例如 version bumps、
  layout variants）。一次调用；只有当前 4 个不合适时才浮出第 5 个。
- **Split per-option** — 用于 independent scope items（例如 "ship E1..E6?"）。
  发起 N 个顺序调用，每个 option 一次。不确定时默认用这个。

Per-option call shape: \`D<N>.k\` header（例如 D3.1..D3.5）、每个 option 的 ELI10、
Recommendation、kind-note（不打 completeness score，因为 Include/Defer/Cut/Hold 是
decision actions），以及 4 个 buckets：
**A) Include（纳入）**, **B) Defer（延后）**, **C) Cut（删掉）**, **D) Hold（暂停链条，讨论）**。

chain 结束后，发起 \`D<N>.final\` 验证组装后的集合（遇到 dependency conflicts 则 reprompt），并确认是否 shipping。使用 \`D<N>.revise-<k>\` 修改单个 option，而不重跑整个 chain。

N>6 时，先发起 \`D<N>.0\` meta-AskUserQuestion（proceed / narrow / batch）。

split chains 的 question_ids：\`<skill>-split-<option-slug>\`（kebab-case ASCII，
<=64 chars，collision 时加 \`-2\`/\`-3\` suffix）。Runtime checker
（\`bin/gstack-question-preference\`）会拒绝任何 \`*-split-*\` id 上的 \`never-ask\`，
所以 split chains never AUTO_DECIDE-eligible（永远不 eligible for AUTO_DECIDE）；用户的 option set 是 sacred 的。

**完整规则 + worked examples + Hold/dependency semantics：**见 gstack repo 中的
\`docs/askuserquestion-split.md\`。Read on demand when N>4（N>4 时按需读取）。

**Non-ASCII characters — 直接写入，绝不 \\u-escape。**当任何
string field（question、option label、option description）包含中文（繁體/簡體）、
Japanese、Korean 或其他 non-ASCII text 时，在 JSON string 中输出 literal UTF-8
characters。**绝不要 escape 成 \`\\uXXXX\`。**Claude Code 的 tool parameter pipe
原生支持 UTF-8，会原样传递字符。手工 escaping 需要从训练中回忆每个 codepoint，
对长 CJK strings 不可靠；model 经常输出错误 codepoint（例如把 \`\\u3103\`
当成 管 U+7BA1，但 \`\\u3103\` 实际是 ㄃，用户看到的 \`管理工具\`
会渲染成 \`㄃3用箱\`）。触发场景通常是包含数百个 CJK characters 的 long
multi-line questions：这正是 reflexive escaping 最容易发生、miscoding 破坏性最大的时候。
Long != escape。保持 characters literal。

Wrong: \`"question": "請選擇\\uXXXX\\uXXXX\\uXXXX\\uXXXX"\`
Right: \`"question": "請選擇管理工具"\`

只有 JSON-mandatory escapes 仍允许：\`\\n\`、\`\\t\`、\`\\"\`、\`\\\\\`。
完整 rationale + worked example 见 \`docs/askuserquestion-cjk.md\`。当 question
包含 CJK 时按需读取。

### Self-check before emitting（发出前自检）

调用 AskUserQuestion 前，确认：
- [ ] D<N> header present（D<N> header 已存在）
- [ ] ELI10 paragraph 已存在（stakes line 也有）
- [ ] Recommendation line 带 concrete reason
- [ ] 已打 Completeness score（coverage）或包含 kind-note（kind）
- [ ] 每个 option 都有 ≥2 ✅ 和 ≥1 ❌，每条 ≥40 chars（或使用 hard-stop escape）
- [ ] 一个 option 带 (recommended) label（neutral-posture 也要）
- [ ] 涉及 effort 的 options 有 dual-scale effort labels（human / CC）
- [ ] Net line closes（Net line 收束 decision）
- [ ] 你在调用 tool，而不是写 prose；not writing prose — unless the documented failure fallback applies。此时要输出 prose，并带 mandatory triad：issue ELI10、per-choice Completeness、Recommendation + \`(recommended)\`，以及 "reply with a letter" instruction，然后 STOP
- [ ] Non-ASCII characters（CJK / accents）直接写入，没有 \\u-escape
- [ ] 如果有 5+ options，已经 split（或 batch 成 ≤4 组），没有丢弃任何 option
- [ ] 如果 split，发起 chain 前已检查 options 之间的 dependencies
- [ ] 如果某个 per-option Hold 触发，你立即停止 chain（没有继续排队）
`;
}
