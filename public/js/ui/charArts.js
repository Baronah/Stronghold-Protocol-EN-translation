// Character skin arts loader.
// To add a skin data for a character: data/assets.json -> chars -> find the character. 
// The character should consists two main keys: 'default' for their default loadout, and 'skins' consisting all the skins.
// If a character does not have the keys mentioned above, 
// it means a skin for them is still haven't added. You will have to manually add the entries for them.
// Default spine needs animations and timings that have been provided when you run 'npm install', 
// skins only need the spine files (skel, atlas, textures) and the avatar/portrait images.
// Refer to the existing skins for reference how it should organize:
// "char_388_mint": {
//     "default": {
//         "avatar": "/assets/char/avatar/char_388_mint.png",
//         "avatarE2": "/assets/char/avatar/char_388_mint_2.png",
//         "portrait": "/assets/char/portrait/char_388_mint_1.png",
//         "portraitE2": "/assets/char/portrait/char_388_mint_2.png",
//         "spine": {
//             "front": {
//                 "skel": "/assets/spine/op/char_388_mint/front/char_388_mint.skel",
//                 "atlas": "/assets/spine/op/char_388_mint/front/char_388_mint.atlas",
//                 "textures": [
//                     "/assets/spine/op/char_388_mint/front/char_388_mint.png"
//                 ],
//                 "pma": false,
//                 "anims": {
//                     ... front animations of the base, this is already provided when you install the game...
//                 }
//             },
//             "back": {
//                 "skel": "/assets/spine/op/char_388_mint/back/char_388_mint.skel",
//                 "atlas": "/assets/spine/op/char_388_mint/back/char_388_mint.atlas",
//                 "textures": [
//                     "/assets/spine/op/char_388_mint/back/char_388_mint.png"
//                 ],
//                 "pma": false,
//                 "anims": {
//                     ... back animations of the base ...
//                     }
//             }
//         }
//     },
//     "skins": {
//         "skin_1": {
//             "name": "Tsukiyoi",
//             "avatar": "/assets/char/avatar/char_388_mint_epoque_22.png",
//             "avatarE2": "/assets/char/avatar/char_388_mint_epoque_22.png",
//             "portrait": "/assets/char/portrait/char_388_mint_epoque_22.png",
//             "portraitE2": "/assets/char/portrait/char_388_mint_epoque_22.png",
//             "spine": {
//                 "front": {
//                     "skel": "/assets/spine/op/char_388_mint_epoque_22/front/char_388_mint_epoque_22.skel",
//                     "atlas": "/assets/spine/op/char_388_mint_epoque_22/front/char_388_mint_epoque_22.atlas",
//                     "textures": [
//                         "/assets/spine/op/char_388_mint_epoque_22/front/char_388_mint_epoque_22.png"
//                     ]
//                 },
//                 "back": {
//                     "skel": "/assets/spine/op/char_388_mint_epoque_22/back/char_388_mint_epoque_22.skel",
//                     "atlas": "/assets/spine/op/char_388_mint_epoque_22/back/char_388_mint_epoque_22.atlas",
//                     "textures": [
//                         "/assets/spine/op/char_388_mint_epoque_22/back/char_388_mint_epoque_22.png"
//                     ]
//                 }
//             }
//         },
//         "skin_2": {
//             "name": "Private Study",
//             "avatar": "/assets/char/avatar/char_388_mint_epoque_30.png",
//             "avatarE2": "/assets/char/avatar/char_388_mint_epoque_30.png",
//             "portrait": "/assets/char/portrait/char_388_mint_epoque_30.png",
//             "portraitE2": "/assets/char/portrait/char_388_mint_epoque_30.png",
//             "spine": {
//                 "front": {
//                     "skel": "/assets/spine/op/char_388_mint_epoque_30/front/char_388_mint_epoque_30.skel",
//                     "atlas": "/assets/spine/op/char_388_mint_epoque_30/front/char_388_mint_epoque_30.atlas",
//                     "textures": [
//                         "/assets/spine/op/char_388_mint_epoque_30/front/char_388_mint_epoque_30.png"
//                     ]
//                 },
//                 "back": {
//                     "skel": "/assets/spine/op/char_388_mint_epoque_30/back/char_388_mint_epoque_30.skel",
//                     "atlas": "/assets/spine/op/char_388_mint_epoque_30/back/char_388_mint_epoque_30.atlas",
//                     "textures": [
//                         "/assets/spine/op/char_388_mint_epoque_30/back/char_388_mint_epoque_30.png"
//                     ]
//                 }
//             }
//         }
//     }
// }

/** Art entry of a character under a skin. Skin that does not exist is mapped to default. */
  export function charArt(m, charId, skinId = null) {
    const c = m && m.chars && charId ? m.chars[charId] : null;
    if (!c) return null;
    const def = c.default || c;
    const skin = skinId && c.skins ? c.skins[skinId] : null;
    if (!skin || (!skin.avatar && !skin.spine)) return def;
    const views = {};
    for (const k of new Set([...Object.keys(def.spine || {}), ...Object.keys(skin.spine || {})])) {
      views[k] = skin.spine?.[k] ? { ...def.spine?.[k], ...skin.spine[k] } : def.spine?.[k];
    }
    return { ...def, ...skin, spine: views };
  }

/** Usable skin ids (drops placeholders like "skin_2": {}). */
export function skinList(m, charId) {
  const skins = m?.chars?.[charId]?.skins || {};
  return Object.entries(skins).filter(([, v]) => v && (v.avatar || v.spine)).map(([id]) => id);
}

export const hasSkin = (m, charId, skinId) => !!skinId && skinList(m, charId).includes(skinId);

/** Avatar / portrait URL of a chess record (prioritize skin if used, otherwise, elite uses the E2 art). */
export function skinAvatar(m, chess, skinId) {
  const a = charArt(m, chess.charId, skinId);
  return a ? (chess.isGolden ? a.avatarE2 || a.avatar : a.avatar) : null;
}

export function skinPortrait(m, chess, skinId) {
  const a = charArt(m, chess.charId, skinId);
  return a ? (chess.isGolden ? a.portraitE2 || a.portrait : a.portrait) : null;
}

export function skinName(m, charId, skinId, defaultLabel = '默认') {
  if (!skinId) return defaultLabel;
  const s = m?.chars?.[charId]?.skins?.[skinId];
  return (typeof s?.name === 'string' && s.name.trim()) || skinId;
}