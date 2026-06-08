import type { TemplateContext } from './types';

/**
 * {{INVOKE_SKILL:skill-name}} — emits prose instructing Claude to read
 * another skill's SKILL.md and follow it, skipping preamble sections.
 *
 * Supports optional skip= parameter for additional sections to skip:
 *   {{INVOKE_SKILL:plan-ceo-review:skip=Outside Voice,Design Outside Voices}}
 */
export function generateInvokeSkill(ctx: TemplateContext, args?: string[]): string {
  const skillName = args?.[0];
  if (!skillName || skillName === '') {
    throw new Error('{{INVOKE_SKILL}} requires a skill name, e.g. {{INVOKE_SKILL:plan-ceo-review}}');
  }

  // Parse optional skip= parameter from args[1+]
  const extraSkips = (args?.slice(1) || [])
    .filter(a => a.startsWith('skip='))
    .flatMap(a => a.slice(5).split(','))
    .map(s => s.trim())
    .filter(Boolean);

  const DEFAULT_SKIPS = [
    'Preamble (run first)',
    'AskUserQuestion Format',
    'Completeness Principle — Boil the Ocean',
    'Search Before Building',
    'Contributor Mode',
    'Completion Status Protocol',
    'Telemetry (run last)',
    'Step 0: Detect platform and base branch',
    'Review Readiness Dashboard',
    'Plan File Review Report',
    'Prerequisite Skill Offer',
    'Plan Status Footer',
  ];

  const allSkips = [...DEFAULT_SKIPS, ...extraSkips];

  return `使用 Read 工具读取 \`/${skillName}\` skill 文件：\`${ctx.paths.skillRoot}/${skillName}/SKILL.md\`。

**如果无法读取：**用 "Could not load /${skillName} — skipping." 跳过并继续。

从上到下执行其中的说明，**跳过以下 sections**（父级 skill 已处理）：
${allSkips.map(s => `- ${s}`).join('\n')}

其他 section 都要完整执行。加载的 skill 说明执行完后，继续下面的下一步。`;
}
