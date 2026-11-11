// Builds the character looks that ship inside the add-on, so anyone who joins the world can wear one.
//
//   node studio/build_looks.mjs                               rebuild everything from studio/looks/roster.json
//   node studio/build_looks.mjs add "<creator link>" [Gamertag]   add a friend's character, then rebuild
//
// A look is a character made on the creator page (character-creator/index.html). Its link holds the
// whole character, so this script runs the page's own skin painter to get the same 64x64 skin.
// With a Gamertag the look is reserved: that player gets it automatically and nobody else can pick it.
//
// It writes: the skin PNGs, the player files in both packs (vanilla copies from studio/looks/vanilla/
// plus our additions), the render controllers, scripts/looks/data.js and the Looking Glass block.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BP = path.join(ROOT, "Siege_Nights_BP"), RP = path.join(ROOT, "Siege_Nights_RP");
const ROSTER = path.join(ROOT, "studio/looks/roster.json");
const MAX = 64; // the top of the hc:look range in entities/player.json

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^\s*\/\/.*$/gm, ""));
const writeJson = (p, data) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n"); };

// ---------- PNG ----------
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function png(w, h, rgba) {
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body)); return Buffer.concat([len, body, sum]); };
  const head = Buffer.alloc(13); head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", head), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- the creator page's own code, with a pixel grid standing in for the browser canvas ----------
function fakeCanvas() {
  const cv = { width: 64, height: 64, px: null };
  const ctx = {
    fillStyle: "#000000",
    fillRect(x, y, w, h) { const n = parseInt(this.fillStyle.slice(1), 16); for (let b = y; b < y + h; b++) for (let a = x; a < x + w; a++) cv.px.set([n >> 16, (n >> 8) & 255, n & 255, 255], (b * cv.width + a) * 4); },
    clearRect(x, y, w, h) { for (let b = y; b < y + h; b++) for (let a = x; a < x + w; a++) cv.px.set([0, 0, 0, 0], (b * cv.width + a) * 4); },
  };
  cv.getContext = () => { cv.px ??= new Uint8Array(cv.width * cv.height * 4); return ctx; };
  return cv;
}
function loadCreator() {
  const html = fs.readFileSync(path.join(ROOT, "character-creator/index.html"), "utf8");
  const code = html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>"));
  const module = { exports: {} };
  new Function("module", "document", "window", code)(module, { createElement: fakeCanvas }, {});
  if (!module.exports.drawSkin) throw new Error("character-creator/index.html no longer exports its skin painter");
  return module.exports;
}
const creator = loadCreator();
const codeOf = (text) => { const m = /c1-[0-9a-z-]+/i.exec(text); if (!m) throw new Error(`No character code in "${text}". Paste the whole creator link.`); return m[0]; };
function character(code) {
  if (!creator.decode(code)) throw new Error(`"${code}" is not a complete character link.`);
  const { S } = creator, res = creator.compute();
  const name = S.custom || creator.genName(res).full;
  let h = 2166136261; for (const ch of S.look.join("")) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); // the page's own seed, so the pixels match
  const cv = creator.drawSkin(S.look, creator.baseSeed() + (h >>> 0));
  return { name, by: S.by, skin: png(64, 64, cv.px) };
}

// ---------- roster ----------
const roster = readJson(ROSTER);
const [cmd, link, gamertag] = process.argv.slice(2);
if (cmd === "add") {
  const code = codeOf(link ?? "");
  character(code); // throws if the link is broken
  const old = roster.looks.find((l) => l.code === code);
  if (old) { if (gamertag) old.player = gamertag; console.log(`Already in the pack as look ${old.n}.`); }
  else {
    const n = Math.max(0, ...roster.looks.map((l) => l.n)) + 1;
    if (n > MAX) throw new Error(`The pack holds ${MAX} looks. Raise MAX here and the range in the player file together.`);
    roster.looks.push({ n, code, ...(gamertag ? { player: gamertag } : {}) });
  }
  writeJson(ROSTER, roster);
} else if (cmd) throw new Error(`Unknown command "${cmd}". Use: add "<creator link>" [Gamertag]`);

// ---------- skins + script data ----------
const texDir = path.join(RP, "textures/entity/looks");
fs.mkdirSync(texDir, { recursive: true });
const used = new Set();
const looks = roster.looks.map((row) => {
  const c = character(row.code);
  let id = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "look";
  if (used.has(id)) id += "_" + row.n;
  used.add(id);
  fs.writeFileSync(path.join(texDir, `${id}.png`), c.skin);
  return { n: row.n, id, name: c.name, ...(row.player ? { player: row.player } : {}) };
});
for (const f of fs.readdirSync(texDir)) if (f.endsWith(".png") && !used.has(f.slice(0, -4))) fs.rmSync(path.join(texDir, f));
fs.mkdirSync(path.join(BP, "scripts/looks"), { recursive: true });
fs.writeFileSync(path.join(BP, "scripts/looks/data.js"),
  "// Written by studio/build_looks.mjs from studio/looks/roster.json. Do not edit by hand.\n" +
  "// n = the value of the hc:look player property. player = the gamertag a look is reserved for.\n" +
  `export const LOOKS = ${JSON.stringify(looks, null, 2)};\n`);

// ---------- behaviour pack: the player gets one synced number, hc:look ----------
const player = readJson(path.join(ROOT, "studio/looks/vanilla/player.json"));
player["minecraft:entity"].description.properties = { "hc:look": { type: "int", range: [0, MAX], default: 0, client_sync: true } };
writeJson(path.join(BP, "entities/player.json"), player);

// ---------- resource pack: draw the look instead of the player's own skin while hc:look is above 0 ----------
// has_property guard: the menu paper doll ("ToyGolem") has no actor, and a bare query.property logs an error there
const LOOK = "(query.has_property('hc:look') ? query.property('hc:look') : 0)";
const WORN = `${LOOK} >= 1`, OWN = `${LOOK} < 1`;
const client = readJson(path.join(ROOT, "studio/looks/vanilla/player.entity.json"));
const desc = client["minecraft:client_entity"].description;
const slots = Math.max(...looks.map((l) => l.n));
const texKey = (n) => `hc_look_${n}`;
for (let n = 1; n <= slots; n++) desc.textures[texKey(n)] = `textures/entity/looks/${(looks.find((l) => l.n === n) ?? looks[0]).id}`;
// Newer vanilla player animation controllers read variable.melee_spear_equipped (spears). Our copied player entity
// doesn't set it, which logs "unknown variable" errors on every swing; start it at 0 so the controllers resolve.
const init = (client["minecraft:client_entity"].description.scripts.initialize ??= []);
if (!init.some((l) => l.includes("melee_spear_equipped"))) init.push("variable.melee_spear_equipped = 0.0;");
desc.scripts.variables["variable.melee_spear_equipped"] = "public";
desc.geometry.hc_look = "geometry.humanoid.custom"; // the plain wide-arm player model, whatever the player's own skin uses
const SWAP = ["first_person", "third_person", "map"];
desc.render_controllers = desc.render_controllers.flatMap((entry) => {
  const [name, when] = Object.entries(entry)[0];
  const kind = name.split(".").pop();
  if (!SWAP.includes(kind)) return [entry];
  return [{ [name]: `(${when}) && ${OWN}` }, { [`controller.render.hc_look.${kind}`]: `(${when}) && ${WORN}` }];
});
writeJson(path.join(RP, "entity/player.entity.json"), client);

const vanillaRc = readJson(path.join(ROOT, "studio/looks/vanilla/player.render_controllers.json")).render_controllers;
const rc = { format_version: "1.8.0", render_controllers: {} };
for (const kind of SWAP) {
  rc.render_controllers[`controller.render.hc_look.${kind}`] = {
    ...vanillaRc[`controller.render.player.${kind}`],
    arrays: { textures: { "Array.hc_looks": Array.from({ length: slots }, (_, i) => `Texture.${texKey(i + 1)}`) } },
    geometry: "Geometry.hc_look",
    textures: [`Array.hc_looks[${LOOK} - 1]`],
  };
}
writeJson(path.join(RP, "render_controllers/hc_looks.render_controllers.json"), rc);

// ---------- the Looking Glass block (placed by the map builder; click it to change look) ----------
writeJson(path.join(BP, "blocks/looks/looking_glass.json"), {
  format_version: "1.21.60",
  "minecraft:block": {
    description: { identifier: "hc:looking_glass", menu_category: { category: "items" } },
    components: {
      "minecraft:display_name": "tile.hc:looking_glass.name",
      "minecraft:geometry": "minecraft:geometry.full_block",
      "minecraft:material_instances": { "*": { texture: "hc_looking_glass_side", render_method: "opaque" }, up: { texture: "hc_looking_glass_top", render_method: "opaque" }, down: { texture: "hc_looking_glass_top", render_method: "opaque" } },
      "minecraft:map_color": "#8fa7a8",
      "minecraft:destructible_by_mining": false,
      "minecraft:destructible_by_explosion": false,
      "minecraft:light_emission": 4,
    },
  },
});
const blockTex = (file, at) => {
  const p = path.join(RP, "textures/blocks/looks", file);
  if (fs.existsSync(p)) return; // never repaint: the textures thread may have replaced the placeholder
  const px = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px.set([...at(x, y), 255], (y * 16 + x) * 4);
  fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, png(16, 16, px));
};
const WOOD = [74, 52, 36], WOOD_D = [52, 36, 26], BRASS = [176, 138, 58];
blockTex("hc_looking_glass_side.png", (x, y) => {
  const edge = x === 0 || x === 15 || y === 0 || y === 15, rim = x === 2 || x === 13 || y === 2 || y === 13;
  if (edge) return WOOD_D; if (x < 2 || x > 13 || y < 2 || y > 13) return WOOD; if (rim) return BRASS;
  const glint = (x + y === 11 || x + y === 12) && y < 9, t = y / 16;
  return glint ? [226, 238, 236] : [150 - t * 50 + (x % 3) * 3, 176 - t * 50, 178 - t * 44].map(Math.round);
});
blockTex("hc_looking_glass_top.png", (x, y) => (x === 0 || x === 15 || y === 0 || y === 15 ? WOOD_D : (x + y) % 5 === 0 ? WOOD_D : WOOD));

const merge = (p, fn) => { const data = readJson(p); fn(data); writeJson(p, data); };
merge(path.join(RP, "blocks.json"), (b) => { b["hc:looking_glass"] = { sound: "glass" }; });
merge(path.join(RP, "textures/terrain_texture.json"), (t) => {
  t.texture_data.hc_looking_glass_side = { textures: "textures/blocks/looks/hc_looking_glass_side" };
  t.texture_data.hc_looking_glass_top = { textures: "textures/blocks/looks/hc_looking_glass_top" };
});
const langPath = path.join(RP, "texts/en_US.lang");
let lang = fs.readFileSync(langPath, "utf8");
if (!lang.includes("tile.hc:looking_glass.name=")) fs.writeFileSync(langPath, lang.replace(/\n*$/, "\n") + "tile.hc:looking_glass.name=Looking Glass\n");

console.log(`Looks in the pack: ${looks.length}`);
for (const l of looks) console.log(`  ${String(l.n).padStart(2)}  ${l.name}${l.player ? `  (reserved for ${l.player})` : ""}`);
