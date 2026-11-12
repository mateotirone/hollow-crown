// The Homecomings: with Morvane gone, nothing below holds on to the people the Hollow took. They start
// coming back up, one at a time, three hundred years late (Lost Days), or a few years late (Slips).
// Each stranger is put together from these pools, so no two are alike (rules.js makeStranger).
//
// Lore rules: nobody here names the Hollow's leader or who he was. A stranger who is a copy (one of the
// Returned) does not know it. "the dark", "below", "down there" are how they speak of the Hollow.

export const FIRST = ["Wenna", "Pell", "Odo", "Mags", "Tibby", "Hale", "Bryony", "Cobb", "Elsa", "Jory", "Nim", "Rowan", "Sabine", "Tam",
  "Una", "Wat", "Isolde", "Kit", "Lettice", "Abel", "Merry", "Noll", "Prue", "Joss"];
export const FAMILY = ["Fenwick", "Ashby", "Coombe", "Dunmore", "Harrow", "Kettle", "Larch", "Mossop", "Nethers", "Pike", "Reedy", "Sallow",
  "Thorne", "Underhill", "Waddle", "Yarrow", "Bellweather", "Cresset", "Drury", "Gale"];

// How they went below. `long` = how long they have been gone, in their own words.
export const WHEN = [
  { id: "fetch", how: "went down on a third night to fetch back a brother who had gone first", long: "I was only meant to be an hour." },
  { id: "light", how: "followed a light out into the fen because it looked like a lantern someone had dropped", long: "The light kept being just ahead." },
  { id: "bells", how: "was driving a cart on the bell road the night every bell in the land rang at once", long: "The noise. And then no noise at all." },
  { id: "cellar", how: "went into a cellar for apples and found the back wall wasn't there", long: "There were more steps than there should have been." },
  { id: "guest", how: "went below as a guest on a third night, back when people still did, and stayed too long", long: "They were so kind. I meant to leave in the morning." },
  { id: "ferry", how: "took the last ferry across a lake that is not there any more", long: "The ferryman didn't take my coin. I should have wondered." },
  { id: "sleep", how: "fell asleep in a chapel on the third night, which you must never do", long: "I only closed my eyes for a moment." },
  { id: "slip", how: "slipped, a few winters ago, in the middle of an ordinary sentence", long: "I was saying something. I've forgotten what." },
  { id: "well", how: "leaned over a well to hear the singing better", long: "It sounded so near." },
  { id: "dance", how: "joined a ring of dancers on a hill that were not from any village near", long: "One more dance. Just one more." },
];

// What they want before they can rest. [item, amount, how they ask]
export const ASK = [
  { id: "bread", item: "minecraft:bread", n: 3, line: "Bread. Real bread, with a crust. I have not been full in a very long time." },
  { id: "light", item: "minecraft:lantern", n: 1, line: "A light I can hold. A real one, that burns. Theirs doesn't." },
  { id: "warm", item: "minecraft:white_wool", n: 4, line: "Something warm. I have been cold so long I forgot it was cold." },
  { id: "apple", item: "minecraft:apple", n: 2, line: "An apple. We had a tree. I keep thinking about that tree." },
  { id: "compass", item: "minecraft:compass", n: 1, line: "Something that points the right way. Nothing down there does." },
  { id: "flower", item: "minecraft:poppy", n: 3, line: "Flowers. For a grave. I think there will be a grave by now." },
  { id: "milk", item: "minecraft:milk_bucket", n: 1, line: "Milk. My mother always said it was good for shocks. I think I am having one." },
  { id: "fish", item: "minecraft:cooked_cod", n: 2, line: "A fish, cooked. The fish down there look back at you." },
  { id: "honey", item: "minecraft:honey_bottle", n: 1, line: "Something sweet. The taste in my mouth won't go." },
  { id: "candle", item: "minecraft:candle", n: 2, line: "Candles. For the window, so someone knows I'm back." },
];

// Who or what they are looking for. {FAMILY} is their own family name.
export const SEEK = [
  "Is the {FAMILY} house still standing? It had a blue door. You couldn't miss it.",
  "Do the {FAMILY}s still farm the river field? My father would want to know I'm back.",
  "There was a girl. Her name was {FIRST2}. She'll be old now. Or... she won't be anything now, will she.",
  "I had a little sister. She'd be grown. Or gone. Is there anyone called {FAMILY} left at all?",
  "The mill. Is the mill still turning? I was going to be the miller.",
  "Has anyone been keeping my dog? No. No, of course not. How long has it been?",
  "I owe a man called {FIRST2} two pennies. I'd like to pay him. I suppose that's silly now.",
  "There was a song we sang at harvest. Does anyone still sing it? It went... no. It's gone.",
];

// The truth about them. Never the same twice running (rules.js).
//   true    exactly who they say, and staying
//   copy    one of the Returned: it believes every word (marked for bestiary/returned.js; a bell gives it away)
//   kin     true, and a family of their name still lives somewhere they can be sent
//   back    true, but they would rather go back down: everyone they knew is there
export const TWIST = ["true", "copy", "kin", "back"];

// Closing words, by twist and by the player's choice.
export const ENDING = {
  thanks: [
    "Thank you. You don't know... no, perhaps you do.",
    "That's it. That's exactly right. I'd forgotten.",
    "Oh. Oh, that's real. That's really real.",
    "Thank you. I'll try to remember how to be grateful properly. It's been a while.",
  ],
  stay: [
    "Then I'll stay. Somebody here will need a hand, won't they? People always do.",
    "Here, then. It isn't home. But it's above, and that will do.",
    "I'll stay. If I start humming in my sleep, wake me.",
  ],
  kin: [
    "{SETTLEMENT}? There are {FAMILY}s at {SETTLEMENT}? Then that's where I'm going. Thank you. Thank you.",
    "A {FAMILY} at {SETTLEMENT}. Great-great-great-something. They won't know me. I'll tell them anyway.",
  ],
  back: [
    "I think I'll go back down. Don't look like that. Everyone I knew is down there now.",
    "It's too bright up here, and too loud, and nobody knows my name. Down there they do.",
    "Thank you for this. I'll take it with me. They'll want to see it.",
  ],
  copyStay: [
    "I'll stay. I'll be so useful. You'll hardly know I'm here.",
    "Here's lovely. I'll just stand by the wall a while, and get my bearings.",
  ],
  noItem: [
    "Not yet? That's all right. I've waited longer.",
    "I'll be here. I'm good at waiting now.",
    "Come back when you have it. I'm not going anywhere. I don't think.",
  ],
  leaving: [
    "{NAME} has given up waiting and walked off down the road.",
    "{NAME} is gone. Someone saw them heading for the nearest water.",
  ],
};

// A keepsake each stranger leaves the player who helped them: an ordinary thing with their name on it.
// [item, label]   {NAME} is the stranger's full name.
export const KEEPSAKE = [
  ["minecraft:paper", "{NAME}'s letter, never sent"],
  ["minecraft:string", "A ribbon {NAME} wore down"],
  ["minecraft:flint", "{NAME}'s lucky stone"],
  ["minecraft:feather", "A feather {NAME} kept in a pocket"],
  ["minecraft:stick", "{NAME}'s whittling, half finished"],
  ["minecraft:bone", "A button {NAME} carved"],
  ["minecraft:gold_nugget", "{NAME}'s old penny"],
  ["minecraft:clay_ball", "A thumb-pot {NAME} made, once"],
];
