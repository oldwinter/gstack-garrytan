/**
 * per-skill Implementation Tasks JSONL artifact（#1454）的 schema reference。
 *
 * 每个 review skill（plan-ceo-review、plan-design-review、plan-eng-review、
 * plan-devex-review）都会在 synthesis step 中为每个 task 写一行 JSONL 到
 * `~/.gstack/projects/$SLUG/tasks-{phase}-{datetime}.jsonl`。
 *
 * `/autoplan` 的 Phase 4 aggregator 读取所有 phase JSONL files，按 branch +
 * commit window 限定范围，用 exact (component, sorted(files), title) 去重，
 * 并在 Final Approval Gate output 内渲染
 * `## Implementation Tasks (aggregated across phases)` section。
 *
 * Wire format：每行一个 JSON object。必须通过 bash 中的 `jq -nc` 构建，绝不要
 * hand-roll echo/printf，因为 task titles 和 source findings 可能包含 quotes、
 * newlines 和 backslashes。
 */

export type TaskPhase = 'ceo-review' | 'design-review' | 'eng-review' | 'devex-review';
export type TaskPriority = 'P1' | 'P2' | 'P3';

/**
 * tasks-{phase}-{datetime}.jsonl 中的一行。除非另有说明，所有 fields 必填。
 */
export interface ImplementationTask {
  /** 产生此 task 的 review phase。 */
  phase: TaskPhase;
  /** 此 phase invocation 的唯一 run identifier（timestamp + pid suffix）。 */
  run_id: string;
  /** review 运行所在 branch。Aggregator 会用它过滤。 */
  branch: string;
  /** review 时的 HEAD commit。Aggregator 会用 commit-window proximity 过滤。 */
  commit: string;
  /** 短 task id，在单个 run_id 内唯一（T1、T2、...）。 */
  id: string;
  priority: TaskPriority;
  /** 粗粒度 component label（例如 `browse/sanitizer`、`auth/login`）。 */
  component: string;
  /** task 触及的 files。Aggregator 会排序并用于 dedup key。 */
  files: string[];
  /** Human-team effort estimate（例如 "2h"、"1 day"）。 */
  effort_human: string;
  /** CC+gstack effort estimate（例如 "15min"）。 */
  effort_cc: string;
  /** imperative form 的 action-oriented title（"Add commandResult-level sanitization"）。 */
  title: string;
  /** 指向触发此 task 的 finding 的 free-text reference。 */
  source_finding: string;
}

/**
 * aggregator 使用的 dedup key。仅当这个 tuple 完全相同（按 `D13 finding 9`）
 * 时，两个 tasks 才会合并为一个。Near-duplicates 会作为 separate tasks 显示，
 * 并附 `possible-duplicate-of: <id>` note。
 */
export function dedupKey(t: Pick<ImplementationTask, 'component' | 'files' | 'title'>): string {
  return JSON.stringify({
    component: t.component,
    files: [...t.files].sort(),
    title: t.title,
  });
}
