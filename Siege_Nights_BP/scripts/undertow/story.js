// The Hollow's middle stretch, the Hollow's side (Mateo approved the beats 2026-11-11).
// The words and the scenes are the lore feature's (lore/hollow.js, lore/data/hollow_story.js); this file
// knows the places:
//   - notices a player walking into a story place and emits hollowBeat { player, beat }
//   - puts the Carter (a story NPC, built-in minecraft:npc) where the story has got to
//   - keeps the Court shut to anyone without the Cartsong until the Choir has been silenced
//   - remembers the Seams choice: a wrecked cart means fewer phantom raids in the Choir fight,
//     a spared cart means half price at every Tally (hollowfolk asks sparedCart())
// It hears lore's flags through the loreFlag event: cartsong, seams_wreck, seams_spare.
//
//   - after the Choir, until the Seat is empty: shows each player in the Hollow which way the Seat lies and how
//     far (Mateo 2026-11-12: "where do i go from the choir to morvane")
//
//   /scriptevent hc:carter_go     go to wherever the Carter stands now (testing)

import { world, system, GameMode } from "@minecraft/server";
import { on, emit, onTick, addTests, assert } from "../siege/api.js";
import { UNDERTOW_ID, COURT, HEART, pathX } from "./layout.js";
import { SITES } from "./roads.js";
import { heightAt } from "./terrain.js";
import { load, save, say } from "./data.js";
import { shove } from "../bestiary/util.js";
import { fightOf } from "../bestiary/bossCore.js";

const K_STORY = "hc:hollow_story"; // { cartsong: {playerId: true}, spared: {playerId: true}, reached: {beat: true} }
const K_PROGRESS = "hc:undertow_progress"; // shared with index.js and choir.js
const CARTER_TAG = "siege_lore_npc_carter"; // lore/npcs.js answers clicks on anything with this tag
const CARTER_NAME = "The Carter";

// Which place in roads.js SITES starts which beat (beat ids match lore/data/hollow_story.js SCENES).
// up: blocks above the site's ground the player must be (the Drift is seen from its top stone).
export const BEAT_SITES = {
  landing: { site: "wound_dock" },
  glimwade: { site: "glimwade" },
  truce_hall: { site: "truce_hall" },
  standing_ranks: { site: "standing_ranks" },
  far_door: { site: "far_door" },
  drift: { site: "drift_foot", up: 6 },
  seams: { site: "the_seams" },
};
const siteOf = (id) => SITES.find((s) => s.id === id);

const blank = () => ({ cartsong: {}, spared: {}, reached: {} });
const story = () => ({ ...blank(), ...load(K_STORY, {}) });
const keep = (d) => save(K_STORY, d);

export const hasCartsong = (playerId) => !!story().cartsong[playerId];
export const cartsongHolders = () => story().cartsong;
export const sparedCart = (playerId) => !!story().spared[playerId];
export const cartWrecked = () => !!load(K_PROGRESS, {}).cartWrecked;
const choirSilenced = () => !!load(K_PROGRESS, {}).choir;

// Which beat (if any) a spot belongs to. Pure.
export function beatAt(x, y, z) {
  for (const [beat, b] of Object.entries(BEAT_SITES)) {
    const s = siteOf(b.site);
    if (!s || Math.hypot(x - s.x, z - s.z) > s.r) continue;
    if (b.up && (s.y === undefined || y < s.y + b.up)) continue;
    return beat;
  }
  return undefined;
}

// ---- where the Carter stands -----------------------------------------------------------------
// landing: on the Wound dock. glimwade: where the road comes into the village. court: outside the Court's south door.
export function carterStation(d = story(), silenced = choirSilenced()) {
  if (silenced || Object.keys(d.cartsong).length) return "court";
  if (d.reached.glimwade) return "glimwade";
  return "landing";
}
export function stationSpot(station) {
  if (station === "landing") { const s = siteOf("wound_dock"); return { x: s.x + 0.5, y: s.y + 1, z: s.z - 3.5 }; }
  if (station === "glimwade") { const s = siteOf("glimwade"); return { x: s.x + 15.5, y: s.y + 1, z: s.z + 0.5 }; }
  const z = COURT.center.z - COURT.radius - 8, x = pathX(z) + 3;
  return { x: x + 0.5, y: heightAt(x, z) + 1, z: z + 0.5 };
}

const hollow = () => world.getDimension(UNDERTOW_ID);
const hollowPlayers = () => world.getAllPlayers().filter((p) => p.dimension.id === UNDERTOW_ID);
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;

function placeCarter() {
  const players = hollowPlayers();
  if (!players.length) return;
  const at = stationSpot(carterStation());
  let dim;
  try { dim = hollow(); } catch { return; }
  let carters = [];
  try { carters = dim.getEntities({ tags: [CARTER_TAG] }); } catch { return; }
  carters.sort((a, b) => d2(a.location, at) - d2(b.location, at));
  for (const extra of carters.slice(1)) { try { extra.remove(); } catch { /* gone */ } }
  const carter = carters[0];
  if (carter) {
    if (d2(carter.location, at) > 16) { try { carter.teleport(at); } catch { /* not loaded */ } }
    return;
  }
  if (!players.some((p) => d2(p.location, at) < 48 * 48)) return; // spawn only where someone can see the ground is built
  try {
    if (!dim.getBlock({ x: Math.floor(at.x), y: Math.floor(at.y) - 1, z: Math.floor(at.z) })?.isSolid) return; // not built yet
    const npc = dim.spawnEntity("minecraft:npc", at);
    npc.addTag(CARTER_TAG);
    npc.nameTag = CARTER_NAME;
    try { npc.getComponent("minecraft:npc").name = CARTER_NAME; } catch { /* cosmetic */ }
  } catch { /* chunk not loaded */ }
}

// ---- noticing places, and the Court door ---------------------------------------------------
const lastBeat = new Map(); // player id -> the beat place they were standing in at the last look
const heardSilence = new Set(); // player ids told this session that the Court is quiet
const lastPush = new Map(); // player id -> tick of the last "the note closes" message

// May anyone near this spot walk into the Court? Pure on its inputs.
export function courtOpenFor(nearIds, cartsong, silenced) {
  return silenced || nearIds.some((id) => cartsong[id]);
}

function courtDoor(players, d) {
  if (choirSilenced()) return;
  const c = COURT.center;
  const inside = players.filter((p) => Math.hypot(p.location.x - c.x, p.location.z - c.z) < COURT.radius - 2 && Math.abs(p.location.y - COURT.floorY) < 12);
  if (!inside.length) return;
  const near = players.filter((p) => Math.hypot(p.location.x - c.x, p.location.z - c.z) < COURT.radius + 12).map((p) => p.id);
  if (courtOpenFor(near, d.cartsong, false)) return;
  for (const p of inside) {
    if (p.getGameMode() === GameMode.Creative) continue; // builders walk where they like
    shove(p, p.location.x - c.x || 0.01, p.location.z - c.z || -1, 2.2, 0.4);
    const t = lastPush.get(p.id) ?? -1e9;
    if (system.currentTick - t > 200) {
      lastPush.set(p.id, system.currentTick);
      say(p, "§7§oThe note closes like a door, and you are on the wrong side of it. The carts get in somehow. The Carter would know.");
    }
  }
}

onTick("undertow:story", 20, () => {
  const players = hollowPlayers();
  if (!players.length) return;
  const d = story();
  let changed = false;
  for (const p of players) {
    const l = p.location;
    const beat = beatAt(l.x, l.y, l.z);
    if (beat && beat !== lastBeat.get(p.id)) {
      emit("hollowBeat", { player: p, beat });
      if (!d.reached[beat]) { d.reached[beat] = true; changed = true; }
    }
    lastBeat.set(p.id, beat);
    if (choirSilenced() && !heardSilence.has(p.id)) {
      heardSilence.add(p.id);
      emit("hollowBeat", { player: p, beat: "choir_silenced" });
    }
  }
  if (changed) keep(d);
  courtDoor(players, d);
});
onTick("undertow:carter", 40, placeCarter);

// ---- the way to the Seat, after the Choir ------------------------------------------------------
// Once the Court is quiet, every player in the Hollow sees on their action bar which way the Seat lies and how
// far, until Morvane falls. It goes quiet on the Seat itself and while his fight is on.
// Which way to turn, from where a player stands and the way they face (Minecraft yaw: 0 is south, 90 west). Pure.
export function seatPointer(loc, yaw) {
  const dx = HEART.center.x - loc.x, dz = HEART.center.z - loc.z, dist = Math.round(Math.hypot(dx, dz));
  const want = (Math.atan2(-dx, dz) * 180) / Math.PI;
  const turn = ((((want - yaw) % 360) + 540) % 360) - 180; // -180..180, plus = to your right
  const a = Math.abs(turn);
  const way = a <= 30 ? "ahead" : a >= 150 ? "behind you" : a <= 75 ? (turn > 0 ? "ahead, to your right" : "ahead, to your left")
    : a < 120 ? (turn > 0 ? "to your right" : "to your left") : (turn > 0 ? "behind you, to your right" : "behind you, to your left");
  return { dist, way };
}
export const SEAT_QUIET_RADIUS = HEART.outerRadius + 6; // on the Seat itself nobody needs telling
export function seatLine(loc, yaw) {
  const { dist, way } = seatPointer(loc, yaw);
  if (dist <= SEAT_QUIET_RADIUS) return undefined;
  return `§5The Seat§7: ${dist} blocks, ${way}`;
}
onTick("undertow:seat_pointer", 40, () => {
  const prog = load(K_PROGRESS, {});
  if (!prog.choir || prog.morvane) return;
  try { if (fightOf("morvane")) return; } catch { /* no boss framework: carry on */ }
  for (const p of hollowPlayers()) {
    if (playing(p)) continue;
    const line = seatLine(p.location, p.getRotation().y);
    if (line) { try { p.onScreenDisplay.setActionBar(line); } catch { /* left */ } }
  }
});
// A scene is playing for this player (lore/hollow.js): keep the bar clear for its title.
const sceneUntil = new Map();
const playing = (p) => (sceneUntil.get(p.id) ?? 0) > system.currentTick;
on("hollowBeat", ({ player }) => { if (player?.id) sceneUntil.set(player.id, system.currentTick + 200); });

// ---- lore's flags --------------------------------------------------------------------------
on("loreFlag", ({ player, flag }) => {
  if (!player?.id) return;
  if (flag === "cartsong" || flag === "seams_spare") {
    const d = story();
    d[flag === "cartsong" ? "cartsong" : "spared"][player.id] = true;
    keep(d);
  } else if (flag === "seams_wreck") {
    const prog = load(K_PROGRESS, {});
    if (!prog.cartWrecked) { prog.cartWrecked = true; save(K_PROGRESS, prog); }
  }
});

system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (e.id !== "hc:carter_go") return;
  const player = e.sourceEntity?.typeId === "minecraft:player" ? e.sourceEntity : undefined;
  if (!player) return;
  const station = carterStation();
  try {
    player.teleport(stationSpot(station), { dimension: hollow() });
    say(player, `§dThe Carter stands at: ${station}.`);
  } catch (err) { say(player, `§cCould not go there: ${err}`); }
});

addTests("hollow story places", {
  "every story place is a real site": () => {
    for (const [beat, b] of Object.entries(BEAT_SITES)) assert(siteOf(b.site), `${beat}: no site ${b.site}`);
  },
  "places are found where they stand": () => {
    const t = siteOf("truce_hall");
    assert(beatAt(t.x, t.y + 1, t.z) === "truce_hall", "the Truce Hall is not found");
    const dr = siteOf("drift_foot");
    assert(beatAt(dr.x, dr.y + 1, dr.z) === undefined, "the Drift must be climbed, not walked into");
    assert(beatAt(dr.x, dr.y + 8, dr.z) === "drift", "the top of the Drift is not found");
    assert(beatAt(0, 100, 0) === undefined, "the arrival ledge is not a place");
  },
  "the Carter follows the story": () => {
    assert(carterStation(blank(), false) === "landing");
    assert(carterStation({ ...blank(), reached: { glimwade: true } }, false) === "glimwade");
    assert(carterStation({ ...blank(), cartsong: { a: true } }, false) === "court");
    assert(carterStation(blank(), true) === "court");
  },
  "after the Choir, the Seat pointer shows the way (Mateo 2026-11-12)": () => {
    const court = { x: 0, z: COURT.gateZ + 4 };
    assert(seatPointer(court, 0).way === "ahead", "facing south from the Court gate, the Seat is ahead");
    assert(seatPointer(court, 180).way === "behind you", "facing north, it is behind you");
    assert(seatPointer(court, 90).way === "to your left", "facing west, the Seat (south) is to your left");
    assert(seatPointer(court, -90).way === "to your right", "facing east, it is to your right");
    assert(seatPointer(court, 0).dist === HEART.center.z - court.z, "distance");
    assert(seatLine({ x: HEART.center.x, z: HEART.center.z + 5 }, 0) === undefined, "quiet on the Seat");
    assert(/The Seat.*blocks, ahead/.test(seatLine(court, 0)), "the line names the Seat, how far and which way");
  },
  "one Cartsong opens the Court for everyone with them": () => {
    assert(!courtOpenFor(["a", "b"], {}, false));
    assert(courtOpenFor(["a", "b"], { b: true }, false));
    assert(courtOpenFor([], {}, true));
  },
});
