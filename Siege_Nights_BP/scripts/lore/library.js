// The Library: Archive Shelves on your settlement hold Lore Tomes, each in one of six slots you can see.
// The shelf is a 3D bookcase two blocks high (studio/art/build_archive_shelf.py), made of two blocks like a door
// (siege:half lower / upper); each half is its own shelf of six slots: 0 1 2 on its upper board, 3 4 5 on its lower,
// left to right as you face it, each shown by its block state siege:slot_<n>. On the front: click an empty slot holding a
// tome to put it there, click a book to take it back. Sneak-click, click the sides or click an empty slot with an empty
// hand for the catalog. Another kind of book in hand gets a short note instead, so the click never looks ignored.

import { world, system, ItemStack, GameMode } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { emit, keepOf, isAlly, isReady, onTick, settlementAt } from "../siege/api.js";
import { isTesting } from "../core/tests.js";
import { TOME, TOMES, COLLECTION, tomesOf, hasReadAll, libraryRank, isLocal, loadSaved, stampSaved } /* saves carry a version: SAVE_VERSION in logic.js */ from "./logic.js";
import { COLLECTIONS, MILESTONES, PLACES, SITE_IDS, THREADS } from "./data/world.js";
import {
  TOME_ITEM, tomeIdOf, makeTome, progressOf, saveProgress, sourceSite, giveItem, awardPoints, setFlag, landOwnerAt, ensureLedger,
} from "./player.js";
import { readTome } from "./reader.js";
import { sfx } from "../core/sfx.js";
import { charge } from "../economy/coins.js";

export const SHELF = "siege:archive_shelf";
export const SHELF_SIZE = 6;
// If a playtest shows the books answering the slot mirrored left-to-right, flip this (not the model)
const SLOT_MIRROR = false;
export const COPY_COST = 20; // Regals for a fair copy of a tome you found once and lost
const WRONG_NAME_DAYS = 3; // days locked out after naming the wrong thin place

// ---------- Saved shelves: one property per settlement owner ----------
// "hc:lore_lib_<owner id>" -> { "x,y,z": [tome id or null, one per slot 0-5] }
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
const shelvesOf = (owner) => Object.entries(libOf(owner)).filter(([key, ids]) => ids.some(Boolean) && onLand(owner, key));
// Every tome id shelved anywhere in this owner's Library
export const shelvedIn = (owner) => shelvesOf(owner).flatMap(([, ids]) => ids.filter(Boolean));
// Every tome id in this owner's saved shelves, wherever they stand. Before the Keep Banner is up the land is not
// theirs yet, so shelvedIn misses the Library's own shelves; handing out books checks this so none comes twice.
export const storedIn = (owner) => Object.values(libOf(owner)).flat().filter(Boolean);
const countOf = (slots) => (slots ?? []).filter(Boolean).length;
const firstFree = (slots) => {
  for (let i = 0; i < SHELF_SIZE; i++) if (!slots?.[i]) return i;
  return -1;
};
// local books sit on the shelves but do not count toward the 75 or Library rank
export const libraryCount = (owner) => (owner ? shelvedIn(owner).filter((id) => !isLocal(id)).length : 0);

// Show a book in every slot that holds a tome
function showSlots(block, slots) {
  try {
    let perm = block.permutation;
    for (let i = 0; i < SHELF_SIZE; i++) perm = perm.withState(`siege:slot_${i}`, !!slots?.[i]);
    block.setPermutation(perm);
  } catch {}
}
const slotsShown = (block) => {
  try {
    return [...Array(SHELF_SIZE).keys()].map((i) => block.permutation.getState(`siege:slot_${i}`) === true);
  } catch {
    return [];
  }
};

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
  const slots = libOf(owner)[key] ?? [];
  const shown = slotsShown(block);
  if ([...Array(SHELF_SIZE).keys()].some((i) => !!slots[i] !== !!shown[i])) showSlots(block, slots);
  return true;
}

// ---------- Shelving ----------
// fromHand: true takes the held tome; false means the caller has already taken a blank one (shelveBlank)
// slot: the slot clicked, or undefined for the first free one
function shelve(player, block, owner, id, fromHand = true, slot = undefined) {
  const lib = libOf(owner);
  const key = keyOf(block.location);
  const tome = TOME[id];
  if (!tome) return;
  const container = player.getComponent("minecraft:inventory").container;
  const hand = player.selectedSlotIndex;
  if (fromHand && tomeIdOf(container.getItem(hand)) !== id) return; // the tome already left their hand
  // Only a copy on a shelf that is really still there counts as "already shelved"
  const holder = shelvesOf(owner).find(([k, ids]) => ids.includes(id) && checkShelf(block.dimension, owner, k));
  if (holder) {
    const where = holder[0] === key ? "on this shelf" : `on the shelf at ${holder[0].replaceAll(",", " ")}`;
    return player.onScreenDisplay.setActionBar(`§eYour Library already has §f${tome.title}§e, ${where}.`);
  }
  const here = lib[key] ?? [];
  const at = slot !== undefined && !here[slot] ? slot : firstFree(here);
  if (at < 0) return player.onScreenDisplay.setActionBar("§eThis shelf is full. Build another Archive Shelf.");

  if (fromHand) container.setItem(hand, undefined);
  lib[key] = here;
  here[at] = id;
  for (let i = 0; i < SHELF_SIZE; i++) here[i] ??= null;
  saveLib(owner);
  showSlots(block, here);

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
  const at = here.indexOf(id);
  if (at < 0) return;
  here[at] = null;
  if (!here.some(Boolean)) delete lib[key];
  saveLib(owner);
  showSlots(block, lib[key] ?? []);
  giveItem(player, makeTome(id));
  sfx(player, "item.book.page_turn");
  player.onScreenDisplay.setActionBar(`§7Took §f${TOME[id].title}§7 from the shelf.`);
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
  for (const id of here.filter(Boolean)) dimension.spawnItem(makeTome(id), at);
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

// ---------- The bookcase is two blocks high, like a door ----------
const above = (loc, dy) => ({ x: loc.x, y: loc.y + dy, z: loc.z });

// Breaking one half takes the other down too (one Archive Shelf item is the whole bookcase)
world.afterEvents.playerBreakBlock.subscribe((event) => {
  if (event.brokenBlockPermutation.type.id !== SHELF) return;
  const dim = event.block.dimension;
  const owner = ownerOfShelfAt(event.block.location);
  if (owner) spill(dim, event.block.location, owner);
  let half = "lower";
  try {
    half = event.brokenBlockPermutation.getState("siege:half") ?? "lower";
  } catch {}
  const other = above(event.block.location, half === "upper" ? -1 : 1);
  try {
    const partner = dim.getBlock(other);
    if (partner?.typeId !== SHELF) return;
    const partnerHalf = partner.permutation.getState("siege:half");
    if (partnerHalf === half) return; // two separate bookcases stacked, not this one's other half
    const partnerOwner = ownerOfShelfAt(other);
    if (partnerOwner) spill(dim, other, partnerOwner);
    partner.setType("minecraft:air");
  } catch {}
});

// Placing an Archive Shelf puts up both halves; with no room above, it goes back in the pack
world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
  if (block.typeId !== SHELF) return;
  try {
    const top = block.dimension.getBlock(above(block.location, 1));
    if (!top || !top.isAir) {
      block.setType("minecraft:air");
      if (player.getGameMode() !== GameMode.Creative) giveItem(player, new ItemStack(SHELF, 1));
      return player.onScreenDisplay.setActionBar("§eAn Archive Shelf is two blocks tall. It needs a free block above it.");
    }
    const facing = block.permutation.getState("minecraft:cardinal_direction");
    top.setPermutation(block.permutation.withState("siege:half", "upper").withState("minecraft:cardinal_direction", facing));
  } catch (e) {
    console.warn(`[Lore] shelf place: ${e}`);
  }
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
      else if (block) checkShelf(overworld, owner, key); // books shown in the right slots (old shelves had no slots)
    }
  }
});

// Place a shelf already holding tomes (used by the showcase). Tomes the Library already has are skipped.
export function stockShelf(block, owner, ids) {
  if (block.typeId !== SHELF) block.setType(SHELF); // a standing shelf keeps the way it faces
  const lib = libOf(owner);
  const have = storedIn(owner);
  const key = keyOf(block.location);
  // add to what the shelf already holds (a later local book joins the first one), never replace it
  const here = [...(lib[key] ?? [])];
  for (const id of ids.filter((t) => TOME[t] && !have.includes(t))) {
    const at = firstFree(here);
    if (at < 0) break;
    here[at] = id;
  }
  for (let i = 0; i < SHELF_SIZE; i++) here[i] ??= null;
  if (here.some(Boolean)) lib[key] = here;
  saveLib(owner);
  showSlots(block, here);
  return countOf(here);
}

// Books that are not Lore Tomes: clicking a shelf with one says so instead of opening the catalog
const OTHER_BOOKS = new Set([
  "minecraft:book", "minecraft:writable_book", "minecraft:written_book", "minecraft:enchanted_book",
  "siege:codex", "siege:ledger", "siege:kings_journal", "siege:plan_book",
]);

// A blank tome (the creative-menu copy has no pages). In Creative it becomes the first tome this Library
// is missing and goes straight on the shelf, so a builder can stock a Library for testing; in Survival it says why.
function shelveBlank(player, block, owner, slot = undefined) {
  if (player.getGameMode() !== GameMode.Creative) {
    return player.onScreenDisplay.setActionBar("§eThis tome is blank. Lore Tomes with pages are found out in the world.");
  }
  const have = shelvedIn(owner);
  const next = TOMES.find((t) => !isLocal(t.id) && !have.includes(t.id));
  if (!next) return player.onScreenDisplay.setActionBar("§eThis Library already holds every tome.");
  const container = player.getComponent("minecraft:inventory").container;
  const hand = player.selectedSlotIndex;
  const item = container.getItem(hand);
  if (item?.typeId !== TOME_ITEM || tomeIdOf(item)) return; // the blank tome already left their hand
  if (firstFree(libOf(owner)[keyOf(block.location)]) < 0) {
    return player.onScreenDisplay.setActionBar("§eThis shelf is full. Build another Archive Shelf.");
  }
  if (item.amount > 1) {
    item.amount -= 1;
    container.setItem(hand, item);
  } else {
    container.setItem(hand, undefined);
  }
  shelve(player, block, owner, next.id, false, slot);
}

// ---------- Clicking a shelf ----------
// Which slot a click on the shelf's front landed on: 0-5, or undefined for a click on a side, the top or the back.
// facing = the block's minecraft:cardinal_direction (the way its open front faces); face = the face clicked;
// at = where on that face, measured from the block's bottom north-west corner (0-1 on each axis).
export function slotAt(facing, face, at) {
  if (!facing || !at || String(face).toLowerCase() !== facing) return undefined;
  const u = { north: 1 - at.x, south: at.x, east: 1 - at.z, west: at.z }[facing]; // 0 at the viewer's left, 1 at their right
  if (u === undefined || Number.isNaN(u)) return undefined;
  let col = Math.min(2, Math.max(0, Math.floor(u * 3)));
  if (SLOT_MIRROR) col = 2 - col;
  const row = at.y >= 0.47 ? 0 : 1; // the middle board sits at 7-8 of 16
  return row * 3 + col;
}

function clickedSlot(event, block) {
  try {
    const facing = block.permutation.getState("minecraft:cardinal_direction");
    let at = event.faceLocation;
    if (!at) return undefined;
    // newer versions give the spot in world coordinates; make it relative to the block
    if ([at.x, at.y, at.z].some((v) => v < -0.01 || v > 1.01)) {
      at = { x: at.x - block.location.x, y: at.y - block.location.y, z: at.z - block.location.z };
    }
    return slotAt(facing, event.blockFace, at);
  } catch {
    return undefined;
  }
}

const lastClick = new Map();
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player } = event;
  if (block.typeId !== SHELF) return;
  event.cancel = true; // so a held tome isn't opened as well
  if (event.isFirstEvent === false) return;
  const now = system.currentTick;
  if (now - (lastClick.get(player.id) ?? -100) < 6) return;
  lastClick.set(player.id, now);
  const held = event.itemStack;
  const heldId = tomeIdOf(held);
  const blank = held?.typeId === TOME_ITEM && !heldId; // a tome from the creative menu: no pages yet
  const heldType = held?.typeId;
  const slot = clickedSlot(event, block);
  const sneaking = player.isSneaking;
  system.run(() => {
    try {
      const owner = landOwnerAt(block);
      if (!owner) return player.onScreenDisplay.setActionBar("§eAn Archive Shelf only works on settlement land.");
      const mine = owner === player.id || isAlly(owner, player.id);
      const key = keyOf(block.location);
      if (libOf(owner)[key]) checkShelf(block.dimension, owner, key); // redraw a shelf a rebuild emptied
      const inSlot = slot !== undefined ? libOf(owner)[key]?.[slot] : undefined;
      if (sneaking) return catalog(player, block, owner, mine).catch((e) => console.warn(`[Lore] catalog: ${e}`));
      if (heldId || blank) {
        if (!mine) return player.onScreenDisplay.setActionBar("§eOnly the owner and their allies can shelve tomes here.");
        if (inSlot) return player.onScreenDisplay.setActionBar(`§eThat slot holds §f${TOME[inSlot]?.title ?? "a tome"}§e. Click an empty one.`);
        if (heldId) return shelve(player, block, owner, heldId, true, slot);
        return shelveBlank(player, block, owner, slot);
      }
      // A book on the front: it comes back to your hand
      if (inSlot && !OTHER_BOOKS.has(heldType)) {
        if (!mine) return player.onScreenDisplay.setActionBar(`§7${TOME[inSlot]?.title ?? "A tome"}. Only the owner and their allies can take tomes down.`);
        return takeBack(player, block, owner, inSlot);
      }
      // Another book in hand would otherwise just open the catalog, which looks like the shelf ignoring it
      if (OTHER_BOOKS.has(heldType)) {
        return player.onScreenDisplay.setActionBar("§eOnly Lore Tomes go on an Archive Shelf. Click with an empty hand for the catalog.");
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
  const here = (libOf(owner)[keyOf(block.location)] ?? []).filter(Boolean);
  const canName = mine && [1, 2, 3, 4, 5, 6].every((n) => shelved.includes(`surv_0${n}`));

  let body = `§7Tomes shelved: §f${shelved.length} / ${TOMES.length}§7${rank ? `  (${rank.name})` : ""}`;
  if (next) body += `\n§7Next: §f${next.name}§7 at ${next.at} tomes`;
  body += "\n§7Click an empty slot on a shelf with a Lore Tome to put it there. Click a book to take it back.";

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
    else form.button(p.got.includes(t.id) && mine ? `§8${t.n}. ${t.title} §7(not shelved)` : `§8${t.n}. (missing)`);
  }
  form.button("Back");
  const answer = await form.show(player);
  if (answer.canceled) return;
  const tome = tomes[answer.selection];
  if (!tome) return catalog(player, block, owner, mine);
  if (shelved.includes(tome.id)) await readTome(player, tome.id);
  else if (mine && progressOf(player).got.includes(tome.id) && !carries(player, tome.id)) {
    // found once, but it is neither on a shelf nor in the pack: lost (burnt, dropped, despawned)
    const ask = new MessageFormData()
      .title(`${col.name}, no. ${tome.n}`)
      .body(`§7You found §f${tome.title}§7 once, but it is not on your shelves or in your pack.\n\nThe Library keeps a record of every book that passed through it. A fair copy can be made from it for §f${COPY_COST} Regals§7.`)
      .button1(`Have a copy made (${COPY_COST} Regals)`)
      .button2("Back");
    const picked = await ask.show(player);
    if (!picked.canceled && picked.selection === 0) {
      if (!charge(player, COPY_COST, "library_copy")) player.sendMessage(`§eA fair copy costs ${COPY_COST} Regals.`);
      else {
        giveItem(player, makeTome(tome.id));
        sfx(player, "item.book.page_turn");
        player.sendMessage(`§6A fair copy of §f${tome.title}§6 is in your pack. Shelve it to keep it safe.`);
      }
    }
  } else {
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

// Is a copy of this tome in the player's pack?
function carries(player, id) {
  const container = player.getComponent("minecraft:inventory")?.container;
  if (!container) return false;
  for (let i = 0; i < container.size; i++) if (tomeIdOf(container.getItem(i)) === id) return true;
  return false;
}

async function takeView(player, block, owner) {
  const here = (libOf(owner)[keyOf(block.location)] ?? []).filter(Boolean);
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
