# Performance Specialist Review Checklist（性能专项审查清单）

Scope: 当 SCOPE_BACKEND=true 或 SCOPE_FRONTEND=true
Output: JSON objects，每行一个 finding。Schema:
{"severity":"CRITICAL|INFORMATIONAL","confidence":N,"path":"file","line":N,"category":"performance","summary":"...","fix":"...","fingerprint":"path:line:performance","specialist":"performance"}
Optional: line, fix, fingerprint, evidence, test_stub.
If no findings: 只输出 `NO FINDINGS`，不要输出其他内容。

---

## Categories（类别）

### N+1 Queries（N+1 查询）
- 循环中遍历 ActiveRecord/ORM associations，但没有 eager loading（.includes、joinedload、include）
- Iteration blocks（each、map、forEach）中存在可 batch 的 database queries
- Nested serializers 触发 lazy-loaded associations
- GraphQL resolvers 按 field 查询，而不是 batching（检查 DataLoader usage）

### Missing Database Indexes（缺少数据库 indexes）
- 新增 WHERE clauses 作用于无 indexes 的 columns（检查 migration files 或 schema）
- 新增 ORDER BY 作用于 non-indexed columns
- Composite queries（WHERE a AND b）缺少 composite indexes
- 新增 foreign key columns 但没有 indexes

### Algorithmic Complexity（算法复杂度）
- O(n^2) 或更差的 patterns：collections 上的 nested loops、Array.map 内的 Array.find
- 可使用 hash/map/set lookup 的 repeated linear searches
- 循环中的 string concatenation（使用 join 或 StringBuilder）
- Large collections 被多次 sort 或 filter，而一次即可

### Bundle Size Impact（Frontend bundle size 影响）
- 新增 known-heavy 的 production dependencies（moment.js、lodash full、jquery）
- 使用 barrel imports（import from 'library'），而不是 deep imports（import from 'library/specific'）
- Large static assets（images、fonts）未经 optimization 就 committed
- Route-level chunks 缺少 code splitting

### Rendering Performance（Frontend rendering 性能）
- Fetch waterfalls：可 parallel 的 sequential API calls（Promise.all）
- Unstable references 导致 unnecessary re-renders（render 中新建 objects/arrays）
- Expensive computations 缺少 React.memo、useMemo 或 useCallback
- 循环中先读后写 DOM properties 导致 layout thrashing
- Below-fold images 缺少 loading="lazy"

### Missing Pagination（缺少 pagination）
- 返回 unbounded results 的 list endpoints（无 LIMIT，无 pagination params）
- 随 data volume 增长且没有 LIMIT 的 database queries
- API responses embed full nested objects，而不是使用 IDs with expansion

### Blocking in Async Contexts（async contexts 中的 blocking）
- Async functions 内部存在 synchronous I/O（file reads、subprocess、HTTP requests）
- Event-loop-based handlers 内部存在 time.sleep() / Thread.sleep()
- CPU-intensive computation 在没有 worker offload 的情况下 blocking main thread
