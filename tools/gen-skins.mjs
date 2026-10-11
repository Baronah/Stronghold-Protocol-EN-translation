#!/usr/bin/env node
// Reads a text file with one skin id per line and writes the JSON list for fetch-list.mjs.
//
// Usage: node tools/gen-skins.mjs <ids.txt> [--out=skins.json]
//
// ids.txt: one id per line, e.g.
//   char_388_mint_epoque_30
//   char_358_lisa_lxh_1
// Blank lines and lines starting with '#' or '//' are ignored.
//
// An id is <base char id>_<skin name>_<number>; per id the output has 8 entries:
// avatar, portrait, and the Front and Back Spine (.skel / .atlas / .png).

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const YY = 'https://raw.githubusercontent.com/yuanyan3060/ArknightsGameResource/main/';
const FX = 'https://raw.githubusercontent.com/fexli/ArknightsResource/main/';

function parseArgs(argv) {
  const o = { input: null, out: 'skins.json' };
  for (const a of argv) {
    const [k, v] = a.split('=');
    if (k === '--out') o.out = v;
    else if (k.startsWith('--')) throw new Error(`unknown option ${a}`);
    else o.input = a;
  }
  if (!o.input) throw new Error('usage: node tools/gen-skins.mjs <ids.txt> [--out=skins.json]');
  return o;
}

/** 'char_388_mint_epoque_30' -> { base: 'char_388_mint', name: 'epoque', n: '30' } (null if it does not match). */
function parseId(id) {
  const m = /^(char_\d+_[a-z0-9]+)_(.+)_(\d+)$/i.exec(id);
  return m ? { base: m[1], name: m[2], n: m[3] } : null;
}

function entriesOf(id) {
  const p = parseId(id);
  if (!p) return null;
  const hashed = `${p.base}_${p.name}#${p.n}`; // avatar / portrait files use '#', e.g. char_388_mint_epoque#30.png
  const files = [
    { rel: `char/avatar/${id}.png`, url: `${YY}avatar/${hashed}.png` },
    { rel: `char/portrait/${id}.png`, url: `${YY}portrait/${hashed}.png` },
  ];
  for (const side of ['Front', 'Back']) {
    for (const ext of ['skel', 'atlas', 'png']) {
      files.push({
        rel: `spine/op/${id}/${side.toLowerCase()}/${id}.${ext}`,
        url: `${FX}spine/${p.base}/${id}/${side}/${id}.${ext}`,
      });
    }
  }
  return files;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const text = await readFile(resolve(o.input), 'utf8');
  const ids = [...new Set(
    text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && !l.startsWith('//')),
  )];
  const files = [];
  let valid = 0;
  for (const id of ids) {
    const e = entriesOf(id);
    if (!e) { console.warn(`skipped "${id}": expected <char_NNN_name>_<skin>_<number>`); continue; }
    files.push(...e);
    valid++;
  }
  await writeFile(resolve(o.out), JSON.stringify({ files }, null, 2) + '\n');
  console.log(`[gen-skins] ${valid} ids -> ${files.length} entries -> ${o.out}`);
}

main().catch((e) => { console.error(`[gen-skins] ${e.message}`); process.exitCode = 1; });
