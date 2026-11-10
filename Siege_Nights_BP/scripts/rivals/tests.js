import { addTests, assert, assertEqual } from "../core/tests.js";
import { PLOT_PLAN } from "../plots/config.js";
import { BUILDING, drawBuilding } from "../settle/buildings.js";
import { hallReserve, footprint, boxesTouch } from "../settle/rules.js";
import { STYLE_IDS } from "../townhall/styles.js";
import { RIVALS, STAGES, LINES, TEMPERAMENTS, makeLord, wanted, night, nextPiece, tierForWins, partKey, hallSpot, partSpot, estateOf, winsForEstate, takeEstate } from "./data.js";

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
  "stage buildings exist, miss each other and miss the hall, whichever way the gate faces": () => {
    for (const gate of ["north", "east", "south", "west"]) {
      const at = { x: 0, z: 0 }, h = hallSpot(at, gate);
      const halls = STYLE_IDS.map((style) => hallReserve({ x: h.x, z: h.z, fx: h.forward.x, fz: h.forward.z, style }, 1));
      const boxes = [];
      for (const stage of STAGES) for (const part of stage) {
        assert(BUILDING[part.building], part.building);
        const spot = partSpot(at, gate, part);
        const box = footprint(spot, spot.forward, drawBuilding(part.building, "vale").bounds());
        assert(!halls.some((hall) => boxesTouch(box, hall)), `${part.id} (${gate}) stands where the hall grows`);
        for (const other of boxes) assert(!boxesTouch(box, other), `${part.id} (${gate}) overlaps another building`);
        assert(Math.max(Math.abs(box.x0), Math.abs(box.x1), Math.abs(box.z0), Math.abs(box.z1)) <= 44, `${part.id} is too near the wall`);
        boxes.push(box);
      }
    }
  },
  "a settlement is handed on as the lord left it": () => {
    const lord = makeLord({ ...PLOT_PLAN[0], y: 64 }, "seed");
    lord.tier = 2; lord.wins = 7; lord.built = { hall: 2, parts: [partKey(0, 0), partKey(1, 1)] };
    const estate = estateOf(lord);
    assertEqual(estate.tier, 2);
    assertEqual(winsForEstate(estate, 1), 7);
    assertEqual(winsForEstate(estate, 12), 12, "a player never loses wins by taking a settlement over");
    assertEqual(winsForEstate({ tier: 3 }, 0), RIVALS.tierWins[3]);
    const heir = takeEstate(makeLord({ ...PLOT_PLAN[0], y: 64 }, "other"), estate);
    assertEqual(heir.built.hall, 2);
    assertEqual(nextPiece(heir).part?.id ?? nextPiece(heir).hall, STAGES[0][1].id, "the heir builds what is still missing");
  },
  "a settlement is built hall first, stage by stage": () => {
    const lord = makeLord({ ...PLOT_PLAN[0], y: 64 }, "seed");
    assertEqual(nextPiece(lord).hall, 1);
    lord.built.hall = 1;
    assertEqual(nextPiece(lord).part.id, STAGES[0][0].id);
    lord.built.parts = STAGES[0].map((_, i) => partKey(0, i));
    assertEqual(nextPiece(lord), undefined);
    lord.tier = 1;
    assertEqual(nextPiece(lord).hall, 2);
  },
});
