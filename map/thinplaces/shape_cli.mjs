// Shape the land at one thin place. Run by land.py (and so by genworld.py):
//   node shape_cli.mjs < in.json > out.json
// in and out are shape_grid.mjs's, plus x and z in the input (not used here).
import fs from "node:fs";
import { shapeGrid } from "./shape_grid.mjs";

process.stdout.write(JSON.stringify(shapeGrid(JSON.parse(fs.readFileSync(0, "utf8")))));
