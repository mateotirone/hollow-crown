// Story Mode and Settlement Mode, the pure rules (no Minecraft, so Node tests them). mode.js keeps each player's
// mode in the world and shows the choice.
//
// Mateo 2026-11-14: "my intention is that youre able to play 'Story Mode' or 'Settlement Mode' ... that doesnt
// include the story. just the civilization castle siege style game." "only on second play. starting out, its
// automatically in story mode." "yeah same guide system." Agreed reading (Mateo: "this is fine"): the choice opens
// once the story has been finished on this world or Realm (by this player or anyone), and is offered when a player
// chooses a plot in the welcome hall. Bedrock keeps nothing between worlds, so a fresh world is always Story Mode
// until a builder opens the choice (/scriptevent siege:mode unlock).
//
// Settlement Mode is the same game without the story: the same Old Elspeth at the hearth hands out every step, the
// same quest tracker shows it, the first three days and the first raid are the same, and after the raid she leads
// the settlement from Hamlet to Castle instead of sending you to Sister Wren. No Ember, no Sir Aldous, no story
// steps on the tracker, no voice on the wind, and a story step never holds back a charter.

export const STORY = "story";
export const SETTLEMENT = "settlement";
export const MODES = [STORY, SETTLEMENT];
export const MODE_NAMES = { [STORY]: "Story Mode", [SETTLEMENT]: "Settlement Mode" };
export const MODE_BLURB = {
  [STORY]: "The whole tale: Old Elspeth, Sister Wren, the Ember and everything after it, with your settlement growing alongside.",
  [SETTLEMENT]: "No story. Build your settlement from Hamlet to Castle and hold it through the siege nights. Old Elspeth still guides every step.",
};

// What is saved on a player: anything that isn't Settlement Mode reads as Story Mode (every world before this)
export const modeFrom = (saved) => (saved === SETTLEMENT ? SETTLEMENT : STORY);
export const isStory = (mode) => modeFrom(mode) === STORY;

// Is the choice offered to this player? ownDone: they finished the story on this world. worldDone: someone has
// (or a builder opened the choice). A first play never sees it.
export const choiceOpen = ({ ownDone, worldDone } = {}) => !!(ownDone || worldDone);

// The story counts as finished once Morvane has fallen (lore/reveal.js sets the flag)
export const FINISHED_FLAG = "morvane_fallen";

// Old Elspeth's guide flags (act1_rules.js F, and the Settlement Mode growth talks). A player who starts a new
// settlement in Settlement Mode has these cleared, so she walks them through it from the first meeting again.
export const GUIDE_FLAG = /^elspeth_/;
export const guideFlagsToClear = (flags = []) => flags.filter((f) => GUIDE_FLAG.test(f));

// A step that belongs to the story (a quest step id "actN:..." from the stage tables, or a story flag) only counts
// toward a charter for a player in Story Mode. Settlement Mode never waits on one.
export const storyStepCounts = (mode) => isStory(mode);
