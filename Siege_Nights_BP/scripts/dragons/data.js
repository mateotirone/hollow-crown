// Dragons: every number and table. Mateo tweaks things here.
// The speed and health ladders live in studio/build_dragons.py (they are baked into the entity file).

export const DRAGON_SETTINGS = {
  homeRegion: "Emberwaste", // dragons belong to this region: only players who live there can raise and fly them
  hatchDays: 2, // in-game days an egg warms in a Hatching Brazier before it hatches
  fledgeDays: 3, // days after hatching before it can become a Fledgling (walks with a rider)
  adultDays: 6, // days after hatching before it can become an Adult (flies)
  fledgeBond: 40, // bond needed for Fledgling
  adultBond: 80, // bond needed for Adult
  feedBond: 8, // bond per feeding
  feedCooldownTicks: 1200, // it only takes food once a minute
  feedXp: 6,
  rideBondPerMinute: 2, // riding it builds bond too
  maxLevel: 20,
  blocksPerXp: 12, // flying or walking distance per point of dragon XP
  flightSeconds: 45, // flight time with no Wings training
  flightSecondsPerWings: 3, // +3 s per Wings level (5 levels = 60 s)
  restFactor: 0.5, // stamina regained per tick on the ground (0.5 = resting takes twice the flight time)
  takeoffAt: 0.25, // it will not take off below this share of its stamina
  groundedTicks: 600, // after being shot down it stays grounded this long
  breathRange: 10,
  breathCooldownTicks: 120,
  breathStaminaTicks: 60, // each breath costs 3 seconds of flight
  breathDamage: [0, 5, 8, 11], // by Breath training level
  hornRange: 96, // the Dragon Horn calls it from this far
  ballistaReach: 40, // a defended settlement's ballistas reach this far up at a dragon
  ballistaTicks: 60, // each ballista fires at a dragon this often
  ballistaDamage: 8,
  ballistaStamina: 0.25, // share of its flight stamina one bolt knocks out
  archerReach: 28,
  archerDamage: 1, // per archer, per second, up to 4 archers
  archerStamina: 0.04,
  // Shot down or beaten to its last strength, a dragon falls unconscious instead of dying
  downedLife: 20, // how much more punishment an unconscious dragon takes before it dies (a sword blow is 4, an arrow 3)
  bleedOutTicks: 12000, // untended, it bleeds out in 10 minutes (the clock only runs while its owner is online)
  tendItems: ["minecraft:golden_apple", "minecraft:enchanted_golden_apple"], // what its owner or an ally tends it with
  wakeTicks: 1200, // tended, it wakes after a minute
  wakeHealth: 0.3, // with this share of its health
  wakeGroundedTicks: 2400, // and won't fly for two minutes
  corpseTicks: 6000, // a dead dragon lies where it fell for 5 minutes (longer if a siege is still going), then crumbles to ash
  permadeath: true, // a dead dragon is gone for good (false: it wakes wounded at its Roost)
  mournDays: 3, // after a death the nests give that player no egg for this long
  woundedDays: 2, // (permadeath off) days it rests at the Roost
  nestDays: 7, // a nest lays a new egg this often
};

export const DRAGON = "siege:dragon";
export const EGG = "siege:dragon_egg";
export const SADDLE = "siege:dragon_saddle";
export const HORN = "siege:dragon_horn";
export const ROOST = "siege:dragon_roost"; // placed on your land it raises the Dragon Stable (settle/blockdesigns.js)
export const HATCHERY = "siege:hatching_brazier"; // in the Dragon Stable's nursery: an egg is set in one to hatch
export const NEST = "hc:dragon_nest"; // placed by the map builder (hc: because Siege Nights refuses siege: blocks off your land)
export const DAY = 24000;

export const RESERVE = 30; // hidden health under every dragon (studio/build_dragons.py): at this much left it falls unconscious

// The four species. Shifts move it up or down the speed and health ladders (one step = one training level).
export const SPECIES = [
  { key: "cinderwing", name: "Cinderwing", flight: 0, ground: 0, air: 0, vigor: 0, breath: "fire", breathBonus: 3, gift: "minecraft:blaze_powder",
    blurb: "Four-legged, broad-winged. The all-rounder, with the hottest fire." },
  { key: "wyvern", name: "Ashen Wyvern", flight: 0, ground: -1, air: 1, vigor: -1, breath: "ash", breathBonus: 0, gift: "minecraft:feather",
    blurb: "Two legs and wings for arms. The fastest flier, easily hurt. Breathes blinding ash." },
  { key: "drake", name: "Dune Drake", flight: -10, ground: 1, air: -1, vigor: 1, breath: "sand", breathBonus: 0, gift: "minecraft:gold_nugget",
    blurb: "Low, wide and armoured. Hard to bring down, quick on foot, tires fast in the air. Its sandblast throws things back." },
  { key: "wyrm", name: "Glass Wyrm", flight: 10, ground: -1, air: 0, vigor: -1, breath: "glass", breathBonus: 0, gift: "minecraft:amethyst_shard",
    blurb: "A long frilled serpent with four narrow wings. Stays up longest, frail. Its breath leaves things slow and weak." },
];
export const speciesOf = (rec) => SPECIES[rec.species] ?? SPECIES[0];
const step = (level, shift) => Math.max(0, Math.min(7, level + 1 + shift));
export const groundStep = (rec) => step(rec.stats.speed, speciesOf(rec).ground);
export const airStep = (rec) => step(rec.stats.speed, speciesOf(rec).air);
export const healthStep = (rec) => step(rec.stats.vigor, speciesOf(rec).vigor);

// Who it is. Rolled when it hatches and never changes.
export const TEMPERS = {
  proud: { name: "Proud", desc: "Holds itself apart. Slow to trust, hates being ordered about, never forgets a slight." },
  curious: { name: "Curious", desc: "Into everything. Bonds fast, wanders, brings you things." },
  gentle: { name: "Gentle", desc: "Stays close. Frets when you are hurt. Slow to fight." },
  fierce: { name: "Fierce", desc: "Spoiling for it. First to defend you, quick to bite a stranger." },
  wary: { name: "Wary", desc: "Watches everything. Senses danger from far off, startles easily." },
};
export const newMind = () => ({
  temper: Object.keys(TEMPERS)[Math.floor(Math.random() * 5)],
  hunger: 30, mood: 20, // hunger 0 (full) .. 100 (starving); mood -100 (sullen) .. 100 (devoted)
  fav: FOODS[Math.floor(Math.random() * (FOODS.length - 1))], favKnown: false,
  grudges: {}, // player id -> { name, until }
  lastSeen: 0, sulking: 0, giftAt: 0,
});
export const STAGES = ["hatchling", "fledgling", "adult"];
export const STAGE_NAMES = { egg: "Egg", hatchling: "Hatchling", fledgling: "Fledgling", adult: "Adult" };
export const FOODS = ["minecraft:beef", "minecraft:porkchop", "minecraft:mutton", "minecraft:chicken", "minecraft:rabbit",
  "minecraft:cod", "minecraft:salmon", "minecraft:rotten_flesh"];

// What the Roost can train. Each level costs one training point (one point per dragon level).
export const TRAINING = {
  wings: { name: "Wings", max: 5, desc: "+3 seconds of flight" },
  speed: { name: "Speed", max: 5, desc: "faster on the ground and in the air" },
  vigor: { name: "Vigor", max: 5, desc: "more health" },
  breath: { name: "Breath", max: 3, desc: "fire breath (Dragon Horn while flying); each level burns hotter" },
};

export const newDragon = (owner, ownerName, now) => ({
  owner, ownerName, name: "Dragon Egg", species: Math.floor(Math.random() * SPECIES.length),
  stage: "egg", status: "carried", // carried -> warming -> out | roosted | wounded
  bond: 0, level: 1, xp: 0, tp: 0, stats: { wings: 0, speed: 0, vigor: 0, breath: 0 },
  saddled: false, order: "follow", gen: 0, takenAt: now,
});

export const xpToNext = (level) => 30 + level * 15;

export function addXp(rec, amount) {
  let levels = 0;
  if (rec.level >= DRAGON_SETTINGS.maxLevel) return levels;
  rec.xp += amount;
  while (rec.level < DRAGON_SETTINGS.maxLevel && rec.xp >= xpToNext(rec.level)) {
    rec.xp -= xpToNext(rec.level);
    rec.level++;
    rec.tp++;
    levels++;
  }
  if (rec.level >= DRAGON_SETTINGS.maxLevel) rec.xp = 0;
  return levels;
}

export const addBond = (rec, amount) => (rec.bond = Math.max(0, Math.min(100, rec.bond + amount)));

export const flightTicks = (rec) => (DRAGON_SETTINGS.flightSeconds + speciesOf(rec).flight + DRAGON_SETTINGS.flightSecondsPerWings * (rec.stats?.wings ?? 0)) * 20;

// The stage this dragon has earned by age and bond. It never goes backwards.
export function earnedStage(rec, now) {
  if (rec.stage === "egg" || rec.stage === "adult") return rec.stage;
  const S = DRAGON_SETTINGS;
  const days = (now - (rec.bornAt ?? now)) / DAY;
  if (days >= S.adultDays && rec.bond >= S.adultBond) return "adult";
  if (rec.stage === "fledgling" || (days >= S.fledgeDays && rec.bond >= S.fledgeBond)) return "fledgling";
  return "hatchling";
}

// What still stands between this dragon and its next stage, as a sentence for the menus
export function nextStageNeeds(rec, now) {
  const S = DRAGON_SETTINGS;
  if (rec.stage === "adult" || rec.stage === "egg") return "";
  const [next, days, bond] = rec.stage === "hatchling" ? ["Fledgling", S.fledgeDays, S.fledgeBond] : ["Adult", S.adultDays, S.adultBond];
  const left = Math.ceil(days - (now - (rec.bornAt ?? now)) / DAY);
  const parts = [];
  if (left > 0) parts.push(`${left} more day${left === 1 ? "" : "s"}`);
  if (rec.bond < bond) parts.push(`bond ${Math.floor(rec.bond)}/${bond}`);
  return parts.length ? `${next} needs ${parts.join(" and ")}` : `${next} soon`;
}

export function trainProblem(rec, key) {
  const t = TRAINING[key];
  if (!t) return "No such training.";
  if (rec.stage === "egg") return "It hasn't hatched.";
  if ((rec.stats[key] ?? 0) >= t.max) return `${t.name} is fully trained.`;
  if (rec.tp < 1) return "No training points. Fly, feed and ride it to earn levels.";
  if (key !== "vigor" && rec.stage !== "adult") return "Only an adult can learn that. A young dragon can train Vigor.";
  return undefined;
}

export function train(rec, key) {
  if (trainProblem(rec, key)) return false;
  rec.stats[key]++;
  rec.tp--;
  return true;
}

export const bar = (value, max, cells = 20) => {
  const full = Math.max(0, Math.min(cells, Math.round((value / Math.max(max, 1)) * cells)));
  return `§a${"|".repeat(full)}§8${"|".repeat(cells - full)}`;
};
