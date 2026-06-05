# Data Migration Specialist Review Checklist（数据迁移专项审查清单）

Scope：当 SCOPE_MIGRATIONS=true 时运行。
Output：JSON objects，每行一个 finding。Schema:
{"severity":"CRITICAL|INFORMATIONAL","confidence":N,"path":"file","line":N,"category":"data-migration","summary":"...","fix":"...","fingerprint":"path:line:data-migration","specialist":"data-migration"}
Optional: line, fix, fingerprint, evidence, test_stub.
If no findings: 只输出 `NO FINDINGS`，不要输出其他内容。

---

## Categories（类别）

### Reversibility（可回滚性）
- 此 migration 能否在不丢失 data 的情况下 rollback？
- 是否有对应的 down/rollback migration？
- Rollback 是否真的 undo change，还是只是 no-op？
- Rolling back 是否会 break current application code？

### Data Loss Risk（数据丢失风险）
- Drop 仍包含 data 的 columns（先加 deprecation period）
- 改变会 truncate data 的 column types（varchar(255) → varchar(50)）
- 未验证没有 code references 就移除 tables
- Rename columns 但没有更新所有 references（ORM、raw SQL、views）
- 对存在 NULL values 的 columns 添加 NOT NULL constraints（需要先 backfill）

### Lock Duration（锁持有时间）
- 在 large tables 上执行 ALTER TABLE 且没有 CONCURRENTLY（PostgreSQL）
- 对 >100K rows 的 tables 添加 indexes 且没有 CONCURRENTLY
- 多个 ALTER TABLE statements 本可合并成一次 lock acquisition
- 会在 peak traffic hours 获取 exclusive locks 的 schema changes

### Backfill Strategy（回填策略）
- New NOT NULL columns 没有 DEFAULT value（加 constraint 前需要 backfill）
- New columns 使用 computed defaults，需要 batch population
- Existing records 缺少 backfill script 或 rake task
- Backfill 一次性 update all rows，而不是 batching（会 lock table）

### Index Creation（索引创建）
- 在 production tables 上 CREATE INDEX 且没有 CONCURRENTLY
- Duplicate indexes（new index 覆盖与 existing one 相同的 columns）
- New foreign key columns 缺少 indexes
- Partial indexes 与 full index 适用性不匹配（或 vice versa）

### Multi-Phase Safety（多阶段安全性）
- 必须按特定顺序与 application code 一起 deploy 的 migrations
- 会 break 当前 running code 的 schema changes（先 deploy code，再 migrate）
- 假设存在 deploy boundary 的 migrations（old code + new schema = crash）
- Rolling deploy 期间缺少处理 mixed old/new code 的 feature flag
