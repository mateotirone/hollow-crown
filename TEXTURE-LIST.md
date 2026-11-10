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
| Pack icon: the Hollow Crown over a cracked castle wall at night | `pack_icon.png` (same image in both packs, `studio/art/build_pack_icon.py`) | **Final style, awaiting your review** |

## The Crown and the Citadel

Placeholders came from `studio/build_crown.py`; final art for the icons and blocks is by `studio/art/build_hc_items.py` and `build_hc_blocks.py`, so do not regenerate those PNGs. The Citadel itself is built from blocks that already exist (Castle Stone, Battlement, Arrow Slit, Portcullis, Spire Roof, Brazier, plus vanilla deepslate, quartz, gold and wool), so it needs no art of its own.

| Asset | File | Status |
|---|---|---|
| The Hollow Crown, item icon (16×16). Now the Hollow ruler's crown, not the overworld ruler's | `textures/items/siege_hollow_crown.png` | **Final style, awaiting your review** |
| The Hollow Crown, worn (64×32): gold band at 0,0, crown points at 0,12, gem at 8,12. Shape in `models/entity/hollow_crown.geo.json` (band with eight points, tallest at the front) | `textures/models/armor/siege_hollow_crown.png` | Placeholder |
| The Heart of the Hollow (16×16 item): a still-beating ember-heart, dark rose with pale violet veins. Replaces the Royal Scepter, whose icon `siege_royal_scepter.png` is no longer used | `textures/items/siege_heart_of_the_hollow.png` | Placeholder |
| Oath Shard (16×16 item, was "Crown Shard"), pale violet crystal | `textures/items/siege_crown_shard.png` | **Final style, awaiting your review** |
| Gauntlet of Challenge (16×16 item) | `textures/items/siege_gauntlet_of_challenge.png` | **Final style, awaiting your review** |
| Citadel Cornerstone (16×16 block): stone with a gold band, crown mark on top | `textures/blocks/siege_cornerstone_side.png`, `siege_cornerstone_top.png` | **Final style, awaiting your review** |
| The Throne (16×16 block sheet: gold and red cushion patch at 0,0, finials at 12,0, stone plinth at 0,8). Shape in `models/blocks/throne.geo.json` | `textures/blocks/siege_throne.png` | **Final style, awaiting your review**, the shape deserves a proper model in the art pass |
| Fallen Oath Shard (16×16 block), glowing crystal cluster. Shape in `models/blocks/fallen_shard.geo.json` | `textures/blocks/siege_fallen_shard.png` | **Final style, awaiting your review** |
| Throne Seal (64×64 entity): a floating seal-stone in front of the throne during a Storm. Shape in `models/entity/throne_seal.geo.json` | `textures/entity/siege_throne_seal.png` | Placeholder |

Wanted later for this feature: a boss-bar style look for the Throne Seal, a darker "hollowed" variant of the Crown for a ruler who has worn it too long, and Citadel-only banner hangings with an emblem instead of plain wool.

## Town hall and Tree of Oaths (16×16 blocks, final art by `studio/art/build_hc_blocks.py`)

| Asset | File | Status |
|---|---|---|
| Hall Cornerstone block (side, top) and item icon | `textures/blocks/siege_hall_cornerstone_side.png`, `siege_hall_cornerstone_top.png`, `textures/items/siege_hall_cornerstone.png` | **Final style, awaiting your review** |
| Tree of Oaths bark (plain and Marked), crown (unsworn, Knight, Marked), plinth | `textures/blocks/siege_oath_tree_bark.png`, `_bark_marked.png`, `siege_oath_tree_crown.png`, `_crown_knight.png`, `_crown_marked.png`, `siege_oath_tree_plinth.png` | **Final style, awaiting your review** |
| Oath Banner, Warden's Bell (16×16 icons) | `textures/items/siege_oath_banner.png`, `siege_wardens_bell.png` | **Final style, awaiting your review** |

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
| Hollow Moss (`siege:undertow_moss`, purple web-like moss, ground cover) | `textures/blocks/siege_undertow_moss.png` | **Final style, awaiting your review**, wants separate top and side later |
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

## Horses and rail (icons and blocks: final art by `studio/art/build_hc_items.py` and `build_hc_blocks.py`; do not regenerate from `studio/build_horses.py`)

Icons and blocks are painted. The horse coats further down are still to do. Keep file names and sizes.

| Asset | File | Status |
|---|---|---|
| Halter, Horse Whistle, Riding Crop (16×16 icons, transparent) | `textures/items/horses/siege_halter.png`, `siege_horse_whistle.png`, `siege_riding_crop.png` | **Final style, awaiting your review** |
| Horseshoes: iron, diamond, netherite (16×16 icons, transparent; a pair of U-shaped shoes in each metal) | `textures/items/horses/siege_horseshoes_iron.png`, `_diamond.png`, `_netherite.png` | **Final style, awaiting your review** |
| Saddle kits: Padded Saddlecloth (plain quilted cloth), Cavalry (leather with steel fittings), Royal (crimson with gold trim) (16×16 icons, transparent) | `textures/items/horses/siege_saddlecloth_padded.png`, `siege_saddle_cavalry.png`, `siege_saddle_royal.png` | **Final style, awaiting your review** |
| Caparison icon (16×16, transparent; folded heraldic horse cloth) | `textures/items/horses/siege_caparison.png` | **Final style, awaiting your review** |
| Stables block (16×16 side and top: timber stall with hay) | `textures/blocks/travel/siege_stables_side.png`, `siege_stables_top.png` | **Final style, awaiting your review** |
| Rail Depot block (16×16 side and top: timber and iron, rail motif on top) | `textures/blocks/travel/siege_rail_depot_side.png`, `siege_rail_depot_top.png` | **Final style, awaiting your review** |
| Station Post block (16×16 side and top: stone post with a gold-framed name plate) | `textures/blocks/travel/siege_station_post_side.png`, `siege_station_post_top.png` | **Final style, awaiting your review** |
| Breeder's Post block (16×16 side and top: timber post with a horse notice) | `textures/blocks/travel/siege_breeder_post_side.png`, `siege_breeder_post_top.png` | **Final style, awaiting your review** |

**Still needed, no file yet (the steed uses vanilla horse art until then).** Each is a 64×64 horse texture in the vanilla `horse2` layout; add the path to `entity/steed.entity.json` when painted.

| Asset | Suggested file | Status |
|---|---|---|
| Five breed coats: Vale Courser (bright chestnut, white blaze), Frostmarch Destrier (heavy white-grey, feathered legs), Saltreach Runner (dapple grey, sea-salt mane), Emberwaste Sandstrider (pale gold), Blackfen Mire-Pony (black-brown, shaggy) | `textures/entity/siege/steed_<breed>.png` | Needed (now: vanilla coat colors) |
| Crossbred coat (piebald mix) | `textures/entity/siege/steed_crossbred.png` | Needed (now: a parent's vanilla coat) |
| Knight Warhorse overlay (armored chamfron and crinet, heavier build) | `textures/entity/siege/steed_warhorse.png` | Needed (now: just 12% bigger) |
| Marked Hollow Steed (spectral pale blue-white, hollow eyes, needs transparency) | `textures/entity/siege/steed_hollow.png` | Needed (now: a pale wash over the normal coat) |
| Caparison worn layer (armor layer, white cloth so the banner color tints it) | `textures/entity/siege/steed_caparison.png` | Needed (now: tinted vanilla leather horse armor) |
| Horseshoes and saddle kits on the horse (optional small overlays on hooves and saddle) | `textures/entity/siege/steed_gear_<kit>.png` | Optional |

## Lore, tomes and library (final art by `studio/art/build_hc_items.py` and `build_hc_blocks.py`; run `studio/build_lore.py` only with `--no-art`)

| Asset | File(s) | Status |
|---|---|---|
| Archive Shelf casing (sides, top and bottom) | `textures/blocks/siege_shelf_side.png`, `siege_shelf_top.png` | **Final style, awaiting your review** |
| Archive Shelf front ×7 (empty, then 1 to 6 tomes: two rows of three slots, one book spine per shelved tome) | `textures/blocks/siege_shelf_front_0.png` to `siege_shelf_front_6.png` | **Final style, awaiting your review**. Could later get a regional variant per build style |
| Dusty Tome (a closed book lying in the world; 32×16 box-UV for a 10×3×8 book, shape in `models/blocks/tome_cache.geo.json`) | `textures/blocks/hc_tome_cache.png` | **Final style, awaiting your review** |
| Lore Tome item (old leather book, gilt bands) | `textures/items/siege_lore_tome.png` | **Final style, awaiting your review**. Nice to have later: one cover per collection (8) |
| Ledger of Whispers item (green journal with a quill) | `textures/items/siege_ledger.png` | **Final style, awaiting your review** |
| Cipher Wheel item (two brass letter rings) | `textures/items/siege_cipher_wheel.png` | **Final style, awaiting your review** |
| Tide Glass item (pale sea-worn shard of glass; file keeps its old name) | `textures/items/siege_mirror_glass.png` | **Final style, awaiting your review** |
| Story characters ×8 (Sister Wren, Sir Aldous Vane, Old Mag, the Lighthouse Keeper, Archivist Pell, Brother Cael, Sigrun Ashby, Warden Isolde) | none yet: they use the built-in NPC entity with its stock skins | Not started. Custom NPC skins need the vanilla `npc` entity's skin list overridden in the resource pack |

## Bestiary: mobs and bosses (placeholders by `studio/bestiary/build.py`, in `textures/entity/siege/bestiary/`)

Skins were repainted on 2026-11-10 by the mobs thread (`studio/bestiary/skin.py`) with the shared palette (`studio/art/palette.py`; `studio/art/skinlib.py` is a drop-in shader). Files in `studio/bestiary/locked.txt` are hand-finished and skipped by its build. The item icons below are final art by `studio/art/build_hc_items.py`.

Every mob has a box model in `models/entity/bestiary/<id>.geo.json` and a generated house-style skin (looks come from `studio/bestiary/roster.py`). Re-running the build repaints them, so before hand-finishing a skin add its path to `studio/bestiary/locked.txt`. Ghost ones need their alpha kept. Tone: uneasy, not horror.

| Asset | File | Size | Status |
|---|---|---|---|
| Hollow Footman (Mob) | `hollow_footman.png` | 128×128 | House style, generated |
| Bell-Ringer (Mob) | `bell_ringer.png` | 64×64 | House style, generated |
| Shieldwall Brute (Mob) | `shieldwall_brute.png` | 128×128 | House style, generated |
| Torchbearer (Mob) | `torchbearer.png` | 64×64 | House style, generated |
| Siege Ogre (Mob) | `siege_ogre.png` | 128×128 | House style, generated |
| Crow-Mage (Mob) | `crow_mage.png` | 64×64 | House style, generated |
| Hollow Crow (Mob) | `hollow_crow.png` | 64×32 | House style, generated |
| Lost Villager (Mob) | `lost_villager.png` | 64×64 | House style, generated |
| Changeling (Mob) | `changeling.png`, `changeling_alt.png` (revealed form) | 64×64 | House style, generated |
| Wrongling (Mob) | `wrongling.png` | 64×64 | House style, generated |
| Stone Vigil (Mob) | `stone_vigil.png` | 128×128 | House style, generated |
| Echo Hound (Mob) | `echo_hound.png` | 64×64 | House style, generated |
| Mirror Knight (Mob) | `mirror_knight.png` | 128×128 | House style, generated |
| Tolling Shade (Mob, ghost (alpha)) | `tolling_shade.png` | 64×64 | House style, generated |
| Frost Stag (Mob) | `frost_stag.png` | 64×64 | House style, generated |
| Rimewolf (Mob) | `rimewolf.png` | 64×64 | House style, generated |
| Brine Lurker (Mob) | `brine_lurker.png` | 128×128 | House style, generated |
| Ash Scarab (Mob) | `ash_scarab.png` | 64×32 | House style, generated |
| Dune Wyrm (Mob) | `dune_wyrm.png` | 128×128 | House style, generated |
| Bog Hag (Mob) | `bog_hag.png` | 128×128 | House style, generated |
| Mire Toad (Mob) | `mire_toad.png` | 64×32 | House style, generated |
| Barrow Wight (Mob) | `barrow_wight.png` | 64×64 | House style, generated |
| Ashen Squire (Mob) | `ashen_squire.png` | 64×64 | House style, generated |
| Ashen Knight (Mob) | `ashen_knight.png` | 128×128 | House style, generated |
| Inquisitor (Mob) | `inquisitor.png` | 128×128 | House style, generated |
| The Clockwork Reeve (Boss) | `clockwork_reeve.png` | 128×128 | House style, generated |
| Reeve's Cog (Boss helper) | `reeve_cog.png` | 128×128 | House style, generated |
| The Pale Huntsman (Boss) | `pale_huntsman.png` | 64×64 | House style, generated |
| The Drowned Bride (Boss, ghost (alpha)) | `drowned_bride.png` | 128×128 | House style, generated |
| The Ash Seneschal (Boss) | `ash_seneschal.png` | 128×128 | House style, generated |
| The Mother of Changelings (Boss) | `mother_of_changelings.png` | 128×128 | House style, generated |
| The Mother of Changelings (Boss helper) | `mother_echo.png` | 128×128 | House style, generated |
| The Warlord King (Boss) | `warlord_king.png` | 128×128 | House style, generated |
| Oswin the Last (Boss) | `oswin_the_last.png` | 128×128 | House style, generated |
| The King's Hollow (Boss helper, ghost (alpha)) | `oswin_reflection.png` | 128×128 | House style, generated |
| Warlord (Mob) | `hollow_warlord.png` | 128×128 | House style, generated |
| Rime Pillar (Fight prop, ghost (alpha)) | `rime_pillar.png` | 128×128 | House style, generated |
| Chapel Bell (Fight prop) | `chapel_bell.png` | 64×64 | House style, generated |
| Hollow Bolt (Projectile) | `hollow_bolt.png` | 64×32 | House style, generated |

### Bestiary items (16×16, in `textures/items/bestiary/`)

| Asset | File | Status |
|---|---|---|
| Hollow Ash (material) | `hollow_ash.png` | **Final style, awaiting your review** |
| Pale Antler (material) | `pale_antler.png` | **Final style, awaiting your review** |
| Rime Pelt (material) | `rime_pelt.png` | **Final style, awaiting your review** |
| Brine Scale (material) | `brine_scale.png` | **Final style, awaiting your review** |
| Ash Glass (material) | `ash_glass.png` | **Final style, awaiting your review** |
| Wyrm Scale (material) | `wyrm_scale.png` | **Final style, awaiting your review** |
| Toad Venom (material) | `toad_venom.png` | **Final style, awaiting your review** |
| Wight Dust (material) | `wight_dust.png` | **Final style, awaiting your review** |
| Clockwork Cog (material) | `clockwork_cog.png` | **Final style, awaiting your review** |
| Drowned Pearl (material) | `drowned_pearl.png` | **Final style, awaiting your review** |
| Changeling Ichor (material) | `changeling_ichor.png` | **Final style, awaiting your review** |
| Stopped Clock Key (boss key) | `stopped_clock_key.png` | **Final style, awaiting your review** |
| Pale Horn (boss key) | `pale_horn.png` | **Final style, awaiting your review** |
| Drowned Wedding Ring (boss key) | `drowned_ring.png` | **Final style, awaiting your review** |
| Faceless Seal (boss key) | `faceless_seal.png` | **Final style, awaiting your review** |
| Mire Effigy (boss key) | `mire_effigy.png` | **Final style, awaiting your review** |
| Minute Hand (boss relic, sword) | `minute_hand.png` | **Final style, awaiting your review** |
| Rimefang Bow (boss relic, bow) | `rimefang_bow.png` | **Final style, awaiting your review** |
| Widow's Veil (boss relic, helmet) | `widows_veil.png` | **Final style, awaiting your review** |
| Seneschal's Greatshield (boss relic, shield) | `seneschal_greatshield.png` | **Final style, awaiting your review** |
| Faceless Crown Shard (boss relic, shard) | `faceless_crown_shard.png` | **Final style, awaiting your review** |
| Mire Heart (boss relic, charm) | `mire_heart.png` | **Final style, awaiting your review** |
| The Warlord's Brand (boss relic, sword) | `warlords_brand.png` | **Final style, awaiting your review** |
| Oath of Oswin (boss relic, sword) | `oath_of_oswin.png` | **Final style, awaiting your review** |
| Crownless Mantle (boss relic, chest) | `crownless_mantle.png` | **Final style, awaiting your review** |

### Bestiary worn relics (64×32, in `textures/models/armor/`)

| Asset | File | Status |
|---|---|---|
| Widow's Veil, worn (see-through veil) | `siege_b_widows_veil.png` | House style, generated |
| Crownless Mantle, worn | `siege_b_crownless_mantle.png` | House style, generated |

Still to model (no art at all yet): held 3D models for the Seneschal's Greatshield and Rimefang Bow (flat icons in hand for now), and custom boss sounds (vanilla sounds are used).

## For threads adding new assets

Add a row here with the file path, size, what it should look like, and whether it needs transparency. A flat placeholder PNG at the right path is fine. The textures thread paints the final art over it and keeps the file name, size and transparency, so your JSON keeps working. Once a row says "Final style", don't regenerate that PNG from a placeholder script.
| The Hollow Choir, the Conductor (64×64 box-UV skin; tall faceless robe, ring crown, long spread arms, baton) | `textures/entity/siege/undertow/choir_conductor.png`, model `models/entity/undertow/choir_conductor.geo.json` | Placeholder (flat colour), model is a rough block-out |
| Singer (64×64 box-UV skin; narrow pale robe, head tipped back, mouth a dark hollow) | `textures/entity/siege/undertow/choir_singer.png`, model `models/entity/undertow/choir_singer.geo.json` | Placeholder (flat colour), model is a rough block-out |
| Choir Ore (Veinstone with humming violet crystals, glows faintly) | `textures/blocks/siege_choir_ore.png` | **Final style, awaiting your review** |
| Raw Choir Ore (item, violet crystal lump) | `textures/items/siege_raw_choir_ore.png` | **Final style, awaiting your review** |
| Choirsteel Ingot (item, pale violet metal bar) | `textures/items/siege_choirsteel_ingot.png` | **Final style, awaiting your review** |
| Bell of the Hollow Crown (`siege:wardens_bell`, item, small dark violet hand bell) | `textures/items/siege_wardens_bell.png` | **Final style, awaiting your review** |

### Dragons (placeholders by `studio/build_dragons.py`; it never overwrites a PNG that exists)

| Asset | File | Status |
|---|---|---|
| Dragon skins ×4: Ember (dull red, tan belly), Ash (grey, orange eye), Sand (gold, teal eye), Obsidian (near-black violet, pink eye). 128×128 box-UV, model `models/entity/dragons/dragon.geo.json` (body, 2-part neck, head + jaw, 3-part tail, 4 legs, 2-part wings, saddle bone shown only when saddled). Should look old and watchful, not friendly; wing membranes can use alpha | `textures/entity/siege/dragons/dragon_ember.png`, `dragon_ash.png`, `dragon_sand.png`, `dragon_obsidian.png` | Placeholder, model is a rough block-out |
| Dragon Egg (16×16 icon, transparent; dark red scaled egg, one side glowing warm) | `textures/items/dragons/siege_dragon_egg.png` | Placeholder |
| Dragon Saddle (16×16 icon, transparent; heavy dark leather, chain girth) | `textures/items/dragons/siege_dragon_saddle.png` | Placeholder |
| Dragon Horn (16×16 icon, transparent; curved bone horn, gold mouthpiece) | `textures/items/dragons/siege_dragon_horn.png` | Placeholder |
| Dragon Roost (16×16 side + top; stone brick hearth with a gold band, top is scorched straw around an ember bed) | `textures/blocks/dragons/siege_dragon_roost_side.png`, `_top.png` | Placeholder |
| Dragon Nest (16×16 side + top; wild nest of straw, bone and sandstone, top shows a dark red egg) | `textures/blocks/dragons/siege_dragon_nest_side.png`, `_top.png` | Placeholder |

Still to do for dragons: real wing-fold and flap animation pass once seen in game, own sounds (ravager and ender dragon sounds are borrowed).
| NPC ruler of the Hollow (64×64 box-UV skin; Sorcerer in a dark violet robe wearing the Hollow Crown) | `textures/entity/siege/undertow/hollow_regent.png`, model `models/entity/undertow/hollow_regent.geo.json` | Placeholder (flat colour), model is a rough block-out |
