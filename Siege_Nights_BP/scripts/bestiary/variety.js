// Nothing here should feel the same twice (Mateo's rule: never repetitive, never boring).
// Pure choices only, so they can be tested offline. bossCore.js and veterans.js do the acting.
//
//   chooseAttack   a boss never uses the same attack twice running if it has another one ready
//   TEMPERS        a boss you have already beaten comes back in a temper: same fight, a new problem on top
//   TRAITS         now and then a raider is a named veteran with one trait
//   staleKeys      which foes one player has met too often for how many variants they have

// due: attack ids ready this moment, in the boss's own priority order.
export function chooseAttack(due, last) {
  if (!due.length) return undefined;
  return due.find((id) => id !== last) ?? due[0];
}

// pace: attack clocks run this much faster. rest: the gap after an attack. every/act: an extra thing on its own clock.
export const TEMPERS = [
  { id: "hasty", name: "Hasty", line: "It does not wait for you this time.", pace: 0.7 },
  { id: "relentless", name: "Relentless", line: "It gives no breath between blows.", rest: 0.3 },
  { id: "unquiet", name: "Unquiet", line: "The ground here remembers the last fight.", every: 160, act: "ground" },
  { id: "attended", name: "Attended", line: "It did not come alone this time.", every: 520, act: "court" },
  { id: "wary", name: "Wary", line: "It remembers how it died.", every: 200, act: "slip" },
];
export const temperById = (id) => TEMPERS.find((t) => t.id === id);

// A rematch temper: never the one this boss wore last time.
export function pickTemper(last, roll = Math.random()) {
  const options = TEMPERS.filter((t) => t.id !== last);
  return options[Math.min(options.length - 1, Math.floor(roll * options.length))];
}

export const VETERAN_CHANCE = 0.15;
export const TRAITS = [
  { id: "fleet", name: "Fleet", effects: [["speed", 1]] },
  { id: "stubborn", name: "Stubborn", effects: [["health_boost", 3], ["resistance", 0]], mend: true },
  { id: "cruel", name: "Cruel", effects: [["strength", 0]] },
  { id: "leaping", name: "Leaping", effects: [["jump_boost", 2], ["speed", 0]] },
  { id: "ashen", name: "Ashen", effects: [["fire_resistance", 0]], burns: true },
];
export const traitById = (id) => TRAITS.find((t) => t.id === id);

// roll decides whether this one is a veteran at all, pick decides which trait; never the same trait as the last veteran.
export function traitFor(roll, pick, last, chance = VETERAN_CHANCE) {
  if (roll >= chance) return undefined;
  const options = TRAITS.filter((t) => t.id !== last);
  return options[Math.min(options.length - 1, Math.floor(pick * options.length))];
}

// One player's tally {key: times met}, how many variants each key has, and how many meetings per variant are too many.
export const STALE_AFTER = 40;
export function staleKeys(met, variantsOf, limit = STALE_AFTER) {
  return Object.entries(met)
    .map(([key, count]) => ({ key, count, variants: Math.max(1, variantsOf(key)) }))
    .filter((r) => r.count / r.variants > limit)
    .sort((a, b) => b.count / b.variants - a.count / a.variants);
}
