// Settlement building (The Hollow Crown): build zones, the Mason and pre-designed buildings.
//
//   zones.js      where you may build: free-build on your land, nothing on the ground your hall grows
//                 into, only a camp in the wilds. The one place the reserve and wilds rules are enforced.
//   mason.js      the Mason NPC and the Mason's Bench: building blocks for emeralds
//   plans.js      the Foundation Stone: place a pre-designed building, paid in planks and stone
//   buildings.js  the building designs (drawn once, built in all five regional styles)
//   walls.js      the ring wall round a claimed plot and its ten levels (walldata.js = the levels)
//   repair.js     mending a damaged wall for a price (the Mason and the town hall both offer it)
//   layout.js     the old fixed plot layout (worlds without town layouts still use it; arrival.js lays it out)
//   towns.js      the twelve map plots' town layouts (towns_data.js, from tools/export_towns.py): slots, groundwork
//   founding.js   laying a town out from its layout, a tier at a time, and moving the wall out as it grows
//   plotmarker.js the Plot Marker on every open slot: pick a building that fits, see its outline, pay, raise it
//   wallet.js     what things are charged in (emeralds until the world currency arrives)
//   config.js     every number, the camp kit, the mason's stock and lines
//
// What other features can use:
//   zoneAt(player, location) -> { zone: "free" | "reserve" | "wilds" | "foreign", owner?, label? }
//   reservesOf(owner) -> [{ x0, z0, x1, z1, label }]
//   addFilter("settleReserves", (boxes, { owner }) => [...boxes, { x0, z0, x1, z1, label }])   reserve more ground
//   drawBuilding(id, style), BUILDINGS, styleFor(style)   the designs, for the town hall build engine
//   on("settleBuilt", ({ owner, player, building, style, origin, forward, box, slotId }))   slotId: the town slot, if any
//   townOf(owner), townSlots(owner), growTown(owner, tier)   a town laid out from its layout
//   on("townLaidOut", ({ owner, tier })), on("settleFixture", ({ owner, kind, species, size, rotation, at }))
//   spawnMason(dimension, location)

import "./zones.js";
import "./plans.js";
import "./raised.js";
import "./mason.js";
import "./coins.js"; // world currency
import "./walls.js";
import "./repair.js";
import "./founding.js";
import "./plotmarker.js";
import "./arrival.js";
import "./showcase.js";
import "./tests.js";

export { zoneAt, reservesOf, reserveAt, placeProblem, wildsClosed } from "./zones.js";
export { BUILDINGS, BUILDING, drawBuilding, styleFor } from "./buildings.js";
export { spawnMason, openShop } from "./mason.js";
export { wallOf, wallRing, wallCost, raiseWall } from "./walls.js";
export { WALLS, WALL_LEVELS, MAX_WALL } from "./walldata.js";
export { repairWall, offerRepair } from "./repair.js";
export { setWallet } from "./wallet.js";
export { HALL, MASON, SLOTS, place, slotsFor } from "./layout.js";
export { layOut } from "./arrival.js";
export { townOf, townSlots, growTown, foundTown, settlementTier, PLOT_MARKER, charterOf, builtCounts } from "./founding.js";
export { plotFit, charterCheck, slotClass } from "./charters.js";
export { townFor, slotsOf, seatOnSlot } from "./towns.js";
export { choicesFor } from "./plotmarker.js";
export { OPENS_AT, CHARTERS } from "./config.js";
export { raiseFree, styleOf, siteProblem } from "./plans.js";
