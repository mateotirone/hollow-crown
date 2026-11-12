// The six wonders: one fixed site each on the map, outside every town. Words and numbers only (Node loads it).
// Buildings: designs_data.js (map/structures/export_wonders.py, minecraft-builder specs in map/structures/wonders/).
//
//   site: { x, z } world block, face: the way the front looks ("n" | "s" | "e" | "w")
//   effect: what the holder (and the holder's allies) get once all six stages stand
//     { kind: "charge", reasons: [...], by }   prices paid for these reasons are `by` lower (0.25 = a quarter off)
//     { kind: "pay", jobs: true, by }          coins from selling to job NPCs are `by` higher
//     { kind: "keep", by }                     the keep heart has `by` more health
//     { kind: "arrivals", add }                `add` more newcomers at each dawn census

export const WONDER = {
  minTier: 2, // a City or more may raise one (0 Hamlet, 1 Town, 2 City, 3 Castle)
  stages: 6,
  stageCost: [300, 300, 350, 350, 350, 350], // Regals per stage (2,000 in all)
  stageSeconds: 150, // a stage rises in about this long once paid (the crew works while someone is near)
  buildRange: 96, // a stage only rises with a player this close (its chunks have to be loaded)
  keeperRange: 64, // the keeper stands at the site while a player is this close
  guard: 22, // blocks from the site centre that nobody (outside Creative) can break or build in
  lordFromDay: 12, // Rival Lords start racing for wonders from this day
  lordChance: 0.25, // each day, the chance a City lord without a wonder lays claim to a free one
  lordDaysPerStage: 2, // a lord's crew finishes one stage every this many days
  challengeMinutes: 10,
  challengeRange: 64, // the challenger has to stay this close to the site
  challengeRestDays: 2, // after a challenge (won or lost) the wonder can't be challenged again for this many days
  defenders: [4, 5, 6, 7, 8, 10], // by stages standing
};

export const WONDERS = [
  {
    id: "great_lighthouse", name: "Great Lighthouse", region: "Saltreach", style: "saltreach",
    site: { x: -960, z: -630 }, face: "e", keeper: "Harbourmaster Wenna",
    effect: { kind: "pay", jobs: true, by: 0.15 },
    says: "Goods sold to any trader pay 15% more.",
    blurb: "A white tower on the cliffs, its lamp seen from every ship on the north sea.",
  },
  {
    id: "high_watch", name: "High Watch", region: "the Vale", style: "vale",
    site: { x: -120, z: -370 }, face: "e", keeper: "Watch-Captain Aldous",
    effect: { kind: "keep", by: 0.2 },
    says: "Your keep heart has 20% more health.",
    blurb: "A tall stone watchtower over the heart of the Vale. Beacons pass word from it to every wall.",
  },
  {
    id: "rimeforge_hall", name: "Rimeforge Hall", region: "Frostmarch", style: "frostmarch",
    site: { x: -300, z: -1130 }, face: "s", keeper: "Forge-Mother Sigrun",
    effect: { kind: "charge", reasons: ["smith"], by: 0.2 },
    says: "Everything the Smith sells is 20% cheaper.",
    blurb: "A great forge hall in the snow, its fires never let go out.",
  },
  {
    id: "sun_gate", name: "Sun Gate Caravanserai", region: "the Emberwaste", style: "emberwaste",
    site: { x: 840, z: 240 }, face: "w", keeper: "Caravan-Master Idris",
    effect: { kind: "charge", reasons: ["railway"], by: 0.25 },
    says: "Track and trains cost a quarter less.",
    blurb: "A walled caravan court under a great sun-arch, where every road east meets.",
  },
  {
    id: "lantern_spire", name: "Lantern Spire", region: "Blackfen", style: "blackfen",
    site: { x: 310, z: 570 }, face: "n", keeper: "Lamplighter Orrin",
    effect: { kind: "arrivals", add: 1 },
    says: "One more newcomer comes to your town at each dawn.",
    blurb: "A thin spire of lamps over the fen pools. Lost travellers follow it in.",
  },
  {
    id: "great_horse_fair", name: "Great Horse Fair", region: "the Vale", style: "vale",
    site: { x: -440, z: 300 }, face: "w", keeper: "Fair-Warden Bess",
    effect: { kind: "charge", reasons: ["horses"], by: 0.25 },
    says: "Grooms, training and foals cost a quarter less.",
    blurb: "Paddocks, stands and a ring where the best horses in the land change hands.",
  },
];

export const WONDER_BY_ID = Object.fromEntries(WONDERS.map((w) => [w.id, w]));

export const WONDER_LINES = {
  free: "No one has claimed it. A City's coin could raise it.",
  needCity: "Only a City can take on work like this. Grow your settlement first.",
  oneAtATime: "Your crews are busy on another wonder. Finish that one first.",
  rising: "The crew is at work.",
  waiting: "The crew waits for the next payment.",
  done: "It stands, finished.",
  lordClaim: "{lord} has claimed the {name}. Their crews are already at work.",
  lordStage: "{lord}'s crews finish another stage of the {name}.",
  raised: "{holder} has raised the {name}!",
  taken: "{holder} has taken the {name}.",
  challenge: "{player} has challenged for the {name}.",
  defended: "The {name} holds. {player}'s challenge has failed.",
};
