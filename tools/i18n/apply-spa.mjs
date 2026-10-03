// tools/i18n/apply-spa.mjs — overwrite entries of public/i18n/en.json with the SPA Database (season 2.1) wording.
// Source: tools/i18n/spa-db.json (spa-extract.mjs). Maps by id:
//   alliances  bondId (case-insensitive)   → bond name, desc/descRaw
//   strategies iconLink = band iconId      → band name, effectName, desc/descRaw
//   items      iconLink = item trapId      → item name, desc/descRaw (both tiers)
//   attributes name = operator EN name     → operator's garrison (Attribute) desc/descRaw
// The overrides are also saved to tools/i18n/spa-overrides.json so build.mjs re-applies them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const db = J('tools/i18n/spa-db.json');
const enPath = path.join(ROOT, 'public/i18n/en.json');
const en = J('public/i18n/en.json');
const CJK = /[㐀-鿿]/;

/** SPA html → game rich text (raw) / plain text. */
const PAIR = /<span class=["']blue["']>([\s\S]*?)<\/span>\s*\/\s*<span class=["']green["']>([\s\S]*?)<\/span>/g;
/** pick: 'base' keeps the blue (normal) value of a 'blue/green' pair, 'elite' the green one, null both. */
const raw = (s, pick = null) => String(s)
  .replace(PAIR, (m, b, g) => (pick === 'base' ? "<span class='blue'>" + b + '</span>' : pick === 'elite' ? "<span class='green'>" + g + '</span>' : m))
  .replace(/<span class=["']font-bold["']>([\s\S]*?)<\/span>/g, '$1')
  .replace(/<span class=["'](blue|green)["']>([\s\S]*?)<\/span>/g, '<@ba.vup>$2</>')
  .replace(/<span[^>]*>([\s\S]*?)<\/span>/g, '$1')
  .replace(/<br\s*\/?>/g, '\n')
  .replace(/&lt;?/g, '<').replace(/&gt;?/g, '>').replace(/&amp;/g, '&');
const plain = (s, pick = null) => raw(s, pick).replace(/<@[A-Za-z0-9_.\-]+>|<\/>/g, '');

const over = {};
const set = (zh, text) => { if (typeof zh === 'string' && CJK.test(zh) && text) over[zh] = text; };
const setDesc = (rec, html, pick = null) => {
  set(rec.desc, plain(html, pick));
  set(rec.descRaw, raw(html, pick));
};
const stats = {};
const hit = (k) => { stats[k] = (stats[k] || 0) + 1; };

// alliances
const bonds = J('data/bonds.json');
const bondById = new Map(Object.values(bonds).map((b) => [b.bondId.toLowerCase(), b]));
for (const a of db.alliances) {
  const b = bondById.get(String(a.bondId).toLowerCase());
  if (!b) { console.log('alliance not found', a.bondId); continue; }
  set(b.name, a.name); setDesc(b, a.desc); hit('alliances');
}

// strategies
const bands = J('data/bands.json');
const bandByIcon = new Map(Object.values(bands).map((b) => [b.iconId, b]));
for (const s of db.strategies) {
  const b = bandByIcon.get(s.iconLink);
  if (!b) { console.log('strategy not found', s.name, s.iconLink); continue; }
  set(b.name, s.name); set(b.effectName, s.effectName); setDesc(b, s.effectDesc); hit('strategies');
}

// items (base + elite share the trap id)
const items = J('data/items.json');
for (const it of db.items) {
  const icon = it.iconLink.replace('acgarm', 'acarm'); // the site misspells one trap id
  const recs = Object.values(items).filter((r) => r.trapId === icon || r.iconId === icon);
  if (!recs.length) { console.log('item not found', it.itemName, it.iconLink); continue; }
  for (const r of recs) { set(r.name, it.itemName); setDesc(r, it.effectDesc, r.isGolden ? 'elite' : 'base'); }
  hit('items');
}

// operator attributes (garrisons) via the operator's English name
const chess = J('data/chess.json');
const garrisons = J('data/garrisons.json');
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const byEnName = new Map();
for (const c of Object.values(chess)) {
  const e = en[c.name];
  for (const n of [e, c.appellation]) if (n) (byEnName.get(norm(n)) || byEnName.set(norm(n), []).get(norm(n))).push(c);
}
// names the data only carries in Cyrillic
for (const [alias, appellation] of [['Gummy', 'Гум'], ['Vetochki', 'Веточки']]) {
  const cs = Object.values(chess).filter((c) => c.appellation === appellation);
  if (cs.length) byEnName.set(norm(alias), cs);
}
const missedOps = [];
for (const a of db.attributes) {
  const cs = byEnName.get(norm(a.name));
  if (!cs) { missedOps.push(a.name); continue; }
  for (const c of cs) {
    set(c.name, a.name);
    for (const gid of c.garrisonIds || []) if (garrisons[gid]) setDesc(garrisons[gid], a.attribute, c.isGolden ? 'elite' : 'base');
  }
  hit('attributes');
}

Object.assign(en, over);
fs.writeFileSync(enPath, JSON.stringify(en));
fs.writeFileSync(path.join(ROOT, 'tools/i18n/spa-overrides.json'), JSON.stringify(over, null, 1));
console.log('applied', Object.keys(over).length, 'strings', stats);
if (missedOps.length) console.log('operators not matched:', missedOps.join(', '));
