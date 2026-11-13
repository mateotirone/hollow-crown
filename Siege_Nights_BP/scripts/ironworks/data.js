// The Ironworks (Mateo 2026-11-12): a Hollow Crown iron farm you build up to, instead of golems.
//   1 Ore Pit (Hamlet)            a worker digs raw iron out of a pit: slow, you smelt it yourself
//   2 Bloomery (Town)             a clay furnace smelts it for you, burning charcoal from your tree farm
//   3 Trip-Hammer Forge (City)    a waterwheel drives a hammer: needs a river or stream beside it
// It stands on one of the town's Works plots (settle: a 27 x 17 plot the town generator lays out) and grows into it.
// Output piles up in the storeroom (the block's menu) up to a few days' worth; raiders loot it when a siege goes
// badly. How fast depends on the region (economy REGION_RATES): Saltreach x2, Frostmarch x0.25. Pure numbers and maths (Node and self-tests).

export const IRONWORKS_BLOCK = "siege:ironworks";
export const DAY = 24000;

export const LEVELS = [
  null,
  { name: "Ore Pit", tier: "Hamlet", cost: 0, makes: "minecraft:raw_iron", perDay: 16, fuelEvery: 0 },
  { name: "Bloomery", tier: "Town", cost: 384, makes: "minecraft:iron_ingot", perDay: 40, fuelEvery: 4 },
  { name: "Trip-Hammer Forge", tier: "City", cost: 1280, makes: "minecraft:iron_ingot", perDay: 100, fuelEvery: 4, water: true },
];
export const MAX_LEVEL = LEVELS.length - 1;
export const TIER_ORDER = ["Hamlet", "Town", "City", "Castle"];
export const FUEL = "minecraft:charcoal";
export const IRONWORKS = {
  capDays: 3, // the storeroom holds this many days of output, then the workers stop
  fuelCap: 256, // charcoal the bunker holds
  metal: "iron", // output is scaled by economy/config.js regionRate(region, "iron"): Saltreach x2, Frostmarch x0.25
  plotCost: 160, // Regals for the Ore Pit on a Works plot (the plot is fenced at its full size from the start)
  waterReach: 12, // the Forge needs water this close to its block
  loot: { won: 0, dawn: 0.25, lost: 0.5 }, // share of the storeroom raiders carry off, by siege outcome
};

export const tierAtLeast = (have, need) => TIER_ORDER.indexOf(have) >= TIER_ORDER.indexOf(need);
export const capOf = (level, bonus = 1) => Math.round(LEVELS[level].perDay * bonus * IRONWORKS.capDays);

// What the works made over `ticks`, given the charcoal in its bunker. Returns { raw, ingots, fuel } to add/use.
// A Bloomery or Forge that runs out of charcoal falls back to digging raw ore at the Ore Pit's pace.
// store = { raw, ingots } already in the storeroom (the cap counts them).
export function produce(level, ticks, fuel, store = { raw: 0, ingots: 0 }, bonus = 1) {
  const days = Math.max(0, ticks) / DAY;
  const L = LEVELS[level], pit = LEVELS[1];
  let raw = 0, ingots = 0, used = 0;
  if (!L.fuelEvery) {
    raw = Math.floor(pit.perDay * bonus * days);
  } else {
    const could = Math.floor(L.perDay * bonus * days);
    ingots = Math.min(could, fuel * L.fuelEvery);
    used = Math.ceil(ingots / L.fuelEvery);
    const share = could ? 1 - ingots / could : 0; // the time it had no fire
    raw = Math.floor(pit.perDay * bonus * days * share);
  }
  const capIngots = L.fuelEvery ? capOf(level, bonus) : 0, capRaw = capOf(1, bonus);
  ingots = Math.max(0, Math.min(ingots, capIngots - store.ingots));
  raw = Math.max(0, Math.min(raw, capRaw - store.raw));
  if (L.fuelEvery) used = Math.min(used, Math.ceil(ingots / L.fuelEvery));
  return { raw, ingots, fuel: used };
}

// What raiders carry off
export const lootShare = (outcome) => IRONWORKS.loot[outcome] ?? IRONWORKS.loot.lost;
