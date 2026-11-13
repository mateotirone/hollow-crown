# The Hollow

## What the region is

A separate world that is **seeping into ours**. It is not a mirror, copy or upside-down of the overworld:
nothing there is a reflection of a place above. Players reach it through the Rift (the gate in a cave).
It is its own dimension (internal id `siege:undertow`) of about 1,400 x 2,500 blocks, with a
hand-designed centre and generated country beyond it, out to a ragged void edge. Its places:
- **The arrival and the valley spine** with the story path.
- **The light rivers:** glowing rivers that join everything, travelled in Latticewood boats.
- **Four mining villages:** Glimwade, Lowseam, Tollrest, Highcut. The Hollow has no rail lines or trains (Mateo, 2026-11-12).
- **The vault.**
- **The centre sites.**
- **The drowned city**, with its leaning towers.
- **The Drowned Court**, where Morvane is first fought.
- **The Seat** (the Heart of the Hollow), at the far end.
- **The generated country beyond:** wood, high, fen and waste.

It belongs to the **Sorcerer**: only a max-level Sorcerer can rule the Hollow and wear the Hollow Crown.
Choir Ore is mined here and smelts to Choirsteel. Gloamwings fly here. Its mood is **uneasy, never
horror**: dark, close, purple-lit, beautiful and wrong in small ways.

Only "the Hollow", "the Hollow Crown" and "Heart of the Hollow" keep the word. Don't name the Hollow
to players before the story does.

## Theme

**Dark fantasy, its own world.**
- **The look:** the buildings are their own. Dark purple-grey veinstone and blackstone, black timber with
  pale ash between, steep deepslate roofs, warm-lit windows in the miners' homes, soul light elsewhere.
- **The wrongness:** nothing stands quite straight. A whole upper storey or a roof sits one block off true,
  and the drowned city's towers lean as whole towers.
- **What it should not feel like:** a vanilla Nether or End. A miners' settlement built by people who have
  lived a long time under a stone sky.

## Land, weather and light

| | |
|---|---|
| Sky | **none**. A cave roof follows the land 30 to 50 blocks up: domes, mixed rock, hanging rock tipped with amethyst, Veilmoss curtains, basalt pillars, a Veil Rock shell above. No sun and no moon |
| Light | low and even: hidden light blocks keep it from ever going fully dark; the light rivers glow; giant Veilcap mushrooms glow; soul lanterns, ochre froglights and glimbulbs |
| Fog | purple, render-relative (#1c1230, from about half the view distance); a thicker fog during Flickers |
| Ground | mixed patches for every kind of land (Deep Veilmoss, Veilmoss variations, dark stone, pale ash), amethyst shard beds, moss strands hanging over cliff edges |
| Weather | **an eternal thunderstorm with no rain** (Mateo, 2026-11-12): thunder rolls through the stone roof all the time, and now and then a bolt strikes the land far off. It never stops and never rains |
| Sound | the endless thunder in the stone roof; the Choir singing as the story goes on |
| Feel | a stone sky, purple haze, glowing water, stillness |

Build for the dark. Light is the material here: warm froglight windows mean people, cold soul light means
everything else. The storm never rains or snows, so there are no drip lines or snow caps. Damp and age show as
cracked veinstone and moss.

Drowned and flooded places (the Drowned Court, the drowned city) show their water as channels and pools sunk a row
into the floor, walled and floored all round; never water standing on the floor players walk, which floods the room.

## Towns and paths

**Villages:**
- Mining villages sit by the light-river landings, round a pit head, with miners' homes, stores and a cart
  rail.
- The drowned city stands in the marsh by the Court landing.
- Sites at the centre are hand-placed.

**Roads:**
- **Surface:** a bottom slab made of `cobbled_deepslate_slab` 60, `polished_blackstone_brick_slab` 25 and
  `tuff_slab` 15.
- **Verges:** `coarse_dirt` and `siege:pale_ash`.
- **Signs and lights:** signposts at both ends of every road, soul lanterns at both ends of every road bridge.

**Full rules:** `build-instructions/paths/README.md`.

## Buildings

| Building | What it looks like |
|---|---|
| Miner's home | cobbled deepslate plinth, dark oak frame with pale ash infill, a steep deepslate roof, windows lit with ochre froglight (light, not glass), ladders inside; the upper storey or the roof offset one block |
| Store, pit head | veinstone bricks and blackstone, heavy and low, soul lanterns behind iron bars |
| Drowned city towers | whole towers that lean in a few clean steps, never a staircase of single-block shifts |
| Centre sites, Seat, Court | built to the story; the Crown's colours (crying obsidian, amethyst, purpur) used sparingly, only at the Seat and Morvane's sites |
| Vault | a strongroom, plain and heavy |

**From the ground up:**
- **Plinth:** cobbled deepslate 70 with `siege:veinstone` 30. The plinth never leans.
- **Stone:** veinstone bricks 74, cracked veinstone bricks 14, polished blackstone bricks 12 (HOL-02, HOL-01),
  with polished blackstone quoins.
- **Frame:** dark oak logs.
- **Infill:** pale ash (`siege:pale_ash`, HOL-03).
- **Floors:** dark oak slab field with a polished blackstone brick border.

**The crookedness rule:**
- It is a **single one-block offset** of a whole upper storey or of the roof, never a gradual shear (that
  renders jagged).
- The plinth and the ground storey stay true.
- The offset storey's posts still sit on the beam below.
- The windows move with their storey.

## Cliffs, floating rock and the way to the Seat (Mateo, 2026-11-12)

- **No straight edges.** Where the land ends it breaks off ragged: bays bitten well back, blunt spurs between
  them, single-block jags. Never a ruler line (`terrain.js` `heartEdge`).
- **Floating rock:** a ragged plate on top that tapers underneath to a point hanging off centre. Veilmoss
  strands, hollowwood roots and glimbulbs hang under it, and a soul lantern on a chain under the bigger ones.
  No two the same size or height.
- **A way across open air is walked, never jumped:** three wide, half steps (a bottom slab) at every drop, spans
  of hollowwood roots between rocks, two blocks of headroom. A self-test walks it.
- **The Seat's approach** (`hollow_arenas.py` `approach()`): the Last Step's broken gate (two pylons that do not
  match), five rocks curving to the ring's landing, broken rock adrift round it. Nothing of it stands inside
  the ring that falls in the fight (r 32 from the Seat's middle).
- **Under the Seat is the chasm** (`undertow/chasm.js`), about 70 blocks down: a pool over glimmerflow, shoals,
  falls of light springing from the cliffs, crooked crystal spires (rock below, amethyst above, one clean
  one-block step off true). Nothing in it rises above y 84. Its rim over the void is ragged too. It is not land:
  `heightAt` stays null there and a fall into it kills.
- **The Seat's cavern is closed.** Outside the pool's rim the pit is walled in: rock from the floor to the cave
  roof, at least three thick, leaning inward as it climbs until it is the roof (`chasm.js` `inWall`,
  `vaultFrom`). No void is visible from the Seat. The wall stays more than 15 blocks clear of the Seat's rock.

## Stairs, ledges and the way down from them (Mateo, 2026-11-13)

Mateo, of the first arrival ledge (a box of one block 29 by 21 and 34 high, with a strip of rock down its front
for a ramp): "use stairs whenever applicable instead of just straight blocks. I mean, it looks temporary here ...
It's one of the most important parts of the map." The rules that came out of it (`undertow/arrival.js`,
`wound.js` `planArrival`, self-tests "the arrival: ..."):

- **Every step a player climbs is a stair block.** A change of one block in a built way is a stair, facing the
  way you climb, on a solid block. Full blocks stepping down a block (or two) at a time read as unfinished.
  Slopes of natural ground are the only exception.
- **A long way down is flights and landings, never one ramp.** Eight to eleven steps, then a landing, and a turn
  at the landing. The first flight is the widest (five); the rest are three.
- **Every open side of a stair or landing has a kerb and a low wall**, left off only where rock already stands
  higher beside it. Soul lanterns stand on the wall at every turn.
- **A ledge is never a box.** Its edge is rounded and wobbles, and the rock under it falls away in short faces
  and benches of the cliff's own beds (`cragDrop`), never one sheer side and never a smooth slope.
- **A retaining wall is built like a wall of a building:** bays set back between pilasters, arch heads of
  upside-down stairs, a corbel course under the kerb, something in each bay (a hanging lantern, a shrine light).
- **No trees or landmarks within six blocks of a built way down**, and an old world has the first version's rock
  cleared before the new land is planned over it (`planArrivalClear`).

## The Wound and any wall that closes the world (Mateo, 2026-11-12)

Mateo, of a screenshot of the first Wound: "This definitely needs a lot of work." It was a crack pasted on a flat
slab of one block, 49 wide, with the void either side and above it, so the sky showed round it under a roof that
looked like a floating slab. The rules that came out of it (`terrain.js` `backWall`, `wound.js`, self-tests
"the Wound: ..."):

- **A set piece is never pasted on a bare face.** A tear, a gate or a door sits in a place made for it: a mouth,
  a throat, a chamber, a back wall. The Rift's tear is always at the back of a cave, runs from the floor to the
  roof, and opens on the black void (`planCrack` with `deep`), in the Hollow the same as on land.
- **A wall that ends the world runs right across everything a player can see and up into the roof.** Nothing a
  player can look at from a place they can stand ends in the void or the sky. Check it with rays from the
  standing places, not by eye.
- **No face is a plane and no face is one block.** The foot wanders, the top steps back in ledges, ribs of rock
  stand one to three blocks out of it, and the rock is laid in beds of mixed stone (`backRock`).
- **Look at it from where the player stands** (the arrival point, the ledge, the valley floor) before showing it,
  not only from above.
- **A change to land already built only adds rock,** so an old world can plan the chunks again over what stands
  there (`builder.js` `planAgain`), and the roof is still hung over the first land so it never moves.

## Roofs

**Shapes:**
- **Default:** steep gable, pitch 2.
- **Also:** curved roofs on halls; tall narrow roofs on towers. The roof may be the part that sits one
  block off.

**What they carry:**
- spikes along the ridge (house rule);
- chimneys of polished blackstone bricks 70 and cobbled deepslate 30, capped with a cobbled deepslate wall;
- soul lanterns at the eaves;
- Veilmoss strands hanging from old eaves.

**Colour and texture:**
- **Colours:** deepslate (`deepslate_tile` 84 with `cobbled_deepslate` 16) or blackstone
  (`polished_blackstone_brick`).
- **Mix (Hollow villages, out of 10):** deepslate 8, blackstone 2, no accent.

**How they are made:**
- Pitch 2: a stair on a full block, two up for every block in.
- Overhang 1, with an eave row and barge boards in dark oak.
- The textured surface mixes tile and cobbled deepslate at random.

## Windows, doors and details

**Windows:**
- **Miners' homes:** ochre froglight in place of glass. A warm window means a lived-in home.
- **Elsewhere:** soul lanterns behind iron bars.
- **Offset storeys:** the windows move with their storey.

**Doors and shutters:** dark oak doors; dark oak shutters on up to 1 in 4 windows.

**Details:**
- soul lanterns;
- glimbulbs (`siege:glimbulb`);
- Veilcap mushrooms;
- Veilmoss;
- glow lichen;
- amethyst shards;
- `siege:glimmerflow` along the light rivers;
- ladders (only here and in huts, towers and lofts).

## Colour and blocks (short)

| Role | Blocks |
|---|---|
| plinth | `cobbled_deepslate` 70, `siege:veinstone` 30 |
| stone | `siege:veinstone_bricks` 74, `siege:cracked_veinstone_bricks` 14, `polished_blackstone_bricks` 12 |
| quoin | `polished_blackstone`, `polished_blackstone_bricks` |
| infill | `siege:pale_ash` |
| frame | `dark_oak_log` |
| trim | `dark_oak` stairs, slabs, trapdoors; sills `polished_blackstone_brick_stairs` |
| accent (Crown) | `crying_obsidian`, `amethyst_block`, `purpur_block`, at the Seat and Morvane's sites only |
| light | `soul_lantern`, `ochre_froglight`, `siege:glimbulb` |

Full table: `build-instructions/palettes/hollow.md`; ladders HOL-01 to HOL-06:
`build-instructions/texturing/regions/hollow.md`. The Hollow's own blocks use `siege:` ids. The skill's
preview shows them as their nearest vanilla look, and the game shows the real textures.

## Trees and greenery

**Trees:** its own invented species from the tree database, Latticewood (the boat wood), Veilmoss trees and
pale ash dead trees.

**Mushrooms:** giant pink Veilcap mushroom trees that glow.

**Ground plants:** `siege:veilcap`, `siege:undertow_moss`, Deep Veilmoss, glow lichen, amethyst shard beds, moss
strands over cliffs.

**Round the foundation:** no leaf bushes (the preset plants none); glow lichen and Veilcap instead.

## Building it with the skill

- **Preset:** `hollow_timber`: dark oak frame, pale ash infill, a deepslate roof, iron-bar windows.
- **Roof:** `"roof": {"type": "gable", "pitch": 2}`.
- **The one-block offset:** `"offset": {"storey": 1, "dir": "e"}` moves the upper storey and roof one block
  as one piece; `{"roof": true, "dir": "e"}` moves only the roof.
- **Miners' homes:** swap the glass for light in the spec (`"glass": "ochre_froglight"` in the style), or
  use `place`.

```json
{"part": "house", "style": {"base": "hollow_timber", "glass": "ochre_froglight"}, "rect": [0, 0, 6, 8],
 "storeys": [5, 4], "door": {"side": "s"}, "roof": {"type": "gable", "pitch": 2, "ridge": "z"},
 "offset": {"storey": 1, "dir": "e"}}
```

- **Leaning towers:** `"lean": {"dir": "e", "steps": 2}` on a `keep` (round, `"cap": "cone"`) or a `house`:
  the whole tower leans in two or three clean one-block steps, with brackets under each step.
- **Curved roofs** on halls: `"roof": {"type": "curved"}`.

**Sites under the floor:** below y 40 the Hollow is void, so a site hung there (the Deep, `map/structures/hollow_deep.py`)
carries its own two-block shell: dressed veinstone on the inside face, `siege:veil_rock` behind it. Write no air (the void
is air already), and keep the whole site within about 60 blocks of where players enter it so it loads while it is stamped.

## Never

- **Mirroring:** nothing that mirrors or copies an overworld building or room.
- **Tone:** no horror (no gore, no jump scares), and no vanilla Nether or End look.
- **Colour:** no Crown purple, magenta or blue outside the Seat and Morvane's sites.
- **Crookedness:** no gradual shears or staircases of one-block shifts.
- **Weather and ground:** no sky or sun, no rain or snow (the thunderstorm is dry), and no snow or sand on the ground.
- **Light:** no bright white light; light here is warm froglight or cold soul light.
