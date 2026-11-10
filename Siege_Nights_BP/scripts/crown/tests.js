// Self-tests for the Crown. They run at world load, with /scriptevent siege:selftest, and in tools/check.mjs.

import { addTests, assert, assertEqual } from "../siege/api.js";
import { CROWN, IDS } from "./config.js";
import {
  hollowStage, claimNeeded, nightfall, tithed, resolveCrown, gauntletProblem, stormAtNightfall, abandoned, compass, EXILE_STAGES,
  lordId, isNpc, lordGain, lordChallenger, npcDecreeTarget, reachProblem, freshPick, lordApproach, LORD_APPROACHES, nextExileStage,
} from "./rules.js";
import { citadelPlan, colorJobs, planSummary, thronePlace, gateToward, outsideGate, KEEP_HALF } from "./layout.js";
import { BlockTypes, ItemTypes, EntityTypes } from "@minecraft/server";

const PLAN = { banner: { x: 100, z: -40 }, keep: { x: 120, z: -30 }, gate: 0 };

addTests("crown", {
  "nothing repeats: whispers are heard once, lords never come the same way twice, a second exile is shorter": () => {
    const used = [];
    for (let n = 0; n < 5; n++) { const i = freshPick(5, used, 0.7); assert(i >= 0 && !used.includes(i), "a fresh pick"); used.push(i); }
    assertEqual(freshPick(5, used, 0.3), -1, "then silence");
    const seen = LORD_APPROACHES.map((_, t) => JSON.stringify(lordApproach(t).modifiers));
    assertEqual(new Set(seen).size, seen.length, "every approach differs");
    for (let t = 1; t < 9; t++) assert(lordApproach(t).threat >= lordApproach(t - 1).threat, "each attempt is at least as big");
    assert(lordApproach(9).threat > lordApproach(4).threat || lordApproach(9).threat === 3, "still growing past the last approach");
    assertEqual([nextExileStage(0, 1), nextExileStage(0, 2), nextExileStage(3, 2)], [1, 3, 4]);
  },
  "a hand stays on the Heart only while its owner stays close": () => {
    assertEqual(reachProblem({ here: true, distance: 2 }), undefined);
    assert(reachProblem({ here: true, distance: CROWN.reachRange + 1 }), "stepping away lets go");
    assert(reachProblem({ here: false, distance: 0 }), "leaving lets go");
    assert(CROWN.reachSeconds >= 3, "time for someone to object");
  },
  "rival lords build a Claim and the strongest one challenges": () => {
    assert(isNpc(lordId("kell")) && !isNpc("-4294967295") && !isNpc(undefined));
    assertEqual(lordGain({ claim: 10, pace: 7 }, 2, 0), 19);
    assertEqual(lordGain({ claim: 10, pace: 7 }, 0, 0.99), 20);
    const list = [{ key: "a", claim: 100 }, { key: "b", claim: 130 }, { key: "c", claim: 40 }];
    const ask = { need: 100, challenge: null, siegeNumber: 9, graceUntil: 9 };
    assertEqual(lordChallenger(list, ask).key, "b");
    assertEqual(lordChallenger(list, { ...ask, graceUntil: 10 }), undefined, "not during grace");
    assertEqual(lordChallenger(list, { ...ask, challenge: { claimant: "x" } }), undefined, "one Gauntlet at a time");
    assertEqual(lordChallenger(list, { ...ask, need: 200 }), undefined);
    assert(CROWN.lords.length >= 1 && CROWN.lords.every((l) => l.key && l.name && l.title && l.pace > 0), "config lords");
  },
  "a lord's challenge is a siege, and a ruling lord never decrees the same target twice": () => {
    assertEqual(stormAtNightfall({ challenge: { npc: true, missed: 0 }, rulerOnline: true, claimantOnline: false }), "wait");
    assertEqual(npcDecreeTarget(["p1"], null, 0.5), "p1");
    assertEqual(npcDecreeTarget(["p1"], "p1", 0.5), undefined, "a lone player gets every other night off");
    assertEqual(npcDecreeTarget(["p1", "p2"], "p1", 0.99), "p2");
    assertEqual(npcDecreeTarget([], null, 0), undefined);
  },
  "hollowing stages": () => {
    assertEqual(hollowStage(0).name, "Crowned");
    assertEqual(hollowStage(49).name, "Whispering");
    assertEqual(hollowStage(75).name, "Hollow Monarch");
    assertEqual(hollowStage(100).name, "The New Source");
  },
  "a hollow ruler is easier to challenge": () => {
    assertEqual([claimNeeded(0), claimNeeded(74), claimNeeded(75), claimNeeded(100)], [100, 100, 50, 25]);
  },
  "a siege night feeds the Crown, and tithes feed unrest": () => {
    assertEqual(nightfall({ hollowing: 10, unrest: 0, tithe: 0 }), { hollowing: 13, unrest: 0 });
    assertEqual(nightfall({ hollowing: 10, unrest: 2, tithe: 30 }), { hollowing: 16, unrest: 4 });
    assertEqual(nightfall({ hollowing: 99, unrest: 5, tithe: 0 }), { hollowing: 100, unrest: 4 });
  },
  "the tithe never takes more than its share": () => {
    assertEqual(tithed(10, 30), { kept: 7, cut: 3 });
    assertEqual(tithed(3, 10), { kept: 3, cut: 0 });
    assertEqual(tithed(10, 0), { kept: 10, cut: 0 });
  },
  "one taker is crowned, nobody taking means the nearest": () => {
    assertEqual(resolveCrown({ takers: ["b"], fighters: ["a", "b"] }).winner, "b");
    assertEqual(resolveCrown({ takers: [], fighters: ["a", "b"] }), { winner: "a", how: "nearest" });
  },
  "several takers are settled by vote, ties by the Crown": () => {
    assertEqual(resolveCrown({ takers: ["a", "b"], votes: { a: "a", b: "b", c: "b" }, fighters: ["a", "b", "c"] }).winner, "b");
    const tie = resolveCrown({ takers: ["a", "b"], votes: { a: "a", b: "b" }, fighters: ["a", "b"], roll: 0.99 });
    assertEqual([tie.winner, tie.how], ["b", "chosen"]);
    assertEqual(resolveCrown({ takers: ["a", "b"], votes: { c: "zzz" }, fighters: ["a", "b"], roll: 0 }).winner, "a");
  },
  "who may throw down the Gauntlet": () => {
    const ruler = { id: "r", hollowing: 0 };
    const ask = (o) => gauntletProblem({ ruler, playerId: "p", isCourt: false, claim: 100, challenge: null, siegeNumber: 9, graceUntil: 0, ...o });
    assertEqual(ask({}), undefined);
    assert(ask({ ruler: null }), "no ruler");
    assert(ask({ playerId: "r" }), "the ruler");
    assert(ask({ isCourt: true }), "court");
    assert(ask({ claim: 99 }), "weak claim");
    assert(ask({ graceUntil: 10 }), "grace");
    assert(ask({ challenge: { claimant: "x", name: "X" } }), "one at a time");
    assertEqual(ask({ claim: 50, ruler: { id: "r", hollowing: 80 } }), undefined);
  },
  "the Storm only comes when the ruler is here to answer": () => {
    const challenge = { missed: 0 };
    assertEqual(stormAtNightfall({ challenge, rulerOnline: true, claimantOnline: true }), "storm");
    assertEqual(stormAtNightfall({ challenge, rulerOnline: false, claimantOnline: true }), "wait");
    assertEqual(stormAtNightfall({ challenge, rulerOnline: false, claimantOnline: false }), "wait");
    assertEqual(stormAtNightfall({ challenge, rulerOnline: true, claimantOnline: false }), "claimantMissed");
    assertEqual(stormAtNightfall({ challenge: { missed: CROWN.claimantMisses - 1 }, rulerOnline: true, claimantOnline: false }), "lapse");
    assertEqual(stormAtNightfall({ challenge: null, rulerOnline: true, claimantOnline: true }), "none");
  },
  "a ruler who hides for a week loses the Crown": () => {
    const day = 86400000;
    assertEqual(abandoned({ declaredMs: 0, stormed: false }, 6 * day), false);
    assertEqual(abandoned({ declaredMs: 0, stormed: false }, 7 * day), true);
    assertEqual(abandoned({ declaredMs: 0, stormed: true }, 9 * day), false);
    assertEqual(abandoned(null, 9 * day), false);
  },
  "the Long Road Back reaches a full Claim before the last stage": () => {
    const earned = CROWN.claimExileStart + EXILE_STAGES.reduce((n, s) => n + s.claim, 0) + CROWN.claimShard;
    assert(earned >= CROWN.claimNeeded, `only ${earned}`);
    assertEqual(EXILE_STAGES.length, 5);
  },
  "compass words": () => {
    assertEqual(compass({ x: 0, z: 0 }, { x: 0, z: -200 }).dir, "north");
    assertEqual(compass({ x: 0, z: 0 }, { x: 300, z: 300 }).dir, "south-east");
  },
  "the Citadel plan is big, tall and always the same": () => {
    const jobs = citadelPlan(PLAN);
    const sum = planSummary(jobs);
    assert(sum.blocks > 40000 && sum.blocks < 90000, `blocks ${sum.blocks}`);
    assertEqual(sum.top, 75);
    assertEqual(JSON.stringify(citadelPlan(PLAN)) === JSON.stringify(jobs), true);
    for (let i = 1; i < jobs.length; i++) assert(jobs[i].y1 >= jobs[i - 1].y1, "jobs must run bottom to top");
  },
  "the Citadel never builds over its Keep Banner": () => {
    const inside = { ...PLAN, keep: { x: 104, z: -44 } }; // the banner ends up inside the Great Keep
    assert(!citadelPlan(inside).some((j) => j.x === 100 && j.z === -40), "banner column touched");
  },
  "the gate is a real gate": () => {
    for (let gate = 0; gate < 4; gate++) {
      const jobs = citadelPlan({ ...PLAN, gate });
      const bars = jobs.filter((j) => j.block === "port");
      assertEqual(bars.length, 7);
      assert(bars.every((j) => j.y1 === 0 && j.y2 === 8), "portcullis is 9 high");
      assert(bars.length * 9 <= 64, "fits the gate-opening limit");
      const out = outsideGate(PLAN.banner, gate);
      assert(Math.hypot(out.x - PLAN.banner.x, out.z - PLAN.banner.z) > CROWN.citadelRadius, "exile point is off Citadel land");
    }
  },
  "the throne and the Seal stand inside the Great Keep": () => {
    for (let gate = 0; gate < 4; gate++) {
      const t = thronePlace(PLAN.keep, gate);
      const jobs = citadelPlan({ ...PLAN, gate });
      assert(jobs.some((j) => j.block === "throne" && j.x === t.throne.x && j.z === t.throne.z && j.y1 === t.throne.y), "throne where thronePlace says");
      for (const s of [t.throne, t.seal]) assert(Math.max(Math.abs(s.x - PLAN.keep.x), Math.abs(s.z - PLAN.keep.z)) < KEEP_HALF - 1, "inside");
      assert(!jobs.some((j) => j.x === t.seal.x && j.z === t.seal.z && j.block !== "air" && j.y1 <= 2 && j.y2 >= 1), "the Seal's spot is open air");
    }
  },
  "hangings and carpet carry the ruler's color": () => {
    const paint = colorJobs(citadelPlan(PLAN));
    assert(paint.length >= 40, `only ${paint.length}`);
    assert(paint.every((j) => j.block === "wool" || j.block === "carpet"));
  },
  "the gate faces world spawn": () => {
    assertEqual([gateToward({ x: 0, z: 0 }, { x: 50, z: 10 }), gateToward({ x: 0, z: 0 }, { x: -5, z: -90 })], [0, 3]);
  },
  "walls stay inside Citadel land": () => {
    const far = Math.max(...citadelPlan(PLAN).map((j) => Math.hypot(j.x - PLAN.banner.x, j.z - PLAN.banner.z)));
    assert(far < CROWN.citadelRadius, `a piece sits ${far} out`);
  },
  "the Crown's blocks, items and the Seal exist in the pack": () => {
    for (const id of [IDS.cornerstone, IDS.throne, IDS.shardBlock]) assert(BlockTypes.get(id), `missing block ${id}`);
    for (const id of [IDS.scepter, IDS.shardItem, IDS.gauntlet]) assert(ItemTypes.get(id), `missing item ${id}`);
    assert(EntityTypes.get(IDS.seal), "missing the Throne Seal entity");
    assert(EntityTypes.get(IDS.restingHeart), "missing the resting Heart entity");
  },
});
