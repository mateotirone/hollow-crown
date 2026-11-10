import html
S=[ # id,name,ring,x,kind,ranks,cost,needs,desc
("bolt","Ember Bolt",1,160,"Power",3,1,None,"A bolt of pale fire, 24 blocks: 5 / 7 / 10 damage. Rank 3 sets the target alight."),
("quiet","Quiet Mind",1,510,"Passive",3,1,None,"Resonance fades 30% / 60% / 90% faster."),
("ward","Ward",1,650,"Power",3,1,None,"Wraps you in Absorption I / II / III for 20 seconds."),
("bind","Bind",2,90,"Power",3,2,"bolt","Roots the creature you look at for 3 / 5 / 7 seconds (half on bosses)."),
("blink","Blink",2,230,"Power",3,2,"bolt","Step 8 / 12 / 16 blocks the way you look."),
("echo","Echo Sight",2,370,"Power",3,2,None,"Locked until you read a Surveyor's Field Note. See in the dark, sense every creature nearby, and reveal hidden doors."),
("ashen","Ashen Skin",2,650,"Passive",2,2,"ward","Fire cannot hurt you. Rank 2: tougher skin while Resonance is 50 or more."),
("step","Halfstep",3,230,"Power",3,3,"blink","Locked until the First Slip happens to you. Slip half out of the world for 3 / 4 / 5 seconds: unseen, untouchable, fast."),
("choir","Choir's Call",3,370,"Power",3,3,"echo","Locked until Sigrun in Rimehold explains the bell under the ice. Raiders nearby hear the bell and turn on each other for 6 / 8 / 10 seconds."),
("resonant","Resonant Soul",3,510,"Passive",2,3,"quiet","While Resonance is 70 or more, powers are 25% / 50% stronger."),
("veil","Veilstep",4,160,"Power",1,5,"step","Locked until a Library names the real thin place. Step out of the world and into the Hollow from anywhere. Cast it again to step back."),
("born","Choirborn",4,300,"Passive",1,6,"step","Powers cost less and recover faster. At 100 Resonance: ten seconds of free casting, then a crash."),
("voice","The Last Art",5,160,"Peak",1,8,"veil","The Hollow answers to you. You may claim its throne and rule it."),
("crownless","Crownless",5,300,"Passive",1,8,"born","Ember Bolt arcs to two more enemies near the first."),
]
RINGS=[None,("First Ring","Longhouse","Renown 1"),("Second Ring","Stone Hall","Renown 5"),("Third Ring","Keep","Renown 12"),("Capstones","Fortress","Renown 20"),("Crown Ring","Sovereign's Throne","Renown 30")]
Y=lambda r: 20+(r-1)*112
pos={s[0]:(s[3],Y(s[2])+46) for s in S}
svg=[]
for r in range(1,6):
    y=Y(r); n,h,l=RINGS[r]
    svg.append(f'<rect x="0" y="{y}" width="740" height="104" rx="6" class="band"/><text x="12" y="{y+18}" class="ring">{n.upper()}</text><text x="728" y="{y+18}" class="gate" text-anchor="end">{h} · {l}</text>')
for i,n,r,x,k,rk,c,need,d in S:
    if need:
        x0,y0=pos[need]; x1,y1=pos[i]
        svg.append(f'<path d="M{x0} {y0+20} C{x0} {y0+60},{x1} {y1-60},{x1} {y1-20}" class="link"/>')
for i,n,r,x,k,rk,c,need,d in S:
    px,py=pos[i]
    svg.append(f'<g class="node {k.lower()}"><rect x="{px-62}" y="{py-20}" width="124" height="40" rx="5"/><text x="{px}" y="{py-2}" text-anchor="middle" class="nm">{html.escape(n)}</text><text x="{px}" y="{py+13}" text-anchor="middle" class="meta">{k} · {rk} rank{"s" if rk>1 else ""} · {c} pt{"s" if c>1 else ""} each</text></g>')
name={s[0]:s[1] for s in S}
rows=[]
for r in range(1,6):
    n,h,l=RINGS[r]
    rows.append(f'<tr class="rh"><th colspan="4">{n} <span>needs a {h} and {l}</span></th></tr>')
    for i,nm,rr,x,k,rk,c,need,d in S:
        if rr!=r: continue
        rows.append(f'<tr><td class="n">{html.escape(nm)}<small>{k}</small></td><td>{html.escape(d)}</td><td class="num">{rk} × {c}</td><td>{("After "+name[need]) if need else "Open from the start"}</td></tr>')
total=sum(s[5]*s[6] for s in S)
page=f'''<title>Sorcerer Power Tree</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+SC:wght@600;700&family=Inter:wght@400;500;600&display=swap">
<style>
/* layout: one column; the tree as a diagram first, the same powers as a readable table under it */
:root {{ --bg:#16121d; --panel:#1f1929; --band:#231c2f; --fg:#ece6f2; --muted:#a79bb8; --line:#3a2f4d; --ember:#f2a65a; --veil:#b48cf0; --peak:#f0d48a;
  --display:"Cormorant SC","Palatino Linotype",Georgia,serif; --body:Inter,system-ui,sans-serif; color-scheme:dark }}
@media (prefers-color-scheme: light) {{ :root:not([data-theme="dark"]) {{ --bg:#f5f1f8; --panel:#fff; --band:#ece5f3; --fg:#231a30; --muted:#655a75; --line:#cfc3de; --ember:#b05a12; --veil:#6b3fc2; --peak:#8a6a10; color-scheme:light }} }}
:root[data-theme="light"] {{ --bg:#f5f1f8; --panel:#fff; --band:#ece5f3; --fg:#231a30; --muted:#655a75; --line:#cfc3de; --ember:#b05a12; --veil:#6b3fc2; --peak:#8a6a10; color-scheme:light }}
body {{ background:var(--bg); color:var(--fg); font:15px/1.55 var(--body); padding-block:28px 48px; padding-left:max(16px,env(safe-area-inset-left,0px)); padding-right:max(16px,env(safe-area-inset-right,0px)) }}
main {{ max-width:860px; margin:0 auto; display:flex; flex-direction:column; gap:22px }}
h1 {{ font:700 2.3rem/1.05 var(--display); margin:0; letter-spacing:.02em; text-wrap:balance }}
h2 {{ font:600 1.4rem var(--display); margin:0; letter-spacing:.03em }}
p {{ margin:0; max-width:66ch }} .lede {{ color:var(--muted) }}
.scroll {{ overflow-x:auto; background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:12px }}
svg {{ display:block; min-width:700px; width:100%; height:auto; font-family:var(--body) }}
.band {{ fill:var(--band) }} .ring {{ fill:var(--muted); font-size:10.5px; letter-spacing:.14em; font-weight:600 }} .gate {{ fill:var(--muted); font-size:11px }}
.link {{ fill:none; stroke:var(--veil); stroke-width:1.6; opacity:.7 }}
.node rect {{ fill:var(--panel); stroke:var(--line); stroke-width:1.2 }} .node.power rect {{ stroke:var(--ember) }} .node.peak rect {{ stroke:var(--peak); stroke-width:2.2 }}
.nm {{ fill:var(--fg); font-size:12.5px; font-weight:600 }} .meta {{ fill:var(--muted); font-size:9.5px }}
.key {{ display:flex; flex-wrap:wrap; gap:6px 18px; color:var(--muted); font-size:13px }} .key i {{ display:inline-block; width:14px; height:10px; border:1.5px solid var(--line); border-radius:2px; margin-right:6px; vertical-align:-1px }}
.key .p {{ border-color:var(--ember) }} .key .k {{ border-color:var(--peak) }}
table {{ border-collapse:collapse; width:100%; min-width:560px; font-size:14px }} td,th {{ text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); vertical-align:top }}
.rh th {{ font:600 1.05rem var(--display); letter-spacing:.04em; padding-top:16px; color:var(--veil) }} .rh span {{ font:400 12.5px var(--body); color:var(--muted); letter-spacing:0; margin-left:8px }}
.n {{ font-weight:600; white-space:nowrap }} .n small {{ display:block; font-weight:400; color:var(--muted) }} .num {{ font-variant-numeric:tabular-nums; white-space:nowrap }}
ol {{ margin:0; padding-left:1.2em; display:flex; flex-wrap:wrap; gap:4px 28px }} ol li {{ margin-right:8px }}
</style>
<main>
<header><h1>The Sorcerer's Power Tree</h1></header>
<p class="lede">Every power on the magic path, the order it is gained and what opens it. A player enters this path by taking the Ember into their hand after their first siege. Powers are bought at the Tree of Oaths with skill points; each ring opens when the town hall and the player's Renown are both high enough. Learning all of it costs {total} points.</p>
<div class="scroll"><svg viewBox="0 0 740 {Y(5)+112}" role="img" aria-label="The Sorcerer's powers in five rings, with lines from each power to the one it unlocks">{"".join(svg)}</svg></div>
<div class="key"><span><i class="p"></i>Power you cast (raises Resonance)</span><span><i></i>Passive, always on</span><span><i class="k"></i>The peak: lets you rule the Hollow</span></div>
<h2>Ranks along the way</h2>
<p>The title changes with points spent in this tree. Only a Sorcerer can wear the Hollow Crown.</p>
<ol><li>Touched, from the start</li><li>Listener, 3 points</li><li>Adept, 8 points</li><li>Veilwalker, 15 points</li><li>Sorcerer, 26 points</li></ol>
<h2>Every power</h2>
<div class="scroll"><table><thead><tr><th>Power</th><th>What it does</th><th>Ranks × cost</th><th>Opens</th></tr></thead><tbody>{"".join(rows)}</tbody></table></div>
<p class="lede">Every power has an origin, told in the in-game book The Fourteen Arts and in one line under each power at the Tree. Four powers stay locked until the player finds where they come from in the world.</p>
</main>'''
open("/mnt/project-files/siege-nights/art/townhall/sorcerer-tree.html","w").write(page)
print(total,len(page))
