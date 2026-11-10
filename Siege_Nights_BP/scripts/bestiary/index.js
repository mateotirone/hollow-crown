// The Hollow Crown bestiary: the new mobs and the boss fights.
//
//   data.js      GENERATED names and lore (from studio/bestiary/roster.py and items.py)
//   util.js      small helpers
//   bossCore.js  the boss framework: phases, warned attacks, arenas, loot (the Undertow's Choir uses it too)
//   bosses.js    the seven fights
//   mobs.js      what each mob does beyond walking and biting
//   relics.js    the named boss loot and the boss keys
//   spawns.js    Choir raiders in sieges, Hollow things at night and in the Undertow
//   showcase.js  our exhibits in the /scriptevent siege:showcase test world
//
// Other features hear from us by script event:
//   siege:boss_defeated       {"boss","x","y","z","dimension","players":[ids]}
//   siege:mob_killed          {"mob","x","y","z","dimension","killer"?}   (six lore-bearing mobs only)
//   siege:award_skill_points  {"player","points","renown"?,"reason"}
// and can start a fight with:  /scriptevent siege:bestiary_summon <boss id> [x y z]
// Boss ids: reeve, huntsman, bride, seneschal, mother, warlord_king, oswin.

import "./bossCore.js";
import "./bosses.js";
import "./mobs.js";
import "./relics.js";
import "./spawns.js";
import "./showcase.js";
