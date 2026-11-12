// The Messenger (Keep branch of the Tree of Oaths, or hired for Regals): pure rules, loads in Node.
//
// Mateo 2026-11-12: away from your base without a messenger you don't know it's being attacked; you only
// find out when you get back. With one, the moment someone attacks your base a messenger finds you and
// tells you "your base is under attack". It costs either Regals or a skill point.
//
// Every attack on a settlement becomes one piece of NEWS: { kind, text, by? }. What happens to it depends
// on where the keeper is (route below):
//   at home      they see it themselves: a plain warning, no messenger needed
//   away + skill a messenger rides up at once with the news, the way home and how far it is
//   away, none   nothing now; the news waits and is read out when they next set foot on their own land
//   offline      same as away without one (any news still waiting is read out when they come home)

export const MESSENGER = {
  skill: "keep_messenger",
  coins: 100, // the Regal price at the Tree of Oaths (the skill-point price is the skill's own cost)
  // the same kind of news is not sent twice inside this many ticks (a fight is many blows, one message)
  cooldown: { player: 1200, raid: 0, lord: 0, fallen: 0, vault: 600, other: 600 },
  keepNews: 8, // most pieces of news kept for a keeper's return
};

// What to do with news for a keeper: "home", "messenger" or "later"
export function route({ online, atHome, hasMessenger }) {
  if (online && atHome) return "home";
  if (online && hasMessenger) return "messenger";
  return "later";
}

// Is this kind of news still cooling down for this keeper? last = { kind: tick sent }
// key defaults to the kind; news with its own words is keyed by those words, so two different events of one
// kind (a safe struck, then broken open) both get through while repeats of the same one wait
export function cooling(last, kind, now, key = kind) {
  const wait = MESSENGER.cooldown[kind] ?? MESSENGER.cooldown.other;
  return wait > 0 && last?.[key] !== undefined && now - last[key] < wait;
}

// Eight-point compass heading from one spot to another (x east, z south, as in Minecraft)
const POINTS = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];
export function heading(from, to) {
  const a = Math.atan2(to.z - from.z, to.x - from.x);
  return POINTS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}

export function wayHome(from, to) {
  const d = Math.round(Math.hypot(to.x - from.x, to.z - from.z));
  return d < 24 ? "close by" : `${d} blocks to the ${heading(from, to)}`;
}

// The words for each kind of attack. name = the settlement's name, who = attacker's name (may be missing)
export function newsText(kind, { name = "your settlement", who, assault, total, lord } = {}) {
  switch (kind) {
    case "player": return who ? `${who} is attacking ${name}.` : `Someone is attacking ${name}.`;
    case "raid": return total ? `Raiders are marching on ${name}: assault ${assault} of ${total}.` : `Raiders are marching on ${name}.`;
    case "lord": return `${lord ?? "A rival lord"}'s men are raiding ${name}.`;
    case "fallen": return `The keep of ${name} has fallen.`;
    case "drill": return who ? `${who} is drilling at the vault lock of ${name}.` : `Someone is drilling at the vault lock of ${name}.`;
    case "breach": return `The vault door of ${name} has been broken in${who ? ` by ${who}` : ""}.`;
    case "relic": return `${who ?? "Someone"} took a relic from the vault of ${name}.`;
    case "key": return `${who ?? "Someone"} opened the vault of ${name} with a key.`;
    default: return `${name} is under attack.`;
  }
}

// Which cooldown bucket a kind of news falls in
export const bucket = (kind) => (kind === "drill" || kind === "breach" || kind === "relic" || kind === "key" ? "vault" : MESSENGER.cooldown[kind] !== undefined ? kind : "other");

// Add news to a keeper's waiting list: newest last, the same line is not kept twice, capped
export function keepNews(list, text, when) {
  const out = (list ?? []).filter((n) => n.text !== text);
  out.push({ text, when });
  return out.slice(-MESSENGER.keepNews);
}

// The report read out on coming home without a messenger
export function homecoming(list) {
  if (!list?.length) return [];
  return ["§6While you were away:", ...list.map((n) => `§7- ${n.text}`), "§8A Messenger, from the Tree of Oaths, would have found you."];
}
