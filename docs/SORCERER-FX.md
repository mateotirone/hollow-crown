# Sorcerer casting: magic hotbar, cast moves, particles, sounds

Pack files are written by `tools/build_sorcerer_fx.py` (run from the repo root; safe to run twice). Scripts:
`townhall/spellbar.js` (the magic hotbar), `townhall/marked_fx.js` (how powers look and sound), `townhall/marked.js` (what powers do).

## Controls

- Use the **Bound Ember**: the nine hotbar slots are swapped into a hidden satchel (`siege:spell_satchel`, no model,
  no collision, follows the player every second, across dimensions) and replaced with one `siege:spell_<power>`
  icon per power known, the Ember (a locked copy) in slot 9.
- Use a spell icon: casts that power. The icon's `minecraft:cooldown` category `siege_spell_<power>` shows the
  cooldown sweep (started by `player.startItemCooldown`). Sneak + use any icon, or use the Ember: the bar closes.
- Icons and the Ember copy are `lockMode = slot` and `keepOnDeath`, and are cleared whenever the bar shuts.
- Death with the bar up: satchel items drop where the player fell (or are held in memory and given back on respawn
  with keepInventory). Log off with the bar up: on rejoin the satchel is found nearby and the hotbar comes back.
  If it can't be found, the player is told, and it is returned when they next come within 24 blocks of it.
- Bedrock add-ons can't add new keys, so the Ember is the "hotkey".

## Looks and sounds

| Power | Move (`animation.siege.player.cast.<key>`) | Particles | Sound cue |
| --- | --- | --- | --- |
| Ember Bolt | Ember pulled to the chest, hand thrown forward | `arc_trail` beads, `arc_burst` on landing | `cast.bolt`, `cast.hit` |
| Ward | arms crossed over the chest, flung wide | `arc_ward` shell | `cast.ward` |
| Blink | arms back, lean in | `arc_tear` at both ends, `arc_trail` | `cast.blink` |
| Echo Sight | fingers to the temple, head lifts | `arc_ring` spreading, `arc_mark` over each creature (only you see) | `cast.echo` |
| Bind | both hands out, close, yank back | `arc_link` chain, `arc_snare` at the feet | `cast.bind` |
| Halfstep | arms sweep down and back, low lean | `arc_peel` | `cast.step` |
| Veilstep | hands raised high, torn apart | `arc_rift` where you leave and where you land | `cast.hollowstep` |
| Choir's Call | Ember raised high, rung down like a bell | `arc_ring` the size of the Call | `cast.choir` |
| Overwhelmed | hands to the head, doubled over | | `cast.overwhelmed` |
| Crescendo | | `arc_ring` | `cast.crescendo` |

The Ember smoulders (`arc_smoulder`, rate from Resonance) while it or a spell is in hand; loud Sorcerers wear
`arc_halo`. Moves play with `playAnimation` on their own controller (`siege_cast`) so they add on top of the
vanilla and PR #127 moves; in first person only a quarter of the move shows. Cues are in `core/sfx_cues.js`
(layered vanilla sounds, no recordings needed).

## The spell pass (2026-11-14)

Mateo asked for every weak note in the Ember Spellbook review to be fixed (preview: https://claude.ai/artifact/9P2HjzjRspFyGBjqrqMZtZ).
`tools/build_sorcerer_fx.py` now also writes:

- **`siege:arc_fx`**: one effect entity, six models picked by the `siege:form` property (spawn it as `siege:arc_fx<siege:form_bell>`
  so the right model shows from the first frame): `shard`, `ward` (3 plates, `siege:count` shows 0-3), `chains` (3 loops, same),
  `bell` (toll with `playAnimation("animation.siege.arc_fx.toll")`), `rift` (`rift_close` before removing), `ghost` (the Blink
  afterimage, sinks away by itself). Helpers in `marked_fx.js`: `spawnFx`, `moveFx`, `removeFx`, `playFx`, `setFxCount`.
  A 30 s timer removes any the script forgot.
- Particles `arc_streak`, `arc_brand`, `arc_paleburn`, `arc_shatter`, `arc_shimmer`, `arc_note`, `arc_thread`, `arc_hum`, `arc_crown`.
- Fog `siege:arc_echo` (pushed as `hc_echo` while Echo Sight lasts).
- Move `cast.crescendo`. In first person every move now plays at half size (was a quarter).
- **The Marked layer**: player property `hc:mark` (0 not Marked, 1-5 the stage from `markStage`), three render controllers in
  `hc_marked.render_controllers.json` (default skin, Looking Glass look, first-person arm), material `entity_emissive_alpha` so
  the veins give their own light. Source art: `art/marked_layer/`.
- **Loud**: every Hollow creature that picks its own fights (not bosses or their adds) gets
  `nearest_prioritized_attackable_target` for players tagged `siege_resonant` within 32 blocks, one step above its usual
  target goal. `studio/bestiary/build.py` writes the same goal.

| Power | Now |
| --- | --- |
| Ember Bolt | 0.1 s draw, then a shard flies 2 blocks a tick; walls stop it. Hit: brand, 0.4 push. Lv 3 Paleburn (1 a second for 3 s, no fire). Bound target: +40% and the chains break. Cooldown 0.8 s. |
| Ward | Shield = the Absorption; plates break at each third lost (entityHurt); the last pushes 2.5 blocks. |
| Blink | Lean first, jump 2 ticks later; afterimage 1.2 s; dense streak. |
| Echo Sight | Night Vision plus the violet fog; a pulse every 2 s (ring at the real range, `echoPulse` event for other features); doors, hatches, gates and seals within 12 blocks hum for the caster (`DOOR_BLOCK`). |
| Bind | Slowness 255 and Weakness 255 (Weakness II on bosses); chains for the whole root, a loop breaks at each third. |
| Halfstep | Armour, offhand and held item go into a satchel for the step and come back (also after a death or a log-off); shimmer every 7 ticks; return push 1.5 blocks. |
| Choir's Call | Bell above you, tolls three times with a ring at the real radius; each raider is struck by the next so it turns on it; threads and cracked notes. |
| Veilstep | 0.8 s channel with the rift in front of you; 4 damage in the channel stops it and refunds the cost; the rift stays 3 s at both ends. |
| Crescendo / Overwhelmed | Crescendo pose every 2 s and a crown of sparks; Overwhelmed: 1 damage a second for 3 s with a camera shake instead of Wither. |
