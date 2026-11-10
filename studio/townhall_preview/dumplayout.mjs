const T = new URL("../../Siege_Nights_BP/scripts/townhall/", import.meta.url).href;
const { treeLayout, COLS, ROWS } = await import(T + "tree_layout.js");
const { SKILLS, BRANCHES } = await import(T + "skills.js");
const out = { COLS, ROWS, branches: {} };
for (const b of Object.keys(BRANCHES)) { const pos = treeLayout(b); out.branches[b] = SKILLS.filter((s) => s.branch === b).map((s) => ({ id: s.id, ...pos[s.id], needs: s.needs && pos[s.needs] ? pos[s.needs] : null })); }
console.log(JSON.stringify(out));
