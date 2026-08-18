// Release notes 自动从 git log 收集。
// 跑法：node scripts/release-notes.mjs <prev-tag> <new-tag>
// 例：  node scripts/release-notes.mjs v0.1.0 v0.2.0
//
// 按 conventional commits 分类：feat / fix / chore / docs / refactor / perf / test。

import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const [prev, next] = process.argv.slice(2);
if (!prev || !next) {
  console.error('usage: node scripts/release-notes.mjs <prev-tag> <new-tag>');
  process.exit(1);
}

let log;
try {
  log = execFileSync('git', [
    'log', '--pretty=format:%s', `${prev}..${next}`,
  ], { cwd: ROOT, encoding: 'utf8' });
} catch (e) {
  console.error(`error: cannot read git log ${prev}..${next}`);
  console.error('  is this a real tag range?');
  process.exit(1);
}

const groups = {
  feat: [], fix: [], refactor: [], perf: [],
  docs: [], test: [], chore: [], other: [],
};

for (const line of log.split('\n')) {
  if (!line.trim()) continue;
  const m = line.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);
  if (!m) { groups.other.push(line); continue; }
  const [, type, scope, subject] = m;
  if (groups[type]) groups[type].push({ scope, subject });
  else groups.other.push(line);
}

const TITLES = {
  feat: 'New features',
  fix: 'Bug fixes',
  refactor: 'Refactors',
  perf: 'Performance',
  docs: 'Documentation',
  test: 'Tests',
  chore: 'Chores',
  other: 'Other',
};

const out = [`# Release ${next}`, ''];
for (const [k, title] of Object.entries(TITLES)) {
  if (groups[k].length === 0) continue;
  out.push(`## ${title}`, '');
  for (const c of groups[k]) {
    const scope = c.scope ? `**${c.scope}**: ` : '';
    out.push(`- ${scope}${c.subject}`);
  }
  out.push('');
}
console.log(out.join('\n'));
