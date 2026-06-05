# 如何为刚 shipped 的 feature 补文档

这是 post-ship workflow：你已经 merge 一个 PR，docs 已 stale，并希望一次得到 coverage map 和补齐 gaps。你会运行 `/document-release` 做 audit，然后运行 `/document-generate` 填补它发现的 gaps。

## 前置条件

- 已安装 gstack（`./setup` 完成；用 `which gstack` 验证，或在 Claude Code 中输入 `/` 并看到 skills listed）
- 已 checkout 包含 shipped feature 的 branch
- GitHub 或 GitLab 上存在 PR（推荐，因为 workflow 会用 coverage map 更新 PR body）

如果还没有 PR，先运行 `/ship` 创建；这正是 `/document-release` 设计要配合运行的对象。

## Steps（步骤）

### 1. Audit current coverage（审计当前覆盖）

运行：

```
/document-release
```

Skill 会遍历你相对 base branch 的 diff，extract new public surface（skills、CLI flags、config options、API endpoints、new modules），并按四个 Diataxis quadrants 为每个 entity score。你会看到类似 coverage map：

```
Coverage map:
  [entity]         [reference?] [how-to?] [tutorial?] [explanation?]
  /new-skill       ✅ AGENTS.md  ❌        ❌          ❌
  --new-flag       ✅ README     ✅ README  ❌          ❌
  FooProcessor     ❌            ❌        ❌          ❌
```

Zero coverage 的 items 是 **critical gaps**。只有 reference coverage 的 items 是 **common gaps**。两者都会作为 `### Documentation Debt` subsection 落到 PR body 中，让 reviewers 看见。

如果 `/document-release` 报告全部 covered，就完成了。跳过本 how-to 剩余部分。

### 2. 阅读 PR body 中的 documentation debt section

打开 PR（skill 会打印 URL）。滚动到 `## Documentation` -> `### Documentation Debt`。每个 item 都会标注能填补它的 Diataxis quadrant：

```
### Documentation Debt（文档债）

- ⚠️ /new-skill — AGENTS.md 中有 reference，但 README 中没有 how-to example。Diataxis quadrant: how-to.
- ⚠️ FooProcessor — zero coverage。Diataxis quadrants: reference, explanation.
```

这是下一步的 input。每行都告诉你缺什么，以及哪个 quadrant 可以填补。

### 3. 用 /document-generate 填补 gaps

运行：

```
/document-generate
```

当 skill 询问 scope 时，告诉它 debt section 中 flagged 的 specific entities。Skill 会读取 codebase（它的 Step 1 archaeology phase 是 mandatory）、按 Diataxis quadrant partition，并写入 missing docs。

你也可以让 skill auto-discover：如果 /document-release 已明确传给它 gaps（chained 时会这样），`/document-generate` 已经知道要写什么。

### 4. 验证 gaps 已关闭

重新运行 `/document-release`：

```
/document-release
```

Coverage map 现在应该显示之前 flagged 的 entities 在之前 empty 的 quadrants 中有 green checkmarks。PR body 的 Documentation Debt section 应为空，或只剩你有意 deferred 的 items。

## 验证

打开 PR 并确认：

1. PR body 有 `## Documentation` section，并包含 doc-diff preview。
2. `### Documentation Debt` subsection 列出 zero critical gaps（或只有你明确 deferred 的 items）。
3. `docs/` 中每个 generated doc file 都能 cleanly open，并 cross-link 到 sibling docs（reference -> how-to -> tutorial -> explanation）。
4. 运行 `grep -rE '\]\([^)]*\.md\)' docs/`，确认没有 link 指向 missing file。

四项都通过后，你的 PR 就可以带着完整 documentation land。

## 故障排查

**`/document-release` reports "No public surface changes detected."**
Diff 是 internal-only（refactors、tests、infra）。不需要 docs。直接进入 landing。

**Gap 上的 Diataxis quadrant tag 和你预期不一致。**
Skill 使用 entity taxonomy 判断哪些 quadrants 重要（CLI flags 需要 reference + how-to；internal modules 需要 reference + explanation；user-facing features 需要 all four）。如果不同意，可以在 generation 后手动 edit docs。Audit 是 guide，不是 constraint。

**`/document-generate` 写出的 tutorial 需要 8 steps 才达到 working result。**
Tutorials 应在 3 steps 或更少步骤内达到 working result。重新运行 skill 并要求 compress，或手动 edit。Step 8 Quality Self-Review 会捕捉其中一些，但不是全部。

**你想 document feature，但还没有 PR。**
先运行 `/ship` 创建 PR，然后走这个 workflow。没有 PR 时，`/document-release` 仍可 audit，但会跳过 PR-body update。

**Generated reference doc hallucinated API signatures。**
提交 bug。Skill 的 Step 1 archaeology 应该 end-to-end 读取 implementation files，而不只是 signatures，专门为了防止这种问题。请包含 generated text 和 actual code，方便 trace archaeology 为什么漏掉。

## 相关

- **Tutorial：第一次使用 `/document-generate`：** [tutorial-document-generate.md](./tutorial-document-generate.md)
- **为什么 gstack 使用 Diataxis framework：** [explanation-diataxis-in-gstack.md](./explanation-diataxis-in-gstack.md)
- **Audit skill reference：** [`document-release/SKILL.md`](../document-release/SKILL.md)
- **Generation skill reference：** [`document-generate/SKILL.md`](../document-generate/SKILL.md)
