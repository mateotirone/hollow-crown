#!/usr/bin/env python3
"""Build hollow-crown.mcaddon from Siege_Nights_BP and Siege_Nights_RP.
Run from the siege-nights folder:   python3 tools/build.py
It runs the offline check first and refuses to build if that fails.
Only scripts that main.js actually loads are packed, so half-finished feature folders stay out."""
import json, os, re, subprocess, sys, zipfile

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

# Every build gets its own patch number (the commit count), stamped into both packed manifests and their
# links to each other. Minecraft refuses to re-import a pack whose uuid and version it already has and
# silently keeps the old copy, so without this a tester keeps playing an old build. The repo manifests
# keep MAJOR.MINOR (docs/RELEASING.md); only the packed copies get the patch.
try:
    BUILD = int(subprocess.run(["git", "rev-list", "--count", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip())
except Exception:
    BUILD = None
PACK_UUIDS = {json.load(open(os.path.join(ROOT, p, "manifest.json")))["header"]["uuid"] for p in ("Siege_Nights_BP", "Siege_Nights_RP")}

def stamped_manifest(path):
    m = json.load(open(path, encoding="utf8"))
    if BUILD is None:
        return None
    def stamp(v):
        return [v[0], v[1], BUILD] if isinstance(v, list) and len(v) == 3 else v
    m["header"]["version"] = stamp(m["header"]["version"])
    for mod in m.get("modules", []):
        mod["version"] = stamp(mod["version"])
    for dep in m.get("dependencies", []):
        if dep.get("uuid") in PACK_UUIDS:
            dep["version"] = stamp(dep["version"])
    return json.dumps(m, indent=2) + "\n"

BUILD_JS = os.path.join(SCRIPTS, "core", "build.js")
def shown_version():
    v = json.load(open(os.path.join(ROOT, "Siege_Nights_BP", "manifest.json")))["header"]["version"]
    return ".".join(map(str, v[:2] + [BUILD])) if BUILD is not None else ".".join(map(str, v))

count = 0
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for pack in ("Siege_Nights_BP", "Siege_Nights_RP", "Hollow_Crown_Skins"):   # skins: player skin pack
        for folder, _, files in os.walk(os.path.join(ROOT, pack)):
            for f in sorted(files):
                full = os.path.join(folder, f)
                if full.startswith(SCRIPTS) and full not in reachable:
                    continue
                rel = os.path.relpath(full, ROOT)
                text = stamped_manifest(full) if f == "manifest.json" and folder == os.path.join(ROOT, pack) else None
                if full == BUILD_JS:  # the self-test reports this, so a tester can see which build is loaded
                    text = open(full, encoding="utf8").read().replace('"dev"', json.dumps(shown_version()))
                if text is not None:
                    z.writestr(rel, text)
                else:
                    z.write(full, rel)
                count += 1
shown = shown_version()
print(f"Built {os.path.relpath(OUT, ROOT)}: {count} files ({len(reachable)} scripts), version {shown}")
