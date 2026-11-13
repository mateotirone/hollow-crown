// The Choir: the Hollow's people, singing the Gate wider. They hold the Court, the hall across the
// story path, and must be silenced before anyone can go on to the Seat (Mateo: the Choir stays its
// own fight, before the last one). Built on the shared boss framework (bestiary/bossCore.js).
// The boss entity is the Conductor; 7 Singers stand around the hall.
//
//   The Hymn     The Singers shield the Conductor. Kill six of them. The seventh Singer (the one
//                bound to the real Source) cannot be hurt yet, and says so.
//   All fight    Echoes of the Siege come in waves: phantom copies of the armies that lay siege to
//                the keeps above. Kill a whole wave and the next, bigger one rises (Mateo 2026-11-12:
//                "a LOT more", "annoying", "they spawn more when the last one dies").
//                The Conductor never stands still: it glides round the hall and slips away from
//                anyone who gets close (Mateo 2026-11-12: "the choir main guy has to move").
//   The Toll     The Conductor can be hurt. Toll: a shockwave you jump. Undertow: a pull toward
//                the walls you crouch against. Echo: your hits come back at you, so hold them.
//   The Closing  At a quarter health the song closes in from the walls, ring by ring: stand outside
//                it and it hurts. The last Singer comes to the centre and feeds the Conductor
//                until it is killed.
//
// When the Conductor dies the Court's gate (and the river's water gate) opens. The framework
// announces siege:boss_defeated {boss:"choir"}; the last handoff now belongs to boss "morvane".
// Numbers to tweak are in CHOIR below.

import { world, system, GameMode } from "@minecraft/server";
import { registerBoss, fightOf, stack } from "../bestiary/bossCore.js";
import { effect, flat, heal, hurt, ring, shove, sound, particle } from "../bestiary/util.js";
import { UNDERTOW_ID, COURT } from "./layout.js";
import { SOURCE_SITE_IDS, SITE_NAMES, getSourceSite } from "./source.js";
import { pieces } from "./builder.js";
import { load } from "./data.js";
import { courtOpenFor, cartWrecked, cartsongHolders } from "./story.js";

export const CHOIR = {
  singersToSilence: 6, // of 7; the last one is bound to the Source
  firstWave: 60, // ticks before the first wave of Echoes rises
  waveGap: 60, // ticks between the last Echo of a wave falling and the next wave rising (3 s)
  waveBase: 6, // Echoes in the first wave
  waveGrowth: 2, // more each wave after
  wavePerPlayer: 3, // more for every player after the first
  waveMax: 24, // never more than this alive at once (a Realm has to keep up)
  wreckedWaveFactor: 0.75, // the dawn cart was wrecked at the Seams (middle stretch): waves are smaller
  glideSpeed: 0.9, // blocks the Conductor drifts each framework step (5 ticks): about 3.6 a second
  glidePause: 40, // ticks it hangs at each spot before it picks the next
  slipNear: 3.5, // a player this close and it slips away...
  slipEvery: 100, // ...at most this often (5 s)
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

// The Choir's own effect: a ring of violet light (resource pack particle siege:choir_ring).
// particle() swallows errors, so the fight is unaffected if the effect is missing.
const RING = "siege:choir_ring";
const ringAt = (f, loc, up = 0.3) => particle(f.dim, RING, { x: loc.x, y: loc.y + up, z: loc.z });
const windUp = (f) => { try { ringAt(f, f.entity.location, 1.6); } catch { /* the Conductor is gone */ } }; // around the Conductor while it gathers a note

const CONDUCTOR = "siege:choir_conductor";
const SINGER = "siege:choir_singer";
const ROOT_TAG = "siege_choir_root";
const K_PROGRESS = "hc:undertow_progress";
const PHANTOMS = [
  ["minecraft:pillager", "minecraft:vindicator", "minecraft:pillager"], // the Warband
  ["minecraft:zombie", "minecraft:skeleton", "minecraft:husk", "minecraft:stray"], // the Undead Horde
  ["minecraft:vindicator", "minecraft:pillager", "minecraft:vindicator"], // the Mercenary Host
];
// Every few waves something worse walks with the Echoes.
const CAPTAINS = { 3: "minecraft:vex", 5: "minecraft:ravager", 7: "minecraft:witch" };
const ECHO_TAG = "siege_choir_echo";

// How many Echoes the next wave brings. Pure (tested).
export function waveSize(wave, players = 1, wrecked = false) {
  const n = CHOIR.waveBase + CHOIR.waveGrowth * Math.max(0, wave - 1) + CHOIR.wavePerPlayer * Math.max(0, players - 1);
  return Math.max(1, Math.min(CHOIR.waveMax, Math.round(n * (wrecked ? CHOIR.wreckedWaveFactor : 1))));
}
// The worse thing that walks with wave n, if any (every 3rd, 5th and 7th wave, then round again). Pure.
export function waveCaptain(wave) {
  const k = ((wave - 1) % 7) + 1;
  return CAPTAINS[k];
}

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
      if (i === root) { s.addTag(ROOT_TAG); s.addTag("siege_boss_shielded"); s.nameTag += "\n§7(bound to the Source: can't be silenced yet)"; }
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

const echoes = (f) => f.adds().filter((e) => e.hasTag(ECHO_TAG));

// A wave of Echoes rises from the edges of the hall, all at once.
function wave(f) {
  f.data.wave = (f.data.wave ?? 0) + 1;
  const n = f.data.wave, ps = f.players();
  const want = Math.min(waveSize(n, ps.length, cartWrecked()), CHOIR.waveMax - echoes(f).length);
  if (want <= 0) return;
  const army = PHANTOMS[Math.floor(Math.random() * PHANTOMS.length)];
  const kinds = Array.from({ length: want }, (_, i) => army[i % army.length]);
  const captain = waveCaptain(n);
  if (captain) kinds[0] = captain;
  for (const p of ps) p.onScreenDisplay.setTitle(" ", { subtitle: `§5Wave ${n}§7: the Echoes of the Siege rise`, fadeInDuration: 5, stayDuration: 30, fadeOutDuration: 10 });
  f.say(n === 1 ? "§5The verse rises, and with it the armies you have fought before. Kill them all and more will come." : `§5Wave ${n}. ${want} Echoes of the Siege${captain ? ", and something worse walks with them" : ""}.`);
  for (const kind of kinds) {
    const at = f.spot(HEART.innerRadius + 6, HEART.outerRadius - 4);
    for (const e of f.summon(kind, 1, 1, at, [ECHO_TAG])) {
      try { e.nameTag = "§7Echo of the Siege"; } catch { /* gone */ }
      effect(e, "fire_resistance", 20000, 0); // no sunlight here, but be safe
      effect(e, "speed", 20000, 0); // they are quick, and they keep coming
      particle(f.dim, "minecraft:knockback_roar_particle", at);
    }
  }
}

// Waves: the next one rises a breath after the last Echo of this one falls.
function waves(f) {
  if (f.tick < (f.data.nextWave ?? 0)) return;
  const left = echoes(f).length;
  if (left > 0) { f.data.nextWave = undefined; return; }
  if (f.data.nextWave === undefined) { f.data.nextWave = f.tick + CHOIR.waveGap; if (f.data.wave) f.bar("§5The last Echo falls. Another verse is gathering..."); return; }
  f.data.nextWave = undefined;
  wave(f);
}

// Creative playtesters: the Echoes walk at you and show what would have hit, like every boss helper (bossCore.js helpersChase).

// The Conductor glides round the hall, a slow figure-of-eight of spots, and slips away from anyone close.
// In the Closing it keeps to the middle, where the players have to be.
function glide(f, players) {
  const e = f.entity, loc = e.location, c = centre();
  const near = players.find((p) => flat(p.location, loc) < CHOIR.slipNear);
  if (near && f.tick >= (f.data.nextSlip ?? 0) && stage(f) < 2) {
    f.data.nextSlip = f.tick + CHOIR.slipEvery;
    const to = f.spot(HEART.innerRadius + 2, HEART.singerRadius - 6);
    particle(f.dim, "siege:vein_spark", { x: loc.x, y: loc.y + 1.5, z: loc.z });
    ringAt(f, loc, 0.3);
    try { e.teleport({ x: to.x, y: c.y, z: to.z }, { facingLocation: near.location }); } catch { /* not loaded */ }
    sound(f.dim, "block.amethyst_block.resonate", to, 0.7, 1);
    f.data.goal = undefined;
    return;
  }
  if (!f.data.goal) {
    if (f.tick < (f.data.hangUntil ?? 0)) return;
    const to = stage(f) === 2 ? f.spot(1, HEART.innerRadius - 2) : f.spot(HEART.innerRadius - 3, HEART.singerRadius - 6);
    f.data.goal = { x: to.x, z: to.z };
  }
  const g = f.data.goal, d = Math.hypot(g.x - loc.x, g.z - loc.z);
  if (d <= CHOIR.glideSpeed) { f.data.goal = undefined; f.data.hangUntil = f.tick + CHOIR.glidePause; return; }
  const k = CHOIR.glideSpeed / d;
  const face = players.length ? players.reduce((a, b) => (flat(b.location, loc) < flat(a.location, loc) ? b : a)).location : undefined;
  try { e.teleport({ x: loc.x + (g.x - loc.x) * k, y: c.y, z: loc.z + (g.z - loc.z) * k }, face ? { facingLocation: face } : undefined); } catch { /* not loaded */ }
}

registerBoss({
  id: "choir", type: CONDUCTOR, name: "The Choir", radius: HEART.outerRadius + 2, phases: [CHOIR.fallAt], points: 25, noChase: true, // it glides on its own (glide below)
  intro: "turns toward you. Seven voices begin to sing.",
  phaseNames: ["", "The Closing"],
  attacks: [
    { id: "toll", show: windUp, every: 200, windup: 30, rest: 50, warn: "The Toll! Jump the ring!", sound: "block.bell.hit",
      when: (f) => stage(f) >= 1,
      hit: (f) => {
        const c = centre();
        for (let step = 0; step * 2 + 3 <= HEART.outerRadius + 2; step++) {
          f.after(step * 5, () => {
            const r = step * 2 + 3;
            ring(f.dim, { x: c.x, y: c.y + 0.3, z: c.z }, r, "minecraft:sonic_explosion", Math.max(6, r));
            if (step % 3 === 0) ringAt(f, c);
            for (const p of f.players()) {
              if (Math.abs(flat(p.location, c) - r) > 1.6 || !p.isOnGround) continue;
              hurt(p, CHOIR.tollDamage, "magic");
              shove(p, p.location.x - c.x, p.location.z - c.z, stage(f) === 2 ? 0.6 : 1.2, 0.4);
            }
          });
        }
      } },
    { id: "undertow", show: windUp, every: 320, windup: 40, rest: 70, warn: "The Hollow pulls! Crouch and hold on!", sound: "mob.elderguardian.curse",
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
    { id: "echo", show: windUp, every: 280, windup: 25, rest: 20, warn: "Echo! Hold your blows!", sound: "block.amethyst_block.resonate",
      when: (f) => stage(f) >= 1,
      hit: (f) => {
        f.data.echoUntil = f.tick + CHOIR.echoTicks;
        windUp(f);
        f.say("§dThe Choir holds one long note. Anything you strike with now comes back.");
      } },
  ],

  onStart: (f, fresh) => {
    f.data.stage = 0;
    f.data.wave = 0;
    f.data.nextWave = CHOIR.firstWave;
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
        root.nameTag = root.nameTag.split("\n")[0];
      } catch { /* gone */ }
    }
    f.say("§5The last Singer steps down to the centre. Its voice is one you have heard before.");
    f.say("§cThe song is closing in from the walls. Get to the middle!");
  },

  tick: (f, players = f.players()) => {
    const st = stage(f);
    waves(f);
    glide(f, players);
    if (st === 1 && f.tick % 60 === 0) f.bar("§dThe Conductor is open: strike it. The last Singer can't be silenced until the song closes in.");
    if (st === 0) {
      const left = verses(f);
      if (f.tick % 20 === 0) f.bar(`§dSingers to silence: §f${left} of ${CHOIR.singersToSilence}§7 (the bound one can't be hurt yet)`);
      if (left === 0) {
        f.data.stage = 1;
        f.shield(false);
        title(f, "The Toll");
        f.say("§5Six voices are silent. The seventh is bound to the Source: no blade can touch it yet. Bring the Conductor low and it will come down to you.");
        return;
      }
      // A thread of light from each living Singer to the Conductor shows what is shielding it.
      if (f.tick % 20 === 0) for (const s of singers(f)) particle(f.dim, "minecraft:villager_happy", { x: s.location.x, y: s.location.y + 2.6, z: s.location.z });
      // The Hymn: a ring of light at the foot of every Singer still singing, and one round the Conductor they shield.
      if (f.tick % 40 === 0) { for (const s of singers(f)) ringAt(f, s.location); windUp(f); }
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
  hoard: () => [stack("minecraft:enchanted_golden_apple", 2), stack("siege:gold_coin", 18)],
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
  // The Court lets nobody in without the Cartsong (undertow/story.js pushes them back out)
  if (!courtOpenFor(near.map((p) => p.id), cartsongHolders(), false) && !near.some((p) => p.getGameMode() === GameMode.Creative)) return;
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
