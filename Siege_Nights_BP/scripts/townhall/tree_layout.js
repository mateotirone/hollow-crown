// Where each skill sits on the graphical Tree of Oaths screen: a grid 6 wide, one row per ring.
// Pure data work, shared by the game (button order) and by studio/build_tree_ui.py (the connector art).

import { SKILLS } from "./skills.js";

export const COLS = 6, ROWS = 6; // rows 0-4 are rings one to five, row 5 holds Back
export const TREE_FLAG = "§h§c"; // invisible marker in a form title: draw this form as the tree screen
export const BRANCH_FLAG = { keep: "§1", wayfarer: "§2", blade: "§3", arcana: "§4", wing: "§5", forge: "§6", helm: "§7", hex: "§8" };
export const SPACER = "-"; // a button with this text is an empty grid cell

// { skillId: { col, row } }
export function treeLayout(branch) {
  const pos = {};
  for (let ring = 1; ring <= 5; ring++) {
    const row = SKILLS.filter((s) => s.branch === branch && s.ring === ring);
    const want = row.map((s) => {
      const sibs = row.filter((o) => o.needs && o.needs === s.needs);
      const x = s.needs && pos[s.needs] ? pos[s.needs].col + (sibs.indexOf(s) - (sibs.length - 1) / 2) : undefined;
      return { s, x };
    });
    const free = want.filter((w) => w.x === undefined);
    free.forEach((w, k) => (w.x = ((k + 1) * COLS) / (free.length + 1) - 0.5));
    want.sort((a, b) => a.x - b.x);
    const cols = want.map((w) => Math.max(0, Math.min(COLS - 1, Math.round(w.x))));
    for (let k = 1; k < cols.length; k++) if (cols[k] <= cols[k - 1]) cols[k] = cols[k - 1] + 1;
    for (let k = cols.length - 1; k >= 0; k--) {
      const max = COLS - 1 - (cols.length - 1 - k);
      if (cols[k] > max) cols[k] = max;
      if (k < cols.length - 1 && cols[k] >= cols[k + 1]) cols[k] = cols[k + 1] - 1;
    }
    want.forEach((w, k) => (pos[w.s.id] = { col: cols[k], row: ring - 1 }));
  }
  return pos;
}

// The grid as a flat list of cells, left to right, top to bottom: a skill, "back", or undefined (empty)
export function treeCells(branch) {
  const cells = new Array(COLS * ROWS).fill(undefined);
  const pos = treeLayout(branch);
  for (const s of SKILLS) if (s.branch === branch) cells[pos[s.id].row * COLS + pos[s.id].col] = s;
  cells[(ROWS - 1) * COLS] = "back";
  return cells;
}
