// The Deep (Act V, arc 2): every word players read down there. Hand-written, no generated speech.
// The Host was swallowed whole at 3:17, three hundred years ago, as the Hollow's side of the truce. It has stood in
// its ranks under the Vault ever since, held there by its bell-wife's ringing. Nobody down here names who rules the
// Hollow now, or who he was.

// What the Deep Door says once Morvane has fallen (the first time, then the lines after for later visits).
export const DOOR_OPENS = [
  "The seal is warm. It was never warm before.",
  "Something on the far side lets go. The stone sinks into the floor with a sound like a held breath let out.",
  "Steps go down, a long way, into a cold that smells of iron and old snow.",
];
export const DOOR_AGAIN = [
  "The seal gives as soon as you touch it now.",
  "The steps are where you left them. So is the cold.",
  "Far below, a bell moves on its rope and does not quite ring.",
];
export const DOOR_BUILDING = "The seal is still giving way. Give it a moment.";
export const FIRST_LANDING = [
  "§7A landing, and a bell on a post. Ring it and the steps will take you back up.",
  "§7Below you a long hall goes down in flights. At the bottom something is ringing, very slowly, and has been for a long time.",
];
export const GOING_UP = "§8You ring the bell. The steps fold up under you, and the Vault's air is warm by comparison.";

// The Seal before the Ranks, and the moment it opens.
export const SEAL_SHUT = "§8A seal, grey and frosted. On the other side, a great many people are standing very still.";
export const SEAL_OPENS = "§7The bell stops. For the first time in three hundred years, the Deep is quiet. The seal to the Ranks cracks and falls in.";

// Ulfa Ice-Tongue, the bell-wife. Lines she says during the fight (to everyone in the Bell Room).
export const ULFA = {
  name: "Ulfa Ice-Tongue",
  intro: "lets go of the bell rope and turns. Behind the seal, the whole Host turns its head with her.",
  phaseNames: ["", "The Host stirs in its ranks", "She rings with her own voice"],
  lines: [
    "\"Six thousand and four came south on my bell. Six thousand and four still stand. Do you think I would let one go?\"",
    "\"I rang them out of the ice. I will ring until they are let home, or until the stone wears through.\"",
    "\"You smell of the sun. They have forgotten it. Do not remind them.\"",
  ],
  fallen: "\"Then ring them home yourself,\" she says, and the bell above her cracks along the old green line.",
  bellLore: ["§7She rang the Grey Host out of the ice and kept them standing", "§7for three hundred years. It is cracked now.", "§8It still hums one low note."],
};

// The five companies of the swallowed Host, one on each tier of the Ranks (k = 0 is the lowest, nearest the Note floor).
// Each serjeant speaks for their company. statues: the Grey Host bodies that stand in the line (never bowmen: a statue
// that can still draw would shoot). keepsake: what laying them to rest leaves in your hands.
export const COMPANIES = [
  {
    id: "rope", name: "the Rope-Wardens", serjeant: "Hrodny Rope-Hand", statues: ["siege:grey_bellcutter", "siege:grey_spearman"],
    held: [
      "\"Don't touch the rope. If the rope stops, the bell stops. If the bell stops, we stop.\"",
      "\"We hauled her bell over the ice on sledges. Forty days. I can still feel it in my hands.\"",
    ],
    free: "\"The rope's gone slack. It's never gone slack. What did you do?\"\n\nHrodny looks at her hands as if somebody else's are on the ends of her arms.",
    led: "\"Up, then. Up, all of you. Mind the steps, they're steeper than they look, and so are we.\"",
    rest: "\"Lay us down where the rope can't find us. That'll do. That'll do fine.\"",
    keepsake: "Hrodny's rope-hook",
  },
  {
    id: "shield", name: "the Shield-Wall of Kell", serjeant: "Bersi Half-Hand", statues: ["siege:grey_spearman", "siege:grey_spearman"],
    held: [
      "\"Shields up. Hold the line. Hold the line. Hold the line.\"",
      "\"Someone said three-seventeen and then there was no more night. Just this. Just holding.\"",
    ],
    free: "\"The line's held three hundred years. You'd think somebody would tell us what we were holding it against.\"\n\nBersi lowers the shield an inch, then all the way.",
    led: "\"A wall's a wall. Put us in front of yours. We know how to stand.\"",
    rest: "\"Stack the shields. Face-down, mind. So nobody thinks we're still here.\"",
    keepsake: "Bersi's notched shield-boss",
  },
  {
    id: "fell", name: "the Long Fell Company", serjeant: "Asa Grey-Eye", statues: ["siege:grey_axeman", "siege:grey_spearman"],
    held: [
      "\"Eyes front. She sees the ones that look round.\"",
      "\"I had a sister on the Long Fell. I've been trying to remember her face. I get as far as her hood.\"",
    ],
    free: "\"I can look round.\" Asa does, slowly, at the rows of grey faces. \"Oh. Oh, we've been here a while.\"",
    led: "\"The Long Fell's gone, isn't it. Then wherever you are will do for a fell.\"",
    rest: "\"Put me facing north. The Fell was north. Everything was north.\"",
    keepsake: "Asa's hood-pin",
  },
  {
    id: "cutters", name: "the Bell-Cutters", serjeant: "Torgrim Saw-Tooth", statues: ["siege:grey_bellcutter", "siege:grey_axeman"],
    held: [
      "\"We came south to cut bells down. Funny, isn't it. She never let us near hers.\"",
      "\"Every tower we pulled, she rang a little louder. We should have asked why.\"",
    ],
    free: "\"Quiet up there. No towers to pull.\" Torgrim flexes a hand that has held a saw for three centuries. \"I don't know how to do anything else.\"",
    led: "\"We'll cut what you point at. Not bells. Never bells again.\"",
    rest: "\"Bury the saws with us. Nobody up there needs to learn what they're for.\"",
    keepsake: "Torgrim's broken saw-tooth",
  },
  {
    id: "thane", name: "the Thane's Own", serjeant: "Eyvor Black-Mail", statues: ["siege:grey_serjeant", "siege:grey_axeman"],
    held: [
      "\"The thane went on ahead. He always went on ahead. He said he'd send for us.\"",
      "\"We kept his place in the line. Three hundred years. He'll want it when he comes back.\"",
    ],
    free: "\"He's not coming back for us, is he.\" Eyvor does not wait for an answer. \"No. He was never good at coming back.\"",
    led: "\"The Thane's Own follows whoever leads. That's the whole of the oath. Lead, then.\"",
    rest: "\"Leave his place in the line empty. Someone should go on waiting. It doesn't have to be us.\"",
    keepsake: "Eyvor's oath-ring",
  },
];

// The serjeant's form, once Ulfa has fallen
export const CHOICE = {
  title: (c) => `${c.serjeant}, ${c.name}`,
  lead: "Lead them out\n§8they stand at your keep",
  rest: "Lay them to rest\n§8Veil Ash and a keepsake",
  leave: "Leave them standing",
  heldButton: "Leave them",
  ledNews: (player, c) => `§7${player} led ${c.name} up out of the Deep. They will stand at a keep in the sun.`,
  restNews: (player, c) => `§7${player} laid ${c.name} to rest in the Deep.`,
  ledBonus: (n) => `§2Your keep can hold ${n} more guard${n === 1 ? "" : "s"}. They are already sharpening things.`,
  keepsakeLore: (c) => [`§7${c.serjeant}, ${c.name}.`, "§7Laid to rest in the Deep, three hundred years late.", "§8It is still cold."],
};

// The Ranks, once every company has gone one way or the other
export const RANKS_EMPTY = "§7The Ranks are empty. The tiers still show where six thousand feet stood.";
