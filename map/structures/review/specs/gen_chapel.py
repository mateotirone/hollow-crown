"""Writes kingsrest_chapel.json from kingsrest_chapel.base.json (python3 gen_chapel.py). The tower follows
build-instructions/towers/README.md: a three-stage stone shaft with the door at its foot, a louvred belfry and a
broach spire, all skill parts, so nothing is laid on by hand any more."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
spec = json.load(open(os.path.join(HERE, "kingsrest_chapel.base.json")))
json.dump(spec, open(os.path.join(HERE, "kingsrest_chapel.json"), "w"), indent=1)
print("wrote kingsrest_chapel.json")
