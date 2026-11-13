// Small English helpers for chat lines. Pure (loads in Node).
//
// "a Ash Scarab" in the first map playtest (Mateo, 2026-11-13): every line that puts "a" in front of a name
// from data (a creature, a role, a breed) goes through here instead.

// Words that start with a vowel letter but a consonant sound ("a unicorn", "a one-eyed..."), and the other way ("an hour")
const VOWEL_LETTER_CONSONANT_SOUND = /^(uni|use|usu|ure|uro|eu|ewe|one\b|once\b|ouija)/i;
const SILENT_H = /^(hour|honou?r|honest|heir)/i;

// "a" or "an" for the word that follows
export function aOrAn(word) {
  const w = String(word ?? "").replace(/§./g, "").trim();
  if (!w) return "a";
  if (SILENT_H.test(w)) return "an";
  if (VOWEL_LETTER_CONSONANT_SOUND.test(w)) return "a";
  return /^[aeiou]/i.test(w) ? "an" : "a";
}

// A name with the right article in front: "an Ash Scarab", "a Grey Axeman", "The Pale Huntsman" (kept),
// "Ulfa, the Bell-Wife" (a person's name: no article)
export function withArticle(name) {
  const n = String(name ?? "").trim();
  if (!n) return n;
  const plain = n.replace(/§./g, "");
  if (/^(the|a|an) /i.test(plain) || plain.includes(", ")) return n;
  return `${aOrAn(plain)} ${n}`;
}
