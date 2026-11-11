# Stage 8: Interiors

## Default: empty

Mateo, 2026-11-11: "Leave the interiors for everything else empty. The players can fill those
themselves." Every house, shop, civic building, town hall, plot building and later building is
**empty inside** unless it is the inn or the plan marks it **custom**.

An empty interior still has:

- the floors from stage 3 (border and field),
- stairs or ladders between every storey, with guarded stair wells,
- the trusses, joists and beams (they are the structure, not furniture),
- hidden light so mobs do not spawn (light blocks under carpets, or a lantern hung from a beam per room),
- the working piece a plot building exists for, where gameplay needs it (forge in the smithy, stalls in the
  market, shelves in the library, as in `settle_buildings.py`),
- nothing else: no beds, tables, chests or decoration.

## Custom builds and the inn

Custom builds (the inn, story sites, the capital's main rooms, anything the plan marks custom) get a
full interior. Plan it in stage 0 with the level plans, then build it here.

### Step 1: Rooms and circulation

- Every room is an odd rectangle inside the walls, so furniture can centre on the room.
- A clear walking path at least 1 wide (3 in halls and the inn's main room) from the door to the stairs
  and to every room's door. Furniture never blocks it.
- Internal walls: frame and infill like the outside walls but thinner looking (the frame wood with plank
  or plaster infill), with door openings on the path.

### Step 2: Zones per room

| Room | Centre piece | Along the walls | Light |
|---|---|---|---|
| Inn main room | hearth on the end wall (fireplace 3 wide) | tables (fence/slab or trapdoor-sided stairs as benches) in an odd grid, the bar counter (top slabs on barrels or planks) facing the door | lanterns hung from beams, the hearth |
| Bedroom | bed against a wall, head to the wall, centred | chest at the foot, a window seat, a lectern or shelf | a lantern or candle |
| Kitchen | table in the middle | smoker/furnace in the chimney breast, barrels, cauldron, hanging cured goods | lantern |
| Great hall | long table on the centre line, throne or high seat on a dais at the far end | banners between windows, benches | chandeliers (chains and lanterns) from the trusses |
| Chapel | aisle on the centre line, altar at the far end on a step | pews (stairs) in rows, odd number of rows | candles, stained light from windows |
| Shop | counter across the room facing the door | shelves of goods behind (barrels, chests, item frames) | lantern over the counter |
| Workshop / smithy | the working block (anvil, forge, loom...) | tools on walls (item frames), material piles | lanterns, the forge glow |
| Storage | aisle through the middle | barrels and chests stacked to 2 high | lantern |

### Step 3: Furniture rules

- Furniture is built from shapes: stairs (chairs, benches), slabs on fences or trapdoor-sided blocks
  (tables), trapdoors (cupboard fronts, chair arms), banners and carpets (cloth), flower pots.
- Nothing floats: tables on legs, shelves on brackets, chandeliers on chains to a beam.
- Rugs: carpets in the region's colours, centred on the room, a border colour round the edge on big rugs.
- Every room has a window or a light; every bed has a chest.
- Region flavour: Frostmarch furs (white and brown carpets) and long hearth tables; Saltreach nets, maps
  and sea chests; Blackfen jars and drying herbs; Emberwaste cushions (wool) and low tables; Hollow
  pale ash and soul light, a little off-true.

## Before you move on

- [ ] Standard builds: empty except floors, stairs, structure, hidden light and the building's working piece.
- [ ] Custom builds: odd rooms, a clear path from the door to every room and the stairs.
- [ ] Each room has its centre piece, wall pieces and light; nothing floats or blocks a path.
