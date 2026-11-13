// The Deep (Act V, arc 2; Mateo's order 2026-11-11: Five Chairs and Homecomings first, then the Deep).
// Behind the Deep Door in the Vault, the Grey Host the Hollow swallowed at 3:17 still stands in its ranks, held there
// three hundred years by its bell-wife's ringing. Words: data/deep.js. Spots and sums: deep_rules.js. The halls are
// drawn with the building engine in map/structures/hollow_deep.py (data/deep_design.js, stamped on first use).
//
//   The door       Until Morvane falls the Deep Door stays sealed (hollowfolk/index.js says its old lines). After,
//                  using it builds the Deep the first time (a few seconds), then takes you down to the Landing.
//                  The bell on the Landing takes you back up to the Vault.
//   The Bell Room  Walk down the Long Nave to Ulfa Ice-Tongue, the bell-wife (a bossCore boss, sized for one player).
//                  She drops Ulfa's Bell. When she falls the Seal to the Ranks opens. She rings again, ranked up,
//                  from the next day.
//   The Ranks      Five companies of the Host stand on five tiers. Talk to a company's serjeant once Ulfa has fallen:
//                  lead them out (your keep may hold 2 more guards for each), lay them to rest (Veil Ash and a
//                  keepsake), or leave them standing. Whoever speaks first decides for the world.
//   The Note floor At the foot of the Ranks: a flat stone floor with a cracked bell-shaped hollow. It is kept for
//                  Everwake's Hollow Note trial (the Cloud City thread builds that trial; nothing here runs it).
//
// Given to other features:
//   deepNote()        the world spot of the hollow (walking level), or undefined if the Deep is not built yet
//   deepOpen()        true once the Seal to the Ranks is open (Ulfa has fallen at least once)
//   standingHost()    the ids of the companies still standing in the Ranks
//   event "deepReached" { player, first }      every time a player arrives on the Landing
//   event "hostCompany" { company, fate, player }  fate "led" | "rest"
//   guard limit hook: +DEEP.guardsPerCompany for every company a player led out
// Test (creative): /scriptevent siege:deep          status
//                  /scriptevent siege:deep_go       build if needed and go down (even before Morvane falls)
//                  /scriptevent siege:deep_open     open the Seal without the fight
//                  /scriptevent siege:deep_reset    every company back in its rank, the Seal shut again

import { world, system, GameMode } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { onTick, moduleStore, emit, on, addFilter, addGuardLimitHook } from "../siege/api.js";
import { registerBoss, bestiaryStore, startBoss, fightOf, stack } from "../bestiary/bossCore.js";
import { alive, effect, flat, hurt, makeItem, particle, sound, shove, give } from "../bestiary/util.js";
import { UNDERTOW_ID } from "../undertow/layout.js";
import { runCmd } from "../undertow/data.js";
import { stamp } from "../undertow/stamp.js";
import { awardPoints } from "../lore/player.js";
import { morvaneFallen } from "./chairs.js";
import { DEEP_DESIGN } from "./data/deep_design.js";
import { DOOR_OPENS, DOOR_AGAIN, DOOR_BUILDING, FIRST_LANDING, GOING_UP, SEAL_SHUT, SEAL_OPENS, ULFA, COMPANIES, CHOICE, RANKS_EMPTY } from "./data/deep.js";
import { DEEP, toWorld, toLocal, inDeep, inBellRoom, companySpots, companyBodies, SERJEANT, guardBonus, standingCompanies, ulfaMayRise } from "./deep_rules.js";

const HOST_TAG = "siege_deep_host";
const SERJEANT_TAG = "siege_deep_serjeant";
const companyTag = (id) => `siege_deep_c_${id}`;
const spotTag = (id, i) => `siege_deep_s_${id}_${i}`;
const FOREVER = 20000000;
const TICKING = "siege_deep_build";

export const deepStore = moduleStore("siege:after_deep", () => ({
  v: 1, built: false, sealOpen: false, fates: {}, led: {}, visited: [], ulfaFell: -1,
}));

const today = () => { try { return world.getDay(); } catch { return 0; } };
const hollow = () => { try { return world.getDimension(UNDERTOW_ID); } catch { return undefined; } };
const everyone = (text) => { for (const p of world.getPlayers()) p.sendMessage(text); };
const deepPlayers = () => world.getAllPlayers().filter((p) => p.dimension.id === UNDERTOW_ID && inDeep(p.location));
const center = (p) => ({ x: p.x + 0.5, y: p.y, z: p.z + 0.5 });

export const deepNote = () => (deepStore.data.built ? center(toWorld(DEEP.note)) : undefined);
export const deepOpen = () => !!deepStore.data.sealOpen;
export const standingHost = () => standingCompanies(deepStore.data.fates).map((c) => c.id);

addGuardLimitHook((owner, limit) => limit + guardBonus(deepStore.data.led, owner));

// ---------- going down, coming up ----------
let building = false;
const waiting = new Set(); // player ids to take down once the halls stand

// hollowfolk/index.js asks this before saying the door's sealed lines
addFilter("deepDoor", (handled, { player }) => {
  if (handled || !player || !morvaneFallen()) return handled;
  system.run(() => useDoor(player));
  return true;
});

function useDoor(player) {
  const d = deepStore.data;
  if (d.built) return goDown(player);
  waiting.add(player.id);
  if (building) return player.sendMessage(`§8${DOOR_BUILDING}`);
  for (const [i, l] of DOOR_OPENS.entries()) system.runTimeout(() => player.sendMessage(`§8${l}`), i * 40);
  build();
}

function build() {
  const dim = hollow();
  if (!dim || building) return;
  building = true;
  const o = DEEP.origin, b = DEEP.box;
  // keep the whole design loaded while it is stamped, even the far end of the Ranks
  runCmd(dim, `tickingarea add ${o.x + b.x0} ${o.y + b.y0} ${o.z + b.z0} ${o.x + b.x1} ${o.y + b.y1} ${o.z + b.z1} ${TICKING}`);
  stamp(dim, DEEP_DESIGN, o, (ok) => {
    runCmd(dim, `tickingarea remove ${TICKING}`);
    building = false;
    if (!ok) {
      for (const p of world.getAllPlayers()) if (waiting.has(p.id)) p.sendMessage("§8The seal settles back. Try it again in a little while.");
      waiting.clear();
      return;
    }
    deepStore.data.built = true;
    deepStore.save();
    for (const p of world.getAllPlayers()) if (waiting.has(p.id)) goDown(p);
    waiting.clear();
  });
}

function goDown(player) {
  const dim = hollow(), d = deepStore.data;
  if (!dim) return;
  const first = !d.visited.includes(player.id);
  try {
    player.teleport(center(toWorld(DEEP.arrive)), { dimension: dim, facingLocation: toWorld({ x: 0, y: 0, z: 20 }) });
  } catch { return; }
  sound(dim, "block.bell.hit", toWorld(DEEP.bell), 0.5, 0.6);
  if (first) {
    d.visited.push(player.id);
    deepStore.save();
    for (const [i, l] of FIRST_LANDING.entries()) system.runTimeout(() => player.sendMessage(l), 20 + i * 60);
  } else {
    player.sendMessage(`§8${DOOR_AGAIN[Math.floor(Math.random() * DOOR_AGAIN.length)]}`);
  }
  emit("deepReached", { player, first });
}

world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
  if (e.block.typeId !== "minecraft:bell" || e.block.dimension.id !== UNDERTOW_ID || e.isFirstEvent === false) return;
  const l = toLocal(e.block.location);
  if (l.x !== DEEP.bell.x || l.y !== DEEP.bell.y || l.z !== DEEP.bell.z) return;
  const player = e.player;
  system.run(() => {
    try { player.teleport(center(DEEP.up), { dimension: hollow() }); } catch { return; }
    player.sendMessage(GOING_UP);
  });
});

// The Seal before the Ranks says what is behind it
world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
  if (e.block.typeId !== "siege:court_seal" || e.block.dimension.id !== UNDERTOW_ID || e.isFirstEvent === false) return;
  const l = toLocal(e.block.location), s = DEEP.seal;
  if (l.z !== s.z || l.x < s.x0 || l.x > s.x1 || l.y < s.y0 || l.y > s.y1) return;
  e.cancel = true;
  const player = e.player;
  system.run(() => player.sendMessage(SEAL_SHUT));
});

function setSeal(open) {
  const dim = hollow(), s = DEEP.seal, o = DEEP.origin;
  if (!dim) return;
  runCmd(dim, `fill ${o.x + s.x0} ${o.y + s.y0} ${o.z + s.z} ${o.x + s.x1} ${o.y + s.y1} ${o.z + s.z} ${open ? "minecraft:air" : "siege:court_seal"}`);
  deepStore.data.sealOpen = open;
  deepStore.save();
}

// ---------- the Host ----------
function hostAround(dim) {
  try { return dim.getEntities({ tags: [HOST_TAG], location: toWorld({ x: 0, y: 0, z: 100 }), maxDistance: 40 }); } catch { return []; }
}

function statue(e) {
  effect(e, "slowness", FOREVER, 255);
  effect(e, "weakness", FOREVER, 255);
  effect(e, "resistance", FOREVER, 255);
}

// Every standing company in its rank, facing the Note floor. Missing statues come back (an unloaded chunk, a reset).
function musterHost(dim) {
  const have = new Set();
  for (const e of hostAround(dim)) for (const t of e.getTags()) if (t.startsWith("siege_deep_s_")) have.add(t);
  const facing = toWorld({ x: DEEP.note.x, y: DEEP.note.y, z: DEEP.note.z });
  COMPANIES.forEach((c, k) => {
    if (deepStore.data.fates[c.id]) return;
    const bodies = companyBodies(c);
    companySpots(k).forEach((spot, i) => {
      if (have.has(spotTag(c.id, i))) return;
      try {
        const at = center(toWorld(spot));
        const e = dim.spawnEntity(bodies[i], at);
        e.addTag(HOST_TAG); e.addTag(companyTag(c.id)); e.addTag(spotTag(c.id, i));
        e.nameTag = i === SERJEANT ? `§7${c.serjeant}\n§8${c.name}` : `§8${c.name}`; // named, so it never despawns
        if (i === SERJEANT) e.addTag(SERJEANT_TAG);
        statue(e);
        e.teleport(at, { facingLocation: { ...facing, y: at.y } });
      } catch { /* the chunk is not ready: the next pass tries again */ }
    });
  });
}

function dismissCompany(dim, c, fate) {
  for (const e of hostAround(dim)) {
    if (!e.hasTag(companyTag(c.id))) continue;
    try {
      const l = e.location;
      particle(dim, fate === "rest" ? "minecraft:soul_particle" : "minecraft:basic_smoke_particle", { x: l.x, y: l.y + 1, z: l.z });
      e.remove();
    } catch { /* gone already */ }
  }
}

world.beforeEvents.playerInteractWithEntity.subscribe((e) => {
  if (!e.target.hasTag?.(SERJEANT_TAG)) return;
  e.cancel = true;
  const player = e.player, target = e.target;
  const c = COMPANIES.find((x) => target.hasTag(companyTag(x.id)));
  if (c) system.run(() => talk(player, c));
});

function talk(player, c) {
  const d = deepStore.data;
  if (d.fates[c.id]) return;
  const form = new ActionFormData().title(CHOICE.title(c));
  if (!deepOpen()) {
    form.body(c.held[Math.floor(Math.random() * c.held.length)]).button(CHOICE.heldButton);
    form.show(player).catch(() => {});
    return;
  }
  form.body(c.free).button(CHOICE.lead).button(CHOICE.rest).button(CHOICE.leave);
  form.show(player).then((r) => {
    if (r.canceled || r.selection === 2 || d.fates[c.id]) return;
    decide(player, c, r.selection === 0 ? "led" : "rest");
  }).catch(() => {});
}

function decide(player, c, fate) {
  const d = deepStore.data, dim = hollow();
  d.fates[c.id] = { fate, by: player.id, name: player.name, day: today() };
  if (dim) dismissCompany(dim, c, fate);
  if (fate === "led") {
    d.led[player.id] = (d.led[player.id] ?? 0) + 1;
    player.sendMessage(`§7${c.serjeant}: §f${c.led}`);
    player.sendMessage(CHOICE.ledBonus(DEEP.guardsPerCompany));
    awardPoints(player, DEEP.pointsLed, "deep:led");
    everyone(CHOICE.ledNews(player.name, c));
  } else {
    player.sendMessage(`§7${c.serjeant}: §f${c.rest}`);
    give(player, stack("siege:hollow_ash", DEEP.ashPerRest));
    const keep = makeItem("minecraft:iron_nugget", 1);
    if (keep) { keep.nameTag = `§f${c.keepsake}`; keep.setLore(CHOICE.keepsakeLore(c)); give(player, keep); }
    awardPoints(player, DEEP.pointsRest, "deep:rest");
    everyone(CHOICE.restNews(player.name, c));
  }
  deepStore.save();
  emit("hostCompany", { company: c.id, fate, player });
  if (!standingCompanies(d.fates).length) for (const p of deepPlayers()) p.sendMessage(RANKS_EMPTY);
}

// ---------- Ulfa Ice-Tongue, the bell-wife ----------
const ARENA = () => center(toWorld(DEEP.arena));

function ulfasBell() {
  const bell = makeItem("minecraft:bell", 1);
  if (bell) { bell.nameTag = "§6Ulfa's Bell"; bell.setLore(ULFA.bellLore); }
  return bell;
}

registerBoss({
  id: "bell_wife", type: "siege:bell_wife", name: ULFA.name, radius: DEEP.arenaRadius, phases: [0.66, 0.33], points: 8,
  intro: ULFA.intro,
  phaseNames: ULFA.phaseNames,
  attacks: [
    { id: "toll", every: 150, windup: 30, warn: "The great bell is about to toll. Get off the rings!", sound: "block.bell.hit",
      hit: (f) => {
        const c = f.center, off = Math.random() * Math.PI;
        for (const [r, n] of [[5, 6], [10, 10]]) {
          for (let i = 0; i < n; i++) {
            if (i % 3 === 2) continue; // a gap in every ring
            const a = off + (i / n) * Math.PI * 2;
            f.zone({ x: c.x + Math.cos(a) * r, y: c.y, z: c.z + Math.sin(a) * r }, 2.2, 10, (q) => { hurt(q, 8, "magic", f.entity); effect(q, "slowness", 40, 1); }, "minecraft:soul_particle");
          }
        }
      } },
    { id: "tongue", every: 110, windup: 20, warn: "Her breath freezes a line across the floor. Step aside!",
      start: (f) => f.target(),
      hit: (f, t) => {
        if (!alive(t)) return;
        const from = f.entity.location, dx = t.location.x - from.x, dz = t.location.z - from.z, len = Math.hypot(dx, dz) || 1;
        for (let s = 2; s <= 16; s += 2.5) {
          f.zone({ x: from.x + (dx / len) * s, y: f.center.y, z: from.z + (dz / len) * s }, 1.6, 6, (q) => { hurt(q, 7, "freezing", f.entity); effect(q, "slowness", 60, 2); }, "minecraft:snowflake_particle");
        }
      } },
    { id: "muster", every: 260, windup: 30, phases: [1, 2], warn: "She calls the Host to arms. Some of them answer!",
      when: (f) => f.adds().length < 3,
      hit: (f) => f.summon("siege:grey_spearman", f.solo() ? 1 : 2, 6) },
    { id: "hush", every: 200, windup: 20, phases: [2], warn: "The bell goes quiet. Get close to her before it rings!",
      hit: (f) => {
        for (const p of f.players()) {
          if (flat(p.location, f.entity.location) <= 6) continue;
          hurt(p, 9, "magic", f.entity);
          effect(p, "darkness", 80, 0);
          shove(p, f.entity.location.x - p.location.x, f.entity.location.z - p.location.z, 0.6, 0.1);
        }
      } },
  ],
  tick: (f) => {
    if (f.tick % 400 === 0) f.say(`§7Ulfa: §f${ULFA.lines[Math.floor(Math.random() * ULFA.lines.length)]}`);
  },
  loot: () => [ulfasBell(), stack("siege:choirsteel_ingot", 3), stack("siege:hollow_ash", 8)],
  hoard: (f, players) => [stack("siege:choirsteel_ingot", 4 + 2 * players.length), stack("minecraft:diamond", 2 + players.length), stack("siege:hollow_ash", 16), stack("siege:gloamquill", 2)],
  onDeath: (f) => {
    f.say(`§7${ULFA.fallen}`);
    deepStore.data.ulfaFell = today();
    deepStore.save();
    if (!deepOpen()) {
      setSeal(true);
      for (const p of deepPlayers()) p.sendMessage(SEAL_OPENS);
    }
  },
});

function wakeUlfa(dim) {
  const d = deepStore.data;
  let here = [];
  try { here = dim.getEntities({ type: "siege:bell_wife", location: ARENA(), maxDistance: 40 }); } catch { return; }
  if (here.length) return;
  if (!ulfaMayRise({ defeated: bestiaryStore.data.defeated?.bell_wife ?? 0, fellOnDay: d.ulfaFell, today: today(), fighting: !!fightOf("bell_wife") })) return;
  startBoss("bell_wife", dim, ARENA());
}

// ---------- the loop ----------
onTick("after:deep", 40, () => {
  const d = deepStore.data;
  if (!d.built) return;
  const players = deepPlayers();
  if (!players.length) return;
  const dim = players[0].dimension;
  musterHost(dim);
  if (!d.sealOpen && (bestiaryStore.data.defeated?.bell_wife ?? 0) > 0) setSeal(true); // she fell while nobody was saving
  if (players.some((p) => inBellRoom(p.location))) wakeUlfa(dim);
});

// ---------- tests and tools ----------
system.afterEvents.scriptEventReceive.subscribe((e) => {
  const p = e.sourceEntity;
  if (!e.id.startsWith("siege:deep") || p?.typeId !== "minecraft:player") return;
  if (p.getGameMode() !== GameMode.Creative) return p.sendMessage("§7Creative only.");
  const d = deepStore.data;
  if (e.id === "siege:deep") {
    const standing = standingCompanies(d.fates).map((c) => c.name);
    p.sendMessage(`§6The Deep:§7 ${d.built ? "built" : building ? "building" : "not built yet"}. Seal ${d.sealOpen ? "open" : "shut"}. Ulfa fallen ${bestiaryStore.data.defeated?.bell_wife ?? 0} times. Standing: ${standing.join(", ") || "nobody"}. Morvane ${morvaneFallen() ? "fallen" : "standing (the door stays sealed)"}.`);
    for (const [id, f] of Object.entries(d.fates)) p.sendMessage(`§8  ${id}: ${f.fate} by ${f.name} on day ${f.day}`);
  } else if (e.id === "siege:deep_go") {
    useDoor(p);
  } else if (e.id === "siege:deep_open") {
    setSeal(true);
    p.sendMessage("§7The Seal is open.");
  } else if (e.id === "siege:deep_reset") {
    d.fates = {}; d.led = {}; d.ulfaFell = -1;
    setSeal(false);
    p.sendMessage("§7Every company is back in its rank and the Seal is shut. (Ulfa's own fall count is the bestiary's.)");
  }
});

on("showcase", ({ player }) => {
  player.sendMessage("§6Act V, the Deep:§7 /scriptevent siege:deep_go takes you down (it builds the halls the first time). /scriptevent siege:deep shows its state, siege:deep_open opens the Seal to the Ranks.");
});
