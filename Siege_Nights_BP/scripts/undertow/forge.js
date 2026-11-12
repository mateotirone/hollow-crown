// The Cold Forge: the only place a Choirsteel Upgrade template can be found (Mateo, 2026-11-11:
// "like Netherite, where you need to get upgrade templates... an area in the Hollow where you have to
// go to get the upgrade template. And then you clone it with netherite").
//
// The forge stands high on the eastern terraces past the Seams (site "cold_forge" in roads.js, built
// by structures.js). Its Coffer holds ONE template for the whole world. Take it and the forge wakes:
// its guards come out of the walls. After that the forge stays empty for as long as any template is
// still around (Mateo, 2026-11-12: one for the world, "so it forces the player who has the template
// to protect it", and a reason to lay siege to them). Copies are made at a crafting table (7 netherite
// scrap and Veinstone, studio/bestiary/choirsteel.py).
//
// Only if every template seems lost does the forge make a new one, so a template burnt in lava or
// used up at the smithing table can't end Choirsteel for the whole Realm. Scripts can't look inside
// every chest in the world, so "seems lost" means no template has been seen for LOST_AFTER of world
// time. A template is seen when someone carries one, when someone opens a chest, barrel or other
// container holding one, when one lies on the ground near a player, or when another feature calls
// emit("templateSeen"). A template destroyed on the ground (lava, fire, despawning) cuts the wait to
// LOST_DESTROYED, unless another template turns up first. So a holder who keeps it in a vault only
// has to open that vault now and then.
//
// Saved: hc:cold_forge { stocked, lastSeen }   (absolute world ticks; older saves had takenAt)
// Events out: emit("forgeTemplateTaken", { x, y, z, nearest }), emit("templateHolders", { ids, names })
// Players carrying a template carry the tag siege_template_holder (a reason to be sieged).
// Test: /scriptevent hc:forge_restock   fills the Coffer now (creative/op)

import { world, system, ItemStack } from "@minecraft/server";
import { onTick } from "../core/loop.js";
import { addTests, assert, assertEqual } from "../core/tests.js";
import { on, emit } from "../siege/api.js";
import { sfx } from "../core/sfx.js";
import { UNDERTOW_ID } from "./layout.js";
import { load, save, say } from "./data.js";
import { pieces } from "./builder.js";
import { coldForgeCoffer } from "./structures.js";

export const TEMPLATE = "siege:choirsteel_upgrade_template";
const INGOT = "siege:choirsteel_ingot";
const K_FORGE = "hc:cold_forge";
export const FORGE = {
  lostAfter: 30 * 24000, // no template seen anywhere for 30 in-game days (world time only runs while someone plays)
  lostDestroyed: 3 * 24000, // ...or 3 days after one was destroyed on the ground
  wakeReach: 64, // only tick while someone is this close (the Coffer must be loaded)
  guards: ["siege:veinsworn", "siege:veinsworn", "siege:stone_vigil"],
};
const TOLD_TAG = "siege_cold_forge_told";

// Pure: what the forge does this check. inChest = templates in the Coffer right now.
//   "stock"  put a template in (the very first visit, or every template seems lost)
//   "taken"  someone has just lifted it: wake the guards
export const lastSeenOf = (state) => state.lastSeen ?? state.takenAt;
export function forgeStep(state, inChest, now, lostAfter = FORGE.lostAfter) {
  if (state.stocked && inChest === 0) return { state: { stocked: false, lastSeen: now }, did: "taken" };
  if (!state.stocked && inChest > 0) return { state: { stocked: true, lastSeen: now }, did: null }; // someone put one back
  const seen = lastSeenOf(state);
  if (!state.stocked && (seen === undefined || now - seen >= lostAfter)) return { state: { stocked: true, lastSeen: now }, did: "stock" };
  return { state, did: null };
}
// Pure: the saved state after a template is seen (seen) or destroyed (destroyed) at `now`.
export function noteTemplate(state, now, kind = "seen") {
  if (state.stocked) return state;
  if (kind === "seen") return { ...state, lastSeen: Math.max(lastSeenOf(state) ?? now, now) };
  // destroyed: the forge refills LOST_DESTROYED from now unless another template is seen first
  return { ...state, lastSeen: Math.min(lastSeenOf(state) ?? now, now - FORGE.lostAfter + FORGE.lostDestroyed) };
}

const forgeState = () => load(K_FORGE, { stocked: false });
let savedSeenAt = -Infinity;
function sawTemplate(kind = "seen") {
  try {
    const now = world.getAbsoluteTime();
    if (kind === "seen" && now - savedSeenAt < 1200) return; // write at most once a minute
    const before = forgeState(), after = noteTemplate(before, now, kind);
    if (after !== before) save(K_FORGE, after);
    if (kind === "seen") savedSeenAt = now;
  } catch { /* world not ready */ }
}
const countTemplates = (box) => {
  let n = 0;
  for (let i = 0; i < box.size; i++) { const it = box.getItem(i); if (it?.typeId === TEMPLATE) n += it.amount; }
  return n;
};

function stock(box) {
  const t = new ItemStack(TEMPLATE, 1);
  try { t.setLore(["§7Still warm, though the forge is cold."]); } catch { /* plain template */ }
  box.setItem(13, t);
}

function wake(d, at, players) {
  sfx(d, "block.bell.hit", at, { pitch: 0.5, volume: 3 });
  sfx(d, "random.anvil_land", at, { pitch: 0.6, volume: 2 });
  for (const p of players) say(p, "§5The forge's anvils ring by themselves. Something steps out of the walls.");
  FORGE.guards.forEach((type, i) => {
    const a = (i / FORGE.guards.length) * Math.PI * 2;
    try { d.spawnEntity(type, { x: at.x + Math.cos(a) * 4 + 0.5, y: at.y, z: at.z - 6 + Math.sin(a) * 3 + 0.5 }); } catch { /* not loaded */ }
  });
}

function forgeTick() {
  if (!(pieces().sites ?? []).includes("cold_forge")) return;
  const d = world.getDimension(UNDERTOW_ID), at = coldForgeCoffer();
  const near = d.getPlayers({ location: at, maxDistance: FORGE.wakeReach });
  if (!near.length) return;
  const box = d.getBlock(at)?.getComponent("inventory")?.container;
  if (!box) return; // not loaded yet, or the chest was broken
  const before = forgeState(), { state, did } = forgeStep(before, countTemplates(box), world.getAbsoluteTime());
  if (did === "stock") {
    stock(box);
    sfx(d, "block.amethyst_block.chime", at, { pitch: 0.7, volume: 2 });
    for (const p of near) say(p, "§dUp at the Cold Forge, something rings once, like a struck bar cooling.");
  } else if (did === "taken") {
    const nearest = near.reduce((a, b) => (dist(a.location, at) <= dist(b.location, at) ? a : b));
    wake(d, at, near);
    emit("forgeTemplateTaken", { x: at.x, y: at.y, z: at.z, nearest: nearest.name });
  }
  if (state !== before) save(K_FORGE, state);
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// The first time someone carries Choirsteel, they learn where it can be made into more than ingots.
function hintTick() {
  for (const p of world.getPlayers({ excludeTags: [TOLD_TAG] })) {
    const inv = p.getComponent("inventory")?.container;
    if (!inv) continue;
    for (let i = 0; i < inv.size; i++) {
      if (inv.getItem(i)?.typeId !== INGOT) continue;
      p.addTag(TOLD_TAG);
      say(p, "§dThe ingot carries a smith's stamp: a hammer under a crown. §7Miners say the forge that made the Choir's armour still stands, cold, high on the terraces east of the Seams.");
      break;
    }
  }
}

// Whoever carries a template is marked, so others have a reason to come for them (Mateo, 2026-11-12:
// "this is a reason another nation or player can lay a siege on a player"). Tag siege_template_holder,
// and emit("templateHolders", { ids, names }) whenever the list changes, for the siege features to use.
export const HOLDER_TAG = "siege_template_holder";
let lastHolders = "";
export const carriesTemplate = (items) => items.some((it) => it?.typeId === TEMPLATE);
function holderTick() {
  const holders = [];
  for (const p of world.getPlayers()) {
    const inv = p.getComponent("inventory")?.container;
    if (!inv) continue;
    const items = [];
    for (let i = 0; i < inv.size; i++) items.push(inv.getItem(i));
    const has = carriesTemplate(items);
    if (has && !p.hasTag(HOLDER_TAG)) { p.addTag(HOLDER_TAG); say(p, "§5The template is heavy in your pack. Anyone who wants Choirsteel now has a reason to come for you."); }
    if (!has && p.hasTag(HOLDER_TAG)) p.removeTag(HOLDER_TAG);
    if (has) holders.push(p);
    try { // one lying on the ground nearby counts as seen
      for (const e of p.dimension.getEntities({ type: "minecraft:item", location: p.location, maxDistance: 32 })) {
        if (e.getComponent("item")?.itemStack?.typeId === TEMPLATE) { sawTemplate(); break; }
      }
    } catch { /* unloaded */ }
  }
  if (holders.length) sawTemplate();
  const key = holders.map((p) => p.id).sort().join();
  if (key !== lastHolders) { lastHolders = key; emit("templateHolders", { ids: holders.map((p) => p.id), names: holders.map((p) => p.name) }); }
}

// Opening a chest, barrel or any other container that holds a template keeps it "seen".
world.afterEvents.playerInteractWithBlock.subscribe((event) => {
  try {
    const box = event.block.getComponent("inventory")?.container;
    if (box && countTemplates(box) > 0) sawTemplate();
  } catch { /* not a container */ }
});
// A template destroyed on the ground (lava, fire, cactus, despawning). Picking one up also removes the
// item entity, so a player standing right by it means it was picked up, not lost.
world.beforeEvents.entityRemove.subscribe((event) => {
  try {
    const e = event.removedEntity;
    if (e.typeId !== "minecraft:item" || e.getComponent("item")?.itemStack?.typeId !== TEMPLATE) return;
    if (e.dimension.getPlayers({ location: e.location, maxDistance: 3 }).length) return;
    system.run(() => sawTemplate("destroyed"));
  } catch { /* gone already */ }
});
on("templateSeen", () => sawTemplate()); // e.g. a vault feature that checks its own chests

onTick("undertow:forge", 100, forgeTick);
onTick("undertow:forge_holders", 100, holderTick);
onTick("undertow:forge_hint", 200, hintTick);

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "hc:forge_restock") return;
  const p = event.sourceEntity;
  save(K_FORGE, { stocked: false }); // the next check (within 5 s, with someone near) fills the Coffer
  if (p?.typeId === "minecraft:player") say(p, `§dThe Cold Forge will fill its Coffer at ${JSON.stringify(coldForgeCoffer())} in the Hollow within a few seconds of someone being near.`);
});

// ---- showcase: the whole upgrade on two tables ---------------------------------------------
on("showcase", ({ player, dim, nextSpot, label }) => {
  const fill = (at, block, items) => {
    try {
      dim.getBlock(at)?.setType(block);
      const chestAt = { x: at.x, y: at.y + 1, z: at.z };
      dim.getBlock(chestAt)?.setType("minecraft:chest");
      const box = dim.getBlock(chestAt)?.getComponent("inventory")?.container;
      items.forEach(([id, n], i) => box?.setItem(i, new ItemStack(id, n)));
    } catch (e) {
      console.warn(`[Hollow Crown] Cold Forge showcase: ${e}`);
    }
  };
  const smith = nextSpot();
  fill(smith, "minecraft:smithing_table", [[TEMPLATE, 4], ["siege:tempered_choirsteel", 4], ["minecraft:netherite_chestplate", 1], ["minecraft:netherite_sword", 1], [INGOT, 16], ["siege:gloamquill", 4]]);
  label(smith, "Choirsteel upgrade\nTemplate + netherite\n+ Tempered Choirsteel");
  const copy = nextSpot();
  fill(copy, "minecraft:crafting_table", [[TEMPLATE, 1], ["minecraft:netherite_scrap", 7], ["siege:veinstone", 1]]);
  label(copy, "Copy the template\n7 netherite scrap\n+ Veinstone");
  say(player, "§dChoirsteel:§7 the smithing table and its chest show the upgrade; the crafting table copies a template. The real templates are only in the Cold Forge in the Hollow (§f/scriptevent hc:forge_restock§7).");
});

addTests("undertow", {
  "Cold Forge: one template for the world; it refills only once every template seems lost": () => {
    let r = forgeStep({ stocked: false }, 0, 1000);
    assertEqual(r.did, "stock", "the very first visit fills it");
    r = forgeStep(r.state, 1, 1100);
    assertEqual(r.did, null, "still there: nothing happens");
    r = forgeStep(r.state, 0, 2000);
    assertEqual(r.did, "taken");
    let st = r.state;
    st = noteTemplate(st, 2000 + 20 * 24000); // someone carried it 20 days later
    assertEqual(forgeStep(st, 0, 2000 + FORGE.lostAfter).did, null, "seen recently: stays empty");
    assertEqual(forgeStep(st, 0, 2000 + 20 * 24000 + FORGE.lostAfter).did, "stock", "unseen for 30 days: lost");
  },
  "Cold Forge: a destroyed template cuts the wait to three days, unless another turns up": () => {
    const now = 100 * 24000;
    let st = noteTemplate({ stocked: false, lastSeen: now }, now, "destroyed");
    assertEqual(forgeStep(st, 0, now + FORGE.lostDestroyed - 1).did, null);
    assertEqual(forgeStep(st, 0, now + FORGE.lostDestroyed).did, "stock");
    st = noteTemplate(st, now + 24000); // a copy is carried the next day
    assertEqual(forgeStep(st, 0, now + FORGE.lostDestroyed).did, null, "a copy still exists");
  },
  "Cold Forge: a template put back counts, and older saves still work": () => {
    const r = forgeStep({ stocked: false, takenAt: 0 }, 1, 10);
    assert(r.state.stocked && r.did === null);
    assertEqual(forgeStep({ stocked: false, takenAt: 0 }, 0, FORGE.lostAfter).did, "stock");
    assertEqual(noteTemplate({ stocked: true }, 5), { stocked: true }, "a full Coffer ignores sightings");
  },
  "Cold Forge: a template anywhere in the pack marks its carrier": () => {
    assert(carriesTemplate([undefined, { typeId: "minecraft:dirt" }, { typeId: TEMPLATE }]));
    assert(!carriesTemplate([undefined, { typeId: INGOT }]));
  },
  "Cold Forge: the Coffer is inside the forge's site": () => {
    const c = coldForgeCoffer();
    assert(Math.hypot(c.x - 592, c.z - 1080) < 14);
  },
});
