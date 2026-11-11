// The Rider's world beyond the trial (loosely after Fourth Wing, with our own names), and the Knight-Commander's
// choice:
//   the roll of the fallen   every rider whose dragon died, read out by Kesh ("Read me the roll")
//   the cadets               three cadets who train beside you: Bram Tallow, Senna Vey, Pim Ashgrove. They are
//                            people in Kesh's world, told in short beats as your trial goes; one doesn't come back.
//                            (NPC riders on their own dragons are a later piece.) Senna stands in for you, alone,
//                            at the Rift stage of the Morvane fight.
//   the bond gift            when your dragon's bond fills, she picks a Wing skill for you: two free skill points
//   the Knight-Commander     names the Order: keep "the Ashen Gate" or found it again under a name they choose

import { world, system } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { on, emit, moduleStore, addTests, assert, assertEqual } from "../siege/api.js";
import { sfx } from "../core/sfx.js";

// Seeded with what Kesh has already lost. Entries: { rider, dragon, how }
const ROLL_START = [
  { rider: "Kesh Cinder (grounded, living)", dragon: "Sable", how: "shot down over the Saltglass" },
  { rider: "Idris Fane", dragon: "Ochre", how: "lost in a sandstorm" },
  { rider: "Maren Dusk", dragon: "Thistle", how: "fell at the Span, the year it was rebuilt" },
];
export const roll = moduleStore("siege:roost_roll", () => ({ fallen: [], bramGone: false, orderName: "" }));
export const rollNames = (fallen) => [...ROLL_START, ...fallen].map((e) => `§f${e.rider}§7 and §f${e.dragon}§7, ${e.how}`);

export const CADET_BEATS = {
  trial_span: "§8Bram Tallow passed you on the Span, laughing the whole way. Pim Ashgrove is still at the gate, white as chalk. Senna Vey crossed without a word, an hour before dawn, when nobody was watching.",
  trial_choosing: "§8In the nesting field Pim Ashgrove stood so still for so long that a dragon came to him. Bram walked in with his knife on his belt and came out with his eyebrows gone, and an egg anyway.",
  trial_rider_deed: "§8Bram Tallow took Cinderjaw out over the Saltglass a week too early, against orders, to be first. They didn't come back. Kesh will read his name this season.",
};

function readRoll(player) {
  const names = rollNames(roll.data.fallen);
  sfx(player, "sig.roll_drum");
  player.sendMessage(`§c"The roll of the Cinder Roost."§7 Kesh reads every name, slowly:\n${names.join("\n")}`);
}

on("loreTalk", ({ player, npc, next }) => {
  if (npc === "kesh" && next === "roll" && player) readRoll(player);
});

// Cadet beats as your trial goes (one per player each), and Bram's name goes on the roll once per world
on("loreFlag", ({ player, flag }) => {
  const beat = CADET_BEATS[flag];
  if (!beat || !player) return;
  system.runTimeout(() => { try { player.sendMessage(beat); } catch { /* gone */ } }, 100);
  if (flag === "trial_rider_deed" && !roll.data.bramGone) {
    roll.data.bramGone = true;
    roll.data.fallen.push({ rider: "Bram Tallow, cadet", dragon: "Cinderjaw", how: "flew a week too early, to be first" });
    roll.save();
  }
});

on("dragonDied", ({ ownerName, name, how }) => {
  roll.data.fallen.push({ rider: ownerName ?? "a rider", dragon: name ?? "her dragon", how: how ?? "died" });
  if (roll.data.fallen.length > 60) roll.data.fallen.shift(); // the wall is long, but not endless
  roll.save();
  for (const p of world.getPlayers()) sfx(p, "sig.roll_drum", { volume: 0.5 });
});

on("dragonBondFull", ({ owner, name }) => {
  const player = world.getPlayers().find((p) => p.id === owner);
  if (!player) return;
  emit("skillPoints", { player, amount: 2, source: `${name ?? "your dragon"}'s gift`, renown: 40 });
  player.sendMessage(`§c${name ?? "Your dragon"} presses her head against your chest and hums.§7 The bond is full. She has picked something for you to learn: two points for the Wing branch of the Tree of Oaths. Kesh says to spend them where she'd want.`);
  sfx(player, "mob.enderdragon.growl", { pitch: 1.4, volume: 0.4 });
});

// ---------- the Knight-Commander names the Order ----------
on("rankUp", ({ player, path, rank }) => {
  if (path !== "knight" || rank !== "Knight-Commander" || !player) return;
  system.runTimeout(() => nameTheOrder(player), 100);
});

export function cleanOrderName(raw) {
  const name = String(raw ?? "").replace(/§./g, "").replace(/[^\p{L}\p{N} '\-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 32);
  return name.length >= 3 ? name : "";
}

function nameTheOrder(player) {
  new ModalFormData()
    .title("The Order")
    .textField("Aldous: \"Keep the name, or found it again. The Eleven will follow either.\"\n\nType a new name, or leave it to keep the Ashen Gate.", "the Ashen Gate", roll.data.orderName || "")
    .show(player).then((r) => {
      if (r.canceled) return;
      const name = cleanOrderName(r.formValues?.[0]);
      roll.data.orderName = name;
      roll.save();
      emit("loreSetFlag", { player, flag: "order_named" });
      world.sendMessage(name ? `§6${player.name} has founded the Order again, as ${name}.` : `§6${player.name} keeps the name of the Ashen Gate, and means it this time.`);
    }).catch(() => {});
}

addTests("roletrials", {
  "the roll starts with Kesh's own loss and grows": () => {
    const names = rollNames([{ rider: "Ada", dragon: "Ember", how: "fell" }]);
    assertEqual(names.length, 4);
    assert(names[0].includes("Sable"));
  },
  "an order's name is cleaned, and short names keep the old one": () => {
    assertEqual(cleanOrderName("  §6The  Grey   Watch!! "), "The Grey Watch");
    assertEqual(cleanOrderName("ab"), "");
    assertEqual(cleanOrderName("x".repeat(50)).length, 32);
  },
});
