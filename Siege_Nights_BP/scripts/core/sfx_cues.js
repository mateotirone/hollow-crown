// What each sound is made of. Read by core/sfx.js; listed for Mateo in SOUND-LIST.md
// (node tools/sound-list.mjs rewrites that file from this table and studio/sounds/signature.json).
//
// A layer is [vanilla sound id, pitch, volume, delay in ticks]. Layers play together; the pitch and
// volume the caller passes multiply every layer. `drift` is how far the whole cue may wander in pitch
// from one play to the next (default 0.04, so nothing is heard twice exactly the same).
// `custom` names the recording that replaces the layers once it is installed.
//
// House style: lower and softer than vanilla, and the bell underneath anything that matters.
// Uneasy, not frightening: nothing here is sudden or loud for its own sake.

const BELL = "block.bell.hit";

// ---------- Signature sounds: stand-ins until Mateo's recordings are installed ----------
const SIGNATURE = {
  "sig.toll_317": { custom: "siege.sig.toll_317", drift: 0.01, what: "The 3:17 toll",
    layers: [[BELL, 0.5, 1], [BELL, 0.375, 0.6, 2], ["ambient.cave", 0.6, 0.35, 8], [BELL, 0.5, 0.4, 44], [BELL, 0.5, 0.15, 88]] },
  "sig.siege_horn": { custom: "siege.sig.siege_horn", drift: 0.03, what: "The siege horn",
    layers: [["raid.horn", 0.7, 1], ["raid.horn", 0.52, 0.6, 7], ["ambient.weather.thunder", 0.5, 0.25, 12]] },
  "sig.rift_open": { custom: "siege.sig.rift_open", what: "The Rift opening", layers: [] }, // stand-in is the stepped tearing in undertow/rift.js
  "sig.hollow_ambience": { custom: "siege.sig.hollow_ambience", what: "The Hollow's ambience (loop)", layers: [] }, // stand-in is the Hollow's own thunder and hum
  "sig.storm_tide": { custom: "siege.sig.storm_tide", what: "A storm tide of the Long Night",
    layers: [["ambient.weather.thunder", 0.55, 0.7], ["raid.horn", 0.5, 0.35, 14], ["ambient.cave", 0.7, 0.4, 30]] },
  "sig.first_glimpse": { custom: "siege.sig.first_glimpse", drift: 0.02, what: "The first glimpse",
    layers: [["ambient.cave", 0.6, 1], ["mob.warden.heartbeat", 0.6, 0.7, 20], ["mob.warden.heartbeat", 0.6, 0.7, 50], [BELL, 0.3, 0.3, 60]] },
  "sig.bell_tongue": { custom: "siege.sig.bell_tongue", drift: 0.02, what: "The Forgemaster's bell-tongue",
    layers: [[BELL, 1.2, 1], [BELL, 0.9, 0.5, 3], ["armor.equip_iron", 0.6, 0.6, 10], ["armor.equip_iron", 0.5, 0.5, 14]] },
  "sig.roll_drum": { custom: "siege.sig.roll_drum", drift: 0.02, what: "The roll of the fallen",
    layers: [["note.bd", 0.5, 1], ["note.bd", 0.45, 0.4, 6]] },
  "sig.forty_row": { custom: "siege.sig.forty_row", drift: 0.02, what: "The forty rowing",
    layers: [["bucket.empty_water", 0.6, 0.5], ["bucket.empty_water", 0.6, 0.5, 30], ["ambient.cave", 0.6, 0.3, 10]] },
  "sig.fen_debt": { custom: "siege.sig.fen_debt", drift: 0.02, what: "The fen collects",
    layers: [["bubble.pop", 0.6, 0.8], ["mob.witch.ambient", 0.6, 0.4, 8], ["bubble.pop", 0.5, 0.6, 16]] },
  "sig.boss.morvane": { custom: "siege.sig.boss.morvane", what: "Morvane",
    layers: [[BELL, 0.4, 0.9], ["mob.wither.spawn", 0.55, 0.5, 6], [BELL, 0.3, 0.5, 30]] },
  "sig.boss.choir": { custom: "siege.sig.boss.choir", what: "The Choir",
    layers: [["siege.choir.hum", 1, 1], ["siege.choir.hum", 1.5, 0.5, 10], [BELL, 0.5, 0.4, 20]] },
  "sig.boss.reeve": { custom: "siege.sig.boss.reeve", what: "The Clockwork Reeve",
    layers: [["random.click", 0.6, 1], ["random.click", 0.6, 1, 10], ["random.click", 0.6, 1, 20], [BELL, 0.8, 0.7, 30], ["random.anvil_land", 0.5, 0.3, 30]] },
  "sig.boss.huntsman": { custom: "siege.sig.boss.huntsman", what: "The Pale Huntsman",
    layers: [["raid.horn", 1.25, 0.5], ["mob.wolf.growl", 0.6, 0.8, 16], ["raid.horn", 0.9, 0.3, 34]] },
  "sig.boss.bride": { custom: "siege.sig.boss.bride", what: "The Drowned Bride",
    layers: [["random.splash", 0.5, 1], [BELL, 0.7, 0.5, 8], [BELL, 0.66, 0.4, 24], ["mob.guardian.ambient", 0.5, 0.5, 14]] },
  "sig.boss.seneschal": { custom: "siege.sig.boss.seneschal", what: "The Ash Seneschal",
    layers: [["item.shield.block", 0.5, 1], ["random.anvil_land", 0.45, 0.5, 4], ["dig.sand", 0.5, 1, 12], ["mob.wither.ambient", 0.5, 0.3, 16]] },
  "sig.boss.mother": { custom: "siege.sig.boss.mother", what: "The Mother of Changelings",
    layers: [["note.flute", 0.6, 0.8], ["note.flute", 0.71, 0.7, 8], ["note.flute", 0.56, 0.7, 18], ["mob.witch.celebrate", 0.5, 0.35, 26]] },
  "sig.boss.warlord_king": { custom: "siege.sig.boss.warlord_king", what: "The Warlord King",
    layers: [["raid.horn", 0.6, 1], ["mob.ravager.roar", 0.6, 0.6, 10], [BELL, 0.45, 0.6, 22], ["raid.horn", 0.45, 0.5, 26]] },
};

// ---------- Named cues that are not recordings ----------
const NAMED = {
  "boss.arrive": { what: "A boss steps out (when it has no sound of its own)", layers: [["mob.wither.spawn", 0.6, 0.5], [BELL, 0.4, 0.5, 8]] },
  "boss.warn": { what: "A boss is about to do something", drift: 0.06, layers: [["note.didgeridoo", 0.7, 0.9], [BELL, 1.2, 0.25, 1]] },
  "horn.assault": { what: "Another assault is coming", layers: [["raid.horn", 0.85, 0.8], ["raid.horn", 0.64, 0.35, 5]] },
};

// ---------- Vanilla sounds, reworked wherever the scripts play them ----------
const REWORKED = {
  // the bell is the game's voice: an undertone an octave down and a slightly sour double
  [BELL]: { what: "Any bell", drift: 0.015, layers: [[BELL, 1, 1], [BELL, 0.5, 0.4, 1], [BELL, 1.03, 0.22, 3]] },
  "raid.horn": { what: "A horn", layers: [["raid.horn", 0.85, 1], ["raid.horn", 0.64, 0.4, 5]] },

  // menus and rewards: quieter and lower, so the world stays the loudest thing
  "random.levelup": { what: "Done, bought, learned", layers: [["random.levelup", 0.8, 0.5], ["note.harp", 0.6, 0.35, 2]] },
  "random.orb": { what: "A small yes", drift: 0.08, layers: [["random.orb", 0.75, 0.55]] },
  "random.toast": { what: "A note is added", layers: [["random.toast", 0.8, 0.7]] },
  "random.pop": { what: "A small pop", drift: 0.08, layers: [["random.pop", 0.85, 0.7]] },
  "random.click": { what: "A catch or a lever", drift: 0.06, layers: [["random.click", 0.85, 0.8]] },
  "random.break": { what: "Not allowed, or something gave way", drift: 0.06, layers: [["random.break", 0.8, 0.7]] },
  "ui.toast.challenge_complete": { what: "Something earned", layers: [["ui.toast.challenge_complete", 0.9, 0.7], [BELL, 0.6, 0.3, 8]] },
  "random.totem": { what: "A great change", layers: [["random.totem", 0.8, 0.55], [BELL, 0.5, 0.4, 4]] },
  "item.book.page_turn": { what: "A page", drift: 0.1, layers: [["item.book.page_turn", 0.9, 1]] },

  // work
  "random.anvil_use": { what: "Building and mending", drift: 0.08, layers: [["random.anvil_use", 0.8, 0.55], ["dig.stone", 0.7, 0.5, 2]] },
  "random.anvil_land": { what: "A heavy blow", drift: 0.06, layers: [["random.anvil_land", 0.9, 0.8], ["dig.stone", 0.5, 0.7]] },
  "dig.stone": { what: "Stone moving", drift: 0.1, layers: [["dig.stone", 0.9, 1]] },
  "random.explode": { what: "A blast", drift: 0.08, layers: [["random.explode", 0.85, 1]] },
  "random.glass": { what: "Something breaks that should not", drift: 0.08, layers: [["random.glass", 0.9, 0.8]] },

  // the Hollow and its people
  "ambient.cave": { what: "Something is wrong", drift: 0.1, layers: [["ambient.cave", 0.85, 0.8]] },
  "ambient.weather.thunder": { what: "Thunder with no sky", drift: 0.1, layers: [["ambient.weather.thunder", 0.9, 0.9]] },
  "mob.wither.spawn": { what: "Something old arrives", layers: [["mob.wither.spawn", 0.85, 0.7], [BELL, 0.4, 0.4, 8]] },
  "mob.wither.ambient": { what: "A breath from below", drift: 0.08, layers: [["mob.wither.ambient", 0.9, 0.8]] },
  "mob.wither.death": { what: "Something great ends", layers: [["mob.wither.death", 0.9, 0.8], [BELL, 0.35, 0.5, 12]] },
  "mob.endermen.portal": { what: "A step between places", drift: 0.08, layers: [["mob.endermen.portal", 0.85, 0.8], ["random.orb", 0.4, 0.15, 2]] },
  "portal.travel": { what: "The Hollow pulling", layers: [["portal.travel", 0.9, 1]] },
  "mob.warden.heartbeat": { what: "A heartbeat that is not yours", drift: 0.02, layers: [["mob.warden.heartbeat", 0.9, 1]] },
  "mob.ravager.roar": { what: "Something big", drift: 0.08, layers: [["mob.ravager.roar", 0.9, 0.9]] },
};

export const CUES = { ...SIGNATURE, ...NAMED, ...REWORKED };
export const SIGNATURE_CUES = Object.keys(SIGNATURE);
export const NAMED_CUES = Object.keys(NAMED);
export const REWORKED_IDS = Object.keys(REWORKED);
