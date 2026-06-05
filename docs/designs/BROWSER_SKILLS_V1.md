# Browser-Skills v1 — codifying repeated browser flows（固化重复 browser flows）

**Status（状态）：** Phase 1 shipped on `garrytan/browserharness`。Phases 2-4 enumerated below。
**Last updated（最后更新）：** 2026-04-26
**Authors（作者）：** garrytan（with /plan-eng-review and /codex outside-voice review）

## 这是什么

Browser-skills 是按任务划分的目录，把重复 browser flow 固化为 deterministic Playwright script。每个 skill 包含：

```
browser-skills/<name>/
├── SKILL.md                        # frontmatter + prose contract
├── script.ts                       # deterministic logic
├── _lib/browse-client.ts           # vendored copy of the SDK
├── fixtures/<host>-<date>.html     # captured page for tests
└── script.test.ts                  # parser tests against the fixture
```

用户（或在 Phase 2 中，刚刚把 flow 跑对的 agent）只需要创建一次 skill。之后调用时直接运行 script，在 200ms 内返回 JSON，而不是让 agent 用 `$B` primitives 重新探索 30 秒。

已 shipped 的 reference 是 `hackernews-frontpage`：抓取 HN front page，返回 30 条 stories 的 JSON。可以试试 `$B skill list` 和 `$B skill run hackernews-frontpage`。

## 它与 domain-skills（v1.8.0.0）有什么不同

- **Domain-skills** = “agent 记住一个站点的事实”。按 hostname keyed 的 JSONL notes，在 session start 时注入 prompt。State machine 处理 quarantine → active → global promotion。
- **Browser-skills** = “agent 把 procedure 固化为 deterministic scripts”。按 task 的目录，通过 `$B skill run` 执行，在 daemon 侧用 scoped tokens 做 per-spawn capability isolation。

两者使用同一个 mental model（per-host、three-tier scoping）。Procedure layer 的 productivity gain 更大，因为它把 scraping 和 form automation 从 latent space 推到 reproducible code 中。

## 为什么这不是现有 P1（“self-authoring `$B` commands”）

原始 P1 被 Codex 的 T1 objection 阻塞：agent-authored TypeScript 不能安全地在 daemon *内部*运行（ambient globals、constructor gadgets、approval 和 execution 之间 top-level-await TOCTOU）。正确设计是“out-of-process worker isolation with capability-passing IPC”。这是个很重的项目，可能永远不会 ship。

Browser-skills 通过把 scripts 作为 standalone Bun processes 在 daemon *外部*运行，绕开整个问题。daemon 永远不 import 或 eval skill code。Skills 通过 loopback HTTP 与 daemon 通信，wire format 与任何 external client 使用的一样。

Approved plan 会替换现有 P1。

---

## Phasing（阶段划分）

| Phase（阶段） | Branch（分支） | Scope（范围） |
|-------|--------|-------|
| **1** | `garrytan/browserharness` | SDK、storage、`$B skill list/run/show/test/rm` subcommands、scoped-token model、bundled `hackernews-frontpage` reference。**Shipped（v1.19.0.0，与 Phase 2a consolidated）。** |
| **2a** | `garrytan/browserharness` (continues) | `/scrape <intent>`（read-only，带 match/prototype paths 的 single entry point）+ `/skillify`（把 prototype 固化为 permanent skill）。新增 `browse/src/browser-skill-write.ts` D3 atomic-write helper。**Shipping v1.19.0.0。** |
| **2b** | new (`browser-skills-automate`) | `/automate` skill template（`/scrape` 的 mutating-flow sibling）。复用 `/skillify` 和 D3 helper。运行 non-codified flow 时，对每个 mutating step 加 confirmation gate。TODOS 中 P0。 |
| **3** | new (`browser-skills-resolver`) | Session start 时做 resolver injection（per-host browser-skill discovery）。镜像 domain-skill injection。`gstack-config browser_skillify_prompts` knob。 |
| **4** | new | Eval test infrastructure（LLM-judge）、fixture-staleness detection、against live pages 的 periodic re-validation、untrusted spawns 的 OS-level FS sandbox。 |

---

## Phase 1 architecture（Phase 1 架构）

### Locked decisions（13 个锁定决策）

1. **Phase 1 = full storage + SDK + subcommands + bundled reference。** 暂不做 agent authoring。Phase 2 落地 `/scrape` 和 `/automate`。
2. **Phase 2 中两个 verbs：`/scrape`（read-only）和 `/automate`（mutating）。** 它们共享 skillify approval-gate machinery，但作为独立 skill templates 存在。
3. **替换 TODOS.md 中现有 self-authoring-`$B` P1。** 用户可见目标相同，但没有 in-daemon isolation 问题。
4. **SDK distribution：每个 skill 内的 sibling file（Option E）。** Canonical SDK 位于 `browse/src/browse-client.ts`（约 250 LOC）。每个 skill 在 `<skill>/_lib/browse-client.ts` 中携带一份 copy。Phase 2 generator 会把当前 SDK copy 到每个 generated script 旁边。每个 skill 都完全 self-contained：复制目录到任何地方都能运行。Version drift 不可能发生（SDK frozen at the version the skill was authored against）。Disk cost：每个 skill 约 3KB。
5. **Three-tier lookup：bundled → global → project。** Bundled skills 随 gstack install 以 read-only 方式 shipped（`<gstack-install>/browser-skills/<name>/`）。Global 位于 `~/.gstack/browser-skills/<name>/`。Per-project 位于 `<project>/.gstack/browser-skills/<name>/`。Lookup 按 project → global → bundled 的 priority order walking tiers；first hit wins。**`$B skill list` 会在每个 skill name 旁打印 resolved tier**，因此“为什么运行了那个？”不会成为 debugging mystery。
6. **Trust model：spawn time 的 scoped tokens，不是 env-scrub-as-sandbox。** 见下方“Trust model”。（Codex 指出原 env-scrub plan 是 security theater 后修订。）
7. **Single source of truth：只用 SKILL.md frontmatter。** 不用 `meta.json`。Frontmatter 保存 host、triggers、args、version、source、trusted。SHA256/staleness 如果落地，作为 Phase 4 的独立 `.checksum` sidecar。
8. **No INDEX.json。Walk the directory。** `$B skill list` 枚举三个 tiers 并解析每个 SKILL.md frontmatter。50 个 skills 约 5-10ms。消除整个“index drifted from disk” bug class。
9. **`$B skill run` output protocol。** stdout = JSON。stderr = streaming logs。Exit 0 / nonzero。默认 60s timeout，可通过 `--timeout=Ns` override。Max stdout 1MB（超出则 truncate + nonzero exit）。匹配 `gh` / `kubectl` / `docker` conventions。
10. **Fixture replay：两种 test type 使用两种 patterns。** SDK unit test 启动 in-test mock HTTP server。End-to-end skill tests 通过 script exported parser function 解析 bundled HTML fixtures（不需要 daemon）。Phase 1 fixture-only 对 `hackernews-frontpage` 足够；Phase 2 `/automate` 需要更丰富的 fixtures。
11. **Reference skill：`hackernews-frontpage`。** 抓取 HN front page（titles、points、comments）。无 auth，HTML 稳定，是理想 fixture-test target。
12. **Token/port discovery：spawned skills 使用 scoped-token env-only；standalone debug runs 使用 state-file fallback。** 通过 `$B skill run` spawn 时，SDK 从 env 读取 `GSTACK_PORT` + `GSTACK_SKILL_TOKEN`。对 standalone `bun run script.ts`，SDK fallback 到 `<project>/.gstack/browse.json`（`config.ts:50` 中的实际 state-file path）。
13. **CHANGELOG honesty。** Phase 1 lead：humans can hand-write deterministic browser scripts that gstack runs。Phase 1 明确说明 agent authoring 会在下一版落地。不编造 perf numbers，Phase 1 没有 before/after。

### Trust model（decision #6 in detail）

两个正交 axes：

| Axis（轴） | Mechanism（机制） | Default（默认） |
|------|-----------|---------|
| **Daemon-side capability** | Per-spawn scoped token bound to `read+write` scope（17-cmd browser-driving surface，减去 `eval`/`js`/`cookies`/`storage` 等 admin commands）。Single-use clientId 编码 skill name + spawn id。Spawn exit 时 revoke。 | Always scoped（never the daemon root token）。 |
| **Process-side env access** | SKILL.md frontmatter `trusted: true` 传递 `process.env` minus `GSTACK_TOKEN`。`trusted: false`（default）丢弃除 minimal allowlist（LANG、LC_ALL、TERM、TZ、locked PATH）外的一切，并显式剥离 secret-pattern keys（TOKEN/KEY/SECRET/PASSWORD、AWS_*、AZURE_*、GCP_*、ANTHROPIC_*、OPENAI_*、GITHUB_* 等）。 | Untrusted（必须 opt in）。 |

`GSTACK_PORT` 和 `GSTACK_SKILL_TOKEN` 总是最后注入，因此 parent process 不能通过提前设置 env 来覆盖它们。

**做对的地方：** daemon-side scoped token 可由 daemon enforce。一个 skill 即使 SDK 暴露了 `eval`，只要它尝试调用 `eval`（admin scope），就会得到 403。Capability boundary 放在正确位置。

**没有关闭的地方：** Bun 没有内置 FS sandbox。Untrusted skill 仍可 `import 'fs'` 并读取 OS user 可读的一切（例如 `~/.ssh/id_rsa`）。Env scrub 是 hygiene，不是 sandbox。OS-level isolation（`sandbox-exec`、namespaces）是 Phase 4 work，并且可以干净地接到现有 trusted/untrusted contract 后面。

原计划把 env-scrub 称为 sandbox。Codex 正确指出那是 theater。修订后的 plan 称它为它实际是什么：best-effort hygiene + defense-in-depth，真正边界在 daemon-side scoped token。

### File layout（文件布局）

```
browse/src/
├── browse-client.ts                # canonical SDK (~250 LOC)
├── browser-skills.ts               # 3-tier walk + frontmatter parser + tombstones
├── browser-skill-commands.ts       # $B skill list/show/run/test/rm + spawnSkill
└── skill-token.ts                  # mintSkillToken / revokeSkillToken wrappers

browser-skills/
└── hackernews-frontpage/           # bundled reference skill
    ├── SKILL.md
    ├── script.ts
    ├── _lib/browse-client.ts        # byte-identical copy of canonical
    ├── fixtures/hn-2026-04-26.html
    └── script.test.ts

browse/test/
├── skill-token.test.ts              # mint/revoke lifecycle, scope assertions
├── browse-client.test.ts            # mock HTTP server, wire format, auth
├── browser-skills-storage.test.ts   # 3-tier walk, frontmatter, tombstones
└── browser-skill-commands.test.ts   # parseRunArgs, dispatch, env scrub, spawn

test/skill-validation.test.ts       # extended: bundled-skill contract checks
```

### 不改变什么

- Domain-skills storage、state machine 或 injection。完全不动。
- Tunnel-surface allowlist（`server.ts:118-123`）。同样 17 commands。
- L1-L6 security stack。Browser-skills 在 Phase 1 不把 text 注入 prompts；Phase 3 的 resolver injection 会沿用现有 UNTRUSTED envelope。
- `cli.ts` 中的 `sendCommand()` HTTP client。SDK 是单独 module，关注点不同（library vs CLI process）。

---

## Codex outside-voice findings（post-review responses，评审后回应）

/codex review 标记了 8 个 findings。Plan 逐项处理如下：

| # | Finding（发现） | Phase 1 response（Phase 1 回应） |
|---|---------|------------------|
| 1 | Trust model is fake without FS sandbox | **Closed** by decision #6（scoped tokens）。 |
| 2 | Phase 1 is overbuilt for one bundled skill（lookup tiers、tombstones 等） | **Acknowledged but kept。** 用户选择 full Phase 1，以便在 Phase 2 agent authoring 落地前锁定架构。每个 subsystem 都小到如果数据之后说明无用，可以干净移除。 |
| 3 | Existing client pattern in `cli.ts:398` may make sibling SDK redundant | **Verified false。** Line 398 是 `extractTabId()`（flag-parser）的末尾。实际 HTTP client 是 cli.ts:401-467 的 `sendCommand()`，但它 CLI-coupled（`process.stdout.write`、`process.exit`、server-restart recovery）。不能复用为 library。新的 `browse-client.ts` 镜像其 wire format，但 shaped as library。 |
| 4 | "First hit wins" lookup 不透明 | **已缓解**：在 `$B skill list` 和 `$B skill show` 中 inline listing resolved tier。未来：如果 tier override 证明令人困惑，可加 optional `--source bundled\|global\|project` flag。 |
| 5 | Atomic skill packaging matters more than the index question; symlink defenses | **Closed for Phase 1**：bundled skills 作为 gstack install 的一部分 shipped（无 live writes；因为是 install dir 中的 read-only files，天然 atomic）。Phase 2 的 `writeBrowserSkill` 会先写 temp dir，再 rename，并使用 `realpath`/`lstat` discipline（现有 `browse/src/path-security.ts`）。 |
| 6 | Phase 2 synthesis from activity feed is weak（lossy ring buffer） | **Open issue for Phase 2 design。** Activity feed 是 telemetry，不是 replay IR。Phase 2 需要 structured recorder，或者 re-prompt agent 使用自己的 context 从头写 script。Phase 2 design pass 决定。 |
| 7 | Bun runtime regression：skill scripts as standalone Bun reintroduce a Bun runtime requirement | **Open issue for Phase 2 distribution。** Phase 1 避开这个问题，因为 bundled reference skill shipped 在 gstack install 内（gstack 已经用 Bun build）。Phase 2 需要在 (a) 每个 generated skill 附带 Bun binary，(b) 编译 skills 为 self-contained executables，(c) 使用 Node.js + `cli.ts` HTTP pattern 之间选择。 |
| 8 | `file://` fixtures don't prove timing/auth/navigation/lazy hydration | **Documented limit。** 对 `hackernews-frontpage` 足够。Phase 2 `/automate` 需要更丰富的 fixtures（mock daemon with timing、recorded HAR replay 等）。 |

---

## Phase 2a — `/scrape` + `/skillify`（shipping v1.19.0.0）

两个 skill templates 加一个 helper module。`/scrape <intent>` 是拉取 page data 的 single entry point；在新 intent 上第一次调用时通过 `$B` primitives prototype 并返回 JSON，之后对 matching intent 的调用会 route 到 codified browser-skill，约 200ms 返回。`/skillify` 会把最近一次 successful prototype 固化为磁盘上的 permanent browser-skill。Mutating-flow sibling `/automate` 延后到 Phase 2b（TODOS 中 P0）。

### v1.19.0.0 plan review（`/plan-eng-review`）期间锁定的 decisions

| ID | Decision（决策） | Locked behavior（锁定行为） |
|----|----------|-----------------|
| **D1** | `/skillify` provenance guard | 向回扫描 ≤10 个 agent turns，寻找 clearly-bounded `/scrape` invocation（prototype 的 intent line + trailing JSON output）。如果找不到，拒绝并输出：*"No recent /scrape result found in this conversation. Run /scrape <intent> first, then say /skillify."* 不 silent fallback。 |
| **D2** | Synthesis input slice | Template 指示 agent 只抽取产生用户接受 JSON 的 final-attempt `$B` calls，以及用户声明的 intent string。丢弃 failed selector attempts、unrelated chat、earlier-session content。通过选择 option (b)（从 agent 自己的 context re-prompt，而不是 structured recorder）关闭 Codex finding #6。 |
| **D3** | Atomic write discipline | `/skillify` 写入 `~/.gstack/.tmp/skillify-<spawnId>/`，对 temp dir 运行 `$B skill test`，只有在 success + user approval 后才 rename 到 final tier path。Test failure 或 approval rejection 时：完整 `rm -rf` temp dir（never-approved skills 不产生 tombstone）。新增 module `browse/src/browser-skill-write.ts`（`stageSkill` / `commitSkill` / `discardStaged`），按 Codex finding #5 使用 `realpath`/`lstat` discipline。 |
| **D4** | Test scope | 5 个 gate-tier E2E（scrape match、scrape prototype、skillify happy、skillify provenance refusal、approval-gate reject）+ 1 个 unit test（atomic-write helper failure cleanup）+ 1 个 hand-verified smoke（mutating-intent refusal）。注册到 `test/helpers/touchfiles.ts`。 |

### Carry-overs（延续项）

- **默认 tier：global。** Procedures 更适合 lean global，在 `/skillify` time 提供 per-project override（镜像 domain-skill scope）。Phase 1 storage helpers 支持两种 lookup paths。
- **Bun runtime distribution。** Codex finding #7 保持 open。Phase 2a 假设 PATH 上有 Bun（gstack 已经通过 `setup:6-15` 要求）。记录在 `/skillify` SKILL.md "Limits"。真正修复在 Phase 4。

## Phase 2b — `/automate` sketch（草案）

`/scrape` 的 mutating-flow sibling。使用相同 skillify pattern（原样复用 `/skillify` 和 D3 helper）。区别是：以 non-codified 方式运行时，每个 mutating step 都有 UNTRUSTED-wrapped summary + `AskUserQuestion` confirmation gate。Codification 后，skill 可以 unattended 运行（codified script 明确枚举会执行哪些 `$B click`/`fill`/`type` calls）。见 `TODOS.md` 中 P0 entry。

## Phase 3 sketch（Phase 3 草案）

Session start 时做 resolver injection。镜像 `server.ts:722-743` 的 domain-skill injection：

```ts
const browserSkillsBlock = await renderBrowserSkillsForHost(hostname, projectSlug);
if (browserSkillsBlock) {
  systemPrompt += `\n\n${browserSkillsBlock}`;
}
```

`renderBrowserSkillsForHost()` 读取 3 tiers，筛选 `host` field 匹配的 skills，并 emit 一个 UNTRUSTED-wrapped block 列出它们。

`gstack-config browser_skillify_prompts`（default off）：开启后，如果 activity feed 显示在单个 host 上有 ≥N commands，且该 host+intent 还不存在 skill，则 `/qa`、`/design-review` 等会在 end-of-task nudges 中触发。

## Phase 4 sketch（Phase 4 草案）

- LLM-judge eval（“agent 是否使用 skill 而不是重新探索？”）。
- Fixture-staleness detection：对比 bundled fixture 与 live page。
- Untrusted spawns 的 OS-level FS sandbox（macOS 上 `sandbox-exec`，Linux 上 namespaces / seccomp）。
- `$B skill upgrade <name>`：canonical SDK 变化时重新生成 sibling SDK copy。

---

## 验证（Phase 1）

`bun test` 通过新的 test files：
- `browse/test/skill-token.test.ts` — 15 assertions
- `browse/test/browse-client.test.ts` — 26 assertions
- `browse/test/browser-skills-storage.test.ts` — 31 assertions
- `browse/test/browser-skill-commands.test.ts` — 29 assertions
- `browser-skills/hackernews-frontpage/script.test.ts` — 13 assertions
- `test/skill-validation.test.ts` — 7 new bundled-skill assertions

Daemon running 时的 end-to-end：

```bash
$B skill list                            # shows hackernews-frontpage (bundled)
$B skill show hackernews-frontpage       # prints SKILL.md
$B skill run hackernews-frontpage        # returns JSON of 30 stories
$B skill test hackernews-frontpage       # runs script.test.ts
```
