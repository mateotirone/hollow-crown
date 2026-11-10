// Moon doors. Corvin's rule: "Any door that belongs to both worlds obeys THEIR moon, not ours. What the
// carving shows, the sky must not." A door carved with a full moon opens only on the night our moon is dark;
// a door carved with a dark moon opens only under our full moon. It closes again at dawn.
// A moon door is a patch of ordinary blocks the map builder marks. When it opens, those blocks are taken
// away; when it closes they are put back exactly as they were. Decorate it however you like; build the
// carving above it yourself (the game tells players what is carved there when they come close).
//   /scriptevent siege:moon_door full [wide] [tall]    (creative) look at the bottom-left block of the door.
//   /scriptevent siege:moon_door dark [wide] [tall]    default is 2 wide, 3 tall, running to your right.
//   /scriptevent siege:moon_door remove                unmark the nearest door (it is closed first)
//   /scriptevent siege:moon_door list
//   /scriptevent siege:moon_door test                  open every door near you for 30 seconds
// Ledger mystery "The Wrong Moon" teaches the rule. Places that should use it: the lake at Rimehold (full
// moon carved on the shrine, opens the ice on the dark moon) and the Chapel of Saint Brannoc.

import { world, system, BlockPermutation, GameMode } from "@minecraft/server";
import { onTick, isNight, moduleStore, addTests, assert, assertEqual } from "../siege/api.js";

const store = moduleStore("hc:moon_doors", () => ({ doors: [] }));
const FULL = 0, DARK = 4; // Minecraft moon phases: 0 full ... 4 new
const FACES = { South: { x: 0, z: 1 }, West: { x: -1, z: 0 }, North: { x: 0, z: -1 }, East: { x: 1, z: 0 } };

export const moonPhase = () => {
  try { if (typeof world.getMoonPhase === "function") return Number(world.getMoonPhase()); } catch {}
  return ((world.getDay() % 8) + 8) % 8;
};
// What the carving shows, the sky must not
export const doorOpens = (carving, phase, night) => !!night && (carving === "full" ? phase === DARK : phase === FULL);
export const nightsUntil = (carving, phase) => ((carving === "full" ? DARK : FULL) - phase + 8) % 8;
// The blocks of a door: `wide` to the viewer's right along the wall, `tall` upward, from the bottom-left block
export function doorBlocks(door) {
  const out = [];
  for (let i = 0; i < door.wide; i++) for (let j = 0; j < door.tall; j++) out.push({ x: door.x + door.rx * i, y: door.y + j, z: door.z + door.rz * i });
  return out;
}

const testing = new Map(); // door id -> tick until which it is forced open
function setOpen(dim, door, open) {
  const cells = doorBlocks(door);
  if (open && !door.saved) {
    const saved = [];
    for (const c of cells) {
      const b = dim.getBlock(c);
      if (!b) return false; // not loaded: try again later
      saved.push({ t: b.typeId, s: b.permutation.getAllStates() });
    }
    door.saved = saved;
    store.save();
    for (const c of cells) dim.getBlock(c)?.setType("minecraft:air");
    dim.playSound?.("block.bell.hit", cells[0], { pitch: 0.4, volume: 1 });
    return true;
  }
  if (!open && door.saved) {
    if (cells.some((c) => !dim.getBlock(c))) return false;
    cells.forEach((c, i) => {
      const s = door.saved[i];
      try { dim.getBlock(c).setPermutation(BlockPermutation.resolve(s.t, s.s)); } catch { try { dim.getBlock(c).setType(s.t); } catch {} }
    });
    delete door.saved;
    store.save();
    return true;
  }
  return false;
}

const hinted = new Map(); // player id -> door id last described
function tick() {
  const doors = store.data.doors;
  if (!doors.length) return;
  const phase = moonPhase(), night = isNight();
  const dim = world.getDimension("overworld");
  for (const door of doors) {
    const near = dim.getPlayers({ location: door, maxDistance: 48 });
    if (!near.length && !door.saved) continue;
    const forced = (testing.get(door.id) ?? 0) > system.currentTick;
    const open = forced || doorOpens(door.carving, phase, night);
    try { setOpen(dim, door, open); } catch (e) { console.warn(`[Hollow Crown] moon door: ${e}`); }
    for (const p of near) {
      const close = Math.hypot(p.location.x - door.x, p.location.z - door.z) < 7 && Math.abs(p.location.y - door.y) < 6;
      if (!close) { if (hinted.get(p.id) === door.id) hinted.delete(p.id); continue; }
      if (hinted.get(p.id) === door.id) continue;
      hinted.set(p.id, door.id);
      p.sendMessage(open
        ? `§7A ${door.carving === "full" ? "full" : "dark"} moon is carved here. §fThe way is open.§7 It will not stay open past dawn.`
        : `§7A ${door.carving === "full" ? "full" : "dark"} moon is carved in the stone here. Nothing opens.`);
    }
  }
}
onTick("lore_moon_doors", 40, tick);

system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: player }) => {
  if (id !== "siege:moon_door" || player?.typeId !== "minecraft:player") return;
  const [cmd, w, h] = message.trim().split(/\s+/);
  const doors = store.data.doors;
  const dim = world.getDimension("overworld");
  if (cmd === "list" || !cmd) {
    const phase = moonPhase();
    return player.sendMessage(doors.length
      ? doors.map((d) => `§7${d.id}: carved ${d.carving}, ${d.wide}x${d.tall} at ${d.x} ${d.y} ${d.z}, opens in ${nightsUntil(d.carving, phase)} night(s)${d.saved ? " §f(open now)" : ""}`).join("\n")
      : "§7No moon doors yet. Look at a wall block in creative and run /scriptevent siege:moon_door full");
  }
  if (cmd === "test") {
    let n = 0;
    for (const d of doors) if (Math.hypot(player.location.x - d.x, player.location.z - d.z) < 48) { testing.set(d.id, system.currentTick + 600); n++; }
    return player.sendMessage(`§7${n} moon door(s) near you will stand open for 30 seconds.`);
  }
  if (player.getGameMode() !== GameMode.Creative) return player.sendMessage("§cOnly a builder in creative can mark moon doors.");
  if (cmd === "remove") {
    const near = [...doors].sort((a, b) => Math.hypot(player.location.x - a.x, player.location.z - a.z) - Math.hypot(player.location.x - b.x, player.location.z - b.z))[0];
    if (!near || Math.hypot(player.location.x - near.x, player.location.z - near.z) > 12) return player.sendMessage("§cNo moon door within 12 blocks.");
    setOpen(dim, near, false);
    store.data.doors = doors.filter((d) => d !== near);
    store.save();
    return player.sendMessage(`§aMoon door ${near.id} unmarked. Its blocks are back and are ordinary blocks again.`);
  }
  if (cmd !== "full" && cmd !== "dark") return player.sendMessage("§7Use: full | dark [wide] [tall], remove, list, test");
  const hit = player.getBlockFromViewDirection({ maxDistance: 8 });
  const f = hit && FACES[hit.face];
  if (!f) return player.sendMessage("§cLook at the side of the bottom-left block of the door, close up, and run it again.");
  // the viewer's right along the wall
  const door = {
    id: `door${Date.now().toString(36)}`, carving: cmd, x: hit.block.location.x, y: hit.block.location.y, z: hit.block.location.z,
    rx: f.z, rz: -f.x, wide: Math.max(1, Math.min(9, Number(w) || 2)), tall: Math.max(1, Math.min(9, Number(h) || 3)),
  };
  doors.push(door);
  store.save();
  player.sendMessage(`§aMoon door marked: ${door.wide} wide, ${door.tall} tall, carved with a ${cmd} moon.§r §7It opens on the night of the ${cmd === "full" ? "dark" : "full"} moon (${nightsUntil(cmd, moonPhase())} night(s) from now) and closes at dawn. Build the carving above it. Try it: /scriptevent siege:moon_door test`);
});

addTests("lore", {
  "moon doors: what the carving shows, the sky must not": () => {
    assert(doorOpens("full", 4, true), "full carving, dark moon");
    assert(!doorOpens("full", 0, true), "full carving does not open under a full moon");
    assert(doorOpens("dark", 0, true) && !doorOpens("dark", 4, true));
    assert(!doorOpens("full", 4, false), "never by day");
    assert(!doorOpens("full", 3, true) && !doorOpens("full", 5, true), "only the one night");
    assertEqual(nightsUntil("full", 4), 0);
    assertEqual(nightsUntil("full", 5), 7);
    assertEqual(nightsUntil("dark", 6), 2);
  },
  "moon doors: the door runs to the viewer's right and upward": () => {
    const cells = doorBlocks({ x: 0, y: 64, z: 0, rx: 1, rz: 0, wide: 2, tall: 3 });
    assertEqual(cells.length, 6);
    assertEqual(cells[5], { x: 1, y: 66, z: 0 });
  },
});
