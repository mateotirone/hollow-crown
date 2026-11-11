// The hidden third ending (Mateo picked it 2026-11-11): the truce, renewed.
//
// Solve every Ledger mystery and you know the land's old name. Once Morvane has fallen, stand at the
// empty Seat and say it, and the Choir answers. From then on every third night is a Guest Night: the
// Choir's people walk up as guests, the Even Market opens again at Reedmoor's ring, nobody is taken,
// a Returned found out by a bell walks home alone, and nothing in the Hollow hunts you.
// Ring a bell at Bellhollow, as Edda did, and the truce is broken: every third night the Hollow comes
// for the walls again, harder than it ever did. After a while it can be offered again.
//
// Pure data and rules only (tested offline). The game side is lore/truce.js.

export const TRUCE = {
  seatRadius: 8, // how close to the middle of the Seat you must stand to be heard
  askAgainTicks: 1200, // after a prompt is closed, a minute before the Seat asks that player again
  renewAfterDays: 9, // after it is rung broken: three third nights before the Choir will listen again
  guestsPerKeep: 2,
  maxGuests: 12, // across the whole map, so a full Realm doesn't fill up with NPCs
  guestRing: 7, // how far from the keep block guests stand
  marketRadius: 5, // the Even Market keeper and two guests stand inside the ring of posts
  wardName: "Bellhollow", // the bell that breaks it: any bell rung inside this ward (plots/config.js WARDS)
  marketPlot: "Reedmoor", // the Even Market is at this plot's relic spot (plots/config.js PLOT_PLAN)
};

// The states other features read (lore/truce.js truceState()): never made, holding, or rung broken
export const STATES = ["none", "kept", "broken"];

// ---------- the name ----------
const squash = (text) => String(text ?? "").toLowerCase().replace(/[^a-z]/g, "");
// "Hallowmere", with the older spelling and a "the" or a repeat allowed ("Hallowmere. Hallowmere.")
export function nameIsSpoken(text) {
  let s = squash(text).replace(/^the/, "");
  for (const name of ["hallowmere", "hollowmere"]) {
    if (s === name) return true;
    if (s.length && s.length % name.length === 0 && s === name.repeat(s.length / name.length)) return true;
  }
  return false;
}

// ---------- who may offer it, and when ----------
// facts: { morvaneDown, state, knowsName (flag true_name), solvedAll (flag all_mysteries), day, brokenDay, ready (filter) }
//   "standing"  Morvane is still on the Seat (or has taken it again): there is nobody to make peace with yet
//   "kept"      it already holds
//   "unknown"   they don't know the name: the Seat says nothing at all (the ending stays hidden)
//   "half"      they know the name but not the whole story yet
//   "soon"      it was rung broken too recently
//   "blocked"   another feature has said not yet (the "truceReady" filter)
//   "ready"     ask them
export function offerVerdict({ morvaneDown, state, knowsName, solvedAll, day = 0, brokenDay = -1, ready = true }) {
  if (!morvaneDown) return "standing";
  if (state === "kept") return "kept";
  if (!knowsName && !solvedAll) return "unknown";
  if (!solvedAll) return "half";
  if (state === "broken" && day - brokenDay < TRUCE.renewAfterDays) return "soon";
  if (!ready) return "blocked";
  return "ready";
}

// Tonight is a Guest Night: the truce holds and it is a third night, counted the way sieges always were
export const isGuestNight = (day, state, { firstDay = 5, every = 3 } = {}) =>
  state === "kept" && day >= firstDay && day % every === 0;

// How many guests each keep gets tonight so the map total stays under the cap
export function guestsFor(keeps) {
  if (keeps <= 0) return 0;
  return Math.max(1, Math.min(TRUCE.guestsPerKeep, Math.floor(TRUCE.maxGuests / keeps)));
}

// Where a guest stands: spread round a centre, never two on the same spot
export function guestSpot(center, i, of, radius = TRUCE.guestRing) {
  const a = (i / Math.max(1, of)) * Math.PI * 2 + 0.6;
  return { x: Math.floor(center.x + Math.cos(a) * radius) + 0.5, z: Math.floor(center.z + Math.sin(a) * radius) + 0.5 };
}

// ---------- the Even Market: a thing for a thing, no coin (the Reeve's Roll) ----------
// give = what you hand over, get = what they hand back. mend = they mend the thing in your hand.
export const WARES = [
  { id: "light", name: "Cold light in a jar", give: { item: "minecraft:honey_bottle", count: 3 }, get: { item: "siege:glimbulb", count: 1 } },
  { id: "wood", name: "A wood that does not rot", give: { item: "minecraft:iron_nugget", count: 12 }, get: { item: "siege:hollowwood_lattice", count: 4 } },
  { id: "ore", name: "Ore that sings", give: { item: "minecraft:sugar_cane", count: 32 }, get: { item: "siege:raw_choir_ore", count: 1 } },
  { id: "mend", name: "A note that mends", give: { item: "minecraft:amethyst_shard", count: 3 }, mend: true },
];
// Guests each carry two of the four, which two depends on the guest and the night; the Market keeper carries all four
export function waresOf(guestIndex, day, market = false) {
  if (market) return WARES.map((w) => w.id);
  const first = (guestIndex + day) % WARES.length;
  return [WARES[first].id, WARES[(first + 1 + (guestIndex % (WARES.length - 1))) % WARES.length].id].filter((id, i, all) => all.indexOf(id) === i);
}

// Pick a line without repeating the last one shown
export function freshPick(lines, last, roll) {
  if (lines.length <= 1) return lines[0];
  let i = Math.floor(roll * lines.length) % lines.length;
  if (lines[i] === last) i = (i + 1) % lines.length;
  return lines[i];
}

// ---------- words ----------
export const SEAT_PROMPT = {
  title: "The Seat",
  body: "The Seat is empty. The water round it has gone very still, the way a room goes still when it thinks someone is about to speak.",
  field: "Say something",
};

export const REPLIES = {
  wrong: [
    "§8The water does not know that word. The stillness goes on a moment longer, and then it is only water.",
    "§8Nothing answers. Somewhere far below, a single voice stops, as if it had been listening, and starts again.",
  ],
  half: [
    "§5A voice, very close: §f\"You have our name. You do not have us yet. Find the rest of it, and come back.\"",
    "§5A voice, very close: §f\"Close. You know what it was called. Learn why it stopped being called that.\"",
  ],
  soon: [
    "§5A voice, very close: §f\"The bell is still ringing in our ears. Not yet.\"",
    "§5A voice, very close: §f\"You rang us out again. Give us a little while to believe you mean this.\"",
  ],
  blocked: ["§8The water listens, and waits. Something still has to happen first."],
};

// The Choir's answer, one scene per renewal: the first time, the second, and every time after.
// Each line shows as a title on everyone in the Hollow and in chat for everyone.
export const ANSWERS = [
  [
    "§5Hallowmere.",
    "§5It was both of ours.",
    "§fYou came down. You did not ring.",
    "§fThe third night was market day before it was a debt.",
    "§fLet it be market day again.",
    "§7Every third night, we will come up as guests. Leave the bells quiet.",
  ],
  [
    "§5Hallowmere.",
    "§fAgain, then.",
    "§fYou broke it once. So did she. You came back. She never did.",
    "§7Every third night, we will come up as guests. Leave the bells quiet.",
  ],
  [
    "§5Hallowmere.",
    "§fWe know your bell by now. We know your voice too.",
    "§fA thing sworn can be sworn again. That is what swearing is for.",
    "§7Every third night, guests. Keep the bells quiet.",
  ],
];
export const answerFor = (times) => ANSWERS[Math.min(Math.max(0, times), ANSWERS.length - 1)];

export const KEPT_NEWS = (name) => [
  `§d${name} has said the old name at the Seat. The truce of the third night holds again.`,
  "§7Every third night is a Guest Night now. Nobody will be taken. If a bell is rung at Bellhollow, that ends.",
];

export const BREAK_ASK = {
  title: "The Bellhollow Bell",
  body: "This is where the Founding Bell hung. Ring a bell here and the whole Hollow will hear it, the way it heard Edda.\n\nThe truce will be broken. Every third night will be theirs to take again, and they will come angrier than before.",
  ring: "Ring it",
  leave: "Let the rope go",
};
export const BROKEN_NEWS = (by) => [
  by ? `§4${by} has rung the bell at Bellhollow.` : "§4Someone has rung the bell at Bellhollow.",
  "§7Far below, every voice stops at once. Then they start again, lower. The truce is broken. Count your nights.",
];

export const DUSK_GUEST = [
  "§dNo bell is rung this evening. Guests are coming up the road. It is the third night.",
  "§dThe bell ropes are tied up with ribbon. Somebody has swept the gate. It is the third night.",
  "§dThe dogs are restless and then, quite suddenly, they are not. Guests tonight.",
  "§dSomeone has left a lamp in every window facing the road. It is a Guest Night.",
];
export const DAWN_GUEST = [
  "§7At first grey the guests are gone. They took nothing that was not traded.",
  "§7The guests went down before dawn. One of them swept the step on the way out.",
  "§7Morning. The road is empty, and wet, as if a lot of people walked up out of a river.",
];

// The guests. Hand-written, as everything is on a Realm. Twelve so the same faces don't come every time.
export const GUESTS = [
  { name: "Ysse of the Lower Streets", lines: ["Your doors are so thin. How do you sleep?", "I was told to bring a gift. I brought a light. Is a light rude here?", "My grandmother traded at the ring. She said your honey was the best thing in either world."] },
  { name: "Old Tamwick, ferryman", lines: ["I have rowed the same river for three hundred years. It is nice to walk.", "Your sky is very far up. Does nobody worry it will come down?", "Don't mind the wet. We are always a little wet."] },
  { name: "Brannagh, a lamp-keeper", lines: ["We heard your bells for four hundred years. Go away, go away. Tonight they are quiet. Thank you.", "I keep the river lamps. You saw them? Good. Somebody should."] },
  { name: "Cless, who sings the low part", lines: ["I sing the bottom note. You have heard me. Everyone has heard me. Nobody has ever said anything nice about it.", "One of us is always flat. Not me. I want that said."] },
  { name: "Wenlow the cooper", lines: ["Your barrels leak. I could fix that, if you have a note to spare.", "We had a king once, of a sort. He sat a very long time. Let us talk about barrels."] },
  { name: "Ama Reed", lines: ["My mother's mother was from up here. She walked down on a third night and stayed. I wanted to see the sun once. It is a great deal.", "Is it always this dry? I feel like bread."] },
  { name: "Hollis Glass", lines: ["I will be gone by the first grey. That is the whole of the law, and nobody has ever broken it. Well. Nobody on our side.", "You may stare. We stared at you for three hundred years."] },
  { name: "The Twins Ferrow", lines: ["We came together because nobody would come alone the first time.", "She thinks your people will ring the bell while we are up here. I told her you would not. Do not make me wrong."] },
  { name: "Dannet, a net-mender", lines: ["Every pot in the fen we ever mended cracked the night the Bell rang. I would like to mend some more, if you'll have it.", "A thing for a thing. That is how it was done. We have no use for your little coins."] },
  { name: "Mother Quell", lines: ["I have six grandchildren and none of them believe in you. I am going to tell them everything.", "You have grown tall, up here, without us. Good."] },
  { name: "Pellam, a boy of the Choir", lines: ["Can I touch the grass? Does it bite?", "My father says you are loud but kind. You are very loud."] },
  { name: "Seneth the reeve", lines: ["I keep the roll for our side of the market. The last line in it is seven hundred years old. Tonight I wrote a new one.", "Mind you trade fairly. The roll remembers everything. So do we."] },
];

export const MARKET_KEEPER = {
  name: "Seneth the reeve, at the Even Market",
  lines: [
    "The Even Market is open. It closes at the first grey. That is the whole of the law.",
    "Your fen people kept the posts mended for seven hundred years. We noticed. We notice everything.",
    "Salt, needles, honey, reed, a song. Light, wood, ore, a mending note. A thing for a thing, as it was.",
  ],
};

// ---------- how it works, told plainly (Mateo 2026-11-11: every mechanic explained in game) ----------
// Shown once to every player when the truce is made, broken, or made again (and on their next login if they were away).
export const EXPLAIN = {
  kept: {
    title: "The Truce Holds",
    body: [
      "Someone said the land's old name at the empty Seat, and the Choir accepted. Here is what changes:",
      "",
      "§lGuest Nights.§r Every third night (the old siege nights), people of the Choir come up as guests. Two stand by every settlement's keep, and more stand at the Even Market, the ring of nine posts at Reedmoor.",
      "",
      "§lTrading.§r Click a guest to talk and trade. They take a thing for a thing, never coins: honey, iron nuggets, sugar cane or amethyst for Glimbulbs, Latticewood, raw Choir Ore, or mending the item in your hand. Each guest carries two of these, and the Market keeper carries all four. They leave at first light.",
      "",
      "§lSafer nights.§r Nobody is taken. A Returned found out by a bell walks home alone. In the Hollow, Gloamwings leave you alone. Rival lords can still march on your walls.",
      "",
      "§lHow it ends.§r Ringing any bell inside Bellhollow (the valley east of Kingsrest) breaks the truce for everyone. Then every third night the Hollow attacks again, harder than before.",
    ].join("\n"),
  },
  broken: {
    title: "The Truce Is Broken",
    body: [
      "Someone rang the bell at Bellhollow. Here is what changes:",
      "",
      "§lThird nights are sieges again.§r Every third night the Hollow attacks the settlements, as hard as the Uncounted Nights, with Hollow soldiers in the ranks. Rival lords still come as well.",
      "",
      "§lNo more guests.§r The guests and the Even Market are gone, Returned can take people again, and Gloamwings hunt in the Hollow again.",
      "",
      "§lMaking it again.§r After 9 days, a player who has solved every mystery in the Ledger can stand at the middle of the empty Seat in the Hollow and say the land's old name again.",
    ].join("\n"),
  },
};
