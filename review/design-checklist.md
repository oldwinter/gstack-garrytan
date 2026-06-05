# Design Review Checklist（轻量版）

> **DESIGN_METHODOLOGY 的子集**：在这里添加条目时，也要同步更新 `scripts/gen-skill-docs.ts` 中的 `generateDesignMethodology()`，反之亦然。

## 使用说明

此 checklist 适用于 **diff 中的源代码**，不是渲染后的输出。阅读每个已变更的前端文件（完整文件，不只是 diff hunk），并标记 anti-patterns。

**触发条件：**只有 diff 触碰前端文件时才运行此 checklist。使用 `gstack-diff-scope` 检测：

```bash
source <(~/.claude/skills/gstack/bin/gstack-diff-scope <base> 2>/dev/null)
```

如果 `SCOPE_FRONTEND=false`，静默跳过整个 design review。

**DESIGN.md 校准：**如果 repo root 存在 `DESIGN.md` 或 `design-system.md`，先阅读它。所有 findings 都要按项目声明的 design system 校准。DESIGN.md 中明确认可的 pattern 不要标记。如果没有 DESIGN.md，则使用通用设计原则。

---

## Confidence Tiers（置信度分层）

每个条目都带有一个检测置信度：

- **[HIGH]**：可通过 grep / pattern match 稳定检测。属于明确 findings。
- **[MEDIUM]**：可通过 pattern aggregation 或 heuristic 检测。作为 findings 标记，但预期会有一些噪音。
- **[LOW]**：需要理解视觉意图。呈现为：`Possible issue — verify visually or run /design-review.`（保留 exact output）

---

## Classification（分类）

**AUTO-FIX**（仅限机械 CSS 修复：HIGH confidence，不需要设计判断）：
- `outline: none` 没有替代 focus indicator -> 添加 `outline: revert` 或 `&:focus-visible { outline: 2px solid currentColor; }`
- 新 CSS 中出现 `!important` -> 移除并修复 specificity
- body text 的 `font-size` < 16px -> 提升到 16px

**ASK**（其余所有项：需要设计判断）：
- 所有 AI slop findings、typography structure、spacing choices、interaction state gaps、DESIGN.md violations

**LOW confidence items** -> 呈现为 `Possible: [description]. Verify visually or run /design-review.`（保留 exact output）。永远不要 AUTO-FIX。

---

## Output Format（输出格式）

```
Design Review: N issues (X auto-fixable, Y need input, Z possible)

**AUTO-FIXED:**
- [file:line] Problem → fix applied

**NEEDS INPUT:**
- [file:line] Problem description
  Recommended fix: suggested fix

**POSSIBLE (verify visually):**
- [file:line] Possible issue — verify with /design-review
```

可选：`test_stub`，使用项目测试框架为此 finding 编写的 skeleton test code。

如果没有 issues found：`Design Review: No issues found.`（保留 exact output）

如果没有 frontend files changed：静默 skip，无 output。

---

## Categories（类别）

### 1. AI Slop Detection（6 项，最高优先级）

这些是 AI-generated UI 的典型迹象，任何严肃 studio 的 designer 都不会直接 ship。

- **[MEDIUM]** Purple / violet / indigo gradient backgrounds，或 blue-to-purple color schemes。查找 `linear-gradient`，其值落在 `#6366f1` 到 `#8b5cf6` 范围内，或解析为 purple / violet 的 CSS custom properties。

- **[LOW]** 三列 feature grid：icon-in-colored-circle + bold title + 2-line description，以对称方式重复 3 次。查找恰好有 3 个 children 的 grid / flex container，且每个 child 都包含 circular element + heading + paragraph。

- **[LOW]** 把 colored circles 中的 icons 当作 section decoration。查找 `border-radius: 50%` + background color，且该元素只是 icon 的装饰容器。

- **[HIGH]** Everything centered：所有 headings、descriptions 和 cards 都使用 `text-align: center`。grep `text-align: center` 密度；如果 >60% text containers 使用居中对齐，标记它。

- **[MEDIUM]** 每个元素都使用统一的 bubbly border-radius：cards、buttons、inputs、containers 全都套用相同的大 radius（16px+）。汇总 `border-radius` 值；如果 >80% 使用同一个 >=16px 的值，标记它。

- **[MEDIUM]** Generic hero copy：`Welcome to [X]`、`Unlock the power of...`、`Your all-in-one solution for...`、`Revolutionize your...`、`Streamline your workflow`。在 HTML / JSX content 中 grep 这些 patterns。

### 2. Typography（4 项）

- **[HIGH]** Body text 的 `font-size` < 16px。grep `body`、`p`、`.text` 或 base styles 上的 `font-size` declarations。低于 16px 的值（或 base 为 16px 时低于 1rem）都要标记。

- **[HIGH]** diff 中引入超过 3 个 font families。统计不同的 `font-family` declarations。如果 changed files 中出现 >3 个 unique families，标记它。

- **[HIGH]** Heading hierarchy 跳级：同一个 file / component 中，`h1` 后直接出现 `h3`，没有 `h2`。检查 HTML / JSX 中的 heading tags。

- **[HIGH]** Blacklisted fonts：Papyrus、Comic Sans、Lobster、Impact、Jokerman。grep `font-family` 中是否出现这些名字。

### 3. Spacing & Layout（4 项）

- **[MEDIUM]** 当 DESIGN.md 指定 spacing scale 时，出现不在 4px 或 8px scale 上的 arbitrary spacing values。根据声明的 scale 检查 `margin`、`padding`、`gap` 值。只有 DESIGN.md 定义了 scale 时才标记。

- **[MEDIUM]** Fixed widths 且没有 responsive handling：container 上有 `width: NNNpx`，但没有 `max-width` 或 `@media` breakpoints。移动端有 horizontal scroll 风险。

- **[MEDIUM]** Text containers 缺少 `max-width`：body text 或 paragraph containers 没有设置 `max-width`，导致行长可能 >75 characters。检查 text wrappers 上的 `max-width`。

- **[HIGH]** 新 CSS rules 中出现 `!important`。在新增行中 grep `!important`。这几乎总是 specificity escape hatch，应正确修复。

### 4. Interaction States（3 项）

- **[MEDIUM]** Interactive elements（buttons、links、inputs）缺少 hover / focus states。检查新的 interactive element styles 是否包含 `:hover`、`:focus` 或 `:focus-visible` pseudo-classes。

- **[HIGH]** `outline: none` 或 `outline: 0` 没有替代 focus indicator。grep `outline:\s*none` 或 `outline:\s*0`。这会移除 keyboard accessibility。

- **[LOW]** Interactive elements 的 touch targets < 44px。检查 buttons 和 links 上的 `min-height` / `min-width` / `padding`。需要从多个属性计算 effective size，仅凭代码判断时 confidence 较低。

### 5. DESIGN.md Violations（3 项，条件触发）

只有存在 `DESIGN.md` 或 `design-system.md` 时才应用：

- **[MEDIUM]** 颜色不在声明的 palette 中。将 changed CSS 中的 color values 与 DESIGN.md 定义的 palette 对比。

- **[MEDIUM]** Fonts 不在声明的 typography section 中。将 `font-family` 值与 DESIGN.md 的 font list 对比。

- **[MEDIUM]** Spacing values 超出声明的 scale。将 `margin` / `padding` / `gap` 值与 DESIGN.md 的 spacing scale 对比。

---

## Suppressions（抑制规则）

不要标记：
- DESIGN.md 中明确记录为 intentional choices 的 patterns
- Third-party / vendor CSS files（node_modules、vendor directories）
- CSS resets 或 normalize stylesheets
- Test fixture files
- Generated / minified CSS
