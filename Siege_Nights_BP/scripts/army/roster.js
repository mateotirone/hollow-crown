// The army: every soldier type, what it costs and when it unlocks (pure, no Minecraft). index.js runs the
// Barracks training menu on it. Mateo, 2026-11-12: train from the Barracks menu (no villager), pick how many of
// each type, see the total, press Train; they come out one after another; a fallen soldier retrains for a share
// of his price; upgrading the Barracks brings every price down. Prices are first guesses.

export const TIERS = ["Hamlet", "Town", "City", "Castle"];

// at: "barracks" (all train there; Mateo 2026-11-12). brings: a siege crew's own engine, part of his price. slots: room taken in the cap.
export const SOLDIERS = [
  { id: "siege:man_at_arms", name: "Man-at-Arms", cost: 40, unlock: "Hamlet", slots: 1, at: "barracks", job: "Sword and shield. Charges whoever attacks a friend; pours through a breach." },
  { id: "siege:archer", name: "Archer", cost: 40, unlock: "Hamlet", slots: 1, at: "barracks", job: "Longbow. Holds his spot on the wall or behind the line." },
  { id: "siege:pikeman", name: "Pikeman", cost: 50, unlock: "Hamlet", slots: 1, at: "barracks", job: "Long pike. Braces in a line across a gate or breach; stops horses." },
  { id: "siege:shieldbearer", name: "Shieldbearer", cost: 60, unlock: "Town", slots: 1, at: "barracks", job: "Tower shield. Walks between crews and enemy archers, soaking arrows." },
  { id: "siege:crossbowman", name: "Crossbowman", cost: 70, unlock: "Town", slots: 1, at: "barracks", job: "Heavy crossbow. Slow bolts through armour; picks off Knights." },
  { id: "siege:knight", name: "Knight", cost: 120, unlock: "City", slots: 2, at: "barracks", job: "Lance and horse. Rides at the head of the march, charges archers." },
  { id: "siege:ram_crew", name: "Ram crew", cost: 80, unlock: "Town", slots: 1, at: "barracks", brings: "a battering ram", job: "Pushes the ram he brings to the gate and swings it every 6 seconds." },
  { id: "siege:trebuchet_crew", name: "Trebuchet crew", cost: 100, unlock: "City", slots: 1, at: "barracks", brings: "a trebuchet", job: "Sets up the trebuchet he brings 40 blocks from the wall and widens one hole, a boulder every 45 seconds." },
  { id: "siege:sapper", name: "Sapper", cost: 90, unlock: "City", slots: 1, at: "barracks", brings: "three Breaching Charges", job: "Plants a Breaching Charge on the wall, runs, and comes back a minute later with the next." },
];
export const SOLDIER = Object.fromEntries(SOLDIERS.map((s) => [s.id, s]));

// Barracks levels: what the next level costs, and what each level takes off every price and training time
export const BARRACKS = {
  maxLevel: 5,
  upgrade: [0, 0, 400, 900, 1600, 2500], // Regals to reach level n
  discount: 0.08,       // 8% off hire and retrain prices per level above 1 (level 5: 32% off)
  trainSeconds: 12,     // per soldier at level 1
  trainFaster: 2,       // seconds less per level above 1
  retrainShare: 0.5,    // a fallen soldier retrains for half his hire price
};

export const unlocked = (soldier, tierName) => TIERS.indexOf(tierName) >= TIERS.indexOf(soldier.unlock);
export const priceOf = (soldier, level = 1) => Math.round(soldier.cost * (1 - BARRACKS.discount * (Math.max(1, level) - 1)));
export const retrainOf = (soldier, level = 1) => Math.max(1, Math.round(priceOf(soldier, level) * BARRACKS.retrainShare));
export const trainTicks = (level = 1) => 20 * Math.max(4, BARRACKS.trainSeconds - BARRACKS.trainFaster * (Math.max(1, level) - 1));
export const upgradeCost = (level) => (level >= BARRACKS.maxLevel ? undefined : BARRACKS.upgrade[level + 1]);

// The bill for an order { typeId: count }: { total, slots }
export function bill(order, level = 1) {
  let total = 0, slots = 0;
  for (const [id, n] of Object.entries(order)) {
    const s = SOLDIER[id];
    if (!s || !(n > 0)) continue;
    total += priceOf(s, level) * n;
    slots += s.slots * n;
  }
  return { total, slots };
}
