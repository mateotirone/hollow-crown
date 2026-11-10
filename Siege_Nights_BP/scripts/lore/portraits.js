// Portraits and paintings on walls (entity siege:portrait; pictures in data/portraits.js).
//   Each settlement's Library shows the three people who held that ground before the player.
//   The eight old paintings of the Long Gallery can be hung anywhere by a builder.
// Click (or punch) a picture to read who it is. In creative, punching takes it down.
//   /scriptevent siege:portrait list             every picture id
//   /scriptevent siege:portrait <id>             (creative) hang it on the wall you are looking at
//   /scriptevent siege:portrait <plot name>      (creative) hang that plot's three leaders in a row on that wall
//   /scriptevent siege:portrait gallery          (creative) hang the eight paintings in a row on that wall
// The settlement feature tells us where a Library's wall spots are: "settleBuilt" { building: "library",
// origin, marks: { portrait0, portrait1, portrait2 }, portraitYaw }. yaw is the way the picture faces:
// 0 south, 90 west, 180 north, -90 east.

import { world, system, GameMode } from "@minecraft/server";
import { on, addTests, assert, assertEqual } from "../siege/api.js";
import { plotAt } from "../plots/api.js";
import { PICS, LEADERS, GALLERY, picIndex, leaderPics } from "./data/portraits.js";
import { PLOT_NAMES, slugOf } from "./data/plots.js";

export const PORTRAIT = "siege:portrait";
const WIDTH = [1, 3, 2]; // blocks wide, by size
const FACES = { South: { yaw: 0, x: 0, z: 1 }, West: { yaw: 90, x: -1, z: 0 }, North: { yaw: 180, x: 0, z: -1 }, East: { yaw: -90, x: 1, z: 0 } };

// Where a picture sits for a wall block and the side of it you are looking at (pure, self-tested)
export function hangSpot(block, face) {
  const f = FACES[face];
  if (!f) return undefined;
  return { x: block.x + 0.5 + f.x * 0.54, y: block.y, z: block.z + 0.5 + f.z * 0.54, yaw: f.yaw };
}
// The next spot along the wall to the viewer's right, `blocks` further on
export const alongWall = (spot, blocks) => {
  const f = Object.values(FACES).find((v) => v.yaw === spot.yaw);
  return { ...spot, x: spot.x + f.z * blocks, z: spot.z - f.x * blocks };
};

// A mark is the air block in front of the wall; the picture sits at the back of that block, on the wall
export function againstWall(at, yaw) {
  const f = Object.values(FACES).find((v) => v.yaw === yaw) ?? FACES.South;
  return { x: at.x + 0.5 - f.x * 0.46, y: at.y, z: at.z + 0.5 - f.z * 0.46, yaw: f.yaw };
}
// Which of the eight old paintings hangs over each Library's door: the one nearest that plot's own story
export const PLOT_PAINTING = { Harrowford: 3, Oakmere: 7, Thistledown: 5, Wrenfield: 4, Rimeholt: 5, Wolfcairn: 2, Gullcliff: 2, Tidewatch: 7, Reedmoor: 1, Lanternbog: 6, Redmesa: 4, Dunehold: 6 };

export function hang(dimension, spot, index) {
  const pic = PICS[index];
  if (!pic) return undefined;
  const e = dimension.spawnEntity(PORTRAIT, { x: spot.x, y: spot.y, z: spot.z });
  e.setProperty("siege:pic", index);
  e.setProperty("siege:size", pic.size);
  e.teleport({ x: spot.x, y: spot.y, z: spot.z }, { rotation: { x: 0, y: spot.yaw }, dimension });
  return e;
}

function describe(player, entity) {
  const pic = PICS[entity.getProperty("siege:pic")];
  if (!pic) return;
  player.sendMessage(`§6${pic.title}§r\n§8${pic.sub}\n§7§o${pic.line}`);
  player.playSound("item.book.page_turn", { pitch: 0.8 });
}
world.afterEvents.playerInteractWithEntity.subscribe(({ player, target }) => {
  if (target?.typeId === PORTRAIT) describe(player, target);
});
world.afterEvents.entityHitEntity.subscribe(({ damagingEntity: player, hitEntity }) => {
  if (hitEntity?.typeId !== PORTRAIT || player?.typeId !== "minecraft:player") return;
  if (player.getGameMode() !== GameMode.Creative) describe(player, hitEntity);
});

// A new Library gets the three faces of whoever held this ground
on("settleBuilt", ({ building, origin, marks, portraitYaw, paintingYaw }) => {
  if (building !== "library" || !marks?.portrait0) return;
  try {
    const pics = leaderPics(plotAt(origin)?.name);
    const dim = world.getDimension("overworld");
    pics.forEach((pic, i) => {
      const at = marks[`portrait${i}`];
      if (!at) return;
      const spot = againstWall(at, portraitYaw ?? 0);
      const there = dim.getEntities({ type: PORTRAIT, location: spot, maxDistance: 0.9 });
      if (!there.length) hang(dim, spot, pic.index);
    });
    // and one of the old paintings over the door
    const plate = PLOT_PAINTING[plotAt(origin)?.name];
    if (marks.painting0 && plate) {
      const spot = againstWall(marks.painting0, paintingYaw ?? 0);
      if (!dim.getEntities({ type: PORTRAIT, location: spot, maxDistance: 0.9 }).length) hang(dim, spot, picIndex(`plate_${plate}`));
    }
  } catch (e) {
    console.warn(`[Hollow Crown] portraits: ${e}`);
  }
});

system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: player }) => {
  if (id !== "siege:portrait" || player?.typeId !== "minecraft:player") return;
  const arg = message.trim();
  if (!arg || arg === "list") return player.sendMessage(`§7Pictures: ${PICS.map((p) => p.id).join(", ")}\n§7Or a plot name, or "gallery".`);
  if (player.getGameMode() !== GameMode.Creative) return player.sendMessage("§cOnly a builder in creative can hang pictures.");
  const plot = PLOT_NAMES.find((n) => slugOf(n) === slugOf(arg));
  const list = plot ? leaderPics(plot).map((p) => p.index) : arg === "gallery" ? GALLERY.map((_, i) => picIndex(`plate_${i + 1}`)) : [picIndex(arg)];
  if (list.some((i) => i < 0)) return player.sendMessage(`§cNo picture called "${arg}". Try /scriptevent siege:portrait list`);
  const hit = player.getBlockFromViewDirection({ maxDistance: 8 });
  const first = hit && hangSpot(hit.block.location, hit.face);
  if (!first) return player.sendMessage("§cLook at the side of a wall block, close up, and run it again.");
  let offset = 0;
  for (const index of list) {
    const w = WIDTH[PICS[index].size];
    hang(player.dimension, alongWall(first, offset + (w - 1) / 2), index);
    offset += w + 1;
  }
  player.sendMessage(`§aHung ${list.length} picture${list.length === 1 ? "" : "s"}. Click one to read it. Punch it in creative to take it down.`);
});

addTests("lore", {
  "portraits: every plot has three prior leaders, and no portrait gives the ending away": () => {
    assertEqual(Object.keys(LEADERS).sort(), [...PLOT_NAMES].sort());
    for (const [plot, people] of Object.entries(LEADERS)) {
      assertEqual(people.length, 3, plot);
      for (const p of people) assert(p.look.length > 40 && p.line.length > 20 && !/Oswin|Morvane/.test(p.name + p.line + p.role), `${plot}: ${p.name}`);
      assertEqual(leaderPics(plot).length, 3);
    }
    assertEqual(PICS.length, 44);
    assertEqual(new Set(PICS.map((p) => p.id)).size, 44);
    assert(PICS.length <= 128, "the entity's picture number only goes to 127");
  },
  "portraits: a picture hangs just proud of the wall face you look at, and a row runs to the right": () => {
    const spot = hangSpot({ x: 10, y: 64, z: 20 }, "North");
    assertEqual(spot.yaw, 180);
    assert(spot.z < 20 && spot.x === 10.5 && spot.y === 64);
    assertEqual(hangSpot({ x: 0, y: 0, z: 0 }, "Up"), undefined);
    // looking at a north face (you face south), your right is west: x goes down
    assert(alongWall(spot, 2).x < spot.x && alongWall(spot, 2).z === spot.z);
    // looking at a south face (you face north), your right is east
    const s = hangSpot({ x: 0, y: 0, z: 0 }, "South");
    assert(alongWall(s, 2).x > s.x);
  },
});
