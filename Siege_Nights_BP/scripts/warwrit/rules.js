// War Writs: the pure rules (no Minecraft). index.js runs them.
//
// Mateo picked "Declaring a siege" (2026-11-12): declare on a settlement, a muster window, one assault night,
// then peace. Every number here is a first guess, ready to tune.

const HOUR = 3600 * 1000, DAY = 24 * HOUR;

export const WRIT = {
  fee: 320,               // Regals to issue a War Writ
  musterTicks: 3600,      // at least 3 real minutes between declaring and the assault
  nightfall: 13000,       // time of day the assault starts
  dawn: 23000,            // and ends (the same Minecraft day: day N runs from 0 to 24000)
  peaceMs: 3 * DAY,       // after a siege the two can't declare on each other for 3 real days
  feudMs: 3 * DAY,        // attacking someone's settlement gives them grounds on you for 3 real days
  refusedMs: 3 * DAY,     // a refused demand gives grounds for 3 real days
  demandMs: DAY,          // a demand unanswered for a real day counts as refused
  demandShare: 0.1,       // a demand asks for a tenth of their Regals
  demandMin: 50,
};

// The day (world.getDay()) whose night the assault falls on, declared at day `day`, time of day `tod`
export const assaultDay = (day, tod) => (tod + WRIT.musterTicks <= WRIT.nightfall ? day : day + 1);

// Where a writ stands at day `day`, time of day `tod`: "muster", "assault" or "over"
export function phase(writ, day, tod) {
  if (!writ) return "over";
  if (day < writ.day || (day === writ.day && tod < WRIT.nightfall)) return "muster";
  if (day === writ.day && tod < WRIT.dawn) return "assault";
  return "over";
}

// Why `attacker` may declare on `defender`, or undefined. facts: { relic, feudUntil, refusedUntil, now }
export function groundsFor({ relic, feudUntil = 0, refusedUntil = 0, now }) {
  if (relic) return "relic";
  if (feudUntil > now) return "feud";
  if (refusedUntil > now) return "refused";
  return undefined;
}

export const GROUNDS_TEXT = {
  relic: "they hold a relic",
  feud: "they attacked your settlement",
  refused: "they refused your demand",
};

export const pairKey = (a, b) => [a, b].sort().join("|");
export const demandAmount = (balance) => Math.max(WRIT.demandMin, Math.floor(balance * WRIT.demandShare));

// Whether a new writ may be issued. Returns the reason it can't, or undefined.
export function cantDeclare({ attacker, defender, hasKeep, targetKeep, peaceUntil = 0, writs, now, grounds }) {
  if (!hasKeep) return "You need a settlement of your own before you can declare war.";
  if (!targetKeep || attacker === defender) return "There is nobody here to declare war on.";
  if (peaceUntil > now) return "You are at peace with them for now.";
  if (writs[defender]) return "A War Writ is already out against them.";
  if (Object.values(writs).some((w) => w.attacker === attacker)) return "You already have a War Writ out. Finish that siege first.";
  if (writs[attacker]?.attacker === defender) return "They are already marching on you.";
  if (!grounds) return "You have no grounds. They must hold a relic, have attacked your settlement, or have refused your demand.";
  return undefined;
}
