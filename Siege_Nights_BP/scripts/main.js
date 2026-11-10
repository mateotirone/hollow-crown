// Siege Nights + The Hollow Crown: entry point.
// Siege Nights itself lives in siege/ (numbers to tweak: siege/settings.js). How to add a feature: MODULES.md.

// Core (no gameplay)
import "./core/selftest.js";

// Siege Nights
import "./siege/index.js";

// Features: one line per feature folder. Only add a line once that folder's index.js exists and
// `node tools/check.mjs` says ALL OK, because a missing or broken file stops the whole pack.
// (none yet)
import "./undertow/index.js";
import "./plots/index.js";

// Start the shared loop last, once every file has registered its work
import { startLoop } from "./core/loop.js";
import { prepareTick } from "./siege/state.js";
startLoop(prepareTick);
