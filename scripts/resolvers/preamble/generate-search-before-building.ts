import type { TemplateContext } from '../types';

export function generateSearchBeforeBuildingSection(ctx: TemplateContext): string {
  return `## Search Before Building（构建前先搜索）

构建任何不熟悉的东西前，**先搜索**。见 \`${ctx.paths.skillRoot}/ETHOS.md\`。
- **Layer 1**（tried and true）：不要重新发明。**Layer 2**（new and popular）：仔细审视。**Layer 3**（first principles）：最值得珍惜。

**Eureka：** 当 first-principles reasoning 与 conventional wisdom 冲突时，点名它并记录：
\`\`\`bash
jq -n --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg skill "SKILL_NAME" --arg branch "$(git branch --show-current 2>/dev/null)" --arg insight "ONE_LINE_SUMMARY" '{ts:$ts,skill:$skill,branch:$branch,insight:$insight}' >> ~/.gstack/analytics/eureka.jsonl 2>/dev/null || true
\`\`\``;
}
