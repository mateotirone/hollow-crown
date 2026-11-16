// Self-tests for planting the plots (planting_rules.js), on every map plot's layouts with every building that fits.
import { addTests, assert, assertEqual } from "../core/tests.js";
import { townFor, townNames, slotsOf, seatOnSlot, seatedBox } from "./towns.js";
import { BUILDINGS, drawBuilding } from "./buildings.js";
import { plotFit } from "./charters.js";
import { plantPlan, doorLane, PLANTING, TALL } from "./planting_rules.js";
import { GROVE_DESIGNS } from "../forestry/grove_data.js";

const REGIONS = Object.keys(PLANTING);
// Every plot of every layout with the first building that fits it, as plotmarker.js would seat it
function* seated(region) {
  for (const name of townNames()) for (const layout of townFor(name).variants) for (const slot of slotsOf(layout)) {
    const id = BUILDINGS.map((b) => b.id).find((b) => plotFit(b, slot).ok && seatOnSlot(slot, drawBuilding(b, region).bounds()));
    if (!id) continue;
    const bounds = drawBuilding(id, region).bounds(), seat = seatOnSlot(slot, bounds);
    yield { name, slot, id, building: { box: seatedBox(seat, bounds), origin: { dx: seat.origin.dx, dz: seat.origin.dz }, forward: seat.forward } };
  }
}

addTests("settle planting", {
  "an empty plot only gets its ground back: nothing planted": () => {
    const slot = slotsOf(townFor("oakmere").variants[0])[0];
    const p = plantPlan({ slot, region: "vale" });
    assertEqual(p.plants.length + p.trees.length, 0);
    assertEqual(p.surface.length, (slot.box.x1 - slot.box.x0 + 1) * (slot.box.z1 - slot.box.z0 + 1));
  },
  "every plot with a building: nothing planted on the building, a block round it, or the walk to the door; trees inside the plot": () => {
    for (const region of ["vale", "emberwaste"]) for (const { name, slot, id, building } of seated(region)) {
      const p = plantPlan({ slot, region, building, seed: "t" });
      const b = building.box, lane = doorLane(slot, building), where = `${name} ${slot.id} ${id} ${region}`;
      const inPlot = (x, z) => x >= slot.box.x0 && x <= slot.box.x1 && z >= slot.box.z0 && z <= slot.box.z1;
      for (const [x, z] of p.surface) assert(!(x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1), `${where}: ground laid under the building at ${x},${z}`);
      const cells = [...p.plants.map(([x, z]) => [x, z])];
      for (const t of p.trees) {
        const d = GROVE_DESIGNS[`${t.sid}_${t.stage}_${t.v}`];
        assert(d, `${where}: no grove design ${t.sid} ${t.v}`);
        for (let a = d.lo[0]; a <= d.hi[0]; a++) for (let c = d.lo[2]; c <= d.hi[2]; c++) cells.push([t.dx + a, t.dz + c]);
      }
      for (const [x, z] of cells) {
        assert(inPlot(x, z), `${where}: planting outside the plot at ${x},${z}`);
        assert(!(x >= b.x0 - 1 && x <= b.x1 + 1 && z >= b.z0 - 1 && z <= b.z1 + 1), `${where}: planting against the building at ${x},${z}`);
        assert(!lane.has(`${x},${z}`), `${where}: planting on the walk to the door at ${x},${z}`);
      }
    }
  },
  "the walk to the door runs from the building's front to the plot's edge, 3 wide": () => {
    for (const { name, slot, building } of seated("vale")) {
      const lane = doorLane(slot, building);
      assert(lane.size % 3 === 0, `${name} ${slot.id}: lane not 3 wide`);
      const edge = slot.door.z ? { x: building.origin.dx, z: slot.door.z < 0 ? slot.box.z0 : slot.box.z1 } : { x: slot.door.x < 0 ? slot.box.x0 : slot.box.x1, z: building.origin.dz };
      const flush = slot.door.z ? (slot.door.z < 0 ? building.box.z0 === slot.box.z0 : building.box.z1 === slot.box.z1) : (slot.door.x < 0 ? building.box.x0 === slot.box.x0 : building.box.x1 === slot.box.x1);
      assert(flush || lane.has(`${edge.x},${edge.z}`), `${name} ${slot.id}: the walk stops short of the plot's edge`);
    }
  },
  "nothing climbable near the wall, on wall or gate plots, or on a plot's outer ring": () => {
    for (const { name, slot, building } of seated("vale")) {
      const near = (x, z) => (x + z) % 3 === 0; // any pattern: the rule must hold whatever the wall says
      const p = plantPlan({ slot, region: "vale", building, nearWall: near });
      const flat = (slot.tags ?? []).some((t) => t === "wall" || t === "gate");
      for (const [x, z, id, tall] of p.plants) {
        assertEqual(tall, TALL.test(id), `${name} ${slot.id}: ${id} tall flag`);
        if (!tall) continue;
        assert(!flat, `${name} ${slot.id}: a bush on a ${slot.tags} plot`);
        assert(!near(x, z), `${name} ${slot.id}: a bush within reach of the wall at ${x},${z}`);
        assert(!(x === slot.box.x0 || x === slot.box.x1 || z === slot.box.z0 || z === slot.box.z1), `${name} ${slot.id}: a bush on the plot's edge`);
      }
      if (flat) assertEqual(p.trees.length, 0, `${name} ${slot.id}: a tree on a wall or gate plot`);
      for (const t of p.trees) assert(!near(t.dx, t.dz), `${name} ${slot.id}: a tree trunk within reach of the wall`);
    }
  },
  "planting is the same every time, and every region plants": () => {
    let planted = 0;
    for (const region of REGIONS) {
      let n = 0;
      for (const { slot, building } of seated(region)) {
        const a = plantPlan({ slot, region, building, seed: "x" }), b = plantPlan({ slot, region, building, seed: "x" });
        assertEqual(JSON.stringify(a), JSON.stringify(b), `${region} ${slot.id}`);
        n += a.plants.length;
        planted += a.trees.length;
      }
      assert(n > 0, `${region}: nothing planted anywhere`);
    }
    assert(planted > 0, "no plot anywhere has room for a tree");
  },
});
