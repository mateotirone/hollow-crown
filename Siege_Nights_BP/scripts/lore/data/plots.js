// Local lore: every one of the twelve settlement plots has its own past, its own three books (the
// "Papers" of that place) and its own small mystery, and each opens a different door into the main story.
// Mateo, 2026-11-10: "every settlement town needs its own internal lore and libraries", "so the game is
// playable differently 12 times". Pure data, no Minecraft imports. Keys are the plot names in plots/config.js.
//
//   was      what stood here before the player, shown the moment they arrive
//   angle    which strand of the main story this plot opens onto (builder note, never shown)
//   lead     the first place this plot's books point to (a place id from data/world.js)
//   build    what the map builder should leave on the plot so the books are true
//   tomes    three local books: the first is under the Plot Stone on arrival, the second turns up when
//            the settlement becomes a Town, the third when it becomes a City
//   mystery  a Ledger page only this plot's people get; two of the three books answer it
//
// None of these names who Morvane was. They are small true things the Order did not think worth burning.

import { wrenPage, REGION_BOSS, PLOT_REGION } from "./spine.js";

const P = (title, author, pages, hint) => ({ title, author, pages, hint });

export const PLOT_LORE = {
  Harrowford: {
    was: "A ferry crossed the Alder here for two hundred years. The ferryman's post is still in the bank. The meadow grows over rusted spearheads, thousands of them, and not one bone.",
    angle: "The night the Grey Host was taken (the Truce of the Third Night).",
    lead: "bellhollow",
    build: "A rotted ferry post at the river bank. Rusted iron (iron bars, anvils sunk in grass) scattered through the meadow, no skeletons anywhere.",
    tomes: [
      P("The Ferryman's Tally", "Ned Harrow, ferryman at the Alder ford", [
        "Fares taken, by my own count. A penny a head, a ha'penny for a beast, soldiers free by the King's order, which is how a ferryman starves.\n\nIn the week before Midwinter I carried no one, for the grey men from the Isles had the far bank and wanted no boat. I counted their fires instead. Eleven hundred fires.",
        "On the night it ended I was awake, for a ferryman sleeps light. Their fires were burning. I heard them singing their ugly songs. The chapel clock across the water struck three, and a little after it the singing stopped in the middle of a word.\n\nIn the morning there were eleven hundred fires still burning and nobody at any of them.",
      ], "A river ford keeps count of everyone who crosses. Ask what it counted the night nobody did."),
      P("What the Plough Turns Up", "Kept by the Harrow family, three generations", [
        "My grandfather started this list and I keep it out of stubbornness. Things the plough has turned up in the ford meadow: spearheads, 2,140. Axe heads, 611. Buckles, more than I will count. Helmets, 97. A cooking pot with the porridge burned on.\n\nBones: none. Not a tooth.",
        "A knight of the Gate came and told us the Host drowned at the ford and the river took the bodies. I have lived on this river all my life. It does not take a man's body and leave his belt buckle lying on the grass, done up.\n\nHe paid us to stop ploughing that field. We took the money.",
      ], "Farmers by the Alder keep an odd list. It turns up when the farm grows into a town."),
      P("The Clock Across the Water", "A chapel warden, name scratched out", [
        "I am asked to swear to the hour. I will swear to it. I wound that clock myself every evening for thirty years and it has never lost a minute.\n\nIt stopped that night at seventeen minutes past three. I did not stop it. I have wound it every evening since, and every morning it reads seventeen past three again.",
        "I am told there is a village upriver where the reeve has stopped all six of his clocks at that same minute, on purpose, and will not say why. I am told not to mention it.\n\nI will say only this. Something was promised at that minute, and whatever heard the promise took its payment at once, and it took them whole. I think it has been coming back for the rest ever since.",
      ], "Somebody swore to the exact minute. A city's archive would have kept the oath."),
    ],
    mystery: {
      name: "The Field Without Bones", intro: "An army camped in your meadow. Its iron is still in the grass. Its dead are not.",
      clues: [
        "The ferryman: eleven hundred fires still burning in the morning, and nobody at any of them. The singing stopped in the middle of a word.",
        "The plough list: thousands of spearheads and buckles, done up, and not one bone.",
        "The chapel warden: the clock stopped at seventeen minutes past three, and reads it again every morning.",
      ],
      question: "At what time of night was the army at the ford taken? (as the clock reads it)",
      accept: ["317", "0317", "seventeenpastthree", "seventeenminutespastthree", "threeseventeen"],
      solved: "Seventeen minutes past three. The Grey Host did not drown and did not flee. It was taken, whole, in one minute, from your meadow. Somebody paid for that.",
    },
  },

  Oakmere: {
    was: "This was a king's hunting lodge once, deep in his own oakwood. The house is gone. The cellar is not: there is a flagstone with an iron ring somewhere under your feet, and the oaks lean a little away from it.",
    angle: "King Aldric and the journal every player carries. The crack under the Hall of Bells was not the only one: he found a second in his own hunting lodge.",
    lead: "kings_barrow",
    build: "Old oaks all leaning slightly outward from one spot. A mossy flagstone with an iron ring (a trapdoor) and a small empty stone cellar under it, facing a blank wall.",
    tomes: [
      P("The Forester's Book", "Rafe Aske, forester to the King", [
        "The King comes to the lodge more than a king should. He does not hunt. He says he came to be away from a cellar in the capital, and now he sits in ours, with a lamp and a red book, and he has had me take the bell off the lodge door.\n\nThe deer will not cross the east ride any more. I have not told him. I think he knows.",
        "He asked me today whether I ever hear singing in the wood. I said no, sire, only wind. He said, \"That is what I said too, at first,\" and wrote something down.\n\nHe has aged ten years in two. The boy is the only one who can make him laugh. The boy is nine and goes everywhere he should not.",
      ], "A forester notices what a court does not. His book never left the wood."),
      P("Orders for the Lodge at Oakmere", "The King's own hand, signed A.", [
        "To the steward. The cellar is to be kept locked and the key brought to me and no other. No bell is to be rung within the pale of the wood, for any reason, not for fire and not for my death.\n\nThe east wall of the cellar is not to be whitewashed again. I wish to see whether the damp makes the same shape a second time.",
        "To the steward, later. My son has found this cellar as he found the other, and has had the key from me. Do not take it from him and do not follow him down. He is not afraid, and a thing that is not afraid of it seems to trouble it.\n\nIf I should not come up one evening, burn nothing. Send the red book away with someone who cannot read it.\n\nA.",
      ], "Orders signed with a single letter. A town clerk would know the hand."),
      P("The Steward's Last Account", "Giles Lorimer, steward of Oakmere", [
        "The old King died in his bed in the capital, and they buried him under the birches with every honour. I was told to close the lodge.\n\nI went down to the cellar the once. There is nothing in it. A chair, a lamp hook, and a wall. But I will set down that the chair faces the wall, and that the stone of the floor is worn where his feet were.",
        "I did as he ordered. I burned nothing. The red book I gave to a pedlar who made his mark with a cross.\n\nThe young King came once more, the year he was crowned, and stood in the cellar an hour by himself. When he came up he said, \"He was right to listen. He was wrong to be frightened.\" Then he had the door stoned over, and I have not seen it since.",
      ], "The last steward closed the house. His account went to the city with the rest of the estate."),
    ],
    mystery: {
      name: "The Cellar in the Oakwood", intro: "There is a cellar under your settlement, and the trees lean away from it.",
      clues: [
        "The forester: the King sits in the cellar with a lamp and a red book, and has had the bell taken off the door.",
        "The orders are signed \"A.\", and speak of a red book and a son who has the key.",
        "The steward: the old King was buried under the birches. The chair in the cellar faces the wall.",
      ],
      question: "Which king sat in the cellar at Oakmere, listening?",
      accept: ["aldric", "kingaldric", "a"],
      solved: "King Aldric. The red book he carried down there is the journal in your pack. He came to Oakmere to get away from the crack under his own hall, and found the same frost on the same kind of wall. You have built your home on the second place he listened.",
    },
  },

  Thistledown: {
    was: "Sheep country. On the highest point of the down stands a timber frame, twice the height of a man, built to hold a bell. No bell has hung in it in living memory. The sheep graze facing it.",
    angle: "Corvin Hale the bell-mage, before the Order made him the villain.",
    lead: "corvins_tower",
    build: "An empty oak bell frame on the highest ground of the plot. Sheep. If possible, pens whose gates all open toward the frame.",
    tomes: [
      P("A Shepherd's Almanac", "Tam Burdock of Thistledown", [
        "Lambing good. Wool fair. A stranger has leased the top of the down from the parish for a shilling a year, a thin rude man who smells of tin. He has built a gallows up there, or so we thought, and then hung a bell in it.\n\nHe rings it at night. You do not hear it. The dogs do.",
        "Set down as a wonder: on the nights he rings, no ewe drops her lamb dead, and nothing comes over the fold wall. On the nights he is away, we lose two or three and find them with no mark on them.\n\nI asked him what the bell was for. He said, \"It is not FOR anything. It is a question. I am waiting to see who answers.\"",
      ], "Shepherds write down weather, wool, and anything strange. Start where the sheep are."),
      P("Parish Complaint Against the Tenant of the Down", "The vestry of Thistledown", [
        "That the tenant, one Hale, keeps a bell upon the common contrary to custom. That he rings it at no canonical hour. That he has been heard to speak upon the hilltop when no person is with him, and to wait, as a man waits for a reply.\n\nThat he was asked whether he spoke with devils and answered, \"No. With neighbours. You have had them under your feet since before there were kings and never once said good morning.\"",
        "Resolved, that the complaint be withdrawn. Sixteen households petitioned for him, the Burdocks first, on the ground that the flocks have never done so well.\n\nNoted by the clerk: the tenant has gone to court at the King's own summons. He left the frame and took the bell. He asked us to leave the frame standing, \"so they know where to look for me.\"",
      ], "A parish once tried to evict a man for ringing a bell. The paperwork survives in a town chest."),
      P("Taken Down by Order", "A knight-clerk of the Ashen Gate", [
        "Thistledown. The frame upon the down was raised by the traitor mage and is to be pulled down and burned.\n\nIt was not done. The men of the parish stood round it with shears and crooks and would not move. They say he came here two full years after the grey ships landed and could not have called what was already burning their barns.",
        "I have written that the frame was destroyed. It is easier than writing that sixteen shepherds know how to count.\n\nI record privately that when I stood under it the hair rose on my arms, and that my horse would not turn its back on the thing. Whatever he was asking, something is still considering its answer.",
      ], "The Order came for the bell frame. A city would have a copy of what its clerk really wrote."),
    ],
    mystery: {
      name: "The Empty Frame", intro: "There is a bell frame on your hill with no bell in it, and the sheep face it.",
      clues: [
        "The shepherd: a thin rude man who smells of tin hung a bell on the down. \"It is a question. I am waiting to see who answers.\"",
        "The vestry: the tenant's name was Hale. He was called to court by the King, and took the bell with him.",
        "The Order's clerk: \"the traitor mage\" came two full years after the grey ships landed.",
      ],
      question: "Who built the bell frame on the down?",
      accept: ["corvin", "corvinhale", "hale", "themage", "thebellmage"],
      solved: "Corvin Hale, before he was the King's mage and long before he was the Order's traitor. He was not calling anything down. He was the first person since the old queen's bell to say good morning.",
    },
  },

  Wrenfield: {
    was: "A royal summer house stood by Wren Water, with a jetty and a walled garden. The garden wall still stands to knee height. One apple tree has a letter cut into it, a child's knife-work, grown wide with the bark.",
    angle: "Princess Edda as a child: the girl who became Saint Ashe.",
    lead: "ashen_chapterhouse",
    build: "A knee-high ruined garden wall, the stumps of a jetty in the lake, one old apple (oak) tree with a sign or carved block reading E.",
    tomes: [
      P("A Governess's Daybook", "Mistress Aveline Thorpe", [
        "My charge is seven and has decided the lake is hers. She rowed to the island alone before breakfast and was not sorry.\n\nShe is the most truthful child I have taught, which is not the comfort it sounds. She cannot bear a thing to be half said. Yesterday she asked the chaplain what the bells are FOR, and would not take \"for God\" as an answer.",
        "Her father came for three days. They are very alike and neither of them knows it. He taught her to row properly. She taught him the names she has given the swans.\n\nShe asked him at supper why the household goes indoors every third night. He said, \"Because I have asked them to.\" She said, \"That is not a reason, that is an order.\" He laughed. I did not.",
      ], "A governess wrote down everything a small girl said. It never left the lake."),
      P("Lessons, in a Child's Hand", "E.", [
        "Copy out ten times: A KING KEEPS HIS WORD. A king keeps his word. A king keeps his word.\n\nI asked Papa who he gave his word to and he said some people a long way down. I asked if they were good people. He said they were people. I do not think that is an answer either.",
        "I have decided what I will be. I will be someone who says the true thing out loud even when everybody at the table goes quiet.\n\nPapa says that is a fine thing to be and a hard thing to live next to. I cut my letter in the apple tree so that it will remember I said it.\n\nE.",
      ], "A child's copybook, kept by a gardener's family. It surfaces when the place is a town again."),
      P("The Gardener's Deposition", "Given to a knight of the Ashen Gate, and not used", [
        "I am asked what I remember of the Saint as a child, for the Life that is being written of her. I remember she was not a saint. She was a small fierce girl who rowed a boat too big for her.\n\nI remember the last time she came, grown, in armour. She stood at the apple tree a long while with her hand on the letter.",
        "She said, \"I told him I would say the true thing out loud. He should not have been surprised.\" Then she said, \"Burn the house.\" We burned it.\n\nShe did not have us burn the tree. I have wondered about that every year since. The knight who wrote this down tells me it will not go in the Life.",
      ], "The Order asked an old gardener about its saint's childhood. A city's records keep what the Life left out."),
    ],
    mystery: {
      name: "The Letter in the Apple Tree", intro: "A child cut one letter into the old apple tree by your lake. Somebody later burned the house and spared the tree.",
      clues: [
        "The governess: a truthful, fierce child of seven, whose father the King taught her to row.",
        "The copybook is signed E. \"I will be someone who says the true thing out loud.\"",
        "The gardener: she came back grown, in armour, and they are writing a saint's Life of her.",
      ],
      question: "What was the name of the child who lived at the summer house?",
      accept: ["edda", "princessedda", "saintashe", "ashe", "queenedda"],
      solved: "Edda, the King's daughter. She kept the promise she cut into that tree, and it cost her father his throne and cost the land its peace. She spared the tree.",
    },
  },

  Rimeholt: {
    was: "A mining camp, older than the kingdom. The shelf you stand on is not natural: it is the spoil of hundreds of years of digging, levelled and grown over. There is green in the rock here, copper, and a cart road that runs up into the mountain and stops at a wall of ice.",
    angle: "Queen Maelis and the casting of the Founding Bell.",
    lead: "bellfounders_mine",
    build: "Copper ore showing in the cliff behind the plot. An overgrown cart road (coarse dirt, old rails) running uphill and ending at packed ice.",
    tomes: [
      P("The Mine Captain's Ledger", "Brand Holt, captain of the Queen's diggings", [
        "By the Queen's order we take copper and tin and nothing else. Silver we leave in the wall. Gold we leave in the wall. The men think her mad, and say so, and dig.\n\nShe wants forty tons. Nobody has ever cast forty tons of anything. Her founder says it must be one pour, without a seam, or it will ring false and be worse than no bell.",
        "The lower gallery sings. I do not mean it rings when struck. I mean that when the lamps are out there is a note in it, one note, held, as if the mountain had a breath and did not need to draw it.\n\nThe Queen came down herself to hear. She listened a long while and said, \"Good. Then I know what pitch to cast against.\"",
      ], "The oldest book in the north is an account of copper. It is where the copper was."),
      P("Founder's Notes for the Great Pour", "Master Ysolt, bell-founder to Queen Maelis", [
        "A bell does not make silence. Any fool knows that. But two notes a hair apart will eat each other, and where they meet there is a stillness you can stand in.\n\nThat is all the Queen is asking of me. One note, a hair off theirs, loud enough to cover a country. She calls it ringing the land quiet. I call it a wall you cannot see.",
        "I have told her what she will not hear. A wall keeps two sides apart. It does not make the other side go away, and it does not make them stop singing. It only means we will no longer hear them when they ask.\n\nShe said, \"Then cast it well, and nobody will ever need to.\" It is cast well. I am sorry for that, some nights.",
      ], "A bell-founder's notes went with the bronze. A town's smiths would have kept a copy."),
      P("Why We Left the Low Gallery", "The miners of Rimeholt, by their marks", [
        "After the great bell was rung the note in the low gallery stopped. The captain said good riddance. But a mine with a sound in it that suddenly has none is a worse thing to work in, and the men would not go below the third level.\n\nWe walled it with ice, which here is cheaper than stone and lasts as long.",
        "Set down so that our grandchildren know: we did not wall it because of what was in there. Nothing was in there. We walled it because of what it felt like after, which was a room where someone had been talking and had been shut out mid-sentence.\n\nIf it ever sings again, do not be frightened. Be ashamed, and then listen.",
      ], "Miners sealed their own best gallery and wrote down why. It took a city to dig the record out."),
    ],
    mystery: {
      name: "Forty Tons of Copper", intro: "A queen dug copper here and left the silver and gold in the wall.",
      clues: [
        "The mine captain: forty tons, one pour, without a seam, \"or it will ring false\".",
        "The founder: one note, a hair off theirs, loud enough to cover a country. \"She calls it ringing the land quiet.\"",
        "The miners: after the great bell was rung, the note in the low gallery stopped.",
      ],
      question: "What was cast from the copper of Rimeholt?",
      accept: ["thefoundingbell", "foundingbell", "abell", "bell", "thebell", "thegreatbell", "maelisbell"],
      solved: "The Founding Bell of Queen Maelis. It did not drive anything away. It was a wall of sound, cast a hair off the other world's own note, and your settlement stands on the spoil heap it was dug from.",
    },
  },

  Wolfcairn: {
    was: "A cairn stands on the plateau, taller than a house, every stone of it carried up by hand. The northerners who stayed behind built it and still add to it. There are wolves on the plateau and they will not go near it.",
    angle: "What called the Grey Host: the first use of the Calling.",
    lead: "frozen_lake",
    build: "A large cobblestone cairn (8 to 10 blocks tall) on the plateau edge. Wolves spawn nearby. Small stones (buttons, slabs) around its foot.",
    tomes: [
      P("The Stone-Count", "The cairn-wives of the plateau", [
        "One stone for each man who took ship. We do not carve names. A name is a thing you call someone back with, and we do not want to call.\n\nThe count stands at six thousand and four. We began it the spring after they sailed, when it was plain that sailing was all they were ever going to do of their own will.",
        "My mother kept the count before me. She said the men did not go for plunder. There was a good harvest that year and nobody was hungry.\n\nShe said my father got up from the table in the middle of his meat, took down his axe, and stood at the door with his head on one side like a dog that hears its name. He did not say goodbye. He did not seem to know we were there.",
      ], "The northerners count stones instead of writing names. Their count is kept at the cairn."),
      P("Saga of the Bell Under the Ice", "As the old women tell it", [
        "It was the hard winter. The sea froze from the Isles to the Teeth. And under the ice there came a sound like a bell struck a long way down, and it did not fade as a bell fades. It went on.\n\nThe children heard nothing. The old heard nothing. Only those who had ever killed a man heard it, and they heard it plain.",
        "Vorlund heard it loudest, for he had killed the most. He said, \"It wants us in the south.\" Somebody asked him what wanted it. He said, \"I do not know. I know the voice.\"\n\nSo runs the saga. We do not sing the ending, because there is none. They went south. Something there had wanted an army at a king's walls, and when the king had paid, it took its army back.",
      ], "A saga with no ending. It is sung where there is a hall big enough to sing it in."),
      P("A Letter Not Sent South", "Runa Ashby, to whoever rules there now", [
        "You call us raiders. You have built your whole history on it. I want it written once, by one of us, that we were the first people in your war to be taken.\n\nOur men were used. They were called like dogs and spent like coin. Whatever called them is the same thing that knocks on your walls every third night, and it learned how well it works from us.",
        "I am told one of your own now has the knack of that sound, or will. A southerner who can make the note that fetched six thousand men off their own hearths.\n\nTell that one this from the cairn-wives: we have six thousand and four stones. We have room for more. Think very hard before you ring.",
      ], "A northern woman wrote to the south and never sent it. A city trades far enough to find such letters."),
    ],
    mystery: {
      name: "Six Thousand and Four Stones", intro: "Your neighbours on the plateau keep a cairn with one stone for every man who sailed south. They say the men did not choose to go.",
      clues: [
        "The cairn-wives: a good harvest, nobody hungry. He stood at the door \"like a dog that hears its name\".",
        "The saga: a sound under the ice like a bell struck a long way down. Only those who had killed could hear it.",
        "Runa Ashby: whatever called them is the same thing that knocks on your walls every third night.",
      ],
      question: "What did the men of the Isles hear, the winter they sailed?",
      accept: ["abell", "bell", "abellundertheice", "bellundertheice", "thebellundertheice", "thecalling", "calling", "thechoir", "choir", "anote", "onenote"],
      solved: "A bell under the ice: the Calling. The Grey Host was not an invasion. It was the first army the other world ever raised, out of other people's anger, and the sieges at your walls are the same trick.",
    },
  },

  Gullcliff: {
    was: "A beacon station. The iron basket is still bolted to the cliff edge, and below it a room is cut into the chalk where the watchmen slept. Somebody scratched a tally of sails into the wall, and then stopped.",
    angle: "The Host's landing, and the proof that Corvin could not have summoned it.",
    lead: "lighthouse",
    build: "An iron beacon basket (cauldron, iron bars, campfire) at the cliff edge. A small room dug into the cliff under it with tally marks (signs) on the wall.",
    tomes: [
      P("The Beacon Log", "Watchman Piers Gannet", [
        "Midwinter eve. Sails, grey, from the north-west. I counted to two hundred and lit the fire. They did not row. There was no wind. They came on all the same, every ship at one speed, like beads on a string.\n\nLit the second fire. Lit the third. Nobody came. The Vale was at its feasting.",
        "First year of the war: the grey men hold everything north of the Alder. Second year: the same, and the King's levies thinner.\n\nNoted in the second autumn: a thin man in a tinker's coat walked the coast road northward, alone, toward the fighting. He stopped here for water. He carried a bell wrapped in sacking and would not let me lift it.",
      ], "The men who watched the sea wrote down every sail. Their log is in the room under the beacon."),
      P("Words With a Tinker", "Watchman Piers Gannet, on a loose leaf", [
        "I asked the tinker where he was bound. He said to the King, to tell him something about his war. I said the King had generals for that.\n\nHe said, \"Your generals think they are fighting six thousand men. They are fighting one thing with six thousand hands, and I believe I can hear it thinking.\"",
        "I said, if you can hear it, can you make it stop? He was quiet a while. He said, \"I can ask it what it wants. Nobody has. Not since the great bell. Nobody has.\"\n\nI gave him bread. I write this down because of what they are saying about him now. I saw him come. The ships were here two winters before he was.",
      ], "A watchman kept one loose page apart from his log. His family kept it until there was a town to give it to."),
      P("Correction Ordered to the Coast Records", "The Ashen Gate, to all beacon stations", [
        "The logs of the northern beacons are to be amended. Where a watchman has recorded the arrival of the mage Hale, the year is to be struck and the entry moved before the first sighting of the grey sails.\n\nWatchmen who decline are to be relieved. Logs that cannot be amended are to be reported lost at sea.",
        "Returned from Gullcliff, in another hand, under the order: \"Log lost at sea, as instructed.\"\n\nAnd under that, smaller: \"It is in the wall behind the third bunk. I am too old to lie well and too old to be frightened. P. Gannet.\"",
      ], "The Order rewrote the coast's memory by letter. A city harbour-master files everything."),
    ],
    mystery: {
      name: "Sails Without Wind", intro: "Your cliff was a beacon station. The watchman logged everything, and somebody ordered the log changed.",
      clues: [
        "The log: a thin man with a bell in sacking walked north in the second autumn of the war.",
        "The loose leaf: \"The ships were here two winters before he was.\"",
        "The Order's letter: move the mage's arrival to before the first sails, or report the log lost.",
      ],
      question: "How many winters had the grey ships been here before the bell-mage came?",
      accept: ["two", "2", "twowinters", "2winters", "twoyears", "2years"],
      solved: "Two. The Order's whole story, that a wicked mage called the Host down on Aldmere, is impossible, and the proof was hidden in the wall of your own cliff by a watchman too old to lie well.",
    },
  },

  Tidewatch: {
    was: "Tide-readers lived in these dunes, a lay house of Saint Brannoc's. Their measuring posts still march down the beach into the sea. The last post has a second set of notches cut into the far side, where no one standing on land could have cut them.",
    angle: "The Returned: the first ones walked out of the sea here.",
    lead: "sunken_chapel",
    build: "A line of wooden posts (fences, logs) running from the dunes down into the water. The furthest post has marks (buttons, trapdoors) on its seaward face.",
    tomes: [
      P("Tide Tables of the Southern Shore", "The lay brothers of Tidewatch", [
        "High water and low, each day, for the fishermen. We have kept this table ninety years and the sea has never surprised us.\n\nWe note without comment that every third night the ebb runs longer than the moon allows. The water goes out as if something had opened a door at the bottom.",
        "On such nights we ring no bell and we keep the lamps low. The Prior says it is only custom. But custom is what is left when everyone who knew the reason has died, and I should like to know the reason before I am one of them.\n\nNoted: on the far side of the last post there are tide-marks cut by a hand. None of us cut them.",
      ], "Tide-readers measured the sea every day for ninety years. Their tables are where their posts are."),
      P("Those Who Came Back Up the Beach", "Brother Caedmon, infirmarian", [
        "Three fishermen lost in the autumn gale came walking up the sand this morning in a row. Dry. I say again, dry, and their boots clean.\n\nTheir wives wept. I examined them. Hearts sound, eyes clear, tempers sweeter than they ever were. Wat Tolley, who was the worst drunk on the coast, asked me for water.",
        "I am set down as a careful man and I will be careful. Wat Tolley was left-handed. He takes the cup in his right. The dog that slept on his nets these nine years will not come within a boat's length of him.\n\nAnd at evening prayer, when the bell was rung, all three stood up together, turned, and walked back down the beach into the sea. They did not hurry. One of them was humming.",
      ], "An infirmarian examined three men who should have been drowned. The pages turn up once people settle in numbers."),
      P("The Seaward Notches", "Brother Caedmon, later, alone", [
        "The brothers have gone inland. I have stayed to finish a measurement.\n\nThe marks on the far side of the last post are a tide table. I have at last understood it. It is ours, mark for mark, ninety years of it, but cut from the other side and reckoned the other way, as though high water were low.",
        "Something has been standing in the sea, at the bottom of the ebb, measuring us for as long as we have been measuring the tide.\n\nI do not think the men who came back were sent to harm us. I think they were a first attempt at saying something, by a people who do not have our kind of words and made the nearest thing they could out of what the sea had given them. I think we answered with a bell.",
      ], "The last brother stayed behind to finish one measurement. What he found is in a city's keeping."),
    ],
    mystery: {
      name: "The Last Post", intro: "A line of measuring posts runs down your beach into the sea. Someone has cut marks into the far side of the last one.",
      clues: [
        "The tide tables: every third night the ebb runs longer than the moon allows, \"as if something had opened a door at the bottom\".",
        "The infirmarian: three drowned men walked up the beach dry, kinder, wrong-handed, and walked back into the sea at the evening bell.",
        "Brother Caedmon: the seaward marks are the brothers' own table, cut from the other side. Something has been measuring them.",
      ],
      question: "What do people call the ones who come back from the sea, kinder than they left?",
      accept: ["thereturned", "returned", "copies", "acopy", "thecopies"],
      solved: "The Returned. The first of them walked up your beach. Brother Caedmon thought they were not a weapon at all, but a first clumsy attempt to speak, and that we answered it with a bell.",
    },
  },

  Reedmoor: {
    was: "Firm ground at the edge of the fen, and on it a ring of nine worn posts, set too far apart to be a building. Reed-cutters call it the Even Market and will not say what was sold. Nothing grows inside the ring, and nothing has been trodden there in seven hundred years.",
    angle: "Before the Bell: the two worlds met here and traded. The third night is older than the truce.",
    lead: "mirelight",
    build: "A wide ring of nine old posts (stripped logs) on bare ground (coarse dirt, no grass) at the plot's fen side.",
    tomes: [
      P("Customs of the Reed-Cutters", "Set down by a travelling friar", [
        "The fen people keep a market-ring where no market is held. They mend its nine posts each spring. I asked what it was for and was told, \"For when they come back.\" I asked who. I was given a bowl of eel and no answer.\n\nThey reckon time oddly. They do not count days. They count nights, in threes.",
        "An old woman, when I pressed her, said this. \"Two nights are ours. The third is theirs. It always was. The kings did not make that. The kings only forgot it, and then one of them remembered and they killed him for it.\"\n\nI have written to my bishop that the fen people are simple. I do not believe it. I think they are the only ones here with a memory.",
      ], "A friar wrote down what the fen people do and could not make them explain it. His notes stayed in the fen."),
      P("The Reeve's Roll of the Even Market", "Very old. The hand is not the friar's.", [
        "Brought by us: salt, iron needles, honey, woven reed, a song of nine verses. Brought by them: cold light in a jar, a wood that does not rot, a note that mends cracked pots, the knowing of where water is.\n\nNo coin. Neither side has a use for the other's. A thing is worth a thing.",
        "The market is held on the third night and ends at the first grey. We do not ask them to stay later and they do not ask us to come down. This is the whole of the law and it has never been broken.\n\nWritten in the last year of the market: the Queen's men are raising a great frame at the top of the valley. We have asked what it is for. We are told it is to make us safe. We were not aware that we were in danger.",
      ], "A market keeps a roll of what was traded. This one is older than the kingdom and wants a town to read it."),
      P("After the Bell", "A reed-cutter, by a scribe's hand", [
        "My grandmother was a girl at the last market. She said that when the great bell rang, the others were in the middle of the ring with their goods laid out. They did not run. They looked up, the way you look up when someone slams a door in a house you thought was friendly.\n\nThen they were not there. The jars of light went out one by one.",
        "She said the worst of it was the pots. Every pot in the fen that they had mended cracked again that night, all at once, along the old lines.\n\nWe keep the posts mended. It is not worship. It is manners. If you shut a door in a neighbour's face for seven hundred years, the least you can do is keep the step swept.",
      ], "What the last market looked like, from someone whose grandmother stood in it. A city's scribes took it down."),
    ],
    mystery: {
      name: "The Even Market", intro: "There is a ring of nine posts on your land where nothing grows. The fen people mend it every spring.",
      clues: [
        "The friar: the fen people count nights in threes. \"Two nights are ours. The third is theirs. It always was.\"",
        "The reeve's roll: two peoples traded here, a thing for a thing, on the third night until first grey.",
        "The reed-cutter: when the great bell rang, they looked up \"the way you look up when someone slams a door\".",
      ],
      question: "On which night was the Even Market held?",
      accept: ["thethird", "third", "thethirdnight", "thirdnight", "everythirdnight", "everythird", "three", "3", "everythreenights"],
      solved: "Every third night. The third night was never a punishment or a debt. It was market day between two neighbours, for longer than there have been kings, until one side rang a bell.",
    },
  },

  Lanternbog: {
    was: "A dry island in the deep fen, and on it the stumps of a great many posts, each with an iron hook. This was a lantern house. The keepers hung a light for every person the fen had kept, and took it down when they came home. Some of the hooks are worn bright. Some were never used twice.",
    angle: "Slips and lost days, long before the player's own.",
    lead: "witchroot_caves",
    build: "Many short posts with hooks (fence posts with chains or tripwire hooks), a few with lanterns still lit. One lantern of a different colour (soul lantern) set apart.",
    tomes: [
      P("The Lantern Rule", "The keepers of the bog light", [
        "When one of ours does not come home, hang a lamp and write the name. When they come home, take it down and write the hour. Ask them nothing the first night. Give them soup.\n\nThey will not know they were gone. Do not argue. A person will fight harder for a lost afternoon than for a lost purse.",
        "Most are gone a breath, and stand blinking on the same plank with their eel-spear still raised. Some are gone a day. Wenna Sedge was gone eleven years and came back in the same wet shoes, asking whether the bread had risen.\n\nIt is not a sickness. Do not call a priest. It is more like stepping on a board that is not nailed down.",
      ], "The rule of a house that hung a lamp for everyone the fen kept. It is still on the island."),
      P("Where They Say They Were", "A keeper's private book", [
        "The Rule says ask them nothing. I have asked, on the second night, gently, forty years. Most remember nothing. Nine remembered. All nine said the same thing and none of them knew the others.\n\nA high ledge. Mist below with lights moving in it, slow, like a river with lamps under the water. No sky. A sound that was one note.",
        "And each said they were not alone on the ledge. Someone stood a little behind them, the whole time, and did not touch them, and seemed to be waiting to be spoken to.\n\nWenna Sedge said, \"It was not unfriendly. It was like a shopkeeper who can see you have come in by mistake.\" She went back the next year, on purpose. Her lamp is the blue one. We have never taken it down.",
      ], "One keeper broke the rule and asked. A town draws out books that people were ashamed to own."),
      P("The Blue Lamp", "Found folded in the lantern, when the glass was changed", [
        "To whoever tends my lamp. Do not grieve and do not take it down. I am not lost. I knew the board was loose and I stepped on it.\n\nIt is a whole country. There are rivers of light and woods and people in it, and they are as frightened of the ledge as we are of the fen.",
        "They have been trying to come up the way I came down, and they cannot. Something was shut. They do not understand why, and the not understanding has turned, in some of them, into something hard.\n\nThere is one here who was born up there. He sits apart. They are careful of him. I asked what he was called and they made a sound I can only write as a name.\n\nKeep the lamp lit. I may want it. W.",
      ], "A note left inside a lamp by someone who did not want to be rescued. Cities change old glass."),
    ],
    mystery: {
      name: "The Loose Board", intro: "Your island was a lantern house. The keepers hung a light for everyone the fen kept, and one lamp was never taken down.",
      clues: [
        "The Rule: most are gone a breath. Wenna Sedge was gone eleven years and came back in the same wet shoes.",
        "The keeper: nine people, who never met, described the same high ledge, mist with lights in it, no sky, and one note.",
        "The blue lamp: \"It is a whole country.\" Its people are trying to come up, and cannot.",
      ],
      question: "How long was Wenna Sedge gone, the first time?",
      accept: ["elevenyears", "eleven", "11", "11years", "elevenwinters"],
      solved: "Eleven years, in the same wet shoes. People have been stepping off your island into somewhere else for centuries, for a breath or for eleven years. It is a whole country, with no sky and one note, and one of yours liked what she saw enough to go back.",
    },
  },

  Redmesa: {
    was: "A stone-yard. The mesa top is scored with wedge-lines where blocks were split away, and there are forty pale rectangles in the red rock where forty of them stood to be carved. A forty-first is fainter than the rest, at the back, under a lean-to that has fallen in.",
    angle: "The faceless statues of Sunscar: they were carved here, and one face survives.",
    lead: "sunscar",
    build: "Forty pale rectangles (smooth sandstone slabs) in rows on the mesa floor and one more under a collapsed lean-to, with a chiselled stone head (a carved block or player head) buried a block or two down.",
    tomes: [
      P("The Sculptor's Order Book", "Maren Sard, master carver", [
        "Commission of the Seneschal of Sunscar: forty figures of His Grace, one for each year of his life to date, to stand on the avenue. Red stone, life size, the face from the life.\n\nThe King sat for me nine days. He is a bad sitter. He laughs, and then the face you were carving is gone and there is a better one.",
        "I have done the boy of nine from his mother's miniature and his own account. He says he was afraid of nothing at that age and I am to carve him so. I asked what he was afraid of now. He said, \"Being thanked.\"\n\nForty delivered and paid for. I kept my study head, as a carver does. It is the best of them. It is the only one where he is not posing.",
      ], "A carver's order book stays with the stone. Look where the blocks were cut."),
      P("A Carver's Quarrel With a Chisel", "Maren Sard", [
        "They have taken the faces off. All forty. I rode to Sunscar when I heard and I did not believe it until I stood in the avenue.\n\nIt was not done with hammers. It was done with a fine chisel, slowly, by someone who knew how the stone was laid. Each face was lifted away almost whole. Whoever did it was weeping or ought to have been.",
        "The Seneschal received me. His hands were bandaged. He said, \"I was ordered to have it done. I was not ordered whom to have do it.\"\n\nI asked where the fragments were. He said scattered, by order. Then he said, very low, \"Mistress Sard. A carver keeps a study. Do not tell me whether you did.\" I did not tell him.",
      ], "The carver went to see what had been done to her work. A town with a mason keeps a carver's papers."),
      P("Under the Bench", "Maren Sard, to no one", [
        "The knights came to the yard with a list. Forty figures, delivered, destroyed, struck through. They counted the forty marks on the floor and were satisfied. A knight can count.\n\nA knight does not know that a carver cuts one more than she sells.",
        "It is under my bench, face down, two feet in the sand, wrapped in my apron. I will not dig it up again in my life.\n\nSomeday someone will build on this mesa and put a spade through my floor. When you do: he was grey-eyed, and he laughed easily, and that is the face he had when he thought nobody was carving. Whatever they tell you he became, start from there.",
      ], "The carver hid one thing and wrote down where. It takes a city's worth of digging to find the note."),
    ],
    mystery: {
      name: "The Forty-First Stone", intro: "Forty pale marks on your mesa show where forty statues stood to be carved. There is a forty-first.",
      clues: [
        "The order book: forty figures of the King, one for each year of his life. \"I kept my study head.\"",
        "The quarrel: the faces were lifted off with a fine chisel, by the Seneschal's own bandaged hands.",
        "Under the bench: \"A carver cuts one more than she sells.\" Face down, two feet in the sand.",
      ],
      question: "How many statues did the carver deliver to Sunscar?",
      accept: ["forty", "40"],
      solved: "Forty, and she carved forty-one. Every face of the last king was destroyed except one, and it is buried under your settlement, wrapped in a carver's apron.",
    },
  },

  Dunehold: {
    was: "An oasis, and beside it a long low mud-brick hall with forty writing desks in it, each chained to the floor. The Order sent its clerks here when they had read too much. The palms were planted by the first of them. The well was dug by the rest.",
    angle: "The Order's cover-up, from the inside: the people made to write the lie.",
    lead: "saltglass_grotto",
    build: "A ruined mud-brick hall with rows of desks (lecterns, stairs) and chains. Palms (jungle or acacia) around the well. Scratches (signs) under one desk.",
    tomes: [
      P("Rule of the House at the Well", "The Ashen Gate, for its copyists in the sand", [
        "A brother sent to the Well has not sinned. He has only read. He is to be treated kindly and kept busy, and he is not to leave.\n\nThe work is the copying of \"On the Kingless Years\", forty copies in each year, to be sent to every chapel in Aldmere. A copy with an error is to be burned and begun again.",
        "A brother may not speak of what he read before he came. He may not write anything that is not the copy. Ink is counted. Paper is counted.\n\nThe desks are chained because a desk is where a man is alone with his thoughts, and the Order prefers to know where that is happening.",
      ], "Every house of the Order had a Rule. This one is still nailed up where the copyists could see it."),
      P("Forty Copies a Year", "Brother Osric, copyist", [
        "I have now written the sentence \"there was never a king of that name\" four thousand times. I counted, because counting is not forbidden.\n\nBrother Luce says a lie written four thousand times becomes true. I say it becomes handwriting. I no longer see the words. I see the shapes. That is how I am able to do what I do.",
        "Ink is counted, so I use none. Paper is counted, so I use none. But the Rule says nothing of the underside of a desk, nor of a thumbnail.\n\nEvery copy I send out is perfect. Every brother who sits at my desk after I am dead will find, if he drops his pen and stoops for it, the thing I was sent here for reading. I have made it short.",
      ], "A copyist who counted everything. His own pages were smuggled out in a water-skin and want a town to land in."),
      P("Under the Ninth Desk", "Scratched with a thumbnail, copied here by a later hand", [
        "THERE WAS A KING. HE MADE A PEACE. IT HELD.\n\nHIS OWN PEOPLE BROKE IT AND CALLED HIM THE TRAITOR. THE SIEGES ARE NOT RAIDERS. THEY ARE WHAT IS OWED.\n\nWE WERE NOT SENT HERE FOR LYING. WE WERE SENT HERE FOR KNOWING HOW TO READ.",
        "Added below by nineteen different thumbnails, over what looks like two hundred years:\n\nI found this. I found this. I found this too. Still true. I dropped my pen on purpose. So did I. Tell someone. There is no one to tell. Then plant another palm.\n\nThere are nineteen palms at the well. Count them.",
      ], "What was under the desk. Somebody copied it out fair, and a city's library is the only safe place for it."),
    ],
    mystery: {
      name: "The House at the Well", intro: "There are forty chained desks in the old hall by your oasis, and nineteen palms at the well.",
      clues: [
        "The Rule: \"A brother sent to the Well has not sinned. He has only read.\" Forty copies a year of one book.",
        "Brother Osric: four thousand times, \"there was never a king of that name\". Then he found the underside of the desk.",
        "Under the ninth desk: THERE WAS A KING. HE MADE A PEACE. IT HELD. And nineteen thumbnails after.",
      ],
      question: "What book were the exiled clerks made to copy, forty times a year?",
      accept: ["onthekinglessyears", "thekinglessyears", "kinglessyears"],
      solved: "\"On the Kingless Years\", the Order's official history, which says there was never a king. It was written out by the very people who knew better, and each of them planted a palm.",
    },
  },
};

export const slugOf = (name) => String(name ?? "").toLowerCase().replace(/[^a-z]/g, "");
export const PLOT_NAMES = Object.keys(PLOT_LORE);
const COLORS = { Harrowford: "§2", Oakmere: "§2", Thistledown: "§2", Wrenfield: "§2", Rimeholt: "§b", Wolfcairn: "§b", Gullcliff: "§3", Tidewatch: "§3", Reedmoor: "§5", Lanternbog: "§5", Redmesa: "§c", Dunehold: "§c" };
const FOUND = [
  "Under the Plot Stone, the day the first settler arrives.",
  "Turns up when the settlement becomes a Town.",
  "Turns up when the settlement becomes a City.",
];

// The same data in the shapes the rest of the lore feature uses
export const LOCAL_COLLECTIONS = PLOT_NAMES.map((name) => ({
  id: `local_${slugOf(name)}`, name: `The ${name} Papers`, color: COLORS[name], count: 3, local: name,
  blurb: `Three things written at ${name} before it was yours.`,
}));
export const LOCAL_TOMES = PLOT_NAMES.flatMap((name) =>
  PLOT_LORE[name].tomes.map((t, i) => ({
    id: `loc_${slugOf(name)}_${i + 1}`, col: `local_${slugOf(name)}`, n: i + 1, local: name,
    title: t.title, author: t.author, where: FOUND[i], hint: t.hint,
    pages: i === 0 && wrenPage(name) ? [...t.pages, wrenPage(name)] : t.pages, // the first book ends by sending you to Sister Wren
    clues: [`loc_${slugOf(name)}_${i + 1}`], leads: i === 0 ? [PLOT_LORE[name].lead, "millbrook"] : [],
  })),
);
export const LOCAL_THREADS = PLOT_NAMES.map((name) => {
  const m = PLOT_LORE[name].mystery;
  return {
    id: `local_${slugOf(name)}`, name: m.name, need: 2, local: name, intro: m.intro,
    clues: Object.fromEntries(m.clues.map((text, i) => [`loc_${slugOf(name)}_${i + 1}`, text])),
    kind: "text", question: m.question, accept: m.accept, sp: 2,
    solved: `${m.solved}\n\n${REGION_BOSS[PLOT_REGION[name]].line}`, bossLead: REGION_BOSS[PLOT_REGION[name]].place, // home boss first
  };
});
