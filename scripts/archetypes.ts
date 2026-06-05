/**
 * Archetypes — 根据 dimension clusters 计算的一两个词 builder identity。
 *
 * 供未来 /plan-tune vibe 和 /plan-tune narrative commands（v2）使用。
 * v1 发布 definitions，但还不会接入 user-facing output。这个文件存在的目的
 * 是让 archetype model 在 v2 narrative generation 发布前保持稳定。
 *
 * Design
 * ------
 * 每个 archetype 都是 5-dimensional psychographic space 中的一个点或区域。
 * `distance()` 计算 profile 到 archetype center 的 L2 distance，并按 archetype
 * 的 "tightness"（必须多接近才算 match）缩放。distance 最小的 archetype
 * 就是 user 的 match。
 *
 * 如果没有 archetype 落在 threshold 内，返回 'Polymath'：这是一个经过校准的
 * “不符合常见模式”标签，保持尊重，而不是 generic。
 */

import type { Dimension } from './psychographic-signals';

export interface Archetype {
  /** 简短 vibe label，一两个词。 */
  name: string;
  /** 锚定到 observable behavior 的单行描述。 */
  description: string;
  /** 5-dimensional space 中的中心点。 */
  center: Record<Dimension, number>;
  /** 反向加权半径。越小表示需要越紧的 match。 */
  tightness: number;
}

export const ARCHETYPES: readonly Archetype[] = [
  {
    name: 'Cathedral Builder',
    description: 'Boil the ocean。Architecture first。Ship the complete thing。',
    center: {
      scope_appetite: 0.85,
      risk_tolerance: 0.55,
      detail_preference: 0.5,
      autonomy: 0.5,
      architecture_care: 0.85,
    },
    tightness: 1.0,
  },
  {
    name: 'Ship-It Pragmatist',
    description: '小 scope，快速迭代。Good enough 就是 done。',
    center: {
      scope_appetite: 0.25,
      risk_tolerance: 0.75,
      detail_preference: 0.3,
      autonomy: 0.65,
      architecture_care: 0.4,
    },
    tightness: 1.0,
  },
  {
    name: 'Deep Craft',
    description: '每个细节都重要。解释要充分。慢一点，想清楚。',
    center: {
      scope_appetite: 0.6,
      risk_tolerance: 0.35,
      detail_preference: 0.85,
      autonomy: 0.35,
      architecture_care: 0.85,
    },
    tightness: 1.0,
  },
  {
    name: 'Taste Maker',
    description: '决策依赖直觉。Taste 有要求时会 override recommendations。',
    center: {
      scope_appetite: 0.6,
      risk_tolerance: 0.6,
      detail_preference: 0.5,
      autonomy: 0.4,
      architecture_care: 0.7,
    },
    tightness: 0.9,
  },
  {
    name: 'Solo Operator',
    description: '高 autonomy。Delegate to the agent。Trust but verify。',
    center: {
      scope_appetite: 0.5,
      risk_tolerance: 0.7,
      detail_preference: 0.3,
      autonomy: 0.85,
      architecture_care: 0.55,
    },
    tightness: 0.9,
  },
  {
    name: 'Consultant',
    description: 'Hands-on。每件事都希望被 consult。逐步 verify。',
    center: {
      scope_appetite: 0.5,
      risk_tolerance: 0.3,
      detail_preference: 0.7,
      autonomy: 0.2,
      architecture_care: 0.65,
    },
    tightness: 0.9,
  },
  {
    name: 'Wedge Hunter',
    description: '主动收窄 scope。找到最小但值得构建的东西。',
    center: {
      scope_appetite: 0.15,
      risk_tolerance: 0.5,
      detail_preference: 0.4,
      autonomy: 0.55,
      architecture_care: 0.6,
    },
    tightness: 0.85,
  },
  {
    name: 'Builder-Coach',
    description: '平衡 steering。给 agent 留出 propose 和 challenge 的空间。',
    center: {
      scope_appetite: 0.55,
      risk_tolerance: 0.5,
      detail_preference: 0.55,
      autonomy: 0.55,
      architecture_care: 0.6,
    },
    tightness: 0.75,
  },
];

/**
 * 当没有 archetype 足够接近时使用的 fallback，表示 user 的 dimension cluster
 * 确实不匹配任何已命名 pattern。
 */
export const FALLBACK_ARCHETYPE: Archetype = {
  name: 'Polymath',
  description: "你的 steering style 不符合常见 archetype。这是夸奖。",
  center: { scope_appetite: 0.5, risk_tolerance: 0.5, detail_preference: 0.5, autonomy: 0.5, architecture_care: 0.5 },
  tightness: 0,
};

const DIMENSIONS: readonly Dimension[] = [
  'scope_appetite',
  'risk_tolerance',
  'detail_preference',
  'autonomy',
  'architecture_care',
] as const;

function euclidean(a: Record<Dimension, number>, b: Record<Dimension, number>): number {
  let sumSq = 0;
  for (const d of DIMENSIONS) {
    const diff = (a[d] ?? 0.5) - (b[d] ?? 0.5);
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq);
}

/**
 * 将 profile 匹配到最合适的 archetype。
 * 如果没有 defined archetype 落在 threshold 内，则返回 FALLBACK_ARCHETYPE。
 */
export function matchArchetype(dims: Record<Dimension, number>): Archetype {
  let best: Archetype = FALLBACK_ARCHETYPE;
  let bestScore = Infinity; // 越低越好
  // Threshold：如果没有 archetype 分数低于它，返回 Polymath。
  // [0,1]^5 中最大 possible distance 是 sqrt(5) ≈ 2.236。0.55 约为半个空间。
  const THRESHOLD = 0.55;
  for (const arch of ARCHETYPES) {
    const dist = euclidean(dims, arch.center);
    // 按 tightness 缩放；越紧的 archetype 需要越小的 actual distance。
    const scaled = dist / (arch.tightness || 1);
    if (scaled < bestScore && scaled <= THRESHOLD) {
      bestScore = scaled;
      best = arch;
    }
  }
  return best;
}

/** All archetype names, useful for tests and /plan-tune stats. */
export function getAllArchetypeNames(): string[] {
  return ARCHETYPES.map((a) => a.name).concat(FALLBACK_ARCHETYPE.name);
}
