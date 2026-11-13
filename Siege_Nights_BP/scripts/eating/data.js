// Eating heals at once, the way it does in Java Edition (Mateo 2026-11-13).
// With a full hunger bar and any saturation left, a hurt player gets half a heart back every half second, and each
// half heart costs 1.5 saturation (less when less is left: the last scrap heals its share). Bedrock's own slow
// healing (half a heart every 4 seconds from 9 drumsticks up) still runs underneath.
export const EATING = {
  every: 10,        // ticks between fast heals
  fullHunger: 20,   // the bar must be full
  perHeal: 1.5,     // saturation one half heart costs
};

// What one fast heal does: { heal: health points given, cost: saturation spent }, or null when there is none.
export function fastHeal({ hunger, saturation, health, max }) {
  if (!(hunger >= EATING.fullHunger) || !(saturation > 0) || !(health > 0) || !(health < max)) return null;
  const cost = Math.min(saturation, EATING.perHeal);
  return { heal: Math.min(cost / EATING.perHeal, max - health), cost };
}
