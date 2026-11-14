// Map setup: the first time a fresh Hollow Crown map loads, it gets itself ready for the story opening, so
// nobody has to type a builder command before the first player can arrive, choose a plot and find Sister Wren.
//
// How it knows it is the Hollow Crown map: map/genworld.py leaves a gold block in the middle of the Kingsrest
// square (the world spawn), and one on each of the twelve plot markers and each town square. Town builds cover
// the town ones, so it looks at the first plot's. A world without that gold block (a flat test world) is left alone.
//
// What it does, a few places at a time, each kept loaded with a ticking area only while it is worked on:
//   detect       find the first plot's gold block (Harrowford); time starts moving (the file is saved with it off)
//   kingsrest    the Kingsrest square (its gold block, or the ground there) becomes the "start without a home" spot
//   hall         build the welcome hall in the sky over Gull Bay (spread over ticks)
//   plot:<name>  a Plot Stone on each plot's gold block (or on the ground at the planned spot)
//   millbrook    Sister Wren at the altar of Millbrook's chapel, or in front of it until it stands (millbrook.js)
// Anything a builder already did by hand (hall built, Plot Stones placed) is kept and skipped.
//
// Commands (status works in any mode; setup needs Creative):
//   /scriptevent siege:opening status   what is done and what is left
//   /scriptevent siege:opening setup    run the setup here even without the gold block (a hand-built copy of the map)

import { world, system } from "@minecraft/server";
import { addJoinStep, addTests, assert, assertEqual, emit } from "../siege/api.js";
import { onTick } from "../core/loop.js";
import { moduleStore } from "../core/store.js";
import { PLOT_PLAN, WARDS, WELCOME, PLOT_STONE, OVERWORLD } from "../plots/config.js";
import { allPlots, registerPlot, isBuilder } from "../plots/claims.js";
import { hallBuilt, hallRaising, raiseHall, setKingsrestArrival } from "../plots/welcome.js";
import { buildMillbrook, MILLBROOK } from "./millbrook.js";

// state: "unchecked" (not looked yet) | "map" (the Hollow Crown map: set it up) | "plain" (some other world)
const store = moduleStore("siege:opening", () => ({ state: "unchecked", done: [], misses: 0 }), {
  version: 2,
  // Version 1 looked for the Kingsrest gold block, which the town builds now cover, so it wrongly decided the real
  // map was some other world. Look again, the new way.
  upgrade(data, from) {
    if (from < 2 && data.state === "plain") {
      data.state = "unchecked";
      data.misses = 0;
      data.done = (data.done ?? []).filter((id) => id !== "detect");
    }
    return data;
  },
});
export const setupState = () => store.data.state;

const MARKER = "minecraft:gold_block";
const KINGSREST = WELCOME.kingsrest;
const AT_ONCE = 6; // places worked on together (a world may have 10 ticking areas; the Hollow keeps two)
const LOAD_TRIES = 30; // checks, 10 ticks apart, before a place is given up on for now
const SOFT = /(air|water|grass|fern|flower|snow_layer|leaves|vine|bush|sapling|tallgrass|dandelion|poppy|mushroom|_log$|deadbush)/;

// ---------- The work ----------

function topOf(dim, x, z) {
  try {
    return dim.getTopmostBlock({ x, z });
  } catch {
    return undefined;
  }
}

// The first solid ground at x, z, skipping plants, snow and trees
function groundY(dim, x, z) {
  let block = topOf(dim, x, z);
  for (let i = 0; block && i < 40 && SOFT.test(block.typeId); i++) block = block.below();
  return block ? block.location.y : undefined;
}

// The gold marker in the middle of a square: take it away and say where the floor is (y of the floor block)
// (genworld snows over the Frostmarch, gold blocks included, so look under snow and plants)
function takeMarker(dim, x, z) {
  let top = topOf(dim, x, z);
  const cover = [];
  for (let i = 0; top && i < 6 && top.typeId !== MARKER && (SOFT.test(top.typeId) || /snow/.test(top.typeId)); i++) {
    cover.push(top);
    top = top.below();
  }
  if (top?.typeId !== MARKER) return undefined;
  for (const block of cover) block.setType("minecraft:air");
  top.setType("minecraft:air");
  return top.location.y - 1;
}

function hasMarker(dim, x, z) {
  let top = topOf(dim, x, z);
  for (let i = 0; top && i < 6 && top.typeId !== MARKER && (SOFT.test(top.typeId) || /snow/.test(top.typeId)); i++) top = top.below();
  return top?.typeId === MARKER;
}

export const TASKS = [
  {
    // The first plot's marker: plots are left untouched until this setup (town builds may cover the Kingsrest one)
    id: "detect", x: PLOT_PLAN[0].x, z: PLOT_PLAN[0].z, radius: 0,
    run(dim, finish) {
      if (!hasMarker(dim, PLOT_PLAN[0].x, PLOT_PLAN[0].z)) {
        // Looked at, and it isn't the Hollow Crown map (or a builder already set this world up by hand)
        if (store.data.state === "unchecked") store.data.state = "plain";
      } else {
        store.data.state = "map";
        // The map is saved with time stopped (handy for walking it in Creative); the story needs its nights
        command(dim, "gamerule dodaylightcycle true");
      }
      finish();
    },
  },
  {
    id: "hall", x: WELCOME.hall.x, z: WELCOME.hall.z, radius: 2,
    run(dim, finish) {
      if (hallBuilt()) return finish();
      raiseHall({ ...WELCOME.hall }, finish);
    },
  },
  {
    id: "kingsrest", x: KINGSREST.x, z: KINGSREST.z, radius: 0,
    run(dim, finish) {
      let floor = takeMarker(dim, KINGSREST.x, KINGSREST.z);
      if (floor === undefined) floor = groundY(dim, KINGSREST.x, KINGSREST.z);
      if (floor === undefined) return;
      setKingsrestArrival({ x: KINGSREST.x, y: floor + 1, z: KINGSREST.z });
      finish();
    },
  },
  ...PLOT_PLAN.map((plan) => ({
    id: `plot:${plan.name}`, x: plan.x, z: plan.z, radius: 1,
    run(dim, finish) {
      if (allPlots().some((p) => p.name === plan.name)) return finish(); // placed by hand already
      let floor = takeMarker(dim, plan.x, plan.z);
      if (floor === undefined) floor = groundY(dim, plan.x, plan.z);
      if (floor === undefined) return; // nothing to stand it on yet: try again later
      const at = { x: plan.x, y: floor + 1, z: plan.z };
      dim.getBlock(at)?.setType(PLOT_STONE);
      registerPlot(plan.name, at);
      finish();
    },
  })),
  {
    id: "millbrook", x: MILLBROOK.x, z: MILLBROOK.z, radius: 1,
    run(dim, finish) {
      let floor = takeMarker(dim, MILLBROOK.x, MILLBROOK.z);
      if (floor === undefined) floor = groundY(dim, MILLBROOK.x, MILLBROOK.z);
      if (floor === undefined) return;
      buildMillbrook(dim, { x: MILLBROOK.x, y: floor, z: MILLBROOK.z }, finish);
    },
  },
];

const left = () => TASKS.filter((t) => !store.data.done.includes(t.id));
// Ready for a newcomer: the hall stands and the plots are on the map (Millbrook can finish while they read)
// Ready for a newcomer once the hall stands: the rim stones light up one by one as their Plot Stones go down, while
// the newcomer is still reading the Waystone
export const openingReady = () => store.data.state === "plain" || (store.data.state === "map" && store.data.done.includes("hall"));

// ---------- Working through it, a few places at a time ----------

const active = new Map(); // task id -> { area, tries, running }
const areaNames = ["hc_open_0", "hc_open_1", "hc_open_2", "hc_open_3", "hc_open_4", "hc_open_5"];
const overworld = () => world.getDimension(OVERWORLD);

function command(dim, text) {
  try {
    dim.runCommand(text);
  } catch {
    // a ticking area that is already gone, or one too many: the place is tried again later
  }
}

function release(id) {
  const job = active.get(id);
  if (!job) return;
  command(overworld(), `tickingarea remove ${job.area}`);
  active.delete(id);
}

function finished(id) {
  if (!store.data.done.includes(id)) store.data.done.push(id);
  store.save();
  release(id);
  if (store.data.state === "plain") for (const other of [...active.keys()]) release(other); // not the map: let the hall's chunks go
  if (!left().length && store.data.state === "map") {
    console.warn("[Hollow Crown] opening: the map is set up for the story opening");
    emit("openingSetUp", {});
  }
}

function loaded(dim, task) {
  try {
    return !!dim.getBlock({ x: task.x, y: 0, z: task.z });
  } catch {
    return false;
  }
}

function step() {
  if (store.data.state === "plain") return;
  const dim = overworld();
  // Until we know which world this is, only the check runs, but the hall's chunks start loading alongside it so
  // the hall can go up the moment the answer is yes
  const queue = store.data.state === "map" ? left() : left().filter((t) => t.id === "detect" || t.id === "hall");
  for (const task of queue) {
    if (active.size >= AT_ONCE) break;
    if (active.has(task.id)) continue;
    const area = areaNames.find((n) => ![...active.values()].some((j) => j.area === n));
    command(dim, `tickingarea remove ${area}`);
    command(dim, `tickingarea add circle ${task.x} 0 ${task.z} ${task.radius} ${area} true`);
    active.set(task.id, { area, tries: 0, idle: 0, running: false });
  }
  for (const [id, job] of [...active]) {
    // A hall raise that stopped (its chunks never loaded, a block it could not set) is let go and tried again,
    // instead of holding every newcomer at Kingsrest for good
    if (id === "hall" && job.running && !hallRaising() && !store.data.done.includes("hall") && ++job.idle > 20) {
      console.warn("[Hollow Crown] opening: the welcome hall stopped going up; trying again");
      release(id);
      continue;
    }
    if (job.running || (store.data.state !== "map" && id !== "detect")) continue;
    const task = TASKS.find((t) => t.id === id);
    if (!loaded(dim, task)) {
      if (++job.tries <= LOAD_TRIES) continue;
      release(id); // give it a rest; it comes round again
      if (id === "detect" && ++store.data.misses >= 5 && store.data.state === "unchecked") {
        store.data.state = "plain"; // Kingsrest never loaded: leave this world alone (a builder can still run setup)
        store.save();
      }
      continue;
    }
    job.running = true;
    try {
      task.run(dim, () => finished(id));
    } catch (e) {
      console.warn(`[Hollow Crown] opening: ${id}: ${e}`);
    }
    // A step that could not finish (nothing to stand on yet) lets go and is tried again later
    if (active.get(id) === job && !store.data.done.includes(id) && id !== "hall" && id !== "millbrook") release(id);
  }
}

onTick("opening_setup", 10, () => {
  if (store.data.state !== "plain" && left().length) step();
});

// ---------- A newcomer waits at Kingsrest until the hall is ready (step 15, between the look picker and the hall) ----------

addJoinStep(15, "map setup", async (player, { wait }) => {
  for (let i = 0; i < 85 && !openingReady(); i++) {
    if (!player.isValid) return;
    if (store.data.state === "unchecked" && i > 30) return; // something is wrong: let the welcome step cope
    if (i === 0) player.onScreenDisplay.setTitle("§6Aldmere", { subtitle: "§7The road is long. One moment...", fadeInDuration: 10, stayDuration: 200, fadeOutDuration: 20 });
    if (i % 2 === 0) player.onScreenDisplay.setActionBar("§7The road is long. One moment...");
    await wait(20);
  }
}, { when: "first", timeout: 90 });

// ---------- Builder commands ----------

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:opening") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  const verb = event.message.trim();
  if (verb === "setup") {
    if (!isBuilder(player)) return player.sendMessage("§cOnly a player in Creative can force the map setup. /scriptevent siege:opening status works in any mode.");
    store.data.state = "map";
    if (!store.data.done.includes("detect")) store.data.done.push("detect");
    store.save();
    player.sendMessage(`§6Setting the map up for the story opening: ${left().length} places to do. /scriptevent siege:opening status to watch.`);
  } else {
    const todo = left().map((t) => t.id);
    player.sendMessage(`§6Map setup: §f${store.data.state}§6. Done ${store.data.done.length} of ${TASKS.length}.${todo.length ? ` Left: §7${todo.join(", ")}` : ""}`);
  }
});

addTests("opening", {
  "setup covers the Kingsrest check, the hall, every plot and Millbrook, once each": () => {
    assertEqual(TASKS.length, PLOT_PLAN.length + 4);
    assertEqual(new Set(TASKS.map((t) => t.id)).size, TASKS.length);
    assertEqual(TASKS[0].id, "detect");
    for (const t of TASKS) assert(t.radius >= 0 && t.radius <= 4, `${t.id}: a ticking area holds 0 to 4 chunks`);
  },
  "the Kingsrest check looks where genworld puts the square, and Millbrook is its town": () => {
    assert(Math.hypot(KINGSREST.x - WARDS[0].x, KINGSREST.z - WARDS[0].z) < WARDS[0].r, "the arrival square is inside Kingsrest");
    const mill = WARDS.find((w) => w.name === "Millbrook");
    assertEqual([MILLBROOK.x, MILLBROOK.z], [mill.x, mill.z]);
  },
  "never more ticking areas at once than it has names for": () => {
    assertEqual(areaNames.length, AT_ONCE);
    assert(AT_ONCE <= 6, "leave room for the Hollow's own ticking areas");
  },
});
