/**
 * Confidence calibration resolver（置信度校准 resolver）
 *
 * 为 review-producing skills 添加 confidence scoring rubric。
 * 每个 finding 都包含 1-10 score，用于 gate display：
 *   7+: 正常展示
 *   5-6: 带 caveat 展示
 *   <5: 从 main report suppress
 *
 * Pre-emit verification gate (#1539)：没有 quoted code snippet 的 findings
 * 会被强制设为 confidence 4-5，让 existing suppression rule 自动触发。
 * 它会消灭成熟框架（Django/Rails 等）上的 "field doesn't exist on the model"
 * FP class；model code 能在 <5min 内 resolve，而 gate 会强制 reviewer 在把
 * finding promote 到 report 前完成该 lookup。
 */
import type { TemplateContext } from './types';

export function generateConfidenceCalibration(_ctx: TemplateContext): string {
  return `## Confidence Calibration（置信度校准）

每个 finding 都必须包含 confidence score（1-10）：

| Score | Meaning（含义） | Display rule（展示规则） |
|-------|---------|-------------|
| 9-10 | 已通过阅读 specific code 验证。已证明 concrete bug 或 exploit。 | 正常展示 |
| 7-8 | High confidence pattern match。非常可能正确。 | 正常展示 |
| 5-6 | Moderate。可能是 false positive。 | 带 caveat 展示："Medium confidence, verify this is actually an issue" |
| 3-4 | Low confidence。Pattern suspicious，但可能没问题。 | 从 main report suppress。仅放入 appendix。 |
| 1-2 | Speculation。 | 仅当 severity 会是 P0 时报告。 |

**Finding format（发现格式）：**

\\\`[SEVERITY] (confidence: N/10) file:line — description\\\`

Example:
\\\`[P1] (confidence: 9/10) app/models/user.rb:42 — SQL injection via string interpolation in where clause\\\`
\\\`[P2] (confidence: 5/10) app/controllers/api/v1/users_controller.rb:18 — Possible N+1 query, verify with production logs\\\`

### Pre-emit verification gate（#1539 — 消灭 "field doesn't exist" FP class）

任何 finding promote 到 report 之前，此 gate 要求：

1. **Quote 触发 finding 的 specific code line** — file:line 加触发它的 line(s)
   的 verbatim text。如果 finding 是 "field X doesn't exist on model Y"，
   quote class Y 中该 field 应该存在的位置。如果是 "dict.get() might return None"，
   quote dict initialization。如果是 "race condition between A and B"，quote A 和 B。

2. **如果无法 quote motivating line(s)，该 finding 就是 unverified。**
   强制将 confidence 设为 4-5（从 main report suppress）。它仍进入 appendix，
   方便 reviewers audit calibration，但用户不会在 critical-pass output 中看到它。
   不要通过编造 speculative confidence 7+ 绕过此规则；那会击败 gate。

**Framework-meta nudge：** 当 symbol 由 framework metaclass、descriptor、
ORM Meta inner-class 或 migration history 生成时（Django \`Meta\`、Rails
\`has_many\`/\`scope\`、SQLAlchemy \`relationship\`/\`Column\`、TypeORM decorators、
Sequelize \`init\`/\`belongsTo\`、Prisma generated client），quote meta-construct
（\`Meta\` block、migration、decorator、schema file），而不是期待 class body 中出现
literal name。Verification 是 "I read the source that creates this symbol"，
不是 "I grep'd for the name and didn't find it." 更深的 framework-aware verification
（model introspection、migration-history-aware checks、ORM dialect detection）有意不属于
lighter gate 的 scope；见 deferred
\`~/.gstack-dev/plans/1539-framework-aware-review.md\` design doc。

此 gate 消灭的 FP classes（基于 Django Sprint 2.5 #1539 测量）：

| FP class | 为什么 gate 能抓住它 |
|---|---|
| "field doesn't exist on model" | 要求 quote model class body 或 Meta；field 是否缺失会变得 obvious |
| "dict.get() might be None" | 要求 quote dict initialization（例如 Django form 的 \`cleaned_data\` 以 \`{}\` 初始化） |
| "save() might lose fields" | 要求 quote ORM signature 或 model definition |
| "update_fields might miss X" | 要求 quote field set；如果 X 不存在，FP 会 self-evident |

**Calibration learning（校准学习）：** 如果你报告了 confidence < 7 的 finding，
且用户确认它确实是真 issue，这就是 calibration event。你的 initial confidence 太低。
把 corrected pattern 记录为 learning，让 future reviews 以更高 confidence 抓住它。`;
}
