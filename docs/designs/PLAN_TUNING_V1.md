# Plan Tuning v1 — Design Doc（设计文档）

**Status（状态）：** 已批准 implementation（2026-04-18）
**Branch（分支）：** garrytan/plan-tune-skill
**Authors（作者）：** Garry Tan（user），评审由 Claude Opus 4.7 + OpenAI Codex gpt-5.4 协助
**Supersedes scope（取代范围）：** 在 [PLAN_TUNING_V0.md](./PLAN_TUNING_V0.md)（observational substrate）之上增加 writing-style + LOC-receipts layer。V0 保持不变。
**相关：** [PACING_UPDATES_V0.md](./PACING_UPDATES_V0.md) — 抽取出的 pacing overhaul，V1.1 plan。

## 本文档是什么

这是 /plan-tune v1 的 canonical record：它是什么、不是什么、我们考虑过什么，以及为什么做出每个决定。提交到 repo 中，是为了让未来 contributors（以及未来的 Garry）不需要考古就能追踪推理。它取代任何 per-user local plan artifacts。

## 致谢

这个 plan 之所以存在，是因为 **[Louise de Sadeleer](https://x.com/LouiseDSadeleer/status/2045139351227478199)**。她作为非技术用户完整坐完了一次 gstack run，并告诉了我们真实感受。她的具体反馈：

1. “过了一会儿我有点累，而且感觉有点僵硬。” — *pacing/fatigue*
2. “我就一直说 yes yes yes 了”（architecture review 期间）。— *disengagement*
3. “有趣的是他一直强调自己产出了多少行 code。当然，那是 AI 为他产出的。” — *LOC framing*
4. “作为非工程师，这有点复杂，不太好理解。” — *jargon density + outcome framing*

V1 直接处理 #3 和 #4：jargon-glossing + outcome-framed writing，让输出读起来像真实的人为读者写的；再加上 defensible LOC reframe。Louise 的 #1 和 #2（pacing/fatigue）需要单独一轮设计，已经抽取到 [PACING_UPDATES_V0.md](./PACING_UPDATES_V0.md) 作为 V1.1 plan。

## 一段话说明这个 feature

gstack skill output 就是产品。如果 prose 对非技术 founder 来说读起来不顺，他们会退出 review 状态，只剩下点击“yes yes yes”。V1 为每个 tier ≥ 2 skill 增加 writing-style standard：首次使用时解释 jargon（来自 curated ~50-term list）、用 outcome terms 提问（“如果……，你的用户会遇到什么问题？”）而不是 implementation terms、短句、具体名词。想要更紧的 V0 prose 的 power users 可以设置 `gstack-config set explain_level terse`。这是 binary switch，没有 partial modes。另外：README 中“600,000+ lines of production code”的表述被 Louise 正确指出是 LOC vanity，所以会替换为由 `scc` 支持的脚本计算出的 2013-vs-2026 pro-rata multiple，并诚实说明 public-vs-private repo visibility 的 caveats。

## 为什么我们构建更小版本

V1 在多轮 review passes 中经历了四次实质 scope revisions。最终 scope 比任何中间版本都小，因为每一轮 review 都抓到了真实问题。

**Revision 1 — Four-level experience axis（rejected）。** 原始提议：首次运行时询问用户是 experienced dev、engineer-without-solo-experience、non-technical-who-shipped-on-a-team，还是 non-technical-entirely。Skills 按 level 适配。CEO review 的 premise-challenge step 中拒绝，因为 (a) onboarding ask 在 V1 正想降低 friction 的时刻增加 friction，(b) “what level am I?” 本身会让最需要帮助的用户困惑，(c) technical expertise 不是一维的（designer 在 CSS 上可能是 A level，在 deploy 上可能是 D level），(d) engineers 也受益于与非技术用户相同的 writing standards。

**Revision 2 — ELI10 by default, terse opt-out（accepted）。** 每个 skill 的输出默认采用 writing standard。想要 V0 prose 的 power users 设置 `explain_level: terse`。Codex Pass 1 抓到 critical gaps（static-markdown gating、host-aware paths、README update mechanism），三项都已整合。

**Revision 3 — ELI10 + review-pacing overhaul（proposed, scoped back）。** 增加 pacing workstream：rank findings、auto-accept two-way doors、每个 phase 最多 3 个 AskUserQuestion prompts、Silent Decisions block 与 flip-command。目标是直接处理 Louise 的 #1 和 #2。Eng review Pass 2 抓到 scoring-formula 和 path-consistency bugs。Eng review Pass 3 + Codex Pass 2 又暴露出 pacing workstream 中 10+ structural gaps，无法通过修改 plan text 解决。

**Revision 4 — ELI10 + LOC only（final）。** 用户选择 scope reduction：V1 只交付 writing style + LOC receipts，把 pacing 通过 [PACING_UPDATES_V0.md](./PACING_UPDATES_V0.md) 延后到 V1.1。这就是 approved V1 scope。

贯穿线索：每一轮 review 都正确收窄了野心，直到剩余 scope 没有 structural gaps。这与 CEO review skill 的 SCOPE REDUCTION mode 一致，只是通过 engineering review 较晚到达，而不是在战略选择阶段提前到达。

## v1 Scope（现在要构建什么）

1. **Writing Style section in preamble**（`scripts/resolvers/preamble.ts`）。六条规则：每次 skill invocation 首次使用时解释 jargon、outcome framing、短句 / 具体名词 / active voice、decisions 以 user impact 收尾、gloss-on-first-use-unconditional（即使用户粘贴了该 term）、user-turn override（用户说“be terse”则该回复跳过）。
2. **通过 repo-owned list 定义 jargon boundary**（`scripts/jargon-list.json`）。约 50 个 curated high-frequency technical terms。不在列表中的 terms 视为足够 plain-English。Terms 在 `gen-skill-docs` 时 inline 进生成的 SKILL.md prose（零 runtime cost）。
3. **Terse opt-out**（`gstack-config set explain_level terse`）。Binary：`default` vs `terse`。Terse 完全跳过 Writing Style block，使用 V0 prose style。
4. **Host-aware preamble echo。** `_EXPLAIN_LEVEL=$(${binDir}/gstack-config get explain_level 2>/dev/null || echo "default")`。通过现有 V0 `ctx.paths.binDir` pattern 做 host-portable。
5. **gstack-config validation。** 在 header 中记录 `explain_level: default|terse`。Whitelist values。遇到 unknown 时用具体 message 警告，并 default 到 `default`。
6. **README LOC reframe。** 移除“600,000+ lines of production code”的 hero framing。插入 `<!-- GSTACK-THROUGHPUT-PLACEHOLDER -->` anchor。Build-time script 用 computed multiple + caveat 替换 anchor。
7. **`scc`-backed throughput script**（`scripts/garry-output-comparison.ts`）。针对 2013 + 2026，枚举 Garry-authored public commits，从 `git diff` 抽取 added lines，用 `scc --stdin` 分类（或 regex fallback）。输出 `docs/throughput-2013-vs-2026.json`，包含 per-language breakdown + caveats。
8. **`scc` standalone install script**（`scripts/setup-scc.sh`）。不是 `package.json` dependency（真正 optional，95% 用户永远不会运行 throughput）。按 OS 检测并运行 `brew install scc` / `apt install scc` / 打印 GitHub releases link。
9. **README update pipeline**（`scripts/update-readme-throughput.ts`）。如果存在 `docs/throughput-2013-vs-2026.json` 就读取它并替换 anchor；如果缺失，写入 `GSTACK-THROUGHPUT-PENDING` marker，CI 会拒绝，强制 contributor 在 commit 前运行脚本。
10. **/retro 把 logical SLOC + weighted commits 放在 raw LOC 之上。** Raw LOC 保留作为 context，但视觉上降级。
11. **Upgrade migration**（`gstack-upgrade/migrations/v<VERSION>.sh`）。一次性 post-upgrade interactive prompt，为偏好 V0 prose 的用户提供通过 `explain_level: terse` 恢复 V0 的选项。由 flag-file gate。
12. **Documentation。** CLAUDE.md 增加 Writing Style section（project convention）。CHANGELOG.md 增加 V1 entry（user-facing narrative，提到 scope reduction + V1.1 pacing）。README.md 增加 Writing Style explainer section（约 80 words）。CONTRIBUTING.md 增加 jargon-list maintenance note（PRs to add/remove terms）。
13. **Tests。** 6 个新 test files + 扩展现有 `gen-skill-docs.test.ts`。除 LLM-judge E2E（periodic）外全部 gate tier。
14. **V0 dormancy negative tests。** 断言 5D dimension names 和 8 archetype names 不出现在 default-mode skill output 中。防止 V0 psychographic machinery 泄漏进 V1。
15. **V1 and V1.1 design docs。** PLAN_TUNING_V1.md（本文档）。PACING_UPDATES_V0.md（V1.1 plan，从 extracted appendix 创建）。TODOS.md P0 entry。

## Deferred（延后项）

**To V1.1（明确延后，并有专门 design doc）：**
- Review pacing overhaul（ranking、auto-accept、max-3-per-phase、Silent Decisions block、flip mechanism）。理由见 [PACING_UPDATES_V0.md](./PACING_UPDATES_V0.md) §"Why it's extracted."：有 10+ structural gaps 无法通过 prose-only changes 修复。
- Preamble first-run meta-prompt audit（lake intro、telemetry、proactive、routing）。Louise 在第一次 run 中看到了所有这些 prompt；它们都会增加 fatigue。V1.1 会考虑 suppress 到 session N 之后。

**To V2（或更晚）：**
- 由 question-log 的 confusion-signal detection 驱动 on-the-fly translation offers。
- 5D psychographic-driven skill adaptation（V0 E1 item）。
- /plan-tune narrative + /plan-tune vibe（V0 E3 item）。
- Per-skill 或 per-topic 的 explain levels。
- Team profiles。
- AST-based "delivered features" metric。

## 完全拒绝（考虑过，但不做）

- **Four-level declared experience axis (A/B/C/D)。** 在 CEO review premise-challenge 中拒绝。见上文“为什么我们构建更小版本”。
- **ELI10 as a new resolver file（`scripts/resolvers/eli10-writing.ts`）。** Codex Pass 1 抓到它与 preamble 的 AskUserQuestion Format section 中现有“smart 16-year-old” framing 冲突。改为 fold into existing preamble。
- **Runtime suppression of the Writing Style block。** Codex Pass 1 抓到 `gen-skill-docs` 生成 static Markdown，runtime `EXPLAIN_LEVEL=terse` 无法隐藏已经 baked in 的内容。解决方案：conditional prose gate（prose convention，与 V0 的 `QUESTION_TUNING` gate 同类）。
- **Middle writing mode between default and terse。** Revision 3 提出“terse = no glosses but keep outcome framing”。Codex Pass 2 抓到它与 migration messaging 矛盾。Binary wins：terse = V0 prose，full stop。
- **User-editable jargon list at runtime。** Revision 3 提出 `~/.gstack/jargon-list.json` 作为 user override。Codex Pass 2 抓到这与 gen-time inlining 矛盾。解决：repo-owned only，通过 PRs add/remove，regenerate 后生效。
- **`devDependencies.optional` field in package.json。** 这不是实际的 npm/bun field。Eng review Pass 2 抓到。改用 standalone install script。
- **在 README 中用同一个 string 同时作为 replacement anchor 和 CI-reject marker。** Eng review Pass 2 / Codex Pass 2 抓到这会让 pipeline destroy its own update path。Two-string solution：`GSTACK-THROUGHPUT-PLACEHOLDER`（anchor，跨 runs 保留）vs `GSTACK-THROUGHPUT-PENDING`（明确的“build didn't run” marker，CI 拒绝）。
- **把“Every technical term gets a gloss”作为 acceptance criterion。** Codex Pass 2 抓到这与 curated-list rule 矛盾。Acceptance 改写为匹配规则：“every term on `scripts/jargon-list.json` that appears gets a gloss.”
- **Acceptance criterion “≤ 12 AskUserQuestion prompts per /autoplan”。** 从 V1 移除，因为该目标需要 pacing overhaul，现在放在 V1.1。

## 架构

```
~/.gstack/
  developer-profile.json           # unchanged from V0
  config.yaml                       # + explain_level key (default | terse)

scripts/
  jargon-list.json                  # NEW: ~50 repo-owned terms (gen-time inlined)
  garry-output-comparison.ts        # NEW: scc + git per-year, author-scoped
  update-readme-throughput.ts       # NEW: README anchor replacement
  setup-scc.sh                      # NEW: OS-detecting scc installer
  resolvers/preamble.ts             # MODIFIED: Writing Style section + EXPLAIN_LEVEL echo

docs/
  designs/PLAN_TUNING_V1.md         # NEW: this file
  designs/PACING_UPDATES_V0.md      # NEW: V1.1 plan (extracted)
  throughput-2013-vs-2026.json      # NEW: computed, committed

~/.claude/skills/gstack/bin/
  gstack-config                     # MODIFIED: explain_level header + validation

gstack-upgrade/migrations/
  v<VERSION>.sh                     # NEW: V0 → V1 interactive prompt
```

### Data flow（数据流）

```
User runs tier-≥2 skill
       │
       ▼
Preamble bash (per-invocation):
  _EXPLAIN_LEVEL=$(${binDir}/gstack-config get explain_level 2>/dev/null || "default")
  echo "EXPLAIN_LEVEL: $_EXPLAIN_LEVEL"
       │
       ▼
Generated SKILL.md body (static Markdown, baked at gen-skill-docs):
  - AskUserQuestion Format section (existing V0)
  - Writing Style section (NEW, conditional prose gate)
       │
       ├── "Skip if EXPLAIN_LEVEL: terse OR user says 'be terse' this turn"
       ├── 6 writing rules (jargon, outcome, short, impact, first-use, override)
       └── Jargon list inlined from scripts/jargon-list.json
       │
       ▼
Agent applies or skips based on runtime EXPLAIN_LEVEL + user-turn signal
       │
       ▼
V0 QUESTION_TUNING + question-log + preferences unchanged
       │
       ▼
Output to user (gloss-on-first-use, outcome-framed, short sentences; or V0 prose if terse)
```

### Data flow：throughput script（build-time）

```
bun run build
   │
   ├── gen:skill-docs (regenerates SKILL.md files with jargon list inlined)
   ├── update-readme-throughput (reads JSON if present; replaces anchor OR writes PENDING marker)
   └── other steps (binary compilation, etc.)

Separately, on-demand:
bun run scripts/garry-output-comparison.ts
   │
   ├── scc preflight (if missing → exit with setup-scc.sh hint)
   ├── 针对 2013 + 2026：枚举 public garrytan/* repos 中 Garry-authored commits
   ├── 针对每个 commit：git diff，extract ADDED lines，通过 scc --stdin classify
   └── 写入 docs/throughput-2013-vs-2026.json（per-language + caveats）
```

## Security + privacy（安全与隐私）

- **No new user data。** V1 扩展 preamble prose + config key。不收集新的 personal data。
- **No runtime file reads of sensitive data。** Jargon list 是 repo-committed curated list。
- **Migration script is one-shot。** Flag-file 防止重复触发。
- **scc runs on public repos only。** 不访问 private work。

## Decisions log（包含优缺点）

### Decision A：Four-level experience axis vs. ELI10 by default — ANSWER: ELI10 BY DEFAULT

**Four-level axis（rejected）：** 首次运行时让用户自我识别为 A/B/C/D。Skills 按 level 适配。
- 优点：明确的 user sovereignty。Power users 获得 V0 behavior。
- 缺点：增加 onboarding question。迫使用户给自己贴标签。Technical expertise 不是一维的。Engineers 也受益于同样的 writing standards。

**ELI10 by default with terse opt-out（已选择）：** 每个 skill 的输出默认采用 writing standard。Power users 设置 `explain_level: terse`。
- 优点：没有 onboarding question。好写作对所有人都有好处。Power users 仍有 escape hatch。
- 缺点：升级时静默改变 V0 behavior，因此需要 migration prompt。

### Decision B：New resolver file vs. extend existing preamble — ANSWER: EXTEND EXISTING

**New resolver（rejected）：** `scripts/resolvers/eli10-writing.ts` 作为独立 generator。
- 优点：Modular。
- 缺点（Codex #7）：与 preamble 的 AskUserQuestion Format section 中现有“smart 16-year-old” framing 冲突。两个 sources of truth。

**Extend preamble（已选择）：** Writing Style section 直接添加到 `scripts/resolvers/preamble.ts` 的 AskUserQuestion Format 下方。
- 优点：一个 source of truth。与现有规则组合。
- 缺点：`preamble.ts` 变大。

### Decision C：Runtime suppression vs. conditional prose gate — ANSWER: CONDITIONAL PROSE GATE

**Runtime suppression（rejected）：** Preamble 读取 `explain_level` 后触发 suppression logic。
- 优点：心智模型更简单。
- 缺点（Codex #1）：`gen-skill-docs` 生成 static Markdown。一旦 baked，内容无法 retroactively hidden。Runtime suppression 是虚构机制。

**Conditional prose gate（已选择）：** “Skip this block if EXPLAIN_LEVEL: terse OR user says 'be terse' this turn.” Prose convention；agent 在 runtime 遵守或不遵守。
- 优点：可测试。匹配 V0 的 `QUESTION_TUNING` pattern。诚实描述机制。
- 缺点：依赖 agent prose compliance（没有硬 runtime gate）。

### Decision D：Jargon list location — runtime-user-editable vs. repo-owned gen-time — ANSWER: REPO-OWNED GEN-TIME

**User-editable at runtime（rejected）：** `~/.gstack/jargon-list.json` 覆盖 `scripts/jargon-list.json`。
- 优点：用户可以添加自己 domain 的 terms。
- 缺点（Codex #4, Pass 2）：Gen-time inlining 意味着用户编辑需要 regenerate。矛盾。

**Repo-owned, gen-time inlined（已选择）：** 只使用 `scripts/jargon-list.json`。通过 PRs add/remove。`bun run gen:skill-docs` 将 terms inline 到 preamble prose。
- 优点：一个 source of truth。零 runtime cost。可与现有 build 组合。
- 缺点：用户不能本地添加 terms。Mitigation：记录在 CONTRIBUTING.md；接受 PRs。

### Decision E：Pacing overhaul in V1 vs. V1.1 — ANSWER: V1.1（已抽出）

**Pacing in V1（rejected）：** 把 ranking + auto-accept + Silent Decisions + max-3-per-phase cap + flip mechanism 打包进来。
- 优点：直接处理 Louise 的 fatigue。
- 缺点（Eng review Pass 3 + Codex Pass 2）：10+ structural gaps 无法通过 plan-text editing 修复。Session-state model 未定义。question-log 缺少 `phase` field。Registry 不覆盖 dynamic review findings。Flip mechanism 没有 implementation。Migration prompt 本身也是 interrupt。First-run preamble prompts 也要计入。Pacing as prose 无法倒转现有 ask-per-section execution order。

**Extract to V1.1（已选择）：** V1 交付 ELI10 + LOC。Pacing 进入自己的 design round 和完整 review cycle。
- 优点：诚实交付 V1。V1.1 可以从 V1 usage（Louise 的 V1 transcript）获得真实 baseline data。匹配 CEO review 的 SCOPE REDUCTION mode。
- 缺点：Louise 的 fatigue complaint 要到 V1.1 才能完全处理。Mitigation：V1 仍通过 writing quality 改善她的体验；V1.1 紧随其后。

### Decision F：README update mechanism — single string vs. two-string — ANSWER: TWO-STRING

**Single string（rejected）：** `<!-- GSTACK-THROUGHPUT-MULTIPLE: N× -->` 同时作为 replacement anchor 和 CI-reject marker。
- 优点：简单。
- 缺点（Codex Pass 2）：Pipeline 自我破坏，CI 会拒绝包含 marker 的 commits，但 marker 本身就是 anchor。

**Two-string（已选择）：** `GSTACK-THROUGHPUT-PLACEHOLDER`（anchor，稳定）+ `GSTACK-THROUGHPUT-PENDING`（明确的 missing-build marker，CI 拒绝）。
- 优点：Anchor 保留；CI 捕捉真实 failure state。
- 缺点：需要记住两个 symbols。

## Review record（评审记录）

| Review（评审） | Runs（次数） | Status（状态） | Key findings integrated（已整合的关键发现） |
|---|---|---|---|
| CEO Review | 1 | CLEAR (HOLD SCOPE) | Premise pivot: four-level axis → ELI10 by default. Cross-model tensions resolved via explicit user choice. |
| Codex Review | 2 | ISSUES_FOUND + drove scope reduction | Pass 1: 25 findings, 3 critical blockers (static-markdown, host-paths, README mechanism). Pass 2: 20 findings on revised plan, drove V1.1 extraction. |
| Eng Review | 3 | CLEAR (SCOPE_REDUCED) | Pass 1: critical gaps + 3 decisions (all A). Pass 2: scoring-formula bug, path contradiction, fake `devDependencies.optional` field. Pass 3: identified pacing structural gaps, drove extraction. |
| DX Review | 1 | CLEAR (TRIAGE) | 3 critical (docs plan, upgrade migration, hero moment). 9 auto-accepted as Silent DX Decisions. |

Review report 通过 `gstack-review-log` 持久化到 `~/.gstack/`。Plan file 以完整历史保留在 `~/.claude/plans/system-instruction-you-are-working-transient-sunbeam.md`。
