// Numbers and wording for Discord alerts (dispatch/index.js). Plain words only: colour codes are stripped.
// Every line must still read well when a name is missing (a self-test checks).

const who = (name, fallback = "Someone") => name || fallback;
const TIERS = { 1: "a Hamlet", 2: "a Town", 3: "a City", 4: "a Castle" };

export const DISPATCH = {
  queueSize: 40, // alerts kept for the relay; older ones drop off
  holderTag: "siege_template_holder", // set by undertow/forge.js on whoever carries the Choirsteel template
  vaultOpenHours: 24, // real hours a template holder can be away before everyone is told
  warnHoursBefore: 2, // ping the holder this long before (0 = no warning)

  text: {
    siegeStart: () => "Siege night. Raiders are marching on the settlements.",
    siegeEnd: (count) => (count > 0 ? `Dawn. The siege is over; ${count} settlement${count === 1 ? " was" : "s were"} attacked.` : "Dawn. The siege is over."),
    keepFallen: (name) => `${who(name, "A lord")}'s Keep has fallen.`,
    keepFounded: (name) => `A new banner rises: ${who(name)} has founded a settlement.`,
    tierUp: (name, tier) => `${who(name, "A lord")}'s settlement has grown into ${TIERS[tier] ?? "something greater"}.`,
    rivalMarch: (lord, name) => `${lord || "A Rival Lord"} is marching on ${name ? `${name}'s` : "a"} settlement.`,
    crowned: (name) => `${who(name)} has been crowned at the Citadel.`,
    crownVacant: () => "The throne stands empty.",
    stormStart: () => "A claimant has thrown down the Gauntlet. The Citadel is under challenge.",
    stormEnd: (name, usurped) => (usurped ? `The throne has been taken. ${who(name)} rules now.` : `The challenge failed. ${who(name, "The ruler")} keeps the throne.`),
    templateTaken: () => "Someone has taken the Choirsteel template from the Cold Forge.",
    dragonDied: (name) => `Your dragon${name ? ` ${name}` : ""} has fallen.`,
    hollowRobbery: (name, village) => `${who(name)} has robbed ${village ? village : "a mining village"} in the Hollow.`,
    vaultWarning: (name, hours) => `${who(name, "You")}: you have been away with the Choirsteel template a long while. In ${hours || "a few"} hours everyone will be told.`,
    vaultOpen: (name) => `${who(name)} has been gone a full day with the Choirsteel template. Their vault is open.`,
    vaultClosed: (name) => `${who(name)} is back. Their vault is guarded again.`,
  },
};
