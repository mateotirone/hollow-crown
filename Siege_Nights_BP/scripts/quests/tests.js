import { addTests, assert, assertEqual } from "../core/tests.js";
import { questsFor, pinOf, talkOf, nextBoss, homeBoss, pointer, panelText, hudString, readHud, whereLine, KEY, SPOT, BOSS_STEPS, NOTES, OVERWORLD, UNDERTOW } from "./rules.js";
import { REGIONAL_BOSSES } from "../lore/data/spine.js";
import { WARDS } from "../plots/config.js";

const base = (more = {}) => ({ flags: [], solved: [], got: [], items: {}, keep: true, dim: OVERWORLD, pos: { x: -150, z: -150 }, hollow: {}, ...more });
const fellAll = (...bosses) => bosses.map((b) => `fell_${b}`);
const ids = (f) => questsFor(f).map((q) => q.id);
const THIN = WARDS.filter((w) => w.thin);

addTests("quests", {
  "your railway station is a step until you have been there, even in the first nights": () => {
    const station = { name: "Lanternbog Halt", x: 180, z: 900, built: true, found: false };
    const f = base({ flags: ["wren_met"], plot: "Lanternbog", station, solved: ["local_lanternbog"] });
    const q = questsFor(f).find((x) => x.id === "station");
    assert(q, "station step shown");
    assertEqual(q.target.name, "Lanternbog Halt");
    assertEqual(q.target.x, 180);
    assert(!ids({ ...f, station: { ...station, found: true } }).includes("station"), "gone once you've been there");
    const first = { keep: true, wins: 0, days: 3 };
    assertEqual(ids({ ...f, first }).slice(-1)[0], "station", "beside the first-nights step");
    assert(!ids({ ...f, first, station: undefined }).includes("station"), "no station, no step");
  },
  "the story starts with Sister Wren, and a settlement to found": () => {
    assertEqual(ids(base({ keep: false })), ["wren", "keep"]);
    assertEqual(questsFor(base()).find((q) => q.id === "wren").target.name, "Millbrook");
  },
  "after Wren: your settlement's mystery, then your own region's boss": () => {
    const mystery = { id: "local_frosthelm", name: "The Copper Bell" };
    const f = base({ flags: ["wren_met"], plot: "Frosthelm", mystery });
    assertEqual(ids(f), ["mystery"]);
    assertEqual(ids({ ...f, solved: ["local_frosthelm"] }), ["boss_huntsman"]);
    assertEqual(homeBoss("Gullcliff"), "bride");
    assertEqual(homeBoss(undefined), "reeve", "no settlement: Millbrook's boss");
  },
  "a boss key in the pack sends you to its lock": () => {
    const f = base({ flags: ["wren_met", ...fellAll("reeve")], plot: "Harrowford", items: { "siege:faceless_seal": 1 } });
    assertEqual(nextBoss(f), "seneschal");
    const q = questsFor(f)[0];
    assertEqual(q.id, "boss_seneschal_key");
    assertEqual(q.note, "1 of 5 fallen. Keep every boss's shard. Not in your pack: the Reeve's (beat it again for another).");
    const kept = questsFor({ ...f, items: { ...f.items, "siege:choir_shard_reeve": 1 } })[0];
    assertEqual(kept.note, "1 of 5 fallen. Keep their shards: 1 of 5.");
  },
  "once the home boss is down, the nearest standing boss is next": () => {
    const f = base({ flags: ["wren_met", ...fellAll("reeve")], plot: "Harrowford", pos: { x: -800, z: 380 } });
    assertEqual(nextBoss(f), "bride", "standing by Gull's Rest");
    assertEqual(nextBoss({ ...f, pos: { x: 800, z: 450 } }), "seneschal", "standing by Sunscar");
  },
  "after three bosses Fennick's notes come up beside the boss step, and never point at a thin place": () => {
    const f = base({ flags: ["wren_met", ...fellAll("reeve", "huntsman", "bride")], got: ["surv_01", "surv_04"] });
    const qs = questsFor(f);
    assertEqual(qs.map((q) => q.id), [qs[0].id, "field_notes"]);
    assert(qs[0].id.startsWith("boss_"), "the boss step stays first");
    assertEqual(qs[1].note, "2 of 6 found.");
    assert(!qs[1].target, "no heading to a hidden place");
  },
  "five down: notes, naming the place, the fork, the strike, the Rift": () => {
    const five = fellAll(...REGIONAL_BOSSES);
    assertEqual(ids(base({ flags: five })), ["field_notes"]);
    assertEqual(ids(base({ flags: five, got: NOTES })), ["name_place"]);
    const named = base({ flags: five, solved: ["source"], items: { "siege:choir_shard_reeve": 1, "siege:choir_shard_bride": 2, "siege:choir_shard_mother": 1 } });
    assertEqual(questsFor(named)[0].note, "3 of 5 shards. Still need the Huntsman's and the Seneschal's.");
    const doubles = base({ flags: five, solved: ["source"], items: { "siege:choir_shard_reeve": 5 } });
    assert(questsFor(doubles)[0].note.startsWith("1 of 5"), "five of the same shard is one of five");
    const site = { id: "kings_barrow", name: "The King's Barrow", x: 120, z: 520 };
    const strike = questsFor({ ...named, items: { "siege:tuning_fork": 1 }, site })[0];
    assertEqual(strike.id, "strike");
    assertEqual(strike.target.x, 120);
    assertEqual(ids({ ...named, rift: { x: 1, z: 2, name: "The King's Barrow" } }), ["rift"]);
  },
  "below: the Carter, then the Court, then the Seat, and nothing once Morvane falls": () => {
    const f = base({ flags: fellAll(...REGIONAL_BOSSES), dim: UNDERTOW, hollow: { carter: { x: 5, z: 40 } } });
    assertEqual(ids(f), ["carter"]);
    assertEqual(ids({ ...f, hollow: { cartsong: true } }), ["court"]);
    assertEqual(ids({ ...f, hollow: { choir: true } }), ["seat"]);
    assertEqual(ids({ ...f, morvane: true }), []);
    assertEqual(ids(base({ flags: ["morvane_fallen"] })), [], "the player's own flag also ends it");
  },
  "nothing names the Hollow before the Rift": () => {
    const words = [];
    for (const s of Object.values(BOSS_STEPS)) words.push(s.title, s.hint, s.keyTitle, s.keyHint);
    const five = fellAll(...REGIONAL_BOSSES);
    for (const f of [base({ keep: false }), base({ flags: ["wren_met"] }), base({ flags: five }), base({ flags: five, got: NOTES }),
      base({ flags: five, solved: ["source"] }), base({ flags: five, solved: ["source"], items: { "siege:tuning_fork": 1 } })]) {
      for (const q of questsFor(f)) words.push(q.title, q.hint, q.note ?? "", q.target?.name ?? "");
    }
    for (const w of words) assert(!/hollow|choir|morvane|undertow/i.test(w), `names something too early: ${w}`);
  },
  "every boss's puzzle starts at a town on the map": () => {
    const towns = WARDS.filter((w) => !w.thin).map((w) => w.name);
    for (const [boss, s] of Object.entries(BOSS_STEPS)) assert(towns.includes(s.start.name), `${boss} starts at ${s.start.name}`);
    for (const s of Object.values(BOSS_STEPS)) for (const t of THIN) assert(Math.hypot(s.keyAt.x - t.x, s.keyAt.z - t.z) > 60, `${s.keyTitle} sits on a thin place`);
  },
  "the heading turns with the player": () => {
    const t = { x: 0, z: 100 };
    assertEqual(pointer({ x: 0, z: 0 }, 0, t), { dist: 100, way: "ahead" }, "facing south, it is south");
    assertEqual(pointer({ x: 0, z: 0 }, 180, t).way, "behind you");
    assertEqual(pointer({ x: 0, z: 0 }, 90, t).way, "left", "facing west, south is on the left");
    assertEqual(pointer({ x: 0, z: 0 }, -90, t).way, "right");
    assertEqual(pointer({ x: 0, z: 0 }, -45, t).way, "ahead right");
    const near = { title: "x", target: { name: "Millbrook", x: 5, z: 5, dim: OVERWORLD } };
    assert(whereLine(near, { x: 0, z: 0 }, 0, OVERWORLD).includes("you are here"));
    assert(whereLine(near, { x: 0, z: 0 }, 0, UNDERTOW).includes("open world"));
  },
  "the HUD reads back what the script sends": () => {
    const text = panelText(questsFor(base({ keep: false })), { x: -150, z: -150 }, 0, OVERWORLD);
    assert(text.includes("Find Sister Wren") && text.includes("Millbrook: ") && text.includes("blocks"));
    const s = hudString(text, SPOT.top);
    assert(s.startsWith(KEY));
    assertEqual(readHud(s), { spot: SPOT.top, text });
    assertEqual(readHud(hudString("")).spot, SPOT.hidden, "no steps: the panel hides");
    assert(!readHud(hudString("a hcq: b _b c")).text.includes("hcq:"), "the text never carries the key");
    assert(!/^[0-9.]+$/.test(readHud(s).spot), "the spot marker never looks like a number");
  },
  "the minimap pin is the first step with a place here, and Wren is someone to talk to": () => {
    const qs = questsFor(base({ keep: false }));
    const pin = pinOf(qs, OVERWORLD);
    const mill = WARDS.find((w) => w.name === "Millbrook");
    assertEqual([pin.x, pin.z, pin.kind], [mill.x, mill.z, "goal"]);
    assertEqual(pinOf(qs, UNDERTOW), undefined, "nothing in the other world");
    assertEqual(talkOf(qs).tag, "siege_lore_npc_wren");
  },
  "boss steps mark only people the hint already names": () => {
    const f = (plot) => base({ flags: ["wren_met"], plot });
    assertEqual(talkOf(questsFor(f("Harrowford"))).tag, "siege_clock_keeper");
    assertEqual(talkOf(questsFor(f("Frosthelm"))).tag, "siege_lodge_warden");
    for (const plot of ["Gullcliff", "Redmesa", "Reedmoor"]) assertEqual(talkOf(questsFor(f(plot))), undefined, `${plot}: nobody to mark (the Mirelight changeling must stay unmarked)`);
    const keyed = base({ flags: ["wren_met"], plot: "Harrowford", items: { "siege:stopped_clock_key": 1 } });
    assertEqual(talkOf(questsFor(keyed)), undefined, "with the key, the well, not the keepers");
  },
  "below, the Carter is marked": () => {
    const qs = questsFor(base({ dim: UNDERTOW, flags: fellAll(...REGIONAL_BOSSES), hollow: { carter: { x: 10, z: 20 } } }));
    assertEqual(talkOf(qs).tag, "siege_lore_npc_carter");
    assertEqual(pinOf(qs, UNDERTOW).x, 10);
  },
});
