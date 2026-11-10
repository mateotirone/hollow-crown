// Ravens (Mateo, 2026-11-10: "let them have significance").
// They were the Ice Isles' birds: every man fed one, and a raven carried his name home if he died abroad.
// When the Grey Host cut down a bell it nailed up a raven in its place, a voice for a voice. The Host was
// taken whole and six thousand birds were left with no names to carry, so they do the one thing they still
// know: they go where the Host is going next, and wait. Ravens on your wall at dusk mean a raid tonight.
// Sigrun Ashby explains it ("The ravens."). The more sieges a keep has won, the more of them come.
//   /scriptevent siege:ravens      see tonight's omen now (testing)

import { world, system } from "@minecraft/server";
import { onTick, keepOf, SETTINGS, addTests, assert, assertEqual } from "../siege/api.js";
import { progressOf } from "./player.js";
import { isSiegeNight } from "../reach/api.js";

export const ravenCount = (wins) => Math.min(40, 3 + Math.max(0, wins ?? 0));
export const isRaidDay = (day, every, first) => day >= first && day % every === 0;
export const isDusk = (time) => time >= 12000 && time < 12100;

export function omenText(count, knows) {
  const n = count === 3 ? "Three" : count < 13 ? ["Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"][count - 4] : `${count}`;
  return knows
    ? `§8${n} ravens on your wall at dusk, and not one of them making a sound. §7Sigrun said to count them, and then bar the gate.`
    : `§8${n} ravens have settled on your wall. They are not making a sound. They are all facing the same way.`;
}

// the siege raids feature knows which nights a siege comes; the old every-third-day rule is the fallback
function raidTonight() {
  try { return isSiegeNight(); } catch { return isRaidDay(world.getDay(), SETTINGS.siegeEveryNNights, SETTINGS.firstSiegeDay); }
}
const told = new Map(); // player id -> day
function show(player, force) {
  const keep = keepOf(player.id);
  if (!keep && !force) return;
  const day = world.getDay();
  if (!force && told.get(player.id) === day) return;
  told.set(player.id, day);
  player.sendMessage(omenText(ravenCount(keep?.wins), progressOf(player).flags.includes("heard_ravens")));
}

onTick("lore_ravens", 100, () => {
  if (!isDusk(world.getTimeOfDay()) || !raidTonight()) return;
  for (const player of world.getAllPlayers()) {
    try { show(player, false); } catch { /* left the game */ }
  }
});

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity: player }) => {
  if (id === "siege:ravens" && player?.typeId === "minecraft:player") show(player, true);
});

addTests("lore", {
  "ravens: they come at dusk on a raid day, and more of them the longer a keep has stood": () => {
    assert(isRaidDay(6, 3, 5) && !isRaidDay(7, 3, 5) && !isRaidDay(3, 3, 5));
    assert(isDusk(12000) && !isDusk(13000) && !isDusk(6000));
    assertEqual(ravenCount(0), 3);
    assert(ravenCount(10) > ravenCount(2) && ravenCount(500) === 40);
    assert(omenText(3, false).includes("Three") && omenText(5, true).includes("Sigrun") && omenText(20, false).includes("20"));
  },
});
