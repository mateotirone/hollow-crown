import json
data=open("skills.json").read()
page='''<title>Tree of Oaths Screen</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
/* layout: a note above, then the game screen itself: branch tabs | the tree | the chosen oath. One dark look: it is a game screen. */
:root { --bg:#0f0e14; --stone:#1b1a23; --slot:#262430; --edge:#3b3848; --fg:#eae6dc; --muted:#9a95a6; --gold:#e3b95a; --lock:#5a5666;
  --keep:#7fb2d9; --wayfarer:#8fc98a; --blade:#d9796a; --arcana:#b48cf0; --acc:var(--gold);
  --display:"Pixelify Sans","Courier New",monospace; --body:"IBM Plex Sans",system-ui,sans-serif; color-scheme:dark }
body { background:var(--bg); color:var(--fg); font:14.5px/1.5 var(--body); padding-block:24px 40px; padding-left:max(16px,env(safe-area-inset-left,0px)); padding-right:max(16px,env(safe-area-inset-right,0px)) }
main { max-width:1080px; margin:0 auto; display:flex; flex-direction:column; gap:18px }
h1 { font:700 1.9rem/1.1 var(--display); margin:0 } h2 { font:700 1.15rem var(--display); margin:0 }
p { margin:0; max-width:70ch } .muted { color:var(--muted) }
.screen { background:var(--stone); border:3px solid var(--edge); box-shadow:inset 0 0 0 2px #0b0a10; display:flex; flex-direction:column }
.top { display:flex; flex-wrap:wrap; gap:8px 22px; align-items:center; padding:10px 14px; border-bottom:2px solid var(--edge) }
.top b { font:700 1.1rem var(--display); color:var(--acc) } .bar { flex:1 1 160px; min-width:120px; height:10px; background:#0b0a10; border:1px solid var(--edge) } .bar i { display:block; height:100%; background:var(--gold) }
.pts { font:700 1rem var(--display); color:var(--gold); white-space:nowrap }
.cols { display:grid; grid-template-columns:150px minmax(0,1fr) 270px }
.tabs { display:flex; flex-direction:column; border-right:2px solid var(--edge) }
.tabs button { all:unset; cursor:pointer; padding:12px 14px; border-bottom:1px solid var(--edge); border-left:4px solid transparent; display:flex; flex-direction:column; gap:2px }
.tabs button b { font:700 1rem var(--display) } .tabs button small { color:var(--muted); font-size:11.5px }
.tabs button[aria-selected="true"] { background:var(--slot); border-left-color:var(--c) } .tabs button[aria-selected="true"] b { color:var(--c) }
.tabs button.locked b { color:var(--lock) } .tabs button:focus-visible, .node:focus-visible, .act:focus-visible { outline:2px solid var(--gold); outline-offset:-2px }
.tree { overflow-x:auto; min-width:0 } .tree svg { display:block; width:100%; min-width:520px; height:auto }
.band { fill:#17161e } .band.shut { fill:#121118 } .rl { fill:var(--muted); font:600 10px var(--body); letter-spacing:.12em } .rg { fill:var(--muted); font:400 10.5px var(--body) } .rg.shut { fill:var(--blade) }
.ln { stroke:var(--edge); stroke-width:3; fill:none } .ln.on { stroke:var(--acc) }
.node { cursor:pointer } .node rect.f { fill:var(--slot); stroke:var(--edge); stroke-width:2 } .node.can rect.f { stroke:var(--fg) } .node.have rect.f { stroke:var(--acc); fill:#2d2a1f } .node.max rect.f { fill:var(--acc) }
.node.sel rect.f { stroke-width:4 } .node .g { font:700 15px var(--display); fill:var(--muted); text-anchor:middle } .node.can .g, .node.have .g { fill:var(--fg) } .node.max .g { fill:#17140a }
.node .nm { font:500 10.5px var(--body); fill:var(--muted); text-anchor:middle } .node.can .nm, .node.have .nm, .node.max .nm { fill:var(--fg) }
.node .pip { fill:#0b0a10; stroke:var(--edge) } .node .pip.on { fill:var(--acc); stroke:var(--acc) } .node.power rect.f { rx:22px }
.side { border-left:2px solid var(--edge); padding:14px; display:flex; flex-direction:column; gap:10px; min-width:0 }
.side h2 { color:var(--acc) } .tag { font-size:11.5px; color:var(--muted); letter-spacing:.08em; text-transform:uppercase }
.lore { font-style:italic; color:var(--arcana) } .why { color:var(--blade) }
.act { all:unset; cursor:pointer; text-align:center; font:700 1rem var(--display); padding:10px; background:var(--gold); color:#17140a; border:2px solid #0b0a10 } .act[disabled] { background:var(--slot); color:var(--lock); cursor:default }
.keyrow { display:flex; flex-wrap:wrap; gap:6px 18px; font-size:12.5px; color:var(--muted); padding:8px 14px; border-top:2px solid var(--edge) }
.notes { display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:14px 26px } .notes div { display:flex; flex-direction:column; gap:4px }
@media (max-width:800px) { .cols { grid-template-columns:1fr } .tabs { flex-direction:row; flex-wrap:wrap; border-right:0; border-bottom:2px solid var(--edge) } .tabs button { flex:1 1 40%; border-left:0; border-top:4px solid transparent } .tabs button[aria-selected="true"] { border-top-color:var(--c) } .side { border-left:0; border-top:2px solid var(--edge) } }
</style>
<main>
<header><h1>Tree of Oaths screen</h1></header>
<p class="muted">A working mock of the skill tree screen as it would open at the Tree of Oaths. Pick a branch, click an oath, swear it. The player shown is an example: a Marked at Renown 14 with a Keep and 7 points to spend. Colours and frames are placeholders until the menu art is chosen; the layout and behaviour are what to react to.</p>
<section class="screen" aria-label="Tree of Oaths">
  <div class="top"><b id="who"></b><span class="muted" id="lvl"></span><div class="bar" title="Renown to next level"><i style="width:62%"></i></div><span class="pts" id="pts"></span></div>
  <div class="cols">
    <nav class="tabs" id="tabs" role="tablist"></nav>
    <div class="tree"><svg id="svg" viewBox="0 0 620 584"></svg></div>
    <aside class="side" id="side"></aside>
  </div>
  <div class="keyrow"><span>Square: always on</span><span>Round: a power you cast</span><span>Coloured frame: sworn</span><span>Filled: mastered</span><span>Bright frame: you can swear it now</span><span>Dim: locked</span></div>
</section>
<h2>How it works</h2>
<div class="notes">
<div><b>One screen, four branches.</b><span class="muted">Keep and Wayfarer are open to everyone. Blade belongs to Knights and Arcana to the Marked; the other one shows as closed, so you can see what you gave up.</span></div>
<div><b>Rings read top to bottom.</b><span class="muted">Each ring names what opens it (hall and Renown). A closed ring is dimmed and says what is missing in red.</span></div>
<div><b>Lines show order.</b><span class="muted">A line lights up once the oath above it is sworn. Pips under a node are its ranks.</span></div>
<div><b>The right panel is the decision.</b><span class="muted">What it does at each rank, the cost, the origin line for Arcana powers, and one button. If it is locked, the reason replaces the button.</span></div>
</div>
</main>
<script>
const D = /*DATA*/;
const hero = { path: "marked", level: 14, hall: 3, points: 7, origins: { arc_echo: true }, skills: { arc_bolt: 3, arc_ward: 1, arc_quiet: 2, arc_blink: 2, arc_echo: 1, keep_hearth: 2 } };
const GATED = { arc_step: "Unknown. The old king's journal speaks of a night the floor was not there.", arc_choir: "Unknown. They say a woman in Rimehold knows what rings under the ice.", arc_hollowstep: "Unknown. Somewhere a Library names the real thin place." };
const HALLS = ["no hall", "Longhouse", "Stone Hall", "Keep", "Fortress", "Sovereign's Throne"];
let branch = "arcana", sel = "arc_step";
const byId = Object.fromEntries(D.skills.map((s) => [s.id, s]));
const open = (b) => D.branches[b].who === "all" || D.branches[b].who === hero.path;
function why(s) {
  const have = hero.skills[s.id] || 0, r = D.rings[s.ring];
  if (have >= s.max) return "Mastered";
  if (!open(s.branch)) return (D.roles[D.branches[s.branch].who]?.noun || "Another role") + " only";
  if (hero.hall < r.hall) return "Needs a " + HALLS[r.hall];
  if (hero.level < r.level) return "Needs Renown " + r.level;
  if (s.needs && !hero.skills[s.needs]) return "Needs " + byId[s.needs].name;
  if (GATED[s.id] && !have && !hero.origins[s.id]) return GATED[s.id];
  if (hero.points < s.cost) return "Needs " + s.cost + " point" + (s.cost === 1 ? "" : "s");
}
function layout(b) {
  const W = 620, pos = {};
  for (let ring = 1; ring <= 5; ring++) {
    const row = D.skills.filter((s) => s.branch === b && s.ring === ring);
    const want = row.map((s, i) => ({ s, x: s.needs && pos[s.needs] ? pos[s.needs].x + (row.filter((o) => o.needs === s.needs).indexOf(s) - (row.filter((o) => o.needs === s.needs).length - 1) / 2) * 120 : null, i }));
    const free = want.filter((w) => w.x === null); free.forEach((w, k) => (w.x = (W * (k + 1)) / (free.length + 1) + (ring > 1 ? 0 : 0)));
    want.sort((a, c) => a.x - c.x);
    for (let k = 1; k < want.length; k++) if (want[k].x - want[k - 1].x < 112) want[k].x = want[k - 1].x + 112;
    const over = want.length ? Math.max(0, want[want.length - 1].x - (W - 62)) : 0, under = want.length ? Math.max(0, 62 - want[0].x) : 0;
    for (const w of want) pos[w.s.id] = { x: w.x - over + under, y: 34 + (ring - 1) * 108 + 44 };
  }
  return pos;
}
const glyph = (n) => n.split(/[ ']/).filter((w) => w && w !== "s" && w !== "of" && w !== "the").slice(0, 2).map((w) => w[0].toUpperCase()).join("");
function draw() {
  document.documentElement.style.setProperty("--acc", `var(--${branch})`);
  const rank = [...D.ranks[hero.path]].reverse().find((r) => D.skills.filter((s) => s.branch === D.roles[hero.path].branch).reduce((n, s) => n + (hero.skills[s.id] || 0) * s.cost, 0) >= r.at);
  who.textContent = rank.name; lvl.textContent = "Renown " + hero.level + " · " + HALLS[hero.hall]; pts.textContent = hero.points + " point" + (hero.points === 1 ? "" : "s") + " to spend";
  tabs.innerHTML = Object.entries(D.branches).map(([id, b]) => `<button role="tab" id="tab-${id}" aria-selected="${id === branch}" class="${open(id) ? "" : "locked"}" style="--c:var(--${id})" data-b="${id}"><b>${b.name}</b><small>${open(id) ? b.blurb : "Closed to you"}</small></button>`).join("");
  const pos = layout(branch); let h = "";
  for (let r = 1; r <= 5; r++) { const R = D.rings[r], shut = hero.hall < R.hall || hero.level < R.level, y = 34 + (r - 1) * 108;
    h += `<rect class="band ${shut ? "shut" : ""}" x="6" y="${y}" width="608" height="100"/><text class="rl" x="14" y="${y + 15}">${R.name.toUpperCase()}</text><text class="rg ${shut ? "shut" : ""}" x="606" y="${y + 15}" text-anchor="end">${HALLS[R.hall]} · Renown ${R.level}</text>`; }
  for (const s of D.skills) if (s.branch === branch && s.needs && pos[s.needs]) { const a = pos[s.needs], c = pos[s.id], m = (a.y + c.y) / 2 + 14;
    h += `<path class="ln ${hero.skills[s.needs] ? "on" : ""}" d="M${a.x} ${a.y + 52}V${m + 12}H${c.x}V${c.y - 22}"/>`; }
  for (const s of D.skills) if (s.branch === branch) { const p = pos[s.id], have = hero.skills[s.id] || 0, w = why(s);
    const cls = ["node", s.power ? "power" : "", have >= s.max ? "max" : have ? "have" : "", !w ? "can" : "", s.id === sel ? "sel" : ""].join(" ");
    let pips = ""; for (let k = 0; k < s.max; k++) pips += `<rect class="pip ${k < have ? "on" : ""}" x="${p.x - s.max * 5 + k * 10 + 1}" y="${p.y + 26}" width="8" height="5"/>`;
    h += `<g class="${cls}" tabindex="0" role="button" aria-label="${s.name}" data-s="${s.id}"><rect class="f" x="${p.x - 22}" y="${p.y - 22}" width="44" height="44" rx="${s.power ? 22 : 3}"/><text class="g" x="${p.x}" y="${p.y + 5}">${glyph(s.name)}</text>${pips}<text class="nm" x="${p.x}" y="${p.y + 46}">${s.name}</text></g>`; }
  svg.innerHTML = h;
  const s = byId[sel]; if (!s || s.branch !== branch) { side.innerHTML = `<h2>${D.branches[branch].name}</h2><p class="muted">${D.branches[branch].blurb}</p><p class="muted">Choose an oath.</p>`; return; }
  const have = hero.skills[s.id] || 0, w = why(s), R = D.rings[s.ring];
  side.innerHTML = `<span class="tag">${s.power ? "Power" : "Always on"} · ${R.name}</span><h2>${s.name}</h2><span class="muted">Rank ${have} of ${s.max}</span><p>${s.desc.join(" ").replace(/^Power\\. /, "")}</p>${D.lines[s.id] ? `<p class="lore">${D.lines[s.id]}</p>` : ""}<span class="muted">${s.cost} point${s.cost === 1 ? "" : "s"} per rank${s.needs ? " · after " + byId[s.needs].name : ""}</span>${w && w !== "Mastered" ? `<p class="why">${w}</p>` : ""}<button class="act" id="act" ${w ? "disabled" : ""}>${w === "Mastered" ? "Mastered" : w ? "Locked" : have ? "Deepen the oath" : "Swear this oath"}</button>`;
  const act = document.getElementById("act"); if (act && !w) act.onclick = () => { hero.skills[s.id] = have + 1; hero.points -= s.cost; draw(); };
}
tabs.onclick = (e) => { const b = e.target.closest("button"); if (b) { branch = b.dataset.b; sel = null; draw(); } };
const pick = (e) => { const g = e.target.closest(".node"); if (g) { sel = g.dataset.s; draw(); } };
svg.onclick = pick; svg.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(e); } };
draw();
</script>'''
open("/mnt/project-files/siege-nights/art/townhall/tree-screen.html","w").write(page.replace("/*DATA*/",data.strip()))
