/**
 * Psychographic Signal Map — 手工维护的 {question_id, user_choice} → {dimension, delta}。
 *
 * v1 中仅用于为 /plan-tune inspection output 计算 inferred dimension values。
 * v1 中没有任何 skill behavior 会根据这些 signals 自适应。
 *
 * v2 把 5 个 skills 接入 profile 后，这个 map 就是 behavior 如何影响 dimensions
 * 的 source of truth。v1 中的 calibration deltas 是 best-guess 起点；v2 会
 * 用真实观察数据重新校准。
 *
 * Design principles
 * -----------------
 * 1. 手工维护，不由 agent inference 得出（Codex #4，user Decision C）。
 *    每条 mapping 都是 explicit TypeScript，不做 runtime NL interpretation。
 *
 * 2. 小而保守的 deltas（通常 ±0.03 到 ±0.06）。
 *    单次 answer 应该 nudges profile，而不是重塑它。跨 sessions 的重复 answers
 *    会累计。
 *
 * 3. 绑定到 registry signal_key。
 *    此 map 中的每个 entry 都对应 scripts/question-registry.ts 中声明的
 *    signal_key。derivation pipeline 用 question 的 signal_key + user_choice
 *    作为 lookup key。
 *
 * 4. 不是每个 question 都会贡献到每个 dimension。
 *    很多 questions 没有 signal_key，它们会被 logged，但不会移动 psychographic。
 *    只有真正揭示 preference 的 questions 才获得 signal_key。
 *
 * Dimensions
 * ----------
 *   scope_appetite:     0 = small-scope, ship fast  ↔  1 = boil the ocean
 *   risk_tolerance:     0 = conservative, ask first ↔  1 = move fast, auto-decide
 *   detail_preference:  0 = terse, just do it       ↔  1 = verbose, explain everything
 *   autonomy:           0 = hands-on, consult me    ↔  1 = delegate, trust the agent
 *   architecture_care:  0 = pragmatic, ship it      ↔  1 = principled, get it right
 */

import { QUESTIONS } from './question-registry';

/** developer psychographic 的 5 个 dimensions。 */
export type Dimension =
  | 'scope_appetite'
  | 'risk_tolerance'
  | 'detail_preference'
  | 'autonomy'
  | 'architecture_care';

export const ALL_DIMENSIONS: readonly Dimension[] = [
  'scope_appetite',
  'risk_tolerance',
  'detail_preference',
  'autonomy',
  'architecture_care',
] as const;

/**
 * signal map 的 semantic version。deltas 改变时递增，让 cached profiles
 * 可以检测 staleness 并从 events 重新计算。
 */
export const SIGNAL_MAP_VERSION = '0.1.0';

export interface DimensionDelta {
  dim: Dimension;
  delta: number;
}

/**
 * Signal map：signal_key → user_choice → dimension nudges 列表。
 *
 * 以 signal_key（在 question-registry entries 中声明）为索引，而不是直接用
 * question_id。这让多个 questions 可以共享一个 semantic pattern（例如
 * scope-appetite signal 同时来自 plan-ceo-review expansion proposals 和
 * office-hours approach selection）。
 */
export const SIGNAL_MAP: Record<string, Record<string, DimensionDelta[]>> = {
  // -----------------------------------------------------------------------
  // scope-appetite — user 有多喜欢扩展 scope
  // -----------------------------------------------------------------------
  'scope-appetite': {
    // plan-ceo-review mode choice
    expand: [{ dim: 'scope_appetite', delta: +0.06 }],
    selective: [{ dim: 'scope_appetite', delta: +0.03 }],
    hold: [{ dim: 'scope_appetite', delta: -0.01 }],
    reduce: [{ dim: 'scope_appetite', delta: -0.06 }],
    // plan-ceo-review expansion proposal accepted/deferred/skipped
    accept: [{ dim: 'scope_appetite', delta: +0.04 }],
    defer: [{ dim: 'scope_appetite', delta: -0.01 }],
    skip: [{ dim: 'scope_appetite', delta: -0.03 }],
    // office-hours approach choice
    minimal: [{ dim: 'scope_appetite', delta: -0.04 }],
    ideal: [{ dim: 'scope_appetite', delta: +0.05 }],
    creative: [{ dim: 'scope_appetite', delta: +0.02 }],
  },

  // -----------------------------------------------------------------------
  // architecture-care — user 有多在意细节
  // -----------------------------------------------------------------------
  'architecture-care': {
    'fix-now': [
      { dim: 'architecture_care', delta: +0.05 },
      { dim: 'risk_tolerance', delta: -0.02 },
    ],
    defer: [{ dim: 'architecture_care', delta: -0.02 }],
    'accept-risk': [
      { dim: 'architecture_care', delta: -0.04 },
      { dim: 'risk_tolerance', delta: +0.04 },
    ],
  },

  // -----------------------------------------------------------------------
  // code-quality-care — 代理 detail_preference + architecture_care
  // -----------------------------------------------------------------------
  'code-quality-care': {
    'fix-now': [
      { dim: 'detail_preference', delta: +0.02 },
      { dim: 'architecture_care', delta: +0.03 },
    ],
    'ack-and-ship': [
      { dim: 'risk_tolerance', delta: +0.03 },
      { dim: 'architecture_care', delta: -0.02 },
    ],
    'false-positive': [{ dim: 'architecture_care', delta: +0.01 }],
    defer: [{ dim: 'architecture_care', delta: -0.02 }],
    skip: [{ dim: 'detail_preference', delta: -0.03 }],
  },

  // -----------------------------------------------------------------------
  // test-discipline — 代理 architecture_care + detail_preference
  // -----------------------------------------------------------------------
  'test-discipline': {
    'fix-now': [
      { dim: 'architecture_care', delta: +0.04 },
      { dim: 'detail_preference', delta: +0.02 },
    ],
    investigate: [{ dim: 'architecture_care', delta: +0.02 }],
    'ack-and-ship': [
      { dim: 'risk_tolerance', delta: +0.04 },
      { dim: 'architecture_care', delta: -0.03 },
    ],
    'add-test': [
      { dim: 'architecture_care', delta: +0.03 },
      { dim: 'detail_preference', delta: +0.02 },
    ],
    defer: [{ dim: 'architecture_care', delta: -0.01 }],
    skip: [{ dim: 'architecture_care', delta: -0.04 }],
  },

  // -----------------------------------------------------------------------
  // detail-preference — verbosity 的直接 signal
  // -----------------------------------------------------------------------
  'detail-preference': {
    accept: [{ dim: 'detail_preference', delta: +0.03 }],
    skip: [{ dim: 'detail_preference', delta: -0.03 }],
  },

  // -----------------------------------------------------------------------
  // design-care — UI-facing work 中 architecture_care 的代理
  // -----------------------------------------------------------------------
  'design-care': {
    expand: [{ dim: 'architecture_care', delta: +0.04 }],
    polish: [{ dim: 'architecture_care', delta: +0.02 }],
    triage: [{ dim: 'architecture_care', delta: -0.02 }],
    'fix-now': [{ dim: 'architecture_care', delta: +0.02 }],
    defer: [{ dim: 'architecture_care', delta: -0.01 }],
    skip: [{ dim: 'architecture_care', delta: -0.03 }],
  },

  // -----------------------------------------------------------------------
  // devex-care — DX is UX for developers; proxies architecture_care
  // -----------------------------------------------------------------------
  'devex-care': {
    expand: [{ dim: 'architecture_care', delta: +0.04 }],
    polish: [{ dim: 'architecture_care', delta: +0.02 }],
    triage: [{ dim: 'architecture_care', delta: -0.02 }],
    'fix-now': [{ dim: 'architecture_care', delta: +0.02 }],
    defer: [{ dim: 'architecture_care', delta: -0.01 }],
    skip: [{ dim: 'architecture_care', delta: -0.03 }],
  },

  // -----------------------------------------------------------------------
  // distribution-care — does the user care about how code reaches users?
  // -----------------------------------------------------------------------
  'distribution-care': {
    accept: [{ dim: 'architecture_care', delta: +0.03 }],
    defer: [{ dim: 'architecture_care', delta: -0.02 }],
    skip: [{ dim: 'architecture_care', delta: -0.04 }],
  },

  // -----------------------------------------------------------------------
  // decision-autonomy — does the user trust the agent to apply decisions
  // without checking back? (Cathedral T7: was the missing signal for the
  // 'autonomy' dimension; added so /plan-tune annotations can render
  // 'consult me' vs 'delegate' guidance on merge/rollback questions.)
  // -----------------------------------------------------------------------
  'decision-autonomy': {
    accept: [{ dim: 'autonomy', delta: +0.04 }],
    reject: [{ dim: 'autonomy', delta: -0.04 }],
    // common option keys for "I'll review first" vs "go ahead":
    'review-first': [{ dim: 'autonomy', delta: -0.05 }],
    proceed: [{ dim: 'autonomy', delta: +0.05 }],
    // /investigate-style: "agent applies fix" vs "show me the diff first"
    'apply-fix': [{ dim: 'autonomy', delta: +0.04 }],
    'show-diff': [{ dim: 'autonomy', delta: -0.04 }],
  },

  // -----------------------------------------------------------------------
  // session-mode — office-hours goal selection
  // -----------------------------------------------------------------------
  'session-mode': {
    startup: [
      { dim: 'scope_appetite', delta: +0.02 },
      { dim: 'architecture_care', delta: +0.02 },
    ],
    intrapreneur: [{ dim: 'scope_appetite', delta: +0.02 }],
    hackathon: [
      { dim: 'risk_tolerance', delta: +0.03 },
      { dim: 'architecture_care', delta: -0.02 },
    ],
    'oss-research': [{ dim: 'architecture_care', delta: +0.02 }],
    learning: [{ dim: 'detail_preference', delta: +0.02 }],
    fun: [{ dim: 'risk_tolerance', delta: +0.02 }],
  },
};

/**
 * Apply a user choice for a question to the running dimension totals.
 *
 * @param dims - running total of dimension nudges (mutated)
 * @param signal_key - from the question registry entry
 * @param user_choice - the option key the user selected
 * @returns list of dimension deltas applied (empty if no mapping)
 */
export function applySignal(
  dims: Record<Dimension, number>,
  signal_key: string,
  user_choice: string,
): DimensionDelta[] {
  const subMap = SIGNAL_MAP[signal_key];
  if (!subMap) return [];
  const deltas = subMap[user_choice];
  if (!deltas) return [];
  for (const { dim, delta } of deltas) {
    dims[dim] = (dims[dim] ?? 0) + delta;
  }
  return deltas;
}

/**
 * Validate that every signal_key referenced in the registry has a matching
 * entry in SIGNAL_MAP. Called by tests to catch drift.
 */
export function validateRegistrySignalKeys(): {
  missing: string[];
  extra: string[];
} {
  const registrySignalKeys = new Set<string>();
  for (const q of Object.values(QUESTIONS)) {
    if (q.signal_key) registrySignalKeys.add(q.signal_key);
  }
  const mapKeys = new Set(Object.keys(SIGNAL_MAP));
  const missing: string[] = [];
  const extra: string[] = [];
  for (const k of registrySignalKeys) {
    if (!mapKeys.has(k)) missing.push(k);
  }
  for (const k of mapKeys) {
    if (!registrySignalKeys.has(k)) extra.push(k);
  }
  return { missing, extra };
}

/** Empty dimension totals — starting point for derivation. */
export function newDimensionTotals(): Record<Dimension, number> {
  return {
    scope_appetite: 0,
    risk_tolerance: 0,
    detail_preference: 0,
    autonomy: 0,
    architecture_care: 0,
  };
}

/** Sigmoid clamp: map accumulated delta total to [0, 1]. */
export function normalizeToDimensionValue(total: number): number {
  // Simple sigmoid: each 1.0 of accumulated delta approaches saturation.
  // 0.5 is neutral. Positive deltas push toward 1, negative toward 0.
  return 1 / (1 + Math.exp(-total * 3));
}
