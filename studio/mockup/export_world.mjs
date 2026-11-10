import { planChunk, B } from "./terrain.js";
import fs from "fs";
// region: x -88..87, z 104..279 (Drowned Shallows), 176x176
const CX0=-6, CX1=5, CZ0=+(process.argv[2]||7), CZ1=CZ0+11;
const X0=CX0*16, Z0=CZ0*16, W=(CX1-CX0+1)*16, D=(CZ1-CZ0+1)*16, Y0=40, H=150;
const names=Object.values(B); const ids={}; 
const all=[...new Set(names)]; all.forEach((n,i)=>ids[n]=i+1);
const g=new Uint8Array(W*H*D); const idx=(x,y,z)=>((y-Y0)*D+(z-Z0))*W+(x-X0);
for(let cx=CX0;cx<=CX1;cx++)for(let cz=CZ0;cz<=CZ1;cz++){
  for(const op of planChunk(cx,cz)){
    if(op.block===B.ceiling) continue;
    const [x1,y1,z1]=op.a,[x2,y2,z2]=op.b;
    if(y1>=196) continue;
    for(let y=Math.max(y1,Y0);y<=Math.min(y2,Y0+H-1);y++)for(let z=Math.max(z1,Z0);z<=Math.min(z2,Z0+D-1);z++)for(let x=Math.max(x1,X0);x<=Math.min(x2,X0+W-1);x++) g[idx(x,y,z)]=ids[op.block];
  }
}
// find min used y, crop
let minY=H,maxY=0,cnt={};
for(let y=0;y<H;y++)for(let i=0;i<W*D;i++){const v=g[y*W*D+i]; if(v){ if(y<minY)minY=y; if(y>maxY)maxY=y; cnt[all[v-1]]=(cnt[all[v-1]]||0)+1; }}
console.log({W,D,minY:minY+Y0,maxY:maxY+Y0,cnt});
// drop buried layers: find lowest y where any air exists in column set -> keep from (lowestSurface-2)
let lowSurf=H; for(let z=0;z<D;z++)for(let x=0;x<W;x++){ for(let y=0;y<H;y++){ if(!g[(y*D+z)*W+x]){ if(y<lowSurf)lowSurf=y; break; } } }
const yb=Math.max(0,lowSurf-2), hh=maxY-yb+1;
const out=g.slice(yb*W*D,(maxY+1)*W*D);
// RLE
const rle=[]; let cur=out[0],n=0; for(const v of out){ if(v===cur&&n<65535)n++; else{rle.push(cur,n);cur=v;n=1;} } rle.push(cur,n);
fs.writeFileSync("world.json",JSON.stringify({W,D,H:hh,y0:yb+Y0,blocks:all,rle}));
console.log('lowSurf',lowSurf+Y0,'H',hh,'rle',rle.length, fs.statSync("world.json").size);
