// The town hall: place a Hall Cornerstone in your settlement and raise a hall on it.
// It grows with your settlement tier (Longhouse, Stone Hall, Keep, Fortress, Sovereign's Throne)
// and is rebuilt in place each time, in your region's style.

import { flyby } from "./flyby.js";
import { world, system, GameMode, ItemStack } from "@minecraft/server";
import { ECON } from "../economy/config.js";
import { funds, charge } from "../economy/coins.js";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import * as api from "../siege/api.js";
import { HALL_TIERS, drawHall, frameFor } from "./halls.js";
import { STYLES, STYLE_IDS, styleFromBiome, styleFromGround } from "./styles.js";
import { startBuild, buildFor, worldMarks, worldBox, clearBoxFor, resolveRole } from "./build.js";
import { heroOf, grantPoints, grantRenown, playerById } from "./hero.js";
import { sfx } from "../core/sfx.js";

export const CORNERSTONE = "siege:hall_cornerstone";
export const TREE = "siege:tree_of_oaths";
export const BOARD = "siege:hall_board"; // the Town Board inside every hall: click it for the Town Hall menu

const store = api.moduleStore("siege:townhall", () => ({ halls: {} }));
export const halls = () => store.data.halls;
export const hallOf = (owner) => halls()[owner];
export const saveHalls = () => store.save();

// ---------- what each tier costs (vanilla materials only) ----------

const any = (...parts) => (id) => parts.some((p) => id.endsWith(p));
const VANILLA_STONE = any("cobblestone", "cobbled_deepslate", ":stone", "stone_bricks", "stonebrick", "deepslate_bricks", "sandstone", "mud_bricks", "calcite");
const STONE = (id) => VANILLA_STONE(id) || id.startsWith("siege:castle_"); // every region's Castle Stone counts too
const WOOD = any("_planks", ":planks");
const is = (id) => (other) => other === id;
const COINS = "coins"; // a cost paid in the world currency (pockets, and the strongbox at home) instead of an item

export const HALL_COSTS = [
  null,
  [["planks", 48, WOOD], ["building stone", 32, STONE]],
  [["planks", 64, WOOD], ["building stone", 128, STONE], ["iron ingots", 8, is("minecraft:iron_ingot")], [ECON.many, 80, COINS]],
  [["building stone", 256, STONE], ["iron ingots", 16, is("minecraft:iron_ingot")], [ECON.many, 240, COINS], ["diamonds", 4, is("minecraft:diamond")]],
  [["building stone", 384, STONE], ["iron ingots", 32, is("minecraft:iron_ingot")], [ECON.many, 512, COINS], ["diamonds", 12, is("minecraft:diamond")], ["netherite scrap", 2, is("minecraft:netherite_scrap")]],
  [["gold ingots", 32, is("minecraft:gold_ingot")], [ECON.many, 512, COINS], ["diamonds", 16, is("minecraft:diamond")], ["netherite ingots", 2, is("minecraft:netherite_ingot")]],
];

const UNLOCKS = [
  null,
  "The Tree of Oaths (first ring of skills) and your Ledger stand",
  "Second ring of skills, a Great Hall, the Cartographer's Table and a Sage's study",
  "Third ring of skills, four towers and a war room that reads the next siege",
  "Capstone skills, a gatehouse, spired towers and a throne room",
  "The Crown Ring of skills, a gilded hall and the crown vault",
];

const invOf = (player) => player.getComponent("minecraft:inventory").container;

export function countMatching(player, match) {
  if (match === COINS) return funds(player);
  const inv = invOf(player);
  let n = 0;
  for (let i = 0; i < inv.size; i++) {
    const item = inv.getItem(i);
    if (item && match(item.typeId)) n += item.amount;
  }
  return n;
}

export function takeMatching(player, match, amount) {
  if (match === COINS) return void charge(player, amount, "town hall");
  const inv = invOf(player);
  for (let i = 0; i < inv.size && amount > 0; i++) {
    const item = inv.getItem(i);
    if (!item || !match(item.typeId)) continue;
    if (item.amount > amount) {
      item.amount -= amount;
      inv.setItem(i, item);
      amount = 0;
    } else {
      amount -= item.amount;
      inv.setItem(i, undefined);
    }
  }
}

export function costFor(player, level) {
  const discount = (heroOf(player).skills.keep_masterbuilder ?? 0) > 0 ? 0.75 : 1;
  return HALL_COSTS[level].map(([label, amount, match]) => ({ label, amount: Math.ceil(amount * discount), match, have: countMatching(player, match) }));
}

// ---------- which tier a settlement may build ----------

export function allowedLevel(keep) {
  if (!keep) return 0;
  if (keep.sovereign) return 5;
  return Math.max(1, api.TIERS.indexOf(api.tierOf(keep)) + 1);
}

// The hall level of the settlement a block stands in (0 = no hall)
export function hallLevelAt(location, dimensionId = "minecraft:overworld") {
  if (dimensionId !== "minecraft:overworld" || !api.isReady()) return 0;
  const owner = api.settlementAt(location);
  return (owner && hallOf(owner)?.level) || 0;
}

// ---------- style ----------

function guessStyle(block) {
  try {
    const biome = block.dimension.getBiome?.(block.location);
    const fromBiome = styleFromBiome(biome?.id ?? "");
    if (fromBiome) return fromBiome;
  } catch {
    // older game: no biome lookup, read the ground instead
  }
  const counts = {};
  for (let dx = -12; dx <= 12; dx += 4)
    for (let dz = -12; dz <= 12; dz += 4) {
      try {
        const top = block.dimension.getTopmostBlock({ x: block.x + dx, z: block.z + dz });
        if (top) counts[top.typeId] = (counts[top.typeId] ?? 0) + 1;
      } catch {
        // not loaded
      }
    }
  return styleFromGround(counts);
}

// ---------- placing and breaking the cornerstone ----------

function cardinal(view) {
  return Math.abs(view.x) > Math.abs(view.z) ? { x: Math.sign(view.x) || 1, z: 0 } : { x: 0, z: Math.sign(view.z) || 1 };
}

function giveBack(player, block) {
  block.setType("minecraft:air");
  if (player.getGameMode() !== GameMode.Creative) block.dimension.spawnItem(new ItemStack(CORNERSTONE, 1), player.location);
}

world.afterEvents.playerPlaceBlock.subscribe((event) => {
  const { block, player } = event;
  if (block.typeId !== CORNERSTONE || !api.isReady()) return;
  const at = { ...block.location };
  const dim = block.dimension;
  const view = player.getViewDirection();
  // Siege Nights checks first that this is your own land (and takes the block back if not)
  system.run(() => {
    const placed = dim.getBlock(at);
    if (!placed || placed.typeId !== CORNERSTONE) return;
    const owner = api.settlementAt(at);
    if (!owner || !api.keepOf(owner)) return giveBack(player, placed);
    const old = hallOf(owner);
    if (old && !old.lost && old.hidden && old.level > 0) {
      player.sendMessage("§cThis settlement already has a town hall. It stays on the hall ground your town laid out.");
      return giveBack(player, placed);
    }
    if (old && !old.lost) {
      const stone = cornerOf(old);
      const still = dim.getBlock(stone)?.typeId === CORNERSTONE;
      if (still && !(stone.x === at.x && stone.y === at.y && stone.z === at.z)) {
        player.sendMessage("§cThis settlement already has a Hall Cornerstone. Break that one first if you want to move the hall.");
        return giveBack(player, placed);
      }
    }
    const f = cardinal(view);
    halls()[owner] = {
      x: at.x, y: at.y, z: at.z, fx: f.x, fz: f.z,
      level: 0, paid: old?.paid ?? 0, best: old?.best ?? 0, style: old?.style ?? guessStyle(placed), building: null, marks: {},
    };
    saveHalls();
    player.sendMessage(`§6Hall Cornerstone set.§7 The hall will rise in front of you, the way you are facing now, in the §f${STYLES[halls()[owner].style].name}§7 style. Click the cornerstone to begin.`);
    sfx(player, "random.anvil_use");
  });
});

world.afterEvents.playerBreakBlock.subscribe((event) => {
  if (event.brokenBlockPermutation.type.id !== CORNERSTONE || !api.isReady()) return;
  const at = event.block.location;
  for (const [owner, hall] of Object.entries(halls())) {
    const stone = cornerOf(hall);
    if (stone.x !== at.x || stone.y !== at.y || stone.z !== at.z) continue;
    hall.lost = true;
    hall.building = null;
    hall.level = 0; // the Tree goes quiet until a cornerstone stands again
    saveHalls();
    playerById(owner)?.sendMessage("§7Your Hall Cornerstone was removed. The building stays, but the Tree of Oaths sleeps until you set a cornerstone again. Levels you already paid for are free to rebuild.");
  }
});

// ---------- building ----------

const RISE_TICKS = [0, 140, 200, 260, 320, 320]; // about how long each tier's walls take to rise (7 to 16 seconds)

// Where the Hall Cornerstone block stands while a hall is being started. Older builds moved it beside the
// path (hall.cs). Once a hall stands the stone is taken away (hall.hidden): Mateo found it looked like a
// stray command block. The Town Hall menu then opens from the Town Board inside the hall, or the Keep menu.
export const cornerOf = (hall) => hall.cs ?? { x: hall.x, y: hall.y, z: hall.z };

function hideCornerstone(owner) {
  const hall = hallOf(owner);
  if (!hall) return;
  try {
    const block = world.getDimension("overworld").getBlock(cornerOf(hall));
    if (!block) return; // not loaded: tidyCornerstone tries again later
    if (block.typeId === CORNERSTONE) block.setType("minecraft:air");
  } catch (e) {
    return console.warn(`[Town Hall] could not take the cornerstone away: ${e}`);
  }
  delete hall.cs;
  hall.hidden = true;
  saveHalls();
}

const BAR = 20;
const bar = (fraction) => {
  const n = Math.round(fraction * BAR);
  return `§6${"|".repeat(n)}§8${"|".repeat(BAR - n)} §f${Math.floor(fraction * 100)}%`;
};

function fits(owner, plan, hall) {
  const box = worldBox(plan, hall, { x: hall.fx, z: hall.fz });
  return { box, ok: box.corners.every((c) => api.settlementAt(c) === owner) };
}

export function beginBuild(owner, level, style, resumeIndex = 0) {
  const hall = hallOf(owner);
  if (!hall || buildFor(owner)) return false;
  const forward = { x: hall.fx, z: hall.fz };
  const plan = drawHall(level, STYLES[style]);
  // take the old hall down completely first, so none of it is left standing in or around the new one
  const clearBox = !resumeIndex && hall.level > 0 ? clearBoxFor(drawHall(hall.level, STYLES[hall.style]), hall, forward) : undefined;
  const fast = (playerById(owner) && (heroOf(playerById(owner)).skills.keep_masterbuilder ?? 0) > 0) ? 2 : 1;
  const perTick = Math.max(8, Math.ceil(plan.cells.size / RISE_TICKS[level])) * fast;
  hall.building = { level, style, index: resumeIndex };
  saveHalls();
  let lastSaved = resumeIndex;
  // the settlement feature clears buildings standing where a bigger hall goes (settle/hallmove.js); once per build
  if (!resumeIndex) api.emit("hallBuildStarted", { owner, level, style });
  startBuild({
    id: owner, dimensionId: "minecraft:overworld", origin: { x: hall.x, y: hall.y, z: hall.z }, forward, plan,
    style: STYLES[style], perTick, clearBox, keep: [cornerOf(hall), { x: hall.x, y: hall.y, z: hall.z }], index: resumeIndex,
    onProgress(fraction, done) {
      // the name is said once, by the title when the build starts; after that only a bar
      const player = playerById(owner);
      if (player && system.currentTick % 10 === 0) player.onScreenDisplay.setActionBar(bar(fraction));
      if (done - lastSaved > 2000) { hall.building.index = done; lastSaved = done; saveHalls(); }
    },
    onDone() {
      const first = level > (hall.best ?? 0);
      hall.level = level;
      hall.style = style;
      hall.best = Math.max(hall.best ?? 0, level);
      hall.building = null;
      hall.lost = false;
      hall.marks = worldMarks(plan, hall, forward);
      saveHalls();
      hideCornerstone(owner);
      setTreeLook(owner);
      api.emit("hallBuilt", { owner, level, style, marks: hall.marks, first });
      const player = playerById(owner);
      const keep = api.keepOf(owner);
      for (const p of world.getPlayers()) {
        if (p.id === owner) {
          api.title(p, `§6${HALL_TIERS[level].name} complete`, `§7${UNLOCKS[level]}`);
          sfx(p, "ui.toast.challenge_complete");
        } else if (first) p.sendMessage(`§6${keep?.name ?? "A settlement"} has raised a ${HALL_TIERS[level].name}.`);
      }
      if (first && player) {
        grantPoints(player, level, `${HALL_TIERS[level].name} built`);
        grantRenown(player, 60 * level, "town hall", true);
      }
    },
  });
  // watch it rise: the camera circles the hall while it is built (not when a build resumes after a restart)
  const watcher = playerById(owner);
  if (watcher && !resumeIndex) {
    const b = plan.bounds(), mid = (b.z0 + b.z1) / 2, size = Math.max(b.x1 - b.x0, b.z1 - b.z0);
    flyby(watcher, {
      center: { x: hall.x + forward.x * mid, y: hall.y, z: hall.z + forward.z * mid },
      radius: size * 0.75 + 10, height: b.y1 * 0.8 + 8,
      seconds: Math.min(20, Math.max(8, RISE_TICKS[level] / fast / 20 + (clearBox ? 2 : 0))), title: `§6The ${HALL_TIERS[level].name} rises`,
    });
  }
  return true;
}

// Halls raised before the stone was taken away still show it: take it now
// (on load, and again whenever the Town Hall menu opens, in case its chunk was not loaded then)
export function tidyCornerstone(owner) {
  const hall = hallOf(owner);
  if (!hall || hall.lost || hall.building || !(hall.level > 0)) return;
  if (!hall.hidden) hideCornerstone(owner);
  if (!hall.marks?.board) addBoard(owner);
  else turnBoard(owner);
}

// A Town Board set down before it was turned to face the aisle is turned round where it stands, and one standing where
// halls of its size no longer have it is moved
function turnBoard(owner) {
  const hall = hallOf(owner);
  const plan = drawHall(hall.level, STYLES[hall.style]);
  const spot = plan.marks.board;
  if (!spot) return;
  const forward = { x: hall.fx, z: hall.fz };
  const at = worldMarks(plan, hall, forward).board;
  if (!at) return;
  const old = hall.marks.board;
  if (at.x !== old.x || at.y !== old.y || at.z !== old.z) {
    // the hall's board spot moved (Mateo 2026-11-14: the small halls had it outside, under the eaves): take the old
    // board down and put it where a new hall of this size has it
    try {
      const dim = world.getDimension("overworld");
      const was = dim.getBlock(old), now = dim.getBlock(at);
      if (!was || !now) return; // not loaded: next time
      if (!now.isAir && now.typeId !== BOARD) return; // something of the player's stands there: leave the old one
      if (was.typeId === BOARD) was.setType("minecraft:air");
      hall.marks = { ...hall.marks, board: undefined };
      saveHalls();
      addBoard(owner);
    } catch (e) {
      console.warn(`[Town Hall] could not move the Town Board: ${e}`);
    }
    return;
  }
  try {
    const block = world.getDimension("overworld").getBlock(at);
    if (block?.typeId !== BOARD) return;
    const want = resolveRole(STYLES[hall.style], frameFor(forward), "board", plan.cells.get(`${spot.x},${spot.y},${spot.z}`)?.o);
    const dir = want.getState("minecraft:cardinal_direction");
    if (want.type.id === BOARD && dir && block.permutation.getState("minecraft:cardinal_direction") !== dir) block.setPermutation(want);
  } catch {
    // not loaded: next time
  }
}

// Halls raised before the Town Board existed get one now, where a new hall of that size would have it
function addBoard(owner) {
  const hall = hallOf(owner);
  const plan = drawHall(hall.level, STYLES[hall.style]);
  const spot = plan.marks.board;
  if (!spot) return;
  const forward = { x: hall.fx, z: hall.fz };
  const at = worldMarks(plan, hall, forward).board;
  try {
    const block = world.getDimension("overworld").getBlock(at);
    if (!block) return; // not loaded: try again later
    if (block.isAir) {
      const cell = plan.cells.get(`${spot.x},${spot.y},${spot.z}`);
      block.setPermutation(resolveRole(STYLES[hall.style], frameFor(forward), "board", cell?.o));
    }
    if (block.typeId !== BOARD) return;
    hall.marks = { ...(hall.marks ?? {}), board: at };
    saveHalls();
  } catch (e) {
    console.warn(`[Town Hall] could not add the Town Board: ${e}`);
  }
}

// The Tree of Oaths shows a banner tree for a Knight's hall and an ember-root for a Marked one
export function setTreeLook(owner) {
  const hall = hallOf(owner);
  const at = hall?.marks?.tree;
  const player = playerById(owner);
  if (!at || !player) return;
  try {
    const block = world.getDimension("overworld").getBlock(at);
    if (block?.typeId !== TREE) return;
    const look = { none: 0, knight: 1, marked: 2 }[heroOf(player).path] ?? 0;
    block.setPermutation(block.permutation.withState("siege:look", look));
  } catch {
    // not loaded right now
  }
}

// Pick up builds that were under way when the world closed
export function resumeBuilds() {
  for (const [owner, hall] of Object.entries(halls())) {
    tidyCornerstone(owner);
    if (hall.building && !buildFor(owner)) {
      const { level, style, index } = hall.building;
      hall.building = null;
      beginBuild(owner, level, style, index ?? 0);
    }
  }
}

// ---------- menus ----------

// Extra buttons for the Town Hall menu, shown once a hall stands: { label, icon?, action(player, owner) }
export const hallMenuExtras = [];

const tierLine = (keep) => (keep.sovereign ? "Sovereign" : api.tierOf(keep).name);

export function hallMenu(player, owner) {
  const hall = hallOf(owner);
  const keep = api.keepOf(owner);
  if (!keep) return;
  const mine = api.canManage(owner, player.id); // the owner or a writ ally (Mateo, 2026-11-13)
  if (!hall || hall.lost) {
    return player.sendMessage(mine
      ? "§7You have no town hall yet. A town laid out from its map plot gets its Hall Cornerstone with the Hamlet; if you still carry one from before, place it where the front door should be, facing the way the hall should run."
      : "§7This settlement has no town hall yet.");
  }
  tidyCornerstone(owner);
  const running = buildFor(owner);
  const allowed = allowedLevel(keep);
  const next = Math.max(hall.level, hall.building?.level ?? 0) + 1;
  const lines = [
    `§l${keep.name}'s ${hall.level ? HALL_TIERS[hall.level].name : "building site"}§r`,
    `Style: ${STYLES[hall.style].name}   Settlement: ${tierLine(keep)}`,
    hall.level ? `§7${UNLOCKS[hall.level]}` : "§7Nothing stands here yet.",
    "",
  ];
  const form = new ActionFormData().title("Town Hall");
  const actions = [];
  const creative = player.getGameMode() === GameMode.Creative;

  if (running) {
    lines.push(`§6The ${HALL_TIERS[hall.building.level].name} is rising. Stand clear of the works.`);
  } else if (next <= 5) {
    const tier = HALL_TIERS[next];
    const free = creative || next <= (hall.paid ?? 0);
    const cost = costFor(player, next);
    lines.push(`§lNext: ${tier.name}§r`, `§7${UNLOCKS[next]}`);
    if (next > allowed) lines.push(`§cNeeds a ${tier.settlement === "Sovereign" ? "Sovereign's settlement (win the Grand Siege)" : tier.settlement}. Yours is a ${tierLine(keep)}.`);
    else if (free) lines.push("§aAlready paid for. Free to raise.");
    else for (const c of cost) lines.push(`${c.have >= c.amount ? "§a" : "§c"}${c.amount} ${c.label}§7 (you have ${c.have})`);
    if (mine && next <= allowed) {
      const canPay = free || cost.every((c) => c.have >= c.amount);
      form.button(canPay ? `§2Raise the ${tier.name}` : `§8Raise the ${tier.name}\n(missing materials)`, "textures/items/siege_hall_cornerstone");
      actions.push(() => (canPay ? confirmBuild(player, owner, next, hall.style, free ? [] : cost) : player.sendMessage("§cYou don't have the materials yet. They are listed in the Town Hall menu.")));
    }
  } else {
    lines.push("§6This hall is as grand as a hall can be.");
  }

  if (mine && !running) {
    form.button(`Regional style\n§8${STYLES[hall.style].name}`, "textures/items/painting");
    actions.push(() => styleMenu(player, owner));
    if (hall.level > 0) {
      form.button("Repair the hall\n§8puts every block back", "textures/items/iron_pickaxe");
      actions.push(() => confirmBuild(player, owner, hall.level, hall.style, [], true));
    }
  }
  if (hall.level >= 1) for (const extra of hallMenuExtras) {
    form.button(extra.label, extra.icon);
    actions.push(() => extra.action(player, owner));
  }
  if (hall.level >= 2) {
    form.button("Ask the Sage", "textures/items/book_writable");
    actions.push(() => sageMenu(player, owner));
  }
  if (hall.level >= 3) {
    form.button("War room", "textures/items/map_filled");
    actions.push(() => warRoom(player, owner));
  }
  form.body(lines.join("\n"));
  form.button("Close");
  form.show(player).then((r) => { if (!r.canceled) actions[r.selection]?.(); }).catch(() => {});
}

function confirmBuild(player, owner, level, style, cost, repair = false) {
  const hall = hallOf(owner);
  const plan = drawHall(level, STYLES[style]);
  const { box, ok } = fits(owner, plan, hall);
  if (!ok) {
    return player.sendMessage(`§cThe ${HALL_TIERS[level].name} is ${box.width} wide and ${box.depth} deep and would stick out of your land. Move the cornerstone closer to your Keep Banner (break it and place it again), or grow your settlement.`);
  }
  if (api.getState().active) return player.sendMessage("§cNo building during a siege.");
  new MessageFormData()
    .title(repair ? "Repair the hall" : `Raise the ${HALL_TIERS[level].name}`)
    .body([
      `The hall covers ${box.width} blocks wide, ${box.depth} deep and ${box.height} tall, starting at the cornerstone and running away from the side you placed it from.`,
      "",
      "§cEverything inside that space is replaced, including chests and anything you built there.§r Empty your old hall first.",
      cost.length ? `\nCost: ${cost.map((c) => `${c.amount} ${c.label}`).join(", ")}` : "",
    ].join("\n"))
    .button1("Build it")
    .button2("Not yet")
    .show(player)
    .then((r) => {
      if (r.canceled || r.selection !== 0) return;
      for (const c of cost) if (countMatching(player, c.match) < c.amount) return player.sendMessage("§cYou no longer have the materials.");
      for (const c of cost) takeMatching(player, c.match, c.amount);
      hall.paid = Math.max(hall.paid ?? 0, level);
      if (beginBuild(owner, level, style)) sfx(player, "random.anvil_use");
    })
    .catch(() => {});
}

function styleMenu(player, owner) {
  const hall = hallOf(owner);
  const form = new ActionFormData().title("Regional style").body("Each region builds the same halls in its own materials. Changing style rebuilds your hall for free.");
  for (const id of STYLE_IDS) form.button(`${id === hall.style ? "§2" : ""}${STYLES[id].name}\n§8${STYLES[id].blurb}`);
  form.button("Back");
  form.show(player).then((r) => {
    if (r.canceled || r.selection >= STYLE_IDS.length) return;
    const style = STYLE_IDS[r.selection];
    if (style === hall.style) return;
    if (hall.level > 0) confirmBuild(player, owner, hall.level, style, [], true);
    else {
      hall.style = style;
      saveHalls();
      player.sendMessage(`§7Your hall will be built in the ${STYLES[style].name} style.`);
    }
  }).catch(() => {});
}

// The Sage: authored advice that reacts to where you are. (The story threads add the real NPC.)
function sageMenu(player, owner) {
  const hero = heroOf(player);
  const hall = hallOf(owner);
  const keep = api.keepOf(owner);
  const tips = [];
  if (hero.path === "none") tips.push(hero.ember === "fallen" ? "\"That pale ember you found. Hold it and decide: take it into your hand, or carry it to the Tree and swear it away. I would not sleep near it either way.\"" : "\"Old Elspeth by your hearth hears more than I read. If anything ever comes down near your gate, take it to her before you take it to anyone.\"");
  if (hero.points > 0) tips.push(`"You carry ${hero.points} unspent oath${hero.points === 1 ? "" : "s"}. The Tree is listening."`);
  if (hall.level < allowedLevel(keep)) tips.push("\"Your settlement has outgrown this hall. The cornerstone will take a bigger one.\"");
  else if (hall.level < 5) tips.push(`"A ${HALL_TIERS[hall.level + 1].name} wants a ${HALL_TIERS[hall.level + 1].settlement}. Win your sieges and the land will follow."`);
  if (hero.path === "marked") tips.push(hero.resonance >= 70 ? "\"You are loud today. I can hear the bell on you from here. Sit. Breathe. Let it fade before you walk among people.\"" : "\"The Ember answers when you call. Remember that something else hears the call too.\"");
  if (hero.path === "knight") tips.push("\"The Order writes its oaths in steel. Ask yourself who wrote the first one, and why no one will say.\"");
  tips.push("\"Skill comes from deeds: sieges held, warlords slain, halls raised, and the first time you face each kind of creature. Killing the same thing over and over teaches you little.\"");
  new ActionFormData().title("The Sage").body(tips.join("\n\n")).button("Thank you").show(player).catch(() => {});
}

const COMPASS = ["east", "south", "west", "north"];

function warRoom(player, owner) {
  const keep = api.keepOf(owner);
  const state = api.getState();
  const until = api.nextSiegeDay() - world.getDay();
  const plan = state.plans?.[owner];
  const lines = [
    state.active ? "§cA siege is under way." : until <= 0 ? "§cThe next siege comes tonight." : `The next siege comes in ${until} day${until === 1 ? "" : "s"}.`,
    `Sieges faced: ${keep.sieges ?? 0}   Won: ${keep.wins ?? 0}   Streak: ${keep.streak ?? 0}`,
    keep.lastSiege ? `Last siege: ${keep.lastSiege.faction}, threat ${keep.lastSiege.threat}, ${keep.lastSiege.won ? "held" : "not held"}.` : "",
    keep.lastTactic ? `They remember how you fought last time (${keep.lastTactic}). Expect them to counter it.` : "",
    plan ? `§6Tonight: ${api.FACTIONS[plan.faction]?.name ?? plan.faction}, threat ${plan.budget}, from the ${plan.sides.map((a) => COMPASS[Math.round(a / (Math.PI / 2)) % 4]).join(" and ")}.` : "",
    "",
    `Guards: ${api.guardCount(owner)}/${api.guardLimit(owner)}   Keep health: ${api.keepHealth(owner, keep)}`,
  ].filter((l, i, all) => l || all[i - 1]);
  new ActionFormData().title("War room").body(lines.join("\n")).button("Close").show(player).catch(() => {});
}
