/**
 * redact-doc — shared redaction docs + invocation bash 的 resolvers。
 *
 *   {{REDACT_TAXONOMY_TABLE}}            → markdown table of the 3-tier taxonomy,
 *                                          从 lib/redact-patterns 派生，因此 /spec
 *                                          和 /cso 永远不会与 engine drift。
 *   {{REDACT_INVOCATION_BLOCK:<sink>}}   → the canonical scan-at-sink bash + prose
 *                                          for one enforcement point。<sink> 是
 *                                          hyphenated label：pre-codex、pre-issue、
 *                                          pre-archive、pre-pr-body、pre-pr-title、
 *                                          pre-commit。
 *
 * DRY：每个 skill 针对每个 enforcement point 写一个 placeholder；UX/threshold
 * changes 只在这里落一次。test/redact-doc-resolver.test.ts golden-pins output。
 */
import type { TemplateContext } from './types';
import { PATTERNS, type Tier } from '../../lib/redact-patterns';

// human-readable table 中每个 pattern 的 representative example/prefix。这样可保持
// lib/redact-patterns clean（无 doc strings），同时确保 recognizable prefixes
//（AKIA、ghp_、sk-ant-、sk-、BEGIN）出现在 generated docs 中。
const EXAMPLE: Record<string, string> = {
  'aws.access_key': 'AKIA…',
  'aws.secret_key': '40-char base64 near aws_secret_access_key',
  'github.pat': 'ghp_…',
  'github.oauth': 'gho_…',
  'github.server': 'ghs_…',
  'github.fine_grained': 'github_pat_…',
  'anthropic.key': 'sk-ant-…',
  'openai.key': 'sk-… / sk-proj-…',
  'sendgrid.key': 'SG.x.y',
  'stripe.secret': 'sk_live_…',
  'slack.token': 'xoxb-/xoxp-…',
  'slack.webhook': 'hooks.slack.com/services/…',
  'discord.webhook': 'discord.com/api/webhooks/…',
  'twilio.auth_token': '32-hex near an AC… SID',
  'pem.private_key': '-----BEGIN … PRIVATE KEY-----',
  'db.url_with_password': 'postgres://user:pw@host',
  'creds.basic_auth_url': 'https://user:pw@host',
  'stripe.publishable': 'pk_live_…',
  'google.api_key': 'AIza…',
  'jwt': 'eyJ….eyJ….sig',
  'env.kv': 'FOO_SECRET=<high-entropy>',
  'pii.email': 'name@host.tld',
  'pii.phone.e164': '+1 415 555 0123',
  'pii.ssn': '123-45-6789',
  'pii.cc': 'Luhn-valid 13-19 digits',
  'pii.ip_public': 'public IPv4',
  'pii.wallet': '0x… / bc1… / 1…',
  'internal.hostname': 'host.corp / host.internal',
  'internal.url_private': 'http://localhost:PORT/path',
  'legal.nda_marker': 'CONFIDENTIAL / UNDER NDA',
  'legal.named_criticism': 'negative judgment + a full name',
  'internal.user_path': '/Users/<name>/… , /home/<name>/…',
  'hygiene.todo': 'TODO(owner)',
};

const TIER_BLURB: Record<Tier, string> = {
  HIGH: 'HIGH — 真正的 secret credentials。会 block dispatch/file/edit/commit。',
  MEDIUM:
    'MEDIUM — PII、legal/damaging、internal-leak 和 high-FP credential-shaped ' +
    'patterns。通过 AskUserQuestion 确认（public repos 更严厉）；永不 auto-block。',
  LOW: 'LOW — 作为 FYI surfaced，永不 block。',
};

export function generateRedactTaxonomyTable(_ctx: TemplateContext, args?: string[]): string {
  // Compact mode：仅 HIGH-tier rows（会 BLOCK 的 credentials），MEDIUM/LOW 使用一行
  // prose。用于那些会 RUN redaction（例如 /spec）但不是 security catalog 的 skills；
  // 它们需要知道什么会 block + full list 在哪里，而不是 inline 全部约 30 个 patterns。
  // /cso 渲染 full table。
  const compact = args?.[0] === 'compact';
  const out: string[] = [];

  const tiers: Tier[] = compact ? ['HIGH'] : ['HIGH', 'MEDIUM', 'LOW'];
  for (const tier of tiers) {
    out.push(`**${TIER_BLURB[tier]}**`, '');
    out.push('| ID | Catches | Example |');
    out.push('|----|---------|---------|');
    for (const p of PATTERNS.filter((x) => x.tier === tier)) {
      out.push(`| \`${p.id}\` | ${p.description} | ${EXAMPLE[p.id] ?? '—'} |`);
    }
    out.push('');
  }

  if (compact) {
    out.push(
      'MEDIUM（PII / legal / internal + high-FP credential shapes，如 ' +
        '`pk_live_`/`AIza`/JWT/`*_KEY=`）通过 AskUserQuestion 确认；LOW 作为 FYI surfaced。' +
        'Full taxonomy：`lib/redact-patterns.ts`（或 `/cso`）。',
    );
  } else {
    out.push(
      'Calibration：经常误报的 gate 会被忽略，因此 context-variable / ' +
        'high-FP credential shapes（Stripe publishable `pk_live_`、Google `AIza`、' +
        'JWTs、env-style `*_KEY=`）属于 MEDIUM，而不是 HIGH。Full taxonomy 位于 ' +
        '`lib/redact-patterns.ts`，此 table 从它生成。',
    );
  }
  return out.join('\n');
}

// ── Invocation block (scan-at-sink) ──────────────────────────────────────────

interface SinkSpec {
  /** prose 中描述的被扫描对象。 */
  noun: string;
  /** HIGH 会 block 什么，用该 skill 的 verbs 表达。 */
  blockVerb: string;
}

const SINKS: Record<string, SinkSpec> = {
  'pre-codex': { noun: '即将发送给 Codex 的 spec body', blockVerb: 'dispatch to codex' },
  'pre-issue': { noun: '你即将提交的 issue body', blockVerb: 'file the issue' },
  'pre-archive': { noun: '即将 archived 的 body', blockVerb: 'write the archive' },
  'pre-pr-body': { noun: 'composed PR body', blockVerb: 'create/edit the PR' },
  'pre-pr-title': { noun: 'PR title', blockVerb: 'set the PR title' },
  'pre-commit': { noun: '即将 committed 的 generated docs', blockVerb: 'commit' },
};

export function generateRedactInvocationBlock(ctx: TemplateContext, args?: string[]): string {
  const sinkLabel = args?.[0] ?? 'pre-issue';
  const brief = args?.[1] === 'brief';
  const sink = SINKS[sinkLabel] ?? SINKS['pre-issue'];
  const bin = `${ctx.paths.binDir}/gstack-redact`;

  // Brief variant：repeat sinks 的 compact pointer，让完整约 40 行 procedure
  // 每个 skill 只 ship 一次，而不是每个 enforcement point 一次。
  if (brief) {
    return `#### Redaction scan — ${sinkLabel} (${sink.noun})

对 ${sink.noun} 运行上方相同的 scan-at-sink procedure（resolve 一次 \`$REDACT_VIS\`
并复用；把 exact bytes 写入 \`$REDACT_FILE\`；运行 \`${bin} --from-file "$REDACT_FILE"
--repo-visibility "$REDACT_VIS" --json\`）。应用同样的 exit-3/2/0 handling。
exit 3 时不要 ${sink.blockVerb}；HIGH 没有 skip。把同一个 \`$REDACT_FILE\`
向下游传递，确保 scanned bytes 就是 sent bytes。`;
  }

  return `#### Redaction scan — ${sinkLabel} (${sink.noun})

对即将发送的 EXACT bytes 做 scan-at-sink：写入 temp file，扫描该 file，
再把 SAME file 传给下游。Never scan a string then re-render it.

\`\`\`bash
command -v bun >/dev/null 2>&1 || echo "redaction scan skipped — bun not on PATH"
# Resolve visibility 一次；cache + reuse。顺序：local config（~/.gstack，never
# committed）→ gh → glab → unknown（=public-strict）。
REDACT_VIS=$(~/.claude/skills/gstack/bin/gstack-config get redact_repo_visibility 2>/dev/null)
[ -z "$REDACT_VIS" ] && REDACT_VIS=$(gh repo view --json visibility -q .visibility 2>/dev/null | tr 'A-Z' 'a-z')
[ -z "$REDACT_VIS" ] && REDACT_VIS=$(glab repo view -F json 2>/dev/null | grep -o '"visibility":"[^"]*"' | head -1 | sed 's/.*:"//;s/"//' | tr 'A-Z' 'a-z')
REDACT_VIS="\${REDACT_VIS:-unknown}"
REDACT_FILE=$(mktemp)
cat > "$REDACT_FILE" <<'REDACT_BODY_EOF'
<the exact ${sink.noun} goes here>
REDACT_BODY_EOF
REDACT_JSON=$(${bin} --from-file "$REDACT_FILE" --repo-visibility "$REDACT_VIS" --self-email "$(git config user.email 2>/dev/null)" --json)
REDACT_CODE=$?
\`\`\`

Branch on \`$REDACT_CODE\`:

1. **Exit 3 (HIGH)** — print findings；不要 ${sink.blockVerb}；告诉用户
   rotate + redact at source，然后 re-run。HIGH 没有 skip flag。不要在任何地方 persist
   ${sink.noun}。
2. **Exit 2 (MEDIUM)** — 每个 finding AskUserQuestion（cluster identical ids；PUBLIC
   repos 使用更严厉措辞，不 batch-acknowledge，不 silent-proceed）。PII subset
   （\`pii.email\`/\`pii.phone.e164\`/\`pii.ssn\`/\`pii.cc\`）提供 **Auto-redact**（用
   \`--auto-redact <ids>\` re-run → 使用打印出的 sanitized body）/ **Edit** / **Cancel**；
   non-PII MEDIUM 提供 **Proceed (acknowledged)** / **Edit** / **Cancel**（无 auto-redact）。
3. **Exit 0 (clean)** — proceed；将 \`WARN\`（tool-fence degrades）+ \`LOW\` surfaced 为
   一行 FYI（never blocks）。

\`\`\`bash
rm -f "$REDACT_FILE"
\`\`\`

这是 guardrail，不是 airtight enforcement；直接 \`gh\`/\`git\` 会绕过它。它用于捕捉 accidents。`;
}
