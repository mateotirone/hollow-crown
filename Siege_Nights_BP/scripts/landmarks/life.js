// The life of a place: dragons circling over it, dragons standing or asleep in its yards, and its people, kept about
// while a player is near (Mateo, 2026-11-13, of the Cinder Roost: "there should be wild dragons flying around, wild
// dragons in the yards, people and NPCs training with the dragons").
//
// A landmark design lists its life as [dx, dy, dz, kind] (map/structures/landmarks_story.py, meta "life"); the
// builder (index.js) sends "landmarkLife" with the world positions once the site stands, and this keeps them:
//   sky:<species>:<radius>:<height>:<name>   a dragon circling the point (wingmen.js); no name = a wild one
//   dragon:<species>:<stage>:<pose>          a display dragon (no owner, so it just stands there); pose 1 = asleep
//   folk:<n>                                 the place's n-th person (life_data.js), who walks a little and talks
//
// Test (creative): /scriptevent siege:life   lists the places with life and what is out at the nearest one

import { world, system } from "@minecraft/server";
import { on, emit, onTick, moduleStore, addTests, assert, assertEqual } from "../siege/api.js";
import { SPECIES } from "../dragons/data.js";
import { NEVER_SAID, skinIndex, speech, canStand, STAND_TRIES, DY_TRIES, FOLK } from "../townsfolk/rules.js";
import { FOLK_OF } from "./life_data.js";
import { DESIGNS } from "./designs_data.js";

const OVERWORLD = "minecraft:overworld";
const DRAGON = "siege:dragon";
const PERSON = "siege:townsfolk";
const TAG = "siege_life";
const REACH = 128; // a player this close to a place wakes its life
const HEARD = "siege:life_heard";
const store = moduleStore("siege:life", () => ({ sites: {} })); // site -> [{ kind, at }]

// ---------- the rules (pure) ----------

export function parseKind(kind) {
  const [what, ...a] = String(kind).split(":");
  if (what === "sky") return { what, species: a[0], radius: Number(a[1]), height: Number(a[2]), name: a.slice(3).join(":") };
  if (what === "dragon") return { what, species: a[0], stage: a[1], pose: Number(a[2] ?? 0) };
  if (what === "folk") return { what, n: Number(a[0]) };
  return undefined;
}

export const designOf = (site) => String(site).split("#")[0];
export const lifeTag = (site, i) => `siege_life_${designOf(site).replace(/[^a-z0-9]+/gi, "_")}_${String(site).split("#")[1] ?? 0}_${i}`;
const speciesIndex = (key) => Math.max(0, SPECIES.findIndex((s) => s.key === key));
const centreOf = (spots) => {
  const n = spots.length || 1;
  return { x: spots.reduce((s, p) => s + p.at.x, 0) / n, y: spots.reduce((s, p) => s + p.at.y, 0) / n, z: spots.reduce((s, p) => s + p.at.z, 0) / n };
};

// ---------- placing ----------

on("landmarkLife", ({ site, spots }) => {
  if (!site || !spots?.length) return;
  store.data.sites[site] = spots.map(({ kind, at }) => ({ kind, at: { x: at.x, y: at.y, z: at.z } }));
  store.save();
});

function standAt(dim, at) {
  const x = Math.floor(at.x), y = Math.floor(at.y), z = Math.floor(at.z);
  for (const [dx, dz] of STAND_TRIES) {
    for (const dy of DY_TRIES) {
      let below, feet, head;
      try {
        below = dim.getBlock({ x: x + dx, y: y + dy - 1, z: z + dz });
        feet = dim.getBlock({ x: x + dx, y: y + dy, z: z + dz });
        head = dim.getBlock({ x: x + dx, y: y + dy + 1, z: z + dz });
      } catch {
        return null; // not loaded
      }
      if (!below || !feet || !head) return null;
      if (canStand(below.typeId, feet.typeId, head.typeId)) return { x: x + dx + 0.5, y: y + dy, z: z + dz + 0.5 };
    }
  }
  return undefined;
}

function spawnOne(dim, site, i, spot, k) {
  const at = standAt(dim, spot.at);
  if (!at) return;
  if (k.what === "dragon") {
    const e = dim.spawnEntity(DRAGON, at);
    e.addTag(TAG); e.addTag(lifeTag(site, i));
    e.triggerEvent(`siege:stage_${k.stage}`);
    try { e.setProperty("siege:species", speciesIndex(k.species)); } catch { /* old pack */ }
    if (k.pose) { e.triggerEvent("siege:go_down"); try { e.setProperty("siege:pose", k.pose); } catch { /* old pack */ } }
    e.setRotation({ x: 0, y: (i * 97) % 360 });
    for (const [effect, ticks, amplifier] of [["resistance", 20000000, 4], ["fire_resistance", 20000000, 0]]) {
      try { e.addEffect(effect, ticks, { amplifier, showParticles: false }); } catch { /* fine */ }
    }
    return;
  }
  const folk = FOLK_OF[designOf(site)];
  const p = folk?.people[k.n];
  if (!p) return;
  const e = dim.spawnEntity(PERSON, at);
  e.addTag(TAG); e.addTag(lifeTag(site, i));
  e.nameTag = p.name;
  try { e.setProperty("siege:skin", skinIndex(folk.region, p.skin)); } catch { /* old pack */ }
  e.setRotation({ x: 0, y: (i * 137) % 360 });
}

function tend(dim, site, spots, players) {
  const c = centreOf(spots);
  const here = new Map();
  for (const e of dim.getEntities({ tags: [TAG], location: c, maxDistance: REACH })) {
    const tag = e.getTags().find((t) => t.startsWith("siege_life_"));
    if (!tag) continue;
    if (here.has(tag)) { e.remove(); continue; } // a double from a reload
    here.set(tag, e);
  }
  spots.forEach((spot, i) => {
    const k = parseKind(spot.kind);
    if (!k) return;
    if (k.what === "sky") {
      emit("npcDragonFly", { key: lifeTag(site, i), name: k.name, species: k.species, dimension: OVERWORLD, center: spot.at, radius: k.radius,
        height: k.height, every: 100000, damage: 0, targetType: "siege:nothing", ttl: 260 });
      return;
    }
    if (here.has(lifeTag(site, i))) return;
    try { spawnOne(dim, site, i, spot, k); } catch (err) { console.warn(`[Hollow Crown] life ${site}: ${err}`); }
  });
}

onTick("landmark_life", 120, () => {
  const sites = Object.entries(store.data.sites ?? {});
  if (!sites.length) return;
  const players = world.getAllPlayers().filter((p) => p.dimension.id === OVERWORLD);
  if (!players.length) return;
  const dim = world.getDimension(OVERWORLD);
  for (const [site, spots] of sites) {
    const c = centreOf(spots);
    if (players.some((p) => Math.hypot(p.location.x - c.x, p.location.z - c.z) <= REACH)) tend(dim, site, spots, players);
  }
});

// ---------- talking ----------

function personOf(e) {
  const tag = e.getTags().find((t) => t.startsWith("siege_life_"));
  if (!tag) return undefined;
  for (const [site, spots] of Object.entries(store.data.sites ?? {})) {
    const i = spots.findIndex((_, j) => lifeTag(site, j) === tag);
    if (i < 0) continue;
    const k = parseKind(spots[i].kind);
    const p = k?.what === "folk" ? FOLK_OF[designOf(site)]?.people[k.n] : undefined;
    if (p) return { p, tag };
  }
  return undefined;
}

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  const { player, target } = event;
  if (target?.typeId !== PERSON || !target.hasTag(TAG)) return;
  event.cancel = true;
  system.run(() => {
    if (!target.isValid) return;
    const m = personOf(target);
    if (!m) return;
    let heard = {};
    try { heard = JSON.parse(player.getDynamicProperty(HEARD) ?? "{}"); } catch { /* fresh */ }
    const n = (heard[m.tag] ?? 0) % m.p.lines.length;
    heard[m.tag] = (heard[m.tag] ?? 0) + 1;
    try { player.setDynamicProperty(HEARD, JSON.stringify(heard)); } catch { /* still say it */ }
    player.sendMessage(speech(m.p, m.p.lines[n], ""));
    try {
      const dx = player.location.x - target.location.x, dz = player.location.z - target.location.z;
      target.setRotation({ x: 0, y: (Math.atan2(-dx, dz) * 180) / Math.PI });
      target.addEffect("slowness", FOLK.talkTicks, { amplifier: 255, showParticles: false });
    } catch { /* looks only */ }
  });
});

// ---------- test command ----------

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:life") return;
  const player = event.sourceEntity;
  if (!player?.sendMessage) return;
  const sites = Object.entries(store.data.sites ?? {});
  if (!sites.length) return player.sendMessage("§7No places with a life of their own are built yet.");
  for (const [site, spots] of sites) {
    const c = centreOf(spots);
    const d = Math.round(Math.hypot(player.location.x - c.x, player.location.z - c.z));
    const out = player.dimension.getEntities({ tags: [TAG], location: c, maxDistance: REACH }).length;
    player.sendMessage(`§6${site}§7: ${spots.length} spots, ${out} out, ${d} blocks away (${Math.round(c.x)} ${Math.round(c.z)})`);
  }
});

// ---------- self-tests ----------

addTests("landmark life", {
  "every kind reads, every person is real, and nobody says what the street must not know": () => {
    assertEqual(parseKind("sky:wyvern:38:44:").radius, 38);
    assertEqual(parseKind("sky:cinderwing:9:7:Cadet Tamsin on Ember").name, "Cadet Tamsin on Ember");
    assertEqual(parseKind("dragon:drake:adult:1").pose, 1);
    assertEqual(parseKind("folk:3").n, 3);
    assertEqual(parseKind("nonsense"), undefined);
    for (const [id, f] of Object.entries(FOLK_OF)) {
      for (const p of f.people) {
        assertEqual(p.lines.length, FOLK.linesEach, `${id} ${p.name}`);
        for (const line of p.lines) {
          assert(line.length <= FOLK.maxLineLength, `${p.name}: line too long`);
          for (const w of NEVER_SAID) assert(!line.toLowerCase().includes(w), `${p.name} says "${w}"`);
        }
      }
    }
    for (const s of SPECIES) assert(s.key, "species keys");
  },
  "every design's life points at real species, stages and people": () => {
    for (const [id, d] of Object.entries(DESIGNS)) {
      for (const [, , , kind] of d.life ?? []) {
        const k = parseKind(kind);
        assert(k, `${id}: ${kind}`);
        if (k.species) assert(SPECIES.some((s) => s.key === k.species), `${id}: no species ${k.species}`);
        if (k.stage) assert(["hatchling", "fledgling", "adult"].includes(k.stage), `${id}: stage ${k.stage}`);
        if (k.what === "folk") assert(FOLK_OF[id.split("@")[0]]?.people[k.n], `${id}: no person ${k.n}`);
      }
    }
  },
  "each site's dragons and people get their own tag": () => {
    assertEqual(lifeTag("cinder_roost@n#0", 3), "siege_life_cinder_roost_n_0_3");
    assert(lifeTag("a#0", 1) !== lifeTag("a#0", 2), "tags differ");
  },
});
