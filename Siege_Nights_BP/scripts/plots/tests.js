import { addTests, assert, assertEqual } from "../core/tests.js";
import { MAP, PLOT_PLAN } from "./config.js";
import { compass } from "./claims.js";
import { outsideMap } from "./travel.js";

addTests("plots", {
  "12 planned plots with unique names": () => {
    assertEqual(PLOT_PLAN.length, 12);
    assertEqual(new Set(PLOT_PLAN.map((p) => p.name)).size, 12);
  },
  "planned plots are far enough apart": () => {
    for (const a of PLOT_PLAN) {
      for (const b of PLOT_PLAN) {
        if (a !== b) assert(Math.hypot(a.x - b.x, a.z - b.z) >= MAP.goodPlotSpacing, `${a.name} and ${b.name} are too close`);
      }
    }
  },
  "planned plots fit inside the map edge": () => {
    for (const p of PLOT_PLAN) assert(!outsideMap({ x: p.x + MAP.plotRadius * Math.sign(p.x), z: p.z + MAP.plotRadius * Math.sign(p.z) }), p.name);
  },
  "every region has at least two plots": () => {
    const count = {};
    for (const p of PLOT_PLAN) count[p.region] = (count[p.region] ?? 0) + 1;
    assertEqual(Object.keys(count).length, 5);
    assert(Object.values(count).every((n) => n >= 2));
  },
  "compass points north for negative z": () => {
    assertEqual(compass({ x: 0, z: 0 }, { x: 0, z: -100 }), "100 blocks N");
    assertEqual(compass({ x: 0, z: 0 }, { x: 100, z: 100 }), "141 blocks SE");
  },
  "map edge": () => {
    assert(outsideMap({ x: MAP.mapHalfSize + 1, z: 0 }));
    assert(!outsideMap({ x: MAP.mapHalfSize - 1, z: -MAP.mapHalfSize + 1 }));
  },
});
