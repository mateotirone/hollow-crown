# Builds 3D vanilla armor overrides: geometry, 128x64 textures, attachables for iron, diamond, netherite
import json, random, os
from PIL import Image
RP='/mnt/project-files/siege-nights/Siege_Nights_RP/'
VA='/tmp/claude-0/-home-user/062b6f0f-3bda-5216-b2d8-5f2576882c90/scratchpad/varmor/'
rnd=random.Random(7)

def faces(u,v,w,h,d):
    return {"up":(u+d,v,w,d),"down":(u+d+w,v,w,d),"east":(u,v+d,d,h),"north":(u+d,v+d,w,h),"west":(u+d+w,v+d,d,h),"south":(u+2*d+w,v+d,w,h)}
def clamp(c): return tuple(max(0,min(255,int(x))) for x in c)
def shade(c,k): return clamp([x*k for x in c])
def noisy(c,amt=10):
    n=rnd.randint(-amt,amt); return clamp([x+n for x in c])

# ---------- geometry ----------
def cube(o,s,uv,inf=0,mir=False):
    c={"origin":o,"size":s,"uv":uv}
    if inf: c["inflate"]=inf
    if mir: c["mirror"]=True
    return c
PIV={"head":[0,24,0],"body":[0,24,0],"rightArm":[-5,22,0],"leftArm":[5,22,0],"rightLeg":[-1.9,12,0],"leftLeg":[1.9,12,0]}
def geo(ident,bones):
    return {"format_version":"1.12.0","minecraft:geometry":[{"description":{"identifier":ident,"texture_width":128,"texture_height":64,
        "visible_bounds_width":3,"visible_bounds_height":3,"visible_bounds_offset":[0,1.5,0]},
        "bones":[{"name":n,"pivot":PIV[n],"cubes":cs} for n,cs in bones.items()]}]}

BASE={
 "helmet":{"head":[cube([-4,24,-4],[8,8,8],[0,0],1)]},
 "chestplate":{"body":[cube([-4,12,-2],[8,12,4],[16,16],1.01)],
               "rightArm":[cube([-8,12,-2],[4,12,4],[40,16],1)],"leftArm":[cube([4,12,-2],[4,12,4],[40,16],1,True)]},
 "leggings":{"body":[cube([-4,12,-2],[8,12,4],[16,48],0.5)],
             "rightLeg":[cube([-3.9,0,-2],[4,12,4],[0,48],0.5)],"leftLeg":[cube([-0.1,0,-2],[4,12,4],[0,48],0.5,True)]},
 "boots":{"rightLeg":[cube([-3.9,0,-2],[4,12,4],[0,16],1)],"leftLeg":[cube([-0.1,0,-2],[4,12,4],[0,16],1,True)]},
}
# The 3D extras for each armor, and where their pixels live on the texture (x 64 and up)
EXTRAS={
 "chainmail":{
  "chestplate":{"body":[cube([-5,21,-3.5],[10,3.5,7],[64,16])]},                      # mail mantle over the shoulders
 },
 "iron":{
  "helmet":{"head":[cube([-6.5,29.5,-6.5],[13,1,13],[64,0])]},                         # kettle hat brim
  "chestplate":{"body":[cube([-4,4,-4],[8,8,1],[64,16]),cube([-4,4,3],[8,8,1],[64,26])]},  # surcoat flaps, front and back
 },
 "diamond":{
  "helmet":{"head":[cube([-0.5,33,-3],[1,5,8],[64,0])]},                             # plume crest
  "chestplate":{"rightArm":[cube([-10,21.5,-3.5],[7,4,7],[64,16])],"leftArm":[cube([3,21.5,-3.5],[7,4,7],[64,16],0,True)]},  # pauldrons
  "leggings":{"rightLeg":[cube([-4.4,4,-3.5],[5,3,1],[64,32])],"leftLeg":[cube([-0.6,4,-3.5],[5,3,1],[64,32],0,True)]},       # knee cops
 },
 "netherite":{
  "helmet":{"head":[cube([x,33,z],[1,hh,1],[64,0]) for x,z,hh in [(-4.5,-4.5,2),(-2.5,-4.5,1),(-0.5,-4.5,3),(1.5,-4.5,1),(3.5,-4.5,2),(-4.5,3.5,2),(-0.5,3.5,2),(3.5,3.5,2),(-4.5,-0.5,2),(3.5,-0.5,2)]]},  # crown points
  "chestplate":{"rightArm":[cube([-11,21,-4],[8,5,8],[64,8]),cube([-10.5,18.5,-3.5],[7,3,7],[80,48])],
                "leftArm":[cube([3,21,-4],[8,5,8],[64,8],0,True),cube([3.5,18.5,-3.5],[7,3,7],[80,48],0,True)],              # layered pauldrons
                "body":[cube([-5,3,3.2],[10,21,1],[64,24])]},                                                                 # cape
  "leggings":{"rightLeg":[cube([-4.4,4,-3.5],[5,3,1],[64,48])],"leftLeg":[cube([-0.6,4,-3.5],[5,3,1],[64,48],0,True)]},
 },
}

# ---------- textures ----------
def paint_box(px,uv,size,fn):
    w,h,d=size
    for f,(x0,y0,fw,fh) in faces(uv[0],uv[1],w,h,d).items():
        for y in range(int(fh)):
            for x in range(int(fw)):
                c=fn(f,x,y,int(fw),int(fh))
                if c is not None: px[x0+x,y0+y]=c

def border(x,y,w,h): return x==0 or y==0 or x==w-1 or y==h-1

def material(m):
    l1=Image.open(VA+f'{m}_1.png').convert('RGBA'); l2=Image.open(VA+f'{m}_2.png').convert('RGBA')
    im=Image.new('RGBA',(128,64),(0,0,0,0)); px=im.load()
    a1=l1.load(); a2=l2.load()
    def alive(img,x,y): return img[x,y][3]>0
    # which part each base pixel belongs to
    regions=[("head",(0,0),(8,8,8),a1,0),("boot",(0,16),(4,12,4),a1,0),("chest",(16,16),(8,12,4),a1,0),("arm",(40,16),(4,12,4),a1,0),
             ("leg",(0,16),(4,12,4),a2,32),("belt",(16,16),(8,12,4),a2,32)]
    P=PAL[m]
    for name,uv,size,src,dy in regions:
        w,h,d=size
        for f,(x0,y0,fw,fh) in faces(uv[0],uv[1],w,h,d).items():
            for y in range(fh):
                for x in range(fw):
                    force = (name=="head" and f=="north" and m!="iron") or (m=="netherite" and name in("arm","leg"))  # closed helms, full gauntlets
                    if m=="chainmail":   # vanilla chain is full of holes; ours is solid mail with an open face
                        open_face = name=="head" and f=="north" and 2<=y<=6 and 1<=x<=6
                        alive_px = not open_face and (name!="boot" or y>=fh-4 or f in("up","down")) and (name!="belt" or y>=fh-3 or f=="down")
                        if not alive_px: continue
                    elif not (alive(src,x0+x,y0+y) or force): continue
                    c=P["base"](name,f,x,y,fw,fh)
                    if c: px[x0+x,y0+dy+y]=c+(255,) if len(c)==3 else c
    for piece,bones in EXTRAS[m].items():
        for bone,cs in bones.items():
            for c in cs:
                paint_box(px,c["uv"],[int(round(s)) if s>=1 else 1 for s in c["size"]],lambda f,x,y,w,h,c=c:P["extra"](c["uv"],f,x,y,w,h))
    return im

STEEL=(160,163,170); DARK=(70,72,80); GOLD=(214,172,62); RED=(160,32,36); WHITE=(226,222,208); LEATHER=(105,70,42)

def iron_base(r,f,x,y,w,h):
    mail = noisy((158,161,168),6) if (x+y)%2==0 else noisy((118,121,129),5)
    if r=="head":
        if f=="up": return noisy(STEEL,8)
        return noisy(shade(STEEL,0.8 if y==h-1 else 1.0),8)
    if r=="chest":
        if f in("north","south"):  # white surcoat with a red cross
            if border(x,y,w,h) and f=="north" and y==0: return noisy(shade(WHITE,0.8),4)
            if f=="north" and (x in(3,4) or y in(4,5)) and y<10: return noisy(RED,8)
            return noisy(WHITE,6)
        return mail
    if r=="arm": return noisy(LEATHER,6) if y>=h-2 and f not in("up","down") else mail
    if r=="boot": return noisy(STEEL,8) if y>=h-4 or f=="down" else noisy(LEATHER,6)
    if r=="belt": return noisy(LEATHER,6) if y<3 else mail
    if r=="leg": return mail
def iron_extra(uv,f,x,y,w,h):
    if uv==[64,0]: return noisy(shade(STEEL,0.75 if border(x,y,w,h) else 1.0),8)+(255,)
    # surcoat flaps: white, red stripe down the middle of the front one, ragged hem
    if f in("north","south") and uv==[64,16] and x in(3,4): return noisy(RED,8)+(255,)
    return noisy(shade(WHITE,0.85 if y==h-1 else 1.0),6)+(255,)

PLATE=(184,204,214)
def plate(f,x,y,w,h,base=PLATE):
    k=1.08 if y<2 else 0.92 if y>h-3 else 1.0
    if border(x,y,w,h) and f not in("up","down"): k*=0.72
    return noisy(shade(base,k),5)
def diamond_base(r,f,x,y,w,h):
    if r=="head" and f=="north":
        if y==3 and 1<=x<=6: return (24,26,32)                 # visor slit
        if y in(5,6) and x in(5,6) and (x+y)%2==0: return (24,26,32)  # breathing holes
        if x in(3,4) and y>=4: return noisy(shade(PLATE,1.1),3)  # nose ridge
    if r=="belt" and y<2: return noisy((70,48,32),5) if not (f=="north" and x in(3,4)) else GOLD
    c=plate(f,x,y,w,h)
    if r in("chest","arm","leg","boot") and border(x,y,w,h) and f in("north","south") and (x,y) in((0,0),(w-1,0)): return GOLD
    return c
def diamond_extra(uv,f,x,y,w,h):
    if uv==[64,0]: return noisy(shade(RED,1.15 if (x+y)%3 else 0.8),8)+(255,)   # plume feathers
    if uv==[64,16]:
        if f not in("up","down") and y==h-1: return GOLD+(255,)
        return plate(f,x,y,w,h)+(255,)
    return plate(f,x,y,w,h)+(255,) if not (f=="north" and x==2 and y==1) else GOLD+(255,)

NETH=(92,84,88); PURPLE=(96,30,110); GEM=(196,28,40); GOLD_D=(150,112,36); GOLD_L=(246,214,112)
def gold(x=0,y=0): return noisy(GOLD_L if y==0 else GOLD,8)
def bevel(f,x,y,w,h,base=NETH):
    # bright top-left edges, dark bottom-right edges, soft vertical gradient: reads as polished plate
    if f in("up","down"): return noisy(shade(base,1.15 if f=="up" else 0.7),5)
    k=1.0+0.12*(1-y/max(h-1,1))
    if y==0 or x==0: k=1.45
    elif x==w-1: k=0.62
    return noisy(shade(base,k),5)
CROWN=["G.GG.G","GGGGGG","GRGGRG","GGGGGG"]   # chest emblem, columns 1-6, rows 2-5
def netherite_base(r,f,x,y,w,h):
    side=f not in("up","down")
    if r=="head":
        if side and y<=1: return GEM if (f=="north" and x in(3,4) and y==1) else gold(x,y)   # crown circlet
        if f=="north":
            if y==3 and 1<=x<=6: return (18,12,16)                         # eye slit
            if y in(5,6) and x in(1,2,5,6) and (x+y)%2: return (18,12,16)   # breaths
            if x==3 and y>=4: return noisy(shade(NETH,1.5),4)               # nose ridge
            if x==4 and y>=4: return noisy(shade(NETH,0.7),4)
        if f in("east","west") and (x,y) in((3,4),(4,4),(3,5),(4,5)): return noisy(GOLD,8)  # ear rosette
        return bevel(f,x,y,w,h)
    if r=="chest":
        if f=="north":
            if y==4 and x in(2,5) or y==5 and 2<=x<=5: return gold(x,1)    # small gold crown on the breastplate
            if y==4 and x in(3,4): return GEM
            if y<8 and x==3: return noisy(shade(NETH,1.4),4)                # center ridge
            if y<8 and x==4: return noisy(shade(NETH,0.75),4)
        if y>=8:                                                             # fauld lames
            if y==h-1: return noisy(GOLD_D,6)
            return noisy(shade(NETH,1.4 if y%2==0 else 0.8),4)
        return bevel(f,x,y,w,h)
    if r=="arm":
        if side and y in(5,6): return gold(x,1) if (x in(1,2) and y==5 and f in("east","west")) else noisy(shade(NETH,1.35 if y==5 else 0.7),4)  # couter
        if side and y==9: return gold(x,1)                                   # gauntlet cuff
        if side and y>=10: return noisy(shade(NETH,0.85 if (x+y)%2 else 1.1),4)   # gauntlet fingers
        return bevel(f,x,y,w,h)
    if r=="leg":
        if side and y in(6,7): return noisy(shade(NETH,1.4 if y==6 else 0.7),4)
        if side and y<5 and y%2==0 and y>0: return noisy(shade(NETH,1.3),4)       # cuisse lames
        return bevel(f,x,y,w,h)
    if r=="boot":
        if side and y==h-1: return noisy(GOLD_D,6)
        if side and y>=h-4: return noisy(shade(NETH,1.35 if (y-h)%2==0 else 0.75),4)  # sabaton lames
        return bevel(f,x,y,w,h)
    if r=="belt":
        if y<2: return gold(x,y) if f=="north" and x in(3,4) else noisy(shade(PURPLE,0.8 if y else 1.0),4)   # purple sash, gold buckle
        return bevel(f,x,y,w,h)
    return bevel(f,x,y,w,h)
def netherite_extra(uv,f,x,y,w,h):
    side=f not in("up","down")
    if uv==[64,0]: return (GEM if f=="up" else gold(x,y))+(255,)          # crown points, ruby tips
    if uv==[64,24]:                                                         # royal cape
        if f=="south":
            if border(x,y,w,h) and y!=0: return gold(x,1)+(255,)
            if 2<=y<=5 and 2<=x<=7:
                c=CROWN[y-2][x-2]
                if c=="G": return gold(x,1)+(255,)
                if c=="R": return GEM+(255,)
        return noisy(shade(PURPLE,0.8 if x%3==0 else 1.15 if x%3==1 else 1.0),4)+(255,)
    if uv in([64,8],[80,48]):                                               # layered pauldrons
        if side and y==h-1: return gold(x,1)+(255,)
        if f=="up" and border(x,y,w,h): return gold(x,1)+(255,)
        return bevel(f,x,y,w,h)+(255,)
    if side and (x,y)==(2,1): return GEM+(255,)                             # knee cop
    return bevel(f,x,y,w,h)+(255,)

def chain_base(r,f,x,y,w,h):
    mail = noisy((150,153,160),6) if (x+y)%2==0 else noisy((98,101,110),5)
    if r=="head" and f!="up" and y==h-1: return noisy(shade(LEATHER,0.9),5)      # padded coif edge
    if r=="arm" and y>=h-2: return noisy((120,90,60),6)                          # gambeson sleeve cuffs
    if r=="chest" and y>=h-2: return noisy((120,90,60),6)                        # gambeson hem
    if r=="belt": return GOLD if f=="north" and x in(3,4) and y==h-2 else noisy(LEATHER,6)
    if r=="boot": return noisy(LEATHER,6) if y<h-2 else noisy(shade(LEATHER,0.7),5)
    return mail
def chain_extra(uv,f,x,y,w,h):
    if f not in("up","down") and y==h-1: return noisy((88,90,98),4)+(255,)      # ragged mail edge
    return (noisy((150,153,160),6) if (x+y)%2==0 else noisy((98,101,110),5))+(255,)
PAL={"chainmail":{"base":chain_base,"extra":chain_extra},"iron":{"base":iron_base,"extra":iron_extra},"diamond":{"base":diamond_base,"extra":diamond_extra},"netherite":{"base":netherite_base,"extra":netherite_extra}}

VIS={"helmet":"variable.helmet_layer_visible = 0.0;","chestplate":"variable.chest_layer_visible = 0.0;","leggings":"variable.leg_layer_visible = 0.0;","boots":"variable.boot_layer_visible = 0.0;"}
for m in PAL:
    material(m).save(RP+f'textures/models/siege_armor/{m}.png')
    for piece in BASE:
        bones={k:list(v) for k,v in BASE[piece].items()}
        for b,cs in EXTRAS[m].get(piece,{}).items(): bones.setdefault(b,[]).extend(cs)
        ident=f'geometry.siege_{m}_{piece}'
        json.dump(geo(ident,bones),open(RP+f'models/entity/armor/{m}_{piece}.geo.json','w'),indent=1)
        att={"format_version":"1.8.0","minecraft:attachable":{"description":{"identifier":f"minecraft:{m}_{piece}",
            "materials":{"default":"armor","enchanted":"armor_enchanted"},
            "textures":{"default":f"textures/models/siege_armor/{m}","enchanted":"textures/misc/enchanted_actor_glint"},
            "geometry":{"default":ident},"scripts":{"parent_setup":VIS[piece]},"render_controllers":["controller.render.armor"]}}}
        json.dump(att,open(RP+f'attachables/vanilla_{m}_{piece}.json','w'),indent=2)
print('ok')
