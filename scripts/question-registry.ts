/**
 * Question Registry — gstack 内 AskUserQuestion invocations 的 typed schema。
 *
 * Purpose
 * -------
 * 每次 AskUserQuestion invocation 都会带上 stable question_id，并映射到此
 * registry 中的一条 entry。此 registry 是 /plan-tune 的基础：
 * - Logging (question-log.jsonl) 用 registered id 标记 events
 * - Per-question preferences (question-preferences.json) 以 registered id 为 key
 * - One-way door safety 在这里声明，而不是从 prose summaries 推断
 * - psychographic signal map (scripts/psychographic-signals.ts) 映射 id → dimension delta
 *
 * 不是 gstack 中的每个 AskUserQuestion 都需要立刻有 registry entry。Skills 经常在
 * runtime 动态构造 questions；agent 会为它们生成 `{skill}-{slug}` 形式的 ad-hoc id。
 * /plan-tune skill 会把高频触发的 ad-hoc ids 暴露出来，作为 registry promotion 候选。
 *
 * v1 coverage target：覆盖以下 skills 中最常见的约 30-50 类 recurring question：
 * ship, review, office-hours, plan-ceo-review, plan-eng-review, plan-design-review,
 * plan-devex-review, qa, investigate, and land-and-deploy. One-way doors 100%.
 *
 * Adding a new entry
 * ------------------
 * 1. 选择 `{skill}-{what-it-asks-about}` 形式的 kebab-case id。
 * 2. 分类 `door_type`：
 *    - `one-way` 用于 destructive ops、architecture/data-model forks、
 *      scope-adds > 1 day CC effort、security/compliance choices。
 *      无论 user preference 如何都 ALWAYS asked。
 *    - `two-way` 用于其他所有问题（可由 explicit preference 自动决定）。
 * 3. 选择描述 question shape 的 `category`。
 * 4. 如果此 question 的答案应推动某个 specific psychographic dimension，
 *    添加 optional `signal_key`。scripts/psychographic-signals.ts 中的
 *    signal map 使用 (id, user_choice) 查找 dimension delta。
 * 5. `options` 是 stable option keys 的短列表。UI labels 可变化；keys 必须保持不变，
 *    这样 preferences 才能跨 wording changes 保留。
 * 6. 运行 `bun test test/plan-tune.test.ts` 验证 format + uniqueness。
 */

export type QuestionCategory =
  | 'approval'         // proceed/stop gate（例如 "approve this plan?"）
  | 'clarification'    // 需要更多信息才能继续
  | 'routing'          // 选择哪条路径（modes、strategies）
  | 'cherry-pick'      // opt-in scope decision（add/defer/skip）
  | 'feedback-loop';   // inline tune：prompt、iteration feedback

export type DoorType = 'one-way' | 'two-way';

/**
 * 最常见 user choice patterns 的 stable keys。UI labels 可变化
 * （例如 "Add to plan" vs "Include in scope"）；存储的 choice 是 key。
 * Skills 可为无法归类的问题发出 custom keys；这些仍会记录日志，
 * 但不会获得 psychographic signal attribution。
 */
export type StandardOption =
  | 'accept'
  | 'reject'
  | 'defer'
  | 'skip'
  | 'investigate'
  | 'approve'
  | 'deny'
  | 'expand'
  | 'hold'
  | 'reduce'
  | 'selective'
  | 'fix-now'
  | 'fix-later'
  | 'ack-and-ship'
  | 'false-positive'
  | 'continue'
  | 'rerun'
  | 'stop';

export interface QuestionDef {
  /** Stable kebab-case id：`{skill}-{semantic-description}` */
  id: string;
  /** 拥有此 question 的 skill（必须匹配 gstack skill directory name） */
  skill: string;
  /** Question 的形态 */
  category: QuestionCategory;
  /** Safety classification。one-way 无论 preference 如何都 ALWAYS asked */
  door_type: DoorType;
  /** Stable option keys（skills 可发出此列表之外的 keys；会记录但不打标签） */
  options?: StandardOption[] | string[];
  /** 用于 dimension attribution 的 scripts/psychographic-signals.ts optional key */
  signal_key?: string;
  /** 给 docs 和 /plan-tune profile output 使用的一行描述 */
  description: string;
}

/**
 * QUESTIONS — recurring question categories 的 initial v1 coverage。
 * 按 skill 分组以提升可读性。手动维护。
 *
 * 添加新 skills 或 question types 时扩展此 object。CI lint
 * test/plan-tune.test.ts 会验证 format、uniqueness 和 required fields。
 */
export const QUESTIONS = {
  // -----------------------------------------------------------------------
  // /ship — pre-landing review, deploy, PR creation
  // -----------------------------------------------------------------------
  'ship-release-pipeline-missing': {
    id: 'ship-release-pipeline-missing',
    skill: 'ship',
    category: 'approval',
    door_type: 'two-way',
    options: ['accept', 'defer', 'skip'],
    signal_key: 'distribution-care',
    description: "新增 artifact 但没有 CI/CD release pipeline — 现在添加、defer 到 TODOs，还是跳过？",
  },
  'ship-test-failure-triage': {
    id: 'ship-test-failure-triage',
    skill: 'ship',
    category: 'approval',
    door_type: 'one-way',
    options: ['fix-now', 'investigate', 'ack-and-ship'],
    signal_key: 'test-discipline',
    description: "检测到 failing tests — shipping 前修复，还是先调查 root cause？",
  },
  'ship-pre-landing-review-fix': {
    id: 'ship-pre-landing-review-fix',
    skill: 'ship',
    category: 'approval',
    door_type: 'two-way',
    options: ['fix-now', 'skip'],
    signal_key: 'code-quality-care',
    description: "Pre-landing review 标记了 issue — 现在修复，还是按现状 ship？",
  },
  'ship-greptile-comment-valid': {
    id: 'ship-greptile-comment-valid',
    skill: 'ship',
    category: 'approval',
    door_type: 'two-way',
    options: ['fix-now', 'ack-and-ship', 'false-positive'],
    signal_key: 'code-quality-care',
    description: "Greptile 标记了 valid issue — 修复、ack and ship，还是标为 false positive？",
  },
  'ship-greptile-comment-false-positive': {
    id: 'ship-greptile-comment-false-positive',
    skill: 'ship',
    category: 'approval',
    door_type: 'two-way',
    options: ['reply', 'fix-anyway', 'ignore'],
    description: "Greptile comment 看起来像 false positive — reply 解释、仍然修复，还是静默忽略？",
  },
  'ship-todos-create': {
    id: 'ship-todos-create',
    skill: 'ship',
    category: 'approval',
    door_type: 'two-way',
    options: ['accept', 'skip'],
    description: "未找到 TODOS.md — 现在创建 skeleton file？",
  },
  'ship-todos-reorganize': {
    id: 'ship-todos-reorganize',
    skill: 'ship',
    category: 'approval',
    door_type: 'two-way',
    options: ['accept', 'skip'],
    signal_key: 'detail-preference',
    description: "TODOS.md 不符合 recommended structure — 现在重组？",
  },
  'ship-changelog-voice-polish': {
    id: 'ship-changelog-voice-polish',
    skill: 'ship',
    category: 'approval',
    door_type: 'two-way',
    options: ['accept', 'skip'],
    signal_key: 'detail-preference',
    description: "CHANGELOG entry 的 voice 可以 polish — 应用编辑？",
  },
  'ship-version-bump-tier': {
    id: 'ship-version-bump-tier',
    skill: 'ship',
    category: 'routing',
    door_type: 'two-way',
    options: ['major', 'minor', 'patch'],
    description: "Version bump：major、minor 还是 patch？",
  },

  // -----------------------------------------------------------------------
  // /review — pre-landing code review
  // -----------------------------------------------------------------------
  'review-finding-fix': {
    id: 'review-finding-fix',
    skill: 'review',
    category: 'approval',
    door_type: 'two-way',
    options: ['fix-now', 'ack-and-ship', 'false-positive'],
    signal_key: 'code-quality-care',
    description: "Review finding — 现在修复、ack and ship，还是 false positive？",
  },
  'review-sql-safety': {
    id: 'review-sql-safety',
    skill: 'review',
    category: 'approval',
    door_type: 'one-way',
    options: ['fix-now', 'investigate'],
    description: "潜在 SQL injection / unsafe query — 修复还是进一步调查？",
  },
  'review-llm-trust-boundary': {
    id: 'review-llm-trust-boundary',
    skill: 'review',
    category: 'approval',
    door_type: 'one-way',
    options: ['fix-now', 'investigate'],
    description: "LLM trust boundary violation — merge 前修复？",
  },

  // -----------------------------------------------------------------------
  // /office-hours — YC diagnostic + builder brainstorm
  // -----------------------------------------------------------------------
  'office-hours-mode-goal': {
    id: 'office-hours-mode-goal',
    skill: 'office-hours',
    category: 'routing',
    door_type: 'two-way',
    options: ['startup', 'intrapreneur', 'hackathon', 'oss-research', 'learning', 'fun'],
    signal_key: 'session-mode',
    description: "这次 session 的目标是什么？（设置 mode：startup vs builder）",
  },
  'office-hours-premise-confirm': {
    id: 'office-hours-premise-confirm',
    skill: 'office-hours',
    category: 'approval',
    door_type: 'two-way',
    options: ['accept', 'reject'],
    description: "Premise check — 同意还是不同意？",
  },
  'office-hours-cross-model-run': {
    id: 'office-hours-cross-model-run',
    skill: 'office-hours',
    category: 'approval',
    door_type: 'two-way',
    options: ['accept', 'skip'],
    description: "需要对 brainstorm 做 second-opinion cross-model review 吗？",
  },
  'office-hours-landscape-privacy-gate': {
    id: 'office-hours-landscape-privacy-gate',
    skill: 'office-hours',
    category: 'approval',
    door_type: 'one-way',
    options: ['accept', 'skip'],
    description: "为了 landscape awareness 运行 web search？（会把 generalized terms 发送给 search provider。）",
  },
  'office-hours-approach-choose': {
    id: 'office-hours-approach-choose',
    skill: 'office-hours',
    category: 'routing',
    door_type: 'two-way',
    options: ['minimal', 'ideal', 'creative'],
    signal_key: 'scope-appetite',
    description: "选择哪种 implementation approach？（minimal viable vs ideal architecture vs creative lateral）",
  },
  'office-hours-design-doc-approve': {
    id: 'office-hours-design-doc-approve',
    skill: 'office-hours',
    category: 'approval',
    door_type: 'two-way',
    options: ['accept', 'revise', 'restart'],
    description: "批准 design doc、修改 sections，还是重新开始？",
  },

  // -----------------------------------------------------------------------
  // /plan-ceo-review — scope & strategy
  // -----------------------------------------------------------------------
  'plan-ceo-review-mode': {
    id: 'plan-ceo-review-mode',
    skill: 'plan-ceo-review',
    category: 'routing',
    door_type: 'two-way',
    options: ['expand', 'selective', 'hold', 'reduce'],
    signal_key: 'scope-appetite',
    description: "Review mode：提升 scope、cherry-pick expansions、保持 scope，还是削减到 minimum？",
  },
  'plan-ceo-review-expansion-proposal': {
    id: 'plan-ceo-review-expansion-proposal',
    skill: 'plan-ceo-review',
    category: 'cherry-pick',
    door_type: 'two-way',
    options: ['accept', 'defer', 'skip'],
    signal_key: 'scope-appetite',
    description: "Scope expansion proposal — 加入 plan、defer 到 TODOs，还是跳过？",
  },
  'plan-ceo-review-premise-revise': {
    id: 'plan-ceo-review-premise-revise',
    skill: 'plan-ceo-review',
    category: 'approval',
    door_type: 'one-way',
    options: ['revise', 'hold'],
    description: "Cross-model challenge 了已同意的 premise — revise 还是 keep？",
  },
  'plan-ceo-review-outside-voice': {
    id: 'plan-ceo-review-outside-voice',
    skill: 'plan-ceo-review',
    category: 'approval',
    door_type: 'two-way',
    options: ['accept', 'skip'],
    description: "为 plan 获取 outside-voice second opinion？",
  },
  'plan-ceo-review-promote-to-docs': {
    id: 'plan-ceo-review-promote-to-docs',
    skill: 'plan-ceo-review',
    category: 'approval',
    door_type: 'two-way',
    options: ['accept', 'keep-local', 'skip'],
    description: "把 CEO plan promote 到 repo 中的 docs/designs/？",
  },

  // -----------------------------------------------------------------------
  // /plan-eng-review — architecture & tests (required gate)
  // -----------------------------------------------------------------------
  'plan-eng-review-arch-finding': {
    id: 'plan-eng-review-arch-finding',
    skill: 'plan-eng-review',
    category: 'approval',
    door_type: 'one-way',
    options: ['fix-now', 'defer', 'accept-risk'],
    signal_key: 'architecture-care',
    description: "Architecture finding — 修复、defer，还是接受 risk？",
  },
  'plan-eng-review-scope-reduce': {
    id: 'plan-eng-review-scope-reduce',
    skill: 'plan-eng-review',
    category: 'routing',
    door_type: 'two-way',
    options: ['reduce', 'hold'],
    signal_key: 'scope-appetite',
    description: "Plan 触及 8+ files — reduce scope 还是 hold？",
  },
  'plan-eng-review-test-gap': {
    id: 'plan-eng-review-test-gap',
    skill: 'plan-eng-review',
    category: 'approval',
    door_type: 'two-way',
    options: ['add-test', 'defer', 'skip'],
    signal_key: 'test-discipline',
    description: "识别到 test gap — 现在添加、defer，还是跳过？",
  },
  'plan-eng-review-outside-voice': {
    id: 'plan-eng-review-outside-voice',
    skill: 'plan-eng-review',
    category: 'approval',
    door_type: 'two-way',
    options: ['accept', 'skip'],
    description: "为 plan 获取 outside-voice second opinion？",
  },
  'plan-eng-review-todo-add': {
    id: 'plan-eng-review-todo-add',
    skill: 'plan-eng-review',
    category: 'cherry-pick',
    door_type: 'two-way',
    options: ['accept', 'skip', 'build-now'],
    description: "Proposed TODO item — 加入 TODOs、跳过，还是在此 PR 中构建？",
  },

  // -----------------------------------------------------------------------
  // /plan-design-review — UI/UX plan audit
  // -----------------------------------------------------------------------
  'plan-design-review-mode': {
    id: 'plan-design-review-mode',
    skill: 'plan-design-review',
    category: 'routing',
    door_type: 'two-way',
    options: ['expand', 'polish', 'triage'],
    signal_key: 'design-care',
    description: "Design review depth：为 competitive edge 扩展、polish every touchpoint，还是 triage critical gaps？",
  },
  'plan-design-review-fix': {
    id: 'plan-design-review-fix',
    skill: 'plan-design-review',
    category: 'approval',
    door_type: 'two-way',
    options: ['fix-now', 'defer', 'skip'],
    signal_key: 'design-care',
    description: "标记了 design issue — 现在修复、defer 到 TODOs，还是跳过？",
  },

  // -----------------------------------------------------------------------
  // /plan-devex-review — developer experience plan audit
  // -----------------------------------------------------------------------
  'plan-devex-review-persona': {
    id: 'plan-devex-review-persona',
    skill: 'plan-devex-review',
    category: 'clarification',
    door_type: 'two-way',
    description: "你的 target developer 是谁？（决定 review persona。）",
  },
  'plan-devex-review-mode': {
    id: 'plan-devex-review-mode',
    skill: 'plan-devex-review',
    category: 'routing',
    door_type: 'two-way',
    options: ['expand', 'polish', 'triage'],
    signal_key: 'devex-care',
    description: "DX review depth：为 competitive advantage 扩展、polish every touchpoint，还是 triage critical gaps？",
  },
  'plan-devex-review-friction-fix': {
    id: 'plan-devex-review-friction-fix',
    skill: 'plan-devex-review',
    category: 'approval',
    door_type: 'two-way',
    options: ['fix-now', 'defer', 'skip'],
    signal_key: 'devex-care',
    description: "Developer journey 中的 friction point — 现在修复、defer，还是跳过？",
  },

  // -----------------------------------------------------------------------
  // /qa — QA testing
  // -----------------------------------------------------------------------
  'qa-bug-fix-scope': {
    id: 'qa-bug-fix-scope',
    skill: 'qa',
    category: 'approval',
    door_type: 'two-way',
    options: ['fix-now', 'defer', 'skip'],
    signal_key: 'code-quality-care',
    description: "QA 中发现 bug — 现在修复、defer，还是跳过？",
  },
  'qa-tier': {
    id: 'qa-tier',
    skill: 'qa',
    category: 'routing',
    door_type: 'two-way',
    options: ['quick', 'standard', 'deep'],
    description: "QA tier：quick（仅 critical/high）、standard（+medium）还是 deep（+low）？",
  },

  // -----------------------------------------------------------------------
  // /investigate — root-cause debugging
  // -----------------------------------------------------------------------
  'investigate-hypothesis-confirm': {
    id: 'investigate-hypothesis-confirm',
    skill: 'investigate',
    category: 'approval',
    door_type: 'two-way',
    options: ['accept', 'reject', 'refine'],
    description: "Root-cause hypothesis — fix 前 accept、reject，还是 refine？",
  },
  'investigate-fix-apply': {
    id: 'investigate-fix-apply',
    skill: 'investigate',
    category: 'approval',
    door_type: 'one-way',
    options: ['accept', 'reject'],
    description: "应用 proposed fix？",
  },

  // -----------------------------------------------------------------------
  // /land-and-deploy — merge + deploy + verify
  // -----------------------------------------------------------------------
  'land-and-deploy-merge-confirm': {
    id: 'land-and-deploy-merge-confirm',
    skill: 'land-and-deploy',
    category: 'approval',
    door_type: 'one-way',
    options: ['accept', 'reject'],
    signal_key: 'decision-autonomy',
    description: "将此 PR merge 到 base branch？",
  },
  'land-and-deploy-rollback': {
    id: 'land-and-deploy-rollback',
    skill: 'land-and-deploy',
    category: 'approval',
    door_type: 'one-way',
    options: ['accept', 'reject'],
    signal_key: 'decision-autonomy',
    description: "Canary 检测到 regressions — roll back deploy？",
  },

  // -----------------------------------------------------------------------
  // /cso — security audit
  // -----------------------------------------------------------------------
  'cso-global-scan-approval': {
    id: 'cso-global-scan-approval',
    skill: 'cso',
    category: 'approval',
    door_type: 'one-way',
    options: ['accept', 'deny'],
    description: "运行 global security scan？（扫描此 branch 之外的 files。）",
  },
  'cso-finding-fix': {
    id: 'cso-finding-fix',
    skill: 'cso',
    category: 'approval',
    door_type: 'one-way',
    options: ['fix-now', 'defer', 'accept-risk'],
    description: "Security finding — 修复、defer 到 TODOs，还是接受 risk？",
  },

  // -----------------------------------------------------------------------
  // /gstack-upgrade — version upgrade
  // -----------------------------------------------------------------------
  'gstack-upgrade-inline': {
    id: 'gstack-upgrade-inline',
    skill: 'gstack-upgrade',
    category: 'approval',
    door_type: 'two-way',
    options: ['yes-upgrade', 'always-auto', 'not-now', 'never-ask'],
    description: "现在 upgrade gstack？（也可选择 always auto-upgrade、snooze 或 disable prompt。）",
  },

  // -----------------------------------------------------------------------
  // Preamble one-time prompts (telemetry, proactive, routing)
  // -----------------------------------------------------------------------
  'preamble-telemetry-consent': {
    id: 'preamble-telemetry-consent',
    skill: 'preamble',
    category: 'approval',
    door_type: 'two-way',
    options: ['community', 'anonymous', 'off'],
    description: "与 gstack share usage data？community（recommended）/ anonymous / off",
  },
  'preamble-proactive-behavior': {
    id: 'preamble-proactive-behavior',
    skill: 'preamble',
    category: 'approval',
    door_type: 'two-way',
    options: ['on', 'off'],
    description: "允许 gstack 基于 conversation context proactive suggest skills？",
  },
  'preamble-routing-injection': {
    id: 'preamble-routing-injection',
    skill: 'preamble',
    category: 'approval',
    door_type: 'two-way',
    options: ['accept', 'decline'],
    description: "将 gstack skill routing rules 添加到 CLAUDE.md？",
  },
  'preamble-vendored-migration': {
    id: 'preamble-vendored-migration',
    skill: 'preamble',
    category: 'approval',
    door_type: 'two-way',
    options: ['accept', 'keep-vendored'],
    description: "此 repo 有 vendored gstack（deprecated）— migrate 到 team mode？",
  },
  'preamble-completeness-intro': {
    id: 'preamble-completeness-intro',
    skill: 'preamble',
    category: 'approval',
    door_type: 'two-way',
    options: ['accept', 'skip'],
    description: "在 browser 中打开 Boil-the-Lake essay？（one-time intro）",
  },
  'preamble-cross-project-learnings': {
    id: 'preamble-cross-project-learnings',
    skill: 'preamble',
    category: 'approval',
    door_type: 'two-way',
    options: ['accept', 'reject'],
    description: "启用 cross-project learnings search？（local only，对 solo devs 有帮助）",
  },

  // -----------------------------------------------------------------------
  // /plan-tune — the skill itself
  // -----------------------------------------------------------------------
  'plan-tune-enable-setup': {
    id: 'plan-tune-enable-setup',
    skill: 'plan-tune',
    category: 'approval',
    door_type: 'two-way',
    options: ['accept', 'skip'],
    description: "Question tuning 当前关闭 — 启用并设置 profile？",
  },
  'plan-tune-declared-dimension': {
    id: 'plan-tune-declared-dimension',
    skill: 'plan-tune',
    category: 'clarification',
    door_type: 'two-way',
    description: "Self-declaration question（/plan-tune setup 期间每个 dimension 一个）",
  },
  'plan-tune-confirm-mutation': {
    id: 'plan-tune-confirm-mutation',
    skill: 'plan-tune',
    category: 'approval',
    door_type: 'two-way',
    options: ['accept', 'reject'],
    description: "写入前确认 profile change（free-form edits 的 user sovereignty gate）",
  },

  // -----------------------------------------------------------------------
  // /autoplan — sequential auto-review
  // -----------------------------------------------------------------------
  'autoplan-taste-decision': {
    id: 'autoplan-taste-decision',
    skill: 'autoplan',
    category: 'approval',
    door_type: 'two-way',
    options: ['accept', 'override', 'investigate'],
    description: "Autoplan 在 final gate 暴露了 taste decision — accept、override，还是 investigate？",
  },
  'autoplan-user-challenge': {
    id: 'autoplan-user-challenge',
    skill: 'autoplan',
    category: 'approval',
    door_type: 'one-way',
    options: ['accept', 'reject', 'revise'],
    description: "两个 models 都认为你的 direction 应该改变 — accept、reject，还是 revise plan？",
  },
} as const satisfies Record<string, QuestionDef>;

export type RegisteredQuestionId = keyof typeof QUESTIONS;

/**
 * Runtime lookup — 对 ad-hoc question_ids（未注册）返回 undefined。
 * Ad-hoc ids 仍会记录日志；只是不会获得 psychographic signal attribution。
 */
export function getQuestion(id: string): QuestionDef | undefined {
  return (QUESTIONS as Record<string, QuestionDef>)[id];
}

/** 获取所有 registered one-way door question ids（由 sensitivity checker 使用） */
export function getOneWayDoorIds(): Set<string> {
  return new Set(
    Object.values(QUESTIONS as Record<string, QuestionDef>)
      .filter((q) => q.door_type === 'one-way')
      .map((q) => q.id),
  );
}

/** 所有 registered question ids，供 CI completeness checks 使用 */
export function getAllRegisteredIds(): Set<string> {
  return new Set(Object.keys(QUESTIONS));
}

/** Registry stats，供 /plan-tune stats 使用 */
export function getRegistryStats() {
  const all = Object.values(QUESTIONS as Record<string, QuestionDef>);
  const bySkill: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let oneWay = 0;
  let twoWay = 0;
  for (const q of all) {
    bySkill[q.skill] = (bySkill[q.skill] ?? 0) + 1;
    byCategory[q.category] = (byCategory[q.category] ?? 0) + 1;
    if (q.door_type === 'one-way') oneWay++;
    else twoWay++;
  }
  return {
    total: all.length,
    one_way: oneWay,
    two_way: twoWay,
    by_skill: bySkill,
    by_category: byCategory,
  };
}
