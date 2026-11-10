// Horses: every number and table as plain data (no Minecraft imports, so it loads in Node tests).
import { coins } from "../economy/rules.js"; // pure, loads in Node
// Mateo: the numbers you might want to tweak are in HORSE_SETTINGS at the top.

export const HORSE_SETTINGS = {
  blocksPerXp: 4, // 1 horse XP per this many blocks ridden
  gallopXpMultiplier: 2,
  raiderKillXp: 10, // killing a raider from the saddle
  maxLevel: 20,
  perkLevels: [5, 10, 15, 20], // a perk point at each of these horse levels
  foalGrowTicks: 24000, // 1 in-game day (20 minutes) for a foal to grow up
  breedCooldownTicks: 24000, // each parent breeds once per in-game day
  breederPostPrice: 192, // coins for a regional foal (3 Gold Regals)
  breederPostCooldownTicks: 72000, // one foal per post every 3 in-game days, per player
  whistleRange: 64,
  loyalWhistleCooldownTicks: 1200, // 60 seconds
  stepDistance: 10, // Glimstrider's Veilstep
  stepCooldownTicks: 400, // 20 seconds
  chargeRallyRange: 24, // Warhorse Charge rallies your guards this close
  reviveCost: [{ item: "minecraft:totem_of_undying", count: 1 }, { item: "coins", count: 128 }],
  breedCost: [{ item: "minecraft:golden_carrot", count: 4 }, { item: "minecraft:golden_apple", count: 2 }],
};

export const STATS = ["speed", "jump", "health", "stamina"];
export const STAT_NAMES = { speed: "Speed", jump: "Jump", health: "Health", stamina: "Stamina" };

// What an effective level means. Index 0 = level 1. Speed/jump/health become entity component groups.
export const SPEED_VALUES = [0.19, 0.22, 0.25, 0.28, 0.31, 0.335, 0.36, 0.385, 0.41]; // movement
export const JUMP_VALUES = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1]; // horse jump strength
export const HEALTH_VALUES = [18, 22, 26, 30, 34, 40, 46]; // health points (2 = 1 heart)
export const STAMINA_MAX = 9;
export const MAX_EFFECTIVE = { speed: SPEED_VALUES.length, jump: JUMP_VALUES.length, health: HEALTH_VALUES.length, stamina: STAMINA_MAX };
export const gallopTicks = (staminaLevel) => Math.round((3 + 1.5 * staminaLevel) * 20);

// Shown in menus: what a level means in blocks per second, blocks and hearts
export const SPEED_BPS = SPEED_VALUES.map((v) => Math.round(v * 42.16 * 10) / 10);
export const JUMP_BLOCKS = [1.5, 2.0, 2.6, 3.3, 4.0, 5.0, 6.0];

// ---------- Breeds ----------
// trait: innate trait id (see TRAITS). coat/mark: vanilla horse coat + markings until the texture pass.
export const BREEDS = {
  common: { name: "Common Horse", short: "Common", region: "anywhere", bonus: {}, trait: null, coat: 3, mark: 0, prop: 0 },
  courser: { name: "Vale Courser", short: "Courser", region: "Aldmere Vale", bonus: { speed: 1 }, trait: "roadborn", coat: 2, mark: 1, prop: 1 },
  destrier: { name: "Frostmarch Destrier", short: "Destrier", region: "Frostmarch", bonus: { health: 1 }, trait: "snowbreaker", coat: 0, mark: 0, prop: 2 },
  runner: { name: "Saltreach Runner", short: "Runner", region: "Saltreach", bonus: { jump: 1 }, trait: "tideborn", coat: 5, mark: 3, prop: 3 },
  sandstrider: { name: "Emberwaste Sandstrider", short: "Sandstrider", region: "Emberwaste", bonus: { stamina: 1 }, trait: "dunestrider", coat: 1, mark: 0, prop: 4 },
  mirepony: { name: "Blackfen Mire-Pony", short: "Mire-Pony", region: "Blackfen", bonus: { jump: 1 }, trait: "surefooted", coat: 4, mark: 0, prop: 5 },
};
export const REGIONAL_BREEDS = ["courser", "destrier", "runner", "sandstrider", "mirepony"];
export const CROSSBRED_PROP = 6;

export const TRAITS = {
  roadborn: { name: "Roadborn", desc: "Faster on roads: path, gravel, cobblestone and stone brick." },
  snowbreaker: { name: "Snowbreaker", desc: "Faster on snow and ice, and never freezes in powder snow." },
  tideborn: { name: "Tideborn", desc: "Swims with you on its back and holds its breath far longer." },
  dunestrider: { name: "Dune-strider", desc: "Faster on sand and sandstone, and immune to fire." },
  surefooted: { name: "Sure-footed", desc: "No fall damage, faster on mud, clay and roots. A little smaller." },
};

// Blocks each terrain trait is fast on (checked under and at the horse's feet)
export const TERRAIN = {
  roadborn: ["minecraft:grass_path", "minecraft:dirt_path", "minecraft:gravel", "minecraft:cobblestone", "minecraft:mossy_cobblestone",
    "minecraft:stonebrick", "minecraft:stone_bricks", "minecraft:mossy_stone_bricks", "minecraft:cracked_stone_bricks",
    "minecraft:cobblestone_slab", "minecraft:stone_brick_slab", "minecraft:polished_andesite", "siege:castle_stone",
    "siege:mossy_castle_stone", "siege:cracked_castle_stone"],
  snowbreaker: ["minecraft:snow", "minecraft:snow_layer", "minecraft:powder_snow", "minecraft:ice", "minecraft:packed_ice", "minecraft:blue_ice", "minecraft:frosted_ice"],
  dunestrider: ["minecraft:sand", "minecraft:red_sand", "minecraft:sandstone", "minecraft:red_sandstone", "minecraft:cut_sandstone",
    "minecraft:smooth_sandstone", "minecraft:chiseled_sandstone", "minecraft:cut_red_sandstone", "minecraft:smooth_red_sandstone", "minecraft:suspicious_sand"],
  surefooted: ["minecraft:mud", "minecraft:clay", "minecraft:mangrove_roots", "minecraft:muddy_mangrove_roots", "minecraft:packed_mud",
    "minecraft:moss_block", "minecraft:podzol", "minecraft:mycelium", "minecraft:soul_soil", "minecraft:soul_sand"],
};

// ---------- Perks ----------
export const PERKS = {
  sprint_burst: { name: "Sprint Burst", desc: "Each gallop starts with 2 seconds of an even bigger burst." },
  second_wind: { name: "Second Wind", desc: "Stamina refills twice as fast." },
  loyal: { name: "Loyal", desc: "Your Horse Whistle calls it from anywhere, even from its stall." },
  trample: { name: "Trample", desc: "Galloping into hostile mobs hits them for 4 damage and knocks them back." },
  fearless: { name: "Fearless", desc: "Shrugs off slowness, weakness and blindness." },
  iron_hide: { name: "Iron Hide", desc: "+1 Health.", bonus: { health: 1 } },
  skyleap: { name: "Skyleap", desc: "+1 Jump.", bonus: { jump: 1 } },
  fleet: { name: "Fleet", desc: "+1 Speed.", bonus: { speed: 1 } },
};

// ---------- Gear ----------
export const SHOES = {
  none: { name: "none", bonus: {} },
  iron: { name: "Iron Horseshoes", item: "siege:horseshoes_iron", bonus: { speed: 1 } },
  diamond: { name: "Diamond Horseshoes", item: "siege:horseshoes_diamond", bonus: { speed: 1, jump: 1 } },
  netherite: { name: "Netherite Horseshoes", item: "siege:horseshoes_netherite", bonus: { speed: 2, jump: 1 }, fireproof: true },
};
export const SADDLES = {
  none: { name: "none", bonus: {} },
  padded: { name: "Padded Saddlecloth", item: "siege:saddlecloth_padded", bonus: { stamina: 1 } },
  cavalry: { name: "Cavalry Saddle Kit", item: "siege:saddle_cavalry", bonus: { stamina: 2 } },
  royal: { name: "Royal Saddle Kit", item: "siege:saddle_royal", bonus: { stamina: 3 } },
};
export const GEAR_ITEMS = {}; // item id -> { slot: "shoes" | "saddle", key }
for (const [key, g] of Object.entries(SHOES)) if (g.item) GEAR_ITEMS[g.item] = { slot: "shoes", key };
for (const [key, g] of Object.entries(SADDLES)) if (g.item) GEAR_ITEMS[g.item] = { slot: "saddle", key };

export const HALTER = "siege:halter";
export const WHISTLE = "siege:horse_whistle";
export const CROP = "siege:riding_crop";
export const CAPARISON = "siege:caparison";

// ---------- Special steeds ----------
export const SPECIALS = {
  none: { name: "", prop: 0 },
  warhorse: {
    name: "Knight Warhorse", prop: 1, path: "knight", bonus: { health: 1 },
    needs: { level: 15, speed: 4, health: 4 },
    cost: [{ item: "minecraft:gold_block", count: 4 }, { item: "minecraft:iron_block", count: 8 }, { item: "minecraft:diamond_block", count: 1 }],
    desc: "12% bigger, +1 Health. Warhorse Charge: gallop into enemies to throw them down (7 damage) and rally your guards.",
  },
  hollow: {
    name: "Glimstrider", prop: 2, path: "marked", bonus: {},
    needs: { level: 15, stamina: 4 },
    cost: [{ item: "minecraft:echo_shard", count: 8 }, { item: "minecraft:amethyst_shard", count: 4 }, { item: "minecraft:ender_eye", count: 1 }],
    desc: "Spectral: no fall damage, fire immune. Veilstep: blow the Horse Whistle while riding to blink 10 blocks ahead, through walls.",
  },
};

// ---------- Training ----------
// Cost to train a stat TO this level (index = target level). Plus 1 training point.
export const TRAIN_COST = [
  null,
  null,
  [{ item: "minecraft:hay_block", count: 4 }],
  [{ item: "minecraft:hay_block", count: 8 }, { item: "minecraft:golden_carrot", count: 4 }],
  [{ item: "minecraft:golden_carrot", count: 8 }, { item: "minecraft:golden_apple", count: 2 }],
  [{ item: "minecraft:golden_carrot", count: 16 }, { item: "minecraft:golden_apple", count: 4 }, { item: "minecraft:diamond", count: 2 }],
];
export const MAX_TRAINED = 5;

// ---------- Stables ----------
export const STABLES_LEVELS = [
  null,
  { level: 1, roster: 3, trainCap: 3, cost: null, unlocks: "Training, breeding, perks and stalls" },
  { level: 2, roster: 5, trainCap: 4, cost: [{ item: "minecraft:hay_block", count: 32 }, { item: "minecraft:iron_ingot", count: 16 }, { item: "minecraft:leather", count: 8 }], unlocks: "Reviving fallen horses" },
  { level: 3, roster: 8, trainCap: 5, cost: [{ item: "minecraft:diamond", count: 8 }, { item: "minecraft:golden_carrot", count: 32 }, { item: "minecraft:gold_block", count: 4 }], unlocks: "The Warhorse and Glimstrider rites" },
];
export const rosterCap = (stablesLevel) => (stablesLevel > 0 ? STABLES_LEVELS[Math.min(3, stablesLevel)].roster : 1);
export const trainCap = (stablesLevel) => (stablesLevel > 0 ? STABLES_LEVELS[Math.min(3, stablesLevel)].trainCap : 0);

// ---------- XP ----------
export const xpToNext = (level) => 150 + 60 * level;

// Adds XP to a record; returns { levels, perks } gained
export function addXp(rec, amount) {
  const out = { levels: 0, perks: 0 };
  if (rec.level >= HORSE_SETTINGS.maxLevel) return out;
  rec.xp += amount;
  while (rec.level < HORSE_SETTINGS.maxLevel && rec.xp >= xpToNext(rec.level)) {
    rec.xp -= xpToNext(rec.level);
    rec.level++;
    rec.tp++;
    out.levels++;
    if (HORSE_SETTINGS.perkLevels.includes(rec.level)) {
      rec.pp++;
      out.perks++;
    }
  }
  if (rec.level >= HORSE_SETTINGS.maxLevel) rec.xp = 0;
  return out;
}

// ---------- Effective stats ----------
export function bonusesOf(rec) {
  const total = { speed: 0, jump: 0, health: 0, stamina: 0 };
  const add = (b) => {
    for (const [k, v] of Object.entries(b ?? {})) total[k] += v;
  };
  add(rec.bonus); // breed bonus (crossbreds carry both parents', capped at +1 each)
  add(SHOES[rec.shoes]?.bonus);
  add(SADDLES[rec.saddle]?.bonus);
  add(SPECIALS[rec.special]?.bonus);
  for (const p of rec.perks) add(PERKS[p]?.bonus);
  return total;
}

export function effectiveStats(rec) {
  const b = bonusesOf(rec);
  const out = {};
  for (const s of STATS) out[s] = Math.max(1, Math.min(MAX_EFFECTIVE[s], rec.stats[s] + b[s]));
  return out;
}

export const hasTrait = (rec, trait) => rec.traits.includes(trait);
export const hasPerk = (rec, perk) => rec.perks.includes(perk);

// ---------- Records ----------
const NAMES = ["Thunder", "Bramble", "Ashfoot", "Willow", "Cinder", "Moonlark", "Rook", "Hazel", "Tempest", "Bracken",
  "Sorrel", "Juniper", "Galahad", "Marigold", "Flint", "Saffron", "Wraith", "Ember", "Clover", "Duskmane",
  "Thistle", "Gale", "Barley", "Oakheart", "Pepper", "Raven", "Sable", "Briar", "Comet", "Fennel"];
export const randomName = (rand = Math.random) => NAMES[Math.floor(rand() * NAMES.length)];

export function newRecord({ uid, owner, ownerName, breed = "common", stats, name, rand = Math.random }) {
  const b = BREEDS[breed] ?? BREEDS.common;
  return {
    uid, owner, ownerName,
    name: name ?? randomName(rand),
    breed, // breed key, or "crossbred"
    breedName: b.name,
    bonus: { ...b.bonus },
    traits: b.trait ? [b.trait] : [],
    coat: b.coat, mark: b.mark, prop: b.prop,
    stats: stats ?? { speed: 1, jump: 1, health: 1, stamina: 1 },
    level: 1, xp: 0, tp: 0, pp: 0, perks: [],
    shoes: "none", saddle: "none", special: "none", caparison: 0,
    status: "out", // "out" (in the world) | "stabled" | "fallen"
    foal: false, grownAt: 0, lastBred: -1e9,
    sire: null, dam: null, // parents' names
    gen: 0, // bumped every time it's spawned, so an old copy left in an unloaded chunk removes itself
    gearSaddle: false, gearArmor: null, // vanilla saddle and horse armor, kept while stabled
  };
}

// Foal stats and traits from two parents. rand() is injectable for tests.
export function breedFoal(sire, dam, rand = Math.random) {
  const stats = {};
  for (const s of STATS) stats[s] = Math.max(1, Math.floor((sire.stats[s] + dam.stats[s]) / 2) - 1);
  const lucky = STATS[Math.floor(rand() * STATS.length)];
  stats[lucky] = Math.min(MAX_TRAINED, stats[lucky] + 1);

  const bonus = {};
  for (const src of [sire.bonus, dam.bonus]) for (const [k, v] of Object.entries(src ?? {})) if (v > 0) bonus[k] = 1;

  const first = rand() < 0.5 ? sire : dam;
  const second = first === sire ? dam : sire;
  const traits = [];
  const pick = (t) => {
    if (t && !traits.includes(t)) traits.push(t);
  };
  if (first.traits.length) pick(first.traits[Math.floor(rand() * first.traits.length)]);
  else if (second.traits.length) pick(second.traits[Math.floor(rand() * second.traits.length)]);
  for (const t of second.traits) if (rand() < 0.35) pick(t);
  for (const t of first.traits) if (traits.length < 2 && rand() < 0.15) pick(t);

  const same = sire.breed === dam.breed;
  const breed = same ? sire.breed : "crossbred";
  const short = (r) => (BREEDS[r.breed]?.short ?? r.breedName.replace(/^Crossbred /, ""));
  const breedName = same ? sire.breedName : `Crossbred (${short(sire)} x ${short(dam)})`;
  const coatFrom = rand() < 0.5 ? sire : dam;
  return {
    breed, breedName, bonus, traits, stats,
    coat: coatFrom.coat, mark: (rand() < 0.5 ? sire : dam).mark,
    prop: same ? sire.prop : CROSSBRED_PROP,
    sire: sire.name, dam: dam.name,
  };
}

// Vanilla horse numbers -> trained levels (for the Halter)
export function levelFromValue(value, table) {
  let best = 0;
  for (let i = 0; i < table.length; i++) if (Math.abs(table[i] - value) < Math.abs(table[best] - value)) best = i;
  return Math.min(MAX_TRAINED, best + 1);
}

// A cost line { item: "coins", count } is paid in the world currency
export const costText = (cost) => cost.map((c) => (c.item === "coins" ? coins(c.count) : `${c.count} ${c.item.replace(/^\w+:/, "").replaceAll("_", " ")}`)).join(", ");

export function bar(value, max, width = 10) {
  const filled = Math.round((value / max) * width);
  return "§a" + "|".repeat(Math.max(0, filled)) + "§8" + "|".repeat(Math.max(0, width - filled));
}
