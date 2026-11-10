// Winning the Heart (Mateo's rule): nobody is asked and nobody votes. When the Hollow is beaten the Heart
// lies where the final boss fell. Leave it and it stays there for whoever comes later. Reach for it and
// everyone is told, and anyone who wants it instead has a few seconds to knock your hand away.

import { world, system } from "@minecraft/server";
import { isReady, onTick } from "../siege/api.js";
import { CROWN, IDS } from "./config.js";
import { reachProblem } from "./rules.js";
import { crown, saveCrown, announce, playerById } from "./state.js";
import { award } from "./reign.js";
import { sfx } from "../core/sfx.js";

let reach = null; // { id, name, left } while someone has a hand on it (not saved: a reload lets go)

// Said once, to whoever is standing there. Mateo's rule: the game says the Hollow Crown is not the prize.
const HEART_TEXT = [
  "§7The thing on the throne is dead. Its crown has rolled to the foot of the dais, and you know, the way you know not to step off a cliff, that putting it on would kill you. The Hollow Crown is for someone who can bend the Hollow.",
  `§7But in the ruin of its chest §5${CROWN.relic}§7 is still beating, and nothing warns you away from that.`,
  "§7Only one of you can carry it. Take it, or leave it lying here for whoever comes after.",
];

const dimOf = (rest) => world.getDimension(rest.dim);

export function restHeart(at, dimensionId) {
  const c = crown();
  if (c.ruler || c.pendingCrown) return;
  c.resting = { x: Math.floor(at.x) + 0.5, y: Math.floor(at.y), z: Math.floor(at.z) + 0.5, dim: dimensionId };
  c.vacant = false;
  saveCrown();
  reach = null;
  announce(`§5${CROWN.relicName} lies where its keeper fell. It will wait there until someone takes it.`, "block.bell.hit");
  try {
    for (const p of dimOf(c.resting).getPlayers({ location: c.resting, maxDistance: 48 })) for (const line of HEART_TEXT) p.sendMessage(line);
  } catch { /* nobody there */ }
}

function heartEntity(rest) {
  try {
    return dimOf(rest).getEntities({ type: IDS.restingHeart, location: rest, maxDistance: 4 })[0];
  } catch {
    return undefined;
  }
}

function startReach(player) {
  const c = crown();
  if (!c.resting || c.ruler || c.pendingCrown) return;
  if (reach?.id === player.id) return;
  if (reach) return player.onScreenDisplay.setActionBar(`§c${reach.name} already has a hand on it. Knock them away.`);
  reach = { id: player.id, name: player.name, left: CROWN.reachSeconds };
  announce(`§4§l${player.name} is reaching for ${CROWN.relic}!§r §7Only one can carry it. It is theirs in ${CROWN.reachSeconds} seconds unless someone stops them.`, "mob.wither.spawn");
}

function stopReach(why) {
  if (!reach) return;
  announce(`§7${reach.name} ${why}. ${CROWN.relicName} still lies there.`, "random.break");
  reach = null;
}

function take(player) {
  const c = crown();
  heartEntity(c.resting)?.remove();
  c.resting = null;
  saveCrown();
  reach = null;
  announce(`§6§l${player.name} has taken ${CROWN.relic}.`, "ui.toast.challenge_complete");
  award(player.id, []);
}

function heartTick() {
  const c = crown();
  const rest = c.resting;
  if (!rest) { reach = null; return; }
  if (c.ruler || c.pendingCrown) { // someone holds it already (a test command, most likely)
    heartEntity(rest)?.remove();
    c.resting = null;
    return saveCrown();
  }
  let dim;
  try {
    dim = dimOf(rest);
    if (!heartEntity(rest) && dim.getBlock(rest)) { // put it back whenever its place is loaded
      const heart = dim.spawnEntity(IDS.restingHeart, { x: rest.x, y: rest.y + 0.3, z: rest.z });
      heart.nameTag = `§5${CROWN.relicName}`;
    }
    dim.spawnParticle("minecraft:sculk_soul_particle", { x: rest.x, y: rest.y + 1.4, z: rest.z });
  } catch { /* not loaded */ }
  if (!reach) return;

  const player = playerById(reach.id);
  const here = !!player && player.dimension.id === rest.dim;
  const problem = reachProblem({ here, distance: here ? Math.hypot(player.location.x - rest.x, player.location.y - rest.y, player.location.z - rest.z) : 0 });
  if (problem) return stopReach(problem);
  reach.left -= 1;
  if (reach.left <= 0) return take(player);
  try {
    for (const p of dim.getPlayers({ location: rest, maxDistance: 64 })) {
      p.onScreenDisplay.setActionBar(`§4${reach.name} is taking ${CROWN.relic}: ${reach.left}s`);
      sfx(p, "mob.warden.heartbeat");
    }
  } catch { /* not loaded */ }
}

// Click it or punch it to reach for it
world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  if (!isReady() || event.target.typeId !== IDS.restingHeart) return;
  event.cancel = true;
  const player = event.player;
  system.run(() => startReach(player));
});
world.afterEvents.entityHitEntity.subscribe((event) => {
  if (!isReady() || event.hitEntity.typeId !== IDS.restingHeart || event.damagingEntity.typeId !== "minecraft:player") return;
  startReach(event.damagingEntity);
});

// Any hurt at all breaks the reach: that is how the others say no
world.afterEvents.entityHurt.subscribe((event) => {
  if (reach && event.hurtEntity.id === reach.id && event.damage > 0) stopReach("is knocked away from it");
});

onTick("crown resting heart", 20, heartTick);
