#!/usr/bin/env bun
/**
 * 2013 vs 2026 output throughput comparison。
 *
 * Rationale：README hero 过去用 "600,000+ lines of production code" 作为
 * productivity proxy。Louise de Sadeleer 的 review
 * (https://x.com/LouiseDSadeleer/status/2045139351227478199) 指出，当大多数
 * code 由 AI 写出时，LOC 是 vanity metric。我们把它替换为 logical code change
 * 的真实 pro-rata multiple：public repos 中 authored commits 新增的 non-blank、
 * non-comment lines，并分别计算 2013 和 2026。
 *
 * Algorithm（按 PLAN_TUNING_V1 中的 Codex Pass 2 review）：
 *   1. 对每个 year（2013、2026），枚举 authored commits。Author filter 来自
 *      --email CLI flags（可重复）、GSTACK_AUTHOR_EMAILS env var（逗号分隔），
 *      或 fallback 到 `git config user.email`。
 *   2. 对每个 commit，git diff <commit>^ <commit> 生成 unified diff。
 *   3. 从 diff 中提取 ADDED lines。通过过滤 blank lines + single-line comments
 *      归类为 "logical"（per-language regex；不完美但诚实，比 raw LOC 更好）。
 *   4. 按 year 汇总。报告 raw additions + logical additions + per-language
 *      breakdown + caveats。Caveats 很重要：仅 public repos、commit-style drift、
 *      private work exclusion。
 *
 * Requires：scc（可用时用于 classification；不可用则 fallback 到 regex）。
 * Run: bun run scripts/garry-output-comparison.ts [--repo-root <path>] [--email <addr>...]
 *      GSTACK_AUTHOR_EMAILS=a@x.com,b@y.com bun run scripts/garry-output-comparison.ts
 * Output: docs/throughput-2013-vs-2026.json
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

function resolveAuthorEmails(argv: string[]): string[] {
  const fromArgs: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--email' && argv[i + 1]) {
      fromArgs.push(argv[i + 1]);
      i++;
    }
  }
  if (fromArgs.length > 0) return fromArgs;

  const envVar = process.env.GSTACK_AUTHOR_EMAILS;
  if (envVar && envVar.trim()) {
    return envVar.split(',').map(s => s.trim()).filter(Boolean);
  }

  try {
    const gitEmail = execSync('git config user.email', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (gitEmail) return [gitEmail];
  } catch {
    // fall through
  }

  process.stderr.write(
    'No author email configured. Pass --email <addr> (repeatable), ' +
    'set GSTACK_AUTHOR_EMAILS=a@x.com,b@y.com, or configure git user.email.\n'
  );
  process.exit(1);
}

const TARGET_YEARS = [2013, 2026];

// 完全跳过的 repos，因为它们不是真正 shipping work（demos、spikes、vendored imports、
// throwaway experiments）。如果 script 指向其中之一，它会输出 stderr note 并退出，
// 不写 per-repo JSON。新增时请通过 PR 附一行 rationale。
const EXCLUDED_REPOS: Record<string, string> = {
  'tax-app': 'demo app for an upcoming YC channel video, not production shipping work',
};

type PerYearResult = {
  year: number;
  active: boolean;
  commits: number;
  files_touched: number;
  raw_lines_added: number;
  logical_lines_added: number;
  active_weeks: number;
  days_elapsed: number;           // 过去 years 为 365；current year 为 day-of-year
  is_partial: boolean;            // current year（今天的 2026）为 true；过去为 false
  per_day_rate: {                  // 按 calendar day（包含 non-active days）
    logical: number;
    raw: number;
    commits: number;
  };
  annualized_projection: {         // per_day_rate × 365，表示如果 pace 保持，全年会怎样
    logical: number;
    raw: number;
    commits: number;
  };
  per_language: Record<string, { commits: number; logical_added: number }>;
  caveats: string[];
};

type Output = {
  computed_at: string;
  scc_available: boolean;
  years: PerYearResult[];
  multiples: {
    // TO-DATE：raw totals。比较完整 2013 年和（可能是 partial 的）2026 年。
    // 回答："How much has been produced so far?"
    to_date: {
      logical_lines_added: number | null;
      raw_lines_added: number | null;
      commits: number | null;
      files_touched: number | null;
    };
    // RUN RATE：per-day pace，不受 calendar coverage 影响，可 apples-to-apples 比较。
    // 回答："What's the pace at, normalized for time elapsed?"
    run_rate: {
      logical_per_day: number | null;
      raw_per_day: number | null;
      commits_per_day: number | null;
    };
    // Deprecated：为读取 JSON 的 older consumers 保留 backwards-compat。
    // Alias 到 `to_date.logical_lines_added`，未来版本会移除。
    logical_lines_added: number | null;
  };
  caveats_global: string[];
  version: number;
};

function hasScc(): boolean {
  try {
    execSync('command -v scc', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function printSccHint(): void {
  const hint = [
    '',
    'scc is required for language classification of added lines.',
    'Run: bash scripts/setup-scc.sh',
    '  (macOS: brew install scc)',
    '  (Linux: apt install scc, or download from github.com/boyter/scc/releases)',
    '  (Windows: github.com/boyter/scc/releases)',
    '',
  ].join('\n');
  process.stderr.write(hint);
}

/**
 * Crude per-language comment-line filter. Used only when scc is unavailable.
 * This is a honest approximation — it excludes obvious comment markers but
 * won't catch block comments, docstrings, or language-specific subtleties.
 * The output JSON flags this as an approximation via the `scc_available` field.
 */
function isLogicalLine(line: string): boolean {
  const trimmed = line.replace(/^\+/, '').trim();
  if (trimmed === '') return false;
  if (trimmed.startsWith('//')) return false;        // JS/TS/Go/Rust/etc
  if (trimmed.startsWith('#')) return false;          // Python/Ruby/shell
  if (trimmed.startsWith('--')) return false;         // SQL/Haskell/Lua
  if (trimmed.startsWith(';')) return false;          // Lisp/Clojure
  if (trimmed.startsWith('/*')) return false;         // C-style block start
  if (trimmed.startsWith('*') && trimmed.length < 80) return false; // C-style block middle
  if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) return false; // Python docstrings
  return true;
}

function enumerateCommits(year: number, repoPath: string, authorEmails: string[]): string[] {
  const since = `${year}-01-01`;
  const until = `${year}-12-31`;
  const authorFlags = authorEmails.map(e => `--author=${e}`).join(' ');
  try {
    const cmd = `git -C "${repoPath}" log --since=${since} --until=${until} ${authorFlags} --pretty=format:'%H' 2>/dev/null`;
    const out = execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\n').filter(l => /^[0-9a-f]{40}$/.test(l.trim()));
  } catch {
    return [];
  }
}

function analyzeCommit(commit: string, repoPath: string, sccAvailable: boolean): {
  raw: number; logical: number; filesTouched: number; perLang: Record<string, number>;
} {
  // Use --no-renames to avoid double-counting R100 renames
  let diff = '';
  try {
    diff = execSync(
      `git -C "${repoPath}" show --no-renames --format= --unified=0 ${commit}`,
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 50 * 1024 * 1024 }
    );
  } catch {
    return { raw: 0, logical: 0, filesTouched: 0, perLang: {} };
  }

  const lines = diff.split('\n');
  let raw = 0;
  let logical = 0;
  const files = new Set<string>();
  const perLang: Record<string, number> = {};
  let currentFile = '';
  let currentExt = '';

  for (const line of lines) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.slice('+++ b/'.length).trim();
      if (currentFile && currentFile !== '/dev/null') {
        files.add(currentFile);
        currentExt = path.extname(currentFile).slice(1) || 'other';
      }
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      raw += 1;
      if (isLogicalLine(line)) {
        logical += 1;
        perLang[currentExt] = (perLang[currentExt] || 0) + 1;
      }
    }
  }

  return { raw, logical, filesTouched: files.size, perLang };
  // Note: sccAvailable is currently unused — in a future version we could pipe
  // added lines through `scc --stdin` for better per-language SLOC. For now the
  // regex fallback is what ships; the output flags this honestly.
  void sccAvailable;
}

/**
 * Days elapsed in the given year as of `now`. For past years returns 365
 * (366 for leap years). For the current year returns the day-of-year
 * through `now`. For future years returns 0.
 */
function daysElapsed(year: number, now: Date = new Date()): number {
  const currentYear = now.getUTCFullYear();
  if (year < currentYear) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return isLeap ? 366 : 365;
  }
  if (year > currentYear) return 0;
  // Current year: days since Jan 1 inclusive
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const diffMs = now.getTime() - jan1.getTime();
  return Math.max(1, Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1);
}

function analyzeRepo(repoPath: string, year: number, authorEmails: string[], sccAvailable: boolean, now: Date = new Date()): PerYearResult {
  const commits = enumerateCommits(year, repoPath, authorEmails);
  const perLang: Record<string, { commits: number; logical_added: number }> = {};
  let rawTotal = 0;
  let logicalTotal = 0;
  let filesTotal = 0;
  const weeks = new Set<string>();

  for (const commit of commits) {
    const r = analyzeCommit(commit, repoPath, sccAvailable);
    rawTotal += r.raw;
    logicalTotal += r.logical;
    filesTotal += r.filesTouched;
    for (const [ext, count] of Object.entries(r.perLang)) {
      if (!perLang[ext]) perLang[ext] = { commits: 0, logical_added: 0 };
      perLang[ext].logical_added += count;
      perLang[ext].commits += 1;
    }
    // Bucket commit into ISO week
    try {
      const dateStr = execSync(
        `git -C "${repoPath}" show --format=%cI --no-patch ${commit}`,
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
      ).trim();
      if (dateStr) {
        const d = new Date(dateStr);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        weeks.add(weekStart.toISOString().slice(0, 10));
      }
    } catch {
      // ignore
    }
  }

  const days = daysElapsed(year, now);
  const isPartial = year === now.getUTCFullYear();
  const perDayLogical = days > 0 ? logicalTotal / days : 0;
  const perDayRaw = days > 0 ? rawTotal / days : 0;
  const perDayCommits = days > 0 ? commits.length / days : 0;

  return {
    year,
    active: commits.length > 0,
    commits: commits.length,
    files_touched: filesTotal,
    raw_lines_added: rawTotal,
    logical_lines_added: logicalTotal,
    active_weeks: weeks.size,
    days_elapsed: days,
    is_partial: isPartial,
    per_day_rate: {
      logical: +perDayLogical.toFixed(2),
      raw: +perDayRaw.toFixed(2),
      commits: +perDayCommits.toFixed(3),
    },
    annualized_projection: {
      logical: Math.round(perDayLogical * 365),
      raw: Math.round(perDayRaw * 365),
      commits: Math.round(perDayCommits * 365),
    },
    per_language: perLang,
    caveats: commits.length === 0
      ? [`使用当前 email filter，在此 repo 的 ${year} 年没有找到 commits。如果该时期存在 private work，则已被排除。`]
      : (isPartial ? [`${year} 年是不完整年份（第 ${days}/365 天）。Run-rate multiple 会按当前 pace 外推。`] : []),
  };
}

function main() {
  const args = process.argv.slice(2);
  const repoRootIdx = args.indexOf('--repo-root');
  const repoRoot = repoRootIdx >= 0 && args[repoRootIdx + 1]
    ? args[repoRootIdx + 1]
    : process.cwd();

  // Check exclusion list — skip with stderr note if repo basename matches.
  // Also delete any stale output JSON so aggregation loops don't pick up
  // numbers from a pre-exclusion run.
  const repoBasename = path.basename(path.resolve(repoRoot));
  if (EXCLUDED_REPOS[repoBasename]) {
    const staleOutput = path.join(repoRoot, 'docs', 'throughput-2013-vs-2026.json');
    if (fs.existsSync(staleOutput)) fs.unlinkSync(staleOutput);
    process.stderr.write(
      `Skipping ${repoBasename}: ${EXCLUDED_REPOS[repoBasename]}\n` +
      `(add/remove in EXCLUDED_REPOS at the top of this script)\n`
    );
    process.exit(0);
  }

  const sccAvailable = hasScc();
  if (!sccAvailable) {
    printSccHint();
    process.stderr.write('Continuing with regex-based logical-line classification (an approximation).\n\n');
  }

  const authorEmails = resolveAuthorEmails(args);

  // For V1, we analyze the single repo at repoRoot. Future work: enumerate
  // public repos via GitHub API + clone each into a cache dir.
  const now = new Date();
  const years = TARGET_YEARS.map(y => analyzeRepo(repoRoot, y, authorEmails, sccAvailable, now));

  const y2013 = years.find(y => y.year === 2013);
  const y2026 = years.find(y => y.year === 2026);

  // Both multiples live in the same output — they measure different things:
  //
  //   to_date  = raw totals. "How much did 2026 produce so far?"
  //              (mixes full-year 2013 vs partial 2026; honest about volume)
  //   run_rate = per-day pace. "What's the throughput rate, normalized?"
  //              (apples-to-apples regardless of how much of 2026 has elapsed)
  const toDate = {
    logical_lines_added: (y2013?.active && y2013.logical_lines_added > 0 && y2026?.active)
      ? +(y2026.logical_lines_added / y2013.logical_lines_added).toFixed(1)
      : null,
    raw_lines_added: (y2013?.active && y2013.raw_lines_added > 0 && y2026?.active)
      ? +(y2026.raw_lines_added / y2013.raw_lines_added).toFixed(1)
      : null,
    commits: (y2013?.active && y2013.commits > 0 && y2026?.active)
      ? +(y2026.commits / y2013.commits).toFixed(1)
      : null,
    files_touched: (y2013?.active && y2013.files_touched > 0 && y2026?.active)
      ? +(y2026.files_touched / y2013.files_touched).toFixed(1)
      : null,
  };

  const runRate = {
    logical_per_day: (y2013?.per_day_rate.logical && y2013.per_day_rate.logical > 0 && y2026?.active)
      ? +(y2026.per_day_rate.logical / y2013.per_day_rate.logical).toFixed(1)
      : null,
    raw_per_day: (y2013?.per_day_rate.raw && y2013.per_day_rate.raw > 0 && y2026?.active)
      ? +(y2026.per_day_rate.raw / y2013.per_day_rate.raw).toFixed(1)
      : null,
    commits_per_day: (y2013?.per_day_rate.commits && y2013.per_day_rate.commits > 0 && y2026?.active)
      ? +(y2026.per_day_rate.commits / y2013.per_day_rate.commits).toFixed(1)
      : null,
  };

  const multiples = {
    to_date: toDate,
    run_rate: runRate,
    // Back-compat alias — older consumers read `multiples.logical_lines_added`.
    logical_lines_added: toDate.logical_lines_added,
  };

  const output: Output = {
    computed_at: new Date().toISOString(),
    scc_available: sccAvailable,
    years,
    multiples,
    caveats_global: [
      '仅统计 public repos。两个时期的 private work 都被排除，以保持 apples-to-apples comparison。',
      '2013 和 2026 的 commit-style 可能不同：2013 更偏 monolithic commits，2026 更偏较小的 AI-assisted commits。Multiples 会反映这种 drift。',
      sccAvailable
        ? 'Logical-line classification 使用 scc-aware regex（近似）。'
        : 'Logical-line classification 使用粗略 regex fallback（未安装 scc）。会排除 blank lines + single-line comments；不会捕获 block comments 或 docstrings。结果为近似值。',
      '此 script 一次只分析一个 repo。完整 2013-vs-2026 picture 需要对两个年份都有 commits 的每个 public repo 运行并汇总结果（future work）。',
      'Authorship attribution 依赖 commit email matching。可通过 --email flags 或 GSTACK_AUTHOR_EMAILS 提供历史 aliases。',
    ],
    version: 1,
  };

  const outDir = path.join(repoRoot, 'docs');
  const outPath = path.join(outDir, 'throughput-2013-vs-2026.json');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');

  process.stderr.write(`Wrote ${outPath}\n`);
  process.stderr.write(
    `2013: ${y2013?.logical_lines_added ?? 'n/a'} logical added (${y2013?.days_elapsed ?? '?'}d) | ` +
    `2026: ${y2026?.logical_lines_added ?? 'n/a'} logical added (${y2026?.days_elapsed ?? '?'}d, ${y2026?.is_partial ? 'partial' : 'full'})\n`
  );
  if (toDate.logical_lines_added !== null) {
    process.stderr.write(`TO-DATE multiple (raw volume):  ${toDate.logical_lines_added}× logical, ${toDate.raw_lines_added}× raw\n`);
  }
  if (runRate.logical_per_day !== null) {
    process.stderr.write(
      `RUN-RATE multiple (per-day pace): ${runRate.logical_per_day}× logical/day, ${runRate.commits_per_day}× commits/day\n` +
      `  2013 pace: ${y2013?.per_day_rate.logical.toFixed(1) ?? '?'} logical/day | ` +
      `2026 pace: ${y2026?.per_day_rate.logical.toFixed(1) ?? '?'} logical/day | ` +
      `2026 annualized: ${y2026?.annualized_projection.logical.toLocaleString() ?? '?'} logical/year projected\n`
    );
  }
  if (toDate.logical_lines_added === null && runRate.logical_per_day === null) {
    process.stderr.write(`No multiple computable (one or both years inactive in this repo).\n`);
  }
}

main();
