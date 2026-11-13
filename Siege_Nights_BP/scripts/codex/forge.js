// The wonders' forges, the Kin-Writs and the Sun Gate caravan market.
//
// The wonders feature (wonders/inside.js) puts a button on each standing wonder's keeper menu when we hand it a
// label (filters "codexForgeLabel" and "codexCaravanLabel"), and the button emits "codexForge" { player, wonderId }
// or "codexCaravan" { player }. A wonder held by a Rival Lord still forges, at double the Regal price.

import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { on, addFilter, onTick, countItem, takeItems, keepOf, settlementAt } from "../siege/api.js";
import { sfx } from "../core/sfx.js";
import { charge } from "../economy/coins.js";
import { WONDER_BY_ID } from "../wonders/data.js";
import { wonderHolder } from "../wonders/index.js";
import { ITEM, FAVOUR, FAVOUR_COUNT, forgeRecipes, pricesFor, caravanStock, mayWear } from "./rules.js";
import { store, homeRegion, grantWrit, revokeWrit, give, isCreative, players } from "./state.js";
import { consumeOne } from "./powers.js";

const FORGE_LABEL = {
  rimeforge_hall: "Use the Rime Anvil", high_watch: "Use the Armoury", great_lighthouse: "Use the Lamp Room",
  sun_gate: "Use the Caravan Smithy", lantern_spire: "Use the Lamplighter's Kiln", great_horse_fair: "Fit Fair Champion's Barding",
};
const WRIT_PRICE = 200; // Regals, when a Rival Lord holds the wonder and you play alone
addFilter("codexForgeLabel", (label, { wonderId }) => label ?? FORGE_LABEL[wonderId] ?? null);
addFilter("codexCaravanLabel", (label) => label ?? "See the caravan market");

const nameOf = (id) => ITEM[id]?.name ?? id.replace(/^(siege|minecraft):/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const costLine = (cost, regals) => [...cost.map(([id, n]) => `${n} ${nameOf(id)}`), ...(regals ? [`${regals} Regals`] : [])].join(", ");
const show = (form, p) => form.show(p).catch(() => ({ canceled: true }));

on("codexForge", ({ player, wonderId }) => system.run(() => forgeMenu(player, wonderId)));
on("codexCaravan", ({ player }) => system.run(() => caravanMenu(player)));

async function forgeMenu(p, wonderId) {
  const w = WONDER_BY_ID[wonderId];
  if (!w) return;
  const holder = wonderHolder(wonderId);
  const lordHeld = !!holder?.lordId;
  const recipes = forgeRecipes(wonderId);
  const region = w.home;
  const home = homeRegion(p.id);
  const form = new ActionFormData().title(FORGE_LABEL[wonderId]?.replace(/^(Use|Fit) /, "") ?? w.name);
  const yours = mayWear(region, home, store.data.writs, p.id);
  form.body([
    `${w.keeper}: "${lordHeld ? `${holder.name ?? "The lord"} holds this place now. The fires still burn, at a lord's price.` : "Bring what it takes, and we'll make it."}"`,
    wonderId !== "great_horse_fair" ? (yours ? `§aYou may wear ${region}'s gear.` : `§7${region}'s gear only answers to those who live in ${region}, or carry its Kin-Writ.`) : "",
  ].filter(Boolean).join("\n\n"));
  const acts = [];
  for (const r of recipes) {
    const regals = pricesFor(r.regals, lordHeld);
    form.button(`${r.name}\n§8${costLine(r.cost, regals)}`);
    acts.push(() => make(p, r, regals));
  }
  if (wonderId !== "great_horse_fair") {
    const canGive = holder?.playerId === p.id || home === region;
    if (canGive) { form.button(`Give a ${region} Kin-Writ`); acts.push(() => giveWritMenu(p, region)); }
    else if (!yours) {
      form.button(lordHeld ? `Buy a ${region} Kin-Writ\n§8${WRIT_PRICE} Regals` : `Ask ${w.keeper} for a Kin-Writ\n§8${FAVOUR_COUNT} ${nameOf(FAVOUR[region])}`);
      acts.push(() => favour(p, w, lordHeld));
    }
  }
  form.button("Close");
  const r = await show(form, p);
  if (!r.canceled) acts[r.selection]?.();
}

function make(p, r, regals) {
  for (const [id, n] of r.cost) {
    if (!isCreative(p) && countItem(p, id) < n) return p.sendMessage(`§cYou need ${n} ${nameOf(id)}.§7 (${r.name}: ${costLine(r.cost, regals)})`);
  }
  if (!charge(p, regals, "codex_forge")) return p.sendMessage(`§cThat costs ${regals} Regals.`);
  for (const [id, n] of r.cost) takeItems(p, id, n);
  give(p, r.out, 1);
  sfx(p, "random.anvil_use");
  p.sendMessage(`§6${r.name}§7 is yours.${r.region && !mayWear(r.region, homeRegion(p.id), store.data.writs, p.id) ? ` It only answers to those of ${r.region}.` : ""}`);
}

async function giveWritMenu(p, region) {
  const others = players().filter((o) => o.id !== p.id);
  const granted = (store.data.writs[region] ?? []);
  const form = new ModalFormData().title(`${region} Kin-Writ`);
  const names = others.map((o) => `${o.name}${granted.includes(o.id) ? " (has one)" : ""}`);
  if (!names.length) return p.sendMessage("§7Nobody else is here to give a writ to.");
  form.dropdown("Who is it for?", names, { defaultValueIndex: 0 });
  form.toggle("Take their writ back instead", { defaultValue: false });
  const r = await show(form, p);
  if (r.canceled) return;
  const who = others[r.formValues[0]];
  if (!who) return;
  if (r.formValues[1]) {
    revokeWrit(region, who.id);
    p.sendMessage(`§7You took back ${who.name}'s ${region} Kin-Writ.`);
    who.sendMessage(`§7${p.name} has taken back your ${region} Kin-Writ.`);
  } else {
    grantWrit(region, who.id);
    p.sendMessage(`§6You gave ${who.name} a ${region} Kin-Writ.`);
    who.sendMessage(`§6${p.name} has given you a ${region} Kin-Writ.§7 ${region}'s gear answers to you now.`);
  }
}

function favour(p, w, lordHeld) {
  const region = w.home;
  if (lordHeld) {
    if (!charge(p, WRIT_PRICE, "codex_writ")) return p.sendMessage(`§cA writ costs ${WRIT_PRICE} Regals.`);
  } else if (!takeItems(p, FAVOUR[region], FAVOUR_COUNT)) {
    return p.sendMessage(`§7${w.keeper}: "Bring me ${FAVOUR_COUNT} ${nameOf(FAVOUR[region])} and we'll talk."`);
  }
  grantWrit(region, p.id);
  sfx(p, "random.levelup");
  p.sendMessage(`§6${w.keeper} writes your name in the book and hands you a ${region} Kin-Writ.§7 ${region}'s gear answers to you now.`);
}

// ---------- the Sun Gate caravan market ----------
async function caravanMenu(p) {
  const day = world.getDay();
  const stock = caravanStock(day);
  const left = 3 - (day % 3);
  const form = new ActionFormData().title("The Caravan Market")
    .body(`Caravan-Master Idris: "Goods from past the end of every road. New stalls in ${left} day${left === 1 ? "" : "s"}."`);
  for (const g of stock) form.button(`${g.name}\n§8${g.price} Regals`);
  form.button("Close");
  const r = await show(form, p);
  if (r.canceled || r.selection >= stock.length) return;
  const g = stock[r.selection];
  const confirm = await show(new ActionFormData().title(g.name).body(`${g.does}\n\n§7${g.price} Regals.`).button(`Buy for ${g.price} Regals`).button("Back"), p);
  if (confirm.canceled || confirm.selection !== 0) return caravanMenu(p);
  if (!charge(p, g.price, "caravan")) return p.sendMessage(`§c${g.name} costs ${g.price} Regals.`);
  give(p, g.id, g.id === "siege:ember_tea" || g.id === "siege:caravan_rations" ? 4 : 1);
  sfx(p, "random.orb");
  p.sendMessage(`§6Bought ${g.name}.`);
}

// The Caravan Banner: hung at your keep, a caravan trader comes once a week
world.afterEvents.itemUse.subscribe((ev) => {
  const p = ev.source;
  if (ev.itemStack?.typeId !== "siege:caravan_banner" || p?.typeId !== "minecraft:player") return;
  const owner = settlementAt(p.location);
  if (!owner || (owner !== p.id && !keepOf(owner)?.allies?.includes(p.id))) return p.onScreenDisplay.setActionBar("§7Hang it inside your own settlement.");
  store.data.banners[owner] = world.getDay();
  store.save();
  p.sendMessage("§6The Caravan Banner flies over your keep.§7 A caravan trader will stop by once a week.");
  consumeOne(p, "siege:caravan_banner");
});
let lastDay = -1;
onTick("codex:caravan", 200, () => {
  const day = world.getDay();
  if (day === lastDay) return;
  lastDay = day;
  for (const [owner, since] of Object.entries(store.data.banners)) {
    if ((day - since) % 7 !== 0 || day === since) continue;
    const k = keepOf(owner);
    if (!k) continue;
    try {
      const dim = world.getDimension("overworld");
      const top = dim.getTopmostBlock({ x: k.x + 6, z: k.z + 6 });
      if (top) dim.spawnEntity("minecraft:wandering_trader", { x: top.location.x + 0.5, y: top.location.y + 1, z: top.location.z + 0.5 });
      world.getAllPlayers().find((pl) => pl.id === owner)?.sendMessage("§6A caravan trader has stopped by your keep.");
    } catch {
      // the keep's chunks aren't loaded; next week, then
    }
  }
});
