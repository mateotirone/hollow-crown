// The Rumor Board: endless jobs put together from parts, so there is always something to do after
// (and during) the story. Everything here works alone: no job needs a second player.
//
// Open it from the Town Hall menu. Three rumors a day, one job at a time. Jobs pay Renown and coins,
// and every third job pays a skill point, so the board is a steady trickle and never beats the story.
//
// Other features can add flavour text:  emit("rumorParts", { givers: [...], places: [...], reasons: { camp: [...] } })

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import * as api from "../siege/api.js";
import { heroOf, saveHero, grantPoints, grantRenown } from "./hero.js";
import { heading } from "./progress.js";
<<<<<<< HEAD
import { sfx } from "../core/sfx.js";
=======
import { payE } from "../economy/coins.js";
import { worth } from "../economy/rules.js";
>>>>>>> origin/main

export const JOBS_PER_POINT = 3;
const RUMOR_TAG = "siege_rumor";

const PARTS = {
  givers: ["A drover", "The miller's wife", "A pedlar", "An old soldier", "A charcoal burner", "A tinker", "A shepherd boy", "The ferryman", "A pilgrim", "A poacher who should not have been there"],
  places: ["by the old road", "past the split oak", "where the stream bends", "under the hill", "near the burnt farm", "beyond the last fence", "by the standing stones", "in the low ground"],
  reasons: {
    bounty: ["They come closer to the fences every night.", "Three goats gone this week.", "Nobody will take the east track after dusk.", "The bell-ringer swears they answer the toll."],
    camp: ["They are counting your walls.", "They have a ram half built.", "Scouts, but scouts are followed by armies.", "They took the toll from the last cart that passed."],
    rescue: ["Went out for firewood and never came back.", "Was walking home from market.", "The family has lit a candle every night since.", "Someone heard shouting, then nothing."],
    supply: ["The road wardens are short this month.", "A village to the south had a bad harvest.", "The Quartermaster owes a favor and asks you to pay it.", "A lord's steward will remember who helped."],
  },
};
api.on("rumorParts", (more) => {
  for (const key of ["givers", "places"]) if (Array.isArray(more?.[key])) PARTS[key].push(...more[key]);
  for (const [type, lines] of Object.entries(more?.reasons ?? {})) if (PARTS.reasons[type] && Array.isArray(lines)) PARTS.reasons[type].push(...lines);
});

const BOUNTIES = [
  ["minecraft:zombie", "zombies"], ["minecraft:skeleton", "skeletons"], ["minecraft:spider", "spiders"], ["minecraft:creeper", "creepers"],
  ["minecraft:drowned", "drowned"], ["minecraft:husk", "husks"], ["minecraft:stray", "strays"], ["minecraft:witch", "witches", 0.3], ["minecraft:enderman", "endermen", 0.3],
];
const SUPPLIES = [
  ["minecraft:bread", "loaves of bread", 16], ["minecraft:arrow", "arrows", 32], ["minecraft:iron_ingot", "iron ingots", 6], ["minecraft:cooked_beef", "cooked beef", 10],
  ["minecraft:coal", "coal", 20], ["minecraft:torch", "torches", 32], ["minecraft:leather", "leather", 8], ["minecraft:wheat", "wheat", 24], ["minecraft:cooked_cod", "cooked cod", 10],
];

// ---------- the Storyteller (core pacing director) ----------
// The board's jobs and twists are decks, so the director can mix them against whatever else the player
// has been doing (quiet work after a siege, a fight after days at home). Ids are saved: never rename one.
// If the Storyteller is not in this build, the board falls back to its own seeded dice.
export const JOB_KIND = { bounty: "fight", camp: "fight", rescue: "mystery", supply: "quiet" };
const TWIST_KIND = { keepsake: "quiet", windfall: "build", tale: "social", debt: "social" };
const storyteller = () => typeof api.pickSeveral === "function" && typeof api.registerDeck === "function";
if (storyteller()) {
  api.registerDeck("rumors", Object.entries(JOB_KIND).map(([id, kind]) => ({ id, kind })));
  api.registerDeck("rumor_twists", Object.entries(TWIST_KIND).map(([id, kind]) => ({ id, kind })), { chance: 0.25 });
}

// ---------- a small seeded dice, so the board shows the same three rumors all day ----------
export function dice(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (text) => [...String(text)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
const pickFrom = (roll, list) => list[Math.floor(roll() * list.length)];

// tier 0-4 from Renown level: bigger jobs, better pay
export const jobTier = (level) => Math.min(4, Math.floor(level / 8));

// Three rumors for a day. Pure: same day, player and level give the same board.
// memory = { lastType, recent: [things this player was offered or did lately] }: the board never offers the kind of
// job you did last, and avoids givers, places, reasons and targets you have seen recently, so no two days feel alike.
export function rumorsFor(day, playerId, level, memory = {}) {
  const roll = dice(hash(`${day}:${playerId}`));
  const tier = jobTier(level);
  let types = ["bounty", "camp", "rescue", "supply"];
  const drop = types.includes(memory.lastType) ? types.indexOf(memory.lastType) : Math.floor(roll() * types.length);
  types.splice(drop, 1); // three of the four kinds each day, never the kind you just did
  // the Storyteller's choice for today, when it made one, wins over the dice
  if (memory.types?.length && memory.types.every((t) => JOB_KIND[t])) types = [...memory.types];
  const recent = new Set(memory.recent ?? []);
  const onBoard = new Set();
  const fresh = (list, key = (v) => v) => {
    let pool = list.filter((v) => !recent.has(key(v)) && !onBoard.has(key(v)));
    if (!pool.length) pool = list.filter((v) => !onBoard.has(key(v))); // seen everything lately: at least never twice on one board
    const pick = pickFrom(roll, pool.length ? pool : list);
    onBoard.add(key(pick));
    return pick;
  };
  return types.map((type, slot) => {
    const job = { type, slot, day, tier, giver: fresh(PARTS.givers), place: fresh(PARTS.places), reason: fresh(PARTS.reasons[type]) };
    job.angle = roll() * Math.PI * 2;
    job.far = 70 + Math.floor(roll() * 70) + tier * 15;
    if (type === "bounty") {
      const [mob, name, scale = 1] = fresh(BOUNTIES, (b) => b[1]);
      Object.assign(job, { mob, name, need: Math.max(2, Math.round((6 + tier * 2) * scale)), have: 0 });
    } else if (type === "supply") {
      const [item, name, base] = fresh(SUPPLIES, (x) => x[1]);
      Object.assign(job, { item, name, need: Math.round(base * (1 + tier * 0.5)) });
    } else if (type === "camp") job.need = 3 + tier;
    else job.need = 2 + Math.ceil(tier / 2);
    job.renown = Math.round((type === "supply" ? 40 : type === "bounty" ? 55 : 80) * (1 + tier * 0.35));
    job.emeralds = (type === "supply" ? 3 : 2) + tier; // old unit (saved with the job): paid as 8 coins each
    // one job in three is not what it seemed; what the twist is only shows when the job is done
    if (roll() < 0.34) job.twist = pickFrom(roll, TWISTS);
    return job;
  });
}

// Twists: what a finished job turns out to have been.
export const TWISTS = ["keepsake", "windfall", "tale", "debt"];
// Keepsakes: named things people press on you. Each is given once; a player can collect them all.
export const KEEPSAKES = [
  ["minecraft:bell", "The Drover's Bell", "It rang for cattle once. It rings lower now."],
  ["minecraft:compass", "Ferryman's Compass", "It points true on the water and nowhere else."],
  ["minecraft:clock", "The Miller's Clock", "Stopped at the hour the wheel did."],
  ["minecraft:spyglass", "Old Soldier's Glass", "He watched the same hill for thirty years."],
  ["minecraft:lantern", "Pilgrim's Lantern", "Carried to the Gate and, unusually, back."],
  ["minecraft:goat_horn", "Shepherd's Horn", "Three notes. The flock still comes to two of them."],
  ["minecraft:book", "A Tinker's Ledger", "Every debt in the valley, in a hand nobody can read."],
  ["minecraft:feather", "Poacher's Feather", "From a bird that should not have been there either."],
  ["minecraft:candle", "Charcoal Burner's Candle", "It smells of the low ground."],
  ["minecraft:name_tag", "A Name Nobody Claimed", "Found on the road. It was not addressed to you."],
];

// What a player remembers of the board, for rumorsFor
export function remember(hero, job) {
  const keys = [job.giver, job.place, job.reason, job.name].filter(Boolean);
  hero.rumorRecent = [...(hero.rumorRecent ?? []), ...keys].slice(-18);
  hero.lastJobType = job.type;
}

export function describe(job) {
  switch (job.type) {
    case "bounty": return { title: `Bounty: ${job.need} ${job.name}`, text: `${job.giver} wants ${job.need} ${job.name} dead. ${job.reason}` };
    case "camp": return { title: "Raider camp", text: `${job.giver} saw raiders camped ${job.place}. ${job.reason} Break the camp before the next toll.` };
    case "rescue": return { title: "Missing traveller", text: `${job.giver} says someone was taken ${job.place}. ${job.reason} Kill the captors and keep the traveller alive.` };
    default: return { title: `Supplies: ${job.need} ${job.name}`, text: `${job.giver} asks for ${job.need} ${job.name}. ${job.reason} Bring them to the board.` };
  }
}

// ---------- the board ----------

function board(player) {
  const hero = heroOf(player);
  const day = world.getDay();
  if (hero.boardDay !== day) {
    hero.boardDay = day;
    hero.boardTaken = [];
    // asked once a day, so the board stays the same until dawn
    hero.boardTypes = storyteller() ? api.pickSeveral("rumors", player, 3).map((o) => o.id) : undefined;
    saveHero(player);
  }
  return rumorsFor(day, player.id, hero.level, { lastType: hero.lastJobType, recent: hero.rumorRecent, types: hero.boardTypes }).filter((j) => !hero.boardTaken.includes(j.slot));
}

export function rumorMenu(player) {
  const hero = heroOf(player);
  const done = hero.jobsDone ?? 0;
  const form = new ActionFormData().title("Rumor Board");
  const actions = [];
  const head = `Jobs done: ${done}. Every ${JOBS_PER_POINT} jobs pay a skill point (next in ${JOBS_PER_POINT - (done % JOBS_PER_POINT)}).`;
  if (hero.job) {
    const d = describe(hero.job);
    form.body(`${head}\n\n§lYour job: ${d.title}§r\n${d.text}\n\n${progressLine(player, hero.job)}`);
    if (hero.job.type === "supply") { form.button("Hand over the supplies"); actions.push(() => handOver(player)); }
    form.button("Give up this job"); actions.push(() => { clearJob(player); player.sendMessage("§7You let the job go. Someone else may take it."); });
  } else {
    const offers = board(player);
    form.body(offers.length ? `${head}\n\nThree rumors reach the hall each day. Take one at a time.` : `${head}\n\nNothing new today. Rumors travel with the dawn.`);
    for (const job of offers) {
      const d = describe(job);
      form.button(`${d.title}\n§8+${job.renown} Renown, ${worth(job.emeralds)}`);
      actions.push(() => offerMenu(player, job));
    }
  }
  form.button("Close");
  form.show(player).then((r) => { if (!r.canceled) actions[r.selection]?.(); }).catch(() => {});
}

function offerMenu(player, job) {
  const d = describe(job);
  new MessageFormData().title(d.title).body(`${d.text}\n\nPays ${job.renown} Renown and ${worth(job.emeralds)}.`)
    .button1("Take the job").button2("Back")
    .show(player).then((r) => {
      if (r.canceled || r.selection !== 0) return rumorMenu(player);
      take(player, job);
    }).catch(() => {});
}

function take(player, job) {
  const hero = heroOf(player);
  if (hero.job) return;
  if (job.type === "camp" || job.type === "rescue") {
    const keep = api.keepOf(player.id);
    const from = keep ?? player.location;
    job.x = Math.floor(from.x + Math.cos(job.angle) * job.far);
    job.z = Math.floor(from.z + Math.sin(job.angle) * job.far);
    job.spawned = false;
  }
  // with the Storyteller, twists come likelier the longer it has been since the last one
  if (storyteller()) job.twist = api.maybePick("rumor_twists", player)?.id;
  hero.job = job;
  hero.boardTaken = [...(hero.boardTaken ?? []), job.slot];
  saveHero(player);
  sfx(player, "random.orb");
  player.sendMessage(`§6Job taken: ${describe(job).title}.§7 ${progressLine(player, job)}`);
}

function progressLine(player, job) {
  if (job.type === "bounty") return `Slain: ${job.have}/${job.need}`;
  if (job.type === "supply") return `You carry ${api.countItem(player, job.item)}/${job.need}.`;
  const dx = job.x - player.location.x, dz = job.z - player.location.z;
  return `About ${Math.round(Math.hypot(dx, dz))} blocks to the ${heading(dx, dz)} (x ${job.x}, z ${job.z}).${job.spawned ? ` ${job.left ?? job.need} left.` : ""}`;
}

function clearJob(player) {
  const hero = heroOf(player);
  const job = hero.job;
  if (job?.spawned) for (const e of entitiesOf(player, job)) e.remove();
  hero.job = null;
  saveHero(player);
}

function complete(player) {
  const hero = heroOf(player);
  const job = hero.job;
  hero.job = null;
  hero.jobsDone = (hero.jobsDone ?? 0) + 1;
  remember(hero, job);
  let renown = job.renown, emeralds = job.emeralds;
  const kept = hero.keepsakes ?? [];
  let twist = job.twist;
  if (twist === "keepsake" && kept.length >= KEEPSAKES.length) twist = "windfall";
  if (twist === "keepsake") {
    const left = KEEPSAKES.map((k, i) => i).filter((i) => !kept.includes(i));
    const i = left[(hero.jobsDone * 7) % left.length];
    const [id, name, line] = KEEPSAKES[i];
    hero.keepsakes = [...kept, i];
    try {
      const item = new ItemStack(id, 1);
      item.nameTag = `§r§6${name}`;
      item.setLore([`§7${line}`, `§8Given by ${job.giver.toLowerCase()}`]);
      player.dimension.spawnItem(item, player.location);
    } catch { emeralds += 3; }
    player.sendMessage(`§6${job.giver} presses something into your hands: ${name}.§7 (${hero.keepsakes.length} of ${KEEPSAKES.length} keepsakes)`);
  } else if (twist === "windfall") {
    emeralds *= 2;
    player.sendMessage(`§6${job.giver} had more put by than they let on. The pay is doubled.`);
  } else if (twist === "tale") {
    renown = Math.round(renown * 1.5);
    player.sendMessage(`§6${job.giver} tells it at every door for a week, and it grows in the telling.§7 More Renown.`);
  } else if (twist === "debt") {
    hero.rumorDebts = (hero.rumorDebts ?? 0) + 1;
    emeralds = 0;
    player.sendMessage(`§6${job.giver} cannot pay, and says so plainly. §7"I'll not forget it." (They will stand with your walls at the next siege.)`);
  }
  saveHero(player);
  api.title(player, "§6Job done", `§7${describe(job).title}`);
  sfx(player, "random.levelup");
  grantRenown(player, renown, "rumor", true);
  if (emeralds > 0) payE(player, emeralds, "rumor");
  if (hero.jobsDone % JOBS_PER_POINT === 0) grantPoints(player, 1, "word of your deeds spreads");
  if (storyteller()) api.note?.(player, JOB_KIND[job.type] ?? "quiet");
  api.emit("rumorDone", { player, job });
}

function handOver(player) {
  const job = heroOf(player).job;
  if (job?.type !== "supply") return;
  if (api.countItem(player, job.item) < job.need) return player.sendMessage(`§cYou need ${job.need} ${job.name}.`);
  api.takeItems(player, job.item, job.need);
  complete(player);
}

// ---------- jobs out in the world ----------

const jobTag = (player) => `${RUMOR_TAG}_${player.id}`;
function entitiesOf(player, job) {
  try {
    return player.dimension.getEntities({ tags: [jobTag(player)], location: { x: job.x, y: player.location.y, z: job.z }, maxDistance: 96 });
  } catch {
    return [];
  }
}

function spawnAt(player, job, type, name, dx, dz, extraTag) {
  const dim = player.dimension;
  const x = job.x + dx, z = job.z + dz;
  let y = player.location.y;
  try {
    const top = dim.getTopmostBlock({ x, z });
    if (top) y = top.y + 1;
  } catch {
    // use the player's height
  }
  try {
    const e = dim.spawnEntity(type, { x: x + 0.5, y, z: z + 0.5 });
    e.addTag(RUMOR_TAG);
    e.addTag(jobTag(player));
    if (extraTag) e.addTag(extraTag);
    e.nameTag = name; // named mobs don't wander off and vanish
    return e;
  } catch {
    return undefined;
  }
}

function setScene(player, job) {
  const ring = (n, i, r) => [Math.round(Math.cos((i / n) * Math.PI * 2) * r), Math.round(Math.sin((i / n) * Math.PI * 2) * r)];
  let made = 0;
  if (job.type === "camp") {
    try {
      const top = player.dimension.getTopmostBlock({ x: job.x, z: job.z });
      if (top) player.dimension.getBlock({ x: job.x, y: top.y + 1, z: job.z })?.setType("minecraft:campfire");
    } catch {
      // the fire is only dressing
    }
    for (let i = 0; i < job.need; i++) {
      const [dx, dz] = ring(job.need, i, 3);
      const type = job.tier >= 2 && i === 0 ? "minecraft:vindicator" : "minecraft:pillager";
      if (spawnAt(player, job, type, i === 0 ? "Camp Sergeant" : "Camp Raider", dx, dz, "siege_rumor_foe")) made++;
    }
  } else {
    spawnAt(player, job, "minecraft:villager_v2", "Lost Traveller", 0, 0, "siege_rumor_friend");
    for (let i = 0; i < job.need; i++) {
      const [dx, dz] = ring(job.need, i, 4);
      if (spawnAt(player, job, job.tier >= 3 ? "minecraft:vindicator" : "minecraft:pillager", "Captor", dx, dz, "siege_rumor_foe")) made++;
    }
  }
  if (!made) return false;
  job.spawned = true;
  job.left = made;
  saveHero(player);
  player.sendMessage(job.type === "camp" ? "§cYou smell smoke. The camp is close." : "§cYou hear a voice calling for help.");
  return true;
}

export function rumorTick() {
  for (const player of world.getPlayers()) {
    const hero = heroOf(player);
    const job = hero.job;
    if (!job || (job.type !== "camp" && job.type !== "rescue") || player.dimension.id !== "minecraft:overworld") continue;
    const dist = Math.hypot(job.x - player.location.x, job.z - player.location.z);
    if (!job.spawned) {
      if (dist < 40) setScene(player, job);
      continue;
    }
    if (dist > 80) continue; // too far to see what is left
    const there = entitiesOf(player, job);
    const foes = there.filter((e) => e.hasTag("siege_rumor_foe"));
    if (job.type === "rescue" && !there.some((e) => e.hasTag("siege_rumor_friend"))) {
      for (const e of foes) e.remove();
      hero.job = null;
      saveHero(player);
      api.title(player, "§cToo late", "§7The traveller is dead");
      continue;
    }
    if (foes.length !== job.left) { job.left = foes.length; saveHero(player); }
    if (foes.length === 0) {
      const friends = there.filter((e) => e.hasTag("siege_rumor_friend"));
      if (friends.length) player.sendMessage("§a\"Thank you. I know the way home from here.\"");
      system.runTimeout(() => { for (const f of friends) if (f.isValid) f.remove(); }, 100);
      complete(player);
    }
  }
}

world.afterEvents.entityDie.subscribe((event) => {
  const killer = event.damageSource.damagingEntity;
  if (killer?.typeId !== "minecraft:player") return;
  const job = heroOf(killer).job;
  if (job?.type !== "bounty") return;
  let type;
  try {
    type = event.deadEntity.typeId;
  } catch {
    return;
  }
  if (type !== job.mob) return;
  job.have++;
  if (job.have >= job.need) return complete(killer);
  saveHero(killer);
  killer.onScreenDisplay.setActionBar(`§6Bounty: ${job.have}/${job.need} ${job.name}`);
});
