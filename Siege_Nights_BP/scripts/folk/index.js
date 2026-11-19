// Folk: our own villagers (Mateo 2026-11-15: "every single thing needs a skin"). No vanilla villager is ever spawned:
// the homecoming strangers, the Returned-case suspects, a Quartermaster without a desk and every Returned are siege:folk,
// a plain walking person who can be hurt, in one of FOLK_SKINS (six looks per region, studio/art/build_folk.py).
//
//   spawnFolk(dim, location, { name, seed, tags })   a person dressed for the region they stand in
//   setTell(entity, on)                              a Returned's tell: the same clothes, slightly wrong (the wrong
//                                                    hand, eyes that look past you, a wet hem). bestiary/returned.js
//                                                    markReturned turns it on.
//   FOLK = "siege:folk"
import { world } from "@minecraft/server";
import { addTests, assert, assertEqual } from "../core/tests.js";
import { onTick } from "../core/loop.js";
import { regionAt } from "../minimap/data.js";
import { FOLK_SKINS, FOLK_BY_REGION } from "./skins_data.js";

export const FOLK = "siege:folk";
export const PLAIN_TAG = "siege_folk_plain"; // an ordinary person, free to take a job (Quartermaster, guard)
const SLUG = { "Aldmere Vale": "vale", "Frostmarch": "frostmarch", "Saltreach": "saltreach", "Emberwaste": "emberwaste", "Blackfen": "blackfen" };

/** The skin index for someone in a region (a region name as minimap/data.js gives it), picked by a seed. */
export function folkSkin(region, seed) {
  const list = FOLK_BY_REGION[SLUG[region] ?? "vale"] ?? FOLK_BY_REGION.vale;
  const n = Math.abs(Math.floor(Number(seed) || 0));
  return list[n % list.length];
}

export function spawnFolk(dim, location, { name, seed = Math.floor(Math.random() * 1e9), tags = [] } = {}) {
  const e = dim.spawnEntity(FOLK, location);
  let region = "";
  try { if (dim.id.endsWith("overworld")) region = regionAt(location.x, location.z); } catch { /* off the map */ }
  try { e.setProperty("siege:skin", folkSkin(region, seed)); } catch { /* an old pack */ }
  for (const t of tags) { try { e.addTag(t); } catch { /* gone */ } }
  if (name) e.nameTag = name;
  return e;
}

export function setTell(entity, on = true) {
  try { if (entity?.typeId === FOLK) entity.setProperty("siege:tell", !!on); } catch { /* gone or an old pack */ }
}

// Any vanilla villager near a player (an old world's strangers, suspects and Returned, or one from an egg) becomes one
// of our folk where it stands: same name, tags and hidden data (a Returned stays Returned), so none keeps Bedrock's look.
const VANILLA = ["minecraft:villager_v2", "minecraft:villager"];
export function replaceVanilla(v) {
  const e = spawnFolk(v.dimension, v.location, { name: v.nameTag || undefined, seed: Math.floor(v.location.x * 31 + v.location.z) });
  for (const t of v.getTags()) { try { e.addTag(t); } catch { /* full */ } }
  try { for (const id of v.getDynamicPropertyIds()) e.setDynamicProperty(id, v.getDynamicProperty(id)); } catch { /* none */ }
  if (!v.getTags().some((t) => t.startsWith("hc_story_") || t.startsWith("siege_after_"))) e.addTag(PLAIN_TAG);
  try { e.setRotation(v.getRotation()); } catch { /* facing is optional */ }
  try { if (e.getDynamicProperty("siege:returned")) setTell(e, true); } catch { /* none */ }
  v.remove();
  return e;
}
onTick("folk_replace_vanilla", 100, () => {
  for (const p of world.getPlayers()) {
    for (const type of VANILLA) {
      let near = [];
      try { near = p.dimension.getEntities({ type, location: p.location, maxDistance: 64 }); } catch { continue; }
      for (const v of near) { try { replaceVanilla(v); } catch { /* not loaded */ } }
    }
  }
});

addTests("folk", {
  "every region has its own folk looks, and a seed always picks the same one": () => {
    for (const r of Object.keys(SLUG)) {
      const a = folkSkin(r, 7);
      assert(FOLK_SKINS[a].startsWith(SLUG[r] + "_"), `${r} picked ${FOLK_SKINS[a]}`);
      assertEqual(folkSkin(r, 7), a);
    }
    assert(FOLK_SKINS[folkSkin("", 3)].startsWith("vale_"), "off the map wears the Vale's");
    assert(FOLK_SKINS[folkSkin("Blackfen", -5)].startsWith("blackfen_"), "a negative seed still works");
  },
});
