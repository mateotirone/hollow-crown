// Where each landmark stands. A site is one or more pieces (designs from designs_data.js) set round an anchor.
// The plots' own landmarks stand at PLOT_PLAN[i].relic (plots/config.js); what each one is comes from the lore
// (lore/data/plots.js, field `build`). A piece can seek its spot from the anchor (landmarks/plan.js seekSpot):
//   water   the nearest shore along the given bearings (the piece's front faces the water)
//   edge    the nearest cliff edge (front faces out over the drop)
//   uphill  stays at the anchor, its front turned to the rising ground
// `place` names the lore place (lore/data/world.js PLACES) the Ledger should point at, if any.

import { PLOT_PLAN } from "../plots/config.js";

const relic = (name) => PLOT_PLAN.find((p) => p.name === name).relic;

const PLOT_SITES = {
  Harrowford: [{ d: "harrowford_field" }, { d: "harrowford_ferry", turns: true, seek: { kind: "water", bearing: 157, spread: 50, max: 240 } }],
  Oakmere: [{ d: "oakmere_cellar" }, { d: "oakmere_oaks" }],
  Thistledown: [{ d: "thistledown_frame" }, { d: "thistledown_pens" }],
  Wrenfield: [{ d: "wrenfield_garden" }, { d: "wrenfield_jetty", turns: true, seek: { kind: "water", bearing: 180, spread: 180, max: 200 } }],
  Frosthelm: [{ d: "frosthelm_road", turns: true, seek: { kind: "uphill" } }],
  Wolfcairn: [{ d: "wolfcairn_cairn" }],
  Gullcliff: [{ d: "gullcliff_beacon", turns: true, seek: { kind: "edge", bearing: 290, spread: 70, max: 200 } }],
  Tidewatch: [{ d: "tidewatch_posts", turns: true, seek: { kind: "water", bearing: 202, spread: 60, max: 200 } }],
  Reedmoor: [{ d: "reedmoor_ring" }],
  Lanternbog: [{ d: "lanternbog_posts" }],
  Redmesa: [{ d: "redmesa_stones" }],
  Dunehold: [{ d: "dunehold_hall" }, { d: "dunehold_well", dx: -30 }, { d: "dunehold_palms", dx: -30 }],
};

// The story's places out in the land (map/structures/landmarks_story.py). `face` fixes which way a turning piece's
// front looks (n/e/s/w): the Deepforge's door to the open hillside, the Cinder Roost's Span out over the drop.
const STORY_SITES = [
  { id: "crownhold", region: "Aldmere Vale", name: "Crownhold", x: -235, z: -345, place: "crownhold", pieces: [{ d: "crownhold_hall" }, { d: "crownhold_walls" }] },
  { id: "bellhollow", region: "Aldmere Vale", name: "Bellhollow", x: 155, z: -100, place: "bellhollow", pieces: [{ d: "bellhollow_seal" }, { d: "bellhollow_frame", dx: -22 }] },
  { id: "ashen_chapterhouse", region: "Aldmere Vale", name: "the Ashen Gate chapterhouse", x: 420, z: -170, place: "ashen_chapterhouse", pieces: [{ d: "ashen_chapterhouse" }] },
  { id: "ashen_watch", region: "Blackfen", name: "the Ashen Watch", x: 480, z: 560, pieces: [{ d: "ashen_watch" }] },
  { id: "corvins_tower", region: "Aldmere Vale", name: "Corvin's Tower", x: -416, z: -696, place: "corvins_tower", pieces: [{ d: "corvins_tower" }] },
  { id: "mags_hut", region: "Blackfen", name: "Old Mag's hut", x: 4, z: 972, place: "mags_hut", pieces: [{ d: "mags_hut" }] },
  { id: "nell_raft", region: "Blackfen", name: "Nell Sedge's raft-house", x: 26, z: 1001, place: "nell_raft", pieces: [{ d: "nell_raft" }] },
  // Goody Sedge's graves (the Witch trial): the last dry ground between Old Mag's hut and the pool Nell's raft lies in
  // (ground 69-71 on the map's heights, the pool 58-61 from x 20 east)
  { id: "sedge_graves", region: "Blackfen", name: "Goody Sedge's graves", x: 10, z: 988, pieces: [{ d: "sedge_graves" }] },
  { id: "deepforge", region: "Frostmarch", name: "the Deepforge", x: -274, z: -938, place: "deepforge", pieces: [{ d: "deepforge", turns: true, face: "e" }] },
  // version 2: built again once so the Span's two ends reach the Rider trial (roletrials marks.js)
  { id: "cinder_roost", region: "Emberwaste", name: "the Cinder Roost", x: 898, z: 346, place: "cinder_roost", version: 2, pieces: [{ d: "cinder_roost", turns: true, face: "s" }] },
];

export const LANDMARKS = [
  ...Object.entries(PLOT_SITES).map(([plot, pieces]) => {
    const { x, z } = relic(plot);
    return { id: `relic_${plot.toLowerCase()}`, name: `${plot}'s old landmark`, plot, x, z, pieces, version: 1 };
  }),
  ...STORY_SITES.map((s) => ({ version: 1, ...s })),
];

// How far from a site's anchor a player must come before it builds, and how far its pieces may reach.
export const BUILD_NEAR = 96;
export const reachOf = (site) => Math.max(40, ...site.pieces.map((p) => (p.seek?.max ?? 0) + 40 + Math.abs(p.dx ?? 0) + Math.abs(p.dz ?? 0)));
