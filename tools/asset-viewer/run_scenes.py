"""Run a builder script only for its preview scenes: every call it makes to render/render.py or shoot.cjs is
skipped (those write big HTML pages and take screenshots with a browser, which the viewer does not need).

    python3 run_scenes.py SCRIPT [script args...]
"""
import os, runpy, subprocess, sys

script = os.path.abspath(sys.argv[1])
real_run = subprocess.run

def run(cmd, *a, **k):
    if any(str(c).endswith(("render.py", "shoot.cjs", "shoot_many.cjs")) for c in (cmd if isinstance(cmd, (list, tuple)) else [cmd])):
        return subprocess.CompletedProcess(cmd, 0, b"", b"")
    return real_run(cmd, *a, **k)

subprocess.run = run
sys.argv = [script] + sys.argv[2:]
sys.path.insert(0, os.path.dirname(script))
os.chdir(os.path.dirname(script))
runpy.run_path(script, run_name="__main__")
