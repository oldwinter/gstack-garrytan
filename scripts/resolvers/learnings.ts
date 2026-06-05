/**
 * Learnings resolver — cross-skill institutional memory
 *
 * Learnings are stored per-project at ~/.gstack/projects/{slug}/learnings.jsonl.
 * Each entry is a JSONL line with: ts, skill, type, key, insight, confidence,
 * source, branch, commit, files[].
 *
 * Storage is append-only. Duplicates (same key+type) are resolved at read time
 * by gstack-learnings-search ("latest winner" per key+type).
 *
 * Cross-project discovery is opt-in. The resolver asks the user once via
 * AskUserQuestion and persists the preference via gstack-config.
 */
import type { TemplateContext } from './types';

// Whitelist for query= macro values. Allows alphanumeric, space, hyphen, underscore.
// Anything else (e.g. $, backticks, quotes, ;) is a shell-injection vector when the
// emitted bash interpolates the value into `--query "${queryArg}"`. Static template
// queries hand-written in gstack are safe, but the resolver API must defend against
// future contributors writing dangerous values.
const QUERY_SAFE_RE = /^[A-Za-z0-9 _-]+$/;

export function generateLearningsSearch(ctx: TemplateContext, args?: string[]): string {
  // Parse query= arg. Empty value falls through to no-query (principle of least surprise:
  // a stray {{LEARNINGS_SEARCH:query=}} placeholder gets today's behavior, not a build error).
  const queryArg = (args || [])
    .filter(a => a.startsWith('query='))
    .map(a => a.slice(6))
    .filter(Boolean)[0];
  if (queryArg && !QUERY_SAFE_RE.test(queryArg)) {
    throw new Error(
      `{{LEARNINGS_SEARCH:query=...}} value must match ${QUERY_SAFE_RE} (alphanumeric, space, hyphen, underscore). Got: ${JSON.stringify(queryArg)}`
    );
  }
  const queryFlag = queryArg ? ` --query "${queryArg}"` : '';

  if (ctx.host === 'codex') {
    // Codex: simpler version, no cross-project, uses $GSTACK_BIN
    return `## Prior Learnings（历史 learnings）

搜索此 project 先前 sessions 中的相关 learnings：

\`\`\`bash
$GSTACK_BIN/gstack-learnings-search --limit 10${queryFlag} 2>/dev/null || true
\`\`\`

如果找到 learnings，将其纳入分析。当 review finding 匹配 past learning 时，注明："Prior learning applied: [key] (confidence N, from [date])"`;
  }

  return `## Prior Learnings（历史 learnings）

搜索先前 sessions 中的相关 learnings：

\`\`\`bash
_CROSS_PROJ=$(${ctx.paths.binDir}/gstack-config get cross_project_learnings 2>/dev/null || echo "unset")
echo "CROSS_PROJECT: $_CROSS_PROJ"
if [ "$_CROSS_PROJ" = "true" ]; then
  ${ctx.paths.binDir}/gstack-learnings-search --limit 10${queryFlag} --cross-project 2>/dev/null || true
else
  ${ctx.paths.binDir}/gstack-learnings-search --limit 10${queryFlag} 2>/dev/null || true
fi
\`\`\`

如果 \`CROSS_PROJECT\` 是 \`unset\`（第一次）：使用 AskUserQuestion：

> gstack 可以搜索这台机器上其他 projects 的 learnings，寻找可能适用于这里的 patterns。
> 这只在 local 发生（没有 data 离开你的机器）。推荐 solo developers 使用。
> 如果你同时处理多个 client codebases，担心 cross-contamination，可以跳过。

Options:
- A) 启用 cross-project learnings（recommended）
- B) Learnings 仅保持 project-scoped

如果选择 A：运行 \`${ctx.paths.binDir}/gstack-config set cross_project_learnings true\`
如果选择 B：运行 \`${ctx.paths.binDir}/gstack-config set cross_project_learnings false\`

然后使用合适的 flag 重新运行 search。

如果找到 learnings，将其纳入分析。当 review finding 匹配 past learning 时，显示：

**"Prior learning applied: [key] (confidence N/10, from [date])"**

这样会让 compounding 可见。用户应该看到 gstack 正在随着时间推移更了解他们的 codebase。`;
}

export function generateLearningsLog(ctx: TemplateContext): string {
  const binDir = ctx.host === 'codex' ? '$GSTACK_BIN' : ctx.paths.binDir;

  return `## Capture Learnings（记录 learnings）

如果你在本 session 中发现了非显而易见的 pattern、pitfall 或 architectural insight，请记录下来供未来 sessions 使用：

\`\`\`bash
${binDir}/gstack-learnings-log '{"skill":"${ctx.skillName}","type":"TYPE","key":"SHORT_KEY","insight":"DESCRIPTION","confidence":N,"source":"SOURCE","files":["path/to/relevant/file"]}'
\`\`\`

**Types：** \`pattern\`（reusable approach）、\`pitfall\`（what NOT to do）、\`preference\`
（user stated）、\`architecture\`（structural decision）、\`tool\`（library/framework insight）、
\`operational\`（project environment/CLI/workflow knowledge）。

**Sources：** \`observed\`（你在代码中发现）、\`user-stated\`（用户告诉你）、
\`inferred\`（AI deduction）、\`cross-model\`（Claude 和 Codex 都同意）。

**Confidence：** 1-10。诚实打分。你在代码中验证过的 observed pattern 是 8-9。
不太确定的 inference 是 4-5。用户明确陈述的 preference 是 10。

**files：** 包含此 learning 引用的具体 file paths。这会启用 staleness detection：如果这些 files 后续被删除，该 learning 可被标记。

**只记录真正的发现。**不要记录 obvious things。不要记录用户已经知道的事情。一个好测试：这个 insight 会在未来 session 中节省时间吗？如果会，就记录。`;
}
