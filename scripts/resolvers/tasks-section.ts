/**
 * Implementation Tasks emission (#1454) 的 resolvers。
 *
 *   {{TASKS_SECTION_EMIT:<phase>}}     — per-skill task emission + JSONL write
 *   {{TASKS_SECTION_AGGREGATE}}        — autoplan aggregation across all phases
 *
 * JSONL artifact 的 schema 位于 scripts/task-emission-schema.ts。
 */

import type { TemplateContext, ResolverFn } from './types';

const VALID_PHASES = new Set(['ceo-review', 'design-review', 'eng-review', 'devex-review']);

export const generateTasksSectionEmit: ResolverFn = (_ctx: TemplateContext, args?: string[]) => {
  const phase = args?.[0];
  if (!phase || !VALID_PHASES.has(phase)) {
    throw new Error(`TASKS_SECTION_EMIT requires one of ${[...VALID_PHASES].join(', ')} — got ${phase}`);
  }

  return `## Implementation Tasks（实现任务）

关闭此 review 前，把上面的 findings 综合成一个 flat list，列出 build-actionable tasks。每个 task 都必须来自具体 finding，不要 padding。
输出 markdown section，并写入一个可供 \`/autoplan\` 跨 phases 聚合的 JSONL artifact。

### Markdown section（始终输出）

\`\`\`markdown
## Implementation Tasks
由此 review 的 findings 综合而来。每个 task 都来自上方某个具体 finding。
用 Claude Code 或 Codex 执行；shipping 时勾选 checkbox。

- [ ] **T1 (P1, human: ~2h / CC: ~15min)** — <component> — <imperative title>
  - 来源：<section name> — <specific finding text or line reference>
  - Files: <paths to touch>
  - Verify：<test command or manual check>
- [ ] **T2 (P2, human: ~30min / CC: ~5min)** — ...
\`\`\`

Rules（规则）：
- P1 会 block ship；P2 应该在同一 branch 落地；P3 是 follow-up TODO。
- 如果某个 finding 没有产生 actionable task，不要 invent one。
- 如果某个 section 是 zero findings，输出 \`_No new tasks from <section>._\`
- Effort 使用 CLAUDE.md 中的 AI-compression table。

### JSONL artifact（始终写入，即使 zero tasks）

\`/autoplan\` 会读取此 file 并跨 phases 聚合。每一行都用 \`jq -nc\` 构造，
这样包含 quotes、newlines 或 backslashes 的 titles/source findings 能正确 serialize。
绝不要 hand-roll \`echo\` / \`printf\`。

\`\`\`bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)"
TASKS_DIR="\${HOME}/.gstack/projects/\${SLUG:-unknown}"
mkdir -p "$TASKS_DIR"
TASKS_FILE="$TASKS_DIR/tasks-${phase}-$(date +%Y%m%d-%H%M%S).jsonl"
COMMIT=$(git rev-parse HEAD 2>/dev/null || echo unknown)
BRANCH=$(git branch --show-current 2>/dev/null || echo unknown)
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"

# 对此 review 中识别出的每个 task 重复一次 jq invocation。
# 用你为每个 task 设置的 shell variables inline 替换 placeholders：
#   TASK_ID (T1, T2, ...), PRIORITY (P1/P2/P3), COMPONENT, TITLE,
#   SOURCE_FINDING, EFFORT_HUMAN, EFFORT_CC, FILES_JSON (a JSON array literal
#   like '["browse/src/sanitize.ts","browse/src/server.ts"]').
jq -nc \\
  --arg phase '${phase}' \\
  --arg run_id "$RUN_ID" \\
  --arg branch "$BRANCH" \\
  --arg commit "$COMMIT" \\
  --arg id "$TASK_ID" \\
  --arg priority "$PRIORITY" \\
  --arg component "$COMPONENT" \\
  --arg effort_human "$EFFORT_HUMAN" \\
  --arg effort_cc "$EFFORT_CC" \\
  --arg title "$TITLE" \\
  --arg source_finding "$SOURCE_FINDING" \\
  --argjson files "$FILES_JSON" \\
  '{phase:$phase, run_id:$run_id, branch:$branch, commit:$commit, id:$id, priority:$priority, component:$component, files:$files, effort_human:$effort_human, effort_cc:$effort_cc, title:$title, source_finding:$source_finding}' \\
  >> "$TASKS_FILE"
\`\`\`

如果未安装 \`jq\`，fallback 为跳过 JSONL write，并 warn 用户安装 jq 以支持 autoplan aggregation。绝不要 hand-roll JSONL。

如果此 review 识别出 zero tasks，仍然 touch JSONL file（\`: > "$TASKS_FILE"\`），
让 aggregator 知道此 phase 在本次 run 中产出过 output（empty file 表示 "ran, no findings"，不同于 "didn't run"）。
`;
};

export const generateTasksSectionAggregate: ResolverFn = (_ctx: TemplateContext) => {
  return `## Implementation Tasks aggregator（实现任务聚合器）

渲染下方 Final Approval Gate output block 前，聚合每个 review skill 写入的 per-phase task lists。

\`\`\`bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)"
TASKS_DIR="\${HOME}/.gstack/projects/\${SLUG:-unknown}"
BRANCH=$(git branch --show-current 2>/dev/null || echo unknown)
# Commit window：此 branch 最近 5 个 commits。丢弃 stale standalone reviews。
COMMITS_RECENT=$(git log --format=%H -n 5 2>/dev/null | tr '\\n' '|' | sed 's/|$//')

AGGREGATED_TASKS=""
if command -v jq >/dev/null 2>&1; then
  # 收集 4 个 phases 的 entries，并限定在 current branch + commit window。
  # 每个 phase 只保留 latest run_id。在保留下来的集合中，
  # 按 (component, sorted(files), title) dedupe — 仅 exact match。
  # 先按 priority (P1 > P2 > P3) 排序，再按 phase order 排序。
  ALL_JSONL=$(mktemp -t autoplan-tasks.XXXXXXXX)
  for phase in ceo-review design-review eng-review devex-review; do
    # 使用 find 而不是 glob expansion。否则当某个 phase 没有 JSONL files 时，
    # zsh nomatch 会报错。按 name 排序保持顺序稳定。
    while IFS= read -r f; do
      [ -f "$f" ] || continue
      # 过滤到 current branch + recent commits，然后仅保留 latest run_id 的 records。
      # 如果用户 re-run review，同一个 phase 可能有多个 files；aggregator 取最新。
      jq -c --arg branch "$BRANCH" --arg commits "$COMMITS_RECENT" \\
        'select(.branch == $branch and ($commits | split("|") | index(.commit) != null))' \\
        "$f" 2>/dev/null >> "$ALL_JSONL" || true
    done < <(find "$TASKS_DIR" -maxdepth 1 -name "tasks-$phase-*.jsonl" 2>/dev/null | sort)
    # Reduce：每个 phase 仅保留 latest run_id
    if [ -s "$ALL_JSONL" ]; then
      jq -sc --arg phase "$phase" \\
        '[.[] | select(.phase == $phase)] | (max_by(.run_id) // null) as $latest_run | if $latest_run then map(select(.run_id == $latest_run.run_id)) else [] end | .[]' \\
        "$ALL_JSONL" > "$ALL_JSONL.phase" 2>/dev/null || true
      # Replace with reduced version for this phase, accumulating others
      jq -c --arg phase "$phase" 'select(.phase != $phase)' "$ALL_JSONL" > "$ALL_JSONL.other" 2>/dev/null || true
      cat "$ALL_JSONL.other" "$ALL_JSONL.phase" > "$ALL_JSONL"
      rm -f "$ALL_JSONL.phase" "$ALL_JSONL.other"
    fi
  done

  # 按 (component, sorted(files), title) exact-match dedup。Non-matches 保留，
  # renderer 会注入 possible-duplicate marker。
  AGGREGATED_TASKS=$(jq -s \\
    'group_by([.component, (.files | sort), .title])
     | map(
         # 每组取 highest-priority entry；tie-break 使用 phase order
         sort_by({P1:0,P2:1,P3:2}[.priority] // 99, {"ceo-review":0,"design-review":1,"eng-review":2,"devex-review":3}[.phase] // 99) | .[0]
       )
     | sort_by({P1:0,P2:1,P3:2}[.priority] // 99, {"ceo-review":0,"design-review":1,"eng-review":2,"devex-review":3}[.phase] // 99)
     | if length == 0 then "_No actionable tasks emitted from any phase._" else
         map("- [ ] **\\(.id) (\\(.priority), human: \\(.effort_human) / CC: \\(.effort_cc)) — \\(.component)** — \\(.title)\\n  - Surfaced by: \\(.phase) — \\(.source_finding)\\n  - Files: \\(.files | join(", "))") | join("\\n")
       end' "$ALL_JSONL" 2>/dev/null | sed 's/^"//;s/"$//;s/\\\\n/\\n/g')
  rm -f "$ALL_JSONL"
else
  AGGREGATED_TASKS="_未安装 jq — 请安装 jq 以聚合 per-phase task lists。已跳过。_"
fi
\`\`\`

在下方 Final Approval Gate output template 中，把 aggregated markdown 渲染到
\`### Implementation Tasks (aggregated across phases)\` section。
打印给用户前，用上方 bash variable \`$AGGREGATED_TASKS\` 的内容替换。
这不是 template placeholder；由 agent 在 runtime 替换，不是 gen-skill-docs 在 build time 替换。

如果 \`$AGGREGATED_TASKS\` 为空（没有找到 JSONL files，即此 session 没有运行任何 review skills），渲染：

\`_在 $TASKS_DIR 中未找到 branch $BRANCH 的 per-phase task lists。每个 review
skill 会写入自己的 list；如果你运行过其中一个但这里没有 list，请检查
jq 是否已安装，以及 tasks-<phase>-*.jsonl files 是否存在。_\`
`;
};
