// The minimap: a small north-up map in the top-right corner of the HUD with the player's arrow and
// the name of the place they are in. No Beta features: the map pictures are pre-painted from the
// generated world (tools/minimap_tiles.py) and the HUD (Siege_Nights_RP/ui/hud_screen.json, made by
// tools/minimap_ui.py) is told what to show through a hidden title that starts with "hcm:".
//
// Each player can hide it: /siege:minimap (any player, no cheats needed), or
// /scriptevent siege:minimap on|off|toggle.

import { world, system, ScreenDisplay, CommandPermissionLevel, CustomCommandStatus } from "@minecraft/server";
import { onTick } from "../core/loop.js";
import { KEY, hudString } from "./data.js";
import "./tests.js";

const OFF = "siege:minimap_off";
const OVERWORLD = "minecraft:overworld";
const EVERY = 4;           // ticks between position checks
const RESEND = 200;        // ticks: send the same title again now and then, in case the HUD was rebuilt

const lastSent = new Map();  // player id -> { text, at }
let busyAll = 0;             // a real title is on screen until this tick (for a player we could not tell)
const busyFor = new Map();   // player id -> tick

// Real titles from the rest of the add-on must not be cut short by the map's hidden ones, so note how
// long each one stays up and wait until it has gone before sending the map again.
try {
  const proto = ScreenDisplay?.prototype;
  const original = proto?.setTitle;
  if (typeof original === "function" && !original.hcMinimap) {
    const wrapped = function (title, options) {
      const text = typeof title === "string" ? title : "";
      if (!text.startsWith(KEY)) {
        const o = options ?? {};
        const until = system.currentTick + (o.fadeInDuration ?? 10) + (o.stayDuration ?? 70) + (o.fadeOutDuration ?? 20) + 2;
        const owner = world.getAllPlayers().find((p) => p.onScreenDisplay === this);
        if (owner) busyFor.set(owner.id, until);
        else busyAll = until;
      }
      return original.call(this, title, options);
    };
    wrapped.hcMinimap = true;
    proto.setTitle = wrapped;
  }
} catch {
  // the map then only risks cutting a title short; nothing else depends on this
}

const isOff = (player) => player.getDynamicProperty(OFF) === true;

function send(player, force = false) {
  const now = system.currentTick;
  if (now < busyAll || now < (busyFor.get(player.id) ?? 0)) return;
  const loc = player.location;
  const text = hudString({
    x: loc.x, z: loc.z, yaw: player.getRotation().y,
    charted: player.dimension.id === OVERWORLD, off: isOff(player),
  });
  const last = lastSent.get(player.id);
  if (!force && last && last.text === text && now - last.at < RESEND) return;
  player.onScreenDisplay.setTitle(text, { fadeInDuration: 0, stayDuration: 1, fadeOutDuration: 0 });
  lastSent.set(player.id, { text, at: now });
}

onTick("minimap", EVERY, () => {
  for (const player of world.getAllPlayers()) {
    try { send(player); } catch { /* a player mid-respawn or leaving */ }
  }
});

world.afterEvents.playerSpawn.subscribe(({ player }) => lastSent.delete(player.id));
world.afterEvents.playerLeave.subscribe(({ playerId }) => { lastSent.delete(playerId); busyFor.delete(playerId); });

export function setMinimap(player, on) {
  player.setDynamicProperty(OFF, on ? undefined : true);
  lastSent.delete(player.id);
  player.sendMessage(on ? "§7Minimap shown. §8/siege:minimap hides it." : "§7Minimap hidden. §8/siege:minimap shows it again.");
  send(player, true);
}

system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (e.id !== "siege:minimap") return;
  const player = e.sourceEntity;
  if (!player || player.typeId !== "minecraft:player") return;
  const arg = (e.message ?? "").trim().toLowerCase();
  setMinimap(player, arg === "on" ? true : arg === "off" ? false : isOff(player));
});

// A slash command any player can use on a Realm, cheats off.
system.beforeEvents.startup.subscribe((e) => {
  const registry = e.customCommandRegistry;
  if (!registry?.registerCommand) return;
  registry.registerCommand(
    { name: "siege:minimap", description: "Show or hide your minimap", permissionLevel: CommandPermissionLevel.Any, cheatsRequired: false },
    (origin) => {
      const player = origin.sourceEntity;
      if (!player || player.typeId !== "minecraft:player") return { status: CustomCommandStatus.Failure, message: "Only a player has a minimap." };
      system.run(() => { try { setMinimap(player, isOff(player)); } catch { /* left meanwhile */ } });
      return { status: CustomCommandStatus.Success };
    },
  );
});
