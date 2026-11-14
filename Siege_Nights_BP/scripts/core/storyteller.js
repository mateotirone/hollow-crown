// The Storyteller: the pacing director. "A director, not a dice roll."
//
// It remembers what each player has done and been offered lately, knows which story chapter they are
// in, and picks what comes next to CONTRAST with it: quiet after a siege, a mystery after a run of
// fights, a journey after days at home. It never serves the same thing, or the same kind of thing,
// twice in a row from one deck, and it favours whatever a player has seen least.
//
// A feature owns its content as a DECK of options and asks the Storyteller to choose:
//
//   registerDeck("rumors", [
//     { id: "bounty_wolves", kind: "fight", from: 1 },             // from/to: story chapters it fits
//     { id: "lost_child", kind: "mystery", weight: 2 },
//     { id: "escort_salt", kind: "journey", from: 2, to: 6 },
//     { id: "founders_grave", kind: "mystery", once: true },       // never offered again once done
//   ]);
//   const job = pick("rumors", player);            // one option (yours, with every field you gave it)
//   const board = pickSeveral("rumors", player, 3); // three different ones, kinds mixed
//   note(player, "fight");                          // the player actually DID something of this kind
//   markDone(player, "rumors", job.id);             // things stay done
//
// The subject is a player, or any id string for something that isn't one (a Rival Lord, "world").
// Other features may add rows to a deck later with addOptions(deck, [...]): an update adds data, not code.
//
// Story chapters (the one shared count; see CHAPTERS): chapterOf(player), worldChapter(),
// on("chapter", ({ player, from, to }) => ...). Facts come from the features that own them:
//   provideFact("bossesFallen", () => count);

import { world, system } from "@minecraft/server";
import { on, emit } from "./events.js";
import { onTick } from "./loop.js";
import { moduleStore } from "./store.js";
import { addTests, assert, assertEqual, isTesting } from "./tests.js";

// ---------- kinds: what a beat feels like. Ids are saved in worlds, so never rename one ----------

export const KINDS = ["fight", "mystery", "journey", "quiet", "social", "build"];

// After the key, the director leans toward these
const FOLLOWS = {
  fight: ["quiet", "mystery"],
  mystery: ["fight", "journey"],
  journey: ["quiet", "social"],
  quiet: ["journey", "fight"],
  social: ["mystery", "fight"],
  build: ["journey", "fight"],
};

const MEMORY = 12; // how many recent beats are remembered per subject
const TUNING = { follow: 1.6, runBreaker: 2, repeatFloor: 0.35, repeatFade: 0.11 };

// ---------- story chapters ----------
// Each chapter begins when a fact becomes true, never after a count of days. Ids and order are fixed.

export const CHAPTERS = [
  { id: 0, name: "Arrival", begins: () => true },
  { id: 1, name: "The Counted Nights", begins: (f) => !!f.keepRaised },
  { id: 2, name: "The Ember", begins: (f) => (f.siegesWon ?? 0) >= 1 },
  { id: 3, name: "The Leaning", begins: (f) => (f.bossesFallen ?? 0) >= 1 },
  { id: 4, name: "The Miscount", begins: (f) => (f.bossesFallen ?? 0) >= 3 },
  { id: 5, name: "The Thin Place", begins: (f) => (f.bossesFallen ?? 0) >= 5 },
  // The Rift opening starts the Long Night (Mateo's choice). Until a feature reports riftOpened, the Choir falling stands in.
  { id: 6, name: "The Long Night", begins: (f) => !!(f.riftOpened ?? f.choirFallen) },
  { id: 7, name: "The Quiet After", begins: (f) => !!f.morvaneFallen },
];
export const FACTS = ["keepRaised", "siegesWon", "bossesFallen", "choirFallen", "riftOpened", "morvaneFallen"];

const factProviders = new Map(); // fact name -> (player | undefined) => value

// A feature that owns a fact tells the Storyteller how to read it. Personal facts get the player;
// world facts ignore it. Until a fact has a provider it counts as false / 0.
export function provideFact(name, read) {
  if (!FACTS.includes(name)) throw new Error(`provideFact("${name}"): unknown fact. Known: ${FACTS.join(", ")}`);
  factProviders.set(name, read);
}

export const missingFacts = () => FACTS.filter((f) => !factProviders.has(f));

function readFacts(player) {
  const facts = {};
  for (const [name, read] of factProviders) {
    try {
      facts[name] = read(player);
    } catch (e) {
      console.warn(`[Hollow Crown] story fact "${name}" failed: ${e}`);
    }
  }
  return facts;
}

// The highest chapter whose fact is true. Pure.
export function chapterFor(facts) {
  let chapter = 0;
  for (const c of CHAPTERS) if (c.begins(facts)) chapter = c.id;
  return chapter;
}

const CHAPTER_PROP = "siege:chapter"; // player dynamic property: the furthest chapter they have reached
const worldStore = moduleStore("siege:storyteller", () => ({ chapter: 0, subjects: {} }));

// A player's chapter never goes backwards, even if their keep falls
export function chapterOf(player) {
  const now = chapterFor(readFacts(player));
  let reached = 0;
  try {
    reached = player?.getDynamicProperty?.(CHAPTER_PROP) ?? 0;
  } catch {
    // not a live player
  }
  return Math.max(now, reached);
}

// The furthest the world itself has gone (bosses, the Choir, Morvane), ignoring personal facts
export function worldChapter() {
  const facts = readFacts(undefined);
  delete facts.keepRaised;
  delete facts.siegesWon;
  return Math.max(chapterFor(facts), worldStore.data.chapter);
}

function chapterTick() {
  for (const player of world.getPlayers()) {
    const reached = player.getDynamicProperty(CHAPTER_PROP) ?? 0;
    const now = chapterFor(readFacts(player));
    if (now <= reached) continue;
    player.setDynamicProperty(CHAPTER_PROP, now);
    emit("chapter", { player, from: reached, to: now, name: CHAPTERS[now].name });
  }
  const w = worldChapter();
  if (w > worldStore.data.chapter) {
    worldStore.data.chapter = w;
    worldStore.save();
  }
}
onTick("story chapters", 100, chapterTick);

// ---------- memory: what a subject has done and been served ----------

const PLAYER_PROP = "siege:story"; // player dynamic property (JSON), versioned with v
const newMemory = () => ({ v: 1, recent: [], served: {}, last: {}, lastKind: {}, done: {}, misses: {} });
const cache = new Map(); // subject key -> memory

const isPlayer = (subject) => typeof subject === "object" && subject !== null;
const keyOf = (subject) => (isPlayer(subject) ? `p:${subject.id}` : `s:${subject}`);

function memoryOf(subject) {
  const key = keyOf(subject);
  if (cache.has(key)) return cache.get(key);
  let memory;
  try {
    const saved = isPlayer(subject) ? subject.getDynamicProperty(PLAYER_PROP) : worldStore.data.subjects[subject];
    memory = typeof saved === "string" ? JSON.parse(saved) : saved;
  } catch {
    memory = undefined;
  }
  memory = { ...newMemory(), ...(memory ?? {}) };
  if (!isTesting()) cache.set(key, memory);
  return memory;
}

function remember(subject, memory) {
  if (isTesting()) return;
  try {
    if (isPlayer(subject)) subject.setDynamicProperty(PLAYER_PROP, JSON.stringify(memory));
    else {
      worldStore.data.subjects[subject] = memory;
      worldStore.save();
    }
  } catch (e) {
    console.warn(`[Hollow Crown] storyteller could not save: ${e}`);
  }
}

world.afterEvents.playerLeave.subscribe((event) => cache.delete(`p:${event.playerId}`));

// ---------- decks ----------

const decks = new Map(); // deck name -> { options: [], chance }

function checkOption(deck, option, existing) {
  if (!option.id || typeof option.id !== "string") throw new Error(`deck "${deck}": every option needs an id`);
  if (!KINDS.includes(option.kind)) throw new Error(`deck "${deck}", option "${option.id}": kind must be one of ${KINDS.join(", ")}`);
  if (existing.some((o) => o.id === option.id)) throw new Error(`deck "${deck}": option "${option.id}" is listed twice`);
}

// chance: for decks used with maybePick (twists and other sometimes-things), the starting odds, 0 to 1
export function registerDeck(deck, options, { chance = 1 } = {}) {
  if (decks.has(deck)) throw new Error(`deck "${deck}" is registered twice; use addOptions to add to it`);
  decks.set(deck, { options: [], chance });
  addOptions(deck, options);
}

export function addOptions(deck, options) {
  const d = decks.get(deck);
  if (!d) throw new Error(`addOptions: no deck called "${deck}" yet (is its feature imported before yours?)`);
  for (const option of options) {
    checkOption(deck, option, d.options);
    d.options.push(option);
  }
}

export const deckNames = () => [...decks.keys()];
export const optionsOf = (deck) => [...(decks.get(deck)?.options ?? [])];

// ---------- choosing (pure: no world access, so it can be tested anywhere) ----------

// How much the director wants this option right now. 0 means "not now".
export function score(option, memory, deck, chapter) {
  if (chapter < (option.from ?? 0) || chapter > (option.to ?? 99)) return 0;
  const tag = `${deck}/${option.id}`;
  if (option.once && memory.done[tag]) return 0;
  let s = option.weight ?? 1;
  // seen less, wanted more
  s /= 1 + (memory.served[tag] ?? 0);
  // the same kind lately: strongest for the most recent beat, fading with age
  memory.recent.slice(0, 6).forEach((kind, age) => {
    if (kind === option.kind) s *= Math.min(1, TUNING.repeatFloor + TUNING.repeatFade * age);
  });
  // contrast with the last beat
  if (FOLLOWS[memory.recent[0]]?.includes(option.kind)) s *= TUNING.follow;
  // break a run: three of the last four beats alike, so anything else is welcome
  const run = memory.recent.slice(0, 4).filter((k) => k === memory.recent[0]).length >= 3;
  if (run && option.kind !== memory.recent[0]) s *= TUNING.runBreaker;
  return s;
}

// Pick one option. Hard rules first (not the same option, not the same kind, as last time from this
// deck), relaxed only when a small deck leaves no other choice.
export function choose(options, memory, deck, chapter, rng = Math.random, exclude = []) {
  const open = options.filter((o) => !exclude.includes(o.id) && score(o, memory, deck, chapter) > 0);
  if (!open.length) return undefined;
  const fresh = open.filter((o) => o.id !== memory.last[deck]);
  const contrast = fresh.filter((o) => o.kind !== memory.lastKind[deck]);
  const pool = contrast.length ? contrast : fresh.length ? fresh : open;
  const scores = pool.map((o) => score(o, memory, deck, chapter));
  let roll = rng() * scores.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    roll -= scores[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// Write a served option into memory. Pure.
export function serve(memory, deck, option) {
  const tag = `${deck}/${option.id}`;
  memory.served[tag] = (memory.served[tag] ?? 0) + 1;
  memory.last[deck] = option.id;
  memory.lastKind[deck] = option.kind;
  memory.recent.unshift(option.kind);
  memory.recent.length = Math.min(memory.recent.length, MEMORY);
  return memory;
}

// ---------- the API features call ----------

const chapterOfSubject = (subject) => (isPlayer(subject) ? chapterOf(subject) : worldChapter());

// One option from a deck for this subject, or undefined if nothing fits right now.
// peek: look without it counting as served. chapter: override (for a lord acting at a player's level).
export function pick(deck, subject, { exclude = [], peek = false, rng = Math.random, chapter } = {}) {
  const d = decks.get(deck);
  if (!d) throw new Error(`pick: no deck called "${deck}"`);
  const memory = memoryOf(subject);
  const option = choose(d.options, memory, deck, chapter ?? chapterOfSubject(subject), rng, exclude);
  if (option && !peek) {
    serve(memory, deck, option);
    remember(subject, memory);
  }
  return option;
}

// Up to `count` different options, each contrasting with the one before (a Town Board's three notices)
export function pickSeveral(deck, subject, count, opts = {}) {
  const picked = [];
  for (let i = 0; i < count; i++) {
    const option = pick(deck, subject, { ...opts, exclude: [...(opts.exclude ?? []), ...picked.map((o) => o.id)] });
    if (!option) break;
    picked.push(option);
  }
  return picked;
}

// For things that only happen sometimes (a twist on a job): usually undefined, and likelier the
// longer it has been since the last one, so a player is never starved of them or drowned in them.
export function maybePick(deck, subject, opts = {}) {
  const d = decks.get(deck);
  if (!d) throw new Error(`maybePick: no deck called "${deck}"`);
  const memory = memoryOf(subject);
  const misses = memory.misses[deck] ?? 0;
  const rng = opts.rng ?? Math.random;
  if (rng() >= Math.min(0.9, d.chance + 0.1 * misses)) {
    memory.misses[deck] = misses + 1;
    remember(subject, memory);
    return undefined;
  }
  memory.misses[deck] = 0;
  return pick(deck, subject, opts) ?? (remember(subject, memory), undefined);
}

// The subject actually did something of this kind (survived a siege, solved a mystery, rode far).
// This is what the director contrasts against, so call it for the real thing, not only for offers.
export function note(subject, kind) {
  if (!KINDS.includes(kind)) throw new Error(`note: kind must be one of ${KINDS.join(", ")}`);
  const memory = memoryOf(subject);
  memory.recent.unshift(kind);
  memory.recent.length = Math.min(memory.recent.length, MEMORY);
  remember(subject, memory);
}

// Things stay done: a `once` option marked done is never offered to this subject again
export function markDone(subject, deck, id) {
  const memory = memoryOf(subject);
  memory.done[`${deck}/${id}`] = 1;
  remember(subject, memory);
}

export const recentKinds = (subject) => [...memoryOf(subject).recent];
export const servedCount = (subject, deck, id) => memoryOf(subject).served[`${deck}/${id}`] ?? 0;
export const isDone = (subject, deck, id) => !!memoryOf(subject).done[`${deck}/${id}`];

// "We measure it": everything served to this subject more than `limit` times. Content that shows up
// here needs more variants, or cutting.
export function overserved(subject, limit = 4) {
  return Object.entries(memoryOf(subject).served)
    .filter(([, n]) => n > limit)
    .map(([tag, n]) => ({ tag, times: n }))
    .sort((a, b) => b.times - a.times);
}

// ---------- what the Storyteller can see for itself ----------

const playerById = (id) => world.getPlayers().find((p) => p.id === id);
on("siegeEnd", ({ outcome, besieged }) => {
  if (outcome === "empty") return;
  for (const id of besieged ?? []) {
    const player = playerById(id);
    if (player) note(player, "fight");
  }
});
on("keepFounded", ({ player }) => note(player, "build"));
on("tierUp", ({ owner }) => {
  const player = playerById(owner);
  if (player) note(player, "build");
});

// ---------- /scriptevent siege:storyteller: what the director thinks of you ----------

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:storyteller") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  const chapter = chapterOf(player);
  const lines = [
    `§6The Storyteller§r  chapter ${chapter}: ${CHAPTERS[chapter].name} (world: ${worldChapter()})`,
    `Lately: ${recentKinds(player).join(", ") || "nothing yet"}`,
    `Decks: ${deckNames().map((d) => `${d} (${optionsOf(d).length})`).join(", ") || "none registered yet"}`,
  ];
  const tired = overserved(player);
  if (tired.length) lines.push(`§eSeen too often:§r ${tired.slice(0, 8).map((t) => `${t.tag} x${t.times}`).join(", ")}`);
  if (missingFacts().length) lines.push(`§7No feature reports yet: ${missingFacts().join(", ")}`);
  for (const deck of deckNames()) {
    const next = pick(deck, player, { peek: true });
    lines.push(`§7next from ${deck}: ${next ? `${next.id} (${next.kind})` : "nothing fits"}`);
  }
  player.sendMessage(lines.join("\n"));
});

// ---------- self-tests ----------

const seeded = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const SAMPLE = [
  { id: "f1", kind: "fight" }, { id: "f2", kind: "fight" }, { id: "f3", kind: "fight" },
  { id: "m1", kind: "mystery" }, { id: "m2", kind: "mystery" },
  { id: "j1", kind: "journey" }, { id: "q1", kind: "quiet" },
  { id: "late", kind: "social", from: 5 }, { id: "grave", kind: "mystery", once: true },
];

addTests("storyteller", {
  "chapters follow the story spine": () => {
    assertEqual(chapterFor({}), 0);
    assertEqual(chapterFor({ keepRaised: true }), 1);
    assertEqual(chapterFor({ keepRaised: true, siegesWon: 1 }), 2);
    assertEqual(chapterFor({ keepRaised: true, siegesWon: 4, bossesFallen: 1 }), 3);
    assertEqual(chapterFor({ bossesFallen: 3 }), 4);
    assertEqual(chapterFor({ bossesFallen: 5 }), 5);
    assertEqual(chapterFor({ bossesFallen: 5, choirFallen: true }), 6);
    assertEqual(chapterFor({ bossesFallen: 5, choirFallen: true, riftOpened: false }), 5);
    assertEqual(chapterFor({ bossesFallen: 5, riftOpened: true }), 6);
    assertEqual(chapterFor({ bossesFallen: 5, choirFallen: true, morvaneFallen: true }), 7);
    assertEqual(CHAPTERS.map((c) => c.id), [0, 1, 2, 3, 4, 5, 6, 7]);
  },
  "never the same option or the same kind twice in a row": () => {
    const rng = seeded(7);
    const memory = newMemory();
    let last;
    for (let i = 0; i < 300; i++) {
      const o = choose(SAMPLE, memory, "t", 3, rng);
      assert(o, "nothing chosen");
      if (last) assert(o.id !== last.id && o.kind !== last.kind, `${last.id} then ${o.id}`);
      serve(memory, "t", o);
      last = o;
    }
  },
  "every option gets its turn, and none hogs the deck": () => {
    const rng = seeded(11);
    const memory = newMemory();
    for (let i = 0; i < 400; i++) serve(memory, "t", choose(SAMPLE, memory, "t", 3, rng));
    const counts = SAMPLE.filter((o) => o.id !== "late").map((o) => memory.served[`t/${o.id}`] ?? 0);
    assert(Math.min(...counts) >= 15, `least served ${Math.min(...counts)}`);
    assert(Math.max(...counts) <= 120, `most served ${Math.max(...counts)}`);
  },
  "quiet or a mystery after a fight, more often than another fight": () => {
    const rng = seeded(3);
    const tally = { fight: 0, other: 0 };
    for (let i = 0; i < 500; i++) {
      const memory = { ...newMemory(), recent: ["fight", "fight", "build"] }; // just survived sieges
      const o = choose(SAMPLE, memory, "t", 3, rng);
      tally[o.kind === "fight" ? "fight" : "other"]++;
    }
    assert(tally.other > tally.fight * 4, `fights ${tally.fight}, other ${tally.other}`);
  },
  "chapter gates and done things are respected": () => {
    const rng = seeded(5);
    const memory = newMemory();
    memory.done["t/grave"] = 1;
    for (let i = 0; i < 200; i++) {
      const o = choose(SAMPLE, memory, "t", 2, rng);
      assert(o.id !== "late" && o.id !== "grave", o.id);
      serve(memory, "t", o);
    }
    assert(score(SAMPLE.find((o) => o.id === "late"), newMemory(), "t", 5) > 0);
  },
  "a tiny deck still answers": () => {
    const memory = newMemory();
    const one = [{ id: "only", kind: "quiet" }];
    serve(memory, "t", choose(one, memory, "t", 0));
    assertEqual(choose(one, memory, "t", 0).id, "only");
    assertEqual(choose([], memory, "t", 0), undefined);
  },
  "a bad option is refused when its deck is registered": () => {
    for (const bad of [[{ id: "x", kind: "grind" }], [{ kind: "fight" }], [{ id: "a", kind: "fight" }, { id: "a", kind: "quiet" }]]) {
      let refused = false;
      try {
        checkOption("t", bad[bad.length - 1], bad.slice(0, -1));
      } catch {
        refused = true;
      }
      assert(refused, JSON.stringify(bad));
    }
  },
  "pick, pickSeveral and maybePick answer from a registered deck": () => {
    registerDeck("selftest", SAMPLE, { chance: 0.5 });
    try {
      const rng = seeded(9);
      assert(pick("selftest", "selftest", { rng, chapter: 3 }), "pick gave nothing");
      assertEqual(pick("selftest", "selftest", { rng, chapter: 3, exclude: SAMPLE.map((o) => o.id) }), undefined);
      const three = pickSeveral("selftest", "selftest", 3, { rng, chapter: 3 });
      assertEqual(new Set(three.map((o) => o.id)).size, 3);
      assertEqual(maybePick("selftest", "selftest", { rng: () => 0.99, chapter: 3 }), undefined);
      assert(maybePick("selftest", "selftest", { rng: () => 0, chapter: 3 }), "maybePick never fires");
    } finally {
      decks.delete("selftest");
    }
  },
  "every real deck gives the director room to contrast": () => {
    for (const [name, d] of decks) {
      if (d.chance < 1) continue; // sometimes-decks (twists) may be small
      const kinds = new Set(d.options.map((o) => o.kind));
      assert(d.options.length >= 3 && kinds.size >= 2, `deck "${name}" has ${d.options.length} options of ${kinds.size} kind(s); it needs at least 3 options of 2 kinds or it will repeat`);
    }
  },
});
