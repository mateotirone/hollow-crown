// Settlement building (The Hollow Crown): build zones, the Mason and pre-designed buildings.
//
//   zones.js      where you may build: free-build on your land, nothing on the ground your hall grows
//                 into, only a camp in the wilds. The one place the reserve and wilds rules are enforced.
//   mason.js      the Mason NPC and the Mason's Bench: building blocks for emeralds
//   plans.js      the Foundation Stone: place a pre-designed building, paid in planks and stone
//   buildings.js  the building designs (drawn once, built in all five regional styles)
//   walls.js      the ring wall round a claimed plot and its ten levels (walldata.js = the levels)
//   repair.js     mending a damaged wall for a price (the Mason and the town hall both offer it)
//   layout.js     the plot layout: where the hall, the mason and each building slot stand (arrival.js lays it out)
//   wallet.js     what things are charged in (emeralds until the world currency arrives)
//   config.js     every number, the camp kit, the mason's stock and lines
//
// What other features can use:
//   zoneAt(player, location) -> { zone: "free" | "reserve" | "wilds" | "foreign", owner?, label? }
//   reservesOf(owner) -> [{ x0, z0, x1, z1, label }]
//   addFilter("settleReserves", (boxes, { owner }) => [...boxes, { x0, z0, x1, z1, label }])   reserve more ground
//   drawBuilding(id, style), BUILDINGS, styleFor(style)   the designs, for the town hall build engine
//   on("settleBuilt", ({ owner, player, building, style, origin, forward, box }))
//   spawnMason(dimension, location)

import "./zones.js";
import "./plans.js";
import "./raised.js";
import "./mason.js";
import "./coins.js"; // world currency
import "./walls.js";
import "./repair.js";
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
export { raiseFree, styleOf, siteProblem } from "./plans.js";
