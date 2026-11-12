# Sound list

Every sound The Hollow Crown plays, and what each one is made of. **This file is generated**: change
`studio/sounds/signature.json` (recordings and prompts) or `Siege_Nights_BP/scripts/core/sfx_cues.js`
(everything else), then run `node tools/sound-list.mjs`.

Tone for all of it: uneasy, especially at night. Not horror, no jump scares, nothing sudden or loud for its own sake.
There is no music in version 1.

- **23 signature sounds** are meant to be real recordings made with an AI sound generator. 0 of 23 are installed; the rest play a stand-in built from vanilla sounds, so the game is never silent.
- **32 more dragon sounds** have synthesized stand-ins and can be replaced the same way.
- **25 vanilla sounds** are reworked (lower, softer, layered) everywhere the scripts use them, and **16 named cues** are built from vanilla layers.
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
| 1 | The 3:17 toll | `toll_317` | 14 s | one-shot, stereo | vanilla stand-in |
| 2 | The siege horn | `siege_horn` | 9 s | one-shot, stereo | vanilla stand-in |
| 3 | The choir hum (the singing) | `choir_hum` | 15 s | loop, mono | placeholder made in code |
| 4 | The Rift opening | `rift_open` | 8 s | one-shot, mono | vanilla stand-in |
| 5 | The Hollow's ambience | `hollow_ambience` | 30 s | loop, stereo | vanilla stand-in |
| 6 | A storm tide of the endless siege | `storm_tide` | 15 s | one-shot, stereo | vanilla stand-in |
| 7 | Morvane | `boss_morvane` | 12 s | one-shot, stereo | vanilla stand-in |
| 8 | The Choir | `boss_choir` | 12 s | one-shot, stereo | vanilla stand-in |
| 9 | The Clockwork Reeve | `boss_reeve` | 8 s | one-shot, stereo | vanilla stand-in |
| 10 | The Pale Huntsman | `boss_huntsman` | 10 s | one-shot, stereo | vanilla stand-in |
| 11 | The Drowned Bride | `boss_bride` | 10 s | one-shot, stereo | vanilla stand-in |
| 12 | The Ash Seneschal | `boss_seneschal` | 9 s | one-shot, stereo | vanilla stand-in |
| 13 | The Mother of Changelings | `boss_mother` | 10 s | one-shot, stereo | vanilla stand-in |
| 14 | The Warlord King | `boss_warlord_king` | 10 s | one-shot, stereo | vanilla stand-in |
| 15 | The first glimpse | `first_glimpse` | 12 s | one-shot, stereo | vanilla stand-in |
| 16 | The Forgemaster's bell-tongue | `bell_tongue` | 6 s | one-shot, stereo | vanilla stand-in |
| 17 | The roll of the fallen | `roll_drum` | 4 s | one-shot, mono | vanilla stand-in |
| 18 | The forty rowing | `forty_row` | 10 s | one-shot, stereo | vanilla stand-in |
| 19 | The fen collects | `fen_debt` | 7 s | one-shot, stereo | vanilla stand-in |
| 20 | Cinderwing: roar | `cinderwing_roar` | 2.4 s | one-shot, mono | synthesized stand-in |
| 21 | Ashen Wyvern: roar | `wyvern_roar` | 2.4 s | one-shot, mono | synthesized stand-in |
| 22 | Dune Drake: roar | `drake_roar` | 2.4 s | one-shot, mono | synthesized stand-in |
| 23 | Glass Wyrm: roar | `wyrm_roar` | 2.4 s | one-shot, mono | synthesized stand-in |

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
- **Length:** about 8 seconds, one-shot, mono
- **When:** When the crack in the cave tears open (it takes about 5 seconds). Heard by everyone nearby, from the Rift itself.
- **Stand-in until then:** nothing extra (the game's existing sounds for this moment carry on)
- **Test:** `/scriptevent siege:sound sig.rift_open`

Prompt:

> Solid rock slowly splitting open from the middle outward over five seconds: deep grinding and cracking stone and a rising low rumble, then a hollow rush of air being drawn inward like a held breath let go, with one faint low bell tone inside the rush. Ends with a few falling pebbles. Heavy, close, physical. No explosion, no scream, no music.

### 5. The Hollow's ambience

- **File name:** `hollow_ambience` (installs as `sounds/siege/sig/hollow_ambience.ogg`, sound id `siege.sig.hollow_ambience`)
- **Length:** about 30 seconds, loop, stereo. The installer fades 3 s at each end and the game overlaps the fades, so it never has a gap
- **When:** All the time while you are in the Hollow, quietly, under the Hollow's own thunder and the singing.
- **Stand-in until then:** nothing extra (the game's existing sounds for this moment carry on)
- **Test:** `/scriptevent siege:sound sig.hollow_ambience`

Prompt:

> Seamless looping ambience of a vast underground world with no sky: a very low, steady, airy drone like wind moving through an enormous cavern, slow distant water, an occasional faint glassy chime far away, and a barely audible wordless choir note that comes and goes. Calm, wide, lonely and slightly wrong, never frightening. No thunder, no footsteps, no creatures, no melody. Constant level, no sudden sounds.

### 6. A storm tide of the endless siege

- **File name:** `storm_tide` (installs as `sounds/siege/sig/storm_tide.ogg`, sound id `siege.sig.storm_tide`)
- **Length:** about 15 seconds, one-shot, stereo
- **When:** In the Long Night, each time a fresh tide of soldiers comes by daylight ("Daylight. They come anyway.").
- **Stand-in until then:** `ambient.weather.thunder` pitch 0.55 vol 0.7 + `raid.horn` pitch 0.5 vol 0.35 after 0.7 s + `ambient.cave` pitch 0.7 vol 0.4 after 1.5 s
- **Test:** `/scriptevent siege:sound sig.storm_tide`

Prompt:

> A storm front arriving in daylight: a long roll of distant thunder that grows, a surge of wind, and underneath it the muffled sound of a great many feet marching closer and one far-off low war horn. Builds for ten seconds, then settles into steady wind. Ominous and tired rather than violent. No rain, no voices, no music.

### 7. Morvane

- **File name:** `boss_morvane` (installs as `sounds/siege/sig/boss_morvane.ogg`, sound id `siege.sig.boss.morvane`)
- **Length:** about 12 seconds, one-shot, stereo
- **When:** When Morvane rises from the Seat and the last fight begins.
- **Stand-in until then:** `block.bell.hit` pitch 0.4 vol 0.9 + `mob.wither.spawn` pitch 0.55 vol 0.5 after 0.3 s + `block.bell.hit` pitch 0.3 vol 0.5 after 1.5 s
- **Test:** `/scriptevent siege:sound sig.boss.morvane`

Prompt:

> An old king rising slowly from a stone throne in an enormous silent hall: the scrape of heavy cloth on stone, one long weary exhale from a deep male voice, then a single very low bell tone that seems to come from inside the room and hangs in the air, with a faint high crystalline ringing above it. Sad, patient and immense, not monstrous. No words, no growl, no music.

### 8. The Choir

- **File name:** `boss_choir` (installs as `sounds/siege/sig/boss_choir.ogg`, sound id `siege.sig.boss.choir`)
- **Length:** about 12 seconds, one-shot, stereo
- **When:** When the Choir turns toward you and seven voices begin to sing.
- **Stand-in until then:** `siege.choir.hum` + `siege.choir.hum` pitch 1.5 vol 0.5 after 0.5 s + `block.bell.hit` pitch 0.5 vol 0.4 after 1 s
- **Test:** `/scriptevent siege:sound sig.boss.choir`

Prompt:

> Seven singers, men and women, entering one after another on the same low sustained note with no words, each voice very slightly out of tune with the last so the sound beats and shimmers. Cold stone-hall reverb. It swells to a full unison and then stops dead, all at once, mid-breath. Beautiful and unsettling. No melody, no instruments.

### 9. The Clockwork Reeve

- **File name:** `boss_reeve` (installs as `sounds/siege/sig/boss_reeve.ogg`, sound id `siege.sig.boss.reeve`)
- **Length:** about 8 seconds, one-shot, stereo
- **When:** When the Clockwork Reeve winds himself and his fight begins.
- **Stand-in until then:** `random.click` pitch 0.6 + `random.click` pitch 0.6 after 0.5 s + `random.click` pitch 0.6 after 1 s + `block.bell.hit` pitch 0.8 vol 0.7 after 1.5 s + `random.anvil_land` pitch 0.5 vol 0.3 after 1.5 s
- **Test:** `/scriptevent siege:sound sig.boss.reeve`

Prompt:

> A large brass clockwork mechanism being wound: slow heavy ratchet clicks, a spring tightening, gears engaging, then a tower-clock tick that stumbles and repeats the same tick three times as if stuck, and one dull clock chime cut short. Dry, metallic, precise. No music, no voices.

### 10. The Pale Huntsman

- **File name:** `boss_huntsman` (installs as `sounds/siege/sig/boss_huntsman.ogg`, sound id `siege.sig.boss.huntsman`)
- **Length:** about 10 seconds, one-shot, stereo
- **When:** When the Pale Huntsman's fight begins (he is already watching you).
- **Stand-in until then:** `raid.horn` pitch 1.25 vol 0.5 + `mob.wolf.growl` pitch 0.6 vol 0.8 after 0.8 s + `raid.horn` pitch 0.9 vol 0.3 after 1.7 s
- **Test:** `/scriptevent siege:sound sig.boss.huntsman`

Prompt:

> A thin, pale hunting horn sounding once far away across a frozen forest, muffled by falling snow. Then silence, the creak of a bowstring being drawn very close by, and a single low wolf growl. Cold, still, patient. Light wind. No music, no voices, no howling pack.

### 11. The Drowned Bride

- **File name:** `boss_bride` (installs as `sounds/siege/sig/boss_bride.ogg`, sound id `siege.sig.boss.bride`)
- **Length:** about 10 seconds, one-shot, stereo
- **When:** When the Drowned Bride rises with the tide.
- **Stand-in until then:** `random.splash` pitch 0.5 + `block.bell.hit` pitch 0.7 vol 0.5 after 0.4 s + `block.bell.hit` pitch 0.66 vol 0.4 after 1.2 s + `mob.guardian.ambient` pitch 0.5 vol 0.5 after 0.7 s
- **Test:** `/scriptevent siege:sound sig.boss.bride`

Prompt:

> Something rising slowly out of deep still water: a long swell and pouring of water, the drip of heavy soaked fabric, a woman's soft wordless sigh, and two small chapel bells ringing underwater, muffled and bent out of tune. Mournful and slow, sad rather than scary. No scream, no music.

### 12. The Ash Seneschal

- **File name:** `boss_seneschal` (installs as `sounds/siege/sig/boss_seneschal.ogg`, sound id `siege.sig.boss.seneschal`)
- **Length:** about 9 seconds, one-shot, stereo
- **When:** When the Ash Seneschal turns his blank face toward you.
- **Stand-in until then:** `item.shield.block` pitch 0.5 + `random.anvil_land` pitch 0.45 vol 0.5 after 0.2 s + `dig.sand` pitch 0.5 after 0.6 s + `mob.wither.ambient` pitch 0.5 vol 0.3 after 0.8 s
- **Test:** `/scriptevent siege:sound sig.boss.seneschal`

Prompt:

> A heavy armoured knight turning to face you in a dry desert ruin: sand and ash hissing off metal plates, the slow grind of old armour joints, a huge iron shield set down on stone with one deep ringing thud, then a long hollow breath through an empty helmet. Dry, hot, weighty. No voice, no music.

### 13. The Mother of Changelings

- **File name:** `boss_mother` (installs as `sounds/siege/sig/boss_mother.ogg`, sound id `siege.sig.boss.mother`)
- **Length:** about 10 seconds, one-shot, stereo
- **When:** When the Mother of Changelings smiles with someone else's face.
- **Stand-in until then:** `note.flute` pitch 0.6 vol 0.8 + `note.flute` pitch 0.71 vol 0.7 after 0.4 s + `note.flute` pitch 0.56 vol 0.7 after 0.9 s + `mob.witch.celebrate` pitch 0.5 vol 0.35 after 1.3 s
- **Test:** `/scriptevent siege:sound sig.boss.mother`

Prompt:

> A woman humming three slow notes of a lullaby, gentle and warm, in a quiet wet marsh at night. On the last note a second, identical voice joins a fraction too late and slightly off pitch. Soft frogs and dripping water far in the background, roots creaking. Tender and wrong. No words, no laughter, no music.

### 14. The Warlord King

- **File name:** `boss_warlord_king` (installs as `sounds/siege/sig/boss_warlord_king.ogg`, sound id `siege.sig.boss.warlord_king`)
- **Length:** about 10 seconds, one-shot, stereo
- **When:** When the Warlord King rides onto the field in the Grand Siege.
- **Stand-in until then:** `raid.horn` pitch 0.6 + `mob.ravager.roar` pitch 0.6 vol 0.6 after 0.5 s + `block.bell.hit` pitch 0.45 vol 0.6 after 1.1 s + `raid.horn` pitch 0.45 vol 0.5 after 1.3 s
- **Test:** `/scriptevent siege:sound sig.boss.warlord_king`

Prompt:

> A warlord arriving on a battlefield at night riding a huge beast: three very heavy, slow footfalls that shake the ground, the rattle of chains and armour, a deep animal snort, then a brutal brass war horn blast answered by a distant crowd of soldiers beating weapons on shields twice. Massive, confident, martial. No music, no words.

### 15. The first glimpse

- **File name:** `first_glimpse` (installs as `sounds/siege/sig/first_glimpse.ogg`, sound id `siege.sig.first_glimpse`)
- **Length:** about 12 seconds, one-shot, stereo
- **When:** Once per world, at 3:17 on the night something walks up between the soldiers that is not one of them.
- **Stand-in until then:** `ambient.cave` pitch 0.6 + `mob.warden.heartbeat` pitch 0.6 vol 0.7 after 1 s + `mob.warden.heartbeat` pitch 0.6 vol 0.7 after 2.5 s + `block.bell.hit` pitch 0.3 vol 0.3 after 3 s
- **Test:** `/scriptevent siege:sound sig.first_glimpse`

Prompt:

> Night on a castle wall during a battle that suddenly goes quiet: the wind drops, the distant fighting fades to nothing, and in the silence come slow, even, unhurried footsteps on wet ground getting closer, with a very faint low choir note under them and one slow deep pulse like a heartbeat. It stops before anything happens. Quiet, tense, patient. No sting, no loud hit, no scream, no music.

### 16. The Forgemaster's bell-tongue

- **File name:** `bell_tongue` (installs as `sounds/siege/sig/bell_tongue.ogg`, sound id `siege.sig.bell_tongue`)
- **Length:** about 6 seconds, one-shot, stereo
- **When:** Morvane fight, stage 2: a Forgemaster's new bell rings once and the Standing Ranks break step.
- **Stand-in until then:** `block.bell.hit` pitch 1.2 + `block.bell.hit` pitch 0.9 vol 0.5 after 0.15 s + `armor.equip_iron` pitch 0.6 vol 0.6 after 0.5 s + `armor.equip_iron` pitch 0.5 vol 0.5 after 0.7 s
- **Test:** `/scriptevent siege:sound sig.bell_tongue`

Prompt:

> One clear, bright bronze hand-bell struck hard, close and present, with a pure ringing tone and a long shimmering tail that fills a stone hall. Under it, the clatter of many pieces of empty armour shifting at once, then stillness. No music, no voices. Ends in silence.

### 17. The roll of the fallen

- **File name:** `roll_drum` (installs as `sounds/siege/sig/roll_drum.ogg`, sound id `siege.sig.roll_drum`)
- **Length:** about 4 seconds, one-shot, mono
- **When:** At the Cinder Roost, when Kesh reads a name from the roll of the fallen, or a rider's dragon dies.
- **Stand-in until then:** `note.bd` pitch 0.5 + `note.bd` pitch 0.45 vol 0.4 after 0.3 s
- **Test:** `/scriptevent siege:sound sig.roll_drum`

Prompt:

> A single low, muffled skin drum struck once in a high open cliffside space with dry desert wind, a soft boom that rolls away into the distance. Solemn, not dramatic. No melody, no voices. Ends in silence.

### 18. The forty rowing

- **File name:** `forty_row` (installs as `sounds/siege/sig/forty_row.ogg`, sound id `siege.sig.forty_row`)
- **Length:** about 10 seconds, one-shot, stereo
- **When:** Morvane fight, stage 4: the drowned crews of Holt's Debt row the party down the light river.
- **Stand-in until then:** `bucket.empty_water` pitch 0.6 vol 0.5 + `bucket.empty_water` pitch 0.6 vol 0.5 after 1.5 s + `ambient.cave` pitch 0.6 vol 0.3 after 0.5 s
- **Test:** `/scriptevent siege:sound sig.forty_row`

Prompt:

> Many oars dipping together in slow unison on dark still water inside a vast cavern, wooden oarlocks creaking in time, water dripping, and a low wordless hum from many tired voices keeping the stroke. Distant, hollow echo. Uneasy but steady. No music. Ends in silence.

### 19. The fen collects

- **File name:** `fen_debt` (installs as `sounds/siege/sig/fen_debt.ogg`, sound id `siege.sig.fen_debt`)
- **Length:** about 7 seconds, one-shot, stereo
- **When:** When a Fen Mother's hexes all land at once, and at Morvane stage 6 when the fen lends the party a moment.
- **Stand-in until then:** `bubble.pop` pitch 0.6 vol 0.8 + `mob.witch.ambient` pitch 0.6 vol 0.4 after 0.4 s + `bubble.pop` pitch 0.5 vol 0.6 after 0.8 s
- **Test:** `/scriptevent siege:sound sig.fen_debt`

Prompt:

> A deep wet marsh sound: bubbles rising and bursting from thick mud, reeds rustling all at once as if a wind passed, and a slow low creak like an old wooden raft taking weight. A faint breathy whisper at the very end, no words. Uneasy, not frightening. Ends in silence.

### 20. Cinderwing: roar

- **File name:** `cinderwing_roar` (installs as `sounds/siege/dragon/cinderwing_roar.ogg`, sound id `siege.dragon.cinderwing.roar`)
- **Length:** about 2.4 seconds, one-shot, mono
- **When:** The Cinderwing's roar.
- **Test:** `/scriptevent siege:sound siege.dragon.cinderwing.roar`

Prompt:

> The voice of a large fire-breathing dragon with a deep chest and a throat like a furnace: warm, rumbling, with a crackle of embers in the breath. A full roar: starts fast, peaks, and trails off into breath. Powerful and proud, not a monster-movie scream. One animal, close and dry, no echo, no background, no music.

### 21. Ashen Wyvern: roar

- **File name:** `wyvern_roar` (installs as `sounds/siege/dragon/wyvern_roar.ogg`, sound id `siege.dragon.wyvern.roar`)
- **Length:** about 2.4 seconds, one-shot, mono
- **When:** The Ashen Wyvern's roar.
- **Test:** `/scriptevent siege:sound siege.dragon.wyvern.roar`

Prompt:

> The voice of a lean, light wyvern with a high, hoarse, hissing voice like wind through dry reeds, raspy and airy. A full roar: starts fast, peaks, and trails off into breath. Powerful and proud, not a monster-movie scream. One animal, close and dry, no echo, no background, no music.

### 22. Dune Drake: roar

- **File name:** `drake_roar` (installs as `sounds/siege/dragon/drake_roar.ogg`, sound id `siege.dragon.drake.roar`)
- **Length:** about 2.4 seconds, one-shot, mono
- **When:** The Dune Drake's roar.
- **Test:** `/scriptevent siege:sound siege.dragon.drake.roar`

Prompt:

> The voice of a heavy, broad desert drake with a very low, slow, gravelly voice like boulders shifting under sand. A full roar: starts fast, peaks, and trails off into breath. Powerful and proud, not a monster-movie scream. One animal, close and dry, no echo, no background, no music.

### 23. Glass Wyrm: roar

- **File name:** `wyrm_roar` (installs as `sounds/siege/dragon/wyrm_roar.ogg`, sound id `siege.dragon.wyrm.roar`)
- **Length:** about 2.4 seconds, one-shot, mono
- **When:** The Glass Wyrm's roar.
- **Test:** `/scriptevent siege:sound siege.dragon.wyrm.roar`

Prompt:

> The voice of a long glass-scaled wyrm whose voice is two tones at once, a fifth apart, with a ringing glassy edge, so it never sounds like a single animal. A full roar: starts fast, peaks, and trails off into breath. Powerful and proud, not a monster-movie scream. One animal, close and dry, no echo, no background, no music.

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
| `cast.bind` | Bind | `block.chain.place` pitch 0.6 vol 1.2 + `block.chain.place` pitch 0.45 vol 0.8 after 0.15 s + `random.anvil_land` pitch 1.8 vol 0.12 after 0.2 s | - |
| `cast.step` | Halfstep | `portal.travel` pitch 2 vol 0.12 + `mob.endermen.portal` pitch 0.6 vol 0.3 after 0.05 s + `chime.amethyst_block` pitch 0.6 vol 0.3 after 0.1 s | - |
| `cast.hollowstep` | Veilstep | `portal.travel` pitch 0.6 vol 0.2 + `mob.warden.heartbeat` pitch 0.8 vol 0.8 after 0.2 s + `block.bell.hit` pitch 0.35 vol 0.5 after 0.4 s | townhall (2) |
| `cast.choir` | Choir's Call | `block.bell.hit` pitch 0.4 + `block.bell.hit` pitch 0.3 vol 0.6 after 0.15 s + `ambient.cave` pitch 0.7 vol 0.3 after 0.3 s | - |
| `cast.crescendo` | A Crescendo begins | `block.bell.hit` pitch 1.6 vol 0.8 + `block.bell.hit` pitch 1.2 vol 0.5 after 0.1 s + `chime.amethyst_block` vol 0.6 after 0.2 s | townhall |
| `cast.overwhelmed` | The Choir is too loud | `mob.warden.sonic_boom` pitch 0.7 vol 0.35 + `block.bell.hit` pitch 0.3 vol 0.5 after 0.2 s | townhall |
| `cast.open` | The magic hotbar opens | `chime.amethyst_block` pitch 1.2 vol 0.5 + `item.book.page_turn` pitch 0.7 vol 0.4 after 0.05 s | townhall |
| `cast.close` | The magic hotbar closes | `chime.amethyst_block` pitch 0.8 vol 0.4 + `item.book.page_turn` pitch 0.6 vol 0.4 after 0.05 s | townhall |
| `horn.assault` | Another assault is coming | `raid.horn` pitch 0.85 vol 0.8 + `raid.horn` pitch 0.64 vol 0.35 after 0.25 s | siege |

## Reworked vanilla sounds

Whenever a script plays one of these, it comes out as the recipe on the right. The pitch and volume the script asks
for still apply on top, and every play drifts a few percent in pitch so nothing is heard twice exactly the same.

| Vanilla sound | What it means here | Made of | Places | Used by |
|---|---|---|---|---|
| `block.bell.hit` | Any bell | `block.bell.hit` + `block.bell.hit` pitch 0.5 vol 0.4 after 0.05 s + `block.bell.hit` pitch 1.03 vol 0.22 after 0.15 s | 43 | bestiary (15), undertow (15), after (5), lore (4), crown (2), roletrials, townhall |
| `random.levelup` | Done, bought, learned | `random.levelup` pitch 0.8 vol 0.5 + `note.harp` pitch 0.6 vol 0.35 after 0.1 s | 29 | horses (7), siege (5), townhall (4), lore (3), dragons (2), settle (2), crown, ironworks, reach, rivals, roletrials, undertow |
| `random.anvil_land` | A heavy blow | `random.anvil_land` pitch 0.9 vol 0.8 + `dig.stone` pitch 0.5 vol 0.7 | 13 | bestiary (3), undertow (3), siege (2), trains (2), dragons, roletrials, townhall |
| `random.orb` | A small yes | `random.orb` pitch 0.75 vol 0.55 | 12 | economy (2), townhall (2), dragons, guild, ironworks, lore, rails, roletrials, settle, undertow |
| `raid.horn` | A horn | `raid.horn` pitch 0.85 + `raid.horn` pitch 0.64 vol 0.4 after 0.25 s | 11 | bestiary (5), townhall (3), crown, dragons, rivals |
| `random.anvil_use` | Building and mending | `random.anvil_use` pitch 0.8 vol 0.55 + `dig.stone` pitch 0.7 vol 0.5 after 0.1 s | 10 | settle (3), townhall (3), siege (2), horses, roletrials |
| `mob.endermen.portal` | A step between places | `mob.endermen.portal` pitch 0.85 vol 0.8 + `random.orb` pitch 0.4 vol 0.15 after 0.1 s | 10 | bestiary (6), crown, horses, townhall, undertow |
| `ambient.cave` | Something is wrong | `ambient.cave` pitch 0.85 vol 0.8 | 9 | reach (3), undertow (3), bestiary (2), lore |
| `ui.toast.challenge_complete` | Something earned | `ui.toast.challenge_complete` pitch 0.9 vol 0.7 + `block.bell.hit` pitch 0.6 vol 0.3 after 0.4 s | 7 | siege (2), bestiary, crown, rivals, settle, townhall |
| `item.book.page_turn` | A page | `item.book.page_turn` pitch 0.9 | 7 | lore (5), bestiary, guide |
| `mob.wither.spawn` | Something old arrives | `mob.wither.spawn` pitch 0.85 vol 0.7 + `block.bell.hit` pitch 0.4 vol 0.4 after 0.4 s | 6 | undertow (3), bestiary (2), townhall |
| `dig.stone` | Stone moving | `dig.stone` pitch 0.9 | 5 | siege (3), crown, townhall |
| `random.explode` | A blast | `random.explode` pitch 0.85 | 5 | siege (3), bestiary, undertow |
| `random.glass` | Something breaks that should not | `random.glass` pitch 0.9 vol 0.8 | 5 | bestiary (4), crown |
| `random.totem` | A great change | `random.totem` pitch 0.8 vol 0.55 + `block.bell.hit` pitch 0.5 vol 0.4 after 0.2 s | 4 | townhall (2), crown, horses |
| `mob.warden.heartbeat` | A heartbeat that is not yours | `mob.warden.heartbeat` pitch 0.9 | 4 | bestiary, crown, roletrials, undertow |
| `mob.ravager.roar` | Something big | `mob.ravager.roar` pitch 0.9 vol 0.9 | 4 | bestiary (3), undertow |
| `random.break` | Not allowed, or something gave way | `random.break` pitch 0.8 vol 0.7 | 3 | bestiary, plots, siege |
| `ambient.weather.thunder` | Thunder with no sky | `ambient.weather.thunder` pitch 0.9 vol 0.9 | 3 | undertow (2), crown |
| `mob.wither.ambient` | A breath from below | `mob.wither.ambient` pitch 0.9 vol 0.8 | 3 | bestiary (3) |
| `random.toast` | A note is added | `random.toast` pitch 0.8 vol 0.7 | 2 | lore (2) |
| `random.click` | A catch or a lever | `random.click` pitch 0.85 vol 0.8 | 2 | rails, siege |
| `mob.wither.death` | Something great ends | `mob.wither.death` pitch 0.9 vol 0.8 + `block.bell.hit` pitch 0.35 vol 0.5 after 0.6 s | 2 | crown, siege |
| `random.pop` | A small pop | `random.pop` pitch 0.85 vol 0.7 | 1 | dragons |
| `portal.travel` | The Hollow pulling | `portal.travel` pitch 0.9 | 0 | - |

## Vanilla sounds played as they are

| Vanilla sound | Places | Used by |
|---|---|---|
| `block.amethyst_block.chime` | 10 | bestiary (4), undertow (4), lore (2) |
| `item.shield.block` | 4 | bestiary (3), townhall |
| `armor.equip_leather` | 3 | dragons, horses, looks |
| `mob.horse.gallop` | 3 | horses, roletrials, townhall |
| `random.eat` | 3 | dragons (2), bestiary |
| `armor.equip_iron` | 2 | guardposts, horses |
| `block.bell.resonate` | 2 | lore, undertow |
| `block.scaffolding.break` | 2 | siege (2) |
| `crossbow.shoot` | 2 | dragons, siege |
| `mob.blaze.shoot` | 2 | roletrials (2) |
| `mob.elderguardian.curse` | 2 | bestiary, undertow |
| `mob.irongolem.throw` | 2 | bestiary (2) |
| `mob.villager.no` | 2 | bestiary (2) |
| `mob.witch.celebrate` | 2 | bestiary (2) |
| `note.bell` | 2 | rails, roletrials |
| `note.flute` | 2 | bestiary, horses |
| `random.bow` | 2 | bestiary (2) |
| `random.drink` | 2 | bestiary, roletrials |
| `armor.equip_netherite` | 1 | siege |
| `block.amethyst_block.break` | 1 | undertow |
| `block.amethyst_block.resonate` | 1 | undertow |
| `block.bell.use` | 1 | lore |
| `block.campfire.crackle` | 1 | dragons |
| `block.end_portal_frame.fill` | 1 | crown |
| `block.end_portal.spawn` | 1 | undertow |
| `bucket.fill_water` | 1 | roletrials |
| `chime.amethyst_block` | 1 | roletrials |
| `dig.grass` | 1 | roletrials |
| `dig.gravel` | 1 | roletrials |
| `dig.sand` | 1 | dragons |
| `dye.use` | 1 | siege |
| `elytra.loop` | 1 | roletrials |
| `item.book.put` | 1 | lore |
| `mob.allay.idle` | 1 | roletrials |
| `mob.enderdragon.flap` | 1 | roletrials |
| `mob.enderdragon.growl` | 1 | roletrials |
| `mob.evocation_illager.cast_spell` | 1 | bestiary |
| `mob.frog.tongue` | 1 | bestiary |
| `mob.ghast.scream` | 1 | roletrials |
| `mob.horse.angry` | 1 | horses |
| `mob.horse.breathe` | 1 | horses |
| `mob.horse.idle` | 1 | horses |
| `mob.phantom.swoop` | 1 | bestiary |
| `mob.ravager.attack` | 1 | siege |
| `mob.villager.death` | 1 | bestiary |
| `mob.warden.nearby_close` | 1 | bestiary |
| `mob.warden.roar` | 1 | undertow |
| `mob.witch.ambient` | 1 | roletrials |
| `mob.wither.hurt` | 1 | roletrials |
| `mob.wither.shoot` | 1 | bestiary |
| `mob.wolf.growl` | 1 | bestiary |
| `note.bass` | 1 | dragons |
| `random.door_open` | 1 | siege |
| `random.fuse` | 1 | siege |
| `step.stone` | 1 | bestiary |

## For anyone adding code

Play sounds with `sfx()` from `scripts/core/sfx.js`, not `playSound` directly (`node tools/check.mjs` notes any that slip through):

```js
import { sfx } from "../core/sfx.js";
sfx(player, "random.levelup");                          // only that player hears it
sfx(dimension, "block.bell.hit", location, { pitch: 0.5 }); // everyone near that spot
```

A new vanilla sound works straight away and is played as it is. To rework it, or to add a named cue, add a line to
`core/sfx_cues.js` and run `node tools/sound-list.mjs`.
