// The Five Chairs: the five houses of the Hollow whose lords sat at the table of wet stone for the
// Truce of the Third Night (LORE-BIBLE "The truth, in order", step 5). Morvane sat over them for three
// hundred years. When he falls, every one of them wants the seat.
//
// Words only. Rules are in ../rules.js, the world side in ../chairs.js.
// Rules for these lines (same as all lore text): no line names who Morvane was, nobody says "Oswin",
// and anything a player can hear more than a few times has at least three wordings.
//
//   temper     which Regent temperament (undertow/regent.js TEMPERS) rules while this house holds the seat
//   wants      one line: what the house wants, shown on the Five Chairs board
//   table      what their lord said at the truce table, as the house remembers it
//   envoys     names their envoys go by
//   lines      pitch       an envoy asking for your backing
//              backed      you agreed
//              refused     you said no
//              guest       opening words on a Guest Night (the truce holds; they came by right)
//              unbidden    opening words when there is no truce (they came anyway)
//              seatGained  said to everyone when the house takes the seat
//              seatLost    said to everyone when it loses it
//              champion    said when one of its champions (a Pretender) rises

export const HOUSES = [
  {
    id: "bell", name: "House Ondrel", style: "the Low Bell", temper: "zealot", color: "§9",
    seat: "a belfry standing up to its shoulders in black water",
    wants: "The old songs sung right, and no bell rung above on the third night. Ever.",
    table: "Their lord asked for one thing at the table: that the bells above be still on the night that was ours. Your king said yes before the others had finished speaking.",
    envoys: ["Esk of the Low Bell", "Sister Vey", "Old Tamber", "Ilse Undertone"],
    lines: {
      pitch: [
        "The Choir lost its voice when he fell. Someone must teach it the old note again. We remember it.",
        "Back us, and the Hollow will sing the way it sang before your people learned to ring it out.",
        "We do not want your gold. We want quiet, once every three nights. Is that so much?",
        "Every other house wants the seat for what it holds. We want it for what it hears.",
      ],
      backed: ["Then listen on the third night. You will hear us thank you.", "Good. Keep your bells still and we will keep our word."],
      refused: ["You have always been loud up here.", "Then we will sing without you. We have done it before."],
      guest: ["We came by the old right. Nobody had to ring for us.", "A guest, on the night that is ours. It has been a long time."],
      unbidden: ["There is no truce to ask leave under, so we did not ask.", "We came without leave. Hear us out before you ring anything."],
      seatGained: "House Ondrel holds the empty seat. Down below, the Choir finds its note again.",
      seatLost: "House Ondrel has lost the seat. Below, one part of the Choir goes quiet.",
      champion: "sings for House Ondrel.",
    },
  },
  {
    id: "salt", name: "House Vesk", style: "the Salt Ledger", temper: "greedy", color: "§6",
    seat: "a counting-house on stilts over a salt flat",
    wants: "Every debt paid. The surface's included.",
    table: "Their lord wrote the terms down while the others argued. It is their copy of the truce that survived. They will sell you a look at it.",
    envoys: ["Marrow Vesk", "Teller Quine", "Abbet Saltwright", "Dame Orrin Vesk"],
    lines: {
      pitch: [
        "Three hundred years of third nights, and nobody has ever balanced the account. We would like to.",
        "Back us and Choir ore flows. At a price, naturally. Everything has one.",
        "The others talk about songs and walls. We talk about what is owed. You will find us easier to deal with.",
        "Your people broke a truce once. We kept the receipt. Back us and we may lose it.",
      ],
      backed: ["Noted, and entered.", "A sound investment. We will remember who paid in early."],
      refused: ["Noted. Also entered.", "Then you will pay full price, like everyone else."],
      guest: ["Guests, by the terms. We read them again on the way up.", "A third night, and nobody is collecting. It feels wrong. Pleasant, but wrong."],
      unbidden: ["No truce, no terms. So no protection either, for anyone. Shall we talk anyway?", "We came on our own account."],
      seatGained: "House Vesk holds the empty seat. Somewhere below, someone starts counting.",
      seatLost: "House Vesk has lost the seat. The ledgers are closed, for now.",
      champion: "comes to collect for House Vesk.",
    },
  },
  {
    id: "lamp", name: "House Ilith", style: "the Lamp-Keepers", temper: "fair", color: "§e",
    seat: "a lamp-tower where the light rivers meet",
    wants: "Light on every river, and honest trade with the bright world.",
    table: "Their lord brought a lamp to the table so the king could see the others' faces. It was the only light in the room.",
    envoys: ["Wick Ilith", "Lanna of the Rivers", "Fen Lampwright", "Corra Ilith"],
    lines: {
      pitch: [
        "We kept the rivers lit while he sat in the dark. Back us and we will keep them lit for you.",
        "Fair weights, open roads, a market on both sides of the Gate. That is all we have ever asked.",
        "The others want to rule the Hollow. We want to be able to see it.",
        "You came down our rivers to reach him. Did any of our lamps fail you?",
      ],
      backed: ["Then there will be a light at your landing when you come down.", "Thank you. We will not make you sorry for it."],
      refused: ["The lamps stay lit either way. Mind the dark parts.", "That is fair. We will ask again when you have seen the others."],
      guest: ["A guest night. We brought a lamp, in case yours were low.", "We came up the old way, as guests. It still feels like a gift."],
      unbidden: ["No truce, so we came quietly. We did not want to frighten anyone.", "We came without leave, and without weapons. Look."],
      seatGained: "House Ilith holds the empty seat. The light rivers burn a little brighter tonight.",
      seatLost: "House Ilith has lost the seat. A few of the river lamps go out.",
      champion: "carries House Ilith's lamp to the seat.",
    },
  },
  {
    id: "root", name: "House Saelin", style: "the Deep Root", temper: "patient", color: "§2",
    seat: "a hall grown out of one Latticewood root",
    wants: "To wait. They are very good at it.",
    table: "Their lord said nothing at the table at all. When the others had signed, they signed too, and smiled.",
    envoys: ["Saelin the Younger", "Moss-Hand", "Tobin Under", "Aunt Rue"],
    lines: {
      pitch: [
        "Houses rise. Houses fall. Roots stay. Back us, and you will be on the side that is still here.",
        "We are in no hurry. But you are, up there. So we thought we should ask now.",
        "The others will tell you what they want. We will tell you what we will still want in a hundred years. It is the same thing.",
        "Back us, and the ore comes slowly, and cheaply, and forever.",
      ],
      backed: ["Good. Now we wait together.", "We knew you would. We only had to wait."],
      refused: ["That is all right. We can wait.", "Ask us again in a year. We will still be here."],
      guest: ["A guest night. We were going to come anyway, but this is nicer.", "We have been waiting to be asked up. A long time."],
      unbidden: ["No truce. We came anyway. We have waited long enough for leave.", "We are not here to hurt anyone. Not yet, and not soon."],
      seatGained: "House Saelin holds the empty seat. Nobody below seems surprised.",
      seatLost: "House Saelin has lost the seat. They do not seem to mind.",
      champion: "grows up out of the floor for House Saelin.",
    },
  },
  {
    id: "tide", name: "House Carrack", style: "the Tidewall", temper: "unbending", color: "§3",
    seat: "a sea-wall with nothing left to hold back",
    wants: "Walls. Their own, this time.",
    table: "Their lord wanted the Grey Host for themselves and said so. They were outvoted. They have never forgotten it.",
    envoys: ["Brann Carrack", "Wall-Warden Hesk", "Ysa Carrack", "Old Breaker"],
    lines: {
      pitch: [
        "You know walls. So do we. Back us, and the Hollow will have them, and nobody will ever push it out again.",
        "The others will sell you songs and lamps. We will give you a neighbour that does not move.",
        "Back us and nothing comes through the Gate that we do not let through. Nothing.",
        "We were the last house to stop fighting at Bellhollow. We are the first to start again, if we must.",
      ],
      backed: ["Then we stand together. Like stones in a wall.", "Good. We do not forget who stood with us."],
      refused: ["We do not forget who would not.", "Then build your walls high."],
      guest: ["We came as guests. We are not good at it. Bear with us.", "A guest night. Our soldiers stayed below. Most of them."],
      unbidden: ["No truce. So we came armed. Do not take it personally.", "We came without leave, like you did, when you came down to us."],
      seatGained: "House Carrack holds the empty seat. Below, the walls go up.",
      seatLost: "House Carrack has lost the seat. Somewhere below, a wall comes down.",
      champion: "marches for House Carrack.",
    },
  },
];

// Said once, at the first dawn after Morvane falls, to everyone.
export const TABLE_SCENE = [
  "§5Word comes up through the Rift.§7 In the Choir's hall the old table of wet stone stands where it always stood.",
  "§7Five chairs have been pulled out from it. A sixth lies on its side.",
  "§8Nobody below is singing. Everybody below is talking.",
];

// When a house loses standing, gains it, and so on: the Five Chairs board.
export const BOARD_INTRO = [
  "Five houses sat at the table when the truce was sworn. One chair is empty now, and every house wants it.",
  "The house that holds the seat has the ear of whoever wears the Hollow Crown. Its temper is theirs.",
];
