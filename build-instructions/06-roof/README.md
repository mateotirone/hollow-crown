# Stage 6: Roof

The roof is the largest single surface people see from the street, from the rails and from a hill
above town. It decides more than anything whether a town looks good. Build it after the walls, in this
order: shape, pitch and overhang, the roof surface, ridges and valleys, verges and eaves, gable walls,
dormers, trusses, chimneys, colour.

## Principles

- **Roofs overhang.** A roof that stops flush with the wall looks like a lid. One block over the eaves and
  one over the gables (verge) is the default.
- **The ridge runs the long way** of each module. Odd spans give a single ridge block, capped.
- **Secondary roofs sit lower.** Wings, porches and dormers meet the main roof below its ridge.
- **Roof colour is planned across the whole town**, not chosen per house (`palettes/towns.md`).
- **Real roofs are carried.** Wide roofs show trusses inside and out where it suits the style.

## Step 1: Shape (by region and building)

Choose the roof type from the footprint with **[roof-types.md](roof-types.md)** (every roof type, the
spans and footprints it fits, where it goes in town and why). The table below is the region default.

| Region | Default | Also |
|---|---|---|
| Vale | gable, pitch 1 | cross gables, jettied gables to the street, hipped on civic, spires on chapels, domes on the capital |
| Frostmarch | gable, pitch 2 (steep, sheds snow) | tiered stave roofs, skirt roofs round halls, dragon-head finials on the gable peaks |
| Saltreach | hip, pitch 1 (low) | domes on civic, flat roof terraces on harbour houses |
| Blackfen | gable, pitch 1, mossy/thatch look | low eaves almost to the platform, turf ridges |
| Emberwaste | flat with parapet and crenels | domes, roof terraces with awnings |

**No flat roofs on houses** outside Emberwaste (and Saltreach harbour terraces on a lower wing). Flat
roofs elsewhere look unfinished in renders.

**Domes**: smooth courses, no one-cell-wide ribs (they speckle at a distance). If a dome has ribs, make
them two cells wide and a different material.
| Hollow | steep gable | the whole roof offset one block off true (never a gradual shear); deepslate |

## Step 2: Pitch, overhang, verge

- **Pitch 1**: one block up for one block in (45 degrees, plain stairs). Default.
- **Pitch 2**: two up per block in (stair on a full block). Frostmarch, chapels, towers, steep cottages.
- **Mixed (bell-cast)**: pitch 2 near the ridge, pitch 1 for the last 1 or 2 rows at the eaves, the
  flared cottage look in the style sheet. Use on cottages and halls for character.
- **Overhang** at the eaves: 1 block past the wall (2 on big halls, carried by brackets every post).
- **Verge** at the gables: 1 block past the gable wall.
- The roof starts at the wall plate (stage 2): the lowest roof row sits on the wall plate level,
  overhanging by one. No gap between the wall top and the roof (lesson from the rebuild: flat roofs must
  sit on the wall top).

## Step 3: The surface

- Stairs of the roof material on every sloped cell, facing up the slope (tall side towards the ridge).
- Steeper than a stair (pitch 2): full roof blocks under each stair (`kit.build_roofs` does this).
- Ridge (odd spans): the single centre row is a full roof block with a **bottom slab** on top (the kit's
  default), or a row of walls / a different slab as a ridge cap on stone and slate roofs.
- Hips (Saltreach and civic): rings stepping in, corners as outer-corner stairs; finial on top
  (`settle_halls.pyramid`).
- Flat roofs: the roof layer sits on the wall top; a parapet 1 high (slabs with walls at corners, or
  crenels) round it; a hatch or stair up.

## Step 4: Ridges and valleys

- Where two roofs meet at right angles (main block and wing), the lower ridge runs into the higher roof
  and the meeting line is a valley of stairs both sides; never leave a hole or a stair facing the wrong
  way at the valley (render check from above).
- The wing's ridge is at least 2 below the main ridge. Equal ridges only on symmetric cross plans
  (chapels, the capital's crossing).
- Ridge caps can be a different block (darker wood slabs, or walls on stone roofs) to draw the line.

## Step 5: Verges, barge boards, eaves

- **Verge**: the gable edge stairs. Under each verge stair, a barge board: an upside-down stair of the trim
  wood facing out (`kit.build_roofs` does this), so the edge has thickness.
- **Eaves**: along the long walls, under the overhang, a row of upside-down trim stairs tucked under the
  roof edge (`kit.eaves`), or a top slab row on stone buildings. Big halls: a cornice of 2 rows.
- At the eave corners, the barge board and eave rows meet with an outer-corner stair, no gaps.

## Step 6: Gable walls

- Fill the gable triangle after the roof surface exists (`kit.gable_walls`).
- Timber: posts carried up (centre post under the ridge, bay posts up to the roof line), infill between.
  The wall plate is the gable's bottom beam; do not lay a second beam on top of it (`kit.gable_walls` does,
  remove it). Proud frame builds: gable steps forward 1 (a jettied gable) on the street side.
- Stone: stone up to the roof line, a window on the centre line, coping of the stone's stairs along the
  top if the roof stops at the wall.
- Gables can be weatherboarded: vertical stripped logs, plank rows, or trapdoors closed on the face.

## Step 7: Dormers

- Small gabled roofs coming out of the main roof slope, 3 wide (odd), with a 1-wide window, on the bay
  centre lines of the wall below so they line up with the windows under them.
- Dormer ridge at least 1 below the main ridge. Their own verge and barge board.
- Use on 1.5-storey cottages and attic floors with living space.

## Step 8: Trusses

Where to put them:

- **Open halls, barns, chapels, the great hall, stations, markets**: inside, every 3 or 5 blocks (odd,
  lined up with the bay posts), spanning wall to wall under the roof.
- **Open gables and porches**: at the front edge of an overhanging gable or porch roof, visible from
  outside.
- **Towers and spires**: one at the base of the spire inside.

How to build one (span = inside width, odd):

```
          ^ ridge
         /S\         S = king post: an upright log under the ridge, from the tie beam to the ridge
        / | \        braces: upside-down stairs climbing from the tie beam to the king post,
       /  |  \             or stairs along the underside of the roof following the slope
  ====[===+===]====  tie beam: a log across the full span at the wall-plate height (axis across)
  P               P  wall posts the tie beam rests on
  B               B  brackets: an upside-down stair under each end of the tie beam, against the wall
```

- Spans up to 7: tie beam + king post.
- Spans 9 to 13: tie beam + king post + a brace each side (stairs or fences from the beam up to the rafters).
- Spans 15 and up: a second post each side (queen posts) or a hammer-beam: brackets coming out 2 from the
  wall, a short post on each, an arch of upside-down stairs between.
- Trusses use the frame wood (darker than the floor), and their posts line up with the posts outside.

## Step 9: Chimneys

- One chimney per hearth: houses 1, inns 2, halls 1 to 3. On a gable end or through the ridge, never on the
  low edge of a slope.
- Rises at least 2 above where it leaves the roof (`kit.chimney` puts the top at the highest roof cell + 2),
  capped with a wall block or a slab on walls, maybe a campfire (smoke) hidden in the top.
- **Chimney top (Mateo, 2026-11-11, `reference/pictures/chimney-signs-trapdoors-pot.png`)**, the default on
  houses and cottages: a column of stone (light stone bricks or the region's chimney stone) up through the
  roof; wall signs of the trim wood on all four sides of the last stone block; above it the fireplace
  block, a campfire (smoke), with open trapdoors of the trim wood round all four sides; a flower pot on
  top as the chimney pot. Wood against brick or tile roofs (spruce or oak) reads warm; dark oak on slate.
- 1 x 1 on cottages, 1 x 3 or 3 x 1 on inns and halls (odd), wider at the base where it is an outside
  breast.

## Step 10: Colour

- Read the town's roof mix in `palettes/towns.md` and the plan's chosen colour.
- **Neighbour rule**: no two buildings side by side on a street with the same roof colour, except the
  town's majority colour, and then never more than 3 in a row.
- **Civic accent**: the guildhall, capital, chapel or hall takes the town's accent colour (copper,
  stained or special) so it stands out from above.
- **Gradients** (Mateo's copper roof reference, `reference/pictures/copper-roof-gradient.png`): the colour
  changes in bands from the ridge down to the eaves, darkest/most weathered at the top, warmest at the eaves.
  - Copper: waxed copper so it never changes in game. From the ridge: waxed oxidized (teal) 2 rows,
    waxed weathered 1 to 2 rows, waxed exposed 1 row, waxed cut copper (orange) at the eaves. On short
    slopes compress to 3 bands.
  - Band edges are not ruler straight: dither each cell's band by a small hashed offset (about +/-0.04 of
    the roof height, the value that renders well), so the bands blend without looking noisy.
  - Other gradients by colour: deepslate tiles to cobbled deepslate to stone at the eaves (old slate);
    dark oak to spruce (sun-faded shingles); mangrove to moss (Blackfen turf).
- Weathering: on old buildings up to 10% of roof cells in a colour-close second block (deepslate bricks in
  deepslate tiles), never a different colour.

## Before you move on

- [ ] Shape and pitch match the region and the plan; ridge along the long side of each module.
- [ ] Overhang 1 at eaves and verges; no gap between wall top and roof.
- [ ] Valleys closed, wing ridges at least 2 lower, dormers on the window lines.
- [ ] Barge boards under verges, eave row under the overhang, corners closed.
- [ ] Gable walls filled with posts on the centre line.
- [ ] Trusses in every open hall and open gable, lined up with the posts.
- [ ] Chimneys 2 above the roof, capped.
- [ ] Colour fits the town mix and the neighbour rule; gradients blend.
- [ ] Look from above (a hill, the rails): no holes, no wrong-facing stairs.
