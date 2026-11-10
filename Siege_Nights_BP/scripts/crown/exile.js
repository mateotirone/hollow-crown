// The Long Road Back: the banished ruler's own storyline, and the Citadel falling with no heir.

import {
  on, onTick, getState, guardCount, addKeepMenuButtons, title,
} from "../siege/api.js";
import { ActionFormData } from "@minecraft/server-ui";
import { CROWN } from "./config.js";
import { payE } from "../economy/coins.js";
import { EXILE_STAGES, nextExileStage } from "./rules.js";
import { crown, saveCrown, playerById, addClaim, claimOf, announce, rulerLabel } from "./state.js";
import { crownStatus, annalLines, endReign, vacate } from "./reign.js";
import { banish, npcWins } from "./usurp.js";

// Finish the exile's current stage if it is `stage`, pay its reward and announce the next one
function complete(player, stage) {
  const c = crown();
  const exile = c.exiles[player.id];
  if (!exile || exile.stage !== stage) return;
  const done = EXILE_STAGES[stage];
  exile.stage = nextExileStage(stage, c.exiledTimes?.[player.id] ?? 1);
  saveCrown();
  if (done.emeralds) payE(player, done.emeralds, "exile");
  if (done.claim) addClaim(player, done.claim, done.name);
  const next = EXILE_STAGES[exile.stage];
  title(player, `§5${done.name}`, "§7The Long Road Back");
  player.playSound("random.levelup");
  if (stage === 0) player.sendMessage("§7A note is pinned to your new banner: §o\"Not everyone has forgotten you. Look for the ones who still wear your color.\"");
  if (stage === 3) player.sendMessage("§5The underground is yours now. You will hear of every Shardfall a minute before anyone else, and exactly where.");
  if (exile.stage > stage + 1) player.sendMessage("§7You have walked this road before. The loyalists never left, and nobody doubts you can hold a wall: the middle of the road is already behind you.");
  if (next) player.sendMessage(`§5Next, ${next.name}: §7${next.goal}`);
}

on("keepFounded", ({ player }) => complete(player, 0));
on("siegeReward", ({ player }) => complete(player, 2));
on("shardBound", ({ player }) => complete(player, 3));

onTick("crown exile road", 100, () => {
  const c = crown();
  for (const [id, exile] of Object.entries(c.exiles)) {
    if (exile.stage !== 1 || guardCount(id) < 2) continue;
    const player = playerById(id);
    if (player) complete(player, 1);
  }
});

// The New Source: if raiders take the Citadel from a fully Hollow ruler, nobody inherits
on("keepFallen", ({ owner, keep }) => {
  const c = crown();
  if (c.ruler?.id !== owner) return;
  if (c.challenge?.npc) return npcWins("the keep fell to their army", keep); // a rival lord took it
  const old = endReign("swallowed by the Hollow");
  announce(`§4${old.title} ${old.name} is gone. The raiders they once commanded have taken the throne room. ${CROWN.citadelName} stands empty.`);
  banish(old.id, old.name);
  vacate("The throne is empty");
});

// A "The High Throne" page on every Keep Banner menu
addKeepMenuButtons(({ player }) => [{
  label: "The High Throne",
  icon: "textures/items/siege_heart_of_the_hollow",
  action: () => {
    const c = crown();
    const lines = [...crownStatus(player)];
    const exile = c.exiles[player.id];
    if (exile) {
      const stage = EXILE_STAGES[exile.stage];
      const left = exile.until - getState().siegeNumber;
      lines.push("", "§l§5The Long Road Back§r", ...EXILE_STAGES.map((s, i) => `${i < exile.stage ? "§a[done]" : i === exile.stage ? "§e[now]" : "§8[later]"} ${s.name}§r`),
        stage ? `§7${stage.goal}` : "", left > 0 ? `§7Banished from ${rulerLabel()}'s land for ${left} more siege nights.` : "", `Blood Claim: §5${claimOf(player.id)}`);
    }
    lines.push("", ...annalLines());
    new ActionFormData().title("The High Throne").body(lines.join("\n")).button("Close").show(player).catch(() => {});
  },
}]);
