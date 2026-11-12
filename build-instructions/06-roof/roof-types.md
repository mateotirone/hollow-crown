# Roof types: which roof fits which footprint, where, and why

Mateo, 2026-11-11: different roof styles for different house layouts. The builder reads this after the
plan (stage 0) fixes the footprint: **this is the footprint, this is the roof that fits it, and this is why.**
References: `reference/pictures/roof-profiles.png` (profiles, read as cross-sections through the short
span), `roof-gambrel-aframe-curved.png`, `roof-dormers-curled-verges.png`.

Terms. **Span** = the short side of the module the roof covers, inside the walls, always odd. **Run** = the
long side (the ridge direction). **Rise** = rows of roof from the wall plate to the ridge. Every roof keeps
the rules of `README.md` (overhang 1, verge 1, ridge along the run, barge boards, eaves, no gap at the wall
top), and every roof gets its colour from `palettes/towns.md` and its texture from `texturing/`.

## How to read a profile

In the chart: full block = the roof body, stair = the sloped surface, slab = a half step, trapdoor = a thin
edge. The **edge** profile (the verge, seen at the gable end) has the extra row of underside blocks that
gives the edge thickness; the **middle** of the roof is only the stairs. Use a contrasting block for the
edge row (barge board) to define the roof, as the chart says.

## The catalogue

| # | Roof | Profile (one side, eaves to ridge) | Rise over span s | Spans it fits | Footprints | Where in town | Why |
|---|---|---|---|---|---|---|---|
| 1 | **Gable** (pitch 1) | a stair per row, one in, one up | (s+1)/2 | 5 to 11 | any rectangle, run at least span + 2 | the default house, cottage, shop, workshop, inn wings | cheap, honest, sheds rain; reads as "house" from every street |
| 2 | **Gable, lower pitch** | stair, slab, stair, slab: half a block up per block in | about (s+1)/4 | 9 to 15 | wide and shallow: stores, stables, market halls, warehouses | yards, the harbour, behind the high street | a wide span at pitch 1 gets too tall; a low pitch keeps a big shed modest; Saltreach default |
| 3 | **Steep gable** (pitch 2) | stair on a full block, two up per block in | s | 5 to 9 | narrow tall fronts, towers, chapels | Frostmarch everywhere; Vale chapels, gatehouses, narrow town houses on tight plots | sheds snow; makes a narrow front stand tall in a terrace |
| 4 | **A-frame** | pitch 2 or steeper all the way down to the ground or the plinth, no walls showing at the sides | s + 1 or more | 5 to 9 | small and narrow, run 7 to 13 | huts, hunting lodges, Frostmarch farmsteads, shrines on the edge of town | the roof is the walls: right for poor, cold or remote buildings; looks wrong in a town centre |
| 5 | **Bell-cast** (flared) | pitch 2 near the ridge, pitch 1 (or a slab step) for the last 1 or 2 rows | about (3s+1)/4 | 7 to 11 | cottages, halls | Vale cottages, the inn, rural houses | the flare at the eaves throws water clear of the wall; softer, older look (cottage sheet) |
| 6 | **Gambrel** (barn) | steep lower part (pitch 2, 2 or 3 rows), then shallow upper part (pitch 1) to the ridge | about (s+1)/2 + 2 | 9 to 15 | barns, big stables, granaries, two-storey houses wanting a full attic | farms round every town, mills, stores | gives a full-height loft under the roof; the farm silhouette |
| 7 | **Mansard** | very steep lower sides (walls of stairs or upright trapdoors, 2 to 3 rows), then a flat or very low top with a lip | 3 to 4 | 9 to 21 | square-ish or deep town houses, the guildhall, corner buildings | the square, rich streets, Kingsrest civic | an extra storey inside the roof on a tight plot; formal, wealthy look; flat top hidden from the street |
| 8 | **Hip** | rings stepping in from every side, corners as outer-corner stairs | (s+1)/2 | 7 to 15 | near-square plans, run up to 2 x span | Saltreach houses, civic buildings, pavilions, corner plots | no gable wall to weather; looks the same from every side, so it suits corners and free-standing civic buildings |
| 9 | **Pyramid / spire** | hip on a square, steep (pitch 2 or more) for spires | (s+1)/2, spires 2s or more | 3 to 11, square only | towers, belfries, well houses, market crosses | chapels, gate towers, the square's well | marks a point: the eye finds the town centre and the church by them |
| 10 | **Jerkinhead** (clipped gable) | gable, with the top 1 or 2 rows of each gable end hipped back | as gable | 7 to 13 | long houses | Vale and Blackfen houses, inns | breaks a plain gable, lowers the gable peak in wind; a cheap variation for a street of gables |
| 11 | **Cross gable** | two gables at right angles, the wing ridge at least 2 lower, valleys of stairs | main by its span | main 7 to 11, wing 5 to 9 | L, T and + plans | larger houses, inns, the chapel (equal ridges allowed on a symmetric cross) | each wing gets its own roof, so the plan reads from outside; the gable faces the street |
| 12 | **Saltbox** | one long slope and one short one: ridge off centre (one third in), the long side down to a lower wall | long side (2s+1)/3 | 7 to 13 | a house with a lean-to along the back | houses on slopes (the long side downhill), houses extended at the back | records the building's history: a house that grew; fits a hillside |
| 13 | **Mono-pitch (lean-to)** | a single slope from a high wall to a low one, pitch 1 or a lower slab pitch | s | 3 to 7 | sheds, porches, extensions against a bigger wall | backyards, market stalls along a wall, the station platform canopy | only against something taller: it must lean on a wall; alone it looks unfinished |
| 14 | **Clerestory** | two mono-pitches at different heights with a strip of windows between them | as each side | 9 to 21 | halls, markets, chapels needing light in the middle | the market hall, the chapel nave, workshops | light deep inside a wide building without roof windows; reads as civic |
| 15 | **M-shaped** (double gable) | two gables side by side with a valley between | each gable by its own span | total 13 to 21 (two odd spans with a shared wall) | wide deep buildings split into two ranges | inns, warehouses, the guildhall's back ranges, town houses back to back | a wide building without a towering single roof; the valley needs a gutter (stairs both sides) |
| 16 | **Curved** (round barrel) | stairs and slabs stepping in a quarter circle each side: steep at the eaves, flat at the top | (s+1)/2 | 7 to 13 | halls, chapels, stations, Hollow halls | the station, Emberwaste vaults, the Hollow | a soft, old, almost ship-like shape; the station shed and storehouses |
| 17 | **Dome** | courses stepping in as a circle, smooth, no one-cell ribs | about radius | 7 to 21, round or square plan | the capital hall, civic accents, Saltreach and Emberwaste civic | the capital, the square in big towns | the one thing seen from far away: a landmark |
| 18 | **Flat with parapet** | the roof layer on the wall top, made of vigas: logs running right across the building and one block out on both sides, every other block, with top slabs between them (log, slab, log, slab; Mateo 2026-11-12); parapet 1 high on top, crenels or slabs | 1 | any | any | Emberwaste houses; Saltreach harbour terraces on a lower wing only | dry country; flat roofs elsewhere look unfinished |
| 19 | **Butterfly** (two slopes falling to a middle valley) | the inverse of a gable | - | - | - | **never** | modern look; nothing in a medieval town has it |

## Choosing a roof from a footprint

1. **Take the module's span (short side) and run (long side).** Do it per module: an L plan has two
   modules and two roofs (cross gable, 11).
2. **Region first.** Use the region's default from `README.md` step 1 unless a row below gives a reason:
   Vale gable / bell-cast / cross gable; Frostmarch steep gable / A-frame; Saltreach hip / low gable;
   Blackfen gable low to the platform / jerkinhead; Emberwaste flat / dome / curved; Hollow steep gable,
   offset.
3. **Then by span:**

| Span | Houses | Barns, stores, halls |
|---|---|---|
| 3 | mono-pitch only (a shed or porch against a wall) | mono-pitch |
| 5 | gable, steep gable, A-frame (huts) | gable |
| 7 | gable, bell-cast, steep gable, jerkinhead, hip (square plans), A-frame | gable, curved |
| 9 | gable, bell-cast, hip, saltbox, mansard (town), gambrel (2-storey) | gambrel, low gable, curved, clerestory |
| 11 | gable, hip, mansard, saltbox, cross gable main | gambrel, low gable, clerestory, curved |
| 13 | hip, mansard, low gable; or split into M-shaped | gambrel, low gable, clerestory, M-shaped |
| 15 and up | split the plan into modules, or mansard / M-shaped / hip | clerestory, M-shaped, hip, dome (civic) |

4. **Then by proportion:** run less than span + 2 (nearly square): hip, pyramid or mansard, not a gable
   (a gable on a square plan looks like a box with a hat). Run 2 x span or more: gable, jerkinhead or
   M-shaped split along the run, with dormers or a chimney breaking the long ridge.
5. **Then by place in town:** the square and high street get the formal roofs (mansard, hip, dome on
   civic); side streets get gables and jerkinheads; the edge of town and farms get gambrel, A-frame,
   saltbox, mono-pitch. Neighbouring houses on one street vary the type as well as the colour: no more
   than 3 of the same type in a row, and alternate gable-to-street with ridge-to-street.
6. **Then the height check:** the rise must not exceed the wall height below it for houses (a roof taller
   than its walls looks like an A-frame), except A-frames, steep Frostmarch gables and spires.
7. **Write the choice and the reason in the plan** (`00-planning/plan-template.md`, roof section): "Span 9,
   run 11, Vale side street, two storeys: bell-cast gable, gable to the street, because the plan is
   longer than wide and the neighbours on both sides have their ridges along the street."

## Dressing any roof (from `roof-dormers-curled-verges.png` and `detailed-hall-hanging-chains.png`)

- **Curled verges**: the gable edge ends in a small upturned curl (`roof-dormers-curled-verges.png`).
  Shape not settled: the first try (an upside-down stair one out beside the verge foot) read as a block
  floating off the roof corner, so it is off until Mateo shows how he builds the curl tip.
- **Dormers** with their own little gable and curled verge, on the bay lines (README step 7).
- **Ridge spikes** (standard on every pitched ridge, Mateo 2026-11-12: "they add an awesome layer of depth"): a short spike every 3 or 5 blocks along the ridge (odd,
  centred on the ridge's centre block): an end rod or a wall block with a lightning rod or a fence post on
  top, in a dark metal or the trim wood. Taller ones at the gable peaks (finials).
- **Hanging lanterns at the verge tips**: a chain hanging 2 to 4 blocks from the lowest verge stair with a
  lantern at the end, at both front corners of a gable.
- **Edge contrast**: use a different block for the verge and eaves row than the roof field (the chart's
  last line), a darker or the trim wood.
