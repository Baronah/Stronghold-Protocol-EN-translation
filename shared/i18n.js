// Display translation (English UI). Pure ESM shared by the server and the browser.
//
// The game data (data/*.json) stays Chinese: the battle simulation reads mechanics out of the official description
// texts (server/sim/content/generic.js …), on the server and in the browser alike. What players SEE is translated
// with a dictionary { zh: en } (public/i18n/en.json, built by tools/i18n/build.mjs): exact whole-string matches only,
// so ids, numbers and anything not in the dictionary pass through unchanged.

const CJK = /[㐀-鿿豈-﫿]/;

/**
 * A translator over a { zh: en } dictionary. `tr(s)` returns the English text of a known string, else `s`.
 * @param {Record<string, string> | null | undefined} dict
 * @returns {((s: any) => any) & { size: number }}
 */
export function createTranslator(dict) {
  const map = new Map(dict && typeof dict === 'object' ? Object.entries(dict).filter(([, v]) => typeof v === 'string') : []);
  const tr = (s) => (typeof s === 'string' && map.size && CJK.test(s) ? (map.get(s) ?? s) : s);
  tr.size = map.size;
  return tr;
}

/**
 * A copy of a JSON value with every string passed through `tr` (object keys untouched). Values without any change
 * are returned as is, so an untranslated object keeps its identity.
 * @template T
 * @param {T} value
 * @param {(s: string) => string} tr
 * @returns {T}
 */
export function translateDeep(value, tr) {
  if (typeof value === 'string') return tr(value);
  if (!value || typeof value !== 'object' || typeof tr !== 'function') return value;
  if (Array.isArray(value)) {
    let out = null;
    for (let i = 0; i < value.length; i++) {
      const v = translateDeep(value[i], tr);
      if (v !== value[i]) (out ??= value.slice())[i] = v;
    }
    return out ?? value;
  }
  let out = null;
  for (const k of Object.keys(value)) {
    const v = translateDeep(value[k], tr);
    if (v !== value[k]) (out ??= { ...value })[k] = v;
  }
  return out ?? value;
}
