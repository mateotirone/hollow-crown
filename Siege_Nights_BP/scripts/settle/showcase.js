// Settlement building in the test world (/scriptevent siege:showcase): a Mason's Bench with its
// mason, a Foundation Stone to try, and every pre-designed building raised in a row to the east.

import { on, regionalId, STONE_REGIONS } from "../siege/api.js";
import { STYLE_IDS } from "../townhall/styles.js";
import { BUILDINGS } from "./buildings.js";
import { BENCH, registerBench } from "./mason.js";
import { FOUNDATION, raiseFree } from "./plans.js";

on("showcase", ({ player, dim, origin, nextSpot, label }) => {
  const bench = nextSpot();
  const block = dim.getBlock(bench);
  if (block) {
    block.setType(BENCH);
    registerBench(block, player.id);
    label(bench, "Mason's Bench\nClick the mason\nBuy blocks");
  }
  const stone = nextSpot();
  dim.getBlock(stone)?.setType(FOUNDATION);
  label(stone, "Foundation Stone\nPick it up, place\nit, click it");

  // Every region's wall and roof blocks, one stack per region: palisade, wall planks, roof shingles, gate, portcullis
  for (const region of STONE_REGIONS) {
    const spot = nextSpot();
    ["palisade", "wall_planks", "roof_shingles", "castle_gate", "portcullis"].forEach((name, i) => {
      try {
        dim.getBlock({ x: spot.x, y: spot.y + i, z: spot.z })?.setType(regionalId(name, region));
      } catch {
        // a block this pack does not have yet
      }
    });
    label(spot, `${region}\nPalisade, planks,\nshingles, gates`);
  }

  // One of each building, east of the settlement, each in the next regional style
  BUILDINGS.forEach((b, i) => {
    const at = { x: origin.x + 36, y: origin.y, z: origin.z - 10 + i * 14 };
    const style = STYLE_IDS[i % STYLE_IDS.length];
    try {
      dim.runCommand(`fill ${at.x} ${at.y} ${at.z - 6} ${at.x + 13} ${at.y + 13} ${at.z + 6} air`);
    } catch {
      // not loaded that far out
    }
    raiseFree(player, at, { x: 1, z: 0 }, b.id, style);
    label({ x: at.x - 1, y: at.y, z: at.z + 1 }, `${b.name}\n${style}`);
  });
  player.sendMessage("§6Settlement building:§7 the mason is in the row behind you. The nine pre-designed buildings are rising in a line to the east. §f/scriptevent siege:settle_zone§7 tells you which build zone you stand in.");
});
