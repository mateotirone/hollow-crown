// The High Throne, the Citadel and usurping: every number and name Mateo might want to tweak.
// Full design: the "Crown, Citadel and Usurpation" doc.
//
// Winning it: no vote. The Heart lies where the boss fell; reach for it and everyone is told (heart.js).
//
// Who is who (Mateo, 2026-11-10): the HOLLOW CROWN belongs to the ruler of the Hollow, a max-level
// Sorcerer (the Undertow thread's code). This folder is the OTHER prize: whoever defeats the Hollow
// brings back a relic, becomes the most powerful player in the overworld, and their settlement
// becomes the Citadel. The folder and ids still say "crown" from the first design.

export const CROWN = {
  // Names. Change them here and every message follows.
  relic: "the Heart of the Hollow", // what the victor brings back from the Hollow (Mateo's pick, 2026-11-10)
  relicName: "The Heart of the Hollow", // the same, as an item name
  throne: "the High Throne", // the overworld rulership the relic gives
  citadelName: "Aldspire", // the Citadel, until its ruler names it (Mateo: each ruler names their own). Also a ruling lord's name for it
  citadelNameMax: 24, // longest name a ruler can type
  shard: "Oath Shard", // the fallen shards that give a Claim
  titles: ["Heartbearer", "High King", "High Queen", "Monarch", "Emperor", "Empress", "Warlord"],

  // Taking the Heart where the Choir fell
  heartBosses: ["morvane"], // whose death leaves the Heart behind (Morvane, the final boss, at the Seat)
  reachSeconds: 10, // how long a hand must stay on it; any damage in that time knocks it away
  reachRange: 4, // step further than this and you let go

  // The Citadel
  citadelRadius: 100, // Citadel land reaches this far from its Keep Banner (a Castle reaches 80)
  wallRadius: 92, // the curtain wall ring
  keepMaxFromBanner: 40, // the Citadel Cornerstone must be placed this close to the Keep Banner
  buildTicks: 3600, // how long the Citadel takes to rise (3600 = 3 minutes)
  royalGuardBonus: 8, // extra guard slots for the ruler
  guardCost: 5, // (old unit: x8 coins) the Treasury gets for each guard paid off when a new ruler moves in
  citadelKeepHealth: 400, // keep heart health if raiders ever march on the Citadel (400 is the most a keep heart can have)

  // Ruler powers
  decreeSiegeCost: 16, // old unit: every cost here is x8 in coins (16 = 128 Regals)
  decreeSiegeThreat: 1.5, // a decreed siege is this much bigger
  decreePeaceCost: 8,
  titheSteps: [0, 10, 20, 30], // percent of other settlements' siege winnings
  kneelRange: 8, kneelTicks: 80, kneelCooldown: 900, // 45 seconds
  rallyRange: 16, rallyTicks: 200, rallyCooldown: 1800, // 90 seconds
  returnCooldown: 12000, // 10 minutes
  purifyCost: 32, purifyAmount: 15,

  // The Hunger: what the Heart quietly does to whoever carries it. Always hidden from players.
  //   "full"     as designed: symptoms, then easier challenges, then the raiders turn on the ruler
  //   "cosmetic" whispers, a few dead patches of grass, the letter. Nothing harms, changes or removes the bearer
  //   "off"      nothing happens
  hunger: "cosmetic", // Mateo's pick, 2026-11-10: whispers and small wrong things, and nothing ever happens to the bearer
  hollowPerNight: 3, hollowPerDecree: 4, hollowPerDefense: 10, hollowShatter: 5,
  unrestPerDecree: 2,

  // Claims
  claimNeeded: 100,
  claimShard: 25, claimSiegeWin: 5, claimWarlord: 10, claimExileStart: 40,
  shardTreasury: 8, // (x8 coins) the ruler's Treasury gets for shattering a shard
  shardMinDistance: 150, shardMaxDistance: 400, shardsMax: 3,
  shardHeadStartTicks: 1200, // exiles on stage 4+ hear a Shardfall this much earlier (60 seconds)

  // Usurpation
  graceNights: 3, // siege nights a new or victorious ruler can't be challenged
  abandonDays: 7, // real days a ruler can dodge a challenge before the Crown leaves them
  claimantMisses: 3, // siege nights a claimant can miss before their challenge lapses
  lapsedClaim: 50,
  sealHealth: 1000,
  claimantLives: 3,
  awayTicks: 2400, // logging out for 2 minutes during the Storm forfeits it
  banishNights: 3, // siege nights an exile can't enter Citadel land
  defenseReward: 16, // (x8 coins) into the Treasury when the ruler holds

  // Rival lords: computer-run claimants, so the throne is contested even when you play alone.
  // They build a Claim against a player ruler, march on the keep, and rule if they win.
  npcRivals: true, // false = only real players ever challenge
  // The Rival Lords settled on the map's plots are the claimants (a bigger settlement = a faster Claim).
  // These three only stand in on a world where none has settled yet.
  lords: [ // pace = Claim gained each siege night a player holds the throne
    { key: "ashgrave", name: "Corwin Ashgrave", title: "Lord", pace: 10 },
    { key: "marrow", name: "Ysolde Marrow", title: "Lady", pace: 7 },
    { key: "kell", name: "Brandt Kell", title: "Lord", pace: 5 },
  ],
  npcStormThreat: 1.6, // a lord's army is this much bigger than a normal siege
  npcBackOff: 25, // Claim the other lords lose when one of them is beaten at the walls
  npcReturnClaim: 40, // a lord thrown off the throne starts again with this much Claim
  npcTithe: 20, // percent a ruling lord takes of your siege winnings
  npcHost: 6, // soldiers beside the lord in the throne room when you storm them
  npcLordHealthBoost: 9, // each level is 2 extra hearts on the lord
  npcLand: 48, // how far a ruling lord's ground reaches if no Citadel was ever raised
};

export const IDS = {
  scepter: "siege:heart_of_the_hollow", // the relic
  cornerstone: "siege:citadel_cornerstone",
  throne: "siege:throne",
  shardItem: "siege:crown_shard",
  shardBlock: "siege:fallen_shard",
  gauntlet: "siege:gauntlet_of_challenge",
  seal: "siege:throne_seal",
  restingHeart: "siege:resting_heart", // the Heart lying where the Choir fell
  stormTag: "siege_crown_storm", // on the claimant's side during a Storm: only they can hurt the Seal
  hostTag: "siege_crown_host", // a ruling lord's soldiers in the throne room
};
