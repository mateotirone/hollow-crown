// The seven boss fights. Each one is a definition handed to bossCore.js (read its header first).
// The Hollow Choir, the last boss, is built by the Undertow thread on the same framework.
//
// Numbers worth tweaking are near the top of each boss. Times are in game ticks (20 = 1 second).

import { system } from "@minecraft/server";
import { RAIDER_TAG, WARLORD_TAG, KING_TAG, addTests, assert, assertEqual } from "../siege/api.js";
import { registerBoss, bossDefs, stack } from "./bossCore.js";
import { MOBS, ITEMS } from "./data.js";
import { alive, effect, flat, heal, hurt, held, isLookingAt, line, particle, ring, shove, sound } from "./util.js";

const perPlayer = (f, base, each) => base + each * Math.max(0, f.players().length - 1);
const floorOf = (f, p) => ({ x: p.x, y: f.def.roaming ? p.y : f.center.y, z: p.z });
const hasVeil = (p) => held(p, "Head") === "siege:widows_veil";

// Shared: "stand on the lit tiles" (the Reeve's time-stop and Oswin's toll)
function tiles(count, onMiss, missText) {
  return {
    start: (f) => Array.from({ length: count(f) }, () => f.spot(3, Math.min(11, f.def.radius - 4))),
    show: (f, spots) => {
      for (const s of spots) {
        ring(f.dim, s, 2.2, "minecraft:villager_happy", 14);
        particle(f.dim, "minecraft:endrod", { x: s.x, y: s.y + 1, z: s.z });
      }
    },
    hit: (f, spots) => {
      ring(f.dim, f.entity.location, 6, "minecraft:sonic_explosion", 6);
      for (const p of f.players()) {
        if (spots.some((s) => flat(p.location, s) <= 2.4)) continue;
        onMiss(f, p);
        p.onScreenDisplay.setActionBar(missText);
      }
    },
  };
}

// The Reeve's cog: a real spinning gear (siege:spinning_cog) flies from his chest to `to`, landing in `ticks`,
// just as the marked zone there goes off. It's only the picture: the zone does the damage, so dodging works.
export function flingCog(f, to, ticks) {
  const at = f.entity.location;
  const from = { x: at.x, y: at.y + 4, z: at.z };
  const end = { x: to.x, y: to.y + 0.7, z: to.z };
  const d = Math.hypot(end.x - from.x, end.z - from.z) || 1;
  const facing = { x: end.x + (end.x - from.x) / d * 4, y: end.y, z: end.z + (end.z - from.z) / d * 4 };
  const cog = f.place("siege:spinning_cog", from);
  if (!cog) return undefined;
  sound(f.dim, "mob.irongolem.throw", from, 0.6, 1);
  let t = 0;
  const run = system.runInterval(() => {
    t++;
    if (!cog.isValid) return system.clearRun(run);
    const k = Math.min(1, t / Math.max(1, ticks));
    try {
      cog.teleport(cogPath(from, end, k), { facingLocation: facing });
      if (t % 4 === 0) particle(f.dim, "minecraft:basic_crit_particle", cog.location);
      if (k >= 1) { sound(f.dim, "random.anvil_land", end, 1.6, 0.5); cog.remove(); }
    } catch { /* chunk unloaded: the prop's own timer clears it */ }
    if (k >= 1) system.clearRun(run);
  }, 1);
  return cog;
}

// Where the thrown cog is, k of the way there (0 to 1): straight at you with a little lift in the middle
export function cogPath(from, end, k) {
  return { x: from.x + (end.x - from.x) * k, y: from.y + (end.y - from.y) * k + Math.sin(k * Math.PI) * 1.5, z: from.z + (end.z - from.z) * k };
}

// Shared: a straight line from the boss toward where a player was standing. Dodge sideways.
export function lance(length, damage, after) {
  return {
    start: (f) => {
      const t = f.target();
      if (!t) return undefined;
      const from = { ...f.entity.location };
      const d = flat(from, t.location) || 1;
      return { from, dir: { x: (t.location.x - from.x) / d, z: (t.location.z - from.z) / d }, reach: Math.min(length, d + 3) };
    },
    show: (f, c) => c && line(f.dim, { x: c.from.x, y: c.from.y + 1, z: c.from.z },
      { x: c.from.x + c.dir.x * c.reach, y: c.from.y + 1, z: c.from.z + c.dir.z * c.reach }, "minecraft:redstone_wire_dust_particle", 0.6),
    hit: (f, c) => {
      if (!c) return;
      for (const p of f.players()) {
        if (distanceToLine(p.location, c.from, c.dir, c.reach) <= 1.6) hurt(p, damage, "entityAttack", f.entity);
      }
      after?.(f, c);
    },
  };
}

// How far a point is from a line segment (flat). Exported for the self-test.
export function distanceToLine(p, from, dir, reach) {
  const t = Math.max(0, Math.min(reach, (p.x - from.x) * dir.x + (p.z - from.z) * dir.z));
  return Math.hypot(p.x - (from.x + dir.x * t), p.z - (from.z + dir.z * t));
}

// The far side of the hall from where you stood
export const mirrorPoint = (p, c) => ({ x: 2 * c.x - p.x, y: p.y, z: 2 * c.z - p.z });

const materials = (...pairs) => pairs.map(([id, n]) => stack(id, n));
const regionalHoard = (extra) => (f, players) => [
  stack("siege:choir_shard", 1), // the Undertow thread's item: five of these make the Tuning Fork
  stack("siege:gold_coin", 3 + players.length), stack("minecraft:diamond", 3 + players.length),
  stack("siege:hollow_ash", 12), ...extra,
];

// =====================================================================================
// 1. The Clockwork Reeve (Millbrook, Aldmere Vale)
//    Time-stop pulses freeze you unless you stand on a lit tile. At 60% he splits into three Cogs
//    and can't be hurt until they're scrap. At 30% the clock runs fast.
// =====================================================================================
registerBoss({
  id: "reeve", type: "siege:clockwork_reeve", name: "The Clockwork Reeve", radius: 24, phases: [0.6, 0.3],
  intro: "winds himself. The minute will not end.",
  phaseNames: ["", "The gears come apart", "Overwound"],
  attacks: [
    { id: "timestop", every: 320, windup: 70, warn: "The clock strikes! Stand on a lit tile!", sound: "block.bell.hit",
      ...tiles((f) => (f.phase >= 2 ? 2 : 3), (f, p) => {
        effect(p, "slowness", 80, 255); effect(p, "weakness", 80, 255); effect(p, "mining_fatigue", 80, 3);
        hurt(p, 6);
      }, "§bTime stops around you.") },
    { id: "cog", every: 110, windup: 25, warn: "A cog comes spinning at you!",
      start: (f) => {
        for (const p of f.players()) {
          const spot = floorOf(f, p.location);
          f.zone(spot, 2.5, 25, (q) => hurt(q, 7, "entityAttack", f.entity), "minecraft:basic_crit_particle");
          flingCog(f, spot, 25);
        }
      } },
    // The minute runs backwards: everyone is put back where they stood when the hands began to turn, and a cog is already on its way there
    { id: "rewind", every: 260, windup: 40, warn: "The hands turn back. Remember where you are standing!", sound: "block.bell.hit",
      start: (f) => f.players().map((p) => ({ p, at: { ...p.location } })),
      show: (f, marks) => { for (const m of marks) ring(f.dim, m.at, 1.2, "minecraft:endrod", 8); },
      hit: (f, marks) => {
        for (const m of marks) {
          if (!alive(m.p)) continue;
          try { m.p.teleport(m.at); } catch { continue; }
          m.p.onScreenDisplay.setActionBar("§bThe minute runs backwards. Move!");
          f.zone(floorOf(f, m.at), 2.5, 20, (q) => hurt(q, 8, "entityAttack", f.entity), "minecraft:basic_crit_particle");
          flingCog(f, floorOf(f, m.at), 20);
        }
      } },
  ],
  onPhase: (f, n) => {
    if (n === 1) {
      f.shield(true);
      f.stun(100000);
      f.data.split = true;
      f.summon("siege:reeve_cog", 3, 5);
      f.say("§6The Reeve's gears fly apart. Break the three Cogs!");
    } else {
      effect(f.entity, "speed", 100000, 1);
      for (const a of f.def.attacks) f.next[a.id] = Math.min(f.next[a.id], 40);
    }
  },
  tick: (f) => {
    if (f.data.split && !f.adds("siege:reeve_cog").length) {
      f.data.split = false;
      f.shield(false);
      try { f.entity.removeEffect("slowness"); f.entity.removeEffect("weakness"); } catch { /* gone */ }
      f.busyUntil = f.tick + 60;
      f.say("§6The Reeve pulls himself back together, slower than before.");
    }
    if (f.phase >= 2 && f.tick % 200 === 0) f.next.timestop = Math.min(f.next.timestop, 120);
  },
  loot: (f, p, first) => (first ? [stack("siege:minute_hand")] : []).concat(materials(["siege:clockwork_cog", first ? 4 : 2])),
  hoard: regionalHoard([stack("siege:clockwork_cog", 6), stack("minecraft:clock", 1), stack("minecraft:gold_ingot", 12)]),
});

// =====================================================================================
// 2. The Pale Huntsman (Rimehold, Frostmarch)
//    He vanishes into the blizzard: watch for his breath. "Marked" shots miss if you break line of
//    sight. At 60% the Rimewolves come. At 25% he anchors himself in three Rime Pillars: break them.
// =====================================================================================
registerBoss({
  id: "huntsman", type: "siege:pale_huntsman", name: "The Pale Huntsman", radius: 28, phases: [0.6, 0.25], standoff: 10,
  intro: "is already watching you.",
  phaseNames: ["", "The pack answers", "Anchored in ice"],
  attacks: [
    { id: "marked", every: 150, windup: 50, warn: "You are marked. Break line of sight!",
      start: (f) => f.target(),
      show: (f, t) => alive(t) && line(f.dim, f.entity.getHeadLocation(), t.getHeadLocation(), "minecraft:blue_flame_particle", 1.2),
      hit: (f, t) => {
        if (!alive(t)) return;
        const from = f.entity.getHeadLocation(), to = t.getHeadLocation();
        const d = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) || 1;
        let blocked = false;
        try {
          blocked = !!f.dim.getBlockFromRay(from, { x: (to.x - from.x) / d, y: (to.y - from.y) / d, z: (to.z - from.z) / d }, { maxDistance: d - 0.5, includeLiquidBlocks: false, includePassableBlocks: false });
        } catch { /* ray left the loaded world */ }
        if (blocked) return t.onScreenDisplay.setActionBar("§7The arrow shatters on your cover.");
        hurt(t, 12, "projectile", f.entity); effect(t, "slowness", 60, 2);
      } },
    { id: "pack", every: 500, windup: 30, phases: [1, 2], warn: "A horn in the snow. The pack is coming.", sound: "raid.horn",
      when: (f) => f.adds("siege:rimewolf").length < 2,
      hit: (f) => f.summon("siege:rimewolf", perPlayer(f, 2, 1), 9, f.center) },
    // Snares under the snow: step in one and you are held where the next marked shot can find you
    { id: "snare", every: 230, windup: 20, warn: "Snares under the snow. Watch where you run!",
      hit: (f) => {
        for (const p of f.players()) {
          for (let i = 0; i < 3; i++) {
            const a = Math.random() * Math.PI * 2, d = 3 + Math.random() * 4;
            f.zone(floorOf(f, { x: p.location.x + Math.cos(a) * d, y: p.location.y, z: p.location.z + Math.sin(a) * d }), 1.8, 60 + i * 30,
              (q) => { effect(q, "slowness", 70, 255); hurt(q, 4, "freezing"); q.onScreenDisplay.setActionBar("§bThe snare closes on your leg."); }, "minecraft:snowflake_particle");
          }
        }
      } },
  ],
  tick: (f, players) => {
    // The blizzard: he is hidden most of the time, and only his breath gives him away
    const hidden = f.tick % 220 < 140 && !f.data.cracked;
    if (hidden) {
      effect(f.entity, "invisibility", 12, 0);
      if (f.tick % 10 === 0) particle(f.dim, "minecraft:basic_smoke_particle", f.entity.getHeadLocation());
    }
    for (const p of players) {
      if (f.tick % 40 === 0) effect(p, "slowness", 50, 0);
      particle(f.dim, "minecraft:snowflake_particle", { x: p.location.x, y: p.location.y + 2, z: p.location.z });
    }
    if (f.data.pillars && !f.adds("siege:rime_pillar").length) {
      f.data.pillars = false; f.data.cracked = true;
      f.shield(false); f.stun(160);
      f.say("§bThe last pillar breaks. The cold goes out of him. Strike now!");
    }
  },
  onPhase: (f, n) => {
    if (n === 1) f.next.pack = 0;
    if (n === 2) {
      f.shield(true); f.data.pillars = true;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        f.place("siege:rime_pillar", { x: f.center.x + Math.cos(a) * 8, y: f.center.y, z: f.center.z + Math.sin(a) * 8 });
      }
      f.say("§bHe drives three pillars of ice into the ground. Nothing will hurt him while they stand.");
    }
  },
  loot: (f, p, first) => (first ? [stack("siege:rimefang_bow")] : []).concat(materials(["siege:pale_antler", first ? 4 : 2], ["siege:rime_pelt", 3])),
  hoard: regionalHoard([stack("siege:pale_antler", 6), stack("minecraft:arrow", 64), stack("minecraft:packed_ice", 16)]),
});

// =====================================================================================
// 3. The Drowned Bride (Gull's Rest, Saltreach)
//    The tide rises the whole fight and faster each phase. Ring all three Chapel Bells within
//    10 seconds of each other to turn it. At full tide, everyone drowns.
// =====================================================================================
const TIDE_RATE = [0.35, 0.55, 0.8]; // tide gained per framework step (4 steps a second), by phase
export const tideBar = (tide) => `§3Tide §b${"▮".repeat(Math.round(tide / 10))}§8${"▯".repeat(10 - Math.round(tide / 10))} §f${Math.round(tide)}%`;

registerBoss({
  id: "bride", type: "siege:drowned_bride", name: "The Drowned Bride", radius: 24, phases: [0.66, 0.33],
  intro: "rises with the tide. Ring the bells to turn it.",
  phaseNames: ["", "The water climbs", "High tide"],
  onStart: (f) => {
    f.data.tide = 0; f.data.rung = {};
    if (f.adds("siege:chapel_bell").length) return;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      f.place("siege:chapel_bell", { x: f.center.x + Math.cos(a) * 9, y: f.center.y, z: f.center.z + Math.sin(a) * 9 });
    }
  },
  attacks: [
    { id: "wail", every: 190, windup: 30, warn: "She draws breath to wail...",
      hit: (f) => {
        for (const p of f.players()) {
          if (flat(p.location, f.entity.location) > 14) continue;
          shove(p, f.entity.location.x - p.location.x, f.entity.location.z - p.location.z, 1.6, 0.2);
          hurt(p, 5);
        }
      } },
    { id: "grasp", every: 130, windup: 30, warn: "Hands reach up out of the water. Move!",
      start: (f) => {
        for (const p of f.players()) f.zone(floorOf(f, p.location), 2, 30, (q) => { effect(q, "slowness", 60, 255); hurt(q, 4, "drowning"); }, "minecraft:water_splash_particle");
      } },
    { id: "drowned", every: 400, windup: 20, phases: [1, 2], warn: "The drowned climb out of the water.",
      when: (f) => f.adds("minecraft:drowned").length < 4,
      hit: (f) => f.summon("minecraft:drowned", perPlayer(f, 2, 1), 8, f.center) },
  ],
  tick: (f, players) => {
    const d = f.data;
    d.tide = Math.min(100, (d.tide ?? 0) + TIDE_RATE[f.phase]);
    if (f.tick % 20 !== 0) return;
    for (const p of players) {
      p.onScreenDisplay.setActionBar(tideBar(d.tide));
      if (hasVeil(p)) continue; // the Widow's Veil lets you breathe it
      if (d.tide >= 40) effect(p, "slowness", 30, d.tide >= 70 ? 1 : 0);
      if (d.tide >= 70) effect(p, "mining_fatigue", 30, 1);
      if (d.tide >= 100) hurt(p, 4, "drowning");
    }
    if (f.phase >= 2 && d.tide >= 70) heal(f.entity, f.entity.getComponent("health").effectiveMax * 0.01);
  },
  onPropHit: (f, bell, player) => {
    if (bell.typeId !== "siege:chapel_bell" || f.tick < (f.data.bellLock ?? 0)) return;
    f.data.rung[bell.id] = f.tick;
    sound(f.dim, "block.bell.hit", bell.location, 0.8 + Object.keys(f.data.rung).length * 0.15, 2);
    try { bell.triggerEvent("siege:ring"); } catch { /* bell gone */ }
    const fresh = Object.values(f.data.rung).filter((t) => f.tick - t <= (f.solo() ? 360 : 200)).length; // alone you get 18 seconds to reach all three
    if (fresh < 3) return player.onScreenDisplay.setActionBar(`§6${fresh} of 3 bells ringing...`);
    f.data.tide = 0; f.data.rung = {}; f.data.bellLock = f.tick + 240;
    f.stun(60);
    f.say("§6All three bells ring together. The tide turns!");
    f.after(100, () => { for (const b of f.adds("siege:chapel_bell")) try { b.triggerEvent("siege:quiet"); } catch { /* gone */ } });
  },
  loot: (f, p, first) => (first ? [stack("siege:widows_veil")] : []).concat(materials(["siege:drowned_pearl", first ? 4 : 2], ["siege:brine_scale", 3])),
  hoard: regionalHoard([stack("siege:drowned_pearl", 6), stack("minecraft:heart_of_the_sea", 1), stack("minecraft:prismarine_crystals", 16)]),
});

// =====================================================================================
// 4. The Ash Seneschal (Sunscar, Emberwaste)
//    Every 15 seconds he studies what hurt him most (blade or arrow) and turns that against you:
//    he shrugs it off and fights back the same way. Switch weapons. At 50% the sand starts to give.
// =====================================================================================
registerBoss({
  id: "seneschal", type: "siege:ash_seneschal", name: "The Ash Seneschal", radius: 26, phases: [0.5],
  intro: "turns a face with nothing on it toward you.",
  phaseNames: ["", "The floor gives way"],
  onStart: (f) => { f.data.hits = { melee: 0, ranged: 0 }; },
  onHurt: (f, event) => {
    const kind = event.damageSource.cause === "projectile" ? "ranged" : event.damageSource.cause === "entityAttack" ? "melee" : undefined;
    if (kind) f.data.hits[kind] += event.damage;
  },
  attacks: [
    { id: "bash", every: 170, windup: 20, warn: "He raises the greatshield!",
      hit: (f) => {
        for (const p of f.players()) {
          if (flat(p.location, f.entity.location) > 5) continue;
          shove(p, p.location.x - f.entity.location.x, p.location.z - f.entity.location.z, 2.2, 0.5);
          hurt(p, 6, "entityAttack", f.entity);
        }
      } },
    { id: "cleave", every: 100, windup: 20, warn: "He answers steel with steel!", when: (f) => f.data.stance === "melee",
      start: (f) => { const t = f.target(); if (t) f.zone(floorOf(f, t.location), 3, 20, (q) => hurt(q, 10, "entityAttack", f.entity), "minecraft:basic_crit_particle"); } },
    { id: "volley", every: 100, windup: 30, warn: "He answers arrows with arrows!", when: (f) => f.data.stance === "ranged",
      start: (f) => { for (const p of f.players()) f.zone(floorOf(f, p.location), 2.5, 30, (q) => hurt(q, 7, "projectile", f.entity), "minecraft:basic_crit_particle"); } },
    { id: "sand", every: 150, windup: 50, phases: [1], warn: "The sand is giving way under you!",
      start: (f) => {
        for (let i = 0; i < perPlayer(f, 4, 2); i++) {
          f.zone(f.spot(0, f.def.radius - 4), 3.2, 50, (q) => { effect(q, "slowness", 80, 4); hurt(q, 6, "suffocation"); }, "minecraft:basic_smoke_particle");
        }
      } },
  ],
  tick: (f) => {
    if (f.tick % 300 !== 0) return;
    const { melee, ranged } = f.data.hits;
    f.data.hits = { melee: 0, ranged: 0 };
    if (melee + ranged < 10) return;
    const stance = melee >= ranged ? "melee" : "ranged";
    if (stance === f.data.stance) return;
    f.data.stance = stance;
    try {
      f.entity.removeTag("siege_stance_melee"); f.entity.removeTag("siege_stance_ranged");
      f.entity.addTag(`siege_stance_${stance}`);
    } catch { /* gone */ }
    f.say(stance === "melee" ? "§6The Seneschal has learned your blade. Steel barely bites him now. Try arrows."
      : "§6The Seneschal has learned your arrows. They glance off him now. Close in.");
    ring(f.dim, f.entity.location, 2, "minecraft:totem_particle", 16);
  },
  loot: (f, p, first) => (first ? [stack("siege:seneschal_greatshield"), stack("siege:faceless_crown_shard")] : []).concat(materials(["siege:ash_glass", first ? 6 : 3])),
  hoard: regionalHoard([stack("siege:ash_glass", 8), stack("siege:wyrm_scale", 4), stack("minecraft:gold_block", 2)]),
});

// =====================================================================================
// 5. The Mother of Changelings (Mirelight, Blackfen)
//    She hides among copies of herself. Hit the real one to end it; hit a copy and it bursts into
//    poison and a Changeling. Echo Sight, her true name, or the Widow's Veil shows which is real.
//    Everyone else: the real one sheds a spore now and then. Watch closely.
// =====================================================================================
const canSeeTruth = (p) => p.hasTag("siege_echo_sight") || p.hasTag("siege_true_name") || hasVeil(p);

function masquerade(f) {
  if (f.data.masq) return;
  f.data.masq = { until: f.tick + 500 };
  f.paused = true; // no other attacks while she hides
  const copies = perPlayer(f, f.phase >= 2 ? 7 : 5, 1);
  try { f.entity.teleport(f.spot(3, 12)); } catch { /* chunk not ready */ }
  for (let i = 0; i < copies; i++) {
    const e = f.place("siege:mother_echo", f.spot(3, 12));
    if (e) e.nameTag = f.def.name; // no colour code: the boss bar colours the title (tools/bossbar_ui.py)
  }
  for (const p of f.players()) { effect(p, "blindness", 30, 0); sound(f.dim, "mob.witch.celebrate", p.location, 0.6); }
  f.say("§2\"Which of us is your mother, little thing?\"");
}

function endMasquerade(f, found) {
  f.data.masq = undefined; f.paused = false;
  f.data.nextMasq = f.tick + 900;
  for (const e of f.adds("siege:mother_echo")) {
    particle(f.dim, "minecraft:large_explosion", e.location);
    try { e.remove(); } catch { /* gone */ }
  }
  if (found) {
    f.stun(100);
    f.say("§6You found her. She reels.");
  } else {
    heal(f.entity, f.entity.getComponent("health").effectiveMax * 0.1);
    for (const p of f.players()) effect(p, "poison", 120, 0);
    f.say("§2\"Wrong. Wrong. Wrong.\"§7 She feeds on your mistake.");
  }
}

registerBoss({
  id: "mother", type: "siege:mother_of_changelings", name: "The Mother of Changelings", radius: 24, phases: [0.66, 0.33],
  intro: "smiles with someone else's face.",
  phaseNames: ["", "More masks", "The whole brood"],
  onStart: (f) => { f.data.nextMasq = f.tick + 200; },
  onPhase: (f) => { f.data.nextMasq = f.tick; },
  onHurt: (f, event) => {
    if (f.data.masq && event.damageSource.damagingEntity?.typeId === "minecraft:player") endMasquerade(f, true);
  },
  onAddDie: (f, add, killer) => {
    if (add.typeId !== "siege:mother_echo") return;
    if (killer) effect(killer, "poison", 100, 1);
    const [child] = f.summon("siege:changeling", 1, 1, add.location);
    try { child?.triggerEvent("siege:reveal"); } catch { /* gone */ }
  },
  attacks: [
    { id: "roots", every: 140, windup: 30, warn: "Roots are coiling under your feet!",
      start: (f) => { for (const p of f.players()) f.zone(floorOf(f, p.location), 2, 30, (q) => { effect(q, "slowness", 70, 255); hurt(q, 5); }, "minecraft:villager_angry"); } },
    { id: "brood", every: 380, windup: 20, phases: [1, 2], warn: "She calls her children.", when: (f) => f.adds("siege:changeling").length < 4,
      hit: (f) => { for (const c of f.summon("siege:changeling", 2, 6)) try { c.triggerEvent("siege:reveal"); } catch { /* gone */ } } },
    // She hums something you half know. Anyone still looking at her when it ends forgets where they are.
    { id: "lullaby", every: 260, windup: 40, warn: "She begins to hum. Look away from her!", sound: "note.flute", when: (f) => !f.data.masq,
      show: (f) => particle(f.dim, "minecraft:note_particle", f.entity.getHeadLocation()),
      hit: (f) => {
        const head = f.entity.getHeadLocation();
        for (const p of f.players()) {
          let looking = false;
          try { looking = isLookingAt(p.getHeadLocation(), p.getViewDirection(), head, 0.7); } catch { /* gone */ }
          if (!looking) continue;
          effect(p, "blindness", 80, 0); effect(p, "nausea", 160, 0); hurt(p, 6);
          p.onScreenDisplay.setActionBar("§2You know this song. You cannot think whose it was.");
        }
      } },
  ],
  tick: (f, players) => {
    const m = f.data.masq;
    if (!m) {
      if (f.tick >= (f.data.nextMasq ?? Infinity)) masquerade(f);
      return;
    }
    if (f.tick >= m.until) return endMasquerade(f, false);
    const at = f.entity.location;
    if (f.tick % 40 === 0) particle(f.dim, "minecraft:villager_happy", { x: at.x, y: at.y + 0.3, z: at.z }); // the tell
    for (const p of players) {
      if (!canSeeTruth(p)) continue;
      try { for (let y = 0; y < 3; y++) p.spawnParticle("minecraft:endrod", { x: at.x, y: at.y + y, z: at.z }); } catch { /* cosmetic */ }
    }
  },
  loot: (f, p, first) => (first ? [stack("siege:mire_heart")] : []).concat(materials(["siege:changeling_ichor", first ? 4 : 2], ["siege:toad_venom", 3])),
  hoard: regionalHoard([stack("siege:changeling_ichor", 6), stack("minecraft:slime_ball", 16), stack("minecraft:golden_apple", 3)]),
});

// =====================================================================================
// 6. The Warlord King (the Grand Siege)
//    Rides a Siege Ogre and takes much less damage until he's off it. At 66% (or when the ogre dies)
//    he fights on foot with the crown shard. At 30% the shard set in his iron crown wakes: jump the quakes.
//    (His crown is NOT the Hollow Crown, which is on Morvane's head until the end. It is a warlord's crown with a splinter of the Hollow in it.)
//    Siege Nights still decides what his death means (Sovereign); this is only the fight.
// =====================================================================================
const armyTags = (f) => {
  try {
    return f.entity.getTags().filter((t) => t === RAIDER_TAG || t.startsWith("siege_for_"));
  } catch {
    return [];
  }
};

registerBoss({
  id: "warlord_king", type: "siege:warlord_king", name: "The Warlord King", radius: 40, phases: [0.66, 0.3],
  roaming: true, dropLoot: true, points: 8,
  intro: "rides onto the field on the back of an ogre.",
  phaseNames: ["", "On foot, the shard burning", "The shard wakes"],
  onStart: (f, fresh) => {
    if (!fresh) return;
    const [ogre] = f.summon("siege:siege_ogre", 1, 0.5, f.entity.location, armyTags(f));
    if (!ogre) return;
    f.data.ogre = ogre;
    system.runTimeout(() => {
      try { ogre.getComponent("rideable")?.addRider(f.entity); } catch { /* he walks instead */ }
    }, 5);
  },
  onPhase: (f, n) => {
    if (n === 1) dismount(f, "§6The Warlord King leaps down, the crown shard blazing.");
    if (n === 2) { effect(f.entity, "speed", 100000, 0); f.say("§4The shard in his crown opens like an eye."); }
  },
  attacks: [
    { id: "warcry", every: 300, windup: 20, phases: [0], warn: "The Warlord King bellows an order!", sound: "raid.horn",
      hit: (f) => { for (const e of f.dim.getEntities({ families: ["siege_raider"], location: f.entity.location, maxDistance: 16 })) effect(e, "strength", 200, 0, true); } },
    { id: "lance", every: 130, windup: 40, phases: [1, 2], warn: "The shard takes aim. Sidestep!", ...lance(18, 10) },
    { id: "toll", every: 480, windup: 30, phases: [1, 2], warn: "The shard tolls. More of them answer.", sound: "block.bell.hit",
      when: (f) => f.adds("siege:hollow_footman").length < 3,
      hit: (f) => { f.summon("siege:hollow_footman", perPlayer(f, 3, 1), 8, f.entity.location, armyTags(f)); f.summon("siege:bell_ringer", 1, 8, f.entity.location, armyTags(f)); } },
    { id: "quake", every: 150, windup: 30, phases: [2], warn: "The shard strikes the ground. JUMP!",
      show: (f) => ring(f.dim, f.entity.location, 4 + (f.tick % 30) / 3, "minecraft:basic_smoke_particle"),
      hit: (f) => {
        ring(f.dim, f.entity.location, 10, "minecraft:large_explosion", 10);
        for (const p of f.players()) {
          if (flat(p.location, f.entity.location) > 11 || !p.isOnGround) continue;
          hurt(p, 9, "entityAttack", f.entity); shove(p, p.location.x - f.entity.location.x, p.location.z - f.entity.location.z, 1.2, 0.7);
        }
      } },
  ],
  tick: (f) => {
    const ogre = f.data.ogre;
    if (!ogre) return;
    if (alive(ogre)) effect(f.entity, "resistance", 15, 2);
    else if (f.phase === 0 && !f.data.unhorsed) { f.data.unhorsed = true; f.say("§6The ogre falls, and the Warlord King with it. He gets up angry."); }
  },
  loot: (f, p, first) => (first ? [stack("siege:warlords_brand")] : []).concat(materials(["siege:hollow_ash", 8], ["siege:gold_coin", 2])),
  hoard: () => [],
});

function dismount(f, text) {
  const ogre = f.data.ogre;
  if (alive(ogre)) {
    try { ogre.getComponent("rideable")?.ejectRider(f.entity); } catch { /* wasn't riding */ }
    effect(ogre, "strength", 100000, 0); effect(ogre, "speed", 100000, 0);
  }
  f.say(text);
}

// Morvane, the last fight, has his own file: morvane.js.

// ---------- Siege Nights: warlords use the new bodies ----------
export function warlordBody(type, tags) {
  if (tags.includes(KING_TAG)) return "siege:warlord_king";
  if (tags.includes(WARLORD_TAG)) return "siege:hollow_warlord";
  return undefined;
}

addTests("bestiary", {
  "the Reeve's thrown cog starts at his chest and lands on the marked spot": () => {
    const from = { x: 0, y: 70, z: 0 }, end = { x: 6, y: 66, z: -8 };
    assertEqual(cogPath(from, end, 0), from);
    assertEqual(cogPath(from, end, 1).x, 6); assertEqual(Math.round(cogPath(from, end, 1).y * 1000) / 1000, 66); assertEqual(cogPath(from, end, 1).z, -8);
    assert(cogPath(from, end, 0.5).y > 68, "the cog lifts a little mid-flight");
    assert(MOBS["siege:spinning_cog"], "the spinning cog is in the bestiary data");
  },
  "every boss has a body, a name and loot that exists": () => {
    for (const id of ["reeve", "huntsman", "bride", "seneschal", "mother", "warlord_king"]) assert(bossDefs().some((d) => d.id === id), `boss ${id} is not registered`);
    for (const def of bossDefs()) {
      if (!MOBS[def.type]) continue; // another feature's boss (the Hollow Choir): it tests itself
      assert(MOBS[def.type]?.family === "boss", `${def.id}: ${def.type} is not a boss entity`);
      assert((def.attacks ?? []).length >= 2, `${def.id} needs at least two attacks`);
      for (const a of def.attacks ?? []) assert(a.every > (a.windup ?? 0), `${def.id}.${a.id}: windup longer than its cooldown`);
    }
    for (const id of ["minute_hand", "rimefang_bow", "widows_veil", "seneschal_greatshield", "mire_heart", "warlords_brand", "oath_of_oswin", "crownless_mantle"]) {
      assert(ITEMS[`siege:${id}`], `relic siege:${id} is missing`);
    }
  },
  "a lance only hits what stands in its path": () => {
    const from = { x: 0, z: 0 }, dir = { x: 1, z: 0 };
    assert(distanceToLine({ x: 5, z: 1 }, from, dir, 10) <= 1.6);
    assert(distanceToLine({ x: 5, z: 3 }, from, dir, 10) > 1.6);
    assert(distanceToLine({ x: -4, z: 0 }, from, dir, 10) > 1.6, "behind the boss is safe");
  },
  "warlords get their own bodies": () => {
    assertEqual(warlordBody("minecraft:vindicator", [RAIDER_TAG, KING_TAG]), "siege:warlord_king");
    assertEqual(warlordBody("minecraft:vindicator", [RAIDER_TAG, WARLORD_TAG]), "siege:hollow_warlord");
    assertEqual(warlordBody("minecraft:vindicator", [RAIDER_TAG]), undefined);
  },
  "the tide bar reads right": () => assert(tideBar(60).includes("60%") && tideBar(0).includes("0%")),
});

