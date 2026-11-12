// Dumps every pre-designed building in every regional style, block for block, for the Plan Book card pictures.
//   node studio/plan_cards/dump.mjs   (studio/build_plans.py runs it)
const S = new URL("../../Siege_Nights_BP/scripts/", import.meta.url).href;
const { drawBuilding, styleFor, BUILDINGS } = await import(S + "settle/buildings.js");
const { STYLES } = await import(S + "townhall/styles.js");
const out = { styles: Object.keys(STYLES), buildings: BUILDINGS.map((b) => b.id), cells: {} };
for (const style of out.styles) {
  const st = styleFor(style);
  const block = (role) => (st.roles[role] ?? ["minecraft:air"])[0];
  for (const b of BUILDINGS) {
    const p = drawBuilding(b.id, style);
    const cells = [];
    for (const c of p.cells.values()) {
      if (c.role === "air") continue;
      const id = block(c.role);
      if (id !== "minecraft:air") cells.push([c.x, c.y, c.z, id]);
    }
    // only the top of each foundation column shows
    for (const c of p.columns.values()) cells.push([c.x, -1, c.z, block(c.role)]);
    out.cells[`${b.id}@${style}`] = cells;
  }
}
process.stdout.write(JSON.stringify(out));
