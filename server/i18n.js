// server/i18n.js — the English dictionary (public/i18n/en.json, shared/i18n.js) for texts the server composes itself
// (ticker lines filled from data templates, toasts naming operators). Loaded lazily once; missing file ⇒ identity.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTranslator } from '../shared/i18n.js';

const FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'i18n', 'en.json');
let current = null;

/** Translate one display string (identity for unknown strings). */
export function tr(s) {
  if (!current) {
    try { current = createTranslator(JSON.parse(fs.readFileSync(FILE, 'utf8'))); } catch { current = createTranslator(null); }
  }
  return current(s);
}
