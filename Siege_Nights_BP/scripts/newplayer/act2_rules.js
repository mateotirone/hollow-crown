// Act 2, "first win to Town" (story-and-gameplay pass, Mateo 2026-11-14). Part 1: Sir Aldous comes for the Ember and
// you keep it, he sends you to the Tree of Oaths in your hall, the choosing scene plays there, and the road you chose
// becomes your main step. The first night after the choice a far voice says one line. Part 2: the morning after the
// choice Elspeth points at the bills, you sell your iron to the Moneyer, he tells you to build an Ironworks, you
// build it and collect its first iron. Plan: the "Story and Gameplay
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
  bills: "elspeth_bills", // Elspeth pointed at the upkeep and sent you to the Moneyer
  sold: "moneyer_ironworks", // you sold the Moneyer iron and he told you to build an Ironworks
  collected: "act2_iron", // you took the Ironworks' first iron
  bookThought: "act2_book_thought", // the first local book made you think "That's here. That's my land."
  bookSeen: "act2_book_seen", // you rode to the place it names and saw it for yourself
  family: "family_met", // you heard Tobin out at the cart
  housed: "family_housed", // you gave the family a place in the Longhouse
  notice: "act2_notice_told", // Elspeth told you there's a notice up you'll want to read
};
export const ELSPETH_TAG = "siege_lore_npc_elspeth";
export const MONEYER_TAG = "siege_job_moneyer";
export const DAY = 24000;
// The morning after the choice: Elspeth's bills wait for it (a choice made before this was written counts as long ago)
export const morningAfter = (chose, now) => chose === undefined || now >= (Math.floor(chose / DAY) + 1) * DAY;

// Is Act 2 this player's story right now? After Sir Aldous, before any boss has fallen (old worlds that are further
// on keep the story they were on).
export function inAct2(f) {
  if (!f || f.morvane || !f.flags.includes(F2.aldous)) return false;
  return (f.down ?? 0) === 0;
}

// f = { flags, path ("none" | "knight" | "marked" | a regional role), ember (has the Ember in the pack), down (bosses
//       fallen), morvane, chose (absolute time of the choice), now (absolute time),
//       ironworks: { standing (built or going up), built (its stage, 0 while rising) } }
export function act2Stage(f) {
  if (!inAct2(f)) return undefined;
  const has = (flag) => f.flags.includes(flag);
  const road = roadStage(f, has);
  if (road !== "done") return road;
  // part 2: the bills, the Moneyer, the Ironworks
  if (!morningAfter(f.chose, f.now ?? 0)) return undefined;
  if (!has(F2.bills)) return "talk_bills";
  if (!has(F2.sold)) return "moneyer";
  if (!f.ironworks?.built) return "ironworks";
  if (!has(F2.collected)) return "collect";
  // part 3: the book's place
  if (f.book && !has(F2.bookSeen)) return f.book.read ? "book_place" : "read_book";
  // part 4: the family at the gate. The cart comes the morning after a siege (newplayer/family.js); f.cart is
  // "due" (waiting for that morning), "rolling" (on the road, the gate lookout has called it) or "here"
  if (!has(F2.housed)) {
    if (f.cart !== "rolling" && f.cart !== "here") return undefined;
    return has(F2.family) ? "house_family" : "meet_cart";
  }
  // part 5: the first Town Board job, the morning after they move in: Tobin's notice, the chest from the burned hamlet.
  // f.board = { taken (the job is yours), done, step (the board's own step, townhall/board.js boardStep) }
  if (!f.board || !morningAfter(f.housedAt, f.now ?? 0)) return undefined;
  if (f.board.done) return undefined;
  return f.board.taken ? "board_job" : "read_notice";
}
// Part 1: Aldous, the Tree, and the road you chose; "done" once that is behind you (or you said "Not yet")
function roadStage(f, has) {
  if (f.path === "none" || !f.path) {
    if (has(F2.wait)) return "done"; // "Not yet": neither road calls; the later Act 2 steps go on
    if (!has(F2.tree)) return "talk_aldous";
    return f.ember ? "tree" : undefined;
  }
  if (f.path === "knight") return has(F2.cael) ? "done" : "chapterhouse";
  if (f.path === "marked" || f.path === "sorcerer") return has(F2.mag) ? "done" : "mag";
  return "done"; // a regional role was sworn instead
}

// Stages whose place is a story place: a light pillar stands over it
export const PILLAR2 = new Set(["chapterhouse", "mag", "book_place"]);

// The family at the gate (part 4): the gate lookout's call (Mateo's approved line), and the cart's road
export const CART_CALL = "Cart on the road! Families, by the look.";
export const CART_ROAD = { from: 30, to: 6, speed: 0.07 }; // blocks out from the gate it starts and stops, blocks a tick
export const FAMILY_TAGS = { tobin: "siege_lore_npc_tobin", marta: "siege_lore_npc_marta" };
// The morning after a siege: the cart sets off once it is day (time of day) and the lord is home
export const CART_FROM = 1000, CART_TO = 11000;
// Ready for the family: every earlier Act 2 step is behind this player (the cart is all that is missing)
// Act 2's first board job, by your home region (townhall/board_data.js: the hamlet the family fled)
export const FIRST_JOBS = { "Aldmere Vale": "vale_family_chest", Frostmarch: "frost_family_chest", Saltreach: "salt_family_chest", Emberwaste: "ember_family_chest", Blackfen: "fen_family_chest" };
export const NOTICE_LINE = "There's a notice up you'll want to read.";
export const familyReady = (f) => act2Stage({ ...f, cart: "here" }) === "meet_cart";
export const cartDue = (due, now, time) => due !== undefined && now >= due && time >= CART_FROM && time < CART_TO;

// The stages where Elspeth holds the next step
export const TALK2 = new Set(["talk_bills"]);

// The tracker's line. p = places: { aldous, tree, chapterhouse, mag, hearth, moneyer, works, shelf, relic } each
// { x, z } (or undefined); moneyer also has name (the town). f.book = { plot, title, read } (part 3)
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
    case "talk_bills": return step("Talk to Old Elspeth", "A new morning. She's been looking at your accounts.",
      at("Old Elspeth", p.hearth), { npc: { tag: ELSPETH_TAG, name: "Old Elspeth" } });
    case "moneyer": return step("Sell your iron to the Moneyer", `Elspeth said: take the iron you smelted to the Moneyer${p.moneyer?.name ? ` in ${p.moneyer.name}` : ""} and see what a bar's worth.`,
      at("The Moneyer", p.moneyer), { npc: { tag: MONEYER_TAG, name: "the Moneyer" }, note: f.haveIngot === false ? "No iron left? The old shaft past your wall fills again every night." : "" });
    case "ironworks": return step("Build the Ironworks", f.ironworks?.standing
      ? "It's going up. The Ore Pit is dug while you wait."
      : "The Moneyer said: put up an Ironworks and let it dig for you. Use the Plot Marker on your Works yard and pick the Ironworks.", at("Works yard", p.works));
    case "collect": return step("Collect your iron", "The Ore Pit digs through the night. At dawn, click the Ironworks block in the yard and take what it dug.", at("Ironworks", p.works));
    case "read_book": return step(`Read "${f.book?.title ?? "the old book"}"`, "Somebody left a book on your Library shelf a long time ago. It's about this land.",
      at("Library shelf", p.shelf));
    case "book_place": return step(`Ride to ${BOOK_PLACES[f.book?.plot]?.place ?? "the place in the book"}`, `The book "${f.book?.title ?? "from your shelf"}" names a place on your land. That's here. That's your land.`,
      at(cap(BOOK_PLACES[f.book?.plot]?.place ?? "The place in the book"), p.relic));
    case "meet_cart": return step("Meet the cart at your gate", `A shout from ${f.caller ?? "the gate lookout"}: "${CART_CALL}"`,
      at("The cart", p.cart), { npc: { tag: FAMILY_TAGS.tobin, name: "Tobin" } });
    case "house_family": return step("Give them a place in the Longhouse", "Tobin said: we can work, we only need a roof. Tell him there's room in the Longhouse.",
      at("Tobin", p.cart), { npc: { tag: FAMILY_TAGS.tobin, name: "Tobin" } });
    case "read_notice": return step("Read the notice on the Town Board", `Elspeth said: "${NOTICE_LINE}"`, at("Town Board", p.board));
    case "board_job": return boardJobStep(f.board?.step, p);
    default: return undefined;
  }
}
// The board's own step for the family's chest, said the story's way: Tobin's words, and Tobin pinned in the Longhouse
function boardJobStep(b, p) {
  if (!b) return undefined;
  const tobin = p.tobin ? { name: "Tobin", x: p.tobin.x, z: p.tobin.z, dim: "minecraft:overworld" } : b.target;
  const hint = { talk: "His notice is on the Town Board. He's in your Longhouse.", go: "Tobin said: the last house on the lane, by what's left of the table.", back: "Tobin is waiting in your Longhouse." }[b.step] ?? b.hint;
  return { id: `act2_${b.id}`, title: b.title, hint, target: b.step === "go" ? b.target : tobin, ...(b.npc ? { npc: b.npc } : {}) };
}
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// ---------- part 3: the book's place ----------
// Each plot's first local book (lore/data/plots.js) names somewhere on the plot: its old landmark (PLOT_PLAN relic,
// built by landmarks/sites.js). Riding there, you remember what the Order says happened, and see that it can't be
// so. Small true things only: nothing names the Hollow, the truce, Oswin or Edda.
//   place  where the tracker sends you ("Ride to <place>")
//   order  what the Order says (its histories, its friars, its riders)
//   see    your own thought, standing there
export const BOOK_NEAR = 14; // blocks from the landmark that count as "there"
export const BOOK_THOUGHT = "That's here. That's my land.";
export const BOOK_PLACES = {
  Harrowford: { place: "the ford meadow", order: "the Grey Host drowned at the Alder ford and the river took the bodies.",
    see: "Rusted spearheads in the grass, and a buckle still done up. A river that takes a man and leaves his belt fastened on the bank." },
  Oakmere: { place: "the leaning oaks", order: "the King never came back to Oakmere once he was crowned.",
    see: "A flagstone with an iron ring, and every oak leaning away from it. Somebody sat down there with a lamp, often, and the trees didn't like it." },
  Thistledown: { place: "the bell frame on the down", order: "the frame on the down was a gallows, and nothing else.",
    see: "No gallows needs a bell-hook worn smooth. And every sheep on the down is grazing with its face to it." },
  Wrenfield: { place: "the old garden by Wren Water", order: "the summer house stood empty, and no child of the royal house grew up here.",
    see: "A letter cut into the apple tree by a child's knife, grown wide with the bark. Somebody grew up here." },
  Frosthelm: { place: "the old cart road", order: "the old diggings were copper for coin, worked out and left.",
    see: "Silver showing in the wall, left where it was. Nobody digging for coin walks past silver. And the road runs straight into the ice." },
  Wolfcairn: { place: "the cairn", order: "the northmen sailed for plunder in a hungry year.",
    see: "Six thousand stones carried up by hand, and not a name on one. Nobody builds that for men who went looking for plunder." },
  Gullcliff: { place: "the beacon on the cliff", order: "the beacons were lit and the Vale stood ready for the grey sails.",
    see: "The tally of sails on the wall just stops. Three fires lit, and nobody came. Ready, they call it." },
  Tidewatch: { place: "the tide posts", order: "the third-night custom along this shore is old superstition, nothing more.",
    see: "Notches on the seaward side of the last post. Nobody standing on land could have cut those." },
  Reedmoor: { place: "the ring of posts", order: "the fen folk are simple, and their ring is an old cattle pound.",
    see: "Nine posts, too far apart to pen anything. Bare ground inside, and not a footprint on it." },
  Lanternbog: { place: "the lantern posts", order: "those lost in the fen drowned, and that's an end of it.",
    see: "Hooks worn bright from lamps hung up and taken down again. Nobody takes a lamp down for the drowned." },
  Redmesa: { place: "the stone-yard on the mesa", order: "the old king's forty statues were broken up because his people hated him.",
    see: "Forty pale marks where they stood, and a forty-first under the fallen lean-to. The carver kept one. People who hate a man don't keep his face." },
  Dunehold: { place: "the hall by the well", order: "the hall at the well was a house of rest for tired clerks.",
    see: "Forty desks, and every one chained to the floor. Rest doesn't need chains." },
};

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
// The Moneyer, when you sell him your first bar while he is your step (Mateo's approved line, plan doc step 4)
export const MONEYER_LINE = "Eight a bar. You dug that yourself? A lord with land doesn't swing his own pick. Put up an Ironworks and let it dig for you.";
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
