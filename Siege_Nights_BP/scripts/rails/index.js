// The rail network for The Hollow Crown: Station Posts (placed by the map builder), Rail Depots
// (placed by players on their plot), destinations, the network map, express track and horse stalls.
// The design is in the "Hollow Crown: Horses and Rail Network" doc. Numbers to tweak: data.js.

import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { onTick, isReady, moduleStore, settlementAt, isAlly, keepOf, title, on, emit } from "../siege/api.js";
import { RAIL_SETTINGS as R, REGIONS, RAILS, RIDES, CARRIAGE, CARRIAGE_ITEM, nextId, nearestStation, networkLines, wayTo, expressAxis } from "./data.js";
import { stallMenu } from "../horses/index.js";
import { isBuilder, give } from "../horses/menus.js";
import "./tests.js";
import { sfx } from "../core/sfx.js";

export const STATION_POST = "hc:station_post";
export const RAIL_DEPOT = "siege:rail_depot";
const CART_TAG = "siege_rails_cart";
const FOUND = "siege:rails_found";
const DEST = "siege:rails_dest";

// stations: [{ id, name, region, x, y, z, dim, owner? }]. owner = the settlement a Rail Depot belongs to.
const store = moduleStore("siege:rails_stations", () => ({ stations: [] }));
const stations = () => store.data.stations;
export const allStations = () => stations();
export const stationById = (id) => stations().find((s) => s.id === id);

// The station building (trains/station_sites.js) moves the post or depot block onto its platform once it is built
export function moveStation(id, to) {
  const s = stationById(id);
  if (!s) return;
  s.x = to.x; s.y = to.y; s.z = to.z;
  store.save();
}

// Other features add buttons to the station menu: { label(player, station, again) -> text or falsy, action(player, station, again) }
export const stationMenuExtras = [];

const say = (player, text) => player.onScreenDisplay.setActionBar(text);
const stationAt = (block) => stations().find((s) => s.x === block.location.x && s.y === block.location.y && s.z === block.location.z && s.dim === block.dimension.id);
const byId = (id) => stations().find((s) => s.id === id);

function foundBy(player) {
  try {
    const raw = player.getDynamicProperty(FOUND);
    return typeof raw === "string" ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function discover(player, station, quiet) {
  const found = foundBy(player);
  if (found.includes(station.id)) return false;
  found.push(station.id);
  player.setDynamicProperty(FOUND, JSON.stringify(found));
  if (!quiet) {
    title(player, `§6${station.name}`, `§7Station discovered · ${found.length} of ${stations().length}`);
    sfx(player, "random.orb");
  }
  return true;
}

const destinationOf = (player) => byId(player.getDynamicProperty(DEST));

// ---------- Building the network ----------

async function nameStation(player, station) {
  const res = await new ModalFormData().title("Station Post")
    .textField("Station name", station.name)
    .dropdown("Region", REGIONS).show(player);
  if (res.canceled) return;
  const name = String(res.formValues?.[0] ?? "").trim().slice(0, 28);
  if (name) station.name = name;
  station.region = REGIONS[res.formValues?.[1]] ?? station.region;
  store.save();
  player.sendMessage(`§a${station.name} (${station.region}) is on the network.`);
}

function addStation(block, name, region, owner) {
  const station = { id: nextId(stations()), name, region, x: block.location.x, y: block.location.y, z: block.location.z, dim: block.dimension.id };
  if (owner) station.owner = owner;
  stations().push(station);
  store.save();
  return station;
}

function undoPlace(player, block, message) {
  const typeId = block.typeId;
  block.setType("minecraft:air");
  if (!isBuilder(player)) give(player, typeId);
  say(player, message);
}

world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
  if (!isReady()) return;
  if (block.typeId === STATION_POST) {
    if (!isBuilder(player)) return undoPlace(player, block, "§cStation Posts are placed by the map builder in Creative. Build a Rail Depot on your plot instead.");
    if (stations().length >= R.maxStations) return undoPlace(player, block, "§cThe network is full.");
    const station = addStation(block, `Station ${nextId(stations())}`, REGIONS[0]);
    discover(player, station, true);
    return nameStation(player, station);
  }
  if (block.typeId !== RAIL_DEPOT) return; // (Siege Nights has already refused it if this isn't your land)
  const owner = settlementAt(block.location);
  if (!owner) return;
  const old = stations().find((s) => s.owner === owner);
  if (old) {
    let standing = true;
    try {
      const there = world.getDimension(old.dim).getBlock(old);
      standing = !there || there.typeId === RAIL_DEPOT;
    } catch {
      // not loaded: assume it still stands
    }
    if (standing) return undoPlace(player, block, "§cThis settlement already has a Rail Depot. Break the old one first.");
    stations().splice(stations().indexOf(old), 1);
  }
  const station = addStation(block, `${keepOf(owner)?.name ?? player.name}'s Depot`, "Depots", owner);
  discover(player, station, true);
  player.sendMessage(`§6${station.name} has joined the rail network. A station is rising around it, lined up with any straight Track close by (or with its line behind the depot, the building in front of you). Lay Track from it to the nearest line, then click the depot to pick a destination or stable a horse.`);
  emit("stationAdded", { station, block, player });
});

world.afterEvents.playerBreakBlock.subscribe((event) => {
  if (!isReady()) return;
  const typeId = event.brokenBlockPermutation.type.id;
  if (typeId !== STATION_POST && typeId !== RAIL_DEPOT) return;
  const station = stationAt(event.block);
  if (!station) return;
  stations().splice(stations().indexOf(station), 1);
  store.save();
  event.player.sendMessage(`§7${station.name} has left the rail network.`);
});

// ---------- The station menu ----------

function findRail(block) {
  const { x, y, z } = block.location;
  let best, bestDist = Infinity;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -R.railSearch; dx <= R.railSearch; dx++) {
      for (let dz = -R.railSearch; dz <= R.railSearch; dz++) {
        let there;
        try {
          there = block.dimension.getBlock({ x: x + dx, y: y + dy, z: z + dz });
        } catch {
          continue;
        }
        if (!there || !RAILS.includes(there.typeId)) continue;
        const dist = Math.abs(dx) + Math.abs(dz) + Math.abs(dy);
        if (dist < bestDist) {
          best = there;
          bestDist = dist;
        }
      }
    }
  }
  return best;
}

function callCart(player, block, type = "minecraft:minecart") {
  const rail = findRail(block);
  if (!rail) return player.sendMessage(`§7There is no rail within ${R.railSearch} blocks of this post.`);
  const at = { x: rail.location.x + 0.5, y: rail.location.y + 0.1, z: rail.location.z + 0.5 };
  const waiting = RIDES.flatMap((ride) => block.dimension.getEntities({ type: ride, location: at, maxDistance: 2 }));
  if (waiting.length) return say(player, "§7Something is already waiting on the platform.");
  const cart = block.dimension.spawnEntity(type, at);
  cart.addTag(CART_TAG);
  cart.setDynamicProperty("siege:rails_idle", system.currentTick);
  sfx(player, "random.click");
  say(player, type === CARRIAGE ? "§6A carriage rolls up to the platform. It seats four." : "§6A cart rolls up to the platform.");
}

async function pickDestination(player, here, back) {
  const found = foundBy(player);
  const list = stations().filter((s) => s !== here && found.includes(s.id) && s.dim === here.dim);
  const form = new ActionFormData().title("Destination")
    .body(list.length ? "§7Where to? Your bar shows the way while you ride, and you'll hear when you arrive."
      : "§7You haven't discovered any other station yet. Ride the line, or walk up to a Station Post, to add it.");
  for (const s of list) form.button(`${s.name}\n§8${s.owner ? "Depot" : s.region} · ${wayTo(here, s)}`);
  form.button("Back");
  const res = await form.show(player);
  if (res.canceled) return;
  const chosen = list[res.selection];
  if (!chosen) return back();
  player.setDynamicProperty(DEST, chosen.id);
  player.sendMessage(`§6Destination set: ${chosen.name}, ${wayTo(player.location, chosen)}. Board a cart and push off.`);
}

async function stationMenu(player, block, station) {
  const again = () => stationMenu(player, block, station);
  const dest = destinationOf(player);
  const depot = !!station.owner;
  const stallsOpen = !depot || station.owner === player.id || isAlly(station.owner, player.id);
  const found = foundBy(player);
  const body = [
    `§6${station.name}§7 · ${depot ? "Rail Depot" : station.region}`,
    `§7Stations discovered: §f${found.length}§7 of ${stations().length}`,
    dest ? `§7Destination: §f${dest.name}§7, ${wayTo(player.location, dest)}` : "§7No destination set.",
  ].join("\n");
  const entries = [
    { label: "Call a carriage\n§8seats four, faster than a cart", action: () => callCart(player, block, CARRIAGE) },
    { label: "Call a minecart", action: () => callCart(player, block) },
    { label: "Choose a destination", action: () => pickDestination(player, station, again) },
    dest && { label: "Clear destination", action: () => { player.setDynamicProperty(DEST, undefined); return again(); } },
    {
      label: "Network map",
      action: async () => {
        await new ActionFormData().title("Rail network").body(networkLines(stations(), found, player.location).join("\n")).button("Back").show(player);
        return again();
      },
    },
    stallsOpen && { label: "Horse stalls\n§8stable or collect a horse", action: () => stallMenu(player, { dimension: block.dimension, location: { x: block.location.x + 0.5, y: block.location.y + 1, z: block.location.z + 0.5 } }, station.name, again) },
    ...stationMenuExtras.map((x) => { const label = x.label(player, station, again); return label && { label, action: () => x.action(player, station, again) }; }),
    isBuilder(player) && !depot && { label: "§aRename (builder)", action: () => nameStation(player, station) },
  ].filter(Boolean);
  const form = new ActionFormData().title("Station").body(body);
  for (const e of entries) form.button(e.label);
  form.button("Close");
  const res = await form.show(player);
  if (!res.canceled) await entries[res.selection]?.action();
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player } = event;
  if (event.isFirstEvent === false || !isReady()) return;
  if (block.typeId !== STATION_POST && block.typeId !== RAIL_DEPOT) return;
  event.cancel = true;
  system.run(() => {
    if (!block.isValid) return;
    let station = stationAt(block);
    if (!station) {
      // a post that was placed by command or structure: adopt it
      if (block.typeId !== STATION_POST) {
        // a depot that was placed by command or structure: link it if its settlement has none
        const owner = block.dimension.id === "minecraft:overworld" ? settlementAt(block.location) : undefined;
        if (!owner || stations().some((s) => s.owner === owner)) return say(player, "§7This depot isn't linked. Break it and place it again on your land.");
        station = addStation(block, `${keepOf(owner)?.name ?? "A"}'s Depot`, "Depots", owner);
        discover(player, station, true);
        return stationMenu(player, block, station);
      }
      if (!isBuilder(player)) return say(player, "§7This station isn't open yet.");
      station = addStation(block, `Station ${nextId(stations())}`, REGIONS[0]);
      return nameStation(player, station);
    }
    discover(player, station, true);
    stationMenu(player, block, station);
  });
});

// ---------- On the line ----------

const cartOf = (player) => {
  try {
    const mount = player.getComponent("minecraft:riding")?.entityRidingOn;
    return RIDES.includes(mount?.typeId) ? mount : undefined;
  } catch {
    return undefined;
  }
};

function travelTick() {
  if (!stations().length) return;
  for (const player of world.getPlayers()) {
    const here = nearestStation(stations(), player.location, player.dimension.id, R.arriveRange);
    const dest = destinationOf(player);
    if (here && Math.hypot(here.x - player.location.x, here.z - player.location.z) <= R.discoverRange) {
      const fresh = discover(player, here);
      if (dest && dest.id === here.id) {
        player.setDynamicProperty(DEST, undefined);
        title(player, `§6${here.name}`, "§7You have arrived.");
        sfx(player, "note.bell");
        continue;
      }
      if (!fresh && cartOf(player) && player.getDynamicProperty("siege:rails_last") !== here.id) say(player, `§7Passing §f${here.name}`);
      player.setDynamicProperty("siege:rails_last", here.id);
    } else if (!here) {
      player.setDynamicProperty("siege:rails_last", undefined);
    }
    if (dest && cartOf(player) && dest.dim === player.dimension.id) say(player, `§6${dest.name} §7· §f${wayTo(player.location, dest)}`);
  }
}

// Sneak + click your own Train Carriage with an empty hand to pack it up (station carriages tidy themselves)
world.beforeEvents.playerInteractWithEntity?.subscribe((event) => {
  const { player, target, itemStack } = event;
  if (target.typeId !== CARRIAGE || !player.isSneaking || itemStack) return;
  event.cancel = true;
  system.run(() => {
    if (!target.isValid) return;
    if (target.hasTag(CART_TAG)) return say(player, "§7Station carriages put themselves away.");
    if ((target.getComponent("minecraft:rideable")?.getRiders() ?? []).length) return say(player, "§7Someone is still aboard.");
    target.remove();
    give(player, CARRIAGE_ITEM);
    say(player, "§6Carriage packed up.");
  });
});

// Express track: nudge a cart with a destination along straight, flat rail. Curves and slopes stay vanilla.
function expressTick() {
  if (!R.express || !stations().length) return;
  for (const player of world.getPlayers()) {
    const cart = cartOf(player);
    if (!cart || !destinationOf(player)) continue;
    const go = expressAxis(cart.getVelocity());
    if (!go || go.speed >= R.expressSpeed) continue;
    const at = cart.location;
    let clear = true;
    for (let step = 0; step <= 3 && clear; step++) {
      let rail;
      try {
        rail = cart.dimension.getBlock({ x: Math.floor(at.x) + go.x * step, y: Math.floor(at.y), z: Math.floor(at.z) + go.z * step });
      } catch {
        clear = false;
        break;
      }
      clear = !!rail && RAILS.includes(rail.typeId) && rail.permutation.getState("rail_direction") === go.railDirection;
    }
    if (clear) cart.applyImpulse({ x: go.x * R.expressPush, y: 0, z: go.z * R.expressPush });
  }
}

// Empty station carts are tidied away after a minute
function tidyTick() {
  const now = system.currentTick;
  for (const player of world.getPlayers()) {
    for (const cart of RIDES.flatMap((ride) => player.dimension.getEntities({ type: ride, tags: [CART_TAG], location: player.location, maxDistance: 96 }))) {
      const riders = cart.getComponent("minecraft:rideable")?.getRiders() ?? [];
      const idleSince = cart.getDynamicProperty("siege:rails_idle") ?? now;
      if (riders.length || idleSince > now) cart.setDynamicProperty("siege:rails_idle", now); // (a reload restarts the tick count)
      else if (now - idleSince > R.cartIdleTicks) cart.remove();
    }
  }
}

onTick("rails_travel", 20, travelTick);
onTick("rails_express", 4, expressTick);
onTick("rails_tidy", 200, tidyTick);

// ---------- The test world (/scriptevent siege:showcase): two stations joined by a short powered line ----------

on("showcase", ({ player, dim, nextSpot, label }) => {
  const first = nextSpot();
  const second = nextSpot();
  const y = first.y, z = first.z - 2; // the line runs just behind the exhibit row
  try {
    for (const old of stations().filter((s) => s.showcase)) stations().splice(stations().indexOf(old), 1); // from an earlier run
    for (let x = Math.min(first.x, second.x) - 1; x <= Math.max(first.x, second.x) + 1; x++) {
      const powered = (x - first.x) % 4 === 0;
      dim.getBlock({ x, y: y - 1, z })?.setType(powered ? "minecraft:redstone_block" : "minecraft:stone_bricks");
      dim.getBlock({ x, y, z })?.setType(powered ? "minecraft:golden_rail" : "minecraft:rail");
    }
    dim.spawnEntity(CARRIAGE, { x: first.x + 1.5, y: y + 0.1, z: z + 0.5 }).addTag("siege_showcase");
    [[first, "Showcase Halt"], [second, "Far Platform"]].forEach(([at, name]) => {
      const block = dim.getBlock(at);
      if (!block) return;
      block.setType(STATION_POST);
      addStation(block, name, "Kingsrest").showcase = true;
      label(at, `Station Post\n${name}\nclick it`);
    });
    const here = stationAt(dim.getBlock(first));
    if (here) discover(player, here, true); // the other one is left for you to discover
    store.save();
  } catch (e) {
    console.warn(`[Hollow Crown] showcase rails: ${e}`);
  }
  player.sendMessage("§6Rails: two Station Posts behind you with a powered line and a Train Carriage on it (click to board, push forward to go). Click a post to call another, walk to the other to discover it, then set it as your destination.");
});
