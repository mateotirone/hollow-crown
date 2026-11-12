// The Ironworks: place the block on your land and an Ore Pit yard rises behind it; upgrade it at the block to a
// Bloomery and then a Trip-Hammer Forge. Click the block for the storeroom, the charcoal bunker and upgrades.
// Numbers: data.js. Buildings: design.js.
//
// Test: /scriptevent siege:ironworks_build [1-3] [style]   raise one where you stand (creative), no menu
//       /scriptevent siege:ironworks_day                    one in-game day of work for every Ironworks

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { onTick, isReady, settlementAt, isAlly, keepOf, tierOf, moduleStore, on, countItem, takeItems } from "../siege/api.js";
import { funds, charge } from "../economy/coins.js";
import { coins } from "../economy/rules.js";
import { startBuild, buildFor } from "../townhall/build.js";
import { STYLES, STYLE_IDS } from "../townhall/styles.js";
import { styleFor } from "../settle/buildings.js";
import { siteProblem, styleOf } from "../settle/plans.js";
import { footprint } from "../settle/rules.js";
import { plotAt } from "../plots/claims.js";
import { addMenuLabel } from "../core/labels.js";
import { sfx } from "../core/sfx.js";
import { IRONWORKS_BLOCK, LEVELS, MAX_LEVEL, FUEL, IRONWORKS, tierAtLeast, capOf, produce, lootShare } from "./data.js";
import { drawIronworks } from "./design.js";
import "./tests.js";

const OVERWORLD = "minecraft:overworld";
// works: { ownerId: { x, y, z, fx, fz, style, level, built, pending, raw, ingots, fuel, at } }
const store = moduleStore("siege:ironworks", () => ({ works: {} }));
const works = () => store.data.works;
const jobId = (owner) => `ironworks:${owner}`;
const now = () => world.getAbsoluteTime();
const say = (player, text) => { try { player?.sendMessage(text); } catch { /* left */ } };
const cardinal = (v) => (Math.abs(v.x) > Math.abs(v.z) ? { x: Math.sign(v.x) || 1, z: 0 } : { x: 0, z: Math.sign(v.z) || 1 });
const nice = (id) => (id === "minecraft:raw_iron" ? "raw iron" : "iron ingots");

addMenuLabel({ block: IRONWORKS_BLOCK, name: "Ironworks", hint: "Click: storeroom and upgrades" });

const plans = new Map();
const planFor = (level, style) => {
  const key = `${level}|${style}`;
  if (!plans.has(key)) plans.set(key, drawIronworks(level, style));
  return plans.get(key);
};

const bonusOf = (w) => (IRONWORKS.workingTowns.includes(plotAt(w)?.name) ? IRONWORKS.workingBonus : 1);

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
  const plan = planFor(level, w.style);
  w.pending = level;
  store.save();
  startBuild({
    id: jobId(owner), dimensionId: OVERWORLD, origin: { x: w.x, y: w.y, z: w.z }, forward: { x: w.fx, z: w.fz },
    plan, style: styleFor(w.style), perTick: Math.max(4, Math.ceil(plan.cells.size / 300)),
    onDone() {
      catchUp(w);
      w.built = level;
      w.pending = undefined;
      store.save();
      const player = world.getPlayers().find((p) => p.id === owner);
      if (player) { say(player, `§6Your ${LEVELS[level].name} is finished. Its workers have started.`); sfx(player, "random.levelup", { volume: 0.5 }); }
    },
  });
}

function problemFor(owner, w, level) {
  const box = footprint(w, { x: w.fx, z: w.fz }, planFor(level, w.style).bounds());
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
  const old = works()[owner];
  if (old) {
    let standing = false;
    try { standing = world.getDimension(OVERWORLD).getBlock(old)?.typeId === IRONWORKS_BLOCK; } catch { standing = true; }
    if (standing) return say(player, "§7This settlement already has an Ironworks. This block opens the same storeroom.");
  }
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
    level ? `§f${L.name}§r: about ${Math.round(L.perDay * bonus)} ${nice(L.makes)} a day${bonus > 1 ? " (the Old Working next door helps)" : ""}.` : "§7Still being built.",
    `Storeroom: §f${w.raw ?? 0}§r raw iron, §f${w.ingots ?? 0}§r iron ingots. §8(It fills up at ${capOf(Math.max(1, level), bonus)}; then the workers wait.)`,
  ];
  if (L.fuelEvery) lines.push(`Charcoal: §f${w.fuel ?? 0}§r (one per ${L.fuelEvery} ingots). Without it, they only dig raw ore.`);
  if (next) lines.push(`§7Next: §f${next.name}§7, needs a ${next.tier}${next.water ? " and water within " + IRONWORKS.waterReach + " blocks" : ""}, ${coins(next.cost)}.`);
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
  if (next.water && !hasWater(w)) return say(player, `§7The ${next.name}'s wheel needs a river, stream or pond within ${IRONWORKS.waterReach} blocks of the Ironworks block.`);
  const problem = problemFor(owner, w, level);
  if (problem) return say(player, `§7No room for the ${next.name}: ${problem}`);
  if (funds(player) < next.cost) return say(player, `§7The ${next.name} costs ${coins(next.cost)}. You have ${coins(funds(player))}.`);
  if (!charge(player, next.cost, "ironworks")) return;
  catchUp(w);
  w.level = level;
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
  for (const [owner, w] of Object.entries(works())) if (w.pending && !buildFor(jobId(owner))) start(owner, w, w.pending);
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
  startBuild({ id: `ironworks:test:${at.x},${at.z}`, dimensionId: player.dimension.id, origin: at, forward: cardinal(player.getViewDirection()),
    plan: planFor(level, style), style: styleFor(style), perTick: 40 });
  say(player, `§6${LEVELS[level].name} (${STYLES[style].name}) rising in front of you.`);
});
