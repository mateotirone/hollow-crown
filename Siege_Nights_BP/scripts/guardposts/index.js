// Guard posts: station a guard at a fixed post on a building or on the wall (Mateo, 2026-11-12).
//
//   1. Click one of your guards (any click that isn't an armour upgrade) and pick "Station".
//   2. The camera lifts into a sky view straight over your settlement. Every post shows on the ground as a ring
//      with its number: red = empty, green = manned.
//   3. The menu lists the wall and every building, with how many of their posts are manned.
//   4. Pick a building: the camera drops over it and its posts are listed ("By the door, left"...).
//   5. Pick the wall: its posts all the way round are listed.
//   6. Pick a post: the guard goes there. A post someone already holds swaps them (the other guard takes this
//      one's old post, or goes off duty).
// The Barracks menu has a "Guard posts" button with the same view, to check posts or send a guard to an empty one.
//
// A stationed Archer holds its post exactly. A stationed Man-at-Arms stands at its post and, in a fight, chases at
// most STATION_LEASH blocks from it before going back (siege/guards.js). Off duty they do what they always did:
// Archers stay where they were put, Men-at-Arms wait at the Barracks.
//
// Other features add their own buildings' posts (a storeroom, the Ironworks...):
//   addFilter("guardPostSites", (sites, { owner }) => [...sites, { id, name, box: {x0, z0, x1, z1}, front: {x, z}, floor }])
//   or with fixed posts: { id, name, center: {x, z}, posts: [{ key, label, x, z, from, out? }] }   (key unique, from = a
//   height at or above the standing spot; the ground is found looking down from there)
//
// Test: /scriptevent siege:posts [view | list]

import { world, system, MolangVariableMap } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { isReady, onTick, moduleStore, on, emit, addFilter, keepOf, guardOwner, guardTag, GUARD_TYPES, GUARD_ARMOR, armorTier,
  upgradeGuard, barracksOf, nearestBarracks, setPost, countItem, settlementAt, canManage, homeOf, underAttack, addTests, assert, assertEqual } from "../siege/api.js";
import { applyFilter } from "../core/events.js";
import { townOf, layoutOf } from "../settle/founding.js";
import { slotsOf } from "../settle/towns.js";
import { seatInWorld } from "../settle/plotmarker.js";
import { BUILDING } from "../settle/buildings.js";
import { wallOf } from "../settle/walls.js";
import { WALLS, WALL_LEVELS, radiusAt, wallColumns, wallShape, standHeight, WATCH, WATCH_KINDS } from "../settle/walldata.js";
import { raisedBuildings } from "../settle/raised.js";
import { hallOf } from "../townhall/townhall.js";
import { drawHall, HALL_TIERS } from "../townhall/halls.js";
import { worldBox } from "../townhall/build.js";
import { STYLES } from "../townhall/styles.js";
import { sfx } from "../core/sfx.js";
import { standY } from "./ground.js";
import { walkTo, cancelWalk, isWalking, sweepMarkers, leadPoint, upAbove, WALK } from "./walk.js";
import { POSTS, wallPosts, buildingPosts, frontOf, numberPosts, skyCamera, yawOf, wallStand, compassOf } from "./posts.js";

const OVERWORLD = "minecraft:overworld";
const STATION = "siege:station"; // dynamic property on a stationed guard: its post key
const RAISED_NAMES = { guardhouse: "Barracks", armoury: "Armoury" };

// manned: { owner: { postKey: guardEntityId } }
const store = moduleStore("siege:guard_posts", () => ({ manned: {} }));
const mannedOf = (owner) => (store.data.manned[owner] ??= {});
const save = () => store.save();

const dim = () => world.getDimension(OVERWORLD);
const playerById = (id) => world.getPlayers().find((p) => p.id === id);
const entityById = (id) => { try { return world.getEntity(id); } catch { return undefined; } };
const kindOf = (guard) => (guard.typeId === "siege:archer" ? "Archer" : "Man-at-Arms");
const nameOf = (guard) => guard.nameTag || kindOf(guard);
const stationOf = (guard) => { try { return guard.getDynamicProperty(STATION); } catch { return undefined; } };

// ---------- where the posts are ----------

const hallBounds = new Map(); // "level|style" -> plan bounds (drawing a hall is slow, so once each)
function hallSite(owner) {
  const hall = hallOf(owner);
  if (!hall || !(hall.level > 0) || hall.lost) return undefined;
  const key = `${hall.level}|${hall.style}`;
  if (!hallBounds.has(key)) hallBounds.set(key, drawHall(hall.level, STYLES[hall.style] ?? STYLES.vale).bounds());
  const b = hallBounds.get(key);
  const forward = { x: hall.fx, z: hall.fz };
  const wb = worldBox({ bounds: () => b }, hall, forward);
  const box = { x0: wb.min.x, z0: wb.min.z, x1: wb.max.x, z1: wb.max.z };
  return { id: "hall", name: HALL_TIERS[hall.level]?.name ?? "Town hall", box, posts: buildingPosts("hall", box, frontOf(forward), hall.y) };
}

function townSites(owner) {
  const town = townOf(owner);
  if (!town) return [];
  const out = [];
  for (const slot of slotsOf(layoutOf(town))) {
    const state = town.slots?.[slot.id];
    if (!state?.building) continue;
    let seat;
    try { seat = seatInWorld(owner, slot, state.building); } catch { seat = undefined; }
    if (!seat) continue;
    const id = `slot:${slot.id}`;
    out.push({ id, name: BUILDING[state.building]?.name ?? "Building", box: seat.box, posts: buildingPosts(id, seat.box, frontOf(seat.forward), seat.origin.y) });
  }
  return out;
}

function raisedSites(owner) {
  const out = [], seen = new Set();
  for (const b of raisedBuildings()) {
    if (!b.box || ownerAt(b.at) !== owner) continue;
    const id = `raised:${b.at.x},${b.at.y},${b.at.z}`;
    seen.add(`${b.at.x},${b.at.y},${b.at.z}`);
    out.push({ id, name: RAISED_NAMES[b.name] ?? b.name, box: b.box, posts: buildingPosts(id, b.box, frontOf(b.forward), b.floor) });
  }
  // a Barracks block with no building recorded (placed before buildings were remembered): two posts beside it
  for (const t of barracksOf(owner)) {
    if (seen.has(`${t.x},${t.y},${t.z}`)) continue;
    const id = `barracks:${t.x},${t.y},${t.z}`;
    out.push({ id, name: "Barracks", box: { x0: t.x, z0: t.z, x1: t.x, z1: t.z }, posts: [
      { key: `${id}:w`, label: "West of the Barracks", x: t.x - 2, z: t.z, from: t.y + 3, out: { x: -1, z: 0 } },
      { key: `${id}:e`, label: "East of the Barracks", x: t.x + 2, z: t.z, from: t.y + 3, out: { x: 1, z: 0 } },
    ] });
  }
  return out;
}

const ownerAt = (loc) => { try { return settlementAt(loc); } catch { return undefined; } };

// Every site of a settlement, numbered: [{ id, name, wall?, box?, center, posts: [{ key, label, x, z, from, out, n }] }]
const siteCache = new Map(); // owner -> { tick, sites }
export function sitesFor(owner, fresh = false) {
  const hit = siteCache.get(owner);
  if (!fresh && hit && system.currentTick - hit.tick < 40) return hit.sites;
  const sites = [];
  const w = wallOf(owner);
  if (w?.level > 0 && w.ground) {
    const posts = wallPosts(w);
    if (posts.length) sites.push({ id: "wall", name: "The wall", wall: true, center: { x: w.x, z: w.z }, posts });
  }
  const tryAdd = (fn) => { try { const s = fn(); if (Array.isArray(s)) sites.push(...s); else if (s) sites.push(s); } catch (e) { console.warn(`[Hollow Crown] guard posts: ${e}`); } };
  tryAdd(() => hallSite(owner));
  tryAdd(() => townSites(owner));
  tryAdd(() => raisedSites(owner));
  let extra = [];
  try { extra = applyFilter("guardPostSites", [], { owner }) ?? []; } catch (e) { console.warn(`[Hollow Crown] guard posts: ${e}`); }
  for (const s of extra) {
    if (!s?.id) continue;
    const posts = s.posts ?? (s.box && s.front ? buildingPosts(s.id, s.box, s.front, s.floor ?? 64) : []);
    if (posts.length) sites.push({ ...s, posts });
  }
  for (const s of sites) s.center ??= s.box ? { x: (s.box.x0 + s.box.x1) / 2, z: (s.box.z0 + s.box.z1) / 2 } : { x: s.posts[0].x, z: s.posts[0].z };
  const numbered = numberPosts(sites.filter((s) => s.posts.length));
  siteCache.set(owner, { tick: system.currentTick, sites: numbered });
  return numbered;
}
const allPosts = (sites) => sites.flatMap((s) => s.posts.map((p) => ({ ...p, site: s })));
const postByKey = (owner, key) => allPosts(sitesFor(owner)).find((p) => p.key === key);

const standOf = (p) => { const y = standY(p.x, p.z, p.from); return y === undefined ? undefined : { x: p.x, y, z: p.z }; };

// Where the settlement is, for the camera: { x, y, z, radius }
function baseOf(owner) {
  const town = townOf(owner), w = wallOf(owner), keep = keepOf(owner);
  const c = town ?? w ?? keep;
  if (!c) return undefined;
  const radius = (w?.radius ?? 40) + WALLS.landBeyond;
  return { x: c.x, y: c.y, z: c.z, radius };
}

// ---------- stationing ----------

// Where a guard stands at a post: the middle of the block, feet height, facing out
// (a lookout up a ladder also carries climb, and foot = where the guard steps off the ladder at the bottom)
function postDest(post) {
  const stand = standOf(post);
  if (!stand) return undefined;
  const dest = { x: stand.x + 0.5, y: stand.y, z: stand.z + 0.5, yaw: yawOf(post.out) };
  if (post.watch) {
    dest.climb = true;
    const y = post.foot ? standY(post.foot.x, post.foot.z, post.foot.from) : undefined;
    if (y !== undefined) dest.foot = { x: post.foot.x + 0.5, y, z: post.foot.z + 0.5 };
  }
  return dest;
}

// Where a stationed guard waits while its watch is off: beside the nearest Barracks (its own spot of eight round it)
const REST = [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, 2], [2, -2], [-2, -2]];
function restDest(guard, owner, near) {
  const b = nearestBarracks(owner, dim(), near);
  if (!b) return undefined;
  let h = 0;
  for (const c of String(guard.id)) h = (h * 31 + c.charCodeAt(0)) | 0;
  for (let i = 0; i < REST.length; i++) {
    const [dx, dz] = REST[(Math.abs(h) + i) % REST.length];
    const y = standY(b.x + dx, b.z + dz, b.y + 3);
    if (y !== undefined) return { x: b.x + dx + 0.5, y, z: b.z + dz + 0.5, yaw: yawOf({ x: -dx, z: -dz }) };
  }
  return undefined;
}

// The watch (POSTS.watch): is this stationed guard meant to be at its post right now?
const isNight = () => { const t = world.getTimeOfDay(); return t >= POSTS.dusk && t < POSTS.dawn; };
const period = () => `${world.getDay()}:${isNight() ? 1 : 0}`;
export function onDuty(guard, owner) {
  if (underAttack(owner)) return true; // a siege or a Wanted player on your land: everyone to their post
  try { if (guard.getDynamicProperty("siege:hold") === period()) return true; } catch { /* fine */ } // just stationed: holds until the watch changes
  if (POSTS.watch === "always") return true;
  if (POSTS.watch === "shifts") {
    let h = 0;
    for (const c of String(guard.id)) h = (h * 31 + c.charCodeAt(0)) | 0;
    return (Math.abs(h) % 2 === 0) !== isNight();
  }
  return isNight(); // "dusk": on the wall from dusk till dawn
}

const near = (a, b) => a && b && Math.abs(a.x - b.x) < 1 && Math.abs(a.z - b.z) < 1 && Math.abs(a.y - b.y) < 1.5;
const postOf = (guard) => { try { return JSON.parse(guard.getDynamicProperty("siege:post") ?? "null"); } catch { return null; } };

// Send a stationed guard where its watch says (its post, or the Barracks), walking. Returns false if not loaded.
function sendOff(guard, owner, post, { salute = false } = {}) {
  const atPost = postDest(post);
  if (!atPost) return false;
  const dest = onDuty(guard, owner) ? atPost : restDest(guard, owner, atPost) ?? atPost;
  const current = postOf(guard);
  if (near(current, dest) && (isWalking(guard) || !guard.getDynamicProperty("siege:walking"))) return true;
  setPost(guard, { ...dest, stand: true });
  // off a lookout (the watch ended, or a new post): down the ladder first, then walk
  walkTo(guard, owner, dest, { salute: salute || dest === atPost, down: current?.foot ?? (current?.climb ? atPost.foot : undefined) });
  return true;
}

function placeOn(guard, owner, post) {
  if (!postDest(post)) return false;
  guard.setDynamicProperty(STATION, post.key);
  guard.setDynamicProperty("siege:hold", period());
  mannedOf(owner)[post.key] = guard.id;
  return sendOff(guard, owner, post, { salute: true });
}

export function unstation(guard, owner) {
  const key = stationOf(guard);
  const manned = mannedOf(owner);
  if (key && manned[key] === guard.id) delete manned[key];
  try { guard.setDynamicProperty(STATION, undefined); guard.setDynamicProperty("siege:hold", undefined); } catch { /* gone */ }
  cancelWalk(guard.id);
  const loc = guard.location;
  const home = guard.typeId === "siege:archer" ? undefined : nearestBarracks(owner, guard.dimension, loc);
  setPost(guard, home ? { x: home.x, y: home.y, z: home.z } : { x: loc.x, y: loc.y, z: loc.z });
  save();
}

// An unmanned post for a new soldier: the wall first (where Archers belong), then any building. undefined if none
// is free or loaded.
export function emptyPost(owner, { wallFirst = true } = {}) {
  const manned = mannedOf(owner);
  const free = allPosts(sitesFor(owner, true)).filter((p) => { const id = manned[p.key]; return !id || !entityById(id); });
  const order = wallFirst ? [...free.filter((p) => p.site?.wall), ...free.filter((p) => !p.site?.wall)] : free;
  return order.find((p) => standOf(p));
}

// Send a guard to a post. Returns a line for the player.
export function station(guard, owner, post) {
  if (!standOf(post)) return "§cThat post isn't loaded right now. Go a little closer and try again.";
  const manned = mannedOf(owner);
  const old = stationOf(guard);
  const otherId = manned[post.key];
  let swapped = "";
  if (otherId && otherId !== guard.id) {
    const other = entityById(otherId);
    delete manned[post.key];
    if (other) {
      const back = old && old !== post.key ? postByKey(owner, old) : undefined;
      if (old && manned[old] === guard.id) delete manned[old];
      if (back && placeOn(other, owner, back)) swapped = ` ${nameOf(other)} takes their old post.`;
      else { unstation(other, owner); swapped = ` ${nameOf(other)} goes off duty.`; }
    }
  }
  if (old && manned[old] === guard.id) delete manned[old];
  if (!placeOn(guard, owner, post)) return "§cThat post isn't loaded right now.";
  save();
  emit("guardStationed", { owner, guard, post: post.key });
  sfx(guard.dimension, "armor.equip_iron", guard.location, { volume: 0.7 });
  return `§6${nameOf(guard)} takes post ${post.n} (${post.site?.name ?? ""}, ${post.label.toLowerCase()}).§7${swapped}`;
}

on("guardRemoved", ({ id, owner }) => {
  if (!owner) return;
  const manned = mannedOf(owner);
  let changed = false;
  for (const [k, v] of Object.entries(manned)) if (v === id) { delete manned[k]; changed = true; }
  if (changed) save();
  cancelWalk(id);
});

// Every 5 seconds: posts whose building or wall is gone send their guard off duty; guards that are gone free their
// post; and a guard whose post moved (the wall moved out with the town) walks to where it is now.
function keepWatch() {
  if (!isReady()) return;
  for (const [owner, manned] of Object.entries(store.data.manned)) {
    if (!playerById(owner) || !Object.keys(manned).length) continue;
    const posts = new Map(allPosts(sitesFor(owner)).map((p) => [p.key, p]));
    let changed = false;
    for (const [key, id] of Object.entries(manned)) {
      const guard = entityById(id);
      const post = posts.get(key);
      if (!guard) {
        // gone for good only if the ground at its post is loaded (otherwise it's just far away)
        let loaded = false;
        try { loaded = !post || !!dim().getBlock({ x: post.x, y: post.from, z: post.z }); } catch { loaded = false; }
        if (loaded) { delete manned[key]; changed = true; }
        continue;
      }
      if (stationOf(guard) !== key) { delete manned[key]; changed = true; continue; }
      if (!post) { unstation(guard, owner); changed = true; continue; }
      if (guard.hasTag("siege_marching")) continue; // away at war (warwrit/army.js)
      sendOff(guard, owner, post); // the watch changed, the wall moved out, or a walk was cut short by a restart
    }
    if (changed) save();
  }
  // archers from before guards could walk need their bow put back in their hands once
  try {
    for (const a of dim().getEntities({ type: "siege:archer" })) {
      if (a.getDynamicProperty("siege:fightv") === 1 || a.getDynamicProperty("siege:walking")) continue;
      a.triggerEvent("siege:fight");
      a.setDynamicProperty("siege:fightv", 1);
    }
  } catch { /* fine */ }
}
onTick("guard_posts", 100, keepWatch);
on("siegeStart", () => system.runTimeout(keepWatch, 2)); // the moment a siege starts, everyone heads for their post
on("ready", () => system.runTimeout(sweepMarkers, 100));

// ---------- the sky view and its markers ----------

const viewing = new Map(); // player id -> { owner, focus?: site id, until }

function lookDown(player, owner, site) {
  const base = baseOf(owner);
  if (!base) return;
  const low = !!site && !site.wall;
  const center = low ? site.center : base;
  const cam = skyCamera({ x: center.x, z: center.z }, low ? (standY(Math.round(center.x), Math.round(center.z), base.y + 30) ?? base.y) : base.y, base.radius, low);
  try {
    player.camera.setCamera("minecraft:free", { location: cam.location, rotation: { x: 89.9, y: cam.rotation.y }, easeOptions: { easeTime: 1.2, easeType: "InOutSine" } });
  } catch { /* no camera: the markers still show on the ground */ }
}

function startView(player, owner) {
  viewing.set(player.id, { owner, until: system.currentTick + 20 * 180 });
  lookDown(player, owner);
  try {
    player.onScreenDisplay.setTitle("§6Guard posts", { fadeInDuration: 10, stayDuration: 40, fadeOutDuration: 15, subtitle: "§cred§7 = empty   §agreen§7 = manned" });
  } catch { /* fine */ }
}

export function endView(player) {
  if (!viewing.has(player.id)) return;
  viewing.delete(player.id);
  try { player.camera.clear(); } catch { /* left */ }
}

const RED = { red: 0.9, green: 0.15, blue: 0.12 }, GREEN = { red: 0.2, green: 0.9, blue: 0.25 }, GOLD = { red: 1, green: 0.8, blue: 0.2 };
function drawMarkers(player, view) {
  const manned = mannedOf(view.owner);
  const sites = sitesFor(view.owner);
  const focusSite = sites.find((s) => s.id === view.focus);
  const low = focusSite && !focusSite.wall;
  for (const site of sites) {
    const near = !low || site.id === view.focus;
    for (const post of site.posts) {
      const stand = standOf(post);
      if (!stand) continue;
      const size = low ? (near ? 1.0 : 0.6) : 2.2;
      const color = post.key === view.highlight ? GOLD : manned[post.key] ? GREEN : RED;
      const ring = new MolangVariableMap();
      ring.setColorRGB("variable.color", color);
      ring.setFloat("variable.size", size);
      try { player.spawnParticle("siege:post_ring", { x: stand.x + 0.5, y: stand.y + 0.15, z: stand.z + 0.5 }, ring); } catch { /* unloaded */ }
      if (!near) continue;
      const digits = String(post.n).split("");
      const dsize = size * 0.7, step = dsize * 0.62;
      digits.forEach((d, i) => {
        const m = new MolangVariableMap();
        m.setFloat("variable.digit", Number(d));
        m.setFloat("variable.size", dsize);
        // north is at the top of the sky view, so the digits run east (+x) left to right
        try { player.spawnParticle("siege:post_digit", { x: stand.x + 0.5 + (i - (digits.length - 1) / 2) * step, y: stand.y + 0.3, z: stand.z + 0.5 }, m); } catch { /* unloaded */ }
      });
    }
  }
}

onTick("guard_post_markers", POSTS.markerTicks, () => {
  if (!viewing.size) return;
  for (const [id, view] of viewing) {
    const player = playerById(id);
    if (!player) { viewing.delete(id); continue; }
    if (system.currentTick > view.until) { endView(player); continue; }
    try { drawMarkers(player, view); } catch (e) { console.warn(`[Hollow Crown] guard post markers: ${e}`); }
  }
});

world.afterEvents.playerLeave.subscribe(({ playerId }) => viewing.delete(playerId));

// ---------- menus ----------

const SITE_ICON = (site) => (site.wall ? "textures/ui/hc/post_wall" : site.id === "hall" ? "textures/blocks/stonebrick" : "textures/items/iron_sword");
const mannedCount = (owner, site) => site.posts.filter((p) => mannedOf(owner)[p.key]).length;
const guardLabel = (id) => { const g = entityById(id); return g ? nameOf(g) : "a guard (far away)"; };

// The guard's own menu: station, call off, upgrade
function guardMenu(guard, player) {
  const owner = guardOwner(guard);
  const tier = armorTier(guard);
  const next = GUARD_ARMOR[tier + 1];
  const key = stationOf(guard);
  const post = key ? postByKey(owner, key) : undefined;
  const health = guard.getComponent("minecraft:health");
  const lines = [
    `§f${kindOf(guard)}§7 · ${GUARD_ARMOR[tier].name} (${tier}/4)${health ? ` · ${Math.ceil(health.currentValue)}/${health.effectiveMax} health` : ""}`,
    post ? `§7Stationed at §6post ${post.n}§7: ${post.site.name}, ${post.label.toLowerCase()}.`
      : guard.typeId === "siege:archer" ? "§7Off duty: holding the spot you put them on." : "§7Off duty: waiting at the Barracks.",
    next ? `§7Next armour: §6${next.name}§7 for ${next.label} (you have ${countItem(player, next.item)}).` : "§6Wearing the best armour there is.",
  ];
  const form = new ActionFormData().title(nameOf(guard)).body(lines.join("\n"));
  const actions = [];
  form.button("Station\n§8pick a post from the sky", "textures/ui/hc/post_manned"); actions.push(() => openPosts(player, owner, guard));
  if (key) { form.button("Call off post\n§8back to how they were", "textures/ui/hc/post_empty"); actions.push(() => { unstation(guard, owner); player.sendMessage(`§7${nameOf(guard)} is off duty.`); }); }
  if (next) { form.button(`Upgrade to ${next.name}\n§8${next.label}`, "textures/items/iron_chestplate"); actions.push(() => upgradeGuard(guard, player, { typeId: next.item })); }
  form.button("Close");
  form.show(player).then((r) => { if (!r.canceled && actions[r.selection]) actions[r.selection](); }).catch(() => {});
}

addFilter("guardMenu", (handled, { guard, player }) => {
  if (handled || !isReady()) return handled;
  system.run(() => guardMenu(guard, player));
  emit("guardOrders", { player, guard });
  return true;
});

addFilter("barracksButtons", (buttons, { player, block }) => [...buttons, {
  label: "Guard posts\n§8see and fill your posts", icon: "textures/ui/hc/post_manned",
  run: () => openPosts(player, ownerAt(block.location) ?? player.id),
}]);

// The sky view. guard = the guard being stationed, or none to look at the posts and fill them.
export function openPosts(player, owner, guard) {
  if (!canManage(owner, player.id)) return player.onScreenDisplay.setActionBar("§cOnly the settlement's owner and their allies can station its guards.");
  const sites = sitesFor(owner, true);
  if (!sites.length) return player.sendMessage("§7There are no posts yet. Raise a wall or put up a building, and posts come with it.");
  startView(player, owner);
  system.runTimeout(() => mainForm(player, owner, guard), 30);
}

function mainForm(player, owner, guard) {
  if (!viewing.has(player.id)) return;
  const view = viewing.get(player.id);
  view.focus = undefined;
  view.highlight = guard ? stationOf(guard) : undefined;
  lookDown(player, owner);
  const sites = sitesFor(owner);
  const form = new ActionFormData().title(guard ? `Station ${nameOf(guard)}` : "Guard posts").body([
    "Your settlement from above. §cRed§r rings are empty posts, §agreen§r ones are manned. The numbers on the ground match this list.",
    guard ? "\nPick the wall or a building, then the post to send them to." : "\nPick the wall or a building to see its posts.",
  ].join(""));
  for (const s of sites) {
    const first = s.posts[0].n, last = s.posts[s.posts.length - 1].n;
    form.button(`${s.name}  §8${mannedCount(owner, s)}/${s.posts.length} manned\n§8posts ${first === last ? first : `${first}-${last}`}`, SITE_ICON(s));
  }
  form.button("Look around\n§8hide this for 6 seconds");
  form.button("Done");
  form.show(player).then((r) => {
    if (r.canceled || r.selection === sites.length + 1) return endView(player);
    if (r.selection === sites.length) return system.runTimeout(() => mainForm(player, owner, guard), 120);
    siteForm(player, owner, guard, sites[r.selection]);
  }).catch(() => endView(player));
}

function siteForm(player, owner, guard, site) {
  const view = viewing.get(player.id);
  if (!view) return;
  view.focus = site.id;
  lookDown(player, owner, site);
  const manned = mannedOf(owner);
  const here = guard ? stationOf(guard) : undefined;
  const form = new ActionFormData().title(site.name).body(site.wall
    ? `Posts round the wall, starting beside the gate. ${guard ? "Pick one for " + nameOf(guard) + "." : ""}`
    : `Posts round the ${site.name.toLowerCase()}. ${guard ? "Pick one for " + nameOf(guard) + "." : ""}`);
  for (const p of site.posts) {
    const who = manned[p.key];
    const state = p.key === here ? "§6here now" : who ? `§2manned: ${guardLabel(who)}` : "§4empty";
    form.button(`${p.n}. ${p.label}\n${state}`, who ? "textures/ui/hc/post_manned" : "textures/ui/hc/post_empty");
  }
  form.button("Back");
  form.show(player).then((r) => {
    if (r.canceled) return endView(player);
    if (r.selection >= site.posts.length) return mainForm(player, owner, guard);
    const post = { ...site.posts[r.selection], site };
    if (guard) return chooseForGuard(player, owner, guard, post, site);
    return choosePost(player, owner, post, site);
  }).catch(() => endView(player));
}

function chooseForGuard(player, owner, guard, post, site) {
  const holder = mannedOf(owner)[post.key];
  const go = () => { endView(player); player.sendMessage(station(guard, owner, post)); };
  if (!holder || holder === guard.id) return go();
  new MessageFormData().title(`Post ${post.n}`)
    .body(`${guardLabel(holder)} already holds this post. Send ${nameOf(guard)} here anyway? ${stationOf(guard) ? `${guardLabel(holder)} takes ${nameOf(guard)}'s old post.` : `${guardLabel(holder)} goes off duty.`}`)
    .button1("Swap them").button2("Back")
    .show(player).then((r) => (r.selection === 0 ? go() : siteForm(player, owner, guard, site))).catch(() => endView(player));
}

// Looking without a guard in hand: call someone off a manned post, or send someone to an empty one
function choosePost(player, owner, post, site) {
  const holder = mannedOf(owner)[post.key];
  if (holder) {
    return new MessageFormData().title(`Post ${post.n}`).body(`${guardLabel(holder)} holds ${post.label.toLowerCase()} at the ${site.name.toLowerCase()}.`)
      .button1("Call them off").button2("Back")
      .show(player).then((r) => {
        if (r.selection !== 0) return siteForm(player, owner, undefined, site);
        const g = entityById(holder);
        if (g) unstation(g, owner); else { delete mannedOf(owner)[post.key]; save(); }
        siteCache.delete(owner);
        siteForm(player, owner, undefined, site);
      }).catch(() => endView(player));
  }
  const free = Object.keys(GUARD_TYPES).flatMap((type) => dim().getEntities({ type, tags: [guardTag(owner)] })).filter((g) => !stationOf(g));
  if (!free.length) {
    player.sendMessage("§7Every guard nearby is already on a post. Recruit more at the Barracks, or call someone off.");
    return siteForm(player, owner, undefined, site);
  }
  const form = new ActionFormData().title(`Send to post ${post.n}`).body(`${site.name}, ${post.label.toLowerCase()}. Who goes?`);
  for (const g of free) form.button(`${nameOf(g)}\n§8${kindOf(g)} · ${GUARD_ARMOR[armorTier(g)].name}`, g.typeId === "siege:archer" ? "textures/items/siege_archer" : "textures/items/siege_man_at_arms");
  form.button("Back");
  form.show(player).then((r) => {
    if (r.canceled) return endView(player);
    if (r.selection >= free.length) return siteForm(player, owner, undefined, site);
    player.sendMessage(station(free[r.selection], owner, post));
    siteForm(player, owner, undefined, site);
  }).catch(() => endView(player));
}

// ---------- test command ----------

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:posts") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isReady()) return;
  const cmd = event.message.trim() || "view";
  if (cmd === "view") return openPosts(player, homeOf(player.id) ?? player.id);
  if (cmd === "list") {
    const manned = mannedOf(player.id);
    const lines = sitesFor(player.id, true).map((s) => `§6${s.name}§7: ${s.posts.map((p) => `${p.n}${manned[p.key] ? "§a*§7" : ""}`).join(" ")}`);
    return player.sendMessage(lines.length ? lines.join("\n") : "§7No posts: no wall or buildings here.");
  }
  player.sendMessage("§7/scriptevent siege:posts [view | list]");
});

// ---------- self-tests ----------

addTests("guard posts", {
  "the wall has posts all round, two at the gate, every key different": () => {
    const shape = Array.from({ length: 72 }, (_, i) => Math.sin(i / 5));
    for (const level of [1, 3, 5, 7, 10]) {
      const w = { x: 1000, z: 2000, radius: 46, level, gate: 1.2, ground: new Array(WALLS.stations).fill(70), shape };
      const posts = wallPosts(w);
      const watch = posts.filter((p) => p.key.startsWith("watch:"));
      assertEqual(watch.length, level <= 6 ? 4 : 0, `level ${level} watchtower posts`);
      assert(posts.length >= POSTS.wallPosts + 2 && posts.length <= POSTS.wallPosts + 2 + watch.length, `level ${level}: ${posts.length} posts`);
      if (watch.length) assertEqual(posts.slice(0, 4).map((p) => p.key).join(), "watch:0,watch:1,watch:2,watch:3", "lookouts are manned first");
      for (const p of watch) { // the ladder's foot (the front step) is close enough to climb up from and to be put down at
        assert(p.foot && Math.hypot(p.x - p.foot.x, p.z - p.foot.z) <= WALK.climb, `level ${level} ${p.key}: foot ${JSON.stringify(p.foot)}`);
        assert(upAbove({ x: p.x, y: p.from, z: p.z }, { x: p.foot.x, y: p.foot.from, z: p.foot.z }), `level ${level} ${p.key}: up on the lookout`);
        assert(!upAbove({ x: p.x, y: p.foot.from, z: p.z }, { x: p.foot.x, y: p.foot.from, z: p.foot.z }), "on the ground is not up");
      }
      assertEqual(new Set(posts.map((p) => p.key)).size, posts.length);
      for (const p of posts) {
        const r = Math.hypot(p.x - w.x, p.z - w.z);
        assert(r > 30 && r < 52, `level ${level} post ${p.key} at ${r.toFixed(1)}`);
        assert(p.from > 70 && p.from <= 70 + (p.watch ? WATCH_KINDS[level === 1 ? "stand" : "tower"].guardUp : WALL_LEVELS[level].h + 3), `level ${level} looks down from ${p.from}`);
      }
      const gate = posts.filter((p) => p.key.startsWith("gate:"));
      assertEqual(gate.length, 2);
      for (const p of gate) assert(Math.hypot(p.x - w.x, p.z - w.z) < radiusAt(w, w.radius, p.a) - wallStand(WALL_LEVELS[level]).d, "gate posts stand inside the wall");
    }
  },
  "a wall post keeps its key and place round the ring when the wall moves out": () => {
    const w = { x: 0, z: 0, radius: 36, level: 4, gate: 0, ground: new Array(WALLS.stations).fill(64) };
    const a = wallPosts(w), b = new Map(wallPosts({ ...w, radius: 56 }).map((p) => [p.key, p]));
    let same = 0;
    for (const p of a) {
      const q = b.get(p.key);
      if (!q) continue; // a wall post beside a watchtower can be left out on one ring and not the other
      same++;
      if (p.key.startsWith("gate:")) continue; // the gate pair stay a few blocks from the gate, so their angle changes
      assert(Math.abs(p.a - q.a) < 1e-9, "same angle");
      assertEqual(compassOf(p.a), compassOf(q.a));
    }
    assert(same >= POSTS.wallPosts, `${same} posts on both rings`);
  },
  "buildings get door posts, big ones corners and sides, all outside the building": () => {
    const small = buildingPosts("s", { x0: 0, z0: 0, x1: 8, z1: 8 }, { x: 0, z: 1 }, 64);
    assertEqual(small.length, 2);
    for (const p of small) assert(p.z > 8, "door posts stand out the front (south)");
    const big = buildingPosts("b", { x0: 0, z0: 0, x1: 20, z1: 18 }, { x: 1, z: 0 }, 64);
    assertEqual(big.length, 6);
    for (const p of big) assert(p.x < 0 || p.x > 20 || p.z < 0 || p.z > 18, `${p.key} outside the box`);
    assertEqual(new Set(big.map((p) => p.key)).size, 6);
    const door = big.find((p) => p.key === "b:dl");
    assertEqual(door.out.x, 1);
    assertEqual(Math.round(yawOf({ x: 0, z: 1 })), 0);
    assertEqual(Math.round(yawOf({ x: 1, z: 0 })), -90);
  },
  "the walk marker leads the guard toward its post and stops on it": () => {
    const p = leadPoint({ x: 0, z: 0 }, { x: 100, z: 0 });
    assertEqual(Math.round(p.x), WALK.lead);
    assert(!p.last, "still on the way");
    const q = leadPoint({ x: 95, z: 0 }, { x: 100.5, z: 0.5 });
    assert(q.last && q.x === 100.5 && q.z === 0.5, "on the post at the end");
  },
  "every wall a guard can stand on has its flights of steps, each top step beside the walk": () => {
    for (const radius of [36, 46, 56, 66]) for (let level = 1; level <= 10; level++) {
      const L = WALL_LEVELS[level];
      const cols = wallColumns({ center: { x: 0, z: 0, shape: wallShape(`t${radius}`) }, radius, level, gateAngle: 1, smooth: new Array(WALLS.stations).fill(64) });
      const steps = cols.filter((c) => c.role === "stair");
      assertEqual(steps.length, WALLS.stairs * standHeight(L), `r${radius} level ${level}`);
      const at = new Map(cols.map((c) => [`${c.x},${c.z}`, c]));
      let off = 0;
      for (const t of steps.filter((c) => c.last)) {
        const ok = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => ["walk", "wall", "landing"].includes(at.get(`${t.x + dx},${t.z + dz}`)?.role));
        if (!ok) off++;
      }
      assert(off <= 1, `r${radius} level ${level}: ${off} flights end away from the walk`);
    }
  },
  "posts are numbered 1..n across the wall and the buildings": () => {
    const sites = numberPosts([{ posts: [{ key: "a" }, { key: "b" }] }, { posts: [{ key: "c" }] }]);
    assertEqual(sites.flatMap((s) => s.posts.map((p) => p.n)).join(","), "1,2,3");
  },
  "the sky view fits the whole settlement and drops low over one building": () => {
    const high = skyCamera({ x: 0, z: 0 }, 64, 70);
    assert(high.location.y - 64 >= 70 * 1.4 - 1 || high.location.y - 64 === POSTS.skyHeight, "high enough to see the wall");
    assertEqual(skyCamera({ x: 0, z: 0 }, 64, 70, true).location.y, 64 + POSTS.buildingHeight);
    assertEqual(high.rotation.x, 90);
  },
});
