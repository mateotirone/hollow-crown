// The Guild (Mateo 2026-11-12): a Guild Factor in every town posts three orders a day for goods from OTHER regions,
// and pays in metal (iron, gold, now and then a diamond), not just coin. It gives every region's strength a buyer
// across the map and a reason to travel or ride the trains. Pure numbers and maths (Node and self-tests).

import { REGIONS } from "../economy/config.js";

const [V, F, S, E, B] = REGIONS;

// What each region is known for: [item, count in one order, what that count is worth in Regals]. Nothing a trader
// sells, or buying it to fill orders would print metal (a self-test checks).
export const GOODS = {
  [V]: [["minecraft:pumpkin", 16, 16], ["minecraft:carrot", 32, 12], ["minecraft:oak_log", 32, 16], ["minecraft:leather", 8, 8], ["minecraft:white_wool", 16, 12]],
  [F]: [["minecraft:raw_iron", 16, 96], ["siege:rime_pelt", 4, 24], ["minecraft:spruce_log", 32, 16], ["minecraft:packed_ice", 16, 12]],
  [S]: [["minecraft:cod", 16, 20], ["minecraft:kelp", 64, 8], ["minecraft:ink_sac", 16, 6], ["minecraft:raw_iron", 16, 96], ["minecraft:cooked_salmon", 16, 24]],
  [E]: [["minecraft:gold_ingot", 4, 80], ["minecraft:raw_gold", 8, 128], ["minecraft:sandstone", 64, 16], ["minecraft:cactus", 16, 8]],
  [B]: [["minecraft:slime_ball", 8, 12], ["minecraft:spider_eye", 16, 6], ["minecraft:glow_berries", 16, 5], ["minecraft:mangrove_log", 32, 16], ["minecraft:honey_bottle", 4, 8]],
};

// Metal pays out by what it is worth on the trade-up ladder (economy EXCHANGE: 4 iron = 1 gold, 8 gold = 1 diamond)
export const METALS = [["minecraft:diamond", 256], ["minecraft:gold_ingot", 32], ["minecraft:iron_ingot", 8]];
export const GUILD = {
  perDay: 3, // orders on each Factor's board, new every dawn
  sizes: [1, 2, 4], // an order asks for the base count times one of these
  bonus: 1.6, // the metal paid is worth this much more than the goods would sell for: the reward for carrying them
};

export function dice(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 11);

// Metal worth `value`: as much diamond and gold as fits, the rest in iron (at least one iron)
export function payIn(value) {
  const out = [];
  let left = Math.round(value);
  for (const [id, worth] of METALS) {
    const n = Math.floor(left / worth);
    if (n > 0) { out.push([id, n]); left -= n * worth; }
  }
  return out.length ? out : [["minecraft:iron_ingot", 1]];
}

// The day's orders at one town: from three different regions where it can, never the town's own
export function ordersFor(town, region, day) {
  const roll = dice(seedOf(`${town}|${day}`));
  const others = REGIONS.filter((r) => r !== region);
  for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(roll() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
  const orders = [];
  for (let i = 0; i < GUILD.perDay; i++) {
    const from = others[i % others.length], list = GOODS[from];
    const [item, count, worth] = list[Math.floor(roll() * list.length)];
    const size = GUILD.sizes[Math.floor(roll() * GUILD.sizes.length)];
    orders.push({ id: `${day}:${i}`, from, item, count: count * size, pay: payIn(worth * size * GUILD.bonus) });
  }
  return orders;
}

export const valueOf = (pay) => pay.reduce((s, [id, n]) => s + n * METALS.find(([m]) => m === id)[1], 0);
