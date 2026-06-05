/**
 * gstack-core@1.0.0 schema pack (T1 / Phase 0).
 *
 * 定义 gstack 写入 personal gbrain 的 7 类 typed page kinds：
 *   gstack/user-profile, gstack/product, gstack/goal, gstack/developer-persona,
 *   gstack/brand, gstack/competitive-intel, gstack/skill-run
 *
 * 以及 gstack 为 Phase 2 calibration 写入的 typed take kind：
 *   gstack/take (kind=bet, holder=<user>, with expected_resolution_date)
 *
 * 导出 JSON，供此变更落地后的首次 /setup-gbrain 或 /sync-gbrain 中的
 * `mcp__gbrain__schema_apply_mutations` 消费。Registration 是 idempotent
 *（pack version 匹配时，gbrain 的 mutation handler 会跳过 re-registration）。
 *
 * 每个 type 都携带 frontmatter shape + link types。Link inference 让
 * `mcp__gbrain__schema_graph` 能正确渲染 gstack subgraph。
 */

import {
  GSTACK_SCHEMA_PACK_NAME,
  GSTACK_SCHEMA_PACK_VERSION,
} from './brain-cache-spec';

export interface SchemaFieldShape {
  name: string;
  type: 'string' | 'date' | 'number' | 'enum' | 'wikilink-array' | 'string-array';
  required: boolean;
  /** 供 enum types 使用。 */
  values?: ReadonlyArray<string>;
  description: string;
}

export interface SchemaTypeDefinition {
  /** Page type slug，例如 `gstack/product`。 */
  type: string;
  /** Human-readable purpose。会 surfaced 到 `mcp__gbrain__schema_explain_type`。 */
  description: string;
  /** Per-page-type retention semantics；'immutable' 表示永不 auto-archive。 */
  retention: 'immutable' | 'archive-after-90d' | 'never-archive';
  /** page MUST 或 MAY 携带的 frontmatter fields。 */
  fields: ReadonlyArray<SchemaFieldShape>;
  /**
   * 此 page 通过 body 或 frontmatter 中的 `[[wikilink]]` references emit 的 link types。
   * 供 gbrain 的 link inference + schema_graph rendering 使用。
   */
  emits_links?: ReadonlyArray<{ verb: string; target_type: string }>;
}

export interface SchemaPackJSON {
  name: string;
  version: string;
  page_types: ReadonlyArray<SchemaTypeDefinition>;
  link_verbs: ReadonlyArray<string>;
}

/* ────────────────────────────────────────────────────────────────── */
/* Page type definitions（页面类型定义）                              */
/* ────────────────────────────────────────────────────────────────── */

const USER_PROFILE: SchemaTypeDefinition = {
  type: 'gstack/user-profile',
  description:
    'gstack user 的 cross-project profile：tone/conviction patterns、' +
    'decision tendencies、calibration profile reference。每个 user identity 一个。' +
    '所有 planning skills 都会读取它，以生成 tone-aware + bias-aware recommendations。',
  retention: 'never-archive',
  fields: [
    { name: 'type', type: 'string', required: true, description: 'gstack/user-profile' },
    { name: 'slug', type: 'string', required: true, description: 'gstack/user-profile/<user-slug>' },
    { name: 'user_slug', type: 'string', required: true, description: '按 USER_SLUG_RESOLUTION_ORDER 解析' },
    { name: 'last_updated_by', type: 'string', required: false, description: '最后 touch 此 page 的 skill' },
    { name: 'last_updated_at', type: 'date', required: false, description: 'ISO-8601 datetime' },
    { name: 'pattern_statements', type: 'string-array', required: false, description: '来自 calibration 的 bias tags（例如 "under-expands on infra plans"）' },
    { name: 'taste_signals', type: 'string-array', required: false, description: '跨 reviews 观察到的 recurring design/eng preferences' },
  ],
  emits_links: [
    { verb: 'has_calibration', target_type: 'gstack/take' },
  ],
};

const PRODUCT: SchemaTypeDefinition = {
  type: 'gstack/product',
  description:
    'Per-project product model：产品今天是什么（value prop、target user、' +
    'stage、team），并包含 active goals + recent decisions。每个 planning skill 在询问用户产品信息前，' +
    '都会查询这个 single source of truth。',
  retention: 'never-archive',
  fields: [
    { name: 'type', type: 'string', required: true, description: 'gstack/product' },
    { name: 'slug', type: 'string', required: true, description: 'gstack/product/<project-slug>' },
    { name: 'title', type: 'string', required: true, description: 'Project / product name' },
    { name: 'last_updated_by', type: 'string', required: false, description: '/office-hours or /plan-ceo-review' },
    { name: 'last_updated_at', type: 'date', required: false, description: 'ISO-8601' },
    { name: 'status', type: 'enum', required: true, values: ['active', 'paused', 'archived'], description: 'Project status' },
  ],
  emits_links: [
    { verb: 'targets', target_type: 'gstack/goal' },
    { verb: 'observed_by', target_type: 'gstack/developer-persona' },
    { verb: 'has_brand', target_type: 'gstack/brand' },
    { verb: 'competes_with', target_type: 'gstack/competitive-intel' },
    { verb: 'history', target_type: 'gstack/skill-run' },
  ],
};

const GOAL: SchemaTypeDefinition = {
  type: 'gstack/goal',
  description:
    '用户承诺的 time-bounded outcome（ship X by Y、hit metric Z）。' +
    '每个 project 可有多个 active goals。expected_resolution date 过去后自动翻为 status=expired；' +
    'preflight 会 surfaced expired goals 供 review。',
  retention: 'never-archive',
  fields: [
    { name: 'type', type: 'string', required: true, description: 'gstack/goal' },
    { name: 'slug', type: 'string', required: true, description: 'gstack/goal/<project-slug>/<goal-id>' },
    { name: 'title', type: 'string', required: true, description: '一行 goal statement' },
    { name: 'project', type: 'string', required: true, description: 'project slug' },
    { name: 'committed_at', type: 'date', required: true, description: '用户 committed 的时间' },
    { name: 'expected_resolution', type: 'date', required: false, description: 'ISO-8601；之后翻为 expired' },
    { name: 'status', type: 'enum', required: true, values: ['active', 'resolved', 'expired', 'archived'], description: 'lifecycle state' },
    { name: 'resolution_note', type: 'string', required: false, description: 'resolved 时填写' },
  ],
  emits_links: [
    { verb: 'belongs_to', target_type: 'gstack/product' },
  ],
};

const DEVELOPER_PERSONA: SchemaTypeDefinition = {
  type: 'gstack/developer-persona',
  description:
    '使用此 product 的 target developer 的 per-project model（当 product ' +
    '面向 developers 时）。捕获 persona、friction patterns、prior TTHW ' +
    'measurements。devex + design skills 会读取它，以生成 calibrated recommendations。',
  retention: 'never-archive',
  fields: [
    { name: 'type', type: 'string', required: true, description: 'gstack/developer-persona' },
    { name: 'slug', type: 'string', required: true, description: 'gstack/developer-persona/<project-slug>' },
    { name: 'persona', type: 'string', required: true, description: '一行 target developer description' },
    { name: 'tthw_measurements', type: 'string-array', required: false, description: '带日期的 historical TTHW times' },
    { name: 'friction_patterns', type: 'string-array', required: false, description: 'developers 卡住的位置' },
  ],
};

const BRAND: SchemaTypeDefinition = {
  type: 'gstack/brand',
  description:
    'Per-project brand voice：visual direction、design language、tone-of-voice。' +
    '由 design skills + devex skills 读取（用于跨 CLI/docs/UI 的 consistency checks）。',
  retention: 'never-archive',
  fields: [
    { name: 'type', type: 'string', required: true, description: 'gstack/brand' },
    { name: 'slug', type: 'string', required: true, description: 'gstack/brand/<project-slug>' },
    { name: 'aesthetic', type: 'string', required: false, description: '例如 "minimal/typographic"' },
    { name: 'typography', type: 'string', required: false, description: 'font system summary' },
    { name: 'color_system', type: 'string', required: false, description: 'palette summary' },
    { name: 'voice', type: 'string', required: false, description: 'writing tone' },
  ],
};

const COMPETITIVE_INTEL: SchemaTypeDefinition = {
  type: 'gstack/competitive-intel',
  description:
    'Per-project competitive landscape：incumbents、indirect substitutes、measured ' +
    'competitor benchmarks（TTHW、pricing、feature parity）。由 CEO + devex 读取。',
  retention: 'never-archive',
  fields: [
    { name: 'type', type: 'string', required: true, description: 'gstack/competitive-intel' },
    { name: 'slug', type: 'string', required: true, description: 'gstack/competitive-intel/<project-slug>' },
    { name: 'competitors', type: 'string-array', required: false, description: '带 positioning notes 的 named competitors' },
    { name: 'benchmarks', type: 'string-array', required: false, description: 'measured comparison points（TTHW 等）' },
  ],
};

const SKILL_RUN: SchemaTypeDefinition = {
  type: 'gstack/skill-run',
  description:
    '每次会产出 output 的 gstack skill invocation 都会在 completion 时写入一条此类型记录。' +
    '它是 decisions、modes、mode-selected、outcomes 的 time-series log。驱动 /retro ' +
    '以及（deferred）/gstack-reflect。90 天后 auto-archive 为 summary-only。',
  retention: 'archive-after-90d',
  fields: [
    { name: 'type', type: 'string', required: true, description: 'gstack/skill-run' },
    { name: 'slug', type: 'string', required: true, description: 'gstack/skill-run/<project>/<skill>/<timestamp>' },
    { name: 'skill', type: 'string', required: true, description: 'Skill name（例如 plan-ceo-review）' },
    { name: 'project', type: 'string', required: true, description: 'project slug' },
    { name: 'branch', type: 'string', required: false, description: 'Git branch' },
    { name: 'commit', type: 'string', required: false, description: 'short SHA' },
    { name: 'duration_s', type: 'number', required: false, description: 'Skill duration，单位 seconds' },
    { name: 'outcome', type: 'enum', required: true, values: ['success', 'error', 'aborted'], description: 'completion state' },
    { name: 'mode', type: 'string', required: false, description: '选择的 mode（适用于带 mode 的 skills）' },
    { name: 'decisions', type: 'number', required: false, description: 'AUQ decisions 数量' },
    { name: 'takes_written', type: 'number', required: false, description: '写入的 calibration bets（E5）' },
  ],
  emits_links: [
    { verb: 'related_to', target_type: 'gstack/product' },
    { verb: 'related_to', target_type: 'gstack/goal' },
    { verb: 'writes_bet', target_type: 'gstack/take' },
  ],
};

const TAKE: SchemaTypeDefinition = {
  type: 'gstack/take',
  description:
    '由 planning skills（Phase 2 / E5）写入的 typed predictions（kind=bet）。' +
    'Resolved bets 会反哺 user-profile calibration。永不 auto-archive。',
  retention: 'never-archive',
  fields: [
    { name: 'type', type: 'string', required: true, description: 'gstack/take' },
    { name: 'slug', type: 'string', required: true, description: 'gstack/take/<project>/<date>/<id>' },
    { name: 'kind', type: 'enum', required: true, values: ['bet', 'hunch', 'fact', 'event'], description: 'take kind' },
    { name: 'holder', type: 'string', required: true, description: 'User identity（whoami / user-slug）' },
    { name: 'claim', type: 'string', required: true, description: 'prediction text' },
    { name: 'weight', type: 'number', required: false, description: '0-1 confidence（per-skill from SKILL_CALIBRATION_WEIGHTS）' },
    { name: 'since_date', type: 'date', required: false, description: 'take 写入时间' },
    { name: 'expected_resolution', type: 'date', required: false, description: 'target resolution date' },
    { name: 'resolved_at', type: 'date', required: false, description: '标记 resolved 的时间' },
    { name: 'resolved_quality', type: 'enum', required: false, values: ['correct', 'incorrect', 'partial'], description: 'calibration outcome' },
    { name: 'source_skill', type: 'string', required: false, description: '写入此 bet 的 skill' },
  ],
  emits_links: [
    { verb: 'belongs_to', target_type: 'gstack/user-profile' },
    { verb: 'origin', target_type: 'gstack/skill-run' },
  ],
};

/* ────────────────────────────────────────────────────────────────── */
/* Schema pack assembly（schema pack 组装）                            */
/* ────────────────────────────────────────────────────────────────── */

export const GSTACK_CORE_SCHEMA_PACK: SchemaPackJSON = {
  name: GSTACK_SCHEMA_PACK_NAME,
  version: GSTACK_SCHEMA_PACK_VERSION,
  page_types: [
    USER_PROFILE,
    PRODUCT,
    GOAL,
    DEVELOPER_PERSONA,
    BRAND,
    COMPETITIVE_INTEL,
    SKILL_RUN,
    TAKE,
  ],
  // Link verbs 会在 mcp__gbrain__schema_graph 中作为 edge labels surfaced。
  link_verbs: [
    'has_calibration',
    'targets',
    'observed_by',
    'has_brand',
    'competes_with',
    'history',
    'belongs_to',
    'related_to',
    'writes_bet',
    'origin',
  ],
};

/**
 * 返回 gbrain 的 `schema_apply_mutations` MCP op 期望的 JSON shape。
 * brain 侧 idempotent：pack+version 匹配时，gbrain 跳过 re-registration。
 */
export function getSchemaPackMutationPayload(): {
  schema_pack: SchemaPackJSON;
  schema_version: number;
} {
  return {
    schema_pack: GSTACK_CORE_SCHEMA_PACK,
    schema_version: 1, // gbrain mutation API version，不是 pack version
  };
}

/** 仅返回 page type names。供 tests + audit subcommand 使用。 */
export function getSchemaPackTypeNames(): ReadonlyArray<string> {
  return GSTACK_CORE_SCHEMA_PACK.page_types.map((t) => t.type);
}

/** 返回给定 page type 的 retention policy。unknown 时抛错。 */
export function getRetentionPolicy(pageType: string): SchemaTypeDefinition['retention'] {
  const def = GSTACK_CORE_SCHEMA_PACK.page_types.find((t) => t.type === pageType);
  if (!def) throw new Error(`Unknown page type: ${pageType}`);
  return def.retention;
}
