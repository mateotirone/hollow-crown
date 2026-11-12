// The Barracks training menu (Mateo, 2026-11-12).
//
// Click your Barracks, "Train soldiers": a row per soldier type you have unlocked, with how many of your soldiers
// there are, your cap and the price each. Slide how many of each you want, see the total, press Train. They come
// out of the Barracks one after another (a short training time each). A fallen soldier retrains for half his price
// (siege/guards.js asks the "retrainFee" filter). "Upgrade the Barracks" (levels 1-5) takes 8% off every price per
// level and trains faster. Types whose creature isn't in the game yet (the art thread makes them) are listed as
// coming; siege crews are trained at the Siege Workshop once their engines can be crewed.
//
//   /scriptevent siege:army_status    your Barracks level, the training queue and the prices

import { world, system, EntityTypes } from "@minecraft/server";
import { ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { isReady, onTick, moduleStore, keepOf, tierOf, emit } from "../siege/api.js";
import { addFilter } from "../core/events.js";
import { enlist, guardCount, guardLimit } from "../siege/guards.js";
import { state, saveState } from "../siege/state.js";
import { charge } from "../economy/coins.js";
import { coins } from "../economy/rules.js";
import { SOLDIERS, SOLDIER, unlocked, priceOf, retrainOf, trainTicks, upgradeCost, bill, BARRACKS } from "./roster.js";
import "./idle.js";
import { armouryMenu, dressForType } from "./armoury.js";
import "./tests.js";

const store = moduleStore("siege:army", () => ({ barracks: {}, queue: {} }));
const S = () => store.data;
const OVERWORLD = "minecraft:overworld";
const say = (player, text) => { try { player?.sendMessage(text); } catch { /* left */ } };

export const barracksLevel = (owner) => S().barracks[owner]?.level ?? 1;
const tierName = (owner) => { const k = keepOf(owner); return k ? tierOf(k).name : "Hamlet"; };
const exists = (id) => { try { return !!EntityTypes.get(id); } catch { return false; } };
const queued = (owner) => S().queue[owner] ?? [];
const queuedSlots = (owner) => queued(owner).reduce((n, q) => n + (SOLDIER[q.type]?.slots ?? 1), 0);
const freeSlots = (owner) => Math.max(0, guardLimit(owner) - guardCount(owner) - queuedSlots(owner));

// Retraining a fallen soldier costs half his price at your Barracks level
addFilter("retrainFee", (fee, { owner, type }) => (SOLDIER[type] ? retrainOf(SOLDIER[type], barracksLevel(owner)) : fee));

function countOf(owner, type) {
  try { return world.getDimension(OVERWORLD).getEntities({ type, tags: [`siege_guard_of_${owner}`] }).length; } catch { return 0; }
}

async function trainMenu(player, block) {
  const owner = player.id, level = barracksLevel(owner), tier = tierName(owner);
  S().barracks[owner] = { ...(S().barracks[owner] ?? {}), level, at: { ...block.location } };
  store.save();
  const free = freeSlots(owner);
  const rows = SOLDIERS.filter((s) => s.at === "barracks");
  const ready = rows.filter((s) => unlocked(s, tier) && exists(s.id));
  const later = rows.filter((s) => !ready.includes(s));
  const form = new ModalFormData().title(`Barracks (level ${level})`);
  form.label?.(`Soldiers: ${guardCount(owner)}/${guardLimit(owner)}${queued(owner).length ? `, ${queued(owner).length} in training` : ""}.  Room for ${free} more.`);
  const sliders = [];
  for (const s of ready) {
    const room = Math.floor(free / s.slots);
    const text = `${s.name}  §7(${countOf(owner, s.id)} here)  ${coins(priceOf(s, level))} each${s.slots > 1 ? `, takes ${s.slots} places` : ""}`;
    if (room < 1) { form.label?.(`${text}\n§cNo room: grow your settlement or lose a soldier first.`); continue; }
    form.slider(text, 0, room, { valueStep: 1, defaultValue: 0 });
    sliders.push(s);
  }
  if (later.length) form.label?.(`§7Later: ${later.map((s) => `${s.name} (${exists(s.id) ? s.unlock : "coming"})`).join(", ")}`);
  if (!sliders.length) return say(player, `§7You have no room for more soldiers (${guardCount(owner)}/${guardLimit(owner)}).`);
  form.submitButton?.("See the price");
  const res = await form.show(player);
  if (res.canceled) return;
  // formValues holds one value per element (labels included, as undefined): take the numbers in order
  const values = (res.formValues ?? []).filter((v) => typeof v === "number");
  const order = {};
  sliders.forEach((s, n) => { const c = Math.floor(values[n] ?? 0); if (c > 0) order[s.id] = c; });
  const { total, slots } = bill(order, level);
  if (!slots) return;
  if (slots > freeSlots(owner)) return say(player, "§cThat's more than you have room for.");
  const lines = Object.entries(order).map(([id, n]) => `${n} ${SOLDIER[id].name}  §7${coins(priceOf(SOLDIER[id], level) * n)}§r`);
  const confirm = await new MessageFormData().title("Train soldiers")
    .body(`${lines.join("\n")}\n\nTotal: §6${coins(total)}§r\nThey come out one after another, ${trainTicks(level) / 20} seconds each.`)
    .button1("Back").button2(`Train (${coins(total)})`).show(player);
  if (confirm.canceled || confirm.selection !== 1) return;
  if (!charge(player, total, "train")) return say(player, `§cTraining these costs ${coins(total)}.`);
  const q = (S().queue[owner] ??= []);
  let at = Math.max(system.currentTick, ...q.map((e) => e.ready));
  for (const [id, n] of Object.entries(order)) for (let k = 0; k < n; k++) { at += trainTicks(level); q.push({ type: id, ready: at }); }
  store.save();
  say(player, `§6Training ${Object.values(order).reduce((a, b) => a + b, 0)} soldiers for ${coins(total)}. The first is out in ${trainTicks(level) / 20} seconds.`);
}

async function upgradeMenu(player) {
  const owner = player.id, level = barracksLevel(owner), cost = upgradeCost(level);
  if (cost === undefined) return say(player, "§7Your Barracks are as good as they get.");
  const res = await new MessageFormData().title("Upgrade the Barracks")
    .body(`Level ${level} to ${level + 1}: ${coins(cost)}.\n\nEvery soldier's price and retraining cost drops by ${Math.round(BARRACKS.discount * 100)}% more, and training is faster.`)
    .button1("Not now").button2(`Upgrade (${coins(cost)})`).show(player);
  if (res.canceled || res.selection !== 1) return;
  if (!charge(player, cost, "barracks")) return say(player, `§cThe upgrade costs ${coins(cost)}.`);
  S().barracks[owner] = { ...(S().barracks[owner] ?? {}), level: level + 1 };
  store.save();
  say(player, `§6Your Barracks are now level ${level + 1}.`);
  emit("barracksUpgraded", { owner, level: level + 1 });
}

addFilter("barracksButtons", (buttons, { player }) => [
  { label: `Train soldiers\n§8${guardCount(player.id)}/${guardLimit(player.id)}`, icon: "textures/items/siege_man_at_arms", run: (p, block) => trainMenu(p, block).catch((e) => console.warn(`[Hollow Crown] train: ${e}`)) },
  { label: `Upgrade the Barracks\n§8level ${barracksLevel(player.id)}`, icon: "textures/items/iron_sword", run: (p) => upgradeMenu(p).catch(() => {}) },
  { label: "Armoury\n§8upgrade a whole type", icon: "textures/items/iron_chestplate", run: (p) => armouryMenu(p).catch((e) => console.warn(`[Hollow Crown] armoury: ${e}`)) },
  ...buttons,
]);

// Trained soldiers step out of the Barracks
onTick("army-train", 20, () => {
  if (!isReady()) return;
  const now = system.currentTick;
  for (const [owner, q] of Object.entries(S().queue)) {
    if (!q.length) continue;
    const at = S().barracks[owner]?.at;
    if (!at || !state.keeps[owner]) { delete S().queue[owner]; store.save(); continue; }
    // a restarted world resets the tick count: anything due "far in the future" is due now
    while (q.length && (q[0].ready <= now || q[0].ready - now > 20 * 600)) {
      const order = q[0];
      try {
        const guard = world.getDimension(OVERWORLD).spawnEntity(order.type, { x: at.x + 0.5, y: at.y + 1, z: at.z + 0.5 });
        enlist(guard, owner, at);
        guard.setDynamicProperty("siege:barracks", JSON.stringify(at));
        dressForType(guard, owner);
        state.guards[owner] = guardCount(owner) + 1;
        saveState();
        q.shift();
        store.save();
        world.getPlayers().find((p) => p.id === owner)?.onScreenDisplay.setActionBar(`§6A ${SOLDIER[order.type]?.name ?? "soldier"} has finished training.`);
        emit("soldierTrained", { owner, type: order.type });
      } catch {
        break; // the Barracks isn't loaded: they wait inside
      }
    }
  }
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || event.id !== "siege:army_status") return;
  const owner = player.id, level = barracksLevel(owner);
  say(player, [`§6Barracks level ${level}§7, soldiers ${guardCount(owner)}/${guardLimit(owner)}, ${queued(owner).length} in training.`,
    ...SOLDIERS.map((s) => `${s.name}: ${coins(priceOf(s, level))} (retrain ${coins(retrainOf(s, level))}), ${s.unlock}${exists(s.id) ? "" : ", not in the game yet"}`)].join("\n"));
});
