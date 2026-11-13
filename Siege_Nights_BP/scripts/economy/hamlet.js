// A Farmer in every player's Hamlet (Mateo 2026-11-13 playtest: "Where is the farmer in the starter town?").
// Selling wheat to the Farmer is the first way to earn Regals, but traders only stood in the six NPC towns, far
// from a new plot. Now each player settlement gets its own Farmer, at the door of the starter village's second
// house (the one that isn't the founder's), or beside the Mason's Bench when there is no such house.
//
// Placed once per settlement, the first time its owner (or anyone) comes within REACH, so towns founded before this
// change get one too. Never placed again after that: a builder can move or /kill it and it stays that way.
// A Rival Lord's town gets none. The quest tracker's "Sell wheat to the Farmer" step points at it (quests/rules.js).
//   /scriptevent siege:hamlet_farmer [reset]   says where your Farmer is; reset places it again (old one removed)

import { world, system } from "@minecraft/server";
import { onTick } from "../core/loop.js";
import { on } from "../core/events.js";
import { moduleStore } from "../core/store.js";
import { addTests, assert, assertEqual } from "../core/tests.js";
import { allTowns, townOf, layoutOf } from "../settle/founding.js";
import { slotsOf } from "../settle/towns.js";
import { spawnJobNpc } from "./shops.js";

export const FARMER_TAG = "siege_hamlet_farmer";
const REACH = 48; // blocks from the town centre: close enough that the chunks are loaded
const SOFT = /(air|water|grass$|short_grass|tall_grass|fern|flower|snow_layer|leaves|vine|bush|sapling|tallgrass|dandelion|poppy|mushroom|deadbush|torch|lantern|fence|sign)/;
const store = moduleStore("siege:economy_hamlet", () => ({ farmers: {} })); // owner id -> { x, y, z, day }

// Where a Hamlet's Farmer stands, relative to the town centre: two steps out from the door of the starter village's
// non-founder house (slots tagged "starter" with a house standing from the start), else beside the Mason's Bench,
// else a few blocks off the square.
export function farmerSpot(slots, benchSpot, centre = { x: 0, z: 0 }) {
  const house = slots.find((s) => s.tier === 0 && s.start && s.tags?.includes("starter") && !s.tags.includes("founder"));
  if (house) {
    const dir = { n: { x: 0, z: -1 }, s: { x: 0, z: 1 }, e: { x: 1, z: 0 }, w: { x: -1, z: 0 } }[house.side] ?? { x: 0, z: 0 };
    return { x: house.step.x + dir.x * 2, z: house.step.z + dir.z * 2 };
  }
  if (benchSpot) return { x: benchSpot.x - centre.x + 2, z: benchSpot.z - centre.z };
  return { x: 4, z: -6 };
}

const groundY = (dim, x, z) => {
  let block = dim.getTopmostBlock({ x, z });
  for (let i = 0; block && i < 40 && SOFT.test(block.typeId); i++) block = block.below();
  return block ? block.location.y + 1 : undefined;
};

export const farmerOf = (owner) => store.data.farmers[owner];

// Wheat sold to any Farmer, for the quest tracker's first-Regals step (player property, a running count)
export const WHEAT_SOLD = "hc:wheat_sold";
on("goodsSold", ({ player, job, id, count }) => {
  if (job !== "farmer" || id !== "minecraft:wheat") return;
  try { player.setDynamicProperty(WHEAT_SOLD, Math.min(9999, (player.getDynamicProperty(WHEAT_SOLD) ?? 0) + count)); } catch { /* left */ }
});

// What the quest tracker needs: undefined without a settlement
export function farmerFacts(player) {
  if (!townOf(player.id)) return undefined;
  const at = farmerOf(player.id);
  return { at: at ? { x: at.x, z: at.z } : undefined, sold: player.getDynamicProperty(WHEAT_SOLD) ?? 0, tag: `${FARMER_TAG}_${player.id}` };
}

function placeFarmer(dim, owner, town) {
  const rel = farmerSpot(slotsOf(layoutOf(town)), town.benchSpot, town);
  const x = Math.floor(town.x + rel.x), z = Math.floor(town.z + rel.z);
  let y;
  try { y = groundY(dim, x, z); } catch { return false; } // not loaded yet: try again later
  if (y === undefined) return false;
  const npc = spawnJobNpc(dim, { x: x + 0.5, y, z: z + 0.5 }, "farmer");
  if (!npc) return false;
  npc.addTag(FARMER_TAG);
  npc.addTag(`${FARMER_TAG}_${owner}`);
  store.data.farmers[owner] = { x, y, z, day: world.getDay() };
  store.save();
  console.warn(`[Hollow Crown] economy: a Farmer for ${owner}'s Hamlet at ${x} ${y} ${z}`);
  return true;
}

onTick("economy_hamlet", 40, () => {
  const towns = allTowns();
  const left = Object.entries(towns).filter(([owner, t]) => !t.lord && t.laid?.[0] && !store.data.farmers[owner]);
  if (!left.length) return;
  for (const player of world.getAllPlayers()) {
    if (player.dimension.id !== "minecraft:overworld") continue;
    for (const [owner, town] of left) {
      if (Math.hypot(player.location.x - town.x, player.location.z - town.z) > REACH) continue;
      if (placeFarmer(player.dimension, owner, town)) return; // one per pass is plenty
    }
  }
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:hamlet_farmer") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  if (!townOf(player.id)) return player.sendMessage("§cYou have no settlement yet: raise your Keep Banner first.");
  if (event.message.trim().toLowerCase() === "reset") {
    for (const e of player.dimension.getEntities({ tags: [`${FARMER_TAG}_${player.id}`] })) e.remove();
    delete store.data.farmers[player.id];
    store.save();
    return player.sendMessage("§aYour Farmer will be placed again when you are near your Hamlet.");
  }
  const f = farmerOf(player.id);
  player.sendMessage(f ? `§7Your Farmer stands at §f${f.x} ${f.y} ${f.z}§7.` : "§7Your Farmer is placed when you are near your Hamlet.");
});

addTests("economy hamlet farmer", {
  "the Farmer stands two steps out from the second starter house's door": () => {
    const slots = [
      { tier: 0, start: "house", tags: ["starter", "founder"], side: "s", step: { x: 23, z: -4 }, box: { x0: 18, z0: -19, x1: 28, z1: -5 } },
      { tier: 0, start: "house", tags: ["starter"], side: "n", step: { x: 23, z: 4 }, box: { x0: 18, z0: 5, x1: 28, z1: 19 } },
    ];
    const at = farmerSpot(slots);
    assertEqual(`${at.x},${at.z}`, "23,2");
  },
  "without a second house, beside the Mason's Bench, else off the square": () => {
    assertEqual(JSON.stringify(farmerSpot([], { x: 110, z: 88 }, { x: 100, z: 100 })), JSON.stringify({ x: 12, z: -12 }));
    assert(farmerSpot([]).x !== 0, "a spot off the centre");
  },
});
