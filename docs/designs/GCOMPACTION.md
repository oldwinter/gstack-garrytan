# GCOMPACTION.md — Design & Architecture（设计与架构，TABLED）

**Approval 后目标路径：** `docs/designs/GCOMPACTION.md`

这是为 `gstack compact` 保留的设计 artifact。下面第一个 `---` divider 之前的所有内容，会在 plan approval 时原样抽取到 `docs/designs/GCOMPACTION.md`。divider 之后的内容是归档研究（office hours + competitive deep-dive + eng-review notes + codex review + research findings），为本设计提供依据。

---

## Status: TABLED（2026-04-17）— 等待 Anthropic `updatedBuiltinToolOutput` API

**为什么搁置：** v1 架构假设 Claude Code `PostToolUse` hook 可以替换进入模型 context 的 built-in tools（Bash、Read、Grep、Glob、WebFetch）的 tool output。2026-04-17 的研究确认：今天做不到。

**证据：**

1. **Official docs**（https://code.claude.com/docs/en/hooks）：`PostToolUse` 中唯一记录的 output-replace 字段是 `hookSpecificOutput.updatedMCPToolOutput`，文档明确说明：*"For MCP tools only: replaces the tool's output with the provided value."* built-in tools 没有等价字段。
2. **Anthropic issue [#36843](https://github.com/anthropics/claude-code/issues/36843)**（OPEN）：Anthropic 自己承认这个缺口。*"PostToolUse hooks can replace MCP tool output via `updatedMCPToolOutput`, but there is no equivalent for built-in tools (WebFetch, WebSearch, Bash, Read, etc.)... They can only add warnings via `decision: block` (which injects a reason string) or `additionalContext`. The original malicious content still reaches the model."*
3. **RTK mechanism**（source-reviewed at `src/hooks/init.rs:906-912` and `hooks/claude/rtk-rewrite.sh:83-100`）：RTK 不是 PostToolUse compactor。它是一个 **PreToolUse** Bash matcher，会重写 `tool_input.command`（例如 `git status` → `rtk git status`）。wrapped command 自己产出 compact stdout。RTK README 确认：*"the hook only runs on Bash tool calls. Claude Code built-in tools like Read, Grep, and Glob do not pass through the Bash hook, so they are not auto-rewritten."* RTK 只支持 Bash 是架构限制，不是选择。
4. **tokenjuice mechanism**（source-reviewed at `src/core/claude-code.ts:160, 491, 540-549`）：tokenjuice 确实注册了 `PostToolUse` 且 `matcher: "Bash"`，但没有真正可用的 output-replace API，它用 `decision: "block"` + `reason` 注入压缩文本。这样是否真正减少 model-context tokens，还是只 overlay UI output，存在争议。tokenjuice 也是 Bash-only。
5. **Read/Grep/Glob execute in-process inside Claude Code**，并完全绕过 hooks。Wedge (ii) “native-tool coverage” 从第一天起就是架构上不可能，不论 replacement API 是否存在。

**Consequence（后果）：** 两个 wedge 的原始形态都失效：

- Wedge (i) “Conditional LLM verifier” — 技术上仍可做，但只能针对 Bash output，通过 PreToolUse command wrapping（RTK 的机制）。一旦我们也只是 Bash-only，verifier 不再是差异化。
- Wedge (ii) “Native-tool coverage” — 今天不可能。Read/Grep/Glob 不触发 hooks。即便某些 tools 触发 `PostToolUse`，non-MCP tools 也没有 output-replacement 字段。

**Decision（决策）：** 完全搁置 `gstack compact`。跟踪 Anthropic issue #36843，等待 `updatedBuiltinToolOutput`（或等价 API）。当该 API 发布后，这份设计文档、下面 15 条 locked decisions 以及底部 research archive，将成为新 implementation sprint 的 unblock artifacts。

**如果解除搁置：** 从下面 “plan-eng-review 期间锁定的决策” block 开始，大多数仍然有效。然后重新核对 hooks reference 和新发布 API，更新 Architecture data-flow diagram，使用真实 output-replacement 字段，并在 coding 前对修订计划重新运行 `/codex review`。

**我们不做什么：**

- 不发布 Bash-only PreToolUse wrapper。那是 RTK 的产品；他们有 28K stars 和 3 年 rule scars。没有 wedge。
- 不发布 `decision: block` + `reason` hack。未文档化行为，Anthropic 可能破坏它，而且模型可能仍然在 compacted overlay 旁边看到 raw output，context savings 有争议。
- 不单独发布 B-series benchmark。没有可工作的 compactor，就没有可 benchmark 的东西。

**Cost of tabling（搁置成本）：** 约 0。没有写代码。设计文档、研究和决策仍然保留为 ready-to-unblock artifact。

---

## plan-eng-review 期间锁定的决策（2026-04-17）

如果 Anthropic 发布 built-in-tool output-replace API，这些内容为 un-tabling sprint 保留。

下面是 engineering review 期间做出的所有决策摘要。完整 rationale 保留在后续 sections；如果其他部分漂移，此 block 是 single source of truth。

**Scope（范围，Section 0）：**

1. **Claude-first v1.** v1 只在 Claude Code 上发布 compact + rules + verifier。Codex + OpenClaw 在 primary host 上证明 wedge 后落到 v1.1。这样减少约 2 天 host integration，并降低 launch 风险。原始 “wedge (ii) native-tool coverage” claim 在 v1 中只适用于 Claude Code；直到 v1.1 之前不做 cross-host claim。
2. **13-rule launch library.** v1 发布 tests（jest/vitest/pytest/cargo-test/go-test/rspec）+ git（diff/log/status）+ install（npm/pnpm/pip/cargo）。Build/lint/log families 推迟到 v1.1，由真实用户的 `gstack compact discover` telemetry 驱动。
3. **Verifier default ON at v1.0.** `failureCompaction` trigger（exit≠0 AND >50% reduction）默认启用。Verifier 就是 wedge，默认关闭会隐藏差异化特性。Trigger bounds 已经把预期 fire rate 控制在 ≤10% tool calls。

**架构（Section 1）：**

4. **Exact line-match sanitization for Haiku output.** 按 `\n` 拆分 raw output，把 lines 放入 set，只追加 Haiku 输出中在该 set 里逐字存在的 lines。这是最严格的 adversarial contract；prompt-injection attempts 无法混入新文本。
5. **Layered failureCompaction signal.** 优先使用 envelope 中的 `exitCode`；如果 host 省略它，则 fallback 到 output 上的 `/FAIL|Error|Traceback|panic/` regex。把触发的 signal 记录到 `meta.failureSignal`（`"exit"` | `"pattern"` | `"none"`）。Pre-implementation task #1 仍然要实证验证 Claude Code envelope，但即便没有 exitCode，系统也不会坏。
6. **Deep-merge rule resolution.** User/project rules 继承未 override 的 built-in fields。Escape hatch：rule file 中的 `"extends": null` 触发 full replacement semantics。符合 eslint/tsconfig/.gitignore 的心智模型：override 一部分，不丢其他部分。

**Code quality（代码质量，Section 2）：**

7. **Per-rule regex timeout, no RE2 dep.** 每条 rule 的 regex 用 50ms AbortSignal budget 运行；超时则跳过 rule，并记录 `meta.regexTimedOut: [ruleId]`。避免 WASM dependency，同时不限制 rule author 的语法。
8. **Pre-compiled rule bundle.** `gstack compact install` 和 `gstack compact reload` 生成 `~/.gstack/compact/rules.bundle.json`（deep-merged，并缓存 regex-compiled metadata）。Hook 读取这个单文件，而不是解析 N 个 source files。
9. **Auto-reload on mtime drift.** Hook 启动时 stat rule source files；如果任何 source file 比 bundle 新，就在 applying 前 inline rebuild。每次 invocation 增加约 0.5ms，但消除“我改了 rule 却没生效”的 footgun。
10. **Expanded v1 redaction set.** Tee files redact：AWS keys、GitHub tokens（`ghp_/gho_/ghs_/ghu_`）、GitLab tokens（`glpat-`）、Slack webhooks、generic JWT（三段 base64）、generic bearer tokens、SSH private-key headers（`-----BEGIN * PRIVATE KEY-----`）。Credit cards / SSNs / per-key env-pairs 推迟到 v2 的完整 DLP layer。

**Testing（测试，Section 3）：**

11. **P-series gate subset.** v1 gate-tier P-tests：P1（binary garbage）、P3（empty output）、P6（RTK-killer critical stack frame）、P8（secrets to tee）、P15（hook timeout）、P18（prompt injection）、P26（malformed user rule JSON）、P28（regex DoS）、P30（Haiku hallucination）。剩余 21 个 P-cases 随真实 bugs 进入 R-series。
12. **Fixture version-stamping.** 每个 golden fixture 都有 `toolVersion:` frontmatter。当 fixture toolVersion ≠ 当前安装版本时 CI warning。不再基于日历轮换。
13. **B-series real-world benchmark testbench (hard v1 gate).** 新组件 `compact/benchmark/` 扫描 `~/.claude/projects/**/*.jsonl`，对最吵的 tool calls 排名，把它们聚类为命名 scenarios，重放 compactor，并报告 reduction-by-rule-family。v1 只有在作者自己的 30-day corpus 上 B-series 显示 ≥15% reduction 且 planted bugs 零 critical-line loss 时才能发布。Local-only；绝不上传。Community-shared corpus 是 v2。

**Performance（性能，Section 4）：**

14. **Revised latency budgets.** Bun cold-start 在 macOS ARM 上是 15-25ms；原始 10ms p50 target 不现实。新 budgets：macOS ARM 上 <30ms p50 / <80ms p99，Linux 上 <20ms p50 / <60ms p99（verifier off）。Verifier-fires budget 保持 <600ms p50 / <2s p99。Daemon mode 是 v2 option，取决于 B-series 是否显示 cold-start 明显伤害 session savings。
15. **Line-oriented streaming pipeline.** Readline over stdin → filter → group → dedupe → ring-buffered tail truncation → stdout。任何单行 >1MB 触发 P9（truncate 到 1KB 并加 `[... truncated ...]` marker）。不论总 output 多大，memory cap 64MB。

上面每一行都是 implementation 中的 `MUST`。任何 drift 都需要新的 eng-review。

---

## Summary（摘要）

`gstack compact` 被设计为一个 `PostToolUse` hook，用于在 tool-output 到达 AI coding agent 的 context window 之前减少噪音。确定性的 JSON rules 会压缩 noisy test runners、build logs、git diffs 和 package installs。一个 conditional Claude Haiku verifier 会在 over-compaction 风险高时充当 safety net。

**Current status（当前状态）：TABLED.** 见上方 “Status” section。架构依赖一个 Claude Code API（用于 built-in tools 的 `updatedBuiltinToolOutput` 或等价物），截至 2026-04-17 并不存在。Anthropic issue #36843 跟踪这个缺口。

**Intended goal（预期目标，为解除搁置后的 sprint 保留）：** 每个长 session 减少 15-30% tool-output tokens，且 task-failure rate 零增加。

**Original wedge（原始差异点，vs RTK 这个 28K-star incumbent）— 二者都已被研究推翻：**

1. ~~**Conditional LLM verifier.**~~ 通过 PreToolUse command wrapping 技术上仍可行，但只针对 Bash。一旦我们也 Bash-only，就不再差异化。如果 built-in-tool API 到来，再重新考虑。
2. ~~**Native-tool coverage.**~~ 今天架构上不可能。Read/Grep/Glob 在 Claude Code 内部 in-process 执行，不触发 hooks。即便对会触发 `PostToolUse` 的 tools，non-MCP tools 也没有 output-replacement 字段。

**Original positioning（原始定位，现已 moot）：** *"RTK is fast. gstack compact is fast AND safe, and it covers every tool in your toolbox, not just Bash."*（RTK 很快；gstack compact 又快又安全，并覆盖 agent toolbox 中的每个 tool，而不只是 Bash。）

## Non-goals（非目标）

- 总结用户消息或 prior agent turns（Claude 自己的 Compaction API 负责）。
- 压缩 agent response output（caveman 的层）。
- 缓存 tool calls 以避免重新执行（token-optimizer-mcp 的层）。
- 充当 general-purpose log analyzer。
- 用 `GSTACK_RAW=1` 替代 agent 自己判断何时重跑命令。

## 为什么值得构建

**问题已被测量，不是假设：**

- [Chroma research (2025)](https://research.trychroma.com/context-rot) 测试了 18 个 frontier models。所有模型都会随着 context 变长而退化。Rot 在 window limit 前很早就开始，200K model 到 50K 时就会 rot。
- Coding agents 是最坏情况：accumulative context + high distractor density + long task horizon。Tool output 被明确点名为主要 noise source。
- 市场已经投票：Anthropic 发布 Opus 4.6 Compaction API；OpenAI 发布 compaction guide；Google ADK 发布 context compression；LangChain 发布 autonomous compression；sst/opencode 内置 compaction。Hybrid deterministic + LLM pattern 是行业共识。

**Existing field（gstack compact 要进入并区分自己的现有领域）：**

| Project（项目） | Stars | License | Layer（层级） | Threat（威胁） | Note（说明） |
|---------|-------|---------|-------|--------|------|
| **RTK (rtk-ai/rtk)** | **28K** | Apache-2.0 | Tool output | Primary benchmark | Pure Rust, Bash-only, zero LLM |
| caveman | 34.8K | MIT | Output tokens | Different axis | Terse system prompt; pairs WITH us |
| claude-token-efficient | 4.3K | MIT | Response verbosity | Different axis | Single CLAUDE.md |
| token-optimizer-mcp | 49 | MIT | MCP caching | Different axis | Prevents calls rather than compresses output |
| tokenjuice | ~12 | MIT | Tool output | Too new | 2 days old; inspired our JSON envelope |
| 6-Layer Token Savings Stack | — | Public gist | Recipe | Zero | Documentation; validates stacked compaction thesis |

RTK 是唯一直接竞争对手。其他项目压缩的是不同 token source。

**License compatibility（license 兼容性）：** 每个被引用项目都是 permissive-licensed（MIT 或 Apache-2.0），与 gstack 的 MIT license 兼容。干净室政策见下方 “License & attribution” section。

## 架构

### Data flow（数据流）

```
┌─────────────────────────────────────────────────────────────────┐
│  Host (Claude Code / Codex / OpenClaw)                          │
│  ─────────────────────────────────────────                      │
│  1. Agent requests tool call: Bash|Read|Grep|Glob|MCP           │
│  2. Host executes tool                                          │
│  3. Host invokes PostToolUse hook with: {tool, input, output}   │
└────────────────────┬────────────────────────────────────────────┘
                     │ stdin (JSON envelope)
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  gstack-compact hook binary                                     │
│  ───────────────────────────                                    │
│  a. Parse envelope                                              │
│  b. Match rule by (tool, command, pattern)                      │
│  c. Apply rule primitives: filter / group / truncate / dedupe   │
│  d. Record reduction metadata                                   │
│  e. Evaluate verifier triggers                                  │
│  f. If trigger met: call Haiku, append preserved lines          │
│  g. On failure exit code: tee raw to ~/.gstack/compact/tee/...  │
│  h. Emit JSON envelope to stdout                                │
└────────────────────┬────────────────────────────────────────────┘
                     │ stdout (JSON envelope)
                     ▼
              Host substitutes compacted output into agent context
```

### Rule resolution（规则解析）

三层 hierarchy（最高 precedence 生效），与 tokenjuice 和 gstack 现有 host-config-export model 相同：

1. Built-in rules：gstack 自带的 `compact/rules/`
2. User rules：`~/.config/gstack/compact-rules/`
3. Project rules：`.gstack/compact-rules/`

Rules 按 rule ID 匹配 tool calls。ID 为 `tests/jest` 的 project rule 会完整 override built-in `tests/jest`。不做 merging，使用 replace semantics，保持推理简单。

### JSON envelope contract（JSON envelope 约定，adopted from tokenjuice）

Input:

```json
{
  "tool": "Bash",
  "command": "bun test test/billing.test.ts",
  "argv": ["bun", "test", "test/billing.test.ts"],
  "combinedText": "...",
  "exitCode": 1,
  "cwd": "/Users/garry/proj",
  "host": "claude-code"
}
```

Output:

```json
{
  "reduced": "compacted output with [gstack-compact: N → M lines, rule: X] header",
  "meta": {
    "rule": "tests/jest",
    "linesBefore": 247,
    "linesAfter": 18,
    "bytesBefore": 18234,
    "bytesAfter": 892,
    "verifierFired": false,
    "teeFile": null,
    "durationMs": 8
  }
}
```

### Rule schema（规则 schema）

紧凑、最小。Total rules-payload 必须保持在磁盘上 <5KB（来自 claude-token-efficient 的教训：rule files 本身会在每个 session 消耗 tokens）。

```json
{
  "id": "tests/jest",
  "family": "test-results",
  "description": "Jest/Vitest output — preserve failures and summary counts",
  "match": {
    "tools": ["Bash"],
    "commands": ["jest", "vitest", "bun test"],
    "patterns": ["jest", "vitest", "PASS", "FAIL"]
  },
  "primitives": {
    "filter": {
      "strip": ["\\x1b\\[[0-9;]*m", "^\\s*at .+node_modules"],
      "keep": ["FAIL", "PASS", "Error:", "Expected:", "Received:", "✓", "✗", "Tests:"]
    },
    "group": {
      "by": "error-kind",
      "header": "Errors grouped by type:"
    },
    "truncate": {
      "headLines": 5,
      "tailLines": 15,
      "onFailure": { "headLines": 20, "tailLines": 30 }
    },
    "dedupe": {
      "pattern": "^\\s*$",
      "format": "[... {count} blank lines ...]"
    }
  },
  "tee": {
    "onExit": "nonzero",
    "maxBytes": 1048576
  },
  "counters": [
    { "name": "failed", "pattern": "^FAIL\\s", "flags": "m" },
    { "name": "passed", "pattern": "^PASS\\s", "flags": "m" }
  ]
}
```

四个 primitives：`filter`、`group`、`truncate`、`dedupe`，直接来自 RTK 的 technique taxonomy（每个严肃 compactor 都必须处理的东西）。任何 rule 可以组合四者的任意子集；省略的 primitives 是 no-ops。

### Verifier layer（分层、opt-in 验证器）

Verifier 是廉价 Haiku call，只在特定 triggers 下触发。绝不对每次 tool call 触发。

**Trigger matrix (user-configurable):**

| Trigger | Default（默认） | Condition（条件） |
|---------|---------|-----------|
| `failureCompaction` | **ON** | exit code ≠ 0 AND reduction >50% (diagnosis at risk) |
| `aggressiveReduction` | off | reduction >80% AND original >200 lines |
| `largeNoMatch` | off | no rule matched AND output >500 lines |
| `userOptIn` | on (env-gated) | `GSTACK_COMPACT_VERIFY=1` forces verifier for that call |

Default config 只开启 `failureCompaction`，这是最高杠杆场景：agent 正在 debugging；rule 可能过滤掉关键 stack frame。

**Haiku 的职责（有边界）：**

```
Here is raw output (truncated to first 2000 lines) and a compacted version.
Return any important lines from the raw that are missing from the compacted,
or `NONE` if nothing critical is missing.
```

中文语义（不替代上面的 verifier prompt 原文）：给 Haiku 原始输出（截断到前
2000 行）和 compacted version；让它返回 compacted 中遗漏的重要 raw lines，
如果没有 critical omissions 就返回 `NONE`。

Verifier 从不重写 compacted output。它只在 header 下追加 missing lines：

```
[gstack-compact: 247 → 18 lines, rule: tests/jest]
[gstack-verify: 2 additional lines preserved by Haiku]
  TypeError: Cannot read property 'foo' of undefined
    at parseConfig (src/config.ts:42:18)
```

**为什么用 Haiku 而不是 Sonnet：** 成本约 1/12，延迟约 500ms vs 2s，而且任务是简单 substring classification，不是 reasoning。

**Verifier config (`compact/rules/_verifier.json`):**

```json
{
  "verifier": {
    "enabled": true,
    "model": "claude-haiku-4-5-20251001",
    "maxInputLines": 2000,
    "triggers": {
      "aggressiveReduction": { "enabled": false, "thresholdPct": 80, "minLines": 200 },
      "failureCompaction":   { "enabled": true,  "minReductionPct": 50 },
      "largeNoMatch":        { "enabled": false, "minLines": 500 },
      "userOptIn":           { "enabled": true, "envVar": "GSTACK_COMPACT_VERIFY" }
    },
    "fallback": "passthrough"
  }
}
```

**Failure modes（故障模式；verifier 严格只做追加，绝不破坏 baseline）：**

- 没有 `ANTHROPIC_API_KEY` → 跳过 verifier，使用 pure rule output。
- Haiku call timeout（>5s）→ 跳过 verifier，使用 pure rule output。
- Haiku 返回 malformed JSON → 跳过，使用 pure rule output。
- Haiku 返回 prompt-injection attempt → sanitize：只追加与 original raw output substring-matches 的 lines。
- Haiku 返回 hallucinated lines（raw 中不存在）→ drop。

### Tee mode（adopted from RTK）

任何 exit code ≠ 0 的 command，完整未过滤 output 会写到 `~/.gstack/compact/tee/{timestamp}_{cmd-slug}.log`。Compacted output 包含 tee-file pointer：

```
[gstack-compact: 247 → 18 lines, rule: tests/jest, tee: ~/.gstack/compact/tee/20260416-143022_bun-test.log]
```

如果 agent 需要完整 stack trace，可以直接读取 tee file。这用更干净的设计替代了早期 `onFailure.preserveFull` mechanic：compacted output 永远保持小；raw output 永远只差一个 `cat`。

**Tee safety:**

- File mode `0600`，不 world-readable。
- Built-in secret-regex set 在写入前 redact AWS keys、bearer tokens 和常见 credential patterns。
- Failed writes（read-only filesystem、permission denied）优雅降级：仍然 emit compacted output，记录 `meta.teeFailed: true`。
- Tee files 7 天后 auto-expire（hook startup cleanup）。

### Host integration matrix（Host 集成矩阵）

| Host | Hook type | Supported matchers | Config path |
|------|-----------|-------------------|-------------|
| Claude Code | `PostToolUse` | Bash, Read, Grep, Glob, Edit, Write, WebFetch, WebSearch, mcp__* | `~/.claude/settings.json` |
| Codex (v1.1) | `PostToolUse` equivalent | Bash (primary); tool subset TBD — empirical verification is a v1.1 prereq | `~/.codex/hooks.json` |
| OpenClaw (v1.1) | Native hook API | Bash + MCP | OpenClaw config |

**v1 是 Claude-first。** Wedge (ii)，即 native-tool coverage，通过 [hooks reference](https://code.claude.com/docs/en/hooks) 在 Claude Code 上确认。Codex 和 OpenClaw integration 只在 v1.1 发布，且前提是在 primary host 上通过 B-series benchmark data 证明 wedge。v1 的 CHANGELOG 明确 Claude-only scope。

### Config surface（配置界面）

User config (`~/.config/gstack/compact.toml`):

```toml
[compact]
enabled = true
level = "normal"                            # minimal | normal | aggressive (caveman pattern)
exclude_commands = ["curl", "playwright"]   # RTK pattern

[compact.bundle]
auto_reload_on_mtime_drift = true           # hook rebuilds bundle if source rule files are newer
bundle_path = "~/.gstack/compact/rules.bundle.json"

[compact.regex]
per_rule_timeout_ms = 50                    # AbortSignal budget per regex; timeout → skip rule

[compact.verifier]
enabled = true
trigger_failure_compaction = true
trigger_aggressive_reduction = false
trigger_large_no_match = false
failure_signal_fallback = true              # use /FAIL|Error|Traceback|panic/ when exitCode missing
sanitization = "exact-line-match"           # only append lines present verbatim in raw output

[compact.tee]
on_exit = "nonzero"
max_bytes = 1048576
redact_patterns = ["aws", "github", "gitlab", "slack", "jwt", "bearer", "ssh-private-key"]
cleanup_days = 7

[compact.benchmark]
local_only = true                           # hard-coded; config is documentary, cannot be changed
transcript_root = "~/.claude/projects"
output_dir = "~/.gstack/compact/benchmark"
scenario_cap = 20                           # top-N clusters by aggregate output volume
```

**Intensity levels (caveman pattern):**

- **minimal:** 只用 `filter` + `dedupe`；不 truncate。最安全。
- **normal:** `filter` + `dedupe` + `truncate`。默认。
- **aggressive:** 添加 `group`；更多 savings，更多 edge-case risk。

### CLI surface（CLI 界面）

| Command | Purpose（用途） | Source（来源） |
|---------|---------|--------|
| `gstack compact install <host>` | 在 host config 中注册 PostToolUse hook；构建 `rules.bundle.json` | new |
| `gstack compact uninstall <host>` | 幂等移除 | new |
| `gstack compact reload` | 编辑 user/project rules 后重建 `rules.bundle.json` | new |
| `gstack compact doctor` | 检测 drift / broken hook config，并提供修复 | tokenjuice |
| `gstack compact gain` | 展示随时间累计的 token/dollar savings（per-rule breakdown） | RTK |
| `gstack compact discover` | 找出没有 matching rule 的 commands，按 noise volume 排序 | RTK |
| `gstack compact verify <rule-id>` | 在 fixture 上 dry-run verifier | new |
| `gstack compact list-rules` | 展示 deep-merge（built-in + user + project）后的 effective rule set | new |
| `gstack compact test <rule-id> <fixture>` | 把 rule 应用到 fixture 并展示 diff | new |
| `gstack compact benchmark` | 对 local transcript corpus 运行 B-series testbench（见 Benchmark section） | new |

Escape hatch：`GSTACK_RAW=1` env var 在命令期间完全 bypass hook（与 tokenjuice 的 `--raw` flag 类似）。如果任何 source rule file 的 mtime 比 bundle file 新，hook 也会 auto-reload bundle。

## File layout（文件布局）

```
compact/
├── SKILL.md.tmpl              # template; regen via `bun run gen:skill-docs`
├── src/
│   ├── hook.ts                # entry point; reads stdin, writes stdout; mtime-checks bundle
│   ├── engine.ts              # rule matching + reduction metadata
│   ├── apply.ts               # primitive application (line-oriented streaming pipeline)
│   ├── merge.ts               # deep-merge of built-in/user/project rules; honors `extends: null`
│   ├── bundle.ts              # compile source rules → rules.bundle.json (install/reload)
│   ├── primitives/
│   │   ├── filter.ts
│   │   ├── group.ts
│   │   ├── truncate.ts        # ring-buffered tail; safe for arbitrary input size
│   │   └── dedupe.ts
│   ├── regex-sandbox.ts       # AbortSignal-bounded regex execution (50ms budget per rule)
│   ├── verifier.ts            # Haiku integration (triggers + failure-signal fallback + sanitization)
│   ├── sanitize.ts            # exact-line-match filter for verifier output
│   ├── tee.ts                 # raw-output archival with secret redaction + 7-day cleanup
│   ├── redact.ts              # secret-pattern set (AWS/GitHub/GitLab/Slack/JWT/bearer/SSH)
│   ├── envelope.ts            # JSON I/O contract parsing + validation
│   ├── doctor.ts              # hook drift detection + repair
│   ├── analytics.ts           # gain + discover queries against local metadata
│   └── cli.ts                 # argv dispatch; one thin dispatch per subcommand
├── benchmark/                 # B-series testbench (hard v1 gate)
│   └── src/
│       ├── scanner.ts         # walk ~/.claude/projects/**/*.jsonl; pair tool_use × tool_result
│       ├── sizer.ts           # tokens per call (ceil(len/4) heuristic); rank heavy tail
│       ├── cluster.ts         # group high-leverage calls by (tool, command pattern)
│       ├── scenarios.ts       # emit B1-Bn real-world scenario fixtures
│       ├── replay.ts          # run compactor against scenarios; measure reduction
│       ├── pathology.ts       # layer planted-bug P-cases on top of real scenarios
│       └── report.ts          # dashboard: per-scenario before/after + overall reduction
├── rules/                     # v1 built-in JSON rule library (13 rules)
│   ├── tests/
│   │   ├── jest.json
│   │   ├── vitest.json
│   │   ├── pytest.json
│   │   ├── cargo-test.json
│   │   ├── go-test.json
│   │   └── rspec.json
│   ├── install/
│   │   ├── npm.json
│   │   ├── pnpm.json
│   │   ├── pip.json
│   │   └── cargo.json
│   ├── git/
│   │   ├── diff.json
│   │   ├── log.json
│   │   └── status.json
│   ├── _verifier.json         # verifier config (not a rule per se)
│   └── _HOLD/                 # v1.1 rule families (not shipped at v1; kept for reference)
│       ├── build/
│       ├── lint/
│       └── log/
└── test/
    ├── unit/
    ├── golden/
    ├── fuzz/                  # P-series — v1 gate subset only (P1/P3/P6/P8/P15/P18/P26/P28/P30)
    ├── cross-host/            # v1: claude-code.test.ts only; codex/openclaw stub files
    ├── adversarial/           # R-series — grows with shipped bugs
    ├── benchmark/             # B-series scenario fixtures + expected reduction ranges
    ├── fixtures/              # version-stamped golden inputs (toolVersion: frontmatter)
    └── evals/
```

## Testing Strategy（测试策略）

Test plan 故意全面。我们要发布到一个已有 28K-star incumbent、积累三年 regex battle-scars 的领域；我们的 wedges（Haiku verifier + native-tool coverage）还引入新的 failure surfaces。这意味着我们对“the compactor made my agent dumb”病毒式传播只有一次机会。零容忍。

### Test tiers（测试层级）

| Tier（层级） | Cost（成本） | Frequency（频率） | Blocks merge（是否阻塞合并） |
|------|------|-----------|--------------|
| Unit | 免费，<1s | every PR | 是 |
| Golden file（带 `toolVersion:` frontmatter） | 免费，<1s | every PR | 是 |
| Rule schema validation | 免费，<1s | every PR | 是 |
| Fuzz（P-series gate subset: P1/P3/P6/P8/P15/P18/P26/P28/P30） | 免费，<10s | every PR | 是 |
| Cross-host E2E — v1 仅 Claude Code | 免费，~1min | every PR（gate tier） | 是 |
| E2E with verifier（mocked Haiku） | 免费，~15s | every PR | 是 |
| E2E with verifier（real Haiku） | 付费，~$0.10/run | 触及 verifier files 的 PR | 是 |
| **B-series benchmark（真实世界 scenarios）** | **免费，~2min** | **pre-release gate** | **是（v1 hard gate）** |
| Token-savings eval（E1-E4 synthetic） | 付费，~$4/run | periodic weekly | 否（informational） |
| Adversarial regression（R-series） | 免费，<5s | every PR | 是 |
| Tool-version drift warning | 免费，<1s | every PR | 仅 warning |

Test file layout:

```
compact/test/
├── unit/
│   ├── engine.test.ts         # rule matching + primitive application
│   ├── primitives.test.ts     # filter / group / truncate / dedupe
│   ├── envelope.test.ts       # JSON input/output contract
│   ├── triggers.test.ts       # verifier trigger evaluation
│   └── verifier.test.ts       # Haiku call (mocked)
├── golden/
│   ├── tests/                 # one fixture per test runner
│   │   ├── jest-success.input.txt
│   │   ├── jest-success.expected.txt
│   │   ├── jest-fail.input.txt
│   │   ├── jest-fail.expected.txt
│   │   └── ... (vitest, pytest, cargo-test, go-test, rspec)
│   ├── install/
│   ├── git/
│   ├── build/
│   ├── lint/
│   └── log/
├── fuzz/
│   └── pathological.test.ts   # P-series
├── cross-host/
│   ├── claude-code.test.ts
│   ├── codex.test.ts
│   └── openclaw.test.ts
├── adversarial/
│   └── regression.test.ts     # R-series; past bugs that must never recur
├── fixtures/
│   └── {tool}/                # shared raw output fixtures
└── evals/
    └── token-savings.eval.ts  # periodic-tier; measures real reduction
```

### G-series: good cases（好路径，必须产生预期压缩）

| ID | Scenario（场景） | Expected reduction（预期压缩） |
|----|----------|-------------------|
| G1 | `jest` 47 个通过的 tests，clean run | 150+ lines → ≤10 lines |
| G2 | `jest` 47 个 tests 且 2 个 failures | 200+ lines → 保留两个 failures + summary |
| G3 | `vitest` 使用 `--reporter=verbose` 运行 | 300+ lines → ≤15 lines |
| G4 | `pytest` collection then run | 保留 failure tracebacks |
| G5 | `cargo test` with one panic | panic location 逐字保留 |
| G6 | `go test -v` 且 200 个 subtests passing | 折叠为 `PASS: 200 subtests` |
| G7 | `git diff` 在 500 lines context 中有 2 个 hunks | 保留 hunks，丢弃 context |
| G8 | `git log -50` | 保留 SHA + subject + author，丢弃 body |
| G9 | `git status` with 30 modified files | 按 directory 分组 |
| G10 | `pnpm install` fresh | final count + warnings；丢弃 resolved packages |
| G11 | `pip install -r requirements.txt` | 丢弃 download progress；保留 final install list + errors |
| G12 | `cargo build` success | 丢弃 compilation progress；保留 final target |
| G13 | `docker build` success | 丢弃 layer pulls；保留 final image digest |
| G14 | `tsc --noEmit` clean | compact to `tsc: 0 errors` |
| G15 | `tsc --noEmit` with 3 errors | 保留所有 3 个 errors 及 location |
| G16 | `eslint .` clean | compact to `eslint: 0 problems` |
| G17 | `eslint .` with violations | 按 rule 分组；保留 location + fix suggestion |
| G18 | `docker logs -f` with 1000 repeating lines | dedupe with count: `[last message repeated 973 times]` |
| G19 | `kubectl get pods -A` | group by namespace |
| G20 | `ls -la` deep tree | directory grouping (RTK pattern) |
| G21 | `find . -type f` 10K files | group by extension with counts |
| G22 | `grep -r "foo" .` with 500 hits | cap at 50; suffix `[... 450 more matches; use --ripgrep for full]` |
| G23 | `curl -v https://api.example.com` | 去掉 verbose headers；保留 response body |
| G24 | `aws ec2 describe-instances` 50 instances | columnar summary |

### P-series: pathological cases（病理用例，必须不能破坏 agent）

如果我们做错任何一个，这些都会把“nice feature”变成“catastrophic regression”。

| ID | Scenario（场景） | Required behavior（必须行为） |
|----|----------|-------------------|
| P1 | Output 中有 binary garbage（non-UTF8 bytes） | 原样 pass through；不要 crash |
| P2 | ANSI escape explosion（10K+ codes） | 干净 strip，不要 choke regex |
| P3 | Empty output（`""`） | 原样 pass through empty；不要 inject header |
| P4 | Stdout+stderr interleaved | Rule 能 match across both streams |
| P5 | Truncated output（SIGPIPE mid-stream） | 不要 mis-compact partial output |
| P6 | **Failed test，critical stack frame at line 4 of 200** | 绝不能 filter 该 frame（RTK-killer case） |
| P7 | Exit 0 但 output 中有 `ERROR:` | Rule 不能只信 exit code |
| P8 | Output 包含 AWS key / bearer token / password | Tee file 绝不能 world-readable；compacted output 中要 redact |
| P9 | Single-line minified JS error（40KB one line） | Truncate 到前 1KB；追加 `[... truncated ...]` |
| P10 | Unicode（emoji、RTL、combining chars、CJK） | Byte-safe truncation；不要 split codepoints |
| P11 | Two rules match same command | Deterministic priority：最长 `match.commands` prefix wins；tie → rule ID alphabetical |
| P12 | Rule 的 compacted output 匹配另一个 rule 的 pattern | 不做 recursive application；hook 每次 tool call 只运行一次 |
| P13 | Command 的 quoted arg 中包含 embedded newlines | Rule 不应 misparse args |
| P14 | Concurrent tool calls（parallel Bash invocations） | Hook 中没有 shared mutable state；每个 call 都 isolated |
| P15 | Hook execution >5s | Pass through raw；emit `meta.timedOut: true` |
| P16 | Haiku API offline/rate-limited | 静默跳过 verifier；使用 pure rule output |
| P17 | Haiku returns malformed JSON | 跳过 verifier；绝不要把 raw response feed 给 agent |
| P18 | Haiku response contains prompt-injection (`"Ignore all prior instructions..."`) | Sanitize：只追加 original raw output 的 substring-matched lines |
| P19 | 1M-line output | Stream-process, cap memory at 64MB; truncate with clear marker |
| P20 | Rapid-fire: 50 tool calls / sec | Hook latency 保持 <15ms p99 |
| P21 | Command with shell redirects (`cmd >file 2>&1`) | Match on the underlying command name, not the redirect wrapper |
| P22 | Deeply nested quotes/escapes in command string | Robust arg parser; no shell injection possible |
| P23 | NULL bytes in output | Strip safely; don't truncate |
| P24 | Command exits 后又继续写 stderr | Hook receives final combined output；gracefully handle |
| P25 | Read-only filesystem / no tee write permission | 优雅降级；仍 emit compacted output；记录 `meta.teeFailed: true` |
| P26 | User's rule JSON is malformed | Skip that rule; emit warning to stderr; don't break hook |
| P27 | Rule references a non-existent primitive field | Ignore unknown field; apply rest of rule |
| P28 | Rule regex has catastrophic backtracking | RE2-compatible engine (no backtracking) OR per-rule timeout |
| P29 | Exit code 137（OOM kill） | Rule 按 generic failure 处理；保留 full output |
| P30 | Haiku returns lines NOT present in raw output（hallucination） | 丢弃 hallucinated lines；只保留 substring matches |

### CH-series: cross-host E2E（跨 host 端到端）

每个 scenario 在每个 supported host 上运行。相同 input，相同 expected output。如果某 host 不支持某 matcher，该 test 标记为 `skip-on-{host}`，并用 comment 链接 upstream limitation。

| ID | 场景 | Hosts |
|----|----------|-------|
| CH1 | 通过 `gstack compact install <host>` 安装 hook | Claude Code, Codex, OpenClaw |
| CH2 | Uninstall hook 可重复运行且 idempotent | All |
| CH3 | Re-install 不会 duplicate entries | All |
| CH4 | Hook 与用户其他 PostToolUse hooks 共存 | All |
| CH5 | Hook 会在 Bash tool 上触发 | All |
| CH6 | Hook 会在 Read tool 上触发 | Claude Code (confirmed); Codex/OpenClaw verify-then-require |
| CH7 | Hook fires on Grep tool | Same as CH6 |
| CH8 | Hook fires on Glob tool | Same as CH6 |
| CH9 | Hook fires on MCP tool (`mcp__*` matcher) | Claude Code; verify on others |
| CH10 | Config precedence：project > user > built-in | All |
| CH11 | `GSTACK_RAW=1` env var bypasses hook | All |
| CH12 | Rule ID override works (project rule replaces built-in) | All |
| CH13 | `gstack compact doctor` detects drift on each host | All |
| CH14 | Hook error 不会 crash agent session | All |

Implementation note：cross-host tests 复用 `golden/` tree 的 fixture corpus；harness 把每个 fixture 包装成 host-specific hook invocation envelope，并断言 output 在 hosts 之间 byte-identical（除 `host` field 外）。

### V-series: verifier tests（付费验证器测试）

| ID | Scenario（场景） | Expected（预期） |
|----|----------|----------|
| V1 | Rule 把 200-line test output 压到 5 lines，exit=1 | Verifier fires（failure + >50% reduction），追加任何 missing critical lines |
| V2 | Rule 把 10-line output 压到 9 lines，exit=1 | Verifier 不触发（reduction too small） |
| V3 | Rule 把 200-line output 压到 5 lines，exit=0 | Verifier 不触发（success path, default config） |
| V4 | `aggressiveReduction` trigger enabled，300 lines → 20 lines，exit=0 | Verifier fires |
| V5 | 设置 `GSTACK_COMPACT_VERIFY=1` env var | Verifier 对该 call 触发一次 |
| V6 | 缺少 `ANTHROPIC_API_KEY` | Verifier 静默 skipped；返回 raw rule output |
| V7 | Verifier mocked to return "NONE" | Output 与 pure-rule path 完全相同 |
| V8 | Verifier mocked to return prompt injection | Injection discarded；只追加 substring-matched lines |
| V9 | Verifier mocked to time out >5s | Skipped；`meta.verifierTimedOut: true` |
| V10 | Verifier mocked to return 500 error | Skipped；返回 rule output |

### R-series: adversarial regression（对抗回归）

v1 ship 后捕获的每个 bug 都获得永久 R-series test。一开始为空，随着 scars 增长。Template：

```
R{N}: {commit-sha} — {1-line summary}
Scenario: {reproducer}
Fix: {PR link}
```

### Performance budgets（性能预算；CI enforced，按真实 Bun cold-start 修订）

| Metric（指标） | Target（目标） | Hard limit（硬限制） |
|--------|--------|-----------|
| Hook overhead macOS ARM (verifier disabled) | <30ms p50 | <80ms p99 |
| Hook overhead Linux (verifier disabled) | <20ms p50 | <60ms p99 |
| Hook overhead (verifier fires) | <600ms p50 | <2s p99 |
| Bundle deserialize (rules.bundle.json) | <2ms | <10ms |
| mtime drift check (stat of source files) | <0.5ms | <3ms |
| Single-regex execution budget (per rule) | <5ms | <50ms (hard abort) |
| Memory per hook invocation (line-streamed) | <16MB typical | <64MB max |
| Total rule-payload size on disk (source files) | <5KB | <15KB |
| Compiled bundle size on disk | <25KB | <80KB |

Daemon mode 是 v2 optimization。如果作者 corpus 上的 B-series benchmark 显示 cold-start 对 session-total savings 有明显伤害（例如 total hook overhead >5% of saved tokens' wall time），就提升到 v1.1。

### B-series real-world benchmark testbench（真实世界基准测试台，hard v1 gate）

**为什么存在：** 每个竞争 compactor 都会发布精挑细选 fixture numbers。B-series 在用户启用 hook 前证明 compactor 对用户自己的实际 coding sessions 有效。它既是 ship-gate，也是 marketing artifact。

**架构（组件位于 `compact/benchmark/src/`）：**

```
┌──────────────────────────────────────────────────────────────┐
│  1. SCAN     scanner.ts walks ~/.claude/projects/**/*.jsonl  │
│              → pairs tool_use × tool_result blocks           │
│              → emits {tool, command, outputBytes, lineCount, │
│                estimatedTokens, sessionId, timestamp}        │
├──────────────────────────────────────────────────────────────┤
│  2. RANK     sizer.ts sorts corpus by estimatedTokens desc   │
│              → cluster.ts groups by (tool, command-pattern)  │
│              → identifies heavy-tail: which 10% of calls     │
│                produced 80% of the tokens?                   │
├──────────────────────────────────────────────────────────────┤
│  3. SCENARIO scenarios.ts emits fixture files:               │
│              B1_bun_test_heavy.jsonl                         │
│              B2_git_diff_huge.jsonl                          │
│              B3_tsc_errors_production.jsonl                  │
│              B4_pnpm_install_fresh.jsonl ... (one per        │
│              high-leverage cluster, up to ~20 scenarios)     │
├──────────────────────────────────────────────────────────────┤
│  4. REPLAY   replay.ts runs compactor against each scenario, │
│              measures token reduction + diff of dropped lines│
│              → per-rule reduction numbers                    │
│              → per-scenario before/after token counts        │
├──────────────────────────────────────────────────────────────┤
│  5. PATHOLOGY pathology.ts injects planted critical lines    │
│              (line 4 of 200 in a failing test fixture) into  │
│              real B-scenarios. Confirms verifier restores    │
│              them. Real data + real threats = real proof.    │
├──────────────────────────────────────────────────────────────┤
│  6. REPORT   report.ts emits HTML + JSON dashboard to        │
│              ~/.gstack/compact/benchmark/latest/              │
│              "On YOUR 30 days of Claude Code data, gstack    │
│              compact would save X tokens in Y scenarios."    │
└──────────────────────────────────────────────────────────────┘
```

**v1 ship gate（v1 硬性交付门槛）：**

- 在作者自己的 30-day transcript set 聚合 scenario corpus 上，总 token reduction ≥15%。
- Planted-bug scenarios 中 zero critical-line loss（每个 planted stack frame 必须通过 rule 或 verifier 保留下来）。
- 没有 scenario 在新 rules 下退化到 <5% reduction（捕捉 over-compaction edge cases）。

**Privacy（隐私，non-negotiable）：**

- 只本地读取 `~/.claude/projects/**/*.jsonl`。绝不上传。绝不分享。绝不把 scenarios 记录到 telemetry。
- Output files 位于 `~/.gstack/compact/benchmark/`，mode `0600`。
- Command 打印 confirmation banner：*"Scanning local transcripts at ~/.claude/projects/ (local-only; nothing leaves this machine)."*
- 未来任何 community corpus 都是 v2 的独立 workstream，来自手动贡献、经过 secret-scanned 的 OSS project fixtures。

**Ports from analyze_transcripts（从 analyze_transcripts 移植，TypeScript 重新实现；不是 subprocess call）：**

- JSONL parsing + tool_use/tool_result pairing pattern（来自 `event_extractor.rb`）。
- Token estimate `ceil(len/4)`（同 char-ratio heuristic；足够 ranking）。
- Event-type taxonomy（`bash_command`、`file_read`、`test_run`、`error_encountered`）用于 scenario clustering。
- Stress-fixture generation pattern 用于 pathology layering。

**我们不 port 什么：** behavioral scoring、pgvector embeddings、decision-exchange graphs、velocity metrics、Rails/ActiveRecord layer。它们超出范围；也不是我们要测量的东西。

### Synthetic token-savings evals（E-series，定期运行/仅供参考）

保留原计划，但现在仅作为 informational，因为 B-series 才是真 gate。

- **E1:** 在 medium TypeScript project 上模拟 30-min coding session。测量启用/不启用 gstack compact 时的 total tokens。Target：≥15% reduction。
- **E2:** 同一 session，`level=aggressive`。Target：≥25% reduction，test-failure 零增加。
- **E3:** 同一 session，只开启 `failureCompaction` verifier。Verifier fire rate ≤10% tool calls。
- **E4:** adversarial，在 test output 中注入 planted bug，确认 verifier 恢复 critical stack frame。

### Test corpus sourcing（测试语料来源）

对每个 rule family，捕获 3+ real outputs：

1. 在真实 project 上运行 tool（TS 用 gstack 自身；Rust/Go/Python 用热门 OSS）。
2. 把 stdout+stderr+exit code 捕获到带 `toolVersion:` frontmatter 的 fixture file（例如 `jest@29.7.0`）。
3. 手写一次 expected compacted output。
4. Golden file test：rule application 必须产生 byte-identical output。
5. CI drift warning：如果 installed tool version 与 fixture 的 `toolVersion:` 不同，CI warning（不 fail）。Pre-release 时检查 drift-warning dashboard。

来源：

- tokenjuice 的 fixture directory patterns（`tests/fixtures/`）
- RTK 的 per-command examples（其 README 列出 real before/after metrics；独立验证）
- gstack 自己的 test output（eat our own dog food）
- `~/.gstack/compact/tee/` 中的 real failure archives（一旦 volunteers 贡献）
- **B-series real-world scenarios 是 reduction measurements 的 primary corpus。**

## Pattern adoption table（模式采纳表）

从竞争格局借鉴的具体 patterns：

| From（来源） | Adopt as（采纳为） | Why（原因） |
|------|----------|-----|
| RTK | 4 reduction primitives（filter/group/truncate/dedupe）作为 JSON rule verbs | 严肃 compactor 的基本门槛 |
| RTK | `gstack compact tee` 用于 failure-mode raw save | 比原始 `onFailure.preserveFull` design 更好 |
| RTK | `gstack compact gain` + `gstack compact discover` | 信任 + 持续改进 |
| RTK | `exclude_commands` per-user blocklist | 必备配置 |
| tokenjuice | hook I/O 的 JSON envelope contract | 干净的 machine adapter |
| tokenjuice | `gstack compact doctor` | Hooks 会 drift；self-repair 很重要 |
| caveman | Intensity levels（minimal/normal/aggressive） | 用户可调的 safety/savings knob |
| claude-token-efficient | Rules-file size budget（总计 <5KB） | 不膨胀 context |

## Rollout plan（发布计划）

**ALL PHASES TABLED（所有阶段搁置）pending Anthropic `updatedBuiltinToolOutput` API.** 见本文顶部 Status section。下面 rollout 是 API 发布且本设计 un-tables 后的目标 sequence。

### Un-tabling checklist（API 到来后按顺序执行）

1. **确认新 API 的 shape。** 阅读更新后的 Claude Code hooks reference。捕获一个真实 envelope，包含 Bash、Read、Grep、Glob 的新 output-replacement 字段。记录到 `docs/designs/GCOMPACTION_envelope.md`。
2. **重新验证 wedge。** 新 API 是否覆盖 Read/Grep/Glob（它们现在是否会触发 `PostToolUse`），还是只覆盖 Bash/WebFetch？如果仍是 Bash-only，wedge (ii) 继续死亡，product 在 implementation 前需要新 pitch。
3. **用新 API 重新运行 `/plan-eng-review`。** 15 条 locked decisions 大多应可继承；调整 Architecture data-flow 和任何依赖 envelope 的 decisions。
4. **重新运行 `/codex review`。** API 存在后，prior BLOCK verdict 中关于 hook substitution 的 concerns 消失；剩余 criticals（B-series privacy、regex DoS、JSON-envelope streaming）仍然适用。
5. **执行下面的 original rollout。**

### Original rollout（为 un-tabling 保留的原始发布计划）

每一 tier 都依赖前一 tier 通过所有 gate-tier tests。Claude-first：Codex 和 OpenClaw 在 primary host 上证明 wedge 后落到 v1.1。

1. **v0.0 (1 day):** rule engine + 4 primitives + line-oriented streaming pipeline + deep-merge + bundle compiler + envelope contract + 仅 `tests/*` family 的 golden tests。尚无 host integration。测量 offline fixtures savings。
2. **v0.1 (1 day):** Claude Code hook integration + `gstack compact install` + mtime-based auto-reload。作为 opt-in 发布；默认 off。邀请 10 位 gstack power users 试用；收集 feedback。
3. **v0.5 (1 day):** B-series benchmark testbench（`compact/benchmark/`）。发布 `gstack compact benchmark`，让用户在自己的数据上测量。收集 dogfooders 从一开始就是匿名/不上传的 reduction numbers。
4. **v1.0 (1 day):** verifier layer，默认开启 `failureCompaction` trigger + exact-line-match sanitization + layered exitCode/pattern fallback + expanded tee redaction set。**Hard ship gate:** 作者 30-day local corpus 上的 B-series 显示 ≥15% total reduction 且 planted bugs 零 critical-line loss。发布 CHANGELOG entry，主打 wedge framing（v1 Claude Code only）。
5. **v1.1 (+1 day):** Codex + OpenClaw hook integration。Cross-host E2E suite green。Build/lint/log rule families 由 `gstack compact discover` 推导 priority 后 landing。
6. **v1.2+:** 扩展 rule families、community rule contribution workflow、community-corpus benchmark（手写 public fixtures，独立于 local B-series）。

## 风险分析

| 风险 | 严重性 | 缓解措施 |
|------|----------|------------|
| RTK responds by adding an LLM verifier | Low | Creator 明确偏好 zero-dependency Rust。先 ship，建立 pattern library。 |
| Platform compaction subsumes us（Anthropic Compaction API in Claude Code） | Medium | 我们工作在不同 layer（per-tool output vs whole-context）。定位为互补能力。 |
| Rules drop something critical → "compactor made my agent dumb" | High | B-series real-world benchmark 作为 hard ship gate；tee mode always available；failures 默认开启 verifier；exact-line-match sanitization。 |
| Haiku cost creep（triggers fire more than expected） | Medium | E3 eval + B-series fire-rate metric；cost 在 `gstack compact gain` 中可见；如果 rate >10%，v1.1 加 per-session rate cap。 |
| Rule maintenance debt（jest/vitest output formats change） | Medium | `toolVersion:` fixture frontmatter + CI drift warning；community rule PRs；`discover` flags bypassing commands。 |
| Rules file bloats context | Low | CI-enforced <5KB source + <25KB compiled bundle budget；schema-validation 时给出 per-rule size warning。 |
| Regex DoS blocks the agent | Medium | 每条 rule 50ms AbortSignal budget；timeout 记录到 `meta.regexTimedOut`；反复失败的 stale rules 会 quarantine。 |
| Bundle staleness silently breaks user edits | Low | 每次 hook invocation 做 mtime-check 并 auto-rebuild；`gstack compact reload` 是 backup，不是 requirement。 |
| Benchmark leaks user's private data | High | 设计上 local-only：no network call、mode-0600 output、runtime explicit banner。v1 ship 前做 privacy review。 |

## Open questions（开放问题）

1. ~~Does Codex's PostToolUse hook support matchers for Read/Grep/Glob?~~（Deferred to v1.1 — Claude-first at v1.）
2. ~~Does OpenClaw's hook API support PostToolUse specifically?~~（Deferred to v1.1。）
3. Verifier model 应该 pin，还是像 gstack 其他 AI calls 一样 version-tracked？（倾向 pin `claude-haiku-4-5-20251001`，并在 CHANGELOG 中显式 bump。）
4. ~~Built-in secret-redaction regex set for tee files~~ **（resolved: expanded set — AWS/GitHub/GitLab/Slack/JWT/bearer/SSH-private-key. See decision #10.）**
5. `gstack compact discover` 是否应通过 Haiku 提议 auto-generated rules？（Deferred to v2；有 skill-creep 风险。）
6. **New:** Claude Code 的 PostToolUse envelope 是否包含 `exitCode`？（仍需按 pre-implementation task #1 实证验证；无论如何系统现在有 layered fallback。）
7. **New:** B-series 合适的 scenario-count cap 是多少？`cluster.ts` 可以根据 heavy-tail shape 产生 5-50 scenarios。Plan：按 aggregate output volume 取 top 20 clusters。

## Pre-implementation assignment（编码前必须完成）

1. **实证验证 Claude Code 的 PostToolUse envelope 内容。** 发布 no-op hook；确认 `exitCode`、`command`、`argv`、`combinedText` 都存在。这是 wedge (ii) native-tool coverage 以及 `failureCompaction` trigger 的 pivot。输出：`docs/designs/GCOMPACTION_envelope.md`，包含 Bash + Read + Grep + Glob 的真实 captured envelopes。
2. **阅读 RTK 的 rule definitions**（`ARCHITECTURE.md`, `src/rules/`），写一段总结说明它们最擅长处理 4 primitives 中哪些。用于指导我们的 v1 rule set。这是 Search Before Building layer。
3. **把 analyze_transcripts JSONL parser port 到 TypeScript。** `compact/benchmark/src/scanner.ts`。写 quick-look output，列出作者 `~/.claude/projects/` 中 top-50 noisiest tool calls。在 build replay loop 前确认 testbench premise。这是 B-series foundation。
4. **先写 CHANGELOG entry。** Target sentence 保留英文原文：*"Every tool in your agent's toolbox on Claude Code now produces less noise — test runners, git diffs, package installs — with an intelligent Haiku safety net that restores critical stack frames when our rules over-compact, and a local benchmark that proves the savings on your actual 30 days of coding sessions. Codex + OpenClaw land in v1.1."* 中文语义：Claude Code 中 agent toolbox 的每个 tool output 都更少噪音；test runners、git diffs、package installs 都有智能 Haiku safety net，在规则过度压缩时恢复关键 stack frames，并用本地 benchmark 证明它能节省你真实 30 天 coding sessions 的 tokens。Codex + OpenClaw 在 v1.1 落地。如果我们无法诚实写出这句话，wedge 就还不存在。
5. **发布 rule-only v0**（no Haiku verifier, no benchmark）。用当前 gstack evals + early B-series prototype 测量 real token savings。如果 local corpus 上 <10%，整个 premise 就比声称更弱；先迭代 rules，再添加 verifier。

## License & attribution（许可与署名）

gstack 使用 MIT。为了让 downstream users 拥有干净 license，本项目对从竞争格局借鉴的内容遵循严格 clean-room policy：

- **上方引用的每个 project 都是 permissive-licensed**（MIT or Apache-2.0）。没有 AGPL、GPL、SSPL 或其他 copyleft exposure。
  - RTK (rtk-ai/rtk): **Apache-2.0** — MIT-compatible；Apache patent grant 对我们还是加分项。
  - tokenjuice、caveman、claude-token-efficient、token-optimizer-mcp、sst/opencode：**MIT**。
- **Patterns, not code.** 我们阅读这些项目，是为了理解它们解决了什么以及为什么。我们在 `compact/src/` 中用 TypeScript 独立实现。我们不复制 source files、不逐行翻译 source files，也不直接搬 test fixtures。
- **Attribution.** 如果直接借鉴某个 pattern（RTK 的 4 primitives、tokenjuice 的 JSON envelope、caveman 的 intensity levels、claude-token-efficient 的 rules-file size budget），我们会在 comments 和上方 “Pattern adoption table” 中 credit source。项目 `README` 和 `NOTICE` file（如果新增）列出 inspirations。
- **Fixture sourcing.** Golden-file fixtures 来自对真实 projects 运行真实 tools，这是我们自己的 captures，不从 RTK 或 tokenjuice 导入。这样 test corpus 不会卷入 license-tangled content。
- **Forbidden sources.** 添加任何新 reference project 前，运行 `gh api repos/OWNER/REPO --jq '.license'`，确认 license key 是以下之一：`mit`、`apache-2.0`、`bsd-2-clause`、`bsd-3-clause`、`isc`、`cc0-1.0`、`unlicense`。如果项目没有 license field，视为 “all rights reserved”，不得借鉴。拒绝 `agpl-3.0`、`gpl-*`、`sspl-*` 以及任何 custom 或 source-available license。

CI enforcement：`scripts/check-references.ts` 脚本解析 `docs/designs/GCOMPACTION.md` 中的 GitHub URLs，并重新运行 license check；如果任何 referenced project 的 license 移出 allowlist，则 fail。

## References（参考资料）

- [RTK (Rust Token Killer) — rtk-ai/rtk](https://github.com/rtk-ai/rtk)
- [RTK issue #538 — native-tool gap](https://github.com/rtk-ai/rtk/issues/538)
- [tokenjuice — vincentkoc/tokenjuice](https://github.com/vincentkoc/tokenjuice)
- [caveman — juliusbrussee/caveman](https://github.com/juliusbrussee/caveman)
- [claude-token-efficient — drona23](https://github.com/drona23/claude-token-efficient)
- [token-optimizer-mcp — ooples](https://github.com/ooples/token-optimizer-mcp)
- [6-Layer Token Savings Stack — doobidoo gist](https://gist.github.com/doobidoo/e5500be6b59e47cadc39e0b7c5cd9871)
- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)
- [Chroma context rot research](https://research.trychroma.com/context-rot)
- [Morph: Why LLMs Degrade as Context Grows](https://www.morphllm.com/context-rot)
- [Anthropic Opus 4.6 Compaction API — InfoQ](https://www.infoq.com/news/2026/03/opus-4-6-context-compaction/)
- [OpenAI compaction docs](https://developers.openai.com/api/docs/guides/compaction)
- [Google ADK context compression](https://google.github.io/adk-docs/context/compaction/)
- [LangChain autonomous context compression](https://blog.langchain.com/autonomous-context-compression/)
- [sst/opencode context management](https://deepwiki.com/sst/opencode/2.4-context-management-and-compaction)
- [DEV: Deterministic vs. LLM Evaluators — 2026 trade-off study](https://dev.to/anshd_12/deterministic-vs-llm-evaluators-a-2026-technical-trade-off-study-11h)
- [MadPlay: RTK 80% token reduction experiment](https://madplay.github.io/en/post/rtk-reduce-ai-coding-agent-token-usage)
- [Esteban Estrada: RTK 70% Claude Code reduction](https://codestz.dev/experiments/rtk-rust-token-killer)

**End of GCOMPACTION.md canonical section.** 在 plan approval 时，上方所有内容都会逐字复制到 `docs/designs/GCOMPACTION.md`，作为一个 **tabled design artifact**。不写代码；不安装 hook；不添加 CHANGELOG entry。这个 doc 存在的目的，是让未来 Anthropic 发布 built-in-tool output-replace API 后，sprint 可以快速 unblock。
