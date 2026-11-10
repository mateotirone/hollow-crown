import { addTests, assert, assertEqual } from "../core/tests.js";
import { PLOT_PLAN } from "../plots/config.js";
import { BUILDING, drawBuilding } from "../settle/buildings.js";
import { hallReserve, footprint, boxesTouch } from "../settle/rules.js";
import { STYLE_IDS } from "../townhall/styles.js";
import { RIVALS, STAGES, HALL_SPOT, LINES, TEMPERAMENTS, makeLord, wanted, night, nextPiece, tierForWins, partKey } from "./data.js";

addTests("rivals", {
  "every planned plot gets a different lord": () => {
    const names = [];
    for (const plot of PLOT_PLAN) names.push(makeLord({ ...plot, y: 64 }, "seed", names).name);
    assertEqual(new Set(names).size, PLOT_PLAN.length);
  },
  "a lord is the same for the same seed": () => {
    assertEqual(makeLord({ ...PLOT_PLAN[0], y: 64 }, "a").name, makeLord({ ...PLOT_PLAN[0], y: 64 }, "a").name);
  },
  "plots are always left for players": () => {
    assertEqual(wanted("none", 12, 0), 0);
    assertEqual(wanted("few", 12, 0), RIVALS.few);
    assertEqual(wanted("all", 12, 0), 12 - RIVALS.leaveFree);
    assertEqual(wanted("all", RIVALS.leaveFree, 4), 4);
  },
  "lords climb the tiers over many nights": () => {
    const lord = makeLord({ ...PLOT_PLAN[0], y: 64 }, "seed");
    for (let n = 0; n < 40; n++) night(lord, n);
    assertEqual(lord.tier, 3);
    assertEqual(tierForWins(5), 1);
  },
  "every temperament has lines and a hold chance": () => {
    for (const t of TEMPERAMENTS) assert(LINES[t]?.length >= 3 && RIVALS.holdChance[t] > 0, t);
  },
  "stage buildings exist, miss each other and miss the hall": () => {
    const halls = STYLE_IDS.map((style) => hallReserve({ x: HALL_SPOT.dx, z: HALL_SPOT.dz, fx: HALL_SPOT.f.x, fz: HALL_SPOT.f.z, style }, 1));
    const boxes = [];
    for (const stage of STAGES) for (const part of stage) {
      assert(BUILDING[part.b], part.b);
      const box = footprint({ x: part.dx, z: part.dz }, part.f, drawBuilding(part.b, "vale").bounds());
      assert(!halls.some((hall) => boxesTouch(box, hall)), `${part.b} at ${part.dx},${part.dz} stands where the hall grows`);
      for (const other of boxes) assert(!boxesTouch(box, other), `${part.b} at ${part.dx},${part.dz} overlaps another building`);
      assert(Math.max(Math.abs(box.x0), Math.abs(box.x1), Math.abs(box.z0), Math.abs(box.z1)) <= 60, `${part.b} is too far out`);
      boxes.push(box);
    }
  },
  "a settlement is built hall first, stage by stage": () => {
    const lord = makeLord({ ...PLOT_PLAN[0], y: 64 }, "seed");
    assertEqual(nextPiece(lord).hall, 1);
    lord.built.hall = 1;
    assertEqual(nextPiece(lord).part.b, STAGES[0][0].b);
    lord.built.parts = STAGES[0].map((_, i) => partKey(0, i));
    assertEqual(nextPiece(lord), undefined);
    lord.tier = 1;
    assertEqual(nextPiece(lord).hall, 2);
  },
});
