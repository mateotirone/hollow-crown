// Pre-designed buildings you place down. Put a Foundation Stone on free-build ground, facing the
// way the building should run, click it, pick a building, look at the outline, click again to
// raise it. You pay in planks and building stone you already have; whatever you lack, the mason
// supplies for emeralds. The stone comes back to you when the building is done.
//
// Events: emit("settleBuilt", { owner, player, building, style, origin, forward, box, marks })
//   marks = the design's named spots in the world, e.g. a library's shelf0..shelf13, lectern, portrait0..2, painting0
//   a library also sends portraitYaw and paintingYaw: the way those pictures face (0 south, 90 west, 180 north, -90 east)
// Test: /scriptevent siege:settle_build <building> [style]   raise one where you stand, free

import { world, system, GameMode, ItemStack } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { isReady, settlementAt, isAlly, keepOf, onTick, moduleStore, on, emit } from "../siege/api.js";
import { purse, charge, coins, lot } from "./wallet.js";
import { startBuild, buildFor, worldMarks, resolveRole, clearBoxFor } from "../townhall/build.js";
import { levelSite, foundationColumns, Groundwork } from "./ground.js";
import { hallOf } from "../townhall/townhall.js";
import { STYLES, STYLE_IDS, styleFromGround } from "../townhall/styles.js";
import { plotAt } from "../plots/claims.js";
import { SETTLE, REGION_TO_STYLE, ONE_EACH } from "./config.js";
import { BUILDINGS, BUILDING, drawBuilding, styleFor } from "./buildings.js";
import { footprint, corners, boxesTouch, bill, priceOf, MATERIALS } from "./rules.js";
import { reservesOf, reserveAt, drawBox } from "./zones.js";
import { sfx } from "../core/sfx.js";

export const FOUNDATION = "siege:foundation_stone";
const OVERWORLD = "minecraft:overworld";

// stones: { "x,y,z": { owner, placer, fx, fz, pick?, style?, building? } }   raised: { playerId: [building ids] }
const store = moduleStore("siege:settle_plans", () => ({ stones: {}, raised: {}, count: 0 }));
const stones = () => store.data.stones;
const keyOf = (loc) => `${loc.x},${loc.y},${loc.z}`;
const locOf = (key) => { const [x, y, z] = key.split(",").map(Number); return { x, y, z }; };
const jobId = (key) => `settle:${key}`;
const invOf = (player) => player.getComponent("minecraft:inventory").container;
const isCreative = (player) => player.getGameMode() === GameMode.Creative;

// The style a settlement builds in: its hall's, else its plot's region, else what the ground suggests
export function styleOf(owner, block) {
  const hall = hallOf(owner);
  if (hall?.style && STYLES[hall.style]) return hall.style;
  try {
    const region = REGION_TO_STYLE[plotAt(keepOf(owner) ?? block.location)?.region];
    if (region) return region;
  } catch {
    // no plots in this world
  }
  if (!block) return "vale";
  const counts = {};
  for (let dx = -8; dx <= 8; dx += 4) for (let dz = -8; dz <= 8; dz += 4) {
    try {
      const top = block.dimension.getTopmostBlock({ x: block.x + dx, z: block.z + dz });
      if (top) counts[top.typeId] = (counts[top.typeId] ?? 0) + 1;
    } catch {
      // not loaded
    }
  }
  return styleFromGround(counts);
}

export function countMatching(player, match) {
  const inv = invOf(player);
  let n = 0;
  for (let i = 0; i < inv.size; i++) {
    const item = inv.getItem(i);
    if (item && match(item.typeId)) n += item.amount;
  }
  return n;
}

export function takeMatching(player, match, amount) {
  const inv = invOf(player);
  for (let i = 0; i < inv.size && amount > 0; i++) {
    const item = inv.getItem(i);
    if (!item || !match(item.typeId)) continue;
    if (item.amount > amount) {
      item.amount -= amount;
      inv.setItem(i, item);
      amount = 0;
    } else {
      amount -= item.amount;
      inv.setItem(i, undefined);
    }
  }
}

const boxOf = (key, stone, buildingId, style) =>
  footprint(locOf(key), { x: stone.fx, z: stone.fz }, drawBuilding(buildingId, style).bounds());

// Why this building can't stand here, or undefined
export function siteProblem(owner, box, exceptKey) {
  if (!corners(box).every((c) => settlementAt(c) === owner)) return "It would reach past the edge of this settlement's land.";
  const reserve = reservesOf(owner).find((r) => boxesTouch(r, box))
    ?? [...corners(box), { x: (box.x0 + box.x1) / 2, z: (box.z0 + box.z1) / 2 }].map((c) => reserveAt(owner, c)).find(Boolean);
  if (reserve) return `It would stand on ground kept clear for ${reserve.label}.`;
  for (const [key, other] of Object.entries(stones())) {
    if (key === exceptKey || !other.building) continue;
    if (boxesTouch(box, boxOf(key, other, other.building, other.style))) return "Another building is rising there right now.";
  }
  return undefined;
}

// ---------- raising ----------

const yawOf = (d) => (d.z === 1 ? 0 : d.x === -1 ? 90 : d.z === -1 ? 180 : -90);

// slot: { owner, id } when the building goes on a town slot (plotmarker.js); then onDone(stone) also runs
export function raise(key, stone, buildingId, style, { quiet = false, onDone: after } = {}) {
  if (buildFor(jobId(key))) return false;
  const plan = drawBuilding(buildingId, style);
  const stoneAt = locOf(key);
  const forward = { x: stone.fx, z: stone.fz };
  // on a terraformed pad (ground.js, terraform.js: cut in at most 3, the land round it blended), with foundation
  // below; the stone keeps its own spot
  // a build picked up again after a restart keeps the height it started at
  // on a town plot the floor goes on the plot's levelled pad, never lifted onto a bump of grass the groundwork left;
  // anything natural standing in its box is cleared first (Mateo's playtest 2026-11-12: a library on a dirt shelf)
  const resumed = stone.building === buildingId && Number.isFinite(stone.lift);
  const { origin, lift } = resumed
    ? { origin: { ...stoneAt, y: stoneAt.y + stone.lift }, lift: stone.lift }
    : stone.slot ? { origin: stoneAt, lift: 0 } : levelSite(world.getDimension(OVERWORLD), plan, stoneAt, forward, { terraform: true });
  stone.building = buildingId;
  stone.style = style;
  stone.lift = lift;
  stone.pick = undefined;
  store.save();
  const job = startBuild({
    id: jobId(key), dimensionId: OVERWORLD, origin, forward, plan, style: styleFor(style),
    ...(stone.slot && !resumed ? { clearBox: clearBoxFor(plan, origin, forward, 0) } : {}),
    ...(!stone.slot && !resumed ? { ground: new Groundwork(plan, origin, forward, style) } : {}),
    perTick: Math.max(4, Math.ceil(plan.cells.size / SETTLE.riseTicks)),
    onDone() {
      const dim = world.getDimension(OVERWORLD);
      const player = world.getPlayers().find((p) => p.id === stone.placer);
      try {
        const block = dim.getBlock(stoneAt);
        if (block?.typeId === FOUNDATION) {
          if (lift > 0) block.setPermutation(resolveRole(job.style, job.frame, "foundation")); // it sat under the floor
          else block.setType("minecraft:air");
          const back = new ItemStack(FOUNDATION, 1);
          const left = player && !isCreative(player) ? invOf(player).addItem(back) : player ? undefined : back;
          if (left) dim.spawnItem(left, { x: origin.x + 0.5, y: origin.y + 0.5, z: origin.z + 0.5 });
        }
      } catch {
        // not loaded: the stone simply stays
      }
      delete stones()[key];
      store.data.count = (store.data.count ?? 0) + 1;
      const done = (store.data.raised[stone.placer] ??= []);
      const first = !done.includes(buildingId);
      if (first) done.push(buildingId);
      store.save();
      const yaws = Object.fromEntries(Object.entries(BUILDING[buildingId].faces ?? {}).map(([name, sign]) => [name, yawOf({ x: forward.x * sign, z: forward.z * sign })]));
      emit("settleBuilt", { ...yaws, owner: stone.owner, player: stone.placer, building: buildingId, style, origin, forward, box: footprint(origin, forward, plan.bounds()), marks: worldMarks(plan, origin, forward), slotId: stone.slot });
      try { after?.(stone); } catch (e) { console.warn(`[Hollow Crown] settle build: ${e}`); }
      if (!player || quiet) return;
      sfx(player, "random.levelup");
      player.sendMessage(`§6Your ${BUILDING[buildingId].name} is built.§7 It is yours to change: knock out a wall, add a door, move in.${stone.slot ? "" : " The Foundation Stone is back in your pack."}`);
      if (first && SETTLE.firstBuildRenown) emit("skillPoints", { player, amount: 0, source: `first ${BUILDING[buildingId].name}`, renown: SETTLE.firstBuildRenown });
    },
  });
  job.columns.unshift(...foundationColumns(plan));
  return { origin, lift };
}

// ---------- the Foundation Stone ----------

const cardinal = (view) => (Math.abs(view.x) > Math.abs(view.z) ? { x: Math.sign(view.x) || 1, z: 0 } : { x: 0, z: Math.sign(view.z) || 1 });

world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
  if (block.typeId !== FOUNDATION || !isReady()) return;
  const at = { ...block.location };
  const dim = block.dimension;
  const f = cardinal(player.getViewDirection());
  // Siege Nights first checks that this is your own land, and takes the stone back if it isn't
  system.run(() => {
    if (dim.getBlock(at)?.typeId !== FOUNDATION) return;
    const owner = settlementAt(at);
    if (!owner) return;
    stones()[keyOf(at)] = { owner, placer: player.id, fx: f.x, fz: f.z };
    store.save();
    player.onScreenDisplay.setActionBar("§6Foundation Stone set.§7 The building will rise in front of you. Click the stone to choose one.");
  });
});

world.afterEvents.playerBreakBlock.subscribe((event) => {
  if (event.brokenBlockPermutation.type.id !== FOUNDATION) return;
  const key = keyOf(event.block.location);
  const stone = stones()[key];
  if (!stone || stone.building) return; // a building under way finishes anyway
  delete stones()[key];
  store.save();
});

export function costLines(player, need) {
  const have = Object.fromEntries(Object.entries(MATERIALS).map(([kind, mat]) => [kind, countMatching(player, mat.match)]));
  const due = bill(need, have);
  const lines = Object.entries(MATERIALS).map(([kind, mat]) =>
    `${have[kind] >= need[kind] ? "§a" : "§e"}${need[kind]} ${mat.label}§7 (you carry ${have[kind]})`);
  return { due, lines };
}

async function chooseBuilding(player, key, stone) {
  const style = stone.style ?? styleOf(stone.owner, player.dimension.getBlock(locOf(key)));
  const form = new ActionFormData()
    .title("Foundation Stone")
    .body(`Pick a building. It rises in front of this stone, the way you were facing when you set it, in the §f${STYLES[style].name}§r style.\n\n§7Any planks and any building stone will do. The mason supplies what you lack, for a price.`);
  for (const b of BUILDINGS) {
    if (ONE_EACH.includes(b.id)) { form.button(`§8${b.name}\nOne per settlement: use a Plot Marker`); continue; } // the town counts it there
    const box = drawBuilding(b.id, style).bounds();
    const need = priceOf(drawBuilding(b.id, style));
    form.button(`${b.name}\n§8${box.x1 - box.x0 + 1} x ${box.z1 - box.z0 + 1}, ${need.timber} planks, ${need.stone} stone`);
  }
  form.button(`Style: ${STYLES[style].name}`);
  const res = await form.show(player);
  if (res.canceled) return;
  if (res.selection === BUILDINGS.length) return chooseStyle(player, key, stone, style);
  const building = BUILDINGS[res.selection];
  if (ONE_EACH.includes(building.id)) return player.sendMessage(`§7The ${building.name} is one per settlement, so it isn't raised from a Foundation Stone. Use the Plot Marker of an empty plot that fits it: the town keeps count there.`);
  stone.pick = building.id;
  stone.style = style;
  stone.pickedAt = system.currentTick;
  store.save();
  const problem = siteProblem(stone.owner, boxOf(key, stone, building.id, style), key);
  player.sendMessage(problem
    ? `§e${building.name}: ${problem}§7 The outline shows where it would stand. Move the stone, or click it to pick something smaller.`
    : `§6${building.name} marked out.§7 Walk round the green outline, then click the stone again to raise it. ${building.blurb}`);
}

async function chooseStyle(player, key, stone, current) {
  const form = new ActionFormData().title("Regional style").body("The same buildings, in each region's materials.");
  for (const id of STYLE_IDS) form.button(`${STYLES[id].name}${id === current ? " §2(now)" : ""}\n§8${STYLES[id].blurb}`);
  const res = await form.show(player);
  if (res.canceled) return;
  stone.style = STYLE_IDS[res.selection];
  store.save();
  chooseBuilding(player, key, stone);
}

async function confirmBuilding(player, key, stone) {
  const building = BUILDING[stone.pick];
  if (ONE_EACH.includes(building.id)) { stone.pick = undefined; store.save(); return chooseBuilding(player, key, stone); } // picked before the rule
  const style = stone.style;
  const problem = siteProblem(stone.owner, boxOf(key, stone, building.id, style), key);
  if (problem) {
    stone.pick = undefined;
    store.save();
    return player.sendMessage(`§c${building.name}: ${problem}§7 Move the Foundation Stone or pick another building.`);
  }
  const free = isCreative(player);
  const need = priceOf(drawBuilding(building.id, style));
  const { due, lines } = costLines(player, need);
  const emeralds = purse(player);
  due.emeralds *= lot(); // the bill counts lots; this is what the wallet is charged
  const body = [`${building.blurb}`, "", ...lines];
  if (free) body.push("", "§aFree in Creative.");
  else if (due.emeralds) body.push("", `${emeralds >= due.emeralds ? "§a" : "§c"}The mason supplies the rest for ${coins(due.emeralds)}§7 (you carry ${coins(emeralds)})`);
  body.push("", "§7Anything standing inside the outline is replaced.");
  const res = await new MessageFormData().title(`Raise the ${building.name}?`).body(body.join("\n"))
    .button1("Pick something else").button2(free || emeralds >= due.emeralds ? "Raise it" : "Not enough yet").show(player);
  if (res.canceled) return;
  if (res.selection === 0) return chooseBuilding(player, key, stone);
  if (!free) {
    if (emeralds < due.emeralds) return player.sendMessage(`§7You are ${coins(due.emeralds - emeralds)} short. Bring more planks or stone.`);
    if (due.emeralds && !charge(player, due.emeralds)) return;
    for (const [kind, mat] of Object.entries(MATERIALS)) takeMatching(player, mat.match, due.use[kind]);
  }
  if (!raise(key, stone, building.id, style)) return;
  sfx(player, "random.anvil_use");
  player.sendMessage(`§6The ${building.name} is going up.`);
}

const lastClick = new Map();
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player } = event;
  if (block.typeId !== FOUNDATION || event.isFirstEvent === false) return;
  if (system.currentTick - (lastClick.get(player.id) ?? -100) < 8) return;
  lastClick.set(player.id, system.currentTick);
  if (player.isSneaking && event.itemStack) return;
  event.cancel = true;
  const at = { ...block.location };
  system.run(() => {
    if (!isReady()) return;
    const key = keyOf(at);
    let stone = stones()[key];
    const owner = settlementAt(at);
    if (!owner) return player.sendMessage("§7This Foundation Stone stands outside any settlement.");
    if (owner !== player.id && !isAlly(owner, player.id)) return player.sendMessage("§7This is not your land to build on.");
    if (!stone) stone = stones()[key] = { owner, placer: player.id, ...Object.fromEntries(Object.entries(cardinal(player.getViewDirection())).map(([k, v]) => [`f${k}`, v])) };
    if (stone.building) return player.onScreenDisplay.setActionBar(`§7The ${BUILDING[stone.building].name} is still rising.`);
    stone.placer = player.id;
    if (stone.pick && BUILDING[stone.pick]) confirmBuilding(player, key, stone);
    else chooseBuilding(player, key, stone);
  });
});

// Outline of the building each stone has picked, for anyone nearby
function outlineTick() {
  const now = system.currentTick;
  for (const [key, stone] of Object.entries(stones())) {
    if (!stone.pick || stone.building) continue;
    if (now - (stone.pickedAt ?? now) > SETTLE.previewSeconds * 20 || now < (stone.pickedAt ?? 0)) {
      stone.pick = undefined; // timed out (or the world was reloaded): click again to choose
      continue;
    }
    const at = locOf(key);
    const box = boxOf(key, stone, stone.pick, stone.style);
    for (const player of world.getPlayers()) {
      if (player.dimension.id !== OVERWORLD || Math.hypot(player.location.x - at.x, player.location.z - at.z) > 40) continue;
      drawBox(player, box, "minecraft:villager_happy", 40);
    }
  }
}
onTick("settle_outlines", 20, () => {
  if (isReady()) outlineTick();
});

// Builds that were under way when the world closed start again (they only set what is missing)
on("ready", () => {
  for (const [key, stone] of Object.entries(stones())) {
    if (!stone.building || !BUILDING[stone.building]) continue;
    const { building, style } = stone;
    raise(key, stone, building, style ?? "vale");
  }
});

// Raise a building on a town slot (plotmarker.js has charged for it). It shows in settleBuilt as slotId.
export function raiseOnSlot(owner, placerId, origin, forward, buildingId, style, slotId, { quiet = false } = {}) {
  const key = keyOf(origin);
  if (stones()[key]?.building) return false;
  const stone = stones()[key] = { owner, placer: placerId, fx: forward.x, fz: forward.z, slot: slotId };
  return raise(key, stone, buildingId, style, { quiet });
}

// Is a building still going up at this spot?
export const risingAt = (origin) => !!stones()[keyOf(origin)]?.building;
export const jobOf = (origin) => buildFor(jobId(keyOf(origin)));

// Raise one without a stone or a price (showcase and the test command)
export function raiseFree(player, origin, forward, buildingId, style) {
  const key = keyOf(origin);
  const stone = stones()[key] = { owner: player.id, placer: player.id, fx: forward.x, fz: forward.z };
  return raise(key, stone, buildingId, style, { quiet: true });
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:settle_build") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isReady()) return;
  const [id, style = "vale"] = event.message.trim().split(/\s+/);
  if (!BUILDING[id] || !STYLES[style]) {
    return player.sendMessage(`§7Buildings: ${BUILDINGS.map((b) => b.id).join(", ")}. Styles: ${STYLE_IDS.join(", ")}.`);
  }
  const origin = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
  raiseFree(player, origin, cardinal(player.getViewDirection()), id, style);
  player.sendMessage(`§6${BUILDING[id].name} (${STYLES[style].name}) rising in front of you.`);
});
