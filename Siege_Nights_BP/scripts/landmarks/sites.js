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

export const LANDMARKS = Object.entries(PLOT_SITES).map(([plot, pieces]) => {
  const { x, z } = relic(plot);
  return { id: `relic_${plot.toLowerCase()}`, name: `${plot}'s old landmark`, plot, x, z, pieces, version: 1 };
});

// How far from a site's anchor a player must come before it builds, and how far its pieces may reach.
export const BUILD_NEAR = 96;
export const reachOf = (site) => Math.max(40, ...site.pieces.map((p) => (p.seek?.max ?? 0) + 40 + Math.abs(p.dx ?? 0) + Math.abs(p.dz ?? 0)));
