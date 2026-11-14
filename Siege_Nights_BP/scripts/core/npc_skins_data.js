// Every NPC's own skin (Mateo 2026-11-13: "make sure everyone has a skin").
//
// Bedrock's built-in NPC entity (minecraft:npc) picks its look with skinIndex. Our packs replace that entity's
// skins with our own: the place of a key in this list is its skinIndex, and the picture is
// Siege_Nights_RP/textures/entity/siege/npc_skins/<key>.png, painted by studio/art/build_npc_skins.py, which
// also writes the client entity, render controller and the BP skin list from this file.
//
// ONLY ADD TO THE END. NPCs already standing in a world keep their number, so moving a key changes who they are.
// Spawn an NPC, then call dressNpc(entity, key) from core/npc_skins.js; tools/check.mjs fails a script that spawns
// minecraft:npc without it, or sets skinIndex by hand.
export const NPC_SKINS = [
  "commoner", // anyone else (hand-placed NPCs keep whatever the builder picked)
  "mason",
  // story people (lore/data/dialogue.js): lore_<id>
  "lore_wren", "lore_aldous", "lore_mag", "lore_elias", "lore_sage", "lore_cael", "lore_sigrun",
  "lore_isolde", "lore_nessa", "lore_jorund", "lore_tilly", "lore_hesper", "lore_corvin", "lore_kesh", "lore_ulla",
  "lore_ottilie", "lore_nell", "lore_carter",
  // settlers who move into a player's or a lord's town
  "settler_0", "settler_1", "settler_2", "settler_3", "settler_4", "settler_5", "settler_6", "settler_7",
  // market fair traders, by the region they come from (settle/events.js)
  "fair_vale", "fair_frostmarch", "fair_saltreach", "fair_emberwaste", "fair_blackfen",
  // the travelling players (settle/events_data.js TROUPE)
  "mummer_0", "mummer_1", "mummer_2",
  // wonder keepers (wonders/data.js): keeper_<wonder id>
  "keeper_great_lighthouse", "keeper_high_watch", "keeper_rimeforge_hall", "keeper_sun_gate",
  "keeper_lantern_spire", "keeper_great_horse_fair",
  // lost travellers waiting at the Lantern Spire (wonders/data.js SPIRE.standOut)
  "traveller_0", "traveller_1", "traveller_2", "traveller_3",
  // Millbrook's clock keepers (unlocks/keepers.js KEEPERS)
  "clock_0", "clock_1", "clock_2", "clock_3", "clock_4",
  // Old Sigga at the hunting lodge (unlocks/huntsman.js)
  "warden_sigga",
  // the Mirelight villagers of the Mother puzzle (unlocks/puzzles.js VILLAGERS)
  "mire_0", "mire_1", "mire_2", "mire_3", "mire_4",
  // rival lords: lord_<style>_<role>
  "lord_vale_knight", "lord_vale_marked", "lord_frostmarch_knight", "lord_frostmarch_marked",
  "lord_saltreach_knight", "lord_saltreach_marked", "lord_emberwaste_knight", "lord_emberwaste_marked",
  "lord_blackfen_knight", "lord_blackfen_marked",
  // guest-night visitors from below (lore/data/truce.js GUESTS; the Even Market keeper is Seneth, guest_11)
  "guest_0", "guest_1", "guest_2", "guest_3", "guest_4", "guest_5",
  "guest_6", "guest_7", "guest_8", "guest_9", "guest_10", "guest_11",
  // the Hollow's mining villages (hollowfolk/index.js)
  "hollow_foreman", "hollow_miner_0", "hollow_miner_1", "hollow_miner_2",
  // envoys of the Hollow's great houses after the fall (after/data/houses.js): envoy_<house id>
  "envoy_bell", "envoy_salt", "envoy_lamp", "envoy_root", "envoy_tide",
  // Act 1's guide at every hall's hearth (newplayer/act1.js)
  "lore_elspeth",
  // regional looks (Mateo 2026-11-14: story NPCs met in every region dress for it, signature kept): <key>__<region>;
  // the Vale wears the plain key. core/npc_skins.js regionalKey picks them by where the NPC stands.
  "lore_elspeth__frostmarch", "lore_elspeth__saltreach", "lore_elspeth__emberwaste", "lore_elspeth__blackfen",
  "mason__frostmarch", "mason__saltreach", "mason__emberwaste", "mason__blackfen",
  // a Rival Lord's herald at your gate (Act 2), in his lord's region colours: herald_<region>
  "herald_vale", "herald_frostmarch", "herald_saltreach", "herald_emberwaste", "herald_blackfen",
];
