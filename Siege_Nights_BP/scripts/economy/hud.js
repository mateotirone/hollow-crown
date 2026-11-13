// Your Regal balance on the HUD, always up (Mateo 2026-11-13: "your regal balance has to show on the screen").
// A small Regal coin and the number, just right of the hotbar. It follows the balance live: every POLL ticks the
// number is read again and sent when it changed (shops, rewards, upkeep, a robbed Regal Safe, coins picked up).
//
// The panel is in Siege_Nights_RP/ui/hud_screen.json (made by tools/minimap_ui.py) and is fed by hidden titles that
// start with "hcr:" (core/hudtitle.js), like the minimap and the quest tracker:
//     hcr:  SS  text      SS "_s" shown, "_h" hidden; text the coloured number, never all digits (JSON UI would
//                         turn it into a number), so it always starts with a colour code.

import { world, system } from "@minecraft/server";
import { onTick } from "../core/loop.js";
import { sendHidden, titleBusy } from "../core/hudtitle.js";
import { addTests, assert, assertEqual } from "../core/tests.js";
import { carried } from "./coins.js";

export const KEY = "hcr:";
export const SPOT = { shown: "_s", hidden: "_h" };
const POLL = 10; // ticks between looks at each balance
const RESEND = 200; // ticks: send the same number again now and then, in case the HUD was rebuilt

// 1234567 -> "1,234,567"
export const grouped = (n) => {
  const s = String(Math.max(0, Math.floor(Number(n) || 0)));
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};
export const hudString = (balance) => KEY + SPOT.shown + "§6" + grouped(balance);
export function readHud(s) {
  if (typeof s !== "string" || !s.startsWith(KEY)) return undefined;
  const rest = s.slice(KEY.length);
  return { spot: rest.slice(0, 2), text: rest.slice(2) };
}

const lastSent = new Map(); // player id -> { text, at }

function send(player, force = false) {
  if (titleBusy(player)) return;
  const now = system.currentTick;
  const text = hudString(carried(player));
  const last = lastSent.get(player.id);
  if (!force && last && last.text === text && now - last.at < RESEND) return;
  sendHidden(player, text);
  lastSent.set(player.id, { text, at: now });
}

onTick("regals_hud", POLL, () => {
  for (const player of world.getAllPlayers()) {
    try { send(player); } catch { /* a player mid-respawn or leaving */ }
  }
});

world.afterEvents.playerSpawn.subscribe(({ player }) => lastSent.delete(player.id));
world.afterEvents.playerDimensionChange?.subscribe?.(({ player }) => lastSent.delete(player.id));
world.afterEvents.playerLeave.subscribe(({ playerId }) => lastSent.delete(playerId));

addTests("regals_hud", {
  "the balance reads with commas and is never all digits": () => {
    assertEqual(grouped(0), "0");
    assertEqual(grouped(999), "999");
    assertEqual(grouped(1234567), "1,234,567");
    assertEqual(grouped(-5), "0");
    const hud = readHud(hudString(1234));
    assertEqual(hud.spot, SPOT.shown);
    assert(/\D/.test(hud.text) && hud.text.endsWith("1,234"), "the text carries a colour code and the number");
    assert(!hud.text.includes("_s") && !hud.text.includes("_h") && !hud.text.includes(KEY), "the text never carries a marker");
  },
});
