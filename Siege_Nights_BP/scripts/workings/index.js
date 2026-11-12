// Old Workings: the old king's mines beside five settlements, whose ore grows back. Numbers and layout: data.js.
//
// On a mapped world, the first time a player comes near a Working its entrance is picked (away from the plot's gate
// and landmark, on dry ground), and a timbered stair is dug down to a sealed stone chamber, a few blocks a tick.
// The chamber walls hold ore spots. Every few in-game days (data.js TIERS regrowDays) the spots that were dug out
// grow back, while nobody is inside. One Working runs rich each week (more ore, more of the best kind), announced
// to everyone at dawn. Gold and diamond Workings draw claim jumpers: a band that comes down the stair while you dig.
//
//   /scriptevent siege:workings                 list them: where, built, last refill, which one is rich
//   /scriptevent siege:workings tp <id>         go to an entrance
//   /scriptevent siege:workings regrow <id|all> refill now
//   /scriptevent siege:workings here <iron|gold|diamond>   dig a test Working where you stand (id "test")
//   /scriptevent siege:workings reset <id|all>  forget it, so it is placed and dug again

import { world, system, BlockPermutation } from "@minecraft/server";
import { onTick } from "../core/loop.js";
import { emit } from "../core/events.js";
import { moduleStore } from "../core/store.js";
import { mapMode } from "../plots/claims.js";
import {
  WORKINGS, TIERS, WORKS, planOf, tierOf, entranceBearings, spotAt, digDirection, chamberOf, inChamber, slotsOf,
  oreFor, regrowDue, richFor,
} from "./data.js";
import "./tests.js";

const OVERWORLD = "minecraft:overworld";
const JUMPER_TAG = "siege_claim_jumper";
// sites: { id: { x, y, z, b, dx, dz, v, last, tier? } }   (tier only on the test site)
const store = moduleStore("siege:workings", () => ({ sites: {}, week: -1 }));
const busy = new Set();
const lastBand = new Map(); // id -> tick of the last claim jumper band
const visited = new Set(); // "player|working" told this session

const workingOf = (id) => WORKINGS.find((w) => w.id === id) ?? (id === "test" && store.data.sites.test ? { id: "test", name: "the test Working", tier: store.data.sites.test.tier } : undefined);
const allWorkings = () => [...(mapMode() ? WORKINGS : []), ...(store.data.sites.test ? [workingOf("test")] : [])];
const overworld = () => world.getDimension(OVERWORLD);
const SOFT = /air$|leaves|_log$|_wood$|grass|fern|flower|snow_layer|vine|bush|sapling|tall_|short_|litter|moss_carpet|mushroom|dead_bush|cactus/;
const NATURAL_FILL = /air$|water|lava|grass|dirt|gravel|sand|^minecraft:(stone|deepslate|tuff|granite|diorite|andesite|calcite|clay|dripstone_block|mud|snow|ice|packed_ice)$|_ore$|terracotta|sandstone|leaves|vine|moss|glow_lichen|pointed_dripstone|amethyst|seagrass|kelp/;
const perm = (id, states) => {
  try { return BlockPermutation.resolve(id, states); } catch { return BlockPermutation.resolve(id); }
};
const LOG = { Frostmarch: "minecraft:stripped_spruce_log", Saltreach: "minecraft:stripped_birch_log", Emberwaste: "minecraft:stripped_acacia_log" };
const logFor = (w) => LOG[planOf(w)?.region] ?? "minecraft:stripped_oak_log";
const stoneAt = (y) => (y < 0 ? "minecraft:deepslate" : "minecraft:stone");
const isInside = (site, w, loc) => {
  const T = tierOf(w), c = chamberOf(w.tier, site, { x: site.dx, z: site.dz });
  return Math.abs(loc.x - c.x) <= T.r.x + 3 && Math.abs(loc.z - c.z) <= T.r.z + 3 && loc.y >= c.floor - 2 && loc.y <= c.y + T.r.y + 3;
};

// ---------- choosing the entrance ----------

function groundAt(dim, x, z) {
  let b;
  try { b = dim.getTopmostBlock({ x, z }); } catch { return undefined; }
  if (!b) return undefined;
  while (b && SOFT.test(b.typeId) && b.location.y > -60) b = b.below();
  if (!b || b.isLiquid || /water|lava|ice/.test(b.typeId)) return null; // loaded, but wet: try another side
  return b.location.y;
}

function placeSite(w, dim) {
  const plan = planOf(w);
  for (const b of entranceBearings(plan)) {
    const at = spotAt(plan, b);
    const y = groundAt(dim, at.x, at.z);
    if (y === undefined) return false; // not loaded yet
    if (y === null) continue;
    const d = digDirection(b);
    store.data.sites[w.id] = { x: at.x, y, z: at.z, b, dx: d.x, dz: d.z, v: 0 };
    store.save();
    return true;
  }
  return false;
}

// ---------- digging it ----------

function* dig(w, site) {
  const dim = overworld(), T = tierOf(w), d = { x: site.dx, z: site.dz }, side = { x: -d.z, z: d.x };
  const log = logFor(w), at = { x: site.x, y: site.y, z: site.z };
  let missed = 0;
  const set = (x, y, z, p) => {
    try { dim.getBlock({ x, y, z })?.setPermutation(p); } catch { missed++; }
  };
  const fillIfOpen = (x, y, z, id) => {
    try {
      const b = dim.getBlock({ x, y, z });
      if (b && (b.isAir || b.isLiquid || !b.isSolid)) b.setPermutation(perm(id));
    } catch { missed++; }
  };
  const air = perm("minecraft:air"), logP = perm(log), lantern = perm("minecraft:lantern", { hanging: true });
  // stairs climb back toward the entrance: weirdo_direction 0 east, 1 west, 2 south, 3 north
  const up = { x: -d.x, z: -d.z };
  const stair = perm("minecraft:stone_brick_stairs", { weirdo_direction: up.x > 0 ? 0 : up.x < 0 ? 1 : up.z > 0 ? 2 : 3 });
  const deepStair = perm("minecraft:cobbled_deepslate_stairs", { weirdo_direction: up.x > 0 ? 0 : up.x < 0 ? 1 : up.z > 0 ? 2 : 3 });
  // the portal: two posts and a beam, 5 wide, with a lantern under it
  for (let s = -2; s <= 2; s++) for (let h = 1; h <= 5; h++) {
    const x = at.x + side.x * s, z = at.z + side.z * s;
    if (Math.abs(s) === 2 || h === 5) set(x, at.y + h, z, logP);
    else set(x, at.y + h, z, air);
  }
  set(at.x, at.y + 4, at.z, lantern);
  yield;
  // the stair: 3 wide, 4 high inside, lined where it runs underground, a timber frame every 4 steps
  for (let k = 1; k <= T.depth; k++) {
    const fx = at.x + d.x * k, fz = at.z + d.z * k, floor = at.y - k;
    for (let s = -2; s <= 2; s++) {
      const x = fx + side.x * s, z = fz + side.z * s;
      for (let h = 0; h <= 5; h++) {
        const y = floor + h;
        const wall = Math.abs(s) === 2 || h === 5;
        if (h === 0 && Math.abs(s) <= 1) set(x, y, z, y < 0 ? deepStair : stair);
        else if (h === 0) fillIfOpen(x, y, z, stoneAt(y));
        else if (!wall) set(x, y, z, air);
        else if (k % 4 === 0 && (Math.abs(s) === 2 || h === 5)) { if (y <= at.y) set(x, y, z, logP); }
        else if (y <= at.y) fillIfOpen(x, y, z, stoneAt(y));
      }
      if (Math.abs(s) <= 1) fillIfOpen(x, floor - 1, z, stoneAt(floor - 1));
    }
    if (k % 8 === 0) set(fx, floor + 4, fz, lantern);
    yield;
  }
  // the chamber: open inside, sealed stone for two blocks round it (caves and lava stay out), flat floor
  const c = chamberOf(w.tier, at, d), r = T.r;
  for (let x = c.x - r.x - 2; x <= c.x + r.x + 2; x++) {
    for (let z = c.z - r.z - 2; z <= c.z + r.z + 2; z++) {
      for (let y = c.floor - 2; y <= c.y + r.y + 2; y++) {
        if (inChamber(c, r, x, y, z)) set(x, y, z, air);
        else if (inChamber(c, { x: r.x + 2, y: r.y + 2, z: r.z + 2 }, x, y, z) || (y < c.floor && inChamber({ ...c, floor: -999 }, { x: r.x + 2, y: 99, z: r.z + 2 }, x, c.y, z))) fillIfOpen(x, y, z, stoneAt(y));
      }
    }
    yield;
  }
  // the stair's last step opens into the chamber
  for (let k = T.depth + 1; k <= T.depth + 3; k++) for (let s = -1; s <= 1; s++) for (let h = 1; h <= 4; h++) {
    set(at.x + d.x * k + side.x * s, c.floor + h, at.z + d.z * k + side.z * s, air);
  }
  yield* refill(w, site, true);
  return missed;
}

// ---------- ore growing back ----------

function* refill(w, site, rich) {
  const dim = overworld(), c = chamberOf(w.tier, site, { x: site.dx, z: site.dz });
  const slots = slotsOf(w, c, site), T = tierOf(w);
  const count = rich ? slots.length : Math.min(slots.length, T.slots);
  let grown = 0;
  for (let i = 0; i < count; i++) {
    const s = slots[i];
    try {
      const b = dim.getBlock(s);
      if (b && (b.isAir || /^minecraft:(stone|deepslate|cobblestone|cobbled_deepslate|tuff|andesite|diorite|granite)$/.test(b.typeId))) {
        b.setPermutation(perm(oreFor(w.tier, Math.random(), s.y, rich)));
        grown++;
      }
    } catch { /* unloaded */ }
    if (i % 8 === 7) yield;
  }
  return grown;
}

function startJob(w, gen, done) {
  if (busy.has(w.id)) return;
  busy.add(w.id);
  system.runJob((function* () {
    let result;
    try { result = yield* gen; } catch (e) { console.warn(`[Hollow Crown] workings ${w.id}: ${e}`); }
    busy.delete(w.id);
    try { done?.(result); } catch (e) { console.warn(`[Hollow Crown] workings ${w.id}: ${e}`); }
  })());
}

// ---------- the loop ----------

function near(dim, loc, reach) {
  return dim.getPlayers({ location: { x: loc.x, y: loc.y ?? 64, z: loc.z }, maxDistance: reach }).length > 0
    || world.getPlayers().some((p) => p.dimension.id === OVERWORLD && Math.hypot(p.location.x - loc.x, p.location.z - loc.z) <= reach);
}

function tick() {
  const list = allWorkings();
  if (!list.length) return;
  const dim = overworld(), day = world.getDay();
  announceRich(day);
  for (const w of list) {
    if (busy.has(w.id)) continue;
    let site = store.data.sites[w.id];
    if (!site) {
      const plan = planOf(w);
      if (!plan || !near(dim, spotAt(plan, entranceBearings(plan)[0]), WORKS.reach)) continue;
      if (!placeSite(w, dim)) continue;
      site = store.data.sites[w.id];
    }
    if (!near(dim, site, WORKS.reach + tierOf(w).depth)) continue;
    for (const p of world.getPlayers()) {
      if (p.dimension.id !== OVERWORLD || !isInside(site, w, p.location) || visited.has(`${p.id}|${w.id}`)) continue;
      visited.add(`${p.id}|${w.id}`);
      emit("workingEntered", { player: p, working: w.id, tier: w.tier });
      p.onScreenDisplay.setActionBar(`§7${w.name[0].toUpperCase()}${w.name.slice(1)}${richFor(day) === w.id ? " §6(running rich)" : ""}`);
    }
    if ((site.v ?? 0) < WORKS.version) {
      startJob(w, dig(w, site), (missed) => {
        if (missed) return; // some chunk was not loaded: dig again next time (it is safe to repeat)
        site.v = WORKS.version; site.last = world.getDay(); store.save();
      });
      continue;
    }
    if (regrowDue(w.tier, site.last, day) && !world.getPlayers().some((p) => p.dimension.id === OVERWORLD && isInside(site, w, p.location))) {
      startJob(w, refill(w, site, richFor(day) === w.id), () => { site.last = day; store.save(); });
    }
  }
}

function announceRich(day) {
  const week = Math.floor(day / WORKS.richEvery);
  if (!mapMode() || store.data.week === week) return;
  const first = store.data.week === -1;
  store.data.week = week; store.save();
  if (first) return; // a new world hears about it next week, once there is something to compare it with
  const w = WORKINGS.find((x) => x.id === richFor(day));
  for (const p of world.getPlayers()) p.sendMessage(`§6Word on the roads:§7 ${w.name} is running rich this week. The ${w.tier} is coming back thick in its walls.`);
}

// Claim jumpers: a band comes down the stair while someone digs a gold or diamond Working
function jumpers() {
  const now = system.currentTick;
  for (const w of allWorkings()) {
    const T = tierOf(w), site = store.data.sites[w.id];
    if (!site || !T.jumpers.chance || (site.v ?? 0) < WORKS.version) continue;
    if (now - (lastBand.get(w.id) ?? -Infinity) < WORKS.jumperCooldown) continue;
    const inside = world.getPlayers().filter((p) => p.dimension.id === OVERWORLD && isInside(site, w, p.location));
    if (!inside.length) continue;
    const chance = T.jumpers.chance * (richFor(world.getDay()) === w.id ? 2 : 1);
    if (Math.random() >= chance) continue;
    lastBand.set(w.id, now);
    const dim = overworld(), foot = { x: site.x + site.dx * T.depth + 0.5, y: site.y - T.depth + 1, z: site.z + site.dz * T.depth + 0.5 };
    for (let i = 0; i < T.jumpers.count; i++) {
      try {
        const e = dim.spawnEntity(i % 2 ? "minecraft:pillager" : "minecraft:vindicator", foot);
        e.addTag(JUMPER_TAG); e.addTag(`siege_cj_${w.id}`);
        e.nameTag = "§cClaim Jumper";
      } catch { /* stair not loaded */ }
    }
    for (const p of inside) p.onScreenDisplay.setActionBar("§cBoots on the stair. Claim jumpers, after the ore!");
  }
}

world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  let tag, loc, dim;
  try {
    if (!deadEntity.hasTag(JUMPER_TAG)) return;
    tag = deadEntity.getTags().find((t) => t.startsWith("siege_cj_"));
    loc = deadEntity.location; dim = deadEntity.dimension;
  } catch { return; }
  const w = workingOf(tag?.slice("siege_cj_".length));
  if (!w) return;
  const [item, lo, hi] = tierOf(w).loot;
  const n = lo + Math.floor(Math.random() * (hi - lo + 1));
  system.run(() => {
    try { dim.runCommand(`give @p[x=${Math.floor(loc.x)},y=${Math.floor(loc.y)},z=${Math.floor(loc.z)},r=16] ${item} ${n}`); } catch { /* nobody near */ }
  });
});

onTick("workings", 40, tick);
onTick("workings jumpers", 600, jumpers);

// ---------- test command ----------

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:workings") return;
  const player = event.sourceEntity;
  const say = (m) => (player?.typeId === "minecraft:player" ? player.sendMessage(m) : console.warn(m));
  const [cmd = "list", arg] = event.message.trim().split(/\s+/);
  const day = world.getDay(), rich = richFor(day);
  if (cmd === "list") {
    for (const w of [...WORKINGS, ...(store.data.sites.test ? [workingOf("test")] : [])]) {
      const s = store.data.sites[w.id];
      say(`§e${w.id}§7 ${w.tier}${w.id === rich ? " §6(rich)§7" : ""}: ${s ? `entrance ${s.x} ${s.y} ${s.z}, ${(s.v ?? 0) >= WORKS.version ? `dug, refilled day ${s.last}` : "not dug yet"}` : "not placed yet"}`);
    }
    return;
  }
  const pick = (id) => (id === "all" ? Object.keys(store.data.sites) : [id]).map(workingOf).filter(Boolean);
  if (cmd === "tp") {
    const s = store.data.sites[arg];
    if (!s || player?.typeId !== "minecraft:player") return say("§cNot placed yet (or no such Working).");
    player.teleport({ x: s.x + 0.5 - s.dx * 2, y: s.y + 1, z: s.z + 0.5 - s.dz * 2 }, { dimension: overworld() });
    return;
  }
  if (cmd === "regrow") {
    for (const w of pick(arg)) if (store.data.sites[w.id]) store.data.sites[w.id].last = undefined;
    store.save();
    return say("§aThey will refill as soon as nobody is inside.");
  }
  if (cmd === "reset") {
    for (const w of pick(arg)) delete store.data.sites[w.id];
    store.save();
    return say("§aForgotten: placed and dug again when a player comes near.");
  }
  if (cmd === "here") {
    if (player?.typeId !== "minecraft:player" || !TIERS[arg]) return say("§cUse: here iron|gold|diamond (standing where the entrance should be).");
    const v = player.getViewDirection();
    const d = Math.abs(v.x) >= Math.abs(v.z) ? { x: Math.sign(v.x) || 1, z: 0 } : { x: 0, z: Math.sign(v.z) || 1 };
    const l = player.location;
    store.data.sites.test = { x: Math.floor(l.x), y: Math.floor(l.y) - 1, z: Math.floor(l.z), b: 0, dx: d.x, dz: d.z, v: 0, tier: arg };
    store.save();
    return say(`§aDigging a ${arg} Working ahead of you. Stand clear of the stair for a few seconds.`);
  }
  say("§cUse: list | tp <id> | regrow <id|all> | here <tier> | reset <id|all>");
});
