const T = "/mnt/project-files/siege-nights/Siege_Nights_BP/scripts/";
const s = await import(T + "townhall/skills.js");
let lines = {};
try { const l = await import(T + "lore/data/powers.js"); const P = l.POWERS ?? Object.values(l)[0]; for (const [k, v] of Object.entries(P)) if (v?.tree) lines[k] = v.tree; } catch (e) { console.error("no lore", e.message); }
const out = { rings: s.RINGS, branches: s.BRANCHES, ranks: s.RANKS, roles: s.ROLES, lines,
  skills: s.SKILLS.map((k) => ({ id: k.id, branch: k.branch, ring: k.ring, name: k.name, max: k.max, cost: k.cost, desc: k.desc, needs: k.needs, power: !!k.power })) };
console.log(JSON.stringify(out));
