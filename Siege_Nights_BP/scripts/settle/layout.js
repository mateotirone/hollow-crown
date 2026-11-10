// The plot layout: where everything in a finished settlement stands, mapped out before anything is
// built. One layout for every plot, every region and every Rival Lord, turned so the hall's door
// looks across the Keep Banner toward the gate. Pure math, runs in Node.
//
// Measured in the hall's own directions from the Plot Stone: `ahead` = away from the gate (into the
// settlement), `right` = to the right when you stand at the gate looking in. f = which way a
// building runs, in the same terms.
//
//                 gate (wall, 56 out)
//        market        |  library   watchtower
//   cottage    well    |    cottage
//        ------- Keep Banner -------
//   stable     [ town hall, grows   ]   smithy
//   watchtower [ back from here     ]   storehouse
//                 garden behind the cottages

export const HALL = { right: 0, ahead: 5 }; // the Hall Cornerstone: the hall grows away from the gate from here
export const MASON = { right: 6, ahead: -5 }; // the Mason's Bench, beside the banner

// tier: the settlement tier that opens the slot (0 Hamlet, 1 Town, 2 City, 3 Castle). who: the villager it is for.
export const SLOTS = [
  { id: "cottage_west", building: "cottage", tier: 0, right: -10, ahead: -6, f: "back", who: "you" },
  { id: "well", building: "well", tier: 0, right: 0, ahead: -8, f: "back", who: "everyone" },
  { id: "library", building: "library", tier: 0, right: 11, ahead: -18, f: "back", who: "everyone", arrival: true }, // raised on arrival, holds the town's own books
  { id: "cottage_east", building: "cottage", tier: 1, right: 10, ahead: -6, f: "back", who: "settlers" },
  { id: "market", building: "market", tier: 1, right: 0, ahead: -16, f: "back", who: "Quartermaster" },
  { id: "garden", building: "garden", tier: 1, right: -10, ahead: -20, f: "back", who: "Farmer" },
  { id: "smithy", building: "smithy", tier: 2, right: 24, ahead: 4, f: "right", who: "Smith" },
  { id: "stable", building: "stable", tier: 2, right: -24, ahead: 6, f: "left", who: "Stablehand" },
  { id: "storehouse", building: "storehouse", tier: 3, right: 24, ahead: 20, f: "right", who: "Mason" },
  { id: "tower_west", building: "watchtower", tier: 3, right: -24, ahead: 24, f: "left", who: "Guards" },
  { id: "tower_gate", building: "watchtower", tier: 3, right: 22, ahead: -18, f: "back", who: "Guards" },
];

// gateDir: "north" | "east" | "south" | "west" (the side of the plot the gate is on)
const AWAY = { north: { x: 0, z: 1 }, south: { x: 0, z: -1 }, east: { x: -1, z: 0 }, west: { x: 1, z: 0 } };

// The hall's forward direction (away from the gate) and its right
export function frame(gateDir = "north") {
  const F = AWAY[gateDir] ?? AWAY.north;
  return { F, R: { x: -F.z, z: F.x } };
}

// World x/z of a layout spot, and the world direction its building runs
export function place(center, gateDir, spot) {
  const { F, R } = frame(gateDir);
  const dir = { ahead: F, back: { x: -F.x, z: -F.z }, right: R, left: { x: -R.x, z: -R.z } }[spot.f ?? "ahead"];
  return { x: center.x + spot.right * R.x + spot.ahead * F.x, z: center.z + spot.right * R.z + spot.ahead * F.z, forward: dir };
}

export const slotsFor = (tier) => SLOTS.filter((s) => s.tier <= tier);
