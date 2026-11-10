// The Tree of Oaths: every skill in the game, as plain data (no Minecraft imports, so it loads in Node tests).
//
// Rings unlock as your town hall grows, and each ring also needs a Renown level:
//   ring 1  Longhouse   (Hamlet)    Renown 1
//   ring 2  Stone Hall  (Town)      Renown 5
//   ring 3  Keep        (City)      Renown 12
//   ring 4  Fortress    (Castle)    Renown 20   capstones
//   ring 5  Throne      (Sovereign) Renown 30   endgame
//
// Branches: keep + wayfarer for everyone, blade for Knights only, arcana for the Marked only.
// cost = skill points per rank. needs = another skill id that must have at least 1 rank first.

export const RINGS = [
  null,
  { ring: 1, hall: 1, level: 1, name: "First Ring" },
  { ring: 2, hall: 2, level: 5, name: "Second Ring" },
  { ring: 3, hall: 3, level: 12, name: "Third Ring" },
  { ring: 4, hall: 4, level: 20, name: "Capstones" },
  { ring: 5, hall: 5, level: 30, name: "Crown Ring" },
];

export const BRANCHES = {
  keep: { name: "Keep", who: "all", icon: "textures/items/siege_writ", blurb: "Your walls, your guards, your land." },
  wayfarer: { name: "Wayfarer", who: "all", icon: "textures/items/compass_item", blurb: "The road, the horse, the hunt for answers." },
  blade: { name: "Blade", who: "knight", icon: "textures/items/siege_longsword", blurb: "Techniques of the Order of the Ashen Gate." },
  arcana: { name: "Arcana", who: "marked", icon: "textures/items/siege_hollow_ember", blurb: "What the Ember lets you do, and what it costs." },
};

const S = (id, branch, ring, name, max, cost, desc, extra = {}) => ({ id, branch, ring, name, max, cost, desc, ...extra });

export const SKILLS = [
  // ---------------- KEEP ----------------
  S("keep_hearth", "keep", 1, "Hearthwarden", 3, 1, ["Regenerate health in your own land when out of combat. Every 6s / 4s / 3s."]),
  S("keep_stonewright", "keep", 1, "Stonewright", 2, 1, ["Haste I / II while standing in your own land."]),
  S("keep_muster", "keep", 1, "Muster Roll", 3, 1, ["+1 guard slot per rank."]),
  S("keep_wards", "keep", 2, "Masonry Wards", 3, 2, ["During a siege your keep mends itself: 3 / 6 / 9 health every 2 seconds."], { needs: "keep_hearth" }),
  S("keep_watchfire", "keep", 2, "Watchfire", 1, 2, ["When a siege begins you learn which sides of your land they will hit, and raiders inside your land are marked with a rising flare for the first 20 seconds of every wave."]),
  S("keep_spoils", "keep", 2, "Spoils of War", 2, 2, ["Holding your keep pays 25% / 50% more emeralds."]),
  S("keep_plunder", "keep", 2, "Plunder", 3, 2, ["Raiders you kill have a 15% / 30% / 45% chance to drop an extra emerald."]),
  S("keep_rally", "keep", 3, "Rally the Walls", 2, 3, ["During a siege you and your guards in your land get Resistance I. Rank 2: guards also get Strength I."], { needs: "keep_wards" }),
  S("keep_masterbuilder", "keep", 3, "Master Builder", 1, 3, ["Town hall upgrades cost 25% less and rise twice as fast."], { needs: "keep_stonewright" }),
  S("keep_unbreakable", "keep", 4, "The Unbreakable Keep", 1, 6, ["Once per siege, when your keep drops below 25% it surges back to 60% and hurls nearby raiders away."], { needs: "keep_rally" }),
  S("keep_court", "keep", 5, "Sovereign's Court", 1, 8, ["Guards within 24 blocks of you get Strength II and Regeneration I. Your land's banner border burns gold."], { needs: "keep_unbreakable" }),

  // ---------------- WAYFARER ----------------
  S("way_fleet", "wayfarer", 1, "Fleetfoot", 2, 1, ["Speed I / II when you have been out of combat for 5 seconds."]),
  S("way_forager", "wayfarer", 1, "Forager", 2, 1, ["Hunger refills slowly on the road: a moment of Saturation every 30s / 15s."]),
  S("way_clue", "wayfarer", 1, "Clue Sense", 1, 1, ["Your Ledger whispers when a clue or Lore Tome is within 16 blocks."]),
  S("way_horse", "wayfarer", 2, "Horse Whisperer", 3, 2, ["Any horse you ride gets Speed I / II / III."], { needs: "way_fleet" }),
  S("way_pathfinder", "wayfarer", 2, "Pathfinder", 2, 2, ["Recover 50% / 100% of any fall damage you survive."]),
  S("way_tongue", "wayfarer", 2, "Silver Tongue", 2, 2, ["Villagers treat you as Hero of the Village I / II: cheaper trades everywhere."]),
  S("way_nighteyes", "wayfarer", 3, "Night Eyes", 1, 3, ["Night Vision whenever it is night or you are underground."]),
  S("way_mapwright", "wayfarer", 3, "Mapwright", 2, 3, ["Hold a compass to see the heading and distance to your town hall. Rank 2: Charted Map wisps reach twice as far."], { needs: "way_clue" }),
  S("way_tide", "wayfarer", 3, "Tidewalker", 1, 3, ["Conduit Power while in water: breathe, see and mine underwater."]),
  S("way_roadwise", "wayfarer", 4, "Roadwise", 1, 6, ["Outside any settlement: Speed II and Jump Boost I, and riding never makes you hungry."], { needs: "way_horse" }),
  S("way_homeward", "wayfarer", 5, "The Long Road Home", 1, 8, ["Sneak and use a compass to return to your town hall. 10 minute cooldown."], { needs: "way_roadwise" }),

  // ---------------- BLADE (Knight) ----------------
  S("blade_bash", "blade", 1, "Shield Bash", 3, 1, ["Sneak and hit with a shield in your off hand: knock the target back and slow it for 2 / 3 / 4s. Cooldown 6 / 5 / 4s."]),
  S("blade_lunge", "blade", 1, "Lunge", 3, 1, ["Sprint and hit: dash forward and deal +2 / +3 / +4 damage. Cooldown 5s."]),
  S("blade_constitution", "blade", 1, "Iron Constitution", 3, 1, ["+2 / +4 / +6 hearts of max health."]),
  S("blade_riposte", "blade", 2, "Riposte", 2, 2, ["Take a melee hit while sneaking with a shield: strike back for 3 / 5 damage and gain Strength I for 3s."], { needs: "blade_bash" }),
  S("blade_rally", "blade", 2, "Rallying Cry", 3, 2, ["Use your Oath Banner: heal yourself, allies and guards within 10 blocks for 4 / 6 / 8 health and give Strength I for 8s. Cooldown 45s."]),
  S("blade_mastery", "blade", 2, "Armor Mastery", 3, 2, ["In a full set of iron or better, recover 10% / 15% / 20% of every hit you survive."], { needs: "blade_constitution" }),
  S("blade_captain", "blade", 2, "Guard Captain", 2, 2, ["Your guards within 16 blocks of you get Strength I. Rank 2: Resistance I too."]),
  S("blade_execution", "blade", 3, "Execution", 1, 3, ["Hits on enemies below 20% health deal +8 damage (+4 on bosses)."], { needs: "blade_lunge" }),
  S("blade_charge", "blade", 3, "Warhorse Charge", 2, 3, ["Gallop a horse into enemies: 4 / 7 damage and they are thrown aside."], { needs: "blade_rally" }),
  S("blade_banner", "blade", 3, "Banner of the Keep", 2, 3, ["Sneak and use your Oath Banner to plant it for 20 / 30s. Allies near it get Strength I and Resistance I; enemies get Weakness. Cooldown 90s."], { needs: "blade_rally" }),
  S("blade_secondwind", "blade", 3, "Second Wind", 1, 3, ["Once every 5 minutes, dropping below 2 hearts heals you to 6 hearts with Resistance II for 4s."], { needs: "blade_mastery" }),
  S("blade_champion", "blade", 4, "Oathsworn Champion", 1, 6, ["Permanent Strength I. All technique cooldowns 30% shorter. Your Rallying Cry sends your guards charging."], { needs: "blade_execution" }),
  S("blade_crownbreaker", "blade", 5, "Crownbreaker", 1, 8, ["Each hit has a 15% chance to call down a ringing strike for +6 damage around the target."], { needs: "blade_champion" }),

  // ---------------- ARCANA (Marked) ----------------
  S("arc_bolt", "arcana", 1, "Ember Bolt", 3, 1, ["Power. A bolt of pale fire, 24 blocks: 5 / 7 / 10 damage. Level 3 sets the target alight. Resonance +8."], { power: true }),
  S("arc_ward", "arcana", 1, "Ward", 3, 1, ["Power. Wrap yourself in Absorption I / II / III for 20s. Resonance +15. Cooldown 20s."], { power: true }),
  S("arc_quiet", "arcana", 1, "Quiet Mind", 3, 1, ["Resonance fades 30% / 60% / 90% faster."]),
  S("arc_blink", "arcana", 2, "Blink", 3, 2, ["Power. Step 8 / 12 / 16 blocks the way you look. Resonance +12. Cooldown 4s."], { power: true, needs: "arc_bolt" }),
  S("arc_echo", "arcana", 2, "Echo Sight", 3, 2, ["Power. For 10 / 15 / 20s see in the dark, sense every creature within 24 / 32 / 40 blocks, and reveal hidden doors. Resonance +10."], { power: true }),
  S("arc_bind", "arcana", 2, "Bind", 3, 2, ["Power. Root the creature you look at for 3 / 5 / 7s (half on bosses). Resonance +14. Cooldown 10s."], { power: true, needs: "arc_bolt" }),
  S("arc_ashen", "arcana", 2, "Ashen Skin", 2, 2, ["Fire Resistance always. Rank 2: Resistance I while Resonance is 50 or more."], { needs: "arc_ward" }),
  S("arc_step", "arcana", 3, "Undertow Step", 3, 3, ["Power. Slip half into the mirror world for 3 / 4 / 5s: invisible, untouchable, fast. Resonance +20. Cooldown 30s."], { power: true, needs: "arc_blink" }),
  S("arc_choir", "arcana", 3, "Choir's Call", 3, 3, ["Power. Raiders within 10 / 14 / 18 blocks hear the bell and turn on each other for 6 / 8 / 10s. Resonance +30. Cooldown 60s."], { power: true, needs: "arc_echo" }),
  S("arc_resonant", "arcana", 3, "Resonant Soul", 2, 3, ["While Resonance is 70 or more, powers are 25% / 50% stronger."], { needs: "arc_quiet" }),
  S("arc_hollowborn", "arcana", 4, "Hollowborn", 1, 6, ["Powers cost 25% less Resonance and cool down 30% faster. At 100 Resonance you enter a Crescendo: 10s of free casting, then you crash."], { needs: "arc_step" }),
  S("arc_crownless", "arcana", 5, "Crownless", 1, 8, ["Ember Bolt arcs to 2 more enemies near the first."], { needs: "arc_hollowborn" }),
];

export const SKILL = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

// Path ranks, earned by points spent in your path's branch.
export const RANKS = {
  knight: [
    { at: 0, name: "Squire" },
    { at: 3, name: "Man-at-Arms" },
    { at: 8, name: "Knight" },
    { at: 15, name: "Banneret" },
    { at: 26, name: "Knight-Commander" },
  ],
  marked: [
    { at: 0, name: "Touched" },
    { at: 3, name: "Listener" },
    { at: 8, name: "Adept" },
    { at: 15, name: "Hollowborn" },
    { at: 26, name: "Crownless" },
  ],
};

// ---------- Renown: the player's level ----------
// Renown is XP from everything you do. Each level gives a skill point (2 on every 5th level).
export const MAX_LEVEL = 50;
export const renownForNext = (level) => 40 + 20 * level; // renown needed to go from `level` to `level + 1`
export const pointsForLevel = (level) => (level % 5 === 0 ? 2 : 1);
export function levelFromRenown(renown) {
  let level = 1;
  let left = renown;
  while (level < MAX_LEVEL && left >= renownForNext(level)) {
    left -= renownForNext(level);
    level++;
  }
  return { level, into: left, need: level < MAX_LEVEL ? renownForNext(level) : 0 };
}

export const LEVEL_TITLES = [
  [1, "Settler"], [5, "Freeholder"], [10, "Reeve"], [15, "Warden"], [20, "Lord"],
  [30, "High Lord"], [40, "Paragon"], [50, "Legend of the Realm"],
];
export const levelTitle = (level) => [...LEVEL_TITLES].reverse().find(([at]) => level >= at)[1];

// What each Renown milestone unlocks, for the "next unlock" line in the menu.
export const LEVEL_UNLOCKS = {
  5: "Second Ring of the Tree (with a Stone Hall)",
  10: "Unbinding your oaths costs half",
  12: "Third Ring of the Tree (with a Keep)",
  20: "Capstones (with a Fortress)",
  30: "Crown Ring (with a Sovereign's Throne)",
};

// ---------- Pure helpers (tested in Node) ----------

export function canBranch(branch, path) {
  const who = BRANCHES[branch].who;
  return who === "all" || who === path;
}

export function spentIn(skills, branch) {
  let total = 0;
  for (const [id, rank] of Object.entries(skills)) {
    const s = SKILL[id];
    if (s && (!branch || s.branch === branch)) total += s.cost * rank;
  }
  return total;
}

export function rankOf(path, skills) {
  const list = RANKS[path];
  if (!list) return undefined;
  const spent = spentIn(skills, path === "knight" ? "blade" : "arcana");
  return [...list].reverse().find((r) => spent >= r.at);
}

// Why a skill can't be learned right now, or undefined if it can.
// hero = { path, level, points, skills }, hallLevel = 0-5 of the tree being used.
export function blockedReason(skill, hero, hallLevel) {
  const have = hero.skills[skill.id] ?? 0;
  if (have >= skill.max) return "Mastered";
  if (!canBranch(skill.branch, hero.path)) return skill.branch === "blade" ? "Knights only" : "The Marked only";
  const ring = RINGS[skill.ring];
  if (hallLevel < ring.hall) return `Needs a ${HALL_NAMES[ring.hall]}`;
  if (hero.level < ring.level) return `Needs Renown ${ring.level}`;
  if (skill.needs && !(hero.skills[skill.needs] > 0)) return `Needs ${SKILL[skill.needs].name}`;
  if (hero.points < skill.cost) return `Needs ${skill.cost} point${skill.cost === 1 ? "" : "s"}`;
  return undefined;
}

export const HALL_NAMES = ["no hall", "Longhouse", "Stone Hall", "Keep", "Fortress", "Sovereign's Throne"];
