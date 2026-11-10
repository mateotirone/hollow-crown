// Plots and map settings for The Hollow Crown map. The full map plan is in
// siege-nights/hollow-crown-map-plan (the doc) and the picture in siege-nights/map/.

export const MAP = {
  plotRadius: 80, // land each plot covers: the same as a Castle-tier settlement
  minPlotSpacing: 160, // Siege Nights refuses two keeps closer than this, so plots can't be either
  goodPlotSpacing: 300, // closer than this gets a warning for the builder
  reserveDays: 3, // after a keep falls or is captured, its plot is held for the old owner this many in-game days
  mapCenter: { x: 0, z: 0 }, // middle of the map (Kingsrest, the spawn town, is at -150, -150)
  mapHalfSize: 1250, // the map runs this far from the center each way (0 turns the edge off)
  noElytra: true,
  elytraReward: [{ item: "minecraft:emerald", count: 24 }], // what an elytra is swapped for
};

// The 12 plots. x/z are the planned Plot Stone spots (builders can adjust; the stone's real spot wins).
export const PLOT_PLAN = [
  { name: "Harrowford", region: "Aldmere Vale", x: -470, z: -300, site: "river meadow above the lower Alder" },
  { name: "Oakmere", region: "Aldmere Vale", x: 260, z: -480, site: "oak forest between the two rivers" },
  { name: "Thistledown", region: "Aldmere Vale", x: 300, z: 130, site: "open downs south of the Greywater" },
  { name: "Wrenfield", region: "Aldmere Vale", x: -200, z: 220, site: "lakeside fields by Wren Water" },
  { name: "Rimeholt", region: "Frostmarch", x: -520, z: -760, site: "a shelf in the western foothills" },
  { name: "Wolfcairn", region: "Frostmarch", x: 520, z: -1010, site: "high plateau north of the range" },
  { name: "Gullcliff", region: "Saltreach", x: -760, z: -560, site: "clifftop over the northern coast" },
  { name: "Tidewatch", region: "Saltreach", x: -560, z: 650, site: "dunes above the southern shore" },
  { name: "Reedmoor", region: "Blackfen", x: -230, z: 560, site: "the firm northern edge of the fen" },
  { name: "Lanternbog", region: "Blackfen", x: 260, z: 980, site: "a dry island deep in the fen" },
  { name: "Redmesa", region: "Emberwaste", x: 700, z: 60, site: "mesa top at the desert's edge" },
  { name: "Dunehold", region: "Emberwaste", x: 760, z: 860, site: "an oasis among the dunes" },
];

export const REGION_STYLE = {
  "Aldmere Vale": "stone brick, timber frame and steep slate roofs",
  Frostmarch: "dark spruce, deepslate and snow-heavy longhouses",
  Saltreach: "white calcite, quartz and blue roofs on harbor stone",
  Emberwaste: "sandstone, terracotta and flat roofs behind thick walls",
  Blackfen: "stilts, mangrove, moss and hanging lanterns",
};

export const PLOT_STONE = "siege:plot_stone";
export const KEEP_BANNER = "siege:keep_banner";
export const OVERWORLD = "minecraft:overworld";
export const DAY_TICKS = 24000;
