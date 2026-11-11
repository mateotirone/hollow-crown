import math, json, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
rng=np.random.default_rng(11)
H=1250; N=1400; S=N/(2*H); M=60
def px(x,z): return ((x+H)*S,(z+H)*S)
def fbm(octs=5,base=4,seed=0):
    r=np.random.default_rng(seed); out=np.zeros((N,N)); amp=1; tot=0
    for o in range(octs):
        g=r.random((base*2**o+2,base*2**o+2)).astype(np.float32)
        im=Image.fromarray((g*255).astype(np.uint8)).resize((N,N),Image.BICUBIC)
        out+=amp*np.asarray(im,dtype=np.float32)/255; tot+=amp; amp*=0.5
    return out/tot-0.5
def blurmask(draw_fn,radius):
    im=Image.new('L',(N,N),0); draw_fn(ImageDraw.Draw(im)); return np.asarray(im.filter(ImageFilter.GaussianBlur(radius)),dtype=np.float32)/255
def spline(pts,n=24,wig=0,seed=0):
    p=[pts[0]]+list(pts)+[pts[-1]]; out=[]
    for i in range(1,len(p)-2):
        p0,p1,p2,p3=[np.array(q,float) for q in p[i-1:i+3]]
        for t in np.linspace(0,1,n,endpoint=False):
            out.append(0.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t**3))
    out.append(np.array(pts[-1],float)); out=np.array(out)
    if wig:
        r=np.random.default_rng(seed); k=len(out)
        ph=r.random(4)*6.28
        d=np.gradient(out,axis=0); nrm=np.stack([-d[:,1],d[:,0]],1); nrm/=np.linalg.norm(nrm,axis=1,keepdims=True)+1e-9
        s=np.linspace(0,1,k); env=np.sin(np.pi*s)
        off=wig*(np.sin(s*31+ph[0])*0.5+np.sin(s*67+ph[1])*0.3+np.sin(s*13+ph[2])*0.6)*env
        out=out+nrm*off[:,None]
    return [tuple(q) for q in out]
# ---- geography
coast=[(-960,-1250),(-900,-930),(-1010,-640),(-850,-330),(-600,-90),(-530,60),(-560,230),(-830,250),(-930,420),(-760,560),(-720,760),(-420,930),(-330,1090),(-260,1250)]
sea_poly=[(-1250,-1250)]+coast+[(-1250,1250)]
sea=blurmask(lambda d:d.polygon([px(*p) for p in sea_poly],fill=255),14)
n1=fbm(6,3,1); n2=fbm(6,5,2); n3=fbm(5,8,3); n4=fbm(4,2,4)
seaf=sea+n1*0.55+n2*0.2
ridge=[(-760,-1080),(-300,-830),(180,-900),(640,-730),(960,-410),(1190,-60)]
rs=spline(ridge,20,40,5)
mtn=blurmask(lambda d:d.line([px(*p) for p in rs],fill=255,width=46),42)
mtn=mtn/mtn.max()
elev=np.clip(mtn*1.0*(0.75+n2*1.2)+n1*0.25+n3*0.08+0.12,0,None)
# stag pass notch
passm=blurmask(lambda d:d.ellipse([px(-105,-865)[0]-26,px(-105,-865)[1]-70,px(-105,-865)[0]+26,px(-105,-865)[1]+70],fill=255),16)
passm=passm/passm.max()
elev=elev*(1-0.8*passm)
land=seaf<0.5
# regions: warped voronoi
seeds={"Aldmere Vale":[(-100,-100),(200,150),(-250,-350),(150,-400),(350,-150),(-220,200),(-480,-300),(60,380)],
"Frostmarch":[(-450,-900),(100,-1000),(600,-880),(950,-560),(-150,-1150),(-560,-720)],
"Saltreach":[(-820,-780),(-720,-400),(-800,380),(-640,640),(-480,860),(-1000,0),(-560,-560)],
"Blackfen":[(-100,850),(150,1050),(260,860),(-200,1150),(-230,600),(60,640)],
"Emberwaste":[(800,150),(700,650),(1050,900),(1050,-50),(650,1050),(560,330)]}
names=list(seeds)
X,Z=np.meshgrid(np.linspace(-H,H,N),np.linspace(-H,H,N))
wx=X+n1*520+n3*160; wz=Z+n4*520+n2*160
best=np.full((N,N),1e9); reg=np.zeros((N,N),int)
for i,n in enumerate(names):
    for sx,sz in seeds[n]:
        d=np.hypot(wx-sx,wz-sz)
        m=d<best; best[m]=d[m]; reg[m]=i
def region_at(x,z):
    c,r=px(x,z); return names[reg[int(r),int(c)]]
def land_at(x,z):
    c,r=px(x,z); return bool(land[int(r),int(c)])
# ---- places
plots=[("Harrowford","Aldmere Vale",-470,-300,"river meadow above the lower Alder"),("Oakmere","Aldmere Vale",260,-480,"oak forest between the two rivers"),
("Thistledown","Aldmere Vale",300,130,"open downs south of the Greywater"),("Wrenfield","Aldmere Vale",-200,220,"lakeside fields by Wren Water"),
("Frosthelm","Frostmarch",-520,-760,"a shelf in the western foothills"),("Wolfcairn","Frostmarch",520,-1010,"high plateau north of the range"),
("Gullcliff","Saltreach",-760,-560,"clifftop over the northern coast"),("Tidewatch","Saltreach",-560,650,"dunes above the southern shore"),
("Reedmoor","Blackfen",-230,560,"the firm northern edge of the fen"),("Lanternbog","Blackfen",260,980,"a dry island deep in the fen"),
("Redmesa","Emberwaste",700,60,"mesa top at the desert's edge"),("Dunehold","Emberwaste",760,860,"an oasis among the dunes")]
villages={"Kingsrest":(-150,-150),"Millbrook":(-60,-470),"Rimehold":(-80,-1080),"Gull's Rest":(-800,400),"Sunscar":(850,450),"Mirelight":(-60,900)}
sources=[("Kingsbarrow Hollow",120,520),("Greywater Sink",560,-420),("Rimecut Caves",-650,-1080),("Drowned Grotto",-870,-860),("Fenmouth Deeps",-250,860),("Scorched Throat",1050,720),("Witchroot Sink",520,1160)]
order=[("Ashen Gate Chapterhouse",420,-170),("Ashen Watch",480,560),("Crownhold (ruin)",-235,-345),("Bellhollow",155,-100)]
camps=[(1050,-800),(-820,-1150),(1100,1150),(-120,1190)]
rivers={"River Alder":[(140,-830),(40,-640),(-70,-470),(-90,-300),(-150,-150),(-330,-60),(-540,40)],
"Greywater":[(830,-520),(540,-340),(330,-270),(120,-210),(-150,-150)],
"Blackwater":[(-60,330),(-30,520),(-120,720),(-60,900),(-200,1010),(-340,1060)]}
lakes=[("Wren Water",-60,300,70,45),("Hallowmere",60,-1130,60,35)]
V=villages; P={n:(x,z) for n,_,x,z,_ in plots}
def stn(name,toward):
    x,z=P[name]; dx,dz=toward[0]-x,toward[1]-z; L=math.hypot(dx,dz); return (x+95*dx/L,z+95*dz/L)
ST={"Harrowford":(-385,-345),"Oakmere":stn("Oakmere",V["Millbrook"]),"Thistledown":(225,25),"Wrenfield":(-110,190),
"Frosthelm":stn("Frosthelm",(-640,-640)),"Wolfcairn":stn("Wolfcairn",V["Rimehold"]),"Gullcliff":(-655,-505),"Tidewatch":(-520,555),
"Reedmoor":(-140,520),"Lanternbog":(180,900),"Redmesa":(640,150),"Dunehold":(865,805)}
rails={"North Line":[V["Kingsrest"],(-130,-320),V["Millbrook"],(-20,-680),(-110,-900),V["Rimehold"],(200,-1120),ST["Wolfcairn"]],
"Oakmere Branch":[V["Millbrook"],(50,-500),ST["Oakmere"]],
"Coast Line":[V["Kingsrest"],(-270,-230),ST["Harrowford"],(-540,-440),ST["Gullcliff"],(-640,-640),ST["Frosthelm"]],
"Bay Line":[V["Kingsrest"],(-300,-10),(-440,120),(-500,280),(-680,330),V["Gull's Rest"]],
"Fen Line":[V["Kingsrest"],(-130,20),ST["Wrenfield"],(-90,360),ST["Reedmoor"],(-150,740),V["Mirelight"],(60,900),ST["Lanternbog"]],
"Shore Branch":[ST["Reedmoor"],(-250,440),(-400,480),ST["Tidewatch"],(-680,480),V["Gull's Rest"]],
"Sun Line":[V["Kingsrest"],(40,-60),ST["Thistledown"],(430,70),(560,170),ST["Redmesa"],(800,260),V["Sunscar"],(900,640),ST["Dunehold"],(800,1000),(520,1080),(330,1090),(150,1010),(130,930),ST["Lanternbog"]]}
railpts={k:spline(v,16,6 if len(v)>3 else 0,i+20) for i,(k,v) in enumerate(rails.items())}
trails={"Greywater Road":[ST["Oakmere"],(190,-370),(330,-290),(420,-170),(380,-40),ST["Thistledown"]],
"High Road":[ST["Frosthelm"],(-430,-610),(-250,-560),V["Millbrook"]],
"Drover's Way":[ST["Wrenfield"],(20,180),(110,90),ST["Thistledown"]],
"Dune Track":[(110,90),(250,330),(480,560),(680,540),V["Sunscar"]],
"Smugglers' Path":[ST["Tidewatch"],(-400,600),(-340,760),(-250,860),V["Mirelight"]],
"Barrow Path":[ST["Reedmoor"],(0,560),(120,520),(300,470),(480,560)]}
trailpts={k:spline(v,16,8,i+50) for i,(k,v) in enumerate(trails.items())}
# ---- checks
ok=True
for n,r,x,z,_ in plots:
    ra=region_at(x,z); la=all(land_at(x+dx,z+dz) for dx,dz in [(0,0),(80,0),(-80,0),(0,80),(0,-80)])
    if ra!=r or not la: ok=False
    print(n,r,ra,la)
for n,(x,z) in villages.items(): print(n,region_at(x,z),land_at(x,z))
for n,x,z in sources+order: print(n,region_at(x,z),land_at(x,z), round(min(math.hypot(x-a,z-b) for a,b in P.values())))
for x,z in camps: print('camp',land_at(x,z),region_at(x,z))
allp=list(P.items())
print('min plot spacing',min((round(math.dist(a,b)),m,n) for i,(m,a) in enumerate(allp) for n,b in allp[i+1:]))
print('min plot-village',min((round(math.dist(a,b)),m,n) for m,a in allp for n,b in V.items()))
for k,v in list(railpts.items())+list(trailpts.items()):
    for pn,pp_ in P.items():
        md=min(math.dist(q,pp_) for q in v)
        if md<86: print('  TOO CLOSE',k,pn,round(md))
    L=sum(math.dist(v[i],v[i+1]) for i in range(len(v)-1)); sea_n=sum(not land_at(*q) for q in v); print(k,round(L),'sea pts',sea_n)
# ---- render
COL={"Aldmere Vale":(118,158,84),"Frostmarch":(214,226,234),"Saltreach":(196,196,128),"Blackfen":(84,104,72),"Emberwaste":(212,146,88)}
img=np.zeros((N,N,3),np.float32)
for i,n in enumerate(names):
    m=np.asarray(Image.fromarray(((reg==i)*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(7)),dtype=np.float32)/255
    img+=m[...,None]*np.array(COL[n],np.float32)
# forests in vale/frost
forest=(n3+n2*0.6)>0.06
fv=forest&(reg==0); img[fv]=img[fv]*0.55+np.array((58,104,56))*0.45
ff=forest&(reg==1)&(elev<0.5); img[ff]=img[ff]*0.6+np.array((70,100,88))*0.4
fb=((n3>0.03))&(reg==3); img[fb]=img[fb]*0.7+np.array((52,84,84))*0.3
# mesas / dunes texture
em=(reg==4); img[em]+= (np.sin((X[em]+Z[em]*0.6+n1[em]*900)/26)*8)[:,None]
# rock and snow by elevation
rock=np.clip((elev-0.42)/0.25,0,1)[...,None]
rockcol=np.where((reg==4)[...,None],np.array((150,90,62),np.float32),np.array((128,126,124),np.float32))
img=img*(1-rock)+rockcol*rock
snow=np.clip((elev-0.72)/0.15,0,1)[...,None]*((reg!=4)[...,None])
img=img*(1-snow)+np.array((246,248,250),np.float32)*snow
# hillshade
gy,gx=np.gradient(elev*260); shade=np.clip(1+(-gx-gy)*0.09,0.55,1.35)
img*=shade[...,None]
# beach + sea
beach=(seaf>0.44)&land; img[beach]=img[beach]*0.4+np.array((226,212,160))*0.6
depth=np.clip((seaf-0.5)/0.5,0,1)
seacol=np.array((92,150,190),np.float32)*(1-depth[...,None])+np.array((44,86,140),np.float32)*depth[...,None]
img[~land]=seacol[~land]
img+=rng.normal(0,2.2,(N,N,1))
im=Image.fromarray(np.clip(img,0,255).astype(np.uint8))
# rivers & lakes
d=ImageDraw.Draw(im)
RIV=(70,130,185)
for i,(n,pts) in enumerate(rivers.items()):
    sp=spline(pts,22,22,i+7); k=len(sp)
    for j in range(k-1):
        w=1.5+3.5*j/k; d.line([px(*sp[j]),px(*sp[j+1])],fill=RIV,width=int(round(w)))
for n,x,z,a,b in lakes:
    c=px(x,z); pts=[(c[0]+(a*S)*math.cos(t)*(1+0.18*math.sin(3*t+1)), c[1]+(b*S)*math.sin(t)*(1+0.2*math.cos(2*t))) for t in np.linspace(0,6.28,40)]
    d.polygon(pts,fill=(196,222,236) if n=="Hallowmere" else RIV)
im=im.filter(ImageFilter.GaussianBlur(0.6))
canvas=Image.new('RGB',(N+2*M,N+2*M+10),(38,44,54)); canvas.paste(im,(M,M)); d=ImageDraw.Draw(canvas)
def Q(x,z): a=px(x,z); return (a[0]+M,a[1]+M)
F='/usr/share/fonts/truetype/dejavu/'
fb_=ImageFont.truetype(F+'DejaVuSerif-Bold.ttf',14); fs=ImageFont.truetype(F+'DejaVuSans.ttf',11); fi=ImageFont.truetype(F+'DejaVuSerif-Bold.ttf',12)
fr=ImageFont.truetype(F+'DejaVuSerif-Bold.ttf',22); ft=ImageFont.truetype(F+'DejaVuSerif-Bold.ttf',24)
d.rectangle([M-2,M-2,M+N+1,M+N+1],outline=(20,20,20),width=3)
RC={"North Line":(70,50,40),"Oakmere Branch":(70,50,40),"Coast Line":(40,60,110),"Bay Line":(130,50,45),"Fen Line":(60,90,50),"Shore Branch":(60,90,50),"Sun Line":(150,90,20)}
for k,v in railpts.items():
    pp=[Q(*p) for p in v]; d.line(pp,fill=(245,238,220),width=6,joint="curve"); d.line(pp,fill=RC[k],width=3,joint="curve")
for k,v in trailpts.items():
    pp=[Q(*p) for p in v]
    for j in range(0,len(pp)-1,2): d.line([pp[j],pp[j+1]],fill=(250,240,200),width=4); d.line([pp[j],pp[j+1]],fill=(120,84,50),width=2)
def label(xy,t,font,fill,anchor="mt",sw=3): d.text(xy,t,font=font,fill=fill,anchor=anchor,stroke_width=sw,stroke_fill=(250,245,230))
for n,r,x,z,_ in plots:
    c=Q(x,z); rr=80*S
    d.ellipse([c[0]-rr,c[1]-rr,c[0]+rr,c[1]+rr],outline=(255,244,210),width=3)
    d.rectangle([c[0]-4,c[1]-4,c[0]+4,c[1]+4],fill=(214,174,72),outline=(0,0,0))
    s=Q(*ST[n]); d.ellipse([s[0]-4,s[1]-4,s[0]+4,s[1]+4],fill=(255,255,255),outline=(0,0,0),width=2)
    label((c[0],c[1]+rr+3),n,fb_,(20,20,20))
for n,(x,z) in villages.items():
    c=Q(x,z); r=10 if n=="Kingsrest" else 8
    d.regular_polygon((c[0],c[1],r),6,fill=(170,40,40) if n=="Kingsrest" else (236,204,90),outline=(0,0,0))
    label((c[0],c[1]-r-3),n,fb_,(100,20,20),"mb")
for n,x,z in sources:
    c=Q(x,z); d.ellipse([c[0]-5,c[1]-5,c[0]+5,c[1]+5],fill=(110,60,150),outline=(255,255,255),width=2); label((c[0],c[1]+7),n,fs,(60,20,90),sw=2)
for n,x,z in order:
    c=Q(x,z); d.polygon([(c[0],c[1]-8),(c[0]+7,c[1]+6),(c[0]-7,c[1]+6)],fill=(80,80,80),outline=(255,255,255)); label((c[0],c[1]+8),n,fs,(30,30,30),sw=2)
# sealed ways out, kept for later updates (EXPANSION in scripts/plots/config.js)
for nm,x,z,an in [("The Shut Pass ▶\n(sealed, for a later update)",1225,-190,"rm"),("◀ The Far Shore\n(across the sea, later)",-1225,300,"lm"),("▼ The Horizon Isles (later)",-700,1225,"mb")]:
    c=Q(x,z); d.ellipse([c[0]-6,c[1]-6,c[0]+6,c[1]+6],fill=(250,245,230),outline=(60,40,90),width=2)
    off={"rm":(-12,0),"lm":(12,0),"mb":(0,-10)}[an]; d.multiline_text((c[0]+off[0],c[1]+off[1]),nm,font=fs,fill=(60,40,90),anchor=an,stroke_width=3,stroke_fill=(250,245,230),align="right" if an=="rm" else "left")
for x,z in camps:
    c=Q(x,z); d.line([c[0]-6,c[1]-6,c[0]+6,c[1]+6],fill=(160,20,20),width=4); d.line([c[0]-6,c[1]+6,c[0]+6,c[1]-6],fill=(160,20,20),width=4)
for t,(x,z) in {"F R O S T M A R C H":(330,-1180),"S A L T R E A C H":(-600,900),"E M B E R W A S T E":(900,330),"B L A C K F E N":(60,1150),"A L D M E R E   V A L E":(60,-30)}.items():
    label(Q(x,z),t,fr,(40,36,30),"mm")
for t,(x,z) in {"The Greyspine":(640,-640),"Stag Pass":(-190,-870),"Gull Bay":(-800,110),"The Western Sea":(-1090,-300),"River Alder":(10,-590),"Greywater":(430,-340),"Blackwater":(-10,650),"Wren Water":(-40,355),"Hallowmere":(100,-1085)}.items():
    label(Q(x,z),t,fi,(30,50,90) if any(w in t for w in ("Bay","Sea","River","water","Water","Mere")) else (60,50,40),"mm",2)
d.text(((N+2*M)/2,26),"The Hollow Crown: map plan (2,500 × 2,500 blocks, north up)",font=ft,fill=(240,230,210),anchor="mm")
lx,ly=M+12,M+N-188
d.rectangle([lx,ly,lx+300,ly+176],fill=(250,245,230),outline=(0,0,0))
for i,(t,c) in enumerate([("■ Plot Stone, ring = 80-block plot",(150,112,40)),("○ Plot station",(0,0,0)),("⬢ Village (red = Kingsrest, spawn)",(140,100,20)),("● Source candidate cave",(110,60,150)),("▲ Order of the Ashen Gate",(80,80,80)),("✕ Warlord camp",(160,20,20)),("━ Rail line with road beside it",(70,50,40)),("╌ Bridleway (horse road)",(120,84,50))]):
    d.text((lx+10,ly+8+i*16),t,font=fs,fill=c)
sx=lx+10; sy=ly+156; d.line([sx,sy,sx+500*S,sy],fill=(0,0,0),width=3); d.text((sx+500*S+8,sy),"500 blocks",font=fs,fill=(0,0,0),anchor="lm")
canvas.save('/mnt/project-files/siege-nights/map/hollow-crown-map.png')
json.dump({"trails":{k:round(sum(math.dist(v[i],v[i+1]) for i in range(len(v)-1))) for k,v in trailpts.items()},"plots":plots,"stations":{k:[round(a),round(b)] for k,(a,b) in ST.items()},"rails":{k:round(sum(math.dist(v[i],v[i+1]) for i in range(len(v)-1))) for k,v in railpts.items()}},open('organic.json','w'),indent=1)
print('OK' if ok else 'FIX')

# ================= ELEVATION (block heights) =================
SEA=62
shore=np.clip((0.5-seaf)/0.16,0,1)             # 0 at the waterline, 1 inland
fen=np.asarray(Image.fromarray(((reg==3)*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(14)),dtype=np.float32)/255
des=np.asarray(Image.fromarray(((reg==4)*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(14)),dtype=np.float32)/255
salt=np.asarray(Image.fromarray(((reg==2)*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(14)),dtype=np.float32)/255
m=np.clip(mtn*(0.75+n2*1.2),0,1.3)*(1-0.86*passm)
north=blurmask(lambda d:d.polygon([px(*p) for p in [(-1250,-1250)]+[(-1250,-1080)]+rs+[(1250,-60),(1250,-1250)]],fill=255),45)
plateau=np.clip(north*1.15+n1*0.25,0,1)*np.clip(1-mtn*1.1,0,1)   # high cold plateau north of the range
rolling=(n1+0.5)*14+(n3+0.5)*7+(n2+0.5)*4
mesa=des*np.clip(np.round(((n3+0.5)*3))*9,0,27)*0.8
cliff=salt*np.clip((-wz-150)/500,0,1)*26                   # northern coast rises to cliffs
Yf=SEA+1+shore*(3+rolling*(1-0.85*fen)+m*150+plateau*38+mesa+cliff)
# river valleys cut down
rv=blurmask(lambda d:[d.line([px(*p) for p in spline(pts,22,22,i+7)],fill=255,width=5) for i,(n_,pts) in enumerate(rivers.items())],9)
Yf=Yf-np.clip(rv*2.2,0,1)*np.minimum(Yf-SEA-1,10)*shore
Yf[~land]=SEA-np.clip((seaf[~land]-0.5)/0.4,0,1)*30
# plot terraces: every plot gets a level patch for its final settlement (hall, buildings, wall at r56),
# eased back into the natural ground, so a generated wall can follow the ground all the way round.
# The patch is not a circle (Mateo 2026-11-11): its edge wanders with the bearing, never closer than
# r64 (raiders gather out to r64) and reaching out to about r100 in places; the easing band wanders too.
PLOT_FLAT,PLOT_EASE=64,115
def plot_shape(name, theta):
    """Wandering edge factor (>= 1) by bearing; same numbers as genworld.py's clearing."""
    r_=np.random.default_rng(sum(map(ord,name))*7919)
    f=np.ones_like(theta)
    for k in (2,3,5,7):
        a=r_.uniform(0.05,0.22)/(1+0.15*k); ph=r_.uniform(0,6.283)
        f=f+a*(1+np.cos(k*theta+ph))
    return f
for n_,_,x_,z_,_ in plots:
    dist=np.hypot(X-x_,Z-z_); th=np.arctan2(Z-z_,X-x_)
    core=(dist<=46)&land
    T=float(np.median(Yf[core]))
    f=plot_shape(n_,th); rf=PLOT_FLAT*f; re_=rf+(PLOT_EASE-PLOT_FLAT)*(0.7+0.6*(plot_shape(n_+"e",th)-1))
    w=np.clip((re_-dist)/(re_-rf),0,1); w=w*w*(3-2*w)
    Yf=np.where(land,Yf*(1-w)+(T+n3*1.6)*w,Yf)
# story sites shaped into the land: Crownhold stands on a low rise, Bellhollow lies in a hollow
for (x_,z_,amp,rad) in [(-235,-345,9,120),(155,-100,-13,80)]:
    w=np.clip(1-np.hypot(X-x_,Z-z_)/rad,0,1); w=w*w*(3-2*w)
    Yf=np.where(land,Yf+amp*w,Yf)
Yb=np.round(Yf).astype(int)
def y_at(x,z):
    c,r=px(x,z); return int(Yb[int(r),int(c)])
def y_site(x,z,rad=40):
    c,r=px(x,z); k=int(rad*S); return int(np.median(Yb[int(r)-k:int(r)+k+1,int(c)-k:int(c)+k+1]))
elev_out={"plots":{n:y_site(x,z) for n,_,x,z,_ in plots},"villages":{n:y_site(x,z,30) for n,(x,z) in villages.items()},
 "features":{"Stag Pass":y_at(-105,-865),"highest peak":int(Yb.max()),"Hallowmere":y_at(60,-1130),"Wren Water":y_at(-60,300)}}
prof={}
for k,v in list(railpts.items())+list(trailpts.items()):
    # resample every ~8 blocks
    va=np.array(v); seg=np.linalg.norm(np.diff(va,axis=0),axis=1); cum=np.concatenate([[0],np.cumsum(seg)])
    dd=np.arange(0,cum[-1],8.0); pts=np.stack([np.interp(dd,cum,va[:,0]),np.interp(dd,cum,va[:,1])],1)
    ys=np.array([y_at(*p) for p in pts],float)
    # a built road smooths the ground: rolling mean over ~50 blocks
    kk=7; sm=np.convolve(np.pad(ys,(kk,kk),mode='edge'),np.ones(2*kk+1)/(2*kk+1),mode='valid')
    grade=np.abs(np.diff(sm))/8
    steep=int((grade>0.5).sum()*8)
    prof[k]={"len":int(len(pts)*8),"minY":int(sm.min()),"maxY":int(sm.max()),"climb":int(np.clip(np.diff(sm),0,None).sum()),"steep_blocks":steep,"ys":sm}
    print(k,{a:b for a,b in prof[k].items() if a!='ys'})
print(elev_out)
# --- height map picture with contours
hm=np.zeros((N,N,3),np.float32)
t=np.clip((Yf-SEA)/170,0,1)
stops=[(0,(96,150,92)),(0.06,(140,180,104)),(0.14,(196,200,130)),(0.3,(176,140,96)),(0.55,(140,120,110)),(0.8,(225,225,228)),(1,(255,255,255))]
for i in range(len(stops)-1):
    a,ca=stops[i]; b,cb=stops[i+1]; msk=(t>=a)&(t<=b); f=((t-a)/(b-a))[...,None]
    hm=np.where(msk[...,None],np.array(ca)*(1-f)+np.array(cb)*f,hm)
gy,gx=np.gradient(Yf); hm*=np.clip(1+(-gx-gy)*0.12,0.5,1.4)[...,None]
dep=np.clip((SEA-Yf)/30,0,1)[...,None]; hm=np.where((~land)[...,None],np.array((110,165,205))*(1-dep)+np.array((40,80,140))*dep,hm)
for lvl in range(70,240,10):
    c=(np.abs(Yf-lvl)<(0.35 if lvl%50 else 0.8))&land; hm[c]*=0.72
him=Image.fromarray(np.clip(hm,0,255).astype(np.uint8))
hd=ImageDraw.Draw(him)
for i,(n_,pts) in enumerate(rivers.items()):
    sp=spline(pts,22,22,i+7); hd.line([px(*p) for p in sp],fill=RIV,width=3)
c2=Image.new('RGB',(N+2*M,N+2*M+10),(38,44,54)); c2.paste(him,(M,M)); d=ImageDraw.Draw(c2)
for k,v in railpts.items(): d.line([Q(*p) for p in v],fill=(40,30,30),width=2)
for k,v in trailpts.items():
    pp=[Q(*p) for p in v]
    for j in range(0,len(pp)-1,2): d.line([pp[j],pp[j+1]],fill=(90,60,40),width=1)
for n,r,x,z,_ in plots:
    c=Q(x,z); rr=80*S; d.ellipse([c[0]-rr,c[1]-rr,c[0]+rr,c[1]+rr],outline=(255,244,210),width=2)
    label((c[0],c[1]),f"{n}\nY {elev_out['plots'][n]}",fs,(20,20,20),"mm",2)
for n,(x,z) in villages.items():
    c=Q(x,z); d.regular_polygon((c[0],c[1],6),6,fill=(236,204,90),outline=(0,0,0)); label((c[0],c[1]-8),f"{n}  Y {elev_out['villages'][n]}",fs,(100,20,20),"mb",2)
label(Q(-85,-865),f"Stag Pass Y {elev_out['features']['Stag Pass']}",fs,(30,30,30),"lm",2)
d.text(((N+2*M)/2,26),"The Hollow Crown: elevation (contour every 10 blocks, sea level Y 62)",font=ft,fill=(240,230,210),anchor="mm")
# colour key
kx,ky=M+12,M+N-60
d.rectangle([kx,ky,kx+330,ky+48],fill=(250,245,230),outline=(0,0,0))
for i in range(300):
    tt=i/299; 
    for j in range(len(stops)-1):
        a,ca=stops[j]; b,cb=stops[j+1]
        if a<=tt<=b: f=(tt-a)/(b-a); col=tuple(int(ca[q]*(1-f)+cb[q]*f) for q in range(3))
    d.line([kx+15+i,ky+8,kx+15+i,ky+22],fill=col)
for yv in (63,100,150,200,232):
    xx=kx+15+int((yv-SEA)/170*299); d.text((xx,ky+26),f"Y {yv}",font=fs,fill=(0,0,0),anchor="mt")
c2.save('/mnt/project-files/siege-nights/map/hollow-crown-elevation.png')
# --- rail profiles picture
PW,PH=1100,150; names_=list(railpts)
pim=Image.new('RGB',(PW+160,PH*len(names_)+50),(250,245,230)); pd=ImageDraw.Draw(pim)
pd.text((20,12),"Rail line height profiles (after cuttings and embankments). Red = too steep for plain track: needs a tunnel or switchbacks.",font=fs,fill=(0,0,0))
for i,k in enumerate(names_):
    ys=prof[k]["ys"]; y0=40+i*PH; L=len(ys)*8; sc=PW/2700
    pd.text((10,y0+4),f"{k}  ({prof[k]['len']} blocks, Y {prof[k]['minY']} to {prof[k]['maxY']})",font=fb_,fill=(40,30,30))
    base=y0+PH-18
    f=lambda yv: base-(yv-60)/180*(PH-45)
    pd.line([20,base,20+L*sc,base],fill=(120,120,120)); 
    for yv in (62,100,150,200): pd.line([20,f(yv),20+L*sc,f(yv)],fill=(215,208,190)); pd.text((24+L*sc,f(yv)),f"Y{yv}",font=fs,fill=(120,120,120),anchor="lm")
    for j in range(len(ys)-1):
        g=abs(ys[j+1]-ys[j])/8
        pd.line([20+j*8*sc,f(ys[j]),20+(j+1)*8*sc,f(ys[j+1])],fill=(200,40,40) if g>0.5 else (50,90,50),width=3)
pim.save('/mnt/project-files/siege-nights/map/hollow-crown-rail-profiles.png')
json.dump({**elev_out,"lines":{k:{a:b for a,b in v.items() if a!='ys'} for k,v in prof.items()}},open('elev.json','w'),indent=1)

# ================= STORY MAP =================
story=[(1,"I","Kingsrest: arrive, choose a plot",-150,-150),(2,"I","Your plot: first siege, the Falling Ember, the choice",None,None),
(3,"I","Millbrook: the stopped clocks",-60,-470),(4,"I","Under the Millbrook well: the Clockwork Reeve",-40,-440),
(5,"I","Ashen Gate Chapterhouse: the sealed archive, cipher wheel",420,-170),
(6,"II","Gull's Rest: the lighthouse letters",-800,400),(7,"II","Drowned chapel in Gull Bay: the Drowned Bride",-690,130),
(8,"II","Mirelight: the testimony of five villagers",-60,900),(9,"II","The Hollow Tree: the Mother of Changelings",-120,1060),
(10,"II","Ashen Watch and the desert ruins: statue fragments",480,560),(11,"II","Sunscar: the faceless statues, the vault, the Ash Seneschal",850,450),
(12,"II","Stag Pass: the only road north",-105,-865),(13,"II","Rimehold: the moon shrine",-80,-1080),(14,"II","Hallowmere ice door: the Pale Huntsman",60,-1130),
(15,"III","Seven caves: find which one holds the Rift",None,None),(16,"IV","The throne, then the Citadel rises on the victor's plot",None,None)]
ACT={"I":(40,120,60),"II":(40,70,150),"III":(110,60,150),"IV":(160,30,30)}
# seep sites: scattered wild spots away from everything
occupied=[(x,z) for _,_,x,z,_ in plots]; other=[v for v in villages.values()]+[(x,z) for _,x,z in sources+order]+list(camps)+[(s[3],s[4]) for s in story if s[3] is not None]
r5=np.random.default_rng(42); seeps=[]
tries=0
while len(seeps)<12 and tries<20000:
    tries+=1; x,z=r5.uniform(-1180,1180,2)
    if not land_at(x,z) or y_at(x,z)>150: continue
    if min(math.hypot(x-a,z-b) for a,b in occupied)<230: continue
    if min(math.hypot(x-a,z-b) for a,b in other)<170: continue
    if seeps and min(math.hypot(x-a,z-b) for a,b in seeps)<380: continue
    if min(math.dist((x,z),q) for v in railpts.values() for q in v[::4])<60: continue
    seeps.append((round(x/10)*10,round(z/10)*10))
seeps.sort(key=lambda p:(region_at(*p),p))
print('seeps',[(p,region_at(*p),y_at(*p)) for p in seeps])
sm_=im.copy().convert('L').convert('RGB'); sm_=Image.blend(sm_,im,0.45)
c3=Image.new('RGB',(N+2*M,N+2*M+10),(38,44,54)); c3.paste(sm_,(M,M)); d=ImageDraw.Draw(c3)
for k,v in railpts.items(): d.line([Q(*p) for p in v],fill=(90,80,70),width=2)
for n,r,x,z,_ in plots:
    c=Q(x,z); rr=80*S; d.ellipse([c[0]-rr,c[1]-rr,c[0]+rr,c[1]+rr],outline=(255,244,210),width=2); label((c[0],c[1]),n,fs,(60,60,60),"mm",2)
for n,x,z in sources:
    c=Q(x,z); d.ellipse([c[0]-7,c[1]-7,c[0]+7,c[1]+7],fill=ACT["III"],outline=(255,255,255),width=2); label((c[0],c[1]+9),n,fs,(60,20,90),sw=2)
for x,z in camps:
    c=Q(x,z); d.line([c[0]-6,c[1]-6,c[0]+6,c[1]+6],fill=(160,20,20),width=4); d.line([c[0]-6,c[1]+6,c[0]+6,c[1]-6],fill=(160,20,20),width=4)
for x,z in seeps:
    c=Q(x,z); d.polygon([(c[0],c[1]-7),(c[0]+7,c[1]),(c[0],c[1]+7),(c[0]-7,c[1])],fill=(20,150,150),outline=(255,255,255))
prev=None
for num,act,text,x,z in story:
    if x is None: continue
    c=Q(x,z)
    if prev: 
        # dotted leg
        a=np.array(prev); b=np.array(c); L=np.linalg.norm(b-a)
        for t0 in np.arange(0,L,10): 
            p0=a+(b-a)*t0/L; p1=a+(b-a)*min(t0+5,L)/L; d.line([tuple(p0),tuple(p1)],fill=(30,30,30),width=2)
    prev=c
for num,act,text,x,z in story:
    if x is None: continue
    c=Q(x,z); d.ellipse([c[0]-11,c[1]-11,c[0]+11,c[1]+11],fill=ACT[act],outline=(255,255,255),width=2); d.text(c,str(num),font=fb_,fill=(255,255,255),anchor="mm")
d.text(((N+2*M)/2,26),"The Hollow Crown: where the story goes",font=ft,fill=(240,230,210),anchor="mm")
lx,ly=M+12,M+N-330
d.rectangle([lx,ly,lx+430,ly+318],fill=(250,245,230),outline=(0,0,0))
for i,(num,act,text,x,z) in enumerate(story):
    d.ellipse([lx+8,ly+8+i*16,lx+22,ly+22+i*16],fill=ACT[act]); d.text((lx+15,ly+15+i*16),str(num),font=ImageFont.truetype(F+'DejaVuSans-Bold.ttf',9),fill=(255,255,255),anchor="mm")
    d.text((lx+28,ly+8+i*16),f"Act {act}: {text}",font=fs,fill=(20,20,20))
yy=ly+8+len(story)*16+4
d.ellipse([lx+8,yy,lx+22,yy+14],fill=ACT["III"],outline=(255,255,255)); d.text((lx+28,yy),"Source candidate cave (one is real, different each world)",font=fs,fill=(20,20,20))
d.polygon([(lx+15,yy+18),(lx+22,yy+25),(lx+15,yy+32),(lx+8,yy+25)],fill=(20,150,150)); d.text((lx+28,yy+18),"Seep site: random Hollow incursions, forever",font=fs,fill=(20,20,20))
d.text((lx+10,yy+34),"✕",font=fs,fill=(160,20,20)); d.text((lx+28,yy+36),"Warlord camp",font=fs,fill=(20,20,20))
c3.save('/mnt/project-files/siege-nights/map/hollow-crown-story-map.png')

# ================= EXPORT for world generation =================
roadm=blurmask(lambda d:[d.line([px(*p) for p in v],fill=255,width=3) for v in railpts.values()],0.8)
trailm=blurmask(lambda d:[d.line([px(*p) for p in v],fill=255,width=2) for v in trailpts.values()],0.6)
np.savez_compressed('terrain.npz',Y=Yf.astype(np.float32),reg=reg.astype(np.uint8),land=land,forest=((n3+n2*0.6)).astype(np.float32),river=rv.astype(np.float32),road=roadm.astype(np.float32),trail=trailm.astype(np.float32),H=H,N=N)

json.dump({"rivers":{n:[[float(a),float(b)] for a,b in spline(pts,22,22,i+7)] for i,(n,pts) in enumerate(rivers.items())},
 "roads":{k:[[float(a),float(b)] for a,b in v] for k,v in railpts.items()},"trails":{k:[[float(a),float(b)] for a,b in v] for k,v in trailpts.items()}},open('lines.json','w'))
