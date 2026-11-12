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
