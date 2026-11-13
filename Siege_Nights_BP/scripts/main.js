// The Hollow Crown (which began as Siege Nights): entry point.
// Siege Nights itself lives in siege/ (numbers to tweak: siege/settings.js). How to add a feature: MODULES.md.

// Core (no gameplay)
import "./core/selftest.js";
import "./core/clickable.js";
import "./core/gamerules.js";
import "./core/noraids.js";
import "./core/firstjoin.js";
import "./core/storyteller.js";

// Siege Nights
import "./siege/index.js";

// Test tool: /scriptevent siege:showcase builds a settlement with everything in it
import "./showcase/index.js";

// Features: one line per feature folder. Only add a line once that folder's index.js exists and
// `node tools/check.mjs` says ALL OK, because a missing or broken file stops the whole pack.
// (none yet)
import "./undertow/index.js";
import "./plots/index.js";
import "./townhall/index.js";
import "./horses/index.js";
import "./rails/index.js";
import "./trains/index.js";
import "./trains/station_sites.js";
import "./trains/route_game.js";
import "./trains/line_trains.js";
import "./bestiary/index.js";
import "./lore/index.js";
import "./crown/index.js";
import "./dragons/index.js";
import "./settle/index.js";
import "./rivals/index.js";
import "./hollowfolk/index.js";
import "./looks/index.js";
import "./economy/index.js";
import "./reach/index.js";
import "./sound/index.js";
import "./minimap/index.js";
import "./guide/index.js";
import "./roletrials/index.js";
import "./landmarks/index.js";
import "./after/index.js";
import "./opening/index.js";
import "./unlocks/index.js";
import "./labels/index.js";
import "./guardposts/index.js";
import "./forestry/index.js";
import "./workings/index.js";
import "./ironworks/index.js";
import "./vault/index.js";
import "./warwrit/index.js";
import "./army/index.js";
import "./creative/index.js";
import "./dispatch/index.js";
import "./letters/index.js";
import "./news/index.js";
import "./trade/index.js";
import "./townsfolk/index.js";
import "./weather/index.js";
import "./graves/index.js";

// Start the shared loop last, once every file has registered its work
import { startLoop } from "./core/loop.js";
import { prepareTick } from "./siege/state.js";
startLoop(prepareTick);
