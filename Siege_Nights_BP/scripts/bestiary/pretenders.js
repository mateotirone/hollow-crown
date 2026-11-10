// Pretenders: after Morvane falls, the Seat is empty, and from time to time somebody comes to fill it.
// Every Pretender is generated: a name, one of three bodies, four powers out of nine, and a claim
// (one rule that changes how you have to fight it). The same one never rises twice.
// While a Pretender sits unchallenged the seep surges in the overworld, more each day.
//
//   store          siege:pretenders  { n, nextDay, current, fallen: [names] }
//   events out     siege:pretender_risen    {"n","name","body","claim","x","y","z","dimension"}
//                  siege:pretender_marching {"n","name","days"}   once, when it has sat for MARCH_DAYS (the reach thread's cue)
//                  siege:pretender_fallen   {"n","name","players":[ids],"killer"?}
//   test           /scriptevent siege:pretender_rise [seed]   one rises now and stands where you are
//                  /scriptevent siege:pretender_status
//
// Sized for one player, like every boss here (bossCore toughens it for a party).

import { world, system } from "@minecraft/server";
import { onTick, moduleStore, addTests, assert, assertEqual } from "../siege/api.js";
import { registerBoss, bestiaryStore, fightOf, stack } from "./bossCore.js";
import { lance } from "./bosses.js";
import { setSeepSurge } from "./seeps.js";
import { UNDERTOW_ID, HEART } from "../undertow/layout.js";
import { alive, announce, effect, flat, give, heal, healthOf, hurt, makeItem, particle, ring, shove, sound } from "./util.js";
import { sfx } from "../core/sfx.js";

export const PRETENDERS = { firstAfterDays: 5, everyDaysMin: 6, everyDaysMax: 11, marchDays: 5, surgePerDay: 0.5, surgeMax: 3, wakeRange: 64, kitSize: 4 };

const BODIES = ["blade", "seer", "brute"];
const FIRST = ["Ysolde", "Carrow", "Maud", "Hesper", "Aldric", "Wynne", "Corvin", "Thessaly", "Brannoch", "Idony", "Rook", "Sable", "Emeric", "Lune", "Garrick", "Oriel"];
const EPITHET = ["the Unburied", "of the Second Bell", "Half-Crowned", "the Patient", "who Was Promised", "Seatless", "the Ninth Voice", "of No House",
  "the Louder", "Kingsbane's Heir", "the Unasked", "Twice Drowned", "the Lamplighter", "of the Low Road", "the Inheritor", "Who Kept Count"];
export const CLAIMS = {
  unbled: { name: "Unbled", line: "Its wounds close whenever you give it room.", hint: "Stay close to it." },
  mirrored: { name: "Mirrored", line: "What you loose at it comes back.", hint: "Arrows return to the archer. Use a blade." },
  attended: { name: "Followed", line: "It did not climb to the Seat alone.", hint: "Each fifth of its life it loses, another follower arrives." },
  hungering: { name: "Hungering", line: "Every blow it lands feeds it.", hint: "Do not get hit." },
  twinned: { name: "Twinned", line: "There are two of it, and only one can be hurt at a time.", hint: "At half its life a twin steps out. Kill the twin first." },
};
export const POWERS = ["lance", "ground", "ring", "call", "pull", "blink", "rain", "mark", "wall"];

// A small seeded dice roll, so a Pretender can be rebuilt from its number alone
export function dice(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pure: everything about a Pretender from its seed. `before` is the last one, so the next is never its twin.
export function makePretender(seed, before) {
  for (let turn = 0; turn < 20; turn++) {
    const roll = dice(seed + turn * 7919);
    const pick = (list) => list[Math.floor(roll() * list.length)];
    const pool = [...POWERS], kit = [];
    while (kit.length < PRETENDERS.kitSize) kit.push(pool.splice(Math.floor(roll() * pool.length), 1)[0]);
    const p = { seed, name: `${pick(FIRST)} ${pick(EPITHET)}`, body: pick(BODIES), claim: pick(Object.keys(CLAIMS)), kit };
    if (!before) return p;
    const shared = p.kit.filter((k) => before.kit.includes(k)).length;
    if (p.name !== before.name && p.body !== before.body && p.claim !== before.claim && shared <= 2) return p;
  }
  return makePretender(seed + 1, undefined);
}

export const surgeFor = (daysSat) => Math.min(PRETENDERS.surgeMax, 1 + PRETENDERS.surgePerDay * Math.max(0, daysSat));
export const nextRise = (day, roll) => day + PRETENDERS.everyDaysMin + Math.floor(roll * (PRETENDERS.everyDaysMax - PRETENDERS.everyDaysMin + 1));

const store = moduleStore("siege:pretenders", () => ({ n: 0, nextDay: undefined, current: undefined, last: undefined, fallen: [] }));
const today = () => { try { return world.getDay(); } catch { return 0; } };
const typeOf = (p) => `siege:pretender_${p.body}`;
const everyone = (text) => { for (const p of world.getPlayers()) p.sendMessage(text); };

setSeepSurge(() => {
  try {
    const c = store.data.current;
    return c ? surgeFor(today() - c.day) : 1;
  } catch {
    return 1;
  }
});

function rise(seed, at, dim) {
  const d = store.data;
  const p = makePretender(seed ?? Math.floor(Math.random() * 2 ** 31), d.last);
  d.n += 1;
  d.current = { ...p, n: d.n, day: today(), spawned: false, marched: false, ...(at ? { at: { x: at.x, y: at.y, z: at.z }, dim: dim.id } : {}) };
  store.save();
  const where = d.current.at ?? HEART.center;
  everyone(`§5A claimant has come to the empty Seat: §d${p.name}§5.§7 ${CLAIMS[p.claim].line} The seep will surge until someone puts them down.`);
  for (const pl of world.getPlayers()) sfx(pl, "mob.wither.spawn", { volume: 0.5, pitch: 0.6 });
  announce("siege:pretender_risen", { n: d.n, name: p.name, body: p.body, claim: p.claim, x: where.x, y: where.y, z: where.z, dimension: d.current.dim ?? UNDERTOW_ID });
  return d.current;
}

function pretenderTick() {
  const d = store.data, day = today();
  if (!(bestiaryStore.data.defeated?.morvane > 0)) return; // the Seat is not empty yet
  if (!d.current) {
    if (d.nextDay === undefined) { d.nextDay = day + PRETENDERS.firstAfterDays; store.save(); }
    else if (day >= d.nextDay) rise();
    return;
  }
  const c = d.current;
  if (!c.marched && day - c.day >= PRETENDERS.marchDays) {
    c.marched = true; store.save();
    everyone(`§5${c.name} has sat on the Seat for ${day - c.day} days. The seep is everywhere now.`);
    announce("siege:pretender_marching", { n: c.n, name: c.name, days: day - c.day });
  }
  // It stands at the Seat (or where it was called). It takes shape when someone comes near.
  if (c.spawned && (fightOf(`pretender_${c.body}`) || world.getDimension(c.dim ?? UNDERTOW_ID).getEntities({ type: typeOf(c) }).length)) return;
  const dim = world.getDimension(c.dim ?? UNDERTOW_ID), at = c.at ?? HEART.center;
  let near = [];
  try { near = dim.getPlayers({ location: at, maxDistance: PRETENDERS.wakeRange }); } catch { return; }
  if (!near.length) return;
  try {
    dim.spawnEntity(typeOf(c), at); // bossCore finds it and starts the fight
    c.spawned = true; store.save();
  } catch {
    // not loaded yet: next tick
  }
}
onTick("bestiary_pretenders", 100, pretenderTick);

// ---------- the fight ----------
const has = (id) => (f) => !!f.data.p?.kit.includes(id);
const claimIs = (f, id) => f.data.p?.claim === id;
const floor = (f, at) => ({ x: at.x, y: f.center.y, z: at.z });
const arena = 26;

const ATTACKS = [
  { id: "lance", every: 130, windup: 35, warn: "It levels its weapon at you. Sidestep!", when: has("lance"), ...lance(18, 10) },
  { id: "ground", every: 120, windup: 25, warn: "The floor under you is going. Move!", when: has("ground"),
    start: (f) => { for (const p of f.players()) f.zone(floor(f, p.location), 2.5, 25, (q) => hurt(q, 8, "magic", f.entity), "minecraft:soul_particle"); } },
  { id: "ring", every: 170, windup: 30, warn: "It strikes the floor. Be in the air when the ring reaches you!", sound: "block.bell.hit", when: has("ring"),
    show: (f) => ring(f.dim, f.entity.location, 4 + (f.tick % 30) / 3, "minecraft:sonic_explosion", 10),
    hit: (f) => {
      ring(f.dim, f.entity.location, 12, "minecraft:sonic_explosion", 24);
      for (const p of f.players()) if (p.isOnGround && flat(p.location, f.entity.location) <= 12) { hurt(p, 9, "magic", f.entity); shove(p, p.location.x - f.entity.location.x, p.location.z - f.entity.location.z, 1.2, 0.5); }
    } },
  { id: "call", every: 420, windup: 20, warn: "It calls, and the Hollow's soldiers answer.", sound: "raid.horn", when: (f) => has("call")(f) && f.adds().length < 3,
    hit: (f) => { f.summon("siege:veinsworn", f.solo() ? 1 : 2, 7); f.summon("siege:shardcaster", 1, 9); } },
  { id: "pull", every: 190, windup: 30, warn: "The air pulls toward it. Run from it!", when: has("pull"),
    show: (f) => { for (const p of f.players()) shove(p, f.entity.location.x - p.location.x, f.entity.location.z - p.location.z, 0.55, 0.05); },
    hit: (f) => f.zone(floor(f, f.entity.location), 5, 15, (q) => hurt(q, 12, "magic", f.entity), "minecraft:dragon_breath_trail") },
  { id: "blink", every: 160, windup: 25, warn: "It is gone. Turn round!", sound: "mob.endermen.portal", when: has("blink"),
    start: (f) => f.target(),
    hit: (f, t) => {
      if (!alive(t)) return;
      const v = t.getViewDirection(), at = { x: t.location.x - v.x * 2.5, y: t.location.y, z: t.location.z - v.z * 2.5 };
      try { f.entity.teleport(at, { facingLocation: t.location }); } catch { return; }
      f.zone(floor(f, at), 3, 14, (q) => hurt(q, 10, "entityAttack", f.entity), "minecraft:basic_crit_particle");
    } },
  { id: "rain", every: 210, windup: 20, warn: "Shards are falling. Watch the floor!", when: has("rain"),
    hit: (f) => { for (let i = 0; i < 6 + f.players().length; i++) f.zone(f.spot(2, arena - 6), 2.5, 30 + i * 8, (q) => hurt(q, 7, "magic", f.entity), "minecraft:endrod"); } },
  { id: "mark", every: 200, windup: 60, warn: "One of you is marked. Stand apart!", when: has("mark"),
    start: (f) => f.target(),
    show: (f, t) => alive(t) && ring(f.dim, t.location, 4, "minecraft:villager_angry", 12),
    hit: (f, t) => {
      if (!alive(t)) return;
      const others = f.players().filter((p) => p.id !== t.id && flat(p.location, t.location) <= 4);
      for (const p of others) hurt(p, 10, "magic", f.entity);
      hurt(t, others.length || f.solo() ? 6 : 2, "magic", f.entity); // alone, the mark still bites a little
      particle(f.dim, "minecraft:large_explosion", t.location);
    } },
  { id: "wall", every: 230, windup: 20, warn: "A line of fire crosses the floor. Find the gap!", when: has("wall"),
    hit: (f) => {
      const a = Math.random() * Math.PI, gap = Math.floor(Math.random() * 9) - 4;
      for (let i = -6; i <= 6; i++) {
        if (i === gap || i === gap + 1) continue;
        f.zone({ x: f.center.x + Math.cos(a) * i * 3.5, y: f.center.y, z: f.center.z + Math.sin(a) * i * 3.5 }, 2, 45, (q) => { hurt(q, 9, "fire", f.entity); q.setOnFire(3, true); });
      }
    } },
];

function describe(f, fresh) {
  // Which Pretender is this? The one that has risen, or (summoned for a test) a one-off.
  const c = store.data.current;
  f.data.p = c && typeOf(c) === f.def.type ? c : makePretender(Math.floor(Math.random() * 2 ** 31));
  if (!f.data.p.body) f.data.p.body = f.def.type.slice("siege:pretender_".length);
  const p = f.data.p, claim = CLAIMS[p.claim];
  try { f.entity.nameTag = `§5${p.name}${f.temper ? `§7, ${f.temper.name}` : ""}`; } catch { /* cosmetic */ }
  f.data.fifths = 4; f.data.twin = false;
  if (fresh) f.say(`§5${p.name}§7 stands at the Seat. §d${claim.name}.§7 ${claim.line} §8(${claim.hint})`);
}

function pretenderDef(body) {
  return {
    id: `pretender_${body}`, type: `siege:pretender_${body}`, name: "The Pretender", radius: arena, phases: [0.5], points: 6,
    intro: "turns from the Seat.",
    phaseNames: ["", "It will not give the Seat up"],
    attacks: ATTACKS,
    onStart: describe,
    onPhase: (f) => {
      for (const a of ATTACKS) f.next[a.id] = Math.min(f.next[a.id], a.every * 0.6); // angrier in the second half
      if (claimIs(f, "twinned")) {
        f.data.twin = true; f.shield(true);
        f.summon("siege:mirror_knight", 1, 4);
        f.say("§5A second one steps out of the first.§7 Nothing will hurt it while its twin stands.");
      }
    },
    onHurt: (f, event) => {
      const by = event.damageSource.damagingEntity;
      if (claimIs(f, "mirrored") && event.damageSource.cause === "projectile" && by?.typeId === "minecraft:player") {
        heal(f.entity, event.damage);
        hurt(by, Math.max(2, event.damage * 0.5), "magic", f.entity);
        by.onScreenDisplay.setActionBar("§5Your shot comes back at you.");
      }
    },
    tick: (f, players) => {
      if (claimIs(f, "unbled") && f.tick % 20 === 0 && !players.some((p) => flat(p.location, f.entity.location) <= 6)) {
        heal(f.entity, healthOf(f.entity).max * 0.01);
        particle(f.dim, "minecraft:heart_particle", f.entity.getHeadLocation());
      }
      if (claimIs(f, "attended") && f.hp() < f.data.fifths * 0.2) {
        f.data.fifths -= 1;
        f.summon("siege:tolling_shade", 1, 6);
        f.bar("§5Another follower climbs up to stand with it.");
      }
      if (f.data.twin && !f.adds("siege:mirror_knight").length) {
        f.data.twin = false; f.shield(false); f.stun(60);
        f.say("§5The twin is gone. It staggers.");
      }
    },
    loot: (f, p) => {
      const who = f.data.p, seal = makeItem("siege:pretender_seal", 1);
      if (seal) {
        seal.nameTag = `§dSeal of ${who.name}`;
        seal.setLore([`§7Claimant ${who.n ? `number ${who.n}` : "unnumbered"}. ${CLAIMS[who.claim].name}.`, "§8They meant to rule the Hollow. You disagreed."]);
      }
      return [seal, stack("siege:choirsteel_ingot", 3), stack("siege:hollow_ash", 8)];
    },
    hoard: (f, players) => [stack("siege:choirsteel_ingot", 4 + 2 * players.length), stack("siege:gloamquill", 2), stack("minecraft:diamond", 2 + players.length), stack("siege:hollow_ash", 16)],
    onDeath: (f, players) => {
      const who = f.data.p, d = store.data;
      if (d.current && d.current.seed === who.seed) {
        d.last = { name: who.name, body: who.body, claim: who.claim, kit: who.kit };
        d.fallen.push(who.name); if (d.fallen.length > 40) d.fallen.shift();
        d.current = undefined; d.nextDay = nextRise(today(), Math.random());
        store.save();
        everyone(`§d${who.name}§5 is put down by ${players.map((p) => p.name).join(", ") || "someone"}. The Seat is empty again, and the seep draws back.`);
        announce("siege:pretender_fallen", { n: who.n, name: who.name, players: players.map((p) => p.id), ...(f.lastHitter ? { killer: f.lastHitter } : {}) });
      }
    },
  };
}
for (const body of BODIES) registerBoss(pretenderDef(body));

// Hungering: every blow it lands feeds it
world.afterEvents.entityHurt.subscribe((event) => {
  const by = event.damageSource.damagingEntity;
  if (!by?.typeId?.startsWith("siege:pretender_") || event.hurtEntity.typeId !== "minecraft:player") return;
  const f = fightOf(by.typeId.slice("siege:".length));
  if (f && claimIs(f, "hungering")) {
    heal(by, healthOf(by).max * 0.04);
    effect(event.hurtEntity, "hunger", 100, 1);
  }
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  const src = event.sourceEntity;
  if (event.id === "siege:pretender_rise") {
    if (!src) return;
    const seed = parseInt(event.message, 10);
    store.data.current = undefined;
    rise(Number.isFinite(seed) ? seed : undefined, src.location, src.dimension);
  } else if (event.id === "siege:pretender_status" && src?.typeId === "minecraft:player") {
    const d = store.data, c = d.current;
    src.sendMessage(c ? `§5${c.name}§7 (claimant ${c.n}): ${CLAIMS[c.claim].name}, powers ${c.kit.join(", ")}, sat ${today() - c.day} days, seep x${surgeFor(today() - c.day)}.`
      : `§7No claimant. ${bestiaryStore.data.defeated?.morvane > 0 ? `The next comes on day ${d.nextDay ?? "?"} (today is ${today()}).` : "None will come until Morvane has fallen."}`);
    if (d.fallen.length) src.sendMessage(`§8Put down so far: ${d.fallen.join("; ")}`);
  }
});

addTests("bestiary", {
  "Pretenders: the same seed is the same claimant": () => assertEqual(makePretender(42), makePretender(42)),
  "Pretenders: each has four different powers and a claim": () => {
    for (let seed = 1; seed < 200; seed++) {
      const p = makePretender(seed);
      assertEqual(new Set(p.kit).size, PRETENDERS.kitSize, `seed ${seed}`);
      assert(p.kit.every((k) => POWERS.includes(k)) && CLAIMS[p.claim] && BODIES.includes(p.body), `seed ${seed}`);
    }
  },
  "Pretenders: the next is never like the last": () => {
    let before = makePretender(1);
    for (let seed = 2; seed < 300; seed++) {
      const p = makePretender(seed, before);
      assert(p.name !== before.name && p.body !== before.body && p.claim !== before.claim, `seed ${seed} repeats the last`);
      assert(p.kit.filter((k) => before.kit.includes(k)).length <= 2, `seed ${seed} shares too many powers`);
      before = p;
    }
  },
  "Pretenders: a long war does not run out of claimants": () => {
    const names = new Set(), fights = new Set();
    for (let seed = 1; seed <= 400; seed++) { const p = makePretender(seed); names.add(p.name); fights.add(`${p.body}|${p.claim}|${[...p.kit].sort()}`); }
    assert(names.size > 150, `only ${names.size} names in 400`);
    assert(fights.size > 300, `only ${fights.size} different fights in 400`);
  },
  "Pretenders: every power has a fight to go with it": () => {
    assertEqual(ATTACKS.map((a) => a.id), POWERS);
    for (const a of ATTACKS) assert(a.warn && a.windup <= a.every, a.id);
  },
  "Pretenders: the seep surges the longer one sits, up to a limit": () => {
    assertEqual([0, 1, 2, 4, 30].map(surgeFor), [1, 1.5, 2, 3, 3]);
    assertEqual(nextRise(10, 0), 16);
    assertEqual(nextRise(10, 0.999), 21);
  },
});
