// tools/i18n/spa-extract.mjs — pull the "Second Season" (2.1) tables out of the SPA Database bundle
// (https://ak-spa-database.pages.dev, downloaded to ../spa-index.js) into tools/i18n/spa-db.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.resolve(DIR, '../../../spa-index.js'), 'utf8');

/** The array literal assigned to `name` (`,name=[{…}]`), evaluated. */
function grab(name) {
  const start = src.indexOf(`,${name}=[{`);
  if (start < 0) throw new Error(`no array ${name}`);
  const i = src.indexOf('[', start);
  let depth = 0, j = i, quote = null;
  for (; j < src.length; j++) {
    const c = src[j];
    if (quote) {
      if (c === '\\') { j++; continue; }
      if (quote === '`' && c === '$' && src[j + 1] === '{') { j++; depth++; continue; } // not expected in data
      if (c === quote) quote = null;
      continue;
    }
    if (c === '`' || c === '"' || c === "'") { quote = c; continue; }
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') { depth--; if (depth === 0) break; }
  }
  return (0, eval)(`(${src.slice(i, j + 1)})`);
}

const out = { attributes: grab('fe'), alliances: grab('he'), items: grab('ve'), strategies: grab('xe') };
for (const [k, v] of Object.entries(out)) console.log(k, v.length, JSON.stringify(v[0]).slice(0, 240));
fs.writeFileSync(path.join(DIR, 'spa-db.json'), JSON.stringify(out, null, 1));
