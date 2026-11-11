// The Hollow's middle stretch: what happens between stepping through the Rift and the Choir fight.
// Mateo approved the beats on 2026-11-11 (doc "The Hollow's middle stretch: story beats").
//
// Words only, no game calls, so the offline check can test them. The places are the Hollow's
// hand-designed sites (undertow/roads.js SITES); the Hollow feature (undertow/story.js) notices a
// player walking into one and emits hollowBeat { player, beat }. lore/hollow.js plays the scene.
//
// Rules for these words (LORE-BIBLE.md): nobody says Oswin. Morvane may be named (players hear the
// name early). The one in the Chair is seen once, far off, lifting his LEFT hand (he took the
// splinter in his right, and it never served him again). The Hollow is not a mirror of our world.
//
// Beat ids are saved in worlds (flag "hb_<id>"): never rename one.

// The five places that count toward the Cartsong. Any three of them, then talk to the Carter.
export const SITE_BEATS = ["truce_hall", "standing_ranks", "far_door", "drift", "seams"];
export const BEATS_FOR_SONG = 3;

// Which place starts which beat is the Hollow feature's (undertow/story.js BEAT_SITES); keep the ids the same.

// Each scene: a title for the screen, then lines shown one after another (about 3 s apart).
// "§7§o" is narration; quoted lines are heard. give: a tome placed in the player's hands.
export const SCENES = {
  landing: {
    title: "The Wound landing",
    lines: [
      "§7§oA plank dock, a lamp, a boat half built on the bank. Someone is sitting on the end of the dock with her feet over the light.",
      "§7§oShe does not turn round. \"You came down the crack. From the bright side.\"",
      "§7§o\"Nobody comes down on purpose. Talk to me before you go anywhere. Please.\"",
    ],
  },
  glimwade: {
    title: "Glimwade",
    lines: [
      "§7§oThe cart is being loaded when you arrive. Nobody looks at you. Nobody looks at anything but the ore.",
      "§7§oEvery stone goes into it. Not one is kept back. When it is full, the whole village stands still and listens, as if for permission.",
      "§7§oSomething far to the south hums one note. The cart moves off on its own rails toward it, and the miners breathe again.",
    ],
  },
  truce_hall: {
    title: "The Truce Hall",
    lines: [
      "§7§oA long hall with no roof left. One table. One chair still standing at it. The other lies on its side, as if someone stood up very fast.",
      "§7§oThe hum gathers here. For a moment it nearly makes words. Five voices, close together, agreeing.",
      "§7§oThen one more, nearer, plainly one of ours, tired and polite: \"Then it is sworn.\"",
      "§7§oThe standing chair is theirs. They never got up. On the lectern at the far end, a book written backward.",
    ],
    give: "scri_07",
  },
  standing_ranks: {
    title: "The Standing Ranks",
    lines: [
      "§7§oRow after row of grey armour, standing to attention on an empty plain. Spears up. Shields on. Nothing inside any of it.",
      "§7§oYou count. You give up counting. It is an army, all of it, every man accounted for. Whatever promised to take them took them all.",
      "§7§oExcept one. In the front row, at the head, there is a space where a man should stand. The grass there has never grown back.",
      "§7§oSomewhere above, on the third night, he is still marching.",
    ],
  },
  far_door: {
    title: "The Far Door",
    lines: [
      "§7§oA tall arch in the rock, sealed. Scaffolds either side. Pits dug at its foot and dug again.",
      "§7§oAcross the seal runs one crack, wide at the top and fine at the bottom, the shape a bell's stroke leaves in still water.",
      "§7§oThe picks lying in the pits are Choir Ore, worn down to the handle. Hundreds of them. Some are very old.",
      "§7§oThey have not been trying to get out. They have been trying to get home.",
    ],
  },
  drift: {
    title: "The Drift",
    lines: [
      "§7§oFrom the top stone you can see the whole length of the Hollow. The villages. The river lights. The Court, dark and singing.",
      "§7§oAnd far beyond it, at the very end, the Seat. Someone is sitting in the Chair.",
      "§7§oToo far for a face. As you watch, the figure lifts its left hand, slowly, the way a man lifts a hand that has always ached.",
      "§7§oThe singing changes key. All of it. Every voice in the Hollow, at once, for him.",
    ],
  },
  seams: {
    title: "The Seams",
    lines: [
      "§7§oThe richest ore face you have seen, bleeding violet down a cliff. The rail runs from here to every Tally and on to the south.",
      "§7§oTwo Highcut miners are waiting at the mouth. They have been waiting for you. \"The cart goes tomorrow at dawn. It always goes.\"",
      "§7§o\"Unless something were to happen to it on the trestle. We could not do it. He would hear us. You, he does not know.\"",
    ],
    choice: true,
  },
  // Not a place: plays once for every player who comes to the Hollow after the Choir is silenced.
  choir_silenced: {
    title: "The Court",
    lines: [
      "§7§oThe Court is quiet. One by one the Singers who fell are getting up off the floor, holding their throats.",
      "§7§oNone of them can make a sound. They do not seem to mind. They walk out past you toward the villages, slowly, the way people walk home.",
    ],
  },
};

// The Seams: what the two miners ask, and the two answers.
export const SEAMS_CHOICE = {
  title: "The dawn cart",
  body: "The Highcut miners want tomorrow's cart wrecked on the trestle. No ore reaches the Chair, and the Court has less to sing with.\n\nIf you let it go, they will remember that you would not put them at risk.",
  wreck: { label: "Wreck tomorrow's cart", flag: "seams_wreck", after: "§7§oYou knock two pins out of the trestle. At dawn, far off, you hear it go. The Court's singing stumbles, and does not quite find its feet again." },
  spare: { label: "Let it go", flag: "seams_spare", after: "§7§o\"No. You're right. He would know.\" The older miner presses something into your hands anyway: raw ore, warm from the face. \"For not making us brave.\"" },
};
export const SPARE_ORE = 8; // raw Choir Ore the miners give if you let the cart go

// The Carter's three names to choose from at the end (flags "carter_<id>").
export const CARTER_NAMES = ["lark", "morrow", "dawn"];

export const flagOf = (beat) => `hb_${beat}`;
// How many of the five site beats a player has heard, from their lore flags. Pure.
export const siteBeatsHeard = (flags) => SITE_BEATS.filter((b) => flags.includes(flagOf(b))).length;
export const readyForSong = (flags) => siteBeatsHeard(flags) >= BEATS_FOR_SONG;
