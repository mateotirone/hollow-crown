"""Siege Nights / Hollow Crown shared palette.

Every texture is painted from these ramps. A ramp is 6 tones, index 0 = deepest shadow / outline,
5 = highlight. Shadows drift cool (toward violet-blue), highlights drift warm (toward straw yellow),
which is what keeps flat 16x16 art from looking grey and muddy.

Regional variants swap the stone / wood / accent / foliage ramps but keep every shape the same,
so one generator can make, for example, Castle Stone for all six regions.
"""
import colorsys

def hx(s):
    s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))

def _toward(h, target, amt):
    d = ((target - h + 0.5) % 1.0) - 0.5
    return (h + d * amt) % 1.0

def ramp(mid, lo=0.14, hi=0.80, n=6, cool=0.10, warm=0.08, sat=1.0, cool_hue=0.70, warm_hue=0.13):
    """Build a hue-shifted ramp around a mid colour. lo/hi are the HLS lightness of the ends."""
    r, g, b = [v / 255 for v in (hx(mid) if isinstance(mid, str) else mid)]
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    out = []
    for i in range(n):
        t = i / (n - 1)
        L = lo + (hi - lo) * t
        if t < 0.5: hh = _toward(h, cool_hue, cool * (0.5 - t) * 2)
        else: hh = _toward(h, warm_hue, warm * (t - 0.5) * 2)
        S = min(1, s * sat * (0.75 + 0.5 * (1 - abs(t - 0.5) * 2)))   # most saturated in the mids
        rr, gg, bb = colorsys.hls_to_rgb(hh, L, S)
        out.append((round(rr * 255), round(gg * 255), round(bb * 255)))
    return out

def fixed(*hexes): return [hx(h) for h in hexes]

# ---------- shared materials (same in every region) ----------
M = {
    # vanilla-matching metals: iron stays vanilla, so its ramp follows vanilla iron's light neutral greys
    'iron':      fixed('#3b3d44', '#5e6168', '#8a8d94', '#b4b6ba', '#d8d8d8', '#f4f2ee'),
    'steel':     fixed('#2f323c', '#4e5360', '#737a88', '#9aa1ae', '#c4cad3', '#e6eaee'),
    'blacksteel':fixed('#17161c', '#24232b', '#33323b', '#46454f', '#5d5c66', '#7a7983'),
    'gold':      fixed('#5a3510', '#8f5a16', '#c48a22', '#e8b83a', '#f8dc6a', '#fff4b8'),
    'diamond':   fixed('#0e3c44', '#14706e', '#2aa8a0', '#4fd8d0', '#a2f2ea', '#e8fffc'),
    'netherite': fixed('#1c171c', '#2c252b', '#3d353c', '#4f464d', '#655b62', '#80767c'),
    'emerald':   fixed('#063d1c', '#0c6a30', '#17a046', '#41cd68', '#8cf0a0', '#d8ffe0'),
    'ruby':      fixed('#3c0610', '#6e0e1c', '#a8182a', '#d83a44', '#f27a78', '#ffd0c8'),
    'oak':       ramp('#9a7248', 0.13, 0.70, cool=0.06, warm=0.05),
    'dark_oak':  ramp('#5c3e26', 0.08, 0.50, cool=0.06),
    'spruce':    ramp('#6c4c30', 0.10, 0.58),
    'leather':   ramp('#8c5832', 0.12, 0.66),
    'parchment': fixed('#6e5a3e', '#a08a62', '#c8b48a', '#e0d0a8', '#f0e6c8', '#fbf6e6'),
    'rope':      ramp('#b49460', 0.18, 0.78),
    'cloth':     fixed('#4a4a4a', '#6c6c6c', '#8e8e8e', '#b0b0b0', '#cfcfcf', '#ececec'),  # grey, gets tinted
    'coal':      fixed('#0f0d10', '#1c181b', '#2a2427', '#3a3236', '#4c4246', '#605458'),
    'flame':     fixed('#7a1a08', '#c23a0c', '#ee6a12', '#fca22a', '#ffd560', '#fff6c0'),
    'ember':     fixed('#2a0c06', '#5e1608', '#a82a0a', '#e85a10', '#ff9a2a', '#ffd870'),
    'skin':      fixed('#5a3424', '#8a5638', '#b47a54', '#d49c74', '#ecbf98', '#f8dcc0'),
    'blood_red': ramp('#a02424', 0.10, 0.66, cool=0.04, warm=0.02),
    'royal_blue':ramp('#2c3c9c', 0.10, 0.66),
    'purple':    ramp('#6a2c9c', 0.10, 0.66),
}

# ---------- regions ----------
# stone: building stone / Castle Stone; wood: local timber; accent: banners, trims, glow; foliage: moss, vines
REGIONS = {
    'vale':       {'name': 'The Vale (Millbrook)', 'mood': 'warm, homely, summer farmland',
                   'stone': ramp('#8a857e', 0.14, 0.76, cool=0.12, warm=0.10, sat=0.9),
                   'mortar': ramp('#57504a', 0.10, 0.50),
                   'wood': M['oak'], 'accent': M['blood_red'],
                   'foliage': ramp('#5d8a34', 0.12, 0.66)},
    'frostmarch': {'name': 'Frostmarch (Rimehold)', 'mood': 'cold, blue shadows, snow-dusted',
                   'stone': ramp('#86919e', 0.14, 0.84, cool=0.20, warm=0.02, warm_hue=0.55),
                   'mortar': ramp('#4c5562', 0.10, 0.52),
                   'wood': M['spruce'], 'accent': ramp('#7cc0e0', 0.16, 0.88),
                   'foliage': ramp('#4c7a6a', 0.10, 0.62)},
    'saltreach':  {'name': "Saltreach (Gull's Rest)", 'mood': 'sun-bleached coast, salt and sea-glass',
                   'stone': ramp('#c2ae86', 0.18, 0.86, cool=0.14, warm=0.06),
                   'mortar': ramp('#8a7a5e', 0.14, 0.60),
                   'wood': ramp('#a29482', 0.16, 0.78, sat=0.8), 'accent': ramp('#2f8f88', 0.10, 0.70),
                   'foliage': ramp('#7c9a4a', 0.14, 0.66)},
    'emberwaste': {'name': 'Emberwaste (Sunscar)', 'mood': 'scorched red rock, cinders, heat haze',
                   'stone': ramp('#8e4c38', 0.10, 0.66, cool=0.10, warm=0.14),
                   'mortar': ramp('#3a2420', 0.06, 0.36),
                   'wood': ramp('#40302a', 0.06, 0.40), 'accent': M['ember'],
                   'foliage': ramp('#8a7a3a', 0.12, 0.60)},
    'blackfen':   {'name': 'Blackfen (Mirelight)', 'mood': 'drowned, mossy, sickly green light',
                   'stone': ramp('#5c6452', 0.08, 0.60, cool=0.12, warm=0.04),
                   'mortar': ramp('#2e3428', 0.05, 0.36),
                   'wood': ramp('#5c4034', 0.07, 0.48), 'accent': ramp('#9ad04a', 0.14, 0.86),
                   'foliage': ramp('#4a6a2a', 0.07, 0.56)},
    # Undertow: sampled from Mateo's concept art (art/reference/undertow-concept.png)
    'undertow':   {'name': 'The Undertow', 'mood': 'violet basalt, lattice trees, pink and blue glow, pale rivers',
                   'stone': fixed('#160f1b', '#2b1b30', '#3c2f4d', '#55466e', '#6c5786', '#867cae'),
                   'mortar': fixed('#0c080f', '#160f1b', '#22172a', '#2b1b30', '#3c2f4d', '#4d446a'),
                   'wood': fixed('#2a1630', '#4a2848', '#6e3e66', '#9a5a86', '#c884a8', '#f0c0d4'),
                   'accent': fixed('#3a2a6a', '#5a5aa8', '#8494d8', '#a9c4ed', '#d4e6fa', '#f4faff'),
                   'glow_pink': fixed('#5a2448', '#8a3a6a', '#b8608e', '#d895b4', '#f2c4d8', '#fff0f6'),
                   'foliage': fixed('#3a1a40', '#5a2a5e', '#7a3a7e', '#9a5aa0', '#c08ac4', '#e8c4ea')},
}

# Banner / guard colours: vanilla dye base colours, each turned into a ramp.
DYE = {"white": "#e9ecec", "orange": "#f07613", "magenta": "#bd44b3", "light_blue": "#3aafd9", "yellow": "#f8c527",
       "lime": "#70b919", "pink": "#ed8dac", "gray": "#3e4447", "light_gray": "#8e8e86", "cyan": "#158991",
       "purple": "#792aac", "blue": "#35399d", "brown": "#724728", "green": "#546d1b", "red": "#a12722", "black": "#1d1d21"}
def dye_ramp(name):
    r, g, b = hx(DYE[name]); _, l, _ = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    return ramp(DYE[name], max(0.05, l - 0.30), min(0.95, l + 0.22), cool=0.08, warm=0.05)
