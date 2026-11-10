"""Builds the dragon 3D viewer page (art/dragons/dragon-viewer.html) from the real pack files.
Run from the siege-nights folder, after studio/build_dragons.py:   python3 studio/dragon_viewer/build.py [three.min.js for a local test copy]
It plays the same animation numbers the game uses (studio/dragon_viewer/data.json, written by build_dragons.py),
reads species facts from scripts/dragons/data.js, and embeds the voices as mp3 so every browser can play them."""
import base64, json, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
data = json.load(open(os.path.join(HERE, "data.json")))

def js(expr):
    e = str(expr)
    for a, b in (("math.sin(", "S("), ("math.cos(", "C("), ("query.life_time", "q.t"), ("query.modified_distance_moved", "q.dist"),
                 ("query.modified_move_speed", "q.speed"), ("query.target_x_rotation", "0"), ("query.target_y_rotation", "0")):
        e = e.replace(a, b)
    assert re.fullmatch(r"[0-9a-zA-Z_.+\-*/() ]+", e) and "query" not in e and "math" not in e, e
    return f"(q)=>{e}"
anims = "{" + ",".join(
    json.dumps(name) + ":{" + ",".join(
        json.dumps(bone) + ":{" + ",".join(f"{ch}:[{','.join(js(x) for x in vals)}]" for ch, vals in chans.items()) + "}"
        for bone, chans in bones.items()) + "}"
    for name, bones in data.pop("animations").items()) + "}"

sounds = {}
folder = "Siege_Nights_RP/sounds/siege/dragon"
for f in sorted(os.listdir(folder)):
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp: out = tmp.name
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", os.path.join(folder, f), "-c:a", "libmp3lame", "-q:a", "6", out], check=True)
    sounds[f[:-4]] = "data:audio/mpeg;base64," + base64.b64encode(open(out, "rb").read()).decode()
    os.remove(out)

facts = json.loads(subprocess.run(["node", "--input-type=module", "-e", """
import * as d from "./Siege_Nights_BP/scripts/dragons/data.js";
const S = d.DRAGON_SETTINGS;
const word = (n) => n > 0 ? "high" : n < 0 ? "low" : "medium";
console.log(JSON.stringify({
  species: d.SPECIES.map((s) => ({ blurb: s.blurb, stats: [
    ["Flight", `${S.flightSeconds + s.flight} to ${S.flightSeconds + s.flight + 5 * S.flightSecondsPerWings} s`],
    ["Air speed", word(s.air)], ["Ground speed", word(s.ground)], ["Health", word(s.vigor)]] })),
  tempers: Object.values(d.TEMPERS).map((t) => [t.name, t.desc]),
}));"""], capture_output=True, text=True, check=True).stdout)

html = open(os.path.join(HERE, "template.html")).read()
for key, value in (("/*DATA*/", json.dumps(data)), ("/*ANIMS*/", anims), ("/*SOUNDS*/", json.dumps(sounds)), ("/*INFO*/", json.dumps(facts))):
    assert key in html; html = html.replace(key, value)
os.makedirs("art/dragons", exist_ok=True)
open("art/dragons/dragon-viewer.html", "w").write(html)
print("viewer:", len(html) // 1024, "KB")
if len(sys.argv) > 1:  # a copy that loads three.js from disk, for testing where the CDN is blocked
    local = "<!doctype html><meta charset='utf-8'><body>" + html.replace("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", "file://" + os.path.abspath(sys.argv[1]))
    open(sys.argv[2], "w").write(local)
