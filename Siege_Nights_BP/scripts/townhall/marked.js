// The Marked path: powers of the Arcana branch, and Resonance.
//
// Use the Bound Ember to open the magic hotbar (spellbar.js); each spell icon there casts its power.
// Every cast raises Resonance (0-100). It fades when you stop casting. At 70+ you are "loud":
// the tag siege_resonant is on you (Hollow mobs hunt it, people notice it). At 100 it breaks over you.

import { world, system, EntityDamageCause, EquipmentSlot } from "@minecraft/server";
import * as api from "../siege/api.js";
import { SKILL } from "./skills.js";
import { heroOf, saveHero } from "./hero.js";
import { BOUND_EMBER, EMBER, confirmPath } from "./tree.js";
import { heldType } from "./progress.js";
import { sfx } from "../core/sfx.js";
import { castFx, castMove, puff, beads, ring, smoulder, spawnFx, removeFx, moveFx, playFx, setFxCount, yawToward, markStage, ARC_FX } from "./marked_fx.js";
import { addTests, assertEqual } from "../core/tests.js";

export const RESONANT_TAG = "siege_resonant";
export const ECHO_TAG = "siege_echo_sight";
export const LOUD = 70;

export const isMarkedPlayer = (player) => heroOf(player).path === "marked";
const fx = (entity, effect, ticks, amplifier = 0) => {
  try {
    entity.addEffect(effect, ticks, { amplifier, showParticles: false });
  } catch {
    // gone
  }
};

//                 Resonance cost, cooldown ticks
const COST = { arc_bolt: [8, 16], arc_ward: [15, 400], arc_blink: [12, 80], arc_echo: [10, 100], arc_bind: [14, 200], arc_step: [20, 600], arc_choir: [30, 1200], arc_hollowstep: [40, 1200] };

const cooldowns = new Map(); // "playerId:power" -> ready tick
const lastCast = new Map(); // player id -> tick
const silenced = new Map(); // player id -> tick the backlash ends
const crescendo = new Map(); // player id -> tick the Crescendo ends
const echo = new Map(); // player id -> { until, range }
const choirs = []; // { owner, dim, at, radius, until, bell, tolls }
const wards = new Map(); // player id -> { shield, max, fx, until, shown }
const binds = new Map(); // creature id -> { target, fx, until, total, shown }
const steps = new Map(); // player id -> { until, satchel }
const channels = new Map(); // player id -> { hurt } while Veilstep opens
const charged = new Map(); // "playerId:power" -> Resonance paid, for a refund if a channel fails
const marks = new Map(); // player id -> Marked layer stage last sent

const friendly = (player, entity) =>
  entity.id === player.id || entity.typeId === "minecraft:player" || api.isGuard(entity) || entity.typeId === api.KEEP_HEART || /villager|golem|horse|wolf|cat|quartermaster|item|xp_orb|arrow|armor_stand|arc_fx|spell_satchel/.test(entity.typeId);
const isBoss = (entity) => {
  try {
    return entity.hasTag("siege_boss") || entity.hasTag(api.WARLORD_TAG) || (entity.getComponent("minecraft:health")?.effectiveMax ?? 0) >= 150;
  } catch {
    return false;
  }
};

// Powers hit harder while you are loud, if you have Resonant Soul
function might(player) {
  const hero = heroOf(player);
  return hero.resonance >= LOUD ? 1 + 0.25 * (hero.skills.arc_resonant ?? 0) : 1;
}

function lookedAt(player, range) {
  try {
    for (const hit of player.getEntitiesFromViewDirection({ maxDistance: range })) {
      if (hit.entity && hit.entity.id !== player.id && hit.entity.typeId !== ARC_FX && hit.entity.getComponent("minecraft:health")) return hit.entity;
    }
  } catch {
    // nothing in view
  }
  return undefined;
}

const eye = (player) => ({ x: player.location.x, y: player.location.y + 1.5, z: player.location.z });

function hurt(player, target, amount) {
  try {
    target.applyDamage(amount, { cause: EntityDamageCause.magic, damagingEntity: player });
  } catch {
    // died first
  }
}

// ---------- the powers ----------
// Each returns false if nothing happened (no cost, no cooldown). The proposed designs from the Ember Spellbook
// review (2026-11-14): every power leaves something you can see for as long as it lasts.

const centre = (e) => ({ x: e.location.x, y: e.location.y + 1, z: e.location.z });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const flatYaw = (player) => player.getRotation().y;
const SATCHEL = "siege:spell_satchel";

function shove(from, entity, strength, up = 0.15) {
  const dx = entity.location.x - from.x, dz = entity.location.z - from.z;
  const len = Math.hypot(dx, dz) || 1;
  try {
    entity.applyKnockback({ x: (dx / len) * strength, z: (dz / len) * strength }, up);
  } catch {
    // can't be pushed
  }
}

/** A soft push wave: creatures within `radius` blocks are pushed back, no damage (a broken Ward, a Halfstep ending). */
function pushWave(player, radius, strength) {
  const at = player.location;
  ring(player.dimension, at, radius);
  sfx(player.dimension, "cast.push", at);
  for (const e of player.dimension.getEntities({ location: at, maxDistance: radius })) {
    if (!friendly(player, e) && e.getComponent("minecraft:health")) shove(at, e, strength);
  }
}

// ---- Ember Bolt: a shard you see fly (about 40 blocks a second), a brand on what it hits
function boltLands(player, dim, at, target, dmg, lvl) {
  puff(dim, "siege:arc_burst", at);
  if (!target?.isValid || dist(at, centre(target)) > 2.5) return;
  sfx(dim, "cast.hit", at);
  let hit = dmg;
  if (binds.has(target.id)) {
    hit *= 1.4; // Bind sets up Bolt: the shard breaks the chains for more
    endBind(target.id, true);
  }
  hurt(player, target, hit);
  puff(dim, "siege:arc_brand", centre(target));
  if (player.isValid) shove(player.location, target, 0.4, 0.1);
  if (lvl >= 3) paleburn(player, target);
  if (player.isValid && heroOf(player).skills.arc_crownless) {
    let from2 = at;
    let jumps = 0;
    for (const e of dim.getEntities({ location: at, maxDistance: 6 })) {
      if (jumps >= 2) break;
      if (e.id === target.id || friendly(player, e) || !e.getComponent("minecraft:health")) continue;
      const to = centre(e);
      beads(dim, from2, to, "siege:arc_streak", 0.3);
      puff(dim, "siege:arc_brand", to);
      hurt(player, e, dmg * 0.6);
      from2 = to;
      jumps++;
    }
  }
}

// Level 3: cold white-violet flames for 3 s, 1 a second; never spreads, never lights a block
function paleburn(player, target) {
  for (let s = 0; s < 3; s++) {
    system.runTimeout(() => {
      if (!target.isValid) return;
      puff(target.dimension, "siege:arc_paleburn", target.location);
      hurt(player, target, 1);
    }, s * 20 + 10);
  }
  puff(target.dimension, "siege:arc_paleburn", target.location);
}

function launchBolt(player, target, end, dmg, lvl) {
  if (!player.isValid) return;
  const dim = player.dimension;
  const v = player.getViewDirection();
  let pos = { x: player.location.x + v.x * 0.7, y: player.location.y + 1.45 + v.y * 0.7, z: player.location.z + v.z * 0.7 };
  const shard = spawnFx(dim, "shard", pos, { yaw: yawToward(pos, end), life: 30 });
  let ticks = 0;
  const run = system.runInterval(() => {
    ticks++;
    const goal = target?.isValid ? centre(target) : end;
    const d = dist(pos, goal);
    if (d <= 2 || ticks > 16) {
      system.clearRun(run);
      removeFx(shard);
      return boltLands(player, dim, d <= 2 ? goal : pos, target, dmg, lvl);
    }
    const next = { x: pos.x + ((goal.x - pos.x) / d) * 2, y: pos.y + ((goal.y - pos.y) / d) * 2, z: pos.z + ((goal.z - pos.z) / d) * 2 };
    try {
      const b = dim.getBlock(next);
      if (b && !b.isAir && !b.isLiquid && (b.isSolid ?? true)) {
        system.clearRun(run);
        removeFx(shard);
        return boltLands(player, dim, pos, undefined, dmg, lvl); // a wall stops it
      }
    } catch {
      // unloaded: fly on
    }
    beads(dim, pos, next, "siege:arc_streak", 0.5);
    moveFx(shard, next, yawToward(pos, next));
    pos = next;
  }, 1);
}

// ---- Ward: three plates circle you; one breaks for each third of the shield lost; the last one pushes
function endWard(player, broken) {
  const w = wards.get(player.id);
  if (!w) return;
  wards.delete(player.id);
  removeFx(w.fx);
  if (!player.isValid) return;
  if (broken) {
    puff(player.dimension, "siege:arc_shatter", player.location);
    sfx(player.dimension, "cast.shatter", player.location);
    try {
      player.removeEffect("absorption");
    } catch {
      // already gone
    }
    pushWave(player, 2.5, 1.2);
  }
}

// ---- Bind: chains rise and wrap the creature; the loops are the timer
function endBind(id, broken) {
  const b = binds.get(id);
  if (!b) return;
  binds.delete(id);
  removeFx(b.fx);
  if (!b.target.isValid) return;
  puff(b.target.dimension, "siege:arc_shatter", b.target.location);
  sfx(b.target.dimension, "cast.shatter", b.target.location, { volume: broken ? 1 : 0.6 });
  for (const effect of ["slowness", "weakness"]) {
    try {
      b.target.removeEffect(effect);
    } catch {
      // gone
    }
  }
}

// ---- Halfstep: armour and the held item go into a satchel for the step (Bedrock shows them on invisible players)
const GEAR = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Offhand];
const stepTag = (id) => `hc_stepsatchel_${id}`;
const heldGear = new Map(); // player id -> [items...], kept through a death with keepInventory on

function stashGear(player) {
  const eq = player.getComponent("minecraft:equippable");
  const c = player.getComponent("minecraft:inventory")?.container;
  if (!eq || !c) return undefined;
  let satchel;
  try {
    satchel = player.dimension.spawnEntity(SATCHEL, player.location);
    satchel.addTag(stepTag(player.id));
    satchel.addTag("hc_satchel");
  } catch {
    return undefined;
  }
  const bag = satchel.getComponent("minecraft:inventory").container;
  GEAR.forEach((slot, i) => {
    const item = eq.getEquipment(slot);
    if (!item) return;
    bag.setItem(i, item);
    eq.setEquipment(slot, undefined);
  });
  const sel = player.selectedSlotIndex;
  const held = c.getItem(sel);
  if (held) {
    bag.setItem(5, held);
    c.setItem(sel, undefined);
    satchel.setDynamicProperty("hc:slot", sel);
  }
  return satchel;
}

function findStepSatchel(player, range = 256) {
  try {
    return player.dimension.getEntities({ type: SATCHEL, tags: [stepTag(player.id)], location: player.location, maxDistance: range })[0];
  } catch {
    return undefined;
  }
}

function giveGear(player, items, slot) {
  const eq = player.getComponent("minecraft:equippable");
  const c = player.getComponent("minecraft:inventory")?.container;
  GEAR.forEach((s, i) => {
    const item = items[i];
    if (!item) return;
    if (!eq.getEquipment(s)) eq.setEquipment(s, item);
    else {
      const left = c.addItem(item);
      if (left) player.dimension.spawnItem(left, player.location);
    }
  });
  const held = items[5];
  if (!held) return;
  if (held.typeId.startsWith("siege:spell_") && player.getDynamicProperty("hc:spellbar") !== "open") return; // the bar shut meanwhile
  if (slot !== undefined && !c.getItem(slot)) c.setItem(slot, held);
  else {
    const left = c.addItem(held);
    if (left) player.dimension.spawnItem(left, player.location);
  }
}

function returnGear(player) {
  const satchel = findStepSatchel(player);
  if (!satchel) return false;
  const bag = satchel.getComponent("minecraft:inventory").container;
  const items = [];
  for (let i = 0; i < 6; i++) items.push(bag.getItem(i));
  for (let i = 0; i < 6; i++) bag.setItem(i, undefined);
  const slot = satchel.getDynamicProperty("hc:slot");
  try {
    satchel.remove();
  } catch {
    // gone
  }
  giveGear(player, items, slot);
  return true;
}

function endStep(player) {
  const s = steps.get(player.id);
  steps.delete(player.id);
  if (!player.isValid) return;
  returnGear(player);
  if (s) pushWave(player, 1.5, 0.8);
}

// ---- Veilstep: a 0.8 s channel, then a tear you walk into; it stays a moment at both ends
function riftAt(player, life) {
  const v = player.getViewDirection();
  const flat = Math.hypot(v.x, v.z) || 1;
  const at = { x: player.location.x + (v.x / flat) * 1.4, y: player.location.y, z: player.location.z + (v.z / flat) * 1.4 };
  const e = spawnFx(player.dimension, "rift", at, { yaw: yawToward(at, player.location) });
  if (e) {
    system.runTimeout(() => playFx(e, "animation.siege.arc_fx.rift_close"), Math.max(1, life - 6));
    system.runTimeout(() => removeFx(e), life);
  }
  puff(player.dimension, "siege:arc_rift", at);
  return e;
}

function refund(player, id) {
  const key = `${player.id}:${id}`;
  cooldowns.delete(key);
  const hero = heroOf(player);
  hero.resonance = Math.max(0, hero.resonance - (charged.get(key) ?? 0));
  charged.delete(key);
  saveHero(player);
  try {
    player.startItemCooldown(`siege_spell_${id.replace("arc_", "")}`, 1);
  } catch {
    // no sweep to reset
  }
}

const CAST = {
  arc_bolt(player, lvl) {
    const from = eye(player);
    const target = lookedAt(player, 24);
    const view = player.getViewDirection();
    let end = { x: from.x + view.x * 24, y: from.y + view.y * 24, z: from.z + view.z * 24 };
    if (target) end = centre(target);
    else {
      const wall = player.getBlockFromViewDirection({ maxDistance: 24 });
      if (wall) end = { x: wall.block.x + 0.5, y: wall.block.y + 0.5, z: wall.block.z + 0.5 };
    }
    castFx(player, "bolt", from);
    const dmg = [0, 5, 7, 10][lvl] * might(player);
    system.runTimeout(() => launchBolt(player, target, end, dmg, lvl), 2); // the draw, then the throw
    return true;
  },

  arc_ward(player, lvl) {
    const amp = Math.min(4, Math.round(lvl * might(player)) - 1);
    fx(player, "absorption", 400, amp);
    endWard(player, false);
    const shield = 4 * (amp + 1);
    wards.set(player.id, { shield, max: shield, fx: spawnFx(player.dimension, "ward", player.location, { count: 3 }), until: system.currentTick + 400, shown: 3 });
    puff(player.dimension, "siege:arc_ward", player.location);
    castFx(player, "ward");
    return true;
  },

  arc_blink(player, lvl) {
    const dim = player.dimension;
    const range = [0, 8, 12, 16][lvl];
    const view = player.getViewDirection();
    const from = { ...player.location };
    let reach = range;
    const wall = player.getBlockFromViewDirection({ maxDistance: range });
    if (wall) reach = Math.max(0, Math.hypot(wall.block.x + 0.5 - from.x, wall.block.y + 0.5 - (from.y + 1.5), wall.block.z + 0.5 - from.z) - 1.2);
    for (let d = reach; d >= 2; d -= 1) {
      const to = { x: from.x + view.x * d, y: from.y + view.y * d, z: from.z + view.z * d };
      try {
        const feet = dim.getBlock(to), head = dim.getBlock({ x: to.x, y: to.y + 1, z: to.z });
        if (!feet || !head || !feet.isAir || !head.isAir) continue;
      } catch {
        continue;
      }
      castMove(player, "blink"); // the lean comes first now, so others can read it
      const yaw = flatYaw(player);
      system.runTimeout(() => {
        if (!player.isValid) return;
        spawnFx(dim, "ghost", from, { yaw, life: 24 }); // your afterimage cracks away where you stood
        puff(dim, "siege:arc_tear", from);
        beads(dim, { x: from.x, y: from.y + 1.2, z: from.z }, { x: to.x, y: to.y + 1.2, z: to.z }, "siege:arc_streak", 0.35);
        sfx(dim, "cast.blink", from);
        player.teleport(to, { keepVelocity: false, checkForBlocks: false });
        fx(player, "slow_falling", 30, 0);
        puff(dim, "siege:arc_tear", to);
      }, 2);
      return true;
    }
    player.onScreenDisplay.setActionBar("§7No room to step there.");
    return false;
  },

  arc_echo(player, lvl) {
    const ticks = [0, 200, 300, 400][lvl];
    const range = [0, 24, 32, 40][lvl];
    echo.set(player.id, { until: system.currentTick + ticks, range, next: system.currentTick });
    player.addTag(ECHO_TAG);
    fx(player, "night_vision", ticks + 20, 0);
    try {
      player.runCommand("fog @s remove hc_echo"); // one layer, however often you cast it
      player.runCommand("fog @s push siege:arc_echo hc_echo"); // a dim violet fog: shapes, not daylight
    } catch {
      // older engine
    }
    castFx(player, "echo");
    return true;
  },

  arc_bind(player, lvl) {
    const target = lookedAt(player, 20);
    if (!target || friendly(player, target)) {
      player.onScreenDisplay.setActionBar("§7Look at the creature you want to bind.");
      return false;
    }
    const boss = isBoss(target);
    const ticks = Math.round([0, 60, 100, 140][lvl] * might(player) * (boss ? 0.5 : 1));
    endBind(target.id, false);
    fx(target, "slowness", ticks, 255);
    fx(target, "weakness", ticks, boss ? 1 : 255); // a bound creature can't swing either (bosses can, weakly)
    binds.set(target.id, { target, fx: spawnFx(target.dimension, "chains", target.location, { count: 3 }), until: system.currentTick + ticks, total: ticks, shown: 3 });
    beads(player.dimension, eye(player), centre(target), "siege:arc_link", 0.45);
    puff(player.dimension, "siege:arc_snare", target.location);
    castFx(player, "bind", target.location);
    return true;
  },

  arc_step(player, lvl) {
    const ticks = [0, 60, 80, 100][lvl];
    if (steps.has(player.id)) return false;
    fx(player, "invisibility", ticks, 0);
    fx(player, "resistance", ticks, 4);
    fx(player, "speed", ticks, 2);
    puff(player.dimension, "siege:arc_peel", player.location);
    castFx(player, "step");
    stashGear(player); // nothing floats: armour and the held item come back when you do
    steps.set(player.id, { until: system.currentTick + ticks });
    system.runTimeout(() => endStep(player), ticks);
    api.emit("undertowStep", { player, ticks });
    return true;
  },

  // The Undertow feature owns the journey. It listens for "hollowStep" and sets request.handled = true
  // once it has moved the player (in, or back out), or request.refused = "why" if it can't right now.
  arc_hollowstep(player) {
    if (channels.has(player.id)) return false;
    castMove(player, "hollowstep");
    sfx(player.dimension, "cast.channel", player.location);
    const rift = riftAt(player, 16 + 60);
    channels.set(player.id, { hurt: 0 });
    system.runTimeout(() => {
      const ch = channels.get(player.id);
      channels.delete(player.id);
      if (!player.isValid) return;
      const closeEarly = () => {
        playFx(rift, "animation.siege.arc_fx.rift_close");
        system.runTimeout(() => removeFx(rift), 6);
        refund(player, "arc_hollowstep");
      };
      if ((ch?.hurt ?? 0) >= 4) {
        closeEarly();
        return player.onScreenDisplay.setActionBar("§7The tear closes. You were struck before you could step through.");
      }
      const request = { player, handled: false, refused: undefined };
      const leaving = { dim: player.dimension, at: { ...player.location } };
      api.emit("hollowStep", request);
      if (!request.handled) {
        closeEarly();
        return player.onScreenDisplay.setActionBar(`§7${request.refused ?? "The Hollow does not open. Not yet."}`);
      }
      sfx(leaving.dim, "cast.hollowstep", leaving.at);
      system.runTimeout(() => {
        if (!player.isValid) return;
        riftAt(player, 60);
        sfx(player.dimension, "cast.hollowstep", player.location, { volume: 0.6 });
      }, 4);
    }, 16);
    return true;
  },

  arc_choir(player, lvl) {
    const radius = [0, 10, 14, 18][lvl];
    const raiders = player.dimension.getEntities({ tags: [api.RAIDER_TAG], location: player.location, maxDistance: radius });
    if (raiders.length < 2) {
      player.onScreenDisplay.setActionBar("§7The Call needs at least two raiders near you.");
      return false;
    }
    const ticks = Math.round([0, 120, 160, 200][lvl] * might(player));
    const at = { ...player.location };
    const bell = spawnFx(player.dimension, "bell", { x: at.x, y: at.y + 2.6, z: at.z }, { life: ticks + 10 });
    const now = system.currentTick;
    choirs.push({ owner: player.id, dim: player.dimension.id, at, radius, until: now + ticks, bell, tolls: [now + 12, now + Math.round(ticks / 2), now + ticks - 16] });
    castFx(player, "choir");
    api.title(player, "§5Choir's Call", "§7They hear the bell, and each other");
    return true;
  },
};

// Every tick: the plates follow you, the chains follow what they hold, the Crescendo's crown turns
export function markedFastTick() {
  const now = system.currentTick;
  for (const [id, w] of wards) {
    const player = world.getEntity(id);
    if (!player?.isValid || now > w.until) {
      if (player?.isValid) endWard(player, false);
      else wards.delete(id), removeFx(w.fx);
      continue;
    }
    moveFx(w.fx, player.location);
  }
  for (const [id, b] of binds) {
    if (!b.target.isValid || now > b.until) {
      endBind(id, false);
      continue;
    }
    if (now % 2 === 0) moveFx(b.fx, b.target.location);
    const left = Math.ceil((3 * (b.until - now)) / b.total);
    if (left < b.shown) {
      b.shown = left;
      setFxCount(b.fx, left);
      puff(b.target.dimension, "siege:arc_shatter", b.target.location);
      sfx(b.target.dimension, "cast.shatter", b.target.location, { volume: 0.5 });
    }
  }
  if (now % 7 === 0) {
    for (const id of steps.keys()) {
      const player = world.getEntity(id);
      if (player?.isValid) puff(player.dimension, "siege:arc_shimmer", player.location); // allies can follow you
    }
  }
  for (const [id, until] of crescendo) {
    if (now > until) continue;
    const player = world.getEntity(id);
    if (!player?.isValid) continue;
    if (now % 10 === 0) puff(player.dimension, "siege:arc_crown", { x: player.location.x, y: player.location.y + 2.25, z: player.location.z });
    if ((until - now) % 40 === 0 && until - now >= 40) castMove(player, "crescendo");
  }
  for (const c of choirs) {
    while (c.tolls.length && now >= c.tolls[0]) {
      c.tolls.shift();
      playFx(c.bell, "animation.siege.arc_fx.toll");
      try {
        const dim = world.getDimension(c.dim);
        ring(dim, c.at, c.radius); // the true size of the Call
        sfx(dim, "cast.toll", c.at);
      } catch {
        // unloaded
      }
    }
  }
}

// Ward plates break, and a Veilstep channel can be struck down
world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage }) => {
  if (hurtEntity?.typeId !== "minecraft:player") return;
  const ch = channels.get(hurtEntity.id);
  if (ch) ch.hurt += damage;
  const w = wards.get(hurtEntity.id);
  if (!w) return;
  w.shield -= damage;
  if (w.shield <= 0) return endWard(hurtEntity, true);
  const left = Math.ceil((3 * w.shield) / w.max);
  if (left < w.shown) {
    w.shown = left;
    setFxCount(w.fx, left);
    puff(hurtEntity.dimension, "siege:arc_shatter", hurtEntity.location);
    sfx(hurtEntity.dimension, "cast.shatter", hurtEntity.location);
  }
});

// Halfstep gear through a death, a log-off or a restart
world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  if (deadEntity?.typeId !== "minecraft:player") return;
  const satchel = findStepSatchel(deadEntity, 64);
  if (!satchel) return;
  try {
    const bag = satchel.getComponent("minecraft:inventory").container;
    const items = [];
    for (let i = 0; i < 6; i++) items.push(bag.getItem(i));
    for (let i = 0; i < 6; i++) bag.setItem(i, undefined);
    satchel.remove();
    steps.delete(deadEntity.id);
    if (world.gameRules?.keepInventory) heldGear.set(deadEntity.id, items);
    else for (const item of items) if (item) deadEntity.dimension.spawnItem(item, deadEntity.location);
  } catch {
    // the spawn check below tries again
  }
});

world.afterEvents.playerSpawn.subscribe(({ player }) => {
  system.runTimeout(() => {
    if (!player.isValid) return;
    const kept = heldGear.get(player.id);
    heldGear.delete(player.id);
    if (kept) giveGear(player, kept);
    else if (!steps.has(player.id)) returnGear(player);
    try {
      player.runCommand("fog @s remove hc_echo");
    } catch {
      // no fog
    }
  }, 10);
});

// ---------- the Marked layer, and Echo Sight's hidden doors ----------

// player property hc:mark: 0 not Marked, 1-5 how far the veins have climbed (RP render controller hc_marked)
function setMark(player, stage) {
  if (marks.get(player.id) === stage) return;
  marks.set(player.id, stage);
  try {
    player.setProperty("hc:mark", stage);
  } catch {
    // a pack without the property: no layer, nothing else changes
  }
}

// Doors, hatches, gates and seals hum differently from a wall (lore: Brother Fennick's notes). Scanned over
// several ticks (runJob), 12 blocks around and 5 up and down; only the caster sees the hum.
export const DOOR_BLOCK = /(_door\b|_door_|trapdoor|fence_gate|castle_gate|vault_seal|court_seal|^siege:sealed)/;
function listenForDoors(player) {
  const dim = player.dimension;
  const o = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
  system.runJob((function* () {
    let n = 0;
    for (let dx = -12; dx <= 12; dx++) {
      for (let dz = -12; dz <= 12; dz++) {
        for (let dy = -5; dy <= 5; dy++) {
          let b;
          try {
            b = dim.getBlock({ x: o.x + dx, y: o.y + dy, z: o.z + dz });
          } catch {
            b = undefined;
          }
          if (b && DOOR_BLOCK.test(b.typeId) && player.isValid) {
            try {
              player.spawnParticle("siege:arc_hum", { x: b.x + 0.5, y: b.y + 0.5, z: b.z + 0.5 });
            } catch {
              // out of range
            }
          }
          if (++n % 400 === 0) yield;
        }
      }
    }
  })());
}

// ---------- casting ----------

export function cast(player, id) {
  const hero = heroOf(player);
  const lvl = hero.skills[id] ?? 0;
  if (!lvl) {
    player.onScreenDisplay.setActionBar("§7You know no power yet. Swear one at the Tree of Oaths (Arcana).");
    return false;
  }
  const now = system.currentTick;
  if ((silenced.get(player.id) ?? 0) > now) {
    player.onScreenDisplay.setActionBar("§cThe Ember will not answer. Your head is still ringing.");
    return false;
  }
  const born = hero.skills.arc_hollowborn ?? 0;
  const key = `${player.id}:${id}`;
  const wait = (cooldowns.get(key) ?? 0) - now;
  if (wait > 0) {
    player.onScreenDisplay.setActionBar(`§7${SKILL[id].name} in ${Math.ceil(wait / 20)}s`);
    return false;
  }
  if (!CAST[id](player, lvl)) return false;
  const free = (crescendo.get(player.id) ?? 0) > now;
  cooldowns.set(key, now + Math.round(COST[id][1] * (born ? 0.7 : 1)));
  lastCast.set(player.id, now);
  charged.delete(key);
  if (!free) {
    const before = hero.resonance;
    hero.resonance = Math.min(100, hero.resonance + COST[id][0] * (born ? 0.75 : 1) * (hero.victor ? 0.75 : 1));
    charged.set(key, hero.resonance - before);
    if (hero.resonance >= 100) overflow(player, hero, born);
  }
  saveHero(player);
  return true;
}

/** Ticks until a power can be cast again (0 when ready). */
export function cooldownLeft(player, id) {
  return Math.max(0, (cooldowns.get(`${player.id}:${id}`) ?? 0) - system.currentTick);
}

function overflow(player, hero, born) {
  const now = system.currentTick;
  if (born) {
    crescendo.set(player.id, now + 200);
    api.title(player, "§5Crescendo", "§7Ten seconds. Everything is free.");
    ring(player.dimension, player.location, 6);
    sfx(player.dimension, "cast.crescendo", player.location);
    castMove(player, "crescendo"); // head back, arms open; again every 2 s, with a crown of sparks (markedFastTick)
    system.runTimeout(() => {
      if (!player.isValid) return;
      hero.resonance = 0;
      saveHero(player);
      silenced.set(player.id, system.currentTick + 200);
      fx(player, "weakness", 200, 1);
      fx(player, "slowness", 200, 0);
      player.sendMessage("§7The Crescendo breaks. You are empty, and for a moment blessedly alone.");
    }, 200);
    return;
  }
  hero.resonance = 60;
  silenced.set(player.id, now + 160);
  fx(player, "nausea", 160, 0);
  fx(player, "darkness", 100, 0);
  // "Ringing" instead of vanilla Wither (whose black hearts read as poison): the head pounds with each beat
  for (let s = 0; s < 3; s++) {
    system.runTimeout(() => {
      if (!player.isValid) return;
      try {
        player.applyDamage(1, { cause: EntityDamageCause.magic });
      } catch {
        // gone
      }
      try {
        player.runCommand("camerashake add @s 0.25 0.4 rotational");
      } catch {
        // older engine
      }
    }, 10 + s * 20);
  }
  api.title(player, "§4Overwhelmed", "§7The Choir is too loud");
  sfx(player.dimension, "cast.overwhelmed", player.location);
  castMove(player, "overwhelmed");
  api.emit("resonanceOverflow", { player });
}

world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  if (event.itemStack?.typeId !== EMBER) return; // the Bound Ember and the spell icons: spellbar.js
  const hero = heroOf(player);
  if (hero.path !== "none") return player.onScreenDisplay.setActionBar("§7It is only a cold stone to you now.");
  return confirmPath(player, "marked");
});

// ---------- every second ----------

export function markedTick() {
  const now = system.currentTick;
  for (const player of world.getPlayers()) {
    const hero = heroOf(player);
    if (hero.path !== "marked") {
      if (player.hasTag(RESONANT_TAG)) player.removeTag(RESONANT_TAG);
      setMark(player, 0);
      continue;
    }
    setMark(player, markStage(hero.resonance, (crescendo.get(player.id) ?? 0) > now));
    const s = hero.skills;

    // Resonance fades after 3 quiet seconds
    if (hero.resonance > 0 && now - (lastCast.get(player.id) ?? -999) > 60) {
      hero.resonance = Math.max(0, hero.resonance - 1.5 * (1 + 0.3 * (s.arc_quiet ?? 0)));
      if (hero.resonance === 0 || Math.round(hero.resonance) % 10 === 0) saveHero(player);
    }
    const loud = hero.resonance >= LOUD;
    if (loud !== player.hasTag(RESONANT_TAG)) {
      if (loud) {
        player.addTag(RESONANT_TAG);
        player.sendMessage("§5You are loud.§7 Things that listen for the Ember can hear you now.");
      } else player.removeTag(RESONANT_TAG);
    }
    if (loud && now % 60 < 20) {
      try {
        player.dimension.spawnParticle("siege:arc_halo", { x: player.location.x, y: player.location.y + 2.15, z: player.location.z });
      } catch {
        // optional
      }
    }

    if (s.arc_ashen) {
      fx(player, "fire_resistance", 60, 0);
      if (s.arc_ashen > 1 && hero.resonance >= 50) fx(player, "resistance", 60, 0);
    }

    // Echo Sight
    const sight = echo.get(player.id);
    if (sight) {
      if (now > sight.until) {
        echo.delete(player.id);
        player.removeTag(ECHO_TAG);
        try {
          player.runCommand("fog @s remove hc_echo");
        } catch {
          // no fog
        }
      } else {
        if (now >= sight.next) {
          // a pulse every 2 s, like a heartbeat: a ring the true size of the sense, and hidden doors hum
          sight.next = now + 40;
          ring(player.dimension, player.location, sight.range);
          sfx(player, "cast.pulse");
          listenForDoors(player);
          api.emit("echoPulse", { player, range: sight.range }); // other features can answer with their own secrets
        }
        let count = 0;
        let nearest;
        for (const e of player.dimension.getEntities({ location: player.location, maxDistance: sight.range, excludeTypes: ["minecraft:item", "minecraft:xp_orb", "minecraft:arrow"] })) {
          if (e.id === player.id || !e.getComponent("minecraft:health")) continue;
          count++;
          const d = Math.hypot(e.location.x - player.location.x, e.location.z - player.location.z);
          if (!nearest || d < nearest.d) nearest = { d, e };
          for (let h = 0; h < 3; h++) {
            try {
              player.spawnParticle("siege:arc_mark", { x: e.location.x, y: e.location.y + 0.5 + h * 0.6, z: e.location.z });
            } catch {
              break;
            }
          }
        }
        player.onScreenDisplay.setActionBar(count
          ? `§dEcho Sight:§f ${count} near, closest ${Math.round(nearest.d)} blocks (${nearest.e.typeId.split(":")[1].replace(/_/g, " ")})`
          : "§dEcho Sight:§7 nothing stirs");
        continue; // the Resonance bar yields to Echo Sight
      }
    }

    // Resonance bar while the Ember or a spell is in hand, and the Ember smoulders
    const inHand = heldType(player);
    if (inHand === BOUND_EMBER || inHand?.startsWith("siege:spell_")) {
      smoulder(player, hero.resonance);
      const full = Math.round(hero.resonance / 5);
      const color = (crescendo.get(player.id) ?? 0) > now ? "§b" : loud ? "§c" : "§d";
      player.onScreenDisplay.setActionBar(`§5${SKILL[hero.spell]?.name ?? "No power"}  ${color}${"|".repeat(full)}§8${"|".repeat(20 - full)} §7${Math.round(hero.resonance)}`);
    }
  }

  // Choir's Call: confused raiders strike each other
  for (let i = choirs.length - 1; i >= 0; i--) {
    const c = choirs[i];
    if (now > c.until) { removeFx(c.bell); choirs.splice(i, 1); continue; }
    let raiders = [];
    try {
      raiders = world.getDimension(c.dim).getEntities({ tags: [api.RAIDER_TAG], location: c.at, maxDistance: c.radius });
    } catch {
      continue;
    }
    // each raider is struck by the next one round, so it turns on that one (its hurt-by-target goal) and swings back
    raiders.forEach((raider, n) => {
      const other = raiders[(n + 1) % raiders.length];
      if (!other || other.id === raider.id) return;
      fx(raider, "slowness", 30, 0);
      try {
        raider.applyDamage(2, { cause: EntityDamageCause.entityAttack, damagingEntity: other });
        beads(raider.dimension, centre(raider), centre(other), "siege:arc_thread", 0.5);
        puff(raider.dimension, "siege:arc_note", { x: raider.location.x, y: raider.location.y + 2.3, z: raider.location.z });
      } catch {
        // gone
      }
    });
  }
}

addTests("townhall", {
  "the Marked layer climbs with Resonance and is full in a Crescendo": () => {
    assertEqual(markStage(0), 1);
    assertEqual(markStage(40), 3);
    assertEqual(markStage(99), 5);
    assertEqual(markStage(0, true), 5);
  },
  "Echo Sight hears doors, hatches, gates and seals, not walls": () => {
    for (const id of ["minecraft:oak_door", "minecraft:iron_trapdoor", "minecraft:spruce_fence_gate", "siege:vault_door_iron", "siege:castle_gate_frostmarch", "siege:vault_seal", "siege:old_oak_trapdoor"]) assertEqual(DOOR_BLOCK.test(id), true, id);
    for (const id of ["minecraft:stone", "minecraft:oak_planks", "siege:hatching_brazier", "minecraft:door_rug"]) assertEqual(DOOR_BLOCK.test(id), false, id);
  },
});
