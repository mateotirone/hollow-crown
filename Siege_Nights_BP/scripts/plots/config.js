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
  elytraReward: [{ item: "siege:gold_coin", count: 3, name: "Gold Regals" }], // what an elytra is swapped for (3 x 64 coins, once 24 emeralds)
};

// The 12 plots. x/z are the planned Plot Stone spots (builders can adjust; the stone's real spot wins).
// gate: the side the settlement's gate faces, as a compass bearing (0 north, 90 east, 180 south, 270 west). It is the
// side its station and road are on. The town hall and everything else grow away from the gate.
// relic: where the plot's own old landmark stands (what it is: lore/data/plots.js, field `build`). It is inside the
// plot but off the level settlement ground, away from the gate, on the side the story needs (river, lake, sea, high ground).
export const PLOT_PLAN = [
  { name: "Harrowford", region: "Aldmere Vale", x: -470, z: -300, gate: 90, relic: { x: -445, z: -232 }, site: "river meadow above the lower Alder" },
  { name: "Oakmere", region: "Aldmere Vale", x: 260, z: -480, gate: 270, relic: { x: 332, z: -480 }, site: "oak forest between the two rivers" },
  { name: "Thistledown", region: "Aldmere Vale", x: 300, z: 130, gate: 0, relic: { x: 370, z: 111 }, site: "open downs south of the Greywater" },
  { name: "Wrenfield", region: "Aldmere Vale", x: -200, z: 220, gate: 90, relic: { x: -164, z: 282 }, site: "lakeside fields by Wren Water" },
  { name: "Frosthelm", region: "Frostmarch", x: -520, z: -760, gate: 180, relic: { x: -479, z: -819 }, site: "a shelf in the western foothills" },
  { name: "Wolfcairn", region: "Frostmarch", x: 520, z: -1010, gate: 270, relic: { x: 575, z: -1056 }, site: "high plateau north of the range" },
  { name: "Gullcliff", region: "Saltreach", x: -760, z: -560, gate: 90, relic: { x: -825, z: -530 }, site: "clifftop over the northern coast" },
  { name: "Tidewatch", region: "Saltreach", x: -560, z: 650, gate: 0, relic: { x: -596, z: 712 }, site: "dunes above the southern shore" },
  { name: "Reedmoor", region: "Blackfen", x: -230, z: 560, gate: 90, relic: { x: -230, z: 632 }, site: "the firm northern edge of the fen" },
  { name: "Lanternbog", region: "Blackfen", x: 260, z: 980, gate: 0, relic: { x: 260, z: 1052 }, site: "a dry island deep in the fen" },
  { name: "Redmesa", region: "Emberwaste", x: 700, z: 60, gate: 180, relic: { x: 700, z: -12 }, site: "mesa top at the desert's edge" },
  { name: "Dunehold", region: "Emberwaste", x: 760, z: 860, gate: 90, relic: { x: 688, z: 860 }, site: "an oasis among the dunes" },
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

// Hand-built places nobody in Survival may dig up or build on (x, z, radius). Only in map mode.
export const WARDS = [
  { name: "Kingsrest", x: -150, z: -150, r: 90 },
  { name: "Millbrook", x: -60, z: -470, r: 70 },
  { name: "Rimehold", x: -80, z: -1080, r: 70 },
  { name: "Gull's Rest", x: -800, z: 400, r: 70 },
  { name: "Sunscar", x: 850, z: 450, r: 80 },
  { name: "Mirelight", x: -60, z: 900, r: 70 },
  { name: "the Ashen Gate Chapterhouse", x: 420, z: -170, r: 45 },
  { name: "the Ashen Watch", x: 480, z: 560, r: 35 },
  // The seven thin places: caves where the Rift may stand (one is real in each world). Each keeps a clearing in
  // front of it, big enough for the overworld stage of the last fight, so nobody may build or dig there.
  { name: "Kingsbarrow Hollow", x: 120, z: 520, r: 45, thin: true },
  { name: "the Greywater Sink", x: 560, z: -420, r: 45, thin: true },
  { name: "the Rimecut Caves", x: -650, z: -1080, r: 45, thin: true },
  { name: "the Drowned Grotto", x: -870, z: -860, r: 45, thin: true },
  { name: "the Fenmouth Deeps", x: -250, z: 860, r: 45, thin: true },
  { name: "the Scorched Throat", x: 1050, z: 720, r: 45, thin: true },
  { name: "the Witchroot Sink", x: 520, z: 1160, r: 45, thin: true },
  { name: "the Shut Pass", x: 1225, z: -190, r: 30 }, // sealed way out, kept for a later update (see EXPANSION)
  { name: "Bellhollow", x: 155, z: -100, r: 60 }, // the valley with the broken bell frame, the shrine and the sealed Crack in the Deep
  { name: "Crownhold", x: -235, z: -345, r: 65 }, // the ruined capital and its Hall of Bells, on the rise north-west of Kingsrest
];

// The welcome hall: a terrace high above Gull Bay where new players arrive, read how things stand and pick
// where they start. The test area is a glass floor in the sky that holds the showcase. Builders make both with
// /scriptevent siege:welcome build   and   /scriptevent siege:welcome testarea   (see plots/welcome.js).
export const WELCOME = {
  hall: { x: -725, y: 300, z: 25 }, // over open water, above the clouds, so it shades nothing
  testArea: { x: -925, y: 300, z: -150 },
  kingsrest: { x: -118, y: 77, z: -118 }, // the plaza: where "start without a home" puts you (builders can re-set it)
  hallRadius: 15,
  pedestalRadius: 11,
  pedestalGap: 24, // degrees kept between two pedestals
  bannerOnArrival: true, // hand a Keep Banner to someone who picks a plot and has none
};

// What each region's pedestal is made of
export const REGION_BLOCK = {
  "Aldmere Vale": "minecraft:mossy_stone_bricks",
  Frostmarch: "minecraft:packed_ice",
  Saltreach: "minecraft:prismarine_bricks",
  Emberwaste: "minecraft:red_sandstone",
  Blackfen: "minecraft:mud_bricks",
};

// What the map keeps ready at every plot for its final, biggest settlement (sizes agreed with the settlement and
// town hall work; all measured flat from the Plot Stone). The map's ground is level to within a block out to
// flatRadius at every plot, then eases back into the natural land by easeRadius.
export const SETTLEMENT = {
  flatRadius: 64, // level ground
  easeRadius: 115, // back to natural ground by here
  wallRadius: 56, // outer face of the generated wall ring (towers on it reach 59)
  landRadius: 60, // settlement land ends here; raiders gather from 61 out
  hallPad: { halfWidth: 22, depth: 50 }, // biggest town hall in any style, behind the stone, away from the gate
  clearHeight: 25, // nothing taller than this within 45 blocks of the hall, so the fly-by camera can see
};

// Room to grow. The map file is never replaced once players have moved in, so the first map keeps three sealed
// ways out, and the land beyond each stays empty until an update opens it (the add-on places what is there).
// `door` is the sealed place on today's map; `beyond` is the empty land outside the map edge kept for it.
// Names are working titles. Never reuse or renumber an id: saved worlds remember which zones are open.
export const EXPANSION = [
  { id: "shut_pass", name: "the Shut Pass", how: "a pass at the east end of the Greyspine, buried under snow and rockfall",
    door: { x: 1225, z: -190, r: 30 }, beyond: { x0: 1250, z0: -800, x1: 2250, z1: 400 } },
  { id: "far_shore", name: "the Far Shore", how: "a coast across the Western Sea that no ship from Gull's Rest reaches yet",
    door: { x: -1225, z: 300, r: 30 }, beyond: { x0: -2650, z0: -900, x1: -1250, z1: 900 } },
  { id: "horizon_isles", name: "the Horizon Isles", how: "islands seen on clear days from the southern shore",
    door: { x: -700, z: 1225, r: 30 }, beyond: { x0: -1250, z0: 1250, x1: -250, z1: 2000 } },
];
