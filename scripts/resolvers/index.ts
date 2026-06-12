/**
 * RESOLVERS record — 将 {{PLACEHOLDER}} names 映射到 generator functions
 * 或 gated entries。
 *
 * 每个 resolver 接收 TemplateContext，并返回 replacement string。
 * Resolvers 可以是 bare function（始终触发），也可以是 gated entry
 * ({ resolve, appliesTo })；其中 appliesTo 可返回 false，跳过给定 skill
 * 的 resolver。见 ./types.ts: ResolverEntry。
 *
 * 大多数 resolvers 不需要 gate；{{NAME}} placeholder system 已经在 template
 * 层面是 conditional（resolver 只会为引用它的 skills 触发）。当你需要 structural
 * guardrail，明确 "this placeholder is meaningful only in skills X, Y, Z"，
 * 即使以后有人把 {{NAME}} 加到 skill W 时，才使用 gate。
 */

import type { TemplateContext, ResolverFn, ResolverValue } from './types';

// Domain modules（领域模块）
import { generatePreamble } from './preamble';
import { generateTestFailureTriage } from './preamble';
import { generateCommandReference, generateSnapshotFlags, generateBrowseSetup } from './browse';
import { generateDesignMethodology, generateDesignHardRules, generateDesignOutsideVoices, generateDesignReviewLite, generateDesignSketch, generateDesignSetup, generateDesignMockup, generateDesignShotgunLoop, generateTasteProfile, generateUXPrinciples } from './design';
import { generateTestBootstrap, generateTestCoverageAuditPlan, generateTestCoverageAuditShip, generateTestCoverageAuditReview } from './testing';
import { generateReviewDashboard, generatePlanFileReviewReport, generateExitPlanModeGate, generateAntiShortcutClause, generateSpecReviewLoop, generateBenefitsFrom, generateCodexSecondOpinion, generateAdversarialStep, generateCodexPlanReview, generateCodexDocReview, generatePlanCompletionAuditShip, generatePlanCompletionAuditReview, generatePlanVerificationExec, generateScopeDrift, generateCrossReviewDedup } from './review';
import { generateSlugEval, generateSlugSetup, generateBaseBranchDetect, generateDeployBootstrap, generateQAMethodology, generateCoAuthorTrailer, generateChangelogWorkflow } from './utility';
import { generateLearningsSearch, generateLearningsLog } from './learnings';
import { generateConfidenceCalibration } from './confidence';
import { generateInvokeSkill } from './composition';
import { generateReviewArmy } from './review-army';
import { generateDxFramework } from './dx';
import { generateModelOverlay } from './model-overlay';
import { generateGBrainContextLoad, generateGBrainSaveResults, generateBrainPreflight, generateBrainCacheRefresh, generateBrainWriteBack } from './gbrain';
import { generateQuestionPreferenceCheck, generateQuestionLog, generateInlineTuneFeedback } from './question-tuning';
import { generateMakePdfSetup } from './make-pdf';
import { generateTasksSectionEmit, generateTasksSectionAggregate } from './tasks-section';
import { SECTION, SECTION_INDEX } from './sections';
import { generateRedactTaxonomyTable, generateRedactInvocationBlock } from './redact-doc';

export const RESOLVERS: Record<string, ResolverValue> = {
  SLUG_EVAL: generateSlugEval,
  SLUG_SETUP: generateSlugSetup,
  REDACT_TAXONOMY_TABLE: generateRedactTaxonomyTable,
  REDACT_INVOCATION_BLOCK: generateRedactInvocationBlock,
  COMMAND_REFERENCE: generateCommandReference,
  SNAPSHOT_FLAGS: generateSnapshotFlags,
  PREAMBLE: generatePreamble,
  BROWSE_SETUP: generateBrowseSetup,
  BASE_BRANCH_DETECT: generateBaseBranchDetect,
  QA_METHODOLOGY: generateQAMethodology,
  DESIGN_METHODOLOGY: generateDesignMethodology,
  DESIGN_HARD_RULES: generateDesignHardRules,
  UX_PRINCIPLES: generateUXPrinciples,
  DESIGN_OUTSIDE_VOICES: generateDesignOutsideVoices,
  DESIGN_REVIEW_LITE: generateDesignReviewLite,
  REVIEW_DASHBOARD: generateReviewDashboard,
  PLAN_FILE_REVIEW_REPORT: generatePlanFileReviewReport,
  EXIT_PLAN_MODE_GATE: generateExitPlanModeGate,
  ANTI_SHORTCUT_CLAUSE: generateAntiShortcutClause,
  TEST_BOOTSTRAP: generateTestBootstrap,
  TEST_COVERAGE_AUDIT_PLAN: generateTestCoverageAuditPlan,
  TEST_COVERAGE_AUDIT_SHIP: generateTestCoverageAuditShip,
  TEST_COVERAGE_AUDIT_REVIEW: generateTestCoverageAuditReview,
  TEST_FAILURE_TRIAGE: generateTestFailureTriage,
  SPEC_REVIEW_LOOP: generateSpecReviewLoop,
  DESIGN_SKETCH: generateDesignSketch,
  DESIGN_SETUP: generateDesignSetup,
  DESIGN_MOCKUP: generateDesignMockup,
  DESIGN_SHOTGUN_LOOP: generateDesignShotgunLoop,
  BENEFITS_FROM: generateBenefitsFrom,
  CODEX_SECOND_OPINION: generateCodexSecondOpinion,
  ADVERSARIAL_STEP: generateAdversarialStep,
  SCOPE_DRIFT: generateScopeDrift,
  DEPLOY_BOOTSTRAP: generateDeployBootstrap,
  CODEX_PLAN_REVIEW: generateCodexPlanReview,
  CODEX_DOC_REVIEW: generateCodexDocReview,
  PLAN_COMPLETION_AUDIT_SHIP: generatePlanCompletionAuditShip,
  PLAN_COMPLETION_AUDIT_REVIEW: generatePlanCompletionAuditReview,
  PLAN_VERIFICATION_EXEC: generatePlanVerificationExec,
  CO_AUTHOR_TRAILER: generateCoAuthorTrailer,
  LEARNINGS_SEARCH: generateLearningsSearch,
  LEARNINGS_LOG: generateLearningsLog,
  CONFIDENCE_CALIBRATION: generateConfidenceCalibration,
  INVOKE_SKILL: generateInvokeSkill,
  CHANGELOG_WORKFLOW: generateChangelogWorkflow,
  REVIEW_ARMY: generateReviewArmy,
  CROSS_REVIEW_DEDUP: generateCrossReviewDedup,
  DX_FRAMEWORK: generateDxFramework,
  MODEL_OVERLAY: generateModelOverlay,
  TASTE_PROFILE: generateTasteProfile,
  BIN_DIR: (ctx) => ctx.paths.binDir,
  GBRAIN_CONTEXT_LOAD: generateGBrainContextLoad,
  GBRAIN_SAVE_RESULTS: generateGBrainSaveResults,
  BRAIN_PREFLIGHT: generateBrainPreflight,
  BRAIN_CACHE_REFRESH: generateBrainCacheRefresh,
  BRAIN_WRITE_BACK: generateBrainWriteBack,
  QUESTION_PREFERENCE_CHECK: generateQuestionPreferenceCheck,
  QUESTION_LOG: generateQuestionLog,
  INLINE_TUNE_FEEDBACK: generateInlineTuneFeedback,
  MAKE_PDF_SETUP: generateMakePdfSetup,
  TASKS_SECTION_EMIT: generateTasksSectionEmit,
  TASKS_SECTION_AGGREGATE: generateTasksSectionAggregate,
  SECTION,
  SECTION_INDEX,
};
