<!-- AUTO-GENERATED from review-sections.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
## Review Sections（scope 和 mode 达成一致后，共 11 个 sections）

**Anti-skip rule（防跳过规则）：** 无论 plan type（strategy、spec、code、infra）是什么，都绝不要压缩、缩写或跳过任何 review section（1-11）。此 skill 中每个 section 都有存在理由。“这是 strategy doc，所以 implementation sections 不适用”永远是错的，implementation details 正是 strategy 崩溃的地方。如果某个 section 真的没有 findings，就说“没有发现问题”并继续，但你必须评估它。

**Anti-shortcut clause:** Plan file 是 interactive review 的 OUTPUT，不是替代品。把所有 finding 一次性写进 plan，然后不触发 AskUserQuestion 就调用 ExitPlanMode，正是 2026 年 5 月 transcript bug 的 failure mode：model 探索、发现问题，然后把它们倒进 deliverable，而不是带用户逐项走过。如果任何 review section 中有 ANY non-trivial finding，从 finding 到 ExitPlanMode 的路径必须经过 AskUserQuestion。只有每个 section 都 zero findings 时，才能绕过 AskUserQuestion 进入 ExitPlanMode。如果你发现自己想先写带 findings 的 plan 再问，停下来立刻调用 AskUserQuestion：这就是那个 bug，要识别出来。

### Section 1: Architecture Review（architecture review）
评估并画 diagram：
* Overall system design 和 component boundaries。画 dependency graph。
* Data flow - 全部四条路径。对每个新 data flow，用 ASCII diagram 表示：
    * Happy path（data flows correctly）
    * Nil path（input 为 nil/missing 时会发生什么？）
    * Empty path（input 存在但 empty/zero-length 时会发生什么？）
    * Error path（upstream call fails 时会发生什么？）
* State machines。对每个新的 stateful object 画 ASCII diagram。包含 impossible/invalid transitions，以及是什么阻止它们。
* Coupling concerns。哪些 components 现在产生了此前没有的 coupling？这种 coupling 是否合理？画 before/after dependency graph。
* Scaling characteristics。10x load 下最先坏什么？100x 呢？
* Single points of failure。映射它们。
* Security architecture。Auth boundaries、data access patterns、API surfaces。对每个新 endpoint 或 data mutation：谁能调用、他们得到什么、能改变什么？
* Production failure scenarios。对每个新 integration point，描述一个现实 production failure（timeout、cascade、data corruption、auth failure），以及 plan 是否考虑到它。
* Rollback posture。如果 ship 后立刻坏掉，rollback procedure 是什么？Git revert？Feature flag？DB migration rollback？需要多久？

**EXPANSION 和 SELECTIVE EXPANSION additions：**
* 什么会让这个 architecture 变得 beautiful？不只是 correct，而是 elegant。有没有一种 design 会让 6 个月后加入的新 engineer 说 "oh, that's clever and obvious at the same time"？
* 什么 infrastructure 会让这个 feature 成为其他 features 可构建其上的 platform？

**SELECTIVE EXPANSION：** 如果 Step 0D 中任何 accepted cherry-picks 影响 architecture，在这里评估它们的 architectural fit。标记任何制造 coupling concerns 或无法干净集成的内容；这是用新信息重新审视 decision 的机会。

Required ASCII diagram：完整 system architecture，展示 new components 及其与 existing ones 的关系。
**STOP。** 每个 issue 调用一次 AskUserQuestion。不要 batch。给出推荐并说明原因。如果此 section 没有 findings，说明“没有发现问题，继续”并继续。如果此 section 有 findings，必须调用 AskUserQuestion 作为 tool_use；即使 finding 有“显而易见的修复”，它仍是 finding，仍需用户批准后才能进入 plan。用户回应前不要继续。
**提醒：不要做任何代码改动。只 review。**

### Section 2: Error & Rescue Map（错误与 rescue map）
这是捕获 silent failures 的 section。它不是可选项。
对每个可能失败的新 method、service 或 codepath，填写此表：
```
  METHOD/CODEPATH          | WHAT CAN GO WRONG           | EXCEPTION CLASS
  -------------------------|-----------------------------|-----------------
  ExampleService#call      | API timeout                 | TimeoutError
                           | API returns 429             | RateLimitError
                           | API returns malformed JSON  | JSONParseError
                           | DB connection pool exhausted| ConnectionPoolExhausted
                           | Record not found            | RecordNotFound
  -------------------------|-----------------------------|-----------------

  EXCEPTION CLASS              | RESCUED?  | RESCUE ACTION          | USER SEES
  -----------------------------|-----------|------------------------|------------------
  TimeoutError                 | Y         | Retry 2x, then raise   | "Service temporarily unavailable"
  RateLimitError               | Y         | Backoff + retry         | Nothing (transparent)
  JSONParseError               | N ← GAP   | —                      | 500 error ← BAD
  ConnectionPoolExhausted      | N ← GAP   | —                      | 500 error ← BAD
  RecordNotFound               | Y         | Return nil, log warning | "Not found" message
```
此 section 的规则：
* Catch-all error handling（`rescue StandardError`、`catch (Exception e)`、`except Exception`）永远是 smell。点名具体 exceptions。
* 只用 generic log message 捕获 error 不够。记录完整 context：正在尝试什么、使用哪些 arguments、针对哪个 user/request。
* 每个 rescued error 必须要么：带 backoff retry、用 user-visible message graceful degrade、或带新增 context re-raise。"Swallow and continue" 几乎永远不可接受。
* 对每个 GAP（应被 rescued 但未 rescued 的 error）：指定 rescue action 和用户应该看到什么。
* 特别针对 LLM/AI service calls：response malformed 时怎样？empty 时怎样？hallucinate invalid JSON 时怎样？model returns a refusal 时怎样？每个都是独立 failure mode。
**STOP。** 每个 issue 调用一次 AskUserQuestion。不要 batch。给出推荐并说明原因。如果此 section 没有 findings，说明“没有发现问题，继续”并继续。如果此 section 有 findings，必须调用 AskUserQuestion 作为 tool_use；即使 finding 有“显而易见的修复”，它仍是 finding，仍需用户批准后才能进入 plan。用户回应前不要继续。
**提醒：不要做任何代码改动。只 review。**

### Section 3: Security & Threat Model（安全与威胁模型）
Security 不是 architecture 的 sub-bullet。它拥有自己的 section。
评估：
* Attack surface expansion。此 plan 引入了哪些新 attack vectors？New endpoints、new params、new file paths、new background jobs？
* Input validation。对每个新 user input：是否 validated、sanitized，并在 failure 时 loudly rejected？以下情况会怎样：nil、empty string、期望 integer 时传 string、string exceeding max length、unicode edge cases、HTML/script injection attempts？
* Authorization。对每个新 data access：是否 scoped 到正确 user/role？是否存在 direct object reference vulnerability？User A 能否通过操纵 IDs 访问 user B 的数据？
* Secrets and credentials。New secrets？是否在 env vars 中，而不是 hardcoded？是否 rotatable？
* Dependency risk。New gems/npm packages？Security track record？
* Data classification。PII、payment data、credentials？处理是否与 existing patterns 一致？
* Injection vectors。SQL、command、template、LLM prompt injection 全部检查。
* Audit logging。对 sensitive operations：是否有 audit trail？

对每个 finding：说明 threat、likelihood（High/Med/Low）、impact（High/Med/Low），以及 plan 是否 mitigates it。
**STOP。** 每个 issue 调用一次 AskUserQuestion。不要 batch。给出推荐并说明原因。如果此 section 没有 findings，说明“没有发现问题，继续”并继续。如果此 section 有 findings，必须调用 AskUserQuestion 作为 tool_use；即使 finding 有“显而易见的修复”，它仍是 finding，仍需用户批准后才能进入 plan。用户回应前不要继续。
**提醒：不要做任何代码改动。只 review。**

### Section 4: Data Flow & Interaction Edge Cases（data flow 与 interaction edge cases）
此 section 以 adversarial thoroughness 追踪 data 如何穿过系统，以及 interactions 如何穿过 UI。

**Data Flow Tracing：** 对每个新 data flow，产出显示以下内容的 ASCII diagram：
```
  INPUT ──▶ VALIDATION ──▶ TRANSFORM ──▶ PERSIST ──▶ OUTPUT
    │            │              │            │           │
    ▼            ▼              ▼            ▼           ▼
  [nil?]    [invalid?]    [exception?]  [conflict?]  [stale?]
  [empty?]  [too long?]   [timeout?]    [dup key?]   [partial?]
  [wrong    [wrong type?] [OOM?]        [locked?]    [encoding?]
   type?]
```
对每个 node：每条 shadow path 会发生什么？是否有测试？

**Interaction Edge Cases：** 对每个新的 user-visible interaction，评估：
```
  INTERACTION          | EDGE CASE              | HANDLED? | HOW?
  ---------------------|------------------------|----------|--------
  Form submission      | Double-click submit    | ?        |
                       | Submit with stale CSRF | ?        |
                       | Submit during deploy   | ?        |
  Async operation      | User navigates away    | ?        |
                       | Operation times out    | ?        |
                       | Retry while in-flight  | ?        |
  List/table view      | Zero results           | ?        |
                       | 10,000 results         | ?        |
                       | Results change mid-page| ?        |
  Background job       | Job fails after 3 of   | ?        |
                       | 10 items processed     |          |
                       | Job runs twice (dup)   | ?        |
                       | Queue backs up 2 hours | ?        |
```
将任何 unhandled edge case 标记为 gap。对每个 gap，指定 fix。
**STOP。** 每个 issue 调用一次 AskUserQuestion。不要 batch。给出推荐并说明原因。如果此 section 没有 findings，说明“没有发现问题，继续”并继续。如果此 section 有 findings，必须调用 AskUserQuestion 作为 tool_use；即使 finding 有“显而易见的修复”，它仍是 finding，仍需用户批准后才能进入 plan。用户回应前不要继续。
**提醒：不要做任何代码改动。只 review。**

### Section 5: Code Quality Review（代码质量 review）
评估：
* Code organization 和 module structure。New code 是否符合 existing patterns？如果偏离，是否有理由？
* DRY violations。要 aggressive。如果相同 logic 已存在别处，标记它并引用 file 和 line。
* Naming quality。New classes、methods 和 variables 是否按它们做什么命名，而不是按如何做命名？
* Error handling patterns。（与 Section 2 cross-reference；此 section review patterns，Section 2 映射 specifics。）
* Missing edge cases。明确列出："What happens when X is nil?" "When the API returns 429?" 等。
* Over-engineering check。是否有新 abstraction 在解决一个还不存在的问题？
* Under-engineering check。是否有脆弱、只假设 happy path、或缺少明显 defensive checks 的东西？
* Cyclomatic complexity。标记任何分支超过 5 次的新 method。提出 refactor。
**STOP。** 每个 issue 调用一次 AskUserQuestion。不要 batch。给出推荐并说明原因。如果此 section 没有 findings，说明“没有发现问题，继续”并继续。如果此 section 有 findings，必须调用 AskUserQuestion 作为 tool_use；即使 finding 有“显而易见的修复”，它仍是 finding，仍需用户批准后才能进入 plan。用户回应前不要继续。
**提醒：不要做任何代码改动。只 review。**

### Section 6: Test Review（测试 review）
为此 plan 引入的每个新东西制作完整 diagram：
```
  NEW UX FLOWS:
    [list each new user-visible interaction]

  NEW DATA FLOWS:
    [list each new path data takes through the system]

  NEW CODEPATHS:
    [list each new branch, condition, or execution path]

  NEW BACKGROUND JOBS / ASYNC WORK:
    [list each]

  NEW INTEGRATIONS / EXTERNAL CALLS:
    [list each]

  NEW ERROR/RESCUE PATHS:
    [list each — cross-reference Section 2]
```
对 diagram 中每个 item：
* 哪种 test 覆盖它？（Unit / Integration / System / E2E）
* plan 中是否已有对应 test？如果没有，写出 test spec header。
* happy path test 是什么？
* failure path test 是什么？（具体说明是哪种 failure。）
* edge case test 是什么？（nil、empty、boundary values、concurrent access）

Test ambition check（所有 modes）：对每个新 feature，回答：
* 哪个 test 会让你有信心在周五凌晨 2 点 ship？
* hostile QA engineer 会写哪个 test 来打破它？
* chaos test 是什么？

Test pyramid check：许多 unit、较少 integration、少量 E2E？还是倒置？
Flakiness risk：标记任何依赖 time、randomness、external services 或 ordering 的 test。
Load/stress test requirements：对任何频繁调用或处理大量数据的新 codepath。

对于 LLM/prompt changes：检查 CLAUDE.md 中 "Prompt/LLM changes" 的 file patterns。如果此 plan touches 任何这些 patterns，说明必须运行哪些 eval suites、应添加哪些 cases、以及与哪些 baselines 比较。
**STOP。** 每个 issue 调用一次 AskUserQuestion。不要 batch。给出推荐并说明原因。如果此 section 没有 findings，说明“没有发现问题，继续”并继续。如果此 section 有 findings，必须调用 AskUserQuestion 作为 tool_use；即使 finding 有“显而易见的修复”，它仍是 finding，仍需用户批准后才能进入 plan。用户回应前不要继续。
**提醒：不要做任何代码改动。只 review。**

### Section 7: Performance Review（性能 review）
评估：
* N+1 queries。对每个新的 ActiveRecord association traversal：是否有 includes/preload？
* Memory usage。对每个新 data structure：production 中最大 size 是多少？
* Database indexes。对每个新 query：是否有 index？
* Caching opportunities。对每个 expensive computation 或 external call：是否应该 cached？
* Background job sizing。对每个新 job：worst-case payload、runtime、retry behavior？
* Slow paths。最慢的 3 条新 codepaths 和估算 p99 latency。
* Connection pool pressure。新的 DB connections、Redis connections、HTTP connections？
**STOP。** 每个 issue 调用一次 AskUserQuestion。不要 batch。给出推荐并说明原因。如果此 section 没有 findings，说明“没有发现问题，继续”并继续。如果此 section 有 findings，必须调用 AskUserQuestion 作为 tool_use；即使 finding 有“显而易见的修复”，它仍是 finding，仍需用户批准后才能进入 plan。用户回应前不要继续。
**提醒：不要做任何代码改动。只 review。**

### Section 8: Observability & Debuggability Review（可观测性与可调试性 review）
New systems 会坏。此 section 确保你能看到原因。
评估：
* Logging。对每个新 codepath：entry、exit 和每个 significant branch 是否有 structured log lines？
* Metrics。对每个新 feature：什么 metric 告诉你它在工作？什么告诉你它坏了？
* Tracing。对新的 cross-service 或 cross-job flows：trace IDs 是否 propagated？
* Alerting。应该有哪些 new alerts？
* Dashboards。Day 1 想要哪些 new dashboard panels？
* Debuggability。如果 bug 在 ship 后 3 周被报告，仅凭 logs 能否 reconstruct 发生了什么？
* Admin tooling。是否有新的 operational tasks 需要 admin UI 或 rake tasks？
* Runbooks。对每个新 failure mode：operational response 是什么？

**EXPANSION 和 SELECTIVE EXPANSION addition：**
* 哪些 observability 会让这个 feature 操作起来是一种 joy？（对 SELECTIVE EXPANSION，包含任何 accepted cherry-picks 的 observability。）
**STOP。** 每个 issue 调用一次 AskUserQuestion。不要 batch。给出推荐并说明原因。如果此 section 没有 findings，说明“没有发现问题，继续”并继续。如果此 section 有 findings，必须调用 AskUserQuestion 作为 tool_use；即使 finding 有“显而易见的修复”，它仍是 finding，仍需用户批准后才能进入 plan。用户回应前不要继续。
**提醒：不要做任何代码改动。只 review。**

### Section 9: Deployment & Rollout Review（部署与 rollout review）
评估：
* Migration safety。对每个新 DB migration：是否 backward-compatible？Zero-downtime？Table locks？
* Feature flags。是否有任何部分应放在 feature flag 后？
* Rollout order。正确顺序：先 migrate，再 deploy？
* Rollback plan。明确 step-by-step。
* Deploy-time risk window。Old code 和 new code 同时运行时，什么会坏？
* Environment parity。是否在 staging 测试？
* Post-deploy verification checklist。前 5 分钟？前 1 小时？
* Smoke tests。哪些 automated checks 应在 post-deploy 立即运行？

**EXPANSION 和 SELECTIVE EXPANSION addition：**
* 哪些 deploy infrastructure 会让 shipping this feature 变成 routine？（对 SELECTIVE EXPANSION，评估 accepted cherry-picks 是否改变 deployment risk profile。）
**STOP。** 每个 issue 调用一次 AskUserQuestion。不要 batch。给出推荐并说明原因。如果此 section 没有 findings，说明“没有发现问题，继续”并继续。如果此 section 有 findings，必须调用 AskUserQuestion 作为 tool_use；即使 finding 有“显而易见的修复”，它仍是 finding，仍需用户批准后才能进入 plan。用户回应前不要继续。
**提醒：不要做任何代码改动。只 review。**

### Section 10: Long-Term Trajectory Review（长期轨迹 review）
评估：
* Technical debt introduced。Code debt、operational debt、testing debt、documentation debt。
* Path dependency。这是否让未来 changes 更难？
* Knowledge concentration。Documentation 对新 engineer 是否足够？
* Reversibility。评分 1-5：1 = one-way door，5 = easily reversible。
* Ecosystem fit。是否与 Rails/JS ecosystem direction 对齐？
* The 1-year question。作为 12 个月后的新 engineer 阅读此 plan，它是否 obvious？

**EXPANSION 和 SELECTIVE EXPANSION additions：**
* 这 ship 后下一步是什么？Phase 2？Phase 3？architecture 是否支持那条 trajectory？
* Platform potential。这是否创造了其他 features 可 leverage 的 capabilities？
* （仅 SELECTIVE EXPANSION）Retrospective：是否接受了正确的 cherry-picks？是否有 rejected expansions 结果对 accepted ones 是 load-bearing？
**STOP。** 每个 issue 调用一次 AskUserQuestion。不要 batch。给出推荐并说明原因。如果此 section 没有 findings，说明“没有发现问题，继续”并继续。如果此 section 有 findings，必须调用 AskUserQuestion 作为 tool_use；即使 finding 有“显而易见的修复”，它仍是 finding，仍需用户批准后才能进入 plan。用户回应前不要继续。
**提醒：不要做任何代码改动。只 review。**

### Section 11: Design & UX Review（无 UI scope 时跳过）
CEO 叫来 designer。不是 pixel-level audit，那是 /plan-design-review 和 /design-review 的工作。这里是确保 plan 有 design intentionality。

评估：
* Information architecture - 用户先看见什么、第二看见什么、第三看见什么？
* Interaction state coverage map：
  FEATURE | LOADING | EMPTY | ERROR | SUCCESS | PARTIAL
* User journey coherence - 将 emotional arc 画成 storyboard
* AI slop risk - plan 是否描述 generic UI patterns？
* DESIGN.md alignment - plan 是否匹配 stated design system？
* Responsive intention - mobile 是被认真设计，还是 afterthought？
* Accessibility basics - keyboard nav、screen readers、contrast、touch targets

**EXPANSION 和 SELECTIVE EXPANSION additions：**
* 什么会让这个 UI 感觉 *inevitable*？
* 哪些 30-minute UI touches 会让用户觉得 "oh nice, they thought of that"？

Required ASCII diagram：展示 screens/states 和 transitions 的 user flow。

如果此 plan 有 significant UI scope，推荐："建议在 implementation 前运行 /plan-design-review，对这个 plan 做一次 deep design review。"
**STOP。** 每个 issue 调用一次 AskUserQuestion。不要 batch。给出推荐并说明原因。如果此 section 没有 findings，说明“没有发现问题，继续”并继续。如果此 section 有 findings，必须调用 AskUserQuestion 作为 tool_use；即使 finding 有“显而易见的修复”，它仍是 finding，仍需用户批准后才能进入 plan。用户回应前不要继续。
**提醒：不要做任何代码改动。只 review。**

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

### Outside Voice Integration Rule（outside voice 集成规则）

Outside voice findings 在用户明确批准每一项前都只是 INFORMATIONAL。
不要在未通过 AskUserQuestion 呈现每个 finding 并获得明确批准前，将 outside voice recommendations 纳入 plan。即使你同意 outside voice，也适用此规则。Cross-model consensus 是强信号，要按强信号呈现，但由用户做决定。

## Post-Implementation Design Audit（检测到 UI scope 时）
implementation 后，在 live site 上运行 `/design-review`，捕获只能通过 rendered output 评估的 visual issues。

## 关键规则 — 如何提问
遵循上方 Preamble 的 AskUserQuestion 格式。Plan reviews 的额外规则：
* **一个 issue = 一次 AskUserQuestion 调用。** 绝不要把多个 issues 合并成一个 question。
* 具体描述问题，并附 file 和 line references。
* 呈现 2-3 个 options，在合理时包含 "do nothing"。
* 每个 option 用一行说明 effort、risk 和 maintenance burden。
* **把推理映射到我上面的 engineering preferences。** 用一句话把 recommendation 连接到某个具体 preference。
* 用 issue NUMBER + option LETTER 标记（例如 "3A"、"3B"）。
* **Zero findings（零 findings）：** 如果某个 section 没有 findings，说“没有发现问题，继续”并继续。否则，对每个 finding 使用 AskUserQuestion；即使 finding 有“显而易见的修复”，它仍是 finding，仍需用户批准后才能进入 plan。

## 必需输出

### "NOT in scope" section（不在范围内）
列出已考虑并明确 deferred 的 work，每项附一行 rationale。

### "What already exists" section（已有内容）
列出现有部分解决 sub-problems 的 code/flows，以及 plan 是否复用它们。

### "Dream state delta" section
说明相对于 12-month ideal，此 plan 会把我们带到哪里。

### Error & Rescue Registry（来自 Section 2）
完整表格：每个可能失败的 method、每个 exception class、rescued status、rescue action、user impact。

### Failure Modes Registry（failure modes 注册表）
```
  CODEPATH | FAILURE MODE   | RESCUED? | TEST? | USER SEES?     | LOGGED?
  ---------|----------------|----------|-------|----------------|--------
```
任何 RESCUED=N、TEST=N、USER SEES=Silent 的行 -> **CRITICAL GAP**。

### TODOS.md updates（TODOS.md 更新）
把每个潜在 TODO 作为独立 AskUserQuestion 呈现。绝不要 batch TODOs，一次一个问题。绝不要静默跳过此步骤。遵循 `.claude/skills/review/TODOS-format.md` 的格式。

对每个 TODO，描述：
* **What（做什么）：** work 的一行描述。
* **Why（为什么）：** 它解决的具体问题或 unlock 的 value。
* **Pros：** 做这项 work 会获得什么。
* **Cons：** 成本、复杂性或风险。
* **Context：** 足够细节，让 3 个月后接手的人理解动机、当前状态和从哪里开始。
* **Effort estimate（工作量估算）：** S/M/L/XL（human team）-> with CC+gstack: S->S, M->S, L->M, XL->L
* **Priority（优先级）：** P1/P2/P3
* **Depends on / blocked by（依赖 / 阻塞）：** 任何 prerequisites 或 ordering constraints。

然后呈现选项：**A)** 添加到 TODOS.md **B)** 跳过，价值不够 **C)** 不 defer，在这个 PR 中现在构建它。

### Scope Expansion Decisions（仅 EXPANSION 和 SELECTIVE EXPANSION）
对于 EXPANSION 和 SELECTIVE EXPANSION modes：expansion opportunities 和 delight items 已在 Step 0D（opt-in/cherry-pick ceremony）中浮现并决策。Decisions 已持久化到 CEO plan document。完整记录引用 CEO plan。不要在这里重新浮现它们，只为完整性列出 accepted expansions：
* Accepted（已接受）：{list items added to scope}
* Deferred（已延后）：{list items sent to TODOS.md}
* Skipped（已跳过）：{list items rejected}

### Diagrams（强制，产出所有适用项）
1. System architecture
2. Data flow (including shadow paths)
3. State machine
4. Error flow
5. Deployment sequence
6. Rollback flowchart

### Stale Diagram Audit（过时 diagram audit）
列出此 plan touches 的 files 中每个 ASCII diagram。它们仍然准确吗？

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
TASKS_FILE="$TASKS_DIR/tasks-ceo-review-$(date +%Y%m%d-%H%M%S).jsonl"
COMMIT=$(git rev-parse HEAD 2>/dev/null || echo unknown)
BRANCH=$(git branch --show-current 2>/dev/null || echo unknown)
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"

# 对此 review 中识别出的每个 task 重复一次 jq invocation。
# 用你为每个 task 设置的 shell variables inline 替换 placeholders：
#   TASK_ID (T1, T2, ...), PRIORITY (P1/P2/P3), COMPONENT, TITLE,
#   SOURCE_FINDING, EFFORT_HUMAN, EFFORT_CC, FILES_JSON (a JSON array literal
#   like '["browse/src/sanitize.ts","browse/src/server.ts"]').
jq -nc \
  --arg phase 'ceo-review' \
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


### Completion Summary（完成摘要）
```
  +====================================================================+
  |            MEGA PLAN REVIEW — 完成摘要                              |
  +====================================================================+
  | 已选 mode           | EXPANSION / SELECTIVE / HOLD / REDUCTION     |
  | System Audit         | [关键 findings]                              |
  | Step 0               | [mode + 关键 decisions]                      |
  | Section 1  (Arch)    | 发现 ___ 个 issues                           |
  | Section 2  (Errors)  | 映射 ___ 条 error paths，___ 个 GAPS          |
  | Section 3  (Security)| 发现 ___ 个 issues，___ 个 High severity      |
  | Section 4  (Data/UX) | 映射 ___ 个 edge cases，___ 个未处理          |
  | Section 5  (Quality) | 发现 ___ 个 issues                           |
  | Section 6  (Tests)   | 已产出 diagram，___ 个 gaps                  |
  | Section 7  (Perf)    | 发现 ___ 个 issues                           |
  | Section 8  (Observ)  | 发现 ___ 个 gaps                             |
  | Section 9  (Deploy)  | 标记 ___ 个 risks                            |
  | Section 10 (Future)  | 可逆性：_/5，debt items：___                 |
  | Section 11 (Design)  | ___ 个 issues / SKIPPED（无 UI scope）       |
  +--------------------------------------------------------------------+
  | NOT in scope         | 已写（___ items）                            |
  | What already exists  | 已写                                        |
  | Dream state delta    | 已写                                        |
  | Error/rescue registry| ___ 个 methods，___ 个 CRITICAL GAPS         |
  | Failure modes        | 共 ___ 个，___ 个 CRITICAL GAPS              |
  | TODOS.md updates     | 提出 ___ 个 items                            |
  | Scope proposals      | 提出 ___ 个，接受 ___ 个（EXP + SEL）        |
  | CEO plan             | 已写 / 已跳过（HOLD/REDUCTION）              |
  | Outside voice        | 已运行（codex/claude）/ 已跳过               |
  | Lake Score           | X/Y 个 recommendations 选择完整 option       |
  | Diagrams produced    | ___（列出 types）                            |
  | Stale diagrams found | ___                                         |
  | Unresolved decisions | ___（见下方列表）                            |
  +====================================================================+
```

### Unresolved Decisions（未解决决策）
如果任何 AskUserQuestion 未被回答，在这里记录。绝不要静默默认。

## Handoff Note Cleanup（清理 handoff note）

产出 Completion Summary 后，清理此 branch 的任何 handoff notes：review 已完成，不再需要该 context。

```bash
setopt +o nomatch 2>/dev/null || true  # zsh compat
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)"
rm -f ~/.gstack/projects/$SLUG/*-$BRANCH-ceo-handoff-*.md 2>/dev/null || true
```

## Review Log（review 日志）

产出上方 Completion Summary 后，持久化 review result。

**PLAN MODE EXCEPTION - ALWAYS RUN：** 此命令将 review metadata 写入 `~/.gstack/`（user config directory，不是 project files）。skill preamble 已经写入 `~/.gstack/sessions/` 和 `~/.gstack/analytics/`，这是同一模式。Review dashboard 依赖此数据。跳过此命令会破坏 /ship 中的 review readiness dashboard。

```bash
~/.claude/skills/gstack/bin/gstack-review-log '{"skill":"plan-ceo-review","timestamp":"TIMESTAMP","status":"STATUS","unresolved":N,"critical_gaps":N,"mode":"MODE","scope_proposed":N,"scope_accepted":N,"scope_deferred":N,"commit":"COMMIT"}'
```

运行此命令前，用你刚产出的 Completion Summary 中的值替换 placeholders：
- **TIMESTAMP**：当前 ISO 8601 datetime（例如 2026-03-16T14:30:00）
- **STATUS**：如果 unresolved decisions 为 0 且 critical gaps 为 0，则为 "clean"；否则为 "issues_open"
- **unresolved**：summary 中 "Unresolved decisions" 的数字
- **critical_gaps**：summary 中 "Failure modes: ___ CRITICAL GAPS" 的数字
- **MODE**：用户选择的 mode（SCOPE_EXPANSION / SELECTIVE_EXPANSION / HOLD_SCOPE / SCOPE_REDUCTION）
- **scope_proposed**：summary 中 "Scope proposals: ___ proposed" 的数字（HOLD/REDUCTION 为 0）
- **scope_accepted**：summary 中 "Scope proposals: ___ accepted" 的数字（HOLD/REDUCTION 为 0）
- **scope_deferred**：scope decisions 中 deferred to TODOS.md 的 items 数量（HOLD/REDUCTION 为 0）
- **COMMIT**：`git rev-parse --short HEAD` 的输出

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

## Next Steps — Review Chaining（下一步 review 链接）

显示 Review Readiness Dashboard 后，基于此 CEO review 的发现推荐下一步 review。读取 dashboard output，看看哪些 reviews 已运行，以及它们是否 stale。

**如果 eng review 未被全局跳过，推荐 /plan-eng-review** - 检查 dashboard output 中的 `skip_eng_review`。如果为 `true`，表示 eng review 已 opt out，不要推荐。否则，eng review 是 required shipping gate。如果此 CEO review expanded scope、changed architectural direction 或 accepted scope expansions，强调需要 fresh eng review。如果 dashboard 中已有 eng review，但 commit hash 显示它早于此 CEO review，说明它可能 stale，应重新运行。

**如果检测到 UI scope，推荐 /plan-design-review** - 具体来说，如果 Section 11（Design & UX Review）没有被跳过，或 accepted scope expansions 包含 UI-facing features。如果现有 design review stale（commit hash drift），说明这一点。在 SCOPE REDUCTION mode 中跳过此 recommendation，因为 design review 对 scope cuts 可能不相关。

**如果两者都需要，先推荐 eng review**（required gate），再推荐 design review。

使用 AskUserQuestion 呈现下一步。只包含适用 options：
- **A)** 接下来运行 /plan-eng-review（required gate）
- **B)** 接下来运行 /plan-design-review（仅在检测到 UI scope 时）
- **C)** 跳过，我会手动处理 reviews

## docs/designs Promotion（仅 EXPANSION 和 SELECTIVE EXPANSION）

review 结束时，如果 vision 产生了 compelling feature direction，提出将 CEO plan promote 到 project repo。AskUserQuestion：

"这次 review 的 vision 产生了 {N} 个 accepted scope expansions。要把它 promote 成 repo 中的 design doc 吗？"
- **A)** Promote 到 `docs/designs/{FEATURE}.md`（committed to repo，team 可见）
- **B)** 只保留在 `~/.gstack/projects/`（local，personal reference）
- **C)** 跳过

如果 promoted，将 CEO plan 内容复制到 `docs/designs/{FEATURE}.md`（如需要则创建目录），并将 original CEO plan 中的 `status` 字段从 `ACTIVE` 更新为 `PROMOTED`。

## Formatting Rules（格式规则）
* issues 用 NUMBER（1、2、3...），options 用 LETTERS（A、B、C...）。
* 使用 NUMBER + LETTER 标记（例如 "3A"、"3B"）。
* 每个 option 最多一句话。
* 每个 section 后暂停并等待反馈。
* 使用 **CRITICAL GAP** / **WARNING** / **OK** 提升可扫读性。

## Capture Learnings（记录 learnings）

如果你在本 session 中发现了非显而易见的 pattern、pitfall 或 architectural insight，请记录下来供未来 sessions 使用：

```bash
~/.claude/skills/gstack/bin/gstack-learnings-log '{"skill":"plan-ceo-review","type":"TYPE","key":"SHORT_KEY","insight":"DESCRIPTION","confidence":N,"source":"SOURCE","files":["path/to/relevant/file"]}'
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
记录一个 weight 0.8 的 take（按 SKILL_CALIBRATION_WEIGHTS）。
如果 MCP op 不可用，fallback 到 `mcp__gbrain__put_page`，并带
gstack:takes fence block（有文档，但路径更丑）。

Mandatory take frontmatter shape（必须使用的 take frontmatter 形状）：
```yaml
kind: bet
holder: <user identity from whoami>
claim: <one-line prediction the skill is making>
weight: 0.8
since_date: <today's date>
expected_resolution: <date in 1-3 months depending on skill>
source_skill: plan-ceo-review
```

写入后，invalidate 受影响的 digests，让下一次 preflight 反映新的 state：

```bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" 2>/dev/null || true
  ~/.claude/skills/gstack/bin/gstack-brain-cache invalidate product --project "$SLUG" 2>/dev/null || true
  ~/.claude/skills/gstack/bin/gstack-brain-cache invalidate goals --project "$SLUG" 2>/dev/null || true
  ~/.claude/skills/gstack/bin/gstack-brain-cache invalidate competitive-intel --project "$SLUG" 2>/dev/null || true
```


## Brain Cache Background Refresh

skill 工作完成后（且 telemetry 已记录），为任何接近 TTL 的 cache digest
kick 一次 background refresh。这是 non-blocking；用户无需等待。下一次
invocation 会受益于 warm cache。

```bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" 2>/dev/null || true
(~/.claude/skills/gstack/bin/gstack-brain-cache refresh --project "$SLUG" 2>/dev/null &) || true
```


## Mode Quick Reference（mode 快速参考）
```
  ┌────────────────────────────────────────────────────────────────────────────────┐
  │                            MODE 对比                                           │
  ├─────────────┬──────────────┬──────────────┬──────────────┬────────────────────┤
  │             │  EXPANSION   │  SELECTIVE   │  HOLD SCOPE  │  REDUCTION         │
  ├─────────────┼──────────────┼──────────────┼──────────────┼────────────────────┤
  │ Scope       │ 向上扩展     │ 保持并提供   │ 保持         │ 向下收缩           │
  │             │ (opt-in)     │              │              │                    │
  │ 推荐姿态    │ 热情推荐     │ 中立         │ N/A          │ N/A                │
  │             │              │              │              │                    │
  │ 10x check   │ 强制         │ 作为         │ 可选         │ 跳过               │
  │             │              │ cherry-pick  │              │                    │
  │ Platonic    │ 是           │ 否           │ 否           │ 否                 │
  │ ideal       │              │              │              │                    │
  │ Delight     │ opt-in       │ cherry-pick  │ 看到则记录   │ 跳过               │
  │ opps        │ ceremony     │ ceremony     │              │                    │
  │ Complexity  │ “够大吗？”   │ “方向对吗，  │ “太复杂吗？” │ “这是最低限度吗？” │
  │ question    │              │  还有什么    │              │                    │
  │             │              │  值得心动？” │              │                    │
  │ Taste       │ 是           │ 是           │ 否           │ 否                 │
  │ calibration │              │              │              │                    │
  │ Temporal    │ 完整(hr 1-6) │ 完整(hr 1-6) │ 关键决策     │ 跳过               │
  │ interrogate │              │              │  only        │                    │
  │ Observ.     │ “操作起来    │ “操作起来    │ “能否        │ “坏了能否          │
  │ standard    │  愉悦”       │  愉悦”       │  debug？”    │  看见？”           │
  │ Deploy      │ infra 作为   │ 安全 deploy  │ 安全 deploy  │ 最简单可行         │
  │ standard    │ feature scope│ + cherry-pick│  + rollback  │  deploy            │
  │             │              │  risk check  │              │                    │
  │ Error map   │ 完整+chaos   │ 完整+chaos   │ 完整         │ critical paths     │
  │             │  scenarios   │ for accepted │              │  only              │
  │ CEO plan    │ 已写         │ 已写         │ 已跳过       │ 已跳过             │
  │ Phase 2/3   │ 映射 accepted│ 映射 accepted│ 记录         │ 跳过               │
  │ planning    │              │ cherry-picks │              │                    │
  │ Design      │ “Inevitable” │ 若有 UI scope│ 若有 UI scope│ 跳过               │
  │ (Sec 11)    │  UI review   │  detected    │  detected    │                    │
  └─────────────┴──────────────┴──────────────┴──────────────┴────────────────────┘
```
