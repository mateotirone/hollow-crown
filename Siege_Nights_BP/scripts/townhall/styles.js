// Regional styles: the same town hall shapes, dressed in each region's materials.
// Each role lists block ids to try in order (older and newer game versions name some blocks
// differently), and the first one the game knows is used. Pure data, loads in Node.

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
    name: "Vale",
    blurb: "Stone brick, timber frame and steep slate roofs.",
    roof: "gable",
    pitch: 1,
    lift: 0,
    roles: {
      ...COMMON,
      foundation: W("cobblestone"),
      floor: W("spruce_planks", "planks"),
      wall: W("stone_bricks", "stonebrick"),
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
      dais: W("polished_andesite", "stone_bricks"),
      daisStair: W("stone_brick_stairs"),
      spire: W("siege:spire_roof", "deepslate_tiles"),
    },
  },
  frostmarch: {
    name: "Frostmarch",
    blurb: "Dark spruce, deepslate and steep, snow-heavy longhouse roofs.",
    roof: "gable",
    pitch: 2,
    lift: 0,
    snow: true,
    roles: {
      ...COMMON,
      rail: W("dark_oak_fence", "fence"),
      foundation: W("cobbled_deepslate"),
      floor: W("spruce_planks", "planks"),
      wall: W("deepslate_bricks"),
      wallLow: W("cobbled_deepslate"),
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
      dais: W("polished_deepslate"),
      daisStair: W("polished_deepslate_stairs"),
      spire: W("dark_oak_planks"),
      snow: W("snow_layer"),
    },
  },
  saltreach: {
    name: "Saltreach",
    blurb: "White calcite and quartz, blue roofs, harbor stone.",
    roof: "gable",
    pitch: 1,
    lift: 0,
    roles: {
      ...COMMON,
      rail: W("birch_fence", "fence"),
      foundation: W("stone_bricks", "stonebrick"),
      floor: W("birch_planks", "planks"),
      wall: W("calcite"),
      wallLow: W("stone_bricks", "stonebrick"),
      wallUpper: W("smooth_quartz", "quartz_block"),
      pillar: W("stripped_birch_log", "birch_log"),
      beam: W("birch_log"),
      roofStair: W("dark_prismarine_stairs", "prismarine_bricks_stairs"),
      roofSlab: W("dark_prismarine_slab", "prismarine_slab"),
      roofBlock: W("dark_prismarine", "prismarine"),
      window: W("light_blue_stained_glass_pane", "glass_pane"),
      crenel: W("stone_brick_wall", "cobblestone_wall"),
      seat: W("birch_stairs"),
      table: W("birch_slab", "wooden_slab"),
      carpet: W("light_blue_carpet", "carpet"),
      dais: W("quartz_bricks", "quartz_block"),
      daisStair: W("quartz_stairs"),
      spire: W("dark_prismarine", "prismarine"),
    },
  },
  emberwaste: {
    name: "Emberwaste",
    blurb: "Sandstone and terracotta, thick walls, flat roofs.",
    roof: "flat",
    pitch: 1,
    lift: 0,
    roles: {
      ...COMMON,
      rail: W("acacia_fence", "fence"),
      foundation: W("red_sandstone"),
      floor: W("smooth_sandstone", "sandstone"),
      wall: W("smooth_sandstone", "sandstone"),
      wallLow: W("red_sandstone"),
      wallUpper: W("orange_terracotta", "sandstone"),
      pillar: W("cut_sandstone", "sandstone"),
      beam: W("stripped_acacia_log", "acacia_log"),
      roofStair: W("smooth_sandstone_stairs", "sandstone_stairs"),
      roofSlab: W("smooth_sandstone_slab", "sandstone_slab"),
      roofBlock: W("smooth_sandstone", "sandstone"),
      crenel: W("sandstone_wall", "cobblestone_wall"),
      seat: W("acacia_stairs"),
      table: W("acacia_slab", "wooden_slab"),
      carpet: W("orange_carpet", "carpet"),
      dais: W("cut_red_sandstone", "red_sandstone"),
      daisStair: W("red_sandstone_stairs"),
      spire: W("orange_terracotta"),
    },
  },
  blackfen: {
    name: "Blackfen",
    blurb: "Stilts, mangrove, moss and hanging lanterns.",
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
      wallLow: W("mud_bricks"),
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
      dais: W("mud_bricks"),
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
  if (/(snow|frozen|ice|taiga|grove|peak|cold)/.test(b)) return "frostmarch";
  if (/(desert|badlands|mesa|savanna)/.test(b)) return "emberwaste";
  if (/(swamp|mangrove)/.test(b)) return "blackfen";
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
