import { ALL_HOST_CONFIGS } from '../../hosts/index';

/**
 * Host type — 从 hosts/*.ts 中的 host configs 推导。
 * 新增 host：创建 hosts/myhost.ts，并添加到 hosts/index.ts。
 * 不要在这里 hardcode host names。
 */
export type Host = (typeof ALL_HOST_CONFIGS)[number]['name'];

export interface HostPaths {
  skillRoot: string;
  localSkillRoot: string;
  binDir: string;
  browseDir: string;
  designDir: string;
  makePdfDir: string;
}

/**
 * HOST_PATHS — 从 host configs 推导。
 * 每个 config 的 globalRoot/localSkillRoot 决定 path structure。
 * Non-Claude hosts 使用 $GSTACK_ROOT env vars（由 preamble 设置）。
 */
function buildHostPaths(): Record<string, HostPaths> {
  const paths: Record<string, HostPaths> = {};
  for (const config of ALL_HOST_CONFIGS) {
    if (config.usesEnvVars) {
      paths[config.name] = {
        skillRoot: '$GSTACK_ROOT',
        localSkillRoot: config.localSkillRoot,
        binDir: '$GSTACK_BIN',
        browseDir: '$GSTACK_BROWSE',
        designDir: '$GSTACK_DESIGN',
        makePdfDir: '$GSTACK_MAKE_PDF',
      };
    } else {
      const root = `~/${config.globalRoot}`;
      paths[config.name] = {
        skillRoot: root,
        localSkillRoot: config.localSkillRoot,
        binDir: `${root}/bin`,
        browseDir: `${root}/browse/dist`,
        designDir: `${root}/design/dist`,
        makePdfDir: `${root}/make-pdf/dist`,
      };
    }
  }
  return paths;
}

export const HOST_PATHS: Record<string, HostPaths> = buildHostPaths();

import type { Model } from '../models';
export type { Model } from '../models';

export interface TemplateContext {
  skillName: string;
  tmplPath: string;
  benefitsFrom?: string[];
  host: Host;
  paths: HostPaths;
  preambleTier?: number;  // 1-4，控制包含哪些 preamble sections
  model?: Model;  // behavioral overlay 的 model family。省略/undefined → 无 overlay。
  interactive?: boolean;  // true → 在 preamble 中生成 plan-mode handshake。仅 generator 使用，不写入 SKILL.md。
  /**
   * Build-time compression mode。默认 'default'。
   *
   * - 'default'：按当前方式 ship 完整 preamble prose（writing style、completeness、
   *   confusion protocol、context health 都存在）。
   * - 'terse'：writing-style + completeness + confusion-protocol + context-health
   *   sections 在 gen time 压缩成单行 pointer。每个 tier-2+ skill 节省约 3-5 KB。
   *   通过 `--explain-level=terse` build flag opt-in，适合希望 shipped skills
   *   匹配 runtime preference，并避免每 session terse-mode prose 的用户。
   *
   * Default builds 保留 runtime-conditional behavior（Writing Style section 会说
   * "skip entirely if EXPLAIN_LEVEL: terse appears in preamble echo"）。
   * Terse builds 让 compression 成为 structural，相关 bytes 从一开始就不 ship。
   */
  explainLevel?: 'default' | 'terse';
}

/** Resolver function signature。args 会为 {{INVOKE_SKILL:name}} 这类 parameterized placeholders 填充。 */
export type ResolverFn = (ctx: TemplateContext, args?: string[]) => string;

/**
 * Optional gated resolver。gate 返回 false 时，resolver 会被跳过（替换为空字符串），
 * 效果等同于 placeholder 未被引用。当某个 resolver output 只对已知 skill subset
 * 有意义时使用，让未来 template authors 获得 structural guardrail，而不是依赖
 * social knowledge。
 *
 * 大多数 resolvers 不需要它，{{NAME}} placeholder system 在 template level
 * 已经是 conditional。仅当 resolver 位于另一个 resolver 内部（例如 preamble
 * composition），且必须 conditionalize，或 top-level resolver 有小而明确的
 * audience 时使用。
 */
export interface ResolverEntry {
  resolve: ResolverFn;
  appliesTo?: (ctx: TemplateContext) => boolean;
}

/** RESOLVERS map 接受的任意值：bare function 或 gated entry。 */
export type ResolverValue = ResolverFn | ResolverEntry;

/**
 * gen-skill-docs lookup 的 type-narrowing helper。
 * 返回 (resolverFn, gate)，让 callers 可在 invoking 前执行 gate?.(ctx)。
 */
export function unwrapResolver(entry: ResolverValue): {
  resolve: ResolverFn;
  appliesTo?: (ctx: TemplateContext) => boolean;
} {
  if (typeof entry === 'function') return { resolve: entry };
  return { resolve: entry.resolve, appliesTo: entry.appliesTo };
}
