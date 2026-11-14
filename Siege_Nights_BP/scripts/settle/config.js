// Settlement building for The Hollow Crown: every number and list Mateo might want to tweak.
// Pure data, loads in Node.

export const SETTLE = {
  // Building outside your land. "map" = forbidden once the map has Plot Stones (test worlds stay free),
  // "always" = forbidden everywhere, "off" = allowed. /scriptevent siege:settle_wilds changes it in a world.
  wilds: "map",
  reserveMargin: 3, // clear blocks kept around the biggest hall your cornerstone can grow into
  // Prices below are in lots. A lot was one emerald and is 8 coins of the world currency (wallet.js, coins.js).
  localBonus: 1.5, // your own region's materials: this many times more blocks per lot
  maxSpend: 32, // most lots one purchase can buy
  maxBenches: 2, // Mason's Benches per settlement
  riseTicks: 160, // about how long a pre-designed building takes to rise (160 = 8 seconds)
  firstBuildRenown: 40, // Renown the first time you raise each kind of building
  previewSeconds: 90, // how long the outline of a chosen building stays up
  // What a building costs on a town plot (Plot Marker), in lots, paid from the purse. The library comes free on arrival.
  plotPrices: { cottage: 6, well: 3, garden: 5, market: 10, library: 8, watchtower: 8, smithy: 12, stable: 14,
    house: 9, townhouse: 13, farmhouse: 10, mint: 14, inn: 16,
    barracks: 2, // the Barracks opens with the Hamlet and is cheap: the first guards are what the first siege needs
    quartermaster_desk: 3 },
};

// Out in the wilds you can still make camp. Anything matching one of these can be placed anywhere.
export const CAMP_KIT = [
  /torch$/, /^minecraft:(ladder|scaffolding|crafting_table|furnace|campfire|soul_campfire|chest|barrel|bed)$/,
  /_bed$/, /sapling$/, /^minecraft:(mangrove_propagule|bamboo|sugar_cane|reeds)$/,
];

// The reserve around your hall takes nothing but these (they are lost or replaced when the hall grows).
export const RESERVE_ALLOWED = [/^siege:hall_cornerstone$/, /^siege:keep_banner$/, /^siege:archive_shelf$/, /torch$/, /^minecraft:lantern$/];

export const REGION_TO_STYLE = {
  "Aldmere Vale": "vale", Frostmarch: "frostmarch", Saltreach: "saltreach", Emberwaste: "emberwaste", Blackfen: "blackfen",
};

// ---------- The mason's stock ----------
// [item id, blocks per emerald]. Ids the running game doesn't know are left out of the shop.
// The Castle Stone family is stocked separately (STONE_RATE below). Gates, battlements and the other
// siege blocks are NOT sold: those stay crafted.
const m = (id) => `minecraft:${id}`;
export const CATALOG = [
  { name: "Stone", icon: "textures/blocks/stonebrick", stock: [
    [m("cobblestone"), 32], [m("stone"), 24], [m("stone_bricks"), 16], [m("mossy_stone_bricks"), 12], [m("andesite"), 24],
    [m("polished_andesite"), 16], [m("cobbled_deepslate"), 24], [m("deepslate_bricks"), 16], [m("polished_deepslate"), 16],
    [m("calcite"), 12], [m("sandstone"), 24], [m("smooth_sandstone"), 16], [m("red_sandstone"), 16], [m("mud_bricks"), 16],
    [m("brick_block"), 12], [m("gravel"), 32],
  ] },
  { name: "Timber", icon: "textures/blocks/planks_spruce", stock: [
    [m("oak_planks"), 32], [m("spruce_planks"), 32], [m("birch_planks"), 32], [m("dark_oak_planks"), 32], [m("acacia_planks"), 32],
    [m("mangrove_planks"), 32], [m("oak_log"), 12], [m("spruce_log"), 12], [m("birch_log"), 12], [m("dark_oak_log"), 12],
    [m("acacia_log"), 12], [m("mangrove_log"), 12], [m("stripped_spruce_log"), 12],
  ] },
  { name: "Stairs, slabs and walls", icon: "textures/blocks/cobblestone", stock: [
    [m("stone_brick_stairs"), 12], [m("stone_brick_slab"), 24], [m("stone_brick_wall"), 12], [m("cobblestone_wall"), 16],
    [m("oak_stairs"), 16], [m("oak_slab"), 32], [m("spruce_stairs"), 16], [m("spruce_slab"), 32], [m("dark_oak_stairs"), 16],
    [m("dark_oak_slab"), 32], [m("birch_stairs"), 16], [m("birch_slab"), 32], [m("sandstone_stairs"), 12], [m("sandstone_slab"), 24],
  ] },
  { name: "More stone", icon: "textures/blocks/stonebrick", stock: [ // every stone a wall can be built in (WALL_STONES)
    [m("smooth_stone"), 16], [m("chiseled_stone_bricks"), 12], [m("tuff"), 24], [m("tuff_bricks"), 16],
    [m("polished_tuff"), 16], [m("cut_sandstone"), 16], [m("chiseled_sandstone"), 12], [m("cut_red_sandstone"), 16], 
    [m("diorite"), 24], [m("polished_diorite"), 16], [m("polished_granite"), 16], [m("quartz_bricks"), 8], [m("smooth_quartz"), 8],
    [m("packed_mud"), 16], [m("mossy_cobblestone"), 16], [m("blackstone"), 16], [m("polished_blackstone"), 12], [m("polished_blackstone_bricks"), 12],
  ] },
  { name: "Roofing", icon: "textures/blocks/deepslate/deepslate_tiles", stock: [
    [m("deepslate_tiles"), 12], [m("deepslate_tile_stairs"), 8], [m("deepslate_tile_slab"), 16], [m("dark_prismarine"), 8],
    [m("dark_prismarine_stairs"), 6], [m("orange_terracotta"), 12], [m("white_terracotta"), 12], [m("moss_block"), 16],
  ] },
  { name: "Doors, glass and fences", icon: "textures/blocks/glass", stock: [
    [m("glass"), 12], [m("glass_pane"), 24], [m("wooden_door"), 4], [m("spruce_door"), 4], [m("dark_oak_door"), 4],
    [m("trapdoor"), 6], [m("spruce_trapdoor"), 6], [m("oak_fence"), 12], [m("spruce_fence"), 12], [m("fence_gate"), 6],
    [m("spruce_fence_gate"), 6], [m("iron_bars"), 8], [m("ladder"), 16],
  ] },
  { name: "Light and comfort", icon: "textures/items/lantern", stock: [
    [m("torch"), 16], [m("lantern"), 4], [m("campfire"), 2], [m("iron_chain"), 8], [m("chain"), 8], [m("bookshelf"), 3],
    [m("hay_block"), 8], [m("white_wool"), 8], [m("red_carpet"), 16], [m("blue_carpet"), 16], [m("green_carpet"), 16],
    [m("flower_pot"), 4], [m("chest"), 2], [m("barrel"), 2],
  ] },
];

// Roles of a regional style that count as that region's "local materials"
export const LOCAL_ROLES = ["foundation", "wall", "wallLow", "wallUpper", "floor", "pillar", "beam", "roofBlock", "roofStair", "roofSlab", "crenel", "rail"];
// The Castle Stone family (five blocks per region, ids from siege/constants.js): blocks per coin.
// Castle Stone itself is the wall block that can be reinforced, so it costs the most.
export const STONE_RATE = { stone: 8, tiles: 12, bricks: 12, cobbled: 16, smooth: 12 };
export const LOCAL_RATE = 16; // blocks per emerald for a local material the stock list doesn't price

// What pre-designed buildings are paid in. The mason supplies what you lack at these rates.
export const MATERIAL_RATE = { timber: 32, stone: 24 }; // blocks per emerald

// ---------- What the mason says ----------
export const MASON_LINES = {
  day: [
    "Stone's cut and stacked. Tell me what you're raising and I'll tell you what it takes.",
    "A settlement is only a camp until somebody builds a second house.",
    "I sell by the cartload. You carry it, you lay it, you take the credit.",
    "Build wide before you build tall. The ground here remembers weight.",
    "Leave room round your hall. They always grow, and they never ask first.",
  ],
  night: [
    "I don't cut after dark. The stone rings wrong then. Buying, though, I'll do.",
    "Keep it quick. I like a roof over me by this hour.",
    "You hear that? No. Nor did I. What do you need?",
    "Walls first, I'd say, on a night like this. But it's your coin.",
  ],
  noLand: "You've no land to lay it on yet. Click a free Plot Stone, raise your banner and come back. I'll sell to you all the same.",
};

// ---------- Town plots and charters (Plot Markers, charters.js) ----------
// The tier each building first opens at (0 Hamlet, 1 Town, 2 City, 3 Castle). This used to be read from the
// old fixed layout (layout.js). Farmhouse, Mint, Inn and Barracks are listed ahead of their plot designs.
export const OPENS_AT = {
  cottage: 0, house: 0, well: 0, library: 0, townhouse: 1, market: 1, garden: 1, farmhouse: 1, mint: 1,
  smithy: 2, stable: 2, inn: 2, barracks: 0, watchtower: 3,
  // the Storehouse is no plot building any more: every settlement gets one with its Hamlet (storehouse.js)
  ironworks: 0,
  quartermaster_desk: 2, // the Quartermaster's Armoury, a City building: every Hamlet plot is taken (the two starting houses, the
  // Library, the Barracks' deep Large, the Works yard) and the Town's Mediums go to the Farmhouse and the Mint (2026-11-14)
};

// The plot size each building takes. Plots: S Small 9x13, M Medium 11x15, ML long Medium 13x15, L Large 15x15,
// G Great 21x21, W Works 27x17. A building goes on a plot of its own size, or a size listed under PLOT_ALSO.
export const PLOT_SIZE = {
  cottage: "S", well: "S", garden: "S", watchtower: "S",
  house: "M", smithy: "M", farmhouse: "M", mint: "M",
  townhouse: "ML",
  stable: "ML", library: "ML",
  inn: "L", barracks: "L",
  market: "S", // the stall is 7 x 5: a Small plot, so every Town has room for it (it asked for a Large until 2026-11-14)
  quartermaster_desk: "M", // the armoury is 11 x 12
  ironworks: "W", // Works plots (27 x 17) take the machines and nothing else (buildings.js WORKS)
};
export const PLOT_ALSO = {
  market: ["M", "ML", "L"], // and any bigger plot
  farmhouse: ["ML"],
  house: ["ML"],
  library: ["L"], stable: ["L"], townhouse: ["L"],
  quartermaster_desk: ["ML"], // never a Large: the Hamlet's one Large is the Barracks'
};
// Only when the town has no free plot of the building's own size or PLOT_ALSO sizes left
export const PLOT_FALLBACK = {}; // (the barracks' plain-Medium fallback is gone: the guardhouse never fit one, 2026-11-13)
// The smallest plot box a building stands on: [width along the door side, depth]. The guardhouse (every region,
// barn_data.js) is 15 x 17, so only a deep Large holds it (the town generator gives every layout one by the City).
export const PLOT_MIN_BOX = { barracks: [15, 17] };

// Where on the map a building wants to be, from the plot's tags (wall, corner, square, gate, road_front,
// field_edge, hall, library). needs: the plot must have one of them. prefer: listed first in the menu.
export const PLOT_TAGS = {
  watchtower: { needs: ["wall", "gate", "corner"] },
  well: { prefer: ["square"] },
  market: { prefer: ["gate", "road_front", "square"] },
  garden: { prefer: ["field_edge"] },
  farmhouse: { prefer: ["field_edge"] },
  library: { prefer: ["library", "square"] },
  ironworks: { prefer: ["water"] }, // its last stage turns a waterwheel
  inn: { prefer: ["gate", "road_front", "square"] },
  barracks: { prefer: ["gate", "wall"] },
};
export const TAG_WORDS = { wall: "by the wall", gate: "by a gate", corner: "on a corner", square: "on the square", road_front: "on the main road", field_edge: "by the fields", hall: "by the hall", library: "set aside for the library", hall4: "on ground the hall will need at level 4", hall5: "on ground the hall will need at level 5", water: "by water" };

// One of each per settlement (Mateo 2026-11-14: "only one of special buildings can be built"). A second can't be
// picked at a Plot Marker, counted as hand-built, raised by a Rival Lord, or set down as a block on the same
// settlement's land; writ allies building in a shared settlement share the limit. Ids are plot buildings
// (buildings.js) and raising blocks without "siege:" (blockdesigns.js). The Ironworks, Stables and Rail Depot keep
// their own one-a-settlement rules (ironworks/, horses/barn.js, rails/). Homes, farms, wells, markets and the rest
// stay unlimited.
export const ONE_EACH = ["library", "mint", "inn", "barracks", "quartermaster_desk", "dragon_roost"];

// ---------- Stages: what each settlement level builds (Mateo 2026-11-14) ----------
// "You need to place every building for the settlement stage you're on in order to level up", "every placeable
// building needs a plot", "the story (tutorial) takes you through this". So this one table says, for each tier, the
// buildings you must build there (on a plot from its Plot Marker, never from a block), how many homes in all, and
// the story step that sends you to each. The level-up charters (CHARTERS below) are made from it, the town
// generator reads the same lists (map/structures/stages.json, tools/export_stages.mjs), and settle/stages.js plus
// the self-tests check it against every layout. Plan: https://claude.ai/artifact/MHAFrsXtYdx4dEwjFJu5X8
//   id: a plot building (buildings.js BUILDINGS or WORKS), or a raising block's building waiting for its plot
//   name: what the charter and the tracker call it
//   step: "<act>:<step>", the story step that tells you to build it (quests/acts.js ACT_STEPS). Once that act is
//         written the step must exist (self-test); until then tools/check.mjs lists it as still to write.
//   from: who sends you (an NPC, a book, a cutscene): every step has a source
//   pending: why it has no plot yet (still a block). Skipped by the plot check and the charter until removed.
//   region: only this region's settlements build it
// given: what the game raises for you at this tier (no plot to pick). homes: cottages, houses and townhouses in all.
// To add a building: give it a PLOT_SIZE, put it in the stage it belongs to, and make sure every layout has a plot.
export const STAGES = [
  { tier: 0, name: "Hamlet", homes: 0,
    given: ["library", "founder's house", "house", "storehouse", "mason_yard", "town hall", "railway halt"],
    build: [
      { id: "barracks", name: "Barracks", step: "act1:barracks", from: "Old Elspeth" },
      { id: "ironworks", name: "Ironworks", step: "act2:ironworks", from: "the Moneyer, after your first upkeep bill" },
    ] },
  { tier: 1, name: "Town", homes: 3,
    build: [
      { id: "farmhouse", name: "Farmhouse with its field", step: "act3:farmhouse", from: "your Hamlet Farmer" },
      { id: "mint", name: "Mint", step: "act3:mint", from: "Old Elspeth" },
      { id: "market", name: "Market Stall", step: "act3:market", from: "the caravan trader" },
      { id: "stables", name: "Stables", step: "act3:stables", from: "a groom", pending: "the Stables plot the town layout thread is adding (still a crafted block)" },
    ] },
  { tier: 2, name: "City", homes: 6,
    build: [
      { id: "quartermaster_desk", name: "Quartermaster's Armoury", step: "act4:quartermaster", from: "your Sergeant" },
      { id: "inn", name: "Inn", step: "act4:inn", from: "a traveller" },
      { id: "smithy", name: "Smithy", step: "act4:smithy", from: "the Ironworks foreman" },
      { id: "garden", name: "Kitchen Garden", step: "act4:garden", from: "your Farmer" },
      { id: "well", name: "Well", step: "act4:well", from: "the settlers" },
      { id: "foresters_lodge", name: "Forester's Lodge", step: "act4:forester", from: "the mason, short of wood", pending: "a second Works yard (still a crafted block)" },
      { id: "dragon_roost", name: "Dragon Stable", step: "act4:dragon_stable", from: "the Cinder Roost trainers", region: "emberwaste", pending: "the Dragon Stable plot, 23 x 18 (still a crafted block)" },
    ] },
  { tier: 3, name: "Castle", homes: 0,
    build: [
      { id: "watchtower", name: "Watchtower", step: "act5:watchtower", from: "your Sergeant" },
    ] },
];
// Blocks that raise a building when placed (old worlds only). No recipe may make one (tools/check.mjs "Every building
// on a plot"), unless its building is still pending a plot, or it is listed in CRAFT_LEFT with the reason it stays.
// Value: the STAGES id it belongs to ("" = retired for good: the hall and station come with the Hamlet).
export const RAISING_BLOCKS = {
  "siege:barracks": "barracks", "siege:quartermaster_desk": "quartermaster_desk", "siege:ironworks": "ironworks",
  "siege:stables": "stables", "siege:foresters_lodge": "foresters_lodge", "siege:dragon_roost": "dragon_roost",
  "siege:hall_cornerstone": "", "siege:foundation_stone": "", "siege:rail_depot": "",
};
export const CRAFT_LEFT = {
  "siege:ironworks": "towns laid out before the Works yard (PR 399) have no plot for it; the settlement thread drops the recipe after",
};
// Buildings that stand in no stage on purpose: optional homes (they count toward the homes line)
export const STAGE_OPTIONAL = ["cottage", "house", "townhouse"];

export const HOMES = ["cottage", "house", "townhouse"];
export const WORK = ["market", "smithy", "stable", "storehouse", "storehouse_1", "storehouse_2", "storehouse_3", "storehouse_4", "farmhouse", "mint", "inn", "barracks"];

// What a settlement must have standing before it can grow past each tier (index = the tier it is at now), made
// from STAGES: the homes, then every building of the stage. Siege wins still decide the tier; a charter that isn't
// met holds the town at its tier until it is. A line whose building is still waiting for a plot (pending), or isn't
// in the game, or that this settlement can't build (region, or an old layout with no plot for it) is skipped.
//   what: the words shown. ids: what counts. count: how many (default 1). region: only there.
export const CHARTERS = STAGES.map((s) => [
  ...(s.homes ? [{ what: "homes", ids: HOMES, count: s.homes }] : []),
  ...s.build.filter((b) => !b.pending).map((b) => ({ what: b.name, ids: [b.id], ...(b.region ? { region: b.region } : {}) })),
]);

// ---------- Buildings you build yourself, beds and settlers (census.js, settlers.js) ----------
// Build by hand on an empty plot, then use its Plot Marker and pick "I built here myself": the plot is checked
// and counts as the first building below whose contents it has (and that suits the plot's size).
// need: { block group: how many }. Groups are in BLOCK_GROUPS. roofed: share of the floor that must be under cover.
// tall: blocks of height above the floor. Checked in this order, so the most particular comes first.
export const CONTENTS = [
  { id: "library", need: { books: 8 }, roofed: 0.6, says: "8 bookshelves under a roof" },
  { id: "inn", need: { bed: 3, storage: 2 }, roofed: 0.7, says: "3 beds and 2 chests or barrels under a roof" },
  { id: "farmhouse", need: { composter: 1, farmland: 9 }, roofed: 0.3, says: "a composter, 9 farmland and a roof" },
  { id: "mint", need: { storage: 2, anvil: 1 }, roofed: 0.6, says: "2 chests or barrels and an anvil (or smithing table) under a roof" },
  { id: "smithy", need: { anvil: 1, furnace: 1 }, roofed: 0.3, says: "an anvil (or smithing table) and a furnace" },
  { id: "stable", need: { hay: 1, fence: 6 }, roofed: 0.3, says: "a hay bale and stalls (6 fences or gates)" },
  { id: "storehouse", need: { storage: 6 }, roofed: 0.6, says: "6 chests or barrels under a roof" },
  { id: "garden", need: { farmland: 12, water: 1 }, says: "12 farmland and water" },
  { id: "market", need: { storage: 2, counter: 1 }, says: "2 chests or barrels and a counter (slab, stair or trapdoor)" },
  { id: "watchtower", need: { ladder: 1 }, tall: 10, says: "a ladder and 10 blocks of height" },
  { id: "well", need: { water: 1, wall: 4 }, says: "water ringed with walls or fences" },
  { id: "cottage", need: { bed: 1, door: 1 }, roofed: 0.7, says: "a bed and a door, under a roof" },
];
export const BLOCK_GROUPS = {
  books: /bookshelf$/, anvil: /(anvil|smithing_table)$/, furnace: /(^minecraft:furnace|blast_furnace|lit_furnace)$/,
  hay: /hay_block$/, fence: /(fence|fence_gate)$/, storage: /(:chest|barrel|trapped_chest)$/, farmland: /farmland$/,
  water: /^minecraft:(flowing_)?water$/, counter: /(slab|stairs|trapdoor)$/, ladder: /ladder$/, wall: /(_wall|fence)$/,
  composter: /composter$/, bed: /(^minecraft:|_)bed$/, door: /(?<!trap)door$/,
};

// Names for buildings that can be built by hand but have no ready-made design yet
export const HAND_NAMES = { farmhouse: "Farmhouse", mint: "Mint", inn: "Inn" };

// Beds: a bed counts only inside a home (a cottage, raised or registered), at most one per this many covered
// floor blocks. Every settler needs a bed, worker or not.
export const FLOOR_PER_BED = 12;

// Settlers: at dawn, one newcomer per settlement if a home has a free bed. A finished work building gets its
// worker first, then the homes fill up. They stand about by day and go to their bed at dusk.
export const SETTLERS = {
  perDawn: 1,
  lordRange: 96, // a Rival Lord's town looks after its townsfolk while a player is this close (as their crews build)
  lordCatchUp: 3, // most newcomers a lord's town takes at once after nobody has been near for days
  waryDays: 3, // townsfolk are wary this many days after their town changes hands
  workers: { smithy: "Smith", stable: "Groom", storehouse: "Storekeeper", storehouse_1: "Storekeeper", storehouse_2: "Storekeeper", storehouse_3: "Storekeeper", storehouse_4: "Storekeeper", market: "Trader", library: "Archivist", garden: "Gardener", watchtower: "Lookout", farmhouse: "Farmer", mint: "Minter", inn: "Innkeeper", barracks: "Sergeant" },
  names: ["Alda", "Brannock", "Cressa", "Dunstan", "Elswyth", "Fenn", "Garrow", "Hesketh", "Ilse", "Jory", "Kestrel", "Lovell", "Maud", "Nye", "Osric", "Perrin", "Quenby", "Rowan", "Sabeth", "Tam", "Ulric", "Verity", "Wystan", "Yarrow"],
};
// What a settler says when you talk to them (hand-written; {town} is the settlement's name)
export const SETTLER_LINES = {
  day: [
    "Good roof, good bed. That's more than I had on the road.",
    "{town} is quieter than I was told. I'm not complaining.",
    "I'll pull my weight. Just tell me the wall holds.",
    "The mason says you pay fair. That's why I stopped here.",
    "Somebody's always building something. I like the noise.",
  ],
  night: [
    "I'm for bed. You should be too, by the look of the sky.",
    "Doors shut after dark. That's the rule I keep.",
    "Don't stand out here long. It's colder than it ought to be.",
  ],
  idle: "My work's gone. Put it back up and I'll go back to it.",
  // In a Rival Lord's town: how the lord's temper shows in their people
  lord: {
    proud: [
      "His lordship doesn't care for strangers on the green. Say your piece and go.",
      "Our walls were raised by a proper lord. Not everyone can say that.",
      "Mind the banner. Folk have been fined for less.",
    ],
    grasping: [
      "Everything here has a price, friend. Even the well, if he hears of it.",
      "Taxed on bread, taxed on boots. We pay and we keep quiet.",
      "If you've coin, the lord will want to meet you. If you haven't, he won't.",
    ],
    devout: [
      "We keep the old prayers here. You're welcome to them.",
      "The lord says grace before every meal, even the small ones.",
      "Light a candle before you leave. It costs nothing.",
    ],
    wary: [
      "We don't open the door after the second bell. Don't knock.",
      "You came by the north road? Nobody comes by the north road.",
      "Keep your voice down. Sound carries at night here.",
    ],
    bold: [
      "Our lord's ridden out against worse than you. Twice.",
      "We'll stand on that wall when the horn goes. Every one of us.",
      "Fancy a wrestle on the green? No? Pity.",
    ],
    kind: [
      "Hungry? There's bread by the hall door. The lord leaves it out.",
      "You're welcome here. Most are.",
      "Our lord knows every name in this town. Even the children's.",
    ],
    steady: [
      "Quiet enough here, most days.",
      "We keep our heads down and our roofs mended.",
    ],
  },
  // For a few days after a player takes a lord's town
  wary: [
    "New banner on the hall. We'll see how it suits.",
    "The old lord kept the well clean. I hope you will.",
    "I'll work, same as before. Just don't ask me to cheer.",
  ],
};

// ---------- The Plan Book (planbook.js, plandata.js) ----------
// You can only raise a building on a plot if you know its plan. Plans are learned once and kept for good.
//   basics: always known (the Hamlet's buildings).  hall: known once your town hall reaches that level.
//   Everything else is found: Plan Scrolls from toppled Rival Lords, bosses, Rumor jobs (and ruins, traders
//   and wonders, which call learnPlan / givePlanScroll). A found plan is in its region's style; a style that
//   isn't your town's own costs foreignMul times as much to raise.
//   Rule: a player always gets what a charter needs. Every home and every building a charter names is taught by
//   basics or by the hall level that tier reaches (hall level = tier + 1), never only by a lucky scroll (tested).
//   noPlan: buildings every player may raise on a fitting plot without a plan (no Plan Book card).
export const PLANS = {
  basics: ["cottage", "house", "well", "library"],
  hall: { 2: ["market", "garden", "farmhouse", "mint", "townhouse"], 3: ["smithy", "inn"], 4: ["watchtower"] },
  noPlan: ["barracks", "quartermaster_desk"],
  foreignMul: 1.5,
  scrollLots: 2, // copying a plan you know onto a Plan Scroll at your Plan Book (plus one paper), to trade
  lordScrolls: 2, // Plan Scrolls a toppled lord leaves, from the buildings that stood in their town
  bossScrolls: 1, // for each player at a boss's death
  rumorChance: 0.25, // chance a finished Rumor job pays a Plan Scroll as well
};
