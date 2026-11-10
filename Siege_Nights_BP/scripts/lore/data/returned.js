// The hidden Returned: four cases where a family asks the player to find out. Words and truth only.
// The mobs feature owns the villagers themselves (an ordinary-looking villager who shows the tells);
// the askers are story characters in data/dialogue.js. Not every suspect is a copy.
//
// The tells (same in every tome): uses the WRONG HAND; FACES THE WALL when it thinks it is alone,
// toward wherever the Hollow is seeping in nearest; cannot bear a BELL (ring one near it and it walks
// "home" to the nearest water or thin place and is gone); DOGS do not know it. A copy does not know
// it is a copy. A fifth tell, once the sound exists: a faint hum of the Choir's one note.
//
// For each case:
//   suspect      who the player is asked to watch (name shown over the villager)
//   returned     the truth about the suspect
//   show         which tells that villager should show: "hand" "wall" "bell" "dog"
//   bell         what happens / is said if the player rings a bell beside them
//   flags        what the asker's conversation sets (lore progress flags)

export const TELLS = {
  // TESTIMONY ONLY: a vanilla villager cannot show a hand, so this one is never seen, only told by the family
  hand: "Uses the wrong hand. The family says so; the player cannot see it on a villager.",
  wall: "When no player within 48 blocks is looking at it, it stops and stands facing the Hollow (the Gate, or west).",
  bell: "Cannot bear bells. If a bell is rung within 16 blocks it stops, turns toward the Hollow and walks, and may take up to two nearby villagers with it.",
  hum: "Stand within 6 blocks and listen: a faint held note (lore/singing.js). Louder for a Sorcerer.",
  dog: "Tamed wolves within 8 blocks growl.",
};

export const CASES = [
  {
    id: "harl", village: "Millbrook", asker: "nessa", suspect: "Harl Dunn", job: "baker",
    returned: true, show: ["hand", "wall", "bell"],
    truth: "A copy. The real Harl was taken on the flour road four nights ago. He is kind, remembers his wife's name-day for the first time in nineteen years, and has taken the bell off the shop door.",
    bell: "He sets down the loaf, says \"Nessa? I think I left something at the well,\" and walks to it. He does not come back up.",
    flags: { right: "case_harl_right", wrong: "case_harl_wrong" },
  },
  {
    id: "bram", village: "Rimehold", asker: "jorund", suspect: "Bram Kell", job: "fisherman",
    returned: false, show: ["hand", "wall"],
    truth: "Himself. He went through the ice and it took the use of his right arm; his eyes are failing, so he sits facing the wall where the lamp hook is. His dog sleeps on his feet and he rings the dawn bell himself. The lesson: two tells are not proof, and fear does the Hollow's work for it.",
    bell: "He claps his good hand over his ear and says, \"What in the cold hells are you doing, child?\" Nothing else happens.",
    flags: { right: "case_bram_right", wrong: "case_bram_wrong" },
  },
  {
    id: "pip", village: "Gull's Rest", asker: "tilly", suspect: "Pip Marsh", job: "child",
    returned: true, show: ["hand", "wall", "bell", "dog"],
    truth: "A copy, and his sister Tilly, twelve, already knows. Their mother is happy again. Tilly asks the player to say nothing. There is no right answer: both choices are rewarded the same.",
    bell: "He looks at Tilly, says \"I have to go in now,\" and walks into the sea. Tilly does not speak to the player again.",
    flags: { kept: "case_pip_kept", told: "case_pip_told" },
  },
  {
    id: "hesper", village: "Mirelight", asker: "hesper", suspect: "Odo Lowe", job: "reed cutter",
    returned: false, show: [],
    truth: "Odo is himself. The copy is HESPER, the woman who asked. She holds her cup in her left hand, stands turned to the door-post, cannot bear the bell her husband rings each evening to test her, and her own dog growls at her. She does not know. The player solves it by looking at the asker instead of the suspect.",
    askerShows: ["hand", "wall", "bell", "dog"],
    bell: "Odo only takes off his cap. Rung beside Hesper: she says \"Oh. It's time, is it,\" sets the cup down with her left hand, and walks into the fen.",
    flags: { right: "case_hesper_right", other: "case_hesper_done", blamedOdo: "case_hesper_blamed_odo" },
  },
];
