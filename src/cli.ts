import os from 'node:os';
import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import { scanDir, getMtime } from './scan.js';
import { parseFile } from './parse.js';
import { type SessionSummary } from './types.js';
import stringWidth from 'string-width';

type CliOptions = {
  dir?: string;
  json?: boolean;
  limit?: number;
  noColor?: boolean;
  full?: boolean;
  sort?: string; // mtime|timestamp
  order?: string; // asc|desc
  since?: string; // ISO date/time
  before?: string; // ISO date/time
  cwdFilter?: string; // substring match on cwd
};

const resolveDir = (d?: string): string => {
  if (!d) return path.join(os.homedir(), '.codex', 'sessions');
  if (d.startsWith('~')) return path.join(os.homedir(), d.slice(1));
  return path.resolve(d);
};

const humanTime = (ms: number): string => {
  try {
    const d = new Date(ms);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  } catch {
    return '-';
  }
};

const padEndWidth = (s: string, width: number): string => {
  const w = stringWidth(s);
  if (w >= width) return s;
  return s + ' '.repeat(width - w);
};

const truncateToWidth = (text: string, width: number): string => {
  if (stringWidth(text) <= width) return text;
  const limit = Math.max(1, width - stringWidth('…'));
  let out = '';
  let w = 0;
  for (const ch of text) {
    const cw = stringWidth(ch);
    if (w + cw > limit) break;
    out += ch;
    w += cw;
  }
  return out + '…';
};

// Helpers for width-aware truncation patterns
const takeStartByWidth = (text: string, width: number): string => {
  if (width <= 0) return '';
  let out = '';
  let w = 0;
  for (const ch of Array.from(text)) {
    const cw = stringWidth(ch);
    if (w + cw > width) break;
    out += ch;
    w += cw;
  }
  return out;
};

const takeEndByWidth = (text: string, width: number): string => {
  if (width <= 0) return '';
  let out = '';
  let w = 0;
  for (const ch of Array.from(text).reverse()) {
    const cw = stringWidth(ch);
    if (w + cw > width) break;
    out = ch + out;
    w += cw;
  }
  return out;
};

const truncateMiddleToWidth = (text: string, width: number): string => {
  if (stringWidth(text) <= width) return text;
  const ell = '…';
  const contentW = Math.max(1, width - stringWidth(ell));
  const leftW = Math.floor(contentW / 2);
  const rightW = contentW - leftW;
  return takeStartByWidth(text, leftW) + ell + takeEndByWidth(text, rightW);
};

// Compute how much a column can shrink without going below its minimum,
// bounded by the current overflow amount (excess).
const computeReduction = (current: number, min: number, excess: number): number => {
  const canReduce = Math.max(0, current - min);
  return Math.min(excess, canReduce);
};

const parseAll = async (files: string[], concurrency = 16): Promise<SessionSummary[]> => {
  const res: SessionSummary[] = [];
  let i = 0;
  const worker = async () => {
    while (i < files.length) {
      const idx = i++;
      const f = files[idx];
      try {
        const r = await parseFile(f, { stopEarly: true });
        res.push(r);
      } catch {
        // ignore
      }
    }
  };
  const workers = Array.from({ length: Math.min(concurrency, files.length || 1) }, worker);
  await Promise.all(workers);
  return res;
};

const main = async () => {
  const program = new Command();
  program
    .name('codex-history-list')
    .description('List Codex session histories with cwd and first user ask')
    .option('-d, --dir <path>', 'session directory (default: ~/.codex/sessions)')
    .option('-n, --limit <n>', 'limit number of rows', (v) => parseInt(v, 10))
    .option('--json', 'output JSON')
    .option('--full', 'do not truncate ask text')
    .option('--no-color', 'disable colored output')
    .option('--sort <key>', 'sort by: mtime|timestamp (default: mtime)')
    .option('--order <dir>', 'sort order: asc|desc (default: desc)')
    .option('--since <time>', 'filter items on/after time (ISO like 2025-08-30)')
    .option('--before <time>', 'filter items before time (ISO)')
    .option('--cwd-filter <substr>', 'filter by cwd substring match');

  program.parse(process.argv);
  const opts = program.opts<CliOptions>();
  if (opts.noColor) {
    // @ts-ignore - chalk has a level property
    chalk.level = 0;
  }

  const dir = resolveDir(opts.dir);
  const files = await scanDir(dir);
  // Pre-sort by mtime desc before parsing to likely reduce work when limiting (only if no filters)
  const withTimes = await Promise.all(files.map(async (f) => ({ f, t: await getMtime(f) })));
  withTimes.sort((a, b) => b.t - a.t);
  const sortedFiles = withTimes.map((x) => x.f);

  const limit = typeof opts.limit === 'number' && !Number.isNaN(opts.limit) ? Math.max(0, opts.limit) : undefined;

  const hasFilters = Boolean(opts.since || opts.before || opts.cwdFilter || (opts.sort && opts.sort !== 'mtime'));
  const candidates = hasFilters
    ? sortedFiles // need to parse all to properly filter/sort
    : (typeof limit === 'number' ? sortedFiles.slice(0, Math.max(limit, 50)) : sortedFiles);

  const summaries = await parseAll(candidates);

  const parseDateInput = (s?: string): number | undefined => {
    if (!s) return undefined;
    const n = Date.parse(s);
    if (!Number.isNaN(n)) return n;
    return undefined;
  };

  const sinceTs = parseDateInput(opts.since);
  const beforeTs = parseDateInput(opts.before);
  const itemTimeForFilter = (it: SessionSummary): number => {
    // Prefer timestamp when present; fallback to mtime
    const t = it.timestamp ? Date.parse(it.timestamp) : NaN;
    return Number.isFinite(t) ? t : it.mtime;
  };

  let filtered = summaries.filter((it) => {
    if (opts.cwdFilter) {
      const hay = it.cwd ?? '';
      if (!hay.includes(opts.cwdFilter)) return false;
    }
    if (sinceTs != null) {
      if (itemTimeForFilter(it) < sinceTs) return false;
    }
    if (beforeTs != null) {
      if (itemTimeForFilter(it) >= beforeTs) return false;
    }
    return true;
  });

  // Sort
  const sortKey = (opts.sort === 'timestamp') ? 'timestamp' : 'mtime';
  const order = (opts.order === 'asc' || opts.order === 'desc') ? opts.order : 'desc';
  filtered.sort((a, b) => {
    let ta: number;
    let tb: number;
    if (sortKey === 'timestamp') {
      const pa = a.timestamp ? Date.parse(a.timestamp) : NaN;
      const pb = b.timestamp ? Date.parse(b.timestamp) : NaN;
      ta = Number.isFinite(pa) ? pa : a.mtime;
      tb = Number.isFinite(pb) ? pb : b.mtime;
    } else {
      ta = a.mtime;
      tb = b.mtime;
    }
    return order === 'asc' ? ta - tb : tb - ta;
  });

  const output = typeof limit === 'number' ? filtered.slice(0, limit) : filtered;

  if (opts.json) {
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
    return;
  }

  // Render table
  const termWidth = process.stdout.columns || 120;
  const timeW = 16; // 'YYYY-MM-DD HH:MM' - fixed minimum
  const sep = '  ';
  const sepLen = sep.length;

  // Calculate available width for variable columns (excluding time and separators)
  const totalSepWidth = sepLen * 3; // 3 separators between 4 columns

  // Set minimum widths for readability (supports narrower terminals)
  const cwdMinW = 10;
  const askMinW = 6;
  const pathMinW = 4;

  // Available width for variable columns; avoid synthetic large minima
  const minTotalVar = cwdMinW + askMinW + pathMinW;
  const availableWidth = Math.max(minTotalVar, termWidth - timeW - totalSepWidth);

  // Calculate path width needed (prefer full paths; safe on empty output)
  const maxPathLength = output.length ? Math.max(...output.map((it) => stringWidth(it.path))) : pathMinW;
  let requiredPathW = Math.max(pathMinW, maxPathLength);

  // Allocate remaining width to cwd and ask, with path getting priority
  let remainingWidth = Math.max(0, availableWidth - requiredPathW);
  let cwdW = Math.max(cwdMinW, Math.min(25, Math.floor(remainingWidth * 0.4))); // cwd gets ~40% of remaining
  let askW = Math.max(askMinW, remainingWidth - cwdW); // ask gets the rest

  // Ensure table fits within terminal width by reducing columns if needed (ask -> cwd -> path)
  let finalTableWidth = timeW + sepLen + cwdW + sepLen + askW + sepLen + requiredPathW;
  if (finalTableWidth > termWidth) {
    let excess = finalTableWidth - termWidth;

    // 1) Reduce ask column
    const askReduce = computeReduction(askW, askMinW, excess);
    askW -= askReduce;
    excess -= askReduce;

    // 2) Reduce cwd column
    const cwdReduce = computeReduction(cwdW, cwdMinW, excess);
    cwdW -= cwdReduce;
    excess -= cwdReduce;

    // 3) Reduce path column (last resort)
    if (excess > 0) {
      const pathReduce = computeReduction(requiredPathW, pathMinW, excess);
      requiredPathW -= pathReduce;
      excess -= pathReduce;
    }
  }

  const header = [
    padEndWidth(chalk.bold('time'), timeW),
    padEndWidth(chalk.bold('cwd'), cwdW),
    padEndWidth(chalk.bold('ask'), askW),
    padEndWidth(chalk.bold('path'), requiredPathW)
  ].join(sep);
  process.stdout.write(header + '\n');
  process.stdout.write('-'.repeat(Math.min(termWidth, timeW + sepLen + cwdW + sepLen + askW + sepLen + requiredPathW)) + '\n');

  for (const it of output) {
    const timeStr = humanTime(it.mtime);
    const cwdStr = (it.cwd ?? '-');
    const askStr = (it.ask ?? '-');
    const pathStr = it.path; // show full path for copy-paste when possible
    const row = [
      padEndWidth(timeStr, timeW),
      padEndWidth(truncateMiddleToWidth(cwdStr, cwdW), cwdW),
      padEndWidth(truncateToWidth(askStr, askW), askW),
      padEndWidth(truncateToWidth(pathStr, requiredPathW), requiredPathW) // Truncate path only if absolutely necessary
    ].join(sep);
    process.stdout.write(row + '\n');
  }
};

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
