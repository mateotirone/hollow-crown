// The Ironworks: a machine of the town's Works plots (Mateo 2026-11-12: the town generator makes the plots, you
// pick one and it builds itself; you choose which plot, never the exact spot). Use a Works plot's marker and pick
// the Ironworks: the whole plot is fenced and the Ore Pit dug. The Ironworks block stands in the yard: click it for
// the storeroom, the charcoal bunker and the next stage (Bloomery, then Trip-Hammer Forge), which rise on the
// same plot. One Ironworks a town. Numbers: data.js. Buildings: design.js.
//
// A town laid out before Works plots existed has none, so there the Ironworks block can still be crafted and
// placed by hand as before (the old yard rises behind it), and yards already placed that way keep working.
//
// Test: /scriptevent siege:ironworks_build [1-3] [style]   raise the plot design where you stand (creative), no menu
//       /scriptevent siege:ironworks_day                    one in-game day of work for every Ironworks

import { world, system, ItemStack, GameMode } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { onTick, isReady, settlementAt, isAlly, keepOf, tierOf, moduleStore, on, countItem, takeItems } from "../siege/api.js";
import { funds, charge } from "../economy/coins.js";
import { coins } from "../economy/rules.js";
import { regionRate } from "../economy/config.js";
import { startBuild, buildFor } from "../townhall/build.js";
import { STYLES, STYLE_IDS } from "../townhall/styles.js";
import { styleFor, addWorks } from "../settle/buildings.js";
import { townOf, layoutOf, saveTowns, allMarkers } from "../settle/founding.js";
import { slotsOf } from "../settle/towns.js";
import { siteProblem, styleOf } from "../settle/plans.js";
import { footprint } from "../settle/rules.js";
import { plotAt } from "../plots/claims.js";
import { addMenuLabel } from "../core/labels.js";
import { sfx } from "../core/sfx.js";
import { addFilter, emit } from "../core/events.js";
import { IRONWORKS_BLOCK, LEVELS, MAX_LEVEL, FUEL, IRONWORKS, tierAtLeast, capOf, produce, lootShare } from "./data.js";
import { drawIronworks, drawWorks, worksShape } from "./design.js";
import "./tests.js";

const OVERWORLD = "minecraft:overworld";
// works: { ownerId: { x, y, z, fx, fz, style, level, built, pending, raw, ingots, fuel, at } }   x y z: its block
//   on a Works plot also { slot, ox, oy, oz }: the town slot it stands on and the corner the designs are laid from
// left: { ownerId: { raw, ingots, fuel } } what was in the storeroom of one knocked down, for the next one
const store = moduleStore("siege:ironworks", () => ({ works: {}, left: {} }));
const works = () => store.data.works;
const left = () => (store.data.left ??= {});
const jobId = (owner) => `ironworks:${owner}`;
const now = () => world.getAbsoluteTime();
const say = (player, text) => { try { player?.sendMessage(text); } catch { /* left */ } };
const cardinal = (v) => (Math.abs(v.x) > Math.abs(v.z) ? { x: Math.sign(v.x) || 1, z: 0 } : { x: 0, z: Math.sign(v.z) || 1 });
const nice = (id) => (id === "minecraft:raw_iron" ? "raw iron" : "iron ingots");

addMenuLabel({ block: IRONWORKS_BLOCK, name: "Ironworks", hint: "Click: storeroom and upgrades" });

const plans = new Map();
const oldPlan = (level, style) => {
  const key = `${level}|${style}`;
  if (!plans.has(key)) plans.set(key, drawIronworks(level, style));
  return plans.get(key);
};
// On a Works plot each stage's plan holds only what that stage adds; a hand-placed yard is drawn whole each time
const planOf = (w, level) => (w.slot ? drawWorks(level, w.style) : oldPlan(level, w.style));
const originOf = (w) => (w.slot ? { x: w.ox, y: w.oy, z: w.oz } : { x: w.x, y: w.y, z: w.z });
const slotOf = (owner, w) => (w?.slot ? townOf(owner)?.slots?.[w.slot] : undefined);
const worksPlots = (owner) => slotsOf(layoutOf(townOf(owner))).filter((s) => s.size === "W");
// Does this town's Ironworks stand (or is one going up on a plot)?
function standing(owner) {
  if (Object.values(townOf(owner)?.slots ?? {}).some((s) => s.building === "ironworks")) return true;
  const w = works()[owner];
  if (!w || w.slot) return false;
  try { return world.getDimension(OVERWORLD).getBlock(w)?.typeId === IRONWORKS_BLOCK; } catch { return true; }
}

// For the story (newplayer/act2.js): does this town's Ironworks stand (or is it going up), how far it is built, and
// where to point: its block once built, else a Works plot's marker
export function ironworksFacts(owner) {
  const w = works()[owner];
  let at = w?.built ? { x: w.x, y: w.y, z: w.z } : undefined;
  if (!at) {
    try {
      const ids = new Set(worksPlots(owner).map((s) => s.id));
      const m = allMarkers().find((k) => k.owner === owner && ids.has(k.slot));
      if (m) at = { x: m.x, y: m.y, z: m.z };
    } catch { /* no town yet */ }
  }
  let up = false;
  try { up = standing(owner); } catch { /* not ready */ }
  return { standing: up, built: w?.built ?? 0, at };
}

addWorks({
  id: "ironworks", name: "Ironworks", coins: IRONWORKS.plotCost, dig: worksShape(1, "vale").dig,
  blurb: `An Ore Pit to start with: about ${LEVELS[1].perDay} raw iron a day into its storeroom. It grows into a Bloomery and a Trip-Hammer Forge on this same plot.`,
  plan: (style) => drawWorks(1, style),
  taken: (owner) => (standing(owner) ? "is already built in this town (one Ironworks a town)" : undefined),
});

// The Ore Pit on a Works plot is finished (settle raised it): its workers start
on("settleBuilt", ({ owner, building, style, origin, forward, marks, slotId }) => {
  if (building !== "ironworks" || !slotId) return;
  const at = marks?.works ?? origin;
  const kept = left()[owner] ?? works()[owner] ?? {};
  works()[owner] = { slot: slotId, x: at.x, y: at.y, z: at.z, ox: origin.x, oy: origin.y, oz: origin.z, fx: forward.x, fz: forward.z,
    style, level: 1, built: 1, raw: kept.raw ?? 0, ingots: kept.ingots ?? 0, fuel: kept.fuel ?? 0, at: now() };
  delete left()[owner];
  store.save();
});

// Knocked down at its plot marker (or the town hall took the plot): what the storeroom held waits for the next one
on("settleCleared", ({ owner, building }) => {
  const w = works()[owner];
  if (building !== "ironworks" || !w?.slot) return;
  catchUp(w);
  left()[owner] = { raw: w.raw ?? 0, ingots: w.ingots ?? 0, fuel: w.fuel ?? 0 };
  delete works()[owner];
  store.save();
});

const bonusOf = (w) => regionRate(plotAt(w)?.region, IRONWORKS.metal);

// Bring the storeroom up to now
function catchUp(w) {
  const t = now();
  if (w.at === undefined) { w.at = t; return; }
  const level = w.built || 0;
  if (level < 1) { w.at = t; return; }
  const made = produce(level, t - w.at, w.fuel ?? 0, { raw: w.raw ?? 0, ingots: w.ingots ?? 0 }, bonusOf(w));
  w.raw = (w.raw ?? 0) + made.raw;
  w.ingots = (w.ingots ?? 0) + made.ingots;
  w.fuel = Math.max(0, (w.fuel ?? 0) - made.fuel);
  w.at = t;
}

// ---------- raising ----------

function start(owner, w, level) {
  if (buildFor(jobId(owner))) return;
  const plan = planOf(w, level);
  w.pending = level;
  store.save();
  startBuild({
    id: jobId(owner), dimensionId: OVERWORLD, origin: originOf(w), forward: { x: w.fx, z: w.fz },
    plan, style: styleFor(w.style), perTick: Math.max(4, Math.ceil(plan.cells.size / 300)),
    onDone() {
      catchUp(w);
      w.built = level;
      w.pending = undefined;
      store.save();
      const state = slotOf(owner, w);
      if (state) { // the plot's building is taller now: knocking it down must clear all of it
        state.top = Math.max(state.top ?? 0, worksShape(level, w.style).top + (state.lift ?? 0));
        saveTowns();
      }
      const player = world.getPlayers().find((p) => p.id === owner);
      if (player) { say(player, `§6Your ${LEVELS[level].name} is finished. Its workers have started.`); sfx(player, "random.levelup", { volume: 0.5 }); }
    },
  });
}

// A hand-placed yard must find room; on a Works plot the ground was kept for it from the start
function problemFor(owner, w, level) {
  if (w.slot) return undefined;
  const box = footprint(w, { x: w.fx, z: w.fz }, oldPlan(level, w.style).bounds());
  return siteProblem(owner, box);
}

// Water near enough to turn a wheel
function hasWater(w) {
  const dim = world.getDimension(OVERWORLD), r = IRONWORKS.waterReach;
  for (let dx = -r; dx <= r; dx += 2) for (let dz = -r; dz <= r; dz += 2) for (let dy = -3; dy <= 1; dy++) {
    try {
      const b = dim.getBlock({ x: w.x + dx, y: w.y + dy, z: w.z + dz });
      if (b && /water/.test(b.typeId) && !/cauldron/.test(b.typeId)) return true;
    } catch { /* unloaded */ }
  }
  return false;
}

world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
  if (!isReady() || block.typeId !== IRONWORKS_BLOCK || block.dimension.id !== OVERWORLD) return;
  const owner = settlementAt(block.location);
  if (!owner) return say(player, "§7An Ironworks needs to stand on your own settlement's land. It does nothing here.");
  if (worksPlots(owner).length) { // this town was laid out with ground for it: the plot decides where it stands
    block.setType("minecraft:air");
    if (player.getGameMode() !== GameMode.Creative) hand(player, IRONWORKS_BLOCK, 1);
    return say(player, "§7This town has a §fWorks plot§7 kept for the Ironworks. Use that plot's marker and pick the Ironworks: it builds itself there.");
  }
  const old = works()[owner];
  if (old && standing(owner)) return say(player, "§7This settlement already has an Ironworks. This block opens the same storeroom.");
  const f = cardinal(player.getViewDirection());
  const { x, y, z } = block.location;
  const w = { x, y, z, fx: f.x, fz: f.z, style: styleOf(owner, block), level: 1, built: 0, raw: old?.raw ?? 0, ingots: old?.ingots ?? 0, fuel: old?.fuel ?? 0 };
  works()[owner] = w;
  store.save();
  const problem = problemFor(owner, w, 1);
  if (problem) return say(player, `§7No room for the Ore Pit here: ${problem}`);
  start(owner, w, 1);
  say(player, "§6An Ore Pit is being dug behind your Ironworks.");
});

// ---------- the menu ----------

async function menu(player, owner, w) {
  catchUp(w);
  store.save();
  const level = w.built || 0, L = LEVELS[Math.max(1, level)], next = LEVELS[level + 1];
  const bonus = bonusOf(w);
  const lines = [
    level ? `§f${L.name}§r: about ${Math.round(L.perDay * bonus)} ${nice(L.makes)} a day${bonus > 1 ? " (this region's iron is rich)" : bonus < 1 ? " (this region's iron is poor)" : ""}.` : "§7Still being built.",
    `Storeroom: §f${w.raw ?? 0}§r raw iron, §f${w.ingots ?? 0}§r iron ingots. §8(It fills up at ${capOf(Math.max(1, level), bonus)}; then the workers wait.)`,
  ];
  if (L.fuelEvery) lines.push(`Charcoal: §f${w.fuel ?? 0}§r (one per ${L.fuelEvery} ingots). Without it, they only dig raw ore.`);
  if (next) lines.push(`§7Next: §f${next.name}§7, needs a ${next.tier}${next.water ? (w.slot ? " and water by the plot" : " and water within " + IRONWORKS.waterReach + " blocks") : ""}, ${coins(next.cost)}.${w.slot ? " It rises on this same plot." : ""}`);
  const form = new ActionFormData().title("Ironworks").body(lines.join("\n\n"));
  const acts = [];
  form.button("Take everything"); acts.push(() => take(player, w));
  if (L.fuelEvery || (next && next.fuelEvery)) { form.button(`Add charcoal\n§8you carry ${countItem(player, FUEL)}`); acts.push(() => addFuel(player, w)); }
  if (next && !w.pending) { form.button(`Build the ${next.name}\n§8${coins(next.cost)}`); acts.push(() => upgrade(player, owner, w)); }
  form.button("Close");
  const res = await form.show(player);
  if (!res.canceled) await acts[res.selection]?.();
}

function hand(player, id, count) {
  const inv = player.getComponent("minecraft:inventory").container;
  while (count > 0) {
    const n = Math.min(64, count);
    count -= n;
    const left = inv.addItem(new ItemStack(id, n));
    if (left) player.dimension.spawnItem(left, player.location);
  }
}

function take(player, w) {
  const raw = w.raw ?? 0, ingots = w.ingots ?? 0;
  if (!raw && !ingots) return player.onScreenDisplay.setActionBar("§7The storeroom is empty.");
  w.raw = 0; w.ingots = 0;
  store.save();
  if (raw) hand(player, "minecraft:raw_iron", raw);
  if (ingots) hand(player, "minecraft:iron_ingot", ingots);
  sfx(player, "random.orb");
  emit("ironworksTaken", { player, raw, ingots });
  player.onScreenDisplay.setActionBar(`§7Taken: ${raw ? `${raw} raw iron ` : ""}${ingots ? `${ingots} iron ingots` : ""}`);
}

function addFuel(player, w) {
  const room = IRONWORKS.fuelCap - (w.fuel ?? 0);
  const n = Math.min(room, countItem(player, FUEL));
  if (n <= 0) return player.onScreenDisplay.setActionBar(room <= 0 ? "§7The bunker is full." : "§7You have no charcoal. Burn logs in a furnace to make it.");
  if (player.getGameMode() === "Creative" || player.getGameMode() === "creative") player.runCommand(`clear @s ${FUEL} -1 ${n}`);
  else if (!takeItems(player, FUEL, n)) return;
  w.fuel = (w.fuel ?? 0) + n;
  store.save();
  player.onScreenDisplay.setActionBar(`§7${n} charcoal into the bunker (${w.fuel} in all).`);
}

function upgrade(player, owner, w) {
  const level = (w.built || 0) + 1, next = LEVELS[level];
  if (!next) return;
  const tier = tierOf(keepOf(owner) ?? {})?.name ?? "Hamlet";
  if (!tierAtLeast(tier, next.tier)) return say(player, `§7The ${next.name} needs your settlement to be a ${next.tier} (it is a ${tier}).`);
  const byWater = w.slot && worksPlots(owner).find((s) => s.id === w.slot)?.tags?.includes("water");
  if (next.water && !byWater && !hasWater(w)) return say(player, `§7The ${next.name}'s wheel needs a river, stream or pond within ${IRONWORKS.waterReach} blocks of the Ironworks block.`);
  const problem = problemFor(owner, w, level);
  if (problem) return say(player, `§7No room for the ${next.name}: ${problem}`);
  if (funds(player) < next.cost) return say(player, `§7The ${next.name} costs ${coins(next.cost)}. You have ${coins(funds(player))}.`);
  if (!charge(player, next.cost, "ironworks")) return;
  catchUp(w);
  w.level = level;
  const state = slotOf(owner, w);
  if (state) { state.paid = (state.paid ?? 0) + next.cost; saveTowns(); } // half comes back if it is knocked down
  start(owner, w, level);
  say(player, `§6The ${next.name} is going up at your Ironworks.`);
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player } = event;
  if (event.isFirstEvent === false || !isReady() || block.typeId !== IRONWORKS_BLOCK) return;
  event.cancel = true;
  system.run(() => {
    const owner = settlementAt(block.location);
    const w = owner && works()[owner];
    if (!w) return say(player, "§7This Ironworks isn't on settlement land, so nobody works it.");
    if (player.id !== owner && !isAlly(owner, player.id)) return player.onScreenDisplay.setActionBar("§7Not your Ironworks.");
    menu(player, owner, w).catch((e) => console.warn(`[Hollow Crown] ironworks: ${e}`));
  });
});

// Guard posts round the Ironworks (guardposts/, Station a guard): door, corners and sides like any building
addFilter("guardPostSites", (sites, { owner }) => {
  const w = works()[owner];
  if (!w?.built) return sites;
  const box = slotOf(owner, w)?.box ?? footprint(w, { x: w.fx, z: w.fz }, oldPlan(w.built, w.style).bounds());
  return [...sites, { id: "ironworks", name: LEVELS[w.built].name, box, front: { x: -w.fx || 0, z: -w.fz || 0 }, floor: w.slot ? w.oy : w.y }];
});

// ---------- raids ----------

// A siege that goes badly costs part of the storeroom
on("siegeEnd", ({ outcome, besieged }) => {
  const share = lootShare(outcome);
  if (!share) return;
  for (const owner of besieged ?? []) {
    const w = works()[owner];
    if (!w) continue;
    catchUp(w);
    const raw = Math.floor((w.raw ?? 0) * share), ingots = Math.floor((w.ingots ?? 0) * share);
    if (!raw && !ingots) continue;
    w.raw -= raw; w.ingots -= ingots;
    say(world.getPlayers().find((p) => p.id === owner), `§cRaiders broke into your Ironworks storeroom and carried off ${raw} raw iron and ${ingots} ingots.`);
  }
  store.save();
});

// A build cut short by the world closing carries on when it loads again
onTick("ironworks", 200, () => {
  if (!isReady()) return;
  for (const [owner, w] of Object.entries(works())) {
    if (w.pending && !buildFor(jobId(owner))) { start(owner, w, w.pending); continue; }
    if (!w.slot || w.pending || slotOf(owner, w)?.building !== "ironworks") continue;
    // the block in the yard is the way into the storeroom: one that was dug out is put back
    try {
      const b = world.getDimension(OVERWORLD).getBlock(w);
      if (b && b.typeId !== IRONWORKS_BLOCK) b.setType(IRONWORKS_BLOCK);
    } catch { /* not loaded */ }
  }
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  const player = event.sourceEntity;
  if (event.id === "siege:ironworks_day") {
    for (const w of Object.values(works())) if (w.at !== undefined) w.at -= 24000;
    store.save();
    return say(player, "§aEvery Ironworks has done a day's work. Click one to see it.");
  }
  if (event.id !== "siege:ironworks_build" || player?.typeId !== "minecraft:player" || !isReady()) return;
  const [lv = "3", style = "vale"] = event.message.trim().split(/\s+/);
  const level = Math.max(1, Math.min(MAX_LEVEL, Number(lv) || 3));
  if (!STYLES[style]) return say(player, `§7Styles: ${STYLE_IDS.join(", ")}.`);
  const at = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
  const forward = cardinal(player.getViewDirection()), dimensionId = player.dimension.id;
  // stage by stage, as a town's plot would grow
  const stage = (lv) => startBuild({ id: `ironworks:test:${at.x},${at.z}:${lv}`, dimensionId, origin: at, forward,
    plan: drawWorks(lv, style), style: styleFor(style), perTick: 40, onDone: () => { if (lv < level) stage(lv + 1); } });
  stage(1);
  say(player, `§6${LEVELS[level].name} (${STYLES[style].name}) rising in front of you, on a ${27} x ${17} plot.`);
});
