// Townsfolk: people who walk the streets of the map's six towns, and talk when you click them.
//
// Mateo, 2026-11-12: "There'll be NPCs walking around too that you can talk to, right? Each of them should have
// five things that they say. Some of them pertain to the story, some of them are funny, and some of them don't matter."
//
// What happens in game
//   On a mapped world, when a player comes near Kingsrest, Millbrook, Rimehold, Gull's Rest, Sunscar or Mirelight,
//   that town's townsfolk (data.js) come out, each on their own street spot (spots_data.js), and stroll a few blocks
//   round it. Click one and they stop, turn to you and say the next of their five lines (each player hears them in
//   order, then from the start again). At night they go indoors once nobody is close enough to see; at first light
//   they are back. They cannot be hurt. They are entity siege:townsfolk (walking, unlike the built-in NPC), so they
//   work on a Realm with no Beta features.
//
// Test (creative)
//   /scriptevent siege:townsfolk              list the towns and how many are out
//   /scriptevent siege:townsfolk here         bring out the nearest town's townsfolk now, day or night
//   /scriptevent siege:townsfolk home         send the nearest town's townsfolk indoors
//   /scriptevent siege:townsfolk heard        forget which lines you have heard (everyone starts at line 1)

import { world, system } from "@minecraft/server";
import { onTick, isNight, on, addTests, assert, assertEqual } from "../siege/api.js";
import { applyFilter } from "../core/events.js";
import { WARDS } from "../plots/config.js";
import { mapMode } from "../plots/claims.js";
import { TOWNSFOLK } from "./data.js";
import { FOLK, NEVER_SAID, TOWN_TAG, personTag, peopleOf, lineNumber, speech, canStand, STAND_TRIES, DY_TRIES, towns, skinIndex } from "./rules.js";
import { TOWNSFOLK_SPOTS } from "./spots_data.js";

const TYPE = "siege:townsfolk";
const OVERWORLD = "minecraft:overworld";
const HEARD = "siege:townsfolk_heard"; // player dynamic property: { "<tag>": clicks }
const centreOf = (town) => WARDS.find((w) => w.name === town);
const missing = new Map(); // tag -> checks in a row it was not found
const forced = new Set(); // towns brought out by the test command, night or not

// ---------- placing ----------

function standAt(dim, [x, y, z]) {
  for (const [dx, dz] of STAND_TRIES) {
    for (const dy of DY_TRIES) {
      const fy = y + dy;
      let below, feet, head;
      try {
        below = dim.getBlock({ x: x + dx, y: fy - 1, z: z + dz });
        feet = dim.getBlock({ x: x + dx, y: fy, z: z + dz });
        head = dim.getBlock({ x: x + dx, y: fy + 1, z: z + dz });
      } catch {
        return null; // not loaded
      }
      if (!below || !feet || !head) return null;
      if (canStand(below.typeId, feet.typeId, head.typeId)) return { x: x + dx + 0.5, y: fy, z: z + dz + 0.5 };
    }
  }
  return undefined; // loaded, but something stands there now: skip this one
}

function spawnPerson(dim, p) {
  const at = standAt(dim, p.spot);
  if (!at) return at;
  try {
    const e = dim.spawnEntity(TYPE, at);
    e.addTag(TOWN_TAG);
    e.addTag(personTag(p.town, p.i));
    e.nameTag = p.name;
    e.setProperty("siege:skin", p.skin);
    e.setRotation({ x: 0, y: (p.i * 137) % 360 });
    return e;
  } catch (err) {
    console.warn(`[Hollow Crown] townsfolk: ${err}`);
    return null;
  }
}

const near = (players, loc, r) => players.some((pl) => Math.hypot(pl.location.x - loc.x, pl.location.z - loc.z) <= r);

function tend(dim, town, players) {
  const c = centreOf(town);
  if (!c) return;
  const out = !isNight() || forced.has(town);
  // someone a player has business with (a Town Board job) stays out after dark (townhall/board.js)
  const keptOut = out ? undefined : applyFilter("townsfolkKeepOut", new Set(), { town });
  const here = new Map();
  for (const e of dim.getEntities({ type: TYPE, location: { x: c.x, y: 80, z: c.z }, maxDistance: c.r + 40 })) {
    const tag = e.getTags().find((t) => t.startsWith("siege_tf_"));
    if (!tag) continue;
    if (here.has(tag)) { e.remove(); continue; } // a double from a reload
    here.set(tag, e);
  }
  for (const p of peopleOf(town)) {
    const tag = personTag(town, p.i);
    const e = here.get(tag);
    here.delete(tag);
    if (!out && !keptOut?.has(tag)) {
      missing.delete(tag);
      if (e && !near(players, e.location, FOLK.homeQuietRange)) e.remove(); // gone indoors, unseen
      continue;
    }
    if (e) { missing.delete(tag); continue; }
    const k = (missing.get(tag) ?? 0) + 1;
    missing.set(tag, k);
    if (k < FOLK.missingChecks) continue;
    if (spawnPerson(dim, p) !== null) missing.delete(tag); // placed, or no room there (try again next time)
  }
  for (const e of here.values()) e.remove(); // somebody no longer in the list (a town with fewer spots now)
}

onTick("townsfolk", 100, () => {
  if (!mapMode()) return;
  const players = world.getAllPlayers().filter((p) => p.dimension.id === OVERWORLD);
  if (!players.length) return;
  const dim = world.getDimension(OVERWORLD);
  for (const town of towns()) {
    const c = centreOf(town);
    if (c && near(players, c, FOLK.reach + c.r)) tend(dim, town, players);
  }
});

// ---------- talking ----------

function heardOf(player) {
  try { return JSON.parse(player.getDynamicProperty(HEARD) ?? "{}"); } catch { return {}; }
}

function talk(player, e) {
  const tag = e.getTags().find((t) => t.startsWith("siege_tf_"));
  const m = tag && towns().map((town) => peopleOf(town).find((p) => personTag(town, p.i) === tag)).find(Boolean);
  if (!m) return;
  const heard = heardOf(player);
  const n = lineNumber(heard[tag] ?? 0);
  heard[tag] = (heard[tag] ?? 0) + 1;
  try { player.setDynamicProperty(HEARD, JSON.stringify(heard)); } catch { /* still say it */ }
  player.sendMessage(speech(m, m.lines[n], m.town));
  try {
    const dx = player.location.x - e.location.x, dz = player.location.z - e.location.z;
    e.setRotation({ x: 0, y: (Math.atan2(-dx, dz) * 180) / Math.PI });
    e.addEffect("slowness", FOLK.talkTicks, { amplifier: 255, showParticles: false });
    e.setProperty("siege:talking", true);
    system.runTimeout(() => { try { if (e.isValid) e.setProperty("siege:talking", false); } catch { /* gone */ } }, FOLK.talkTicks);
  } catch { /* looks only */ }
}

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  const { player, target } = event;
  if (target?.typeId !== TYPE) return;
  event.cancel = true;
  if (applyFilter("npcClick", false, { player, target })) return; // the Town Board has a job with them (townhall/board.js)
  system.run(() => { if (target.isValid) talk(player, target); });
});

// ---------- the Almanac and the showcase ----------

on("showcase", ({ dim, nextSpot, label }) => {
  const at = nextSpot();
  const p = peopleOf("Kingsrest")[0] ?? { name: "Townsperson", skin: 0 };
  try {
    const e = dim.spawnEntity(TYPE, { x: at.x + 0.5, y: at.y, z: at.z + 0.5 });
    e.nameTag = p.name;
    e.setProperty("siege:skin", p.skin);
    e.addTag("siege_showcase");
    label(at, "Townsperson\nwalks; click to talk");
  } catch { /* showcase is best effort */ }
});

// ---------- test command ----------

function nearestTown(player) {
  let best, bd = Infinity;
  for (const town of towns()) {
    const c = centreOf(town);
    if (!c) continue;
    const d = Math.hypot(player.location.x - c.x, player.location.z - c.z);
    if (d < bd) { bd = d; best = town; }
  }
  return best;
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:townsfolk") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  const cmd = event.message.trim();
  const town = nearestTown(player);
  const dim = world.getDimension(OVERWORLD);
  if (cmd === "here") {
    forced.add(town);
    for (const p of peopleOf(town)) missing.set(personTag(town, p.i), FOLK.missingChecks);
    tend(dim, town, [player]);
    return player.sendMessage(`§a${town}'s townsfolk are coming out (${peopleOf(town).length}).${mapMode() ? "" : " §7(This world is not in map mode, so they won't be looked after.)"}`);
  }
  if (cmd === "home") {
    forced.delete(town);
    for (const e of dim.getEntities({ type: TYPE, tags: [TOWN_TAG] })) {
      const c = centreOf(town);
      if (Math.hypot(e.location.x - c.x, e.location.z - c.z) <= c.r + 40) e.remove();
    }
    return player.sendMessage(`§7${town}'s townsfolk have gone indoors.`);
  }
  if (cmd === "heard") {
    player.setDynamicProperty(HEARD, undefined);
    return player.sendMessage("§7Everyone will start again from their first line for you.");
  }
  const all = dim.getEntities({ type: TYPE, tags: [TOWN_TAG] });
  player.sendMessage(towns().map((t) => {
    const c = centreOf(t);
    const n = all.filter((e) => Math.hypot(e.location.x - c.x, e.location.z - c.z) <= c.r + 40).length;
    return `§f${t}§7: ${peopleOf(t).length} townsfolk, ${n} out now (loaded)`;
  }).join("\n"));
});

// ---------- self-tests ----------

addTests("townsfolk", {
  "every town has a person for every street spot": () => {
    for (const town of Object.keys(TOWNSFOLK_SPOTS)) {
      assert(TOWNSFOLK[town], `${town} has spots but no townsfolk`);
      assert(TOWNSFOLK[town].people.length >= TOWNSFOLK_SPOTS[town].length, `${town}: ${TOWNSFOLK_SPOTS[town].length} spots, ${TOWNSFOLK[town].people.length} people`);
      assert(centreOf(town), `${town} is not in plots/config.js WARDS`);
    }
  },
  "everyone has exactly five lines, none too long, none twice": () => {
    for (const town of towns()) for (const p of TOWNSFOLK[town].people) {
      assertEqual(p.lines.length, FOLK.linesEach, `${p.name} of ${town}`);
      assertEqual(new Set(p.lines).size, FOLK.linesEach, `${p.name} repeats a line`);
      for (const l of p.lines) assert(l.length <= FOLK.maxLineLength, `${p.name}: line too long (${l.length}): ${l}`);
      assert(p.name && p.trade, `${town}: someone has no name or trade`);
    }
  },
  "names are unique across every town": () => {
    const seen = new Set();
    for (const town of towns()) for (const p of TOWNSFOLK[town].people) {
      assert(!seen.has(p.name), `${p.name} lives in two towns`);
      seen.add(p.name);
    }
  },
  "nobody in the street gives the story away": () => {
    for (const town of towns()) for (const p of TOWNSFOLK[town].people) for (const l of p.lines) {
      const low = l.toLowerCase();
      for (const w of NEVER_SAID) assert(!new RegExp(`\\b${w}\\b`).test(low), `${p.name} of ${town} says "${w}": ${l}`);
      assert(!/[—]/.test(l), `${p.name}: no em-dashes in spoken lines`);
    }
  },
  "lines go round in order": () => {
    assertEqual([0, 1, 2, 3, 4, 5, 6].map(lineNumber).join(","), "0,1,2,3,4,0,1");
  },
  "skins stay inside the 40 painted ones": () => {
    for (const town of towns()) for (const p of peopleOf(town)) assert(p.skin >= 0 && p.skin < 40, `${p.name}: skin ${p.skin}`);
    assertEqual(skinIndex("frostmarch", 2), 10);
  },
  "standing needs ground and headroom": () => {
    assert(canStand("minecraft:cobblestone_slab", "minecraft:air", "minecraft:air"), "slab street");
    assert(!canStand("minecraft:water", "minecraft:air", "minecraft:air"), "water");
    assert(!canStand("minecraft:stone", "minecraft:oak_planks", "minecraft:air"), "inside a wall");
    assert(!canStand("minecraft:air", "minecraft:air", "minecraft:air"), "midair");
  },
});
