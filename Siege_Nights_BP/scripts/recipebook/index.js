// The recipe book only shows the regional armour of the region you're standing in (Mateo 2026-11-13, playtest:
// "Only show the region you're in"). Before, the Workshop's Equipment tab listed all five regions' pieces.
//
// How: the regional armour and guard-gear recipes (recipes/regional_armor/workshop, recipes/regional_guard) unlock on
// an item nobody can pick up, so they start hidden. Every couple of seconds we check which region each player is in
// (the nearest plot's region, as the Smiths use) and, when it changes, /recipe take the old region's and /recipe give
// the new one's. Outside the overworld the book keeps the last region. Crafting by hand still works for any region:
// this only changes what the book lists.
//
//   /scriptevent siege:recipebook          say which region your book shows
//   /scriptevent siege:recipebook reset    take every regional recipe and work it out again

import { world, system } from "@minecraft/server";
import { onTick, addTests, assert, assertEqual } from "../siege/api.js";
import { regionAt } from "../economy/shops.js";
import { ARMOUR_MATERIALS, ARMOUR_REGIONS, ARMOUR_PIECES, REGION_KEY } from "../economy/regional_armor.js";

const PROP = "siege:recipe_region"; // the region key whose recipes this player's book shows now
const GUARD_TIERS = ["", "diamond_", "netherite_"];

// Every book recipe that belongs to one region
export function regionRecipes(region) {
  const out = [];
  for (const piece of ARMOUR_PIECES) {
    for (const mat of ARMOUR_MATERIALS) out.push(`siege:${mat}_${region}_${piece}_recipe`);
    for (const t of GUARD_TIERS) out.push(`siege:guard_${region}_${t}${piece}_recipe`);
  }
  return out;
}
// What to take and give when the book moves from one region to another (from: undefined = never set: take them all)
export function bookChange(from, to) {
  const take = from === undefined ? ARMOUR_REGIONS.filter((r) => r !== to) : from === to ? [] : [from];
  return { take: take.flatMap(regionRecipes), give: from === to ? [] : regionRecipes(to) };
}

let warned = false;
function* switchBook(player, from, to) {
  const { take, give } = bookChange(from, to);
  for (const [verb, list] of [["take", take], ["give", give]]) {
    for (const id of list) {
      try {
        player.runCommand(`recipe ${verb} @s ${id}`);
      } catch (e) {
        if (!warned) { warned = true; console.warn(`[recipebook] /recipe ${verb} failed: ${e}`); }
      }
      yield;
    }
  }
  try { player.setDynamicProperty(PROP, to); } catch { /* left */ }
}

const busy = new Set();
function check() {
  for (const player of world.getAllPlayers()) {
    if (busy.has(player.id)) continue;
    let here;
    try {
      if (player.dimension.id !== "minecraft:overworld") continue;
      here = REGION_KEY[regionAt(player.location)];
    } catch { continue; }
    if (!here) continue;
    const shown = player.getDynamicProperty(PROP);
    if (shown === here) continue;
    busy.add(player.id);
    system.runJob((function* () {
      yield* switchBook(player, typeof shown === "string" ? shown : undefined, here);
      busy.delete(player.id);
    })());
  }
}
onTick("recipebook:region", 40, check);
world.afterEvents.playerLeave.subscribe((e) => busy.delete(e.playerId));

system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (e.id !== "siege:recipebook") return;
  const p = e.sourceEntity?.typeId === "minecraft:player" ? e.sourceEntity : undefined;
  if (!p) return;
  if (e.message.trim() === "reset") {
    p.setDynamicProperty(PROP, undefined);
    return p.sendMessage("§7Recipe book: worked out again from where you stand.");
  }
  p.sendMessage(`§7Your recipe book shows ${p.getDynamicProperty(PROP) ?? "no"} regional armour.`);
});

addTests("recipe book", {
  "each region has its 32 recipes, none shared": () => {
    const all = ARMOUR_REGIONS.flatMap(regionRecipes);
    assertEqual(regionRecipes("vale").length, 32);
    assertEqual(new Set(all).size, all.length);
    assert(regionRecipes("blackfen").includes("siege:chainmail_blackfen_helmet_recipe"), "workshop armour");
    assert(regionRecipes("blackfen").includes("siege:guard_blackfen_netherite_boots_recipe"), "guard gear");
  },
  "moving region swaps one region for another": () => {
    const first = bookChange(undefined, "vale");
    assertEqual(first.take.length, 4 * 32);
    assertEqual(first.give.length, 32);
    const move = bookChange("vale", "blackfen");
    assert(move.take.every((id) => id.includes("_vale_")) && move.give.every((id) => id.includes("_blackfen_")), "swap");
    assertEqual(bookChange("vale", "vale").give.length, 0);
  },
});
