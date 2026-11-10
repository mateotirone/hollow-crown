// The boss framework. A boss is an entity (family "siege_boss") plus a definition registered here:
//
//   registerBoss({
//     id: "reeve", type: "siege:clockwork_reeve", name: "The Clockwork Reeve",
//     radius: 24,                 // arena size around where the fight started
//     phases: [0.6, 0.3],         // health fractions where phase 1 and phase 2 begin (phase 0 = start)
//     attacks: [{ id, every, windup, phases?, warn?, start(f), show?(f, ctx), hit(f, ctx) }],
//     onStart(f), onPhase(f, n), tick(f), onHurt(f, event), onStruck(f, attacker), onAddDie(f, add, killer),
//     onPropHit(f, prop, player), onReset(f), onDeath(f, players),
//     loot(f, player, firstKill) -> [stacks]   handed straight to each player who fought
//     hoard(f, players) -> [stacks]            the shared vault chest
//   });
//   startBoss("reeve", dimension, location)   // or just spawn the entity: it starts its own fight
//
// `f` is the fight: f.entity, f.dim, f.center, f.phase, f.data (your scratch space), and helpers
// f.players(), f.say(), f.after(), f.zone(), f.shield(), f.summon(), f.adds(), f.hp().
// Fights never edit blocks (except the vault chest), so they work in any arena the map gives them.

import { world, system } from "@minecraft/server";
import { onTick, moduleStore, addTests, assertEqual } from "../siege/api.js";
import { MOBS } from "./data.js";
import { activeDimensions, alive, announce, effect, flat, give, heal, healthOf, hurt, particle, ring, sound, makeItem, playerList, addToPlayerList } from "./util.js";

const STEP = 5; // the framework ticks every 5 game ticks
export const SHIELD_TAG = "siege_boss_shielded";
const FIGHT_PROP = "siege:bestiary_fight";
const BEATEN_PROP = "siege:bestiary_bosses";

const defs = new Map(); // boss id -> definition
const byType = new Map(); // entity type -> definition
const fights = new Map(); // boss entity id -> fight
const store = moduleStore("siege:bestiary", () => ({ defeated: {}, hollowAwake: false }));
export const bestiaryStore = store;

export function registerBoss(def) {
  defs.set(def.id, def);
  byType.set(def.type, def);
}
export const bossDefs = () => [...defs.values()];
export const activeFights = () => [...fights.values()];
export const fightOf = (bossId) => activeFights().find((f) => f.def.id === bossId);

// How many phase lines the boss's health has dropped below
export function phaseFor(fraction, thresholds = []) {
  return thresholds.filter((t) => fraction <= t).length;
}

export function startBoss(id, dim, location) {
  const def = defs.get(id);
  if (!def) return undefined;
  const entity = dim.spawnEntity(def.type, location);
  return attach(entity, def, location, true);
}

function attach(entity, def, center, fresh) {
  let saved;
  try {
    const raw = entity.getDynamicProperty(FIGHT_PROP);
    if (typeof raw === "string") saved = JSON.parse(raw);
  } catch {
    // new boss
  }
  const f = {
    def, entity, dim: entity.dimension, id: entity.id,
    center: saved?.center ?? { x: center.x, y: center.y, z: center.z },
    phase: 0, data: {}, tick: 0, timers: [], zones: [], damagers: new Set(saved?.damagers ?? []),
    busyUntil: 0, emptySince: undefined, lastLoc: entity.location, next: {}, paused: false,
    addTag: `siege_b_of_${entity.id}`.replace(/[^\w-]/g, "_"),
  };
  Object.assign(f, helpers(f));
  fights.set(entity.id, f);
  try {
    entity.nameTag = `§c${def.name}`;
    entity.setDynamicProperty(FIGHT_PROP, JSON.stringify({ id: def.id, center: f.center, damagers: [...f.damagers] }));
  } catch {
    // name is cosmetic
  }
  for (const a of def.attacks ?? []) f.next[a.id] = Math.round(a.every * (0.5 + Math.random() * 0.5));
  if (fresh || !saved) {
    f.say(`§4${def.name}§7 ${def.intro ?? "has come."}`);
    for (const p of f.players()) sound(f.dim, "mob.wither.spawn", p.location, 0.7, 0.6);
  }
  def.onStart?.(f, !saved);
  return f;
}

function helpers(f) {
  return {
    hp: () => {
      const h = healthOf(f.entity);
      return h.now / h.max;
    },
    players: (extra = 8) => {
      try {
        return f.dim.getPlayers({ location: f.def.roaming ? f.entity.location : f.center, maxDistance: f.def.radius + extra })
          .filter((p) => healthOf(p).now > 0);
      } catch {
        return [];
      }
    },
    say: (text) => {
      for (const p of f.players(24)) p.sendMessage(text);
    },
    bar: (text) => {
      for (const p of f.players()) p.onScreenDisplay.setActionBar(text);
    },
    after: (ticks, fn) => f.timers.push({ at: f.tick + ticks, fn }),
    // A marked circle on the ground that goes off after `delay` ticks. hit(player) runs for everyone still inside.
    zone: (pos, radius, delay, hit, particleId = "minecraft:basic_flame_particle") =>
      f.zones.push({ pos: { ...pos }, radius, at: f.tick + delay, hit, particleId }),
    shield: (on) => {
      try {
        if (on) f.entity.addTag(SHIELD_TAG);
        else f.entity.removeTag(SHIELD_TAG);
      } catch {
        // boss gone
      }
    },
    shielded: () => {
      try {
        return f.entity.hasTag(SHIELD_TAG);
      } catch {
        return false;
      }
    },
    // Spawn helpers around the boss (or around `at`). They are removed if the fight resets.
    summon: (type, count = 1, spread = 4, at = f.entity.location, tags = []) => {
      const made = [];
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2, d = spread * (0.5 + Math.random() * 0.5);
        try {
          const e = f.dim.spawnEntity(type, { x: at.x + Math.cos(a) * d, y: at.y + 0.2, z: at.z + Math.sin(a) * d });
          e.addTag(f.addTag);
          for (const t of tags) e.addTag(t);
          made.push(e);
        } catch {
          // no room there
        }
      }
      return made;
    },
    // Spawn one at an exact spot (fight props like bells and pillars)
    place: (type, at) => {
      try {
        const e = f.dim.spawnEntity(type, at);
        e.addTag(f.addTag);
        return e;
      } catch {
        return undefined;
      }
    },
    adds: (type) => {
      try {
        return f.dim.getEntities({ tags: [f.addTag], ...(type ? { type } : {}) });
      } catch {
        return [];
      }
    },
    target: () => {
      const ps = f.players();
      return ps.length ? ps[Math.floor(Math.random() * ps.length)] : undefined;
    },
    // A random spot on the arena floor, between `min` and `max` blocks from the centre
    spot: (min, max) => {
      const c = f.def.roaming ? f.entity.location : f.center;
      const a = Math.random() * Math.PI * 2, d = min + Math.random() * (max - min);
      return { x: c.x + Math.cos(a) * d, y: c.y, z: c.z + Math.sin(a) * d };
    },
    stun: (ticks) => {
      effect(f.entity, "slowness", ticks, 255);
      effect(f.entity, "weakness", ticks, 255);
      f.busyUntil = Math.max(f.busyUntil, f.tick + ticks);
    },
  };
}

// ---------- the loop ----------
function findBosses() {
  for (const dim of activeDimensions()) {
    let found = [];
    try {
      found = dim.getEntities({ families: ["siege_boss"] });
    } catch {
      continue;
    }
    for (const e of found) {
      if (fights.has(e.id)) continue;
      const def = byType.get(e.typeId);
      if (def) attach(e, def, e.location, false);
    }
  }
}

function bossTick() {
  findBosses();
  for (const f of fights.values()) {
    if (!alive(f.entity)) continue; // unloaded: it picks up again when someone comes back
    f.tick += STEP;
    f.lastLoc = f.entity.location;
    const players = f.players();

    // Nobody here for 30 seconds: the boss resets
    if (!players.length) {
      f.emptySince ??= f.tick;
      if (!f.def.roaming && f.tick - f.emptySince > 600 && (f.phase > 0 || f.hp() < 1)) reset(f);
      continue;
    }
    f.emptySince = undefined;

    // Leash to the arena
    if (!f.def.roaming && flat(f.entity.location, f.center) > f.def.radius) {
      try {
        f.entity.teleport(f.center);
      } catch {
        // chunk not ready
      }
    }

    // Phases
    const phase = phaseFor(f.hp(), f.def.phases);
    if (phase > f.phase && !f.paused) {
      f.phase = phase;
      effect(f.entity, "resistance", 40, 4);
      for (const p of players) {
        p.onScreenDisplay.setTitle(`§c${f.def.name}`, { subtitle: `§7${f.def.phaseNames?.[phase] ?? `Phase ${phase + 1}`}`, fadeInDuration: 5, stayDuration: 40, fadeOutDuration: 10 });
        sound(f.dim, "mob.wither.ambient", p.location, 0.6, 0.7);
      }
      f.def.onPhase?.(f, phase);
    }

    // Timers and marked zones
    const due = f.timers.filter((t) => t.at <= f.tick);
    f.timers = f.timers.filter((t) => t.at > f.tick);
    for (const t of due) safely(f, () => t.fn());
    for (const z of f.zones) {
      if (z.at > f.tick) {
        ring(f.dim, z.pos, z.radius, z.particleId);
        continue;
      }
      particle(f.dim, "minecraft:large_explosion", { x: z.pos.x, y: z.pos.y + 0.5, z: z.pos.z });
      for (const p of players) if (flat(p.location, z.pos) <= z.radius && Math.abs(p.location.y - z.pos.y) < 4) safely(f, () => z.hit(p));
    }
    f.zones = f.zones.filter((z) => z.at > f.tick);

    // Attacks: one at a time, each on its own clock, each warned about before it lands
    if (!f.paused && f.tick >= f.busyUntil) {
      for (const a of f.def.attacks ?? []) {
        f.next[a.id] -= STEP;
        if (f.next[a.id] > 0 || (a.phases && !a.phases.includes(f.phase)) || (a.when && !a.when(f))) continue;
        f.next[a.id] = a.every;
        if (a.warn) f.bar(`§c⚠ ${a.warn}`);
        for (const p of players) sound(f.dim, a.sound ?? "note.pling", p.location, 0.5, 0.8);
        let ctx;
        safely(f, () => (ctx = a.start?.(f)));
        const windup = a.windup ?? 0;
        if (a.show) for (let t = STEP; t < windup; t += STEP) f.after(t, () => a.show(f, ctx));
        f.after(windup, () => a.hit?.(f, ctx));
        f.busyUntil = f.tick + windup + (a.rest ?? 20);
        break;
      }
    }
    safely(f, () => f.def.tick?.(f, players));
  }
}

function safely(f, fn) {
  try {
    fn();
  } catch (e) {
    console.warn(`[Bestiary] ${f.def.id}: ${e}`);
  }
}

function clearAdds(f) {
  for (const e of f.adds()) {
    try {
      e.remove();
    } catch {
      // already gone
    }
  }
}

function reset(f) {
  clearAdds(f);
  f.phase = 0; f.timers = []; f.zones = []; f.data = {}; f.paused = false; f.busyUntil = 0;
  f.damagers.clear();
  f.shield(false);
  try {
    for (const t of f.entity.getTags()) if (t.startsWith("siege_stance_") || t === "siege_parry") f.entity.removeTag(t);
    f.entity.teleport(f.center);
  } catch {
    // boss unloaded
  }
  heal(f.entity, 100000);
  f.def.onReset?.(f);
  f.def.onStart?.(f, true);
}

// ---------- events ----------
function fightByAddTag(entity) {
  let tags;
  try {
    tags = entity.getTags();
  } catch {
    return undefined;
  }
  return activeFights().find((f) => tags.includes(f.addTag));
}

world.afterEvents.entityHurt.subscribe((event) => {
  const f = fights.get(event.hurtEntity.id);
  if (!f) return;
  const by = event.damageSource.damagingEntity;
  if (by?.typeId === "minecraft:player") f.damagers.add(by.id);
  safely(f, () => f.def.onHurt?.(f, event));
});

world.afterEvents.entityHitEntity.subscribe((event) => {
  const f = fights.get(event.hitEntity.id);
  if (f) return safely(f, () => f.def.onStruck?.(f, event.damagingEntity));
  if (!MOBS[event.hitEntity.typeId]) return;
  const owner = fightByAddTag(event.hitEntity);
  if (owner && event.damagingEntity?.typeId === "minecraft:player") safely(owner, () => owner.def.onPropHit?.(owner, event.hitEntity, event.damagingEntity));
});

world.afterEvents.projectileHitEntity.subscribe((event) => {
  const hit = event.getEntityHit()?.entity;
  if (!hit || !MOBS[hit.typeId] || event.source?.typeId !== "minecraft:player") return;
  const owner = fightByAddTag(hit);
  if (owner) safely(owner, () => owner.def.onPropHit?.(owner, hit, event.source));
});

world.afterEvents.entityDie.subscribe((event) => {
  const dead = event.deadEntity;
  const f = fights.get(dead.id);
  if (f) return finish(f);
  if (!MOBS[dead.typeId]) return;
  const owner = fightByAddTag(dead);
  if (owner) safely(owner, () => owner.def.onAddDie?.(owner, dead, event.damageSource.damagingEntity));
});

function finish(f) {
  fights.delete(f.id);
  clearAdds(f);
  const def = f.def, loc = f.lastLoc;
  const online = world.getPlayers();
  let players = online.filter((p) => f.damagers.has(p.id));
  if (!players.length) players = online.filter((p) => p.dimension.id === f.dim.id && flat(p.location, loc) < def.radius + 16);

  store.data.defeated[def.id] = (store.data.defeated[def.id] ?? 0) + 1;
  store.data.hollowAwake = true; // the first boss to fall wakes the Hollow things everywhere
  store.save();

  for (const p of players) {
    const first = addToPlayerList(p, BEATEN_PROP, def.id);
    safely(f, () => {
      for (const stack of def.loot?.(f, p, first) ?? []) give(p, stack);
    });
    p.onScreenDisplay.setTitle(`§6${def.name}`, { subtitle: "§7has fallen", fadeInDuration: 10, stayDuration: 70, fadeOutDuration: 20 });
    p.playSound("ui.toast.challenge_complete");
    announce("siege:award_skill_points", { player: p.id, points: first ? def.points ?? 5 : 1, renown: first ? 150 : 30, reason: `boss:${def.id}` });
  }
  safely(f, () => vault(f, loc, def.hoard?.(f, players) ?? []));
  safely(f, () => def.onDeath?.(f, players));
  announce("siege:boss_defeated", { boss: def.id, x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z), dimension: f.dim.id, players: players.map((p) => p.id) });
  for (const p of online) if (!players.includes(p)) p.sendMessage(`§6${def.name} has been slain by ${players.map((x) => x.name).join(", ") || "someone"}.`);
}

// The shared hoard: a chest where the boss fell (or just dropped, for bosses that die on someone's land)
function vault(f, loc, stacks) {
  stacks = stacks.filter(Boolean);
  if (!stacks.length) return;
  let container;
  if (!f.def.dropLoot) {
    try {
      let spot = f.dim.getBlock({ x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) });
      for (let i = 0; i < 6 && spot && !spot.isAir && !spot.isLiquid; i++) spot = spot.above();
      if (spot && (spot.isAir || spot.isLiquid)) {
        spot.setType("minecraft:chest");
        container = spot.getComponent("inventory")?.container;
        ring(f.dim, spot.location, 1.5, "minecraft:totem_particle", 20);
      }
    } catch {
      // can't place a chest here: drop the loot instead
    }
  }
  for (const stack of stacks) {
    const left = container ? container.addItem(stack) : stack;
    if (left) f.dim.spawnItem(left, loc);
  }
}

export const hasBeaten = (player, bossId) => playerList(player, BEATEN_PROP).includes(bossId);

// Convenience for loot lists: stack("siege:hollow_ash", 6)
export const stack = (id, n = 1) => makeItem(id, n);

// Anyone can start a fight by script event: /scriptevent siege:bestiary_summon reeve   (at the sender)
// or with a place:                           /scriptevent siege:bestiary_summon reeve 100 64 -20
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:bestiary_summon") return;
  const [id, x, y, z] = event.message.trim().split(/\s+/);
  const def = defs.get(id);
  const src = event.sourceEntity ?? event.sourceBlock;
  if (!def || (!src && x === undefined)) return;
  const dim = src?.dimension ?? world.getDimension("overworld");
  const at = x !== undefined ? { x: +x, y: +y, z: +z } : src.location;
  try {
    startBoss(id, dim, at);
  } catch (e) {
    console.warn(`[Bestiary] could not summon ${id}: ${e}`);
  }
});

onTick("bestiary_bosses", STEP, bossTick);

addTests("bestiary", {
  "boss phases follow health": () => {
    assertEqual(phaseFor(1, [0.6, 0.3]), 0);
    assertEqual(phaseFor(0.6, [0.6, 0.3]), 1);
    assertEqual(phaseFor(0.45, [0.6, 0.3]), 1);
    assertEqual(phaseFor(0.1, [0.6, 0.3]), 2);
    assertEqual(phaseFor(0.1, undefined), 0);
  },
});
export { hurt };
