// tools/i18n/base.mjs — the agents' dictionary before the SPA Database overrides: the translations
// (tools/i18n/out/*.jsonl), the prefilled operator names (source.json prefill) and the markup-free twin of every
// rich-text string (richTextPlain of both sides). Shared by build.mjs and apply-spa.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { richTextPlain } from '../../public/js/ui/richText.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DIR = path.join(ROOT, 'tools', 'i18n');
const CJK = /[㐀-鿿豈-﫿]/;

/** @returns {{ dict: Record<string, string>, missing: string[], lostTwins: string[], twins: number }} */
export function buildBase() {
  const { source, prefill, derived } = JSON.parse(fs.readFileSync(path.join(DIR, 'source.json'), 'utf8'));
  const en = new Map();
  for (const f of fs.readdirSync(path.join(DIR, 'out')).filter((f) => f.endsWith('.jsonl')).sort()) {
    for (const l of fs.readFileSync(path.join(DIR, 'out', f), 'utf8').split('\n')) {
      if (!l.trim()) continue;
      try { const o = JSON.parse(l); if (typeof o.en === 'string' && o.en.trim()) en.set(Number(o.id), o.en); } catch { /* check.mjs reports it */ }
    }
  }
  const dict = { ...prefill };
  const missing = [];
  for (const [id, zh] of Object.entries(source)) {
    const t = en.get(Number(id));
    if (t && !CJK.test(t)) dict[zh] = t; else missing.push(zh);
  }
  // markup-free twins of the rich strings
  let twins = 0;
  for (const [zh, t] of Object.entries({ ...dict })) {
    if (!/<[@$][A-Za-z0-9_.\-]+>/.test(zh)) continue;
    const p = richTextPlain(zh);
    if (p !== zh && !(p in dict)) { dict[p] = richTextPlain(t); twins++; }
  }
  const lostTwins = derived.filter((z) => !(z in dict));
  return { dict, missing, lostTwins, twins };
}
