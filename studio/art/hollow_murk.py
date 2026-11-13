"""The Hollow's murk (Mateo 2026-11-13: "not dark and musty enough"). Its plants and lattice trees keep their
painted hues, but saved textures are greyed, darkened and pulled a little toward a damp mould colour. texlib's
Tex.save calls murk() for every texture, so re-running any painter keeps the look. Tune the numbers here."""
import os

MOULD = (74, 72, 60)
# texture name: (share greyed, brightness, share of mould tint)
MURK = {
    "siege_veilmoss_strands": (0.6, 0.55, 0.12),
    "siege_hollowwood_lattice": (0.55, 0.6, 0.12),
    "siege_hollowwood_core": (0.55, 0.58, 0.12),
    "siege_veilcap_stem": (0.5, 0.62, 0.1),
    "siege_veilcap_cap": (0.4, 0.75, 0.06),  # a fungal glow, kept a little brighter
    "siege_veilcap": (0.4, 0.75, 0.06),
    "siege_glimmerflow": (0.45, 0.7, 0.08),
}
MOSS = (0.35, 0.8, 0.1)


def murk_for(path):
    n = os.path.splitext(os.path.basename(path))[0]
    if "/blocks/" not in path.replace("\\", "/"): return None
    return MURK.get(n) or (MOSS if n.startswith("siege_undertow_moss") else None)


def murk_image(im, how):
    ds, br, ti = how
    im = im.convert("RGBA"); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            l = 0.299 * r + 0.587 * g + 0.114 * b
            r, g, b = (c + (l - c) * ds for c in (r, g, b))
            r, g, b = (c * (1 - ti) + m * ti for c, m in zip((r, g, b), MOULD))
            px[x, y] = tuple(max(0, min(255, round(c * br))) for c in (r, g, b)) + (a,)
    return im


def murk(im, path):
    how = murk_for(path)
    return murk_image(im, how) if how else im
