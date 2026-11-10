#!/usr/bin/env python3
"""Install generated sound files into the game.

  1. Make a sound from a prompt in SOUND-LIST.md and save it under the file name given there
     (for example toll_317.mp3). wav, mp3, ogg, flac and m4a all work.
  2. Put it in the sounds-inbox/ folder.
  3. Run:   python3 tools/install_sounds.py

Each file is trimmed, levelled, converted to the .ogg Minecraft wants, copied into the resource pack,
wired into sound_definitions.json, and switched on in the scripts (core/sfx_installed.js). From then on
the game plays the recording instead of its vanilla stand-in. SOUND-LIST.md is rewritten to show it.

Other ways to run it:
  python3 tools/install_sounds.py toll_317=/some/where/take3.wav   install one file from anywhere
  python3 tools/install_sounds.py --start 4 choir_hum=choir.mp3    start 4 seconds into the file
  python3 tools/install_sounds.py --status                         what is installed, what is still a stand-in
  python3 tools/install_sounds.py --remove toll_317                go back to the stand-in
                                                                   (dragon and hum files: restore them with git)
File names are matched loosely: "Toll 317 (take 2).mp3" and "toll_317_v3.wav" both install as toll_317.
Needs ffmpeg (https://ffmpeg.org) on this machine.
"""
import json, os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "Siege_Nights_RP")
DEFS = os.path.join(RP, "sounds/sound_definitions.json")
MANIFEST = os.path.join(ROOT, "studio/sounds/signature.json")
RECORD = os.path.join(ROOT, "studio/sounds/installed.json")
INSTALLED_JS = os.path.join(ROOT, "Siege_Nights_BP/scripts/core/sfx_installed.js")
INBOX = os.path.join(ROOT, "sounds-inbox")
AUDIO = (".wav", ".mp3", ".ogg", ".flac", ".m4a", ".aac", ".aiff", ".aif", ".opus", ".webm")
RATE = 44100
PEAK_DB = -3.0  # every recording is brought to the same peak, so none jumps out

def load(path, default):
    return json.load(open(path, encoding="utf8")) if os.path.exists(path) else default

def save(path, data):
    with open(path, "w", encoding="utf8") as f:
        json.dump(data, f, indent=1, ensure_ascii=False); f.write("\n")

def entries():
    m = load(MANIFEST, None)
    if not m: sys.exit(f"missing {MANIFEST}")
    return {e["file"]: e for e in m["signature"] + m["dragons"]}

norm = lambda s: re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")

def match(name, table):
    """The manifest entry a file name means: the longest entry name it starts with."""
    n = norm(os.path.splitext(name)[0])
    best = [k for k in table if n == k or n.startswith(k + "_")]
    return max(best, key=len) if best else None

def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True).stdout.strip()
    try: return float(out)
    except ValueError: return 0.0

def ff(*args):
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-loglevel", "error", *args], check=True, timeout=300)

def convert(src, entry, start=None):
    """Trim, level and encode one file. Returns its final length in seconds."""
    out = os.path.join(RP, entry["path"] + ".ogg")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    tmp = out + ".tmp.wav"
    want, loop = float(entry["seconds"]), entry["kind"] == "loop"
    # pass 1: drop silence at the start (generators often leave some), then bring the peak to a common level
    pre = ["-ss", str(start)] if start else []
    lead = "anull" if loop else "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02"
    ff(*pre, "-i", src, "-ac", str(entry["channels"]), "-ar", str(RATE), "-af", lead, tmp)
    heard = subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-i", tmp, "-af", "volumedetect", "-f", "null", "-"],
                           capture_output=True, text=True, timeout=120).stderr
    peak = re.search(r"max_volume: (-?[\d.]+) dB", heard)
    gain = min(24.0, PEAK_DB - float(peak.group(1))) if peak else 0.0
    have = duration(tmp)
    if have <= 0.05:
        os.remove(tmp); raise RuntimeError("no sound in the file")
    # pass 2: cut to length and fade the ends
    if entry.get("exact"):  # the hum: exactly this long, taken from the middle unless told where to start
        if have < want: os.remove(tmp); raise RuntimeError(f"needs at least {want:g} seconds, this is {have:.1f}")
        cut_from, length = (0 if start else (have - want) / 2), want
    else:
        cut_from, length = 0, min(have, max(want * 2, want + 2))  # generous: a good take can run long
    fade = float(entry.get("fade", 0)) if loop else min(0.25, length / 4)
    fades = (f"afade=t=in:d={fade}," if loop and fade else "afade=t=in:d=0.005,") + f"afade=t=out:st={max(0, length - fade):.3f}:d={fade}"
    ff("-ss", f"{cut_from:.3f}", "-t", f"{length:.3f}", "-i", tmp, "-af", f"volume={gain:.2f}dB,{fades}", "-c:a", "libvorbis", "-q:a", "4", out)
    os.remove(tmp)
    return round(duration(out), 2)

def define(entry):
    d = load(DEFS, {"format_version": "1.14.0", "sound_definitions": {}})
    defs = d.setdefault("sound_definitions", {})
    if entry["id"] not in defs:  # ids that already exist (dragons, the hum) keep their definition; only the file changes
        e = {"category": entry.get("category", "ambient"),
             "sounds": [{"name": entry["path"], "volume": 1.0, "load_on_low_memory": True}]}
        if entry.get("max_distance"): e["max_distance"] = entry["max_distance"]
        defs[entry["id"]] = e
        save(DEFS, d)

def undefine(entry):
    d = load(DEFS, None)
    if d and entry["id"].startswith("siege.sig.") and d["sound_definitions"].pop(entry["id"], None): save(DEFS, d)

def write_js(record):
    body = "".join(f'  "{e["id"]}": {{ seconds: {e["seconds"]} }},\n' for e in sorted(record.values(), key=lambda e: e["id"]))
    with open(INSTALLED_JS, "w", encoding="utf8") as f:
        f.write("// GENERATED by tools/install_sounds.py. Do not edit by hand.\n"
                "// The signature recordings that are installed in the resource pack, with their length in seconds.\n"
                "// Until a sound is listed here, the game plays its vanilla stand-in from core/sfx_cues.js.\n"
                "export const INSTALLED = {" + ("\n" + body if body else "") + "};\n")

def refresh_list():
    try:
        subprocess.run(["node", os.path.join(ROOT, "tools/sound-list.mjs")], check=True)
    except (OSError, subprocess.CalledProcessError):
        print("(could not rewrite SOUND-LIST.md: run  node tools/sound-list.mjs  yourself)")

def status(table, record):
    for group, want in (("Signature sounds", lambda e: e["id"].startswith("siege.sig.") or e["file"] == "choir_hum"), ("Dragons", lambda e: e["id"].startswith("siege.dragon."))):
        rows = [e for e in table.values() if want(e)]
        done = [e for e in rows if e["file"] in record]
        print(f"\n{group}: {len(done)} of {len(rows)} recordings installed")
        for e in rows:
            r = record.get(e["file"])
            print(f"  {'recording' if r else 'stand-in ':9}  {e['file']:22} {e['name']}" + (f"  ({r['seconds']} s, from {r['source']})" if r else ""))

def main(argv):
    table, record = entries(), load(RECORD, {})
    if "--status" in argv: return status(table, record)
    if "--remove" in argv:
        key = match(argv[argv.index("--remove") + 1], table)
        if not key or key not in record: sys.exit("that sound is not installed")
        e = table[key]
        if e["id"].startswith("siege.sig."):
            os.remove(os.path.join(RP, e["path"] + ".ogg")); undefine(e)
        else:
            print(f"{key}: the game needs a file here. Restore the old one with:  git checkout main -- Siege_Nights_RP/{e['path']}.ogg")
        del record[key]; save(RECORD, record); write_js(record); refresh_list()
        return print(f"removed {key}")
    if not shutil.which("ffmpeg"): sys.exit("ffmpeg is not installed. Get it from https://ffmpeg.org (or ask Claude to install the files for you).")
    start = float(argv[argv.index("--start") + 1]) if "--start" in argv else None
    jobs = []  # (key, source path)
    for a in argv:
        if "=" in a and not a.startswith("--"):
            name, src = a.split("=", 1)
            key = match(name, table)
            if not key: sys.exit(f'"{name}" is not a sound in SOUND-LIST.md')
            if not os.path.exists(src): sys.exit(f"no such file: {src}")
            jobs.append((key, src))
    if not jobs:
        if not os.path.isdir(INBOX): sys.exit("there is no sounds-inbox/ folder")
        for f in sorted(os.listdir(INBOX)):
            if not f.lower().endswith(AUDIO): continue
            key = match(f, table)
            if key: jobs.append((key, os.path.join(INBOX, f)))
            else: print(f'skipped "{f}": the name does not start with a file name from SOUND-LIST.md')
    if not jobs:
        return print("Nothing to install. Put sound files in sounds-inbox/, named as in SOUND-LIST.md, and run this again.")
    done = 0
    for key, src in jobs:
        e = table[key]
        try:
            secs = convert(src, e, start)
        except (RuntimeError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as err:
            print(f"FAILED {key} ({os.path.basename(src)}): {err}"); continue
        define(e)
        record[key] = {"id": e["id"], "seconds": secs, "source": os.path.basename(src)}
        done += 1
        off = "" if abs(secs - e["seconds"]) <= max(2, e["seconds"] * 0.5) else f"   (the list asks for about {e['seconds']:g} s)"
        print(f"installed {key:22} {secs:6.2f} s  {'loop' if e['kind'] == 'loop' else 'one-shot'}  <- {os.path.basename(src)}{off}")
    save(RECORD, record); write_js(record); refresh_list()
    print(f"\n{done} of {len(jobs)} installed. Next: node tools/check.mjs, then python3 tools/build.py for a new hollow-crown.mcaddon.")
    print("In game, /scriptevent siege:sound opens the sound board to hear them.")

if __name__ == "__main__":
    main(sys.argv[1:])
