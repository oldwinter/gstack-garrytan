/**
 * Model overlay resolver — reads model-overlays/{model}.md and returns it
 * wrapped in a subordinate behavioral-patch section.
 *
 * Precedence:
 *   1. Exact match: ctx.model === 'gpt-5.4' → reads model-overlays/gpt-5.4.md
 *   2. INHERIT directive: if the file's first non-whitespace line is
 *      `{{INHERIT:claude}}`, the resolver reads model-overlays/claude.md first
 *      and concatenates it ahead of the rest of this file's content.
 *      This lets `gpt-5.4.md` build on top of `gpt.md` without duplication.
 *   3. Missing file: returns empty string (graceful degradation, no error).
 *   4. No ctx.model set: returns empty string.
 *
 * The returned block is subordinate to skill workflow, safety gates, and
 * AskUserQuestion instructions. The subordination language is part of the
 * wrapper heading so it appears with every overlay regardless of file content.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { TemplateContext } from './types';

const OVERLAY_DIR = path.resolve(import.meta.dir, '../../model-overlays');

const INHERIT_RE = /^\s*\{\{INHERIT:([a-z0-9-]+(?:\.[0-9]+)*)\}\}\s*\n/;

export function readOverlay(model: string, seen: Set<string> = new Set()): string {
  if (seen.has(model)) return ''; // cycle guard
  seen.add(model);

  const filePath = path.join(OVERLAY_DIR, `${model}.md`);
  if (!fs.existsSync(filePath)) return '';

  const raw = fs.readFileSync(filePath, 'utf-8');
  const match = raw.match(INHERIT_RE);
  if (!match) return raw.trim();

  const baseModel = match[1];
  const base = readOverlay(baseModel, seen);
  const rest = raw.replace(INHERIT_RE, '').trim();

  if (!base) return rest;
  return `${base}\n\n${rest}`;
}

export function generateModelOverlay(ctx: TemplateContext): string {
  if (!ctx.model) return '';

  const content = readOverlay(ctx.model);
  if (!content) return '';

  return `## Model-Specific Behavioral Patch (${ctx.model})（模型专属行为补丁）

以下 nudges 针对 ${ctx.model} model family 调整。它们**从属于** skill workflow、
STOP points、AskUserQuestion gates、plan-mode safety 和 /ship review gates。
如果下面的 nudge 与 skill instructions 冲突，以 skill 为准。把这些视为偏好，而不是规则。

${content}`;
}
