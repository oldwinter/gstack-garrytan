/**
 * Review Army resolver — /review 的 parallel specialist reviewers。
 *
 * 生成 template prose，指示 Claude：
 * 1. Detect stack and scope（通过 gstack-diff-scope）
 * 2. 并行选择并 dispatch specialist subagents
 * 3. 收集、parse、merge 和 deduplicate JSON findings
 * 4. 将 merged findings 输入现有 Fix-First pipeline
 *
 * 作为 self-learning roadmap（SELF_LEARNING_V0.md）的 Release 2 shipped。
 */
import type { TemplateContext } from './types';

function generateSpecialistSelection(ctx: TemplateContext): string {
  const isShip = ctx.skillName === 'ship';
  const stepSel = isShip ? '9.1' : '4.5';
  const stepMerge = isShip ? '9.2' : '4.6';
  const nextStep = isShip ? 'Fix-First flow（item 4）' : 'Step 5';
  return `## Step ${stepSel}: Review Army — Specialist Dispatch（专家派发）

### Detect stack and scope（检测 stack 和 scope）

\`\`\`bash
source <(${ctx.paths.binDir}/gstack-diff-scope <base> 2>/dev/null) || true
# 检测 stack，供 specialist context 使用
STACK=""
[ -f Gemfile ] && STACK="\${STACK}ruby "
[ -f package.json ] && STACK="\${STACK}node "
[ -f requirements.txt ] || [ -f pyproject.toml ] && STACK="\${STACK}python "
[ -f go.mod ] && STACK="\${STACK}go "
[ -f Cargo.toml ] && STACK="\${STACK}rust "
echo "STACK: \${STACK:-unknown}"
DIFF_BASE=$(git merge-base origin/<base> HEAD)
DIFF_INS=$(git diff "$DIFF_BASE" --stat | tail -1 | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo "0")
DIFF_DEL=$(git diff "$DIFF_BASE" --stat | tail -1 | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' || echo "0")
DIFF_LINES=$((DIFF_INS + DIFF_DEL))
echo "DIFF_LINES: $DIFF_LINES"
# 检测 test framework，供 specialist test stub generation 使用
TEST_FW=""
{ [ -f jest.config.ts ] || [ -f jest.config.js ]; } && TEST_FW="jest"
[ -f vitest.config.ts ] && TEST_FW="vitest"
{ [ -f spec/spec_helper.rb ] || [ -f .rspec ]; } && TEST_FW="rspec"
{ [ -f pytest.ini ] || [ -f conftest.py ]; } && TEST_FW="pytest"
[ -f go.mod ] && TEST_FW="go-test"
echo "TEST_FW: \${TEST_FW:-unknown}"
\`\`\`

### 读取 specialist hit rates（adaptive gating）

\`\`\`bash
${ctx.paths.binDir}/gstack-specialist-stats 2>/dev/null || true
\`\`\`

### Select specialists（选择专家）

基于上方 scope signals，选择要 dispatch 的 specialists。

**Always-on（每次 review 有 50+ changed lines 时都 dispatch）：**
1. **Testing** — 读取 \`${ctx.paths.skillRoot}/review/specialists/testing.md\`
2. **Maintainability** — 读取 \`${ctx.paths.skillRoot}/review/specialists/maintainability.md\`

**如果 DIFF_LINES < 50：** 跳过所有 specialists。打印："Small diff ($DIFF_LINES lines) — specialists skipped." Continue to ${nextStep}。

**Conditional（matching scope signal 为 true 时 dispatch）：**
3. **Security** — 如果 SCOPE_AUTH=true，或 SCOPE_BACKEND=true 且 DIFF_LINES > 100。读取 \`${ctx.paths.skillRoot}/review/specialists/security.md\`
4. **Performance** — 如果 SCOPE_BACKEND=true 或 SCOPE_FRONTEND=true。读取 \`${ctx.paths.skillRoot}/review/specialists/performance.md\`
5. **Data Migration** — 如果 SCOPE_MIGRATIONS=true。读取 \`${ctx.paths.skillRoot}/review/specialists/data-migration.md\`
6. **API Contract** — 如果 SCOPE_API=true。读取 \`${ctx.paths.skillRoot}/review/specialists/api-contract.md\`
7. **Design** — 如果 SCOPE_FRONTEND=true。使用现有 design review checklist：\`${ctx.paths.skillRoot}/review/design-checklist.md\`

### Adaptive gating

完成 scope-based selection 后，基于 specialist hit rates 应用 adaptive gating：

对每个通过 scope gating 的 conditional specialist，检查上方 \`gstack-specialist-stats\` output：
- 如果标记 \`[GATE_CANDIDATE]\`（10+ dispatches 中 0 findings）：跳过它。打印："[specialist] auto-gated (0 findings in N reviews)."
- 如果标记 \`[NEVER_GATE]\`：无论 hit rate 如何都 always dispatch。Security 和 data-migration 是 insurance policy specialists — 即使经常 silent 也应该运行。

**Force flags:** 如果用户 prompt 包含 \`--security\`、\`--performance\`、\`--testing\`、\`--maintainability\`、\`--data-migration\`、\`--api-contract\`、\`--design\` 或 \`--all-specialists\`，无论 gating 如何都 force-include 对应 specialist。

记录哪些 specialists 被 selected、gated 和 skipped。打印 selection：
"Dispatching N specialists: [names]. Skipped: [names] (scope not detected). Gated: [names] (0 findings in N+ reviews)."`;
}

function generateSpecialistDispatch(ctx: TemplateContext): string {
  return `### Dispatch specialists in parallel（并行派发 specialists）

对每个 selected specialist，通过 Agent tool launch 一个 independent subagent。
**在一条 message 中 launch ALL selected specialists**（multiple Agent tool calls），
让它们 parallel 运行。每个 subagent 都有 fresh context — 没有 prior review bias。

**Each specialist subagent prompt（每个 specialist subagent 的 prompt）：**

为每个 specialist 构造 prompt。Prompt 包含：

1. specialist 的 checklist content（你已经读取了上方 file）
2. Stack context："This is a {STACK} project."
3. 该 domain 的 past learnings（如果存在）：

\`\`\`bash
${ctx.paths.binDir}/gstack-learnings-search --type pitfall --query "{specialist domain}" --limit 5 2>/dev/null || true
\`\`\`

如果找到 learnings，包含它们："Past learnings for this domain: {learnings}"

4. Instructions（指令）：

"你是 specialist code reviewer。阅读下方 checklist，然后运行
\`DIFF_BASE=$(git merge-base origin/<base> HEAD) && git diff "$DIFF_BASE"\` 获取完整 diff。将 checklist 应用于该 diff。

对每个 finding，单独一行输出一个 JSON object：
{\\"severity\\":\\"CRITICAL|INFORMATIONAL\\",\\"confidence\\":N,\\"path\\":\\"file\\",\\"line\\":N,\\"category\\":\\"category\\",\\"summary\\":\\"description\\",\\"fix\\":\\"recommended fix\\",\\"fingerprint\\":\\"path:line:category\\",\\"specialist\\":\\"name\\"}

Required fields：severity、confidence、path、category、summary、specialist。
Optional：line、fix、fingerprint、evidence、test_stub。

如果你能写一个会捕获此 issue 的 test，把它放进 \`test_stub\` field。
使用检测到的 test framework（{TEST_FW}）。写 minimal skeleton：describe/it/test
blocks 要有明确 intent。Architectural 或 design-only findings 跳过 test_stub。

如果没有 findings：只输出 \`NO FINDINGS\`，不要输出其他内容。
不要输出任何其他内容：no preamble、no summary、no commentary。

Stack context: {STACK}
Past learnings: {learnings or 'none'}

CHECKLIST:
{checklist content}"

**Subagent configuration（subagent 配置）：**
- 使用 \`subagent_type: "general-purpose"\`
- Do NOT use \`run_in_background\` — merge 前所有 specialists 必须完成
- 如果任何 specialist subagent 失败或 timeout，记录 failure，并用 successful specialists 的 results 继续。Specialists 是 additive — partial results 比 no results 更好。`;
}

function generateFindingsMerge(ctx: TemplateContext): string {
  const isShip = ctx.skillName === 'ship';
  const stepMerge = isShip ? '9.2' : '4.6';
  const stepSel = isShip ? '9.1' : '4.5';
  const fixFirstRef = isShip ? 'Fix-First flow（item 4）' : 'Step 5 Fix-First';
  const critPassRef = isShip ? 'checklist pass（Step 9）' : 'Step 4 的 CRITICAL pass findings';
  const persistRef = isShip ? 'review-log persist' : 'Step 5.8 的 review-log entry';
  return `### Step ${stepMerge}: Collect and merge findings（收集并合并 findings）

所有 specialist subagents 完成后，收集它们的 outputs。

**Parse findings（解析 findings）：**
对每个 specialist 的 output：
1. 如果 output 是 "NO FINDINGS" — skip，这个 specialist 没有发现问题
2. 否则，将每一行 parse 为 JSON object。跳过 invalid JSON lines。
3. 将所有 parsed findings 收集到单个 list，并带上 specialist name tag。

**Fingerprint and deduplicate（指纹与去重）：**
对每个 finding，计算 fingerprint：
- 如果存在 \`fingerprint\` field，使用它
- 否则：\`{path}:{line}:{category}\`（如果存在 line）或 \`{path}:{category}\`

按 fingerprint group findings。对共享同一 fingerprint 的 findings：
- 保留 confidence score 最高的 finding
- 标记："MULTI-SPECIALIST CONFIRMED ({specialist1} + {specialist2})"
- Confidence +1（cap at 10）
- 在 output 中 note confirming specialists

**Apply confidence gates（应用置信度 gates）：**
- Confidence 7+：在 findings output 中正常展示
- Confidence 5-6：带 caveat 展示："Medium confidence — verify this is actually an issue"
- Confidence 3-4：移到 appendix（从 main findings 中 suppress）
- Confidence 1-2：完全 suppress

**Compute PR Quality Score（计算 PR 质量分）：**
Merge 后，计算 quality score：
\`quality_score = max(0, 10 - (critical_count * 2 + informational_count * 0.5))\`
Cap at 10。在最后的 review result 中记录它。

**Output merged findings（输出合并后的 findings）：**
用与当前 review 相同的 format 呈现 merged findings：

\`\`\`
SPECIALIST REVIEW: N findings (X critical, Y informational) from Z specialists

[For each finding, in order: CRITICAL first, then INFORMATIONAL, sorted by confidence descending]
[SEVERITY] (confidence: N/10, specialist: name) path:line — summary
  Fix: recommended fix
  [If MULTI-SPECIALIST CONFIRMED: show confirmation note]

PR Quality Score: X/10
\`\`\`

这些 findings 会和 ${critPassRef} 一起进入 ${fixFirstRef}。
Fix-First heuristic 同样适用 — specialist findings 遵循相同 AUTO-FIX vs ASK classification。

**Compile per-specialist stats（编译每个 specialist 的 stats）：**
Merge findings 后，为 ${persistRef} 编译 \`specialists\` object。
对每个 specialist（testing、maintainability、security、performance、data-migration、api-contract、design、red-team）：
- 如果 dispatched：\`{"dispatched": true, "findings": N, "critical": N, "informational": N}\`
- 如果因为 scope skipped：\`{"dispatched": false, "reason": "scope"}\`
- 如果因为 gating skipped：\`{"dispatched": false, "reason": "gated"}\`
- 如果 not applicable（例如 red-team 未 activated）：从 object 中 omit

包含 Design specialist，即使它使用 \`design-checklist.md\` 而不是 specialist schema files。
记住这些 stats — Step 5.8 的 review-log entry 会需要它们。`;
}

function generateRedTeam(ctx: TemplateContext): string {
  const isShip = ctx.skillName === 'ship';
  const stepMerge = isShip ? '9.2' : '4.6';
  const fixFirstRef = isShip ? 'Fix-First flow（item 4）' : 'Step 5 Fix-First';
  return `### Red Team dispatch（conditional）

**Activation:** 仅当 DIFF_LINES > 200，或任一 specialist 产生 CRITICAL finding。

如果 activated，通过 Agent tool 再 dispatch 一个 subagent（foreground，不是 background）。

Red Team subagent 接收：
1. 来自 \`${ctx.paths.skillRoot}/review/specialists/red-team.md\` 的 red-team checklist
2. Step ${stepMerge} 的 merged specialist findings（让它知道哪些已经 caught）
3. git diff command

Prompt: "你是 red team reviewer。这段 code 已经由 N 个 specialists review 过，他们发现了以下 issues：{merged findings summary}。你的工作是找出他们 MISSED 的内容。阅读 checklist，运行 \`DIFF_BASE=$(git merge-base origin/<base> HEAD) && git diff "$DIFF_BASE"\`，并寻找 gaps。
Findings 以 JSON objects 输出（与 specialists 使用相同 schema）。重点关注 specialist checklists 没覆盖的 cross-cutting concerns、integration boundary issues 和 failure modes。"

如果 Red Team 找到 additional issues，在 ${fixFirstRef} 之前将它们 merge 进 findings list。
Red Team findings 标记为 \`"specialist":"red-team"\`。

如果 Red Team 返回 NO FINDINGS，note："Red Team review: no additional issues found."（保留 exact note）
如果 Red Team subagent 失败或 timeout，静默 skip 并继续。`;
}

export function generateReviewArmy(ctx: TemplateContext): string {
  // Codex host：完全 strip；Codex 不应运行 Review Army
  if (ctx.host === 'codex') return '';

  const sections = [
    generateSpecialistSelection(ctx),
    generateSpecialistDispatch(ctx),
    generateFindingsMerge(ctx),
    generateRedTeam(ctx),
  ];

  return sections.join('\n\n---\n\n');
}
