// The Choir: the Hollow's people, singing the Gate wider. They hold the Court, the hall across the
// story path, and must be silenced before anyone can go on to the Seat (Mateo: the Choir stays its
// own fight, before the last one). Built on the shared boss framework (bestiary/bossCore.js).
// The boss entity is the Conductor; 7 Singers stand around the hall.
//
//   The Hymn     The Singers shield the Conductor. Kill six of them. Every verse still singing
//                calls phantom raiders: the same armies that lay siege to the keeps above.
//                The seventh Singer (the one bound to the real Source) cannot be hurt yet.
//   The Toll     The Conductor can be hurt. Toll: a shockwave you jump. Undertow: a pull toward
//                the walls you crouch against. Echo: your hits come back at you, so hold them.
//   The Closing  At a quarter health the song closes in from the walls, ring by ring: stand outside
//                it and it hurts. The last Singer comes to the centre and feeds the Conductor
//                until it is killed.
//
// When the Conductor dies the Court's gate (and the river's water gate) opens. The framework
// announces siege:boss_defeated {boss:"choir"}; the last handoff now belongs to boss "morvane".
// Numbers to tweak are in CHOIR below.

import { world, system } from "@minecraft/server";
import { registerBoss, fightOf, stack } from "../bestiary/bossCore.js";
import { effect, flat, heal, hurt, ring, shove, sound, particle } from "../bestiary/util.js";
import { UNDERTOW_ID, COURT } from "./layout.js";
import { SOURCE_SITE_IDS, SITE_NAMES, getSourceSite } from "./source.js";
import { pieces } from "./builder.js";
import { load } from "./data.js";

export const CHOIR = {
  singersToSilence: 6, // of 7; the last one is bound to the Source
  raidEvery: 400, // ticks between phantom raids while verses still sing (20 s)
  maxPhantoms: 10,
  tollDamage: 9,
  echoTicks: 80,
  fallAt: 0.25, // health fraction where the song starts to close in
  fallBands: [26, 21, 16, 11], // each ring: everything at or beyond this radius hurts
  fallEvery: 240, // 12 s between rings, each warned 6 s ahead
  closingDamage: 4, // each second you stand outside the ring
  rootFeed: 6, // health the last Singer feeds the Conductor each second
};

// The fight's floor plan, inside the Court's round hall.
const HEART = { center: { x: COURT.center.x, y: COURT.floorY, z: COURT.center.z }, outerRadius: COURT.radius - 3, innerRadius: 7, singerRadius: 22 };

const CONDUCTOR = "siege:choir_conductor";
const SINGER = "siege:choir_singer";
const ROOT_TAG = "siege_choir_root";
const K_PROGRESS = "hc:undertow_progress";
const PHANTOMS = [
  ["minecraft:pillager", "minecraft:vindicator"], // the Warband
  ["minecraft:zombie", "minecraft:skeleton"], // the Undead Horde
  ["minecraft:vindicator", "minecraft:pillager"], // the Mercenary Host
];

const centre = () => ({ x: HEART.center.x + 0.5, y: HEART.center.y, z: HEART.center.z + 0.5 });
export function singerSpot(i) {
  const a = (i / 7) * Math.PI * 2, r = HEART.singerRadius - 3;
  return { x: HEART.center.x + Math.round(Math.cos(a) * r) + 0.5, y: HEART.center.y, z: HEART.center.z + Math.round(Math.sin(a) * r) + 0.5 };
}


function placeSingers(f) {
  const root = SOURCE_SITE_IDS.indexOf(getSourceSite());
  for (let i = 0; i < 7; i++) {
    const s = f.place(SINGER, singerSpot(i));
    if (!s) continue;
    try {
      s.nameTag = `§dSinger of ${SITE_NAMES[SOURCE_SITE_IDS[i]].replace(/^The /, "the ")}`;
      if (i === root) { s.addTag(ROOT_TAG); s.addTag("siege_boss_shielded"); }
    } catch { /* gone */ }
  }
}
const singers = (f) => f.adds(SINGER);
const rootSinger = (f) => singers(f).find((s) => s.hasTag(ROOT_TAG));
const verses = (f) => singers(f).filter((s) => !s.hasTag(ROOT_TAG)).length;

function stage(f) {
  // 0 the Hymn, 1 the Toll, 2 the Closing
  return f.data.stage ?? 0;
}

function title(f, sub) {
  for (const p of f.players()) p.onScreenDisplay.setTitle("§5The Choir", { subtitle: `§7${sub}`, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15 });
}

function raid(f) {
  const living = verses(f);
  const have = f.adds().filter((e) => e.typeId.startsWith("minecraft:")).length;
  const want = Math.min(CHOIR.maxPhantoms - have, Math.min(4, living) + f.players().length);
  if (want <= 0) return;
  const army = PHANTOMS[Math.floor(Math.random() * PHANTOMS.length)];
  f.bar("§5A verse rises. You have fought these armies before.");
  for (let i = 0; i < want; i++) {
    const at = f.spot(HEART.innerRadius + 6, HEART.outerRadius - 4);
    for (const e of f.summon(army[i % army.length], 1, 1, at)) {
      try { e.nameTag = "§7Echo of the Siege"; } catch { /* gone */ }
      effect(e, "fire_resistance", 20000, 0); // no sunlight here, but be safe
      particle(f.dim, "minecraft:knockback_roar_particle", at);
    }
  }
}

registerBoss({
  id: "choir", type: CONDUCTOR, name: "The Choir", radius: HEART.outerRadius + 2, phases: [CHOIR.fallAt], points: 25,
  intro: "turns toward you. Seven voices begin to sing.",
  phaseNames: ["", "The Closing"],
  attacks: [
    { id: "toll", every: 200, windup: 30, rest: 50, warn: "The Toll! Jump the ring!", sound: "block.bell.hit",
      when: (f) => stage(f) >= 1,
      hit: (f) => {
        const c = centre();
        for (let step = 0; step * 2 + 3 <= HEART.outerRadius + 2; step++) {
          f.after(step * 5, () => {
            const r = step * 2 + 3;
            ring(f.dim, { x: c.x, y: c.y + 0.3, z: c.z }, r, "minecraft:sonic_explosion", Math.max(6, r));
            for (const p of f.players()) {
              if (Math.abs(flat(p.location, c) - r) > 1.6 || !p.isOnGround) continue;
              hurt(p, CHOIR.tollDamage, "magic");
              shove(p, p.location.x - c.x, p.location.z - c.z, stage(f) === 2 ? 0.6 : 1.2, 0.4);
            }
          });
        }
      } },
    { id: "undertow", every: 320, windup: 40, rest: 70, warn: "The Hollow pulls! Crouch and hold on!", sound: "mob.elderguardian.curse",
      when: (f) => stage(f) >= 1,
      hit: (f) => {
        const c = centre();
        for (let t = 0; t < 60; t += 5) {
          f.after(t, () => {
            for (const p of f.players()) {
              if (p.isSneaking) continue;
              shove(p, p.location.x - c.x || 1, p.location.z - c.z, 0.9, 0.05);
            }
          });
        }
      } },
    { id: "echo", every: 280, windup: 25, rest: 20, warn: "Echo! Hold your blows!", sound: "block.amethyst_block.resonate",
      when: (f) => stage(f) >= 1,
      hit: (f) => {
        f.data.echoUntil = f.tick + CHOIR.echoTicks;
        f.say("§dThe Choir holds one long note. Anything you strike with now comes back.");
      } },
  ],

  onStart: (f, fresh) => {
    f.data.stage = 0;
    f.data.nextRaid = 100;
    f.data.band = 0;
    f.shield(true);
    if (fresh || !singers(f).length) {
      for (const s of singers(f)) { try { s.remove(); } catch { /* gone */ } }
      placeSingers(f);
    }
  },


  onHurt: (f, event) => {
    const by = event.damageSource.damagingEntity;
    if (by?.typeId === "minecraft:player") {
      if ((f.data.echoUntil ?? 0) > f.tick) {
        hurt(by, Math.max(2, Math.round(event.damage * 0.75)), "magic");
        heal(f.entity, event.damage);
        sound(f.dim, "block.bell.hit", by.location, 1.6, 0.8);
      }
    }
  },

  onPhase: (f) => {
    // The Closing
    f.data.stage = 2;
    f.data.nextBand = f.tick + 120;
    const root = rootSinger(f);
    if (root) {
      try {
        root.teleport({ x: centre().x + 4, y: HEART.center.y, z: centre().z });
        root.removeTag("siege_boss_shielded");
      } catch { /* gone */ }
    }
    f.say("§5The last Singer steps down to the centre. Its voice is one you have heard before.");
    f.say("§cThe song is closing in from the walls. Get to the middle!");
  },

  tick: (f) => {
    const st = stage(f);
    if (st === 0) {
      const left = verses(f);
      f.bar(`§dVerses still singing: §f${left}`);
      if (left === 0) {
        f.data.stage = 1;
        f.shield(false);
        title(f, "The Toll");
        f.say("§5Six voices are silent. The seventh will not stop, but the Conductor is laid bare.");
        return;
      }
      if (f.tick >= f.data.nextRaid) {
        f.data.nextRaid = f.tick + CHOIR.raidEvery;
        raid(f);
      }
      // A thread of light from each living Singer to the Conductor shows what is shielding it.
      if (f.tick % 20 === 0) for (const s of singers(f)) particle(f.dim, "minecraft:villager_happy", { x: s.location.x, y: s.location.y + 2.6, z: s.location.z });
    }
    if (st === 2) {
      // The song closes in, ring by ring, each one warned first. Outside the ring it hurts.
      const c = centre();
      if (f.data.band < CHOIR.fallBands.length) {
        const r = CHOIR.fallBands[f.data.band];
        const left = f.data.nextBand - f.tick;
        if (left <= 120 && left > 0) {
          if (left % 20 === 0) ring(f.dim, { x: c.x, y: c.y + 0.2, z: c.z }, r, "minecraft:basic_flame_particle", r * 4);
          f.bar(`§cThe song closes to the flames in ${Math.ceil(left / 20)}`);
        }
        if (left <= 0) {
          for (const p of f.players()) sound(f.dim, "block.bell.hit", p.location, 0.5, 1);
          f.data.band++;
          f.data.nextBand = f.tick + CHOIR.fallEvery;
        }
      }
      if (f.data.band > 0 && f.tick % 20 === 0) {
        const r = CHOIR.fallBands[f.data.band - 1];
        ring(f.dim, { x: c.x, y: c.y + 0.4, z: c.z }, r, "minecraft:soul_particle", r * 3);
        for (const p of f.players()) if (flat(p.location, c) >= r) hurt(p, CHOIR.closingDamage, "magic");
      }
      // The last Singer feeds the Conductor while it lives.
      const root = rootSinger(f);
      if (root && f.tick % 20 === 0) {
        heal(f.entity, CHOIR.rootFeed);
        particle(f.dim, "minecraft:heart_particle", { x: f.entity.location.x, y: f.entity.location.y + 3.6, z: f.entity.location.z });
        f.bar("§dThe last Singer is feeding it. Silence the Singer!");
      }
    }
  },

  loot: (f, player, first) => [stack("minecraft:netherite_ingot", first ? 4 : 1), stack("minecraft:diamond", first ? 16 : 4)],
  hoard: () => [stack("minecraft:enchanted_golden_apple", 2), stack("minecraft:emerald_block", 16)],
});

// ---- starting the fight ------------------------------------------------------------------
// The Conductor appears when someone walks into the Court, until the Choir has been silenced.
export function choirTick() {
  if (load(K_PROGRESS, {}).choir || !pieces().court || fightOf("choir")) return;
  let dim;
  try { dim = world.getDimension(UNDERTOW_ID); } catch { return; }
  const c = centre();
  const near = dim.getPlayers({ location: c, maxDistance: HEART.outerRadius - 2 });
  if (!near.length) return;
  try {
    if (dim.getEntities({ type: CONDUCTOR, location: c, maxDistance: 64 }).length) return; // already there, the framework will pick it up
    dim.spawnEntity(CONDUCTOR, c);
  } catch { /* not loaded yet */ }
}

// ---- the kill ------------------------------------------------------------------------------
// The gate opening and the announcement are in index.js (it hears the framework's siege:boss_defeated).
world.afterEvents.entityDie.subscribe((event) => {
  const dead = event.deadEntity;
  if (dead.typeId !== CONDUCTOR) return;
  const dim = dead.dimension;
  system.run(() => {
    for (const s of dim.getEntities({ type: SINGER })) { try { s.remove(); } catch { /* gone */ } }
  });
});
