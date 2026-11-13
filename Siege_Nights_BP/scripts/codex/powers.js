// What the Codex gear does: the regional sets and their lock, the Oathsworn Harness, the weapons, the mythical
// weapons and tools, the boss and champion drops, the thin-place charms and the caravan goods.
// Item list and words: items_data.js (studio/build_codex.py). The lock's numbers: rules.js.

import { world, system, EquipmentSlot, ItemStack } from "@minecraft/server";
import { onTick, isNight, keepOf, nextSiegeDay, addFilter, RAIDER_TAG } from "../siege/api.js";
import { sfx } from "../core/sfx.js";
import { pay } from "../economy/coins.js";
import { ITEM, CODEX, PENALTY, mayWear, penaltyStage, setCount } from "./rules.js";
import { store, homeRegion, gearOf, mainOf, effect, hurt, heal, particle, isCreative, give, valid, players, bearing } from "./state.js";

const H = EquipmentSlot.Head, C = EquipmentSlot.Chest, L = EquipmentSlot.Legs, F = EquipmentSlot.Feet, M = EquipmentSlot.Mainhand, O = EquipmentSlot.Offhand;
const ARMOUR = [H, C, L, F];
const now = () => system.currentTick;
const cool = new Map(); // "player|what" -> tick it may happen again
function ready(p, what, ticks) {
  const k = `${p.id}|${what}`;
  if ((cool.get(k) ?? 0) > now()) return false;
  cool.set(k, now() + ticks);
  return true;
}
const isPlayer = (e) => e?.typeId === "minecraft:player";
const hostile = (e) => {
  try { return e.matches({ families: ["monster"] }); } catch { return false; }
};
const fromBeyond = (e) => hostile(e) && String(e.typeId).startsWith("siege:"); // creatures that don't belong in this world
const blockAt = (dim, l) => {
  try { return dim.getBlock({ x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) }); } catch { return undefined; }
};
const inWater = (p) => {
  try { return !!p.isInWater; } catch { return false; }
};
const raining = (p) => {
  try { return p.dimension.getWeather?.() !== "Clear"; } catch { return false; }
};
const daylight = () => {
  const t = world.getTimeOfDay();
  return t < 12000 || t > 23500;
};

// ---------- the lock ----------
const lockSince = new Map(); // player id -> tick they first wore gear that isn't theirs
function lockTick(p, gear) {
  if (isCreative(p)) return lockSince.delete(p.id);
  const home = homeRegion(p.id);
  let bad;
  for (const s of [...ARMOUR, M]) {
    const r = ITEM[gear[s]]?.region;
    if (r && !mayWear(r, home, store.data.writs, p.id)) { bad = r; break; }
  }
  if (!bad) return lockSince.delete(p.id);
  if (!lockSince.has(p.id)) lockSince.set(p.id, now());
  const secs = (now() - lockSince.get(p.id)) / 20;
  const pen = PENALTY[bad];
  const stage = penaltyStage(secs);
  if (stage === 0) p.onScreenDisplay.setActionBar(`§b${pen.says}§7 Take it off, or get a ${bad} Kin-Writ (${Math.ceil(CODEX.warnSeconds - secs)}s).`);
  else {
    effect(p, pen.slow, 60, stage === 2 ? 1 : 0);
    p.onScreenDisplay.setActionBar(`§c${pen.name}.§7 This gear belongs to ${bad}.`);
    if (stage === 2 && ready(p, "lockhurt", CODEX.hurtEvery * 20)) hurt(p, 2, pen.hurt);
  }
}

// ---------- worn and held, once a second ----------
const glowing = new Map(); // entity id -> { e, until } (a marker over a "glowing" target)
export function markGlow(e, ticks) { glowing.set(e.id, { e, until: now() + ticks }); }

function wornTick() {
  for (const p of players()) {
    const gear = gearOf(p);
    lockTick(p, gear);
    const worn = ARMOUR.map((s) => gear[s]).filter(Boolean);
    const count = (set) => setCount(worn, set);
    const main = gear[M], off = gear[O];
    const under = blockAt(p.dimension, { x: p.location.x, y: p.location.y - 0.5, z: p.location.z })?.typeId ?? "";
    // Rimeforged: full set walks on water as frost
    if (count("rimeforged") === 4) frostWalk(p);
    // Watchward: sneak to mark hostiles within 24 blocks
    if (count("watchward") > 0 && p.isSneaking) {
      for (const e of p.dimension.getEntities({ location: p.location, maxDistance: 24, families: ["monster"] })) markGlow(e, 30);
    }
    // Tidewrought
    if (count("tidewrought") > 0 && inWater(p)) effect(p, "conduit_power", 60);
    if (gear[H] === "siege:tidewrought_helmet") effect(p, "water_breathing", 60);
    if (count("tidewrought") === 4 && (inWater(p) || raining(p))) effect(p, "regeneration", 60);
    // Sunscale
    if (count("sunscale") > 0 && /sand/.test(under)) effect(p, "speed", 30, 0);
    if (count("sunscale") === 4) {
      effect(p, "fire_resistance", 60);
      try {
        const mount = p.getComponent("riding")?.entityRidingOn;
        if (mount && /dragon/.test(mount.typeId)) effect(mount, "speed", 40, 1);
      } catch { /* not riding */ }
    }
    // Fenlight
    if (count("fenlight") > 0) {
      try { p.removeEffect("poison"); } catch { /* none */ }
      if (/mud|mangrove_roots|water/.test(under) || inWater(p)) effect(p, "speed", 30, 0);
    }
    if (count("fenlight") === 4) {
      let light = 15;
      try { light = p.dimension.getLightLevel?.(p.location) ?? 15; } catch { light = 15; }
      if (light < 7 || isNight()) effect(p, "night_vision", 260);
      if (isNight() && p.isSneaking) effect(p, "invisibility", 30);
    }
    // Oathsworn: four pieces are as strong as netherite
    const oath = count("oathsworn") + (main === "siege:oathsworn_sword" ? 1 : 0);
    if (count("oathsworn") >= 4) effect(p, "resistance", 30, 0);
    oathOf.set(p.id, oath);
    // Cairn-Helm: weak raiders near you falter
    if (gear[H] === "siege:cairn_helm") {
      for (const r of p.dimension.getEntities({ location: p.location, maxDistance: 8, tags: [RAIDER_TAG] })) {
        if (r.getComponent("health")?.currentValue <= 12) { effect(r, "weakness", 40); effect(r, "slowness", 40); }
      }
    }
    // Charms and other offhand things
    if (off === "siege:chapel_clapper" && inWater(p)) effect(p, "night_vision", 260);
    if (off === "siege:founders_slag" && p.location.y < 62) effect(p, "haste", 30);
    if (off === "siege:quarry_mark" && /pickaxe|pick/.test(main ?? "")) effect(p, "haste", 30);
    if (off === "siege:saltglass_prism" && now() % 400 < 20) effect(p, "saturation", 1);
    if (off === "siege:seers_glass") {
      for (const e of p.dimension.getEntities({ location: p.location, maxDistance: 16 })) {
        if (/changeling|returned|lost_villager/.test(e.typeId)) markGlow(e, 30);
      }
    }
    // Aldric's Sickle: crops near you grow while you hold it
    if (main === "siege:aldrics_sickle") growNear(p);
    // Caravan Saddle: faster on roads
    try {
      const mount = p.getComponent("riding")?.entityRidingOn;
      if (mount?.hasTag?.("siege_caravan_saddle") && /path|gravel|cobble|brick|stone_slab/.test(under)) effect(mount, "speed", 30, 1);
      if (mount?.hasTag?.("siege_champion_barding")) { effect(mount, "jump_boost", 30, 1); effect(mount, "resistance", 30, 0); }
    } catch { /* not riding */ }
  }
  for (const [id, g] of glowing) {
    if (!valid(g.e) || g.until < now()) { glowing.delete(id); continue; }
    try { particle(g.e.dimension, "minecraft:villager_happy", { x: g.e.location.x, y: g.e.location.y + 2.2, z: g.e.location.z }); } catch { glowing.delete(id); }
  }
}
const oathOf = new Map(); // player id -> Oathsworn pieces (sword counts) as of the last second

function frostWalk(p) {
  const dim = p.dimension, y = Math.floor(p.location.y) - 1;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    if (dx * dx + dz * dz > 5) continue;
    const b = blockAt(dim, { x: p.location.x + dx, y, z: p.location.z + dz });
    try {
      if (b?.typeId === "minecraft:water" && b.permutation.getState("liquid_depth") === 0 && b.above()?.isAir) b.setType("minecraft:frosted_ice");
    } catch { /* unloaded */ }
  }
}
function growNear(p) {
  const dim = p.dimension;
  for (let i = 0; i < 3; i++) {
    const b = blockAt(dim, { x: p.location.x + Math.floor(Math.random() * 9) - 4, y: p.location.y, z: p.location.z + Math.floor(Math.random() * 9) - 4 });
    try {
      const g = b?.permutation.getState("growth");
      if (typeof g === "number" && g < 7) b.setPermutation(b.permutation.withState("growth", g + 1));
    } catch { /* not a crop */ }
  }
}

// ---------- hits ----------
const streak = new Map(); // player id -> { target, n } for the Cairn Axe
world.afterEvents.entityHurt.subscribe((ev) => {
  const victim = ev.hurtEntity, by = ev.damageSource.damagingEntity, cause = ev.damageSource.cause;
  try {
    if (isPlayer(by) && cause === "entityAttack" && victim !== by) onHit(by, victim, ev.damage);
    if (isPlayer(victim)) onHurt(victim, by, cause, ev.damage);
  } catch {
    // one of them is gone
  }
});

function onHit(p, v, dmg) {
  const g = gearOf(p), w = g[M], off = g[O];
  switch (w) {
    case "siege:rime_axe": effect(v, "slowness", 60, 2); particle(v.dimension, "minecraft:snowflake_particle", v.location); break;
    case "siege:watchmans_glaive":
      for (const e of p.dimension.getEntities({ location: p.location, maxDistance: 3.5, excludeTypes: ["minecraft:player", "minecraft:item"] })) {
        if (e.id !== v.id && hostile(e) && inFront(p, e)) hurt(e, Math.max(2, dmg * 0.5), "entityAttack");
      }
      break;
    case "siege:tidesteel_cutlass": if (inWater(p) || raining(p)) hurt(v, 3, "magic"); break;
    case "siege:sunbrand_sabre": try { v.setOnFire(4, true); } catch { /* fireproof */ } if (daylight()) hurt(v, 2, "magic"); break;
    case "siege:bogsilver_sickle": effect(v, "poison", 80, 0); break;
    case "siege:claimants_mace": if (p.isSneaking && ready(p, "slam", 120)) slam(p, 4, 6); break;
    case "siege:maelis_clapper":
      if (fromBeyond(v)) effect(v, "slowness", 20, 255);
      sfx(p.dimension, "block.bell.hit", p.location, { pitch: 1.4, volume: 0.6 });
      if (p.isSneaking && ready(p, "ring", 160)) slam(p, 5, 3, "block.bell.hit");
      break;
    case "siege:cairn_axe": {
      const s = streak.get(p.id);
      const n = s?.target === v.id ? Math.min(3, s.n + 1) : 0;
      streak.set(p.id, { target: v.id, n });
      if (n) hurt(v, n * 2, "magic");
      break;
    }
    case "siege:holts_debt": if ((p.getDynamicProperty("siege:codex_holt") ?? 0) >= 1000) { try { v.setOnFire(4, true); } catch { /* fireproof */ } } break;
    case "siege:sedges_thorn": effect(v, "wither", 60, 0); break;
    case "siege:eddas_mercy": hurt(v, Math.max(1, dmg / 3), "magic"); break;
    default:
  }
  if (off === "siege:lists_gauntlet") {
    try { v.applyKnockback({ x: (v.location.x - p.location.x) * 0.6, z: (v.location.z - p.location.z) * 0.6 }, 0.25); } catch { /* can't be pushed */ }
  }
}

function onHurt(p, by, cause, dmg) {
  const g = gearOf(p), worn = ARMOUR.map((s) => g[s]).filter(Boolean);
  const count = (set) => setCount(worn, set);
  // Rimeforged: no freezing; attackers are slowed; the Rime Ward after a big hit
  if (count("rimeforged") > 0 && cause === "freezing") heal(p, dmg);
  if (count("rimeforged") > 0 && by && cause === "entityAttack") effect(by, "slowness", 60, 1);
  if (count("rimeforged") === 4 && dmg >= 6 && ready(p, "rimeward", 600)) {
    effect(p, "absorption", 120, 1);
    p.onScreenDisplay.setActionBar("§bRime Ward.");
  }
  // Watchward: no knockback; the Watch
  if (count("watchward") > 0) system.run(() => { try { p.clearVelocity(); } catch { /* gone */ } });
  if (count("watchward") === 4 && ready(p, "watch", 100)) {
    for (const e of p.dimension.getEntities({ location: p.location, maxDistance: 8 })) {
      if (e.id === p.id) continue;
      try { if (e.typeId === "minecraft:player" || e.matches({ families: ["siege_guard"] })) effect(e, "resistance", 100, 0); } catch { /* gone */ }
    }
  }
  // Tidewrought: attackers near water are dragged down
  if (count("tidewrought") === 4 && by && cause === "entityAttack" && (inWater(by) || inWater(p))) effect(by, "slowness", 60, 2);
  // Sunscale: attackers catch fire
  if (count("sunscale") > 0 && by && cause === "entityAttack") { try { by.setOnFire(3, true); } catch { /* fireproof */ } }
  // Oathsworn, all five: once a day a killing blow leaves you on 1 heart
  if ((oathOf.get(p.id) ?? 0) >= 5) {
    const hp = p.getComponent("health");
    if (hp && hp.currentValue <= 2 && ready(p, "oath", 24000)) {
      hp.setCurrentValue(2);
      p.onScreenDisplay.setTitle("§6The oath holds", { subtitle: "§7once a day", fadeInDuration: 5, stayDuration: 40, fadeOutDuration: 10 });
    }
  }
  // Charms
  const off = g[O];
  if (off === "siege:barrow_coin" && by) { try { if (by.matches({ families: ["undead"] })) heal(p, dmg * 0.3); } catch { /* gone */ } }
  if (off === "siege:frostvein_shard" && cause === "fall") {
    const below = blockAt(p.dimension, { x: p.location.x, y: p.location.y - 0.5, z: p.location.z })?.typeId ?? "";
    if (/snow|ice/.test(below)) heal(p, dmg);
  }
  if (off === "siege:witchroot_knot" && p.isSneaking) system.run(() => { try { p.clearVelocity(); } catch { /* gone */ } });
}

function inFront(p, e) {
  const d = p.getViewDirection(), dx = e.location.x - p.location.x, dz = e.location.z - p.location.z;
  const len = Math.hypot(dx, dz) || 1;
  return (dx * d.x + dz * d.z) / len > 0.3;
}
function slam(p, radius, damage, sound = "random.explode") {
  sfx(p.dimension, sound, p.location, { pitch: 0.6, volume: 0.8 });
  particle(p.dimension, "minecraft:large_explosion", p.location);
  for (const e of p.dimension.getEntities({ location: p.location, maxDistance: radius, excludeTypes: ["minecraft:player", "minecraft:item"] })) {
    if (!hostile(e)) continue;
    hurt(e, damage, "entityAttack", p);
    try { e.applyKnockback({ x: (e.location.x - p.location.x) * 0.8, z: (e.location.z - p.location.z) * 0.8 }, 0.45); } catch { /* can't be pushed */ }
  }
}

// ---------- kills ----------
world.afterEvents.entityDie.subscribe((ev) => {
  const p = ev.damageSource.damagingEntity;
  if (!isPlayer(p)) return;
  try {
    const w = mainOf(p);
    if (w === "siege:usurpers_edge") {
      const n = Math.min(3, (speedStacks.get(p.id) ?? 0) + 1);
      speedStacks.set(p.id, n);
      effect(p, "speed", 200, n - 1);
      system.runTimeout(() => speedStacks.set(p.id, Math.max(0, (speedStacks.get(p.id) ?? 1) - 1)), 200);
    }
    if (w === "siege:sedges_thorn") heal(p, 4);
    if (w === "siege:holts_debt") {
      const n = (p.getDynamicProperty("siege:codex_holt") ?? 0) + 1;
      p.setDynamicProperty("siege:codex_holt", n);
      pay(p, 1, "holts_debt");
      if (n === 1000) p.onScreenDisplay.setTitle("§6Holt's Debt", { subtitle: "§7is marked paid. The blade burns.", fadeInDuration: 10, stayDuration: 70, fadeOutDuration: 20 });
      else if (n % 100 === 0) p.sendMessage(`§7Holt's Debt: ${n} of 1,000 paid.`);
    }
  } catch {
    // player gone
  }
});
const speedStacks = new Map();

// ---------- arrows ----------
const homing = new Map(); // arrow id -> { a, until }
world.afterEvents.entitySpawn.subscribe((ev) => {
  const a = ev.entity;
  try {
    if (a.typeId !== "minecraft:arrow") return;
    const owner = a.getComponent("projectile")?.owner;
    if (isPlayer(owner) && mainOf(owner) === "siege:second_moon_bow") homing.set(a.id, { a, until: now() + 40 });
  } catch {
    // gone
  }
});
onTick("codex:homing", 2, () => {
  for (const [id, h] of homing) {
    if (!valid(h.a) || h.until < now()) { homing.delete(id); continue; }
    try {
      const t = h.a.dimension.getEntities({ location: h.a.location, maxDistance: 12, families: ["monster"], closest: 1 })[0];
      if (!t) continue;
      const v = h.a.getVelocity(), sp = Math.hypot(v.x, v.y, v.z) || 1;
      const dx = t.location.x - h.a.location.x, dy = t.location.y + 1 - h.a.location.y, dz = t.location.z - h.a.location.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      h.a.clearVelocity();
      h.a.applyImpulse({ x: (v.x / sp * 0.6 + dx / d * 0.4) * sp, y: (v.y / sp * 0.6 + dy / d * 0.4) * sp, z: (v.z / sp * 0.6 + dz / d * 0.4) * sp });
    } catch {
      homing.delete(id);
    }
  }
});
world.afterEvents.projectileHitEntity.subscribe((ev) => {
  const shooter = ev.source, hit = ev.getEntityHit()?.entity;
  if (!isPlayer(shooter) || !hit) return;
  try {
    const w = mainOf(shooter);
    if (w === "siege:wisp_bow") markGlow(hit, 200);
    if (w === "siege:sunscale_bow") hit.setOnFire(5, true);
    if (w === "siege:watch_crossbow") {
      const v = ev.projectile?.getVelocity?.() ?? { x: 0, y: 0, z: 0 };
      const sp = Math.hypot(v.x, v.z) || 1;
      const behind = { x: hit.location.x + (v.x / sp) * 2, y: hit.location.y, z: hit.location.z + (v.z / sp) * 2 };
      const next = hit.dimension.getEntities({ location: behind, maxDistance: 2.5, families: ["monster"] }).find((e) => e.id !== hit.id);
      if (next) hurt(next, 6, "projectile", shooter);
    }
  } catch {
    // gone
  }
});
world.afterEvents.projectileHitBlock.subscribe((ev) => {
  const shooter = ev.source;
  if (!isPlayer(shooter) || mainOf(shooter) !== "siege:sunscale_bow") return;
  try {
    const b = ev.getBlockHit().block.above();
    if (b?.isAir) b.setType("minecraft:fire");
  } catch {
    // unloaded
  }
});

// ---------- using things ----------
world.afterEvents.itemUse.subscribe((ev) => {
  const p = ev.source, id = ev.itemStack?.typeId;
  if (!isPlayer(p) || !id?.startsWith("siege:")) return;
  try { use(p, id); } catch (e) { console.warn(`[Codex] ${id}: ${e}`); }
});

function strike(p, range, damage, after) {
  const hits = p.getEntitiesFromViewDirection({ maxDistance: range }).map((h) => h.entity).filter((e) => e.typeId !== "minecraft:item");
  const head = p.getHeadLocation(), d = p.getViewDirection();
  for (let i = 1; i <= Math.min(range, 16); i += 1.5) particle(p.dimension, "minecraft:basic_crit_particle", { x: head.x + d.x * i, y: head.y + d.y * i, z: head.z + d.z * i });
  sfx(p.dimension, "item.trident.throw", p.location, { volume: 0.8 });
  const t = hits[0];
  if (!t) return false;
  hurt(t, damage, "entityAttack", p);
  after?.(t);
  return true;
}

function use(p, id) {
  switch (id) {
    case "siege:rime_spear": return strike(p, 16, 7, (t) => effect(t, "slowness", 40, 255));
    case "siege:lighthouse_harpoon": return strike(p, 16, 7, (t) => markGlow(t, 200));
    case "siege:cairn_axe": return strike(p, 12, 8);
    case "siege:ysolts_lance": {
      const mount = p.getComponent("riding")?.entityRidingOn;
      if (mount && /dragon/.test(mount.typeId)) {
        if (!ready(p, "dive", 100)) return;
        const below = { x: p.location.x, y: p.location.y - 6, z: p.location.z };
        for (const e of p.dimension.getEntities({ location: below, maxDistance: 7, families: ["monster"] })) hurt(e, 10, "entityAttack", p);
        particle(p.dimension, "minecraft:huge_explosion_emitter", below);
        sfx(p.dimension, "mob.enderdragon.flap", p.location);
        return;
      }
      return strike(p, 6, 8);
    }
    case "siege:corvins_lodestone": return pointToNearest(p);
    case "siege:wayfarers_compass": {
      const k = keepOf(p.id);
      if (!k) return p.sendMessage("§7The needle wanders. You have no keep for it to find.");
      const b = bearing(p.location, k);
      return p.onScreenDisplay.setActionBar(`§6Home: §f${b.dir}, ${b.dist} blocks`);
    }
    case "siege:sandglass_of_nights": {
      const left = Math.max(0, nextSiegeDay() - world.getDay());
      return p.onScreenDisplay.setActionBar(left === 0 ? "§cThe sand has run out. Tonight is a third night." : `§6The next third night: §f${left} day${left === 1 ? "" : "s"}`);
    }
    case "siege:map_of_lost_things": return pointToNearest(p, { charmsOnly: true, consume: true });
    case "siege:mirage_flask":
      effect(p, "invisibility", 100);
      sfx(p, "mob.evocation_illager.cast_spell");
      return consumeOne(p, id);
    case "siege:wennas_line": return cast(p);
    default:
  }
}

export function consumeOne(p, id) {
  if (isCreative(p)) return;
  try {
    const inv = p.getComponent("inventory").container;
    const slot = p.selectedSlotIndex;
    const s = inv.getItem(slot);
    if (s?.typeId !== id) return;
    if (s.amount > 1) { s.amount -= 1; inv.setItem(slot, s); } else inv.setItem(slot);
  } catch {
    // gone
  }
}

// Corvin's Lodestone and the Map of Lost Things: the finds module answers where things are
let findSpots = () => [];
export const setFindSpots = (fn) => { findSpots = fn; };
function pointToNearest(p, { charmsOnly = false, consume = false } = {}) {
  const list = findSpots(p).filter((s) => !charmsOnly || s.charm);
  if (!list.length) return p.onScreenDisplay.setActionBar("§7It points nowhere. There is nothing left it knows of.");
  list.sort((a, b) => Math.hypot(a.x - p.location.x, a.z - p.location.z) - Math.hypot(b.x - p.location.x, b.z - p.location.z));
  const s = list[0], b = bearing(p.location, s);
  if (consume) {
    p.sendMessage(`§6The map marks a spot: §f${s.place}§7, near ${Math.round(s.x)}, ${Math.round(s.z)} (${b.dir}, ${b.dist} blocks).`);
    return consumeOne(p, "siege:map_of_lost_things");
  }
  p.onScreenDisplay.setActionBar(`§dSomething you haven't found: §f${b.dir}, ${b.dist} blocks`);
}

// Wenna's Line: cast at water and something comes up
const CATCH = [["siege:coin", 6, 40], ["siege:gold_coin", 1, 8], ["minecraft:nautilus_shell", 1, 8], ["minecraft:name_tag", 1, 6], ["minecraft:bottle_o_enchanting", 3, 12], ["siege:drowned_pearl", 1, 10], ["minecraft:cod", 2, 16]];
function cast(p) {
  const b = p.getBlockFromViewDirection({ maxDistance: 8, includeLiquidBlocks: true })?.block;
  if (!b || !/water/.test(b.typeId)) return p.onScreenDisplay.setActionBar("§7Cast it at water.");
  if (!ready(p, "rod", 100)) return;
  sfx(p.dimension, "random.splash", b.location);
  p.onScreenDisplay.setActionBar("§7The line goes down further than the water is deep...");
  system.runTimeout(() => {
    if (!valid(p)) return;
    let r = Math.random() * CATCH.reduce((a, c) => a + c[2], 0);
    const [item, n] = CATCH.find((c) => (r -= c[2]) < 0) ?? CATCH[0];
    give(p, item, n);
    sfx(p, "random.pop");
    p.onScreenDisplay.setActionBar("§bSomething from somewhere else comes up on the line.");
  }, 60 + Math.floor(Math.random() * 80));
}

// Food
world.afterEvents.itemCompleteUse.subscribe((ev) => {
  const p = ev.source, id = ev.itemStack?.typeId;
  if (!isPlayer(p)) return;
  if (id === "siege:ember_tea") effect(p, "fire_resistance", 3600);
  if (id === "siege:caravan_rations") effect(p, "saturation", 2400 / 20);
  // Hex Lantern: potions last half as long again
  if (id === "minecraft:potion" && gearOf(p)[O] === "siege:hex_lantern") {
    system.runTimeout(() => {
      try {
        for (const e of p.getEffects()) p.addEffect(e.typeId, Math.round(e.duration * 1.5), { amplifier: e.amplifier, showParticles: true });
      } catch { /* gone */ }
    }, 2);
  }
});

// Using on blocks: Aldric's Sickle tills 3x3; Far-Coast Seeds
world.afterEvents.itemUseOn?.subscribe?.((ev) => {
  const p = ev.source, id = ev.itemStack?.typeId, b = ev.block;
  if (!isPlayer(p) || !b) return;
  try {
    if (id === "siege:aldrics_sickle" && /dirt|grass_block/.test(b.typeId)) {
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const n = b.offset({ x: dx, y: 0, z: dz });
        if (n && /^minecraft:(dirt|grass_block)$/.test(n.typeId) && n.above()?.isAir) n.setType("minecraft:farmland");
      }
    }
  } catch {
    // unloaded
  }
});
world.afterEvents.playerPlaceBlock.subscribe((ev) => {
  const p = ev.player, b = ev.block;
  try {
    if (b.typeId === "minecraft:melon_stem" && lastHeld.get(p.id) === "siege:far_coast_seeds") {
      b.setPermutation(b.permutation.withState("growth", 7));
      for (const o of [{ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }]) {
        const n = b.offset(o);
        if (n?.isAir) { n.setType("minecraft:melon_block"); break; }
      }
    }
    if (b.typeId === "minecraft:campfire" && lastHeld.get(p.id) === "siege:hatching_brazier") {
      store.data.braziers.push(`${b.location.x},${b.location.y},${b.location.z}`);
      store.data.braziers = store.data.braziers.slice(-64);
      store.save();
      p.sendMessage("§6The Hatching Brazier is lit.§7 A dragon egg warming on a Roost within 3 blocks hatches twice as fast.");
    }
  } catch {
    // unloaded
  }
});
// what a player held a moment ago (playerPlaceBlock doesn't say which item placed the block)
const lastHeld = new Map();
world.beforeEvents.itemUseOn?.subscribe?.((ev) => { try { lastHeld.set(ev.source.id, ev.itemStack?.typeId); } catch { /* gone */ } });
addFilter("dragonHatchDays", (days, { roost }) => {
  if (!roost) return days;
  const near = (store.data.braziers ?? []).some((k) => {
    const [x, y, z] = k.split(",").map(Number);
    return Math.abs(x - roost.x) <= 3 && Math.abs(y - roost.y) <= 2 && Math.abs(z - roost.z) <= 3;
  });
  return near ? days / 2 : days;
});

// Things used on creatures: barding, the caravan saddle, the desert rose
world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
  const p = ev.player, t = ev.target, id = ev.itemStack?.typeId;
  if (!["siege:fair_champions_barding", "siege:caravan_saddle", "siege:desert_rose"].includes(id)) return;
  ev.cancel = true;
  system.run(() => {
    try {
      if (id === "siege:desert_rose") {
        if (!/npc|villager|townsfolk|settler/.test(t.typeId)) return p.onScreenDisplay.setActionBar("§7Give it to a townsperson.");
        t.addTag?.(`siege_rose_from_${p.id}`);
        particle(t.dimension, "minecraft:heart_particle", { x: t.location.x, y: t.location.y + 2, z: t.location.z });
        p.sendMessage(`§d${t.nameTag || "They"} smell${t.nameTag ? "s" : ""} the rose and smile${t.nameTag ? "s" : ""}. You have a friend here.`);
        return consumeOne(p, id);
      }
      if (!/horse|donkey|mule|camel/.test(t.typeId)) return p.onScreenDisplay.setActionBar("§7Use it on a horse.");
      const tag = id === "siege:caravan_saddle" ? "siege_caravan_saddle" : "siege_champion_barding";
      if (t.hasTag(tag)) return p.onScreenDisplay.setActionBar("§7It already wears that.");
      t.addTag(tag);
      if (tag === "siege_champion_barding") { try { t.runCommand("replaceitem entity @s slot.armor.chest 0 diamond_horse_armor"); } catch { /* no armour slot */ } }
      sfx(p, "armor.equip_diamond");
      p.sendMessage(tag === "siege_caravan_saddle" ? "§6Fitted the Caravan Saddle.§7 Your horse runs faster on roads." : "§6Fitted Fair Champion's Barding.§7 Your horse jumps higher and shrugs off blows.");
      consumeOne(p, id);
    } catch {
      // gone
    }
  });
});

// ---------- digging ----------
const SMELT = { "minecraft:iron_ore": "minecraft:iron_ingot", "minecraft:deepslate_iron_ore": "minecraft:iron_ingot", "minecraft:gold_ore": "minecraft:gold_ingot",
  "minecraft:deepslate_gold_ore": "minecraft:gold_ingot", "minecraft:copper_ore": "minecraft:copper_ingot", "minecraft:deepslate_copper_ore": "minecraft:copper_ingot" };
const DIGGABLE = /stone|deepslate|andesite|diorite|granite|tuff|_ore|netherrack|dirt|gravel|sand|clay|grass_block|snow/;
world.afterEvents.playerBreakBlock.subscribe((ev) => {
  const p = ev.player, id = ev.itemStackBeforeBreak?.typeId;
  if (id !== "siege:hrodas_pick" && id !== "siege:sextons_spade") return;
  try {
    const at = ev.block.location, dim = ev.dimension;
    const d = p.getViewDirection();
    const offs = [];
    if (id === "siege:sextons_spade") offs.push({ x: 0, y: -1, z: 0 }, { x: 0, y: -2, z: 0 });
    else {
      const axis = Math.abs(d.y) > 0.7 ? "y" : Math.abs(d.x) > Math.abs(d.z) ? "x" : "z";
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        if (!a && !b) continue;
        offs.push(axis === "y" ? { x: a, y: 0, z: b } : axis === "x" ? { x: 0, y: a, z: b } : { x: a, y: b, z: 0 });
      }
    }
    for (const o of offs) {
      const b = dim.getBlock({ x: at.x + o.x, y: at.y + o.y, z: at.z + o.z });
      if (!b || !DIGGABLE.test(b.typeId) || /bedrock|barrier|siege:/.test(b.typeId)) continue;
      const smelted = id === "siege:hrodas_pick" ? SMELT[b.typeId] : undefined;
      if (smelted) { b.setType("minecraft:air"); dim.spawnItem(new ItemStack(smelted, 1), b.center()); }
      else dim.runCommand(`setblock ${b.location.x} ${b.location.y} ${b.location.z} air destroy`);
    }
    if (id === "siege:sextons_spade" && Math.random() < 0.05) {
      const n = 1 + Math.floor(Math.random() * 3);
      pay(p, n, "sextons_spade");
      p.onScreenDisplay.setActionBar(`§6The spade turns up an old coin. §7(+${n} Regal${n === 1 ? "" : "s"})`);
    }
  } catch {
    // unloaded
  }
});

// ---------- money ----------
addFilter("payAmount", (amount, { player, reason }) => {
  if (reason === "siege" && player && gearOf(player)[O] === "siege:lords_signet") return Math.floor(amount * 1.1);
  return amount;
});
addFilter("chargeAmount", (amount, { player, reason }) => {
  if (reason === "permit" && player && gearOf(player)[O] === "siege:regents_seal_ring") return Math.ceil(amount / 2);
  return amount;
});

onTick("codex:worn", 20, wornTick);
