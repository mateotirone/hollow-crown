// The reveal: who Morvane was. Words only. The fight and its cutscene belong to the Hollow and mobs
// features; they ask for these with emit("revealWordsWanted") and get "revealWords" back.
//
// Mateo (2026-11-10): the reveal is a big staged scene, and the story (through the NPCs) must have
// explained enough that the player knows who he is at the end. So the rule is now:
//   BEFORE the fight   nobody says it. Three people each hold one piece (Brother Cael: no grave;
//                      Sigrun: the name was given to a stranger; Old Mag: he walked in alive) and
//                      Archivist Pell lays the three side by side and refuses to finish the sentence.
//   IN the fight       the scene says it without a name: the boy from the journal, the journal's line.
//   AFTER the fight    the journal gains a last page, signed. Brother Cael says it aloud, plainly.

export const REVEAL = {
  // The line that writes itself across the screen while the boy is at the desk. It is word for word
  // from the eleventh entry of the Old King's Journal, which every player has carried from minute one.
  journalLine: "He is nine, grey-eyed, quick with his right hand and quicker to laugh, and he is afraid of nothing, which frightens me more than the rest of this book together.",
  journalLineBy: "A., by grace King",
  // The one thing he says when he looks up. Nothing else in the scene is spoken.
  lookUp: "You kept my father's book.",
  // Shown to every player on the server as the bells toll (no name in it)
  bells: "Every bell in Aldmere is ringing. Nobody is ringing them.",
  // Stage 6, The Fall: each player is alone with him and he speaks to them by name ({name}).
  // Mateo's ruling (decision card, 2026-11-10): he says outright that he was a king, their king,
  // and never speaks the name Oswin. Mateo, 2026-11-13: it is revealed at the end that he pulled the strings the
  // whole time: he sent the five bosses, and could not reach the player while the Rift was shut, so he tricked
  // them into opening it (each boss carried a Choir Shard; five make the Tuning Fork). In order; the last is for
  // when the stage breaks.
  fall: [
    "{name}. Sit, if you like. There is only the one chair, and I have had it three hundred years.",
    "I was a king, {name}. Yours. They threw me down here, and I have been pulling at your world ever since.",
    "The Reeve, the Huntsman, the Bride, the Seneschal, the Mother. Mine, every one. I sent them up to kill you.",
    "And when you kept winning, I let you. Every shard you took from them was a piece of my key.",
    "I could not reach you through a closed door. So I made you open it. You did it so well.",
    "Good. You did not come down here to talk either.",
  ],
  // The page that is in the journal afterwards
  lastPage: {
    date: "The last page. A different hand. No year, no season: there are none here.",
    text:
      "My father wrote in this book until his hand failed. I was nine when I found it in the cellar, and he let me keep the key, because I was afraid of nothing.\n\n" +
      "I did what his last line told me. I listened before I rang. What I heard was not an army. It was a people shut out of a place that had been half theirs, asking for one night in three. I gave it to them. I thought it cheap. I think so still.\n\n" +
      "My daughter thought it treason. She was seventeen and she was right about everything except me. I do not hold the door against her. It was well made.\n\n" +
      "I took their pledge in my right hand, and that hand has not closed properly since. I have done everything with the other, and they said up there that I was not myself. I was never anything else.\n\n" +
      "I knocked on it every third night for three hundred years. Nobody came down. So I stopped knocking and began to pull. The raids were mine. The five who kept the door were mine. The pale fire that fell at your gate was a splinter of my own crown.\n\n" +
      "I could not reach you through a shut door, and I could not open it from this side. It needed someone from above, strong enough to take a shard from each of the five. I sent them up to kill you. When they could not, I let you take what they carried, and I spoke to you at night until you used it.\n\n" +
      "They have no names below. They made one for me, because mine had been burned, and a thing without a name cannot be bargained with. In their speech it means the one who stayed.\n\n" +
      "You did not pack this book. I did. I put it in your pack so you would listen to a voice in the dark, and you did. Whoever came down to end me should know that it was a king, and whose son.\n\n" +
      "Listen before you ring.",
    sign: "Oswin, son of Aldric,\nlast King of Aldmere",
  },
};
