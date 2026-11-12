// The boss framework. A boss is an entity (family "siege_boss") plus a definition registered here:
//
//   registerBoss({
//     id: "reeve", type: "siege:clockwork_reeve", name: "The Clockwork Reeve",
//     radius: 24,                 // arena size around where the fight started
//     phases: [0.6, 0.3],         // health fractions where phase 1 and phase 2 begin (phase 0 = start)
//     attacks: [{ id, every, windup, phases?, warn?, start(f), show?(f, ctx), hit(f, ctx) }],
//     onStart(f), onPhase(f, n), tick(f), onHurt(f, event), onStruck(f, attacker), onAddDie(f, add, killer),
//     onPropHit(f, prop, player), onReset(f), onDeath(f, players),
//     whileEmpty(f) -> true to hold the fight instead of resetting, onLost(f) while the boss entity is unloaded,
//     loot(f, player, firstKill) -> [stacks]   handed straight to each player who fought
//     hoard(f, players) -> [stacks]            the shared vault chest
//   });
//   startBoss("reeve", dimension, location)   // or just spawn the entity: it starts its own fight
//
// `f` is the fight: f.entity, f.dim, f.center, f.phase, f.data (your scratch space), and helpers
// f.players(), f.say(), f.after(), f.zone(), f.shield(), f.summon(), f.adds(), f.hp().
// Fights never edit blocks (except the vault chest), so they work in any arena the map gives them.

import { world, system, GameMode } from "@minecraft/server";
import { onTick, moduleStore, addTests, assert, assertEqual, note, emit } from "../siege/api.js";
import { chooseAttack, pickTemper, temperById, TEMPERS } from "./variety.js";
import { MOBS } from "./data.js";
import { activeDimensions, alive, announce, effect, flat, give, heal, healthOf, hurt, particle, ring, sound, makeItem, playerList, addToPlayerList, setHurtScale } from "./util.js";
import { sfx, hasCue } from "../core/sfx.js";
import { bossMove } from "./anim.js";
import { MOVES } from "./moves.js";

const STEP = 5; // the framework ticks every 5 game ticks
const FOREVER = 20000000;
export const SHIELD_TAG = "siege_boss_shielded";
const FIGHT_PROP = "siege:bestiary_fight";
const BEATEN_PROP = "siege:bestiary_bosses";
const TEMPERS_PROP = "siege:bestiary_tempers"; // "boss:temper" for every temper a player has beaten a boss in

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

// Every boss is tuned to be beaten alone. Each extra player in the arena makes it half again as tough:
// 1 player = its real health, 2 = 1.5x, 4 = 2.5x, capped at 10 players. Done by giving back a share of each hit.
export const bossToughness = (playerCount) => 1 + 0.5 * (Math.min(10, Math.max(1, playerCount)) - 1);
export const hitGivenBack = (damage, playerCount, rank = 0) => damage * (1 - 1 / (bossToughness(playerCount) * rankHealth(rank)));

// Rank (Mateo 2026-11-12): every time a boss is beaten it comes back stronger, up to MAX_RANK. Rank = times it has
// fallen in this world. More health and harder hits each rank; from rank 3 it wears two tempers at once; every
// rematch drops netherite scrap, more at higher ranks (there is no Nether in this world: bosses are where it comes from).
export const MAX_RANK = 5;
export const rankOf = (defeated) => Math.min(MAX_RANK, Math.max(0, defeated ?? 0));
export const rankHealth = (rank) => 1 + 0.25 * rank; // rank 5 = 2.25x
export const rankDamage = (rank) => 1 + 0.15 * rank; // rank 5 = 1.75x
export const rankTempers = (rank) => (rank >= 3 ? 2 : rank >= 1 ? 1 : 0);
export const rankScrap = (rank) => (rank <= 0 ? 0 : rank <= 2 ? 1 : rank <= 4 ? 2 : 3);
const ROMAN = ["", "I", "II", "III", "IV", "V"];
export const tempersOf = (f) => [f.temper, f.temper2].filter(Boolean);
const temperMul = (f, key) => tempersOf(f).reduce((m, t) => m * (t[key] ?? 1), 1);

// The fight whose attack is running right now, so hurt() can scale it by that boss's rank
let acting;
setHurtScale(() => rankDamage(acting?.rank ?? 0));

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
  // A boss someone has already beaten comes back ranked up, in a temper (two from rank 3), never the one it wore last time
  f.rank = saved ? saved.rank ?? 0 : def.noRank ? 0 : rankOf(store.data.defeated[def.id]);
  f.temper = saved ? temperById(saved.temper) : undefined;
  f.temper2 = saved ? temperById(saved.temper2) : undefined;
  if (!saved && !def.noTemper && rankTempers(f.rank) >= 1) {
    const last = store.data.lastTemper?.[def.id];
    f.temper = pickTemper(last);
    if (rankTempers(f.rank) >= 2) {
      const rest = TEMPERS.filter((t) => t.id !== last && t.id !== f.temper.id);
      f.temper2 = rest[Math.floor(Math.random() * rest.length)];
    }
  }
  if (f.rank >= 3) effect(entity, "strength", FOREVER, f.rank >= 5 ? 1 : 0); // its own blows land harder too
  nameBoss(f);
  saveFight(f);
  for (const a of def.attacks ?? []) f.next[a.id] = Math.round(a.every * (0.5 + Math.random() * 0.5));
  if (fresh || !saved) {
    f.say(`§4${def.name}§7 ${def.intro ?? "has come."}`);
    if (f.rank) f.say(`§cRank ${ROMAN[f.rank]}.§7 It has fallen ${f.rank === MAX_RANK ? "too many times to count" : f.rank === 1 ? "once" : `${f.rank} times`}, and it came back stronger.`);
    for (const t of tempersOf(f)) f.say(`§c${t.name}.§7 ${t.line}`);
    const voice = hasCue(`sig.boss.${def.id}`) ? `sig.boss.${def.id}` : "boss.arrive"; // each boss has its own sound (SOUND-LIST.md)
    for (const p of f.players()) sfx(p, voice);
    emit("bossFightStarted", { boss: def.id, name: def.name, rank: f.rank, dim: f.dim.id, x: f.center.x, z: f.center.z, players: f.players().map((p) => p.name) }); // world news (news/)
  }
  def.onStart?.(f, !saved);
  return f;
}

function nameBoss(f) {
  try {
    const tempers = tempersOf(f).map((t) => t.name).join(" & ");
    f.entity.nameTag = `${f.def.name}${tempers ? `§7, ${tempers}` : ""}${f.rank ? ` §6${ROMAN[f.rank]}` : ""}`;
  } catch {
    // name is cosmetic
  }
}

function saveFight(f) {
  try {
    f.entity.setDynamicProperty(FIGHT_PROP, JSON.stringify({ id: f.def.id, center: f.center, damagers: [...f.damagers], temper: f.temper?.id, temper2: f.temper2?.id, rank: f.rank }));
  } catch {
    // boss gone
  }
}

// If a boss comes out of a move as a new entity (another dimension), carry the fight over to it.
export function rebind(f, entity) {
  fights.delete(f.id);
  f.entity = entity; f.id = entity.id; f.dim = entity.dimension;
  fights.set(entity.id, f);
  nameBoss(f);
  saveFight(f);
}

function helpers(f) {
  return {
    hp: () => {
      const h = healthOf(f.entity);
      return h.now / h.max;
    },
    players: (extra = 8) => {
      try {
        return f.dim.getPlayers({ location: f.def.roaming ? f.entity.location : f.center, maxDistance: (f.radius ?? f.def.radius) + extra })
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
    solo: () => f.players().length <= 1,
    // Move the whole fight somewhere else (another arena, even another dimension). The boss and the
    // players are moved by whoever calls this; helpers left behind are removed.
    moveTo: (dim, center, radius) => {
      clearAdds(f);
      f.zones = [];
      f.dim = dim; f.center = { x: center.x, y: center.y, z: center.z }; f.radius = radius;
      f.emptySince = undefined;
      saveFight(f);
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
      if (fights.has(e.id) || e.hasTag("siege_showcase")) continue; // showcase statues don't fight
      if (activeFights().some((x) => x.def.type === e.typeId && !alive(x.entity) && x.def.onLost)) continue; // that fight is mid-move: it claims its own boss
      const def = byType.get(e.typeId);
      if (def) attach(e, def, e.location, false);
    }
  }
}

function bossTick() {
  findBosses();
  for (const f of fights.values()) {
    if (!alive(f.entity)) { // unloaded: it picks up again when someone comes back
      safely(f, () => f.def.onLost?.(f));
      continue;
    }
    f.tick += STEP;
    f.lastLoc = f.entity.location;
    const players = f.players();

    // Nobody here for 30 seconds: the boss resets
    if (!players.length) {
      f.emptySince ??= f.tick;
      let held = false; // a fight can ask to wait (everyone is down and coming back) instead of resetting
      safely(f, () => (held = !!f.def.whileEmpty?.(f)));
      if (held) { f.emptySince = undefined; continue; }
      if (!f.def.roaming && f.tick - f.emptySince > 600 && (f.phase > 0 || f.hp() < 1)) reset(f);
      continue;
    }
    f.emptySince = undefined;

    // Leash to the arena
    if (!f.def.roaming && flat(f.entity.location, f.center) > (f.radius ?? f.def.radius)) {
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
      bossMove(f.entity, "rage", "strike");
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
      const due = [];
      for (const a of f.def.attacks ?? []) {
        f.next[a.id] -= STEP;
        if (f.next[a.id] > 0 || (a.phases && !a.phases.includes(f.phase)) || (a.when && !a.when(f))) continue;
        due.push(a.id);
      }
      // never the same attack twice running while another one is ready
      const chosen = chooseAttack(due, f.lastAttack);
      for (const a of (f.def.attacks ?? []).filter((x) => x.id === chosen)) {
        f.lastAttack = a.id;
        f.next[a.id] = Math.round(a.every * temperMul(f, "pace"));
        if (a.warn) f.bar(`§c⚠ ${a.warn}`);
        for (const p of players) {
          if (a.sound) sound(f.dim, a.sound, p.location, 0.5, 0.8);
          else sfx(p, "boss.warn");
        }
        let ctx;
        bossMove(f.entity, a.id, "wind", a.windup ?? 0); // the boss winds up while the warning is up (anim.js)
        safely(f, () => (ctx = a.start?.(f)));
        const windup = a.windup ?? 0;
        if (a.show) for (let t = STEP; t < windup; t += STEP) f.after(t, () => a.show(f, ctx));
        f.after(windup, () => { bossMove(f.entity, a.id, "strike"); a.hit?.(f, ctx); });
        f.busyUntil = f.tick + windup + Math.round((a.rest ?? 20) * temperMul(f, "rest"));
        break;
      }
    }
    safely(f, () => creativeChase(f, players));
    for (const t of tempersOf(f)) if (t.act && !f.paused && f.tick % t.every < STEP) safely(f, () => temperAct(f, players, t));
    safely(f, () => f.def.tick?.(f, players));
  }
}

// Playtests in Creative: Minecraft's own mob AI never targets a Creative player, so a boss with only
// Creative players near it would just wander. Then the script walks it at the nearest one and swings
// (hurt() shows the would-be damage on the action bar). As soon as anyone in Survival or Adventure is
// in the arena, this stops and the boss's normal AI takes over.
const MELEE_REACH = 2.6;
export const isCreative = (p) => { try { return p.getGameMode() === GameMode.Creative; } catch { return false; } };
export function chaseStep(from, to, speed, keepAt, flying) {
  const d = flat(from, to);
  if (d <= keepAt) return undefined;
  const step = Math.min(d - keepAt, speed * 2.5); // about the distance it walks in one framework step
  const k = step / d;
  const dy = flying ? Math.max(-step, Math.min(step, to.y + 1 - from.y)) : 0;
  return { x: from.x + (to.x - from.x) * k, y: from.y + dy, z: from.z + (to.z - from.z) * k };
}
function creativeChase(f, players) {
  if (f.paused || f.def.noChase || !players.length || !players.every(isCreative)) return;
  const e = f.entity, loc = e.location;
  if ((e.getEffect?.("slowness")?.amplifier ?? 0) >= 200 || e.getComponent("riding")) return; // stunned, or riding a mount
  const p = players.reduce((a, b) => (flat(b.location, loc) < flat(a.location, loc) ? b : a));
  const keepAt = f.def.standoff ?? MELEE_REACH - 0.6;
  if (!f.def.standoff && flat(p.location, loc) <= MELEE_REACH && Math.abs(p.location.y - loc.y) < 3) {
    if (f.tick % 20 < STEP) { hurt(p, f.def.meleeDamage ?? 8, "entityAttack", f.entity); sound(f.dim, "mob.irongolem.throw", loc, 0.8, 0.6); }
    return;
  }
  const flying = !!e.getComponent("can_fly");
  const speed = e.getComponent("movement")?.currentValue ?? 0.25;
  if (speed <= 0) return; // props and stationary bosses stay put
  let to = chaseStep(loc, p.location, speed, keepAt, flying);
  if (!to) return;
  if (!flying) { // step up one block or down a few, never into a wall
    const open = (y) => { const b = f.dim.getBlock({ x: Math.floor(to.x), y: Math.floor(y), z: Math.floor(to.z) }); return !!b && (b.isAir || !b.isSolid); };
    let y = to.y;
    if (!open(y) || !open(y + 1)) { if (open(y + 1) && open(y + 2)) y += 1; else return; }
    for (let i = 0; i < 4 && open(y - 1); i++) y -= 1;
    to = { ...to, y };
  }
  e.teleport(to, { facingLocation: p.location });
}

// What a temper adds on top of the boss's own attacks
function temperAct(f, players, temper) {
  if (temper.act === "ground") {
    f.bar("§c⚠ The ground remembers. Move!");
    for (const p of players) f.zone({ x: p.location.x, y: p.location.y, z: p.location.z }, 3, 40, (hit) => hurt(hit, 6, "magic", f.entity), "minecraft:soul_particle");
  } else if (temper.act === "court") {
    if (f.adds("siege:tolling_shade").length >= 2) return;
    f.bar("§c⚠ Something has come to stand with it.");
    f.summon("siege:tolling_shade", f.solo() ? 1 : 2, 6);
  } else if (temper.act === "slip") {
    const loc = f.entity.location;
    if (f.tick < f.busyUntil || !players.some((p) => flat(p.location, loc) < 4)) return;
    const to = f.spot(5, Math.max(6, (f.radius ?? f.def.radius) * 0.6));
    particle(f.dim, "minecraft:large_explosion", { x: loc.x, y: loc.y + 1, z: loc.z });
    try { f.entity.teleport({ x: to.x, y: loc.y, z: to.z }); } catch { /* chunk not ready */ }
    sound(f.dim, "mob.endermen.portal", to, 0.6, 1);
    particle(f.dim, "siege:vein_spark", { x: to.x, y: loc.y + 1, z: to.z });
  }
}

function safely(f, fn) {
  const before = acting;
  acting = f;
  try {
    fn();
  } catch (e) {
    console.warn(`[Bestiary] ${f.def.id}: ${e}`);
  } finally {
    acting = before;
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
  emit("bossFightReset", { boss: f.def.id, name: f.def.name, dim: f.dim.id, x: f.center.x, z: f.center.z }); // everyone who fought it fell or fled
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
  if (by?.typeId === "minecraft:player") { f.damagers.add(by.id); f.lastHitter = by.id; }
  const back = hitGivenBack(event.damage, f.players().length, f.rank);
  if (back > 0 && healthOf(f.entity).now > 0) heal(f.entity, back);
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
  if (f) return finish(f, event.damageSource.damagingEntity);
  if (!MOBS[dead.typeId]) return;
  const owner = fightByAddTag(dead);
  if (owner) safely(owner, () => owner.def.onAddDie?.(owner, dead, event.damageSource.damagingEntity));
});

function finish(f, slayer) {
  fights.delete(f.id);
  clearAdds(f);
  const def = f.def, loc = f.lastLoc;
  const online = world.getPlayers();
  let players = online.filter((p) => f.damagers.has(p.id));
  if (!players.length) players = online.filter((p) => p.dimension.id === f.dim.id && flat(p.location, loc) < def.radius + 16);

  store.data.defeated[def.id] = (store.data.defeated[def.id] ?? 0) + 1;
  if (f.temper) (store.data.lastTemper ??= {})[def.id] = f.temper.id;
  store.data.hollowAwake = true; // the first boss to fall wakes the Hollow things everywhere
  store.save();

  for (const p of players) {
    const first = addToPlayerList(p, BEATEN_PROP, def.id);
    try { note(p, "fight"); } catch { /* the Storyteller is optional to a fight */ }
    safely(f, () => {
      for (const stack of def.loot?.(f, p, first) ?? []) give(p, stack);
    });
    for (const t of tempersOf(f)) if (addToPlayerList(p, TEMPERS_PROP, `${def.id}:${t.id}`)) {
      // a keepsake for each temper beaten: something to collect, with a name on it, not a stat
      const token = makeItem("minecraft:echo_shard", 1);
      if (token) {
        token.nameTag = `§d${def.name}, ${t.name}`;
        token.setLore([`§7Taken from it the time it came back ${t.name.toLowerCase()}.`, `§8One of ${TEMPERS.length}.`]);
        give(p, token);
      }
    }
    const scrap = rankScrap(f.rank);
    if (scrap) {
      const stack = makeItem("minecraft:netherite_scrap", scrap);
      if (stack) { give(p, stack); p.sendMessage(`§7It leaves §f${scrap} netherite scrap§7 behind. The more often it falls, the more it leaves.`); }
    }
    p.onScreenDisplay.setTitle(`§6${def.name}`, { subtitle: "§7has fallen", fadeInDuration: 10, stayDuration: 70, fadeOutDuration: 20 });
    sfx(p, "ui.toast.challenge_complete");
    announce("siege:award_skill_points", { player: p.id, points: first ? def.points ?? 5 : 1, renown: first ? 150 : 30, reason: `boss:${def.id}` });
  }
  safely(f, () => vault(f, loc, def.hoard?.(f, players) ?? []));
  safely(f, () => def.onDeath?.(f, players));
  // Whoever landed the last blow (or hurt it last, if it died to something else), and everyone else who fought
  const killer = (slayer?.typeId === "minecraft:player" ? slayer : undefined) ?? online.find((p) => p.id === f.lastHitter) ?? players[0];
  announce("siege:boss_defeated", { boss: def.id, x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z), dimension: f.dim.id, players: players.map((p) => p.id), ...(f.temper ? { temper: f.temper.id } : {}), ...(f.temper2 ? { temper2: f.temper2.id } : {}), rank: f.rank,
    killer: killer?.id, killerName: killer?.name, allies: players.filter((p) => p.id !== killer?.id).map((p) => p.id) });
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
export const tempersBeaten = (player, bossId) => playerList(player, TEMPERS_PROP).filter((t) => t.startsWith(`${bossId}:`)).map((t) => t.split(":")[1]);

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
  "bosses are solo-sized and toughen with the party": () => {
    assertEqual(bossToughness(0), 1);
    assertEqual(bossToughness(1), 1);
    assertEqual(bossToughness(2), 1.5);
    assertEqual(bossToughness(4), 2.5);
    assertEqual(bossToughness(50), 5.5);
    assertEqual(hitGivenBack(10, 1), 0);
    assertEqual(hitGivenBack(10, 3), 5);
  },
  "a boss comes back stronger each time it falls, and pays netherite scrap for it": () => {
    assertEqual([0, 1, 2, 3, 5, 9].map(rankOf), [0, 1, 2, 3, 5, 5]);
    assertEqual(rankHealth(0), 1); assertEqual(rankHealth(5), 2.25);
    assert(rankDamage(5) > rankDamage(1) && rankDamage(0) === 1, "damage grows with rank");
    assertEqual([0, 1, 2, 3, 4, 5].map(rankTempers), [0, 1, 1, 2, 2, 2]);
    assertEqual([0, 1, 2, 3, 4, 5].map(rankScrap), [0, 1, 1, 2, 2, 3]);
    assertEqual(hitGivenBack(10, 1, 0), 0);
    assertEqual(Math.round(hitGivenBack(10, 1, 4) * 100) / 100, 5); // rank 4 = twice the health
  },
  "a boss chases Creative playtesters: steps toward them and stops at arm's length": () => {
    const step = chaseStep({ x: 0, y: 64, z: 0 }, { x: 10, y: 64, z: 0 }, 0.3, 2, false);
    assertEqual(step.x, 0.75); assertEqual(step.y, 64);
    assertEqual(chaseStep({ x: 9, y: 64, z: 0 }, { x: 10, y: 64, z: 0 }, 0.3, 2, false), undefined);
    assertEqual(chaseStep({ x: 0, y: 64, z: 0 }, { x: 10, y: 70, z: 0 }, 0.3, 2, true).y, 64.75); // a flyer climbs toward you too
  },
  "every boss attack has a wind-up and strike animation": () => {
    // a new attack needs a line in studio/bestiary/anims.py BOSS_MOVES (then run anims.py)
    for (const def of bossDefs()) {
      for (const a of def.attacks ?? []) assert(MOVES[def.type]?.includes(a.id), `${def.type} has no animation for its "${a.id}" attack`);
      assert(MOVES[def.type]?.includes("rage"), `${def.type} has no rage animation`);
    }
  },
  "boss phases follow health": () => {
    assertEqual(phaseFor(1, [0.6, 0.3]), 0);
    assertEqual(phaseFor(0.6, [0.6, 0.3]), 1);
    assertEqual(phaseFor(0.45, [0.6, 0.3]), 1);
    assertEqual(phaseFor(0.1, [0.6, 0.3]), 2);
    assertEqual(phaseFor(0.1, undefined), 0);
  },
});
