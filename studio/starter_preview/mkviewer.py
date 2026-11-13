"""Bake the starter village preview into one HTML page.

    python3 mkviewer.py view.json [more_view.json ...] out.html

view.json files come from dump.mjs. Each one becomes a plot you can switch between.
"""
import sys, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
*views, out = sys.argv[1:]
data = [json.load(open(v)) for v in views]
tpl = open(os.path.join(HERE, "viewer.tpl.html")).read()
open(out, "w").write(tpl.replace("/*DATA*/null", json.dumps(data, separators=(",", ":"))))
print(out, os.path.getsize(out) // 1024, "KB")
