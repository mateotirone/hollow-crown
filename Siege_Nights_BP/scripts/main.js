// The Hollow Crown (which began as Siege Nights): entry point.
// Siege Nights itself lives in siege/ (numbers to tweak: siege/settings.js). How to add a feature: MODULES.md.

// Core (no gameplay)
import "./core/selftest.js";

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
import "./bestiary/index.js";
import "./lore/index.js";
import "./crown/index.js";
import "./dragons/index.js";
import "./settle/index.js";
import "./rivals/index.js";

// Start the shared loop last, once every file has registered its work
import { startLoop } from "./core/loop.js";
import { prepareTick } from "./siege/state.js";
startLoop(prepareTick);
