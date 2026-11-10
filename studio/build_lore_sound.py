#!/usr/bin/env python3
"""The Choir's one note: a PLACEHOLDER hum, made in code, until Mateo's real recording replaces it.

  python3 studio/build_lore_sound.py            writes the placeholder only if no file is there yet
  python3 studio/build_lore_sound.py --force    overwrite
  python3 studio/build_lore_sound.py --from my_choir.wav [--start 3.0]
        cut a 7 second piece out of a real recording (wav/mp3/ogg), fade both ends, and install it

The script plays the clip again every 5 seconds, so the 1.5 s fades at each end overlap into one
unbroken note. Keep any replacement 7 seconds long, mono, with those fades (this script does that).
"""
import json, os, subprocess, sys, tempfile, wave
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "Siege_Nights_RP")
OUT = os.path.join(RP, "sounds/siege/choir/hum.ogg")
DEFS = os.path.join(RP, "sounds/sound_definitions.json")
SECONDS, FADE, RATE = 7.0, 1.5, 44100

def placeholder(path):
    t = np.arange(int(SECONDS * RATE)) / RATE
    rng = np.random.default_rng(317)
    out = np.zeros_like(t)
    note = 146.83  # D3: low, held, a little flat of comfortable
    for voice in range(9):
        f = note * (2 if voice >= 6 else 1) * (1 + rng.uniform(-0.006, 0.006))
        vib = 1 + 0.004 * np.sin(2 * np.pi * rng.uniform(4.2, 5.6) * t + rng.uniform(0, 6.28))
        phase = 2 * np.pi * np.cumsum(f * vib) / RATE + rng.uniform(0, 6.28)
        # an "oo" vowel: strong fundamental, weak upper partials
        v = sum(a * np.sin(k * phase) for k, a in ((1, 1.0), (2, 0.42), (3, 0.16), (4, 0.07), (5, 0.03)))
        swell = 0.75 + 0.25 * np.sin(2 * np.pi * rng.uniform(0.08, 0.2) * t + rng.uniform(0, 6.28))
        out += v * swell * (0.35 if voice >= 6 else 1.0)
    breath = np.convolve(rng.normal(0, 1, len(t)), np.ones(40) / 40, mode="same") * 0.5
    out = out / np.abs(out).max() * 0.8 + breath * 0.05
    fade = np.clip(np.minimum(t, SECONDS - t) / FADE, 0, 1)
    out = out * np.sin(fade * np.pi / 2) ** 2
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
        w.writeframes((out * 32000).astype("<i2").tobytes())

def encode(src, start=0.0):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    fades = f"afade=t=in:d={FADE},afade=t=out:st={SECONDS - FADE}:d={FADE}"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(start), "-t", str(SECONDS), "-i", src,
                    "-ac", "1", "-ar", str(RATE), "-af", fades, "-c:a", "libvorbis", "-q:a", "4", OUT], check=True)

def define():
    d = json.load(open(DEFS)) if os.path.exists(DEFS) else {}
    d.setdefault("format_version", "1.14.0")
    d.setdefault("sound_definitions", {})["siege.choir.hum"] = {
        "category": "ambient", "sounds": [{"name": "sounds/siege/choir/hum", "volume": 1.0, "load_on_low_memory": True}]}
    json.dump(d, open(DEFS, "w"), indent=1)

if "--from" in sys.argv:
    src = sys.argv[sys.argv.index("--from") + 1]
    start = float(sys.argv[sys.argv.index("--start") + 1]) if "--start" in sys.argv else 0.0
    encode(src, start); print("installed", src, "->", OUT)
elif "--force" in sys.argv or not os.path.exists(OUT):
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "hum.wav"); placeholder(wav); encode(wav)
    print("placeholder hum ->", OUT)
else:
    print("kept existing", OUT)
define()
