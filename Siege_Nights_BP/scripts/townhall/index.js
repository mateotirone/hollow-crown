// Town hall, Tree of Oaths, Renown, and the Knight and Marked paths (The Hollow Crown).
//
// What other features can use:
//   emit("skillPoints", { player, amount, source, renown? })            give points (player or player id)
//   /scriptevent siege:award_skill_points {"player":"<id>","points":2,"reason":"..."}   same, from anywhere
//   on("hallBuilt", ({ owner, level, style, marks, first }) => ...)     marks = world spots: tree, sage, throne ...
//   on("pathChosen", ({ player, path }))   on("rankUp", ({ player, path, rank }))   on("emberFell", ...)
//   player dynamic property "siege:townhall_hero": JSON { path, rank, level, skills, resonance, ... }
//   on("hollowStep", (request) => ...)   a Marked player cast Veilstep: move request.player into the Hollow (or back out)
//                                        and set request.handled = true, or set request.refused = "why not"
//   on("hollowClaimReady", ({ player }))  a player learned The Last Art (skills.arc_warden): they may rule the Hollow
//   emit("offerRole", { player, role }) / emit("grantRole", { player, role })   story-driven roles ("knight", "marked");
//                                        answered by "roleOffered", "roleChosen" or "roleRefused" ({ player, role, why })
//   on("rosterNotes", (notes) => notes.add(playerId, "text"))   add a line under a player on the Who's online screen
//                                        (/scriptevent siege:who opens it anywhere)
//   on("wallInfo", q) / on("wallUpgrade", q)   answer these to put your settlement wall in the Town Hall menu (see flyby.js)
//   flyby(player, { center, radius, height, seconds, title })   the upgrade camera, for anything that rises
//   emit("levelsQuery", q = { playerId })   fills q.level, q.rank, q.role, q.settlement, q.tier, q.hall, q.online (works for offline players)
//   player tags: siege_resonant (Marked and loud, Resonance 70+), siege_echo_sight (Echo Sight is up)

import { world, system } from "@minecraft/server";
import * as api from "../siege/api.js";
import { POWER_ORIGINS } from "./skills.js";
import { SKILLS, SKILL, RINGS, BRANCHES, blockedReason, levelFromRenown, renownForNext, pointsForLevel, rankOf, spentIn, canBranch, coinBlocked, refundable, keptOnUnbind } from "./skills.js";
import { STYLES, STYLE_IDS, styleFromBiome, styleFromGround } from "./styles.js";
import { drawHall, frameFor, toWorld, statesFor, buildOrder, boardDir } from "./halls.js";
import { buildTick, clearBoxFor, worldCells, progressOf } from "./build.js";
import { heroOf, saveHero, forgetHero, grantRenown, listenForGrants, blankHero } from "./hero.js";
import { CORNERSTONE, TREE, BOARD, hallMenu, hallOf, halls, saveHalls, resumeBuilds, beginBuild, setTreeLook, allowedLevel, HALL_COSTS, hallMenuExtras } from "./townhall.js";
import { openTree, choosePath, treeMenu, EMBER, BOUND_EMBER, OATH_BANNER } from "./tree.js";
import { passiveTick, watchfireTick, dropEmber, nearestClue } from "./progress.js";
import { knightTick, chargeTick } from "./knight.js";
import { markedTick, markedFastTick } from "./marked.js";
import "./spellbar.js";
import "./messenger.js";
import "./showcase.js";
import { rosterMenu } from "./roster.js";
import { rolesTick, roleForStyle, roleForBoss, ROLE_DEEDS } from "./roles.js";
import { ROLES, RANKS, ROLE_LORE } from "./skills.js";
import { treeCells, treeLayout, COLS, ROWS } from "./tree_layout.js";
import { MESSENGER, route, cooling, bucket, heading, wayHome, newsText, keepNews, homecoming } from "./messenger_rules.js";
import { wallMenu } from "./flyby.js";
import { hallMap, setHallCheck } from "./hallmap.js";
export { flyby } from "./flyby.js";
import { rumorMenu, rumorTick, rumorsFor, bountiesFor, describe, jobTier, remember, KEEPSAKES, JOB_KIND } from "./rumors.js";

export { grantPoints, grantRenown, heroOf } from "./hero.js";
export { hallOf } from "./townhall.js";
export { startBuild } from "./build.js"; // other features can raise their own templates with the same engine

listenForGrants();

// ---------- where powers come from (the lore feature tells us) ----------
api.on("powerOriginInfo", ({ gated, lines }) => { POWER_ORIGINS.gated = { ...gated }; POWER_ORIGINS.lines = { ...lines }; });
api.on("powerOrigin", ({ player, skill }) => {
  const p = typeof player === "string" ? world.getAllPlayers().find((x) => x.id === player) : player;
  if (!p || !SKILL[skill]) return;
  const hero = heroOf(p);
  if (hero.origins?.[skill]) return;
  hero.origins = { ...(hero.origins ?? {}), [skill]: true };
  saveHero(p);
  if (hero.path === "marked") p.sendMessage(`§5You know where ${SKILL[skill].name} comes from now. The Tree of Oaths will teach it.`);
});
api.on("roleLore", ({ roles }) => { for (const id of Object.keys(roles ?? {})) if (ROLES[id]) ROLE_LORE[id] = { ...roles[id] }; });
system.runTimeout(() => api.emit("powerOriginsWanted", {}), 40);
system.runTimeout(() => api.emit("roleLoreWanted", {}), 40);

// ---------- clicking the cornerstone and the Tree ----------
const lastClick = new Map();
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player } = event;
  const type = block.typeId;
  if (type !== CORNERSTONE && type !== TREE && type !== BOARD) return;
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
    if (!owner) return player.sendMessage(type === BOARD ? "§7Nothing is pinned to this board: it stands outside any settlement." : "§7This cornerstone stands outside any settlement.");
    hallMenu(player, owner);
  });
});

api.addKeepMenuButtons(({ player, owner }) => [
  { label: "Who's online", icon: "textures/ui/multiplayer_glyph_color", action: () => rosterMenu(player) },
  { label: "Town hall", icon: "textures/items/siege_hall_cornerstone", action: () => hallMenu(player, owner) },
  ...(hallOf(owner)?.level ? [{ label: "Tree of Oaths", icon: "textures/items/siege_hollow_ember", action: () => treeMenu(player, hallOf(owner).level) }] : []),
]);

hallMenuExtras.push({ label: "Hall map\n§8settlements and places you have found", icon: "textures/items/map_filled", action: (player, owner) => hallMap(player, owner) });
// a Cartographer's Table opens the Hall Map when it stands inside a raised hall (the halls are at most ~45 deep)
setHallCheck((owner, at) => { const h = hallOf(owner); if (!h?.level || h.lost) return false; const c = h.cs ?? h; return Math.abs(at.x - c.x) <= 48 && Math.abs(at.z - c.z) <= 48 && Math.abs(at.y - c.y) <= 40; });
hallMenuExtras.push({ label: "Settlement wall\n§8raise it and watch it rise", icon: "textures/blocks/stonebrick", action: (player, owner) => wallMenu(player, owner) });
hallMenuExtras.push({ label: "Who's online\n§8players, roles and rulers", icon: "textures/ui/multiplayer_glyph_color", action: (player) => rosterMenu(player) });
hallMenuExtras.push({ label: "Rumor Board\n§8jobs for Renown and coins", icon: "textures/items/paper", action: (player) => rumorMenu(player) });

// ---------- loops ----------
api.onTick("townhall_rumors", 40, rumorTick);
api.onTick("townhall_roles", 20, rolesTick);
api.onTick("townhall_build", 1, buildTick);
api.onTick("townhall_passives", 20, passiveTick);
api.onTick("townhall_knight", 20, knightTick);
api.onTick("townhall_charge", 5, chargeTick);
api.onTick("townhall_marked", 20, markedTick);
api.onTick("townhall_marked_fast", 1, markedFastTick);
api.onTick("townhall_watchfire", 20, watchfireTick);

api.on("ready", () => resumeBuilds());

// What a joining player is told. With the first-join conductor (core, addJoinStep) this waits its turn at
// order 40, after the look picker, the welcome hall and the journal; without it, it falls back to a short delay.
const pointsNotice = (player) => {
  const hero = heroOf(player);
  if (hero.points > 0) player.sendMessage(`§bYou have ${hero.points} unspent skill point${hero.points === 1 ? "" : "s"}.§7 Spend them at the Tree of Oaths in your town hall.`);
};
const hasConductor = typeof api.addJoinStep === "function";
if (hasConductor) api.addJoinStep(40, "town hall notices", async (player) => pointsNotice(player), { when: "returning" });
world.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn) return;
  system.runTimeout(() => {
    if (!event.player.isValid) return;
    setTreeLook(event.player.id); // quiet bookkeeping, not something the player sees
    if (!hasConductor) pointsNotice(event.player);
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
      if (args[0] !== "none" && !ROLES[args[0]]) return player.sendMessage(`§cUse ${Object.keys(ROLES).join(", ")} or none.`);
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
    api.assertEqual(blockedReason(SKILL.arc_step, { ...hero, path: "marked", level: 2, victor: true, skills: { arc_blink: 1 } }, 3), undefined);
    api.assertEqual(blockedReason(SKILL.arc_step, { ...hero, path: "marked", level: 2, skills: { arc_blink: 1 } }, 3), "Needs Renown 12");
  },
  "ranks follow points sworn to the path": () => {
    api.assertEqual(rankOf("knight", {}).name, "Squire");
    api.assertEqual(rankOf("knight", { blade_bash: 3 }).name, "Man-at-Arms");
    api.assertEqual(rankOf("marked", { arc_bolt: 3, arc_ward: 3, arc_blink: 1 }).name, "Adept");
    api.assertEqual(rankOf("none", {}), undefined);
    api.assertEqual(rankOf("marked", { arc_bolt: 3, arc_ward: 3, arc_quiet: 3, arc_blink: 3, arc_echo: 3, arc_bind: 3 }).name, "Sorcerer");
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
        // (rebuilt halls mark their door: an open doorway or a real door block both count)
        const lift = STYLES[id].lift;
        const at = plan.marks.door ?? { x: 0, y: 1 + lift, z: 1 + lift };
        const door = plan.cells.get(`${at.x},${at.y},${at.z}`);
        const isDoor = door && (STYLES[id].roles[door.role] ?? [])[0]?.endsWith("_door");
        api.assert(!door || door.role === "air" || isDoor, `${id} ${level} door is open (${door?.role})`);
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
  "the rumor board deals three steady jobs a day": () => {
    const a = rumorsFor(12, "p1", 1), b = rumorsFor(12, "p1", 1), c = rumorsFor(13, "p1", 1);
    api.assertEqual(a, b);
    api.assertEqual(a.length, 3);
    api.assert(JSON.stringify(a) !== JSON.stringify(c), "a new day brings new rumors");
    for (let day = 0; day < 40; day++) for (const job of rumorsFor(day, "someone", day * 2)) {
      api.assert(job.need >= 2 && job.renown > 0 && job.emeralds > 0, JSON.stringify(job));
      const d = describe(job);
      api.assert(d.title && d.text && !/undefined/.test(d.title + d.text), d.text);
    }
    api.assertEqual(jobTier(0), 0);
    api.assertEqual(jobTier(50), 4);
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

api.addTests("tree screen", {
  "every skill has its own place on the tree screen": () => {
    for (const branch of Object.keys(BRANCHES)) {
      const pos = treeLayout(branch), seen = new Set();
      for (const s of SKILLS.filter((k) => k.branch === branch)) {
        const p = pos[s.id];
        api.assert(p && p.col >= 0 && p.col < COLS && p.row === s.ring - 1, `${s.id} is placed`);
        api.assert(!seen.has(`${p.col},${p.row}`), `${s.id} shares a cell`);
        seen.add(`${p.col},${p.row}`);
      }
      const cells = treeCells(branch);
      api.assertEqual(cells.length, COLS * ROWS);
      api.assertEqual(cells.filter((c) => c && c !== "back").length, SKILLS.filter((k) => k.branch === branch).length);
    }
  },
});

// Debts from the Rumor Board: people you worked for unpaid stand with your walls. +1 guard each, up to 3.
api.addGuardLimitHook((owner, limit) => {
  const p = world.getAllPlayers().find((x) => x.id === owner);
  return limit + (p ? Math.min(3, heroOf(p).rumorDebts ?? 0) : 0);
});

api.addTests("hall build", {
  "every hall has a Town Board just inside, off the aisle, before the Tree": () => {
    for (const id of STYLE_IDS) for (let level = 1; level <= 5; level++) {
      const p = drawHall(level, STYLES[id]), b = p.marks.board, t = p.marks.tree;
      api.assert(b && p.cells.get(`${b.x},${b.y},${b.z}`)?.role === "board", `${id} ${level} has a board`);
      api.assert(Math.abs(b.x) >= 2 && b.z <= t.z + 2, `${id} ${level}: board off the aisle, in front of the Tree`);
      api.assert(p.cells.get(`${b.x},${b.y},${b.z}`)?.o?.dir === boardDir(b.x), `${id} ${level}: board faces the aisle`);
    }
  },
  "the clear box holds every block of the old hall above the ground": () => {
    for (const id of STYLE_IDS) for (const forward of [{ x: 0, z: 1 }, { x: 1, z: 0 }, { x: 0, z: -1 }, { x: -1, z: 0 }]) {
      const plan = drawHall(3, STYLES[id]), origin = { x: 100, y: 64, z: -40 };
      const box = clearBoxFor(plan, origin, forward);
      for (const c of worldCells(plan, origin, forward)) {
        if (c.y < origin.y) continue;
        api.assert(c.x >= box.min.x && c.x <= box.max.x && c.y <= box.max.y && c.z >= box.min.z && c.z <= box.max.z, `${id} ${JSON.stringify(forward)}: ${JSON.stringify(c)} inside`);
      }
    }
  },
  "build progress only ever goes up and ends at 100%": () => {
    const job = { clearBox: { min: { y: 0 }, max: { y: 9 } }, columns: new Array(30), cells: new Array(500), stage: "clear", layer: 9, cursor: 0, index: 0 };
    let last = -1;
    const look = () => { const f = progressOf(job); api.assert(f >= last, "never goes back"); last = f; };
    for (; job.layer >= 0; job.layer--) look();
    job.stage = "columns";
    for (; job.cursor <= 30; job.cursor++) look();
    job.stage = "cells";
    for (; job.index <= 500; job.index += 50) look();
    api.assertEqual(progressOf(job), 1);
  },
});

api.addTests("clue sense", {
  "the nearest clue in range wins, anything past 16 blocks is ignored": () => {
    const at = { x: 0, y: 64, z: 0 };
    api.assertEqual(nearestClue(at, []), undefined);
    api.assertEqual(nearestClue(at, [{ x: 30, y: 64, z: 0 }]), undefined);
    const near = nearestClue(at, [{ x: 10, y: 64, z: 0, kind: "tome" }, { x: 3, y: 64, z: 3, kind: "loose" }, { x: 40, y: 64, z: 0 }]);
    api.assertEqual(near.kind, "loose");
  },
});

api.addTests("rumor board variety", {
  "bounties hunt our own creatures, the region's own where you live": () => {
    for (const region of [undefined, "Aldmere Vale", "Frostmarch", "Saltreach", "Emberwaste", "Blackfen", "Kingsrest"]) {
      const list = bountiesFor(region);
      api.assert(list.length >= 2, `${region}: at least two kinds to hunt`);
      for (const [type, , , home] of list) api.assert(type.startsWith("siege:") && (!home || !region || home === region), `${region}: ${type}`);
    }
    for (let day = 0; day < 30; day++) for (const job of rumorsFor(day, "hunter", 6, { types: ["bounty", "camp", "supply"], region: "Frostmarch" })) {
      if (job.type === "bounty") api.assert(["siege:rimewolf", "siege:hollow_footman", "siege:torchbearer"].includes(job.mob), job.mob);
    }
  },
  "the Storyteller's choice of jobs is what the board shows": () => {
    const jobs = rumorsFor(5, "tester", 10, { types: ["supply", "rescue", "bounty"] });
    api.assertEqual(jobs.map((j) => j.type).join(), "supply,rescue,bounty");
    api.assert(Object.keys(JOB_KIND).length >= 3 && new Set(Object.values(JOB_KIND)).size >= 2, "the rumors deck needs 3 options of 2 kinds");
  },
  "the board never repeats itself": () => {
    // play 120 days, always taking the first job offered
    const hero = {}, seen = new Map();
    let last;
    for (let day = 0; day < 120; day++) {
      const jobs = rumorsFor(day, "tester", Math.floor(day / 3), { lastType: hero.lastJobType, recent: hero.rumorRecent });
      api.assertEqual(jobs.length, 3);
      api.assert(!jobs.some((j) => j.type === last), `day ${day} offers the kind of job just done`);
      api.assertEqual(new Set(jobs.map((j) => j.giver)).size, 3, "three different people ask");
      const job = jobs[0];
      const key = `${job.type}|${job.giver}|${job.place}|${job.reason}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
      api.assert(seen.get(key) <= 4, `the same job came up ${seen.get(key)} times: ${key}`);
      remember(hero, job);
      last = job.type;
    }
    api.assert(KEEPSAKES.length >= 10 && new Set(KEEPSAKES.map((k) => k[1])).size === KEEPSAKES.length, "keepsakes are all different");
  },
});

api.addTests("roles", {
  "every role has a branch, a ladder and enough skills to reach its top rank": () => {
    for (const [id, role] of Object.entries(ROLES)) {
      api.assert(BRANCHES[role.branch]?.who === id, `${id} owns its branch`);
      api.assertEqual(RANKS[id]?.length, 5);
      const mine = SKILLS.filter((s) => s.branch === role.branch);
      const total = mine.reduce((n, s) => n + s.max * s.cost, 0);
      api.assert(total >= RANKS[id][4].at, `${id} can reach ${RANKS[id][4].name} (${total} points of skills)`);
      for (let ring = 1; ring <= 5; ring++) api.assert(mine.some((s) => s.ring === ring), `${id} has a ring ${ring} skill`);
      api.assert(canBranch(role.branch, id) && !canBranch(role.branch, "none"), `${id} branch is theirs alone`);
    }
    api.assertEqual(roleForStyle("blackfen"), "witch");
    api.assertEqual(roleForStyle("emberwaste"), "rider");
    api.assertEqual(roleForStyle("vale"), undefined);
    for (const id of Object.keys(ROLES)) if (ROLES[id].region) api.assert(ROLE_DEEDS[id]?.deed && (ROLE_DEEDS[id].boss || ROLE_DEEDS[id].event), `${id} is earned by a deed`);
    api.assertEqual(roleForBoss("siege:pale_huntsman"), "forgemaster");
    api.assertEqual(roleForBoss("siege:drowned_bride"), "captain");
    api.assertEqual(roleForBoss("siege:mother_of_changelings"), "witch");
    api.assertEqual(roleForBoss("minecraft:zombie"), undefined);
    api.assertEqual(new Set(Object.values(ROLES).map((r) => r.branch)).size, Object.keys(ROLES).length);
  },
});

api.addTests("messenger", {
  "news goes home, by messenger, or waits": () => {
    api.assertEqual(route({ online: true, atHome: true, hasMessenger: false }), "home");
    api.assertEqual(route({ online: true, atHome: false, hasMessenger: true }), "messenger");
    api.assertEqual(route({ online: true, atHome: false, hasMessenger: false }), "later");
    api.assertEqual(route({ online: false, atHome: false, hasMessenger: true }), "later");
  },
  "one fight is one message, each assault its own": () => {
    api.assert(cooling({ player: 100 }, "player", 200));
    api.assert(!cooling({ player: 100 }, "player", 100 + MESSENGER.cooldown.player));
    api.assert(!cooling({ raid: 100 }, "raid", 100));
    api.assert(!cooling({ "vault:a": 100 }, "vault", 150, "vault:b"), "different words get through");
    api.assert(cooling({ "vault:a": 100 }, "vault", 150, "vault:a"));
    api.assertEqual(bucket("drill"), "vault");
    api.assertEqual(bucket("nonsense"), "other");
  },
  "the messenger points the way home": () => {
    api.assertEqual(heading({ x: 0, z: 0 }, { x: 0, z: -100 }), "north");
    api.assertEqual(heading({ x: 0, z: 0 }, { x: 100, z: 100 }), "south-east");
    api.assertEqual(wayHome({ x: 0, z: 0 }, { x: -300, z: 0 }), "300 blocks to the west");
    api.assertEqual(wayHome({ x: 0, z: 0 }, { x: 5, z: 5 }), "close by");
    api.assertEqual(newsText("player", { name: "Oakhold", who: "Sam" }), "Sam is attacking Oakhold.");
  },
  "waiting news is kept short and read out once": () => {
    let list = [];
    for (let i = 0; i < 12; i++) list = keepNews(list, `line ${i % 10}`, i);
    api.assertEqual(list.length, MESSENGER.keepNews);
    api.assertEqual(new Set(list.map((n) => n.text)).size, list.length);
    api.assertEqual(homecoming([]).length, 0);
    api.assertEqual(homecoming([{ text: "x" }]).length, 3);
  },
  "the Messenger costs a point or Regals, and Regals are not refunded": () => {
    const m = SKILL[MESSENGER.skill];
    api.assert(m && m.branch === "keep" && m.ring === 1 && m.cost === 1 && m.coins === MESSENGER.coins);
    const hero = { ...blankHero(), points: 0, level: 1 };
    api.assertEqual(blockedReason(m, hero, 1), "Needs 1 point");
    api.assertEqual(coinBlocked(m, hero, 1), undefined);
    api.assertEqual(coinBlocked(m, hero, 0), "Needs a Longhouse");
    api.assertEqual(coinBlocked(SKILL.keep_hearth, hero, 1), "Not for sale");
    const bought = { ...hero, skills: { keep_messenger: 1, keep_hearth: 2 }, bought: { keep_messenger: 1 } };
    api.assertEqual(refundable(bought), 2);
    api.assertEqual(keptOnUnbind(bought), { keep_messenger: 1 });
    api.assertEqual(refundable({ ...bought, bought: {} }), 3);
  },
});
