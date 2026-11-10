// Regional styles: the same town hall shapes, dressed in each region's materials.
// Each role lists block ids to try in order (older and newer game versions name some blocks
// differently), and the first one the game knows is used. Pure data, loads in Node.
// Stonework comes from each region's Castle Stone family (cobbled, stone, bricks, smooth, tiles), with
// vanilla blocks behind it as fallbacks. The family has no stairs, slabs or walls yet, so those stay vanilla.

const W = (...ids) => ids.map((id) => (id.includes(":") ? id : `minecraft:${id}`));

const COMMON = {
  window: W("glass_pane"),
  light: W("lantern"),
  hearth: W("campfire"),
  bookshelf: W("bookshelf"),
  cartography: W("cartography_table"),
  lectern: W("lectern"),
  chain: W("iron_chain", "chain"),
  royal: W("red_carpet", "carpet"),
  royalBlock: W("red_wool", "wool"),
  gilt: W("yellow_glazed_terracotta"),
  tree: W("siege:tree_of_oaths"),
  brazier: W("siege:brazier", "campfire"),
  air: W("air"),
  rail: W("spruce_fence", "fence"),
  scaffold: W("scaffolding", "ladder"),
};

export const STYLES = {
  vale: {
    arch: "vale",
    name: "Vale",
    blurb: "Norman keeps and timber hall-houses: stone brick, square towers, slate roofs.",
    roof: "gable",
    pitch: 1,
    lift: 0,
    roles: {
      ...COMMON,
      foundation: W("siege:castle_cobbled", "cobblestone"),
      floor: W("spruce_planks", "planks"),
      wall: W("siege:castle_bricks", "stone_bricks", "stonebrick"),
      wallLow: W("siege:castle_stone", "stone_bricks", "stonebrick"),
      wallUpper: W("siege:timber_frame", "spruce_planks", "planks"),
      pillar: W("stripped_spruce_log", "spruce_log"),
      beam: W("spruce_log"),
      roofStair: W("deepslate_tile_stairs", "stone_brick_stairs"),
      roofSlab: W("deepslate_tile_slab", "stone_brick_slab"),
      roofBlock: W("deepslate_tiles", "stone_bricks"),
      crenel: W("siege:battlement", "stone_brick_wall", "cobblestone_wall"),
      seat: W("spruce_stairs"),
      table: W("spruce_slab", "wooden_slab"),
      carpet: W("red_carpet", "carpet"),
      dais: W("siege:castle_smooth", "polished_andesite", "stone_bricks"),
      daisStair: W("stone_brick_stairs"),
      spire: W("siege:spire_roof", "deepslate_tiles"),
    },
  },
  frostmarch: {
    arch: "frost",
    name: "Frostmarch",
    blurb: "Norse mead halls and stave churches: stacked steep roofs, crossed finials, turrets on the ridge.",
    roof: "gable",
    pitch: 2,
    lift: 0,
    snow: true,
    roles: {
      ...COMMON,
      rail: W("dark_oak_fence", "fence"),
      foundation: W("siege:castle_cobbled_frostmarch", "cobbled_deepslate"),
      floor: W("spruce_planks", "planks"),
      wall: W("siege:castle_bricks_frostmarch", "deepslate_bricks"),
      wallLow: W("siege:castle_stone_frostmarch", "cobbled_deepslate"),
      wallUpper: W("dark_oak_planks", "spruce_planks"),
      pillar: W("spruce_log"),
      beam: W("dark_oak_log", "spruce_log"),
      roofStair: W("dark_oak_stairs"),
      roofSlab: W("dark_oak_slab", "wooden_slab"),
      roofBlock: W("dark_oak_planks"),
      crenel: W("cobbled_deepslate_wall", "cobblestone_wall"),
      seat: W("spruce_stairs"),
      table: W("spruce_slab", "wooden_slab"),
      carpet: W("blue_carpet", "carpet"),
      dais: W("siege:castle_smooth_frostmarch", "polished_deepslate"),
      daisStair: W("polished_deepslate_stairs"),
      spire: W("dark_oak_planks"),
      snow: W("snow_layer"),
    },
  },
  saltreach: {
    arch: "salt",
    name: "Saltreach",
    blurb: "Harbor basilicas: white walls, an arcade across the front, domes, and a lighthouse.",
    roof: "gable",
    pitch: 1,
    lift: 0,
    roles: {
      ...COMMON,
      rail: W("birch_fence", "fence"),
      foundation: W("siege:castle_cobbled_saltreach", "stone_bricks", "stonebrick"),
      floor: W("birch_planks", "planks"),
      wall: W("siege:castle_bricks_saltreach", "calcite"),
      wallLow: W("siege:castle_stone_saltreach", "stone_bricks", "stonebrick"),
      wallUpper: W("smooth_quartz", "quartz_block"),
      pillar: W("stripped_birch_log", "birch_log"),
      beam: W("birch_log"),
      roofStair: W("dark_prismarine_stairs", "prismarine_bricks_stairs"),
      roofSlab: W("dark_prismarine_slab", "prismarine_slab"),
      roofBlock: W("siege:castle_tiles_saltreach", "dark_prismarine", "prismarine"),
      window: W("light_blue_stained_glass_pane", "glass_pane"),
      crenel: W("stone_brick_wall", "cobblestone_wall"),
      seat: W("birch_stairs"),
      table: W("birch_slab", "wooden_slab"),
      carpet: W("light_blue_carpet", "carpet"),
      dais: W("siege:castle_smooth_saltreach", "quartz_bricks", "quartz_block"),
      daisStair: W("quartz_stairs"),
      spire: W("dark_prismarine", "prismarine"),
    },
  },
  emberwaste: {
    arch: "ember",
    name: "Emberwaste",
    blurb: "Mud-brick kasbahs and stepped ziggurats: tapering towers, flat roofs, terraces.",
    roof: "flat",
    pitch: 1,
    lift: 0,
    roles: {
      ...COMMON,
      rail: W("acacia_fence", "fence"),
      foundation: W("siege:castle_cobbled_emberwaste", "red_sandstone"),
      floor: W("smooth_sandstone", "sandstone"),
      wall: W("siege:castle_bricks_emberwaste", "smooth_sandstone", "sandstone"),
      wallLow: W("siege:castle_stone_emberwaste", "red_sandstone"),
      wallUpper: W("orange_terracotta", "sandstone"),
      pillar: W("cut_sandstone", "sandstone"),
      beam: W("stripped_acacia_log", "acacia_log"),
      roofStair: W("smooth_sandstone_stairs", "sandstone_stairs"),
      roofSlab: W("smooth_sandstone_slab", "sandstone_slab"),
      roofBlock: W("siege:castle_tiles_emberwaste", "smooth_sandstone", "sandstone"),
      crenel: W("sandstone_wall", "cobblestone_wall"),
      seat: W("acacia_stairs"),
      table: W("acacia_slab", "wooden_slab"),
      carpet: W("orange_carpet", "carpet"),
      dais: W("siege:castle_smooth_emberwaste", "cut_red_sandstone", "red_sandstone"),
      daisStair: W("red_sandstone_stairs"),
      spire: W("orange_terracotta"),
    },
  },
  blackfen: {
    arch: "fen",
    name: "Blackfen",
    blurb: "A stilt village: round huts under mossy cone roofs and a crooked witch's tower.",
    roof: "gable",
    pitch: 1,
    lift: 3,
    moss: true,
    roles: {
      ...COMMON,
      rail: W("mangrove_fence", "fence"),
      foundation: W("mangrove_log"),
      floor: W("mangrove_planks", "planks"),
      wall: W("mangrove_planks", "planks"),
      wallLow: W("siege:castle_stone_blackfen", "mud_bricks"),
      wallUpper: W("mangrove_planks", "planks"),
      pillar: W("mangrove_log"),
      beam: W("stripped_mangrove_log", "mangrove_log"),
      roofStair: W("dark_oak_stairs"),
      roofSlab: W("dark_oak_slab", "wooden_slab"),
      roofBlock: W("moss_block", "dark_oak_planks"),
      crenel: W("mud_brick_wall", "cobblestone_wall"),
      seat: W("mangrove_stairs"),
      table: W("mangrove_slab", "wooden_slab"),
      carpet: W("green_carpet", "carpet"),
      dais: W("siege:castle_smooth_blackfen", "mud_bricks"),
      daisStair: W("mud_brick_stairs"),
      spire: W("moss_block"),
      moss: W("moss_carpet"),
    },
  },
};

export const STYLE_IDS = Object.keys(STYLES);

// Pick a style from what's around: biome name if the game tells us, otherwise the ground blocks.
export function styleFromBiome(biomeId = "") {
  const b = biomeId.toLowerCase();
  if (/(swamp|mangrove)/.test(b)) return "blackfen";
  if (/(snow|frozen|ice|taiga|grove|peak|cold)/.test(b)) return "frostmarch";
  if (/(desert|badlands|mesa|savanna)/.test(b)) return "emberwaste";
  if (/(beach|ocean|shore)/.test(b)) return "saltreach";
  if (b) return "vale";
  return undefined;
}

export function styleFromGround(counts) {
  // counts: { typeId: n } of surface blocks sampled around the cornerstone
  let snow = 0, sand = 0, swamp = 0, water = 0, total = 0;
  for (const [id, n] of Object.entries(counts)) {
    total += n;
    if (/(snow|ice|powder)/.test(id)) snow += n;
    else if (/(sand|terracotta|hardened_clay|cactus)/.test(id)) sand += n;
    else if (/(mud|mangrove|lily|vine)/.test(id)) swamp += n;
    else if (/water/.test(id)) water += n;
  }
  if (!total) return "vale";
  if (snow / total > 0.2) return "frostmarch";
  if (sand / total > 0.35) return "emberwaste";
  if (swamp / total > 0.15) return "blackfen";
  if (water / total > 0.25) return "saltreach";
  return "vale";
}
