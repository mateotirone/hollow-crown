// Forester's Lodge: the settlement's tree farm (Mateo 2026-11-11: "if we need wood, we should probably
// build a custom tree farm asset for the settlement"). The trees out in the world cannot be chopped; these can.
//
// Place the Lodge on your land and a fenced grove goes up behind it, planted with your region's trees
// (the same hand-built species as the map, in normal breakable wood). Chop a grown tree at the bottom of
// its trunk and it comes down: its logs drop at the stump and a sapling takes its place, which grows into a
// young tree after a day and a full tree two days later. Click the Lodge for its plots, to choose what each
// plot grows, and to buy more plots (2, 4, 6). Numbers: data.js. Tree shapes: map/trees/build_grove.py.
//
// Test: /scriptevent siege:forestry_grove [vale|frostmarch|saltreach|emberwaste|blackfen]
//       raises a level 3 grove where you stand (yours, no land needed) with every stage in it.

import { world, system, ItemStack, BlockVolume } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { onTick, isReady, settlementAt, isAlly, keepOf, moduleStore, countItem, takeItems } from "../siege/api.js";
import { funds, charge } from "../economy/coins.js";
import { styleOf, siteProblem } from "../settle/plans.js";
import { footprint } from "../settle/rules.js";
import {
  LODGE, FORESTRY, YARD, LODGE_LEVELS, MAX_LEVEL, STAGE_NAMES, NEXT_STAGE, plotsAt, speciesFor, speciesName,
  designOf, structureId, newPlot, toWorld, plotCentre, fellYield, ticksToNext, costText, daysText,
} from "./data.js";
import "./tests.js";

const OVERWORLD = "minecraft:overworld";
// lodges: { "x,y,z": { owner, fx, fz, style, level, plots: [{ sid, v, stage, at, base: [x,y,z], next? }] } }
const store = moduleStore("siege:forestry", () => ({ lodges: {} }));
const lodges = () => store.data.lodges;
const keyOf = (l) => `${l.x},${l.y},${l.z}`;
const locOf = (k) => { const [x, y, z] = k.split(",").map(Number); return { x, y, z }; };
const cardinal = (v) => (Math.abs(v.x) > Math.abs(v.z) ? { x: Math.sign(v.x) || 1, z: 0 } : { x: 0, z: Math.sign(v.z) || 1 });
const now = () => world.getAbsoluteTime();
const isCreative = (player) => player.getGameMode() === "Creative" || player.getGameMode() === "creative";
const FENCE = { vale: "spruce_fence", frostmarch: "spruce_fence", saltreach: "birch_fence", emberwaste: "acacia_fence", blackfen: "mangrove_fence" };
const SOFT = /leaves|_log$|_wood$|hollowwood|grass$|fern|flower|snow_layer|vine|bush|sapling|tall_|short_|litter|moss_carpet|_fence$|air$/;
const isWoodType = (t) => /_log$|_wood$|hollowwood/.test(t);

// ---------- placing blocks ----------

function groundAt(dim, x, z, y0) {
  for (let y = y0 + 8; y >= y0 - 8; y--) {
    const b = dim.getBlock({ x, y, z });
    if (b && !b.isLiquid && !SOFT.test(b.typeId)) return y;
  }
  return y0;
}

const set = (dim, loc, type) => { try { dim.getBlock(loc)?.setType(type); } catch { /* unloaded */ } };

function clearTree(dim, plot) {
  const d = designOf(plot.sid, plot.stage, plot.v);
  if (!d || !plot.base) return;
  const [bx, by, bz] = plot.base;
  try {
    dim.fillBlocks(new BlockVolume({ x: bx + d.lo[0], y: by + d.lo[1], z: bz + d.lo[2] }, { x: bx + d.hi[0], y: by + d.hi[1], z: bz + d.hi[2] }),
      "minecraft:air", { blockFilter: { includeTypes: d.types } });
  } catch (e) {
    console.warn(`[Hollow Crown] forestry: could not clear a ${plot.sid}: ${e}`);
  }
}

function plantTree(dim, plot) {
  const d = designOf(plot.sid, plot.stage, plot.v);
  if (!d || !plot.base) return false;
  const [bx, by, bz] = plot.base;
  try {
    world.structureManager.place(structureId(plot.sid, plot.stage, plot.v), dim, { x: bx + d.lo[0], y: by + d.lo[1], z: bz + d.lo[2] });
    return true;
  } catch (e) {
    console.warn(`[Hollow Crown] forestry: could not plant ${structureId(plot.sid, plot.stage, plot.v)}: ${e}`);
    return false;
  }
}

function padAt(dim, c, y, open) {
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    set(dim, { x: c.x + dx, y, z: c.z + dz }, open && Math.abs(dx) + Math.abs(dz) < 4 ? "minecraft:podzol" : "minecraft:coarse_dirt");
  }
}

// Lay out the yard and plant every open plot, a few blocks a tick (never one long tick)
function raiseGrove(key, lodge, firstStage = "mature", withFence = true) {
  const dim = world.getDimension(OVERWORLD);
  const origin = locOf(key);
  const forward = { x: lodge.fx, z: lodge.fz };
  system.runJob((function* () {
    const fence = `minecraft:${FENCE[lodge.style] ?? "spruce_fence"}`;
    const ring = [];
    for (let x = YARD.x0; x <= YARD.x1; x++) {
      if (x < -1 || x > 1) ring.push([x, YARD.z0]);
      ring.push([x, YARD.z1]);
    }
    for (let z = YARD.z0 + 1; z < YARD.z1; z++) ring.push([YARD.x0, z], [YARD.x1, z]);
    for (const [x, z] of withFence ? ring : []) {
      const at = toWorld(origin, forward, x, 0, z);
      set(dim, { x: at.x, y: groundAt(dim, at.x, at.z, origin.y) + 1, z: at.z }, fence);
      yield;
    }
    for (let i = 0; i < 6; i++) {
      if (lodge.plots[i]?.base) continue; // already planted (a level up only plants the new plots)
      const open = i < plotsAt(lodge.level);
      const c = plotCentre(origin, forward, i);
      const y = groundAt(dim, c.x, c.z, origin.y);
      padAt(dim, c, y, open);
      yield;
      if (!open) continue;
      lodge.plots[i] = lodge.plots[i] ?? newPlot(lodge.style, i, firstStage, now());
      lodge.plots[i].base = [c.x, y, c.z];
      plantTree(dim, lodge.plots[i]);
      store.save();
      yield;
    }
  })());
}

// ---------- felling and growing ----------

function plotAtTrunk(loc) {
  for (const [key, lodge] of Object.entries(lodges())) {
    for (let i = 0; i < lodge.plots.length; i++) {
      const b = lodge.plots[i]?.base;
      if (b && b[0] === loc.x && b[1] + 1 === loc.y && b[2] === loc.z) return { key, lodge, i };
    }
  }
  return undefined;
}

function replant(dim, lodge, i) {
  const old = lodge.plots[i];
  const plot = { sid: old.next ?? old.sid, v: (old.v + 1) % 2, stage: "sapling", at: now(), base: old.base };
  lodge.plots[i] = plot;
  plantTree(dim, plot);
  store.save();
}

function fell(dim, lodge, i, player) {
  const plot = lodge.plots[i];
  const d = designOf(plot.sid, plot.stage, plot.v);
  const [bx, by, bz] = plot.base;
  let standing = 1; // the trunk block the player just broke counts (it already dropped its own log)
  for (const [x, y, z] of d.wood) {
    if (x === 0 && y === 1 && z === 0) continue;
    try { if (isWoodType(dim.getBlock({ x: bx + x, y: by + y, z: bz + z })?.typeId ?? "")) standing++; } catch { /* unloaded */ }
  }
  const drops = fellYield(d, standing, plot.stage);
  const first = Object.keys(drops)[0];
  if (first) drops[first] -= 1; // minus the log that already fell
  clearTree(dim, plot);
  const at = { x: bx + 0.5, y: by + 1.2, z: bz + 0.5 };
  let total = 0;
  for (const [item, n] of Object.entries(drops)) {
    for (let left = n; left > 0; left -= 64) {
      try { dim.spawnItem(new ItemStack(item, Math.min(64, left)), at); } catch { /* unknown item */ }
    }
    total += Math.max(0, n);
  }
  player?.sendMessage(`§7The ${speciesName(plot.sid)} comes down: §f${total + 1} logs§7. A sapling takes its place.`);
  replant(dim, lodge, i);
}

world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation, player }) => {
  if (!isReady() || block.dimension.id !== OVERWORLD) return;
  const loc = block.location;
  if (brokenBlockPermutation.type.id === LODGE) {
    if (lodges()[keyOf(loc)]) {
      delete lodges()[keyOf(loc)];
      store.save();
      player.sendMessage("§7The Forester's Lodge is gone. Its grove stands, but felled trees will not grow back until a new Lodge is placed.");
    }
    return;
  }
  if (!isWoodType(brokenBlockPermutation.type.id)) return;
  const hit = plotAtTrunk(loc);
  if (!hit || hit.lodge.plots[hit.i].stage === "sapling") return;
  fell(block.dimension, hit.lodge, hit.i, player);
});

function growTick() {
  if (!isReady()) return;
  const dim = world.getDimension(OVERWORLD);
  const t = now();
  let budget = 2; // trees changed per check, so a returning player never makes one long tick
  for (const lodge of Object.values(lodges())) {
    for (let i = 0; i < lodge.plots.length && budget > 0; i++) {
      const plot = lodge.plots[i];
      if (!plot?.base) continue;
      const [bx, by, bz] = plot.base;
      let trunk;
      try { trunk = dim.getBlock({ x: bx, y: by + 1, z: bz }); } catch { continue; }
      if (!trunk) continue; // not loaded
      if (plot.stage !== "sapling" && !isWoodType(trunk.typeId)) {
        // blown up or cut without a player: no logs, just a new sapling
        clearTree(dim, plot);
        replant(dim, lodge, i);
        budget--;
        continue;
      }
      if (ticksToNext(plot, t) > 0) continue;
      clearTree(dim, plot);
      plot.stage = NEXT_STAGE[plot.stage];
      plot.at = t;
      plantTree(dim, plot);
      store.save();
      budget--;
    }
  }
}
onTick("forestry_grow", FORESTRY.checkEvery, growTick);

// ---------- the Lodge block ----------

const canPay = (player, cost) => isCreative(player) || cost.every((c) => (c.item === "coins" ? funds(player) : countItem(player, c.item)) >= c.count);
function pay(player, cost) {
  if (!canPay(player, cost)) return false;
  if (isCreative(player)) return true;
  for (const c of cost) c.item === "coins" ? charge(player, c.count, "forestry") : takeItems(player, c.item, c.count);
  return true;
}

function plotLine(plot, i, t) {
  const name = speciesName(plot.sid);
  const next = plot.next && plot.next !== plot.sid ? ` §8(next: ${speciesName(plot.next)})` : "";
  if (plot.stage === "mature") return `§f${i + 1}. ${name}§7: full grown, chop the bottom of its trunk${next}`;
  return `§f${i + 1}. ${name}§7: ${STAGE_NAMES[plot.stage]}, grows ${daysText(ticksToNext(plot, t))}${next}`;
}

async function chooseSpecies(player, lodge, i) {
  const list = speciesFor(lodge.style);
  const form = new ActionFormData().title(`Plot ${i + 1}`).body("§7What should this plot grow? A sapling is changed now; a grown tree keeps growing and the new kind is planted when it is felled.");
  for (const sid of list) form.button(speciesName(sid));
  form.button("Back");
  const res = await form.show(player);
  if (res.canceled || res.selection >= list.length) return;
  const plot = lodge.plots[i];
  const sid = list[res.selection];
  if (plot.stage === "sapling") {
    const dim = world.getDimension(OVERWORLD);
    clearTree(dim, plot);
    plot.sid = sid;
    delete plot.next;
    plantTree(dim, plot);
  } else {
    plot.next = sid;
  }
  store.save();
}

async function lodgeMenu(player, key) {
  const lodge = lodges()[key];
  if (!lodge) return;
  const t = now();
  const lv = LODGE_LEVELS[lodge.level];
  const up = LODGE_LEVELS[lodge.level + 1];
  const body = [
    `§7Level ${lv.level} of ${MAX_LEVEL}: ${lv.plots} plots. Trees here: ${speciesFor(lodge.style).map(speciesName).join(", ")}.`,
    "",
    ...lodge.plots.map((p, i) => (p ? plotLine(p, i, t) : `§8${i + 1}. being planted`)),
    "",
    up ? `§7Level ${up.level} opens ${up.plots - lv.plots} more plots for §f${costText(up.cost)}§7.` : "§7Every plot is open.",
  ].join("\n");
  const form = new ActionFormData().title("Forester's Lodge").body(body);
  const actions = [];
  if (up) { form.button(`Open more plots\n§8${costText(up.cost)}`); actions.push("up"); }
  form.button("Choose what grows"); actions.push("choose");
  form.button("Close"); actions.push("close");
  const res = await form.show(player);
  if (res.canceled) return;
  const act = actions[res.selection];
  if (act === "up") {
    if (!pay(player, up.cost)) return player.sendMessage(`§cMore plots cost ${costText(up.cost)}.`);
    lodge.level = up.level;
    store.save();
    raiseGrove(key, lodge, "sapling", false);
    player.sendMessage(`§6The grove grows to ${up.plots} plots. New saplings are going in.`);
  } else if (act === "choose") {
    const pick = new ActionFormData().title("Choose what grows").body("§7Pick a plot.");
    lodge.plots.forEach((p, i) => pick.button(`Plot ${i + 1}: ${p ? speciesName(p.next ?? p.sid) : "-"}`));
    pick.button("Back");
    const r = await pick.show(player);
    if (!r.canceled && r.selection < lodge.plots.length && lodge.plots[r.selection]) await chooseSpecies(player, lodge, r.selection);
  }
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player } = event;
  if (event.isFirstEvent === false || block.typeId !== LODGE || !isReady()) return;
  event.cancel = true;
  const key = keyOf(block.location);
  system.run(() => {
    const lodge = lodges()[key];
    if (!lodge) return player.sendMessage("§7This lodge has no grove. Place it on your own land to raise one.");
    if (lodge.owner !== player.id && !isAlly(lodge.owner, player.id)) return player.sendMessage(`§cThis is ${keepOf(lodge.owner)?.name ?? "someone else"}'s grove.`);
    lodgeMenu(player, key);
  });
});

world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
  if (block.typeId !== LODGE || !isReady() || block.dimension.id !== OVERWORLD) return;
  const owner = settlementAt(block.location);
  if (!owner) return player.sendMessage("§7A Forester's Lodge only raises a grove on settlement land.");
  const f = cardinal(player.getViewDirection());
  let style = "vale";
  try { style = styleOf(owner, block); } catch { /* no hall or plot: Vale */ }
  const box = footprint(block.location, f, YARD);
  const problem = siteProblem(owner, box);
  if (problem) return player.sendMessage(`§7No room for a grove here: ${problem} §8It needs ${YARD.x1 - YARD.x0 + 1} by ${YARD.z1 - YARD.z0 + 1} blocks behind the Lodge.`);
  const key = keyOf(block.location);
  lodges()[key] = { owner, fx: f.x, fz: f.z, style, level: 1, plots: [] };
  store.save();
  raiseGrove(key, lodges()[key]);
  player.sendMessage("§6A grove is going up behind the Lodge. Chop a grown tree at the bottom of its trunk to fell it; a sapling takes its place and is full grown again in three days.");
});

// ---------- test command ----------

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:forestry_grove") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isReady()) return;
  const style = event.message.trim() || "vale";
  if (!FENCE[style]) return player.sendMessage(`§7Styles: ${Object.keys(FENCE).join(", ")}.`);
  const at = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
  const f = cardinal(player.getViewDirection());
  set(player.dimension, at, LODGE);
  const t = now();
  const stages = ["mature", "mature", "mature", "mature", "young", "sapling"];
  const lodge = { owner: player.id, fx: f.x, fz: f.z, style, level: MAX_LEVEL, plots: stages.map((s, i) => newPlot(style, i, s, t)) };
  lodges()[keyOf(at)] = lodge;
  store.save();
  raiseGrove(keyOf(at), lodge);
  player.sendMessage(`§6A ${style} grove is going up in front of you: four grown trees, a young one and a sapling.`);
});
