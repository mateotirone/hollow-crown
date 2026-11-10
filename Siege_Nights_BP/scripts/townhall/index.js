// Town hall, Tree of Oaths, Renown, and the Knight and Marked paths (The Hollow Crown).
//
// What other features can use:
//   emit("skillPoints", { player, amount, source, renown? })            give points (player or player id)
//   /scriptevent siege:award_skill_points {"player":"<id>","points":2,"reason":"..."}   same, from anywhere
//   on("hallBuilt", ({ owner, level, style, marks, first }) => ...)     marks = world spots: tree, sage, throne ...
//   on("pathChosen", ({ player, path }))   on("rankUp", ({ player, path, rank }))   on("emberFell", ...)
//   player dynamic property "siege:townhall_hero": JSON { path, rank, level, skills, resonance, ... }
//   player tags: siege_resonant (Marked and loud, Resonance 70+), siege_echo_sight (Echo Sight is up)

import { world, system } from "@minecraft/server";
import * as api from "../siege/api.js";
import { SKILLS, SKILL, RINGS, BRANCHES, blockedReason, levelFromRenown, renownForNext, pointsForLevel, rankOf, spentIn, canBranch } from "./skills.js";
import { STYLES, STYLE_IDS, styleFromBiome, styleFromGround } from "./styles.js";
import { drawHall, frameFor, toWorld, statesFor, buildOrder } from "./halls.js";
import { buildTick } from "./build.js";
import { heroOf, saveHero, forgetHero, grantPoints, grantRenown, listenForGrants, blankHero } from "./hero.js";
import { CORNERSTONE, TREE, hallMenu, hallOf, halls, saveHalls, resumeBuilds, beginBuild, setTreeLook, allowedLevel, HALL_COSTS } from "./townhall.js";
import { openTree, choosePath, treeMenu, EMBER, BOUND_EMBER, OATH_BANNER } from "./tree.js";
import { passiveTick, watchfireTick, dropEmber } from "./progress.js";
import { knightTick, chargeTick } from "./knight.js";
import { markedTick } from "./marked.js";

export { grantPoints, grantRenown, heroOf, hallOf };
export { startBuild } from "./build.js"; // other features can raise their own templates with the same engine

listenForGrants();

// ---------- clicking the cornerstone and the Tree ----------
const lastClick = new Map();
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player } = event;
  const type = block.typeId;
  if (type !== CORNERSTONE && type !== TREE) return;
  if (event.isFirstEvent === false) return;
  const now = system.currentTick;
  if (now - (lastClick.get(player.id) ?? -100) < 8) return;
  lastClick.set(player.id, now);
  if (player.isSneaking && event.itemStack) return; // let people place blocks against it
  event.cancel = true;
  system.run(() => {
    if (!api.isReady()) return;
    if (type === TREE) return openTree(player, block);
    const owner = block.dimension.id === "minecraft:overworld" ? api.settlementAt(block.location) : undefined;
    if (!owner) return player.sendMessage("§7This cornerstone stands outside any settlement.");
    hallMenu(player, owner);
  });
});

api.addKeepMenuButtons(({ player, owner }) => [
  { label: "Town hall", icon: "textures/items/siege_hall_cornerstone", action: () => hallMenu(player, owner) },
  ...(hallOf(owner)?.level ? [{ label: "Tree of Oaths", icon: "textures/items/siege_hollow_ember", action: () => treeMenu(player, hallOf(owner).level) }] : []),
]);

// ---------- loops ----------
api.onTick("townhall_build", 1, buildTick);
api.onTick("townhall_passives", 20, passiveTick);
api.onTick("townhall_knight", 20, knightTick);
api.onTick("townhall_charge", 5, chargeTick);
api.onTick("townhall_marked", 20, markedTick);
api.onTick("townhall_watchfire", 20, watchfireTick);

api.on("ready", () => resumeBuilds());

world.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn) return;
  const hero = heroOf(event.player);
  system.runTimeout(() => {
    if (!event.player.isValid) return;
    setTreeLook(event.player.id);
    if (hero.points > 0) event.player.sendMessage(`§bYou have ${hero.points} unspent skill point${hero.points === 1 ? "" : "s"}.§7 Spend them at the Tree of Oaths in your town hall.`);
  }, 100);
});
world.afterEvents.playerLeave.subscribe((event) => forgetHero(event.playerId));

// ---------- testing commands (need cheats) ----------
//   /scriptevent siege:townhall_path knight|marked|none     set your path (none resets it)
//   /scriptevent siege:townhall_ember                       make the Ember fall for you
//   /scriptevent siege:townhall_build 3 frostmarch          raise tier 3 in a style, free, at your cornerstone
//   /scriptevent siege:townhall_renown 500                  give yourself Renown
//   /scriptevent siege:townhall_reset                       wipe your own progress
system.afterEvents.scriptEventReceive.subscribe((event) => {
  const player = event.sourceEntity;
  if (!event.id.startsWith("siege:townhall_") || player?.typeId !== "minecraft:player") return;
  const args = event.message.trim().split(/\s+/);
  const hero = heroOf(player);
  switch (event.id) {
    case "siege:townhall_path":
      if (!["knight", "marked", "none"].includes(args[0])) return player.sendMessage("§cUse knight, marked or none.");
      hero.path = "none";
      hero.ember = "none";
      if (args[0] === "none") { saveHero(player); setTreeLook(player.id); return player.sendMessage("§7Path cleared."); }
      return void choosePath(player, args[0]);
    case "siege:townhall_ember":
      hero.path = "none";
      return dropEmber(player);
    case "siege:townhall_renown":
      return grantRenown(player, Number(args[0]) || 100, "test");
    case "siege:townhall_reset":
      Object.assign(hero, blankHero());
      saveHero(player);
      return player.sendMessage("§7Your progress is wiped.");
    case "siege:townhall_build": {
      const hall = hallOf(player.id);
      if (!hall || hall.lost) return player.sendMessage("§cPlace a Hall Cornerstone in your settlement first.");
      const level = Math.max(1, Math.min(5, Number(args[0]) || 1));
      const style = STYLE_IDS.includes(args[1]) ? args[1] : hall.style;
      hall.paid = Math.max(hall.paid ?? 0, level);
      saveHalls();
      if (!beginBuild(player.id, level, style)) player.sendMessage("§cA build is already under way.");
      return;
    }
  }
});

// ---------- self-tests ----------
api.addTests("townhall", {
  "every skill is well formed": () => {
    const ids = new Set();
    for (const s of SKILLS) {
      api.assert(!ids.has(s.id), `duplicate ${s.id}`);
      ids.add(s.id);
      api.assert(BRANCHES[s.branch], `${s.id} branch`);
      api.assert(RINGS[s.ring], `${s.id} ring`);
      api.assert(s.max >= 1 && s.max <= 3 && s.cost >= 1, `${s.id} numbers`);
      if (s.needs) {
        api.assert(SKILL[s.needs], `${s.id} needs a real skill`);
        api.assert(SKILL[s.needs].branch === s.branch && SKILL[s.needs].ring <= s.ring, `${s.id} needs an earlier skill of its own branch`);
      }
    }
  },
  "renown levels pay out points": () => {
    api.assertEqual(levelFromRenown(0).level, 1);
    api.assertEqual(levelFromRenown(renownForNext(1)).level, 2);
    api.assertEqual(levelFromRenown(1e9).level, 50);
    api.assertEqual(pointsForLevel(5), 2);
    api.assertEqual(pointsForLevel(6), 1);
  },
  "the tree gates by path, hall, renown and points": () => {
    const hero = { ...blankHero(), points: 10, level: 30 };
    api.assertEqual(blockedReason(SKILL.blade_bash, hero, 5), "Knights only");
    api.assertEqual(blockedReason(SKILL.arc_bolt, { ...hero, path: "marked" }, 5), undefined);
    api.assertEqual(blockedReason(SKILL.keep_wards, hero, 1), "Needs a Stone Hall");
    api.assertEqual(blockedReason(SKILL.keep_wards, hero, 2), "Needs Hearthwarden");
    api.assertEqual(blockedReason(SKILL.keep_wards, { ...hero, skills: { keep_hearth: 1 } }, 2), undefined);
    api.assertEqual(blockedReason(SKILL.keep_hearth, { ...hero, level: 1, points: 0 }, 1), "Needs 1 point");
    api.assertEqual(blockedReason(SKILL.way_horse, { ...hero, level: 4, skills: { way_fleet: 1 } }, 2), "Needs Renown 5");
    api.assertEqual(blockedReason(SKILL.keep_watchfire, { ...hero, skills: { keep_watchfire: 1 } }, 5), "Mastered");
    api.assert(!canBranch("arcana", "knight") && canBranch("keep", "none"));
  },
  "ranks follow points sworn to the path": () => {
    api.assertEqual(rankOf("knight", {}).name, "Squire");
    api.assertEqual(rankOf("knight", { blade_bash: 3 }).name, "Man-at-Arms");
    api.assertEqual(rankOf("marked", { arc_bolt: 3, arc_ward: 3, arc_blink: 1 }).name, "Adept");
    api.assertEqual(rankOf("none", {}), undefined);
    api.assertEqual(spentIn({ keep_hearth: 2, arc_step: 1 }), 5);
  },
  "every hall draws in every style": () => {
    for (const id of STYLE_IDS) {
      for (let level = 1; level <= 5; level++) {
        const plan = drawHall(level, STYLES[id]);
        const tree = plan.marks.tree;
        api.assert(tree && plan.cells.get(`${tree.x},${tree.y},${tree.z}`)?.role === "tree", `${id} ${level} has its Tree`);
        for (const c of plan.cells.values()) api.assert(STYLES[id].roles[c.role], `${id} has no block for "${c.role}"`);
        for (const c of plan.columns.values()) api.assert(STYLES[id].roles[c.role], `${id} has no block for "${c.role}"`);
        const b = plan.bounds();
        api.assert(b.x1 - b.x0 < 40 && b.z1 - b.z0 < 50, `${id} ${level} fits in a Hamlet`);
        // the doorway behind the cornerstone is open
        const lift = STYLES[id].lift;
        const door = plan.cells.get(`0,${1 + lift},${1 + lift}`);
        api.assert(!door || door.role === "air", `${id} ${level} door is open (${door?.role})`);
        if (level > 1) api.assert(buildOrder(plan).length > buildOrder(drawHall(level - 1, STYLES[id])).length, `${id} ${level} is bigger than the last`);
      }
    }
    api.assertEqual(HALL_COSTS.length, 6);
  },
  "halls turn to face the way you placed them": () => {
    const origin = { x: 100, y: 64, z: 200 };
    api.assertEqual(toWorld(frameFor({ x: 0, z: 1 }), origin, 2, 1, 5), { x: 98, y: 64, z: 205 });
    api.assertEqual(toWorld(frameFor({ x: 1, z: 0 }), origin, 2, 1, 5), { x: 105, y: 64, z: 202 });
    api.assertEqual(toWorld(frameFor({ x: 0, z: -1 }), origin, 0, 1, 0), origin);
    api.assertEqual(statesFor(frameFor({ x: 0, z: 1 }), "seat", { dir: "+z" })[0].weirdo_direction, 2);
    api.assertEqual(statesFor(frameFor({ x: 1, z: 0 }), "beam", { axis: "z" })[0].pillar_axis, "x");
  },
  "styles are picked from the land": () => {
    api.assertEqual(styleFromBiome("minecraft:snowy_taiga"), "frostmarch");
    api.assertEqual(styleFromBiome("minecraft:mangrove_swamp"), "blackfen");
    api.assertEqual(styleFromBiome("minecraft:plains"), "vale");
    api.assertEqual(styleFromGround({ "minecraft:sand": 30, "minecraft:grass_block": 10 }), "emberwaste");
    api.assertEqual(styleFromGround({}), "vale");
  },
  "settlement tier decides the biggest hall": () => {
    api.assertEqual(allowedLevel(undefined), 0);
    api.assertEqual(allowedLevel({ wins: 0 }), 1);
    api.assertEqual(allowedLevel({ wins: 6 }), 3);
    api.assertEqual(allowedLevel({ wins: 10, warlordsSlain: 2, sovereign: true }), 5);
  },
});

api.addTests("townhall", {
  "town hall blocks and items exist": () => {
    for (const id of [CORNERSTONE, TREE, EMBER, BOUND_EMBER, OATH_BANNER]) api.assert(id.startsWith("siege:"), id);
    api.assert(typeof halls() === "object");
  },
}, { gameOnly: true });
