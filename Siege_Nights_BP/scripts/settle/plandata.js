// Plan keys and what a player knows, as plain functions (Node-tested). Rules: config.js PLANS.
// A plan is "id" (in your own town's style, whatever it is) or "id@style" (in that region's style).
//
//   knownPlans({ stored, hallLevel, creative, designs }) -> Set of plan keys
//   planChoices(known, townStyle, designs) -> [{ id, style, foreign }]   what the plot menu may offer
//   planKey(id, style?), parsePlan(key) -> { id, style }

import { PLANS } from "./config.js";

export const planKey = (id, style) => (style ? `${id}@${style}` : id);
export function parsePlan(key) {
  const [id, style] = String(key).split("@");
  return { id, style: style || undefined };
}

export function knownPlans({ stored = [], hallLevel = 0, creative = false, designs = [] } = {}) {
  const out = new Set(PLANS.basics);
  for (const [lvl, ids] of Object.entries(PLANS.hall)) if (hallLevel >= Number(lvl)) ids.forEach((id) => out.add(id));
  for (const k of stored) out.add(k);
  if (creative) designs.forEach((id) => out.add(id)); // nothing is hidden from Creative
  return out;
}

// Every building the menu may offer: each known plan once in the town's own style, and once more for each
// other region's style it is known in
export function planChoices(known, townStyle, designs) {
  const out = [];
  const seen = new Set();
  for (const key of known) {
    const { id, style } = parsePlan(key);
    if (!designs.includes(id)) continue;
    const s = !style || style === townStyle ? townStyle : style;
    const k = `${id}@${s}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ id, style: s, foreign: s !== townStyle });
  }
  return out;
}

// Plans a source can hand out that this player doesn't know yet (for scrolls): [{ id, style }]
export function unknownOf(known, offers, townStyle) {
  return offers.filter(({ id, style }) => !(known.has(planKey(id, style)) || ((style === townStyle || !style) && known.has(id))));
}
