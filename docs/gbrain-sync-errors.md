# gbrain-sync 错误查询

`gstack-brain-*` 可能打印的每条 error message，以及对应的问题、原因和修复方式。

可按 `BRAIN_SYNC:` 后的 prefix，或 command output 中的 binary name 搜索本文档。

---

## `BRAIN_SYNC: brain repo detected: <url>`

**问题：** 当前机器有 `~/.gstack-brain-remote.txt`（从另一台机器 copy 而来），但 `~/.gstack/.git` 中没有 local git repo。

**原因：** 你已经在别处设置过 GBrain sync，但这台机器上的 gstack 尚未 restore。

**修复：**
```bash
gstack-brain-restore
```
这会把 repo pull 到 `~/.gstack/`，并重新注册 merge drivers。

如果不想在这里 restore，用以下命令 dismiss hint：
```bash
gstack-config set artifacts_sync_mode_prompted true
```

---

## `BRAIN_SYNC: blocked: <pattern-family>:<snippet>`

**问题：** Secret scanner 在 staged file 中检测到 credential-shaped content，因此 sync stopped。Queue 会保留；没有任何内容被 pushed。

**原因：** 某个 pre-commit secret pattern 匹配了 file contents，可能是 AWS key、GitHub token、OpenAI key、PEM block、JWT，或嵌入 JSON 的 bearer token。

**修复（三种选项）。**

1. **如果是真 secret**：编辑 offending file 移除 secret，然后重新运行任意 skill retry sync。

2. **如果 pattern 是 false positive**（例如 learning 中包含你想发布的 example string，而该 string 长得像 GitHub token pattern）：
   ```bash
   gstack-brain-sync --skip-file <path>
   ```
   这会从 future syncs 中永久 exclude 该 path。

3. **如果你想完全 abandon 这个 sync batch**（start fresh）：
   ```bash
   gstack-brain-sync --drop-queue --yes
   ```
   这会 clear queue 而不 commit。未来 writes 会正常重新 populate。

---

## `BRAIN_SYNC: push failed: auth.`

**问题：** Git push 被 rejected，因为你对 remote 的 auth expired 或 missing。

**原因：** 使用当前 credentials 无法访问 remote。

**修复：** 根据 remote refresh auth：

- **GitHub**: `gh auth status`（然后按需 `gh auth refresh`）
- **GitLab**: `glab auth status`
- **Other**: `git remote -v` + 检查 SSH keys 或 credential helper

修复 auth 后，运行任意 skill 自动 retry sync。

---

## `BRAIN_SYNC: push failed: <first-line-of-error>`

**问题：** Push 因 auth 之外的原因失败。Git error 的第一行会显示在冒号后。

**原因：** 可能是 network issue、rejected push（remote ahead）、server 500，或 repo access revoked。

**修复：** 查看 `~/.gstack/.brain-sync-status.json` 获取更多细节，或运行：
```bash
cd ~/.gstack && git status && git push origin HEAD
```
查看 git full error。任何 push attempt 后 queue 都会 clear，但 local commit 仍存在；下一次 skill run 会 retry push。

---

## `gstack-brain-init: ~/.gstack/.git is already a git repo pointing at <url>`

**问题：** 你尝试使用一个与 existing remote 不匹配的 remote URL init。

**原因：** 你已经用另一个 remote 运行过 `gstack-brain-init`。

**修复：** 二选一：

- 使用 existing remote：运行不带 `--remote` 的 `gstack-brain-init`，或使用 matching URL。
- 切换 remotes：先运行 `gstack-brain-uninstall`，再用 new URL re-init。这不会删除你的 data。

---

## `Remote not reachable: <url>`

**问题：** Init 无法访问 git remote 来 verify connectivity。

**原因：** Wrong URL、missing auth、network issue。

**修复：** 手动测试：
```bash
git ls-remote <url>
```
如果失败，检查：
- URL spelling
- GitHub: `gh auth status`
- GitLab: `glab auth status`
- Private network / VPN / DNS

---

## `gstack-brain-init: failed to create or find '<name>'`

**问题：** 通过 `gh repo create` auto-repo-creation failed，且 repo 也无法通过 `gh repo view` discover。

**原因：** `gh` 未认证、同名 repo 已由他人拥有，或你的 GitHub account hit quota。

**修复：**
```bash
gh auth status
```
如果未认证，运行 `gh auth login`。如果 repo name collision，传入不同 name：
```bash
gstack-brain-init --remote git@github.com:YOURUSER/custom-name.git
```

---

## `gstack-brain-restore: ~/.gstack/.git already points at <url>`

**问题：** 你尝试从一个与 existing git config 不匹配的 URL restore。

**原因：** 上一次使用不同 remote init 留下 stale `.git`。

**修复：** 运行 `gstack-brain-uninstall`，然后重新运行 `gstack-brain-restore <url>`。

---

## `gstack-brain-restore: ~/.gstack/ has existing allowlisted files that would be clobbered`

**问题：** 你正在尝试 restore，但 `~/.gstack/` 已包含会被 overwritten 的 learnings 或 plans。

**原因：** 要么（a）这台机器从 pre-sync gstack session 积累了 state，要么（b）上一次 failed restore 留下 partial state。

**修复（三种选项）。**

1. **如果这台机器的 state 应成为 new truth**：运行 `gstack-brain-init` 而不是 restore。这会基于本机 state 创建 brand-new brain repo。

2. **如果你想 adopt remote 并丢弃本机 state**：先 backup `~/.gstack/projects/`，然后移除 offending files 并重新运行 restore。

3. **如果你想 merge**：这里没有 automatic merge。手动把 `~/.gstack/` 中的 learnings copy 到一台已开启 sync 的机器上的 running gstack 中，然后在这里 restore。

---

## `gstack-brain-restore: <url> does not look like a gstack-brain repo`

**问题：** Clone succeeded，但 repo 缺少 `.brain-allowlist` 和 `.gitattributes`。

**原因：** 你把 restore 指向了 random git repo，或有人从 brain repo 删除了 canonical config files。

**修复：** 验证 URL。如果它正确，运行 `gstack-brain-init --remote <url>` 重新 seed canonical config。

---

## 没有同步，但我以为会同步

**不是 error，但很常见。** 按顺序检查：

1. `gstack-brain-sync --status`：mode 是否是 `off`？
2. `~/.gstack/.git` 是否存在？
3. `gstack-config get artifacts_sync_mode`：应为 `full` 或 `artifacts-only`。
4. 你期待 sync 的 file 是否在 allowlist 中？
   `cat ~/.gstack/.brain-allowlist`
5. Privacy class filter：如果 mode 是 `artifacts-only`，behavioral files（timelines、developer-profile）会被故意跳过。

如果这些都正常，运行：
```bash
gstack-brain-sync --discover-new
gstack-brain-sync --once
```
强制 drain。
