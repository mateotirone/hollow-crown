// Role trial exhibits for the test world (/scriptevent siege:showcase): a short Span on two pillars, with
// stones that crumble, and Goody Sedge's three graves. The four mentors stand with the other story
// characters (the lore exhibit spawns every NPC in dialogue.js). Both are built well behind the rows of
// other exhibits so nothing overlaps, and marked as if the map builder had done it.

import { on } from "../siege/api.js";
import { marks } from "./marks.js";

const LENGTH = 11; // blocks of walkway
const HIGH = 6; // the walkway's height above the ground

on("showcase", ({ player, dim, nextSpot, label }) => {
  try {
    const spot = nextSpot();
    const base = { x: spot.x, y: spot.y, z: spot.z - 60 };
    const set = (x, y, z, type) => { try { dim.getBlock({ x, y, z })?.setType(type); } catch { /* unloaded */ } };

    // the Span: two pillars with steps, and a walkway between them along -z
    for (let y = 0; y < HIGH; y++) {
      set(base.x, base.y + y, base.z, "minecraft:stone_bricks");
      set(base.x, base.y + y, base.z - LENGTH - 1, "minecraft:stone_bricks");
      set(base.x + 1, base.y + y, base.z + y - HIGH + 1, "minecraft:stone_brick_stairs"); // a rough stair up the near side
    }
    for (let i = 0; i <= LENGTH + 1; i++) set(base.x, base.y + HIGH - 1, base.z - i, i % 4 === 2 ? "minecraft:cracked_stone_bricks" : "minecraft:stone_bricks");
    const top = base.y + HIGH;
    marks.data.spans = marks.data.spans.filter((s) => !s.showcase);
    marks.data.spans.push({ dim: dim.id, showcase: true, start: { x: base.x + 0.5, y: top, z: base.z + 0.5 }, end: { x: base.x + 0.5, y: top, z: base.z - LENGTH - 0.5 } });
    label(spot, `The Span is 60 blocks\nbehind this sign\n(Rider trial)`);

    // three graves, a little way off
    marks.data.graves = marks.data.graves.filter((g) => !g.showcase);
    for (let i = 0; i < 3; i++) {
      const g = { x: base.x + 6 + i * 4, y: base.y, z: base.z - 4 };
      set(g.x, g.y, g.z, "minecraft:mossy_cobblestone");
      set(g.x, g.y + 1, g.z, "minecraft:mossy_cobblestone_wall");
      set(g.x, g.y, g.z + 1, "minecraft:podzol");
      marks.data.graves.push({ dim: dim.id, showcase: true, at: { x: g.x + 0.5, y: g.y + 1, z: g.z + 1.5 } });
    }
    marks.save();
    player.sendMessage("§6Role trials:§7 a Span and three graves stand 60 blocks behind the exhibit rows. Start a trial by talking to Kesh or Nell, or with §f/scriptevent siege:role_trial rider§7.");
  } catch (e) {
    console.warn(`[Role trials] showcase: ${e}`);
  }
});
