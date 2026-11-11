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
