"""Generate a Bedrock test world from the map plan's terrain data.
Run with a Python that has amulet-core 1.9:  python genworld.py terrain.npz out_dir x0 z0 size
"""
import sys, os, shutil, math, zipfile, numpy as np
import amulet
from amulet.api.block import Block
from amulet.api.chunk import Chunk
from amulet.level.formats.leveldb_world import LevelDBFormat
from amulet_nbt import ByteTag, IntTag, StringTag, LongTag
src,out,X0,Z0,SIZE=sys.argv[1],sys.argv[2],int(sys.argv[3]),int(sys.argv[4]),int(sys.argv[5])
VER=(1,21,90); SEA=62; DIM="minecraft:overworld"
t=np.load(src); H=int(t['H']); N=int(t['N']); S=N/(2*H)
def sample(arr,order_smooth=True):
    """Bilinear sample of a plan grid at every block of the slice -> [x,z] array"""
    xs=(np.arange(X0,X0+SIZE)+H)*S; zs=(np.arange(Z0,Z0+SIZE)+H)*S
    gx,gz=np.meshgrid(xs,zs,indexing='ij')
    if not order_smooth: return arr[np.clip(np.round(gz).astype(int),0,N-1),np.clip(np.round(gx).astype(int),0,N-1)]
    x0=np.clip(np.floor(gx).astype(int),0,N-2); z0=np.clip(np.floor(gz).astype(int),0,N-2); fx=gx-x0; fz=gz-z0
    a=arr.astype(np.float32)
    return a[z0,x0]*(1-fx)*(1-fz)+a[z0,x0+1]*fx*(1-fz)+a[z0+1,x0]*(1-fx)*fz+a[z0+1,x0+1]*fx*fz
rng=np.random.default_rng(5)
def noise(scale,seed):
    r=np.random.default_rng(seed); g=r.random((SIZE//scale+3,SIZE//scale+3)).astype(np.float32)
    xs=np.arange(SIZE)/scale; x0=xs.astype(int); f=xs-x0; f=f*f*(3-2*f)
    a=g[x0][:,x0]*(1-f)[:,None]*(1-f)[None,:]+g[x0+1][:,x0]*f[:,None]*(1-f)[None,:]+g[x0][:,x0+1]*(1-f)[:,None]*f[None,:]+g[x0+1][:,x0+1]*f[:,None]*f[None,:]
    return a-0.5
Yf=sample(t['Y'])+noise(24,1)*3.0+noise(9,2)*1.2
land=sample(t['land'].astype(np.float32))>0.5
forest=sample(t['forest'])+noise(12,3)*0.08
import json
from PIL import Image, ImageDraw
L=json.load(open(os.path.join(os.path.dirname(os.path.abspath(src)),'lines.json')))
def raster(lines,width_fn):
    im=Image.new('L',(SIZE,SIZE),0); d=ImageDraw.Draw(im)
    for pts in lines:
        k=len(pts)
        for j in range(k-1):
            w=width_fn(j/k); a_=(pts[j][0]-X0,pts[j][1]-Z0); b_=(pts[j+1][0]-X0,pts[j+1][1]-Z0)
            d.line([a_,b_],fill=255,width=w); r_=w/2; d.ellipse([b_[0]-r_,b_[1]-r_,b_[0]+r_,b_[1]+r_],fill=255)
    return (np.asarray(im)>127).T      # -> [x,z]
rl=list(L["rivers"].values())
isriver=raster(rl,lambda f:int(7+8*f))&land
bank=raster(rl,lambda f:int(13+10*f))&land&~isriver
valley=raster(rl,lambda f:int(30+14*f)).astype(np.float32)
isroad=raster(list(L["roads"].values()),lambda f:5)&land&~isriver
istrail=raster(list(L["trails"].values()),lambda f:3)&land&~isroad&~isriver
river=valley
reg=sample(t['reg'],False)
# roads sit on gently smoothed ground
def box(a,k):
    p=np.pad(a,k,mode='edge'); c=np.cumsum(np.cumsum(p,0),1); c=np.pad(c,((1,0),(1,0)))
    n=2*k+1; return (c[n:,n:]-c[:-n,n:]-c[n:,:-n]+c[:-n,:-n])/(n*n)
Ys=box(Yf,6); near=box((isroad|istrail).astype(np.float32),3)
Yf=np.where(near>0.02,Yf*(1-np.clip(near*6,0,1))+Ys*np.clip(near*6,0,1),Yf)
Yr=box(Yf,16); rw=np.clip(box(valley,6),0,1); Yf=Yf*(1-rw)+(Yr-1.5)*rw
Y=np.round(Yf).astype(int); Y[land]=np.maximum(Y[land],SEA+1)
Y[isriver]-=3; Y[bank]-=1
# ---- blocks
level_path=out
if os.path.exists(level_path): shutil.rmtree(level_path)
w=LevelDBFormat(level_path); w.create_and_open("bedrock",VER,overwrite=True)
rt=w.root_tag.compound if hasattr(w.root_tag,'compound') else w.root_tag
def setk(k,v):
    try: rt[k]=v
    except Exception as e: print('level.dat',k,e)
setk("LevelName",StringTag("Hollow Crown terrain test")); setk("GameType",IntTag(1)); setk("commandsEnabled",ByteTag(1))
setk("Generator",IntTag(2)); setk("SpawnX",IntTag(-118)); setk("SpawnZ",IntTag(-118)); setk("SpawnY",IntTag(int(Y[-118-X0,-118-Z0])+3))
setk("spawnMobs",ByteTag(0)); setk("dodaylightcycle",ByteTag(0)); setk("Time",LongTag(6000))
try: w.root_tag=w.root_tag
except Exception as e: print('root_tag set',e)
w.save(); w.close()
level=amulet.load_level(level_path)
ver=level.translation_manager.get_version("bedrock",VER)
def B(name,props=None):
    u=ver.block.to_universal(Block("minecraft",name,props or {}))[0]; return level.block_palette.get_add_block(u)
ID={n:B(n) for n in ["stone","grass_block","dirt","water","sand","gravel","bedrock","cobblestone","grass_path","stone_bricks","gold_block","mossy_cobblestone","coarse_dirt","oak_log","birch_log","clay","andesite"]}
ID["oak_leaves"]=B("oak_leaves",{"persistent_bit":ByteTag(1)}); ID["birch_leaves"]=B("birch_leaves",{"persistent_bit":ByteTag(1)})
ID["grass"]=B("short_grass"); ID["dandelion"]=B("dandelion"); ID["poppy"]=B("poppy")
AIR=level.block_palette.get_add_block(ver.block.to_universal(Block("minecraft","air"))[0])
biome_plains=level.biome_palette.get_add_biome(ver.biome.to_universal("minecraft:plains"))
biome_forest=level.biome_palette.get_add_biome(ver.biome.to_universal("minecraft:forest"))
biome_river=level.biome_palette.get_add_biome(ver.biome.to_universal("minecraft:river"))
YMIN=-64; TOP=int(Y.max())+40
vol=np.full((SIZE,TOP-YMIN,SIZE),AIR,dtype=np.uint32)
yy=np.arange(YMIN,TOP)[None,:,None]; Ye=Y[:,None,:]
vol[np.broadcast_to(yy<=Ye,vol.shape)]=ID["stone"]
vol[np.broadcast_to((yy<=Ye)&(yy>Ye-4),vol.shape)]=ID["dirt"]
surf=np.full((SIZE,SIZE),ID["grass_block"],dtype=np.uint32)
r=rng.random((SIZE,SIZE))
steep=np.maximum(np.abs(np.gradient(Yf,axis=0)),np.abs(np.gradient(Yf,axis=1)))>1.6
surf[steep]=np.where(r[steep]<0.5,ID["stone"],ID["andesite"])
under=(~land)|isriver
surf[under]=np.where(r[under]<0.6,ID["sand"],np.where(r[under]<0.85,ID["gravel"],ID["clay"]))
surf[bank]=np.where(r[bank]<0.5,ID["sand"],np.where(r[bank]<0.8,ID["coarse_dirt"],ID["grass_block"]))
surf[isroad]=np.select([r[isroad]<0.45,r[isroad]<0.7,r[isroad]<0.88],[ID["grass_path"],ID["gravel"],ID["cobblestone"]],ID["mossy_cobblestone"])
surf[istrail]=np.where(r[istrail]<0.7,ID["grass_path"],np.where(r[istrail]<0.9,ID["coarse_dirt"],ID["gravel"]))
ix,iz=np.indices((SIZE,SIZE))
vol[ix,Y-YMIN,iz]=surf
# water: sea to SEA, rivers one block below their banks
wl=np.where(isriver,Y+2,SEA)
wm=(under)[:,None,:]&(yy>Ye)&(yy<=wl[:,None,:])
vol[np.broadcast_to(wm,vol.shape)]=ID["water"]
vol[:,0,:]=ID["bedrock"]
# plants
open_=land&~isriver&~isroad&~istrail&~bank&~steep
pl=open_&(r>0.72)&(surf==ID["grass_block"])
kind=rng.random((SIZE,SIZE)); pid=np.where(kind<0.93,ID["grass"],np.where(kind<0.97,ID["dandelion"],ID["poppy"]))
vol[ix[pl],Y[pl]+1-YMIN,iz[pl]]=pid[pl]
# trees: custom shapes, denser in forest
def tree(x,z,big,birch):
    y=Y[x,z]+1-YMIN; h=int(rng.integers(5,8))+(int(rng.integers(3,7)) if big else 0)
    log=ID["birch_log"] if birch else ID["oak_log"]; lf=ID["birch_leaves"] if birch else ID["oak_leaves"]
    rad=2+(1 if big else 0)+(rng.random()<0.4)
    cy=y+h-1
    for dx in range(-rad-1,rad+2):
        for dz in range(-rad-1,rad+2):
            for dy in range(-rad,rad+2):
                d=math.sqrt(dx*dx+dz*dz+(dy*1.25)**2)+rng.random()*0.9
                if d<=rad+0.3:
                    a,b,c=x+dx,cy+dy,z+dz
                    if 0<=a<SIZE and 0<=c<SIZE and vol[a,b,c]==AIR: vol[a,b,c]=lf
    vol[x,y:y+h,z]=log
    if big:  # a couple of branches
        for _ in range(int(rng.integers(2,4))):
            ang=rng.random()*6.28; bx,bz=x,z
            for s in range(1,rad+1):
                bx=x+int(round(math.cos(ang)*s)); bz=z+int(round(math.sin(ang)*s))
                if 0<=bx<SIZE and 0<=bz<SIZE: vol[bx,y+h-3+s//2,bz]=log
    vol[x,y-1,z]=ID["dirt"]
cand=np.argwhere(open_[4:-4,4:-4])+4; rng.shuffle(cand); taken=np.zeros((SIZE,SIZE),bool); nt=0
for x,z in cand:
    f=forest[x,z]; p=0.035 if f>0.06 else (0.0012 if f>-0.05 else 0.0003)
    if rng.random()>p or taken[x-3:x+4,z-3:z+4].any(): continue
    if near[x-2:x+3,z-2:z+3].max()>0.01: continue
    taken[x,z]=True; tree(x,z,big=rng.random()<(0.3 if f>0.06 else 0.6),birch=rng.random()<0.25); nt+=1
print('trees',nt)
# markers: Kingsrest plaza and Millbrook, plot centres in the slice
def plaza(wx,wz,rad,block,centre):
    x,z=wx-X0,wz-Z0
    if not (rad<=x<SIZE-rad and rad<=z<SIZE-rad): return
    y=int(np.median(Y[x-rad:x+rad+1,z-rad:z+rad+1]))
    for dx in range(-rad,rad+1):
        for dz in range(-rad,rad+1):
            if dx*dx+dz*dz<=rad*rad+1:
                vol[x+dx,y+1-YMIN:y+30-YMIN,z+dz]=AIR; vol[x+dx,Y[x+dx,z+dz]-YMIN:y-YMIN+1,z+dz]=ID["dirt"]; vol[x+dx,y-YMIN,z+dz]=ID[block] if rng.random()<0.8 else ID["mossy_cobblestone"]
    vol[x,y+1-YMIN,z]=ID[centre]
    return y
print('Kingsrest y',plaza(-118,-118,9,"stone_bricks","gold_block"),'Millbrook y',plaza(-60,-470,6,"cobblestone","gold_block"),'Harrowford y',plaza(-470,-300,3,"stone_bricks","gold_block"))
# ---- write chunks
cx0,cz0=X0>>4,Z0>>4; n=0
for cx in range(cx0,(X0+SIZE-1>>4)+1):
    for cz in range(cz0,(Z0+SIZE-1>>4)+1):
        ch=Chunk(cx,cz)
        lx0=cx*16-X0; lz0=cz*16-Z0
        if lx0<0 or lz0<0 or lx0+16>SIZE or lz0+16>SIZE: continue
        sub=vol[lx0:lx0+16,:,lz0:lz0+16]
        ch.blocks[:,YMIN:TOP,:]=sub
        fo=forest[lx0:lx0+16,lz0:lz0+16]>0.06; rv_=isriver[lx0:lx0+16,lz0:lz0+16]
        ch.biomes=np.where(rv_,biome_river,np.where(fo,biome_forest,biome_plains)).astype(np.uint32)
        level.put_chunk(ch,DIM); n+=1
    if (cx-cx0)%8==7: level.save(); level.unload()
level.save(); level.close(); print('chunks',n)
