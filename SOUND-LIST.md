# Sound list

Every sound The Hollow Crown plays, and what each one is made of. **This file is generated**: change
`studio/sounds/signature.json` (recordings and prompts) or `Siege_Nights_BP/scripts/core/sfx_cues.js`
(everything else), then run `node tools/sound-list.mjs`.

Tone for all of it: uneasy, especially at night. Not horror, no jump scares, nothing sudden or loud for its own sake.
There is no music in version 1.

- **40 signature sounds** are meant to be real recordings made with an AI sound generator. 40 of 40 are installed; the rest play a stand-in built from vanilla sounds, so the game is never silent.
- **32 more dragon sounds** have synthesized stand-ins and can be replaced the same way.
- **33 vanilla sounds** are reworked (lower, softer, layered) everywhere the scripts use them, and **39 named cues** are built from vanilla layers.
- The remaining vanilla sounds are played as they are, because they should sound like what they are (a horse, a bow, a page).

## How to add a recording

1. Open a text-to-sound-effect generator (ElevenLabs Sound Effects and Stable Audio both work). Paste the prompt, set the length, and make three or four takes. Pick the one that fits the tone above.
2. Save it under the **file name** in the table (for example `toll_317.mp3`) and put it in the `sounds-inbox/` folder. Any of wav, mp3, ogg, flac or m4a is fine.
3. Run `python3 tools/install_sounds.py`. It trims and levels the file, converts it, puts it in the resource pack, wires it into `sound_definitions.json` and switches the game over from the stand-in. Then `python3 tools/build.py` makes a new `hollow-crown.mcaddon`.

No computer set up for this? Upload the files in the project chat and ask Claude to install them.

- `python3 tools/install_sounds.py --status` shows what is installed. `--remove toll_317` goes back to the stand-in.
- In game, `/scriptevent siege:sound` opens the **sound board**: every sound in this file, one click each. `/scriptevent siege:sound signature` plays the signature sounds in turn.
- Lengths are targets. A take up to twice as long is kept whole; anything longer is faded out there.
- Mono sounds come from a place in the world (a roar, the Rift). Stereo sounds are played to the listener directly. The installer converts to whichever the table says.

## Signature sounds

| # | Sound | File name | Length | Shape | Now |
|---|---|---|---|---|---|
| 1 | The 3:17 toll | `toll_317` | 14 s | one-shot, stereo | recording (14 s) |
| 2 | The siege horn | `siege_horn` | 9 s | one-shot, stereo | recording (9 s) |
| 3 | The choir hum (the singing) | `choir_hum` | 15 s | loop, mono | recording (7 s) |
| 4 | The Rift opening | `rift_open` | 14 s | one-shot, mono | recording (14 s) |
| 5 | The Rift answers | `rift_answer` | 5 s | one-shot, mono | recording (5 s) |
| 6 | The rock stirs | `rift_stir` | 3 s | one-shot, mono | recording (2.76 s, 1 of 3 variants) |
| 7 | The hush | `rift_hush` | 2 s | one-shot, mono | recording (2 s) |
| 8 | The Rift breathes | `rift_breath` | 4 s | one-shot, mono | recording (3.97 s) |
| 9 | The open Rift | `rift_loop` | 15 s | loop, mono | recording (7 s) |
| 10 | The veil refuses | `rift_refuse` | 2 s | one-shot, mono | recording (2 s) |
| 11 | Crossing the Rift | `rift_cross` | 3 s | one-shot, stereo | recording (3 s) |
| 12 | The seep creeps | `seep_creep` | 2 s | one-shot, mono | recording (1.8 s, 1 of 3 variants) |
| 13 | Thin place draught | `thin_draught` | 4 s | one-shot, mono | recording (3.99 s) |
| 14 | The Hollow's ambience | `hollow_ambience` | 30 s | loop, stereo | recording (30 s) |
| 15 | A storm tide of the endless siege | `storm_tide` | 15 s | one-shot, stereo | recording (14.72 s) |
| 16 | Morvane | `boss_morvane` | 12 s | one-shot, stereo | recording (12 s) |
| 17 | The Choir | `boss_choir` | 12 s | one-shot, stereo | recording (12 s) |
| 18 | The Clockwork Reeve | `boss_reeve` | 8 s | one-shot, stereo | recording (8 s) |
| 19 | The Pale Huntsman | `boss_huntsman` | 10 s | one-shot, stereo | recording (9.78 s) |
| 20 | The Drowned Bride | `boss_bride` | 10 s | one-shot, stereo | recording (10 s) |
| 21 | The Ash Seneschal | `boss_seneschal` | 9 s | one-shot, stereo | recording (9 s) |
| 22 | The Mother of Changelings | `boss_mother` | 10 s | one-shot, stereo | recording (9.63 s) |
| 23 | The Warlord King | `boss_warlord_king` | 10 s | one-shot, stereo | recording (10 s) |
| 24 | The first glimpse | `first_glimpse` | 12 s | one-shot, stereo | recording (12 s) |
| 25 | The Forgemaster's bell-tongue | `bell_tongue` | 6 s | one-shot, stereo | recording (6 s) |
| 26 | The roll of the fallen | `roll_drum` | 4 s | one-shot, mono | recording (4 s) |
| 27 | The forty rowing | `forty_row` | 10 s | one-shot, stereo | recording (9.98 s) |
| 28 | The fen collects | `fen_debt` | 7 s | one-shot, stereo | recording (6.97 s) |
| 29 | The castle gate opens | `gate_open` | 3 s | one-shot, mono | recording (3 s) |
| 30 | The castle gate shuts | `gate_close` | 3 s | one-shot, mono | recording (3 s) |
| 31 | The portcullis rises | `portcullis_open` | 4 s | one-shot, mono | recording (4 s) |
| 32 | The portcullis drops | `portcullis_close` | 3 s | one-shot, mono | recording (2 s) |
| 33 | The arena crowd talking among itself (loop) | `crowd_murmur` | 8 s | loop, stereo | recording (8 s) |
| 34 | The arena crowd cheers | `crowd_cheer` | 4 s | one-shot, stereo | recording (4 s) |
| 35 | The arena crowd groans as a fighter falls | `crowd_groan` | 3 s | one-shot, stereo | recording (3 s) |
| 36 | Horns as the arena gates lift, or for the winner | `arena_fanfare` | 4 s | one-shot, stereo | recording (4 s) |
| 37 | Cinderwing: roar | `cinderwing_roar` | 4 s | one-shot, mono | recording (2.4 s) |
| 38 | Ashen Wyvern: roar | `wyvern_roar` | 4 s | one-shot, mono | recording (2.3 s) |
| 39 | Dune Drake: roar | `drake_roar` | 4 s | one-shot, mono | recording (2.4 s) |
| 40 | Glass Wyrm: roar | `wyrm_roar` | 4 s | one-shot, mono | recording (3.48 s) |

### 1. The 3:17 toll

- **File name:** `toll_317` (installs as `sounds/siege/sig/toll_317.ogg`, sound id `siege.sig.toll_317`)
- **Length:** about 14 seconds, one-shot, stereo
- **When:** On a siege night, when the clock reaches 3:17 and the last wave comes. Everyone hears it.
- **Stand-in until then:** `block.bell.hit` pitch 0.5 + `block.bell.hit` pitch 0.375 vol 0.6 after 0.1 s + `ambient.cave` pitch 0.6 vol 0.35 after 0.4 s + `block.bell.hit` pitch 0.5 vol 0.4 after 2.2 s + `block.bell.hit` pitch 0.5 vol 0.15 after 4.4 s
- **Test:** `/scriptevent siege:sound sig.toll_317`

Prompt:

> A single huge bronze church bell tolling once, very low and slow, heard from far across a valley at night. The strike is soft and dull rather than sharp, followed by a long dark resonant decay with a slightly sour, detuned shimmer that wavers as it fades. Faint cold wind underneath. No melody, no other instruments, no voices. Ends in silence.

### 2. The siege horn

- **File name:** `siege_horn` (installs as `sounds/siege/sig/siege_horn.ogg`, sound id `siege.sig.siege_horn`)
- **Length:** about 9 seconds, one-shot, stereo
- **When:** When a siege night begins. Everyone hears it.
- **Stand-in until then:** `raid.horn` pitch 0.7 + `raid.horn` pitch 0.52 vol 0.6 after 0.35 s + `ambient.weather.thunder` pitch 0.5 vol 0.25 after 0.6 s
- **Test:** `/scriptevent siege:sound sig.siege_horn`

Prompt:

> A deep war horn made of animal horn, blown once from a distant hillside at dusk: one long low note that swells, bends slightly downward at the end and dies away, with a natural outdoor echo off stone walls. A second, fainter horn answers from farther away. Breathy, rough, human-blown, medieval. No drums, no music, no voices.

### 3. The choir hum (the singing)

- **File name:** `choir_hum` (installs as `sounds/siege/choir/hum.ogg`, sound id `siege.choir.hum`)
- **Length:** ask for 15 seconds or more; the game uses exactly 7, loop, mono. The installer fades 1.5 s at each end and the game overlaps the fades, so it never has a gap
- **When:** Faint on siege nights, louder near thin places and the Gate, always in the Hollow, beside a hidden Returned, full in a Slip. The game replays it every 5 seconds so the fades overlap into one endless note.
- **Note:** Ask for 15 seconds or more; the installer cuts the steadiest 7 seconds from the middle and fades both ends. A placeholder made in code is installed today.
- **Test:** `/scriptevent siege:sound siege.choir.hum`

Prompt:

> A small choir of men and women holding one single low note (around D3) on a closed 'oo' vowel. No words, no melody, no vibrato, completely steady, as if heard through a thick stone wall. Slightly flat and breathy, calm rather than threatening. Dry, no reverb tail, the same volume from start to end.

### 4. The Rift opening

- **File name:** `rift_open` (installs as `sounds/siege/sig/rift_open.ogg`, sound id `siege.sig.rift_open`)
- **Length:** about 14 seconds, one-shot, mono
- **When:** The tear of the 40-second Rift opening (undertow/rift.js, at 20 s): rock splitting floor to ceiling, then widening. Played from the crack.
- **Stand-in until then:** nothing extra (the game's existing sounds for this moment carry on)
- **Test:** `/scriptevent siege:sound sig.rift_open`

Prompt:

> A huge slab of solid rock slowly breaking apart in a cave: long deep creaking and groaning of stone under enormous strain, sharp loud cracks splitting upward one after another, gravel and rock chunks falling and clattering on the floor, grinding as the halves scrape apart, then a final heavy low crack-boom as it splits open. Loud, close, dry and physical. No wind or air rush, no voices, no music.

### 5. The Rift answers

- **File name:** `rift_answer` (installs as `sounds/siege/sig/rift_answer.ogg`, sound id `siege.sig.rift_answer`)
- **Length:** about 5 seconds, one-shot, mono
- **When:** Rift opening, 2 s: after the Tuning Fork is struck, the note comes back from inside the rock.
- **Stand-in until then:** `resonate.amethyst_block` pitch 2 vol 0.35
- **Test:** `/scriptevent siege:sound sig.rift_answer`

Prompt:

> One clear struck metal tuning note answered from deep inside solid rock: the same note comes back a moment late, lower in pitch and muffled, like a bronze bell rung behind a thick stone wall, ringing softly and fading slowly. Quiet, eerie, calm. No voices, no music, ends in silence.

### 6. The rock stirs

- **File name:** `rift_stir` (installs as `sounds/siege/sig/rift_stir.ogg`, sound id `siege.sig.rift_stir`)
- **Length:** about 3 seconds, one-shot, mono
- **When:** Rift opening, 7 to 18 s: played every 2 seconds, getting louder. Three variants.
- **Variants:** 3, named `rift_stir_1` to `rift_stir_3`. The game picks one at random each time
- **Stand-in until then:** `chime.amethyst_block` pitch 1.2 vol 0.55 + `block.bell.hit` pitch 0.6 vol 0.3 after 0.2 s
- **Test:** `/scriptevent siege:sound sig.rift_stir`

Prompt:

> Cave stone groaning and ticking under heavy strain, small cracks popping, fine grit and pebbles falling onto rock, and one faint glassy ring as if crystal inside the stone were humming. Close, dry, uneasy. No voices, no music.

### 7. The hush

- **File name:** `rift_hush` (installs as `sounds/siege/sig/rift_hush.ogg`, sound id `siege.sig.rift_hush`)
- **Length:** about 2 seconds, one-shot, mono
- **When:** Rift opening, 18 s: just before the tear, all sound is sucked away.
- **Stand-in until then:** `resonate.amethyst_block` pitch 0.5 vol 0.3
- **Test:** `/scriptevent siege:sound sig.rift_hush`

Prompt:

> All the sound in a cave suddenly drawn away into silence: a soft low pressure drop like ears popping on a mountain, a muffled inward hush, then complete silence. Subtle, not loud. No voices, no music.

### 8. The Rift breathes

- **File name:** `rift_breath` (installs as `sounds/siege/sig/rift_breath.ogg`, sound id `siege.sig.rift_breath`)
- **Length:** about 4 seconds, one-shot, mono
- **When:** Rift opening, 30 s: the new crack draws its first breath.
- **Stand-in until then:** `ambient.cave` pitch 2 vol 0.6
- **Test:** `/scriptevent siege:sound sig.rift_breath`

Prompt:

> One long, slow draw of cold air inward through a narrow crack in rock, like a huge calm breath being taken in, with one faint low bell tone hidden inside the rush of air. Soft, cold, uneasy. No voices, no music, ends in silence.

### 9. The open Rift

- **File name:** `rift_loop` (installs as `sounds/siege/sig/rift_loop.ogg`, sound id `siege.sig.rift_loop`)
- **Length:** ask for 15 seconds or more; the game uses exactly 7, loop, mono. The installer fades 1.5 s at each end and the game overlaps the fades, so it never has a gap
- **When:** The open Rift at rest, looped for as long as it stays open. Replayed so the fades overlap, like the choir hum.
- **Stand-in until then:** nothing extra (the game's existing sounds for this moment carry on)
- **Note:** Ask for 15 seconds or more; the installer cuts the steadiest 7 seconds from the middle and fades both ends.
- **Test:** `/scriptevent siege:sound sig.rift_loop`

Prompt:

> A low, steady breathing draught of cold air moving through a deep crack in a cave wall, slow and even, with a very faint detuned hum underneath that never changes. Calm, constant, the same volume throughout. No voices, no music, no sudden sounds.

### 10. The veil refuses

- **File name:** `rift_refuse` (installs as `sounds/siege/sig/rift_refuse.ogg`, sound id `siege.sig.rift_refuse`)
- **Length:** about 2 seconds, one-shot, mono
- **When:** When the veil pushes back a player who has not beaten all five bosses. Played to that player.
- **Stand-in until then:** `resonate.amethyst_block` pitch 1.2 vol 0.4
- **Test:** `/scriptevent siege:sound sig.rift_refuse`

Prompt:

> A dull, soft thud of displaced air, like a heavy curtain of pressure pushing someone back, followed by a short low hum that falls in pitch and fades. Soft, not violent. No voices, no music.

### 11. Crossing the Rift

- **File name:** `rift_cross` (installs as `sounds/siege/sig/rift_cross.ogg`, sound id `siege.sig.rift_cross`)
- **Length:** about 3 seconds, one-shot, stereo
- **When:** Stepping through the open Rift into the Hollow. Played to the player.
- **Stand-in until then:** `ambient.cave` vol 0.5
- **Test:** `/scriptevent siege:sound sig.rift_cross`

Prompt:

> The sound of a cave smearing and slowing down as it drops in pitch, like hearing the world through water, then a held breath and complete silence. Smooth and dreamlike, uneasy, not scary. No voices, no music.

### 12. The seep creeps

- **File name:** `seep_creep` (installs as `sounds/siege/sig/seep_creep.ogg`, sound id `siege.sig.seep_creep`)
- **Length:** about 2 seconds, one-shot, mono
- **When:** Where a seep vein grows across the ground while the Rift is open. Quiet. Three variants.
- **Variants:** 3, named `seep_creep_1` to `seep_creep_3`. The game picks one at random each time
- **Stand-in until then:** nothing extra (the game's existing sounds for this moment carry on)
- **Test:** `/scriptevent siege:sound sig.seep_creep`

Prompt:

> Ground slowly turning to something else: a quiet wet crackle of stone and soil, like frost spreading through damp rock, with one faint glassy tick. Very quiet and close. No voices, no music.

### 13. Thin place draught

- **File name:** `thin_draught` (installs as `sounds/siege/sig/thin_draught.ogg`, sound id `siege.sig.thin_draught`)
- **Length:** about 4 seconds, one-shot, mono
- **When:** A tell at any thin place before the Rift opens there.
- **Stand-in until then:** nothing extra (the game's existing sounds for this moment carry on)
- **Test:** `/scriptevent siege:sound sig.thin_draught`

Prompt:

> A slight cold draught whistling very softly through a hairline crack in rock, with a barely audible low hum underneath. Very quiet, subtle, eerie but calm. No voices, no music.

### 14. The Hollow's ambience

- **File name:** `hollow_ambience` (installs as `sounds/siege/sig/hollow_ambience.ogg`, sound id `siege.sig.hollow_ambience`)
- **Length:** about 30 seconds, loop, stereo. The installer fades 3 s at each end and the game overlaps the fades, so it never has a gap
- **When:** All the time while you are in the Hollow, quietly, under the Hollow's own thunder and the singing.
- **Stand-in until then:** nothing extra (the game's existing sounds for this moment carry on)
- **Test:** `/scriptevent siege:sound sig.hollow_ambience`

Prompt:

> Seamless looping ambience of a vast underground world with no sky: a very low, steady, airy drone like wind moving through an enormous cavern, slow distant water, an occasional faint glassy chime far away, and a barely audible wordless choir note that comes and goes. Calm, wide, lonely and slightly wrong, never frightening. No thunder, no footsteps, no creatures, no melody. Constant level, no sudden sounds.

### 15. A storm tide of the endless siege

- **File name:** `storm_tide` (installs as `sounds/siege/sig/storm_tide.ogg`, sound id `siege.sig.storm_tide`)
- **Length:** about 15 seconds, one-shot, stereo
- **When:** In the Long Night, each time a fresh tide of soldiers comes by daylight ("Daylight. They come anyway.").
- **Stand-in until then:** `ambient.weather.thunder` pitch 0.55 vol 0.7 + `raid.horn` pitch 0.5 vol 0.35 after 0.7 s + `ambient.cave` pitch 0.7 vol 0.4 after 1.5 s
- **Test:** `/scriptevent siege:sound sig.storm_tide`

Prompt:

> A storm front arriving in daylight: a long roll of distant thunder that grows, a surge of wind, and underneath it the muffled sound of a great many feet marching closer and one far-off low war horn. Builds for ten seconds, then settles into steady wind. Ominous and tired rather than violent. No rain, no voices, no music.

### 16. Morvane

- **File name:** `boss_morvane` (installs as `sounds/siege/sig/boss_morvane.ogg`, sound id `siege.sig.boss.morvane`)
- **Length:** about 12 seconds, one-shot, stereo
- **When:** When Morvane rises from the Seat and the last fight begins.
- **Stand-in until then:** `block.bell.hit` pitch 0.4 vol 0.9 + `mob.wither.spawn` pitch 0.55 vol 0.5 after 0.3 s + `block.bell.hit` pitch 0.3 vol 0.5 after 1.5 s
- **Test:** `/scriptevent siege:sound sig.boss.morvane`

Prompt:

> An old king rising slowly from a stone throne in an enormous silent hall: the scrape of heavy cloth on stone, one long weary exhale from a deep male voice, then a single very low bell tone that seems to come from inside the room and hangs in the air, with a faint high crystalline ringing above it. Sad, patient and immense, not monstrous. No words, no growl, no music.

### 17. The Choir

- **File name:** `boss_choir` (installs as `sounds/siege/sig/boss_choir.ogg`, sound id `siege.sig.boss.choir`)
- **Length:** about 12 seconds, one-shot, stereo
- **When:** When the Choir turns toward you and seven voices begin to sing.
- **Stand-in until then:** `siege.choir.hum` + `siege.choir.hum` pitch 1.5 vol 0.5 after 0.5 s + `block.bell.hit` pitch 0.5 vol 0.4 after 1 s
- **Test:** `/scriptevent siege:sound sig.boss.choir`

Prompt:

> Seven singers, men and women, entering one after another on the same low sustained note with no words, each voice very slightly out of tune with the last so the sound beats and shimmers. Cold stone-hall reverb. It swells to a full unison and then stops dead, all at once, mid-breath. Beautiful and unsettling. No melody, no instruments.

### 18. The Clockwork Reeve

- **File name:** `boss_reeve` (installs as `sounds/siege/sig/boss_reeve.ogg`, sound id `siege.sig.boss.reeve`)
- **Length:** about 8 seconds, one-shot, stereo
- **When:** When the Clockwork Reeve winds himself and his fight begins.
- **Stand-in until then:** `random.click` pitch 0.6 + `random.click` pitch 0.6 after 0.5 s + `random.click` pitch 0.6 after 1 s + `block.bell.hit` pitch 0.8 vol 0.7 after 1.5 s + `random.anvil_land` pitch 0.5 vol 0.3 after 1.5 s
- **Test:** `/scriptevent siege:sound sig.boss.reeve`

Prompt:

> A large brass clockwork mechanism being wound: slow heavy ratchet clicks, a spring tightening, gears engaging, then a tower-clock tick that stumbles and repeats the same tick three times as if stuck, and one dull clock chime cut short. Dry, metallic, precise. No music, no voices.

### 19. The Pale Huntsman

- **File name:** `boss_huntsman` (installs as `sounds/siege/sig/boss_huntsman.ogg`, sound id `siege.sig.boss.huntsman`)
- **Length:** about 10 seconds, one-shot, stereo
- **When:** When the Pale Huntsman's fight begins (he is already watching you).
- **Stand-in until then:** `raid.horn` pitch 1.25 vol 0.5 + `mob.wolf.growl` pitch 0.6 vol 0.8 after 0.8 s + `raid.horn` pitch 0.9 vol 0.3 after 1.7 s
- **Test:** `/scriptevent siege:sound sig.boss.huntsman`

Prompt:

> A thin, pale hunting horn sounding once far away across a frozen forest, muffled by falling snow. Then silence, the creak of a bowstring being drawn very close by, and a single low wolf growl. Cold, still, patient. Light wind. No music, no voices, no howling pack.

### 20. The Drowned Bride

- **File name:** `boss_bride` (installs as `sounds/siege/sig/boss_bride.ogg`, sound id `siege.sig.boss.bride`)
- **Length:** about 10 seconds, one-shot, stereo
- **When:** When the Drowned Bride rises with the tide.
- **Stand-in until then:** `random.splash` pitch 0.5 + `block.bell.hit` pitch 0.7 vol 0.5 after 0.4 s + `block.bell.hit` pitch 0.66 vol 0.4 after 1.2 s + `mob.guardian.ambient` pitch 0.5 vol 0.5 after 0.7 s
- **Test:** `/scriptevent siege:sound sig.boss.bride`

Prompt:

> Something rising slowly out of deep still water: a long swell and pouring of water, the drip of heavy soaked fabric, a woman's soft wordless sigh, and two small chapel bells ringing underwater, muffled and bent out of tune. Mournful and slow, sad rather than scary. No scream, no music.

### 21. The Ash Seneschal

- **File name:** `boss_seneschal` (installs as `sounds/siege/sig/boss_seneschal.ogg`, sound id `siege.sig.boss.seneschal`)
- **Length:** about 9 seconds, one-shot, stereo
- **When:** When the Ash Seneschal turns his blank face toward you.
- **Stand-in until then:** `item.shield.block` pitch 0.5 + `random.anvil_land` pitch 0.45 vol 0.5 after 0.2 s + `dig.sand` pitch 0.5 after 0.6 s + `mob.wither.ambient` pitch 0.5 vol 0.3 after 0.8 s
- **Test:** `/scriptevent siege:sound sig.boss.seneschal`

Prompt:

> A heavy armoured knight turning to face you in a dry desert ruin: sand and ash hissing off metal plates, the slow grind of old armour joints, a huge iron shield set down on stone with one deep ringing thud, then a long hollow breath through an empty helmet. Dry, hot, weighty. No voice, no music.

### 22. The Mother of Changelings

- **File name:** `boss_mother` (installs as `sounds/siege/sig/boss_mother.ogg`, sound id `siege.sig.boss.mother`)
- **Length:** about 10 seconds, one-shot, stereo
- **When:** When the Mother of Changelings smiles with someone else's face.
- **Stand-in until then:** `note.flute` pitch 0.6 vol 0.8 + `note.flute` pitch 0.71 vol 0.7 after 0.4 s + `note.flute` pitch 0.56 vol 0.7 after 0.9 s + `mob.witch.celebrate` pitch 0.5 vol 0.35 after 1.3 s
- **Test:** `/scriptevent siege:sound sig.boss.mother`

Prompt:

> A woman humming three slow notes of a lullaby, gentle and warm, in a quiet wet marsh at night. On the last note a second, identical voice joins a fraction too late and slightly off pitch. Soft frogs and dripping water far in the background, roots creaking. Tender and wrong. No words, no laughter, no music.

### 23. The Warlord King

- **File name:** `boss_warlord_king` (installs as `sounds/siege/sig/boss_warlord_king.ogg`, sound id `siege.sig.boss.warlord_king`)
- **Length:** about 10 seconds, one-shot, stereo
- **When:** When the Warlord King rides onto the field in the Grand Siege.
- **Stand-in until then:** `raid.horn` pitch 0.6 + `mob.ravager.roar` pitch 0.6 vol 0.6 after 0.5 s + `block.bell.hit` pitch 0.45 vol 0.6 after 1.1 s + `raid.horn` pitch 0.45 vol 0.5 after 1.3 s
- **Test:** `/scriptevent siege:sound sig.boss.warlord_king`

Prompt:

> A warlord arriving on a battlefield at night riding a huge beast: three very heavy, slow footfalls that shake the ground, the rattle of chains and armour, a deep animal snort, then a brutal brass war horn blast answered by a distant crowd of soldiers beating weapons on shields twice. Massive, confident, martial. No music, no words.

### 24. The first glimpse

- **File name:** `first_glimpse` (installs as `sounds/siege/sig/first_glimpse.ogg`, sound id `siege.sig.first_glimpse`)
- **Length:** about 12 seconds, one-shot, stereo
- **When:** Once per world, at 3:17 on the night something walks up between the soldiers that is not one of them.
- **Stand-in until then:** `ambient.cave` pitch 0.6 + `mob.warden.heartbeat` pitch 0.6 vol 0.7 after 1 s + `mob.warden.heartbeat` pitch 0.6 vol 0.7 after 2.5 s + `block.bell.hit` pitch 0.3 vol 0.3 after 3 s
- **Test:** `/scriptevent siege:sound sig.first_glimpse`

Prompt:

> Close, clear footsteps: one person walking slowly and evenly over wet gravel and mud toward the listener, every step distinct and easy to hear, boots squelching, getting closer and louder over ten seconds. Under them a low steady choir note and one slow deep heartbeat thud every two seconds. A faint night wind at the very start that dies away. The steps stop right next to you. Tense and patient, not loud. No sting, no scream, no music.

### 25. The Forgemaster's bell-tongue

- **File name:** `bell_tongue` (installs as `sounds/siege/sig/bell_tongue.ogg`, sound id `siege.sig.bell_tongue`)
- **Length:** about 6 seconds, one-shot, stereo
- **When:** Morvane fight, stage 2: a Forgemaster's new bell rings once and the Standing Ranks break step.
- **Stand-in until then:** `block.bell.hit` pitch 1.2 + `block.bell.hit` pitch 0.9 vol 0.5 after 0.15 s + `armor.equip_iron` pitch 0.6 vol 0.6 after 0.5 s + `armor.equip_iron` pitch 0.5 vol 0.5 after 0.7 s
- **Test:** `/scriptevent siege:sound sig.bell_tongue`

Prompt:

> One clear, bright bronze hand-bell struck hard, close and present, with a pure ringing tone and a long shimmering tail that fills a stone hall. Under it, the clatter of many pieces of empty armour shifting at once, then stillness. No music, no voices. Ends in silence.

### 26. The roll of the fallen

- **File name:** `roll_drum` (installs as `sounds/siege/sig/roll_drum.ogg`, sound id `siege.sig.roll_drum`)
- **Length:** about 4 seconds, one-shot, mono
- **When:** At the Cinder Roost, when Kesh reads a name from the roll of the fallen, or a rider's dragon dies.
- **Stand-in until then:** `note.bd` pitch 0.5 + `note.bd` pitch 0.45 vol 0.4 after 0.3 s
- **Test:** `/scriptevent siege:sound sig.roll_drum`

Prompt:

> A single low, muffled skin drum struck once in a high open cliffside space with dry desert wind, a soft boom that rolls away into the distance. Solemn, not dramatic. No melody, no voices. Ends in silence.

### 27. The forty rowing

- **File name:** `forty_row` (installs as `sounds/siege/sig/forty_row.ogg`, sound id `siege.sig.forty_row`)
- **Length:** about 10 seconds, one-shot, stereo
- **When:** Morvane fight, stage 4: the drowned crews of Holt's Debt row the party down the light river.
- **Stand-in until then:** `bucket.empty_water` pitch 0.6 vol 0.5 + `bucket.empty_water` pitch 0.6 vol 0.5 after 1.5 s + `ambient.cave` pitch 0.6 vol 0.3 after 0.5 s
- **Test:** `/scriptevent siege:sound sig.forty_row`

Prompt:

> Many oars dipping together in slow unison on dark still water inside a vast cavern, wooden oarlocks creaking in time, water dripping, and a low wordless hum from many tired voices keeping the stroke. Distant, hollow echo. Uneasy but steady. No music. Ends in silence.

### 28. The fen collects

- **File name:** `fen_debt` (installs as `sounds/siege/sig/fen_debt.ogg`, sound id `siege.sig.fen_debt`)
- **Length:** about 7 seconds, one-shot, stereo
- **When:** When a Fen Mother's hexes all land at once, and at Morvane stage 6 when the fen lends the party a moment.
- **Stand-in until then:** `bubble.pop` pitch 0.6 vol 0.8 + `mob.witch.ambient` pitch 0.6 vol 0.4 after 0.4 s + `bubble.pop` pitch 0.5 vol 0.6 after 0.8 s
- **Test:** `/scriptevent siege:sound sig.fen_debt`

Prompt:

> A deep wet marsh sound: bubbles rising and bursting from thick mud, reeds rustling all at once as if a wind passed, and a slow low creak like an old wooden raft taking weight. A faint breathy whisper at the very end, no words. Uneasy, not frightening. Ends in silence.

### 29. The castle gate opens

- **File name:** `gate_open` (installs as `sounds/siege/sig/gate_open.ogg`, sound id `siege.sig.gate_open`)
- **Length:** about 3 seconds, one-shot, mono
- **When:** When a settlement's great timber gate swings open. Heard by everyone near the gate.
- **Stand-in until then:** `random.door_open` pitch 0.5 + `hit.wood` pitch 0.5 vol 0.6 after 0.1 s + `random.wood_click` pitch 0.5 vol 0.5 after 0.6 s
- **Test:** `/scriptevent siege:sound sig.gate_open`

Prompt:

> A massive medieval oak castle gate, iron-banded, swinging open on huge iron hinges: a deep slow groaning creak of old timber and rusted iron pivots, a heavy wooden thud as the bar lifts at the start, and the low scrape of the gate's foot over stone. Close-miked, outdoor stone courtyard, slight echo. No music, no voices.

### 30. The castle gate shuts

- **File name:** `gate_close` (installs as `sounds/siege/sig/gate_close.ogg`, sound id `siege.sig.gate_close`)
- **Length:** about 3 seconds, one-shot, mono
- **When:** When the great timber gate swings shut. Heard by everyone near the gate.
- **Stand-in until then:** `random.door_close` pitch 0.5 + `hit.wood` pitch 0.45 vol 0.7 after 0.1 s + `random.anvil_land` pitch 0.6 vol 0.25 after 0.1 s
- **Test:** `/scriptevent siege:sound sig.gate_close`

Prompt:

> A massive iron-banded oak castle gate swinging shut: a short groaning hinge creak, then a deep heavy boom as it meets the stone frame, a rattle of iron fittings, and a heavy wooden bar dropping into its brackets with a solid thunk. Outdoor stone courtyard, short echo. No music, no voices.

### 31. The portcullis rises

- **File name:** `portcullis_open` (installs as `sounds/siege/sig/portcullis_open.ogg`, sound id `siege.sig.portcullis_open`)
- **Length:** about 4 seconds, one-shot, mono
- **When:** When a portcullis is winched up. Heard by everyone near the gate.
- **Stand-in until then:** `hit.chain` pitch 0.6 vol 0.8 + `step.chain` pitch 0.5 vol 0.8 after 0.2 s + `hit.chain` pitch 0.55 vol 0.8 after 0.4 s + `step.chain` pitch 0.5 vol 0.8 after 0.6 s + `random.click` pitch 0.5 vol 0.6 after 1 s
- **Test:** `/scriptevent siege:sound sig.portcullis_open`

Prompt:

> A heavy iron portcullis being winched up into a stone gatehouse: a wooden ratchet winch clacking steadily, thick iron chain rattling and grinding over a wheel, the iron grille scraping up stone grooves, ending with the click of the pawl catching. Medieval, heavy, mechanical, stone-room echo. No music, no voices.

### 32. The portcullis drops

- **File name:** `portcullis_close` (installs as `sounds/siege/sig/portcullis_close.ogg`, sound id `siege.sig.portcullis_close`)
- **Length:** about 3 seconds, one-shot, mono
- **When:** When a portcullis comes down. Heard by everyone near the gate.
- **Stand-in until then:** `hit.chain` pitch 0.8 vol 0.8 + `step.chain` pitch 0.7 vol 0.8 after 0.1 s + `random.anvil_land` pitch 0.5 vol 0.6 after 0.4 s + `dig.stone` pitch 0.5 vol 0.8 after 0.4 s
- **Test:** `/scriptevent siege:sound sig.portcullis_close`

Prompt:

> A heavy iron portcullis slamming down: one quick, hard, metallic crash like an iron anvil dropped onto stone, a short sharp clang with a brief ringing rattle of iron bars, then silence. Fast and punchy, close and dry, no chain run-out, no echo, no music.

### 33. The arena crowd talking among itself (loop)

- **File name:** `crowd_murmur` (installs as `sounds/siege/sig/crowd_murmur.ogg`, sound id `siege.sig.crowd_murmur`)
- **Length:** about 8 seconds, loop, stereo. The installer fades undefined s at each end and the game overlaps the fades, so it never has a gap
- **When:** Loops from the middle of the arena while a fight is on. Heard across the arena.
- **Stand-in until then:** `mob.villager.idle` pitch 0.7 vol 0.25 + `mob.villager.haggle` pitch 0.6 vol 0.2 after 1.5 s + `mob.villager.idle` pitch 0.8 vol 0.2 after 3.5 s + `mob.villager.yes` pitch 0.65 vol 0.2 after 5.5 s
- **Test:** `/scriptevent siege:sound sig.crowd_murmur`

Prompt:

> A large medieval crowd of a few hundred people seated in a huge open-air stone arena, waiting and watching: a steady warm murmur of many indistinct voices talking at once, scattered shouts and whistles, a few claps, feet shuffling on stone benches. Even and continuous from start to end so it can loop, no peaks, no single clear words, no music.

### 34. The arena crowd cheers

- **File name:** `crowd_cheer` (installs as `sounds/siege/sig/crowd_cheer.ogg`, sound id `siege.sig.crowd_cheer`)
- **Length:** about 4 seconds, one-shot, stereo
- **When:** When the gates lift, a big hit lands, a beast falls or someone wins. Heard across the arena.
- **Stand-in until then:** `mob.pillager.celebrate` pitch 0.8 vol 0.8 + `mob.villager.yes` pitch 0.7 vol 0.6 after 0.15 s + `mob.pillager.celebrate` pitch 0.65 vol 0.6 after 0.4 s + `mob.villager.yes` pitch 0.9 vol 0.5 after 0.6 s
- **Test:** `/scriptevent siege:sound sig.crowd_cheer`

Prompt:

> A big medieval crowd in a stone arena erupting into a cheer: a sudden roar of hundreds of voices, whistles, stamping feet and fists pounding on wooden barriers, swelling for two seconds and then settling back down. Excited and joyful, open-air with a little stone echo, no single clear words, no music.

### 35. The arena crowd groans as a fighter falls

- **File name:** `crowd_groan` (installs as `sounds/siege/sig/crowd_groan.ogg`, sound id `siege.sig.crowd_groan`)
- **Length:** about 3 seconds, one-shot, stereo
- **When:** When a fighter falls. Heard across the arena.
- **Stand-in until then:** `mob.villager.no` pitch 0.6 vol 0.8 + `mob.villager.no` pitch 0.5 vol 0.6 after 0.2 s + `mob.villager.idle` pitch 0.5 vol 0.4 after 0.5 s
- **Test:** `/scriptevent siege:sound sig.crowd_groan`

Prompt:

> A big medieval crowd in a stone arena reacting as a fighter goes down: a loud collective 'ohhh' of sympathy and shock from hundreds of voices, falling in pitch, followed by scattered murmurs. Open-air with a little stone echo, no single clear words, no music.

### 36. Horns as the arena gates lift, or for the winner

- **File name:** `arena_fanfare` (installs as `sounds/siege/sig/arena_fanfare.ogg`, sound id `siege.sig.arena_fanfare`)
- **Length:** about 4 seconds, one-shot, stereo
- **When:** When the arena gates lift, and for the winner. Heard across the arena.
- **Stand-in until then:** `raid.horn` pitch 1.2 vol 0.5 + `note.trumpet` vol 0.6 after 0.3 s + `note.trumpet` pitch 1.26 vol 0.6 after 0.6 s + `note.trumpet` pitch 1.5 vol 0.7 after 0.9 s
- **Test:** `/scriptevent siege:sound sig.arena_fanfare`

Prompt:

> A short medieval tournament fanfare: two long brass herald trumpets playing a bold rising three-note call together, the last note held, ringing out over a huge open-air stone arena with a natural echo. Proud and bright, no drums, no voices, no crowd.

### 37. Cinderwing: roar

- **File name:** `cinderwing_roar` (installs as `sounds/siege/dragon/cinderwing_roar.ogg`, sound id `siege.dragon.cinderwing.roar`)
- **Length:** ask for 4 seconds or more; the game uses exactly 2.4, one-shot, mono
- **When:** The Cinderwing's roar.
- **Test:** `/scriptevent siege:sound siege.dragon.cinderwing.roar`

Prompt:

> The voice of a large fire-breathing dragon with a deep chest and a throat like a furnace: warm, rumbling, with a crackle of embers in the breath. A full roar: starts fast, peaks, and trails off into breath. Powerful and proud, not a monster-movie scream. One animal, close and dry, no echo, no background, no music.

### 38. Ashen Wyvern: roar

- **File name:** `wyvern_roar` (installs as `sounds/siege/dragon/wyvern_roar.ogg`, sound id `siege.dragon.wyvern.roar`)
- **Length:** ask for 4 seconds or more; the game uses exactly 2.4, one-shot, mono
- **When:** The Ashen Wyvern's roar.
- **Test:** `/scriptevent siege:sound siege.dragon.wyvern.roar`

Prompt:

> The voice of a lean, light wyvern with a high, hoarse, hissing voice like wind through dry reeds, raspy and airy. A full roar: starts fast, peaks, and trails off into breath. Powerful and proud, not a monster-movie scream. One animal, close and dry, no echo, no background, no music.

### 39. Dune Drake: roar

- **File name:** `drake_roar` (installs as `sounds/siege/dragon/drake_roar.ogg`, sound id `siege.dragon.drake.roar`)
- **Length:** ask for 4 seconds or more; the game uses exactly 2.4, one-shot, mono
- **When:** The Dune Drake's roar.
- **Test:** `/scriptevent siege:sound siege.dragon.drake.roar`

Prompt:

> The voice of a heavy, broad desert drake with a very low, slow, gravelly voice like boulders shifting under sand. A full roar: starts fast, peaks, and trails off into breath. Powerful and proud, not a monster-movie scream. One animal, close and dry, no echo, no background, no music.

### 40. Glass Wyrm: roar

- **File name:** `wyrm_roar` (installs as `sounds/siege/dragon/wyrm_roar.ogg`, sound id `siege.dragon.wyrm.roar`)
- **Length:** ask for 4 seconds or more; the game uses exactly 2.4, one-shot, mono
- **When:** The Glass Wyrm's roar.
- **Test:** `/scriptevent siege:sound siege.dragon.wyrm.roar`

Prompt:

> A humpback whale's long moaning call and a bull elk's bugle heard together, two deep tones at once that rise and fall, warm and breathy, with a slow wet breath underneath. Real wildlife field recording made close up with a good microphone: natural, organic, unprocessed, one living animal with real air and wet throat noise. No synth, no growl effects, no echo, no background, no music.

## The rest of the dragons' voices

Each species has eight voices and all four share four more. The roars are signature sounds above; these are the others.
All are short, mono, and come from the dragon. The young are the same files played higher. Install them the same way.

| File name | Length | Now | Prompt |
|---|---|---|---|
| `cinderwing_idle` | 1.6 s | synthesized stand-in | The voice of a large fire-breathing dragon with a deep chest and a throat like a furnace: warm, rumbling, with a crackle of embers in the breath. A relaxed, low, closed-mouth grumble, the sound it makes when it is simply nearby and content. One animal, close and dry, no echo, no background, no music. |
| `cinderwing_hurt` | 0.6 s | synthesized stand-in | The voice of a large fire-breathing dragon with a deep chest and a throat like a furnace: warm, rumbling, with a crackle of embers in the breath. A short sharp yelp of pain, cut off quickly. One animal, close and dry, no echo, no background, no music. |
| `cinderwing_purr` | 2.2 s | synthesized stand-in | The voice of a large fire-breathing dragon with a deep chest and a throat like a furnace: warm, rumbling, with a crackle of embers in the breath. A slow, pulsing, contented purr, like a huge cat, soft and close. One animal, close and dry, no echo, no background, no music. |
| `cinderwing_snarl` | 1.1 s | synthesized stand-in | The voice of a large fire-breathing dragon with a deep chest and a throat like a furnace: warm, rumbling, with a crackle of embers in the breath. A warning snarl through bared teeth, tight and rough, rising slightly. One animal, close and dry, no echo, no background, no music. |
| `cinderwing_whimper` | 0.9 s | synthesized stand-in | The voice of a large fire-breathing dragon with a deep chest and a throat like a furnace: warm, rumbling, with a crackle of embers in the breath. A small, high, unhappy whimper, the sound of an animal that is hurt or afraid. One animal, close and dry, no echo, no background, no music. |
| `cinderwing_death` | 3 s | synthesized stand-in | The voice of a large fire-breathing dragon with a deep chest and a throat like a furnace: warm, rumbling, with a crackle of embers in the breath. A last long falling cry that weakens and ends in a slow breath out. Sad, not gory. One animal, close and dry, no echo, no background, no music. |
| `cinderwing_chirp` | 0.5 s | synthesized stand-in | The voice of a large fire-breathing dragon with a deep chest and a throat like a furnace: warm, rumbling, with a crackle of embers in the breath. A hatchling's chirp: tiny, bright, curious, like a bird crossed with a kitten. One animal, close and dry, no echo, no background, no music. |
| `wyvern_idle` | 1.6 s | synthesized stand-in | The voice of a lean, light wyvern with a high, hoarse, hissing voice like wind through dry reeds, raspy and airy. A relaxed, low, closed-mouth grumble, the sound it makes when it is simply nearby and content. One animal, close and dry, no echo, no background, no music. |
| `wyvern_hurt` | 0.6 s | synthesized stand-in | The voice of a lean, light wyvern with a high, hoarse, hissing voice like wind through dry reeds, raspy and airy. A short sharp yelp of pain, cut off quickly. One animal, close and dry, no echo, no background, no music. |
| `wyvern_purr` | 2.2 s | synthesized stand-in | The voice of a lean, light wyvern with a high, hoarse, hissing voice like wind through dry reeds, raspy and airy. A slow, pulsing, contented purr, like a huge cat, soft and close. One animal, close and dry, no echo, no background, no music. |
| `wyvern_snarl` | 1.1 s | synthesized stand-in | The voice of a lean, light wyvern with a high, hoarse, hissing voice like wind through dry reeds, raspy and airy. A warning snarl through bared teeth, tight and rough, rising slightly. One animal, close and dry, no echo, no background, no music. |
| `wyvern_whimper` | 0.9 s | synthesized stand-in | The voice of a lean, light wyvern with a high, hoarse, hissing voice like wind through dry reeds, raspy and airy. A small, high, unhappy whimper, the sound of an animal that is hurt or afraid. One animal, close and dry, no echo, no background, no music. |
| `wyvern_death` | 3 s | synthesized stand-in | The voice of a lean, light wyvern with a high, hoarse, hissing voice like wind through dry reeds, raspy and airy. A last long falling cry that weakens and ends in a slow breath out. Sad, not gory. One animal, close and dry, no echo, no background, no music. |
| `wyvern_chirp` | 0.5 s | synthesized stand-in | The voice of a lean, light wyvern with a high, hoarse, hissing voice like wind through dry reeds, raspy and airy. A hatchling's chirp: tiny, bright, curious, like a bird crossed with a kitten. One animal, close and dry, no echo, no background, no music. |
| `drake_idle` | 1.6 s | synthesized stand-in | The voice of a heavy, broad desert drake with a very low, slow, gravelly voice like boulders shifting under sand. A relaxed, low, closed-mouth grumble, the sound it makes when it is simply nearby and content. One animal, close and dry, no echo, no background, no music. |
| `drake_hurt` | 0.6 s | synthesized stand-in | The voice of a heavy, broad desert drake with a very low, slow, gravelly voice like boulders shifting under sand. A short sharp yelp of pain, cut off quickly. One animal, close and dry, no echo, no background, no music. |
| `drake_purr` | 2.2 s | synthesized stand-in | The voice of a heavy, broad desert drake with a very low, slow, gravelly voice like boulders shifting under sand. A slow, pulsing, contented purr, like a huge cat, soft and close. One animal, close and dry, no echo, no background, no music. |
| `drake_snarl` | 1.1 s | synthesized stand-in | The voice of a heavy, broad desert drake with a very low, slow, gravelly voice like boulders shifting under sand. A warning snarl through bared teeth, tight and rough, rising slightly. One animal, close and dry, no echo, no background, no music. |
| `drake_whimper` | 0.9 s | synthesized stand-in | The voice of a heavy, broad desert drake with a very low, slow, gravelly voice like boulders shifting under sand. A small, high, unhappy whimper, the sound of an animal that is hurt or afraid. One animal, close and dry, no echo, no background, no music. |
| `drake_death` | 3 s | synthesized stand-in | The voice of a heavy, broad desert drake with a very low, slow, gravelly voice like boulders shifting under sand. A last long falling cry that weakens and ends in a slow breath out. Sad, not gory. One animal, close and dry, no echo, no background, no music. |
| `drake_chirp` | 0.5 s | synthesized stand-in | The voice of a heavy, broad desert drake with a very low, slow, gravelly voice like boulders shifting under sand. A hatchling's chirp: tiny, bright, curious, like a bird crossed with a kitten. One animal, close and dry, no echo, no background, no music. |
| `wyrm_idle` | 1.6 s | synthesized stand-in | The voice of a long glass-scaled wyrm whose voice is two tones at once, a fifth apart, with a ringing glassy edge, so it never sounds like a single animal. A relaxed, low, closed-mouth grumble, the sound it makes when it is simply nearby and content. One animal, close and dry, no echo, no background, no music. |
| `wyrm_hurt` | 0.6 s | synthesized stand-in | The voice of a long glass-scaled wyrm whose voice is two tones at once, a fifth apart, with a ringing glassy edge, so it never sounds like a single animal. A short sharp yelp of pain, cut off quickly. One animal, close and dry, no echo, no background, no music. |
| `wyrm_purr` | 2.2 s | synthesized stand-in | The voice of a long glass-scaled wyrm whose voice is two tones at once, a fifth apart, with a ringing glassy edge, so it never sounds like a single animal. A slow, pulsing, contented purr, like a huge cat, soft and close. One animal, close and dry, no echo, no background, no music. |
| `wyrm_snarl` | 1.1 s | synthesized stand-in | The voice of a long glass-scaled wyrm whose voice is two tones at once, a fifth apart, with a ringing glassy edge, so it never sounds like a single animal. A warning snarl through bared teeth, tight and rough, rising slightly. One animal, close and dry, no echo, no background, no music. |
| `wyrm_whimper` | 0.9 s | synthesized stand-in | The voice of a long glass-scaled wyrm whose voice is two tones at once, a fifth apart, with a ringing glassy edge, so it never sounds like a single animal. A small, high, unhappy whimper, the sound of an animal that is hurt or afraid. One animal, close and dry, no echo, no background, no music. |
| `wyrm_death` | 3 s | synthesized stand-in | The voice of a long glass-scaled wyrm whose voice is two tones at once, a fifth apart, with a ringing glassy edge, so it never sounds like a single animal. A last long falling cry that weakens and ends in a slow breath out. Sad, not gory. One animal, close and dry, no echo, no background, no music. |
| `wyrm_chirp` | 0.5 s | synthesized stand-in | The voice of a long glass-scaled wyrm whose voice is two tones at once, a fifth apart, with a ringing glassy edge, so it never sounds like a single animal. A hatchling's chirp: tiny, bright, curious, like a bird crossed with a kitten. One animal, close and dry, no echo, no background, no music. |
| `flap` | 0.6 s | synthesized stand-in | One slow beat of very large leathery wings: a heavy whoosh of air and a soft snap of membrane. Close, dry, no background. |
| `fire` | 1.8 s | synthesized stand-in | A dragon breathing a stream of fire: a roaring, rushing jet of flame with a low rumble underneath, steady for the whole clip. No voice, no background. |
| `breathe` | 1.5 s | synthesized stand-in | A very large animal breathing in and out once while lying unconscious: slow, heavy, a little laboured. Close and quiet. No background. |
| `egg_crack` | 0.8 s | synthesized stand-in | A thick eggshell cracking: two or three sharp dry cracks and a small piece falling away. Close, no background. |

## Named cues

Built from vanilla layers in `core/sfx_cues.js`. A script plays one with `sfx(player, "boss.warn")`.

| Cue | What it is | Made of | Used by |
|---|---|---|---|
| `boss.arrive` | A boss steps out (when it has no sound of its own) | `mob.wither.spawn` pitch 0.6 vol 0.5 + `block.bell.hit` pitch 0.4 vol 0.5 after 0.4 s | - |
| `boss.warn` | A boss is about to do something | `note.didgeridoo` pitch 0.7 vol 0.9 + `block.bell.hit` pitch 1.2 vol 0.25 after 0.05 s | bestiary |
| `cast.bolt` | Ember Bolt | `item.trident.throw` pitch 0.8 vol 0.6 + `mob.blaze.shoot` pitch 1.3 vol 0.35 + `block.bell.hit` pitch 1.8 vol 0.15 after 0.05 s | - |
| `cast.hit` | Ember Bolt lands | `mob.blaze.hit` pitch 0.7 vol 0.4 + `block.bell.hit` pitch 1.5 vol 0.12 | townhall |
| `cast.ward` | Ward | `chime.amethyst_block` pitch 0.7 vol 0.9 + `beacon.activate` pitch 1.4 vol 0.35 + `block.bell.hit` pitch 1.2 vol 0.2 after 0.15 s | - |
| `cast.blink` | Blink | `mob.endermen.portal` pitch 1.2 vol 0.5 + `chime.amethyst_block` pitch 1.6 vol 0.4 + `random.orb` pitch 0.5 vol 0.15 after 0.05 s | townhall |
| `cast.echo` | Echo Sight | `chime.amethyst_block` pitch 0.5 vol 0.8 + `block.bell.hit` pitch 0.5 vol 0.35 after 0.2 s + `block.bell.hit` pitch 0.5 vol 0.12 after 0.7 s | - |
| `cast.bind` | Bind | `place.chain` pitch 0.6 vol 1.2 + `place.chain` pitch 0.45 vol 0.8 after 0.15 s + `random.anvil_land` pitch 1.8 vol 0.12 after 0.2 s | - |
| `cast.step` | Halfstep | `portal.travel` pitch 2 vol 0.12 + `mob.endermen.portal` pitch 0.6 vol 0.3 after 0.05 s + `chime.amethyst_block` pitch 0.6 vol 0.3 after 0.1 s | - |
| `cast.hollowstep` | Veilstep | `portal.travel` pitch 0.6 vol 0.2 + `mob.warden.heartbeat` pitch 0.8 vol 0.8 after 0.2 s + `block.bell.hit` pitch 0.35 vol 0.5 after 0.4 s | townhall (2) |
| `cast.choir` | Choir's Call | `block.bell.hit` pitch 0.4 + `block.bell.hit` pitch 0.3 vol 0.6 after 0.15 s + `ambient.cave` pitch 0.7 vol 0.3 after 0.3 s | - |
| `cast.crescendo` | A Crescendo begins | `block.bell.hit` pitch 1.6 vol 0.8 + `block.bell.hit` pitch 1.2 vol 0.5 after 0.1 s + `chime.amethyst_block` vol 0.6 after 0.2 s | townhall |
| `cast.shatter` | A Ward plate or Bind chain breaks | `random.glass` pitch 1.4 vol 0.5 + `block.bell.hit` pitch 1.7 vol 0.18 after 0.05 s | townhall (4) |
| `cast.toll` | The Choir's bell tolls | `block.bell.hit` pitch 0.35 vol 0.9 + `block.bell.hit` pitch 0.26 vol 0.5 after 0.15 s + `ambient.cave` pitch 0.6 vol 0.2 after 0.25 s | townhall |
| `cast.channel` | Veilstep opening | `mob.warden.heartbeat` pitch 0.7 vol 0.7 + `portal.trigger` pitch 0.5 vol 0.2 after 0.1 s + `mob.warden.heartbeat` pitch 0.7 vol 0.6 after 0.45 s | townhall |
| `cast.pulse` | Echo Sight listening | `block.bell.hit` pitch 0.45 vol 0.25 + `chime.amethyst_block` pitch 0.45 vol 0.2 after 0.1 s | townhall |
| `cast.push` | A soft push wave | `mob.endermen.portal` pitch 0.5 vol 0.25 + `chime.amethyst_block` pitch 0.8 vol 0.3 after 0.05 s | townhall |
| `cast.overwhelmed` | The Choir is too loud | `mob.warden.sonic_boom` pitch 0.7 vol 0.35 + `block.bell.hit` pitch 0.3 vol 0.5 after 0.2 s | townhall |
| `cast.open` | The magic hotbar opens | `chime.amethyst_block` pitch 1.2 vol 0.5 + `item.book.page_turn` pitch 0.7 vol 0.4 after 0.05 s | townhall |
| `cast.close` | The magic hotbar closes | `chime.amethyst_block` pitch 0.8 vol 0.4 + `item.book.page_turn` pitch 0.6 vol 0.4 after 0.05 s | townhall |
| `horn.assault` | Another assault is coming | `raid.horn` pitch 0.85 vol 0.8 + `raid.horn` pitch 0.64 vol 0.35 after 0.25 s | siege |
| `wx.gust` | A gust of wind | `elytra.loop` pitch 0.55 vol 0.35 + `ambient.weather.rain` pitch 0.5 vol 0.15 after 0.3 s | - |
| `wx.spray` | Sea spray on the wind | `random.splash` pitch 0.6 vol 0.25 + `ambient.weather.rain` pitch 0.8 vol 0.2 after 0.1 s | - |
| `wx.buoy_bell` | A bell out in the sea fret | `block.bell.hit` pitch 0.45 vol 0.22 + `block.bell.hit` pitch 0.42 vol 0.08 after 1.5 s | - |
| `wx.drip` | Water dripping in the fog | `cauldron_drip.water.pointed_dripstone` pitch 0.8 vol 0.5 + `cauldron_drip.water.pointed_dripstone` pitch 0.7 vol 0.3 after 0.7 s | - |
| `wx.sand_hiss` | Sand hissing past | `dig.sand` pitch 0.5 vol 0.3 + `ambient.weather.rain` pitch 1.3 vol 0.25 + `dig.sand` pitch 0.45 vol 0.2 after 0.25 s | - |
| `wx.cold_wind` | Cold wind over snow | `elytra.loop` pitch 0.45 vol 0.3 + `step.snow` pitch 0.6 vol 0.15 after 0.5 s | - |
| `wx.howl` | The blizzard howling | `elytra.loop` pitch 0.4 vol 0.45 + `mob.wolf.whine` pitch 0.5 vol 0.06 after 0.6 s | - |
| `wx.fen_croak` | Something croaking in the fen | `mob.frog.ambient` pitch 0.6 vol 0.4 + `mob.frog.ambient` pitch 0.5 vol 0.2 after 0.6 s | - |
| `wx.fen_splash` | A splash somewhere out on the water | `random.splash` pitch 0.45 vol 0.2 + `bubble.pop` pitch 0.5 vol 0.25 after 0.4 s | - |
| `wx.fen_bell` | A bell under the fen water | `block.bell.hit` pitch 0.32 vol 0.12 + `bubble.pop` pitch 0.4 vol 0.2 after 0.5 s | - |
| `wx.marsh_hum` | A hum where the marsh lights are | `beacon.ambient` pitch 0.5 vol 0.15 + `chime.amethyst_block` pitch 0.4 vol 0.1 after 1 s | - |
| `hollow.far_singing` | Singing a long way off in the Hollow | `siege.choir.hum` pitch 0.5 vol 0.18 + `siege.choir.hum` pitch 0.75 vol 0.08 after 0.8 s | - |
| `hollow.drip` | Water dripping from the Hollow's roof | `cauldron_drip.water.pointed_dripstone` pitch 0.6 vol 0.45 + `cauldron_drip.water.pointed_dripstone` pitch 0.55 vol 0.25 after 0.9 s | - |
| `hollow.crack_wind` | Wind breathing through a crack in the rock | `elytra.loop` pitch 0.35 vol 0.22 + `ambient.cave` pitch 0.5 vol 0.12 after 0.5 s | - |
| `hollow.rock_settle` | Rock settling somewhere far off | `dig.deepslate` pitch 0.45 vol 0.5 + `dig.stone` pitch 0.4 vol 0.3 after 0.3 s + `dig.gravel` pitch 0.5 vol 0.2 after 0.7 s | - |
| `hollow.river_hum` | The light river humming | `beacon.ambient` pitch 0.6 vol 0.18 + `bubble.pop` pitch 0.5 vol 0.15 after 0.6 s | - |
| `hollow.sunk_bell` | A bell somewhere under the Court's water | `block.bell.hit` pitch 0.3 vol 0.14 + `bubble.pop` pitch 0.4 vol 0.2 after 0.5 s + `block.bell.hit` pitch 0.28 vol 0.05 after 2 s | - |
| `hollow.seat_hush` | The air at the Seat ringing very faintly | `resonate.amethyst_block` pitch 0.5 vol 0.12 | - |

## Creature voices

What each creature sounds like when it idles, is hit, dies and walks. Each is one vanilla sound for now, re-pitched so
no two groups sound alike; change them in `studio/bestiary/voices.py` and run `python3 studio/bestiary/voices.py`.
A dash means it keeps the block's own footstep or has no idle sound; "silent" means silent on purpose.

| Creature | Idle | Hurt | Death | Step |
|---|---|---|---|---|
| archer | - | `game.player.hurt` 0.85-0.95 | `game.player.die` 0.82-0.88 | - |
| ash_scarab | `mob.silverfish.say` 0.6-0.66 | `mob.silverfish.hit` 0.6-0.66 | `mob.silverfish.kill` 0.6-0.64 | `mob.silverfish.step` 0.6-0.66 |
| ash_seneschal | `mob.blaze.breathe` 0.5-0.55 | `mob.blaze.hit` 0.55-0.6 | `mob.blaze.death` 0.5-0.54 | - |
| ashen_knight | - | `mob.vindicator.hurt` 0.86-0.96 | `mob.vindicator.death` 0.8099999999999999-0.91 | `armor.equip_chain` 0.8-0.9 |
| ashen_squire | - | `mob.pillager.hurt` 1-1.1 | `mob.pillager.death` 0.95-1.05 | - |
| ballista_engine | - | `hit.wood` 0.6-0.7 | `block.scaffolding.break` 0.5-0.55 | - |
| barrow_wight | `mob.stray.ambient` 0.6-0.66 | `mob.stray.hurt` 0.6-0.66 | `mob.stray.death` 0.58-0.62 | `mob.stray.step` 0.7-0.76 |
| bell_ringer | `block.bell.hit` 0.5-0.56 | `mob.pillager.hurt` 0.7-0.8 | `mob.pillager.death` 0.62-0.68 | - |
| body | silent | silent | silent | - |
| bog_hag | `mob.witch.ambient` 0.7-0.76 | `mob.witch.hurt` 0.7-0.76 | `mob.witch.death` 0.68-0.72 | - |
| brine_lurker | `mob.guardian.land_idle` 0.5-0.56 | `mob.guardian.land_hit` 0.5-0.56 | `mob.guardian.land_death` 0.5-0.55 | `mob.drowned.step` 0.6-0.66 |
| champion_knight | - | `mob.vindicator.hurt` 0.9-1 | `mob.vindicator.death` 0.85-0.9500000000000001 | - |
| champion_lord | - | `mob.vindicator.hurt` 0.78-0.88 | `mob.vindicator.death` 0.73-0.8300000000000001 | - |
| champion_retainer | - | `mob.pillager.hurt` 1-1.1 | `mob.pillager.death` 0.95-1.05 | - |
| champion_sorcerer | - | `mob.evocation_illager.hurt` 0.9-1 | `mob.evocation_illager.death` 0.85-0.9500000000000001 | - |
| changeling | `mob.allay.idle` 0.6-0.66 | `mob.fox.hurt` 0.7-0.78 | `mob.fox.death` 0.6-0.66 | - |
| chapel_bell | - | `block.bell.hit` 0.6-0.64 | `block.bell.hit` 0.4-0.42 | - |
| choir_conductor | - | `mob.evocation_illager.hurt` 0.6-0.65 | `mob.wither.death` 0.8-0.85 | - |
| choir_singer | - | `mob.allay.hurt` 0.5-0.55 | `mob.allay.death` 0.45-0.5 | - |
| clockwork_reeve | `random.click` 0.5-0.56 | `mob.irongolem.hit` 0.7-0.76 | `mob.irongolem.death` 0.6-0.64 | `mob.irongolem.walk` 0.7-0.76 |
| crossbowman | - | `game.player.hurt` 0.85-0.95 | `game.player.die` 0.82-0.88 | - |
| crow_mage | `mob.evocation_illager.ambient` 0.7-0.78 | `mob.evocation_illager.hurt` 0.7-0.78 | `mob.evocation_illager.death` 0.66-0.7 | - |
| crown_stand | silent | silent | silent | - |
| drowned_bride | `mob.allay.idle` 0.45-0.5 | `mob.drowned.hurt_water` 0.8-0.86 | `mob.elderguardian.death` 0.9-0.95 | - |
| dune_wyrm | `mob.sniffer.long_sniff` 0.5-0.55 | `mob.hoglin.hurt` 0.6-0.66 | `mob.hoglin.death` 0.5-0.55 | `dig.sand` 0.7-0.8 |
| echo_hound | `mob.wolf.big.whine` 0.6-0.66 | `mob.wolf.big.hurt` 0.68-0.75 | `mob.wolf.big.death` 0.6-0.65 | `mob.wolf.step` 0.8-0.9 |
| frost_stag | `mob.goat.ambient` 0.6-0.66 | `mob.goat.hurt` 0.6-0.66 | `mob.goat.death` 0.58-0.62 | `mob.goat.step` 0.8-0.9 |
| gatebreaker | `mob.warden.idle` 0.8-0.86 | `mob.warden.hurt` 0.85-0.9 | `mob.warden.death` 0.85-0.9 | `mob.warden.step` 0.85-0.9 |
| gloamwing | `mob.phantom.idle` 0.5-0.56 | `mob.phantom.hurt` 0.6-0.66 | `mob.phantom.death` 0.58-0.62 | - |
| grave_keeper | - | `game.player.hurt` 1-1.1 | `game.player.die` 1-1.05 | - |
| grey_axeman | `mob.vindicator.idle` 0.72-0.7999999999999999 | `mob.vindicator.hurt` 0.72-0.82 | `mob.vindicator.death` 0.6699999999999999-0.77 | - |
| grey_bellcutter | `mob.pillager.idle` 0.74-0.82 | `mob.pillager.hurt` 0.74-0.84 | `mob.pillager.death` 0.69-0.79 | - |
| grey_bowman | `mob.pillager.idle` 0.8-0.88 | `mob.pillager.hurt` 0.8-0.9 | `mob.pillager.death` 0.75-0.8500000000000001 | - |
| grey_serjeant | `mob.vindicator.idle` 0.64-0.72 | `mob.vindicator.hurt` 0.64-0.74 | `mob.vindicator.death` 0.59-0.6900000000000001 | `armor.equip_chain` 0.7-0.8 |
| grey_spearman | `mob.vindicator.idle` 0.78-0.86 | `mob.vindicator.hurt` 0.78-0.88 | `mob.vindicator.death` 0.73-0.8300000000000001 | - |
| heart_stand | silent | silent | silent | - |
| hollow_bolt | silent | silent | silent | - |
| hollow_crow | `mob.parrot.idle` 0.5-0.56 | `mob.parrot.hurt` 0.55-0.62 | `mob.bat.death` 0.5-0.55 | - |
| hollow_footman | `mob.zombie_villager.say` 0.62-0.7 | `mob.zombie_villager.hurt` 0.65-0.75 | `mob.zombie_villager.death` 0.6-0.66 | - |
| hollow_regent | - | `mob.evocation_illager.hurt` 0.55-0.6 | `mob.wither.death` 0.6-0.65 | - |
| hollow_warlord | `mob.vindicator.idle` 0.6-0.6799999999999999 | `mob.vindicator.hurt` 0.6-0.7 | `mob.vindicator.death` 0.5499999999999999-0.65 | `mob.irongolem.walk` 0.9-1 |
| inquisitor | `mob.evocation_illager.ambient` 0.86-0.94 | `mob.evocation_illager.hurt` 0.86-0.96 | `mob.evocation_illager.death` 0.8099999999999999-0.91 | - |
| job_npc | - | `game.player.hurt` 1-1.1 | `game.player.die` 1-1.05 | - |
| keep_heart | - | `hit.amethyst_block` 0.5-0.56 | `break.amethyst_block` 0.4-0.45 | - |
| knight | - | `game.player.hurt` 0.85-0.95 | `game.player.die` 0.82-0.88 | - |
| label | silent | silent | silent | - |
| lost_villager | `mob.villager.idle` 0.55-0.62 | `mob.villager.hit` 0.6-0.66 | `mob.zombie_villager.death` 0.7-0.75 | - |
| man_at_arms | - | `game.player.hurt` 0.85-0.95 | `game.player.die` 0.82-0.88 | - |
| mire_toad | `mob.frog.ambient` 0.45-0.5 | `mob.frog.hurt` 0.5-0.55 | `mob.frog.death` 0.48-0.52 | `mob.frog.step` 0.5-0.56 |
| mirror_knight | `chime.amethyst_block` 0.6-0.66 | `hit.amethyst_block` 0.7-0.8 | `random.glass` 0.7-0.75 | `step.amethyst_block` 0.8-0.9 |
| mother_echo | - | `mob.witch.hurt` 0.9-1 | `mob.vex.death` 0.5-0.55 | - |
| mother_of_changelings | `mob.witch.ambient` 0.5-0.55 | `mob.witch.hurt` 0.55-0.6 | `mob.ghast.death` 0.5-0.54 | - |
| omen_raven | `mob.parrot.idle` 0.42-0.48 | `mob.parrot.hurt` 0.5-0.55 | `mob.bat.death` 0.45-0.5 | - |
| oswin_reflection | silent | `mob.vex.hurt` 0.4-0.45 | `random.glass` 0.5-0.55 | - |
| oswin_the_last | `mob.wither.ambient` 0.45-0.5 | `mob.evocation_illager.hurt` 0.5-0.55 | `mob.wither.death` 0.55-0.58 | - |
| pale_huntsman | `mob.horse.skeleton.idle` 0.6-0.66 | `mob.stray.hurt` 0.5-0.56 | `mob.horse.skeleton.death` 0.5-0.55 | - |
| pikeman | - | `game.player.hurt` 0.85-0.95 | `game.player.die` 0.82-0.88 | - |
| portrait | silent | silent | silent | - |
| post_marker | silent | silent | silent | - |
| pretender_blade | `mob.pillager.idle` 0.82-0.8999999999999999 | `mob.pillager.hurt` 0.82-0.9199999999999999 | `mob.pillager.death` 0.7699999999999999-0.87 | - |
| pretender_brute | `mob.piglin_brute.ambient` 0.55-0.6 | `mob.piglin_brute.hurt` 0.55-0.6 | `mob.piglin_brute.death` 0.5-0.55 | `mob.irongolem.walk` 0.9-1 |
| pretender_seer | `mob.evocation_illager.ambient` 0.8-0.88 | `mob.evocation_illager.hurt` 0.8-0.9 | `mob.evocation_illager.death` 0.75-0.8500000000000001 | - |
| quartermaster | - | `game.player.hurt` 1-1.1 | `game.player.die` 1-1.05 | - |
| ram_crew | - | `game.player.hurt` 0.85-0.95 | `game.player.die` 0.82-0.88 | - |
| ram_engine | - | `hit.wood` 0.6-0.7 | `block.scaffolding.break` 0.5-0.55 | - |
| reeve_cog | - | `mob.irongolem.hit` 1.3-1.4 | `random.anvil_land` 1.6-1.7 | `mob.irongolem.walk` 1.5-1.6 |
| resting_heart | silent | silent | silent | - |
| reveal_boy | silent | silent | silent | - |
| reveal_king | silent | silent | silent | - |
| reveal_morvane | silent | silent | silent | - |
| rime_pillar | - | `hit.amethyst_block` 0.6-0.7 | `random.glass` 0.6-0.65 | - |
| rimewolf | `mob.wolf.big.growl` 0.7-0.76 | `mob.wolf.big.hurt` 0.75-0.82 | `mob.wolf.big.death` 0.7-0.75 | `mob.wolf.step` 0.8-0.9 |
| sapper | - | `game.player.hurt` 0.85-0.95 | `game.player.die` 0.82-0.88 | - |
| seep | `resonate.amethyst_block` 0.4-0.45 | `hit.amethyst_block` 0.5-0.56 | `break.amethyst_block` 0.45-0.5 | - |
| shardcaster | `mob.vex.ambient` 0.55-0.62 | `mob.vex.hurt` 0.58-0.64 | `random.glass` 0.7-0.76 | - |
| shieldbearer | - | `game.player.hurt` 0.85-0.95 | `game.player.die` 0.82-0.88 | - |
| shieldwall_brute | `mob.piglin_brute.ambient` 0.62-0.7 | `mob.piglin_brute.hurt` 0.6-0.68 | `mob.piglin_brute.death` 0.55-0.6 | `mob.irongolem.walk` 0.9-1 |
| siege_ogre | `mob.ravager.ambient` 0.58-0.64 | `mob.ravager.hurt` 0.6-0.66 | `mob.ravager.death` 0.52-0.56 | `mob.ravager.step` 0.7-0.76 |
| spell_satchel | silent | silent | silent | - |
| spinning_cog | silent | silent | silent | - |
| stone_vigil | `resonate.amethyst_block` 0.5-0.56 | `mob.irongolem.hit` 1.1-1.2 | `mob.irongolem.death` 0.9-0.95 | `mob.irongolem.walk` 1.2-1.3 |
| template_stand | silent | silent | silent | - |
| throne_seal | silent | silent | silent | - |
| tolling_shade | `resonate.amethyst_block` 0.45-0.5 | `mob.vex.hurt` 0.5-0.56 | `mob.vex.death` 0.48-0.52 | - |
| torchbearer | `block.campfire.crackle` 0.8-1 | `mob.vindicator.hurt` 0.82-0.92 | `mob.vindicator.death` 0.75-0.8 | - |
| townsfolk | - | `game.player.hurt` 1-1.1 | `game.player.die` 1-1.05 | - |
| train_coach | - | `hit.anvil` 0.7-0.8 | `random.anvil_land` 0.5-0.55 | - |
| train_engine | - | `hit.anvil` 0.7-0.8 | `random.anvil_land` 0.5-0.55 | - |
| trebuchet_crew | - | `game.player.hurt` 0.85-0.95 | `game.player.die` 0.82-0.88 | - |
| trebuchet_engine | - | `hit.wood` 0.6-0.7 | `block.scaffolding.break` 0.5-0.55 | - |
| veinsworn | `mob.husk.ambient` 0.6-0.66 | `mob.husk.hurt` 0.6-0.68 | `mob.husk.death` 0.56-0.6 | - |
| warlord_king | `mob.vindicator.idle` 0.55-0.63 | `mob.vindicator.hurt` 0.55-0.65 | `mob.vindicator.death` 0.5-0.6000000000000001 | `mob.irongolem.walk` 0.9-1 |
| wrongling | `mob.endermen.idle` 0.6-0.66 | `mob.endermen.hit` 0.6-0.66 | `mob.endermen.death` 0.66-0.7 | - |

## Reworked vanilla sounds

Whenever a script plays one of these, it comes out as the recipe on the right. The pitch and volume the script asks
for still apply on top, and every play drifts a few percent in pitch so nothing is heard twice exactly the same.

| Vanilla sound | What it means here | Made of | Places | Used by |
|---|---|---|---|---|
| `block.bell.hit` | Any bell | `block.bell.hit` + `block.bell.hit` pitch 0.5 vol 0.4 after 0.05 s + `block.bell.hit` pitch 1.03 vol 0.22 after 0.15 s | 50 | bestiary (15), undertow (15), after (7), lore (4), unlocks (4), crown (2), codex, roletrials, townhall |
| `random.levelup` | Done, bought, learned | `random.levelup` pitch 0.8 vol 0.5 + `note.harp` pitch 0.6 vol 0.35 after 0.1 s | 36 | horses (7), siege (5), townhall (4), codex (3), lore (3), settle (3), dragons (2), arena, crown, ironworks, reach, rivals, roletrials, trade, undertow, vault |
| `random.orb` | A small yes | `random.orb` pitch 0.75 vol 0.55 | 23 | trade (4), economy (2), townhall (2), unlocks (2), arena, codex, dragons, guild, ironworks, letters, lore, rails, roletrials, settle, undertow, upkeep, vault |
| `random.anvil_use` | Building and mending | `random.anvil_use` pitch 0.8 vol 0.55 + `dig.stone` pitch 0.7 vol 0.5 after 0.1 s | 21 | unlocks (4), settle (3), townhall (3), vault (3), siege (2), arena, codex, economy, horses, roletrials, trade |
| `random.anvil_land` | A heavy blow | `random.anvil_land` pitch 0.9 vol 0.8 + `dig.stone` pitch 0.5 vol 0.7 | 19 | bestiary (3), undertow (3), siege (2), trains (2), unlocks (2), vault (2), dragons, plotcaves, roletrials, townhall, warwrit |
| `raid.horn` | A horn | `raid.horn` pitch 0.85 + `raid.horn` pitch 0.64 vol 0.4 after 0.25 s | 14 | bestiary (5), townhall (3), unlocks (3), crown, dragons, rivals |
| `block.amethyst_block.chime` | A crystal note | `chime.amethyst_block` | 11 | bestiary (4), undertow (4), lore (2), vault |
| `mob.endermen.portal` | A step between places | `mob.endermen.portal` pitch 0.85 vol 0.8 + `random.orb` pitch 0.4 vol 0.15 after 0.1 s | 10 | bestiary (6), crown, horses, townhall, undertow |
| `item.book.page_turn` | A page | `item.book.page_turn` pitch 0.9 | 8 | lore (6), bestiary, guide |
| `ambient.cave` | Something is wrong | `ambient.cave` pitch 0.85 vol 0.8 | 8 | reach (3), bestiary (2), undertow (2), lore |
| `ui.toast.challenge_complete` | Something earned (the bell rings three times: Mateo, 2026-11-12) | `random.toast` pitch 0.9 vol 0.7 + `random.levelup` pitch 1.2 vol 0.25 after 0.1 s + `block.bell.hit` pitch 0.6 vol 0.45 after 0.4 s + `block.bell.hit` pitch 0.6 vol 0.4 after 1.4 s + `block.bell.hit` pitch 0.6 vol 0.35 after 2.4 s | 7 | siege (2), bestiary, crown, rivals, settle, townhall |
| `dig.stone` | Stone moving | `dig.stone` pitch 0.9 | 6 | siege (3), crown, graves, townhall |
| `random.explode` | A blast | `random.explode` pitch 0.85 | 6 | siege (3), bestiary, undertow, vault |
| `random.glass` | Something breaks that should not | `random.glass` pitch 0.9 vol 0.8 | 6 | bestiary (4), crown, unlocks |
| `mob.wither.spawn` | Something old arrives | `mob.wither.spawn` pitch 0.85 vol 0.7 + `block.bell.hit` pitch 0.4 vol 0.4 after 0.4 s | 6 | undertow (3), bestiary (2), townhall |
| `mob.ravager.roar` | Something big | `mob.ravager.roar` pitch 0.9 vol 0.9 | 5 | bestiary (3), arena, undertow |
| `random.totem` | A great change | `random.totem` pitch 0.8 vol 0.55 + `block.bell.hit` pitch 0.5 vol 0.4 after 0.2 s | 4 | townhall (2), crown, horses |
| `mob.warden.heartbeat` | A heartbeat that is not yours | `mob.warden.heartbeat` pitch 0.9 | 4 | bestiary, crown, roletrials, undertow |
| `random.toast` | A note is added | `random.toast` pitch 0.8 vol 0.7 | 3 | lore (2), codex |
| `random.click` | A catch or a lever | `random.click` pitch 0.85 vol 0.8 | 3 | rails, siege, unlocks |
| `random.break` | Not allowed, or something gave way | `random.break` pitch 0.8 vol 0.7 | 3 | bestiary, plots, siege |
| `ambient.weather.thunder` | Thunder with no sky | `ambient.weather.thunder` pitch 0.9 vol 0.9 | 3 | undertow (2), crown |
| `mob.wither.ambient` | A breath from below | `mob.wither.ambient` pitch 0.9 vol 0.8 | 3 | bestiary (3) |
| `mob.wolf.howl` | A howl far off | `mob.wolf.big.whine` pitch 0.6 vol 0.8 + `mob.wolf.big.whine` pitch 0.5 vol 0.4 after 0.3 s | 3 | unlocks (3) |
| `random.pop` | A small pop | `random.pop` pitch 0.85 vol 0.7 | 2 | codex, dragons |
| `mob.wither.death` | Something great ends | `mob.wither.death` pitch 0.9 vol 0.8 + `block.bell.hit` pitch 0.35 vol 0.5 after 0.6 s | 2 | crown, siege |
| `block.amethyst_block.break` | Crystal breaking | `break.amethyst_block` | 2 | undertow, vault |
| `block.amethyst_block.resonate` | Crystal humming | `resonate.amethyst_block` | 2 | undertow (2) |
| `block.bell.resonate` | A bell still ringing | `resonate.amethyst_block` pitch 0.5 vol 0.6 + `block.bell.hit` pitch 0.5 vol 0.25 after 0.1 s | 2 | lore, undertow |
| `block.bell.use` | A bell touched | `block.bell.hit` pitch 1.2 vol 0.6 | 1 | lore |
| `dye.use` | Dye on cloth | `sign.dye.use` | 1 | siege |
| `mob.ravager.attack` | A heavy bite | `mob.ravager.bite` pitch 0.9 vol 0.9 | 1 | siege |
| `portal.travel` | The Hollow pulling | `portal.travel` pitch 0.9 | 0 | - |

## Vanilla sounds played as they are

| Vanilla sound | Places | Used by |
|---|---|---|
| `mob.horse.gallop` | 6 | letters (2), townhall (2), horses, roletrials |
| `item.shield.block` | 4 | bestiary (3), townhall |
| `random.door_open` | 4 | warwrit (2), siege, vault |
| `armor.equip_leather` | 3 | dragons, horses, looks |
| `mob.blaze.shoot` | 3 | roletrials (2), dragons |
| `note.bass` | 3 | townhall (2), dragons |
| `note.bell` | 3 | rails, roletrials, townhall |
| `note.flute` | 3 | bestiary, horses, unlocks |
| `random.eat` | 3 | dragons (2), bestiary |
| `armor.equip_iron` | 2 | guardposts, horses |
| `block.scaffolding.break` | 2 | siege (2) |
| `bucket.empty_water` | 2 | unlocks (2) |
| `bucket.fill_water` | 2 | roletrials, unlocks |
| `crossbow.shoot` | 2 | dragons, siege |
| `dig.grass` | 2 | roletrials, unlocks |
| `dig.sand` | 2 | bestiary, dragons |
| `mob.elderguardian.curse` | 2 | bestiary, undertow |
| `mob.enderdragon.flap` | 2 | codex, roletrials |
| `mob.evocation_illager.cast_spell` | 2 | bestiary, codex |
| `mob.horse.idle` | 2 | horses (2) |
| `mob.irongolem.throw` | 2 | bestiary (2) |
| `mob.villager.no` | 2 | bestiary (2) |
| `mob.witch.celebrate` | 2 | bestiary (2) |
| `random.bow` | 2 | bestiary (2) |
| `random.drink` | 2 | bestiary, roletrials |
| `tile.piston.in` | 2 | unlocks (2) |
| `armor.equip_diamond` | 1 | codex |
| `armor.equip_elytra` | 1 | looks |
| `armor.equip_netherite` | 1 | siege |
| `block.campfire.crackle` | 1 | dragons |
| `block.end_portal_frame.fill` | 1 | crown |
| `block.end_portal.spawn` | 1 | undertow |
| `chime.amethyst_block` | 1 | roletrials |
| `dig.gravel` | 1 | roletrials |
| `elytra.loop` | 1 | roletrials |
| `item.book.put` | 1 | lore |
| `item.trident.throw` | 1 | codex |
| `mob.allay.idle` | 1 | roletrials |
| `mob.enderdragon.growl` | 1 | roletrials |
| `mob.ghast.scream` | 1 | roletrials |
| `mob.horse.angry` | 1 | horses |
| `mob.horse.breathe` | 1 | horses |
| `mob.phantom.swoop` | 1 | bestiary |
| `mob.ravager.stun` | 1 | bestiary |
| `mob.villager.death` | 1 | bestiary |
| `mob.warden.nearby_close` | 1 | bestiary |
| `mob.warden.roar` | 1 | undertow |
| `mob.witch.ambient` | 1 | roletrials |
| `mob.wither.hurt` | 1 | roletrials |
| `mob.wither.shoot` | 1 | bestiary |
| `mob.wolf.growl` | 1 | bestiary |
| `note.pling` | 1 | arena |
| `random.door_close` | 1 | vault |
| `random.fuse` | 1 | siege |
| `random.splash` | 1 | codex |
| `step.stone` | 1 | bestiary |

## For anyone adding code

Play sounds with `sfx()` from `scripts/core/sfx.js`, not `playSound` directly (`node tools/check.mjs` notes any that slip through):

```js
import { sfx } from "../core/sfx.js";
sfx(player, "random.levelup");                          // only that player hears it
sfx(dimension, "block.bell.hit", location, { pitch: 0.5 }); // everyone near that spot
```

A new vanilla sound works straight away and is played as it is, as long as Bedrock has it: `node tools/check.mjs` fails on
any id missing from `tools/vanilla_sounds.json` (Java names like `block.amethyst_block.chime` play nothing on Bedrock). To rework it, or to add a named cue, add a line to
`core/sfx_cues.js` and run `node tools/sound-list.mjs`.
