// Dumps every pre-designed building in every regional style, block for block, for the Plan Book card pictures,
// with the fingerprint the self-test checks.   node studio/plan_cards/dump.mjs   (studio/build_plans.py runs it)
const S = new URL("../../Siege_Nights_BP/scripts/", import.meta.url).href;
const { planCardCells, planCardsHash, CARD_IDS, CARD_STYLES } = await import(S + "settle/plancards.js");
const out = { styles: CARD_STYLES, buildings: CARD_IDS, cells: {}, hash: planCardsHash() };
for (const style of CARD_STYLES) for (const id of CARD_IDS) out.cells[`${id}@${style}`] = planCardCells(id, style);
process.stdout.write(JSON.stringify(out));
