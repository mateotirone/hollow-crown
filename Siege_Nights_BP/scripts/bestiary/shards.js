// The five Choir Shards (no Minecraft here: quests/rules.js and the self-tests use it too).
// One from each regional boss, given to everyone who fought it, every time it falls. The Tuning Fork takes one of
// each (recipes/tuning_fork.json), never two of the same. The items are made by studio/build_codex.py.
//
// Old saves hold the one-size "siege:choir_shard" (now "Faded Choir Shard"): bestiary/shards_live.js swaps each for
// a boss's own shard the player doesn't have yet, the bosses they have beaten first.

export const OLD_SHARD = "siege:choir_shard";
export const CHOIR_SHARDS = [
  { boss: "reeve", id: "siege:choir_shard_reeve", who: "the Clockwork Reeve", short: "the Reeve's" },
  { boss: "huntsman", id: "siege:choir_shard_huntsman", who: "the Pale Huntsman", short: "the Huntsman's" },
  { boss: "bride", id: "siege:choir_shard_bride", who: "the Drowned Bride", short: "the Bride's" },
  { boss: "seneschal", id: "siege:choir_shard_seneschal", who: "the Ash Seneschal", short: "the Seneschal's" },
  { boss: "mother", id: "siege:choir_shard_mother", who: "the Mother of Changelings", short: "the Mother's" },
];
export const SHARD_IDS = CHOIR_SHARDS.map((s) => s.id);
export const shardOf = (boss) => CHOIR_SHARDS.find((s) => s.boss === boss);
export const SHARD_LORE = "Keep this! One shard from each of the five, set on an amethyst shard at a Siege Workshop, makes the Tuning Fork. Two of the same won't do.";

// items: { itemId: count } -> which of the five are in the pack, and which are not
export function shardsStatus(items = {}) {
  const have = CHOIR_SHARDS.filter((s) => (items[s.id] ?? 0) > 0);
  const missing = CHOIR_SHARDS.filter((s) => !((items[s.id] ?? 0) > 0));
  return { have, missing };
}

// The shards to give for `old` faded shards: ones not held yet, the bosses they have beaten first
export function convertOld(old, beaten = [], items = {}) {
  const { missing } = shardsStatus(items);
  const order = [...missing.filter((s) => beaten.includes(s.boss)), ...missing.filter((s) => !beaten.includes(s.boss))];
  return order.slice(0, Math.max(0, old)).map((s) => s.id);
}

// "the Huntsman's, the Bride's and the Mother's"
export function listShards(list) {
  const names = list.map((s) => s.short);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
