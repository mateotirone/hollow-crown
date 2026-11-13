// Upkeep (Mateo 2026-11-13: "should we introduce a taxing system? It just pops up on the screen every day:
// taxes taken, X amount"). Until now nothing drained Regals over time, so they only piled up. Each dawn a
// settlement pays for itself: a sum for its size, a little for every building and a wage for every guard.
// Pure numbers and maths (Node and self-tests). The game side is index.js.

export const UPKEEP = {
  base: { Hamlet: 0, Town: 8, City: 24, Castle: 48 }, // Regals a day for the town itself, by tier
  perBuilding: 2, // for every building that stands (plot buildings, hand-built ones that count, Barracks...)
  perGuard: 3, // a day's wage for every guard and soldier
  graceDays: 3, // days after a settlement is first seen before the first bill
  crownShare: 0.2, // when a player wears the Crown, this share of everyone else's upkeep goes to them
};

// What a settlement owes for one day: { town, buildings, guards, total }
export function upkeepOf({ tier = "Hamlet", buildings = 0, guards = 0 } = {}) {
  const town = UPKEEP.base[tier] ?? 0;
  const b = Math.max(0, buildings) * UPKEEP.perBuilding, g = Math.max(0, guards) * UPKEEP.perGuard;
  return { town, buildings: b, guards: g, total: town + b + g };
}

// One dawn's bill against what the owner has: what is taken, what goes to the Crown, and whether they fell short
export function settle(owed, have, { toCrown = false } = {}) {
  const paid = Math.max(0, Math.min(owed, Math.floor(have)));
  const crown = toCrown ? Math.floor(paid * UPKEEP.crownShare) : 0;
  return { paid, crown, short: owed - paid };
}

// "town 8, 10 buildings 20, 6 guards 18"
export function breakdown(bill, counts) {
  const parts = [];
  if (bill.town) parts.push(`town ${bill.town}`);
  if (bill.buildings) parts.push(`${counts.buildings} building${counts.buildings === 1 ? "" : "s"} ${bill.buildings}`);
  if (bill.guards) parts.push(`${counts.guards} guard${counts.guards === 1 ? "" : "s"} ${bill.guards}`);
  return parts.join(", ");
}
