// The story facts Siege Nights owns, reported to the Storyteller (core/storyteller.js).
// Chapter 1 begins when a player raises a Keep Banner, chapter 2 when they first hold it through a siege.

import { provideFact } from "../core/storyteller.js";
import { state } from "./state.js";

provideFact("keepRaised", (player) => !!player && !!state?.keeps?.[player.id]);
provideFact("siegesWon", (player) => (player ? state?.keeps?.[player.id]?.wins ?? 0 : 0));
