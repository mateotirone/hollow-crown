#!/usr/bin/env node
// Rewrites SOUND-LIST.md from the three places that know about sound:
//   studio/sounds/signature.json            every recording the game can use, with its prompt
//   studio/sounds/installed.json            which of them are installed (written by tools/install_sounds.py)
//   Siege_Nights_BP/scripts/core/sfx_cues.js  what every other sound is made of
// and from the scripts themselves (which sound is played where).   node tools/sound-list.mjs [--check]

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, "Siege_Nights_BP/scripts");
const { CUES, SIGNATURE_CUES, NAMED_CUES, REWORKED_IDS } = await import(pathToFileURL(join(SCRIPTS, "core/sfx_cues.js")));
const manifest = JSON.parse(readFileSync(join(ROOT, "studio/sounds/signature.json"), "utf8"));
const record = existsSync(join(ROOT, "studio/sounds/installed.json")) ? JSON.parse(readFileSync(join(ROOT, "studio/sounds/installed.json"), "utf8")) : {};

// ---------- which sound is played where ----------
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : f.endsWith(".js") ? [join(dir, f)] : []));
const uses = new Map(); // id -> Map(feature -> count)
for (const file of walk(SCRIPTS)) {
  const rel = relative(SCRIPTS, file);
  if (rel.startsWith("core/sfx") || rel.startsWith("sound/")) continue;
  const feature = rel.includes("/") ? rel.split("/")[0] : "main";
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!/\b(sfx|sound)\(|\bsound: "/.test(line) || /^\s*(\/\/|import )/.test(line)) continue;
    for (const [, id] of line.replace(/\/\/.*$/, "").matchAll(/"([a-z_]+(?:\.[a-z_0-9]+)+)"/g)) {
      if (!uses.has(id)) uses.set(id, new Map());
      uses.get(id).set(feature, (uses.get(id).get(feature) ?? 0) + 1);
    }
  }
}
const where = (id) => [...(uses.get(id) ?? [])].sort((a, b) => b[1] - a[1]).map(([f, n]) => (n > 1 ? `${f} (${n})` : f)).join(", ") || "-";
const count = (id) => [...(uses.get(id)?.values() ?? [])].reduce((a, b) => a + b, 0);

const recipe = (layers) => layers.length
  ? layers.map(([id, p = 1, v = 1, d = 0]) => `\`${id}\`${p !== 1 ? ` pitch ${p}` : ""}${v !== 1 ? ` vol ${v}` : ""}${d ? ` after ${(d / 20).toFixed(2).replace(/\.?0+$/, "")} s` : ""}`).join(" + ")
  : "nothing extra";
const shape = (e) => `${e.kind === "loop" ? "loop" : "one-shot"}, ${e.channels === 1 ? "mono" : "stereo"}`;
const state = (e) => (record[e.file] ? `recording (${record[e.file].seconds} s${record[e.file].variants ? `, ${record[e.file].variants.length} of ${e.variants} variants` : ""})` : e.file === "choir_hum" ? "placeholder made in code" : e.id.startsWith("siege.dragon.") ? "synthesized stand-in" : "vanilla stand-in");
const cueOf = (e) => SIGNATURE_CUES.find((n) => CUES[n].custom === e.id);

const sig = manifest.signature, dragons = manifest.dragons;
const roars = dragons.filter((d) => d.signature);
const signature = [...sig, ...roars];
const installedCount = signature.filter((e) => record[e.file]).length;

// ---------- creature voices (Siege_Nights_RP/sounds.json, written by studio/bestiary/voices.py) ----------
const entitySounds = JSON.parse(readFileSync(join(ROOT, "Siege_Nights_RP/sounds.json"), "utf8")).entity_sounds?.entities ?? {};
const voiceCell = (s) => {
  if (s === undefined) return "-";
  if (s === "" ) return "silent";
  const id = typeof s === "string" ? s : s.sound;
  const p = typeof s === "object" && Array.isArray(s.pitch) ? ` ${s.pitch[0]}-${s.pitch[1]}` : "";
  return id ? `\`${id}\`${p}` : "silent";
};
const voiceRows = Object.keys(entitySounds).filter((k) => !["siege:steed", "siege:dragon"].includes(k)).sort()
  .map((k) => { const ev = entitySounds[k].events ?? {}; return `| ${k.replace("siege:", "")} | ${voiceCell(ev.ambient)} | ${voiceCell(ev.hurt)} | ${voiceCell(ev.death)} | ${voiceCell(ev.step)} |`; })
  .join("\n");

let md = `# Sound list

Every sound The Hollow Crown plays, and what each one is made of. **This file is generated**: change
\`studio/sounds/signature.json\` (recordings and prompts) or \`Siege_Nights_BP/scripts/core/sfx_cues.js\`
(everything else), then run \`node tools/sound-list.mjs\`.

Tone for all of it: uneasy, especially at night. Not horror, no jump scares, nothing sudden or loud for its own sake.
There is no music in version 1.

- **${signature.length} signature sounds** are meant to be real recordings made with an AI sound generator. ${installedCount} of ${signature.length} are installed; the rest play a stand-in built from vanilla sounds, so the game is never silent.
- **${dragons.length - roars.length} more dragon sounds** have synthesized stand-ins and can be replaced the same way.
- **${REWORKED_IDS.length} vanilla sounds** are reworked (lower, softer, layered) everywhere the scripts use them, and **${NAMED_CUES.length} named cues** are built from vanilla layers.
- The remaining vanilla sounds are played as they are, because they should sound like what they are (a horse, a bow, a page).

## How to add a recording

1. Open a text-to-sound-effect generator (ElevenLabs Sound Effects and Stable Audio both work). Paste the prompt, set the length, and make three or four takes. Pick the one that fits the tone above.
2. Save it under the **file name** in the table (for example \`toll_317.mp3\`) and put it in the \`sounds-inbox/\` folder. Any of wav, mp3, ogg, flac or m4a is fine.
3. Run \`python3 tools/install_sounds.py\`. It trims and levels the file, converts it, puts it in the resource pack, wires it into \`sound_definitions.json\` and switches the game over from the stand-in. Then \`python3 tools/build.py\` makes a new \`hollow-crown.mcaddon\`.

No computer set up for this? Upload the files in the project chat and ask Claude to install them.

- \`python3 tools/install_sounds.py --status\` shows what is installed. \`--remove toll_317\` goes back to the stand-in.
- In game, \`/scriptevent siege:sound\` opens the **sound board**: every sound in this file, one click each. \`/scriptevent siege:sound signature\` plays the signature sounds in turn.
- Lengths are targets. A take up to twice as long is kept whole; anything longer is faded out there.
- Mono sounds come from a place in the world (a roar, the Rift). Stereo sounds are played to the listener directly. The installer converts to whichever the table says.

## Signature sounds

| # | Sound | File name | Length | Shape | Now |
|---|---|---|---|---|---|
${signature.map((e, i) => `| ${i + 1} | ${e.name} | \`${e.file}\` | ${e.ask_seconds ?? e.seconds} s | ${shape(e)} | ${state(e)} |`).join("\n")}

`;
signature.forEach((e, i) => {
  const cue = cueOf(e);
  md += `### ${i + 1}. ${e.name}\n\n`;
  md += `- **File name:** \`${e.file}\` (installs as \`${e.path}.ogg\`, sound id \`${e.id}\`)\n`;
  md += `- **Length:** ${e.ask_seconds ? `ask for ${e.ask_seconds} seconds or more; the game uses exactly ${e.seconds}` : `about ${e.seconds} seconds`}, ${shape(e)}${e.kind === "loop" ? `. The installer fades ${e.fade} s at each end and the game overlaps the fades, so it never has a gap` : ""}\n`;
  md += `- **When:** ${e.where}\n`;
  if (e.variants) md += `- **Variants:** ${e.variants}, named \`${e.file}_1\` to \`${e.file}_${e.variants}\`. The game picks one at random each time\n`;
  if (cue) md += `- **Stand-in until then:** ${recipe(CUES[cue].layers)}${CUES[cue].layers.length ? "" : " (the game's existing sounds for this moment carry on)"}\n`;
  if (e.note) md += `- **Note:** ${e.note}\n`;
  md += `- **Test:** \`/scriptevent siege:sound ${cue ?? e.id}\`\n\n`;
  md += `Prompt:\n\n> ${e.prompt}\n\n`;
});

md += `## The rest of the dragons' voices

Each species has eight voices and all four share four more. The roars are signature sounds above; these are the others.
All are short, mono, and come from the dragon. The young are the same files played higher. Install them the same way.

| File name | Length | Now | Prompt |
|---|---|---|---|
${dragons.filter((d) => !d.signature).map((e) => `| \`${e.file}\` | ${e.seconds} s | ${state(e)} | ${e.prompt} |`).join("\n")}

## Named cues

Built from vanilla layers in \`core/sfx_cues.js\`. A script plays one with \`sfx(player, "boss.warn")\`.

| Cue | What it is | Made of | Used by |
|---|---|---|---|
${NAMED_CUES.map((n) => `| \`${n}\` | ${CUES[n].what} | ${recipe(CUES[n].layers)} | ${where(n)} |`).join("\n")}

## Creature voices

What each creature sounds like when it idles, is hit, dies and walks. Each is one vanilla sound for now, re-pitched so
no two groups sound alike; change them in \`studio/bestiary/voices.py\` and run \`python3 studio/bestiary/voices.py\`.
A dash means it keeps the block's own footstep or has no idle sound; "silent" means silent on purpose.

| Creature | Idle | Hurt | Death | Step |
|---|---|---|---|---|
${voiceRows}

## Reworked vanilla sounds

Whenever a script plays one of these, it comes out as the recipe on the right. The pitch and volume the script asks
for still apply on top, and every play drifts a few percent in pitch so nothing is heard twice exactly the same.

| Vanilla sound | What it means here | Made of | Places | Used by |
|---|---|---|---|---|
${REWORKED_IDS.slice().sort((a, b) => count(b) - count(a)).map((n) => `| \`${n}\` | ${CUES[n].what} | ${recipe(CUES[n].layers)} | ${count(n)} | ${where(n)} |`).join("\n")}

## Vanilla sounds played as they are

| Vanilla sound | Places | Used by |
|---|---|---|
${[...uses.keys()].filter((id) => !(id in CUES) && !id.startsWith("siege.")).sort((a, b) => count(b) - count(a) || a.localeCompare(b)).map((id) => `| \`${id}\` | ${count(id)} | ${where(id)} |`).join("\n")}

## For anyone adding code

Play sounds with \`sfx()\` from \`scripts/core/sfx.js\`, not \`playSound\` directly (\`node tools/check.mjs\` notes any that slip through):

\`\`\`js
import { sfx } from "../core/sfx.js";
sfx(player, "random.levelup");                          // only that player hears it
sfx(dimension, "block.bell.hit", location, { pitch: 0.5 }); // everyone near that spot
\`\`\`

A new vanilla sound works straight away and is played as it is, as long as Bedrock has it: \`node tools/check.mjs\` fails on
any id missing from \`tools/vanilla_sounds.json\` (Java names like \`block.amethyst_block.chime\` play nothing on Bedrock). To rework it, or to add a named cue, add a line to
\`core/sfx_cues.js\` and run \`node tools/sound-list.mjs\`.
`;

const out = join(ROOT, "SOUND-LIST.md");
if (process.argv.includes("--check")) {
  if (!existsSync(out) || readFileSync(out, "utf8") !== md) { console.error("SOUND-LIST.md is out of date: run  node tools/sound-list.mjs"); process.exit(1); }
} else {
  writeFileSync(out, md);
  console.log(`SOUND-LIST.md: ${signature.length} signature sounds (${installedCount} installed), ${REWORKED_IDS.length} reworked, ${NAMED_CUES.length} named`);
}
