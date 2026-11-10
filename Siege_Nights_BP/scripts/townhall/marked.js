// The Marked path: powers of the Arcana branch, and Resonance.
//
// Hold the Bound Ember. Use = cast the chosen power. Sneak + use = choose a power.
// Every cast raises Resonance (0-100). It fades when you stop casting. At 70+ you are "loud":
// the tag siege_resonant is on you (Hollow mobs hunt it, people notice it). At 100 it breaks over you.

import { world, system, EntityDamageCause } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import * as api from "../siege/api.js";
import { SKILL, SKILLS } from "./skills.js";
import { heroOf, saveHero } from "./hero.js";
import { BOUND_EMBER, EMBER, confirmPath } from "./tree.js";
import { heldType } from "./progress.js";
import { sfx } from "../core/sfx.js";

export const RESONANT_TAG = "siege_resonant";
export const ECHO_TAG = "siege_echo_sight";
export const LOUD = 70;

const isMarked = (player) => heroOf(player).path === "marked";
const fx = (entity, effect, ticks, amplifier = 0) => {
  try {
    entity.addEffect(effect, ticks, { amplifier, showParticles: false });
  } catch {
    // gone
  }
};

const POWERS = SKILLS.filter((s) => s.power).map((s) => s.id);
//                 Resonance cost, cooldown ticks
const COST = { arc_bolt: [8, 12], arc_ward: [15, 400], arc_blink: [12, 80], arc_echo: [10, 100], arc_bind: [14, 200], arc_step: [20, 600], arc_choir: [30, 1200], arc_hollowstep: [40, 1200] };

const cooldowns = new Map(); // "playerId:power" -> ready tick
const lastCast = new Map(); // player id -> tick
const silenced = new Map(); // player id -> tick the backlash ends
const crescendo = new Map(); // player id -> tick the Crescendo ends
const echo = new Map(); // player id -> { until, range }
const choirs = []; // { owner, dim, at, radius, until }

const friendly = (player, entity) =>
  entity.id === player.id || entity.typeId === "minecraft:player" || api.isGuard(entity) || entity.typeId === api.KEEP_HEART || /villager|golem|horse|wolf|cat|quartermaster|item|xp_orb|arrow|armor_stand/.test(entity.typeId);
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

function line(dim, from, to, particle, step = 0.6) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz);
  for (let d = 1; d < len; d += step) {
    try {
      dim.spawnParticle(particle, { x: from.x + (dx / len) * d, y: from.y + (dy / len) * d, z: from.z + (dz / len) * d });
    } catch {
      return;
    }
  }
}

function lookedAt(player, range) {
  try {
    for (const hit of player.getEntitiesFromViewDirection({ maxDistance: range })) {
      if (hit.entity && hit.entity.id !== player.id && hit.entity.getComponent("minecraft:health")) return hit.entity;
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
// Each returns false if nothing happened (no cost, no cooldown).

const CAST = {
  arc_bolt(player, lvl) {
    const dim = player.dimension;
    const from = eye(player);
    const target = lookedAt(player, 24);
    const view = player.getViewDirection();
    let end = { x: from.x + view.x * 24, y: from.y + view.y * 24, z: from.z + view.z * 24 };
    if (target) end = { x: target.location.x, y: target.location.y + 1, z: target.location.z };
    else {
      const wall = player.getBlockFromViewDirection({ maxDistance: 24 });
      if (wall) end = { x: wall.block.x + 0.5, y: wall.block.y + 0.5, z: wall.block.z + 0.5 };
    }
    line(dim, from, end, "minecraft:blue_flame_particle");
    sfx(dim, "mob.blaze.shoot", from, { pitch: 1.6, volume: 0.8 });
    if (!target) return true;
    const dmg = [0, 5, 7, 10][lvl] * might(player);
    hurt(player, target, dmg);
    if (lvl >= 3) target.setOnFire?.(4, true);
    if (heroOf(player).skills.arc_crownless) {
      let from2 = end;
      let jumps = 0;
      for (const e of dim.getEntities({ location: end, maxDistance: 6 })) {
        if (jumps >= 2) break;
        if (e.id === target.id || friendly(player, e) || !e.getComponent("minecraft:health")) continue;
        const to = { x: e.location.x, y: e.location.y + 1, z: e.location.z };
        line(dim, from2, to, "minecraft:blue_flame_particle");
        hurt(player, e, dmg * 0.6);
        from2 = to;
        jumps++;
      }
    }
    return true;
  },

  arc_ward(player, lvl) {
    fx(player, "absorption", 400, Math.min(4, Math.round(lvl * might(player)) - 1));
    sfx(player.dimension, "beacon.activate", player.location, { pitch: 1.8, volume: 0.6 });
    return true;
  },

  arc_blink(player, lvl) {
    const dim = player.dimension;
    const range = [0, 8, 12, 16][lvl];
    const view = player.getViewDirection();
    const from = player.location;
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
      line(dim, eye(player), { x: to.x, y: to.y + 1, z: to.z }, "minecraft:portal_directional", 1);
      player.teleport(to, { keepVelocity: false, checkForBlocks: false });
      fx(player, "slow_falling", 30, 0);
      sfx(dim, "mob.endermen.portal", to, { pitch: 1.4, volume: 0.7 });
      return true;
    }
    player.onScreenDisplay.setActionBar("§7No room to step there.");
    return false;
  },

  arc_echo(player, lvl) {
    const ticks = [0, 200, 300, 400][lvl];
    echo.set(player.id, { until: system.currentTick + ticks, range: [0, 24, 32, 40][lvl] });
    player.addTag(ECHO_TAG);
    fx(player, "night_vision", ticks + 200, 0);
    sfx(player.dimension, "block.bell.hit", player.location, { pitch: 0.5, volume: 0.5 });
    return true;
  },

  arc_bind(player, lvl) {
    const target = lookedAt(player, 20);
    if (!target || friendly(player, target)) {
      player.onScreenDisplay.setActionBar("§7Look at the creature you want to bind.");
      return false;
    }
    const ticks = Math.round([0, 60, 100, 140][lvl] * might(player) * (isBoss(target) ? 0.5 : 1));
    fx(target, "slowness", ticks, 255);
    fx(target, "weakness", ticks, 0);
    line(player.dimension, eye(player), { x: target.location.x, y: target.location.y + 1, z: target.location.z }, "minecraft:soul_particle");
    sfx(player.dimension, "block.chain.place", target.location, { pitch: 0.6, volume: 2 });
    return true;
  },

  arc_step(player, lvl) {
    const ticks = [0, 60, 80, 100][lvl];
    fx(player, "invisibility", ticks, 0);
    fx(player, "resistance", ticks, 4);
    fx(player, "speed", ticks, 2);
    sfx(player.dimension, "portal.travel", player.location, { volume: 0.15, pitch: 2 });
    api.emit("undertowStep", { player, ticks });
    return true;
  },

  // The Undertow feature owns the journey. It listens for "hollowStep" and sets request.handled = true
  // once it has moved the player (in, or back out), or request.refused = "why" if it can't right now.
  arc_hollowstep(player) {
    const request = { player, handled: false, refused: undefined };
    api.emit("hollowStep", request);
    if (request.handled) {
      sfx(player.dimension, "portal.travel", player.location, { volume: 0.2, pitch: 0.6 });
      return true;
    }
    player.onScreenDisplay.setActionBar(`§7${request.refused ?? "The Hollow does not open. Not yet."}`);
    return false;
  },

  arc_choir(player, lvl) {
    const radius = [0, 10, 14, 18][lvl];
    const raiders = player.dimension.getEntities({ tags: [api.RAIDER_TAG], location: player.location, maxDistance: radius });
    if (raiders.length < 2) {
      player.onScreenDisplay.setActionBar("§7The Call needs at least two raiders near you.");
      return false;
    }
    choirs.push({ owner: player.id, dim: player.dimension.id, at: { ...player.location }, radius, until: system.currentTick + Math.round([0, 120, 160, 200][lvl] * might(player)) });
    sfx(player.dimension, "block.bell.hit", player.location, { pitch: 0.4, volume: 6 });
    api.title(player, "§5Choir's Call", "§7They hear the bell, and each other");
    return true;
  },
};

// ---------- casting ----------

export function cast(player, id) {
  const hero = heroOf(player);
  const lvl = hero.skills[id] ?? 0;
  if (!lvl) return player.onScreenDisplay.setActionBar("§7You know no power yet. Swear one at the Tree of Oaths (Arcana).");
  const now = system.currentTick;
  if ((silenced.get(player.id) ?? 0) > now) return player.onScreenDisplay.setActionBar("§cThe Ember will not answer. Your head is still ringing.");
  const born = hero.skills.arc_hollowborn ?? 0;
  const key = `${player.id}:${id}`;
  const wait = (cooldowns.get(key) ?? 0) - now;
  if (wait > 0) return player.onScreenDisplay.setActionBar(`§7${SKILL[id].name} in ${Math.ceil(wait / 20)}s`);
  if (!CAST[id](player, lvl)) return;
  const free = (crescendo.get(player.id) ?? 0) > now;
  cooldowns.set(key, now + Math.round(COST[id][1] * (born ? 0.7 : 1)));
  lastCast.set(player.id, now);
  if (!free) {
    hero.resonance = Math.min(100, hero.resonance + COST[id][0] * (born ? 0.75 : 1) * (hero.victor ? 0.75 : 1));
    if (hero.resonance >= 100) overflow(player, hero, born);
  }
  saveHero(player);
}

function overflow(player, hero, born) {
  const now = system.currentTick;
  if (born) {
    crescendo.set(player.id, now + 200);
    api.title(player, "§5Crescendo", "§7Ten seconds. Everything is free.");
    sfx(player.dimension, "block.bell.hit", player.location, { pitch: 1.6, volume: 4 });
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
  fx(player, "wither", 60, 0);
  api.title(player, "§4Overwhelmed", "§7The Choir is too loud");
  sfx(player.dimension, "mob.warden.sonic_boom", player.location, { volume: 0.4 });
  api.emit("resonanceOverflow", { player });
}

function powerMenu(player) {
  const hero = heroOf(player);
  const known = POWERS.filter((id) => hero.skills[id] > 0);
  if (!known.length) return player.onScreenDisplay.setActionBar("§7You know no power yet. Swear one at the Tree of Oaths (Arcana).");
  const form = new ActionFormData().title("The Ember").body(`Resonance ${Math.round(hero.resonance)}/100. Choose the power the Ember casts.`);
  for (const id of known) form.button(`${id === hero.spell ? "§5" : ""}${SKILL[id].name} ${"I".repeat(hero.skills[id])}\n§8+${COST[id][0]} Resonance`);
  form.show(player).then((r) => {
    if (r.canceled) return;
    hero.spell = known[r.selection];
    saveHero(player);
    player.onScreenDisplay.setActionBar(`§5${SKILL[hero.spell].name} readied`);
  }).catch(() => {});
}

world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  const type = event.itemStack?.typeId;
  if (type === EMBER) {
    const hero = heroOf(player);
    if (hero.path !== "none") return player.onScreenDisplay.setActionBar("§7It is only a cold stone to you now.");
    return confirmPath(player, "marked");
  }
  if (type !== BOUND_EMBER) return;
  if (!isMarked(player)) return player.onScreenDisplay.setActionBar("§7It hums, but not for you.");
  if (player.isSneaking) return powerMenu(player);
  const hero = heroOf(player);
  cast(player, hero.skills[hero.spell] ? hero.spell : POWERS.find((id) => hero.skills[id] > 0) ?? "arc_bolt");
});

// ---------- every second ----------

export function markedTick() {
  const now = system.currentTick;
  for (const player of world.getPlayers()) {
    const hero = heroOf(player);
    if (hero.path !== "marked") {
      if (player.hasTag(RESONANT_TAG)) player.removeTag(RESONANT_TAG);
      continue;
    }
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
        player.dimension.spawnParticle("minecraft:soul_particle", { x: player.location.x, y: player.location.y + 2.1, z: player.location.z });
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
      } else {
        let count = 0;
        let nearest;
        for (const e of player.dimension.getEntities({ location: player.location, maxDistance: sight.range, excludeTypes: ["minecraft:item", "minecraft:xp_orb", "minecraft:arrow"] })) {
          if (e.id === player.id || !e.getComponent("minecraft:health")) continue;
          count++;
          const d = Math.hypot(e.location.x - player.location.x, e.location.z - player.location.z);
          if (!nearest || d < nearest.d) nearest = { d, e };
          for (let h = 0; h < 3; h++) {
            try {
              player.spawnParticle("minecraft:endrod", { x: e.location.x, y: e.location.y + 0.5 + h * 0.6, z: e.location.z });
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

    // Resonance bar while the Ember is in hand
    if (heldType(player) === BOUND_EMBER) {
      const full = Math.round(hero.resonance / 5);
      const color = (crescendo.get(player.id) ?? 0) > now ? "§b" : loud ? "§c" : "§d";
      player.onScreenDisplay.setActionBar(`§5${SKILL[hero.spell]?.name ?? "No power"}  ${color}${"|".repeat(full)}§8${"|".repeat(20 - full)} §7${Math.round(hero.resonance)}`);
    }
  }

  // Choir's Call: confused raiders strike each other
  for (let i = choirs.length - 1; i >= 0; i--) {
    const c = choirs[i];
    if (now > c.until) { choirs.splice(i, 1); continue; }
    let raiders = [];
    try {
      raiders = world.getDimension(c.dim).getEntities({ tags: [api.RAIDER_TAG], location: c.at, maxDistance: c.radius });
    } catch {
      continue;
    }
    raiders.forEach((raider, n) => {
      const other = raiders[(n + 1) % raiders.length];
      if (!other || other.id === raider.id) return;
      fx(raider, "slowness", 30, 1);
      fx(raider, "weakness", 30, 1);
      try {
        raider.applyDamage(2, { cause: EntityDamageCause.entityAttack, damagingEntity: other });
        raider.dimension.spawnParticle("minecraft:villager_angry", { x: raider.location.x, y: raider.location.y + 2, z: raider.location.z });
      } catch {
        // gone
      }
    });
  }
}
