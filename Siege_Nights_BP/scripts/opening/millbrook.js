// Sister Wren in Millbrook. Every plot's first book ends by sending the reader to her, and asking her which
// clock stopped first is what starts the First Slip, so she has to be there from the first day.
//
// Millbrook's own buildings are not on the map yet (the town layouts come later), so for now Wren keeps a small
// porch on the north side of the square: a back wall, two posts, a slab roof, a hanging lantern, a cauldron of soup,
// a barrel and a sign. 5 wide, 3 deep (odd sizes). When the real chapel is placed, move her with
//   /scriptevent siege:wren          (Creative) Wren now stands where you are; the porch stays
// She is put back if she goes missing whenever someone comes near.
//
// Players who start in Kingsrest with no plot never get a plot's first book, so a carter on the square points
// them to Wren instead (startedHomeless, from plots/welcome.js).

import { world, system } from "@minecraft/server";
import { on, addTests, assert, assertEqual } from "../siege/api.js";
import { onTick } from "../core/loop.js";
import { moduleStore } from "../core/store.js";
import { WARDS, OVERWORLD } from "../plots/config.js";
import { isBuilder } from "../plots/claims.js";
import { spawnNpc, NPC_TYPE } from "../lore/npcs.js";
import { learnLeads, progressOf } from "../lore/player.js";

const ward = WARDS.find((w) => w.name === "Millbrook");
export const MILLBROOK = { x: ward.x, z: ward.z };
const WREN_TAG = "siege_lore_npc_wren";
const store = moduleStore("siege:opening_millbrook", () => ({ wren: null }));

// The porch, as offsets from the middle of the square (y 0 = the floor). North is -z; Wren faces south, onto the square.
export function porchBlocks() {
  const out = [];
  const set = (dx, dy, dz, block, states) => out.push({ dx, dy, dz, block, states });
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -5; dz <= -3; dz++) {
      set(dx, 0, dz, "minecraft:spruce_planks"); // porch floor
      for (let dy = 1; dy <= 3; dy++) set(dx, dy, dz, "minecraft:air");
      set(dx, 4, dz, "minecraft:spruce_slab"); // roof
    }
    for (let dy = 1; dy <= 3; dy++) set(dx, dy, -6, (dx + dy) % 3 === 0 ? "minecraft:mossy_stone_bricks" : "minecraft:stone_bricks"); // back wall
    set(dx, 4, -6, "minecraft:stone_brick_wall");
  }
  for (const dx of [-2, 2]) for (let dy = 1; dy <= 3; dy++) set(dx, dy, -3, "minecraft:spruce_fence"); // posts
  set(0, 3, -4, "minecraft:lantern", { hanging: true });
  set(1, 1, -5, "minecraft:cauldron");
  set(-1, 1, -5, "minecraft:barrel");
  return out;
}
export const WREN_SPOT = { dx: 0, dz: -4 }; // under the lantern
const SIGN = { dx: -3, dz: -3, text: "Millbrook\nChapel porch\n§7Sister Wren,\nhealer" };

function placeBlock(dim, at, block, states) {
  try {
    const b = dim.getBlock(at);
    if (!b) return;
    b.setType(block);
    if (states) {
      let perm = b.permutation;
      for (const [k, v] of Object.entries(states)) perm = perm.withState(k, v);
      b.setPermutation(perm);
    }
  } catch {
    // one block missing never stops the porch
  }
}

function wrenNear(dim, at) {
  try {
    return dim.getEntities({ type: NPC_TYPE, tags: [WREN_TAG], location: at, maxDistance: 24 });
  } catch {
    return undefined; // not loaded
  }
}

function placeWren(dim, at) {
  const there = wrenNear(dim, at);
  if (!there) return false;
  for (const extra of there.slice(1)) extra.remove();
  if (there.length) {
    there[0].teleport(at);
    return true;
  }
  spawnNpc(dim, at, "wren");
  return true;
}

/** Build the porch round the Millbrook square's middle (floor = the square's floor block) and stand Wren in it. */
export function buildMillbrook(dim, floor, finish) {
  for (const b of porchBlocks()) placeBlock(dim, { x: floor.x + b.dx, y: floor.y + b.dy, z: floor.z + b.dz }, b.block, b.states);
  try {
    const sign = dim.getBlock({ x: floor.x + SIGN.dx, y: floor.y + 1, z: floor.z + SIGN.dz });
    sign?.setType("minecraft:standing_sign");
    sign?.getComponent("minecraft:sign")?.setText(SIGN.text);
  } catch {}
  const at = { x: floor.x + WREN_SPOT.dx + 0.5, y: floor.y + 1, z: floor.z + WREN_SPOT.dz + 0.5 };
  store.data.wren = at;
  store.save();
  placeWren(dim, at);
  finish?.();
}

// Wren goes back to her porch if she is missing or has been moved, whenever a player is near enough to load it
onTick("opening_wren", 200, () => {
  const at = store.data.wren;
  if (!at) return;
  const near = world.getPlayers().some((p) => p.dimension.id === OVERWORLD && Math.hypot(p.location.x - at.x, p.location.z - at.z) < 64);
  if (!near) return;
  const dim = world.getDimension(OVERWORLD);
  const there = wrenNear(dim, at);
  if (!there) return;
  if (there.length !== 1 || Math.hypot(there[0].location.x - at.x, there[0].location.z - at.z) > 2) placeWren(dim, at);
});

// ---------- Players who start without a plot still get a reason to find her ----------

export const CARTER_LINE = "§7A carter on the square watches you turning in circles.§r \"New, are you? Then you'll be asking "
  + "the wrong people why the nights go the way they do. Take the north road up to Millbrook and ask for Sister Wren. "
  + "She keeps count of things.\"";

on("startedHomeless", ({ player }) => {
  system.runTimeout(() => {
    try {
      if (!player?.isValid || progressOf(player).flags.includes("wren_met")) return;
      player.sendMessage(CARTER_LINE);
      learnLeads(player, ["millbrook"]);
    } catch (e) {
      console.warn(`[Hollow Crown] opening: carter: ${e}`);
    }
  }, 600); // half a minute after arriving, once they have looked round
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:wren") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isBuilder(player)) return;
  const at = { x: Math.floor(player.location.x) + 0.5, y: Math.floor(player.location.y), z: Math.floor(player.location.z) + 0.5 };
  store.data.wren = at;
  store.save();
  placeWren(player.dimension, at);
  player.sendMessage(`§6Sister Wren now keeps to ${Math.floor(at.x)}, ${at.y}, ${Math.floor(at.z)}.`);
});

addTests("opening", {
  "Wren's porch: odd sizes, inside the Millbrook ward, and she stands under its roof": () => {
    const blocks = porchBlocks();
    const xs = blocks.map((b) => b.dx), zs = blocks.filter((b) => b.dy === 0).map((b) => b.dz);
    assertEqual((Math.max(...xs) - Math.min(...xs) + 1) % 2, 1);
    assertEqual((Math.max(...zs) - Math.min(...zs) + 1) % 2, 1);
    for (const b of blocks) assert(Math.hypot(b.dx, b.dz) < ward.r, "the porch stays inside Millbrook");
    const air = blocks.filter((b) => b.dx === WREN_SPOT.dx && b.dz === WREN_SPOT.dz);
    assert(air.some((b) => b.dy === 1 && b.block === "minecraft:air") && air.some((b) => b.dy === 4 && /slab/.test(b.block)), "Wren has room and a roof");
    assert(!blocks.some((b) => /bell/.test(b.block)), "Millbrook rings no bells");
  },
  "the carter points to Wren and gives nothing away": () => {
    assert(/Millbrook/.test(CARTER_LINE) && /Sister Wren/.test(CARTER_LINE));
    for (const secret of ["Hollow", "Morvane", "Oswin", "truce", "Choir"]) assert(!CARTER_LINE.includes(secret), secret);
  },
});
