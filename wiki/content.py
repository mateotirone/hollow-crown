# The Hollow Crown wiki: every page's words. build.py turns this into wiki/hollow-crown-wiki.html.
#
# Each entry:
#   key      page address (letters, digits, hyphens)
#   mob      roster id in studio/bestiary/roster.py (gives the picture, health and attack), or None
#   name     only needed when there is no roster id, or to override the roster's name
#   line     one-line summary
#   purpose  what it is for in the game
#   origin   where it comes from in the story, as a player could know it
#   secret   the truth behind it (SPOILER: left out of a players' build)
#   where    where and when it appears
#   does     list of behaviours, as built in code
#   drops    what it leaves
#   tip      how to deal with it
#   prop     True when the origin (or part of it) is the wiki thread's proposal, not yet canon
#   hide     True when the whole page is a spoiler (left out of a players' build)
#
# Nothing here has been tested in a real game. Behaviour is described as built in the scripts.

GROUPS = [
    ("choir", "The third-night army", "The raiders that march on a settlement every third night. They take over from ordinary monsters from a settlement's third siege, and by default replace 15% more of the army each siege, up to 85%.",
     "They are the people the Choir calls. Every third night belongs to the Hollow by an old truce, and on that night a bell rings below. The angry and the empty hear it and march on the brightest keep. Every siege is a debt being collected."),
    ("grey", "The Grey Host", "An army of northern raiders in grey mail, three hundred years out of date. By default they join the sieges from a settlement's sixth siege, as about 40% of the swapped troops.",
     "The Grey Host came down from the Ice Isles about 310 years ago under Thane Vorlund, called by a bell under the ice to cut down Aldmere's bells. The Hollow swallowed the whole army at 3:17 one night as its side of the truce. Now it sends them back up."),
    ("hollowkin", "Soldiers of the Hollow", "The first real look at what is down there. Tall figures of cracked purple stone with glowing veins. By default they join the sieges from a settlement's tenth siege, as about 35% of the swapped troops.",
     "These are not men and not copies of men. They are the Hollow's own people, sent up through the Gate now that it is wide enough."),
    ("night", "Things that walk at night", "Creatures of the Hollow that turn up in the dark once the first regional boss has fallen anywhere in the world. Each player gets a roll every 45 seconds at night (12%, doubled for a Sorcerer), with at most four nearby, and never inside a settlement's walls. In the Hollow itself the roll is 50%.",
     "Everything here is the Hollow working at the Gate: shapes sent up in place of people it took, and things that leak through wherever the world has worn thin."),
    ("wild", "Creatures of the five regions", "Animals and monsters that live in one region only. They spawn naturally by biome and give each region its own dangers and its own materials.", None),
    ("order", "The Order of the Ashen Gate", "Knights who guard the land's official story. They leave ordinary travelers alone, hunt Sorcerers, and remember anyone who strikes one of them.",
     "The Order was founded by Saint Ashe, who was Princess Edda, to erase the truce and the king she overthrew. Most of its knights are honest and do not know what they are guarding."),
    ("boss", "Bosses", "One boss per region, each summoned with a key won from that region's puzzle, then the Grand Siege, then the Hollow. Bosses are tuned for one player and get 50% tougher for each extra player nearby. Fights never change blocks. Each boss drops its relic the first time, materials every time, and a confession tome.",
     "Every boss is an under-boss on the way to Morvane, and each confession reveals a little more about him. Not one of them chose to be what they became."),
    ("rival", "Rivals and rulers", "Computer-run stand-ins for other players, so the world plays the same alone as with friends. They fight like a player and are hard to kill.", None),
    ("ally", "Guards, mounts and companions", "The creatures on your side: hired guards, horses, dragons and the people of the Hollow's mining villages.", None),
]

E = []
def e(**kw): E.append(kw)

# ------------------------------------------------------------------ the third-night army
e(key="tollman", group="choir", mob="hollow_footman",
  line="The rank and file of every third-night raid.",
  purpose="The basic melee raider. Tollmen make up most of a Choir army, so they set the pace of a siege and teach players that the raids are organised.",
  origin="Pale, open-eyed soldiers in rusted kettle helms who turn up with the raids and never speak. Nobody in the villages can say where they are recruited.",
  secret="A Tollman is one of 'the empty': a person who heard the bell under the ground on a third night and walked out to answer it. The name is from the toll, both the bell's and the debt's. Morvane also calls them to his side in the last fight.",
  where="Sieges from a settlement's third siege on. They take the place of zombies, husks, vindicators, skeletons and pillagers. Three arrive with the Warlord King at 66% health, and they answer the Crown in stage 1 of the Morvane fight.",
  does=["Walks to the keep and attacks players, guards, iron golems and the Keep Heart with sword and shield.", "Gets faster and stronger near a Bell-Ringer."],
  drops="Veil Ash (0 to 2), iron nuggets (0 to 3).",
  tip="Nothing special alone. Kill the Bell-Ringer behind them first.")

e(key="bell-ringer", group="choir", mob="bell_ringer",
  line="A robed figure with a bell on a pole. The army is braver while it rings.",
  purpose="The support raider and the priority target. It makes players choose between holding the wall and going out after it.",
  origin="A hooded raider in red who carries a brass bell and stays behind the line.",
  secret="The raid is called by a bell the marchers hear under the ice. A Bell-Ringer carries a small one so they keep hearing it over the noise of the fight.",
  prop=True,
  where="Sieges, in place of witches. One arrives with the Warlord King's reinforcements.",
  does=["Rings every 3 seconds: every raider within 10 blocks gets Speed and Strength for 5 seconds.", "Runs from players instead of fighting."],
  drops="Veil Ash (1 to 2), gold nuggets (2 to 5), and a bell.",
  tip="Kill it first. Archers on the wall are the easy way.")

e(key="shieldwall-brute", group="choir", mob="shieldwall_brute",
  line="A huge raider behind a tower shield. Arrows bounce.",
  purpose="The answer to a settlement that relies only on archers and ballistas. It forces melee, or a flank.",
  origin="A big man in a great helm who walks straight at the gate behind a door-sized shield.",
  where="Sieges, in place of vindicators and wither skeletons.",
  does=["Takes only a quarter damage from arrows and bolts.", "Slow, hits hard (9), and is hard to knock back."],
  drops="Veil Ash (1 to 3), iron ingots (0 to 2).",
  tip="Fight it up close. Men-at-Arms handle it better than Archers.")

e(key="torchbearer", group="choir", mob="torchbearer",
  line="Sets every wooden thing it passes alight.",
  purpose="The reason to build in stone. It punishes wooden walls, gates and roofs, and gives Castle Stone its value.",
  origin="A raider in a head wrap with an oil satchel and a torch.",
  where="Sieges, in place of husks, skeletons, strays and pillagers.",
  does=["Every 2 seconds it lights flammable blocks one and two blocks ahead of it (planks, logs, wool, fences, hay, doors, timber frames).", "Its hits set you on fire for 4 seconds.", "Immune to fire."],
  drops="Coal (0 to 2), torches (1 to 3).",
  tip="Stone walls stop it entirely. Shoot it before it reaches anything wooden.")

e(key="siege-ogre", group="choir", mob="siege_ogre",
  line="Carries a whole tree trunk as a ram.",
  purpose="The wall-breaker of a Choir army, and the Warlord King's mount.",
  origin="A fur-shouldered giant twice the height of a man. The raiders seem to have brought it rather than persuaded it.",
  secret="Proposal: the ogres come from the Ice Isles, where the Grey Host used them to drag down bell towers. The Hollow kept them when it took the Host.",
  prop=True,
  where="Sieges, in place of ravagers. The Warlord King rides one.",
  does=["120 health and the heaviest hit of the Choir raiders (14).", "Can be ridden by other raiders."],
  drops="Emeralds (2 to 5), leather (2 to 4), Veil Ash (2 to 4).",
  tip="Ballistas and focus fire. Do not let it reach a gate.")

e(key="crow-mage", group="choir", mob="crow_mage",
  line="Calls a murder of Bellcrows and throws blinding bolts from the back.",
  purpose="The ranged caster. It harasses defenders on the wall, where melee raiders cannot reach.",
  origin="A thin raider in a feathered mantle who keeps well back.",
  secret="The Grey Host's war-priests, who nailed up a raven in place of every bell the Host cut down. Their own ravens left them. Bellcrows are what they were given instead, and they are not ravens. The silent ravens that gather on a wall before a raid serve nobody.",
  prop=True,
  where="Sieges, in place of evokers.",
  does=["Keeps its distance and throws bolts.", "Summons Bellcrows while a player is in range."],
  drops="Feathers (1 to 3), amethyst shards (0 to 2), Veil Ash (1 to 2).",
  tip="The crows fall apart by themselves. Go for the mage.")

e(key="bellcrow", group="choir", mob="hollow_crow",
  line="A summoned crow that comes apart into ash after half a minute.",
  purpose="A swarm nuisance that pulls archers' aim away from the real army.",
  origin="Black birds that arrive with a Crow-Mage and are gone again before the fight ends.",
  where="Only where a Crow-Mage calls them.",
  does=["Flies, pecks for 2, has 4 health.", "Falls apart 30 seconds after it appears.", "Leaves no body and no loot."],
  drops="Nothing.",
  tip="Ignore them if you can reach the mage.")

e(key="grey-warlord", group="choir", mob="hollow_warlord",
  line="A named war-chief who heard the bell louder than the rest.",
  purpose="The leader of a raid. In Siege Nights each army has a named Warlord, and this is the body he wears once the Choir's raiders appear.",
  origin="Each raid has a chief with a name. Kill him and the army loses heart.",
  where="Leading a siege, and at warlord camps.",
  does=["60 health, hits for 9, hard to knock back."],
  drops="Veil Ash (4 to 8), iron ingots (3 to 6), gold ingots (1 to 3), a white banner, sometimes a diamond.",
  tip="He is where the fight is thickest. Bring guards.")

# ------------------------------------------------------------------ the Grey Host
e(key="grey-host-shield-bearer", group="grey", mob="grey_spearman",
  line="His boots were found standing in the snow three hundred years ago.",
  purpose="The Grey Host's line infantry. Their arrival is the first sign that the raids are older than they look.",
  origin="A soldier in grey mail of a cut nobody has made for three centuries.",
  secret="A man of Vorlund's army, taken whole at 3:17 on the night of the truce and kept below ever since.",
  where="Sieges from the sixth siege on (default), in place of zombies and vindicators.",
  does=["Plain melee soldier: 30 health, hits for 6."],
  drops="Veil Ash (0 to 2), iron nuggets (1 to 4).", tip="Treat them like tougher Tollmen.")

e(key="grey-host-axeman", group="grey", mob="grey_axeman",
  line="He was halfway through a swing three hundred years ago. He would like to finish it.",
  purpose="The Host's heavy hitter.",
  origin="A Grey Host soldier with a long axe.",
  secret="Taken mid-battle with the rest of the Host. He has not been told the war ended.",
  where="Sieges from the sixth siege on (default), in place of husks and vindicators.",
  does=["34 health, hits for 8."],
  drops="Veil Ash (0 to 2), iron nuggets (1 to 4), rarely his iron axe.", tip="Shields help. He hits harder than he looks.")

e(key="grey-host-bowman", group="grey", mob="grey_bowman",
  line="Draws, looses, draws. Nobody has ever told him otherwise.",
  purpose="The Host's archer, so the Grey Host can trade shots with a wall.",
  origin="A Grey Host soldier with a horn bow.",
  secret="He was told to hold a line in a war that ended three hundred years ago.",
  where="Sieges from the sixth siege on (default), in place of skeletons, strays and pillagers.",
  does=["Shoots arrows. 22 health."],
  drops="Veil Ash (0 to 2), arrows (2 to 6), sometimes packed ice.", tip="Your own Archers out-range him from a wall.")

e(key="grey-host-bell-cutter", group="grey", mob="grey_bellcutter",
  line="Goes for anything that rings.",
  purpose="A fast raider meant to hunt bells, because bells are the one thing that hurts the Hollow.",
  origin="A light, quick Grey Host soldier with a hooked blade.",
  secret="The Host was called to Aldmere to cut down its bells. When it cut one down it nailed up a raven in its place. The Bell-cutters learned at Bellhollow what a bell can do to them.",
  where="Sieges from the sixth siege on (default), in place of husks and pillagers.",
  does=["Fast (the quickest of the Host), 24 health, hits for 5.", "Not built yet: seeking out bells and Bell-Ringers' rivals. Today it fights like any raider."],
  drops="Veil Ash (1 to 2), copper ingots (1 to 3), rarely shears.", tip="Once its behaviour is built, expect it to go for any bell in your settlement.")

e(key="vorlunds-guard", group="grey", mob="grey_serjeant", name="Vorlund's Guard",
  line="Carries the colours of a company that was swallowed whole.",
  purpose="The Host's elite and standard-bearer.",
  origin="A big serjeant in the best mail of the Host, carrying a faded banner.",
  secret="One of Thane Vorlund's own household. The others still form up on him.",
  where="Sieges from the sixth siege on (default), in place of vindicators and wither skeletons.",
  does=["52 health, hits for 9, hard to knock back."],
  drops="Veil Ash (2 to 4), iron ingots (1 to 3), emeralds (2 to 5), sometimes a white banner.", tip="The toughest of the Host short of a boss.")

# ------------------------------------------------------------------ soldiers of the Hollow
e(key="the-watcher", group="hollowkin", mob="veinsworn", name="The Watcher",
  line="One of them stands at the back of an ordinary raid and only watches.",
  purpose="Foreshadowing. For the three sieges before the Hollow's soldiers come forward, players get one unexplained glimpse of something that is not a raider.",
  origin="A tall dark figure seen about 30 blocks from the keep during a raid. It does not attack.",
  secret="A Veinsworn sent to look at your walls before its kind come up in force.",
  where="Sieges 7, 8 and 9 by default (the three before the Hollow's soldiers arrive).",
  does=["Stands frozen, about 30 blocks out, away from the fighting.", "If a player comes within 9 blocks, or the night ends, it is simply gone."],
  drops="Nothing. It cannot be caught.", tip="You are meant to wonder what it was.")

e(key="veinsworn", group="hollowkin", mob="veinsworn",
  line="Too tall, and it walks as if it learned how from a description.",
  purpose="The Hollow's own infantry: the moment a siege stops being about raiders.",
  origin="A faceless figure of cracked purple stone with glowing veins.",
  secret="One of the Hollow's people. They have no faces and no names, and never needed either.",
  where="Sieges from the tenth siege on (default), in place of zombies, husks, vindicators, pillagers and wither skeletons.",
  does=["38 health, hits for 8, slightly larger than a man.", "Immune to fire."],
  drops="Veil Ash (2 to 3), amethyst shards (1 to 2).", tip="Fire and lava do nothing. Use blades and bolts.")

e(key="shardcaster", group="hollowkin", mob="shardcaster",
  line="The air around its head is full of knives. It does not touch the ground.",
  purpose="The Hollow's ranged soldier.",
  origin="A floating figure ringed with crystal shards that stays at the back.",
  secret="One of the Hollow's people. What it throws, a Veilbolt, is the same cold fire a Sorcerer learns to borrow first.",
  where="Sieges from the tenth siege on (default), in place of skeletons, strays, pillagers, witches and evokers.",
  does=["Keeps its distance and throws Veilbolts.", "28 health. Immune to fire."],
  drops="Veil Ash (1 to 3), amethyst shards (2 to 4), rarely an echo shard.", tip="Close the distance or out-shoot it.")

e(key="gatebreaker", group="hollowkin", mob="gatebreaker",
  line="Nobody built a wall for this.",
  purpose="The Hollow's siege engine. It takes the place of battering rams and ravagers.",
  origin="A slab-shouldered mass of the same purple stone, as wide as a gate.",
  secret="A living ram. The Hollow has been taught our walls for three hundred years.",
  where="Sieges from the tenth siege on (default), in place of ravagers.",
  does=["130 health and the hardest hit of any raider (15).", "Immune to fire, takes half damage from arrows and bolts."],
  drops="Veil Ash (4 to 8), amethyst shards (3 to 6), often an echo shard and a diamond or two.", tip="Ballistas, and everyone on it at once.")

# ------------------------------------------------------------------ things that walk at night
e(key="lost-villager", group="night", mob="lost_villager",
  line="It just stands there facing you. It is never where you left it.",
  purpose="The first uneasy thing most players meet. It teaches the rule that the Hollow's creatures behave differently when watched.",
  origin="A villager nobody recognises, standing in a field at night. The villages call the disappearances the Lost Days.",
  secret="During the truce people went below on third nights, some willingly, and shapes came up in their places. A Lost Villager is one of those shapes with nobody left to pretend for.",
  where="At night anywhere outside settlement walls, after the first boss falls. The most common night visitor. Also in the Hollow.",
  does=["Harmless while you look at it.", "Look away and it moves closer.", "If it reaches you unseen, it strikes for 6."],
  drops="Veil Ash (0 to 1), an emerald (0 to 1). Rarely the tome 'written by a changeling'.",
  tip="Keep it in view and walk backwards, or simply kill it while watching.")

e(key="changeling", group="night", mob="changeling",
  line="Something wearing a villager. It gets the face nearly right.",
  purpose="Paranoia. After meeting one, players look twice at every villager.",
  origin="It looks like a villager until you turn your back.",
  secret="A child of the Mother of Changelings. The Choir takes someone and she makes a shape to fill the bed they left, 'so no one comes looking'.",
  where="At night outside settlement walls, after the first boss falls. The Mother of Changelings calls them in her fight.",
  does=["Passes for a villager.", "Shows itself when you turn your back within a few blocks, or when you hit it.", "28 health, hits for 6."],
  drops="Changeling Ichor (1), Veil Ash (0 to 2). Rarely a testimony tome.",
  tip="The Widow's Veil shows things from the Hollow for what they are.")

e(key="wrongling", group="night", mob="wrongling",
  line="It only moves when nobody is looking.",
  purpose="The hardest of the watch-me creatures, and the reason not to travel alone at night.",
  origin="A long-limbed thing that stands perfectly still in the dark.",
  secret="Proposal: a changeling that has been above too long. With no family to copy, the shape forgets what it was copying and comes out wrong.",
  prop=True,
  where="At night outside settlement walls (uncommon), and in the Hollow.",
  does=["While any player is looking at it, it is frozen and very hard to hurt.", "Unwatched it is the fastest thing in the bestiary and hits for 10."],
  drops="Veil Ash (2 to 4), an ender pearl.",
  tip="Two players can pin it: one watches, one fights. Alone, back toward light and walls.")

e(key="stone-vigil", group="night", mob="stone_vigil",
  line="It is only a statue while somebody is looking.",
  purpose="A set piece for graveyards, chapels and ruins. Map builders can place one so it stays put.",
  origin="A carved mourner. The Order set them to keep watch over its dead.",
  secret="Something else is keeping watch through them now. The statues are the Order's, and what moves them is the Hollow's.",
  where="At night outside settlement walls (uncommon), in the Hollow, and wherever the map places one.",
  does=["Stone while any player can see it. Only a pickaxe hurts it then.", "A blinded player does not count as watching.", "Arrows do nothing. Immune to fire and drowning.", "Its touch does 8 and puts you somewhere else: solid ground 10 to 20 blocks away, in the dark."],
  drops="Veil Ash (2 to 4), quartz (1 to 3), amethyst shards (1 to 2).",
  tip="Bring a pickaxe and do not blink. Beware anything that blinds you nearby.")

e(key="echo-hound", group="night", mob="echo_hound",
  line="Blind. It hunts by the hum of the Ember.",
  purpose="The price of magic. The more a Sorcerer uses their power, the more surely these find them.",
  origin="Eyeless hounds that run in pairs and ignore most people.",
  secret="A Sorcerer's power is borrowed from the Hollow, and the Hollow hears it being used. Proposal for the hounds themselves: they are the pack of Sir Gerrit, the Order's Master of Hounds, bred to hunt Corvin Hale's students by the hum of the Ember. The pack followed him under the ice and turned on him there.",
  prop=True,
  where="At night near any Sorcerer whose Resonance is 70 or more (a 50% roll every 45 seconds), always in pairs. This works even before the first boss has fallen. Also in the Hollow.",
  does=["Tracks a loud Sorcerer from far away.", "24 health, fast, bites for 5."],
  drops="Bones (1 to 2), Veil Ash (0 to 2).",
  tip="Keep your Resonance down and they never come.")

e(key="mirror-knight", group="night", mob="mirror_knight",
  line="Whatever you hit it with last, it learns.",
  purpose="A duel that punishes doing the same thing twice. It guards the Hollow.",
  origin="An armoured figure whose plate shows you your own stance.",
  secret="Proposal: one of the Hollow's people that has studied the knights who came down the Gate. It reflects how you fight. It is not a reflection of our world, which the Hollow is not.",
  prop=True,
  where="The Hollow only.",
  does=["Remembers whether your last hit was a blade or an arrow.", "A weak hit of the kind it already knows comes back at you for 3.", "45 health, hits for 7."],
  drops="Iron ingots (1 to 3), amethyst shards (1 to 2).",
  tip="Alternate: sword, bow, sword.")

e(key="tolling-shade", group="night", mob="tolling_shade",
  line="You have heard that bell before, under your own keep.",
  purpose="A floating debuffer that makes any other night creature more dangerous.",
  origin="A drifting, half-seen figure carrying a bell that should not be audible.",
  secret="Proposal: an echo of the Choir's bell itself, loose above ground. It is the same toll that calls the raids.",
  prop=True,
  where="At night outside settlement walls, and in the Hollow.",
  does=["Flies. Each ring slows you and darkens the world.", "30 health. Leaves no body."],
  drops="Veil Ash (2 to 3), gold nuggets (1 to 4). Can drop a hymn of the Sung Verses.",
  tip="Kill it before dealing with whatever it brought.")

e(key="gloamwing", group="night", mob="gloamwing",
  line="They leave new arrivals alone. Stay too long and they stop.",
  purpose="A soft timer on every visit to the Hollow, and the only source of Gloamquills.",
  origin="Wide-winged shapes riding the fog under the Hollow's roof.",
  secret="Proposal: they are the Hollow's carrion birds, drawn to anything that does not belong and has stood still long enough.",
  prop=True,
  where="The Hollow only. They never come while you are inside a mining village, and never hunt whoever rules the Hollow. They also harry you in stage 4 of the Morvane fight.",
  does=["You are left alone for the first 5 minutes of a visit.", "Then one finds you, and another every 2 minutes, up to six.", "They swoop, hit lightly (3) and wheel away.", "Leaving the Hollow resets the clock."],
  drops="A Gloamquill, Veil Ash (0 to 1).",
  tip="Hunt them for quills, shelter in a village, or leave.")

e(key="seep", group="night", mob="seep",
  line="A place where the Hollow is pushing through. Left alone, it widens.",
  purpose="The part of the game that never runs out. Seeps need no story progress and no other players.",
  origin="A wound in the air that things climb out of.",
  secret="Every thin place was torn shut at Bellhollow except the Gate. A Seep is the Hollow forcing a new one.",
  where="Near players anywhere in the overworld, day or night, once the first boss has fallen.",
  does=["Hollow creatures climb out and stand guard.", "It cannot be harmed while a guard is close.", "It widens over time, level 1 to 3, with more and tougher guards.", "A level 3 Seep splits off a new one."],
  drops="Veil Ash (4 to 8), amethyst shards (2 to 4), an echo shard.",
  tip="Kill the guards, then break it. Do it early.")

e(key="the-returned", group="night", mob=None, name="The Returned", hide=True,
  line="An ordinary villager in an ordinary village who is secretly a copy.",
  purpose="A mystery to investigate. Four families ask you to find out whether someone they love is still themselves, and the answer is not always yes.",
  origin="People who went missing and came back. Their families say they are 'only tired'.",
  secret="They are shapes sent up from the Hollow in place of someone it took. Four cases are written: Harl Dunn of Millbrook is a copy, and kinder than the real one. Bram Kell of Rimehold is himself, with a ruined arm and failing eyes. Pip Marsh of Gull's Rest is a copy and his sister knows. In Mirelight, Odo Lowe is himself and it is his wife Hesper, who asked you, who is the copy.",
  where="Vanilla villagers in the four towns, marked invisibly. The map builder places them.",
  does=["Faces the Hollow when it thinks nobody is looking. Look straight at it and it goes back to being a villager.", "Tamed wolves growl near it and will not settle.", "Ring a bell within 16 blocks and it drops the act and walks toward the Hollow, taking up to two villagers with it.", "A low hum can be heard within 6 blocks.", "Cut it down while it walks and the people it took wake up. Let it walk far enough and they are gone with it."],
  drops="Veil Ash.",
  tip="Two tells are not proof. Bram Kell shows two and is innocent.")

# ------------------------------------------------------------------ creatures of the regions
e(key="frost-stag", group="wild", mob="frost_stag",
  line="Gentle until you strike it.", region="Frostmarch",
  purpose="The Frostmarch's valuable animal. Pale Antler feeds the horse system: Stables masters pay well for it.",
  origin="Pale deer of the northern taiga, in herds of one to three.",
  secret="Proposal: ordinary deer that have grazed for generations over the Frostmarch's thin places. The cold has got into the antlers. Nothing more sinister than that.",
  prop=True,
  where="Taiga, frozen and cold biomes (the Frostmarch).",
  does=["Neutral. Fights back for 7 if hit."],
  drops="Pale Antler (1 to 2), leather (1 to 2).", tip="Worth hunting. Not worth provoking a herd.")

e(key="rimewolf", group="wild", mob="rimewolf",
  line="Their bite freezes your legs, and they know it.", region="Frostmarch",
  purpose="The Frostmarch's pack hunter. It makes crossing the snow at night a real risk.",
  origin="White wolves that hunt in packs of two to four.",
  secret="Ordinary Frostmarch wolves that answer the Pale Huntsman's horn. There is nothing of the Hollow in them.",
  prop=True,
  where="Taiga, frozen and cold biomes, in the dark. The Pale Huntsman summons them at 60% health.",
  does=["Each bite slows you for 3 seconds.", "22 health, fast."],
  drops="Rime Pelt (1), bones (0 to 2).", tip="Do not run in a straight line. Fight with your back to something.")

e(key="brine-lurker", group="wild", mob="brine_lurker",
  line="Lies still in the shallows like a rock.", region="Saltreach",
  purpose="The Saltreach's ambusher. It makes shorelines and river crossings dangerous.",
  origin="A barnacled thing in the shallows.",
  secret="Proposal: one of the things the lighthouse lamp guides ashore. The keeper thinks he is lighting his wife home. He is showing the Hollow's creatures the beach.",
  prop=True,
  where="Beaches, oceans and rivers, in the dark.",
  does=["Its hit slows you, and if you are in water it drags you under.", "Swims and breathes water. 34 health."],
  drops="Brine Scale (1 to 2), cod (0 to 2), a prismarine shard.", tip="Fight it on dry land.")

e(key="ash-scarab", group="wild", mob="ash_scarab",
  line="One is nothing. They are never one.", region="Emberwaste",
  purpose="The Emberwaste's swarm, and the common source of Ash Glass.",
  origin="Glass-shelled beetles that boil out of the sand four to seven at a time.",
  secret="Proposal: natural to the Emberwaste. Their shells are half glass because they burrow in sand that old fires fused.",
  prop=True,
  where="Desert and mesa biomes.",
  does=["Tiny (6 health), fast, bites for 2 and sets you on fire for 2 seconds.", "Immune to fire."],
  drops="Ash Glass (1).", tip="Sweeping attacks. Do not let them surround you.")

e(key="dune-wyrm", group="wild", mob="dune_wyrm",
  line="The sand ripples. Then the sand stands up.", region="Emberwaste",
  purpose="A rare roaming mini-boss, and a lesson in stillness.",
  origin="A plated worm the length of a caravan. Rare, always alone.",
  secret="Proposal: the last of the big animals the Emberwaste had before it was a waste. Dragons nest in the same region and leave them alone.",
  prop=True,
  where="Desert and mesa biomes. The rarest natural spawn.",
  does=["Feels your footsteps. Keep moving and it erupts under you, with about 1.5 seconds of warning.", "Stand still or sneak and it loses you.", "90 health, hits for 10."],
  drops="Wyrm Scale (3 to 6), Ash Glass (2 to 4), a diamond.", tip="Stop. Wait for it to surface. Then hit it.")

e(key="bog-hag", group="wild", mob="bog_hag",
  line="Throws poison and lays hexes.", region="Blackfen",
  purpose="The Blackfen's ranged threat.",
  origin="Old Mag says the hags were her sisters once. Old Mag says a lot of things.",
  secret="Something under the Witchroot swamp hid Mag from the Order's hounds and kept her. The hags are people it kept before her, less kindly.",
  prop=True,
  where="Swamp and mangrove swamp, in the dark. Always alone.",
  does=["Throws splash potions.", "Lays a hex on the nearest player.", "30 health."],
  drops="Toad Venom (1), glowstone dust, redstone, glass bottles (0 to 2 each).", tip="Rush her. She is weak up close.")

e(key="mire-toad", group="wild", mob="mire_toad",
  line="Its tongue reaches six blocks. Its skin is poison.", region="Blackfen",
  purpose="The Blackfen's nuisance and the source of Toad Venom.",
  origin="A dog-sized toad that hops through the reeds.",
  secret="Proposal: natural to the fen. The poison is from what it eats there.",
  prop=True,
  where="Swamp and mangrove swamp, any light, in groups of one to three.",
  does=["Tongue yanks you toward it from up to six blocks.", "Hitting it with your hands or a melee weapon poisons you for 3 seconds.", "16 health."],
  drops="Toad Venom (1), slime balls (0 to 2).", tip="Use a bow.")

e(key="barrow-wight", group="wild", mob="barrow_wight",
  line="A knight buried with his crown and his grudge.", region="Aldmere Vale",
  purpose="The Vale's undead and an early introduction to enemies with a trick.",
  origin="The Vale's barrows are full of them.",
  secret="King's Barrow is the royal mound of Aldmere, and one of the seven thin places. The wights are the buried household of its kings, woken by the seep.",
  prop=True,
  where="Plains and forest (the Vale), in the dark. It burns in daylight.",
  does=["Every hit it lands heals it for 3.", "34 health, hits for 6."],
  drops="Wight Dust (1 to 2), bones, an iron ingot, gold nuggets. Can drop a tome.", tip="Do not trade blows. Block, or kill it fast.")

# ------------------------------------------------------------------ the Order
e(key="ashen-squire", group="order", mob="ashen_squire",
  line="Young, loyal, and certain the Order has nothing to hide.",
  purpose="The Order's presence in the world. Squires make the Order feel like people and not just an enemy.",
  origin="A knight in training in ash-grey livery.",
  where="At the Order's waystations and chapterhouse, with knights.",
  does=["Leaves you alone unless you are a Sorcerer or have struck the Order.", "Strike any member of the Order and all of them remember you."],
  drops="Iron nuggets (2 to 5).", tip="There is no reason to fight them unless you chose magic.")

e(key="ashen-knight", group="order", mob="ashen_knight",
  line="An honest blade. Ask what the Gate guards and the conversation ends.",
  purpose="The Order's soldier, and the Knight path's mirror: this is what an Oathsworn player might have been.",
  origin="A sworn knight of the Ashen Gate.",
  secret="The Order was founded to bury the truce and the king. Most knights do not know. Sir Aldous Vane turns ally once you have read Edda's letter.",
  where="Chapterhouse, waystations, and guarding places the Order wants left alone.",
  does=["Takes half damage from arrows.", "44 health, hits for 8.", "Hostile to Sorcerers and to anyone who has attacked the Order."],
  drops="Iron ingots (1 to 3), emeralds (0 to 2). Can drop a Sealed Record.", tip="Do not start it by accident.")

e(key="inquisitor", group="order", mob="inquisitor",
  line="Near one, the Ember goes quiet.",
  purpose="The Sorcerer's natural enemy. It turns a magic user back into someone with a sword.",
  origin="A hooded officer of the Order with a crossbow, who hunts those who took the Ember.",
  secret="The silence is the bell-wardens' old discipline, the Vigil: holding the rope and not ringing. It is the one art that was never the Hollow's.",
  prop=True,
  where="Hunting Sorcerers. With the Order's patrols.",
  does=["Sorcerers nearby are silenced: no spells, no Resonance.", "Shoots a crossbow. 36 health.", "Seeks out Sorcerers and enemies of the Order."],
  drops="Arrows (2 to 6), emeralds (1 to 3), a crossbow. Can drop a Sealed Record.", tip="Break line of sight, close in, and fight it as a Knight would.")

# ------------------------------------------------------------------ bosses
e(key="clockwork-reeve", group="boss", mob="clockwork_reeve", region="Aldmere Vale",
  line="Millbrook's town clock, given legs. It is keeping one minute safe.",
  purpose="The Vale's boss and most players' first. Whichever boss falls first, anywhere, is what wakes the night creatures and the Seeps across the whole world.",
  origin="Millbrook's clocks all stopped at 3:17, and nobody alive remembers why. Something in the clock tower keeps them that way.",
  secret="He was Anselm Tock, Reeve of Millbrook. On the night the Hollow took the Grey Host, at 3:17, he stopped the clocks to hold the bell's stroke, and has replaced himself with clockwork part by part to stay awake and hold it. When he is stopped the minute ends, the bell finishes its stroke, and the well opens.",
  where="Millbrook, in the Vale. Wind the Stopped Clock Key in Millbrook's well.",
  does=["Time-stop pulses freeze you unless you stand on a lit tile.", "At 60% he splits into three Reeve's Cogs and cannot be hurt until they are scrap.", "At 30% the clock runs fast."],
  drops="First kill: the Minute Hand (a sword whose hits slow the target). Every kill: Clockwork Cogs. Tome: The Reeve's Ledger.",
  tip="Learn the tiles in the first phase. You need them at speed in the last.")

e(key="pale-huntsman", group="boss", mob="pale_huntsman", region="Frostmarch",
  line="He led the hunters onto the frozen lake one night, and only he walked back off it.",
  purpose="The Frostmarch boss. A fight about sight lines and patience.",
  origin="A skull-masked archer in white fur who hunts the lake at Rimehold.",
  secret="Sir Gerrit the Pale, Master of Hounds of the Ashen Gate, sent to hunt Corvin Hale's students. He followed the twelfth down through the ice and saw the town below, with half of Rimehold standing in its square, humming. He has been hunting his way back up ever since and no longer remembers what he was hunting.",
  where="The frozen lake at Rimehold. Blow the Pale Horn on the ice.",
  does=["Vanishes into the blizzard. Watch for his breath.", "His marked shots miss if you break line of sight.", "At 60% Rimewolves come.", "At 25% he anchors himself in three Rime Pillars. Break them all."],
  drops="First kill: the Rimefang Bow (arrows root targets in ice). Every kill: Pale Antlers and Rime Pelts. Tome: The Huntsman's Tally.",
  tip="Fight near cover. An open lake is his ground.")

e(key="drowned-bride", group="boss", mob="drowned_bride", region="Saltreach",
  line="The lighthouse keeper still writes to her. She has been answering.",
  purpose="The Saltreach boss. A race against a rising tide that asks players to split up and ring bells together.",
  origin="A veiled woman under the water off Gull's Rest.",
  secret="Annet Marrow. The sea took her on the night of the truce. Her husband Elias, the lighthouse keeper, is an echo who does not know it, and his lamp shows the Hollow's creatures the shore. She is not angry with him. She wants him to put the lamp out and come.",
  where="The sunken chapel at Gull's Rest. Use the Drowned Wedding Ring.",
  does=["The tide rises the whole fight, faster each phase.", "Ring all three Chapel Bells within 10 seconds of each other to turn it back (18 seconds if you are alone).", "Calls drowned at a phase change.", "At full tide everyone drowns."],
  drops="First kill: the Widow's Veil (breathe water, see in the dark, see things from the Hollow for what they are). Every kill: Drowned Pearls and Brine Scales. Tome: Annet's Prayer.",
  tip="Know where the three bells are before you start.")

e(key="ash-seneschal", group="boss", mob="ash_seneschal", region="Emberwaste",
  line="Sunscar chiseled a face off every statue. The Seneschal chiseled off his own.",
  purpose="The Emberwaste boss. He counters whatever you lean on, so a one-weapon build fails.",
  origin="The faceless lord of the desert fortress at Sunscar, where every statue has been defaced.",
  secret="Lord Hadrian Sorrel. The Regent ordered her father's face removed from every statue in Aldmere. He asked to do Sunscar himself, because he had served the king and wanted the last hands on his face to be gentle ones. When he finished the last statue his own face was smooth.",
  where="Sunscar, in the Emberwaste. Use the Faceless Seal.",
  does=["Every 15 seconds he studies what hurt him most, blade or arrow, shrugs that off and fights back the same way.", "At 50% the sand starts to give.", "420 health, immune to fire."],
  drops="First kill: the Seneschal's Greatshield and the Faceless Crown Shard. Every kill: Ash Glass. Tome: The Seneschal's Confession.",
  tip="Carry a sword and a bow and switch when he does.")

e(key="mother-of-changelings", group="boss", mob="mother_of_changelings", region="Blackfen",
  line="She hides among her children, and she has a true name she would kill to keep.",
  purpose="The Blackfen boss. A shell game that rewards the lore: knowing her name, Echo Sight, or the Bride's relic each show the real one.",
  origin="The thing beneath the swamp at Mirelight.",
  secret="She makes the changelings. The Choir takes someone and she fills the hole with a shape, so nobody comes down after them with torches and bells and is taken too. 'I am not cruel. I am tidy.'",
  where="Mirelight, in the Blackfen. Use the Mire Effigy.",
  does=["Hides among copies of herself.", "Hit a copy and it bursts into poison and a Changeling.", "The real one sheds a spore now and then.", "Echo Sight, her true name, or the Widow's Veil show which is real."],
  drops="First kill: the Mire Heart (in your offhand at night, your hits heal you). Every kill: Changeling Ichor and Toad Venom. Tome: The Mother's Lullaby.",
  tip="Watch for the spore before you swing.")

e(key="warlord-king", group="boss", mob="warlord_king", region="The Grand Siege",
  line="He has lost before. He keeps coming back.",
  purpose="The boss of the Grand Siege, the climax of the settlement game. Siege Nights still decides what his death means for your rank.",
  origin="The king of the raiders. The bestiary insists there is no single Warlord King.",
  secret="There is, and he is three hundred years old: Vorlund, last Thane of the Grey Host. When the Hollow took his army it kept him, and put a splinter of its crown in his brow so he would hear it. Every third night Morvane tells him where to march. He has never chosen once.",
  where="The Grand Siege against your settlement.",
  does=["Rides a Siege Ogre and takes much less damage until he is off it.", "At 66%, or when the ogre dies, he fights on foot. Tollmen and a Bell-Ringer arrive.", "At 30% the crown splinter wakes: jump the quakes."],
  drops="First kill: the Warlord's Brand (sets foes alight, every fifth hit is a shockwave). Every kill: Veil Ash and emeralds. Tome: Vorlund's Oath.",
  tip="Kill the ogre first.")

e(key="the-choir", group="boss", mob=None, name="The Choir", region="The Hollow", hide=True,
  line="The Hollow's people, singing the Gate wider.",
  purpose="The gatekeeper fight of the Hollow. The Court must be silenced before anyone can go on to the Seat.",
  origin="A Conductor and seven Singers in the round hall across the story path.",
  secret="The song is what is forcing the Gate. One Singer is bound to the real Source and cannot be hurt until the end.",
  where="The Court, in the Hollow. The Conductor appears when someone walks in.",
  does=["The Hymn: the Singers shield the Conductor. Kill six. Each verse still singing calls phantom raiders, the same armies that besiege the keeps above.", "The Toll: the Conductor can be hurt. Jump the shockwave, crouch against the pull, and hold your hits during the Echo.", "The Closing: at a quarter health the song closes in ring by ring. The last Singer feeds the Conductor until it is killed."],
  drops="The Court's gate and the river's water gate open.",
  tip="Leave the seventh Singer. It cannot be hurt until the Closing.")

e(key="morvane", group="boss", mob="oswin_the_last", region="The Hollow", hide=True,
  line="He holds the Seat at the bottom of the Hollow, and he has been waiting a long time.",
  purpose="The final boss and the end of the story. Seven stages, each somewhere else.",
  origin="Morvane is the name the Hollow gave its leader. Players may hear it early, from Vorlund, the Sung Verses and rumors.",
  secret="Morvane was King Oswin, son of Aldric, last King of Aldmere. He made the truce, his daughter Edda put him through the Crack alive, and the Hollow took in the one human who ever kept his word to it. It crowned him and renamed him. He has directed the sieges for three hundred years. He is grey-eyed and fights left-handed, because his right hand took the splinter of the Crown. Nobody says who he was before the fight. A staged scene between stages 6 and 7 shows it without a name, and afterwards Brother Cael says it plainly. The lore thread proposes that the name means 'the one who stayed', and that he is who put the journal in every player's pack.",
  where="The Seat, at the end of the Hollow, after the Choir is silenced.",
  does=["1, the Seat: sword and Crown. Every third blow is a ring you jump. He blinks behind whoever hit him last.", "2, the Standing Ranks: empty armour stands up. He is inside one suit. His carries its light on the left hand.", "3, the Night It Ended: a memory. Lords of the old court attack in three waves while he watches.", "4, the River: he is under the water and can only be hurt when he surfaces.", "5, the Rift: the overworld. He fights like a siege and cannot die up here.", "6, the Fall: about 40 seconds on crumbling ledges. Then the reveal.", "7, the Seat: the floor falls ring by ring. He cannot die while he wears the Hollow Crown. Stagger him, knock it off, keep him from it.", "If everyone falls the stage restarts twice, then the fight goes back to stage 1."],
  drops="First kill: the Kept Oath (Knight) or the Crownless Mantle (Sorcerer). Tome: The Last Testament. The Old King's Journal gains a thirteenth page.",
  tip="1,000 health for one player. Every big attack has a sound and about 1.5 seconds of warning.")

e(key="boss-helpers", group="boss", mob="reeve_cog", name="Boss helpers and props",
  line="The smaller things that appear inside boss fights.",
  purpose="Each one is a mechanic of its fight, not a creature of the world.",
  origin="Reeve's Cog: a third of the Reeve, ticking on its own. Rime Pillar: the Huntsman's cold is anchored in these. Chapel Bell: strike it to ring it. The Mother's masks: copies of her with 10 health.",
  secret="Standing Rank: empty armour in Morvane's shape. The three figures at the desk (a boy of nine, a king, and the one who looks up) are the actors of the reveal scene.",
  where="Only inside their boss fights.",
  does=["None of them drops loot or leaves a body."],
  drops="Nothing.", tip="Break the Pillars, ring the Bells, scrap the Cogs.")

# ------------------------------------------------------------------ rivals and rulers
e(key="rival-knight", group="rival", mob="champion_knight",
  line="Fights like you do: sword, bow, shield, and a potion when it goes badly.",
  purpose="A stand-in for an enemy player on the Knight path.",
  origin="A sworn sword of one of the twelve Rival Lords.",
  where="With Rival Lords' forces. Tier 1 to 5 sets health and skill.",
  does=["Sword up close, bow at range.", "Raises a shield in cycles. An axe breaks the guard for 5 seconds.", "Strafes, and hops back after landing a hit.", "Backs off to drink a potion when low. Hit it while it drinks to spoil it.", "One golden apple, and an ender pearl to close the gap.", "War-cry and shield bash.", "Cannot place or break blocks."],
  drops="Emeralds (6 to 12), iron ingots, a golden apple, arrows.", tip="Bring an axe for the shield.")

e(key="rival-sorcerer", group="rival", mob="champion_sorcerer",
  line="Keeps its distance, throws Veilbolts, and steps through the air when you close in.",
  purpose="A stand-in for an enemy player on the Sorcerer path. A tier 5 one is the fight to overthrow the computer-run ruler of the Hollow.",
  origin="A Sorcerer in a Rival Lord's service.",
  where="With Rival Lords' forces.",
  does=["Throws Veilbolts and marks the ground under your feet.", "Blinks away when you get close.", "Potions, apple and pearl like the Knight."],
  drops="Emeralds (6 to 12), Veil Ash (4 to 8), amethyst shards, a golden apple.", tip="Keep moving off the marked ground.")

e(key="rival-lord", group="rival", mob="champion_lord",
  line="A lord with a keep of their own.",
  purpose="The face of a rival settlement. Twelve are written, each with a seat, a temperament and lines of their own. The system that runs their armies is not built yet.",
  origin="One of twelve lords who hold land as you do.",
  where="At their seat, or leading an attack, once the Rival Lords system runs.",
  does=["Everything a Rival Knight does.", "Calls Retainers."],
  drops="Emeralds (12 to 24), gold ingots, golden apples, diamonds (1 to 2).", tip="Deal with the Retainers or be surrounded.")

e(key="retainer", group="rival", mob="champion_retainer",
  line="A lord's man-at-arms. Uses a shield properly.",
  purpose="The rank and file of a rival's army.",
  origin="Hired soldiers of a Rival Lord.",
  where="Called by a Rival Lord.",
  does=["Sword and shield, 36 health."],
  drops="Emeralds (0 to 2), iron nuggets, arrows.", tip="An axe, again.")

e(key="ruler-of-the-hollow", group="rival", mob=None, name="The computer-run ruler of the Hollow", hide=True,
  line="When no player rules the Hollow, someone else does.",
  purpose="Keeps the endgame running in a single-player world: someone always controls the Choir ore and has demands.",
  origin="A crowned figure standing in the Choir's Heart. In code it is called the Regent. Players read 'the Hollow Crown'.",
  secret="It rises two in-game days after the Choir falls if no player rules, and a new one returns seven days after the last is killed. A player Sorcerer cannot claim the Crown until it is overthrown.",
  where="The Heart, in the Hollow.",
  does=["Talk to it for a 3-day mining permit, for a price or a fetch job.", "One of three temperaments (greedy, fair, zealot) sets the price and the tithe.", "Thieves get a warning, then lightning. Guardians come.", "Overthrowing it is a fight against a tier 5 Rival Sorcerer."],
  drops="The seat.", tip="Pay, or come ready.")

# ------------------------------------------------------------------ allies
e(key="man-at-arms", group="ally", mob=None, name="Man-at-Arms",
  line="A hired sword for your walls.",
  purpose="Your melee guard. Guards let one player hold a settlement.",
  origin="An unemployed villager who took the job at your Barracks.",
  where="Your settlement. Bring an unemployed villager to a Barracks and click it with 5 emeralds.",
  does=["Fights raiders with an iron sword.", "Sneak and click to pick one up and place it elsewhere on your land."],
  drops="An iron sword.", tip="Put them at gates.")

e(key="archer", group="ally", mob=None, name="Archer",
  line="Stays exactly where you put it.",
  purpose="Your ranged guard, for wall tops and towers.",
  origin="A villager recruited at your Barracks (sneak and click).",
  where="Your settlement.",
  does=["Shoots raiders with a bow.", "Holds its post."],
  drops="A bow.", tip="Raiders attack the side with the fewest ballistas and archers.")

e(key="quartermaster", group="ally", mob=None, name="Quartermaster",
  line="Sells siege gear, weapons and armor.",
  purpose="Your settlement's shop. More stock unlocks as you trade.",
  origin="A villager who took the job at a Quartermaster's Desk.",
  where="Your settlement.",
  does=["Sells for emeralds today. Prices are being moved to the world's iron-backed coin."],
  drops="Nothing.", tip="Bring any unemployed villager to the desk.")

e(key="steed", group="ally", mob=None, name="Steeds",
  line="There is no elytra. You ride.",
  purpose="Travel. Horse upgrading is one of the game's main pillars: breeds, training, gear, traits, and two late forms.",
  origin="Five regional breeds, raised at your Stables or bought at a Breeder's Post.",
  secret="The Glimstrider is a steed touched by the Hollow. It can Veilstep, a short blink.",
  where="Your Stables. A Halter turns a tamed vanilla horse into a steed.",
  does=["Speed, jump and health grow with training.", "Coats, markings and caparisons.", "The Warhorse charges."],
  drops="Nothing.", tip="Frost Stags' Pale Antlers are worth a great deal to a Stables master.")

e(key="dragons", group="ally", mob=None, name="Dragons",
  line="They live in one region only. That is its people's power.",
  purpose="The Emberwaste's signature. Residents can raise, train and ride one.",
  origin="Four species nest in the Emberwaste: the Cinderwing (an all-rounder that breathes fire), the Ashen Wyvern (fast, frail, blinding ash), the Dune Drake (tough, quick on foot, short flights) and the Glass Wyrm (long flights, frail).",
  where="An egg from a wild nest, set on a Dragon Roost in your own settlement, hatches in 2 days.",
  does=["Hatchling, then Fledgling (rideable on foot), then Adult (flies).", "Flies in bursts of 45 to 60 seconds, then rests.", "Has a temperament, moods, a favourite food, and grudges. It can refuse an order.", "Shot down, it lies unconscious and breathing. A golden apple from its owner or an ally saves it. Untended, it bleeds out in 10 minutes.", "Afraid of the Hollow's creatures, and cannot enter the Hollow."],
  drops="Nothing.", tip="One dragon per player. Several of these limits are still proposals.")

e(key="hollow-folk", group="ally", mob=None, name="The people of the Hollow", hide=True,
  line="They talk, and they trade.",
  purpose="The Hollow's economy. Four mining villages dig Choir Ore and sell it.",
  origin="Miners of Glimwade, Lowseam, Tollrest and Highcut, each with a Foreman who keeps the Tally.",
  secret="They were enslaved by Morvane and are grateful to whichever Sorcerer rules after him.",
  where="Four villages beside the story path in the Hollow.",
  does=["Each dawn a village digs ore into its Tally and carts half to the Vault under the Seat.", "A Foreman sells ore, or you can rob the Tally.", "Robbing brings the ruler to defend.", "You are safe from Gloamwings inside a village."],
  drops="Nothing.", tip="Buying is slower than robbing and far safer.")

WORLD = [
    ("The land", "Aldmere is a kingdom of five regions around a ruined capital: the Vale (Millbrook), the Frostmarch (Rimehold), Saltreach (Gull's Rest), the Emberwaste (Sunscar) and the Blackfen (Mirelight). Twelve plots can be claimed and grown from a keep into a city. There is no elytra. People travel by horse, road and rail.", None),
    ("The third night", "Every third night an army marches on the brightest keep. Winning sieges grows your settlement. After your first win an Ember falls from the sky, and what you do with it sets your path: Knight or Sorcerer.",
     "The Ember is a splinter of the Hollow Crown, the pledge given to a king at the Truce of the Third Night. Every third night is the Hollow's by that truce, and each siege is the debt being collected."),
    ("The Hollow", None,
     "Another world, not a copy of ours: a drowned country of leaning towers and black water under a roof too far up to see. It once shared this land, was rung out by a bell, came back under a truce, and was shut out again when the truce was broken. It is behind one wound in the rock, the Gate, and it is forcing its way back. Its leader is called Morvane."),
]

# ====================================================================================================
# Guide pages: everything that is not a creature. Each has sections: (heading, text or list, spoiler?)
# ====================================================================================================
GROUPS[:0] = [
    ("world", "The land and its story", "Where the game takes place, who lives there, and what happened to it.", None),
    ("play", "How it plays", "The systems a player uses: paths, settlements, coin, travel and the endgame.", None),
]
GROUPS.append(("items", "Relics and materials", "The named weapons bosses leave behind, the keys that summon them, and what creatures drop.", None))

PAGES = []
def page(**kw): PAGES.append(kw)
S = True  # marks a spoiler section

page(key="aldmere", group="world", name="Aldmere and its five regions",
  line="One kingdom, five regions, twelve places to settle.",
  sections=[
    ("The kingdom", "Aldmere is the land the game is played on: a hand-built map on a Realm for up to ten players, and fully playable alone. Everyone starts as an ordinary person in Kingsrest, the crossroads town below the ruined capital, Crownhold. Each player carries an old king's journal they do not remember packing.", False),
    ("The regions", ["Aldmere Vale. Town: Millbrook, where every clock stopped at 3:17. Creatures: Barrow Wights. Boss: the Clockwork Reeve.", "The Frostmarch. Town: Rimehold, on a frozen lake. Creatures: Frost Stags, Rimewolves. Boss: the Pale Huntsman.", "Saltreach. Town: Gull's Rest, with its lighthouse. Creatures: Brine Lurkers. Boss: the Drowned Bride.", "The Emberwaste. Town: Sunscar, where every statue has lost its face. Creatures: Ash Scarabs, Dune Wyrms, and dragons. Boss: the Ash Seneschal.", "The Blackfen. Town: Mirelight. Creatures: Bog Hags, Mire Toads. Boss: the Mother of Changelings."], False),
    ("Each region has its own power", "Dragons live only in the Emberwaste, and only people settled there can raise one. Every region is meant to have a signature like this. The other four are proposed and not yet confirmed.", False),
    ("The twelve plots", "Harrowford, Oakmere, Thistledown, Wrenfield, Rimeholt, Wolfcairn, Gullcliff, Tidewatch, Reedmoor, Lanternbog, Redmesa and Dunehold. Each has its own past, three local books, a local mystery and three earlier leaders whose portraits hang in its Library, so the story opens differently from every one of them.", False),
    ("Old places", "Crownhold holds the Hall of Bells. East of Kingsrest is Bellhollow, with a broken bell frame and a sealed crack in the rock that has been guarded since the first day.", False),
    ("What the old places are", "Bellhollow is where the Hollow lost its war and the Founding Bell's last stroke shut every thin place. The sealed Crack there is a dead door. The real way down has moved to one of seven thin places, chosen in secret for each world: the Drowned Chapel, the Bellfounders' Mine, King's Barrow, the Saltglass Grotto, Frostvein Gap, the Sunken Quarry or the Witchroot Caves.", S),
  ])

page(key="the-third-night", group="world", name="The third night",
  line="Every third night, an army marches on the brightest keep.",
  sections=[
    ("How a siege works", "Raiders come at night against a settlement's Keep Heart. They attack the side with the fewest ballistas and archers. Walls crack, gates are rammed, and wooden things burn. Win, and the settlement grows.", False),
    ("Who comes", ["Sieges 1 and 2: ordinary monsters.", "From siege 3: the third-night army (Tollmen, Bell-Ringers, Brutes, Torchbearers, Ogres, Crow-Mages), 15% more of the army each siege up to 85%.", "From siege 6: the Grey Host joins.", "Sieges 7 to 9: a single Watcher stands at the back.", "From siege 10: the Hollow's own soldiers.", "These numbers are first guesses. A separate piece of work on the raids owns the pacing."], False),
    ("Ravens", "Ravens on your wall at dusk mean a raid tonight. More come the longer your keep has stood.", False),
    ("The singing", "On third nights there is a low held hum, faint everywhere and louder in certain places. Sorcerers hear it more clearly.", False),
    ("Why", "About 310 years ago King Oswin ended a war by truce with the Hollow: it took the invading Grey Host, and in return every third night is the Hollow's. His own people overthrew him and broke the truce. The Hollow still collects its night. The ravens are the Grey Host's birds, waiting where the Host is going next. The hum is the Choir.", S),
  ])

page(key="history", group="world", name="What really happened", hide=True,
  line="The whole truth, in order. Players should learn it over weeks, from books that disagree.",
  sections=[
    ("Hallowmere, about 700 years ago", "The Hollow is another world, not a copy of ours. It ran aground on our world at a marsh, and for a while the place where they met was one kingdom that belonged to both.", S),
    ("Queen Maelis", "She cast the Founding Bell, rang the Hollow out, renamed what was left Aldmere and scraped the old name off the charters.", S),
    ("King Aldric, about 360 years ago", "The Hollow began to seep back: salt wells, long nights, a second moon, people who came back wrong. Aldric saw it, never understood it, and kept a journal. That is the journal every player starts with.", S),
    ("The Grey Host and the truce, about 310 years ago", "The Hollow called an army from the Ice Isles to cut down Aldmere's bells. Aldric's son, King Oswin, was losing. He went below with his mage Corvin Hale and made the Truce of the Third Night: the Hollow took the Host at 3:17, and every third night became the Hollow's. It was sworn on the Hollow Crown, and a splinter of the Crown was given to Oswin as a pledge.", S),
    ("The overthrow", "People went below on third nights and shapes came up in their places. Aldmere came to hate the peace. Princess Edda and the lords took Oswin on the walls, put him through the Crack alive, and rang every bell to break the truce.", S),
    ("Bellhollow", "The Hollow came up in fury and lost. The Founding Bell's last stroke shut every thin place and left one wound, the Gate.", S),
    ("The cover-up", "Edda became Saint Ashe and founded the Order of the Ashen Gate, which burned the portraits and taught that there was never a King Oswin.", S),
    ("Now", "The Hollow is forcing the Gate. Its leader is Morvane, who was Oswin. The Ember that falls after a first siege win is the pledged splinter, looking for the brightest keep.", S),
    ("How it is kept secret", "Five layers: something is wrong; the official story; something is off; what really happened; who is down there. Books are placed so that no layer can be skipped. Nobody says who Morvane was before the last fight.", S),
  ])

page(key="people", group="world", name="People you meet",
  line="Eight story characters, all hand-written, who answer differently depending on what you have read and done.",
  sections=[
    ("Who they are", ["Sister Wren, a healer in Millbrook whose brother came back wrong.", "Sir Aldous Vane, a young knight of the Order who believes in it.", "Old Mag of Mirelight, who says a lot of things.", "Elias Marrow, the lighthouse keeper at Gull's Rest.", "Archivist Pell, thrown out of the Order for reading. He is the hint system, at your town hall or Library.", "Brother Cael, the Order's archivist.", "Sigrun Ashby of Rimehold, Wren's northern cousin.", "Warden Isolde of Sunscar."], False),
    ("Job folk", "Farmer, woodcutter, quarryman, smith, fisher, hunter, herbalist and moneyer buy goods for coin. A Mason sells building stone in every settlement.", False),
    ("What they are hiding", "Mag was Corvin Hale's last apprentice and is 311. Elias is an echo who does not know it, and his lamp guides the Hollow's creatures ashore. Cael, Sigrun and Mag each hold one piece of who Morvane was. Corvin himself can be heard in the Choir by Sorcerers, slightly off the note, because he is still arguing.", S),
  ])

page(key="library-and-mysteries", group="world", name="The Library and the Ledger",
  line="The story is told in books scattered across the map.",
  sections=[
    ("Tomes", "There are 74 Lore Tomes in eight collections: the Oswin Chronicles, the Sealed Records of the Ashen Gate, Corvin's Notebooks, the Surveyor's Field Notes, the Lighthouse Letters, the Sung Verses, Testimonies of the Lost Days, and the Fallen. Shelve them on Archive Shelves in your Library. The sources disagree, on purpose.", False),
    ("The Ledger of Whispers", "Reading copies clues into your Ledger under one of 16 mysteries. With enough clues you can answer. A wrong answer locks that mystery for a day. Every mystery can be solved by one player alone.", False),
    ("The Old King's Journal", "Every player has it from their first minute. Twelve entries by a king who saw strange things and understood none of them. Reading it is optional.", False),
    ("Tools", "The Cipher Wheel reads the Lighthouse Letters. The Tide Glass reads the Sung Verses, which are written right to left. Moon doors open only on the night our moon is the opposite of the one carved on them.", False),
    ("Who to trust", "Corvin's Notebooks and the Field Notes are truthful. The Order's public records lie. The court chronicler writes what he is told but cannot help noting true details. The boss tomes are confessions. Solving every mystery and learning the land's old name, Hallowmere, opens a hidden third ending: say it at the throne to offer the truce again.", S),
  ])

page(key="the-hollow", group="world", name="The Hollow", hide=True,
  line="Another world, pressing on this one. Friends should not hear of it before the story shows it.",
  sections=[
    ("What it is", "A drowned country of leaning towers and black water under a roof too far up to see, with fog, lightning and its own moon. It is not a copy of our world. It is one place with one look.", S),
    ("First glimpses", "A Flicker, then a Slip: for about ten seconds you are standing on a ledge in a drowned town, and then you are back, soaking wet. The first one happens while talking to Sister Wren.", S),
    ("Getting in", "The Rift is a huge crack in a cave wall at one of seven thin places. A Tuning Fork (five Choir Shards and two amethyst) opens it at the real one and shatters at a decoy. Six Field Notes each state one true thing about the real site.", S),
    ("The land", "About 1,400 by 2,500 blocks. The centre is hand-designed, with paths, bridges and villages. Beyond it the land is generated. Glowing rivers connect everything, and a boat of Latticewood, the Hollow's own wood, travels them.", S),
    ("Its people", "They talk and trade. Four mining villages (Glimwade, Lowseam, Tollrest, Highcut) dig Choir Ore, which smelts to Choirsteel, stronger than netherite. Ore collects in a Vault under the Seat.", S),
    ("Its dangers", "Gloamwings gather the longer you stay. Wronglings, Stone Vigils, Mirror Knights, Echo Hounds and Tolling Shades walk it. The Choir holds the Court, and Morvane holds the Seat.", S),
  ])

page(key="paths-and-roles", group="play", name="Paths and roles",
  line="Everyone starts as a plain person. The world and your choices decide what you become.",
  sections=[
    ("The Ember", "After your first siege win an Ember falls from the sky. Use it and you become a Sorcerer. Swear at the Tree of Oaths instead and you become a Knight. The choice is permanent.", False),
    ("Knight", "Oathsworn ranks and fighting techniques, an Oath Banner, and the Order's respect.", False),
    ("Sorcerer", "Fourteen arts cast through the Bound Ember. Using them raises Resonance, from 0 to 100. At 70 you are 'loud': Echo Hounds hunt you and the Order's Inquisitors silence you. Four arts stay unknown until the story opens them.", False),
    ("The Tree of Oaths", "A block inside your town hall with 50 skills in four branches: Keep and Wayfarer for everyone, Blade for Knights, Arcana for Sorcerers. Five rings open with your hall's tier and your Renown.", False),
    ("Other roles", "Dragon Rider and others have been proposed and are not confirmed.", False),
    ("Where the arts come from", "There is no magic in Aldmere. The Ember is a splinter of the Hollow Crown, and every art is something the Hollow's people do by nature, done badly by one of us. The more you borrow, the better the Hollow hears you. The book The Fourteen Arts hints at each origin without naming any of it.", S),
  ])

page(key="settlements", group="play", name="Settlements",
  line="Claim a plot, raise a keep, and grow it into a city behind ten levels of wall.",
  sections=[
    ("Claiming", "Twelve plots, taken alone or shared. On arrival you get a first wall, a Longhouse, a Mason, a Library and signposts for what can be built later.", False),
    ("Tiers", "Hamlet, Town, City, Castle, Sovereign. The town hall grows with them: Longhouse, Stone Hall, Keep, Fortress, Sovereign's Throne. Each region builds a different hall, not the same one recoloured.", False),
    ("Walls", "A ring around the Plot Stone with one gate, in ten levels from timber to the strongest stone. Walls take damage in sieges. The Mason mends them, but not during a siege.", False),
    ("Castle Stone", "Every region builds from the same five blocks (Castle Stone, Tiles, Bricks, Cobbled, Smooth), coloured for that region. The Mason sells them, cheaper in their home region.", False),
    ("Building", "Place pre-designed buildings with a Foundation Stone (cottage, smithy, stable, storehouse, watchtower, market, well, garden) or build your own. You can only build inside your own claim, and not on the ground your hall will grow into. Outside it, only a camp kit.", False),
    ("Defence", "Men-at-Arms and Archers from the Barracks, ballistas, and siege gear from the Quartermaster.", False),
  ])

page(key="coin-and-trade", group="play", name="Coin and trade",
  line="One currency for the whole world, backed by iron.",
  sections=[
    ("The coin", "One iron ingot is worth 8 coins. A gold coin is 64. The coin's name is still a working title.", False),
    ("Earning", "Sell goods to job folk: wheat to the farmer, logs to the woodcutter, and so on. A region pays less for what it produces and more for what it lacks, and each buyer's appetite drops if you flood them in one day.", False),
    ("The Moneyer", "Buys iron at 8 and sells it at 10. The first 64 ingots a day get full price.", False),
    ("Spending", "Castle Stone, buildings, guards, siege gear, horses. A Strongbox at your Keep Banner banks coin, and shops on your own land draw on it.", False),
    ("Status", "Older prices in emeralds are still being converted, feature by feature.", False),
  ])

page(key="travel", group="play", name="Travel",
  line="No elytra. Horses, roads and rails.",
  sections=[
    ("Horses", "Five regional breeds. Train speed, jump and health at your Stables, fit gear and caparisons, and breed for traits. Late forms: the Warhorse, which charges, and the Glimstrider.", False),
    ("Roads", "Roads and signposts run beside every rail line, with bridleways between.", False),
    ("Rails", "Vanilla rails with Station Posts. A four-seat Train Carriage can be called at a station.", False),
    ("Dragons", "Emberwaste residents only. See the Dragons page.", False),
  ])

page(key="endgame", group="play", name="The crowns and the endless game", hide=True,
  line="Two prizes, and a world that keeps going after the story.",
  sections=[
    ("The Hollow Crown", "The crown of the Hollow's ruler. It kills anyone who puts it on except a max-level Sorcerer, and the game says so. Putting it on tells everyone by name. A Sorcerer must keep it on for 30 seconds, and a hit from another player knocks it off for anyone to grab.", S),
    ("Ruling the Hollow", "The ruler owns the Choir Ore, sets its price and tithe, is told when someone mines or robs, and can step straight to them. A player ruler can only be robbed or besieged while online.", S),
    ("The Heart of the Hollow", "Whoever defeats Morvane does not rule the Hollow. The Heart rests where he fell, for anyone to take, now or later. Reaching for it alerts everyone, and it is yours after 10 seconds unless you are hit or step away. Its holder is the Heartbearer, the strongest in the overworld: their settlement becomes a Citadel, and they are offered the Sorcerer's path with a boost.", S),
    ("Taking it from them", "Rivals earn a Claim, throw down a Gauntlet, and storm the Citadel on the next siege night while the ruler is online. The loser is banished and walks the Long Road Back as an Exile.", S),
    ("Forever", "Seeps keep opening. Twelve Rival Lords settle free plots and can claim the throne. A Rumor Board at the town hall offers three jobs a day. When no player rules the Hollow, a computer-run ruler does.", S),
  ])

page(key="relics", group="items", name="Relics and boss keys",
  line="Each boss drops one named relic, the first time only.",
  sections=[
    ("Relics", ["Minute Hand (Clockwork Reeve): a sword whose hits slow time around the target.", "Rimefang Bow (Pale Huntsman): its arrows root targets in ice.", "Widow's Veil (Drowned Bride): breathe water, see in the dark, and see things from the Hollow for what they are.", "Seneschal's Greatshield (Ash Seneschal): in your offhand, sneak to brace. Big resistance, and attackers are thrown back.", "Faceless Crown Shard (Ash Seneschal): a sliver of something once worn. It whispers.", "Mire Heart (Mother of Changelings): in your offhand at night, your hits heal you.", "The Warlord's Brand (Warlord King): sets foes alight, and every fifth hit lets out a shockwave."], False),
    ("Keys", ["Stopped Clock Key: wind it in Millbrook's well.", "Pale Horn: blow it on the frozen lake.", "Drowned Wedding Ring: her ring. She wants it back.", "Faceless Seal: the Seneschal's seal, with no face on it.", "Mire Effigy: a doll of sticks and hair."], False),
    ("The last relics", "Morvane leaves the Kept Oath to a Knight (a sword that executes foes below a fifth of their health and rallies your guards) or the Crownless Mantle to a Sorcerer (hits sometimes pass straight through you).", S),
  ])

page(key="materials", group="items", name="Materials",
  line="What creatures drop, and who drops it.",
  sections=[
    ("From the Hollow's creatures", ["Veil Ash: grey ash that hums. Dropped by almost anything the Choir has touched.", "Changeling Ichor: shifts colour while you look at it. Changelings.", "Gloamquill: a Gloamwing's flight quill. It never quite stops trembling."], False),
    ("From the regions", ["Pale Antler (Frost Stag) and Rime Pelt (Rimewolf), the Frostmarch.", "Brine Scale (Brine Lurker), Saltreach.", "Ash Glass (Ash Scarab) and Wyrm Scale (Dune Wyrm), the Emberwaste.", "Toad Venom (Mire Toad, Bog Hag), the Blackfen.", "Wight Dust (Barrow Wight), the Vale."], False),
    ("From bosses", ["Clockwork Cog: it ticks on its own.", "Drowned Pearl: from the Bride's veil."], False),
    ("Uses", "Pale Antler is wanted by Stables masters. Most other uses are not built yet.", False),
  ])
