// Boss move animations. Each fight attack has two animations made by studio/bestiary/anims.py:
//   animation.siege_b.<mob>.move.<attack>.wind     the wind-up pose, held (and trembling) while the warning is up
//   animation.siege_b.<mob>.move.<attack>.strike   the release, played the moment the hit lands
// plus "rage" when a new phase begins. bossCore calls bossMove(); a move with no animation does nothing.
// Walking, swinging, aiming and flinching need no script: the client entity's controllers do those.

import { addTests, assertEqual } from "../siege/api.js";
import { MOVES } from "./moves.js";

const CONTROLLER = "siege_boss_move"; // one controller, so a strike replaces its own wind-up

// The animation for a boss entity's move at a stage ("wind" or "strike"), or undefined if it has none
export function moveAnimation(typeId, move, stage) {
  if (!MOVES[typeId]?.includes(move)) return undefined;
  if (stage === "wind" && move === "rage") return undefined; // rage has no wind-up
  return `animation.siege_b.${typeId.replace(/^siege:/, "")}.move.${move}.${stage}`;
}

// A held wind-up lets go by itself a little after the hit was due, in case the hit never comes (fight paused, boss gone)
export const windStop = (windupTicks) => `query.anim_time > ${Math.round((windupTicks / 20 + 0.6) * 100) / 100}`;

export function bossMove(entity, move, stage, windupTicks = 20) {
  try {
    const name = moveAnimation(entity.typeId, move, stage);
    if (!name || !entity.isValid) return;
    entity.playAnimation(name, {
      controller: CONTROLLER,
      blendOutTime: 0.15,
      stopExpression: stage === "wind" ? windStop(windupTicks) : "query.any_animation_finished",
    });
  } catch {
    // unloaded, or an older engine without playAnimation: the fight goes on without the pose
  }
}

addTests("bestiary", {
  "boss moves name their wind-up and strike animations": () => {
    assertEqual(moveAnimation("siege:clockwork_reeve", "cog", "wind"), "animation.siege_b.clockwork_reeve.move.cog.wind");
    assertEqual(moveAnimation("siege:oswin_the_last", "blow", "strike"), "animation.siege_b.oswin_the_last.move.blow.strike");
    assertEqual(moveAnimation("siege:clockwork_reeve", "rage", "wind"), undefined);
    assertEqual(moveAnimation("siege:clockwork_reeve", "no_such_move", "wind"), undefined);
    assertEqual(moveAnimation("siege:rimewolf", "cog", "wind"), undefined);
    assertEqual(windStop(30), "query.anim_time > 2.1");
  },
});
