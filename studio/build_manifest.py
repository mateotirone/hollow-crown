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
        raw=open(RP+p,'rb').read()
        if 'textures/blocks/' in p:
            # animated blocks are vertical flipbook strips: show the first frame
            from PIL import Image
            import io
            im=Image.open(io.BytesIO(raw))
            if im.height>im.width and im.height%im.width==0:
                buf=io.BytesIO(); im.convert('RGBA').crop((0,0,im.width,im.width)).save(buf,'PNG'); raw=buf.getvalue()
        tex[p]='data:image/png;base64,'+base64.b64encode(raw).decode()
    return p
groups=[]
def g(id,name,cat,variants,note=None):
    for v in variants:
        for k,p in v.get('mats',{}).items(): T(p)
        for it in v.get('items',[]):
            for k,p in it.get('mats',{}).items(): T(p)
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
    regall.append(cube(f"{n}, cracked block",one(f'{sub}siege_cracked_castle_stone'+('_'+k if k else ''))))
g("regional","Castle Stone by region","Regional styles",[{"label":"All regions","model":"lineup","cols":6,"gap":1.2,"items":reg,"mats":one('siege_castle_stone')},
  {"label":"Damage stages","model":"lineup","cols":5,"gap":1.2,"items":regall,"mats":one('siege_castle_stone')}]+reg,
  "The same Castle Stone painted in each region's palette. Every region gets the same 3 crack stages and the iron, diamond and netherite tiers, so the damage model works everywhere.")
# ---- Castle Stone family: the five building blocks, per region
FR=[("","Vale")]+[x for x in RG if x[0]!='undertow']
FK=[("stone","Castle Stone"),("tiles","Tiles"),("bricks","Bricks"),("cobbled","Cobbled"),("smooth","Smooth")]
def fam(kind,k): return ('' if not k else 'regional/')+('siege_castle_stone' if kind=='stone' else 'siege_castle_'+kind)+('_'+k if k else '')
allfam=[cube(f"{n} {kn}",one(fam(kd,k))) for k,n in FR for kd,kn in FK]
vs=[{"label":"All 25","model":"lineup","cols":5,"gap":1.2,"items":allfam,"mats":one('siege_castle_stone')}]
for k,n in FR:
    items=[cube(kn,one(fam(kd,k))) for kd,kn in FK]
    vs.append({"label":n,"model":"lineup","cols":5,"gap":1.2,"items":items,"mats":one(fam('stone',k))})
for kd,kn in FK[1:]:
    items=[cube(f"{n}, {cn}",one(fam(kd,k)+f'_stone_{c}')) for k,n in FR for c,cn in enumerate(['clean','light cracks','heavy cracks'])]
    vs.append({"label":kn+" damage","model":"lineup","cols":3,"gap":1.2,"items":items,"mats":one(fam(kd,''))})
g("stone_family","Castle Stone family","Regional styles",vs,"The five building blocks every settlement uses from the first hut to the top tier: Castle Stone, Tiles, Bricks, Cobbled and Smooth. Same shapes in every region, only the colours change. Each one cracks in three stages like the walls.")
# ---- settlement wall levels: a sample section of every level in every region's blocks
import sys as _sys; _sys.path.insert(0,'/mnt/project-files/siege-nights/studio/art')
import build_walls as _bw
builds={}
for _L in _bw.LEVELS: builds[f"wall_{_L['n']}"]=_bw.section(_L)
_BAN={"":"red","frostmarch":"light_blue","saltreach":"cyan","emberwaste":"orange","blackfen":"lime"}
def _tiered(k,t): return f"siege_castle_stone_{t}_0" if not k else f"regional/siege_castle_stone_{k}_{t}_0"
for k,n in FR:
    rk=k or 'vale'; vs=[]
    for _L in _bw.LEVELS:
        tier=_L.get('tier'); woodgate=_L['gate']=='wood'
        m={"*":B+fam('stone',k)+'.png',"stone":B+fam('stone',k)+'.png',"bricks":B+fam('bricks',k)+'.png',"cobbled":B+fam('cobbled',k)+'.png',
           "smooth":B+fam('smooth',k)+'.png',"tiles":B+fam('tiles',k)+'.png',"log":B+f'regional/siege_palisade_{rk}.png',"planks":B+f'regional/siege_wall_planks_{rk}.png',
           "gate":B+(f'regional/siege_wall_planks_{rk}.png' if woodgate else f'regional/siege_castle_gate_{rk}'+('_'+tier if tier else '')+'.png'),
           "port":B+f'regional/siege_portcullis_{rk}'+('_'+tier if tier else '')+'.png',"roof":B+'siege_roof_shingles.png',"banner":B+f'siege_banner_{_BAN[k]}.png',
           "rein":B+_tiered(k,_L.get('rein','iron'))+'.png'}
        used={b[3] for b in builds[f"wall_{_L['n']}"]}
        vs.append({"label":f"{_L['n']}. {_L['name']}","model":"build","build":f"wall_{_L['n']}","mats":{r:p for r,p in m.items() if r in used or r=="*"}})
    g("walls_"+rk,f"Settlement wall, {n}","Walls and gates",vs,"A sample stretch of your settlement wall with its gate, at every level from 1 to 10, in this region's blocks. Higher levels have more towers around the plot than this short stretch can show.")
gt=[]
for k,n in FR:
    rk=k or 'vale'
    for gid in ('castle_gate','portcullis'):
        for t in ['','iron','diamond','netherite']:
            gt.append({"label":f"{n} {'gate' if gid=='castle_gate' else 'portcullis'}{', '+t if t else ''}","model":"geo","geo":"geometry.siege_gate_panel","mats":one(f'regional/siege_{gid}_{rk}'+('_'+t if t else ''))})
g("gates_regional","Gates and portcullises by region","Walls and gates",[{"label":"All 40","model":"lineup","cols":8,"gap":1.2,"items":gt,"mats":one('siege_castle_gate')}]+gt,"Each region's gate uses that region's wood, and its portcullis picks up a hint of the local stone. Metal tiers are the same everywhere.")
# ---- menu skin proposal (mock-ups, not in game yet)
g("ui_mock","Menu mock-ups","Menus (proposal)",[{"label":n,"model":"flat","mats":{"*":f"../art/ui/mockup_{k}_1x.png"}} for k,n in [("mason","Mason shop"),("townhall","Town hall"),("npc","Talking to an NPC"),("oaths","Tree of Oaths"),("knight","Knight skill tree"),("sorcerer","Sorcerer skill tree")]],
  "A proposal for how our menus could look instead of the stock grey pop-up. These are pictures, not working menus yet.")
g("ui_parts","Menu pieces","Menus (proposal)",[{"label":n,"model":"flat","mats":{"*":f"textures/ui/hc/{k}.png"}} for k,n in [("panel","Panel"),("button","Button"),("button_hover","Button, selected"),("slot","Item slot"),("slot_hover","Item slot, selected"),("parchment","Parchment"),("coin","Coin")]],
  "The pieces the menu skin is built from. The coin is a stand-in until the currency is designed.")
g("coins","Coins","Economy",[{"label":"Iron coin","model":"item","mats":{"*":I+"siege_coin.png"}},{"label":"Gold coin","model":"item","mats":{"*":I+"siege_gold_coin.png"}}],"The everyday iron coin and the gold coin worth 64, both struck with the old king's crowned head.")
# ---- portraits of each settlement's prior leaders (lore thread's brief, studio/art/PORTRAIT-BRIEF.md)
import re as _re
_rows=[_re.split(r'\s*\|\s*',l.strip().strip('|')) for l in open('/mnt/project-files/siege-nights/studio/art/PORTRAIT-BRIEF.md') if l.startswith('| `')]
_pl={}
for r_ in _rows: _pl.setdefault(r_[1],[]).append(r_)
for pl,rs in _pl.items():
    g("portrait_"+pl.lower(),pl+" portraits","Portraits",[{"label":r_[2],"model":"flat","mats":{"*":"textures/entity/portrait/"+r_[0].strip(' `')}} for r_ in rs],"The three people who held this ground before you, as they hang in the settlement's Library.")
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
for n,name in [("veinstone","Veinstone"),("undertow_moss","Veilmoss"),("veil_rock","Veil Rock"),("hollowwood_lattice","Latticewood"),("hollowwood_core","Latticewood Core"),
               ("glimmerflow","Glimmerflow"),("rift_seam","Strange Seam"),("rift_edge","Rift Edge"),("rift_veil","Rift Veil"),("waystone","Waystone"),("court_seal","Court Seal")]:
    if n=="veinstone":
        g("ut_"+n,name,"The Hollow",[cube("Plain (most common)",one('siege_veinstone'))]+[cube("Vein %d"%k,one('siege_veinstone_%d'%k)) for k in (1,2,3)],"Four variants mixed at random in the ground so hillsides do not stripe.")
        continue
    g("ut_"+n,name,"The Hollow",[cube("Block",one('siege_'+n))])
g("ut_hollow_brick","Veinstone Bricks","The Hollow",[cube("Brick",one('siege_veinstone_bricks')),cube("Cracked",one('siege_cracked_veinstone_bricks'))],"New block. Dark violet stone bricks with magenta root veins; the cracked kind has glowing violet cracks.")
g("ut_pale_ash","Pale Ash","The Hollow",[cube("Block",one('siege_pale_ash'))],"New block. Soft grey-lilac dust for the wastes.")
g("ut_glow_crystal","Glint Cluster","The Hollow",[{"label":"Cluster","model":"item","mats":{"*":B+'siege_glint_cluster.png'}}],"New block. Cross-shaped in game, gives light. Shown flat here.")
g("ut_choirsteel","Choirsteel gear","The Hollow",[{"label":n.title(),"model":"item","mats":{"*":I+'siege_choirsteel_%s.png'%n}} for n in ("sword","pickaxe","axe","shovel","hoe","helmet","chestplate","leggings","boots")]+[{"label":"Worn sheet %d"%k,"model":"item","mats":{"*":'textures/models/armor/choirsteel_layer_%d.png'%k}} for k in (1,2)],"Pale violet forged metal with a pale blue gem or band. Worn sheets are shown flat.")
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

# ---- Dragons, the Choir, Throne Seal, worn crown (auto-skips anything whose files are missing)
def _ent(gid,name,cat,geofile,variants,note=None):
    if not os.path.exists(RP+geofile): return
    x=json.load(open(RP+geofile))['minecraft:geometry'][0]; gi=x['description']['identifier']
    bgeos[gi]={"tw":x['description']['texture_width'],"th":x['description']['texture_height'],"bones":x['bones']}
    vs=[{"label":l,"model":"entity","geo":gi,"mats":{"*":p}} for l,p in variants if os.path.exists(RP+p)]
    if vs: g(gid,name,cat,vs,note)
for _k,_n in [("cinderwing","Cinderwing"),("wyvern","Wyvern"),("drake","Drake"),("wyrm","Wyrm")]:
    _ent("dragon_"+_k,_n,"Dragons",f'models/entity/dragons/{_k}.geo.json',[(_n,f'textures/entity/siege/dragons/{_k}.png')],"Adult shape. Hatchlings and fledglings are the same model, smaller.")
if os.path.exists(RP+B+'dragons/siege_dragon_roost_side.png'):
    g("dragon_blocks","Dragon Roost and Nest","Dragons",[sided("Roost",'dragons/siege_dragon_roost_side','dragons/siege_dragon_roost_top','dragons/siege_dragon_roost_side'),sided("Nest",'dragons/siege_dragon_nest_side','dragons/siege_dragon_nest_top','dragons/siege_dragon_nest_side')])
    g("dragon_items","Dragon item icons","Dragons",[item(n,'dragons/siege_dragon_'+k) for n,k in [("Egg","egg"),("Saddle","saddle"),("Horn","horn")]])
# ---- 3D held weapons for players
for _k,_n in [("longsword","Longsword"),("warhammer","Warhammer"),("minute_hand","Minute Hand"),("oath_of_oswin","The Kept Oath"),("warlords_brand","The Warlord's Brand"),("rimefang_bow","Rimefang Bow")]:
    _ent("weapon_"+_k,_n,"Player weapons",f'models/entity/weapons/{_k}.geo.json',[(_n,f'textures/entity/siege/weapons/{_k}.png')],"How it looks in your hand. The inventory icon stays flat.")
_ent("u_boat","Latticewood Boat","The Hollow",'models/entity/hollowfolk/lattice_boat.geo.json',[("Boat",'textures/entity/hollowfolk/lattice_boat.png')])
_ent("u_heart","Heart of the Hollow, resting","Crown",'models/entity/resting_heart.geo.json',[("Resting",'textures/entity/siege_resting_heart.png')])
for k,n in [("choir_conductor","The Conductor"),("choir_singer","Singer"),("hollow_regent","Hollow Regent")]:
    _ent("u_"+k,n,"The Hollow Choir",f'models/entity/undertow/{k}.geo.json',[(n,f'textures/entity/siege/undertow/{k}.png')])
for _k,_n in (("blade","Pretender, blade"),("seer","Pretender, seer"),("brute","Pretender, brute")):
    _ent("u_pretender_"+_k,_n,"The Hollow",f'models/entity/bestiary/pretender_{_k}.geo.json',[(_n,f'textures/entity/siege/bestiary/pretender_{_k}.png')],"Claimants who rise in the Hollow after the story. Name and powers are different each time.")
_ent("b_omen_raven_art","Raven (omen)","New mobs",'models/entity/bestiary/omen_raven.geo.json',[("Raven",'textures/entity/siege/bestiary/omen_raven.png')],"Perches on the wall at dusk, facing the way the raid will come.")
_ent("carriage","Train Carriage","Horses and rail",'models/entity/carriage.geo.json',[("Carriage",'textures/entity/siege/carriage.png')],"Rides normal Minecraft rails. Four seats on two benches.")
if os.path.exists(RP+I+'horses/siege_train_carriage.png'): g("carriage_icon","Train Carriage icon","Horses and rail",[item("Icon",'horses/siege_train_carriage')])
_ent("throne_seal","Throne Seal","Crown and Citadel",'models/entity/throne_seal.geo.json',[("Seal",'textures/entity/siege_throne_seal.png')],"Floats in front of the throne during a Storm.")
_ent("crown_worn","The Hollow Crown (worn)","Crown and Citadel",'models/entity/hollow_crown.geo.json',[("Crown",'textures/models/armor/siege_hollow_crown.png')])

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
import glob as _g
g("skill_icons","Skill icons","Town hall",[{"label":os.path.basename(f)[:-4].replace('_',' ').title(),"model":"item","mats":{"*":'textures/ui/hc/skill/'+os.path.basename(f)}} for f in sorted(_g.glob(os.path.join(RP,'textures/ui/hc/skill/*.png')))],"One icon for every skill on the Tree of Oaths, coloured by branch. Painted, not shown in the menu yet.")
# ---- catch-all: every PNG in the pack that no group above shows gets a place, so nothing can be missing from the Studio
_seen=set(tex); _left={}
for _d,_,_fs in os.walk(RP+'textures'):
    for _f in sorted(_fs):
        _p=os.path.relpath(os.path.join(_d,_f),RP)
        if _f.endswith('.png') and _p not in _seen and 'invisible' not in _f: _left.setdefault(os.path.dirname(_p),[]).append(_p)
_NAMES={'textures/blocks':'More blocks','textures/blocks/regional':'Regional blocks: reinforced tiers and open gates','textures/items':'More item icons','textures/models/armor':'Worn relic sheets','textures/ui/hc':'Menu pieces: skill tree sockets'}
for _d,_ps in sorted(_left.items()):
    _kind='cube' if '/blocks' in _d else 'item' if '/items' in _d else 'flat'
    _vs=[{"label":nice(os.path.basename(q)[:-4].replace('siege_','').replace('hc_','')),"model":_kind,"mats":{"*":q}} for q in _ps]
    if len(_vs)>12 and _kind=='cube': _vs=[{"label":"All","model":"lineup","cols":7,"gap":1.2,"items":_vs,"mats":{"*":_ps[0]}}]+_vs
    g("rest_"+_d.replace('/','_'),_NAMES.get(_d,'More: '+_d.replace('textures/','')),"Everything else",_vs,"Shown as a flat sheet or plain cube because no 3D model is set up for it here yet." if _kind!='item' else None)
# ---- everything from the Hollow reviewed in one place (Hollow world thread's ask, 2026-11-10)
_HOLLOW={'b_reveal_boy','b_reveal_king','b_reveal_morvane','b_oswin_reflection','b_oswin_the_last','b_gloamwing','b_veinsworn','b_shardcaster','b_gatebreaker','u_boat','u_choir_conductor','u_choir_singer','u_hollow_regent'}
for _g in groups:
    if _g['id'] in _HOLLOW or _g['cat']=='The Hollow Choir': _g['cat']='The Hollow'
    if _g['cat']=='Crown': _g['cat']='Crown and Citadel'
_o=[];[_o.append(x["cat"]) for x in groups if x["cat"] not in _o]
_o.remove("Other");_o.append("Other")
groups.sort(key=lambda x:_o.index(x["cat"]))
json.dump({"builds":builds,"groups":groups,"textures":tex,"geos":geos,"masks":masks},open(OUT,'w'))
print(len(groups),'groups',len(tex),'textures',os.path.getsize(OUT)//1024,'KB')
