// Hands the lore thread's words to the features that run the NPC "players" of a single-player
// world: the NPC ruler of the Hollow, the Rumor Board, and the Rival Lords.
//   returnedCases    { cases, tells }     the hidden Returned (data/returned.js); also on "returnedCasesWanted"
//   rivalLordVoices  { lords, tempers }   emitted once at load, and again whenever someone emits "rivalLordsWanted"

import { system } from "@minecraft/server";
import { emit, on } from "../siege/api.js";
import { setRegentVoice } from "../undertow/regent.js";
import { RIVAL_LORDS, LORD_TEMPERS, REGENT_VOICE, RUMOR_PARTS } from "./data/lords.js";
import { CASES, TELLS } from "./data/returned.js";

setRegentVoice(REGENT_VOICE);
const sendLords = () => emit("rivalLordVoices", { lords: RIVAL_LORDS, tempers: LORD_TEMPERS });
on("rivalLordsWanted", sendLords);
// the hidden Returned: the truth of each case and the tells, for the feature that spawns the villagers
const sendCases = () => emit("returnedCases", { cases: CASES, tells: TELLS });
on("returnedCasesWanted", sendCases);
// one tick later, so every feature has loaded and is listening
system.run(() => {
  emit("rumorParts", RUMOR_PARTS);
  sendLords();
  sendCases();
});
