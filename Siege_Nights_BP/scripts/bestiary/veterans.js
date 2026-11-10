// Veterans, the tally, and the repetition check (Mateo's rule: never repetitive, never boring).
//
//   Veterans: about one raider in seven is a named veteran with one trait (Fleet, Stubborn, Cruel, Leaping,
//             Ashen). Never the same trait twice running. They drop a little extra.
//   Tally:    every player keeps a count of what they have killed, veterans counted apart.
//             /scriptevent siege:variety   shows yours and flags anything met too often for its variants.
//   Check:    self-tests fail if a boss has too few attacks or a raider slot too few bodies,
//             so thin spots get more variants before anyone is bored by them.

import { world, system, ItemStack } from "@minecraft/server";
import { addTests, assert, assertEqual } from "../siege/api.js";
import { MOBS } from "./data.js";
import { bossDefs } from "./bossCore.js";
import { TROOPS, NIGHT_HOLLOW, UNDERTOW_HOLLOW } from "./spawns.js";
import { effect, heal } from "./util.js";
import { chooseAttack, pickTemper, traitFor, traitById, staleKeys, TEMPERS, TRAITS, STALE_AFTER } from "./variety.js";

const VET_TAG = "siege_vet_";
const MET_PROP = "siege:bestiary_met";
const FOREVER = 20000000;
let lastTrait;

const vetOf = (entity) => {
  try {
    return traitById(entity.getTags().find((t) => t.startsWith(VET_TAG))?.slice(VET_TAG.length));
  } catch {
    return undefined;
  }
};

function makeVeteran(entity, trait) {
  entity.addTag(VET_TAG + trait.id);
  entity.nameTag = `§e${trait.name} ${MOBS[entity.typeId].name}`;
  for (const [name, level] of trait.effects) effect(entity, name, FOREVER, level);
  if (trait.mend) heal(entity, 1000);
}

world.afterEvents.entitySpawn.subscribe(({ entity }) => {
  let type;
  try { type = entity.typeId; } catch { return; }
  if (MOBS[type]?.family !== "raider") return;
  system.run(() => { // a tick later, so whoever spawned it has put its tags on
    try {
      const tags = entity.getTags();
      if (tags.some((t) => t === "siege_watcher" || t === "siege_showcase" || t === "siege_warlord" || t.startsWith(VET_TAG))) return;
      const trait = traitFor(Math.random(), Math.random(), lastTrait);
      if (!trait) return;
      lastTrait = trait.id;
      makeVeteran(entity, trait);
    } catch {
      // gone already
    }
  });
});

// An Ashen veteran's blows set you alight
world.afterEvents.entityHurt.subscribe((event) => {
  const by = event.damageSource.damagingEntity;
  if (!by || !MOBS[by.typeId] || event.hurtEntity.typeId !== "minecraft:player") return;
  if (vetOf(by)?.burns) {
    try { event.hurtEntity.setOnFire(3, true); } catch { /* gone */ }
  }
});

function metOf(player) {
  try {
    const raw = player.getDynamicProperty(MET_PROP);
    return typeof raw === "string" ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

world.afterEvents.entityDie.subscribe((event) => {
  const dead = event.deadEntity;
  let type, trait, at, dim;
  try { type = dead.typeId; trait = vetOf(dead); at = dead.location; dim = dead.dimension; } catch { return; }
  if (!MOBS[type]) return;
  if (trait) {
    try { dim.spawnItem(new ItemStack("siege:hollow_ash", 2), at); } catch { /* unloaded */ }
  }
  const killer = event.damageSource.damagingEntity;
  if (killer?.typeId !== "minecraft:player") return;
  const met = metOf(killer);
  const key = type.slice("siege:".length) + (trait ? `+${trait.id}` : "");
  met[key] = (met[key] ?? 0) + 1;
  try { killer.setDynamicProperty(MET_PROP, JSON.stringify(met)); } catch { /* gone */ }
});

// How many different shapes a foe comes in (a plain raider counts as one; its veterans are tallied under their own keys)
export const variantsOf = (key) => {
  const boss = bossDefs().find((d) => d.type === `siege:${key}`);
  return boss && !boss.noTemper ? 1 + TEMPERS.length : 1;
};

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:variety") return;
  const p = event.sourceEntity;
  if (p?.typeId !== "minecraft:player") return;
  const met = metOf(p);
  const top = Object.entries(met).sort((a, b) => b[1] - a[1]).slice(0, 8);
  p.sendMessage(`§6What you have met most§7 (${Object.keys(met).length} kinds):`);
  for (const [key, n] of top) p.sendMessage(`§7  ${key.replace("+", ", ")}: §f${n}`);
  const stale = staleKeys(met, variantsOf);
  p.sendMessage(stale.length ? `§cGetting stale (over ${STALE_AFTER} per variant): §f${stale.map((s) => s.key).join(", ")}` : "§aNothing is stale yet.");
});

addTests("bestiary", {
  "a boss never repeats an attack while another is ready": () => {
    assertEqual(chooseAttack([], "a"), undefined);
    assertEqual(chooseAttack(["a", "b"], undefined), "a");
    assertEqual(chooseAttack(["a", "b"], "a"), "b");
    assertEqual(chooseAttack(["a"], "a"), "a");
  },
  "a rematch never wears the temper it wore last time": () => {
    for (const t of TEMPERS) for (let r = 0; r < 1; r += 0.05) assert(pickTemper(t.id, r).id !== t.id, t.id);
    assert(pickTemper(undefined, 0.999));
    assert(TEMPERS.length >= 4, "too few tempers to keep rematches fresh");
  },
  "veterans are rare and never two of a kind running": () => {
    assertEqual(traitFor(0.5, 0, undefined), undefined);
    for (const t of TRAITS) for (let r = 0; r < 1; r += 0.05) assert(traitFor(0, r, t.id).id !== t.id, t.id);
  },
  "the tally flags what one player has met too often": () => {
    assertEqual(staleKeys({ a: 41, b: 40, c: 200 }, (k) => (k === "c" ? 6 : 1)).map((r) => r.key), ["a"]);
  },
  "no fight or raid is thin on variants": () => {
    for (const d of bossDefs()) assert((d.attacks ?? []).length >= 3, `${d.id} has under three attacks`);
    const slots = new Set(Object.values(TROOPS).flatMap((army) => Object.keys(army)));
    for (const slot of slots) {
      const bodies = new Set(Object.values(TROOPS).flatMap((army) => army[slot] ?? []));
      assert(bodies.size >= 2, `${slot} is always the same troop`);
    }
    assert(new Set(NIGHT_HOLLOW).size >= 5, "night Hollow things are too few");
    assert(new Set(UNDERTOW_HOLLOW).size >= 5, "Hollow things in the Hollow are too few");
    for (const army of Object.values(TROOPS)) for (const list of Object.values(army)) for (const t of list) assert(MOBS[t], `${t} is not a mob`);
  },
});
