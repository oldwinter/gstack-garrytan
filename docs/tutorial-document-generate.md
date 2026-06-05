# Tutorial：90 秒为 feature 生成 docs

你会在已有 project 中运行 `/document-generate`，观察它把 tutorial / how-to / reference / explanation docs 写到正确位置，并最终得到可以放进 PR 的 coverage map。结束时，你会知道四个动作：scope、archaeology、partition、write。

## 你需要准备什么

- 已安装 gstack（`git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup`）
- Claude Code 正在任意 project 中运行，该 project 至少有一个 public surface（CLI command、exported function、config option、skill、API endpoint）
- 大约 90 秒

你不需要提前有 `docs/` directory，skill 会在缺失时创建。你也不需要知道 Diataxis terminology，skill 会为你 label output。

## Step 1：在任意 project 中 invoke skill

在想 document 的 project 中打开 Claude Code。输入：

```
/document-generate
```

Skill 会询问一个 output target 问题：

```
A) Write documentation inline in existing files (README, ARCHITECTURE, etc.)
B) Create standalone documentation files (e.g., docs/ directory)
C) Both — inline summaries in existing files + deep docs in standalone files

RECOMMENDATION: Choose C because it maximizes both discoverability and depth.（推荐 C，因为它同时最大化 discoverability 和 depth。）
```

选择 C。你会得到 README pointer 和一整套 standalone docs。

## Step 2：观察 archaeology 运行

Skill 会安静约 30 秒，读取 codebase。这是 intentional：Step 1 "Codebase Archaeology" phase 是整个 workflow 最重要的一步。Skill 会读取：

- 完整 repository structure
- README、ARCHITECTURE、CONTRIBUTING、CLAUDE.md（entry points）
- 你要 document 的实现 files（full file，不只是 signatures）
- Tests（揭示 edge cases 和 intended behavior）
- Tagged inline comments：`// NOTE:`、`// DESIGN:`、`// WHY:`

完成后，你会看到类似：

```
Researched 47 files, identified 12 public surface items, 8 concepts, and 4 design decisions.
```

这个数字说明 skill 确实读取了 code，而不是从 filenames 猜。

## Step 3：查看 Diataxis partition plan

Skill 会打印 partition plan，展示会为哪些 entity 写哪些 quadrants：

```
Documentation plan:
  [entity]              [tutorial] [how-to] [reference] [explanation]
  WidgetService         ✅ new     ✅ new   ✅ new      ✅ new
  --verbose flag        ❌        ✅ new   ✅ inline   ❌
  Bayesian scheduler    ❌        ❌       ✅ new      ✅ new
```

不是每个 entity 都需要所有四个 quadrants。CLI flags 得到 reference + how-to。Internal modules 得到 reference + explanation。User-facing features 得到 all four。Skill 会根据 entity type 选择。

如果 plan 超过 5 个 documents，skill 会在 proceeding 前请求你确认。否则它会继续。

## Step 4：阅读第一个落地的 doc

Reference docs 最先落地，因为它们固定 vocabulary。你会看到：

```
GENERATED: docs/reference-widget-service.md
```

打开该 file。它有严格结构：一段式 intro、带 types 和 defaults 的完整 API listing、2-3 个可运行 examples，以及链接到后续 how-to 和 tutorial 的相关 section。

这就是 Diataxis 中 reference docs 的样子：factual、exhaustive、no narrative。如果你想解释某个 option 为什么存在，那属于 skill 接下来会写的 explanation doc。

## Step 5：查看 explanation、how-to 和 tutorial 出现

接下来会快速连续写入 remaining quadrants（每个约 5-10 秒）：

```
GENERATED: docs/explanation-widget-architecture.md
GENERATED: docs/howto-create-a-custom-widget.md
GENERATED: docs/tutorial-build-your-first-widget.md
```

逐个打开。注意它们不会互相重复：

- **Explanation** 先讲 problem，再讲 approach，然后讲 trade-offs 和 considered alternatives
- **How-to** 包含 prerequisites、带 exact commands 的 numbered steps、verification section 和 troubleshooting section
- **Tutorial** 让你在 3 steps 内得到 working result，并以 "What you built" 结束

Skill 会 enforce 这些 structures。如果 how-to 缺失 verification section，Step 8 Quality Self-Review 会在 commit 前捕捉。

## Step 6：检查 cross-linking

每个 doc 都会 link 到其他 docs。Reference doc 的相关 section 会 link 到 how-to 和 tutorial；how-to 的相关 section 会 link 到 reference；tutorial 的 "What you built" section 会 link 到 reference，供进一步探索。

运行 grep 验证没有 broken links：

```bash
grep -rE '\]\([^)]*\.md\)' docs/ | head -10
```

每个 linked file 都应存在。Skill 的 Step 7 "Cross-Document Linking & Discoverability" 会在 commit 前检查这一点。

## Step 7：在 PR body 中查看 coverage summary

如果你在有 open PR 的 feature branch 上，skill 会用 `## Documentation Generated` table 更新 PR body：

```
## Documentation Generated（已生成文档）

| File | Quadrant | Description |
|------|----------|-------------|
| docs/tutorial-build-your-first-widget.md | Tutorial | Walk-through from install to first working widget |
| docs/reference-widget-service.md | Reference | Complete widget API with types, defaults, examples |
| docs/explanation-widget-architecture.md | Explanation | Why widgets are isolated services |
| docs/howto-create-a-custom-widget.md | How-to | Creating and registering custom widgets |
```

Reviewer 打开 PR 后，会立即知道 shipped 了哪种 coverage。

## 你构建了什么

现在你有四份服务于四类 reader 的 documents：

- Project newcomer 可以读 `tutorial-*.md` 并做出能工作的东西
- Experienced user 可以读 `howto-*.md` 完成 specific task
- API caller 可以读 `reference-*.md` 获得 exact signatures
- Code reviewer 可以读 `explanation-*.md` 理解 design

每份都足够短，易于维护。每份都有 single job。PR body 展示覆盖了哪些 quadrants。如果之后运行 `/document-release`，Diataxis coverage map 会报告该 entity fully covered（4/4 quadrants）。

## 下一步做什么

- **如果你有 `/document-release` flagged 但未填补的 gaps**：再次运行 `/document-generate`，scope 到那些 specific entities。
- **如果你想理解为什么存在四个 quadrants：**阅读 [explanation-diataxis-in-gstack.md](./explanation-diataxis-in-gstack.md)。
- **如果你想 document 一个 specific shipped feature**（而不是整个 project）：阅读 [howto-document-a-shipped-feature.md](./howto-document-a-shipped-feature.md)。
- **Skill 本身的 reference：**[`document-generate/SKILL.md`](../document-generate/SKILL.md)。
