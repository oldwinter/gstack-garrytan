/**
 * One-Way Door Classifier — belt-and-suspenders safety layer（双保险安全层）。
 *
 * Primary safety gate 是 scripts/question-registry.ts 中的 `door_type` field。
 * 每个 registered AskUserQuestion 都会声明自己是 one-way（always ask，
 * never auto-decide）还是 two-way（可由 explicit user preference suppress）。
 *
 * 此文件是 SECONDARY keyword-pattern check，用于那些触发时没有 registry id
 * 的 questions（runtime 生成的 ad-hoc question_ids）。如果 question_summary
 * 包含任何 destructive keyword patterns，就把它视为 one-way，不管 absent/unknown
 * registry entry 怎么说。
 *
 * Codex 正确指出（design doc Decision C）：prose-parsing 太弱，不能作为 PRIMARY
 * safety gate，因为 wording 会变。registry 才是 primary。这里是尚未 catalogued
 * questions 的 fallback，并且会偏向询问用户，即使 tuning preferences 说 skip。
 *
 * Ordering
 * --------
 * gstack-question-sensitivity --check 按以下顺序调用 isOneWayDoor()：
 *   1. 按 id 查 registry → 如果找到，使用 registry.door_type
 *   2. 如果不在 registry 中：应用下方 keyword patterns
 *   3. 默认 ASK_NORMALLY（比 AUTO_DECIDE 更安全）
 */

import { getQuestion } from './question-registry';

/**
 * 当 registry 中没有 question_id entry 时，用于识别 one-way-door questions 的
 * keyword patterns。对传给 AskUserQuestion 的 question_summary 做
 * case-insensitive substring match。
 *
 * 这里的 additions 应保守：false positive 意味着用户多回答一个本可 auto-decide
 * 的问题；false negative 可能意味着 auto-approving destructive operation。
 */
const DESTRUCTIVE_PATTERNS: RegExp[] = [
  // File system destruction（文件系统破坏）
  /\brm\s+-rf\b/i,
  /\bdelete\b/i,
  /\bremove\s+(directory|folder|files?)\b/i,
  /\bwipe\b/i,
  /\bpurge\b/i,
  /\btruncate\b/i,

  // Database destruction（数据库破坏）
  /\bdrop\s+(table|database|schema|index|column)\b/i,
  /\bdelete\s+from\b/i,

  // Git / VCS destruction（Git / VCS 破坏）
  /\bforce[- ]push\b/i,
  /\bpush\s+--force\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bcheckout\s+--\b/i,
  /\brestore\s+\.\b/i,
  /\bclean\s+-f\b/i,
  /\bbranch\s+-D\b/i,

  // Deploy / infra destruction（部署 / 基础设施破坏）
  /\bkubectl\s+delete\b/i,
  /\bterraform\s+destroy\b/i,
  /\brollback\b/i,

  // Credentials / auth — 允许 verb 和 noun 之间有 filler words（"the"、"my"）
  /\brevoke\s+[\w\s]*\b(api key|token|credential|access key|password)\b/i,
  /\breset\s+[\w\s]*\b(api key|token|password|credential)\b/i,
  /\brotate\s+[\w\s]*\b(api key|token|secret|credential|access key|password)\b/i,

  // Scope / architecture forks（可努力回退，但仍值得确认）
  /\barchitectur(e|al)\s+(change|fork|shift|decision)\b/i,
  /\bdata\s+model\s+change\b/i,
  /\bschema\s+migration\b/i,
  /\bbreaking\s+change\b/i,
];

/**
 * 即使 question body 看起来 harmless，也始终 one-way 的 skill-category 组合。
 * 匹配 ownership model：某些 skill actions 天然 high-stakes。
 */
const ONE_WAY_SKILL_CATEGORIES = new Set<string>([
  'cso:approval', // security-audit findings
  'land-and-deploy:approval', // /land-and-deploy 询问的任何内容
]);

export interface ClassifyInput {
  /** Registry id 或 ad-hoc id；优先查找 */
  question_id?: string;
  /** 触发 question 的 skill（用于 skill-category fallback） */
  skill?: string;
  /** Question category（approval | clarification | routing | cherry-pick | feedback-loop） */
  category?: string;
  /** Free-form question summary — 与 destructive keywords 做 pattern match */
  summary?: string;
}

export interface ClassifyResult {
  /** true = 视为 one-way door（always ask，never auto-decide） */
  oneWay: boolean;
  /** 哪个 check 触发了 classification（供 audit/debug） */
  reason: 'registry' | 'skill-category' | 'keyword' | 'default-safe' | 'default-two-way';
  /** reason 为 'keyword' 时的 matched pattern */
  matched?: string;
}

/**
 * 将 question 分类为 one-way（always ask）或 two-way（can be suppressed）。
 * 只有找不到 one-way evidence 时，才返回 {oneWay: false, reason: 'default-two-way'}。
 * 其他情况都保守处理。
 */
export function classifyQuestion(input: ClassifyInput): ClassifyResult {
  // 1. Registry lookup（primary）
  if (input.question_id) {
    const registered = getQuestion(input.question_id);
    if (registered) {
      return {
        oneWay: registered.door_type === 'one-way',
        reason: 'registry',
      };
    }
  }

  // 2. Skill-category fallback (certain combos are always one-way)
  if (input.skill && input.category) {
    const key = `${input.skill}:${input.category}`;
    if (ONE_WAY_SKILL_CATEGORIES.has(key)) {
      return { oneWay: true, reason: 'skill-category' };
    }
  }

  // 3. Keyword pattern match (catch destructive questions without registry entry)
  if (input.summary) {
    for (const pattern of DESTRUCTIVE_PATTERNS) {
      if (pattern.test(input.summary)) {
        return {
          oneWay: true,
          reason: 'keyword',
          matched: pattern.toString(),
        };
      }
    }
  }

  // 4. No evidence either way — treat as two-way (can be preference-suppressed).
  return { oneWay: false, reason: 'default-two-way' };
}

/**
 * Convenience wrapper for the sensitivity check binary.
 * Returns true if the question must be asked regardless of user preferences.
 */
export function isOneWayDoor(input: ClassifyInput): boolean {
  return classifyQuestion(input).oneWay;
}

/**
 * Export patterns for tests and audit tooling.
 */
export const DESTRUCTIVE_PATTERN_LIST = DESTRUCTIVE_PATTERNS;
export const ONE_WAY_SKILL_CATEGORY_SET = ONE_WAY_SKILL_CATEGORIES;
