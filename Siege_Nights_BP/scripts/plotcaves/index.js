// Plot caves, game side: a mine shaft on every plot down to its own cave, reset every night with the ore rolled
// into new places (Mateo 2026-11-13). The shape comes from caves/cavegen.js; what gets written each night (which
// levels the plot's tier opens, the ore, the shaft fittings, the camp, the sealed door and its tunnel) is
// plotcaves/data.js.
//
// On a mapped world, the first time a player comes near a plot its shaft is placed: 76 blocks from the plot's
// stone (outside the Castle wall, inside the plot's land), on dry natural ground, away from the gate, the
// landmark and any Old Working. Then the pithead is raised over it (pithead.js: the building skill's collar,
// headframe and sheave, winding house, ore bin and pit bell, facing the Plot Stone, on a terraformed pad), and the
// cave under it is written for the first time with the old mine in it (mine.js). From then on, once each night, while a player is near (so the chunks are loaded)
// and nobody is in the cave, the whole cave is written back to its first shape with that night's ore. When the
// plot's tier goes up, the next reset opens the next level down.
//
// At Castle, the cave's deep end gets a sealed door. Behind it a dark tunnel runs in and turns. Once the Rift is
// torn open, the door opens for anyone who has beaten all five bosses (the veil's rule), and walking on past the
// turn brings them out of a tunnel mouth beside the tear. Walking back into that mouth brings them out at the
// turn in the plot they came from. To the player it is one long tunnel.
//
//   /scriptevent siege:plotcave                    list: where each shaft is, its tier and last reset
//   /scriptevent siege:plotcave tp <plot>          go to a shaft          door <plot>   go to its sealed door
//   /scriptevent siege:plotcave reset <plot|all>   reset it now (as soon as nobody is inside)
//   /scriptevent siege:plotcave tier <plot> <0-3|clear>   pretend the plot is at a tier, to look at the levels
//   /scriptevent siege:plotcave here               put a test cave's shaft where you stand (plot "test")
//   /scriptevent siege:plotcave pithead <plot|all> raise the pithead over the shaft again
//   /scriptevent siege:plotcave mouth              go to the tunnel mouth beside the Rift

import { world, system, BlockPermutation, GameMode } from "@minecraft/server";
import { onTick } from "../core/loop.js";
import { emit } from "../core/events.js";
import { sfx } from "../core/sfx.js";
import { moduleStore } from "../core/store.js";
import { allPlots, holderOf, mapMode } from "../plots/claims.js";
import { PLOT_PLAN } from "../plots/config.js";
import { keepOf } from "../siege/api.js";
import { TIERS as SETTLE_TIERS, tierOf } from "../siege/territory.js";
import { regionRate } from "../economy/config.js";
import { WORKINGS, entranceBearings } from "../workings/data.js";
import { plotCaveJob } from "../caves/cavegen.js";
import { getRift, canOpen } from "../undertow/source.js";
import { progressOf } from "../lore/player.js";
import { fallenCount } from "../lore/data/spine.js";
import { CAVE, LEVELS, LOG, REGION_KEY, nightAt, nightPlanJob, mouthSpots, mouthPlan, splitBlock, insideBox } from "./data.js";
import { PIT_VERSION, pitheadPlan, pitheadFacing, pitheadOrigin } from "./pithead.js";
import { startBuild, buildFor, clearBoxFor } from "../townhall/build.js";
import { Groundwork } from "../settle/ground.js";
import { idSpellings } from "../core/blockids.js";
import "./tests.js";

const OVERWORLD = "minecraft:overworld";
// sites: { plot: { x, y, z, region, v, night, tier, box, door?, trig?, landing?, override? } }   (world coords)
// mouth: { site, landing, trig } once the tunnel mouth beside the Rift is cut
const store = moduleStore("siege:plotcaves", () => ({ sites: {}, mouth: null }));
// A plot's mine as last written (the Codex reads the sealed door's spot for Hroda's Pick)
export const caveSiteOf = (plot) => store.data.sites?.[plot];
const busy = new Set();
const caves = new Map(); // plot -> generated cave (the last few only; they are big)
const told = new Map(); // "player|what" -> tick, so lines are not repeated every check
const cooldown = new Map(); // player -> tick when the tunnel may move them again
const visited = new Set(); // "player|plot" told this session
const overworld = () => world.getDimension(OVERWORLD);
const perms = new Map();
const perm = (b) => {
  let p = perms.get(b);
  if (!p) {
    const [id, states] = splitBlock(b);
    for (const name of idSpellings(id)) { // the Bedrock spelling too (core/blockids.js: chain is iron_chain)
      try { p = BlockPermutation.resolve(name, states); break; } catch { /* next */ }
      try { p = BlockPermutation.resolve(name); break; } catch { /* next */ }
    }
    p ??= BlockPermutation.resolve("minecraft:air");
    perms.set(b, p);
  }
  return p;
};

const regionOf = (plot) => REGION_KEY[plot.region] ?? "vale";
const plotsWithCaves = () => [...(mapMode() ? allPlots() : []), ...(store.data.sites.test ? [{ name: "test", region: "Aldmere Vale", test: true }] : [])];

function tierIndexOf(plot) {
  const site = store.data.sites[plot.name];
  if (site?.override !== undefined) return site.override;
  const owner = plot.test ? undefined : holderOf(plot), keep = owner && keepOf(owner);
  return keep ? Math.max(0, SETTLE_TIERS.indexOf(tierOf(keep))) : 0;
}

const local = (site, p) => ({ x: Math.floor(p.x) - site.x, y: Math.floor(p.y) - site.y, z: Math.floor(p.z) - site.z });
// before its first build a cave has no box yet: then anyone standing on the shaft counts as inside, so it never
// opens under their feet
const inside = (site, p) => (site.box ? insideBox(site.box, local(site, p)) : Math.hypot(p.x - site.x, p.z - site.z) <= 6);
const overworldPlayers = () => world.getPlayers().filter((p) => p.dimension.id === OVERWORLD);
const near = (site, reach) => overworldPlayers().some((p) => Math.hypot(p.location.x - site.x, p.location.z - site.z) <= reach);
const sayOnce = (player, what, text, every = 600) => {
  const k = `${player.id}|${what}`, now = system.currentTick;
  if (now - (told.get(k) ?? -Infinity) < every) return;
  told.set(k, now);
  player.onScreenDisplay.setActionBar(text);
};

// ---------- choosing the shaft ----------

const SOFT = /air$|grass$|short_grass|tall_grass|fern|flower|snow_layer|vine|bush|sapling|poppy|dandelion|tulip|daisy|orchid|allium|cornflower|lily|leaf_litter|dead_bush|mushroom/;
const GROUND = /^minecraft:(grass_block|grass|dirt|coarse_dirt|podzol|rooted_dirt|mycelium|moss_block|mud|clay|sand|red_sand|gravel|snow|stone|deepslate|granite|diorite|andesite|tuff|calcite|sandstone|red_sandstone|terracotta|\w+_terracotta|packed_ice|dirt_with_roots)$/;

function groundAt(dim, x, z) {
  let b;
  try { b = dim.getTopmostBlock({ x, z }); } catch { return undefined; }
  if (!b) return undefined;
  while (b && SOFT.test(b.typeId) && b.location.y > -60) b = b.below();
  if (!b || b.isLiquid || !GROUND.test(b.typeId)) return null;
  return b.location.y;
}

function shaftBearings(plot) {
  const plan = PLOT_PLAN.find((p) => p.name === plot.name);
  if (!plan) return [];
  const all = entranceBearings(plan, 10);
  if (!WORKINGS.some((w) => w.plot === plot.name)) return all;
  const working = entranceBearings(plan)[0], apart = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  return all.filter((b) => apart(b, working) >= 90);
}

function placeShaft(plot) {
  const dim = overworld();
  for (const b of shaftBearings(plot)) {
    const r = (b * Math.PI) / 180, x = plot.x + Math.round(Math.sin(r) * CAVE.shaftR), z = plot.z - Math.round(Math.cos(r) * CAVE.shaftR);
    const y = groundAt(dim, x, z);
    if (y === undefined) return false; // not loaded yet
    if (y === null) continue;
    let ok = true;
    for (let dx = -CAVE.footprint; dx <= CAVE.footprint && ok; dx++) for (let dz = -CAVE.footprint; dz <= CAVE.footprint && ok; dz++) {
      const g = groundAt(dim, x + dx, z + dz);
      if (g === undefined) return false;
      ok = g !== null && Math.abs(g - y) <= 2;
    }
    if (!ok) continue;
    store.data.sites[plot.name] = { x, y, z, region: regionOf(plot), v: 0 };
    store.save();
    return true;
  }
  return false;
}

// ---------- the nightly reset ----------

function* caveFor(name, site) {
  let cave = caves.get(name);
  if (!cave) {
    cave = yield* plotCaveJob(name, { region: site.region, groundY: site.y });
    caves.set(name, cave);
    while (caves.size > 3) caves.delete(caves.keys().next().value);
  }
  return cave;
}

function* reset(plot, site, tierIndex, night) {
  const cave = yield* caveFor(plot.name, site);
  const plan = yield* nightPlanJob(cave, { tierIndex, region: site.region, night, plot: plot.name, groundY: site.y, front: site.front, rate: (region, metal) => regionRate(plot.region, metal) });
  const dim = overworld();
  let missed = 0, n = 0;
  for (const [k, b] of plan.blocks) {
    const [lx, ly, lz] = k.split(",").map(Number), loc = { x: site.x + lx, y: site.y + ly, z: site.z + lz };
    try {
      const block = dim.getBlock(loc);
      if (!block) missed++;
      else {
        const p = perm(b);
        if (block.typeId !== p.type.id || b.includes("{")) block.setPermutation(p);
      }
    } catch { missed++; }
    if (++n % 192 === 0) yield;
  }
  // the last shift's note in the miners' rest
  for (const s of plan.signs) {
    try {
      const sign = dim.getBlock({ x: site.x + s.x, y: site.y + s.y, z: site.z + s.z })?.getComponent("minecraft:sign");
      if (sign && sign.getText() !== s.text) { sign.setText(s.text); sign.setWaxed(true); }
    } catch { /* unloaded: the next night writes it */ }
  }
  const at = (key) => { const [x, y, z] = key.split(",").map(Number); return { x: site.x + x, y: site.y + y, z: site.z + z }; };
  const t = plan.tunnel;
  return {
    missed, box: plan.box,
    door: t ? t.door.map(at) : undefined,
    trig: t ? boxOf(t.trigger.map(at)) : undefined,
    landing: t ? { x: site.x + t.landing.x, y: site.y + t.landing.y, z: site.z + t.landing.z, look: at(`${t.landing.look.x},${t.landing.look.y},${t.landing.look.z}`) } : undefined,
  };
}

// ---------- the pithead ----------

const pitId = (name) => `pithead:${name}`;
function raisePithead(plot, site) {
  const { forward, front } = pitheadFacing(site, plot.test ? null : plot);
  const plan = pitheadPlan(site.region), origin = pitheadOrigin(site, forward, site.region);
  site.front = front;
  startBuild({
    id: pitId(plot.name), dimensionId: OVERWORLD, origin, forward, plan, style: plan.style, perTick: 48,
    clearBox: clearBoxFor(plan, origin, forward, 1), // the old headframe, and any tree standing on the ground
    ground: new Groundwork(plan, origin, forward, site.region),
    onDone: () => { site.pit = PIT_VERSION; site.v = 0; store.save(); }, // then the cave (ladder top, rope) goes in
  });
}

function boxOf(cells) {
  const min = { x: Infinity, y: Infinity, z: Infinity }, max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const c of cells) for (const a of ["x", "y", "z"]) { min[a] = Math.min(min[a], c[a]); max[a] = Math.max(max[a], c[a]); }
  return { min, max };
}
const inBox = (b, p) => b && p.x >= b.min.x && p.x < b.max.x + 1 && p.y >= b.min.y - 0.5 && p.y < b.max.y + 1 && p.z >= b.min.z && p.z < b.max.z + 1;

function startJob(id, gen, done) {
  if (busy.has(id)) return;
  busy.add(id);
  system.runJob((function* () {
    let result;
    try { result = yield* gen; } catch (e) { console.warn(`[Hollow Crown] plot cave ${id}: ${e}`); }
    busy.delete(id);
    try { done?.(result); } catch (e) { console.warn(`[Hollow Crown] plot cave ${id}: ${e}`); }
  })());
}

function tick() {
  const night = nightAt(world.getAbsoluteTime());
  for (const plot of plotsWithCaves()) {
    if (busy.has(plot.name)) continue;
    let site = store.data.sites[plot.name];
    if (!site) {
      if (plot.test || !near({ x: plot.x, z: plot.z }, CAVE.shaftR + CAVE.reach) || !placeShaft(plot)) continue;
      site = store.data.sites[plot.name];
    }
    if ((site.pit ?? 0) < PIT_VERSION) {
      // the pithead first: the cave waits for it, because the build clears the ground row round the shaft
      if (near(site, CAVE.reach) && !buildFor(pitId(plot.name))) raisePithead(plot, site);
      continue;
    }
    const tier = tierIndexOf(plot);
    const due = (site.v ?? 0) < CAVE.version || site.night !== night || site.tier !== tier;
    if (!due || !near(site, CAVE.reach) || overworldPlayers().some((p) => inside(site, p.location))) continue;
    const grew = site.tier !== undefined && tier > site.tier;
    startJob(plot.name, reset(plot, site, tier, night), (r) => {
      if (!r || r.missed) return; // part of it was not loaded: go again next check (it is safe to repeat)
      Object.assign(site, { v: CAVE.version, night, tier, box: r.box, door: r.door, trig: r.trig, landing: r.landing, doorOpen: false });
      store.save();
      if (grew) {
        const owner = holderOf(plot), player = owner && world.getPlayers().find((p) => p.id === owner);
        player?.sendMessage(tier >= LEVELS.length - 1
          ? "§6The last cave-in in your mine has come down.§7 The deepest level is open, and at its far end there is a door in the rock that nobody has opened."
          : `§6A cave-in in your mine has shifted.§7 Now your settlement is a ${SETTLE_TIERS[tier].name}, a deeper level is open below the old one.`);
      }
    });
  }
}

// ---------- the door, the tunnel and the mouth beside the Rift ----------

const mayPass = (p) => p.getGameMode() === GameMode.Creative || canOpen(fallenCount(progressOf(p).flags));
const riftOpen = () => !!getRift()?.open;

function openDoor(site) {
  const dim = overworld();
  for (const c of site.door ?? []) { try { dim.getBlock(c)?.setPermutation(perm("minecraft:air")); } catch { /* unloaded */ } }
  site.doorOpen = true; store.save();
  sfx(dim, "random.anvil_land", site.door[5] ?? site.door[0], { volume: 0.7, pitch: 0.5 });
}

function cutMouth() {
  const rift = getRift();
  if (!rift?.open || store.data.mouth || !near(rift, 48)) return;
  const dim = overworld();
  const isAir = (c) => { const b = dim.getBlock(c); return b ? b.isAir : undefined; };
  const solidOrNull = (c) => { const b = dim.getBlock(c); return b ? !b.isAir && !b.isLiquid : undefined; };
  try {
    for (const spot of mouthSpots(rift)) {
      const plan = mouthPlan(spot, LOG.vale);
      const front = plan.front.map(isAir), back = [...plan.cut, ...plan.trigger].map(solidOrNull);
      if (front.includes(undefined) || back.includes(undefined)) return; // not loaded yet
      if (!front.every(Boolean) || back.filter(Boolean).length < back.length * 0.8) continue;
      for (const c of [...plan.cut, ...plan.trigger]) dim.getBlock(c)?.setPermutation(perm("minecraft:air"));
      for (const c of plan.dark) dim.getBlock(c)?.setPermutation(perm("minecraft:black_concrete"));
      for (const c of plan.frame) dim.getBlock(c)?.setPermutation(perm(c.block));
      store.data.mouth = { landing: plan.landing, trig: boxOf(plan.trigger) };
      store.save();
      return;
    }
    store.data.mouth = { landing: { x: rift.x + 0.5, y: rift.y, z: rift.z + 0.5 }, trig: null, none: true }; // no room: no mouth
    store.save();
  } catch { /* unloaded: try later */ }
}

function moveTo(player, to) {
  cooldown.set(player.id, system.currentTick + 60);
  try { player.addEffect("darkness", 50, { amplifier: 0, showParticles: false }); } catch { /* fine */ }
  player.teleport({ x: to.x, y: to.y, z: to.z }, { dimension: overworld(), facingLocation: to.look });
}

function doors() {
  const now = system.currentTick;
  for (const p of overworldPlayers()) {
    if ((cooldown.get(p.id) ?? 0) > now) continue;
    const l = p.location;
    for (const [name, site] of Object.entries(store.data.sites)) {
      if (!site.box || visited.has(`${p.id}|${name}`) || !inside(site, l) || l.y > site.y - 2) continue;
      visited.add(`${p.id}|${name}`);
      emit("plotCaveEntered", { player: p, plot: name });
      p.onScreenDisplay.setActionBar(`§7The ${name === "test" ? "test" : name} mine`);
    }
    // walking out of the plot tunnel's dark end
    for (const [name, site] of Object.entries(store.data.sites)) {
      if (!site.door) continue;
      const d = site.door[5] ?? site.door[0];
      if (!site.doorOpen && Math.hypot(l.x - d.x - 0.5, l.y - d.y, l.z - d.z - 0.5) <= CAVE.doorReach) {
        if (riftOpen() && mayPass(p)) openDoor(site);
        else sayOnce(p, "door", "§7A door in the rock, sealed with the old king's mark. Whatever it shut away has not finished weighing you.");
      }
      if (inBox(site.trig, l)) {
        const mouth = store.data.mouth;
        if (!riftOpen() || !mayPass(p) || !mouth?.trig) { sayOnce(p, "tunnel", "§7The tunnel goes on into the dark, further than you can follow tonight.", 200); moveTo(p, site.landing); continue; }
        p.setDynamicProperty("hc:cave_from", name);
        moveTo(p, mouth.landing);
        emit("plotCaveTunnel", { player: p, plot: name });
      }
    }
    // walking back into the mouth beside the Rift
    const mouth = store.data.mouth;
    if (mouth?.trig && inBox(mouth.trig, l)) {
      const from = p.getDynamicProperty("hc:cave_from");
      const site = store.data.sites[from] ?? Object.values(store.data.sites).find((s) => s.landing);
      if (!site?.landing) { sayOnce(p, "mouth", "§7The tunnel has fallen in a little way along.", 200); moveTo(p, mouth.landing); continue; }
      if (site.door && !site.doorOpen) openDoor(site);
      moveTo(p, site.landing);
    }
  }
}

onTick("plotcaves", 40, () => { tick(); cutMouth(); });
onTick("plotcaves doors", 10, doors);

// ---------- builder commands ----------

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:plotcave") return;
  const player = event.sourceEntity;
  const say = (m) => (player?.typeId === "minecraft:player" ? player.sendMessage(m) : console.warn(m));
  const [cmd = "list", arg, arg2] = event.message.trim().split(/\s+/);
  const sites = store.data.sites;
  const tp = (to) => player?.typeId === "minecraft:player" && player.teleport({ x: to.x + 0.5, y: to.y + 1, z: to.z + 0.5 }, { dimension: overworld() });
  if (cmd === "list") {
    for (const plot of plotsWithCaves()) {
      const s = sites[plot.name];
      say(`§e${plot.name}§7: ${s ? `shaft ${s.x} ${s.y} ${s.z}, ${LEVELS[tierIndexOf(plot)].tier} level${s.override !== undefined ? " (test)" : ""}, ${(s.v ?? 0) >= CAVE.version ? `reset night ${s.night}${s.door ? ", door" : ""}` : "not built yet"}` : "shaft not placed yet"}`);
    }
    return say(store.data.mouth ? `§7Rift tunnel mouth: ${store.data.mouth.none ? "no room by the tear" : "cut"}` : "§7Rift tunnel mouth: not cut (the Rift must be open, with a player near it)");
  }
  if (cmd === "tp" || cmd === "door") {
    const s = sites[arg];
    if (!s) return say("§cNo shaft placed for that plot yet.");
    if (cmd === "door") return s.door ? tp({ x: s.landing.x - 0.5, y: s.landing.y - 1, z: s.landing.z - 0.5 }) : say("§cNo door yet: it comes with the Castle level.");
    const [fx, fz] = s.front ?? [0, -1];
    return tp({ x: s.x + fx * 11, y: s.y, z: s.z + fz * 11 }); // on the path in front of the pithead
  }
  if (cmd === "mouth") return store.data.mouth ? tp({ x: store.data.mouth.landing.x - 0.5, y: store.data.mouth.landing.y - 1, z: store.data.mouth.landing.z - 0.5 }) : say("§cNot cut yet.");
  if (cmd === "reset") {
    for (const name of arg === "all" ? Object.keys(sites) : [arg]) if (sites[name]) sites[name].night = undefined;
    store.save();
    return say("§aIt resets as soon as nobody is inside and a player is near.");
  }
  if (cmd === "tier") {
    const s = sites[arg];
    if (!s) return say("§cNo shaft placed for that plot yet.");
    if (arg2 === "clear") delete s.override; else s.override = Math.max(0, Math.min(3, Number(arg2) | 0));
    store.save();
    return say(`§a${arg} cave: ${s.override === undefined ? "back to its real tier" : `shown at the ${LEVELS[s.override].tier} level`}. It rebuilds once you are out of it.`);
  }
  if (cmd === "pithead") {
    for (const name of arg === "all" ? Object.keys(sites) : [arg]) if (sites[name]) sites[name].pit = 0;
    store.save();
    return say("§aThe pithead goes up again as soon as a player is near.");
  }
  if (cmd === "here") {
    if (player?.typeId !== "minecraft:player") return;
    const l = player.location;
    sites.test = { x: Math.floor(l.x), y: Math.floor(l.y) - 1, z: Math.floor(l.z), region: REGION_KEY[arg] ?? arg ?? "vale", v: 0 };
    caves.delete("test");
    store.save();
    return say("§aA test cave goes in under your feet in a moment. Step a few blocks away from here.");
  }
  say("§cUse: list | tp <plot> | door <plot> | reset <plot|all> | tier <plot> <0-3|clear> | pithead <plot|all> | here [region] | mouth");
});
