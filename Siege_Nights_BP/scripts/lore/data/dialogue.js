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
//             "emit:eventName" (sends that game event with { player, npc })
// Conditions also: "act1:<stage>" (newplayer/act1_rules.js act1Stage; Old Elspeth opens on it)
// "next node" may also be a list like start, to send the player different ways: [[conditions, node], ...]
// Every effect only ever happens once per player.

import { MENTOR_NPCS } from "./mentors.js"; // the four regional role mentors

export const NPCS = [
  // ------------------------------------------------------------------ Old Elspeth, at every hall's hearth
  // Act 1's guide (story-and-gameplay pass, Mateo 2026-11-14; script approved line by line). She opens on the
  // player's Act 1 stage (newplayer/act1_rules.js, condition "act1:<stage>"). Every step she gives has two
  // "I'm stuck" hints. Secretly Edda, Saint Ashe (LORE-BIBLE "Old Elspeth"): she never says so, or who Morvane is,
  // before the Rift opens.
  {
    id: "elspeth", name: "Old Elspeth", where: "Beside the hearth in every player's hall, on a stool (placed by newplayer/act1.js). Blind, very old, reads the ash.",
    start: [
      [["act1:meet"], "meet"],
      [["act1:banner"], "banner"],
      [["act1:chest"], "chest"],
      [["act1:talk_workshop"], "workshop"],
      [["act1:workshop"], "workshop_wait"],
      [["act1:talk_barracks"], "barracks"],
      [["act1:barracks"], "barracks_wait"],
      [["act1:guards"], "guards_wait"],
      [["act1:talk_wheat"], "wheat"],
      [["act1:sell"], "sell_wait"],
      [["act1:bread"], "bread_wait"],
      [["act1:talk_station"], "station"],
      [["act1:station"], "station_wait"],
      [["act1:rest"], "rest"],
      [["act1:talk_sundown"], "sundown"],
      [["act1:home"], "home_wait"],
      [["act1:talk_supper"], "supper"],
      [["act1:defend"], "defend"],
      [["act1:talk_raid_won"], "raid_won"],
      [["act1:talk_raid_lost"], "raid_lost"],
      [["act1:rebanner"], "rebanner_wait"],
      [["act1:wren"], "wren_wait"],
      [["act1:ride_home"], "home_again"],
      [["act1:find_ember"], "ember_wait"],
      [["act1:ask_ember"], "ember"],
      [["act1:sleep"], "sleep"],
      [["act1:aldous"], "aldous_wait"],
      [[], "hub"],
    ],
    nodes: {
      // ---- day 1
      meet: {
        text: "Sit, sit. The ash said someone new would come up the road today. It didn't say you'd be so loud on the step.\n\nThis purse was left for whoever took this hall. Fifty Regals. Don't spend it on the first pretty thing.\n\nGo and touch the Plot Stone outside. Raise your banner, and this place is yours.",
        opts: [["Thank you.", "end", ["flag:elspeth_met", "emit:elspethPurse"]]],
      },
      banner: { text: "The stone's still waiting for your hand. Go on.", opts: [["I'm stuck.", "stuck_banner"], ["I'll go.", "end"]] },
      stuck_banner: { text: "The stone outside wants a hand on it.", opts: [["Still stuck.", "stuck2_banner"], ["Thank you.", "end"]] },
      stuck2_banner: { text: "The grey stone by your gate. Touch it and raise your banner.", opts: [["Thank you.", "end"]] },
      chest: { text: "Someone left more than a purse for you. Go and look.", opts: [["I'm stuck.", "stuck_chest"], ["I'll go.", "end"]] },
      stuck_chest: { text: "Someone left you more than a purse.", opts: [["Still stuck.", "stuck2_chest"], ["Thank you.", "end"]] },
      stuck2_chest: { text: "There's a chest in your house. Open it.", opts: [["Thank you.", "end"]] },
      workshop: {
        text: "Good. The ash took to your name. Now the Workshop. Nothing here gets built without it.",
        opts: [["I'll find it.", "end", ["flag:elspeth_workshop"]], ["I'm stuck.", "stuck_workshop", ["flag:elspeth_workshop"]]],
      },
      workshop_wait: { text: "The Workshop. Nothing gets built without it.", opts: [["I'm stuck.", "stuck_workshop"], ["I'll go.", "end"]] },
      stuck_workshop: { text: "Builders need a bench.", opts: [["Still stuck.", "stuck2_workshop"], ["Thank you.", "end"]] },
      stuck2_workshop: { text: "Your Workshop stands in the Mason's Yard, beside the bench. It costs nothing. Open it.", opts: [["Thank you.", "end"]] },
      // ---- day 2
      barracks: {
        text: "There are other halls out there, and other lords who'd like yours. Nobody keeps what they can't hold.\n\nFind a Plot Marker and raise a Barracks. Then hire men who'll stand on your wall.",
        opts: [["I will.", "end", ["flag:elspeth_barracks"]], ["I'm stuck.", "stuck_barracks", ["flag:elspeth_barracks"]]],
      },
      barracks_wait: { text: "A Barracks first. Men want a roof before they'll guard you.", opts: [["I'm stuck.", "stuck_barracks"], ["I'll go.", "end"]] },
      stuck_barracks: { text: "Men want a roof before they'll guard you.", opts: [["Still stuck.", "stuck2_barracks"], ["Thank you.", "end"]] },
      stuck2_barracks: { text: "Click a Plot Marker and choose the Barracks. Sixteen Regals.", opts: [["Thank you.", "end"]] },
      guards_wait: { text: "A roof with nobody under it. Hire your men.", opts: [["I'm stuck.", "stuck_guards"], ["I'll go.", "end"]] },
      stuck_guards: { text: "An empty Barracks guards nothing.", opts: [["Still stuck.", "stuck2_guards"], ["Thank you.", "end"]] },
      stuck2_guards: { text: "Go into the Barracks and hire a guard. Forty Regals a head.", opts: [["Thank you.", "end"]] },
      wheat: {
        text: "The field's ripe. Take sixteen sheaves to the Farmer. The first harvest of a new lord always fetches a good price.\n\nKeep the rest. Bake bread. A lord who sells all his grain eats his boots by winter.",
        opts: [["I will.", "end", ["flag:elspeth_wheat"]], ["I'm stuck.", "stuck_sell", ["flag:elspeth_wheat"]]],
      },
      sell_wait: { text: "Sixteen sheaves to the Farmer. Then bread.", opts: [["I'm stuck.", "stuck_sell"], ["I'll go.", "end"]] },
      stuck_sell: { text: "The Farmer's been watching your field.", opts: [["Still stuck.", "stuck2_sell"], ["Thank you.", "end"]] },
      stuck2_sell: { text: "Cut the wheat and take sixteen to the Farmer by the field.", opts: [["Thank you.", "end"]] },
      bread_wait: { text: "Bread. I can smell when there's none in a house.", opts: [["I'm stuck.", "stuck_bread"], ["I'll go.", "end"]] },
      stuck_bread: { text: "Your belly will thank you.", opts: [["Still stuck.", "stuck2_bread"], ["Thank you.", "end"]] },
      stuck2_bread: { text: "Three wheat at a crafting table makes a loaf.", opts: [["Thank you.", "end"]] },
      station: {
        text: "The rail runs past here. Find the station. You'll want roads that don't tire your horse.",
        opts: [["I'll find it.", "end", ["flag:elspeth_station"]], ["I'm stuck.", "stuck_station", ["flag:elspeth_station"]]],
      },
      station_wait: { text: "The station. Roads that don't tire your horse.", opts: [["I'm stuck.", "stuck_station"], ["I'll go.", "end"]] },
      stuck_station: { text: "Listen for the rails.", opts: [["Still stuck.", "stuck2_station"], ["Thank you.", "end"]] },
      stuck2_station: { text: "Follow the pin on your map to the station.", opts: [["Thank you.", "end"]] },
      rest: {
        greets: ["Walk your walls. Learn your people's names. The ash has nothing else for you today.", "Sit a while, if you like. I don't get many who sit.", "The fire's low. Put a log on it on your way out."],
        text: "Nothing in the ash for you today. Rest your feet.",
        opts: [["Thank you.", "end"]],
      },
      // ---- day 3
      sundown: {
        text: "Do what you like today, but be home by sundown. I'll have supper on. A lord's first supper in his own hall is a thing you keep.",
        opts: [["I'll be home.", "end", ["flag:elspeth_sundown"]]],
      },
      home_wait: { text: "Supper's when the sun goes down. Not a moment after.", opts: [["I'm stuck.", "stuck_home"], ["I'll be here.", "end"]] },
      stuck_home: { text: "The sun won't wait for you.", opts: [["Still stuck.", "stuck2_home"], ["Thank you.", "end"]] },
      stuck2_home: { text: "Whistle for your cob and ride home.", opts: [["Thank you.", "end"]] },
      supper: {
        text: "Sit. Eat. ...Hush a moment.\n\nDo you see the ravens? On the wall. I can hear them, but I want you to look.",
        opts: [["Why?", "supper2"]],
      },
      supper2: {
        text: "I've seen this before. Long ago. They gather before something comes for a hall. Shut your gate. Put your men on the wall. Don't go out to meet it.",
        opts: [["I'll go to the wall.", "end", ["flag:elspeth_ravens"]]],
      },
      defend: { text: "Go. Your men need you on the wall, not at my fire.", opts: [["Going.", "end"]] },
      // ---- after the raid
      raid_won: {
        text: "You're still breathing. Good. So am I, which surprises nobody anymore.",
        opts: [["What were those things?", "raid_won2"]],
      },
      raid_won2: {
        text: "Not men. And not anything I'll name at my own hearth. But there's a woman in Millbrook, Sister Wren. She keeps the old books. If anyone can tell you what came over your wall, it's her.\n\nTake your cob. Stay on the road.",
        opts: [["I'll ride to Millbrook.", "end", ["flag:elspeth_raid"]]],
      },
      raid_lost: {
        text: "They pulled your banner down. Banners go back up. Raise it again on the Plot Stone, then go and find Sister Wren in Millbrook. She'll want to hear this more than I do.",
        opts: [["I will.", "end", ["flag:elspeth_raid"]]],
      },
      rebanner_wait: { text: "Banners go back up. The stone's waiting.", opts: [["I'm stuck.", "stuck_rebanner"], ["I'll go.", "end"]] },
      stuck_rebanner: { text: "The stone outside wants a hand on it.", opts: [["Still stuck.", "stuck2_rebanner"], ["Thank you.", "end"]] },
      stuck2_rebanner: { text: "The grey stone by your gate. Touch it and raise your banner again.", opts: [["Thank you.", "end"]] },
      wren_wait: { text: "Millbrook. Sister Wren. Go on, before the road gets any longer.", opts: [["I'm stuck.", "stuck_wren"], ["I'll go.", "end"]] },
      stuck_wren: { text: "Millbrook's down the road, where it's always night.", opts: [["Still stuck.", "stuck2_wren"], ["Thank you.", "end"]] },
      stuck2_wren: { text: "Follow the pin. Look for the light over the chapel.", opts: [["Thank you.", "end"]] },
      home_again: { text: "You've been a long way. Sit by the fire tonight.", opts: [["I will.", "end"]] },
      ember_wait: { text: "Something came down by your gate. I heard it. Go and look.", opts: [["I'm stuck.", "stuck_ember"], ["I'll go.", "end"]] },
      stuck_ember: { text: "It came down near the gate.", opts: [["Still stuck.", "stuck2_ember"], ["Thank you.", "end"]] },
      stuck2_ember: { text: "Look for the glow just outside your gate.", opts: [["Thank you.", "end"]] },
      ember: {
        text: "Put it in my hands. ...Warm. Still warm.\n\nI held one like it once.",
        opts: [["When?", "ember2"]],
      },
      ember2: {
        text: "Longer ago than I'll tell you tonight. Nobody stumbles on one of these. It was sent to you, on purpose.\n\nKeep it close and keep it covered. The ash says a rider comes at first light, one of the King's knights, Sir Aldous. Hear him out. Remember what your Sister told you: give him nothing you haven't read.",
        opts: [["I'll keep it close.", "end", ["flag:elspeth_ember", "emit:elspethEmber"]]],
      },
      sleep: { text: "Sleep. He'll be at your gate at first light.", opts: [["I'm stuck.", "stuck_sleep"], ["Good night.", "end"]] },
      stuck_sleep: { text: "Morning comes sooner in a bed.", opts: [["Still stuck.", "stuck2_sleep"], ["Thank you.", "end"]] },
      stuck2_sleep: { text: "Sleep in your bed, in your house. He comes in the morning.", opts: [["Thank you.", "end"]] },
      aldous_wait: { text: "He's at your keep. Hear him out. Give him nothing you haven't read.", opts: [["I'm stuck.", "stuck_aldous"], ["I'll go.", "end"]] },
      stuck_aldous: { text: "Knights don't come in. They wait by the banner.", opts: [["Still stuck.", "stuck2_aldous"], ["Thank you.", "end"]] },
      stuck2_aldous: { text: "Sir Aldous stands by your Keep Banner. Follow the pin.", opts: [["Thank you.", "end"]] },
      // ---- after Act 1: she stays at the hearth
      hub: {
        greets: ["Sit, if you're staying. The fire likes company.", "You smell of the road. Sit.", "The ash is quiet tonight. That's not always good news."],
        text: "Still here. I usually am.",
        opts: [["Thank you.", "end"]],
      },
    },
  },
  // ------------------------------------------------------------------ Sister Wren, Millbrook
  {
    id: "wren", name: "Sister Wren", where: "Millbrook, in or outside the chapel. Healer, about 60 (in a village where the night never ends, nobody is sure).",
    start: [
      [["flag:morvane_fallen", "!flag:wren_boy"], "boy"],
      [["flag:slipped_first", "!flag:wren_slip_talked"], "slipback"],
      [["flag:slipped_first", "!flag:wren_lead", "act1:wren"], "lead"],
      [["!flag:wren_met", "!raided"], "early"],
      [["solved:lost_days"], "after"],
      [["flag:wren_trust"], "hub2"],
      [["flag:wren_met"], "hub"],
      [[], "first"],
    ],
    nodes: {
      boy: {
        text: "They're saying in the square that the knocking has stopped. The first third night in three hundred years that nobody had to count.\n\nDo you still have the journal? Turn to the lambing entry. \"He is nine, grey-eyed, quick with his right hand and quicker to laugh.\"\n\nEverybody is going to remember the thing you fought down there. Somebody ought to remember that one as well. I'll do it, if you like. I'm good with the ones nobody else sits up for.",
        opts: [["Thank you, Sister.", "end", ["flag:wren_boy"]]],
      },
      first: {
        text: "Mind the step. It's been dark here since before I was born. You're from one of the new holds, and you've just had your first third night. I can see it on you.\n\nI'm Sister Wren. I patch people up.",
        opts: [
          ["Who attacked us?", "three", ["flag:wren_met"]],
          ["Why is it always night?", "night", ["flag:wren_met"]],
          ["I have an old journal. Do you know it?", "journal", ["flag:wren_met"]],
          ["I should go.", "end", ["flag:wren_met"]],
        ],
      },
      // Act 1: someone who rides in before their first raid meets her, but the story has not started for them yet
      early: {
        text: "Mind the step, traveler. It's dark, I know. It's been dark in Millbrook since before I was born.\n\nI'm Sister Wren. I patch people up. You're from one of the new keeps, aren't you? Come back if you ever need patching.",
        opts: [["I will.", "end"]],
      },
      // Act 1's end with her: the lead home (story-and-gameplay pass, Mateo 2026-11-14)
      lead: {
        text: "Go home. Whatever stood on your land before you, someone wrote it down. Find what they wrote.\n\nAnd if the knights come asking, and they will, don't give them anything you haven't read first.",
        opts: [["I'll go home.", "end", ["flag:wren_lead"]], ["Tell me about Tobin.", "tobin1", ["flag:wren_lead"]]],
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
        text: "Nobody here knows. Every third night they come for whoever's walls are brightest. You've noticed. Everyone with walls notices.\n\nThe knights know why. Ask a knight and watch his face go smooth as a plate.",
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
          ["What do I do now?", "lead"],
          ["Tell me about Tobin.", "tobin1"],
          ["I need some air.", "end"],
        ],
      },
      slipfine: {
        text: "You are not fine. Your sleeves are dripping and you're holding that cup in your left hand. You came in here right-handed.\n\n...There. It's passing. You've switched back. Saints, I hoped I'd never watch that happen twice.\n\nIt let go of you. It didn't let go of my brother. I'd like to know why, and so should you.",
        opts: [
          ["What do I do now?", "lead"],
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
        greets: ["You again. Good. Wipe your feet, somebody has to pretend it's morning.", "Hold this. No, the other end. Now. What is it?", "I've a pot on and a boy with a fever. Talk while I work."],
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
        text: "Down. Tobin went to the well. In Rimehold they walked out onto the lake. In Gull's Rest it was the sea.\n\nAlways water, always the third night. If you want to know more about the lake, there's a woman in Rimehold called Sigrun whose grandmother followed the footprints.",
        opts: [
          ["Rimehold. North?", "end", ["lead:hollowfast", "lead:millbrook_well"]],
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
      [["flag:morning_after", "flag:aldous_met", "!flag:aldous_saw"], "saw"],
      [["path:knight", "flag:morvane_fallen", "!flag:aldous_after"], "after"],
      [["path:knight", "flag:rank_knight_knight_commander", "!flag:aldous_commander"], "commander"],
      [["path:knight", "flag:aldous_met", "!flag:knight_wall_asked"], "wall"],
      [["path:knight", "flag:knight_wall", "!flag:knight_wall_thanked"], "wallthanks"],
      [["read:seal_10"], "edda"],
      [["read:seal_09"], "confront"],
      [["path:marked"], "marked"],
      [["flag:aldous_met"], "hub"],
      [[], "first"],
    ],
    nodes: {
      saw: {
        text: "You saw one. No, don't, I can tell. I saw one too. From the chapterhouse roof, on the east road, standing in the wheat. It did not flatten the wheat.\n\nI reported it. I wrote it out properly, time and place and what it looked like, the way they teach us. The Grandmaster's clerk read it in front of me and put it on the fire and asked if there was anything else.",
        opts: [["What did you say?", "saw2"]],
      },
      saw2: {
        text: "I said no, sir. God help me, I said no, sir, and I saluted.\n\nI have been thinking about that since. Not the thing in the wheat. The clerk. He wasn't surprised. He had the look of a man who has burned that page before.\n\nWe are sworn to stand between the people and the dark. I did not know there was a part of the dark we had agreed not to mention.",
        opts: [["Ask Brother Cael about a drawer.", "hub", ["flag:aldous_saw"]], ["Keep your eyes open, Aldous.", "hub", ["flag:aldous_saw"]]],
      },
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
        greets: ["You look tired. So do I. Nobody warns you about the paperwork.", "Ah, good, a face that isn't asking me for a horse. Go on.", "I have the watch in an hour. Until then I am yours."],
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
      commander: {
        text: "Knight-Commander. There were four of those when we were eleven hundred. Now there's you.\n\nThe Eleven are yours. Every one of us who's left. We'll hold whatever wall you put us on, and when the worst night comes, the one we were all sworn for and never told about, we'll be on it with you.\n\nOne thing the Rule never needed to say, so I'll say it. Every one of those things we've buried came up the same season the knocking got louder. Somebody is sending them, and they keep sending them at you. I'd like to know who before they stop needing to.\n\nWhatever you call us now. The name matters less than I thought it would.",
        opts: [["Then hold the wall with me.", "end", ["flag:aldous_commander", "sp:2"]]],
      },
      after: {
        text: "I keep thinking about her. Edda. Saint Ashe.\n\nShe stood on a wall on a third night, just like the one we stood on, and did a terrible thing so the knocking would stop, and then lied for the rest of her life so no one would undo it.\n\nWould she have done it again, do you think? If she'd seen how it ended?\n\n...No. Don't answer. I don't think I want to know. I just wanted somebody else to wonder it too.",
        opts: [["I'll wonder it with you.", "end", ["flag:aldous_after", "sp:1"]]],
      },
      wall: {
        text: "Squire. Good, you're here. I need to ask you something the Rule doesn't cover.\n\nThe Order watches the keeps. That's all we do now: watch. Eleven of us can't stand on forty walls. But you could stand on one that isn't yours.\n\nNext time another keep is besieged, go and hold it with them. Not for pay. Because the Rule says we stand between the people and the dark, and I'd like to see one of us actually do it.",
        opts: [
          ["I'll stand on their wall.", "wall2", ["flag:knight_wall_asked"]],
          ["And if there's no other keep near me?", "wallsolo", ["flag:knight_wall_asked"]],
        ],
      },
      wall2: {
        text: "Thank you. When you have, I'll write to the others. All ten of them. Some of them will come and see for themselves.\n\nThat's how the Order starts again, I think. Not with a council. With somebody seen on the wrong wall.",
        opts: [["Good day, Aldous.", "end"]],
      },
      wallsolo: {
        text: "Then hold your own as if it were somebody else's. As if the people behind you weren't yours to lose, and you were there anyway.\n\nI'll know the difference. So will the others.",
        opts: [["I will.", "end"]],
      },
      wallthanks: {
        text: "I heard. A knight of the Gate on a wall, on a third night, holding.\n\nI've written to the others. Dame Orla wrote back in an hour, which she has never once done for the Grandmaster. They'll come to you, one by one, as they hear what you do. Let them see you do it.",
        opts: [["Let them come.", "end", ["flag:knight_wall_thanked", "sp:1"]]],
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
      [["flag:morning_after", "flag:mag_believed", "!flag:mag_saw"], "saw"],
      [["flag:corvin_says_mag", "!flag:mag_heard_corvin"], "trowel"],
      [["path:marked", "flag:morvane_fallen", "!flag:mag_after"], "crownheld"],
      [["path:marked", "flag:rank_marked_listener", "!flag:mag_listener"], "listener"],
      [["path:marked", "flag:rank_marked_adept", "!flag:mag_adept"], "adept"],
      [["path:marked", "flag:mag_believed", "!flag:mag_arts"], "arts"],
      [["col:corvin", "flag:mag_believed"], "allbooks"],
      [["flag:mag_believed"], "hub"],
      [["flag:mag_met"], "second"],
      [[], "first"],
    ],
    nodes: {
      crownheld: {
        text: "So. It's over, and you're the one who can hear all of it now.\n\nWill you let me hold it? The Crown. Not wear it. I'm not a fool, and I'm not you. Just hold it, once, in my two hands.\n\n...Heavier than I thought. Colder. He used to turn his ring when he was thinking. Did you know that? No. Of course you didn't.\n\nTake it back. Quickly, please.",
        opts: [["I've got it, Mag.", "hub", ["flag:mag_after", "sp:1"]]],
      },
      listener: {
        text: "Sit. No, the other chair, that one's for the cat, and she's dead, but it's still hers.\n\nListener now. I could tell from the door. You keep tilting your head at the kettle.\n\nSo. What did it sound like, the first time? Not what it said. What it SOUNDED like. Everyone hears something different, and what you hear tells me what you'll be.",
        opts: [
          ["Like a bell under water.", "listener2"],
          ["Like a lot of people humming one note.", "listener2"],
          ["Like someone saying my name from the next room.", "listener2"],
        ],
      },
      listener2: {
        text: "Hm. That's a good one. That's not the worst one.\n\nHere's the first thing he taught me, and the only thing that matters this year: it doesn't know you're listening. Not yet. Keep it that way as long as you can. Cast quiet. Rest between.\n\nThe day it notices you back is a different lesson.",
        opts: [["Thank you, Mag.", "hub", ["flag:mag_listener", "sp:1"]]],
      },
      adept: {
        text: "You went loud.\n\nDon't argue, I felt it from here, like a draught under a door. Past seventy, weren't you? You felt it look round.\n\nThat's what Adept means. Not that you're good. That you're loud enough to be noticed, and still standing.",
        opts: [["What do I do now?", "adept2"], ["It was worth it.", "adept3"]],
      },
      adept2: {
        text: "Now you learn to be loud on purpose and quiet the rest of the time, like a man who only shouts in a fire.\n\nAnd you start carrying something to hold on to after. He used to keep a pebble from the river at home. Pick something. You'll know why the first time you need it.",
        opts: [["I'll pick something.", "hub", ["flag:mag_adept", "sp:1"]]],
      },
      adept3: {
        text: "It always is, the first time. That's the trap.\n\nGo and be loud when it matters, and quiet all the rest. And carry something from home in your pocket. You'll know why.\n\nOne more thing. If it ever speaks to you kindly, by name, like it's glad of you, come straight here. It never once spoke kindly to him.",
        opts: [["I'll remember.", "hub", ["flag:mag_adept", "sp:1"]]],
      },
      saw: {
        text: "Don't tell me. I can smell it on your coat. Cold stone and the inside of a bell.\n\nSo they've come up the long way and walked to your wall on their own feet. Well. I wondered if I'd live to see that again, and it turns out I live to see everything.\n\nSit. You'll want to know what it was, and I'm not going to tell you, and you'll want to know why not.",
        opts: [["Why not?", "saw2"]],
      },
      saw2: {
        text: "Because you'd go home thinking you understood it, and that's how people get careless at gates.\n\nI'll give you what's safe. It wasn't angry at you. Did you notice? Your raiders hate you, it's all over them. That one didn't. It walked up to your wall the way a man walks up to a field he's been told to measure.\n\nIt was sent to look. Something wanted to know how high you build.",
        opts: [["Sent by what?", "saw3", ["flag:mag_saw"]], ["Then I'll build higher.", "hub", ["flag:mag_saw"]]],
      },
      saw3: {
        text: "There. That's the right question, and you asked it in the right order, after the fright and before the bragging.\n\nKeep asking it. Ask the bell-keepers and the grey brothers and that girl on the ice. They've each got a piece and they each think it's the whole.\n\nI've got a piece too. You'll get it when it won't kill you.",
        opts: [["I'll come back.", "hub"]],
      },
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
        text: "Marsh mallow root, honey, don't breathe the fog after dark. Two coins, which I'll waive, because you asked a sensible question in a house full of nonsense.\n\nNow. Do you want the cough cure, or do you want to know why I'm old?",
        opts: [
          ["Why are you old?", "believe"],
          ["Just the cure.", "end"],
        ],
      },
      arts: {
        text: "Stop. Stand there. Don't come in yet.\n\n...Oh, child. You picked it up. I can hear it on you from across the room, like a wet finger on a glass.\n\nWell. It's done, and nobody is going to teach you, because the last man who could is ash. But I was his prentice and I was a nosy one. Take this. I wrote it when I was eleven. I understood about a third of it then and I wish I'd kept it that way.",
        opts: [
          ["What is it?", "arts2", ["flag:mag_arts", "item:siege:fourteen_arts"]],
          ["Thank you, Mag.", "hub", ["flag:mag_arts", "item:siege:fourteen_arts"]],
        ],
      },
      arts2: {
        text: "Everything he let slip about what your sort can do. Fourteen of them, he counted. It won't tell you how. He never told ME how. It'll tell you what happened to the people who found out.\n\nRead the third one twice. Read the tenth one before you get proud of yourself.\n\nAnd some of them you'll not manage until you've been somewhere or met someone. The book says where, if you squint.",
        opts: [["I'll read it.", "hub"]],
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
        greets: ["You're letting the damp out. In or out.", "Back, are you. The frogs said you would be.", "I was asleep. I've been asleep since Tuesday. Which Tuesday, I couldn't say. Ask."],
        text: "Sit. Ask. Don't touch the jars.",
        opts: [
          ["Your teacher.", "corvin"],
          ["The moon.", "moon"],
          ["Mirelight's villagers.", "villagers"],
          ["The backward hymns.", "hymns"],
          ["The day they took the king.", "king"],
          ["Goodbye, Mag.", "end"],
        ],
      },
      trowel: {
        text: "What did you say?\n\nSay it again. Slowly.\n\n...\"Like a trowel.\" He said that to me the morning I was nine, the first day, in front of all eleven of the others, and I cried, and he gave me his own pen and never asked for it back.\n\nThree hundred years. I thought I was waiting to see what came back out of that Crack. I think I was only waiting to be told off one more time.\n\nSit down, child. I've a notebook under the bed I've been denying for a long while.",
        opts: [["I'm glad I told you.", "hub", ["flag:mag_heard_corvin", "sp:2"]]],
      },
      king: {
        text: "I was eleven, and small enough to be under the cart.\n\nThey'll tell you she threw him in. She didn't throw him. Nobody threw that man anywhere. They walked him down into the valley to the Crack with his hands tied, and at the edge he asked them to cut the rope, and the girl nodded, and they cut it.\n\nHe turned round once. He was looking for her face. She had already put her back to him.\n\nThen he walked in. Upright. Like a man going down to his own cellar.",
        opts: [["And then?", "king2", ["clue:walked_in", "flag:heard_walked_in"]]],
      },
      king2: {
        text: "And then nothing. That's what I'm telling you, child. No scream. No fall. I've seen folk die every way there is to do it, and that wasn't one of them.\n\nThree hundred years I've kept myself going on roots and spite. Did you never wonder what I was waiting to see come back out?",
        opts: [["Back.", "hub"]],
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
        text: "\"What the carving shows, the sky must not.\" He made us chant it.\n\nThere's a door in the north, at the Rimehold lake. A shrine with a moon cut into it. One of us went through that door with the hunter behind her. I don't know which of them I feel sorrier for.",
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
        greets: ["Is that the tide or is that you? Come up, come up.", "Careful on the stair. It has one more step than it used to.", "I was just writing to her. It will keep. What can I tell you?"],
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
      [["flag:morning_after", "flag:pell_met", "!flag:sage_saw"], "saw"],
      [["flag:heard_no_body", "flag:heard_named", "flag:heard_walked_in", "!flag:pell_summed"], "sum"],
      [["shelved:75"], "all"],
      [["flag:pell_met"], "hub"],
      [[], "first"],
    ],
    nodes: {
      saw: {
        text: "Oh, thank goodness, you're in one piece. I watched from the upstairs window. Well. I watched from under the upstairs window, with a book over my head, but I heard a great deal.\n\nNow, I have been through the shelves since four this morning and I want to show you something that is not there. Sieges, raiders, the Grey Host, every third night, there are pages and pages. A tall thing with no face that the raiders bow to? Not a line. Not one.",
        opts: [["Maybe nobody saw one before.", "saw2"]],
      },
      saw2: {
        text: "That's what I thought! For about an hour. Then I started looking at what's been cut.\n\nThere are pages gone from four of our books, all near the end, all in chapters about the last year of a siege somewhere. Cut with a blade, neatly, by somebody who cared about the binding.\n\nSo people have seen them. And then somebody tidied up. A missing page is still a clue, you know. It tells you which way the scissors were facing.",
        opts: [["Who cuts pages that neatly?", "saw3", ["flag:sage_saw"]], ["Keep looking, Pell.", "hub", ["flag:sage_saw"]]],
      },
      saw3: {
        text: "A librarian, I'm sorry to say. Somebody trained. Somebody with a house style.\n\nI used to work for people with a house style.\n\nIf you find a book out in the world with its last pages still in it, bring it to me before you bring it to anyone in grey. I'll make you a copy and hide the copy.",
        opts: [["I will.", "hub"]],
      },
      sum: {
        text: "Sit down, sit down. I've been cataloguing what people TOLD you instead of what you shelved, and I don't like where the cards have ended up.\n\nCard one. A king was overthrown, and the Order that burned forty-one of his portraits never paid for a grave.\n\nCard two. He went into the Crack alive, on his own two feet.\n\nCard three. Those below have no names, and yet they have given one to somebody. Morvane.\n\nI'm an archivist. I don't draw conclusions, I file them. But I've only the one drawer left, and all three cards fit in it.",
        opts: [
          ["Say it, Pell.", "sum2", ["flag:pell_summed", "flag:pell_met"]],
          ["Not yet. I'm not ready.", "hub", ["flag:pell_summed", "flag:pell_met"]],
        ],
      },
      sum2: {
        text: "No. You say it. Your Ledger has a page for it, \"Who Is Morvane?\", and it wants a name in your own hand.\n\nAnd if we're right, then when you stand in front of him at last, look at his eyes, and at which hand he uses. The old journal in your pack describes a right-handed boy. Master Quill says the King came back from below using his left. I should like to know which of them is still in there.",
        opts: [["I'll look.", "hub", ["sp:1"]]],
      },
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
        greets: ["Don't move that pile, it's in an order. What have you found?", "Oh, it's you! I was hoping it was you and not a draught.", "Ink's wet, mind your sleeve. Go on, what's the question?"],
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
      [["flag:morning_after", "flag:cael_met", "!flag:cael_saw"], "saw"],
      [["flag:morvane_fallen", "!flag:cael_said_it"], "plain"],
      [["flag:cael_opened"], "after"],
      [["flag:aldous_sent"], "sent"],
      [["read:seal_07"], "after"],
      [["flag:cael_met"], "hub"],
      [[], "first"],
    ],
    nodes: {
      saw: {
        text: "Close the door, please. All the way.\n\nYou are going to describe something to me and I am going to tell you the Order has no record of it. Both of us will know what that is worth. So let me save you the breath. Taller than a man. Nothing where the face goes. The raiders made way.\n\nThere is a drawer in this room with no label on it. I was told to burn what is in it forty years ago. I am a slow worker.",
        opts: [["What is in the drawer?", "saw2"]],
      },
      saw2: {
        text: "Eleven reports. The oldest is three hundred years old and the newest is a good deal younger than I am. A reeve, two priests, a child, a knight of this house. None of them knew about the others. They all draw the same thing in the margin, badly.\n\nAnd every one of them was written in the season before a village stopped answering letters.\n\nI am not telling you this to frighten you. I am telling you because you are the twelfth, and you are the first one who came and asked.",
        opts: [["What does the Order call them?", "saw3", ["flag:cael_saw"]], ["Keep the drawer safe.", "hub", ["flag:cael_saw"]]],
      },
      saw3: {
        text: "Officially, nothing. A thing with no name cannot be in a report, and a thing in no report did not happen. That is very nearly our whole method.\n\nUnofficially the old brothers called them the tall company. As in, \"he keeps tall company these nights.\" They said it about men who had stopped sleeping.\n\nGo home and sleep. I mean it kindly.",
        opts: [["Thank you, Brother.", "hub"]],
      },
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
        greets: ["Quietly, please. The books are used to it.", "You came back. Most people need only one look at this room.", "I have misfiled something on purpose today. It was very satisfying. Yes?"],
        text: "The reading room is open. The archive is not. I say this every day. Some days I even mean it.",
        opts: [
          ["What did the Order burn?", "burn"],
          ["Tell me about Corvin Hale.", "corvin"],
          ["The portraits you burned. Whose?", "nobody"],
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
      nobody: {
        text: "One man's. Forty-one portraits, a great seal, a coronation robe, a child's wooden horse with a name cut in the belly. All burned, all listed.\n\nI will tell you what is not on the list, because I have read it more often than my prayers. A coffin. A shroud. A gravedigger's fee. The Order kept receipts for the lamp oil it used that week. It did not pay to bury a king.\n\nI do not know what that means. I know what I think on the third nights.",
        opts: [
          ["What do you think?", "nobody2", ["clue:no_body", "flag:heard_no_body"]],
          ["Good day, Brother.", "end", ["clue:no_body", "flag:heard_no_body"]],
        ],
      },
      nobody2: {
        text: "That a man nobody buried is a man nobody saw die.\n\nI didn't say that either. Good day.",
        opts: [["Good day.", "end"]],
      },
      plain: {
        text: "You've come from below. No, don't tell me, it's in how you're standing. Sit. Let an old man say something aloud in this building once before he dies.\n\nMorvane was King Oswin. Aldric's son. The boy in that journal of yours, nine years old and afraid of nothing. He made a peace with the Hollow and he kept it, and for that his own daughter put him through the Crack alive, took a saint's name, and founded this Order to burn his face off the world so that nobody would know him if he ever came back up.\n\nHe did not come back up. They crowned him down there instead. Every third night for three hundred years, that was him. Knocking.",
        opts: [["He kept his father's journal.", "plain2", ["flag:cael_said_it"]]],
      },
      plain2: {
        text: "Then it was his to give, and he gave it to you. I wonder what he hoped you would do with it.\n\nMaster Quill wrote twelve volumes and we display one. I am going to write the thirteenth. Plainly, this time, and nobody will have to tell me to.\n\nThank you. Lean on the shelves if you like.",
        opts: [["Good day, Brother.", "end", ["sp:2"]]],
      },
      sent: {
        text: "Aldous sent you. Aldous is asking.\n\nForty years I've waited for one of them to ask. I thought it would be someone cleverer, to be truthful. I'm glad it was someone kind.\n\nThe stair is behind the third shelf. Take the inventory. It's time somebody other than me had read it.",
        opts: [["Thank you, Brother.", "after", ["flag:cael_opened", "tome:seal_07", "lead:burned_archive"]]],
      },
      after: {
        text: "You've seen the list. Forty-one portraits. I used to recite it at night, like a rosary.\n\nTwo things on it were never found: the mage's notebooks and the chronicler's last volume. And one thing was never ON it, because nobody knew to look. Our saint wrote a letter she never sent. If it exists, it's wherever she went to grieve. Where does a daughter go to grieve?",
        opts: [
          ["Her father's tomb.", "end", ["lead:kings_barrow", "sp:1"]],
          ["Forty-one portraits of whom?", "nobody"],
          ["I'll think about it.", "end"],
        ],
      },
    },
  },

  // ------------------------------------------------------------------ Sigrun of Rimehold
  {
    id: "sigrun", name: "Sigrun Ashby", where: "Rimehold, her longhouse nearest the frozen lake. Blunt, practical, descended from the half of the village that stayed.",
    start: [
      [["flag:morning_after", "flag:sigrun_met", "!flag:sigrun_saw"], "saw"],
      [["solved:wrong_moon"], "after"],
      [["flag:sigrun_met"], "hub"],
      [[], "first"],
    ],
    nodes: {
      saw: {
        text: "You've the look. Sit down before you fall down.\n\nTall. No face. Walked like it was remembering how. And your raiders stood aside for it.\n\nGran had a word for those and I'll not teach it you, it does no good in a mouth. But I'll tell you what she said. She said the Host never crossed the water with anything like that. They met it here. On the last night. It was the last thing any of them looked at.",
        opts: [["Then it took the Host.", "saw2"]],
      },
      saw2: {
        text: "Something did. At seventeen past three, six thousand men, and not a boot left on the grass.\n\nSo think on this, southerner. Whatever is sending raiders at your wall every third night has been sending men. Other people's men. Angry and borrowed. Last night it sent one of its own.\n\nYou don't do that until you've stopped being careful.",
        opts: [["Why would it stop being careful?", "saw3", ["flag:sigrun_saw"]], ["I'll bar the gate.", "hub", ["flag:sigrun_saw"]]],
      },
      saw3: {
        text: "Because it's nearer than it was. That's all I've got. I'm a fisherman's daughter with a bad shoulder.\n\nCount your ravens tonight. If there's more of them than yesterday, they know something too.",
        opts: [["I will.", "hub"]],
      },
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
        text: "Three hundred years back, half of Rimehold got out of bed on one night and walked onto the ice. My grandmother's grandmother's... it goes on a while... followed the prints at dawn. They go to the middle and stop.\n\nGran wrote down what her gran told her. It's up in my rafters. Take it down yourself, I've a bad shoulder.",
        opts: [["I'll take it.", "hub", ["tome:test_04", "lead:frozen_lake"]]],
      },
      middle: {
        text: "Because that's where they stopped.\n\nAnd because some nights, if you stand there and look straight down, there are lights under the ice. Towers. A town. Not ours. Nobody ever built a town down there.",
        opts: [["What happened there?", "lake"]],
      },
      hub: {
        greets: ["You'll want feeding. Southerners always do. Talk first.", "Boots off or stay by the door. What now?", "Lake's still there, if that's what you came to check."],
        text: "Door. Shut. What is it?",
        opts: [
          ["The shrine by the lake.", "shrine"],
          ["The hunter's lodge.", "lodge"],
          ["Does the ice ever open?", "open"],
          ["Why did the Grey Host come?", "calling"],
          ["The ravens.", "ravens"],
          ["Nothing. Keep warm.", "end"],
        ],
      },
      calling: {
        text: "You've been reading. Nobody asks that who hasn't.\n\nWe don't tell southerners this. My people were the Host. The ones who stayed behind with the wounded, anyway. And the old women say nobody ordered that crossing. There was a sound under the ice, one winter, like a bell a long way down, and every fighting man on the Isles got up and started sharpening things. Couldn't have told you why. Couldn't have stopped.\n\nGran said you never hear it with your ears. You hear it with whatever part of you is already angry.",
        opts: [
          ["Is it still being rung?", "calling2", ["flag:heard_the_calling"]],
          ["Thank you for telling me.", "hub", ["flag:heard_the_calling"]],
        ],
      },
      calling2: {
        text: "Every third night. You've got walls, you know that better than I do.\n\nThere's a name goes with it now, in the newer verses. I'll not say it indoors.\n\nIf you ever find you can make that sound yourself, and I've a feeling about you, think hard about who you'd be copying.",
        opts: [["Say it outdoors, then.", "named"], ["I will.", "hub"]],
      },
      ravens: {
        text: "Ours. Every man of the Isles fed one from his own hand, and it was said that if you died abroad your raven carried your name home.\n\nWhen the Host cut down one of your bells they nailed a raven up in its place, and you southerners took it for spite. It was a trade. A voice for a voice. They'd been told to take the bells, and some part of them was still decent enough to leave something.",
        opts: [["And now?", "ravens2", ["flag:heard_ravens"]]],
      },
      ravens2: {
        text: "Now there's six thousand birds that flew home that winter with no names to carry. They've not known what to do with themselves since.\n\nSo they do the one thing they've left. They go where the Host is going next, and they get there first, and they wait.\n\nIf you see ravens on your wall at dusk, count them. Then bar the gate.",
        opts: [["I'll count.", "hub"]],
      },
      named: {
        text: "...Fine. Stand in the doorway. Half out.\n\nMorvane. There. The verses say he sits at the middle of it, and the rest go quiet when he speaks.\n\nBut here's what Gran had from her gran. Those below don't have names. Not one of them, not ever. They've no use for them. So if there's a name down there, they made it for somebody who came to them needing one. Somebody who'd lost his own.\n\nNow shut the door. You're letting it listen.",
        opts: [["Who loses a name?", "named2", ["clue:named_by_them", "flag:heard_named"]]],
      },
      named2: {
        text: "Somebody who had it burned off every wall in the country, I'd think.\n\nAsk the knights whose that was. They kept a list. They always keep a list.",
        opts: [["I will.", "hub", ["lead:ashen_chapterhouse"]]],
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
        text: "Welcome to Sunscar. Water is two coins a skin, shade is free, and before you ask: the wind.\n\nThe statues. Everyone asks. The desert wind wore the faces away. It's in the town record.",
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
      roost: {
        text: "The Roost. Yes, that's ours too, in the way a hawk on the roof is yours.\n\nThey train riders up there. The Cinder woman runs it now, the one with no dragon. If you want to ride, she's who you ask. If you want my advice, don't. I've read that wall of theirs. It's longer every year.",
        opts: [["Back.", "start"]],
      },
      hub: {
        greets: ["Sunscar thanks you for your visit. I am required to say so. What do you want?", "Mind the statues on your way out. They were here first.", "I have a petition about a goat and then I have you. Go on."],
        text: "Water, shade, or statues?",
        opts: [
          ["Statues.", "doubt"],
          ["The cliff above town.", "roost", ["lead:cinder_roost"]],
          ["Who rules Sunscar?", "seneschal"],
          ["Just passing through.", "end"],
        ],
      },
      hub2: {
        text: "You again. You've got me looking at them on my rounds now. I hope you're pleased.",
        opts: [
          ["The fragments.", "fragments"],
          ["The cliff above town.", "roost", ["lead:cinder_roost"]],
          ["Who rules Sunscar?", "seneschal"],
          ["The riddle on the vault.", "riddle"],
          ["Good day, Warden.", "end"],
        ],
      },
      fragments: {
        text: "My father was warden before me. He used to say the statues remember better than people do. Every one of them has a line cut under it, about when it was carved: the boy, the crowning, the war, and on to an old man.\n\nPut his life in order and turn them that way, youngest first. That's the whole secret. I don't know that, either, officially.",
        opts: [["Back.", "hub2", ["lead:faceless_vault"]]],
      },
      seneschal: {
        text: "The Seneschal. Lord Sorrel. He's been Seneschal as long as there's been a Sunscar, they say, which is just the kind of thing people say.\n\nNobody sees him. He keeps to the lower fortress. He wears a helm. Always has. My father never saw his face either.",
        opts: [["Back.", "hub2"]],
      },
      riddle: {
        text: "There's a heraldry riddle on the vault door out in the dunes. \"Grey eyes over a laughing mouth, the right hand raised.\" Children here skip rope to it.\n\nI always took it for a rhyme. It's a description, isn't it. It's him. The king on all those statues, before they took his face off.",
        opts: [["Back.", "hub2", ["lead:faceless_vault"]]],
      },
      after: {
        text: "He did it himself. With a mason's chisel. So the last hands on that face would be gentle ones.\n\nTwenty years I've told travelers it was the wind.\n\nI'm changing the town record. Let the Order come and argue with me. Thank you for making me look.",
        opts: [["It was worth looking.", "end", ["flag:isolde_record", "sp:1"]]],
      },
    },
  },
  // ================================================================== THE HIDDEN RETURNED
  // Four families who ask the player to find out whether someone they love came back as themselves.
  // The suspects are ordinary-looking villagers (the mobs feature spawns them; see data/returned.js for
  // the truth of each case and the tells). Not every suspect is a copy, and one asker is the copy herself.
  // ------------------------------------------------------------------ Nessa Dunn, Millbrook
  {
    id: "nessa", name: "Nessa Dunn", where: "Millbrook, behind the counter of the bakery. Her husband Harl works the ovens in the back. The shop bell has been taken off the door.",
    start: [
      [["flag:case_harl_right"], "after_right"],
      [["flag:case_harl_wrong"], "after_wrong"],
      [["flag:nessa_met"], "hub"],
      [[], "first"],
    ],
    nodes: {
      first: {
        text: "Two loaves is all that's left. He's baking less.\n\nYou're the one from the keep. Sister Wren says you look at things properly. Would you look at something for me? It's my husband. Don't turn round. He's in the back.",
        opts: [
          ["What about him?", "what", ["flag:nessa_met"]],
          ["Just the bread, thanks.", "end", ["flag:nessa_met"]],
        ],
      },
      what: {
        text: "Harl went out for flour four nights back and came home at dawn, damp, saying the road was long. It's a mile.\n\nHe's kind as ever. Kinder. He remembered my name-day, which he never has in nineteen years.\n\nBut he took the bell off the shop door. Said it gave him a head. And I came down in the night and he was stood in the pantry. Just stood. With his face to the wall.",
        opts: [
          ["What should I look for?", "tells"],
          ["I'll watch him.", "hub"],
        ],
      },
      tells: {
        text: "Wren told me the three things, and I wish she hadn't.\n\nThe hand. Harl's right-handed, always was.\n\nThe wall. When they think nobody's by, they turn and face it.\n\nAnd bells. They can't bear one. Ring one close and they... go home, she said. She wouldn't say where home was.\n\nWatch him knead. Watch him when the shop's empty. Then come and tell me, and tell me true.",
        opts: [["I'll watch him.", "hub"]],
      },
      hub: {
        greets: ["Loaves are a penny. You're not here for loaves, are you.", "Keep your voice down, he's only through there.", "I've been counting how long he stands at the back door. Ask me how long."],
        text: "Well? Have you watched him?",
        opts: [
          ["Tell me again what to look for.", "tells"],
          ["Nessa, that is not Harl.", "verdict_yes"],
          ["He's your husband. He's only tired.", "verdict_no"],
          ["Not yet.", "end"],
        ],
      },
      verdict_yes: {
        text: "...No. No, it isn't, is it.\n\nHe kneads with his left. I've known since the second morning. I wanted someone else to say it so it wouldn't be me.\n\nThe awful thing is he doesn't know. He thinks he's Harl. He asked me this morning why I was crying and he meant it.\n\nThere's a hand-bell on the chapel step. I can't. Would you? Or don't. I don't know which I'm asking.",
        opts: [["I'm sorry, Nessa.", "end", ["flag:case_harl_right", "sp:1"]]],
      },
      verdict_no: {
        text: "Tired. Yes. That'll be it. The road, and the damp.\n\nThank you. You've no idea. I'll make him a posset and we'll say no more about it.",
        opts: [["Be well.", "end", ["flag:case_harl_wrong"]]],
      },
      after_right: {
        text: "I still set two places. He still sits at one, some nights. I've stopped coming down to look.\n\nYou told me true. I asked you to. Take a loaf.",
        opts: [["Thank you.", "end"]],
      },
      after_wrong: {
        text: "You said he was tired.\n\nThe bed was empty this morning and there were wet footprints to the well, and none back. And the pantry wall's damp at the height of a man's face.\n\nI don't blame you. I wanted to hear it. Next time somebody asks you, look harder.",
        opts: [["I'm sorry.", "end"]],
      },
    },
  },
  // ------------------------------------------------------------------ Jorund Kell, Rimehold
  {
    id: "jorund", name: "Jorund Kell", where: "Rimehold, the net sheds by the frozen lake. His father, old Bram Kell, mends nets inside with a grey dog at his feet.",
    start: [
      [["flag:case_bram_right"], "after_right"],
      [["flag:case_bram_wrong"], "after_wrong"],
      [["flag:jorund_met"], "hub"],
      [[], "first"],
    ],
    nodes: {
      first: {
        text: "You. Southerner. You've been asking about the lake, so you know what comes out of it.\n\nMy father went through the ice at midwinter. We had him out inside a hundred breaths. He's not been the same and I need someone who isn't kin to tell me what he is.",
        opts: [
          ["Not the same how?", "what", ["flag:jorund_met"]],
          ["Ask someone else.", "end", ["flag:jorund_met"]],
        ],
      },
      what: {
        text: "He mends with his left hand now. Seventy years a right-handed man.\n\nHe sits with his face to the shed wall, hours at a time.\n\nYou know what that makes him, round here. There's men saying we should take him out on the ice with the fishing bell and be done. I've an axe by the door that says they won't. But I have to know.",
        opts: [
          ["I'll go and look at him.", "hub"],
          ["What does the dog make of him?", "dog"],
        ],
      },
      dog: {
        text: "The dog? Sleeps on his feet. Same as ever.\n\n...Why? What's the dog to do with it?",
        opts: [["I'll go and look at him.", "hub"]],
      },
      hub: {
        greets: ["Mind the nets. Well? I've not slept.", "He asked after you this morning. By name. I don't know what to make of that.", "Tell me you've watched him. Tell me something."],
        text: "Well? You've seen him. What is he?",
        opts: [
          ["What does the dog make of him?", "dog"],
          ["He's your father. Leave him be.", "verdict_no"],
          ["That is not Bram Kell.", "verdict_yes"],
          ["I need longer.", "end"],
        ],
      },
      verdict_no: {
        text: "Say why. I'll need to say it to the others.\n\n...His right arm hangs. Aye. Since the ice. I'd taken it for stubbornness. And the wall's where the lamp hook is, and his eyes are going. And he rings the dawn bell himself, every morning, same as he has since before I was born. Would one of them do that?\n\nGods. I nearly let them take a sick old man out on the lake.\n\nYou've done my house a good turn. Left hand and a wall, and I was ready to believe it. That's how it gets you, isn't it. It doesn't even have to send one.",
        opts: [["Look after him.", "end", ["flag:case_bram_right", "sp:1"]]],
      },
      verdict_yes: {
        text: "Then that's that.\n\n...I'll do it myself. He taught me the knots. It should be me.",
        opts: [["...", "end", ["flag:case_bram_wrong"]]],
      },
      after_right: {
        text: "He's in the shed. Swearing at a net with his wrong hand. Dog on his feet.\n\nGo in and say good day. He likes you. He says you look at things properly.",
        opts: [["I will.", "end"]],
      },
      after_wrong: {
        text: "We rang the fishing bell at him on the ice. He put his good hand over his ear and asked me what in the cold hells I was doing.\n\nHe's forgiven me. I've not. Get out of my shed.",
        opts: [["I was wrong. I'm sorry.", "end"]],
      },
    },
  },
  // ------------------------------------------------------------------ Tilly Marsh, Gull's Rest
  {
    id: "tilly", name: "Tilly Marsh", where: "Gull's Rest, sitting on the sea wall below the lighthouse. About twelve. Her little brother Pip plays on the shingle below, always at the tideline.",
    start: [
      [["flag:case_pip_kept"], "after_kept"],
      [["flag:case_pip_told"], "after_told"],
      [["flag:tilly_met"], "hub"],
      [[], "first"],
    ],
    nodes: {
      first: {
        text: "That's my brother. Pip. He's six.\n\nYou're going to look at him and then you're going to look at me. Grown-ups do. So I'll save you the bother. Yes. I know.",
        opts: [
          ["Know what?", "what", ["flag:tilly_met"]],
          ["I'll leave you be.", "end", ["flag:tilly_met"]],
        ],
      },
      what: {
        text: "He went off the rocks in the spring. Third night. I was meant to be minding him.\n\nHe walked back up the beach in the morning. Wet. Smiling. Mam screamed the whole street awake, she was that glad.\n\nHe throws with his left now. He doesn't like the chapel. When he thinks I'm asleep he gets up and stands by the wall on the sea side.\n\nHe's not Pip. He's ever so nice, though. He lets me win.",
        opts: [
          ["Does your mother know?", "mam"],
          ["Why are you telling me?", "why"],
        ],
      },
      mam: {
        text: "Mam sings again. She does his hair every morning. She didn't get out of bed for a month before he came back.\n\nShe doesn't know. Or she does and she's better at it than me.",
        opts: [["Why are you telling me?", "why"]],
      },
      why: {
        text: "Because you'd have worked it out. You've got a bell on your pack, or you'll get one. Everybody who works it out gets a bell.\n\nI'm asking you not to. That's all. He's not hurting anybody. And the real Pip's not coming back whether you ring it or not, is he.\n\nIs he?",
        opts: [
          ["I'll say nothing, Tilly.", "kept", ["flag:case_pip_kept", "sp:1"]],
          ["Your mother has to be told.", "told", ["flag:case_pip_told", "sp:1"]],
          ["I need to think.", "hub"],
        ],
      },
      hub: {
        greets: ["I saved you a place on the wall. It's the dry bit.", "He's down there again. Look. Right on the line.", "Did you decide? You don't have to say. I can tell if you've decided."],
        text: "Have you thought?",
        opts: [
          ["I'll say nothing, Tilly.", "kept", ["flag:case_pip_kept", "sp:1"]],
          ["Your mother has to be told.", "told", ["flag:case_pip_told", "sp:1"]],
          ["Still thinking.", "end"],
        ],
      },
      kept: {
        text: "...Thank you.\n\nI do know it's not him. I say goodnight to the real one after. Out the window. In case it carries.",
        opts: [["Goodnight, Tilly.", "end"]],
      },
      told: {
        text: "Then you tell her. I'm not going to. And you ring it, if it's got to be rung. Not me.\n\nI was minding him the first time. I'm not doing it twice.",
        opts: [["I understand.", "end"]],
      },
      after_kept: {
        text: "He found a crab today. He named it after me.\n\nYou kept your word. Grown-ups mostly don't.",
        opts: [["Look after each other.", "end"]],
      },
      after_told: {
        text: "Mam knows now. She hasn't rung anything. She just does his hair slower.\n\nI suppose you thought it was right. I suppose it might be.",
        opts: [["I'm sorry, Tilly.", "end"]],
      },
    },
  },
  // ------------------------------------------------------------------ Hesper Lowe, Mirelight
  {
    id: "hesper", name: "Hesper Lowe", where: "Mirelight, the last house before the lanterns stop. She stands in her doorway with a cup of tea in her LEFT hand, half turned toward the door-post. Her husband Odo cuts reeds out back, and the dog stays out there with him.",
    start: [
      [["flag:case_hesper_right"], "after_right"],
      [["flag:case_hesper_done"], "after_other"],
      [["flag:hesper_met"], "hub"],
      [[], "first"],
    ],
    nodes: {
      first: {
        text: "Oh, thank goodness, someone with sense. Come in. No, stay there, the dog's in a mood, he's been in a mood for weeks.\n\nIt's my Odo. I think he's one of them. One of the ones that come back. Will you look at him for me? I daren't ask anyone in the village.",
        opts: [
          ["What makes you think so?", "what", ["flag:hesper_met"]],
          ["Not today.", "end", ["flag:hesper_met"]],
        ],
      },
      what: {
        text: "He looks at me strangely. Sideways. Like he's counting something.\n\nHe's taken to sleeping in the reed shed. He's taken the dog with him, and that dog was MINE, he was mine from a pup, and now he growls when I come near.\n\nAnd Odo's started ringing the chapel bell of an evening. Every evening. He knows I can't abide it lately, it goes right through my head, and he rings it anyway and watches the house.\n\nSomething's wrong with him. You'll see it.",
        opts: [
          ["What should I look for?", "tells"],
          ["I'll go and see him.", "hub"],
        ],
      },
      tells: {
        text: "Old Mag says three things. The wrong hand. Standing to the wall. And they can't bear a bell.\n\nWell, Odo's right-handed same as ever, I'll grant. And I've not caught him at a wall. But he's sly. He'd hide it.\n\nGo round the back and watch him. I'll wait here. I like it here by the door-post, it's restful.",
        opts: [["I'll go and see him.", "hub"]],
      },
      hub: {
        greets: ["You're back. Good. I've kept the tea warm, I don't know why.", "He's out with the reeds. He's always out with the reeds now.", "Tell me what you saw. Take your time. I've nothing but time."],
        text: "Did you see him? Did you see how he looks at the house?",
        opts: [
          ["Odo is himself, Hesper.", "verdict_odo_fine"],
          ["You're right. That's not Odo.", "verdict_odo"],
          ["Hesper. Which hand is your cup in?", "verdict_her"],
          ["Not yet.", "end"],
        ],
      },
      verdict_odo_fine: {
        text: "Himself? Then why does he look at me like that? Why did he take my dog?\n\n...You're kind to say it. I expect you're right. I expect I'm tired. I haven't felt myself since the night I went out for the washing and the fog came down.\n\nIt was only a moment. I was only gone a moment.",
        opts: [["...Rest, Hesper.", "end", ["flag:case_hesper_done"]]],
      },
      verdict_odo: {
        text: "I KNEW it. I knew. Oh, my poor Odo.\n\nI'll tell the neighbours. They'll know what to do. They've a bell.\n\nThank you. Thank you. Mind the dog as you go, he's not been right.",
        opts: [["...", "end", ["flag:case_hesper_done", "flag:case_hesper_blamed_odo"]]],
      },
      verdict_her: {
        text: "My...\n\nThe left. It's in my left.\n\nI'm right-handed. I've always been...\n\nThe dog. The bell. He isn't ringing it AT me. He's ringing it to see if I'll... And I've been stood at this door-post since noon, haven't I. Facing it.\n\nOh.\n\nOh, poor Odo. He's known for weeks. He's been sleeping in the shed and he still brings me my tea.\n\nDon't tell him I know. Please. Let me have the winter. I'll go quiet in the spring, I promise. I'd just like to see him cut the reeds once more.",
        opts: [["I won't tell him.", "end", ["flag:case_hesper_right", "sp:2"]]],
      },
      after_right: {
        text: "He brought me tea again this morning. I held it in my right. It took all my mind to do it, but I did, and he smiled.\n\nThank you for asking about the cup. Nobody else looked at ME.",
        opts: [["Until spring, Hesper.", "end"]],
      },
      after_other: {
        text: "Oh, it's you. I'm sorry, I can't talk, I've such a head. That bell.\n\nIt's restful here by the post. I'll just stand a while.",
        opts: [["...", "end"]],
      },
    },
  },
  // ------------------------------------------------------------------ Corvin Hale, in the Hollow
  {
    id: "corvin", name: "A Voice in the Water", where: "THE HOLLOW. A still pool beside the light river below the Wound ledge, or any quiet water in the Hollow. There is no body: stand the NPC in the water and make it invisible if you can (a potion of invisibility on the NPC, or sink it to the neck). Only a Sorcerer gets words out of it.",
    start: [
      [["!path:marked"], "deaf"],
      [["flag:morvane_fallen", "!flag:corvin_after"], "after"],
      [["flag:corvin_met"], "hub"],
      [[], "first"],
    ],
    nodes: {
      deaf: {
        text: "§7The pool is singing. Thousands of voices on one note.\n\nOne of them, somewhere near the bottom, is very slightly off it, and seems to be swearing.\n\nYou cannot make out the words. Someone with the art might.",
        opts: [["Leave the water.", "end"]],
      },
      first: {
        text: "No. No, no. Stand still. You're dripping warmth into it.\n\nSo it's you. The flat one. I've been listening to you murder those arts from down here for longer than I care to say, and now you've walked in, on legs, and you want to chat.\n\nWell? Three hundred years I've held this note with every soul they ever took. Make it worth my dropping it.",
        opts: [
          ["Who are you?", "who", ["flag:corvin_met"]],
          ["Are you dead?", "dead", ["flag:corvin_met"]],
        ],
      },
      who: {
        text: "I was burned. Thoroughly, at dawn, with my books. And then some careful soul put what was left into a river, on the theory that nothing could gather it.\n\nNot one man on that tribunal had ever asked himself where rivers go.\n\nHale. Corvin Hale. I tuned the hundred bells of Crownhold and I held a lamp at a table of wet stone, and I was right about everything, and it did me no good at all.",
        opts: [["I have read your notebooks.", "hub", ["sp:1"]], ["Old Mag sent me, in a way.", "mag"]],
      },
      dead: {
        text: "I wrote it down myself. \"Those who walk down to them are not eaten. They are kept.\" I simply never expected to be evidence.\n\nI'm not alive. I'm not gone. I am a note with opinions. It turns out that's most of what I was before.",
        opts: [["Who were you?", "who"]],
      },
      hub: {
        greets: ["Stand still. The water carries better when you stand still.", "You again. Good. I had half a sentence saved for you and I've lost it. Ask.", "Speak low. I am borrowing this breath from a tune and it will be wanted back."],
        text: "Ask. Quickly. Every word I say to you is a word I'm not singing, and they notice.",
        opts: [
          ["What did the truce really say?", "truce"],
          ["Tell me about the King.", "king"],
          ["Your last page stops mid-sentence.", "sentence"],
          ["Old Mag is still alive.", "mag"],
          ["Who sits in the chair down here?", "chair"],
          ["Go back to your note.", "end"],
        ],
      },
      truce: {
        text: "Three lines. I can still see his breath in the lamp.\n\nThey take back the army they called. Every third night is theirs: no bell is rung, they walk above as guests, and any of ours who wish may walk below. And it is sworn on their crown, not his, which he may not wear and they would not touch.\n\nThat's all. No souls. No firstborn. No trick. Everything that went wrong after went wrong on our side of the paper.",
        opts: [["Back.", "hub", ["clue:truce_terms"]]],
      },
      king: {
        text: "He was the only man at court who never laughed at me. Do you know how rare that is, for a king? They're raised to it.\n\nHe took their pledge in his bare right hand because it was offered to him, and it would have been rude to ask for a cloth. It bit him to the bone. He never used that hand again and he never once mentioned it.\n\nAt my trial I had one defence. \"I remember him.\" It was true and it was sufficient and they burned me for it.",
        opts: [["Back.", "hub"]],
      },
      sentence: {
        text: "\"Someone must.\" Yes. I ran out of candle. They came for me before I could find another.\n\nYou'll have imagined something grand. Someone must wear the crown. Someone must slay the thing.\n\nIt was: someone must go down and say good morning. That's the whole discovery. Thirty years, a hundred bells, and that's all of it. They had been knocking for four hundred years and nobody had answered the door.\n\nA thing sworn can be sworn again. But only by someone who's first bothered to say hello.",
        opts: [["Good morning, Master Hale.", "sentence2", ["flag:corvin_ending"]]],
      },
      sentence2: {
        text: "...\n\nWell.\n\nThat's the first time anyone's said it to me, as it happens. In either world.\n\nGet out before I become sentimental. It puts me off the note.",
        opts: [["Back.", "hub", ["sp:2"]]],
      },
      mag: {
        text: "Magda? The small one? She's ALIVE?\n\nShe was twelve. She carried the ninth notebook into a swamp in the dark with hounds behind her, and I never knew if...\n\nTell her this, exactly. Tell her she still holds a pen like a trowel. She'll know it's me. Nobody else was ever that rude to her.",
        opts: [["I'll tell her.", "hub", ["flag:corvin_says_mag"]]],
      },
      chair: {
        text: "No.\n\nNot from me. I'll teach you every art there is and I'll tell you what was said at that table to the word. But who sits there is a thing you'll want to have worked out yourself, standing up, before you see him. It will matter to you that you did. It will matter to him.\n\nYou have all the pieces. Three people up there are each holding one. Go and be a nuisance to an archivist.",
        opts: [["Back.", "hub"]],
      },
      after: {
        text: "He's stopped.\n\nI felt it go out of the note like a string cut. The whole Choir went a hair sharp. They don't know what to do without him. Neither do I, as it happens.\n\nI held the lamp for him once, at the table. I should have liked to hold it at the end. I gather you did that instead, in your fashion. Was he...\n\nNo. Don't tell me. I remember him. That was always the point of me.",
        opts: [["He kept his father's book.", "after2", ["flag:corvin_after"]]],
      },
      after2: {
        text: "Of course he did. The red one. He used to read it on the walls on the third nights, when he thought no one could see.\n\nThe chair's empty now, and it wants someone who can hear all of this at once and not break. If that's to be you, then listen to an old flat voice: keep the truce. It was a good one. It was only ever kept by one man.",
        opts: [["I'll remember him too.", "hub", ["sp:2"]]],
      },
    },
  },
  // ------------------------------------------------------------------ the four regional mentors (mentors.js)
  ...MENTOR_NPCS,
  // ------------------------------------------------------------------ The Carter, the Hollow
  // The middle stretch's guide (Mateo approved 2026-11-11). Placed by script (undertow/story.js): at
  // the Wound landing, then Glimwade, then the Court door. Those below have no names (Sigrun), so she
  // has none until the player gives her one. Never says Oswin; never sees the face in the Chair.
  {
    id: "carter", name: "The Carter", where: "THE HOLLOW. Placed by script, never by hand: the Wound landing dock, then Glimwade, then the Court door once a player has the Cartsong. Drives the dawn ore cart. Young, quick, frightened of one thing only.",
    start: [
      [["flag:morvane_fallen", "flag:carter_named", "!flag:carter_last"], "last"],
      [["flag:hb_choir_silenced", "!flag:carter_named"], "after"],
      [["flag:carter_named"], "named"],
      [["flag:cartsong"], "door"],
      [["flag:hb_ready"], "song"],
      [["flag:hb_glimwade"], "hub"],
      [["flag:carter_met"], "landing2"],
      [[], "first"],
    ],
    nodes: {
      first: {
        text: "You're dripping light. Everyone from the bright side does, for a while. It wears off.\n\nI saw the crack open from the cart road. I thought someone ought to come and look, and nobody else would, so here I am, sitting on a dock, talking to it.\n\nHave you come to take the cart's place? He said someone would, one day.",
        opts: [
          ["What cart?", "cart", ["flag:carter_met"]],
          ["Who said?", "he", ["flag:carter_met"]],
          ["Who are you?", "name", ["flag:carter_met"]],
        ],
      },
      cart: {
        text: "The ore cart. I drive it. Every dawn, from the villages, down the long rail to the south end, to the Seat. I bring it back empty.\n\nWhat goes in it is Choir Ore. What it is for, you'd better see for yourself. Go to Glimwade, up the bank on the left. Watch them load it. I'll meet you there.",
        opts: [["I'll go to Glimwade.", "end"], ["Who are you?", "name"]],
      },
      he: {
        text: "Him in the Chair. Morvane.\n\nDon't look like that. Everyone up there knows the name, I'm told. You shout it at your walls on the third night.\n\nI've driven past him a hundred times. I have never once seen his face. You don't look up when you pass the Chair. That's the first thing you learn.",
        opts: [["What cart?", "cart"], ["Who are you?", "name"]],
      },
      name: {
        text: "The Carter. That's what I do, so that's what I'm called.\n\nWe don't have names down here, not the way you do. A name is something you give to someone who has lost theirs. Nobody's ever lost mine. I never had one to lose.",
        opts: [["That's sad.", "name2"], ["What cart?", "cart"]],
      },
      name2: {
        text: "Is it? You lot have names and you still forget each other.\n\nGo to Glimwade. Up the bank on the left, where the lamps are. Watch the cart. Then come and find me.",
        opts: [["I'll go.", "end"]],
      },
      landing2: {
        text: "Glimwade. Up the bank on the left, where the lamps are. Watch them load the cart, and then we'll talk. I'll be there before you.",
        opts: [["I'm going.", "end"]],
      },
      hub: {
        greets: [
          "You came back. People from the bright side mostly don't. Ask.",
          "Keep your voice down near the rails. They carry.",
          "The cart's out. I've got till it comes back. Ask me something.",
        ],
        text: "Ask what you like. If I don't know, I'll say. If I do know and I'm frightened to say it, I'll say that too.",
        opts: [
          ["What is the ore for?", "ore"],
          ["Who sits in the Chair?", "chair"],
          ["Tell me about your brother.", "brother"],
          ["I've been walking your country.", [
            [["flag:hb_truce_hall", "!flag:cr_truce"], "r_truce"],
            [["flag:hb_standing_ranks", "!flag:cr_ranks"], "r_ranks"],
            [["flag:hb_far_door", "!flag:cr_door"], "r_door"],
            [["flag:hb_drift", "!flag:cr_drift"], "r_drift"],
            [["flag:seams_wreck", "!flag:cr_seams"], "r_seams_w"],
            [["flag:seams_spare", "!flag:cr_seams"], "r_seams_s"],
            [[], "r_none"],
          ]],
          ["Where should I go?", "where"],
          ["I'll go.", "end"],
        ],
      },
      ore: {
        text: "It sings. Hit it and it holds the note. That's the whole of it.\n\nEvery stone goes south to the Seat, and from the Seat to the Court, and the Singers in the Court hold it while they sing. They sing at the Door. The Door gets wider.\n\nEvery night your walls get knocked on, somebody down here dug for it.",
        opts: [["Back.", "hub"]],
      },
      chair: {
        text: "Morvane. That's all I've got. He hums your songs sometimes, ones nobody down here knows. That's how we know he's one of yours.\n\nHe never looks at the river. Everyone looks at the river; it's the only light we have. He looks up. Like a man waiting for a bell.",
        opts: [["Back.", "hub"]],
      },
      brother: {
        text: "Small. Loud. Cracked voice, like a gate. They took him from Highcut to sing in the Court because you could hear him three seams away.\n\nThat's what the Court is. Ours. Our little ones, mostly, the loud ones. Whatever you've been told up there, the Choir is just us, singing because we were told to.",
        opts: [["I'll bring him back.", "hub", ["flag:carter_promise"]], ["Back.", "hub"]],
      },
      where: {
        text: "West of the Cross, the old hall where two kings sat down. East, past Cartmeet, the Standing Ranks. Far west, the Door. The stones east of the path that forgot to fall: climb to the top one. And the Seams, past Cartmeet, where the rail starts.\n\nSee three of them and come back. Then you'll know enough to see the Court.",
        opts: [["Back.", "hub"]],
      },
      r_truce: {
        text: "The table's still there? Both chairs?\n\nOne knocked over. Yes. Ours stayed sitting. My grandmother said the one who knocked his over was the one who ran, and the one who stayed was the one who meant it.\n\nShe never said which side was which. I always assumed.",
        opts: [["Back.", "hub", ["flag:cr_truce"]]],
      },
      r_ranks: {
        text: "We were told they were a gift. An army, all of it, given to us to keep, because your king asked us to take it away.\n\nAn empty place at the front? That'll be the one who leads them. The one with the splinter in his head. We gave him back. Morvane wanted him.",
        opts: [["Back.", "hub", ["flag:cr_ranks"]]],
      },
      r_door: {
        text: "It's the only door we had. Your side shut it with a bell, and the bell broke doing it, and the crack's the bell's.\n\nMy mother dug there. Her mother dug there. You wouldn't call it a war, what we're doing. It's knocking. For three hundred years. On our own front door.",
        opts: [["Back.", "hub", ["flag:cr_door"]]],
      },
      r_drift: {
        text: "You saw him lift his hand? The left one?\n\nHe always does it with the left. The right one he keeps in his lap. My father said it was hurt a long time ago, before he came down, and it never healed, because nothing up there heals down here.",
        opts: [["Back.", "hub", ["flag:cr_drift"]]],
      },
      r_seams_w: {
        text: "That was you? On the trestle?\n\nThe cart didn't come back this morning. I walked the rail and found it in the river, and I stood there and I laughed, and then I was sick, and then I laughed again.\n\nHe'll know someone did it. He won't know who. Neither will I, if anyone asks.",
        opts: [["Back.", "hub", ["flag:cr_seams"]]],
      },
      r_seams_s: {
        text: "The Highcut lot told me. You wouldn't let them risk it.\n\nThey talk about you now. That's not nothing, down here. Nobody talks about anybody. Go to any Tally once he's gone and see if they don't treat you right.",
        opts: [["Back.", "hub", ["flag:cr_seams"]]],
      },
      r_none: {
        text: "Not far yet. Go and look at something. I'll be here. I'm always here, or on the rail.",
        opts: [["Back.", "hub"]],
      },
      song: {
        text: "You've seen enough. I can tell. You've got the look we get after our first cart.\n\nThe Court gate opens to one note, for the cart, every dawn. I've hummed it a thousand times. Listen. Then do it back to me. Lower. Lower than that. There.",
        opts: [["Hum it back.", "song2", ["flag:cartsong", "sp:2"]]],
      },
      song2: {
        text: "That's the Cartsong. The gate will take you for a cart. It won't know the difference till you're inside.\n\nThe singer with the cracked voice is my brother. When they fall quiet in there, they don't die. They just stop. Bring him out to me, if you can. I'll be at the Court door.",
        opts: [["I will.", "end", ["flag:carter_promise"]]],
      },
      door: {
        text: "Still here. I'll be here until it's done, one way or the other.\n\nYou hum it at the gate. Don't hurry it. If the Court hears a cart in a hurry, it knows.",
        opts: [["Tell me about your brother.", "brother"], ["Who sits in the Chair?", "chair"], ["I'm going in.", "end"]],
      },
      after: {
        text: "They came out. All of them. Holding their throats, walking past me like they were going home from a shift.\n\nHe came out. Not a sound left in him. He knew me, though. He put his hand on my face like he used to.\n\nI'd like you to do something for me. Give me a name. That's what you do for someone who's lost theirs, and I think I've lost the Carter. There's no more cart.",
        opts: [
          ["Lark.", "named_lark", ["flag:carter_lark", "flag:carter_named"]],
          ["Morrow.", "named_morrow", ["flag:carter_morrow", "flag:carter_named"]],
          ["Dawn.", "named_dawn", ["flag:carter_dawn", "flag:carter_named"]],
        ],
      },
      named_lark: {
        text: "Lark.\n\nThat's a bird, isn't it? One of yours, up in the light. Loud. Sings when it isn't told to.\n\nYes. I'll have that.",
        opts: [["What now?", "named2"]],
      },
      named_morrow: {
        text: "Morrow.\n\nTomorrow. The day after the one you're in. We don't have those down here, not really. Every day is the cart.\n\nYes. I'll have that.",
        opts: [["What now?", "named2"]],
      },
      named_dawn: {
        text: "Dawn.\n\nThe cart went at dawn. Every day of my life. Now it's just going to be a time of day.\n\nYes. I'll have that.",
        opts: [["What now?", "named2"]],
      },
      named2: {
        text: "Now you go south. Up the long climb to the Seat.\n\nHe was given a name too, you know. The one in the Chair. Somebody down here gave it to him when he came, because he'd lost his own. Nobody alive remembers what it was before.\n\nHe's never once looked at the river. Go and see what he's looking up at.",
        opts: [["I'll go.", "end", ["sp:2"]]],
      },
      named: {
        greets: [
          "Say it again. My name. I like hearing it.",
          "The rail's quiet. I keep waking at dawn anyway.",
          "He sleeps a lot, my brother. Smiles in it. No sound.",
        ],
        text: "The Court's quiet. You can hear the river now. I never knew it made a noise.",
        opts: [["Who sits in the Chair?", "chair2"], ["Goodbye.", "end"]],
      },
      chair2: {
        text: "I don't know. I never looked.\n\nBut he hums your songs. He keeps his right hand in his lap. And he's waited three hundred years for a bell that nobody rings. Whoever he was up there, someone must have loved him once. Nobody waits that long for nothing.",
        opts: [["Back.", "named"]],
      },
      last: {
        text: "It's gone quiet all the way down. Not the Court. All of it. The whole Hollow stopped humming for a breath, the way you do when someone leaves the room.\n\nWho was he?\n\n...No. Don't tell me yet. Tell me some other time, when I'm older. I'd like there to be something left to find out.",
        opts: [["Some other time.", "end", ["flag:carter_last", "sp:1"]]],
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
  "Half of Rimehold walked onto a lake once. The other half won't talk about it. Bad for trade.",
  "People who keep books say the old king's name turns up if you read enough of them. What old king?",
  // doors left open for later updates (design thread's proposals, 2026-11-10; none has an answer in the game yet)
  "The Gullcliff boats saw lights again, out past where the charts stop. Low on the water. Moving together.",
  "A fisherman's wife told me there's land west of the last sounding. Her husband told me to stop listening to his wife.",
  "Bought a crate of books off a wreck. One of them isn't in any letters I know. Nor any the priest knows. He kept it, mind.",
  "There's a door in the hills with no moon carved on it and no handle either. Shepherds eat their dinner against it.",
  "Every region's got one door nobody's opened. Ask anywhere. They'll all say theirs is the only one.",
  "My grandfather sold maps. Said the honest ones had an edge and the dishonest ones had a sea serpent.",
  // plain talk, so the same ten are not heard for ever
  "Iron's dear this year. It's the walls. Everybody's building walls.",
  "A raven sat on my cart from Oakmere to the ford and never once asked for anything. Unnatural.",
  "The grey brothers bought every candle I had and wouldn't say what for. Paid, though. They always pay.",
  "I knew a man who slept through a third night. Said it was the best sleep of his life. Moved to the coast after.",
  "They're ringing fewer bells in the Vale this year. Don't know if that's good news or the other kind.",
  "Somebody's been leaving bread out on the Rimehold ice. Nobody admits to it. It's always gone by morning.",
];
