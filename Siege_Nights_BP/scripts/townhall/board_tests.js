// Self-tests for the Town Board (pure: board_data.js and board_rules.js). Run offline by tools/check.mjs.

import { addTests, assert, assertEqual } from "../core/tests.js";
import { JOBS, GIVERS, PLACES, NEIGHBOURS, REGIONS, MOB_NAMES, ITEM_NAMES } from "./board_data.js";
import {
  KINDS, STEPS, repeats, blankMemory, noticesFor, startJob, finish, trackerStep, offerLine, noticeOf, openIn, roundDone, poolFor,
  needAt, foesAt, payFor, jobById, NOTICES_PER_DAY,
} from "./board_rules.js";
import { TOWNSFOLK } from "../townsfolk/data.js";
import { NEVER_SAID } from "../townsfolk/rules.js";
import { TOWNS } from "../economy/config.js";
import { WARDS } from "../plots/config.js";

const STORY = { story: true, siegesWon: 5 };

addTests("town board", {
  "every job is whole: giver, place, lines, kind": () => {
    const ids = new Set();
    for (const j of JOBS) {
      assert(!ids.has(j.id), `${j.id} twice`); ids.add(j.id);
      assert(KINDS.includes(j.kind), `${j.id}: kind ${j.kind}`);
      assert(REGIONS.includes(j.region), `${j.id}: region`);
      assert(GIVERS[j.giver], `${j.id}: giver ${j.giver}`);
      assert(j.title && j.about, `${j.id}: title and about`);
      const L = j.lines ?? {};
      assert(L.notice && L.offer && L.done, `${j.id}: notice, offer and done lines`);
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
      assert(WARDS.some((w) => w.name === g.town), `${key}: town ${g.town}`);
      if (g.kind === "folk") assert(TOWNSFOLK[g.town]?.people.some((p) => p.name === g.name), `${key}: ${g.name} lives in ${g.town}`);
      else assert(TOWNS.find((t) => t.name === g.town)?.jobs.includes(g.job), `${key}: ${g.town} has a ${g.job}`);
    }
  },
  "nobody on the board says what the street doesn't know": () => {
    for (const j of JOBS) {
      const text = Object.values(j.lines).flat().join(" ").toLowerCase();
      for (const w of NEVER_SAID) assert(!new RegExp(`\\b${w}\\b`).test(text), `${j.id} says "${w}"`);
    }
  },
  "places are on the map, fights away from every plot": () => {
    const plots = [[-470, -300], [260, -480], [300, 130], [-200, 220], [-520, -760], [520, -1010], [-760, -560], [-560, 650], [-230, 560], [260, 980], [700, 60], [760, 860]];
    for (const j of JOBS) {
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
    const vale = JOBS.filter((j) => j.region === "Aldmere Vale");
    let guard = 0;
    // play the Vale through, taking the first notice each day
    for (let day = 0; (mem.round["Aldmere Vale"] ?? 0) < 1 && guard < 400; day++, guard++) {
      const n = noticesFor(day, "p", "Aldmere Vale", mem, STORY);
      if (!n.length) { mem.last = undefined; continue; }
      finish(mem, n[0], STORY);
    }
    assert(guard < 400, "the Vale's pool goes round");
    for (const j of vale) assertEqual(mem.done[j.id] ?? 0, 1, `${j.id} done once in the first round`);
    // round two: one-offs never again, everyday jobs back with their again line
    const open = openIn("Aldmere Vale", mem, STORY);
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
    for (const j of JOBS) {
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
});
