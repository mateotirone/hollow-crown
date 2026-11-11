// Trains (The Hollow Crown): custom 3D Track and big trains that run on it.
//
// Track pieces join up by themselves as you lay them, like vanilla rails, but run diagonally too.
// A train is an Engine plus Coaches. The game moves it along the track itself (vanilla minecart
// physics only work on vanilla rails): the driver holds forward to pull away and back to brake;
// trains slow for tight corners and feel slopes. Track maths: track.js. Numbers and train maths: data.js.
// Pack files: studio/build_trains.py. Test: /scriptevent siege:showcase (a loop with a train on it),
// /scriptevent siege:trains (report), /scriptevent siege:trains mode velocity|teleport.

import { world, system, GameMode } from "@minecraft/server";
import { onTick, isReady, moduleStore, settlementAt, keepOf, on, COLORS } from "../siege/api.js";
import { styleOf } from "../settle/plans.js";
import { shapeOf, layTrack, cursorOn, advance, back, pointAt } from "./track.js";
import { TRACK, TRAIN, CARS, TRAIN_STYLES, NO_COLOR, carPoses, trainLength, stepSpeed, moveTrain, limitAhead, shapesForLoop, showcaseLoop } from "./data.js";
import { give } from "../horses/menus.js";
import { sfx } from "../core/sfx.js";
import "./tests.js";

// trains: [{ id, dim, head: cursor, v, style, cars: [{ kind, eid }] }]
const store = moduleStore("siege:trains", () => ({ trains: [], next: 1 }));
const trains = () => store.data.trains;
export const allTrains = () => trains();

const say = (player, text) => player.onScreenDisplay.setActionBar(text);
const isCreative = (player) => player.getGameMode() === GameMode.Creative;

// ---------- reading track from the world ----------

function shapeAtBlock(block) {
  if (!block || block.typeId !== TRACK) return undefined;
  return shapeOf(block.permutation.getState("siege:kind"), block.permutation.getState("siege:dir"));
}

// A fresh lookup for one tick: get(x, y, z) -> shape or undefined (unloaded ground counts as no track)
export function reader(dim) {
  const cache = new Map();
  return (x, y, z) => {
    const k = `${x},${y},${z}`;
    if (cache.has(k)) return cache.get(k);
    let shape;
    try {
      shape = shapeAtBlock(dim.getBlock({ x, y, z }));
    } catch {
      shape = undefined;
    }
    cache.set(k, shape);
    return shape;
  };
}

function setShape(dim, pos, shape) {
  const block = dim.getBlock(pos);
  if (!block || block.typeId !== TRACK) return;
  block.setPermutation(block.permutation.withState("siege:kind", shape.kind).withState("siege:dir", shape.dir));
}

// ---------- laying track ----------

world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
  if (block.typeId !== TRACK) return;
  const dim = block.dimension;
  const { shape, updates } = layTrack(block.location, player.getRotation().y, reader(dim));
  setShape(dim, block.location, shape);
  for (const u of updates) setShape(dim, u, u.shape);
});

// ---------- putting trains on the track ----------

// Whose train this is: the settlement whose land it is put on, else the player's own settlement
const ownerFor = (player, block) => {
  try {
    return settlementAt(block.location) ?? (keepOf(player.id) ? player.id : undefined);
  } catch {
    return undefined;
  }
};
const styleIndexFor = (owner, block) => {
  try {
    return Math.max(0, TRAIN_STYLES.indexOf(owner ? styleOf(owner, block) : "vale"));
  } catch {
    return 0;
  }
};
// The body is painted in the owner's Keep Banner colour (0-15); NO_COLOR = no settlement, the region's own paint
const colorOf = (owner) => {
  const c = owner ? keepOf(owner)?.color : undefined;
  return Number.isInteger(c) && c >= 0 && c < NO_COLOR ? c : NO_COLOR;
};

function paint(e, train) {
  try {
    e.setProperty("siege:style", train.style);
    e.setProperty("siege:color", train.color ?? NO_COLOR);
  } catch {
    // pack without the properties: plain look
  }
}

function spawnCar(dim, kind, pose, train) {
  const e = dim.spawnEntity(CARS[kind].entity, { x: pose.x, y: pose.y, z: pose.z });
  e.setRotation({ x: 0, y: pose.yaw });
  paint(e, train);
  const trainId = train.id;
  e.setDynamicProperty("siege:train", trainId);
  return e;
}

export function placeEngine(dim, pos, yaw, style, quietPlayer, owner) {
  const get = reader(dim);
  const shape = get(pos.x, pos.y, pos.z);
  if (!shape) return undefined;
  let head = cursorOn(pos, shape, yaw);
  const cars = [{ kind: "engine" }];
  for (let tries = 0; back(head, trainLength(cars), get).blocked; tries++) {
    const r = advance(head, 1, get);
    if (r.blocked || tries > 16) {
      if (quietPlayer) say(quietPlayer, `§cThe engine needs at least ${CARS.engine.length + 1} blocks of track.`);
      return undefined;
    }
    head = r.cursor;
  }
  const train = { id: store.data.next++, dim: dim.id, head, v: 0, style, owner, color: colorOf(owner), cars };
  const [pose] = carPoses(head, cars, get);
  cars[0].eid = spawnCar(dim, "engine", pose, train).id;
  trains().push(train);
  store.save();
  return train;
}

export function addCoach(train, dim) {
  if (train.cars.length >= TRAIN.maxCars) return "§cA train can pull at most " + (TRAIN.maxCars - 1) + " coaches.";
  const get = reader(dim);
  const cars = [...train.cars, { kind: "coach" }];
  if (back(train.head, trainLength(cars), get).blocked) return "§cThere isn't enough track behind the train for another coach.";
  const poses = carPoses(train.head, cars, get);
  cars[cars.length - 1].eid = spawnCar(dim, "coach", poses[poses.length - 1], train).id;
  train.cars = cars;
  store.save();
  return undefined;
}

// The train whose last car ends nearest this block (within 6 blocks)
function trainBehind(dim, loc) {
  const get = reader(dim);
  let best, bestD = 6;
  for (const t of trains()) {
    if (t.dim !== dim.id) continue;
    const tail = back(t.head, trainLength(t.cars), get).cursor;
    const p = pointAt(tail, get(tail.x, tail.y, tail.z));
    const d = Math.hypot(p.x - (loc.x + 0.5), p.z - (loc.z + 0.5));
    if (d < bestD) [best, bestD] = [t, d];
  }
  return best;
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player, itemStack } = event;
  if (block.typeId !== TRACK || !itemStack) return;
  const kind = itemStack.typeId === CARS.engine.item ? "engine" : itemStack.typeId === CARS.coach.item ? "coach" : undefined;
  if (!kind) return;
  event.cancel = true;
  if (event.isFirstEvent === false) return;
  system.run(() => {
    if (!isReady() || !block.isValid) return;
    const dim = block.dimension;
    if (kind === "engine") {
      const owner = ownerFor(player, block);
      const train = placeEngine(dim, block.location, player.getRotation().y, styleIndexFor(owner, block), player, owner);
      if (!train) return;
      const look = train.color === NO_COLOR ? `${TRAIN_STYLES[train.style]} style` : `${TRAIN_STYLES[train.style]} style, in ${COLORS[train.color].replace("_", " ")}`;
      say(player, `§6Engine on the line (${look}). Climb in and hold forward to go, back to brake.`);
    } else {
      const train = trainBehind(dim, block.location);
      if (!train) return say(player, "§7Place a coach on the track right behind an engine or its last coach.");
      const problem = addCoach(train, dim);
      if (problem) return say(player, problem);
      say(player, `§6Coach coupled. The train has ${train.cars.length} cars.`);
    }
    sfx(player, "random.anvil_land");
    if (!isCreative(player)) consumeOne(player, CARS[kind].item);
  });
});

function consumeOne(player, typeId) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return;
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (it?.typeId !== typeId) continue;
    if (it.amount > 1) {
      it.amount -= 1;
      inv.setItem(i, it);
    } else inv.setItem(i, undefined);
    return;
  }
}

// Sneak + click a car with an empty hand to put the whole train away (nobody may be aboard)
world.beforeEvents.playerInteractWithEntity?.subscribe((event) => {
  const { player, target, itemStack } = event;
  if (!target.typeId.startsWith("siege:train_") || !player.isSneaking || itemStack) return;
  event.cancel = true;
  system.run(() => {
    const train = trains().find((t) => t.id === target.getDynamicProperty("siege:train"));
    if (!train) return target.isValid && target.remove();
    const ents = train.cars.map((c) => world.getEntity(c.eid));
    if (ents.some((e) => (e?.getComponent("minecraft:rideable")?.getRiders() ?? []).length)) return say(player, "§7Someone is still aboard.");
    for (const e of ents) e?.remove();
    if (!isCreative(player)) for (const c of train.cars) give(player, CARS[c.kind].item);
    trains().splice(trains().indexOf(train), 1);
    store.save();
    say(player, "§6Train put away.");
  });
});

// ---------- running the trains ----------

function driverOf(engine) {
  const riders = engine?.getComponent("minecraft:rideable")?.getRiders() ?? [];
  return riders.find((r) => r.typeId === "minecraft:player");
}

function throttleOf(driver) {
  if (!driver) return 0;
  try {
    const move = driver.inputInfo?.getMovementVector?.();
    if (move) return move.y > 0.3 ? 1 : move.y < -0.3 ? -1 : 0;
  } catch {
    // no input reading on this version
  }
  return "auto";
}

let ticks = 0;
function runTick() {
  ticks++;
  let moved = false;
  for (const train of trains()) {
    let dim;
    try {
      dim = world.getDimension(train.dim);
    } catch {
      continue;
    }
    const ents = train.cars.map((c) => {
      const e = world.getEntity(c.eid);
      return e?.isValid ? e : undefined;
    });
    if (ents.some((e) => !e)) continue; // part of it isn't loaded: hold still
    const get = reader(dim);
    const driver = driverOf(ents[0]);
    let throttle = throttleOf(driver);
    if (throttle === "auto") throttle = train.v < TRAIN.autoSpeed ? 1 : 0;
    const here = get(train.head.x, train.head.y, train.head.z);
    const downhill = here?.kind === 3 ? (here.up === train.head.to ? -1 : 1) : 0; // in the train's forward direction
    const look = (train.v * train.v) / (2 * TRAIN.brake) + 2;
    const limit = train.v > 0 ? limitAhead(train.head, look, get) : Infinity;
    const before = train.v;
    // nobody driving: the brakes go on and it stays put
    train.v = driver ? stepSpeed(train.v, throttle, { downhill, limit }) : Math.sign(train.v) * Math.max(0, Math.abs(train.v) - TRAIN.brake);
    if (train.v === 0 && before === 0) continue;
    const r = moveTrain(train.head, train.cars, train.v, get);
    if (r.v === 0 && Math.abs(before) > 0.3 && driver) {
      sfx(driver, "random.anvil_land");
      say(driver, "§7End of the line.");
    }
    train.head = r.head;
    train.v = r.v;
    moved = true;
    placeCars(ents, carPoses(train.head, train.cars, get));
    if (driver && ticks % 10 === 0) say(driver, `§6${Math.round(Math.abs(train.v) * 20)} blocks/s${train.v < 0 ? " §7(reversing)" : ""}`);
  }
  if (moved && ticks % TRAIN.saveEvery === 0) store.save();
}

function placeCars(ents, poses) {
  ents.forEach((e, i) => {
    const p = poses[i];
    try {
      const at = e.location;
      const dx = p.x - at.x, dy = p.y - at.y, dz = p.z - at.z;
      if (TRAIN.drive === "teleport" || Math.hypot(dx, dy, dz) > TRAIN.snapDistance) {
        e.teleport({ x: p.x, y: p.y, z: p.z }, { rotation: { x: 0, y: p.yaw } });
      } else {
        e.clearVelocity();
        e.applyImpulse({ x: dx, y: dy, z: dz });
        e.setRotation({ x: 0, y: p.yaw });
      }
    } catch {
      // entity went away mid-tick
    }
  });
}

onTick("trains", 1, () => {
  if (isReady() && trains().length) runTick();
});
onTick("trains_save", 200, () => {
  if (isReady() && trains().some((t) => t.v !== 0)) store.save();
});

// ---------- tools ----------

system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
  if (id !== "siege:trains") return;
  const [cmd, arg] = message.trim().split(/\s+/);
  if (cmd === "station" || cmd === "routes" || cmd === "lay") return; // trains/station_sites.js, trains/route_game.js
  const reply = (text) => (sourceEntity?.typeId === "minecraft:player" ? sourceEntity.sendMessage(text) : console.warn(text));
  if (cmd === "mode" && (arg === "velocity" || arg === "teleport")) {
    TRAIN.drive = arg;
    return reply(`§6Trains now move by ${arg}.`);
  }
  reply(`§6Trains: ${trains().length}, moving by ${TRAIN.drive}.`);
  for (const t of trains()) reply(`§7#${t.id} ${t.cars.map((c) => c.kind).join(" + ")} at ${t.head.x} ${t.head.y} ${t.head.z}, ${Math.round(t.v * 20)} blocks/s, ${TRAIN_STYLES[t.style]}`);
});

// ---------- a re-dyed Keep Banner repaints that settlement's trains ----------

function repaintTick() {
  for (const t of trains()) {
    if (!t.owner) continue;
    const c = colorOf(t.owner);
    if (c === t.color) continue;
    const ents = t.cars.map((car) => world.getEntity(car.eid));
    if (ents.some((e) => !e?.isValid)) continue; // not all loaded: try again later
    t.color = c;
    for (const e of ents) paint(e, t);
    store.save();
  }
}
onTick("trains_repaint", 100, repaintTick);

// ---------- the test world (/scriptevent siege:showcase): a loop of track with an engine and a coach ----------

on("showcase", ({ player, dim, origin, label }) => {
  try {
    const o = { x: origin.x - 70, y: origin.y, z: origin.z - 6 };
    const pts = showcaseLoop().map((p) => ({ x: o.x + p.x, y: o.y, z: o.z + p.z }));
    for (let x = o.x - 3; x <= o.x + 24; x++) {
      for (let z = o.z - 3; z <= o.z + 14; z++) {
        dim.getBlock({ x, y: o.y - 1, z })?.setType("minecraft:grass_block");
        for (let y = o.y; y <= o.y + 4; y++) dim.getBlock({ x, y, z })?.setType("minecraft:air");
      }
    }
    const shapes = shapesForLoop(pts);
    pts.forEach((p, i) => {
      const block = dim.getBlock(p);
      if (!block) return;
      block.setType(TRACK);
      block.setPermutation(block.permutation.withState("siege:kind", shapes[i].kind).withState("siege:dir", shapes[i].dir));
    });
    for (const old of trains().filter((t) => t.showcase)) {
      for (const c of old.cars) world.getEntity(c.eid)?.remove();
      trains().splice(trains().indexOf(old), 1);
    }
    const train = placeEngine(dim, pts[12], -90, 0);
    if (train) {
      train.showcase = true;
      addCoach(train, dim);
    }
    label({ x: o.x + 7, y: o.y, z: o.z + 6 }, "Train test loop\nclimb into the engine\nhold forward / back");
    store.save();
  } catch (e) {
    console.warn(`[Hollow Crown] showcase trains: ${e}`);
  }
  player.sendMessage("§6Trains: a loop of Track 70 blocks west of the showcase with an Engine and a Coach on it. Climb into the engine, hold forward to go and back to brake. Lay your own Track from the Every item chest.");
});

// ---------- the rider's view ----------
// From inside a car you can't see past the boiler or the coach walls, so riders are put in third person while
// aboard and given their own view back when they get off. Only players this put in third person are cleared,
// so it never cuts short a cutscene camera.
const VIEW_TAG = "siege_train_view";
onTick("trains_view", 5, () => {
  if (!isReady()) return;
  for (const p of world.getPlayers()) {
    let aboard = false;
    try {
      aboard = !!p.getComponent("minecraft:riding")?.entityRidingOn?.typeId?.startsWith("siege:train_");
    } catch {
      // between dimensions
    }
    const set = p.hasTag(VIEW_TAG);
    try {
      if (aboard && !set) {
        p.camera.setCamera("minecraft:third_person");
        p.addTag(VIEW_TAG);
      } else if (!aboard && set) {
        p.camera.clear();
        p.removeTag(VIEW_TAG);
      }
    } catch (e) {
      console.warn(`[Hollow Crown] train view: ${e}`);
    }
  }
});
