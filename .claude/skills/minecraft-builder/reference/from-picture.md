# Rebuilding a building from a picture

Load when someone sends a screenshot, photo or drawing and wants it in Minecraft. Code: `scripts/picture.py`.
The picture gives the facts (sizes, colours, which parts exist). The spec and the parts library do the
blocks. You never place blocks by eye, and you never pick colours by eye either.

## Steps

1. **Grid it.** `picture.py grid IMG OUT/grid.png --step 50` and look at `grid.png`. Every box you
   name from now on is read off this grid.
2. **Read the building, part by part.** Write down, from the picture:
   - the plan: rectangle, L, T, or a cross, and which way the ridge runs;
   - storeys, jetties, plinth height, where the frame posts sit;
   - the roof: type (gable, hip, half-hip), pitch, overhang, dormers, chimney;
   - openings: door kind (house / grand / large), window sizes, shutters, sills, arches;
   - details: string courses, buttresses, lanterns, balconies, porches, planters, vines.
   Each item maps to a part in `reference/parts.md`. Anything that has no part goes in `shapes` or
   `place`, and you mention it to the person.
3. **Measure.** Count blocks along an edge that faces the camera. A Minecraft texture shows its 16-pixel
   grid, so one block is easy to see. Measure one block's pixel size on a face, then
   `picture.py measure --px <edge length> --block-px <one block>`. Measure each face on that face only,
   because perspective shrinks the far end. Round to odd numbers (house rule). Storeys are 4 or 5.
   When two counts disagree, trust the one nearer the camera.
4. **Sample the colours.** First, if the picture has fog, haze, shaders, sunset or the Hollow's purple
   light, add `--calibrate x0 y0 x1 y1 BLOCK` on a box whose block you are sure of. Then:

       picture.py sample IMG --region roof ... --region walls ... --region frame ... --region plinth ...

   Pick small boxes on one material each, on the most evenly lit face. Each region returns `block`,
   `also` (the next two candidates), `light` (how much the face was darkened) and, when it sees two
   close tones, a `texture` partner ready for `materials`. `mixed` means the box held two materials, so
   split it. When `light` is at its floor (0.3), the face is in deep shadow: sample a brighter face of
   the same material. When the picture shows logs, glazed or chiseled blocks, add `--any`. In a project
   region, cross-check the result against its palette in `build-instructions/palettes/`.
   `picture.py palette IMG --box ...` lists the main colours of a whole area when you are unsure what
   is there.
5. **Write the spec** from steps 2 to 4: a `house` part (or several for L/T plans) with the measured
   rect, storeys and roof, materials from step 4, and parts for every detail you listed.
6. **Build and compare.** `build.py spec OUT --stages`, then
   `picture.py compare IMG OUT/preview.png OUT/compare.png`, and look at `compare.png`. Check
   proportions first (height to width, roof height, overhang), then openings, then colour, then details.
   Fix the spec and repeat. Do at least 3 rounds before showing anyone.
7. **Say what you guessed.** A picture shows two sides at most. Mirror the visible sides onto the hidden
   ones, and tell the person which sides, the interior, and any part you could not build were guesses.

## What a picture cannot tell you

- Hidden sides and the back of the roof: mirrored, then flagged.
- Exact block where two blocks look alike in that light: the result names `also`; ask, or use the
  region palette.
- Custom blocks or resource-pack textures: the matcher only knows the vanilla palette. Regenerate the
  palette from the pack (`reference/colour.md`) if the picture uses one.
