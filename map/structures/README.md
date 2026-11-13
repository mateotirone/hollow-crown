# Map structures

Buildings for the map are written as code, not built by hand and not made by
text-to-3D tools (which give wavy walls and wrong-size doors). Each region gets
parametric builders that follow the rules good Minecraft builders use; every
build is checked in a render with Mojang's real Bedrock textures before anyone
reviews it. Research behind this: https://claude.ai/artifact/SLVb4v5eoLULb6btyfFcmf

| File | What it is |
| --- | --- |
| `bp.py` | Blueprint grid, Bedrock state checks, `.mcstructure` and stamp-JSON writers |
| `bedrock_states.json` | Every vanilla block and its states, trimmed from Mojang's `bedrock-samples` metadata |
| `kit.py` | Building parts: stone and timber storeys, jetties, windows, doors, roofs from a height field, chimneys, palettes |
| `vale.py` | Aldmere Vale buildings (coaching inn, town house generator) |
| `build_kingsrest_proof.py` | The proof build: Kingsrest inn plus a street of houses |
| `render/` | Preview renderer: `mesher.py` (real block shapes, face culling, ambient occlusion), `viewer.tpl.html` (three.js page), `shoot.cjs` (headless screenshots) |

## Outputs

Each building is written as `<name>.mcstructure` (load with `/structure load` or
the script API's `world.structureManager`) and `<name>.stamp.json`
(`palette` + `blocks` as `[x, y, z, palette index]`, offsets from `origin`).
y = 0 is the ground surface; cells not listed are left as they are. Town
blueprints use vanilla blocks only, so the world writer can stamp them.

## Rebuild the proof and its previews

Needs Mojang's textures (not in this repo) and three.js 0.170.0:

    git clone --depth 1 --filter=blob:none --sparse https://github.com/Mojang/bedrock-samples.git
    (cd bedrock-samples && git sparse-checkout set --no-cone 'resource_pack/textures/blocks/**')
    npm i three@0.170.0
    python3 build_kingsrest_proof.py out --render --dusk \
        --textures bedrock-samples/resource_pack/textures/blocks --three node_modules/three

`out/viewer.html` is a self-contained 3D viewer; `out/shot-*.png` are the renders.

## Needs an in-game check

- Trapdoor `direction` numbers (shutters) are mapped as 0 east, 1 west, 2 south, 3 north.
- Footprints over 64 x 64 should be cut into tiles for `/structure load`.

## Building catalogue

    python3 build_catalogue.py OUT --textures <bedrock-samples>/resource_pack/textures/blocks --three <node_modules/three>
    python3 render/catalogue_page.py OUT catalogue.html

One picture per design per style plus catalogue.json (size, floors, blocks, map spot). Add every new design to DESIGNS in build_catalogue.py.

## Generated towns and villages (`towngen.py`)

Towns that fit the ground instead of a fixed layout. Given the circle a town owns, the generator
reads the real heights (from `terrain_slice.py`), lays the paths first, then drops buildings,
fields and windmills around them:

1. **Square** on the flattest ground near the middle (or where the map already put it), lumpy
   rather than round.
2. **Streets**: the map's roads become main streets (5 wide) running in to the square; lanes
   (3 wide) branch off and sometimes loop back into another street. Every route comes from a
   slope-aware path search, so streets wind along the contours. Over water a street becomes a
   raised stone deck on piers.
3. **Sunken paths**: the walking surface is a bottom slab where the ground's top block would be,
   so every building (on a full block) and every verge is half a block up. Path heights change
   at most half a block per block walked (slab, block, slab...), so nobody jumps. Every paving
   block has a slab (cobble, mossy cobble, stone brick, andesite, tuff brick, mud brick).
4. **Buildings** by size: tall town houses and civic buildings round the square, cottages
   further out, barns at the edge. Each turns its door to the street; a walkway runs from the
   door step (half a block under the floor) to the path, with a stair only where it must climb
   a whole block. The floor height balances digging in against building up; the low side gets a
   stone foundation as deep as the slope needs and the ground is eased back round it.
5. **Land portions** (Mateo, 2026-11-11): every patch of land boxed in by paths (a back lane
   rings the middle of town so the streets enclose land) is decided as a whole. Near the square
   and small: a **build portion**, plots round its edge facing the paths, free ground in the
   middle. Big and further out: a **field portion**.
6. **Fields**: a crop on every block of a field portion, on the ground as it lies. Water goes
   into the ground level by level: for each height, water blocks at that height are added (a
   9-block lattice first, then wherever crops are still dry) until every crop on that level is
   within 4 blocks of one. Water never sits beside a lower block (it would spill); a crop no
   water can reach on its level becomes a grass headland. Field portions over 900 blocks get a
   **windmill** near the centre; big fields get fenced tracks cut across them (placeholder
   fence until the field fencing system is designed). Stalls, a well or market cross and lamps
   on the square; lamps and trees along the streets.

`towngen_build.py` has the buildings: cottages (front-gabled with optional jetty, side-gabled,
L-shaped with a forward wing, hipped), barns, windmills, a well and a market cross, and the
roof palettes (slate, dark oak, spruce, red mangrove, brick, and Mateo's waxed copper gradient:
oxidized green at the ridge through weathered and exposed to bright copper at the eaves).

    python3 terrain_slice.py MAP_DIR x0 z0 size slice.npz
    python3 towngen.py "Alder Combe" slice.npz MAP_DIR/lines.json OUT --render \
        --textures bedrock-samples/resource_pack/textures/blocks --three node_modules/three

Sites live in `SITES` (or pass `x,z,radius,town|village`). Outputs: `<site>-plan.json` (stamps
with rotation, same convention as `town.py`), `<site>-groundwork.json` (every non-building block
the town changes, world coordinates; apply before the stamps), `stamps/*.json`, a plan picture
and a preview scene.

### Region towns (towngen_regions.py)

`python3 towngen_regions.py rimehold|gulls_rest|sunscar|mirelight slice.npz lines.json OUT --trees TREEDB/trees.json --trees-src TREES_DIR`
lays out the four region towns with the regions_towns.py builders (HOUSES, CIVIC, SHORE, BOARDWALK,
assign_roofs) on top of the towngen pipeline. Run slice_heights.py on the slice first so it plans on the
world's pre-town ground. Shore buildings (quay, boathouse, stilt houses) go on land cells next to water,
facing away from it, with a footpath to the street; Mirelight decks over water become mangrove boardwalk.
Besides the usual outputs it writes `<key>-blocks.json` (hollow-crown-worldblocks/1, the same format as
Kingsrest's), which genworld stamps through GW_BLOCKS. towngen.py writes the same file for named towns.

### Settlement layouts (towngen_settle.py)

`python3 towngen_settle.py PLOT slice.npz lines.json OUT [--templates crossroads,twin_rings,market_street] [--tries 3]`
lays out a player settlement on one of the 12 map plots (slice: `terrain_slice.py` of the 161-wide square
centred on the Plot Stone). It is the town pipeline plus the settlement rules agreed with the
building-placement thread:

- The wall grows: Hamlet r36, Town r46, City r56, Castle r66 (was 32/40/48/56; --walls tries others). A slot opens once its whole box is within
  wall - 3, and never before the road its walkway reaches.
- Ring lanes may sit on the old wall lines at r36 and r56 only (templates choose the arcs); they open the
  tier after the wall leaves them.
- The ground every town hall level takes (drawHall bounds per region, from the Hall Cornerstone 5 ahead,
  plus 2) is kept free of roads from the start, and of slots up to level 4; slots may sit on level 5's extra ground (tag hall5).
- Slots are odd boxes, width along the door side x depth (Small 9x13, Medium 11x15, long Medium 13x15,
  Large 15x15, Great 21x21; Large and Great up to 2 longer either way) facing a road, with
  floor height (the highest ground block in the box; stone foundation below, never cut in, so
  "foundation" is its tallest column; within a block of every path beside it), walkway, tags (library, hall, hall5 = on ground the level-5 hall takes back, tall_foundation = 4+ blocks of foundation, square, road_front, wall, gate, corner, field_edge, water) and opensAt.
- Fields are whole portions (about 10% of the land, at least one) whose crop area grows with the wall,
  watered level by level as in towns.

Output `<plot>.json` (format `hollow-crown-settlement/1`): per variant `slots`, `fields`, `hall` boxes per
level, `rings`, `gates` per tier, `fixtures`, `roads` rows `[dx, dz, y, slab|full, kind, tier]` and
`groundwork` rows `[dx, y, dz, palette, tier]` (place a tier's rows when it opens), all relative to the
Plot Stone on world axes, y absolute. Plus `<plot>-<template>.png` plans coloured by opening tier.

### Works plot machines (export_machines.py)

`python3 export_machines.py` writes the Ironworks (ironworks/spec.py, every region, three stages) to
`Siege_Nights_BP/scripts/ironworks/designs_data.js` for the town's Works plots (size letter `W`, 27 wide along the
road x 17 deep: the 25 x 15 yard plus a block all round for the eaves). Stage 1 is the whole plot; stages 2 and 3
hold only what changes. The game seats it on a slot like any plot building (settle/buildings.js `addWorks`).
The Gold Sluice and Deep Shaft go into `MACHINES` the same way once their game code exists.
