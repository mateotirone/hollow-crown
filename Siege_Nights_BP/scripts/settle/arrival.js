// Arriving on a plot. When a Keep Banner goes up on a Plot Stone the settlement is laid out at once:
// a palisade round the plot (walls.js), a Longhouse already standing behind the banner, a mason at
// a bench beside it, and a signpost on every slot where a building will stand later.
//
// It runs when walls are automatic (a map with Plot Stones). Test anywhere:
//   /scriptevent siege:settle_arrive      lay your settlement out round your keep now

import { world, system, BlockPermutation } from "@minecraft/server";
import { signToward } from "../core/signs.js";
import { isReady, keepOf, on, onTick, TIERS, addTests, assertEqual } from "../siege/api.js";
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
import { townOf, foundTown, lordTownAt, adoptTown } from "./founding.js";

const OVERWORLD = "minecraft:overworld";
const SOFT = /(air|water|grass(?!_block|_path)|fern|flower|snow_layer|leaves|vine|bush|sapling|tallgrass|dandelion|poppy|mushroom|_log$|deadbush)/;

function standY(dim, x, z) {
  try {
    let block = dim.getTopmostBlock({ x, z });
    for (let i = 0; block && i < 40 && SOFT.test(block.typeId); i++) block = block.below();
    return block ? block.location.y + 1 : undefined;
  } catch {
    return undefined;
  }
}

// A signpost turned to face rot (ground_sign_direction). One laid out before is turned round if it faces
// another way (they all faced south before, so most stood edge-on or backwards to the keep).
function signpost(dim, at, text, rot = 0) {
  try {
    const below = dim.getBlock({ x: at.x, y: at.y - 1, z: at.z });
    if (below?.typeId === "minecraft:standing_sign") {
      if (below.permutation.getState("ground_sign_direction") !== rot) below.setPermutation(BlockPermutation.resolve("minecraft:standing_sign", { ground_sign_direction: rot }));
      return below.getComponent("minecraft:sign")?.setText(text); // laid out before
    }
    const block = dim.getBlock(at);
    if (!block || !SOFT.test(block.typeId)) return; // something already stands here
    block.setPermutation(BlockPermutation.resolve("minecraft:standing_sign", { ground_sign_direction: rot }));
    block.getComponent("minecraft:sign")?.setText(text);
  } catch {
    // signs are a nicety
  }
}

// Worlds laid out before the fix in #116 have signposts stacked two or more high. Cut a stack down to its
// bottom sign. `topY` is standY() at the spot (one above the top sign). Returns how many signs came down.
const SIGN = /_sign$/;
function unstack(dim, x, topY, z) {
  let bottom = topY - 1;
  while (bottom - 1 > topY - 60 && SIGN.test(dim.getBlock({ x, y: bottom - 1, z })?.typeId ?? "")) bottom--;
  if (!SIGN.test(dim.getBlock({ x, y: bottom, z })?.typeId ?? "")) return 0;
  let removed = 0;
  for (let y = topY - 1; y > bottom; y--) {
    dim.getBlock({ x, y, z })?.setType("minecraft:air");
    removed++;
  }
  return removed;
}

export function tidySignposts(player, dim = world.getDimension(OVERWORLD)) {
  const wall = wallOf(player.id);
  if (!wall) return 0;
  const center = { x: wall.x, y: wall.y, z: wall.z };
  if (!dim.getBlock(center)) return -1; // not loaded yet
  let removed = 0;
  for (const slot of SLOTS) {
    if (slot.arrival) continue;
    const spot = place(center, wall.gateDir ?? "south", slot);
    const sy = standY(dim, spot.x, spot.z);
    if (sy === undefined) continue;
    try { removed += unstack(dim, spot.x, sy, spot.z); } catch {}
  }
  return removed;
}

// Once a session, when an owner is close enough for their settlement to be loaded
const tidied = new Set();
onTick("settle_tidy_signs", 200, () => {
  if (!isReady()) return;
  for (const player of world.getAllPlayers()) {
    if (tidied.has(player.id)) continue;
    const wall = wallOf(player.id);
    if (!wall) { tidied.add(player.id); continue; }
    const l = player.location;
    if (player.dimension.id !== OVERWORLD || Math.abs(l.x - wall.x) > 48 || Math.abs(l.z - wall.z) > 48) continue;
    const removed = tidySignposts(player);
    if (removed < 0) continue;
    tidied.add(player.id);
    if (removed > 0) console.warn(`[Hollow Crown] took down ${removed} stacked signpost(s) at ${player.name}'s settlement`);
  }
});

// at: lay out round this spot (a Plot Stone) for a player who has no Keep Banner up yet.
// A town with a layout (the twelve map plots, founding.js) is laid out from it instead.
export function layOut(player, { force = false, at, style: wanted } = {}) {
  if (townOf(player.id)) return "already";
  const keep = keepOf(player.id) ?? at;
  if (!keep) return "Raise a Keep Banner first.";
  const lordTown = lordTownAt(keep.x, keep.z); // a Rival Lord's town stands here: it is yours as it is
  if (lordTown) { adoptTown(lordTown, player.id); return "already"; }
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

  // Laying out again (the welcome hall and the Keep Banner both ask) only checks the wall and the Longhouse:
  // the bench and the signposts are already there, and placing them again stacked a second bench and mason
  // on the first and a second row of signs on top of the first.
  if (!fresh && !force) return "already";

  // 3. the mason, from day one
  const benchAt = place(center, gateDir, MASON);
  const by = standY(dim, benchAt.x, benchAt.z);
  if (by !== undefined && dim.getBlock({ x: benchAt.x, y: by - 1, z: benchAt.z })?.typeId !== BENCH) {
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
    signpost(dim, { x: spot.x, y: sy, z: spot.z }, `${BUILDING[slot.building].name}\n${when}\n(${slot.who})`, signToward(spot, center)); // facing the keep
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

// A fake column of blocks for the sign test: stone at y 63, then whatever is listed above it
function fakeColumn(above) {
  const col = new Map([[63, "minecraft:stone"]]);
  above.forEach((id, i) => col.set(64 + i, id));
  const block = (y) => ({
    get typeId() { return col.get(y) ?? "minecraft:air"; },
    location: { x: 0, y, z: 0 },
    below: () => block(y - 1),
    setType: (id) => (id === "minecraft:air" ? col.delete(y) : col.set(y, id)),
  });
  return { col, dim: { getTopmostBlock: () => block(Math.max(...col.keys())), getBlock: ({ y }) => block(y) } };
}

addTests("settle arrival", {
  "an old stack of signposts comes down to one, and a single sign is left alone": () => {
    const s = "minecraft:standing_sign";
    const { col, dim } = fakeColumn([s, s, s]);
    assertEqual(unstack(dim, 0, standY(dim, 0, 0), 0), 2);
    assertEqual([...col.entries()].filter(([, id]) => id === s).map(([y]) => y).join(), "64");
    assertEqual(unstack(dim, 0, standY(dim, 0, 0), 0), 0);
    assertEqual(unstack(fakeColumn([]).dim, 0, 64, 0), 0);
  },
});
