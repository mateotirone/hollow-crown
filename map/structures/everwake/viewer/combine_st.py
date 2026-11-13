import json, sys
S = sys.argv[1]
a = json.load(open(S + '/st/airboat_station_restored/scene.json')); b = json.load(open(S + '/st/airboat_station_ruin/scene.json'))
pal = [json.dumps(p) for p in a['palette']]; idx = {p: i for i, p in enumerate(pal)}
blocks = [list(x) for x in a['blocks']]
for x, y, z, i in b['blocks']:
    k = json.dumps(b['palette'][i])
    if k not in idx: idx[k] = len(pal); pal.append(k)
    blocks.append([x, y, z + 110, idx[k]])
json.dump({"palette": [json.loads(p) for p in pal], "blocks": blocks}, open(S + '/st/both.json', 'w'))
