// The six wonders: one fixed site each on the map, outside every town. Words and numbers only (Node loads it).
// Buildings: designs_data.js (map/structures/export_wonders.py, minecraft-builder specs in map/structures/wonders/).
//
//   site: { x, z } world block, face: the way the front looks ("n" | "s" | "e" | "w")
//   effect: what the holder (and the holder's allies) get once all six stages stand, and every settlement in its
//           home region too (Mateo 2026-11-12: "the boost to the entire region, not just the plot that grew it")
//   home: the plot region (economy REGIONS) whose settlements share the effect
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
  ease: 12, // the ground is graded from the wonder's level back into the land over this many blocks round it
  easeFill: 6, // in that ring, never build the ground up more than this (a cliff edge stays a cliff)
  guardMargin: 2, // the guarded ground reaches this far past the graded ring (nobody outside Creative breaks or builds in it)
  gradePerTick: 40, // ground columns graded per tick before the first stage goes up
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
    id: "great_lighthouse", home: "Saltreach", name: "Great Lighthouse", region: "Saltreach", style: "saltreach",
    site: { x: -960, z: -630 }, face: "e", keeper: "Harbourmaster Wenna",
    effect: { kind: "pay", jobs: true, by: 0.15 },
    says: "Goods sold to any trader pay 15% more.",
    blurb: "A white tower on the cliffs, its lamp seen from every ship on the north sea.",
  },
  {
    id: "high_watch", home: "Aldmere Vale", name: "High Watch", region: "the Vale", style: "vale",
    site: { x: -120, z: -370 }, face: "e", keeper: "Watch-Captain Aldous",
    effect: { kind: "keep", by: 0.2 },
    says: "Your keep heart has 20% more health.",
    blurb: "A tall stone watchtower over the heart of the Vale. Beacons pass word from it to every wall.",
  },
  {
    id: "rimeforge_hall", home: "Frostmarch", name: "Rimeforge Hall", region: "Frostmarch", style: "frostmarch",
    site: { x: -300, z: -1130 }, face: "s", keeper: "Forge-Mother Sigrun",
    effect: { kind: "charge", reasons: ["smith"], by: 0.2 },
    says: "Everything the Smith sells is 20% cheaper.",
    blurb: "A great forge hall in the snow, its fires never let go out.",
  },
  {
    id: "sun_gate", home: "Emberwaste", name: "Sun Gate Caravanserai", region: "the Emberwaste", style: "emberwaste",
    site: { x: 840, z: 240 }, face: "w", keeper: "Caravan-Master Idris",
    effect: { kind: "charge", reasons: ["railway"], by: 0.25 },
    says: "Track and trains cost a quarter less.",
    blurb: "A walled caravan court under a great sun-arch, where every road east meets.",
  },
  {
    id: "lantern_spire", home: "Blackfen", name: "Lantern Spire", region: "Blackfen", style: "blackfen",
    site: { x: 310, z: 570 }, face: "n", keeper: "Lamplighter Orrin", ground: "water", // stands on piles in the fen: no grading
    effect: { kind: "arrivals", add: 1 },
    says: "One more newcomer comes to your town at each dawn.",
    blurb: "A thin spire of lamps over the fen pools. Lost travellers follow it in.",
  },
  {
    id: "great_horse_fair", home: "Aldmere Vale", name: "Great Horse Fair", region: "the Vale", style: "vale",
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
