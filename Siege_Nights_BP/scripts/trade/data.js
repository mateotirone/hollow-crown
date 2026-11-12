// Trade Outposts: every number in one place. Pure (no Minecraft imports), so it loads in Node tests.
// Design (approved by Mateo 2026-11-12): https://claude.ai/artifact/UkR4zp2NL5tzfrZKva2gWX
//
// A party is anyone who can hold a route: "p:<player id>" (a player's settlement), "l:<lord id>" (a Rival Lord),
// "t:<stop id>" (one of the six map towns; "t:kingsrest" is the capital, which buys anything for Regals).

export const DAY = 24000; // ticks in an in-game day
export const SECOND = 20;

export const TRADE = {
  wingPrice: 12 * 64, // Regals to raise the Outpost wing (12 Gold Regals)
  routesByStage: { halt: 1, station: 2, junction: 3, grand: 5 }, // open routes a station can run
  stacksByStage: { halt: 2, station: 4, junction: 6, grand: 9 }, // cargo per run, each way, in stacks of 64
  wagonStacks: 2, // each Goods Wagon adds this much cargo
  maxWagons: 3,
  wagonPrice: 300, // Regals for a Goods Wagon
  trainSpeed: 32, // blocks a second (the same as a real train)
  loadSeconds: 30, // at each end
  every: { half: DAY / 2, day: DAY, two: DAY * 2 }, // how often a route runs
  everyNames: { half: "twice a day", day: "every day", two: "every 2 days" },
  retryTicks: DAY / 12, // a paused route tries again this often (2 in-game hours)
  dormantAfter: 3, // missed days in a row before a route goes dormant
  offerExpires: DAY * 7,
  barrelSlots: 27,
  dockStacks: 2, // imports that can't fit the crate wait on the dock up to this many stacks a route, then it pauses
  maxRunsChoice: [0, 5, 10, 20, 50], // 0 = until someone cancels
  npcReplyTicks: DAY / 8, // an NPC answers an offer after about this long (3 in-game hours)
  npcOfferEvery: DAY * 3, // an NPC with a surplus writes to a player about this often
  npcStockDays: 7, // an NPC keeps at most this many days of what it makes
  npcMargin: { kindly: 0, steady: 0.1, grasping: 0.25, proud: 0.05 }, // how much in their favour they want it
  npcTownMargin: 0.1,
  relationStep: 10, // runs without a miss before a lord's terms get better
  relationBonus: 0.05, // per step, up to
  relationMax: 0.15,
  capitalRate: 7, // Kingsrest pays this many Regals per iron's worth of anything (the Moneyer pays 8, with daily limits)
  supplyRuns: 3, // the works' Supply Line fills Exports up to what the routes need for this many runs
  holdUpChance: 0.04, // a run on a route longer than holdUpMin has this chance of a hold-up (owner online only)
  holdUpMin: 600,
  holdUpSeconds: 300, // to reach the wagon and beat the bandits
  rushChance: 0.05, // a run from an NPC has this chance of a market rush offer
  washoutChance: 0.01, // a run has this chance of finding a stretch closed for a day
  nightChance: 0.06, // a run that leaves at night, once the seep has begun, may come back odd
};

// The goods a route may carry, with what each is worth in iron ingots (the Moneyer's ladder: 4 iron = 1 gold,
// 8 gold = 1 diamond, 6 diamonds = 1 netherite scrap). Nothing else goes on a train: no tools, armour, story items,
// boss drops or Choirsteel. `metal` ties it to the regional rates; `make` is what an NPC settlement makes of it a day
// at Hamlet tier (times tier + 1, times its region's rate).
export const GOODS = [
  { id: "minecraft:iron_ingot", worth: 1, metal: "iron", make: 24 },
  { id: "minecraft:raw_iron", worth: 0.75, metal: "iron", make: 0 },
  { id: "minecraft:gold_ingot", worth: 4, metal: "gold", make: 6 },
  { id: "minecraft:raw_gold", worth: 3, metal: "gold", make: 0 },
  { id: "minecraft:diamond", worth: 32, metal: "diamond", make: 1 },
  { id: "minecraft:netherite_scrap", worth: 192, metal: "netherite", make: 0 },
  { id: "minecraft:netherite_ingot", worth: 784, metal: "netherite", make: 0 },
  { id: "minecraft:copper_ingot", worth: 0.25, make: 16 },
  { id: "minecraft:coal", worth: 0.25, make: 24 },
  { id: "minecraft:charcoal", worth: 0.25, make: 0 },
  { id: "minecraft:redstone", worth: 0.25, make: 0 },
  { id: "minecraft:lapis_lazuli", worth: 0.5, make: 0 },
  { id: "minecraft:quartz", worth: 0.5, make: 0 },
  { id: "minecraft:amethyst_shard", worth: 0.5, make: 0 },
  { id: "minecraft:emerald", worth: 0.5, make: 0 },
  { id: "minecraft:oak_log", worth: 0.125, make: 32, home: ["Aldmere Vale"] },
  { id: "minecraft:spruce_log", worth: 0.125, make: 32, home: ["Frostmarch"] },
  { id: "minecraft:cobblestone", worth: 0.03, make: 64 },
  { id: "minecraft:stone", worth: 0.05, make: 0 },
  { id: "minecraft:sand", worth: 0.05, make: 48, home: ["Emberwaste"] },
  { id: "minecraft:glass", worth: 0.1, make: 0 },
  { id: "minecraft:wheat", worth: 0.1, make: 48, home: ["Aldmere Vale"] },
  { id: "minecraft:carrot", worth: 0.1, make: 32, home: ["Aldmere Vale"] },
  { id: "minecraft:potato", worth: 0.1, make: 32, home: ["Aldmere Vale"] },
  { id: "minecraft:bread", worth: 0.3, make: 0 },
  { id: "minecraft:cod", worth: 0.2, make: 32, home: ["Saltreach"] },
  { id: "minecraft:salmon", worth: 0.25, make: 24, home: ["Saltreach"] },
  { id: "minecraft:leather", worth: 0.5, make: 12, home: ["Frostmarch"] },
  { id: "minecraft:white_wool", worth: 0.25, make: 16, home: ["Frostmarch", "Aldmere Vale"] },
  { id: "minecraft:string", worth: 0.1, make: 0 },
  { id: "minecraft:feather", worth: 0.1, make: 0 },
  { id: "minecraft:slime_ball", worth: 0.5, make: 8, home: ["Blackfen"] },
  { id: "minecraft:brown_mushroom", worth: 0.1, make: 24, home: ["Blackfen"] },
  { id: "minecraft:red_mushroom", worth: 0.1, make: 16, home: ["Blackfen"] },
  { id: "minecraft:sugar_cane", worth: 0.1, make: 24, home: ["Blackfen", "Saltreach"] },
  { id: "siege:coin", worth: 1 / 8, money: true },
  { id: "siege:gold_coin", worth: 8, money: true },
];
export const GOOD_IDS = GOODS.map((g) => g.id);
export const goodOf = (id) => GOODS.find((g) => g.id === id);
export const COIN = "siege:coin", GOLD_COIN = "siege:gold_coin", GOLD_WORTH = 64;

// Regional rates (Mateo, 2026-11-12, set in the material-loop thread): each region strong in one metal is weak in
// another, so it has to trade. Netherite has no buff anywhere. economy/config.js REGION_RATES wins once it exists.
export const REGION_RATES_DEFAULT = {
  "Aldmere Vale": { iron: 1, gold: 1, diamond: 1 },
  Frostmarch: { iron: 0.25, gold: 1, diamond: 2.5 },
  Saltreach: { iron: 2, gold: 0.25, diamond: 1 },
  Emberwaste: { iron: 1, gold: 3, diamond: 0.25 },
  Blackfen: { iron: 1, gold: 1, diamond: 1 },
};

// The trade wing's insides, in the Trade House design's own frame (its door at local (0, 1, 1), the back wall at
// z = box.z1): the Trade Board in the middle of the back, the crates either side of it.
export const WING_SPOTS = {
  board: (box) => ({ x: 0, y: 1, z: box.z1 - 1 }),
  exports: (box) => ({ x: -2, y: 1, z: box.z1 - 1 }),
  imports: (box) => ({ x: 2, y: 1, z: box.z1 - 1 }),
};
