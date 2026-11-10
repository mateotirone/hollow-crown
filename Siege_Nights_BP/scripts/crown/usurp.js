// Taking the Crown: Claims, Crown Shards, the Gauntlet, the Storm, and banishment.

import { world, system, ItemStack } from "@minecraft/server";
import {
  isReady, keepOf, keepCenter, overworld, title, onTick, on, emit, isOnline, isNight, isAlly,
  settlementAt, consumeHeld, addSiegeSkipHook, KEEP_BANNER,
} from "../siege/api.js";
import { CROWN, IDS } from "./config.js";
import { claimNeeded, gauntletProblem, stormAtNightfall, abandoned, compass, EXILE_STAGES } from "./rules.js";
import {
  crown, saveCrown, ruler, isRuler, isCourt, rulerLabel, playerById, announce, giveItem, claimOf, addClaim, seat, surfaceY, siegeNumber,
} from "./state.js";
import { citadel, throneSpots, exilePoint, moveIn } from "./citadel.js";
import { crownPlayer, endReign, addHollowing } from "./reign.js";

// ---------- Earning a Claim ----------

const canClaim = (id) => !!ruler() && !isRuler(id) && !isCourt(id);

on("siegeReward", ({ player }) => {
  if (canClaim(player.id)) addClaim(player, CROWN.claimSiegeWin + crown().unrest, "you held your keep");
});

on("warlordSlain", ({ owner }) => {
  const player = playerById(owner);
  if (player && canClaim(owner)) addClaim(player, CROWN.claimWarlord, "a warlord slain");
});

// ---------- Shardfall ----------

on("siegeEnd", () => {
  const c = crown();
  const s = seat();
  if (!c.ruler || !s || c.shards.length >= CROWN.shardsMax) return;
  let spot;
  for (let tries = 0; tries < 20 && !spot; tries++) {
    const a = Math.random() * Math.PI * 2;
    const d = CROWN.shardMinDistance + Math.random() * (CROWN.shardMaxDistance - CROWN.shardMinDistance);
    const at = { x: Math.floor(s.x + Math.cos(a) * d), y: s.y, z: Math.floor(s.z + Math.sin(a) * d) };
    if (!settlementAt(at)) spot = { x: at.x, z: at.z, placed: false };
  }
  if (!spot) return;
  c.shards.push(spot);
  saveCrown();
  emit("shardfall", { x: spot.x, z: spot.z });
  const tell = (player, exact) => {
    const where = compass(player.location, spot);
    player.sendMessage(exact
      ? `§5Your people send word: an ${CROWN.shard} has fallen at ${spot.x}, ${spot.z} (${where.text}). The others will know in a minute.`
      : `§5An ${CROWN.shard} has fallen ${where.text}. Whoever binds it strengthens their Claim on the throne.`);
    player.playSound("ambient.weather.thunder", { volume: 0.4 });
  };
  const early = (p) => (c.exiles[p.id]?.stage ?? 0) >= 3;
  for (const p of world.getPlayers()) if (early(p)) tell(p, true);
  system.runTimeout(() => { for (const p of world.getPlayers()) if (!early(p)) tell(p, false); }, CROWN.shardHeadStartTicks);
});

// Set each fallen shard into the ground once its land is loaded, light it up, and forget it once it's taken
function shardTick() {
  const c = crown();
  if (!c.shards.length) return;
  const dim = overworld();
  let changed = false;
  c.shards = c.shards.filter((shard) => {
    try {
      if (!shard.placed) {
        const y = surfaceY(shard.x, shard.z);
        if (y === undefined) return true;
        const block = dim.getBlock({ x: shard.x, y: y + 1, z: shard.z });
        if (!block) return true;
        block.setType(IDS.shardBlock);
        dim.spawnEntity("minecraft:lightning_bolt", { x: shard.x + 0.5, y: y + 1, z: shard.z + 0.5 });
        shard.y = y + 1;
        shard.placed = true;
        changed = true;
        return true;
      }
      const block = dim.getBlock({ x: shard.x, y: shard.y, z: shard.z });
      if (!block) return true;
      if (block.typeId !== IDS.shardBlock) { changed = true; return false; } // someone took it
      for (let h = 1; h < 40; h += 2) dim.spawnParticle("minecraft:end_chest", { x: shard.x + 0.5, y: shard.y + h, z: shard.z + 0.5 });
      return true;
    } catch {
      return true;
    }
  });
  if (changed) saveCrown();
}

function useShard(player) {
  const c = crown();
  if (!c.ruler) return player.onScreenDisplay.setActionBar("§7The shard is cold. The throne is empty.");
  consumeHeld(player);
  if (isRuler(player.id) || isCourt(player.id)) {
    c.treasury += CROWN.shardTreasury;
    saveCrown();
    addHollowing(-CROWN.hollowShatter);
    player.playSound("random.glass");
    return player.sendMessage(`§aThe shard shatters. One less Claim against you. §7+${CROWN.shardTreasury} emeralds to the Treasury.${c.ruler.hollowing >= 25 ? " §8§oFor a moment, everything is quiet." : ""}`);
  }
  player.playSound("block.end_portal_frame.fill");
  addClaim(player, CROWN.claimShard, `an ${CROWN.shard} bound`);
  emit("shardBound", { player });
  const need = claimNeeded(c.ruler.hollowing);
  if (claimOf(player.id) >= need) player.sendMessage("§5Your Claim is strong enough. Craft a Gauntlet of Challenge at a Siege Workshop and use it.");
}

// ---------- The Gauntlet ----------

function useGauntlet(player) {
  const c = crown();
  const problem = gauntletProblem({
    ruler: c.ruler, playerId: player.id, isCourt: isCourt(player.id), claim: claimOf(player.id),
    challenge: c.challenge, siegeNumber: siegeNumber(), graceUntil: c.graceUntil,
  });
  if (problem) return player.sendMessage(`§c${problem}`);
  consumeHeld(player);
  c.challenge = { claimant: player.id, name: player.name, declaredMs: Date.now(), missed: 0, stormed: false };
  c.names[player.id] = player.name;
  saveCrown();
  announce(`§4§l${player.name} has thrown down the Gauntlet!§r §4They will storm ${CROWN.citadelName} on the next siege night that ${rulerLabel()} is here to answer.`, "raid.horn");
  const r = playerById(c.ruler.id);
  if (r) title(r, "§4You are challenged", `§7${player.name} comes for your throne on the next siege night`);
}

world.afterEvents.itemUse.subscribe((event) => {
  if (!isReady()) return;
  const id = event.itemStack.typeId;
  if (id === IDS.shardItem) useShard(event.source);
  else if (id === IDS.gauntlet) useGauntlet(event.source);
});

// ---------- The Storm ----------

const stormSide = (id) => {
  const s = crown().storm;
  return !!s && (id === s.claimant || (!!keepOf(s.claimant) && isAlly(s.claimant, id)));
};

// On a Storm night the raiders leave the claimant's side alone: this fight is between players
addSiegeSkipHook((owner) => stormSide(owner));

on("siegeStart", () => {
  const c = crown();
  if (!c.ruler || !c.challenge || c.storm) return;
  const what = stormAtNightfall({ challenge: c.challenge, rulerOnline: isOnline(c.ruler.id), claimantOnline: isOnline(c.challenge.claimant) });
  if (what === "storm") return beginStorm();
  if (what === "claimantMissed") {
    c.challenge.missed += 1;
  } else if (what === "lapse") {
    announce(`§7${c.challenge.name} never came. Their challenge has lapsed.`);
    c.claims[c.challenge.claimant] = Math.min(claimOf(c.challenge.claimant), CROWN.lapsedClaim);
    c.challenge = null;
  }
  saveCrown();
});

function beginStorm() {
  const c = crown();
  c.challenge.stormed = true;
  c.storm = { claimant: c.challenge.claimant, deaths: 0, rulerAway: 0, claimantAway: 0 };
  saveCrown();
  announce(`§4§lThe Storm.§r §4${c.challenge.name} marches on ${CROWN.citadelName}. Break the Throne Seal before dawn and ${CROWN.relic} changes hands.`, "mob.wither.spawn");
  const r = playerById(c.ruler.id);
  if (r) title(r, "§4Defend the throne", "§7Hold the Throne Seal until dawn");
  const claimant = playerById(c.storm.claimant);
  if (claimant) title(claimant, "§4Storm the Citadel", `§7Break the Throne Seal. You have ${CROWN.claimantLives} lives.`);
  emit("stormStart", { ruler: c.ruler.id, claimant: c.storm.claimant });
}

// Where the Seal stands: in front of the throne, or beside the ruler's banner if there's no Citadel yet
function sealSpot() {
  const spots = citadel()?.built ? throneSpots() : undefined;
  if (spots) return spots.seal;
  const keep = ruler() && keepOf(ruler().id);
  if (!keep) return undefined;
  const center = keepCenter(keep);
  return { x: center.x + 1, y: center.y, z: center.z };
}

const seals = () => overworld().getEntities({ type: IDS.seal, excludeTags: ["siege_showcase"] }); // not the test-world exhibit

function stormTick() {
  const c = crown();
  const storm = c.storm;
  for (const player of world.getPlayers()) { // only the claimant's side can hurt the Seal
    const should = stormSide(player.id);
    if (should !== player.hasTag(IDS.stormTag)) should ? player.addTag(IDS.stormTag) : player.removeTag(IDS.stormTag);
  }
  if (!storm) {
    if (system.currentTick % 200 < 20) for (const seal of seals()) seal.remove();
    return;
  }
  if (!c.ruler) return endStorm();
  if (!isNight()) return rulerHolds("dawn broke over an unbroken Seal");

  const rulerHere = isOnline(c.ruler.id), claimantHere = isOnline(storm.claimant);
  storm.rulerAway = rulerHere ? 0 : storm.rulerAway + 20;
  storm.claimantAway = claimantHere ? 0 : storm.claimantAway + 20;
  if (storm.claimantAway >= CROWN.awayTicks) return rulerHolds("the claimant fled the field");
  if (storm.rulerAway >= CROWN.awayTicks) return claimantWins("the ruler fled the throne");

  let seal = seals()[0];
  if (!seal && !storm.sealUp) {
    const spot = sealSpot();
    try {
      if (spot && overworld().getBlock(spot)) {
        seal = overworld().spawnEntity(IDS.seal, spot);
        seal.getComponent("minecraft:health")?.setCurrentValue(CROWN.sealHealth);
        storm.sealUp = true;
        saveCrown();
      }
    } catch { /* the throne room isn't loaded until someone is near it */ }
  }
  const health = seal?.getComponent("minecraft:health");
  const hp = health ? Math.ceil(health.currentValue) : CROWN.sealHealth;
  if (seal) seal.nameTag = `§5Throne Seal §f${hp}/${CROWN.sealHealth}`;
  const ticksLeft = (23000 - world.getTimeOfDay() + 24000) % 24000;
  const line = `§5Throne Seal ${hp}/${CROWN.sealHealth}  §7Dawn in ${Math.ceil(ticksLeft / 20)}s  §cClaimant lives: ${CROWN.claimantLives - storm.deaths}`;
  for (const player of world.getPlayers()) if (isRuler(player.id) || isCourt(player.id) || stormSide(player.id)) player.onScreenDisplay.setActionBar(line);
}

world.afterEvents.entityDie.subscribe((event) => {
  if (!isReady()) return;
  const storm = crown().storm;
  if (!storm) return;
  const dead = event.deadEntity;
  if (dead.typeId === IDS.seal) return claimantWins("the Throne Seal was broken");
  if (dead.typeId === "minecraft:player" && dead.id === storm.claimant) {
    storm.deaths += 1;
    saveCrown();
    if (storm.deaths >= CROWN.claimantLives) rulerHolds(`the claimant fell ${CROWN.claimantLives} times`);
    else announce(`§7${dead.name} has fallen. ${CROWN.claimantLives - storm.deaths} lives left.`);
  }
});

function endStorm() {
  const c = crown();
  c.storm = null;
  c.challenge = null;
  c.graceUntil = siegeNumber() + CROWN.graceNights;
  saveCrown();
  for (const seal of seals()) seal.remove();
}

function rulerHolds(why) {
  const c = crown();
  const claimant = c.storm?.claimant ?? c.challenge?.claimant;
  const name = c.challenge?.name ?? "The claimant";
  c.claims[claimant] = 0;
  c.treasury += CROWN.defenseReward;
  endStorm();
  addHollowing(CROWN.hollowPerDefense);
  announce(`§6${rulerLabel()} holds the throne: ${why}. §7${name}'s Claim is broken.`, "ui.toast.challenge_complete");
  emit("stormEnd", { winner: c.ruler.id, ruler: c.ruler.id, claimant, usurped: false });
}

// The Crown changes hands. `claimant` must be online (they are: they just won, or the ruler fled).
export function claimantWins(why) {
  const c = crown();
  const claimantId = c.storm?.claimant ?? c.challenge?.claimant;
  const claimant = playerById(claimantId);
  if (!claimant || !c.ruler) return endStorm();
  const spot = seat();
  const wasExile = !!c.exiles[claimantId];
  const old = endReign(`usurped by ${claimant.name}`);
  endStorm();
  c.claims[claimantId] = 0;
  announce(`§4§lThe throne has fallen:§r §4${why}. ${old.title} ${old.name} is cast out.`, "mob.wither.death");
  if (spot) moveIn(claimant, spot);
  crownPlayer(claimant, { hollowing: wasExile ? 0 : Math.floor(old.hollowing / 2), restored: wasExile });
  banish(old.id, old.name);
  emit("stormEnd", { winner: claimantId, ruler: old.id, claimant: claimantId, usurped: true });
}

// A ruler who dodges a challenge for a week of real time loses the Crown without a fight
function abandonTick() {
  const c = crown();
  if (!c.ruler || !abandoned(c.challenge, Date.now())) return;
  if (!playerById(c.challenge.claimant)) return; // wait until the claimant is here to be crowned
  claimantWins(`${rulerLabel()} would not answer the challenge for ${CROWN.abandonDays} days, and ${CROWN.relic} went cold in their hand`);
}

// ---------- Banishment ----------

export function banish(id, name) {
  const c = crown();
  c.exiles[id] = { name, stage: 0, until: siegeNumber() + CROWN.banishNights, pending: true };
  c.claims[id] = CROWN.claimExileStart;
  saveCrown();
  const player = playerById(id);
  if (player) castOut(player);
}

function castOut(player) {
  const c = crown();
  const exile = c.exiles[player.id];
  if (!exile) return;
  const from = seat() ?? player.location;
  player.teleport(exilePoint(from), { dimension: overworld() });
  exile.pending = false;
  saveCrown();
  title(player, `§4Banished from ${CROWN.citadelName}`, "§7You were a ruler this morning");
  player.playSound("mob.wither.death", { volume: 0.5 });
  giveItem(player, new ItemStack(KEEP_BANNER, 1));
  player.sendMessage(`§7You are cast out with what you carry. ${CROWN.citadelName} is closed to you for ${CROWN.banishNights} siege nights.`);
  player.sendMessage(`§5But you held it once, and the throne remembers: your Blood Claim starts at ${CROWN.claimExileStart}. §7${EXILE_STAGES[0].name}: ${EXILE_STAGES[0].goal}`);
}

world.afterEvents.playerSpawn.subscribe((event) => {
  if (!isReady()) return;
  const c = crown();
  const player = event.player;
  c.names[player.id] = player.name;
  if (c.exiles[player.id]?.pending) system.runTimeout(() => castOut(player), 40);
  if (event.initialSpawn && c.challenge && isRuler(player.id)) {
    system.runTimeout(() => title(player, "§4You are challenged", `§7${c.challenge.name} storms the throne on the next siege night`), 100);
  }
});

// Exiles can't set foot on the ruler's land until their banishment runs out
function exileTick() {
  const c = crown();
  const r = c.ruler;
  if (!r) return;
  for (const player of world.getPlayers()) {
    const exile = c.exiles[player.id];
    if (!exile) continue;
    const tag = `§7[Exile]§r ${player.name}`;
    if (player.nameTag !== tag) player.nameTag = tag;
    if (c.storm && stormSide(player.id)) continue; // an exile storming the throne may enter
    if (siegeNumber() >= exile.until || player.dimension.id !== "minecraft:overworld") continue;
    if (settlementAt(player.location) !== r.id) continue;
    player.teleport(exilePoint(seat() ?? player.location), { dimension: overworld() });
    player.onScreenDisplay.setActionBar(`§cYou are banished for ${exile.until - siegeNumber()} more siege nights.`);
  }
}

onTick("crown storm", 20, stormTick);
onTick("crown shards", 40, shardTick);
onTick("crown exile", 40, () => { exileTick(); abandonTick(); });
