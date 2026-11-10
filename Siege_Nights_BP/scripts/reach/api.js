// What other features may read from the Reach. Import from here only.
//
//   reachStage()      1-6 (see STAGES in rules.js); LONG = 5 is the never-ending siege, AFTER = 6 is after the source is rectified
//   reachValue()      0-100
//   stageInfo()       the stage's row: name, rhythm, waves, about ...
//   tonightKind()     "counted" | "stolen" | "probe" | "long" | "muster" | undefined (a quiet night)
//   isSiegeNight()    true if a full siege comes tonight (the hum, shut shops, worried villagers ...)
//   hollowShareNow()  0-1: how much of an ordinary siege army should be Hollow rather than men right now
//   addReach(n, why)  push the Reach up or down
//   rectify()         the source is dealt with: the Hollow's sieges stop for good
//
// Events (on(...) from siege/api.js): "reachStage" { stage, before, name }, "reachChanged" { reach, before, why },
// "firstGlimpse" { owners }: the first Hollow soldiers have just walked out of the dark at these settlements.
// Filter "hollowSoldier" (type, { role, glimpse }): answer with the entity the Reach should send as a Hollow soldier.

import { reachData, tonightKind, addReach, rectify } from "./index.js";
import { stage, isSiegeKind, hollowShare, LONG, AFTER, STAGES } from "./rules.js";

export { tonightKind, addReach, rectify, LONG, AFTER, STAGES };
export const reachStage = () => reachData().stage;
export const reachValue = () => reachData().reach;
export const stageInfo = () => stage(reachData().stage);
export const isSiegeNight = () => isSiegeKind(tonightKind());
export const hollowShareNow = () => (reachData().glimpsed ? hollowShare(reachData().stage) : 0);
