# /sync-gbrain batch ingest migration（批量摄取迁移）

**Status（状态）：** Implemented on garrytan/dublin-v1（D1-D8 decisions land in this PR）
**Branch（分支）：** garrytan/dublin-v1
**Owner（负责人）：** Garry Tan
**Triggered by（触发来源）：** /investigate run, 2026-05-09
**Estimated effort（工作量估计）：** human ~3 days / CC+gstack ~2 hr
**Files touched（涉及文件）：** 4 source + 1 test = 5 total（under estimate）

## Decisions（post-review）

本文档记录原始 architecture。最终 architecture 按以下 8 个 review decisions 落地，这些 decisions 记录在 `/Users/garrytan/.claude/plans/purrfect-tumbling-quiche.md`：

- **D1** hierarchical staging dir（按 slug segment mkdir -p）— kept
- **D2** 在同一个 PR 中 cut over + delete legacy（无 `--legacy-ingest` flag）— kept
- **D3** scan source-file first，只 stage clean — kept
- **D4** ~~three-state OK/DEGRADED/ERR verdict~~ 按 Codex finding 7 COLLAPSED to OK/ERR（gbrain content_hash idempotency 让第三种状态 redundant）
- **D5** ~~state schema 中的 skip_reason field~~ 按 Codex finding 7 DROPPED（re-runs cheap，不需要 permanent skip-tracking）
- **D6** trust gbrain 的 content_hash idempotency；drop bookkeeping scaffolding（skip_reason、three-state、SIGTERM checkpoint）
- **D7** 通过 `~/.gbrain/sync-failures.jsonl` 做 per-file failure detection（byte-offset snapshot + appended-only read）
- **D8** bundle 3 个 in-scope pre-existing fixes：F6 atomic saveState（tmp+rename）、F8 isolated-stage benchmark、F9 full-file sha256 hash（不再有 1MB cap）

## 从 gbrain source 验证过的性质

通过读取 `~/git/gbrain/src/` 验证了三个性质：

- **Idempotency** at `core/import-file.ts:242-243, :478` — content_hash check，unchanged 时 skip，changed 时 overwrite。
- **Frontmatter parity** at `core/import-file.ts:228, 297, 410-422` — title/type/tags honored；仅当 frontmatter absent 时 auto-inference。
- **Path-authoritative slug** at `core/sync.ts:260`（`slugifyPath`），在 `core/import-file.ts:429` enforce。
- **Per-file failures surface** at `commands/import.ts:308-310`，comment at `:28`："callers can gate state advances" — 这是 D7 使用的 intentional API。

## Performance：planned vs measured（post 2026-05-10 perf review）

| Metric | Plan target | Measured | Verdict |
|---|---|---|---|
| Prepare phase on 5135 files | — | <10s | FAST |
| `gbrain import` on 5135 files | — | >10 min | gbrain-side perf issue, filed |
| Loop / hang（original bug） | never | never | FIXED |
| Memory ingest exits null on SIGTERM | no | no — state writes succeed; child gbrain dies with parent | FIXED |
| FILE_TOO_LARGE blocks last_commit | no | no — failed paths excluded via D7 | FIXED |

**初始性能误判与修正。** 第一次 cold-run measurement（约 12 min）主要由 1841 个 sequential gitleaks subprocess spawns 主导，每个约 256ms，这是 redundant security gate。Cross-machine exfiltration boundary 是 `gstack-brain-sync`（bin/gstack-brain-sync:78-110，在 `git commit` 前对 staged diff 做 regex-based secret scan）。在 ingest 到 LOCAL PGLite 前扫描每个 source file 不会改变 exposure，因为 secret 已经以 plaintext 存在磁盘上。我们通过 `--scan-secrets` 把 per-file gitleaks 改为 opt-in。默认关闭。这把 prepare phase 从约 12 min 降到 10 秒以内。

剩余 cold-run cost 是 `gbrain import` 本身，它在 large staging dirs 上 scale 得比 linear 更差（501 files 10s；5031 files >10 min）。这是 gbrain-side perf issue，不是 gstack architecture。已作为 TODO filed；修复大概率在 gbrain 的 content_hash check loop 或 auto-link reconciliation phase 中。

## F9 hash migration（one-time cliff）

F9 把 `fileSha256` 从 1MB-capped hash 切到 full-file。该变更前的 existing state entries 携带旧的 1MB-capped hash。对任何 mtime 未变化的文件，`fileChangedSinceState` 会在 mtime check 返回 false，新 hash 永远不会计算，因此 unchanged files 的行为完全相同。对任何 upgrade 后 mtime 变化的文件，full-file hash 会重新计算，并且（正确地）被视为 changed，然后重新 import。`gbrain doctor` probe report 的 `updated_count` 可能在 post-upgrade 第一次 run 中显示 inflated numbers，因为每个 touched file 都跨过了 algorithm boundary。没有 data loss，但值得知道。

## 后续项（已作为 TODOs filed）

1. **gbrain import perf on large dirs** — 调查为什么 5031 files 需要 >10 min，而 501 files 只要 10s。可能原因：`getPage(slug)` content_hash check 的 N+1 SQL、per-page auto-link reconciliation、FTS index updates without batching。问题在 gbrain，不在 gstack。
2. **可选：source-file changed-detection cache** — 即使 prepare phase 已经很快，walking 5031 files 仍要一点时间。在 batch level（不是 per-file）缓存“no changes since last successful import”状态，可以在 no-op incremental run 中完全跳过 prepare phase。

## 问题

`/sync-gbrain` memory stage 在 fresh PGLite 上花 35 分钟后以 null 退出，丢失全部进度。后续 runs 会重做同样的 35 分钟。连续两次观察到这个现象（gbrain 0.30.0 broken-postgres run：712s exit-null；gbrain 0.31.2 PGLite run：2100s exit-null，实际 persisted 501 pages）。

## Root cause（from /investigate）

`bin/gstack-memory-ingest.ts` 中两个叠加 bug：

1. **Subprocess-per-file architecture。** Line 911 的 ingest loop 遍历 `~/.gstack/projects/` 中 1,841 files，并为每个 file spawn 两个 subprocesses：
   - `gitleaks detect --no-git --source <path>` — 46ms cold start（`lib/gstack-memory-helpers.ts:157`）
   - `gbrain put <slug>` — 329ms cold start（`bin/gstack-memory-ingest.ts:823`）
   - Per-file floor：375ms × 1841 = 690s（11.5 min）纯 subprocess startup，实际工作还没开始。

2. **Kill-no-save timeout。** `bin/gstack-gbrain-sync.ts:442` 的 orchestrator enforce 35-min timeout。触发时，`spawnSync` 返回 `result.status === null`，child 收到 SIGTERM，in-memory ingest state 从未 flush 到 `~/.gstack/.transcript-ingest-state.json`。下一次 run 从同一个未推进状态开始，解释了 redo-everything pattern。

## Field numbers（现场数据）

| Metric（指标） | Value（数值） | Source（来源） |
|---|---|---|
| Files in walkAllSources | 1,841 | `find ~/.gstack/projects -type f \( -name "*.md" -o -name "*.jsonl" \)` |
| `gbrain put` cold start | 329ms | `time (echo "test" \| gbrain put _bench)` |
| `gitleaks detect` cold start | 46ms | `time gitleaks detect --no-git --source <small-file>` |
| Theoretical floor（subprocess only） | 690s / 11.5 min | 375ms × 1841 |
| Observed run time | 2100s / 35 min | matches orchestrator timeout exactly |
| Pages actually persisted | 501 | gbrain sources list page_count |
| PGLite growth during run | 290 → 386 MB | `du -sh ~/.gbrain/brain.pglite` |

## Proposed architecture（拟议架构）

用 **prepare-then-batch** pipeline 替换 per-file subprocess loop：

```
walkAllSources(ctx)
  → prepareStage (in-process, fast):
       parse transcripts/artifacts
       build PageRecord with custom YAML frontmatter
       gitleaks scan (single subprocess on staging dir)
       write prepared .md to staging dir
  → gbrain import <staging-dir> --no-embed (single subprocess)
  → flush state file with all successes
  → cleanup staging dir
```

### 为什么 `gbrain import <dir>` 是正确 batch path

- 已在 gbrain CLI 中 shipped（verified：`gbrain --help` shows `import <dir> [--no-embed]`）。
- 在 gbrain 自己的 runtime 中 in-process walk dir，不会 subprocess fan-out。
- Honor gbrain 的 batch-size 和 embedding-batch tuning。
- gbrain v0.31.2 import 在 observed run 中 10 秒完成 501 pages + 2906 chunks；慢的部分是我们上面的 per-file `gbrain put` loop。

### 当前代码中要保留的正确部分

- **Custom YAML frontmatter injection**（title, type, tags）— 通过把带 frontmatter 的 prepared .md files 写入 staging dir 来保留。
- **Secret scanning** — 保留，但移动到 prepare 后、import 前的一次 `gitleaks detect --source <staging-dir>` call。带 findings 的 files 会被 redacted 或 excluded；staging dir 保证 gitleaks 只看到 prepared content，而不是 internal gbrain state。
- **Partial-transcript detection** — 在 prepare stage 保留；partial files 仍在 frontmatter 中获得 `partial: true` field。
- **Unattributed-transcript filtering** — 在 prepare stage 保留。
- **Per-file mtime + sha256 state tracking** — 保留；prepare stage 记录 staged 内容，import-success result 记录 landed 内容。
- **Incremental mode** — `fileChangedSinceState` check 保持在 prepare loop 顶部。

## Migration steps（迁移步骤）

### Step 1：从 current ingest loop 抽取 `preparePages`

取 `ingestPass`（`bin/gstack-memory-ingest.ts` lines 899-988）中 walk 和 `gbrainPutPage` call 之间的所有内容。移动到新函数 `preparePages(args, ctx, state) → { staged: PreparedPage[], skipped, failed }`。

Output：`{ slug, body, source_path, mtime_ns, sha256, partial }` 的 list，其中 `body` 是包含 frontmatter 的完整 markdown。

### Step 2：添加 staging dir writer

Pure function：`writeStaged(prepared, stagingDir) → { written, errors }`。Filename：`${slug}.md`。Idempotent overwrite。

Staging dir lifecycle：
- Created at `~/.gstack/.staging-ingest-${pid}-${ts}/`
- 即使 SIGTERM，也在 `finally` block 中清理
- 每个 ingest pass 一个 staging dir，绝不跨 runs 复用

### Step 3：single gitleaks pass

把 per-file `secretScanFile(path)` calls 替换为 prepare 后的一次调用：
`gitleaks detect --no-git --source <staging-dir> --report-format json --report-path -`。

解析 JSON output，构建 `Map<slug, findings[]>`。带 findings 的 files 在 import 前从 staging dir 移除（或按 `lib/gstack-memory-helpers.ts` 中现有 redaction policy 就地 sanitize）。

### Step 4：用单次 import call 替换 `gbrainPutPage` loop

```typescript
const importResult = spawnSync("gbrain", ["import", stagingDir], {
  stdio: ["ignore", "inherit", "inherit"],
  timeout: 30 * 60 * 1000, // generous; whole batch
});
```

解析 stdout 中的 `Import complete` line 和 `failed` count。

### Step 5：partial success 时 persist state

如果 gbrain import reports `imported=N, failed=M`，只为 N 个 successful slugs save state（不是全部）。Failures 保持 un-state'd，因此下次 retry；successes 不会重做。

### Step 6：`gstack-memory-ingest.ts` 中的 SIGTERM handler

用以下代码包住 `main()`：
```typescript
let interrupted = false;
const flush = () => {
  if (interrupted) return;
  interrupted = true;
  saveState(state); // best-effort flush of whatever's accumulated
  cleanupStagingDir();
  process.exit(143);
};
process.on("SIGTERM", flush);
process.on("SIGINT", flush);
```

这会独立解除 kill-no-save bug：即使 batch import 超过 orchestrator timeout，prepare stage 的 state 也会存活。

### Step 7：orchestrator update

在 `bin/gstack-gbrain-sync.ts:444`：
- 把 `result.status === 0` 改为 `result.status === 0 || (parsedSummary.imported > 0 && parsedSummary.imported >= parsedSummary.skipped + parsedSummary.failed)`。
  把 partial success（多数 pages imported）视为 OK，而不是 ERR。
- 在 stage summary 中 surface `failed_count` 和 `partial_blockers`，让用户看到 `Memory ... OK 487/501 imported (14 FILE_TOO_LARGE)`，而不是 `ERR exited null`。

### Step 8：专门处理 FILE_TOO_LARGE

当 gbrain reports FILE_TOO_LARGE 时，写入新的 `~/.gstack/.ingest-skip-list.json`，让下一次 prepare stage 完全 skip 该 file。避免重复 staging 永远会失败的 file。用户可以通过新的 `gstack-memory-ingest --skip-list` flag 查看 skip list。

## Test plan（测试计划）

1. **Unit（free, runs in `bun test`）：**
   - `preparePages` 对 50 files 的 fixture corpus：assert YAML correct、partial detection works、unattributed filtered。
   - `writeStaged` overwrite idempotency。
   - 使用 child-process test harness 测试 SIGTERM handler flush behavior。

2. **Integration（free, runs in `bun test`）：**
   - End-to-end：prepare → gitleaks → gbrain import on a temp PGLite，assert page_count matches imported count。
   - Partial-success path：inject a deliberate FILE_TOO_LARGE；assert successes still state'd、failure logged to skip list。
   - State preservation across SIGTERM：spawn ingest、kill at midpoint、restart、assert resumed state。

3. **Benchmark gate（periodic, paid）：**
   - Cold run on 1841-file fixture：assert under 8 min。
   - Incremental run（no changes）：assert under 60 sec。
   - Test fixture：`~/.gstack/projects/` snapshot 的 copy，用于 repeatable timing。

## Rollback strategy（回滚策略）

- `gstack-memory-ingest` 新增 `--legacy-ingest` flag，让 old per-file path 在一个 release cycle 内仍可调用。
- 如果 batch path 在真实 corpus 上 regression，设置 `gstack-config set memory_ingest_path legacy`，无需 redeploy 即可 revert。
- 确认 batch stable 后一个 minor version，移除 flag + legacy path。

## plan-eng-review 的 risks & open questions

1. **gbrain import idempotency on overlapping slugs。** 如果 previous run 已经用 old content 把 slug X 写入 PGLite，那么 updated-X 的 `gbrain import` 是 overwrite 还是 duplicate？依赖它之前需要测试。

2. **`gbrain import` parser 内的 frontmatter injection。** 当前代码知道如何向 existing frontmatter blocks 注入 title/type/tags（line 794-821）。`gbrain import` 是否像 `gbrain put` 一样 honor 这些 fields？在 unit test 中验证。

3. **Staging dir disk pressure。** 1841 files × avg ~50KB = ~92MB staging .md content。对 dev machines 可接受，但值得知道。Alternative：stream prepared content to a tar piped to import（如果 gbrain 支持）— 大概率不支持，V1 忽略。

4. **Cross-worktree concurrency。** `~/.gstack/.staging-ingest-${pid}-${ts}/` 用 pid namespace，因此两个并发 /sync-gbrain runs 不会 collide。但 orchestrator 已经在 `~/.gstack/.sync-gbrain.lock` 持有 lock，所以这是 belt-and-suspenders。保留它。

5. **"memory ingest exited null" message。** 变更后，orchestrator 在真实 OOM kills 或 SIGKILL 上可能仍会看到 status=null。Verdict block 是否应该更诚实？例如：`ERR memory: killed by signal SIGTERM at 35:00 (timeout)`。

6. **是否应该为 memory entirely deprecate `gbrain put`？** Legacy path 为 V1.5 的 `put_file` migration plan 保留。Batch import 工作后，是否仍需要 single-page put 作为 ad-hoc ingestion 的 fallback？可能需要（用于 orchestrator 之外触发的 `~/.gstack/.transcript-ingest-state.json` updates），但值得确认。

## 这不是什么

- 不是 gbrain CLI change。所有工作都在 gstack。
- 不是 CLAUDE.md voice/UX change。
- 不是新的 user-facing feature。CHANGELOG entry 会写：“Memory ingest is ~10× faster on cold runs and survives interruption.”

## Acceptance criteria（验收标准）

- 1841 files 的 cold `/sync-gbrain` 在 8 分钟内完成。
- Incremental `/sync-gbrain`（no file changes）在 60 秒内完成。
- SIGTERM mid-run 会 flush state；next run resumes，不会重做 successfully-imported files。
- FILE_TOO_LARGE failures 不会阻塞 sync.last_commit advancement。
- 所有 existing test fixtures（transcripts、learnings、design-docs、ceo-plans）都能带 full frontmatter 正确 ingest。
- partial-transcript 或 unattributed-transcript handling 无 regression。
