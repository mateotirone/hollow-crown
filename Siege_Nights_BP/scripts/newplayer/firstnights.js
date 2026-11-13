// First nights (new-player audit, Mateo 2026-11-13): until a settlement has held its first siege, the quest tracker's
// top line walks the founder through getting ready: raise the banner, open the Workshop, build a Barracks, train
// guards, hold the night, with the countdown to the first siege under it. The story steps carry on below it.
// Also: a short "what to do first" in chat when the banner goes up, and a warning the day before each of the first
// three siege nights.
//
// firstStep(f) is pure (tests run it in Node); firstFacts(player) reads the world for it (quests/index.js asks).

import { world } from "@minecraft/server";
import { onTick, on, keepOf, nextSiegeDay, guardCount, barracksOf, isReady, addTests, assert, assertEqual } from "../siege/api.js";
import { ballistasOf } from "../siege/machines.js";
import { fallenRecord } from "../siege/keep.js";
import { yardWorkshop } from "./workshop.js";

const PICKS = /_pickaxe$/;
const WOOD = /(_log|_planks|_wood)$/;

// f = { keep, wins, days (to the next siege, 0 = tonight), workshop: { x, z } | true | undefined, barracks, guards,
//       ballistas, pick, wood }
export function firstStep(f) {
  if (!f || (f.wins ?? 0) > 0) return undefined;
  const when = f.days === undefined ? "" : f.days <= 0 ? "The first siege comes tonight." : `First siege in ${f.days} day${f.days === 1 ? "" : "s"}.`;
  const step = (id, title, hint, target) => ({ id: `first_${id}`, title, hint, target, note: when });
  if (!f.keep) return { id: "keep", title: "Found your settlement", hint: "Raise your Keep Banner on your Plot Stone. Raiders come from the fifth night." };
  if (!f.barracks && !f.ballistas) {
    if (!f.workshop) {
      if (!f.pick) return step("tools", "Get a pickaxe", "Your founder's chest has one. Or craft one: Woodcutters sell planks.");
      return step("workshop", "Make a Siege Workshop", "An iron ingot over stone brick, crafting table, stone brick. Iron lies under your land: dig down.");
    }
    const target = f.workshop.x !== undefined ? { name: "Siege Workshop", x: f.workshop.x, z: f.workshop.z, dim: "minecraft:overworld" } : undefined;
    return step("barracks", "Build a Barracks", "At the Siege Workshop: 3 stone bricks over planks, a barrel and planks. The Mason sells stone bricks.", target);
  }
  if (f.barracks && !f.guards && !f.ballistas) return step("guards", "Train your first guards", "Click your Barracks, then Train soldiers. 40 Regals each; a Hamlet keeps 4.");
  return step("hold", "Hold the first siege", "Stay online that night. Kill every raider before they reach your Keep Banner.");
}

export function firstFacts(player) {
  const keep = keepOf(player.id);
  if (keep && (keep.wins ?? 0) > 0) return undefined;
  const f = { keep: !!keep, wins: keep?.wins ?? 0 };
  if (!keep) return f;
  try { f.days = Math.max(0, nextSiegeDay() - world.getDay()); } catch { /* not ready */ }
  try { f.barracks = barracksOf(player.id).length > 0; } catch { /* not ready */ }
  try { f.guards = guardCount(player.id); } catch { /* not ready */ }
  try { f.ballistas = ballistasOf(player.id).length; } catch { /* not loaded */ }
  f.workshop = yardWorkshop(player.id) ?? (player.getDynamicProperty("hc:made_workshop") ? true : undefined);
  const inv = player.getComponent("minecraft:inventory")?.container;
  for (let i = 0; inv && i < inv.size; i++) {
    const it = inv.getItem(i);
    if (!it) continue;
    if (PICKS.test(it.typeId)) f.pick = true;
    if (WOOD.test(it.typeId)) f.wood = true;
    if (it.typeId === "siege:workshop") f.workshop ??= true;
  }
  return f;
}

// Someone who places a Workshop of their own has one
world.afterEvents.playerPlaceBlock.subscribe(({ player, block }) => {
  if (block.typeId === "siege:workshop") player.setDynamicProperty("hc:made_workshop", true);
});

const FIRST_DAYS = [
  "§6Your settlement stands. Before the first siege on the fifth night:",
  "§7 1. Take what you need from the §ffounder's chest§7 in your house.",
  "§7 2. Open the §fSiege Workshop§7 in the Mason's Yard. Build a §fBarracks§7 there (stone bricks, planks and a barrel).",
  "§7 3. Click the Barracks and §ftrain guards§7 (40 Regals each).",
  "§7 4. On the night, stay online and keep your Keep Banner standing. The top-right tracker shows your next step.",
];
on("keepFounded", ({ player, moved }) => {
  if (moved || !player?.isValid) return;
  const keep = keepOf(player.id);
  if ((keep?.wins ?? 0) > 0) return;
  for (const line of FIRST_DAYS) player.sendMessage(line);
});

// The day before each of a settlement's first three siege nights, at dawn
const warned = new Map(); // owner -> day warned for
onTick("newplayer_eve", 200, () => {
  if (!isReady()) return;
  let next;
  try { next = nextSiegeDay(); } catch { return; }
  const today = world.getDay();
  if (next - today !== 1) return;
  const t = world.getTimeOfDay();
  if (t > 12000) return; // only by day
  for (const player of world.getPlayers()) {
    const keep = keepOf(player.id);
    if (!keep || (keep.sieges ?? 0) >= 3 || warned.get(player.id) === next) continue;
    warned.set(player.id, next);
    player.onScreenDisplay.setActionBar("§cSiege tomorrow night");
    player.sendMessage(`§cTomorrow night is a siege night.§7 You have ${guardCount(player.id)} guard${guardCount(player.id) === 1 ? "" : "s"}. Patch your wall, eat well, and be here when the horn sounds.`);
  }
});

addTests("newplayer first nights", {
  "first nights: banner, workshop, barracks, guards, hold, then nothing": () => {
    assertEqual(firstStep({ keep: false }).id, "keep");
    assertEqual(firstStep({ keep: true, days: 4 }).id, "first_tools");
    assertEqual(firstStep({ keep: true, days: 4, pick: true }).id, "first_workshop");
    assertEqual(firstStep({ keep: true, days: 4, workshop: { x: 1, z: 2 } }).id, "first_barracks");
    assertEqual(firstStep({ keep: true, days: 2, workshop: true, barracks: true }).id, "first_guards");
    assertEqual(firstStep({ keep: true, days: 0, workshop: true, barracks: true, guards: 2 }).id, "first_hold");
    assertEqual(firstStep({ keep: true, days: 3, ballistas: 1 }).id, "first_hold");
    assert(firstStep({ keep: true, wins: 1 }) === undefined, "gone after the first win");
    assert(firstStep({ keep: true, days: 0, workshop: true, barracks: true, guards: 1 }).note.includes("tonight"), "tonight");
  },
  "a fallen keep loses one win, never its tier": () => {
    assertEqual(fallenRecord({ wins: 0 }).wins, 0);
    assertEqual(fallenRecord({ wins: 2 }).wins, 1);
    assertEqual(fallenRecord({ wins: 3 }).wins, 3, "a fresh Town stays a Town");
    assertEqual(fallenRecord({ wins: 5 }).wins, 4);
    assertEqual(fallenRecord({ wins: 11, warlordsSlain: 2 }).wins, 10, "a Castle stays a Castle");
    assertEqual(fallenRecord({ wins: 11, warlordsSlain: 1 }).wins, 10, "City with 11 wins drops to 10");
  },
});
