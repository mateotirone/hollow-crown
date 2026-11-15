// The Sallow Lantern at sea (model: studio/build_lantern.py). While a Captain's chase is on (crew raised, the Bride
// still at her altar), once each siege night the ship sails past them, far out on open water, with no one at the
// wheel, then is gone. When the Bride is laid down, it rises one last time beside the player and sinks.

import { world, system } from "@minecraft/server";
import { on, onTick, isReady, addTests, assert, assertEqual } from "../siege/api.js";
import { isSiegeNight } from "../reach/api.js";
import { sfx } from "../core/sfx.js";
import { inTollWindow } from "./logic.js";
import { trialsOf, save } from "./saves.js";

const SHIP = "siege:sallow_lantern";
const FAR = [56, 72, 88]; // how far out we look for open water
const SAIL_TICKS = 600; // 30 seconds in sight
const SPEED = 0.18; // blocks a tick, about 3.6 a second
const sailing = new Map(); // player id -> { ship, dir, left }

const day = () => Math.floor(world.getAbsoluteTime() / 24000);

// Bearings to try, spread round the compass, starting from a seeded angle so it isn't always the same side
export function bearings(seed, n = 16) {
  return Array.from({ length: n }, (_, i) => ((seed * 2.399 + (i * Math.PI * 2) / n) % (Math.PI * 2)));
}

// Is this a stretch of open water? (the column top is water at the point and 12 blocks either side along `dir`)
function openWater(dim, at, dir) {
  let y;
  for (const t of [-12, 0, 12]) {
    let b;
    try { b = dim.getTopmostBlock({ x: Math.floor(at.x + dir.x * t), z: Math.floor(at.z + dir.z * t) }); } catch { return undefined; }
    if (!b || b.typeId !== "minecraft:water") return undefined;
    y ??= b.location.y;
  }
  return y;
}

function findSea(player) {
  const dim = player.dimension, p = player.location;
  for (const r of FAR) {
    for (const a of bearings(day() + r)) {
      const at = { x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r };
      const dir = { x: -Math.sin(a), z: Math.cos(a) }; // sail across the player's view, not at them
      const y = openWater(dim, at, dir);
      if (y !== undefined) return { at: { x: at.x, y: y + 1, z: at.z }, dir };
    }
  }
  return undefined;
}

function launch(player, place, ticks) {
  const ship = player.dimension.spawnEntity(SHIP, place.at);
  ship.setRotation({ x: 0, y: (Math.atan2(-place.dir.x, place.dir.z) * 180) / Math.PI });
  sailing.set(player.id, { ship, dir: place.dir, left: ticks, sinking: false });
  return ship;
}

// After each siege night's horn has gone and before the toll: if you are chasing and near the sea, she comes by
onTick("roletrials_lantern_watch", 100, () => {
  if (!isReady()) return;
  let siege = false;
  try { siege = isSiegeNight(); } catch { return; }
  if (!siege || inTollWindow(world.getTimeOfDay())) return;
  for (const player of world.getPlayers()) {
    if (sailing.has(player.id) || player.dimension.id !== "minecraft:overworld") continue;
    const c = trialsOf(player).roles.captain;
    if (!c?.started || c.deed || !c.done.includes("crew") || c.seenDay === day()) continue;
    const place = findSea(player);
    if (!place) continue;
    try {
      launch(player, place, SAIL_TICKS);
      c.seenDay = day();
      save(player);
      player.sendMessage("§8Far out on the water a ship is passing with all her sails set and no wind to fill them. No lights in her. Nobody at the wheel. §3The Sallow Lantern.");
      sfx(player, "block.bell.hit", { pitch: 0.5, volume: 0.4 });
    } catch (e) { console.warn(`[Role trials] Lantern: ${e}`); }
  }
});

onTick("roletrials_lantern_sail", 2, () => {
  for (const [id, s] of sailing) {
    try {
      if (!s.ship.isValid) { sailing.delete(id); continue; }
      s.left -= 2;
      if (!s.sinking) {
        const l = s.ship.location;
        s.ship.teleport({ x: l.x + s.dir.x * SPEED * 2, y: l.y, z: l.z + s.dir.z * SPEED * 2 }, { keepVelocity: false });
        if (s.left % 20 === 0) s.ship.dimension.spawnParticle("minecraft:soul_particle", { x: l.x, y: l.y + 6, z: l.z });
      }
      if (s.left <= 0) { s.ship.remove(); sailing.delete(id); }
    } catch { sailing.delete(id); }
  }
});

// The Bride lies down: the Lantern comes up beside you, leans over and goes under
on("loreFlag", ({ player, flag }) => {
  if (flag !== "trial_captain_deed" || !player) return;
  system.runTimeout(() => {
    try {
      const old = sailing.get(player.id);
      if (old) { try { old.ship.remove(); } catch { /* gone */ } sailing.delete(player.id); }
      const place = findSea(player);
      if (!place) return;
      const ship = launch(player, place, 200);
      sailing.get(player.id).sinking = true;
      const { x, y, z } = place.at;
      system.runTimeout(() => {
        try { player.dimension.runCommand(`playanimation @e[type=${SHIP},r=2,x=${x},y=${y},z=${z}] animation.siege_sallow_lantern.sink`); } catch { /* gone */ }
        sfx(player, "random.explode", { pitch: 0.4, volume: 0.3 });
      }, 40);
      void ship;
    } catch (e) { console.warn(`[Role trials] Lantern sinks: ${e}`); }
  }, 60);
});

// A reload leaves no ships at sea
let swept = false;
onTick("roletrials_lantern_sweep", 200, () => {
  if (!isReady() || swept) return;
  swept = true;
  try { for (const e of world.getDimension("minecraft:overworld").getEntities({ type: SHIP })) if (![...sailing.values()].some((s) => s.ship === e)) e.remove(); } catch { /* fine */ }
});

addTests("roletrials", {
  "the Lantern looks all round the compass for open water": () => {
    const b = bearings(5);
    assertEqual(b.length, 16);
    assert(b.every((a) => a >= 0 && a < Math.PI * 2));
    assert(new Set(b.map((a) => a.toFixed(3))).size === 16);
  },
});

// Testing: /scriptevent siege:lantern sail | sink   (needs open water within 88 blocks)
system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
  if (id !== "siege:lantern" || sourceEntity?.typeId !== "minecraft:player") return;
  const place = findSea(sourceEntity);
  if (!place) return sourceEntity.sendMessage("§7No open water within 88 blocks.");
  if (sailing.has(sourceEntity.id)) { try { sailing.get(sourceEntity.id).ship.remove(); } catch { /* gone */ } sailing.delete(sourceEntity.id); }
  if (message.trim() === "sink") {
    launch(sourceEntity, place, 200);
    sailing.get(sourceEntity.id).sinking = true;
    const { x, y, z } = place.at;
    system.runTimeout(() => { try { sourceEntity.dimension.runCommand(`playanimation @e[type=${SHIP},r=2,x=${x},y=${y},z=${z}] animation.siege_sallow_lantern.sink`); } catch { /* gone */ } }, 40);
  } else launch(sourceEntity, place, SAIL_TICKS);
});
