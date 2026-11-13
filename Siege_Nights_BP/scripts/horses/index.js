// Horses for The Hollow Crown: steeds you raise (breeds, training, gear, perks, breeding), the Stables,
// Breeder's Posts, the Knight Warhorse and the Glimstrider.
// The full design is in the "Hollow Crown: Horses and Rail Network" doc. Numbers to tweak: data.js.

import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { onTick, isReady, settlementAt, isAlly, keepOf, consumeHeld, addKeepMenuButtons } from "../siege/api.js";
import {
  HORSE_SETTINGS as S, BREEDS, REGIONAL_BREEDS, TRAITS, GEAR_ITEMS, SHOES, SADDLES, HALTER, WHISTLE, CROP, CAPARISON,
  SPEED_VALUES, HEALTH_VALUES, levelFromValue, newRecord, hasPerk, rosterCap, costText,
} from "./data.js";
import { recordOf, horsesOf, saveRecord, newUid, meta, stablesLevelFor, rosterRoom } from "./store.js";
import { STEED, uidOf, valid, entityOf, spawnSteed, applyRecord, readGear, refresh, scanSteeds, bannerColorOf } from "./steed.js";
import { ridingTick, useCrop, undertowStep, mountOf } from "./riding.js";
import { horseMenu, stablesMenu, buyFoal, give, pay, isBuilder, sheetText } from "./menus.js";
import "./tests.js";
import "./showcase.js";
import { useStablesLevel } from "./barn.js";
import { sfx } from "../core/sfx.js";
import { regionAt } from "../economy/shops.js";

export { stallMenu } from "./menus.js"; // the rail stations use the same stalls
export { isGalloping } from "./riding.js";

export const STABLES = "siege:stables";
useStablesLevel((owner) => meta.data.stables[owner] ?? 1);
export const BREEDER_POST = "hc:breeder_post";

const say = (player, text) => player.onScreenDisplay.setActionBar(text);
const posKey = (loc) => `${loc.x},${loc.y},${loc.z}`;
const above = (block) => ({ dimension: block.dimension, location: { x: block.location.x + 0.5, y: block.location.y + 1, z: block.location.z + 0.5 } });

// ---------- Halter: make a tamed horse (or a free steed) yours ----------

function register(player, horse) {
  if (!valid(horse)) return;
  const vanilla = horse.typeId === "minecraft:horse";
  if (vanilla) {
    if (!horse.getComponent("minecraft:is_tamed")) return say(player, "§7Tame the horse first, then use the Halter.");
    if (horse.getComponent("minecraft:is_baby")) return say(player, "§7Wait until it has grown up.");
  }
  if (rosterRoom(player.id) <= 0) {
    return say(player, `§cYour stalls are full (${rosterCap(stablesLevelFor(player.id))}). ${stablesLevelFor(player.id) ? "Upgrade your Stables" : "Build a Stables"} to keep more horses.`);
  }
  const rec = newRecord({ uid: newUid(), owner: player.id, ownerName: player.name });
  if (vanilla) {
    const speed = horse.getComponent("minecraft:movement")?.defaultValue ?? 0.225;
    const health = horse.getComponent("minecraft:health")?.effectiveMax ?? 22;
    rec.stats = { speed: levelFromValue(speed, SPEED_VALUES), jump: 2, health: levelFromValue(health, HEALTH_VALUES), stamina: 1 };
    rec.coat = horse.getComponent("minecraft:variant")?.value ?? 3;
    rec.mark = horse.getComponent("minecraft:mark_variant")?.value ?? 0;
    if (horse.nameTag) rec.name = horse.nameTag.slice(0, 24);
    const gear = readGear(horse);
    rec.gearSaddle = gear.saddle;
    rec.gearArmor = gear.armor;
    const at = horse.location, dim = horse.dimension, turn = horse.getRotation().y;
    horse.remove();
    spawnSteed(rec, dim, at, turn);
  } else {
    rec.coat = horse.getProperty("siege:coat") ?? 3;
    rec.mark = horse.getProperty("siege:mark") ?? 0;
    rec.gen = 1;
    rec.status = "out";
    applyRecord(horse, rec);
    saveRecord(rec);
  }
  sfx(player, "random.levelup");
  player.sendMessage(`§6${rec.name} is now your steed. Ride to earn it levels, and train it at a Stables. Sneak and click it with an empty hand to see its sheet.`);
}

// ---------- Gear ----------

function fitGear(player, entity, rec, itemId) {
  const gear = GEAR_ITEMS[itemId];
  const table = gear.slot === "shoes" ? SHOES : SADDLES;
  if (rec[gear.slot] === gear.key) return say(player, `§7${rec.name} already wears that.`);
  const old = table[rec[gear.slot]].item;
  consumeHeld(player);
  if (old) give(player, old);
  rec[gear.slot] = gear.key;
  refresh(rec);
  sfx(entity.dimension, "armor.equip_iron", entity.location);
  say(player, `§6${rec.name} is fitted with ${table[gear.key].name}.`);
}

function fitCaparison(player, entity, rec) {
  const color = bannerColorOf(rec.owner);
  if (rec.caparison === color) return say(player, `§7${rec.name} already wears your colors.`);
  if (!rec.caparison) consumeHeld(player);
  rec.caparison = color;
  refresh(rec);
  sfx(entity.dimension, "armor.equip_leather", entity.location);
  say(player, `§6${rec.name} wears your banner's colors.`);
}

// ---------- Clicking a horse ----------

function onHorseClick(event) {
  const { player, target, itemStack } = event;
  const item = itemStack?.typeId;
  if (target.typeId === "minecraft:horse") {
    if (item !== HALTER) return;
    event.cancel = true;
    return system.run(() => register(player, target));
  }
  if (target.typeId !== STEED) return;
  const rec = recordOf(uidOf(target));
  if (!rec) {
    if (item !== HALTER) return; // a free steed: anyone may ride it
    event.cancel = true;
    return system.run(() => register(player, target));
  }
  const mine = rec.owner === player.id;
  if (!mine && !isAlly(rec.owner, player.id)) {
    event.cancel = true;
    return system.run(() => say(player, `§c${rec.name} belongs to ${rec.ownerName}.`));
  }
  if (GEAR_ITEMS[item] || item === CAPARISON) {
    event.cancel = true;
    return system.run(() => {
      if (!valid(target)) return;
      if (!mine) return say(player, "§7Only its owner can change a horse's gear.");
      if (item === CAPARISON) fitCaparison(player, target, rec);
      else fitGear(player, target, rec, item);
    });
  }
  if (item === HALTER || (player.isSneaking && !item)) {
    event.cancel = true;
    return system.run(() => horseMenu(player, rec, undefined));
  }
}
world.beforeEvents.playerInteractWithEntity?.subscribe(onHorseClick);

// ---------- Riding Crop and Horse Whistle ----------

const whistled = new Map(); // player id -> tick the Loyal call is ready again

function whistle(player) {
  if (undertowStep(player)) return;
  if (mountOf(player)) return;
  const mine = horsesOf(player.id).filter((r) => r.status !== "fallen" && !r.foal);
  if (!mine.length) return say(player, "§7You have no horse to call.");
  sfx(player.dimension, "note.flute", player.location, { pitch: 1.6 });
  const here = player.location;
  const near = mine.map((rec) => ({ rec, entity: entityOf(rec) }))
    .filter((h) => h.entity && h.entity.dimension.id === player.dimension.id)
    .map((h) => ({ ...h, dist: Math.hypot(h.entity.location.x - here.x, h.entity.location.z - here.z) }))
    .filter((h) => h.dist <= S.whistleRange)
    .sort((a, b) => a.dist - b.dist)[0];
  if (near) {
    near.entity.teleport(here, { dimension: player.dimension });
    return say(player, `§6${near.rec.name} comes running.`);
  }
  const loyal = mine.filter((r) => hasPerk(r, "loyal")).sort((a, b) => (b.lastRidden ?? 0) - (a.lastRidden ?? 0))[0];
  if (!loyal) return say(player, `§7No horse of yours is within ${S.whistleRange} blocks. A horse with the Loyal perk comes from anywhere.`);
  const now = system.currentTick;
  const ready = whistled.get(player.id) ?? 0;
  if (now < ready) return say(player, `§7${loyal.name} needs ${Math.ceil((ready - now) / 20)}s before it can answer again.`);
  whistled.set(player.id, now + S.loyalWhistleCooldownTicks);
  const entity = entityOf(loyal);
  if (entity) entity.teleport(here, { dimension: player.dimension });
  else spawnSteed(loyal, player.dimension, here); // from its stall, or from far away (the old copy removes itself)
  say(player, `§6${loyal.name} answers your call.`);
}

world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  if (player?.typeId !== "minecraft:player" || !isReady()) return;
  const item = event.itemStack?.typeId;
  if (item === CROP) useCrop(player);
  else if (item === WHISTLE) whistle(player);
});

// ---------- Stables and Breeder's Posts ----------

// The regional breed bred in a region ("Frostmarch" -> "destrier"), or undefined off the map
export const regionBreed = (region) => REGIONAL_BREEDS.find((b) => BREEDS[b].region === region);

async function breederSetup(player, key) {
  const res = await new ModalFormData().title("Breeder's Post")
    .dropdown("Which breed is sold here?", REGIONAL_BREEDS.map((b) => `${BREEDS[b].name} (${BREEDS[b].region})`)).show(player);
  const breed = REGIONAL_BREEDS[res.formValues?.[0]];
  if (res.canceled || !breed) return;
  meta.data.posts[key] = breed;
  meta.save();
  player.sendMessage(`§aThis post now sells ${BREEDS[breed].name} foals.`);
}

async function breederMenu(player, block) {
  const key = posKey(block.location);
  // A post the map itself placed (a town's breeder's yard) was never set up by a builder: it sells the breed of
  // the region it stands in. A builder can still sneak-click it to choose another.
  const breed = meta.data.posts[key] ?? regionBreed(regionAt(block.location));
  if (isBuilder(player) && (player.isSneaking || !breed)) return breederSetup(player, key);
  if (!breed) return say(player, "§7Nobody is selling horses here yet.");
  const info = BREEDS[breed];
  const cost = [{ item: "coins", count: S.breederPostPrice }];
  const boughtKey = `${key}|${player.id}`;
  const wait = (meta.data.bought[boughtKey] ?? -1e9) + S.breederPostCooldownTicks - world.getAbsoluteTime();
  const body = [
    `§6${info.name}§7, bred in ${info.region}.`,
    `§7Bonus: §f${Object.keys(info.bonus).map((s) => `+1 ${s}`).join(", ")}`,
    `§7${TRAITS[info.trait].name}: §f${TRAITS[info.trait].desc}`,
    "",
    wait > 0 ? `§7The breeder has no foal for you yet (${Math.ceil(wait / 24000)} more day${wait > 24000 ? "s" : ""}).`
      : `§7A foal costs §f${costText(cost)}§7 and grows up in a day.`,
  ].join("\n");
  const form = new ActionFormData().title("Breeder's Post").body(body);
  if (wait <= 0) form.button(`Buy a foal\n§8${costText(cost)}`);
  form.button("Close");
  const res = await form.show(player);
  if (res.canceled || wait > 0 || res.selection !== 0) return;
  if (rosterRoom(player.id) <= 0) return player.sendMessage("§cYour stalls are full. Build or upgrade a Stables first.");
  if (!pay(player, cost)) return player.sendMessage(`§cA foal costs ${costText(cost)}.`);
  meta.data.bought[boughtKey] = world.getAbsoluteTime();
  meta.save();
  buyFoal(player, breed, above(block));
}

function openStables(player, block) {
  const owner = block.dimension.id === "minecraft:overworld" ? settlementAt(block.location) : undefined;
  if (!owner) return say(player, "§7These stables stand on nobody's land.");
  if (owner !== player.id && !isAlly(owner, player.id)) return say(player, `§cThese are ${keepOf(owner)?.name ?? "someone else"}'s stables.`);
  if (!meta.data.stables[owner]) {
    meta.data.stables[owner] = 1;
    meta.save();
  }
  stablesMenu(player, owner, above(block), keepOf(owner)?.name ?? "The");
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player } = event;
  if (event.isFirstEvent === false || !isReady()) return;
  if (block.typeId !== STABLES && block.typeId !== BREEDER_POST) return;
  event.cancel = true;
  system.run(() => {
    if (!block.isValid) return;
    if (block.typeId === STABLES) openStables(player, block);
    else breederMenu(player, block);
  });
});

world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
  if (!isReady()) return;
  if (block.typeId === BREEDER_POST) {
    if (!isBuilder(player)) {
      block.setType("minecraft:air");
      return say(player, "§cBreeder's Posts are placed by the map builder in Creative.");
    }
    return breederSetup(player, posKey(block.location));
  }
  if (block.typeId !== STABLES) return; // (Siege Nights has already refused it if this isn't your land)
  const owner = settlementAt(block.location);
  if (!owner) return;
  if (!meta.data.stables[owner]) {
    meta.data.stables[owner] = 1;
    meta.save();
  }
  player.sendMessage("§7Stables built. Click it to see your horses, train them, breed them and stable them. No horse yet? Use a Halter on a tamed horse.");
});

// ---------- A horse falls ----------

world.afterEvents.entityDie.subscribe((event) => {
  const dead = event.deadEntity;
  let rec;
  try {
    if (dead?.typeId !== STEED) return;
    rec = recordOf(uidOf(dead));
  } catch {
    return;
  }
  if (!rec || rec.status !== "out") return;
  rec.status = "fallen";
  rec.gearSaddle = false; // its saddle and barding dropped where it fell
  rec.gearArmor = null;
  rec.gen++;
  saveRecord(rec);
  const owner = world.getPlayers().find((p) => p.id === rec.owner);
  owner?.sendMessage(`§c${rec.name} has fallen. A level 2 Stables can bring it back (${costText(S.reviveCost)}).`);
});

// ---------- Loops ----------

onTick("horses_riding", 5, ridingTick);
onTick("horses_scan", 40, () => scanSteeds((rec) => {
  world.getPlayers().find((p) => p.id === rec.owner)?.sendMessage(`§6${rec.name} has grown up and can be ridden.`);
}));

// "Your horses" on the Keep Banner menu
addKeepMenuButtons(({ player, mine }) => (mine ? [{
  label: `Your horses (${horsesOf(player.id).length})`,
  action: () => {
    const list = horsesOf(player.id);
    new ActionFormData().title("Your horses")
      .body(list.length ? list.map(sheetText).join("\n\n§8----------\n\n") : "§7No horses yet. Use a Halter on a tamed horse, or buy a foal at a Breeder's Post.")
      .button("Close").show(player);
  },
}] : []));
