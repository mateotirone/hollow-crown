// Public API of the plots feature. Other features import from here.
//
//   import { allPlots, plotAt, holderOf, npcOf, isFree, plotOf, giveToNpc, releaseNpc, mapMode } from "../plots/api.js";
//
// A plot is { name, region, x, y, z, npc? }: x/y/z is its Plot Stone, and its land is everything
// within MAP.plotRadius (80) blocks of the stone, measured flat (x/z only).
//   holderOf(plot)  -> player id of the keep standing on the stone, or undefined
//   npcOf(plot)     -> { id, name } of the NPC lord holding it, or undefined
//   giveToNpc(plotName, { id, name }) / releaseNpc(plotName): hand a free plot to an NPC lord and take it back
// Events (via on() from siege/api.js): "plotNpcClaimed" and "plotNpcReleased", both { plot, npc }.
export { allPlots, plotAt, holderOf, npcOf, isFree, plotOf, freePlots, giveToNpc, releaseNpc, mapMode, compass } from "./claims.js";
export { outsideMap, wardAt, openZone, zoneOpen } from "./travel.js"; // openZone(id): an update opens a sealed EXPANSION zone
export { MAP, PLOT_PLAN, REGION_STYLE, PLOT_STONE, WARDS, WELCOME, SETTLEMENT, EXPANSION } from "./config.js";
// Welcome hall: pickOf(plot) -> { id, name } of the player who chose that plot as their start (it is kept for them),
// statusOf(plan) -> { state: "free" | "taken" | "kept" | "lord" | "missing", plot?, id?, name? }, hallBuilt().
// Event "plotChosen" { player, plot } fires when a player picks a plot, just before they are set down beside its stone.
export { pickOf, statusOf, hallBuilt, pedestalLayout, arrivalSpot } from "./welcome.js";
