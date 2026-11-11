// Dumps every settlement building from the add-on's own code, with block states, for the catalogue
// renders: the five hall tiers and nine plot buildings in each region, a stretch of each of the ten
// wall levels (with the gate) in each region, and the Citadel.
//   node settle_dump.mjs out.json
// Coordinates are in the catalogue frame: the front (door / gate) faces +z (south), y = 0 is the ground.
import fs from "node:fs";
const S = new URL("../../Siege_Nights_BP/scripts/", import.meta.url).href;
const { drawHall, frameFor, toWorld, statesFor, HALL_TIERS } = await import(S + "townhall/halls.js");
const { STYLES } = await import(S + "townhall/styles.js");
const { drawBuilding, styleFor, BUILDINGS } = await import(S + "settle/buildings.js");
const { WALLS, WALL_LEVELS, wallColumns, bearingToAngle, columnKinds } = await import(S + "settle/walldata.js");
const { citadelPlan, KEEP_HALF } = await import(S + "crown/layout.js");

const short = (id) => id.replace("minecraft:", "");
// Plans face "forward" into the building. Forward = north (-z) puts the door on the south side.
const frame = frameFor({ x: 0, z: -1 }), origin = { x: 0, y: 1, z: 0 };

function props(st) {
  const p = {};
  if (st["minecraft:cardinal_direction"]) p.facing = st["minecraft:cardinal_direction"][0];
  if (st.upside_down_bit) p.half = "top";
  if (st.pillar_axis) p.axis = st.pillar_axis;
  if (st["minecraft:vertical_half"]) p.half = st["minecraft:vertical_half"];
  if (st.hanging) p.hanging = true;
  return p;
}
function cellsOf(plan, style) {
  const block = (role) => short((style.roles[role] ?? ["minecraft:air"])[0]);
  const out = [];
  for (const c of plan.cells.values()) {
    if (c.role === "air") continue;
    const b = block(c.role); if (b === "air") continue;
    const w = toWorld(frame, origin, c.x, c.y, c.z);
    const st = statesFor(frame, c.role, c.o)[1] ?? statesFor(frame, c.role, c.o)[0];
    out.push([w.x, w.y, w.z, b, props(st)]);
  }
  for (const c of plan.columns.values()) for (let y = -2; y <= c.top; y++) { const w = toWorld(frame, origin, c.x, y, c.z); out.push([w.x, w.y, w.z, block(c.role), {}]); }
  return out;
}

const STONE_KINDS = ["stone", "tiles", "bricks", "cobbled", "smooth"];
const stoneId = (kind, region) => `siege:castle_${kind}${region === "vale" ? "" : "_" + region}`;
const out = { hallTiers: HALL_TIERS.filter(Boolean), buildings: BUILDINGS.map(({ id, name, blurb }) => ({ id, name, blurb })),
  regions: {}, wallLevels: [], citadel: null };

for (const id of Object.keys(STYLES)) {
  const st = styleFor(id), r = (out.regions[id] = { name: STYLES[id].name, blurb: STYLES[id].blurb, halls: [], buildings: {}, kinds: {} });
  for (let l = 1; l <= 5; l++) r.halls.push(cellsOf(drawHall(l, STYLES[id]), STYLES[id]));
  for (const b of BUILDINGS) r.buildings[b.id] = cellsOf(drawBuilding(b.id, id), st);
  const first = (list, fallback) => short((list ?? [fallback])[0]);
  r.kinds = { log: first(st.roles.beam, "spruce_log"), fence: first(st.roles.rail, "spruce_fence"), plank: first(st.roles.floor, "spruce_planks"),
    roofb: first(st.roles.roofBlock, "dark_oak_planks"), roofStair: first(st.roles.roofStair, "dark_oak_stairs"),
    tooth: "siege:battlement", light: "lantern", gate: "siege:castle_gate", port: "siege:portcullis", slit: "siege:arrow_slit" };
  for (const k of STONE_KINDS) r.kinds[k] = stoneId(k, id);
}

// Walls: the stretch either side of the south gate, moved so the gate sits at x = 0, z = 0.
const smooth = new Array(WALLS.stations).fill(0);
for (let level = 1; level < WALL_LEVELS.length; level++) {
  const L = WALL_LEVELS[level], cellsBy = {};
  for (const id of Object.keys(STYLES)) {
    const cells = (cellsBy[id] = []);
    for (const col of wallColumns({ center: { x: 0, y: 0, z: 0 }, level, gateAngle: bearingToAngle(180), smooth })) {
      if (col.z < WALLS.radius - 16 || Math.abs(col.x) > 26) continue;
      for (const [y, kind] of columnKinds(L, col, 0, id)) cells.push([col.x, y, col.z - WALLS.radius, kind]);
    }
  }
  out.wallLevels.push({ level, name: L.name, h: L.h, body: L.body, cellsBy });
}

// The Citadel: banner at the origin, gate facing south (+z), keep behind it.
const jobs = citadelPlan({ banner: { x: 0, z: 0 }, keep: { x: 0, z: -20 }, gate: 1 });
const grid = new Map();
for (const j of jobs) if (j.k === "fill") for (let y = j.y1; y <= j.y2; y++) {
  const k = `${j.x},${y},${j.z}`;
  if (j.block === "air") grid.delete(k); else grid.set(k, [j.x, y, j.z, j.block, j.color ?? 14]);
}
const cit = [...grid.values()];
out.citadel = cit;
fs.writeFileSync(process.argv[2] ?? "settle_dump.json", JSON.stringify(out));
console.log("regions", Object.keys(out.regions).join(" "), "walls", out.wallLevels.map((w) => w.cellsBy.vale.length).join(" "), "citadel", cit.length, "keep half", KEEP_HALF);
