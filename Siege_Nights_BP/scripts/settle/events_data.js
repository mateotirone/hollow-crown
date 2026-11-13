// Town events, settler requests and site events: the words and numbers. Rules: events_rules.js. Game side: events.js.
// Ids are saved in worlds (Storyteller memory, open events): never rename one. Hand-written lines only.
// Tone: lively by day, uneasy at night, never horror. Nothing here names the Hollow.

export const EVENTS = {
  eventGap: [4, 6], // days between town events (a random whole number in this range)
  requestGap: [3, 5], // days between settler requests
  requestDays: 7, // a request stays open this long, then the settler lets it go
  firstEventDay: 3, // a new town gets its first event no sooner than this many days after it is laid out
  quietAfterSiege: 1, // no new event on a siege night or this many days after one
  siteChance: 1 / 8, // share of finished buildings that come with a site event
  fairPrice: 24, // Regals for 16 blocks at the fair (other regions' stone, at import price)
  playersRenown: 15, // Renown for watching the travelling players to the end
  playersRange: 16, // blocks from the square to count as watching
};

// Town events. kind: a Storyteller kind (for contrast). lord: also happens in Rival Lords' towns.
// needs: what the town must have (see events_rules.js eligible()). start/end: said to the town's owner.
export const TOWN_EVENTS = [
  {
    id: "market_fair", kind: "social", lord: true, needs: {},
    name: "Market fair",
    start: "Carts at the gate since first light: traders from {region} have set up on the square for the day.",
    end: "The fair packs up and rolls out of {town}.",
  },
  {
    id: "players", kind: "quiet", lord: true, needs: {},
    name: "Travelling players",
    start: "A troupe of travelling players has come to {town}. They'll play on the square at dusk.",
    end: "The players take their bows and are gone before morning.",
  },
  {
    id: "wedding", kind: "social", lord: true, needs: { settlers: 2 },
    name: "A wedding",
    start: "{a} and {b} were wed this morning. They'll share {a}'s house, so there's a bed free for someone new.",
  },
  {
    id: "lost_traveller", kind: "social", lord: true, needs: { freeBeds: 1 },
    name: "A lost traveller",
    start: "A traveller came in at dawn, worn through, and asked to stay. There's a bed, so they're staying.",
  },
  {
    id: "harvest_day", kind: "quiet", needs: { anyOf: ["farmhouse", "garden"] },
    name: "Harvest day",
    start: "It's harvest day in {town}. Talk to your Farmer or Gardener: there's a basket for you.",
    end: "The last of the harvest is in.",
  },
  {
    id: "spare_timber", kind: "build", needs: {},
    name: "Spare timber",
    start: "A carter left a load by the Plot Stone, paid for by nobody anyone can name. It's yours.",
  },
  {
    id: "footprints", kind: "mystery", needs: { settlers: 1 },
    name: "Footprints",
    start: "{a} found bare footprints round the Plot Stone at dawn. They start in the middle of the road. Nobody went barefoot last night.",
  },
  {
    id: "supper_miscount", kind: "mystery", needs: { settlers: 3 },
    name: "The supper count",
    start: "{a} says they laid one more place at supper than there are people in {town}. They counted twice. Nobody sat in it.",
  },
];

// What the fair and harvest hand out
export const FAIR_KINDS = ["bricks", "tiles", "smooth", "cobbled"];
export const HARVEST_BASKET = [["minecraft:bread", 6], ["minecraft:carrot", 8], ["minecraft:baked_potato", 6], ["minecraft:apple", 4]];
export const SPARE_TIMBER = [["minecraft:oak_log", 32], ["minecraft:cobblestone", 32], ["minecraft:lantern", 4]];

// What the travelling players say, one line every 10 seconds from dusk
export const PLAY_LINES = [
  "§6The players:§7 Gather round, good people of {town}! Tonight: The Miller and the Three Wishes!",
  "§6The players:§7 A miller caught a fish that could talk. \"Let me go,\" it said, \"and I'll grant you three wishes.\"",
  "§6The players:§7 \"I wish my mill would grind by itself,\" said the miller. And it did, all night, and he couldn't sleep for the noise.",
  "§6The players:§7 \"I wish it would stop!\" he cried. And it stopped, for good, and there was no flour.",
  "§6The players:§7 \"Then I wish I'd never caught you,\" he said. And there he sat by the river, with his rod, and a mill that worked. The end!",
  "§6The players:§7 Thank you, thank you. Coins in the hat, if you've any.",
]
export const TROUPE = ["Mummer Ash", "Mummer Bell", "Mummer Coll"];

// Settler requests. type: build (one more of `ids` stands than when asked), bring (hand the items over), bed (a free
// bed when you answer: their kin moves in). from: the tier it can first be asked at. needs: as for events.
export const REQUESTS = [
  { id: "well_square", kind: "build", type: "build", ids: ["well"], from: 0, renown: 15, coins: 0, ask: "We'd like a well on the square. Carrying water from the stream is wearing us thin.", thanks: "A proper well. You've no idea what that saves us." },
  { id: "another_home", kind: "build", type: "build", ids: ["cottage"], from: 0, renown: 15, coins: 20, ask: "There's folk on the road who'd settle here if there were roofs for them. Another home?", thanks: "They'll be glad of it. So am I." },
  { id: "garden", kind: "build", type: "build", ids: ["garden"], from: 1, renown: 15, coins: 0, ask: "A garden by the fields would see us through the winter.", thanks: "Beans by spring, you watch." },
  { id: "market", kind: "social", type: "build", ids: ["market"], from: 1, renown: 20, coins: 30, ask: "We've things to sell and nowhere to sell them. A market?", thanks: "Market day! I've waited for this." },
  { id: "stable", kind: "journey", type: "build", ids: ["stable"], from: 2, renown: 20, coins: 0, ask: "Somewhere to keep a horse would bring the carters our way.", thanks: "The carters will come now." },
  { id: "watchtower", kind: "fight", type: "build", ids: ["watchtower"], from: 3, renown: 25, coins: 30, ask: "I'd sleep better with a lookout on the wall. Just one tower.", thanks: "Somebody's watching now. That helps." },
  { id: "kin", kind: "social", type: "bed", from: 0, needs: { settlers: 1 }, renown: 10, coins: 0, ask: "My sister's coming up the road. Is there a bed for her? Find one and she'll stay.", thanks: "She's here! Thank you." },
  { id: "hay", kind: "quiet", type: "bring", item: "minecraft:hay_block", count: 4, from: 0, renown: 10, coins: 15, ask: "Bring me four bales of hay before the frost, would you? I'll make it worth your while.", thanks: "That'll keep the animals through the cold." },
  { id: "feast_bread", kind: "social", type: "bring", item: "minecraft:bread", count: 16, from: 0, renown: 15, coins: 0, ask: "We want a feast on the green. Sixteen loaves of bread and we'll do the rest.", thanks: "Bread for everyone. You'll come, won't you?" },
  { id: "lanterns", kind: "quiet", type: "bring", item: "minecraft:lantern", count: 6, from: 0, renown: 15, coins: 0, ask: "The road's black as pitch after dark. Six lanterns and we'll hang them ourselves.", thanks: "Light on the road. Folk will walk it now." },
  { id: "blankets", kind: "quiet", type: "bring", item: "minecraft:white_wool", count: 8, from: 0, renown: 10, coins: 10, ask: "Eight bundles of wool for winter blankets. The nights here run colder than they should.", thanks: "Warm at last." },
  { id: "book", kind: "mystery", type: "bring", item: "minecraft:book", count: 1, from: 0, needs: { anyOf: ["library"] }, renown: 15, coins: 0, ask: "The Archivist says the library's short a book. Any book. Bring one?", thanks: "Shelved, and read twice already." },
  { id: "candles", kind: "quiet", type: "bring", item: "minecraft:candle", count: 4, from: 1, renown: 10, coins: 0, ask: "Four candles, if you can spare them. For the window, at night.", thanks: "We'll keep one lit. Just in case." },
];
export const REQUEST_LINES = {
  call: "§e{name} would like a word with you, in {town}.",
  lapsed: "§7{name} let their request go. \"Never mind. It'll keep.\"",
  notYet: "Still hoping, if you can manage it.",
  done: "§a{name}'s request is done: +{renown} Renown{coins}.",
};

// Site events: something turns up while a building rises (said when it is finished). after: needs the Hollow awake.
// (A seep in a foundation trench was planned, but seeps never open inside someone's walls: bestiary/seeps.js.)
export const SITE_EVENTS = [
  { id: "hoard", coins: [20, 60], text: "The diggers on the {building} turned up a pot of old coins in the footings: {coins}." },
  { id: "bones", text: "Under the {building} the diggers found old bones, laid neatly with their hands crossed. They buried them again, deeper, and said nothing about it to anyone." },
  { id: "tools", items: [["minecraft:iron_pickaxe", 1], ["minecraft:iron_shovel", 1]], text: "The crew on the {building} found someone's old tools in the ground, still good. They left them for you." },
  { id: "rock", text: "The crew hit rock under the {building} and swore at it for an hour. It's up now, and the cellar's the coldest in town." },
];
