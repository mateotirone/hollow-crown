import { addTests, assert, assertEqual } from "../core/tests.js";
import { hudString, readHud, arrowDir, placeName, regionAt, cleanLabel, pinCode, ORIGIN, TILE, TILES, PLACES, PIN_COLS, PIN_ROWS, PIN } from "./data.js";
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
      assertEqual(r.tile, "x" + String(tx).padStart(2, "0") + "z" + String(tz).padStart(2, "0"), `tile at ${x},${z}`);
      assertEqual(r.dir, "qrstuvwy"[arrowDir(yaw)], `dir at ${x},${z}`);
      assert(!/^[0-9.]+$/.test(r.dir) && !/^[0-9.]+$/.test(r.tile), "no piece the HUD cuts out may look like a number");
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
    assertEqual(readHud(hudString({ x: 5000, z: 0, yaw: 0 })).tile, "none__");
    const other = readHud(hudString({ x: 0, z: 0, yaw: 0, charted: false }));
    assertEqual([other.tile, other.label], ["none__", "Uncharted"]);
    assertEqual(readHud(hudString({ x: 0, z: 0, yaw: 0, off: true })).tile, "off___");
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
  "a quest pin inside the view sits in its own cell": () => {
    const x0 = ORIGIN + 20 * TILE, z0 = ORIGIN + 20 * TILE; // the middle tile; the view starts one tile west and north
    const r = readHud(hudString({ x: x0 + 10, z: z0 + 10, yaw: 0, pin: { x: x0 - TILE + 1, z: z0 + 2 * TILE - 1, kind: "goal" } }));
    assertEqual([r.col, r.row, r.kind], ["a", "r", PIN.goal], "south-west corner of the view");
    const mid = readHud(hudString({ x: x0 + 10, z: z0 + 10, yaw: 0, pin: { x: x0 + 32, z: z0 + 32, kind: "talk" } }));
    assertEqual([mid.col, mid.row, mid.kind], ["e", "n", PIN.talk], "middle of the view");
    assertEqual(mid.label, cleanLabel(placeName(x0 + 10, z0 + 10)), "the label still reads back");
    assertEqual(readHud(hudString({ x: x0, z: z0, yaw: 0 })).kind, PIN.none, "no pin");
  },
  "a quest pin further away is held on the rim, the way it lies": () => {
    const x0 = ORIGIN + 20 * TILE, z0 = ORIGIN + 20 * TILE, x = x0 + 32, z = z0 + 32;
    const code = (dx, dz) => pinCode(x, z, 20, 20, { x: x + dx, z: z + dz });
    assertEqual(code(5000, 0), "i" + "n" + PIN.edge, "far east: east rim, middle row");
    assertEqual(code(0, -5000), "e" + "j" + PIN.edge, "far north: top rim, middle column");
    assertEqual(code(-5000, 5000), "a" + "r" + PIN.edge, "far south-west: that corner");
    for (const [dx, dz] of [[300, 77], [-120, -900], [999, 999], [-1, 4000]]) {
      const c = code(dx, dz);
      assert(PIN_COLS.includes(c[0]) && PIN_ROWS.includes(c[1]) && c[2] === PIN.edge, c);
      assert(c[0] === "a" || c[0] === "i" || c[1] === "j" || c[1] === "r", `on the rim: ${c}`);
    }
  },
  "another map's grid passes its own origin": () => {
    const o = { x: -704, z: -64 };
    assertEqual(pinCode(o.x + 96, o.z + 96, 1, 1, { x: o.x + 1, z: o.z + 1 }, o), "a" + "j" + PIN.goal);
  },
  "pin letters never clash with the HUD's cutting": () => {
    for (const ch of PIN_COLS) assert(!PIN_ROWS.includes(ch), ch);
    assertEqual(readHud(hudString({ x: 0, z: 0, yaw: 0, off: true, pin: { x: 5, z: 5 } })).tile, "off___");
    assertEqual(readHud(hudString({ x: 0, z: 0, yaw: 0, charted: false, pin: { x: 5, z: 5 } })).label, "Uncharted");
  },
});
