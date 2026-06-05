# Fix #1671：`/office-hours` 总是报告 SESSION_COUNT: 0

**Status:** SHIPPED
**Branch:** fix-1671-profile-migration
**Date:** 2026-05-23
**Issue:** https://github.com/garrytan/gstack/issues/1671
**Original PR that introduced the bug:** garrytan/gstack#1039 / commit `0a803f9` / v1.0.0.0 / 2026-04-18

## 问题

`/office-hours` 每次调用都会报告 `SESSION_COUNT: 0` 和 `TIER: introduction`，即使用户已经运行过很多次这个 skill。用于让回访用户跳过 closing pitch 的 `welcome_back` tier（`bin/gstack-developer-profile:165-169`）永远到不了。自 v1.0.0.0 以来，这个问题在每个 fresh-`$HOME` 用户身上存在了约 5 周。

## 根因

v1.0.0.0 migration 把读取路径移到了 `~/.gstack/developer-profile.json`，但 `office-hours/SKILL.md.tmpl` 中的 writer 仍然写入 legacy `~/.gstack/builder-profile.jsonl`。首次读取时创建的 `ensure_profile` stub 含有 `sessions: []`；后续写入进入一个 reader 永远不会再读的文件。reader 和 writer 对存储位置的认知不一致。

完整根因分析（包括 RC2/RC3 follow-ups）：https://github.com/garrytan/gstack/issues/1671

## 修复

让 writer 使用 reader 正在读取的同一个文件。

### 变更

1. **`bin/gstack-developer-profile`** — 添加 `--log-session '<json>'` subcommand：
   - 校验必填字段（`date`、`mode`），invalid input 时 silent-skip（匹配 `bin/gstack-timeline-log:22-26`）。
   - 通过 `bun -e` 读取现有 `developer-profile.json`。
   - 向 `sessions[]` 追加 entry。更新 `signals_accumulated`（按 signal string 递增，与 `do_migrate:67-69` 一致），对 `resources_shown` 和 `topics` 做 union。
   - 使用 atomic mktemp+mv 写入（匹配 line 54 的现有模式）。
   - 写入后调用 `gstack-brain-enqueue "developer-profile.json"`，镜像 `bin/gstack-timeline-log:40`。

2. **`bin/gstack-developer-profile:do_read`** — 在选择 LAST_PROJECT / LAST_ASSIGNMENT / LAST_DESIGN_TITLE / CROSS_PROJECT / DESIGN_* 时过滤 `mode:"resources"` entries。Phase 6 resources auto-append 会在同一次 /office-hours 调用中的真实 session 之后发生；如果没有过滤，这条 resources entry 会覆盖用户下一次 session 所需的真实 session state。这是一个被 broken writer 掩盖的潜伏 bug，被本修复激活。

3. **`office-hours/SKILL.md.tmpl`** — 在 lines 490 和 893 替换 writer：
   - From: `echo '{...}' >> "$GSTACK_STATE_ROOT/builder-profile.jsonl"`
   - To: `~/.claude/skills/gstack/bin/gstack-developer-profile --log-session '{...}' 2>/dev/null || true`
   - 运行 `bun run gen:skill-docs` 重新生成 `office-hours/SKILL.md`。

### 不在本修复范围内的内容（有意如此）

- **不新增 binary。** `developer-profile.json` 的 owner binary 是 `gstack-developer-profile`；writer 应作为 subcommand 放在那里。`--log-session` 加入该 binary 已有的 `--migrate` / `--derive` 写侧 subcommand boundary，而不是加入 `gstack-*-log` event-writer family。verb name 仍与 `gstack-*-log` 匹配。
- **不加 mkdir-locks。** 并发 /office-hours 调用对 `developer-profile.json` 存在 read-modify-write race。codebase 在 `gstack-config` 中接受同样的 race（YAML 上的 r-m-w，无 lock）。这不是本修复引入的，超出范围。
- **不 bump schema。** Schema 保持 `schema_version: 1`。本修复不改变 schema，只是让 writer 使用它。
- **不为受影响用户做 auto-reconcile。** 已有用户在 `builder-profile.jsonl` 中 stranded 的 entries 不会自动合并进 `developer-profile.json`。他们下一次运行 /office-hours 时，第一条新 session 会进入 `welcome_back`；历史数据保留在 legacy 文件中（deprecation 期间仍可被其他工具读取）。多数受影响用户只有少量 stranded sessions，因此损失主要是观感层面的。删除 one-release-only reconcile pathway 是为了减少 net noise，符合 Garry 的“right-sized diff”声音。
- **不做 autoplan timeline rollup（RC2）。** 独立问题，独立 PR。
- **不做 project-scope opt-in（RC3）。** 独立问题，独立 PR。
- **不改 gbrain glob。** office-hours manifest 仍然 glob `~/.gstack/builder-profile.jsonl` 作为 context；一旦新写入不再落到那里，snapshot 会变冷。如果它成为 UX 问题，再在 follow-up 中更新。

### 测试（全部 gate-tier、free、deterministic）

1. **Regression test** 位于 `test/gstack-developer-profile.test.ts`：
   - Fresh `$HOME`。
   - 运行 /office-hours preamble：gstack-developer-profile 创建 empty stub。
   - 用 startup-mode JSON 调用 `--log-session`。
   - 再次运行 `--read`。断言 `SESSION_COUNT: 1`、`TIER: welcome_back`。
   - 在 current main 上失败（subcommand 不存在）。应用修复后通过。

2. **`do_read` mode filter test：** 记录 startup session 后再记录 resources entry，`--read` 返回来自真实 session 的 LAST_PROJECT / LAST_ASSIGNMENT / LAST_DESIGN_TITLE，而不是来自 resources entry。RESOURCES_SHOWN 仍然正确聚合。

3. **Validation + aggregation tests：** `--log-session` 对 invalid JSON / 缺少 required fields 静默跳过，缺少 `ts` 时注入 `ts`，保留用户设置的 `ts`，并在多个 sessions 间正确聚合 signals/resources/topics。

4. **Static-grep invariant** 位于 `test/static-no-legacy-writes.test.ts`（新增）：遍历每个 skill dir，断言除了 allowlisted readers（`gstack-developer-profile`、`gstack-memory-ingest.ts`、`gstack-artifacts-init`、doc files）之外，没有 production code path 写入 `builder-profile.jsonl`。防止未来 writer 退回 legacy file。

### 验收标准

- 在 fresh `$HOME` 上第二次调用 `/office-hours` 返回 `TIER: welcome_back`。
- `bun test` 在 touched files 上隔离通过。
- `bun run gen:skill-docs` 产生与 `.tmpl` edits 匹配的 clean diff。

### 发布

- 一个 commit。按 CHANGELOG style guide 做 PATCH version bump。
- CHANGELOG entry 由 `/ship` 编写。面向用户的表达：首先说明用户现在能体验到此前没有的行为（第二次访问时 welcome_back tier 生效）。

## Follow-up TODOs（后续 TODO）

- 一个 release 后彻底 deprecate `builder-profile.jsonl`（writer + shim + memory-ingest type）。
- 修复 RC2（autoplan inline sub-skills，绕过它们的 timeline-log preambles）。
- 为拥有多个 agent identities 的 power users 添加 `GSTACK_PROFILE_SCOPE` opt-in（RC3）。
- /plan-tune 目前不调用 `--derive`，因此 `inferred`/`gap` 可能漂移（pre-existing，与 #1671 无关）。
- 在现有 tier aggregator 下，`mode:"resources"` entries 会抬高 SESSION_COUNT（pre-existing，与 #1671 root cause 无关）。
