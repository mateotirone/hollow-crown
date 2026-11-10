import { addTests, assert, assertEqual } from "../core/tests.js";
import { MAP, PLOT_PLAN, WARDS, WELCOME, REGION_BLOCK, SETTLEMENT } from "./config.js";
import { pedestalLayout, arrivalSpot } from "./welcome.js";
import { compass } from "./claims.js";
import { outsideMap, wardAt } from "./travel.js";

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
  "wards cover the towns and never touch a plot": () => {
    assert(wardAt({ x: -150, z: -150 })?.name === "Kingsrest");
    for (const w of WARDS) for (const p of PLOT_PLAN) assert(Math.hypot(w.x - p.x, w.z - p.z) > w.r + MAP.plotRadius, `${w.name} overlaps ${p.name}`);
  },
  "map edge": () => {
    assert(outsideMap({ x: MAP.mapHalfSize + 1, z: 0 }));
    assert(!outsideMap({ x: MAP.mapHalfSize - 1, z: -MAP.mapHalfSize + 1 }));
  },
});

addTests("plots", {
  "welcome hall has one pedestal per plot, none sharing a spot": () => {
    const layout = pedestalLayout();
    assertEqual(layout.length, PLOT_PLAN.length);
    const spots = new Set();
    for (const p of layout) {
      spots.add(`${p.dx},${p.dz}`);
      spots.add(`${p.sx},${p.sz}`);
      assert(Math.hypot(p.dx, p.dz) < WELCOME.hallRadius - 2, `${p.name} pedestal is off the floor`);
      assert(Math.hypot(p.sx, p.sz) > 4, `${p.name} sign is on the Waystone`);
      assert(REGION_BLOCK[p.plan.region], `${p.name} has no pedestal block`);
    }
    assertEqual(spots.size, PLOT_PLAN.length * 2);
  },
  "pedestals have room between them": () => {
    const layout = pedestalLayout();
    for (const a of layout) for (const b of layout) if (a !== b) assert(Math.hypot(a.dx - b.dx, a.dz - b.dz) >= 3, `${a.name} and ${b.name} pedestals touch`);
  },
  "pedestals point roughly toward their plots": () => {
    const k = WARDS[0];
    for (const p of pedestalLayout()) {
      const want = Math.atan2(p.plan.x - k.x, -(p.plan.z - k.z));
      const got = Math.atan2(p.dx, -p.dz);
      const off = Math.abs(((got - want + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * 180 / Math.PI;
      assert(off < 40, `${p.name} pedestal is ${Math.round(off)} degrees off`);
    }
  },
  "welcome hall and test area are inside the map, clear of each other": () => {
    for (const spot of [WELCOME.hall, WELCOME.testArea]) assert(!outsideMap(spot) && spot.y >= 280, "bad sky spot");
    assert(Math.hypot(WELCOME.hall.x - WELCOME.testArea.x, WELCOME.hall.z - WELCOME.testArea.z) > 120, "too close");
  },
});

addTests("plots", {
  "every plot has a gate side": () => {
    for (const p of PLOT_PLAN) assert([0, 90, 180, 270].includes(p.gate), `${p.name} has no gate side`);
  },
  "the final settlement fits on each plot's level ground": () => {
    assert(SETTLEMENT.wallRadius + 4 <= SETTLEMENT.landRadius && SETTLEMENT.landRadius <= SETTLEMENT.flatRadius, "wall is off the flat");
    assert(Math.hypot(SETTLEMENT.hallPad.halfWidth, SETTLEMENT.hallPad.depth) <= SETTLEMENT.flatRadius, "hall pad is off the flat");
    assert(SETTLEMENT.flatRadius <= MAP.plotRadius && SETTLEMENT.easeRadius * 2 <= MAP.goodPlotSpacing, "terraces would run into each other");
  },
});

addTests("plots", {
  "players are set down three blocks from the stone, on the gate side": () => {
    for (const p of PLOT_PLAN) {
      const spot = arrivalSpot({ ...p, y: 70 });
      assertEqual(Math.round(Math.hypot(spot.x - 0.5 - p.x, spot.z - 0.5 - p.z)), 3);
    }
    const north = arrivalSpot({ name: "Thistledown", x: 0, y: 70, z: 0 });
    assert(north.z < 0 && north.y === 71, "a north gate should set you down north of the stone");
  },
});

addTests("plots", {
  "every plot's old landmark is on the plot, off the settlement ground and away from the gate": () => {
    for (const p of PLOT_PLAN) {
      const d = Math.hypot(p.relic.x - p.x, p.relic.z - p.z);
      assert(d > SETTLEMENT.flatRadius && d < MAP.plotRadius, `${p.name} landmark is ${Math.round(d)} from the stone`);
      const bearing = (Math.atan2(p.relic.x - p.x, -(p.relic.z - p.z)) * 180) / Math.PI;
      assert(Math.abs(((bearing - p.gate + 540) % 360) - 180) >= 55, `${p.name} landmark is in front of the gate`);
    }
  },
});
