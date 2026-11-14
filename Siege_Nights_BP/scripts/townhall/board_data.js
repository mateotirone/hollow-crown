// The Town Board's jobs, by hand (Mateo 2026-11-14: "rewrite the Town Board jobs as hand-written ones").
// Pure data, no Minecraft calls. The rules that pick and run them are board_rules.js; the game side is board.js.
//
// Every job is pinned up by a real person who stands somewhere in the world (GIVERS) and happens at a real, named
// place on the map (PLACES). Lines are written for that job and that person. Writing rules (checked by tests):
//   * offer, done and a notice for every job; an `again` line for every job that repeats; `at` for a Carry job's
//     recipient; `seen` for a Look job (what you find there).
//   * Townsfolk say nothing the street does not know (townsfolk/rules.js NEVER_SAID), and nobody names the other
//     world early (LORE-BIBLE "Keeping it secret").
//   * Ids are saved in players' board memory: never rename or reuse one. Add new jobs at the end of a region.
//
// Kinds (board_rules.js KINDS): hunt, camp, missing, supply, carry, escort, recover, look, watch.
// Hunt, Camp, Supply, Carry, Escort and Watch repeat once the region's pool has gone round once, with the `again`
// line; the rest are one-off, and so is every chain step and every story job.
//
// Fields
//   giver: a GIVERS key. place: a PLACES key. to: a GIVERS key (a Carry job's recipient).
//   about: what the tracker's "Talk to <giver> about <about>" names. thing: the letter, person or lost thing.
//   need: [at tier 0, at tier 4] (how many to kill, bring, or lamps/sheep to keep). mob / item: what to kill or bring.
//   find: the item a Carry or Recover job's `thing` is (a plain item, named with `thing`, so the job knows it).
//   when: { night, after: "siegeWon" | "town", notRaid } . site: a design key in board_sites_data.js.
//   foes: [[type, count at tier 0, count at tier 4, from tier]] for the people who come at you there.
//   keepsake: [item id, name, line] given once with the done line. chain: [chain id, step number from 1].
//   story: true for a Story Mode job (the story thread owns those lines).
//   animal: a Watch that keeps a flock (vanilla id without "minecraft:", stood on the site's "sheep" marks), not lamps.

export const REGIONS = ["Aldmere Vale", "Frostmarch", "Saltreach", "Emberwaste", "Blackfen"];

// Which regions border which (the map: the Vale is in the middle and touches all four)
export const NEIGHBOURS = {
  "Aldmere Vale": ["Frostmarch", "Saltreach", "Emberwaste", "Blackfen"],
  Frostmarch: ["Aldmere Vale", "Saltreach", "Emberwaste"],
  Saltreach: ["Aldmere Vale", "Frostmarch", "Blackfen"],
  Emberwaste: ["Aldmere Vale", "Frostmarch", "Blackfen"],
  Blackfen: ["Aldmere Vale", "Saltreach", "Emberwaste"],
};

// Who pins notices up. kind "folk": a townsperson of townsfolk/data.js (found by name in that town).
// kind "trader": a town's job NPC (economy/config.js TOWNS, entity siege:job_npc, tags siege_job_<job> + siege_town_<town>).
export const GIVERS = {
  osgood: { kind: "folk", town: "Kingsrest", name: "Osgood Fairweather", trade: "retired soldier" },
  aldo: { kind: "folk", town: "Kingsrest", name: "Aldo Brack", trade: "carter" },
  marta: { kind: "folk", town: "Kingsrest", name: "Marta Thistle", trade: "baker" },
  tobias: { kind: "folk", town: "Kingsrest", name: "Tobias Fennimore", trade: "clerk of the market" },
  nan: { kind: "folk", town: "Kingsrest", name: "Nan Pellow", trade: "old gossip" },
  ames: { kind: "folk", town: "Kingsrest", name: "Goodwife Ames", trade: "herb seller" },
  constance: { kind: "folk", town: "Kingsrest", name: "Constance Reed", trade: "schoolmistress" },
  joan: { kind: "folk", town: "Kingsrest", name: "Joan Croft", trade: "washerwoman" },
  bartholomew: { kind: "folk", town: "Kingsrest", name: "Bartholomew Pike", trade: "fishmonger" },
  will: { kind: "folk", town: "Kingsrest", name: "Will Cotter", trade: "thatcher" },
  ralf: { kind: "folk", town: "Kingsrest", name: "Ralf Hedger", trade: "hedge-cutter" },
  piers: { kind: "folk", town: "Kingsrest", name: "Piers Hallam", trade: "lamplighter" },
  lettice: { kind: "folk", town: "Kingsrest", name: "Lettice Mayhew", trade: "seamstress" },
  jonas: { kind: "folk", town: "Millbrook", name: "Jonas Miller", trade: "miller" },
  robin: { kind: "folk", town: "Millbrook", name: "Robin Askew", trade: "clockmaker" },
  abel: { kind: "folk", town: "Millbrook", name: "Abel Crane", trade: "shepherd" },
  bryony: { kind: "folk", town: "Millbrook", name: "Bryony Ward", trade: "midwife" },
  harlan: { kind: "folk", town: "Millbrook", name: "Harlan Voss", trade: "blacksmith" },
  // Act 2's first job (story thread): Tobin, the cart family's father, at the player's own Longhouse (newplayer/family.js;
  // the lore NPC carries siege_lore_npc_tobin). Not in a town, so the story pins him.
  tobin: { kind: "story", tag: "siege_lore_npc_tobin", where: "your Longhouse", name: "Tobin", trade: "thatcher" },
  kingsrest_hunter: { kind: "trader", town: "Kingsrest", job: "hunter", name: "the Kingsrest hunter", trade: "hunter" },
  kingsrest_smith: { kind: "trader", town: "Kingsrest", job: "smith", name: "the Kingsrest smith", trade: "smith" },
  kingsrest_farmer: { kind: "trader", town: "Kingsrest", job: "farmer", name: "the Kingsrest farmer", trade: "farmer" },
  kingsrest_factor: { kind: "trader", town: "Kingsrest", job: "factor", name: "the Kingsrest factor", trade: "factor" },
  millbrook_woodcutter: { kind: "trader", town: "Millbrook", job: "woodcutter", name: "the Millbrook woodcutter", trade: "woodcutter" },
  daisy: { kind: "folk", town: "Kingsrest", name: "Daisy Wickham", trade: "milkmaid" },
  // Frostmarch: Rimehold
  bjorna: { kind: "folk", town: "Rimehold", name: "Bjorna Eld", trade: "ice-cutter" },
  hakon: { kind: "folk", town: "Rimehold", name: "Hakon Grimmel", trade: "furrier" },
  ulfa: { kind: "folk", town: "Rimehold", name: "Ulfa Strand", trade: "fishwife" },
  torvald: { kind: "folk", town: "Rimehold", name: "Torvald Ness", trade: "quarryman" },
  sif: { kind: "folk", town: "Rimehold", name: "Sif Arnsdottir", trade: "weaver" },
  gunnar: { kind: "folk", town: "Rimehold", name: "Gunnar Rask", trade: "woodsman" },
  inga: { kind: "folk", town: "Rimehold", name: "Inga Vale", trade: "innkeeper" },
  olaf: { kind: "folk", town: "Rimehold", name: "Olaf Brenn", trade: "sledwright" },
  astrid: { kind: "folk", town: "Rimehold", name: "Astrid Holm", trade: "herder" },
  erik: { kind: "folk", town: "Rimehold", name: "Erik the Mute", trade: "bellmaker" },
  rimehold_hunter: { kind: "trader", town: "Rimehold", job: "hunter", name: "the Rimehold hunter", trade: "hunter" },
  rimehold_smith: { kind: "trader", town: "Rimehold", job: "smith", name: "the Rimehold smith", trade: "smith" },
  rimehold_quarryman: { kind: "trader", town: "Rimehold", job: "quarryman", name: "the Rimehold quarry foreman", trade: "quarryman" },
  rimehold_farmer: { kind: "trader", town: "Rimehold", job: "farmer", name: "the Rimehold farmer", trade: "farmer" },
  rimehold_factor: { kind: "trader", town: "Rimehold", job: "factor", name: "the Rimehold factor", trade: "factor" },
  // Saltreach: Gull's Rest
  morrow: { kind: "folk", town: "Gull's Rest", name: "Captain Morrow Teague", trade: "old sea dog" },
  nella: { kind: "folk", town: "Gull's Rest", name: "Nella Marsh", trade: "net-mender" },
  fergus: { kind: "folk", town: "Gull's Rest", name: "Fergus Kell", trade: "fisherman" },
  morwen: { kind: "folk", town: "Gull's Rest", name: "Morwen Gannet", trade: "salt-panner" },
  rosalind: { kind: "folk", town: "Gull's Rest", name: "Rosalind Pryce", trade: "fishwife" },
  dafydd: { kind: "folk", town: "Gull's Rest", name: "Dafydd Brine", trade: "cooper" },
  maren: { kind: "folk", town: "Gull's Rest", name: "Maren Coyle", trade: "lace-maker" },
  silas: { kind: "folk", town: "Gull's Rest", name: "Silas Whitlock", trade: "harbour watchman" },
  ottery: { kind: "folk", town: "Gull's Rest", name: "Grandma Ottery", trade: "shell seller" },
  gulls_farmer: { kind: "trader", town: "Gull's Rest", job: "farmer", name: "the Gull's Rest farmer", trade: "farmer" },
  gulls_factor: { kind: "trader", town: "Gull's Rest", job: "factor", name: "the Gull's Rest factor", trade: "factor" },
  gulls_smith: { kind: "trader", town: "Gull's Rest", job: "smith", name: "the Gull's Rest smith", trade: "smith" },
  // Emberwaste: Sunscar
  kadir: { kind: "folk", town: "Sunscar", name: "Kadir Oss", trade: "water-seller" },
  zara: { kind: "folk", town: "Sunscar", name: "Zara Merrow", trade: "potter" },
  haroun: { kind: "folk", town: "Sunscar", name: "Haroun Dast", trade: "caravan master" },
  leyla: { kind: "folk", town: "Sunscar", name: "Leyla Fenn", trade: "spice seller" },
  bashir: { kind: "folk", town: "Sunscar", name: "Bashir Kolt", trade: "stonecutter" },
  amira: { kind: "folk", town: "Sunscar", name: "Amira Sol", trade: "weaver of rugs" },
  jabir: { kind: "folk", town: "Sunscar", name: "Old Jabir", trade: "fortune-teller" },
  tariq: { kind: "folk", town: "Sunscar", name: "Tariq Vell", trade: "guard" },
  nadia: { kind: "folk", town: "Sunscar", name: "Nadia Ember", trade: "glassblower" },
  yusuf: { kind: "folk", town: "Sunscar", name: "Yusuf Rahl", trade: "date farmer" },
  sunscar_hunter: { kind: "trader", town: "Sunscar", job: "hunter", name: "the Sunscar hunter", trade: "hunter" },
  sunscar_quarryman: { kind: "trader", town: "Sunscar", job: "quarryman", name: "the Sunscar quarryman", trade: "quarryman" },
  sunscar_smith: { kind: "trader", town: "Sunscar", job: "smith", name: "the Sunscar smith", trade: "smith" },
  sunscar_farmer: { kind: "trader", town: "Sunscar", job: "farmer", name: "the Sunscar farmer", trade: "farmer" },
  sunscar_factor: { kind: "trader", town: "Sunscar", job: "factor", name: "the Sunscar factor", trade: "factor" },
  // Blackfen: Mirelight
  gideon: { kind: "folk", town: "Mirelight", name: "Gideon Reedly", trade: "reed-cutter" },
  hester: { kind: "folk", town: "Mirelight", name: "Hester Mallow", trade: "eel-wife" },
  hal: { kind: "folk", town: "Mirelight", name: "Hal Toller", trade: "boatman" },
  wilma: { kind: "folk", town: "Mirelight", name: "Wilma Rush", trade: "basket-weaver" },
  rufus: { kind: "folk", town: "Mirelight", name: "Rufus Grimble", trade: "peat-digger" },
  moll: { kind: "folk", town: "Mirelight", name: "Moll Fenwick", trade: "herb-woman" },
  ambrose: { kind: "folk", town: "Mirelight", name: "Ambrose Croaker", trade: "frog-catcher" },
  gertie: { kind: "folk", town: "Mirelight", name: "Gertie Lantern", trade: "lantern-keeper" },
  wat_sedgely: { kind: "folk", town: "Mirelight", name: "Wat Sedgely", trade: "ferry-hand" },
  kit: { kind: "folk", town: "Mirelight", name: "Kit Hollin", trade: "mud-larker" },
  mirelight_hunter: { kind: "trader", town: "Mirelight", job: "hunter", name: "the Mirelight hunter", trade: "hunter" },
  mirelight_farmer: { kind: "trader", town: "Mirelight", job: "farmer", name: "the Mirelight farmer", trade: "farmer" },
  mirelight_factor: { kind: "trader", town: "Mirelight", job: "factor", name: "the Mirelight factor", trade: "factor" },
  mirelight_smith: { kind: "trader", town: "Mirelight", job: "smith", name: "the Mirelight smith", trade: "smith" },
  // the far ends of carries
  agnes: { kind: "folk", town: "Kingsrest", name: "Sister Agnes Thorne", trade: "Ashen Sister" },
  tilda: { kind: "folk", town: "Millbrook", name: "Old Tilda Fernsby", trade: "storyteller" },
};

// Named places on the map. x/z: the spot the pin and the light go on (and a site's centre). Places picked on the
// map's real ground (map heights 2026-11-14): fights stay 130+ blocks from every plot centre and out of every ward.
// alt: other spots near by that a repeat may use instead ([dx, dz] from x/z), so a repeat is never the same twice.
// town: a place in a town (the giver's own door); no site, no pin beyond the person.
export const PLACES = {
  crownhold_barrows: { region: "Aldmere Vale", name: "the Crownhold barrows", x: -300, z: -289, alt: [[18, 9], [-12, 16]] },
  carters_rest: { region: "Aldmere Vale", name: "Carter's Rest", x: -372, z: -387, alt: [[22, -16], [14, -26]] },
  oakwood_ride: { region: "Aldmere Vale", name: "the Oakwood ride", x: 101, z: -504, alt: [[-30, 6], [28, -4]] },
  greywater_meadows: { region: "Aldmere Vale", name: "the Greywater meadows", x: -23, z: -217, alt: [[40, -10], [-30, 12]] },
  old_mooring: { region: "Aldmere Vale", name: "the Old Mooring on Wren Water", x: -11, z: 243 },
  wrenfield_jetty: { region: "Aldmere Vale", name: "the old Wrenfield jetty", x: -130, z: 295 },
  crownhold_elm: { region: "Aldmere Vale", name: "the elm below Crownhold", x: -269, z: -273 },
  harrow_ferry: { region: "Aldmere Vale", name: "the Harrowford ferry post", x: -436, z: -215 },
  bellhollow_road: { region: "Aldmere Vale", name: "the Bellhollow road", x: 129, z: -28 },
  south_waystone: { region: "Aldmere Vale", name: "the waystone on the Wrenfield road", x: -116, z: 40 },
  millbrook_lamps: { region: "Aldmere Vale", name: "the Millbrook road lamps", x: -39, z: -297 },
  abels_fold: { region: "Aldmere Vale", name: "Abel's fold", x: 30, z: -561 },
  ravens_copse: { region: "Aldmere Vale", name: "the ravens' copse", x: -180, z: -509 },
  brackenfold: { region: "Aldmere Vale", name: "Brackenfold", x: 75, z: 6 },
  // The burned hamlets (one a region) the cart family comes from: Act 2's first board job, its lines and step written by
  // the story thread. Each has its site (board_sites.py <region>_burned_hamlet).
  kettlenes: { region: "Frostmarch", name: "Kettlenes", x: 249, z: -1128 },
  sandwick: { region: "Saltreach", name: "Sandwick", x: -608, z: 320 },
  thornwell: { region: "Emberwaste", name: "Thornwell", x: 999, z: 419 },
  rushby: { region: "Blackfen", name: "Rushby", x: -32, z: 647 },
  // Frostmarch (round Rimehold, -80 -1080; the lake east of it, the Deepforge road and the old watchtower south)
  hounds_back: { region: "Frostmarch", name: "the Hound's Back", x: -175, z: -1194, alt: [[20, 10], [-16, 14]] },
  sled_shed: { region: "Frostmarch", name: "Olaf's old sled-shed on the south road", x: -130, z: -1002, alt: [[-14, 18], [-20, -6]] },
  watchtower_pass: { region: "Frostmarch", name: "the pass below the old watchtower", x: -87, z: -736, alt: [[-20, 4], [6, 14]] },
  ice_landing: { region: "Frostmarch", name: "the ice-cutters' landing", x: 14, z: -1094, alt: [[-8, -30], [52, -71]] },
  ice_holes: { region: "Frostmarch", name: "the fishing holes on the west shore", x: 6, z: -1154 },
  west_shore: { region: "Frostmarch", name: "the far end of the lake", x: 147, z: -1134 },
  lake_ring: { region: "Frostmarch", name: "the north shore of the lake", x: 66, z: -1165 },
  lichen_rocks: { region: "Frostmarch", name: "the lichen rocks east of town", x: 61, z: -1073 },
  old_working: { region: "Frostmarch", name: "the old copper working on the Deepforge road", x: -212, z: -875 },
  black_ridge: { region: "Frostmarch", name: "the black spruces on the ridge", x: -277, z: -1200 },
  goat_path: { region: "Frostmarch", name: "the goat path above the lake", x: 100, z: -1179 },
  high_pasture: { region: "Frostmarch", name: "the high pasture", x: -277, z: -1097 },
  south_bothy: { region: "Frostmarch", name: "the shepherd's bothy on the south road", x: -107, z: -913 },
  // Saltreach (round Gull's Rest, -865 405; the Westwatch up the coast north, the bay road east, the dunes south)
  westwatch_camp: { region: "Saltreach", name: "the Westwatch", x: -818, z: 314, alt: [[16, -10], [20, 6]] },
  wreckers_strand: { region: "Saltreach", name: "Gannet Strand", x: -673, z: 245, alt: [[-24, 4], [10, 8]] },
  eel_rocks: { region: "Saltreach", name: "the Eel Rocks", x: -781, z: 254, alt: [[16, 2], [-14, 6]] },
  barley_strips: { region: "Saltreach", name: "the barley strips on the cliff road", x: -727, z: 407, alt: [[12, 30], [-10, -20]] },
  salt_pans: { region: "Saltreach", name: "the salt pans on the south flats", x: -705, z: 252 },
  cockle_bay: { region: "Saltreach", name: "the wreck in Cockle Bay", x: -749, z: 603 },
  bride_strand: { region: "Saltreach", name: "the strand below the dunes", x: -777, z: 548 },
  kingsmark_shingle: { region: "Saltreach", name: "the shingle north of the harbour", x: -828, z: 505 },
  annets_cave: { region: "Saltreach", name: "the strand where Annet walked", x: -578, z: 229 },
  gull_head: { region: "Saltreach", name: "Gull Head", x: -695, z: 399 },
  cliff_road: { region: "Saltreach", name: "the cliff road lamps", x: -725, z: 340 },
  cliff_road_way: { region: "Saltreach", name: "the cliff road", x: -725, z: 340 },
  dune_pasture: { region: "Saltreach", name: "the dune pasture", x: -618, z: 480 },
  // Emberwaste (round Sunscar, 850 450; the Cinder Roost cliff north, the caravan road south, the Red Wash west)
  caravan_road: { region: "Emberwaste", name: "the caravan road south of Sunscar", x: 882, z: 573, alt: [[9, 60], [-6, -20]] },
  caravanserai: { region: "Emberwaste", name: "the old caravanserai", x: 1060, z: 521, alt: [[0, -40], [0, 40]] },
  ash_pans: { region: "Emberwaste", name: "the Ash Pans", x: 793, z: 660, alt: [[20, 0], [-20, 10]] },
  deep_dunes: { region: "Emberwaste", name: "the deep dunes by the south wells", x: 828, z: 736, alt: [[24, 10], [-20, -8]] },
  mesa_foot: { region: "Emberwaste", name: "the foot of the mesa road", x: 718, z: 250, alt: [[-22, 2], [20, -10]] },
  red_wash: { region: "Emberwaste", name: "the clay bank in the Red Wash", x: 636, z: 574 },
  dry_well: { region: "Emberwaste", name: "the dry well east of town", x: 954, z: 594 },
  glass_flats: { region: "Emberwaste", name: "the glass flats", x: 944, z: 775 },
  dye_house: { region: "Emberwaste", name: "the ruined dye-house", x: 636, z: 653 },
  palm_lean: { region: "Emberwaste", name: "where the palms lean", x: 1060, z: 359 },
  cold_dune: { region: "Emberwaste", name: "the cold dune", x: 1029, z: 658 },
  well_house: { region: "Emberwaste", name: "the well-house on the north road", x: 811, z: 290 },
  oasis_pen: { region: "Emberwaste", name: "the goat pen at the south oasis", x: 895, z: 693 },
  // Blackfen (round Mirelight, -60 900; the peat cuttings north, the causeway west, the lantern boardwalks east)
  peat_cuttings: { region: "Blackfen", name: "the peat cuttings", x: -55, z: 729, alt: [[20, 0], [14, 14]] },
  causeway: { region: "Blackfen", name: "the old causeway", x: -125, z: 818, alt: [[-14, -20], [8, 18]] },
  toad_pools: { region: "Blackfen", name: "the toad pools", x: -189, z: 780, alt: [[10, 18], [-12, -14]] },
  drowned_alders: { region: "Blackfen", name: "the drowned alders", x: -189, z: 950, alt: [[14, 8], [-10, 14]] },
  east_boardwalk: { region: "Blackfen", name: "the eel weirs off the east boardwalk", x: 107, z: 905, alt: [[16, 6], [-14, 10]] },
  reed_bed: { region: "Blackfen", name: "the great reed bed", x: -189, z: 710 },
  willow_hummock: { region: "Blackfen", name: "the willow hummock", x: -51, z: 1016 },
  old_lantern_post: { region: "Blackfen", name: "the old lantern post", x: -239, z: 982 },
  deep_cutting: { region: "Blackfen", name: "the deep cutting", x: -237, z: 772 },
  fen_lights: { region: "Blackfen", name: "the open fen north-east of town", x: 56, z: 816 },
  toad_ring: { region: "Blackfen", name: "the round pool", x: 121, z: 816 },
  far_boardwalk: { region: "Blackfen", name: "the far boardwalk", x: 33, z: 893 },
  pig_hummock: { region: "Blackfen", name: "the pig hummock", x: 187, z: 848 },
};

// Names the tracker uses for what a job asks for
export const MOB_NAMES = {
  "siege:barrow_wight": "barrow wights", "siege:hollow_footman": "stray Tollmen", "siege:torchbearer": "Torchbearers",
  "siege:shieldwall_brute": "shieldwall brutes", "siege:rimewolf": "rimewolves", "siege:brine_lurker": "brine lurkers",
  "siege:ash_scarab": "ash scarabs", "siege:dune_wyrm": "dune wyrms", "siege:mire_toad": "mire toads", "siege:bog_hag": "bog hags",
};
export const ITEM_NAMES = {
  "minecraft:wheat": "wheat", "minecraft:white_wool": "white wool", "minecraft:coal": "coal", "minecraft:oak_log": "oak logs",
  "minecraft:iron_ingot": "iron ingots", "minecraft:string": "string", "minecraft:clay_ball": "clay", "minecraft:leather": "leather",
  "minecraft:glass_pane": "glass panes", "minecraft:bread": "bread",
};

const TOLLMEN = [["siege:hollow_footman", 3, 6], ["siege:shieldwall_brute", 0, 1, 2]];

export const JOBS = [
  // ---------------- Aldmere Vale (Mateo to approve: https://claude.ai/artifact/F2JLWPN5q2aPXM94ffk6oP) ----------------
  {
    id: "vale_wights", region: "Aldmere Vale", kind: "hunt", giver: "osgood", place: "crownhold_barrows", about: "the barrows",
    title: "Wights on the Crownhold road", mob: "siege:barrow_wight", need: [4, 8], when: { night: true }, site: "vale_barrows",
    lines: {
      notice: "Old soldier wants a younger arm. Ask for Osgood at the Kingsrest wall.",
      offer: "The barrows by the Crownhold road have opened. Not dug. Opened, from the inside. Knights in their grave-iron, walking the verge at night. I did thirty years on the walls and I'll not do a thirty-first. Put them back down for me.",
      while: ["Every hit they land, they heal. So don't let them land any."],
      done: "Back in the ground, then. Good. Somebody should write down who was buried there, so we know who to blame next time.",
      again: "They're up again on the Crownhold road. Same barrows. I'd say they've no manners, but they were knights.",
    },
  },
  {
    id: "vale_toll", region: "Aldmere Vale", kind: "camp", giver: "aldo", place: "carters_rest", about: "the toll",
    title: "The toll at Carter's Rest", foes: TOLLMEN, site: "vale_camp",
    lines: {
      notice: "Carter robbed on the Harrowford road. Will pay in Regals and in mule bites. Aldo Brack, Kingsrest.",
      offer: "They've put a camp in Carter's Rest, where we stop to water the mules. Took a toll off me, a crate and a half. Didn't want the money. Wanted the axle grease and the rope. Raiders that steal rope are building something, and I don't want to see what.",
      while: ["Smoke over the Harrowford road. That's them."],
      done: "Rope's back, grease is back, mule's still angry. That's as good as this road gets.",
      again: "They're back in Carter's Rest. Same fire-ring and all. You'd think they'd find their own clearing.",
    },
  },
  {
    id: "vale_ram", region: "Aldmere Vale", kind: "camp", giver: "millbrook_woodcutter", place: "oakwood_ride", about: "the felled oaks",
    title: "Felling in the Oakwood", foes: TOLLMEN, site: "vale_ram_camp",
    lines: {
      notice: "Someone is cutting Millbrook's oaks and it isn't me. The woodcutter, Millbrook.",
      offer: "Fresh stumps all down the Oakwood ride. Cut low and clean, by somebody who knows how. They're shaping the trunks into a ram. My oaks, going into somebody's gate. Go and stop it before it has wheels.",
      while: ["You can hear the adzes from the road."],
      done: "Broken up? Good. A waste of good oak, but I'd rather that than see it come through a wall.",
      again: "Stumps on the ride again. They've started another one. They don't learn, and the trees don't grow back that fast.",
    },
  },
  {
    id: "vale_stragglers", region: "Aldmere Vale", kind: "hunt", giver: "kingsrest_hunter", place: "greywater_meadows", about: "the stragglers",
    title: "Stragglers in the Greywater meadows", mob: "siege:hollow_footman", need: [5, 9], when: { after: "siegeWon" },
    foes: [["siege:torchbearer", 0, 1, 2]],
    lines: {
      notice: "Raid's over but not all of them went home. Hunter wanted. Kingsrest.",
      offer: "After a raid some of them don't go back. They stand about in the river meadows east of town, facing nothing. Then something tells them to move, and they move towards people. I hunt deer. I'd rather you did these.",
      while: ["They don't run and they don't hide. That's the worst of it."],
      done: "Meadows are quiet. I'll get my traps back out.",
      again: "More of them in the Greywater meadows. Every raid leaves a few, like a tide line.",
    },
  },
  {
    id: "vale_salt_flour", region: "Aldmere Vale", kind: "supply", giver: "marta", about: "the flour",
    title: "Flour that tastes of salt", item: "minecraft:wheat", need: [24, 48],
    lines: {
      notice: "Wanted: wheat. Honest wheat. Marta Thistle, baker.",
      offer: "The flour's gone salty again. Salt, in flour, from a dry mill. I'm not going to ask why. I'm going to bake with something else. Bring me wheat from your own fields and I'll grind it myself.",
      while: ["Doesn't matter what it looks like. Wheat's wheat, as long as it tastes of nothing."],
      done: "Tastes of nothing! Lovely. First good loaf in a week. There's one for you at dawn, on the house.",
      again: "Salt in the flour again. You know what I need.",
    },
  },
  {
    id: "vale_blankets", region: "Aldmere Vale", kind: "supply", giver: "bryony", about: "the sick house",
    title: "Blankets for the sick house", item: "minecraft:white_wool", need: [12, 24],
    lines: {
      notice: "Sick house short of blankets. Bryony Ward, Millbrook.",
      offer: "The ones who come back from a night out are cold. Not ill. Cold all the way through, and blankets don't seem to touch it. We try anyway. Bring me wool and I'll do the rest.",
      while: ["White, if you can. They seem to settle better under white. Don't ask me why."],
      done: "That'll see us through. Sit a minute. You look like you've been out in it too.",
      again: "Short again. More come in every week.",
    },
  },
  {
    id: "vale_miller_letter", region: "Aldmere Vale", kind: "carry", giver: "tobias", to: "jonas", about: "a letter for Millbrook",
    title: "The miller's account", thing: "the sealed account", find: "minecraft:paper",
    lines: {
      notice: "Letter to Millbrook, sealed, must be signed for. T. Fennimore, Clerk of the Market.",
      offer: "The miller says his flour is his flour until it crosses the Kingsrest bridge, and I say it is Kingsrest flour from the moment it's sold. This letter says so at more length. Bring me his answer, and try not to let him cry on it.",
      at: "Kingsrest flour. Kingsrest flour! My great-great-grandfather's rock would turn in its quarry. Here. Take him this.",
      done: "He's written 'no' eleven times and signed it. A clear position. I'll file it.",
      again: "Another letter for the miller. We've been doing this for six years. It's the most reliable thing in either town.",
    },
  },
  {
    id: "vale_nans_clock", region: "Aldmere Vale", kind: "carry", giver: "robin", to: "nan", about: "a parcel for Kingsrest",
    title: "A clock for Nan Pellow", thing: "Nan Pellow's clock", find: "minecraft:clock",
    lines: {
      notice: "Parcel for Kingsrest, delicate. R. Askew, clockmaker.",
      offer: "Nan Pellow sent her clock back saying it runs slow. It doesn't. I've had it apart. Nothing wrong with it at all, except that one night in three it stops at seventeen past three, like all the rest. Take it back to her and tell her it's fixed. It's easier for both of us.",
      at: "Fixed, is it? It isn't. But it's kind of him to lie about it. Sit, I'll tell you about my second husband.",
      done: "She said I lied? Course I did. Here, for your trouble.",
      again: "Nan's clock is back. Same complaint, same clock. Same lie, if you'd be so good.",
    },
  },
  {
    id: "vale_feverfew", region: "Aldmere Vale", kind: "escort", giver: "ames", place: "old_mooring", about: "Wren Water",
    title: "Feverfew at Wren Water", when: { day: true },
    foes: [["siege:hollow_footman", 2, 4], ["siege:barrow_wight", 0, 1, 3]],
    lines: {
      notice: "Herb seller wants company to Wren Water. Bring a sword, I'll bring the basket. Goodwife Ames.",
      offer: "Best feverfew in the Vale grows on the Wren Water shore, by the Old Mooring. I used to walk down on my own. I don't any more. Walk me there, stand about looking fierce, and I'll pay you in coin and in advice about your feet.",
      while: ["Not so fast. I'm sixty-three and my hip is older.", "Keep them off me for a few minutes. This one's for warts. So's this one."],
      done: "A full basket. I'll sit by the old mooring a while and get my breath back. You go on. Here, and rub that on your boots.",
      again: "Basket's empty again. Wren Water, same as before, if your sword's free.",
    },
  },
  {
    id: "vale_wat", region: "Aldmere Vale", kind: "missing", giver: "constance", place: "wrenfield_jetty", about: "Wat Cotter",
    title: "Wat Cotter hasn't come home", thing: "Wat Cotter", skin: "boy",
    lines: {
      notice: "A pupil is missing. Please ask at the school. C. Reed.",
      offer: "Wat Cotter didn't come to school yesterday and didn't come home last night. He's been talking all week about the swans on Wren Water and the old jetty where the princess used to row from. His father's up on a roof pretending he's not frightened. Please go and look.",
      found: "I came to see the swans and then my foot went in between the posts. I'm not crying. I was crying earlier. Can we go now?",
      while: ["Do you know any stories? Miss Reed knows loads but they all stop in the middle."],
      done: "Thank you. I'll be stern with him tomorrow. Tonight I'm just going to sit down.",
    },
  },
  {
    id: "vale_wind_nest", region: "Aldmere Vale", kind: "recover", giver: "joan", place: "crownhold_elm", about: "her ring",
    title: "The wind's nest", thing: "Joan Croft's wedding ring", site: "vale_peg_nest", find: "minecraft:gold_nugget",
    keepsake: ["minecraft:stick", "The Wind's Peg", "Folded neater than you'd fold it."],
    lines: {
      notice: "Lost: one wedding ring, in a sheet, in the wind. Joan Croft, washerwoman.",
      offer: "I've told folk the wind steals a peg a day and I think it's building something. They laugh. Well, yesterday it took a whole sheet with my ring knotted in the corner, and I watched it go, north-west, up toward the old capital. Go and see what it's building.",
      seen: "A nest the size of a cart, every stick of it a clothes peg. In the middle, Joan's sheet, folded neatly, and her ring on top.",
      done: "Pegs. All of them pegs. Folded my sheet, did it? Better than my husband ever managed. Here, take one of the pegs. For luck, or for proof.",
    },
  },
  {
    id: "vale_ferry_bell", region: "Aldmere Vale", kind: "recover", giver: "bartholomew", place: "harrow_ferry", about: "the ferry bell",
    title: "The Harrow ferry bell", thing: "the Harrow ferry bell", site: "vale_sunk_bell", find: "minecraft:bell",
    keepsake: ["minecraft:gold_nugget", "The Harrow Ferry Token", "A ha'penny a head. Soldiers free, by the King's order."],
    lines: {
      notice: "Family bell in the river at Harrowford. Good swimmer wanted. B. Pike, fishmonger.",
      offer: "My gran was a Harrow, from the ferry. When the post rotted the ferry bell went in the river, and she always said it should come out before she died. She's ninety, so I'd say there's no rush, but she disagrees. It's by the old post on the Alder. Bring it up. And don't ring it. She was very clear about that.",
      while: ["Mind the current. It's colder than it looks."],
      seen: "Green with weed, half in the silt by the old post: the ferry bell, its clapper tied fast with rotten rope.",
      done: "That's it. Gran'll weep. Here. And she sent this for you, she says it was the fare.",
    },
  },
  {
    id: "vale_lantern_line", region: "Aldmere Vale", kind: "look", giver: "will", place: "bellhollow_road", about: "the lights",
    title: "Lights on the Bellhollow road", site: "vale_lantern_line", when: { night: true, notRaid: true },
    lines: {
      notice: "Want someone with good eyes and no imagination. Ask for Will on whichever roof he's on.",
      offer: "From up high you see things. Third nights, lights out on the Bellhollow road, moving in a line, slow, like folk walking. I've seen it a dozen times and I've never gone to look. Go and look for me, and tell me it's nothing.",
      seen: "A row of candle lanterns set down on the verge in a dead straight line, every one just gone out, the wicks still warm. Frost on the road, and footprints that start at the first lantern and stop at the last.",
      done: "Lanterns, set down neat, all the same distance apart. And the prints just stop. Right. Thank you. I'll stop looking, then.",
    },
  },
  {
    id: "vale_waystone", region: "Aldmere Vale", kind: "look", giver: "ralf", place: "south_waystone", about: "the old stone",
    title: "A face off the waystone", site: "vale_waystone",
    lines: {
      notice: "Something odd on the Wrenfield road. Ask Ralf, the hedge-cutter.",
      offer: "I told folk about the old stone past the fields with a king carved on it and his face scratched off. Well, there's another, on the Wrenfield road, and I'd swear it had a face last month. Go and look. Tell me I'm wrong.",
      seen: "A crowned figure carved on a waystone. The face is gone, chiselled flat. Stone dust is still in the grass, and the chisel marks are clean and pale.",
      done: "Fresh. So somebody's still at it. Three hundred years on, and somebody still gets up in the morning and goes out to scratch a face off a stone. Odd sort of job.",
    },
  },
  {
    id: "vale_lamps", region: "Aldmere Vale", kind: "watch", giver: "piers", place: "millbrook_lamps", about: "the lamps",
    title: "Somebody puts out the lamps", need: [3, 4], site: "vale_lamps", when: { notRaid: true },
    foes: [["siege:hollow_footman", 2, 4]],
    lines: {
      notice: "Night work, lamps, Millbrook road. P. Hallam.",
      offer: "Every lamp lit by dusk, every lamp out by dawn. Except the ones on the Millbrook road, which are out by midnight, every night this week, and it isn't wind. Stand with them till morning and keep them burning.",
      while: ["Long pole, short ladder, steady hand. That's the whole trade."],
      done: "Lit till dawn. First time this week. I'll take the night tonight, you go and sleep.",
      again: "They're putting the Millbrook road lamps out again. Same as before, if you'll stand the night.",
    },
  },
  {
    id: "vale_fold", region: "Aldmere Vale", kind: "watch", giver: "abel", place: "abels_fold", about: "his flock",
    title: "One more than I own", need: [4, 6], site: "vale_fold", animal: "sheep", when: { notRaid: true },
    foes: [["siege:barrow_wight", 1, 3]],
    lines: {
      notice: "Shepherd needs a night watch on the hill. Abel Crane, Millbrook.",
      offer: "I counted the flock one morning and had one more than I own. Since then I've had fewer every week. Something comes up the hill in the dark. The dog won't go out. Sit the night at the fold for me. I'll count them in the morning.",
      while: ["The dog's under the cart. Wise dog."],
      done: "I've counted them twice. The right number. The right sheep, too, I think.",
      again: "They're coming up the hill again. Same fold, same night, if you will.",
    },
  },
  {
    id: "vale_cloak_1", region: "Aldmere Vale", kind: "look", giver: "lettice", place: "ravens_copse", about: "the traveller's cloak",
    title: "The iron-thread cloak", chain: ["vale_cloak", 1], site: "vale_cold_camp", when: { after: "siegeWon" },
    lines: {
      notice: "Seamstress worried about a customer. Lettice Mayhew, Kingsrest.",
      offer: "A traveller brought a cloak in for mending and broke my needle on it. Iron thread, woven right in. He paid, said he was camped at the copse west of Millbrook, and never came back for it. That was a fortnight ago. Would you go and see if he's all right?",
      seen: "A cold camp. A bedroll, a pack, and a raven sitting on the pack that will not move for you. In the pack, a note: \"If I'm not back by the third night, the cloak is paid for.\"",
      done: "Not there, and the note in his own hand. Then it's paid for, and I don't know what to do with it. Harlan Voss in Millbrook knows iron. Take it to him.",
    },
  },
  {
    id: "vale_cloak_2", region: "Aldmere Vale", kind: "carry", giver: "lettice", to: "harlan", about: "the cloak",
    title: "The iron-thread cloak, to Millbrook", chain: ["vale_cloak", 2], thing: "the iron-thread cloak", find: "minecraft:leather_chestplate",
    keepsake: ["minecraft:leather_chestplate", "The Silent Cloak", "Iron thread, northern work. It was paid for."],
    lines: {
      notice: "Parcel for the Millbrook smith. L. Mayhew.",
      offer: "Here it is. Mind your fingers, it's heavier than it looks. Harlan's at the forge in Millbrook.",
      at: "Iron thread. Nobody down here can do this. The old smiths up north could. It's not for warmth. It's woven so that whoever wears it makes no sound at all. Somebody didn't want to be heard. Give it back to Lettice; it's hers to sell or keep.",
      done: "Silent, is it? I'm not wearing that. You have it. You go out at night more than I do.",
    },
  },
  // Act 2, step 7: the first job, the cart family's chest from their burned hamlet (story thread; first: offered alone,
  // and only while it is the player's Act 2 step: newplayer/act2.js filter "boardFirstJob")
  {
    id: "vale_family_chest", region: "Aldmere Vale", kind: "recover", giver: "tobin", place: "brackenfold", about: "what's left at Brackenfold",
    title: "What's left at Brackenfold", thing: "the family's chest", site: "vale_burned_hamlet", find: "minecraft:chest", story: true, first: true,
    keepsake: ["minecraft:candle", "Marta's beeswax candle", "Hand-dipped. It burns longer than it should."],
    lines: {
      notice: "Wanted: somebody with a strong back to fetch what's left of our things from Brackenfold. Tobin, thatcher, in the Longhouse.",
      offer: "I can't go back there, my lord. Marta won't have it, and she's right. But our chest is still in the last house on the lane, if the fire left it. Her mother's linen, the deed to our strip, the boy's spoon. Bring it out for us?\n\nAnd look at the doors while you're there. Tell me I'm wrong about the doors.",
      seen: "Every door in Brackenfold is barred from the outside, a beam dropped into its brackets across each one. The scorch marks start inside the houses and climb out through the windows. The chest is in the last house, by what's left of the table. Nobody has touched it.",
      while: ["The last house on the lane. Under what's left of the table, if it's anywhere."],
      done: "That's it. That's all of it. ...You saw the doors. Barred from outside, every one, like I said. Raiders, the Order wrote. You've a book of your own now, my lord. Write it true.",
    },
  },
  // ---------------- Frostmarch (Rimehold) ----------------
  {
    id: "frost_wolf", region: "Frostmarch", kind: "hunt", giver: "hakon", place: "hounds_back", about: "the wolf that waits",
    title: "The wolf that waits", mob: "siege:rimewolf", need: [3, 6], when: { night: true }, site: "frost_wolf_den",
    lines: {
      notice: "Furrier wants wolves thinned. Pays in coin and in a good collar. Hakon Grimmel, Rimehold.",
      offer: "There's a pack on the Hound's Back, north of town, and one of them is clever. It sat in the snow and waited for me while I set my traps, and when I went back the traps were sprung and empty and laid in a row. Wolves don't lay things in rows. Thin them out before that one teaches the rest.",
      while: ["They hunt in a ring. Keep something at your back."],
      done: "Good pelts, these. Bigger than they should be. The clever one, was it there? Don't tell me. I'd rather think it was.",
      again: "They're back on the Hound's Back. A new pack, or the same one with new manners. Same pay.",
    },
  },
  {
    id: "frost_sleds", region: "Frostmarch", kind: "camp", giver: "olaf", place: "sled_shed", about: "his sled-shed",
    title: "Raiders on runners", foes: TOLLMEN, site: "frost_sled_camp",
    lines: {
      notice: "Somebody is in my old sled-shed and they are not paying rent. Olaf Brenn, sledwright.",
      offer: "My old shed on the south road. I keep the spare runners there and the good ash. Smoke out of the roof three nights running, and yesterday I saw them through the door, building sleds. Badly. Big sleds, for a lot of men, or one heavy thing. I'd go myself, but I build sleds. I don't fight for them.",
      while: ["They've lashed the runners on backwards. I can see it from here. It's painful."],
      done: "Out, are they? And the sleds? Burnt. Good. Bad sleds are worse than none. Something in them always gives on a slope.",
      again: "Smoke from the sled-shed again. I'm going to have to start charging them.",
    },
  },
  {
    id: "frost_pass", region: "Frostmarch", kind: "camp", giver: "rimehold_factor", place: "watchtower_pass", about: "the pass road",
    title: "The toll on the pass", foes: TOLLMEN, site: "frost_pass_camp",
    lines: {
      notice: "No carts up from the Vale in nine days. Factor wants the pass opened. Rimehold.",
      offer: "The Vale road climbs past the old watchtower and something has stopped my carts there. One driver walked in yesterday without his cart or his boots. He says they've built a camp under the tower and they take everything that comes up, down to the nails. Nobody in Rimehold eats if the pass is shut. Open it.",
      while: ["They've a lookout on the rocks. Come at them from the road side, where the tower hides you."],
      done: "The carts are moving. I've a driver who wants to thank you, but he's still looking for his boots.",
      again: "They're under the watchtower again. That pass draws them like a draught.",
    },
  },
  {
    id: "frost_stragglers", region: "Frostmarch", kind: "hunt", giver: "rimehold_hunter", place: "ice_landing", about: "the men on the ice",
    title: "Men standing on the ice", mob: "siege:hollow_footman", need: [5, 9], when: { after: "siegeWon" },
    lines: {
      notice: "Raiders left behind on the lake. Hunter wants help, not company. Rimehold.",
      offer: "After a raid a few of them walk out on the ice by the cutters' landing and stand there, facing the middle of the lake, as if they're waiting to be let in. They don't feel the cold. Bjorna can't cut ice with them stood about. I've tried arrows. They don't mind arrows much.",
      while: ["Mind the thin ice by the cut channels. It doesn't hold a man in armour."],
      done: "Ice is clear. Bjorna's back on the saw. I've never been so glad to hear a saw.",
      again: "More of them on the ice after the raid. Always the same place, always facing the same way.",
    },
  },
  {
    id: "frost_coal", region: "Frostmarch", kind: "supply", giver: "rimehold_smith", about: "the forge",
    title: "Coal for the cold months", item: "minecraft:coal", need: [16, 32],
    lines: {
      notice: "Smith needs coal before the passes close. Rimehold.",
      offer: "The charcoal-burners didn't come down this autumn, any of them. I'm burning the old spruce and it spits. Bring me coal, real coal, and you'll have the first edge off the anvil when it's lit proper.",
      while: ["Lumps, not dust. Dust I can get off the floor."],
      done: "That'll burn clean. Hear that? That's a fire that means it.",
      again: "Coal's low again. It always is, up here. The cold eats it.",
    },
  },
  {
    id: "frost_smoking_oak", region: "Frostmarch", kind: "supply", giver: "ulfa", about: "the smokehouse",
    title: "Oak for the smokehouse", item: "minecraft:oak_log", need: [16, 32],
    lines: {
      notice: "Oak wanted. Not spruce. Never spruce. Ulfa Strand, fishwife.",
      offer: "Smoke ice-fish over spruce and they taste like a Midwinter tree. Folk won't buy them, and they're right. There's no oak up here, it's all down in the Vale. Bring me oak and you'll eat smoked fish that tastes of smoke, which is the best a fish can hope for.",
      while: ["Logs. Not planks. Planks burn too fast and too proud."],
      done: "Oak! Smell that once it's going. You'll think you're somewhere warm.",
      again: "Out of oak. Everybody wants the oak-smoked ones now. I've made a rod for my own back.",
    },
  },
  {
    id: "frost_love_letter", region: "Frostmarch", kind: "carry", giver: "rimehold_quarryman", to: "daisy", about: "a letter for Kingsrest",
    title: "A quarryman's letter", thing: "a letter from the Rimehold quarries", find: "minecraft:paper",
    lines: {
      notice: "Letter for Kingsrest, from one of my lads. He can't leave the face. Quarry foreman, Rimehold.",
      offer: "One of my lads has a girl in Kingsrest. Daisy, milks the cows there. He's written her a letter, every word of it about the lake singing, which it does, and she won't believe a word, which is fair. Take it down to her. He's been carrying it about a fortnight and it's starting to smell of deepslate.",
      at: "The lake sings, he says. He's a terrible liar, usually. This one doesn't read like a lie. Tell him I'll come up in the spring and hear it myself. And tell him to wash.",
      done: "She'll come up in spring? He'll be useless for a week. Thank you, I think.",
      again: "Another letter for Daisy. He writes one a week now. Quarrying's suffering for it.",
    },
  },
  {
    id: "frost_tuning_bell", region: "Frostmarch", kind: "carry", giver: "erik", to: "robin", about: "a bell for Millbrook",
    title: "A bell for the clockmaker", thing: "a little bronze bell", find: "minecraft:bell",
    lines: {
      notice: "*A slate on the board: a drawing of a little bell, an arrow pointing south, and a clock.*",
      offer: "*Erik wraps a small bronze bell in wool, very carefully. He writes MILLBROOK ASKEW on his slate, then draws a clock face with the hands at seventeen past three, and taps it twice, frowning.*",
      at: "A tuning bell. Listen to that. One pure note, no wobble in it. With this I can tell whether my clocks are wrong, or the hour is. I've wanted one for years. How did he know? Tell him thank you. Tell him I'll send word what I find.",
      done: "*Erik reads your face, nods slowly, and gives you a small brass button from his apron. He seems pleased and worried at once.*",
      again: "*Another little bell in wool, the same slate, the same clock face. He taps it three times this time.*",
    },
  },
  {
    id: "frost_lichen", region: "Frostmarch", kind: "escort", giver: "sif", place: "lichen_rocks", about: "the lichen rocks",
    title: "Lichen for the dye pots", when: { day: true },
    foes: [["siege:rimewolf", 1, 3], ["siege:hollow_footman", 0, 2, 2]],
    lines: {
      notice: "Weaver wants a steady arm to the rocks east of town. One morning's work. Sif Arnsdottir.",
      offer: "The good yellow lichen grows on the rocks east of the lake, and nowhere else. I used to scrape it myself, until the wolves started watching me from the rise. Walk me there and stand between me and them. You'll get a scarf. A long one.",
      while: ["Don't step on it. It takes thirty years to grow that much.", "There. Yellow, like old gold. That's a cloak's worth."],
      done: "Enough for a winter's weaving. Here, your scarf. It's twelve feet. I like to give generously.",
      again: "The dye pots are empty again. Same rocks, same wolves, if you'll come.",
    },
  },
  {
    id: "frost_leif", region: "Frostmarch", kind: "missing", giver: "ulfa", place: "west_shore", about: "her nephew Leif",
    title: "Leif went out past the poles", thing: "Leif Strand", skin: "boy",
    lines: {
      notice: "Boy missing on the lake. Ulfa Strand, by the fish stall.",
      offer: "My sister's boy, Leif. He went out fishing past the marker poles, where nobody fishes, because the fish there are bigger and nobody's told him why that is. His line's still in the hole by the far end of the lake. He isn't. Please.",
      found: "I followed the footprints. Somebody's footprints, going out to the middle. Then they stopped and I didn't know what to do so I sat down. My feet have gone. Is it dinner?",
      while: ["The fish under there were looking up. All of them. Like they were waiting for something."],
      done: "Stupid boy. Stupid, stupid, warm boy. Thank you. I'll smoke you a whole cod. A whole one.",
    },
  },
  {
    id: "frost_gerda", region: "Frostmarch", kind: "recover", giver: "torvald", place: "old_working", about: "his pick",
    title: "Gerda, down the old working", thing: "Gerda, Torvald's pick", site: "frost_old_working", find: "minecraft:iron_pickaxe",
    keepsake: ["minecraft:raw_copper", "Old Copper", "Green right through. Somebody dug a mountain of this, once."],
    lines: {
      notice: "Lost: one pick, named Gerda. Must be found before my wife hears. Torvald Ness.",
      offer: "We broke into an old working last month off the Deepforge road. All green copper, dug out ages ago and left. I went in to look and dropped Gerda down the shaft. My pick. Not my wife. My wife is also called Gerda and I am in a great deal of trouble. It's not far down. I just don't like the dark in there. It's very tidy dark.",
      while: ["There's a cart down there with the copper still in it. Like they stopped for lunch and never came back."],
      seen: "At the bottom of the old working, beside a cart still full of green ore, a good pick lies on the stone. Every other tool down here is laid in a neat row along the wall.",
      done: "Gerda! Oh, I could kiss her. The pick. Here, a lump of their old copper. You found it, you keep it.",
    },
  },
  {
    id: "frost_axe", region: "Frostmarch", kind: "recover", giver: "gunnar", place: "black_ridge", about: "his axe",
    title: "The axe in the black spruce", thing: "Gunnar's axe", site: "frost_black_spruce", find: "minecraft:iron_axe",
    keepsake: ["minecraft:spruce_sapling", "A Black Spruce Cone", "From the big one. It let you have it."],
    lines: {
      notice: "Woodsman's axe left on the ridge. Will pay to have it fetched, not to hear about it. Gunnar Rask.",
      offer: "The big black spruces on the ridge west of town. You leave them alone. Everybody says so. I'm from the south, I don't listen. I put my axe in the biggest one, and it rang. Like a bell, all the way up. I left the axe where it was and I ran. Go and get it. Don't cut anything.",
      while: ["Don't touch the bark. I'm not saying why. I just wouldn't."],
      seen: "The great black spruce stands alone in a ring of bare snow, and the cut in its trunk has closed over the blade. Gunnar's axe lies in the snow at its foot, as if it was handed back.",
      done: "It gave it back? It gave it back. I'm going to sit down. And I'm cutting pine from now on. Nice, quiet pine.",
    },
  },
  {
    id: "frost_ring", region: "Frostmarch", kind: "look", giver: "gunnar", place: "lake_ring", about: "the ring on the lake",
    title: "A ring melted in the snow", site: "frost_lake_ring", when: { night: true, notRaid: true },
    lines: {
      notice: "Somebody with sense to look at the lake one night and tell me what they see. Gunnar Rask.",
      offer: "Some nights the snow on the north shore of the lake melts in a ring. Round as a bell, right up the bank and out onto the ice. By morning it's frozen again and nobody believes me. Go up there tonight and look, and come back and tell me I'm not mad.",
      seen: "A perfect ring of bare, wet ground in the snow, wider than a house, running from the bank out onto the ice. It's warm to the hand. In the middle the ice hums, very low, like a bell long after it's been struck.",
      done: "Warm. And it hums. Right. I'm not mad, then. I'm not sure that's better.",
    },
  },
  {
    id: "frost_stag", region: "Frostmarch", kind: "look", giver: "astrid", place: "goat_path", about: "the stag tracks",
    title: "Tracks on the goat path",  site: "frost_stag_tracks",
    lines: {
      notice: "Frost stag seen above the lake? Herder wants to know. Astrid Holm.",
      offer: "Frost stag tracks on the goat path, above the lake. If you see one, it's good luck. My goats won't go up there now, and goats go everywhere. Go and see the tracks. Tell me they're only a stag's.",
      seen: "A frost stag's tracks in fresh snow, deep and clean, climbing the path. Halfway up they stop. From there on, all the way to the top, the tracks are a man's bare feet.",
      done: "Bare feet. In this. I'll keep the goats down by the town, then. Good luck's a funny thing up here.",
    },
  },
  {
    id: "frost_ice_holes", region: "Frostmarch", kind: "watch", giver: "bjorna", place: "ice_holes", about: "the fishing lamps",
    title: "Lamps on the ice holes", need: [3, 4], site: "frost_ice_holes", when: { notRaid: true },
    foes: [["siege:rimewolf", 2, 4]],
    lines: {
      notice: "Night watch wanted on the fishing holes. Keep the lamps lit, keep your feet dry. Bjorna Eld.",
      offer: "We fish the holes on the west shore at night, with lamps on poles so the lads can find them. Something's been knocking the lamps into the snow, one after another, and then the lads can't find the holes, and then the holes find the lads. Stand there till dawn and keep the lamps burning.",
      while: ["The lake's humming. Don't listen to it, it's only the ice."],
      done: "Every lamp lit at dawn, and nobody in the water. You've earned a fish. Pick one. Not that one, it's looking at you.",
      again: "The fishing lamps are going out again. Same holes, same night.",
    },
  },
  {
    id: "frost_goats", region: "Frostmarch", kind: "watch", giver: "rimehold_farmer", place: "high_pasture", about: "the goats",
    title: "Goats on the high pasture", need: [4, 6], site: "frost_goat_pen", animal: "goat", when: { notRaid: true },
    foes: [["siege:rimewolf", 2, 4]],
    lines: {
      notice: "Watch wanted at the goat pen on the high pasture. One night. Bring a cloak. The Rimehold farmer.",
      offer: "The goats on the high pasture. The rimewolves have worked out where the pen is, and they come up in the dark, two and three at a time. The goats climb the walls to get away and that's worse. Sit up there tonight. In the morning I'll count them.",
      while: ["Goats judge. Even in the dark, you can feel them judging."],
      done: "All there. And one of them's eaten your hat. They do that to people they like.",
      again: "Wolves on the high pasture again. Same pen, same goats, same judging.",
    },
  },
  {
    id: "frost_stranger", region: "Frostmarch", kind: "look", giver: "inga", place: "south_bothy", about: "the guest who left",
    title: "The guest who didn't touch his mead", site: "frost_bothy",
    lines: {
      notice: "A guest left without paying. I'd like to know he's all right. Inga Vale, the inn.",
      offer: "A man came in from the south one night, sat by my fire and never touched his mead, and when I turned round he wasn't there. He'd said he was sleeping at the shepherd's bothy down the south road. I don't want the money. I'd just like to know somebody's in there.",
      seen: "The bothy's door is shut but the fire inside is laid and never lit. A full horn of mead stands on the table with a skin of ice on it. Frost on the inside of the door, and no footprints in the snow but yours.",
      done: "Untouched. Like the one at mine. I'll leave the door off the latch tonight. In case he wants to come in. Or in case he doesn't.",
    },
  },
  // Act 2, step 7: the first job, the cart family's chest from their burned hamlet (story thread; first: offered alone,
  // and only while it is the player's Act 2 step: newplayer/act2.js filter "boardFirstJob")
  {
    id: "frost_family_chest", region: "Frostmarch", kind: "recover", giver: "tobin", place: "kettlenes", about: "what's left at Kettlenes",
    title: "What's left at Kettlenes", thing: "the family's chest", site: "frost_burned_hamlet", find: "minecraft:chest", story: true, first: true,
    keepsake: ["minecraft:candle", "Marta's beeswax candle", "Hand-dipped. It burns longer than it should."],
    lines: {
      notice: "Wanted: somebody with a strong back to fetch what's left of our things from Kettlenes. Tobin, thatcher, in the Longhouse.",
      offer: "I can't go back there, my lord. Marta won't have it, and she's right. But our chest is still in the last house on the lane, if the fire left it. Her mother's linen, the deed to our strip, the boy's spoon. Bring it out for us?\n\nAnd look at the doors while you're there. Tell me I'm wrong about the doors.",
      seen: "Every door in Kettlenes is barred from the outside, a beam dropped into its brackets across each one. The scorch marks start inside the houses and climb out through the windows. The chest is in the last house, by what's left of the table. Nobody has touched it.",
      while: ["The last house on the lane. Under what's left of the table, if it's anywhere."],
      done: "That's it. That's all of it. ...You saw the doors. Barred from outside, every one, like I said. Raiders, the Order wrote. You've a book of your own now, my lord. Write it true.",
    },
  },
  // ---------------- Saltreach (Gull's Rest) ----------------
  {
    id: "salt_westwatch", region: "Saltreach", kind: "camp", giver: "silas", place: "westwatch_camp", about: "the Westwatch",
    title: "Raiders squatting in the Westwatch", foes: TOLLMEN, site: "salt_westwatch_camp",
    lines: {
      notice: "Raiders camped in the Westwatch. Harbour watch wants them gone. Silas Whitlock.",
      offer: "Up the coast north, the old harbour mouth, the Westwatch. Nobody's kept it in my lifetime. Now there's smoke behind the quay every night and men going in and out of the lighthouse that's never lit. I watch the harbour. I don't go and knock on doors. You do that bit.",
      while: ["They've a man on the quay looking out to sea. Not for ships. Just looking."],
      done: "Gone, then. I'll put it in the book. 'Westwatch: cleared.' First thing I've written in that column in twelve years.",
      again: "Smoke at the Westwatch again. They like it up there. I can't think why. Nobody else does.",
    },
  },
  {
    id: "salt_wreckers", region: "Saltreach", kind: "camp", giver: "morrow", place: "wreckers_strand", about: "the false lights",
    title: "False lights on Gannet Strand", foes: TOLLMEN, site: "salt_wreckers_camp",
    lines: {
      notice: "Somebody's showing false lights on Gannet Strand. Old captain wants a word with them. With your sword. Morrow Teague.",
      offer: "There's a lamp swinging on Gannet Strand at night, east along the coast. Swinging, like a ship riding at anchor. A skipper sees that and steers in, thinking it's shelter, and finds the rocks. Wreckers, in my day we hanged them. Go and put the lamp out, and the men holding it.",
      while: ["Forty years at sea and I've never once trusted a light I didn't light myself."],
      done: "Lamp's out? And they won't light another? Good. I'll drink to that. I'll drink to most things, mind.",
      again: "That lamp's swinging on Gannet Strand again. Some lessons don't take the first time.",
    },
  },
  {
    id: "salt_lurkers", region: "Saltreach", kind: "hunt", giver: "fergus", place: "eel_rocks", about: "the Eel Rocks",
    title: "Lurkers on the Eel Rocks", mob: "siege:brine_lurker", need: [3, 6], when: { night: true }, site: "salt_eel_rocks",
    lines: {
      notice: "Fisherman wants the Eel Rocks back. Pays in coin and in herring. Fergus Kell.",
      offer: "The Eel Rocks, north up the coast. Best pots on the coast. Something's come up out of the water and sits on them at night, and when I go out at dawn my pots are empty and my floats are bitten through. Brine lurkers, the old men say. I say I want my rocks back.",
      while: ["They come up when the tide's on the turn. Watch the water, not the rocks."],
      done: "Pots full this morning. Full! I'd forgotten what a lobster looked like. Ugly beggars. Lovely.",
      again: "They're up on the Eel Rocks again. Must be the lobsters. Can't blame them.",
    },
  },
  {
    id: "salt_stragglers", region: "Saltreach", kind: "hunt", giver: "gulls_farmer", place: "barley_strips", about: "the men in the barley",
    title: "Men standing in the barley", mob: "siege:hollow_footman", need: [5, 9], when: { after: "siegeWon" },
    lines: {
      notice: "Raiders left in my barley after the raid. Farmer wants them out. Gull's Rest.",
      offer: "Up on the cliff road there's my barley, in strips, and after the raid there's men standing in it. Not hiding. Standing. All facing out to sea, like they're waiting for a boat. They tread the barley flat and they don't eat it, which is the insult.",
      while: ["Mind the barley. What's left of it."],
      done: "Out of the barley. I'll get what's standing in before the gulls do.",
      again: "More of them in the barley after the raid. Always facing the sea.",
    },
  },
  {
    id: "salt_hoops", region: "Saltreach", kind: "supply", giver: "dafydd", about: "barrel hoops",
    title: "Iron for the herring barrels", item: "minecraft:iron_ingot", need: [6, 12],
    lines: {
      notice: "Cooper short of iron for hoops. Herring's in and the barrels aren't. Dafydd Brine.",
      offer: "The herring's come in early and thick, and I've staves for a hundred barrels and iron for twelve. No hoops, no barrels. No barrels, the herring rots on the quay and the whole town smells of it till spring. Bring me iron.",
      while: ["Bars, not scrap. Scrap springs."],
      done: "That'll hoop the lot. Mind your fingers, I'm about to hit things for a week.",
      again: "Herring's in again, and I'm short of iron again. Same as every year.",
    },
  },
  {
    id: "salt_nets", region: "Saltreach", kind: "supply", giver: "nella", about: "the nets",
    title: "String for the nets", item: "minecraft:string", need: [16, 32],
    lines: {
      notice: "Net-mender needs string, lots of it, quick. Nella Marsh.",
      offer: "Every boat in the harbour came in last week with its nets cut. Not torn. Cut, clean, in a straight line, the same place on every net. I'll not say what I think did it. I'll say I need string, more than the chandler's got, and I need it this week.",
      while: ["Every hole's a fish going home. I take it personally."],
      done: "That'll mend the lot. Knot, pull, knot, pull. My fingers know it better than I do.",
      again: "Cut nets again. Same straight line. Same place. I need string.",
    },
  },
  {
    id: "salt_herring", region: "Saltreach", kind: "carry", giver: "rosalind", to: "bartholomew", about: "a barrel for Kingsrest",
    title: "Herring for the Kingsrest fishmonger", thing: "a keg of salt herring", find: "minecraft:barrel",
    lines: {
      notice: "Fish for Kingsrest! Fish-ish! Fish that's going on an adventure! R. Pryce.",
      offer: "Bartholomew Pike, the fishmonger in Kingsrest, says Vale folk won't buy fish that's never seen the sea. So he's having a keg of my salt herring, real sea herring, and he can tell them it's been on an adventure. Take it to him. Don't open it. It's not that kind of adventure.",
      at: "Real sea herring. Smell that. That's the sea, that is. I've never seen it. Gran was the last of us who had. Tell Rosalind I'll pay in Vale apples, they keep.",
      done: "Apples? I'll take apples. You can't shout 'fresh apples' half so well, but I'll manage.",
      again: "Another keg for Bartholomew. The Vale's got a taste for the sea.",
    },
  },
  {
    id: "salt_lace", region: "Saltreach", kind: "carry", giver: "maren", to: "lettice", about: "a collar for Kingsrest",
    title: "A lace collar for the seamstress", thing: "a lace collar in tissue", find: "minecraft:white_carpet",
    lines: {
      notice: "Lace collar to go to Kingsrest. Handle like it's breathing. M. Coyle.",
      offer: "Lettice Mayhew, the seamstress in Kingsrest, ordered a collar off me two years ago. It's done. Lace is slow. Take it down to her in its tissue and keep it out of the rain, and if a gull goes for it, give it your hand instead.",
      at: "Oh. Oh, that's sea-light, that is, done in thread. Two years. I'd have waited five. Tell her I'm sending her a bolt of Vale linen, the good stuff, and that I'll never order anything again because nothing will be as nice as this.",
      done: "She liked it? Good. Two years well spent, then. Most of my years aren't.",
      again: "Lettice wants another. She says she can't stop looking at the first one. Off you go.",
    },
  },
  {
    id: "salt_pans", region: "Saltreach", kind: "escort", giver: "morwen", place: "salt_pans", about: "the salt pans",
    title: "Down to the salt pans", when: { day: true },
    foes: [["siege:brine_lurker", 1, 3], ["siege:hollow_footman", 0, 2, 2]],
    lines: {
      notice: "Salt-panner wants walking out to the far pans. Bring a sword and a sack. Morwen Gannet.",
      offer: "My best pans are out on the south flats, a fair walk east of town. There's been things coming up out of the shallows at the low tide, wet and slow, and I've stopped going out alone. Walk me there, keep them off me while I rake, and you'll go home with a sack of the best salt on the coast.",
      while: ["Sun, pan, rake, sack. The sun does most of the work.", "That one's for the meat, that one's for the doorways. Never mix them up."],
      done: "A full sack. Here's yours. A pinch on the doorstep of a third night, and nothing comes over it. So my mother said.",
      again: "Pans want raking again. South flats, if you'll walk with me.",
    },
  },
  {
    id: "salt_davey", region: "Saltreach", kind: "missing", giver: "ottery", place: "cockle_bay", about: "Davey Lowry",
    title: "Davey went to see the wreck", thing: "Davey Lowry", skin: "boy",
    lines: {
      notice: "Has anybody seen the ship's boy? Grandma Ottery, the shell stall.",
      offer: "Davey Lowry, the ship's boy, comes by my stall every morning to tell me lies about the sea. He didn't come today. Fergus says a hulk washed up in Cockle Bay, south down the coast, no crew on it. Davey's been told and told: a ship comes in with no crew, you don't board it. He's a boy. He'll have boarded it.",
      found: "There's nobody on it. Nobody at all. But the table's laid and the food's still warm. I didn't eat any! Well. One biscuit. It was a terrible biscuit.",
      while: ["Do you think they'll come back for their dinner?"],
      done: "Daft lad. Here, a shell for you. Hold it to your ear. If it says your name, throw it back.",
    },
  },
  {
    id: "salt_annet", region: "Saltreach", kind: "recover", giver: "nella", place: "annets_cave", about: "Annet's locket",
    title: "Annet's locket", thing: "Annet Marsh's locket", site: "salt_annets_strand", find: "minecraft:gold_nugget",
    keepsake: ["minecraft:nautilus_shell", "A Strand Shell", "Nella found it in the locket's chain."],
    lines: {
      notice: "Lost on the strand, years back: a locket. I'd like it found. N. Marsh.",
      offer: "My sister Annet went out walking the strand east of the salt pans one night, and the sea took her. The parish book says fever. It wasn't fever. She had our mother's locket on. Fergus saw something gold in the weed down there last spring tide. I can't go. I'd walk in after her.",
      while: ["Don't go past the tide line after dark. Just don't."],
      seen: "A ring of pebbles laid on the wet sand, very neat, above the tide line. In the middle, a gold locket on a broken chain, closed, dry, as if somebody set it down this morning.",
      done: "That's hers. It's dry. Why is it dry? No. Don't. Here. There was a shell in the chain. You have it.",
    },
  },
  {
    id: "salt_kings_barrel", region: "Saltreach", kind: "recover", giver: "dafydd", place: "kingsmark_shingle", about: "the king's-mark barrel",
    title: "The second king's barrel", thing: "a sealed barrel with a crown burned on it", site: "salt_kings_barrel", find: "minecraft:barrel",
    keepsake: ["minecraft:sand", "Very Old Sand", "From inside a barrel sealed with a king's mark."],
    lines: {
      notice: "Barrel washed up on the shingle north of the harbour. Cooper wants it before the tide does. D. Brine.",
      offer: "A barrel washed up last year, sealed, with a king's mark burned on it. I opened it. Full of sand. Very old sand. Now Silas says there's a second one on the shingle just north of the harbour, the same mark. Bring it me before somebody opens it on the beach and finds whatever this one's full of.",
      while: ["Don't roll it. It might not like being rolled."],
      seen: "Half in the shingle above the tide line: an old barrel, the hoops eaten thin, a crown burned into the lid. It's lighter than it looks, and something inside it shifts like sand.",
      done: "Sand again. Old, old sand. Who seals up sand with a crown on it and puts it in the sea? Here, have a handful. I've a barrel full.",
    },
  },
  {
    id: "salt_bride", region: "Saltreach", kind: "look", giver: "morwen", place: "bride_strand", about: "the bride in the surf",
    title: "Footprints out of the sea", site: "salt_bride_strand", when: { night: true, notRaid: true },
    lines: {
      notice: "Somebody brave and not too clever, to walk the strand below the dunes one night. Morwen Gannet.",
      offer: "I saw a bride walk out of the surf once, on the strand below the dunes, south of town. White dress, soaking. She looked at me like she was waiting. I ran. I've never been back and I've never stopped thinking about it. Walk the strand one night and tell me there's nothing there.",
      seen: "A single line of small bare footprints comes up out of the surf and stops at a driftwood post. Hung on the post, a wet veil, lace, very old. The prints don't go back.",
      done: "A veil. On the post. I knew it. I knew it. I'm not going down there again, and neither are you.",
    },
  },
  {
    id: "salt_sails", region: "Saltreach", kind: "look", giver: "morrow", place: "gull_head", about: "the ships with no wind",
    title: "Full sails and no wind", site: "salt_gull_head",
    lines: {
      notice: "Old captain wants a second pair of eyes on Gull Head. Morrow Teague.",
      offer: "Ships come in to this coast with full sails and no wind behind them. Two winters running. The harbourmistress logs them all and says nothing. Go up on Gull Head, where you see the whole bay, and look out. Tell me what you see, and don't tell me it's nothing. I'm too old for nothing.",
      seen: "From Gull Head the bay is flat as glass, not a breath of wind. Far out, a ship stands still on the water with every sail full and drawing. As you watch, it turns, slowly, and its bow comes round to point at you.",
      done: "Pointed at you. Aye. They do that. You'll want a drink. I'll want two.",
    },
  },
  {
    id: "salt_cliff_lamps", region: "Saltreach", kind: "watch", giver: "gulls_factor", place: "cliff_road", about: "the cliff road lamps",
    title: "The lamps on the cliff road", need: [3, 4], site: "salt_cliff_lamps", when: { notRaid: true },
    foes: [["siege:hollow_footman", 2, 4]],
    lines: {
      notice: "Watch wanted on the cliff road lamps. Carts come in after dark. Factor, Gull's Rest.",
      offer: "The salt carts come in along the cliff road after dark, and we keep lamps on the bad bends so they don't go over. Somebody's been putting them out. Two carts nearly went over last week. Stand the night there and keep every lamp lit till the dawn bell.",
      while: ["Listen for the cart bells. If you hear one, the lamps had better be lit."],
      done: "Every cart in and every lamp lit. That's a good night on this coast.",
      again: "The cliff road lamps are going out again. Same bends, same night.",
    },
  },
  {
    id: "salt_flock", region: "Saltreach", kind: "watch", giver: "gulls_farmer", place: "dune_pasture", about: "the dune sheep",
    title: "Sheep on the dune pasture", need: [4, 6], site: "salt_dune_fold", animal: "sheep", when: { notRaid: true },
    foes: [["siege:brine_lurker", 1, 3]],
    lines: {
      notice: "Shepherd wanted for one night on the dune pasture. Farmer, Gull's Rest.",
      offer: "I graze sheep out on the dune pasture, south-east. Salt grass, best mutton there is. Something's come up out of the bay at night and taken one, then two, wet tracks right across the sand to the pen and back. Sit the night with them. I'll count them in the morning.",
      while: ["Wet footprints. Coming up from the water. Keep your eyes on the bay."],
      done: "All there. Every one. You've the look of somebody who's seen the bay at night. Go and sleep.",
      again: "Wet tracks to the dune pen again. Same as before, if you'll sit up.",
    },
  },
  // Act 2, step 7: the first job, the cart family's chest from their burned hamlet (story thread; first: offered alone,
  // and only while it is the player's Act 2 step: newplayer/act2.js filter "boardFirstJob")
  {
    id: "salt_family_chest", region: "Saltreach", kind: "recover", giver: "tobin", place: "sandwick", about: "what's left at Sandwick",
    title: "What's left at Sandwick", thing: "the family's chest", site: "salt_burned_hamlet", find: "minecraft:chest", story: true, first: true,
    keepsake: ["minecraft:candle", "Marta's beeswax candle", "Hand-dipped. It burns longer than it should."],
    lines: {
      notice: "Wanted: somebody with a strong back to fetch what's left of our things from Sandwick. Tobin, thatcher, in the Longhouse.",
      offer: "I can't go back there, my lord. Marta won't have it, and she's right. But our chest is still in the last house on the lane, if the fire left it. Her mother's linen, the deed to our strip, the boy's spoon. Bring it out for us?\n\nAnd look at the doors while you're there. Tell me I'm wrong about the doors.",
      seen: "Every door in Sandwick is barred from the outside, a beam dropped into its brackets across each one. The scorch marks start inside the houses and climb out through the windows. The chest is in the last house, by what's left of the table. Nobody has touched it.",
      while: ["The last house on the lane. Under what's left of the table, if it's anywhere."],
      done: "That's it. That's all of it. ...You saw the doors. Barred from outside, every one, like I said. Raiders, the Order wrote. You've a book of your own now, my lord. Write it true.",
    },
  },
  // ---------------- Emberwaste (Sunscar) ----------------
  {
    id: "ember_caravan", region: "Emberwaste", kind: "camp", giver: "sunscar_factor", place: "caravan_road", about: "the caravan road",
    title: "Raiders on the caravan road", foes: TOLLMEN, site: "ember_caravan_camp",
    lines: {
      notice: "Caravans robbed on the south road. Factor pays well for an open road. Sunscar.",
      offer: "Two caravans in a week, stopped on the south road and stripped. Not the spices, not the iron. The water. Every skin, every jar, and they left the drivers to walk home dry. Raiders who steal water mean to stay a long while somewhere there isn't any. Break their camp before they go wherever that is.",
      while: ["Their fire's on the road itself. They want to be seen. Mind that."],
      done: "The road's open and the water's back. The drivers want to buy you a drink. Of water. It's the highest honour out here.",
      again: "They're on the south road again. Same trick, same water. Same pay.",
    },
  },
  {
    id: "ember_serai", region: "Emberwaste", kind: "camp", giver: "tariq", place: "caravanserai", about: "the old caravanserai",
    title: "Squatters in the old caravanserai", foes: TOLLMEN, site: "ember_serai_camp",
    lines: {
      notice: "Raiders holding the old caravanserai and its cistern. Guard wants help. Tariq Vell, the gate.",
      offer: "East of town there's an old caravanserai, roofless, but the cistern under it still holds rain. Raiders have taken it and they're filling barrels. I'd go, but I'm the gate, and the gate stays. Walls are thick here for a reason. You're not a wall. Go.",
      while: ["Don't drink from the cistern. Not after they've been at it."],
      done: "The cistern's ours again? Good. I'll send a boy to see it's clean. Not that boy. A sensible one.",
      again: "They're back in the old caravanserai. It's the only water east of town. They know it and so do we.",
    },
  },
  {
    id: "ember_scarabs", region: "Emberwaste", kind: "hunt", giver: "sunscar_quarryman", place: "ash_pans", about: "the Ash Pans",
    title: "Scarabs in the Ash Pans", mob: "siege:ash_scarab", need: [4, 8], site: "ember_ash_pans",
    lines: {
      notice: "Scarabs nesting in the Ash Pans. Quarryman wants his pit back. Sunscar.",
      offer: "The Ash Pans, south of town, is where we dig the grey stone. Now it's full of scarabs. They burrow in the warm ash and come up when you swing a pick, and they bite like a debt collector. Clear them out and the stone's yours at cost for a month.",
      while: ["They come up out of the ash. Watch your feet, not the horizon."],
      done: "Pans are quiet. The lads are going back in. Slowly, and stamping.",
      again: "Scarabs in the Ash Pans again. They like the warm. So do I, but I don't bite.",
    },
  },
  {
    id: "ember_wyrm", region: "Emberwaste", kind: "hunt", giver: "sunscar_hunter", place: "deep_dunes", about: "the wyrm",
    title: "A wyrm under the south wells", mob: "siege:dune_wyrm", need: [1, 3], site: "ember_wyrm_dunes",
    lines: {
      notice: "Wyrm under the dunes by the south wells. Hunter wants a second spear. Sunscar.",
      offer: "There's a wyrm working under the deep dunes by the south wells. You see the sand go round in a ring, then it comes up. It took a camel last week, whole, and the driver's hat. The hat's the bit he's upset about. I've hunted them before. I'd rather hunt them with somebody.",
      while: ["Watch the sand. When it starts to turn, move."],
      done: "Down? Good. I'll have the scales off it for armour. You'll want a set. Everybody wants a set.",
      again: "Another one under the south wells. They follow the water, same as us.",
    },
  },
  {
    id: "ember_stragglers", region: "Emberwaste", kind: "hunt", giver: "sunscar_farmer", place: "mesa_foot", about: "the men by the mesa",
    title: "Men standing at the mesa foot", mob: "siege:hollow_footman", need: [5, 9], when: { after: "siegeWon" },
    lines: {
      notice: "Raiders left behind at the foot of the mesa road. Farmer wants his goats to graze. Sunscar.",
      offer: "After the raid, some of them stayed out at the foot of the mesa road, north-west. They stand in the sun all day and don't sweat and don't drink, all facing the mesa. My goats won't go near. My goats eat thorn bushes. They're not cowards.",
      while: ["They don't sweat. Out here. Think about that."],
      done: "Gone? The goats'll be out by noon. Thank you. They'll thank you too, but you won't like how.",
      again: "More of them at the mesa foot after the raid. Facing the same way, every time.",
    },
  },
  {
    id: "ember_clay", region: "Emberwaste", kind: "supply", giver: "zara", about: "white clay",
    title: "White clay for the potter", item: "minecraft:clay_ball", need: [16, 32],
    lines: {
      notice: "Potter wants clay. Not red. Anything but red. Zara Merrow.",
      offer: "Red clay from the mesa bakes hard as a heart and breaks like one too. I've a lord wants white pots, and there's no white clay in the whole waste. It's in the Vale rivers, they say, and the fen. Bring me clay, the grey-white kind, and I'll make you something that doesn't explode. Probably.",
      while: ["Balls of it, from a river bed. Not mud. Mud is not clay, whatever the fen tells you."],
      done: "Look at that. Pale as milk. My kiln's going to sulk. Here, first pot's yours. Don't drop it.",
      again: "Out of white clay. The lord wants more. Lords always want more.",
    },
  },
  {
    id: "ember_harness", region: "Emberwaste", kind: "supply", giver: "sunscar_smith", about: "the camel harness",
    title: "Leather for the harness", item: "minecraft:leather", need: [8, 16],
    lines: {
      notice: "Smith short of leather for caravan harness. Sunscar.",
      offer: "Every harness on every camel in the south caravan's cracked, and the next caravan leaves in four days. I do the buckles. I need the straps. There are no cows out here that aren't somebody's grandmother's. Bring me leather.",
      while: ["Hide, tanned. If it's still got hair on it, it's not leather yet."],
      done: "That'll strap twelve camels and a very bad-tempered mule. Thank you.",
      again: "Harness is cracking again. Sun does it. Bring leather.",
    },
  },
  {
    id: "ember_pepper", region: "Emberwaste", kind: "carry", giver: "leyla", to: "marta", about: "a jar for Kingsrest",
    title: "Ember-pepper for the Kingsrest baker", thing: "a jar of ember-pepper", find: "minecraft:flower_pot",
    lines: {
      notice: "Spice for Kingsrest, sealed jar. Do not sniff. L. Fenn.",
      offer: "Marta Thistle, the baker in Kingsrest, wrote all the way out here for ember-pepper. Says her flour's been tasting of salt and she wants something to fight it. Take her this jar. Don't open it. Don't sniff it. If you sniff it, you'll see your grandmother, and she'll be cross.",
      at: "Ember-pepper? In bread? Well. If the flour's going to taste of something, it might as well be something I chose. Tell her I'll send a loaf back. It'll be hard by the time it gets there, but it's the thought.",
      done: "A loaf? Hard as a brick? I'll keep it. I'll use it as a doorstop and think of the Vale.",
      again: "Marta wants another jar. Her bread's gone famous. Off you go.",
    },
  },
  {
    id: "ember_mirror", region: "Emberwaste", kind: "carry", giver: "nadia", to: "agnes", about: "a glass for the Order",
    title: "The seventh glass", thing: "a wrapped glass that shows what's behind you", find: "minecraft:glass_pane",
    lines: {
      notice: "Glass for Kingsrest, very fragile, very odd. Nadia Ember, glassblower.",
      offer: "Years ago I made a glass that shows the street behind you, not in front. A Sister of the Order bought it, and then five more. Now she's written for a seventh. Sister Agnes, in Kingsrest. Take it to her, wrapped, face down, and whatever you do, don't look in it walking backwards.",
      at: "The seventh. Thank you. No, I won't say what for. The Order asks a great many things of me and I've learned not to wonder, only to keep them face down. Tell Nadia it's well made. The best yet.",
      done: "The best yet? She's never said that. She's never said anything. I'm going to burn my eyebrows off celebrating.",
      again: "She's written for another. That's eight. I've stopped asking.",
    },
  },
  {
    id: "ember_madder", region: "Emberwaste", kind: "escort", giver: "amira", place: "red_wash", about: "the madder roots",
    title: "Madder from the Red Wash", when: { day: true },
    foes: [["siege:ash_scarab", 1, 3], ["siege:hollow_footman", 0, 2, 2]],
    lines: {
      notice: "Rug-weaver wants walking to the Red Wash for dye roots. Amira Sol.",
      offer: "The red in my rugs comes from madder root, and the madder grows on the clay bank in the Red Wash, a long way west. I used to go with my sister. She's married now, and lazy. Walk with me, dig if you like, and keep the scarabs off my ankles. You'll have a rug. Not a funeral one.",
      while: ["Not that one. That one's for funerals.", "Look at the colour of it. That's a whole lord's hall."],
      done: "Enough red for a year. Here, a rug for your floor. Pick a colour. Not that one.",
      again: "Out of red again. The Red Wash, if you'll walk.",
    },
  },
  {
    id: "ember_sami", region: "Emberwaste", kind: "missing", giver: "jabir", place: "dry_well", about: "his grandson",
    title: "Sami went to the dry well", thing: "Sami", skin: "boy",
    lines: {
      notice: "Grandson missing. Fortune-teller would rather not have foreseen it. Old Jabir.",
      offer: "My grandson Sami. I told him his fortune for a joke. I said he'd find water where there's none. He went out to the old dry well east of town to prove me wrong, or right, I don't know which, and he's not come back, and I'm an old fool. Please.",
      found: "There's water down there! I heard it. Deep down, like someone pouring. Then it stopped and I couldn't climb out. Grandfather was right. He's always right. It's horrible.",
      while: ["Will you tell him I found it? He'll be so smug."],
      done: "He found water? Of course he did. The sand said so. I'll never tell another fortune for a joke.",
    },
  },
  {
    id: "ember_camel_bell", region: "Emberwaste", kind: "recover", giver: "haroun", place: "glass_flats", about: "the lead camel's bell",
    title: "The lead camel's bell", thing: "the lead camel's bell", site: "ember_glass_flats", find: "minecraft:bell",
    keepsake: ["minecraft:glass", "Lightning Glass", "Grown by itself, in a row. Nadia would give a lot for this."],
    lines: {
      notice: "Lost on the glass flats: a caravan bell, old, much loved. Haroun Dast, caravan master.",
      offer: "My lead camel lost her bell in the storm crossing the glass flats, south-east. The camels won't walk without it. They follow the sound, not me, which is fair, I'm not a sound. The flats are where the lightning grows glass in rows. Find the bell and bring it home.",
      while: ["Don't stand near the tall ones in a storm. That's how they grow."],
      seen: "Rows of glass stand out of the sand, straight as a ploughed field, every one fused where lightning struck. In the middle of the rows, the camel bell lies on its side, polished bright, its clapper wound round with thread.",
      done: "That's her bell. The camels are already kneeling. Here, a piece of the glass. Grown by itself, and Nadia will want it.",
    },
  },
  {
    id: "ember_rug", region: "Emberwaste", kind: "recover", giver: "bashir", place: "dye_house", about: "the last king rug",
    title: "The last king rug", thing: "a rolled rug with a king woven on it", site: "ember_dye_house", find: "minecraft:red_carpet",
    keepsake: ["minecraft:red_dye", "Old Madder Red", "Rubbed off the last king rug. It doesn't fade."],
    lines: {
      notice: "Stonecutter found something in the old dye-house and won't touch it. Bashir Kolt.",
      offer: "I went to the ruined dye-house in the Red Wash to cut stone, and under the fallen roof there's a rug, rolled, with a king woven on it. Amira's grandmother wove those, and the Order bought every one she made and burned them. Every one but this, I suppose. Bring it back for Amira. I'm not carrying a king about. I've enough trouble.",
      while: ["Lift it gently. It's older than the town."],
      seen: "Under the fallen roof beams, wrapped in sacking, a rolled rug. Its edge shows a king's hand, a ring on it, and the red is bright as new. Somebody's kept it dry all these years.",
      done: "Amira wept. She says it's her grandmother's work. She's put it face down under her own rug, where nobody will see it but her. Here, the colour came off on my hands. You have some.",
    },
  },
  {
    id: "ember_palms", region: "Emberwaste", kind: "look", giver: "yusuf", place: "palm_lean", about: "where the palms lean",
    title: "Where the palms lean", site: "ember_palm_lean",
    lines: {
      notice: "Date farmer wants to know what his palms are looking at. Yusuf Rahl.",
      offer: "The palms lean east, all of them, every one. But the wind comes from the west. They lean toward something. I've walked east and walked east and never found it. You've younger legs. Go out where the palms lean and tell me what's there.",
      seen: "Far out in the open sand, a single palm stands dead straight, grey and leafless, with a ring of stones round its foot. Every palm you can see leans toward it, and the sand round it is cool.",
      done: "One straight palm, and all the rest bowing to it. Well. I'll water the roots and not ask. That's the trick.",
    },
  },
  {
    id: "ember_cold", region: "Emberwaste", kind: "look", giver: "tariq", place: "cold_dune", about: "the cold on the dunes",
    title: "Frost on the sand", site: "ember_cold_dune", when: { night: true, notRaid: true },
    lines: {
      notice: "Guard wants a night look at the dunes east. Someone who doesn't scare. Tariq Vell.",
      offer: "Heat's fine. Raiders are fine. What I don't like is the cold that comes over the dunes some nights. Cold, here. Out east, on the high dune. Go out one night and see what's there. I'd go. But I'm the gate.",
      seen: "On the crest of the dune the sand is white with frost in the shape of a great ring, and your breath smokes. Footprints cross the ring, bare and narrow, and in the frost beside them something has drawn three short lines.",
      done: "Frost. Three lines. Right. I'll double the gate tonight and tell nobody why. That's guarding.",
    },
  },
  {
    id: "ember_well_lamps", region: "Emberwaste", kind: "watch", giver: "kadir", place: "well_house", about: "the well lamps",
    title: "Lamps at the well-house", need: [3, 4], site: "ember_well_lamps", when: { notRaid: true },
    foes: [["siege:hollow_footman", 2, 4]],
    lines: {
      notice: "Watch wanted at the well-house on the north road. Keep the lamps lit, keep the water safe. Kadir Oss.",
      offer: "The well-house on the north road waters every caravan coming down from the mesa. We keep lamps round it so drivers find it in the dark. Someone's putting them out, and in the morning there's sand in the well. Sit the night and keep every lamp burning till the sun.",
      while: ["Shade by noon or you're bread by evening. Light by dusk or you're lost by midnight."],
      done: "Every lamp lit, and the water sweet. Have a cup, on me. A whole cup. I'm feeling generous.",
      again: "The well-house lamps are going out again. Same as before, if you'll sit.",
    },
  },
  {
    id: "ember_goats", region: "Emberwaste", kind: "watch", giver: "sunscar_farmer", place: "oasis_pen", about: "the oasis goats",
    title: "Goats at the south oasis", need: [4, 6], site: "ember_oasis_pen", animal: "goat", when: { notRaid: true },
    foes: [["siege:ash_scarab", 2, 4]],
    lines: {
      notice: "Someone to sit up with the goats at the south oasis. One night. Farmer, Sunscar.",
      offer: "My goats graze the south oasis and sleep in a pen by the water. The scarabs come up out of the warm sand at night and go for their legs. Goats can climb, but they can't climb air. Sit with them till morning.",
      while: ["Don't let them see you're nervous. Goats can tell."],
      done: "All of them, and only one's eaten your bootlace. That's practically a parade.",
      again: "Scarabs at the oasis pen again. Same night, same goats.",
    },
  },
  // Act 2, step 7: the first job, the cart family's chest from their burned hamlet (story thread; first: offered alone,
  // and only while it is the player's Act 2 step: newplayer/act2.js filter "boardFirstJob")
  {
    id: "ember_family_chest", region: "Emberwaste", kind: "recover", giver: "tobin", place: "thornwell", about: "what's left at Thornwell",
    title: "What's left at Thornwell", thing: "the family's chest", site: "ember_burned_hamlet", find: "minecraft:chest", story: true, first: true,
    keepsake: ["minecraft:candle", "Marta's beeswax candle", "Hand-dipped. It burns longer than it should."],
    lines: {
      notice: "Wanted: somebody with a strong back to fetch what's left of our things from Thornwell. Tobin, thatcher, in the Longhouse.",
      offer: "I can't go back there, my lord. Marta won't have it, and she's right. But our chest is still in the last house on the lane, if the fire left it. Her mother's linen, the deed to our strip, the boy's spoon. Bring it out for us?\n\nAnd look at the doors while you're there. Tell me I'm wrong about the doors.",
      seen: "Every door in Thornwell is barred from the outside, a beam dropped into its brackets across each one. The scorch marks start inside the houses and climb out through the windows. The chest is in the last house, by what's left of the table. Nobody has touched it.",
      while: ["The last house on the lane. Under what's left of the table, if it's anywhere."],
      done: "That's it. That's all of it. ...You saw the doors. Barred from outside, every one, like I said. Raiders, the Order wrote. You've a book of your own now, my lord. Write it true.",
    },
  },
  // ---------------- Blackfen (Mirelight) ----------------
  {
    id: "fen_peat_camp", region: "Blackfen", kind: "camp", giver: "rufus", place: "peat_cuttings", about: "the peat cuttings",
    title: "Raiders in the peat cuttings", foes: TOLLMEN, site: "fen_peat_camp",
    lines: {
      notice: "Somebody's camped in my peat cuttings and burning my peat. Rufus Grimble.",
      offer: "North of town, the peat cuttings. Raiders have dug in there, in the cut banks, and they're burning my peat night and day, stacks of it. Peat burns slow. You don't burn that much unless you're drying something big. Go and stop them before they finish whatever it is.",
      while: ["Mind the cut edges. A bank goes, you go with it."],
      done: "Out? And the stacks? Half left. That'll do. It smells like old Tuesdays out there now, but it's my old Tuesdays.",
      again: "Smoke from the peat cuttings again. They like my peat. Everybody likes my peat.",
    },
  },
  {
    id: "fen_causeway", region: "Blackfen", kind: "camp", giver: "hal", place: "causeway", about: "the causeway",
    title: "The causeway toll", foes: TOLLMEN, site: "fen_causeway_camp",
    lines: {
      notice: "Boatman robbed on the old causeway. Wants it back. The causeway, not the money. Hal Toller.",
      offer: "The old causeway west of town is the only dry way in or out when the water's up. Raiders have built a camp across it with a barrier, and they take a toll off anybody walking through. I charge a penny across and two back. They charge everything you've got, both ways. It's unprofessional.",
      while: ["They've a barrier across the causeway. Go round it on the hummocks, if your boots are good."],
      done: "Open? Good. People can walk dry again and I can go back to charging them for the wet way.",
      again: "They're across the causeway again. Coming back's always dearer, I keep telling them.",
    },
  },
  {
    id: "fen_toads", region: "Blackfen", kind: "hunt", giver: "mirelight_hunter", place: "toad_pools", about: "the toad pools",
    title: "Toads that work out a price", mob: "siege:mire_toad", need: [3, 6], site: "fen_toad_pools",
    lines: {
      notice: "Mire toads too big round the west pools. Hunter wants a hand. Mirelight.",
      offer: "The toad pools west of town have got toads in them the size of a dog, and they've started looking at people like they're working out a price. One sat in the path all yesterday and wouldn't move for my cart. Thin them out. Take a long spear. Their tongues are longer than they look.",
      while: ["Keep moving. A toad that's got you standing still has got you."],
      done: "Quieter out there. Not quiet. The fen's never quiet. But quieter.",
      again: "The big ones are back in the toad pools. They grow fast on what they eat. I don't ask.",
    },
  },
  {
    id: "fen_hag", region: "Blackfen", kind: "hunt", giver: "moll", place: "drowned_alders", about: "the drowned alders",
    title: "The hag in the drowned alders", mob: "siege:bog_hag", need: [1, 2], when: { night: true }, site: "fen_drowned_alders",
    lines: {
      notice: "Herb-woman needs the drowned alders safe to pick in. Moll Fenwick.",
      offer: "The best sundew grows under the drowned alders, south-west. Something's living there that isn't me and isn't kind. A bog hag, Old Mag would say. She calls you by your name from behind you, and you mustn't turn round. Go at night when she's out, and don't answer her.",
      while: ["Don't answer. Whatever name she uses. Especially if it's yours."],
      done: "Gone? I'll go picking at dawn. Sundew for the cough, and a stiff drink for my nerves.",
      again: "There's another in the drowned alders. They like it there. I like it there. We can't both have it.",
    },
  },
  {
    id: "fen_stragglers", region: "Blackfen", kind: "hunt", giver: "hester", place: "east_boardwalk", about: "the men in the weirs",
    title: "Men standing in the eel weirs", mob: "siege:hollow_footman", need: [5, 9], when: { after: "siegeWon" },
    lines: {
      notice: "Raiders standing in my eel weirs since the raid. Eel-wife wants them out. Hester Mallow.",
      offer: "After the raid some of them walked into the water off the east boardwalk and stood there, up to the knees, in my weirs. Don't move. Don't eat. The eels won't come near. If the eels are frightened of a thing, I want it gone.",
      while: ["The eels are hiding under the boardwalk. Smart eels."],
      done: "Weirs are clear. Eels are back. Angry, but back. Eels are always angry.",
      again: "More of them in the weirs after the raid. Same knees-deep, same staring.",
    },
  },
  {
    id: "fen_glass", region: "Blackfen", kind: "supply", giver: "mirelight_factor", about: "lantern glass",
    title: "Glass for the boardwalk lanterns", item: "minecraft:glass_pane", need: [8, 16],
    lines: {
      notice: "Lantern glass wanted. Gertie's breaking faster than we can buy. Factor, Mirelight.",
      offer: "Gertie Lantern keeps thirty-one lanterns on the boardwalks and the glass in them keeps cracking. Not falling, cracking, in the night, all in the same shape, like a hand pressed on it. We've no glassblower in the fen. Bring panes and I'll pay above the Vale price.",
      while: ["Panes. Whole ones. A cracked pane's worse than none out here."],
      done: "That'll glaze every lantern twice. Gertie says thank you. She said it to the lanterns first, mind.",
      again: "Cracked glass again, the same shape. Gertie needs panes.",
    },
  },
  {
    id: "fen_bread", region: "Blackfen", kind: "supply", giver: "mirelight_farmer", about: "the flood bread",
    title: "Bread for the flooded farms", item: "minecraft:bread", need: [12, 24],
    lines: {
      notice: "The water's up and the outlying farms are cut off. Bread wanted. Farmer, Mirelight.",
      offer: "The water's come up over the low fields and the outlying farms can't get to market. Five families on the hummocks with nothing but eels, and you can only eat so much eel before you start to look like one. Bring bread and I'll punt it out.",
      while: ["Loaves, not flour. They've no dry oven out there."],
      done: "That'll see them through the week. They'll be counting their children and their loaves both, now.",
      again: "Water's up again. More bread for the hummocks, if you've got it.",
    },
  },
  {
    id: "fen_sundew", region: "Blackfen", kind: "carry", giver: "moll", to: "ames", about: "a bundle for Kingsrest",
    title: "Sundew for the Kingsrest herb seller", thing: "a bundle of dried sundew", find: "minecraft:short_grass",
    lines: {
      notice: "Herbs for Kingsrest, dried, light, don't sit on them. M. Fenwick.",
      offer: "Goodwife Ames sells herbs in Kingsrest, and she's sent all the way out here for sundew. Nothing in the Vale cures a cough like it. Take her this bundle. If anyone in the fen offers to swap you something for it on the way, say no. Say no to everything out here, it's safest.",
      at: "Sundew! Proper fen sundew! Oh, I've coughs all over Kingsrest waiting for this. Tell Moll I'll send her feverfew from Wren Water. Fair swap, and she knows it.",
      done: "Feverfew? Good. Ames always pays her debts. Most folk don't, and out here a debt has a way of being collected.",
      again: "Ames wants more sundew. The Vale's got a cough that won't quit.",
    },
  },
  {
    id: "fen_buckle", region: "Blackfen", kind: "carry", giver: "kit", to: "tilda", about: "a buckle for Millbrook",
    title: "A buckle out of the mud", thing: "a mud-larked buckle with a crown on it", find: "minecraft:gold_nugget",
    lines: {
      notice: "Found something old in the mud. Want it looked at by somebody who knows stories. Kit Hollin, mud-larker.",
      offer: "I lark the mud at low water for things folk dropped. Mostly spoons. Yesterday, a buckle, gold, with a crown on it and a bell under the crown. Nobody here knows what it is. They say Old Tilda in Millbrook knows every story there is. Take it to her and ask what it's from.",
      at: "A crown over a bell. That's a royal rider's buckle, from when the old kings sent riders out through the fen with the news. They'd ring a bell at every village, so folk knew to come and hear. Nobody's rung one for three hundred years. Give it back to the lad. Tell him to keep it safe. Tell him it's a good story.",
      done: "A royal rider's? With a bell? I'm keeping it. I'm going to ring something with it. Not a bell. I haven't got a bell.",
      again: "Found another one! Different buckle, same crown. There must have been a lot of riders. Off to Tilda again?",
    },
  },
  {
    id: "fen_reeds", region: "Blackfen", kind: "escort", giver: "gideon", place: "reed_bed", about: "the great reed bed",
    title: "Cutting in the great reed bed", when: { day: true },
    foes: [["siege:mire_toad", 1, 3], ["siege:hollow_footman", 0, 2, 2]],
    lines: {
      notice: "Reed-cutter wants company in the great reed bed. Bring a sword and a whistle. Gideon Reedly.",
      offer: "The best reed's in the great reed bed north-west, tall as a house. Thatch reed. But there's things in there now, big toads, and the fog comes in quick. Walk with me while I cut. If the fog comes, whistle, so I don't walk into you, and so nothing else does either.",
      while: ["Cut low, bundle tight, keep your feet dry. Two out of three.", "Hear that? No? Good. Keep not hearing it."],
      done: "Bundles enough for six roofs. Here, a reed whistle. Blow it in the fog and folk know you're folk.",
      again: "Roofs are leaking again. The reed bed, if you'll walk.",
    },
  },
  {
    id: "fen_pip", region: "Blackfen", kind: "missing", giver: "wilma", place: "willow_hummock", about: "Pip Rush",
    title: "Pip followed the lights", thing: "Pip Rush", skin: "girl",
    lines: {
      notice: "My girl Pip is missing. Please. Wilma Rush, the basket-weaver.",
      offer: "My Pip. I count them every morning, everyone in Mirelight does, and this morning I counted one short. Her bed's cold. Hal says there were lights moving out south, past the willow hummock, last night. She's seven. She'd follow a light. Please, go and find her, and when you find her, look at her hands. Just look.",
      found: "There was a lady with a lantern, and she knew my name, and she said Mam had sent her. Then the lantern went out and she wasn't there and I was here. I'm cold. Is it morning?",
      while: ["You're holding my left hand. Mam always holds my left hand. You're all right then."],
      done: "Her hands are her hands. She's my Pip. Thank you. I'm going to count her every hour for a month.",
    },
  },
  {
    id: "fen_first_lantern", region: "Blackfen", kind: "recover", giver: "kit", place: "old_lantern_post", about: "the first lantern",
    title: "The first lantern", thing: "the first boardwalk lantern", site: "fen_lantern_post", find: "minecraft:lantern",
    keepsake: ["minecraft:candle", "The First Wick", "Still burning a little. It doesn't go out."],
    lines: {
      notice: "Mud-larker after something big this time. Kit Hollin.",
      offer: "Gertie's family has kept the lanterns nine generations, and nobody remembers who for. Her gran said the first lantern of all hung on a lone post out west, past where the boardwalk ends, and fell in the mud long ago. I've found the post. The lantern's in the mud at its foot. Too deep for me. Not for you.",
      while: ["Stand still in the soft bits. Struggling makes it worse."],
      seen: "A lone black post leans out of the fen with an iron hook at its top. In the mud at its foot, a small old lantern, its glass whole, and inside it, impossibly, a wick still burning low.",
      done: "Still lit. After all that time in the mud. Gertie's sitting with it and won't speak. Here, she trimmed the wick and wants you to have the end. It won't go out.",
    },
  },
  {
    id: "fen_spade", region: "Blackfen", kind: "recover", giver: "rufus", place: "deep_cutting", about: "his peat spade",
    title: "The spade by the bog man", thing: "Rufus's peat spade", site: "fen_deep_cutting", find: "minecraft:iron_shovel",
    keepsake: ["minecraft:mud", "A Clod of Warm Peat", "Still warm. Like something under it breathes."],
    lines: {
      notice: "Peat-digger left his spade somewhere he'd rather not go back to. Rufus Grimble.",
      offer: "I dug up a bog man once, in the deep cutting north-west of town. Very peaceful. Still had his supper in his hand. I put him back and said sorry. Last week I was cutting there again and he was up. Just a hand, out of the peat. Holding my spade. I didn't argue. Go and get it, would you? Say sorry again from me.",
      while: ["The peat's warm down there. Don't think about why."],
      seen: "In the black wall of the deep cutting a hand of brown leather reaches out of the peat, palm up, as if offering. Rufus's spade lies across it. When you lift the spade the hand stays open.",
      done: "He gave it back? Good. Polite, the old ones. Here, a clod off the cutting. It's warm. They're always warm, down deep.",
    },
  },
  {
    id: "fen_lights", region: "Blackfen", kind: "look", giver: "wat_sedgely", place: "fen_lights", about: "the moving lights",
    title: "Lights that aren't lanterns", site: "fen_moving_lights", when: { night: true, notRaid: true },
    lines: {
      notice: "Ferry-hand wants someone sensible on the open fen at night. Just to look. Wat Sedgely.",
      offer: "Some of the lights out on the fen aren't lanterns. They move when you look away. North-east of town, on the open fen, there's a lot of them lately. Go and look. Don't follow them. Look, and come back, and tell me how many.",
      seen: "Small lights hang over the open fen, a hand above the water, too steady for candles. You count nine. You look down at your feet and look back, and they are in a line, much closer, and there are ten.",
      done: "Ten. Last week Hal counted eight. Right. I'll keep the ferry tied up nights. Thank you for not following them.",
    },
  },
  {
    id: "fen_quiet_toads", region: "Blackfen", kind: "look", giver: "ambrose", place: "toad_ring", about: "the quiet toads",
    title: "The toads go quiet", site: "fen_toad_ring", when: { night: true, notRaid: true },
    lines: {
      notice: "Frog-catcher wants someone at the round pool one night to see why it's quiet. Ambrose Croaker.",
      offer: "The toads go quiet some nights. All of them. The silence is louder than the croaking ever was. Most of all at the round pool, east of town. Go out there one night and see what they're doing. They're not hiding, I know that much. I've looked.",
      seen: "Round the edge of the round pool the toads sit in a ring, hundreds of them, every one facing the middle, not one making a sound. In the middle of the pool the water is perfectly still, and the reflection of the moon is the wrong shape.",
      done: "All facing in. And the moon wrong. Well, I won't catch any tonight, then. Some nights you leave the fen to itself.",
    },
  },
  {
    id: "fen_lanterns", region: "Blackfen", kind: "watch", giver: "gertie", place: "far_boardwalk", about: "the far lanterns",
    title: "The lanterns on the far boardwalk", need: [3, 4], site: "fen_far_boardwalk", when: { notRaid: true },
    foes: [["siege:mire_toad", 1, 2], ["siege:hollow_footman", 1, 3, 1]],
    lines: {
      notice: "Somebody to stand the night on the far boardwalk and keep my lanterns lit. Gertie Lantern.",
      offer: "The far boardwalk, east, past the last houses. Thirty-one lanterns on the whole walk, and the last few out there keep going dark, one by one, before midnight. Lanterns on the boardwalks are for the lost. Don't ever let one go out. Stand there till dawn and light them again when they go.",
      while: ["Thirty-one lanterns. Thirty-one wicks. Count the shadows if you like. I don't."],
      done: "Every one lit at dawn. I could kiss you. I won't. Lantern-keepers don't. Here, take some wick.",
      again: "The far lanterns are going out again. Same walk, same night.",
    },
  },
  {
    id: "fen_pigs", region: "Blackfen", kind: "watch", giver: "mirelight_farmer", place: "pig_hummock", about: "the hummock pigs",
    title: "Pigs on the hummock", need: [4, 6], site: "fen_pig_pen", animal: "pig", when: { notRaid: true },
    foes: [["siege:mire_toad", 2, 4]],
    lines: {
      notice: "Pig-watch wanted on the east hummock. One night. Farmer, Mirelight.",
      offer: "My pigs live on the hummock east of town, the only dry ground for a mile. The big toads have found them. They come up out of the water at night and you hear a squeal and then you don't. Sit with them till morning. Pigs are good company. Better than toads.",
      while: ["If a pig goes quiet, look where it's looking."],
      done: "Every pig, and fatter for the fright. Here's a ham. Not one of these. An older one.",
      again: "Toads at the pig hummock again. Same as before, if you'll sit up.",
    },
  },
  // Act 2, step 7: the first job, the cart family's chest from their burned hamlet (story thread; first: offered alone,
  // and only while it is the player's Act 2 step: newplayer/act2.js filter "boardFirstJob")
  {
    id: "fen_family_chest", region: "Blackfen", kind: "recover", giver: "tobin", place: "rushby", about: "what's left at Rushby",
    title: "What's left at Rushby", thing: "the family's chest", site: "fen_burned_hamlet", find: "minecraft:chest", story: true, first: true,
    keepsake: ["minecraft:candle", "Marta's beeswax candle", "Hand-dipped. It burns longer than it should."],
    lines: {
      notice: "Wanted: somebody with a strong back to fetch what's left of our things from Rushby. Tobin, thatcher, in the Longhouse.",
      offer: "I can't go back there, my lord. Marta won't have it, and she's right. But our chest is still in the last house on the lane, if the fire left it. Her mother's linen, the deed to our strip, the boy's spoon. Bring it out for us?\n\nAnd look at the doors while you're there. Tell me I'm wrong about the doors.",
      seen: "Every door in Rushby is barred from the outside, a beam dropped into its brackets across each one. The scorch marks start inside the houses and climb out through the windows. The chest is in the last house, by what's left of the table. Nobody has touched it.",
      while: ["The last house on the lane. Under what's left of the table, if it's anywhere."],
      done: "That's it. That's all of it. ...You saw the doors. Barred from outside, every one, like I said. Raiders, the Order wrote. You've a book of your own now, my lord. Write it true.",
    },
  },
];

// Shared jobs: ten that can turn up in any region (Mateo 2026-11-14, "lets go"). Every town has a smith, a farmer and a
// factor (economy/config.js TOWNS), so a shared job names a `role` instead of a giver: in each region it is given by
// that role in the region's own town (ROLE_TOWN). A shared job lives in one region at a time and moves on as your
// rounds turn (board_rules.js sharedHome), so it never shows on every board at once.
//   {town}: the giver's town. {to}: the town a Carry goes to (`toRole` there, in a neighbouring region).
//   places: { region: PLACES key } for a job that happens somewhere. {place}: that place's name.
// Ids are `<id>_<region short>` once expanded (board_rules.js): never rename the base ids either.
export const ROLE_TOWN = {
  "Aldmere Vale": ["kingsrest", "vale"], Frostmarch: ["rimehold", "frost"], Saltreach: ["gulls", "salt"],
  Emberwaste: ["sunscar", "ember"], Blackfen: ["mirelight", "fen"],
};
export const SHARED_JOBS = [
  {
    id: "any_gate_iron", kind: "supply", role: "smith", about: "iron for the gates", title: "Iron bands for the gate",
    item: "minecraft:iron_ingot", need: [6, 14],
    lines: {
      notice: "Iron wanted for gate bands. Every gate on the roads is getting them this year. The {town} smith.",
      offer: "Every town on the roads is putting iron on its gates this year, and every smith is short. Nobody's said why out loud. They just come in and ask for bands, and look at the road while they ask. Bring me iron and {town}'s gate gets its bands before the next lot of them.",
      again: "More gates, more bands. I'm out of iron again.",
      done: "That's a gate that'll hold. For a while. Here, for your trouble.",
    },
  },
  {
    id: "any_bow_string", kind: "supply", role: "smith", about: "string for the bows", title: "String for the wall bows",
    item: "minecraft:string", need: [8, 18],
    lines: {
      notice: "String wanted, lots of it. The wall's bows are all drawn and half of them are fraying. The {town} smith.",
      offer: "I do the arrowheads, the bowyer does the rest, and the bowyer's run out of string. Every man on the wall wants a spare bow now, not just a bow. Bring string. Not wool. String. I've had wool brought and I've had to explain.",
      again: "String again. They're snapping them faster than we can make them.",
      done: "Good, strong string. The wall will thank you, and it doesn't thank anybody.",
    },
  },
  {
    id: "any_carters_bread", kind: "supply", role: "factor", about: "bread for the carters", title: "Bread for the carters",
    item: "minecraft:bread", need: [8, 20],
    lines: {
      notice: "Bread for the carters before they set out. They won't stop on the road to cook. The {town} factor.",
      offer: "The carters used to stop and light a fire on the road. They don't any more. They drive straight through, day and dusk, and they won't say why, only that they'd rather not be sitting still out there. So they need bread they can eat on the box. Bring me bread.",
      again: "The carters want bread again. They're driving longer every week.",
      done: "That'll see the carts out and back. Here. The carters say thank you, from the box, not stopping.",
    },
  },
  {
    id: "any_watch_cloaks", kind: "supply", role: "factor", about: "wool for the watch cloaks", title: "Cloaks for the night watch",
    item: "minecraft:white_wool", need: [6, 16],
    lines: {
      notice: "Wool wanted for night-watch cloaks. The watch is doubled and the cloaks are not. The {town} factor.",
      offer: "The watch is doubled at night now, in {town} and everywhere else I hear of. Twice the men on the wall means twice the cloaks, and the nights are colder than they used to be. Nobody can say why that is either. Bring me wool and I'll have the cloaks sewn.",
      again: "More watchmen, more cloaks. Wool, if you've got it.",
      done: "Good. Nobody should stand a night watch cold. You stand there long enough cold and you start seeing things.",
    },
  },
  {
    id: "any_fence_oak", kind: "supply", role: "farmer", about: "oak for the fences", title: "Something leans on the fences",
    item: "minecraft:oak_log", need: [8, 20],
    lines: {
      notice: "Oak wanted for new fence posts. Mine keep leaning. The {town} farmer.",
      offer: "My fence posts lean. Not fall. Lean, all of them the same way, a bit more every morning, like something big was leaning on them all night to look in at the animals. I've stopped going out to look at night. I want new posts, oak, thick ones. Bring me oak.",
      again: "They're leaning again. Same way. More oak, if you've got it.",
      done: "Thick posts. Let it lean on those. Here, and thank you.",
    },
  },
  {
    id: "any_winter_wheat", kind: "supply", role: "farmer", about: "wheat for the store", title: "Wheat for the winter store",
    item: "minecraft:wheat", need: [12, 28],
    lines: {
      notice: "Wheat wanted for the town store. Every barn's to be full by first frost. The {town} farmer.",
      offer: "Word's come round from every town on the roads: fill the barns early this year. Nobody's ordered it. It's just what everyone's doing, the way birds all go at once. My harvest was short. Bring me wheat and {town} won't be the town that wasn't ready.",
      again: "The store's down again. Folk are eating like they're worried. Bring wheat.",
      done: "That's a fuller barn. I sleep better with a full barn. I sleep better than I did, anyway.",
    },
  },
  {
    id: "any_tally_book", kind: "carry", role: "factor", toRole: "factor", about: "the tally book", title: "The tally book",
    thing: "the tally book", find: "minecraft:book",
    lines: {
      notice: "Tally book to go to the factor in {to}. Our numbers and theirs need to agree. The {town} factor.",
      offer: "Every cart that crosses between us and {to} goes in my book, and in theirs. This season the books don't agree. Carts they counted out never reached me. Not robbed, mind. Just never arrived, horse and all. Take my book to the factor in {to} and let them see for themselves.",
      again: "The books are out again. More carts that never came. Take it over.",
      at: "Same carts missing in mine. Same days. Tell your factor I've marked them both, and that I'm sending nothing on that road after dark till we know.",
      done: "Same carts, same days. I thought so. I'll not send anything at dusk now. Thank you.",
    },
  },
  {
    id: "any_snapped_blade", kind: "carry", role: "smith", toRole: "smith", about: "a snapped blade", title: "A blade that snapped clean",
    thing: "the snapped blade", find: "minecraft:iron_sword",
    lines: {
      notice: "Old blade, broken. Want another smith's eye on it. The {town} smith.",
      offer: "A man brought me a sword that snapped clean in half in his hands. Not in a fight. He was holding it on the wall at night and it went cold, he said, colder and colder, and then it broke. It's old work. Better than mine. The smith in {to} knows old work. Take it to them and ask what they make of it.",
      again: "Another one broke the same way. Same cold. Take it over, would you?",
      at: "Look at the break. Clean as glass. I've seen that once before, on a blade my old master kept wrapped up and wouldn't talk about. Tell your smith to keep iron by the door and not to ask me any more than that.",
      done: "Iron by the door. Right. I'll not ask. I'll do it, though.",
    },
  },
  {
    id: "any_seed_swap", kind: "carry", role: "farmer", toRole: "farmer", about: "the seed swap", title: "Seed corn for {to}",
    thing: "a sack of seed corn", find: "minecraft:wheat_seeds",
    lines: {
      notice: "Seed corn to go to the farmer in {to}. A swap, an old custom. The {town} farmer.",
      offer: "Every autumn the farms swap seed with the next region over. Keeps the corn strong, my grandad said. This year's the first in a long while anyone's bothered, and every farmer I know is doing it, like we all remembered at once. Take this sack to the farmer in {to}.",
      again: "Another sack for {to}. They sent theirs, I owe them.",
      at: "Seed from over the border. Good. My grandmother swore by it. She said the old kings had it done every year, so the realm grew as one field. Funny thing to remember now. Tell your farmer I'll send mine back with the next cart.",
      done: "One field, she said? I like that. Here, for the walk.",
    },
  },
  {
    id: "any_herald_road", kind: "look", role: "factor", about: "the road at night", title: "Bells on the road at night",
    places: { "Aldmere Vale": "bellhollow_road", Frostmarch: "watchtower_pass", Saltreach: "cliff_road_way", Emberwaste: "caravan_road", Blackfen: "causeway" },
    when: { night: true, notRaid: true },
    lines: {
      notice: "Someone to walk {place} one night and tell me what rings there. The {town} factor.",
      offer: "The carters say they hear a bell on {place} at night. A small one, like a rider's, coming up behind them. They look round and the road's empty, and the bell goes on past them, up the road, and stops. Walk it one night. Tell me if it's carters' talk.",
      seen: "On {place} in the dark you hear it: a small bell, coming up behind you at a rider's pace. Nothing passes. The ringing goes by close enough to touch, on up the road, and stops. In the dust ahead there are hoofprints, old and shod, that start nowhere.",
      done: "A rider's bell, and nobody riding. I'll tell the carters it's real and to let it pass. Seems polite.",
    },
  },
];
