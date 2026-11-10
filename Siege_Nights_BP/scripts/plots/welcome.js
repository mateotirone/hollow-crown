// The welcome hall: where a new player arrives, reads how things stand, and picks where they start.
//
// It is a round stone terrace in the sky over Gull Bay. In the middle stands the Waystone (click it for the
// story so far, where you start and how choosing works). Around the rim stand twelve pedestals, one per plot,
// each set in the direction its plot lies from Kingsrest. Click a pedestal to read about the plot. A free one
// can be chosen: you are set down beside its Plot Stone, it is held for you, and nobody else can take it.
// A taken one shows who holds it, their level and their settlement's level.
//
// Builder commands (Creative):
//   /scriptevent siege:welcome build        build the hall at its place in the sky (takes you there first)
//   /scriptevent siege:welcome build here   build it around where you stand (for flat test worlds)
//   /scriptevent siege:welcome go           go to the hall
//   /scriptevent siege:welcome testarea     build the test area in the sky and lay the whole showcase out on it
//   /scriptevent siege:welcome kingsrest    make where you stand the "start without a home" arrival spot
//   /scriptevent siege:welcome release Name give up Name's pick so the plot is free again
//   /scriptevent siege:welcome status       list every pedestal and who has it
//
// Other features: on("plotChosen", ({ player, plot }) => ...) fires the moment a player picks a plot, before
// they arrive, so a first building can be raised for them. pickOf(plot) is in plots/api.js.

import { world, system, ItemStack, GameMode } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { isReady, keepOf, tierOf, on, emit, addFoundingCheck } from "../siege/api.js";
import { onTick } from "../core/loop.js";
import { moduleStore } from "../core/store.js";
import { PLOT_PLAN, REGION_STYLE, REGION_BLOCK, WELCOME, WARDS, PLOT_STONE, KEEP_BANNER, OVERWORLD } from "./config.js";
import { allPlots, holderOf, npcOf, plotOf, isBuilder, compass, mapMode } from "./claims.js";

const store = moduleStore("siege:plots_welcome", () => ({ hall: null, test: null, kingsrest: null, picks: {} }));
const ARRIVING = "siege_plots_arriving"; // on a player who is in the hall and has not chosen yet
const WAYSTONE = "minecraft:lodestone";
const FREE_LIGHT = "minecraft:sea_lantern";
const TAKEN_BLOCK = "minecraft:polished_blackstone";

export const hallBuilt = () => !!store.data.hall;
const overworld = () => world.getDimension(OVERWORLD);
const KINGSREST = WARDS[0];

// ---------- Where the pedestals stand ----------
// Each one sits toward its plot as seen from Kingsrest, so the ring is a rough picture of the map.
// Plots that lie in nearly the same direction are nudged apart until they have room.

export function pedestalLayout() {
  const rows = PLOT_PLAN.map((plan) => ({
    plan,
    angle: (Math.atan2(plan.x - KINGSREST.x, -(plan.z - KINGSREST.z)) * 180) / Math.PI, // 0 = north, 90 = east
  })).sort((a, b) => a.angle - b.angle);
  const gap = WELCOME.pedestalGap;
  for (let pass = 0; pass < 200; pass++) {
    let moved = false;
    for (let i = 0; i < rows.length; i++) {
      const a = rows[i];
      const b = rows[(i + 1) % rows.length];
      const between = (((b.angle - a.angle) % 360) + 360) % 360;
      if (between >= gap - 0.01) continue;
      const push = (gap - between) / 2;
      a.angle -= push;
      b.angle += push;
      moved = true;
    }
    if (!moved) break;
  }
  return rows.map(({ plan, angle }) => {
    const rad = (angle * Math.PI) / 180;
    const dx = Math.round(WELCOME.pedestalRadius * Math.sin(rad));
    const dz = -Math.round(WELCOME.pedestalRadius * Math.cos(rad));
    // The sign stands one step in toward the middle and faces it
    const sx = Math.round((WELCOME.pedestalRadius - 1.5) * Math.sin(rad));
    const sz = -Math.round((WELCOME.pedestalRadius - 1.5) * Math.cos(rad));
    const rot = ((Math.round((Math.atan2(sx, -sz) / (2 * Math.PI)) * 16) % 16) + 16) % 16; // 0 faces south, 4 west
    return { name: plan.name, plan, dx, dz, sx, sz, rot };
  });
}

// ---------- Who has what ----------

// The real plot behind a planned name: the stone with that name, or else the nearest stone to the planned spot
function plotFor(plan) {
  const plots = allPlots();
  return plots.find((p) => p.name === plan.name)
    ?? plots.filter((p) => !PLOT_PLAN.some((n) => n.name === p.name) && Math.hypot(p.x - plan.x, p.z - plan.z) <= 120)
      .sort((a, b) => Math.hypot(a.x - plan.x, a.z - plan.z) - Math.hypot(b.x - plan.x, b.z - plan.z))[0];
}

const pickEntry = (plotName) => Object.entries(store.data.picks).find(([, pick]) => pick.plot === plotName);

/** The player a plot is being kept for because they chose it in the welcome hall: { id, name } or undefined. */
export function pickOf(plot) {
  const found = pickEntry(plot.name);
  return found ? { id: found[0], name: found[1].name } : undefined;
}

// "free" | "taken" (a keep stands on it) | "kept" (chosen, no keep yet) | "lord" (an NPC lord) | "missing" (no stone yet)
export function statusOf(plan) {
  const plot = plotFor(plan);
  if (!plot) return { state: "missing" };
  const holder = holderOf(plot);
  if (holder) return { state: "taken", plot, id: holder, name: keepOf(holder)?.name ?? "someone" };
  const pick = pickOf(plot);
  if (pick) return { state: "kept", plot, id: pick.id, name: pick.name };
  const npc = npcOf(plot);
  if (npc) return { state: "lord", plot, name: npc.name };
  return { state: "free", plot };
}

// A few lines about a player: level, role, settlement. Works while they are away (the town hall remembers).
function describe(id, fallbackName) {
  const q = { playerId: id };
  emit("levelsQuery", q);
  const keep = keepOf(id);
  const lines = [`§f${q.name ?? fallbackName}§r${q.handled ? (q.online ? " §a(here now)§r" : " §7(away)§r") : ""}`];
  lines.push(`Level: §f${q.level ?? 1}§r${q.role ? ` ${q.role}` : ""}${q.rank ? `, ${q.rank}` : ""}`);
  if (keep) {
    lines.push(`Settlement: §f${keep.name ?? "unnamed"}§r, a §f${keep.tier ?? tierOf(keep)?.name ?? "Hamlet"}§r${keep.sovereign ? " (Sovereign)" : ""}`);
    if (q.hall) lines.push(`Town hall: §f${q.hall}§r`);
    lines.push(`Sieges held: §f${keep.wins ?? 0}§r`);
  } else {
    lines.push("Settlement: §7not founded yet§r");
  }
  return lines.join("\n");
}

// ---------- The hall itself ----------

const hash = (x, z) => {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

function put(dim, x, y, z, typeId, states) {
  try {
    const block = dim.getBlock({ x, y, z });
    if (!block) return undefined;
    block.setType(typeId);
    if (states) {
      let perm = block.permutation;
      for (const [k, v] of Object.entries(states)) perm = perm.withState(k, v);
      block.setPermutation(perm);
    }
    return block;
  } catch {
    return undefined;
  }
}

function writeSign(dim, x, y, z, rot, text) {
  try {
    let block = dim.getBlock({ x, y, z });
    if (!block) return;
    if (block.typeId !== "minecraft:standing_sign") block = put(dim, x, y, z, "minecraft:standing_sign", { ground_sign_direction: rot });
    const sign = block?.getComponent("minecraft:sign");
    if (sign && sign.getText() !== text) sign.setText(text);
  } catch {
    // a sign is a nicety
  }
}

function signText(plan, status) {
  if (status.state === "free") return `${plan.name}\n${plan.region}\n§2Free§r\nClick the stone`;
  if (status.state === "missing") return `${plan.name}\n${plan.region}\n§8Not on this\nmap yet`;
  if (status.state === "lord") return `${plan.name}\n${plan.region}\n§4Held by§r\n${status.name}`;
  return `${plan.name}\n${plan.region}\n§4${status.state === "kept" ? "Chosen by" : "Held by"}§r\n${status.name}`;
}

function buildHall(dim, o) {
  const R = WELCOME.hallRadius;
  for (let dx = -R - 1; dx <= R + 1; dx++) {
    for (let dz = -R - 1; dz <= R + 1; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > R + 1.5) continue;
      for (let dy = 1; dy <= 6; dy++) put(dim, o.x + dx, o.y + dy, o.z + dz, "minecraft:air");
      if (d <= R + 0.5) {
        // Floor: worn stone, a paler ring near the middle, a dark band under the pedestals
        const h = hash(dx, dz);
        let floor = h < 0.12 ? "minecraft:cracked_stone_bricks" : h < 0.3 ? "minecraft:mossy_stone_bricks" : "minecraft:stone_bricks";
        if (d <= 3.5) floor = "minecraft:polished_andesite";
        else if (Math.abs(d - WELCOME.pedestalRadius) < 0.8) floor = "minecraft:polished_deepslate";
        put(dim, o.x + dx, o.y, o.z + dz, floor);
        put(dim, o.x + dx, o.y - 1, o.z + dz, "minecraft:stone_bricks");
      }
      if (d > R - 0.5 && d <= R + 0.5) {
        // Rim: a low wall you can see over, and an unseen one above it so nobody walks off
        put(dim, o.x + dx, o.y + 1, o.z + dz, "minecraft:cobblestone_wall");
        for (let dy = 2; dy <= 6; dy++) put(dim, o.x + dx, o.y + dy, o.z + dz, "minecraft:barrier");
      }
    }
  }
  // Lanterns on taller posts round the rim, unevenly spaced
  for (const deg of [8, 41, 67, 104, 139, 171, 203, 232, 268, 297, 331]) {
    const rad = (deg * Math.PI) / 180;
    const x = o.x + Math.round(R * Math.sin(rad));
    const z = o.z - Math.round(R * Math.cos(rad));
    put(dim, x, o.y + 1, z, "minecraft:stone_bricks");
    put(dim, x, o.y + 2, z, "minecraft:cobblestone_wall");
    put(dim, x, o.y + 3, z, "minecraft:lantern");
  }
  // The Waystone on a low step
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(dim, o.x + dx, o.y + 1, o.z + dz, "minecraft:stone_brick_slab");
  put(dim, o.x, o.y + 1, o.z, "minecraft:chiseled_stone_bricks");
  put(dim, o.x, o.y + 2, o.z, WAYSTONE);
  writeSign(dim, o.x, o.y + 1, o.z + 2, 0, "The Waystone\nClick it to hear\nhow things stand");
  writeSign(dim, o.x, o.y + 1, o.z - 2, 8, "Each stone on the\nrim is a place to\nstart. One each.");
  // Pedestals
  for (const p of pedestalLayout()) {
    put(dim, o.x + p.dx, o.y + 1, o.z + p.dz, REGION_BLOCK[p.plan.region] ?? "minecraft:stone_bricks")
      ?? put(dim, o.x + p.dx, o.y + 1, o.z + p.dz, "minecraft:stone_bricks");
  }
  refreshHall();
}

// Pedestal tops and signs follow who holds what
function refreshHall() {
  const o = store.data.hall;
  if (!o) return;
  const dim = overworld();
  for (const p of pedestalLayout()) {
    const status = statusOf(p.plan);
    const top = dim.getBlock({ x: o.x + p.dx, y: o.y + 2, z: o.z + p.dz });
    if (!top) return; // nobody is up here, so the hall isn't loaded
    const want = status.state === "free" ? FREE_LIGHT : TAKEN_BLOCK;
    if (top.typeId !== want) top.setType(want);
    writeSign(dim, o.x + p.sx, o.y + 1, o.z + p.sz, p.rot, signText(p.plan, status));
  }
}

const inHall = (loc, slack = 2) => {
  const o = store.data.hall;
  return !!o && Math.hypot(loc.x - o.x, loc.z - o.z) <= WELCOME.hallRadius + slack && loc.y >= o.y - 3 && loc.y <= o.y + 12;
};

// ---------- The story so far (kept to what a newcomer could know) ----------

const PAGES = [
  ["How things stand",
    "This is Aldmere. It is an old land and a quiet one, by day.\n\n"
    + "Every third night something comes against the settlements. Walls are tested, banners fall, and by morning the people rebuild. "
    + "Nobody alive can tell you why it is every third night. The priests have one answer, the old soldiers another, and the Order of the Ashen Gate says it is handled.\n\n"
    + "Lately there is more. Wells that taste of salt far from any sea. Nights that run long. People who went missing and came back not quite themselves.\n\n"
    + "There is a journal in your pack. You did not put it there. It was written by someone who saw all this begin and understood none of it. Read it or don't."],
  ["Where you start",
    "You arrive as nobody: no title, no oath, no land. What you become depends on where you settle and what you do there.\n\n"
    + "Aldmere has five regions, and each gives its people something the others lack:\n"
    + "§fAldmere Vale§r, green river country, horses and the old roads.\n"
    + "§fFrostmarch§r, the Greyspine mountains, forges and hard winters.\n"
    + "§fSaltreach§r, the western coast, ships and trade.\n"
    + "§fEmberwaste§r, the desert in the east, and what nests there.\n"
    + "§fBlackfen§r, the southern marsh, brews and things better left alone.\n\n"
    + "Kingsrest, the crossroads town, sits in the middle, below the ruins of the old capital. Rails and roads run from it to everywhere. Nobody flies here."],
  ["Choosing a home",
    "The stones round the rim of this hall are the twelve places a settlement can stand. Each sits toward where its land really lies.\n\n"
    + "Click a stone to read about the place. If it is free you can take it: you will be set down beside its Plot Stone and it is yours to found. "
    + "§fOnly one person can take each place§r, and the choice stands, so look at all of them first.\n\n"
    + "A dark stone is already taken. Click it to see who holds it and how far they have come. If you would rather share a settlement with a friend, "
    + "start without a home and ask them for a Writ of Alliance."],
];

function storyPage(player, i = 0) {
  const [title, body] = PAGES[i];
  const form = new ActionFormData().title(title).body(body);
  if (i < PAGES.length - 1) form.button("Next");
  form.button("Close");
  form.show(player).then((r) => {
    if (!r.canceled && i < PAGES.length - 1 && r.selection === 0) storyPage(player, i + 1);
  }).catch(() => {});
}

function waystoneMenu(player) {
  const mine = store.data.picks[player.id];
  const form = new ActionFormData().title("The Waystone")
    .body(mine ? `You have chosen ${mine.plot ?? "to start in Kingsrest"}.` : "Read these, then choose a stone on the rim.");
  PAGES.forEach(([title]) => form.button(title));
  const canLeave = !mine && !keepOf(player.id);
  if (canLeave) form.button("Start in Kingsrest\nwithout a home of your own");
  form.button("Close");
  form.show(player).then((r) => {
    if (r.canceled) return;
    if (r.selection < PAGES.length) return storyPage(player, r.selection);
    if (canLeave && r.selection === PAGES.length) startHomeless(player);
  }).catch(() => {});
}

// ---------- Choosing ----------

function pedestalMenu(player, p) {
  const { plan } = p;
  const status = statusOf(plan);
  const far = Math.round(Math.hypot(plan.x - KINGSREST.x, plan.z - KINGSREST.z));
  const lines = [
    `§f${plan.name}§r, ${plan.region}`,
    `The land: ${plan.site}.`,
    `How people build there: ${REGION_STYLE[plan.region] ?? "as they please"}.`,
    `${far} blocks ${compass(KINGSREST, plan)} of Kingsrest.`,
    "",
  ];
  const mine = store.data.picks[player.id];
  let canTake = false;
  if (status.state === "free") {
    if (mine) lines.push(`§2Free.§r You have already chosen ${mine.plot ?? "to start in Kingsrest"}.`);
    else if (keepOf(player.id)) lines.push("§2Free.§r You already hold a settlement.");
    else {
      lines.push("§2Free.§r Nobody has taken it.");
      canTake = true;
    }
  } else if (status.state === "missing") {
    lines.push("§7This place is not on the map yet.");
  } else if (status.state === "lord") {
    lines.push(`§4Held by ${status.name}§r, one of the lords of the land. They will have to be dealt with on the ground.`);
  } else {
    lines.push(status.state === "kept" ? "§4Chosen by:" : "§4Held by:", describe(status.id, status.name));
  }
  const form = new ActionFormData().title(plan.name).body(lines.join("\n"));
  if (canTake) form.button(`Start in ${plan.name}`);
  if (isBuilder(player) && status.plot) form.button("Builder: go there");
  form.button("Close");
  form.show(player).then((r) => {
    if (r.canceled) return;
    if (canTake && r.selection === 0) return confirmPick(player, p);
    if (isBuilder(player) && status.plot && r.selection === (canTake ? 1 : 0)) arriveAt(player, status.plot);
  }).catch(() => {});
}

function confirmPick(player, p) {
  new MessageFormData().title(`Start in ${p.plan.name}?`)
    .body(`${p.plan.name} will be kept for you and nobody else can take it. You can't come back up here and choose again.`)
    .button1("Look at the others first").button2(`Yes, ${p.plan.name}`)
    .show(player).then((r) => {
      if (!r.canceled && r.selection === 1) pick(player, p.plan);
    }).catch(() => {});
}

// Which side a plot's gate is on (see PLOT_PLAN); a stone that matches no planned plot takes the nearest one's side
function gateOf(plot) {
  const plan = PLOT_PLAN.find((n) => n.name === plot.name)
    ?? [...PLOT_PLAN].sort((a, b) => Math.hypot(a.x - plot.x, a.z - plot.z) - Math.hypot(b.x - plot.x, b.z - plot.z))[0];
  return plan?.gate ?? 180;
}

/** Where a player is set down at a plot: three blocks from the Plot Stone toward the gate, clear of the hall's steps. */
export function arrivalSpot(plot) {
  const rad = (gateOf(plot) * Math.PI) / 180;
  return { x: plot.x + Math.round(3 * Math.sin(rad)) + 0.5, y: plot.y + 1, z: plot.z - Math.round(3 * Math.cos(rad)) + 0.5 };
}

function arriveAt(player, plot, at) {
  const spot = at ?? arrivalSpot(plot);
  try {
    player.addEffect("resistance", 200, { amplifier: 4, showParticles: false }); // in case the ground isn't quite where it should be
    player.teleport(spot, { dimension: overworld() });
    player.setSpawnPoint({ dimension: overworld(), x: Math.floor(spot.x), y: spot.y, z: Math.floor(spot.z) });
  } catch (e) {
    console.warn(`[Hollow Crown] welcome: could not send ${player.name} to ${plot.name}: ${e}`);
  }
}

function pick(player, plan) {
  // Somebody else may have clicked first while this player was reading
  const status = statusOf(plan);
  if (status.state !== "free") return player.sendMessage(`§c${plan.name} was taken a moment ago. Choose another stone.`);
  if (store.data.picks[player.id] || keepOf(player.id)) return;
  store.data.picks[player.id] = { plot: status.plot.name, name: player.name, day: Math.floor(world.getAbsoluteTime() / 24000) };
  store.save();
  player.removeTag(ARRIVING);
  emit("plotChosen", { player, plot: status.plot });
  if (WELCOME.bannerOnArrival) {
    const inv = player.getComponent("minecraft:inventory")?.container;
    let has = false;
    for (let i = 0; inv && i < inv.size; i++) if (inv.getItem(i)?.typeId === KEEP_BANNER) has = true;
    try {
      if (inv && !has) inv.addItem(new ItemStack(KEEP_BANNER, 1));
    } catch {
      // the banner can't be handed out as an item in this build: they can craft one
    }
  }
  arriveAt(player, status.plot);
  for (const other of world.getPlayers()) {
    if (other.id !== player.id) other.sendMessage(`§6${player.name} has chosen ${status.plot.name} in ${status.plot.region}.`);
  }
  player.sendMessage(`§6${status.plot.name} is yours to found. Raise your Keep Banner on the Plot Stone beside you. Kingsrest lies ${compass(status.plot, KINGSREST)}.`);
  player.onScreenDisplay.setTitle(`§6${status.plot.name}`, { subtitle: status.plot.region, fadeInDuration: 10, stayDuration: 70, fadeOutDuration: 20 });
  refreshHall();
}

function startHomeless(player) {
  new MessageFormData().title("Start in Kingsrest?")
    .body("You will arrive in Kingsrest with no place of your own. You can still claim any free Plot Stone you reach on foot, or join a friend with a Writ of Alliance. You can't come back up here.")
    .button1("Stay and look").button2("Yes, Kingsrest")
    .show(player).then((r) => {
      if (r.canceled || r.selection !== 1) return;
      store.data.picks[player.id] = { plot: null, name: player.name, day: Math.floor(world.getAbsoluteTime() / 24000) };
      store.save();
      player.removeTag(ARRIVING);
      const k = store.data.kingsrest ?? WELCOME.kingsrest;
      arriveAt(player, { name: "Kingsrest" }, { x: k.x + 0.5, y: k.y, z: k.z + 0.5 });
      player.sendMessage("§6Kingsrest. Rails and roads run from here to every region. Click any Plot Stone to see which plots are free.");
    }).catch(() => {});
}

// A plot someone chose is theirs to found: nobody else can raise a banner on it
addFoundingCheck((player, block) => {
  if (block.dimension.id !== OVERWORLD) return undefined;
  const below = block.below();
  if (below?.typeId !== PLOT_STONE) return undefined;
  const plot = allPlots().find((p) => p.x === below.location.x && p.y === below.location.y && p.z === below.location.z);
  const kept = plot && pickOf(plot);
  if (kept && kept.id !== player.id) return `§c${plot.name} was chosen by ${kept.name} in the welcome hall. It is theirs to found.`;
  return undefined;
});

// Once the keep stands, or if the player later founds somewhere else, the ordinary plot rules take over
on("keepFounded", ({ player }) => {
  const mine = store.data.picks[player.id];
  if (!mine?.plot) return;
  const held = plotOf(player.id);
  if (held && held.name !== mine.plot) {
    mine.plot = held.name;
    store.save();
  }
  refreshHall();
});

// ---------- Arriving ----------

function toHall(player) {
  const o = store.data.hall;
  const spot = { x: o.x + 0.5, y: o.y + 1, z: o.z + 4.5 };
  try {
    player.teleport(spot, { dimension: overworld(), facingLocation: { x: o.x + 0.5, y: o.y + 2, z: o.z + 0.5 } });
    player.setSpawnPoint({ dimension: overworld(), x: Math.floor(spot.x), y: spot.y, z: Math.floor(spot.z) });
  } catch {
    // try again on the next check
  }
}

const mustChoose = (player) =>
  hallBuilt() && mapMode() && !isBuilder(player) && !store.data.picks[player.id] && !keepOf(player.id);

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  system.runTimeout(() => {
    if (!isReady() || !player.isValid || !mapMode()) return;
    if (mustChoose(player)) {
      player.addTag(ARRIVING);
      toHall(player);
      if (initialSpawn) {
        player.onScreenDisplay.setTitle("§6Aldmere", { subtitle: "Click the Waystone", fadeInDuration: 10, stayDuration: 80, fadeOutDuration: 20 });
        player.sendMessage("§6Welcome to Aldmere. Click the Waystone in the middle to hear how things stand, then choose one of the stones on the rim as your start.");
      }
    } else if (initialSpawn && !hallBuilt() && !plotOf(player.id)) {
      const free = allPlots().filter((p) => statusOf(p).state === "free").length;
      player.sendMessage(`§6Welcome to Aldmere. ${free} of ${allPlots().length} plots are free. Ride the rails from Kingsrest, find a Plot Stone, and raise your Keep Banner on it.`);
    }
  }, 60);
});

// Nobody leaves the hall without choosing, and nobody falls out of the sky
onTick("plots_welcome_hold", 20, () => {
  if (!hallBuilt()) return;
  for (const player of world.getPlayers()) {
    if (!player.hasTag(ARRIVING)) continue;
    if (!mustChoose(player)) player.removeTag(ARRIVING);
    else if (player.dimension.id !== OVERWORLD || !inHall(player.location)) toHall(player);
  }
});
onTick("plots_welcome_signs", 100, () => {
  if (hallBuilt()) refreshHall();
});

// ---------- Clicks, and keeping the hall whole ----------

const lastClick = new Map();
world.afterEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player } = event;
  const o = store.data.hall;
  if (!o || event.isFirstEvent === false || block.dimension.id !== OVERWORLD || !inHall(block.location)) return;
  if (system.currentTick - (lastClick.get(player.id) ?? -100) < 6) return;
  const dx = block.location.x - o.x;
  const dz = block.location.z - o.z;
  const dy = block.location.y - o.y;
  let open;
  if (Math.abs(dx) <= 1 && Math.abs(dz) <= 2 && dy >= 1 && dy <= 2) open = () => waystoneMenu(player);
  else {
    const p = pedestalLayout().find((q) => (q.dx === dx && q.dz === dz && (dy === 1 || dy === 2)) || (q.sx === dx && q.sz === dz && dy === 1));
    if (p) open = () => pedestalMenu(player, p);
  }
  if (!open) return;
  lastClick.set(player.id, system.currentTick);
  open();
});

function guardHall(event, block, player) {
  if (player.getGameMode() === GameMode.Creative || block.dimension.id !== OVERWORLD || !inHall(block.location, 4)) return;
  event.cancel = true;
}
world.beforeEvents.playerBreakBlock.subscribe((event) => guardHall(event, event.block, event.player));
world.beforeEvents.playerPlaceBlock?.subscribe((event) => guardHall(event, event.block, event.player));

// ---------- Builder commands ----------

function whenThere(player, spot, then) {
  player.teleport({ x: spot.x + 0.5, y: spot.y + 1, z: spot.z + 0.5 }, { dimension: overworld() });
  // Give the chunks a moment to load round the player, standing them on something meanwhile
  system.runTimeout(() => {
    put(overworld(), spot.x, spot.y, spot.z, "minecraft:stone_bricks");
    system.runTimeout(() => {
      try {
        then();
      } catch (e) {
        player.sendMessage(`§c[Hollow Crown] welcome: ${e}`);
      }
    }, 40);
  }, 20);
}

function buildTestArea(player, o) {
  const dim = overworld();
  // Glass, so the land below stays in daylight
  dim.runCommand(`fill ${o.x - 48} ${o.y} ${o.z - 48} ${o.x + 48} ${o.y} ${o.z + 48} glass`);
  dim.runCommand(`fill ${o.x - 3} ${o.y} ${o.z - 3} ${o.x + 3} ${o.y} ${o.z + 3} smooth_stone`);
  player.teleport({ x: o.x + 0.5, y: o.y + 1, z: o.z + 0.5 }, { dimension: dim });
  store.data.test = o;
  store.save();
  system.runTimeout(() => {
    player.runCommand("scriptevent siege:showcase");
    player.sendMessage("§6Test area built. Everything in the packs is laid out round you. Come back any time with §f/scriptevent siege:welcome testarea");
  }, 10);
}

function statusLines() {
  return pedestalLayout().map((p) => {
    const s = statusOf(p.plan);
    return `§7${p.plan.name} (${p.plan.region}): §f${s.state}${s.name ? " " + s.name : ""}`;
  });
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:welcome") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  if (!isBuilder(player)) return player.sendMessage("§cThe welcome hall is set up by the map builder in Creative.");
  const [verb, ...rest] = event.message.trim().split(/\s+/);
  const here = { x: Math.floor(player.location.x), y: Math.floor(player.location.y) - 1, z: Math.floor(player.location.z) };
  try {
    if (verb === "build") {
      if (player.dimension.id !== OVERWORLD) return player.sendMessage("§cThe welcome hall belongs in the Overworld.");
      const o = rest[0] === "here" ? here : { ...WELCOME.hall };
      const finish = () => {
        buildHall(overworld(), o);
        store.data.hall = o;
        store.save();
        refreshHall();
        try {
          world.setDefaultSpawnLocation({ x: o.x, y: o.y + 1, z: o.z + 4 });
        } catch {
          // new players are brought here by script anyway
        }
        player.teleport({ x: o.x + 0.5, y: o.y + 1, z: o.z + 4.5 }, { dimension: overworld() });
        player.sendMessage(`§6Welcome hall built at ${o.x}, ${o.y}, ${o.z}. New players arrive here once the map has Plot Stones${mapMode() ? "" : " §e(none placed yet)"}§6.`);
      };
      if (rest[0] === "here") finish();
      else whenThere(player, o, finish);
    } else if (verb === "go") {
      if (!hallBuilt()) return player.sendMessage("§7No welcome hall yet: /scriptevent siege:welcome build");
      toHall(player);
    } else if (verb === "testarea") {
      const o = store.data.test ?? { ...WELCOME.testArea };
      if (store.data.test) return player.teleport({ x: o.x + 0.5, y: o.y + 1, z: o.z + 0.5 }, { dimension: overworld() });
      whenThere(player, o, () => buildTestArea(player, o));
    } else if (verb === "kingsrest") {
      store.data.kingsrest = { x: here.x, y: here.y + 1, z: here.z };
      store.save();
      player.sendMessage(`§6Players who start without a home now arrive at ${here.x}, ${here.y + 1}, ${here.z}.`);
    } else if (verb === "release") {
      const name = rest.join(" ").toLowerCase();
      const found = Object.entries(store.data.picks).find(([, pick]) => pick.name.toLowerCase() === name);
      if (!found) return player.sendMessage(`§7Nobody called "${rest.join(" ")}" has chosen a start.`);
      delete store.data.picks[found[0]];
      store.save();
      refreshHall();
      player.sendMessage(`§6${found[1].name}'s choice (${found[1].plot ?? "Kingsrest"}) is released. They choose again next time they arrive without a keep.`);
    } else if (verb === "status") {
      for (const line of statusLines()) player.sendMessage(line);
    } else {
      player.sendMessage("§7/scriptevent siege:welcome build | build here | go | testarea | kingsrest | release <name> | status");
    }
  } catch (e) {
    player.sendMessage(`§c[Hollow Crown] welcome: ${e}`);
    console.warn(`[Hollow Crown] welcome: ${e}${e?.stack ? "\n" + e.stack : ""}`);
  }
});

on("showcase", ({ dim, nextSpot, label }) => {
  const at = nextSpot();
  put(dim, at.x, at.y, at.z, REGION_BLOCK["Aldmere Vale"]);
  put(dim, at.x, at.y + 1, at.z, FREE_LIGHT);
  label(at, "Welcome hall\n/scriptevent\nsiege:welcome\nbuild here");
});
