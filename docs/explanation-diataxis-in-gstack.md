# 为什么 gstack 用 Diataxis 做 documentation

gstack 中两个 doc skills，`/document-release` 和 `/document-generate`，都使用 Diataxis。新的 entities 会按四个 quadrants 打分。Coverage gaps 会按 quadrant 标注并出现在 PR bodies 中。本文解释为什么这套 vocabulary 是 load-bearing，以及为什么更简单的 "just write markdown" approach 在 gstack 的规模下会失效。

## 问题

Documentation 腐化是最容易被忽略的腐化。Code 停止 compile，你会立刻注意到。Test fail，CI 会大叫。Docs 会静默 stale：README 仍能 parse，install command 仍能 copy-paste，唯一 signal 是几周后 confused user file issue，或者悄悄离开。

gstack 有超过 45 个 skills。每个都是一个 SKILL.md 加一个 `.tmpl` template，理想情况下还要有某处的 getting-started tutorial，以及解释它为何如此工作的 explanation。再乘以 gstack users 在自己 projects 中类似的 surface-area，maintenance load 就很真实。

Naive failure mode 是“每个 team 用自己的格式写 docs”。一个 project 有 Wiki，另一个有 nested README files，第三个只有 reference-only API docs、没有 tutorials，第四个 tutorials 已经无法 compile。你无法写 tooling 横跨这些全部 audit，因为没有 shared vocabulary 来定义 good coverage。

第二个 failure mode 更 subtle：即使 team 很 disciplined，他们也倾向于写符合当下心态的 doc。Build mode 的 engineers 写 reference，launch mode 的 engineers 写 tutorials，maintenance mode 的 engineers 写 troubleshooting how-tos。没人醒来会说 “today I'll write the explanation doc for why we chose this architecture”，所以 explanation rot 累积最快。

## 方法

Diataxis（Daniele Procida，最早在 Divio，如今被 CPython、Django、NumPy、FastAPI、GitHub docs 等采用）按 **reader intent** 把 documentation 分成四个 quadrants：

```
                    THEORETICAL                        PRACTICAL
                    (understanding)                    (doing)

  STUDY            +-----------------------------+----------------------------+
  (learning)       |                             |                            |
                   |   EXPLANATION               |   TUTORIAL                 |
                   |   "Why does X exist?"       |   "Walk me through X       |
                   |                             |    for the first time"     |
                   |   discusses code            |   teaches code             |
                   |                             |                            |
                   +-----------------------------+----------------------------+

  WORK             +-----------------------------+----------------------------+
  (using)          |                             |                            |
                   |   REFERENCE                 |   HOW-TO                   |
                   |   "What is the exact        |   "How do I accomplish Y   |
                   |    signature of Y?"         |    using X?"               |
                   |                             |                            |
                   |   describes code            |   uses code                |
                   |                             |                            |
                   +-----------------------------+----------------------------+
```

Tutorial mode 中的 reader 通过 doing 来 learn。他们想要一条 guaranteed success 的 guided path。How-to mode 中的 reader 已经知道 basics，想要完成 specific task 的 recipe。Reference mode 中的 reader 想要 accurate、complete、fact-table coverage of the API。Explanation mode 中的 reader 想理解 design decision。

同一个人在不同时间会以不同 modes 阅读同一个 project。同一段 paragraph 无法服务四种需求：tutorials 需要 handholding，这会拖慢 reference reader；reference 需要 completeness，这会 overwhelm tutorial reader。

## 为什么这对 coverage lens 很重要

用 Diataxis terms 写成的 coverage map 能 deterministic 地回答 “did docs get updated?”。它问的不是“有没有 README”，而是“这个 new skill 有没有 tutorial，common task 有没有 how-to，API 有没有 reference，non-obvious design choice 有没有 explanation？”

`/document-release` Step 1.5 会遍历 diff，extract new public surface（skills、CLI flags、config options、API endpoints），并按四个 quadrants 为每个 entity score。Zero coverage items 会成为 **critical gaps**。Only-reference coverage items（gstack 自己历史中最常见的 failure mode）会成为 **common gaps**。两者都会落进 PR body，让 reviewers 看到。

`/document-generate` 会有意按四个 quadrants 写 docs。它拒绝混合它们：tutorial 不会有 "Configuration" section，reference doc 不会有 "What you'll build" paragraph。Skill 的 9 steps 按 reference -> explanation -> how-to -> tutorial 顺序执行，因为这个顺序匹配 dependency：reference 固定 vocabulary，explanation justify design，how-tos 构建在两者之上，tutorials 最后且最难。

## 权衡

**Diataxis 增加了 readers 必须学习的 vocabulary。** 没听过 "reference vs explanation" 的 user 起初可能觉得 labels strange。Mitigation 是：Diataxis labels 看过一次就 self-explanatory，而且 labels 不会出现在 docs themselves 中，只出现在 coverage map 和 PR body 中，供 reviewers 使用，不面向 end users。

**Four files instead of one。** Small skill 可能有一个混合四种 modes 的 `docs/SKILL.md` file。Diataxis 会把它拆成四个。Mitigation：AI generation 让 four-file structure 很便宜，quadrants 之间的 cross-linking 是 mechanical（每个 reference doc 链到它的 how-to，每个 how-to 链到它的 reference 等），而 audit-ability gains 很大：`/document-release` 可以自动 score coverage。

**Diataxis 不是唯一好 framework。** "Every page is page one"（Mark Baker）、*Write the Docs* community 中的 four kinds of docs、Google developer documentation style guide 都有不同 cuts。gstack 选择 Diataxis，是因为它 external adoption 最强（CPython、Django、NumPy、FastAPI 等），这意味着 downstream users 最可能见过这套 vocabulary，而且 quadrant labels 能 cleanly translate 成 coverage-map signals。

## 考虑过的替代方案

**"Just write README sections."** 在 gstack 历史中隐式尝试过。Failure mode：tutorials 累积在 README 中，直到 README 超过 800 行，没人读到第 50 行之后。Diataxis 把它们拆成 dedicated files，每个都能从 README table of contents discover。

**Custom in-house taxonomy。** 很诱人，因为它可以 tailored。Rejected，因为每个 team 都会发明自己的 vocabulary，`/document-release` 会失去 cross-project audit power。Diataxis 是 lingua franca。

**Auto-generated reference only。** 很多 projects 通过 JSDoc / TypeDoc / Sphinx 之类工具试过。没有 explanation 的 reference docs 对 newcomers 来说 impenetrable；没有 tutorials，API 很难 onboard。Reference 必要，但不充分。

**完全没有 documentation framework，只靠 gut-check。** 大多数 projects 的 status quo。会 silent fail：users 会离开而不是 file issues，feedback loop 因而 broken。Diataxis 在 users complain 前就给出 structured signal。

## 相关

- **实现该能力的 skill reference：** [`document-generate/SKILL.md`](../document-generate/SKILL.md)
- **使用该 taxonomy 的 audit reference：** [`document-release/SKILL.md`](../document-release/SKILL.md)
- **使用 `/document-generate` 的 tutorial：** [`tutorial-document-generate.md`](./tutorial-document-generate.md)
- **How-to：document a shipped feature：** [`howto-document-a-shipped-feature.md`](./howto-document-a-shipped-feature.md)
- **Diataxis homepage：** https://diataxis.fr/，Procida 对该 framework 的 canonical reference
