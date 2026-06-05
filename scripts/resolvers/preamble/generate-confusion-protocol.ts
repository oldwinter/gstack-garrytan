import type { TemplateContext } from '../types';

export function generateConfusionProtocol(ctx?: TemplateContext): string {
  if (ctx?.explainLevel === 'terse') return '';
  return `## Confusion Protocol（困惑处理协议）

遇到高风险 ambiguity（architecture、data model、destructive scope、missing context）时，STOP。用一句话指出问题，给出 2-3 个带 tradeoffs 的 options，然后询问。不要把它用于 routine coding 或 obvious changes。`;
}
