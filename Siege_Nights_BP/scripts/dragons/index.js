// Dragons for The Hollow Crown: the Emberwaste's own power. Players who live there take an egg from a wild
// nest, warm it on a Dragon Roost, raise the hatchling by feeding it, train it, and in the end fly it.
// Flight comes in stamina bursts, and a defended settlement's ballistas and archers shoot dragons down,
// so rails and horses stay the way everyone travels. Numbers to tweak: data.js. Flying: flight.js.
//
// Test commands (Creative):
//   /scriptevent siege:dragons_egg      give yourself an egg
//   /scriptevent siege:dragons_grow     hatch it / grow it one stage (max bond, +5 training points)
//   /scriptevent siege:dragons_reset    forget your dragon
//   /scriptevent siege:dragons_species 0-3     change yours: 0 Cinderwing, 1 Ashen Wyvern, 2 Dune Drake, 3 Glass Wyrm
//   /scriptevent siege:dragons_temper <name>   proud, curious, gentle, fierce, wary
//   /scriptevent siege:dragons_down     knock yours unconscious
//   /scriptevent siege:dragons_hungry   make it starving

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { onTick, isReady, settlementAt, isAlly, keepOf, consumeHeld, countItem } from "../siege/api.js";
import {
  DRAGON_SETTINGS as S, DRAGON, EGG, SADDLE, HORN, ROOST, NEST, DAY, SPECIES, RESERVE, FOODS, TRAINING, STAGE_NAMES, TEMPERS,
  newDragon, newMind, speciesOf, addXp, addBond, flightTicks, nextStageNeeds, trainProblem, train, bar,
} from "./data.js";
import { speak, noise, emote } from "./voice.js";
import { mindOf, mindLines, refusal, tell, onFed, pet, onHurt, think, guard, onOwnerDied } from "./mind.js";
import { goDown, lose, tend, downedTick, isCorpse } from "./downed.js";
import { store, dragonOf, save, valid, entityOf, recordOfEntity, ownerIdOf, canHarness, isBuilder, spawnDragon, roostDragon, refresh, scanDragons, isFlying } from "./dragon.js";
import { flightTick, defenceTick, mountOf, breathe, takeOff, land, announceLevel, rideOf, onCrash } from "./flight.js";
import "./tests.js";
import "./showcase.js";

const say = (player, text) => player.onScreenDisplay.setActionBar(text);
const posKey = (loc) => `${loc.x},${loc.y},${loc.z}`;
const above = (loc) => ({ x: loc.x + 0.5, y: loc.y + 1, z: loc.z + 0.5 });
const days = (ticks) => Math.max(1, Math.ceil(ticks / DAY));
const plural = (n) => (n === 1 ? "" : "s");

function give(player, typeId) {
  const leftover = player.getComponent("minecraft:inventory").container.addItem(new ItemStack(typeId, 1));
  if (leftover) player.dimension.spawnItem(leftover, player.location);
}

// ---------- Wild nests: where eggs come from ----------

function takeEgg(player, block) {
  const now = world.getAbsoluteTime();
  if (!canHarness(player)) return say(player, `§7The nest is cold to you. Dragons answer only to those who live in the ${S.homeRegion}.`);
  const rec = dragonOf(player.id);
  if (rec && !(rec.status === "carried" && countItem(player, EGG) === 0)) {
    return say(player, rec.stage === "egg" ? "§7You already carry an egg. Warm it on a Dragon Roost." : `§7${rec.name} would know. One dragon, one rider.`);
  }
  const mourn = (store.data.mourning[player.id] ?? 0) - now;
  if (mourn > 0) return say(player, `§7The nests are silent for you (${days(mourn)} more day${plural(days(mourn))}).`);
  const key = posKey(block.location);
  const wait = (store.data.nests[key] ?? 0) - now;
  if (wait > 0 && !rec) return say(player, `§7The nest is empty. Something will lay here again in ${days(wait)} day${plural(days(wait))}.`);
  if (!rec) {
    store.data.dragons[player.id] = newDragon(player.id, player.name, now);
    store.data.nests[key] = now + S.nestDays * DAY;
  }
  save();
  give(player, EGG);
  player.playSound("random.pop");
  player.sendMessage("§6You lift a Dragon Egg from the nest. It is heavier than it looks, and warm on one side. §7Set it on a Dragon Roost in your settlement to hatch it.");
}

// ---------- The Roost ----------

function hatchEgg(player, rec, block) {
  consumeHeld(player);
  rec.status = "warming";
  rec.warmAt = world.getAbsoluteTime();
  rec.roost = { x: block.location.x, y: block.location.y, z: block.location.z };
  save();
  block.dimension.playSound("block.campfire.crackle", block.location);
  player.sendMessage(`§6The egg settles into the Roost. §7It will hatch in about ${S.hatchDays} days. Stay close when it does: it bonds with whoever feeds it.`);
}

function hatch(rec, dim) {
  rec.stage = "hatchling";
  rec.bornAt = world.getAbsoluteTime();
  rec.name = `${rec.ownerName}'s Dragon`.slice(0, 24);
  rec.mind = newMind();
  rec.mind.lastSeen = rec.bornAt;
  const born = spawnDragon(rec, dim, above(rec.roost));
  try {
    noise(born, "egg_crack", 2);
    system.runTimeout(() => speak(born, rec, "chirp"), 20);
    dim.spawnParticle("minecraft:lava_particle", above(rec.roost));
  } catch {
    // looks only
  }
  const owner = world.getPlayers().find((p) => p.id === rec.owner);
  owner?.sendMessage(`§6Your egg has hatched: ${/^[AEIOU]/.test(speciesOf(rec).name) ? "an" : "a"} ${speciesOf(rec).name}. §7${speciesOf(rec).blurb} §7Feed it raw meat or fish to build its bond. Sneak and click it with an empty hand for its sheet.`);
}

function sheetText(rec) {
  const now = world.getAbsoluteTime();
  const lines = [
    `§6${rec.name}§7, ${speciesOf(rec).name} ${STAGE_NAMES[rec.stage]}`,
    ...mindLines(rec, now),
    `§7Bond  ${bar(rec.bond, 100)} §f${Math.floor(rec.bond)}`,
    `§7Level §f${rec.level}§7${rec.level < S.maxLevel ? `  (${rec.xp}/${30 + rec.level * 15} xp)` : " (max)"}   Training points §f${rec.tp}`,
    `§7Flight §f${flightTicks(rec) / 20}s§7   ${Object.entries(TRAINING).map(([k, t]) => `${t.name} §f${rec.stats[k]}/${t.max}§7`).join("  ")}`,
  ];
  const needs = nextStageNeeds(rec, now);
  if (needs) lines.push(`§e${needs}`);
  if (rec.stage !== "hatchling" && !rec.saddled) lines.push("§7Needs a Dragon Saddle before it will carry you.");
  return lines.join("\n");
}

async function trainMenu(player, rec) {
  const keys = Object.keys(TRAINING);
  const form = new ActionFormData().title(`Train ${rec.name}`).body(`${sheetText(rec)}\n\n§7Each lesson costs one training point.`);
  for (const k of keys) {
    const problem = trainProblem(rec, k);
    form.button(`${TRAINING[k].name} ${rec.stats[k]}/${TRAINING[k].max}\n§8${problem ? problem.slice(0, 34) : TRAINING[k].desc.slice(0, 34)}`);
  }
  form.button("Back");
  const res = await form.show(player);
  const key = keys[res.selection];
  if (res.canceled || !key) return;
  const problem = trainProblem(rec, key);
  if (problem) player.sendMessage(`§c${problem}`);
  else {
    train(rec, key);
    refresh(rec);
    player.playSound("random.orb");
    player.sendMessage(`§6${rec.name} learns: ${TRAINING[key].name} ${rec.stats[key]}/${TRAINING[key].max}.`);
  }
  return trainMenu(player, rec);
}

async function roostMenu(player, block) {
  const owner = block.dimension.id === "minecraft:overworld" ? settlementAt(block.location) : undefined;
  if (owner && owner !== player.id && !isAlly(owner, player.id)) return say(player, `§cThis is ${keepOf(owner)?.name ?? "someone else"}'s Roost.`);
  const rec = dragonOf(player.id);
  const now = world.getAbsoluteTime();
  if (!rec) {
    return say(player, canHarness(player) ? `§7An empty Roost. Bring an egg from a wild nest in the ${S.homeRegion}.`
      : `§7An empty Roost. Only those who live in the ${S.homeRegion} can raise a dragon.`);
  }
  if (rec.stage === "egg") {
    if (rec.status !== "warming") return say(player, "§7Hold your Dragon Egg and click the Roost to set it down.");
    const left = rec.warmAt + S.hatchDays * DAY - now;
    return say(player, left > 0 ? `§6The egg is warm. §7About ${days(left)} more day${plural(days(left))}.` : "§6Something moves inside the egg.");
  }
  rec.roost = { x: block.location.x, y: block.location.y, z: block.location.z };
  const wounded = rec.status === "wounded" ? rec.woundedUntil - now : 0;
  const out = rec.status === "out";
  const form = new ActionFormData().title("Dragon Roost")
    .body(`${sheetText(rec)}\n\n§7${wounded > 0 ? `Wounded. It will fly again in ${days(wounded)} day${plural(days(wounded))}.` : out ? "It is out in the world." : "It is asleep on the Roost."}`);
  const actions = [];
  const add = (label, fn) => {
    form.button(label);
    actions.push(fn);
  };
  add(`Train\n§8${rec.tp} point${plural(rec.tp)} to spend`, () => trainMenu(player, rec));
  if (wounded <= 0) {
    add(out ? "Send it to roost" : "Wake it", () => {
      if (out) roostDragon(rec);
      else spawnDragon(rec, block.dimension, above(block.location));
    });
  }
  add("Rename", () => renameMenu(player, rec));
  form.button("Close");
  const res = await form.show(player);
  if (!res.canceled) actions[res.selection]?.();
}

async function renameMenu(player, rec) {
  const res = await new ModalFormData().title("Name your dragon").textField("Name", rec.name, { defaultValue: rec.name }).show(player);
  const name = String(res.formValues?.[0] ?? "").trim().slice(0, 24);
  if (res.canceled || !name) return;
  rec.name = name;
  refresh(rec);
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player } = event;
  if (event.isFirstEvent === false || !isReady()) return;
  if (block.typeId !== ROOST && block.typeId !== NEST) return;
  event.cancel = true;
  const held = event.itemStack?.typeId;
  system.run(() => {
    if (!block.isValid) return;
    if (block.typeId === NEST) return takeEgg(player, block);
    const rec = dragonOf(player.id);
    if (held === EGG && rec?.stage === "egg" && rec.status !== "warming") {
      const owner = settlementAt(block.location);
      if (owner !== player.id && !isAlly(owner, player.id)) return say(player, "§7Set the egg on a Roost in your own settlement.");
      return hatchEgg(player, rec, block);
    }
    roostMenu(player, block);
  });
});

world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
  if (!isReady()) return;
  if (block.typeId === NEST && !isBuilder(player)) {
    block.setType("minecraft:air");
    return say(player, "§cDragon Nests are placed by the map builder in Creative.");
  }
  if (block.typeId === ROOST) player.sendMessage(`§7Dragon Roost built. Set a Dragon Egg on it to hatch it. Eggs come from the wild nests of the ${S.homeRegion}.`);
});

// ---------- Clicking a dragon: feed, saddle, sheet, ride ----------

const fedAt = new Map(); // owner id -> tick it will eat again

function feed(player, entity, rec) {
  const now = system.currentTick;
  const wait = (fedAt.get(rec.owner) ?? 0) - now;
  if (wait > 0) return say(player, `§7${rec.name} isn't hungry (${Math.ceil(wait / 20)}s).`);
  fedAt.set(rec.owner, now + S.feedCooldownTicks);
  if (!onFed(player, entity, rec, player.getComponent("minecraft:equippable")?.getEquipment("Mainhand")?.typeId)) return;
  consumeHeld(player);
  addBond(rec, S.feedBond);
  const leveled = addXp(rec, S.feedXp);
  try {
    entity.addEffect("regeneration", 100, { amplifier: 1, showParticles: false });
    entity.dimension.playSound("random.eat", entity.location, { pitch: 0.7 });
    entity.dimension.spawnParticle("minecraft:heart_particle", { x: entity.location.x, y: entity.location.y + 1.5, z: entity.location.z });
  } catch {
    // looks only
  }
  save();
  if (leveled) announceLevel(player, rec);
  say(player, `§6${rec.name} eats. §7Bond ${Math.floor(rec.bond)}/100`);
}

async function dragonMenu(player, rec) {
  const form = new ActionFormData().title(rec.name).body(sheetText(rec));
  const actions = [];
  const add = (label, fn) => {
    form.button(label);
    actions.push(fn);
  };
  add("Pet it", () => {
    const entity = entityOf(rec);
    if (entity) pet(player, entity, rec);
  });
  add(rec.order === "stay" ? "Follow me" : "Stay here", () => {
    const no = refusal(rec, "order");
    if (no) return tell(player, rec, no);
    rec.order = rec.order === "stay" ? "follow" : "stay";
    refresh(rec);
    say(player, rec.order === "stay" ? `§7${rec.name} settles where it is.` : `§7${rec.name} follows you.`);
  });
  add("Go to your Roost", () => {
    if (!rec.roost) return say(player, "§7It has no Roost to go to.");
    roostDragon(rec);
    say(player, `§7${rec.name} leaves for its Roost.`);
  });
  if (rec.saddled) {
    add("Take off its saddle", () => {
      rec.saddled = false;
      refresh(rec);
      give(player, SADDLE);
    });
  }
  add("Rename", () => renameMenu(player, rec));
  form.button("Close");
  const res = await form.show(player);
  if (!res.canceled) actions[res.selection]?.();
}

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  const { player, target, itemStack } = event;
  if (target?.typeId !== DRAGON) return;
  const rec = recordOfEntity(target);
  if (!rec) {
    if (isCorpse(target)) {
      event.cancel = true;
      system.run(() => say(player, "§7It is not breathing."));
    }
    return; // a display dragon
  }
  const item = itemStack?.typeId;
  if (rec.down) {
    event.cancel = true;
    return system.run(() => valid(target) && tend(player, target, rec, item));
  }
  const refuse = (text) => {
    event.cancel = true;
    system.run(() => say(player, text));
  };
  if (rec.owner !== player.id) {
    // Anyone may ride behind the owner; nobody else may handle it
    let riders = 0;
    try {
      riders = target.getComponent("minecraft:rideable")?.getRiders().length ?? 0;
    } catch {
      // not rideable yet
    }
    if (riders < 1 || item) {
      event.cancel = true;
      return system.run(() => valid(target) && (item ? say(player, `§c${rec.name} answers only to ${rec.ownerName}.`) : pet(player, target, rec)));
    }
    const no = refusal(rec, "passenger", player);
    if (no) {
      event.cancel = true;
      system.run(() => {
        speak(target, rec, "snarl");
        tell(player, rec, no);
      });
    }
    return;
  }
  const act = (fn) => {
    event.cancel = true;
    system.run(() => valid(target) && fn());
  };
  if (FOODS.includes(item)) return act(() => feed(player, target, rec));
  if (item === SADDLE) {
    return act(() => {
      if (rec.stage === "hatchling") return say(player, `§7${rec.name} is far too small for a saddle.`);
      if (rec.saddled) return say(player, `§7${rec.name} is already saddled.`);
      consumeHeld(player);
      rec.saddled = true;
      refresh(rec);
      target.dimension.playSound("armor.equip_leather", target.location);
      say(player, `§6${rec.name} takes the saddle.`);
    });
  }
  if (player.isSneaking && !item) return act(() => dragonMenu(player, rec));
  if (!item && (rec.stage === "hatchling" || !rec.saddled)) return act(() => pet(player, target, rec));
  if (rec.stage === "hatchling") return refuse(`§7${rec.name} is a hatchling. Feed it raw meat or fish and give it time.`);
  if (!rec.saddled) return refuse(`§7${rec.name} needs a Dragon Saddle.`);
  if (!canHarness(player)) refuse(`§7${rec.name} will not carry someone who doesn't live in the ${S.homeRegion}.`);
});

// ---------- Dragon Horn: call it, take off, breathe fire ----------

const called = new Map(); // player id -> tick the horn works again

function horn(player) {
  const rec = dragonOf(player.id);
  if (!rec || rec.stage === "egg") return say(player, "§7The horn sounds. Nothing answers.");
  const mount = mountOf(player);
  if (mount && recordOfEntity(mount) === rec) {
    if (isFlying(mount)) return breathe(player, mount, rec);
    return takeOff(player, mount, rec);
  }
  if (mount) return;
  if (player.dimension.id !== "minecraft:overworld") return say(player, `§7${rec.name} will not come to this place.`);
  if (rec.status === "wounded") return say(player, `§7${rec.name} is wounded and resting at its Roost.`);
  const now = system.currentTick;
  if ((called.get(player.id) ?? 0) > now) return say(player, `§7Give ${rec.name} a moment (${Math.ceil((called.get(player.id) - now) / 20)}s).`);
  player.dimension.playSound("raid.horn", player.location, { volume: 3, pitch: 0.7 });
  if (rec.down) return say(player, `§c${rec.name} does not stir.`);
  const no = refusal(rec, "come");
  if (no) return tell(player, rec, no);
  const entity = entityOf(rec);
  const here = player.location;
  if (rec.status === "out" && entity) {
    const dist = Math.hypot(entity.location.x - here.x, entity.location.z - here.z);
    if (dist > S.hornRange) return say(player, `§7${rec.name} is too far to hear (${Math.round(dist)} blocks).`);
    if (isFlying(entity)) land(entity, rec, "called");
    entity.teleport(here, { dimension: player.dimension });
  } else if (rec.status === "roosted" && rec.roost && Math.hypot(rec.roost.x - here.x, rec.roost.z - here.z) <= S.hornRange) {
    spawnDragon(rec, player.dimension, here);
  } else {
    return say(player, `§7${rec.name} is too far to hear. The horn carries ${S.hornRange} blocks.`);
  }
  called.set(player.id, now + 200);
  const came = entityOf(rec);
  if (came) speak(came, rec, "roar", 0.7), emote(came, "roar");
  say(player, `§6${rec.name} answers the horn.`);
}

world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  if (player?.typeId !== "minecraft:player" || !isReady()) return;
  if (event.itemStack?.typeId === HORN) horn(player);
});

// ---------- Death ----------

// A dragon is never simply deleted by a blow: at its last strength it falls unconscious (downed.js).
// This only fires for the void, /kill, or one blow bigger than everything it had left.
world.afterEvents.entityDie.subscribe((event) => {
  const dead = event.deadEntity;
  try {
    if (dead?.typeId === "minecraft:player") {
      const rec = dragonOf(dead.id);
      const entity = rec && entityOf(rec);
      if (entity && !rec.down && Math.hypot(entity.location.x - dead.location.x, entity.location.z - dead.location.z) < 32) onOwnerDied(entity, rec, dead);
      return;
    }
    if (dead?.typeId !== DRAGON) return;
    const rec = dragonOf(ownerIdOf(dead));
    if (rec && rec.status === "out") lose(rec, "has died");
  } catch {
    // entity already gone
  }
});

world.afterEvents.entityHurt.subscribe((event) => {
  const hurt = event.hurtEntity;
  const attacker = event.damageSource?.damagingEntity;
  try {
    if (hurt?.typeId === DRAGON) {
      const rec = dragonOf(ownerIdOf(hurt));
      if (!rec || rec.status !== "out" || rec.down || !valid(hurt)) return;
      const health = hurt.getComponent("minecraft:health")?.currentValue ?? 99;
      if (health <= RESERVE) goDown(rec, hurt, attacker);
      else onHurt(hurt, rec, attacker);
    } else if (hurt?.typeId === "minecraft:player" && attacker) {
      const rec = dragonOf(hurt.id);
      const entity = rec && entityOf(rec);
      if (entity && Math.hypot(entity.location.x - hurt.location.x, entity.location.z - hurt.location.z) < 14) guard(entity, rec, hurt, attacker);
    }
  } catch {
    // entity already gone
  }
});

onCrash((rec, entity) => goDown(rec, entity, undefined));

function mindTick() {
  if (!isReady()) return;
  for (const rec of Object.values(store.data.dragons)) {
    if (rec.status !== "out" || rec.down || rec.stage === "egg") continue;
    const entity = entityOf(rec);
    if (!entity) continue;
    try {
      think(entity, rec);
    } catch (e) {
      console.warn(`[Hollow Crown] dragon mind: ${e}`);
    }
  }
  if (system.currentTick % 1200 < 100) save();
}

// ---------- Loops ----------

function growthTick() {
  if (!isReady()) return;
  const now = world.getAbsoluteTime();
  for (const rec of Object.values(store.data.dragons)) {
    if (rec.status === "warming" && now >= rec.warmAt + S.hatchDays * DAY) {
      try {
        const dim = world.getDimension("overworld");
        const block = dim.getBlock(rec.roost); // undefined until its Roost is loaded
        if (block?.typeId === ROOST) hatch(rec, dim);
        else if (block) {
          // the Roost was broken under it: the egg goes back to its owner the next time they touch a nest
          rec.status = "carried";
          save();
          world.getPlayers().find((p) => p.id === rec.owner)?.sendMessage("§cYour Dragon Egg's Roost is gone and the egg has gone cold. §7Fetch it again from a nest and set it on a new Roost.");
        }
      } catch {
        // chunk not loaded: try again later
      }
    } else if (rec.status === "wounded" && now >= rec.woundedUntil) {
      rec.status = "roosted";
      save();
    }
  }
  scanDragons((rec) => {
    const owner = world.getPlayers().find((p) => p.id === rec.owner);
    owner?.playSound("random.levelup");
    owner?.sendMessage(rec.stage === "adult"
      ? `§6${rec.name} is grown. §7Saddle it, climb on and press jump to fly. Watch its Flight bar: when it empties, it comes down.`
      : `§6${rec.name} is a Fledgling now. §7With a Dragon Saddle it will carry you on foot. It cannot fly yet.`);
  });
}

onTick("dragons_growth", 40, growthTick);
onTick("dragons_flight", 2, () => isReady() && flightTick());
onTick("dragons_defence", 20, () => isReady() && defenceTick());
onTick("dragons_downed", 20, () => isReady() && downedTick());
onTick("dragons_mind", 100, mindTick);

// ---------- Test commands ----------

system.afterEvents.scriptEventReceive.subscribe((event) => {
  const player = event.sourceEntity;
  if (!event.id.startsWith("siege:dragons_") || player?.typeId !== "minecraft:player") return;
  if (!isBuilder(player)) return player.sendMessage("§cDragon test commands need Creative mode.");
  const now = world.getAbsoluteTime();
  let rec = dragonOf(player.id);
  if (event.id === "siege:dragons_reset") {
    if (rec) roostDragon(rec);
    delete store.data.dragons[player.id];
    delete store.data.mourning[player.id];
    save();
    return player.sendMessage("§7Your dragon is forgotten.");
  }
  if (event.id === "siege:dragons_egg") {
    if (rec) return player.sendMessage("§7You already have a dragon or an egg. /scriptevent siege:dragons_reset first.");
    store.data.dragons[player.id] = newDragon(player.id, player.name, now);
    save();
    give(player, EGG);
    return player.sendMessage("§7Egg given. Click a Dragon Roost with it, then /scriptevent siege:dragons_grow.");
  }
  if (event.id === "siege:dragons_species") {
    if (!rec) return player.sendMessage("§7No dragon yet.");
    rec.species = Math.max(0, Math.min(SPECIES.length - 1, Number(event.message) || 0));
    refresh(rec);
    return player.sendMessage(`§7${rec.name} is now ${speciesOf(rec).name}. ${speciesOf(rec).blurb}`);
  }
  if (event.id === "siege:dragons_temper") {
    if (!rec || !TEMPERS[event.message]) return player.sendMessage(`§7Tempers: ${Object.keys(TEMPERS).join(", ")}`);
    mindOf(rec).temper = event.message;
    save();
    return player.sendMessage(`§7${rec.name} is now ${TEMPERS[event.message].name}.`);
  }
  if (event.id === "siege:dragons_down") {
    const entity = rec && entityOf(rec);
    if (!entity) return player.sendMessage("§7Your dragon isn't out.");
    goDown(rec, entity, undefined);
    return player.sendMessage("§7Knocked out. Tend it with a golden apple, hit it as another player to finish it, or wait.");
  }
  if (event.id === "siege:dragons_hungry") {
    if (!rec) return;
    mindOf(rec).hunger = 92;
    return player.sendMessage(`§7${rec.name} is now starving.`);
  }
  if (event.id === "siege:dragons_grow") {
    if (!rec) rec = store.data.dragons[player.id] = newDragon(player.id, player.name, now);
    const wasEgg = rec.stage === "egg";
    if (wasEgg) {
      rec.roost ??= { x: Math.floor(player.location.x), y: Math.floor(player.location.y) - 1, z: Math.floor(player.location.z) };
      hatch(rec, player.dimension);
    } else {
      rec.bond = 100;
      rec.tp += 5;
      rec.bornAt = now - (rec.stage === "hatchling" ? S.fledgeDays : S.adultDays) * DAY;
      rec.saddled = true;
      save();
    }
    rideOf(rec).stamina = flightTicks(rec);
    return player.sendMessage(`§7${rec.name}: ${wasEgg ? "hatched. Run it again to grow it." : "it grows at the next check (2 seconds)."}`);
  }
});
