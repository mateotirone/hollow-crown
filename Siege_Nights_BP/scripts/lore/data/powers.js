// Where each Sorcerer power comes from, and "The Fourteen Arts", the in-game book that hints at it.
// (Mateo, 2026-11-10: every power needs an origin; a book the player can read that never quite
// shows how; some pages say where to go, some only tell what happened to someone who could do it.)
//
// THE ONE IDEA BEHIND ALL OF THEM (builder only): there is no magic in Aldmere. The Ember is a
// splinter of the Hollow Crown, and the Crown is how the Hollow's ruler hears the whole Hollow.
// Someone who carries a splinter hears a little of it, and can borrow what the Hollow's people do
// by nature. So every art is something the Hollow does, done badly by one of us. Resonance is the
// other half: the more you borrow, the better the Hollow hears YOU.
//
// Keys are the town hall's skill ids (scripts/townhall/skills.js, Arcana branch). For each:
//   origin  the truth, for the builder and for other writers. Never shown to players.
//   tree    one hinting line for the Tree of Oaths menu (player-facing, explains nothing)
//   art     what Mag calls it in her notes
//   page    what the book says (Mag, aged eleven, writing down what her master let slip)
//   known   one line added to the page once the reader has sworn the power
//   lead    optional place id (data/world.js PLACES) the page sends the reader to

export const ARTS_BOOK = {
  title: "The Fourteen Arts",
  cover: "A child's copybook, swollen with damp. On the cover in careful round letters: THINGS THE MASTER SAID WHEN HE THOUGHT I WAS ASLEEP. Under that, smaller, and later: he counted fourteen. He would only ever teach me two.",
  intro: "I am Mag and I am eleven and I am the Master's prentice, which means I carry the lamp.\n\nHe says there is no such thing as magic. He says there is only listening, and that some people have been handed an ear they did not ask for. He will not say who hands them out.\n\nHe says a prentice who writes things down is a prentice who gets burned. So I am writing this under the blanket.",
  outro: "That is fourteen. I asked the Master which one was the worst and he said the worst one is whichever you are proudest of.\n\nI asked him how you learn them and he said you do not learn them. He said they are already being done, all the time, somewhere under your feet, and all you ever do is stop refusing to hear it.\n\nI do not know what that means. I am going to sleep now.\n\n(Later, in an old woman's hand:) I know what it means now. I am sorry I asked.",
};

export const POWERS = {
  arc_bolt: {
    tree: "Their lamps burn this colour. It was never ours.",
    art: "The Pale Fire",
    origin: "The Hollow has no sun and burns no wood. Its lamps are a cold pale fire that its people call up from the note everything hums. A splinter of the Crown carries a spark of it. This is the first thing every Sorcerer does, usually by accident.",
    page: "The first art is the pale fire. It is the wrong colour and it gives no smoke, and the Master says that is because it was never ours.\n\nHe says everyone who gets the ear does this one first and none of them mean to. A shepherd girl above Millbrook tried to light a candle with it. They say you can still see the hillside. Nothing grows on it and the sheep walk around.\n\nHe showed me once, in his cupped hand. It did not light his face. It lit the wall behind me.",
    known: "You have held it. It did not light your face either.",
  },
  arc_ward: {
    tree: "A promise made a long way down, that guests come to no harm.",
    art: "Guest-Right",
    origin: "The Truce of the Third Night promised that guests of either world walk unharmed. It was sworn on the Hollow Crown, and the oath still clings to every splinter. A Ward is the truce remembering that you are a guest. It is the one art that is a kept promise and not a theft.",
    page: "The second art is that things do not hit you as hard as they should.\n\nThe Master says it is not a shield. He says it is a promise somebody made a long way down, that guests should come to no harm, and that the promise does not know it has been broken. He got very quiet after he said that.\n\nI asked who the guest was. He said, \"We were. For a little while we were.\"\n\nThis is one of the two he taught me. I think it is why I am still here.",
    known: "Something keeps a promise to you. You have not kept one to it.",
  },
  arc_quiet: {
    tree: "The bell-wardens' vigil: hold the rope all night and do not pull.",
    art: "The Vigil",
    origin: "Not from the Hollow at all. It is the old discipline of Aldmere's bell-wardens: to stand under a great bell all night and not ring it. The Order of the Ashen Gate still trains its knights this way without knowing why it works. It is the only art a Sorcerer shares with the knights, and the only defence against being heard.",
    page: "The third is not an art, the Master says. It is the only sensible thing on the list.\n\nThe old bell-wardens used to stand a whole night under the great bell with the rope in their hands and not pull it. He made me do it. I cried. He said good, now do it without crying.\n\nHe says every one of the other arts makes you louder, and this is the only one that makes you quiet, and that the ones who skip it are the ones we tell stories about.\n\nThe knights still do the vigil. They think it is prayer. Go and watch them at the chapterhouse some night. Do not tell them what you are.",
    known: "You can stand under the bell now. Mostly.",
    lead: "ashen_chapterhouse",
  },
  arc_blink: {
    tree: "Down there, no street is the same length twice.",
    art: "The Short Way",
    origin: "Distances in the Hollow are not fixed: its streets are not the same length twice, and its people simply step where they mean to be. A Sorcerer who Blinks borrows one of those steps. For an instant they are standing in the Hollow, which is why they arrive damp.",
    page: "The fourth art is being over there.\n\nThe Master did it once across the Hall of Bells because the King dared him. He arrived with one shoe. The other shoe came back three days later on the same spot, full of water, and the water was black.\n\nHe says down there no street is the same length twice and nobody minds. He says when you do it you are not crossing the room. You are crossing a little piece of somewhere else that happens to be shorter.\n\nHe never did it again. I asked why and he said, \"Something moved the shoe.\"",
    known: "You have taken the short way. Check your boots.",
    lead: "crownhold",
  },
  arc_echo: {
    tree: "Everything hums. They have no sky, so they see by the hum.",
    art: "Seeing by the Note",
    origin: "The Hollow lies under a roof with no sky and almost no light. Its people see by sound: everything hums a note, and they read the notes. Echo Sight is that sense, borrowed. It shows hidden doors because a door hums differently from a wall. Brother Fennick, the Order's surveyor, learned it by accident, and it is why his field notes get stranger.",
    page: "The fifth art is seeing in the dark, except the Master says it is not seeing.\n\nHe says everything hums. Stone, water, a mouse, a door somebody bricked up. He says the people below have no sky and hardly any light and so they have always found their way by the hum, the way we find ours by looking.\n\nThere was a surveyor, he says, who got the knack of it and could not put it down. He started seeing doors everywhere. In hillsides. In the bottom of wells. In people.\n\nThe Master says the frightening part is that the surveyor was right about most of them.",
    known: "Now you hear the doors too.",
  },
  arc_bind: {
    tree: "The hand that holds the Returned to the wall, borrowed.",
    art: "The Standing",
    origin: "The Returned stand with their faces to the wall because the Hollow is holding them: a shape sent up is kept on a leash of the same stillness. Bind is that hold, turned on something else. It works on raiders because the Hollow already has a hand on them.",
    page: "The sixth art is making a thing stand still.\n\nYou have seen the ones who come back wrong, standing in corners with their faces to the wall. The Master says they are not choosing to. He says something has a hand on them, and this art is only borrowing the hand.\n\nThere was a woman in the fen whose boy came back from a lost night. She had the ear. She was afraid he would walk off again, so she made him stand. She meant it for one night.\n\nHe stood in her kitchen for eleven years. She fed him with a spoon. When she died he walked into the water the same hour.",
    known: "You have borrowed the hand. It noticed.",
  },
  arc_ashen: {
    tree: "The grey of a hearth the morning after. Fire loses interest in you.",
    art: "The Grey",
    origin: "At Bellhollow, those standing nearest the Founding Bell when it rang its last stroke were scorched grey by it and never burned again. Edda was one of them (the grey mark on her palm; the name 'Ashe'; the Order's name). A Sorcerer loud enough takes the same mark from inside: the body remembers the bell.",
    page: "The seventh is not something you do. It is something that happens to you if you keep on.\n\nThe skin goes a little grey, like a hearth the morning after, and fire stops being interested in you.\n\nI asked the Master where it came from and for once he did not know. He only said he had seen it on one other person who had never worked an art in her life, on the palm of her left hand, since she was a baby. He would not say who. He bowed when he said it, though, and he does not bow.",
    known: "Look at your hands in daylight.",
  },
  arc_step: {
    tree: "What pulled you once, done on purpose.",
    art: "Leaning",
    origin: "A Slip is the Hollow pulling someone half through a thin place and letting go. Halfstep is the same thing done on purpose: the Sorcerer leans toward the Hollow until the world stops being able to touch them, then leans back. Each time, leaning back is a little harder.",
    page: "The eighth art is the one where you are not quite here.\n\nSome people get pulled. A few heartbeats in a street of black water and then back in your chair, soaked. The Master says that is the other place taking hold of you and thinking better of it.\n\nThis art is doing that to yourself. You lean toward it, and for a moment nothing here can lay a hand on you, because you are mostly not here to be hit.\n\nHe says the leaning out is easy. He says the leaning back is a habit, and habits wear out.\n\nIf it has ever pulled you, you already know the way. That is all the teaching there is.",
    known: "You leaned. You came back. Count how long it took this time.",
  },
  arc_choir: {
    tree: "The sound an army once crossed the ice for.",
    art: "The Calling",
    origin: "This is the call that brought the Grey Host: the bell under the ice that told an army to march. The Hollow uses it every third night to send the angry and the empty against the brightest keep. A Sorcerer can sound a small one. It turns raiders on each other because they are already listening for it.",
    page: "The ninth art I am not allowed to write about so I will be quick.\n\nIt is a sound. Nobody near you hears it except the ones who are already listening for it, and they do what it says.\n\nThe Master says a whole army once crossed the ice because of this sound, and nobody in that army could have told you why they were marching. He says it is still being made, on certain nights, by something much better at it than any of us.\n\nHe says if I ever find I can do it, I am to ask myself very carefully who taught the raiders to listen. Ask them in Rimehold. Their grandmothers came over that ice.",
    known: "They turned on each other when you called. They were already listening. So were you.",
    lead: "hollowfast",
  },
  arc_resonant: {
    tree: "Ask what happened to Ashby Cross.",
    art: "Being Loud",
    origin: "The more a Sorcerer borrows, the louder they ring in the Hollow, and past a point the Hollow starts answering through them. That makes every art stronger and the Sorcerer a kind of thin place on legs. The warning story is true: Tam Hallet of Ashby Cross let himself get as loud as it goes, and a thin place opened where he stood. The village is a glassy pit. This is the 'man who destroyed a village' every Sorcerer is told about.",
    page: "The tenth is the one the Master told me as a story, so that I would remember it.\n\nThere was a man called Tam Hallet, of a village called Ashby Cross. He had the ear and no teacher. Every art he did made him louder and being loud made every art stronger, and he liked that, as who would not.\n\nOne market day he was as loud as a person can be. Nobody knows what he was trying to do. It might have been nothing. It might have been lighting a pipe.\n\nThere is no Ashby Cross. There is a round pit with a floor like black glass, and on a still day you can see the well and the market cross and all of them, down under it, looking up.\n\nNobody knows how it happened. The Master says that is not true. He says everybody who has ever been loud knows exactly how it happened.",
    known: "You have been loud. You know exactly how it happened.",
  },
  arc_hollowborn: {
    tree: "It has stopped treating you as a stranger.",
    art: "The Ones Who Went Willingly",
    origin: "Under the truce, any of ours who wished could walk below on a third night, and some did and came back themselves, changed but not replaced. Their descendants carry it: the arts cost them less because the Hollow half knows them already. A Sorcerer reaches the same state by long use. (Player-facing skill name is being changed from 'Hollowborn' to 'Choirborn'.)",
    page: "The eleventh the Master calls being known.\n\nHe says there was a time, not long, when you could go down on certain nights as a guest and come back up as yourself. Most people who went did not do it twice. A few went often. They came back easy in their skin and very hard to startle, and the arts cost them nothing much.\n\nHe says it runs in families now, thin, like red hair. A grandmother who hums when she kneads. A child nobody can sneak up on.\n\nHe says for the rest of us it only comes by doing the arts so long that the other place stops treating you as a stranger. He did not make that sound like a good thing.",
    known: "It has stopped treating you as a stranger.",
  },
  arc_hollowstep: {
    tree: "You do not find a door. You are one.",
    art: "The Door You Carry",
    origin: "Bellhollow shut every thin place but the Gate. A splinter of the Crown, though, was made on the far side and remembers it: a Sorcerer who has mastered leaning can go all the way through, anywhere, because they are carrying a door exactly the size of themselves. It is the only way into the Hollow that does not use the Gate, which is why the Hollow cannot use it to come out.",
    page: "The twelfth art is going there. All the way. On purpose.\n\nThe Master says every door between here and there was slammed shut in one night, all but one, and the one is watched. But he says a person with the ear is carrying a piece of the far side around in them, and a piece of a place remembers the way home.\n\nSo you do not find a door. You are one. It is exactly your size and nothing else can come through it, in either direction, which he says is the only reason it is allowed to exist.\n\nHe says to learn it you must go and stand in front of the one real door that is left, close enough to feel it breathe, and notice that some part of you is already on the other side.\n\nHe would not tell me where the door is. He said if I was ever ready I would be able to hear it from my bed.",
    known: "You are a door. Be careful who stands near you.",
  },
  arc_warden: {
    tree: "Hearing all of it, and still knowing which voice is yours.",
    art: "Hearing All of It",
    origin: "The Hollow Crown lets its wearer hear the whole Hollow at once, and that kills anyone who cannot bear it. The last art is being able to bear it. Only a Sorcerer who has every art before it can, which is why only they can wear the Crown and rule. The one exception is Morvane: the Hollow put the Crown on a man with no art and held him while it remade him. Mag's page hints at that without naming him. Do not make it plainer.",
    page: "The Master would not talk about the thirteenth. I got this out of him in pieces over a whole winter.\n\nEverything else on this list is hearing a little. This one is hearing all of it, every voice down there at once, and still knowing which one is yours.\n\nHe says there is a thing made for that purpose, to be worn, and that it kills anybody who puts it on without this art, quickly, from the inside.\n\nThen he said there had been one exception. Somebody with no art at all, who was not killed by it. I asked how. He said, \"They held him still while it happened.\" I asked what it cost. He said, \"His name.\"\n\nI asked whose name. He put the lamp out and told me to go to bed.",
    known: "You can hear all of it. One of the voices is very tired, and very old, and is listening back.",
  },
  arc_crownless: {
    tree: "There are storms on the underside of their roof.",
    art: "The Roof-Fire",
    origin: "There is no sky in the Hollow, but there are storms: lightning walks across the underside of its far roof and leaps from tower to tower. A Sorcerer at the peak throws pale fire that does the same. The name 'Crownless' is the Hollow's own word for a splinter-bearer who owes its Crown nothing: strong, and answerable to no one.",
    page: "The last one the Master only saw once and not from one of us.\n\nHe went below, he will not say when or why. He says there is no sky there, only a roof too far up to see, and that there are storms on the underside of it. Fire runs along the roof and jumps down from tower to tower to tower, and nobody there looks up.\n\nHe says someone who has all the other arts can throw the pale fire so that it does that. It will not stop at the one you meant.\n\nHe says the people below have a word for one of ours who can do it and who answers to nobody. He says the word means someone with no crown over them. He says they do not say it kindly, and they do not say it without stepping back.",
    known: "It did not stop at the one you meant.",
  },
};
