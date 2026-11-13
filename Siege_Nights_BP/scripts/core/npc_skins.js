// Every NPC wears its own skin (Mateo 2026-11-13). The list of skins: npc_skins_data.js.
//
//   dressNpc(entity, key)   right after spawning a minecraft:npc: tags it siege_skin_<key> and sets its skinIndex.
//                           The look is set again a moment later (a fresh NPC can reset it as it finishes spawning).
//   addNpcLook(fn)          fn(entity) -> key | undefined, for NPCs spawned before they carried a siege_skin_ tag
//                           (old worlds): a feature names the skin of its own NPCs by their other tags.
//   npcSkin(key)            the skinIndex of a key (throws on a key that has no painted skin).
//
// Every few seconds the NPCs near players are checked and any that lost their look get it back. NPCs nobody
// claims (hand-placed with the editor) are left as the builder set them; every index shows one of our skins.
import { world, system } from "@minecraft/server";
import { onTick } from "./loop.js";
import { addTests, assert, assertEqual } from "./tests.js";
import { NPC_SKINS } from "./npc_skins_data.js";

export const NPC_ENTITY = "minecraft:npc";
const TAG = "siege_skin_";
const INDEX = new Map(NPC_SKINS.map((k, i) => [k, i]));
const looks = [];

export const hasNpcSkin = (key) => INDEX.has(key);
export function npcSkin(key) {
  const i = INDEX.get(key);
  if (i === undefined) throw new Error(`no NPC skin "${key}": add it to core/npc_skins_data.js and paint it`);
  return i;
}
export const addNpcLook = (fn) => { looks.push(fn); };

function wear(entity, index) {
  try {
    if (!entity?.isValid) return;
    const npc = entity.getComponent("minecraft:npc");
    if (npc && npc.skinIndex !== index) npc.skinIndex = index;
  } catch { /* gone or not ready */ }
}

export function dressNpc(entity, key) {
  const index = npcSkin(key);
  try {
    for (const t of entity.getTags()) if (t.startsWith(TAG) && t !== TAG + key) entity.removeTag(t);
    entity.addTag(TAG + key);
  } catch { /* gone */ }
  wear(entity, index);
  system.runTimeout(() => wear(entity, index), 10);
  return entity;
}

export function npcSkinKeyOf(entity) {
  const tagged = entity.getTags().find((t) => t.startsWith(TAG))?.slice(TAG.length);
  if (tagged && INDEX.has(tagged)) return tagged;
  for (const fn of looks) {
    try {
      const k = fn(entity);
      if (k && INDEX.has(k)) return k;
    } catch { /* that feature could not tell */ }
  }
  return undefined;
}

onTick("npc_skins", 100, () => {
  const seen = new Set();
  for (const p of world.getPlayers()) {
    let near;
    try { near = p.dimension.getEntities({ type: NPC_ENTITY, location: p.location, maxDistance: 64 }); } catch { continue; }
    for (const e of near) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      const key = npcSkinKeyOf(e);
      if (key) wear(e, INDEX.get(key));
    }
  }
});

addTests("npc skins", {
  "keys are unique and named plainly": () => {
    assertEqual(new Set(NPC_SKINS).size, NPC_SKINS.length, "a key is listed twice");
    for (const k of NPC_SKINS) assert(/^[a-z0-9_]+$/.test(k), `bad key ${k}`);
    assertEqual(NPC_SKINS[0], "commoner");
    assertEqual(npcSkin("mason"), 1);
  },
  "an unknown key is refused": () => {
    let threw = false;
    try { npcSkin("nobody_at_all"); } catch { threw = true; }
    assert(threw, "npcSkin should throw for a key with no skin");
  },
});
