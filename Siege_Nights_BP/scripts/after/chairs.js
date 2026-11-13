// The Five Chairs (Act V, arc 1; Mateo picked it to build first, 2026-11-11).
// When Morvane falls the seat over the Hollow is empty, and the five houses that sat at the truce table
// all want it. Their lines are in data/houses.js, the arithmetic in rules.js.
//
//   The table      At the first dawn after the fall, everyone hears about the table with its chairs pulled out.
//   Standing       Each house has a standing 0-10. The highest holds the seat.
//   The seat       The seat house sets the temper of the NPC Regent (undertow/regent.js) and gives its
//                  backers a free mining permit from that Regent.
//   Champions      Every Pretender (bestiary/pretenders.js) now rises for a house. Put it down and its house
//                  loses standing, and the houses its killers back gain. Let it sit and its house gains.
//   Envoys         On every third night one house sends an envoy to a player in the overworld. On a Guest Night
//                  (the truce holds) they come by right; otherwise they come anyway. Talk to them to back
//                  their house. One house per player; switching costs the old house a little standing.
//   The board      "The Five Chairs" on the keep menu shows every house, its standing and who you back.
//
// Hooks given:   filter "pretenderHouse"   (undefined, { pretender }) -> { house, title }
//                filter "regentTemper"     (temper) -> the seat house's temper once Morvane has fallen
//                filter "regentFreePermit" (false, { playerId }) -> true if they back the seat house
// Event read:    "truceChanged" { state }   from the truce (lore/truce.js, PR #99): "none" | "kept" | "broken".
//                Heard rather than imported, so this folder loads with or without the truce.
// Events out:    "houseSeat" { house, before }    "houseBacked" { player, house, before }
// Test (creative): /scriptevent siege:chairs                  status
//                  /scriptevent siege:chairs_envoy [house]    an envoy appears beside you
//                  /scriptevent siege:chairs_table            the morning-after words again
//                  /scriptevent siege:chairs_stand <house> <0-10>

import { world, system, GameMode } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { onTick, moduleStore, emit, on, addFilter, addKeepMenuButtons, isNight, SETTINGS } from "../siege/api.js";
import { bestiaryStore } from "../bestiary/bossCore.js";
import { setRegentTemper, regentData } from "../undertow/regent.js";
import { sfx } from "../core/sfx.js";
import { dressNpc, addNpcLook } from "../core/npc_skins.js";
import { HOUSES, TABLE_SCENE, BOARD_INTRO } from "./data/houses.js";
import { AFTER, HOUSE_IDS, houseOf, startStandings, seatOf, houseForPretender, afterFall, afterSat, afterSwitch, envoyHouse, freshLine, isThirdNight } from "./rules.js";

const ENVOY_TYPE = "minecraft:npc";
const ENVOY_TAG = "siege_after_envoy";
const houseTag = (id) => `siege_after_house_${id}`;

export const chairs = moduleStore("siege:after_chairs", () => ({
  standing: undefined, seat: undefined, backing: {}, envoys: [], envoyNight: -1, tableSeen: false, lastChampion: undefined, said: {}, truce: "none",
}));

const today = () => { try { return world.getDay(); } catch { return 0; } };
export const morvaneFallen = () => (bestiaryStore.data.defeated?.morvane ?? 0) > 0;
export const truceState = () => chairs.data.truce ?? "none";
on("truceChanged", ({ state }) => { chairs.data.truce = state; chairs.save(); });
const everyone = (text) => { for (const p of world.getPlayers()) p.sendMessage(text); };

function standing() {
  const d = chairs.data;
  if (!d.standing) {
    d.standing = startStandings(HOUSE_IDS.map(() => Math.random()));
    d.seat = seatOf(d.standing);
    chairs.save();
  }
  return d.standing;
}
export const seatHouse = () => (standing(), chairs.data.seat);
export const backingOf = (playerId) => chairs.data.backing[playerId];

// A line from one of a house's pools, never the same wording twice running for that pool.
function line(house, pool) {
  const d = chairs.data, list = houseOf(house).lines[pool], key = `${house}/${pool}`;
  const i = freshLine(list, d.said[key], Math.random());
  d.said[key] = i;
  return list[i];
}

// Standings moved: save, and if the seat changed hands, tell everyone and the Regent.
function setStanding(next) {
  const d = chairs.data, before = d.seat;
  d.standing = next;
  d.seat = seatOf(next, before);
  chairs.save();
  if (d.seat === before) return;
  const lost = houseOf(before), won = houseOf(d.seat);
  if (lost) everyone(`§8${lost.lines.seatLost}`);
  everyone(`${won.color}${won.lines.seatGained}`);
  for (const p of world.getPlayers()) sfx(p, "block.bell.hit", { volume: 0.4, pitch: 0.5 });
  try { if (regentData().active) setRegentTemper(won.temper, `${won.name} has the ear of the Hollow Crown now.`); } catch { /* no Regent feature */ }
  emit("houseSeat", { house: d.seat, before });
}

// ---------- hooks for the Pretenders and the Regent ----------
addFilter("pretenderHouse", () => {
  if (!morvaneFallen()) return undefined;
  const d = chairs.data, s = standing();
  const house = houseForPretender(s, d.seat, d.lastChampion, Math.random());
  d.lastChampion = house;
  chairs.save();
  const h = houseOf(house);
  return { house, title: `champion of ${h.name}`, line: h.lines.champion };
});
addFilter("regentTemper", (temper) => (morvaneFallen() ? houseOf(seatHouse())?.temper ?? temper : temper));
addFilter("regentFreePermit", (free, { playerId }) => free || (morvaneFallen() && !!playerId && backingOf(playerId) === seatHouse()));

// What the Pretenders feature tells everyone
system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (e.id !== "siege:pretender_fallen" && e.id !== "siege:pretender_marching") return;
  let data;
  try { data = JSON.parse(e.message); } catch { return; }
  if (!data.house || !houseOf(data.house)) return;
  if (e.id === "siege:pretender_fallen") {
    const backed = (data.players ?? []).map((id) => backingOf(id)).filter(Boolean);
    setStanding(afterFall(standing(), data.house, backed));
    const helped = [...new Set(backed)].filter((id) => id !== data.house).map((id) => houseOf(id).name);
    everyone(`§8${houseOf(data.house).name} loses ground below.${helped.length ? ` ${helped.join(" and ")} gain${helped.length === 1 ? "s" : ""} it.` : ""}`);
  } else {
    setStanding(afterSat(standing(), data.house));
    everyone(`§8Nobody has challenged ${houseOf(data.house).name}'s champion. The house grows bolder.`);
  }
});

// ---------- envoys ----------
// each house sends its envoys in its own colours
addNpcLook((e) => {
  if (!e.hasTag(ENVOY_TAG)) return undefined;
  const id = HOUSE_IDS.find((h) => e.hasTag(houseTag(h)));
  return id ? `envoy_${id}` : undefined;
});
function spawnEnvoy(player, houseId) {
  const h = houseOf(houseId);
  const v = player.getViewDirection(), l = player.location;
  const at = { x: l.x + v.x * 5, y: l.y, z: l.z + v.z * 5 };
  const e = player.dimension.spawnEntity(ENVOY_TYPE, at);
  e.addTag(ENVOY_TAG);
  e.addTag(houseTag(houseId));
  dressNpc(e, `envoy_${houseId}`);
  const name = h.envoys[Math.floor(Math.random() * h.envoys.length)];
  e.nameTag = `${h.color}${name}\n§7${h.name}`;
  e.setDynamicProperty("siege:after_envoy", JSON.stringify({ house: houseId, name, day: today() }));
  try { player.dimension.spawnParticle("minecraft:soul_particle", { x: at.x, y: at.y + 1, z: at.z }); } catch { /* cosmetic */ }
  return e;
}

function envoyNight() {
  const d = chairs.data, day = today();
  if (d.envoyNight === day || !isThirdNight(day, SETTINGS.siegeEveryNNights) || !isNight()) return;
  const above = world.getPlayers().filter((p) => p.dimension.id === "minecraft:overworld");
  if (!above.length) return;
  const player = above[Math.floor(Math.random() * above.length)];
  const house = envoyHouse(d.envoys, Math.random());
  d.envoyNight = day;
  d.envoys = [...d.envoys, house].slice(-6);
  chairs.save();
  try { spawnEnvoy(player, house); } catch { return; }
  const h = houseOf(house), guest = truceState() === "kept";
  player.sendMessage(guest
    ? `§7Someone has come up through the dark as a guest, by the old right. They are waiting for you: ${h.color}an envoy of ${h.name}§7.`
    : `§7Someone has come up out of the dark without anyone's leave. They stand at the edge of your torchlight and wait: ${h.color}an envoy of ${h.name}§7.`);
  sfx(player, "block.bell.hit", { volume: 0.3, pitch: 0.4 });
}

const envoyOf = (e) => { try { return JSON.parse(e.getDynamicProperty("siege:after_envoy")); } catch { return undefined; } };
const allEnvoys = () => { try { return world.getDimension("overworld").getEntities({ tags: [ENVOY_TAG] }); } catch { return []; } };
function dismiss(e, words) {
  try {
    if (words) for (const p of e.dimension.getPlayers({ location: e.location, maxDistance: 24 })) p.sendMessage(words);
    e.dimension.spawnParticle("minecraft:soul_particle", { x: e.location.x, y: e.location.y + 1, z: e.location.z });
    e.remove();
  } catch { /* gone */ }
}

world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
  if (ev.target.typeId !== ENVOY_TYPE || !ev.target.hasTag(ENVOY_TAG)) return;
  if (ev.player.isSneaking && ev.player.getGameMode() === GameMode.Creative) return; // builders may still edit it
  ev.cancel = true;
  const p = ev.player, e = ev.target;
  system.run(() => audience(p, e));
});

function audience(p, e) {
  const info = envoyOf(e);
  if (!info) return;
  const h = houseOf(info.house), mine = backingOf(p.id), guest = truceState() === "kept";
  const body = [
    `${h.color}"${line(h.id, guest ? "guest" : "unbidden")}"`,
    "",
    `§f"${line(h.id, "pitch")}"`,
    "",
    `§7${h.name}, ${h.style}. Their seat is ${h.seat}.`,
    `§7They want: ${h.wants}`,
    mine ? `§8You back ${houseOf(mine).name}.` : "§8You back no house.",
  ].join("\n");
  const form = new ActionFormData().title(`${info.name}`).body(body);
  const acts = [];
  if (mine !== h.id) { form.button(`Back ${h.name}`); acts.push(() => back(p, h.id, e)); }
  form.button("What did your house say at the truce table?"); acts.push(() => p.sendMessage(`${h.color}${info.name}:§f "${h.table}"`));
  form.button("The Five Chairs"); acts.push(() => board(p));
  form.button("Send them away"); acts.push(() => dismiss(e, `${h.color}${info.name}:§f "${line(h.id, "refused")}"`));
  form.show(p).then((r) => { if (!r.canceled && r.selection !== undefined) acts[r.selection]?.(); }).catch(() => {});
}

function back(p, houseId, envoy) {
  const d = chairs.data, before = d.backing[p.id];
  d.backing[p.id] = houseId;
  chairs.save();
  setStanding(afterSwitch(standing(), before, houseId));
  const h = houseOf(houseId);
  p.sendMessage(`${h.color}"${line(houseId, "backed")}"`);
  if (before && before !== houseId) p.sendMessage(`§8${houseOf(before).name} will remember that you left them.`);
  if (houseId === seatHouse()) p.sendMessage("§7Their house holds the seat: whoever wears the Hollow Crown will let you mine Choir ore without a permit.");
  sfx(p, "block.bell.hit", { volume: 0.5, pitch: 0.8 });
  emit("houseBacked", { player: p.id, house: houseId, before });
  if (envoy) system.runTimeout(() => dismiss(envoy), 60);
}

// ---------- the board ----------
const bar = (n) => `§a${"■".repeat(n)}§8${"■".repeat(AFTER.standingMax - n)}`;
export function board(p) {
  const s = standing(), seat = seatHouse(), mine = backingOf(p.id);
  const lines = [...BOARD_INTRO, ""];
  for (const h of HOUSES) {
    lines.push(`${h.color}${h.name}§7, ${h.style}${h.id === seat ? " §6(holds the seat)" : ""}${h.id === mine ? " §b(you back them)" : ""}`);
    lines.push(`${bar(s[h.id])}`);
    lines.push(`§8${h.wants}`);
    lines.push("");
  }
  lines.push(mine ? `§7You back ${houseOf(mine).name}.` : "§7You back no house. An envoy comes up on every third night.");
  const truce = truceState();
  if (truce === "kept") lines.push("§7The truce holds: envoys come as guests.");
  else if (truce === "broken") lines.push("§7The truce is broken: envoys come without leave.");
  new ActionFormData().title("The Five Chairs").body(lines.join("\n")).button("Close").show(p).catch(() => {});
}
addKeepMenuButtons(({ player }) => (morvaneFallen() ? [{ label: "The Five Chairs", icon: "textures/items/name_tag", action: () => board(player) }] : []));

// ---------- the loop ----------
function tableScene() {
  for (const t of TABLE_SCENE) everyone(t);
  for (const p of world.getPlayers()) sfx(p, "block.bell.hit", { volume: 0.5, pitch: 0.35 });
}

onTick("after:chairs", 100, () => {
  if (!morvaneFallen()) return;
  const d = chairs.data;
  if (!d.tableSeen && !isNight() && world.getPlayers().length) {
    d.tableSeen = true;
    standing();
    chairs.save();
    tableScene();
  }
  envoyNight();
  // Envoys leave at dawn.
  if (!isNight()) for (const e of allEnvoys()) dismiss(e, "§8The envoy is gone with the dark.");
});

// ---------- tests and tools ----------
system.afterEvents.scriptEventReceive.subscribe((e) => {
  const p = e.sourceEntity;
  if (!e.id.startsWith("siege:chairs") || p?.typeId !== "minecraft:player") return;
  if (p.getGameMode() !== GameMode.Creative) return p.sendMessage("§7Creative only.");
  const arg = e.message.trim().split(/\s+/).filter(Boolean);
  if (e.id === "siege:chairs") {
    const s = standing();
    p.sendMessage(`§6The Five Chairs:§7 seat ${houseOf(seatHouse()).name}. ${HOUSE_IDS.map((id) => `${id} ${s[id]}`).join(", ")}. Truce: ${truceState()}. Morvane ${morvaneFallen() ? "fallen" : "standing (nothing happens until he falls)"}.`);
  } else if (e.id === "siege:chairs_envoy") {
    const id = houseOf(arg[0]) ? arg[0] : envoyHouse(chairs.data.envoys, Math.random());
    spawnEnvoy(p, id);
  } else if (e.id === "siege:chairs_table") {
    tableScene();
  } else if (e.id === "siege:chairs_stand") {
    if (!houseOf(arg[0])) return p.sendMessage(`§7Houses: ${HOUSE_IDS.join(", ")}`);
    setStanding({ ...standing(), [arg[0]]: Math.max(0, Math.min(10, Number(arg[1]) || 0)) });
    p.sendMessage(`§7${houseOf(arg[0]).name} now ${chairs.data.standing[arg[0]]}. Seat: ${houseOf(seatHouse()).name}.`);
  }
});

on("showcase", ({ player }) => {
  player.sendMessage("§6Act V, the Five Chairs:§7 /scriptevent siege:chairs_envoy [bell|salt|lamp|root|tide] puts an envoy beside you. /scriptevent siege:chairs shows the standings. Strangers coming home: /scriptevent siege:homecoming_now");
});
