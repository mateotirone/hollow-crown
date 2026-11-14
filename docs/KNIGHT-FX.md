# Knight technique effects

How the Knight's Blade techniques and the Oath Banner look and sound. Pass of 2026-11-14 (Mateo: "fix the whats weak
stuff" after the Knight pages of the Ember Spellbook viewer). Untested in game.

- **Pack files:** `python3 tools/build_knight_fx.py` writes the moves (`animations/knight_moves.animation.json`), the
  `siege:kn_*` particles and their sheet (`textures/particle/hc_knight.png`), and the `siege:knight_fx` entity.
- **Scripts:** `Siege_Nights_BP/scripts/townhall/knight.js` (the techniques) and `townhall/knight_fx.js` (moves, particles,
  the 3D objects). Everything cosmetic is wrapped so a technique still works if a particle or animation is missing.
- **Sounds:** the `kn.*` cues in `core/sfx_cues.js` (listed in SOUND-LIST.md). No technique plays the raid horn: that is
  the siege horn.

## siege:knight_fx

| Form | What | Life |
|---|---|---|
| 0 `banner` | Banner of the Keep: a 10-block war banner (dark oak pole, iron cap and crossbar, cloth with the Oath mark and a gold fringe). `siege:color` 0-15 picks the cloth (siege/constants.js COLORS), from the Knight's keep colour, else the settlement they stand in, else red. Animations: drop (in from 11 blocks up, slams down), wave (cloth in the wind), furl and sink (played by script when time is up). | 20 / 30 s, then 2 s to furl and sink |
| 1 `sword` | Crownbreaker: a ghostly greatsword, three blocks long, that falls point first (0.3 s) and fades down into the ground. | about 2 s |

A 40 s timer removes any left behind when a world closes mid-technique.

## Techniques

| Technique | Move | Particles | Sound |
|---|---|---|---|
| Shield Bash | `bash`: shield arm punches forward with a step in | `kn_grit` cone off the shield face; `kn_settle` on the creature for the slow | `kn.bash` |
| Lunge | `thrust` | `kn_grit` off your heels, `kn_parry` on the hit | `kn.lunge`, `kn.thrust` |
| Riposte | `backhand` | `kn_parry` off the shield; `kn_glow` on the sword arm for the 3 s of Strength | `kn.parry` |
| Rallying Cry | `raise`: the Oath Banner overhead | `kn_ring` to 10 blocks; `kn_rise` on everyone reached; `kn_glow` on them for 8 s | `kn.rally` |
| Banner of the Keep | `plant` | `kn_dust` and `kn_cracks` at the foot; `kn_reach` every second at 10 blocks; `kn_haze` on weakened enemies | `kn.plant`, `kn.furl` |
| Warhorse Charge | `lance` while at speed | `kn_hooves`; `kn_parry` and `kn_grit` on impact, and the creature spins | `kn.gallop`, `kn.trample` |
| Execution | `chop` | `kn_mark` over creatures below 20% (only the Knight sees it, `player.spawnParticle`); `kn_parry` on the hit; a small camera dip | `kn.execute` |
| Second Wind | `kneel` | `kn_shell` for the Resistance; `kn_ring` as you stand | `kn.secondwind` |
| Crownbreaker | (the greatsword) | `kn_cracks` and `kn_parry` where it lands | bell call, then `kn.crown` |
| Guard Captain | | `kn_pennant` over each guard you lead | |
| Oathsworn Champion | | `kn_glow` on the blade; Rallying Cry sends reached guards lunging at the nearest enemy | |
| Armor Mastery | | `kn_glow` off the armour when it gives health back | `kn.mastery` |

## Lunge, changed

Before: sprint and hit, then you were pushed forward past what you hit. Now: sprint and jump at an enemy within 5
blocks in front of you. You dash (a push scaled to the distance), and when you arrive within 2.6 blocks the thrust deals
your weapon's damage (`weaponDamage` in knight.js) plus 2 / 3 / 4. If the dash falls short, no cooldown is spent.
