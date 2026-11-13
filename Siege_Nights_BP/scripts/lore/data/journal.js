// The Old King's Journal: the book every player starts with. A plain readable item, optional.
// Written by King Aldric, father of Oswin, about sixty years before the war. He saw the Hollow
// pressing back into the world and never learned what it was. He never names it, never names his
// son, and signs only "A.". Nothing in here states a secret outright: it is a list of things the
// player will meet later and slowly learn to explain. (See LORE-BIBLE.md, "The Old King's Journal".)

export const JOURNAL = {
  title: "The Old King's Journal",
  cover: "A small book bound in cracked red leather. The royal seal is on the cover. Under it someone has scraped a name off with a knife, so deep that only the bare wood under the leather shows.",
  entries: [
    {
      date: "The 21st year of my reign. Thaw.",
      text: "I begin this book because there is no one in my council I can say these things to and remain king.\n\nThe well in the lower court tasted of salt this morning. The cook wept over it. We are eleven days' ride from any sea. By noon it was sweet again, and the well-keeper swears it was never otherwise.\n\nI tasted it. I know salt.",
    },
    {
      date: "The same year. Harvest.",
      text: "The Founding Bell hummed all last night with no hand on the rope. It did not ring. It hummed, low, the way a cup does when a finger is run around the rim.\n\nThe bell-wardens say it was the wind. There was no wind. I stood under it until dawn and my teeth ached.\n\nI have asked them to keep a count of the nights it does this. They looked at me as one looks at an old dog.",
    },
    {
      date: "The 22nd year. Lambing.",
      text: "A shepherd of Millbrook was brought to me, at his own asking. One of his ewes walked into the evening mist and came back at first light. It had rained all night and her fleece was dry, except the feet.\n\nShe will not go to her lamb. She stands in the corner of the fold with her face to the wall.\n\nThe shepherds have a word for it, an old one. They say she is hollowed. \"She's there, sire, and she's not.\" He wanted my leave to kill her. I gave it. I do not know why he felt he needed a king for that.",
    },
    {
      date: "The 23rd year. Midwinter.",
      text: "The tower clock is slow by the same small measure every morning. I have had it taken apart twice.\n\nThe clockmaker came to me today, very pale, and said the clock is not at fault. He has timed it against the sand-glass, against his own pulse, against the candles. He says the clock keeps the hours faithfully. He says it is the night that is too long, by that much.\n\nI asked him where a piece of a night could come from. He asked my leave to go and live with his sister in the south.",
    },
    {
      date: "The 24th year. First frost.",
      text: "I saw two moons tonight.\n\nAt dusk I watched our own moon go down, a thin new sliver, as it ought to be at this turn of the month. I saw it set myself.\n\nAn hour later a second moon stood over the west marsh, full and white and very low. There is one moon. There has only ever been one moon.\n\nI sent for the astronomer and pointed. He would not turn his head. He said, \"Sire, if I do not look, I will not have seen it,\" and I found that I could not order him to.",
    },
    {
      date: "The 25th year. High summer.",
      text: "There is frost in the old cellar under the Hall of Bells, in the hottest week of the year. Only there. It lies thickest by the north wall, where a crack runs from the floor to the height of a man's heart.\n\nI held a candle to the crack. The flame leaned toward it, as if something on the other side were drawing a slow breath.\n\nI put my hand inside, to the wrist. I will not write what it felt like. It was not stone.",
    },
    {
      date: "The 26th year. Thaw.",
      text: "A miller's daughter, seven years old, was gone for one night. Her mother says a night. The child says she was away a long while, long enough to grow hungry many times.\n\nShe told me, quite calmly, about a town where the towers lean and the streets are water and there is no sky, only a roof too far up to see. She said the people there were kind and would not look at her.\n\nShe eats with her left hand now. Her mother asked me if that mattered. I gave them silver. What else is a king for?",
    },
    {
      date: "The 27th year. Harvest.",
      text: "There is singing under the floor of the Hall of Bells. Many voices holding one note. The dogs will not go into the hall and the youngest warden has asked to be sent to another post.\n\nIt does not come every night. I have marked the nights in the margin of this book for a year, looking for the pattern. Feast days, moons, tides, my own sins. I cannot find it.\n\nThere is a pattern. I am sure of it. I am too close to it, the way a man is too close to his own face.",
    },
    {
      date: "The 28th year. Midwinter.",
      text: "I asked the bell-wardens what Queen Maelis rang the first bell for. \"To found the kingdom, sire.\" I asked what was here before the kingdom. They did not understand the question.\n\nSo I went down to the charter vault myself. The oldest charter is in her own hand. Where the name of the land is written, the skin has been scraped thin and Aldmere written over it.\n\nHeld to a lamp, the first letter of the old word can still be seen. It is an H. I could not make out the rest, and I am ashamed of how glad I was.",
    },
    {
      date: "The 29th year. A night I did not sleep.",
      text: "I dreamed I stood in a street, ankle-deep in black water. There was no sky over it, only a roof too far up to see, as the miller's child told me. There were people all along it with their faces to the walls, humming. One of them turned and bowed to me. It was not how a subject bows. It was how one neighbour greets another over a fence.\n\nI woke in my own bed. My feet were wet to the ankle and the sheets were dry.\n\nI have told no one. I have had the cellar bricked up.",
    },
    {
      date: "The 30th year. Lambing.",
      text: "The bricks sweat.\n\nMy son found the cellar, as he finds everything. He is nine, grey-eyed, quick with his right hand and quicker to laugh, and he is afraid of nothing, which frightens me more than the rest of this book together.\n\nHe had his ear against the new wall. He said, \"Father, they are asking something.\" I asked him what. He said, \"I don't know. They are asking it very politely.\"\n\nI carried him out. He was not afraid then either.",
    },
    {
      date: "The last entry. I no longer count the years.",
      text: "My hand shakes, so I will be short.\n\nI have fought this with silver, with bricks and with silence, and it is nearer than when I began. I do not know what it is. I do not know what it wants. I had always thought an enemy was a thing that wanted something.\n\nIf you are reading this, it did not stop with me, and I am sorry. I leave this book to my son, with the one piece of advice I am sure of.\n\nListen before you ring.\n\nA., by grace King",
    },
  ],
};

// Ledger clues the journal gives when it is read to the end
export const JOURNAL_CLUES = ["journal_signed_a", "journal_son"];
