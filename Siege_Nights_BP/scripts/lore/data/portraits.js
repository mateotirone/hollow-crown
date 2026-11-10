// Portraits and paintings that hang on walls. Pure data, no Minecraft imports.
//   LEADERS   for each of the twelve plots, the three people who held that ground before the player
//             (Mateo, 2026-11-10: "i want each settlements prior leaders to show on the walls").
//             They are the people in that plot's own books (data/plots.js). Oldest first.
//             look = notes for whoever paints it (never shown); line = what a player reads on a closer look.
//   GALLERY   Mateo's eight old paintings (lore-book/plates/art), the Long Gallery.
// The order of PICS is the picture number saved on each hung portrait: only ever add to the end.

const L = (name, era, role, look, line) => ({ name, era, role, look, line });

export const LEADERS = {
  Harrowford: [
    L("Ned Harrow", "about 310 years ago", "Ferryman of the Alder ford", "Weathered man of fifty, flat cap, ferry pole in his right hand, a notched tally stick at his belt. Night river and many small fires on the far bank behind him.", "He counted eleven hundred fires on the far bank, and in the morning nobody at any of them."),
    L("The Warden of the Clock", "about 310 years ago", "Chapel warden. His name has been scratched off the frame", "Thin old man in a dark gown holding a large clock key. Behind him a clock face reading seventeen past three. The nameplate on the frame is gouged out.", "He wound the clock every evening for thirty years. Every morning it read seventeen past three."),
    L("Jessamy Harrow", "about 250 years ago", "Kept the farm and the plough list", "Broad, sunburned woman in a field apron holding a rusted spearhead in both hands like something she is about to hand back. Ploughed meadow behind.", "Spearheads, 2,140. Buckles, more than she would count. Bones, none."),
  ],
  Oakmere: [
    L("Aldric, by grace King", "about 360 years ago", "Came to his lodge to be away from a cellar, and found another", "Tired grey king of sixty in a plain hunting coat, no crown, seated, a small red leather book closed on his knee and a lamp at his feet. He is looking past the painter at a wall. Oak trunks behind, all leaning the same way.", "He does not hunt. He sits with a lamp and a red book, and he has had the bell taken off the door."),
    L("Rafe Aske", "about 360 years ago", "Forester to the King", "Lean man in a green hood with a deer-hound pressed against his leg, the hound looking off to one side with its ears flat. An oak ride behind with no deer in it.", "The deer will not cross the east ride any more. He never told the King. He thought the King knew."),
    L("Giles Lorimer", "about 350 years ago", "Last steward of the lodge", "Stout careful man with a ring of keys, standing in front of a doorway that has been walled up with fresh stone. He holds one key apart from the rest.", "He burned nothing, as he was ordered, and gave the red book to a pedlar who could not read."),
  ],
  Thistledown: [
    L("Tam Burdock", "about 310 years ago", "Shepherd of the down", "Ruddy shepherd with a crook and a lamb under one arm. On the hilltop behind him a timber bell frame against the sky, with a bell in it.", "On the nights the stranger rang his bell, no ewe dropped her lamb dead."),
    L("The Tenant of the Down", "about 310 years ago", "Leased the hilltop for a shilling a year", "Thin, rude-looking man of forty in a tinker's patched coat, tin-stained fingers, a bell wrapped in sacking under his arm. He is half turned away, listening to something. No name on the frame, only 'the tenant'.", "\"It is not FOR anything. It is a question. I am waiting to see who answers.\""),
    L("Alys Burdock", "about 300 years ago", "Spoke for the sixteen households", "Square-shouldered woman of sixty holding sheep shears point down like a sword. Fifteen small figures with crooks stand round an empty bell frame behind her.", "She stood under the frame with her shears and would not move, and the Order wrote that it had been burned."),
  ],
  Wrenfield: [
    L("Mistress Aveline Thorpe", "about 300 years ago", "Governess at the summer house", "Neat severe woman of forty in grey with a daybook open on her arm and a pen, eyebrows slightly raised as if she has just been asked a question she cannot answer. A lake and a jetty behind.", "\"She is the most truthful child I have taught, which is not the comfort it sounds.\""),
    L("E., aged seven", "about 300 years ago", "The child of the house", "A fierce small girl of seven with hair as pale as ash, standing in a rowing boat far too big for her and holding an oar upright like a spear. A faint grey smudge on her left palm. She is not smiling. An apple tree on the bank behind.", "\"I will be someone who says the true thing out loud even when everybody at the table goes quiet.\""),
    L("Garth Appleyard", "about 285 years ago", "Gardener. He burned the house and kept the tree", "Old bent gardener holding one apple. Behind him a blackened chimney stack, and beside it an apple tree in full leaf, untouched.", "She had them burn the house. She did not have them burn the tree. He wondered about that every year."),
  ],
  Frosthelm: [
    L("Maelis, the Queen", "about 700 years ago", "Came down the mine herself to listen", "A hard young queen in travelling furs with a plain bronze circlet, standing in a mine gallery with her head tilted, listening, one hand flat against green-veined rock. A single miner's lamp. Stiff, very old style of painting.", "She listened a long while and said, \"Good. Then I know what pitch to cast against.\""),
    L("Brand Holt", "about 700 years ago", "Captain of the Queen's diggings", "Huge bearded miner with a pick over one shoulder and an ingot of copper in his hand, silver and gold showing ignored in the rock behind him.", "Silver they left in the wall. Gold they left in the wall. She wanted forty tons of copper and nothing else."),
    L("Master Ysolt", "about 700 years ago", "Bell-founder to the Queen", "Grey woman in a scorched leather apron holding a two-pronged tuning fork up to her ear, eyes closed. The glow of a furnace behind. She looks sorry.", "\"It is cast well. I am sorry for that, some nights.\""),
  ],
  Wolfcairn: [
    L("The First Cairn-Wife", "about 310 years ago", "Began the stone-count", "Very old northern woman wrapped in wool with a knotted counting cord in her hands, standing by the first few stones of a cairn. Snow. No name is given, on purpose.", "They do not carve names. A name is a thing you call someone back with."),
    L("Vorlund, before he sailed", "about 310 years ago", "Thane of the Ice Isles", "A big young northern lord with a great axe, standing in a doorway with his head on one side like a dog that hears its name. He is not looking at the painter. Frozen sea behind. Painted by someone who loved him.", "\"It wants us in the south.\" Somebody asked him what wanted it. \"I do not know. I know the voice.\""),
    L("Runa Ashby", "about 280 years ago", "Wrote to the south and never sent it", "Blunt-faced woman of fifty holding a single stone in both hands, an unsealed letter tucked in her belt. Behind her the cairn, now taller than a house.", "\"We have six thousand and four stones. We have room for more. Think very hard before you ring.\""),
  ],
  Gullcliff: [
    L("Ines Marrow", "about 320 years ago", "Captain of the beacon", "Wind-burned woman in an oiled coat with a brass spyglass, standing by an unlit iron beacon basket on a cliff edge. Clear empty sea.", "In her day the beacon was lit twice in thirty years, both times for a whale."),
    L("Piers Gannet", "about 310 years ago", "Watchman. He lit all three fires and nobody came", "Old watchman with a torch in his right hand beside a blazing beacon. On the sea behind, a line of grey sails all exactly the same distance apart, and not a ripple of wind.", "\"They did not row. There was no wind. They came on all the same, like beads on a string.\""),
    L("Brother-Clerk Aldhelm", "about 280 years ago", "Sent by the Ashen Gate to correct the log", "Young ink-stained cleric in grey holding a page with one line struck through. He is looking at the floor. Behind him a row of three bunks cut into chalk.", "He wrote down \"log lost at sea, as instructed\" and did not look behind the third bunk."),
  ],
  Tidewatch: [
    L("Prior Benet", "about 400 years ago", "Founded the tide-house", "Calm round-faced monk in sea-grey with a notched measuring rod taller than himself. A line of posts marching into the sea behind.", "Ninety years of tables, and the sea never once surprised them."),
    L("Brother Caedmon", "about 300 years ago", "Infirmarian. The last to leave", "Careful, lined monk holding a cup, looking out of the picture toward the sea, not at the viewer. One measuring post in the water behind with marks on the wrong side.", "\"I think they were a first attempt at saying something. I think we answered with a bell.\""),
    L("Wat Tolley, after", "about 300 years ago", "Fisherman. Painted by his wife, the week he came back", "A fisherman of forty, perfectly dry, smiling gently, holding a cup in his right hand. His boots are clean. An empty folded net beside him where a dog would sleep. Something slightly too smooth about the face.", "He was the worst drunk on the coast. He asked for water. He took the cup in the wrong hand."),
  ],
  Reedmoor: [
    L("The Reeve of the Even Market", "about 700 years ago", "Kept the roll of what was traded", "A lean fen-man in woven reed holding up a glass jar with a cold pale light in it. Nine posts in a ring behind. On the other side of the ring, tall indistinct figures laying out goods. Very old, flat style.", "No coin. Neither side had a use for the other's. A thing was worth a thing."),
    L("Old Sedge", "about 280 years ago", "Answered the friar, once", "Tiny ancient woman holding out a bowl of eel with a look that says this is all you are getting. Three knots in a cord round her wrist.", "\"Two nights are ours. The third is theirs. It always was. The kings only forgot it.\""),
    L("Friar Colm", "about 280 years ago", "Wrote down the customs of the fen", "Plump travelling friar with muddy hem, a writing board, and a puzzled, slowly dawning expression. Behind him fen people mending a post.", "He wrote to his bishop that the fen people were simple. He did not believe it."),
  ],
  Lanternbog: [
    L("Marn, First Keeper", "about 450 years ago", "Wrote the Lantern Rule", "Tall grave woman with a long hooked pole, lifting a lit lantern onto a post. Dozens of lanterns in the dark behind her, reflected in black water.", "\"Ask them nothing the first night. Give them soup.\""),
    L("Ilse Tarn", "about 250 years ago", "The keeper who asked", "Sharp-eyed woman of fifty holding a lantern in one hand, the other hand behind her back hiding a small book. Nine lit lanterns in a row behind her.", "Nine people who never met told her the same thing: a high ledge, lights in the mist, no sky, one note."),
    L("Wenna Sedge", "about 250 years ago", "Went back on purpose", "A cheerful ordinary woman of thirty in soaking wet shoes, holding an eel spear, standing under a single blue lantern. She is looking over her shoulder at something behind her and does not seem afraid.", "\"I am not lost. I knew the board was loose and I stepped on it.\""),
  ],
  Redmesa: [
    L("Maren Sard", "about 285 years ago", "Master carver", "Strong-armed woman of fifty in a dusty apron with a fine chisel and mallet. Behind her a row of roughed-out red stone figures, none with a finished face.", "\"He laughs, and then the face you were carving is gone and there is a better one.\""),
    L("Lord Sorrel", "about 280 years ago", "Seneschal of Sunscar, who ordered forty statues and then unmade them", "A proud, grieving nobleman in desert robes, both hands wrapped in bandages and held slightly away from his body. An avenue of statues behind, their heads in shadow.", "\"I was ordered to have it done. I was not ordered whom to have do it.\""),
    L("Under the Bench", "about 280 years ago", "A still life. No sitter", "Not a person. A carver's workbench seen from low down, and under it, half buried in red sand, a bundle the size of a head wrapped in a dusty apron and tied with cord. Nothing of what is inside can be seen. MUST NOT show a face.", "\"A knight can count. A knight does not know that a carver cuts one more than she sells.\""),
  ],
  Dunehold: [
    L("Sister Imre", "about 280 years ago", "The first sent to the Well", "A young woman in grey Order robes on her knees planting a palm seedling beside a half-dug well, sleeves pushed up, ink still on her fingers.", "She was not sent there for lying. She was sent there for knowing how to read."),
    L("Prior Aubrey", "about 250 years ago", "Kept the house, kindly", "A gentle, tired old prior holding a pot of ink in one hand and a measuring spoon in the other. Chained desks in rows behind him. He looks as though he is sorry about the chains.", "\"A brother sent to the Well has not sinned. He has only read.\" Ink was counted. Paper was counted."),
    L("Brother Osric", "about 200 years ago", "Copyist, four thousand times", "A dry, amused monk of sixty at a chained desk, pen in his right hand, his left hand out of sight under the desk. He is looking straight at the painter with one eyebrow up.", "The Rule said nothing about the underside of a desk, nor about a thumbnail."),
  ],
};

export const GALLERY = [
  { title: "Hallowmere, before", line: "The mere and the old town in summer, before the two worlds met. The only picture known of the land under its first name." },
  { title: "The Convergence", line: "The night the other shore arrived. The sun has been painted out by a later hand. There are two moons." },
  { title: "The Truce of the Third Night", line: "One of ours and five of theirs at a table of wet stone. Cut from its frame and hidden in a bell." },
  { title: "The King Is Put Down", line: "Painted from the wall of Crownhold by someone who was there. The Order's inventory lists it as \"a hunting scene, burned\"." },
  { title: "Bellhollow", line: "The last ringing of the Founding Bell. The Order hung copies of this in every chapterhouse. This is not a copy." },
  { title: "The Gate", line: "What the bell left behind: one wound in the rock, shut. Look at the edges of the Crack. The painter went back and added the hands." },
  { title: "The Third Night", line: "A keep of Aldmere, on the night that is not ours. Count the moons." },
  { title: "The Forty-Second Portrait", line: "The Order burned forty-one portraits of one man. This is another. The face was scraped back to the board before it was hidden, and not by the Order.", tall: true,
    // Secrecy: this one never hangs where a player can reach it early. It belongs in the Burned Archive only (late Act III).
    late: "burned_archive",
    // what the same picture says once Morvane has fallen (the board itself does not change)
    after: "Oswin, son of Aldric, last King of Aldmere. He scraped the face off himself, the night before they came for him, so that nobody would have to be asked whose it was." },
];

const slug = (name) => String(name).toLowerCase().replace(/[^a-z]/g, "");
// size: 0 = portrait, 1 block wide and 2 tall; 1 = painting, 3 wide and 2 tall; 2 = painting, 2 wide and 3 tall
export const PICS = [
  ...Object.entries(LEADERS).flatMap(([plot, people]) =>
    people.map((p, i) => ({ id: `${slug(plot)}_${i + 1}`, plot, size: 0, title: p.name, sub: `${p.role}. ${plot}, ${p.era}.`, line: p.line, look: p.look })),
  ),
  ...GALLERY.map((g, i) => ({ id: `plate_${i + 1}`, size: g.tall ? 2 : 1, title: g.title, sub: "The Long Gallery", line: g.line, after: g.after })),
];
// the caption a player reads: the late picture changes its words after the last fight, and only then
export const captionOf = (pic, flags = []) => (pic.after && flags.includes("morvane_fallen") ? pic.after : pic.line);
// the paintings that may hang anywhere from the first day (the Long Gallery at Crownhold, the Libraries)
export const OPEN_PLATES = GALLERY.map((g, i) => ({ ...g, n: i + 1 })).filter((g) => !g.late).map((g) => g.n);
export const picIndex = (id) => PICS.findIndex((p) => p.id === id);
export const leaderPics = (plot) => PICS.map((p, i) => ({ ...p, index: i })).filter((p) => p.plot === plot);
