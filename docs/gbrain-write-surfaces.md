# gbrain write surfaces：什么落到哪里，以及如何验证

本文档服务两类读者：

1. **Agents**：当 planning skill 渲染精简的 `## Brain Context Load` 或 `## Save Results to Brain` blocks 时，这些 blocks 会引用本文档。实际使用 gbrain 时，按需阅读这里的 §Context Load 或 §Save Template。如果 `gbrain` 不在 PATH 上，完全跳过。
2. **Humans**：对真实 brain 运行 planning skill 后，使用手动 probe sections 确认 page 真的落地。

## 什么落到哪里

| Host + 检测状态 | Planning-skill SKILL.md 中渲染什么 |
|---|---|
| 任意 host + `gstack-config gbrain-refresh` 报告 `gbrain_local_status: "ok"` | 渲染压缩的 brain-aware blocks。Agent 实际保存时按需阅读本文档。每个 planning skill 约 250 tokens overhead。 |
| 任意 host + 未检测到 gbrain | Blocks 在生成时被抑制。Zero token overhead。Calibration takes 仍会渲染（单独 resolver，host-agnostic）。 |
| GBrain 或 Hermes host | Blocks 始终渲染，不受检测结果影响，因为这些 hosts 把 gbrain integration 作为 first-class concern。 |

`.gbrain-source` pins 只影响 **reads**，writes 会写到 `~/.gbrain/config.json` 中配置的 default engine。该行为在 `bin/gstack-gbrain-sync.ts` 中为 code-lookup resolvers 记录；gstack 把同一 contract 视为 artifact `put` semantics 的 load-bearing 约定。如果用户报告 writes 落到 wrong source，先看这里。

Trust policy（`personal` vs `shared`，per endpoint hash）会 gate auto-push 和 writeback。通过 `gstack-config set brain_trust_policy@<endpoint-hash> personal` 设置。Local PGLite installs 自动 default to `personal`；remote-MCP installs 会在 `/setup-gbrain` step 9.5 prompt。

## §Context Load（agent 运行 planning skill 时阅读）

开始前，搜索 brain 获取相关上下文：

1. **提取 2-4 个 keywords**：从用户请求中选择 nouns、error names、file paths、technical terms，不要选择 verbs 或 adjectives。例如对 "the login page is broken after deploy"，搜索 `login broken deploy`。
2. **搜索**：`gbrain search "<keyword1 keyword2>"`。返回类似 `[slug] Title (score: 0.85) - first line of content...` 的 lines。
3. **如果结果很少**（少于 3）：放宽到 single most specific keyword 再搜一次。如果仍然很少，不带 brain context 继续。
4. **读取前 3 条结果**：对每个运行 `gbrain get_page "<slug>"`。3 个后 stop，超过后收益递减。
5. **使用上下文** 来辅助 analysis。当某个 brain page 改变了你的思路，在 output 中 cite specific slugs。

如果 `gbrain search` 返回任意 non-zero exit（gbrain not on PATH、network flake、throttle），按 transient 处理：不带 brain context 继续。不要 inline retry，用户可以稍后 re-run skill。

## §Save Template（agent 实际保存时阅读）

Skill 完成后，保存 output。Compact resolver block 已经展示你的 specific skill 的 slug prefix + title + tag（例如 `gbrain put "ceo-plans/<feature-slug>" ...`）。完整 template：

```bash
gbrain put "<slug-prefix>/<feature-slug>" --content "$(cat <<'EOF'
---
title: "<Title>: <feature name>"
tags: [<tag>, <feature-slug>]
---
<skill output in markdown — the actual deliverable, not a summary>
EOF
)"
```

**Slug 指南**：`<feature-slug>` 应为 kebab-case、lowercase，并在 prefix 内 unique。优先使用具体的 project/feature names，而不是抽象 labels。例如 `auth-rate-limit`，不要 `security-fix`。

**Title 指南**：constant prefix（例如 "CEO Plan"、"Eng Review"）固定；suffix 是 feature/topic 的 human-readable name。

**Tag 指南**：第一个 tag 是 skill metadata 中的 constant `<tag>`（例如 `ceo-plan`、`eng-review`）。第二个 tag 是 `<feature-slug>`，让 cross-page traversal 可用。如有明显 relationships，可添加更多 tags（例如 `[ceo-plan, auth-rate-limit, security]`）。

### Entity-stub enrichment（实体 stub 补充）

保存 main page 后，提取 output 中提到的人名和组织名。对每一个：

```bash
# 先检查 page 是否已存在
gbrain search "<entity name>"

# 如果没有 match，创建 stub
gbrain put "entities/<entity-slug>" --content "$(cat <<'EOF'
---
title: "<Person or Company Name>"
tags: [entity, person]
---
Stub page. Mentioned in <skill name> output. Replace with real bio when relevant.
EOF
)"
```

**只提取 real names**：真实 person names（例如 "Garry Tan"）和 company/organization names（例如 "Y Combinator"）。跳过 product names、feature names、section headings、technical terms（CSS class names、function names）和 file paths。不确定时，skip。

People 使用 `tags: [entity, person]`，companies/teams 使用 `tags: [entity, organization]`。

### 错误处理

- **Throttle**：exit code 1，stderr 包含 `throttle`、`rate limit`、`capacity` 或 `busy`。Defer save 并继续，brain 忙；content 没丢，只是本次 run 未 persisted。
- **其他 non-zero exit**：视为 transient failure。不要 inline retry，用户可以 re-run skill，或在怀疑 gbrain misconfigured 时运行 `gstack-config gbrain-refresh`。
- **`gbrain: command not found`**：gbrain 不在 PATH 上。Compact resolver block 已告诉你 skip，你不应到达这里。如果确实到了，silently skip and continue。

### 反向链接

如果 save output 按 name 或 topic 提到另一个 brain page，在 markdown body 底部添加 backlink line：

```
Related: [[other-page-slug]], [[another-slug]]
```

gbrain 会把 `[[slug]]` syntax auto-resolve 成 rendered page 中的 clickable link。只有 relationship concrete 时才添加 backlinks（例如 "this CEO plan depends on the eng review at `eng-reviews/auth-rate-limit`"）。不要 fabricate connections。

### 完成摘要

在 final skill output 中，用一行说明 brain utilization：
"Brain: read 3 pages, saved 1 page, enriched 2 entity stubs, 0 throttles."
这帮助用户看到 brain coverage 随时间增长。

## 持久化验证

Matched-pair "is the data we hope to save actually being saved?" 问题由 `test/skill-e2e-gbrain-roundtrip-local.test.ts` 覆盖：真实 `gbrain init --pglite` + `gbrain put` + `gbrain get` round-trip，使用 isolated temp HOME。Periodic-tier。当 `VOYAGE_API_KEY` 未设置或 gbrain CLI 缺失于 PATH 时 skip。

触碰 resolver 的 PR 打开前运行：

```bash
EVALS=1 EVALS_TIER=periodic VOYAGE_API_KEY=$VOYAGE_API_KEY \
  bun test test/skill-e2e-gbrain-roundtrip-local.test.ts
```

如果在真实 planning-skill run 后，想针对自己的 brain 手动 spot-check（调试 agent 本应保存的 specific page）：

```bash
gbrain get "<prefix>/<slug>"           # expect markdown + frontmatter
gbrain search "<slug fragment>"        # expect slug in top results
gbrain sources list                    # confirm gstack-brain-<user> source
gbrain get "entities/<person>"         # expect stub per named person
```

## Remote / Supabase / thin-client-MCP 路由

Resolver emit 单一 CLI shape：`gbrain put "<slug>" --content "..."`，适用于 gbrain 支持的每个 engine。CLI 会根据用户的 `~/.gbrain/config.json` 在内部 route 到 local PGLite、remote Supabase 或 remote MCP endpoint。**gstack 不测试该 routing**：storage layer 是 gbrain 需要 honor 的 contract；我们针对 local PGLite 测试的同一 CLI invocation，也是针对任何其他 engine 触发的 invocation。

如果你在 Supabase 或 thin-client MCP 上，writes 没有落地：

1. `gbrain doctor --fast --json`：engine health check。如果任何项 reports `error`，先修复。
2. `gstack-config get brain_trust_policy@<endpoint-hash>` 必须是 `personal` 才会 auto-write。运行 `gstack-config endpoint-hash` 获取 active hash。如果是 `shared`，agent 会在 writes 前 prompt；如果你 declined，re-run skill。
3. 如果 trust policy 是 `personal` 且 `gbrain doctor` clean，但 page 仍不存在，对 gbrain file issue。gstack 的 CLI call shape 与 T11（`gbrain-roundtrip-local`）exercise 的 shape 相同。

## Automation 未验证什么

- **Calibration takes（`takes_add`）**：今天它们 fallback 到 `gbrain put` 内的 fence-block writes，因为 `BRAIN_CALIBRATION_WRITEBACK` 在等待 gbrain v0.42+ ship `takes_add` MCP op 前为 FALSE。Flag flip 后，针对 `/office-hours` 重新运行本文档中的 probe，并确认 `gbrain takes_list` surface 一个 `kind=bet` entry，且 weight 符合预期（office-hours 为 0.9，见 `scripts/brain-cache-spec.ts:151-157`）。
- **其他 4 个 planning skills 的 per-skill E2E**：只有 `/office-hours` 有 fake-CLI E2E coverage（`test/skill-e2e-office-hours-brain-writeback.test.ts`）。Resolver unit test（`test/resolvers-gbrain-save-results.test.ts`）覆盖全部 5 个的 wiring。Per-skill E2E expansion 跟踪在 TODOS.md。
- **`.gbrain-source` write semantics**：gstack 把 documented reads-only contract 视为 load-bearing，但不会独立 verify gbrain CLI 是否永不基于 pin re-route writes。如果你发现它会这样做，那是应向 upstream file 的 gbrain bug。
