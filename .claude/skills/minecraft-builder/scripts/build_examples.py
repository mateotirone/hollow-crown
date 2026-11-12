"""Build every examples/*.json into OUT/<name>/ (scene.json, summary.json), for the 3D asset viewer.
Usage: python3 build_examples.py OUT"""
import glob, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build import build

out = sys.argv[1]
for f in sorted(glob.glob(os.path.join(os.path.dirname(__file__), "..", "examples", "*.json"))):
    name = os.path.splitext(os.path.basename(f))[0].replace("-", "_")
    try: build(json.load(open(f)), os.path.join(out, name), "bedrock", False, False, False)
    except Exception as e: print(f"{name}: {e}", file=sys.stderr)
