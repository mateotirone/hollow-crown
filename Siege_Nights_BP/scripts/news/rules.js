// World news: big moments read out to everyone in chat, like a town crier. Pure (loads in Node).
//
// Mateo 2026-11-12: "We have to have a lot of world event things come up in the chat... when somebody starts a
// boss fight, whatever." Each entry turns one game event into one chat line, or null to stay quiet.
// Events that already announce themselves to everyone (a boss slain, a lord's banner raised, a rank, a
// settlement growing, a hall raised, a line laid) are not repeated here.
//
// Two rules:
//  - Never news of an attack on a player's settlement: that word comes only by Messenger (townhall/messenger.js).
//  - Never name the Hollow or what is behind it (lore reveal rules): anything from there is told without names.
//
// ctx = { where(dim, x, z) -> "near Kingsrest" style text, nameOf(id) -> player name }

const HIDDEN = /hollow|morvane|oswin|choir|undertow/i; // names the news never says out loud

export const PREFIX = "§8[§6Crier§8]§r ";

const who = (list) => (list.length <= 1 ? list[0] ?? "" : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`);
const bossName = (name) => (HIDDEN.test(name ?? "") ? null : String(name ?? "").replace(/§./g, ""));

export const NEWS = {
  bossFightStarted: ({ name, dim, x, z, players = [], rank }, ctx) => {
    const n = bossName(name);
    const at = ctx.where(dim, x, z);
    if (!n) return `§5Something old has woken ${at}.${players.length ? ` §7${who(players)} ${players.length === 1 ? "is" : "are"} there.` : ""}`;
    return `§c${n} has woken ${at}${rank ? ` §7(it has fallen ${rank === 1 ? "once" : `${rank} times`}, and came back stronger)` : ""}.${players.length ? ` §7${who(players)} ${players.length === 1 ? "stands" : "stand"} against it.` : ""}`;
  },
  bossFightReset: ({ name, dim, x, z }, ctx) => {
    const n = bossName(name);
    return n ? `§7${n} has thrown back everyone who came against it ${ctx.where(dim, x, z)}. It waits for the next.` : null;
  },
  keepFounded: ({ player, moved }, ctx) => (moved ? null : `§6${player.name} has planted a Keep Banner ${ctx.where("minecraft:overworld", player.location.x, player.location.z)}. A new settlement is born.`),
  joined: ({ player, first }) => (first ? `§e${player.name} has arrived in Aldmere for the first time. §7Make them welcome.` : null),
  plotChosen: ({ player, plot, lord }) => (plot?.name ? `§6${player.name} has claimed ${plot.name}${lord?.name ? `, and ${lord.name} has stepped down from it` : ""}.` : null),
  wallUpgrade: ({ player, level, handled }) => (handled && player ? `§6${player.name}'s settlement is raising its wall to level ${level}.` : null),
  stationAdded: ({ station }) => (station?.name ? `§6${station.name} has joined the rail network.` : null),
  rivalBesieged: ({ lord, player }) => (lord?.name && player ? `§c${player.name} has called out ${lord.name} at ${lord.plot ?? "their hall"}. §7Their men are turning out.` : null),
  rivalFeudEnded: ({ winner, loser }) => (winner?.name && loser?.name ? `§6The feud is over: ${winner.name} has beaten ${loser.name}.` : null),
  dragonBondFull: ({ owner, name }, ctx) => (name ? `§6${name} and ${ctx.nameOf(owner) ?? "its rider"} are bound for life.` : null),
  dragonDied: ({ ownerName, name }) => (name ? `§4${name}, ${ownerName ? `${ownerName}'s dragon, ` : ""}is dead.` : null),
  // a settlement's very first engine on the line (news/index.js marks firstFor the first time per settlement)
  enginePlaced: ({ firstFor, dim, x, z }, ctx) => (firstFor ? `§6${firstFor}'s settlement has its first train. §7It stands on the line ${ctx.where(dim, x, z)}.` : null),
  // made in news/index.js from a player's death: only to a boss, a creature of this world, or another player,
  // and never inside a player's settlement (that would be news of an attack)
  playerFell: ({ victim, killer, kind, dim, x, z }, ctx) => {
    const at = ctx.where(dim, x, z);
    if (kind === "player") return `§c${victim} was slain by ${killer} ${at}.`;
    const n = bossName(killer);
    if (!n) return `§5${victim} fell to something nameless ${at}.`;
    return kind === "boss" ? `§c${victim} fell to ${n} ${at}.` : `§7${victim} fell to ${/^(the|a|an) /i.test(n) ? n : `a ${n}`} ${at}.`;
  },
  // a special offer posted or filled at a Trade Outpost (scripts/trade/, the trade routes thread)
  tradeSpecialOffer: ({ name, itemName, count, price, normal }) => (name && itemName ? `§6${name} wants ${count} ${itemName} and will pay ${price} Regals${normal ? ` §7(about ${normal} at the usual rate)` : ""}§6. §7Find the offer at their Trade Outpost.` : null),
  tradeSpecialFilled: ({ name, itemName, count, by }) => (name && itemName ? `§7${by ? `${by} has filled` : "Someone has filled"} ${name}'s offer for ${count} ${itemName}.` : null),
  // siege-night streaks, after dawn (news/index.js turns siegeEnd into one siegeStreak per settlement that changed)
  siegeStreak: ({ settlement, streak, lost }) => {
    if (!settlement) return null;
    if (lost) return `§7${settlement}'s settlement has lost its streak after ${lost} nights held in a row.`;
    return streakMilestone(streak) ? `§6${settlement}'s settlement has held ${streak} siege nights in a row.` : null;
  },
  loreAllSolved: ({ player }) => `§d${player.name} has solved every mystery in their Ledger.`,
  loreThreadSolved: ({ player }) => `§d${player.name} has pieced a mystery together.`,
};

// Words the news must never print, checked by the tests on every line
// Streaks worth crying: 3, 5, 10, then every 5. A lost streak is cried from STREAK_LOSS nights up.
export const streakMilestone = (n) => n === 3 || (n >= 5 && n % 5 === 0);
export const STREAK_LOSS = 3;

// A killer's name for the news: its name tag without colours or rank, or its kind ("siege:pale_huntsman" -> "Pale Huntsman")
export function killerName(nameTag, typeId) {
  const tag = String(nameTag ?? "").replace(/§./g, "").split("\n")[0].replace(/\(.*?\)/g, "").trim();
  if (tag) return tag;
  return String(typeId ?? "").replace(/^[a-z_]+:/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const leaks = (text) => HIDDEN.test(String(text ?? "").replace(/§./g, ""));
