// Hidden HUD titles: the one way the script talks to the HUD's own panels (the minimap, the quest tracker).
// No Beta features: a title that starts with "hc<letter>:" is kept by its panel in Siege_Nights_RP/ui/hud_screen.json
// (the "preserve title" pattern, written by tools/minimap_ui.py) and never shown in the vanilla title box.
//
// Two rules keep the panels and real titles out of each other's way:
//   - a real title (anything else sent with setTitle) is left on screen until it has faded, and hidden titles
//     wait for it;
//   - at most one hidden title goes to a player every GAP ticks, so two panels updating at once can't drop one.
// Panels call sendHidden(player, text); the newest text per panel wins while it waits.

import { world, system, ScreenDisplay } from "@minecraft/server";
import { onTick } from "./loop.js";

export const HIDDEN = /^hc[a-z]:/;
export const isHidden = (text) => typeof text === "string" && HIDDEN.test(text);
const GAP = 2; // ticks between two hidden titles to the same player

let busyAll = 0; // a real title is on screen until this tick (for a player we could not tell)
const busyFor = new Map(); // player id -> tick
const queue = new Map(); // player id -> Map(panel key -> text), oldest panel first
const lastAt = new Map(); // player id -> tick of the last hidden title

// Note how long each real title stays up, so hidden ones don't cut it short.
try {
  const proto = ScreenDisplay?.prototype;
  const original = proto?.setTitle;
  if (typeof original === "function" && !original.hcHidden) {
    const wrapped = function (title, options) {
      if (!isHidden(title)) {
        const o = options ?? {};
        const until = system.currentTick + (o.fadeInDuration ?? 10) + (o.stayDuration ?? 70) + (o.fadeOutDuration ?? 20) + 2;
        const owner = world.getAllPlayers().find((p) => p.onScreenDisplay === this);
        if (owner) busyFor.set(owner.id, until);
        else busyAll = until;
      }
      return original.call(this, title, options);
    };
    wrapped.hcHidden = true;
    wrapped.hcMinimap = true; // older builds of the minimap looked for this mark
    proto.setTitle = wrapped;
  }
} catch {
  // hidden titles then only risk cutting a real one short; nothing else depends on this
}

export const titleBusy = (player) => {
  const now = system.currentTick;
  return now < busyAll || now < (busyFor.get(player.id) ?? 0);
};

export function sendHidden(player, text) {
  if (!isHidden(text)) return;
  const key = text.slice(0, 4);
  let mine = queue.get(player.id);
  if (!mine) queue.set(player.id, (mine = new Map()));
  mine.delete(key); // re-insert at the back, so panels take turns
  mine.set(key, text);
}

function flush() {
  if (!queue.size) return;
  const now = system.currentTick;
  for (const player of world.getAllPlayers()) {
    const mine = queue.get(player.id);
    if (!mine?.size || titleBusy(player) || now - (lastAt.get(player.id) ?? -99) < GAP) continue;
    const [key, text] = mine.entries().next().value;
    mine.delete(key);
    try {
      player.onScreenDisplay.setTitle(text, { fadeInDuration: 0, stayDuration: 1, fadeOutDuration: 0 });
      lastAt.set(player.id, now);
    } catch { /* mid-respawn or leaving */ }
  }
}
onTick("hudtitle", 1, flush);

world.afterEvents.playerLeave.subscribe(({ playerId }) => { queue.delete(playerId); busyFor.delete(playerId); lastAt.delete(playerId); });
