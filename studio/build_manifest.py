import json, base64, os
RP='/mnt/project-files/siege-nights/Siege_Nights_RP/'
V='/mnt/project-files/siege-nights/studio/vmobs/'
OUT='/tmp/claude-0/-home-user/dad346a5-3f9c-51a2-8a96-cd3b660cbcce/scratchpad/studio/manifest.json'
COLORS=["white","orange","magenta","light_blue","yellow","lime","pink","gray","light_gray","cyan","purple","blue","brown","green","red","black"]
DYE={"white":(233,236,236),"orange":(240,118,19),"magenta":(189,68,179),"light_blue":(58,175,217),"yellow":(248,197,39),"lime":(112,185,25),"pink":(237,141,172),"gray":(62,68,71),"light_gray":(142,142,134),"cyan":(21,137,145),"purple":(121,42,172),"blue":(53,57,157),"brown":(114,71,40),"green":(84,109,27),"red":(161,39,34),"black":(29,29,33)}
nice=lambda c:c.replace('_',' ').capitalize()
B='textures/blocks/'; I='textures/items/'
tex={}
masks={}
def T(p):
    if p in tex: return p
    if 'models/armor/' in p:
        # Leather-style armor: alpha 255 = cloth, 1-254 = keep own color. Browsers lose color at low alpha,
        # so send the colors fully opaque plus a separate cloth mask.
        from PIL import Image
        import io
        im=Image.open(RP+p).convert('RGBA'); px=im.load(); mask=[]
        for y in range(im.height):
            for x in range(im.width):
                r,g_,b,a=px[x,y]; mask.append('1' if a==255 else '0')
                if a>0: px[x,y]=(r,g_,b,255)
        masks[p]=''.join(mask); buf=io.BytesIO(); im.save(buf,'PNG')
        tex[p]='data:image/png;base64,'+base64.b64encode(buf.getvalue()).decode()
    else:
        tex[p]='data:image/png;base64,'+base64.b64encode(open(RP+p,'rb').read()).decode()
    return p
groups=[]
def g(id,name,cat,variants,note=None):
    for v in variants:
        for k,p in v.get('mats',{}).items(): T(p)
    groups.append({"id":id,"name":name,"cat":cat,"variants":variants,**({"note":note} if note else {})})
cube=lambda label,mats:{"label":label,"model":"cube","mats":mats}
one=lambda p:{"*":B+p+'.png'}
# ---- blocks
def sided(label,side,top,bottom): return cube(label,{"*":B+side+'.png',"up":B+top+'.png',"down":B+bottom+'.png'})
I='textures/items/'
cs=[cube("Plain",one('siege_castle_stone'))]
for tier in ['stone','iron','diamond','netherite']:
    for c,cn in enumerate(['','light cracks','heavy cracks']):
        cs.append(cube(f"{nice(tier)}{', '+cn if cn else ''}",one(f'siege_castle_stone_{tier}_{c}')))
cs.append({"label":"As battlement","model":"geo","geo":"geometry.siege_battlement","mats":one('siege_castle_stone')})
cs.append({"label":"As arrow slit","model":"geo","geo":"geometry.siege_arrow_slit","mats":one('siege_castle_stone')})
g("castle_stone","Castle Stone","Blocks",[{"label":"All tiers","model":"lineup","cols":3,"gap":1.2,"items":cs[1:13],"mats":one('siege_castle_stone')}]+cs,"The main wall block. Reinforcement tiers (iron, diamond, netherite) and crack stages are separate textures.")
RG=[("frostmarch","Frostmarch"),("saltreach","Saltreach"),("emberwaste","Emberwaste"),("blackfen","Blackfen"),("undertow","The Hollow")]
reg=[cube("Vale (default)",one('siege_castle_stone'))]+[cube(n,one(f'regional/siege_castle_stone_{k}')) for k,n in RG]
regall=[]
for k,n in [("","Vale")]+RG:
    pre='siege_castle_stone'+('_'+k if k else ''); sub='' if not k else 'regional/'
    for c,cn in enumerate(['clean','light cracks','heavy cracks']): regall.append(cube(f"{n}, {cn}",one(f'{sub}{pre}_stone_{c}')))
    regall.append(cube(f"{n}, mossy",one(f'{sub}siege_mossy_castle_stone'+('_'+k if k else ''))))
g("regional","Castle Stone by region","Regional styles",[{"label":"All regions","model":"lineup","cols":6,"gap":1.2,"items":reg,"mats":one('siege_castle_stone')},
  {"label":"Damage stages","model":"lineup","cols":4,"gap":1.2,"items":regall,"mats":one('siege_castle_stone')}]+reg,
  "The same Castle Stone painted in each region's palette. Every region gets the same 3 crack stages and the iron, diamond and netherite tiers, so the damage model works everywhere.")
g("mossy","Mossy Castle Stone","Blocks",[cube("Block",one('siege_mossy_castle_stone'))])
g("cracked","Cracked Castle Stone","Blocks",[cube("Block",one('siege_cracked_castle_stone'))])
for gid,gname in [("portcullis","Portcullis"),("castle_gate","Castle Gate")]:
    panel=lambda label,p:{"label":label,"model":"geo","geo":"geometry.siege_gate_panel","mats":one(p)}
    tiers=[panel("Closed",f'siege_{gid}')]+[panel(nice(t),f'siege_{gid}_{t}') for t in ['iron','diamond','netherite']]
    g(gid,gname,"Blocks",[{"label":"All tiers","model":"lineup","gap":1.2,"items":tiers,"mats":one(f'siege_{gid}')}]+tiers+[panel("Open",f'siege_{gid}_open')])
g("spire","Spire Roof","Blocks",[{"label":"Spire","model":"geo","geo":"geometry.siege_spire","mats":one('siege_roof_shingles')}])
g("timber","Timber Frame","Blocks",[cube("Frame",one('siege_timber_frame')),cube("Cross timber",one('siege_timber_frame_cross'))])
g("brazier","Brazier","Blocks",[{"label":"Lit","model":"geo","geo":"geometry.siege_brazier","mats":{"*":B+'siege_brazier_iron.png',"coals":B+'siege_brazier_coals.png',"fire":B+'siege_brazier_fire.png'}}])
g("keep_banner","Keep Banner","Blocks",[{"label":nice(c),"model":"geo","geo":"geometry.siege_keep_banner","swatch":DYE[c],"mats":{"*":B+'siege_banner_pole.png',"cloth":B+f'siege_banner_{c}.png'}} for c in ['red']+[c for c in COLORS if c!='red']],
  "One cloth texture per banner color. Tip: change one color and I'll copy the design to the rest.")
g("charge","Breaching Charge","Blocks",[sided("Block",'siege_charge_side','siege_charge_top','siege_charge_top')])
g("workshop","Siege Workshop","Blocks",[sided("Block",'siege_workshop_side','siege_workshop_top','siege_desk_bottom')])
g("desk","Quartermaster's Desk","Blocks",[sided("Block",'siege_desk_side','siege_desk_top','siege_desk_bottom')])
g("barracks","Barracks","Blocks",[sided("Block",'siege_barracks_side','siege_barracks_top','siege_desk_bottom')])
# ---- Hollow Crown
for n,name in [("veinstone","Veinstone"),("undertow_moss","Hollow Moss"),("veil_rock","Veil Rock"),("hollowwood_lattice","Hollowwood Lattice"),("hollowwood_core","Hollowwood Core"),
               ("glimmerflow","Glimmerflow"),("rift_seam","Strange Seam"),("rift_edge","Rift Edge"),("rift_veil","Rift Veil"),("waystone","Waystone"),("court_seal","Court Seal")]:
    g("ut_"+n,name,"The Hollow",[cube("Block",one('siege_'+n))])
g("ut_plants","Veilcap and Glimbulb","The Hollow",[{"label":"Veilcap","model":"item","mats":{"*":B+'siege_veilcap.png'}},{"label":"Glimbulb","model":"item","mats":{"*":B+'siege_glimbulb.png'}}],"Cross-shaped plants in game. Shown flat here.")
g("ut_items","Tuning Fork and Choir Shard","The Hollow",[{"label":"Tuning Fork","model":"item","mats":{"*":I+'siege_tuning_fork.png'}},{"label":"Choir Shard","model":"item","mats":{"*":I+'siege_choir_shard.png'}}])
g("plot_stone","Plot Stone","Plots",[sided("Block",'siege_plot_stone_side','siege_plot_stone_top','siege_plot_stone_bottom')])
# ---- items
item=lambda label,p:{"label":label,"model":"item","mats":{"*":I+p+'.png'}}
g("war_horn","War Horn","Items",[item("Icon","siege_war_horn")])
g("longsword","Knight's Longsword","Items",[item("Icon","siege_longsword")])
g("warhammer","Warhammer","Items",[item("Icon","siege_warhammer")])
g("writ","Writ of Alliance","Items",[item("Icon","siege_writ")])
g("guard_icons","Castle Guard armor icons","Items",[item(n,f"siege_guard_{p}") for n,p in [("Helmet","helmet"),("Chestplate","chestplate"),("Leggings","leggings"),("Boots","boots")]])
g("ram_icon","Battering Ram icon","Items",[item("Icon","siege_battering_ram")])
g("machine_icons","Trebuchet and Ballista icons","Items",[item("Trebuchet","siege_trebuchet"),item("Ballista","siege_ballista")])
g("guard_tokens","Guard icons","Items",[item("Archer","siege_archer"),item("Man-at-Arms","siege_man_at_arms")],"What a picked-up guard looks like in your inventory.")
# ---- worn armor
A='textures/models/armor/'
g("armor","Castle Guard armor (worn)","Armor",[{"label":nice(c),"model":"armor","swatch":DYE[c],"tint":DYE[c],"mats":{"layer1":A+'guard_layer_1.png',"layer2":A+'guard_layer_2.png'}} for c in ['red']+[c for c in COLORS if c!='red']],
  "Grey cloth pixels take your banner color in game. Pick a color to preview it. Everything that isn't cloth keeps its own color.")
VA='textures/models/siege_armor/'
for m,name,note in [("chainmail","Chainmail armor: mail and gambeson","Replaces vanilla chainmail armor. 3D extra: a mail mantle over the shoulders."),("iron","Iron armor: chainmail and surcoat","Replaces vanilla iron armor. 3D extras: kettle hat brim, surcoat flaps front and back."),
                    ("diamond","Diamond armor: knight's plate","Replaces vanilla diamond armor. 3D extras: closed great helm with a red plume, shoulder plates, knee guards."),
                    ("netherite","Netherite armor: dark royal plate","Replaces vanilla netherite armor. 3D extras: gold crown, big shoulder plates, royal cape, knee guards.")]:
    g("v_"+m,name,"Armor",[{"label":"Full set","model":"armor3d","geos":[f"geometry.siege_{m}_{p}" for p in ["leggings","boots","chestplate","helmet"]],"mats":{"*":VA+m+'.png'}}],note)
SK='textures/entity/siege/man_at_arms_red.png'
GA='textures/models/siege_guard_armor/'
stages=[{"label":"Gambeson","model":"armor3d","skin":SK,"mats":{"*":SK}}]+[{"label":lab,"model":"armor3d","skin":SK,"geos":[f"geometry.siege_guardgear_{t}_{p}" for p in ["leggings","boots","chestplate","helmet"]],"mats":{"*":GA+f'tier{t}.png'}}
   for t,lab in [(1,"1 Mail and Nasal Helm"),(2,"2 Brigandine and Sallet"),(3,"3 Half Plate and Bascinet"),(4,"4 Royal Guard Plate")]]
g("guard_upgrades","Guard armor upgrades","Armor",
  [{"label":"All five","model":"lineup","items":stages,"mats":{"*":SK}}]+stages,
  "Guards' own armor line, which players can't get. The banner-color tabard always shows. Click your guard holding the next upgrade: 6 iron ingots, then 12 iron ingots, then 4 diamonds, then 1 netherite ingot.")
# ---- entities
E='textures/entity/'
g("trebuchet","Trebuchet","Siege machines",[{"label":"Trebuchet","model":"entity","geo":"geometry.siege_trebuchet","mats":{"*":E+'siege_trebuchet.png'}}],"About 6 blocks tall. In game the arm swings over and the sling lets the boulder go.")
g("ballista","Ballista","Siege machines",[{"label":"Ballista","model":"entity","geo":"geometry.siege_ballista","mats":{"*":E+'siege_ballista.png'}}],"Turns to face its target, then the arms snap forward and the bolt flies.")
g("ram","Battering Ram","Siege machines",[{"label":"Ram","model":"entity","geo":"geometry.siege_battering_ram","mats":{"*":E+'siege_battering_ram.png'}}],"Shown at model size. In game it's scaled up 1.35x.")
g("quartermaster","Quartermaster","Mobs",[{"label":"Quartermaster","model":"entity","geo":"geometry.villager.v1.8","mats":{"*":E+'siege_quartermaster.png'}}])
g("barding","Castle Guard Barding","Mobs",[{"label":"On a horse","model":"horse","geo":"geometry.horse.v2","mats":{"*":E+'horse2/armor/horse_armor_iron.png'}}],"Replaces iron horse armor.")
for gid,name in [("archer","Archer"),("man_at_arms","Man-at-Arms")]:
    g(gid,name,"Mobs",[{"label":nice(c),"model":"entity","geo":"geometry.humanoid.custom","swatch":DYE[c],"mats":{"*":E+f'siege/{gid}_{c}.png'}} for c in ['red']+[c for c in COLORS if c!='red']],
      "One skin per banner color. Tip: change one color and I'll copy the design to the rest.")
g("pack_icon","Pack icon","Other",[{"label":"Icon","model":"flat","mats":{"*":'pack_icon.png'}}],"Shown in Minecraft's pack list.")

# ---- Hollow Crown: citadel, town hall, library, travel, new item icons
blk=lambda label,p:cube(label,one(p))
g("hc_cornerstone","Cornerstone","Crown and Citadel",[sided("Cornerstone",'siege_cornerstone_side','siege_cornerstone_top','siege_cornerstone_top'),sided("Hall Cornerstone",'siege_hall_cornerstone_side','siege_hall_cornerstone_top','siege_hall_cornerstone_top')],"The block a settlement and its town hall grow from.")
g("hc_throne","Throne, Fallen Shard and Choir Ore","Crown and Citadel",[blk("Throne",'siege_throne'),blk("Fallen Shard",'siege_fallen_shard'),blk("Choir Ore",'siege_choir_ore')])
ot=[sided(n,b,c,'siege_oath_tree_plinth') for n,b,c in [("Unsworn",'siege_oath_tree_bark','siege_oath_tree_crown'),("Knight",'siege_oath_tree_bark','siege_oath_tree_crown_knight'),("Marked",'siege_oath_tree_bark_marked','siege_oath_tree_crown_marked')]]
g("hc_oath_tree","Tree of Oaths","Town hall",[{"label":"All three","model":"lineup","gap":1.2,"items":ot,"mats":one('siege_oath_tree_bark')}]+ot+[blk("Plinth",'siege_oath_tree_plinth')],"The skill tree block. Its crown changes with the path you swear to.")
sh=[sided(f"{n} of 6 filled",f'siege_shelf_front_{n}','siege_shelf_top','siege_shelf_top') for n in range(7)]
for v in sh: v["mats"]["east"]=v["mats"]["west"]=v["mats"]["south"]=B+'siege_shelf_side.png'
g("hc_shelf","Archive Shelf","Lore and library",[{"label":"Filling up","model":"lineup","cols":4,"gap":1.2,"items":sh,"mats":one('siege_shelf_side')}]+sh+[blk("Tome Cache",'hc_tome_cache')],"The shelf fills as you return Lore Tomes to the Library.")
tv=[sided(n,f'travel/siege_{k}_side',f'travel/siege_{k}_top',f'travel/siege_{k}_top') for k,n in [("stables","Stables"),("breeder_post","Breeder's Post"),("rail_depot","Rail Depot"),("station_post","Station Post")]]
g("hc_travel","Stables and rail blocks","Horses and rail",[{"label":"All four","model":"lineup","gap":1.2,"items":tv,"mats":one('travel/siege_stables_side')}]+tv)
g("hc_horse_items","Horse gear icons","Horses and rail",[item(n,'horses/siege_'+k) for n,k in [("Iron Horseshoes","horseshoes_iron"),("Diamond Horseshoes","horseshoes_diamond"),("Netherite Horseshoes","horseshoes_netherite"),("Cavalry Saddle","saddle_cavalry"),("Royal Saddle","saddle_royal"),("Padded Saddlecloth","saddlecloth_padded"),("Caparison","caparison"),("Halter","halter"),("Riding Crop","riding_crop"),("Horse Whistle","horse_whistle")]])
g("hc_crown_items","Crown and relic icons","Crown and Citadel",[item(n,'siege_'+k) for n,k in [("Hollow Crown","hollow_crown"),("Crown Shard","crown_shard"),("Royal Scepter","royal_scepter"),("Gauntlet of Challenge","gauntlet_of_challenge"),("Oath Banner","oath_banner"),("Warden's Bell","wardens_bell"),("Hall Cornerstone","hall_cornerstone"),("Ledger","ledger"),("Raw Choir Ore","raw_choir_ore"),("Choirsteel Ingot","choirsteel_ingot"),("Hollow Ember","hollow_ember"),("Bound Ember","bound_ember")]])
g("hc_lore_items","Lore and puzzle icons","Lore and library",[item(n,'siege_'+k) for n,k in [("Lore Tome","lore_tome"),("Cipher Wheel","cipher_wheel"),("Mirror Glass","mirror_glass")]])
bi=sorted(f[:-4] for f in os.listdir(RP+I+'bestiary') if f.endswith('.png'))
g("hc_bestiary_items","Mob drops and boss relics","Mob drops",[item(nice(k).replace('Widows','Widow\'s').replace('Warlords','Warlord\'s'),'bestiary/'+k) for k in bi],"Icons for what the new mobs and bosses drop. The mob skins themselves are being repainted and will get their own group.")

# ---- Bestiary (skins painted by the mobs thread, studio/bestiary/skin.py)
import sys; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))+'/bestiary')
import roster as _roster
BG=RP+'models/entity/bestiary/'
bgeos={}
for mb in _roster.MOBS:
    tp='textures/entity/siege/bestiary/'+mb['id']+'.png'
    if not (os.path.exists(RP+tp) and os.path.exists(BG+mb['id']+'.geo.json')): continue
    x=json.load(open(BG+mb['id']+'.geo.json'))['minecraft:geometry'][0]; gi=x['description']['identifier']
    bgeos[gi]={"tw":x['description']['texture_width'],"th":x['description']['texture_height'],"bones":x['bones']}
    cat="Bosses" if mb.get('boss') else "Regional mobs" if mb.get('region') else "New mobs"
    lore=mb.get('lore') if isinstance(mb.get('lore'),str) else None
    note=' '.join(t for t in [mb.get('region') and (('Boss of ' if mb.get('boss') else 'Found in ')+mb['region']+'.'), lore] if t) or None
    nm=mb['name']+(' (echo)' if mb['id']=='mother_echo' else '')
    g("b_"+mb['id'],nm,cat,[{"label":mb['name'],"model":"entity","geo":gi,"mats":{"*":tp}}],note)

# ---- geometry
geos={}
for f in os.listdir(RP+'models/blocks'):
    d=json.load(open(RP+'models/blocks/'+f))
    for x in d['minecraft:geometry']: geos[x['description']['identifier']]={"tw":x['description']['texture_width'],"th":x['description']['texture_height'],"bones":x['bones']}
d=json.load(open(RP+'models/entity/battering_ram.geo.json'))['minecraft:geometry'][0]
geos['geometry.siege_battering_ram']={"tw":64,"th":32,"bones":d['bones']}
for f in ['trebuchet','ballista']:
    d=json.load(open(RP+f'models/entity/{f}.geo.json'))['minecraft:geometry'][0]
    geos['geometry.siege_'+f]={"tw":64,"th":64,"bones":d['bones']}
for f in sorted(os.listdir(RP+'models/entity/armor'))+['../guard_armor/'+g for g in sorted(os.listdir(RP+'models/entity/guard_armor'))]:
    x=json.load(open(RP+'models/entity/armor/'+f))['minecraft:geometry'][0]
    geos[x['description']['identifier']]={"tw":128,"th":64,"bones":x['bones']}
v=json.load(open(V+'geo_villager.json'))['geometry.villager.v1.8']
geos['geometry.villager.v1.8']={"legacy":True,"tw":v.get('texturewidth',64),"th":v.get('textureheight',64),"bones":v['bones']}
h=json.load(open(V+'geo_horse_v2.json'))['geometry.horse.v2']
hide={'Bag1','Bag2','Saddle','SaddleMouthL','SaddleMouthR','SaddleMouthLine','SaddleMouthLineR','MuleEarL','MuleEarR','HeadSaddle'}
geos['geometry.horse.v2']={"legacy":True,"tw":64,"th":64,"bones":[b for b in h['bones'] if b['name'] not in hide]}
def bone(name,pivot,cubes,parent=None): return {"name":name,"pivot":pivot,"cubes":cubes,**({"parent":parent} if parent else {})}
def c(o,s,uv,inf=0,mir=False): return {"origin":o,"size":s,"uv":uv,"inflate":inf,"mirror":mir}
hum=[bone("body",[0,24,0],[c([-4,12,-2],[8,12,4],[16,16]),c([-4,12,-2],[8,12,4],[16,32],0.25)]),
     bone("head",[0,24,0],[c([-4,24,-4],[8,8,8],[0,0]),c([-4,24,-4],[8,8,8],[32,0],0.5)]),
     bone("rightArm",[-5,22,0],[c([-8,12,-2],[4,12,4],[40,16]),c([-8,12,-2],[4,12,4],[40,32],0.25)]),
     bone("leftArm",[5,22,0],[c([4,12,-2],[4,12,4],[32,48]),c([4,12,-2],[4,12,4],[48,48],0.25)]),
     bone("rightLeg",[-1.9,12,0],[c([-3.9,0,-2],[4,12,4],[0,16]),c([-3.9,0,-2],[4,12,4],[0,32],0.25)]),
     bone("leftLeg",[1.9,12,0],[c([-0.1,0,-2],[4,12,4],[16,48]),c([-0.1,0,-2],[4,12,4],[0,48],0.25)])]
for b in hum[2:]: b['rotation']=[0,0,0]
geos['geometry.humanoid.custom']={"tw":64,"th":64,"bones":hum}
# armor: layer1 (helmet, chest, arms, boots) and layer2 (leggings), 64x32 Java layout
geos['geometry.armor1']={"tw":64,"th":32,"bones":[bone("head",[0,24,0],[c([-4,24,-4],[8,8,8],[0,0],1)]),bone("body",[0,24,0],[c([-4,12,-2],[8,12,4],[16,16],1)]),
  bone("rightArm",[-5,22,0],[c([-8,12,-2],[4,12,4],[40,16],1)]),bone("leftArm",[5,22,0],[c([4,12,-2],[4,12,4],[40,16],1,True)]),
  bone("rightBoot",[-1.9,12,0],[c([-3.9,0,-2],[4,12,4],[0,16],1)]),bone("leftBoot",[1.9,12,0],[c([-0.1,0,-2],[4,12,4],[0,16],1,True)])]}
geos['geometry.armor2']={"tw":64,"th":32,"bones":[bone("body",[0,24,0],[c([-4,12,-2],[8,12,4],[16,16],0.5)]),
  bone("rightLeg",[-1.9,12,0],[c([-3.9,0,-2],[4,12,4],[0,16],0.5)]),bone("leftLeg",[1.9,12,0],[c([-0.1,0,-2],[4,12,4],[0,16],0.5,True)])]}
geos.update(bgeos)
_o=[];[_o.append(x["cat"]) for x in groups if x["cat"] not in _o]
_o.remove("Other");_o.append("Other")
groups.sort(key=lambda x:_o.index(x["cat"]))
json.dump({"groups":groups,"textures":tex,"geos":geos,"masks":masks},open(OUT,'w'))
print(len(groups),'groups',len(tex),'textures',os.path.getsize(OUT)//1024,'KB')
