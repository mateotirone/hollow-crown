// The blocks behind each Plan Book card picture, and a fingerprint of them. Pure code, runs in Node.
// studio/build_plans.py draws the cards from planCardCells (through studio/plan_cards/dump.mjs) and writes the
// fingerprint to plancards_data.js; a self-test fails when a design changes and the cards weren't redrawn.
import { drawBuilding, styleFor, BUILDINGS, WAITING, BUILDING } from "./buildings.js";
import { STYLES } from "../townhall/styles.js";
import { PLANS } from "./config.js";

export const CARD_STYLES = Object.keys(STYLES);
// the buildings waiting to be offered get cards too, so they are ready when they join BUILDINGS
export const CARD_IDS = [...BUILDINGS, ...(WAITING ?? [])].map((b) => b.id).filter((id) => !PLANS.noPlan.includes(id)); // no plan, no card

export function planCardCells(id, style) {
  const st = styleFor(style);
  // drawBuilding looks the building up in BUILDING; a waiting one is lent there just for the drawing
  const lent = !BUILDING[id] && (WAITING ?? []).find((b) => b.id === id);
  if (lent) BUILDING[id] = lent;
  let p;
  try { p = drawBuilding(id, style); } finally { if (lent) delete BUILDING[id]; }
  const block = (role) => (st.roles[role] ?? ["minecraft:air"])[0];
  const cells = [];
  for (const c of p.cells.values()) {
    if (c.role === "air") continue;
    const b = block(c.role);
    if (b !== "minecraft:air") cells.push([c.x, c.y, c.z, b]);
  }
  for (const c of p.columns.values()) cells.push([c.x, -1, c.z, block(c.role)]); // only the top of a foundation shows
  return cells;
}

// FNV-1a over every card's blocks, in a fixed order
export function planCardsHash() {
  let h = 0x811c9dc5;
  for (const style of CARD_STYLES) for (const id of CARD_IDS) {
    const cells = planCardCells(id, style).map((c) => c.join(",")).sort();
    const s = `${id}@${style}:${cells.join(";")}|`;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h.toString(16);
}
