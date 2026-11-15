#!/usr/bin/env python3
"""Put a new build of the add-on into an existing world, keeping everything else in it: the map, every building,
every player's save, chests, Regals, story progress, game rules and spawn. For the next playtest on Mateo's own
Realm world instead of a fresh map (docs/WORLD-SNAPSHOT.md).

    python3 tools/build.py                                    # makes hollow-crown.mcaddon (runs the check first)
    python3 tools/repack_world.py WORLD [--addon hollow-crown.mcaddon] [--out OUT.mcworld] [--report]

WORLD    the downloaded world: a .mcworld (any file name, it is a zip) or an unzipped world folder.
--addon  the built add-on (default: hollow-crown.mcaddon in the repo).
--out    the world to write (default: <world name>-<version>.mcworld next to WORLD).
--report also write the world snapshot report (tools/world_snapshot.py) of WORLD, beside OUT.

Only the add-on's own behaviour and resource packs are swapped (found by their uuid, whatever folder they sit in);
any other pack in the world stays. level.dat and the database are copied byte for byte. The input is never changed.
"""
import argparse, json, os, re, shutil, subprocess, sys, tempfile, zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from world_snapshot import open_world  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACKS = {"Siege_Nights_BP": ("behavior", "hollow_crown_bp"), "Siege_Nights_RP": ("resource", "hollow_crown_rp")}


def manifest(folder):
    try: return json.load(open(os.path.join(folder, "manifest.json"), encoding="utf8"))["header"]
    except Exception: return None


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("world")
    ap.add_argument("--addon", default=os.path.join(ROOT, "hollow-crown.mcaddon"))
    ap.add_argument("--out")
    ap.add_argument("--report", action="store_true")
    a = ap.parse_args()
    if not os.path.exists(a.addon): sys.exit(f"{a.addon} not found: run python3 tools/build.py first.")

    with tempfile.TemporaryDirectory() as tmp:
        src = open_world(a.world, os.path.join(tmp, "in"))
        work = os.path.join(tmp, "world")
        shutil.copytree(src, work)
        # the new packs, out of the .mcaddon
        new = {}
        with zipfile.ZipFile(a.addon) as z:
            for top, (kind, folder) in PACKS.items():
                dest = os.path.join(tmp, "packs", folder)
                for n in z.namelist():
                    if n.startswith(top + "/") and not n.endswith("/"):
                        rel = n[len(top) + 1:]
                        if ".." in rel.split("/"): continue
                        os.makedirs(os.path.dirname(os.path.join(dest, rel)), exist_ok=True)
                        with z.open(n) as f, open(os.path.join(dest, rel), "wb") as out: shutil.copyfileobj(f, out)
                h = manifest(dest)
                if not h: sys.exit(f"{a.addon}: no {top}/manifest.json inside.")
                new[kind] = (folder, dest, h)
        version = ".".join(map(str, new["behavior"][2]["version"]))
        for kind, (folder, dest, h) in new.items():
            packs_dir = os.path.join(work, f"{kind}_packs")
            os.makedirs(packs_dir, exist_ok=True)
            old_versions = []
            for d in os.listdir(packs_dir):
                old = manifest(os.path.join(packs_dir, d))
                if old and old.get("uuid") == h["uuid"]:
                    old_versions.append(".".join(map(str, old.get("version", []))))
                    shutil.rmtree(os.path.join(packs_dir, d))
            shutil.copytree(dest, os.path.join(packs_dir, folder))
            lst_path = os.path.join(work, f"world_{kind}_packs.json")
            lst = json.load(open(lst_path)) if os.path.exists(lst_path) else []
            lst = [e for e in lst if e.get("pack_id") != h["uuid"]]
            lst.insert(0, {"pack_id": h["uuid"], "version": h["version"]})
            json.dump(lst, open(lst_path, "w"))
            print(f"{kind} pack: {', '.join(old_versions) or 'none'} -> {'.'.join(map(str, h['version']))}")
        name = open(os.path.join(work, "levelname.txt"), encoding="utf8").read().strip() if os.path.exists(os.path.join(work, "levelname.txt")) else "world"
        out = a.out or os.path.join(os.path.dirname(os.path.abspath(a.world)), f"{re.sub(r'[^A-Za-z0-9_-]+', '-', name).strip('-')}-{version}.mcworld")
        part = out + ".part"
        with zipfile.ZipFile(part, "w", zipfile.ZIP_DEFLATED) as z:
            for folder, _, files in os.walk(work):
                for f in sorted(files):
                    full = os.path.join(folder, f)
                    z.write(full, os.path.relpath(full, work))
        os.replace(part, out)
        print(f"Wrote {out}: {name}, add-on {version}, everything else as it was")
    if a.report:
        rep = os.path.join(os.path.dirname(os.path.abspath(out)), "world-snapshot", os.path.splitext(os.path.basename(out))[0])
        subprocess.run([sys.executable, os.path.join(ROOT, "tools", "world_snapshot.py"), a.world, "--out", rep], check=True)


if __name__ == "__main__":
    main()
