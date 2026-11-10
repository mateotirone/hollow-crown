// Dragons: the mind. Each dragon has a temperament (rolled at hatching), a mood, an appetite, a favourite
// food it lets you discover, and a memory: who hurt it, when it last saw you, whether you left it alone too
// long. Out of those come the things it does on its own: greeting you, sulking, hunting when it's hungry,
// warning you of what is out in the dark, guarding you, bringing you things, refusing an order.
// It never speaks. Everything it "says" is what you see it do, told to its owner in grey italics.

import { world, system, ItemStack, EntityDamageCause } from "@minecraft/server";
import { settlementAt, isAlly } from "../siege/api.js";
import { DRAGON_SETTINGS as S, DAY, TEMPERS, FOODS, speciesOf, addBond, newMind } from "./data.js";
import { valid, save, setProp, fire, isFlying } from "./dragon.js";
import { speak, emote } from "./voice.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const spoke = new Map(); // owner id -> tick it may next "say" something unprompted
const timers = new Map(); // owner id -> { sense, guard, comfort, pet }

export const mindOf = (rec) => (rec.mind ??= newMind());
export const tell = (player, rec, text) => player?.sendMessage(`§7§o${text.replaceAll("{n}", rec.name)}`);
const timer = (rec) => {
  let t = timers.get(rec.owner);
  if (!t) timers.set(rec.owner, (t = { sense: 0, guard: 0, comfort: 0, pet: 0, snap: 0 }));
  return t;
};
export const shiftMood = (rec, amount) => (mindOf(rec).mood = clamp(mindOf(rec).mood + amount, -100, 100));

export function moodWord(rec) {
  const m = mindOf(rec);
  if (rec.down) return "§cunconscious";
  if (m.sulking > 0) return "§csulking";
  if (m.hunger >= 85) return "§cstarving";
  if (m.hunger >= 65) return "§ehungry";
  if (m.mood >= 70 && rec.bond >= 80) return "§adevoted";
  if (m.mood >= 30) return "§acontent";
  if (m.mood >= -20) return "§7restless";
  return "§csullen";
}

export function mindLines(rec, now) {
  const m = mindOf(rec);
  const lines = [`§7${TEMPERS[m.temper].name}. §8${TEMPERS[m.temper].desc}`, `§7Mood ${moodWord(rec)}§7   Favourite food §f${m.favKnown ? foodName(m.fav) : "not found yet"}`];
  const grudges = Object.values(m.grudges).filter((g) => g.until > now).map((g) => g.name);
  if (grudges.length) lines.push(`§7Holds a grudge against §c${grudges.join(", ")}`);
  return lines;
}
const foodName = (id) => id.replace("minecraft:", "raw ").replace("raw rotten_flesh", "rotten flesh").replace("_", " ");

// ---------- Will it do as it's told? ----------

// Returns a line to show (it refused) or undefined (it obeys). `ask` is "fly", "come", "order" or "passenger".
export function refusal(rec, ask, who) {
  const m = mindOf(rec);
  const now = world.getAbsoluteTime();
  if (ask === "passenger") {
    if (who && m.grudges[who.id]?.until > now) return `{n} bares its teeth at ${who.name}. It remembers.`;
    if (m.temper === "proud" && rec.bond < 90) return "{n} will carry you, and nobody else. Not yet.";
    return undefined;
  }
  if (m.sulking > 0) return pick(["{n} turns its head away from you.", "{n} hears you. It does not move.", "{n} looks at you for a long moment, then looks away."]);
  if (m.hunger >= 90) return ask === "fly" ? "{n} is too hungry to fly. It noses at your pack." : undefined;
  if (m.mood <= -50 && Math.random() < (m.temper === "proud" ? 0.7 : 0.4)) return pick(["{n} huffs and stays where it is.", "{n} pretends not to hear."]);
  return undefined;
}

// ---------- Things you do to it ----------

export function onFed(player, entity, rec, item) {
  const m = mindOf(rec);
  if (item === "minecraft:rotten_flesh" && m.fav !== item && (m.temper === "proud" || m.hunger < 60)) {
    emote(entity, "shake");
    speak(entity, rec, "snarl", 0.6);
    tell(player, rec, "{n} sniffs the rotten flesh and spits it back at your feet.");
    return false; // refused: nothing is eaten
  }
  m.hunger = clamp(m.hunger - 45, 0, 100);
  if (m.sulking > 0) m.sulking--;
  if (item === m.fav) {
    shiftMood(rec, 25);
    addBond(rec, S.feedBond); // counted twice
    if (!m.favKnown) {
      m.favKnown = true;
      tell(player, rec, `{n} snatches the ${foodName(item)} before you can offer it and looks at you for more. You have found its favourite.`);
    }
    emote(entity, "nuzzle", 60);
  } else {
    shiftMood(rec, 8);
  }
  speak(entity, rec, "purr");
  return true;
}

export function pet(player, entity, rec) {
  const m = mindOf(rec);
  const t = timer(rec);
  const now = system.currentTick;
  if (player.id !== rec.owner) {
    if (m.grudges[player.id]?.until > world.getAbsoluteTime() || (m.temper === "fierce" && rec.bond < 100) || m.temper === "wary") {
      emote(entity, "snarl");
      speak(entity, rec, "snarl");
      if (m.temper === "fierce" && now > t.snap) {
        t.snap = now + 100;
        try {
          player.applyDamage(2, { cause: EntityDamageCause.entityAttack, damagingEntity: entity });
        } catch {
          // out of reach
        }
        return player.onScreenDisplay.setActionBar(`§c${rec.name} snaps at your hand.`);
      }
      return player.onScreenDisplay.setActionBar(`§7${rec.name} pulls back from you and watches your hands.`);
    }
    emote(entity, "tilt");
    return player.onScreenDisplay.setActionBar(`§7${rec.name} lets you touch its snout. It keeps one eye on ${rec.ownerName}.`);
  }
  if (now < t.pet) {
    emote(entity, "nuzzle");
    return;
  }
  t.pet = now + 600;
  if (m.sulking > 0) {
    m.sulking--;
    shiftMood(rec, 10);
    speak(entity, rec, "whimper", 0.7);
    save();
    return tell(player, rec, m.sulking > 0 ? "{n} lets you touch it. It still won't look at you." : "{n} sighs and leans its whole head into you. You are forgiven.");
  }
  shiftMood(rec, 6);
  addBond(rec, 1);
  emote(entity, "nuzzle", 60);
  speak(entity, rec, "purr");
  try {
    entity.dimension.spawnParticle("minecraft:heart_particle", { x: entity.location.x, y: entity.location.y + 1.6, z: entity.location.z });
  } catch {
    // looks only
  }
  save();
  tell(player, rec, pick({
    proud: ["{n} allows it.", "{n} lowers its head exactly as far as it must."],
    curious: ["{n} pushes its snout into your hand, then into your pockets.", "{n} sniffs your hand, your sleeve, your face."],
    gentle: ["{n} closes its eyes and leans on you until you nearly fall.", "{n} rumbles so low you feel it in your chest."],
    fierce: ["{n} butts its head against you, hard.", "{n} mouths your arm. Carefully."],
    wary: ["{n} holds very still under your hand.", "{n} checks the sky once, then lets you."],
  }[m.temper]));
}

// It was hurt (but not brought down)
export function onHurt(entity, rec, attacker) {
  const m = mindOf(rec);
  speak(entity, rec, "hurt");
  if (attacker?.typeId !== "minecraft:player") return;
  const owner = world.getPlayers().find((p) => p.id === rec.owner);
  if (attacker.id === rec.owner) {
    addBond(rec, -15);
    shiftMood(rec, -40);
    emote(entity, "shake");
    tell(owner, rec, "{n} flinches away from you. It did not expect that from you.");
  } else {
    m.grudges[attacker.id] = { name: attacker.name, until: world.getAbsoluteTime() + (m.temper === "proud" ? 10 : 3) * DAY };
    shiftMood(rec, -10);
    emote(entity, "snarl");
  }
  save();
}

export function rememberAttacker(rec, attacker, days = 5) {
  if (attacker?.typeId !== "minecraft:player" || attacker.id === rec.owner) return;
  mindOf(rec).grudges[attacker.id] = { name: attacker.name, until: world.getAbsoluteTime() + days * DAY };
}

// ---------- Things it does on its own ----------

const compass = (from, to) => {
  const a = (Math.atan2(to.x - from.x, -(to.z - from.z)) * 180) / Math.PI;
  return ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"][Math.round(((a + 360) % 360) / 45) % 8];
};
const ridden = (entity) => {
  try {
    return (entity.getComponent("minecraft:rideable")?.getRiders().length ?? 0) > 0;
  } catch {
    return false;
  }
};
const isNightNow = () => {
  const t = world.getTimeOfDay();
  return t > 13000 && t < 23000;
};

function setAsleep(entity, rec, asleep) {
  if (!!rec.asleep === asleep) return;
  rec.asleep = asleep;
  setProp(entity, "siege:pose", asleep ? 1 : 0);
  fire(entity, asleep || rec.order === "stay" ? "siege:order_stay" : "siege:order_follow");
}

function hunt(entity, rec, owner) {
  const land = settlementAt(entity.location);
  if (land && land !== rec.owner && !isAlly(land, rec.owner)) return false; // it does not raid other people's farms
  let prey;
  try {
    prey = entity.dimension.getEntities({ location: entity.location, maxDistance: 14 })
      .find((e) => ["minecraft:sheep", "minecraft:pig", "minecraft:cow", "minecraft:chicken", "minecraft:rabbit"].includes(e.typeId) && !e.nameTag);
  } catch {
    return false;
  }
  if (!prey) return false;
  const what = prey.typeId.replace("minecraft:", "");
  try {
    entity.teleport(prey.location, { facingLocation: prey.location });
    prey.kill();
  } catch {
    return false;
  }
  speak(entity, rec, "snarl");
  mindOf(rec).hunger = clamp(mindOf(rec).hunger - 60, 0, 100);
  tell(owner, rec, `{n} has had enough of waiting and takes a ${what} for itself.`);
  return true;
}

const AMBIENT = {
  proud: ["{n} preens a wing and makes sure you saw.", "{n} watches you work as if it could do it better."],
  curious: ["{n} turns over a stone with one claw to see what is under it.", "{n} follows a beetle across the ground with its whole head."],
  gentle: ["{n} settles where it can see you.", "{n} hums to itself, very low."],
  fierce: ["{n} rakes the ground and stares at nothing.", "{n} snaps at the air."],
  wary: ["{n} lifts its head and listens for a while.", "{n} keeps its back to something solid."],
};

// Every 5 seconds, for each awake dragon in the world
export function think(entity, rec) {
  const m = mindOf(rec);
  const now = system.currentTick;
  const day = world.getAbsoluteTime();
  const owner = world.getPlayers().find((p) => p.id === rec.owner);
  const t = timer(rec);
  const at = entity.location;
  const near = owner && owner.dimension.id === entity.dimension.id ? Math.hypot(owner.location.x - at.x, owner.location.y - at.y, owner.location.z - at.z) : Infinity;
  const mounted = ridden(entity);
  const quiet = (spoke.get(rec.owner) ?? 0) > now;
  const say = (text, gap = 400) => {
    spoke.set(rec.owner, now + gap);
    tell(owner, rec, text);
  };

  // Appetite and mood drift
  m.hunger = clamp(m.hunger + (mounted || isFlying(entity) ? 0.5 : 0.28), 0, 100);
  const rest = { proud: 10, curious: 30, gentle: 35, fierce: 5, wary: 15 }[m.temper] + (rec.bond - 50) * 0.4 - (m.hunger > 65 ? 30 : 0);
  m.mood += Math.sign(rest - m.mood) * 0.5;

  // Seeing you again
  if (near <= 24) {
    const away = m.lastSeen ? (day - m.lastSeen) / DAY : 0;
    if (away >= 4 && rec.stage !== "hatchling") {
      m.sulking = m.temper === "proud" ? 4 : m.temper === "gentle" ? 1 : 2;
      shiftMood(rec, -30);
      speak(entity, rec, "whimper");
      say(`{n} sees you and does not get up. You were gone ${Math.floor(away)} days.`);
    } else if (away >= 0.5) {
      shiftMood(rec, 15);
      speak(entity, rec, "roar", 0.6);
      emote(entity, "roar", 50);
      say(pick(["{n} has seen you. The whole of it comes to meet you.", "{n} calls out before you are even close.", "{n} circles you twice, checking you are all there."]));
    }
    m.lastSeen = day;
  }

  // Sleep: at night, unridden, when told to stay or left alone. It wakes when you come close.
  const sleepy = isNightNow() && !mounted && !isFlying(entity) && (rec.order === "stay" || near > 16) && m.temper !== "wary";
  if (sleepy && near > 4) {
    if (!rec.asleep) setAsleep(entity, rec, true);
    return;
  }
  if (rec.asleep) {
    setAsleep(entity, rec, false);
    if (near <= 4) say("{n} opens one eye at your footsteps.", 200);
  }
  if (!owner || near > 32) {
    if (m.hunger >= 90 && Math.random() < 0.2) hunt(entity, rec, owner);
    return;
  }

  // What is out there. Wary dragons notice from further off.
  if (now >= t.sense) {
    let threats = [];
    try {
      threats = entity.dimension.getEntities({ location: at, maxDistance: m.temper === "wary" ? 32 : 20, families: ["monster"] });
    } catch {
      // nothing loaded
    }
    if (threats.length) {
      t.sense = now + 600;
      const hollow = threats.some((e) => {
        try {
          return e.getComponent("minecraft:type_family")?.hasTypeFamily("hollow");
        } catch {
          return false;
        }
      });
      const where = compass(at, threats[0].location);
      speak(entity, rec, hollow ? "whimper" : "snarl", 0.8);
      emote(entity, hollow ? "shake" : "snarl", 60);
      if (hollow) {
        shiftMood(rec, -8);
        return say(`{n} has gone rigid. It is looking ${where} and it will not look away. It is afraid.`, 600);
      }
      return say(threats.length > 3 ? `{n} growls, low and steady, toward the ${where}. There are several of them.` : `{n} lifts its head and stares ${where}. Something is there.`, 600);
    }
  }

  // You are hurt
  if (now >= t.comfort && rec.bond >= 50) {
    const hp = owner.getComponent("minecraft:health");
    if (hp && hp.currentValue <= hp.effectiveMax * 0.4 && near <= 8) {
      t.comfort = now + 2400;
      owner.addEffect("regeneration", 120, { amplifier: 0, showParticles: false });
      emote(entity, "nuzzle", 60);
      speak(entity, rec, "whimper", 0.6);
      return say(m.temper === "fierce" ? "{n} stands over you and dares anything to come closer." : "{n} noses at where you are hurt, breathing warm on it.");
    }
  }

  if (quiet || mounted) return;

  // Hunger
  if (m.hunger >= 65) {
    const held = owner.getComponent("minecraft:equippable")?.getEquipment("Mainhand")?.typeId;
    if (FOODS.includes(held)) return say(`{n} has stopped moving. It is staring at the ${foodName(held)} in your hand.`);
    if (m.hunger >= 90 && hunt(entity, rec, owner)) return spoke.set(rec.owner, now + 400);
    if (Math.random() < 0.3) {
      speak(entity, rec, "whimper", 0.7);
      return say(m.hunger >= 85 ? "{n}'s ribs show. It watches every animal that passes." : "{n} noses at your pack. It is hungry.");
    }
  }

  // A gift, now and then, from a dragon that likes you
  if (rec.bond >= 60 && m.mood >= 30 && day >= m.giftAt && near <= 10 && Math.random() < 0.15) {
    m.giftAt = day + DAY * (m.temper === "curious" ? 1 : 2);
    try {
      entity.dimension.spawnItem(new ItemStack(Math.random() < 0.5 ? speciesOf(rec).gift : pick(["minecraft:bone", "minecraft:flint", "minecraft:charcoal", "minecraft:raw_gold"]), 1), owner.location);
    } catch {
      // nowhere to put it
    }
    emote(entity, "tilt", 60);
    save();
    return say("{n} sets something down at your feet and waits to see what you think of it.");
  }

  // Small things
  if (Math.random() < 0.08) {
    let rain = false;
    try {
      rain = entity.dimension.getWeather?.() !== "Clear";
    } catch {
      // no weather here
    }
    let onHorse = false;
    try {
      onHorse = owner.getComponent("minecraft:riding")?.entityRidingOn?.typeId === "siege:steed";
    } catch {
      // not riding
    }
    if (onHorse) {
      speak(entity, rec, "snarl", 0.4);
      return say("{n} watches you ride the horse. It snorts.");
    }
    if (rain && speciesOf(rec).key !== "wyrm") return say("{n} hunches under the rain and glares at the sky.");
    if (isNightNow() && Math.random() < 0.5) return say(pick(["{n} keeps looking back the way you came.", "{n} moves a little closer to you in the dark."]));
    speak(entity, rec, "idle", 0.6);
    emote(entity, "tilt");
    say(pick(AMBIENT[m.temper]));
  }
}

// Its owner was hit by something: a bonded dragon steps in
export function guard(entity, rec, owner, attacker) {
  const m = mindOf(rec);
  const t = timer(rec);
  const now = system.currentTick;
  if (now < t.guard || rec.stage === "hatchling" || rec.asleep || rec.down || !valid(attacker)) return;
  const need = { fierce: 30, proud: 60, curious: 50, gentle: 70, wary: 80 }[m.temper];
  if (rec.bond < need || ridden(entity)) return;
  let monster = false;
  try {
    monster = attacker.getComponent("minecraft:type_family")?.hasTypeFamily("monster");
  } catch {
    return;
  }
  const foe = monster || (attacker.typeId === "minecraft:player" && attacker.id !== rec.owner && !isAlly(rec.owner, attacker.id) && m.temper === "fierce");
  if (!foe) return;
  t.guard = now + 60;
  try {
    entity.teleport(attacker.location, { facingLocation: attacker.location });
    attacker.applyDamage(rec.stage === "adult" ? 8 : 4, { cause: EntityDamageCause.entityAttack, damagingEntity: entity });
  } catch {
    return;
  }
  speak(entity, rec, "roar", 0.8);
  emote(entity, "roar");
  if ((spoke.get(rec.owner) ?? 0) <= now) {
    spoke.set(rec.owner, now + 300);
    tell(owner, rec, "{n} puts itself between you and it.");
  }
}

export function onOwnerDied(entity, rec, owner) {
  shiftMood(rec, -20);
  speak(entity, rec, "death", 0.8);
  rec.order = "stay";
  fire(entity, "siege:order_stay");
  save();
  tell(owner, rec, "{n} will not leave the place where you fell.");
}
