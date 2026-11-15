// The soundtrack's rules, pure so the self-tests can run them. What plays is decided here; index.js only plays it.
//
// Mateo, 2026-11-13: a soundtrack per region, real songs with a tune you remember, catchy but never repetitive or
// annoying. So each region has a small pool of pieces built on its own theme, picked at random (never the same one
// twice running). A boss fight or a siege night takes over with its own piece, looped, and stops the moment it is over.
//
// Mateo, 2026-11-13 playtest: the music must keep going. The first cut left two to five minutes of silence after each
// piece (and Minecraft's own music is switched off), so after the main theme it sounded like the music had stopped
// for good. Now there is only a short breath between pieces, and walking into another region (or the Hollow) moves
// you onto that region's pool within a few seconds instead of waiting out the old piece.
//
// The recordings are in Siege_Nights_RP/sounds/siege/music (tools/install_music.py). A piece that is not installed
// is simply skipped, so the soundtrack can grow one piece at a time.

export const REGION_POOLS = {
  "Aldmere Vale": { day: ["vale_theme", "vale_day", "vale_wander"], night: ["vale_night", "vale_wander", "vale_theme"] },
  Frostmarch: { day: ["frostmarch_theme", "frostmarch_day", "frostmarch_wander"], night: ["frostmarch_night", "frostmarch_wander", "frostmarch_theme"] },
  Saltreach: { day: ["saltreach_theme", "saltreach_day", "saltreach_wander"], night: ["saltreach_night", "saltreach_wander", "saltreach_theme"] },
  Emberwaste: { day: ["emberwaste_theme", "emberwaste_day", "emberwaste_wander"], night: ["emberwaste_night", "emberwaste_wander", "emberwaste_theme"] },
  Blackfen: { day: ["blackfen_theme", "blackfen_day", "blackfen_wander"], night: ["blackfen_night", "blackfen_wander", "blackfen_theme"] },
  "The Western Sea": { day: ["saltreach_wander", "saltreach_theme"], night: ["saltreach_night", "saltreach_wander"] },
};
export const HOLLOW_POOL = ["hollow_theme", "hollow_deep", "hollow_village"];
export const HOME_POOL = REGION_POOLS["Aldmere Vale"]; // somewhere the map has no region for (the far edges)

// A boss's own theme while you are in its fight (bossCore def ids). Pretenders and anything else use the siege piece.
export const FIGHT_TRACKS = {
  reeve: "boss_reeve", huntsman: "boss_huntsman", bride: "boss_bride", seneschal: "boss_seneschal",
  mother: "boss_mother", warlord_king: "boss_warlord", choir: "boss_choir", morvane: "boss_morvane",
};
export const SIEGE_TRACK = "siege_night";
export const MAIN_THEME = "main_theme"; // heard once, the first time a player joins

export const MUSIC = {
  checkTicks: 40,            // look at each player's situation every 2 seconds
  firstGap: [3, 8],          // seconds of quiet before the first piece after joining
  gap: [8, 20],              // a short breath between pieces, never dead silence (Mateo 2026-11-13: keep it looping)
  afterFight: [5, 10],       // quiet after a fight or a siege before the region's music comes back
  regionSettle: 8,           // seconds you must stay in a new region before its music takes over (no flicker at borders)
  switchGap: [2, 4],         // the beat of quiet between leaving one region's piece and starting the next region's
  afterDimension: [2, 4],    // changing dimension cuts every sound, so the music starts again this soon after
  overrideGrace: 12,         // seconds a fight or siege piece keeps playing after you drop out of it, so it never restarts from the top
};

export const soundId = (track) => `siege.music.${track}`;
export const isNight = (timeOfDay) => timeOfDay >= 13000 && timeOfDay < 23000;

/** The pool a player hears where they stand: a list of track names (installed or not). */
export function poolFor({ hollow, region, timeOfDay }) {
  if (hollow) return HOLLOW_POOL;
  const pool = REGION_POOLS[region] ?? HOME_POOL;
  return isNight(timeOfDay) ? pool.night : pool.day;
}

/** Which pool a player is in, ignoring day and night: a change of this means they walked somewhere new. */
export function poolKey({ hollow, region }) {
  if (hollow) return "hollow";
  return REGION_POOLS[region] ? region : "home";
}

/** What must play right now regardless of the pool: a fight or a siege (looped), else undefined. */
export function overrideFor({ fightBoss, siege, hollow }) {
  if (fightBoss) return FIGHT_TRACKS[fightBoss] ?? SIEGE_TRACK;
  if (siege && !hollow) return SIEGE_TRACK;
  return undefined;
}

/** A piece from the pool: installed, never the one heard last. undefined when nothing in the pool is installed. */
export function pickTrack(pool, last, installed, roll) {
  const have = pool.filter((t) => installed[soundId(t)]);
  if (!have.length) return undefined;
  const fresh = have.length > 1 ? have.filter((t) => t !== last) : have;
  return fresh[Math.floor(roll * fresh.length) % fresh.length];
}

/** A boss or siege piece keeps going while you were in it less than `grace` ticks ago. */
export const keepLoop = (sinceTicks, graceTicks) => sinceTicks < graceTicks;

export const between = ([lo, hi], roll) => lo + (hi - lo) * roll;
