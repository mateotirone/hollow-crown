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
import { plotFor } from "../settle/founding.js";
import { plotPrice } from "../settle/plotmarker.js";

// f = { keep, wins, days (to the next siege, 0 = tonight), barracks (a working Barracks block on your land),
//       plot: where to raise one ({ x, z, state: "free" | "rising" | "built" } from founding.js plotFor),
//       price (Regals for the Barracks on its plot), guards, ballistas }
// Mateo 2026-11-13: every step written out on screen, saying exactly what to do and where; nothing assumed.
// The Barracks is no longer crafted: it unlocks with the Hamlet and goes on a plot that fits it, from that
// plot's Plot Marker.
export function firstStep(f) {
  if (!f || (f.wins ?? 0) > 0) return undefined;
  const when = f.days === undefined ? "" : f.days <= 0 ? "The first siege comes tonight." : `First siege in ${f.days} day${f.days === 1 ? "" : "s"}.`;
  const step = (id, title, hint, target) => ({ id: `first_${id}`, title, hint, target, note: when });
  if (!f.keep) return { id: "keep", title: "Found your settlement", hint: "Place your Keep Banner on your Plot Stone, the stone in the middle of your plot. That makes the land yours. Raiders come from the fifth night." };
  if (!f.barracks && !f.ballistas) {
    const pin = f.plot ? { name: "Barracks plot", x: f.plot.x, z: f.plot.z, dim: "minecraft:overworld" } : undefined;
    if (f.plot?.state === "rising") return step("rising", "Wait for your Barracks", "Builders are raising it on its plot, a layer at a time. When it stands, the Barracks block is by its front door.", pin);
    if (f.plot?.state === "built") return step("barracks_block", "Find your Barracks block", "Your Barracks stands, but its Barracks block is missing. It belongs by the front door: put one back there.", pin);
    const price = f.price ? `${f.price} Regals` : "a few Regals";
    return step("barracks", "Build a Barracks",
      `Go to your big empty plot (the pin shows it). The post standing on it is its Plot Marker: click it, choose Barracks, then Raise it (${price}). Builders put it up for you.`, pin);
  }
  if (f.barracks && !f.guards && !f.ballistas) return step("guards", "Train your first guards", "Go to your Barracks and click the Barracks block by its front door. Choose Train soldiers: 40 Regals each, and a Hamlet keeps 4.");
  return step("hold", "Hold the first siege", "Be here that night. Your guards fight beside you: kill every raider before they reach your Keep Banner.");
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
  try { f.plot = plotFor(player.id, "barracks"); } catch { /* no town layout */ }
  try { f.price = plotPrice("barracks"); } catch { /* no wallet yet */ }
  return f;
}

// Someone who places a Workshop of their own has one
world.afterEvents.playerPlaceBlock.subscribe(({ player, block }) => {
  if (block.typeId === "siege:workshop") player.setDynamicProperty("hc:made_workshop", true);
});

const FIRST_DAYS = [
  "§6Your settlement stands. Before the first siege on the fifth night:",
  "§7 1. Take what you need from the §ffounder's chest§7 in your house.",
  "§7 2. Build a §fBarracks§7: go to your big empty plot, click its §fPlot Marker§7 (the post on it), choose Barracks and Raise it.",
  "§7 3. When it stands, click the §fBarracks block§7 by its door and §ftrain guards§7 (40 Regals each).",
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
  "first nights: banner, Barracks from its Plot Marker, guards, hold, then nothing": () => {
    assertEqual(firstStep({ keep: false }).id, "keep");
    const plot = { x: 5, z: 9, state: "free" };
    const b = firstStep({ keep: true, days: 4, plot, price: 16 });
    assertEqual(b.id, "first_barracks");
    assert(/Plot Marker/.test(b.hint) && /16 Regals/.test(b.hint) && b.target?.x === 5 && b.target?.z === 9, "says where and how, with a pin");
    assertEqual(firstStep({ keep: true, days: 4 }).id, "first_barracks", "no fitting plot known: still the step, no pin");
    assertEqual(firstStep({ keep: true, days: 3, plot: { ...plot, state: "rising" } }).id, "first_rising");
    assertEqual(firstStep({ keep: true, days: 3, plot: { ...plot, state: "built" } }).id, "first_barracks_block");
    assertEqual(firstStep({ keep: true, days: 2, barracks: true }).id, "first_guards");
    assertEqual(firstStep({ keep: true, days: 0, barracks: true, guards: 2 }).id, "first_hold");
    assertEqual(firstStep({ keep: true, days: 3, ballistas: 1 }).id, "first_hold");
    assert(firstStep({ keep: true, wins: 1 }) === undefined, "gone after the first win");
    assert(firstStep({ keep: true, days: 0, barracks: true, guards: 1 }).note.includes("tonight"), "tonight");
    for (const f of [{ keep: false }, { keep: true, plot }, { keep: true, barracks: true }, { keep: true, barracks: true, guards: 1 }]) {
      const st = firstStep(f);
      assert(st.title && st.hint && st.hint.length > 40, `${st.id} spells out what to do`);
    }
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
