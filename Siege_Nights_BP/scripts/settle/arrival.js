// Arriving on a plot. When a Keep Banner goes up on a Plot Stone the settlement is laid out at once:
// a palisade round the plot (walls.js), a Longhouse already standing behind the banner, a mason at
// a bench beside it, and a signpost on every slot where a building will stand later.
//
// It runs when walls are automatic (a map with Plot Stones). Test anywhere:
//   /scriptevent siege:settle_arrive      lay your settlement out round your keep now

import { world, system } from "@minecraft/server";
import { isReady, keepOf, on, TIERS } from "../siege/api.js";
import { buildFor } from "../townhall/build.js";
import { CORNERSTONE, halls, saveHalls, beginBuild } from "../townhall/townhall.js";
import { mapMode } from "../plots/claims.js";
import { BUILDING } from "./buildings.js";
import { REGION_TO_STYLE } from "./config.js";
import { HALL, MASON, SLOTS, place } from "./layout.js";
import { BENCH, registerBench } from "./mason.js";
import { styleOf, raiseFree } from "./plans.js";
import { WALLS } from "./walldata.js";
import { wallOf, raiseWall, bearingFor } from "./walls.js";
import { townFor } from "./towns.js";
import { townOf, foundTown } from "./founding.js";

const OVERWORLD = "minecraft:overworld";
const SOFT = /(air|water|grass|fern|flower|snow_layer|leaves|vine|bush|sapling|tallgrass|dandelion|poppy|mushroom|_log$|deadbush)/;

function standY(dim, x, z) {
  try {
    let block = dim.getTopmostBlock({ x, z });
    for (let i = 0; block && i < 40 && SOFT.test(block.typeId); i++) block = block.below();
    return block ? block.location.y + 1 : undefined;
  } catch {
    return undefined;
  }
}

function signpost(dim, at, text) {
  try {
    const block = dim.getBlock(at);
    if (!block || !SOFT.test(block.typeId)) return; // something already stands here
    block.setType("minecraft:standing_sign");
    block.getComponent("minecraft:sign")?.setText(text);
  } catch {
    // signs are a nicety
  }
}

// at: lay out round this spot (a Plot Stone) for a player who has no Keep Banner up yet.
// A town with a layout (the twelve map plots, founding.js) is laid out from it instead.
export function layOut(player, { force = false, at, style: wanted } = {}) {
  if (townOf(player.id)) return "already";
  const keep = keepOf(player.id) ?? at;
  if (!keep) return "Raise a Keep Banner first.";
  const dim = world.getDimension(OVERWORLD);
  const center = { x: keep.x, y: keep.y, z: keep.z };
  if (!dim.getBlock(center)) return "That ground is not loaded yet.";
  const style = wanted ?? styleOf(player.id, dim.getBlock(center));
  const fresh = !wallOf(player.id) || wallOf(player.id).x !== center.x || wallOf(player.id).z !== center.z;

  // 1. the wall (its gate decides which way everything faces)
  let wall = wallOf(player.id);
  if (!wall || wall.x !== center.x || wall.z !== center.z) {
    raiseWall(player.id, 1, { center, style, bearing: bearingFor(center) });
    wall = wallOf(player.id);
  }
  const gateDir = wall?.gateDir ?? "south";

  // 2. the Longhouse, already paid for
  const old = halls()[player.id];
  const hallAt = place(center, gateDir, HALL);
  const y = standY(dim, hallAt.x, hallAt.z);
  if (y !== undefined && (!old || old.lost || force) && !buildFor(player.id)) {
    dim.getBlock({ x: hallAt.x, y, z: hallAt.z })?.setType(CORNERSTONE);
    halls()[player.id] = {
      x: hallAt.x, y, z: hallAt.z, fx: hallAt.forward.x, fz: hallAt.forward.z,
      level: 0, paid: Math.max(1, old?.paid ?? 0), best: old?.best ?? 0, style: old?.style ?? style, building: null, marks: {},
    };
    saveHalls();
    beginBuild(player.id, 1, halls()[player.id].style);
  }

  // 3. the mason, from day one
  const benchAt = place(center, gateDir, MASON);
  const by = standY(dim, benchAt.x, benchAt.z);
  if (by !== undefined) {
    const block = dim.getBlock({ x: benchAt.x, y: by, z: benchAt.z });
    if (block && block.typeId !== BENCH && SOFT.test(block.typeId)) {
      block.setType(BENCH);
      registerBench(block, player.id);
    }
  }

  // 4. the buildings every town starts with (the library), then a signpost on every other slot
  for (const slot of SLOTS) {
    const spot = place(center, gateDir, slot);
    const sy = standY(dim, spot.x, spot.z);
    if (sy === undefined) continue;
    if (slot.arrival) {
      if (fresh || force) raiseFree(player, { x: spot.x, y: sy, z: spot.z }, spot.forward, slot.building, style);
      continue;
    }
    const when = slot.tier === 0 ? "Open now" : `Opens: ${TIERS[slot.tier]?.name ?? "later"}`;
    signpost(dim, { x: spot.x, y: sy, z: spot.z }, `${BUILDING[slot.building].name}\n${when}\n(${slot.who})`);
  }
  return fresh ? true : "already";
}

const LAID_OUT = "§6Your settlement is laid out.§7 Roads run to the gate, a Longhouse is rising behind the Plot Stone, the town's library is going up on the square, a mason has set up beside it, and a Plot Marker stands on every plot you can build on. Use one to see what fits there.";
const LAID = `${LAID_OUT} Put a Foundation Stone on a signpost to raise that building.`;
const ARRIVAL_SAY_AT = 110; // ticks after the plot is picked: after the plot's past (3 s), before "raise your Keep Banner" (8 s)

// The plots thread's welcome hall: the moment a plot is picked, lay it out so the first building is
// already going up when the player lands. The plot may not be loaded yet, so keep trying for a while.
on("plotChosen", ({ player, plot }) => {
  if (WALLS.auto === "off" || !plot) return;
  const at = { x: plot.x, y: plot.y, z: plot.z };
  let tries = 0;
  const picked = system.currentTick;
  const attempt = () => {
    let result;
    try {
      if (!player.isValid) result = "gone";
      else if (townFor(plot.name)) result = foundTown(player.id, plot, at, { style: REGION_TO_STYLE[plot.region] });
      else result = layOut(player, { at, style: REGION_TO_STYLE[plot.region] });
    } catch (e) {
      console.warn(`[Hollow Crown] arrival: ${e}`);
      return;
    }
    if (result === true) system.runTimeout(() => { if (player.isValid) player.sendMessage(LAID_OUT); }, Math.max(1, picked + ARRIVAL_SAY_AT - system.currentTick));
    else if (result === "That ground is not loaded yet." && ++tries < 30) system.runTimeout(attempt, 20);
  };
  system.runTimeout(attempt, 5);
});

on("keepFounded", ({ player }) => {
  let on_ = WALLS.auto === "always";
  try {
    on_ ||= WALLS.auto === "map" && mapMode();
  } catch {
    // no plots
  }
  if (!on_) return;
  system.runTimeout(() => {
    try {
      if (layOut(player) === true) player.sendMessage(LAID);
    } catch (e) {
      console.warn(`[Hollow Crown] arrival: ${e}`);
    }
  }, 10);
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:settle_arrive") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isReady()) return;
  const result = layOut(player, { force: true });
  player.sendMessage(result === true || result === "already" ? "§6Settlement laid out round your keep: palisade, Longhouse, mason and slot signposts." : `§c${result}`);
});
