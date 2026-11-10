// Story characters, on Bedrock's built-in NPC entity (minecraft:npc), so they work on a Realm.
// The words are in data/dialogue.js. The scenes file (dialogue/siege_lore.json) is generated from
// it by tools/build_lore.py. This file picks which scene a player sees and applies what a
// conversation gives: tomes, clues, leads, skill points.
//
// Builder commands (creative / operators):
//   /scriptevent siege:lore_npc <id>     spawn that character where you stand (wren, aldous, mag, elias, sage, cael, sigrun, isolde)
//   /scriptevent siege:lore_npc list     list the characters and where each belongs
// To edit or remove one: sneak + click it in creative (the normal NPC editor), or /kill it.

import { world, system, ItemStack, GameMode } from "@minecraft/server";
import { emit, on } from "../siege/api.js";
import { startNode, sceneTag, holds, blankProgress, nextNode, nextNodes, greetCount, pickGreet, variantTag } from "./logic.js";
import { NPCS } from "./data/dialogue.js";
import { progressOf, saveProgress, contextOf, grantTome, learnClues, learnLeads, awardPoints, setFlag, giveItem, landOwnerAt } from "./player.js";
import { libraryCount } from "./library.js";
import { sfx } from "../core/sfx.js";

export const NPC_TYPE = "minecraft:npc";
const NPC = Object.fromEntries(NPCS.map((n) => [n.id, n]));
const tagOf = (id) => `siege_lore_npc_${id}`;
const npcIdOf = (entity) => entity.getTags().find((t) => t.startsWith("siege_lore_npc_"))?.slice("siege_lore_npc_".length);

function contextFor(player) {
  // "shelved" counts the Library of the land you stand on, else your own
  let owner;
  try {
    const block = player.dimension.getBlock(player.location);
    owner = block && landOwnerAt(block);
  } catch {}
  return contextOf(player, libraryCount(owner ?? player.id));
}

const lastGreet = new Map(); // player/npc/node -> wording last shown
function openScene(player, npcId, node) {
  const selector = `@e[type=${NPC_TYPE},tag=${tagOf(npcId)},c=1]`;
  try {
    const key = `${player.id}/${npcId}/${node}`;
    const v = pickGreet(greetCount(NPC[npcId]?.nodes[node]), lastGreet.get(key), Math.random());
    lastGreet.set(key, v);
    player.runCommand(`dialogue open ${selector} @s ${variantTag(npcId, node, v)}`);
  } catch (e) {
    console.warn(`[Lore] dialogue ${npcId}/${node}: ${e}`);
  }
}

// ---------- Slips ----------
// A Slip pulls the player into the Hollow for a few seconds mid-conversation. The glimpse itself
// belongs to the Undertow feature (undertow/slips.js). We emit("slip", ...); it answers at once with
// "slipStarted" or "slipRefused", and "slipEnded" when the player is back. If it is not there at
// all, the player blacks out for a moment and the story carries on.
export const SCRIPT_CLUES = ["slip_first", "journal_signed_a", "journal_son"]; // clues given by code, not by a tome or a button
const slipping = new Map(); // player id -> { id, accepted }
const idOf = (player) => (typeof player === "string" ? player : player?.id);
const playerOf = (player) => (typeof player === "string" ? world.getAllPlayers().find((p) => p.id === player) : player);

function startSlip(player, id, npc) {
  if (slipping.has(player.id)) return;
  const slip = { id, accepted: false };
  slipping.set(player.id, slip);
  emit("slip", { player, id, npc, returnTo: { ...player.location }, dimension: player.dimension.id });
  if (slip.accepted) return; // "slipStarted" arrived inside the emit; "slipEnded" will finish it
  blackout(player, id);
}

function blackout(player, id) {
  try {
    player.addEffect("blindness", 60, { showParticles: false });
    player.addEffect("nausea", 120, { showParticles: false });
    sfx(player, "block.bell.hit", { pitch: 0.5 });
  } catch {}
  system.runTimeout(() => endSlip(player, id), 70);
}

function endSlip(player, id) {
  if (!player || slipping.get(player.id)?.id !== id) return;
  slipping.delete(player.id);
  try {
    if (!setFlag(player, `slipped_${id}`)) return;
    learnClues(player, [`slip_${id}`]);
    player.sendMessage("§7§oWhere was I?");
  } catch (e) {
    console.warn(`[Lore] slip end: ${e}`);
  }
}

on("slipStarted", ({ player, id, seconds }) => {
  const slip = slipping.get(idOf(player));
  if (!slip || slip.id !== id) return;
  slip.accepted = true;
  // Safety net in case "slipEnded" never comes
  system.runTimeout(() => endSlip(playerOf(player), id), ((seconds ?? 13) + 20) * 20);
});
on("slipRefused", ({ player, id }) => {
  const slip = slipping.get(idOf(player));
  if (slip?.id === id && slip.accepted) blackout(playerOf(player), id);
});
on("slipEnded", ({ player, id }) => endSlip(playerOf(player), id));

// One effect, once per player per button. Returns nothing.
function apply(player, effect, npcId) {
  const split = effect.indexOf(":");
  const kind = effect.slice(0, split), value = effect.slice(split + 1);
  if (kind === "flag") setFlag(player, value);
  else if (kind === "tome") grantTome(player, value);
  else if (kind === "clue") learnClues(player, [value]);
  else if (kind === "lead") learnLeads(player, [value]);
  else if (kind === "sp") awardPoints(player, Number(value), "story", Number(value) * 15);
  else if (kind === "item") giveItem(player, new ItemStack(value, 1));
  else if (kind === "slip") startSlip(player, value, npcId);
}

export function choose(player, npcId, node, index) {
  const npc = NPC[npcId];
  const option = npc?.nodes[node]?.opts[index];
  if (!option) return;
  const [, next, effects = []] = option;
  const p = progressOf(player);
  const key = `${npcId}|${node}|${index}`;
  if (effects.length && !p.once.includes(key)) {
    p.once.push(key);
    for (const effect of effects) apply(player, effect, npcId);
    saveProgress(player);
  }
  emit("loreTalk", { player, npc: npcId, node, choice: index, next });
  const where = nextNode(next, progressOf(player), contextFor(player));
  if (where === "end") return;
  const target = where === "start" ? startNode(npc, progressOf(player), contextFor(player)) : where;
  system.runTimeout(() => openScene(player, npcId, target), 2);
}

export function spawnNpc(dimension, location, id) {
  const entity = dimension.spawnEntity(NPC_TYPE, location);
  entity.addTag(tagOf(id));
  entity.nameTag = NPC[id].name;
  try {
    const component = entity.getComponent("minecraft:npc");
    component.name = NPC[id].name;
    component.skinIndex = NPCS.indexOf(NPC[id]) * 5;
    component.defaultScene = sceneTag(id, NPC[id].start[NPC[id].start.length - 1][1]);
  } catch {}
  return entity;
}

// Clicking a story NPC opens the right scene for this player
world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  const { player, target } = event;
  if (target.typeId !== NPC_TYPE) return;
  const npcId = npcIdOf(target);
  if (!npcId || !NPC[npcId]) return;
  if (player.isSneaking && player.getGameMode() === GameMode.Creative) return; // builder: normal NPC editor
  event.cancel = true;
  system.run(() => {
    try {
      const node = startNode(NPC[npcId], progressOf(player), contextFor(player));
      emit("loreTalk", { player, npc: npcId, node, choice: -1, next: node });
      openScene(player, npcId, node);
    } catch (e) {
      console.warn(`[Lore] npc click: ${e}`);
    }
  });
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id === "siege:lore_say") {
    // Sent by a dialogue button: "<npc> <node> <button index>"
    const [npcId, node, index] = event.message.trim().split(/\s+/);
    let player = event.initiator ?? event.sourceEntity;
    if (player?.typeId !== "minecraft:player") {
      player = event.sourceEntity?.dimension.getPlayers({ location: event.sourceEntity.location, closest: 1, maxDistance: 12 })[0];
    }
    if (player) choose(player, npcId, node, Number(index));
    return;
  }
  if (event.id !== "siege:lore_npc") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  const id = event.message.trim();
  if (!NPC[id]) {
    return player.sendMessage(NPCS.map((n) => `§6${n.id}§r ${n.name}\n§7  ${n.where}`).join("\n"));
  }
  spawnNpc(player.dimension, player.location, id);
  player.sendMessage(`§aSpawned ${NPC[id].name}. Sneak + click in creative to edit, or /kill @e[tag=${tagOf(id)}] to remove.`);
});

// Used by the tests: every start line and every button points at a real node
export function dialogueProblems() {
  const problems = [];
  for (const npc of NPCS) {
    for (const [conds, node] of npc.start) {
      if (!npc.nodes[node]) problems.push(`${npc.id}: start points at missing node "${node}"`);
      for (const c of conds) holds(c, blankProgress(), {}); // must not throw
    }
    for (const [id, node] of Object.entries(npc.nodes)) {
      if (node.opts.length > 6) problems.push(`${npc.id}/${id}: more than 6 buttons`);
      // anything called "hub" is heard every visit, for as long as the world lasts
      if (id === "hub" && (node.greets?.length ?? 0) < 3) problems.push(`${npc.id}/hub: needs at least 3 greets so it is not the same line every visit`);
      if (new Set([node.text, ...(node.greets ?? [])]).size !== 1 + (node.greets?.length ?? 0)) problems.push(`${npc.id}/${id}: two greets are the same`);
      for (const [label, next] of node.opts) {
        for (const to of nextNodes(next)) {
          if (to !== "end" && to !== "start" && !npc.nodes[to]) problems.push(`${npc.id}/${id}: "${label}" points at missing node "${to}"`);
        }
      }
    }
  }
  return problems;
}
