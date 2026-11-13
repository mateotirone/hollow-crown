// "You are entering ..." cards: the places that get one, and which place a spot is in. Pure, so the self-tests run
// it anywhere. Player settlements are added in index.js (they move and grow); towns, the Order's houses, the
// story's landmarks and the Wonders are here. Coordinates come from where each place is already defined
// (plots/config.js WARDS, landmarks/sites.js, wonders/data.js), so a moved place moves its card too.
// Thin places stay unnamed (they are for finding), like on the minimap.

import { WARDS } from "../plots/config.js";
import { LANDMARKS } from "../landmarks/sites.js";
import { WONDERS } from "../wonders/data.js";

export const ENTERING = {
  checkTicks: 10,   // how often each player's spot is looked at
  pad: 16,          // blocks past a place's edge before you count as gone (no flicker walking the boundary)
  repeatSeconds: 90, // the same place does not show its card again sooner than this
};

// The small line under the name: "You are entering <tagline>".
const TOWNS = {
  Kingsrest: "the King's town, heart of Aldmere Vale",
  Millbrook: "a mill village of Aldmere Vale",
  Rimehold: "a longhouse village of the Frostmarch",
  "Gull's Rest": "a fishing village of the Saltreach",
  Sunscar: "a desert fortress town of the Emberwaste",
  Mirelight: "a stilt village of the Blackfen",
  "the Ashen Gate Chapterhouse": "a house of the Order, in Aldmere Vale",
  "the Ashen Watch": "a watch-house of the Order, in the Blackfen",
  Bellhollow: "a valley of pilgrims' bells",
  Crownhold: "the ruined capital of Aldmere",
};

// Story landmarks (landmarks/sites.js id -> tagline). Small sites (a hut, a raft, a grave) get no card.
const SITES = {
  cinder_roost: "the rider school above Sunscar",
  deepforge: "the forge under the mountain",
  corvins_tower: "a lone tower in Aldmere Vale",
  frost_watchtower: "a ruin on the Frostmarch border",
  vorlunds_muster: "a war camp on the high plateau",
  far_shore: "a lookout over the Western Sea",
  horizon_isles: "the light at the land's southern end",
};
const SITE_R = 40;
const WONDER_R = 60;

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const PLACES = [
  ...WARDS.filter((w) => TOWNS[w.name]).map((w) => ({ key: `town:${w.name}`, name: cap(w.name), tagline: TOWNS[w.name], x: w.x, z: w.z, r: w.r })),
  ...LANDMARKS.filter((s) => SITES[s.id]).map((s) => ({ key: `site:${s.id}`, name: cap(s.name), tagline: SITES[s.id], x: s.x, z: s.z, r: SITE_R })),
  ...WONDERS.map((w) => ({ key: `wonder:${w.id}`, name: cap(w.name), tagline: `a Wonder of ${w.region}`, x: w.site.x, z: w.site.z, r: WONDER_R })),
];

// Which place (x, z) is in, given the one the player was in last time (its key, or null). You stay in a place until
// you are `pad` blocks past its edge; a new place counts once you are inside its edge. Nearest (by share of its
// radius) wins where two overlap.
export function placeAt(x, z, currentKey = null, places = PLACES, pad = ENTERING.pad) {
  const cur = currentKey && places.find((p) => p.key === currentKey);
  if (cur && Math.hypot(cur.x - x, cur.z - z) <= cur.r + pad) return cur;
  let best = null, bestShare = Infinity;
  for (const p of places) {
    const share = Math.hypot(p.x - x, p.z - z) / p.r;
    if (share <= 1 && share < bestShare) { best = p; bestShare = share; }
  }
  return best;
}

// The card for a player settlement. `tier` is its tier name (Hamlet, Village ...).
export function settlementCard({ ownerName, tier, mine, region }) {
  if (mine) return { name: `Your ${tier}`, tagline: "home" };
  return { name: `${ownerName}'s ${tier}`, tagline: region ? `${ownerName}'s land in ${region}` : `${ownerName}'s land` };
}

// The title and subtitle actually sent. "home" reads "You are home", not "You are entering home".
export function cardText({ name, tagline }) {
  return { title: `§6${name}`, subtitle: tagline === "home" ? "§7You are home" : `§7You are entering ${tagline}` };
}
