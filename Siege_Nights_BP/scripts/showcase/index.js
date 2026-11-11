// Showcase: one command builds a test settlement around you with everything laid out and labelled.
//
//   /scriptevent siege:showcase          build it where you stand (use a flat Creative world)
//   /scriptevent siege:showcase siege    make it night and start a siege on your keep
//
// Other features can add their own exhibits without touching this file:
//
//   on("showcase", ({ player, dim, nextSpot, label }) => {
//     const at = nextSpot();                 // a free spot in the "more" row behind the player
//     dim.getBlock(at)?.setType("siege:plot_stone");
//     label(at, "Plot Stone");               // a sign in front of it
//   });

import { world, system, ItemStack, BlockTypes, ItemTypes } from "@minecraft/server";
import { emit } from "../core/events.js";
import { addTests, assert } from "../core/tests.js";
import { getState, saveState, saveTracked, tracked } from "../siege/state.js";
import { startSiege } from "../siege/siege.js";
import { enlist, equipGuard, GUARD_ARMOR } from "../siege/guards.js";
import { freeColor } from "../siege/territory.js";
import { BALLISTA, BARRACKS, DESK, KEEP_BANNER, QUARTERMASTER, RAM_ENGINE, TREBUCHET } from "../siege/constants.js";

const SUPPLIES = [
  ["siege:gold_coin", 8], ["minecraft:iron_ingot", 64], ["minecraft:diamond", 32], ["minecraft:netherite_scrap", 16],
  ["minecraft:netherite_ingot", 4], ["minecraft:cobblestone", 64], ["minecraft:stone_bricks", 64],
  ["minecraft:red_dye", 8], ["minecraft:blue_dye", 8], ["minecraft:yellow_dye", 8], ["minecraft:bow", 1], ["minecraft:arrow", 64],
];

// Extra looks of the same block worth seeing: [block, states, label]
const VARIANTS = [
  ["siege:castle_stone", { "siege:armor": 1 }, "Castle Stone\nIron reinforced"],
  ["siege:castle_stone", { "siege:armor": 2 }, "Castle Stone\nDiamond reinforced"],
  ["siege:castle_stone", { "siege:armor": 3 }, "Castle Stone\nNetherite"],
  ["siege:castle_stone", { "siege:cracks": 1 }, "Castle Stone\nCracked"],
  ["siege:castle_stone", { "siege:cracks": 2 }, "Castle Stone\nBadly cracked"],
  ["siege:portcullis", { "siege:open": true }, "Portcullis\nOpen"],
  ["siege:castle_gate", { "siege:open": true }, "Castle Gate\nOpen"],
];

const SHOWCASE_TAG = "siege_showcase";

const niceName = (id) => id.replace(/^[a-z]+:/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function setBlock(dim, at, typeId, states) {
  try {
    const block = dim.getBlock(at);
    if (!block) return undefined;
    block.setType(typeId);
    if (states) {
      let perm = block.permutation;
      for (const [k, v] of Object.entries(states)) perm = perm.withState(k, v);
      block.setPermutation(perm);
    }
    return block;
  } catch (e) {
    console.warn(`[Hollow Crown] showcase could not place ${typeId}: ${e}`);
    return undefined;
  }
}

// A sign one block toward the viewer (north of the exhibit), facing them
function label(dim, at, text) {
  try {
    const sign = setBlock(dim, { x: at.x, y: at.y, z: at.z - 1 }, "minecraft:standing_sign", { ground_sign_direction: 8 });
    sign?.getComponent("minecraft:sign")?.setText(text);
  } catch {
    // signs are a nicety
  }
}

function spawn(dim, typeId, at) {
  try {
    const entity = dim.spawnEntity(typeId, { x: at.x + 0.5, y: at.y, z: at.z + 0.5 });
    entity.addTag(SHOWCASE_TAG);
    return entity;
  } catch (e) {
    console.warn(`[Hollow Crown] showcase could not spawn ${typeId}: ${e}`);
    return undefined;
  }
}

function fillChests(dim, at, stacks) {
  let chest;
  let slot = 27;
  let n = 0;
  for (const stack of stacks) {
    if (slot >= 27) {
      const block = setBlock(dim, { x: at.x + n * 2, y: at.y, z: at.z }, "minecraft:chest");
      chest = block?.getComponent("minecraft:inventory")?.container;
      slot = 0;
      n++;
    }
    try {
      chest?.setItem(slot++, stack);
    } catch {
      // an item that can't be stacked like this; skip it
    }
  }
  return n;
}

function buildShowcase(player) {
  const dim = player.dimension;
  if (dim.id !== "minecraft:overworld") return player.sendMessage("§cThe showcase only works in the Overworld.");
  const state = getState();
  const o = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
  const at = (dx, dz, dy = 0) => ({ x: o.x + dx, y: o.y + dy, z: o.z + dz });

  // Clear the ground (everything is south of you, +z; the extras row is behind you)
  dim.runCommand(`fill ${o.x - 30} ${o.y} ${o.z - 12} ${o.x + 30} ${o.y + 7} ${o.z + 30} air`);
  for (const leftover of dim.getEntities({ tags: [SHOWCASE_TAG], location: player.location, maxDistance: 64 })) leftover.remove(); // from an earlier run

  // 1. Your settlement, founded straight away (skips the usual placing rules)
  const bannerAt = at(0, 14);
  const old = state.keeps[player.id];
  const color = old?.color ?? freeColor(14);
  if (old) dim.runCommand(`setblock ${old.x} ${old.y} ${old.z} air`);
  setBlock(dim, bannerAt, KEEP_BANNER, { "siege:color": color });
  state.keeps[player.id] = { ...(old ?? { name: player.name, wins: 0, allies: [] }), x: bannerAt.x, y: bannerAt.y, z: bannerAt.z, color };
  saveState();
  label(dim, bannerAt, "Keep Banner\nClick: menu\nDye: recolor");

  // 2. One of every block in the packs, in a row, then the special looks
  const blocks = BlockTypes.getAll().map((b) => b.id).filter((id) => id.startsWith("siege:") && id !== KEEP_BANNER && id !== "siege:breaching_charge");
  const row = [...blocks.map((id) => [id, undefined, niceName(id)]), ...VARIANTS];
  const startX = -Math.min(28, row.length - 1);
  row.forEach(([id, states, text], i) => {
    const spot = at(startX + (i % 29) * 2, 4 + Math.floor(i / 29) * 3);
    const placed = setBlock(dim, spot, id, states);
    label(dim, spot, text);
    if (placed && tracked[id] && !tracked[id].some((t) => t.x === spot.x && t.y === spot.y && t.z === spot.z)) {
      tracked[id].push({ dim: dim.id, x: spot.x, y: spot.y, z: spot.z }); // Barracks and desk need to be known to work
    }
  });
  saveTracked();

  // 3. A piece of castle: wall, battlements, arrow slits and a working portcullis
  for (let dx = -6; dx <= 6; dx++) {
    for (let dy = 0; dy < 4; dy++) {
      const gate = Math.abs(dx) <= 1 && dy < 3;
      const slit = Math.abs(dx) === 4 && dy === 1;
      setBlock(dim, at(dx, 22, dy), gate ? "siege:portcullis" : slit ? "siege:arrow_slit" : "siege:castle_stone");
    }
    if (dx % 2 === 0) setBlock(dim, at(dx, 22, 4), "siege:battlement");
  }
  label(dim, at(3, 22), "Castle wall\nClick the gate\nRam or blast it");
  // ...and a stretch with a Castle Gate: one 3x3 leaf that swings open like a door
  for (let dx = 7; dx <= 13; dx++) {
    for (let dy = 0; dy < 4; dy++) {
      const gate = dx >= 9 && dx <= 11 && dy < 3;
      setBlock(dim, at(dx, 22, dy), gate ? "siege:castle_gate" : "siege:castle_stone", gate ? { "minecraft:cardinal_direction": "north" } : undefined);
    }
  }
  label(dim, at(14, 21), "Castle Gate\nSwings like a door");

  // 4. Machines (yours, so they can be packed up with sneak + click)
  for (const [typeId, dx, dz, text] of [
    [BALLISTA, -10, 16, "Ballista\nShoots monsters"],
    [TREBUCHET, 12, 16, "Trebuchet\nClick with cobble"],
    [RAM_ENGINE, 8, 27, "Battering Ram\nClick to ride"],
  ]) {
    const machine = spawn(dim, typeId, at(dx, dz));
    machine?.setDynamicProperty("siege:owner", player.id);
    label(dim, at(dx, dz - 2), text);
  }

  // 5. Guards: five Archers in each armor, a Man-at-Arms, and two villagers ready to recruit
  GUARD_ARMOR.forEach((armor, tier) => {
    const spot = at(-4 + tier * 2, 17);
    const archer = spawn(dim, "siege:archer", spot);
    if (!archer) return;
    enlist(archer, player.id, { x: spot.x + 0.5, y: spot.y, z: spot.z + 0.5 });
    equipGuard(archer, tier);
    archer.nameTag = armor.name;
  });
  const barracks = tracked[BARRACKS].find((t) => Math.abs(t.x - o.x) < 40 && Math.abs(t.z - o.z) < 40);
  if (barracks) {
    const soldier = spawn(dim, "siege:man_at_arms", { x: barracks.x, y: barracks.y + 1, z: barracks.z });
    if (soldier) enlist(soldier, player.id, barracks);
    spawn(dim, "minecraft:villager_v2", { x: barracks.x, y: barracks.y, z: barracks.z + 1 });
    spawn(dim, "minecraft:villager_v2", { x: barracks.x + 1, y: barracks.y, z: barracks.z + 1 });
  }
  const desk = tracked[DESK].find((t) => Math.abs(t.x - o.x) < 40 && Math.abs(t.z - o.z) < 40);
  if (desk) {
    const qm = spawn(dim, QUARTERMASTER, { x: desk.x, y: desk.y, z: desk.z + 1 });
    qm?.setDynamicProperty("siege:desk", JSON.stringify({ x: desk.x, y: desk.y, z: desk.z }));
  }

  // 6. Chests behind you: one of every item, plus supplies for upgrades and trading
  const items = ItemTypes.getAll().map((i) => i.id).filter((id) => id.startsWith("siege:") && !blocks.includes(id) && !id.includes("guardgear_"));
  const stacks = [];
  for (const id of [...items, ...blocks, KEEP_BANNER, "siege:breaching_charge"]) {
    try {
      stacks.push(new ItemStack(id, 1));
    } catch {
      // not something that can be held
    }
  }
  const chests = fillChests(dim, at(-4, -3), stacks);
  label(dim, at(-4, -3), "Every item");
  fillChests(dim, at(-4 + chests * 2 + 2, -3), SUPPLIES.map(([id, n]) => new ItemStack(id, n)));
  label(dim, at(-4 + chests * 2 + 2, -3), "Supplies");

  // 7. Anything other features want to show
  let extra = 0;
  emit("showcase", {
    player, dim, origin: o,
    nextSpot: () => at(-28 + (extra++ % 20) * 3, -8 - Math.floor((extra - 1) / 20) * 4),
    label: (spot, text) => label(dim, spot, text),
  });

  player.sendMessage(`§6Showcase built: ${row.length} blocks, 3 machines, 6 guards, ${stacks.length} items in the chests behind you.`);
  player.sendMessage("§7Everything is south of you. Type §f/scriptevent siege:showcase siege§7 to start a siege on it.");
}

function demoSiege(player) {
  const state = getState();
  if (!state.keeps[player.id]) return player.sendMessage("§7Build the showcase first: /scriptevent siege:showcase");
  if (state.active) return player.sendMessage("§7A siege is already underway.");
  world.setTimeOfDay(13000);
  startSiege(player.id);
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:showcase") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  try {
    if (event.message.trim() === "siege") demoSiege(player);
    else buildShowcase(player);
  } catch (e) {
    player.sendMessage(`§c[Hollow Crown] The showcase hit a problem: ${e}`);
    console.warn(`[Hollow Crown] showcase: ${e}${e?.stack ? "\n" + e.stack : ""}`);
  }
});

addTests("showcase", {
  "variant blocks are real Siege Nights blocks": () => {
    for (const [id, states, text] of VARIANTS) assert(id.startsWith("siege:") && Object.keys(states).length && text, id);
  },
  "names read nicely": () => assert(niceName("siege:castle_stone") === "Castle Stone"),
});
addTests("showcase", {
  "variant blocks exist": () => {
    const missing = VARIANTS.map((v) => v[0]).filter((id) => !BlockTypes.get(id));
    assert(!missing.length, `missing ${missing.join(", ")}`);
  },
}, { gameOnly: true });
