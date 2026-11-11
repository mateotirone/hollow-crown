import { BlockTypes, ItemTypes, EntityTypes } from "@minecraft/server";
import { addTests, assert, assertEqual } from "../core/tests.js";
import { ALMANAC, CHAPTERS, ENTRIES } from "./data.js";
import { KINDS, NAMING_CHAPTERS, namesTheHollow, parseWhen, buildIndex, entriesFor, readMarks, writeMarks, visible, chapterList } from "./rules.js";

// Blocks and items pages may name before their pull request is merged (the page stays away until then).
// Take a line out once its PR is in main.
const PENDING = {
  "siege:foresters_lodge": 94,
  "siege:old_oak_log": 94,
  "siege:track": 88,
  "siege:train_engine": 88,
  "siege:train_coach": 88,
};

const inPack = (id) => {
  try {
    return !!(ItemTypes.get(id) ?? BlockTypes.get(id) ?? EntityTypes.get(id));
  } catch {
    return false;
  }
};

addTests("guide", {
  "every page has an id, a known chapter, a title and words, and ids are used once": () => {
    const chapters = new Set(CHAPTERS.map((c) => c.id));
    const ids = new Set();
    for (const e of ENTRIES) {
      assert(/^[a-z_]+$/.test(e.id), `bad id "${e.id}"`);
      assert(!ids.has(e.id), `"${e.id}" is used twice`);
      ids.add(e.id);
      assert(chapters.has(e.ch), `${e.id}: unknown chapter ${e.ch}`);
      assert(e.title && e.page, `${e.id}: needs a title and a page`);
      assert(e.page.length <= 1800, `${e.id}: the page is too long for one screen (${e.page.length})`);
      assert((e.tip ?? "").length <= 180, `${e.id}: the tip is too long for one chat line`);
      assert(Array.isArray(e.when), `${e.id}: when must be a list (it can be empty)`);
    }
  },
  "every 'when' is a known kind of meeting": () => {
    for (const e of ENTRIES) for (const spec of e.when) {
      const { kind, what } = parseWhen(spec);
      assert(KINDS.includes(kind), `${e.id}: "${spec}" is not one of ${KINDS.join(", ")}`);
      assert(what.length > 0, `${e.id}: "${spec}" names nothing`);
    }
  },
  "a hidden page can be met, and a page with a tip has something that triggers it": () => {
    for (const e of ENTRIES) {
      if (e.hidden) assert(e.when.length > 0, `${e.id} is hidden but nothing ever shows it`);
      if (e.tip) assert(e.when.length > 0, `${e.id} has a tip that would never be said`);
    }
  },
  "no page names the Hollow before the story does": () => {
    for (const e of ENTRIES) {
      if (NAMING_CHAPTERS.has(e.ch)) {
        assert(e.hidden, `${e.id}: pages in "${e.ch}" must be hidden until met`);
        continue;
      }
      for (const text of [e.title, e.tip, e.page]) assert(!namesTheHollow(text), `${e.id} names the Hollow: "${text?.slice(0, 60)}..."`);
    }
    assert(namesTheHollow("deep in the Hollow"));
    assert(!namesTheHollow("The Hollow Crown"));
  },
  "every block, item and entity a page names is in the pack (or waiting on its pull request)": () => {
    const named = new Set();
    for (const e of ENTRIES) {
      if (e.needs) named.add(e.needs);
      for (const spec of e.when) {
        const { kind, what } = parseWhen(spec);
        if (kind === "event" || what.endsWith("*") || what.startsWith("tag:") || what.startsWith("minecraft:")) continue;
        named.add(what);
      }
    }
    for (const id of named) assert(inPack(id) || PENDING[id], `${id} is not in the pack; fix the page or add it to PENDING with its PR`);
    assert(inPack(ALMANAC.item), "the Almanac item itself is missing");
  },
  "a page that needs a missing feature carries that need": () => {
    for (const e of ENTRIES) for (const spec of e.when) {
      const { what } = parseWhen(spec);
      if (PENDING[what]) assert(e.needs && PENDING[e.needs], `${e.id} meets on ${what} (PR #${PENDING[what]}) but has no matching needs`);
    }
  },
  "meeting matches exact names, prefixes and tags": () => {
    const index = buildIndex([
      { id: "a", when: ["place:siege:castle_stone*", "talk:tag:siege_mason"] },
      { id: "b", when: ["place:siege:castle_gate", "event:siegeStart"] },
    ]);
    assertEqual(entriesFor(index, "place", ["siege:castle_stone_frostmarch"]), ["a"]);
    assertEqual(entriesFor(index, "place", ["siege:castle_gate"]), ["b"]);
    assertEqual(entriesFor(index, "place", ["siege:castle_gate_blackfen"]), []);
    assertEqual(entriesFor(index, "talk", ["minecraft:npc", "tag:siege_mason"]), ["a"]);
    assertEqual(entriesFor(index, "event", ["siegeStart"]), ["b"]);
    assertEqual(entriesFor(index, "nonsense", ["x"]), []);
  },
  "marks survive saving, and broken saves start clean": () => {
    const marks = { m: ["regals", "seeps"], r: ["regals"], off: true };
    assertEqual(readMarks(writeMarks(marks)), marks);
    assertEqual(readMarks(undefined), { m: [], r: [], off: false });
    assertEqual(readMarks("{not json"), { m: [], r: [], off: false });
    assertEqual(readMarks(writeMarks({ m: [], r: [], off: false })).off, false);
  },
  "hidden pages show only once met; pages for missing features never show": () => {
    const seeps = ENTRIES.find((e) => e.id === "seeps");
    assert(!visible(seeps, readMarks(undefined)));
    assert(visible(seeps, { m: ["seeps"], r: [], off: false }));
    const trains = ENTRIES.find((e) => e.id === "trains");
    assert(!visible(trains, { m: ["trains"], r: [], off: false }, () => false));
    const fresh = chapterList(readMarks(undefined), () => true);
    assert(fresh.length >= 6, "a newcomer sees most chapters");
    assert(!fresh.some((c) => NAMING_CHAPTERS.has(c.id)), "a newcomer never sees the chapters that name the place");
  },
});
