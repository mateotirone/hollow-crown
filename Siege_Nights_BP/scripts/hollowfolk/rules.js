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
