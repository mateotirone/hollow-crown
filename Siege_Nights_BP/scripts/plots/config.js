// Plots and map settings for The Hollow Crown map. The full map plan is in
// siege-nights/hollow-crown-map-plan (the doc) and the picture in siege-nights/map/.

export const MAP = {
  plotRadius: 80, // land each plot covers: the same as a Castle-tier settlement
  minPlotSpacing: 160, // Siege Nights refuses two keeps closer than this, so plots can't be either
  goodPlotSpacing: 300, // closer than this gets a warning for the builder
  reserveDays: 3, // after a keep falls or is captured, its plot is held for the old owner this many in-game days
  mapCenter: { x: 0, z: 0 }, // Kingsrest, the spawn hub
  mapHalfSize: 1250, // the map runs this far from the center each way (0 turns the edge off)
  noElytra: true,
  elytraReward: [{ item: "minecraft:emerald", count: 24 }], // what an elytra is swapped for
};

// The 12 plots. x/z are the planned Plot Stone spots (builders can adjust; the stone's real spot wins).
export const PLOT_PLAN = [
  { name: "Harrowford", region: "Aldmere Vale", x: -320, z: -260 },
  { name: "Oakmere", region: "Aldmere Vale", x: 320, z: -260 },
  { name: "Wrenfield", region: "Aldmere Vale", x: -320, z: 280 },
  { name: "Thistledown", region: "Aldmere Vale", x: 320, z: 280 },
  { name: "Rimeholt", region: "Frostmarch", x: -420, z: -880 },
  { name: "Wolfcairn", region: "Frostmarch", x: 380, z: -940 },
  { name: "Gullcliff", region: "Saltreach", x: -940, z: -380 },
  { name: "Tidewatch", region: "Saltreach", x: -960, z: 420 },
  { name: "Redmesa", region: "Emberwaste", x: -420, z: 920 },
  { name: "Dunehold", region: "Emberwaste", x: 420, z: 900 },
  { name: "Reedmoor", region: "Blackfen", x: 920, z: -400 },
  { name: "Lanternbog", region: "Blackfen", x: 940, z: 420 },
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
