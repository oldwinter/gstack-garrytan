# Security Specialist Review Checklist（安全专项审查清单）

Scope: 当 SCOPE_AUTH=true 或 (SCOPE_BACKEND=true AND diff > 100 lines)
Output: JSON objects，每行一个 finding。Schema:
{"severity":"CRITICAL|INFORMATIONAL","confidence":N,"path":"file","line":N,"category":"security","summary":"...","fix":"...","fingerprint":"path:line:security","specialist":"security"}
Optional: line, fix, fingerprint, evidence, test_stub.
If no findings: 只输出 `NO FINDINGS`，不要输出其他内容。

---

这份 checklist 比 main CRITICAL pass 更深入。Main agent 已经检查 SQL injection、race conditions、LLM trust 和 enum completeness。该 specialist 专注 auth/authz patterns、cryptographic misuse 和 attack surface expansion。

## Categories（类别）

### Input Validation at Trust Boundaries（信任边界输入验证）
- 在 controller/handler 层接受 user input 但没有 validation
- Query parameters 被直接用于 database queries 或 file paths
- Request body fields 未经 type checking 或 schema validation 就被接受
- File uploads 缺少 type/size/content validation
- Webhook payloads 未经 signature verification 就被处理

### Auth & Authorization Bypass（认证与授权绕过）
- Endpoints 缺少 authentication middleware（检查 route definitions）
- Authorization checks 默认 "allow" 而不是 "deny"
- Role escalation paths（user 可以修改自己的 role/permissions）
- Direct object reference vulnerabilities（user A 通过修改 ID 访问 user B 的 data）
- Session fixation 或 session hijacking opportunities
- Token/API key validation 未检查 expiration

### Injection Vectors（SQL 之外的注入向量）
- 通过带 user-controlled arguments 的 subprocess calls 产生 command injection
- 带 user input 的 template injection（Jinja2、ERB、Handlebars）
- Directory queries 中的 LDAP injection
- 通过 user-controlled URLs 产生 SSRF（fetch、redirect、webhook targets）
- 通过 user-controlled file paths 产生 path traversal（../../etc/passwd）
- 通过 HTTP headers 中的 user-controlled values 产生 header injection

### Cryptographic Misuse（加密误用）
- Security-sensitive operations 使用 weak hashing algorithms（MD5、SHA1）
- Tokens 或 secrets 使用 predictable randomness（Math.random、rand()）
- Secrets、tokens 或 digests 上使用 non-constant-time comparisons（==）
- Hardcoded encryption keys 或 IVs
- Password hashing 缺少 salt

### Secrets Exposure（secrets 暴露）
- Source code 中存在 API keys、tokens 或 passwords（即使在 comments 中）
- Secrets 被记录到 application logs 或 error messages
- URLs 中存在 credentials（query parameters 或 URL 中的 basic auth）
- 返回给 users 的 error responses 中包含 sensitive data
- 预期需要 encryption 时，PII 以 plaintext 存储

### XSS via Escape Hatches（通过 escape hatches 产生 XSS）
- Rails: 对 user-controlled data 使用 .html_safe、raw()
- React: 对 user content 使用 dangerouslySetInnerHTML
- Vue: 对 user content 使用 v-html
- Django: 对 user input 使用 |safe、mark_safe()
- General: 用 unsanitized data 赋值 innerHTML

### Deserialization（反序列化）
- Deserializing untrusted data（pickle、Marshal、YAML.load、executable types 的 JSON.parse）
- 未经 schema validation 就接受来自 user input 或 external APIs 的 serialized objects
