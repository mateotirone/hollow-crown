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
  stonePrice: 4, // lots for a Foundation Stone at the mason (it can also be crafted)
  riseTicks: 160, // about how long a pre-designed building takes to rise (160 = 8 seconds)
  firstBuildRenown: 40, // Renown the first time you raise each kind of building
  previewSeconds: 90, // how long the outline of a chosen building stays up
  // What a building costs on a town plot (Plot Marker), in lots, paid from the purse. The library comes free on arrival.
  plotPrices: { cottage: 6, well: 3, garden: 5, market: 10, library: 8, watchtower: 8, storehouse: 9, smithy: 12, stable: 14,
    house: 9, townhouse: 13, farmhouse: 10, mint: 14, inn: 16 },
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
  noLand: "You've no land to lay it on yet. Raise a Keep Banner on a Plot Stone and come back. I'll sell to you all the same.",
};

// ---------- Town plots and charters (Plot Markers, charters.js) ----------
// The tier each building first opens at (0 Hamlet, 1 Town, 2 City, 3 Castle). This used to be read from the
// old fixed layout (layout.js). Farmhouse, Mint, Inn and Barracks are listed ahead of their plot designs.
export const OPENS_AT = {
  cottage: 0, house: 0, well: 0, library: 0, townhouse: 1, market: 1, garden: 1, farmhouse: 1, mint: 1,
  smithy: 2, stable: 2, inn: 2, barracks: 2, storehouse: 3, watchtower: 3,
};

// The plot size each building takes. Plots: S Small 9x13, M Medium 11x15, ML long Medium 13x15, L Large 15x15,
// G Great 21x21. A building goes on a plot of its own size, or a size listed under PLOT_ALSO.
export const PLOT_SIZE = {
  cottage: "S", well: "S", garden: "S", watchtower: "S",
  house: "M", smithy: "M", farmhouse: "M", mint: "M",
  townhouse: "ML",
  stable: "ML", storehouse: "ML", library: "ML",
  market: "L", inn: "L", barracks: "L",
};
export const PLOT_ALSO = {
  market: ["ML"], // the market may take a long Medium
  barracks: ["ML"],
  library: ["L"], stable: ["L"], storehouse: ["L"], townhouse: ["L"],
};
// Only when the town has no free plot of the building's own size or PLOT_ALSO sizes left
export const PLOT_FALLBACK = { barracks: ["M"] }; // the barracks may take a plain Medium

// Where on the map a building wants to be, from the plot's tags (wall, corner, square, gate, road_front,
// field_edge, hall, library). needs: the plot must have one of them. prefer: listed first in the menu.
export const PLOT_TAGS = {
  watchtower: { needs: ["wall", "gate", "corner"] },
  well: { prefer: ["square"] },
  market: { prefer: ["gate", "road_front", "square"] },
  garden: { prefer: ["field_edge"] },
  farmhouse: { prefer: ["field_edge"] },
  library: { prefer: ["library", "square"] },
  inn: { prefer: ["gate", "road_front", "square"] },
  barracks: { prefer: ["gate", "wall"] },
};
export const TAG_WORDS = { wall: "by the wall", gate: "by a gate", corner: "on a corner", square: "on the square", road_front: "on the main road", field_edge: "by the fields", hall: "by the hall", library: "set aside for the library", hall5: "on ground the hall will need at level 5" };

export const HOMES = ["cottage"];
export const WORK = ["market", "smithy", "stable", "storehouse", "farmhouse", "mint", "inn", "barracks"];

// What a settlement must have standing before it can grow past each tier (index = the tier it is at now).
// Siege wins still decide the tier; a charter that isn't met holds the town at its tier until it is.
// count: how many (default 1). more: this many work buildings beyond the ones the charters name.
// A line whose buildings are not in the game yet is skipped (and said so), so nobody is stuck.
export const CHARTERS = [
  [ // Hamlet, to become a Town: nothing beyond the library it starts with
  ],
  [ // Town, to become a City
    { what: "homes", ids: HOMES, count: 3 },
    { what: "Farmhouse with its field", ids: ["farmhouse"] },
    { what: "Mint", ids: ["mint"] },
    { what: "market", ids: ["market"] },
  ],
  [ // City, to become a Castle
    { what: "homes", ids: HOMES, count: 6 },
    { what: "inn", ids: ["inn"] },
    { what: "barracks", ids: ["barracks"] },
    { what: "more work building of any size", ids: WORK, more: 1 },
  ],
  [ // Castle: the top tier. Shown as the full Castle charter, it holds nothing back.
    { what: "homes", ids: HOMES, count: 10 },
  ],
];

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
  skins: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19],
  workers: { smithy: "Smith", stable: "Groom", storehouse: "Storekeeper", market: "Trader", library: "Archivist", garden: "Gardener", watchtower: "Lookout", farmhouse: "Farmer", mint: "Minter", inn: "Innkeeper", barracks: "Sergeant" },
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
};
