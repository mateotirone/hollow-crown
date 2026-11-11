// Choirsteel gear: what the Hollow's metal does once it is armour, a blade or a pick.
// The items and recipes are data (studio/bestiary/choirsteel.py): each piece is a netherite piece
// upgraded at a smithing table with a Choirsteel Upgrade template (found at the Cold Forge in the
// Hollow, undertow/forge.js) and Tempered Choirsteel. Protection is the same as netherite,
// because Minecraft stops counting armour there; what puts Choirsteel above it is here.
//
//   Helm      you see in the dark
//   Cuirass   the Answer: one hit in four that lands on you rings back at whoever struck
//   Greaves   nothing slows you
//   Treads    you fall like a quill (Gloamquill in the soles): no fall damage
//   Full set  Resonant: a fifth of all damage turned aside, and four more hearts
//   Blade     the Chord: every fourth hit rings through every enemy near the one you struck; bites deeper into Hollow things
//   Pick      Sounding: break an ore and it shows you the nearest ore still in the rock
//
// Test: /scriptevent siege:choirsteel_kit   gives the whole set, tools and materials.

import { world, system, EquipmentSlot, ItemStack } from "@minecraft/server";
import { onTick, addTests, assert, assertEqual } from "../siege/api.js";
import { MOBS } from "./data.js";
import { addToPlayerList, effect, give, held, hurt, line, particle, ring, shove, sound } from "./util.js";

const ID = (piece) => `siege:choirsteel_${piece}`;
const SLOTS = [["helmet", EquipmentSlot.Head], ["chestplate", EquipmentSlot.Chest], ["leggings", EquipmentSlot.Legs], ["boots", EquipmentSlot.Feet]];
const SET_TAG = "siege_choirsteel_set";
const KNOWN_PROP = "siege:choirsteel_known";
const FOREVER = 20000000;
export const CHOIRSTEEL = { answerChance: 0.25, answerDamage: 4, chordEvery: 4, chordDamage: 5, chordReach: 3.5, hollowBonus: 3, soundingReach: 6 };

const TOLD = {
  helmet: "§dChoirsteel Helm§7: the dark is no longer dark to you.",
  chestplate: "§dChoirsteel Cuirass§7: sometimes a blow that lands on you rings back at whoever struck it.",
  leggings: "§dChoirsteel Greaves§7: nothing slows you.",
  boots: "§dChoirsteel Treads§7: you fall like a quill.",
  set: "§dThe whole set hums together.§7 Resonant: blows land softer, and you have more life in you.",
  sword: "§dChoirsteel Blade§7: every fourth hit, the Chord rings through everything near what you struck.",
  pickaxe: "§dChoirsteel Pick§7: break an ore and listen. It shows you the next one.",
};
const tell = (p, key) => { if (addToPlayerList(p, KNOWN_PROP, key)) p.sendMessage(TOLD[key]); };

// Pure: which pieces count, and when the Chord and the Answer go off
export const wornPieces = (worn) => SLOTS.map(([piece]) => piece).filter((piece, i) => worn[i] === ID(piece));
export const isFullSet = (worn) => wornPieces(worn).length === SLOTS.length;
export const chordDue = (hits, every = CHOIRSTEEL.chordEvery) => hits > 0 && hits % every === 0;
export const answers = (roll, chance = CHOIRSTEEL.answerChance) => roll < chance;
// Pure: the nearest of `spots` to `from` that isn't `from` itself
export function nearest(from, spots) {
  let best, bestD = Infinity;
  for (const s of spots) {
    const d = Math.hypot(s.x - from.x, s.y - from.y, s.z - from.z);
    if (d > 0 && d < bestD) { best = s; bestD = d; }
  }
  return best;
}

const wornBy = (p) => SLOTS.map(([, slot]) => held(p, slot));

function gearTick() {
  for (const p of world.getPlayers()) {
    try {
      const pieces = wornPieces(wornBy(p));
      for (const piece of pieces) tell(p, piece);
      if (pieces.includes("helmet")) effect(p, "night_vision", 320, 0);
      if (pieces.includes("leggings")) p.removeEffect("slowness");
      if (pieces.includes("boots") && p.getVelocity().y < -0.55) effect(p, "slow_falling", 30, 0);
      const full = pieces.length === SLOTS.length, had = p.hasTag(SET_TAG);
      if (full && !had) {
        p.addTag(SET_TAG);
        effect(p, "resistance", FOREVER, 0); effect(p, "health_boost", FOREVER, 1);
        sound(p.dimension, "block.amethyst_block.chime", p.location, 0.6, 1);
        tell(p, "set");
      } else if (!full && had) {
        p.removeTag(SET_TAG);
        p.removeEffect("resistance"); p.removeEffect("health_boost");
      }
      const hand = held(p);
      if (hand === ID("sword")) tell(p, "sword");
      if (hand === ID("pickaxe")) tell(p, "pickaxe");
    } catch {
      // player mid-transfer
    }
  }
}
onTick("bestiary_choirsteel", 10, gearTick);

const chordHits = new Map(); // player id -> hits with the Blade

world.afterEvents.entityHurt.subscribe((event) => {
  const victim = event.hurtEntity, by = event.damageSource.damagingEntity;
  if (!by || event.damageSource.cause !== "entityAttack") return;
  try {
    // the Blade
    if (by.typeId === "minecraft:player" && held(by) === ID("sword") && victim.typeId !== "minecraft:player") {
      if (victim.matches({ families: ["hollow"] })) hurt(victim, CHOIRSTEEL.hollowBonus, "magic");
      const n = (chordHits.get(by.id) ?? 0) + 1;
      chordHits.set(by.id, n);
      if (chordDue(n)) {
        ring(victim.dimension, victim.location, CHOIRSTEEL.chordReach, "minecraft:sonic_explosion", 6);
        particle(victim.dimension, "siege:choir_ring", { x: victim.location.x, y: victim.location.y + 0.4, z: victim.location.z }); particle(victim.dimension, "siege:glint", victim.getHeadLocation());
        sound(victim.dimension, "block.amethyst_block.chime", victim.location, 0.5, 1.4);
        for (const e of victim.dimension.getEntities({ location: victim.location, maxDistance: CHOIRSTEEL.chordReach, families: ["monster"] })) {
          if (e.id !== victim.id) hurt(e, CHOIRSTEEL.chordDamage, "magic");
        }
      }
    }
    // the Cuirass
    if (victim.typeId === "minecraft:player" && held(victim, EquipmentSlot.Chest) === ID("chestplate") && answers(Math.random())) {
      ring(victim.dimension, victim.location, 2, "minecraft:sonic_explosion", 4);
      particle(victim.dimension, "siege:choir_ring", { x: victim.location.x, y: victim.location.y + 0.4, z: victim.location.z });
      sound(victim.dimension, "block.amethyst_block.chime", victim.location, 0.8, 1);
      hurt(by, CHOIRSTEEL.answerDamage, "magic");
      shove(by, by.location.x - victim.location.x, by.location.z - victim.location.z, 1.1, 0.35);
    }
  } catch {
    // one of them is gone
  }
});

// Sounding: the Pick shows the nearest ore still in the rock
world.afterEvents.playerBreakBlock.subscribe((event) => {
  const broken = event.brokenBlockPermutation.type.id;
  if (!broken.endsWith("_ore")) return;
  const p = event.player;
  try {
    if (held(p) !== ID("pickaxe")) return;
    const at = event.block.location, r = CHOIRSTEEL.soundingReach, found = [];
    for (let x = -r; x <= r; x++) for (let y = -r; y <= r; y++) for (let z = -r; z <= r; z++) {
      if (x * x + y * y + z * z > r * r) continue;
      const b = event.dimension.getBlock({ x: at.x + x, y: at.y + y, z: at.z + z });
      if (b?.typeId.endsWith("_ore")) found.push(b.location);
    }
    const next = nearest(at, found);
    if (!next) return;
    const from = { x: at.x + 0.5, y: at.y + 0.5, z: at.z + 0.5 }, to = { x: next.x + 0.5, y: next.y + 0.5, z: next.z + 0.5 };
    line(event.dimension, from, to, "minecraft:endrod", 0.7);
    particle(event.dimension, "minecraft:sonic_explosion", to);
    particle(event.dimension, "siege:glint", to); particle(event.dimension, "siege:vein_spark", from);
    sound(event.dimension, "block.amethyst_block.chime", to, 1.6, 1);
  } catch {
    // unloaded rock
  }
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:choirsteel_kit") return;
  const p = event.sourceEntity;
  if (p?.typeId !== "minecraft:player") return;
  for (const piece of ["helmet", "chestplate", "leggings", "boots", "sword", "pickaxe", "axe", "shovel", "hoe"]) {
    try { give(p, new ItemStack(ID(piece), 1)); } catch { /* item missing */ }
  }
  try { give(p, new ItemStack("siege:choirsteel_ingot", 32)); give(p, new ItemStack("siege:gloamquill", 8)); } catch { /* item missing */ }
  try { give(p, new ItemStack("siege:choirsteel_upgrade_template", 2)); give(p, new ItemStack("siege:tempered_choirsteel", 4)); } catch { /* item missing */ }
});

addTests("bestiary", {
  "Choirsteel: the set bonus needs all four pieces": () => {
    const all = SLOTS.map(([piece]) => ID(piece));
    assert(isFullSet(all));
    assert(!isFullSet([all[0], all[1], all[2], "minecraft:netherite_boots"]));
    assertEqual(wornPieces([undefined, all[1], undefined, all[3]]), ["chestplate", "boots"]);
    assertEqual(wornPieces([all[1], all[0], undefined, undefined]), [], "a piece only counts in its own slot");
  },
  "Choirsteel: the Chord rings on every fourth hit": () => {
    assertEqual([0, 1, 3, 4, 7, 8].map((n) => chordDue(n)), [false, false, false, true, false, true]);
    assert(answers(0.1) && !answers(0.9));
  },
  "Choirsteel: Sounding points at the nearest other ore": () => {
    const at = { x: 0, y: 0, z: 0 };
    assertEqual(nearest(at, [at, { x: 5, y: 0, z: 0 }, { x: 0, y: 2, z: 0 }]), { x: 0, y: 2, z: 0 });
    assertEqual(nearest(at, [at]), undefined);
  },
  "Choirsteel: every piece is a real foe-facing name": () => assert(Object.keys(TOLD).length === 7 && MOBS),
});
