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
  // The rest of the Rift's sounds (recordings from the sounds thread; the layers are the stand-ins until they are installed).
  "sig.rift_answer": { custom: "siege.sig.rift_answer", what: "The rock answering the Tuning Fork", layers: [["resonate.amethyst_block", 2, 0.35]] },
  "sig.rift_stir": { custom: "siege.sig.rift_stir", drift: 0.05, what: "The rock stirring before the Rift tears",
    layers: [["chime.amethyst_block", 1.2, 0.55], [BELL, 0.6, 0.3, 4]] },
  "sig.rift_hush": { custom: "siege.sig.rift_hush", what: "The hush before the tear", layers: [["resonate.amethyst_block", 0.5, 0.3]] },
  "sig.rift_breath": { custom: "siege.sig.rift_breath", what: "The Rift's first breath", layers: [["ambient.cave", 2, 0.6]] },
  "sig.rift_loop": { custom: "siege.sig.rift_loop", what: "The open Rift at rest (loop)", layers: [] }, // not played yet
  "sig.rift_refuse": { custom: "siege.sig.rift_refuse", what: "The veil turning a player back", layers: [["resonate.amethyst_block", 1.2, 0.4]] },
  "sig.rift_cross": { custom: "siege.sig.rift_cross", what: "Stepping through the Rift", layers: [["ambient.cave", 1, 0.5]] },
  "sig.seep_creep": { custom: "siege.sig.seep_creep", drift: 0.06, what: "A seep vein growing", layers: [] }, // not played yet
  "sig.thin_draught": { custom: "siege.sig.thin_draught", drift: 0.04, what: "The draught at a thin place", layers: [] }, // not played yet
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
  // gates and portcullises (Mateo, 2026-11-12: "custom sounds for the gate and portcullis, opening and closing")
  "sig.gate_open": { custom: "siege.sig.gate_open", what: "The castle gate opens",
    layers: [["random.door_open", 0.5, 1], ["hit.wood", 0.5, 0.6, 2], ["random.wood_click", 0.5, 0.5, 12]] },
  "sig.gate_close": { custom: "siege.sig.gate_close", what: "The castle gate shuts",
    layers: [["random.door_close", 0.5, 1], ["hit.wood", 0.45, 0.7, 2], ["random.anvil_land", 0.6, 0.25, 2]] },
  "sig.portcullis_open": { custom: "siege.sig.portcullis_open", what: "The portcullis rises",
    layers: [["hit.chain", 0.6, 0.8], ["step.chain", 0.5, 0.8, 4], ["hit.chain", 0.55, 0.8, 8], ["step.chain", 0.5, 0.8, 12], ["random.click", 0.5, 0.6, 20]] },
  "sig.portcullis_close": { custom: "siege.sig.portcullis_close", what: "The portcullis drops",
    layers: [["hit.chain", 0.8, 0.8], ["step.chain", 0.7, 0.8, 2], ["random.anvil_land", 0.5, 0.6, 8], ["dig.stone", 0.5, 0.8, 8]] },
  // the arena crowd (arena/crowd.js): only heard while a fight is on
  "sig.crowd_murmur": { custom: "siege.sig.crowd_murmur", drift: 0.02, what: "The arena crowd talking among itself (loop)",
    layers: [["mob.villager.idle", 0.7, 0.25], ["mob.villager.haggle", 0.6, 0.2, 30], ["mob.villager.idle", 0.8, 0.2, 70], ["mob.villager.yes", 0.65, 0.2, 110]] },
  "sig.crowd_cheer": { custom: "siege.sig.crowd_cheer", drift: 0.05, what: "The arena crowd cheers",
    layers: [["mob.pillager.celebrate", 0.8, 0.8], ["mob.villager.yes", 0.7, 0.6, 3], ["mob.pillager.celebrate", 0.65, 0.6, 8], ["mob.villager.yes", 0.9, 0.5, 12]] },
  "sig.crowd_groan": { custom: "siege.sig.crowd_groan", drift: 0.05, what: "The arena crowd groans as a fighter falls",
    layers: [["mob.villager.no", 0.6, 0.8], ["mob.villager.no", 0.5, 0.6, 4], ["mob.villager.idle", 0.5, 0.4, 10]] },
  "sig.arena_fanfare": { custom: "siege.sig.arena_fanfare", what: "Horns as the arena gates lift, or for the winner",
    layers: [["raid.horn", 1.2, 0.5], ["note.trumpet", 1, 0.6, 6], ["note.trumpet", 1.26, 0.6, 12], ["note.trumpet", 1.5, 0.7, 18]] },
};

// ---------- Named cues that are not recordings ----------
const NAMED = {
  "boss.arrive": { what: "A boss steps out (when it has no sound of its own)", layers: [["mob.wither.spawn", 0.6, 0.5], [BELL, 0.4, 0.5, 8]] },
  "boss.warn": { what: "A boss is about to do something", drift: 0.06, layers: [["note.didgeridoo", 0.7, 0.9], [BELL, 1.2, 0.25, 1]] },
  // the Sorcerer's powers (townhall/marked_fx.js): each one its own sound, the bell somewhere under it
  "cast.bolt": { what: "Ember Bolt", drift: 0.06, layers: [["item.trident.throw", 0.8, 0.6], ["mob.blaze.shoot", 1.3, 0.35], [BELL, 1.8, 0.15, 1]] },
  "cast.hit": { what: "Ember Bolt lands", drift: 0.08, layers: [["mob.blaze.hit", 0.7, 0.4], [BELL, 1.5, 0.12]] },
  "cast.ward": { what: "Ward", drift: 0.04, layers: [["chime.amethyst_block", 0.7, 0.9], ["beacon.activate", 1.4, 0.35], [BELL, 1.2, 0.2, 3]] },
  "cast.blink": { what: "Blink", drift: 0.06, layers: [["mob.endermen.portal", 1.2, 0.5], ["chime.amethyst_block", 1.6, 0.4], ["random.orb", 0.5, 0.15, 1]] },
  "cast.echo": { what: "Echo Sight", drift: 0.03, layers: [["chime.amethyst_block", 0.5, 0.8], [BELL, 0.5, 0.35, 4], [BELL, 0.5, 0.12, 14]] },
  "cast.bind": { what: "Bind", drift: 0.05, layers: [["place.chain", 0.6, 1.2], ["place.chain", 0.45, 0.8, 3], ["random.anvil_land", 1.8, 0.12, 4]] },
  "cast.step": { what: "Halfstep", drift: 0.05, layers: [["portal.travel", 2, 0.12], ["mob.endermen.portal", 0.6, 0.3, 1], ["chime.amethyst_block", 0.6, 0.3, 2]] },
  "cast.hollowstep": { what: "Veilstep", drift: 0.03, layers: [["portal.travel", 0.6, 0.2], ["mob.warden.heartbeat", 0.8, 0.8, 4], [BELL, 0.35, 0.5, 8]] },
  "cast.choir": { what: "Choir's Call", drift: 0.02, layers: [[BELL, 0.4, 1], [BELL, 0.3, 0.6, 3], ["ambient.cave", 0.7, 0.3, 6]] },
  "cast.crescendo": { what: "A Crescendo begins", drift: 0.02, layers: [[BELL, 1.6, 0.8], [BELL, 1.2, 0.5, 2], ["chime.amethyst_block", 1.0, 0.6, 4]] },
  "cast.overwhelmed": { what: "The Choir is too loud", drift: 0.04, layers: [["mob.warden.sonic_boom", 0.7, 0.35], [BELL, 0.3, 0.5, 4]] },
  "cast.open": { what: "The magic hotbar opens", drift: 0.06, layers: [["chime.amethyst_block", 1.2, 0.5], ["item.book.page_turn", 0.7, 0.4, 1]] },
  "cast.close": { what: "The magic hotbar closes", drift: 0.06, layers: [["chime.amethyst_block", 0.8, 0.4], ["item.book.page_turn", 0.6, 0.4, 1]] },
  "horn.assault": { what: "Another assault is coming", layers: [["raid.horn", 0.85, 0.8], ["raid.horn", 0.64, 0.35, 5]] },
  // each region's weather (weather/): low, far off, never sudden
  "wx.gust": { what: "A gust of wind", drift: 0.12, layers: [["elytra.loop", 0.55, 0.35], ["ambient.weather.rain", 0.5, 0.15, 6]] },
  "wx.spray": { what: "Sea spray on the wind", drift: 0.1, layers: [["random.splash", 0.6, 0.25], ["ambient.weather.rain", 0.8, 0.2, 2]] },
  "wx.buoy_bell": { what: "A bell out in the sea fret", drift: 0.03, layers: [["block.bell.hit", 0.45, 0.22], ["block.bell.hit", 0.42, 0.08, 30]] },
  "wx.drip": { what: "Water dripping in the fog", drift: 0.15, layers: [["cauldron_drip.water.pointed_dripstone", 0.8, 0.5], ["cauldron_drip.water.pointed_dripstone", 0.7, 0.3, 14]] },
  "wx.sand_hiss": { what: "Sand hissing past", drift: 0.1, layers: [["dig.sand", 0.5, 0.3], ["ambient.weather.rain", 1.3, 0.25], ["dig.sand", 0.45, 0.2, 5]] },
  "wx.cold_wind": { what: "Cold wind over snow", drift: 0.1, layers: [["elytra.loop", 0.45, 0.3], ["step.snow", 0.6, 0.15, 10]] },
  "wx.howl": { what: "The blizzard howling", drift: 0.08, layers: [["elytra.loop", 0.4, 0.45], ["mob.wolf.whine", 0.5, 0.06, 12]] },
  "wx.fen_croak": { what: "Something croaking in the fen", drift: 0.15, layers: [["mob.frog.ambient", 0.6, 0.4], ["mob.frog.ambient", 0.5, 0.2, 12]] },
  "wx.fen_splash": { what: "A splash somewhere out on the water", drift: 0.12, layers: [["random.splash", 0.45, 0.2], ["bubble.pop", 0.5, 0.25, 8]] },
  "wx.fen_bell": { what: "A bell under the fen water", drift: 0.02, layers: [["block.bell.hit", 0.32, 0.12], ["bubble.pop", 0.4, 0.2, 10]] },
  "wx.marsh_hum": { what: "A hum where the marsh lights are", drift: 0.05, layers: [["beacon.ambient", 0.5, 0.15], ["chime.amethyst_block", 0.4, 0.1, 20]] },
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
  "ui.toast.challenge_complete": { what: "Something earned (the bell rings three times: Mateo, 2026-11-12)", drift: 0.015,
    layers: [["random.toast", 0.9, 0.7], ["random.levelup", 1.2, 0.25, 2], [BELL, 0.6, 0.45, 8], [BELL, 0.6, 0.4, 28], [BELL, 0.6, 0.35, 48]] },
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

  // Java names that Bedrock does not have: without these lines they played nothing at all.
  // node tools/check.mjs now fails on any sound id the game does not know (tools/vanilla_sounds.json).
  "block.amethyst_block.chime": { what: "A crystal note", drift: 0.06, layers: [["chime.amethyst_block", 1, 1]] },
  "block.amethyst_block.break": { what: "Crystal breaking", drift: 0.06, layers: [["break.amethyst_block", 1, 1]] },
  "block.amethyst_block.resonate": { what: "Crystal humming", drift: 0.04, layers: [["resonate.amethyst_block", 1, 1]] },
  "block.bell.resonate": { what: "A bell still ringing", drift: 0.02, layers: [["resonate.amethyst_block", 0.5, 0.6], [BELL, 0.5, 0.25, 2]] },
  "block.bell.use": { what: "A bell touched", drift: 0.04, layers: [[BELL, 1.2, 0.6]] },
  "dye.use": { what: "Dye on cloth", drift: 0.08, layers: [["sign.dye.use", 1, 1]] },
  "mob.ravager.attack": { what: "A heavy bite", drift: 0.08, layers: [["mob.ravager.bite", 0.9, 0.9]] },
  "mob.wolf.howl": { what: "A howl far off", drift: 0.06, layers: [["mob.wolf.big.whine", 0.6, 0.8], ["mob.wolf.big.whine", 0.5, 0.4, 6]] },
};

export const CUES = { ...SIGNATURE, ...NAMED, ...REWORKED };
export const SIGNATURE_CUES = Object.keys(SIGNATURE);
export const NAMED_CUES = Object.keys(NAMED);
export const REWORKED_IDS = Object.keys(REWORKED);
