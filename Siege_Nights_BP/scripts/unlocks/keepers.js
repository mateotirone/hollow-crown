// The six clock keepers of Millbrook. Pure, no Minecraft imports.
//
// Sister Wren: "Ask the villagers which clock he stopped first. All six will answer. One of them will be lying,
// and you'll know which once you've heard the other five."
//
// Each world picks, from its own seed: which post each clock stands on, which clock the Reeve stopped first, and
// which keeper lies. Then every keeper gets one statement, true for the five honest keepers and false for the liar,
// chosen so that exactly one answer fits: one first clock, one liar. Nobody can look the answer up.

export const CLOCKS = [
  { id: "tower", name: "the Tower clock", short: "Tower" },
  { id: "chapel", name: "the Chapel clock", short: "Chapel" },
  { id: "mill", name: "the Mill clock", short: "Mill" },
  { id: "lantern", name: "the Lantern clock", short: "Lantern" }, // the inn's
  { id: "reeve", name: "the Reeve's clock", short: "Reeve's" },
  { id: "market", name: "the Market clock", short: "Market" },
];

// Keeper i keeps clock i
export const KEEPERS = [
  { name: "Old Pell", role: "keeps the Tower clock", hello: "Pell, bell-less sexton of a bell-less town. Mind the tower step." },
  { name: "Ada Rook", role: "keeps the Chapel clock", hello: "I polish the Chapel clock for Sister Wren. Every day. It never needs it." },
  { name: "Hob Miller", role: "keeps the Mill clock", hello: "Hob. The wheel turns, the clock doesn't. Don't ask me how that works." },
  { name: "Marta Lane", role: "keeps the Lantern clock", hello: "Welcome to the Lantern. The clock over my door hasn't charged me a minute's rent in three hundred years." },
  { name: "Corin Ashby", role: "keeps the Reeve's clock", hello: "Corin. I copy the old Reeve's papers. Someone has to keep them in order, even if he never will again." },
  { name: "Tamsin Fry", role: "keeps the Market clock", hello: "Tamsin. I keep the Market clock and carry the water. I don't drink from that well, and neither should you." },
];

// The six posts round the square, clockwise from north-north-east (0 = north, angles in degrees)
export const POSTS = [
  { angle: 30, side: ["north", "east"] },
  { angle: 90, side: ["east"] },
  { angle: 150, side: ["south", "east"] },
  { angle: 210, side: ["south", "west"] },
  { angle: 270, side: ["west"] },
  { angle: 330, side: ["north", "west"] },
];
export const SIDES = ["north", "east", "south", "west"];

// Small seeded random numbers, so a world always gets the same puzzle back
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];
function shuffle(r, list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------- statements ----------
// A statement is { kind, clock?, side?, keeper? }. truth(statement, speaker, first, liar, layout) says whether it
// is true in the world where `first` is the first clock and `liar` is the lying keeper.
export function truth(s, speaker, first, liar, layout) {
  switch (s.kind) {
    case "was": return first === s.clock;
    case "wasnt": return first !== s.clock;
    case "mine": return first === speaker;
    case "notmine": return first !== speaker;
    case "side": return POSTS[layout[first]].side.includes(s.side);
    case "notside": return !POSTS[layout[first]].side.includes(s.side);
    case "lies": return liar === s.keeper;
    case "honest": return liar !== s.keeper;
    default: return false;
  }
}

/** Every (first clock, liar) pair the six statements allow. */
export function solutions(statements, layout) {
  const out = [];
  for (let first = 0; first < 6; first++) {
    for (let liar = 0; liar < 6; liar++) {
      if (statements.every((s, k) => truth(s, k, first, liar, layout) === (k !== liar))) out.push({ first, liar });
    }
  }
  return out;
}

function candidates(speaker) {
  const out = [];
  for (let c = 0; c < 6; c++) {
    out.push({ kind: "was", clock: c }, { kind: "wasnt", clock: c });
  }
  out.push({ kind: "mine" }, { kind: "notmine" });
  for (const side of SIDES) out.push({ kind: "side", side }, { kind: "notside", side });
  for (let k = 0; k < 6; k++) if (k !== speaker) out.push({ kind: "lies", keeper: k }, { kind: "honest", keeper: k });
  return out;
}

/**
 * Make the puzzle for a world. Returns { layout, first, liar, statements }:
 *   layout[clock] = post index, statements[keeper] = what that keeper says.
 */
export function makePuzzle(seed) {
  const r = rng(seed);
  for (let attempt = 0; attempt < 400; attempt++) {
    const layout = shuffle(r, [0, 1, 2, 3, 4, 5]);
    const first = Math.floor(r() * 6);
    let liar = Math.floor(r() * 6);
    if (liar === first && r() < 0.7) liar = (liar + 1 + Math.floor(r() * 5)) % 6; // the first clock's own keeper lies less often
    const statements = [];
    for (let k = 0; k < 6; k++) {
      const wanted = k !== liar;
      // never just name the answer outright, and keep the liar's lie from being a plain "it was X"
      const fits = candidates(k).filter((s) => truth(s, k, first, liar, layout) === wanted && !(wanted && s.kind === "was") && !(wanted && s.kind === "mine"));
      statements.push(pick(r, fits));
    }
    // at most two statements about other keepers, so it stays a puzzle about clocks
    if (statements.filter((s) => s.kind === "lies" || s.kind === "honest").length > 2) continue;
    const found = solutions(statements, layout);
    if (found.length === 1 && found[0].first === first && found[0].liar === liar) return { layout, first, liar, statements };
  }
  // Fallback (never seen in testing): a fixed puzzle that always has one answer
  return fallbackPuzzle();
}

export function fallbackPuzzle() {
  const layout = [0, 1, 2, 3, 4, 5];
  const statements = [
    { kind: "wasnt", clock: 0 }, { kind: "side", side: "west" }, { kind: "notside", side: "north" },
    { kind: "lies", keeper: 0 }, { kind: "wasnt", clock: 4 }, { kind: "honest", keeper: 2 },
  ];
  const [s] = solutions(statements, layout);
  return { layout, first: s.first, liar: s.liar, statements };
}

// ---------- words ----------
const SAY = {
  wasnt: (s) => pickLine(s, [`Not ${CLOCKS[s.clock].name}. I would stake my life on that.`, `Whatever you've heard, it wasn't ${CLOCKS[s.clock].name}.`, `${cap(CLOCKS[s.clock].name)}? No. He came to that one later.`]),
  was: (s) => pickLine(s, [`It was ${CLOCKS[s.clock].name}. Everyone knows it.`, `${cap(CLOCKS[s.clock].name)}. He stopped that one first and the rest after.`]),
  mine: () => "Mine. He stopped mine first. I've the scratch on the case to prove it, if you'd only look.",
  notmine: () => "Not mine, I'll tell you that for nothing. Mine was one of the last.",
  side: (s) => `It was one of the clocks on the ${s.side} side of the square.`,
  notside: (s) => `It wasn't any clock on the ${s.side} side of the square. He walked in from the ${s.side} and he was in no hurry.`,
  lies: (s) => `Don't listen to ${KEEPERS[s.keeper].name}. That one has been telling it wrong for years.`,
  honest: (s) => `Ask ${KEEPERS[s.keeper].name}. Whatever ${KEEPERS[s.keeper].name.split(" ")[0]} tells you is true.`,
};
const cap = (t) => t[0].toUpperCase() + t.slice(1);
function pickLine(s, lines) {
  return lines[((s.clock ?? 0) + (s.side?.length ?? 0)) % lines.length];
}

/** What keeper k says when asked which clock was first. */
export const statementText = (s) => SAY[s.kind](s);

// ---------- what clicking a clock does ----------
// Pure decision: "key" (the first clock, still holding its key), "empty" (the first clock, key taken to the well),
// "wrong" (not the first), "rest" (this player tried a wrong clock too recently).
export const WRONG_COOLDOWN_TICKS = 6000; // five minutes
export function clockAnswer({ clock, first, wound, now, lastWrong }) {
  if (lastWrong !== undefined && now - lastWrong < WRONG_COOLDOWN_TICKS) return "rest";
  if (clock !== first) return "wrong";
  return wound ? "empty" : "key";
}
