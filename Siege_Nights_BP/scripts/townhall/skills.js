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
  // regional roles: shown in the Tree only to those who hold the role
  wing: { name: "Wing", who: "rider", regional: true, icon: "textures/items/blaze_powder", blurb: "The saddle, the fire, and the beast that lets you ride it." },
  forge: { name: "Forge", who: "forgemaster", regional: true, icon: "textures/items/iron_ingot", blurb: "Steel made right, and the arm to use it." },
  helm: { name: "Helm", who: "captain", regional: true, icon: "textures/items/spyglass", blurb: "A crew that obeys, and weather that favours you." },
  hex: { name: "Hex", who: "witch", regional: true, icon: "textures/items/fermented_spider_eye", blurb: "What the fen takes, you learn to take too." },
};

const S = (id, branch, ring, name, max, cost, desc, extra = {}) => ({ id, branch, ring, name, max, cost, desc, ...extra });

export const SKILLS = [
  // ---------------- KEEP ----------------
  S("keep_hearth", "keep", 1, "Hearthwarden", 3, 1, ["Regenerate health in your own land when out of combat. Every 6s / 4s / 3s."]),
  S("keep_stonewright", "keep", 1, "Stonewright", 2, 1, ["Haste I / II while standing in your own land."]),
  S("keep_muster", "keep", 1, "Muster Roll", 3, 1, ["+1 guard slot per rank."]),
  S("keep_wards", "keep", 2, "Masonry Wards", 3, 2, ["During a siege your keep mends itself: 3 / 6 / 9 health every 2 seconds."], { needs: "keep_hearth" }),
  S("keep_watchfire", "keep", 2, "Watchfire", 1, 2, ["When a siege begins you learn which sides of your land they will hit, and raiders inside your land are marked with a rising flare for the first 20 seconds of every wave."]),
  S("keep_spoils", "keep", 2, "Spoils of War", 2, 2, ["Holding your keep pays 25% / 50% more coin."]),
  S("keep_plunder", "keep", 2, "Plunder", 3, 2, ["Raiders you kill have a 15% / 30% / 45% chance to drop 8 Regals."]),
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
  S("arc_step", "arcana", 3, "Halfstep", 3, 3, ["Power. Slip half out of the world, toward the Hollow, for 3 / 4 / 5s: invisible, untouchable, fast. Resonance +20. Cooldown 30s."], { power: true, needs: "arc_blink" }),
  S("arc_choir", "arcana", 3, "Choir's Call", 3, 3, ["Power. Raiders within 10 / 14 / 18 blocks hear the bell and turn on each other for 6 / 8 / 10s. Resonance +30. Cooldown 60s."], { power: true, needs: "arc_echo" }),
  S("arc_resonant", "arcana", 3, "Resonant Soul", 2, 3, ["While Resonance is 70 or more, powers are 25% / 50% stronger."], { needs: "arc_quiet" }),
  S("arc_hollowborn", "arcana", 4, "Choirborn", 1, 6, ["Powers cost 25% less Resonance and cool down 30% faster. At 100 Resonance you enter a Crescendo: 10s of free casting, then you crash."], { needs: "arc_step" }),
  S("arc_hollowstep", "arcana", 4, "Veilstep", 1, 5, ["Power. Step out of the world and into the Hollow, wherever you stand. Cast it again there to step back to where you left. Resonance +40. Cooldown 60s."], { power: true, needs: "arc_step" }),
  S("arc_warden", "arcana", 5, "The Last Art", 1, 8, ["The peak of the Marked. The Hollow answers to you now: you may claim its throne and rule it as its Warden.", "Asks three things of you: a Sovereign's Throne, which only a settlement that has won the Grand Siege can raise; Renown 30; and Veilstep."], { needs: "arc_hollowstep" }),
  S("arc_crownless", "arcana", 5, "Crownless", 1, 8, ["Ember Bolt arcs to 2 more enemies near the first."], { needs: "arc_hollowborn" }),

  // ---------------- WING (Dragon Rider, Emberwaste) ----------------
  S("wing_heat", "wing", 1, "Emberblood", 1, 1, ["Fire and lava cannot hurt you."]),
  S("wing_bond", "wing", 1, "Saddle Bond", 3, 1, ["The dragon you ride mends as it flies: Regeneration I / II / III."]),
  S("wing_fall", "wing", 1, "Windcatch", 2, 1, ["You fall slowly instead of hard. Rank 2: you also jump higher on foot."]),
  S("wing_scale", "wing", 2, "Scale Guard", 3, 2, ["In the saddle you take less harm: Resistance I. Rank 2: your dragon too. Rank 3: Resistance II for you."], { needs: "wing_bond" }),
  S("wing_eye", "wing", 2, "Hawk Eye", 1, 2, ["Night Vision whenever you are mounted."]),
  S("wing_dive", "wing", 3, "Stoop", 3, 3, ["Hits you land from the saddle deal +3 / +5 / +8 damage."], { needs: "wing_scale" }),
  S("wing_brand", "wing", 3, "Firebrand", 2, 3, ["Your melee hits set enemies alight for 3 / 6 seconds."], { needs: "wing_heat" }),
  S("wing_heart", "wing", 4, "Dragonheart", 1, 6, ["+4 hearts of health. In the saddle, you and your dragon both have Strength I."], { needs: "wing_dive" }),
  S("wing_wyrmfire", "wing", 5, "Wyrmfire", 1, 8, ["Each kill from the saddle heals you and your dragon and gives you both a burst of speed."], { needs: "wing_heart" }),

  // ---------------- FORGE (Forgemaster, Frostmarch) ----------------
  S("forge_arm", "forge", 1, "Hammer Arm", 3, 1, ["Haste I / II / III while you hold a pickaxe, axe or hammer."]),
  S("forge_temper", "forge", 1, "A Second Skin", 3, 1, ["Out of combat, your armour settles: 2 / 4 / 6 extra hearts of Absorption, renewed every 30 seconds."]),
  S("forge_cold", "forge", 1, "Frostborn", 1, 1, ["Slowness and Mining Fatigue do not hold you."]),
  S("forge_edge", "forge", 2, "Keen Edge", 3, 2, ["Your sword, axe and hammer hits deal +1 / +2 / +3 damage."], { needs: "forge_arm" }),
  S("forge_mend", "forge", 2, "Field Repair", 2, 2, ["The tool or weapon in your hand mends itself, slowly / steadily."], { needs: "forge_temper" }),
  S("forge_stance", "forge", 3, "Anvil Stance", 2, 3, ["While sneaking you are hard to hurt: Resistance I / II."], { needs: "forge_edge" }),
  S("forge_guardsteel", "forge", 3, "Guardsteel", 2, 3, ["Guards within 16 blocks carry your steel: Resistance I. Rank 2: Strength I too."], { needs: "forge_mend" }),
  S("forge_master", "forge", 4, "Masterwork", 1, 6, ["One hit in five strikes true: +6 damage, and the enemy staggers."], { needs: "forge_edge" }),
  S("forge_deep", "forge", 5, "Deepforge", 1, 8, ["Haste II and Resistance I, always. The fire below answers to you."], { needs: "forge_master" }),

  // ---------------- HELM (Captain, Saltreach) ----------------
  S("helm_legs", "helm", 1, "Sea Legs", 3, 1, ["Breathe underwater. In water or rain: Speed I at rank 2, Speed II at rank 3."]),
  S("helm_voice", "helm", 1, "Captain's Voice", 3, 1, ["Guards within 12 / 16 / 24 blocks move at your word: Speed I."]),
  S("helm_purse", "helm", 1, "Harbor Purse", 3, 1, ["+8 / +16 / +24 Regals from every siege you hold."]),
  S("helm_volley", "helm", 2, "Volley", 3, 2, ["Your arrows and bolts deal +2 / +3 / +4 damage."], { needs: "helm_voice" }),
  S("helm_crew", "helm", 2, "Press Gang", 2, 2, ["+1 / +2 guards on your walls."], { needs: "helm_purse" }),
  S("helm_boarding", "helm", 3, "Boarding Action", 2, 3, ["Your first hit on an unhurt enemy deals +4 / +7 damage."], { needs: "helm_volley" }),
  S("helm_storm", "helm", 3, "Stormwise", 1, 3, ["In rain or thunder: Strength I and Regeneration I."], { needs: "helm_legs" }),
  S("helm_fleet", "helm", 4, "Fleet Command", 1, 6, ["During a siege, guards within 24 blocks get Strength I and Regeneration I."], { needs: "helm_volley" }),
  S("helm_tide", "helm", 5, "Tide-Turner", 1, 8, ["Once every 5 minutes, when you drop below 3 hearts, every guard within 24 blocks is healed and you gain a wall of Absorption."], { needs: "helm_fleet" }),

  // ---------------- HEX (Witch, Blackfen) ----------------
  S("hex_blood", "hex", 1, "Fen Blood", 2, 1, ["Poison does not take in you. Rank 2: nor does Wither."]),
  S("hex_eyes", "hex", 1, "Cat's Eyes", 1, 1, ["Night Vision, always."]),
  S("hex_touch", "hex", 1, "Witch's Touch", 3, 1, ["Your hits poison for 2 / 3 / 4 seconds."]),
  S("hex_rot", "hex", 2, "Rot", 2, 2, ["Hitting something already poisoned withers it for 3 / 5 seconds."], { needs: "hex_touch" }),
  S("hex_leech", "hex", 2, "Leech", 3, 2, ["Each kill gives back 1 / 2 / 3 health."], { needs: "hex_blood" }),
  S("hex_eye", "hex", 3, "Evil Eye", 2, 3, ["Whatever strikes you is weakened for 4 seconds. Rank 2: and slowed."], { needs: "hex_touch" }),
  S("hex_slip", "hex", 3, "Slip Away", 2, 3, ["When you are hit there is a 15% / 25% chance you vanish for 3 seconds and run."], { needs: "hex_eyes" }),
  S("hex_contagion", "hex", 4, "Contagion", 1, 6, ["The poison you deal spreads to enemies within 4 blocks of your target."], { needs: "hex_rot" }),
  S("hex_bane", "hex", 5, "Baneful", 1, 8, ["What you kill bursts: 6 damage to enemies within 4 blocks."], { needs: "hex_contagion" }),
];

export const SKILL = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

// Roles (stored as hero.path). Everyone starts as "none", a plain human. A role is earned in the story
// and opens one branch of its own. To add a role: an entry here, a branch in BRANCHES (who: "<role id>"),
// its skills, a rank ladder in RANKS, and an effects file like knight.js or marked.js.
export const ROLES = {
  knight: { name: "Oathsworn", noun: "Knights", branch: "blade" },
  marked: { name: "Marked", noun: "The Marked", branch: "arcana" },
  // The regional roles. region = the hall style whose people teach it.
  rider: { name: "Dragon Rider", noun: "Dragon Riders", branch: "wing", region: "emberwaste", oath: "The dragons of the Emberwaste choose few. You climb into the saddle knowing one of you may not come down.", color: "§c" },
  forgemaster: { name: "Forgemaster", noun: "Forgemasters", branch: "forge", region: "frostmarch", oath: "The Deepforge of the Frostmarch has not gone cold in four hundred years. You take the hammer, and the cold stops mattering.", color: "§b" },
  captain: { name: "Captain", noun: "Captains", branch: "helm", region: "saltreach", oath: "Saltreach gives its captains a crew and a debt. You sign the articles, and people start doing what you say.", color: "§3" },
  witch: { name: "Witch", noun: "Witches", branch: "hex", region: "blackfen", oath: "The Blackfen teaches by taking. You drink what the old woman hands you and do not ask what was in it.", color: "§2" },
};

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
    { at: 15, name: "Veilwalker" },
    { at: 26, name: "Sorcerer" }, // the top rank: needed to rule the Hollow
  ],
  rider: [{ at: 0, name: "Fledgling" }, { at: 3, name: "Rider" }, { at: 8, name: "Wing-Sworn" }, { at: 15, name: "Drake-Captain" }, { at: 26, name: "Dragonlord" }],
  forgemaster: [{ at: 0, name: "Apprentice" }, { at: 3, name: "Journeyman" }, { at: 8, name: "Smith" }, { at: 15, name: "Master Smith" }, { at: 26, name: "Forgemaster" }],
  captain: [{ at: 0, name: "Deckhand" }, { at: 3, name: "Bosun" }, { at: 8, name: "Mate" }, { at: 15, name: "Captain" }, { at: 26, name: "Admiral" }],
  witch: [{ at: 0, name: "Bog-Touched" }, { at: 3, name: "Herbwife" }, { at: 8, name: "Witch" }, { at: 15, name: "Crone" }, { at: 26, name: "Fen Mother" }],
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
  const spent = spentIn(skills, ROLES[path].branch);
  return [...list].reverse().find((r) => spent >= r.at);
}

// Why a skill can't be learned right now, or undefined if it can.
// hero = { path, level, points, skills }, hallLevel = 0-5 of the tree being used.
// Where powers come from (filled in by the lore feature): gated = { skillId: hint shown until the player finds the origin },
// lines = { skillId: one line of lore shown in the Tree }.
export const POWER_ORIGINS = { gated: {}, lines: {} };

export function blockedReason(skill, hero, hallLevel) {
  const have = hero.skills[skill.id] ?? 0;
  if (have >= skill.max) return "Mastered";
  if (!canBranch(skill.branch, hero.path)) return `${ROLES[BRANCHES[skill.branch].who]?.noun ?? "Another role"} only`;
  const ring = RINGS[skill.ring];
  if (hallLevel < ring.hall) return `Needs a ${HALL_NAMES[ring.hall]}`;
  if (hero.level < ring.level && !(hero.victor && skill.branch === "arcana")) return `Needs Renown ${ring.level}`; // the Hollow's victor skips the Renown climb
  if (skill.needs && !(hero.skills[skill.needs] > 0)) return `Needs ${SKILL[skill.needs].name}`;
  if (POWER_ORIGINS.gated[skill.id] && !have && !hero.origins?.[skill.id]) return POWER_ORIGINS.gated[skill.id]; // its origin must be found in the world first
  if (hero.points < skill.cost) return `Needs ${skill.cost} point${skill.cost === 1 ? "" : "s"}`;
  return undefined;
}

export const HALL_NAMES = ["no hall", "Longhouse", "Stone Hall", "Keep", "Fortress", "Sovereign's Throne"];

// Histories of the regional roles, filled by the lore module through the "roleLore" event:
// { rider: { region, before, why, saying }, ... }. Empty until lore answers.
export const ROLE_LORE = {};
