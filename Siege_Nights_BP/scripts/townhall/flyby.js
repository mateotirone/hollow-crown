// The upgrade fly-by: when a hall or a settlement wall is rebuilt, the camera lifts off and circles
// the work while it rises, then returns. Sneak to skip.
//
// Other features can use it:   flyby(player, { center, radius, height, seconds, title })
//
// Settlement walls are upgraded from the Town Hall menu. The feature that owns the walls answers two events:
//   on("wallInfo", (q) => ...)     q = { owner, player }. Fill in: q.level, q.max, q.name, and if there is a
//                                  next level q.next = { level, name, cost, blocked?: "why not yet" }
//                                  cost is either text, or a list like HALL_COSTS: [[label, amount, match(typeId)], ...],
//                                  in which case the town hall checks and takes the payment itself.
//                                  then set q.handled = true.
//   on("wallUpgrade", (q) => ...)  q = { owner, player, level, paid }. Start rebuilding (take the cost yourself if it was text), then set
//                                  q.handled = true and q.center = {x,y,z}, q.radius, q.seconds (how long it rises);
//                                  or set q.refused = "why not".
//   q.repair = true in wallInfo adds a "Mend the wall" button, which sends emit("wallRepair", { owner, player }).
// The town hall then flies the camera round the wall. "wallUpgraded" ({ owner, level }) is theirs to emit when done.

import { system } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import * as api from "../siege/api.js";
import { countMatching, takeMatching } from "./townhall.js";

const costText = (cost) => (Array.isArray(cost) ? cost.map(([label, amount]) => `${amount} ${label}`).join(", ") : cost ?? "nothing");

// Pure: camera stops on a rising circle round a centre. Each is { pos, look }.
export function orbit(center, radius, height, stops = 8, startAngle = 0, sweep = Math.PI * 1.5) {
  const out = [];
  for (let i = 0; i <= stops; i++) {
    const a = startAngle + (sweep * i) / stops, lift = height * (0.6 + (0.4 * i) / stops);
    out.push({
      pos: { x: center.x + Math.cos(a) * radius, y: center.y + lift, z: center.z + Math.sin(a) * radius },
      look: { x: center.x, y: center.y + height * 0.3, z: center.z },
    });
  }
  return out;
}

const flying = new Map(); // player id -> run id

export function stopFlyby(player) {
  if (!flying.has(player.id)) return;
  flying.delete(player.id);
  try { player.camera.clear(); } catch { /* left the game */ }
}

export function flyby(player, { center, radius = 24, height = 18, seconds = 12, title } = {}) {
  if (!player || !center) return false;
  stopFlyby(player);
  const stops = orbit(center, radius, height, 8, Math.atan2(player.location.z - center.z, player.location.x - center.x));
  const leg = Math.max(10, Math.round((seconds * 20) / (stops.length - 1)));
  const run = system.currentTick;
  flying.set(player.id, run);
  const go = (i) => {
    if (flying.get(player.id) !== run) return;
    let ok = true;
    try { ok = player.isValid !== false && !player.isSneaking; } catch { ok = false; }
    if (!ok || i >= stops.length) return stopFlyby(player);
    try {
      player.camera.setCamera("minecraft:free", { location: stops[i].pos, facingLocation: stops[i].look, ...(i ? { easeOptions: { easeTime: leg / 20, easeType: "Linear" } } : {}) });
    } catch { return stopFlyby(player); }
    system.runTimeout(() => go(i + 1), i ? leg : 2);
  };
  try { if (title) player.onScreenDisplay.setTitle(title, { fadeInDuration: 10, stayDuration: 50, fadeOutDuration: 20, subtitle: "§7sneak to return" }); } catch { /* fine */ }
  go(0);
  return true;
}

// ---------- settlement wall, upgraded from the Town Hall ----------

export function wallMenu(player, owner) {
  const q = { owner, player };
  api.emit("wallInfo", q);
  if (!q.handled) return player.sendMessage("§7The masons have not surveyed a wall for this settlement yet.");
  const form = new ActionFormData().title("Settlement wall");
  const lines = [`§fYour wall: §6${q.name ?? "Level " + q.level}§7 (level ${q.level} of ${q.max})`];
  if (q.next) {
    lines.push("", `§fNext: §6${q.next.name ?? "Level " + q.next.level}`, `§7Cost: §f${costText(q.next.cost)}`);
    if (q.next.blocked) lines.push(`§c${q.next.blocked}`);
  } else lines.push("", "§7It can rise no higher.");
  form.body(lines.join("\n"));
  const canBuy = q.next && !q.next.blocked;
  const actions = [];
  if (canBuy) { form.button("Raise the wall", "textures/items/iron_pickaxe"); actions.push("raise"); }
  if (q.repair) { form.button("Mend the wall\n§8the masons survey it and name a price", "textures/items/brick"); actions.push("mend"); }
  form.button("Close");
  form.show(player).then((r) => {
    if (r.canceled) return;
    if (actions[r.selection] === "mend") return void api.emit("wallRepair", { owner, player });
    if (actions[r.selection] !== "raise") return;
    new MessageFormData().title("Raise the wall").body(`Rebuild your wall as §6${q.next.name ?? "level " + q.next.level}§r for ${costText(q.next.cost)}?`).button1("Not now").button2("Raise it")
      .show(player).then((c) => {
        if (c.canceled || c.selection !== 1) return;
        const list = Array.isArray(q.next.cost) ? q.next.cost : [];
        for (const [label, amount, match] of list) if (countMatching(player, match) < amount) return player.sendMessage(`§cYou need ${amount} ${label}.`);
        const up = { owner, player, level: q.next.level, paid: list.length > 0 };
        api.emit("wallUpgrade", up);
        if (!up.handled) return player.sendMessage(`§c${up.refused ?? "The wall could not be raised."}`);
        for (const [, amount, match] of list) takeMatching(player, match, amount);
        if (up.center) flyby(player, { center: up.center, radius: (up.radius ?? 24) + 14, height: 22, seconds: Math.min(30, up.seconds ?? 14), title: `§6${q.next.name ?? "The wall"} rises` });
      }).catch(() => {});
  }).catch(() => {});
}

api.addTests("flyby", {
  "the camera circles the work and climbs": () => {
    const stops = orbit({ x: 0, y: 64, z: 0 }, 20, 10, 8);
    api.assertEqual(stops.length, 9);
    api.assert(Math.abs(Math.hypot(stops[3].pos.x, stops[3].pos.z) - 20) < 0.01, "stays on the circle");
    api.assert(stops[8].pos.y > stops[0].pos.y, "climbs");
    api.assertEqual(stops[0].look, { x: 0, y: 67, z: 0 });
  },
});
