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
  // and never speaks the name Oswin. In order; the last is for when the stage breaks.
  fall: [
    "{name}. Sit, if you like. There is only the one chair, and I have had it three hundred years.",
    "I was a king, {name}. Yours. Your walls stand on my roads. Did nobody up there tell you there had been one?",
    "I made a peace, and I kept it. I am the only one on either side of that door who did.",
    "There is no portrait of me left above. Forty-one, and she burned them all. You would not have known my face. You have known my nights.",
    "Tell my daughter the door was well made. Tell her I knocked every third night.",
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
      "I knocked on it every third night for three hundred years. Nobody came down. So I stopped being the king they threw away and became the one who was needed here, and I am told I have not been kind.\n\n" +
      "They have no names below. They made one for me, because mine had been burned, and a thing without a name cannot be bargained with. In their speech it means the one who stayed.\n\n" +
      "You did not pack this book. I did. Whoever came down to end me should know that it was a king, and whose son.\n\n" +
      "Listen before you ring.",
    sign: "Oswin, son of Aldric,\nlast King of Aldmere",
  },
};
