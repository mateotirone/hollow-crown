// The mining villages of the Hollow: the numbers Mateo can tweak, and the pure rules (no game calls,
// so the offline check can test them). The game side is in index.js.
//
// Mateo's design (2026-11-10): the Hollow's people talk and trade. They live in mining villages and
// dig Choir Ore. Morvane kept them as slaves; once a Sorcerer wears the Hollow Crown they are
// grateful and work for that ruler. Each village keeps its ore in its Tally (the store). At dawn half
// of every Tally is carted to the Vault under the Seat. Visitors may buy ore at a Tally, rob a
// Tally, or go for the Vault. The ruler is told and brought there at once. While the ruling
// Sorcerer is offline nothing can be robbed: buying is the only way.

export const FOLK = {
  // Each village stands on the bank beside the light-river landing of the same id
  // (undertow/rivers.js RIVER_NODES), so every one can be reached by boat.
  villages: [
    { id: "glimwade", name: "Glimwade" },
    { id: "lowseam", name: "Lowseam" },
    { id: "tollrest", name: "Tollrest" },
    { id: "highcut", name: "Highcut" },
  ],
  perDay: 8, // raw Choir Ore each village digs per in-game day
  tallyCap: 48, // the most a village Tally holds
  cartShare: 0.5, // share of each Tally carted to the Vault at dawn
  price: 8, // emeralds per raw ore until the ruler sets a price
  minPrice: 1,
  maxPrice: 64,
  freePrice: 12, // price while nobody rules (the miners sell a little for themselves)
  boatPrice: 4, // emeralds for a Latticewood Boat at a Tally (free for the ruler)
  robGrab: 16, // most ore a thief takes from one Tally in one go
  robCooldownSeconds: 300, // per village
  vaultSeconds: 20, // how long a thief must stand at the Vault to break it open
  vaultShare: 0.25, // share of the Vault a successful thief carries off
  vaultReach: 5, // blocks: step further from the Vault than this and the attempt fails
  safeRadius: 22, // inside this distance of a village centre you are "in the village"
};

// Who the miners answer to right now.
//   "bound"   Morvane still rules: they are slaves, afraid, and sell nothing
//   "free"    Morvane has fallen and nobody wears the Crown yet
//   "crowned" a player Sorcerer rules
//   "regent"  the NPC ruler rules (single-player stand-in)
export function moodOf({ morvaneFallen, rulerId, regent }) {
  if (rulerId) return "crowned";
  if (regent) return "regent";
  return morvaneFallen ? "free" : "bound";
}

// May this player rob (a Tally or the Vault) right now? Returns { ok, why }.
export function robVerdict({ mood, isRuler, rulerOnline }) {
  if (isRuler) return { ok: false, why: "It is already yours." };
  if (mood === "bound") return { ok: false, why: "There is nothing here to take. Every stone of it goes below." };
  if (mood === "free") return { ok: false, why: "These people have only just been freed. You cannot bring yourself to do it." };
  if (mood === "crowned" && !rulerOnline) return { ok: false, why: "The Crown's wearer is away, and the Hollow holds its ore shut until they return. You can still buy." };
  return { ok: true };
}

// One day's digging: the new Tally count. Slaves dig for Morvane, so nothing collects.
export function dig(stock, mood) {
  if (mood === "bound") return 0;
  return Math.min(FOLK.tallyCap, stock + FOLK.perDay);
}

// The dawn cart: [what stays in the Tally, what goes to the Vault]. Only a ruler has a Vault to fill.
export function cart(stock, mood) {
  if (mood !== "crowned" && mood !== "regent") return [stock, 0];
  const moved = Math.floor(stock * FOLK.cartShare);
  return [stock - moved, moved];
}

export function priceOf(mood, rulerPrice) {
  if (mood === "free") return FOLK.freePrice;
  return Math.max(FOLK.minPrice, Math.min(FOLK.maxPrice, Math.round(rulerPrice ?? FOLK.price)));
}

export function vaultLoot(vault) {
  return { ore: Math.floor(vault.ore * FOLK.vaultShare), emeralds: Math.floor(vault.emeralds * FOLK.vaultShare) };
}

// Things that can be going on when a visitor walks into a village. The Storyteller (core/storyteller.js)
// chooses between them, so a player never meets the same one, or the same kind, twice running.
// Ids are saved in worlds: never rename one. moods: when it can happen. site: an errand to a place
// in undertow/roads.js SITES, offered once per player.
const OPEN = ["free", "crowned", "regent"];
export const HAPPENINGS = [
  { id: "rich_seam", kind: "build", moods: OPEN },
  { id: "half_price", kind: "social", moods: OPEN, notRuler: true },
  { id: "fireside", kind: "quiet", moods: OPEN },
  { id: "seam_mites", kind: "fight", moods: OPEN },
  { id: "bound_scrap", kind: "mystery", moods: ["bound"] },
  { id: "bound_cart", kind: "quiet", moods: ["bound"] },
  { id: "bound_warning", kind: "social", moods: ["bound"] },
  { id: "errand_truce_hall", kind: "journey", site: "truce_hall", once: true },
  { id: "errand_far_door", kind: "mystery", site: "far_door", once: true },
  { id: "errand_seams", kind: "journey", site: "the_seams", once: true },
  { id: "errand_drift", kind: "mystery", site: "drift_foot", once: true },
  { id: "errand_ranks", kind: "journey", site: "standing_ranks", once: true },
];
export const HAPPENING_GAP_SECONDS = 480; // at most one per player in this long
export const ERRAND_ORE = 4; // raw ore a miner pays for an errand walked
export const ERRAND_ASKS = {
  errand_truce_hall: "My mother swore there is a hall west of the Cross where two kings sat down. Nobody here is let out to look. Would you? Tell me if the table is still there.",
  errand_far_door: "At night you can hear them digging at the far west wall. Go and see what they are digging at. I would rather know.",
  errand_seams: "They say the rock past Cartmeet bleeds ore. If it is true, we are digging in the wrong place. Walk the rail and look.",
  errand_drift: "There are stones east of the path that forgot to fall. My boy thinks you can stand on them. Find out before he tries.",
  errand_ranks: "My brother went east with the army. They say every suit still stands in its row. I cannot go and count. Would you walk the rows for me?",
};
// Which happenings can be offered right now. Pure.
export function happeningsFor(mood, isRuler) {
  return HAPPENINGS.filter((h) => (!h.moods || h.moods.includes(mood)) && !(h.notRuler && isRuler));
}
// A line that is never the one this speaker said last. Pure: returns [line, index].
export function freshLine(lines, lastIndex, rng = Math.random) {
  if (lines.length < 2) return [lines[0], 0];
  let i = Math.floor(rng() * (lines.length - 1));
  if (i >= lastIndex && lastIndex >= 0) i++;
  return [lines[Math.min(i, lines.length - 1)], Math.min(i, lines.length - 1)];
}

// What the miners say. Hand-written, a few per mood; the lore thread may replace these with setFolkVoice().
export const LINES = {
  bound: [
    "Do not speak to me. He hears.",
    "We dig. It goes below. That is all there is.",
    "You should not be here when the cart comes.",
    "I had a name before the seams. Do not ask me for it.",
  ],
  free: [
    "They say he fell. Nobody has told the pickaxes yet.",
    "We still dig. We do not know what else we are.",
    "Is someone coming to take his place? Tell me it is not worse.",
    "First morning I ever woke without the bell in my teeth.",
  ],
  crowned: [
    "Tell the Crown we are grateful. Tell them twice.",
    "Ask anything of us. Anything. We remember what came before.",
    "The seam runs rich today. All of it for the one who freed us.",
    "If thieves come, the Crown will know before they close their hand.",
  ],
  regent: [
    "The new Crown is not him. That is enough for us.",
    "We dig, we are fed, nobody is taken below. It is enough.",
    "Pay at the Tally and you will have no trouble from us.",
    "The Crown watches the ore. It does not blink.",
  ],
};
export function setFolkVoice(lines) {
  for (const k of Object.keys(LINES)) if (Array.isArray(lines?.[k]) && lines[k].length) LINES[k] = lines[k];
}
