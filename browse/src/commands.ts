/**
 * Command registry — single source of truth for all browse commands.
 *
 * Dependency graph:
 *   commands.ts ──▶ server.ts (runtime dispatch)
 *                ──▶ gen-skill-docs.ts (doc generation)
 *                ──▶ skill-parser.ts (validation)
 *                ──▶ skill-check.ts (health reporting)
 *
 * Zero side effects. Safe to import from build scripts and tests.
 */

export const READ_COMMANDS = new Set([
  'text', 'html', 'links', 'forms', 'accessibility',
  'js', 'eval', 'css', 'attrs',
  'console', 'network', 'cookies', 'storage', 'perf',
  'dialog', 'is',
  'inspect',
  'media', 'data',
]);

export const WRITE_COMMANDS = new Set([
  'goto', 'back', 'forward', 'reload',
  'load-html',
  'click', 'fill', 'select', 'hover', 'type', 'press', 'scroll', 'wait',
  'viewport', 'cookie', 'cookie-import', 'cookie-import-browser', 'header', 'useragent',
  'upload', 'dialog-accept', 'dialog-dismiss',
  'style', 'cleanup', 'prettyscreenshot',
  'download', 'scrape', 'archive',
]);

export const META_COMMANDS = new Set([
  'tabs', 'tab', 'tab-each', 'newtab', 'closetab',
  'status', 'stop', 'restart',
  'screenshot', 'pdf', 'responsive',
  'chain', 'diff',
  'url', 'snapshot',
  'handoff', 'resume',
  'connect', 'disconnect', 'focus',
  'inbox',
  'watch',
  'state',
  'frame',
  'ux-audit',
  'domain-skill',
  'skill',
  'cdp',
  'memory',
]);

export const ALL_COMMANDS = new Set([...READ_COMMANDS, ...WRITE_COMMANDS, ...META_COMMANDS]);

/** Commands that return untrusted third-party page content */
export const PAGE_CONTENT_COMMANDS = new Set([
  'text', 'html', 'links', 'forms', 'accessibility', 'attrs',
  'console', 'dialog',
  'media', 'data',
  'ux-audit',
  // snapshot emits aria tree with attacker-controlled aria-label strings.
  // The sidebar's system prompt pushes agents to run `$B snapshot` as the
  // primary read path, so unwrapped snapshot output is the biggest ingress
  // for indirect prompt injection. Envelope it like every other read.
  'snapshot',
]);

/**
 * Subset of PAGE_CONTENT_COMMANDS whose output is derived from the
 * live page DOM. These channels can carry hidden elements or
 * ARIA-injection payloads that the centralized envelope wrap alone
 * does not neutralize, so the scoped-token pipeline runs
 * `markHiddenElements` on the page before the read and surfaces any
 * hits as CONTENT WARNINGS to the LLM.
 *
 * `console`, `dialog` intentionally excluded — they read separate
 * runtime state (console capture, dialog events), not the DOM tree.
 */
export const DOM_CONTENT_COMMANDS = new Set([
  'text', 'html', 'links', 'forms', 'accessibility', 'attrs',
  'media', 'data', 'ux-audit',
]);

/** Wrap output from untrusted-content commands with trust boundary markers */
export function wrapUntrustedContent(result: string, url: string): string {
  // Sanitize URL: remove newlines to prevent marker injection via history.pushState
  const safeUrl = url.replace(/[\n\r]/g, '').slice(0, 200);
  // Escape marker strings in content to prevent boundary escape attacks
  const safeResult = result.replace(/--- (BEGIN|END) UNTRUSTED EXTERNAL CONTENT/g, '--- $1 UNTRUSTED EXTERNAL C\u200BONTENT');
  return `--- BEGIN UNTRUSTED EXTERNAL CONTENT (source: ${safeUrl}) ---\n${safeResult}\n--- END UNTRUSTED EXTERNAL CONTENT ---`;
}

export const COMMAND_DESCRIPTIONS: Record<string, { category: string; description: string; usage?: string }> = {
  // Navigation
  'memory':  { category: 'Server', description: 'Snapshot Bun heap + per-tab JS heap + Chromium process tree + bounded buffer sizes. JSON output with --json.', usage: 'memory [--json]' },
  'goto':    { category: 'Navigation', description: 'Navigate to URL (http://, https://, or file:// scoped to cwd/TEMP_DIR)', usage: 'goto <url>' },
  'load-html': { category: 'Navigation', description: 'Load HTML via setContent. Accepts a file path under safe-dirs (validated), OR --from-file <payload.json> with {"html":"...","waitUntil":"..."} for large inline HTML (Windows argv safe).', usage: 'load-html <file> [--wait-until load|domcontentloaded|networkidle] [--tab-id <N>]  |  load-html --from-file <payload.json> [--tab-id <N>]' },
  'back':    { category: 'Navigation', description: 'History back' },
  'forward': { category: 'Navigation', description: 'History forward' },
  'reload':  { category: 'Navigation', description: 'Reload page' },
  'url':     { category: 'Navigation', description: 'Print current URL' },
  // Reading
  'text':    { category: 'Reading', description: 'Cleaned page text' },
  'html':    { category: 'Reading', description: 'innerHTML of selector (throws if not found), or full page HTML if no selector given', usage: 'html [selector]' },
  'links':   { category: 'Reading', description: 'All links as "text → href"' },
  'forms':   { category: 'Reading', description: 'Form fields as JSON' },
  'accessibility': { category: 'Reading', description: 'Full ARIA tree' },
  'media':   { category: 'Reading', description: 'All media elements (images, videos, audio) with URLs, dimensions, types', usage: 'media [--images|--videos|--audio] [selector]' },
  'data':    { category: 'Reading', description: 'Structured data: JSON-LD, Open Graph, Twitter Cards, meta tags', usage: 'data [--jsonld|--og|--meta|--twitter]' },
  // Inspection
  'js':      { category: 'Inspection', description: '在 page context 中运行 inline JavaScript expression，并以 string 返回结果。与 eval 使用相同 JS sandbox；区别只是 js 接收 inline expr，而 eval 从 file 读取。', usage: 'js <expr>' },
  'eval':    { category: 'Inspection', description: '在 page context 中从 file 运行 JavaScript，并以 string 返回结果。Path 必须 resolve 到 /tmp 或 cwd 下（禁止 traversal）。multi-line scripts 用 eval；one-liners 用 js。', usage: 'eval <file>' },
  'css':     { category: 'Inspection', description: 'Computed CSS value', usage: 'css <sel> <prop>' },
  'attrs':   { category: 'Inspection', description: 'Element attributes as JSON', usage: 'attrs <sel|@ref>' },
  'is':      { category: 'Inspection', description: 'State check on element. Valid <prop> values: visible, hidden, enabled, disabled, checked, editable, focused (case-sensitive). <sel> accepts a CSS selector OR an @ref token from a prior snapshot (e.g. @e3, @c1) — refs are interchangeable with selectors anywhere a selector is expected.', usage: 'is <prop> <sel|@ref>' },
  'console': { category: 'Inspection', description: 'Console messages (--errors filters to error/warning)', usage: 'console [--clear|--errors]' },
  'network': { category: 'Inspection', description: 'Network requests', usage: 'network [--clear]' },
  'dialog':  { category: 'Inspection', description: 'Dialog messages', usage: 'dialog [--clear]' },
  'cookies': { category: 'Inspection', description: 'All cookies as JSON' },
  'storage': { category: 'Inspection', description: 'Read both localStorage and sessionStorage as JSON. With "set <key> <value>", write to localStorage only (sessionStorage is read-only via this command — set it with `js sessionStorage.setItem(...)`).', usage: 'storage  |  storage set <key> <value>' },
  'perf':    { category: 'Inspection', description: 'Page load timings' },
  // Interaction
  'click':   { category: 'Interaction', description: 'Click element', usage: 'click <sel>' },
  'fill':    { category: 'Interaction', description: 'Fill input', usage: 'fill <sel> <val>' },
  'select':  { category: 'Interaction', description: 'Select dropdown option by value, label, or visible text', usage: 'select <sel> <val>' },
  'hover':   { category: 'Interaction', description: 'Hover element', usage: 'hover <sel>' },
  'type':    { category: 'Interaction', description: 'Type into focused element', usage: 'type <text>' },
  'press':   { category: 'Interaction', description: 'Press a Playwright keyboard key against the focused element. Names are case-sensitive: Enter, Tab, Escape, ArrowUp/Down/Left/Right, Backspace, Delete, Home, End, PageUp, PageDown. Modifiers combine with +: Shift+Enter, Control+A, Meta+K. Single printable chars (a, A, 1) work too. Full key list: https://playwright.dev/docs/api/class-keyboard#keyboard-press', usage: 'press <key>' },
  'scroll':  { category: 'Interaction', description: '带 selector 时，将元素平滑滚入视图；不带 selector 时跳到页面底部。没有 --by/--to amount option；需要像素级精确滚动时使用 `js window.scrollTo(0, N)`。', usage: 'scroll [sel|@ref]' },
  'wait':    { category: 'Interaction', description: 'Wait for element, network idle, or page load (timeout: 15s)', usage: 'wait <sel|--networkidle|--load>' },
  'upload':  { category: 'Interaction', description: 'Upload file(s)', usage: 'upload <sel> <file> [file2...]' },
  'viewport':{ category: 'Interaction', description: 'Set viewport size and optional deviceScaleFactor (1-3, for retina screenshots). --scale requires a context rebuild.', usage: 'viewport [<WxH>] [--scale <n>]' },
  'cookie':  { category: 'Interaction', description: 'Set cookie on current page domain', usage: 'cookie <name>=<value>' },
  'cookie-import': { category: 'Interaction', description: 'Import cookies from JSON file', usage: 'cookie-import <json>' },
  'cookie-import-browser': { category: 'Interaction', description: 'Import cookies from installed Chromium browsers (opens picker, or use --domain for direct import)', usage: 'cookie-import-browser [browser] [--domain d]' },
  'header':  { category: 'Interaction', description: 'Set custom request header (colon-separated, sensitive values auto-redacted)', usage: 'header <name>:<value>' },
  'useragent': { category: 'Interaction', description: 'Set user agent', usage: 'useragent <string>' },
  'dialog-accept': { category: 'Interaction', description: '自动接受下一次 alert/confirm/prompt；可选 text 会作为 prompt response 发送', usage: 'dialog-accept [text]' },
  'dialog-dismiss': { category: 'Interaction', description: 'Auto-dismiss next dialog' },
  // Data extraction
  'download': { category: 'Extraction', description: '使用 browser cookies 将 URL 或 media element 下载到 disk。对会触发 browser downloads 的 URLs 使用 --navigate（CDN redirects、Content-Disposition、anti-bot protected sites）', usage: 'download <url|@ref> [path] [--base64] [--navigate]' },
  'scrape':   { category: 'Extraction', description: 'Bulk download all media from page. Writes manifest.json', usage: 'scrape <images|videos|media> [--selector sel] [--dir path] [--limit N]' },
  'archive':  { category: 'Extraction', description: 'Save complete page as MHTML via CDP', usage: 'archive [path]' },
  // Visual
  'screenshot': { category: 'Visual', description: 'Save screenshot. --selector targets a specific element (explicit flag form). Positional selectors starting with ./#/@/[ still work.', usage: 'screenshot [--selector <css>] [--viewport] [--clip x,y,w,h] [--base64] [selector|@ref] [path]' },
  'pdf':     { category: 'Visual', description: 'Save the current page as PDF. Supports page layout (--format, --width, --height, --margins, --margin-*), structure (--toc waits for Paged.js), branding (--header-template, --footer-template, --page-numbers), accessibility (--tagged, --outline), and --from-file <payload.json> for large payloads. Use --tab-id <N> to target a specific tab.', usage: 'pdf [path] [--format letter|a4|legal] [--width <dim> --height <dim>] [--margins <dim>] [--margin-top <dim> --margin-right <dim> --margin-bottom <dim> --margin-left <dim>] [--header-template <html>] [--footer-template <html>] [--page-numbers] [--tagged] [--outline] [--print-background] [--prefer-css-page-size] [--toc] [--tab-id <N>]  |  pdf --from-file <payload.json> [--tab-id <N>]' },
  'responsive': { category: 'Visual', description: 'Screenshots at mobile (375x812), tablet (768x1024), desktop (1280x720). Saves as {prefix}-mobile.png etc.', usage: 'responsive [prefix]' },
  'diff':    { category: 'Visual', description: 'Text diff between pages', usage: 'diff <url1> <url2>' },
  // Tabs
  'tabs':    { category: 'Tabs', description: 'List open tabs' },
  'tab':     { category: 'Tabs', description: 'Switch to tab', usage: 'tab <id>' },
  'newtab':  { category: 'Tabs', description: 'Open new tab. With --json, returns {"tabId":N,"url":...} for programmatic use (make-pdf).', usage: 'newtab [url] [--json]' },
  'closetab':{ category: 'Tabs', description: 'Close tab', usage: 'closetab [id]' },
  'tab-each':{ category: 'Tabs', description: 'Run a command on every open tab. Returns JSON with per-tab results.', usage: 'tab-each <command> [args...]' },
  // Server
  'status':  { category: 'Server', description: 'Health check' },
  'stop':    { category: 'Server', description: 'Shutdown server' },
  'restart': { category: 'Server', description: 'Restart server' },
  // Meta
  'snapshot':{ category: 'Snapshot', description: 'Accessibility tree，带 @e refs 用于 element selection。Flags: -i interactive only, -c compact, -d N depth limit, -s sel scope, -D diff vs previous, -a annotated screenshot, -o path output, -C cursor-interactive @c refs', usage: 'snapshot [flags]' },
  'chain':   { category: 'Meta', description: '从 stdin 的 JSON 运行一串 commands。输入是一个 JSON array of arrays，每个 inner array 为 [cmd, ...args]。每个 command 输出一个 JSON result。将 JSON array（例如 `[["goto","https://example.com"],["text","h1"]]`）pipe 给 `$B chain`，它会依次运行 goto 和 text command。遇到第一个 error 即停止。', usage: 'chain  (JSON via stdin)' },
  // Handoff
  'handoff': { category: 'Server', description: 'Open visible Chrome at current page for user takeover', usage: 'handoff [message]' },
  'resume':  { category: 'Server', description: 'Re-snapshot after user takeover, return control to AI', usage: 'resume' },
  // Headed mode
  'connect': { category: 'Server', description: 'Launch headed Chromium with Chrome extension', usage: 'connect' },
  'disconnect': { category: 'Server', description: 'Disconnect headed browser, return to headless mode' },
  'focus':   { category: 'Server', description: 'Bring headed browser window to foreground (macOS)', usage: 'focus [@ref]' },
  // Inbox
  'inbox':   { category: 'Meta', description: 'List messages from sidebar scout inbox', usage: 'inbox [--clear]' },
  // Watch
  'watch':   { category: 'Meta', description: 'Passive observation — periodic snapshots while user browses', usage: 'watch [stop]' },
  // State
  'state':   { category: 'Server', description: 'Save/load browser state (cookies + URLs)', usage: 'state save|load <name>' },
  // Frame
  'frame':   { category: 'Meta', description: 'Switch to iframe context (or main to return)', usage: 'frame <sel|@ref|--name n|--url pattern|main>' },
  // CSS Inspector
  'inspect': { category: 'Inspection', description: 'Deep CSS inspection via CDP — full rule cascade, box model, computed styles', usage: 'inspect [selector] [--all] [--history]' },
  'style':   { category: 'Interaction', description: 'Modify CSS property on element (with undo support)', usage: 'style <sel> <prop> <value> | style --undo [N]' },
  'cleanup': { category: 'Interaction', description: 'Remove page clutter (ads, cookie banners, sticky elements, social widgets)', usage: 'cleanup [--ads] [--cookies] [--sticky] [--social] [--all]' },
  'prettyscreenshot': { category: 'Visual', description: '生成 clean screenshot，可选 cleanup、scroll positioning 和 element hiding', usage: 'prettyscreenshot [--scroll-to sel|text] [--cleanup] [--hide sel...] [--width px] [path]' },
  // UX Audit
  'ux-audit': { category: 'Inspection', description: '抽取 page structure 供 UX behavioral analysis 使用 — site ID、nav、headings、text blocks、interactive elements。返回 JSON 供 agent interpretation。', usage: 'ux-audit' },
  // Domain skills (per-site notes the agent writes for itself)
  'domain-skill': { category: 'Meta', description: 'agent 写给自己的 per-site notes。Host 从 active tab 推导。Lifecycle：`save` 添加 quarantined note → N=3 次 successful uses 且未被 prompt-injection classifier 标记后，note 自动 promote 为 "active" → `promote-to-global` 提升到 global tier（machine-wide，all projects）。classifier flag 由 L4 prompt-injection scan 自动设置；agents 不手动设置。用 `list` / `show` inspect，`edit` revise，`rollback` demote，`rm` tombstone。', usage: 'domain-skill save|list|show|edit|promote-to-global|rollback|rm <host?>' },
  // Browser-skills (hand-written or generated Playwright scripts the runtime spawns)
  'skill':        { category: 'Meta', description: '运行 browser-skill：deterministic Playwright script，通过 loopback HTTP 驱动 daemon。3-tier lookup（project > global > bundled）。Spawned scripts 获得 per-spawn scoped token（仅 read+write），绝不会拿到 daemon root token。', usage: 'skill list|show|run|test|rm <name?> [--arg k=v]... [--timeout=Ns]' },
  // CDP escape hatch (deny-default; see browse/src/cdp-allowlist.ts)
  'cdp':          { category: 'Inspection', description: 'Raw Chrome DevTools Protocol method dispatch。Deny-default：只有 `browse/src/cdp-allowlist.ts`（CDP_ALLOWLIST const）列出的 methods 可访问；其他 method 都返回 403。每个 allowlist entry 声明 scope（tab vs browser）和 output（trusted vs untrusted）— untrusted methods（data-exfil-shaped，例如 Network.getResponseBody）会用 UNTRUSTED-envelope 包裹输出。要发现 allowed methods，请阅读 `browse/src/cdp-allowlist.ts`。Example: `$B cdp Page.getLayoutMetrics`。', usage: 'cdp <Domain.method> [json-params]' },
};

// Load-time validation: descriptions must cover exactly the command sets
const allCmds = new Set([...READ_COMMANDS, ...WRITE_COMMANDS, ...META_COMMANDS]);
const descKeys = new Set(Object.keys(COMMAND_DESCRIPTIONS));
for (const cmd of allCmds) {
  if (!descKeys.has(cmd)) throw new Error(`COMMAND_DESCRIPTIONS missing entry for: ${cmd}`);
}
for (const key of descKeys) {
  if (!allCmds.has(key)) throw new Error(`COMMAND_DESCRIPTIONS has unknown command: ${key}`);
}

/**
 * Command aliases — user-friendly names that route to canonical commands.
 *
 * Single source of truth: server.ts dispatch and meta-commands.ts chain prevalidation
 * both import `canonicalizeCommand()`, so aliases resolve identically everywhere.
 *
 * When adding a new alias: keep the alias name guessable (e.g. setcontent → load-html
 * helps agents migrating from Puppeteer's page.setContent()).
 */
export const COMMAND_ALIASES: Record<string, string> = {
  'setcontent': 'load-html',
  'set-content': 'load-html',
  'setContent': 'load-html',
};

/** Resolve an alias to its canonical command name. Non-aliases pass through unchanged. */
export function canonicalizeCommand(cmd: string): string {
  return COMMAND_ALIASES[cmd] ?? cmd;
}

/**
 * Commands added in specific versions — enables future "this command was added in vX"
 * upgrade hints in unknown-command errors. Only helps agents on *newer* browse builds
 * that encounter typos of recently-added commands; does NOT help agents on old builds
 * that type a new command (they don't have this map).
 */
export const NEW_IN_VERSION: Record<string, string> = {
  'load-html': '0.19.0.0',
};

/**
 * Levenshtein distance (dynamic programming).
 * O(a.length * b.length) — fast for command name sizes (<20 chars).
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const m: number[][] = [];
  for (let i = 0; i <= a.length; i++) m.push([i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
    }
  }
  return m[a.length][b.length];
}

/**
 * Build an actionable error message for an unknown command.
 *
 * Pure function — takes the full command set + alias map + version map as args so tests
 * can exercise the synthetic "older-version" case without mutating any global state.
 *
 *   1. Always names the input.
 *   2. If Levenshtein distance ≤ 2 AND input.length ≥ 4, suggests the closest match
 *      (alphabetical tiebreak for determinism). Short-input guard prevents noisy
 *      suggestions for typos of 2-letter commands like 'js' or 'is'.
 *   3. If the input appears in newInVersion, appends an upgrade hint. Honesty caveat:
 *      this only fires on builds that have this handler AND the map entry; agents on
 *      older builds hitting a newly-added command won't see it. Net benefit compounds
 *      as more commands land.
 */
export function buildUnknownCommandError(
  command: string,
  commandSet: Set<string>,
  aliasMap: Record<string, string> = COMMAND_ALIASES,
  newInVersion: Record<string, string> = NEW_IN_VERSION,
): string {
  let msg = `Unknown command: '${command}'.`;

  // Suggestion via Levenshtein, gated on input length to avoid noisy short-input matches.
  // Candidates are pre-sorted alphabetically, so strict "d < bestDist" gives us the
  // closest match with alphabetical tiebreak for free — first equal-distance candidate
  // wins because subsequent equal-distance candidates fail the strict-less check.
  if (command.length >= 4) {
    let best: string | undefined;
    let bestDist = 3; // sentinel: distance 3 would be rejected by the <= 2 gate below
    const candidates = [...commandSet, ...Object.keys(aliasMap)].sort();
    for (const cand of candidates) {
      const d = levenshtein(command, cand);
      if (d <= 2 && d < bestDist) {
        best = cand;
        bestDist = d;
      }
    }
    if (best) msg += ` Did you mean '${best}'?`;
  }

  if (newInVersion[command]) {
    msg += ` This command was added in browse v${newInVersion[command]}. Upgrade: cd ~/.claude/skills/gstack && git pull && bun run build.`;
  }

  return msg;
}
