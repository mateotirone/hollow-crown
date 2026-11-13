"""3D preview of the photo skins (build_photo_skins.py) on the real Bedrock player model, both layers.

  python3 studio/art/build_photo_skins.py DIR
  python3 studio/photo_skins/build_preview.py DIR OUT.html [--local-three path/to/three.min.js]
"""
import base64, json, sys
src, out = sys.argv[1].rstrip('/') + '/', sys.argv[2]

def uri(p): return 'data:image/png;base64,' + base64.b64encode(open(p, 'rb').read()).decode()

PEOPLE = [
    {"id": "reikia_cinderhale", "name": "Reikia Cinderhale", "region": "Emberwaste", "slim": True,
     "kit": "Caravaneer", "accent": "#b4492c",
     "notes": ["Long dark curls with a middle part, falling down her back",
               "Olive skin, winged liner, a soft smile",
               "Gold necklace and stud, silver bangle with a black cord on her right wrist",
               "Sand tunic with the rust sash, the sun wrap worn down as a neck cloth",
               "Loose pale trousers wrapped at the ankle, wrapped sandals"]},
    {"id": "lorcan_duskmire", "name": "Lorcan Duskmire", "region": "Blackfen", "slim": False,
     "kit": "Fen-walker", "accent": "#6a8a3a",
     "notes": ["Big dark curls tumbling over the forehead",
               "Thick dark brows, brown eyes",
               "Moustache and chin beard, stubble along the jaw",
               "Gold chain at the neck",
               "Oilskin coat with the moss collar and bone toggles, rope belt, thigh waders"]},
]
for p in PEOPLE: p["tex"] = uri(src + p["id"] + '.png')

THREE = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
html = r'''<title>Reikia and Lorcan Skins</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Source+Sans+3:wght@400;600&family=JetBrains+Mono:wght@400&display=swap">
<style>
/* Layout: two character plates side by side (stacked on phones), each a turntable over its notes and flat skin sheet */
:root{
  --bg:#ece7df; --panel:#f7f4ef; --ink:#221c18; --muted:#6c625a; --line:#d6cec3; --stage:#cfc6ba;
  --display:"Cinzel", Georgia, serif; --body:"Source Sans 3", system-ui, sans-serif; --mono:"JetBrains Mono", ui-monospace, monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#17141a;--panel:#211d24;--ink:#ece6df;--muted:#a49a92;--line:#3a3340;--stage:#2c2731;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#17141a;--panel:#211d24;--ink:#ece6df;--muted:#a49a92;--line:#3a3340;--stage:#2c2731;color-scheme:dark}
body{background:var(--bg);color:var(--ink);font:16px/1.5 var(--body)}
.wrap{max-width:1100px;margin:0 auto;padding-block:28px 48px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1{font:700 clamp(26px,4vw,38px)/1.15 var(--display);margin:0 0 6px;text-wrap:balance;letter-spacing:.02em}
.lede{color:var(--muted);margin:0 0 24px;max-width:65ch}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,440px),1fr));gap:20px}
.plate{background:var(--panel);border:1px solid var(--line);border-radius:6px;overflow:hidden;min-width:0;border-top:4px solid var(--acc)}
.stage{position:relative;height:420px;background:radial-gradient(ellipse at 50% 85%,color-mix(in oklab,var(--acc) 22%,var(--stage)) 0%,var(--stage) 70%);cursor:grab;touch-action:none}
.stage:active{cursor:grabbing}
.stage canvas{display:block;width:100%;height:100%}
.hint{position:absolute;left:12px;bottom:10px;font:12px var(--mono);color:var(--muted)}
.info{padding:16px 18px 18px;display:grid;grid-template-columns:1fr auto;gap:14px 18px;align-items:start}
.info>div{min-width:0}
.eyebrow{font:600 12px var(--body);letter-spacing:.12em;text-transform:uppercase;color:var(--acc)}
h2{font:700 24px/1.2 var(--display);margin:2px 0 8px}
ul{margin:0;padding-left:18px;color:var(--ink)} li{margin:2px 0}
.sheet{width:128px;height:128px;image-rendering:pixelated;background:repeating-conic-gradient(var(--line) 0 25%,transparent 0 50%) 0 0/16px 16px;border:1px solid var(--line)}
.sheetcap{font:11px var(--mono);color:var(--muted);text-align:center;margin-top:4px}
.ctl{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
button{font:600 13px var(--body);padding:6px 12px;border-radius:4px;border:1px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer}
button[aria-pressed="true"]{background:var(--acc);border-color:var(--acc);color:#fff}
button:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.foot{color:var(--muted);font-size:14px;margin-top:22px;max-width:70ch}
@media (max-width:520px){.info{grid-template-columns:1fr}.stage{height:360px}}
</style>
<div class="wrap">
  <h1>Reikia Cinderhale &amp; Lorcan Duskmire</h1>
  <p class="lede">Two player skins painted pixel by pixel from your photos, each dressed in their region's starter clothes. Drag a model to turn it. The outer layer holds the hair volume and the coat skirts.</p>
  <div class="grid" id="grid"></div>
  <p class="foot">Both are full 64&times;64 Bedrock skins with both layers. Reikia uses the slim arm model, Lorcan the classic one. The photos themselves are not stored in the game files or on this page.</p>
</div>
__THREE__
<script>
const PEOPLE = __DATA__;
const grid = document.getElementById('grid');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function faces(u,v,w,h,d){return{top:[u+d,v,w,d],bottom:[u+d+w,v,w,d],right:[u,v+d,d,h],front:[u+d,v+d,w,h],left:[u+d+w,v+d,d,h],back:[u+2*d+w,v+d,w,h]}}
function box(tex,rects,w,h,d,inflate,overlay){
  const g=new THREE.BoxGeometry(w+inflate*2,h+inflate*2,d+inflate*2), uv=g.attributes.uv;
  const order=['left','right','top','bottom','front','back'];   // +x,-x,+y,-y,+z,-z
  order.forEach((k,i)=>{const [x,y,rw,rh]=rects[k];let u0=x/64,u1=(x+rw)/64,vt=1-y/64,vb=1-(y+rh)/64;
    if(k==='bottom'){[vt,vb]=[vb,vt];}
    const q=[[u0,vt],[u1,vt],[u0,vb],[u1,vb]];q.forEach((c,j)=>uv.setXY(i*4+j,c[0],c[1]));});
  const m=new THREE.MeshLambertMaterial({map:tex,transparent:overlay,alphaTest:overlay?0.5:0,side:overlay?THREE.DoubleSide:THREE.FrontSide});
  return new THREE.Mesh(g,m);
}
function player(tex,slim){
  const a=slim?3:4, root=new THREE.Group(), outer=[];
  const P={head:[faces(0,0,8,8,8),faces(32,0,8,8,8),[8,8,8],[0,28,0],0.5],
    body:[faces(16,16,8,12,4),faces(16,32,8,12,4),[8,12,4],[0,18,0],0.25],
    rarm:[faces(40,16,a,12,4),faces(40,32,a,12,4),[a,12,4],[-(4+a/2),18,0],0.25],
    larm:[faces(32,48,a,12,4),faces(48,48,a,12,4),[a,12,4],[4+a/2,18,0],0.25],
    rleg:[faces(0,16,4,12,4),faces(0,32,4,12,4),[4,12,4],[-2,6,0],0.25],
    lleg:[faces(16,48,4,12,4),faces(0,48,4,12,4),[4,12,4],[2,6,0],0.25]};
  const parts={};
  for(const k in P){const [b,o,s,pos,inf]=P[k];const pivot=new THREE.Group();
    const top=k.includes('arm')?[pos[0],24-(slim&&k.includes('arm')?0.5:0),0]:k.includes('leg')?[pos[0],12,0]:[pos[0],k==='head'?24:pos[1],0];
    pivot.position.set(...top);
    const mb=box(tex,b,...s,0,false), mo=box(tex,o,...s,inf,true);
    const off=[0,pos[1]-top[1],0];mb.position.set(...off);mo.position.set(...off);
    if(k==='head'){mb.position.y=4;mo.position.y=4;}
    pivot.add(mb,mo);outer.push(mo);root.add(pivot);parts[k]=pivot;}
  return {root,outer,parts};
}
PEOPLE.forEach((p,i)=>{
  const el=document.createElement('article');el.className='plate';el.style.setProperty('--acc',p.accent);
  el.innerHTML=`<div class="stage"><span class="hint">drag to turn</span></div>
  <div class="info"><div><div class="eyebrow">${p.region} · ${p.kit}</div><h2>${p.name}</h2>
  <ul>${p.notes.map(n=>`<li>${n}</li>`).join('')}</ul>
  <div class="ctl"><button id="ol${i}" aria-pressed="true">Outer layer</button><button id="sp${i}" aria-pressed="${!reduce}">Turntable</button><button id="bk${i}">Show back</button></div></div>
  <div><img class="sheet" alt="${p.name} skin texture" src="${p.tex}"><div class="sheetcap">64×64${p.slim?' · slim':''}</div></div></div>`;
  grid.appendChild(el);
  const stage=el.querySelector('.stage');
  const r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});r.setPixelRatio(Math.min(2,devicePixelRatio));r.outputEncoding=THREE.sRGBEncoding;
  stage.prepend(r.domElement);
  const scene=new THREE.Scene(), cam=new THREE.PerspectiveCamera(30,1,1,500);cam.position.set(0,20,78);cam.lookAt(0,16,0);
  scene.add(new THREE.AmbientLight(0xffffff,0.62));const dl=new THREE.DirectionalLight(0xffffff,0.55);dl.position.set(-30,50,40);scene.add(dl);
  const tex=new THREE.TextureLoader().load(p.tex,()=>draw());tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestFilter;tex.encoding=THREE.sRGBEncoding;
  const pl=player(tex,p.slim);scene.add(pl.root);
  pl.parts.rarm.rotation.z=-0.06;pl.parts.larm.rotation.z=0.06;pl.parts.rarm.rotation.x=0.12;pl.parts.larm.rotation.x=-0.12;pl.parts.head.rotation.y=0.12;
  let yaw=-0.45,spin=!reduce,drag=null;
  function size(){const w=stage.clientWidth,h=stage.clientHeight;r.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();}
  function draw(){pl.root.rotation.y=yaw;r.render(scene,cam);}
  new ResizeObserver(()=>{size();draw();}).observe(stage);
  stage.addEventListener('pointerdown',e=>{drag=e.clientX;stage.setPointerCapture(e.pointerId);});
  stage.addEventListener('pointermove',e=>{if(drag===null)return;yaw+=(e.clientX-drag)*0.012;drag=e.clientX;draw();});
  stage.addEventListener('pointerup',()=>drag=null);stage.addEventListener('pointercancel',()=>drag=null);
  const ol=el.querySelector('#ol'+i),sp=el.querySelector('#sp'+i),bk=el.querySelector('#bk'+i);
  ol.onclick=()=>{const on=ol.getAttribute('aria-pressed')!=='true';ol.setAttribute('aria-pressed',on);pl.outer.forEach(m=>m.visible=on);draw();};
  sp.onclick=()=>{spin=!spin;sp.setAttribute('aria-pressed',spin);};
  bk.onclick=()=>{yaw+=Math.PI;draw();};
  let t0=performance.now();(function loop(t){if(spin&&drag===null){yaw+=(t-t0)*0.0004;draw();}t0=t;requestAnimationFrame(loop);})(t0);
  size();draw();
});
</script>'''
html = html.replace('__DATA__', json.dumps(PEOPLE))
if '--local-three' in sys.argv:
    html = '<meta charset="utf-8">' + html.replace('__THREE__', '<script>' + open(sys.argv[sys.argv.index('--local-three') + 1]).read() + '</script>')
else:
    html = html.replace('__THREE__', THREE)
open(out, 'w').write(html); print(out, len(html) // 1024, 'KB')
