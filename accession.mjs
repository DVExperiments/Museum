#!/usr/bin/env node
/*
 * The accession tool. Run nightly by .github/workflows/accession.yml, or by hand:  node tools/accession.mjs
 *
 * 1. Loads every site's published code from dvexperiments.github.io (or local folders, see below).
 * 2. Catalogues every complete month not yet in archive/, writing archive/YYYY-MM.json and archive/index.json.
 * 3. Re-checks every archived month against today's code and writes archive/conservation.json.
 *    It never overwrites an archived month: the archive is the record, even when the code disagrees.
 *
 * Options:
 *   --local <dir>   load upstream from a folder laid out like the Pages site (<dir>/Glacial/js/sim.js, <dir>/Weather/universe.js …)
 *   --month YYYY-MM catalogue just this month (refuses if already archived)
 *   --strict        exit with code 1 if any archived month has been altered
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const archiveDir = join(repo, 'archive');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1] || true; };
const local = opt('--local');
const BASE = 'https://dvexperiments.github.io/';

const UPSTREAM = [
  ['Glacial/js/pixels.js', true], ['Glacial/js/sim.js', true], ['Glacial/js/league.js', true],
  ['Weather/universe.js', true], ['Senate/universe.js', false], ['City/universe.js', false], ['Bookmaker/universe.js', false]
];

async function source(path) {
  if (local) return readFileSync(join(local, path), 'utf8');
  const res = await fetch(BASE + path, { cache: 'no-store' });
  if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
  return res.text();
}

globalThis.window = globalThis;
globalThis.PixelUniverseOptions = { senateSkipGlacial: true };
for (const [path, required] of UPSTREAM) {
  try { vm.runInThisContext(await source(path), { filename: path }); console.log('loaded   ' + path); }
  catch (e) {
    if (required) { console.error('Could not load ' + path + ' (' + e.message + '). Nothing was catalogued.'); process.exit(2); }
    console.warn('missing  ' + path + ' (' + e.message + '); its section will be marked missing');
  }
}
// the Bookmaker must offer marketsBetween (version 0.2.0 or later) to be archived
if (globalThis.PixelUniverse.bookmaker && !globalThis.PixelUniverse.bookmaker.marketsBetween) {
  console.warn('missing  Bookmaker marketsBetween: publish Bookmaker 0.2.0 or later. Its section will be marked missing.');
  delete globalThis.PixelUniverse.bookmaker;
}
vm.runInThisContext(readFileSync(join(repo, 'universe.js'), 'utf8'), { filename: 'universe.js' });
const M = globalThis.PixelUniverse.museum;
if (!M.ready()) { console.error('The Museum is not ready: Glacial or the Weather Bureau failed to start.'); process.exit(2); }

if (!existsSync(archiveDir)) mkdirSync(archiveDir);
const have = new Set(readdirSync(archiveDir).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 7)));
const now = Date.now();
let todo = M.completeMonths(now).filter((m) => !have.has(m));
const only = opt('--month');
if (only) {
  if (have.has(only)) { console.error(only + ' is already in the archive. Archived months are never overwritten.'); process.exit(1); }
  todo = todo.filter((m) => m === only);
}

for (const key of todo) {
  const [y, m] = key.split('-').map(Number);
  const t0 = Date.now();
  const snap = M.snapshotMonth(y, m - 1);
  snap.accessioned = new Date().toISOString().slice(0, 10);
  writeFileSync(join(archiveDir, key + '.json'), JSON.stringify(snap) + '\n');
  have.add(key);
  console.log('archived ' + key + ' in ' + (Date.now() - t0) + ' ms ' + JSON.stringify(snap.checksums));
}

// conservation: recompute every archived month and compare
const report = {};
let altered = 0;
for (const key of [...have].sort()) {
  const archived = JSON.parse(readFileSync(join(archiveDir, key + '.json'), 'utf8'));
  const c = M.conserve(archived);
  report[key] = c.report;
  const bad = Object.keys(c.report).filter((k) => c.report[k] === 'altered');
  if (bad.length) { altered++; console.warn('ALTERED  ' + key + ': ' + bad.join(', ')); }
}
writeFileSync(join(archiveDir, 'index.json'), JSON.stringify({ format: M.snapshotFormat, months: [...have].sort() }, null, 1) + '\n');
writeFileSync(join(archiveDir, 'conservation.json'), JSON.stringify({ report }, null, 1) + '\n');
console.log(todo.length + ' month(s) archived; ' + have.size + ' in the collection; ' + (altered ? altered + ' altered' : 'all intact'));
if (altered && args.includes('--strict')) process.exit(1);
