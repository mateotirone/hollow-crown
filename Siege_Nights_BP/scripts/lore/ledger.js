// The Ledger of Whispers: your journal. It copies every clue word for word, sorted by mystery,
// and lets you answer a mystery once you have enough clues. It never marks a mystery spot on a map.

import { world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { emit } from "../siege/api.js";
import { isTesting } from "../core/tests.js";
import { TOMES, tomesOf, answerIsRight, cluesFound, canAnswer as enoughClues, surveyLine, ALL_THREADS, isLocal, loadSaved, stampSaved } /* saves carry a version: SAVE_VERSION in logic.js */ from "./logic.js";
import { COLLECTIONS, PLACES, THREADS } from "./data/world.js";
import { LEDGER, progressOf, saveProgress, sourceSite, awardPoints, setFlag } from "./player.js";
import { sfx } from "../core/sfx.js";

const WRONG_ANSWER_DAYS = 1;
const K_PLACES = "hc:lore_places"; // { place id: { x, y, z } } marked by the map builder

export function markedPlaces() {
  const raw = world.getDynamicProperty(K_PLACES);
  return loadSaved("places", raw) ?? {};
}
export function markPlace(id, location) {
  const places = markedPlaces();
  places[id] = { x: Math.floor(location.x), y: Math.floor(location.y), z: Math.floor(location.z) };
  if (!isTesting()) world.setDynamicProperty(K_PLACES, stampSaved("places", places));
}

const clueText = (text) => text.replace(/\{SURVEY(\d)\}/, (_, n) => `Fennick: "${surveyLine(sourceSite(), Number(n))}"`);

export async function openLedger(player) {
  const p = progressOf(player);
  const known = ALL_THREADS.filter((t) => cluesFound(p, t).length > 0 || p.solved.includes(t.id));
  const form = new ActionFormData()
    .title("Ledger of Whispers")
    .body(`§7Tomes read: §f${p.read.filter((id) => !isLocal(id)).length} / ${TOMES.length}\n§7Mysteries solved: §f${p.solved.filter((id) => !isLocal(id)).length} / ${THREADS.length}\n\n§7A mystery appears here when you read your first clue about it.`);
  const actions = [];
  for (const t of known) {
    const found = cluesFound(p, t).length;
    const status = p.solved.includes(t.id) ? "§2Solved" : enoughClues(p, t) ? "§5Ready to answer" : `${found} clue${found === 1 ? "" : "s"}`;
    form.button(`${t.name}\n${status}`);
    actions.push(() => threadView(player, t));
  }
  form.button(`Leads (${p.leads.length})`);
  actions.push(() => leadsView(player));
  form.button("Tomes read");
  actions.push(() => readView(player));
  const answer = await form.show(player);
  if (answer.canceled) return;
  return actions[answer.selection]?.();
}

async function threadView(player, thread) {
  const p = progressOf(player);
  const found = cluesFound(p, thread);
  const solved = p.solved.includes(thread.id);
  const day = world.getDay();
  const locked = (p.locks[thread.id] ?? 0) > day;
  let body = `§o${thread.intro}§r\n\n` + found.map((c) => `§7- §f${clueText(thread.clues[c])}`).join("\n\n");
  const total = Object.keys(thread.clues).length;
  body += `\n\n§8${found.length} of ${total} clues found.`;
  if (solved) body += `\n\n§2Solved.§r ${thread.solved}`;
  else if (thread.kind === "library") body += "\n\n§5Shelve all six Field Notes, then Name the Thin Place in your Library catalog.";
  else if (found.length < thread.need) body += `\n\n§7You need ${thread.need} clues before you can answer.`;
  else if (!enoughClues(p, thread)) body += "\n\n§7Something is still missing. Someone who was there must have written it down.";
  else if (locked) body += `\n\n§cYou answered wrong. The thread is closed until tomorrow.`;

  const canAnswer = !solved && thread.kind !== "library" && enoughClues(p, thread) && !locked;
  const form = new ActionFormData().title(thread.name).body(body);
  if (canAnswer) form.button("§5I think I know the answer");
  form.button("Back");
  const answer = await form.show(player);
  if (answer.canceled) return;
  if (canAnswer && answer.selection === 0) return answerView(player, thread);
  return openLedger(player);
}

async function answerView(player, thread) {
  let given;
  if (thread.kind === "choice") {
    const form = new ActionFormData().title(thread.name).body(`${thread.question}\n\n§cA wrong answer closes this thread for a day.`);
    for (const option of thread.options) form.button(option);
    form.button("§7Let me read more first");
    const answer = await form.show(player);
    if (answer.canceled || answer.selection >= thread.options.length) return;
    given = answer.selection;
  } else {
    const form = new ModalFormData()
      .title(thread.name)
      .textField(`${thread.question}\n\n§cA wrong answer closes this thread for a day. Leave it empty to go back.`, "Write your answer");
    const answer = await form.show(player);
    if (answer.canceled) return;
    given = String(answer.formValues?.[0] ?? "").trim();
    if (!given) return;
  }

  const p = progressOf(player);
  if (!answerIsRight(thread, given)) {
    p.locks[thread.id] = world.getDay() + WRONG_ANSWER_DAYS;
    saveProgress(player);
    sfx(player, "block.bell.hit");
    player.sendMessage(`§c${thread.name}: that isn't it. The ink fades as you write. Read the clues again and try tomorrow.`);
    return;
  }
  solveThread(player, thread);
}

export function solveThread(player, thread) {
  const p = progressOf(player);
  if (p.solved.includes(thread.id)) return;
  p.solved.push(thread.id);
  saveProgress(player);
  if (thread.flag) setFlag(player, thread.flag);
  sfx(player, "random.toast");
  player.sendMessage(`§aMystery solved: §f${thread.name}§r\n§7${thread.solved}`);
  awardPoints(player, thread.sp, `mystery:${thread.id}`, thread.sp * 20);
  emit("loreThreadSolved", { player, thread: thread.id });
  if (THREADS.every((t) => p.solved.includes(t.id)) && setFlag(player, "all_mysteries")) {
    player.sendMessage("§5Every thread is tied off. You know the whole truth of Aldmere. Remember the name when you stand at the throne.");
    emit("loreAllSolved", { player });
  }
}

const COMPASS = ["south", "south-west", "west", "north-west", "north", "north-east", "east", "south-east"];
function heading(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const distance = Math.round(Math.hypot(dx, dz));
  const angle = (Math.atan2(-dx, dz) * 180) / Math.PI; // 0 = south (+z), 90 = west (-x)
  return `${distance} blocks ${COMPASS[Math.round(((angle + 360) % 360) / 45) % 8]}`;
}

async function leadsView(player) {
  const p = progressOf(player);
  const marked = markedPlaces();
  const lines = p.leads.map((id) => {
    const place = PLACES[id];
    let line = `§f${place.name}§7 (${place.region})\n§7${place.desc}`;
    if (place.charted && marked[id] && player.dimension.id === "minecraft:overworld") line += `\n§6About ${heading(player.location, marked[id])} of here.`;
    return line;
  });
  const body = lines.length
    ? `${lines.join("\n\n")}\n\n§8Towns and great ruins show a heading. Hidden places you must find from their description.`
    : "§7No leads yet. Tomes and people will point you to places.";
  const answer = await new ActionFormData().title("Leads").body(body).button("Back").show(player);
  if (!answer.canceled) return openLedger(player);
}

async function readView(player) {
  const p = progressOf(player);
  const lines = COLLECTIONS.map((col) => {
    const tomes = tomesOf(col.id);
    const read = tomes.filter((t) => p.read.includes(t.id));
    return `${col.color}${col.name}§r §7${read.length} / ${col.count}\n§8${read.map((t) => t.n).join(", ") || "none yet"}`;
  });
  const answer = await new ActionFormData()
    .title("Tomes read")
    .body(`${lines.join("\n\n")}\n\n§8To read a tome again, hold it or find it in a Library catalog.`)
    .button("Back")
    .show(player);
  if (!answer.canceled) return openLedger(player);
}

world.afterEvents.itemUse.subscribe((event) => {
  if (event.itemStack?.typeId !== LEDGER) return;
  openLedger(event.source).catch((e) => console.warn(`[Lore] ledger: ${e}`));
});
