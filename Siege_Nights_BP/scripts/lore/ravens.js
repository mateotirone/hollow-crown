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
import { pickGreet } from "./logic.js";

export const ravenCount = (wins) => Math.min(40, 3 + Math.max(0, wins ?? 0));
export const isRaidDay = (day, every, first) => day >= first && day % every === 0;
export const isDusk = (time) => time >= 12000 && time < 12100;

// Heard on every siege night for as long as the world lasts, so it is a pool and never the same line twice running
export const OMENS = {
  plain: [
    "{N} ravens have settled on your wall. They are not making a sound. They are all facing the same way.",
    "{N} ravens on the gatehouse roof at dusk. None of them is looking at you.",
    "The ravens are back. {N} of them, spaced along the wall as if somebody had measured.",
    "{N} ravens came in from the north as the light went. They did not circle. They knew where they were going.",
    "You count {n} ravens on the wall. You count again. A child has left bread out for them and they have not touched it.",
    "{N} ravens, and the dogs will not bark at them.",
    "Something lands on the wall behind you. Then another. {N}, when you turn round.",
    "{N} ravens sit on your wall in a row with a gap in it, as if they were keeping a place.",
  ],
  knows: [
    "{N} ravens on your wall at dusk, and not one of them making a sound. §7Sigrun said to count them, and then bar the gate.",
    "{N} ravens tonight. §7A voice for a voice, Sigrun said. You wonder whose.",
    "The ravens have come, {n} of them. §7They are not here for you. They are here for whoever is coming.",
    "{N} ravens on the wall, waiting for names nobody is going to give them. §7Bar the gate.",
    "{N} ravens at dusk. §7They have found the place the Host is going next, and it is yours again.",
    "You count {n} ravens before you mean to. §7It is a habit now. So is the gate.",
    "{N} ravens, patient as creditors. §7Tonight, then.",
    "{N} ravens, and the oldest of them has a ring of grey round one eye. §7It has been to every one of your sieges.",
  ],
};
const numberWord = (count) => (count === 3 ? "Three" : count < 13 ? ["Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"][count - 4] : `${count}`);
export function omenText(count, knows, pick = 0) {
  const pool = knows ? OMENS.knows : OMENS.plain;
  const N = numberWord(count);
  return "§8" + pool[Math.abs(Math.floor(pick)) % pool.length].replaceAll("{N}", N).replaceAll("{n}", N.toLowerCase());
}

// the siege raids feature knows which nights a siege comes; the old every-third-day rule is the fallback
function raidTonight() {
  try { return isSiegeNight(); } catch { return isRaidDay(world.getDay(), SETTINGS.siegeEveryNNights, SETTINGS.firstSiegeDay); }
}
const told = new Map(); // player id -> day
const lastOmen = new Map(); // player id -> which line they heard last
function show(player, force) {
  const keep = keepOf(player.id);
  if (!keep && !force) return;
  const day = world.getDay();
  if (!force && told.get(player.id) === day) return;
  told.set(player.id, day);
  const pick = pickGreet(OMENS.plain.length, lastOmen.get(player.id), Math.random());
  lastOmen.set(player.id, pick);
  player.sendMessage(omenText(ravenCount(keep?.wins), progressOf(player).flags.includes("heard_ravens"), pick));
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
    assert(OMENS.plain.length >= 8 && OMENS.knows.length === OMENS.plain.length, "a line heard every siege night needs a deep pool");
    for (const pool of Object.values(OMENS)) for (const line of pool) assert(/\{[Nn]\}/.test(line), line);
    for (let last = 0; last < 8; last++) for (const roll of [0, 0.3, 0.99]) assert(pickGreet(8, last, roll) !== last, "never the same omen twice running");
  },
});
