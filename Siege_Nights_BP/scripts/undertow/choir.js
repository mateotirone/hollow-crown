// The Hollow Choir: the final boss, in the Choir's Heart. Built on the shared boss framework
// (bestiary/bossCore.js). The boss entity is the Conductor; 7 Singers stand around the ring.
//
//   The Hymn   The Singers shield the Conductor. Kill six of them. Every verse still singing
//              calls phantom raiders: the same armies that lay siege to the keeps above.
//              The seventh Singer (the one bound to the real Source) cannot be hurt yet.
//   The Toll   The Conductor can be hurt. Toll: a shockwave you jump. Undertow: a pull toward
//              the edge you crouch against. Echo: your hits come back at you, so hold them.
//   The Fall   At a quarter health the ring falls away band by band. The last Singer comes to
//              the centre and feeds the Conductor until it is killed.
//
// Whoever lands the killing blow is handed to the Crown thread with everyone in the arena as allies.
// Numbers to tweak are in CHOIR below.

import { world, system } from "@minecraft/server";
import { on } from "../siege/api.js";
import { registerBoss, fightOf, stack } from "../bestiary/bossCore.js";
import { announce, effect, flat, heal, hurt, ring, shove, sound, particle } from "../bestiary/util.js";
import { UNDERTOW_ID, HEART } from "./layout.js";
import { SOURCE_SITE_IDS, SITE_NAMES, getSourceSite } from "./source.js";
import { rebuildHeart, dropHeartBand, pieces } from "./builder.js";
import { load, save } from "./data.js";

export const CHOIR = {
  singersToSilence: 6, // of 7; the last one is bound to the Source
  raidEvery: 400, // ticks between phantom raids while verses still sing (20 s)
  maxPhantoms: 10,
  tollDamage: 9,
  echoTicks: 80,
  fallAt: 0.25, // health fraction where the ring starts to fall
  fallBands: [26, 21, 16, 11], // each band is everything at or beyond this radius
  fallEvery: 240, // 12 s between bands, each warned 6 s ahead
  rootFeed: 6, // health the last Singer feeds the Conductor each second
};

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

let lastHitter; // player id of whoever hurt the Conductor last (the killer, if the death event names nobody)

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
  // 0 the Hymn, 1 the Toll, 2 the Fall
  return f.data.stage ?? 0;
}

function title(f, sub) {
  for (const p of f.players()) p.onScreenDisplay.setTitle("§5The Hollow Choir", { subtitle: `§7${sub}`, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15 });
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
  id: "choir", type: CONDUCTOR, name: "The Hollow Choir", radius: HEART.outerRadius + 2, phases: [CHOIR.fallAt], points: 25,
  intro: "turns toward you. Seven voices begin to sing.",
  phaseNames: ["", "The Fall"],
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

  onReset: () => rebuildHeart(),

  onHurt: (f, event) => {
    const by = event.damageSource.damagingEntity;
    if (by?.typeId === "minecraft:player") {
      lastHitter = by.id;
      if ((f.data.echoUntil ?? 0) > f.tick) {
        hurt(by, Math.max(2, Math.round(event.damage * 0.75)), "magic");
        heal(f.entity, event.damage);
        sound(f.dim, "block.bell.hit", by.location, 1.6, 0.8);
      }
    }
  },

  onPhase: (f) => {
    // The Fall
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
    f.say("§cThe ring is breaking. Get to the middle!");
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
      // The ring falls, band by band, each one warned first.
      if (f.data.band < CHOIR.fallBands.length) {
        const r = CHOIR.fallBands[f.data.band];
        const left = f.data.nextBand - f.tick;
        if (left <= 120 && left > 0) {
          if (left % 20 === 0) ring(f.dim, { x: centre().x, y: HEART.center.y + 0.2, z: centre().z }, r, "minecraft:basic_flame_particle", r * 4);
          f.bar(`§cThe floor beyond the flames falls in ${Math.ceil(left / 20)}`);
        }
        if (left <= 0) {
          dropHeartBand(r);
          for (const p of f.players()) sound(f.dim, "random.explode", p.location, 0.5, 1);
          f.data.band++;
          f.data.nextBand = f.tick + CHOIR.fallEvery;
        }
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
  // The Hollow Crown is left in the vault chest, once. It is not a prize for the killer: it kills
  // anyone but a Sorcerer who wears it (warden.js). If it is ever lost, /scriptevent hc:give_crown.
  hoard: () => {
    const prog = load(K_PROGRESS, {});
    const out = [stack("minecraft:enchanted_golden_apple", 2), stack("minecraft:emerald_block", 16)];
    if (!prog.crownOut) {
      prog.crownOut = true;
      save(K_PROGRESS, prog);
      const crown = stack("siege:hollow_crown", 1);
      try { crown?.setLore(["§5It hums with seven voices.", "§4It will not suffer the unworthy."]); } catch { /* plain crown */ }
      out.push(crown);
    }
    return out;
  },
});

// ---- starting the fight ------------------------------------------------------------------
// The Conductor appears when someone walks into the Heart, unless the Crown is already held.
export function choirTick() {
  if (load(K_PROGRESS, {}).choir || !pieces().heart || fightOf("choir")) return;
  let dim;
  try { dim = world.getDimension(UNDERTOW_ID); } catch { return; }
  const c = centre();
  const near = dim.getPlayers({ location: c, maxDistance: HEART.outerRadius });
  if (!near.length) return;
  try {
    if (dim.getEntities({ type: CONDUCTOR, location: c, maxDistance: 64 }).length) return; // already there, the framework will pick it up
    dim.spawnEntity(CONDUCTOR, c);
  } catch { /* not loaded yet */ }
}

// ---- the kill and the Crown ----------------------------------------------------------------
world.afterEvents.entityDie.subscribe((event) => {
  const dead = event.deadEntity;
  if (dead.typeId !== CONDUCTOR) return;
  const loc = dead.location, dim = dead.dimension;
  const by = event.damageSource.damagingEntity;
  const online = world.getAllPlayers();
  const killer = (by?.typeId === "minecraft:player" ? by : undefined) ?? online.find((p) => p.id === lastHitter);
  const allies = online.filter((p) => p.dimension.id === dim.id && flat(p.location, loc) <= HEART.outerRadius + 10 && p.id !== killer?.id);
  system.run(() => {
    const prog = load(K_PROGRESS, {});
    prog.choir = true;
    save(K_PROGRESS, prog);
    rebuildHeart(); // so nobody is left standing on a falling floor
    for (const s of dim.getEntities({ type: SINGER })) { try { s.remove(); } catch { /* gone */ } }
    world.sendMessage("§5The singing stops. For the first time in living memory, the land above is quiet.");
    if (!killer) return;
    announce("siege:boss_defeated", { boss: "hollow_choir", killer: killer.id, killerName: killer.name, allies: allies.map((p) => p.id) });
  });
});

// The Crown thread tells us when the Crown is back on the throne below: the fight can be won again.
on("crownVacant", () => {
  const prog = load(K_PROGRESS, {});
  prog.choir = false;
  save(K_PROGRESS, prog);
  world.sendMessage("§5Far below, seven voices begin to sing again.");
});
