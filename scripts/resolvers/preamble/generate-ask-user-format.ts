import type { TemplateContext } from '../types';

export function generateAskUserFormat(_ctx: TemplateContext): string {
  return `## AskUserQuestion Format（AskUserQuestion 格式）

### Tool resolution（工具解析，先读）

"AskUserQuestion" 在 runtime 可解析为两类工具：**host MCP variant**（例如 \`mcp__conductor__AskUserQuestion\`，host 注册后会出现在你的 tool list 中）或 **native** Claude Code tool。

**规则：**如果 tool list 中存在任何 \`mcp__*__AskUserQuestion\` 变体，优先使用它。Hosts 可能通过 \`--disallowedTools AskUserQuestion\` 禁用 native AUQ（Conductor 默认如此），并改走 MCP variant；在这种 host 中调用 native 会静默失败。questions/options shape 相同；decision-brief 格式也相同。

**如果 tool list 中没有任何 AskUserQuestion 变体，此 skill 为 BLOCKED。**停止，报告 \`BLOCKED — AskUserQuestion unavailable\`，等待用户。不要把 decisions 写进 plan file 作为替代，不要用 prose 输出后停止，也不要静默 auto-decide（只有 \`/plan-tune\` 的 AUTO_DECIDE opt-ins 授权自动选择）。

### Format（格式）

每个 AskUserQuestion 都是 decision brief，必须作为 tool_use 发送，而不是 prose。

\`\`\`
D<N> — <一行问题标题>
Project/branch/task（项目/分支/任务）: <用 _BRANCH 写 1 句简短定位>
ELI10: <16 岁读者也能理解的 plain English/中文，2-4 句，点明 stakes>
选错的代价: <一句话说明会坏什么、用户会看到什么、会失去什么>
Recommendation（推荐）: <choice> because <一行理由>
Completeness（完整度）: A=X/10, B=Y/10   (or: Note: options differ in kind, not coverage — no completeness score)
Pros / cons（优缺点）:
A) <option label> (recommended)
  ✅ <pro — concrete, observable, ≥40 chars>
  ❌ <con — honest, ≥40 chars>
B) <option label>
  ✅ <pro>
  ❌ <con>
Net（权衡）: <一行总结真正的 tradeoff>
\`\`\`

D-numbering：一次 skill invocation 中的第一个问题是 \`D1\`；自行递增。这是 model-level instruction，不是 runtime counter。

ELI10 始终存在，用 plain English 或中文表达，不使用函数名。Recommendation 始终存在。保留 \`(recommended)\` label；AUTO_DECIDE 依赖它。

Completeness：仅当 options 的 coverage 不同时使用 \`Completeness: N/10\`。10 = complete，7 = happy path，3 = shortcut。如果 options 是类型不同而非 coverage 不同，写：\`Note: options differ in kind, not coverage — no completeness score.\`

Pros / cons（优缺点）：使用 ✅ 和 ❌。真实选择中，每个 option 至少 2 个 pros 和 1 个 con；每条 bullet 至少 40 个字符。单向/破坏性 confirmations 的 hard-stop escape：\`✅ 无缺点 — 这是 hard-stop choice\`。

Neutral posture：\`Recommendation: <default> — 这是 taste call，两边都没有强偏好\`；为 AUTO_DECIDE，\`(recommended)\` 保留在 default option 上。

Effort both-scales：当 option 涉及 effort 时，同时标注 human-team 和 CC+gstack 时间，例如 \`(human: ~2 days / CC: ~15 min)\`。这样在 decision time 能看见 AI compression。

Net line 用来收束 tradeoff。Per-skill instructions 可加入更严格规则。

### Handling 5+ options（5 个以上选项）— split，绝不丢弃

AskUserQuestion 每次调用最多 **4 options**。遇到 5 个以上真实 options 时，绝不
drop、merge 或静默 defer 某个 option 来凑数。选择一种合规形态：

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
所以 split chains 永远不 eligible for AUTO_DECIDE；用户的 option set 是 sacred 的。

**完整规则 + worked examples + Hold/dependency semantics：**见 gstack repo 中的
\`docs/askuserquestion-split.md\`。N>4 时按需读取。

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
- [ ] D<N> header 已存在
- [ ] ELI10 paragraph 已存在（stakes line 也有）
- [ ] Recommendation line 带 concrete reason
- [ ] 已打 Completeness score（coverage）或包含 kind-note（kind）
- [ ] 每个 option 都有 ≥2 ✅ 和 ≥1 ❌，每条 ≥40 chars（或使用 hard-stop escape）
- [ ] 一个 option 带 (recommended) label（neutral-posture 也要）
- [ ] 涉及 effort 的 options 有 dual-scale effort labels（human / CC）
- [ ] Net line 收束 decision
- [ ] 你在调用 tool，而不是写 prose
- [ ] Non-ASCII characters（CJK / accents）直接写入，没有 \\u-escape
- [ ] 如果有 5+ options，已经 split（或 batch 成 ≤4 组），没有丢弃任何 option
- [ ] 如果 split，发起 chain 前已检查 options 之间的 dependencies
- [ ] 如果某个 per-option Hold 触发，你立即停止 chain（没有继续排队）
`;
}
