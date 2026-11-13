// Where everything in the arena is. The arena build thread ("Build the grand arena at Kingsrest") writes the
// real coordinates into ARENA below, generated from its build, in exactly this shape. Until then ARENA is a
// placeholder ring at Kingsrest, and `/scriptevent siege:arena_test` can put a rough test arena anywhere
// (it saves its own centre and ringLayout() below describes it).

import { ARENA_DATA } from "./layout_data.js";
//
//   name        the arena's name, used in every sign and message (Mateo is picking it; "the Arena" until then)
//   dim         dimension id
//   center      the middle of the fighting floor (standing height): mob fights spawn here
//   floorRadius how far from the centre the floor reaches; a fighter further out than floorRadius + LEAVE_MARGIN
//               (config.js) who is not in their own room has left the fight
//   rooms[12]   one per settlement colour, clockwise from north:
//     color     Bedrock dye name (the same names keep banners use)
//     spawn     where fighters stand in the room (a team of up to 6 shares it)
//     board     the block they click to pick their kit and say they are ready (a lectern, or any clickable block)
//     gate      { from, to }: the 3 wide x 4 high siege:portcullis that rises to let them out
//     out       a floor spot just past the gate
//   seats       standing spots on the tiers; the crowd uses a share of them, only while a fight is on
//   sign        the "Start a battle" block in the entrance hall (a lectern, or any clickable block)
//   signs       optional: [{ kind: "king" | "mob", x, y, z }], boards that go straight to one kind of battle

export const ROOM_COLORS = ["red", "orange", "yellow", "lime", "green", "cyan", "light_blue", "blue", "purple", "magenta", "pink", "white"];

// Colour codes for chat and menus, closest § colour to each dye
export const COLOR_CODE = {
  red: "§c", orange: "§6", yellow: "§e", lime: "§a", green: "§2", cyan: "§3", light_blue: "§b", blue: "§9",
  purple: "§5", magenta: "§d", pink: "§d", white: "§f",
};

export const colorName = (c) => c.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

// The room gates are the castle portcullis (Mateo, 2026-11-13: "the same mechanic as the castle metal gate"):
// opened and shut with setGate() like any castle gate, so it rises leaving only its top row in sight. Make it
// 4 high so the way out under the raised top row is 3 high. Players can't click it open; the arena works it.
export const GATE_BLOCK = "siege:portcullis";

// The test arena (and the placeholder) as numbers: rooms in a ring around the floor, gates facing the middle.
export const RING = { floorRadius: 21, roomRing: 28, roomHalf: 4, wallHeight: 5, seatRing: 40, seatRise: 4 };

const round = (v) => Math.round(v);

// A ring arena around `center`. Pure, so the tests can check it.
export function ringLayout(center, name = "the Arena", dim = "minecraft:overworld") {
  const { floorRadius, roomRing, roomHalf, seatRing, seatRise } = RING;
  const cx = round(center.x), cy = round(center.y), cz = round(center.z);
  const rooms = ROOM_COLORS.map((color, i) => {
    const a = (i / 12) * Math.PI * 2; // 0 = north (-z), clockwise seen from above (+x is east)
    const dx = Math.sin(a), dz = -Math.cos(a);
    const rx = cx + round(dx * roomRing), rz = cz + round(dz * roomRing);
    // the gate sits in the room wall that faces the middle: whichever axis points there most
    const alongX = Math.abs(dx) >= Math.abs(dz);
    const sx = alongX ? -Math.sign(dx) : 0, sz = alongX ? 0 : -Math.sign(dz);
    const gx = rx + sx * (roomHalf + 1), gz = rz + sz * (roomHalf + 1);
    const gate = alongX
      ? { from: { x: gx, y: cy, z: gz - 1 }, to: { x: gx, y: cy + 3, z: gz + 1 } }
      : { from: { x: gx - 1, y: cy, z: gz }, to: { x: gx + 1, y: cy + 3, z: gz } };
    return {
      color,
      spawn: { x: rx, y: cy, z: rz },
      board: { x: rx - sx * (roomHalf - 1), y: cy, z: rz - sz * (roomHalf - 1) },
      gate,
      out: { x: gx + sx * 2, y: cy, z: gz + sz * 2 },
    };
  });
  const seats = [];
  for (let k = 0; k < 96; k++) {
    const a = (k / 96) * Math.PI * 2;
    seats.push({ x: cx + round(Math.sin(a) * seatRing), y: cy + seatRise, z: cz + round(-Math.cos(a) * seatRing) });
  }
  return {
    name, dim,
    center: { x: cx, y: cy, z: cz },
    floorRadius,
    rooms,
    seats,
    sign: { x: cx, y: cy, z: cz - seatRing - 4 },
  };
}

// The live arena: the real build at Kingsrest (layout_data.js, copied from the build's map/arena-layout.json).
// Its name is the Twelve Gates (Mateo, 2026-11-13); ARENA_DATA.name overrides it if the build sets one.
export const ARENA = { ...ARENA_DATA, name: ARENA_DATA.name ?? "the Twelve Gates" };
