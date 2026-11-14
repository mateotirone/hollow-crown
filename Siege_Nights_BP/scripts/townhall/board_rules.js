// The Town Board's rules: which notices are up today, how a taken job runs step by step, what the tracker says,
// and what it pays. Pure (no Minecraft calls), so the offline check runs all of it. The game side is board.js.
//
// A player's board memory (saved on the player, board.js):
//   { done: { jobId: times }, round: { region: n }, inRound: { region: [jobIds done this round] }, last: kind,
//     day, taken: [jobIds taken today], job: <the running job> }
//
// The pool (Mateo 2026-11-14):
//   * One-off jobs (Missing, Recover, Look, chain steps, story jobs) are offered until done, then never again.
//   * Everyday jobs (Hunt, Camp, Supply, Carry, Escort, Watch) are offered once per round. A region's round ends
//     when every everyday job of it has been done in that round and no one-off of it is waiting: the next round
//     starts, and its jobs come back with their `again` line.
//   * From the second round on (your region's pool has gone round once), the board also draws from the regions
//     next to yours. Their givers stay where they live, so you ride to them.
//   * Story jobs only show in Story Mode; Settlement Mode gets the rest.

import { JOBS, SHARED_JOBS, ROLE_TOWN, REGIONS, GIVERS, PLACES, NEIGHBOURS, MOB_NAMES, ITEM_NAMES } from "./board_data.js";

export const KINDS = ["hunt", "camp", "missing", "supply", "carry", "escort", "recover", "look", "watch"];
export const REPEATS = new Set(["hunt", "camp", "supply", "carry", "escort", "watch"]);
export const NOTICES_PER_DAY = 3;
export const JOBS_PER_POINT = 3;
// The Storyteller's mood for each kind (core/storyteller.js): it mixes the board against what you have done lately
export const KIND_MOOD = { hunt: "fight", camp: "fight", watch: "fight", missing: "mystery", look: "mystery", recover: "mystery", supply: "quiet", carry: "social", escort: "social" };

// ---------- shared jobs (board_data.js SHARED_JOBS): one copy per region, given by that region's smith/farmer/factor ----------
const fill = (v, words) => (typeof v === "string" ? v.replace(/\{(\w+)\}/g, (m, k) => words[k] ?? m) : Array.isArray(v) ? v.map((x) => fill(x, words)) : v);
function expandShared() {
  const out = [];
  SHARED_JOBS.forEach((s, i) => {
    for (const region of REGIONS) {
      const [prefix, short] = ROLE_TOWN[region];
      const giver = `${prefix}_${s.role}`;
      const near = NEIGHBOURS[region][i % NEIGHBOURS[region].length];
      const to = s.toRole ? `${ROLE_TOWN[near][0]}_${s.toRole}` : undefined;
      const place = s.places?.[region];
      const words = { town: GIVERS[giver]?.town, to: to && GIVERS[to]?.town, place: place && PLACES[place]?.name };
      const lines = Object.fromEntries(Object.entries(s.lines).map(([k, v]) => [k, fill(v, words)]));
      const { role, toRole, places, ...rest } = s;
      out.push({ ...rest, id: `${s.id}_${short}`, shared: s.id, region, giver, to, place, title: fill(s.title, words), about: fill(s.about, words), lines });
    }
  });
  return out;
}
export const SHARED = expandShared();
export const allJobs = () => [...JOBS, ...SHARED];
const BY_ID = new Map(allJobs().map((j) => [j.id, j]));
export const jobById = (id) => BY_ID.get(id);
export const repeats = (job) => REPEATS.has(job.kind) && !job.chain && !job.story;
// what a job's done count is kept under: a shared job counts once, whichever region it was done in
export const doneKey = (job) => job.shared ?? job.id;
// the region a shared job is in now: it moves on each time one of your regions' rounds turns
export function sharedHome(job, mem) {
  const turns = Object.values(mem.round ?? {}).reduce((a, b) => a + b, 0);
  const i = SHARED_JOBS.findIndex((s) => s.id === job.shared);
  return REGIONS[(i * 2 + turns) % REGIONS.length];
}

// tier 0-4 from Renown level: bigger jobs, better pay (as the old board)
export const jobTier = (level) => Math.min(4, Math.floor((level ?? 0) / 8));
export const needAt = (job, tier) => {
  if (!job.need) return 1;
  const [lo, hi] = job.need;
  return Math.round(lo + ((hi - lo) * tier) / 4);
};
export const foesAt = (job, tier) => (job.foes ?? []).map(([type, lo, hi, from = 0]) => [type, tier < from ? 0 : Math.round(lo + ((hi - lo) * tier) / 4)]).filter(([, n]) => n > 0);

// ---------- the seeded dice (same board all day) ----------
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
export const hash = (text) => [...String(text)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

export const blankMemory = () => ({ done: {}, round: {}, inRound: {}, last: undefined, day: -1, taken: [], job: null, jobsDone: 0, keepsakes: [], debts: 0 });

// ---------- what can be offered ----------
// ctx = { story: Story Mode on, siegesWon, town: has reached Town tier, night }
export function whenOk(job, ctx = {}) {
  const w = job.when ?? {};
  if (job.story && !ctx.story) return false;
  if (w.after === "siegeWon" && !(ctx.siegesWon > 0)) return false;
  if (w.after === "town" && !ctx.town) return false;
  return true;
}

function chainOk(job, mem) {
  if (!job.chain) return true;
  const [chain, step] = job.chain;
  if (step === 1) return true;
  const prev = allJobs().find((j) => j.chain?.[0] === chain && j.chain[1] === step - 1);
  return !prev || (mem.done[prev.id] ?? 0) > 0;
}

// Jobs of one region that are free to offer now
export function openIn(region, mem, ctx) {
  const round = mem.round[region] ?? 0;
  const inRound = new Set(mem.inRound[region] ?? []);
  return allJobs().filter((j) => j.region === region && (!j.shared || sharedHome(j, mem) === region) && whenOk(j, ctx) && chainOk(j, mem)
    && (repeats(j) ? !inRound.has(j.id) && (round > 0 || !(mem.done[doneKey(j)] > 0)) : !(mem.done[doneKey(j)] > 0)));
}

// Has this region's pool gone round? Every everyday job done this round, and no one-off waiting.
// Shared jobs travel, so they never hold a region's round back.
export function roundDone(region, mem, ctx) {
  const left = openIn(region, mem, ctx).filter((j) => !j.shared);
  const everyday = allJobs().filter((j) => j.region === region && !j.shared && repeats(j) && whenOk(j, ctx));
  return everyday.length > 0 && left.length === 0;
}

// Start the next round of a region whose pool has gone round (called when a job is done, and each new day)
export function turnRounds(mem, ctx, regions = Object.keys(NEIGHBOURS)) {
  let turned = false;
  for (const r of regions) {
    if (roundDone(r, mem, ctx)) {
      mem.round[r] = (mem.round[r] ?? 0) + 1;
      mem.inRound[r] = [];
      turned = true;
    }
  }
  return turned;
}

// The pool for a player whose home region is `home`: their own region, then (once it has gone round) its neighbours
export function poolFor(home, mem, ctx) {
  const own = openIn(home, mem, ctx);
  const widened = (mem.round[home] ?? 0) >= 1;
  const near = widened ? (NEIGHBOURS[home] ?? []).flatMap((r) => openIn(r, mem, ctx)) : [];
  return { own, near };
}

// Today's notices: up to three, never the kind you did last, three different givers, own region first.
// moods: the Storyteller's choice of moods for today (["fight", "quiet", "mystery"]), when it made one.
export function noticesFor(day, playerId, home, mem, ctx, moods) {
  const roll = dice(hash(`${day}:${playerId}:board`));
  const { own, near } = poolFor(home, mem, ctx);
  const shuffled = (list) => list.map((j) => [roll(), j]).sort((a, b) => a[0] - b[0]).map(([, j]) => j);
  // one-off jobs and jobs not yet seen come before repeats; the kind just done goes to the back
  const rank = (j) => (repeats(j) && (mem.done[doneKey(j)] ?? 0) > 0 ? 1 : 0) + (j.kind === mem.last ? 2 : 0);
  const order = (list) => shuffled(list).sort((a, b) => rank(a) - rank(b));
  // own region: up to two (three if nothing near), then near regions fill the rest
  const pick = [], givers = new Set(), kinds = new Set();
  const take = (list, max) => {
    for (const j of list) {
      if (pick.length >= max) break;
      if (givers.has(j.giver) || kinds.has(j.kind) || j.kind === mem.last) continue;
      pick.push(j); givers.add(j.giver); kinds.add(j.kind);
    }
  };
  const ownList = order(own), nearList = order(near);
  // the Storyteller's moods first, when it has an opinion and the pool can meet it
  if (moods?.length) for (const mood of moods) take([...ownList, ...nearList].filter((j) => KIND_MOOD[j.kind] === mood), pick.length + 1);
  take(ownList, near.length ? NOTICES_PER_DAY - 1 : NOTICES_PER_DAY);
  take(nearList, NOTICES_PER_DAY);
  take(ownList, NOTICES_PER_DAY);
  // a thin pool: allow the kind just done rather than show an empty board
  if (pick.length < NOTICES_PER_DAY) for (const j of [...ownList, ...nearList]) { if (pick.length >= NOTICES_PER_DAY) break; if (!pick.includes(j) && !givers.has(j.giver)) { pick.push(j); givers.add(j.giver); } }
  return pick.slice(0, NOTICES_PER_DAY);
}

// ---------- a taken job ----------
// Steps: talk (go to the giver) -> the kind's own steps -> back (go back to the giver) -> done.
//   hunt, camp, look, recover, watch:   talk, go, back
//   supply:                             talk, bring (hand over to the giver)
//   carry:                              talk, deliver (to `to`), back
//   escort:                             talk, escort (walk them to the place; done there)
//   missing:                            talk, go (find them), home (walk them to the giver's town)
export const STEPS = {
  hunt: ["talk", "go", "back"], camp: ["talk", "go", "back"], look: ["talk", "go", "back"], recover: ["talk", "go", "back"],
  watch: ["talk", "go", "back"], supply: ["talk", "bring"], carry: ["talk", "deliver", "back"], escort: ["talk", "escort"], missing: ["talk", "go", "home"],
};

export function startJob(job, mem, tier, day) {
  const round = mem.round[job.region] ?? 0;
  const again = repeats(job) && (mem.done[doneKey(job)] ?? 0) > 0;
  const place = PLACES[job.place];
  // a repeat moves to one of the place's other spots, so it is never quite the same twice
  const alts = place?.alt ?? [];
  const a = again && alts.length ? alts[((mem.done[doneKey(job)] ?? 0) - 1) % alts.length] : [0, 0];
  const pay = payFor(job, tier);
  return {
    id: job.id, step: 0, round, again, tier, day,
    need: needAt(job, tier), have: 0,
    x: place ? place.x + a[0] : undefined, z: place ? place.z + a[1] : undefined,
    renown: pay.renown, emeralds: pay.emeralds,
  };
}

export const stepOf = (job, run) => STEPS[job.kind][run.step];
export const lastStep = (job, run) => run.step >= STEPS[job.kind].length - 1;

// pay as the old board: Renown and coins (old emerald unit, 8 coins each) by kind and tier
const BASE = { hunt: 55, camp: 80, missing: 90, supply: 40, carry: 40, escort: 70, recover: 60, look: 50, watch: 80 };
export function payFor(job, tier) {
  return { renown: Math.round((BASE[job.kind] ?? 50) * (1 + tier * 0.35)), emeralds: (job.kind === "supply" ? 3 : 2) + tier };
}

// ---------- words ----------
export const giverOf = (job) => GIVERS[job.giver];
export const whoAt = (g) => (g.kind === "trader" ? g.name : `${g.name} in ${g.town}`);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const placeName = (job) => PLACES[job.place]?.name ?? "the place";

// The tracker's step: { title, hint } for where this job is now
export function trackerStep(job, run) {
  const g = giverOf(job), to = job.to && GIVERS[job.to];
  switch (stepOf(job, run)) {
    case "talk": return { title: `Talk to ${whoAt(g)} about ${job.about}`, hint: `${cap(job.title)}: a notice from the Town Board.` };
    case "bring": return { title: `Bring ${run.need} ${ITEM_NAMES[job.item] ?? job.item} to ${whoAt(g)}`, hint: job.lines.while?.[0] ?? "" };
    case "deliver": return { title: `Take ${job.thing} to ${whoAt(to)}`, hint: "Click them when you get there." };
    case "escort": return { title: `Walk ${g.name} to ${placeName(job)}`, hint: "Stay close. They walk slower than you." };
    case "home": return { title: `Bring ${job.thing} home to ${g.town}`, hint: "Stay close. Walk, don't run." };
    case "back": return { title: `Go back to ${whoAt(g)}`, hint: job.kind === "recover" ? `Bring ${job.thing}.` : "Tell them it's done." };
    default: break;
  }
  switch (job.kind) {
    case "hunt": return { title: `Kill ${run.need} ${MOB_NAMES[job.mob] ?? "beasts"} at ${placeName(job)}`, hint: `${run.have} of ${run.need}.${job.when?.night ? " They come out at night." : ""}` };
    case "camp": return { title: `Break the raiders' camp at ${placeName(job)}`, hint: run.left !== undefined ? `${run.left} left.` : "Follow the smoke." };
    case "missing": return { title: `Find ${job.thing} at ${placeName(job)}`, hint: "Look round the place, and call out." };
    case "recover": return { title: `Find ${job.thing} at ${placeName(job)}`, hint: "" };
    case "look": return { title: `Go and look at ${placeName(job)}`, hint: job.when?.night ? "It happens at night." : "" };
    case "watch": return { title: `Keep watch at ${placeName(job)}`, hint: run.watching ? "Until the dawn bell." : "From dusk until the dawn bell." };
    default: return { title: job.title, hint: "" };
  }
}

// What the giver says when you first talk to them: the offer, or the again line on a repeat
export const offerLine = (job, run) => (run.again && job.lines.again ? job.lines.again : job.lines.offer);
// The notice on the board: its title, who pinned it, and its text
export function noticeOf(job, mem) {
  const g = giverOf(job);
  const again = repeats(job) && (mem?.done?.[doneKey(job)] ?? 0) > 0;
  return { title: job.title + (again ? " (again)" : ""), from: g.kind === "trader" ? cap(g.name) : `${g.name}, ${g.town}`, text: job.lines.notice };
}

// Remember a finished job: counts, the round, the kind just done
export function finish(mem, job, ctx) {
  mem.done[job.id] = (mem.done[job.id] ?? 0) + 1;
  if (job.shared) mem.done[job.shared] = (mem.done[job.shared] ?? 0) + 1;
  if (repeats(job)) mem.inRound[job.region] = [...new Set([...(mem.inRound[job.region] ?? []), job.id])];
  mem.last = job.kind;
  mem.jobsDone = (mem.jobsDone ?? 0) + 1;
  turnRounds(mem, ctx, [job.region]);
}

// Can this job run now (time of day, raid nights)? ctx.night, ctx.raid
export function timeOk(job, ctx) {
  const w = job.when ?? {};
  if (w.notRaid && ctx.raid) return false;
  return true;
}
