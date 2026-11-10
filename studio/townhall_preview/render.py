import json, sys
from PIL import Image, ImageDraw, ImageFont
plans = json.load(open("plans.json"))
COL = {"cobblestone":(120,120,120),"spruce_planks":(115,85,50),"stone_bricks":(128,128,126),"siege:castle_stone":(140,138,130),"siege:timber_frame":(214,200,170),
"stripped_spruce_log":(110,84,52),"spruce_log":(60,42,26),"deepslate_tile_stairs":(56,56,62),"deepslate_tile_slab":(56,56,62),"deepslate_tiles":(52,52,58),"siege:battlement":(140,138,130),
"spruce_stairs":(115,85,50),"spruce_slab":(115,85,50),"red_carpet":(160,40,40),"polished_andesite":(136,138,138),"stone_brick_stairs":(128,128,126),"siege:spire_roof":(70,74,96),
"glass_pane":(170,215,235),"lantern":(255,200,90),"campfire":(240,130,40),"bookshelf":(150,110,60),"cartography_table":(90,70,50),"lectern":(170,130,70),"red_wool":(170,40,40),
"yellow_glazed_terracotta":(235,195,70),"siege:tree_of_oaths":(70,170,70),"siege:brazier":(255,150,40),"spruce_fence":(115,85,50),"scaffolding":(215,190,110),
"cobbled_deepslate":(78,78,82),"deepslate_bricks":(72,72,76),"dark_oak_planks":(66,44,22),"dark_oak_log":(52,36,20),"dark_oak_stairs":(66,44,22),"dark_oak_slab":(66,44,22),"cobbled_deepslate_wall":(78,78,82),
"blue_carpet":(50,60,160),"polished_deepslate":(70,70,74),"polished_deepslate_stairs":(70,70,74),"snow_layer":(245,248,250),"dark_oak_fence":(66,44,22),
"birch_planks":(196,180,124),"calcite":(226,226,220),"smooth_quartz":(236,232,224),"stripped_birch_log":(200,184,130),"birch_log":(215,215,205),"dark_prismarine_stairs":(52,92,78),"dark_prismarine_slab":(52,92,78),"dark_prismarine":(52,92,78),
"light_blue_stained_glass_pane":(120,180,230),"stone_brick_wall":(128,128,126),"birch_stairs":(196,180,124),"birch_slab":(196,180,124),"light_blue_carpet":(100,160,220),"quartz_bricks":(236,232,224),"quartz_stairs":(236,232,224),"birch_fence":(196,180,124),
"red_sandstone":(186,100,36),"smooth_sandstone":(222,208,160),"orange_terracotta":(162,84,38),"cut_sandstone":(216,202,150),"stripped_acacia_log":(174,92,60),"smooth_sandstone_stairs":(222,208,160),"smooth_sandstone_slab":(222,208,160),
"sandstone_wall":(216,202,150),"acacia_stairs":(168,90,50),"acacia_slab":(168,90,50),"orange_carpet":(230,120,30),"cut_red_sandstone":(186,100,36),"red_sandstone_stairs":(186,100,36),"acacia_fence":(168,90,50),
"mangrove_log":(84,56,40),"mangrove_planks":(118,54,48),"mud_bricks":(138,104,80),"stripped_mangrove_log":(120,54,48),"moss_block":(90,110,46),"mud_brick_wall":(138,104,80),"mangrove_stairs":(118,54,48),"mangrove_slab":(118,54,48),
"green_carpet":(84,110,28),"mud_brick_stairs":(138,104,80),"moss_carpet":(90,110,46),"mangrove_fence":(118,54,48),"iron_chain":(60,60,70)}
def render(key, S=7, cut=False):
    cells = plans[key]
    if cut: cells = [c for c in cells if c[0] <= 0]   # cutaway: remove the right half to see inside
    pts = {}
    def proj(x,y,z): return ((x - z) * S, (x + z) * S * 0.5 - y * S)
    xs=[];ys=[]
    for x,y,z,b in cells:
        px,py = proj(x,y,-z); xs.append(px); ys.append(py)
    ox, oy = -min(xs)+2*S, -min(ys)+2*S
    W, H = int(max(xs)+ox+2*S), int(max(ys)+oy+2*S)
    im = Image.new("RGB", (W,H), (28,32,40)); d = ImageDraw.Draw(im)
    occ = {(x,y,z) for x,y,z,b in cells}
    for x,y,z,b in sorted(cells, key=lambda c: (c[0]-c[2], c[1])) if False else sorted(cells, key=lambda c: (c[0]+(-c[2]), c[1])):
        zz = -z
        c = COL.get(b)
        if c is None: c=(255,0,255); missing.add(b)
        px,py = proj(x,y,zz); px+=ox; py+=oy
        small = b in ("glass_pane","lantern","red_carpet","blue_carpet","light_blue_carpet","orange_carpet","green_carpet","snow_layer","moss_carpet","scaffolding") or "fence" in b
        top=[(px,py-S),(px+S,py-S*0.5),(px,py),(px-S,py-S*0.5)]
        left=[(px-S,py-S*0.5),(px,py),(px,py+S),(px-S,py+S*0.5)]
        right=[(px+S,py-S*0.5),(px,py),(px,py+S),(px+S,py+S*0.5)]
        sh=lambda f: tuple(int(v*f) for v in c)
        if (x,y+1,z) not in occ: d.polygon(top, fill=sh(1.0))
        d.polygon(left, fill=sh(0.62)); d.polygon(right, fill=sh(0.8))
    return im
missing=set()
def sheet(keys, labels, path, S=7, cut=False):
    ims=[render(k,S,cut) for k in keys]
    W=sum(i.width for i in ims)+20*(len(ims)+1); H=max(i.height for i in ims)+70
    out=Image.new("RGB",(W,H),(28,32,40)); d=ImageDraw.Draw(out)
    try: f=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",22)
    except: f=ImageFont.load_default()
    x=20
    for im,l in zip(ims,labels):
        out.paste(im,(x,H-50-im.height)); d.text((x+im.width/2,H-36),l,fill=(235,225,200),font=f,anchor="mm"); x+=im.width+20
    out.save(path); print(path,out.size)
D="/mnt/project-files/siege-nights/art/townhall/"
import os; os.makedirs(D,exist_ok=True)
sheet([f"vale{i}" for i in range(1,6)],["Longhouse","Stone Hall","Keep","Fortress","Sovereign's Throne"],D+"hall-tiers-vale.png",S=6)
sheet([f"{s}3" for s in ["vale","frostmarch","saltreach","emberwaste","blackfen"]],["Vale","Frostmarch","Saltreach","Emberwaste","Blackfen"],D+"keep-in-five-styles.png",S=8)
sheet(["vale2","vale4"],["Stone Hall, cut open","Fortress, cut open"],D+"hall-interiors.png",S=9,cut=True)
print("missing",missing)
