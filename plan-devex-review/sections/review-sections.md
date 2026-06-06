<!-- AUTO-GENERATED from review-sections.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
## Review Sections（Step 0 完成后，共 8 passes）

**Anti-skip rule（防跳过规则）：** 无论 plan type（strategy、spec、code、infra）是什么，都绝不要压缩、缩写或跳过任何 review pass（1-8）。此 skill 中每个 pass 都有存在理由。“这是 strategy doc，所以 DX passes 不适用”永远是错的，DX gaps 正是 adoption 崩溃的地方。如果某个 pass 真的没有 findings，就说“没有发现问题”并继续，但你必须评估它。

**Anti-shortcut clause:** Plan file 是 interactive review 的 OUTPUT，不是替代品。把所有 finding 一次性写进 plan，然后不触发 AskUserQuestion 就调用 ExitPlanMode，正是 2026 年 5 月 transcript bug 的 failure mode：model 探索、发现问题，然后把它们倒进 deliverable，而不是带用户逐项走过。如果任何 review section 中有 ANY non-trivial finding，从 finding 到 ExitPlanMode 的路径必须经过 AskUserQuestion。只有每个 section 都 zero findings 时，才能绕过 AskUserQuestion 进入 ExitPlanMode。如果你发现自己想先写带 findings 的 plan 再问，停下来立刻调用 AskUserQuestion：这就是那个 bug，要识别出来。

## Prior Learnings（历史 learnings）

搜索先前 sessions 中的相关 learnings：

```bash
_CROSS_PROJ=$(~/.claude/skills/gstack/bin/gstack-config get cross_project_learnings 2>/dev/null || echo "unset")
echo "CROSS_PROJECT: $_CROSS_PROJ"
if [ "$_CROSS_PROJ" = "true" ]; then
  ~/.claude/skills/gstack/bin/gstack-learnings-search --limit 10 --cross-project 2>/dev/null || true
else
  ~/.claude/skills/gstack/bin/gstack-learnings-search --limit 10 2>/dev/null || true
fi
```

如果 `CROSS_PROJECT` 是 `unset`（第一次）：使用 AskUserQuestion：

> gstack 可以搜索这台机器上其他 projects 的 learnings，寻找可能适用于这里的 patterns。
> 这只在 local 发生（没有 data 离开你的机器）。推荐 solo developers 使用。
> 如果你同时处理多个 client codebases，担心 cross-contamination，可以跳过。

Options:
- A) 启用 cross-project learnings（recommended）
- B) Learnings 仅保持 project-scoped

如果选择 A：运行 `~/.claude/skills/gstack/bin/gstack-config set cross_project_learnings true`
如果选择 B：运行 `~/.claude/skills/gstack/bin/gstack-config set cross_project_learnings false`

然后使用合适的 flag 重新运行 search。

如果找到 learnings，将其纳入分析。当 review finding 匹配 past learning 时，显示：

**"Prior learning applied: [key] (confidence N/10, from [date])"**

这样会让 compounding 可见。用户应该看到 gstack 正在随着时间推移更了解他们的 codebase。

### DX Trend Check（DX 趋势检查）

开始 review passes 前，检查此项目的 prior DX reviews：

```bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)"
~/.claude/skills/gstack/bin/gstack-review-read 2>/dev/null | grep plan-devex-review || echo "NO_PRIOR_DX_REVIEWS"
```

如果存在 prior reviews，显示 trend：
```
DX TREND (prior reviews):
  Dimension        | Prior Score | Notes
  Getting Started  | 4/10        | from 2026-03-15
  ...
```

### Pass 1：Getting Started Experience（零摩擦上手体验）

评分 0-10：developer 能否在 5 分钟内从 zero 到 hello world？

**Evidence recall：** 引用 0C 的 competitive benchmark（target tier）、0D 的 magical moment（delivery vehicle），以及 0F 中任何 Install/Hello World friction points。

加载 reference：读取 `~/.claude/skills/gstack/plan-devex-review/dx-hall-of-fame.md` 中的 "## Pass 1" section。

评估：
- **Installation**：一个 command？一次点击？没有 prerequisites？
- **First run**：第一个 command 是否产出 visible、meaningful output？
- **Sandbox/Playground**：developers 能否在安装前试用？
- **Free tier**：是否无需 credit card、sales call、company email？
- **Quick start guide**：是否 copy-paste complete？是否展示 real output？
- **Auth/credential bootstrapping**："I want to try" 到 "it works" 中间有多少 steps？
- **Magical moment delivery**：0D 中选择的 vehicle 是否实际在 plan 中？
- **Competitive gap**：TTHW 距离 0C 中选择的 target tier 有多远？

修到 10 分：写出 ideal getting started sequence。指定精确 commands、expected output，以及每步 time budget。目标：3 steps 或更少，并低于 0C 选择的时间。

Stripe test：[persona from 0A] 能否在不离开 terminal 的一个 terminal session 中，从 "never heard of this" 到 "it worked"？

**STOP。** 每个 issue 调用一次 AskUserQuestion。给出 recommendation + WHY。引用 persona。

### Pass 2：API/CLI/SDK Design（可用且有用）

评分 0-10：interface 是否 intuitive、consistent、complete？

**Evidence recall：** API surface 是否匹配 [persona from 0A] 的 mental model？YC founder 期待 `tool.do(thing)`。Platform engineer 期待 `tool.configure(options).execute(thing)`。

加载 reference：读取 `~/.claude/skills/gstack/plan-devex-review/dx-hall-of-fame.md` 中的 "## Pass 2" section。

评估：
- **Naming**：不看 docs 是否 guessable？Grammar 是否 consistent？
- **Defaults**：每个 parameter 是否有 sensible default？最简单 call 是否给出 useful result？
- **Consistency**：整个 API surface 是否使用相同 patterns？
- **Completeness**：是否 100% coverage，还是 devs 需要为 edge cases 降级到 raw HTTP？
- **Discoverability**：devs 能否不看 docs，从 CLI/playground 探索？
- **Reliability/trust**：Latency、retries、rate limits、idempotency、offline behavior？
- **Progressive disclosure**：simple case 是否 production-ready，complexity 是否逐步 revealed？
- **Persona fit**：interface 是否匹配 [persona] 思考问题的方式？

Good API design test：[persona] 看一个 example 后，能否正确使用此 API？

**STOP。** 每个 issue 调用一次 AskUserQuestion。给出 recommendation + WHY。

### Pass 3：Error Messages & Debugging（对抗不确定性）

评分 0-10：出错时，developer 是否知道发生了什么、为什么发生、以及如何修复？

**Evidence recall：** 引用 0F 中任何 error-related friction points 和 0G 中的 confusion points。

加载 reference：读取 `~/.claude/skills/gstack/plan-devex-review/dx-hall-of-fame.md` 中的 "## Pass 3" section。

从 plan 或 codebase 中 **trace 3 条 specific error paths**。对每条，按 Hall of Fame 的 three-tier system 评估：
- **Tier 1 (Elm)：** Conversational、first person、exact location、suggested fix
- **Tier 2 (Rust)：** Error code links to tutorial、primary + secondary labels、help section
- **Tier 3 (Stripe API)：** Structured JSON with type、code、message、param、doc_url

对每条 error path，展示 developer currently sees vs. should see。

也评估：
- **Permission/sandbox/safety model**：可能出什么错？blast radius 是否清晰？
- **Debug mode**：是否有 verbose output？
- **Stack traces**：有用，还是 internal framework noise？

**STOP。** 每个 issue 调用一次 AskUserQuestion。给出 recommendation + WHY。

### Pass 4：Documentation & Learning（可发现且边做边学）

评分 0-10：developer 能否找到所需内容，并通过动手学习？

**Evidence recall：** docs architecture 是否匹配 [persona from 0A] 的 learning style？YC founder 需要 copy-paste examples front and center。Platform engineer 需要 architecture docs 和 API reference。

加载 reference：读取 `~/.claude/skills/gstack/plan-devex-review/dx-hall-of-fame.md` 中的 "## Pass 4" section。

评估：
- **Information architecture**：是否能在 2 分钟内找到所需内容？
- **Progressive disclosure**：beginners 看到 simple，experts 能找到 advanced？
- **Code examples**：是否 copy-paste complete？是否 work as-is？是否有 real context？
- **Interactive elements**：Playgrounds、sandboxes、"try it" buttons？
- **Versioning**：Docs 是否匹配 dev 正在使用的 version？
- **Tutorials vs references**：两者是否都存在？

**STOP。** 每个 issue 调用一次 AskUserQuestion。给出 recommendation + WHY。

### Pass 5：Upgrade & Migration Path（可信升级与迁移路径）

评分 0-10：developers 能否无恐惧地 upgrade？

加载 reference：读取 `~/.claude/skills/gstack/plan-devex-review/dx-hall-of-fame.md` 中的 "## Pass 5" section。

评估：
- **Backward compatibility**：什么会 break？Blast radius 是否 limited？
- **Deprecation warnings**：是否 advance notice？是否 actionable？（"use newMethod() instead"）
- **Migration guides**：每个 breaking change 是否有 step-by-step？
- **Codemods**：是否有 automated migration scripts？
- **Versioning strategy**：Semantic versioning？Clear policy？

**STOP。** 每个 issue 调用一次 AskUserQuestion。给出 recommendation + WHY。

### Pass 6：Developer Environment & Tooling（有价值且易接入）

评分 0-10：这是否能集成到 developers 的 existing workflows？

**Evidence recall：** local dev setup 是否适用于 [persona from 0A] 的 typical environment？

加载 reference：读取 `~/.claude/skills/gstack/plan-devex-review/dx-hall-of-fame.md` 中的 "## Pass 6" section。

评估：
- **Editor integration**：Language server？Autocomplete？Inline docs？
- **CI/CD**：是否适用于 GitHub Actions、GitLab CI？Non-interactive mode？
- **TypeScript support**：Types included？Good IntelliSense？
- **Testing support**：是否 easy to mock？Test utilities？
- **Local development**：Hot reload？Watch mode？Fast feedback？
- **Cross-platform**：Mac、Linux、Windows？Docker？ARM/x86？
- **Local env reproducibility**：是否跨 OS、package managers、containers、proxies 可用？
- **Observability/testability**：Dry-run mode？Verbose output？Sample apps？Fixtures？

**STOP。** 每个 issue 调用一次 AskUserQuestion。给出 recommendation + WHY。

### Pass 7：Community & Ecosystem（可发现且有吸引力）

评分 0-10：是否有 community，且 plan 是否投资 ecosystem health？

加载 reference：读取 `~/.claude/skills/gstack/plan-devex-review/dx-hall-of-fame.md` 中的 "## Pass 7" section。

评估：
- **Open source**：Code open？Permissive license？
- **Community channels**：devs 去哪里问问题？是否有人回答？
- **Examples**：Real-world、runnable？不只是 hello world？
- **Plugin/extension ecosystem**：devs 能否 extend it？
- **Contributing guide**：process 是否清晰？
- **Pricing transparency**：没有 surprise bills？

**STOP。** 每个 issue 调用一次 AskUserQuestion。给出 recommendation + WHY。

### Pass 8：DX Measurement & Feedback Loops（实施并改进）

评分 0-10：plan 是否包含随时间 measure 和 improve DX 的方法？

加载 reference：读取 `~/.claude/skills/gstack/plan-devex-review/dx-hall-of-fame.md` 中的 "## Pass 8" section。

评估：
- **TTHW tracking**：能否 measure getting started time？是否 instrumented？
- **Journey analytics**：devs 在哪里 drop off？
- **Feedback mechanisms**：Bug reports？NPS？Feedback button？
- **Friction audits**：是否 planned periodic reviews？
- **Boomerang readiness**：/devex-review 是否能 measure reality vs. plan？

**STOP。** 每个 issue 调用一次 AskUserQuestion。给出 recommendation + WHY。

### Appendix：Claude Code Skill DX Checklist（Claude Code skill DX 检查清单）

**Conditional：仅当 product type 包含 "Claude Code skill" 时运行。**

这不是 scored pass。它是 gstack 自身 DX 中 proven patterns 的 checklist。

加载 reference：读取 `~/.claude/skills/gstack/plan-devex-review/dx-hall-of-fame.md` 中的 "## Claude Code Skill DX Checklist" section。

检查每个 item。对任何 unchecked item，解释缺什么并建议 fix。

**STOP。** 对任何需要 design decision 的 item 使用 AskUserQuestion。

## Outside Voice — Independent Plan Challenge（可选，推荐）

所有 review sections 完成后，提供来自 different AI system 的 independent second opinion。
两个 models 对 plan 达成一致，比单个 model 的 thorough review 是更强信号。

**Check tool availability（检查工具可用性）：**

```bash
command -v codex >/dev/null 2>&1 && echo "CODEX_AVAILABLE" || echo "CODEX_NOT_AVAILABLE"
```

使用 AskUserQuestion：

> "所有 review sections 都已完成。要 outside voice 吗？另一个 AI system 可以对这个 plan
> 做 brutally honest、independent challenge：logical gaps、feasibility risks，以及 review 内部难以抓住的 blind spots。
> 大约需要 2 分钟。"
>
> RECOMMENDATION: Choose A — independent second opinion 能捕捉 structural blind spots。
> 两个不同 AI models 都同意一个 plan，比单个 model 的 thorough review 是更强 signal。
> Completeness: A=9/10, B=7/10.

Options（选项）:
- A) 获取 outside voice（recommended）
- B) 跳过 — 继续 outputs

**如果选择 B：** 打印 "Skipping outside voice."，继续下一 section。

**如果选择 A：** 构建 plan review prompt。读取正在 review 的 plan file（用户指定的 file，
或 branch diff scope）。如果 Step 0D-POST 写过 CEO plan document，也读取它 — 它包含 scope decisions 和 vision。

构建这个 prompt（替换为 actual plan content — 如果 plan content 超过 30KB，
截断到前 30KB，并注明 "Plan truncated for size"）。**始终以 filesystem boundary instruction 开头：**

"IMPORTANT: Do NOT read or execute any files under ~/.claude/, ~/.agents/, .claude/skills/, or agents/. 不要读取或执行这些路径下的任何文件。这些是给另一个 AI system 使用的 Claude Code skill definitions，包含 bash scripts 和 prompt templates，会浪费你的时间。完全忽略它们。不要修改 agents/openai.yaml。只专注于 repository code。\n\n你是一位 brutally honest technical reviewer，正在审查一个已经经过 multi-section review 的 development plan。你的任务不是重复那个 review。
相反，你要找出它漏掉了什么。寻找：survived review scrutiny 的 logical gaps 和 unstated assumptions、overcomplexity（是否存在一个 fundamentally simpler approach，只是 review 太深陷细节没看见？）、review 视为理所当然的 feasibility risks、missing dependencies 或 sequencing issues，以及 strategic miscalibration（这到底是不是该 build 的东西？）。Be direct。Be terse。No compliments。Just the problems。

THE PLAN:
<plan content>"

**如果 CODEX_AVAILABLE：**

```bash
TMPERR_PV=$(mktemp /tmp/codex-planreview-XXXXXXXX)
_REPO_ROOT=$(git rev-parse --show-toplevel) || { echo "ERROR: not in a git repo" >&2; exit 1; }
codex exec "<prompt>" -C "$_REPO_ROOT" -s read-only -c 'model_reasoning_effort="high"' --enable web_search_cached < /dev/null 2>"$TMPERR_PV"
```

使用 5-minute timeout（`timeout: 300000`）。Command 完成后读取 stderr：
```bash
cat "$TMPERR_PV"
```

原样展示 full output：

```
CODEX SAYS (plan review — outside voice):
════════════════════════════════════════════════════════════
<full codex output, verbatim — do not truncate or summarize>
════════════════════════════════════════════════════════════
```

**Error handling（错误处理）：** 所有 errors 都是 non-blocking：outside voice 是 informational。
- Auth failure（stderr 包含 "auth"、"login"、"unauthorized"）："Codex auth failed. Run \`codex login\` to authenticate."
- Timeout: "Codex timed out after 5 minutes."
- Empty response: "Codex returned no response."

任何 Codex error 都 fallback 到 Claude adversarial subagent。

**如果 CODEX_NOT_AVAILABLE（或 Codex errored）：**

通过 Agent tool dispatch。Subagent 有 fresh context，保持 genuine independence。

Subagent prompt：使用上方相同的 plan review prompt。

在 `OUTSIDE VOICE (Claude subagent):` header 下展示 findings。

如果 subagent fails 或 times out："Outside voice unavailable. Continuing to outputs."

**Cross-model tension（跨模型张力）：**

展示 outside voice findings 后，记录 outside voice 与 earlier sections 的 review findings
不一致之处。按以下格式标记：

```
CROSS-MODEL TENSION:
  [Topic]: Review said X. Outside voice says Y. [Present both perspectives neutrally.
  State what context you might be missing that would change the answer.]
```

**User Sovereignty（用户主权）：** 不要自动把 outside voice recommendations 纳入 plan。
把每个 tension point 呈现给用户。由用户决定。Cross-model agreement 是 strong signal，
可以这样呈现，但它不是 permission to act。你可以说明哪个 argument 更 compelling，
但没有 explicit user approval 时，MUST NOT apply the change。

对每个 substantive tension point，使用 AskUserQuestion：

> "Cross-model disagreement on [topic]. The review found [X] but the outside voice
> argues [Y]. [One sentence on what context you might be missing.]"
>
> RECOMMENDATION: Choose [A or B] because [one-line reason explaining which argument
> is more compelling and why]. Completeness: A=X/10, B=Y/10.

Options（选项）:
- A) Accept the outside voice's recommendation (I'll apply this change)
- B) Keep the current approach (reject the outside voice)
- C) Investigate further before deciding
- D) Add to TODOS.md for later

等待用户 response。不要因为你同意 outside voice 就 default to accepting。
如果用户选择 B，current approach stands — 不要反复争辩。

如果没有 tension points，note: "No cross-model tension — both reviewers agree."

**Persist the result（持久化结果）：**
```bash
~/.claude/skills/gstack/bin/gstack-review-log '{"skill":"codex-plan-review","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","status":"STATUS","source":"SOURCE","commit":"'"$(git rev-parse --short HEAD)"'"}'
```

替换变量：如果没有 findings，STATUS = "clean"；如果存在 findings，STATUS = "issues_found"。
如果 Codex ran，SOURCE = "codex"；如果 subagent ran，SOURCE = "claude"。

**Cleanup（清理）：** processing 后运行 `rm -f "$TMPERR_PV"`（如果使用了 Codex）。

---

构造 outside voice prompt 时，包含 Step 0A 的 Developer Persona 和 Step 0C 的 Competitive Benchmark。Outside voice 应在谁使用它、它在和谁竞争的上下文中 critique plan。

## CRITICAL RULE — How to ask questions（关键规则：如何提问）

遵循上方 Preamble 的 AskUserQuestion 格式。DX reviews 的额外规则：

* **一个 issue = 一次 AskUserQuestion 调用。** 绝不要合并多个 issues。
* **每个问题都建立在 evidence 上。** 引用 persona、competitive benchmark、empathy narrative 或 friction trace。绝不要抽象地提问。
* **从 persona 视角 frame pain。** 不要说 "developers would be frustrated"，而要说 "[persona from 0A] would hit this at minute [N] of their getting-started flow and [specific consequence: abandon, file an issue, hack a workaround]."
* 呈现 2-3 个 options。对每个说明：fix effort、对 developer adoption 的 impact。
* **映射到上方 DX First Principles。** 用一句话把 recommendation 连接到某个具体 principle（例如 "This violates 'zero friction at T0' because [persona] needs 3 extra config steps before their first API call"）。
* **Zero findings（零 findings）：** 如果某个 section 没有 findings，说“没有发现问题，继续”并继续。否则，对每个 gap 使用 AskUserQuestion；即使 gap 有“显而易见的修复”，它仍是 gap，仍需用户批准后才能进入 plan。
* 假设用户已经 20 分钟没看这个窗口了。每个问题都要重新 grounding。

## Required Outputs（必需输出）

### Developer Persona Card（开发者 persona 卡片）
Step 0A 中的 persona card。它放在 plan 的 DX section 顶部。

### Developer Empathy Narrative（开发者共情叙事）
Step 0B 中的第一人称 narrative，并纳入用户 corrections。

### Competitive DX Benchmark（竞争 DX 基准）
Step 0C 中的 benchmark table，并更新 product 的 post-review scores。

### Magical Moment Specification（魔法时刻规格）
Step 0D 中选择的 delivery vehicle，以及 implementation requirements。

### Developer Journey Map（开发者旅程图）
Step 0F 中的 journey map，并更新所有 friction point resolutions。

### First-Time Developer Confusion Report（首次开发者困惑报告）
Step 0G 中的 roleplay report，并注释哪些 items 已 addressed。

### "NOT in scope" section（不在范围内）
列出已考虑并明确 deferred 的 DX improvements，每项附一行 rationale。

### "What already exists" section（已有内容）
列出 plan 应复用的 existing docs、examples、error handling 和 DX patterns。

### TODOS.md updates（TODOS.md 更新）
所有 review passes 完成后，把每个潜在 TODO 作为独立 AskUserQuestion 呈现。绝不要 batch。DX debt 包括：missing error messages、unspecified upgrade paths、documentation gaps、missing SDK languages。每个 TODO 包含：
* **What：** 一行描述
* **Why：** 它造成的具体 developer pain
* **Pros：** 获得什么（adoption、retention、satisfaction）
* **Cons：** 成本、复杂性或风险
* **Context：** 足够细节，让 3 个月后有人能接手
* **Depends on / blocked by（依赖 / 阻塞）：** prerequisites

选项：**A)** 添加到 TODOS.md **B)** 跳过 **C)** 现在构建它

### DX Scorecard（DX 评分卡）

```
+====================================================================+
|              DX PLAN REVIEW — SCORECARD                             |
+====================================================================+
| Dimension            | Score  | Prior  | Trend  |
|----------------------|--------|--------|--------|
| Getting Started      | __/10  | __/10  | __ ↑↓  |
| API/CLI/SDK          | __/10  | __/10  | __ ↑↓  |
| Error Messages       | __/10  | __/10  | __ ↑↓  |
| Documentation        | __/10  | __/10  | __ ↑↓  |
| Upgrade Path         | __/10  | __/10  | __ ↑↓  |
| Dev Environment      | __/10  | __/10  | __ ↑↓  |
| Community            | __/10  | __/10  | __ ↑↓  |
| DX Measurement       | __/10  | __/10  | __ ↑↓  |
+--------------------------------------------------------------------+
| TTHW                 | __ min | __ min | __ ↑↓  |
| Competitive Rank     | [Champion/Competitive/Needs Work/Red Flag]   |
| Magical Moment       | [designed/missing] via [delivery vehicle]    |
| Product Type         | [type]                                      |
| Mode                 | [EXPANSION/POLISH/TRIAGE]                    |
| Overall DX           | __/10  | __/10  | __ ↑↓  |
+====================================================================+
| DX PRINCIPLE COVERAGE                                               |
| Zero Friction      | [covered/gap]                                  |
| Learn by Doing     | [covered/gap]                                  |
| Fight Uncertainty  | [covered/gap]                                  |
| Opinionated + Escape Hatches | [covered/gap]                       |
| Code in Context    | [covered/gap]                                  |
| Magical Moments    | [covered/gap]                                  |
+====================================================================+
```

如果所有 passes 都是 8+："DX plan 很扎实。Developers 会有不错的 experience。"
如果任何 pass 低于 6：标记为 critical DX debt，并说明对 adoption 的具体 impact。
如果 TTHW > 10 min：标记为 blocking issue。

### DX Implementation Checklist（DX 实施检查清单）

```
DX IMPLEMENTATION CHECKLIST
============================
[ ] Time to hello world < [target from 0C]
[ ] Installation is one command
[ ] First run produces meaningful output
[ ] Magical moment delivered via [vehicle from 0D]
[ ] Every error message has: problem + cause + fix + docs link
[ ] API/CLI naming is guessable without docs
[ ] Every parameter has a sensible default
[ ] Docs have copy-paste examples that actually work
[ ] Examples show real use cases, not just hello world
[ ] Upgrade path documented with migration guide
[ ] Breaking changes have deprecation warnings + codemods
[ ] TypeScript types included (if applicable)
[ ] Works in CI/CD without special configuration
[ ] Free tier available, no credit card required
[ ] Changelog exists and is maintained
[ ] Search works in documentation
[ ] Community channel exists and is monitored
```

## Implementation Tasks（实现任务）

关闭此 review 前，把上面的 findings 综合成一个 flat list，列出 build-actionable tasks。每个 task 都必须来自具体 finding，不要 padding。
输出 markdown section，并写入一个可供 `/autoplan` 跨 phases 聚合的 JSONL artifact。

### Markdown section（始终输出）

```markdown
## Implementation Tasks
由此 review 的 findings 综合而来。每个 task 都来自上方某个具体 finding。
用 Claude Code 或 Codex 执行；shipping 时勾选 checkbox。

- [ ] **T1 (P1, human: ~2h / CC: ~15min)** — <component> — <imperative title>
  - 来源：<section name> — <specific finding text or line reference>
  - Files: <paths to touch>
  - Verify：<test command or manual check>
- [ ] **T2 (P2, human: ~30min / CC: ~5min)** — ...
```

Rules（规则）：
- P1 会 block ship；P2 应该在同一 branch 落地；P3 是 follow-up TODO。
- 如果某个 finding 没有产生 actionable task，不要 invent one。
- 如果某个 section 是 zero findings，输出 `_No new tasks from <section>._`
- Effort 使用 CLAUDE.md 中的 AI-compression table。

### JSONL artifact（始终写入，即使 zero tasks）

`/autoplan` 会读取此 file 并跨 phases 聚合。每一行都用 `jq -nc` 构造，
这样包含 quotes、newlines 或 backslashes 的 titles/source findings 能正确 serialize。
绝不要 hand-roll `echo` / `printf`。

```bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)"
TASKS_DIR="${HOME}/.gstack/projects/${SLUG:-unknown}"
mkdir -p "$TASKS_DIR"
TASKS_FILE="$TASKS_DIR/tasks-devex-review-$(date +%Y%m%d-%H%M%S).jsonl"
COMMIT=$(git rev-parse HEAD 2>/dev/null || echo unknown)
BRANCH=$(git branch --show-current 2>/dev/null || echo unknown)
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"

# 对此 review 中识别出的每个 task 重复一次 jq invocation。
# 用你为每个 task 设置的 shell variables inline 替换 placeholders：
#   TASK_ID (T1, T2, ...), PRIORITY (P1/P2/P3), COMPONENT, TITLE,
#   SOURCE_FINDING, EFFORT_HUMAN, EFFORT_CC, FILES_JSON (a JSON array literal
#   like '["browse/src/sanitize.ts","browse/src/server.ts"]').
jq -nc \
  --arg phase 'devex-review' \
  --arg run_id "$RUN_ID" \
  --arg branch "$BRANCH" \
  --arg commit "$COMMIT" \
  --arg id "$TASK_ID" \
  --arg priority "$PRIORITY" \
  --arg component "$COMPONENT" \
  --arg effort_human "$EFFORT_HUMAN" \
  --arg effort_cc "$EFFORT_CC" \
  --arg title "$TITLE" \
  --arg source_finding "$SOURCE_FINDING" \
  --argjson files "$FILES_JSON" \
  '{phase:$phase, run_id:$run_id, branch:$branch, commit:$commit, id:$id, priority:$priority, component:$component, files:$files, effort_human:$effort_human, effort_cc:$effort_cc, title:$title, source_finding:$source_finding}' \
  >> "$TASKS_FILE"
```

如果未安装 `jq`，fallback 为跳过 JSONL write，并 warn 用户安装 jq 以支持 autoplan aggregation。绝不要 hand-roll JSONL。

如果此 review 识别出 zero tasks，仍然 touch JSONL file（`: > "$TASKS_FILE"`），
让 aggregator 知道此 phase 在本次 run 中产出过 output（empty file 表示 "ran, no findings"，不同于 "didn't run"）。


### Unresolved Decisions（未解决决策）
如果任何 AskUserQuestion 未被回答，在这里记录。绝不要静默 default。

## Review Readiness Dashboard

完成 review 后，读取 review log 和 config，并展示 dashboard。

```bash
~/.claude/skills/gstack/bin/gstack-review-read
```

Parse output。为每个 skill（plan-ceo-review、plan-eng-review、review、plan-design-review、design-review-lite、adversarial-review、codex-review、codex-plan-review）找到最近 entry。忽略 timestamp 超过 7 天的 entries。Eng Review 行显示 `review`（diff-scoped pre-landing review）和 `plan-eng-review`（plan-stage architecture review）中更新的一条，并在 status 后追加 "(DIFF)" 或 "(PLAN)" 区分。Adversarial 行显示 `adversarial-review`（new auto-scaled）和 `codex-review`（legacy）中更新的一条。Design Review 行显示 `plan-design-review`（full visual audit）和 `design-review-lite`（code-level check）中更新的一条，并追加 "(FULL)" 或 "(LITE)" 区分。Outside Voice 行显示最近的 `codex-plan-review` entry，它捕获 /plan-ceo-review 和 /plan-eng-review 中的 outside voices。

**Source attribution（来源归因）：** 如果某个 skill 的最近 entry 有 \`"via"\` field，将其追加到 status label 的括号中。示例：`plan-eng-review` + `via:"autoplan"` 显示为 "CLEAR (PLAN via /autoplan)"；`review` + `via:"ship"` 显示为 "CLEAR (DIFF via /ship)"。没有 `via` field 的 entries 仍按之前显示为 "CLEAR (PLAN)" 或 "CLEAR (DIFF)"。

Note：`autoplan-voices` 和 `design-outside-voices` entries 只作为 audit trail（用于 cross-model consensus analysis 的 forensic data）。它们不显示在 dashboard 中，也不被任何 consumer 检查。

展示：

```
+====================================================================+
|                    REVIEW READINESS DASHBOARD                       |
+====================================================================+
| Review          | Runs | Last Run            | Status    | Required |
|-----------------|------|---------------------|-----------|----------|
| Eng Review      |  1   | 2026-03-16 15:00    | CLEAR     | YES      |
| CEO Review      |  0   | —                   | —         | no       |
| Design Review   |  0   | —                   | —         | no       |
| Adversarial     |  0   | —                   | —         | no       |
| Outside Voice   |  0   | —                   | —         | no       |
+--------------------------------------------------------------------+
| VERDICT: CLEARED — Eng Review passed                                |
+====================================================================+
```

**Review tiers（review 层级）：**
- **Eng Review (required by default):** 唯一 gate shipping 的 review。覆盖 architecture、code quality、tests、performance。可用 \`gstack-config set skip_eng_review true\` 全局关闭（"don't bother me" setting）。
- **CEO Review (optional):** 使用 judgment。建议用于重大 product/business changes、新 user-facing features 或 scope decisions。Bug fixes、refactors、infra 和 cleanup 可跳过。
- **Design Review (optional):** 使用 judgment。建议用于 UI/UX changes。Backend-only、infra 或 prompt-only changes 可跳过。
- **Adversarial Review (automatic):** 每个 review 都 always-on。每个 diff 都会获得 Claude adversarial subagent 和 Codex adversarial challenge。Large diffs（200+ lines）还会额外获得带 P1 gate 的 Codex structured review。无需配置。
- **Outside Voice (optional):** 来自不同 AI model 的 independent plan review。在 /plan-ceo-review 和 /plan-eng-review 的所有 review sections 完成后提供。Codex 不可用时 fallback 到 Claude subagent。永不 gate shipping。

**Verdict logic（判定逻辑）：**
- **CLEARED**: Eng Review 在 7 天内有 >= 1 条来自 \`review\` 或 \`plan-eng-review\` 且 status 为 "clean" 的 entry（或 \`skip_eng_review\` 为 \`true\`）
- **NOT CLEARED**: Eng Review 缺失、stale（>7 天）或存在 open issues
- CEO、Design 和 Codex reviews 只展示 context，永不 block shipping
- 如果 \`skip_eng_review\` config 为 \`true\`，Eng Review 显示 "SKIPPED (global)"，verdict 为 CLEARED

**Staleness detection（过期检测）：** 展示 dashboard 后，检查现有 reviews 是否可能 stale：
- 从 bash output 的 \`---HEAD---\` section parse 当前 HEAD commit hash
- 对每个带 \`commit\` field 的 review entry：与当前 HEAD 比较。如果不同，计算 elapsed commits：\`git rev-list --count STORED_COMMIT..HEAD\`。显示："Note: {skill} review from {date} may be stale — {N} commits since review"（保留原文，便于 log/search 稳定）
- 对没有 \`commit\` field 的 entries（legacy entries）：显示 "Note: {skill} review from {date} has no commit tracking — consider re-running for accurate staleness detection"（保留原文，便于 log/search 稳定）
- 如果所有 reviews 都匹配当前 HEAD，不显示任何 staleness notes

## Plan File Review Report

在 conversation output 中展示 Review Readiness Dashboard 后，也要更新 **plan file** 本身，
让任何阅读 plan 的人都能看到 review status。

### Detect the plan file（检测 plan file）

1. 检查当前 conversation 中是否有 active plan file（host 会在 system messages 中提供 plan file
   paths；在 conversation context 中查找 plan file references）。
2. 如果未找到，静默跳过此 section：不是每个 review 都在 plan mode 中运行。

### Generate the report（生成报告）

读取上方 Review Readiness Dashboard step 中已有的 review log output。Parse 每条 JSONL entry。
不同 skill 会记录不同 fields：

- **plan-ceo-review**: \`status\`, \`unresolved\`, \`critical_gaps\`, \`mode\`, \`scope_proposed\`, \`scope_accepted\`, \`scope_deferred\`, \`commit\`
  → Findings: "{scope_proposed} proposals, {scope_accepted} accepted, {scope_deferred} deferred"
  → If scope fields are 0 or missing (HOLD/REDUCTION mode): "mode: {mode}, {critical_gaps} critical gaps"
- **plan-eng-review**: \`status\`, \`unresolved\`, \`critical_gaps\`, \`issues_found\`, \`mode\`, \`commit\`
  → Findings: "{issues_found} issues, {critical_gaps} critical gaps"
- **plan-design-review**: \`status\`, \`initial_score\`, \`overall_score\`, \`unresolved\`, \`decisions_made\`, \`commit\`
  → Findings: "score: {initial_score}/10 → {overall_score}/10, {decisions_made} decisions"
- **plan-devex-review**: \`status\`, \`initial_score\`, \`overall_score\`, \`product_type\`, \`tthw_current\`, \`tthw_target\`, \`mode\`, \`persona\`, \`competitive_tier\`, \`unresolved\`, \`commit\`
  → Findings: "score: {initial_score}/10 → {overall_score}/10, TTHW: {tthw_current} → {tthw_target}"
- **devex-review**: \`status\`, \`overall_score\`, \`product_type\`, \`tthw_measured\`, \`dimensions_tested\`, \`dimensions_inferred\`, \`boomerang\`, \`commit\`
  → Findings: "score: {overall_score}/10, TTHW: {tthw_measured}, {dimensions_tested} tested/{dimensions_inferred} inferred"
- **codex-review**: \`status\`, \`gate\`, \`findings\`, \`findings_fixed\`
  → Findings: "{findings} findings, {findings_fixed}/{findings} fixed"

Findings column 所需的所有 fields 现在都存在于 JSONL entries 中。对刚完成的 review，可以使用你自己的
Completion Summary 中更丰富的细节。对 prior reviews，直接使用 JSONL fields：它们包含所有 required data。

生成以下 markdown table：

\`\`\`markdown
## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | \`/plan-ceo-review\` | Scope & strategy | {runs} | {status} | {findings} |
| Codex Review | \`/codex review\` | Independent 2nd opinion | {runs} | {status} | {findings} |
| Eng Review | \`/plan-eng-review\` | Architecture & tests (required) | {runs} | {status} | {findings} |
| Design Review | \`/plan-design-review\` | UI/UX gaps | {runs} | {status} | {findings} |
| DX Review | \`/plan-devex-review\` | Developer experience gaps | {runs} | {status} | {findings} |
\`\`\`

在 table 下方添加这些 lines（空值或不适用时省略）：

- **CODEX:**（仅当 codex-review 运行过）codex fixes 的一行 summary
- **CROSS-MODEL:**（仅当 Claude 和 Codex reviews 都存在）overlap analysis
- **UNRESOLVED:** 所有 reviews 的 unresolved decisions 总数
- **VERDICT：** 列出 CLEAR 的 reviews（例如 "CEO + ENG CLEARED — ready to implement"）。
  如果 Eng Review 不是 CLEAR 且没有 global skip，追加 "eng review required"。

### Write to the plan file（写入 plan file）

**PLAN MODE EXCEPTION — ALWAYS RUN:** 这会写入 plan file，而 plan file 是 plan mode 中你唯一允许编辑的文件。
Plan file review report 是 plan living status 的一部分。

Report 必须始终是 plan file 的 LAST section，永远不要放在 mid-file。
使用单一 delete-then-append flow：

1. Read plan file（Read tool），查看完整 current content。在 read output 中搜索文件任意位置是否存在
   \`## GSTACK REVIEW REPORT\` heading。
2. 如果找到，使用 Edit tool DELETE 整个 existing section。从
   \`## GSTACK REVIEW REPORT\` match 到下一个 \`## \` heading 或文件末尾，以先出现者为准。
   替换为空字符串。无论该 section 当前位于哪里都这样处理：mid-file deletion 是 intentional，
   不是 special case。如果 Edit 失败（例如 concurrent edit 改变了 content），重新读取 plan file 并重试一次。
3. Delete 后（或没有 existing section 而跳过 delete 后），在文件 END 追加新的
   \`## GSTACK REVIEW REPORT\` section。使用 Edit tool 匹配文件当前最后一个 paragraph 并在其后添加 section，
   或使用 Write 重新输出整个文件，并让 section 位于末尾。
4. 继续前用 Read tool 验证 \`## GSTACK REVIEW REPORT\` 是文件中的最后一个
   \`## \` heading。如果不是，重复 steps 2-3 一次。

不要 in-place replace 该 section。"replace mid-file" path 曾让旧版本在已有 older report 时把 report 留在 mid-file：
用户会看到一个 review report 不在底部的 plan，并且会（正确地）拒绝它。

## Capture Learnings（记录 learnings）

如果你在本 session 中发现了非显而易见的 pattern、pitfall 或 architectural insight，请记录下来供未来 sessions 使用：

```bash
~/.claude/skills/gstack/bin/gstack-learnings-log '{"skill":"plan-devex-review","type":"TYPE","key":"SHORT_KEY","insight":"DESCRIPTION","confidence":N,"source":"SOURCE","files":["path/to/relevant/file"]}'
```

**Types：** `pattern`（reusable approach）、`pitfall`（what NOT to do）、`preference`
（user stated）、`architecture`（structural decision）、`tool`（library/framework insight）、
`operational`（project environment/CLI/workflow knowledge）。

**Sources：** `observed`（你在代码中发现）、`user-stated`（用户告诉你）、
`inferred`（AI deduction）、`cross-model`（Claude 和 Codex 都同意）。

**Confidence：** 1-10。诚实打分。你在代码中验证过的 observed pattern 是 8-9。
不太确定的 inference 是 4-5。用户明确陈述的 preference 是 10。

**files：** 包含此 learning 引用的具体 file paths。这会启用 staleness detection：如果这些 files 后续被删除，该 learning 可被标记。

**只记录真正的发现。**不要记录 obvious things。不要记录用户已经知道的事情。一个好测试：这个 insight 会在未来 session 中节省时间吗？如果会，就记录。



## Brain Calibration Write-Back (Phase 2 / gated)

当 skill 做出值得追踪的 typed prediction（scope decision、TTHW target、
architectural bet、wedge commitment）时，它 MAY 向 brain 写入一个
`kind=bet` take，让 calibration profile 随时间建立。

**由两件事 gate：**
1. active endpoint 的 Brain trust policy 是 `personal`（通过
   `~/.claude/skills/gstack/bin/gstack-config get brain_trust_policy@<endpoint-hash>`).
   Shared brains 会跳过 write-back，以避免污染 team calibration。
2. Feature flag `BRAIN_CALIBRATION_WRITEBACK` 已设置（当前：false；当
   upstream gbrain v0.42+ ship `takes_add` MCP op 后翻为 true）。

当两个 gates 都通过时，write-back path 使用 `mcp__gbrain__takes_add`
记录一个 weight 0.6 的 take（按 SKILL_CALIBRATION_WEIGHTS）。
如果 MCP op 不可用，fallback 到 `mcp__gbrain__put_page`，并带
gstack:takes fence block（有文档，但路径更丑）。

Mandatory take frontmatter shape（必须使用的 take frontmatter 形状）：
```yaml
kind: bet
holder: <user identity from whoami>
claim: <one-line prediction the skill is making>
weight: 0.6
since_date: <today's date>
expected_resolution: <date in 1-3 months depending on skill>
source_skill: plan-devex-review
```

写入后，invalidate 受影响的 digests，让下一次 preflight 反映新的 state：

```bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" 2>/dev/null || true
  ~/.claude/skills/gstack/bin/gstack-brain-cache invalidate developer-persona --project "$SLUG" 2>/dev/null || true
```


## Brain Cache Background Refresh

skill 工作完成后（且 telemetry 已记录），为任何接近 TTL 的 cache digest
kick 一次 background refresh。这是 non-blocking；用户无需等待。下一次
invocation 会受益于 warm cache。

```bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" 2>/dev/null || true
(~/.claude/skills/gstack/bin/gstack-brain-cache refresh --project "$SLUG" 2>/dev/null &) || true
```


## Next Steps — Review Chaining（下一步：review 链接）

显示 Review Readiness Dashboard 后，推荐下一步 reviews：

**如果 eng review 未被全局跳过，推荐 /plan-eng-review** - DX issues 往往有 architectural implications。如果此 DX review 发现 API design problems、error handling gaps 或 CLI ergonomics issues，eng review 应验证 fixes。

**如果存在 user-facing UI，建议 /plan-design-review** - DX review 聚焦 developer-facing surfaces；design review 覆盖 end-user-facing UI。

**implementation 后推荐 /devex-review** - boomerang。Plan 说 TTHW 会是 [target from 0C]。现实是否匹配？在 live product 上运行 /devex-review 找答案。这就是 competitive benchmark 产生回报的地方：你有一个可 measure against 的具体 target。

使用 AskUserQuestion，并包含适用 options：
- **A)** 接下来运行 /plan-eng-review（required gate）
- **B)** 运行 /plan-design-review（仅当检测到 UI scope）
- **C)** 准备 implement，shipping 后运行 /devex-review
- **D)** 跳过，我会手动处理 next steps

## Mode Quick Reference（模式速查）
```
             | DX EXPANSION     | DX POLISH          | DX TRIAGE
Scope        | 向上扩展(opt-in) | 保持               | 仅 critical
Posture      | 热情推荐         | 严谨               | 手术式
Competitive  | 完整 benchmark   | 完整 benchmark     | 跳过
Magical      | 完整 design      | 验证是否存在       | 跳过
Journey      | 全部 stages +    | 全部 stages        | 仅 Install +
             | best-in-class    |                    | Hello World
Passes       | 全部 8 个，扩展  | 全部 8 个，标准    | 仅 Pass 1 + 3
Outside voice| 推荐             | 推荐               | 跳过
```

## Formatting Rules（格式规则）

* issues 用 NUMBER（1、2、3...），options 用 LETTERS（A、B、C...）。
* 使用 NUMBER + LETTER 标记（例如 "3A"、"3B"）。
* 每个 option 最多一句话。
* 每个 pass 后暂停并等待反馈，然后再继续。
* 每个 pass 前后都评分，提升可扫读性。
