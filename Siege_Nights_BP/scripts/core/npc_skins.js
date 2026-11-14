// Every NPC wears its own skin (Mateo 2026-11-13). The list of skins: npc_skins_data.js.
//
//   dressNpc(entity, key, name?)  right after spawning a minecraft:npc: tags it siege_skin_<key>, sets its skinIndex
//                           and remembers its name (default: the nameTag it has now). Both are set again a moment
//                           later, because a fresh NPC resets them as it finishes spawning (it then reads "NPC").
//   addNpcLook(fn)          fn(entity) -> key | { key, name } | undefined, for NPCs spawned before they carried a
//                           siege_skin_ tag (old worlds): a feature names the skin (and name) of its own NPCs by their
//                           other tags. A name given here wins over the remembered one (a lord's title can change).
//   npcSkin(key)            the skinIndex of a key (throws on a key that has no painted skin).
//
// How the skin is shown (2026-11-14, Mateo: "last playtest there was a ton of NPCs without skins"): the NPC's
// siege:skin property (key index + 1) picks the picture; 0 falls back to Bedrock's own skin choice (query.variant),
// which only hand-placed NPCs use. A property is set the moment we call it and nothing in Bedrock resets it, unlike
// skinIndex, which a fresh NPC overwrites as it finishes spawning. skinIndex is still set, for the editor.
// Regional looks: a key with variants "<key>__<region>" (frostmarch, saltreach, emberwaste, blackfen; the Vale wears the
// plain key) is dressed in the variant for the region the NPC stands in, so Old Elspeth, the Mason and friends keep
// their signature look but dress for where they live.
//
// Every few seconds the NPCs near players are checked and any that lost their look get it back. NPCs nobody
// claims (hand-placed with the editor) are left as the builder set them; every index shows one of our skins.
// Names (Mateo 2026-11-13: an NPC read just "NPC"): no NPC near a player keeps Bedrock's "NPC" or a blank name. It
// gets back its own name, or a plain one for its kind (Settler, Trader, Miner...), or "Townsfolk".
import { world, system } from "@minecraft/server";
import { onTick } from "./loop.js";
import { addTests, assert, assertEqual } from "./tests.js";
import { NPC_SKINS } from "./npc_skins_data.js";
import { regionAt } from "../minimap/data.js";

export const NPC_ENTITY = "minecraft:npc";
const TAG = "siege_skin_";
const NAME_PROP = "siege:npc_name";
export const SKIN_PROP = "siege:skin"; // key index + 1; 0 = Bedrock's own choice
const STOCK_NAMES = new Set(["", "NPC"]);
// a plain name by kind, for an NPC whose own name is lost
const KIND_NAMES = [["lore_", "Stranger"], ["settler_", "Settler"], ["fair_", "Trader"], ["mummer_", "Mummer"],
  ["keeper_", "Keeper"], ["traveller_", "Traveller"], ["clock_", "Clock Keeper"], ["warden_", "Warden"],
  ["mire_", "Villager"], ["lord_", "Lord"], ["guest_", "Guest"], ["hollow_foreman", "Foreman"],
  ["hollow_miner_", "Miner"], ["envoy_", "Envoy"], ["mason", "Mason"]];
export const kindName = (key) => KIND_NAMES.find(([p]) => String(key ?? "").startsWith(p))?.[1] ?? "Townsfolk";
// regional variants: "<key>__<slug>"
export const REGION_SLUGS = { "Aldmere Vale": "", "Frostmarch": "frostmarch", "Saltreach": "saltreach", "Emberwaste": "emberwaste", "Blackfen": "blackfen" };
export const baseKey = (key) => String(key ?? "").split("__")[0];
/** The key to wear in a region (a region name as minimap/data.js regionAt gives it): the regional variant if painted. */
export function regionalKey(key, region) {
  const slug = REGION_SLUGS[region];
  const k = baseKey(key);
  return slug && INDEX.has(`${k}__${slug}`) ? `${k}__${slug}` : k;
}
function regionOf(entity) {
  try {
    if (!entity.dimension.id.endsWith("overworld")) return "";
    return regionAt(entity.location.x, entity.location.z);
  } catch { return ""; }
}
const INDEX = new Map(NPC_SKINS.map((k, i) => [k, i]));
const looks = [];

export const hasNpcSkin = (key) => INDEX.has(key);
export function npcSkin(key) {
  const i = INDEX.get(key);
  if (i === undefined) throw new Error(`no NPC skin "${key}": add it to core/npc_skins_data.js and paint it`);
  return i;
}
export const addNpcLook = (fn) => { looks.push(fn); };

function wear(entity, index, name) {
  try {
    if (!entity?.isValid) return;
    if (name && entity.nameTag !== name) entity.nameTag = name;
    if (index !== undefined) {
      try { if (entity.getProperty(SKIN_PROP) !== index + 1) entity.setProperty(SKIN_PROP, index + 1); } catch { /* an old pack without the property */ }
    }
    const npc = entity.getComponent("minecraft:npc");
    if (!npc) return;
    if (index !== undefined && npc.skinIndex !== index) npc.skinIndex = index;
    const plain = name?.split("\n")[0].replace(/§./g, "");
    if (plain && npc.name !== plain) npc.name = plain;
  } catch { /* gone or not ready */ }
}

export function dressNpc(entity, key, name) {
  key = regionalKey(key, regionOf(entity));
  if (!INDEX.has(key)) { // never leave an NPC undressed: a plain skin, and a warning for whoever added the key
    console.warn(`[Hollow Crown] no NPC skin "${key}": add it to core/npc_skins_data.js and paint it. Wearing "commoner".`);
    key = "commoner";
  }
  const index = npcSkin(key);
  try {
    for (const t of entity.getTags()) if (t.startsWith(TAG) && t !== TAG + key) entity.removeTag(t);
    entity.addTag(TAG + key);
    const own = name ?? entity.nameTag;
    if (!STOCK_NAMES.has(own ?? "")) entity.setDynamicProperty(NAME_PROP, own);
  } catch { /* gone */ }
  const keep = () => wear(entity, index, lookOf(entity).name);
  keep();
  system.runTimeout(keep, 10);
  system.runTimeout(keep, 60); // a slow chunk finishes spawning the NPC late
  return entity;
}

/** What this NPC should look like: { key, name }, either may be undefined (an NPC nobody claims). */
export function lookOf(entity) {
  let key = entity.getTags().find((t) => t.startsWith(TAG))?.slice(TAG.length);
  if (!INDEX.has(key)) key = undefined;
  let name;
  for (const fn of looks) {
    try {
      const got = fn(entity);
      const k = typeof got === "string" ? got : got?.key;
      if (!k || !INDEX.has(k)) continue;
      key ??= regionalKey(k, regionOf(entity));
      if (baseKey(k) === baseKey(key)) { name = typeof got === "object" ? got.name : undefined; break; }
    } catch { /* that feature could not tell */ }
  }
  let kept;
  try { kept = entity.getDynamicProperty(NAME_PROP); } catch { /* gone */ }
  name ??= typeof kept === "string" && kept ? kept : undefined;
  if (!name && STOCK_NAMES.has(entity.nameTag ?? "")) name = kindName(key);
  return { key, name };
}
export const npcSkinKeyOf = (entity) => lookOf(entity).key;

onTick("npc_skins", 100, () => {
  const seen = new Set();
  for (const p of world.getPlayers()) {
    let near;
    try { near = p.dimension.getEntities({ type: NPC_ENTITY, location: p.location, maxDistance: 64 }); } catch { continue; }
    for (const e of near) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      const { key, name } = lookOf(e);
      wear(e, key === undefined ? undefined : INDEX.get(key), name);
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
  "every kind of NPC has a plain name to fall back on": () => {
    assertEqual(kindName("hollow_miner_2"), "Miner");
    assertEqual(kindName("settler_5"), "Settler");
    assertEqual(kindName("commoner"), "Townsfolk");
    assertEqual(kindName(undefined), "Townsfolk");
  },
  "regional variants: the Vale wears the plain key, other regions their own, unknown keys stay plain": () => {
    assertEqual(regionalKey("mason", "Aldmere Vale"), "mason");
    assertEqual(regionalKey("mason", "Frostmarch"), "mason__frostmarch");
    assertEqual(regionalKey("lore_elspeth__saltreach", "Blackfen"), "lore_elspeth__blackfen");
    assertEqual(regionalKey("lore_wren", "Frostmarch"), "lore_wren");
    assertEqual(regionalKey("mason", ""), "mason");
    for (const k of NPC_SKINS.filter((x) => x.includes("__"))) {
      assert(INDEX.has(baseKey(k)), `${k} has no plain key`);
      assert(Object.values(REGION_SLUGS).includes(k.split("__")[1]), `${k}: unknown region`);
    }
  },
  "an unknown key is refused": () => {
    let threw = false;
    try { npcSkin("nobody_at_all"); } catch { threw = true; }
    assert(threw, "npcSkin should throw for a key with no skin");
  },
});
