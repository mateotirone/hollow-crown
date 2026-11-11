# Roof colour mix per town

Confirmed by Mateo 2026-11-11 ("i trust you") as proposed. The numbers are counts out of 10 buildings in the town (houses, shops and civic together). The block for each
colour is in the region file.

| Town | Region | Mix (out of 10) | Accent (civic only) |
|---|---|---|---|
| Kingsrest | Vale (capital) | slate 4, dark shingle 3, warm red 2, white 1 | waxed copper gradient on the capital hall, guildhall and station |
| Millbrook | Vale (village) | dark shingle 5, slate 3, warm red 2 | slate spire on the chapel |
| Rimehold | Frostmarch | dark shingle 5, mid shingle 3, slate 2 (all snow-capped) | weathered copper on the hall and stave chapel |
| Frosthelm | Frostmarch (plot) | dark shingle 6, mid shingle 4 | none |
| Gull's Rest | Saltreach | sea green 4, white 3, orange tile 2, slate 1 | oxidized copper domes, lighthouse cap |
| Mirelight | Blackfen | mossy dark shingle 5, mangrove 3, mud tile 2 | thatch on barns and stores (counts as a store's roof, not civic) |
| Sunscar | Emberwaste | flat sand roof 7, red dome or pitched 3 | blue-green domes with a gold finial |
| Hollow villages (Glimwade, Lowseam, Tollrest, Highcut) | Hollow | deepslate 8, blackstone 2 | none |
| Player settlements | the settlement's region | the region town's mix, any colours the player picks | the town hall takes the accent |

## How a builder uses it

1. Count the roofs already placed or planned in the town by colour.
2. For the new building, list the colours still under their share (share = mix x total buildings / 10).
3. Drop any colour that both neighbours on the street already have (neighbour rule, `06-roof`), and the
   majority colour if it already has 3 in a row next to this plot.
4. Pick the colour furthest under its share; ties go to the colour that differs from the building
   opposite across the street.
5. Civic buildings skip this and take the accent.

For generated towns, assign colours after placing all buildings: shuffle by a seeded hash of the town
name, then repair neighbour-rule breaks by swapping colours between non-adjacent buildings, so the final
counts match the mix exactly.
