// Plan keys and what a player knows, as plain functions (Node-tested). Rules: config.js PLANS.
// A plan is "id" (in your own town's style, whatever it is) or "id@style" (in that region's style).
//
//   knownPlans({ stored, hallLevel, creative, designs }) -> Set of plan keys
//   planChoices(known, townStyle, designs) -> [{ id, style, foreign }]   what the plot menu may offer
//   planKey(id, style?), parsePlan(key) -> { id, style }
//   planCards(known, townStyle, designs, styles) -> one Plan Book card per design   whereFrom(id) -> { short, long }

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

// Where a plan not found yet comes from, short for its card and long for its details
export function whereFrom(id) {
  const lvl = Object.entries(PLANS.hall).find(([, ids]) => ids.includes(id))?.[0];
  if (lvl) return { short: `Hall level ${lvl}`, long: `Your town hall teaches it at level ${lvl}. Rival Lords who built one leave its plan when they fall, and bosses and Rumor jobs sometimes give one.` };
  return { short: "Lords, bosses", long: "Plan Scrolls come from toppled Rival Lords (what stood in their town), from bosses and sometimes from Rumor jobs. Other players can copy theirs for you." };
}

// The Plan Book screen's cards: known in the town's own style, in other styles only, or not found (greyed)
export function planCards(known, townStyle, designs, styles) {
  return designs.map((id) => {
    const home = known.has(id) || known.has(planKey(id, townStyle));
    const foreign = styles.filter((s) => s !== townStyle && known.has(planKey(id, s)));
    const look = home ? townStyle : foreign[0] ?? townStyle;
    const found = home || foreign.length > 0;
    return { id, home, foreign, known: found, texture: `textures/ui/hc/plans/${id}_${look}${found ? "" : "_dim"}` };
  });
}
