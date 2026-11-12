import { addTests, assert, assertEqual } from "../core/tests.js";
import { PLOT_PLAN } from "../plots/config.js";
import { WORKINGS, TIERS, WORKS, planOf, entranceBearings, spotAt, digDirection, chamberOf, inChamber, slotsOf, oreFor, topOre, regrowDue, richFor, bearing } from "./data.js";

const apart = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

addTests("workings", {
  "each Working sits by its own settlement, outside the plot, away from its gate and landmark": () => {
    for (const w of WORKINGS) {
      const plan = planOf(w);
      assert(plan, `${w.id}: no plot named ${w.plot}`);
      assert(TIERS[w.tier], `${w.id}: no tier ${w.tier}`);
      const b = entranceBearings(plan)[0], at = spotAt(plan, b);
      const d = Math.hypot(at.x - plan.x, at.z - plan.z);
      assert(d > 80 && d < 110, `${w.id} is ${d} from the plot`);
      assert(apart(b, plan.gate) >= 60, `${w.id} is in front of the gate`);
      assert(apart(b, bearing(plan, plan.relic)) >= 60, `${w.id} is on the landmark`);
      for (const other of PLOT_PLAN) if (other !== plan) assert(Math.hypot(at.x - other.x, at.z - other.z) > 120, `${w.id} is too close to ${other.name}`);
    }
  },
  "the strengths: iron at two towns, gold in the Emberwaste, diamond at Wolfcairn alone, no netherite": () => {
    assertEqual(WORKINGS.filter((w) => w.tier === "iron").map((w) => w.plot).sort(), ["Frosthelm", "Gullcliff"]);
    assertEqual(WORKINGS.filter((w) => w.tier === "gold").map((w) => planOf(w).region), ["Emberwaste", "Emberwaste"]);
    assertEqual(WORKINGS.filter((w) => w.tier === "diamond").map((w) => w.plot), ["Wolfcairn"]);
    assert(!TIERS.netherite, "netherite comes from bosses and trading, not a mine");
  },
  "harder up the ladder: deeper, slower to refill, more claim jumpers": () => {
    const [a, b, c] = ["iron", "gold", "diamond"].map((t) => TIERS[t]);
    assert(a.depth < b.depth && b.depth < c.depth, "deeper");
    assert(a.regrowDays <= b.regrowDays && b.regrowDays <= c.regrowDays, "slower");
    assert(a.jumpers.chance <= b.jumpers.chance && b.jumpers.chance < c.jumpers.chance, "more dangerous");
    for (const t of Object.values(TIERS)) for (const k of ["x", "y", "z"]) assert(t.r[k] > 0, "chamber size");
  },
  "the stair runs straight away from the plot and ends at the chamber": () => {
    assertEqual(digDirection(90), { x: 1, z: 0 });
    assertEqual(digDirection(180), { x: 0, z: 1 });
    assertEqual(digDirection(0), { x: 0, z: -1 });
    const c = chamberOf("iron", { x: 0, y: 70, z: 0 }, { x: 1, z: 0 });
    assertEqual(c.floor, 70 - TIERS.iron.depth);
    assert(inChamber(c, TIERS.iron.r, c.x, c.floor + 1, c.z) && !inChamber(c, TIERS.iron.r, c.x, c.floor - 1, c.z), "open above the floor only");
  },
  "every ore spot is in the wall, touching the open chamber, and the same in every world": () => {
    const w = WORKINGS[0], at = { x: 0, y: 70, z: 0 }, c = chamberOf(w.tier, at, { x: 1, z: 0 });
    const a = slotsOf(w, c, at), b = slotsOf(w, c, at);
    assertEqual(a, b);
    assert(a.length >= TIERS[w.tier].slots, `only ${a.length} spots`);
    for (const s of a.slice(0, 20)) assert(!inChamber(c, TIERS[w.tier].r, s.x, s.y, s.z), "a spot is in the open");
  },
  "ore: the tier's own ore is common, deep spots get deepslate, a rich week brings more of the best": () => {
    assertEqual(oreFor("iron", 0.99, 40), "minecraft:iron_ore");
    assertEqual(oreFor("diamond", 0, -10), "minecraft:deepslate_diamond_ore");
    assertEqual(TIERS.gold.ores[topOre("gold")][0], "gold_ore");
    const share = (rich) => { let n = 0; for (let i = 0; i < 1000; i++) if (oreFor("diamond", i / 1000, 10, rich) === "minecraft:diamond_ore") n++; return n; };
    assert(share(true) > share(false), "rich weeks give more diamonds");
  },
  "refills come round on time, and every Working takes its turn running rich": () => {
    assert(regrowDue("iron", undefined, 0), "a new Working fills at once");
    assert(!regrowDue("diamond", 10, 12) && regrowDue("diamond", 10, 13), "diamond every 3 days");
    const seen = new Set();
    for (let week = 0; week < WORKINGS.length; week++) seen.add(richFor(week * WORKS.richEvery));
    assertEqual(seen.size, WORKINGS.length);
  },
});
