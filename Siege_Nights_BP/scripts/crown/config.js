// The Crown, the Citadel and usurping: every number Mateo might want to tweak.
// Full design: the "Crown, Citadel and Usurpation" doc.

export const CROWN = {
  citadelName: "the Hollow Throne", // placeholder name for the Citadel
  titles: ["King", "Queen", "Monarch", "Emperor", "Empress", "Warlord", "Lord", "Lady"],

  // The Citadel
  citadelRadius: 100, // Citadel land reaches this far from its Keep Banner (a Castle reaches 80)
  wallRadius: 92, // the curtain wall ring
  keepMaxFromBanner: 40, // the Citadel Cornerstone must be placed this close to the Keep Banner
  buildTicks: 3600, // how long the Citadel takes to rise (3600 = 3 minutes)
  royalGuardBonus: 8, // extra guard slots for the ruler
  citadelKeepHealth: 600, // the keep heart's health if raiders ever march on the Citadel (New Source)

  // Ruler powers
  decreeSiegeCost: 16, // emeralds
  decreeSiegeThreat: 1.5, // a decreed siege is this much bigger
  decreePeaceCost: 8,
  titheSteps: [0, 10, 20, 30], // percent of other settlements' siege winnings
  kneelRange: 8, kneelTicks: 80, kneelCooldown: 900, // 45 seconds
  rallyRange: 16, rallyTicks: 200, rallyCooldown: 1800, // 90 seconds
  returnCooldown: 12000, // 10 minutes
  purifyCost: 32, purifyAmount: 15,

  // The Hunger
  hollowPerNight: 3, hollowPerDecree: 4, hollowPerDefense: 10, hollowShatter: 5,
  unrestPerDecree: 2,

  // Claims
  claimNeeded: 100,
  claimShard: 25, claimSiegeWin: 5, claimWarlord: 10, claimExileStart: 40,
  shardTreasury: 8, // emeralds the ruler's Treasury gets for shattering a shard
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
  defenseReward: 16, // emeralds into the Treasury when the ruler holds
};

export const IDS = {
  crown: "siege:hollow_crown",
  scepter: "siege:royal_scepter",
  cornerstone: "siege:citadel_cornerstone",
  throne: "siege:throne",
  shardItem: "siege:crown_shard",
  shardBlock: "siege:fallen_shard",
  gauntlet: "siege:gauntlet_of_challenge",
  seal: "siege:throne_seal",
  stormTag: "siege_crown_storm", // on the claimant's side during a Storm: only they can hurt the Seal
};
