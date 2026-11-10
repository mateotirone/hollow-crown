# Builds the Bestiary page (bestiary.html) Mateo reads: every mob and boss with a preview, its job and its loot.
import base64, io, os, sys, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import roster, items, render
E = html.escape
TRICK = {
 "hollow_footman": "The rank and file. Nothing special, lots of them.", "bell_ringer": "Every 3 seconds its bell gives raiders within 10 blocks Speed and Strength. Runs from you.",
 "shieldwall_brute": "Takes a quarter damage from arrows. Slow, hits like a cart.", "torchbearer": "Lights wooden blocks it walks past and sets you on fire. Immune to fire.",
 "siege_ogre": "Replaces the ravager as the battering ram: its walk cracks walls. 120 health.", "crow_mage": "Throws blinding bolts from range and summons Bellcrows (they fade after 30 seconds).",
 "lost_villager": "Frozen while you look at it. Look away and it steps closer. If it reaches you unseen it strikes and the world goes dark.",
 "changeling": "Looks like a villager until you turn your back within 5 blocks, or hit it. Then it shows its real face.",
 "wrongling": "Only moves when nobody is looking. While watched it's frozen and takes a quarter damage. Fast and brutal the moment you blink.",
 "stone_vigil": "A winged stone mourner. While anyone is looking at it, it's a statue and only a pickaxe can chip it. Look away, or get blinded, and it crosses the room. Its touch throws you somewhere else nearby, in the dark, away from your friends.",
 "seep": "Not a mob: a crack where the Hollow pushes through. One opens somewhere near a player every so often, day or night, alone or with friends. Things from the Hollow climb out of it. Kill its guards, then break it to close it. Ignore it and it widens, then splits.",
 "champion_knight": "Sword up close, bow at range. Raises a shield in cycles (an axe breaks it for 5 seconds). Strafes, hops back after a hit, drinks a potion when low (hit them mid-drink to spoil it), pearls after you if you run. War-cry and shield bash.",
 "champion_sorcerer": "Keeps its distance and throws Veilbolts that lead your movement. Marks the ground under you: two seconds to move. Blinks away when cornered. Drinks potions too.",
 "champion_lord": "Everything the Rival Knight does with more health, and calls two Retainers at 65% and again at 30%.",
 "champion_retainer": "A lord's man-at-arms: shield cycles and strafing, no bow and no potions. The rank and file of an NPC army.",
 "gloamwing": "A ray-shaped flyer that lives in the Hollow's fog. Stay in the Hollow five minutes and the first one finds you; another joins every two minutes, up to six. They swoop, hit lightly and wheel away. Leave and they give up. Each drops a Gloamquill.",
 "echo_hound": "Blind. Tracks Marked players with loud Resonance from 64 blocks away, in pairs.", "mirror_knight": "Learns your last attack type: sword it and swords stop working, shoot it and arrows do. Alternate.",
 "tolling_shade": "Floats. Every 5 seconds its bell slows you and darkens your screen.", "frost_stag": "Peaceful until hit. Drops Pale Antler for horse gear.",
 "rimewolf": "Pack hunter. Bites slow you.", "brine_lurker": "Amphibious ambusher. Bites slow you and drag you down in water.", "ash_scarab": "Swarms of 4 to 7. Bites set you alight.",
 "dune_wyrm": "Feels footsteps: keep moving and it erupts under you. Stand still or sneak and it loses you. 90 health.", "bog_hag": "Throws poison and lays hexes (weakness, hunger, nausea).",
 "mire_toad": "Tongue yanks you in from 6 blocks. Punching it poisons you.", "barrow_wight": "Heals with every hit it lands. Burns in daylight.",
 "ashen_squire": "Fights monsters. Attacks only Marked players or anyone who attacks the Order.", "ashen_knight": "Same loyalties as the Squire, with plate that halves arrow damage.",
 "inquisitor": "Crossbow. Marked players within 10 blocks are silenced (no spells).", "hollow_warlord": "Named warlords now use this body instead of a vindicator.",
}
FAMS = [("NPC fighters", "Stand-ins for other players when you play alone or a seat is empty: rival lords, their armies, an NPC ruler's champions. They come in five tiers and get tougher per extra player nearby. They can be allies, neutral or enemies. They can't place or break blocks.", ["champion_knight", "champion_sorcerer", "champion_lord", "champion_retainer"]),
        ("Choir-called raiders", "Take over your sieges: 15% of the army from your 3rd siege, 15% more each siege after, up to 85%.", ["hollow_footman", "bell_ringer", "shieldwall_brute", "torchbearer", "siege_ogre", "crow_mage", "hollow_warlord"]),
        ("Things from the Hollow", "Walk the night after the first boss falls anywhere, and haunt the Hollow (the world below). This is where the unease lives.", ["lost_villager", "changeling", "wrongling", "stone_vigil", "echo_hound", "mirror_knight", "tolling_shade", "gloamwing", "seep"]),
        ("Regional beasts", "Spawn naturally in their region's biomes.", ["barrow_wight", "frost_stag", "rimewolf", "brine_lurker", "ash_scarab", "dune_wyrm", "bog_hag", "mire_toad"]),
        ("Order of the Ashen Gate", "Friend to Knights, enemy to the Marked. Placed at outposts by the map, not spawned.", ["ashen_squire", "ashen_knight", "inquisitor"])]
BOSS = {
 "clockwork_reeve": ("Stopped Clock Key", ["Time-stop: the clock strikes and lit tiles appear. Anyone not standing on one is frozen for 4 seconds and hurt.", "At 60% health his gears fly apart into three Cogs. He can't be hurt until all three are scrap.", "At 30% he's overwound: faster, and the clock strikes more often."], "Minute Hand: a sword whose hits slow time around the target."),
 "pale_huntsman": ("Pale Horn", ["He vanishes into the blizzard for 7 seconds at a time. Only his breath shows.", "Marked shot: he picks a player; get a wall between you in 2.5 seconds or take 6 hearts.", "At 60% Rimewolves join. At 25% he plants three Rime Pillars and is untouchable until you break them all, then he's stunned for 8 seconds."], "Rimefang Bow: arrows root targets in ice."),
 "drowned_bride": ("Drowned Wedding Ring", ["A Tide meter climbs all fight, faster each phase: slowed at 40%, crippled at 70%, drowning at 100%.", "Strike all three Chapel Bells within 10 seconds of each other to turn the tide back to zero.", "She wails to drag you in, hands grab from the water, drowned climb out. At high tide in the last phase she heals."], "Widow's Veil: breathe water, see in the dark, and see Hollow things marked (it also reveals the real Mother)."),
 "ash_seneschal": ("Faceless Seal", ["Every 15 seconds he studies what hurt him most. Blades: he shrugs off 65% of melee and answers with cleaves. Arrows: 85% of arrow damage gone and he rains volleys.", "So you have to switch weapons mid-fight, or split the party.", "At 50% patches of sand give way: get out before they drop."], "Seneschal's Greatshield (sneak with it in your offhand to brace and throw attackers back) and a Faceless Crown Shard."),
 "mother_of_changelings": ("Mire Effigy", ["She hides among 5 to 8 copies of herself. Hit the real one to stun her. Hit a copy and it bursts into poison and a Changeling.", "Take over 25 seconds and she heals and poisons everyone.", "The real one sheds a faint spore. Echo Sight, her true name or the Widow's Veil lights her up for that player only."], "Mire Heart: an offhand charm that heals you with every hit at night."),
 "warlord_king": ("the Grand Siege", ["Rides in on a Siege Ogre, taking far less damage while it lives.", "At 66% he fights on foot: shard lances to sidestep, and the shard in his iron crown tolls up more Footmen and a Bell-Ringer.", "At 30% the shard strikes the ground. Be in the air when it lands."], "The Warlord's Brand: sets foes alight, and every fifth hit is a shockwave."),
 "oswin_the_last": ("the Drowned Court, deep in the Hollow", ["A duel. When he raises his guard, don't swing: it comes straight back at you and heals him.", "At 66% and 33% the hall lurches and something steps out of him. You're thrown across the hall and must beat it before he can be hurt again.", "Last phase: a toll goes through the hall. Only the quiet tiles are safe."], "Knights get the Oath of Oswin (executes weak foes, rallies guards). The Marked get the Crownless Mantle (one hit in five passes through you)."),
}
def img(m, size=220):
    b = io.BytesIO(); render.render(m, size).save(b, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()
by = {m["id"]: m for m in roster.MOBS}
def card(i):
    m = by[i]; dmg = f' · {m["dmg"] / 2:g} hearts a hit' if m.get("dmg") else ""
    return f'<article class="mob"><img src="{img(m, 160)}" alt="{E(m["name"])}" width="160" height="160"><div><h3>{E(m["name"])}</h3><p class="stat">{m["hp"] // 2} hearts{dmg}{" · " + E(m["region"]) if m.get("region") else ""}</p><p class="lore">{E(m["lore"])}</p><p>{E(TRICK[i])}</p></div></article>'
out = [open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "page_head.html")).read()]
out.append('<section><h2>The seven bosses</h2><p class="lede">Each has a boss bar, phases, attacks that warn you before they land, and something you have to work out. Everyone who fought gets the named relic the first time they win, plus 5 skill points; a vault chest with the shared hoard appears where the boss fell. Walk away for 30 seconds and the fight resets.</p>')
for b in roster.BOSSES:
    key, beats, loot = BOSS[b["id"]]
    out.append(f'<article class="boss"><img src="{img(b, 220)}" alt="{E(b["name"])}" width="220" height="220"><div><p class="eyebrow">{E(b["region"])} · {b["hp"] // 2} hearts</p><h3>{E(b["name"])}</h3><p class="lore">{E(b["lore"])}</p><ul>{"".join(f"<li>{E(x)}</li>" for x in beats)}</ul><p class="loot"><b>Relic</b> {E(loot)}</p><p class="stat">Starts with: {E(key)}</p></div></article>')
out.append('<p class="note">The eighth boss, the Choir, is being built with the Hollow (the world below) on this same fight framework.</p></section>')
for name, blurb, ids in FAMS:
    out.append(f'<section><h2>{E(name)}</h2><p class="lede">{E(blurb)}</p><div class="grid">{"".join(card(i) for i in ids)}</div></section>')
out.append('''<section><h2>Try them</h2><ol class="steps"><li>In a flat creative world, type <code>/scriptevent siege:showcase</code>. Every mob and boss stands behind you as a labelled statue that can't move or fight, so you can walk around and look.</li><li>To fight one for real, use its spawn egg.</li><li>Place a boss egg on open flat ground and the fight starts where it stands. Or hold a boss key and use it.</li><li>Other features can start a fight with <code>/scriptevent siege:bestiary_summon reeve</code> (also huntsman, bride, seneschal, mother, warlord_king, oswin).</li></ol>
<h2>What is still placeholder</h2><ul class="steps"><li>Every skin is a flat-colour placeholder on a box model. All of them are on the texture list for the one big art pass.</li><li>Nothing here has been run inside Minecraft yet. It passes the offline checks, and the first in-game session will turn up things to fix.</li><li>Fights use marked circles and props instead of changing blocks, so they work anywhere. When the map has real arenas (a chapel that floods, a frozen lake) they can use them.</li></ul></section></main>''')
open(sys.argv[1], "w").write("\n".join(out))
print(os.path.getsize(sys.argv[1]) // 1024, "KB")
