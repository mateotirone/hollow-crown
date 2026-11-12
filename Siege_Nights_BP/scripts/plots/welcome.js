// The welcome hall: where a new player arrives, reads how things stand, and picks where they start.
//
// It is the real world map in miniature (1 block for every 25 x 25), built in the sky over Gull Bay (miniature.js
// builds it; tools/miniature.py makes its data from the world map). Newcomers arrive on a stone quay out in the
// miniature's sea, where the Waystone stands (click it for the story so far, where you start and how choosing works).
// Each plot has a glowing Map Stone on its real spot on the miniature: green is free, yellow is run by a lord, dark
// is taken. Click one to read about the plot. A free one can be chosen: you are set down beside its real Plot Stone,
// it is held for you, and nobody else can take it. A taken one shows who holds it and how far they have come.
//
// Builder commands (Creative):
//   /scriptevent siege:welcome build        build the hall at its place in the sky (takes you there first)
//   /scriptevent siege:welcome build here   build it around where you stand (for flat test worlds)
//   /scriptevent siege:welcome go           go to the hall
//   /scriptevent siege:welcome testarea     build the test area in the sky and lay the whole showcase out on it
//   /scriptevent siege:welcome kingsrest    make where you stand the "start without a home" arrival spot
//   /scriptevent siege:welcome release Name give up Name's pick so the plot is free again
//   /scriptevent siege:welcome status       list every plot's Map Stone and who has it
// A world that still has the old round hall gets it swapped for the miniature by itself.
//
// Other features: on("plotChosen", ({ player, plot }) => ...) fires the moment a player picks a plot, before
// they arrive, so a first building can be raised for them. pickOf(plot) is in plots/api.js.
// on("waystoneRead", ({ player }) => ...) fires each time a player closes the Waystone's "How things stand" page.
// on("startedHomeless", ({ player }) => ...) fires when a player chooses to start in Kingsrest with no plot.
// raiseHall(o, then) builds the hall (spread over ticks) and setKingsrestArrival(spot) moves the homeless arrival
// spot; the opening feature (scripts/opening/) calls both when a fresh Hollow Crown map first loads.

import { world, system, ItemStack, GameMode } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { isReady, keepOf, tierOf, on, emit, addFoundingCheck, addJoinStep } from "../siege/api.js";
import { onTick } from "../core/loop.js";
import { moduleStore } from "../core/store.js";
import { PLOT_PLAN, REGION_STYLE, REGION_BLOCK, WELCOME, WARDS, PLOT_STONE, KEEP_BANNER, OVERWORLD } from "./config.js";
import { allPlots, holderOf, npcOf, plotOf, isBuilder, compass, mapMode, releaseNpc } from "./claims.js";
import { MINI, MINI_VERSION, RIM_TOP, MAP_MARKER, HALL_WAYSTONE, MARKER_STATE, miniSpot, miniatureBlocks, waystoneSpot, arrivalOffset, fallbackOf } from "./miniature.js";
import { addMenuLabel } from "../core/labels.js";

const store = moduleStore("siege:plots_welcome", () => ({ hall: null, test: null, kingsrest: null, picks: {} }));
const ARRIVING = "siege_plots_arriving"; // on a player who is in the hall and has not chosen yet
const FREE_LIGHT = "minecraft:sea_lantern"; // the showcase marker
const BUILD_AREA = "hc_miniature"; // ticking area kept while the miniature is being built

export const hallBuilt = () => !!store.data.hall;
const overworld = () => world.getDimension(OVERWORLD);
const KINGSREST = WARDS[0];

// ---------- Where the Map Stones stand ----------
// Each plot's stone stands on its real spot, scaled down, on a pedestal of its region's stone.
// dy is the stone's height above the hall floor; the pedestal is the block under it.

export function pedestalLayout() {
  return PLOT_PLAN.map((plan) => {
    const spot = miniSpot(plan);
    return { name: plan.name, plan, dx: spot.dx, dz: spot.dz, dy: spot.h + 2 };
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

// "free" | "taken" (a keep stands on it) | "kept" (chosen, no keep yet) | "lord" (run by an NPC lord; a newcomer can
// still choose it and inherits what the lord built) | "missing" (no stone yet)
export function statusOf(plan) {
  const plot = plotFor(plan);
  if (!plot) return { state: "missing" };
  const holder = holderOf(plot);
  if (holder) return { state: "taken", plot, id: holder, name: keepOf(holder)?.name ?? "someone" };
  const pick = pickOf(plot);
  if (pick) return { state: "kept", plot, id: pick.id, name: pick.name };
  const npc = npcOf(plot);
  if (npc) {
    // Whoever runs the lords can say how far this one has built: on("plotLordQuery", (q) => { q.tier = "Town"; })
    const q = { plot, npc };
    emit("plotLordQuery", q);
    return { state: "lord", plot, name: npc.name, tier: typeof q.tier === "string" ? q.tier : undefined };
  }
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

// A block for the miniature, trying an older id if this game version doesn't know the new one
function putMini(dim, x, y, z, typeId, states) {
  return put(dim, x, y, z, typeId, states) ?? (fallbackOf(typeId) ? put(dim, x, y, z, fallbackOf(typeId)) : undefined);
}

const R_ALL = MINI.half + 1; // the miniature and its rim, each way from the middle
const loadedAt = (dim, x, z) => {
  try {
    return !!dim.getBlock({ x, y: 0, z });
  } catch {
    return false;
  }
};
const allLoaded = (dim, o) => [[-1, -1], [-1, 1], [1, -1], [1, 1], [0, 0]].every(([sx, sz]) => loadedAt(dim, o.x + sx * R_ALL, o.z + sz * R_ALL));

function command(dim, text) {
  try {
    dim.runCommand(text);
  } catch {
    // an area that is already there or already gone
  }
}

// The old round hall (before the miniature): taken away when the miniature replaces it
function* clearOldHall(dim, old) {
  for (let dx = -17; dx <= 17; dx++) {
    yield;
    for (let dz = -17; dz <= 17; dz++) {
      if (Math.hypot(dx, dz) > 16.6) continue;
      for (let dy = -1; dy <= 6; dy++) {
        const b = dim.getBlock({ x: old.x + dx, y: old.y + dy, z: old.z + dz });
        if (b && b.typeId !== "minecraft:air") b.setType("minecraft:air");
      }
    }
  }
}

let raising = false;
const alsoWaiting = []; // then() callbacks from calls that came while the miniature was already going up
/**
 * Build the hall (the miniature map) at o, spread over ticks. It keeps the whole miniature loaded with one ticking
 * area while it works, and becomes the arrival point once it stands, Map Stones, Waystone and arrival spot included;
 * then() runs only after that. A world with the old round hall (old) has it cleared afterwards.
 */
export function raiseHall(o, then, old) {
  if (raising) {
    if (then) alsoWaiting.push(then);
    return;
  }
  raising = true;
  const dim = overworld();
  command(dim, `tickingarea remove ${BUILD_AREA}`);
  command(dim, `tickingarea add ${o.x - R_ALL} ${o.y} ${o.z - R_ALL} ${o.x + R_ALL} ${o.y} ${o.z + R_ALL} ${BUILD_AREA} true`);
  let tries = 0;
  const wait = system.runInterval(() => {
    if (!allLoaded(dim, o) && ++tries < 90) return;
    system.clearRun(wait);
    const markers = pedestalLayout().map((p) => ({ dx: p.dx, dz: p.dz, pedestal: REGION_BLOCK[p.plan.region] ?? "minecraft:stone_bricks" }));
    system.runJob((function* () {
      // An old hall in the way of the new one (a test world built "here") goes first; one floating above it goes last
      const inTheWay = old && old.y - 1 <= o.y + RIM_TOP && old.y + 6 >= o.y - 1;
      try {
        if (inTheWay) yield* clearOldHall(dim, old);
        const clear = (x, y, z) => {
          const b = dim.getBlock({ x, y, z });
          if (b && b.typeId !== "minecraft:air") b.setType("minecraft:air");
        };
        yield* miniatureBlocks((x, y, z, id, states) => putMini(dim, x, y, z, id, states), o, markers, clear);
      } catch (e) {
        console.warn(`[Hollow Crown] welcome: building the hall stopped: ${e}`);
        raising = false;
        command(dim, `tickingarea remove ${BUILD_AREA}`);
        return;
      }
      store.data.hall = { x: o.x, y: o.y, z: o.z, mini: MINI_VERSION };
      store.save();
      const w = waystoneSpot();
      writeSign(dim, o.x + w.dx, o.y + w.dy - 1, o.z + w.dz + 1, 0, "The Waystone\nClick it to hear\nhow things stand");
      writeSign(dim, o.x + w.dx, o.y + w.dy - 1, o.z + w.dz - 1, 8, "The glowing stones\non the map are the\nplaces to start.\nOne each.");
      refreshHall();
      try {
        world.setDefaultSpawnLocation(arrivalPoint(o));
      } catch {
        // new players are brought here by script anyway
      }
      for (const done of [then, ...alsoWaiting.splice(0)]) {
        try {
          done?.();
        } catch (e) {
          console.warn(`[Hollow Crown] welcome: after the hall: ${e}`);
        }
      }
      // The old round hall goes last, once everyone waiting on it has been brought down to the quay
      if (old && !inTheWay) {
        try {
          yield* clearOldHall(dim, old);
        } catch (e) {
          console.warn(`[Hollow Crown] welcome: clearing the old hall stopped: ${e}`);
        }
      }
      command(dim, `tickingarea remove ${BUILD_AREA}`);
      raising = false;
    })());
  }, 10);
}

// Where a newcomer stands in the hall: on the quay beside the Waystone
function arrivalPoint(o) {
  const a = arrivalOffset();
  return { x: o.x + a.dx, y: o.y + a.dy, z: o.z + a.dz };
}

/** Where "start in Kingsrest without a home" sets a player down. */
export function setKingsrestArrival(spot) {
  store.data.kingsrest = { x: Math.floor(spot.x), y: Math.floor(spot.y), z: Math.floor(spot.z) };
  store.save();
}

// The Map Stones follow who holds what: green free, yellow run by a lord, dark taken
export const markerState = (state) => (state === "free" ? 0 : state === "lord" ? 1 : 2);
function refreshHall() {
  const o = store.data.hall;
  if (!o?.mini) return;
  const dim = overworld();
  for (const p of pedestalLayout()) {
    let top;
    try {
      top = dim.getBlock({ x: o.x + p.dx, y: o.y + p.dy, z: o.z + p.dz });
    } catch {
      top = undefined;
    }
    if (!top) continue; // that corner of the miniature isn't loaded (nobody near it)
    const want = markerState(statusOf(p.plan).state);
    try {
      if (top.typeId !== MAP_MARKER) top.setType(MAP_MARKER);
      if (top.permutation.getState(MARKER_STATE) !== want) top.setPermutation(top.permutation.withState(MARKER_STATE, want));
    } catch {
      // the stone can't be set right now: next round
    }
  }
}

// Inside the hall: over the miniature or its rim, from just under the floor to above the barrier fence
const inHall = (loc, slack = 2) => {
  const o = store.data.hall;
  if (!o) return false;
  const reach = o.mini ? R_ALL : WELCOME.hallRadius;
  return Math.abs(loc.x - o.x) <= reach + slack && Math.abs(loc.z - o.z) <= reach + slack && loc.y >= o.y - 3 && loc.y <= o.y + RIM_TOP + 4;
};

// Each Map Stone's floating label carries its plot's name; the Waystone's says what it does
const hallOffset = (block) => {
  const o = store.data.hall;
  return o?.mini && block.dimension.id === OVERWORLD
    ? { dx: block.location.x - o.x, dy: block.location.y - o.y, dz: block.location.z - o.z }
    : undefined;
};
for (const p of pedestalLayout()) {
  addMenuLabel({
    block: MAP_MARKER, name: p.plan.name, hint: `${p.plan.region}: click to read`,
    where: (block) => {
      const at = hallOffset(block);
      return !!at && at.dx === p.dx && at.dz === p.dz;
    },
  });
}
addMenuLabel({ block: HALL_WAYSTONE, name: "Waystone", hint: "Click: how things stand" });

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
    "This hall is all of Aldmere in miniature. The twelve glowing stones on it are the places a settlement can stand, each on the spot where its land really lies.\n\n"
    + "Click a stone to read about the place. If it is free you can take it: you will be set down beside its Plot Stone and it is yours to found. "
    + "§fOnly one person can take each place§r, and the choice stands, so look at all of them first.\n\n"
    + "A green stone is free, a yellow one is kept warm by a lord who will hand it over, and a dark stone is already taken. Click it to see who holds it and how far they have come. If you would rather share a settlement with a friend, "
    + "start without a home and ask them for a Writ of Alliance."],
];

function storyPage(player, i = 0) {
  const [title, body] = PAGES[i];
  const form = new ActionFormData().title(title).body(body);
  if (i < PAGES.length - 1) form.button("Next");
  form.button("Close");
  form.show(player).then((r) => {
    // The journal is handed over once they have heard how things stand (the game being busy doesn't count as reading)
    if (i === 0 && r.cancelationReason !== "UserBusy") emit("waystoneRead", { player });
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
  if (status.state === "free" || status.state === "lord") {
    // A lord of the land only keeps a place warm: a newcomer who chooses it is handed it as it stands
    const lord = status.state === "lord";
    const what = lord ? `§6Run by ${status.name}${status.tier ? ` (${status.tier})` : ""}.§r` : "§2Free.§r";
    if (mine) lines.push(`${what} You have already chosen ${mine.plot ?? "to start in Kingsrest"}.`);
    else if (keepOf(player.id)) lines.push(`${what} You already hold a settlement.`);
    else {
      lines.push(lord ? `${what} Choose it and they hand it over to you as it stands.` : `${what} Nobody has taken it.`);
      canTake = true;
    }
  } else if (status.state === "missing") {
    lines.push("§7This place is not on the map yet.");
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
  if (status.state !== "free" && status.state !== "lord") return player.sendMessage(`§c${plan.name} was taken a moment ago. Choose another stone.`);
  if (store.data.picks[player.id] || keepOf(player.id)) return;
  store.data.picks[player.id] = { plot: status.plot.name, name: player.name, day: Math.floor(world.getAbsoluteTime() / 24000) };
  store.save();
  player.removeTag(ARRIVING);
  emit("plotChosen", { player, plot: status.plot, lord: status.state === "lord" ? npcOf(status.plot) : undefined });
  if (npcOf(status.plot)) releaseNpc(status.plot.name); // the lord steps down, if whoever runs the lords hasn't done it already
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
  // Chat order on arrival: the plot's past (lore, at once), then what has been laid out (settlement), then this
  // one clear next step, last, so it is the line left on screen.
  const plotName = status.plot.name;
  const toward = compass(status.plot, KINGSREST);
  system.runTimeout(() => {
    if (player.isValid) player.sendMessage(`§6Next: raise your Keep Banner on the Plot Stone beside you to found ${plotName}. Kingsrest lies ${toward}.`);
  }, 160);
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
      emit("startedHomeless", { player });
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
  // On the quay, facing the Waystone with the map beyond it (the old round hall: south of its Waystone)
  const at = o.mini ? arrivalPoint(o) : { x: o.x, y: o.y + 1, z: o.z + 4 };
  const w = o.mini ? waystoneSpot() : { dx: 0, dz: 0, dy: 2 };
  const spot = { x: at.x + 0.5, y: at.y, z: at.z + 0.5 };
  try {
    player.teleport(spot, { dimension: overworld(), facingLocation: { x: o.x + w.dx + 0.5, y: o.y + w.dy, z: o.z + w.dz + 0.5 } });
    player.setSpawnPoint({ dimension: overworld(), x: Math.floor(spot.x), y: spot.y, z: Math.floor(spot.z) });
  } catch {
    // try again on the next check
  }
}

const mustChoose = (player) =>
  hallBuilt() && mapMode() && !isBuilder(player) && !store.data.picks[player.id] && !keepOf(player.id);

// First join, step 20 of the join sequence (after the look picker, before the journal): up to the hall.
addJoinStep(20, "welcome hall", async (player, { wait }) => {
  if (!isReady() || !player.isValid || !mapMode()) return;
  if (mustChoose(player)) {
    player.addTag(ARRIVING);
    toHall(player);
    await wait(20); // let the hall load round them before the words appear
    if (!player.isValid) return;
    player.onScreenDisplay.setTitle("§6Aldmere", { subtitle: "Click the Waystone", fadeInDuration: 10, stayDuration: 80, fadeOutDuration: 20 });
    player.sendMessage("§6Welcome to Aldmere. Click the Waystone in the middle to hear how things stand, then choose one of the stones on the rim as your start.");
  } else if (!hallBuilt() && !plotOf(player.id)) {
    const free = allPlots().filter((p) => ["free", "lord"].includes(statusOf(p).state)).length;
    player.sendMessage(`§6Welcome to Aldmere. ${free} of ${allPlots().length} plots are free. Ride the rails from Kingsrest, find a Plot Stone, and raise your Keep Banner on it.`);
  }
}, { when: "first" });

// Nobody leaves the hall without choosing, and nobody falls out of the sky
const seenAt = new Map(); // player id -> tick the hold check first saw them
onTick("plots_welcome_hold", 20, () => {
  if (!hallBuilt()) return;
  for (const player of world.getPlayers()) {
    if (!player.hasTag(ARRIVING)) {
      // Someone who was here before the hall existed and still has no home is brought up too, quietly, once
      // they have been on for a minute (so this never cuts in front of the join sequence).
      if (!seenAt.has(player.id)) seenAt.set(player.id, system.currentTick);
      if (system.currentTick - seenAt.get(player.id) >= 1200 && mustChoose(player)) player.addTag(ARRIVING);
      continue;
    }
    if (!mustChoose(player)) player.removeTag(ARRIVING);
    else if (player.dimension.id !== OVERWORLD || !inHall(player.location)) toHall(player);
  }
});
onTick("plots_welcome_signs", 100, () => {
  if (!hallBuilt()) return;
  if ((store.data.hall.mini ?? 0) < MINI_VERSION) return swapOldHall();
  refreshHall();
});

// A world that built the old round hall (or the first, square miniature) gets the cloud miniature in its place:
// same spot on the map, lower in the sky
// (the miniature's mountains and rim must stay under the build limit). Newcomers still waiting there are brought
// across once it stands; their choices so far are kept.
function swapOldHall() {
  if (raising) return;
  const old = store.data.hall;
  // An older miniature (the square one) is rebuilt as the cloud in the same spot, its corners cleared
  const round = !old.mini;
  const o = round ? { x: old.x, y: Math.min(old.y, WELCOME.hall.y), z: old.z } : { x: old.x, y: old.y, z: old.z };
  console.warn(`[Hollow Crown] welcome: replacing the ${round ? "old round hall" : "square miniature"} with the cloud miniature`);
  raiseHall(o, () => {
    for (const player of world.getPlayers()) if (player.hasTag(ARRIVING)) toHall(player);
  }, round ? old : undefined);
}

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
  const w = o.mini ? waystoneSpot() : { dx: 0, dz: 0, dy: 2 };
  if (dx === w.dx && Math.abs(dz - w.dz) <= 1 && dy >= w.dy - 1 && dy <= w.dy) open = () => waystoneMenu(player);
  else if (o.mini) {
    // the Map Stone or the pedestal under it
    const p = pedestalLayout().find((q) => q.dx === dx && q.dz === dz && (dy === q.dy || dy === q.dy - 1));
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
      const finish = () => raiseHall(o, () => {
        if (!player.isValid) return;
        player.teleport({ x: o.x + 0.5, y: o.y + 1, z: o.z + 4.5 }, { dimension: overworld() });
        player.sendMessage(`§6Welcome hall built at ${o.x}, ${o.y}, ${o.z}. New players arrive here once the map has Plot Stones${mapMode() ? "" : " §e(none placed yet)"}§6.`);
      });
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
