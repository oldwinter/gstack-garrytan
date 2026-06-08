<!-- AUTO-GENERATED from audit-phases.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
**Scope gate（先读）。**本 section 包含所有 scope-dependent phases（2-11），但你只运行 `## Mode Resolution`（skeleton 中 always-loaded）里已解析模式选中的 phases。Phases 0、1、12、13、14 始终运行；Phases 2-11 受 scope gate 控制。"Execute in full" 的意思是按已选择范围完整执行本 section，而不是因为某个 phase 的 prose 在这里就运行未选中的 phase。示例：`--owasp` 只运行本 section 的 Phase 9，不运行 Phases 2-8/10/11。

### Phase 2: Secrets Archaeology（机密考古）

扫描 git 历史中的泄露凭据、检查被 git 跟踪的 `.env` files，并查找带 inline secrets 的 CI configs。

**Canonical pattern catalog（规范 pattern 目录）。**下方 archaeology greps 针对的 HIGH-tier credential prefixes（AKIA、ghp_、sk-ant-、sk_live_、xoxb-、`-----BEGIN ... PRIVATE KEY-----` 等）与 `/spec` in-flight redaction 会阻断的集合相同。完整 3-tier taxonomy（HIGH credentials、MEDIUM PII/legal/internal、LOW）由 `lib/redact-patterns.ts` 生成并存放在那里；它是 `gstack-redact` engine、`/spec`、`/ship` 和 `/document-*` skills 共享的 single source of truth。

**Git history — known secret prefixes:**
```bash
git log -p --all -S "AKIA" --diff-filter=A -- "*.env" "*.yml" "*.yaml" "*.json" "*.toml" 2>/dev/null
git log -p --all -S "sk-" --diff-filter=A -- "*.env" "*.yml" "*.json" "*.ts" "*.js" "*.py" 2>/dev/null
git log -p --all -G "ghp_|gho_|github_pat_" 2>/dev/null
git log -p --all -G "xoxb-|xoxp-|xapp-" 2>/dev/null
git log -p --all -G "password|secret|token|api_key" -- "*.env" "*.yml" "*.json" "*.conf" 2>/dev/null
```

**.env files tracked by git:**
```bash
git ls-files '*.env' '.env.*' 2>/dev/null | grep -v '.example\|.sample\|.template'
grep -q "^\.env$\|^\.env\.\*" .gitignore 2>/dev/null && echo ".env IS gitignored" || echo "WARNING: .env NOT in .gitignore"
```

**CI configs with inline secrets（未使用 secret stores）:**
```bash
for f in $(find .github/workflows -maxdepth 1 \( -name '*.yml' -o -name '*.yaml' \) 2>/dev/null) .gitlab-ci.yml .circleci/config.yml; do
  [ -f "$f" ] && grep -n "password:\|token:\|secret:\|api_key:" "$f" | grep -v '\${{' | grep -v 'secrets\.'
done 2>/dev/null
```

**Severity:** git 历史中出现 active secret patterns（AKIA、sk_live_、ghp_、xoxb-）为 CRITICAL。被 git 跟踪的 .env、带 inline credentials 的 CI configs 为 HIGH。可疑的 .env.example values 为 MEDIUM。

**FP rules（误报规则）：**排除 placeholders（"your_"、"changeme"、"TODO"）。排除 test fixtures，除非同一 value 也出现在 non-test code 中。Rotated secrets 仍然要 flag（它们曾经暴露过）。`.env.local` 在 `.gitignore` 中是预期状态。

**Diff mode:** 将 `git log -p --all` 替换为 `git log -p <base>..HEAD`。

### Phase 3: Dependency Supply Chain（依赖供应链）

不要只停留在 `npm audit`。检查实际供应链风险。

**Package manager detection:**
```bash
[ -f package.json ] && echo "DETECTED: npm/yarn/bun"
[ -f Gemfile ] && echo "DETECTED: bundler"
[ -f requirements.txt ] || [ -f pyproject.toml ] && echo "DETECTED: pip"
[ -f Cargo.toml ] && echo "DETECTED: cargo"
[ -f go.mod ] && echo "DETECTED: go"
```

**Standard vulnerability scan:** 运行可用 package manager 对应的 audit tool。每个 tool 都是 optional；如果未安装，在 report 中记为 "SKIPPED — tool not installed" 并给出安装说明。这是信息项，不是 finding。Audit 会用已经可用的 tools 继续执行。

**Install scripts in production deps（供应链攻击向量）：** 对于已经 hydrated `node_modules` 的 Node.js projects，检查 production dependencies 是否含有 `preinstall`、`postinstall` 或 `install` scripts。

**Lockfile integrity:** 检查 lockfiles 是否存在，并且是否被 git 跟踪。

**Severity:** direct deps 中已知 high/critical CVEs 为 CRITICAL。prod deps 中的 install scripts / 缺失 lockfile 为 HIGH。abandoned packages / medium CVEs / lockfile 未被跟踪为 MEDIUM。

**FP rules:** devDependency CVEs 最高 MEDIUM。`node-gyp`/`cmake` install scripts 属于预期（MEDIUM，不是 HIGH）。没有 known exploits 且 no-fix-available 的 advisories 排除。Library repos（不是 apps）缺失 lockfile 不是 finding。

### Phase 4: CI/CD Pipeline Security

检查谁能修改 workflows，以及他们能访问哪些 secrets。

**GitHub Actions analysis:** 对每个 workflow file，检查：
- Unpinned third-party actions（未 SHA-pinned）——用 Grep 查找缺少 `@[sha]` 的 `uses:` lines
- `pull_request_target`（危险：fork PRs 会获得 write access）
- `run:` steps 中通过 `${{ github.event.* }}` 造成的 script injection
- Secrets 作为 env vars（可能泄露到 logs）
- Workflow files 的 CODEOWNERS protection

**Severity:** `pull_request_target` + checkout PR code / `run:` steps 中通过 `${{ github.event.*.body }}` script injection 为 CRITICAL。Unpinned third-party actions / 未 masking 的 secrets env vars 为 HIGH。Workflow files 缺少 CODEOWNERS 为 MEDIUM。

**FP rules:** First-party `actions/*` unpinned = MEDIUM，不是 HIGH。没有 checkout PR ref 的 `pull_request_target` 是安全的（precedent #11）。`with:` blocks 中的 secrets（不是 `env:`/`run:`）由 runtime 处理。

### Phase 5: Infrastructure Shadow Surface（影子基础设施暴露面）

查找拥有过多访问权限的 shadow infrastructure。

**Dockerfiles:** 对每个 Dockerfile，检查缺少 `USER` directive（以 root 运行）、secrets 作为 `ARG` 传入、`.env` files 被复制进 image、暴露端口。

**Config files with prod credentials:** 用 Grep 搜索 config files 中的 database connection strings（postgres://、mysql://、mongodb://、redis://），排除 localhost/127.0.0.1/example.com。检查 staging/dev configs 是否引用 prod。

**IaC security:** 对 Terraform files，检查 IAM actions/resources 中的 `"*"`、`.tf`/`.tfvars` 中的 hardcoded secrets。对 K8s manifests，检查 privileged containers、hostNetwork、hostPID。

**Severity:** committed config 中带 credentials 的 prod DB URLs / sensitive resources 上的 `"*"` IAM / Docker images 中 baked in secrets 为 CRITICAL。Prod root containers / staging 访问 prod DB / privileged K8s 为 HIGH。缺少 USER directive / 无 documented purpose 的 exposed ports 为 MEDIUM。

**FP rules:** 本地开发用 `docker-compose.yml` + localhost 不是 finding（precedent #12）。Terraform `data` sources（read-only）中的 `"*"` 排除。`test/`/`dev/`/`local/` 下使用 localhost networking 的 K8s manifests 排除。

### Phase 6: Webhook & Integration Audit

查找“什么都接受”的 inbound endpoints。

**Webhook routes:** 用 Grep 查找包含 webhook/hook/callback route patterns 的 files。对每个 file，检查是否也包含 signature verification（signature、hmac、verify、digest、x-hub-signature、stripe-signature、svix）。有 webhook routes 但没有 signature verification 的 files 是 findings。

**TLS verification disabled:** 用 Grep 搜索 `verify.*false`、`VERIFY_NONE`、`InsecureSkipVerify`、`NODE_TLS_REJECT_UNAUTHORIZED.*0` 等 patterns。

**OAuth scope analysis:** 用 Grep 查找 OAuth configurations，并检查 scopes 是否过宽。

**Verification approach（只做 code-tracing，不做 live requests）：** 对 webhook findings，追踪 handler code，判断 middleware chain（parent router、middleware stack、API gateway config）中是否存在 signature verification。不要向 webhook endpoints 发起真实 HTTP requests。

**Severity:** 完全没有 signature verification 的 webhooks 为 CRITICAL。Prod code 中禁用 TLS verification / 过宽 OAuth scopes 为 HIGH。未记录的 third-party outbound data flows 为 MEDIUM。

**FP rules:** 排除 test code 中禁用 TLS。Private networks 上的 internal service-to-service webhooks 最高 MEDIUM。由 API gateway upstream 处理 signature verification 的 webhook endpoints 不是 findings，但需要 evidence。

### Phase 7: LLM & AI Security

检查 AI/LLM-specific vulnerabilities。这是新的攻击类别。

用 Grep 搜索这些 patterns：
- **Prompt injection vectors:** User input 流入 system prompts 或 tool schemas；查找 system prompt construction 附近的 string interpolation
- **Unsanitized LLM output:** `dangerouslySetInnerHTML`、`v-html`、`innerHTML`、`.html()`、`raw()` 渲染 LLM responses
- **Tool/function calling without validation:** `tool_choice`、`function_call`、`tools=`、`functions=`
- **AI API keys in code（不是 env vars）:** `sk-` patterns、hardcoded API key assignments
- **Eval/exec of LLM output:** `eval()`、`exec()`、`Function()`、`new Function` 处理 AI responses

**Key checks（beyond grep）:**
- Trace user content flow：它是否进入 system prompts 或 tool schemas？
- RAG poisoning：external documents 是否能通过 retrieval 影响 AI behavior？
- Tool calling permissions：LLM tool calls 执行前是否经过 validation？
- Output sanitization：LLM output 是否被当成 trusted（渲染为 HTML、作为代码执行）？
- Cost/resource attacks：用户是否能触发 unbounded LLM calls？

**Severity:** user input 进入 system prompts / unsanitized LLM output 渲染为 HTML / eval LLM output 为 CRITICAL。缺少 tool call validation / 暴露 AI API keys 为 HIGH。Unbounded LLM calls / 未做 input validation 的 RAG 为 MEDIUM。

**FP rules:** AI conversation 的 user-message position 中存在 user content 不是 prompt injection（precedent #13）。只有当 user content 进入 system prompts、tool schemas 或 function-calling contexts 时才 flag。

### Phase 8: Skill Supply Chain

扫描已安装 Claude Code skills 中的恶意 patterns。Snyk ToxicSkills research 显示，36% 的 published skills 有 security flaws，13.4% 是 outright malicious。

**Tier 1 — repo-local（自动）：** 扫描 repo local skills directory 中的 suspicious patterns：

```bash
ls -la .claude/skills/ 2>/dev/null
```

用 Grep 搜索所有 local skill SKILL.md files 中的 suspicious patterns：
- `curl`、`wget`、`fetch`、`http`、`exfiltrat`（network exfiltration）
- `ANTHROPIC_API_KEY`、`OPENAI_API_KEY`、`env.`、`process.env`（credential access）
- `IGNORE PREVIOUS`、`system override`、`disregard`、`forget your instructions`（prompt injection）

**Tier 2 — global skills（requires permission）：** 扫描 globally installed skills 或 user settings 前，使用 AskUserQuestion：
"Phase 8 can scan your globally installed AI coding agent skills and hooks for malicious patterns. This reads files outside the repo. Want to include this?"
Options: A) Yes — scan global skills too  B) No — repo-local only

如果用户批准，对 globally installed skill files 运行同样的 Grep patterns，并检查 user settings 中的 hooks。

**Severity:** credential exfiltration attempts / skill files 中的 prompt injection 为 CRITICAL。Suspicious network calls / overly broad tool permissions 为 HIGH。未经 review 的 unverified source skills 为 MEDIUM。

**FP rules:** gstack 自己的 skills 是 trusted（检查 skill path 是否 resolve 到 known repo）。使用 `curl` 做 legitimate purposes（下载 tools、health checks）的 skills 需要结合上下文；只有 target URL 可疑或 command 包含 credential variables 时才 flag。

### Phase 9: OWASP Top 10 Assessment

对每个 OWASP category 执行 targeted analysis。所有搜索都用 Grep tool，并按 Phase 0 检测到的 stacks 限定 file extensions。

#### A01: Broken Access Control
- 检查 controllers/routes 上是否缺少 auth（skip_before_action、skip_authorization、public、no_auth）
- 检查 direct object reference patterns（params[:id]、req.params.id、request.args.get）
- User A 能否通过修改 IDs 访问 user B 的 resources？
- 是否存在 horizontal/vertical privilege escalation？

#### A02: Cryptographic Failures
- Weak crypto（MD5、SHA1、DES、ECB）或 hardcoded secrets
- Sensitive data 是否在 at rest 和 in transit 时都加密？
- Keys/secrets 是否正确管理（env vars，不 hardcode）？

#### A03: Injection
- SQL injection：raw queries、SQL string interpolation
- Command injection：system()、exec()、spawn()、popen
- Template injection：render with params、eval()、html_safe、raw()
- LLM prompt injection：综合覆盖见 Phase 7

#### A04: Insecure Design
- Authentication endpoints 是否有 rate limits？
- Failed attempts 后是否有 account lockout？
- Business logic 是否 server-side validated？

#### A05: Security Misconfiguration
- CORS configuration（production 是否 wildcard origins？）
- CSP headers 是否存在？
- Production 是否启用 debug mode / verbose errors？

#### A06: Vulnerable and Outdated Components
见 **Phase 3（Dependency Supply Chain）** 获取 comprehensive component analysis。

#### A07: Identification and Authentication Failures
- Session management：creation、storage、invalidation
- Password policy：complexity、rotation、breach checking
- MFA：是否可用？admin 是否强制？
- Token management：JWT expiration、refresh rotation

#### A08: Software and Data Integrity Failures
见 **Phase 4（CI/CD Pipeline Security）** 获取 pipeline protection analysis。
- Deserialization inputs 是否 validated？
- External data 是否做 integrity checking？

#### A09: Security Logging and Monitoring Failures
- Authentication events 是否 logged？
- Authorization failures 是否 logged？
- Admin actions 是否 audit-trailed？
- Logs 是否受 tampering 保护？

#### A10: Server-Side Request Forgery (SSRF)
- URL construction 是否来自 user input？
- User-controlled URLs 是否能触达 internal services？
- Outbound requests 是否有 allowlist/blocklist enforcement？

### Phase 10: STRIDE Threat Model

对 Phase 0 中识别的每个 major component，评估：

```
COMPONENT: [Name]
  Spoofing:             Can an attacker impersonate a user/service?
  Tampering:            Can data be modified in transit/at rest?
  Repudiation:          Can actions be denied? Is there an audit trail?
  Information Disclosure: Can sensitive data leak?
  Denial of Service:    Can the component be overwhelmed?
  Elevation of Privilege: Can a user gain unauthorized access?
```

### Phase 11: Data Classification

分类应用处理的所有 data：

```
DATA CLASSIFICATION
═══════════════════
RESTRICTED (breach = legal liability):
  - Passwords/credentials: [where stored, how protected]
  - Payment data: [where stored, PCI compliance status]
  - PII: [what types, where stored, retention policy]

CONFIDENTIAL (breach = business damage):
  - API keys: [where stored, rotation policy]
  - Business logic: [trade secrets in code?]
  - User behavior data: [analytics, tracking]

INTERNAL (breach = embarrassment):
  - System logs: [what they contain, who can access]
  - Configuration: [what's exposed in error messages]

PUBLIC:
  - Marketing content, documentation, public APIs
```
