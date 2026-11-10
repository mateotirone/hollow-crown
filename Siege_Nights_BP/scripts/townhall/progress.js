// Where skill points and Renown come from, plus the Keep and Wayfarer skills (open to everyone).

import { world, system, ItemStack, EntityDamageCause } from "@minecraft/server";
import * as api from "../siege/api.js";
import { heroOf, saveHero, grantPoints, grantRenown, playerById } from "./hero.js";
import { hallOf } from "./townhall.js";
import { EMBER, choosePath, offerVictor } from "./tree.js";
import { ROLES } from "./skills.js";
import { dropCoins } from "../economy/coins.js";
import { fromEmeralds } from "../economy/rules.js";

const rank = (player, id) => heroOf(player).skills[id] ?? 0;
const fx = (entity, effect, ticks, amplifier = 0) => {
  try {
    entity.addEffect(effect, ticks, { amplifier, showParticles: false });
  } catch {
    // entity left the world this tick
  }
};

// ---------- combat tracking (for "out of combat" skills) ----------

const lastFight = new Map(); // player id -> tick
export const inCombat = (player, ticks = 100) => system.currentTick - (lastFight.get(player.id) ?? -9999) < ticks;
const fought = (entity) => { if (entity?.typeId === "minecraft:player") lastFight.set(entity.id, system.currentTick); };

world.afterEvents.entityHurt.subscribe((event) => {
  fought(event.hurtEntity);
  fought(event.damageSource.damagingEntity);
  const player = event.hurtEntity;
  if (player?.typeId !== "minecraft:player" || !player.isValid) return;
  // Pathfinder: get fall damage back
  if (event.damageSource.cause === EntityDamageCause.fall) recover(player, event.damage, rank(player, "way_pathfinder") * 0.5);
});

// "Shrug off" skills: give back part of a hit you survived
export function recover(player, damage, fraction) {
  if (!(fraction > 0)) return;
  const health = player.getComponent("minecraft:health");
  if (!health || health.currentValue <= 0) return;
  health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + damage * fraction));
}

// ---------- points and Renown ----------

const HOSTILE = /zombie|skeleton|creeper|spider|witch|pillager|vindicator|evoker|ravager|vex|drowned|husk|stray|phantom|enderman|slime|blaze|ghast|magma|piglin|hoglin|zoglin|guardian|shulker|silverfish|endermite|warden|wither|breeze|bogged|illusioner|dragon/;

world.afterEvents.entityDie.subscribe((event) => {
  const killer = event.damageSource.damagingEntity;
  const dead = event.deadEntity;
  if (killer?.typeId !== "minecraft:player" || !dead) return;
  let type;
  try {
    type = dead.typeId;
  } catch {
    return;
  }
  if (type === "minecraft:player") return;
  const hero = heroOf(killer);
  hero.kills++;
  let max = 20;
  try {
    max = dead.getComponent("minecraft:health")?.effectiveMax ?? 20;
  } catch {
    // already gone
  }
  const custom = !type.startsWith("minecraft:"); // the bestiary thread pays for its own mobs' first kills
  const hostile = custom || HOSTILE.test(type);
  if (!hostile) return saveHero(killer);
  let raider = false;
  try {
    raider = dead.hasTag(api.RAIDER_TAG);
  } catch {
    // gone
  }
  grantRenown(killer, Math.max(2, Math.min(60, Math.round(max / 4))) + (raider ? 3 : 0), "", true);
  if (!custom && !hero.firstKills.includes(type)) {
    hero.firstKills.push(type);
    grantPoints(killer, 1, `first ${type.slice(10).replace(/_/g, " ")} slain`);
  }
  // Plunder
  const plunder = rank(killer, "keep_plunder");
  if (raider && plunder && Math.random() < plunder * 0.15) dropCoins(dead.dimension, dead.location, fromEmeralds(1), "plunder");
});

api.on("siegeReward", ({ player, threat }) => {
  const hero = heroOf(player);
  hero.siegesHeld++;
  grantPoints(player, 2, "siege held");
  grantRenown(player, 60 + (threat ?? 12) * 2, "siege held", true);
  if (hero.path === "none" && hero.ember === "none") system.runTimeout(() => dropEmber(player), 100);
});

api.on("tierUp", ({ owner, after }) => {
  const player = playerById(owner);
  if (player) {
    grantPoints(player, 2, `settlement grew into a ${after.name}`);
    grantRenown(player, 100, "", true);
  }
});

api.on("warlordSlain", ({ owner, king }) => {
  const player = playerById(owner);
  if (player) {
    grantPoints(player, king ? 5 : 2, king ? "the Warlord King fell" : "warlord slain");
    grantRenown(player, king ? 400 : 120, "", true);
  }
});

api.on("sovereignCrowned", ({ owner }) => {
  const player = playerById(owner);
  if (player) grantPoints(player, 5, "crowned Sovereign");
});

// Other features: emit("skillPoints", { player, amount, source, renown? }). player = Player or player id.
api.on("skillPoints", ({ player, amount, source, renown }) => {
  const who = typeof player === "string" ? playerById(player) : player;
  if (!who) return;
  if (amount > 0) grantPoints(who, Math.floor(amount), source ?? "");
  if (renown > 0) grantRenown(who, renown, source ?? "");
});

// Roles are earned in the story, not picked from a class menu. The story engine drives them:
//   emit("offerRole", { player, role })   an NPC offers a role; the player can then swear it at the Tree of Oaths
//   emit("grantRole", { player, role })   give the role outright (the Ember does this for "marked")
// We answer with "roleOffered", "roleChosen" ({ player, role }) or "roleRefused" ({ player, role, why }).
const who = (player) => (typeof player === "string" ? playerById(player) : player);

api.on("offerRole", ({ player, role }) => {
  const p = who(player);
  if (!p) return;
  const hero = heroOf(p);
  if (!ROLES[role]) return api.emit("roleRefused", { player: p, role, why: "unknown role" });
  if (hero.path !== "none") return api.emit("roleRefused", { player: p, role, why: "already has a role" });
  if (!hero.offers.includes(role)) hero.offers.push(role);
  saveHero(p);
  p.sendMessage(`§6A path has opened to you: ${ROLES[role].name}.§7 Swear it at the Tree of Oaths in a town hall, if you choose.`);
  api.emit("roleOffered", { player: p, role });
});

api.on("grantRole", ({ player, role }) => {
  const p = who(player);
  if (!p) return;
  if (!ROLES[role]) return api.emit("roleRefused", { player: p, role, why: "unknown role" });
  if (!choosePath(p, role)) api.emit("roleRefused", { player: p, role, why: "already has a role" });
});

// The crown feature tells us who defeated the Hollow
api.on("hollowVictor", ({ player }) => {
  const p = who(player);
  if (p) offerVictor(p);
});

api.addRewardHook(({ player, emeralds }) => Math.round(emeralds * (1 + 0.25 * rank(player, "keep_spoils"))));
api.addGuardLimitHook((owner, base) => {
  const player = playerById(owner);
  return base + (player ? rank(player, "keep_muster") : (savedSkills.get(owner)?.keep_muster ?? 0));
});
const savedSkills = new Map(); // owner id -> skills, remembered after they log off so guard slots don't shrink

// ---------- the Falling Ember ----------

export function dropEmber(player) {
  if (!player.isValid) return;
  const hero = heroOf(player);
  const keep = api.keepOf(player.id);
  const base = keep && player.dimension.id === "minecraft:overworld" ? api.keepCenter(keep) : player.location;
  const angle = Math.random() * Math.PI * 2;
  const dist = 8 + Math.random() * 10;
  let at = { x: base.x + Math.cos(angle) * dist, y: base.y + 2, z: base.z + Math.sin(angle) * dist };
  try {
    const top = player.dimension.getTopmostBlock({ x: Math.floor(at.x), z: Math.floor(at.z) });
    if (top) at = { x: top.x + 0.5, y: top.y + 1.2, z: top.z + 0.5 };
  } catch {
    at = { x: player.location.x, y: player.location.y + 1, z: player.location.z };
  }
  const dim = player.dimension;
  try {
    dim.spawnEntity("minecraft:lightning_bolt", at);
  } catch {
    // no lightning in this version: the item still falls
  }
  dim.spawnItem(new ItemStack(EMBER, 1), at);
  hero.ember = "fallen";
  saveHero(player);
  api.title(player, "§5Something fell", "§7A pale light came down near your keep");
  player.sendMessage(`§5A shard of pale fire fell from the sky near your keep§7 (around ${Math.floor(at.x)}, ${Math.floor(at.z)}). Pick it up, then use it, or carry it to the Tree of Oaths in your town hall.`);
  api.emit("emberFell", { player, location: at });
}

// ---------- Keep and Wayfarer passives ----------

function hallOrigin(player) {
  const hall = hallOf(player.id);
  if (hall && !hall.lost) return { x: hall.x + 0.5 - hall.fx, y: hall.y, z: hall.z + 0.5 - hall.fz };
  const keep = api.keepOf(player.id);
  return keep ? api.keepCenter(keep) : undefined;
}

let second = 0;

export function passiveTick() {
  second++;
  const state = api.getState();
  for (const player of world.getPlayers()) {
    const hero = heroOf(player);
    const s = hero.skills;
    savedSkills.set(player.id, s);
    const overworld = player.dimension.id === "minecraft:overworld";
    const land = overworld ? api.settlementAt(player.location) : undefined;
    const home = land === player.id;
    const fighting = inCombat(player);

    // Keep
    if (home) {
      if (s.keep_hearth && !fighting && second % [0, 6, 4, 3][s.keep_hearth] === 0) {
        const health = player.getComponent("minecraft:health");
        if (health && health.currentValue < health.effectiveMax) health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + 1));
      }
      if (s.keep_stonewright) fx(player, "haste", 60, s.keep_stonewright - 1);
      if (s.keep_rally && state.active) fx(player, "resistance", 60, 0);
    }
    const guards = guardsNear(player, s.keep_court ? 24 : 0);
    if (s.keep_court) for (const g of guards) { fx(g, "strength", 60, 1); fx(g, "regeneration", 60, 0); }

    // Wayfarer
    if (s.way_fleet && !fighting) fx(player, "speed", 60, s.way_fleet - 1);
    if (s.way_forager && second % (s.way_forager === 2 ? 15 : 30) === 0) fx(player, "saturation", 1, 0);
    if (s.way_tongue) fx(player, "village_hero", 60, s.way_tongue - 1);
    if (s.way_nighteyes && (api.isNight() || player.location.y < 45)) fx(player, "night_vision", 300, 0);
    if (s.way_tide && player.isInWater) fx(player, "conduit_power", 60, 0);
    const riding = player.getComponent("minecraft:riding")?.entityRidingOn;
    if (s.way_horse && riding) fx(riding, "speed", 60, s.way_horse - 1);
    if (s.way_roadwise && !land) {
      fx(player, "speed", 60, 1);
      fx(player, "jump_boost", 60, 0);
      if (riding && second % 10 === 0) fx(player, "saturation", 1, 0);
    }
    if (s.way_clue && second % 3 === 0 && !(s.way_mapwright && heldType(player) === "minecraft:compass")) clueSense(player);
    if (s.way_mapwright && heldType(player) === "minecraft:compass") {
      const target = hallOrigin(player);
      if (target && overworld) {
        const dx = target.x - player.location.x, dz = target.z - player.location.z;
        player.onScreenDisplay.setActionBar(`§6Town hall§f ${Math.round(Math.hypot(dx, dz))} blocks ${heading(dx, dz)}`);
      }
    }
  }

  // Siege skills that act on the keep itself
  if (state.active) for (const owner of state.besieged ?? []) keepSkills(owner);
  else surged.clear();
}

// ---------- Clue Sense (way_clue) ----------
// While you carry the Ledger of Whispers, it whispers when an unread Dusty Tome (the lore feature answers
// "clueSense") or a Lore Tome lying loose on the ground is within 16 blocks. A soft page turn the first
// time each one comes into range, a heading on the action bar while it stays close.
export const CLUE_RANGE = 16;
const LEDGER_ITEM = "siege:ledger", TOME_ITEM = "siege:lore_tome";
const sensed = new Map(); // player id -> key of the nearest thing last whispered about

export function nearestClue(at, hits) {
  let best;
  for (const h of hits) {
    const d = Math.hypot(h.x + 0.5 - at.x, h.y - at.y, h.z + 0.5 - at.z);
    if (d <= CLUE_RANGE && (!best || d < best.d)) best = { ...h, d };
  }
  return best;
}

function clueSense(player) {
  if (!api.countItem(player, LEDGER_ITEM)) return sensed.delete(player.id);
  const q = { player, radius: CLUE_RANGE, hits: [] };
  api.emit("clueSense", q);
  try {
    for (const e of player.dimension.getEntities({ type: "minecraft:item", location: player.location, maxDistance: CLUE_RANGE })) {
      if (e.getComponent("minecraft:item")?.itemStack?.typeId === TOME_ITEM) q.hits.push({ ...e.location, x: Math.floor(e.location.x), z: Math.floor(e.location.z), kind: "loose" });
    }
  } catch {
    // no loose tomes to sense
  }
  const near = nearestClue(player.location, q.hits);
  if (!near) return sensed.delete(player.id);
  const key = `${near.x},${near.y},${near.z}`;
  if (sensed.get(player.id) !== key) {
    sensed.set(player.id, key);
    player.playSound("item.book.page_turn", { volume: 0.4, pitch: 0.7 });
  }
  const dx = near.x + 0.5 - player.location.x, dz = near.z + 0.5 - player.location.z;
  const where = near.d < 3 ? "right here" : `${Math.round(near.d)} blocks ${heading(dx, dz)}`;
  player.onScreenDisplay.setActionBar(`§5Your Ledger whispers:§7 something written, ${where}`);
}

export function heldType(player) {
  return player.getComponent("minecraft:inventory")?.container?.getItem(player.selectedSlotIndex)?.typeId;
}

export function heading(dx, dz) {
  const names = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];
  return names[((Math.round(Math.atan2(dz, dx) / (Math.PI / 4)) % 8) + 8) % 8];
}

export function guardsNear(player, range) {
  if (!range) return [];
  try {
    return Object.keys(api.GUARD_TYPES).flatMap((type) => player.dimension.getEntities({ type, tags: [api.guardTag(player.id)], location: player.location, maxDistance: range }));
  } catch {
    return [];
  }
}

const surged = new Set(); // owners whose Unbreakable Keep already fired this siege

function keepSkills(owner) {
  const s = playerById(owner) ? heroOf(playerById(owner)).skills : savedSkills.get(owner);
  if (!s) return;
  const keep = api.keepOf(owner);
  if (!keep) return;
  const max = api.keepHealth(owner, keep);
  for (const heart of api.heartsOf(owner)) {
    const health = heart.getComponent("minecraft:health");
    if (!health) continue;
    const cap = Math.min(max, health.effectiveMax);
    if (s.keep_wards && second % 2 === 0 && health.currentValue < cap) health.setCurrentValue(Math.min(cap, health.currentValue + 3 * s.keep_wards));
    if (s.keep_unbreakable && !surged.has(owner) && health.currentValue < cap * 0.25) {
      surged.add(owner);
      health.setCurrentValue(cap * 0.6);
      for (const raider of heart.dimension.getEntities({ tags: [api.RAIDER_TAG], location: heart.location, maxDistance: 14 })) {
        const dx = raider.location.x - heart.location.x, dz = raider.location.z - heart.location.z;
        const d = Math.hypot(dx, dz) || 1;
        try {
          raider.applyKnockback({ x: (dx / d) * 3, z: (dz / d) * 3 }, 0.6);
          raider.applyDamage(6);
        } catch {
          // some machines can't be thrown
        }
      }
      heart.dimension.playSound("random.totem", heart.location, { volume: 2 });
      const player = playerById(owner);
      if (player) api.title(player, "§6The Keep will not break", "§7Your walls surge back to strength");
    }
  }
  // Rally the Walls, rank 2: guards get Strength
  const player = playerById(owner);
  if (player && s.keep_rally) for (const g of guardsNear(player, 64)) { fx(g, "resistance", 60, 0); if (s.keep_rally > 1) fx(g, "strength", 60, 0); }
}

// Watchfire
api.on("siegeStart", () => {
  const state = api.getState();
  const compass = ["east", "south", "west", "north"];
  for (const player of world.getPlayers()) {
    const plan = state.plans?.[player.id];
    if (!plan || !rank(player, "keep_watchfire")) continue;
    player.sendMessage(`§6Watchfire:§7 they are coming from the §f${plan.sides.map((a) => compass[Math.round(a / (Math.PI / 2)) % 4]).join(" and ")}§7.`);
  }
});

const seen = new Map(); // raider id -> first tick seen
export function watchfireTick() {
  const state = api.getState();
  if (!state.active) return seen.clear();
  for (const player of world.getPlayers()) {
    if (!rank(player, "keep_watchfire") || player.dimension.id !== "minecraft:overworld") continue;
    for (const raider of player.dimension.getEntities({ tags: [api.RAIDER_TAG, api.ownerTag(player.id)], location: player.location, maxDistance: 96 })) {
      if (!seen.has(raider.id)) seen.set(raider.id, system.currentTick);
      if (system.currentTick - seen.get(raider.id) > 400) continue;
      for (let h = 3; h <= 9; h += 2) {
        try {
          player.spawnParticle("minecraft:basic_flame_particle", { x: raider.location.x, y: raider.location.y + h, z: raider.location.z });
        } catch {
          break;
        }
      }
    }
  }
}

// The Long Road Home (sneak + use a compass)
const homeCooldown = new Map();
world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  if (event.itemStack?.typeId !== "minecraft:compass" || !player.isSneaking || !api.isReady()) return;
  if (!rank(player, "way_homeward")) return;
  const wait = (homeCooldown.get(player.id) ?? 0) - system.currentTick;
  if (wait > 0) return player.onScreenDisplay.setActionBar(`§7The road home opens again in ${Math.ceil(wait / 20)}s`);
  if (api.getState().active || inCombat(player, 200)) return player.onScreenDisplay.setActionBar("§cNot while you are fighting.");
  const target = hallOrigin(player);
  if (!target) return player.onScreenDisplay.setActionBar("§cYou have no home to return to.");
  homeCooldown.set(player.id, system.currentTick + 12000);
  player.teleport(target, { dimension: world.getDimension("overworld") });
  player.playSound("mob.endermen.portal");
});
