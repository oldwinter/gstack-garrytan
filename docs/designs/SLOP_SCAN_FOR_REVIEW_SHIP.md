# Design：/review 和 /ship 中的 slop-scan integration

Status（状态）: deferred
Created（创建时间）: 2026-04-09
Depends on（依赖）: slop-diff script（scripts/slop-diff.ts，already landed）

## 问题

slop-scan findings 只有在你手动运行 `bun run slop:diff` 时才可见。它们应该像 SQL safety 和 trust boundary checks 一样，在 code review 和 shipping 过程中自动 surfaced。

## Integration points（集成点）

### /review（Step 4，after checklist pass）

在 critical/informational checklist pass 后运行 `bun run slop:diff`。把 new findings 与其他 review output 一起 inline 显示：

```
Pre-Landing Review: 3 issues (1 critical, 2 informational)

AI Slop: +2 new findings, -0 removed
  browse/src/new-feature.ts
    defensive.empty-catch: 2 locations
      line 42: empty catch, boundary=filesystem
      line 87: empty catch, boundary=process
```

Classification（分类）：INFORMATIONAL（永远不阻塞 merge，只 surface pattern）。

Fix-First heuristic 适用：如果 finding 是围绕 file op 的 empty catch，则用 `safeUnlink()` auto-fix。如果是 extension code 中的 catch-and-log，则 skip（按 CLAUDE.md guidelines，这是正确 pattern）。

### /ship（Step 3.5，pre-landing review + PR body）

与 /review 相同 integration。另外，在 PR body 中显示一行 summary：

```markdown
## Pre-Landing Review（落地前审查）
- 2 issues auto-fixed, 0 needs input
- AI Slop: +0 new / -3 removed ✓
```

### Review Readiness Dashboard（评审就绪面板）

不要新增 row。Slop 是 diff diagnostic，不是可以独立“run”的 review。它出现在 Eng Review output 内部，不作为自己的 dashboard entry。

## Auto-fix 什么，skip 什么

遵循 CLAUDE.md 的 "Slop-scan" section。摘要：

**Auto-fix（真实 quality improvements）：**
- `fs.unlinkSync` 周围的 empty catch → 替换为 `safeUnlink()`
- `process.kill` 周围的 empty catch → 替换为 `safeKill()`
- 没有 enclosing try 的 `return await` → 移除 `await`
- URL parsing 周围的 untyped catch → 添加 `instanceof TypeError` check

**Skip（slop-scan 会 flag 但实际正确的 patterns）：**
- fire-and-forget browser ops（page.close、bringToFront）上的 `.catch(() => {})`
- Chrome extension code 中的 catch-and-log（uncaught errors 会 crash extensions）
- shutdown/emergency paths 中的 `safeUnlinkQuiet`（swallowing all errors 是正确行为）
- delegate 到 active session 的 pass-through wrappers（API stability layer）

## Implementation notes（实现说明）

- `scripts/slop-diff.ts` 已经处理 heavy lifting（worktree-based base comparison、line-number-insensitive fingerprinting、graceful fallback）
- review/ship skills 运行 bash blocks。Integration 是：运行脚本、解析 output、包含到 review findings 中
- 如果 slop-scan 未安装（`npx slop-scan` fails），静默 skip
- 脚本始终 exit 0（diagnostic，never gates）

## Effort estimate（工作量估计）

| Task（任务） | Human（人工） | CC+gstack |
|------|-------|-----------|
| Add to review/SKILL.md.tmpl | 2 hours | 10 min |
| Add to ship/SKILL.md.tmpl | 2 hours | 10 min |
| Add to review/checklist.md | 1 hour | 5 min |
| Test with actual PRs | 2 hours | 15 min |
| Regenerate SKILL.md files | — | 1 min |
