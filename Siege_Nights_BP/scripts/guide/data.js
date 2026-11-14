// The Settler's Almanac: every page and every first-meeting tip. Words only; the rules are in rules.js.
//
// One entry per mechanic:
//   id       short, never renamed (players' read/met marks are saved by id)
//   ch       chapter id (CHAPTERS below)
//   title    the page name
//   tip      one line, said once in chat the first time the player meets the thing (when:)
//   page     the full page in the Almanac
//   when     what counts as meeting it. Each is "<kind>:<what>", and <what> may end in * to match a prefix:
//              place:<block>   placed it              click:<block>   clicked it
//              hit:<block>     punched it             use:<item>      used it
//              carry:<item>    it is in their pack    talk:<entity>   clicked an NPC or animal (talk:tag:<tag> for a tag)
//              near:<entity>   one is within 14 blocks
//              event:<name>    a game event that names them (or everyone online, for world events)
//   hidden   not listed until met (anything a newcomer should not know about yet)
//   needs    the page only exists in builds that have this block, item or entity
//
// Writing rules (Mateo's): plain words, say what to press and why. Never name the Hollow outside the
// chapters "beyond" and "throne", which only open once a player has been there or someone wears the
// Heart. Things meant to be found (the Cold Forge, thin places, moon doors, the Returned, the third
// ending) get no page at all. tools/check.mjs fails if a page breaks the first rule.

export const ALMANAC = {
  item: "siege:almanac",
  title: "The Settler's Almanac",
  cover: "Copied out by the Kingsrest clerks for anyone who arrives with nothing. It tells you how things are done in Aldmere. It does not tell you why.",
};

export const CHAPTERS = [
  { id: "start", name: "First days", icon: "textures/items/book_writable" },
  { id: "siege", name: "Siege nights", icon: "textures/items/siege_war_horn" },
  { id: "keep", name: "Your settlement", icon: "textures/items/siege_hall_cornerstone" },
  { id: "coin", name: "Coin and trade", icon: "textures/items/siege_gold_coin" },
  { id: "travel", name: "Roads, rails and horses", icon: "textures/items/saddle" },
  { id: "growth", name: "Growing stronger", icon: "textures/items/siege_hollow_ember" },
  { id: "lore", name: "Books and mysteries", icon: "textures/items/siege_lore_tome" },
  { id: "wild", name: "The wild and what lives in it", icon: "textures/items/bone" },
  { id: "beyond", name: "Beyond the seam", icon: "textures/items/siege_raw_choir_ore" },
  { id: "throne", name: "The High Throne", icon: "textures/items/siege_crown_shard" },
];

export const ENTRIES = [
  // ---------------- First days ----------------
  {
    id: "almanac", ch: "start", title: "This book",
    tip: "",
    page: "Use this book to open it. Every time you meet something new in Aldmere (a block, a person, a kind of night) you get one line in chat about it, and the full page here is marked with a §6gold dot§r until you read it.\n\n"
      + "Some pages only appear once you have met the thing they are about. Some things are not in here at all: you will have to find those yourself.\n\n"
      + "Lost the book? Type §f/siege:guide§r to open it anyway, or craft another from a book and a feather at any crafting table. The tips can be turned off on the first page.",
    when: [],
  },
  {
    id: "eating", ch: "start", title: "Food and healing",
    tip: "Eat on a full hunger bar and food heals you at once: half a heart every half second while the meal lasts.",
    page: "Food heals §ffast§r here. While your hunger bar is §ffull§r and the meal you ate still has something left in it, you get half a heart back every half second. Top the bar up in a fight and the hearts follow in a few seconds.\n\n"
      + "Rich food lasts longest: a steak or a cooked porkchop is worth about four hearts, cooked cod or bread about two. Once the meal is used up you heal slowly again, half a heart every four seconds, and not at all below nine drumsticks.\n\n"
      + "Bread comes from any Farmer, cooked cod from a Fisher and cooked beef from a Hunter, in the six towns. Or grow, fish and raise your own.",
    when: ["carry:minecraft:bread", "carry:minecraft:cooked_beef", "carry:minecraft:cooked_cod", "carry:minecraft:cooked_porkchop", "carry:minecraft:cooked_chicken", "carry:minecraft:cooked_mutton", "carry:minecraft:baked_potato"],
  },
  {
    id: "starter_clothes", ch: "start", title: "Your starting clothes",
    tip: "These are your region's working clothes and tool. They keep the weather off, not a sword: a Smith sells real armour.",
    page: "Everyone starts out dressed in the working clothes of the region they arrive in, with that region's tool for a weapon: a straw hat, jerkin and §fbillhook§r in the Vale, a fur-trimmed hood, quilted coat and §fhatchet§r in Frostmarch, a knit cap, striped smock and §fcutlass§r in Saltreach, a sun wrap, sand tunic and §fsickle-sword§r in the Emberwaste, an oilskin hat, coat, waders and §freed spear§r in Blackfen. Start in Kingsrest and you get the Vale's.\n\n"
      + "They protect about as well as leather and wear out as fast, and the weapon hits like a wooden sword. Mend the clothes with leather and the weapon with iron nuggets at an anvil, or buy spares cheaply: each region's §fHunter§r sells its clothes and its §fSmith§r its weapon.\n\n"
      + "Your first real armour is a big step up. Any Smith sells his region's Castle Guard armour.",
    when: ["carry:siege:starter_*"],
  },
  {
    id: "first_days", ch: "start", title: "What to do first",
    tip: "",
    page: "1. §fChoose a place.§r In the hall in the sky (the whole map in miniature), click a green stone to take that plot. (No plot? Start in Kingsrest and claim a free Plot Stone you find on foot, or join a friend.)\n"
      + "2. §fClick your Plot Stone§r and choose §fRaise your banner here§r. That founds your settlement: its wall, Longhouse, Mason's Yard, library and your own house go up by themselves.\n"
      + "3. §fOpen your founder's chest§r in your house: logs, saplings, a stone pickaxe and axe, bread, torches and a few Regals. The old trees out in the world can't be felled, so plant the saplings.\n"
      + "4. §fBuild a Barracks§r: go to your big empty plot, click its §fPlot Marker§r (the post on it), choose Barracks and Raise it. When it stands, click the §fBarracks block§r by its door and train guards (40 Regals each).\n"
      + "5. §fHold the night.§r The first siege comes on the third night. Stay online, kill every raider and keep your banner standing. Each siege you hold is a win, and wins grow your settlement.\n\n"
      + "The top-right tracker shows your next step until then. Iron lies under your land: dig down with a pickaxe. Nothing is charged for upkeep until you have held your first siege.",
    when: ["event:keepFounded"],
  },
  {
    id: "quests", ch: "start", title: "Your next step",
    tip: "",
    page: "The lines in the top-right corner, under your minimap, are your §fquest tracker§r. They are always up, and they show the step of the story you are on now: what it is, a hint, and, when it is somewhere you know of, how far away it is and which way to turn (ahead, left, right, behind you).\n\n"
      + "It changes by itself as you go: when you meet someone, solve a mystery in your Ledger, pick up something that opens a door, or see a great foe fall. Now and then a second line shows something else worth doing alongside.\n\n"
      + "It only points at towns and places you have already been told about or been to. Some places are hidden on purpose: for those it tells you where to look, and your Ledger's leads say roughly where they are.\n\n"
      + "Everyone sees their own steps, so friends on the same world can be at different points.\n\n"
      + "To hide it, type §f/siege:quests§r. Type it again to bring it back. Hiding the minimap (§f/siege:minimap§r) moves the tracker up into its place.",
    when: [],
  },
  {
    id: "land", ch: "start", title: "Land and protection",
    tip: "This land is yours now. Others can't build or break here, and nothing here can be broken while you are offline.",
    page: "Your Keep Banner claims the land around it. When you walk near the edge of anyone's land a line of particles in their banner colour shows where it runs, and you are told when you step in or out.\n\n"
      + "§fOn your land:§r only you and your allies can build, break or dig. Others have to come through your gate, or blast a hole with a Breaching Charge. While you are offline nothing on your land can be broken at all.\n\n"
      + "§fOff your land§r (on the Aldmere map): out in the wilds you can only pitch a camp (torches, a bed, a chest, a crafting table, a furnace, a campfire, ladders, saplings). Gathering is always allowed.\n\n"
      + "§fThe ground your town hall will grow into§r is kept clear for it, so you can't build there either.",
    when: ["event:keepFounded"],
  },
  {
    id: "workshop", ch: "start", title: "The Siege Workshop",
    tip: "The Siege Workshop is a crafting table for castle things. Open it and check its recipe book: most of this world's items are made here.",
    page: "Every new settlement has one in its Mason's Yard. More can be crafted at a normal crafting table: an iron ingot on top, then stone bricks, a crafting table and stone bricks.\n\n"
      + "§fSneak-click§r a Workshop for its book: the main things it makes, what each does and what it takes.\n\n"
      + "Open it like a crafting table. Its recipe book lists everything it makes: Castle Stone and its kin, gates and portcullises, ballistas, trebuchets, rams, Breaching Charges, the Mason's Bench, Archive Shelves, horse gear, the Writ of Alliance and much more.\n\n"
      + "Siege blocks can only be placed inside your own settlement.",
    when: ["place:siege:workshop", "carry:siege:workshop"],
  },
  {
    id: "no_elytra", ch: "start", title: "No elytra, and the edge of the map",
    tip: "Elytra don't work in Aldmere. They crumble and pay you 3 Gold Regals instead.",
    page: "Aldmere is crossed by road, rail and horse, and by dragon for those who earn one. An elytra crumbles the moment it is in your pack, and you are paid 3 Gold Regals for it.\n\n"
      + "The map has an edge: you can't go more than 1,250 blocks from its centre.",
    when: ["carry:minecraft:elytra"],
  },
  {
    id: "minimap", ch: "start", title: "The minimap",
    tip: "",
    page: "The map in the top-right corner shows about 190 blocks around you, north up, with an arrow for you, gold dots for the twelve plots and pale squares for towns. Under it is the name of the settlement or region you are in.\n\n"
      + "Type §f/siege:minimap§r to hide it or show it again.",
    when: [],
  },

  {
    id: "graves", ch: "start", title: "Dying and your grave",
    tip: "When you die, your things go into a gravestone where you fell. Click the headstone to get them back.",
    page: "When you die, everything you drop goes into a §fgravestone§r where you fell (or on the nearest dry ground). Chat tells you where it is. Walk back and click the headstone to gather your things: armour goes straight back on, the rest into your pack. Anything that doesn't fit stays in the grave until you make room.\n\n"
      + "§fSealed for 10 minutes.§r Only you can open your own grave at first. While the candle beside it burns, it is sealed; when the candle goes out, anyone can open it, so don't dawdle.\n\n"
      + "§fKilled by another player?§r Then your grave is open to anyone at once, and your killer is told where it is.\n\n"
      + "Graves can't be broken or blown up. Once emptied, a grave settles back into the earth. Anything lost to lava or the void is gone before it can reach a grave.",
    when: ["event:graveDug", "click:siege:gravestone"],
  },

  // ---------------- Siege nights ----------------
  {
    id: "siege_nights", ch: "siege", title: "How siege nights work",
    tip: "Siege nights come every third night at first. Click your Keep Banner to see when the next one is due.",
    page: "On a siege night an army marches on every settlement whose owner is online. The Keep menu (click your Keep Banner) says when the next one is due.\n\n"
      + "§fThe evening:§r odd things happen from dusk (omens: animals staring at one wall, flames leaning, a far bell). A horn sounds before the first wave.\n"
      + "§fThe waves:§r one an hour, each at seventeen past, the last at 3:17. A sidebar shows the waves left, raiders remaining and your keep's health.\n"
      + "§fWinning:§r keep your Keep Banner standing and kill every raider. You are paid in Regals and XP, and it counts as a win.\n"
      + "§fDawn:§r if dawn comes first they withdraw.\n\n"
      + "You can't sleep through a siege. Every siege is planned for your settlement: the bigger the threat, the better the pay. Later on, they come more often.",
    when: ["event:siegeStart", "carry:siege:keep_banner"],
  },
  {
    id: "keep_heart", ch: "siege", title: "Holding the keep",
    tip: "Raiders go for your Keep Banner. Its health floats above it: if it reaches zero, your banner falls.",
    page: "Raiders head for your Keep Banner and its health floats over it. Kill them before they get there.\n\n"
      + "If the banner falls it drops to the ground and the raiders leave. Pick it up and raise it again: your buildings and walls are untouched, you keep your tier, and only one win is lost. On the Aldmere map your plot is held for you for 3 days.\n\n"
      + "Another player can also carry off your Keep Banner while you are online, which topples your settlement. Guard it.",
    when: ["event:siegeStart"],
  },
  {
    id: "sappers", ch: "siege", title: "Rams, sappers and charges",
    tip: "A sapper has lit a Breaching Charge at your wall. Break the charge before its fuse runs out to defuse it.",
    page: "From your second siege, §fBattering Rams§r come for your walls. Kill them first.\n\n"
      + "§fSappers§r plant a lit Breaching Charge against your wall. Break the charge before its 4-second fuse runs out and it is defused.\n\n"
      + "Siege weapons wear walls down a little at a time, and cracks show as a block weakens. See \"Walls\" for how to make them tougher and patch them.",
    when: ["event:siegeStart", "carry:siege:breaching_charge"],
  },
  {
    id: "walls", ch: "siege", title: "Walls: reinforce and repair",
    tip: "Click Castle Stone, a gate or a portcullis on your land with an iron ingot to reinforce it. Patch cracks with stone bricks.",
    page: "§fReinforce:§r click Castle Stone, a Portcullis or a Castle Gate on your land with an §firon ingot§r, then a §fdiamond§r, then §fnetherite scrap§r (one each, in that order). Each tier shows on the block.\n"
      + "  Castle Stone takes 6 blows, then 10, 16 and 26. A gate takes 2, then 4, 7 and 12.\n\n"
      + "§fRepair:§r click a cracked block with §fstone bricks§r to patch it.\n\n"
      + "§fWeight:§r walls carry their own weight. Knock a hole in one and the stone above falls away in a stepped arch; knock out too much and whole sections come down, tipping toward the open side, and leave rubble that slides into a slope. Cracked blocks with a lot of wall on top of them can crush. Reinforced walls reach further over a gap and carry more. Nothing falls in a settlement whose owner is away.\n\n"
      + "§fAfter a bad night§r the Mason, or the Settlement wall page in your town hall, will survey the whole wall and mend every hole and crack for a price.\n\n"
      + "§fGates:§r one click opens or shuts the whole gate, whatever you hold (it never places a block). A Castle Gate swings open like a door, all its joined blocks as one leaf, away from you; a Portcullis rises until only its top piece shows.",
    when: ["place:siege:castle_stone*", "place:siege:portcullis*", "place:siege:castle_gate*", "carry:siege:castle_stone*"],
  },
  {
    id: "machines", ch: "siege", title: "Siege machines",
    tip: "Siege machines: sneak and click one with an empty hand to pack it back up.",
    page: "§fBallista§r: place it on your own land. It turns to face monsters within 16 blocks and shoots them, even through Arrow Slits.\n\n"
      + "§fTrebuchet§r: can stand anywhere. Stand by it, look where you want to fire and click it with §fcobblestone§r: it swings round and hurls a boulder (10 s to reload). Look higher to lob it high, level for a flat fast throw. Sneak + click to change the counterweight (Light, Medium, Heavy): heavier throws further. Boulders hit harder the faster they land, and only you and your allies can fire your trebuchet.\n\n"
      + "§fBattering Ram§r: click it to climb on, steer with the movement keys and punch the wall in front to swing the beam. Sneak to get off.\n\n"
      + "Sneak + click a ballista, trebuchet or Battering Ram with an empty hand to pack it up. Raiders aim at the side of your settlement with the fewest ballistas and archers.",
    when: ["carry:siege:ballista", "carry:siege:trebuchet", "carry:siege:battering_ram"],
  },
  {
    id: "war_horn", ch: "siege", title: "The War Horn",
    tip: "The War Horn calls a siege on your settlement tonight. They come angrier for being called.",
    page: "At night, a settlement owner can blow the War Horn to call a siege early. The army comes bigger for being provoked, and pays more if you win.",
    when: ["carry:siege:war_horn"],
  },
  {
    id: "warlords", ch: "siege", title: "Warlords and the Grand Siege",
    tip: "",
    page: "From your third siege a named warlord may lead the last wave, and every fifth siege always has one. They are much tougher, and drop 96 Regals and 2 diamonds.\n\n"
      + "Raiders learn: whatever did most of the killing last time, they bring an answer to it.\n\n"
      + "§fThe Grand Siege:§r once your settlement is a Castle, the Warlord King comes for you with every army at once, from two sides. Kill him and hold your keep to become §fSovereign§r: a big purse, a netherite ingot, a Totem of Undying and four more guards. Lose and he comes back next siege.",
    when: ["event:warlordSlain", "event:tierUp"],
  },

  // ---------------- Your settlement ----------------
  {
    id: "keep_menu", ch: "keep", title: "The Keep Banner and its menu",
    tip: "Click your Keep Banner with nothing in hand for the Keep menu: your tier, wins, next siege, guards, allies and more.",
    page: "Click your Keep Banner (not holding dye) for the §fKeep menu§r: your tier, your wins and what the next tier needs, when the next siege comes, what attacked you last, your guards and allies, your Regals, your look, and every plot on the map.\n\n"
      + "§fColour:§r every settlement has its own banner colour, and no two can share one. Use a dye on the banner to change it. Your guards, your land's border and your horse cloth follow it.\n\n"
      + "§fGrowing:§r every siege you hold is a win. At 3 wins a Hamlet becomes a Town, at 6 a City, and at 10 wins with 2 warlords slain, a Castle.",
    when: ["place:siege:keep_banner", "event:keepFounded"],
  },
  {
    id: "allies", ch: "keep", title: "Allies and shared settlements",
    tip: "Look at a friend and use the Writ of Alliance to let them build on your land. Use it again to end it.",
    page: "Look at a friend and use a §fWrit of Alliance§r. They can now build on your land, ride your horses, and your guards will never turn on them. Use it on them again to end the alliance.\n\n"
      + "If you want to share one settlement instead of each having your own, one of you raises the banner and gives the others a Writ.",
    when: ["carry:siege:writ_of_alliance"],
  },
  {
    id: "town_hall", ch: "keep", title: "The town hall",
    tip: "Your town hall comes with your Hamlet, on the hall ground behind the Plot Stone, and grows with your settlement.",
    page: "Your town hall comes with your Hamlet: when your town is laid out, its §fHall Cornerstone§r is set on the hall ground behind the Plot Stone and the first hall rises by itself. Once the hall stands the stone is gone: open the town hall menu from the §fTown Board§r just inside the door, or from your Keep menu.\n\n"
      + "The hall is built in your region's own style and is rebuilt bigger as your settlement grows. It holds the §fTree of Oaths§r, where you spend skill points.\n\n"
      + "From the hall menu you can also raise your §fsettlement wall§r level by level (and watch it go up), see who is online, and read the §fTown Board§r for jobs.",
    when: ["carry:siege:hall_cornerstone", "click:siege:hall_cornerstone"],
  },
  {
    id: "hall_map", ch: "keep", title: "The Hall Map",
    tip: "Click the Cartographer's Table in your hall to see every settlement and the places your people have found.",
    page: "Every town hall keeps a §fHall Map§r. Click the hall's Cartographer's Table, or choose \"Hall map\" in the Town Hall menu.\n\n"
      + "It shows every settlement in its banner colour and who holds it, rival lords, free plots and the towns. Places your settlement has found appear as you find them, and land nobody from your settlement has walked stays under fog. Allies' travels count too. Players themselves never show on it.\n\n"
      + "Tap a mark to read about it. Mysteries are never marked: you have to work those out yourself. Sneak-click the table to use it as an ordinary cartography table.",
    when: ["click:minecraft:cartography_table"],
  },
  {
    id: "wall_levels", ch: "keep", title: "The settlement wall",
    tip: "",
    page: "Your settlement can have a ring wall round its land, raised in ten levels from your town hall's Settlement wall page. Each level is paid for in stone and rises while you watch.\n\n"
      + "It follows the ground rather than a perfect circle, and its gate faces the road. Damaged walls can be mended at once by the Mason or from the same page, for a price that follows the damage.",
    when: ["event:wallBuilt", "event:wallUpgrade"],
  },
  {
    id: "building_rules", ch: "keep", title: "The Mason and ready-made buildings",
    tip: "The Mason sells building blocks for coins. Your own region's materials are cheaper.",
    page: "§fThe Mason§r sells building blocks, so building doesn't mean weeks of quarrying. Your region's own materials are cheaper. Place a §fMason's Bench§r on your land and a mason sets up beside it (two at most). Towns have their own masons. The Mason can also mend your settlement wall.\n\n"
      + "§fA new settlement§r comes with its Mason's Yard (a stone workshop, with the bench out front where the Mason works), the library, and a cottage of your own with a bed kept for you, so you can sleep the first night. Its road runs out through the gate to the nearest road.\n\n"
      + "§fReady-made buildings§r go up on your town's plots: click a plot's §fPlot Marker§r, pick a building, look at the outline, then click again to pay and raise it.\n\n"
      + "Or build by hand, anywhere on your land outside the ground kept for your hall.",
    when: ["talk:tag:siege_mason", "carry:siege:mason_bench", "carry:siege:foundation_stone", "click:siege:foundation_stone"],
  },
  {
    id: "town_plots", ch: "keep", title: "Town plots and charters",
    tip: "Use a Plot Marker to raise a building on a town plot. Each plot only takes buildings of its size.",
    page: "Every open plot in your town has a §fPlot Marker§r. Use it to see what can go there: only buildings of the plot's size are listed, and some want a certain spot (a watchtower stands by the wall). Good spots are marked. Pick one, walk round the outline, then use the marker again and pay to raise it.\n\n"
      + "§fCharters:§r siege wins grow your settlement, but it only grows past each tier once that tier's charter stands. A Town needs 3 homes (cottages, houses or townhouses), a Farmhouse, a Mint and a market; a City needs 6 homes, an inn, a barracks and another work building. Any of them can also be built by hand and registered. When the last one is finished, the town grows by itself.",
    when: ["click:siege:plot_marker", "event:tierUp"],
  },
  {
    id: "settlers", ch: "keep", title: "Your own buildings, beds and settlers",
    tip: "Built something yourself on a plot? Use its Plot Marker and pick \"I built here myself\" to have it counted.",
    page: "§fYour own buildings:§r build by hand on an empty plot, then use its Plot Marker and pick §fI built here myself§r. It counts as a building if it has what that building needs: a home needs a bed and a door under a roof, a smithy an anvil and a furnace, a library 8 bookshelves, a stable hay and stalls, a storehouse 6 chests or barrels, a farmhouse a composter and 9 farmland, a mint 2 chests and an anvil, an inn 3 beds and 2 chests. Take those away and it stops counting until you put them back.\n\n"
      + "§fSettlers:§r every settler needs a bed in a home, one bed for every 12 blocks of covered floor. At dawn, if a home has a free bed, someone moves in: a worker for each finished work building first, then settlers for the homes. They go to bed at dusk. A worker whose building is knocked down stays, idle, until it is back.",
    when: ["event:settlerArrived", "click:siege:plot_marker"],
  },
  {
    id: "townsfolk", ch: "keep", title: "Townsfolk in the lords' towns",
    tip: "Rival Lords' towns have townsfolk too. Take the town and they stay, beds, jobs and all.",
    page: "A Rival Lord's town fills up the way yours does: the lord's builders put beds in every home they finish, and at dawn a newcomer arrives if there is a free bed, workers first. Their townsfolk talk the way their lord rules: a proud lord's people are stiff with strangers, a kind lord's people are friendly.\n\n"
      + "When you lay siege to a lord, the townsfolk go to their beds and stay out of the fight. If the lord falls and you take the town, they stay on and work for you, though they are wary of you for a few days.",
    when: ["event:townAdopted", "event:rivalBesieged"],
  },
  {
    id: "town_events", ch: "keep", title: "Town events",
    tip: "Something's happening in town. Things like this come every few days; none of them are chores.",
    page: "Every few days something happens in a settlement: a market fair with traders from another region, travelling players on the square at dusk, a wedding, a traveller who asks to stay, harvest day, a cart of spare timber. Now and then something odder. Rival Lords' towns have their fairs and players too, so it can be worth riding over.\n\n"
      + "Nothing happens on a siege night or the day after, and the same thing never comes twice in a row. Ignoring one costs you nothing.",
    when: ["event:townEvent"],
  },
  {
    id: "settler_requests", ch: "keep", title: "Settler requests",
    tip: "A settler with \"(a request)\" by their name wants a word. Talk to them to hear it.",
    page: "Now and then one of your settlers asks for something: a well on the square, another home, hay for the winter, a book for the library, a bed for their sister. Their name shows §e(a request)§r. Talk to them to hear it, and talk to them again once it is done (carry anything they asked you to bring).\n\n"
      + "A request stays open 7 days. Done in time, it pays Renown, and some pay coins. Let it go and nothing bad happens; someone will ask for something else in a few days.",
    when: ["event:settlerRequestDone", "talk:tag:siege_settler"],
  },
  {
    id: "wonders", ch: "keep", title: "Wonders",
    tip: "Six wonders stand waiting to be raised across the realm. Talk to a wonder's keeper to see what it gives its holder.",
    page: "There are six wonders, one site each, out in the open country: the Great Lighthouse on the Saltreach cliffs, the High Watch in the Vale, Rimeforge Hall in the Frostmarch snows, the Sun Gate Caravanserai in the Emberwaste, the Lantern Spire over the Blackfen pools and the Great Horse Fair in the Vale meadows. Each site has a keeper.\n\n"
      + "A City (or bigger) can claim a free wonder and pay for it in six stages, about 2,000 Regals in all. The crew raises each stage while someone is nearby, one wonder at a time per settlement. Once all six stages stand, the holder and their allies get its gift: better prices at the traders, the Smith or the railway, cheaper grooms, a tougher keep heart, or more newcomers each dawn.\n\n"
      + "Rival Lords race for wonders too. Anyone with a City can challenge for a wonder held by someone else: its guards come out and you have ten minutes to cut them all down. A wonder held by a player can only be challenged while they are in the realm. Beat a lord and take their town, and their wonder comes with it. Inside a finished wonder: lost travellers wait at the Lantern Spire each morning, free to take on; the Great Horse Fair runs races round its track and jousts against its champion, for a purse.",
    when: ["event:tierUp", "event:wonderClaimed", "event:wonderRaised", "event:wonderTaken"],
  },
  {
    id: "codex", ch: "growth", title: "The Codex",
    tip: "Your Codex draws every rare thing you pick up. Open it to see what's still out there.",
    page: "The §fCodex§r is a book of every rare thing in the realm: the arms of the five regions, the boss relics, the mythical weapons and tools, the caravan goods and the charms. Anything in it that you hold in your pack, even for a moment, is drawn in full with what it does. Anything you haven't held shows only its shape and a hint about where it is. A green dot marks a page you haven't read yet.\n\n"
      + "Open it by using the book, from your Keep menu, or by typing §f/siege:codex§r. Every ten things you find, the Kingsrest clerks send 50 Regals. Fill a whole chapter for a title. Lost the book? Craft another from a book and an item frame.",
    when: ["carry:siege:codex", "event:codexFound"],
  },
  {
    id: "region_arms", ch: "growth", title: "Regional arms and Kin-Writs",
    tip: "Regional armour only answers to those who live in its region, or carry its Kin-Writ.",
    page: "Five of the wonders have a forge: the Rime Anvil at Rimeforge Hall (Frostmarch), the Armoury at the High Watch (Aldmere Vale), the Lamp Room at the Great Lighthouse (Saltreach), the Caravan Smithy at the Sun Gate (Emberwaste) and the Lamplighter's Kiln at the Lantern Spire (Blackfen). Talk to the wonder's keeper and pick the forge. First make the region's alloy from a diamond and that region's trophies, then turn a diamond piece and four ingots into the region's armour or weapons. A wonder held by a Rival Lord still forges, at double the price.\n\n"
      + "Each region's arms only answer to people whose settlement stands in that region. Wear them anywhere else and the land turns on you: a warning, then you're slowed, then it hurts, until you take them off. To wear another region's arms you need its §fKin-Writ§r. The wonder's holder, or anyone settled in that region, can give one (or take it back) at the forge. Playing alone, the keeper will write you one for ten of the region's trophies, or sell you one for 200 Regals if a lord holds the wonder.",
    when: ["event:codexForge"],
  },
  {
    id: "caravan_market", ch: "coin", title: "The caravan market",
    tip: "The Sun Gate's caravan market sells four goods you can't get anywhere else. The stalls change every three days.",
    page: "Inside the finished Sun Gate Caravanserai, Caravan-Master Idris keeps a market of goods from past the end of every road: four at a time, and new stalls every three days, the same for everyone. Ember tea and caravan rations come four to a purchase. Hang a §fCaravan Banner§r inside your own settlement and a caravan trader stops by your keep once a week.",
    when: ["event:codexCaravan"],
  },
  {
    id: "plan_book", ch: "keep", title: "The Plan Book and Plan Scrolls",
    tip: "Your Plan Book lists the buildings you can raise. Find more plans as Plan Scrolls.",
    page: "A Plot Marker only offers buildings whose plan you know. Your §fPlan Book§r shows them as cards: open it from your pack or from the §fPlan Book§r button in your Town Hall menu. Found plans are bright, missing ones are grey with where to find them, and clicking a card shows its plot size, price, the worker it brings and the charter it counts toward. Every new town's founder gets a book; craft another from a book and a paper. The Hamlet's homes, well and library are known from the start, and your town hall teaches more as it grows: the market, garden, farmhouse, mint and townhouse at level 2, the smithy, stable and inn at 3, the storehouse and watchtower at 4. Everything a charter asks for is taught in time, so you never need luck to grow.\n\n"
      + "Everything else comes as §fPlan Scrolls§r: a toppled Rival Lord leaves plans of their town, every boss leaves one for each player at the kill, and a Rumor job sometimes pays one. Use a scroll to learn its plan for good. A plan from another region is in that region's style, and raising it costs half as much again.\n\n"
      + "To trade a plan, copy it onto a scroll from your Plan Book for a few coins and a paper.",
    when: ["carry:siege:plan_book", "carry:siege:plan_scroll", "event:planLearned"],
  },
  {
    id: "guards", ch: "keep", title: "Guards and the Barracks",
    tip: "Click your Barracks and choose Train soldiers.",
    page: "Raise a §fBarracks§r from the §fPlot Marker§r on a big plot (15 x 17: every Hamlet has one): click the marker, choose Barracks and Raise it. When it stands, click the §fBarracks block§r by its front door. §fTrain soldiers§r lists every type you have unlocked with how many you have, your cap and the price: pick how many, see the total, press Train, and they come out one after another. §fUpgrade the Barracks§r (to level 5) makes every price 8% cheaper per level and trains faster.\n\n"
      + "Sneak + click a guard to pick them up and put them anywhere on your land. Off duty, Archers stay exactly where you set them. Men-at-Arms stroll round the Barracks yard and sometimes the town by day, sleep inside the Barracks at night, and turn out at once when raiders come. Better: give them a post (see §fGuard posts§r).\n\n"
      + "§fArmour:§r click a guard holding the next upgrade: 6 iron ingots, then 12 iron ingots, then 4 diamonds, then a netherite ingot. Clicking with anything else opens the guard's orders. The Barracks §fArmoury§r upgrades a whole type at once (the same materials for each soldier), and those trained later wear it too.\n\n"
      + "§fWanted:§r anyone who attacks you or your guards on your land, lights a charge or rams your walls is Wanted there for 5 minutes, and your guards hunt them.\n\n"
      + "A Hamlet keeps 4 guards, a Town 8, a City 12. A fallen guard goes back to the Barracks and retrains by himself: half his price comes out of your Regals and goes to whoever killed him. If you can't pay, he is lost.",
    when: ["carry:siege:barracks", "click:siege:barracks"],
  },
  {
    id: "guard_posts", ch: "keep", title: "Guard posts",
    tip: "Click one of your guards and pick Station to send them to a post on your wall or by a building.",
    page: "Every building on your land has a few §fposts§r round it (by the door, at the back corners, along the sides of big ones), and your wall has posts all the way round plus one either side of the gate.\n\n"
      + "§fTo station a guard:§r click them and pick §fStation§r. Your view lifts high over your settlement, and every post shows on the ground as a ring with its number: §cred§r is empty, §agreen§r is manned. Pick the wall or a building from the list, then the post. The guard goes straight there. If someone already holds that post, the two swap.\n\n"
      + "A stationed §fArcher§r holds the post and shoots from it. A stationed §fMan-at-Arms§r stands at the post and, in a fight, chases attackers a short way before going back, so posts by your storerooms keep raiders from looting them.\n\n"
      + "§fThe watch:§r guards walk to their posts at dusk and back to the Barracks at dawn, using the steps up the inside of your wall (towers have ladders). A guard you have just stationed walks there at once and holds the post until the watch changes. If a siege starts, or someone Wanted is on your land, every stationed guard heads for their post straight away, running; anyone who meets an enemy on the way stops to fight, then carries on.\n\n"
      + "The §fBarracks§r menu has a §fGuard posts§r button to see which posts are empty and send a free guard to one. When your town grows and the wall moves out, guards on the wall keep their post on the new wall. If a building comes down, its guards go off duty.",
    when: ["click:siege:barracks", "event:guardOrders", "event:guardStationed"],
  },
  {
    id: "quartermaster", ch: "keep", title: "The Quartermaster",
    tip: "Raise the Quartermaster's Armoury from a Plot Marker and a quartermaster takes the post at its desk.",
    page: "Click the §fPlot Marker§r on a Medium plot and choose the §fQuartermaster's Armoury§r (one per settlement). When it stands, a quartermaster soon takes the post at the desk by its front (an unemployed villager standing by it takes the job first).\n\n"
      + "He sells siege gear, weapons, armour and finery for Regals, and more stock opens up the more you trade with him: diamonds from his second level, and netherite scrap and the netherite upgrade template once he is a veteran. Netherite is meant to take a long time.",
    when: ["carry:siege:quartermaster_desk", "click:siege:quartermaster_desk"],
  },
  {
    id: "forester", ch: "keep", title: "The Forester's Lodge",
    tip: "Chop a grown Lodge tree at the bottom of its trunk and the whole tree comes down. A sapling takes its place.",
    page: "The old trees out in the world can't be felled. For timber, place a §fForester's Lodge§r on your land: a fenced grove of your region's trees goes up behind it.\n\n"
      + "Chop a grown tree at the bottom of its trunk and it comes down, dropping its logs at the stump. A sapling takes its place and is full grown again in three days. Click the Lodge to choose what each plot grows and to open more plots.",
    when: ["carry:siege:foresters_lodge", "click:siege:foresters_lodge"],
    needs: "siege:foresters_lodge",
  },
  {
    id: "old_trees", ch: "keep", title: "The old trees",
    tip: "The old trees of Aldmere can't be felled. Plant your own, or build a Forester's Lodge.",
    page: "The great trees that were standing when you arrived can't be mined, burned or blown up. Your founder's chest holds logs and saplings to start with; Woodcutters in the towns sell more saplings and planks. Plant saplings of your own for wood, or build a Forester's Lodge on your land for a grove that regrows by itself.",
    when: ["hit:siege:old_*"],
    needs: "siege:old_oak_log",
  },

  // ---------------- Coin and trade ----------------
  {
    id: "regals", ch: "coin", title: "Regals",
    tip: "This is a Regal, the one coin of Aldmere. Picked up, coins are counted straight into your Regals.",
    page: "The §fRegal§r is the only coin in Aldmere, and it is backed by iron: one iron ingot is worth 8 Regals. A §fGold Regal§r is 64.\n\n"
      + "You earn Regals by holding sieges, killing warlords and bosses, doing jobs from the Town Board and selling goods to the traders in the towns. Emeralds are only a trade good now: the Moneyer buys them.\n\n"
      + "All your Regals are one sum. Coins you find are counted in the moment you pick them up, every shop takes from the sum and every reward adds to it, wherever you are. The §fRegals§r button on the Keep menu shows it.\n\n"
      + "The sum is kept in the §fRegal Safe§r in your vault, once you have one. A thief who breaks into your vault can rob it.",
    when: ["carry:siege:coin", "carry:siege:gold_coin"],
  },
  {
    id: "traders", ch: "coin", title: "Traders",
    tip: "Traders buy what their trade needs. Each has only so much appetite a day, and pays less once they've had plenty.",
    page: "Every town has traders: a farmer, woodcutter, quarryman, smith, fisher, hunter, herbalist and the Moneyer, and a Guild Factor with orders. Click one to sell to them or buy from them.\n\n"
      + "Prices differ from region to region. Each trader only wants so much a day: past that they pay less, and in the end they stop buying until tomorrow.\n\n"
      + "§fThe Moneyer§r buys iron ingots and emeralds. He takes every iron ingot you bring at full price, with no daily limit (iron golems never appear, so iron only comes from mining). He also trades metal up one step: 4 iron for a gold ingot, 8 gold for a diamond, 6 diamonds for a netherite scrap. It is dear, but anything can always be bought. Each region's Smith sells that region's Castle Guard armour, and reforges any armour you bring in that region's style.",
    when: ["talk:tag:siege_job"],
  },

  {
    id: "upkeep", ch: "coin", title: "Upkeep",
    tip: "Upkeep is paid at dawn: a sum for your town's size, a little for each building and a wage for each guard.",
    page: "A settlement costs Regals to keep. Each §fdawn§r you are in the world for, your upkeep is taken from your Regals and the screen says how much: §fUpkeep paid: 46 Regals§r.\n\n"
      + "It is a sum for your town's size (nothing for a Hamlet, 8 for a Town, 24 for a City, 48 for a Castle), 2 for every building that stands and 3 for every guard. A new settlement pays nothing until it has held its first siege (and never in its first three days), and days you are away are never charged.\n\n"
      + "If you can't pay it all, what you have is taken and the rest is forgiven. Nothing is ever knocked down. But until a dawn is paid in full, guards who fall are §fnot retrained§r: they wait at the Barracks.\n\n"
      + "The Regals leave the kingdom. If another player wears the Crown, a fifth of what you pay goes to them.",
    when: ["event:upkeepPaid"],
  },

  {
    id: "regional_armour", ch: "coin", title: "Regional armour",
    tip: "This armour is cut in a region's style. Any Smith can reforge your armour in his own region's look.",
    page: "Every region dresses its armour its own way: plain bright iron and a red surcoat in the Vale, blued steel and fur in Frostmarch, salt-bleached steel and sea-glass in Saltreach, smoke-dark steel and a face veil in the Emberwaste, blackened lamellar and a hood in Blackfen.\n\n"
      + "Iron, chainmail, diamond and netherite all come in every region's look. A regional piece protects exactly as much as the plain one: only the look changes.\n\n"
      + "§fAt a Smith:§r choose Reforge armour, and he reforges any piece you wear or carry in his region's style for a few Regals. It keeps its enchantments, its wear and its name. Armour trims come off in the forge.\n\n"
      + "§fAt a Workshop:§r the plain piece and that region's Castle Stone make a new regional piece (the Vale uses plain Castle Stone). The recipe book only lists the region you are standing in; walk into another region and its pieces show instead. You can still craft any region's piece by placing the items yourself.\n\n"
      + "Upgrading regional diamond to netherite at a smithing table keeps the region.",
    when: ["iron", "chainmail", "diamond", "netherite", "choirsteel"].flatMap((m) => ["vale", "frostmarch", "saltreach", "emberwaste", "blackfen"].map((r) => `carry:siege:${m}_${r}_*`)),
  },

  // ---------------- Roads, rails and horses ----------------
  {
    id: "steeds", ch: "travel", title: "Steeds",
    tip: "Use a Halter on a tamed horse to make it your steed. Sneak and click it with an empty hand to see its sheet.",
    page: "Use a §fHalter§r on a tamed horse and it becomes your §fsteed§r, keeping its speed, health, coat and gear. Or buy a regional foal at a Breeder's Post.\n\n"
      + "§fRiding levels it up§r (twice as fast while galloping). Each level gives a training point, and levels 5, 10, 15 and 20 give a perk point.\n"
      + "§fGallop:§r use a §fRiding Crop§r while riding. The bar above your hotbar is its stamina.\n"
      + "§fHorse Whistle:§r calls your horse from up to 64 blocks.\n"
      + "§fGear:§r use Horseshoes, a Saddle Kit or a Caparison (your banner colour) on your horse.\n\n"
      + "Sneak + click your horse with an empty hand to see its sheet. Only you and your allies can ride it.",
    when: ["carry:siege:halter", "talk:siege:steed", "carry:siege:riding_crop", "carry:siege:horse_whistle"],
  },
  {
    id: "stables", ch: "travel", title: "Stables and breeding",
    tip: "Click the Stables to train your horses, pick perks, breed and stable them.",
    page: "Place a §fStables§r on your land and click it: train Speed, Jump, Health and Stamina from 1 to 5, pick perks, breed two horses, stable horses you are not riding, and (at higher levels) revive a fallen horse.\n\n"
      + "Without Stables you can keep one horse. The Stables' three levels let you keep 3, 5 and then 8.",
    when: ["carry:siege:stables", "click:siege:stables"],
  },
  {
    id: "breeder", ch: "travel", title: "Breeder's Posts",
    tip: "A Breeder's Post sells foals of its region's breed.",
    page: "Breeder's Posts stand in the towns, at the breeder's yard. Each sells foals of its own region's breed (192 Regals, one every three days), and every region's horses are good at something different. A foal is yours from the start and grows up in a day; ride it to raise it.\n\nOr go without Regals: tame a wild horse and use a §fHalter§r on it.",
    when: ["click:hc:breeder_post"],
  },
  {
    id: "stations", ch: "travel", title: "Stations and carriages",
    tip: "Click a Station Post to call a carriage, pick where you're going, see the network map or send your horse ahead.",
    page: "Rails join the towns and settlements of Aldmere, all meeting at Kingsrest. Click a §fStation Post§r: call a carriage or a minecart, choose a destination (the bar shows the way and the distance while you ride), see the network map, or use the horse stalls to send your horse ahead.\n\n"
      + "Your settlement's own §fstation§r rises by itself at the Station Post near your plot when you claim it, and grows with your town.\n\n"
      + "§fTrain Carriage:§r a four-seat wagon. Click it to board and push forward to go. You can craft your own at the Siege Workshop; sneak + click yours with an empty hand to pack it up.",
    when: ["click:hc:station_post", "click:siege:rail_depot", "carry:siege:rail_depot", "carry:siege:train_carriage"],
  },
  {
    id: "trains", ch: "travel", title: "Trains and Track",
    tip: "Climb into the engine and hold forward to pull away, back to brake. Sneak and click a car with an empty hand to put the train away.",
    page: "§fTrack§r joins up by itself as you lay it: straight, diagonal, round bends and up slopes.\n\n"
      + "A §fTrain Engine§r and §fCoaches§r are made at the Siege Workshop from Bogies and a Boiler, and they are expensive. Place the engine on at least 8 blocks of track and a coach right behind it. Climb into the engine: hold forward to pull away and back to brake. Trains slow down for tight corners and take the look of the settlement they were put on the track in.\n\n"
      + "Sneak + click a car with an empty hand to put the whole train away.",
    when: ["carry:siege:track", "carry:siege:train_engine", "carry:siege:train_coach"],
    needs: "siege:track",
  },
  {
    id: "rail_lines", ch: "travel", title: "Laying the lines",
    tip: "",
    page: "The railway lines across Aldmere are planned already, but laid one stretch at a time. At a Station Post or Rail Depot, a settlement owner can §fExtend the line§r: buy the stretch of track to the next stop out from any stop they can already reach. The price is shown before you pay, and the track lays itself along the line while everyone is told.\n\n"
      + "Your settlement's own station rises by itself and is rebuilt bigger as you grow: a Halt, then a Station, a Junction and at last a Grand Station.",
    when: ["click:hc:station_post", "click:siege:rail_depot"],
    needs: "siege:track",
  },

  {
    id: "trade_routes", ch: "travel", title: "Trade Outposts and routes",
    tip: "Click the Trade Board to propose a standing trade. Keep your Exports barrel stocked and collect from Imports.",
    page: "Once your station is on the line and you own a Train Engine, you can build a §fTrade Outpost§r from the station menu. Inside are the §fTrade Board§r, an §fExports§r barrel and an §fImports§r barrel.\n\n"
      + "At the board, propose a §fstanding trade§r to any station your laid track reaches: what you send, what you get back, and how often (\"20 iron for 4 gold, every day\"). Both sides must accept the same terms; either can send a counteroffer. A new request shows above the Trade Board in the other settlement's colour.\n\n"
      + "Your train runs the route while you're away. Each run takes both loads out of both Exports at once and, after the trip, drops each in the other side's Imports. If either side is short, nothing leaves and the route pauses until it's refilled. After 3 days paused it goes dormant: refill it and press Resume.\n\n"
      + "The further apart the two stations are along the track, the longer each trip takes. Regions are strong in one thing and weak in another, so trading is how you get what your land is short of. Rival Lords and the towns trade too, and §fKingsrest§r buys any trade good for Regals at a set price. Your station grows with your settlement, and so do the routes it runs and what each run carries; §fGoods Wagons§r carry more.",
    when: ["click:siege:trade_board"],
    needs: "siege:trade_board",
  },
  {
    id: "trade_specials", ch: "travel", title: "Special Offers and trading in person",
    page: "§fSpecial Offers:§r at the board, choose Create Special Offer, pick a good and how many, and you'll see what that amount is worth at the normal rate. Name your price (at least that much) and post it: the Regals are held until it's filled, and the Crier spreads the word. Anyone your track reaches can fill it from their Exports by train, and towns and lords fill offers that are worth their while. Whatever isn't filled within 3 days comes back to you.\n\n"
      + "§fDeliver in person:§r walk up to another settlement's Trade Board with the goods and click it to see their Special Offers. Hand the goods over from your pack and you're paid on the spot; they go straight into that settlement's Imports. No track needed, and they don't have to be online.",
    when: ["click:siege:trade_board"],
    needs: "siege:trade_board",
  },

  // ---------------- Growing stronger ----------------
  {
    id: "skill_points", ch: "growth", title: "Renown and skill points",
    tip: "You earned a skill point. Spend it at the Tree of Oaths in your town hall.",
    page: "§fRenown§r (levels 1 to 50) comes from almost everything you do: fighting, holding sieges, growing your settlement.\n\n"
      + "§fSkill points§r come from the first time you kill each kind of creature, every siege you hold, each time your settlement grows, warlords, bosses, finished book collections and every third Town Board job.\n\n"
      + "Spend them at the §fTree of Oaths§r in your town hall (or from the Keep menu once you have a hall). Deeper rings of the tree open as your hall grows and your Renown rises.",
    when: ["event:siegeReward", "event:tierUp"],
  },
  {
    id: "tree", ch: "growth", title: "The Tree of Oaths",
    tip: "The Tree of Oaths: spend skill points here. Its deeper rings open as your hall grows.",
    page: "Click the Tree of Oaths in your town hall to swear skills. Two branches are open to everyone: §fKeep§r (your settlement and guards) and §fWayfarer§r (travel and survival). Others belong to a path or a role.\n\n"
      + "Each skill shows what it does before you swear it. Skills you can afford now are lit. If the picture screen ever gives you trouble, switch to plain lists on its first page.",
    when: ["click:siege:tree_of_oaths"],
  },
  {
    id: "letters", ch: "start", title: "Letters by messenger",
    tip: "To send another player a private letter, type /siege:messenger. A messenger carries it to them.",
    page: "Type §f/siege:messenger§r (or choose §fSend a messenger§r in the Keep menu). Pick who it is for, write up to 240 letters, and send it.\n\n"
      + "A messenger rides off with it. It takes a couple of minutes to arrive: a minute and a half next door, up to three minutes across the map. While it is on the road, a small countdown above your hotbar says §fYour message is being delivered§r. When it reaches zero they get it in chat, and you are told it arrived.\n\n"
      + "If they are away, the messenger waits and hands it over when they come back. You can have three letters on the road at once.",
    when: ["event:joined"],
  },
  {
    id: "crier", ch: "start", title: "The Crier: news in chat",
    tip: "Lines marked [Crier] are news from across the realm.",
    page: "Big moments are read out to everyone in chat, marked §6[Crier]§r. You hear about a boss waking and who stands against it, a boss throwing its challengers back, a new settlement, a newcomer, a plot claimed, a wall going up, a station joining the rails, a lord being called out, a feud ending, a dragon bonding or dying, a settlement\'s first train, a settlement holding 3, 5, 10 or more siege nights in a row (or losing a long streak), a special offer posted at a Trade Outpost, a mystery solved, and anyone falling to a boss, a creature of the wild or another player out on the road.\n\n"
      + "The Crier never tells anyone that a settlement is under attack. Only its keeper hears that, and only by Messenger (see §fNews from home§r).",
    when: ["event:joined"],
  },
  {
    id: "messenger", ch: "keep", title: "News from home: the Messenger",
    tip: "Away from home, you hear nothing of attacks on your settlement. The Messenger, on the Tree of Oaths, changes that.",
    page: "When you are away from your own land, nobody tells you your settlement is being attacked. You find out when you get back: the moment you step onto your land, you hear everything that happened while you were gone.\n\n"
      + "Get a §fMessenger§r and that changes. Open the Tree of Oaths, choose the §fKeep§r branch and pick §fMessenger§r (first ring, needs a Longhouse). Swear it for §f1 skill point§r, or pay §f100 Regals§r instead. Regals paid stay paid: unbinding your oaths keeps the Messenger and gives no points back for it.\n\n"
      + "From then on, the moment anyone attacks your settlement (a player hitting your walls, guards or people, raiders marching on your keep, a rival lord's raid, someone breaking into your vault) a messenger rides up wherever you are. They tell you what is happening and which way home lies. If you were offline, a messenger is waiting when you come back.",
    when: ["click:siege:tree_of_oaths", "event:keepFounded"],
  },
  {
    id: "ember", ch: "growth", title: "The pale fire and the two paths",
    tip: "Something fell near your keep. Pick it up and read the Almanac before you use it: what you choose is hard to undo.",
    page: "After your first siege held, a shard of pale fire falls near your keep. It is a choice.\n\n"
      + "§fUse it§r and you are §fMarked§r: powers that come from somewhere else, and a Resonance that rises as you use them and makes you loud to things that listen.\n\n"
      + "§fCarry it to the Tree of Oaths§r and you can give it up instead and swear the §fSquire's Oath§r to the Order of the Ashen Gate: steel, shield, horse and command.\n\n"
      + "The Tree of Oaths explains both before you commit. Take your time: you can carry the shard as long as you like.",
    when: ["event:emberFell", "carry:siege:hollow_ember"],
    hidden: true,
  },
  {
    id: "spellbar", ch: "growth", title: "Casting with the Bound Ember",
    tip: "Use the Bound Ember to swap your hotbar for your powers. Use it again to swap back.",
    page: "§fUse the Bound Ember§r and your hotbar is put away safely: in its place come your powers, one icon each, with the Ember in the last slot.\n\n"
      + "§fScroll§r to a power and §fuse it§r to cast. The icon greys over while it cools down, and the bar above shows your Resonance.\n\n"
      + "§fUse the Ember again§r (or sneak and use any power) and your own hotbar comes back exactly as it was. "
      + "If you die with your powers out, your things fall where you fell like anything else you carry. If you leave the world with them out, they come back when you return.\n\n"
      + "Learn powers at the Tree of Oaths, in the Arcana branch.",
    when: ["carry:siege:bound_ember", "use:siege:bound_ember"],
    hidden: true,
  },
  {
    id: "roles", ch: "growth", title: "Roles earned by deeds",
    tip: "A role has been offered to you. Read it at the Tree of Oaths before you take it.",
    page: "Some roles are not chosen but earned: something you did out in the world makes the offer. Each role has its own skills on the Tree of Oaths and its own story to follow.\n\n"
      + "An offer waits at the Tree of Oaths until you answer it.",
    when: ["event:roleOffered"],
    hidden: true,
  },
  {
    id: "rumors", ch: "growth", title: "The Town Board",
    tip: "Your hall has a Town Board: three notices a day from the people round about.",
    page: "Open the §fTown Board§r from your town hall menu. Three notices go up each day, each pinned there by someone you can go and find: a carter robbed on the road, a shepherd short of sheep, a boy who hasn't come home. Take one, go and talk to them, and the tracker shows you the way. Jobs pay Renown and coins, and every third job pays a skill point.\n\n"
      + "Every job can be done alone. The everyday ones come round again once you have done the rest of your region, and then the neighbouring regions send their notices too.",
    when: ["event:hallBuilt"],
  },
  {
    id: "looks", ch: "growth", title: "Your look",
    tip: "Click the Looking Glass to change how you look.",
    page: "You picked a look when you first arrived. To change it, click a §fLooking Glass§r or use the button on your Keep menu.",
    when: ["click:hc:looking_glass"],
  },

  // ---------------- Books and mysteries ----------------
  {
    id: "journal", ch: "lore", title: "The old journal",
    tip: "",
    page: "The journal in your pack is an ordinary book: use it to read it. Nothing is locked behind it, and you can leave it unread. If you lose it, a builder can give you another (/scriptevent siege:journal).",
    when: [],
  },
  {
    id: "tomes", ch: "lore", title: "Lore Tomes and Dusty Tomes",
    tip: "Use a Lore Tome to read it. Reading to the last page copies its clues into your Ledger.",
    page: "Aldmere's past is written in books scattered over the map. Some of them lie.\n\n"
      + "§fLore Tome:§r use it to read it. Reading to the last page copies its clues into your Ledger of Whispers.\n"
      + "§fDusty Tome:§r a book lying in the world. Click it for your own copy. Everyone gets their own copy, so nobody can strip the map.\n\n"
      + "Bosses drop a tome to everyone who fought, and some night creatures drop rare ones. Some books are written in ways you can't read yet.",
    when: ["carry:siege:lore_tome", "click:hc:tome_cache"],
  },
  {
    id: "library", ch: "lore", title: "Archive Shelves and your Library",
    tip: "Hold a tome and click an Archive Shelf to shelve it. Click with nothing in hand for the catalog and rewards.",
    page: "Craft §fArchive Shelves§r at the Siege Workshop. Hold a tome and click a shelf to shelve it (six to a shelf). Click a shelf with nothing in hand for the §fcatalog§r: read anything shelved, see hints for what's missing, take books back and claim rewards.\n\n"
      + "Finishing a collection (and having read it) gives skill points and something more. The Library itself gives things as it grows past 5, 10, 25, 40, 60 and every book. Breaking a shelf spills its tomes.",
    when: ["carry:siege:archive_shelf", "click:siege:archive_shelf"],
  },
  {
    id: "ledger", ch: "lore", title: "The Ledger of Whispers",
    tip: "The Ledger keeps your clues and mysteries. When you have enough clues, you can answer a mystery in it.",
    page: "Your notebook. Each mystery fills up with clues word for word as you read and hear them, and keeps your leads. When you think you know, answer it in the Ledger. Some answers have to be typed.\n\n"
      + "A wrong answer closes that mystery for a day, so be sure.",
    when: ["carry:siege:ledger"],
  },
  {
    id: "ciphers", ch: "lore", title: "Books you can't read",
    tip: "Carry this while you read and some books will make sense.",
    page: "Some books are in cipher and some are written backwards. Carry the right tool while you read them: a §fCipher Wheel§r for one kind, §fTide Glass§r for the other. Your Library hands them over as it grows.",
    when: ["carry:siege:cipher_wheel", "carry:siege:mirror_glass"],
    hidden: true,
  },
  {
    id: "landmarks", ch: "lore", title: "Old things on the land",
    tip: "Something old stands here. Your settlement's local papers say what happened at it.",
    page: "Every plot has something old standing on it, out past where the settlement will grow: a cairn, a ring of posts, an empty bell frame, a ruined hall. They were here long before you, and each one is part of a mystery.\n\n"
      + "Your plot's §flocal papers§r tell its story. They turn up as your settlement grows: shelve them in your Library, then come back and look at the place again. The Ledger keeps the clues.",
    when: ["event:landmarkFound"],
  },
  {
    id: "people", ch: "lore", title: "People and portraits",
    tip: "People here remember what you have read and done. Come back later and they may say more.",
    page: "The people you meet in the towns speak for themselves, and what they say changes with what you have read, solved and become. Many will point you somewhere. Come back to them.\n\n"
      + "Click a portrait or painting to read about it. Every settlement's Library has portraits of the people who led it before you.",
    when: ["talk:tag:siege_lore_npc_*", "talk:siege:portrait"],
  },
  {
    id: "town_folk_streets", ch: "lore", title: "People in the streets",
    tip: "Townsfolk have five things to say each. Click again to hear the next.",
    page: "The people walking the streets of Kingsrest and the other towns will stop and talk if you click them. Each one has five things to say, and you hear them in order: click again for the next.\n\n"
      + "Some of it is gossip, some of it is nonsense, and some of it is worth remembering. They go indoors at night and are back in the morning.",
    when: ["talk:siege:townsfolk"],
  },

  // ---------------- The wild ----------------
  {
    id: "bodies", ch: "wild", title: "The fallen",
    tip: "Bodies lie where they fell while danger is near, then sink into the ground.",
    page: "Many creatures here don't vanish in smoke: they lie where they died. They stay while other monsters are close, then sink into the ground after a while. Ghosts leave nothing.",
    when: ["near:siege:body"],
  },
  {
    id: "weather", ch: "wild", title: "Weather",
    tip: "Every region has its own weather. Thick weather is easier to sit out under a roof.",
    page: "Each region has weather of its own, on top of the ordinary rain.\n\n"
      + "§fBlackfen:§r mist comes up off the water, most of all at dusk, at night and in the rain. Some nights small lights move out over the fen.\n"
      + "§fSaltreach:§r a hard wind off the sea carries spray inland, and at first light a white sea fret can roll in over the cliffs.\n"
      + "§fEmberwaste:§r the wind lifts the sand into a haze, and now and then into a sandstorm you can barely see through.\n"
      + "§fFrostmarch:§r snow blows down off the peaks, and blizzards close the passes, most of all when the sky is already snowing.\n"
      + "§fAldmere Vale:§r rain like anywhere else, and mist lying in the low ground some mornings.\n\n"
      + "Weather builds up slowly and thins out again after a few minutes. It is only weather: it doesn't hurt you. Under a roof it thins to a grey light, and down in a cave or cellar it can't reach you. Your action bar says when something is coming in.",
    when: ["event:weatherMet"],
  },
  {
    id: "beasts", ch: "wild", title: "Beasts and trophies",
    tip: "A trophy from this region's beasts. The Hunter buys them, and the Siege Workshop's recipe book knows other uses.",
    page: "Every region has its own beasts, and they leave trophies: wight dust, pale antlers, rime pelts, brine scales, wyrm scales, toad venom and more. The Hunter in the towns buys them, and some are worth far more made into something else. Look through the Siege Workshop's recipe book with one in your pack.",
    when: ["carry:siege:wight_dust", "carry:siege:pale_antler", "carry:siege:rime_pelt", "carry:siege:brine_scale", "carry:siege:wyrm_scale", "carry:siege:toad_venom"],
  },
  {
    id: "bosses", ch: "wild", title: "Calling a boss",
    tip: "This belongs somewhere. Something old in this region is waiting for it to be put back.",
    page: "Each region has something old in it, asleep in a place of its own, and a token that wakes it. The token is earned in that region, from the people and the stones there, and it goes back where it belongs: a lock, an altar, a cairn. Then whatever sleeps there comes out.\n\n"
      + "A boss gets half again as tough for each extra player in the fight, so it is fair alone and fair with friends. Watch for its warnings: every attack is shown before it lands.\n\n"
      + "Everyone who fought gets the boss's own relic the first time it falls (materials after that), skill points, and a share of the chest it leaves. The token stays where you put it. Once a siege night has passed after a boss falls, touch it again and the boss comes back, in a different temper each time and a rank stronger (up to rank V): more health, harder hits, and from rank III two tempers at once. Every rematch leaves netherite scrap: 1 at ranks I and II, 2 at III and IV, 3 at V. There is no Nether here, so this is where netherite comes from.",
    when: ["carry:siege:stopped_clock_key", "carry:siege:pale_horn", "carry:siege:drowned_ring", "carry:siege:faceless_seal", "carry:siege:mire_effigy"],
    hidden: true,
  },
  {
    id: "guild", ch: "coin", title: "The Guild Factor",
    tip: "The Guild Factor posts three orders a day for goods from other regions, and pays in metal.",
    page: "Every town has a §fGuild Factor§r. Click one for today's three orders: goods this region can't make for itself, from three other regions (pumpkins from the Vale, raw iron from the north, gold from the Emberwaste, slime from the fens and so on).\n\n"
      + "Bring the goods and you are paid in §fmetal§r: iron, gold, and on big orders a diamond or two. It pays far better than trading metal up at the Moneyer, so carrying your region's goods to another town is the cheap way up the ladder. Each order can be filled once a day; new orders come at dawn.",
    when: ["talk:tag:siege_job_factor", "event:guildOrderFilled"],
  },
  {
    id: "ironworks", ch: "growth", title: "The Ironworks",
    tip: "An Ironworks. Click it for its storeroom, its charcoal and its next stage.",
    page: "Your town has a §fWorks plot§r: a big plot kept for a works. Use its marker and pick the §fIronworks§r (160 Regals). The whole plot is fenced, an §fOre Pit§r is dug, and its worker digs about 16 raw iron a day into the storeroom. Click the §fIronworks block§r in the yard to take it. You choose the plot; the works builds itself.\n\n"
      + "Once you are a §fTown§r, build the §fBloomery§r (384 Regals) from the block: it rises on the same plot and smelts for you, about 40 iron ingots a day, burning one charcoal for every 4 ingots. Feed it from the block's menu; charcoal comes from burning logs, so a tree farm keeps it going. With no charcoal it only digs raw ore.\n\n"
      + "Once you are a §fCity§r, with water by the plot, build the §fTrip-Hammer Forge§r (1,280 Regals): a waterwheel and hammer, about 100 ingots a day.\n\n"
      + "§8An older town with no Works plot: craft the Ironworks at the Siege Workshop and place it on your land instead.§r\n\n"
      + "The storeroom holds three days of work, then the workers wait for you. A siege that goes badly lets raiders carry off part of it. Where you live matters: Saltreach sits on rich iron and digs twice as fast, while Frostmarch's iron is poor (a quarter speed), so Frostmarch towns trade for it.",
    when: ["place:siege:ironworks", "carry:siege:ironworks", "click:siege:ironworks"],
    needs: "siege:ironworks",
  },
  {
    id: "vault", ch: "growth", title: "The Vault",
    tip: "The Vault Key. Use it on the ground where your vault's stairs should start.",
    page: "Your relics are safest in a §fvault§r. Open the Town Hall menu and choose §fVault§r, then §fAdd Vault§r: it costs 64 planks and 32 cobbled deepslate and gives you the §fVault Key§r.\n\n"
      + "Walk to where the stairs should start on your own land, face the way they should go down, and use the key on the ground. Stairs are carved down to an entrance hall and a §fWooden Strongroom§r with a 3x3 vault door. The §fVault Lock§r is in the wall beside the door.\n\n"
      + "Click the lock with the key and the door swings open; click it again to shut it. You and your allies open it with any Vault Key, but a key is cut for one vault, and anyone holding a key cut for yours can open it too. Keep yours safe. Spare keys come from the same menu.\n\n"
      + "Inside, hold a relic and click one of the plinths at the back: it comes to rest floating over it. Click it to take it again. Whoever gets into your vault can take it too.\n\n"
      + "To make it stronger, click the lock with the next material: an iron ingot (Iron Strongroom), then a diamond, a netherite ingot and a Choirsteel ingot. Confirm the cost and the room is rebuilt bigger around you, with a tougher door. Take your things out of the barrels first; relics on their stands move with the room.",
    when: ["carry:siege:vault_key", "event:vaultBuilt"],
  },
  {
    id: "vault_break", ch: "growth", title: "Breaking into a vault",
    tip: "A Vault Breaker. Set it right against a Vault Lock.",
    page: "Thieves break in with a §fVault Breaker§r (made at the Siege Workshop) set right against the lock: it chews through it, faster the better the breaker and slower the stronger the vault, and only while you are online (or in a War Writ siege). You are told the moment one starts. When the lock gives, the door falls with it. Mend a cracked lock or door by clicking it with the vault's material (planks, iron, diamond, netherite, Choirsteel); if the door falls, rebuild it from the Vault menu.\n\n"
      + "Stay away a full real day while your vault holds a relic (or you carry one) and it §flies open§r: twice a day, at random times, for half an hour, anyone may break in without you. Everyone is told when it opens. While a window is open your walls can be breached as if you were here, but they, your vault and Keep take twice the blows and your guards fight harder. The rest of the time an away settlement stays untouchable. Log in, even for a moment, and the day starts again.",
    when: ["carry:siege:vault_breaker_iron", "carry:siege:vault_breaker_diamond", "carry:siege:vault_breaker_netherite", "event:vaultDrilled", "event:vaultWindow"],
  },
  {
    id: "warwrit", ch: "keep", title: "War Writs",
    tip: "Click another settlement's Keep Banner to declare war on it, or send a demand.",
    page: "To besiege another player, click their §fKeep Banner§r and choose §fDeclare war§r. Grounds: they hold a relic, attacked your settlement in the last few days, refused your demand, or are an §fOathbreaker§r. A War Writ costs 320 Regals and the whole server is told.\n\n"
      + "§fNo grounds?§r You can still declare, but it is an unjust war: it costs three times as much, their defences are twice as strong, and you are an Oathbreaker for three days, whom anyone may declare war on.\n\n"
      + "§fYour army:§r when you declare, a slider picks how much of your army rides with you (none, a quarter, half, three quarters or all); the rest guard home. They follow you on horseback until the siege ends, round water by the nearest bridge, get off their horses near the enemy and gather at their gate. Siege crews bring their own engines: trebuchets widen one hole by their vault, rams take the gate, Sappers plant charges.\n"
      + "§fMuster:§r their gates shut at once. The assault comes at the next nightfall, at least three minutes away.\n"
      + "§fAssault:§r one night, to dawn, whether or not they are online. Their walls, vault and Regal Safe can be broken, and their guards go for you. Their Keep Banner can't be taken.\n"
      + "§fWinning:§r crack their vault before dawn and you win; the vault stays open to you until dawn. If dawn comes first, they win. Either way the win counts towards growing your settlement, and there is peace between you for three days.\n\n"
      + "§fSend a demand§r asks them for a tenth of their Regals. If they pay, there is peace. If they refuse, or say nothing for a real day, you have grounds.\n\n"
      + "If war is declared on you, answer demands and see every siege from your own Keep Banner menu.",
    when: ["event:writDeclared", "event:demandSent"],
  },
  {
    id: "vault_safe", ch: "growth", title: "The Regal Safe",
    tip: "The Regal Safe holds all your Regals. A thief breaks it open a blow at a time.",
    page: "Every vault has a §fRegal Safe§r just inside the door, two blocks wide and three high. All your Regals are kept in it: there is nothing to put in or take out, it is simply where your one sum can be stolen. Click it to see how much you have.\n\n"
      + "A thief who gets into your vault can hit it. Every blow knocks loose a share of what is inside and shows how much; the last blow breaks it open and they take the rest. A wooden vault's safe gives in after 10 blows, a Choirsteel vault's after 70, and each blow takes a smaller share the better the vault. You are told the moment someone starts, and when a safe is broken open the whole server hears who did it.\n\n"
      + "Click a broken safe to hammer it straight and lock it again.",
    when: ["click:siege:regal_safe", "event:safeBroken"],
  },
  {
    id: "workings", ch: "wild", title: "Old Workings",
    tip: "An Old Working: dig the ore out of its walls. It grows back in a few days.",
    page: "Five settlements have one of the old king's mines just outside their land, and it is their strength: §firon§r at Frosthelm and Gullcliff, §fgold§r at Redmesa and Dunehold, §fdiamond§r in the Wolfcairn Deeps. Follow the timbered stair down to the stone chamber and dig the ore out of its walls.\n\n"
      + "The ore grows back: iron every day, gold every two days, diamond every three, as long as nobody is down there. Each week one Working runs rich, with more ore and more of the best kind; word of it goes round at dawn.\n\n"
      + "The deeper ones draw §cclaim jumpers§r: a band comes down the stair while you dig. Beat them and they hand over what they took. The deeper the Working, the further down and the more often they come.",
    when: ["event:workingEntered"],
  },
  {
    id: "plot_caves", ch: "wild", title: "Your mine",
    tip: "Your plot's mine. Dig what you like: tonight the cave puts itself back, with the ore in new places.",
    page: "Every plot has a §fmine shaft§r out past its wall, with a headframe over it and a ladder down to a cave. Dig anything down there, ore and stone alike.\n\n"
      + "Each night, while nobody is inside, the cave goes back to the shape it had, and the ore comes back §fsomewhere else§r. So it is never in the same place two days running. A Hamlet's mine has about §f12 iron§r a night, with coal and copper.\n\n"
      + "The deeper levels are behind §fcave-ins§r. Each time your settlement grows (Town, City, Castle), the next cave-in comes down and a deeper level opens, with more iron. Gold starts at City, and diamonds lie in the deepest level at Castle.",
    when: ["event:plotCaveEntered"],
  },
  {
    id: "seeps", ch: "wild", title: "Seeps",
    tip: "A Seep. Kill what guards it, then break it, or it will widen.",
    page: "Now and then a §fSeep§r opens in the ground near someone. Things climb out of it and guard it. Kill them, then break the Seep to close it.\n\n"
      + "Left alone, a Seep widens through three sizes and then splits in two. Not every Seep behaves the same way.",
    when: ["near:siege:seep"],
    hidden: true,
  },
  {
    id: "vigil", ch: "wild", title: "The Stone Vigil",
    tip: "Keep your eyes on it.",
    page: "A winged stone figure. It is only a statue while someone is looking at it, and only a pickaxe will chip it. It moves when nobody is watching, and its touch throws you somewhere nearby in the dark.",
    when: ["near:siege:stone_vigil"],
    hidden: true,
  },
  {
    id: "dragons", ch: "wild", title: "Dragons",
    tip: "Set a Dragon Egg in a Hatching Brazier in your Dragon Stable's nursery. It hatches in two days.",
    page: "Dragons live only in the Emberwaste, and only people who settle there can raise one.\n\n"
      + "§fThe egg:§r wild dragons build great nests of woven branches and bones out in the Emberwaste. Climb in and take an egg from the clutch. Place a §fDragon Roost§r on your land and a §fDragon Stable§r rises behind it, with a nursery of §fHatching Braziers§r: set the egg in one. It hatches in two days, and you see it crack before it does.\n"
      + "§fRaising it:§r feed it raw meat or fish and spend time with it to build its bond. A fledgling can carry you on foot with a Dragon Saddle; a grown dragon flies.\n"
      + "§fHandling:§r an empty hand always pets it. Click a saddled dragon holding any item to climb on. Sneak + click with an empty hand for its sheet. Spend its training points at the Roost.\n\n"
      + "Flights are short bursts. Ballistas and archers of settlements that aren't yours can shoot a dragon down, and a dragon that dies is gone for good. On a siege night no dragon will fly from three until half past three in the morning: she lands and waits it out.",
    when: ["click:hc:dragon_nest", "carry:siege:dragon_egg", "carry:siege:dragon_roost", "click:siege:hatching_brazier"],
    hidden: true,
  },
  {
    id: "lords", ch: "wild", title: "Rival Lords",
    tip: "A Rival Lord. Click them to trade, send gifts, swear oaths, or lay siege to their settlement.",
    page: "Plots nobody has claimed are held by §fRival Lords§r: they build, grow and have tempers of their own. Every couple of days one of them does something: marches on someone, demands tribute, sends a gift, offers a truce, feuds with another lord.\n\n"
      + "Click a lord to trade, send gifts, swear a truce or alliance, pay or refuse tribute, or back them in a feud. A lord's march joins the next siege night.\n\n"
      + "§fLaying siege:§r talk to the lord and choose to besiege them. Kill all their soldiers in 10 minutes and the lord falls: their plot is free, with everything they built.",
    when: ["talk:tag:siege_rival"],
  },

  // ---------------- Beyond the seam (only once a player has been there) ----------------
  {
    id: "hollow", ch: "beyond", title: "The Hollow",
    tip: "You are in the Hollow. Read the Almanac's new chapter before you go far.",
    page: "The Hollow is a world of its own, not a copy of yours. Its rivers glow and join up; follow them. The miners' villages are safe ground.\n\n"
      + "Gloamwings leave a visitor alone for about five minutes. Then one comes, and another every two minutes after, up to six. Leaving the Hollow calls them off, and they don't hunt in the villages.",
    when: ["event:hollowEntered"],
    hidden: true,
  },
  {
    id: "choir_ore", ch: "beyond", title: "Choir Ore and who owns it",
    tip: "Whoever rules here is told the moment you start mining Choir Ore, and can come straight to you.",
    page: "§fChoir Ore§r is found only in the Hollow's cliff faces, more of it deeper in. It is slow to mine (a diamond or netherite pickaxe helps) and smelts into §fChoirsteel§r.\n\n"
      + "It belongs to whoever rules the Hollow. The moment anyone starts mining it, the ruler is told who and where, and has a minute to come straight to them from anywhere. The ruler can grant leave to mine for a share of what you dig, at whatever price they set. While the ruler is offline the ore yields half.\n\n"
      + "When the Hollow's own regent rules, or the ruler is away, its guardians answer instead.",
    when: ["carry:siege:raw_choir_ore", "hit:siege:choir_ore"],
    hidden: true,
  },
  {
    id: "villages", ch: "beyond", title: "The mining villages",
    tip: "The Foreman keeps the village's Tally of ore. You can buy from it.",
    page: "Four mining villages stand along the way: Glimwade, Lowseam, Tollrest and Highcut. Each Foreman keeps a §fTally§r of ore dug every dawn, and half of it is carted to the Vault under the Seat.\n\n"
      + "Buy ore from a Foreman for coins, and a §fLatticewood Boat§r: the glowing rivers reach every village and are the quickest way through.",
    when: ["talk:tag:siege_hollowfolk*", "carry:siege:lattice_boat"],
    hidden: true,
  },

  {
    id: "hollow_crown", ch: "beyond", title: "The Hollow Crown",
    tip: "You carry the Hollow Crown. If it is ever dropped, it rests on a floating stand: click the stand to take it.",
    page: "There is only one §fHollow Crown§r. It suffers no one but a Sorcerer: anyone else who puts it on is warned, then it kills them. A Sorcerer who keeps it on long enough rules the Hollow, and a blow from another player while they take it knocks it off.\n\n"
      + "Whenever the Crown is dropped, it comes to rest on a small §ffloating stand§r where it fell. The stand cannot be hurt or moved, and the Crown stays on it for as long as nobody takes it. §fClick the stand§r to take the Crown.\n\n"
      + "Dropped over lava or into the void, it has nowhere to rest, and goes back to its chest at the Seat.",
    when: ["carry:siege:hollow_crown"],
    hidden: true,
  },

  // ---------------- The High Throne (only once someone holds the Heart) ----------------
  {
    id: "throne", ch: "throne", title: "The Heart and the High Throne",
    tip: "Someone holds the Heart of the Hollow and rules from the High Throne. Read the Almanac's new chapter.",
    page: "Whoever holds the §fHeart of the Hollow§r rules Aldmere from the High Throne in their Citadel. Click the Throne to rule: decree a siege on a rival or peace for one, set a tithe on everyone else's siege winnings, take from the Treasury.\n\n"
      + "Raiders never march on the ruler, and the ruler keeps more guards. Decrees and tithes raise §fUnrest§r, which makes every rival's Claim grow faster. The ruler's allies are the Court: they can build in the Citadel and can't challenge.",
    when: ["event:crowned", "carry:siege:heart_of_the_hollow", "carry:siege:citadel_cornerstone"],
    hidden: true,
  },
  {
    id: "claim", ch: "throne", title: "Earning a Claim",
    tip: "An Oath Shard has fallen. Find it, mine it and use it to build your Claim to the throne.",
    page: "To challenge the ruler you need a full §fClaim§r of 100.\n\n"
      + "§fOath Shards:§r after every siege night one falls 150 to 400 blocks from the Citadel, and everyone is told which way. Mine it, then use it (+25). If the ruler or their Court uses one, it shatters.\n"
      + "Holding a siege (+5) and slaying a warlord (+10) also count.",
    when: ["event:shardfall", "carry:siege:crown_shard"],
    hidden: true,
  },
  {
    id: "storm", ch: "throne", title: "The Gauntlet and the Storm",
    tip: "Use the Gauntlet of Challenge to call the Storm on the ruler's Citadel.",
    page: "With a full Claim, craft a §fGauntlet of Challenge§r at the Siege Workshop and use it. A new ruler has three siege nights of grace first.\n\n"
      + "The §fStorm§r comes on the next siege night when both of you are online: break the Throne Seal in front of the throne before dawn. The challenger has 3 lives, and logging out for 2 minutes forfeits.\n\n"
      + "The loser is thrown out of the gate and marked an Exile for three siege nights; the winner takes the Heart, the Citadel and all of it. An Exile gets a long road back, shown on their Keep menu.",
    when: ["carry:siege:gauntlet_of_challenge"],
    hidden: true,
  },
];
