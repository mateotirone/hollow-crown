import { addTests, assert, assertEqual } from "../core/tests.js";
import { WONDER_DESIGNS } from "./designs_data.js";
import { WONDER, WONDERS } from "./data.js";
import { wonderPlan } from "./plans.js";
import {
  forwardOf, stageRows, stageBlocks, perTickFor, claimProblem, payProblem, heldBy, adjustCharge, adjustPay, extraArrivals,
  keepBonus, lordDue, challengeProblem, defendersFor, inGuard,
} from "./rules.js";

addTests("wonders", {
  "every wonder has a design, cut into six stages that hold every block": () => {
    for (const w of WONDERS) {
      const d = WONDER_DESIGNS[w.id];
      assert(d, `${w.id} has no design`);
      assertEqual(d.stages.length, WONDER.stages - 1, w.id);
      let total = 0;
      for (let s = 1; s <= WONDER.stages; s++) {
        const n = stageBlocks(d, s);
        assert(n > 0, `${w.id} stage ${s} is empty`);
        total += n;
      }
      assertEqual(total, d.blocks, `${w.id} stages`);
      assert(stageRows(d, 2).every((r) => r[0] >= d.stages[0]), `${w.id} stage 2 starts at its cut`);
    }
  },
  "sites are far apart, and each front faces a real way": () => {
    for (const a of WONDERS) {
      assert(["n", "s", "e", "w"].includes(a.face), a.id);
      const f = forwardOf(a.face);
      assertEqual(Math.abs(f.x) + Math.abs(f.z), 1, a.id);
      for (const b of WONDERS) if (a !== b) assert(Math.hypot(a.site.x - b.site.x, a.site.z - b.site.z) > 150, `${a.id} and ${b.id}`);
    }
  },
  "each stage draws into a build plan, every block with a known role": () => {
    for (const w of WONDERS) {
      let cells = 0;
      for (let s = 1; s <= WONDER.stages; s++) {
        const p = wonderPlan(w.id, s);
        for (const c of p.cells.values()) assert(p.wonderStyle.roles[c.role], `${w.id} stage ${s}: role ${c.role}`);
        cells += p.cells.size;
        if (s > 1) assertEqual(p.columns.size, 0, `${w.id} stage ${s} has no footings`);
      }
      assertEqual(cells, WONDER_DESIGNS[w.id].blocks, w.id);
      assert(wonderPlan(w.id, 1).columns.size > 0, `${w.id} stage 1 has footings`);
    }
  },
  "a stage rises in about the time set": () => {
    assertEqual(perTickFor(1), 1);
    const n = 3000;
    assert(Math.ceil(n / perTickFor(n) / 20) <= WONDER.stageSeconds, "too slow");
  },
  "only a City may claim, one rising at a time": () => {
    assertEqual(claimProblem({ tier: 1 }), "needCity");
    assertEqual(claimProblem({ tier: 2, rising: true }), "oneAtATime");
    assertEqual(claimProblem({ tier: 3 }), null);
    assertEqual(payProblem({ paid: 2, built: 1 }, { tier: 2 }), "rising");
    assertEqual(payProblem({ paid: 2, built: 2 }, { tier: 2 }), null);
    assertEqual(payProblem({ paid: 6, built: 6 }, { tier: 2 }), "done");
  },
  "effects reach the holder and allies, only once it stands": () => {
    const states = { sun_gate: { holder: "A", built: 6, paid: 6 }, great_horse_fair: { holder: "A", built: 5, paid: 6 }, great_lighthouse: { holder: "B", built: 6, paid: 6 } };
    assertEqual(heldBy(states, "A").join(), "sun_gate");
    assertEqual(heldBy(states, "C", (h, id) => h === "B" && id === "C").join(), "great_lighthouse");
    assertEqual(adjustCharge(100, "railway", ["sun_gate"]), 75);
    assertEqual(adjustCharge(100, "horses", ["sun_gate"]), 100);
    assertEqual(adjustCharge(1, "railway", ["sun_gate"]), 1);
    assertEqual(adjustPay(100, true, ["great_lighthouse"]), 115);
    assertEqual(adjustPay(100, false, ["great_lighthouse"]), 100);
    assertEqual(extraArrivals(["lantern_spire"]), 1);
    assertEqual(keepBonus(100, ["high_watch"]), 120);
    assertEqual(keepBonus(100, []), 100);
  },
  "a lord's crew finishes a stage every few days": () => {
    assertEqual(lordDue(10, 10), 1);
    assertEqual(lordDue(10, 10 + WONDER.lordDaysPerStage), 2);
    assertEqual(lordDue(10, 1000), WONDER.stages);
  },
  "challenges: a City, a resting wonder, and a player holder must be here": () => {
    const w = { holder: "A", built: 3, restUntil: 5 };
    assertEqual(challengeProblem(w, { by: "A", tier: 2, day: 9 }), "yours");
    assertEqual(challengeProblem(w, { by: "B", tier: 1, day: 9, holderHere: true }), "needCity");
    assertEqual(challengeProblem(w, { by: "B", tier: 2, day: 4, holderHere: true }), "resting");
    assertEqual(challengeProblem(w, { by: "B", tier: 2, day: 9 }), "holderAway");
    assertEqual(challengeProblem(w, { by: "B", tier: 2, day: 9, holderHere: true }), null);
    assertEqual(challengeProblem({ holder: "npc:x", built: 1 }, { by: "B", tier: 2, day: 9 }), null);
    assertEqual(challengeProblem({ holder: "A", built: 0 }, { by: "B", tier: 2 }), "nothingToTake");
    assert(defendersFor(6) > defendersFor(1), "more guards on a bigger wonder");
  },
  "the guarded ground covers each wonder": () => {
    for (const w of WONDERS) {
      const b = WONDER_DESIGNS[w.id].box;
      const reach = Math.max(-b.x0, b.x1, -b.z0, b.z1);
      assert(reach + 2 <= WONDER.guard, `${w.id} reaches ${reach}`);
      assert(inGuard(w.site, { x: w.site.x + reach, z: w.site.z - reach }), w.id);
    }
  },
});
