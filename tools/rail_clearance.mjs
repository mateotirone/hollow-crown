// Lists works blocks that stand inside the train's body: the track cell and one cell each side across the line must be
// air for 4 cells up (the engine is 3.1 wide, 3.8 tall). Run: node tools/rail_clearance.mjs
const { ROUTES } = await import("../Siege_Nights_BP/scripts/trains/routes_data.js");
// envelope: track cell and one each side (across the line), 4 high (engine 3.8 tall, 3.1 wide)
let total = 0;
for (const s of ROUTES.segments) {
  if (!s.works) continue;
  const w = new Map();
  for (const [x, z, y0, y1, i] of s.works) for (let y = y0; y <= y1; y++) w.set(`${x},${y},${z}`, s.works_palette[i].name);
  const track = new Set(s.blocks.map(([x, y, z]) => `${x},${y},${z}`));
  const bad = new Map(), cells = new Set();
  s.blocks.forEach(([x, y, z, kind, dir], idx) => {
    // across-the-line offsets: for N-S (dir 0/4) x±1; E-W (2/6) z±1; diagonals/bends both
    const offs = [[0, 0]];
    if (kind === 0 && dir % 4 === 0) offs.push([1, 0], [-1, 0]);
    else if (kind === 0 && dir % 4 === 2) offs.push([0, 1], [0, -1]);
    else if (kind === 3) { if (dir % 4 === 0) offs.push([1, 0], [-1, 0]); else offs.push([0, 1], [0, -1]); }
    else offs.push([1, 0], [-1, 0], [0, 1], [0, -1]);
    for (const [dx, dz] of offs) for (let dy = 0; dy < 4; dy++) {
      const k = `${x + dx},${y + dy},${z + dz}`, b = w.get(k);
      if (b && b !== "minecraft:air" && !track.has(k) && !cells.has(k)) { cells.add(k); const key = `${dx || dz ? "side" : "centre"} dy${dy}`; (bad.get(key) ?? bad.set(key, []).get(key)).push(`${idx}:${b.replace("minecraft:", "")}`); }
    }
  });
  if (cells.size) { total += cells.size; console.log(s.id, cells.size, [...bad].map(([k, v]) => `${k} x${v.length} (e.g. #${v[0]})`).join("; ")); }
}
console.log("total", total);
