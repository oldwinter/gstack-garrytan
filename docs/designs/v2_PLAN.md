# gstack v2 — 最轻量的 opinionated skill pack

## Context（背景）

gstack 在外部文档中的口碑是“fat”。第三方评论（dev.to，2026 年 5 月）明确说 gstack “can feel bloated when all roles are turned on... potentially consuming 10K+ tokens before any real code is written, and daily usage burns through tokens fast... making even straightforward tasks feel sluggish and redundant.” 中文语义：所有 roles 打开后会显得臃肿，真正写 code 前就可能消耗 10K+ tokens，日常使用 token burn 很快，让简单任务也感觉迟缓且重复。Anthropic 自己的 canonical Skills 指南也推荐“progressive disclosure”模式（`SKILL.md` 骨架 + 按需加载 `references/`），而 gstack 偏离了这个方向。

数字支撑了这个批评：

- 31 个 skills，生成后的 `SKILL.md` corpus 总计 2.1MB
- 31 个 skills 中有 28 个超过 40KB soft ceiling（约每个 10K tokens）
- `ship.md` 是 164KB（约 41K tokens）；`ship.md.tmpl` 只有 48KB，**115KB 来自 resolver 注入**，这是最高杠杆的压缩目标
- 始终加载进 system prompt 的 catalog：50+ skills × 多段 description、voice triggers、proactive-suggest 段落

本计划用两个协调发布交付 gstack v2：`v1.45.0.0` 先落地 foundation + 低风险收益，然后 `v2.0.0.0` 在 2-4 周后交付架构性 break + marketing-grade repositioning。这个拆分来自 cross-model review：Codex 认为如果没有真实 breakage，v2 看起来像姿态大于实质；hybrid 形态让确实破坏兼容的 `sections/` pattern 获得它应得的 major bump，同时让低风险收益马上发布。

## Release shape（发布形态）

```
v1.45.0.0（Foundation Release）          v2.0.0.0（gstack v2 Launch）
─────────────────────────────           ─────────────────────────────
约 1-2 周 CC 工作                       2-4 周后协调发布
                                        
Phase 0: Eval coverage matrix           Phase B: sections/ pattern
  全 31 skills 的 gate + periodic eval     用于 5 个 heavyweight
                                          (ship, plan-ceo, office-hours,
Phase A: Build-time compression           plan-eng, plan-design)
  conditional resolver injection
  jargon dedup                          Phase C: Eval annotations
  terse-mode 真正压缩                     + CI orphan check (WARN→FAIL)
                                        
Catalog trim（Codex 高杠杆收益）        Lighter-touch migration
  单行 skill descriptions                 release note + auto-regenerate
  移除 voice triggers/proactive blocks     on /gstack-upgrade
                                        
定义 hard token budgets                 Marketing-grade CHANGELOG
  通过 budget-regression 强制              v1 vs v2 数字表
                                          README v2 banner
Normal release voice                      “lightest opinionated skill pack”
```

## Premise check（前提检查，Step 0A findings）

1. **这是正确问题吗？** YES，已经外部验证。臃肿批评可引用，并代表真实用户痛点（token 成本、session 迟缓）。什么都不做意味着用户会因为 Cursor/Codex 的“lighter touch”口碑而流失。
2. **什么都不做：** 批评会复利。近期 release（v1.38 → v1.44）都在增加功能；没有任何 release 朝反方向走。如果没有显式逆转，这个口碑会固化。
3. **行动风险：** lazy-section pattern 会引入 silent-behavior-loss 这一新故障类别。通过 eval-first foundation + 机械强制 + canary rollout 缓解（见 Phase B integrity section）。

## 现有资产（reuse-first audit）

| 资产 | 复用方式 |
|---|---|
| `scripts/gen-skill-docs.ts` lines 439-450 | 已经做 string substitution 和 per-host suppression；扩展 `appliesTo` resolver gate（约 15 LOC） |
| `scripts/resolvers/types.ts` | 添加 `ResolverEntry` union type |
| `scripts/resolvers/preamble.ts` | 已经做 tier-gated composition（1-4）；添加 per-resolver gating |
| `scripts/jargon-list.json` | 已经是单文件；停止把它内联 37 次 |
| `test/skill-e2e-budget-regression.test.ts` (existing gate-tier) | 扩展 per-skill hard budgets |
| Real-PTY harness from v1.13.2.0 | 复用 behavioral-contract evals（约 $0.50/eval） |
| SDK harness | 复用 cheap shape evals（可行时约 $0/eval） |
| `gstack-upgrade/migrations/` | state-format migrations 已有 pattern；复用做 v2 auto-regenerate |
| `~/.gstack/analytics/skill-usage.jsonl` | 已采集；驱动延期的 `gstack budget` CLI |

我们是在追上 Anthropic 的 canonical Skills pattern，不是在发明新东西。

## Dream state delta（理想状态差异）

```
TODAY                              v1.45.0.0                         v2.0.0.0
──────                             ─────────                         ────────
2.1MB corpus                       ~1.3MB corpus (-40%)              ~700KB corpus (-67%)
ship.md: 164KB                     ship.md: ~80KB (-50%)             ship.md: ~15KB skeleton
                                                                     + 5×~5KB sections
28/31 over 40KB ceiling            ~10/31 over ceiling                ~3/31 over ceiling
                                                                     (cso, document-release,
                                                                      design-consultation
                                                                      保持 monolith)
Catalog：多段描述，               Catalog：每个 skill 一行          Catalog：每个 skill 一行
voice triggers                    (~70% catalog cut)                 (same)
无 eval coverage matrix           每个 skill：≥1 gate eval          Section-level eval
                                   + ≥1 periodic eval                annotations + CI orphan check
第三方 reviews 中的               内部 measured：                  外部 measured：
"Fat" reputation                  "Compressed, eval-protected"       "Lightest opinionated skill pack"
```

## Phase 0 — Eval coverage matrix（eval 覆盖矩阵，v1.45.0.0）

**Goal（目标）：** gstack 中每个 skill 都至少带一个 gate-tier eval 和一个 periodic-tier eval，用于断言 must-have behavior。eval suite 成为 design spec。这是计划中的承重 claim，必须最先完成。

**Cross-model tension noted（已记录的跨模型张力）：** Codex 认为这是 procrastination trap，shape asserts 也很浅。用户明确选择 full tiered coverage（D9 = A），理由是：“the eval suite IS the design spec; that commitment is the load-bearing claim of the whole plan.” 我们接受更大的前期投入。

**Mitigation of Codex's "shape vs quality" critique（对 Codex “shape vs quality” critique 的缓解）：** 对 orchestration/judgment skills（`plan-ceo`、`office-hours`、`autoplan`），must-have 不是确定性输出，而是结构合规：是否以正确 shape 调用 AskUserQuestion？是否遵循 section order？是否持久化 artifacts？Eval design 必须捕获 structural contracts，而不是 output content。如果结构 eval 不可能，则该 section 要明确标注为“judgment-dependent, not eval-protected”，并且之后不能剥离未受保护的 judgment prose。这样就吸收了 Codex #2 critique。

**Skills currently lacking dedicated E2E coverage（当前缺 dedicated E2E coverage 的 skills）**（eval-writing target）：

| Skill | Gate eval (target) | Periodic eval (target) | Est. cost/run |
|---|---|---|---|
| qa-only | report-only flag triggers | full QA flow with fix-loop disabled | $0.30 / $1.50 |
| retro | weekly aggregate runs without error | full retro produces ranked output | $0.20 / $2.00 |
| document-release | reads CHANGELOG, produces Diataxis map | full post-ship doc update | $0.30 / $1.80 |
| document-generate | generates 4 doc types from prompt | E2E generation passes quality bar | $0.30 / $2.00 |
| context-save | persists state to expected path | round-trip restore preserves context | $0.10 / $0.50 |
| context-restore | reads latest save, applies to session | cross-workspace restore works | $0.10 / $0.50 |
| gstack-upgrade | detects install type, runs upgrade | full upgrade + migration round-trip | $0.20 / $1.00 |
| sync-gbrain | refreshes index without error | full sync produces searchable corpus | $0.20 / $1.50 |
| setup-gbrain | path 1-4 detection works | end-to-end setup for each path | $0.20 / $2.00 |
| setup-browser-cookies | picker UI loads without error | cookie import round-trip | $0.20 / $1.00 |
| setup-deploy | detects config, writes expected files | full deploy config setup | $0.20 / $1.00 |
| design-consultation | DESIGN.md template renders | full design system generation | $0.30 / $2.50 |
| design-shotgun | variants generated and saved | full multi-variant exploration | $0.30 / $2.00 |
| open-gstack-browser | launches browser without error | sidebar attaches and shows activity | $0.20 / $0.80 |
| pair-agent | setup key generated, instructions printed | full pair flow with second agent | $0.20 / $1.50 |
| land-and-deploy | merge gates check correctly | full merge → deploy → canary | $0.30 / $3.00 |
| canary | post-deploy loop runs, exits cleanly | full canary cycle with alert simulation | $0.20 / $1.50 |
| benchmark | runs and produces score | full regression detection | $0.20 / $2.00 |
| plan-devex-review | mode routing works | full DX review with scoring | $0.40 / $3.00 |
| devex-review | live DX audit produces scorecard | E2E DX measurement vs plan baseline | $0.40 / $2.50 |

预计新增 CI 成本：**gate 每次约 $5，periodic 每次约 $30。** 加上现有 E2E suite（gate 约 $15，periodic 约 $30），总计：gate 约 $20（每个 PR），periodic 约 $60（每周）。可接受。

**Eval matrix lives at（eval matrix 位置）：** `test/helpers/skill-coverage-matrix.ts`，作为 skill → eval paths 的 single source of truth。`test/skill-coverage-matrix.test.ts` 中的 CI check 会在任何 skill 缺 entry 时 fail build。

**Critical files to add（需要新增的关键文件）：**

- `test/skill-coverage-matrix.ts` — registry mapping skill → eval paths
- `test/skill-e2e-*.test.ts` — 20 个新 test files（gate-tier subset 先进入 gate config，periodic-tier subset 进入 periodic config）
- `test/helpers/touchfiles.ts` — 为 diff-based selection 注册新 tests

## Phase A — Build-time compression（构建时压缩，v1.45.0.0）

**A.1 Conditional resolver injection** — 扩展 `scripts/gen-skill-docs.ts` 和 `scripts/resolvers/`：

```ts
// scripts/resolvers/types.ts
export type ResolverFn = (ctx: TemplateContext, args?: string[]) => string;
export type ResolverEntry = ResolverFn | {
  resolve: ResolverFn;
  appliesTo?: (ctx: TemplateContext) => boolean;
};
```

```ts
// scripts/resolvers/index.ts — gate the heavy ones
QUESTION_TUNING: {
  resolve: generateQuestionTuning,
  appliesTo: (ctx) => ['plan-ceo-review','plan-eng-review','office-hours'].includes(ctx.skillName),
},
REVIEW_ARMY: {
  resolve: generateReviewArmy,
  appliesTo: (ctx) => ['ship','review'].includes(ctx.skillName),
},
REVIEW_DASHBOARD: {
  resolve: generateReviewDashboard,
  appliesTo: (ctx) => ['ship','plan-ceo-review','plan-eng-review','plan-design-review','plan-devex-review','devex-review'].includes(ctx.skillName),
},
// ... audit all 21 resolvers, gate per actual usage
```

```ts
// scripts/gen-skill-docs.ts (~line 444) — check the gate
const entry = RESOLVERS[resolverName];
const resolver = typeof entry === 'function' ? entry : entry.resolve;
const gate = typeof entry === 'function' ? undefined : entry.appliesTo;
if (gate && !gate(ctx)) return '';
return args.length > 0 ? resolver(ctx, args) : resolver(ctx);
```

**A.2 Jargon-list dedup** — 当前 `scripts/resolvers/preamble/generate-writing-style.ts` 会把完整 1.8KB jargon glossary 内联到 37 个 skills。改成 reference：“For the canonical jargon list, Read `~/.claude/skills/gstack/scripts/jargon-list.json` on first use.” 总 corpus 约省 66KB。

**A.3 Terse-mode actually compresses** — 在 `gen-skill-docs.ts` 中读取一次 `~/.gstack/config.yaml`，把 `explainLevel` 传进 `TemplateContext`，并让 `generate-writing-style.ts` / `generate-completeness.ts` / `generate-confusion-protocol.ts` / `generate-context-health.ts` 在 terse 时返回 `''`。现在即使 config 设置了 terse，字节仍然生成；flag 只是改变 runtime model behavior。为 benchmark 添加 `--explain-level=terse` build flag。

**A.4 Catalog trim**（按 Codex #6 前移）— 把始终加载的 system prompt 中的 skill descriptions 缩短成每个 skill 一行。Voice triggers 从 catalog descriptions 移进 in-skill content。Proactive-suggest 段落移到单独的 `~/.claude/skills/gstack/scripts/proactive-suggestions.json`，只有 agent 需要 routing guidance 时才加载。Per-skill description format：

```
- <skill-name>: <one-line outcome description, ≤80 chars> (gstack)
```

预计 catalog cut：约 70%（最大的单项 always-loaded reduction）。

**A.5 cso/ targeted compression**（Codex #9）— `cso` 获得 resolver dedup + catalog trim。Security guidance prose 暂时保持 monolith，直到 Phase B audit 表明具体 sections 可以安全移动到 `sections/` 并有 eval coverage。不是“exempt”，只是排在最后。

**A.6 Hard token budgets**（Codex #10）— 在 `test/skill-e2e-budget-regression.test.ts` 中定义并强制：

| Budget | v1.44 actual | v1.45 target | v2.0 target |
|---|---|---|---|
| Max system-prompt catalog tokens | ~25K | ~8K | ~6K |
| Max per-skill SKILL.md size | 164KB (ship) | 100KB | 30KB (heavyweights) |
| Max corpus total | 2.1MB | 1.3MB | 700KB |
| Max first-invocation latency (heavyweight) | ~immediate | ~immediate | <500ms section reads |

CI 在任何 budget 超限时 fail。通过现有 budget-regression jsonl 随时间追踪。

## Phase B — sections/ pattern for heavyweights（heavyweight skills 的 sections/ pattern，v2.0.0.0）

把 5 个 heavyweights 转成 Anthropic-canon skeleton + `sections/*.md`：

```
ship/
├── SKILL.md              # 12-15KB decision-tree skeleton + section manifest
├── SKILL.md.tmpl         # source for the skeleton
├── sections/
│   ├── manifest.json     # NEW: structured section registry (Codex #3 mitigation)
│   ├── version-bump.md
│   ├── changelog.md
│   ├── review-army.md
│   ├── todos-cleanup.md
│   ├── pr-body.md
│   └── ...
```

**Silent-behavior-loss mitigations（silent behavior loss 缓解）**（Codex #3）— 多层防御，不只靠 self-check：

1. **Section manifest**（`sections/manifest.json`）— 结构化 registry：`{section_file, applies_when, required_for}`。Decision-tree skeleton 通过 ID 引用 entries，而不是自由文本。
2. **Imperative skeleton phrasing** — “STOP. Read `sections/version-bump.md` before computing the bump.” 而不是 “see ... for details.”
3. **Top-of-file section index table** — situation → section file mapping。
4. **End-of-skill self-check** — “确认你 Read 了 decision tree 指向的每个 section，并列出它们。”（最弱层，作为 fallback 保留。）
5. **Eval harness `requiredReads` declaration** — E2E test 断言给定 fixture 下 transcript Read calls 中必须出现哪些 sections。在 test layer 做机械强制，而不仅是 prompt layer。
6. **Transcript inspection in canary cohort** — post-ship 第一周记录真实 sessions 实际读取了哪些 sections；如果 marked-required sections 发生 Read-miss 就 alert。

**Conversion order（转换顺序）**（一次一个，验证通过后再做下一个）：

1. `ship/` — 调用最多、成本最大、风险最高。单独 landing，观察 1 周。
2. `plan-ceo-review/` — conversational；有破坏 flow 的风险。第二个 landing，仔细观察。
3. `office-hours/` — 最 conversational。只有 1+2 干净后才第三个 landing。
4. `plan-eng-review/` 和 `plan-design-review/` — 一起做，shape 相似。

**Do not convert** unless explicitly approved later: `autoplan`（orchestrator，已经链式调用 skills）、`design-review`（UI flow 已经紧凑）、`qa`（single-purpose）、`investigate`（single-purpose）。

## Phase C — Eval annotations + CI orphan check（eval annotations 与 CI orphan check，v2.0.0.0）

按 Codex #4，采用 warn-before-fail progression，而不是立即 strict gate。

```md
<!-- eval: test/skill-e2e-ship-version-bump.test.ts -->
<!-- coverage: 断言当 claimed version 已被占用时，queue-aware bump 会选择下一个可用 version -->
```

Annotations 包含**coverage semantics**（被保护的行为）以响应 Codex #5，而不只是 paths。Path-only 会制造虚假信心。

CI check 在 `gen-skill-docs.ts` walker 中：

- v2.0.0.0 以 WARN mode 发布，orphans 记录到 PR summary，但 build pass
- v2.1.0.0（或 v2.0 之后 2 个 release cycles）从 WARN 升级为 FAIL
- Waiver: `<!-- eval: none — accept loss, reviewed YYYY-MM-DD by @user -->`

这避免了“强制 annotation 但没有 semantics”的 maintenance theater，也给用户一个 transition window。

## Migration approach（迁移方式，v2.0.0.0，lighter touch per D11）

- v2.0.0.0 CHANGELOG 中的 release note 解释 `sections/` format change 和具体用户影响：fork/copy-pasted `SKILL.md` files 需要重新 fetch；heavyweight skills 的首次调用会增加约 200-500ms section-read latency。
- `/gstack-upgrade` 在下次调用时 auto-regenerates。没有 interactive migration prompts。
- Vendored installs 在第一次接触 v2 时收到一条 one-line warning（复用现有 vendored-install warning pattern in skill preamble）。
- `gstack-upgrade --explain-v2` flag 提供按需完整解释。

## Forks / customization compatibility（fork 与自定义兼容性，Codex #11）

在 v2.0.0.0 release note 中记录：

- 任何直接读取/复制/编辑 heavyweight `SKILL.md` 文件的人：该文件现在是 skeleton；行为位于 `sections/*.md`。他们需要要么把 skill 当黑盒使用（推荐），要么 fork 包含 `sections/` 的完整 `skill/` 目录。
- 任何在 fork 中有本地 `SKILL.md.tmpl` edits 的人：templates 变小了；regenerate 时很可能发生 conflicts。Fork docs 更新 migration guidance。
- 任何 docs/blog posts 链接到 generated `SKILL.md` 具体行号的人：行号会移动；建议改链 template + section name。

## Rollout strategy（rollout 策略，Codex #12）

v1.45.0.0:

- 在一个 PR 中 landing；现有 budget-regression test 捕获任何 per-skill size regression；eval matrix CI check 捕获任何缺 evals 的 skill。
- Dogfood：在宣布之前，跨 Garry 的所有 workspaces active use 1 周。

v2.0.0.0:

- **Canary cohort**：先通过 `v2.0.0-rc.1` tag 发布给 dogfood users（Garry + active agents）。Real-PTY harness 记录 top 5 workflows（`/ship`、`/qa`、`/review`、`/plan-ceo-review`、`/autoplan`）的 section Reads；对 required sections 的 Read-miss 发 alert。
- **Manual verification**：tag v2.0.0.0 final 之前，手动跑 top 5 workflows，并把 before/after transcripts 保存为 eval baselines。
- **Regression dashboard**：扩展现有 `bun run eval:summary`，展示 v1 vs v2 per-skill token + behavioral compliance comparison。
- **Rollback**：revert PR + `bun run gen:skill-docs` 重新生成旧 shape。记录到 `CONTRIBUTING.md`。

## Review-section findings（review section findings，Sections 1-11 condensed）

| Section | 发现 | 状态 |
|---|---|---|
| 1. Architecture | Lazy-section silent-loss risk；用上述 6-layer defense 缓解 | 已在 plan 中处理 |
| 2. Errors/Rescues | gen-skill-docs gate-fail loud；missing sections fall back to skeleton；CI orphan check loud | 已处理 |
| 3. Security | cso targeted dedup，不是 blanket exemption（吸收 Codex #9）；migration script 在 user-shell trust boundary 运行，与现有 migrations 相同 | 已处理 |
| 4. Data/UX edge cases | release note 提醒 v1→v2 muscle-memory break；vendored noted；concurrent dev-symlink sessions risk 是现有 CLAUDE.md caveat | 已处理 |
| 5. Code quality | gen-skill-docs/types/index 约 150 LOC additive；约 20 个新 eval test files；sections/ extraction 是 mechanical | OK |
| 6. Tests | Phase 0 就是 test plan。Coverage matrix CI gate 强制每个 skill 都有 evals | 已处理 |
| 7. Performance | Build time <2× current；runtime 对 sectioned heavyweights 增加 200-500ms first-invocation；catalog trim 降低每个 session 的 always-loaded prompt size | 已记录 |
| 8. Observability | budget-regression test 已存在；Phase B 有 canary cohort transcript logging；migration outcome 记录到 `~/.gstack/analytics/migrations.jsonl` | 已处理 |
| 9. Deployment | 两阶段 release split + warn-before-fail eval annotations + rollback via revert | 已处理 |
| 10. Long-term trajectory | Reversibility 3/5；sections/ pattern 成为未来 skills 的 template；deferred TODOs 延展 v2 narrative for v2.1+ | OK |
| 11. Design/UX | README v2 banner + CHANGELOG numbers table 落在 v2.0.0.0；具体数字、gstack voice、no AI slop | OK |

## NOT in scope（不在范围内）

- **Skill removals.** 用户说“keep all functions.” `qa-only`、`design-shotgun`、`pair-agent`、`open-gstack-browser` 都保留。它们和其他 skill 一样获得 evals + catalog trim。
- **Skill renames.** 不做 `qa` → `qa-fix` 合并。保持 CLI surface 稳定。
- **gstack lite/pro install profiles.** 延期到 TODOS 的 post-v2。
- **gstack budget CLI.** 延期到 TODOS 的 post-v2。
- **Per-skill eval coverage badge in README.** 延期到 TODOS。
- **Cross-tool portability test/demo (Codex/Cursor compat).** 延期到 TODOS。
- **Token-cost preview on invocation.** 延期到 TODOS。
- **Skill autoload telemetry.** 延期到 TODOS。
- **gstack diff PR comment.** 延期到 TODOS。

## TODOS.md updates（TODOS.md 更新，deferred items，建议 post-merge bulk-add）

| TODO | Priority（优先级） | Effort（投入，human / CC） | Depends on（依赖） |
|---|---|---|---|
| `gstack lite` install profile (5-skill core) | P2 | 2 days / 3-4 hrs | v2.0.0.0 |
| `gstack pro` opt-in upgrade path | P2 | 1 day / 1 hr | gstack lite |
| `gstack budget` CLI (per-skill token usage telemetry) | P2 | 1 day / 1 hr | v1.45.0.0 |
| Per-skill eval coverage badge in `gstack-skills list` + README | P3 | 1 day / 1 hr | Phase 0 |
| Cross-tool portability test/demo (Codex CLI, Cursor) | P3 | 2 days / 2 hrs | v2.0.0.0 |
| Token-cost preview on skill invocation | P3 | 1 day / 1 hr | gstack budget CLI |
| Skill autoload telemetry (dead-weight detection) | P3 | 2 days / 2 hrs | v1.45.0.0 |
| `gstack diff` PR comment (per-PR budget delta) | P3 | 1 day / 1 hr | budget-regression extended |
| Section-level eval annotations visible to user (confidence signal) | P3 | half day / 30 min | Phase C |

## Critical files（关键文件）

| Path（路径） | Change（变更） | Phase（阶段） |
|---|---|---|
| `scripts/gen-skill-docs.ts` | Add resolver gate check (~line 444); read explain_level from config; add CI orphan walker | A, C |
| `scripts/resolvers/types.ts` | Add `ResolverEntry` union type | A |
| `scripts/resolvers/index.ts` | Wrap heavy resolvers with `appliesTo` predicates (audit all 21) | A |
| `scripts/resolvers/preamble/generate-writing-style.ts` | Replace inline jargon; return `''` on terse | A |
| `scripts/resolvers/preamble/generate-completeness.ts` | Return `''` on terse | A |
| `scripts/resolvers/preamble/generate-confusion-protocol.ts` | Return `''` on terse | A |
| `scripts/resolvers/preamble/generate-context-health.ts` | Return `''` on terse | A |
| `scripts/skill-catalog.ts` (new or in gen-skill-docs) | One-line catalog generator + voice-triggers JSON splitter | A.4 |
| `scripts/proactive-suggestions.json` (new) | Voice triggers + proactive suggestions, loaded on demand | A.4 |
| `test/skill-coverage-matrix.ts` (new) | Single-source-of-truth eval registry | Phase 0 |
| `test/skill-coverage-matrix.test.ts` (new) | CI gate: every skill has entries | Phase 0 |
| `test/skill-e2e-*.test.ts` (~20 new files) | New evals for skills currently lacking coverage | Phase 0 |
| `test/skill-e2e-budget-regression.test.ts` | Extend with per-skill hard budgets | A.6 |
| `test/helpers/touchfiles.ts` | Register new tests for diff-based selection | Phase 0 |
| `ship/SKILL.md.tmpl` → `ship/sections/manifest.json` + `ship/sections/*.md` | Skeleton extraction | B |
| `plan-ceo-review/SKILL.md.tmpl` → sections/ | Skeleton extraction | B |
| `office-hours/SKILL.md.tmpl` → sections/ | Skeleton extraction | B |
| `plan-eng-review/SKILL.md.tmpl` → sections/ | Skeleton extraction | B |
| `plan-design-review/SKILL.md.tmpl` → sections/ | Skeleton extraction | B |
| `gstack-upgrade/migrations/v2.0.0.0.sh` (new) | Auto-regenerate + vendored-install warning | B |
| `CHANGELOG.md` | v1.45.0.0 entry (normal), v2.0.0.0 entry (marketing-grade w/ numbers table) | A, B |
| `README.md` | v2.0.0.0 banner; "lightest opinionated skill pack" positioning | B |
| `CONTRIBUTING.md` | Document sections/ pattern + rollback procedure | B |

## 验证

**v1.45.0.0:**

1. `bun run gen:skill-docs` succeeds with no errors
2. `bun test` passes（skill-validation、gen-skill-docs.test.ts、browse integration、NEW skill-coverage-matrix.test.ts）
3. `bun run test:evals` passes — all new gate evals green；现有 evals 无 regression
4. `bun run test:evals:periodic` passes — all new periodic evals green
5. Catalog system-prompt size measured：target ≤8K tokens（vs 当前 ~25K）。PR body 捕获 before/after。
6. Total SKILL.md corpus byte count：target ≤1.3MB（vs 2.1MB）。PR body 捕获。
7. Top 3 heaviest skills under 100KB。
8. Manual smoke：在 fresh Claude Code sessions 中调用 `/ship`、`/plan-ceo-review`、`/office-hours`；确认没有 missing behavior。保存 transcripts 作为 v1.45 baselines。

**v2.0.0.0:**

1. All v1.45 checks pass
2. Sectioned skills：total corpus ≤700KB；heavyweight skeletons 每个 ≤30KB
3. `test/skill-e2e-ship-section-loading.test.ts` (new)：断言 `/ship` 按 decision tree 读取 expected sections
4. Canary cohort：以 `v2.0.0-rc.1` dogfood 1 周并启用 transcript logging；marked-required sections 的 Read-miss 为零
5. 手动验证 top 5 workflows；transcripts 与 v1.45 baselines 比较
6. Migration：在 v1.45 install 上运行 `gstack-upgrade`，无 prompts 地成功 regenerate；vendored-install warning 出现一次
7. CHANGELOG numbers table 匹配 measured reality
8. WARN-mode orphan check：PR summary 显示 orphan list；build passes

## Cross-model agreements baked in（已吸收的跨模型共识）

从 Codex review 接受并集成的项目：

- #4 Warn-before-fail eval annotations (Phase C)
- #5 Annotation comments 中写 coverage semantics，而不只是 paths
- #6 Catalog trim moved up to Phase A（原本埋在 sections/ 之后）
- #9 cso gets resolver dedup + catalog trim（不是 blanket exempt）
- #10 Hard token budgets defined + enforced (Phase A.6)
- #11 Forks/customization compatibility documented (Migration section)
- #12 Rollout strategy with canary cohort + manual top-5-workflows verification (Rollout section)

用户明确拒绝 Codex review 中的项目（D9, D10）：

- #1 Eval-first scope：用户保留 full tiered coverage。通过 structural-eval guidance（不是 output-content）缓解 orphan/judgment skills。
- #7 v2.0.0.0 vs v1.x：用户选择 HYBRID。v1.45 吸收低风险收益；v2.0.0.0 承载真正 breaking 的 `sections/` change。

用户接受 Codex 而不是原方案的项目：

- #8 Migration approach：当 v1.45 吸收低风险工作后，用户从 hard-cut（D7）改为 lighter touch（D11）。

## Implementation Tasks（实现任务）

由本 review 的 findings 综合而成。每个 task 都来自上述具体 phase/finding。T1-T8 落在 v1.45.0.0；T9-T16 落在 v2.0.0.0。

- [ ] **T1 (P1, human: ~3 days / CC: ~7 hours)** — Phase 0 / coverage matrix — 为缺 coverage 的 20 个 skills 写 gate+periodic evals
  - 来源：Phase 0 section
  - Files: `test/skill-coverage-matrix.ts`, `test/skill-coverage-matrix.test.ts`, ~20 new `test/skill-e2e-*.test.ts`, `test/helpers/touchfiles.ts`
  - 验证：`bun test test/skill-coverage-matrix.test.ts` 和 `bun run test:evals` 都带 new evals 通过
- [ ] **T2 (P1, human: ~1 day / CC: ~1 hour)** — A.1 conditional resolver injection — 添加 `appliesTo` gate
  - 来源：Phase A section，Codex #10（measurement before architecture）
  - Files: `scripts/resolvers/types.ts`, `scripts/gen-skill-docs.ts:444`, `scripts/resolvers/index.ts`
  - 验证：`bun run gen:skill-docs` 生成更小的 SKILL.md files；`bun test` 通过
- [ ] **T3 (P1, human: ~half day / CC: ~30 min)** — A.2 + A.3 jargon dedup + terse-mode gen-time compression
  - 来源：Phase A section
  - Files: `scripts/resolvers/preamble/generate-writing-style.ts`, `generate-completeness.ts`, `generate-confusion-protocol.ts`, `generate-context-health.ts`
  - 验证：jargon-list 不再内联出现在 generated SKILL.md；`gstack-config set explain_level terse && bun run gen:skill-docs` produces shorter files
- [ ] **T4 (P1, human: ~1 day / CC: ~2 hours)** — A.4 catalog trim — one-line skill descriptions；voice triggers + proactive paragraphs 移入 JSON
  - 来源：Codex #6（highest-leverage），Phase A.4
  - Files: `scripts/skill-catalog.ts` (new), `scripts/proactive-suggestions.json` (new), per-skill SKILL.md.tmpl frontmatter for one-line description field
  - 验证：catalog system-prompt size <8K tokens；voice-triggered invocation 仍然工作
- [ ] **T5 (P1, human: ~half day / CC: ~30 min)** — A.6 hard token budgets in budget-regression
  - 来源：Codex #10
  - Files: `test/skill-e2e-budget-regression.test.ts`
  - 验证：budget-regression 在人为膨胀 test SKILL.md 超出 budget 时失败
- [ ] **T6 (P1, human: ~1 day / CC: ~1 hour)** — A.5 cso resolver dedup + catalog trim（NOT broader compression）
  - 来源：Codex #9
  - Files: `cso/SKILL.md.tmpl` (no structural change, only resolver gate audit)
  - 验证：cso SKILL.md size drops 20-30%；cso E2E evals still pass
- [ ] **T7 (P1, human: ~1 day / CC: ~1 hour)** — Regenerate all SKILL.md atomically + measure
  - 来源：Phase A
  - Files: all `*/SKILL.md` regenerated
  - 验证：PR body includes before/after corpus size、top 10 skill sizes、catalog size；budget-regression confirms targets met
- [ ] **T8 (P2, human: ~half day / CC: ~30 min)** — v1.45.0.0 CHANGELOG entry（normal voice；说明 Phase 0 + Phase A landed）
  - 来源：Release shape section
  - Files: `CHANGELOG.md`, `VERSION`
  - 验证：CHANGELOG lints clean；reverse-chrono order preserved；entry covers the diff

- [ ] **T9 (P1, human: ~2 days / CC: ~3 hours)** — Phase B.1 convert ship/ to skeleton + sections/
  - 来源：Phase B section
  - Files: `ship/SKILL.md.tmpl` → skeleton；`ship/sections/manifest.json` + `ship/sections/*.md`
  - 验证：new `test/skill-e2e-ship-section-loading.test.ts` asserts expected Reads per decision tree；existing ship evals pass；ship.md skeleton <15KB
- [ ] **T10 (P1, human: ~1 day / CC: ~1 hour)** — Canary cohort for ship/（以 `v2.0.0-rc.1` dogfood 1 周）
  - 来源：Rollout strategy section，Codex #12
  - Files: `test/helpers/transcript-section-logger.ts` (new)
  - 验证：dogfood transcripts 中 marked-required sections 的 Read-miss 为零
- [ ] **T11 (P1, human: ~2 days / CC: ~3 hours)** — Phase B.2 convert plan-ceo-review/（ship/ 证明后）
  - 来源：Phase B section
  - Files: `plan-ceo-review/SKILL.md.tmpl` + `plan-ceo-review/sections/`
  - 验证：section-loading test green；plan-ceo evals pass
- [ ] **T12 (P2, human: ~3 days / CC: ~4 hours)** — Phase B.3 + B.4 convert office-hours + plan-eng-review + plan-design-review
  - 来源：Phase B section
  - Files: respective `SKILL.md.tmpl` + `sections/` directories
  - 验证：section-loading tests green；respective evals pass
- [ ] **T13 (P1, human: ~1 day / CC: ~1 hour)** — Phase C eval annotations + 3-tier orphan check
  - 来源：Phase C section，Codex #4 + #5
  - Files: `scripts/gen-skill-docs.ts` (orphan walker), all `sections/*.md` (annotations with coverage semantics)
  - 验证：orphan check reports correctly in PR summary；build still passes in WARN mode
- [ ] **T14 (P1, human: ~half day / CC: ~30 min)** — `gstack-upgrade/migrations/v2.0.0.0.sh` lighter-touch auto-regenerate
  - 来源：Migration approach section
  - Files: `gstack-upgrade/migrations/v2.0.0.0.sh`
  - 验证：upgrade from v1.45 install produces clean v2 state without prompts；vendored install gets one-line warning
- [ ] **T15 (P1, human: ~half day / CC: ~1 hour)** — v2.0.0.0 marketing-grade CHANGELOG with v1 vs v2 numbers table
  - 来源：D5、Release shape、Codex #7（real breakage documented）
  - Files: `CHANGELOG.md`, `README.md`, `VERSION`
  - 验证：numbers table matches measured corpus；release note documents concrete breakage（sections/ format change、first-invocation latency、vendored-install deprecation）；positioning past-tenses bloat reputation
- [ ] **T16 (P2, human: ~1 day / CC: ~1 hour)** — Bulk-add 9 deferred TODOS to TODOS.md（gstack lite, gstack budget, etc.）
  - 来源：TODOS.md updates section
  - Files: `TODOS.md`
  - 验证：TODOS format matches `.claude/skills/review/TODOS-format.md`

## Failure Modes Registry（故障模式登记表）

| Codepath | Failure mode | Rescued? | Test? | User sees | Logged |
|---|---|---|---|---|---|
| gen-skill-docs.ts gate check | resolver `appliesTo` throws | Y — try/catch logs + skips resolver | Y (test/gen-skill-docs.test.ts extended) | "resolver X errored, skipped" in build output | stderr |
| sections/ Read at runtime | section file missing | Y — agent falls back to skeleton-only behavior | Y (test/skill-e2e-ship-section-loading.test.ts) | warning in agent prose | session transcript |
| CI orphan walker | sections/*.md missing eval annotation | WARN mode v2.0; FAIL v2.1+ | Y (test/skill-coverage-matrix.test.ts) | PR summary lists orphans | PR comment |
| Migration script v2.0.0.0.sh | regenerate fails on damaged install | Y — script aborts, prints repair steps | Y (migration test) | clear error + repair steps | ~/.gstack/analytics/migrations.jsonl |
| Catalog one-line generator | skill missing one-line description in frontmatter | Y — gen-skill-docs fails build loudly | Y (gen-skill-docs.test.ts extended) | build error | stderr |
| Canary section-Read logger | logger missing for a heavyweight skill | Y — silently skipped, gap visible in dashboard | Y (transcript-logger test) | none directly; surfaced in canary dashboard | ~/.gstack/analytics/section-reads.jsonl |

没有 critical gaps：每个 failure mode 都有 rescue、test 和 visibility。

## Diagrams（图表）

System architecture (build pipeline):

```
  CONFIG (~/.gstack/config.yaml)
     |
     v
  +-----------------+      +--------------------+
  | gen-skill-docs  | <--- | resolvers/*.ts     |
  | (with gate)     |      | (w/ appliesTo)     |
  +-----------------+      +--------------------+
     |
     v
  +--------------------------+
  | SKILL.md.tmpl per skill  |
  | + sections/manifest.json | (heavyweights only, v2)
  | + sections/*.md          | (heavyweights only, v2)
  +--------------------------+
     |
     v
  +--------------------+         +--------------------------+
  | generated SKILL.md | <-----> | scripts/jargon-list.json |
  | (skeleton for      |         | (referenced, not inlined)|
  |  heavyweights v2)  |         +--------------------------+
  +--------------------+
     |
     v
  +-------------------+      +----------------------+
  | catalog (system   | <--- | proactive-suggestions|
  |  prompt, one-line |      | .json (loaded on     |
  |  per skill)       |      |  demand only)        |
  +-------------------+      +----------------------+
```

Section-Read flow (v2 runtime):

```
  USER /ship
     |
     v
  +-----------------------+
  | ship/SKILL.md         |
  | (12-15KB skeleton)    |
  | reads:                |
  |  - manifest.json      |
  |  - decision tree      |
  +-----------------------+
     |
     v  Agent walks decision tree, identifies which sections apply
     |
     +-----> Read sections/version-bump.md   (if bumping)
     +-----> Read sections/changelog.md      (if writing entry)
     +-----> Read sections/review-army.md    (if pre-ship review)
     +-----> ... only sections that apply
     |
     v
  +-------------------------+
  | end-of-skill self-check |
  | "list sections I read"  |
  +-------------------------+
     |
     v  Canary cohort: transcript-section-logger compares
     |  actual Reads vs manifest's required_for declarations
     |  alerts on miss
```

## Stale diagram audit（过期图表审计）

此计划影响的 CLAUDE.md / ARCHITECTURE.md 中 ASCII diagrams：

| Diagram | File | Still accurate post-v2? |
|---|---|---|
| Sidebar message flow | `docs/designs/SIDEBAR_MESSAGE_FLOW.md` | YES (unrelated subsystem) |
| Dual-listener tunnel architecture | `ARCHITECTURE.md` | YES (unrelated) |
| Unicode sanitization at server egress | `ARCHITECTURE.md` | YES (unrelated) |
| (none for skill build pipeline) | — | New diagrams above are NEW, not updates |

没有 stale diagrams 需要修复。

## Completion summary（完成摘要）

```
+====================================================================+
|            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
+====================================================================+
| Mode selected        | SCOPE EXPANSION                              |
| System Audit         | bloat externally documented; prior design   |
|                      | doc unrelated; budget-regression infra exists|
| Step 0               | EXPANSION + Approach C + eval-first +       |
|                      | hybrid v1.45/v2.0 split + lighter migration |
| Section 1  (Arch)    | 1 finding — silent-loss risk, 6-layer mit   |
| Section 2  (Errors)  | 6 failure modes mapped, 0 CRITICAL GAPS     |
| Section 3  (Security)| cso targeted dedup (Codex #9 absorbed)      |
| Section 4  (Data/UX) | v1→v2 muscle memory warned, vendored noted  |
| Section 5  (Quality) | ~150 LOC additive, mechanical extraction    |
| Section 6  (Tests)   | Phase 0 IS the test plan                    |
| Section 7  (Perf)    | <2× build time; +200-500ms first-invoke v2  |
| Section 8  (Observ)  | budget-regression + canary + migrations.log |
| Section 9  (Deploy)  | 2-release split + warn-before-fail + revert |
| Section 10 (Future)  | Reversibility 3/5; sections/ becomes template|
| Section 11 (Design)  | README banner + numbers table              |
+--------------------------------------------------------------------+
| NOT in scope         | written (9 items deferred)                   |
| 现有资产             | written (9 reuse points)                    |
| Dream state delta    | written (TODAY / v1.45 / v2.0)              |
| Error/rescue registry| 6 modes, 0 CRITICAL GAPS                    |
| Failure modes        | 已在 registry 中覆盖                         |
| TODOS.md updates     | 9 items, bulk-add post-merge                |
| Scope proposals      | 3 surfaced, 1 accepted (launch positioning) |
| CEO plan             | this plan IS the CEO plan                   |
| Outside voice        | ran (codex); 3 tensions surfaced            |
| Lake Score           | 11/11 recommendations chose complete option |
| Diagrams produced    | 2 (build pipeline, section-read flow)       |
| Stale diagrams found | 0                                           |
| Unresolved decisions | 0                                           |
+====================================================================+
```

## Eng-review additions（来自 /plan-eng-review session）

### Architectural decisions locked in（已锁定的架构决策）

- **D1 (manifest format):** `sections/manifest.json` 是结构化的 per-heavyweight registry（JSON，可被 gen-skill-docs CI checks 机器读取）。`SKILL.md` skeleton 是 markdown headers + imperative prose blocks（“STOP. If X, Read `sections/Y.md`”）。匹配 Anthropic documented `references/` style。不发明 DSL。
- **D2 (drift control):** `sections/*.md.tmpl` 是 source of truth；`sections/*.md` 是 generated。gen-skill-docs 遍历 `<skill>/sections/*.tmpl` 并用与 `SKILL.md` 相同的 resolver pipeline 写出 `<skill>/sections/*.md`。成本：`scripts/gen-skill-docs.ts` 约 30 LOC。消除 `test/ship-version-sync.test.ts` 已遭遇的 drift 类问题（TODOS:1120）。
- **D3 (CI cost cap):** 由 `test/skill-e2e-budget-regression.test.ts` 强制 `EVALS_BUDGET_HARD_CAP=$30` env var；如果单次 run 超过就 fail build。Section-loading tests（Phase B）使用 minimal-bash fixtures（约 $0.30 each），因为它们断言的是 STRUCTURAL behavior（是否 Read 了正确文件）而不是 output quality。

### Adjacent TODOS surfaced（暴露出的相邻 TODOS，informational, not blocking）

- **TODOS:161** — 为 browser-skills 计划的“resolver injection at session start”（P2）。与本计划的 `appliesTo` predicate 有架构重叠。Decision：暂时保持独立，browser-skill resolver injection 是 runtime（session-start hostname matching）；我们的 `appliesTo` 是 build-time（gen-skill-docs.ts）。生命周期和关注点不同。只有 browser-skills 工作需要相同 predicate shape 时再重访。
- **TODOS:1120** — `test/ship-version-sync.test.ts` 重新实现了 `ship/SKILL.md.tmpl` Step 12 bash。D2（`sections/*.md.tmpl` pipeline）是结构性修复。Phase B work 会使这个 TODO 不再需要；当 ship/ extraction lands 时标记 resolved。
- **TODOS:1136** — `ship/SKILL.md.tmpl` Step 12 line 409 中的 `git show` fallback。Phase B 会触碰这里；把 `git rev-parse --verify` fix 合并进 version-bump section extraction。

### Test plan artifact（测试计划产物）

Test plan 写入 `~/.gstack/projects/garrytan-gstack/garrytan-garrytan-slim-skill-tokens-eng-review-test-plan-<timestamp>.md`。`/qa` 和 `/qa-only` 以此作为 primary test input。覆盖：per-phase test coverage targets、section-loading tests fixture design、CI budget enforcement check、migration round-trip test。

### Failure modes additions（新增故障模式）

加入 §Failure Modes 的 registry（已有完整表；新 rows）：

| Codepath | Failure mode | Rescued? | Test? | User sees | Logged |
|---|---|---|---|---|---|
| sections/*.md.tmpl generator | template references missing resolver | Y — gen-skill-docs fails build loudly | Y (gen-skill-docs.test.ts extended) | build error | stderr |
| Manifest ↔ filesystem consistency | manifest references section file that doesn't exist | Y — CI check fails | Y (new `test/section-manifest-consistency.test.ts`) | build error | PR summary |
| Manifest ↔ filesystem consistency | section file exists but not in manifest (orphan) | WARN v2.0; FAIL v2.1+ | Y (same test) | PR summary | PR comment |
| Budget cap exceeded | single test or aggregate exceeds `EVALS_BUDGET_HARD_CAP` | Y — CI fails | Y (budget-regression extended) | build error w/ cost breakdown | stderr |

仍然 0 critical gaps。所有新 failure modes 都有 rescue + test + visibility。

### Execution sequencing（执行顺序，sequential v1.45, integration-branch v2.0）

v1.45 在单一分支中**顺序执行**，T1 → T8。Codex 第二轮 critique 指出 T2（gen-skill-docs.ts TemplateContext changes）和 T4（catalog frontmatter additions）几乎肯定会在 compile time 互相触碰，平行分支各自 pass 但 integration fail。重新考虑后放弃 parallelization map。顺序 landing 更干净，避免三方 merge 惊喜。AI compression 让顺序执行的 wall-clock 成本可接受。

| Step（步骤） | Modules touched（触达模块） | Depends on（依赖） |
|---|---|---|
| T1 Phase 0 evals (~20 files) | `test/skill-e2e-*.test.ts`, `test/skill-coverage-matrix.ts`, `test/helpers/touchfiles.ts` | — |
| T2 conditional resolver gate | `scripts/gen-skill-docs.ts`, `scripts/resolvers/types.ts`, `scripts/resolvers/index.ts` | T1 |
| T3 jargon dedup + terse compression | `scripts/resolvers/preamble/*` | T2 |
| T4 catalog trim | `scripts/skill-catalog.ts`, `scripts/proactive-suggestions.json`, all SKILL.md.tmpl frontmatter | T2 |
| T5 hard token budgets + override path | `test/skill-e2e-budget-regression.test.ts` (per-suite caps + `EVALS_BUDGET_OVERRIDE_REASON`) | T1 |
| T6 cso targeted dedup | `cso/SKILL.md.tmpl` | T2, T3 |
| T7 regenerate all SKILL.md atomically | all `*/SKILL.md` | T1-T6 |
| T8 v1.45 CHANGELOG | `CHANGELOG.md`, `VERSION` | T7 |
| **— v1.45.0.0 ship boundary —** | | |
| T9 ship/ sections/ extraction | `ship/SKILL.md.tmpl`, `ship/sections/*`, gen-skill-docs (sections pipeline w/ TemplateContext contract) | T8 + sections-pipeline (T2/D2) |
| T10 ship/ canary cohort | `test/helpers/transcript-section-logger.ts` | T9 |
| T11 plan-ceo-review sections/ | `plan-ceo-review/SKILL.md.tmpl` + sections | T10 (ship/ proven) |
| T12 office-hours + plan-eng + plan-design sections/ | respective directories | T11 |
| T13 Phase C eval annotations + 3-tier orphan check | gen-skill-docs.ts orphan walker, all sections/*.md | T9-T12 |
| T14 migration script | `gstack-upgrade/migrations/v2.0.0.0.sh` | T13 |
| T15 v2.0.0.0 CHANGELOG + README banner | `CHANGELOG.md`, `README.md`, `VERSION` | T14 |
| T16 TODOS bulk-add | `TODOS.md` | — anytime |

**Execution recommendation（执行建议）：** v1.45（T1→T8）和 v2.0（T9→T15）都用 single-worktree sequential。T16 随时 landing。CC speedup 来自每步压缩（每步约 1 小时 vs human-days），不是 parallel branches。

## Codex consult additions（Codex consult 补充，second pass, post eng-review）

### Cathedral parity-eval suite（Cathedral parity-eval suite，Phase 0 add-on, expanded to "11")

用户说：“do it like 11, not just 10. max it out and then some.” 最大化后的 scope：

- **ALL 31 skills** 获得 golden-baseline transcripts（不只是 top 5）
- **Multiple fixtures per skill**（每个 3-5 个代表性 invocation paths）
- **Quantitative + qualitative scoring:** LLM-as-judge similarity score（1-10）和 transcript-diff highlights（added/removed sections, missing nuance）
- **Token-efficiency ratio measured:** quality-per-token = judge_score / tokens_consumed（强制 v2 可测地 MORE efficient，而不只是更小）
- **“Quality budget” alongside “token budget”:** 两者都在 CI 强制。一个 v2 skill 压缩到一半大小但 quality 从 9/10 降到 6/10，就 fail gate。
- **Side-by-side PR comment:** 任何触碰 heavyweight skill 的 PR 都自动在 PR summary 贴 v1.45-baseline vs current parity comparison。
- **Public benchmark page:** `gstack.benchmarks.md`（new），持续更新。可引用：“v2 average parity score: 9.2/10, average token reduction: 67%.”
- **Continuous monitoring:** parity suite 每周在 main 运行；任何 skill drift below baseline 时 alert（Discord webhook or similar）
- **Baseline-capture script:** `test/helpers/capture-parity-baseline.ts` — 在 Phase A 工作开始前，在 v1.44 HEAD 上跑一次，锁定 golden transcripts

Effort（投入）：human 约 3-4 days / CC 约 6-8 hours one-time + 持续 monitoring 约 $30/week。成本合理，因为这是唯一能捕捉“looks green, feels worse” silent regression 的机制；section-loading 和 budget tests 都捕不到。新增 tasks T0a（baseline capture）和 T0b（parity eval harness），位于 T1 之前。

### Absorbed refinements from codex consult（已吸收，无需进一步用户决策）

1. **TemplateContext contract for sections pipeline（codex D2 critique）：** T9 必须有显式 spec。Section generation 使用与 `SKILL.md` generation 相同的 `TemplateContext`：same `skillName`、same host suppression、same `explainLevel`、same tier gating。写入 code comments，并由 `test/template-context-parity.test.ts`（new）断言。
2. **3-tier orphan classification（codex orphan-semantics critique）：** CI check（T13）区分：
   - **Generated orphan**（`sections/foo.md` exists, no `sections/foo.md.tmpl`）→ 立即 FAIL，每个 release 都如此
   - **Manifest orphan**（`sections/foo.md.tmpl` exists, not in `manifest.json`）→ v2.0 WARN，v2.1+ FAIL
   - **Hand-edited generated file**（`sections/foo.md` diverges from regen output）→ 立即 FAIL，并显示 “this file is generated, edit `.tmpl` instead”
3. **Budget cap override path（codex D3 critique）：** `EVALS_BUDGET_HARD_CAP=$30` 作为默认；per-suite caps 通过 `EVALS_BUDGET_HARD_CAP_GATE=$25`、`EVALS_BUDGET_HARD_CAP_PERIODIC=$70`；超 cap 需要设置 `EVALS_BUDGET_OVERRIDE_REASON="<text>"` env（CI 会在 build output 打印 reason 作为 audit trail）；通过现有 analytics（`~/.gstack/analytics/skill-usage.jsonl` aggregator）做 daily org-level spend alert。
4. **Manifest as passive data（codex D1 critique）：** `manifest.json` fields 只包含 IDs、file paths 和 human-readable trigger text。没有 `applies_when` predicate。Skill skeleton 的 decision-tree prose 是唯一决定“何时 read X”的地方。避免在 tier-gating + `appliesTo` + `requiredReads` 之外再发明第四种 condition language。
5. **T7 as integration-branch flow（codex parallelization critique, now obviated by sequential）：** 顺序执行意味着 T7 只是“在单一 v1.45 branch 中 atomic regenerate”。不需要 integration-branch dance。Critique 的意图（避免三方 merge 惊喜）通过 collapsing to sequential 得到满足。

### New failure modes（新增到 registry）

| Codepath | Failure mode | Rescued? | Test? | User sees | Logged |
|---|---|---|---|---|---|
| Sections pipeline TemplateContext | sections generated with divergent ctx (e.g. wrong skillName) | Y — parity test fails | Y (`test/template-context-parity.test.ts`) | build error | stderr |
| Hand-edited generated section | user edits `sections/foo.md` directly instead of `.tmpl` | Y — CI fails with explicit message | Y (orphan-check 3-tier classification) | "this file is generated, edit `.tmpl` instead" | PR summary |
| Quality budget exceeded | v2 skill compressed but dropped >2 points on LLM-judge parity | Y — CI fails | Y (parity-eval suite) | "v2 X.md dropped from 9.2 to 6.4 vs v1.45 baseline" | PR comment with diff |
| Budget cap override audit | EVALS_BUDGET_OVERRIDE_REASON used | N (intentional escape valve) | Y (audit-log test) | reason printed in CI output, logged to spend-audit jsonl | analytics/spend-overrides.jsonl |
| Parity baseline drift on main | weekly continuous monitor detects regression | Y — Discord alert + ticket | Y (continuous-monitor test) | alert in team channel | analytics/parity-drift.jsonl |

仍然 0 critical gaps。

## v2 launch copy specs（来自 /plan-devex-review）

这些 drafts 成为 v2.0.0.0 launch tone 的 source of truth。T15 会照此实现（除非 ship time 的工作坊产生可测地更好版本；如果有，plan 和 implementation 要同步更新）。

### JUST_UPGRADED notice（JUST_UPGRADED 提示，Persona A — existing user upgrading）

由 `gstack-update-check` 显示 `JUST_UPGRADED v1.x v2.0.0.0` 触发。用 persona-A-aware copy 取代泛用的 v1 “Running gstack v{to} (just updated!)”，既点名感知速度收益，又说明“your muscle memory still works.”

```
Running gstack v2.0.0.0 (just updated!) — your sessions are now ~67% lighter.
Heavyweight skills load only the sections they need; the catalog dropped to
one line per skill. Everything still works the same way — your /ship, /qa,
/review commands haven't changed. Run `/gstack-upgrade --explain-v2` for the
full migration story, or just keep working.
```

中文语义（不替代上面的 release copy 原文）：Heavyweight skills 只加载所需 sections；
catalog 降到每个 skill 一行。所有 workflow 仍按原样工作，`/ship`、`/qa`、`/review`
commands 没变；想了解完整迁移故事可运行 `/gstack-upgrade --explain-v2`。

Voice rules honored（voice 规则）：以 win 开头（“67% lighter”）；具体数字；安抚 workflows 未变（“everything still works the same way”）；提供 escape hatch（`--explain-v2`）。No em dashes。目标是 5 秒读完。

Implementation（实现）：更新 `~/.claude/skills/gstack/gstack-upgrade/SKILL.md.tmpl` Inline upgrade flow，加入 v2-aware message；现有 skill preamble 中的 `JUST_UPGRADED <from> <to>` detection 会触发它。

### CHANGELOG numbers table（CHANGELOG 数字表，Persona A's magical moment + Persona B's evaluation evidence）

落在 CHANGELOG.md 的 `## [v2.0.0.0]` entry 中，紧跟 headline。比较 measured v1.44 actuals（Phase A 开始前由 `test/helpers/capture-parity-baseline.ts` 捕获 baseline）vs measured v2.0.0.0。数字必须真实，不是 estimated；T15 期间替换 placeholders。

| Metric（指标） | v1.44.1 (baseline) | v2.0.0.0 (measured) | Δ |
|---|---|---|---|
| Total SKILL.md corpus | 2.1 MB | ~700 KB | **−67%** |
| ship.md (heaviest) | 164 KB | ~15 KB skeleton + 5×~5 KB sections | **−76% first-Read** |
| plan-ceo-review.md | 131 KB | ~12 KB skeleton + sections on demand | **−68% first-Read** |
| office-hours.md | 111 KB | ~10 KB skeleton + sections on demand | **−71% first-Read** |
| Catalog tokens (always-loaded system prompt) | ~25K tokens | ~6K tokens | **−76%** |
| Per-invocation tokens (typical /ship session) | ~41K | ~14K skeleton + on-demand sections | **~60% drop** |
| Eval coverage (skills with E2E protection) | ~16 of 31 | **31 of 31 + parity baselines** | quality gate enabled |
| Parity score vs v1.44 baseline (LLM judge, all 31 skills) | — | **≥9.0/10 floor** | (CI-enforced; see parity-eval suite) |

表格下方用 gstack voice 写一段：“v1 是最重的 opinionated skill pack。v2 是最轻的。压缩不是免费的：每个 skill 都带 gate-tier 和 periodic-tier E2E evals，continuous parity-monitor 会捕捉 silent quality regressions。上面的数字基于 `test/helpers/parity-baseline-v1.44.1/` 测量，并可用 `bun run eval:parity` 复现。”

### README v2 banner（README v2 横幅）

位置：README.md 顶部，紧贴现有 Karpathy pull-quote 下方，位于 “When I heard Karpathy say this...” 之上。发布后保留 60 天，然后折叠成 Quick start section 中的一行 “v2 released May 2026”。

```markdown
> **gstack v2.0.0.0 — 最轻的 opinionated skill pack（May 2026）**
>
> Heavyweight skills 现在只加载自己需要的 sections。总 SKILL.md
> corpus 从 2.1 MB 降到约 700 KB。每个 skill 都带 E2E eval
> protection，并持续对 v1.44 baselines 运行 parity-monitor。
> Per-skill numbers 和 migration story 见 [v2.0.0.0 release notes](CHANGELOG.md)。
> Existing users：`/gstack-upgrade` 会自动 regenerate。
```

Voice rules honored（voice 规则）：以 position 开头（“lightest opinionated skill pack”）；具体数字（2.1 MB → 700 KB）；rigor 证明（eval protection + parity monitor）；migration path 明确。No em dashes。目标是 10 秒读完。

### Implementation notes（实现说明，for T15）

- 在 Phase A regeneration 开始前，把实际 v1.44 baseline numbers 锁进 `test/helpers/parity-baseline-v1.44.1/`。只有 v1.44 与 v2 用同一单位测量（token count via `tiktoken`、byte count via `wc -c`、eval coverage via `test/skill-coverage-matrix.ts`），“v1 vs v2” delta 才可准确引用。
- 如果 measured v2 numbers 没有上面 drafts 中那么亮眼（比如 `ship.md` 最终 25 KB 而不是 15 KB），就更新 drafts 以反映现实。绝不编数字；只要读者能用 `wc -c` 证伪一个数字，marketing-grade ship moment 就死了。
- JUST_UPGRADED notice 通过现有 `gstack-upgrade` detection 自动触发，不需要新机制。
- README banner 放在现有 Karpathy quote 上方是有意的：persona B（new evaluator）先看到 v2 win，再看到 Karpathy framing，锚定“this is May 2026's most-current gstack.”

## GSTACK REVIEW REPORT（评审报告）

| 评审 | Trigger | 原因 | 次数 | 状态 | 发现 |
|---|---|---|---|---|---|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | SCOPE_EXPANSION mode；3 个 expansion proposals（1 accepted: v2 launch positioning；2 deferred: gstack lite, gstack budget）；11/11 sections reviewed；0 critical gaps |
| Codex Review | `/codex review` | Independent 2nd opinion（outside voice） | 1 | issues_found | 12 challenges surfaced；7 absorbed into plan（#4, #5, #6, #9, #10, #11, #12）；3 surfaced as user-decision（#1 user kept original pick, #7 hybrid split adopted, #8 user accepted codex） |
| Eng Review | `/plan-eng-review` | Architecture & tests（required） | 1 | CLEAR | 3 个 architecture decisions locked（D1 JSON manifest, D2 sections/*.md.tmpl pipeline, D3 CI cost cap）；4 个 new failure modes added（all rescued+tested）；test plan artifact 已写入；parallelization map 已产出（3 lanes parallel in v1.45, sequential in v2.0）；0 critical gaps；0 unresolved decisions |
| Codex Consult（第 2 轮） | `/codex`（consult on eng-review additions） | 对 D1/D2/D3 + parallelization 做 independent challenge | 1 | issues_found | 对 eng-review additions 发现 7 个 additional findings；5 个 absorbed（TemplateContext contract、3-tier orphan classification、budget cap override path、manifest as passive data not predicates、T7 as integration-flow obviated by sequential）；2 个 surfaced as user-decision（attention-architecture risk → cathedral parity-eval suite added at "11"；parallelization 按 codex critique collapse 到 sequential v1.45） |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | not required（no significant UI scope；README/CHANGELOG only） |
| DX Review | `/plan-devex-review` | Developer experience gaps | 1 | CLEAR | DX POLISH mode；product type = Claude Code Skill；2 personas tracked equally（existing-user upgrader + new-user evaluator）；launch-copy specs 加入 plan 后 initial 7.9/10 → 9.0/10（JUST_UPGRADED notice、CHANGELOG numbers table、README v2 banner 均作为 T15 deliverables drafted）；all 8 passes evaluated；skill DX checklist passes |

**CODEX:** First pass（CEO）：12 findings，7 absorbed，3 cross-model user-decided，2 baked into tasks。Second pass（post eng-review）：7 findings on the new D1/D2/D3 additions，5 absorbed，2 user-decided。两轮都作为 audit trail 保留。合计 19 个 codex findings → 12 absorbed without friction，5 user-decided across both passes，2 quality-of-life refinements baked into tasks。DX review 没有再跑 fresh codex pass（之前 3 轮已经覆盖 structural blind spots；剩余 DX work 是 copy-craft，codex 的增益小于 user taste）。

**CROSS-MODEL:** 强共识在：(a) phasing（catalog trim early, sections/ later），(b) measurement-first（hard token budgets + override audit trail），(c) forks/rollout-strategy gaps。已解决 tensions：eval-first scope（user kept）、v2 vs v1.x（HYBRID adopted）、migration heaviness（lighter touch adopted）、parallelization（user accepted codex's sequential critique）、attention-architecture risk（user expanded scope to cathedral parity-eval suite covering ALL 31 skills with quality budget alongside token budget）、launch copy artifacts（user drafted all three in plan vs deferring to T15 implementation）。

**UNRESOLVED:** 0 decisions outstanding across all 5 reviews。

**VERDICT:** CEO + ENG + CODEX×2 + DX CLEARED — ready to implement。Hybrid v1.45/v2.0 split 降低 bloat-reputation fix 风险；`sections/*.md.tmpl` pipeline（D2）防止 drift；CI cost cap with override audit（D3 + codex absorbed refinement）防止 eval spend 失控；cathedral parity-eval suite（codex 2nd pass）捕捉 section-loading + budget tests 无法发现的 silent attention-architecture regressions；sequential v1.45 execution（codex absorbed）用 wall-clock 换 integration safety；v2 launch copy specs（DX review）让 marketing-grade ship moment 同时命中 persona A（existing upgrader）和 persona B（new evaluator）。Plan 现在可执行。
