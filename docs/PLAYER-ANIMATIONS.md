# Player action animations

Custom first- and third-person moves for every player. Written by `tools/build_player_anims.py`
(run it from the repo root after changing it; it rewrites the files below and is safe to run twice).

| File | What |
| --- | --- |
| `Siege_Nights_RP/animations/player_actions.animation.json` | the moves |
| `Siege_Nights_RP/animation_controllers/player_actions.animation_controllers.json` | which move plays when |
| `Siege_Nights_RP/entity/player.entity.json` | per-frame state (`variable.hc_*` lines) and the aliases |

## How it fits into vanilla

- The vanilla root controller still runs. Ours is a second controller (`hc_actions`) listed after it in
  `animate`, so its moves add on top: sprint lean and arm pump, a pose in the air, a dip on landing after a
  fall, a little breathing at rest, the bow draw and its release, and first-person sprint sway and bow shake.
- Two vanilla aliases point at our controllers instead: `attack.rotations` (third-person swing) and
  `first_person_attack_rotation` (first-person swing). For pickaxes, shovels, hoes, blocks and anything else
  those controllers play the vanilla swing, so mining looks the same.
- Swings by what is in the main hand: swords (`minecraft:is_sword` tag or the listed ids) go forehand,
  backhand, thrust; axes, the warhammer and the mace go chop, sweep, chop; bare hands go jab, jab, hook.
  A pause of 1.2 s starts the combo over.
- Bow (vanilla bow and the Rimefang Bow): the torso turns side-on while the arms keep the aim, the draw
  fills over 1 s, the arms shake after 1.5 s at full draw, and letting go has a short follow-through.
  The Rimefang Bow also gets the vanilla aiming pose now (vanilla only gives it to `minecraft:bow`).
- No 3D held weapons (attachables) are involved: items stay in the hand bone the way vanilla draws them.

## Rules for changes

- Positive y rotation turns toward the player's right; positive x on an arm lowers it, negative raises it
  forward. Lean and twist go on `waist` (pivot at the hips), with a head counter-turn so the aim stays put.
- Item queries in `pre_animation` sit behind `query.has_property('hc:look')`, because the menu paper doll
  has no actor.
- Any other pack that replaces `minecraft:player` in its own `player.entity.json` and sits above this one
  wins the whole file, which turns these moves (and the Looking Glass looks) off for that player.
- Preview: https://claude.ai/artifact/Sxm8vRMhruye1dw2ig1e5Y runs the same expressions in 3D (third person).
