import { drawHall } from "/mnt/project-files/siege-nights/Siege_Nights_BP/scripts/townhall/halls.js";
import { STYLES } from "/mnt/project-files/siege-nights/Siege_Nights_BP/scripts/townhall/styles.js";
import fs from "node:fs";
const out = {};
for (const [id, st] of Object.entries(STYLES)) for (let l = 1; l <= 5; l++) {
  const p = drawHall(l, st);
  out[`${id}${l}`] = [...p.cells.values()].filter(c => c.role !== "air").map(c => [c.x, c.y, c.z, st.roles[c.role][0].replace("minecraft:", "")])
    .concat([...p.columns.values()].flatMap(c => Array.from({length: c.top + 1}, (_, y) => [c.x, y, c.z, st.roles[c.role][0].replace("minecraft:", "")])));
}
fs.writeFileSync("plans.json", JSON.stringify(out));
