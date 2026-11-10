# Siege Nights / Hollow Crown art style

**Look:** "vanilla plus". Still 16×16 and at home next to vanilla blocks, but hand-shaded with a tighter palette so the mod has its own identity.

## Rules
1. **Light from the top-left.** Top and left edges one tone lighter, bottom and right one tone darker.
2. **Six-tone ramps.** Every material has a 6-tone ramp (0 = deepest shadow, 5 = highlight). Paint with ramp steps, never loose colours.
3. **Hue-shifted shading.** Shadows drift cool (violet-blue), highlights drift warm (straw). No pure black, no pure white.
4. **Clusters, not noise.** Wear is a 2-3 pixel pit, chip or fleck. No per-pixel static.
5. **Outlines only on items and at material edges**, using tone 0 of the material, not black.
6. **Vanilla iron.** Iron keeps vanilla's light neutral greys so it matches vanilla ingots, tools and armour. Dark ironwork (gate bands, portcullis, brazier) uses "blacksteel".
7. **Regions swap ramps, not shapes.** A block is drawn once; each region supplies stone, mortar, wood, accent and foliage ramps.
8. **One damage model.** Every wall block uses the same crack paths: stage 0 clean, 1 light cracks, 2 heavy cracks plus chipped corners (`texlib.damage_set`).

## Regions
| Region | Stone | Wood | Accent | Mood |
|---|---|---|---|---|
| The Vale (Millbrook), the default | warm grey | oak | banner red | warm, homely farmland |
| Frostmarch (Hollowfast) | blue-grey, pale highlights | spruce | ice blue | cold, blue shadows |
| Saltreach (Gull's Rest) | sandy limestone | bleached driftwood | sea-glass teal | sun-bleached coast |
| Emberwaste (Sunscar) | scorched red rock | charred timber | ember orange | cinders and heat |
| Blackfen (Mirelight) | dark moss-green stone | dark bogwood | sickly green glow | drowned and overgrown |
| The Undertow | violet basalt | pink lattice-wood | pale blue glow, pink fungus glow | sampled from Mateo's concept art (`art/reference/undertow-concept.png`) |

Exact colours: `studio/art/palette.py`.
