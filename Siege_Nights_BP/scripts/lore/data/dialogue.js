// Hand-written conversations for the story NPCs. They run on Bedrock's built-in NPC entity
// (minecraft:npc) so they work on a Realm. tools/build_lore.py turns this file into
// Siege_Nights_BP/dialogue/siege_lore.json; lore/npcs.js decides which scene each player sees.
//
// Each NPC:
//   start: [[conditions, node], ...]   the first line whose conditions all hold is where the talk opens
//   nodes: { id: { text, opts: [[button label, next node or "end", effects?], ...] } }   (max 6 buttons)
//
// Conditions: "flag:x" "!flag:x" "read:tome_id" "clue:id" "solved:thread" "col:collection"
//             "shelved:N" (your Library holds N tomes) "path:marked" "path:knight" "resonance:60" "night"
// Effects:    "flag:x" "tome:tome_id" "clue:id" "lead:place_id" "sp:1" "item:siege:cipher_wheel"
//             "slip:first" (the player Slips into the Hollow for a few seconds; see npcs.js)
// "next node" may also be a list like start, to send the player different ways: [[conditions, node], ...]
// Every effect only ever happens once per player.

export const NPCS = [
  // ------------------------------------------------------------------ Sister Wren, Millbrook
  {
    id: "wren", name: "Sister Wren", where: "Millbrook, in or outside the chapel. Healer, about 60 (in a village where the night never ends, nobody is sure).",
    start: [
      [["flag:slipped_first", "!flag:wren_slip_talked"], "slipback"],
      [["solved:lost_days"], "after"],
      [["flag:wren_trust"], "hub2"],
      [["flag:wren_met"], "hub"],
      [[], "first"],
    ],
    nodes: {
      first: {
        text: "Mind the step, traveler. It's dark, I know. It's been dark in Millbrook since before I was born.\n\nI'm Sister Wren. I patch people up. You're from one of the new keeps, aren't you? You have that look. Like someone who has started counting to three.",
        opts: [
          ["Counting to three?", "three", ["flag:wren_met"]],
          ["Why is it always night?", "night", ["flag:wren_met"]],
          ["I have an old journal. Do you know it?", "journal", ["flag:wren_met"]],
          ["I should go.", "end", ["flag:wren_met"]],
        ],
      },
      journal: {
        text: "Let me see. Red leather, the royal seal... and the name cut off the cover. Put that away. Now, please.\n\nThe knights burned every book that king ever touched, and his son's after him. Whoever put that one in your pack wanted it to outlive them.\n\nI won't ask where you got it. I notice you don't know either.",
        opts: [
          ["Which king?", "journal2", ["clue:wren_knows_journal"]],
          ["Why is it always night?", "night"],
          ["I'll keep it hidden.", "end", ["clue:wren_knows_journal"]],
        ],
      },
      journal2: {
        text: "If I knew his name I wouldn't say it in a house with a well. Read old Quill's chronicle, if you can find a volume the Order missed. Chroniclers write down who was whose father. It's most of what they do.\n\nAnd read the journal itself. A man tells you who he is by what frightens him.",
        opts: [
          ["Why is it always night?", "night"],
          ["Thank you, Sister.", "end"],
        ],
      },
      three: {
        text: "Every third night they come for your walls. You've noticed. Everyone with walls notices.\n\nNobody here will tell you why, because nobody here knows. The knights know. Ask a knight and watch his face go smooth as a plate.",
        opts: [
          ["Where are the knights?", "knights"],
          ["Why is it always night?", "night"],
          ["Thank you, Sister.", "end"],
        ],
      },
      night: {
        text: "The clocks. Six of them, and every one reads the same minute. Old Reeve Tock stopped them, long ago, and the night stopped with them.\n\nPeople here like it. In the dark you can't see who is facing the wall.\n\nThe Reeve left a statement in the clock tower. Read it before you go asking villagers which clock is which. Some of them will lie to you.",
        opts: [
          ["Which clock was first?", [[["flag:slipped_first"], "which"], [[], "which_cut"]]],
          ["Facing the wall?", "walls"],
          ["Where's the clock tower?", "end", ["lead:millbrook_clocktower"]],
          ["Thank you, Sister.", "end"],
        ],
      },
      // THE FIRST SLIP. Wren is cut off mid-sentence and the player is pulled into the Hollow for a
      // few seconds (the Undertow feature does the glimpse). She never gets to finish the answer.
      which_cut: {
        text: "The first one? Now that IS the question, and I'll tell you what my mother told me. The Reeve started with the clock in the\n\nTraveler?\n\nTraveler, your nose is bleeding. Look at me. Look at ME, not at the wall, what are you looking at the w",
        opts: [["...", "end", ["slip:first"]]],
      },
      slipback: {
        text: "There you are. THERE you are. Sit. Sit down.\n\nYou went grey as tallow, and then the chair was empty. I counted. Nine. Then you were in it again, wet to the skin, and my floor is bone dry.\n\nI have seen that once before. I was nine years old and it was my brother. He was gone the whole night.",
        opts: [
          ["Where was I?", "slipwhere", ["flag:wren_slip_talked", "flag:wren_trust"]],
          ["I'm fine.", "slipfine", ["flag:wren_slip_talked", "flag:wren_trust"]],
        ],
      },
      slipwhere: {
        text: "Don't tell me what you saw. I can see it on you. It wasn't anywhere, was it? Nowhere on any map of ours. I can smell the water on you.\n\nI don't have a name for it. I think the knights do, and I think they've spent three hundred years making sure nobody else does.\n\nAll I know is that it let go of you. It didn't let go of Tobin. Stay away from the well tonight.",
        opts: [
          ["Tell me about Tobin.", "tobin1"],
          ["I need some air.", "end"],
        ],
      },
      slipfine: {
        text: "You are not fine. Your sleeves are dripping and you're holding that cup in your left hand. You came in here right-handed.\n\n...There. It's passing. You've switched back. Saints, I hoped I'd never watch that happen twice.\n\nIt let go of you. It didn't let go of my brother. I'd like to know why, and so should you.",
        opts: [
          ["Tell me about Tobin.", "tobin1"],
          ["I need some air.", "end"],
        ],
      },
      which: {
        text: "The first clock. I was about to say, wasn't I, before you... went.\n\nI find I've lost the nerve to say it out loud. Maybe that was the point. Read the Reeve's statement in the tower, then ask the villagers which clock he stopped first. All six will answer. One of them will be lying, and you'll know which once you've heard the other five.",
        opts: [["I'll ask them.", "end", ["lead:millbrook_clocktower"]], ["Back.", "hub"]],
      },
      knights: {
        text: "The Ashen Gate keep a chapterhouse east of the Vale road. Grey banners. They used to keep a waystation here too, by the mill. It's empty now, but they left in a hurry, and people who leave in a hurry leave things in cupboards.",
        opts: [
          ["I'll look.", "end", ["lead:ashen_chapterhouse", "lead:millbrook"]],
          ["Back.", "hub"],
        ],
      },
      walls: {
        text: "Forget I said it.\n\n...No. You have kind eyes, and I am tired of forgetting things on purpose. Come back when you've read something about the Lost Days. Then you'll know what to ask me, and I'll know you're serious.",
        opts: [["I will.", "end"]],
      },
      hub: {
        text: "Still dark, still here. What do you need?",
        opts: [
          ["The Lost Days.", "lost_gate"],
          ["The clocks.", "night"],
          ["The knights.", "knights"],
          ["Nothing. Be well.", "end"],
        ],
      },
      lost_gate: {
        text: "You say those words like someone who has heard them, not someone who has read them.\n\nThere's a notice in the square about it. The Reeve's office wants everyone to know there is no cause for alarm. Read it. Then tell me if you believe it.",
        opts: [
          ["I read it. It's a lie.", "tobin1", ["flag:wren_trust"]],
          ["I'll go and read it.", "end"],
        ],
      },
      hub2: {
        text: "Ask, then. Quietly.",
        opts: [
          ["Tell me about Tobin.", "tobin1"],
          ["How do I tell the Returned?", "tells"],
          ["Where do they go?", "where"],
          ["The clocks.", "night"],
          ["Be well, Sister.", "end"],
        ],
      },
      tobin1: {
        text: "My brother. He was eleven. He went to the well on a third night and came home in the morning, and my mother said he was only tired.\n\nHe lived in our house for forty more years. He was kind to me every day of them. He was not my brother.",
        opts: [
          ["How did you know?", "tobin2"],
          ["I'm sorry.", "hub2"],
        ],
      },
      tobin2: {
        text: "I wrote it down when I was nine, so I would never talk myself out of it. It's in a box under my stairs.\n\nTake it. I know it by heart. Put it somewhere it will be kept. That is all I ever wanted for it.",
        opts: [
          ["I'll keep it safe.", "hub2", ["tome:test_02"]],
        ],
      },
      tells: {
        text: "Three things. My mother's generation knew them and were fined two silver for saying so.\n\nI won't hand them to you. You'll find them written in more than one place, by people who never met each other, and that is how you'll know they're true. Write in your Ledger when you're sure what the Returned are.",
        opts: [["I'll work it out.", "hub2"]],
      },
      where: {
        text: "Down. Tobin went to the well. In Hollowfast they walked out onto the lake. In Gull's Rest it was the sea.\n\nAlways water, always the third night. If you want to know more about the lake, there's a woman in Hollowfast called Sigrun whose grandmother followed the footprints.",
        opts: [
          ["Hollowfast. North?", "end", ["lead:hollowfast", "lead:millbrook_well"]],
          ["Back.", "hub2"],
        ],
      },
      after: {
        text: "You worked it out. I can see it on you.\n\nThen you know my real brother has been singing under that well for longer than I've been alive. If you ever get down there, traveler: his name is Tobin Ashby. Say it to them. I think they forget.",
        opts: [
          ["I'll say his name.", "end", ["flag:promise_tobin", "sp:1"]],
          ["Tell me about the clocks.", "night"],
        ],
      },
    },
  },

  // ------------------------------------------------------------------ Sir Aldous Vane
  {
    id: "aldous", name: "Sir Aldous Vane", where: "Rides to a player's keep the morning after their first siege win (spawned by the story engine), then waits at the Ashen Gate chapterhouse. Young, earnest, believes everything the Order told him.",
    start: [
      [["read:seal_10"], "edda"],
      [["read:seal_09"], "confront"],
      [["path:marked"], "marked"],
      [["flag:aldous_met"], "hub"],
      [[], "first"],
    ],
    nodes: {
      first: {
        text: "Hold. Sir Aldous Vane, Order of the Ashen Gate.\n\nA light fell near this keep last night. Pale, about so big, and it hums. I am charged to take it into the Order's keeping. Have you seen it?",
        opts: [
          ["What is it?", "what", ["flag:aldous_met"]],
          ["Why does the Order want it?", "why", ["flag:aldous_met"]],
          ["I haven't seen anything.", "end", ["flag:aldous_met"]],
        ],
      },
      what: {
        text: "A fallen star. That is what I was told and that is what I will tell you.\n\n...It did not look like a star to me either. Stars do not whisper. But a knight of the Gate does not ask what lies below. It is the second line of the Rule.",
        opts: [
          ["What's the first line?", "rule"],
          ["Why does the Order want it?", "why"],
          ["Good day, Sir Aldous.", "end"],
        ],
      },
      why: {
        text: "\"If ever a light falls from below, a knight shall ride to it and take it, before it takes anyone.\" That is the Rule.\n\nFrom below. I have always thought that a strange word to use about something that fell out of the sky.",
        opts: [
          ["May I read this Rule?", "rule"],
          ["Good day.", "end"],
        ],
      },
      rule: {
        text: "Every knight carries a copy. Take mine, I know it by heart. If you would rather swear to it than fight beside it, come to the chapterhouse, east of the Vale road.\n\nAnd if you find that light: do not pick it up with your bare hand.",
        opts: [
          ["Thank you.", "end", ["tome:seal_01", "lead:ashen_chapterhouse"]],
        ],
      },
      hub: {
        text: "Well met again. The roads are worse every month. What can I do for you?",
        opts: [
          ["Tell me about the Order.", "order"],
          ["Why do the sieges come?", "sieges"],
          ["Who was Saint Ashe?", "ashe"],
          ["Good day.", "end"],
        ],
      },
      order: {
        text: "We were eleven hundred once. We are eleven now. We keep the Gate shut and the ash cold, and we watch the keeps.\n\nIf you want our history, ask Brother Cael in the archive. He will give you the version we give to guests. Ask him twice and he may give you another.",
        opts: [["Back.", "hub", ["lead:ashen_chapterhouse"]]],
      },
      sieges: {
        text: "Bandits. Illagers out of the badlands, the restless dead, sellswords. It is a lawless age.\n\nEvery third night. Yes. I have noticed that too. I asked the Grandmaster once and he looked at me the way my father did when I asked where the dog had gone.",
        opts: [["Back.", "hub"]],
      },
      ashe: {
        text: "Our founder. A shepherd's daughter from the hills above Bellhollow, marked on the palm by the saints. There's a shrine there, and a little book of her life in every chapel of ours.\n\nShe never wept, they say. I have always found that the saddest thing about her.",
        opts: [["Back.", "hub", ["lead:bellhollow"]]],
      },
      marked: {
        text: "Your hand. Show me your hand.\n\n...Saints. You picked it up.\n\nI am supposed to bring you in. I am supposed to bring you to the Inquisitors. I have known you since the morning after your first siege and I find I am not drawing my sword. Go. Before I remember my oath.",
        opts: [
          ["What will it do to me?", "marked2"],
          ["Thank you, Aldous.", "end"],
        ],
      },
      marked2: {
        text: "I don't know. That is the truth and it shames me. We take the lights and we are never told what becomes of them.\n\nThere was a mage, once. The Order burned him. They say his students hid his notebooks all over Aldmere. If anyone wrote down what you are now, it was him.",
        opts: [["I'll find them.", "end", ["lead:corvins_tower"]]],
      },
      confront: {
        text: "You've read it. The Grandmaster's own hand. \"Let them think it is bandits.\"\n\nI have told forty keeps it was bandits. I told YOU it was bandits. I believed it.\n\nGive me a little time. A man cannot put down his whole life in one afternoon.",
        opts: [
          ["Help me find the rest.", "confront2"],
          ["Take the time you need.", "end"],
        ],
      },
      confront2: {
        text: "There is a vault under the chapterhouse they call the Burned Archive. I have stood guard on its door a hundred nights and never once asked what was behind it.\n\nBrother Cael has the key. Tell him I sent you. Tell him I'm asking now.",
        opts: [["I'll tell him.", "end", ["flag:aldous_sent", "lead:burned_archive"]]],
      },
      edda: {
        text: "She was his daughter. Our saint overthrew her own father, put him down a hole alive, and built us to stand on the lid.\n\nI thought I would be angry at her. I think she was seventeen, and watched her people get out of bed and walk into the water every third night, and did a terrible thing to stop it. Then she lied for the rest of her life so no one would undo it. I don't know if she was right. I don't think she knew.\n\nI'm with you. Whatever is at the bottom of this, I'm with you.",
        opts: [["Then let's finish it.", "end", ["flag:aldous_ally", "sp:1"]]],
      },
    },
  },

  // ------------------------------------------------------------------ Old Mag, Mirelight
  {
    id: "mag", name: "Old Mag", where: "Her hut past the last lantern of Mirelight. Says she is 311. She is.",
    start: [
      [["col:corvin", "flag:mag_believed"], "allbooks"],
      [["flag:mag_believed"], "hub"],
      [["flag:mag_met"], "second"],
      [[], "first"],
    ],
    nodes: {
      first: {
        text: "Wipe your feet. Not there. THERE.\n\nI'm Mag. I'm three hundred and eleven years old. Go on, laugh. They all do. Then they ask for something for a cough.",
        opts: [
          ["I believe you.", "believe", ["flag:mag_met"]],
          ["That's impossible.", "doubt", ["flag:mag_met"]],
          ["Something for a cough?", "cough", ["flag:mag_met"]],
        ],
      },
      doubt: {
        text: "So is an army marching on your walls every third night with nobody leading it. Yet here you are, with mud from a keep on your boots.\n\nCome back when you've seen something impossible and stopped arguing with it.",
        opts: [["...", "end"]],
      },
      cough: {
        text: "Marsh mallow root, honey, don't breathe the fog after dark. Two emeralds, which I'll waive, because you asked a sensible question in a house full of nonsense.\n\nNow. Do you want the cough cure, or do you want to know why I'm old?",
        opts: [
          ["Why are you old?", "believe"],
          ["Just the cure.", "end"],
        ],
      },
      second: {
        text: "You again. Seen anything impossible yet?",
        opts: [
          ["Yes. I believe you now.", "believe"],
          ["Not yet.", "end"],
        ],
      },
      believe: {
        text: "Hm. You said that like you meant it.\n\nI was twelve when they burned my teacher. He was the King's mage. You won't find the King in any book the knights let you read, either. I ran into the fen with a satchel and a head full of things I didn't understand, and something under the swamp took a liking to me, and I stopped getting older.\n\nHere. My testimony. Wrote it myself, for the day someone believed me.",
        opts: [["Tell me more.", "hub", ["flag:mag_believed", "tome:test_08", "lead:mags_hut"]]],
      },
      hub: {
        text: "Sit. Ask. Don't touch the jars.",
        opts: [
          ["Your teacher.", "corvin"],
          ["The moon.", "moon"],
          ["Mirelight's villagers.", "villagers"],
          ["The backward hymns.", "hymns"],
          ["Goodbye, Mag.", "end"],
        ],
      },
      corvin: {
        text: "Corvin Hale. Rude, brilliant, never washed. He wrote ten notebooks and twelve of us carried them off in twelve directions the night before the fire. A hunter with hounds got eleven of us.\n\nThe notebooks are still out there. His tower in the Vale hills, the north lake, the lighthouse, the desert vault. One of them is under my bed and I will deny it.",
        opts: [
          ["Under your bed?", "bed"],
          ["Back.", "hub", ["lead:corvins_tower"]],
        ],
      },
      bed: {
        text: "I never said that.\n\n...Fine. Notebook Three. It's the one about the moon. It's the only one I ever understood. Take it. Bring the rest together some day, all ten on one shelf, and come and tell me. I have waited three hundred years to hear someone say they did.",
        opts: [["I will.", "hub", ["tome:corv_03"]]],
      },
      moon: {
        text: "\"What the carving shows, the sky must not.\" He made us chant it.\n\nThere's a door in the north, at the Hollowfast lake. A shrine with a moon cut into it. One of us went through that door with the hunter behind her. I don't know which of them I feel sorrier for.",
        opts: [["Back.", "hub", ["clue:wrong_moon_rule", "lead:frozen_lake"]]],
      },
      villagers: {
        text: "Five of them have lost days. Four of those came back as themselves, only frightened. One didn't.\n\nI know which. I won't say. If I name it, it runs, and the Mother makes another. You'll have to catch it in a lie. Talk to all five. A shape wears the person like a borrowed glove. It gets the small things wrong.",
        opts: [["Back.", "hub", ["lead:mirelight"]]],
      },
      hymns: {
        text: "Choir scripture. It's written right to left, the way they wrote before there was an Aldmere. Don't read it at night and don't read it aloud.\n\nThere's one carved inside the well bucket here. I copied it out fair, years ago. You may have it if you promise not to hum.",
        opts: [["I promise.", "hub", ["tome:scri_04"]]],
      },
      allbooks: {
        text: "All ten. On one shelf. You did it.\n\n...Give me a moment.\n\nHe told me one thing he never wrote down, because he was afraid of who might read it. This land had another name, before the bells. He never learned it. But he knew who still uses it: they do. It's in one of their hymns, and their hymns sometimes wash up.\n\nThis washed up in my fen forty years ago. I've never dared read it. You do it.",
        opts: [["Thank you, Magda.", "hub", ["tome:scri_07", "flag:mag_gave_name", "sp:2"]]],
      },
    },
  },

  // ------------------------------------------------------------------ Elias Marrow, the Lighthouse Keeper
  {
    id: "elias", name: "The Lighthouse Keeper", where: "Lamp room of the lighthouse at Gull's Rest. Never leaves. Has been writing to his drowned wife for 300 years.",
    start: [
      [["read:lett_08"], "last"],
      [["read:fall_03"], "freed"],
      [["flag:elias_cipher"], "hub"],
      [["flag:elias_met"], "second"],
      [[], "first"],
    ],
    nodes: {
      first: {
        text: "Mind the lamp. Don't stand between it and the sea.\n\nI'm the keeper. Elias. Forgive me, I'm writing to my wife, and I lose the thread if I stop.",
        opts: [
          ["Where is your wife?", "wife", ["flag:elias_met"]],
          ["What are you writing?", "writing", ["flag:elias_met"]],
          ["I'll leave you to it.", "end", ["flag:elias_met"]],
        ],
      },
      wife: {
        text: "Out. She went down to the strand to see the seabed, the night the sea drew back. She'll be home when she can see the light.\n\nThe parish register says a fever. The parish register is wrong. I've told them and told them.",
        opts: [
          ["When was this?", "when"],
          ["What are you writing?", "writing"],
        ],
      },
      when: {
        text: "Oh... a little while ago. The night the war ended.\n\nWhich war? THE war. The Grey Host. Their ships were lying on the sand like dead whales.\n\nYou're looking at me the way the new priest does.",
        opts: [["What are you writing?", "writing"], ["I should go.", "end"]],
      },
      writing: {
        text: "Letters. I put them in bottles, mostly. The sea brings some back and the gulls take others. You'll find them up and down this coast if you look.\n\nYou won't be able to read them. Annet and I wrote in a cipher of our own when we were courting, so her father couldn't. There was a brass wheel for it. I lost mine years ago, somewhere inland.",
        opts: [
          ["A brass wheel?", "wheel"],
          ["I'll look for them.", "end", ["lead:gulls_rest"]],
        ],
      },
      wheel: {
        text: "Two rings of letters, one turning inside the other. A scholar's toy. I lent it to a man from the Vale who was collecting old books, and he never brought it back.\n\nIf you keep books yourself, look between them. That's where such things end up.",
        opts: [["I'll look.", "end", ["flag:elias_cipher", "lead:lighthouse"]]],
      },
      second: {
        text: "Mind the lamp. Oh, it's you. Did you find any of my letters?",
        opts: [
          ["Tell me about the cipher.", "writing"],
          ["Tell me about Annet.", "wife"],
          ["Not yet.", "end"],
        ],
      },
      hub: {
        text: "Mind the lamp. Have you read them? Any of them? I'd like to know someone has.",
        opts: [
          ["The tide and the chapel.", "tide"],
          ["The man from the sea.", "man"],
          ["Why never put it out?", "lamp"],
          ["Goodbye, Elias.", "end"],
        ],
      },
      tide: {
        text: "Once a month, when the moon is dark, the sea goes out nearly as far as it did that night. You can see the tower of Saint Brannoc's from here.\n\nI have the place worked out to the very stone. It's all in the seventh letter. I keep meaning to go.",
        opts: [["Back.", "hub", ["clue:dark_moon_low_tide", "lead:sunken_chapel"]]],
      },
      man: {
        text: "I never told anyone that. You must have read the fifth.\n\nHe was very polite. He was soaked and he wasn't cold. He held his sword in his left hand, and I remember thinking: that's not right, the coins all show him right-handed.\n\nI've never said whose face it was. I'm not going to now.",
        opts: [["Back.", "hub", ["clue:oswin_from_sea"]]],
      },
      lamp: {
        text: "Because she has to find the shore.\n\nPeople say things come up the beach on the third night. That they follow the light. Annet herself said it, in a dream I had.\n\nIt was only a dream. I can't put it out. If I put it out she'll never find me.",
        opts: [["Back.", "hub", ["clue:lamp_draws_them"]]],
      },
      freed: {
        text: "You've seen her. Don't tell me how she looked.\n\n...She said to put it out. She said she wasn't angry.\n\nShe always sang a little sharp, you know. I could pick her out of a hundred voices.\n\nThere's one more letter. I left it where I said I'd go. Read it, and then come back, and I'll do what she asked.",
        opts: [["I'll find it.", "end", ["lead:sunken_chapel"]]],
      },
      last: {
        text: "So now you know what I am. A habit that kept climbing the stairs after the man went down them.\n\nShe's free? Then it's time.\n\nWould you do it? I don't think my hands can. Just close the shutter. Thank you. It was a long watch. It was a very long watch.",
        opts: [["Close the shutter.", "end", ["flag:lamp_out", "sp:2"]]],
      },
    },
  },

  // ------------------------------------------------------------------ Archivist Pell, the Sage
  {
    id: "sage", name: "Archivist Pell", where: "The Sage who moves into a player's town hall at Town tier. Also fine standing in any Library. A cheerful ex-novice of the Order who was thrown out for reading. This NPC is the hint system.",
    start: [
      [["shelved:74"], "all"],
      [["flag:pell_met"], "hub"],
      [[], "first"],
    ],
    nodes: {
      first: {
        text: "Oh! A keep with shelves. Do you know how rare that is? The Order threw me out for reading, and I've been walking ever since looking for somewhere that keeps books instead of burning them.\n\nPell. Archivist, formerly Novice. I'll catalogue for my supper.",
        opts: [
          ["How does a Library work?", "how", ["flag:pell_met"]],
          ["Where do I find tomes?", "where", ["flag:pell_met"]],
          ["Welcome, Pell.", "end", ["flag:pell_met"]],
        ],
      },
      how: {
        text: "Build Archive Shelves at your Siege Workshop. Hold a Lore Tome and click a shelf to shelve it. Click a shelf with an empty hand to open the catalogue: read anything you've shelved, take tomes back out, and claim what you've earned.\n\nFinish a whole collection and something always turns up. The Library grows, too: at ten tomes, at twenty-five. Old books keep secrets in their bindings.",
        opts: [["Where do I find tomes?", "where"], ["Thank you.", "end"]],
      },
      where: {
        text: "Everywhere somebody once had a reason to hide one. Chapels. Ruins. Under floors. The great beasts of each region carry one, and things that walk at night sometimes drop them.\n\nA tome you've found leaves the next reader's copy where it was, so nobody can strip the land bare. But a tome on your shelf is yours, and a thief with a Breaching Charge might disagree.",
        opts: [["Back.", "hub"]],
      },
      hub: {
        text: "Catalogue's up to date. What are we puzzling over?",
        opts: [
          ["Two tomes disagree.", "contra"],
          ["I can't read this one.", "unread"],
          ["Where should I look next?", "next"],
          ["The seven thin places.", "source"],
          ["How do I solve a thread?", "threads"],
          ["Carry on, Pell.", "end"],
        ],
      },
      contra: {
        text: "Good! They're supposed to. Ask three things of any book. Who wrote it? Who were they afraid of? And were they there?\n\nMaster Quill wrote what the court told him, but he couldn't stop himself noting the small true things. The Order wrote what it wanted believed. The mage wrote what he saw and was burned for it. Weigh them accordingly.",
        opts: [["Back.", "hub"]],
      },
      unread: {
        text: "Two kinds of unreadable. If it's scrambled letters, it's a cipher, and you need a Cipher Wheel in your pack. If the letters are fine but the words run backward, it's Hollow writing, right to left, and you need a Tide Glass. Or, ahem, a certain kind of hand.\n\nBoth turn up in a well-stocked Library sooner or later.",
        opts: [["Back.", "hub"]],
      },
      next: {
        text: "The catalogue lists every tome you're missing with a note on where such a thing would be kept. Open it at any shelf and look for the grey entries.\n\nIf you want my advice: finish the Testimonies first. Ordinary people notice more than chroniclers.",
        opts: [["Back.", "hub"]],
      },
      source: {
        text: "Brother Fennick's field notes! Six notebooks, each stating one true thing about the place where the Gate now sits: water, bells, hands, cold, salt, roots.\n\nVisit the seven places with the notes in hand and strike off the ones that don't fit. When all six are on your shelf you may Name the Thin Place in the catalogue. Name it wrong and you'll lose days. Name it right and you'll have found a thing the Order lost.",
        opts: [["Back.", "hub"]],
      },
      threads: {
        text: "Your Ledger of Whispers copies down every clue you read, sorted by the mystery it belongs to. When a thread has enough clues, it asks you a question.\n\nSome questions give you choices. The best ones make you write the answer yourself. A wrong answer closes the thread for a day, so read before you guess.",
        opts: [["Back.", "hub"]],
      },
      all: {
        text: "Seventy-four. Every one. I counted three times and then I sat down on the floor.\n\nThey burned all of this, you know. Forty-one portraits and every chronicle they could find, and you put it back, book by book, on your own shelves.\n\nYou don't need an archivist any more. I'll stay anyway, if that's all right. I like it here.",
        opts: [["Stay as long as you like.", "hub"]],
      },
    },
  },

  // ------------------------------------------------------------------ Brother Cael, Order archivist
  {
    id: "cael", name: "Brother Cael", where: "The archive of the Ashen Gate chapterhouse. Old, tired, has read everything he was told to burn.",
    start: [
      [["flag:cael_opened"], "after"],
      [["flag:aldous_sent"], "sent"],
      [["read:seal_07"], "after"],
      [["flag:cael_met"], "hub"],
      [[], "first"],
    ],
    nodes: {
      first: {
        text: "The reading room is open to guests. The archive is not. Please don't lean on the shelves.\n\nYou may read the Chronicle volume on the lectern. We keep that one on display. You'll see why.",
        opts: [
          ["Why that one?", "why", ["flag:cael_met"]],
          ["What's in the archive?", "archive", ["flag:cael_met"]],
          ["Thank you, Brother.", "end", ["flag:cael_met"]],
        ],
      },
      why: {
        text: "Because it says what we need it to say. \"The Treachery of the Mage.\" Master Quill wrote twelve volumes. We display one.\n\nRead the last line of it carefully. \"I have been told to set it down plainly, and I have.\" A chronicler doesn't write that sentence by accident.",
        opts: [["What happened to the rest?", "rest"], ["Thank you.", "end"]],
      },
      rest: {
        text: "Burned. Officially.\n\nUnofficially, a book is a hard thing to burn completely when the man holding the torch can read. My predecessors had a way of finding that a volume had been 'lost' in a village chapel or a ruined nursery.\n\nI didn't say that. Good day.",
        opts: [["Good day.", "end", ["lead:crownhold"]]],
      },
      archive: {
        text: "Our history. \"On the Kingless Years.\" It will tell you there was never a king called Oswin and that the name is a peasant's mistake for a saint's day.\n\nI copy it out fresh every ten years, so that it will last. I have very neat handwriting. It is the only part of the task I can be proud of.",
        opts: [["Back.", "hub"]],
      },
      hub: {
        text: "The reading room is open. The archive is not. I say this every day. Some days I even mean it.",
        opts: [
          ["What did the Order burn?", "burn"],
          ["Tell me about Corvin Hale.", "corvin"],
          ["Good day.", "end"],
        ],
      },
      burn: {
        text: "There is a list. There is always a list: an Order that burns things without an inventory is just a mob.\n\nIt's kept below, in the place it describes. I am not permitted to take guests there. I would need a knight of the Gate to ask me.",
        opts: [["Back.", "hub"]],
      },
      corvin: {
        text: "Tried for calling the Grey Host down on Aldmere with his bells. He arrived at court two years AFTER the Host landed. The tribunal did not find that worth noting.\n\nHis cell is still here, downstairs. Nobody has ever cleaned it. I think nobody could bear to.",
        opts: [["Back.", "hub", ["lead:ashen_chapterhouse"]]],
      },
      sent: {
        text: "Aldous sent you. Aldous is asking.\n\nForty years I've waited for one of them to ask. I thought it would be someone cleverer, to be truthful. I'm glad it was someone kind.\n\nThe stair is behind the third shelf. Take the inventory. It's time somebody other than me had read it.",
        opts: [["Thank you, Brother.", "after", ["flag:cael_opened", "tome:seal_07", "lead:burned_archive"]]],
      },
      after: {
        text: "You've seen the list. Forty-one portraits. I used to recite it at night, like a rosary.\n\nTwo things on it were never found: the mage's notebooks and the chronicler's last volume. And one thing was never ON it, because nobody knew to look. Our saint wrote a letter she never sent. If it exists, it's wherever she went to grieve. Where does a daughter go to grieve?",
        opts: [
          ["Her father's tomb.", "end", ["lead:kings_barrow", "sp:1"]],
          ["I'll think about it.", "end"],
        ],
      },
    },
  },

  // ------------------------------------------------------------------ Sigrun of Hollowfast
  {
    id: "sigrun", name: "Sigrun Ashby", where: "Hollowfast, her longhouse nearest the frozen lake. Blunt, practical, descended from the half of the village that stayed.",
    start: [
      [["solved:wrong_moon"], "after"],
      [["flag:sigrun_met"], "hub"],
      [[], "first"],
    ],
    nodes: {
      first: {
        text: "Shut the door, you're letting the cold in.\n\nYou'll be wanting the lake. Southerners always want the lake. Go and look, then. Don't walk to the middle.",
        opts: [
          ["What happened there?", "lake", ["flag:sigrun_met"]],
          ["Why not the middle?", "middle", ["flag:sigrun_met"]],
          ["Wren of Millbrook sent me.", "wren", ["flag:sigrun_met"]],
        ],
      },
      wren: {
        text: "Cousin Wren. Still patching people up in the dark? Good. We Ashbys are spread thin since the Lost Days, but we keep count of each other.\n\nSit. If Wren sent you, you get the long version.",
        opts: [["Tell me.", "lake"]],
      },
      lake: {
        text: "Three hundred years back, half of Hollowfast got out of bed on one night and walked onto the ice. My grandmother's grandmother's... it goes on a while... followed the prints at dawn. They go to the middle and stop.\n\nGran wrote down what her gran told her. It's up in my rafters. Take it down yourself, I've a bad shoulder.",
        opts: [["I'll take it.", "hub", ["tome:test_04", "lead:frozen_lake"]]],
      },
      middle: {
        text: "Because that's where they stopped.\n\nAnd because some nights, if you stand there and look straight down, there are lights under the ice. Towers. A town. Not ours. Nobody ever built a town down there.",
        opts: [["What happened there?", "lake"]],
      },
      hub: {
        text: "Door. Shut. What is it?",
        opts: [
          ["The shrine by the lake.", "shrine"],
          ["The hunter's lodge.", "lodge"],
          ["Does the ice ever open?", "open"],
          ["Nothing. Keep warm.", "end"],
        ],
      },
      shrine: {
        text: "Older than the village. There's a moon cut into it, round and full. Folk go out on the full moon and leave offerings and nothing happens, and they go home pleased that nothing happened.\n\nGran used to say, \"it's the other one you want.\" She said it the way you'd say it about a spoon.",
        opts: [["Back.", "hub", ["clue:shrine_full_moon"]]],
      },
      lodge: {
        text: "The knights kept a hunting lodge on the far shore. A man with white hair and a pack of hounds, hunting people, the story goes. He went out on the ice one night and the hounds came back without him.\n\nNobody goes in. Nobody's stopping you.",
        opts: [["Back.", "hub", ["lead:frozen_lake"]]],
      },
      open: {
        text: "I've seen it. Once. I was nine.\n\nThere was no moon at all that night, black as a boot. But I looked down, and there was a moon IN the ice, full and white, right under the shrine. And the ice by it had a seam in it, like a door ajar.\n\nI ran home. I'd run home again.",
        opts: [["Back.", "hub", ["clue:ice_door_dark_reflection"]]],
      },
      after: {
        text: "So you've worked out the moon. Then you're going down there.\n\nIf you see people facing the walls of houses that look like ours: the Ashbys who walked were Hild's brother Orm, and his three girls. I'd take it kindly if you told them the family still keeps count.",
        opts: [["I'll tell them.", "end", ["flag:promise_ashby", "sp:1"]]],
      },
    },
  },

  // ------------------------------------------------------------------ Warden Isolde of Sunscar
  {
    id: "isolde", name: "Warden Isolde", where: "Sunscar, the warden's office by the avenue of faceless statues. Proud of her town, has repeated the official story so long she nearly believes it.",
    start: [
      [["read:fall_04"], "after"],
      [["flag:isolde_doubt"], "hub2"],
      [["flag:isolde_met"], "hub"],
      [[], "first"],
    ],
    nodes: {
      first: {
        text: "Welcome to Sunscar. Water is two emeralds a skin, shade is free, and before you ask: the wind.\n\nThe statues. Everyone asks. The desert wind wore the faces away. It's in the town record.",
        opts: [
          ["All of them? Only the faces?", "doubt", ["flag:isolde_met"]],
          ["Who were the statues of?", "who", ["flag:isolde_met"]],
          ["Thank you, Warden.", "end", ["flag:isolde_met"]],
        ],
      },
      who: {
        text: "Kings. Old ones. Nobody remembers which.\n\nThere are forty statues on the avenue and one face between them. I mean, there WAS one face. They were all the same man. At different ages. I shouldn't know that. You can tell from the hands.",
        opts: [["All the same man?", "doubt"]],
      },
      doubt: {
        text: "...The wind doesn't take a nose and leave the fingers. I know. I've been warden for twenty years. I've had a long time to look at them.\n\nThe record says what it says. You're welcome to read it. It also says not to look for the fragments, because there aren't any.",
        opts: [
          ["Where aren't they?", "fragments", ["flag:isolde_doubt"]],
          ["I'll read the record.", "end", ["flag:isolde_doubt", "lead:sunscar"]],
        ],
      },
      hub: {
        text: "Water, shade, or statues?",
        opts: [
          ["Statues.", "doubt"],
          ["Who rules Sunscar?", "seneschal"],
          ["Just passing through.", "end"],
        ],
      },
      hub2: {
        text: "You again. You've got me looking at them on my rounds now. I hope you're pleased.",
        opts: [
          ["The fragments.", "fragments"],
          ["Who rules Sunscar?", "seneschal"],
          ["The riddle on the vault.", "riddle"],
          ["Good day, Warden.", "end"],
        ],
      },
      fragments: {
        text: "My father was warden before me. He used to say a careful man scatters things where he can find them again.\n\nA brow under the old cistern. A jaw in the east tower. An eye where the caravans water. I don't know the rest, and I don't know that, either, officially.",
        opts: [["Back.", "hub2", ["lead:faceless_vault"]]],
      },
      seneschal: {
        text: "The Seneschal. Lord Sorrel. He's been Seneschal as long as there's been a Sunscar, they say, which is just the kind of thing people say.\n\nNobody sees him. He keeps to the lower fortress. He wears a helm. Always has. My father never saw his face either.",
        opts: [["Back.", "hub2"]],
      },
      riddle: {
        text: "There's a heraldry riddle on the vault door under the fortress. \"Grey eyes over a laughing mouth, the right hand raised.\" Children here skip rope to it.\n\nI always took it for a rhyme. It's a description, isn't it. It's instructions.",
        opts: [["Back.", "hub2", ["lead:faceless_vault"]]],
      },
      after: {
        text: "He did it himself. With a mason's chisel. So the last hands on that face would be gentle ones.\n\nTwenty years I've told travelers it was the wind.\n\nI'm changing the town record. Let the Order come and argue with me. Thank you for making me look.",
        opts: [["It was worth looking.", "end", ["flag:isolde_record", "sp:1"]]],
      },
    },
  },
];

// Quartermaster gossip (one line shown when you open his shop; the quartermaster thread can use it)
export const RUMORS = [
  "They say every clock in Millbrook shows the same time. I say buy a sundial.",
  "A knight came through asking after falling stars. Paid in old coin. Very old coin.",
  "My cousin in Gull's Rest swears the lighthouse keeper was old when her grandmother was a girl.",
  "Don't ring a bell after dark. I don't know why. My mother said it and her mother said it.",
  "There's a witch in the Blackfen who claims she's three hundred. Sells a good cough cure, though.",
  "Ever notice it's always the third night? I count stock. I notice counts.",
  "A fellow sold me a book once, all the writing backward. I sold it on quick. Gave me a headache.",
  "Sunscar's statues have no faces. Wind, they say. I've sold enough chisels to know a chisel mark.",
  "Half of Hollowfast walked onto a lake once. The other half won't talk about it. Bad for trade.",
  "People who keep books say the old king's name turns up if you read enough of them. What old king?",
];
