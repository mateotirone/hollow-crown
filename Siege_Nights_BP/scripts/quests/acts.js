// The story's steps by act, for the stage table (settle/config.js STAGES): each building a settlement stage asks for
// names the step that sends the player to build it ("act1:barracks"). Mateo 2026-11-14: "the story (tutorial) takes
// you through this", and every step has a source (an NPC line, a book, a cutscene).
//
// When an act is written, add its step function here: (stepName) -> the tracker step, or undefined if there is no
// such step. From then on the self-tests fail for any building of that act whose step it doesn't have, and
// tools/check.mjs stops listing those steps as still to write.

import { act1Step } from "../newplayer/act1_rules.js";

export const ACT_STEPS = {
  act1: (name) => act1Step(name, { flags: [], first: { days: 1 } }, {}),
};

// "act1:barracks" -> { act: "act1", name: "barracks" }
export function parseStep(ref) {
  const m = /^(act\d+):([a-z0-9_]+)$/.exec(ref ?? "");
  return m ? { act: m[1], name: m[2] } : undefined;
}
