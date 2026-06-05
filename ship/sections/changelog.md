<!-- AUTO-GENERATED from changelog.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
## Step 13: CHANGELOG (auto-generate)

1. 阅读 `CHANGELOG.md` header，了解 format。

2. **首先，枚举 branch 上的每个 commit：**
   ```bash
   git log <base>..HEAD --oneline
   ```
   复制完整列表。统计 commits 数量。你会把它当作 checklist。

3. **阅读完整 diff**，理解每个 commit 实际改了什么：
   ```bash
   git diff <base>...HEAD
   ```

4. 写任何内容前，**按 theme 对 commits 分组**。常见 themes：
   - New features / capabilities
   - Performance improvements
   - Bug fixes
   - Dead code removal / cleanup
   - Infrastructure / tooling / tests
   - Refactoring

5. **编写覆盖所有 groups 的 CHANGELOG entry：**
   - 如果 branch 上已有 CHANGELOG entries 覆盖了部分 commits，用一个统一的新版本 entry 替换它们
   - 将 changes 分类到适用 sections：
     - `### Added` — new features
     - `### Changed` — changes to existing functionality
     - `### Fixed` — bug fixes
     - `### Removed` — removed features
   - 编写 concise、descriptive bullet points
   - 插入到 file header 之后（line 5），日期使用 today
   - Format：`## [X.Y.Z.W] - YYYY-MM-DD`
   - **Voice:** 以用户现在能 **do** 而此前不能做的事情开头。使用 plain language，不写 implementation details。不要提 TODOS.md、internal tracking 或 contributor-facing details。

6. **Cross-check:** 将你的 CHANGELOG entry 与第 2 步的 commit list 对比。
   每个 commit 必须至少映射到一个 bullet point。如果有 commit 未被代表，
   现在补上。如果 branch 有 N 个 commits，跨 K 个 themes，CHANGELOG 必须
   反映所有 K 个 themes。

**不要让用户描述 changes。** 从 diff 和 commit history 中推断。

---
