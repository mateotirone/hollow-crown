// The Guild Factor's board: click the Factor in any town for today's three orders. Deliver the goods, get the metal.
// Each order can be filled once a day by each player. Numbers and orders: data.js.

import { world, system, ItemStack, GameMode } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { countItem, takeItems, emit } from "../siege/api.js";
import { niceName } from "../economy/rules.js";
import { sfx } from "../core/sfx.js";
import { ordersFor } from "./data.js";
import "./tests.js";

const DONE = "siege:guild_done"; // player prop: { day, ids: [...] }
const townOf = (npc) => npc.getTags().find((t) => t.startsWith("siege_town_"))?.slice("siege_town_".length) ?? `${Math.floor(npc.location.x / 64)},${Math.floor(npc.location.z / 64)}`;
const list = (pay) => pay.map(([id, n]) => `${n} ${niceName(id)}`).join(", ");

function doneToday(player) {
  let rec;
  try { rec = JSON.parse(player.getDynamicProperty(DONE) ?? "null"); } catch { rec = undefined; }
  const day = world.getDay();
  return rec?.day === day ? rec : { day, ids: [] };
}

function hand(player, id, count) {
  const inv = player.getComponent("minecraft:inventory").container;
  while (count > 0) {
    const n = Math.min(64, count);
    count -= n;
    const left = inv.addItem(new ItemStack(id, n));
    if (left) player.dimension.spawnItem(left, player.location);
  }
}

export async function guildMenu(player, npc, region) {
  const town = townOf(npc), orders = ordersFor(town, region, world.getDay()), rec = doneToday(player);
  const form = new ActionFormData().title("Guild Factor")
    .body(`§o"The Guild buys what this country can't make for itself, and pays in metal."§r\n\nToday's orders (new every dawn). Bring the goods, take the pay.`);
  for (const o of orders) {
    const done = rec.ids.includes(o.id), have = countItem(player, o.item);
    form.button(done ? `§8Filled: ${o.count} ${niceName(o.item)}` : `${o.count} ${niceName(o.item)} §8(${o.from})\n§8pays ${list(o.pay)} · you have ${have}`);
  }
  form.button("Leave");
  const res = await form.show(player);
  if (res.canceled) return;
  const o = orders[res.selection];
  if (!o) return;
  if (rec.ids.includes(o.id)) return player.onScreenDisplay.setActionBar("§7You have filled that one today.");
  if (countItem(player, o.item) < o.count) {
    player.onScreenDisplay.setActionBar(`§7You need ${o.count} ${niceName(o.item)}. ${o.from} is where it comes from.`);
    return guildMenu(player, npc, region);
  }
  if (player.getGameMode() === GameMode.Creative) player.runCommand(`clear @s ${o.item} -1 ${o.count}`);
  else if (!takeItems(player, o.item, o.count)) return;
  rec.ids.push(o.id);
  player.setDynamicProperty(DONE, JSON.stringify(rec));
  for (const [id, n] of o.pay) hand(player, id, n);
  sfx(player, "random.orb");
  player.onScreenDisplay.setActionBar(`§6Order filled.§7 Paid: ${list(o.pay)}.`);
  emit("guildOrderFilled", { player, item: o.item, count: o.count, pay: o.pay });
  system.run(() => guildMenu(player, npc, region).catch(() => {}));
}
