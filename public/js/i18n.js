// Browser side of the English UI (shared/i18n.js): loads the { zh: en } dictionary /i18n/en.json once at boot.
//
// `tr(s)` translates one known data string (names, descriptions, ticker templates…), `trDeep(v)` a whole JSON value.
// data.js passes every display data file through trDeep; main.js does the same for the server's m.* pushes. The battle
// simulation (battle/runner.js loadBrowserSim) fetches its own untranslated copy of the data: its rules read the
// official Chinese texts. Until the dictionary is loaded (or when it is missing) both functions return their input.

import { createTranslator, translateDeep } from '../../shared/i18n.js';

let current = createTranslator(null);

/** @param {any} s */
export const tr = (s) => current(s);
/** @template T @param {T} v @returns {T} */
export const trDeep = (v) => (current.size ? translateDeep(v, current) : v);

/**
 * Load the dictionary (never throws; a missing file leaves the texts untranslated).
 * @param {{ url?: string, fetchFn?: typeof fetch }} [opts]
 */
export async function loadI18n({ url = '/i18n/en.json', fetchFn = (...a) => globalThis.fetch(...a) } = {}) {
  try {
    const res = await fetchFn(url, { cache: 'no-cache' });
    if (res && res.ok) current = createTranslator(await res.json());
  } catch (err) {
    console.warn('[i18n] dictionary unavailable, texts stay untranslated', err?.message || err);
  }
  return current.size;
}

let ready = null;
/** Load the dictionary once (memoized); resolves to the entry count. Under Node (tests) it resolves to 0 at once. */
export function ensureI18n() {
  if (!ready) ready = typeof window === 'undefined' ? Promise.resolve(0) : loadI18n();
  return ready;
}

/** Install a dictionary directly (tests). */
export function setI18n(dict) { current = createTranslator(dict); }
