import numpy as np, json, math
t=np.load('terrain.npz'); Y=t['Y']; H=int(t['H']); N=int(t['N']); S=N/(2*H)
L=json.load(open('lines.json'))
PL={"Harrowford":(-470,-300),"Oakmere":(260,-480),"Thistledown":(300,130),"Wrenfield":(-200,220),"Rimeholt":(-520,-760),"Wolfcairn":(520,-1010),"Gullcliff":(-760,-560),"Tidewatch":(-560,650),"Reedmoor":(-230,560),"Lanternbog":(260,980),"Redmesa":(700,60),"Dunehold":(760,860)}
def h(x,z):
    fx=(x+H)*S; fz=(z+H)*S; i=int(fx); j=int(fz); a=fx-i; b=fz-j
    return (Y[j,i]*(1-a)+Y[j,i+1]*a)*(1-b)+(Y[j+1,i]*(1-a)+Y[j+1,i+1]*a)*b
def comp(d):
    return ["N","NE","E","SE","S","SW","W","NW"][int(((d+22.5)%360)//45)]
def cross(pts,cx,cz,r):
    out=[]
    for (x0,z0),(x1,z1) in zip(pts,pts[1:]):
        d0=math.hypot(x0-cx,z0-cz)-r; d1=math.hypot(x1-cx,z1-cz)-r
        if d0*d1<0:
            f=d0/(d0-d1); x=x0+(x1-x0)*f; z=z0+(z1-z0)*f
            out.append(round(math.degrees(math.atan2(x-cx,-(z-cz)))%360))
    return out
res={}
for n,(cx,cz) in PL.items():
    row={"center":[cx,cz],"centerY":round(float(h(cx,cz)))}
    for r in (48,64,80):
        hs=[float(h(cx+r*math.sin(math.radians(a)),cz-r*math.cos(math.radians(a)))) for a in range(0,360,2)]
        step=max(abs(hs[i]-hs[i-1]) for i in range(len(hs)))
        arc=2*math.pi*r/180
        wet=[a*2 for a,v in enumerate(hs) if v<=62.5]
        row[f"r{r}"]={"minY":round(min(hs)),"maxY":round(max(hs)),"range":round(max(hs)-min(hs)),"maxSlope":round(step/arc,2),"wetDeg":len(wet)*2,
          "profile8":{c:round(hs[i*45//2]) for i,c in enumerate(["N","NE","E","SE","S","SW","W","NW"])}}
    row["crossings_r64"]={}
    for kind in ("rivers","roads","trails"):
        for name,pts in L[kind].items():
            c=cross(pts,cx,cz,64)
            if c: row["crossings_r64"][f"{kind[:-1]}:{name}"]=[f"{d}° {comp(d)}" for d in c]
    res[n]=row
    print(n,row["centerY"],[ (r,row[f'r{r}']['minY'],row[f'r{r}']['maxY'],row[f'r{r}']['maxSlope'],row[f'r{r}']['wetDeg']) for r in (48,64,80)],row["crossings_r64"])
json.dump(res,open('wall-profiles.json','w'),indent=1)
