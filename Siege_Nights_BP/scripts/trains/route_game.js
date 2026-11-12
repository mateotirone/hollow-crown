// Buying the line one stop at a time. The stretches are planned in routes_data.js; at any Station Post or Rail
// Depot a settlement owner can buy the next stretch out from a stop they can already reach by laid track, and the
// track lays itself, a few dozen blocks a tick. Rules and maths: routes.js.

import { world, system, BlockPermutation } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { onTick, isReady, moduleStore, keepOf, keepCenter } from "../siege/api.js";
import { charge, coins, funds } from "../economy/api.js";
import { stationMenuExtras } from "../rails/index.js";
import { isBuilder, give } from "../horses/menus.js";
import { callCarriage, hasUnlocked, unlock } from "./index.js";
import { allSites } from "./station_sites.js";
import { ROUTE, buyable, nearestStop, reachable, cannotBuy, priceOf, pieces, otherEnd, isNatural } from "./routes.js";
import { ROUTES } from "./routes_data.js";
import { TRACK, TRAIN, CARS, TRAIN_STYLES } from "./data.js";
import { addSwitch } from "./switches.js";

// built: { [segmentId]: { by, at } }; laying: [{ seg, i }] (a stretch going down, next piece i);
// missed: { [segmentId]: [piece index, ...] } (pieces whose ground wasn't loaded, tried again later)
// blocked: { [segmentId]: [{ x, y, z }] } buildings the bed found in its way and left standing
const store = moduleStore("siege:routes", () => ({ built: {}, laying: [], missed: {}, missedWorks: {}, blocked: {} }));
const built = () => store.data.built;
const segById = (id) => ROUTES.segments.find((s) => s.id === id);
const stopById = (id) => ROUTES.stops.find((s) => s.id === id);
const stopName = (id) => stopById(id)?.name ?? id;

// A player's settlement and the stop nearest its banner
const ownerOf = (player) => (keepOf(player.id) ? player.id : undefined);
export function homeStop(owner) {
  const keep = owner && keepOf(owner);
  if (!keep) return undefined;
  const c = keepCenter(keep);
  return nearestStop(ROUTES, c.x, c.z)?.id;
}

export const isBuilt = (segId) => !!built()[segId];
export const builtRoutes = () => built();
export const reachableFrom = (owner) => reachable(ROUTES, built(), homeStop(owner));

// ---------- the bed ----------
// The world has no rail beds (Mateo, 2026-11-12): each piece grades its own as it goes down. A corridor 3 wide is
// cleared to 4 above the track (a cutting, or a tunnel through a hill); under it goes gravel ballast on a fill of
// dirt down to the ground, or, where the ground is too far down or under water, a stone brick deck with a pier every
// few blocks.
// Resolved on first use: BlockPermutation.resolve can't run while scripts load (early execution), and a throw here
// stopped every script in the pack from loading.
const perms = {};
const perm = (id) => (perms[id] ??= BlockPermutation.resolve(id));
const AIR = () => perm("minecraft:air");
const BALLAST = () => perm("minecraft:gravel");
const FILL = () => perm("minecraft:dirt");
const DECK = () => perm("minecraft:stone_bricks");
const SOFT = /leaves|grass$|tall_grass|fern|flower|sapling|bush|vine|snow_layer|dandelion|poppy|tulip|orchid|allium|bluet|daisy|cornflower|lily|azure|kelp|seagrass|mushroom|torch/;
const firm = (b) => !!b && !b.isAir && !b.isLiquid && !SOFT.test(b.typeId);
const isTrack = (b) => b?.typeId === TRACK;
const GATED = /iron_bars|portcullis/;

// How far below `y` the ground is at (x, z): 0 when (x, y, z) itself is firm, up to `max`, or Infinity
function dropAt(dim, x, y, z, max) {
  for (let d = 0; d <= max; d++) if (firm(dim.getBlock({ x, y: y - d, z }))) return d;
  return Infinity;
}

// A building in the way of a stretch: left standing, and the buyer told once the stretch is down
function blocked(segId, b) {
  const list = ((store.data.blocked ??= {})[segId] ??= []);
  const at = { x: b.location.x, y: b.location.y, z: b.location.z };
  if (!list.some((q) => Math.hypot(q.x - at.x, q.z - at.z) < 8)) list.push(at);
}

function layBed(dim, p, i, segId) {
  if (!dim.getBlock(p)) return false; // not loaded
  // clear the corridor, keeping other track and the ballast under it
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const centre = !dx && !dz;
      for (let y = p.y + (centre ? 1 : 0); y <= p.y + ROUTE.clearUp; y++) {
        const b = dim.getBlock({ x: p.x + dx, y, z: p.z + dz });
        if (!b || b.isAir || isTrack(b)) continue;
        if (GATED.test(b.typeId)) continue; // a town's rail gate: it opens for trains (gates.js), so the bed leaves it shut
        if (!isNatural(b.typeId)) { blocked(segId, b); continue; } // somebody's building: never torn down
        if (y === p.y && isTrack(dim.getBlock({ x: p.x + dx, y: y + 1, z: p.z + dz }))) continue;
        b.setPermutation(AIR());
      }
    }
  }
  // the ground under the middle decides: an embankment or a bridge
  const drop = dropAt(dim, p.x, p.y - 1, p.z, ROUTE.fillDepth);
  const bridge = drop === Infinity;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const x = p.x + dx, z = p.z + dz, top = { x, y: p.y - 1, z };
      if (isTrack(dim.getBlock({ x, y: p.y, z: z })) && (dx || dz)) continue; // another line's track beside us
      const under = dim.getBlock(top);
      if (under && !under.isAir && !under.isLiquid && !isNatural(under.typeId)) { if (dx || dz) continue; blocked(segId, under); continue; }
      if (bridge) { under?.setPermutation(DECK()); continue; }
      const d = dropAt(dim, x, p.y - 1, z, ROUTE.fillDepth);
      for (let k = Math.min(d, ROUTE.fillDepth); k >= 1; k--) {
        const b = dim.getBlock({ x, y: p.y - 1 - k, z });
        if (b && !firm(b)) b.setPermutation(FILL());
      }
      dim.getBlock(top)?.setPermutation(BALLAST());
    }
  }
  if (bridge && i % ROUTE.pierEvery === 0) {
    for (let y = p.y - 2, n = 0; n < ROUTE.pierDepth; y--, n++) {
      const b = dim.getBlock({ x: p.x, y, z: p.z });
      if (!b || firm(b)) break;
      b.setPermutation(DECK());
    }
  }
  return true;
}

// Put one piece down, bed first. true when it's there (or was already), false when its ground isn't loaded.
function layPiece(dim, p, i = 0, segId = "") {
  try {
    const block = dim.getBlock(p);
    if (!block) return false;
    if (block.typeId !== TRACK && !p.works && !layBed(dim, p, i, segId)) return false;
    if (block.typeId !== TRACK && !block.isAir && !block.isLiquid && !isNatural(block.typeId)) { blocked(segId, block); return true; } // never over a building
    if (block.typeId !== TRACK) block.setPermutation(BlockPermutation.resolve(TRACK, { "siege:kind": p.kind, "siege:dir": p.dir }));
    else {
      // another line already lies here: where the two part, this block becomes a switch holding both shapes
      const kind = block.permutation.getState("siege:kind"), dir = block.permutation.getState("siege:dir");
      if (kind !== p.kind || dir !== p.dir) addSwitch(dim.id, p, { kind, dir }, { kind: p.kind, dir: p.dir });
    }
    return true;
  } catch {
    return false;
  }
}

function startLaying(seg) {
  store.data.laying.push({ seg: seg.id, i: 0, w: 0 });
  store.save();
}

// The map's own earthworks for a stretch (cuttings, embankments, viaducts, tunnels), if it has them:
// works [[x, z, y0, y1, palette index], ...] applied in order before the track. Without them each piece grades a
// plain bed (layBed).
const worksPalette = (seg) => (seg._perms ??= (seg.works_palette ?? []).map((e, i) => (i === 0 ? AIR() : BlockPermutation.resolve(e.name, e.states ?? {}))));
function applyWork(dim, seg, w) {
  const [x, z, y0, y1, i] = seg.works[w];
  const perm = worksPalette(seg)[i];
  if (!perm) return true;
  try {
    if (!dim.getBlock({ x, y: y0, z })) return false;
    for (let y = y0; y <= y1; y++) {
      const b = dim.getBlock({ x, y, z });
      if (!b || isTrack(b)) continue;
      if (!b.isAir && !b.isLiquid && !isNatural(b.typeId)) { blocked(seg.id, b); continue; } // never over a building
      b.setPermutation(perm);
    }
    return true;
  } catch {
    return false;
  }
}

// Every other tick: lay the next pieces of whatever stretch is going down
function layTick() {
  if (!isReady() || !store.data.laying.length) return;
  const dim = world.getDimension("minecraft:overworld");
  const job = store.data.laying[0];
  const seg = segById(job.seg);
  if (!seg) { store.data.laying.shift(); store.save(); return; }
  if (seg.works && (job.w ?? 0) < seg.works.length) {
    job.w ??= 0;
    const stop = Math.min(seg.works.length, job.w + ROUTE.worksPerTick);
    for (; job.w < stop; job.w++) if (!applyWork(dim, seg, job.w)) (store.data.missedWorks[seg.id] ??= []).push(job.w);
    store.save();
    return;
  }
  const all = pieces(seg);
  const end = Math.min(all.length, job.i + ROUTE.layPerTick);
  for (; job.i < end; job.i++) {
    if (!layPiece(dim, all[job.i], job.i, seg.id)) (store.data.missed[seg.id] ??= []).push(job.i);
  }
  if (job.i >= all.length) {
    store.data.laying.shift();
    world.sendMessage(`§6The line from ${stopName(seg.from)} to ${stopName(seg.to)} is laid.`);
    const hits = store.data.blocked?.[seg.id] ?? [];
    if (hits.length) world.sendMessage(`§eBuildings stand in its way at ${hits.slice(0, 4).map((q) => `${q.x}, ${q.z}`).join("; ")}${hits.length > 4 ? " and more" : ""}. They were left standing.`);
  }
  store.save();
}
onTick("route_lay", 2, layTick);

// Every two seconds: try again the pieces that were out of loaded ground
function missedTick() {
  if (!isReady()) return;
  const dim = world.getDimension("minecraft:overworld");
  // laying costs budget; looking at unloaded ground is cheap, so a long unloaded stretch can't starve the rest
  let budget = ROUTE.layPerTick, looks = ROUTE.missedLooks, changed = false;
  store.data.missedWorks ??= {};
  // earthworks first: a piece of track whose works haven't gone in yet waits for them
  const waiting = new Set();
  for (const [id, list] of Object.entries(store.data.missedWorks)) {
    const seg = segById(id);
    if (!seg?.works) { delete store.data.missedWorks[id]; changed = true; continue; }
    for (let k = list.length - 1; k >= 0 && looks > 0; k--, looks--) {
      if (applyWork(dim, seg, list[k])) { list.splice(k, 1); changed = true; }
    }
    if (list.length) waiting.add(id);
    else delete store.data.missedWorks[id];
  }
  for (const [id, list] of Object.entries(store.data.missed)) {
    const seg = segById(id);
    if (!seg) { delete store.data.missed[id]; changed = true; continue; }
    if (waiting.has(id)) continue;
    const all = pieces(seg);
    for (let k = list.length - 1; k >= 0 && budget > 0 && looks > 0; k--, looks--) {
      if (layPiece(dim, all[list[k]], list[k], id)) { list.splice(k, 1); budget--; changed = true; }
    }
    if (!list.length) delete store.data.missed[id];
    if (budget <= 0 || looks <= 0) break;
  }
  if (changed) store.save();
}
onTick("route_missed", 40, missedTick);

async function buyMenu(player, station, back) {
  const owner = ownerOf(player);
  const home = homeStop(owner);
  if (!home) {
    await new ActionFormData().title("Extend the line")
      .body(owner ? "§7Your settlement has no stop on the planned line near its banner, so there's nowhere to build out from." : "§7Only a settlement's owner can buy track. Found a settlement first.")
      .button("Back").show(player);
    return back();
  }
  const list = buyable(ROUTES, built(), home, station);
  const body = list.length
    ? `§7Home stop: §f${stopName(home)}§7. Each stretch runs to the next stop along a line, from a stop you can already reach. You have ${coins(funds(player))}.`
    : "§7Every stretch you can reach is already laid.";
  const form = new ActionFormData().title("Extend the line").body(body);
  for (const o of list) form.button(`To ${stopName(o.to)}\n§8from ${stopName(o.from)} · ${o.seg.length ?? o.seg.blocks.length} blocks · ${coins(o.price)}`);
  form.button("Back");
  const res = await form.show(player);
  if (res.canceled) return;
  const pick = list[res.selection];
  if (!pick) return back();
  const sure = await new ActionFormData().title(`To ${stopName(pick.to)}`)
    .body(`§7Lay the track from §f${stopName(pick.from)}§7 to §f${stopName(pick.to)}§7 for §f${coins(pick.price)}§7? It goes down over a few seconds, and stays for everyone.`)
    .button(`Buy for ${coins(pick.price)}`).button("Back").show(player);
  if (sure.canceled) return;
  if (sure.selection !== 0) return buyMenu(player, station, back);
  const why = cannotBuy(ROUTES, built(), homeStop(owner), pick.seg.id);
  if (why) return player.sendMessage(`§7${why}`);
  if (!charge(player, pick.price, "railway")) return player.sendMessage(`§7That stretch costs ${coins(pick.price)}.`);
  built()[pick.seg.id] = { by: owner, at: Date.now() };
  startLaying(pick.seg);
  player.sendMessage(`§6Track is going down from ${stopName(pick.from)} to ${stopName(pick.to)}.`);
}

stationMenuExtras.push({
  label: () => (ROUTES.segments.length ? "Extend the line\n§8buy track to the next stop" : undefined),
  action: (player, station, again) => buyMenu(player, station, again),
});

// ---------- the free carriage, and engines and coaches ----------

// The planned stop a station stands on, and a laid stretch out of it (undefined until its first line is bought)
const stopOf = (station) => nearestStop(ROUTES, station.x, station.z, 40);
const laidOut = (stop) => stop && ROUTES.segments.find((s) => isBuilt(s.id) && (s.from === stop.id || s.to === stop.id));
const carrying = (player, typeId) => {
  const inv = player.getComponent("minecraft:inventory")?.container;
  for (let i = 0; inv && i < inv.size; i++) if (inv.getItem(i)?.typeId === typeId) return true;
  return false;
};

stationMenuExtras.push({
  label: (player, station) => (laidOut(stopOf(station)) ? "Call the carriage\n§8free, slow, drives itself along the line" : undefined),
  action: (player, station) => {
    const stop = stopOf(station), seg = laidOut(stop);
    if (!seg) return;
    const site = allSites().find((s) => s.id === station.id);
    const at = site?.origin ?? { x: stop.x, y: stop.y, z: stop.z };
    const far = stopById(otherEnd(seg, stop.id)) ?? stop;
    const yaw = (Math.atan2(-(far.x - at.x), far.z - at.z) * 180) / Math.PI;
    const style = Math.max(0, TRAIN_STYLES.indexOf(site?.style ?? "vale"));
    const train = callCarriage(world.getDimension(station.dim), at, yaw, style, site?.owner, player);
    if (train) player.sendMessage(`§6The carriage is on the platform, facing ${far.name}. Climb in: hold forward to go, back to brake.`);
  },
});

for (const kind of ["engine", "coach"]) {
  const name = kind === "engine" ? "an engine" : "a coach";
  stationMenuExtras.push({
    label: (player) => (hasUnlocked(player.id, kind) ? `Take ${name}\n§8free: you've owned one before` : `Buy ${name}\n§8${coins(TRAIN.price[kind])}`),
    action: (player) => {
      const item = CARS[kind].item;
      if (hasUnlocked(player.id, kind)) {
        if (carrying(player, item)) return player.sendMessage(`§7You're already carrying ${name}.`);
        give(player, item);
        return player.sendMessage(`§6Here's ${name}. Place it on Track${kind === "coach" ? " right behind an engine" : ""}.`);
      }
      if (!charge(player, TRAIN.price[kind], "railway")) return player.sendMessage(`§7${name[0].toUpperCase()}${name.slice(1)} costs ${coins(TRAIN.price[kind])}. You can also build one at the Siege Workshop.`);
      give(player, item);
      unlock(player.id, kind);
      player.sendMessage(`§6You bought ${name}. If you ever lose it, any station gives you a new one free.`);
    },
  });
}

// /scriptevent siege:trains routes: what's planned and what's laid. /scriptevent siege:trains lay <stretch>: a
// builder lays a stretch for free (testing).
system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
  if (id !== "siege:trains" || p?.typeId !== "minecraft:player") return;
  const [cmd, arg] = message.trim().split(/\s+/);
  if (cmd === "routes") {
    const laid = ROUTES.segments.filter((s) => isBuilt(s.id)).length;
    const home = homeStop(ownerOf(p));
    p.sendMessage(`§6${ROUTES.stops.length} stops, ${laid} of ${ROUTES.segments.length} stretches laid.${home ? ` Your home stop: ${stopName(home)}, ${reachableFrom(p.id).size} stops reachable.` : ""}`);
    return;
  }
  if (cmd !== "lay") return;
  if (!isBuilder(p)) return p.sendMessage("§7Only a builder can do that.");
  const seg = segById(arg);
  if (!seg) return p.sendMessage(`§7No stretch "${arg}". Stretches: ${ROUTES.segments.map((s) => s.id).slice(0, 20).join(", ")}`);
  if (!isBuilt(seg.id)) built()[seg.id] = { by: undefined, at: Date.now() };
  startLaying(seg);
  p.sendMessage(`§6Laying ${seg.id} (${priceOf(seg)} would be its price).`);
});
