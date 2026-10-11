#!/usr/bin/env node
// Downloads every file listed in a JSON file into public/assets (or --out).
//
// Usage: node tools/fetch-list.mjs <list.json> [--out=public/assets] [--concurrency=8] [--force] [--dry-run]
//
// List format (either one):
//
//   { "files": [
//       { "rel": "char/avatar/char_388_mint_epoque#30.png",
//         "url": "https://raw.githubusercontent.com/.../avatar/char_388_mint_epoque#30.png" },
//       { "rel": "spine/op/char_388_mint/skins/epoque/front/char_388_mint_epoque.skel",
//         "urls": ["https://.../Front/x.skel", "https://cdn.jsdelivr.net/gh/.../Front/x.skel"],
//         "bytes": 638539 }
//   ] }
//
//   or a plain map:  { "<rel path>": "<url>", ... }
//
// A whole GitHub folder (recursive) is an entry with `repo` + `dir` instead of `url`:
//
//   { "repo": "fexli/ArknightsResource", "ref": "main",
//     "dir": "spine/char_388_mint/char_388_mint_epoque#30",
//     "rel": "spine/op/char_388_mint/skins/epoque" }
//
//   `ref` defaults to main; `rel` is the destination folder (default: same as `dir`). The folder is listed with the
//   GitHub API (60 requests/hour without a token: set GITHUB_TOKEN for more), one request per sub-folder.
//
// - `urls` are tried in order (fallbacks); `bytes` (optional) is validated.
// - A raw '#' in a URL is percent-encoded (it would otherwise be cut off as a fragment).
// - An existing file is skipped (with `bytes`: only if the size matches); --force re-downloads.
// - Files are written to <name>.tmp first, then renamed, so an interrupted run leaves no half files.

import { readFile, writeFile, mkdir, rename, stat, unlink } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const o = { list: null, out: join(ROOT, 'public', 'assets'), concurrency: 8, force: false, dryRun: false };
  for (const a of argv) {
    const [k, v] = a.split('=');
    if (k === '--out') o.out = resolve(v);
    else if (k === '--concurrency') o.concurrency = Math.max(1, Math.min(32, parseInt(v, 10) || 8));
    else if (k === '--force') o.force = true;
    else if (k === '--dry-run') o.dryRun = true;
    else if (k.startsWith('--')) throw new Error(`unknown option ${a}`);
    else o.list = a;
  }
  if (!o.list) throw new Error('usage: node tools/fetch-list.mjs <list.json> [--out=DIR] [--concurrency=N] [--force] [--dry-run]');
  return o;
}

const ghPath = (p) => p.split('/').map(encodeURIComponent).join('/');

/** One folder level via the GitHub contents API (works on huge repos; 60 req/h without GITHUB_TOKEN). */
async function ghList(repo, ref, path) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'fetch-list' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const url = `https://api.github.com/repos/${repo}/contents/${ghPath(path)}?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
  if (res.status === 403 || res.status === 429) throw new Error(`GitHub API rate limit hit (set GITHUB_TOKEN to raise it): ${repo}:${path}`);
  if (res.status === 404) throw new Error(`folder not found: ${repo}@${ref}:${path}`);
  if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}: ${repo}:${path}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error(`not a folder: ${repo}@${ref}:${path}`);
  return data;
}

/** Recursively list a folder into file entries (raw URL first, jsDelivr as fallback). */
async function walkDir(repo, ref, path, rel, out) {
  for (const e of await ghList(repo, ref, path)) {
    if (e.type === 'dir') await walkDir(repo, ref, e.path, `${rel}/${e.name}`, out);
    else if (e.type === 'file') {
      const p = ghPath(e.path);
      out.push({
        rel: `${rel}/${e.name}`,
        urls: [`https://raw.githubusercontent.com/${repo}/${ref}/${p}`, `https://cdn.jsdelivr.net/gh/${repo}@${ref}/${p}`],
        bytes: e.size,
      });
    }
  }
}

/** Replace every { repo, ref?, dir, rel? } entry by the files inside that folder. */
async function expandDirs(json) {
  const raw = Array.isArray(json?.files) ? json.files : Object.entries(json || {}).map(([rel, url]) => ({ rel, url }));
  const files = [];
  for (const f of raw) {
    if (typeof f.dir !== 'string') { files.push(f); continue; }
    if (typeof f.repo !== 'string') throw new Error(`folder entry without "repo": ${JSON.stringify(f)}`);
    const dir = f.dir.replace(/^\/+|\/+$/g, '');
    const before = files.length;
    await walkDir(f.repo, f.ref || 'main', dir, (f.rel || dir).replace(/\/+$/, ''), files);
    console.log(`[fetch-list] ${f.repo}:${dir} -> ${files.length - before} files`);
  }
  return { files };
}

/** Normalise both accepted list formats to [{ rel, urls[], bytes? }]. */
function normalise(json) {
  const raw = Array.isArray(json?.files)
    ? json.files
    : Object.entries(json || {}).map(([rel, url]) => ({ rel, url }));
  const out = [];
  for (const f of raw) {
    const urls = [].concat(f.urls ?? f.url ?? []).filter((u) => typeof u === 'string' && u).map(encodeUrl);
    if (typeof f.rel !== 'string' || !f.rel || !urls.length) { console.warn(`skipped invalid entry: ${JSON.stringify(f)}`); continue; }
    out.push({ rel: f.rel, urls, bytes: Number.isInteger(f.bytes) && f.bytes > 0 ? f.bytes : undefined });
  }
  return out;
}

const encodeUrl = (u) => u.replace(/#/g, '%23').replace(/ /g, '%20');

/** Absolute destination inside `root`; throws on a path that escapes it. */
function destOf(root, rel) {
  const p = resolve(root, rel);
  if (p !== root && !p.startsWith(root + sep)) throw new Error(`path escapes the output folder: ${rel}`);
  return p;
}

async function sizeOf(p) {
  try { return (await stat(p)).size; } catch { return null; }
}

async function fetchTo(url, dest, bytes) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (res.status === 404) return { miss: true };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (bytes && buf.length !== bytes) throw new Error(`size ${buf.length} != expected ${bytes}`);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest + '.tmp', buf);
      await rename(dest + '.tmp', dest);
      return { ok: true, size: buf.length };
    } catch (e) {
      lastErr = e;
      await unlink(dest + '.tmp').catch(() => {});
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  return { error: lastErr?.message || String(lastErr) };
}

async function download(item, opts) {
  const dest = destOf(opts.out, item.rel);
  if (!opts.force) {
    const have = await sizeOf(dest);
    if (have && (!item.bytes || have === item.bytes)) return { status: 'skip' };
  }
  const errors = [];
  for (const url of item.urls) {
    const r = await fetchTo(url, dest, item.bytes);
    if (r.ok) return { status: 'ok', size: r.size };
    errors.push(`${url}: ${r.miss ? '404' : r.error}`);
  }
  return { status: 'fail', errors };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const items = normalise(await expandDirs(JSON.parse(await readFile(resolve(opts.list), 'utf8'))));
  console.log(`[fetch-list] ${items.length} files -> ${opts.out}`);
  if (opts.dryRun) { for (const i of items) console.log(`  ${i.rel}  <-  ${i.urls[0]}`); return 0; }

  const totals = { ok: 0, skip: 0, fail: 0, bytes: 0 };
  const failures = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      let r;
      try { r = await download(item, opts); } catch (e) { r = { status: 'fail', errors: [e.message] }; }
      totals[r.status]++;
      if (r.size) totals.bytes += r.size;
      if (r.status === 'fail') { failures.push(item.rel); console.log(`  FAIL ${item.rel}\n    ${r.errors.join('\n    ')}`); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency, items.length) }, worker));

  console.log(`[fetch-list] ok ${totals.ok}, skipped ${totals.skip}, failed ${totals.fail}, ${(totals.bytes / 1048576).toFixed(1)} MB downloaded`);
  return totals.fail ? 1 : 0;
}

main().then((c) => { process.exitCode = c; }, (e) => { console.error(`[fetch-list] ${e.message}`); process.exitCode = 1; });
