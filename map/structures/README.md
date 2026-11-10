# Map structures

Buildings for the map are written as code, not built by hand and not made by
text-to-3D tools (which give wavy walls and wrong-size doors). Each region gets
parametric builders that follow the rules good Minecraft builders use; every
build is checked in a render with Mojang's real Bedrock textures before anyone
reviews it. Research behind this: https://claude.ai/artifact/SLVb4v5eoLULb6btyfFcmf

| File | What it is |
| --- | --- |
| `bp.py` | Blueprint grid, Bedrock state checks, `.mcstructure` and stamp-JSON writers |
| `bedrock_states.json` | Every vanilla block and its states, trimmed from Mojang's `bedrock-samples` metadata |
| `kit.py` | Building parts: stone and timber storeys, jetties, windows, doors, roofs from a height field, chimneys, palettes |
| `vale.py` | Aldmere Vale buildings (coaching inn, town house generator) |
| `build_kingsrest_proof.py` | The proof build: Kingsrest inn plus a street of houses |
| `render/` | Preview renderer: `mesher.py` (real block shapes, face culling, ambient occlusion), `viewer.tpl.html` (three.js page), `shoot.cjs` (headless screenshots) |

## Outputs

Each building is written as `<name>.mcstructure` (load with `/structure load` or
the script API's `world.structureManager`) and `<name>.stamp.json`
(`palette` + `blocks` as `[x, y, z, palette index]`, offsets from `origin`).
y = 0 is the ground surface; cells not listed are left as they are. Town
blueprints use vanilla blocks only, so the world writer can stamp them.

## Rebuild the proof and its previews

Needs Mojang's textures (not in this repo) and three.js 0.170.0:

    git clone --depth 1 --filter=blob:none --sparse https://github.com/Mojang/bedrock-samples.git
    (cd bedrock-samples && git sparse-checkout set --no-cone 'resource_pack/textures/blocks/**')
    npm i three@0.170.0
    python3 build_kingsrest_proof.py out --render --dusk \
        --textures bedrock-samples/resource_pack/textures/blocks --three node_modules/three

`out/viewer.html` is a self-contained 3D viewer; `out/shot-*.png` are the renders.

## Needs an in-game check

- Trapdoor `direction` numbers (shutters) are mapped as 0 east, 1 west, 2 south, 3 north.
- Footprints over 64 x 64 should be cut into tiles for `/structure load`.

## Building catalogue

    python3 build_catalogue.py OUT --textures <bedrock-samples>/resource_pack/textures/blocks --three <node_modules/three>
    python3 render/catalogue_page.py OUT catalogue.html

One picture per design per style plus catalogue.json (size, floors, blocks, map spot). Add every new design to DESIGNS in build_catalogue.py.
