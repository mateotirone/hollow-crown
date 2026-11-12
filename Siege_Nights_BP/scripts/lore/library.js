// The Library: Archive Shelves on your settlement hold Lore Tomes and fill up visibly.
// Click a shelf holding a tome to shelve it. Click with anything else to open the catalog.

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { emit, keepOf, isAlly, isReady, onTick, settlementAt } from "../siege/api.js";
import { isTesting } from "../core/tests.js";
import { TOME, TOMES, COLLECTION, tomesOf, hasReadAll, libraryRank, isLocal, loadSaved, stampSaved } /* saves carry a version: SAVE_VERSION in logic.js */ from "./logic.js";
import { COLLECTIONS, MILESTONES, PLACES, SITE_IDS, THREADS } from "./data/world.js";
import {
  tomeIdOf, makeTome, progressOf, saveProgress, sourceSite, giveItem, awardPoints, setFlag, landOwnerAt, ensureLedger,
} from "./player.js";
import { readTome } from "./reader.js";
import { sfx } from "../core/sfx.js";

export const SHELF = "siege:archive_shelf";
export const SHELF_SIZE = 6;
const WRONG_NAME_DAYS = 3; // days locked out after naming the wrong thin place

// ---------- Saved shelves: one property per settlement owner ----------
// "hc:lore_lib_<owner id>" -> { "x,y,z": [tome ids] }
const libs = new Map();
const propOf = (owner) => `hc:lore_lib_${owner}`;
const keyOf = (loc) => `${loc.x},${loc.y},${loc.z}`;

function libOf(owner) {
  let lib = libs.get(owner);
  if (!lib) {
    const raw = world.getDynamicProperty(propOf(owner));
    lib = loadSaved("library", raw) ?? {};
    libs.set(owner, lib);
  }
  return lib;
}
function saveLib(owner) {
  if (isTesting()) return;
  const lib = libOf(owner);
  world.setDynamicProperty(propOf(owner), Object.keys(lib).length ? stampSaved("library", lib) : undefined);
}

const locOf = (key) => {
  const [x, y, z] = key.split(",").map(Number);
  return { x, y, z };
};
// A shelf only counts toward an owner's Library while it stands on that owner's land. Shelves stocked
// somewhere else (the showcase puts full shelves wherever you stand) or left behind on land that is no
// longer theirs used to count too, so a tome sitting out there blocked shelving the real one at home.
const onLand = (owner, key) => !isReady() || settlementAt(locOf(key)) === owner;
// [key, tome ids] for every shelf in this owner's Library
const shelvesOf = (owner) => Object.entries(libOf(owner)).filter(([key, ids]) => ids.length && onLand(owner, key));
// Every tome id shelved anywhere in this owner's Library
export const shelvedIn = (owner) => shelvesOf(owner).flatMap(([, ids]) => ids);
// local books sit on the shelves but do not count toward the 74 or Library rank
export const libraryCount = (owner) => (owner ? shelvedIn(owner).filter((id) => !isLocal(id)).length : 0);

function showFill(block, count) {
  try {
    block.setPermutation(block.permutation.withState("siege:fill", Math.min(SHELF_SIZE, count)));
  } catch {}
}

// Make sure a saved shelf is still real. A shelf that is gone (broken by a command, a stamp or an
// explosion since the last sweep) spills its tomes and stops counting. One that was put back by a
// rebuild shows empty although the save still holds its tomes, so its front is redrawn to match.
// Returns true if the shelf is (as far as we can tell) still standing.
function checkShelf(dimension, owner, key) {
  const loc = locOf(key);
  let block;
  try {
    block = dimension.getBlock(loc);
  } catch {}
  if (!block) return true; // not loaded: trust the save
  if (block.typeId !== SHELF) {
    spill(dimension, loc, owner);
    return false;
  }
  const count = libOf(owner)[key]?.length ?? 0;
  let shown;
  try {
    shown = block.permutation.getState("siege:fill");
  } catch {}
  if (shown !== Math.min(SHELF_SIZE, count)) showFill(block, count);
  return true;
}

// ---------- Shelving ----------
function shelve(player, block, owner, id) {
  const lib = libOf(owner);
  const key = keyOf(block.location);
  const tome = TOME[id];
  if (!tome) return;
  const container = player.getComponent("minecraft:inventory").container;
  const slot = player.selectedSlotIndex;
  if (tomeIdOf(container.getItem(slot)) !== id) return; // the tome already left their hand
  // Only a copy on a shelf that is really still there counts as "already shelved"
  const holder = shelvesOf(owner).find(([k, ids]) => ids.includes(id) && checkShelf(block.dimension, owner, k));
  if (holder) {
    const where = holder[0] === key ? "on this shelf" : `on the shelf at ${holder[0].replaceAll(",", " ")}`;
    return player.onScreenDisplay.setActionBar(`§eYour Library already has §f${tome.title}§e, ${where}.`);
  }
  const here = lib[key] ?? [];
  if (here.length >= SHELF_SIZE) return player.onScreenDisplay.setActionBar("§eThis shelf is full. Build another Archive Shelf.");

  container.setItem(slot, undefined);
  lib[key] = here;
  here.push(id);
  saveLib(owner);
  showFill(block, here.length);

  const col = COLLECTION[tome.col];
  const have = tomesOf(tome.col).filter((t) => shelvedIn(owner).includes(t.id)).length;
  const total = libraryCount(owner);
  sfx(player, "item.book.put");
  player.sendMessage(`§6Shelved §f${tome.title}§6. ${col.name}: §f${have}/${col.count}§6. Library: §f${total}/${TOMES.length}`);
  if (have === col.count) {
    player.sendMessage(`§a${col.name} is complete! Open the catalog to claim its reward.`);
    sfx(player, "random.levelup");
  }
  const rank = libraryRank(total);
  if (rank?.at === total) player.sendMessage(`§aYour collection is now a ${rank.name}. Open the catalog to see what turned up.`);
  emit("loreShelved", { player, owner, tome: id, total });
}

function takeBack(player, block, owner, id) {
  const lib = libOf(owner);
  const key = keyOf(block.location);
  const here = lib[key] ?? [];
  if (!here.includes(id)) return;
  lib[key] = here.filter((t) => t !== id);
  if (!lib[key].length) delete lib[key];
  saveLib(owner);
  showFill(block, lib[key]?.length ?? 0);
  giveItem(player, makeTome(id));
  sfx(player, "item.book.page_turn");
}

// A shelf that was broken (or blown up) spills its tomes
function spill(dimension, location, owner) {
  const lib = libOf(owner);
  const key = keyOf(location);
  const here = lib[key];
  if (!here) return;
  delete lib[key];
  saveLib(owner);
  const at = { x: location.x + 0.5, y: location.y + 0.5, z: location.z + 0.5 };
  for (const id of here) dimension.spawnItem(makeTome(id), at);
}

function ownerOfShelfAt(location) {
  const key = keyOf(location);
  for (const id of world.getDynamicPropertyIds()) {
    if (!id.startsWith("hc:lore_lib_")) continue;
    const owner = id.slice("hc:lore_lib_".length);
    if (libOf(owner)[key]) return owner;
  }
  return undefined;
}

world.afterEvents.playerBreakBlock.subscribe((event) => {
  if (event.brokenBlockPermutation.type.id !== SHELF) return;
  const owner = ownerOfShelfAt(event.block.location);
  if (owner) spill(event.block.dimension, event.block.location, owner);
});

// Shelves lost to explosions, pistons or commands: check the loaded ones now and then
onTick("lore shelves", 200, () => {
  if (!isReady()) return;
  const overworld = world.getDimension("overworld");
  for (const id of world.getDynamicPropertyIds()) {
    if (!id.startsWith("hc:lore_lib_")) continue;
    const owner = id.slice("hc:lore_lib_".length);
    for (const key of Object.keys(libOf(owner))) {
      const [x, y, z] = key.split(",").map(Number);
      let block;
      try {
        block = overworld.getBlock({ x, y, z });
      } catch {}
      if (block && block.typeId !== SHELF) spill(overworld, { x, y, z }, owner);
    }
  }
});

// Place a shelf already holding tomes (used by the showcase). Tomes the Library already has are skipped.
export function stockShelf(block, owner, ids) {
  block.setType(SHELF);
  const lib = libOf(owner);
  const have = shelvedIn(owner);
  const here = ids.filter((id) => TOME[id] && !have.includes(id)).slice(0, SHELF_SIZE);
  if (here.length) lib[keyOf(block.location)] = here;
  saveLib(owner);
  showFill(block, here.length);
}

// ---------- Clicking a shelf ----------
const lastClick = new Map();
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player } = event;
  if (block.typeId !== SHELF) return;
  event.cancel = true; // so a held tome isn't opened as well
  if (event.isFirstEvent === false) return;
  const now = system.currentTick;
  if (now - (lastClick.get(player.id) ?? -100) < 6) return;
  lastClick.set(player.id, now);
  const heldId = tomeIdOf(event.itemStack);
  system.run(() => {
    try {
      const owner = landOwnerAt(block);
      if (!owner) return player.onScreenDisplay.setActionBar("§eAn Archive Shelf only works on settlement land.");
      const mine = owner === player.id || isAlly(owner, player.id);
      if (libOf(owner)[keyOf(block.location)]) checkShelf(block.dimension, owner, keyOf(block.location)); // redraw a shelf a rebuild emptied
      if (heldId) {
        if (!mine) return player.onScreenDisplay.setActionBar("§eOnly the owner and their allies can shelve tomes here.");
        return shelve(player, block, owner, heldId);
      }
      catalog(player, block, owner, mine).catch((e) => console.warn(`[Lore] catalog: ${e}`));
    } catch (e) {
      console.warn(`[Lore] shelf click: ${e}`);
    }
  });
});

// ---------- The catalog ----------
const libraryName = (owner) => `Library of ${keepOf(owner)?.name ?? "the Keep"}`;

function readyRewards(player, owner) {
  const p = progressOf(player);
  const shelved = shelvedIn(owner);
  const ready = [];
  for (const col of COLLECTIONS) {
    if (p.claimed.includes(`col:${col.id}`)) continue;
    if (tomesOf(col.id).every((t) => shelved.includes(t.id)) && hasReadAll(p, col.id)) ready.push({ kind: "col", col });
  }
  for (const m of MILESTONES) {
    if (!p.claimed.includes(`mile:${m.at}`) && shelved.length >= m.at) ready.push({ kind: "mile", m });
  }
  return ready;
}

async function catalog(player, block, owner, mine) {
  const shelved = shelvedIn(owner);
  const rank = libraryRank(shelved.length);
  const next = MILESTONES.find((m) => m.at > shelved.length);
  const ready = mine ? readyRewards(player, owner) : [];
  const here = libOf(owner)[keyOf(block.location)] ?? [];
  const canName = mine && [1, 2, 3, 4, 5, 6].every((n) => shelved.includes(`surv_0${n}`));

  let body = `§7Tomes shelved: §f${shelved.length} / ${TOMES.length}§7${rank ? `  (${rank.name})` : ""}`;
  if (next) body += `\n§7Next: §f${next.name}§7 at ${next.at} tomes`;
  body += "\n§7Hold a Lore Tome and click a shelf to add it.";

  const form = new ActionFormData().title(libraryName(owner)).body(body);
  const actions = [];
  if (ready.length) {
    form.button(`§2Claim rewards (${ready.length})`);
    actions.push(() => claimAll(player, owner, ready));
  }
  for (const col of COLLECTIONS) {
    const have = tomesOf(col.id).filter((t) => shelved.includes(t.id)).length;
    form.button(`${col.name}\n${have === col.count ? "§2Complete" : `${have} / ${col.count}`}`);
    actions.push(() => collectionView(player, block, owner, mine, col));
  }
  if (canName) {
    form.button("§5Name the Thin Place");
    actions.push(() => nameThePlace(player, owner));
  }
  if (mine && here.length) {
    form.button(`Take a tome from this shelf (${here.length})`);
    actions.push(() => takeView(player, block, owner));
  }
  const answer = await form.show(player);
  if (answer.canceled) return;
  return actions[answer.selection]?.();
}

async function collectionView(player, block, owner, mine, col) {
  const shelved = shelvedIn(owner);
  const p = progressOf(player);
  const tomes = tomesOf(col.id);
  const have = tomes.filter((t) => shelved.includes(t.id)).length;
  const form = new ActionFormData()
    .title(`${col.color}${col.name}`)
    .body(`${col.blurb}\n\n§7Shelved: §f${have} / ${col.count}§7. Tomes you have not read to the end are marked §e*§7.`);
  for (const t of tomes) {
    if (shelved.includes(t.id)) form.button(`${t.n}. ${t.title}${p.read.includes(t.id) ? "" : " §e*"}`);
    else form.button(`§8${t.n}. (missing)`);
  }
  form.button("Back");
  const answer = await form.show(player);
  if (answer.canceled) return;
  const tome = tomes[answer.selection];
  if (!tome) return catalog(player, block, owner, mine);
  if (shelved.includes(tome.id)) await readTome(player, tome.id);
  else {
    const hint = new MessageFormData()
      .title(`${col.name}, no. ${tome.n}`)
      .body(`§7This tome is not in the Library yet.\n\n§fWhere such a thing might be kept:§r\n${tome.hint}`)
      .button1("Back")
      .button2("Close");
    const picked = await hint.show(player);
    if (picked.canceled || picked.selection === 1) return;
  }
  return collectionView(player, block, owner, mine, col);
}

async function takeView(player, block, owner) {
  const here = libOf(owner)[keyOf(block.location)] ?? [];
  const form = new ActionFormData().title("Take a tome").body("Which tome do you want back in your hands?");
  for (const id of here) form.button(TOME[id].title);
  form.button("Cancel");
  const answer = await form.show(player);
  if (answer.canceled || !here[answer.selection]) return;
  takeBack(player, block, owner, here[answer.selection]);
}

function claimAll(player, owner, ready) {
  const p = progressOf(player);
  for (const r of ready) {
    const reward = r.kind === "col" ? r.col.reward : r.m;
    const key = r.kind === "col" ? `col:${r.col.id}` : `mile:${r.m.at}`;
    if (p.claimed.includes(key)) continue;
    p.claimed.push(key);
    const name = r.kind === "col" ? r.col.name : r.m.name;
    player.sendMessage(`§a${r.kind === "col" ? "Collection complete" : "Library grown"}: §f${name}§r\n§7${reward.text}`);
    for (const typeId of reward.items ?? []) {
      if (typeId === "siege:ledger") ensureLedger(player);
      else giveItem(player, new ItemStack(typeId, 1));
    }
    if (reward.flag) setFlag(player, reward.flag);
    awardPoints(player, reward.sp ?? 0, `library:${r.kind === "col" ? r.col.id : r.m.at}`, reward.renown ?? 0);
    emit("loreReward", { player, owner, kind: r.kind, id: r.kind === "col" ? r.col.id : r.m.at });
  }
  saveProgress(player);
  sfx(player, "random.levelup");
}

// ---------- Naming the thin place ----------
const sourceThread = THREADS.find((t) => t.id === "source");

async function nameThePlace(player, owner) {
  const p = progressOf(player);
  if (p.solved.includes("source")) return player.sendMessage(`§5You already named it: §f${PLACES[sourceSite()].name}§5.`);
  const day = world.getDay();
  if ((p.locks.source ?? 0) > day) {
    return player.sendMessage(`§7You named the wrong place. You can try again in ${p.locks.source - day} day(s). Read the six field notes again.`);
  }
  const unread = [1, 2, 3, 4, 5, 6].filter((n) => !p.read.includes(`surv_0${n}`));
  if (unread.length) return player.sendMessage(`§7Read all six of the Surveyor's Field Notes yourself first (you are missing no. ${unread.join(", ")}).`);

  const form = new ActionFormData()
    .title("Name the Thin Place")
    .body(`Brother Fennick wrote six true things about the place where the Gate now sits. Seven thin places. Which one fits all six?\n\n§cName it wrong and you lose ${WRONG_NAME_DAYS} days.`);
  for (const id of SITE_IDS) form.button(`${PLACES[id].name}\n§8${PLACES[id].region}`);
  form.button("Not yet");
  const answer = await form.show(player);
  if (answer.canceled || !SITE_IDS[answer.selection]) return;
  const guess = SITE_IDS[answer.selection];
  const real = sourceSite();
  if (guess !== real) {
    p.locks.source = day + WRONG_NAME_DAYS;
    saveProgress(player);
    sfx(player, "block.bell.hit");
    player.sendMessage(`§cYou write "${PLACES[guess].name}" in the catalog. Somewhere far below, a bell rings once, and the ink runs. That is not the place. (Try again in ${WRONG_NAME_DAYS} days.)`);
    emit("loreSourceMisnamed", { player, guess });
    return;
  }
  p.solved.push("source");
  if (!p.leads.includes(real)) p.leads.push(real);
  saveProgress(player);
  setFlag(player, "source_named");
  sfx(player, "random.toast");
  player.sendMessage(`§5${PLACES[real].name}.§r §7${sourceThread.solved}`);
  awardPoints(player, sourceThread.sp, "mystery:source", 60);
  emit("loreThreadSolved", { player, thread: "source" });
  emit("loreSourceNamed", { player, owner, site: real });
}
