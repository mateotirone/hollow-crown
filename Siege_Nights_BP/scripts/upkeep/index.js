// Upkeep: each dawn a settlement pays for itself, and the screen says so ("Upkeep paid: 42 Regals").
// Numbers: data.js. Mateo 2026-11-13.
//
// - Charged once a day, at the first dawn the owner is in the world for. Days spent away are never billed, so
//   nobody comes back to an empty safe. Nothing is owed before a Keep stands, or for its first few days.
// - The sum: the town's size, every building, every guard. Creative pays nothing.
// - The Regals leave the game. When a player wears the Crown, a share of everyone else's upkeep goes to them.
//   Alone, or under an NPC ruler, all of it simply goes.
// - Short of Regals: what you have is taken and the rest is forgiven, but until a dawn is paid in full your
//   fallen guards are not retrained (they wait at the Barracks). Buildings are never lost.
//
// Test: /scriptevent siege:upkeep        what your settlement owes a day
//       /scriptevent siege:upkeep dawn   charge it now

import { world, system, GameMode } from "@minecraft/server";
import { onTick, isReady, keepOf, tierOf, guardCount, moduleStore, addFilter, emit } from "../siege/api.js";
import { builtCounts } from "../settle/founding.js";
import { banked, robBank, giveCoins, absorb } from "../economy/coins.js";
import { coins } from "../economy/rules.js";
import { ruler } from "../crown/state.js";
import { sfx } from "../core/sfx.js";
import { UPKEEP, upkeepOf, settle, breakdown } from "./data.js";
import "./tests.js";

// of: { ownerId: { day: last day billed, since: day first seen, short: true while a dawn went unpaid } }
const store = moduleStore("siege:upkeep", () => ({ of: {} }));

function countsOf(owner) {
  let buildings = 0;
  try { buildings = Object.values(builtCounts(owner)).reduce((n, c) => n + c, 0); } catch { /* no town laid out */ }
  return { tier: tierOf(keepOf(owner) ?? {})?.name ?? "Hamlet", buildings, guards: guardCount(owner) };
}

export const upkeepFor = (owner) => upkeepOf(countsOf(owner));
export const inArrears = (owner) => !!store.data.of[owner]?.short;

function bill(player) {
  const owner = player.id;
  const counts = countsOf(owner), owed = upkeepOf(counts);
  if (owed.total <= 0 || player.getGameMode() === GameMode.Creative) return;
  absorb(player);
  const crowned = ruler();
  const toCrown = !!crowned?.id && crowned.id !== owner && !crowned.npc && !String(crowned.id).startsWith("npc:"); // a ruling lord keeps no balance
  const res = settle(owed.total, banked(player), { toCrown });
  if (res.paid) robBank(owner, res.paid);
  if (res.crown) giveCoins(crowned.id, res.crown);
  const rec = store.data.of[owner];
  const was = !!rec.short;
  rec.short = res.short > 0;
  store.save();
  emit("upkeepPaid", { player, owner, paid: res.paid, short: res.short, crown: res.crown });
  if (!res.short) {
    player.onScreenDisplay.setActionBar(`§6Upkeep paid: §f${coins(res.paid)}`);
    player.sendMessage(`§6Upkeep paid: §f${coins(res.paid)}§7 (${breakdown(owed, counts)}).${res.crown ? ` §5${coins(res.crown)} of it goes to the Crown.` : ""}${was ? " §aYour guards are being retrained again." : ""}`);
    sfx(player, "random.orb", { volume: 0.4 });
  } else {
    player.onScreenDisplay.setActionBar(`§cUpkeep: ${coins(res.short)} short`);
    player.sendMessage(`§cUpkeep: you owed ${coins(owed.total)}§7 (${breakdown(owed, counts)})§c and were ${coins(res.short)} short.§7 ${res.paid ? `${coins(res.paid)} was taken. ` : ""}Nothing is lost, but fallen guards won't be retrained until a dawn is paid in full.`);
  }
}

onTick("upkeep", 100, () => {
  if (!isReady()) return;
  const day = world.getDay();
  for (const player of world.getPlayers()) {
    if (!keepOf(player.id)) continue;
    const rec = (store.data.of[player.id] ??= { day, since: day });
    if (rec.day >= day) continue;
    rec.day = day; // one bill a day, and none for the days spent away
    store.save();
    if (day - rec.since < UPKEEP.graceDays) continue;
    if (UPKEEP.freeUntilFirstWin && !(keepOf(player.id).wins > 0)) continue; // a Hamlet that hasn't held a night yet pays nothing
    try { bill(player); } catch (e) { console.warn(`[Hollow Crown] upkeep: ${e}`); }
  }
});

// Unpaid: the Barracks stops retraining the fallen until a dawn is paid
addFilter("guardRetrainHeld", (held, { owner }) => held || inArrears(owner));

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:upkeep") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isReady()) return;
  if (!keepOf(player.id)) return player.sendMessage("§7You have no settlement, so you owe nothing.");
  const counts = countsOf(player.id), owed = upkeepOf(counts);
  if (event.message.trim() === "dawn") {
    store.data.of[player.id] ??= { day: world.getDay(), since: world.getDay() };
    return bill(player);
  }
  const free = UPKEEP.freeUntilFirstWin && !(keepOf(player.id).wins > 0) ? " §aNothing is charged until you hold your first siege." : "";
  player.sendMessage(`§6Upkeep a day: §f${coins(owed.total)}§7 (${breakdown(owed, counts) || "nothing yet"}).${free}${inArrears(player.id) ? " §cThe last dawn went unpaid." : ""}`);
});
