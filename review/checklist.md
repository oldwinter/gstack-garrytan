# Pre-Landing Review Checklist（落地前审查清单）

## Instructions（说明）

审查 `git diff origin/main` output，查找下列问题。要具体：引用 `file:line` 并建议 fixes。正常的内容跳过。只 flag 真实问题。

**Two-pass review：**
- **Pass 1 (CRITICAL)：** 先跑 SQL & Data Safety、Race Conditions、LLM Output Trust Boundary、Shell Injection 和 Enum Completeness。最高 severity。
- **Pass 2 (INFORMATIONAL)：** 再跑下面其余 categories。severity 较低，但仍需要 action。
- **Specialist categories（由 parallel subagents 处理，不属于本 checklist）：** Test Gaps、Dead Code、Magic Numbers、Conditional Side Effects、Performance & Bundle Impact、Crypto & Entropy。见 `review/specialists/`。

所有 findings 都通过 Fix-First Review 处理：明显 mechanical fixes 自动应用，
真正 ambiguous 的 issues 会 batch 成一个 user question。

**Output format（输出格式）：**

```
Pre-Landing Review: N issues (X critical, Y informational)

**AUTO-FIXED:**
- [file:line] Problem → fix applied

**NEEDS INPUT:**
- [file:line] Problem description
  Recommended fix: suggested fix
```

如果没有 issues found：`Pre-Landing Review: No issues found.`（保留 exact output）

保持 terse。每个 issue：一行描述 problem，一行写 fix。不要 preamble，不要 summaries，不要 "looks good overall."

---

## Review Categories（审查类别）

### Pass 1 — CRITICAL

#### SQL & Data Safety
- SQL 中的 string interpolation（即使 values 已 `.to_i`/`.to_f`，也应使用 parameterized queries；Rails: sanitize_sql_array/Arel；Node: prepared statements；Python: parameterized queries）
- TOCTOU races：本该用 atomic `WHERE` + `update_all` 的 check-then-set patterns
- 直接 DB writes 绕过 model validations（Rails: update_column；Django: QuerySet.update()；Prisma: raw queries）
- N+1 queries：loops/views 使用的 associations 缺少 eager loading（Rails: .includes()；SQLAlchemy: joinedload()；Prisma: include）

#### Race Conditions & Concurrency
- Read-check-write 没有 uniqueness constraint，也没有 catch duplicate key error and retry（例如 `where(hash:).first` 后直接 `save!`，未处理 concurrent insert）
- find-or-create 没有 unique DB index；concurrent calls 可能创建 duplicates
- Status transitions 没有使用 atomic `WHERE old_status = ? UPDATE SET new_status`；concurrent updates 可能 skip 或 double-apply transitions
- 对 user-controlled data 做 unsafe HTML rendering（Rails: .html_safe/raw()；React: dangerouslySetInnerHTML；Vue: v-html；Django: |safe/mark_safe），造成 XSS risk

#### LLM Output Trust Boundary
- LLM-generated values（emails、URLs、names）在没有 format validation 的情况下写入 DB 或传给 mailers。Persist 前加 lightweight guards（`EMAIL_REGEXP`、`URI.parse`、`.strip`）。
- Structured tool output（arrays、hashes）在 database writes 前没有 type/shape checks 就被接受。
- LLM-generated URLs 在没有 allowlist 的情况下被 fetch；如果 URL 指向 internal network，会有 SSRF risk（Python: `urllib.parse.urlparse` → `requests.get`/`httpx.get` 前检查 hostname against blocklist）
- LLM output 未经 sanitization 存入 knowledge bases 或 vector DBs；存在 stored prompt injection risk

#### Shell Injection (Python-specific)
- `subprocess.run()` / `subprocess.call()` / `subprocess.Popen()` 使用 `shell=True`，且 command string 中有 f-string/`.format()` interpolation；改用 argument arrays
- `os.system()` 包含 variable interpolation；替换为使用 argument arrays 的 `subprocess.run()`
- 对 LLM-generated code 执行未 sandboxing 的 `eval()` / `exec()`

#### Enum & Value Completeness
当 diff 引入新的 enum value、status string、tier name 或 type constant 时：
- **Trace it through every consumer.** 阅读（不是只 grep，而是真的 READ）每个 switches on、filters by 或 displays 该 value 的 file。如果任何 consumer 没处理 new value，就 flag。常见遗漏：给 frontend dropdown 加了 value，但 backend model/compute method 没 persist。
- **Check allowlists/filter arrays.** 搜索包含 sibling values 的 arrays 或 `%w[]` lists（例如添加 "revise" 到 tiers 时，找到每个 `%w[quick lfg mega]`，确认需要处包含 "revise"）。
- **Check `case`/`if-elsif` chains.** 如果 existing code 根据 enum branch，新 value 是否会 fall through 到错误 default？
做法：用 Grep 查找 sibling values 的所有 references（例如 grep "lfg" 或 "mega" 找到所有 tier consumers）。逐个阅读 match。此步骤需要阅读 diff 之外的 code。

### Pass 2 — INFORMATIONAL

#### Async/Sync Mixing (Python-specific)
- `async def` endpoints 内部使用 synchronous `subprocess.run()`、`open()`、`requests.get()`；会 block event loop。改用 `asyncio.to_thread()`、`aiofiles` 或 `httpx.AsyncClient`。
- async functions 内部使用 `time.sleep()`；改用 `asyncio.sleep()`
- async context 中的 sync DB calls 没有 `run_in_executor()` wrapping

#### Column/Field Name Safety
- 对照 actual DB schema 验证 ORM queries（`.select()`、`.eq()`、`.gte()`、`.order()`）中的 column names；错误 column names 可能 silently return empty results 或抛出被 swallowed 的 errors
- 检查 query results 上的 `.get()` calls 是否使用了实际 selected 的 column name
- 有 schema documentation 时做 cross-reference

#### Dead Code & Consistency（仅 version/changelog；其他 items 由 maintainability specialist 处理）
- PR title 与 VERSION/CHANGELOG files 之间 version mismatch
- CHANGELOG entries 对 changes 描述不准确（例如 X 从未存在，却写成 "changed from X to Y"）

#### LLM Prompt Issues
- Prompts 中出现 0-indexed lists（LLMs 通常会返回 1-indexed）
- Prompt text 中列出的 available tools/capabilities 与 `tool_classes`/`tools` array 中实际 wired up 的内容不匹配
- Word/token limits 在多个位置重复声明，未来可能 drift

#### Completeness Gaps
- Shortcut implementations，而完整版本只需 <30 minutes CC time（例如 partial enum handling、incomplete error paths、容易补上的 missing edge cases）
- Options 只展示 human-team effort estimates；应同时展示 human 和 CC+gstack time
- Test coverage gaps，其中补 missing tests 是 "lake" 而不是 "ocean"（例如 missing negative-path tests、与 happy-path structure 对称的 missing edge case tests）
- Features 只实现到 80-90%，但用 modest additional code 可达到 100%

#### Time Window Safety
- Date-key lookups 假设 "today" 覆盖 24h；但 8am PT 的 report 在 today's key 下只看到 midnight→8am
- Related features 之间 time windows 不匹配；同一数据一个用 hourly buckets，另一个用 daily keys

#### Type Coercion at Boundaries
- 穿过 Ruby→JSON→JS boundaries 的 values 可能改变 type（numeric vs string）；hash/digest inputs 必须 normalize types
- Hash/digest inputs 在 serialization 前没有调用 `.to_s` 或等价逻辑；`{ cores: 8 }` vs `{ cores: "8" }` 会生成不同 hashes

#### View/Frontend
- Partials 中的 inline `<style>` blocks（每次 render 都会 re-parsed）
- Views 中的 O(n*m) lookups（在 loop 中用 `Array#find`，而不是 `index_by` hash）
- 对 DB results 做 Ruby-side `.select{}` filtering，而它本可以是 `WHERE` clause（除非是刻意避免 leading-wildcard `LIKE`）

#### Distribution & CI/CD Pipeline
- CI/CD workflow changes（`.github/workflows/`）：验证 build tool versions 匹配 project requirements，artifact names/paths 正确，secrets 使用 `${{ secrets.X }}` 而不是 hardcoded values
- New artifact types（CLI binary、library、package）：验证存在 publish/release workflow，且 targets correct platforms
- Cross-platform builds：验证 CI matrix 覆盖所有 target OS/arch combinations，或明确 document 哪些未测试
- Version tag format consistency：`v1.2.3` vs `1.2.3`；VERSION file、git tags 和 publish scripts 必须一致
- Publish step idempotency：重新运行 publish workflow 不应失败（例如 `gh release delete` before `gh release create`）

**DO NOT flag:**
- 已有 auto-deploy pipelines 的 web services（Docker build + K8s deploy）
- 不向 team 外分发的 internal tools
- Test-only CI changes（添加 test steps，而不是 publish steps）

---

## Severity Classification

```
CRITICAL (highest severity):      INFORMATIONAL (main agent):      SPECIALIST (parallel subagents):
├─ SQL & Data Safety              ├─ Async/Sync Mixing             ├─ Testing specialist
├─ Race Conditions & Concurrency  ├─ Column/Field Name Safety      ├─ Maintainability specialist
├─ LLM Output Trust Boundary      ├─ Dead Code (version only)      ├─ Security specialist
├─ Shell Injection                ├─ LLM Prompt Issues             ├─ Performance specialist
└─ Enum & Value Completeness      ├─ Completeness Gaps             ├─ Data Migration specialist
                                   ├─ Time Window Safety            ├─ API Contract specialist
                                   ├─ Type Coercion at Boundaries   └─ Red Team (conditional)
                                   ├─ View/Frontend
                                   └─ Distribution & CI/CD Pipeline

所有 findings 都通过 Fix-First Review action。Severity 决定 presentation order 以及 AUTO-FIX vs ASK 的 classification；critical findings 倾向 ASK（更 risky），informational findings 倾向 AUTO-FIX（更 mechanical）。
```

---

## Fix-First Heuristic

此 heuristic 同时被 `/review` 和 `/ship` 引用，用来决定 agent 是 auto-fix finding，还是 ask user。

```
AUTO-FIX (agent fixes without asking):     ASK (needs human judgment):
├─ Dead code / unused variables            ├─ Security (auth, XSS, injection)
├─ N+1 queries (missing eager loading)      ├─ Race conditions
├─ Stale comments contradicting code       ├─ Design decisions
├─ Magic numbers → named constants         ├─ Large fixes (>20 lines)
├─ Missing LLM output validation           ├─ Enum completeness
├─ Version/path mismatches                 ├─ Removing functionality
├─ Variables assigned but never read       └─ Anything changing user-visible
└─ Inline styles, O(n*m) view lookups        behavior
```

**Rule of thumb：** 如果 fix 是 mechanical，且 senior engineer 会不经讨论直接应用，就是 AUTO-FIX。如果 reasonable engineers 可能对 fix 有分歧，就是 ASK。

**Critical findings default toward ASK**（它们 inherently riskier）。
**Informational findings default toward AUTO-FIX**（它们更 mechanical）。

---

## Suppressions — DO NOT flag these

- "X is redundant with Y"，如果 redundancy harmless 且有助于 readability（例如 `present?` 与 `length > 20` redundancy）
- "Add a comment explaining why this threshold/constant was chosen"；thresholds 会在 tuning 中变化，comments 会 rot
- "This assertion could be tighter"，如果 assertion 已经覆盖 behavior
- 只为 consistency 提出的 changes（把某个 value 包在 conditional 中，只为匹配另一个 constant 的 guard）
- "Regex doesn't handle edge case X"，如果 input 受约束且 X 实践中不会出现
- "Test exercises multiple guards simultaneously"；这没问题，tests 不需要 isolate every guard
- Eval threshold changes（max_actionable、min scores）；这些是 empirical tuning，并经常变化
- Harmless no-ops（例如对永远不在 array 里的 element 调 `.reject`）
- 你正在 review 的 diff 中已经 addressed 的任何内容；comment 前先读 FULL diff
