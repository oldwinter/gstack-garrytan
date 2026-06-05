# Maintainability Specialist Review Checklist（可维护性专项审查清单）

Scope: Always-on（每次 review）
Output: JSON objects，每行一个 finding。Schema:
{"severity":"INFORMATIONAL","confidence":N,"path":"file","line":N,"category":"maintainability","summary":"...","fix":"...","fingerprint":"path:line:maintainability","specialist":"maintainability"}
Optional: line, fix, fingerprint, evidence, test_stub.
If no findings: 只输出 `NO FINDINGS`，不要输出其他内容。

---

## Categories（类别）

### Dead Code & Unused Imports（死代码与未使用 imports）
- Changed files 中 assigned but never read 的 variables
- Defined but never called 的 functions/methods（用 Grep across the repo 检查）
- 变更后不再 referenced 的 imports/requires
- Commented-out code blocks（要么移除，要么解释为什么存在）

### Magic Numbers & String Coupling（魔法数字与字符串耦合）
- Logic 中使用 bare numeric literals（thresholds、limits、retry counts），应改为 named constants
- Error message strings 在其他地方被当作 query filters 或 conditionals
- 应该进入 config 的 hardcoded URLs、ports 或 hostnames
- 多个 files 中 duplicated literal values

### Stale Comments & Docstrings（过期 comments 与 docstrings）
- 本 diff 改变代码后，仍描述 old behavior 的 comments
- 引用 completed work 的 TODO/FIXME comments
- Parameter lists 与 current function signature 不匹配的 docstrings
- Comments 中不再匹配 code flow 的 ASCII diagrams

### DRY Violations（DRY 违规）
- Diff 内多次出现 similar code blocks（3+ lines）
- 使用 shared helper 会更干净的 copy-paste patterns
- Test files 间 duplicated configuration 或 setup logic
- 可改为 lookup table 或 map 的 repeated conditional chains

### Conditional Side Effects（条件分支里的副作用不一致）
- Code paths 按 condition 分支，但某个 branch 忘记 side effect
- Log messages 声称 action happened，但 action 被 conditionally skipped
- State transitions 中一个 branch 更新 related records，另一个没有
- Event emissions 只在 happy path 触发，缺少 error/edge paths

### Module Boundary Violations（模块边界违规）
- 伸手访问另一个 module 的 internal implementation（访问 private-by-convention methods）
- Controllers/views 中存在本应通过 service/model 的 direct database queries
- Components 之间 tight coupling，而它们本应通过 interfaces 通信
