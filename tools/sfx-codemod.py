#!/usr/bin/env python3
"""Turn direct playSound calls in the scripts into sfx() calls (see MODULES.md, "Sounds").

  python3 tools/sfx-codemod.py        rewrites  x.playSound("id", ...)  as  sfx(x, "id", ...)  and adds the import

Safe to run again at any time, for example after merging a branch written before sfx() existed.
"""
import glob, os, re

SCRIPTS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Siege_Nights_BP", "scripts")
SKIP = ("core/sfx.js", "dragons/voice.js")  # the engine itself, and the dragons' own voices
CALL = re.compile(r"((?:[A-Za-z_$][\w$]*)(?:\??\.[A-Za-z_$][\w$]*)*?)\??\.playSound(?:\?\.)?\(")

total = 0
for path in sorted(glob.glob(os.path.join(SCRIPTS, "**", "*.js"), recursive=True)):
    rel = os.path.relpath(path, SCRIPTS).replace(os.sep, "/")
    if rel in SKIP: continue
    src = open(path, encoding="utf8").read()
    out, n = CALL.subn(lambda m: f"sfx({m.group(1)}, ", src)
    if not n: continue
    if not re.search(r"^import \{[^}]*\bsfx\b[^}]*\} from ", out, re.M):
        line = f'import {{ sfx }} from "{"../" * rel.count("/") or "./"}core/sfx.js";\n'
        imports = list(re.finditer(r"^import [^;]*?;\n", out, re.M | re.S))
        at = imports[-1].end() if imports else 0
        out = out[:at] + line + out[at:]
    open(path, "w", encoding="utf8").write(out)
    total += n
    print(f"{rel}: {n}")
print(f"{total} call(s) rewritten" if total else "nothing to do: every sound already goes through sfx()")
