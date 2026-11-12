# The Hollow

## What the region is

A separate world that is **seeping into ours**. It is not a mirror, copy or upside-down of the overworld:
nothing there is a reflection of a place above. Players reach it through the Rift (the gate in a cave).
It is its own dimension (internal id `siege:undertow`) of about 1,400 x 2,500 blocks, with a
hand-designed centre and generated country beyond it, out to a ragged void edge. Its places:
- **The arrival and the valley spine** with the story path.
- **The light rivers:** glowing rivers that join everything, travelled in Latticewood boats.
- **Four mining villages:** Glimwade, Lowseam, Tollrest, Highcut. A cart rail runs from Cartmeet to the Seams.
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

**Not in the skill yet:**
- **Leaning towers:** whole towers in a few clean steps.
- **Curved roofs.**

## Never

- **Mirroring:** nothing that mirrors or copies an overworld building or room.
- **Tone:** no horror (no gore, no jump scares), and no vanilla Nether or End look.
- **Colour:** no Crown purple, magenta or blue outside the Seat and Morvane's sites.
- **Crookedness:** no gradual shears or staircases of one-block shifts.
- **Weather and ground:** no sky or sun, no rain or snow (the thunderstorm is dry), and no snow or sand on the ground.
- **Light:** no bright white light; light here is warm froglight or cold soul light.
