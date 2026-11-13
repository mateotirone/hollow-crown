// The arena's numbers and lists: the ones Mateo may want to tweak.

export const ARENA_RULES = {
  inviteSeconds: 60,        // how long an invite stays open
  readySeconds: 150,        // after the last invite is answered, how long fighters have to pick a kit and get ready
  countdown: 3,             // seconds of "3, 2, 1" before the gates lift
  gateCloseSeconds: 6,      // the gates drop again this long after they open (anyone still inside is walked out first)
  pvpMinutes: 10,           // a fight against Kings that runs this long is a draw
  mobMinutes: 8,            // a mob fight that runs this long is lost
  leaveMargin: 6,           // a fighter this far past the floor's edge (and not in their room) has left the fight
  maxCrowd: 60,             // crowd NPCs at most (fewer if the build has fewer seats)
  endHoldSeconds: 6,        // after the result, how long before everyone is sent back
};

// The arena kit: the same for everyone who takes it. Vanilla iron only (house rule).
// Every piece is marked "Arena kit" and taken back when the fight ends.
export const KIT = {
  armor: { Head: "minecraft:iron_helmet", Chest: "minecraft:iron_chestplate", Legs: "minecraft:iron_leggings", Feet: "minecraft:iron_boots" },
  offhand: "minecraft:shield",
  items: [
    ["minecraft:iron_sword", 1],
    ["minecraft:bow", 1],
    ["minecraft:iron_axe", 1],
    ["minecraft:arrow", 24],
    ["minecraft:cooked_beef", 8],
    ["minecraft:golden_apple", 1],
  ],
};
export const KIT_LORE = "§8Arena kit (handed back when the fight ends)";

// How hard a mob fight is. count: how many of the mob come out; effects: given to each; pay: reward multiplier.
export const DIFFICULTIES = [
  { id: "squire", name: "Squire", count: 1, effects: [], pay: 1 },
  { id: "knight", name: "Knight", count: 2, effects: [], pay: 2.5 },
  { id: "champion", name: "Champion", count: 3, effects: [["strength", 0], ["resistance", 0]], pay: 5 },
  { id: "legend", name: "Legend", count: 4, effects: [["strength", 1], ["resistance", 1], ["speed", 0]], pay: 9 },
];

// The mobs you can call into the arena. base: Regals for beating one at Squire. All our own creatures: no vanilla
// monster is ever spawned (Mateo 2026-11-13).
// Hollow creatures are left out on purpose: the arena is open from day one, and the Hollow isn't shown early.
export const ARENA_MOBS = [
  { type: "siege:ash_scarab", name: "Ash Scarab", base: 3 },
  { type: "siege:rimewolf", name: "Rimewolf", base: 5 },
  { type: "siege:mire_toad", name: "Mire Toad", base: 4 },
  { type: "siege:hollow_footman", name: "Tollman", base: 6 },
  { type: "siege:torchbearer", name: "Torchbearer", base: 5 },
  { type: "siege:crow_mage", name: "Crow-Mage", base: 6 },
  { type: "siege:brine_lurker", name: "Brine Lurker", base: 7 },
  { type: "siege:bog_hag", name: "Bog Hag", base: 7 },
  { type: "siege:barrow_wight", name: "Barrow Wight", base: 8 },
  { type: "siege:ashen_squire", name: "Ashen Squire", base: 6 },
  { type: "siege:inquisitor", name: "Inquisitor", base: 9 },
  { type: "siege:ashen_knight", name: "Ashen Knight", base: 11 },
  { type: "siege:shieldwall_brute", name: "Shieldwall Brute", base: 13 },
  { type: "siege:dune_wyrm", name: "Dune Wyrm", base: 20 },
  { type: "siege:siege_ogre", name: "Siege Ogre", base: 26 },
  { type: "siege:gatebreaker", name: "Gatebreaker", base: 28 },
];

// Beating the same mob at the same difficulty again on the same day pays less each time (so the arena can't be
// farmed for endless Regals): full, then 75%, 50%, and 25% from then on. A new day starts fresh.
export const REPEAT_PAY = [1, 0.75, 0.5, 0.25];
