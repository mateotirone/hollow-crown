# Stage 8: Interiors

## Every building is furnished (Mateo, 2026-11-12)

Mateo, 2026-11-12: interiors in every building. This replaces the old rule (2026-11-11) that left
everything empty except the inn and custom builds. Every house, shop, civic building, town hall, plot
building, tower and later building gets a finished inside that fits what it is for.

The building skill does it as a stage of its own, so every region and every build gets the same rules:
`.claude/skills/minecraft-builder/scripts/interiors.py`, run at the end of the `house` part (engine stage
`interior`, after `details`). Give the house part an `interior` key; without one it is furnished as a home.

```json
"interior": "inn"
"interior": {"use": "townhouse", "attic": true}
"interior": {"use": "shop", "rooms": ["shop", "bedroom"], "region": "saltreach"}
"interior": {"use": "inn", "furnish": false}          // stairs and light only; the build furnishes itself (the Kingsrest inn)
"interior": false                                      // shell only (an open market hall, a ruin)
```

For a building not made by the `house` part (a tower from shapes, a hall by hand), use the `interior` part
with its levels: `{"part": "interior", "use": "tower", "region": "vale", "levels": [{"rect": [x0, z0, x1, z1], "floor_y": 3, "height": 5}]}`
(`rect` is the room inside the walls, `floor_y` the floor block's row).

## Uses: what each storey holds

The use names the rooms storey by storey, ground first; the last one repeats upward. `rooms` overrides it.

| Use | Ground | Above | Attic (`"attic": true`) |
|---|---|---|---|
| home | living room | bedroom | (next room in the list) |
| cottage | living room with a bed | | |
| townhouse | living room | bedroom | bedroom |
| farmhouse | farm kitchen | bedroom | |
| inn | tap room | guest rooms | |
| mint | counting room | store | |
| shop | shop | bedroom | |
| smithy | smithy | bedroom | |
| guildhall | hall | office | |
| hall / capital | hall | council room | |
| chapel | nave | | |
| tower | guard room | store | lookout |
| mill | mill floor | store | |
| barracks | guard room | bunks | |
| library | library | library | |
| storage, stable | store / stable | | |
| storehouse | chest store | chest store | chest store |

A building with wings: each block's storey is its own room (a wing gets its own long table, its own
hearth), while the walkway is checked across the whole floor.

### The chest store (Mateo, 2026-11-13)

`"interior": {"use": "storehouse", "pillar": "stone_bricks", "beam": "stone_bricks"}` (the Storehouse): chests turned
sideways (facing along the wall, so you see their side; side by side along their own facing they never join into
double chests) in 3 x 3 bays between pillars of the region's stone, with a beam of stone over each bay. Neighbouring bays
share a pillar, so a wall run of 4n + 1 holds n bays. A bay goes only on a blank wall (no glass or door behind it), keeps
clear of the stairs and the door, and keeps every chest front on the walkway. Rooms 11 or more wide also get free-standing
racks 3 in from each long wall, open both sides, with cross aisles at the ends. A roof's tie beam over a bay is its beam.

## The rules the skill follows

### Step 1: Stairs between every storey

- A straight flight along a wall: as many stairs as the storey is high, the top step in the floor above,
  the floor above cut over the rest for headroom (`up_stair` in the old builders).
- It hugs one wall all the way, keeps off windows, stays one cell clear of the door, and leaves the
  chimney breast free for the hearth.
- The well on the upper floor is guarded with a fence along its open side.
- Where no flight fits (a narrow tower), a ladder against a blank wall with a hole above.
- **A roof you walk on is reached** (Mateo 2026-11-13, the air boat mast: "how do you get up to the top?"): a
  tower with a flat top players use (a mooring deck, a lookout, a belfry deck) gets a ladder from its top storey
  up through a closed top trapdoor hatch in the roof: `"interior": {"use": "tower", "hatch": true}`.
- An attic (`"attic": true`) gets a floor on the wall plate wherever two rows of air stand over it, and the
  stair comes up into it.

### Step 2: The walkway (one block, everywhere players walk)

- A piece of furniture is kept only if, with it in place, every open floor cell can still be reached from
  every other: the door's inside cell, both ends of every stair, and the front of every bed, chest and work
  block stay open and joined.
- A nook of one or two cells may close off behind furniture; anything bigger never does.
- Furniture stands along the walls; tables stand on a grid four apart (table, chairs, walkway) so there is
  always a path between them.

### Step 3: Rooms

| Room | Centre piece | Along the walls | Light |
|---|---|---|---|
| Living room / farm kitchen | table with chairs | hearth (against the chimney breast if the chimney is inside), crafting table, barrels, chest; smoker, composter, cauldron in the farm kitchen | lanterns |
| Bedroom / guest rooms / bunks | rug | beds head to the wall, never side by side, a chest beside each head; bookshelf, lectern | lanterns |
| Tap room | tables on the grid | the bar across the end wall facing the door (stripped logs on their side, barrels behind), the hearth | lanterns, the hearth |
| Shop / counting room (mint) | | counter across the end wall, barrels and chests behind; the mint adds chests, an anvil, a furnace and a lectern | lantern |
| Smithy | | hearth as the forge, anvil, grindstone, smithing table, blast furnace | the forge glow |
| Hall / council | long table on the long axis, chairs every other cell, a seat at each end | hearth, lecterns, bookshelves, cartography table (council) | chandeliers: lanterns on chains from the trusses |
| Nave (chapel) | aisle on the centre line from the door with a runner | pews (stairs) in rows either side, every other row; the altar on a stone dais at the far end, candles | candles, lanterns |
| Guard room / lookout / store | table (guard room) | barrels and chests, grindstone, cartography table (lookout) | lanterns |

### Step 4: Furniture is built the way builders build it

- Table = fence + pressure plate (Emberwaste: a low table, a trapdoor on its top half).
- Chair = stair facing away from the table; pew = a row of stairs facing away from the altar.
- Bar = stripped log on its side; hearth = campfire between stone cheeks under a mantle slab and a hood of
  upside-down stairs (no hood where the storey is too low or the attic floor is above).
- Tall pieces (bookshelves two high) never stand in front of a window; nothing floats.
- Rugs: a border colour round a field colour, at most 9 x 9 (a runner along a long hall), on open floor only.
- Lanterns hang from whatever is overhead on a grid about 4 apart, never lower than two blocks over the
  floor, with a chain down in tall rooms; never over a stair or a well.

### Step 5: Region flavour

| Region | Wood | Rug | Light | Hearth stone | Extras |
|---|---|---|---|---|---|
| Vale | spruce, dark oak tables | red on brown | lantern | stone bricks | flower pots, barrels, books |
| Frostmarch | spruce, dark oak | white on brown (furs) | lantern | deepslate bricks | barrels, smokers, long hearth tables |
| Saltreach | birch | light blue on white | lantern | smooth sandstone | maps (cartography table), sea chests |
| Blackfen | mangrove | green on brown | lantern | mud bricks | jars (decorated pots), cauldrons, plants |
| Emberwaste | acacia | orange on red | lantern | sandstone | cushions (wool), low tables, pots |
| The Hollow | dark oak | grey on black | soul lantern | polished blackstone bricks | candles, books, pots |

The stair and furniture wood follows the building's floor wood where it has one.

## Hand-furnished builds

The Kingsrest coaching inn and the Citadel keep were furnished by hand before this stage existed
(`map/structures/review/kingsrest_inn.py`, `citadel.py keep_interior`). They keep their own furniture; the
inn takes `"furnish": false` so the skill adds only its stairs and light. Story sites and boss rooms that
are gameplay spaces lay out their own insides.

The Barracks (2026-11-12, `map/structures/barracks_skill.py`) is furnished by its own builder too: a mess with a
long table, grindstone and smithing table on the hall's ground floor, bunks (beds and chests) above, barrels and
a fletching table in the keep, and in the walled yard a campfire with benches, a trough, straw targets and a clear
middle where off-duty soldiers wait (marks `yard_a`, `yard_b`, `muster`).

## Look at it

Every interior is checked in a cut-away 3D view before it is shown:
`python3 map/structures/build_interiors_viewer.py OUT --textures <bedrock textures/blocks>` builds the
3D viewer with Roof off, Ground floor, Floor 2 and Attic buttons and a cut slider.

## Before you move on

- [ ] Every storey reached by a stair or ladder, the well guarded; a walked-on roof reached through a hatch.
- [ ] A one-block walkway from the door to every room, stair end, bed, chest and work block.
- [ ] Each room has its centre piece, wall pieces and light; nothing floats or blocks a window. In a hand-drawn design
      the floor block is y 0, so furniture starts at y 1: check one column of the room before placing anything.
- [ ] Every ladder hangs on a solid block behind it (check the cell its facing points away from), right under its hatch.
- [ ] Region woods, rugs and lights; nothing sits on a stair, a well or in a doorway.
