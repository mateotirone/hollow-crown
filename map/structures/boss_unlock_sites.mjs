// Dumps the five boss unlock set pieces (Siege_Nights_BP/scripts/unlocks/) as block lists, built on flat ground the way
// `/scriptevent siege:unlock <site> here` builds them. Read by boss_unlock_sites.py for the 3D viewer, and usable as
// the keep-out mask for anything built round them (every cell here is one the boss code relies on).
//   node map/structures/boss_unlock_sites.mjs > sites.json
import { huntPlan, chapelPlan, vaultPlan, cradlePlan, mirelightPlan, HUNT, CHAPEL, VAULT, CRADLE } from "../../Siege_Nights_BP/scripts/unlocks/plans.js";
import { makeHunt, makePews, VILLAGERS } from "../../Siege_Nights_BP/scripts/unlocks/puzzles.js";
import { wellOps, chamberOps, postOps, WELL } from "../../Siege_Nights_BP/scripts/unlocks/well_plan.js";
import { CLOCKS, KEEPERS, makePuzzle } from "../../Siege_Nights_BP/scripts/unlocks/keepers.js";

const run = (gen) => { let r; do { r = gen.next(); } while (!r.done); return r.value; };
const flat = () => ({ top: 0, water: undefined, ground: 0 });
const here = { x: 0, y: 0, z: 0 };
const p = makePuzzle(7);
const reeveOps = [...chamberOps(), ...wellOps()];
CLOCKS.forEach((c, i) => reeveOps.push(...postOps(p.layout[i], i === 0, `${c.short} Clock\nkept by\n${KEEPERS[i].name}`).ops));
const sites = {
  reeve: { title: "Clockwork Reeve: Millbrook well, clock posts and the chamber", map: { x: null, z: null, note: "the Millbrook square" },
    ops: reeveOps, spots: { chamberFloorDy: WELL.floorY, chamberR: WELL.roomR } },
  huntsman: { title: "Pale Huntsman: the Hunter's Cairn on Hallowmere", map: { x: 60, z: -1130 },
    ...run(huntPlan(flat, here, makeHunt(7))), spots: { arenaR: HUNT.arena, crackR: HUNT.crack, iceDiscR: HUNT.disc, spawn: [0.5, 1, 9.5] } },
  bride: { title: "Drowned Bride: the Chapel of Saint Brannoc, Gull Bay", map: { x: -690, z: 130 },
    ...run(chapelPlan(flat, here, makePews(7))), spots: { nave: CHAPEL.nave, tower: CHAPEL.tower, altar: CHAPEL.altar, spawn: [CHAPEL.altar.dx - 1.5, 1, 0.5] } },
  seneschal: { title: "Ash Seneschal: the Faceless Vault under Sunscar", map: { x: 850, z: 516 },
    ...run(vaultPlan(flat, here)), spots: { ...VAULT, spawn: [0.5, VAULT.floor + 1, -41.5] } },
  mother: { title: "Mother of Changelings: the cave under the Cradle Tree", map: { x: -120, z: 1060 },
    ...run(cradlePlan(flat, here)), spots: { ...CRADLE, spawn: [0.5, CRADLE.floor + CRADLE.h - 2, 4.5] } },
  mirelight: { title: "Mirelight lantern square (the five villagers)", map: { x: -60, z: 900 },
    ...run(mirelightPlan(flat, here, VILLAGERS)), spots: {} },
};
const out = {};
for (const [id, s] of Object.entries(sites)) {
  out[id] = { title: s.title, map: s.map, spots: s.spots, info: s.info ?? null,
    ops: s.ops.map((o) => [o.dx, o.dy, o.dz, o.block, o.states ?? null]) };
}
process.stdout.write(JSON.stringify(out));
