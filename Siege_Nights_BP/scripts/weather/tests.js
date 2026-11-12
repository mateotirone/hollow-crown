import { addTests, assert, assertEqual } from "../siege/api.js";
import { CUES } from "../core/sfx_cues.js";
import { regionAt } from "../minimap/data.js";
import {
  KINDS, KIND, REGIONS, REGION_OF_PLACE, SKY, fogId, fogIds, pickKind, newSpell, fullStep, stepFor, nextShown, windVector,
  isCanopy, edgeDistance, edgeStep,
} from "./data.js";

const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };

addTests("weather", {
  "every kind is whole: unique id, a region, steps, a particle, sounds that exist": () => {
    assertEqual(new Set(KINDS.map((k) => k.id)).size, KINDS.length);
    for (const k of KINDS) {
      assert(/^[a-z_]+$/.test(k.id) && k.name && k.arrive, `${k.id}: id, name or arrive line missing`);
      assert(Object.values(REGION_OF_PLACE).includes(k.region), `${k.id}: unknown region ${k.region}`);
      assert(k.steps.length >= 1 && k.steps.length <= 3, `${k.id}: 1 to 3 steps`);
      for (const s of k.steps) assert(s.from < s.to && (s.type === "render" ? s.to <= 1 : s.to >= 12), `${k.id}: a step can't be seen through`);
      assert(k.particle?.id?.startsWith("siege:wx_"), `${k.id}: particle`);
      for (const s of k.sounds) assert(CUES[s.cue], `${k.id}: no sound cue ${s.cue}`);
      assert(k.minutes[0] > 0 && k.minutes[0] <= k.minutes[1], `${k.id}: minutes`);
    }
  },
  "every region but the Hollow has weather, and the Blackfen, coast, desert and passes have two kinds": () => {
    for (const r of ["Aldmere Vale", "Frostmarch", "Saltreach", "Blackfen", "Emberwaste"]) assert(REGIONS.includes(r), `${r} has no weather`);
    for (const r of ["Frostmarch", "Saltreach", "Blackfen", "Emberwaste"]) assert(KINDS.filter((k) => k.region === r).length >= 2, `${r} has one kind only`);
    assertEqual(new Set(fogIds()).size, fogIds().length);
    assertEqual(fogId("sandstorm", 3), "siege:wx_sandstorm_3");
  },
  "the map knows where each region's weather blows": () => {
    assertEqual(REGION_OF_PLACE[regionAt(260, 980)], "Blackfen"); // Lanternbog
    assertEqual(REGION_OF_PLACE[regionAt(760, 860)], "Emberwaste"); // Dunehold
    assertEqual(REGION_OF_PLACE[regionAt(520, -1010)], "Frostmarch"); // Wolfcairn
    assertEqual(REGION_OF_PLACE[regionAt(-470, -300)], "Aldmere Vale"); // Harrowford
  },
  "a region never gets the same kind twice running when another could come": () => {
    const noon = { time: 6000, raining: false };
    for (let i = 0; i < 20; i++) assertEqual(pickKind("Emberwaste", noon, "sandstorm", () => i / 20).id, "dust_wind");
    assertEqual(pickKind("Aldmere Vale", noon, undefined), undefined, "no morning mist at noon");
    assertEqual(pickKind("Aldmere Vale", { time: 23500, raining: false }, "dawn_mist").id, "dawn_mist", "the only kind may come again");
    assertEqual(pickKind("Blackfen", noon, undefined, () => 0.999).id, "fen_mist", "no marsh lights by day");
  },
  "a spell builds up a step at a time, holds, and thins out at the end": () => {
    const k = KIND.sandstorm;
    const spell = newSpell(k, 1000, seq(0.5, 0.5));
    assert(spell.until - spell.from >= k.minutes[0] * 1200 && spell.until - spell.from <= k.minutes[1] * 1200, "length");
    assertEqual(fullStep(spell, 1000), 1);
    assertEqual(fullStep(spell, 1000 + SKY.stepTicks), 2);
    assertEqual(fullStep(spell, 1000 + SKY.stepTicks * 2), 3);
    assertEqual(fullStep(spell, spell.until - 1), 1);
    assertEqual(fullStep(spell, spell.until), 0);
    assertEqual(fullStep(undefined, 5), 0);
  },
  "a roof thins it and a cave shuts it out": () => {
    assertEqual(stepFor(3), 3);
    assertEqual(stepFor(3, { covered: true, depth: 2 }), SKY.roofCap);
    assertEqual(stepFor(3, { covered: true, depth: SKY.deep }), 0);
  },
  "the fog moves one step at a time, and thins the old kind away before a new one": () => {
    let s = { kind: undefined, step: 0 };
    s = nextShown(s, { kind: "fen_mist", step: 3 }); assertEqual(`${s.kind}${s.step}`, "fen_mist1");
    s = nextShown(s, { kind: "fen_mist", step: 3 }); assertEqual(s.step, 2);
    s = nextShown(s, { kind: "sea_fret", step: 2 }); assertEqual(`${s.kind}${s.step}`, "fen_mist1");
    s = nextShown(s, { kind: "sea_fret", step: 2 }); assertEqual(s.step, 0);
    s = nextShown(s, { kind: "sea_fret", step: 2 }); assertEqual(`${s.kind}${s.step}`, "sea_fret1");
    s = nextShown(s, { kind: undefined, step: 0 }); assertEqual(s.step, 0);
  },
  "fen mist is hazy, not a wall: every step a share of the render distance with a long fade": () => {
    for (const st of KIND.fen_mist.steps) assert(st.type === "render" && st.to - st.from >= 0.5 && st.to >= 0.5, "fen mist step too thick");
  },
  "trees are not a roof": () => {
    assert(isCanopy("minecraft:mangrove_leaves") && isCanopy("minecraft:vine") && isCanopy("minecraft:mangrove_roots"), "canopy");
    assert(!isCanopy("minecraft:spruce_planks") && !isCanopy("minecraft:stone"), "a real roof");
  },
  "a spell thins toward its region's border instead of ending in a wall": () => {
    const half = (x) => (x < 0 ? "Blackfen" : "Aldmere Vale");
    assertEqual(edgeDistance(-500, 0, "Blackfen", half), SKY.edge, "deep inside");
    assert(edgeDistance(-30, 0, "Blackfen", half) < 40, "close to the border");
    assertEqual(edgeStep(3, 3, SKY.edge), 3);
    assertEqual(edgeStep(3, 3, 12), 1);
    assertEqual(edgeStep(3, 3, SKY.edge / 2), 2);
    assertEqual(edgeStep(1, 3, SKY.edge), 1, "never thicker than the spell itself");
    assertEqual(REGION_OF_PLACE[regionAt(260, 980)], "Blackfen");
    assertEqual(edgeDistance(260, 980, "Blackfen", (x, z) => REGION_OF_PLACE[regionAt(x, z)]) > 24, true, "Lanternbog sits well inside the fen");
  },
  "wind blows away from where it comes from": () => {
    const north = windVector(0), west = windVector(270);
    assert(Math.abs(north.x) < 1e-9 && north.z > 0.99, "a north wind blows south");
    assert(west.x > 0.99 && Math.abs(west.z) < 1e-9, "a west wind blows east");
  },
});
