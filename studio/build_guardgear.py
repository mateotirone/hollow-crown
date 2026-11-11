# Guard-only armor line (players never get it): 4 tiers of soldier armor with the banner tabard always showing.
# Writes geometry, 128x64 textures, attachables, items (BP) and lang names.
import json, random
from PIL import Image
ROOT='/mnt/project-files/siege-nights/'; RP=ROOT+'Siege_Nights_RP/'; BP=ROOT+'Siege_Nights_BP/'
rnd=random.Random(21)
def faces(u,v,w,h,d):
    return {"up":(u+d,v,w,d),"down":(u+d+w,v,w,d),"east":(u,v+d,d,h),"north":(u+d,v+d,w,h),"west":(u+d+w,v+d,d,h),"south":(u+2*d+w,v+d,w,h)}
def cl(c): return tuple(max(0,min(255,int(x))) for x in c)
def sh(c,k): return cl([x*k for x in c])
def nz(c,a=6):
    n=rnd.randint(-a,a); return cl([x+n for x in c])
def border(x,y,w,h): return x==0 or y==0 or x==w-1 or y==h-1
def cube(o,s,uv,inf=0,mir=False):
    c={"origin":o,"size":s,"uv":uv}
    if inf: c["inflate"]=inf
    if mir: c["mirror"]=True
    return c
PIV={"head":[0,24,0],"body":[0,24,0],"rightArm":[-5,22,0],"leftArm":[5,22,0],"rightLeg":[-1.9,12,0],"leftLeg":[1.9,12,0]}
BASE={
 "helmet":{"head":[cube([-4,24,-4],[8,8,8],[0,0],1)]},
 "chestplate":{"body":[cube([-4,12,-2],[8,12,4],[16,16],1.01)],
               "rightArm":[cube([-8,12,-2],[4,12,4],[40,16],1)],"leftArm":[cube([4,12,-2],[4,12,4],[40,16],1,True)]},
 "leggings":{"body":[cube([-4,12,-2],[8,12,4],[16,48],0.5)],
             "rightLeg":[cube([-3.9,0,-2],[4,12,4],[0,48],0.5)],"leftLeg":[cube([-0.1,0,-2],[4,12,4],[0,48],0.5,True)]},
 "boots":{"rightLeg":[cube([-3.9,0,-2],[4,12,4],[0,16],1)],"leftLeg":[cube([-0.1,0,-2],[4,12,4],[0,16],1,True)]},
}
REGIONS=[("head",(0,0),(8,8,8),0),("boot",(0,16),(4,12,4),0),("chest",(16,16),(8,12,4),0),("arm",(40,16),(4,12,4),0),("leg",(0,16),(4,12,4),32),("belt",(16,16),(8,12,4),32)]

STEEL=(168,172,180); MAIL=[(150,153,160),(98,101,110)]; LEATHER=(112,74,44); BRASS=(206,166,74); GOLD=(222,180,70); WHITE=(232,230,222); DARK=(22,20,24)
def mail(x,y): return nz(MAIL[(x+y)%2],5)
def plate(f,x,y,w,h,base=STEEL):
    if f in("up","down"): return nz(sh(base,1.12 if f=="up" else 0.7),4)
    k=1.0+0.1*(1-y/max(h-1,1))
    if y==0 or x==0: k=1.3
    elif x==w-1 or y==h-1: k=0.7
    return nz(sh(base,k),4)

# what each tier covers (False = see-through to the guard's skin)
def tabard(r,f,x,y,w,h): return r=="chest" and f in("north","south") and 2<=x<=5 and y>=1
def covers(t,r,f,x,y,w,h):
    if tabard(r,f,x,y,w,h): return False
    if r=="boot": return y>=h-4 or f in("up","down")
    if r=="belt": return y>=h-3 or f=="down"
    if r=="head" and f=="north":
        if t==1: return not (3<=y<=6 and 1<=x<=6 and x not in(3,4)) and not (y==6 and x in(3,4))   # nasal helm: face open beside the nose bar
        if t==2: return not (4<=y<=7 and 1<=x<=6)                                                # sallet: lower face open
    if r=="head" and t==1 and y==h-1 and f!="up": return True
    return True

def paint(t,r,f,x,y,w,h):
    side=f not in("up","down")
    if t==1:   # Mail and Nasal Helm
        if r=="head":
            if y<=3 or f=="up": return plate(f,x,y,w,h)                         # conical steel cap
            if f=="north" and x in(3,4): return plate(f,x,y,w,h)               # nose bar
            return mail(x,y)                                                    # mail coif
        if r in("chest","arm") and side and y>=h-1: return nz(LEATHER,5)
        if r=="belt": return nz(BRASS,6) if f=="north" and x in(3,4) and y==h-2 else nz(LEATHER,5)
        if r=="boot": return nz(LEATHER,5)
        return mail(x,y)
    if t==2:   # Brigandine and Sallet
        if r=="head":
            if f=="north" and y==3 and 1<=x<=6: return DARK                     # visor slit
            return plate(f,x,y,w,h,(176,180,188))
        if r in("chest","arm"):
            if r=="arm" and y>=8: return mail(x,y)                              # mail sleeves
            if side and x%3==1 and y%3==1: return nz(BRASS,8)                   # rivets through the cloth
            return nz(sh((120,44,40) if r=="chest" else LEATHER,1.0 if y else 1.2),5)   # red-brown brigandine
        if r=="belt": return nz(BRASS,6) if f=="north" and x in(3,4) and y==h-2 else nz(LEATHER,5)
        if r=="boot": return plate(f,x,y,w,h) if y>=h-2 else nz(LEATHER,5)
        return mail(x,y)
    if t==3:   # Half Plate and Bascinet
        if r=="head" and f=="north":
            if y==3 and 1<=x<=6: return DARK
        if r=="leg" and y>=6: return plate(f,x,y,w,h)
        if r=="leg": return mail(x,y)
        if r=="belt": return nz(LEATHER,5)
        return plate(f,x,y,w,h)
    if t==4:   # Royal Guard Plate: bright steel, gold trim, gold cross on the helm
        if r=="head" and f=="north":
            if y==3 and x in(1,2,5,6): return DARK                             # eye slits either side of the cross
            if x in(3,4) and y>=1: return nz(GOLD,6)
            if y==3: return nz(GOLD,6)
        if r=="chest" and f in("north","south") and x in(1,6) and y>=1: return nz(GOLD,6)   # gold-rimmed tabard opening
        if side and y==h-1 and r!="head": return nz(GOLD,6)
        if r=="belt": return nz(GOLD,6) if f=="north" and x in(3,4) else nz((70,40,30),4)
        return plate(f,x,y,w,h,(196,200,208))

EXTRAS={
 1:{"helmet":{"head":[cube([-1.5,33,-1.5],[3,2,3],[64,0]),cube([-0.5,35,-0.5],[1,1,1],[64,0])]}},        # cone point
 2:{"helmet":{"head":[cube([-5,25,4],[10,1,3],[64,0])]}},                                                   # sallet tail
 3:{"helmet":{"head":[cube([-2,25.5,-6.5],[4,3,2],[64,0]),cube([-1,26,-7.5],[2,2,1],[64,8])]},            # pointed visor snout
    "chestplate":{"rightArm":[cube([-9.5,21.5,-3],[5,3,6],[64,16])],"leftArm":[cube([4.5,21.5,-3],[5,3,6],[64,16],0,True)]}},
 4:{"helmet":{"head":[cube([-0.5,33,-2],[1,4,6],[64,0])]},                                                  # white plume
    "chestplate":{"rightArm":[cube([-10,21.5,-3.5],[6,3,7],[64,16])],"leftArm":[cube([4,21.5,-3.5],[6,3,7],[64,16],0,True)]}},
}
def paint_extra(t,uv,f,x,y,w,h):
    if t==1: return plate(f,x,y,w,h)
    if t==2: return plate(f,x,y,w,h,(176,180,188))
    if t==3:
        if uv==[64,0] and f=="north" and (x+y)%2==0: return DARK                  # breaths on the snout
        return plate(f,x,y,w,h)
    if t==4:
        if uv==[64,0]: return nz(WHITE if (x+y)%3 else sh(WHITE,0.85),4)
        if f not in("up","down") and y==h-1: return nz(GOLD,6)
        return plate(f,x,y,w,h,(196,200,208))

NAMES={1:"Mail and Nasal Helm",2:"Brigandine and Sallet",3:"Half Plate and Bascinet",4:"Royal Guard Plate"}
PROT={1:{"helmet":2,"chestplate":5,"leggings":4,"boots":1},2:{"helmet":2,"chestplate":6,"leggings":5,"boots":2},
      3:{"helmet":3,"chestplate":7,"leggings":6,"boots":2},4:{"helmet":3,"chestplate":8,"leggings":6,"boots":3}}
SLOT={"helmet":"slot.armor.head","chestplate":"slot.armor.chest","leggings":"slot.armor.legs","boots":"slot.armor.feet"}
VIS={"helmet":"variable.helmet_layer_visible = 0.0;","chestplate":"variable.chest_layer_visible = 0.0;","leggings":"variable.leg_layer_visible = 0.0;","boots":"variable.boot_layer_visible = 0.0;"}
import os
os.makedirs(RP+'textures/models/siege_guard_armor',exist_ok=True); os.makedirs(RP+'models/entity/guard_armor',exist_ok=True)
lang=[]
for t in range(1,5):
    im=Image.new('RGBA',(128,64),(0,0,0,0)); px=im.load()
    for r,uv,size,dy in REGIONS:
        w,h,d=size
        for f,(x0,y0,fw,fh) in faces(uv[0],uv[1],w,h,d).items():
            for y in range(fh):
                for x in range(fw):
                    if covers(t,r,f,x,y,fw,fh): px[x0+x,y0+dy+y]=paint(t,r,f,x,y,fw,fh)+(255,)
    for piece,bones in EXTRAS[t].items():
        for cs in bones.values():
            for c in cs:
                w,h,d=[max(1,int(round(s))) for s in c["size"]]
                for f,(x0,y0,fw,fh) in faces(c["uv"][0],c["uv"][1],w,h,d).items():
                    for y in range(fh):
                        for x in range(fw): px[x0+x,y0+y]=paint_extra(t,c["uv"],f,x,y,fw,fh)+(255,)
    im.save(RP+f'textures/models/siege_guard_armor/tier{t}.png')
    for piece in BASE:
        bones={k:list(v) for k,v in BASE[piece].items()}
        for b,cs in EXTRAS[t].get(piece,{}).items(): bones.setdefault(b,[]).extend(cs)
        ident=f'geometry.siege_guardgear_{t}_{piece}'; item=f'siege:guardgear_{t}_{piece}'
        json.dump({"format_version":"1.12.0","minecraft:geometry":[{"description":{"identifier":ident,"texture_width":128,"texture_height":64,
            "visible_bounds_width":3,"visible_bounds_height":3,"visible_bounds_offset":[0,1.5,0]},
            "bones":[{"name":n,"pivot":PIV[n],"cubes":cs} for n,cs in bones.items()]}]},open(RP+f'models/entity/guard_armor/tier{t}_{piece}.geo.json','w'),indent=1)
        json.dump({"format_version":"1.8.0","minecraft:attachable":{"description":{"identifier":item,
            "materials":{"default":"armor","enchanted":"armor_enchanted"},
            "textures":{"default":f"textures/models/siege_guard_armor/tier{t}","enchanted":"textures/misc/enchanted_actor_glint"},
            "geometry":{"default":ident},"scripts":{"parent_setup":VIS[piece]},"render_controllers":["controller.render.armor"]}}},
            open(RP+f'attachables/guardgear_{t}_{piece}.json','w'),indent=2)
        # guard-only: never sold or crafted; in the creative menu (own group, item_catalog/) for playtests
        json.dump({"format_version":"1.21.60","minecraft:item":{"description":{"identifier":item,"menu_category":{"category":"equipment"}},
            "components":{"minecraft:icon":f"siege_guard_{piece}","minecraft:display_name":{"value":f"item.{item}.name"},"minecraft:max_stack_size":1,
            "minecraft:wearable":{"slot":SLOT[piece],"protection":PROT[t][piece]},"minecraft:tags":{"tags":["minecraft:is_armor"]}}}},
            open(BP+f'items/guardgear_{t}_{piece}.json','w'),indent=2)
        lang.append(f'item.{item}.name={NAMES[t]} ({piece.capitalize()})')
for lf in [RP+'texts/en_US.lang']:
    s=open(lf).read()
    s='\n'.join(l for l in s.split('\n') if 'guardgear_' not in l).rstrip('\n')+'\n'+'\n'.join(lang)+'\n'
    open(lf,'w').write(s)
print('ok')
