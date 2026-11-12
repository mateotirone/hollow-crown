# Region style guides

Mateo, 2026-11-12: every region needs one full page that explains everything about it. That means what
the region is and whether it reads as medieval, fantasy, desert or something else. It also covers the
buildings, the roofs (what they carry and how they are made), the weather, the paths and the trees.
Any build that gets a region can then read one page and know what it is meant to be.

**Read the region's page before you plan any build for it.** That applies to a house, a hall, a wall, a
landmark or a whole town. The page tells you what to build. The detailed block tables it links to (the
palettes, texturing ladders, paths and stage files in `build-instructions/`) tell you which blocks to use.

| Region | Feel in one line | Towns and plots | Page |
|---|---|---|---|
| Aldmere Vale | English and Norman medieval heartland: plaster and timber, grey stone, slate | Kingsrest (the spawn town), Millbrook; plots Harrowford, Oakmere, Thistledown, Wrenfield; Crownhold ruins | [vale.md](vale.md) |
| Frostmarch | Norse cold north: dark logs, plank walls, steep snowy shingle roofs, stave halls | Rimehold, Frosthelm; plots Frosthelm, Wolfcairn; Deepforge | [frostmarch.md](frostmarch.md) |
| Saltreach | Wind-bleached harbour coast: pale stone, whitewash, sea-green hipped roofs, painted shutters | Gull's Rest; plots Gullcliff, Tidewatch | [saltreach.md](saltreach.md) |
| Blackfen | Black-water marsh: stilt houses of mangrove and mud brick, mossy low roofs, froglight glow | Mirelight; plots Reedmoor, Lanternbog | [blackfen.md](blackfen.md) |
| Emberwaste | Red desert, the dragon region: kasbah sandstone, flat parapet roofs, domes, striped awnings | Sunscar; plots Redmesa, Dunehold; Cinder Roost | [emberwaste.md](emberwaste.md) |
| The Hollow | A separate world seeping into ours: veinstone and black timber, steep deepslate roofs, things one block off true | Glimwade, Lowseam, Tollrest, Highcut, the centre sites, the drowned city | [hollow.md](hollow.md) |

## What every page covers

1. **What the region is**: where it sits on the map, its story, its towns, its role, its mood.
2. **Theme**: the real-world look it borrows from and how far it leans into fantasy.
3. **Land, weather and light**: the ground, the weather the world gives it, the light and fog.
4. **Towns and paths**: how settlements sit, their streets and their path surfaces.
5. **Buildings**: the kinds of building and what each one looks like, from the foundation up.
6. **Roofs**: what shape they are, what they carry and how they are made, block by block.
7. **Windows, doors and details**: the small things that make a building read as this region.
8. **Colour and blocks**: the short palette, with links to the full tables.
9. **Trees and greenery.**
10. **Building it with the skill**: the preset to start from, a spec to copy, the parts that fit, and
    what the skill cannot do yet.
11. **Never**: the mistakes that break the region's look.

## Rules for every region (house rules, short)

These rules hold in every region unless the region's page says otherwise. They are in
`reference/house-rules.md` and `build-instructions/`.
- **Sizes:** odd sizes, storeys 4 or 5 high.
- **Roof surface:** every roof textured with two blocks of the same colour (copper keeps its gradient),
  back-to-back stairs along the ridge, and spikes along the ridge.
- **Spires:** the add-on's spire top block, never on a slab.
- **Chimney and interiors:** Mateo's chimney; interiors empty except the inn.
- **Overhangs and shutters:** every overhang carried; shutters on at most 3 in 10 windows.
- **Tone:** uneasy at night, never horror and never vanilla.

## Where the facts come from

These pages draw on the following sources. Each page names its own.
- **Blocks and textures:** `build-instructions/palettes/*.md`, `build-instructions/texturing/regions/*.md`
  (colour ladders), `build-instructions/paths/README.md` and the region notes in the stage files `00`
  to `07`.
- **Built buildings:** `map/structures/regions_towns.py` (the four outer towns as built), `map/genworld.py`
  (land, biomes and weather) and `map/draw_map.py` (where the regions and plots are).
- **Story and design:** `LORE-BIBLE.md`, the design doc, and the tree database (`map/trees`).

When a fact changes, change it at its source, then here.

## Open questions and conflicts (2026-11-12)

These turned up while the pages were written. Mateo decides; until then the pages follow the default
given here.

- **Weather is the world's normal biome weather.** The Vale and Saltreach get rain, Frostmarch gets snow,
  the Emberwaste never rains, and Blackfen has its own dark fog under water only. There is no custom
  weather such as fen mist in the air, sea wind or sandstorms. The Hollow has no weather.
- **Gull's Rest, the harbour town, has no water inside its town area**, so its quay, lighthouse and
  boathouse are not placed (towns thread).
- **Saltreach has two looks**: the Mediterranean and Atlantic harbour town, and the English chalk cliffs
  Mateo asked for on its northern coast. The pages keep both: the cliffs are land, the town is the
  harbour style.
- **Flat roofs**: the house rule "no flat roofs on houses" does not apply to the Emberwaste (flat is its
  default) or to Saltreach terraces on a lower wing.
- **Still missing from the skill**, so it is built by hand (`place`) for now:
  - the Hollow's one-block storey offset;
  - Blackfen stilts and boardwalks;
  - Frostmarch snow caps and dragon heads;
  - domes on drums;
  - mossy and thatch roofs.

