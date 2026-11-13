# Build catalog

<!-- Generated from builds/catalog.json by node tools/build-catalog.mjs. Edit the JSON, not this file. -->

Every build in The Hollow Crown, designed or not. Add an entry the moment a build is asked for, even with no design yet, and move its status on as it progresses. Run  node tools/build-catalog.mjs  after editing to rewrite builds/CATALOG.md (check.mjs fails if it is stale).

**107 builds:** 1 not started, 26 designed, 15 in viewer, 65 in game.

Statuses:

- **not started**: asked for, nothing drawn yet
- **designed**: a design, spec or render exists (Claude Doc, hosted 3D page, or code on a branch), but not in the local asset viewer from main
- **in viewer**: a builder on main shows it in the asset viewer (localhost:4747), not yet placed by the game
- **in game**: the game (or the world map) places it

A ★ marks builds that no earlier list had (added in the 2026-11-12 audit).

## Map towns

| Build | Region | Status | Viewer | Owner thread | Source | Notes |
|---|---|---|---|---|---|---|
| Kingsrest capital hall | Aldmere Vale | in game | map | Refine every building, region by region | `map/structures/capital.py` | Waiting in PR #205. Rebuilt on the skill (review/specs/kingsrest_capital.json), Mateo has reviewed it; PR #205. The game still has the old hall until it merges. |
| Kingsrest street house | Aldmere Vale | in game | map | Refine every building, region by region | `map/structures/review/kingsrest_house.py` | Refinement round 1 done; moving onto the building skill (PR #168 specs). |
| Kingsrest coaching inn | Aldmere Vale | in game | map | Refine every building, region by region | `map/structures/review/kingsrest_inn.py` | The only furnished building. Refinement round 2 done. |
| Kingsrest guildhall | Aldmere Vale | in game | map | Refine every building, region by region | `map/structures/review/kingsrest_guildhall.py` | Waiting in PR #205. Rebuilt on the skill (review/specs/kingsrest_guildhall.json, gen_guildhall.py), Mateo has reviewed it; PR #205. |
| Kingsrest chapel | Aldmere Vale | in game | map | Refine every building, region by region | `map/structures/build_catalogue.py` | Waiting in PR #205. Rebuilt on the skill (review/specs/kingsrest_chapel.json, gen_chapel.py), Mateo has reviewed it; PR #205. |
| Kingsrest station (where the lines meet) | Aldmere Vale | in game | map | Refine every building, region by region | `map/structures/build_catalogue.py` | Still on the old stations.py builder; next in the one-by-one pass (2026-11-12). |
| Vale town houses (4 types) (4) | Aldmere Vale | in game | map | Refine every building, region by region | `map/structures/build_catalogue.py` |  |
| Millbrook clock tower | Aldmere Vale | in game | map | Refine every building, region by region | `map/structures/vale_civic.py` | Also the Reeve's boss unlock (six clocks round the square). |
| Millbrook watermill | Aldmere Vale | in game | map | Refine every building, region by region | `map/structures/vale_civic.py` |  |
| Region town houses (Rimehold, Gull's Rest, Sunscar, Mirelight) | One version per overworld region | in viewer | town-* | Procedurally generate terrain-aware towns | `map/structures/regions_towns.py` | Waiting in PR #163. Stamped into the map once PR #163 lands and the map thread restamps. |
| Rimehold longhouse hall | Frostmarch | in viewer | town-rimehold | Procedurally generate terrain-aware towns | `map/structures/regions_towns.py` | Waiting in PR #205. Rimehold set (longhouse hall, stave chapel, inn, smithy, store, byre, town houses) rebuilt on the skill, review/specs/gen_rimehold.py; PR #205, awaiting Mateo's notes. |
| Rimehold stave chapel | Frostmarch | in viewer | town-rimehold | Procedurally generate terrain-aware towns | `map/structures/regions_towns.py` | Waiting in PR #163. |
| Region town inns (4) (4) | One version per overworld region | in viewer | town-* | Procedurally generate terrain-aware towns | `map/structures/regions_towns.py` | Waiting in PR #163. Sunscar's is a caravanserai. |
| Region town smithies and general stores (8) | One version per overworld region | in viewer | town-* | Procedurally generate terrain-aware towns | `map/structures/regions_towns.py` | Waiting in PR #163. |
| Sunscar market hall | Emberwaste | in viewer | town-sunscar | Procedurally generate terrain-aware towns | `map/structures/regions_towns.py` | Waiting in PR #163. |
| Gull's Rest lighthouse | Saltreach | designed | harbour | Procedurally generate terrain-aware towns | `map/structures/harbour_specs/lighthouse.json` | Waiting in PR #209. Harbour of Gull's Rest; town with quay, moles, jetty and crane is in /mnt/project-files/siege-nights/towngen/gulls_rest-harbour/. |
| Gull's Rest boathouse | Saltreach | designed | harbour | Procedurally generate terrain-aware towns | `map/structures/harbour_specs/boathouse.json` | Waiting in PR #209. Harbour of Gull's Rest. |
| Gull's Rest harbourmaster's hut | Saltreach | designed | harbour | Procedurally generate terrain-aware towns | `map/structures/harbour_specs/harbourmaster.json` | Waiting in PR #209. Harbour of Gull's Rest. |
| Mirelight stilt houses (2) | Blackfen | in viewer | town-mirelight | Procedurally generate terrain-aware towns | `map/structures/regions_towns.py` |  |
| Field windmills | One version per overworld region | in game |  | Finish the remaining world builds | `map/structures/towngen_build.py` | Today towns use the Vale windmill; regional windmills for the five overworld regions are in world_props.py (viewer world_props), not yet placed by towngen. |
| ★ Regional wells and field fencing | One version per overworld region | in viewer | world_props | Finish the remaining world builds | `map/structures/world_props.py` | Wells and field fencing for all six regions. |

## Settlements

| Build | Region | Status | Viewer | Owner thread | Source | Notes |
|---|---|---|---|---|---|---|
| Town hall levels 1-5 (Longhouse to Sovereign's Throne) (25) | One version per overworld region | in game | settle-* | Refine every building, region by region | `map/structures/settle_halls.py` | In game since the settlement rebuild; due a pass on the building skill. |
| Cottage / Vale house / townhouse (5) | One version per overworld region | in game | settle-* | Refine every building, region by region | `map/structures/settle_buildings.py` | Waiting in PR #168. Vale house + townhouse rebuilt on the skill in PR #168; other regions still old designs. |
| Smithy (5) | One version per overworld region | in game | settle-* | Refine every building, region by region | `map/structures/settle_buildings.py` |  |
| Stable (plot building) (5) | One version per overworld region | in game | settle-* | Refine every building, region by region | `map/structures/settle_buildings.py` |  |
| Storehouse (5) | One version per overworld region | in game | settle-* | Refine every building, region by region | `map/structures/settle_buildings.py` |  |
| Watchtower (5) | One version per overworld region | in game | settle-* | Refine every building, region by region | `map/structures/settle_buildings.py` |  |
| Market stall (5) | One version per overworld region | in game | settle-* | Refine every building, region by region | `map/structures/settle_buildings.py` | Mateo 2026-11-12: use wool slabs/stairs for awning angles. |
| Well (5) | One version per overworld region | in game | settle-* | Refine every building, region by region | `map/structures/settle_buildings.py` |  |
| Library (lore shelves) (5) | One version per overworld region | in game | settle-* | Refine every building, region by region | `map/structures/settle_buildings.py` | Raised free on arrival; every settlement town needs its own lore and library. |
| Kitchen garden (5) | One version per overworld region | in game | settle-* | Refine every building, region by region | `map/structures/settle_buildings.py` |  |
| ★ Farmhouse (with its field) (5) | One version per overworld region | designed | skill-pass | Refine every building, region by region |  | Waiting in PR #168. Needed for the Town charter. Specs for all five regions in PR #168; waits in settle WAITING until layouts make room. In viewer section skill-pass (PR #168). |
| ★ Mint (5) | One version per overworld region | designed | skill-pass | Refine every building, region by region |  | Waiting in PR #168. Needed for the Town charter. Specs for all five regions in PR #168. In viewer section skill-pass (PR #168); waits in settle/buildings.js WAITING until layouts make room. |
| ★ Settlement inn (5) | One version per overworld region | designed | skill-pass | Refine every building, region by region |  | Waiting in PR #168. Needed for the City charter. Specs for all five regions in PR #168. In viewer section skill-pass (PR #168); waits in settle/buildings.js WAITING until layouts make room. |
| Stables levels 1-3 (Stables block) (15) | One version per overworld region | in game | settle-* | Build settlement building and mason shop | `map/structures/settle_buildings.py` |  |
| Breeder's Yard (Breeder's Post) (5) | One version per overworld region | in game | settle-* | Build settlement building and mason shop | `map/structures/settle_buildings.py` |  |
| Barracks (guardhouse) (5) | One version per overworld region | in game | settle-* | Build settlement building and mason shop | `map/structures/settle_buildings.py` |  |
| Quartermaster's armoury (5) | One version per overworld region | in game | settle-* | Build settlement building and mason shop | `map/structures/settle_buildings.py` |  |
| ★ Mason's Yard (stone workshop, bench in the front yard, 9x9) (5) | One version per overworld region | in game |  | Build settlement building and mason shop | `map/structures/review/specs/gen_mason.py` | Built on the skill (review/specs/mason_yard_<region>.json); the game raises it with every new base from settle/mason_data.js (map/structures/export_mason.py), on towngen's mason_yard ground or the nearest Small plot. |
| Starter village (Hamlet band: square, yards, field, pen) | One version per overworld region | designed |  | Redesign the starter village in 3D |  | Preview https://claude.ai/artifact/1EwgGXN7rNV6XiRzX5LoXs ; waiting on new building templates, then goes in as the Hamlet band. |
| Settlement walls, levels 1-10 (50) | One version per overworld region | in game | walls | Build settlement building and mason shop | `Siege_Nights_BP/scripts/settle/walldata.js` | Wall steps and tower ladders PR #161; physics PR #162. |
| Gates and portcullis (swinging) | One version per overworld region | in game |  | Build settlement building and mason shop | `Siege_Nights_BP/blocks/castle_gate.json` |  |
| Plot marker (post, sign, lantern, pennant) | Anywhere / region-neutral | in game |  | Design the settlement building placement mechanic | `Siege_Nights_BP/scripts/settle/plotmarker.js` | 3D mock-up https://claude.ai/artifact/7C2eyCUPG5dSEUTE9pWq87 ; in game as a block, the full mock-up look is not built. |
| ★ Construction site stages (scaffold, staged rise) (3) | Anywhere / region-neutral | in viewer | world_props | Finish the remaining world builds | `map/structures/world_props.py` | Construction-site scaffolds in three stages. |
| Railway station: Halt, Station, Junction, Grand Station (20) | One version per overworld region | in game | settle-* | Design the train system | `map/structures/stations.py` | Waiting in PR #168. Detailed backs in PR #168. |
| Trade House wing (small, two storeys) (10) | One version per overworld region | in game | settle-* | Design the train system | `map/structures/stations.py` | To be replaced by the Trade Outpost if Mateo approves that design. |
| Engine shed (5) | One version per overworld region | in game | settle-* | Design the train system | `map/structures/stations.py` |  |
| ★ Trade Outpost (halt 7x5, station 9x5, junction 9x7, grand 9x7 two storeys) (20) | One version per overworld region | in game | trade_outpost | Design train station trade routes | `map/structures/trade_outpost.py` | Beside a settlement's station, on its trade_join mark: the Trade Board and the Exports and Imports barrels inside, a striped awning over the loading hatch. Five regions x four station stages; the game raises it from trade/outpost_data.js (PR #192). |
| Vault strongrooms, 5 tiers x 3 layouts (15) | Anywhere / region-neutral | in viewer | vault | Design sieges on other settlements | `map/structures/vault_rooms.py` | Waiting in PR #180. In game via PR #180 (all treasury layout until Mateo picks). |
| ★ Regal Safe (2x2 strongbox) | Anywhere / region-neutral | designed |  | Design sieges on other settlements |  | Waiting in PR #180. Block in PR #180, texture awaiting Mateo's review. |
| ★ Siege Workshop | Anywhere / region-neutral | in game |  | Design sieges on other settlements | `Siege_Nights_BP/blocks/workshop.json` | A single block today, no building around it. |
| ★ Guild Factor's post / Guild Board | Anywhere / region-neutral | in game |  | Design a repeatable material gathering loop | `Siege_Nights_BP/scripts/guild` | An NPC job in the six towns; no counter or board build. |
| ★ Forester's Lodge tree farm | One version per overworld region | in game |  | Build custom tree assets | `Siege_Nights_BP/scripts/forestry` | Grove plan in game, not in the viewer and not on the building skill. |
| Ironworks: Ore Pit, Bloomery, Trip-Hammer Forge (own plot) (3) | One version per overworld region | in viewer | ironworks | Design a repeatable material gathering loop | `map/structures/ironworks/spec.py` | v3 on the skill awaiting Mateo's OK; the game still raises the old hand-drawn design. Only one style so far; regional versions to follow. |
| ★ Gold Sluice: Panning Sluice, Washing Mill, Assay House (3) | Emberwaste | designed | goldsluice | Design a repeatable material gathering loop |  | Waiting in PR #190. Designed on the skill in PR #190. |
| ★ Deep Shaft: Prospect Shaft, Winding House, Deep Shaft (3) | Frostmarch | designed | deepshaft | Design a repeatable material gathering loop | `map/structures/deepshaft/spec.py` | Waiting in PR #190. Built on the skill in PR #190 (needs skill PR #155 for Frostmarch presets). Hosted 3D https://claude.ai/artifact/D58sGecJoqcFXsYkttAh7C (Deep Shaft tab). |
| ★ Choir Seam: Seam Cut, Choir Winch, Singing Gallery, and the ore barge (4) | The Hollow | designed | choirseam | Design a repeatable material gathering loop | `map/structures/choirseam/spec.py` | Waiting in PR #190. The Choir Ore mine on a Hollow cliff, built on the skill in PR #190; the ore barge (choirseam/barge.py) moors at its jetty. Hosted 3D https://claude.ai/artifact/D58sGecJoqcFXsYkttAh7C (Choir Seam tab). |
| Guard posts and wall steps | Anywhere / region-neutral | in game |  | Build settlement building and mason shop | `Siege_Nights_BP/scripts/guardposts` | Markers and steps, not a building. |
| Interiors for every building on the skill (stairs, rooms by use, attics, lights) | One version per overworld region | designed |  | Add interiors to every building |  | Waiting in PR #207. A skill stage furnishing all 25 plot buildings (house, townhouse, farmhouse, inn, mint x 5 regions), the Kingsrest capital, chapel, guildhall, houses and inn, and Millbrook's clock tower and watermill. Other builds get interiors as they move onto the skill. Hosted 3D with roof-off and floor cuts https://claude.ai/artifact/9rUS3eguTn9VJhK9asKHG4 |

## Strongholds

| Build | Region | Status | Viewer | Owner thread | Source | Notes |
|---|---|---|---|---|---|---|
| The Citadel (one grand layout), Vale style | Aldmere Vale | designed |  | Redesign the Citadel as one grand layout | `map/structures/citadel.py` | Waiting in PR #214. Merged in PR #214 (citadel.py --style vale), gardens, keep and tower interiors; 3D https://claude.ai/artifact/DAH2CsQ3d9L88z9uXC39yY . The game still raises the old Citadel until it is stamped. |
| The Citadel in Frostmarch, Saltreach, Emberwaste and Blackfen styles (4) | One version per overworld region | designed |  | Redesign the Citadel as one grand layout | `map/structures/citadel.py` | Waiting in PR #214. Merged in PR #214: citadel.py --style frostmarch\|saltreach\|emberwaste\|blackfen; 3D https://claude.ai/artifact/DAH2CsQ3d9L88z9uXC39yY |
| ★ The Hollow's stronghold (Citadel layout in the Hollow kit) | The Hollow | designed |  | Redesign the Citadel as one grand layout | `map/structures/hollow_stronghold.py` | Waiting in PR #214. Merged in PR #214: round plan, leaning towers, light-river moat, tall sharp asymmetric keep; 3D https://claude.ai/artifact/DAH2CsQ3d9L88z9uXC39yY |

## Wonders

| Build | Region | Status | Viewer | Owner thread | Source | Notes |
|---|---|---|---|---|---|---|
| ★ Wonder: Great Lighthouse (6) | Saltreach | designed | wonders | Add Rival Lord settlers, wonders and events |  | Waiting in PR #181. Six fixed map sites, six build stages each; designs, game code and viewer section in PR #181. |
| ★ Wonder: High Watch (6) | Aldmere Vale | designed | wonders | Add Rival Lord settlers, wonders and events |  | Waiting in PR #181. Six fixed map sites, six build stages each; designs, game code and viewer section in PR #181. |
| ★ Wonder: Rimeforge Hall (6) | Frostmarch | designed | wonders | Add Rival Lord settlers, wonders and events |  | Waiting in PR #181. Six fixed map sites, six build stages each; designs, game code and viewer section in PR #181. |
| ★ Wonder: Sun Gate Caravanserai (6) | Emberwaste | designed | wonders | Add Rival Lord settlers, wonders and events |  | Waiting in PR #181. Six fixed map sites, six build stages each; designs, game code and viewer section in PR #181. |
| ★ Wonder: Lantern Spire (6) | Blackfen | designed | wonders | Add Rival Lord settlers, wonders and events |  | Waiting in PR #181. Six fixed map sites, six build stages each; designs, game code and viewer section in PR #181. |
| ★ Wonder: Great Horse Fair (6) | Aldmere Vale | designed | wonders | Add Rival Lord settlers, wonders and events |  | Waiting in PR #181. Six fixed map sites, six build stages each; designs, game code and viewer section in PR #181. |

## World

| Build | Region | Status | Viewer | Owner thread | Source | Notes |
|---|---|---|---|---|---|---|
| Rival Lords' seats and towns | One version per overworld region | in game |  | Build settlement building and mason shop | `Siege_Nights_BP/scripts/rivals/index.js` | Use the same town layouts and buildings as players (PR #173). |
| Plot relic landmarks (12) (12) | One version per overworld region | in game | landmarks | Finish the remaining world builds | `Siege_Nights_BP/scripts/landmarks/sites.js` | Self-build near players (PR #164). |
| Story places: Crownhold, Bellhollow, Ashen Gate chapterhouse, Ashen Watch, Corvin's Tower, Old Mag's hut, Nell Sedge's raft-house, the Deepforge, the Cinder Roost (9) | One version per overworld region | in game | landmarks | Finish the remaining world builds | `Siege_Nights_BP/scripts/landmarks/sites.js` | Self-build near players (PR #164). |
| Seven thin-place caves with Fennick's camps (7) | One version per overworld region | in game |  | Settle the road to the Rift | `Siege_Nights_BP/scripts/undertow/thinplaces.js` | Script-built and plain; hosted 3D https://claude.ai/artifact/QFoys3C5GaHFXe415EkJjo . Not in the local viewer or on the building skill. |
| ★ Sealed ways out: the Shut Pass, the Far Shore, the Horizon Isles (3) | Anywhere / region-neutral | designed | landmarks | Finish the remaining world builds | `map/structures/world_doors.py` | Waiting in PR #208. shut_pass_gate (the Shut Pass gate), westwatch (Far Shore coast landmark), southmost_light (Horizon Isles coast landmark); place themselves via landmarks/sites.js. |
| Gravestone (left where a player dies) | Anywhere / region-neutral | in game | graves | Add gravestones when players die | `map/structures/gravestone_build.py` | 3x3 footprint: clickable headstone, pale moss mound, a candle lit while the grave is sealed, dry grass. The game places it when a player dies. |
| Dragon nest (9x9, natural, unbreakable) | Anywhere / region-neutral | in game |  | Redesign the dragon nest | `Siege_Nights_BP/scripts/dragons/nestplan.js` |  |
| Custom trees (31 species, six regions) (31) | One version per overworld region | in game | trees | Build custom tree assets | `map/trees/build_trees.py` |  |
| Welcome hall: map miniature on its cloud | Anywhere / region-neutral | in game | miniature | Build a scaled-down map in the welcome hall | `map/structures/miniature_scene.py` |  |
| Old Workings (regrowing mines near towns) | One version per overworld region | in game |  | Design a repeatable material gathering loop | `Siege_Nights_BP/scripts/workings` | Being redone on the building skill (mine mouth / portal); not in the viewer. |

## Boss sites

| Build | Region | Status | Viewer | Owner thread | Source | Notes |
|---|---|---|---|---|---|---|
| Boss unlock set pieces (all five, as the game builds them) (5) | One version per overworld region | in game | bossunlocks | Design how regional bosses unlock | `map/structures/boss_unlock_sites.py` | Read straight from unlocks/plans.js and well_plan.js (PR #187); test with /scriptevent siege:unlock <site> here. |
| Boss site: Reeve's well and chamber (Millbrook) | Aldmere Vale | in game |  | Design how regional bosses unlock | `Siege_Nights_BP/scripts/unlocks/well_plan.js` | Script-built, not in the viewer, not on the building skill. |
| Boss site: Hunter's Cairn, beast cairns and Old Sigga's lodge (Hallowmere) | Frostmarch | in game | boss_sites | Design how regional bosses unlock | `Siege_Nights_BP/scripts/unlocks/huntsman.js` | Script-built, not in the viewer. Exterior landmark "the Antler Crown" designed in map/structures/boss_landmarks.py (PR #208, viewer boss_sites), placed via unlocks/landmarks.js (PR #187). |
| Boss site: Gull Bay chapel and altar | Saltreach | in game | boss_sites | Design how regional bosses unlock | `Siege_Nights_BP/scripts/unlocks/bride.js` | Script-built, not in the viewer. Exterior landmark "the Drowned Bell Tower" designed in map/structures/boss_landmarks.py (PR #208, viewer boss_sites), placed via unlocks/landmarks.js (PR #187). |
| Boss site: Sunscar vault with five faceless statues | Emberwaste | in game | boss_sites | Design how regional bosses unlock | `Siege_Nights_BP/scripts/unlocks/seneschal.js` | Script-built, not in the viewer. Exterior landmark "the Faceless Gate" designed in map/structures/boss_landmarks.py (PR #208, viewer boss_sites), placed via unlocks/landmarks.js (PR #187). |
| Boss site: the Cradle Tree and root cradle (Mirelight) | Blackfen | in game | boss_sites | Design how regional bosses unlock | `Siege_Nights_BP/scripts/unlocks/mother.js` | Script-built, not in the viewer. Exterior landmark "the Cradle Tree" designed in map/structures/boss_landmarks.py (PR #208, viewer boss_sites), placed via unlocks/landmarks.js (PR #187). |
| ★ Boss site: Vorlund's Muster (Warlord King's ground) | Anywhere / region-neutral | designed | landmarks | Finish the remaining world builds | `map/structures/world_doors.py` | Waiting in PR #208. At (1030, -990); places itself via landmarks/sites.js. |
| Boss site landmark: the Lantern Mast (Mirelight) | Blackfen | designed | boss_sites | Finish the remaining world builds | `map/structures/boss_landmarks.py` | Waiting in PR #208. Exterior landmark (PR #208); placed via unlocks/landmarks.js (PR #187). |

## Reference

| Build | Region | Status | Viewer | Owner thread | Source | Notes |
|---|---|---|---|---|---|---|
| Building skill examples | Anywhere / region-neutral | in viewer | skill | Build a shape-based Minecraft building skill | `.claude/skills/minecraft-builder/scripts/build_examples.py` | Sample shapes and parts from the minecraft-builder skill, not placed in the world. |

## Travel

| Build | Region | Status | Viewer | Owner thread | Source | Notes |
|---|---|---|---|---|---|---|
| Bridges: road, foot and rail, any angle, per region | One version per overworld region | designed | bridges | Generate custom bridges over water |  | Waiting in PR #183. Generator on the building skill; viewer section 'Bridges' and town river crossings in PR #183. Hollow crossings are this thread's follow-up. Hollow bridge scenes fixed for the viewer in PR #202. |
| ★ Level crossings: boards, setts, lamp posts, line fence, keeper's hut (per region) | One version per overworld region | in game |  | Design the train system | `map/railcross.py` | Planned by map/railcross.py (the hut through the building engine), laid by the game after a bought stretch's bed (rail_bed.js layCrossing). 3D: https://claude.ai/artifact/QX36T3oyockdLjp1KxG58K |
| Rail tunnel portals | One version per overworld region | designed |  | Build the plots and world map | `.claude/skills/minecraft-builder/scripts/portal.py` | portal.py on the skill; the map thread calls it inside rail works. |
| Rail beds, cuttings and embankments (built on purchase) | Anywhere / region-neutral | in game |  | Design the train system | `Siege_Nights_BP/scripts/trains/route_game.js` |  |
| Custom 3D track, switches and crossings | Anywhere / region-neutral | in game |  | Design the train system | `Siege_Nights_BP/scripts/trains` |  |
| ★ Bridleway signposts | One version per overworld region | in viewer | world_props | Finish the remaining world builds | `map/structures/world_props.py` | Vale, Frostmarch, Saltreach, Blackfen, Emberwaste signposts (the Hollow one is in hollow_kit.py). |

## The Hollow

| Build | Region | Status | Viewer | Owner thread | Source | Notes |
|---|---|---|---|---|---|---|
| Hollow mining villages (Glimwade, Lowseam, Tollrest, Highcut) (4) | The Hollow | in game | hollow | Rebuild the Hollow's structures | `map/structures/hollow_kit.py` |  |
| Hollow miner's cottage | The Hollow | in game | hollow | Rebuild the Hollow's structures | `map/structures/hollow_kit.py` |  |
| The drowned city (seven leaning towers) | The Hollow | in game | hollow | Rebuild the Hollow's structures | `map/structures/hollow_kit.py` |  |
| Hollow centre sites: Truce Hall, Far Door, Pilgrim's Cross, Cartmeet, the Seams, the Lattice Wood, the Wound landing (7) | The Hollow | in game | hollow | Rebuild the Hollow's structures | `map/structures/hollow_kit.py` | Truce Hall and Far Door not redone in the last pass. |
| ★ The Cold Forge | The Hollow | in game |  | Rebuild the Hollow's structures | `Siege_Nights_BP/scripts/undertow/structures.js` | Still the old box plan; never moved to the Hollow kit or the viewer. |
| ★ Drift foot | The Hollow | in game |  | Rebuild the Hollow's structures | `Siege_Nights_BP/scripts/undertow/structures.js` | Kept its box plan; not in the viewer. |
| ★ The Standing Ranks | The Hollow | in game |  | Build the Hollow dimension and Rift | `Siege_Nights_BP/scripts/undertow/finale.js` | Morvane stage 2; plain, not in the viewer. |
| The Drowned Court (Choir fight) | The Hollow | in game | landmarks | Finish the remaining world builds | `map/structures/hollow_arenas.py` | Redesigned on the skill (PR #164), placed from undertow/arenas_data.js. |
| The Seat / Heart ring (Morvane) | The Hollow | in game | landmarks | Finish the remaining world builds | `map/structures/hollow_arenas.py` | Redesigned on the skill (PR #164), placed from undertow/arenas_data.js. |
| ★ The Hollow vault under the Seat | The Hollow | in game |  | Build the Hollow dimension and Rift | `Siege_Nights_BP/scripts/undertow/builder.js` | Plain gameplay space, never redesigned. |
| ★ Morvane stage pockets (reveal room, river, fall shafts) | The Hollow | in game |  | Build the Hollow dimension and Rift | `Siege_Nights_BP/scripts/undertow/pockets.js` | Plain rooms; not in the viewer. |

## Everwake

| Build | Region | Status | Viewer | Owner thread | Source | Notes |
|---|---|---|---|---|---|---|
| Everwake: the city on its cloud | Everwake, the city in the sky | in viewer | everwake | Design the Cloud City and flight | `map/structures/everwake/spec.py` | Waiting in PR #197. Style guide .claude/skills/minecraft-builder/regions/everwake.md. |
| Everwake with the Needle and the cloud sea | Everwake, the city in the sky | in viewer | everwake | Design the Cloud City and flight | `map/structures/everwake/spec.py` | Waiting in PR #197. |
| Everwake sky model (floating entity seen from the ground) | Everwake, the city in the sky | not started |  | Design the Cloud City and flight |  | An entity model, not a block build. |
