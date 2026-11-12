// Town hall exhibit for the test world (/scriptevent siege:showcase): a Keep raised behind the castle
// wall, with its Tree of Oaths awake, and enough Renown and skill points to try every skill.

import * as api from "../siege/api.js";
import { buildFor } from "./build.js";
import { heroOf, grantPoints, grantRenown } from "./hero.js";
import { CORNERSTONE, halls, saveHalls, beginBuild } from "./townhall.js";

api.on("showcase", ({ player, dim, origin, label }) => {
  const at = { x: origin.x, y: origin.y, z: origin.z + 32 }; // south of the castle wall, door facing you
  if (!buildFor(player.id)) {
    const old = halls()[player.id];
    dim.getBlock(at)?.setType(CORNERSTONE);
    halls()[player.id] = { x: at.x, y: at.y, z: at.z, fx: 0, fz: 1, level: 0, paid: 5, best: old?.best ?? 0, style: old?.style ?? "vale", building: null, marks: {} };
    saveHalls();
    beginBuild(player.id, 3, halls()[player.id].style);
  }
  label(at, "Town Hall\nTown Board and Tree inside");

  const hero = heroOf(player);
  if (hero.level < 30) {
    grantRenown(player, 10000, "showcase", true);
    grantPoints(player, 30, "showcase");
  }
  player.sendMessage("§6Town hall:§7 a Keep is rising south of the castle wall (about 15 seconds). Walk in and click the Tree of Oaths. You are Renown 30 with points to spend.");
  player.sendMessage("§7Other halls: §f/scriptevent siege:townhall_build 5 blackfen§7 (tier 1-5; vale, frostmarch, saltreach, emberwaste, blackfen). Paths: §f/scriptevent siege:townhall_path knight§7 or §fmarked§7.");
});
