/**
 * Declared-profile annotation helper（plan-tune cathedral T7）。
 *
 * 给定来自 scripts/question-registry.ts 的 kebab signal_key，当 user 的 declared
 * profile 在匹配 dimension 上落入 strong band 时，返回一行 plain-English
 * annotation；否则返回 null。只读，永远不 mutation profile。
 *
 * Signature 按 D2/Codex correction 使用 kebab signal_key。内部查询 SIGNAL_MAP，
 * 选择这个 signal 影响最强的 dimension，并映射到 underscore Dimension key。
 *
 * Used by:
 *   - hosts/claude/hooks/question-preference-hook（Layer 3 injection path，
 *     AUQ mutation landing 后使用）
 *   - scripts/resolvers/question-tuning.ts preamble（Layer 9 fallback，
 *     Codex / older Claude Code 上的 host-portable path）
 *
 * 不用于 AUTO_DECIDE。Annotation 只做 advisory，且按 TODOS.md E1 substrate-risk
 * guidance 仅基于 declared profile。由 inferred profile 驱动的 AUTO_DECIDE
 * 仍属于 v2。
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { SIGNAL_MAP, type Dimension, ALL_DIMENSIONS } from './psychographic-signals';

const STRONG_HIGH = 0.7;
const STRONG_LOW = 0.3;

/**
 * 每个 dimension + band 的 plain-English phrasing。每条保持一句。
 * 它会直接进入 question prose，所以措辞很重要。
 */
const DIMENSION_PHRASING: Record<Dimension, { high: string; low: string }> = {
  scope_appetite: {
    high: 'Your declared profile leans complete-implementation (boil the ocean).',
    low: 'Your declared profile leans ship-small-fast.',
  },
  risk_tolerance: {
    high: 'Your declared profile leans move-fast.',
    low: 'Your declared profile leans check-carefully.',
  },
  detail_preference: {
    high: 'Your declared profile leans verbose-with-tradeoffs.',
    low: 'Your declared profile leans terse, just-do-it.',
  },
  autonomy: {
    high: 'Your declared profile leans delegate-and-trust.',
    low: 'Your declared profile leans consult-me-first.',
  },
  architecture_care: {
    high: 'Your declared profile leans get-the-design-right.',
    low: 'Your declared profile leans pragmatic-ship-it.',
  },
};

interface DeveloperProfile {
  declared?: Partial<Record<Dimension, number>>;
}

function stateRoot(): string {
  return (
    process.env.GSTACK_STATE_ROOT ||
    process.env.GSTACK_HOME ||
    path.join(os.homedir(), '.gstack')
  );
}

function readProfile(): DeveloperProfile | null {
  try {
    const p = path.join(stateRoot(), 'developer-profile.json');
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * 判断 signal_key 对哪个 dimension 的影响最强。
 * 对该 signal 下所有 user_choice → DimensionDelta[] entries 累加 |delta|，
 * 返回 total influence 最大的 dimension。如果 signal_key 不在 map 中，返回 null。
 */
export function primaryDimensionFor(signalKey: string): Dimension | null {
  const entry = SIGNAL_MAP[signalKey];
  if (!entry) return null;
  const totals: Partial<Record<Dimension, number>> = {};
  for (const choice of Object.keys(entry)) {
    for (const dd of entry[choice]) {
      totals[dd.dim] = (totals[dd.dim] ?? 0) + Math.abs(dd.delta);
    }
  }
  let best: Dimension | null = null;
  let bestVal = -Infinity;
  for (const d of ALL_DIMENSIONS) {
    const v = totals[d] ?? 0;
    if (v > bestVal) {
      bestVal = v;
      best = d;
    }
  }
  return bestVal > 0 ? best : null;
}

/**
 * 给定 signal_key，当 user 的 declared profile 在 primary dim 上落入 strong band
 * 时返回一行 plain-English annotation；否则返回 null。
 */
export function getDeclaredAnnotation(signalKey: string): string | null {
  if (!signalKey || typeof signalKey !== 'string') return null;
  const dim = primaryDimensionFor(signalKey);
  if (!dim) return null;

  const profile = readProfile();
  const declared = profile?.declared?.[dim];
  if (typeof declared !== 'number') return null;

  if (declared >= STRONG_HIGH) return DIMENSION_PHRASING[dim].high;
  if (declared <= STRONG_LOW) return DIMENSION_PHRASING[dim].low;
  return null;
}
