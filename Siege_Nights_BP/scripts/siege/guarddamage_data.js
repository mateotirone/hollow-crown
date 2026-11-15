// How hard each creature hits a guard (Mateo 2026-11-14: "We need to have custom damage parameters for each mob").
//
// Every creature that fights guards has its own line here: `base` is its ordinary blow (the "minecraft:attack" damage
// in its entity file, or the vanilla value), and `guard` is what that same blow does to one of your guards or soldiers.
// Whatever the creature does to a guard is scaled by guard / base, so difficulty, guard armour and its special attacks
// (a wyrm's eruption, a hag's spit, a skeleton's arrow) all scale the same way. Players still take the full blow.
//
// How the numbers were picked (the thread's picks, change any line freely):
//   - small wild creatures (scarabs, crows, toads, wolves) do about half: trained soldiers shrug them off
//   - big wild creatures and Hollow things that roam do about two thirds
//   - raiders and Hollow soldiers do most of their blow, their heavies (ogre, brute, gatebreaker) nearly all of it
//   - champions, bosses and boss adds hit guards as hard as they hit you
//   - vanilla raiders hit very hard in vanilla (a Vindicator's axe is 13), so they're brought into line with ours
// tools/check.mjs fails if a creature that targets guards has no line, or if a base no longer matches its entity file.
// Plain data, no imports: check.mjs reads it directly.

export const GUARD_DAMAGE = {
  // ----- wild creatures -----
  "siege:ash_scarab": { base: 2, guard: 1 },
  "siege:hollow_crow": { base: 2, guard: 1 },
  "siege:mire_toad": { base: 2, guard: 1 },
  "siege:rimewolf": { base: 3, guard: 1.5 },
  "siege:gloamwing": { base: 3, guard: 2 },
  "siege:bog_hag": { base: 3, guard: 2 },
  "siege:echo_hound": { base: 4, guard: 3 },
  "siege:tolling_shade": { base: 3, guard: 2 },
  "siege:brine_lurker": { base: 4, guard: 3 },
  "siege:barrow_wight": { base: 4, guard: 3 },
  "siege:lost_villager": { base: 4, guard: 3 },
  "siege:changeling": { base: 4, guard: 3 },
  "siege:dune_wyrm": { base: 6, guard: 4 },
  "siege:mirror_knight": { base: 5, guard: 3.5 },
  "siege:stone_vigil": { base: 6, guard: 4 },
  "siege:wrongling": { base: 7, guard: 5 },

  // ----- raiders: the Choir, the Grey Host, Hollow soldiers -----
  "siege:bell_ringer": { base: 2, guard: 2 },
  "siege:crow_mage": { base: 3, guard: 3 },
  "siege:grey_bowman": { base: 3, guard: 3 },
  "siege:torchbearer": { base: 4, guard: 3 },
  "siege:shardcaster": { base: 4, guard: 3 },
  "siege:grey_bellcutter": { base: 5, guard: 4 },
  "siege:hollow_footman": { base: 5, guard: 4 },
  "siege:grey_spearman": { base: 6, guard: 5 },
  "siege:grey_axeman": { base: 8, guard: 6 },
  "siege:veinsworn": { base: 8, guard: 6 },
  "siege:grey_serjeant": { base: 9, guard: 7 },
  "siege:hollow_warlord": { base: 9, guard: 8 },
  "siege:shieldwall_brute": { base: 9, guard: 8 },
  "siege:siege_ogre": { base: 11, guard: 10 },
  "siege:gatebreaker": { base: 12, guard: 10 },

  // ----- champions (rival lords' household) -----
  "siege:champion_retainer": { base: 5, guard: 5 },
  "siege:champion_sorcerer": { base: 5, guard: 5 },
  "siege:champion_knight": { base: 7, guard: 7 },
  "siege:champion_lord": { base: 8, guard: 8 },

  // ----- boss adds -----
  "siege:mother_echo": { base: 4, guard: 3 },
  "siege:reeve_cog": { base: 6, guard: 5 },
  "siege:oswin_reflection": { base: 9, guard: 9 },

  // ----- bosses: full blow -----
  "siege:pale_huntsman": { base: 8, guard: 8 },
  "siege:drowned_bride": { base: 8, guard: 8 },
  "siege:clockwork_reeve": { base: 9, guard: 9 },
  "siege:mother_of_changelings": { base: 9, guard: 9 },
  "siege:pretender_seer": { base: 9, guard: 9 },
  "siege:bell_wife": { base: 10, guard: 10 },
  "siege:pretender_blade": { base: 11, guard: 11 },
  "siege:ash_seneschal": { base: 12, guard: 12 },
  "siege:warlord_king": { base: 12, guard: 12 },
  "siege:pretender_brute": { base: 13, guard: 13 },
  "siege:oswin_the_last": { base: 13, guard: 13 },

  // ----- vanilla raiders and night monsters used in the early sieges (Normal difficulty values) -----
  "minecraft:zombie": { base: 3, guard: 2 },
  "minecraft:husk": { base: 3, guard: 2 },
  "minecraft:skeleton": { base: 3, guard: 2 },
  "minecraft:stray": { base: 3, guard: 2 },
  "minecraft:pillager": { base: 4, guard: 3 },
  "minecraft:witch": { base: 6, guard: 4 },
  "minecraft:evocation_illager": { base: 6, guard: 4 },
  "minecraft:vex": { base: 9, guard: 4 },
  "minecraft:ravager": { base: 12, guard: 9 },
  "minecraft:vindicator": { base: 13, guard: 7 },
};

// Vanilla creatures have no entity file in our pack, so check.mjs can't compare their base
export const VANILLA_BASES = Object.keys(GUARD_DAMAGE).filter((id) => id.startsWith("minecraft:"));
