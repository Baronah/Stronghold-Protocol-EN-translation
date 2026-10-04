// tools/i18n/build.mjs — merge the translations (tools/i18n/out/*.jsonl) into public/i18n/en.json ({ zh: en }).
// The base dictionary (base.mjs: translations, prefilled operator names, plain twins) plus the SPA Database
// (season 2.1) overrides of tools/i18n/spa-overrides.json (apply-spa.mjs). Reports what is still untranslated.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DIR, buildBase } from './base.mjs';

const { dict, missing, lostTwins, twins } = buildBase();

// SPA Database (season 2.1) wording wins (tools/i18n/apply-spa.mjs)
try { Object.assign(dict, JSON.parse(fs.readFileSync(path.join(DIR, 'spa-overrides.json'), 'utf8'))); } catch { /* not generated */ }
fs.mkdirSync(path.join(ROOT, 'public', 'i18n'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'public', 'i18n', 'en.json'), JSON.stringify(dict));
console.log(`en.json: ${Object.keys(dict).length} entries (${twins} plain twins); untranslated ${missing.length}, plain strings without twin ${lostTwins.length}`);
for (const z of [...missing, ...lostTwins].slice(0, 15)) console.log('  ' + z.slice(0, 100).replace(/\n/g, '⏎'));
