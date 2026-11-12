# Towers: how to build one (Mateo, 2026-11-12)

Every tower in the game follows this page: bell towers on chapels, clock towers, the capital hall's corner
towers, watch towers, wall towers, wonders, lighthouses and stair turrets. Read it after the region page and
before stage 0. The parts named here are in the skill (`reference/parts.md`): `house` for the shaft,
`string_course`, `buttress`, `belfry`, `clock_face`, `spire`. Pictures: `reference/pictures/tower-clock-medieval.png`
and `chapel-*.png` (Mateo's references).

## 1. What makes a tower read as a tower

A real tower is built in **stages**, and each stage looks different from the one below. A box with a roof on
top reads as a tall house. Mateo's references all share five things:

1. **A plain, solid shaft.** It is tall and pale, with few openings, and its corners are stronger than its
   faces (quoins, clasping buttresses or pilasters).
2. **Stages marked by courses.** A string course (a row of upside-down stairs or a slab band) runs round the
   tower every 5 to 7 blocks, so the eye counts the stages.
3. **A top stage that changes.** The bell or clock stage is where the tower opens up. It has the biggest
   openings: paired lancets with louvres, open round arches, or a clock. Often it is in a different material
   (timber on stone), and it overhangs the shaft by one block on brackets (corbels) or steps in.
4. **A roof taller than you expect.** Spires and helm roofs are steep: at least 1.5 times the tower's width
   high, and on chapels up to the height of the shaft. The bottom ring flares out (a bellcast eave: one ring
   of stairs over the overhang with upside-down trim under it). The roof is never a low pyramid sitting on a
   box, and never the same pitch as the house roofs around it.
5. **A finish on top.** That is a small open lantern (a cupola: four posts, a bell or a lantern, and its own
   tiny spire), a spire top block, a lightning rod, or a weathervane. It is never a bare point.

Silhouette rule: the outline changes **at least three times** from the ground to the tip (base, shaft, top
stage, roof, finial). If you squint at the render and the tower is one rectangle plus a triangle, it is not
done.

## 2. Proportions

| | Rule |
|---|---|
| Width | Odd: 5, 7, 9 or 11 (a stair turret is 3 or 5) |
| Shaft height | 3 to 5 times the width. A chapel tower is 2.5 to 4 times. |
| Stages | Every 5 to 7 blocks. Top stage (belfry or clock) 5 to 7 high. |
| Overhang of a timber top stage | 1 block on every side, carried on brackets under each corner and every 3rd block |
| Roof | Helm or pyramid: rows 2 (`spire` `rows: 2`). Spire: rows 3. Broach spire on square stone towers |
| Against a building | The tower rises **at least one full stage clear of the highest ridge** next to it |
| Beside a dome or a taller centre | Corner towers stay lower than the centre and frame it. They never compete with it. |

## 3. Building it, stage by stage

1. **Base.** Plinth 2, a battered or stepped first course on big towers, the door on a bay centre (05), and
   no window lower than the first floor on watch or wall towers.
2. **Shaft.** Use `house` with storeys of 5 to 7 and `frame_kind: "stone"` (quoins), or add `buttress` at the
   corners. Windows: 1x2 slits low down and 1x3 lancets higher. Windows stack centre on centre (05, windows
   line up). One round or cross window mid-shaft is a good accent (`chapel-white-tower.png`).
3. **Courses.** Run a `string_course` at every stage line, and a cornice of two rows under the top stage.
4. **Top stage.** Pick one:
   - **Belfry** (`belfry`): open arches on every face, louvres of trapdoors, the bell on a beam.
   - **Clock stage**: a jettied timber storey (section 5).
   - **Lantern room** (lighthouse): glass all round, a gallery of fence or wall on top slabs one out.
   - **Battlements** (watch, wall and castle towers): a parapet with crenels on corbels (machicolations: a
     row of upside-down stairs one out, the merlons on top).
5. **Roof.** Use `spire` on the top stage's walls: an eave ring over the overhang, then rings stepping in. A
   short helm needs rows 2, a tall spire rows 3, and an octagonal one is `kind: "broach"`. Never put a slab
   under the spire top block.
6. **Finial.** Use a small open lantern on tall spires (a 3x3 `belfry` with `h: 2` and `cap: "spire"`), or the
   spire top block, or a rod.
7. **Joining.** Where a roof meets the tower wall, its top row tucks tight against the wall (flashing: full
   blocks or upside-down stairs) with no sky between them. A wing's roof runs **into** the tower or a drum.
   It never stops short of it in the air (Mateo, 2026-11-12, capital hall).
   A round tower joined into a house is the skill's `keep` with `"cap": "cone"`, built after the house so
   it clears its own shaft and the house roof tucks against it.
8. **Leaning towers** (the Hollow only): the whole shaft leans in two or three clean one-block steps
   (`"lean": {"dir": "e", "steps": 2}`), each step carried on brackets. Never a staircase of single-block
   shifts.

## 4. The clock (Mateo, 2026-11-12: "there are much better ways that clocks are made")

A clock is the most-looked-at thing on a tower. Build it like this (`tower-clock-medieval.png`):

- **Size.** The face is 5x5 (7x7 on towers 9 or wider) with its corners cut, so it reads round. Never 3x3 on
  a tower.
- **Its own stage.** The clock sits in the top stage, usually a timber storey jettied one block out over the
  stone shaft on corbels. The eave of the roof comes down just above it.
- **A frame.** A raised frame one block out round the face, made of trim stairs (upside down along the top,
  right way up along the bottom) or trapdoors, in the stage's dark wood. The face stays flush in the wall,
  so the frame casts a shadow line.
- **The face.** Calcite, smooth quartz or birch planks, plain and pale.
- **Hour marks.** Dark blocks or buttons at 12, 3, 6 and 9, just inside the rim.
- **Hands.** Dark blocks (polished blackstone or dark oak) from the hub: the minute hand long, the hour hand
  one shorter. They point at a real time, not a symmetric cross. Use a button or a dark block for the hub.
- **Faces.** One on every face that looks onto a street or square, and all of them show the same time.
- **Nothing in front of it.** No sill, shutter or lantern crosses the face.

The skill's `clock_face` does all of this with `size: 5` (or 7), `frame: "stairs"`, `marks: true` and
`stage: true` (the jettied timber stage with corbels).

## 5. Themes: towers by region

| Theme | Shaft | Top stage | Roof and finish |
|---|---|---|---|
| **Vale** (market towns, chapels) | Stone brick and andesite, quoins, string courses | Stripped-spruce timber, jettied on corbels, calcite infill; a clock or louvred belfry | A steep red-brick, slate or copper spire with a flared eave and an open lantern on top. Copper is for civic towers only. |
| **Frostmarch** | Dark stone base, then dark oak stave (plank rows) | Tiered stave stages, each with its own shingle skirt one out (a stave-church look) | A steep slate spire, dragon heads at the eave corners, snow on every ledge |
| **Saltreach** | Round or square, whitewash and sandstone, few windows | Open arches or a lantern room with a gallery | A low sea-green hip or dome cap, or flat with a lantern. No needle spires. |
| **Emberwaste** | Square sandstone, battered base, small deep windows | An open lantern with pointed arches (a minaret top) | A flat parapet with crenels, vigas out through the walls, a small dome or gold finial. Never a pitched spire. |
| **Blackfen** | Mud brick on mangrove piles, mangrove frame above | A hooded timber stage | A dark shingle hood roof with moss, a lantern hung under the hood |
| **Castle / Citadel** | Round or square castle stone, arrow slits | Machicolated battlements | A conical cap (optional) with a flag or rod. Round keeps: the skill's `keep` part (corbels, deck, parapet, merlons, flags); yard walls with turrets and a gate: `curtain` (Barracks, 2026-11-12) |
| **Hollow** | Blackstone and veinstone | Offset one block, once (`offset`), never sheared | A steep deepslate spire, soul lanterns |

## 6. Before you move on

- [ ] At least three changes of outline from base to finial; stages marked by courses.
- [ ] The shaft is 3 to 5 times its width; every width is odd.
- [ ] The top stage is different: a belfry, clock, lantern or battlements, overhanging on brackets or stepped.
- [ ] The roof is steep, with a flared eave and a finial; no slab under a spire top.
- [ ] The tower stands one stage clear of the ridges next to it, and roofs meet its walls with no gap.
- [ ] Clocks are 5x5 or bigger, framed, with marks and real hands, on every street face.
- [ ] It follows its region's row in section 5.
