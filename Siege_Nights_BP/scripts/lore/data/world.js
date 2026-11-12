// Collections, library milestones, places, the seven thin places, and the mystery threads.
// Pure data, no Minecraft imports.

// ---------- Collections ----------
// reward: sp = skill points, renown = Renown XP, items = given once, flag = set on the player,
// text = what the player is told. A player claims a reward at any Library that holds the whole
// collection, once they have read every tome in it themselves.
export const COLLECTIONS = [
  {
    id: "chronicles", name: "The Oswin Chronicles", color: "§6", count: 12,
    blurb: "The royal chronicle of the last king, by Master Bertram Quill. The Order burned every copy it could find.",
    reward: { sp: 3, renown: 60, flag: "col_chronicles", text: "You have the whole Chronicle. Read volume 8 against volume 12: Quill wrote what he was told, and hid the truth in the details. A coffin too light. A king who changed hands." },
  },
  {
    id: "sealed", name: "Sealed Records of the Ashen Gate", color: "§7", count: 12,
    blurb: "What the knights wrote down, what they ordered burned, and one letter they never found.",
    reward: { sp: 3, renown: 60, flag: "col_sealed", text: "You hold the Order's own records. They knew why the sieges come. They knew, and they let the keeps think it was bandits." },
  },
  {
    id: "corvin", name: "Corvin's Notebooks", color: "§5", count: 10,
    blurb: "Ten notebooks of the last mage, scattered by his students before the Order could burn them.",
    reward: { sp: 4, renown: 80, flag: "col_corvin", text: "Every notebook, together again. Old Mag of Mirelight was his last apprentice. Show her that you gathered them all: she has kept one thing back." },
  },
  {
    id: "survey", name: "The Surveyor's Field Notes", color: "§2", count: 7,
    blurb: "Brother Fennick found where the Gate wandered to, and hid the answer across six notebooks.",
    reward: { sp: 2, renown: 40, flag: "col_survey", text: "With the six field notes shelved you can Name the Thin Place here in your Library. Choose carefully." },
  },
  {
    id: "letters", name: "The Lighthouse Letters", color: "§b", count: 8,
    blurb: "Three hundred years of letters from a lighthouse keeper to his drowned wife, in their private cipher.",
    reward: { sp: 2, renown: 40, flag: "col_letters", text: "The letters give an address under the sea: the Chapel of Saint Brannoc, third pew from the altar, under the stone carved with a gull. The sea only draws back far enough on the night the moon is dark." },
  },
  {
    id: "scripture", name: "The Sung Verses", color: "§3", count: 8,
    blurb: "Hymns of the Choir, written backward. Reading them is not good for you.",
    reward: { sp: 3, renown: 60, flag: "col_scripture", text: "You have every hymn. One of them holds the name this land had before the bells. Write it in your Ledger where the thread asks for it." },
  },
  {
    id: "testimony", name: "Testimonies of the Lost Days", color: "§e", count: 10,
    blurb: "Statements, notices and confessions from ordinary people. Some of them are lying, and one is not a person.",
    reward: { sp: 2, renown: 40, flag: "col_testimony", text: "Wrong hand. Faces the wall. Fears a bell. You know how to tell the Returned now, and so do your guards: Lost Villagers and Changelings near your keep are marked for you." },
  },
  {
    id: "fallen", name: "The Fallen", color: "§4", count: 7,
    blurb: "The last words of the great enemies of the land, taken from them when they fell.",
    reward: { sp: 5, renown: 120, flag: "col_fallen", text: "Seven enemies, seven confessions. Not one of them chose to be what they became. Remember that at the throne." },
  },
];

// Library milestones: total tomes shelved in one Library. Claimed once per player.
export const MILESTONES = [
  { at: 5, name: "Reading Room", items: ["siege:ledger"], sp: 1, text: "Five tomes. It's a shelf with ambitions." },
  { at: 10, name: "Study", items: ["siege:cipher_wheel"], sp: 1, text: "Ten tomes. Between two of them you find a brass Cipher Wheel someone used as a bookmark. Carry it and ciphered letters read plainly." },
  { at: 25, name: "Library", items: ["siege:mirror_glass"], sp: 2, text: "Twenty-five tomes. A sliver of Tide Glass falls out of a binding. Carry it and the Hollow's right-to-left writing reads plainly." },
  { at: 40, name: "Archive", items: [], sp: 2, text: "Forty tomes. Scholars would cross the kingdom for this, if there were any scholars left." },
  { at: 60, name: "Great Archive", items: [], sp: 3, text: "Sixty tomes. The Order's own archive holds fewer." },
  { at: 74, name: "The Unburned Library", items: [], sp: 5, flag: "loremaster", text: "Every tome in Aldmere. Everything they burned, you put back. You are Loremaster." },
];

// ---------- Places the lore points at ----------
// Mateo (or the map thread) marks each one by standing there and running
//   /scriptevent siege:lore_mark_place <id>
// charted: true means the Ledger may show heading and distance once the place is marked.
// Mystery places stay descriptions only: the player has to work out where they are.
export const PLACES = {
  millbrook: { name: "Millbrook", region: "Aldmere Vale", charted: true, desc: "A mill village in the Vale where it is always night and every clock reads the same minute." },
  millbrook_clocktower: { name: "Millbrook Clock Tower", region: "Aldmere Vale", charted: false, desc: "The tallest thing in Millbrook. One of six clocks." },
  millbrook_well: { name: "The Well at Millbrook", region: "Aldmere Vale", charted: false, desc: "The well in Millbrook square. People who hear the bell say it comes from down there." },
  crownhold: { name: "Crownhold", region: "Aldmere Vale", charted: true, desc: "The ruined capital. The Hall of Bells has no bells left hanging." },
  corvins_tower: { name: "Corvin's Tower", region: "Aldmere Vale", charted: false, desc: "A roofless tower in the hills above the Vale. Look for an empty bell frame against the sky." },
  bellhollow: { name: "Bellhollow", region: "Aldmere Vale", charted: false, desc: "A valley with a broken bell frame and a roadside shrine where pilgrims leave their bells outside." },
  ashen_chapterhouse: { name: "Chapterhouse of the Ashen Gate", region: "Aldmere Vale", charted: true, desc: "The last house of the Order. Grey banners, cold hearths." },
  burned_archive: { name: "The Burned Archive", region: "Aldmere Vale", charted: false, desc: "Somewhere under the chapterhouse. Brother Cael knows the way, if he decides to trust you." },
  hollowfast: { name: "Rimehold", region: "Frostmarch", charted: true, desc: "A northern longhouse village, half empty for three hundred years." },
  frozen_lake: { name: "The Lake at Rimehold", region: "Frostmarch", charted: false, desc: "Footprints led out to the middle and stopped. A shrine on the shore is carved with a full moon." },
  gulls_rest: { name: "Gull's Rest", region: "Saltreach", charted: true, desc: "A fishing village under a lighthouse whose lamp has never gone out." },
  lighthouse: { name: "The Lighthouse at Gull's Rest", region: "Saltreach", charted: false, desc: "The keeper is in the lamp room. He is always in the lamp room." },
  sunken_chapel: { name: "Chapel of Saint Brannoc", region: "Saltreach", charted: false, desc: "Under the sea off Gull's Rest. Its tower shows above the water only when the moon is dark." },
  sunscar: { name: "Sunscar", region: "Emberwaste", charted: true, desc: "A desert fortress town where every statue has had its face removed." },
  faceless_vault: { name: "The Faceless Vault", region: "Emberwaste", charted: false, desc: "Under Sunscar. It opens for someone who can rebuild a king's face." },
  mirelight: { name: "Mirelight", region: "Blackfen", charted: true, desc: "Huts on stilts and hanging lanterns. Some of the villagers have lost days." },
  mags_hut: { name: "Old Mag's Hut", region: "Blackfen", charted: false, desc: "Past the last lantern of Mirelight, where the frogs stop singing." },
  drowned_chapel: { name: "The Drowned Chapel", region: "Saltreach", charted: false, desc: "A thin place. The caves under the sunken chapel of Saint Brannoc, up on the chalk cliffs of the north coast, a long way west of Rimehold." },
  bellfounders_mine: { name: "The Bellfounders' Mine", region: "Frostmarch", charted: false, desc: "A thin place. Where Queen Maelis dug the bronze for the Founding Bell, up where the Vale climbs into the snow, far east of Millbrook." },
  kings_barrow: { name: "King's Barrow", region: "Blackfen", charted: false, desc: "A thin place. The royal burial mound, with birches growing over it, where the Vale gives way to the fen, south and a little east of Kingsrest." },
  saltglass_grotto: { name: "The Saltglass Grotto", region: "Emberwaste", charted: false, desc: "A thin place. A cave of fused salt out on the flats, south-east of Sunscar." },
  frostvein_hollow: { name: "Frostvein Gap", region: "Frostmarch", charted: false, desc: "A thin place. An ice cave in the far north, west of Rimehold." },
  sunken_quarry: { name: "The Sunken Quarry", region: "Emberwaste", charted: false, desc: "A thin place. A flooded quarry pit in the badlands, far to the south of Sunscar." },
  witchroot_caves: { name: "The Witchroot Caves", region: "Blackfen", charted: false, desc: "A thin place. Caves under the swamp, hung with roots, a short walk west of Mirelight." },
  cinder_roost: { name: "The Cinder Roost", region: "Emberwaste", charted: true, desc: "A rider school cut into the cliff above Sunscar. Its gate is past the Span, and the names of the fallen are on its wall." },
  deepforge: { name: "The Deepforge", region: "Frostmarch", charted: true, desc: "A forge under the mountain above Rimehold. Its fire has burned for four hundred years." },
  harbour_office: { name: "The Harbour Office", region: "Saltreach", charted: true, desc: "On the quay at Gull's Rest. The Debt Book is chained to the desk." },
  cradle_tree: { name: "The Cradle Tree", region: "Blackfen", charted: false, desc: "A great old tree in the fen, south of Mirelight. There is a cave under it, and the lantern keepers will not walk past it after dark." },
  nell_raft: { name: "Nell Sedge's Raft-house", region: "Blackfen", charted: false, desc: "Moored in the reeds past Mirelight, further out than anyone else lives." },
};

// ---------- The seven thin places ----------
// One of them holds the real Source and the Rift (world property "hc:source_site", picked by
// the Hollow feature). Each has a unique mix of six features. BUILD EACH SITE TO MATCH:
// the six Surveyor's Field Notes each state one feature of the real site.
//                         water  bell  worked cold  salt  roots
export const SITE_FEATURES = {
  drowned_chapel:    [true,  true,  true,  false, true,  false],
  bellfounders_mine: [false, true,  true,  true,  false, false],
  kings_barrow:      [false, false, true,  false, false, true],
  saltglass_grotto:  [false, false, false, false, true,  false],
  frostvein_hollow:  [false, false, false, true,  false, false],
  sunken_quarry:     [true,  false, true,  false, false, false],
  witchroot_caves:   [true,  false, false, false, false, true],
};
export const SITE_IDS = Object.keys(SITE_FEATURES);

export const FEATURE_NAMES = ["Water", "Bells", "Hands", "Cold", "Salt", "Roots"];

// What Field Notes n says when feature n is [true, false] at the real site.
export const SURVEY_LINES = [
  [
    "To reach the crack I had to swim. The way in lies under water, and I held my breath for most of a minute before I came up into air again.",
    "I reached the crack with dry boots. There is no water to cross on the way in: not a pool, not a stream.",
  ],
  [
    "Near the mouth of the place lies an old bronze bell, green and cracked. Men hung a bell here once. I did not touch it.",
    "There is no bell at this place and there never was one. No frame, no rope, no bronze. That surprised me.",
  ],
  [
    "Hands made this place. The walls are cut square and there are tool marks in the stone. Someone dug it, or built it, long before the crack came.",
    "No hand ever shaped this place. It is a natural cave: no tool marks, no cut stone, no steps. The rock made it by itself.",
  ],
  [
    "My ink froze twice while I wrote this. There is ice at the mouth of the place and snow outside it.",
    "The place is not cold. No ice, no snow. I worked in my shirt sleeves.",
  ],
  [
    "I can taste salt on the air here, and my lips are cracked from it. Salt on the walls, salt on the wind.",
    "The air is sweet. No salt on the walls, no taste of salt on the wind.",
  ],
  [
    "Roots hang down over the way in, thick as my arm, and trees grow above it. I had to cut my way through.",
    "Nothing grows at the mouth of this place. Bare rock, no roots, no trees above.",
  ],
];

// ---------- Mystery threads ----------
// The Ledger of Whispers records every clue word for word. When a player has enough clues they
// may answer the thread's question. Text answers are typed, so they can't be guessed from a list.
// must: clues that have to be found before the question (and its answer choices) is ever shown,
//       so a late twist can't be read off the options early.
// kind: "text" (accept = allowed answers, compared without spaces, punctuation or case)
//       "choice" (options, answer = index)   "library" (solved in the Library, not the Ledger)
export const THREADS = [
  {
    id: "old_journal", name: "The Old King's Journal", need: 3,
    intro: "You have always had this journal. Someone scraped the owner's name off the cover.",
    clues: {
      journal_signed_a: "The journal's last entry is signed only \"A., by grace King\". He ruled at least thirty years and never learned what was happening to his kingdom.",
      journal_son: "The journal: \"My son is nine, grey-eyed, quick with his right hand and quicker to laugh.\" He left the book to that son.",
      missing_king_exists: "Quill's Chronicle records the crowning of \"Oswin son of Aldric\", who \"was tall and grey-eyed and favored his right hand in all things, and laughed easily\".",
      wren_knows_journal: "Sister Wren: \"The knights burned every book that king ever touched. Whoever put that one in your pack wanted it to outlive them.\"",
    },
    kind: "text",
    question: "Which king wrote the journal you carry?",
    accept: ["aldric", "kingaldric", "aldricofaldmere"],
    solved: "Aldric, the father of the king nobody will name. He watched the wells turn salt and the nights grow long, and fought it with silver, bricks and silence. The fearless boy with his ear to the cellar wall grew up and did something else. You still do not know who gave you the book.",
    sp: 1,
  },
  {
    id: "where_was_i", name: "Where Was I?", need: 2,
    intro: "For nine heartbeats you were somewhere else.",
    clues: {
      slip_first: "In Sister Wren's chapel, the chapel went away. You stood ankle-deep in black water in the street of a town you have never seen: leaning towers, a moon in the wrong place, people standing with their faces to a wall, humming. Then you were back in the chair, wet to the skin. Where were you? Why did it let you go?",
      undertow_named: "Quill: the mage warned of \"the Hollow beneath, which he said lay under Aldmere as cold water lies under ice, and was no part of our world at all.\"",
      undertow_mirror: "Corvin: \"It is not a copy of ours. Its streets are black water and its towers lean. Its people stand facing the walls. I call it the Hollow.\"",
      lost_face_walls: "Corvin: a returned shape \"turns and faces the wall, toward wherever the Hollow is seeping in nearest.\"",
    },
    kind: "text",
    question: "You have been there. What is that place called?",
    accept: ["hollow", "thehollow", "thehollowbeneath"],
    solved: "The Hollow: another world under this one, older than Aldmere, drowned, and leaking upward. You Slipped into it and it let you go. It does not let everyone go. You still don't know why it took you.",
    sp: 1,
  },
  {
    id: "lost_days", name: "The Lost Days", need: 3,
    intro: "People vanish for a night and come back wrong.",
    clues: {
      lost_wrong_hand_order: "The Order's standing orders: a returned person \"favors the wrong hand, avoids bells, or faces walls when they believe themselves alone.\"",
      lost_avoid_bells: "The Order forbids ringing a bell near the Returned: \"It calls them home, and they will go, and sometimes they take others with them.\"",
      lost_wrong_hand_corvin: "Corvin: \"The Hollow sends back a shape. It wears the body like another man's glove, and it favors the wrong hand.\"",
      lost_face_walls: "Corvin: \"It turns and faces the wall, toward wherever the Hollow is seeping in nearest.\"",
      lost_wrong_hand_tobin: "Little Wren Ashby wrote that her brother Tobin \"eats with his left hand now.\"",
      lost_face_walls2: "Wren Ashby: \"He was standing in the corner facing the wall and humming.\"",
      lost_avoid_bells2: "Hollow scripture: \"Do not ring for the shape. If you ring, it comes home.\"",
      changeling_voice: "A statement by 'Dora Penrow': \"Why does the dog not know me.\"",
      hollowfast_footprints: "Hild Ashby: half of Rimehold walked onto the lake, humming. \"Just footprints that stop.\"",
      mother_makes_shapes: "The Mother of Changelings: \"The Choir takes and I fill the hole.\"",
    },
    kind: "choice",
    question: "What are the people who come back from a Lost Day?",
    options: [
      "The same people, only tired and frightened",
      "The dead, raised by a necromancer",
      "Shapes sent up from the Hollow to fill the place of someone the Choir took",
      "Spies of the Order of the Ashen Gate",
      "Villagers under a witch's curse",
    ],
    answer: 2,
    solved: "The Returned are shapes the Hollow sends up. The real person is in the Choir. Wrong hand, faces the wall, fears a bell: three tells, and a bell will send one home.",
    sp: 2,
  },
  {
    id: "stopped_clocks", name: "The Stopped Clocks", need: 2,
    intro: "Every clock in Millbrook reads the same minute.",
    clues: {
      minute_317: "Quill's Chronicle: \"At seventeen minutes past the third hour every bell in Aldmere rang once by itself.\"",
      clocks_reeve_stopped: "Reeve Tock: \"I stopped every clock in Millbrook at that minute. If the minute never ends, the toll never finishes.\"",
      clocks_one_original: "Reeve Tock: \"Only one of them is the clock I stopped first, and that is the one that matters.\"",
      reeve_held_minute: "The Reeve's Ledger: \"When someone finally stops me, the minute will end, the bell will finish its stroke, and the well will open.\"",
    },
    kind: "text",
    question: "At what time did the clocks of Millbrook stop? (hour and minute, like 9:45)",
    accept: ["317", "0317", "3:17", "seventeenpastthree", "seventeenminutespastthree", "threeseventeen"],
    solved: "3:17. The minute the bell first tolled after the war. The Reeve stopped time in Millbrook to keep the bell from finishing its stroke.",
    sp: 2,
  },
  {
    id: "missing_king", name: "The Missing King", need: 4, must: ["oswin_overthrown"],
    intro: "No portrait, statue or record of the last king exists anywhere.",
    clues: {
      missing_king_exists: "Quill's Chronicle records the crowning of \"Oswin son of Aldric\". The Order says there was never any such king.",
      missing_king_bargain: "Quill: the King \"struck a bargain with the powers below. He would not let me write its terms.\"",
      empty_tomb: "Quill carried the King's coffin: \"It was too light.\"",
      name_forbidden: "The Regent ordered that her father's name \"be spoken no more in any hall in Aldmere, so that nothing below can hear it and answer.\"",
      records_burned: "The Order's inventory: \"portraits of the late king, forty-one\", burned.",
      missing_king_erased: "The unsent letter: \"Let them call me Ashe. Let Edda be ash.\"",
      oswin_overthrown: "The unsent letter: \"We took him on the walls. I put him through the Crack with my own hands, alive.\"",
      oswin_overthrown_witness: "Corvin: \"The lords came for him on a third night. The princess was with them. He did not draw his sword.\"",
      oswin_from_sea: "The lighthouse keeper saw a man walk out of the sea at dawn, wearing a crown, sword in his left hand.",
      voice_in_rock: "Warden Dunmore: \"The sentries still say they hear a man's voice in the rock on the third night, asking for his daughter.\"",
    },
    kind: "choice",
    question: "What became of King Oswin?",
    options: [
      "He lies in his tomb at King's Barrow",
      "The mage Corvin dragged him below against his will",
      "There never was a King Oswin",
      "He fell at Bellhollow fighting the Grey Host",
      "His own daughter and the lords overthrew him and cast him alive through the Crack",
    ],
    answer: 4,
    solved: "Oswin was overthrown by his daughter and the lords of Aldmere, and thrown alive into the Hollow. The tomb is empty because he was never buried. Nobody above knows what became of him down there.",
    sp: 3,
  },
  {
    id: "saint_ashe", name: "The Saint of the Gate", need: 2,
    intro: "The Order was founded by Saint Ashe, a shepherd's daughter. Or so they say.",
    clues: {
      ashe_mark_edda: "Quill: Princess Edda \"bore on her left palm a grey mark like a smudge of soot\", and was called the little Ash.",
      ashe_mark_saint: "The Life of Saint Ashe: \"She bore a grey mark on her left palm.\"",
      ashe_keeps_door: "The King to his daughter at Bellhollow: \"You will keep the door, little Ash.\"",
      ashe_is_edda: "The unsent letter: \"I was not a shepherd's daughter. I was his daughter.\"",
    },
    kind: "text",
    question: "What was Saint Ashe's true name?",
    accept: ["edda", "princessedda", "eddaofaldmere"],
    solved: "Saint Ashe was Princess Edda, Oswin's daughter. She founded the Order to keep the door shut on her own father, and burned her own name with his.",
    sp: 2,
  },
  {
    id: "bell_beneath", name: "The Bell Beneath", need: 3,
    intro: "On siege nights a bell rings faintly underground.",
    clues: {
      toll_every_third: "Sir Gerrit: the Grey Host \"attacked on every third night and never between\", listening for a bell under the ice.",
      bell_beneath_heard: "Quill, at the siege of Crownhold: \"a bell rang somewhere under the city, and none of our bell-wardens could find it.\"",
      toll_order_knows: "The Grandmaster: \"Every thing with a grudge or an empty head hears the call and marches in their place, on whatever burns brightest.\"",
      order_watches_keeps: "The Rule of the Gate: \"where the walls are highest the Hollow listens hardest.\"",
      toll_choir_side: "Scripture: \"They are not ours. They are only answering. We are the bell. They are the echo.\"",
      choir_feeds_on_held_ground: "Scripture: \"Every keep is a lantern. Every lantern is a meal.\"",
      victory_draws_more: "Scripture: \"When you win, you burn brighter still. We are grateful. We send more.\"",
      hollow_bell: "Corvin: \"They have rung it every third night since, to ask whether anyone is listening.\"",
      third_night_no_bells: "Quill: the King commanded that \"on every third night no bell should be rung anywhere in Aldmere.\"",
      truce_terms: "Corvin: \"Every third night belongs to the Hollow.\"",
      truce_broken_order: "The Grandmaster: \"They cannot come up to collect it now. So on their night they call instead.\"",
      warlord_is_vorlund: "Vorlund: \"Every third night it tells me where to march. I have never once chosen where to go.\"",
    },
    kind: "choice",
    question: "Why does an army march on your keep every third night?",
    options: [
      "The Warlord King wants your land",
      "The Order of the Ashen Gate sends them to test the keeps",
      "The third night was promised to the Hollow. Shut out, it calls on that night, and anything angry or empty marches for it on the brightest keep",
      "The raider factions made a pact to take turns",
      "It is a curse laid by the mage Corvin",
    ],
    answer: 2,
    solved: "The raiders don't know each other. They are all answering the same call, on the night that was promised to the Hollow. The better you hold your keep, the brighter it burns, and the harder the Hollow calls.",
    sp: 3,
  },
  {
    id: "wrong_moon", name: "The Wrong Moon", need: 2,
    intro: "Some doors only open on certain nights.",
    clues: {
      wrong_moon_rule: "Corvin: \"What the carving shows, the sky must not.\"",
      shrine_full_moon: "Hild Ashby: the lake shrine is carved with a full moon. \"It is the other one you want.\"",
      ice_door_dark_reflection: "Seen at the Rimehold lake: no moon in the sky, but a full white moon in the ice. Then the ice opened like a door.",
      dark_moon_low_tide: "The keeper: the sea draws back furthest \"on the night the moon is dark\".",
      undertow_mirror: "Corvin: the Hollow has \"its own towns and roads, and no sky at all\", and it seeps up \"wherever the ice is thin\".",
      undertow_named: "Quill: the mage warned of \"the Hollow beneath, which he said lay under Aldmere as cold water lies under ice, and was no part of our world at all.\"",
      mirror_hollowfast: "The Huntsman: \"Below the ice there is a town. It is not Rimehold. No sky, and a moon all the same.\"",
    },
    kind: "choice",
    question: "A door between the worlds is carved with a FULL moon. When will it open?",
    options: [
      "On the night of the full moon",
      "On the night of the new (dark) moon",
      "At noon on any day",
      "Only on a siege night",
      "On a half moon",
    ],
    answer: 1,
    solved: "The Hollow has its own moon, and it keeps the opposite time to ours. Doors between the worlds obey their moon: a full moon carved on a door means it opens when our sky is dark and theirs is full.",
    sp: 2,
  },
  {
    id: "the_ember", name: "The Ember", need: 2,
    intro: "Something pale and humming fell from the sky after a siege was won.",
    clues: {
      ember_prophecy: "Grandmaster Ilric: \"when the keeps burn brightest, a shard of the crown will break loose and fall toward the brightest of all.\"",
      ember_names: "The farmer: \"It whispered names. Tamsin Reed. Aldo Kettle. Little Jory Fenn. Nobody by those names lives anywhere near.\"",
      ember_is_shard: "Scripture: \"A splinter of the crown breaks loose to find it. A hand that takes it hears us.\"",
      founding_bell: "Corvin: Queen Maelis cast the Founding Bell and \"rang it once, and the marsh went quiet\".",
      crown_marked: "Corvin: the truce was sworn on the Hollow's own crown. \"They broke a splinter from it and gave it to him as their pledge.\"",
    },
    kind: "choice",
    question: "What is the Ember?",
    options: [
      "A fallen star",
      "The soul of the mage Corvin",
      "A weapon forged by the Order",
      "A splinter of the Hollow's own crown, sent up from below to find the brightest keep",
      "The egg of something",
    ],
    answer: 3,
    solved: "The Ember is a splinter of the Hollow's crown, the one the truce was sworn on. Something below sent it up to find the brightest keep in the land, which was yours. The names it whispers are people the Hollow means to call next.",
    sp: 2,
  },
  {
    id: "warlord", name: "The King of Raiders", need: 1,
    intro: "The Warlord King has been killed eleven times in a century.",
    clues: {
      warlord_is_vorlund: "\"I was Thane of the Ice Isles. I led the Grey Host.\"",
    },
    kind: "text",
    question: "What was the Warlord King's name, when he was a man?",
    accept: ["vorlund", "thanevorlund", "vorlundoftheiceisles", "vorlundthaneoftheiceisles"],
    solved: "Vorlund, Thane of the Ice Isles, who brought the Grey Host to Aldmere three hundred years ago. The Choir swallowed his army and kept him as its hound.",
    sp: 2,
  },
  {
    id: "the_crown", name: "The Broken Truce", need: 4, must: ["truce_broken_edda"],
    intro: "The King made a bargain below. What was it, and what became of it?",
    clues: {
      missing_king_bargain: "Quill: the King \"struck a bargain with the powers below. He would not let me write its terms.\"",
      third_night_no_bells: "Quill: the King's first command was that \"on every third night no bell should be rung anywhere in Aldmere.\"",
      truce_terms: "Corvin: \"Every third night belongs to the Hollow. The people of the Hollow may walk above as guests, and any of ours who wish to walk below may go.\"",
      oswin_treaty_witness: "Corvin, who was there: \"By the end of the night they had a truce. The Hollow reached up and took the Grey Host. It was a signature.\"",
      truce_broken_order: "The Grandmaster: \"It was agreed and sealed, and we broke it.\"",
      truce_broken_edda: "The unsent letter: \"We rang every bell in Aldmere on a third night, and they came up in their fury, as we knew they would.\"",
      gate_made_by_bell: "Corvin: the Founding Bell \"tore every thin place shut at once and left a single wound in the rock. They are behind it now.\"",
      debt_collected: "Corvin's last page: \"We broke the truce, not they. Every army that marches on the third night is a debt being collected.\"",
      lost_wrong_hand_king: "Quill: after the war the King \"wrote, and ate, and drew his sword with his left.\"",
      lost_wrong_hand_king2: "The lighthouse keeper: the crowned man from the sea \"was holding his sword in his left hand.\"",
    },
    kind: "choice",
    question: "What was the King's bargain, and what became of it?",
    options: [
      "He sold his crown to the Hollow, and the price was never paid",
      "There was no bargain. Heaven sent a miracle in answer to prayer",
      "A truce: the Hollow took the Grey Host and was given every third night. His own people overthrew him and broke it, and the Hollow has been collecting ever since",
      "The mage Corvin destroyed the Grey Host with his bells",
      "He promised the Hollow his daughter, and she refused to go",
    ],
    answer: 2,
    solved: "The Truce of the Third Night. Oswin gave the Hollow every third night in exchange for the Grey Host. Aldmere overthrew him and broke it, beat the Hollow at Bellhollow, and shut it behind the Gate. It cannot come back through, so on its night it calls, and something always answers. Your sieges are a debt.",
    sp: 4,
  },
  {
    id: "the_name", name: "The Name We Were", need: 2,
    intro: "This land was not always called Aldmere.",
    clues: {
      hollowmere_old_name: "Quill: Queen Maelis \"raised Aldmere out of the marsh that the old people called\" by another name.",
      third_way_truce: "Corvin's last page: \"The truce was sworn on their crown, and a thing sworn can be sworn again.\"",
      choir_is_people: "Corvin: \"The Choir is a people. They have streets and trades and children.\"",
      mag_is_apprentice: "Old Mag: \"I was the mage Corvin's last apprentice, and I was twelve when they burned him.\"",
      maelis_rang_out: "Scripture: \"A queen came with a bell. She rang us out, and named what was left Aldmere.\"",
      choir_true_name: "Scripture: \"Say the old name and we will know that you remember too. It was both of ours.\"",
      third_way_confirmed: "The Last Testament: \"Or do the thing I could not make my own child do, and keep the truce.\"",
    },
    kind: "text",
    question: "What was this land called when the two worlds first met?",
    accept: ["hallowmere", "hollowmere", "thehallowmere", "thehollowmere"],
    solved: "Hallowmere: the marsh where the Hollow first ran aground on our world, and for a while a kingdom that belonged to both. Say the old name at the throne and offer the truce again, and there is a third way to end this.",
    sp: 5,
    flag: "true_name",
  },
  {
    id: "keepers_light", name: "The Keeper's Light", need: 3,
    intro: "The lamp at Gull's Rest has not gone out in three hundred years.",
    clues: {
      annet_sea_went_out: "Elias: \"The night the sea went out you ran down to the strand. And then the sea came back all at once.\"",
      annet_sings: "Elias: \"I hear singing on the third night, coming up through the water. One of the voices is yours.\"",
      annet_register_false: "Elias: the Order wrote in the parish register that Annet \"died of a fever in the spring.\" She did not.",
      lamp_draws_them: "Annet, in a dream: \"Elias, stop lighting the lamp. It is how they find the shore.\"",
      sunken_address: "Elias: \"Chapel of Saint Brannoc, under the sea. Third pew from the drowned altar. Under the floor stone carved with a gull.\"",
      elias_is_echo: "Elias: \"I think I may have gone down with her that night and only my habit came back up.\"",
      annet_forgives: "Annet: \"He thinks he is guiding me home. He is guiding them.\"",
    },
    kind: "choice",
    question: "Why do things come up the beach at Gull's Rest on the third night?",
    options: [
      "The tide washes them in",
      "The keeper's lamp shows the Choir's creatures where the shore is",
      "The villagers summon them",
      "The Drowned Bride leads them out of spite",
      "They are hunting the keeper's letters",
    ],
    answer: 1,
    solved: "Elias lights the lamp so Annet can find her way home. Every night it shows the Choir the shore instead. She has been begging him to put it out for three hundred years.",
    sp: 2,
  },
  {
    id: "faceless", name: "The Faceless Statues", need: 2,
    intro: "Every statue in Sunscar has had its face removed.",
    clues: {
      faces_order: "The Order's inventory: \"the royal statues at Sunscar. The faces are to be removed and the fragments scattered.\"",
      faces_seneschal: "Lord Sorrel: \"I took the faces off one by one with a mason's chisel.\"",
      records_burned: "The Order's inventory: \"portraits of the late king, forty-one\", burned.",
      missing_king_exists: "Quill: the King was \"tall and grey-eyed and favored his right hand in all things, and laughed easily.\"",
    },
    kind: "text",
    question: "Whose face was on every statue in Sunscar?",
    accept: ["oswin", "kingoswin", "oswinthelast", "kingoswinthelast", "oswinsonofaldric", "thelastking"],
    solved: "Forty statues of King Oswin, at every age. His own Seneschal chiselled the faces off so that the last hands on them would be gentle. It cost him his own.",
    sp: 2,
  },
  {
    id: "who_leads", name: "Who Is Morvane?", need: 4, must: ["leader_is_ours"],
    intro: "The Hollow answers to someone it calls Morvane. Nobody above knows who, or what, that is.",
    clues: {
      leader_five_lords: "Corvin: \"They have lords: I counted five voices that the others fall silent for.\"",
      warlord_is_vorlund: "Vorlund: \"Every third night Morvane tells me where to march. I have never seen him. I know the voice.\"",
      leader_unknown: "Corvin's last page: \"There will be someone leading them by now. Grief makes kings quickly. I do not know who, and I am afraid to guess.\"",
      voice_in_rock: "Warden Dunmore: \"a man's voice in the rock on the third night, asking for his daughter.\"",
      oswin_overthrown: "The unsent letter: \"I put him through the Crack with my own hands, alive.\"",
      leader_is_ours: "The Choir: \"We named him ourselves: Morvane. The name he had before, you burned. He sits with us now. He taught us your walls.\" So Morvane was one of ours.",
      no_body: "Brother Cael: the Order listed forty-one burned portraits and the lamp oil it used that week. It never paid for a coffin, a shroud or a grave for the king.",
      named_by_them: "Sigrun: those below have no names. If there is a name down there, they made it for somebody who came to them having lost his own.",
      walked_in: "Old Mag, who was there: \"She didn't throw him. He asked them to cut the rope, and he walked in. Upright. No scream. No fall.\"",
      leader_is_oswin: "\"I was the only one of yours who had ever kept his word to them, so they made me their voice.\"",
    },
    kind: "text",
    question: "Who was Morvane, before the Hollow gave him that name?",
    accept: ["oswin", "kingoswin", "oswinthelast", "kingoswinthelast", "thelastking", "theoverthrownking", "oswinsonofaldric"],
    solved: "Morvane was Oswin, the last King of Aldmere. His daughter threw him into the Hollow alive, and the Hollow crowned its one faithful human and gave him a new name. Every siege for three hundred years has been his.",
    sp: 5,
  },
  {
    id: "source", name: "The Wandering Gate", need: 6,
    intro: "The Gate is not where the Order sealed it. Seven thin places. One door.",
    clues: {
      rift_moves: "Warden Dunmore: \"The Seal at Bellhollow now stands over solid rock. The Gate has moved.\"",
      seven_thin_places: "Corvin lists seven thin places: the Drowned Chapel, the Bellfounders' Mine, King's Barrow, the Saltglass Grotto, Frostvein Gap, the Sunken Quarry, the Witchroot Caves.",
      fennick_went_back: "Fennick: \"Go to your Library and name the place. Do not go there first.\"",
      source_clue_0: "{SURVEY0}",
      source_clue_1: "{SURVEY1}",
      source_clue_2: "{SURVEY2}",
      source_clue_3: "{SURVEY3}",
      source_clue_4: "{SURVEY4}",
      source_clue_5: "{SURVEY5}",
    },
    kind: "library",
    question: "Which thin place holds the Gate?",
    solved: "You named the thin place. The crack in its wall is the Rift, the way into the Hollow.",
    sp: 4,
  },
];
