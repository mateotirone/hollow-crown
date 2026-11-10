// The town hall: place a Hall Cornerstone in your settlement and raise a hall on it.
// It grows with your settlement tier (Longhouse, Stone Hall, Keep, Fortress, Sovereign's Throne)
// and is rebuilt in place each time, in your region's style.

import { world, system, GameMode, ItemStack } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import * as api from "../siege/api.js";
import { HALL_TIERS, drawHall } from "./halls.js";
import { STYLES, STYLE_IDS, styleFromBiome, styleFromGround } from "./styles.js";
import { startBuild, buildFor, worldCells, worldMarks, worldBox } from "./build.js";
import { heroOf, grantPoints, grantRenown, playerById } from "./hero.js";

export const CORNERSTONE = "siege:hall_cornerstone";
export const TREE = "siege:tree_of_oaths";

const store = api.moduleStore("siege:townhall", () => ({ halls: {} }));
export const halls = () => store.data.halls;
export const hallOf = (owner) => halls()[owner];
export const saveHalls = () => store.save();

// ---------- what each tier costs (vanilla materials only) ----------

const any = (...parts) => (id) => parts.some((p) => id.endsWith(p));
const STONE = any("cobblestone", "cobbled_deepslate", ":stone", "stone_bricks", "stonebrick", "deepslate_bricks", "sandstone", "mud_bricks", "calcite");
const WOOD = any("_planks", ":planks");
const is = (id) => (other) => other === id;

export const HALL_COSTS = [
  null,
  [["planks", 48, WOOD], ["building stone", 32, STONE]],
  [["planks", 64, WOOD], ["building stone", 128, STONE], ["iron ingots", 8, is("minecraft:iron_ingot")], ["emeralds", 10, is("minecraft:emerald")]],
  [["building stone", 256, STONE], ["iron ingots", 16, is("minecraft:iron_ingot")], ["emeralds", 30, is("minecraft:emerald")], ["diamonds", 4, is("minecraft:diamond")]],
  [["building stone", 384, STONE], ["iron ingots", 32, is("minecraft:iron_ingot")], ["emeralds", 64, is("minecraft:emerald")], ["diamonds", 12, is("minecraft:diamond")], ["netherite scrap", 2, is("minecraft:netherite_scrap")]],
  [["gold ingots", 32, is("minecraft:gold_ingot")], ["emeralds", 64, is("minecraft:emerald")], ["diamonds", 16, is("minecraft:diamond")], ["netherite ingots", 2, is("minecraft:netherite_ingot")]],
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

function countMatching(player, match) {
  const inv = invOf(player);
  let n = 0;
  for (let i = 0; i < inv.size; i++) {
    const item = inv.getItem(i);
    if (item && match(item.typeId)) n += item.amount;
  }
  return n;
}

function takeMatching(player, match, amount) {
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
    if (old && !old.lost) {
      const still = dim.getBlock(old)?.typeId === CORNERSTONE;
      if (still && !(old.x === at.x && old.y === at.y && old.z === at.z)) {
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
    player.playSound("random.anvil_use");
  });
});

world.afterEvents.playerBreakBlock.subscribe((event) => {
  if (event.brokenBlockPermutation.type.id !== CORNERSTONE || !api.isReady()) return;
  const at = event.block.location;
  for (const [owner, hall] of Object.entries(halls())) {
    if (hall.x !== at.x || hall.y !== at.y || hall.z !== at.z) continue;
    hall.lost = true;
    hall.building = null;
    hall.level = 0; // the Tree goes quiet until a cornerstone stands again
    saveHalls();
    playerById(owner)?.sendMessage("§7Your Hall Cornerstone was removed. The building stays, but the Tree of Oaths sleeps until you set a cornerstone again. Levels you already paid for are free to rebuild.");
  }
});

// ---------- building ----------

const RISE_TICKS = [0, 500, 900, 1300, 1800, 1800]; // about how long each tier takes to rise

function fits(owner, plan, hall) {
  const box = worldBox(plan, hall, { x: hall.fx, z: hall.fz });
  return { box, ok: box.corners.every((c) => api.settlementAt(c) === owner) };
}

export function beginBuild(owner, level, style, resumeIndex = 0) {
  const hall = hallOf(owner);
  if (!hall || buildFor(owner)) return false;
  const forward = { x: hall.fx, z: hall.fz };
  const plan = drawHall(level, STYLES[style]);
  // clear what the old hall had that the new one doesn't
  let remove;
  if (!resumeIndex && hall.level > 0 && (hall.level !== level || hall.style !== style)) {
    const keepCells = new Set(worldCells(plan, hall, forward).map((c) => `${c.x},${c.y},${c.z}`));
    remove = worldCells(drawHall(hall.level, STYLES[hall.style]), hall, forward)
      .filter((c) => !keepCells.has(`${c.x},${c.y},${c.z}`))
      .sort((a, b) => b.y - a.y);
  }
  const fast = (playerById(owner) && (heroOf(playerById(owner)).skills.keep_masterbuilder ?? 0) > 0) ? 2 : 1;
  const perTick = Math.max(8, Math.ceil(plan.cells.size / RISE_TICKS[level])) * fast;
  hall.building = { level, style, index: resumeIndex };
  saveHalls();
  let lastSaved = resumeIndex;
  startBuild({
    id: owner, dimensionId: "minecraft:overworld", origin: { x: hall.x, y: hall.y, z: hall.z }, forward, plan,
    style: STYLES[style], perTick, remove, index: resumeIndex,
    onProgress(done, total) {
      const player = playerById(owner);
      if (player && system.currentTick % 10 === 0) {
        const pct = Math.floor((done / total) * 100);
        player.onScreenDisplay.setActionBar(`§6${HALL_TIERS[level].name} rising §f${pct}%`);
      }
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
      setTreeLook(owner);
      api.emit("hallBuilt", { owner, level, style, marks: hall.marks, first });
      const player = playerById(owner);
      const keep = api.keepOf(owner);
      for (const p of world.getPlayers()) {
        if (p.id === owner) {
          api.title(p, `§6${HALL_TIERS[level].name} complete`, `§7${UNLOCKS[level]}`);
          p.playSound("ui.toast.challenge_complete");
        } else if (first) p.sendMessage(`§6${keep?.name ?? "A settlement"} has raised a ${HALL_TIERS[level].name}.`);
      }
      if (first && player) {
        grantPoints(player, level, `${HALL_TIERS[level].name} built`);
        grantRenown(player, 60 * level, "town hall", true);
      }
    },
  });
  return true;
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
    if (hall.building && !buildFor(owner)) {
      const { level, style, index } = hall.building;
      hall.building = null;
      beginBuild(owner, level, style, index ?? 0);
    }
  }
}

// ---------- menus ----------

const tierLine = (keep) => (keep.sovereign ? "Sovereign" : api.tierOf(keep).name);

export function hallMenu(player, owner) {
  const hall = hallOf(owner);
  const keep = api.keepOf(owner);
  if (!keep) return;
  const mine = owner === player.id;
  if (!hall || hall.lost) {
    return player.sendMessage(mine
      ? "§7You have no town hall yet. Craft a §fHall Cornerstone§7 at the Siege Workshop and place it where the front door should be, facing the way the hall should run."
      : "§7This settlement has no town hall yet.");
  }
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
      if (beginBuild(owner, level, style)) player.playSound("random.anvil_use");
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
  if (hero.path === "none") tips.push(hero.ember === "fallen" ? "\"That pale ember you found. Hold it and decide: take it into your hand, or carry it to the Tree and swear it away. I would not sleep near it either way.\"" : "\"Hold your keep through a siege night. They say something falls from the sky for those who do.\"");
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
