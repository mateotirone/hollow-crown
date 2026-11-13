// Station buildings in the world. A settlement's station rises when it takes a claim with a Station Post near it
// (the map builder's posts, about 95 blocks out from each Plot Stone) or when its owner places a Rail Depot.
// It is rebuilt bigger as the settlement grows: Hamlet a Halt, Town a Station, City a Junction, Castle a Grand
// Station. The track runs through its platform, lined up with straight Track already there.
// The plans and the maths: stations.js. The post and depot blocks themselves: rails/index.js.

import { world, system, BlockPermutation } from "@minecraft/server";
import { onTick, isReady, moduleStore, keepOf, keepCenter, tierOf, on } from "../siege/api.js";
import { startBuild, buildFor, worldCells, worldMarks } from "../townhall/build.js";
import { styleOf } from "../settle/plans.js";
import { allStations, stationById, moveStation, addStationAt, STATION_POST, RAIL_DEPOT } from "../rails/index.js";
import { STATION, STAGE_NAMES, STAGES, stageFor, stationPlan, siteFor, lineBlocks, loopBlocks, regionOf, cardinal } from "./stations.js";
import { TRACK } from "./data.js";
import { reader } from "./index.js";
import { addSwitch } from "./switches.js";
import { ROUTES } from "./routes_data.js";
import { stopSite } from "./routes.js";

// sites: [{ id (the station's id), owner, dim, post {x,y,z}, facing {x,z}, style, stage (wanted), built (stage up, or null),
//           origin?, forward? (set once the ground was loaded and it was lined up) }]
const store = moduleStore("siege:station_sites", () => ({ sites: [] }));
const sites = () => store.data.sites;
const jobId = (site) => `station:${site.id}`;
const POST_RANGE = 140; // a claim takes the nearest free Station Post this close to its banner

const tell = (owner, text) => {
  const p = owner && world.getPlayers().find((pl) => pl.id === owner);
  if (p) p.sendMessage(text);
};
const stageOf = (owner) => {
  const keep = owner && keepOf(owner);
  return keep ? stageFor(keep.tier ?? tierOf(keep).name) : "halt";
};

export function addSite({ station, owner, facing, style, stage }) {
  if (sites().some((s) => s.id === station.id)) return;
  const site = { id: station.id, owner, dim: station.dim, post: { x: station.x, y: station.y, z: station.z }, facing: cardinal(facing), style, stage: stage ?? stageOf(owner), built: null };
  sites().push(site);
  store.save();
  return site;
}

// Line the site up against the track. Needs the ground round the post loaded; false until it is.
function lineUp(site, dim) {
  if (site.origin) return true;
  try {
    if (!dim.getBlock(site.post)) return false;
  } catch {
    return false;
  }
  const found = siteFor(site.post, reader(dim), site.facing);
  site.origin = found.origin;
  site.forward = found.forward;
  store.save();
  return true;
}

function place(dim, at, typeId, states) {
  const block = dim.getBlock(at);
  if (!block) return false;
  block.setPermutation(states ? BlockPermutation.resolve(typeId, states) : BlockPermutation.resolve(typeId));
  return true;
}

function finish(site, plan) {
  const dim = world.getDimension(site.dim);
  const station = stationById(site.id);
  // the post (or depot) moves to its spot on the platform
  if (station) {
    const to = worldMarks(plan, site.origin, site.forward).post;
    const kind = station.owner ? RAIL_DEPOT : STATION_POST;
    try {
      const old = dim.getBlock(station);
      if (old?.typeId === kind && !(to.x === station.x && to.y === station.y && to.z === station.z)) old.setPermutation(BlockPermutation.resolve("minecraft:air"));
      if (place(dim, to, kind)) moveStation(site.id, to);
    } catch (e) {
      console.warn(`[Hollow Crown] station post: ${e}`);
    }
  }
  // then the line through the platform, keeping any Track already there
  for (const b of lineBlocks(plan, site.origin, site.forward)) {
    try {
      const block = dim.getBlock(b);
      if (block && block.typeId !== TRACK) place(dim, b, TRACK, { "siege:kind": 0, "siege:dir": b.dir });
    } catch {
      // unloaded at the far end: the owner can lay that piece by hand
    }
  }
  // and the passing loop beside it, with a switch at each end
  for (const b of loopBlocks(plan, site.origin, site.forward)) {
    try {
      const block = dim.getBlock(b);
      if (!block) continue;
      if (!b.end) {
        if (block.typeId !== TRACK) place(dim, b, TRACK, { "siege:kind": b.kind, "siege:dir": b.dir });
        continue;
      }
      if (block.typeId !== TRACK) continue; // the line's end isn't down: no switch without it
      const kind = block.permutation.getState("siege:kind"), dir = block.permutation.getState("siege:dir");
      if (kind !== b.kind || dir !== b.dir) addSwitch(dim.id, { x: b.x, y: b.y, z: b.z }, { kind, dir }, { kind: b.kind, dir: b.dir });
    } catch {
      // unloaded: laid the next time the station is rebuilt
    }
  }
  const was = site.built;
  site.built = site.stage;
  store.save();
  const name = `${STAGE_NAMES[site.stage]}${station ? ` at ${station.name}` : ""}`;
  tell(site.owner, was ? `§6Your station has grown into a ${name}.` : `§6Your ${name} is built. Lay Track from its platform to the line.`);
}

function raise(site) {
  const dim = world.getDimension(site.dim);
  if (!lineUp(site, dim)) return;
  const plan = stationPlan(site.style, site.stage);
  const remove = site.built && site.built !== site.stage ? worldCells(stationPlan(site.style, site.built), site.origin, site.forward) : undefined;
  startBuild({
    id: jobId(site), dimensionId: site.dim, origin: site.origin, forward: site.forward, plan, style: plan.style,
    perTick: STATION.perTick, remove, onDone: () => finish(site, plan),
  });
}

// Every two seconds: drop sites whose post is gone, start any station that isn't the size it should be
// (this also picks builds back up after a reload)
function sitesTick() {
  if (!isReady()) return;
  let changed = false;
  for (let i = sites().length - 1; i >= 0; i--) {
    const site = sites()[i];
    if (!stationById(site.id)) { sites().splice(i, 1); changed = true; continue; }
    if (site.built === site.stage || buildFor(jobId(site))) continue;
    if (!world.getPlayers().some((p) => p.dimension.id === site.dim && Math.hypot(p.location.x - site.post.x, p.location.z - site.post.z) < 160)) continue;
    try {
      raise(site);
    } catch (e) {
      console.warn(`[Hollow Crown] station ${site.id}: ${e}`);
    }
  }
  if (changed) store.save();
}
onTick("station_sites", 40, sitesTick);

// A Rail Depot placed on your land
on("stationAdded", ({ station, block, player }) => {
  if (!station.owner) return;
  const view = player.getViewDirection();
  addSite({ station, owner: station.owner, facing: { x: view.x, z: view.z }, style: styleOf(station.owner, block) });
});

// A claim with a free Station Post near its banner takes it
on("keepFounded", ({ player, keep, moved }) => {
  if (moved || sites().some((s) => s.owner === player.id)) return;
  const c = keepCenter(keep);
  const taken = new Set(sites().map((s) => s.id));
  let best, bestDist = POST_RANGE;
  for (const s of allStations()) {
    if (s.owner || taken.has(s.id) || s.dim !== player.dimension.id) continue;
    const d = Math.hypot(s.x - c.x, s.z - c.z);
    if (d < bestDist) { best = s; bestDist = d; }
  }
  if (!best) return stationOnStop(player, keep, c);
  let style = "vale";
  try {
    style = styleOf(player.id, player.dimension.getBlock(keep));
  } catch {
    // the banner's ground isn't loaded: Vale it is
  }
  addSite({ station: best, owner: player.id, facing: { x: c.x - best.x, z: c.z - best.z }, style });
  player.sendMessage(`§6${best.name} is yours: a Halt will rise beside the line there, and grow as your settlement does.`);
});

// No Station Post near the banner: the station rises on the planned railway's stop for this plot instead, lined up
// with the line through it and the building on the settlement's side. It has no line yet: the first stretch out of
// it is bought at the station (route_game.js).
function stationOnStop(player, keep, c) {
  const at = stopSite(ROUTES, c);
  if (!at) return;
  const { stop, origin, forward } = at;
  if (allStations().some((s) => s.dim === player.dimension.id && Math.hypot(s.x - stop.x, s.z - stop.z) < 8)) return; // someone's already there
  let style = "vale";
  try {
    style = styleOf(player.id, player.dimension.getBlock(keep));
  } catch {
    // the banner's ground isn't loaded: Vale it is
  }
  const station = addStationAt({ name: stop.name, region: regionOf(style), x: origin.x, y: origin.y, z: origin.z, dim: player.dimension.id });
  const site = addSite({ station, owner: player.id, facing: forward, style });
  if (!site) return;
  site.origin = origin;
  site.forward = forward;
  store.save();
  player.sendMessage(`§6A Halt is rising at ${stop.name}, on the planned railway. It has no line yet: buy the first stretch at the station to start travelling.`);
}

on("tierUp", ({ owner, after }) => {
  let changed = false;
  for (const s of sites()) {
    if (s.owner !== owner) continue;
    s.stage = stageFor(after.name);
    changed = true;
  }
  if (changed) store.save();
});

// /scriptevent siege:trains station [halt|station|junction|grand] [vale|frostmarch|...]: a builder's test.
// Raises a station where you stand: the line through your feet, the building in front of you.
system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
  if (id !== "siege:trains" || p?.typeId !== "minecraft:player") return;
  const [cmd, stage = "halt", region] = message.trim().split(/\s+/);
  if (cmd !== "station") return;
  if (!STAGES.includes(stage)) return p.sendMessage(`§7Stages: ${STAGES.join(", ")}`);
  const v = p.getViewDirection();
  const forward = cardinal({ x: v.x, z: v.z });
  const origin = { x: Math.floor(p.location.x), y: Math.floor(p.location.y), z: Math.floor(p.location.z) };
  const style = regionOf(region ?? styleOf(p.id, p.dimension.getBlock(origin)));
  const plan = stationPlan(style, stage);
  startBuild({
    id: `station:test:${system.currentTick}`, dimensionId: p.dimension.id, origin, forward, plan, style: plan.style, perTick: STATION.perTick,
    onDone: () => {
      for (const b of lineBlocks(plan, origin, forward)) {
        try {
          if (p.dimension.getBlock(b)?.typeId !== TRACK) place(p.dimension, b, TRACK, { "siege:kind": 0, "siege:dir": b.dir });
        } catch {
          // unloaded
        }
      }
      if (p.isValid) p.sendMessage(`§6${STAGE_NAMES[stage]} (${style}) built.`);
    },
  });
  p.sendMessage(`§6Raising a ${STAGE_NAMES[stage]} in the ${style} style here.`);
});

export const allSites = () => sites();
