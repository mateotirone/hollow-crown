// Reads the resource pack (from git, through a layer map) and lists everything that can be shown in 3D:
// client entities (mobs, NPCs, mounts, engines), attachables (armour and worn items), custom blocks, item
// icons and every texture. Geometry is resolved here, inheritance included, so the page only draws.
import fs from "node:fs";
import path from "node:path";

const RP = "Siege_Nights_RP/", BPB = "Siege_Nights_BP/blocks/";

// JSON with // and /* */ comments and trailing commas, as Minecraft accepts.
export function looseJSON(text) {
  let out = "", i = 0, str = false;
  while (i < text.length) {
    const c = text[i], n = text[i + 1];
    if (str) { out += c; if (c === "\\") { out += n; i += 2; continue; } if (c === '"') str = false; i++; continue; }
    if (c === '"') { str = true; out += c; i++; continue; }
    if (c === "/" && n === "/") { while (i < text.length && text[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") { i = text.indexOf("*/", i + 2); i = i < 0 ? text.length : i + 2; continue; }
    out += c; i++;
  }
  return JSON.parse(out.replace(/^﻿/, "").replace(/,(\s*[\]}])/g, "$1"));
}

// Every geometry in a file, as {id: {parent, tw, th, bones}} (format 1.8 "a:b" keys and 1.12+ arrays).
function geometriesIn(doc) {
  const out = {};
  if (Array.isArray(doc["minecraft:geometry"])) {
    for (const g of doc["minecraft:geometry"]) {
      const d = g.description || {};
      if (d.identifier) out[d.identifier] = { tw: d.texture_width, th: d.texture_height, bones: g.bones || [] };
    }
  }
  for (const [k, g] of Object.entries(doc)) {
    if (!k.startsWith("geometry.") || typeof g !== "object") continue;
    const [id, parent] = k.split(":");
    out[id] = { parent, tw: g.texturewidth, th: g.textureheight, bones: g.bones || [] };
  }
  return out;
}

function resolveGeo(id, all, seen = new Set()) {
  const g = all[id];
  if (!g || seen.has(id)) return null;
  seen.add(id);
  if (!g.parent) return { tw: g.tw || 64, th: g.th || 64, bones: g.bones };
  const p = resolveGeo(g.parent, all, seen) || { tw: 64, th: 64, bones: [] };
  const bones = p.bones.map((b) => g.bones.find((c) => c.name === b.name) || b);
  for (const b of g.bones) if (!p.bones.some((c) => c.name === b.name)) bones.push(b);
  return { tw: g.tw || p.tw, th: g.th || p.th, bones };
}

const nice = (id) => id.replace(/^[a-z_]+:/, "").replace(/^(siege_|bestiary_)/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const SLOTS = ["helmet", "chestplate", "leggings", "boots"];

export async function buildIndex(layer, readBlob, vanilla) {
  const read = async (p) => { const f = layer.get(p); return f ? (await readBlob(f.sha)).toString("utf8") : null; };
  const json = async (p) => { try { const t = await read(p); return t == null ? null : looseJSON(t); } catch { return null; } };
  const files = [...layer.keys()];
  const under = (dir) => files.filter((f) => f.startsWith(dir) && f.endsWith(".json"));
  const errors = [];

  // names from the language file
  const names = {};
  const lang = await read(RP + "texts/en_US.lang");
  if (lang) for (const l of lang.split(/\r?\n/)) { const m = l.match(/^([^#=\s][^=]*)=(.*?)(\s+#.*)?$/); if (m) names[m[1].trim()] = m[2].trim(); }
  const nameOf = (kind, id) => names[`${kind}.${id}.name`] || names[`${kind}.${id}`] || nice(id);

  // texture path (no extension) -> served file
  const texFile = (p) => {
    if (!p) return null;
    for (const ext of [".png", ".tga", ""]) if (layer.has(RP + p + ext)) return { url: "/pack/" + RP + p + ext, ref: layer.get(RP + p + ext).ref };
    if (vanilla.ready && fs.existsSync(path.join(vanilla.root, p + ".png"))) return { url: "/vanilla/" + p + ".png", ref: "vanilla" };
    return { url: null, missing: p };
  };

  // geometries: vanilla first, the pack on top
  const geos = {}, geoFrom = {};
  if (vanilla.ready) {
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".json") ? [path.join(d, e.name)] : []);
    for (const f of walk(path.join(vanilla.root, "models"))) {
      try { for (const [id, g] of Object.entries(geometriesIn(looseJSON(fs.readFileSync(f, "utf8"))))) { geos[id] = g; geoFrom[id] = "vanilla"; } } catch { /* a vanilla file we cannot read */ }
    }
  }
  for (const f of under(RP + "models/")) {
    const doc = await json(f);
    if (!doc) { errors.push("cannot read " + f); continue; }
    for (const [id, g] of Object.entries(geometriesIn(doc))) { geos[id] = g; geoFrom[id] = layer.get(f).ref; }
  }
  const resolved = {};
  const geo = (id) => (id in resolved ? resolved[id] : (resolved[id] = resolveGeo(id, geos)));

  const group = (f, base) => { const rest = f.slice(base.length).split("/"); return rest.length > 1 ? rest[0] : ""; };
  const variants = (desc) => {
    const tex = Object.entries(desc.textures || {}).map(([k, p]) => ({ key: k, path: p, ...texFile(p) }));
    const geo = Object.entries(desc.geometry || {}).map(([k, id]) => ({ key: k, id }));
    return { textures: tex, geometry: geo };
  };

  const entities = [];
  for (const f of under(RP + "entity/")) {
    const doc = await json(f), d = doc?.["minecraft:client_entity"]?.description;
    if (!d?.identifier) continue;
    if (d.identifier === "minecraft:player") continue;
    entities.push({ id: d.identifier, name: nameOf("entity", d.identifier), group: group(f, RP + "entity/") || d.identifier.split(":")[0], file: f, ref: layer.get(f).ref, ...variants(d) });
  }

  const attachables = [];
  for (const f of under(RP + "attachables/")) {
    const doc = await json(f), d = doc?.["minecraft:attachable"]?.description;
    if (!d?.identifier) continue;
    const short = d.identifier.split(":").pop();
    const slot = SLOTS.find((s) => short.includes(s)) || "";
    const set = short.replace(new RegExp("_?(" + SLOTS.join("|") + ")$"), "") || short;
    attachables.push({ id: d.identifier, name: nameOf("item", d.identifier), slot, set, setName: nice(set), group: group(f, RP + "attachables/"), file: f, ref: layer.get(f).ref, ...variants(d) });
  }

  // custom blocks
  const terrain = (await json(RP + "textures/terrain_texture.json"))?.texture_data || {};
  const blocksJson = (await json(RP + "blocks.json")) || {};
  const terrainTex = (name) => {
    let t = terrain[name]?.textures;
    if (Array.isArray(t)) t = t[0];
    if (t && typeof t === "object") t = t.path;
    return t ? texFile(t) : { url: null, missing: name };
  };
  const blocks = [];
  for (const f of under(BPB)) {
    const doc = await json(f), b = doc?.["minecraft:block"];
    if (!b?.description?.identifier) continue;
    const id = b.description.identifier;
    const comps = [b.components || {}, ...(b.permutations || []).map((p) => p.components || {})];
    const g = comps.map((c) => c["minecraft:geometry"]).find(Boolean);
    const geoId = typeof g === "string" ? g : g?.identifier;
    const mats = comps.map((c) => c["minecraft:material_instances"]).find(Boolean);
    const faces = {};
    if (mats) for (const [face, m] of Object.entries(mats)) { if (m?.texture) faces[face] = { name: m.texture, ...terrainTex(m.texture) }; }
    else {
      const bj = blocksJson[id]?.textures;
      if (typeof bj === "string") faces["*"] = { name: bj, ...terrainTex(bj) };
      else if (bj) for (const [face, n] of Object.entries(bj)) faces[face === "side" ? "*" : face] = { name: n, ...terrainTex(n) };
    }
    // shown in each state's first value (how it sits in the creative menu); bone_visibility is worked out from that
    const states = Object.fromEntries(Object.entries(b.description.states || {}).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v?.values?.min ?? 0]));
    blocks.push({ id, name: nameOf("tile", id), group: group(f, BPB), file: f, ref: layer.get(f).ref,
      geometry: geoId && !geoId.startsWith("minecraft:geometry.full_block") ? geoId : null, faces,
      boneVisibility: (typeof g === "object" && g?.bone_visibility) || null, states });
  }

  // item icons
  const itemTex = (await json(RP + "textures/item_texture.json"))?.texture_data || {};
  const items = Object.entries(itemTex).map(([name, v]) => {
    let t = v.textures; if (Array.isArray(t)) t = t[0]; if (t && typeof t === "object") t = t.path;
    return { name, ...texFile(t) };
  });

  // every texture file, by folder
  const textures = files.filter((f) => f.startsWith(RP + "textures/") && /\.(png|tga)$/i.test(f))
    .map((f) => ({ path: f.slice(RP.length), url: "/pack/" + f, ref: layer.get(f).ref }));

  // send only the geometries something uses (and anything the pack defines itself)
  const used = new Set([...entities, ...attachables].flatMap((e) => e.geometry.map((g) => g.id)).concat(blocks.map((b) => b.geometry).filter(Boolean)));
  for (const [id, from] of Object.entries(geoFrom)) if (from !== "vanilla") used.add(id);
  const geometry = {};
  for (const id of used) { const g = geo(id); if (g) geometry[id] = { ...g, from: geoFrom[id] }; }
  // the plain player body, to wear armour on
  const body = geo("geometry.humanoid.custom") || geo("geometry.humanoid");
  if (body) geometry["geometry.humanoid.custom"] = { ...body, from: geoFrom["geometry.humanoid.custom"] || "vanilla" };

  return { entities, attachables, blocks, items, textures, geometry, errors, vanilla: vanilla.ready };
}
