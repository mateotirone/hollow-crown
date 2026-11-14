// The Sorcerer's magic hotbar.
//
// Right-click the Bound Ember, or double-tap sneak: your first eight hotbar slots are packed into a hidden satchel
// and one spell icon per power you know takes their place. The Ember stays where it always is, locked in slot 9
// (keepsake.js). Scroll to a spell, right-click to cast it; each icon shows its cooldown. Right-click the Ember
// again, double-tap sneak, or sneak + right-click a spell to get your hotbar back.
//
// Safety: the satchel is a model-less entity (siege:spell_satchel) that follows you. Your own items are never
// copied or deleted, only swapped between your hotbar and it. They come back by themselves on death (dropped
// where you fell, or kept if keepInventory is on), and when you rejoin after logging off or a restart.
// Spell icons are locked to their slot, kept on death, and cleared whenever the bar shuts.

import { world, system, ItemStack, ItemLockMode } from "@minecraft/server";
import * as api from "../siege/api.js";
import { addTests, assertEqual } from "../core/tests.js";
import { sfx } from "../core/sfx.js";
import { SKILLS } from "./skills.js";
import { heroOf, saveHero } from "./hero.js";
import { BOUND_EMBER } from "./tree.js";
import { cast, cooldownLeft, isMarkedPlayer } from "./marked.js";
import { POWER_KEY } from "./marked_fx.js";
import { KEEP_SLOT, onDoubleSneak, settleKeepsake } from "./keepsake.js";

export const SATCHEL = "siege:spell_satchel";
const OPEN_PROP = "hc:spellbar"; // on the player: "open" while the bar is up
const SATCHEL_TAG = (id) => `hc_satchel_${id}`;
const SPELL_PREFIX = "siege:spell_";
const POWERS = SKILLS.filter((s) => s.power).map((s) => s.id);
export const spellItem = (skill) => `${SPELL_PREFIX}${POWER_KEY[skill]}`;
export const skillOfItem = (typeId) => Object.keys(POWER_KEY).find((id) => spellItem(id) === typeId);
export const isSpellItem = (typeId) => typeof typeId === "string" && typeId.startsWith(SPELL_PREFIX);

/** Which item goes in each of the nine slots, for the powers a player knows. Pure, for the self-tests. */
export function barLayout(skills) {
  const slots = POWERS.filter((id) => (skills[id] ?? 0) > 0 && POWER_KEY[id]).slice(0, 8).map(spellItem);
  while (slots.length < 8) slots.push(undefined);
  slots.push(BOUND_EMBER);
  return slots;
}

const isOpen = (player) => player.getDynamicProperty(OPEN_PROP) === "open";
const held = new Map(); // player id -> ItemStack[9] kept through a death with keepInventory on
const inv = (entity) => entity?.getComponent("minecraft:inventory")?.container;

function findSatchel(player, range = 96) {
  try {
    return player.dimension.getEntities({ type: SATCHEL, tags: [SATCHEL_TAG(player.id)], location: player.location, maxDistance: range })[0];
  } catch {
    return undefined;
  }
}

// a slot item that belongs to the bar (a spell icon) and goes away when it shuts; the sworn Ember is not ours
const ours = (item) => item && isSpellItem(item.typeId);

function lockedItem(typeId) {
  const item = new ItemStack(typeId, 1);
  try {
    item.lockMode = ItemLockMode.slot;
    item.keepOnDeath = true;
  } catch {
    // older engine: still works, just not locked
  }
  return item;
}

function clearBar(player) {
  const c = inv(player);
  if (!c) return;
  for (let i = 0; i < KEEP_SLOT; i++) if (ours(c.getItem(i))) c.setItem(i, undefined);
}

/** Put items (from the satchel or kept through a death) back into the hotbar; anything in the way goes to the inventory or the ground. */
function giveBack(player, items) {
  const c = inv(player);
  for (let i = 0; i < 9; i++) {
    const item = items[i];
    if (!item) continue;
    if (i === KEEP_SLOT && item.typeId === BOUND_EMBER) continue; // a satchel from before the Ember was sworn to slot 9
    let left = item;
    if (!c.getItem(i)) {
      c.setItem(i, item);
      left = undefined;
    } else left = c.addItem(item);
    if (left) player.dimension.spawnItem(left, player.location);
  }
}

export function openBar(player) {
  if (isOpen(player)) return;
  const hero = heroOf(player);
  const layout = barLayout(hero.skills);
  if (!layout.some((t) => t && t !== BOUND_EMBER)) return player.onScreenDisplay.setActionBar("§7You know no power yet. Swear one at the Tree of Oaths (Arcana).");
  const c = inv(player);
  if (!c) return;
  let satchel;
  try {
    satchel = player.dimension.spawnEntity(SATCHEL, player.location);
    satchel.addTag(SATCHEL_TAG(player.id));
    satchel.addTag("hc_satchel");
  } catch {
    return player.onScreenDisplay.setActionBar("§7The Ember will not open here.");
  }
  const bag = inv(satchel);
  for (let i = 0; i < KEEP_SLOT; i++) c.swapItems(i, i, bag); // your hotbar, untouched, into the satchel
  player.setDynamicProperty(OPEN_PROP, "open");
  layout.forEach((typeId, i) => typeId && i < KEEP_SLOT && c.setItem(i, lockedItem(typeId)));
  settleKeepsake(player); // the Ember is in slot 9, as always
  try {
    player.selectedSlotIndex = 0;
  } catch {
    // read-only on some engines
  }
  for (const id of POWERS) {
    const left = cooldownLeft(player, id);
    if (left > 0 && POWER_KEY[id]) startCooldown(player, id, left);
  }
  sfx(player, "cast.open");
  player.onScreenDisplay.setActionBar("§5The Ember wakes.§7 Scroll to a power, use it to cast. Use the Ember, or double-tap sneak, to put it away.");
}

export function closeBar(player, { quiet = false } = {}) {
  const satchel = findSatchel(player);
  clearBar(player);
  if (satchel) {
    const bag = inv(satchel);
    const items = [];
    for (let i = 0; i < 9; i++) items.push(bag.getItem(i));
    for (let i = 0; i < 9; i++) bag.setItem(i, undefined);
    giveBack(player, items);
    try {
      satchel.remove();
    } catch {
      // gone already
    }
  } else if (isOpen(player)) {
    player.sendMessage("§7Your hotbar is still in the Ember's satchel, back where you opened it. It returns when you come near it again.");
    player.setDynamicProperty("hc:spellbar_lost", "1");
  }
  player.setDynamicProperty(OPEN_PROP, undefined);
  if (!quiet) sfx(player, "cast.close");
}

export function startCooldown(player, skill, ticks) {
  try {
    player.startItemCooldown(`siege_spell_${POWER_KEY[skill]}`, Math.max(1, Math.round(ticks)));
  } catch {
    // no cooldown sweep on this engine; the action bar still says when it is ready
  }
}

// ---------- using the Ember and the spell icons ----------

world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  const type = event.itemStack?.typeId;
  if (type === BOUND_EMBER) {
    if (!isMarkedPlayer(player)) return player.onScreenDisplay.setActionBar("§7It hums, but not for you.");
    return isOpen(player) ? closeBar(player) : openBar(player);
  }
  if (!isSpellItem(type)) return;
  if (player.isSneaking && isOpen(player)) return closeBar(player);
  if (!isMarkedPlayer(player)) return player.onScreenDisplay.setActionBar("§7It hums, but not for you.");
  const skill = skillOfItem(type);
  if (!skill) return;
  const hero = heroOf(player);
  hero.spell = skill;
  saveHero(player);
  if (cast(player, skill)) startCooldown(player, skill, cooldownLeft(player, skill));
});

// double-tap sneak, anywhere: the same as using the Ember
onDoubleSneak((player) => {
  if (!isMarkedPlayer(player)) return;
  return isOpen(player) ? closeBar(player) : openBar(player);
});

// ---------- deaths, rejoins, and keeping the satchel with you ----------

world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  if (deadEntity?.typeId !== "minecraft:player") return;
  const player = deadEntity;
  try {
    if (!isOpen(player)) return;
    const satchel = findSatchel(player);
    const items = [];
    if (satchel) {
      const bag = inv(satchel);
      for (let i = 0; i < 9; i++) items.push(bag.getItem(i));
      for (let i = 0; i < 9; i++) bag.setItem(i, undefined);
      satchel.remove();
    }
    if (world.gameRules?.keepInventory) held.set(player.id, items);
    else for (const item of items) if (item) satchel?.dimension.spawnItem(item, player.location) ?? player.dimension.spawnItem(item, player.location);
    player.setDynamicProperty(OPEN_PROP, satchel ? "dead" : "open");
  } catch {
    // keep going: the rejoin check below will still look for the satchel
  }
});

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  system.runTimeout(() => {
    if (!player.isValid) return;
    const state = player.getDynamicProperty(OPEN_PROP);
    if (state === "dead") {
      clearBar(player);
      const items = held.get(player.id);
      held.delete(player.id);
      if (items) giveBack(player, items);
      player.setDynamicProperty(OPEN_PROP, undefined);
    } else if (state === "open") closeBar(player, { quiet: true }); // logged off with the bar up, or died away from the satchel
    else if (!state) clearBar(player); // stray icons (a crash between swaps): never leave them about
  }, initialSpawn ? 40 : 5);
});

export function spellbarTick() {
  for (const player of world.getPlayers()) {
    if (player.getDynamicProperty("hc:spellbar_lost")) {
      const satchel = findSatchel(player, 24);
      if (satchel) {
        player.setDynamicProperty(OPEN_PROP, "open");
        player.setDynamicProperty("hc:spellbar_lost", undefined);
        closeBar(player, { quiet: true });
        player.sendMessage("§7Your hotbar is back from the Ember's satchel.");
      }
      continue;
    }
    if (!isOpen(player) || !player.isValid) continue;
    const satchel = findSatchel(player, 256);
    try {
      if (satchel) satchel.teleport(player.location, { dimension: player.dimension });
      else {
        // changed dimension or out of range: look in every dimension and bring it along
        for (const id of ["overworld", "nether", "the_end", "siege:undertow"]) {
          let dim;
          try {
            dim = world.getDimension(id);
          } catch {
            continue;
          }
          const found = dim.getEntities({ type: SATCHEL, tags: [SATCHEL_TAG(player.id)] })[0];
          if (found) {
            found.teleport(player.location, { dimension: player.dimension });
            break;
          }
        }
      }
    } catch {
      // try again next second
    }
  }
}

api.onTick("townhall_spellbar", 20, spellbarTick);

addTests("townhall", {
  "magic hotbar puts known powers first and the Ember in slot 9": () => {
    const slots = barLayout({ arc_bolt: 1, arc_blink: 2, arc_quiet: 3 });
    assertEqual(slots.length, 9);
    assertEqual(slots[0], "siege:spell_bolt");
    assertEqual(slots[1], "siege:spell_blink");
    assertEqual(slots[2], undefined);
    assertEqual(slots[8], BOUND_EMBER);
  },
  "every power has a spell icon and it maps back to its skill": () => {
    for (const id of POWERS) assertEqual(skillOfItem(spellItem(id)), id);
  },
});
