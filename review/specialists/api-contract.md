# API Contract Specialist Review Checklist（API 契约专项审查清单）

Scope：当 SCOPE_API=true 时运行。
Output：JSON objects，每行一个 finding。Schema:
{"severity":"CRITICAL|INFORMATIONAL","confidence":N,"path":"file","line":N,"category":"api-contract","summary":"...","fix":"...","fingerprint":"path:line:api-contract","specialist":"api-contract"}
Optional: line, fix, fingerprint, evidence, test_stub.
If no findings: 只输出 `NO FINDINGS`，不要输出其他内容。

---

## Categories（类别）

### Breaking Changes（破坏性变更）
- 从 response bodies 中移除 fields（clients 可能依赖它们）
- 改变 field types（string → number，object → array）
- 向 existing endpoints 添加新的 required parameters
- 改变 HTTP methods（GET → POST）或 status codes（200 → 201）
- 重命名 endpoints，但没有将 old path 保留为 redirect/alias
- 改变 authentication requirements（public → authenticated）

### Versioning Strategy（版本策略）
- Breaking changes 没有 version bump（v1 → v2）
- 同一个 API 混用多种 versioning strategies（URL vs header vs query param）
- Deprecated endpoints 没有 sunset timeline 或 migration guide
- Version-specific logic 分散在 controllers 中，而不是集中管理

### Error Response Consistency（错误响应一致性）
- New endpoints 返回的 error formats 与 existing endpoints 不一致
- Error responses 缺少 standard fields（error code、message、details）
- HTTP status codes 与 error type 不匹配（errors 返回 200，validation 返回 500）
- Error messages 泄露 internal implementation details（stack traces、SQL）

### Rate Limiting & Pagination（限流与分页）
- Similar endpoints 有 rate limiting，但 new endpoints 缺失
- Pagination changes（offset → cursor）缺少 backwards compatibility
- 改变 page sizes 或 default limits，但没有 documentation
- Paginated responses 缺少 total count 或 next-page indicators

### Documentation Drift（文档漂移）
- OpenAPI/Swagger spec 未更新以匹配 new endpoints 或 changed params
- README 或 API docs 在变更后仍描述 old behavior
- Example requests/responses 已不再工作
- New endpoints 或 changed parameters 缺少 documentation

### Backwards Compatibility（向后兼容）
- Older versions 上的 clients 是否会 break？
- 无法 force-update 的 mobile apps 是否仍能使用 API？
- Webhook payloads 改变但没有通知 subscribers
- 使用 new features 是否需要 SDK 或 client library changes
