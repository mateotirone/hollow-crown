// Dumps the whole settlement, block for block, from the add-on's own code: the plot layout, every
// regional hall tier, every pre-designed building on its slot, and all ten wall levels.
//   node dump.mjs   -> settlement.json (then python3 mkviewer.py)
import fs from "node:fs";
const S = new URL("../../Siege_Nights_BP/scripts/", import.meta.url).href;
const { drawHall, frameFor, toWorld, HALL_TIERS } = await import(S + "townhall/halls.js");
const { STYLES } = await import(S + "townhall/styles.js");
const { drawBuilding, styleFor, BUILDINGS } = await import(S + "settle/buildings.js");
const { HALL, MASON, SLOTS, place } = await import(S + "settle/layout.js");
const { WALLS, WALL_LEVELS, wallColumns, bearingToAngle, columnKinds } = await import(S + "settle/walldata.js");
const { hallReach } = await import(S + "settle/rules.js");
// same ids as stoneId() in siege/constants.js (that file needs the game to load)
const STONE_KINDS = ["stone", "tiles", "bricks", "cobbled", "smooth"];
const stoneId = (kind, region) => `siege:castle_${kind}${region === "vale" ? "" : "_" + region}`;

const GATE = "south", center = { x: 0, y: 0, z: 0 };
const short = (id) => id.replace("minecraft:", "");

function cellsOf(plan, style, at) {
  const frame = frameFor(at.forward), origin = { x: at.x, y: 1, z: at.z };
  const block = (role) => short((style.roles[role] ?? ["minecraft:air"])[0]);
  const out = [];
  for (const c of plan.cells.values()) {
    if (c.role === "air") continue;
    const b = block(c.role); if (b === "air") continue;
    const w = toWorld(frame, origin, c.x, c.y, c.z); out.push([w.x, w.y, w.z, b]);
  }
  for (const c of plan.columns.values()) for (let y = 0; y <= c.top; y++) { const w = toWorld(frame, origin, c.x, y, c.z); out.push([w.x, w.y, w.z, block(c.role)]); }
  return out;
}
const box = (plan) => { const b = plan.bounds(); return { wide: b.x1 - b.x0 + 1, deep: b.z1 - b.z0 + 1, tall: b.y1 + 1, x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 }; };

const out = { masonAt: place(center, GATE, MASON), gate: GATE, radius: WALLS.radius, walls: WALLS, hallSpot: HALL, masonSpot: MASON, slots: SLOTS, styles: {}, wallLevels: [], hallTiers: HALL_TIERS, buildings: BUILDINGS.map(({ id, name, blurb }) => ({ id, name, blurb })) };

for (const id of Object.keys(STYLES)) {
  const st = styleFor(id), s = (out.styles[id] = { halls: [], hallBox: [], slots: {}, slotBox: {}, reach: hallReach(id), kinds: {} });
  const hallAt = place(center, GATE, HALL);
  for (let l = 1; l <= 5; l++) { const p = drawHall(l, STYLES[id]); s.halls.push(cellsOf(p, STYLES[id], hallAt)); s.hallBox.push(box(p)); }
  for (const slot of SLOTS) { const p = drawBuilding(slot.building, id); s.slots[slot.id] = cellsOf(p, st, place(center, GATE, slot)); s.slotBox[slot.building] = box(p); }
  const first = (list, fallback) => short((list ?? [fallback])[0]);
  s.kinds = { log: first(st.roles.beam, "spruce_log"), fence: first(st.roles.rail, "spruce_fence"), plank: first(st.roles.floor, "spruce_planks"), tooth: "siege:battlement", light: "lantern", gate: "siege:castle_gate", port: "siege:portcullis" };
  for (const k of STONE_KINDS) s.kinds[k] = stoneId(k, id);
}

// walls on flat ground: [x, y, z, kind] with kind looked up per style in the viewer
const smooth = new Array(WALLS.stations).fill(0);
for (let level = 1; level < WALL_LEVELS.length; level++) {
  const L = WALL_LEVELS[level], cells = [];
  for (const col of wallColumns({ center, level, gateAngle: bearingToAngle(180), smooth })) {
    for (const [y, kind] of columnKinds(L, col)) cells.push([col.x, y, col.z, kind]);
  }
  out.wallLevels.push({ ...L, level, blocks: cells.length, cells });
}
fs.writeFileSync(new URL("settlement.json", import.meta.url), JSON.stringify(out));
const names = new Set(); for (const s of Object.values(out.styles)) { for (const h of s.halls) for (const c of h) names.add(c[3]); for (const v of Object.values(s.slots)) for (const c of v) names.add(c[3]); Object.values(s.kinds).forEach((k) => names.add(k)); }
console.log(names.size, "blocks;", out.wallLevels.map((w) => w.blocks).join(" "));
console.log(JSON.stringify(Object.fromEntries(Object.entries(out.styles).map(([k, s]) => [k, { reach: s.reach, hall5: s.hallBox[4], b: s.slotBox }]))));
