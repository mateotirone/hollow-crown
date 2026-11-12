// Letters by messenger: private messages between players that take a couple of minutes to arrive.
// Rules and numbers: rules.js.
//
//   /siege:messenger                       any player, no cheats: pick who, write, send
//   Keep menu → "Send a messenger"         the same
//   /scriptevent siege:letters_fast        (testing) every letter on the road arrives now
//
// While a letter is on the road its sender sees a small countdown in the action bar, refreshed every second.
// When it reaches zero the other player gets it in chat with a sound. If they are away, the messenger waits
// and hands it over when they next come into the world. Letters are saved, so a reload loses none.

import { world, system, CommandPermissionLevel, CustomCommandStatus } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { moduleStore } from "../core/store.js";
import { onTick } from "../core/loop.js";
import { emit } from "../core/events.js";
import { sfx } from "../core/sfx.js";
import { addKeepMenuButtons } from "../siege/api.js";
import { LETTERS, rideSeconds, cleanText, countdownLine, dueNow, clock } from "./rules.js";
import "./tests.js";

const store = moduleStore("siege:letters", () => ({ next: 1, letters: [], known: {} }));
// letters: [{ n, from, fromName, to, toName, text, sent, due }]   known: player id -> name, for writing to someone away

const OVERWORLD = "minecraft:overworld";
const spot = (p) => (p && p.dimension.id === OVERWORLD ? { x: p.location.x, z: p.location.z } : undefined);

function remember(player) {
  if (store.data.known[player.id] === player.name) return;
  store.data.known[player.id] = player.name;
  store.save();
}

// Show a form, waiting a moment if another screen (the chat, after a command) is still open
async function showWhenFree(player, form, tries = 8) {
  for (let i = 0; i < tries; i++) {
    const r = await form.show(player);
    if (!(r.canceled && r.cancelationReason === "UserBusy")) return r;
    await new Promise((res) => system.runTimeout(res, 10));
  }
  return { canceled: true };
}

export async function writeLetter(player) {
  remember(player);
  const here = new Set(world.getPlayers().map((p) => p.id));
  const people = Object.entries(store.data.known)
    .filter(([id]) => id !== player.id)
    .map(([id, name]) => ({ id, name, here: here.has(id) }))
    .sort((a, b) => Number(b.here) - Number(a.here) || a.name.localeCompare(b.name));
  if (!people.length) return player.sendMessage("§7There is nobody to send a messenger to yet. Anyone who has been in this world can get one.");
  const mine = store.data.letters.filter((l) => l.from === player.id);
  if (mine.length >= LETTERS.inFlight) return player.sendMessage(`§7You already have ${mine.length} messengers on the road. Wait for one to arrive.`);
  const form = new ModalFormData().title("Send a messenger")
    .dropdown("A messenger rides out with your letter. It takes a couple of minutes to arrive, longer the farther away they are.\n\nTo", people.map((p) => (p.here ? p.name : `${p.name} (away, gets it when back)`)))
    .textField(`Your letter (up to ${LETTERS.maxLength} letters)`, "Write here...");
  const r = await showWhenFree(player, form);
  if (r.canceled || !r.formValues) return;
  const to = people[Number(r.formValues[0])];
  const text = cleanText(r.formValues[1]);
  if (!to) return;
  if (!text) return player.sendMessage("§7The messenger waits, but there is nothing written. No letter sent.");
  send(player, to, text);
}

export function send(player, to, text) {
  const target = world.getPlayers().find((p) => p.id === to.id);
  const seconds = rideSeconds(spot(player), spot(target));
  const now = Date.now();
  const letter = { n: store.data.next++, from: player.id, fromName: player.name, to: to.id, toName: to.name, text, sent: now, due: now + seconds * 1000 };
  store.data.letters.push(letter);
  store.save();
  sfx(player, "mob.horse.gallop", { pitch: 1.1 });
  player.sendMessage(`§6A messenger rides out with your letter to ${to.name}.§7 About ${clock(seconds)} on the road${target ? "" : `; ${to.name} is away, so it will wait for them`}.`);
  emit("letterSent", { from: player.id, to: to.id, seconds });
}

function deliver(letter, target) {
  target.sendMessage(`§6A messenger hands you a letter from ${letter.fromName}:§f "${letter.text}"`);
  target.sendMessage("§8Reply with /siege:messenger");
  target.onScreenDisplay.setActionBar(`§6A letter from ${letter.fromName}`);
  sfx(target, "mob.horse.gallop", { pitch: 0.9 });
  system.runTimeout(() => { try { sfx(target, "random.orb", { pitch: 0.8 }); } catch { /* gone */ } }, 8);
  const sender = world.getPlayers().find((p) => p.id === letter.from);
  if (sender) sender.sendMessage(`§7Your letter has reached ${letter.toName}.`);
  emit("letterDelivered", { from: letter.from, to: letter.to });
}

// Every second: hand over what is due, and show each sender their countdown
onTick("letters", 20, () => {
  const letters = store.data.letters;
  if (!letters.length) return;
  const players = world.getPlayers();
  const byId = new Map(players.map((p) => [p.id, p]));
  const now = Date.now();
  const due = dueNow(letters, now, new Set(byId.keys()));
  if (due.length) {
    for (const l of due) {
      try { deliver(l, byId.get(l.to)); } catch { continue; }
      letters.splice(letters.indexOf(l), 1);
    }
    store.save();
  }
  for (const p of players) {
    const mine = letters.filter((l) => l.from === p.id && l.due > now);
    if (!mine.length) continue;
    try { p.onScreenDisplay.setActionBar(countdownLine(mine, now)); } catch { /* respawning */ }
  }
});

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => { if (initialSpawn) remember(player); });

addKeepMenuButtons(({ player }) => [{ label: "Send a messenger\n§8a private letter to another player", icon: "textures/items/paper", action: () => system.run(() => writeLetter(player).catch(() => {})) }]);

system.beforeEvents.startup.subscribe((e) => {
  const registry = e.customCommandRegistry;
  if (!registry?.registerCommand) return;
  registry.registerCommand(
    { name: "siege:messenger", description: "Send a private letter to another player by messenger", permissionLevel: CommandPermissionLevel.Any, cheatsRequired: false },
    (origin) => {
      const player = origin.sourceEntity;
      if (!player || player.typeId !== "minecraft:player") return { status: CustomCommandStatus.Failure, message: "Only a player can send a messenger." };
      system.run(() => writeLetter(player).catch(() => {}));
      return { status: CustomCommandStatus.Success };
    },
  );
});

system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (e.id !== "siege:letters_fast") return;
  for (const l of store.data.letters) l.due = Math.min(l.due, Date.now());
  store.save();
  e.sourceEntity?.sendMessage?.("§7Every messenger on the road arrives now.");
});
