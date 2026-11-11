# Shape library

Small, repeatable shapes made from stairs, slabs, trapdoors, walls and fences. Every diagram is drawn
looking at a south-facing wall from outside (west on the left, east on the right) unless it says
"section" (a cut through the wall, outside on the right).

Legend: `#` wall, `.` open/air, `G` glass, `D` door, `J` jamb, `L` log, `S` slab (`St` top, `Sb`
bottom), `r` stair right way up, `u` stair upside down, `T` trapdoor (`Tt` closed in the top half,
`To` open), `F` fence, `W` wall block. Arrows after a stair show its tall side: `u<` = upside-down stair
with the tall side to the west.

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

**Slab, stair, slab head** (Mateo's example), a cap above a 3-wide opening, in the wall plane or 1 proud:

```
St u St          top slab, upside-down stair (tall side out, the keystone), top slab
.  .  .          the opening below
```

**Trapdoor, stair, trapdoor head**: the same with `Tt` at the ends, for a thinner edge on timber.

**Carriage arch** (through a range, `vale.coaching_inn`): 3 wide, 4 tall, upside-down stairs in the top
corners, chiseled stone at the feet of the jambs, the passage paved.

## Sills

Section (outside on the right) for a 1-wide window, sill one block out:

```
#  G  .        glass in the wall plane (flush timber) or one block in (stone)
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
