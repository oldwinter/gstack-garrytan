/**
 * Section resolvers（v2 plan T9，Claude-first carve）。
 *
 * Carved skill 把 prose-heavy steps 放在 `<skill>/sections/<id>.md` 中，按需读取。
 * 同一个 template 会分发到所有 host，因此这些 resolvers 要保持 host-aware：
 *
 *  - 在 CLAUDE：{{SECTION:id}} 生成指向 generated section file 的 STOP-Read pointer
 *    （skeleton 中的指令），section .md 会单独生成并安装。
 *  - 在其他 host：{{SECTION:id}} inline section template content，让 external hosts
 *    保持完整 monolith ship skill（没有 section files，也没有 host-portable-path 问题）。
 *    Inlined content 保留自身的 {{RESOLVER}} tokens，由 generator 的 multi-pass resolve 展开。
 *
 * {{SECTION_INDEX:skill}} 在 Claude 上从 PASSIVE manifest 渲染 situation→section table
 * （其他 host 为空，因为它们没有 sections）。Manifest 是 id/file/title/trigger text 的
 * single source of truth（CM2；v2_PLAN.md:663）。
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ResolverFn, TemplateContext } from './types';

const ROOT = path.resolve(import.meta.dir, '..', '..');

interface SectionEntry {
  id: string;
  file: string;
  title: string;
  trigger: string;
}
interface SectionManifest {
  skill: string;
  sections: SectionEntry[];
}

function loadManifest(skill: string): SectionManifest {
  const p = path.join(ROOT, skill, 'sections', 'manifest.json');
  const raw = fs.readFileSync(p, 'utf-8');
  return JSON.parse(raw) as SectionManifest;
}

function findSection(skill: string, id: string): SectionEntry {
  const entry = loadManifest(skill).sections.find(s => s.id === id);
  if (!entry) {
    throw new Error(`{{SECTION:${id}}} — no section "${id}" in ${skill}/sections/manifest.json`);
  }
  return entry;
}

/**
 * {{SECTION:id}} — pointer on Claude, inline on other hosts.
 * Claude path uses the stable gstack-root install (`{skillRoot}/{skill}/sections/`),
 * which always exists, instead of a naked relative path (Codex outside-voice #7).
 */
export const SECTION: ResolverFn = (ctx: TemplateContext, args?: string[]): string => {
  const id = args?.[0];
  if (!id) throw new Error('{{SECTION:id}} requires a section id');
  const entry = findSection(ctx.skillName, id);

  if (ctx.host === 'claude') {
    const sectionPath = `${ctx.paths.skillRoot}/${ctx.skillName}/sections/${entry.file}`;
    return [
      `> **STOP.** 在 ${entry.trigger} 之前，Read \`${sectionPath}\` 并完整执行它。`,
      `> 不要凭 memory 操作：该 section 是此 step 的 source of truth。`,
    ].join('\n');
  }

  // Non-Claude hosts inline section template content（保留 monolith）。
  // Inner {{RESOLVER}} tokens 由 generator 的 multi-pass resolve 展开。
  const tmplPath = path.join(ROOT, ctx.skillName, 'sections', `${entry.file}.tmpl`);
  return fs.readFileSync(tmplPath, 'utf-8').trimEnd();
};

/**
 * {{SECTION_INDEX:skill}} — situation→section table from the passive manifest.
 * Claude only; other hosts inline everything so an index would be noise.
 */
export const SECTION_INDEX: ResolverFn = (ctx: TemplateContext, args?: string[]): string => {
  if (ctx.host !== 'claude') return '';
  const skill = args?.[0] ?? ctx.skillName;
  const manifest = loadManifest(skill);
  const lines: string[] = [
    '## Section index — 情况适用时读取对应 section',
    '',
    '此 skill 是 decision-tree skeleton。下面的 steps 指向按需读取的 sections。',
    '执行某个 step 前，先完整读取对应 section；不要凭 memory 操作。',
    '',
    '| 何时 | 读取此 section |',
    '|------|-------------------|',
  ];
  for (const s of manifest.sections) {
    lines.push(`| ${s.trigger} | \`sections/${s.file}\` |`);
  }
  return lines.join('\n');
};
