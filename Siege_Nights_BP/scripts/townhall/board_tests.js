// Self-tests for the Town Board (pure: board_data.js and board_rules.js). Run offline by tools/check.mjs.

import { addTests, assert, assertEqual } from "../core/tests.js";
import { JOBS, SHARED_JOBS, GIVERS, PLACES, NEIGHBOURS, REGIONS, MOB_NAMES, ITEM_NAMES } from "./board_data.js";
import {
  KINDS, STEPS, repeats, blankMemory, noticesFor, startJob, finish, trackerStep, offerLine, noticeOf, openIn, roundDone, poolFor,
  needAt, foesAt, payFor, jobById, NOTICES_PER_DAY, allJobs, SHARED, sharedHome, doneKey,
} from "./board_rules.js";
import { TOWNSFOLK } from "../townsfolk/data.js";
import { NEVER_SAID } from "../townsfolk/rules.js";
import { TOWNS } from "../economy/config.js";
import { WARDS } from "../plots/config.js";
import { BOARD_SITES } from "./board_sites_data.js";

const STORY = { story: true, siegesWon: 5 };

addTests("town board", {
  "every job is whole: giver, place, lines, kind": () => {
    const ids = new Set();
    for (const j of allJobs()) {
      assert(!ids.has(j.id), `${j.id} twice`); ids.add(j.id);
      assert(KINDS.includes(j.kind), `${j.id}: kind ${j.kind}`);
      assert(REGIONS.includes(j.region), `${j.id}: region`);
      assert(GIVERS[j.giver], `${j.id}: giver ${j.giver}`);
      assert(j.title && j.about, `${j.id}: title and about`);
      const L = j.lines ?? {};
      assert(L.notice && L.offer && L.done, `${j.id}: notice, offer and done lines`);
      assert(!/[{}]/.test(Object.values(L).flat().join(" ") + j.title + j.about), `${j.id}: a {word} left unfilled`);
      if (repeats(j)) assert(L.again, `${j.id} repeats, so it needs an again line`);
      if (STEPS[j.kind].includes("go") || j.kind === "escort") assert(PLACES[j.place], `${j.id}: place ${j.place}`);
      if (j.place) assert(PLACES[j.place].region === j.region, `${j.id}: its place is in its region`);
      if (j.kind === "carry") assert(GIVERS[j.to] && L.at && j.thing, `${j.id}: who it goes to, their line, and what it is`);
      if (j.kind === "look") assert(L.seen, `${j.id}: what you see`);
      if (j.kind === "missing") assert(L.found && j.thing, `${j.id}: who and what they say`);
      if (j.kind === "recover") assert(j.find && j.thing, `${j.id}: the thing to find`);
      if (j.kind === "hunt") assert(MOB_NAMES[j.mob] && j.need, `${j.id}: what to hunt and how many`);
      if (j.kind === "supply") assert(ITEM_NAMES[j.item] && j.need, `${j.id}: what to bring`);
      if (j.kind === "watch") assert(j.need && j.foes?.length, `${j.id}: what to keep and who comes`);
      if (j.chain) assert(!repeats(j), `${j.id}: chain steps are one-off`);
    }
  },
  "every giver stands somewhere in the world": () => {
    for (const [key, g] of Object.entries(GIVERS)) {
      if (g.kind === "story") { assert(g.tag && g.where, `${key}: a story person carries a tag and a place`); continue; } // the story pins them
      assert(WARDS.some((w) => w.name === g.town), `${key}: town ${g.town}`);
      if (g.kind === "folk") assert(TOWNSFOLK[g.town]?.people.some((p) => p.name === g.name), `${key}: ${g.name} lives in ${g.town}`);
      else assert(TOWNS.find((t) => t.name === g.town)?.jobs.includes(g.job), `${key}: ${g.town} has a ${g.job}`);
    }
  },
  "a story job that comes first is the only notice, then never comes round again": () => {
    const mem = blankMemory();
    const first = JOBS.find((j) => j.first);
    assert(first, "there is a first story job");
    assert(!noticesFor(1, "p", first.region, mem, STORY).some((j) => j.first), "never on the board by itself");
    assertEqual(noticesFor(1, "p", first.region, mem, { ...STORY, firstJob: first.id }).map((j) => j.id), [first.id]);
    finish(mem, first, STORY);
    assert(!noticesFor(2, "p", first.region, mem, { ...STORY, firstJob: first.id }).some((j) => j.id === first.id), "done: the board opens normally");
  },
  "nobody on the board says what the street doesn't know": () => {
    for (const j of allJobs()) {
      const text = Object.values(j.lines).flat().join(" ").toLowerCase();
      for (const w of NEVER_SAID) assert(!new RegExp(`\\b${w}\\b`).test(text), `${j.id} says "${w}"`);
    }
  },
  "places are on the map, fights away from every plot": () => {
    const plots = [[-470, -300], [260, -480], [300, 130], [-200, 220], [-520, -760], [520, -1010], [-760, -560], [-560, 650], [-230, 560], [260, 980], [700, 60], [760, 860]];
    for (const j of allJobs()) {
      if (!["hunt", "camp", "watch", "escort"].includes(j.kind)) continue;
      const p = PLACES[j.place];
      const d = Math.min(...plots.map(([x, z]) => Math.hypot(p.x - x, p.z - z)));
      assert(d >= 125, `${j.id}: ${p.name} is ${Math.round(d)} from a plot`);
    }
    for (const r of REGIONS) for (const n of NEIGHBOURS[r]) assert(NEIGHBOURS[n].includes(r), `${r} and ${n} border both ways`);
  },
  "three notices a day, the same all day, never the kind just done": () => {
    const mem = blankMemory();
    const a = noticesFor(12, "p1", "Aldmere Vale", mem, STORY), b = noticesFor(12, "p1", "Aldmere Vale", mem, STORY);
    assertEqual(a.map((j) => j.id), b.map((j) => j.id));
    assertEqual(a.length, NOTICES_PER_DAY);
    assertEqual(new Set(a.map((j) => j.giver)).size, a.length);
    mem.last = "camp";
    for (let day = 0; day < 20; day++) assert(!noticesFor(day, "p1", "Aldmere Vale", mem, STORY).some((j) => j.kind === "camp"), "the kind just done is not offered");
  },
  "one-offs once, everyday jobs once a round, then the neighbours": () => {
    const mem = blankMemory();
    const vale = JOBS.filter((j) => j.region === "Aldmere Vale" && !j.first); // a first story job comes only through the story (next test)
    const sharedHere = () => openIn("Aldmere Vale", mem, STORY).filter((j) => j.shared);
    let guard = 0;
    // play the Vale through, taking the first notice each day
    for (let day = 0; (mem.round["Aldmere Vale"] ?? 0) < 1 && guard < 400; day++, guard++) {
      const n = noticesFor(day, "p", "Aldmere Vale", mem, STORY);
      if (!n.length) { mem.last = undefined; continue; }
      finish(mem, n[0], STORY);
    }
    for (const j of sharedHere()) mem.done[j.id] = mem.done[j.shared] = 1; // (shared jobs travel; the next test covers them)
    assert(guard < 400, "the Vale's pool goes round");
    for (const j of vale) assertEqual(mem.done[j.id] ?? 0, 1, `${j.id} done once in the first round`);
    // round two: one-offs never again, everyday jobs back with their again line
    const open = openIn("Aldmere Vale", mem, STORY).filter((j) => !j.shared);
    for (const j of open) assert(repeats(j), `${j.id} came back but is one-off`);
    assertEqual(open.length, vale.filter(repeats).length);
    const run = startJob(open[0], mem, 0, 50);
    assert(run.again && offerLine(open[0], run) === open[0].lines.again, "a repeat uses its again line");
    assert(noticeOf(open[0], mem).title.endsWith("(again)"));
    // and the board now draws from the neighbours too (once they have jobs)
    const { near } = poolFor("Aldmere Vale", mem, STORY);
    assert(Array.isArray(near));
    assert(!roundDone("Aldmere Vale", mem, STORY), "a fresh round is not done");
  },
  "shared jobs: one in each region, given by that town's own trader, living in one region at a time": () => {
    assertEqual(SHARED_JOBS.length, 10);
    assertEqual(SHARED.length, SHARED_JOBS.length * REGIONS.length);
    for (const j of SHARED) {
      assert(GIVERS[j.giver].town && WARDS.some((w) => w.name === GIVERS[j.giver].town), `${j.id}: giver ${j.giver}`);
      if (j.to) assert(GIVERS[j.to].town !== GIVERS[j.giver].town, `${j.id}: carried to another town`);
    }
    const mem = blankMemory();
    for (const s of SHARED_JOBS) {
      const homes = SHARED.filter((j) => j.shared === s.id && openIn(j.region, mem, STORY).includes(j));
      assert(homes.length <= 1, `${s.id} is up in ${homes.length} regions at once`);
    }
    // a one-off shared job done in one region is done everywhere; it moves when a round turns
    const look = SHARED.find((j) => j.kind === "look");
    const home = sharedHome(look, mem);
    mem.round.Frostmarch = 1;
    assert(sharedHome(look, mem) !== home, "a shared job moves on when a round turns");
    mem.done[doneKey(look)] = 1;
    for (const r of REGIONS) assert(!openIn(r, mem, STORY).some((j) => j.shared === look.shared), `${look.shared} done, but up again in ${r}`);
  },
  "a region with no jobs of its own draws from its neighbours once its round has turned": () => {
    const mem = blankMemory();
    mem.round.Frostmarch = 1;
    const n = noticesFor(3, "p", "Frostmarch", mem, STORY);
    assert(n.length > 0 && n.every((j) => NEIGHBOURS.Frostmarch.includes(j.region) || j.region === "Frostmarch"), "Frostmarch borrows from its neighbours");
  },
  "story jobs stay out of Settlement Mode, and jobs wait for their moment": () => {
    const mem = blankMemory();
    const fresh = { story: false, siegesWon: 0 };
    for (let d = 0; d < 30; d++) for (const j of noticesFor(d, "s", "Aldmere Vale", mem, fresh)) {
      assert(!j.story, `${j.id} is a story job`);
      assert(j.when?.after !== "siegeWon", `${j.id} waits for a siege won`);
    }
  },
  "every step has tracker words, and pay grows with tier": () => {
    for (const j of allJobs()) {
      const run = startJob(j, blankMemory(), 2, 1);
      for (let s = 0; s < STEPS[j.kind].length; s++) {
        run.step = s;
        const t = trackerStep(j, run);
        assert(t.title && !/undefined|NaN/.test(t.title + t.hint), `${j.id} step ${s}: ${t.title} / ${t.hint}`);
      }
      assert(needAt(j, 4) >= needAt(j, 0), `${j.id}: need grows`);
      assert(payFor(j, 4).renown > payFor(j, 0).renown);
      for (const [type, n] of foesAt(j, 4)) assert(type.startsWith("siege:") && n > 0, `${j.id}: foes ${type}`);
    }
    assert(jobById("vale_toll").kind === "camp");
  },
  "every job site is built, with the marks its job needs": () => {
    const NEEDS = { camp: "foe", hunt: "foe", look: "look", recover: "find", missing: "person" };
    for (const j of JOBS) {
      if (!j.site) continue;
      const d = BOARD_SITES[j.site];
      assert(d?.palette?.length && d.rows?.length, `${j.id}: site ${j.site} is built (map/structures/board_sites.py)`);
      const kinds = new Set((d.marks ?? []).map((m) => m[3]));
      const need = j.kind === "watch" ? (j.animal ? "sheep" : "lamp") : NEEDS[j.kind];
      if (need) assert(kinds.has(need), `${j.id}: ${j.site} has a ${need} mark`);
      if (j.kind === "watch") assert(d.marks.filter((m) => m[3] === need).length >= j.need[1], `${j.id}: enough ${need}s to keep`);
    }
    for (const [key, d] of Object.entries(BOARD_SITES)) {
      for (const k of ["x0", "x1", "z0", "z1"]) assert(Math.abs(d.box[k]) % 1 === 0, `${key}: box`);
      assert(d.mode === "rigid" || d.mode === "drape", `${key}: mode`);
    }
  },
});
