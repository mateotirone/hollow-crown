// Rival Lords (The Hollow Crown): NPC lords who hold plots nobody claimed, so the world has
// neighbours, rivals and someone to besiege even in single-player. Nothing here needs a second player.
//
// Each lord has a name, region, role ("knight" or "marked"), temperament, and a settlement that
// climbs the same tiers players do. Their growth is simulated on siege nights. Their town is laid out from
// the same town layouts players get (settle/founding.js: roads, wall rings, plots), their hall rises on its
// cornerstone, and their plots fill by the same plot and charter rules (settle/charters.js lordPick), raised
// while a player is near. A player who takes the plot takes the town as it stands. Lords from older worlds
// that already built on the old fixed layout carry on with it. Numbers: data.js.
//
// What other features can use:
//   rivalLords()                      every living lord: { id, plot, region, x, y, z, name, role, temperament, tier, wins, held, relations, voice? }
//                                     voice = id of the lore feature's written lord (lore/data/lords.js), when it has one
//   rivalById(id)   rivalOnPlot(plotName)   rivalAt(location)   strongestRival(role?)
//   relationOf(lord, playerId)        -100..100, 0 to start;  changeRelation(lord, playerId, by)
//   on("rivalSettled", ({ lord, known }))   known = true when it is a reminder at world load, not a new arrival
//   on("rivalRose", ({ lord, tier }))
//   on("rivalBesieged", ({ lord, player }))   on("rivalHeld", ({ lord, player }))   on("rivalFallen", ({ lord, player }))
//   addFilter("rivalSoldier", (entity, { dim, at, role, tier, name, tags, lord }) => entity ?? yourSpawn(...))   supply the soldiers a
//                                     besieged lord calls out (role "knight" | "sorcerer" | "retainer", tier 1-4). Put every tag on them.
//   What lords do (marches, feuds, tribute, trade, oaths) and its events: court.js. Rules and numbers: deeds.js.
//   addFilter("rivalMenu", (buttons, { lord, player }) => [...buttons, { label, action }])   extra buttons when a player talks to a lord
//
// Commands: /scriptevent siege:rivals none|few|all     how many empty plots get a lord
//           /scriptevent siege:rivals list | night | settle | grow <id> | clear

import { world, system, GameMode } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { isReady, getState, saveState, keepOf, onTick, moduleStore, on, emit, addFoundingCheck, pick, title } from "../siege/api.js";
import { applyFilter } from "../core/events.js";
import { pay } from "../economy/coins.js";
import { coins, fromEmeralds } from "../economy/rules.js";
import * as plotsApi from "../plots/claims.js"; // giveToNpc / releaseNpc mark a plot as a lord's in the Plot Atlas (where plots has them)
import { allPlots, holderOf, mapMode } from "../plots/claims.js";
import { startBuild, buildFor, worldCells } from "../townhall/build.js";
import { CORNERSTONE, halls, saveHalls, beginBuild } from "../townhall/townhall.js";
import { drawHall } from "../townhall/halls.js";
import { STYLES } from "../townhall/styles.js";
import { REGION_TO_STYLE, HOMES } from "../settle/config.js";
import { drawBuilding, styleFor, BUILDING } from "../settle/buildings.js";
import { wallOf, wallRising, raiseWall, bearingFor, gateDirFor, adoptWall } from "../settle/walls.js";
import { WALL_LEVELS } from "../settle/walldata.js";
import { raiseFree } from "../settle/plans.js";
import { foundTown, townOf, layoutOf, growTown, slotClosed, builtCounts, saveTowns, adoptTown } from "../settle/founding.js";
import { townFor, slotsOf, seatOnSlot, seatedBox } from "../settle/towns.js";
import { lordPick } from "../settle/charters.js";
import { BUILDINGS } from "../settle/buildings.js";
import { levelSite, foundationColumns } from "../settle/ground.js";
import { RIVALS, TIER_NAMES, LINES, STAGES, makeLord, radiusOf, wanted, night, nextPiece, partKey, hallSpot, partSpot, estateOf, winsForEstate, takeEstate } from "./data.js";
import "./tests.js";
import { sfx } from "../core/sfx.js";
import "./court.js"; // what lords do: marches, feuds, trade, oaths

const OVERWORLD = "minecraft:overworld";
const NPC_TYPE = "minecraft:npc";
const LORD_TAG = "siege_rival";
const DEFENDER_TAG = "siege_rival_defender";
const DAY = 24000;

const store = moduleStore("siege:rivals", () => ({ mode: null, lords: [], fallen: [], lastArrival: 0, seed: 0, estates: {} }));
const estates = () => (store.data.estates ??= {}); // plot name -> what the last lord left there
const wallId = (lord) => `npc:${lord.id}`;
const lords = () => store.data.lords;
const save = () => store.save();
const lordTag = (lord) => `siege_rival_${lord.id}`;
const styleOfLord = (lord) => REGION_TO_STYLE[lord.region] ?? "vale";
const fullName = (lord) => `${lord.name} of ${lord.plot}`;

// A lord builds on the same town layouts and plots players do (settle/towns.js, founding.js, charters.js).
// Lords from older worlds that already built on the old fixed layout carry on with it.
const DESIGNS = new Set(BUILDINGS.map((b) => b.id));
function usesTown(lord) {
  if (lord.town === undefined) lord.town = lord.built.hall === 0 && lord.built.parts.length === 0 && !!townFor(lord.plot);
  return lord.town;
}

export const rivalMode = () => store.data.mode ?? RIVALS.mode;
export const rivalLords = () => lords();
export const rivalById = (id) => lords().find((l) => l.id === id);
export const rivalOnPlot = (plotName) => lords().find((l) => l.plot === plotName);
export const rivalAt = (location) => lords().find((l) => Math.hypot(location.x - (l.x + 0.5), location.z - (l.z + 0.5)) <= radiusOf(l));
export const strongestRival = (role) => lords().filter((l) => !role || l.role === role).sort((a, b) => b.wins - a.wins)[0];
export const rivalData = () => store.data; // for court.js
export const saveRivals = () => store.save();
export const relationOf = (lord, playerId) => lord.relations[playerId] ?? 0;
export function changeRelation(lord, playerId, by) {
  lord.relations[playerId] = Math.max(-100, Math.min(100, relationOf(lord, playerId) + by));
  save();
}

// ---------- written voices ----------
// The lore feature writes the lords (lore/data/lords.js: name, seat, region, temper, lines) and sends
// them as "rivalLordVoices". A new lord takes a written voice from their region when one is free;
// without the lore feature they get a made-up name and the short lines in data.js.
let voices = [];
on("rivalLordVoices", ({ lords: written }) => { voices = written ?? []; });
const voiceOf = (lord) => voices.find((v) => v.id === lord.voice);
export const lordSays = (lord, kind, player) => say(lord, kind, player);
export const lordFullName = (lord) => fullName(lord);
const say = (lord, kind, player) => voiceOf(lord)?.lines?.[kind]?.replace(/\{player\}/g, player?.name ?? "stranger");

function giveVoice(lord) {
  const used = new Set(lords().map((l) => l.voice));
  const free = voices.filter((v) => !used.has(v.id) && !store.data.fallen.includes(v.name));
  const voice = free.find((v) => v.region === lord.region) ?? free[0];
  if (!voice) return;
  lord.voice = voice.id;
  lord.name = voice.name;
  lord.temperament = voice.temper;
  if (voice.temper === "devout") lord.role = "knight"; // the Order has no love for Sorcerers
}

// ---------- who settles where ----------

function settleTick() {
  if (!mapMode()) return;
  const plots = allPlots();
  // a lord whose plot a player now holds (or whose Plot Stone is gone) leaves
  for (const lord of [...lords()]) {
    const plot = plots.find((p) => p.name === lord.plot);
    if (!plot || holderOf(plot)) removeLord(lord);
  }
  const now = world.getAbsoluteTime();
  const free = plots.filter((p) => !holderOf(p) && !rivalOnPlot(p.name) && !p.npc && !(p.reservedFor && now < p.reservedUntil));
  if (lords().length >= wanted(rivalMode(), free.length, lords().length)) return;
  if (lords().length && now - store.data.lastArrival < RIVALS.arriveEveryDays * DAY) return;
  store.data.seed ||= Math.floor(Math.random() * 1e9) + 1;
  // the free plot furthest from any player's keep, so newcomers don't crowd people
  const keeps = Object.values(getState().keeps);
  const far = (p) => Math.min(9999, ...keeps.map((k) => Math.hypot(k.x - p.x, k.z - p.z)));
  const plot = free.sort((a, b) => far(b) - far(a))[0];
  if (!plot) return;
  const lord = makeLord(plot, `${store.data.seed}|${store.data.fallen.length}`, [...lords().map((l) => l.name), ...store.data.fallen]);
  giveVoice(lord);
  if (estates()[plot.name]) { takeEstate(lord, estates()[plot.name]); delete estates()[plot.name]; } // carries on where the last lord stopped
  lords().push(lord);
  plotsApi.giveToNpc?.(lord.plot, { id: lord.id, name: lord.name });
  store.data.lastArrival = now;
  save();
  emit("rivalSettled", { lord });
  for (const p of world.getPlayers()) p.sendMessage(`§6${lord.name} has raised a banner at ${lord.plot}, ${lord.region}.`);
}

function removeLord(lord) {
  const i = lords().indexOf(lord);
  if (i >= 0) lords().splice(i, 1);
  save();
  if (allPlots().find((p) => p.name === lord.plot)?.npc?.id === lord.id) plotsApi.releaseNpc?.(lord.plot);
  try {
    for (const e of world.getDimension(OVERWORLD).getEntities({ tags: [lordTag(lord)] })) e.remove();
  } catch {
    // not loaded; the stray is cleaned up when someone clicks it
  }
}

// A player can't claim a plot a lord holds: they have to take it
addFoundingCheck((player, block) => {
  if (!isReady() || block.dimension.id !== OVERWORLD) return undefined;
  const lord = lords().find((l) => l.x === block.location.x && l.z === block.location.z);
  return lord ? `§c${lord.name} holds ${lord.plot}. Topple them first: speak to them and lay siege.` : undefined;
});

// ---------- growing ----------

on("siegeEnd", () => {
  const n = getState().siegeNumber ?? 0;
  for (const lord of lords()) {
    if (!night(lord, n)) continue;
    if (lord.town && townOf(wallId(lord))) growTown(wallId(lord), lord.tier); // held back by the charter like anyone's
    emit("rivalRose", { lord, tier: lord.tier });
    for (const p of world.getPlayers()) p.sendMessage(`§6${fullName(lord)} now rules a ${TIER_NAMES[lord.tier]}.`);
  }
  save();
});

// ---------- their settlement ----------

function surface(dim, x, z, fallback) {
  try {
    return (dim.getTopmostBlock({ x, z })?.y ?? fallback - 1) + 1;
  } catch {
    return undefined;
  }
}

function buildTick() {
  const dim = world.getDimension(OVERWORLD);
  const players = world.getPlayers().filter((p) => p.dimension.id === OVERWORLD);
  for (const lord of lords()) {
    if (!players.some((p) => Math.hypot(p.location.x - lord.x, p.location.z - lord.z) <= RIVALS.buildRange)) continue;
    keepLordHome(dim, lord);
    const id = `rival:${lord.id}`;
    if (buildFor(id) || sieges.has(lord.id)) continue;
    if (usesTown(lord)) { townTick(dim, lord, id); continue; }
    const piece = nextPiece(lord);
    if (!piece) continue;
    const style = styleOfLord(lord);
    lord.gateDir ??= gateDirFor(lord);
    if (piece.hall) {
      if (!lord.hallAt) {
        const spot = hallSpot(lord, lord.gateDir);
        const y = surface(dim, spot.x, spot.z, lord.y + 1);
        if (y === undefined) continue;
        lord.hallAt = levelSite(dim, drawHall(piece.hall, STYLES[style]), { x: spot.x, y, z: spot.z }, spot.forward).origin; // never half buried
        lord.hallF = spot.forward;
      }
      const plan = drawHall(piece.hall, STYLES[style]);
      let remove;
      if (lord.built.hall > 0) {
        const keepCells = new Set(worldCells(plan, lord.hallAt, lord.hallF).map((c) => `${c.x},${c.y},${c.z}`));
        remove = worldCells(drawHall(lord.built.hall, STYLES[style]), lord.hallAt, lord.hallF)
          .filter((c) => !keepCells.has(`${c.x},${c.y},${c.z}`)).sort((a, b) => b.y - a.y);
      }
      startBuild({
        id, dimensionId: OVERWORLD, origin: lord.hallAt, forward: lord.hallF, plan, style: STYLES[style], remove,
        perTick: Math.max(8, Math.ceil(plan.cells.size / 1200)),
        onDone() { lord.built.hall = piece.hall; save(); },
      }).columns.unshift(...foundationColumns(plan));
    } else {
      const spot = partSpot(lord, lord.gateDir, piece.part);
      const plan = drawBuilding(piece.part.building, style);
      const pk = partKey(piece.tier, piece.i);
      lord.partY ??= {};
      if (lord.partY[pk] === undefined) { // measured once, so a build picked up again keeps its height
        const y = surface(dim, spot.x, spot.z, lord.y + 1);
        if (y === undefined) continue;
        lord.partY[pk] = levelSite(dim, plan, { x: spot.x, y, z: spot.z }, spot.forward).origin.y; // never half buried
        save();
      }
      startBuild({
        id, dimensionId: OVERWORLD, origin: { x: spot.x, y: lord.partY[pk], z: spot.z }, forward: spot.forward, plan, style: styleFor(style),
        perTick: Math.max(4, Math.ceil(plan.cells.size / 200)),
        onDone() { lord.built.parts.push(pk); delete lord.partY[pk]; save(); },
      }).columns.unshift(...foundationColumns(plan));
    }
  }
}

// A lord on a town layout: found it, raise the hall on its cornerstone, then fill the plots by the charter rules
function townTick(dim, lord, id) {
  const key = wallId(lord);
  const style = styleOfLord(lord);
  let town = townOf(key);
  if (!town) {
    const plot = allPlots().find((p) => p.name === lord.plot) ?? { name: lord.plot, region: lord.region };
    foundTown(key, plot, { x: lord.x, y: lord.y, z: lord.z }, { lord: true, style });
    return;
  }
  if (town.temper !== lord.temperament) { town.temper = lord.temperament; saveTowns(); } // their townsfolk talk the lord's way
  if (lord.built.hall < town.tier + 1) {
    if (!town.hallSeat) return; // the roads are still going down
    const level = lord.built.hall + 1;
    const plan = drawHall(level, STYLES[style]);
    if (!lord.hallAt) {
      lord.hallF = { x: town.hallSeat.fx, z: town.hallSeat.fz };
      lord.hallAt = levelSite(dim, plan, town.hallSeat, lord.hallF).origin; // never half buried
    }
    let remove;
    if (lord.built.hall > 0) {
      const keepCells = new Set(worldCells(plan, lord.hallAt, lord.hallF).map((c) => `${c.x},${c.y},${c.z}`));
      remove = worldCells(drawHall(lord.built.hall, STYLES[style]), lord.hallAt, lord.hallF)
        .filter((c) => !keepCells.has(`${c.x},${c.y},${c.z}`)).sort((a, b) => b.y - a.y);
    }
    startBuild({
      id, dimensionId: OVERWORLD, origin: lord.hallAt, forward: lord.hallF, plan, style: STYLES[style], remove,
      perTick: Math.max(8, Math.ceil(plan.cells.size / 1200)),
      onDone() { lord.built.hall = level; save(); },
    }).columns.unshift(...foundationColumns(plan));
    return;
  }
  // the next plot: picked once and remembered, so a build picked up again goes on the same plot at the same height
  let job = lord.plotJob;
  const slots = slotsOf(layoutOf(town));
  if (!job) {
    const open = slots.filter((s) => s.tier <= town.tier && town.laid[s.tier] && !town.slots[s.id]?.building && !slotClosed(key, s));
    const fits = (bid, s) => !!seatOnSlot(s, drawBuilding(bid, style).bounds());
    const coming = slots.filter((s) => !town.slots[s.id]?.building && !slotClosed(key, s));
    const pick = lordPick(open, town.tier, builtCounts(key), DESIGNS, fits, lord.id, coming);
    if (!pick) return;
    job = lord.plotJob = { slot: pick.slot.id, building: pick.id };
    save();
  }
  const slot = slots.find((s) => s.id === job.slot);
  const plan = drawBuilding(job.building, style);
  const seat = slot && seatOnSlot(slot, plan.bounds());
  if (!seat) { delete lord.plotJob; save(); return; }
  const at = { x: town.x + seat.origin.dx, y: town.y + seat.origin.dy, z: town.z + seat.origin.dz };
  if (!Number.isFinite(job.lift)) { job.lift = Math.max(0, levelSite(dim, plan, at, seat.forward).lift); save(); }
  const origin = { ...at, y: at.y + job.lift };
  startBuild({
    id, dimensionId: OVERWORLD, origin, forward: seat.forward, plan, style: styleFor(style),
    perTick: Math.max(4, Math.ceil(plan.cells.size / 200)),
    onDone() {
      const box = seatedBox(seat, plan.bounds());
      const t = townOf(key);
      if (t) {
        t.slots[job.slot] = { building: job.building, style, origin: at, forward: seat.forward, lift: job.lift, top: plan.bounds().y1 + job.lift, paid: 0, done: true,
          box: { x0: t.x + box.x0, z0: t.z + box.z0, x1: t.x + box.x1, z1: t.z + box.z1 } };
        saveTowns();
        emit("settleCharter", { owner: key }); // a lord's town grows past a tier on the same charter
        if (HOMES.includes(job.building)) emit("lordHomeBuilt", { owner: key, slot: job.slot }); // the crew puts beds in it (settle/lordfolk.js)
      }
      lord.built.parts.push(`plot:${job.slot}`);
      delete lord.plotJob;
      save();
    },
  }).columns.unshift(...foundationColumns(plan));
}

// A lord's wall keeps pace with their tier
function wallTick() {
  const players = world.getPlayers().filter((p) => p.dimension.id === OVERWORLD);
  for (const lord of lords()) {
    if (lord.built.hall < 1 || sieges.has(lord.id) || wallRising(wallId(lord))) continue;
    if (!players.some((p) => Math.hypot(p.location.x - lord.x, p.location.z - lord.z) <= RIVALS.buildRange)) continue;
    const want = RIVALS.wallLevel[lord.tier] ?? 1;
    const w = wallOf(wallId(lord));
    if ((w?.level ?? 0) >= want) continue;
    const center = { x: lord.x, y: lord.y, z: lord.z };
    raiseWall(wallId(lord), want, w ? {} : { center, style: styleOfLord(lord), bearing: bearingFor(center) });
  }
}

function keepLordHome(dim, lord) {
  try {
    if (dim.getEntities({ type: NPC_TYPE, tags: [lordTag(lord)] }).length) return;
    const x = lord.x + 2, z = lord.z - 2;
    const y = surface(dim, x, z, lord.y + 1);
    if (y === undefined) return;
    const npc = dim.spawnEntity(NPC_TYPE, { x: x + 0.5, y, z: z + 0.5 });
    npc.addTag(LORD_TAG);
    npc.addTag(lordTag(lord));
    npc.nameTag = lord.name;
    try {
      const c = npc.getComponent("minecraft:npc");
      c.name = lord.name;
      c.skinIndex = 20 + (lords().indexOf(lord) % 10) * 2;
    } catch {
      // looks are optional
    }
  } catch {
    // not loaded yet
  }
}

// ---------- their land is theirs ----------

const besiegerOf = (lord) => sieges.get(lord.id)?.player;

function trespass(player, location, dimensionId) {
  if (!isReady() || dimensionId !== OVERWORLD || player.getGameMode() === GameMode.Creative) return undefined;
  const lord = rivalAt(location);
  return lord && besiegerOf(lord) !== player.id ? lord : undefined;
}

world.beforeEvents.playerBreakBlock.subscribe((event) => {
  const lord = trespass(event.player, event.block.location, event.block.dimension.id);
  if (!lord) return;
  event.cancel = true;
  const player = event.player;
  system.run(() => player.onScreenDisplay.setActionBar(`§cThis is ${lord.name}'s land. Speak to them, or lay siege.`));
});
world.beforeEvents.playerPlaceBlock?.subscribe((event) => {
  const lord = trespass(event.player, event.block.location, event.block.dimension.id);
  if (!lord) return;
  event.cancel = true;
  const player = event.player;
  system.run(() => player.onScreenDisplay.setActionBar(`§cThis is ${lord.name}'s land.`));
});

// ---------- laying siege to a lord ----------

const sieges = new Map(); // lord id -> { player, until, spawned }

function defendersOf(dim, lord) {
  return dim.getEntities({ tags: [DEFENDER_TAG, lordTag(lord)] });
}

function laySiege(player, lord) {
  if (sieges.has(lord.id)) return player.sendMessage(`§7${lord.name} is already under siege.`);
  if (!keepOf(player.id)) return player.sendMessage("§7Only someone with a settlement of their own can lay siege. Raise a Keep Banner first.");
  const now = world.getAbsoluteTime();
  if (now < (lord.restUntil ?? 0)) return player.sendMessage(`§7${lord.name}'s walls are freshly manned. Come back tomorrow.`);
  const dim = player.dimension;
  const count = RIVALS.defenders[lord.tier];
  let spawned = 0;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const x = lord.x + Math.round(Math.cos(a) * 9), z = lord.z + Math.round(Math.sin(a) * 9);
    const y = surface(dim, x, z, lord.y + 1);
    if (y === undefined) continue;
    const at = { x: x + 0.5, y, z: z + 0.5 };
    const tags = [DEFENDER_TAG, lordTag(lord)];
    const name = i === 0 ? `${lord.name}'s Champion` : `${lord.plot} Guard`;
    // A feature with better fighters (the bestiary's champions) supplies them through the "rivalSoldier" filter
    const role = i === 0 ? (lord.role === "marked" ? "sorcerer" : "knight") : "retainer";
    let soldier;
    try {
      soldier = applyFilter("rivalSoldier", undefined, { dim, at, role, tier: lord.tier + 1, name, tags, lord });
    } catch {
      soldier = undefined;
    }
    if (soldier) {
      spawned++;
    } else {
      try {
        const e = dim.spawnEntity(i % 3 === 0 ? "siege:hollow_footman" : "siege:shieldwall_brute", at); // our own raiders if champions are missing
        for (const t of tags) e.addTag(t);
        e.nameTag = name;
        spawned++;
      } catch {
        // that spot is not loaded
      }
    }
  }
  if (!spawned) return player.sendMessage("§7Come closer to their hall before you call them out.");
  sieges.set(lord.id, { player: player.id, until: system.currentTick + RIVALS.siegeMinutes * 1200, spawned });
  changeRelation(lord, player.id, -40);
  emit("rivalBesieged", { lord, player });
  title(player, `§4Siege of ${lord.plot}`, `§7Cut down all ${spawned} of ${lord.name}'s soldiers`);
  for (const p of world.getPlayers()) if (p.id !== player.id) p.sendMessage(`§6${player.name} has laid siege to ${fullName(lord)}.`);
}

function endSiege(lord, won) {
  const siege = sieges.get(lord.id);
  sieges.delete(lord.id);
  const dim = world.getDimension(OVERWORLD);
  const player = world.getPlayers().find((p) => p.id === siege.player);
  try {
    for (const e of defendersOf(dim, lord)) e.remove();
  } catch {
    // unloaded soldiers despawn on their own
  }
  if (!won) {
    lord.held++;
    lord.restUntil = world.getAbsoluteTime() + RIVALS.siegeCooldownDays * DAY;
    save();
    emit("rivalHeld", { lord, player });
    player?.sendMessage(`§7${lord.name} held ${lord.plot}. They will not forget it.`);
    const won = say(lord, "won", player);
    if (won) player?.sendMessage(`§7${lord.name}: §f${won}`);
    return;
  }
  const beaten = say(lord, "beaten", player);
  if (beaten) player?.sendMessage(`§7${lord.name}: §f${beaten}`);
  store.data.fallen.push(lord.name);
  estates()[lord.plot] = { ...estateOf(lord), wall: wallId(lord), town: !!lord.town }; // whoever claims the plot starts from what stands there
  removeLord(lord);
  emit("rivalFallen", { lord, player });
  for (const p of world.getPlayers()) p.sendMessage(`§6${lord.name} has fallen. ${lord.plot} stands empty, hall and all.`);
  if (!player) return;
  const spoils = RIVALS.spoils[lord.tier];
  pay(player, fromEmeralds(spoils), "rival lord");
  sfx(player, "ui.toast.challenge_complete");
  title(player, `§6${lord.plot} is taken`, `§7${coins(fromEmeralds(spoils))} in spoils. Claim it and it is yours as it stands.`);
  emit("skillPoints", { player, amount: 1 + lord.tier, source: `toppled ${lord.name}`, renown: 80 * (lord.tier + 1) });
}

function siegeTick() {
  if (!sieges.size) return;
  const dim = world.getDimension(OVERWORLD);
  for (const [id, siege] of [...sieges]) {
    const lord = rivalById(id);
    if (!lord) { sieges.delete(id); continue; }
    const player = world.getPlayers().find((p) => p.id === siege.player);
    const away = !player || player.dimension.id !== OVERWORLD || Math.hypot(player.location.x - lord.x, player.location.z - lord.z) > radiusOf(lord) + 24;
    if (away || system.currentTick > siege.until) { endSiege(lord, false); continue; }
    let left;
    try {
      left = defendersOf(dim, lord).length;
    } catch {
      continue;
    }
    if (left === 0) endSiege(lord, true);
    else player.onScreenDisplay.setActionBar(`§c${left} of ${lord.name}'s soldiers left §7· ${Math.ceil((siege.until - system.currentTick) / 1200)} min`);
  }
}

world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  if (deadEntity.typeId !== "minecraft:player") return;
  for (const [id, siege] of [...sieges]) if (siege.player === deadEntity.id && rivalById(id)) endSiege(rivalById(id), false);
});

// ---------- talking to a lord ----------

function mood(lord, player) {
  const r = relationOf(lord, player.id);
  return r <= -40 ? "§cthey remember what you did" : r >= 40 ? "§athey think well of you" : "§7they are making up their mind about you";
}

async function talk(player, lord) {
  const buttons = applyFilter("rivalMenu", [], { lord, player });
  const r = relationOf(lord, player.id);
  const body = [
    `§o"${say(lord, r <= -40 ? "foe" : r >= 40 ? "friend" : "greet", player) ?? pick(LINES[lord.temperament] ?? LINES.steady)}"§r`, "",
    `§7${fullName(lord)}, ${lord.region}`,
    `§7Holds a ${TIER_NAMES[lord.tier]} · ${lord.wins} siege nights survived · ${mood(lord, player)}`,
    ...applyFilter("rivalTalkLines", [], { lord, player }),
  ];
  const form = new ActionFormData().title(lord.name).body(body.join("\n"));
  for (const b of buttons) form.button(b.label, b.icon);
  form.button("Lay siege to them").button("Leave");
  const res = await form.show(player);
  if (res.canceled) return;
  if (res.selection < buttons.length) return buttons[res.selection].action();
  if (res.selection !== buttons.length) return;
  const sure = await new MessageFormData().title(`Lay siege to ${lord.plot}?`)
    .body(`${lord.name} will call out ${RIVALS.defenders[lord.tier]} soldiers. Cut them all down within ${RIVALS.siegeMinutes} minutes and ${lord.plot} is empty for the taking, buildings and all.\n\nDie, leave or run out of time, and they hold. They will not forgive it either way.`)
    .button1("Not today").button2("Lay siege").show(player);
  if (sure.selection !== 1) return;
  const war = say(lord, "war", player);
  if (war) player.sendMessage(`§7${lord.name}: §f${war}`);
  laySiege(player, lord);
}

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  const { player, target } = event;
  if (target.typeId !== NPC_TYPE || !target.hasTag(LORD_TAG)) return;
  if (player.isSneaking && player.getGameMode() === GameMode.Creative) return;
  event.cancel = true;
  system.run(() => {
    if (!isReady()) return;
    const lord = lords().find((l) => target.hasTag(lordTag(l)));
    if (!lord) return target.remove(); // a lord who has left
    talk(player, lord).catch((e) => console.warn(`[Hollow Crown] rival talk: ${e}`));
  });
});

// Tell late listeners (and old saves) who is already settled
on("ready", () => {
  emit("rivalLordsWanted", {});
  for (const lord of lords()) plotsApi.giveToNpc?.(lord.plot, { id: lord.id, name: lord.name }); // saves from before plots knew about lords
  for (const lord of lords()) emit("rivalSettled", { lord, known: true });
});

onTick("rivals_settle", 200, () => { if (isReady()) settleTick(); });
onTick("rivals_build", 100, () => { if (isReady()) buildTick(); });
onTick("rivals_walls", 200, () => { if (isReady()) wallTick(); });
onTick("rivals_siege", 20, () => { if (isReady()) siegeTick(); });

// ---------- handing a settlement to a player ----------
// A player who takes a lord's plot starts where the lord left off: the same tier, hall, buildings and wall.
// Nothing is locked by it: every building is theirs to change or pull down, the hall and wall upgrade as
// usual, anything the lord had not built yet is still there to build, and their own role and story are untouched.
// Two ways in: a newcomer picks the lord's plot in the welcome hall (the lord steps down), or a lord
// is toppled and somebody raises a Keep Banner on the empty plot.

// The buildings and the wall change hands (can happen before the player has a keep)
function adopt(player, estate) {
  if (estate.adopted) return;
  const mine = townOf(player.id); // a player who already has a town elsewhere keeps theirs
  if (estate.town && mine && !(mine.x === estate.x && mine.z === estate.z)) return;
  estate.adopted = player.id;
  const dim = world.getDimension(OVERWORLD);
  const style = REGION_TO_STYLE[allPlots().find((p) => p.name === estate.plot)?.region] ?? "vale";
  // the town record, plots and all (founding.js); a player who already has a town elsewhere keeps theirs
  if (estate.town) adoptTown(estate.wall, player.id); // false when founding already took it over: fine
  adoptWall(estate.wall, player.id);
  const old = halls()[player.id];
  if (estate.hall > 0 && estate.hallAt && (!old || old.lost)) {
    try {
      dim.getBlock(estate.hallAt)?.setType(CORNERSTONE);
    } catch {
      // not loaded: the record below is enough, the block appears when the hall is rebuilt
    }
    halls()[player.id] = {
      x: estate.hallAt.x, y: estate.hallAt.y, z: estate.hallAt.z, fx: estate.hallF.x, fz: estate.hallF.z,
      level: 0, paid: Math.max(old?.paid ?? 0, estate.hall, estate.tier + 1), best: Math.max(old?.best ?? 0, estate.hall), style, building: null, marks: {},
    };
    saveHalls();
    beginBuild(player.id, estate.hall, style); // the same hall on the same spot: this wakes its Tree of Oaths and rooms for the new owner
  }
  // a town always has its library, even if the lord never got to it (a town layout's library plot is the
  // player's to raise; the old fixed layout gets it now)
  if (!estate.town) STAGES.forEach((stage, tier) => stage.forEach((slot, i) => {
    if (!slot.arrival || estate.parts.includes(partKey(tier, i)) || !estate.gateDir) return;
    const spot = partSpot(estate, estate.gateDir, slot);
    const y = surface(dim, spot.x, spot.z, undefined);
    if (y !== undefined && BUILDING[slot.building]) raiseFree(player, { x: spot.x, y, z: spot.z }, spot.forward, slot.building, style);
  }));
  save();
  const wall = wallOf(player.id);
  player.sendMessage(`§6You take up ${estate.plot} where ${estate.from} left it:§7 a ${TIER_NAMES[estate.tier]}${estate.hall ? `, its hall` : ""}, ${estate.parts.length} building${estate.parts.length === 1 ? "" : "s"}${wall?.level ? ` and a ${WALL_LEVELS[wall.level]?.name ?? "wall"}` : ""}. All of it is yours to keep, change or pull down.`);
}

// A newcomer chose a lord's plot in the welcome hall: the lord steps down for them
on("plotChosen", ({ player, plot }) => {
  const lord = plot && rivalOnPlot(plot.name);
  if (lord) {
    if (sieges.has(lord.id)) endSiege(lord, false);
    estates()[lord.plot] = { ...estateOf(lord), wall: wallId(lord), town: !!lord.town, heir: player.id };
    removeLord(lord);
    emit("rivalStoodDown", { lord, player });
    for (const p of world.getPlayers()) p.sendMessage(`§6${lord.name} has handed ${lord.plot} to ${player.name}.`);
  }
  const estate = plot && estates()[plot.name];
  if (estate && (!estate.heir || estate.heir === player.id)) adopt(player, estate);
});

// The welcome hall asks what tier a lord-run plot stands at, for its label
on("plotLordQuery", (q) => {
  const lord = q?.plot && rivalOnPlot(q.plot.name);
  if (lord) q.tier = TIER_NAMES[lord.tier];
});

// The Keep Banner goes up: the settlement's standing comes with it
on("keepFounded", ({ player, keep }) => {
  const estate = Object.values(estates()).find((e) => e.x === keep.x && e.z === keep.z);
  if (!estate) return;
  adopt(player, estate);
  keep.wins = winsForEstate(estate, keep.wins ?? 0);
  if (estate.tier >= 3) keep.warlordsSlain = Math.max(keep.warlordsSlain ?? 0, 2); // a Castle stays a Castle
  saveState();
  delete estates()[estate.plot];
  save();
  emit("rivalInherited", { player, estate });
});

// ---------- commands ----------
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:rivals") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isReady()) return;
  const [cmd, arg] = event.message.trim().split(/\s+/);
  if (["deed", "feud_end", "relation", "court"].includes(cmd)) return; // court.js answers these
  if (["none", "few", "all"].includes(cmd)) {
    store.data.mode = cmd;
    save();
    if (cmd === "none") for (const lord of [...lords()]) removeLord(lord);
    return player.sendMessage(`§6Rival Lords: ${cmd}.${mapMode() ? "" : " §7(They only settle on a map with Plot Stones.)"}`);
  }
  if (cmd === "settle") { store.data.lastArrival = 0; settleTick(); }
  if (cmd === "night") emit("siegeEnd", { outcome: "test", besieged: [] });
  if (cmd === "grow" && rivalById(arg)) { const l = rivalById(arg); l.tier = Math.min(3, l.tier + 1); l.wins = RIVALS.tierWins[l.tier]; save(); if (l.town && townOf(wallId(l))) growTown(wallId(l), l.tier); }
  if (cmd === "clear") for (const lord of [...lords()]) removeLord(lord);
  player.sendMessage(lords().length
    ? lords().map((l) => `§6${l.id}§r ${fullName(l)}: ${TIER_NAMES[l.tier]}, ${l.role}, ${l.temperament}, at ${l.x} ${l.z}`).join("\n")
    : `§7No Rival Lords (mode: ${rivalMode()}). They settle on free Plot Stones, one a day.`);
});
