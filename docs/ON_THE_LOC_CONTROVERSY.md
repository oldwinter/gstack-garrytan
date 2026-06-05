# 关于 LOC 争议

或者说：当我提到自己 shipped 了多少 lines of code 后发生了什么，以及数字实际说明了什么。

## 批评是对的。但这不重要。

LOC 是垃圾 metric。每个 senior engineer 都知道。Dijkstra 在 1988 年写过，lines of code 不应被计为 "lines produced"，而应计为 "lines spent"（[*On the cruelty of really teaching computing science*, EWD1036](https://www.cs.utexas.edu/~EWD/transcriptions/EWD10xx/EWD1036.html)）。那句老话（广泛归于 Bill Gates，source 有些模糊）说得更好记：用 LOC 衡量 programming progress，就像用重量衡量 aircraft building progress。如果你用 lines of code 衡量 programmer productivity，你衡量的就是错东西。这 40 年来一直是真的，现在仍然是真的。

我发帖说，过去 60 天里我 shipped 了 600,000 lines of production code。Replies 很快来了：

- “那只是 AI slop。”
- “LOC 是 meaningless metric。过去 40 年每个 senior engineer 都这么说。”
- “你当然能产出 600K lines。你有 AI 写 boilerplate。”
- “More lines 是 bad，不是 good。”
- “你把 volume 和 productivity 混淆了。Classic PM brain。”
- “你的 error rates 呢？DAUs 呢？Revert counts 呢？”
- “这很 embarrassing。”

其中一些是对的。下面是当你认真对待这个 critique 的聪明版本，并且仍然做数学时会发生什么。

## AI coding critique 的三个分支

它们经常被压成一个观点，但其实是不同 arguments。

**Branch 1：LOC 不衡量 quality。** True。一直如此。50-line well-factored library 胜过 5,000-line bloated one。AI 出现前如此，现在也如此。这从来不是 killer argument。它只是提醒你思考自己在 measuring 什么。

**Branch 2：AI inflates LOC。** True。LLMs 默认生成 verbose code。更多 boilerplate。更多 defensive checks。更多 comments。更多 tests。即使 “real work done” 没变，raw line counts 也会上升。

**Branch 3：因此 bragging about LOC 很 embarrassing。** Argument 在这里跳轨了。

Branch 2 才是有趣的那个。如果 raw LOC 被某个 factor inflated，诚实做法是计算 deflation 并报告 deflated number。这就是本文要做的事。

## 数学

### Raw numbers（原始数字）

我写了一个 script（[`scripts/garry-output-comparison.ts`](../scripts/garry-output-comparison.ts)），枚举 GitHub 上 `garrytan/*` 拥有的全部 41 个 repos（15 public、26 private）中我在 2013 和 2026 authored 的每个 commit。对每个 commit，它统计 added logical lines（non-blank、non-comment）。2013 corpus 包含 Bookface，也就是我那年做的 YC-internal social network。

2026 排除一个 repo：`tax-app`（YC video demo，不是 production work）。它 baked into script 的 `EXCLUDED_REPOS` constant。你可以自己运行。

2013 是完整一年。本文写作时（April 18），2026 是第 108 天。

|                  | 2013 (full year) | 2026 (108 days) | Multiple |
|------------------|----------------:|----------------:|---------:|
| Logical SLOC     |           5,143 |       1,233,062 |     240x |
| Logical SLOC/day |              14 |          11,417 |     810x |
| Commits          |              71 |             351 |     4.9x |
| Files touched    |             290 |          13,629 |      47x |
| Active repos     |               4 |              15 |    3.75x |

### “14 lines per day？太 pathetic 了。”

是的。这就是重点。

2013 年我是 YC partner，后来是 Posterous cofounder，晚上和周末写 code。14 logical lines per day 是我一边做真正 day job、一边 part-time shipping code 的实际 output。Historical research 对 professional full-time programmer output 给出的范围很宽，取决于 project size 和 study：Fred Brooks 在 *The Mythical Man-Month* 中引用 systems programming 约 10 lines/day（OS/360 observations），Capers Jones 在数千 projects 中测得约 16-38 LOC/day，Steve McConnell 的 *Code Complete* 报告 small projects（10K LOC）为 20-125 LOC/day，large projects（10M LOC）则降到 1.5-25。这取决于 size，不是单一数字。

我的 2013 baseline 不是 cherry-picked。对于有 day job 的 part-time coder 来说很正常。如果你认为正确 baseline 是 50（高 3.5x），2026 multiple 会从 810x 降到 228x。仍然很高。

### 两次 deflation

对 “raw LOC is garbage” 的 standard response 是 **logical SLOC**（source lines of code，non-comment non-blank）。`cloc` 和 `scc` 这类 tools 已经这样算了 20 年。同样 code，去掉 fluff：没有 blank lines，没有 single-line comments，没有 comment block bodies，没有 trailing whitespace。

但 logical SLOC 不能完全消除 AI inflation。AI 会写 2-3 个 defensive null checks，而 senior engineer 会写零个。AI 会 inline try/catch around 不会 throw 的东西。AI 会写 `const result = foo(); return result`，而不是 `return foo()`。

所以我们应用 **second deflation**。假设 AI-generated code 在 logical level 上比 senior hand-crafted code verbose 2x。这很 aggressive，绝大多数我见过的 measurements 都把 multiplier 放在 1.3-1.8x，但这是 skeptic 会要求的 upper bound。

- 我的 2026 per-day rate，NCLOC：**11,417**
- 加上 2x AI-verbosity deflation：**5,708** logical lines per day
- 同时应用两次 deflations 后的 daily pace multiple：**408x**

现在选择你的 priors：

- 5x deflation（没有根据，但先这样算）：**162x**
- 10x（pathological）：**81x**
- 100x（impossible，因为那是一分钟 sustained 一行）：**8x**

Coefficient size 的争论不会改变 conclusion。无论如何，数字都很大。

### Weekly distribution（周分布）

“你的 per-day number 假设 uniform output。Show the distribution。如果只是 single burst，你的 run-rate 就 bogus。”

Fair。

```
Week 1-4  (Jan):  ████████░░░░░░░░░  ~8,800/day
Week 5-8  (Feb):  ████████████░░░░░  ~12,100/day
Week 9-12 (Mar):  ██████████░░░░░░░  ~10,900/day
Week 13-15 (Apr): █████████████░░░░  ~13,200/day
```

这不是 spike。Rate 大致 consistent，而且 slightly increasing。自己运行 script。

## Quality question（质量问题）

这是最 legitimate 的 critique，经由 [David Cramer](https://x.com/zeeg) voice 提出：OK，你 push 了更多 lines。你的 error rates 呢？Post-merge reverts 呢？Bug density 呢？如果你以 10x speed typing，但 shipping 20x more bugs，你不是 leveraged，你是在 scale 上制造 noise。

Fair。下面是 data：

**Reverts。** 对 15 active repos 运行 `git log --grep="^revert" --grep="^Revert" -i`：351 commits 中 7 reverts = **2.0% revert rate**。作为 context，mature OSS codebases 通常在 1-3%。在任何你认为是 bar 的项目上运行同样 command 对比。

**Post-merge fixes。** 匹配 `^fix:` 且 reference 同一 branch 上 prior commit 的 commits：351 个中 22 个 = **6.3%**。Healthy fix cycle。Zero-fix rate 反而意味着我没有 catch 自己的 mistakes。

**Tests。** 这是真正重要的东西，也是对我改变一切的东西。2026 早期，我 shipping without tests，然后在 bug land 被摧毁。后来我达到 30% test-to-code ratio，再到 critical paths 上 100% coverage，然后突然就能飞了。Tests 从 January 全部 repos 加起来约 100 个增长到**现在超过 2,000 个**。它们在 CI 中运行。它们 catch regressions。每个 gstack PR 都在 PR body 中有 coverage audit。

真正 insight：multi-level testing 才是让 AI-assisted coding 真正 work 的东西。Unit tests、E2E tests、LLM-as-judge evals、smoke tests、slop scans。没有这些 layers，你只是在高速生成 confident garbage。有了它们，你有 verification loop，让 AI iterate 到 code 真的 correct。

gstack 的核心 real-code feature，也就是不只是 markdown prompts 的那个东西，是一个 **Playwright-based CLI browser**，我专门写它，是为了停止手动 black-box testing 自己的东西。`/qa` 会打开真实 browser、navigate staging URL 并运行 automated checks。这是 2,000+ lines of real systems code（server、CDP inspector、snapshot engine、content security、cookie management），它存在是因为 testing 是 unlock，不是 overhead。

**Slop scan。** 一个第三方，[Ben Vinegar](https://x.com/bentlegen)，Sentry founding engineer，构建了 [slop-scan](https://github.com/benvinegar/slop-scan)，专门测量 AI code patterns。Deterministic rules，calibrated against mature OSS baselines。Higher score = more slop。他在 gstack 上运行，我们得分 5.24，是他当时测过的最差。我认真对待 findings，refactor，并在一个 session 中把 score 降低 62%。运行 `bun test`，看 2,000+ tests pass。

**Review rigor。** 每个 gstack branch 都会经过 CEO review、Codex outside-voice review、DX review 和 eng review。通常每个做 2-3 passes。我刚 shipped 的 `/plan-tune` skill 出现过 CEO expansion plan 的 scope ROLLBACK，因为 Codex outside-voice review surfaced 15+ findings，而我的四个 Claude reviews 漏掉了它们。Review infrastructure catches the slop。它在 repo 中可见。任何人都可以读。

## 我愿意 conceded 的东西

我会比 critics 自己 steelman 得更 hard：

**Greenfield vs maintenance。** 2026 numbers 主要由 new-project code 主导。Mature-codebase maintenance 每天产生的 lines 更少。如果你问 “Garry 能不能 100x 维护 bank 里 10 million lines legacy Java 的 team”，我的数字不能证明。其他人需要在不同 context 上运行自己的 script。

**2013 baseline 有 survivorship bias。** 我的 2013 public activity 很低。这个 analysis 包含 Bookface（private，22 active weeks），那是我那年最大的 project，所以 bias 比看起来小。但不是 zero。如果真实 2013 rate 是 50/day 而不是 14，当前 pace multiple 是 228x 而不是 810x。仍然很高。

**Quality-adjusted productivity 尚未 fully proven。** 我没有 2013-me 和 2026-me 之间 clean bug-density comparison。我能说的是：revert rate 在 normal band，fix rate healthy，test coverage real，adversarial review process 在最近 plan 上 catch 了 15+ issues。这是 evidence，不是 proof。Skeptic 可以 discount it。

**"Shipped" 在不同时代含义不同。** 一些 2013 products shipped 然后 died。一些 2026 products 也可能同样。如果两年后我今年 shipped 的东西 80% dead，那么 critique “you built a bunch of unused stuff” 就有 teeth。我接受这种 reality check。

**Time to first user 才是重要 metric，不是 LOC。** 从 “I wish this existed” 到 “it exists and someone is using it” 的 60-day cycle 才是真正 shift。LOC 是 downstream evidence。正确 metric 是 “shipped products per quarter” 或 “working features per week”。这些也以类似 multiple 上升了。

## 这些 lines 变成了什么

gstack 不是 hypothetical。它是有真实 users 的 product：

- **75,000+ GitHub stars** in 5 weeks
- **14,965 unique installations**（opt-in telemetry）
- **305,309 skill invocations** recorded since January 2026
- Peak 时 **~7,000 weekly active users**
- Across all skill runs 的 **95.2% success rate**（290,624 successes / 305,309 total）
- **57,650 /qa runs**、**28,014 /plan-eng-review runs**、**24,817 /office-hours sessions**、**18,899 /ship workflows**
- **27,157 sessions used the browser**（real Playwright，不是 toy）
- Median session duration：**2 minutes**。Average：**6.4 minutes**。

Top skills by usage：

```
/qa               57,650  ████████████████████████████
/plan-eng-review  28,014  ██████████████
/office-hours     24,817  ████████████
/ship             18,899  █████████
/browse           13,675  ██████
/review           13,459  ██████
/plan-ceo-review  12,357  ██████
```

这些不是躺在 drawer 里的 scaffolds。Thousands of developers 每天运行这些 skills。

## 这意味着什么

我不是说 engineers 要消失。Nobody serious thinks that。

我是在说 engineers 现在可以飞了。2026 年的一个 engineer，用同样 hours、同样 day job、同样 brain，拥有 2013 年一个 small team 的 output。Code-generation cost curve collapsed by two orders of magnitude。

数字里有趣的部分不是 volume，而是 rate。而这个 rate 不是关于我的 statement，而是关于所有 software engineering 脚下地面的 statement。

2013 年的我每天 shipped 约 14 logical lines。对一个有 real job 的 part-time coder 来说正常。2026 年的我每天 shipping 11,417 logical lines，同时仍 full-time running YC。同样 day job。同样 free time。同一个人。

Delta 不是我变成了更好的 programmer。如果说有什么，我的 mental model of coding 反而 atrophied。Delta 是 AI 让我真的 ship 了那些我一直想 build 的东西。Small tools。Personal products。过去会死在 notebook 里的 experiments，因为 build them 的 time cost 太高。从 “I want this tool” 到 “this tool exists and I'm using it” 的 gap，从 3 weeks collapsed 到 3 hours。

Script 在这里：[`scripts/garry-output-comparison.ts`](../scripts/garry-output-comparison.ts)。在你自己的 repos 上运行。Show me your numbers。Argument 不是关于我，而是关于 ground 是否 moved。

我赌它对你也 moved 了。
