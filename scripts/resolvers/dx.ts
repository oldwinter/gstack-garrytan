/**
 * DX Framework resolver
 *
 * Shared principles, characteristics, cognitive patterns, and scoring rubric
 * for /plan-devex-review and /devex-review. Compact (~150 lines).
 *
 * Hall of Fame examples are NOT included here. They live in
 * plan-devex-review/dx-hall-of-fame.md and are loaded on-demand per pass
 * to avoid prompt bloat.
 */
import type { TemplateContext } from './types';

export function generateDxFramework(ctx: TemplateContext): string {
  const hallOfFamePath = `${ctx.paths.skillRoot}/plan-devex-review/dx-hall-of-fame.md`;

  return `## DX First Principles（DX 第一原则）

这些是原则。每条 recommendation 都必须能追溯到其中之一。

1. **T0 零摩擦。** 前五分钟决定一切。一键开始。不读 docs 也能 hello world。不要信用卡。不要 demo call。
2. **Incremental steps。** 不要强迫 developers 在获得局部价值前理解整个系统。要 gentle ramp，不要 cliff。
3. **Learn by doing。** Playgrounds、sandboxes、可直接 copy-paste 且在当前 context 中能工作的 code。Reference docs 必要，但永远不够。
4. **Decide for me, let me override。** Opinionated defaults 是 features。Escape hatches 是 requirements。Strong opinions, loosely held。
5. **Fight uncertainty。** Developers 需要知道：下一步做什么、是否成功、失败时如何修复。每个 error = problem + cause + fix。
6. **Show code in context。** Hello world 是谎言。展示 real auth、real error handling、real deployment。解决 100% 的问题。
7. **Speed is a feature。** Iteration speed 就是一切。Response times、build times、完成任务所需 lines of code、要学习的 concepts，全部都算。
8. **Create magical moments。** 什么会像 magic？Stripe 的 instant API response。Vercel 的 push-to-deploy。找到你的 magic，并让 developers 第一次体验就遇到它。

## The Seven DX Characteristics（七个 DX 特征）

| # | Characteristic | 含义 | Gold Standard |
|---|---------------|---------------|---------------|
| 1 | **Usable** | Install、setup、use 都简单。APIs 直觉化。Feedback 快。 | Stripe: one key, one curl, money moves |
| 2 | **Credible** | Reliable、predictable、consistent。Deprecation 清晰。Secure。 | TypeScript: gradual adoption, never breaks JS |
| 3 | **Findable** | 容易 discover，也容易找到 help。Strong community。Good search。 | React: every question answered on SO |
| 4 | **Useful** | 解决真实问题。Features 匹配实际 use cases。可 scale。 | Tailwind: covers 95% of CSS needs |
| 5 | **Valuable** | 可衡量地减少 friction。节省时间。值得成为 dependency。 | Next.js: SSR, routing, bundling, deploy in one |
| 6 | **Accessible** | 适配不同 roles、environments、preferences。CLI + GUI。 | VS Code: works for junior to principal |
| 7 | **Desirable** | Best-in-class tech。合理 pricing。Community momentum。 | Vercel: devs WANT to use it, not tolerate it |

## Cognitive Patterns — How Great DX Leaders Think（优秀 DX leader 的认知模式）

内化这些模式；不要机械枚举。

1. **Chef-for-chefs** — 你的 users 以构建产品为生。他们什么都看得见，所以标准更高。
2. **First five minutes obsession** — New dev 到达，计时开始。他们能否不看 docs、不找 sales、不填信用卡就 hello-world？
3. **Error message empathy** — 每个 error 都是 pain。它是否识别 problem、解释 cause、展示 fix、链接 docs？
4. **Escape hatch awareness** — 每个 default 都需要 override。没有 escape hatch = 没有 trust = 无法规模 adoption。
5. **Journey wholeness** — DX 是 discover → evaluate → install → hello world → integrate → debug → upgrade → scale → migrate。每个 gap 都会丢掉一个 dev。
6. **Context switching cost** — Dev 每离开你的 tool 一次（docs、dashboard、error lookup），你就失去他们 10-20 分钟。
7. **Upgrade fear** — 这会不会弄坏 production app？Clear changelogs、migration guides、codemods、deprecation warnings。Upgrades 应该 boring。
8. **SDK completeness** — 如果 devs 自己写 HTTP wrapper，你失败了。如果 SDK 支持 5 种语言里的 4 种，第 5 个 community 会恨你。
9. **Pit of Success** — "We want customers to simply fall into winning practices" (Rico Mariani)。让正确的事容易，让错误的事难。
10. **Progressive disclosure** — Simple case 必须 production-ready，不是 toy。Complex case 使用同一个 API。SwiftUI: \\\`Button("Save") { save() }\\\` → full customization, same API.

## DX Scoring Rubric (0-10 calibration)（DX 评分标尺）

| Score | Meaning |
|-------|---------|
| 9-10 | Best-in-class。Stripe/Vercel tier。Developers 会主动称赞。 |
| 7-8 | Good。Developers 可以无明显挫败地使用。只有 minor gaps。 |
| 5-6 | Acceptable。能 work，但有 friction。Developers 勉强 tolerate。 |
| 3-4 | Poor。Developers 会 complain。Adoption 受损。 |
| 1-2 | Broken。Developers 第一次尝试后就放弃。 |
| 0 | Not addressed。这个 dimension 没有被认真考虑。 |

**The gap method:** 对每个 score，解释 THIS product 的 10 分长什么样。然后朝 10 分修。

## TTHW Benchmarks (Time to Hello World)（Hello World 用时基准）

| Tier | Time | Adoption Impact |
|------|------|-----------------|
| Champion | < 2 min | Adoption 高 3-4 倍 |
| Competitive | 2-5 min | Baseline |
| Needs Work | 5-10 min | Significant drop-off |
| Red Flag | > 10 min | 50-70% abandon |

## Hall of Fame Reference（Hall of Fame 参考）

每个 review pass 中，只加载相关 section：
\\\`${hallOfFamePath}\\\`

只读取当前 pass 对应 section（例如 Getting Started 对应 "## Pass 1"）。
不要一次读取整个 file。这样可以保持 context 聚焦。`;
}
