// Turns the map's planned railway (map/rail-segments.json) into Siege_Nights_BP/scripts/trains/routes_data.js.
//   node tools/make_routes.mjs [path/to/rail-segments.json]
// Input: { stops: [{ id, name, x, y, z, kind, plot? }], segments: [{ id, line, from, to, blocks: [[x, y, z, kind, dir]], length }] }
import { readFileSync, writeFileSync } from "node:fs";
import { checkRoutes } from "../Siege_Nights_BP/scripts/trains/routes.js";

const src = process.argv[2] ?? "map/rail-segments.json";
const raw = JSON.parse(readFileSync(src, "utf8"));
const data = {
  stops: raw.stops.map(({ id, name, x, y, z, kind, plot }) => ({ id, name, x, y, z, kind, ...(plot !== undefined && { plot }) })),
  segments: raw.segments.map(({ id, line, from, to, blocks, length, works, works_palette }) => ({ id, line, from, to, blocks, length: length ?? blocks.length, ...(works && { works, works_palette }) })),
};
const problems = checkRoutes(data);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
const out = "Siege_Nights_BP/scripts/trains/routes_data.js";
writeFileSync(out, `// The planned railway: every stop and every stretch of track between neighbouring stops, laid only when bought
// (routes.js). Generated from ${src} by tools/make_routes.mjs: don't edit by hand.
export const ROUTES = ${JSON.stringify(data)};
`);
const bytes = Buffer.byteLength(JSON.stringify(data));
if (bytes > 2.2e6) {
  console.error(`routes_data would be ${(bytes / 1e6).toFixed(2)} MB: keep it at or under about 2 MB (the Realm loads it as script)`);
  process.exit(1);
}
console.log(`${(bytes / 1e6).toFixed(2)} MB. ${out}: ${data.stops.length} stops, ${data.segments.length} stretches, ${data.segments.reduce((n, s) => n + s.blocks.length, 0)} track blocks`);
