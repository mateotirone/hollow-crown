// Sister Wren in Millbrook. Every plot's first book ends by sending the reader to her, and asking her which
// clock stopped first is what starts the First Slip, so she has to be there from the first day.
//
// She keeps Millbrook's chapel, the stone chapel on the south side of the square (baked with the town: project files
// siege-nights/towngen/millbrook, towns thread 2026-11-12). She stands at the altar end, WREN_ALTAR. Until the
// chapel is there (a world whose Millbrook isn't stamped yet) she waits on the square in front of its door.
// Builders can move her with
//   /scriptevent siege:wren          (Creative) Wren now stands where you are
// She is put back if she goes missing whenever someone comes near. Worlds that built her old porch (before the
// chapel) keep the porch, but she moves into the chapel.
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
// wren: where she keeps to. chapel: true once that is the chapel (or a spot a builder chose), not the old porch
const store = moduleStore("siege:opening_millbrook", () => ({ wren: null, chapel: false }));

// The chapel, in world blocks: its walls (the eaves reach a block further out) and the air cell inside its door.
// Its front wall faces the square at z -460; Wren stands at the altar end.
export const CHAPEL = { x0: -62, x1: -52, z0: -460, z1: -442, door: { x: -57, y: 81, z: -459 } };
export const WREN_ALTAR = { x: -57, y: 81, z: -445 };
const IN_FRONT = { x: CHAPEL.door.x, z: CHAPEL.door.z - 3 }; // on the square, clear of the steps and eaves

function wrenNear(dim, at) {
  try {
    return dim.getEntities({ type: NPC_TYPE, tags: [WREN_TAG], location: at, maxDistance: 32 });
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

// The chapel stands if the altar end has a floor and room to stand. undefined when it isn't loaded.
function chapelStands(dim) {
  try {
    const floor = dim.getBlock({ x: WREN_ALTAR.x, y: WREN_ALTAR.y - 1, z: WREN_ALTAR.z });
    const here = dim.getBlock(WREN_ALTAR), above = dim.getBlock({ x: WREN_ALTAR.x, y: WREN_ALTAR.y + 1, z: WREN_ALTAR.z });
    if (!floor || !here || !above) return undefined;
    return !floor.isAir && !floor.isLiquid && here.isAir && above.isAir;
  } catch {
    return undefined;
  }
}

const altarSpot = () => ({ x: WREN_ALTAR.x + 0.5, y: WREN_ALTAR.y, z: WREN_ALTAR.z + 0.5 });

/** Stand Wren in the chapel, or in front of its door on the square (floor = the square's floor height). */
export function buildMillbrook(dim, floor, finish) {
  const stands = chapelStands(dim);
  if (stands === undefined) return; // not loaded yet: the task tries again
  const at = stands ? altarSpot() : { x: IN_FRONT.x + 0.5, y: floor.y + 1, z: IN_FRONT.z + 0.5 };
  store.data.wren = at;
  store.data.chapel = stands;
  store.save();
  placeWren(dim, at);
  finish?.();
}

// Wren goes back to her place if she is missing or has been moved, whenever a player is near enough to load it.
// Waiting on the square (or on the old porch) she moves into the chapel as soon as it is there.
onTick("opening_wren", 200, () => {
  const at = store.data.wren;
  if (!at) return;
  const near = world.getPlayers().some((p) => p.dimension.id === OVERWORLD && Math.hypot(p.location.x - at.x, p.location.z - at.z) < 64);
  if (!near) return;
  const dim = world.getDimension(OVERWORLD);
  if (!store.data.chapel && chapelStands(dim)) {
    store.data.wren = altarSpot();
    store.data.chapel = true;
    store.save();
  }
  const to = store.data.wren;
  const there = wrenNear(dim, to);
  if (!there) return;
  if (there.length !== 1 || Math.hypot(there[0].location.x - to.x, there[0].location.z - to.z) > 2) placeWren(dim, to);
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
  store.data.chapel = true; // a builder's choice: she stays there
  store.save();
  placeWren(player.dimension, at);
  player.sendMessage(`§6Sister Wren now keeps to ${Math.floor(at.x)}, ${at.y}, ${Math.floor(at.z)}.`);
});

addTests("opening", {
  "Wren's chapel: inside Millbrook, an odd size, and her altar spot and its door are inside it": () => {
    assertEqual((CHAPEL.x1 - CHAPEL.x0 + 1) % 2, 1);
    assertEqual((CHAPEL.z1 - CHAPEL.z0 + 1) % 2, 1);
    for (const x of [CHAPEL.x0, CHAPEL.x1]) for (const z of [CHAPEL.z0, CHAPEL.z1]) assert(Math.hypot(x - ward.x, z - ward.z) < ward.r, "the chapel stays inside Millbrook");
    const inside = (p) => p.x > CHAPEL.x0 && p.x < CHAPEL.x1 && p.z > CHAPEL.z0 && p.z < CHAPEL.z1;
    assert(inside(WREN_ALTAR) && inside(CHAPEL.door), "Wren and the door are inside the chapel");
    assert(!inside(IN_FRONT), "while she waits she waits outside");
  },
  "the carter points to Wren and gives nothing away": () => {
    assert(/Millbrook/.test(CARTER_LINE) && /Sister Wren/.test(CARTER_LINE));
    for (const secret of ["Hollow", "Morvane", "Oswin", "truce", "Choir"]) assert(!CARTER_LINE.includes(secret), secret);
  },
});
