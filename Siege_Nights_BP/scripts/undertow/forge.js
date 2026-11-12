// The Cold Forge: the only place a Choirsteel Upgrade template can be found (Mateo, 2026-11-11:
// "like Netherite, where you need to get upgrade templates... an area in the Hollow where you have to
// go to get the upgrade template. And then you clone it with netherite").
//
// The forge stands high on the eastern terraces past the Seams (site "cold_forge" in roads.js, built
// by structures.js). Its Coffer holds one template at a time. Take it and the forge wakes: its
// guards come out of the walls. A new template is sung into the Coffer three in-game days later,
// so a world of ten players keeps coming back, and copying at a crafting table (7 netherite scrap
// and Veinstone, studio/bestiary/choirsteel.py) is the quicker way to share.
//
// Saved: hc:cold_forge { stocked, takenAt }   (absolute world ticks)
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
  reforgeTicks: 3 * 24000, // three in-game days between templates
  wakeReach: 64, // only tick while someone is this close (the Coffer must be loaded)
  guards: ["siege:veinsworn", "siege:veinsworn", "siege:stone_vigil"],
};
const TOLD_TAG = "siege_cold_forge_told";

// Pure: what the forge does this check. inChest = templates in the Coffer right now.
//   "stock"  put a template in (first visit, or the wait is over)
//   "taken"  someone has just lifted it: wake the guards and start the wait
export function forgeStep(state, inChest, now, wait = FORGE.reforgeTicks) {
  if (state.stocked && inChest === 0) return { state: { stocked: false, takenAt: now }, did: "taken" };
  if (!state.stocked && inChest > 0) return { state: { stocked: true, takenAt: state.takenAt }, did: null }; // someone put one back
  if (!state.stocked && (state.takenAt === undefined || now - state.takenAt >= wait)) return { state: { stocked: true, takenAt: state.takenAt }, did: "stock" };
  return { state, did: null };
}

const forgeState = () => load(K_FORGE, { stocked: false });
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
  }
  const key = holders.map((p) => p.id).sort().join();
  if (key !== lastHolders) { lastHolders = key; emit("templateHolders", { ids: holders.map((p) => p.id), names: holders.map((p) => p.name) }); }
}

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
  "Cold Forge: first visit stocks, taking wakes it, it restocks after three days": () => {
    let r = forgeStep({ stocked: false }, 0, 1000);
    assertEqual(r.did, "stock");
    r = forgeStep(r.state, 1, 1100);
    assertEqual(r.did, null, "still there: nothing happens");
    r = forgeStep(r.state, 0, 2000);
    assertEqual(r.did, "taken");
    assertEqual(forgeStep(r.state, 0, 2000 + FORGE.reforgeTicks - 1).did, null, "too soon");
    assertEqual(forgeStep(r.state, 0, 2000 + FORGE.reforgeTicks).did, "stock");
  },
  "Cold Forge: a template put back counts, and is not doubled": () => {
    const r = forgeStep({ stocked: false, takenAt: 0 }, 1, 10);
    assert(r.state.stocked && r.did === null);
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
