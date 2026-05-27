/**
 * Declarative consistency runner — mirrors polyfence Phase 1 handlers minus SaaS DB wiring.
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

const REPO_ROOT = path.resolve(__dirname, '..');

type Check =
  | SubprocessCheck
  | DiffCheck
  | HashCheck
  | RegexPresenceCheck
  | TallyCheck
  | RemoteQueryCheck;

interface CheckBase {
  id: string;
  description: string;
  type: string;
  fix: string;
}

interface SubprocessCheck extends CheckBase {
  type: 'subprocess';
  runs: string;
}

interface DiffCheck extends CheckBase {
  type: 'diff';
  a: string;
  b: string;
}

interface HashCheck extends CheckBase {
  type: 'hash';
  source: string;
  hash_file: string;
}

interface RegexPresenceCheck extends CheckBase {
  type: 'regex-presence';
  files: string | string[];
  pattern: string;
  exempt?: string[];
}

interface TallyCheck extends CheckBase {
  type: 'tally';
  pattern: string;
  files: string | string[];
  expected: number;
}

interface RemoteQueryCheck extends CheckBase {
  type: 'remote-query';
}

function parseArgs(): {
  localOnly: boolean;
  remoteOnly: boolean;
  checkId?: string;
} {
  const args = process.argv.slice(2);
  let localOnly = false;
  let remoteOnly = false;
  let checkId: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--local-only') {
      localOnly = true;
    } else if (a === '--remote-only') {
      remoteOnly = true;
    } else if (a === '--check') {
      checkId = args[++i];
    }
  }
  return { localOnly, remoteOnly, checkId };
}

function pass(id: string): boolean {
  console.log(`PASS ${id}`);
  return true;
}

function fail(id: string, error: string, fix: string): boolean {
  console.error(`FAIL ${id}: ${error}`);
  console.error(`     Fix: ${fix}`);
  return false;
}

function skip(id: string, reason: string): boolean {
  console.log(`SKIP ${id} (${reason})`);
  return true;
}

function expandGlob(pattern: string): string[] {
  const dir = path.dirname(pattern);
  const base = path.basename(pattern);
  const absDir = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(absDir)) {
    return [];
  }
  const re = new RegExp(
    '^' +
      base
        .split('*')
        .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*') +
      '$',
  );
  return fs
    .readdirSync(absDir)
    .filter((f) => re.test(f))
    .map((f) => path.join(dir, f))
    .sort();
}

function resolveFilePatterns(files: string | string[]): string[] {
  const list = Array.isArray(files) ? files : [files];
  const out: string[] = [];
  for (const entry of list) {
    if (entry.includes('*')) {
      out.push(...expandGlob(entry));
    } else {
      const abs = path.join(REPO_ROOT, entry);
      if (fs.existsSync(abs)) {
        out.push(entry);
      }
    }
  }
  return [...new Set(out)];
}

function runSubprocess(check: SubprocessCheck): boolean {
  try {
    execSync(check.runs, { cwd: REPO_ROOT, stdio: 'inherit' });
    return pass(check.id);
  } catch {
    return fail(check.id, 'subprocess exited non-zero', check.fix);
  }
}

function runDiff(check: DiffCheck): boolean {
  const aPath = path.join(REPO_ROOT, check.a);
  const bPath = path.join(REPO_ROOT, check.b);
  if (!fs.existsSync(aPath)) {
    return fail(check.id, `missing ${check.a}`, check.fix);
  }
  if (!fs.existsSync(bPath)) {
    return fail(check.id, `missing ${check.b}`, check.fix);
  }
  try {
    execSync(`diff -q ${JSON.stringify(aPath)} ${JSON.stringify(bPath)}`, {
      cwd: REPO_ROOT,
      stdio: 'pipe',
    });
    return pass(check.id);
  } catch {
    return fail(check.id, `${check.a} and ${check.b} differ`, check.fix);
  }
}

function runHash(check: HashCheck): boolean {
  const crypto = require('crypto') as typeof import('crypto');
  const sourcePath = path.join(REPO_ROOT, check.source);
  const hashPath = path.join(REPO_ROOT, check.hash_file);
  if (!fs.existsSync(sourcePath)) {
    return fail(check.id, `missing ${check.source}`, check.fix);
  }
  if (!fs.existsSync(hashPath)) {
    return fail(check.id, `missing ${check.hash_file}`, check.fix);
  }
  const content = fs.readFileSync(sourcePath);
  const actual = crypto.createHash('sha256').update(content).digest('hex');
  const expected = fs.readFileSync(hashPath, 'utf8').trim().split(/\s+/)[0];
  if (actual !== expected) {
    return fail(check.id, 'sha256 mismatch', check.fix);
  }
  return pass(check.id);
}

function runRegexPresence(check: RegexPresenceCheck): boolean {
  const relPaths = resolveFilePatterns(check.files);
  if (relPaths.length === 0) {
    return fail(check.id, 'no files matched', check.fix);
  }
  const exempt = new Set(check.exempt ?? []);
  const pattern = new RegExp(check.pattern);
  const missing: string[] = [];
  for (const rel of relPaths) {
    if (exempt.has(rel)) {
      continue;
    }
    const body = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    if (!pattern.test(body)) {
      missing.push(rel);
    }
  }
  if (missing.length > 0) {
    return fail(
      check.id,
      `pattern missing in ${missing.join(', ')}`,
      check.fix,
    );
  }
  return pass(check.id);
}

function runTally(check: TallyCheck): boolean {
  const pattern = new RegExp(check.pattern, 'g');
  let count = 0;
  for (const rel of resolveFilePatterns(check.files)) {
    const body = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    const m = body.match(pattern);
    count += m ? m.length : 0;
  }
  if (count !== check.expected) {
    return fail(
      check.id,
      `expected ${check.expected} occurrences, found ${count}`,
      check.fix,
    );
  }
  return pass(check.id);
}

function runRemoteQuery(check: RemoteQueryCheck, localOnly: boolean): boolean {
  if (localOnly) {
    return skip(check.id, 'remote check, --local-only');
  }
  return fail(check.id, 'remote-query not wired in this repo', check.fix);
}

function runOne(
  check: Check,
  opts: { localOnly: boolean; remoteOnly: boolean },
): boolean {
  const isRemote = check.type === 'remote-query';
  if (opts.remoteOnly && !isRemote) {
    return skip(check.id, 'local check, --remote-only');
  }
  if (!opts.remoteOnly && opts.localOnly && isRemote) {
    return skip(check.id, 'remote check, --local-only');
  }

  switch (check.type) {
    case 'subprocess':
      return runSubprocess(check);
    case 'diff':
      return runDiff(check);
    case 'hash':
      return runHash(check);
    case 'regex-presence':
      return runRegexPresence(check);
    case 'tally':
      return runTally(check);
    case 'remote-query':
      return runRemoteQuery(check as RemoteQueryCheck, opts.localOnly);
    default:
      return fail(
        (check as CheckBase).id,
        `unknown type ${(check as CheckBase).type}`,
        'Fix consistency-checks.yaml',
      );
  }
}

function main(): void {
  const opts = parseArgs();
  const cfgPath = path.join(REPO_ROOT, 'consistency-checks.yaml');
  if (!fs.existsSync(cfgPath)) {
    console.error('FAIL: consistency-checks.yaml missing');
    process.exit(2);
  }
  const raw = yaml.load(fs.readFileSync(cfgPath, 'utf8')) as unknown;
  let checks: Check[];
  if (Array.isArray(raw)) {
    checks = raw as Check[];
  } else {
    checks = (raw as { checks: Check[] }).checks;
  }
  if (!Array.isArray(checks)) {
    console.error('FAIL: YAML must define checks array');
    process.exit(2);
  }

  let selected = checks;
  if (opts.checkId) {
    selected = checks.filter((c) => (c as CheckBase).id === opts.checkId);
    if (selected.length === 0) {
      console.error(`FAIL: unknown check id ${opts.checkId}`);
      process.exit(2);
    }
  }

  let failed = 0;
  for (const c of selected) {
    const ok = runOne(c, opts);
    if (!ok) {
      failed++;
    }
  }
  process.exit(failed > 0 ? 1 : 0);
}

main();
