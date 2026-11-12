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
import { ROUTE, buyable, nearestStop, reachable, cannotBuy, priceOf, pieces, otherEnd } from "./routes.js";
import { ROUTES } from "./routes_data.js";
import { TRACK, TRAIN, CARS, TRAIN_STYLES } from "./data.js";

// built: { [segmentId]: { by, at } }; laying: [{ seg, i }] (a stretch going down, next piece i);
// missed: { [segmentId]: [piece index, ...] } (pieces whose ground wasn't loaded, tried again later)
const store = moduleStore("siege:routes", () => ({ built: {}, laying: [], missed: {} }));
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
export const reachableFrom = (owner) => reachable(ROUTES, built(), homeStop(owner));

// Put one piece down. true when it's there (or was already), false when its ground isn't loaded.
function layPiece(dim, p) {
  try {
    const block = dim.getBlock(p);
    if (!block) return false;
    if (block.typeId !== TRACK) block.setPermutation(BlockPermutation.resolve(TRACK, { "siege:kind": p.kind, "siege:dir": p.dir }));
    return true;
  } catch {
    return false;
  }
}

function startLaying(seg) {
  store.data.laying.push({ seg: seg.id, i: 0 });
  store.save();
}

// Every other tick: lay the next pieces of whatever stretch is going down
function layTick() {
  if (!isReady() || !store.data.laying.length) return;
  const dim = world.getDimension("minecraft:overworld");
  const job = store.data.laying[0];
  const seg = segById(job.seg);
  if (!seg) { store.data.laying.shift(); store.save(); return; }
  const all = pieces(seg);
  const end = Math.min(all.length, job.i + ROUTE.layPerTick);
  for (; job.i < end; job.i++) {
    if (!layPiece(dim, all[job.i])) (store.data.missed[seg.id] ??= []).push(job.i);
  }
  if (job.i >= all.length) {
    store.data.laying.shift();
    world.sendMessage(`§6The line from ${stopName(seg.from)} to ${stopName(seg.to)} is laid.`);
  }
  store.save();
}
onTick("route_lay", 2, layTick);

// Every two seconds: try again the pieces that were out of loaded ground
function missedTick() {
  if (!isReady()) return;
  const dim = world.getDimension("minecraft:overworld");
  let budget = ROUTE.layPerTick, changed = false;
  for (const [id, list] of Object.entries(store.data.missed)) {
    const seg = segById(id);
    if (!seg) { delete store.data.missed[id]; changed = true; continue; }
    const all = pieces(seg);
    for (let k = list.length - 1; k >= 0 && budget > 0; k--, budget--) {
      if (layPiece(dim, all[list[k]])) { list.splice(k, 1); changed = true; }
    }
    if (!list.length) delete store.data.missed[id];
    if (budget <= 0) break;
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
