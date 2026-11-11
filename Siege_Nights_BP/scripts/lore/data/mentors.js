// The four regional mentors (thread "Finish the six role storylines", 2026-11-11). Same format as dialogue.js,
// which adds these to NPCS. Plan: https://claude.ai/artifact/Ra52mNyxfnaP71DpzU3mQH
//
// Each mentor's trial lives in scripts/roletrials. Flags they read, set by that feature:
//   trial_<step>          a step is done (trial_span, trial_choosing, trial_hearth, trial_ring, trial_articles,
//                         trial_crew, trial_graves; the cup is the dialogue's own flag nell_cup)
//   trial_<role>_deed     the old deed is done (a boss fell near you, or your dragon hatched)
//   trial_<role>_ready    every step and the deed are done: go and swear at the Tree
// Flags they set: <mentor>_met, and <mentor>_call, which starts the trial.
// Reveal layers: none of these names the Hollow, the truce, Edda or who leads. The turns (rank 4) come later.
// Kesh's Roost loosely follows Fourth Wing (Mateo, 2026-11-11), with our own names and people.

export const MENTOR_NPCS = [
  // ------------------------------------------------------------------ Kesh Cinder, the Cinder Roost
  {
    id: "kesh", name: "Kesh Cinder", where: "The Cinder Roost, a rider school cut into the cliff above Sunscar. Stands by an empty roost under the roll of the fallen. Forties, burn-scarred hands, no dragon.",
    start: [
      [["path:rider", "flag:morvane_fallen", "!flag:kesh_after"], "after"],
      [["path:rider", "flag:rank_rider_dragonlord", "!flag:kesh_stand"], "stand"],
      [["path:rider", "flag:rank_rider_drake_captain", "!flag:kesh_turn"], "turn"],
      [["path:rider"], "sworn"],
      [["flag:trial_rider_ready"], "ready"],
      [["flag:trial_choosing"], "hatchwait"],
      [["flag:trial_span"], "nests"],
      [["flag:kesh_call"], "spanwait"],
      [["!path:none"], "other"],
      [["flag:kesh_met"], "hub"],
      [[], "first"],
    ],
    nodes: {
      first: {
        text: "Mind the edge. People come up the cliff stair looking at the view and go down it a lot faster.\n\nKesh Cinder. Wingmistress, which means I teach. I don't fly. Mine was shot down two summers ago over the Saltglass, and they don't get up from that.\n\nYou're reading the wall. Everyone does.",
        opts: [
          ["What is this place?", "roost", ["flag:kesh_met", "lead:cinder_roost"]],
          ["Who are all those names?", "board", ["flag:kesh_met"]],
          ["I want to ride.", "want", ["flag:kesh_met"]],
          ["I'll leave you to it.", "end", ["flag:kesh_met"]],
        ],
      },
      roost: {
        text: "The Cinder Roost. Ysolt Cinder cut the first ledge with a borrowed pick. She walked into the Saltglass with a dead mule and came out a year later on something with wings. She never said what she promised.\n\nWhen the grey army came down from the north, this was the one province it never held. Nothing that marches in step crosses open sand under dragons. We've kept riders since, the way other places keep walls.",
        opts: [["And the names?", "board"], ["How do I become one?", "want"], ["Back.", "hub"]],
      },
      board: {
        text: "The roll. Every rider the Roost has lost, and their dragon beside them, because they go together more often than not.\n\nI read it out loud on the first morning of every season. All of it. It takes most of an hour. The cadets fidget for the first half and stop fidgeting for the second.\n\nMine is on there. Her name, not mine. I'm still down here being useful.",
        opts: [["I'm sorry.", "board2"], ["How do I become a rider?", "want"]],
      },
      board2: {
        text: "Don't be. Be careful. It's more use to me.",
        opts: [["Back.", "hub"]],
      },
      want: {
        text: "Everyone wants to ride. Half of them want to be seen riding, which is different and gets you killed faster.\n\nThree things. You cross the Span: a stone bridge over the gorge, one block wide, older than the town, and it doesn't hold together everywhere. Then the Choosing: you walk into the nesting field and the dragons decide what they think of you. Then you keep an egg warm until it hatches, and if it hatches for you, you're theirs.\n\nFall off the Span and you wait for next season. Walk into the field like a fool and you'll be burned for it.",
        opts: [
          ["Sign me in.", "signed", ["flag:kesh_call"]],
          ["What happens if I die?", "die"],
          ["Not yet.", "end"],
        ],
      },
      die: {
        text: "Then I read your name out next season with the others, and somebody fidgets through it.\n\nThat's not me being hard. That's the Roost. Nobody here was ever told it was safe, so nobody here was ever lied to.",
        opts: [["Sign me in.", "signed", ["flag:kesh_call"]], ["Not yet.", "end"]],
      },
      signed: {
        text: "Then you're a cadet. Congratulations. It means nothing yet.\n\nThe Span is past the gate. Walk it end to end. Don't stop in the middle to admire anything. Some of the stones crumble when you stand on them, and the wind comes up the gorge in gusts. Lean into it.\n\nCome back when you're across. Or don't, and I'll know which.",
        opts: [["I'll be back.", "end", ["sp:1"]]],
      },
      spanwait: {
        greets: [
          "Still on this side of the gorge, I see. The Span hasn't moved.",
          "The wind's from the east today. Lean left.",
          "You're welcome to stand here. The Span isn't going to cross itself.",
        ],
        text: "Cadet. You haven't crossed yet.",
        opts: [["Any advice?", "spanhelp"], ["Going.", "end"]],
      },
      spanhelp: {
        text: "Don't look down, everyone says. Wrong. Look down a little, at your feet, at the next stone. Look at the gate when you're nearly there.\n\nAnd if one goes under you, don't stop. Stopping is what kills people. The next one's usually fine.",
        opts: [["Usually.", "end"]],
      },
      nests: {
        text: "Across. Good. You looked at the gate, I saw.\n\nNow the nesting field. Here is the whole of my advice, and I'm only going to say it once. Put your weapon away. Don't run. Walk up to a nest slowly, with your hands empty, and let it look at you.\n\nThey can smell fear and they can smell a blade, and they don't like either. Do it right and one of them will let you take an egg.",
        opts: [["And if they don't like me?", "nests2"], ["I'll go now.", "end"]],
      },
      nests2: {
        text: "Then you'll be on fire, and they won't look at you again until tomorrow.\n\nPeople have tried sneaking in with a sword behind their back. A dragon doesn't care which hand it's in.",
        opts: [["Understood.", "end"]],
      },
      hatchwait: {
        greets: [
          "Is it warm? Keep it warm.",
          "Don't hover over it. Eggs know when they're being watched.",
          "You keep looking at the sky. It won't hatch faster for that.",
        ],
        text: "It let you take one. Now set it on a Roost in your own keep and wait.",
        opts: [["Anything I should know?", "hatchwait2"], ["Waiting.", "end"]],
      },
      hatchwait2: {
        text: "One thing. On the third night, at seventeen past three, it will go cold and quiet as a stone, and you'll think it's dead.\n\nIt isn't. They all do it. Every dragon in the Waste does something at that hour. Stay with it. Don't leave it alone that night.\n\nNo, I won't tell you why. Ask me again when you've earned it.",
        opts: [["I'll stay with it.", "end"]],
      },
      ready: {
        text: "It hatched for you. I heard.\n\nThen it's done. The dragon's half and yours. Go to a Tree of Oaths and swear it. Say it out loud. They like that.\n\nAnd come back. I teach riders too, not only cadets.",
        opts: [["Thank you, Kesh.", "end", ["sp:1"]]],
      },
      sworn: {
        greets: [
          "Rider. Your name's still off the roll. Let's keep it that way.",
          "There's sand in your hair. Good. You've been up.",
          "She's watching us from the ledge, you know. Wave.",
        ],
        text: "Rider. What do you need?",
        opts: [
          ["Tell me about Ysolt.", "ysolt"],
          ["Why won't they fly on the third night?", "third"],
          ["Teach me something.", "teach"],
          ["Read me the roll.", "roll"],
          ["Goodbye.", "end"],
        ],
      },
      ysolt: {
        text: "Salt-carrier's daughter. Nobody special, which she'd want you to know. Her mule died a day into the Saltglass and she kept walking, because going back was further.\n\nShe used to say you don't tame one, you're introduced. She never said who did the introducing.",
        opts: [["Back.", "sworn"]],
      },
      third: {
        text: "That's an elder's question, and the elders will tell you it's the moon, or the heat, or that dragons are lazy on a third night like everyone else.\n\nThey're lying. I'll tell you that much for free.\n\nThe rest, when you're a Drake-Captain. Not before. It's not a thing you carry easily.",
        opts: [["I'll hold you to that.", "sworn"]],
      },
      teach: {
        text: "Fly high when you're looking and low when you're running. Raider camps show from above: smoke in the day, fires at night, and a trampled ring where they drill.\n\nAnd land before she's tired, not when. She'll fly till her heart breaks if you let her. Don't let her.",
        opts: [["Back.", "sworn"]],
      },
      other: {
        text: "You're sworn to something already. I can see it on you.\n\nThe Roost doesn't take halves. One road each, that's the rule everywhere I know of, and the dragons keep it stricter than we do.\n\nYou can still look at the wall, if you want. Everyone does.",
        opts: [["Tell me about Ysolt.", "ysolt_other"], ["Goodbye.", "end"]],
      },
      ysolt_other: {
        text: "The first. A salt-carrier's daughter with a dead mule. She never said what she promised, only that the dragon set the terms.",
        opts: [["Goodbye.", "end"]],
      },
      roll: {
        text: "She takes the board down off its hooks and holds it so the light falls across it. She doesn't need to. She knows every name.\n\nShe reads them anyway, all of them, at the same pace, and doesn't skip her own dragon's.",
        opts: [["Thank you for reading it.", "start"]],
      },
      turn: {
        text: "Drake-Captain. Then sit, and I'll give you what I promised.\n\nThis is Ysolt's last page. The elders have a copy and say it was written in fever. It wasn't.\n\n\"The night the grey army went, every dragon in the Waste came down at once. Not at dusk. At seventeen past three. They folded their wings and put their heads under them like birds in a storm, and the sky over the north went the wrong colour, and something up there was eating an army. Nobody else looked up. I did. I will not fly on that night again, and neither will she.\"",
        opts: [["Eating an army?", "turn2"]],
      },
      turn2: {
        text: "That's the word she used. The songs say the grey army died of cold in a pass. Ysolt says it was taken, all of it, in one breath, by something that doesn't live under our sky.\n\nThe elders know. They've known for three hundred years. They teach cadets that dragons are lazy on a third night, because the truth is worse for recruiting.\n\nNow you know too. Don't tell the cadets. Tell them when they're you.",
        opts: [["I won't.", "sworn", ["flag:kesh_turn", "sp:1"]]],
      },
      stand: {
        text: "Dragonlord.\n\nYour name's going on the wall. The other wall, where Ysolt's is: the ones who lived long enough to matter. I carved it last night. It's crooked. I was crying, a bit, and you'll never prove it.\n\nWhen the bad night comes, and it's coming, you'll be in the air over the Rift with fire in your hands. That's what a Dragonlord is for. Not the sky. The ground under it.",
        opts: [["I'll be there.", "sworn", ["flag:kesh_stand", "sp:2"]]],
      },
      after: {
        text: "They're saying the knocking has stopped.\n\nI've a favour to ask, and I've never asked a rider for anything. Take me up. Just once. Behind you. I won't hold on, I'll just sit, and I won't say anything, and you won't look round.\n\n...Thank you. She'd have liked you.",
        opts: [["Hold on anyway.", "sworn", ["flag:kesh_after", "sp:1"]]],
      },
      hub: {
        greets: [
          "Back again. The view hasn't changed.",
          "You're the one who reads the wall. Hello.",
          "Mind the edge. I said that last time too.",
        ],
        text: "Something you wanted?",
        opts: [
          ["What is this place?", "roost"],
          ["Who are all those names?", "board"],
          ["I want to ride.", "want"],
          ["Read me the roll.", "roll"],
          ["Goodbye.", "end"],
        ],
      },
    },
  },

  // ------------------------------------------------------------------ Ulla Deepforge, the Deepforge
  {
    id: "ulla", name: "Ulla Deepforge", where: "The Deepforge, a forge hall under the mountain above Rimehold. Huge, slow-speaking, soot to the elbows. Talks to the fire more than to people.",
    start: [
      [["path:forgemaster", "flag:morvane_fallen", "!flag:ulla_after"], "after"],
      [["path:forgemaster", "flag:rank_forgemaster_forgemaster", "!flag:ulla_tongue"], "stand"],
      [["path:forgemaster", "flag:rank_forgemaster_master_smith", "!flag:ulla_turn"], "turn"],
      [["path:forgemaster"], "sworn"],
      [["flag:trial_forgemaster_ready"], "ready"],
      [["flag:trial_ring"], "huntwait"],
      [["flag:trial_hearth"], "ringwait"],
      [["flag:ulla_call"], "haulwait"],
      [["!path:none"], "other"],
      [["flag:ulla_met"], "hub"],
      [[], "first"],
    ],
    nodes: {
      first: {
        text: "Shut the door. You're letting the cold at her.\n\n...There. You can hear her settle. Four hundred years she's been burning, and she still sulks at a draught.\n\nUlla. I keep the fire. You'll want to warm your hands. Everybody does. Go on.",
        opts: [
          ["Who lit it?", "hroda", ["flag:ulla_met", "lead:deepforge"]],
          ["Do you need help?", "help", ["flag:ulla_met"]],
          ["Just warming my hands.", "end", ["flag:ulla_met"]],
        ],
      },
      hroda: {
        text: "Hroda Deepforge. Bellfounder. She lit it under the mountain and swore it would outlast her, and she wasn't a woman who swore lightly.\n\nWhen the grey army came down and cut the bells off every tower in the north, every new bell was poured here. Forty nights at Rimehold taught us that a wall is only as good as what it's bound with.",
        opts: [["What happened to the bells?", "bells"], ["Back.", "hub"]],
      },
      bells: {
        text: "They were rung. Some of them were rung till they cracked.\n\nAfterwards the grey brothers came north, very polite, and took the moulds away for safekeeping. I've never known what they were keeping them safe from.\n\nThey couldn't carry off the fire, though. They tried. Ask me about the three brothers who tried, one day, when I've had a drink.",
        opts: [["Back.", "hub"]],
      },
      help: {
        text: "Help. Hm.\n\nThere's a side-hearth gone cold this thirty years, since my brother's hands went. I could light it, if somebody hauled for it. Sixteen iron and sixteen coal, and not the rubbish from the surface seams.\n\nIf you mean it, haul. If you don't, there's the door. Shut it behind you.",
        opts: [
          ["I'll haul for you.", "haul", ["flag:ulla_call"]],
          ["What's in it for me?", "informe"],
          ["Not today.", "end"],
        ],
      },
      informe: {
        text: "Honest question. Honest answer: probably nothing. Most who haul for me go home with sore arms and a story.\n\nNow and then the fire takes to somebody. Then it's something else. I don't decide that. She does.",
        opts: [["I'll haul.", "haul", ["flag:ulla_call"]], ["Not today.", "end"]],
      },
      haul: {
        text: "Good. Sixteen iron ingots, sixteen coal. Bring them here and I'll take them off you when you're standing in front of me.\n\nI don't take promises. I take iron.",
        opts: [["I'll be back with it.", "end"]],
      },
      haulwait: {
        greets: [
          "Iron? Coal? No? Then why are you letting the cold in?",
          "Sixteen and sixteen. I'm not going to forget the number.",
          "She's sulking. She knows the side-hearth's waiting.",
        ],
        text: "Sixteen iron ingots and sixteen coal. I'll take them when you have them on you.",
        opts: [["I'm working on it.", "end"]],
      },
      ringwait: {
        greets: [
          "You've still got the bell. I can hear it in your pack, humming.",
          "The lake. At night. On the ice. I said all three.",
          "Don't ring it in here. She'll never forgive either of us.",
        ],
        text: "That's Hroda's hand-bell pattern. First one poured in thirty years, and it came out sweet.\n\nTake it to the lake at Rimehold. Set it down on the ice at night and ring it. Something out there still answers bells.",
        opts: [["What answers?", "ringwhat"], ["I'll go.", "end"]],
      },
      ringwhat: {
        text: "The Rimehold folk call it the Huntsman. It wears a knight's cloak and runs hounds across the ice, and it went under after somebody a long time ago.\n\nIt comes up for bells. All the old things do. That's why the grey army cut them.\n\nBring it down, and come back.",
        opts: [["I will.", "end"]],
      },
      huntwait: {
        greets: [
          "You rang it. I felt the lake take the note, all the way up here.",
          "He's up, then. Go and put him down.",
          "There's frost on you. Lake frost. You've been close.",
        ],
        text: "He's up. Now he has to go back down.",
        opts: [["I'm going.", "end"]],
      },
      ready: {
        text: "So he's down.\n\nHroda used to say a smith never made a weapon she was proud of, or a bell she was ashamed of. You took a bell out to the ice and did with it what a bell's for. That's smith's work.\n\nThe fire's taken to you. I can see it. Go to a Tree of Oaths and swear. Then come back, and I'll start teaching you properly.",
        opts: [["Thank you, Ulla.", "end", ["sp:1"]]],
      },
      sworn: {
        greets: [
          "Smith. Shut the door. Good. You're learning.",
          "She brightened when you came in. Don't let it go to your head.",
          "Your hands have changed. They hold a hammer like it belongs to them now.",
        ],
        text: "What do you need?",
        opts: [
          ["Teach me something.", "teach"],
          ["Where did the moulds go?", "moulds"],
          ["Tell me about Hroda.", "hroda_sworn"],
          ["Goodbye.", "end"],
        ],
      },
      teach: {
        text: "Steel remembers. Quench it angry and it stays angry. Quench it in a hurry and it never quite settles.\n\nWhen you gear your guards, do it slow, and do it yourself. They stand straighter in steel that was made for them, and they know.",
        opts: [["Back.", "sworn"]],
      },
      moulds: {
        text: "South. The grey brothers' chapterhouse, I'd guess, in a cellar with a lock on it.\n\nOne of those moulds is half of something that matters. That's all I'll say until you're a Master Smith. A thing like that, you don't go after on your first winter.",
        opts: [["Back.", "sworn"]],
      },
      hroda_sworn: {
        text: "She had arms like a bridge and a voice like one too. Her apprentices were all afraid of her, and all of them named a daughter after her.\n\nThree generations after her, the biggest bell this land ever had was poured right where you're standing. She'd have hated how it was used. She'd have loved how it rang.",
        opts: [["Back.", "sworn"]],
      },
      other: {
        text: "You're sworn already. I can see it on you. She can too: look, she's gone quiet.\n\nOne road each. Warm your hands, though. Nobody's turned away from the fire.",
        opts: [["Thank you.", "end"]],
      },
      turn: {
        text: "Master Smith. Sit by her. She likes you now; you can tell by how she ticks.\n\nThe moulds. The grey brothers took every bell mould in the north and said it was to keep them safe. One of them was half of the biggest bell this land ever poured. Three generations after Hroda, right here, they cast a bell so big it took the whole mountain's fire for a week.\n\nThey rang it at Bellhollow, once, at the end of the war. It split. And whatever it rang out, it stayed out.",
        opts: [["Rang what out?", "turn2"]],
      },
      turn2: {
        text: "My grandmother said: the same thing the first bell rang out, when there was a queen and the country had another name. Bells don't keep out cold or wolves. They never did. Every bell in the north was made to keep something on the far side of a door.\n\nThat's why the grey army cut them. That's why the brothers hid the moulds instead of melting them. You don't melt a key you might need.",
        opts: [["We'll need it.", "sworn", ["flag:ulla_turn", "lead:ashen_chapterhouse", "sp:1"]]],
      },
      stand: {
        text: "Forgemaster. She knows your name. I heard her say it.\n\nI wrote to the chapterhouse. Brother Cael sent the mould back on a cart with no guard and a note: \"It was never ours to keep.\" Make of that what you like. I've made a tongue from it.\n\nOne stroke. That's all it has in it, each time. When the dead stand up in rows, ring it, and they'll remember they were never soldiers. Hroda would have been proud of it. It isn't a weapon.",
        opts: [["I'll ring it.", "sworn", ["flag:ulla_tongue", "sp:2"]]],
      },
      after: {
        text: "Shut the door.\n\n...No. Leave it open. Let her feel the air.\n\nFour hundred years she's burned without stopping, in case. I'm going to let her down to embers tonight and sleep in the chair. If she goes out, she goes out. I don't think she will. I think she's tired, the same as me.",
        opts: [["Sleep, Ulla.", "sworn", ["flag:ulla_after", "sp:1"]]],
      },
      hub: {
        greets: [
          "Door. Shut. Thank you.",
          "Back for the warmth? Everyone comes back for the warmth.",
          "She's in a good mood today. Must be the coal.",
        ],
        text: "Well?",
        opts: [
          ["Who lit the fire?", "hroda"],
          ["Do you need help?", "help"],
          ["Goodbye.", "end"],
        ],
      },
    },
  },

  // ------------------------------------------------------------------ Harbourmistress Ottilie Holt, Gull's Rest
  {
    id: "ottilie", name: "Harbourmistress Holt", where: "The harbour office on the quay at Gull's Rest. Brisk, fair, ink on her cuffs. Keeps the Debt Book on a chain.",
    start: [
      [["path:captain", "flag:morvane_fallen", "!flag:ottilie_after"], "after"],
      [["path:captain", "flag:rank_captain_admiral", "!flag:forty_sought"], "stand"],
      [["path:captain", "flag:rank_captain_captain", "!flag:ottilie_turn"], "turn"],
      [["path:captain"], "sworn"],
      [["flag:trial_captain_ready"], "ready"],
      [["flag:trial_crew"], "bridewait"],
      [["flag:trial_articles"], "crewwait"],
      [["flag:ottilie_call"], "articleswait"],
      [["!path:none"], "other"],
      [["flag:ottilie_met"], "hub"],
      [[], "first"],
    ],
    nodes: {
      first: {
        text: "Name? No, don't tell me yet. Let me look first.\n\n...No. You're not in it. Good, or a pity, depending.\n\nOttilie Holt, harbourmistress. This is the Debt Book. Everybody who's ever captained out of Gull's Rest is in it, and what they owe, and who to.",
        opts: [
          ["What debt?", "debt", ["flag:ottilie_met", "lead:harbour_office"]],
          ["Do you need captains?", "captains", ["flag:ottilie_met"]],
          ["Just looking.", "end", ["flag:ottilie_met"]],
        ],
      },
      debt: {
        text: "Holt's Debt. Merrin Holt, my ancestor, burned forty Saltreach boats in the harbour mouth so the grey army's second fleet couldn't land. The crews agreed. The owners weren't asked.\n\nWe've been paying for those boats ever since. Every captain signs the articles and takes a share. That's why a Saltreach crew obeys: they know exactly what their captain owes, and to whom.",
        opts: [["Has it ever been paid?", "paid"], ["Back.", "hub"]],
      },
      paid: {
        text: "Never once marked paid. Three hundred years of money in, and the book still says what it said.\n\nI used to think that was greed. Some clerk's trick. I've stopped thinking that. I don't know what I think now.",
        opts: [["Back.", "hub"]],
      },
      captains: {
        text: "Always. The sea takes them faster than the town makes them.\n\nThree things. You sign the articles and pay your first share of the debt. You raise a crew, three hands at least, sworn to your keep. And you do one thing that tells the sea who you are.\n\nThere's a woman in a wedding dress at the sunken chapel. She's been waiting at that altar since before the book was opened. Somebody needs to lay her to rest.",
        opts: [
          ["Give me the articles.", "articles", ["flag:ottilie_call"]],
          ["Why does the sea need telling?", "sea"],
          ["Not yet.", "end"],
        ],
      },
      sea: {
        text: "Because a captain is somebody the sea has agreed to blame. It wants to know your name before it starts.",
        opts: [["Give me the articles.", "articles", ["flag:ottilie_call"]], ["Not yet.", "end"]],
      },
      articles: {
        text: "Read them later. Everybody does, and everybody wishes they'd read them first.\n\nYour share is thirty-two Regals. Pay it to me when you've got it on you, and your name goes in the book below mine.",
        opts: [["I'll bring it.", "end"]],
      },
      articleswait: {
        greets: [
          "Thirty-two Regals. The book's open. The pen's wet.",
          "Your line in the book is still blank. It's waiting.",
          "Debt doesn't go away for being ignored. I'd know.",
        ],
        text: "Thirty-two Regals for your share. I'll take it when you have it on you.",
        opts: [["Soon.", "end"]],
      },
      crewwait: {
        greets: [
          "No crew yet? A captain alone is a passenger with opinions.",
          "Three hands, sworn to your keep. Then come and tell me.",
          "You'll want ones who can swim. Not everyone thinks to ask.",
        ],
        text: "You're in the book. Now raise a crew: three guards sworn to your keep, and tell me when you have them.",
        opts: [["I'll find them.", "end"]],
      },
      bridewait: {
        greets: [
          "Three hands. It's a crew if you say it loudly enough.",
          "The chapel tower shows above the water when the moon's dark. That's your night.",
          "She's still waiting. Somebody ought to stop her.",
        ],
        text: "You have a crew. Now take them to the sunken chapel. The Bride is waiting.",
        opts: [["What do I tell her?", "bride"], ["We'll go.", "end"]],
      },
      bride: {
        text: "Nothing she'll want to hear. She's been waiting for a groom who isn't coming, and part of her knows.\n\nBe quick and be kind. Those aren't always different things.",
        opts: [["We'll go.", "end"]],
      },
      ready: {
        text: "You laid her down. I heard it from the lighthouse: the lamp flickered, first time in my life.\n\nThen you're a captain in all but the oath. Go to a Tree of Oaths and swear it. Your share of the debt goes up, and so does what they'll do for you.",
        opts: [["Thank you, Harbourmistress.", "end", ["sp:1"]]],
      },
      sworn: {
        greets: [
          "Captain. Your share's paid up this season. Mine isn't. Don't tell anyone.",
          "Your crew drink in the Gull. They speak well of you. Mostly.",
          "The book's open. It's always open. Sit.",
        ],
        text: "What do you need, Captain?",
        opts: [
          ["Tell me about Merrin Holt.", "merrin"],
          ["Can I read the whole book?", "book"],
          ["Teach me something.", "teach"],
          ["Goodbye.", "end"],
        ],
      },
      merrin: {
        text: "She lit the first boat herself. Then she stood on the quay all night and watched the other thirty-nine catch. She didn't sleep for three days after.\n\nThe crews went home. That's the part nobody tells. They agreed to it, and they went home, and then later... well. Later is in the book.",
        opts: [["Back.", "sworn"]],
      },
      book: {
        text: "Not yet. When you're Captain in rank as well as name.\n\nThere are names in the back that I have to read to people myself, in a quiet room. You'll understand why.",
        opts: [["Back.", "sworn"]],
      },
      teach: {
        text: "Your crew fight for the share of the debt you carry so they don't have to. Carry it well.\n\nAnd never let one of them drown before you. No Saltreach crew ever has. It would leave them holding the debt.",
        opts: [["Back.", "sworn"]],
      },
      other: {
        text: "You're sworn already. I can see it. The book can't take you twice and neither can the sea.\n\nYou can still read the front pages, if you like. They're the pretty ones.",
        opts: [["What debt?", "debt_other"], ["Goodbye.", "end"]],
      },
      debt_other: {
        text: "Forty boats, burned in the harbour mouth by Merrin Holt, my ancestor, to stop a fleet. Three hundred years of paying for them, and the book still says unpaid.",
        opts: [["Goodbye.", "end"]],
      },
      turn: {
        text: "Captain in rank. Then come into the back room and shut the door.\n\nThe back of the book. The forty crews of the forty boats, every name, in Merrin's own hand. They went home after the burning. They lived. And then, over the years, on third nights, they started walking into the water. One here, a family there. Merrin wrote each one in as it happened.",
        opts: [["Why the third nights?", "turn2"]],
      },
      turn2: {
        text: "Nobody knows. The town calls those years the Lost Days and doesn't talk about them. But here's what I worked out, alone in this room, last winter.\n\nThe debt's never been marked paid because it isn't owed to the boat owners. It's owed to the crews. And you can't pay someone who's dead. You can only pay someone who isn't.",
        opts: [["You think they're alive.", "turn3"]],
      },
      turn3: {
        text: "I think they're somewhere. I think the lamp at the lighthouse hasn't gone out in three hundred years because somebody is still at sea.\n\nDon't repeat that in the Gull. They'll take my chain off.",
        opts: [["I won't.", "sworn", ["flag:ottilie_turn", "sp:1"]]],
      },
      stand: {
        text: "Admiral. Merrin never had that word.\n\nI want you to do something I can't. When you go under, wherever the bad road takes you, look for them. There's water under everything, the old songs say, and it runs. Forty crews of Saltreach are rowing somewhere, still owed.\n\nFind them. Settle with them. Tell them a Holt sent you, and that the book is open. If they'll take one more stroke for a captain, it'll be for you.",
        opts: [["I'll find them.", "sworn", ["flag:forty_sought", "sp:2"]]],
      },
      after: {
        text: "Sit. Watch.\n\nShe opens the Debt Book to the first page, dips the pen, and in a careful hand under Merrin Holt's name she writes one word. Then she blots it, and sits back, and looks at it for a long time.\n\n\"Paid.\" The first time anyone has. Out at the lighthouse, the lamp is going out.",
        opts: [["It's done.", "sworn", ["flag:ottilie_after", "sp:1"]]],
      },
      hub: {
        greets: [
          "Back. Still not in the book.",
          "The tide's on the turn. You've got a minute.",
          "Ink, rope or gossip? I've got all three.",
        ],
        text: "What can I do for you?",
        opts: [
          ["What debt?", "debt"],
          ["Do you need captains?", "captains"],
          ["Goodbye.", "end"],
        ],
      },
    },
  },

  // ------------------------------------------------------------------ Nell Sedge, past Mirelight
  {
    id: "nell", name: "Nell Sedge", where: "A raft-house moored in the reeds past Mirelight, past Old Mag's hut and further out. Small, cheerful, eyes like a heron. Always has a kettle on.",
    start: [
      [["path:witch", "flag:morvane_fallen", "!flag:nell_after"], "after"],
      [["path:witch", "flag:rank_witch_fen_mother", "!flag:nell_stand"], "stand"],
      [["path:witch", "flag:rank_witch_crone", "!flag:nell_turn"], "turn"],
      [["path:witch"], "sworn"],
      [["flag:trial_witch_ready"], "ready"],
      [["flag:trial_graves"], "motherwait"],
      [["flag:nell_cup"], "graveswait"],
      [["flag:nell_call"], "cup"],
      [["!path:none"], "other"],
      [["flag:nell_met"], "hub"],
      [[], "first"],
    ],
    nodes: {
      first: {
        text: "Mind the plank, it's thinking about sinking. Come in, come in. Kettle's on. Kettle's always on.\n\nNell Sedge. You'll have heard of Goody Sedge. Everyone in the fen has. She's my great-great-something, and three villages each show you her grave, and one of them is keeping a spot warm for me.\n\nSit. Tea first. Then you can ask.",
        opts: [
          ["Thank you. What is this place?", "raft", ["flag:nell_met", "lead:nell_raft"]],
          ["Do you know Old Mag?", "mag", ["flag:nell_met"]],
          ["What does a witch do?", "witch", ["flag:nell_met"]],
          ["I can't stay.", "end", ["flag:nell_met"]],
        ],
      },
      raft: {
        text: "Home. It floats, mostly. When the water's high I'm further out and when it's low I'm in the mud with the eels, and either way nobody from the Order wants to walk to me. Which is the point.\n\nThey came once, years before my time, to burn books. There weren't any. There never are. What a witch knows is handed over in a cup.",
        opts: [["Back.", "hub"]],
      },
      mag: {
        text: "Magda. Yes. We haven't spoken in sixty years, and I'm sure she'd tell you whose fault that is.\n\nShe borrows from something old and won't say what. The fen lends too, mind you. It just tells you the interest up front. That's the difference, and it's the whole difference.",
        opts: [["What does the fen lend?", "witch"], ["Back.", "hub"]],
      },
      witch: {
        text: "Keeps children alive through a wet summer, mostly. Finds lost things. Tells you which of your neighbours is standing a little wrong. Puts down what needs putting down.\n\nIt isn't a gift. The fen doesn't give. It lends. And when it wants paying, it wants it all at once.\n\nWould you like to learn? I'm not asking lightly.",
        opts: [
          ["I'd like to learn.", "learn", ["flag:nell_call"]],
          ["What does it cost?", "cost"],
          ["Not yet.", "end"],
        ],
      },
      cost: {
        text: "A night, to start. You drink, and the fen takes a little something to know you by. You'll feel heavy and you won't see well, and in the morning you'll be fine.\n\nAfter that, it asks when it asks. I've never been asked for anything I couldn't pay. I know people who have.",
        opts: [["I'd like to learn.", "learn", ["flag:nell_call"]], ["Not yet.", "end"]],
      },
      learn: {
        text: "Then here's the cup. No, don't look in it. Nobody ever looks in it.\n\nYou can drink it now, or go away and think and drink it later. The tea will keep. It's very patient tea.",
        opts: [["Drink.", "drunk", ["flag:nell_cup"]], ["Later.", "end"]],
      },
      cup: {
        greets: [
          "The cup's still here. So are you. One of you is going to have to make a move.",
          "Come back for your tea? It's kept. I said it would.",
          "Sit. The cup's on the side. Whenever you like.",
        ],
        text: "Your cup's waiting.",
        opts: [["Drink.", "drunk", ["flag:nell_cup"]], ["Not yet.", "end"]],
      },
      drunk: {
        text: "There. That's the first payment.\n\nYou'll feel it in a moment. Sit down before you do. The fen's having a look at you. Let it.\n\nWhen you can stand again, go and find Goody Sedge's graves. All three. Kneel at each, and leave her something. One of them will give you something back, and then you'll know she's had a look at you too.",
        opts: [["...", "end"]],
      },
      graveswait: {
        greets: [
          "Three graves. Three villages. She got about, Goody.",
          "Kneel. Leave something. Don't be fussy about what.",
          "Feeling better? It passes. Mostly.",
        ],
        text: "Have you knelt at all three?",
        opts: [["Where are they?", "graves"], ["Still looking.", "end"]],
      },
      graves: {
        text: "In three villages of the fen, and each one swears theirs is the real one. Look in the oldest corner of the burying ground, under the willow, where the stone's gone soft.\n\nThey're all real. That's the joke nobody gets.",
        opts: [["Thank you.", "end"]],
      },
      motherwait: {
        greets: [
          "She gave you something back. I knew she would. She always liked the polite ones.",
          "The Mother of Changelings. Have you been to see her yet?",
          "The fen's waiting on you. It isn't patient like the tea.",
        ],
        text: "Goody Sedge has had her look. Now the fen wants one thing done.",
        opts: [["What thing?", "mother"], ["I know. I'm going.", "end"]],
      },
      mother: {
        text: "There's a thing in the fen that takes children and leaves something else in the cot. The Mother of Changelings, they call her, and she's older than any of my grandmothers.\n\nThe fen has been owed her for a very long time. End her, and come back for tea.",
        opts: [["I will.", "end"]],
      },
      ready: {
        text: "She's gone. I felt it in the water, like a stone settling.\n\nThen the fen knows you, and Goody knows you, and I suppose I know you too. Go to a Tree of Oaths and swear it. Say it nicely.\n\nAnd come back. There's more in the cup than a first lesson.",
        opts: [["Thank you, Nell.", "end", ["sp:1"]]],
      },
      sworn: {
        greets: [
          "Witch. Sit, the kettle's on. It's always on.",
          "You've got that look. The fen's been talking to you. Tell me.",
          "Mind the plank. Oh, you did. Good.",
        ],
        text: "What do you need?",
        opts: [
          ["Teach me something.", "teach"],
          ["Tell me about Goody Sedge.", "goody"],
          ["How do I see who's wrong?", "eye"],
          ["Goodbye.", "end"],
        ],
      },
      teach: {
        text: "The fen never takes one of anything. If you hurt one, hurt the one in the middle, and let it spread.\n\nAnd always leave something when you take something. A ribbon, a crust, a song. It isn't superstition. It's book-keeping.",
        opts: [["Back.", "sworn"]],
      },
      goody: {
        text: "Nobody knows when she lived. Before Aldmere had a name, I'd say, and before anyone thought to disapprove of her.\n\nShe kept a list of everyone the fen lent to, and what they paid. It was never written down. It was handed over in a cup, like everything else. I've got it. One day you will.",
        opts: [["Back.", "sworn"]],
      },
      eye: {
        text: "Watch the ones who face the wrong way when nobody's looking, and the dogs who won't go near them.\n\nWhen you're further along, the fen will show you plainer. Be kind about what you see. Most of them never asked to come back the way they did.",
        opts: [["Back.", "sworn"]],
      },
      other: {
        text: "Oh, you're sworn already. I can taste it on the air. The fen won't lend to someone who owes elsewhere. It's very particular about that.\n\nHave some tea anyway. Tea's free. Tea's the only thing that is.",
        opts: [["Thank you.", "end"]],
      },
      turn: {
        text: "Crone. Come on, then. Bring the lantern. No, the other one.\n\nShe poles the raft out past where the reeds stop, to a patch of water so still it looks like a hole. The ground around it is wrong: half of it is fen, and half of it is something else, darker, like a stone that's been under water too long and forgot it was ever dry.\n\n\"This is the old water. This is where the fen does its lending from.\"",
        opts: [["Lending for who?", "turn2"]],
      },
      turn2: {
        text: "For something older than Aldmere. This land had another name once, when two kinds of ground lay together here and neither minded. The fen still calls the place by that name. I won't say it out in the open, and you shouldn't either, not until you have to.\n\nThat's who the fen lends for. Something that used to live here, and was put out, and has been knocking ever since. Goody Sedge knew. Now you do.",
        opts: [["Why tell me?", "turn3"]],
      },
      turn3: {
        text: "Because Magda borrows from it and won't say so, and the Order pretends it never was, and somebody ought to know the truth without being frightened of it.\n\nBe kind to it, when you meet it. It isn't wicked. It's owed.",
        opts: [["I'll remember.", "sworn", ["flag:nell_turn", "sp:1"]]],
      },
      stand: {
        text: "Fen Mother.\n\nGoody Sedge has a fourth grave now. I dug it myself, under the willow. It's got your name on, kept warm. That's the best compliment a Sedge can pay, so don't make that face.\n\nWhen the bad night comes, the fen will call in everything it's lent at once. You'll feel it. Let it through you. And when you're falling, it'll lend you one more moment. Take it.",
        opts: [["I'll take it.", "sworn", ["flag:nell_stand", "sp:2"]]],
      },
      after: {
        text: "She's already got her coat on.\n\n\"I'm going to Magda's. Don't look like that. Sixty years is long enough to be right about something.\"\n\nShe poles away into the reeds with two cups and the kettle, and you hear, a long while later and a long way off, two old women not saying anything to each other for an hour.",
        opts: [["Good.", "sworn", ["flag:nell_after", "sp:1"]]],
      },
      hub: {
        greets: [
          "Back! Sit. Kettle's on.",
          "The plank held. It's fond of you.",
          "You again. Good. I was running out of people to talk to who aren't eels.",
        ],
        text: "What can I do for you?",
        opts: [
          ["What is this place?", "raft"],
          ["Do you know Old Mag?", "mag"],
          ["What does a witch do?", "witch"],
          ["Goodbye.", "end"],
        ],
      },
    },
  },
];
