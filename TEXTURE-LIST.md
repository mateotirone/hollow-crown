# Siege Nights: texture list

Every asset that needs art. Right now everything has a simple **placeholder** I generated, so the add-on works in game, but each one can be replaced with final art. To swap a texture, keep the same file name and size and replace the PNG.

All paths are inside `Siege_Nights_RP/`.

## Art style (settled 2026-11-10)

The rules, palette and regional variants are in `art/STYLE-GUIDE.md`. Generators live in `studio/art/` (`palette.py`, `texlib.py`, `build_blocks.py`, `build_items.py`, `build_entities.py`, and `build_restyle.py` for the armor that is tied to 3D shapes). The old placeholders are kept in `art/placeholder-backup/`.

**Damage model for any wall block:** run the clean texture through `texlib.damage_set()` to get stages 0/1/2 (clean, light cracks, heavy cracks with chipped corners), named `<block>_<tier>_<cracks>.png` like Castle Stone. New wall blocks from any thread should use this so everything breaks the same way.

**Regional Castle Stone (textures ready, blocks not wired yet):** `textures/blocks/regional/siege_castle_stone_<region>[_<tier>_<cracks>].png` and `siege_mossy_castle_stone_<region>.png` for frostmarch, saltreach, emberwaste, blackfen, undertow. The Vale look is the default `siege_castle_stone`.

## Blocks (16×16, in `textures/blocks/`)

| Asset | File(s) | Status |
|---|---|---|
| Castle Stone | `siege_castle_stone.png` (also used by Battlement, Arrow Slit) | **Final style, awaiting your review** |
| Castle Stone, reinforced and cracked ×12 | `siege_castle_stone_<tier>_<cracks>.png`, tier = stone/iron/diamond/netherite, cracks = 0/1/2. Iron = riveted steel straps, diamond = steel frame with a cut-diamond boss, netherite = dark bevelled plates with gold bands. Made by `studio/art/build_blocks.py` | **Final style, awaiting your review** |
| Portcullis / Castle Gate, reinforced ×6 | `siege_portcullis_<tier>.png`, `siege_castle_gate_<tier>.png` for iron/diamond/netherite: steel, diamond-tinted steel or dark netherite bars with steel, diamond or gold studs | **Final style, awaiting your review** |
| Mossy Castle Stone | `siege_mossy_castle_stone.png` | **Final style, awaiting your review** |
| Cracked Castle Stone | `siege_cracked_castle_stone.png` | **Final style, awaiting your review** |
| Portcullis closed / raised | `siege_portcullis.png`, `siege_portcullis_open.png` (transparent) | **Final style, awaiting your review** |
| Castle Gate closed / open | `siege_castle_gate.png`, `siege_castle_gate_open.png` (transparent) | **Final style, awaiting your review** |
| Spire Roof shingles | `siege_roof_shingles.png` | **Final style, awaiting your review** |
| Timber Frame / Cross | `siege_timber_frame.png`, `siege_timber_frame_cross.png` | **Final style, awaiting your review** |
| Brazier | `siege_brazier_iron.png`, `siege_brazier_coals.png`, `siege_brazier_fire.png` (transparent) | **Final style, awaiting your review** |
| Keep Banner pole | `siege_banner_pole.png` | **Final style, awaiting your review** |
| Keep Banner cloth ×16 colors | `siege_banner_<color>.png` for white, orange, magenta, light_blue, yellow, lime, pink, gray, light_gray, cyan, purple, blue, brown, green, red, black. Cloth area is x 2–13, y 1–12 | **Final style, awaiting your review** |
| Barracks | `siege_barracks_side.png`, `siege_barracks_top.png`, bottom reuses `siege_desk_bottom.png` | **Final style, awaiting your review** |
| Siege Workshop | `siege_workshop_side.png`, `siege_workshop_top.png` | **Final style, awaiting your review** |
| Quartermaster's Desk | `siege_desk_side.png`, `siege_desk_top.png`, `siege_desk_bottom.png` | **Final style, awaiting your review** |
| Breaching Charge | `siege_charge_side.png`, `siege_charge_top.png` | **Final style, awaiting your review** |

## Items (16×16, in `textures/items/`)

| Asset | File | Status |
|---|---|---|
| War Horn | `siege_war_horn.png` | **Final style, awaiting your review** |
| Guard Helmet / Chestplate / Leggings / Boots | `siege_guard_helmet.png`, `siege_guard_chestplate.png`, `siege_guard_leggings.png`, `siege_guard_boots.png` | **Final style, awaiting your review** |
| Knight's Longsword | `siege_longsword.png` | **Final style, awaiting your review** |
| Warhammer | `siege_warhammer.png` | **Final style, awaiting your review** |
| Writ of Alliance | `siege_writ.png` | **Final style, awaiting your review** |
| Battering Ram | `siege_battering_ram.png` | **Final style, awaiting your review** |
| Trebuchet / Ballista | `siege_trebuchet.png`, `siege_ballista.png` | **Final style, awaiting your review** |
| Archer / Man-at-Arms (picked-up guard) | `siege_archer.png`, `siege_man_at_arms.png` | **Final style, awaiting your review** |

## Worn armor (64×32, in `textures/models/armor/`)

| Asset | File | Status |
|---|---|---|
| Castle Guard helmet, chestplate, boots | `guard_layer_1.png` | **Final style, awaiting your review** |
| Castle Guard leggings | `guard_layer_2.png` | **Final style, awaiting your review** |

**Special format:** these use the leather-armor trick so the cloth takes your banner color. Cloth pixels are grey and fully opaque (they get tinted). Everything else (steel, gold, leather) keeps its own color and has alpha set to 1. Keep that rule when repainting.

## Vanilla armor, retextured in 3D (128×64, in `textures/models/siege_armor/`)

One texture per material covers all four pieces. Left half is the normal armor layout (top = helmet, chestplate, boots; bottom = leggings), right half holds the 3D extras. Shapes are in `models/entity/armor/`, and `attachables/vanilla_*.json` swap them in for the vanilla items. `studio/build_varmor.py` regenerates all of it.

| Asset | File | Status |
|---|---|---|
| Chainmail: solid mail with gambeson edges, mail mantle | `chainmail.png` | **Final style, awaiting your review** |
| Iron: chainmail and white surcoat with red cross, kettle hat brim, surcoat flaps | `iron.png` | **Final style, awaiting your review** |
| Diamond: knight's plate, closed great helm with red plume, shoulder plates, knee guards | `diamond.png` | **Final style, awaiting your review** |
| Netherite: polished dark plate with gold trim, crowned helm with ruby and breathing holes, gold crown on the breastplate, segmented arms and legs, layered shoulder plates, purple sash and crowned cape, knee guards | `netherite.png` | **Final style, awaiting your review** |

Item icons for these stay vanilla for now. Leather and gold armor are untouched.

## Guard armor (128×64, in `textures/models/siege_guard_armor/`)

Guards' own armor line, which players can't get (items `siege:guardgear_<tier>_<piece>`, hidden from menus). The chest always leaves the tabard open so the banner color shows. Shapes in `models/entity/guard_armor/`, made by `studio/build_guardgear.py`. Icons reuse the Castle Guard armor icons.

| Tier | File | Status |
|---|---|---|
| 1 Mail and Nasal Helm (conical helm with nose bar, mail coif and hauberk) | `tier1.png` | **Final style, awaiting your review** |
| 2 Brigandine and Sallet (riveted red-brown brigandine, sallet with a back tail) | `tier2.png` | **Final style, awaiting your review** |
| 3 Half Plate and Bascinet (steel plate, pointed visor snout, small shoulder plates) | `tier3.png` | **Final style, awaiting your review** |
| 4 Royal Guard Plate (bright steel, gold cross on the helm, white plume, gold trim) | `tier4.png` | **Final style, awaiting your review** |

## Entities

| Asset | File | Status |
|---|---|---|
| Quartermaster (64×64 villager layout) | `textures/entity/siege_quartermaster.png` | Recolored villager, still to be hand-painted |
| Castle Guard Barding (64×64, replaces iron horse armor) | `textures/entity/horse2/armor/horse_armor_iron.png` | **Final style, awaiting your review** |
| Battering Ram (64×32: planks, bark, iron head, wheel, log end, roof hide) | `textures/entity/siege_battering_ram.png` | **Final style, awaiting your review**, with 3D model `models/entity/battering_ram.geo.json` (frame, roof, 4 spinning wheels, swinging beam), shown 1.35× size in game |
| Trebuchet (64×64 atlas: planks, log, iron, rope, stone, leather, log end, bolt, dark wood, cloth) | `textures/entity/siege_trebuchet.png` | **Final style, awaiting your review**, with 3D model `models/entity/trebuchet.geo.json` (A-frame, swinging arm, counterweight, sling) and fire animation |
| Ballista (64×64, same atlas layout) | `textures/entity/siege_ballista.png` | **Final style, awaiting your review**, with 3D model `models/entity/ballista.geo.json` (stand, turning turret, bow arms, string, bolt) and fire animation |
| Archer ×16 colors (64×64 player skin layout) | `textures/entity/siege/archer_<color>.png`, hood and mantle in the banner color, green jerkin, quiver | **Final style, awaiting your review** |
| Man-at-Arms ×16 colors (64×64 player skin layout) | `textures/entity/siege/man_at_arms_<color>.png`, padded gambeson, tabard in the banner color with the gold tower | **Final style, awaiting your review** |
| Keep heart | `textures/entity/siege_invisible.png` | Stays invisible, no art needed |

## 3D shapes

Custom block shapes live in `models/blocks/` (battlement, arrow_slit, spire, brazier, keep_banner). Their textures are listed above.

## Pack icons (256×256)

| Asset | File | Status |
|---|---|---|
| Pack icon | `pack_icon.png` (same image in both packs) | Placeholder |

## Planned, not built yet

- **Custom raider mobs (Mateo wants special textures; held until the all-textures pass):** Footman, Crossbowman, Brute, Hexer, Warlock (illager/witch layouts), Battering Ram (ravager layout), Sapper (creeper layout). Right now raiders are plain vanilla mobs
- **Procedural raiders (built, using vanilla mobs for now):** custom looks for the Pillager Warband, Undead Horde and Mercenary Host, named Warlords, the Warlord King, faction banners
- **More castle pieces:** drawbridge, stairs and slabs for Castle Stone
- **Boulder** projectile model (the trebuchet hurls an invisible one with a smoke trail) (right now it's a smoke trail)
- **Banner patterns** so settlements can have different emblems, not just colors

## The Undertow (16×16, final art by `studio/art/build_hollowcrown.py`; do not regenerate these PNGs from `studio/build_undertow.py`)

Look comes from Mateo's Undertow concept art: purple twilight, dark basalt, hollow lattice trees, glowing pink and blue fungi, rivers of pale blue light. No sky.

| Asset | File | Status |
|---|---|---|
| Veinstone (dark rock with glowing purple veins, the main ground rock) | `textures/blocks/siege_veinstone.png` | **Final style, awaiting your review** |
| Undertow Moss (purple web-like moss, ground cover) | `textures/blocks/siege_undertow_moss.png` | **Final style, awaiting your review**, wants separate top and side later |
| Veil Rock (the ceiling, near black) | `textures/blocks/siege_veil_rock.png` | **Final style, awaiting your review** |
| Hollowwood Lattice (see-through honeycomb wood of the giant trees, transparent holes) | `textures/blocks/siege_hollowwood_lattice.png` | **Final style, awaiting your review** |
| Hollowwood Core (same lattice with glowing pink-orange filling the holes) | `textures/blocks/siege_hollowwood_core.png` | **Final style, awaiting your review** |
| Veilcap (glowing pink umbrella fungus, cross plant, transparent background) | `textures/blocks/siege_veilcap.png` | **Final style, awaiting your review** |
| Glimbulb (pale blue glowing bulbs on thin stalks, cross plant) | `textures/blocks/siege_glimbulb.png` | **Final style, awaiting your review** |
| Glimmerflow (river of pale blue light, semi-transparent) | `textures/blocks/siege_glimmerflow.png` | **Final style, awaiting your review**, could be animated later |
| Strange Seam (cave rock with a thin violet crack down the middle) | `textures/blocks/siege_rift_seam.png` | **Final style, awaiting your review** |
| Rift Edge (glowing violet torn rock that lines the Rift) | `textures/blocks/siege_rift_edge.png` | **Final style, awaiting your review** |
| Rift Veil (the shimmering portal film inside the Rift, semi-transparent) | `textures/blocks/siege_rift_veil.png` | **Final style, awaiting your review**, could be animated later |
| Waystone (dark stone with a pale blue rune) | `textures/blocks/siege_waystone.png` | **Final style, awaiting your review**, wants a 3D model later |
| Court Seal (dark teal sealed stone of the Drowned Court gate) | `textures/blocks/siege_court_seal.png` | **Final style, awaiting your review** |
| Tuning Fork (item) | `textures/items/siege_tuning_fork.png` | **Final style, awaiting your review** |
| Choir Shard (item, violet crystal sliver) | `textures/items/siege_choir_shard.png` | **Final style, awaiting your review** |
| Undertow fog (not a texture: colors in `fogs/undertow_fog.json`, violet `#3b2360`) | `fogs/undertow_fog.json` | Tune in game |

## Plots (16×16)

| Asset | File | Status |
|---|---|---|
| Plot Stone (claim marker: compass star on top, gold claim band on the sides) | `textures/blocks/siege_plot_stone_top.png`, `siege_plot_stone_side.png`, `siege_plot_stone_bottom.png` | **Final style, awaiting your review** (`studio/art/build_hollowcrown.py`) |

## For threads adding new assets

Add a row here with the file path, size, what it should look like, and whether it needs transparency. A flat placeholder PNG at the right path is fine. The textures thread paints the final art over it and keeps the file name, size and transparency, so your JSON keeps working. Once a row says "Final style", don't regenerate that PNG from a placeholder script.
