"""Find flicker (z-fighting) in entity models: two cube faces on the same plane, facing the same way, that overlap.
Usage: python3 studio/art/zfight_check.py [glob of geo files]   (default: every bestiary model)
Only compares cubes that share the same chain of bone rotations; rotated cubes are skipped. Fix by giving the
overlay cube (pauldron, belt, cloak, bracer, trim) a small inflate such as 0.25, or by shrinking the part underneath."""
import json, glob, os, sys
def rotkey(bones, b):
    k = []
    while b:
        r = b.get('rotation', [0, 0, 0])
        if any(r): k.append((tuple(r), tuple(b.get('pivot', [0, 0, 0]))))
        b = bones.get(b.get('parent'))
    return tuple(k)
def check(path):
    g = json.load(open(path))['minecraft:geometry'][0]; bones = {b['name']: b for b in g['bones']}; cs = []; hits = []
    for b in g['bones']:
        for i, c in enumerate(b.get('cubes', [])):
            if c.get('rotation'): continue
            inf = c.get('inflate', 0)
            cs.append((b['name'], i, [c['origin'][k] - inf for k in range(3)], [c['origin'][k] + c['size'][k] + inf for k in range(3)], rotkey(bones, b)))
    for a in range(len(cs)):
        for b in range(a + 1, len(cs)):
            A, B = cs[a], cs[b]
            if A[4] != B[4]: continue
            for ax in range(3):
                if not all(min(A[3][k], B[3][k]) - max(A[2][k], B[2][k]) > 0.01 for k in range(3) if k != ax): continue
                for side in (2, 3):
                    if abs(A[side][ax] - B[side][ax]) < 1e-6: hits.append(f"{A[0]}[{A[1]}] vs {B[0]}[{B[1]}] on {'xyz'[ax]}={A[side][ax]}")
    return hits
if __name__ == '__main__':
    pat = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/siege-nights/Siege_Nights_RP/models/entity/bestiary/*.geo.json'
    bad = 0
    for f in sorted(glob.glob(pat)):
        h = check(f)
        if h: bad += 1; print(os.path.basename(f), len(h)); [print('   ', x) for x in h[:6]]
    print(bad, 'models with overlapping faces')
