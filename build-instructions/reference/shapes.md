# Shape library

Small, repeatable shapes made from stairs, slabs, trapdoors, walls and fences. Every diagram is drawn
looking at a south-facing wall from outside (west on the left, east on the right) unless it says
"section" (a cut through the wall, outside on the right).

Legend: `#` wall, `.` open/air, `G` glass, `D` door, `J` jamb, `L` log, `S` slab (`St` top, `Sb`
bottom), `r` stair right way up, `u` stair upside down, `T` trapdoor (`Tt` closed in the top half,
`To` open), `F` fence, `W` wall block. Arrows after a stair show its tall side: `u<` = upside-down stair
with the tall side to the west.

## Round angle: trapdoor, stair, trapdoor

Mateo, 2026-11-11: "trapdoor stair trapdoor ... not even archways but for a round angle". This is the
general way to round **any 90-degree inside corner** where two surfaces meet, so it reads as a curve
instead of a sharp step:

```
section through the corner (wall on the left, ceiling/overhang on top):

#  #  #
#  u  Tt        upside-down stair in the corner, closed trapdoor (top half) along the top surface
#  To .         open trapdoor standing against the side surface
#  .  .
```

The trapdoor on each side is thin, the stair fills the corner, so the eye follows one smooth curve from
one surface to the other. Use it:

- at the top corners of doorways, windows and arches (the archway below),
- where an overhang meets the wall: under jetties, eaves, balconies, the underside of a canopy,
- where a ceiling meets the walls inside halls and custom interiors (a coved ceiling),
- at the foot of a wall meeting the ground or a plinth (upside down: right-way stair with trapdoors
  open against the wall and closed in the bottom half on the ground),
- round the inside corners of dome drums, tower bases, buttress steps and roof valleys seen from below.

Turn it to face the corner it rounds; the stair's tall side always points into the corner. Trapdoors in
the trim wood, or a colour-matched trapdoor, on timber and stone alike.

## Arches

**3-wide round arch** (doorways, arcades, alleys). Opening 3 wide; the top row has stairs in the corners.

```
#  #  #  #  #
#  u< .  u> #      top row of the opening: left stair tall side west (against the left jamb),
#  .  .  .  #      right stair tall side east (against the right jamb), centre open
#  .  .  .  #
```

**3-wide trapdoor arch** (lighter, timber): `Tt` in both top corners instead of stairs.

```
#  #  #  #  #
#  Tt .  Tt #
#  .  .  .  #
```

**5-wide arch**: stair, top slab, open, top slab, stair in the top row; on openings 5 tall or more, a
second pair of stairs one row down in the outer cells.

```
#  #  #  #  #  #  #
#  u< St .  St u> #
#  u< .  .  .  u> #     (second pair only on tall openings)
#  .  .  .  .  .  #
```

**7-wide arch**: top row `u< St . . . St u>`, second row `u< . . . . . u>`. Build any width as stair at the jambs, slabs stepping inward, centre open, one row
lower each step out on tall openings.

**Trapdoor, stair, trapdoor archway**: the round angle (below) used at the top corners of an opening. The
default archway. Each top corner of the opening turns the curve with three pieces: an open trapdoor
standing against the jamb under the corner, an upside-down stair in the corner, and a closed top
trapdoor on the ceiling next to it. The trapdoors are thin, so the curve runs smoothly from the jamb,
round the stair, into the head.

5-wide opening, 4 tall:

```
#   #   #   #   #   #   #
#   u<  Tt  .   Tt  u>  #      top row: stair in each corner, top trapdoor beside it, centre open
#   To  .   .   .   To  #      open trapdoor against each jamb under the stair
#   .   .   .   .   .   #
#   .   .   .   .   .   #
```

3-wide opening: `u< . u>` on the top row with `To` under each stair (no room for the ceiling trapdoor),
or for a 3-wide doorway in a thick wall, `Tt u Tt` across the head with `To` down both jambs.

Wider openings repeat the step: `To` on the jamb, `u` in the corner, `Tt` beside it, then the next row up
starts the next step inward. Always symmetric about the centre block. Trapdoors in the trim wood (or a
colour-matched trapdoor) on timber and stone alike.

**Slab, stair, slab head** (alternative): top slab, upside-down stair (tall side out, the keystone), top
slab, as a cap above an opening.

**Carriage arch** (through a range, `vale.coaching_inn`): 3 wide, 4 tall, upside-down stairs in the top
corners, chiseled stone at the feet of the jambs, the passage paved.

## Sills

Section (outside on the right) for a 1-wide window, sill one block out:

```
#  G  .        glass flush with the wall face (never recessed)
#  #  r<       right-way stair, tall side against the wall (in bp.py: facing towards the wall)
#  #  .
```

Front view, sill wider than the glass (1-wide window gets a 3-wide sill):

```
   #  G  #
   r  r  r     the end stairs may turn sideways (end caps) or be bottom slabs
```

**Slab sill with brackets** (stone, grand): a row of bottom slabs 2 wider than the glass, an
upside-down stair under each end.

```
   #  G  G  G  #
Sb Sb Sb Sb Sb
u              u      brackets under the ends, tall side to the wall
```

## Heads and caps

```
St St St St St       cap: top slabs 2 wider than the glass (or upside-down stairs, tall side to the wall)
#  L  L  L  #        the beam (timber) or lintel (stone)
#  G  G  G  #
```

Crown on a large window: one more block or slab centred above the cap.

## Surrounds

Front view of a 1 x 2 window with a trapdoor surround (trapdoors upright against the wall, one block out):

```
   St St St
To  G      To       side trapdoors stand in front of the wall either side of the glass
To  G      To
   r  r  r          sill
```

## Brackets and corbels

Section under a 1-block jetty:

```
   L #           upper post, jettied 1 out
#  u<            upside-down stair under every upper post, tall side against the lower wall
#
```

Two-block overhang: log (axis out of the wall) under the inner cell, upside-down stair under the outer.

## Canopy over a door

```
r  r  r          trim stairs right way up, tall side to the wall, at lintel + 1
u     u          brackets under the ends (or one hanging lantern at each end, not both)
J  D  J
J  D  J
```

## Trusses

See `06-roof` for the full table. Section across a hall, span 9:

```
            r Sb r                 ridge
          r   L   r                king post L under the ridge
        r   u L u   r              braces: upside-down stairs either side of the post
      r L L L L L L L r            tie beam (logs, axis across) at the wall plate
      # u           u #            brackets under the beam ends, tall side to the wall
```

## Buttress

Side view, a 2-block buttress on a 9-tall wall:

```
#  .  .
#  r  .      stair cap at the top (tall side to the wall)
#  #  .
#  #  .
#  #  r      step in at mid height
#  #  #
#  #  #
```

## String course and cornice

Section:

```
#  u      string course: upside-down stair, tall side to the wall, at a floor line
#
#  St     cornice: top slab row above an upside-down stair row, under the eaves
#  u
```
