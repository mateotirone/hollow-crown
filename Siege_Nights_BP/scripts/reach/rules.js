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
  choir: "choir", // an under-boss met inside the Long Night; when it falls the besiegers press harder (long.choirPressure)
  source: "morvane", // when he falls, it is over

  // ----- the wait between the first omen at dusk and the horn (Mateo: long at first, shorter later) -----
  // A settlement's first sieges keep the whole evening of omens. After that the evening hurries, so it is never just waiting.
  omens: { fullFor: 3, halfFor: 3, half: 3600, short: 1800 }, // sieges seen -> the wait in ticks (20 a second)

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
    stormHold: 1500, // a thunderstorm rolls in with each wave and tide and eases this long after (Mateo: storms that come and go)
    choirPressure: 3, // the Choir falling inside the Long Night adds this much pressure at once
    strayRange: 80, // by day, raiders with no player this close give up
    picketEvery: 1200, // how often a traveller outside any settlement may be found (ticks)
    picketChance: 0.35,
    picketCap: 6,
  },

  // ----- after the source is rectified (stage 6) -----
  // Raids are sent by the rival towns at random (Mateo: "They come randomly from the CPU towns").
  muster: { minGap: 2, maxGap: 9, firstHour: 13284, hours: 7 }, // nights between raids; the first wave at 19:17 ... 1:17

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
    id: 5, key: "long", name: "The Long Night", from: 85, gate: { rift: true },
    rhythm: "Without end", waves: 6, mult: 2.4, stolenMult: 2.4, probe: 0, twists: 2, harden: 3,
    hollow: { wave: 5, toll: 8 }, captain: true,
    about: "Dawn does not send them home. It ends when you break them, and it starts again at dusk.",
  },
  {
    id: 6, key: "after", name: "The Quiet After", from: 0, gate: { source: true },
    rhythm: "When a rival town wants what you have", waves: 4, mult: 1.4, stolenMult: 0, probe: 0, twists: 1, harden: 1,
    hollow: { wave: 0, toll: 0 }, captain: false,
    about: "The knocking has stopped. What comes for your walls now is only people.",
  },
];

export const LONG = 5, AFTER = 6;
export const stage = (id) => STAGES[Math.max(1, Math.min(STAGES.length, id)) - 1];
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// facts = { bosses: how many under-bosses have fallen, rift: the Rift has been opened, source: bool }
export const gateOpen = (s, facts) =>
  (!s.gate.bosses || (facts.bosses ?? 0) >= s.gate.bosses) && (!s.gate.rift || !!facts.rift) && (!s.gate.source || !!facts.source);

// Stages never go backwards. The source falling ends it whatever the Reach says.
export function stageFor(reach, facts, current = 1) {
  if (facts.source) return AFTER;
  if (current >= AFTER) return AFTER;
  if (facts.rift) return Math.max(current, LONG); // opening the Rift starts the Long Night, whatever the count was
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
  if (facts.rift) return clamp(Math.round(reach), 0, 100);
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
//   "muster"   after the story: a rival town's army, on the night index.js rolled (musterDay)
//   undefined  a quiet night
export function nightKind(day, stageId, { firstDay = 5, every = 3, salt = 0, musterDay } = {}) {
  if (day < firstDay) return undefined;
  const s = stage(stageId);
  if (stageId === AFTER) return day === musterDay ? "muster" : undefined;
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

// How many nights until the rival towns try again, counted from the night of `day`. Never the same wait twice running.
export function musterGap(day, salt = 0, last = 0) {
  const { minGap, maxGap } = REACH.muster;
  const span = maxGap - minGap + 1;
  let gap = minGap + Math.floor(dayRoll(day, salt, 5) * span);
  if (gap === last) gap = minGap + ((gap - minGap + 1 + Math.floor(dayRoll(day, salt, 6) * (span - 1))) % span);
  return gap;
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
    case "muster": return { waves: s.waves, mult: s.mult, clock: false, warlord: true }; // people keep no clock
    case "probe": return { waves: REACH.probe.waves, mult: REACH.probe.mult, clock: false, warlord: false };
    default: return { waves: 3, mult: s.mult, clock: false, warlord: true }; // "horn": someone called them early
  }
}

// When the horn sounds (time of day). A knock comes at its own hour.
export function openTime(kind, waves, day = 0, salt = 0) {
  if (kind === "probe") return REACH.probe.firstHour + Math.floor(dayRoll(day, salt, 2) * REACH.probe.hours) * REACH.hour - 100;
  if (kind === "muster") return REACH.muster.firstHour + Math.floor(dayRoll(day, salt, 7) * REACH.muster.hours) * REACH.hour - REACH.musterLead;
  return REACH.tollTime - (waves - 1) * REACH.hour - REACH.musterLead;
}

// The wait from the first omen to the horn that a settlement which has seen `seen` sieges gets, in ticks
export function omenWait(seen, full) {
  const o = REACH.omens;
  return Math.min(full, seen < o.fullFor ? full : seen < o.fullFor + o.halfFor ? o.half : o.short);
}
// How fast the evening runs between dusk and the horn (1 = as it falls). `seen` is the greenest settlement's count.
export const duskSpeed = (seen, open) => {
  const full = Math.max(1, open - REACH.duskTime);
  return Math.max(1, Math.round((full / omenWait(seen, full)) * 10) / 10);
};

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
  feint: { name: "The Feint", weight: 0.5, line: "§7Seventeen past. Noise at the far wall." },
  ring: { name: "The Ring", weight: 0.8, line: "§7Seventeen past. From everywhere, thinly." },
  quiet: { name: "The Held Breath", weight: 0.05, line: "§7Seventeen past. Nothing comes. You would rather something did." },
  toll: { name: "The Toll", weight: 1.3, line: "§43:17" },
  tide: { name: "A Tide", weight: 0, line: "§7Daylight. They come anyway." },
};
const baseRoles = (waves) => {
  const list = ROLES[clamp(waves, 1, 6)];
  if (waves <= 6) return [...list];
  return Array.from({ length: waves }, (_, i) => (i === waves - 1 ? "toll" : ROLES[6][i % 5])); // very long nights repeat the middle waves
};

// Night shapes: the same number of waves, put together differently. No shape comes twice in a row,
// so two sieges in a row never play out the same way. `from` is the first stage that uses the shape.
const middle = (list, fn) => list.map((r, i) => (i === 0 || i === list.length - 1 ? r : fn(r, i)));
// kind: how the night feels, in the Storyteller's words (fight, mystery, journey, quiet, social, build). Shape ids are saved; never rename one.
export const SHAPES = {
  old: { kind: "fight", name: "The Old Count", from: 1, min: 1, about: "A knock, then the press, then the toll.", roles: (w) => baseRoles(w) },
  feint: { kind: "mystery", name: "The Feint", from: 1, min: 3, about: "The first wave was noise at the wrong wall.", roles: (w) => ["feint", ...baseRoles(w).slice(1)] },
  hammer: { kind: "fight", name: "The Hammer", from: 1, min: 3, about: "They led with their strength and knocked afterwards.", roles: (w) => { const l = baseRoles(w); [l[0], l[1]] = [l[1], l[0]]; return l; } },
  ring: { kind: "journey", name: "The Ring", from: 1, min: 3, about: "Every wave came from every side.", roles: (w) => baseRoles(w).map((r) => (r === "toll" ? r : "ring")) },
  breath: { kind: "quiet", name: "The Held Breath", from: 1, min: 3, about: "Hours of nothing, and then all of it at once.", roles: (w) => baseRoles(w).map((r, i) => (i < Math.ceil((w - 1) / 2) ? "quiet" : r === "knock" ? "press" : r)) },
  sappers: { kind: "build", name: "The Sappers' Night", from: 2, min: 3, about: "They came for the wall and not for you.", roles: (w) => middle(baseRoles(w), () => "breach") },
  blind: { kind: "mystery", name: "The Blind Night", from: 3, min: 4, about: "The torches kept going low.", roles: (w) => middle(baseRoles(w), (r, i) => (i % 2 ? "dark" : r)) },
};

// Tonight's shape: one the stage has opened, that fits the wave count, and is not the one from last time
export function pickShape(day, salt, stageId, waves, last) {
  const fits = Object.keys(SHAPES).filter((id) => SHAPES[id].from <= stageId && SHAPES[id].min <= waves);
  const pool = fits.filter((id) => id !== last);
  const from = pool.length ? pool : fits.length ? fits : ["old"];
  return from[Math.floor(dayRoll(day, salt, 31) * from.length)];
}

export function waveRole(n, waves, shape = "old") {
  if (n > waves) return "tide";
  return (SHAPES[shape] ?? SHAPES.old).roles(waves)[n - 1];
}

// The share of the night's budget wave n spends. The shares of one night add up to 1.
export function waveShare(n, waves, shape = "old") {
  if (n > waves) return REACH.long.tideShare;
  const roles = (SHAPES[shape] ?? SHAPES.old).roles(waves);
  let sum = 0;
  for (const r of roles) sum += WAVES[r].weight;
  return WAVES[roles[n - 1]].weight / sum;
}

// Hollow soldiers added to a wave, per settlement
export const hollowCount = (stageId, role) => (role === "quiet" ? 0 : role === "tide" ? Math.ceil(stage(stageId).hollow.wave / 2) : role === "toll" ? stage(stageId).hollow.toll : stage(stageId).hollow.wave);

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
  counted: [
    "§8No bell is rung this evening. It is the third night.",
    "§8The bell ropes hang still. You have counted, and it is the third night.",
    "§8Somebody has tied the clapper of the bell with cloth. It is the third night.",
    "§8The ringer went home early and did not say why. You know why. It is the third night.",
  ],
  stolen: [
    "§8No bell is rung this evening. You count again. It is not the third night.",
    "§8The bell ropes hang still. It is the wrong night for that.",
    "§8You counted this morning and you count now. The numbers agree. The evening does not.",
    "§8It is not the third night. The dogs have decided that it is.",
  ],
  uncounted: [
    "§8Nobody rings the bells any more.",
    "§8Evening. Nobody looks at the bell.",
    "§8Someone has scratched a tally on the gatepost and then scratched it out.",
    "§8The light goes. People are already at the wall. Nobody told them to be.",
  ],
  long: [
    "§8The light goes. It does not feel like evening. It feels like a door closing.",
    "§8Dusk. You notice you have stopped calling it dusk.",
    "§8The storm has gone quiet. It is only waiting, like the rest of them.",
    "§8It gets dark the way a room does when someone stands in the doorway.",
  ],
  muster: [
    "§7Smoke on the road. Someone means to try your walls tonight.",
    "§7A rider turned back at the sight of your gate, and rode off fast. Expect company tonight.",
    "§7Cookfires, out past the fields, where nobody lives. They will come tonight.",
    "§7A stranger was counting your towers this afternoon. Tonight, then.",
  ],
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
  "§8A child asks what night it is, and three people answer at once.",
  "§8The water in the trough is trembling. Only a little.",
  "§8You count your arrows. You count them again.",
  "§8There is a smell like a cellar that has been opened.",
  "§8Every door on the street is shut. You did not hear them shut.",
  "§8The guards have stopped talking.",
  "§8Something small runs past you, away from the wall, and does not stop.",
  "§8The moon is up. You would not swear it is where it was last night.",
];
// What happens in the world with each hour line, in the same order (Mateo: omens you see and hear, the text is the backup).
// The game side (omens.js) performs them around each player who is inside a settlement. Ids are for the test command.
export const HOUR_ACTS = [
  "pets_hide", // dogs and cats bolt away from the wall and cower
  "stillness", // every sound stops for a moment
  "humming", // the hum, from nowhere in particular
  "torches_lean", // flames at every torch and lantern nearby drift the same way
  "far_bell", // a single far bell
  "animals_face", // livestock turn to face one wall and hold still
  "gate_creak", // a door creaks from the wall side, with no wind
  "ticking", // something far off keeps time
  "voices", // the townsfolk all speak at once
  "water_trembles", // ripples on any water nearby
  "arrows", // the sound of someone counting arrows
  "cellar", // cold dust drifts up from the ground
  "doors_shut", // every open door nearby shuts
  "guards_quiet", // guards turn to the wall and stop
  "small_thing", // something small runs past, away from the wall
  "light_changes", // the light dips for a breath
];
export const DUSK_ACT = "torches_gutter"; // at dusk every flame nearby gutters at once
// The wall the omens point at tonight: one of the four sides, fixed for the evening
export const omenSide = (day, salt = 0) => Math.floor(dayRoll(day, salt, 22) * 4) * (Math.PI / 2);
// The hour's omen: its line and what happens with it. Never the same one twice in an evening.
export function hourOmen(day, salt, hour) {
  const line = hourLine(day, salt, hour);
  const i = HOUR_LINES.indexOf(line);
  return { id: HOUR_ACTS[i], line };
}

export function duskLine(kind, stageId, day = 0) {
  const key = kind === "long" ? "long" : kind === "muster" ? "muster" : stageId >= 4 ? "uncounted" : kind === "stolen" ? "stolen" : "counted";
  const lines = DUSK_LINES[key];
  return lines[day % lines.length]; // four lines and sieges at most three days apart: never the same line two sieges running
}
// What the night watch says once the count can't be trusted (Mateo: a hint, never a date).
// near: tonight or tomorrow. soon: two or three nights. far: longer, or nothing in sight.
export const WATCH_HINTS = {
  near: [
    "The watch is uneasy tonight.",
    "The guards have doubled the torches and will not say why.",
    "Nobody on the wall is sitting down.",
    "The sergeant has counted the arrows twice. He is counting them again.",
  ],
  soon: [
    "The watch is restless, but not yet afraid.",
    "The guards keep looking at the road.",
    "Somebody has been sharpening things. Nobody ordered it.",
    "The watch says nothing is wrong. They say it a little too quickly.",
  ],
  far: [
    "The watch is easy. They are playing dice.",
    "The guards are bored. Be glad of it.",
    "Somebody on the wall is singing, badly. Nobody stops him.",
    "The watch has nothing to report, and looks as if it means it.",
  ],
};
export const watchBand = (nights) => (nights === undefined || nights > 3 ? "far" : nights > 1 ? "soon" : "near");
// The hint for a night that is `nights` away. A new line each day, so it is never yesterday's.
export function watchHint(nights, day = 0) {
  const lines = WATCH_HINTS[watchBand(nights)];
  return lines[day % lines.length];
}

// One line an hour, and never the same line twice in one evening
export function hourLine(day, salt, hour) {
  const start = Math.floor(dayRoll(day, salt, 20) * HOUR_LINES.length);
  const stride = 1 + 2 * Math.floor(dayRoll(day, salt, 21) * (HOUR_LINES.length / 2)); // odd, so it visits every line
  return HOUR_LINES[(start + hour * stride) % HOUR_LINES.length];
}

// Things a player can earn once from siege nights. Each is named, kept for good, and shown at the Keep Banner.
export const HONOURS = {
  first_held: "Held the Third Night",
  stolen_held: "Held a Night That Was Not Owed",
  knock_answered: "Answered a Knock",
  glimpse: "Stood at the Wall When They First Came",
  captain_slain: "Brought Down a Captain at 3:17",
  nemesis_slain: "Finished What a Captain Started",
  long_broken: "Broke a Long Night",
  long_carried: "Broke a Siege That Had Seen the Dawn",
  remembered: "Rang the Bell on Purpose",
  ...Object.fromEntries(Object.entries(SHAPES).map(([id, sh]) => [`shape_${id}`, `Held ${sh.name}`])),
};
export const NEMESIS = { perEscape: 0.1, maxEscapes: 3 }; // a captain you let live comes back, with a bigger army each time

export const CAPTAIN_NAMES = ["Harrow", "Sexton", "Thurl", "Ansgar", "Wend", "Orlec", "Maud", "Tamsin", "Brec", "Isolt"];
export const CAPTAIN_TITLES = ["of the Count", "Seventeen-Past", "the Patient", "Who Keeps the Hour", "the Unrung", "of the Low Bell"];
