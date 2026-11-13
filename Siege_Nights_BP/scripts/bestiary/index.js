// The Hollow Crown bestiary: the new mobs and the boss fights.
//
//   data.js      GENERATED names and lore (from studio/bestiary/roster.py and items.py)
//   util.js      small helpers
//   bossCore.js  the boss framework: phases, warned attacks, arenas, loot (the Undertow's Choir uses it too)
//   bosses.js    the seven fights
//   mobs.js      what each mob does beyond walking and biting
//   relics.js    the named boss loot and the boss keys
//   choirsteel.js  the Choirsteel gear set: what the armour, Blade and Pick do (items from studio/bestiary/choirsteel.py)
//   spawns.js    Choir raiders in sieges, Hollow things at night and in the Undertow
//   seeps.js     Seep sites: random Hollow incursions in the overworld that widen until someone closes them
//   ravens.js    the omen ravens: perchRavens / rowSpots / clearRavens for lore/ravens.js to call
//   pretenders.js  generated claimants who rise in the Hollow after Morvane falls (events: siege:pretender_risen / _marching / _fallen)
//   sheltered.js nothing hostile spawns inside a settlement's walls or a town (shelteredAt); sieges still come from outside
//   gentle.js    the gentle start: a new player's first days are free of our wild monsters, then they come in step by step
//   gloam.js     Gloamwings: flyers that build up the longer a visitor stays in the Hollow
//   champions.js NPC stand-ins for players that fight like one (spawnChampion, setStance)
//   anim.js      boss moves: wind-up pose while the warning is up, strike when the hit lands, rage at each phase
//   moves.js     GENERATED list of boss move animations (from studio/bestiary/anims.py, which makes every mob's animations)
//   bodies.js    the dead fall and lie on the field until the fight is over, then sink away
//   showcase.js  our exhibits in the /scriptevent siege:showcase test world
//   stagger.js   bosses and heavy creatures rock back a little when hit (everything else gets vanilla knockback)
//
// Other features hear from us by script event:
//   siege:boss_defeated       {"boss","x","y","z","dimension","players":[ids],"temper"?}
//   siege:mob_killed          {"mob","x","y","z","dimension","killer"?}   (six lore-bearing mobs only)
//   siege:award_skill_points  {"player","points","renown"?,"reason"}
//   siege:seep_opened / siege:seep_closed  {"x","y","z","dimension","level","players"?:[ids]}
//   siege:champion_defeated   {"id","name","role","tier","tags","x","y","z","dimension","players"}
// and can start a fight with:  /scriptevent siege:bestiary_summon <boss id> [x y z]
// Boss ids: reeve, huntsman, bride, seneschal, mother, warlord_king, morvane (seven stages: see morvane.js).

import "./bossCore.js";
import "./bosses.js";
import "./reveal.js";
import "./morvane.js";
import "./returned.js";
import "./mobs.js";
import "./relics.js";
import "./choirsteel.js";
import "./spawns.js";
import "./sheltered.js";
import "./veterans.js";
import "./seeps.js";
import "./ravens.js";
import "./pretenders.js";
import "./gloam.js";
import "./gentle.js";
import "./champions.js";
import "./bodies.js";
import "./showcase.js";
import "./stagger.js";
