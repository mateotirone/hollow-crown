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
- **Bushes round the foundation** (Mateo, 2026-11-12): clumps of the region's leaves under the ground-floor
  windows and at some corners, never a strip; on by default in the skill (`bushes`), none in the Emberwaste
  and the Hollow.
- **Dormers:** their roof stairs face down the main slope, and a bracket either side of the window carries
  the dormer roof's overhang (mud brick wall in Blackfen). Every overhang is carried.
- **Lean-tos** take their house's roof colour (a teal lean-to on an orange roof looks wrong); the skill's
  `lean_to` now follows the last house's roof unless given `roof`.
- **Narrow plots:** a window box's front sign can stick out past the roof verge on a side wall. On Medium
  plots (11 wide) keep the box and drop the sign face on the side walls (`"box_signs": "ns"` in the style
  keeps it only on the north and south walls).

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

- **Region weather** (PR #193, not merged yet): on top of the biome weather, Blackfen gets fen mist and
  marsh lights, Saltreach sea wind and sea fret, the Emberwaste dust wind and sandstorms, Frostmarch
  flurries and blizzards, the Vale morning mist; the Hollow has an eternal thunderstorm with no rain. Each page's weather table has the
  details. For builders: deep eaves, porches, covered walkways and wind-breaks matter in the Emberwaste and
  Frostmarch; lanterns that show through fog matter in Blackfen and Saltreach.
- **Gull's Rest, the harbour town, has no water inside its town area**, so its quay, lighthouse and
  boathouse are not placed (towns thread).
- **Saltreach has two looks**: the Mediterranean and Atlantic harbour town, and the English chalk cliffs
  Mateo asked for on its northern coast. The pages keep both: the cliffs are land, the town is the
  harbour style.
- **Emberwaste roofs** (decided by Mateo, 2026-11-12): plot buildings all flat; Sunscar keeps its towns
  mix of 7 flat and 3 red pitched or domed roofs.
- **Flat roofs**: the house rule "no flat roofs on houses" does not apply to the Emberwaste (flat is its
  default) or to Saltreach terraces on a lower wing.
- **Now in the skill** (2026-11-12): the Hollow's one-block offset (`offset`), Blackfen stilts and piles,
  Frostmarch snow caps (`snow`) and dragon heads (`gable_horns`), domes on drums (`dome`), mossy and thatch
  roofs (`moss`, `thatch`). Still by hand: Blackfen boardwalks, Hollow leaning towers, curved roofs.

