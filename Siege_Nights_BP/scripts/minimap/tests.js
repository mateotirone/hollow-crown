import { addTests, assert, assertEqual } from "../core/tests.js";
import { hudString, readHud, arrowDir, placeName, regionAt, cleanLabel, ORIGIN, TILE, TILES, PLACES } from "./data.js";
import { REGION_ROWS, REGION_CELL } from "./regions.js";

addTests("minimap", {
  "the arrow points the way the player faces": () => {
    assertEqual(arrowDir(180), 0, "north");
    assertEqual(arrowDir(-90), 2, "east");
    assertEqual(arrowDir(0), 4, "south");
    assertEqual(arrowDir(90), 6, "west");
    assertEqual(arrowDir(-135), 1, "north-east");
    assertEqual(arrowDir(-180), 0, "north the other way round");
  },
  "the HUD reads back what the script sends": () => {
    for (const [x, z, yaw] of [[-150, -150, 0], [1270, -1270, 45], [-1280, 1279, -90], [0.5, 0.5, 170], [700, 60, 12]]) {
      const s = hudString({ x, z, yaw });
      const r = readHud(s);
      const tx = Math.floor((x - ORIGIN) / TILE), tz = Math.floor((z - ORIGIN) / TILE);
      assertEqual(r.tile, String(tx).padStart(2, "0") + String(tz).padStart(2, "0"), `tile at ${x},${z}`);
      assertEqual(r.dir, String(arrowDir(yaw)), `dir at ${x},${z}`);
      assert("abcdefghijklmnop".includes(r.spot) && r.spot.length === 1, `spot at ${x},${z}: ${r.spot}`);
      assertEqual(r.label, cleanLabel(placeName(x, z)), `label at ${x},${z}`);
    }
  },
  "the arrow spot follows the position inside the tile": () => {
    const x0 = ORIGIN + 20 * TILE, z0 = ORIGIN + 20 * TILE;
    assertEqual(readHud(hudString({ x: x0 + 1, z: z0 + 1, yaw: 0 })).spot, "a");
    assertEqual(readHud(hudString({ x: x0 + 63, z: z0 + 1, yaw: 0 })).spot, "d");
    assertEqual(readHud(hudString({ x: x0 + 1, z: z0 + 63, yaw: 0 })).spot, "m");
    assertEqual(readHud(hudString({ x: x0 + 63, z: z0 + 63, yaw: 0 })).spot, "p");
  },
  "off the map, other dimensions and hidden": () => {
    assertEqual(readHud(hudString({ x: 5000, z: 0, yaw: 0 })).tile, "none");
    const other = readHud(hudString({ x: 0, z: 0, yaw: 0, charted: false }));
    assertEqual([other.tile, other.label], ["none", "Uncharted"]);
    assertEqual(readHud(hudString({ x: 0, z: 0, yaw: 0, off: true })).tile, "off_");
  },
  "settlements are named, and the land between by region": () => {
    assertEqual(placeName(-150, -150), "Kingsrest");
    assertEqual(placeName(700, 60), "Redmesa");
    assertEqual(regionAt(-1200, 0), "The Western Sea");
    assert(["Aldmere Vale", "Frostmarch", "Saltreach", "Blackfen", "Emberwaste"].includes(regionAt(0, 0)), regionAt(0, 0));
  },
  "labels never carry digits or the separator": () => {
    for (const p of PLACES) assert(!/[0-9|]/.test(cleanLabel(p.name)), p.name);
    assertEqual(cleanLabel("the 3rd | §6Gate"), "The rd  Gate");
  },
  "the region grid covers the whole map": () => {
    assertEqual(REGION_ROWS.length, (TILES * TILE) / REGION_CELL);
    assert(REGION_ROWS.every((r) => r.length === REGION_ROWS.length));
  },
});
