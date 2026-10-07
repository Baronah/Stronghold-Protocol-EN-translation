import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'public';
const SPINE = `${ROOT}/assets/spine/op`;
const exists = (p) => fs.existsSync(path.join(ROOT, p.replace(/^\//, '')));

/**
 * Get the default + skin art entries for each character. Skins that do not exist are ignored.
 *  @param {Record<string, any>} chars
 *  @returns {Record<string, { default: any, skins: Record<string, any> }>}
*/
export function withSkins(chars) {
  const dirs = fs.readdirSync(SPINE);
  const out = {};
  for (const [charId, def] of Object.entries(chars)) {
    const skins = {};
    for (const dir of dirs) {
      if (!dir.startsWith(charId + '_')) continue;
      if (dir in chars) continue;
      const skinId = dir.slice(charId.length + 1);
      const base = `/assets/spine/op/${dir}/front/${dir}`;
      const art = {
        avatar: `/assets/char/avatar/${dir}.png`,
        avatarE2: `/assets/char/avatar/${dir}.png`,
        portrait: `/assets/char/portrait/${dir}.png`,
        portraitE2: `/assets/char/portrait/${dir}.png`,
      };
      const files = [`${base}.skel`, `${base}.atlas`, `${base}.png`, ...Object.values(art)];
      const missing = files.filter((f) => !exists(f));
      if (missing.length) { console.warn(`skip ${dir}: missing`, missing); continue; }
      skins[skinId] = { ...art, spine: { front: { skel: `${base}.skel`, atlas: `${base}.atlas`, textures: [`${base}.png`] } } };
    }
    out[charId] = Object.keys(skins).length ? { default: def, skins } : { default: def, skins: {} };
  }
  return out;
}