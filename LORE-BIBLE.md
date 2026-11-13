# The Hollow Crown: lore bible

**Spoilers. This is the whole truth, for the builder only.** Players should learn it over weeks, from tomes that disagree with each other. History follows Mateo's version of 2026-11-10 (two worlds, a truce, an overthrown king, a war the Hollow lost, the Gate). Names follow the naming pass Mateo accepted the same day: "Hollow" is kept for the Hollow, the Hollow Crown and the Heart of the Hollow only (so Hallowmere, the Choir, Rimehold, Frostvein Gap, the Sung Verses, the Voice Below). Code ids are unchanged.

## The truth, in order

1. **Hallowmere (about 700 years ago).** The Hollow is another world: a drowned country of leaning towers and black water under a roof too far up to see. It is not a copy of ours. It ran aground on our world at a marsh, and for a while the place where they met was one kingdom that belonged to both, called Hallowmere.
2. **Queen Maelis** did not want to share. She cast the Founding Bell, rang it, and pushed the Hollow back out. She named what was left **Aldmere** and scraped the old name off the charters. The Hollow's people call this being "rung out".
3. **The pressing-in (about 360 years ago).** The Hollow began to seep back. **King Aldric** saw salt wells, long nights, a second moon, frost in summer, people who came back wrong. He never understood it. He kept a journal. (This is the journal every player starts with.)
4. **The Grey Host (about 310 years ago).** The Hollow called an army down from the Ice Isles with a bell under the ice, to cut down Aldmere's bells for it. Thane **Vorlund** led it. Aldric's son, **King Oswin**, was losing the war.
5. **The Truce of the Third Night.** Oswin went below with his mage **Corvin Hale** and met five lords of the Hollow at a table of wet stone. Terms: the Hollow takes back the Grey Host (it swallowed the whole army at **3:17**); in return every third night belongs to the Hollow, no bell is rung that night, and its people may walk above as guests. It was sworn on **the Hollow Crown**, the Hollow's own crown, which nobody at the table could wear. The Hollow broke a splinter from it and gave it to Oswin as a pledge.
6. **The Lost Days.** On third nights people went below, some willingly, and shapes came up in their places. Aldmere came to hate the peace.
7. **The overthrow.** Princess **Edda** and the lords took Oswin on the walls on a third night. He did not draw his sword. She put him through the Crack alive. Then they rang every bell in Aldmere to break the truce on purpose.
8. **Bellhollow.** The Hollow came up in fury and lost. The last stroke of the Founding Bell tore every thin place shut at once and left one wound in the rock: **the Gate** (the Rift). The bell split. The Hollow is behind the Gate and cannot get back through.
9. **The cover-up.** Edda took vows, became **Saint Ashe**, and founded the **Order of the Ashen Gate**. It burned the portraits, the chronicles and Corvin, and taught everyone that there was never a King Oswin.
10. **Now.** The Hollow wants back in, "because they're pissed". Everything strange in the land is the Hollow working at the Gate: the seep, the Slips, the Returned, the wrong moon. Every third night is still theirs by the truce, so on that night they call, and Vorlund (kept as their hound, with a splinter of the Crown in his brow) marches the angry and the empty against the brightest keep. **Every siege is a debt being collected.** The Gate is growing. It has even moved: it now sits at one of seven thin places.
11. **The Ember** that falls after a player's first siege win is that pledged splinter of the Hollow Crown, sent to find the brightest keep.

## The leader: Morvane (who he was is secret until the end)

Decided by Mateo, 2026-11-10. The one who controls the Hollow is **Morvane**. That is the name the Hollow gave him. Players may hear "Morvane" early (Vorlund, the Sung Verses, raider camps, rumors). **What stays secret until the final fight is that Morvane was King Oswin.** The Hollow took in the one human who ever kept his word to it, put its Crown on him, and renamed him. He has directed the sieges for three hundred years and taught the Hollow our walls. He drops *The Last Testament*. The Ledger mystery "Who Is Morvane?" can only be answered with a clue from the Hollow itself.

## The Hollow Crown, and the endings

- **The Hollow Crown is the crown of the Hollow's ruler** (Mateo, 2026-11-10). Its seat stood empty from the war until the Hollow set it on Morvane, which only worked because it took the king out of him first. It kills anyone who puts it on **except a max-level Sorcerer**, who can hear the whole Hollow at once and not break. The game says this plainly.
- **Defeat the leader** and you win something great to carry back up (a separate relic and title; the Crown thread is naming it) and your settlement transforms. You do not rule the Hollow.
- **After Morvane falls the seat can stay empty**, open for any max-level Sorcerer to claim later. In a solo world an NPC takes it (the Undertow feature's "Regent"; names and lines in `lore/data/lords.js`), and a new one rises whenever the last is killed.
- **Hidden third ending (Mateo picked it 2026-11-11, built in `lore/truce.js`):** solve every mystery, learn the land's old name, and once Morvane has fallen say **Hallowmere** at the empty Seat to offer the truce again. The Choir answers. Every third night becomes a Guest Night: Choir guests walk up and trade a thing for a thing (as the Reeve's Roll says), the Even Market at Reedmoor opens, nobody is taken, a Returned rung out walks home alone, and nothing below hunts the players. Ringing a bell at Bellhollow, as Edda did, breaks it: every third night is an "oathbroken" siege at Uncounted Nights strength. After 9 days it can be offered again, and the Choir's answer changes each time.
- The old idea that the wearer slowly becomes the next monster is **gone**.

## The Old King's Journal

Every player has it from their first minute (`siege:kings_journal`, text in `lore/data/journal.js`). It is an ordinary book and reading it is optional. Twelve entries by King Aldric over about ten years: salt in an inland well, the bell humming, a "hollowed" ewe (the shepherds' word, which is where "the Hollowing" comes from), a night that is too long, a second moon, frost in a summer cellar, a child who visited a town with no sky, singing under the floor on nights he can't find the pattern in (it is every third night), a scraped charter with an H, a dream that leaves his feet wet, his fearless nine-year-old son hearing "them" ask something politely, and a last entry: "Listen before you ring."

It names nothing: no Hollow, no Oswin, not even himself (signed "A.", name scraped off the cover). A test enforces that. Finishing it opens the mystery "The Old King's Journal"; the answer (**Aldric**) comes from matching the son in the journal to Quill's description of Oswin "son of Aldric". Sister Wren recognises the book. Who put it in every traveler's pack is deliberately never answered.

## The paintings (the Long Gallery)

Eight "old paintings" made by `studio/build_lore_plates.py`, printed in the PDF book: Hallowmere before; the Convergence; the Truce; the King put down; Bellhollow; the Gate; the Third Night; the Forty-Second Portrait (a king with his face scraped off, sword in his left hand). They are in `lore-book/plates/` and could later hang in game as custom paintings.

## Where the Sorcerer's powers come from

Mateo, 2026-11-10: every power needs an origin, and a book in the game that hints at it without showing how.

**The one idea:** there is no magic in Aldmere. The Ember is a splinter of the Hollow Crown, and the Crown is how the Hollow's ruler hears the whole Hollow. Whoever carries a splinter hears a little of it and can borrow what the Hollow's people do by nature. Every power is something the Hollow does, done badly by one of us. Resonance is the other half: the more you borrow, the better the Hollow hears you.

| Power | Mag calls it | Where it really comes from |
|---|---|---|
| Ember Bolt | The Pale Fire | The cold fire of the Hollow's lamps. Everyone does this first, by accident |
| Ward | Guest-Right | The truce's promise that guests come to no harm, still clinging to the splinter |
| Quiet Mind | The Vigil | Not the Hollow's: the bell-wardens' discipline of holding the rope and not ringing. The knights still do it |
| Blink | The Short Way | In the Hollow no street is the same length twice. You cross a piece of it. You arrive damp |
| Echo Sight | Seeing by the Note | No sky, little light: the Hollow sees by the hum of things. It ruined Brother Fennick |
| Bind | The Standing | The hold the Hollow keeps on the Returned, borrowed |
| Ashen Skin | The Grey | The scorch of the Founding Bell's last stroke. Edda had it on her palm, hence "Ashe" |
| Halfstep | Leaning | A Slip, done on purpose |
| Choir's Call | The Calling | The bell under the ice that called the Grey Host, and calls every third night |
| Resonant Soul | Being Loud | The Hollow answering through you. Tam Hallet got as loud as it goes and Ashby Cross is now a pit of black glass with the village under it |
| Hollowborn (to be renamed Choirborn) | The Ones Who Went Willingly | Families descended from truce-time guests of the Hollow; or long use |
| Veilstep | The Door You Carry | Every thin place is shut but the Gate, yet a splinter remembers the far side: you are a door your own size |
| Voice of the Hollow (to be renamed) | Hearing All of It | Bearing the whole Hollow at once, which is what the Crown demands. The page hints at the one man who wore it with no art, and what it cost him. It does not name him |
| Crownless | The Roof-Fire | The storms on the underside of the Hollow's roof. "Crownless" is the Hollow's word for one of ours who answers to nobody |

**The book** is *The Fourteen Arts* (`siege:fourteen_arts`, text in `lore/data/powers.js`): Old Mag's copybook from when she was eleven, "things the Master said when he thought I was asleep". Mag gives it to any Sorcerer she has come to trust. It never says Hollow, Crown, truce, Oswin or Morvane (a test enforces that).

**Powers you have to go somewhere for.** Four stay "Unknown" at the Tree of Oaths until the story opens them (`powerOrigin` event; the town hall does the gating): Echo Sight (read a Field Note), Halfstep (the First Slip), Choir's Call (Sigrun Ashby in Rimehold tells you why the Host came), Veilstep (name the real thin place in your Library).

## Corvin Hale comes back

Mateo said yes, 2026-11-10. The Order scattered Corvin's ashes "in running water so that nothing could gather them", and water runs down. He has been in the Choir for three hundred years and is the one voice in it slightly off the note, because he is still arguing. **Only a Sorcerer hears him.** First at Resonance 70 or more, on a third night or in the Hollow ("Flat. Whoever that is up there, you are FLAT."). After that he has one rude, exact remark the first time the Sorcerer has each of the fourteen arts (`scripts/lore/data/corvin.js`), and never says how any of it is done. He can be spoken to in the Hollow as the story character `corvin`, "A Voice in the Water" (place the NPC in still water there). He gives the truce word for word, says the King took the splinter bare-handed because it would have been rude to ask for a cloth, and finishes his last page: "Someone must go down and say good morning." He will NOT say who sits in the chair until Morvane has fallen. Tell Old Mag his message ("she still holds a pen like a trowel") and she breaks.

## Moon doors

Corvin's rule made real (`scripts/lore/moondoors.js`): a door carved with a full moon opens only on the night our moon is dark, a door carved with a dark moon only under our full moon, and it closes at dawn. A builder marks any patch of blocks with `/scriptevent siege:moon_door full|dark [wide] [tall]`. Use it at the Rimehold lake shrine and the Chapel of Saint Brannoc, and for the Hall of Bells' late tome.

## What Morvane says aloud

Mateo's ruling on a decision card, 2026-11-10: in the fight he says outright that he was a king, their king, and **never speaks the name Oswin**. The name is only ever written (the journal's last page) and then said by Brother Cael. His stage 6 lines are `REVEAL.fall` in `data/reveal.js`.

## Morvane pulled the strings, and his voice (heard before he is seen)

Mateo, 2026-11-13: "it's revealed in the end that Morvane has been pulling the strings on everything the entire time. He's the one that sent the bosses etc. He knows that you're a threat to him, but because the rift isn't open, he can't get to you directly. He's been trying to get the rift open for that reason. So then he ends up tricking you into opening it for him."

How the pieces fit: the raids, the five regional bosses and the Ember are all his. The bosses were sent up to kill the player; each carries a Choir Shard, and five shards make the Tuning Fork that opens the Rift. He cannot open it from below, and he cannot reach the player while it is shut. So when the bosses keep losing he lets the player win, and talks to them at night until they forge the fork and strike it. The seep that spreads forever once the Rift is open is the cost.

**His voice** (Mateo: "i want the player to hear him before they know who he is"; "more monster/demony"). Thirty-three hand-written lines voiced by ElevenLabs with a second, lower throat mixed under every line (words in `studio/voices/morvane.json`, played by `scripts/lore/morvane_voice.js`, installed by `tools/install_voices.py`). Before the Rift he is a voice with no speaker, far off, each line heard once by one player, words in grey italics, and he poses as a helper: he tells you who to hunt, to take the shards and keep them safe, and that opening the door will make the knocking stop. Slips for a careful listener: "That is why I chose you", "He kept my keys", "Keep it safe for me", "The ones I... the ones who hunt you". None of those lines says Hollow, king, Crown, Morvane or Oswin (a test enforces it).
- **The Rift opens:** the mask drops. "There. Thank you. I could not reach you through a closed door, so I sent them up, and you carried every shard to it for me."
- **The fight:** his printed lines are spoken. Stage 5: "This was mine first. And thanks to you, it is mine again." Stage 6 (`REVEAL.fall`) says it plainly: he was a king, theirs; the five were his, sent to kill you; every shard was a piece of his key; he made you open the door. Then the reveal's "You kept my father's book." As he falls for good: "You opened the door. It does not close."
- **The journal's last page** now also says he planted the journal so the player would listen to a voice in the dark.

## The King's hand

Settled 2026-11-10 with the novel thread. At the truce Oswin took the splinter of the Hollow Crown in his **right** hand, and that hand never served him properly again. From then on he wrote, ate and fought with his left. That is why the Chronicles and the lighthouse letters describe a left-handed king, why Edda believed her father was one of the Returned, and why she was "right about everything except me". He was never a copy. **Morvane fights left-handed and is grey-eyed. The boy in the reveal scene writes with his right.**

## Twelve settlements, twelve ways in

Mateo, 2026-11-10: every settlement needs its own lore and library, "so the game is playable differently 12 times". Each plot has a past, three local books (the Papers of that place), a local Ledger mystery, three prior leaders whose portraits hang in its Library, and a first lead that differs from every other plot. Data: `scripts/lore/data/plots.js` and `data/portraits.js`. The first book is on the Library's bottom shelf on arrival, the second turns up at Town, the third at City. Local books never count toward the 75 or the 16 mysteries.

| Plot | What stood there | The door it opens | Its mystery (answer) | Prior leaders |
|---|---|---|---|---|
| Harrowford | The Alder ferry; a meadow full of rusted iron and no bones | The night the Grey Host was taken | The Field Without Bones (3:17) | Ned Harrow, the Warden of the Clock, Jessamy Harrow |
| Oakmere | King Aldric's hunting lodge, with a second cellar | The journal in every player's pack | The Cellar in the Oakwood (Aldric) | King Aldric, Rafe Aske, Giles Lorimer |
| Thistledown | An empty bell frame on the down | Corvin Hale before the court | The Empty Frame (Corvin) | Tam Burdock, the Tenant of the Down, Alys Burdock |
| Wrenfield | A royal summer house by the lake | Edda as a child | The Letter in the Apple Tree (Edda) | Mistress Thorpe, E. aged seven, Garth Appleyard |
| Frosthelm | Queen Maelis's copper diggings | The casting of the Founding Bell | Forty Tons of Copper (the Founding Bell) | Queen Maelis, Brand Holt, Master Ysolt |
| Wolfcairn | The cairn of six thousand and four stones | The Calling that fetched the Host | Six Thousand and Four Stones (a bell under the ice) | The First Cairn-Wife, Vorlund before he sailed, Runa Ashby |
| Gullcliff | A beacon station | Proof Corvin could not have called the Host | Sails Without Wind (two winters) | Ines Marrow, Piers Gannet, Brother-Clerk Aldhelm |
| Tidewatch | A tide-readers' house | The first Returned | The Last Post (the Returned) | Prior Benet, Brother Caedmon, Wat Tolley after |
| Reedmoor | The Even Market, a ring of nine posts | Two worlds trading before the Bell | The Even Market (every third night) | The Reeve, Old Sedge, Friar Colm |
| Lanternbog | A lantern house for the fen's lost | Slips, centuries before yours | The Loose Board (eleven years) | Marn, Ilse Tarn, Wenna Sedge |
| Redmesa | The carver's yard of the forty statues | The faceless statues; one face survives | The Forty-First Stone (forty) | Maren Sard, Lord Sorrel, "Under the Bench" |
| Dunehold | The Order's house of exiled copyists | The cover-up, from inside | The House at the Well ("On the Kingless Years") | Sister Imre, Prior Aubrey, Brother Osric |

None of the local books or portraits names or shows the last king as a man. Each plot's `build` note in `plots.js` lists the small landmark the map needs there; the map thread has reserved a spot (`PLOT_PLAN[i].relic`).

**Portraits and paintings** hang as entity `siege:portrait` (`scripts/lore/portraits.js`, generator `studio/build_lore_portraits.py`, painter's brief `studio/art/PORTRAIT-BRIEF.md`). The eight Long Gallery paintings are in the same system. Click one to read it.

## Ravens

The Ice Isles' birds. Every man of the Host fed one, and a raven carried his name home if he died abroad. When the Host cut down a bell it nailed up a raven in its place: a voice for a voice. When the Host was taken, six thousand birds were left with no names to carry, so they go where the Host is going next and wait. **Ravens on your wall at dusk mean a raid tonight**, and more come the longer your keep has stood. Sigrun explains it. (`scripts/lore/ravens.js`. A real raven bird is asked of the mobs thread; until then it is a line of text at dusk.) The birds are real in the game: at dusk on a siege night they sit in a row along the stretch of wall nearest you, two blocks apart, all looking out the same way, and they are gone when the siege starts.

## Places now on the map

Crownhold, the ruined capital with the Hall of Bells, is at -235, -345. Bellhollow, with the sealed Crack in the Deep, is at 155, -100: a dead door, there from the first day, guarded for nothing. Kingsrest is the spawn town below the old capital, not the capital.

## The reveal: who Morvane was

Mateo, 2026-11-10: the reveal must be "a huge poetic cinematic staged reveal", and the story, through the NPCs, must explain enough that the player knows who he is at the end. This replaces the older rule that the twist is never stated at all. The rule now: **nobody says it before the fight, the scene shows it without a name, and afterwards it is said plainly.** Words are in `scripts/lore/data/reveal.js`; the scene itself is the Hollow and mobs threads' work.

**Before the fight, three people each hold one piece**, and none of them knows the other two:

| Who | The piece | Sets |
|---|---|---|
| Brother Cael ("The portraits you burned. Whose?") | The Order listed forty-one burned portraits and the lamp oil it used. It never paid for a coffin or a grave for the king. | `heard_no_body` |
| Sigrun Ashby (after the Grey Host talk, "Say it outdoors, then.") | Those below have no names. If there is a name down there, Morvane, they made it for someone who had lost his own. | `heard_named` |
| Old Mag ("The day they took the king.") | She was eleven and watched. He was not thrown. He asked them to cut the rope and walked in upright, "like a man going down to his own cellar". | `heard_walked_in` |

When a player has all three, **Archivist Pell** greets them with the three cards side by side and refuses to finish the sentence: "You say it." He points at the Ledger page "Who Is Morvane?" and tells the player to look at his eyes and which hand he uses: the journal describes a right-handed boy, and Quill says the King came back from below using his left. All three pieces are also Ledger clues for that mystery.

**In the fight** (between the sixth and seventh stage, about a minute): a boy of nine at a desk, writing. One line writes itself across the screen, word for word from the journal's eleventh entry: "He is nine, grey-eyed, quick with his right hand and quicker to laugh, and he is afraid of nothing, which frightens me more than the rest of this book together." The room ages around him, boy to king to Morvane. He looks up and says the only spoken line: **"You kept my father's book."** Every bell in Aldmere tolls. No name is spoken.

**The journal's last page.** At that moment the Old King's Journal in every fighter's pack gains a thirteenth page in a different hand (`emit("journalLastPage", { player })`, and again as a safety net on his defeat). It says he found the book at nine, listened before he rang, heard a people asking for one night in three, knocked on the door every third night for three hundred years, and that the name they made for him means "the one who stayed". It ends: "You did not pack this book. I did." Signed **Oswin, son of Aldric, last King of Aldmere**. This pays off the item's first line, "You do not remember packing it."

**After the fight** (flag `morvane_fallen`): Brother Cael says it aloud, "Morvane was King Oswin. Aldric's son," and decides to write the thirteenth volume plainly. Sister Wren offers to remember the boy.

Proposed by the lore thread, for Mateo to overrule: that Morvane means "the one who stayed", and that it was he who put the journal in every player's pack.

## The singing

The Choir's one note, a low held hum (`scripts/lore/singing.js`, sound `siege.choir.hum`). Heard faintly everywhere on every third night and louder near a thin place or the Gate; all the time in the Hollow; within six blocks of a hidden Returned (the fifth tell); louder and a shade higher for a Sorcerer, more with Resonance; at full volume during a Slip. A player can stop their ears with `/scriptevent siege:hum off`. The sound file is a code-made placeholder until a real choir recording replaces it (`studio/build_lore_sound.py --from <file>`).

## The hidden Returned (four families)

Ordinary villagers who are secretly copies (the villagers and tells are `scripts/bestiary/returned.js`; the families and the truth are `scripts/lore/data/returned.js`). Tells the player can test: stands facing the Hollow when nobody is looking, tamed wolves growl, cannot bear a bell (it walks back to the Hollow and may take two villagers with it), and the hum. "Uses the wrong hand" is only ever told by the family, because a villager cannot show a hand.

| Asker | Suspect | Truth |
|---|---|---|
| Nessa Dunn, Millbrook bakery | her husband Harl | A copy. Kinder than the real one. |
| Jorund Kell, Rimehold net sheds | his father Bram | Himself: a ruined arm and failing eyes. Two tells are not proof. |
| Tilly Marsh, Gull's Rest sea wall | her little brother Pip | A copy, and she knows. She asks you to say nothing. Both choices are rewarded the same. |
| Hesper Lowe, Mirelight | her husband Odo | Odo is himself. Hesper is the copy and does not know. Ring a bell beside her. |

Place them with `/scriptevent siege:lore_npc <asker>` and `/scriptevent siege:lore_case <harl|bram|pip|hesper>`.

## Keeping it secret (reveal order)

Mateo's rule: the truth reveals itself slowly and is never stated early (see "The reveal" above for the end of it). **Place the tomes so the layers can't be skipped.**

| Layer | What the player believes | Carried by | Where it can sit |
|---|---|---|---|
| 0. Something is wrong | Odd things happen and nobody knows why | The Old King's Journal, Sister Wren, the First Slip | The first hour |
| 1. The official story (Act I) | A good king made some bargain and saved the realm; a wicked mage stole him away; raiders are just raiders | Chronicles 1 to 8 and 10, Sealed 1 to 5, most Testimonies | Open places: chapels, villages, ruins, the Order's reading room |
| 2. Something is off (Act II) | There is another world under this one. The Returned are not the people who left. The Order is hiding a king | Chronicles 9, 11, 12; Sealed 6 to 9; Letters; Corvin I to IV, VII, VIII; the regional bosses' confessions | Behind puzzles and regional bosses |
| 3. What really happened (late Act II, Act III) | There was a truce. We broke it. The saint was the king's daughter and she threw him in | **Corvin V** (Sunscar vault), **Corvin IX**, **Sealed 10** (under the tomb floor), Vorlund's Oath | Only behind the hardest gates |
| 4. Who is down there (Act IV) | The sieges are a debt, someone is leading them, and there is a third way | **Corvin X** (Burned Archive), **Litany of the Oathbreakers**, **The Last Testament**, *The Name We Were* | The Burned Archive, the Rift, the Hollow, the throne |

The mysteries "The Missing King", "The Broken Truce" and "Who Is Morvane?" each need one specific late clue before they can be answered, so the answers never appear early in a list. Aldous, Cael and Mag only react once the player has read the tome that proves each piece.

## Who lies, and why

| Voice | Collection | Reliability |
|---|---|---|
| Master Bertram Quill | The Oswin Chronicles (12) | Writes what the court tells him, but can't help noting true details (the coffin was too light, the King would not let him write the terms) |
| The Order | Sealed Records of the Ashen Gate (12) | Public records lie outright. Internal orders tell the truth. One unsent letter by Edda confesses everything |
| Corvin Hale | Corvin's Notebooks (10) | Truthful. He held the lamp at the truce. Burned for refusing to forget |
| Brother Fennick | The Surveyor's Field Notes (7) | Truthful but deliberately split up |
| Elias Marrow | The Lighthouse Letters (8) | Honest and wrong: he doesn't know he's an echo, or that his lamp guides things ashore. Written in cipher |
| The Choir | The Sung Verses (8) | True from the Hollow's side: they are the wronged party in their own telling. Written right to left (needs Tide Glass) |
| Ordinary people | Testimonies of the Lost Days (10) | Mixed. Officials lie, children and old women don't, and one is written by a changeling |
| The bosses | The Fallen (8) | True. Each boss tome is a confession |
| King Aldric | The Old King's Journal | Truthful and understands none of it |

### Deliberate contradictions players can catch

| One source says | Another says | Truth |
|---|---|---|
| Chronicle 8: the King "struck a bargain" and would not say what | Corvin V gives the terms word for word | Corvin |
| Chronicle 10: Corvin dragged the King below by treachery | Edda's unsent letter: "I put him through the Crack with my own hands, alive" | Edda |
| Sealed 2: there was never a King Oswin | The whole Chronicle; the journal's "my son"; the lighthouse keeper saw him | He existed |
| Sealed 3: the war was won by prayer | Corvin V, Vorlund's Oath | The Hollow took the Host as its side of the truce |
| The Order: the Hollow attacked us unprovoked | Corvin X: "We broke the truce, not they" | Corvin |
| Sealed 4: Saint Ashe was a shepherd's daughter | Chronicle 3, the unsent letter | She was Edda |
| Sealed 5: Corvin called the Grey Host with his bells | Chronicles 2 and 4: he arrived two years after the Host | The trial was a sham |
| Notice to Millbrook: the returned are "only tired" | The Order's own standing orders; Wren's account | They are shapes sent up from the Hollow |
| Parish register: Annet died of a fever | Letters 1 and 4 | The sea took her the night of the truce |
| Sunscar record: the wind wore the faces off | The Order's inventory; the Seneschal's confession | It was done with a chisel |
| Bestiary: "there is no single Warlord King" | Vorlund's Oath | It is one man, 300 years old |
| Chronicle 12: "Here lies Oswin" | Same tome: "It was too light" | The tomb is empty |
- **How long the peace lasted.** Chronicle 10 (the ordered lie) says the King was taken "in the second year of peace". Chronicle 3 has Edda born in the fourth year of the war and Chronicle 11 has her Regent at seventeen. The peace lasted about thirteen years. Dates if ever needed: Aldric's thirtieth year 399, crowning 409, truce 419, overthrow 432.
- **The King's hand.** Chronicle 9 and the fifth lighthouse letter make him left-handed after the truce, which reads like the mark of a Returned. He was not one: see "The King's hand". Corvin's fifth notebook now has him take the splinter in his right hand and flinch.

## The mysteries players solve (in the Ledger of Whispers)

Reading copies clues into the Ledger under the right mystery. With enough clues the player can answer. Typed answers can't be guessed from a list; a wrong answer locks the thread for a day. Everything here can be solved by one player alone.

| Mystery | Answer | How |
|---|---|---|
| The Old King's Journal | **Aldric** | Typed |
| Where Was I? (opens with the First Slip) | **The Hollow** | Typed |
| The Lost Days | Shapes sent up from the Hollow to fill the place of someone it took | Choice |
| The Stopped Clocks | **3:17** | Typed |
| The Missing King | Overthrown by his daughter and put through the Crack alive | Choice, needs a late clue |
| The Saint of the Gate | **Edda** | Typed |
| The Bell Beneath | The Hollow calls every third night; the angry and the empty march on the brightest keep | Choice |
| The Wrong Moon | The Hollow has its own moon; a full-moon door opens when ours is dark | Choice |
| The Ember | A splinter of the Hollow's own crown | Choice |
| The King of Raiders | **Vorlund** | Typed |
| The Broken Truce | A truce for every third night; his own people overthrew him and broke it | Choice, needs a late clue |
| The Keeper's Light | The lamp shows the Hollow's creatures the shore | Choice |
| The Faceless Statues | **Oswin** | Typed |
| The Name We Were | **Hallowmere** (the older spelling Hollowmere is accepted too; sets `true_name` for the third ending) | Typed |
| Who Is Morvane? | **Oswin** | Typed, needs a clue from the Hollow itself |
| The Wandering Gate | The real thin place, named in a Library | Deduction, below |

Solving them all fires `loreAllSolved` (the key to the hidden ending).

## A world played alone (voices for NPC "players")

In `lore/data/lords.js`: twelve **Rival Lords** (name, seat, region, one of six temperaments, eleven lines each including a third-night remark and a rumor that points at the story); ten names and all the lines for the **NPC rulers of the Hollow**; and extra job text for the town hall's **Rumor Board**. The lore module sends them out at load (`rivalLordVoices`, `rumorParts`, `setRegentVoice`).

## The First Slip

Early in Act I the player asks Sister Wren in Millbrook "Which clock was first?". She is cut off mid-sentence and the player Slips: about ten seconds at a lookout spot in the Hollow (the lookout on the Wound ledge: mist below with lights moving in it, no sky, one note; nothing like ours), then back, soaking wet. Wren's next conversation is her reaction: she counted nine heartbeats with the chair empty, and she has seen this once before, when her brother went and did not come back the same. She never names the place. The Ledger opens a mystery called "Where Was I?" that records what happened as a question. The player can only answer it (the Hollow) after finding the name in a tome.

## The seven thin places (build each one to match)

The Source and Rift sit at one of these, picked secretly per world. Six Field Notes each state one true thing about the real one. Every site has a different mix, so all six notes together leave exactly one. **The clue only works if each site is built with exactly these features.**

| Site | Region | Swim to reach it | Old bronze bell at the mouth | Cut by hands (tool marks) | Ice and snow | Salt in the air | Roots or trees over the entrance |
|---|---|---|---|---|---|---|---|
| The Drowned Chapel | Saltreach | yes | yes | yes | no | yes | no |
| The Bellfounders' Mine | Frostmarch | no | yes | yes | yes | no | no |
| King's Barrow | Vale | no | no | yes | no | no | yes |
| The Saltglass Grotto | Emberwaste | no | no | no | no | yes | no |
| Frostvein Gap | Frostmarch | no | no | no | yes | no | no |
| The Sunken Quarry | Vale | yes | no | yes | no | no | no |
| The Witchroot Caves | Blackfen | yes | no | no | no | no | yes |

A player shelves the six notes, reads them, visits the sites, and uses **Name the Thin Place** in their Library catalog. Wrong costs 3 days. Right fires `loreSourceNamed`.

## Characters (built-in NPC entity, hand-written, Realm-safe)

| Id | Who | Where | What they lead to |
|---|---|---|---|
| `wren` | Sister Wren, healer whose brother came back wrong | Millbrook | Recognises the Old King's Journal. The clock tower, the Order's waystation, Rimehold and Sigrun. Gives *What Happened to Tobin* |
| `aldous` | Sir Aldous Vane, young knight who believes the Order | Comes for the Ember, then the chapterhouse | The chapterhouse, Corvin's Tower (if you are a Sorcerer), Brother Cael. Turns ally once you've read Edda's letter |
| `mag` | Old Mag, Corvin's last apprentice, 311 | Mirelight | Corvin's Tower, the frozen lake, the changeling. Gives Notebook III, a hymn, and (once all ten notebooks are read) *The Name We Were* |
| `elias` | The Lighthouse Keeper, an echo who doesn't know it | Gull's Rest lighthouse | The letters, the Cipher Wheel, the sunken chapel. Ends by asking you to put the lamp out |
| `sage` | Archivist Pell, thrown out of the Order for reading | Your town hall or Library | The hint system: how the Library works, how to weigh sources, how to find the Source |
| `cael` | Brother Cael, the Order's archivist | Chapterhouse archive | The Burned Archive (only if Aldous sends you), then King's Barrow |
| `sigrun` | Sigrun Ashby, Wren's northern cousin | Rimehold | The lake, the shrine, the hunter's lodge. Gives *Grandmother Ashby's Account* |
| `isolde` | Warden Isolde | Sunscar | The statue fragments, the vault riddle ("grey eyes over a laughing mouth, the right hand raised") |
| `kesh` | Kesh Cinder, Wingmistress of the Cinder Roost, last of Ysolt's line, grounded since her dragon was shot down | The Cinder Roost above Sunscar | The Dragon Rider trial: the Span, the Choosing, the Hatching. Knows why dragons won't fly on the third night and won't say until Drake-Captain |
| `ulla` | Ulla Deepforge, keeper of Hroda's fire | The Deepforge above Rimehold | The Forgemaster trial: the side-hearth, Hroda's Hand-bell rung on the ice, the Huntsman. Knows the Order took the bell moulds |
| `ottilie` | Harbourmistress Ottilie Holt, Merrin Holt's descendant, keeper of the Debt Book | Harbour office, Gull's Rest | The Captain trial: the articles, a crew, the Drowned Bride. The back of the Debt Book waits for Captain rank |
| `nell` | Nell Sedge, of Goody Sedge's line; hasn't spoken to Old Mag in sixty years | Raft-house past Mirelight | The Witch trial: the cup, three graves, the Mother of Changelings |

What a character says depends on what you've read, solved and done, and whether you are a Sorcerer.

## Placing things on the map

- **Tomes:** `/scriptevent siege:lore_list <collection>` prints every tome id with where it belongs. `/scriptevent siege:lore_give <id>` gives one. Place a **Dusty Tome** block and click it in creative holding the tome to bind it. Every player gets their own copy from it, once.
- **Characters:** `/scriptevent siege:lore_npc <id>` spawns one where you stand (`list` shows them all).
- **Places:** `/scriptevent siege:lore_mark_place <id>` records a town or ruin so Ledgers can show a heading to it. Hidden places never get a heading.
- Drops need no placing: each boss drops its confession, some night creatures drop hymns and testimonies, the first siege win drops *Hymn for the Coming Crown*.
- **The journal** needs no placing either: every player is given it the first time they join. `/scriptevent siege:journal` gives another copy.

## The first sighting and the morning after

Mateo, 2026-11-10: the raids start as men (Grey Host variants) and one night become actual soldiers of the Hollow, "the first real what the heck is that moment", before anyone knows what the Hollow is. The siege raids feature stages the night itself (the army stops, looks back, and a Veinsworn walks up through it). Lore owns the morning after (`scripts/lore/glimpse.js`). Each settlement gets its own first sighting (Mateo's decision card, 2026-11-10), so the morning after is told per settlement: to its owner, its allies and whoever stood inside it that night.

- At first light your own people talk about it (three versions if you were there, one if you were away). Nobody names it.
- Five people then have one new conversation each, and each holds one corner only. Sigrun: the Host never brought anything like that, it was the last thing the Host saw, and "last night it sent one of its own". Brother Cael: an unlabelled drawer of eleven reports over three hundred years, each written the season before a village went silent; the old brothers' phrase "tall company". Old Mag: it was not angry, it was sent to look, to see how high you build; she will not say what it is. Sir Aldous: he reported one and watched the clerk burn the page without surprise. Archivist Pell: nothing in the books, but pages neatly cut from four of them.
- Nobody says the Hollow's name for itself, Morvane, or Oswin in any of it. The player should leave with the question "sent by what?".

## Where the mobs come from (agreed with the wiki thread, 2026-11-10; not yet seen by Mateo)

- Bell-Ringer: carries a small copy of the bell the marchers hear under the ice, so they never stop hearing it.
- Siege Ogre: Ice Isles giants the Grey Host used to pull down bell towers; taken with the Host.
- Crow-Mage: the Host's war-priests, the ones who nailed a raven up for every bell. Their own ravens left them that night. Bellcrows are what they were given instead, and are not ravens. The silent ravens on a wall serve nobody.
- Wrongling: a copy (like the Returned) left above too long with nobody to copy.
- Echo Hound: Sir Gerrit's pack. It followed him under the ice and turned on him (The Huntsman's Tally). Blind; it was bred to hunt Corvin's students by the hum of the Ember.
- Rimewolf: ordinary Frostmarch wolves that have started answering the Huntsman's horn. Not of the Hollow.
- Mirror Knight: one of the Hollow's people who studied the knights that went down the Gate. It copies how you fight, not our world.
- Tolling Shade: a loose echo of the bell below. Gloamwing: the Hollow's carrion birds.
- Bog Hag: NOT Corvin's students. The thing under the Witchroot swamp has kept people for as long as there has been a swamp; the hags are the ones it kept before Mag, and less kindly.
- Twelve students: Mag was one of the twelve. Gerrit truly caught ten. His hounds lost Mag in the swamp and he notched her anyway rather than report a failure; the twelfth went under the Rimehold ice. So "eleven notches" has one lie in it, and Mag's "he got the others" is what she believes.
- Barrow Wight: the kings' buried household at King's Barrow, woken by the seep. Never say what they guard (the tomb is empty; that is a late clue).
- Brine Lurker: one of the things the lighthouse lamp guides ashore (late spoiler, belongs to the mystery The Keeper's Light).
- Inquisitor: its silence is the bell-wardens' Vigil (Quiet Mind), turned outward.
- Frost Stag, Ash Scarab, Dune Wyrm, Mire Toad: plain animals.

## Never the same line twice (Mateo, 2026-11-10: "it should never, ever, ever get repetitive and/or boring")

Rule for all lore text: anything a player can hear more than a few times needs a pool, and the picker must never give the same wording twice running. Built so far: every story character's "hub" greeting has four wordings (`greets` on the node; the self-test fails if a hub has fewer than three extra), the dusk ravens have eight lines for each state, moon doors four each, traders' rumors 22. One-time scenes need no variants.

## Doors left open for later updates (design thread's proposals, NOT approved by Mateo)

- Lights over the sea / land past the charts: in the traders' rumors only. No answer exists.
- A book in letters nobody reads: rumor only. If built, keep it distinct from the cipher (Lighthouse Letters) and the backward writing.
- One sealed door per region: rumor only. A moon door with no carving would do it (`moondoors.js` would need a carving that never opens).
- A crossed-out name in Aldric's journal: NOT added. The journal "names nothing" by Mateo's ruling and its entry 11 is quoted word for word in the reveal, so this needs his say first.
- A "Chronicle" book that gains a page each update: not built; needs Mateo's say (it would be a second starting book beside the journal).

## The story spine: home boss first, then your order

Mateo's pick on a decision card, 2026-11-10 (relayed by the whole-mod review). Data in `scripts/lore/data/spine.js`.

1. **Every first book ends at Sister Wren.** Players land on their plot and never pass through Millbrook, so each plot's first local book has a last page in a newer hand that gives that plot's own reason to go to Millbrook and ask for her. It also puts Millbrook in the Ledger.
2. **Your plot's mystery leads to your region's boss.** Solving it adds a closing paragraph and a lead: Vale to the Clockwork Reeve (Millbrook clock tower), Frostmarch to the Pale Huntsman (the lake at Rimehold), Saltreach to the Drowned Bride (the sunken chapel), Emberwaste to the Ash Seneschal (the Faceless Vault), Blackfen to the Mother of Changelings (the Witchroot Caves).
3. **Each of the five leaves two leads, in two other regions,** as a scrap found on it, on top of its confession. Reeve: Rimehold lake and the lighthouse. Huntsman: the sunken chapel and Mag's hut. Bride: Sunscar and Mirelight. Seneschal: King's Barrow and Rimehold. Mother: the Faceless Vault and Crownhold. No two bosses send you to the same pair of regions.
4. **Three down and the routes converge.** The third regional boss gives the first Surveyor's Field Note and says the three were "standing round" the cause. The six notes leave one thin place, and that is the Rift. (Three of five is the lore thread's number, not Mateo's.)

Layers are kept: none of the new text names the Hollow, the truce, Edda or who leads. Lanternbog's mystery used to take "the Hollow" as its typed answer in the first chapter; it now asks how long Wenna Sedge was gone (eleven years).
## The four regional roles (lore thread's proposal, not yet read by Mateo)

None of the four is the Hollow's; each is what a region already knew before the bells. Full text in `scripts/lore/data/roles.js`.

| Role | Region | First to hold it | Why the region keeps it |
|---|---|---|---|
| Dragon Rider | Emberwaste | Ysolt Cinder, a salt-carrier's daughter | The Waste was the one province the Grey Host never held. The dragons will not fly on the third night |
| Forgemaster | Frostmarch | Hroda Deepforge, bellfounder; the Founding Bell was poured at her fire three generations later | The Order took the bell moulds but could not carry off the fire |
| Captain | Saltreach | Merrin Holt, who burned forty Saltreach boats to stop the Host's second fleet | Every captain carries a share of Holt's Debt, which has never been marked paid |
| Witch | Blackfen | Nobody; "Goody Sedge" has three graves | No books to burn: it is handed over in a cup |

## Where the eight paintings hang

Mateo's eight paintings are already in the game as hanging pictures (`siege:portrait`, textures `textures/entity/portrait/plate_1..8.png`). Seven hang openly: one in each settlement's Library (which one depends on the plot) and all seven in a row with `/scriptevent siege:portrait gallery` (meant for the Long Gallery at Crownhold). **The eighth, the Forty-Second Portrait, is a secrecy call and hangs only in the Burned Archive**, which a player reaches late through Brother Cael. Its caption never says whose portrait it is until Morvane has fallen; after that it reads "Oswin, son of Aldric, last King of Aldmere" and says he scraped the face off himself the night before they came for him (that last detail is the lore thread's, not Mateo's).

## The Hollow's middle stretch (Mateo approved 2026-11-11)

Between the Rift and the Choir. The guide is **the Carter**, who drives the dawn ore cart from the villages to the Seat. She has no name, because those below have none; the Hollow names only people who have lost their own. Her younger brother was taken from Highcut to sing in the Court. She has passed the Chair a hundred times and never looked up at the face.

- **The ore.** Choir Ore holds a note. Every stone goes to the Seat, then to the Court, where the Singers hold it while they sing at the Door. Every siege above is paid for by a miner here.
- **The Truce Hall.** One chair is still standing (the Hollow's) and one is knocked over (ours). The hum replays "Then it is sworn." *The Name We Were* lies on the lectern.
- **The Standing Ranks.** The whole Grey Host, taken as promised. The one empty place at the head of the front row is Vorlund's.
- **The Far Door.** The crack across the seal is the Founding Bell's stroke. Choir Ore picks are worn to the handle. They are digging home.
- **The Drift.** From the top stone the player sees a figure in the Chair, far off, lift its LEFT hand, and the whole Hollow changes key.
- **The Seams.** Wreck the dawn cart (the Choir has less to sing with, so fewer phantom raids) or let it go (the miners remember: half price at every Tally).
- **The Choir is the miners' own children.** A silenced Singer does not die. Afterwards they get up and walk home with no voice. The player names the Carter (Lark, Morrow or Dawn). She points out that the one in the Chair was given his name the same way, and has never once looked at the river.

Nothing in it says Oswin.
