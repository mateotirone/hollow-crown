// From straight above, every floor cell of every hall must have something over it (no holes to the sky).
const T = "/mnt/project-files/siege-nights/Siege_Nights_BP/scripts/townhall/";
const { drawHall } = await import(T + "halls.js");
const { STYLES, STYLE_IDS } = await import(T + "styles.js");
for (const id of STYLE_IDS) for (let l = 1; l <= 5; l++) {
  const p = drawHall(l, STYLES[id]); const L = STYLES[id].lift;
  const top = new Map(), floors = [];
  for (const c of p.cells.values()) { if (c.role === "air") continue; const k = `${c.x},${c.z}`; if (c.y > (top.get(k)?.y ?? -1)) top.set(k, c); if (c.y === L && ["floor","dais","gilt"].includes(c.role)) floors.push(c); }
  const open = floors.filter((c) => { const t = top.get(`${c.x},${c.z}`); return t.y <= L + 2; });
  console.log(id, l, "floor cells open to the sky:", open.length, open.slice(0, 6).map((c) => `${c.x},${c.z}`).join(" "));
}
