// Act 2, "first win to Town" (story-and-gameplay pass, Mateo 2026-11-14). Part 1: Sir Aldous comes for the Ember and
// you keep it, he sends you to the Tree of Oaths in your hall, the choosing scene plays there, and the road you chose
// becomes your main step. The first night after the choice a far voice says one line. Plan: the "Story and Gameplay
// Plan" doc, "Act 2, step by step"; LORE-BIBLE.md "Act 2".
//
// Same rules as Act 1: every step comes from someone (Aldous, Elspeth, or your own thought), the minimap pins where
// to go, and a light pillar stands over story places.
//
// Pure (no Minecraft): act2Stage(f) says where a player is, act2Step(stage, f, places) is the tracker's line for it.
// newplayer/act2.js gathers f and makes the moments happen; quests/rules.js shows the step as the main step.

export const ALDOUS_TAG = "siege_lore_npc_aldous";

// Flags (lore progress)
export const F2 = {
  aldous: "aldous_met", // Act 1's last step: you have spoken to him
  tree: "aldous_tree", // he sent you to the Tree
  wait: "ember_wait", // "Not yet" at the Tree: no road for now
  voice: "act2_voice", // the voice has spoken
  cael: "cael_met", // the Knight's road ends with Brother Cael at the chapterhouse
  mag: "mag_met", // the Marked road ends with Old Mag in Mirelight
};

// Is Act 2 this player's story right now? After Sir Aldous, before any boss has fallen (old worlds that are further
// on keep the story they were on).
export function inAct2(f) {
  if (!f || f.morvane || !f.flags.includes(F2.aldous)) return false;
  return (f.down ?? 0) === 0;
}

// f = { flags, path ("none" | "knight" | "marked" | a regional role), ember (has the Ember in the pack), down (bosses
//       fallen), morvane }
export function act2Stage(f) {
  if (!inAct2(f)) return undefined;
  const has = (flag) => f.flags.includes(flag);
  if (f.path === "none" || !f.path) {
    if (has(F2.wait)) return undefined; // "Not yet": neither road calls; the later Act 2 steps go on
    if (!has(F2.tree)) return "talk_aldous";
    return f.ember ? "tree" : undefined;
  }
  if (f.path === "knight") return has(F2.cael) ? undefined : "chapterhouse";
  if (f.path === "marked" || f.path === "sorcerer") return has(F2.mag) ? undefined : "mag";
  return undefined; // a regional role was sworn instead
}

// Stages whose place is a story place: a light pillar stands over it
export const PILLAR2 = new Set(["chapterhouse", "mag"]);

// The tracker's line. p = places: { aldous, tree, chapterhouse, mag } each { x, z } (or undefined)
export function act2Step(stage, f = {}, p = {}) {
  const at = (name, spot) => (spot ? { name, x: spot.x, z: spot.z, dim: "minecraft:overworld" } : undefined);
  const step = (title, hint, target, extra = {}) => ({ id: `act2_${stage}`, title, hint, target, ...extra });
  switch (stage) {
    case "talk_aldous": return step("Talk to Sir Aldous about the Ember", "The knight wants the light that fell. Elspeth said: hear him out, but give him nothing you haven't read.",
      at("Sir Aldous", p.aldous), { npc: { tag: ALDOUS_TAG, name: "Sir Aldous" } });
    case "tree": return step("Choose at the Tree of Oaths", "Aldous said: not to him, then. Take it to the Tree in your hall and choose. Hold the Ember and touch the Tree.",
      at("The Tree of Oaths", p.tree));
    case "chapterhouse": return step("Ride to the Ashen Gate chapterhouse", "Aldous rode ahead with the box. Brother Cael keeps the Order's book there, and wants your name in it.",
      at("Ashen Gate chapterhouse", p.chapterhouse), { npc: { tag: "siege_lore_npc_cael", name: "Brother Cael" } });
    case "mag": return step("Find Old Mag in Mirelight", "Elspeth said: Old Mag, past the last lantern of Mirelight. She'll know what you've got in your hand.",
      at("Old Mag", p.mag), { npc: { tag: "siege_lore_npc_mag", name: "Old Mag" } });
    default: return undefined;
  }
}

// ---------- the choosing scene ----------

// The three panels (the mock-up Mateo approved): the button text, top to bottom, is the road, its line, its quote,
// then what you gain, what comes next and what it closes. The JSON UI screen (studio/build_tree_ui.py, CHOICE_FLAG)
// draws each as a tall panel with its picture.
export const CHOICE_FLAG = "§h§e";
export const ROADS = {
  knight: {
    art: "textures/ui/hc/choice/knight", color: "§6", name: "Give it up", sub: "Become a Squire of the Ashen Gate",
    quote: "\"I will hold the gate. I will keep the silence. I will not ask what lies beneath.\"",
    gain: "The Blade branch: steel, shield, horse and command. Your guards fight harder beside you. An Oath Banner.",
    next: "Ride to the Ashen Gate chapterhouse.", closes: "The Marked road, and the regional roles.",
    confirm: { title: "The Squire's Oath", text: "\"I will hold the gate. I will keep the silence. I will not ask what lies beneath.\"\n\nThe Ember is taken from you and sealed.", go: "I swear it", warn: true },
  },
  marked: {
    art: "textures/ui/hc/choice/marked", color: "§d", name: "Close your hand", sub: "Become Marked",
    quote: "It is not warm. It is not cold. It fits the hollow of your palm as if cut from it.",
    gain: "The Arcana branch: pale fire, a step through the air, powers nobody living understands. Casting raises your Resonance, and loud Resonance is heard.",
    next: "Find Old Mag, past the last lantern of Mirelight.", closes: "The Knight's road, and the regional roles.",
    confirm: { title: "The Ember", text: "It fuses to your hand. Whatever is on the other end of it will know your name.", go: "Close your hand", warn: true },
  },
  wait: {
    art: "textures/ui/hc/choice/wait", color: "§7", name: "Not yet", sub: "Keep it wrapped and hidden",
    quote: "\"Keep it close and keep it covered.\" Old Elspeth",
    gain: "Time. Come back to the Tree whenever you like.",
    next: "Neither road calls you. Your Town goes on growing.", closes: "Nothing.",
    confirm: { title: "Not yet", text: "You wrap it again and put it away. The Tree will be here.", go: "Keep it covered", warn: false },
  },
};
export const ROAD_ORDER = ["knight", "marked", "wait"];

// One panel's text: the JSON UI label shows it as is (the stock form, without the screen, shows it as a long button)
export function panelText(id) {
  const r = ROADS[id];
  return [`${r.color}§l${r.name}§r`, `§7§o${r.sub}§r`, "", `§f§o${r.quote}§r`, "",
    `${r.color}YOU GAIN§r`, `§7${r.gain}§r`, `${r.color}NEXT§r`, `§7${r.next}§r`, `${r.color}CLOSES§r`, `§7${r.closes}§r`].join("\n");
}

// What is said in the moment after each road, in order: [who, line, ticks to wait before it]. Hand-written; the
// approved lines are Aldous's "They always go quiet once they're boxed" and Elspeth's "Good. Keep it covered."
export const MOMENT = {
  knight: [
    ["Sir Aldous", "Hold still. Lead, see? It goes in the box, and nobody's hand touches it again.", 50],
    ["Sir Aldous", "...There. They always go quiet once they're boxed.", 90],
    ["Sir Aldous", "I'll ride ahead with it. Come to the chapterhouse. Brother Cael will want your name in the book.", 90],
  ],
  marked: [
    ["Old Elspeth", "You closed your hand. Then you need someone who knows more than I do.", 110],
    ["Old Elspeth", "Old Mag. Past the last lantern of Mirelight. Go soon.", 80],
  ],
  wait: [
    ["Old Elspeth", "Good. Keep it covered.", 40],
  ],
};

// The voice, the first night after the choice, whatever the road. No speaker, never explained in Act 2.
export const VOICE = "Keep it safe for me.";
export const VOICE_FROM = 15000, VOICE_TO = 21000; // time of day: deep night
export const VOICE_AFTER = 2400; // ticks after the choice, at least: not the same breath as the scene
export function voiceDue(f, now, time) {
  if (!f || f.flags.includes(F2.voice) || f.chose === undefined) return false;
  if (now - f.chose < VOICE_AFTER) return false;
  return time >= VOICE_FROM && time < VOICE_TO;
}

// The camera for the walk-up: a little back from the Tree toward where the player stands, at eye height, looking at
// the Tree's crown. tree = the Tree block, from = the player's position.
export function choiceCamera(tree, from) {
  const cx = tree.x + 0.5, cz = tree.z + 0.5;
  let dx = from.x - cx, dz = from.z - cz;
  const d = Math.hypot(dx, dz) || 1;
  dx /= d; dz /= d;
  const back = Math.min(3.5, Math.max(2.5, d - 0.5));
  return { pos: { x: cx + dx * back, y: tree.y + 1.8, z: cz + dz * back }, look: { x: cx, y: tree.y + 1.6, z: cz } };
}
