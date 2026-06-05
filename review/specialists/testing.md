# Testing Specialist Review Checklist（测试专项审查清单）

Scope: Always-on（每次 review）
Output: JSON objects，每行一个 finding。Schema:
{"severity":"CRITICAL|INFORMATIONAL","confidence":N,"path":"file","line":N,"category":"testing","summary":"...","fix":"...","fingerprint":"path:line:testing","specialist":"testing"}
Optional: line, fix, fingerprint, evidence, test_stub.
If no findings: 只输出 `NO FINDINGS`，不要输出其他内容。

---

## Categories（类别）

### Missing Negative-Path Tests（缺少负路径测试）
- 处理 errors、rejections 或 invalid input 的 new code paths 没有对应 test
- Guard clauses 和 early returns 未测试
- try/catch、rescue 或 error boundaries 中的 error branches 没有 failure-path test
- Code 中 asserted 的 permission/auth checks 没有测试 "denied" case

### Missing Edge-Case Coverage（缺少边界场景覆盖）
- Boundary values：zero、negative、max-int、empty string、empty array、nil/null/undefined
- Single-element collections（loops 的 off-by-one）
- User-facing inputs 中的 Unicode 和 special characters
- Concurrent access patterns 缺少 race-condition test

### Test Isolation Violations（测试隔离违规）
- Tests 共享 mutable state（class variables、global singletons、未清理的 DB records）
- Order-dependent tests（按顺序 pass，randomized 时 fail）
- 依赖 system clock、timezone 或 locale 的 tests
- 发起 real network calls，而不是使用 stubs/mocks 的 tests

### Flaky Test Patterns（易 flaky 的测试模式）
- Timing-dependent assertions（sleep、setTimeout、tight timeouts 的 waitFor）
- 对 unordered results 的 ordering 做 assertions（hash keys、Set iteration、async resolution order）
- 依赖 external services（APIs、databases）且没有 fallback 的 tests
- Randomized test data 缺少 seed control

### Security Enforcement Tests Missing（缺少安全 enforcement 测试）
- Controllers 中的 auth/authz checks 没有 "unauthorized" case test
- Rate limiting logic 没有 test 证明它真的会 block
- Input sanitization 没有 malicious input test
- CSRF/CORS configuration 没有 integration test

### Coverage Gaps（覆盖缺口）
- New public methods/functions 完全没有 test coverage
- Changed methods 的 existing tests 只覆盖 old behavior，不覆盖 new branch
- 被多处调用的 utility functions 只被 indirectly tested
