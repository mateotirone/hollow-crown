#!/usr/bin/env python3
"""Build hollow-crown.mcaddon from Siege_Nights_BP and Siege_Nights_RP.
Run from the siege-nights folder:   python3 tools/build.py
It runs the offline check first and refuses to build if that fails.
Only scripts that main.js actually loads are packed, so half-finished feature folders stay out."""
import os, re, subprocess, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, sys.argv[1] if len(sys.argv) > 1 else "hollow-crown.mcaddon")
SCRIPTS = os.path.join(ROOT, "Siege_Nights_BP", "scripts")

if subprocess.run(["node", os.path.join(ROOT, "tools", "check.mjs")]).returncode != 0:
    sys.exit("Check failed, not building.")

reachable = set()
def visit(path):
    if path in reachable or not os.path.exists(path):
        return
    reachable.add(path)
    for spec in re.findall(r'import\s+(?:[\w$*\s{},]+?\s+from\s+)?["\'](\.[^"\']+)["\']', open(path, encoding="utf8").read()):
        visit(os.path.normpath(os.path.join(os.path.dirname(path), spec)))
visit(os.path.join(SCRIPTS, "main.js"))

count = 0
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for pack in ("Siege_Nights_BP", "Siege_Nights_RP"):
        for folder, _, files in os.walk(os.path.join(ROOT, pack)):
            for f in sorted(files):
                full = os.path.join(folder, f)
                if full.startswith(SCRIPTS) and full not in reachable:
                    continue
                z.write(full, os.path.relpath(full, ROOT))
                count += 1
print(f"Built {os.path.relpath(OUT, ROOT)}: {count} files ({len(reachable)} scripts)")
