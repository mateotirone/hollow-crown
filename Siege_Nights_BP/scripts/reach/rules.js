// The Reach: every number and rule behind how sieges escalate. No Minecraft in this file, so the
// offline check can test all of it. The game side is index.js.
//
// One number, the Reach (0 to 100), is shared by the whole world. The story pushes it up, players
// slow it down, and it decides which STAGE the world is in. The stage decides how often sieges
// come and how a siege night runs. Change a stage by editing its row below.

export const REACH = {
  // ----- the clock (Minecraft time of day: 0 = 6:00, 1000 = one hour, 13000 = nightfall) -----
  duskTime: 12000, // 18:00, the first omen
  nightTime: 13000,
  tollTime: 21284, // 3:17, the last wave of every clocked siege
  hour: 1000, // one wave an hour, each at seventeen minutes past
  musterLead: 900, // the horn sounds this long before the first wave (45 seconds)

  // ----- what moves the Reach -----
  gain: {
    dawn: 1, // every dawn, whatever anyone does
    boss: 10, // each under-boss, the first time it falls
    keepFallen: 3, // a settlement lost in a siege
    seepOpened: 1,
    seepClosed: -2,
    nightHeld: -1, // a siege night that ended with the raiders beaten
  },
  bosses: ["reeve", "huntsman", "bride", "seneschal", "mother", "warlord_king"],
  choir: "choir", // when it falls the Reach jumps to the Long Night's threshold
  source: "morvane", // when he falls, it is over

  // ----- a knock: a small raid on a night that isn't a siege night -----
  probe: { waves: 1, mult: 0.4, firstHour: 15284, hours: 6 }, // one wave between 21:17 and 2:17

  // ----- the Long Night (stage 5) -----
  long: {
    mult: 2.4, // army size at pressure 0 ...
    perPressure: 0.15, // ... plus this per point of pressure
    maxPressure: 12,
    lull: 2400, // seconds x 20 between daytime tides at pressure 0 (2 minutes) ...
    minLull: 1200, // ... shrinking to this (1 minute)
    tideShare: 0.2, // a daytime tide is this share of the night's budget
    greySky: true, // it rains for as long as the Long Night lasts
    strayRange: 80, // by day, raiders with no player this close give up
    picketEvery: 1200, // how often a traveller outside any settlement may be found (ticks)
    picketChance: 0.35,
    picketCap: 6,
  },

  // ----- after the source is rectified (stage 6) -----
  musterCycle: 5, // one raid somewhere in every 5 nights

  liveCap: 40, // raiders alive per besieged settlement before new waves shrink (keeps a Realm from choking)

  // ----- twists the module adds -----
  risenChance: 0.25, // "The Fallen Rise": share of slain raiders that get up once
  pullEvery: 400, // "The Pull": how often defenders are tugged toward the wall (ticks)
};

// harden: 0 nothing, 1 a little more health, 2 more health and some armour, 3 that and they hit harder
// hollow: Hollow soldiers added to each wave (and to the 3:17 wave) for every settlement
export const STAGES = [
  {
    id: 1, key: "counted", name: "The Counted Nights", from: 0, gate: {},
    rhythm: "Every third night", waves: 3, mult: 1, stolenMult: 0, probe: 0, twists: 0, harden: 0,
    hollow: { wave: 0, toll: 0 }, captain: false,
    about: "One night in three belongs to them. They come as an army of men, three waves, the last at 3:17.",
  },
  {
    id: 2, key: "leaning", name: "The Leaning", from: 20, gate: { bosses: 1 },
    rhythm: "Every third night, and sometimes a knock in between", waves: 4, mult: 1.3, stolenMult: 0, probe: 0.2, twists: 1, harden: 1,
    hollow: { wave: 0, toll: 2 }, captain: false,
    about: "Still the third night, but heavier, and something that is not a man comes with the last wave.",
  },
  {
    id: 3, key: "miscount", name: "The Miscount", from: 40, gate: { bosses: 3 },
    rhythm: "Two nights in three, and you can't tell which", waves: 4, mult: 1.5, stolenMult: 1.1, probe: 0.25, twists: 1, harden: 1,
    hollow: { wave: 1, toll: 3 }, captain: true,
    about: "They take a night they are not owed. The third night is still the worst.",
  },
  {
    id: 4, key: "uncounted", name: "The Uncounted Nights", from: 60, gate: { bosses: 5 },
    rhythm: "Every night", waves: 5, mult: 1.9, stolenMult: 1.4, probe: 0, twists: 2, harden: 2,
    hollow: { wave: 3, toll: 5 }, captain: true,
    about: "Nobody counts any more. Every night, five waves, and fewer of them are men.",
  },
  {
    id: 5, key: "long", name: "The Long Night", from: 85, gate: { choir: true },
    rhythm: "Without end", waves: 6, mult: 2.4, stolenMult: 2.4, probe: 0, twists: 2, harden: 3,
    hollow: { wave: 5, toll: 8 }, captain: true,
    about: "Dawn does not send them home. It ends when you break them, and it starts again at dusk.",
  },
  {
    id: 6, key: "after", name: "The Quiet After", from: 0, gate: { source: true },
    rhythm: "Now and then, when someone wants what you have", waves: 4, mult: 1.4, stolenMult: 0, probe: 0, twists: 1, harden: 1,
    hollow: { wave: 0, toll: 0 }, captain: false,
    about: "The knocking has stopped. What comes for your walls now is only people.",
  },
];

export const LONG = 5, AFTER = 6;
export const stage = (id) => STAGES[Math.max(1, Math.min(STAGES.length, id)) - 1];
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// facts = { bosses: how many under-bosses have fallen, choir: bool, source: bool }
export const gateOpen = (s, facts) =>
  (!s.gate.bosses || (facts.bosses ?? 0) >= s.gate.bosses) && (!s.gate.choir || !!facts.choir) && (!s.gate.source || !!facts.source);

// Stages never go backwards. The source falling ends it whatever the Reach says.
export function stageFor(reach, facts, current = 1) {
  if (facts.source) return AFTER;
  if (current >= AFTER) return AFTER;
  let best = current;
  for (const s of STAGES) {
    if (s.id === AFTER || s.id <= best) continue;
    if (s.id !== best + 1) break; // one step at a time, in order
    if (reach >= s.from && gateOpen(s, facts)) best = s.id;
    else break;
  }
  return best;
}

// The Reach waits just under a stage whose part of the story hasn't happened yet
export function capReach(reach, facts) {
  let cap = 100;
  for (const s of STAGES) {
    if (s.id === 1 || s.id === AFTER) continue;
    if (!gateOpen(s, facts)) { cap = s.from - 1; break; }
  }
  return clamp(Math.round(reach), 0, cap);
}

// A steady "random" number from 0 to 1 for a given day, so a night's fate doesn't change while you watch it
export function dayRoll(day, salt = 0, k = 0) {
  let h = 2166136261;
  for (const n of [day, salt, k]) {
    h = Math.imul(h ^ (n & 0xffff), 16777619);
    h = Math.imul(h ^ (n >>> 16), 16777619);
    h ^= h >>> 15;
    h = Math.imul(h, 2246822519);
    h ^= h >>> 13;
  }
  h = Math.imul(h ^ (h >>> 16), 3266489917);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

// What kind of night is this?
//   "counted"  the third night, owed by the truce: the full siege
//   "stolen"   a siege on a night that isn't owed
//   "probe"    a knock: one small wave at some hour
//   "long"     the Long Night
//   "muster"   after the story: ordinary enemies
//   undefined  a quiet night
export function nightKind(day, stageId, { firstDay = 5, every = 3, salt = 0 } = {}) {
  if (day < firstDay) return undefined;
  const s = stage(stageId);
  if (stageId === AFTER) {
    const cycle = Math.floor(day / REACH.musterCycle);
    return day % REACH.musterCycle === Math.floor(dayRoll(cycle, salt, 5) * REACH.musterCycle) ? "muster" : undefined;
  }
  if (stageId === LONG) return "long";
  if (day % every === 0) return "counted";
  if (stageId === 4) return "stolen";
  if (stageId === 3 && every > 1) {
    // one of the nights between two counted nights is taken; which one changes every time
    const cycle = Math.floor(day / every);
    const taken = 1 + Math.floor(dayRoll(cycle, salt, 3) * (every - 1));
    if (day % every === taken) return "stolen";
  }
  return dayRoll(day, salt, 1) < s.probe ? "probe" : undefined;
}

export const isSiegeKind = (kind) => !!kind && kind !== "probe";

export const pressureMult = (pressure) => REACH.long.mult + REACH.long.perPressure * clamp(pressure, 0, REACH.long.maxPressure);
export const tideLull = (pressure) =>
  Math.round(REACH.long.lull - (REACH.long.lull - REACH.long.minLull) * (clamp(pressure, 0, REACH.long.maxPressure) / REACH.long.maxPressure));

// How tonight's siege runs: { waves, mult, clock (waves on the hour, ending at 3:17), warlord (allowed) }
export function profile(kind, stageId, pressure = 0) {
  const s = stage(stageId);
  switch (kind) {
    case "counted": return { waves: s.waves, mult: s.mult, clock: true, warlord: true };
    case "stolen": return { waves: Math.max(3, s.waves - 1), mult: s.stolenMult || s.mult, clock: true, warlord: true };
    case "long": return { waves: s.waves, mult: pressureMult(pressure), clock: true, warlord: true };
    case "muster": return { waves: s.waves, mult: s.mult, clock: true, warlord: true };
    case "probe": return { waves: REACH.probe.waves, mult: REACH.probe.mult, clock: false, warlord: false };
    default: return { waves: 3, mult: s.mult, clock: false, warlord: true }; // "horn": someone called them early
  }
}

// When the horn sounds (time of day). A knock comes at its own hour.
export function openTime(kind, waves, day = 0, salt = 0) {
  if (kind === "probe") return REACH.probe.firstHour + Math.floor(dayRoll(day, salt, 2) * REACH.probe.hours) * REACH.hour - 100;
  return REACH.tollTime - (waves - 1) * REACH.hour - REACH.musterLead;
}

// When wave n of `waves` arrives (time of day). The last is always the toll.
export const waveTime = (n, waves) => REACH.tollTime - (waves - n) * REACH.hour;

// What each wave is for
const ROLES = {
  1: ["toll"],
  2: ["knock", "toll"],
  3: ["knock", "press", "toll"],
  4: ["knock", "press", "flank", "toll"],
  5: ["knock", "press", "flank", "breach", "toll"],
  6: ["knock", "press", "flank", "breach", "dark", "toll"],
};
export const WAVES = {
  knock: { name: "The Knock", weight: 0.6, line: "§7Seventeen past. A knock at the wall." },
  press: { name: "The Press", weight: 1, line: "§7Seventeen past. They come in earnest." },
  flank: { name: "The Flank", weight: 0.9, line: "§7Seventeen past. From the other side." },
  breach: { name: "The Breach", weight: 1, line: "§7Seventeen past. They have brought tools." },
  dark: { name: "The Dark Hour", weight: 0.9, line: "§7Seventeen past. The torches go low." },
  toll: { name: "The Toll", weight: 1.3, line: "§43:17" },
  tide: { name: "A Tide", weight: 0, line: "§7Daylight. They come anyway." },
};
export function waveRole(n, waves) {
  if (n > waves) return "tide";
  const list = ROLES[clamp(waves, 1, 6)];
  if (waves > 6) return n === waves ? "toll" : list[(n - 1) % 5]; // very long nights repeat the middle waves
  return list[n - 1];
}

// The share of the night's budget wave n spends. The shares of one night add up to 1.
export function waveShare(n, waves) {
  const role = waveRole(n, waves);
  if (role === "tide") return REACH.long.tideShare;
  let sum = 0;
  for (let i = 1; i <= waves; i++) sum += WAVES[waveRole(i, waves)].weight;
  return WAVES[role].weight / sum;
}

// Hollow soldiers added to a wave, per settlement
export const hollowCount = (stageId, role) => (role === "tide" ? Math.ceil(stage(stageId).hollow.wave / 2) : role === "toll" ? stage(stageId).hollow.toll : stage(stageId).hollow.wave);

// The share of the ordinary army that should be Hollow rather than men (for whoever picks the raider types)
export const hollowShare = (stageId) => [0, 0, 0, 0.3, 0.6, 1, 0][clamp(stageId, 1, 6)];

// Who the ordinary siege army is made of, for the bestiary's troop plan: shares of the raiders it swaps.
// grey = the Grey Host (men), hollow = soldiers of the Hollow itself, the rest are Choir raiders.
// swap: 0 asks for no swapped raiders at all (after the story, only ordinary people come).
export function troopMix(stageId, glimpsed) {
  if (stageId === AFTER) return { grey: 0, hollow: 0, swap: 0 };
  const hollow = glimpsed ? hollowShare(stageId) : 0;
  const grey = [0, 0.7, 0.7, 0.5, 0.3, 0, 0][clamp(stageId, 1, 6)];
  return { grey: Math.min(grey, 1 - hollow), hollow };
}
export const WATCHER_FROM_REACH = 10; // before the first Hollow soldiers come forward, one stands at the back and watches

// "21284" -> "3:17"
export function clock(time) {
  const minutes = Math.floor((((time + 6000) % 24000) / 1000) * 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

// The next day with a siege (not a knock) on it, looking at most 40 days ahead
export function nextSiege(fromDay, stageId, opts) {
  for (let day = fromDay; day < fromDay + 40; day++) if (isSiegeKind(nightKind(day, stageId, opts))) return day;
  return undefined;
}

export const NEW_MODIFIERS = {
  risen: { name: "The Fallen Rise", note: "Some of the ones you kill get up again, once" },
  pull: { name: "The Pull", note: "Now and then something tugs you toward the wall" },
};
export const HOLLOW_TWISTS_FROM = 3; // the two twists above only appear from this stage

// Omens: what a player is told as a siege night comes on. Nothing here names what is coming.
export const DUSK_LINES = {
  counted: ["§8No bell is rung this evening. It is the third night.", "§8The bell ropes hang still. You have counted, and it is the third night."],
  stolen: ["§8No bell is rung this evening. You count again. It is not the third night.", "§8The bell ropes hang still. It is the wrong night for that."],
  uncounted: ["§8Nobody rings the bells any more."],
  long: ["§8The light goes. It does not feel like evening. It feels like a door closing."],
  muster: ["§7Smoke on the road. Someone means to try your walls tonight."],
};
export const HOUR_LINES = [
  "§8The dogs have gone under the porches.",
  "§8The well is very still.",
  "§8Somebody is humming. You look, and nobody is.",
  "§8Your torches lean, all of them, the same way.",
  "§8Seventeen past. Nothing yet.",
  "§8The animals are all facing the same wall.",
  "§8You can hear your own gate creak, and there is no wind.",
  "§8Far off, something is keeping time.",
];
export function duskLine(kind, stageId, day = 0) {
  const key = kind === "long" ? "long" : kind === "muster" ? "muster" : stageId >= 4 ? "uncounted" : kind === "stolen" ? "stolen" : "counted";
  const lines = DUSK_LINES[key];
  return lines[Math.floor(dayRoll(day, 0, 9) * lines.length)];
}

export const CAPTAIN_NAMES = ["Harrow", "Sexton", "Thurl", "Ansgar", "Wend", "Orlec", "Maud", "Tamsin", "Brec", "Isolt"];
export const CAPTAIN_TITLES = ["of the Count", "Seventeen-Past", "the Patient", "Who Keeps the Hour", "the Unrung", "of the Low Bell"];
