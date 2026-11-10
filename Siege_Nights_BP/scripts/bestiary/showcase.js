// Our part of the test world (/scriptevent siege:showcase): every mob and boss stands in the extras
// row as a labelled statue. Statues can't move, fight or be hurt, so you can walk around and look.
// To fight one for real, use its spawn egg, a boss key from the "Every item" chest, or
// /scriptevent siege:bestiary_summon <boss id>.

import { on, addTests, assert } from "../siege/api.js";
import { MOBS, SIGILS, ITEMS } from "./data.js";
import { bossDefs } from "./bossCore.js";
import { effect } from "./util.js";

const FOREVER = 20000000;
const FAMILY_LABEL = { raider: "Choir raider", hollow: "Hollow thing", summon: "Summoned", wild: "Beast (peaceful)", wild_hostile: "Beast", undead: "Beast", order: "Ashen Gate", boss: "BOSS", boss_add: "Boss helper", boss_prop: "Fight prop" };
const ORDER = ["boss", "raider", "hollow", "undead", "wild", "wild_hostile", "order", "summon", "boss_add", "boss_prop"];

export function exhibits() {
  return Object.entries(MOBS)
    .filter(([, m]) => m.family !== "projectile")
    .sort(([, a], [, b]) => ORDER.indexOf(a.family) - ORDER.indexOf(b.family))
    .map(([typeId, m]) => {
      const key = Object.entries(SIGILS).find(([, boss]) => boss === typeId)?.[0];
      const bossId = bossDefs().find((d) => d.type === typeId)?.id;
      const how = m.family !== "boss" ? `${Math.round(m.hp / 2)} hearts` : key ? `Key: ${ITEMS[key].name}` : `summon ${bossId}`;
      return { typeId, text: `${m.name}\n${FAMILY_LABEL[m.family] ?? ""}\n${how}` };
    });
}

on("showcase", ({ player, dim, nextSpot, label }) => {
  let shown = 0;
  for (const { typeId, text } of exhibits()) {
    const at = nextSpot();
    try {
      const statue = dim.spawnEntity(typeId, { x: at.x + 0.5, y: at.y, z: at.z + 0.5 });
      statue.addTag("siege_showcase");
      statue.nameTag = MOBS[typeId].name; // named mobs don't despawn
      effect(statue, "slowness", FOREVER, 255);
      effect(statue, "weakness", FOREVER, 255);
      effect(statue, "resistance", FOREVER, 255);
      label(at, text);
      shown++;
    } catch (e) {
      console.warn(`[Hollow Crown] bestiary showcase could not spawn ${typeId}: ${e}`);
    }
  }
  player.sendMessage(`§6Bestiary:§7 ${shown} mobs and bosses are standing behind you as statues. To fight a boss, use its key from the "Every item" chest, or §f/scriptevent siege:bestiary_summon reeve§7 (also huntsman, bride, seneschal, mother, warlord_king, oswin).`);
});

addTests("bestiary", {
  "the showcase shows every mob and boss, with a sign that fits": () => {
    const list = exhibits();
    assert(list.length >= 37, `only ${list.length} exhibits`);
    assert(list.filter((x) => x.text.includes("BOSS")).length === 7, "seven boss statues");
    for (const x of list) for (const lineText of x.text.split("\n")) assert(lineText.length <= 26, `sign line too long: ${lineText}`);
  },
});
