import { HALL, SLOTS, place } from "../settle/layout.js";

// Rival Lords: the pure part (names, who settles where, how they grow). Runs in Node too.
// A Rival Lord is an NPC who holds a plot nobody claimed, so the map is alive in single-player.

export const RIVALS = {
  mode: "few", // "none" | "few" | "all": how many empty plots get a lord. /scriptevent siege:rivals changes it in a world.
  few: 3, // lords in "few" mode
  leaveFree: 2, // plots always left empty for players, whatever the mode
  arriveEveryDays: 1, // at most one new lord settles per this many in-game days
  holdChance: { steady: 0.7, proud: 0.8, grasping: 0.75, kindly: 0.65 }, // chance a lord's keep holds on a siege night
  tierWins: [0, 3, 6, 10], // wins for Hamlet, Town, City, Castle (the same as players)
  radius: [32, 48, 64, 80], // their land, by tier (the same as players)
  defenders: [6, 10, 14, 18], // soldiers who answer when a player lays siege, by tier
  siegeMinutes: 10, // a siege on a lord fails after this long
  siegeCooldownDays: 1, // a lord can't be besieged again for this long after holding
  spoils: [12, 24, 40, 64], // emeralds for toppling a lord, by tier
  wallLevel: [2, 4, 7, 9], // the settlement wall a lord raises, by tier (walls: settle/walldata.js)
  buildRange: 96, // their buildings only rise while a player is this close (so chunks are loaded)
};

export const TIER_NAMES = ["Hamlet", "Town", "City", "Castle"];
export const TEMPERAMENTS = ["steady", "proud", "grasping", "kindly"];
export const ROLES = ["knight", "marked"]; // the same ids the Tree of Oaths uses

const FIRST = ["Aldric", "Maren", "Osric", "Ysolde", "Bram", "Edda", "Corwin", "Hesper", "Lorcan", "Sunniva", "Tobias", "Wilmot", "Rhosyn", "Garrick", "Ione", "Halvard"];
const HOUSE = ["Vane", "Ashdown", "Merrow", "Holt", "Carrow", "Thistlewood", "Greywater", "Stannard", "Fenwick", "Dunmore", "Harrow", "Sable"];
const TITLE = { knight: ["Ser", "Dame", "Captain"], marked: ["Magister", "Warden", "Sister", "Brother"] };

// A small repeatable random number from a string, 0..1
export function roll(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const from = (list, seed) => list[Math.floor(roll(seed) * list.length)];

export function makeLord(plot, seed, taken = []) {
  const s = `${seed}|${plot.name}`;
  const role = from(ROLES, `${s}|role`);
  let name;
  for (let n = 0; n < 20 && (!name || taken.includes(name)); n++) {
    name = `${from(TITLE[role], `${s}|t${n}`)} ${from(FIRST, `${s}|f${n}`)} ${from(HOUSE, `${s}|h${n}`)}`;
  }
  return {
    id: plot.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    plot: plot.name, region: plot.region, x: plot.x, y: plot.y, z: plot.z,
    name, role, temperament: from(TEMPERAMENTS, `${s}|temper`),
    tier: 0, wins: 0, nights: 0, held: 0, // held = sieges by players this lord has beaten off
    built: { hall: 0, parts: [] }, relations: {},
  };
}

export const tierForWins = (wins) => RIVALS.tierWins.reduce((best, need, i) => (wins >= need ? i : best), 0);
export const radiusOf = (lord) => RIVALS.radius[lord.tier] ?? RIVALS.radius[0];

// How many lords the map should have: { free plots, lords now } -> number
export function wanted(mode, freePlots, lordsNow) {
  const room = Math.max(0, freePlots - RIVALS.leaveFree);
  if (mode === "none") return 0;
  if (mode === "few") return Math.min(RIVALS.few, lordsNow + room);
  return lordsNow + room;
}

// One siege night passes for a lord. Returns true if they grew a tier.
export function night(lord, nightNumber) {
  lord.nights++;
  if (roll(`${lord.id}|night|${nightNumber}`) >= (RIVALS.holdChance[lord.temperament] ?? 0.7)) return false;
  lord.wins++;
  const tier = tierForWins(lord.wins);
  if (tier === lord.tier) return false;
  lord.tier = tier;
  return true;
}

// ---------- their settlement, in template stages ----------
// A lord builds on the same mapped layout a player's settlement uses (settle/layout.js), turned to the
// plot's gate, so a player who takes the settlement over finds every building on its proper spot.
// STAGES[tier] = the layout slots that open at that tier.
export const STAGES = [0, 1, 2, 3].map((tier) => SLOTS.filter((slot) => slot.tier === tier));
export const hallSpot = (lord, gateDir) => place({ x: lord.x, z: lord.z }, gateDir, HALL);
export const partSpot = (lord, gateDir, slot) => place({ x: lord.x, z: lord.z }, gateDir, slot);
export const partKey = (tier, i) => `${tier}:${i}`;

// The next thing this lord's settlement is missing: { hall: level } or { part, tier, i }, or undefined
export function nextPiece(lord) {
  for (let tier = 0; tier <= lord.tier; tier++) {
    if (lord.built.hall < tier + 1) return { hall: tier + 1 };
    for (let i = 0; i < STAGES[tier].length; i++) {
      if (!lord.built.parts.includes(partKey(tier, i))) return { part: STAGES[tier][i], tier, i };
    }
  }
  return undefined;
}

// ---------- what they say ----------
export const LINES = {
  steady: [
    "You hold your ground, I hold mine. That is how neighbours last out here.",
    "The bell tolled again last night. My walls stood. Did yours?",
    "I have no quarrel with you. Give me no cause to find one.",
  ],
  proud: [
    "You stand on my land. Say what you came to say.",
    "They will call this the first hall of the realm one day. Remember you saw it small.",
    "I have beaten off worse than you. Mind your tone.",
  ],
  grasping: [
    "Everything has a price. Your plot too, I expect.",
    "Fine walls you are raising. A pity if they changed hands.",
    "I count what I have every night. Then I count what others have.",
  ],
  kindly: [
    "Come in from the road. It is no weather to be out in after dark.",
    "If the night goes badly for you, my gate is the nearer one.",
    "We all hear it, you know. The quiet before the bell. You are not alone in that.",
  ],
};

// ---------- handing a settlement on ----------
// What a lord leaves behind on a plot: whoever holds the plot next (a player, or another lord) starts from it.
export function estateOf(lord) {
  return {
    plot: lord.plot, x: lord.x, z: lord.z, from: lord.name, tier: lord.tier, wins: lord.wins,
    hall: lord.built.hall, parts: [...lord.built.parts], hallAt: lord.hallAt, hallF: lord.hallF, gateDir: lord.gateDir,
  };
}

// The sieges a player's keep must have won to stand at a lord's tier (never lowers what the player has)
export const winsForEstate = (estate, winsNow = 0) => Math.max(winsNow, estate.wins ?? 0, RIVALS.tierWins[estate.tier] ?? 0);

// A new lord on a plot with an estate carries on from it
export function takeEstate(lord, estate) {
  lord.tier = estate.tier; lord.wins = Math.max(estate.wins ?? 0, RIVALS.tierWins[estate.tier] ?? 0);
  lord.built = { hall: estate.hall, parts: [...estate.parts] };
  lord.hallAt = estate.hallAt; lord.hallF = estate.hallF; lord.gateDir = estate.gateDir;
  return lord;
}
