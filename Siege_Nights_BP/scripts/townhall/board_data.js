// The Town Board's jobs, by hand (Mateo 2026-11-14: "rewrite the Town Board jobs as hand-written ones").
// Pure data, no Minecraft calls. The rules that pick and run them are board_rules.js; the game side is board.js.
//
// Every job is pinned up by a real person who stands somewhere in the world (GIVERS) and happens at a real, named
// place on the map (PLACES). Lines are written for that job and that person. Writing rules (checked by tests):
//   * offer, done and a notice for every job; an `again` line for every job that repeats; `at` for a Carry job's
//     recipient; `seen` for a Look job (what you find there).
//   * Townsfolk say nothing the street does not know (townsfolk/rules.js NEVER_SAID), and nobody names the other
//     world early (LORE-BIBLE "Keeping it secret").
//   * Ids are saved in players' board memory: never rename or reuse one. Add new jobs at the end of a region.
//
// Kinds (board_rules.js KINDS): hunt, camp, missing, supply, carry, escort, recover, look, watch.
// Hunt, Camp, Supply, Carry, Escort and Watch repeat once the region's pool has gone round once, with the `again`
// line; the rest are one-off, and so is every chain step and every story job.
//
// Fields
//   giver: a GIVERS key. place: a PLACES key. to: a GIVERS key (a Carry job's recipient).
//   about: what the tracker's "Talk to <giver> about <about>" names. thing: the letter, person or lost thing.
//   need: [at tier 0, at tier 4] (how many to kill, bring, or lamps/sheep to keep). mob / item: what to kill or bring.
//   find: the item a Carry or Recover job's `thing` is (a plain item, named with `thing`, so the job knows it).
//   when: { night, after: "siegeWon" | "town", notRaid } . site: a design key in board_sites_data.js.
//   foes: [[type, count at tier 0, count at tier 4, from tier]] for the people who come at you there.
//   keepsake: [item id, name, line] given once with the done line. chain: [chain id, step number from 1].
//   story: true for a Story Mode job (the story thread owns those lines).

export const REGIONS = ["Aldmere Vale", "Frostmarch", "Saltreach", "Emberwaste", "Blackfen"];

// Which regions border which (the map: the Vale is in the middle and touches all four)
export const NEIGHBOURS = {
  "Aldmere Vale": ["Frostmarch", "Saltreach", "Emberwaste", "Blackfen"],
  Frostmarch: ["Aldmere Vale", "Saltreach", "Emberwaste"],
  Saltreach: ["Aldmere Vale", "Frostmarch", "Blackfen"],
  Emberwaste: ["Aldmere Vale", "Frostmarch", "Blackfen"],
  Blackfen: ["Aldmere Vale", "Saltreach", "Emberwaste"],
};

// Who pins notices up. kind "folk": a townsperson of townsfolk/data.js (found by name in that town).
// kind "trader": a town's job NPC (economy/config.js TOWNS, entity siege:job_npc, tags siege_job_<job> + siege_town_<town>).
export const GIVERS = {
  osgood: { kind: "folk", town: "Kingsrest", name: "Osgood Fairweather", trade: "retired soldier" },
  aldo: { kind: "folk", town: "Kingsrest", name: "Aldo Brack", trade: "carter" },
  marta: { kind: "folk", town: "Kingsrest", name: "Marta Thistle", trade: "baker" },
  tobias: { kind: "folk", town: "Kingsrest", name: "Tobias Fennimore", trade: "clerk of the market" },
  nan: { kind: "folk", town: "Kingsrest", name: "Nan Pellow", trade: "old gossip" },
  ames: { kind: "folk", town: "Kingsrest", name: "Goodwife Ames", trade: "herb seller" },
  constance: { kind: "folk", town: "Kingsrest", name: "Constance Reed", trade: "schoolmistress" },
  joan: { kind: "folk", town: "Kingsrest", name: "Joan Croft", trade: "washerwoman" },
  bartholomew: { kind: "folk", town: "Kingsrest", name: "Bartholomew Pike", trade: "fishmonger" },
  will: { kind: "folk", town: "Kingsrest", name: "Will Cotter", trade: "thatcher" },
  ralf: { kind: "folk", town: "Kingsrest", name: "Ralf Hedger", trade: "hedge-cutter" },
  piers: { kind: "folk", town: "Kingsrest", name: "Piers Hallam", trade: "lamplighter" },
  lettice: { kind: "folk", town: "Kingsrest", name: "Lettice Mayhew", trade: "seamstress" },
  jonas: { kind: "folk", town: "Millbrook", name: "Jonas Miller", trade: "miller" },
  robin: { kind: "folk", town: "Millbrook", name: "Robin Askew", trade: "clockmaker" },
  abel: { kind: "folk", town: "Millbrook", name: "Abel Crane", trade: "shepherd" },
  bryony: { kind: "folk", town: "Millbrook", name: "Bryony Ward", trade: "midwife" },
  harlan: { kind: "folk", town: "Millbrook", name: "Harlan Voss", trade: "blacksmith" },
  kingsrest_hunter: { kind: "trader", town: "Kingsrest", job: "hunter", name: "the Kingsrest hunter", trade: "hunter" },
  millbrook_woodcutter: { kind: "trader", town: "Millbrook", job: "woodcutter", name: "the Millbrook woodcutter", trade: "woodcutter" },
};

// Named places on the map. x/z: the spot the pin and the light go on (and a site's centre). Places picked on the
// map's real ground (map heights 2026-11-14): fights stay 130+ blocks from every plot centre and out of every ward.
// alt: other spots near by that a repeat may use instead ([dx, dz] from x/z), so a repeat is never the same twice.
// town: a place in a town (the giver's own door); no site, no pin beyond the person.
export const PLACES = {
  crownhold_barrows: { region: "Aldmere Vale", name: "the Crownhold barrows", x: -300, z: -289, alt: [[18, 9], [-12, 16]] },
  carters_rest: { region: "Aldmere Vale", name: "Carter's Rest", x: -372, z: -387, alt: [[22, -16], [14, -26]] },
  oakwood_ride: { region: "Aldmere Vale", name: "the Oakwood ride", x: 101, z: -504, alt: [[-30, 6], [28, -4]] },
  greywater_meadows: { region: "Aldmere Vale", name: "the Greywater meadows", x: -23, z: -217, alt: [[40, -10], [-30, 12]] },
  old_mooring: { region: "Aldmere Vale", name: "the Old Mooring on Wren Water", x: -11, z: 243 },
  wrenfield_jetty: { region: "Aldmere Vale", name: "the old Wrenfield jetty", x: -130, z: 295 },
  crownhold_elm: { region: "Aldmere Vale", name: "the elm below Crownhold", x: -269, z: -273 },
  harrow_ferry: { region: "Aldmere Vale", name: "the Harrowford ferry post", x: -436, z: -215 },
  bellhollow_road: { region: "Aldmere Vale", name: "the Bellhollow road", x: 129, z: -28 },
  south_waystone: { region: "Aldmere Vale", name: "the waystone on the Wrenfield road", x: -116, z: 40 },
  millbrook_lamps: { region: "Aldmere Vale", name: "the Millbrook road lamps", x: -39, z: -297 },
  abels_fold: { region: "Aldmere Vale", name: "Abel's fold", x: 30, z: -561 },
  ravens_copse: { region: "Aldmere Vale", name: "the ravens' copse", x: -180, z: -509 },
  brackenfold: { region: "Aldmere Vale", name: "Brackenfold", x: 75, z: 6 },
};

// Names the tracker uses for what a job asks for
export const MOB_NAMES = {
  "siege:barrow_wight": "barrow wights", "siege:hollow_footman": "stray Tollmen", "siege:torchbearer": "Torchbearers",
  "siege:shieldwall_brute": "shieldwall brutes", "siege:rimewolf": "rimewolves", "siege:brine_lurker": "brine lurkers",
  "siege:ash_scarab": "ash scarabs", "siege:dune_wyrm": "dune wyrms", "siege:mire_toad": "mire toads", "siege:bog_hag": "bog hags",
};
export const ITEM_NAMES = { "minecraft:wheat": "wheat", "minecraft:white_wool": "white wool" };

const TOLLMEN = [["siege:hollow_footman", 3, 6], ["siege:shieldwall_brute", 0, 1, 2]];

export const JOBS = [
  // ---------------- Aldmere Vale (Mateo to approve: https://claude.ai/artifact/F2JLWPN5q2aPXM94ffk6oP) ----------------
  {
    id: "vale_wights", region: "Aldmere Vale", kind: "hunt", giver: "osgood", place: "crownhold_barrows", about: "the barrows",
    title: "Wights on the Crownhold road", mob: "siege:barrow_wight", need: [4, 8], when: { night: true }, site: "vale_barrows",
    lines: {
      notice: "Old soldier wants a younger arm. Ask for Osgood at the Kingsrest wall.",
      offer: "The barrows by the Crownhold road have opened. Not dug. Opened, from the inside. Knights in their grave-iron, walking the verge at night. I did thirty years on the walls and I'll not do a thirty-first. Put them back down for me.",
      while: ["Every hit they land, they heal. So don't let them land any."],
      done: "Back in the ground, then. Good. Somebody should write down who was buried there, so we know who to blame next time.",
      again: "They're up again on the Crownhold road. Same barrows. I'd say they've no manners, but they were knights.",
    },
  },
  {
    id: "vale_toll", region: "Aldmere Vale", kind: "camp", giver: "aldo", place: "carters_rest", about: "the toll",
    title: "The toll at Carter's Rest", foes: TOLLMEN, site: "vale_camp",
    lines: {
      notice: "Carter robbed on the Harrowford road. Will pay in Regals and in mule bites. Aldo Brack, Kingsrest.",
      offer: "They've put a camp in Carter's Rest, where we stop to water the mules. Took a toll off me, a crate and a half. Didn't want the money. Wanted the axle grease and the rope. Raiders that steal rope are building something, and I don't want to see what.",
      while: ["Smoke over the Harrowford road. That's them."],
      done: "Rope's back, grease is back, mule's still angry. That's as good as this road gets.",
      again: "They're back in Carter's Rest. Same fire-ring and all. You'd think they'd find their own clearing.",
    },
  },
  {
    id: "vale_ram", region: "Aldmere Vale", kind: "camp", giver: "millbrook_woodcutter", place: "oakwood_ride", about: "the felled oaks",
    title: "Felling in the Oakwood", foes: TOLLMEN, site: "vale_ram_camp",
    lines: {
      notice: "Someone is cutting Millbrook's oaks and it isn't me. The woodcutter, Millbrook.",
      offer: "Fresh stumps all down the Oakwood ride. Cut low and clean, by somebody who knows how. They're shaping the trunks into a ram. My oaks, going into somebody's gate. Go and stop it before it has wheels.",
      while: ["You can hear the adzes from the road."],
      done: "Broken up? Good. A waste of good oak, but I'd rather that than see it come through a wall.",
      again: "Stumps on the ride again. They've started another one. They don't learn, and the trees don't grow back that fast.",
    },
  },
  {
    id: "vale_stragglers", region: "Aldmere Vale", kind: "hunt", giver: "kingsrest_hunter", place: "greywater_meadows", about: "the stragglers",
    title: "Stragglers in the Greywater meadows", mob: "siege:hollow_footman", need: [5, 9], when: { after: "siegeWon" },
    foes: [["siege:torchbearer", 0, 1, 2]],
    lines: {
      notice: "Raid's over but not all of them went home. Hunter wanted. Kingsrest.",
      offer: "After a raid some of them don't go back. They stand about in the river meadows east of town, facing nothing. Then something tells them to move, and they move towards people. I hunt deer. I'd rather you did these.",
      while: ["They don't run and they don't hide. That's the worst of it."],
      done: "Meadows are quiet. I'll get my traps back out.",
      again: "More of them in the Greywater meadows. Every raid leaves a few, like a tide line.",
    },
  },
  {
    id: "vale_salt_flour", region: "Aldmere Vale", kind: "supply", giver: "marta", about: "the flour",
    title: "Flour that tastes of salt", item: "minecraft:wheat", need: [24, 48],
    lines: {
      notice: "Wanted: wheat. Honest wheat. Marta Thistle, baker.",
      offer: "The flour's gone salty again. Salt, in flour, from a dry mill. I'm not going to ask why. I'm going to bake with something else. Bring me wheat from your own fields and I'll grind it myself.",
      while: ["Doesn't matter what it looks like. Wheat's wheat, as long as it tastes of nothing."],
      done: "Tastes of nothing! Lovely. First good loaf in a week. There's one for you at dawn, on the house.",
      again: "Salt in the flour again. You know what I need.",
    },
  },
  {
    id: "vale_blankets", region: "Aldmere Vale", kind: "supply", giver: "bryony", about: "the sick house",
    title: "Blankets for the sick house", item: "minecraft:white_wool", need: [12, 24],
    lines: {
      notice: "Sick house short of blankets. Bryony Ward, Millbrook.",
      offer: "The ones who come back from a night out are cold. Not ill. Cold all the way through, and blankets don't seem to touch it. We try anyway. Bring me wool and I'll do the rest.",
      while: ["White, if you can. They seem to settle better under white. Don't ask me why."],
      done: "That'll see us through. Sit a minute. You look like you've been out in it too.",
      again: "Short again. More come in every week.",
    },
  },
  {
    id: "vale_miller_letter", region: "Aldmere Vale", kind: "carry", giver: "tobias", to: "jonas", about: "a letter for Millbrook",
    title: "The miller's account", thing: "the sealed account", find: "minecraft:paper",
    lines: {
      notice: "Letter to Millbrook, sealed, must be signed for. T. Fennimore, Clerk of the Market.",
      offer: "The miller says his flour is his flour until it crosses the Kingsrest bridge, and I say it is Kingsrest flour from the moment it's sold. This letter says so at more length. Bring me his answer, and try not to let him cry on it.",
      at: "Kingsrest flour. Kingsrest flour! My great-great-grandfather's rock would turn in its quarry. Here. Take him this.",
      done: "He's written 'no' eleven times and signed it. A clear position. I'll file it.",
      again: "Another letter for the miller. We've been doing this for six years. It's the most reliable thing in either town.",
    },
  },
  {
    id: "vale_nans_clock", region: "Aldmere Vale", kind: "carry", giver: "robin", to: "nan", about: "a parcel for Kingsrest",
    title: "A clock for Nan Pellow", thing: "Nan Pellow's clock", find: "minecraft:clock",
    lines: {
      notice: "Parcel for Kingsrest, delicate. R. Askew, clockmaker.",
      offer: "Nan Pellow sent her clock back saying it runs slow. It doesn't. I've had it apart. Nothing wrong with it at all, except that one night in three it stops at seventeen past three, like all the rest. Take it back to her and tell her it's fixed. It's easier for both of us.",
      at: "Fixed, is it? It isn't. But it's kind of him to lie about it. Sit, I'll tell you about my second husband.",
      done: "She said I lied? Course I did. Here, for your trouble.",
      again: "Nan's clock is back. Same complaint, same clock. Same lie, if you'd be so good.",
    },
  },
  {
    id: "vale_feverfew", region: "Aldmere Vale", kind: "escort", giver: "ames", place: "old_mooring", about: "Wren Water",
    title: "Feverfew at Wren Water", when: { day: true },
    foes: [["siege:hollow_footman", 2, 4], ["siege:barrow_wight", 0, 1, 3]],
    lines: {
      notice: "Herb seller wants company to Wren Water. Bring a sword, I'll bring the basket. Goodwife Ames.",
      offer: "Best feverfew in the Vale grows on the Wren Water shore, by the Old Mooring. I used to walk down on my own. I don't any more. Walk me there, stand about looking fierce, and I'll pay you in coin and in advice about your feet.",
      while: ["Not so fast. I'm sixty-three and my hip is older.", "Keep them off me for a few minutes. This one's for warts. So's this one."],
      done: "A full basket. I'll sit by the old mooring a while and get my breath back. You go on. Here, and rub that on your boots.",
      again: "Basket's empty again. Wren Water, same as before, if your sword's free.",
    },
  },
  {
    id: "vale_wat", region: "Aldmere Vale", kind: "missing", giver: "constance", place: "wrenfield_jetty", about: "Wat Cotter",
    title: "Wat Cotter hasn't come home", thing: "Wat Cotter", skin: "boy",
    lines: {
      notice: "A pupil is missing. Please ask at the school. C. Reed.",
      offer: "Wat Cotter didn't come to school yesterday and didn't come home last night. He's been talking all week about the swans on Wren Water and the old jetty where the princess used to row from. His father's up on a roof pretending he's not frightened. Please go and look.",
      found: "I came to see the swans and then my foot went in between the posts. I'm not crying. I was crying earlier. Can we go now?",
      while: ["Do you know any stories? Miss Reed knows loads but they all stop in the middle."],
      done: "Thank you. I'll be stern with him tomorrow. Tonight I'm just going to sit down.",
    },
  },
  {
    id: "vale_wind_nest", region: "Aldmere Vale", kind: "recover", giver: "joan", place: "crownhold_elm", about: "her ring",
    title: "The wind's nest", thing: "Joan Croft's wedding ring", site: "vale_peg_nest", find: "minecraft:gold_nugget",
    keepsake: ["minecraft:stick", "The Wind's Peg", "Folded neater than you'd fold it."],
    lines: {
      notice: "Lost: one wedding ring, in a sheet, in the wind. Joan Croft, washerwoman.",
      offer: "I've told folk the wind steals a peg a day and I think it's building something. They laugh. Well, yesterday it took a whole sheet with my ring knotted in the corner, and I watched it go, north-west, up toward the old capital. Go and see what it's building.",
      seen: "A nest the size of a cart, every stick of it a clothes peg. In the middle, Joan's sheet, folded neatly, and her ring on top.",
      done: "Pegs. All of them pegs. Folded my sheet, did it? Better than my husband ever managed. Here, take one of the pegs. For luck, or for proof.",
    },
  },
  {
    id: "vale_ferry_bell", region: "Aldmere Vale", kind: "recover", giver: "bartholomew", place: "harrow_ferry", about: "the ferry bell",
    title: "The Harrow ferry bell", thing: "the Harrow ferry bell", site: "vale_sunk_bell", find: "minecraft:bell",
    keepsake: ["minecraft:gold_nugget", "The Harrow Ferry Token", "A ha'penny a head. Soldiers free, by the King's order."],
    lines: {
      notice: "Family bell in the river at Harrowford. Good swimmer wanted. B. Pike, fishmonger.",
      offer: "My gran was a Harrow, from the ferry. When the post rotted the ferry bell went in the river, and she always said it should come out before she died. She's ninety, so I'd say there's no rush, but she disagrees. It's by the old post on the Alder. Bring it up. And don't ring it. She was very clear about that.",
      while: ["Mind the current. It's colder than it looks."],
      seen: "Green with weed, half in the silt by the old post: the ferry bell, its clapper tied fast with rotten rope.",
      done: "That's it. Gran'll weep. Here. And she sent this for you, she says it was the fare.",
    },
  },
  {
    id: "vale_lantern_line", region: "Aldmere Vale", kind: "look", giver: "will", place: "bellhollow_road", about: "the lights",
    title: "Lights on the Bellhollow road", site: "vale_lantern_line", when: { night: true, notRaid: true },
    lines: {
      notice: "Want someone with good eyes and no imagination. Ask for Will on whichever roof he's on.",
      offer: "From up high you see things. Third nights, lights out on the Bellhollow road, moving in a line, slow, like folk walking. I've seen it a dozen times and I've never gone to look. Go and look for me, and tell me it's nothing.",
      seen: "A row of candle lanterns set down on the verge in a dead straight line, every one just gone out, the wicks still warm. Frost on the road, and footprints that start at the first lantern and stop at the last.",
      done: "Lanterns, set down neat, all the same distance apart. And the prints just stop. Right. Thank you. I'll stop looking, then.",
    },
  },
  {
    id: "vale_waystone", region: "Aldmere Vale", kind: "look", giver: "ralf", place: "south_waystone", about: "the old stone",
    title: "A face off the waystone", site: "vale_waystone",
    lines: {
      notice: "Something odd on the Wrenfield road. Ask Ralf, the hedge-cutter.",
      offer: "I told folk about the old stone past the fields with a king carved on it and his face scratched off. Well, there's another, on the Wrenfield road, and I'd swear it had a face last month. Go and look. Tell me I'm wrong.",
      seen: "A crowned figure carved on a waystone. The face is gone, chiselled flat. Stone dust is still in the grass, and the chisel marks are clean and pale.",
      done: "Fresh. So somebody's still at it. Three hundred years on, and somebody still gets up in the morning and goes out to scratch a face off a stone. Odd sort of job.",
    },
  },
  {
    id: "vale_lamps", region: "Aldmere Vale", kind: "watch", giver: "piers", place: "millbrook_lamps", about: "the lamps",
    title: "Somebody puts out the lamps", need: [3, 4], site: "vale_lamps", when: { notRaid: true },
    foes: [["siege:hollow_footman", 2, 4]],
    lines: {
      notice: "Night work, lamps, Millbrook road. P. Hallam.",
      offer: "Every lamp lit by dusk, every lamp out by dawn. Except the ones on the Millbrook road, which are out by midnight, every night this week, and it isn't wind. Stand with them till morning and keep them burning.",
      while: ["Long pole, short ladder, steady hand. That's the whole trade."],
      done: "Lit till dawn. First time this week. I'll take the night tonight, you go and sleep.",
      again: "They're putting the Millbrook road lamps out again. Same as before, if you'll stand the night.",
    },
  },
  {
    id: "vale_fold", region: "Aldmere Vale", kind: "watch", giver: "abel", place: "abels_fold", about: "his flock",
    title: "One more than I own", need: [4, 6], site: "vale_fold", when: { notRaid: true },
    foes: [["siege:barrow_wight", 1, 3]],
    lines: {
      notice: "Shepherd needs a night watch on the hill. Abel Crane, Millbrook.",
      offer: "I counted the flock one morning and had one more than I own. Since then I've had fewer every week. Something comes up the hill in the dark. The dog won't go out. Sit the night at the fold for me. I'll count them in the morning.",
      while: ["The dog's under the cart. Wise dog."],
      done: "I've counted them twice. The right number. The right sheep, too, I think.",
      again: "They're coming up the hill again. Same fold, same night, if you will.",
    },
  },
  {
    id: "vale_cloak_1", region: "Aldmere Vale", kind: "look", giver: "lettice", place: "ravens_copse", about: "the traveller's cloak",
    title: "The iron-thread cloak", chain: ["vale_cloak", 1], site: "vale_cold_camp", when: { after: "siegeWon" },
    lines: {
      notice: "Seamstress worried about a customer. Lettice Mayhew, Kingsrest.",
      offer: "A traveller brought a cloak in for mending and broke my needle on it. Iron thread, woven right in. He paid, said he was camped at the copse west of Millbrook, and never came back for it. That was a fortnight ago. Would you go and see if he's all right?",
      seen: "A cold camp. A bedroll, a pack, and a raven sitting on the pack that will not move for you. In the pack, a note: \"If I'm not back by the third night, the cloak is paid for.\"",
      done: "Not there, and the note in his own hand. Then it's paid for, and I don't know what to do with it. Harlan Voss in Millbrook knows iron. Take it to him.",
    },
  },
  {
    id: "vale_cloak_2", region: "Aldmere Vale", kind: "carry", giver: "lettice", to: "harlan", about: "the cloak",
    title: "The iron-thread cloak, to Millbrook", chain: ["vale_cloak", 2], thing: "the iron-thread cloak", find: "minecraft:leather_chestplate",
    keepsake: ["minecraft:leather_chestplate", "The Silent Cloak", "Iron thread, northern work. It was paid for."],
    lines: {
      notice: "Parcel for the Millbrook smith. L. Mayhew.",
      offer: "Here it is. Mind your fingers, it's heavier than it looks. Harlan's at the forge in Millbrook.",
      at: "Iron thread. Nobody down here can do this. The old smiths up north could. It's not for warmth. It's woven so that whoever wears it makes no sound at all. Somebody didn't want to be heard. Give it back to Lettice; it's hers to sell or keep.",
      done: "Silent, is it? I'm not wearing that. You have it. You go out at night more than I do.",
    },
  },
];

// Shared jobs that can turn up in any region (written after the regions). Each names its giver per region.
export const SHARED_JOBS = [];
