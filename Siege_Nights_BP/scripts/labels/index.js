// Every block and NPC that opens a menu when clicked, with the floating label it gets.
// The system itself is core/labels.js. A new menu asset adds one line here, or calls
// addMenuLabel(...) from its own folder (exported from siege/api.js); either works.
//
// Left out on purpose: things that are meant to be found or that only act (Dusty Tome caches,
// the Hollow's vault and deep door, dragon nests, gates, beds, bells), and fighting machines,
// guards, horses and dragons, which are creatures rather than menus.

import { addMenuLabel, labelledBlocks, labelledEntities } from "../core/labels.js";
import { BlockTypes, EntityTypes } from "@minecraft/server";
import { addTests, assert } from "../core/tests.js";

const BLOCKS = [
  // your settlement
  ["siege:keep_banner", "Keep Banner", "Click: settlement menu"],
  ["siege:barracks", "Barracks", "Click: guards"],
  ["siege:hall_cornerstone", "Hall Cornerstone", "Click: town hall"],
  ["siege:tree_of_oaths", "Tree of Oaths", "Click: skills"],
  ["siege:hall_board", "Town Board", "Click: town hall"],
  ["siege:foundation_stone", "Foundation Stone", "Click: pick a building"],
  ["siege:plot_stone", "Plot Stone", "Click: this plot"],
  ["hc:looking_glass", "Looking Glass", "Click: change your look"],
  ["siege:archive_shelf", "Archive Shelf", "Click: the library"],
  // travel and animals
  ["hc:station_post", "Station Post", "Click: trains"],
  ["siege:rail_depot", "Rail Depot", "Click: the rail network"],
  ["siege:stables", "Stables", "Click: your horses"],
  ["hc:breeder_post", "Breeder's Post", "Click: breeding"],
  ["siege:dragon_roost", "Dragon Roost", "Click: your dragon"],
  // the crown
  ["siege:citadel_cornerstone", "Citadel Cornerstone", "Click: the Citadel"],
  ["siege:throne", "The Throne", "Click: the throne"],
  // the Hollow
  ["siege:waystone", "Waystone", "Click: travel"],
];

const lorePerson = (e) => e.getTags().some((t) => t.startsWith("siege_lore_npc_"));

const ENTITIES = [
  { entity: "siege:job_npc", tag: "siege_job", hint: "Click to trade" },
  { entity: "minecraft:npc", tag: "siege_job", hint: "Click to trade" }, // job NPCs from before the painted skins
  { entity: "minecraft:npc", tag: "siege_mason", hint: "Click: buy blocks" },
  { entity: "minecraft:npc", tag: "siege_rival", hint: "Click to talk" },
  { entity: "minecraft:npc", match: lorePerson, hint: "Click to talk" },
  { entity: "minecraft:npc", tag: "siege_hollowfolk_foreman", hint: "Click: the tally" },
  { entity: "siege:hollow_regent", hint: "Click: ask for an audience" },
  { entity: "siege:quartermaster", hint: "Click to trade" },
];

for (const [block, name, hint] of BLOCKS) addMenuLabel({ block, name, hint });
for (const spec of ENTITIES) addMenuLabel(spec);

addTests("labels", {
  "every listed menu block is labelled": () => {
    const got = new Set(labelledBlocks());
    for (const [id] of BLOCKS) assert(got.has(id), `${id} has no label`);
    assert(labelledEntities().includes("minecraft:npc"), "NPCs have no label");
  },
  "every labelled block and entity really exists in the pack": () => {
    for (const [id] of BLOCKS) assert(BlockTypes.get(id), `no block ${id}`);
    for (const { entity } of ENTITIES) assert(EntityTypes.get(entity), `no entity ${entity}`);
    assert(EntityTypes.get("siege:label"), "no label entity");
  },
});
