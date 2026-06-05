/**
 * Brain cache spec — brain-aware planning skills cache layer 的 single source of truth。
 * 被以下位置 import：
 *   - scripts/resolvers/gbrain.ts（把 per-skill subset 渲染进 SKILL.md.tmpl）
 *   - bin/gstack-brain-cache（驱动 TTL + write-back invalidation）
 *   - test/brain-cache-spec.test.ts（断言 internal consistency）
 *   - test/skill-preflight-budget.test.ts（强制 per-skill token budget）
 *   - test/autoplan-preflight-budget.test.ts（强制 autoplan total budget）
 *
 * docs 和 runtime 之间的 drift 在结构上不可能发生：同一个 const 同时驱动
 * SKILL.md 中渲染出的 table 和 cache CLI behavior。
 */

export interface BrainCacheEntity {
  /** ~/.gstack/{,projects/<slug>/}brain-cache/ 内的 filename */
  file: string;
  /** Time-to-live，单位毫秒；超过后 cache 视为 stale 并触发 cold refresh。 */
  ttl_ms: number;
  /** Scope 决定哪个 dir 持有 cache file。 */
  scope: 'cross-project' | 'per-project';
  /**
   * 哪些 write-paths 会 invalidate 此 digest。writer 运行时会查询此列表，
   * 以确定要 bust 哪些 cache files。Special values：
   *   - 'calibration-write' — 任意 Phase 2 takes_add call
   *   - 'skill-run-write'   — 任意写入 gstack/skill-run page 的 skill
   * 其他值是 '/plan-ceo-review' 这类 skill names。
   */
  invalidated_by: ReadonlyArray<string>;
  /** digest 的 hard byte budget。超出时 compressor 丢弃 oldest items。 */
  budget_bytes: number;
}

/**
 * 七个 cached entities 对应 `gstack-core` schema pack v1.0.0（Phase 0）
 * 中的七类 typed page kinds：
 *   user-profile, product, goal, developer-persona, brand, competitive-intel, skill-run
 * 另有两个 derived digests：
 *   recent-decisions（top 5 gstack/skill-run pages）
 *   salience（mcp__gbrain__get_recent_salience output）
 */
export const BRAIN_CACHE_ENTITIES: Record<string, BrainCacheEntity> = {
  'user-profile': {
    file: 'user-profile.md',
    ttl_ms: 7 * 86_400_000, // 7 days
    scope: 'cross-project',
    invalidated_by: ['/retro', '/plan-tune', 'calibration-write'],
    budget_bytes: 2048,
  },
  product: {
    file: 'product.md',
    ttl_ms: 1 * 86_400_000, // 1 day
    scope: 'per-project',
    invalidated_by: ['/office-hours', '/plan-ceo-review'],
    budget_bytes: 1024,
  },
  goals: {
    file: 'goals.md',
    ttl_ms: 12 * 3_600_000, // 12 hours
    scope: 'per-project',
    invalidated_by: ['/office-hours', '/plan-ceo-review'],
    budget_bytes: 512,
  },
  'developer-persona': {
    file: 'developer-persona.md',
    ttl_ms: 7 * 86_400_000,
    scope: 'per-project',
    invalidated_by: ['/plan-devex-review', '/devex-review'],
    budget_bytes: 1024,
  },
  brand: {
    file: 'brand.md',
    ttl_ms: 7 * 86_400_000,
    scope: 'per-project',
    invalidated_by: ['/design-consultation', '/plan-design-review'],
    budget_bytes: 1024,
  },
  'competitive-intel': {
    file: 'competitive-intel.md',
    ttl_ms: 1 * 86_400_000,
    scope: 'per-project',
    invalidated_by: ['/plan-ceo-review', '/office-hours'],
    budget_bytes: 1024,
  },
  'recent-decisions': {
    file: 'recent-decisions.md',
    ttl_ms: 12 * 3_600_000,
    scope: 'per-project',
    invalidated_by: ['skill-run-write'],
    budget_bytes: 2048,
  },
  salience: {
    file: 'salience.md',
    ttl_ms: 4 * 3_600_000, // 4 hours
    scope: 'per-project',
    invalidated_by: [],
    budget_bytes: 512,
  },
};

/**
 * Per-skill subset map。resolver 使用它 emit per-skill BRAIN_PREFLIGHT instructions。
 * skill template 只加载列出的 digests，绝不更多。顺序会影响注入的
 * ## Brain Context block 的 narrative coherence。
 *
 * 每个 skill 的 hard token budget（由 test/skill-preflight-budget.test.ts 验证）：
 *   - CEO/office-hours: 5 KB（context need 最丰富）
 *   - eng/design/devex: 2 KB
 */
export const SKILL_DIGEST_SUBSETS: Record<string, ReadonlyArray<string>> = {
  'office-hours': ['product', 'goals', 'user-profile', 'recent-decisions', 'salience'],
  'plan-ceo-review': ['product', 'goals', 'recent-decisions', 'user-profile'],
  'plan-eng-review': ['product', 'recent-decisions'],
  'plan-design-review': ['product', 'brand', 'recent-decisions'],
  'plan-devex-review': ['product', 'developer-persona', 'recent-decisions', 'competitive-intel'],
};

/** Per-skill total digest budget（loaded digests 的总和不得超过）。 */
export const SKILL_PREFLIGHT_BUDGET_BYTES: Record<string, number> = {
  'office-hours': 5120,
  'plan-ceo-review': 5120,
  'plan-eng-review': 2048,
  'plan-design-review': 2048,
  'plan-devex-review': 2048,
};

/**
 * 一次 autoplan run（4 个 sequential planning skills）的 total budget。由
 * test/autoplan-preflight-budget.test.ts 验证。如果未来 autoplan-extended 增加 skills，
 * 此 cap 会强制显式 revisit budget。
 */
export const AUTOPLAN_PREFLIGHT_BUDGET_BYTES = 25_600;

/**
 * D9 salience privacy：默认 allowlist，列出可安全 surfaced 到 planning prompts 的
 * slug prefixes。任何不在其中的内容（personal/、family/、therapy/ 等）都会在
 * digest write time 被 stripped。用户可通过以下命令扩展：
 * `gstack-config set salience_allowlist '<comma-separated-prefixes>'`.
 */
export const SALIENCE_DEFAULT_ALLOWLIST: ReadonlyArray<string> = [
  'projects/',
  'concepts/',
  'gstack/',
];

/**
 * Per-skill calibration bet weights（Phase 2 / E5）。当 planning skill 写入
 * kind=bet take 时，weight 决定它对用户 calibration profile 的影响强度。
 * Higher = 更 confident 的 prediction，在 resolution 时获得更多 credit/blame。
 */
export const SKILL_CALIBRATION_WEIGHTS: Record<string, number> = {
  'plan-ceo-review': 0.8,
  'plan-eng-review': 0.7,
  'plan-design-review': 0.5,
  'plan-devex-review': 0.6,
  'office-hours': 0.9,
};

/**
 * cache refresh dedup（D3）使用的 lock-file path。Per-project 以避免
 * cross-project contention。5 分钟后 stale-takeover。
 */
export const CACHE_REFRESH_LOCK_TIMEOUT_MS = 5 * 60_000;

/**
 * Retention policy：gstack/skill-run pages 在这么多天后 auto-archive。
 * Calibration takes（kind=bet）永不 archive（long-term scorecard 需要它们）。
 */
export const SKILL_RUN_RETENTION_DAYS = 90;

/**
 * Schema pack identity。添加、移除或重命名 page types 时 bump。
 * 如果和 _meta.json 中记录的 version 不匹配，cache layer 会对受影响 project
 * 触发 FULL rebuild。
 */
export const GSTACK_SCHEMA_PACK_NAME = 'gstack-core';
export const GSTACK_SCHEMA_PACK_VERSION = '1.0.0';

/**
 * Trust policy values。驱动 artifacts 的 auto-push、calibration write-back eligibility
 * 和 user-namespacing strategy。
 */
export type BrainTrustPolicy = 'personal' | 'shared' | 'unset';

/**
 * Per-transport default policy。Local engines 自动设为 personal（结构上 single-tenant）。
 * Remote endpoints 会基于 sources_list shape 推断：exactly one source + whoami matches
 * → personal default；multiple sources 或 federation → 询问 policy question。
 */
export const TRANSPORT_DEFAULT_POLICY: Record<string, BrainTrustPolicy | 'infer'> = {
  'local-pglite': 'personal',
  'local-stdio': 'personal',
  'remote-http-single-tenant': 'personal',
  'remote-http-ambiguous': 'unset',
  unknown: 'unset',
};

/**
 * User-slug fallback chain（D4 A3 defensive default）。每个 endpoint resolve 一次，
 * 并通过 `gstack-config set user_slug_at_<endpoint-hash> <slug>` 持久化。
 * 跨 sessions 稳定。
 */
export const USER_SLUG_RESOLUTION_ORDER = [
  'whoami_client_name', // mcp__gbrain__whoami.client_name (remote + OAuth)
  'env_user', // $USER environment variable
  'git_email_sha8', // sha8($(git config user.email))
  'anonymous_hostname_sha8', // anonymous-<sha8(hostname)>
] as const;

/** ----------------------------------------------------------------------- */
/** resolver、cache CLI 和 tests 消费的 helper functions。                  */
/** ----------------------------------------------------------------------- */

/** 返回 entity name 对应的 cache filename；unknown 时抛错。 */
export function getCacheFile(entityName: string): string {
  const entity = BRAIN_CACHE_ENTITIES[entityName];
  if (!entity) throw new Error(`Unknown brain cache entity: ${entityName}`);
  return entity.file;
}

/** 返回 skill 的 digest subset；该 skill 未启用 preflight 时抛错。 */
export function getSkillSubset(skillName: string): ReadonlyArray<string> {
  const subset = SKILL_DIGEST_SUBSETS[skillName];
  if (!subset) throw new Error(`Skill not registered for brain preflight: ${skillName}`);
  return subset;
}

/** 返回 per-skill total digest budget，单位 bytes。 */
export function getSkillBudget(skillName: string): number {
  const budget = SKILL_PREFLIGHT_BUDGET_BYTES[skillName];
  if (budget == null) throw new Error(`Skill not registered for brain preflight: ${skillName}`);
  return budget;
}

/**
 * 给定 write-path identifier（skill name 或 special token），返回应被 invalidated
 * 的 cache files 列表。驱动 cache CLI 的 `invalidate` subcommand 和 resolver 的
 * BRAIN_WRITE_BACK block。
 */
export function getInvalidationTargets(writePath: string): ReadonlyArray<string> {
  const targets: string[] = [];
  for (const [name, entity] of Object.entries(BRAIN_CACHE_ENTITIES)) {
    if (entity.invalidated_by.includes(writePath)) {
      targets.push(name);
    }
  }
  return targets;
}

/**
 * 列出所有注册了 brain preflight 的 skill names。供 test/brain-preflight.test.ts
 * 和 test/skill-preflight-budget.test.ts 使用，以便不 hardcode skill list。
 */
export function getPreflightSkills(): ReadonlyArray<string> {
  return Object.keys(SKILL_DIGEST_SUBSETS);
}

/**
 * 计算某个 skill 可能的最大 digest set size（subset 中 per-entity budgets 之和）。
 * 供 skill-preflight-budget.test.ts 验证：给定 per-entity caps 时，per-skill cap
 * 是可 enforce 的。
 */
export function getMaxSubsetBytes(skillName: string): number {
  const subset = getSkillSubset(skillName);
  return subset.reduce((sum, name) => sum + (BRAIN_CACHE_ENTITIES[name]?.budget_bytes ?? 0), 0);
}
