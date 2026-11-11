// The world currency of The Hollow Crown: every number, price and line Mateo might want to tweak.
// Pure data, loads in Node. Design doc: https://claude.ai/artifact/NAwu6TPTwrJA5YZekgqZ5u
//
// The coin is backed by iron (Mateo, 2026-11-10): the Moneyer always buys an iron ingot for
// ECON.ironBuys coins and sells one for ECON.ironSells. Every other price hangs off that.
// One old emerald = one iron ingot = 8 coins.

export const COIN = "siege:coin"; // the everyday coin
export const GOLD = "siege:gold_coin"; // worth ECON.goldWorth coins

export const ECON = {
  // Display name only; Regal is confirmed by Mateo (2026-11-10). It also appears in some player texts and docs.
  one: "Regal", many: "Regals", gold: "Gold Regal",
  icon: "textures/items/siege_coin",
  goldWorth: 64,
  perEmerald: 8, // how many coins an old emerald price becomes
  ironBuys: 8, // the Moneyer pays this per iron ingot
  ironSells: 10, // and charges this for one
  mintDaily: 64, // ingots per player per day at the full price; after that the Moneyer pays half
  // Daily appetite: past a good's `want`, the price drops by `drop` for every `step` more you sell, down to `floor`.
  // It resets each dawn and is counted per player and per region.
  drop: 0.1, floor: 0.3,
  wantLots: 8, // default: full price for the first 8 lots of a good each day
  stepLots: 2, // default: the price steps down every 2 lots after that
  // Regional prices: in a region that makes a good, NPCs pay and charge less; where it is scarce, more.
  homePays: 0.75, homeCharges: 0.85, scarcePays: 1.5, scarceCharges: 1.5,
  maxLots: 32, // most lots one purchase can buy
  // Hard daily stop (anti-farm): once a trader's price has hit its floor, it buys this many more lots from you that
  // day and then no more. Counted per player, per region, per good, reset each dawn. A good's own `stop` (units) wins.
  stopLots: 4,
  mintStop: 128, // iron ingots per player per day the Moneyer takes at all (64 full price, then 64 at half)
};

export const REGIONS = ["Aldmere Vale", "Frostmarch", "Saltreach", "Emberwaste", "Blackfen"];
const [V, F, S, E, B] = REGIONS;

const m = (id) => `minecraft:${id}`;
// A good: [item id, lot size, coins for the lot, extra]. Prices are for a whole lot.
const g = (id, lot, price, extra = {}) => ({ id: id.includes(":") ? id : m(id), lot, price, ...extra });

// Regional Castle Guard armor (textures thread, PR #69; Mateo chose regional looks 2026-11-10): each region's Smith sells
// only that region's set, at a flat price (no regional markup: it is the local make). About a quarter over the plain
// Castle Guard piece at the Quartermaster (40 / 72 / 56 / 40). `region` limits a good to NPCs of that region.
export const GUARD_PRICES = { helmet: 50, chestplate: 90, leggings: 70, boots: 50 };
const GUARD_KEY = { "Aldmere Vale": "vale", Frostmarch: "frostmarch", Saltreach: "saltreach", Emberwaste: "emberwaste", Blackfen: "blackfen" };
const REGIONAL_GUARD = REGIONS.flatMap((region) => Object.entries(GUARD_PRICES).map(([piece, price]) =>
  g(`siege:guard_${GUARD_KEY[region]}_${piece}`, 1, price, { region, flat: true })));
const LOGS = ["oak_log", "spruce_log", "birch_log", "dark_oak_log", "acacia_log", "mangrove_log", "jungle_log", "cherry_log"];

// buys: what the NPC pays you for. sells: what it charges you for.
// home / scarce: regions where this trade's goods are plentiful / hard to come by.
export const JOBS = {
  farmer: {
    name: "Farmer", home: [V], scarce: [F, E],
    buys: [g("wheat", 16, 6), g("carrot", 16, 5), g("potato", 16, 5), g("beetroot", 16, 6), g("melon_slice", 16, 3),
      g("pumpkin", 16, 8), g("egg", 16, 4), g("sugar_cane", 16, 4)],
    sells: [g("wheat", 16, 10), g("bread", 4, 4), g("wheat_seeds", 16, 2), g("hay_block", 4, 24)],
  },
  woodcutter: {
    name: "Woodcutter", home: [V, B], scarce: [E],
    buys: [...LOGS.map((id) => g(id, 16, 8)), g("oak_sapling", 16, 2), g("spruce_sapling", 16, 2), g("stick", 64, 2)],
    sells: [g("oak_planks", 32, 8), g("spruce_planks", 32, 8), g("charcoal", 16, 14)],
  },
  quarryman: {
    name: "Quarryman", home: [F], scarce: [B, S],
    buys: [g("cobblestone", 64, 4), g("stone", 64, 6), g("cobbled_deepslate", 64, 5), g("sand", 64, 4), g("gravel", 64, 4),
      g("clay_ball", 16, 3), g("flint", 16, 4)],
    sells: [], // he supplies the Mason
  },
  smith: {
    name: "Smith", home: [F], scarce: [B],
    buys: [g("coal", 16, 8), g("raw_copper", 16, 6), g("copper_ingot", 16, 8), g("raw_gold", 4, 16), g("gold_ingot", 1, 5, { want: 16, step: 8 }),
      g("redstone", 16, 6), g("lapis_lazuli", 16, 8)],
    sells: [g("coal", 16, 14), g("iron_pickaxe", 1, 34), g("iron_axe", 1, 34), g("iron_shovel", 1, 14), g("iron_sword", 1, 24),
      g("shears", 1, 24), g("bucket", 1, 34), g("rail", 16, 64), g("anvil", 1, 320), ...REGIONAL_GUARD],
  },
  fisher: {
    name: "Fisher", home: [S], scarce: [E, F],
    buys: [g("cod", 16, 10), g("salmon", 16, 10), g("tropical_fish", 16, 12), g("kelp", 16, 2), g("ink_sac", 16, 6), g("nautilus_shell", 1, 12, { want: 4, step: 2 })],
    sells: [g("cooked_cod", 8, 8), g("fishing_rod", 1, 6), g("oak_boat", 1, 6)],
  },
  hunter: {
    name: "Hunter", home: [], scarce: [],
    buys: [g("leather", 8, 8), g("feather", 16, 4), g("string", 16, 6), g("bone", 16, 4), g("rotten_flesh", 32, 2), g("gunpowder", 16, 10),
      g("rabbit_hide", 16, 6),
      // trophies from the bestiary: a few a day, they are meant for crafting first
      ...[["siege:rime_pelt", 6], ["siege:pale_antler", 10], ["siege:brine_scale", 4], ["siege:wyrm_scale", 8], ["siege:toad_venom", 4],
        ["siege:wight_dust", 5], ["siege:gloamquill", 8]].map(([id, price]) => g(id, 1, price, { want: 8, step: 4 }))],
    sells: [g("arrow", 16, 16), g("lead", 2, 8), g("cooked_beef", 8, 10)],
  },
  herbalist: {
    name: "Herbalist", home: [B], scarce: [F, E],
    buys: [g("nether_wart", 16, 10), g("red_mushroom", 16, 5), g("brown_mushroom", 16, 5), g("spider_eye", 16, 6), g("poppy", 16, 2),
      g("dandelion", 16, 2), g("sweet_berries", 16, 3), g("glow_berries", 16, 5), g("honey_bottle", 4, 8)],
    sells: [g("glass_bottle", 8, 6), g("brewing_stand", 1, 40), g("glowstone_dust", 8, 16), g("sugar", 16, 6), g("nether_wart", 4, 8)],
  },
  // The Mint. Iron both ways at the fixed rate, with a daily limit; gems at a low fixed price. No regional prices.
  moneyer: {
    name: "Moneyer", home: [], scarce: [], mint: true,
    buys: [g("iron_ingot", 1, ECON.ironBuys, { want: ECON.mintDaily, step: 1, drop: 0.5, floor: 0.5, stop: ECON.mintStop }),
      g("emerald", 1, 4, { want: 32, step: 8 }), g("diamond", 1, 64, { want: 8, step: 4 })],
    sells: [g("iron_ingot", 1, ECON.ironSells)],
  },
};

export const JOB_IDS = Object.keys(JOBS);

// What they say. Daytime is plain trade talk; after dark everyone is a little less at ease.
export const LINES = {
  farmer: {
    day: ["Wheat, roots, eggs. If it grew, I'll weigh it.", "A good year. Mostly. The far field came up early, and I didn't plant the far field.", "Bread's fresh. Coin's the same as ever: the old king's head, and iron behind it."],
    night: ["I'll buy, but quick. The scarecrow's facing the house again.", "Nothing grows at night. Nothing I'd sell you."],
  },
  woodcutter: {
    day: ["Logs by the sixteen. Don't bring me the pale ones.", "Planks are cut and dry. Cheaper than your own time.", "I count rings. Some of these trees are older than the kingdom, and some are older than that."],
    night: ["I don't go under the trees after dark. I'll still pay for what you felled by day.", "You hear chopping? No. Good. Nor do I."],
  },
  quarryman: {
    day: ["Rough stone, sand, gravel. I pay by the cartload and the Mason does the rest.", "Dig where you like. Just tell me if the rock is ever warm.", "Stone's honest. It weighs what it weighs."],
    night: ["We stopped the deep cut. It rings at night. Selling, are you?", "Leave it on the cart. I'll count it at dawn, and pay you now."],
  },
  smith: {
    day: ["Coal in, tools out. Iron you take to the Moneyer, same as everyone.", "Every coin is a promise of iron. I'd know: I struck half the iron in this town.", "Rails, buckets, shears. Good plain work."],
    night: ["The forge stays lit till dawn. Not for the work.", "Buy what you need and bar your door after."],
  },
  fisher: {
    day: ["Cod, salmon, whatever the tide gave you.", "The catch is fine. It's what comes up with the catch.", "A boat and a rod and you'll never go hungry."],
    night: ["Nobody puts out at night. The water shows the wrong stars.", "I'll buy your fish. Don't ask me to look at the sea."],
  },
  hunter: {
    day: ["Hides, bone, sinew. Stranger things too, if you've met them.", "I pay for trophies. I don't ask where they walked.", "Arrows are sixteen for sixteen. Fair is fair."],
    night: ["The tracks only go one way lately. In.", "Something has been hunting my snares. Carefully."],
  },
  herbalist: {
    day: ["Wart, caps, berries. Clean hands, please.", "The fen gives freely. That's what worries me about it.", "Bottles, sugar, a little glow. I don't sell cures, only chances."],
    night: ["Some of these only open at night. I've stopped picking those.", "Be brief. The lamp is burning violet again."],
  },
  moneyer: {
    day: ["Eight to the ingot, in. Ten to the ingot, out. It has never been otherwise.", "Every Regal is a promise of iron. Bring me the coin and I'll keep the promise.", "The old king's head is on every one. Nobody has dared strike a new face."],
    night: ["The Mint does not close. Iron doesn't sleep, and neither, they say, does he.", "Count them in the light. At night the heads seem to face the other way."],
  },
};

// ---------- job NPCs in the map's towns (towns.js) ----------
// Who trades in each town of the map (plots/config.js WARDS). The first time a player comes near a town on a mapped
// world, its NPCs are placed in a ring round the town centre (at `ring` blocks, on the ground) and never placed again,
// so map builders can move or remove them. Kingsrest, the capital, has all eight and the only Moneyer.
// Region sets the prices; each town gets its region's trades plus the ones every town needs.
export const TOWN_RING = 9;
export const TOWNS = [
  { name: "Kingsrest", region: V, jobs: ["moneyer", "farmer", "woodcutter", "quarryman", "smith", "fisher", "hunter", "herbalist"] },
  { name: "Millbrook", region: V, jobs: ["farmer", "woodcutter", "smith", "hunter"] },
  { name: "Rimehold", region: F, jobs: ["quarryman", "smith", "hunter", "farmer"] },
  { name: "Gull's Rest", region: S, jobs: ["fisher", "farmer", "smith", "woodcutter"] },
  { name: "Sunscar", region: E, jobs: ["quarryman", "smith", "hunter", "farmer"] },
  { name: "Mirelight", region: B, jobs: ["herbalist", "woodcutter", "fisher", "hunter", "farmer", "smith"] },
];
