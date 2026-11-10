import sys, amulet, numpy as np
from PIL import Image
path,X0,Z0,SIZE,out=sys.argv[1],int(sys.argv[2]),int(sys.argv[3]),int(sys.argv[4]),sys.argv[5]
l=amulet.load_level(path); D='minecraft:overworld'
COL={'grass_block':(104,150,70),'stone':(125,125,125),'andesite':(136,136,138),'water':(60,110,190),'sand':(219,207,163),'gravel':(131,127,126),'clay':(160,166,179),
'grass_path':(170,140,80),'cobblestone':(120,118,116),'mossy_cobblestone':(105,120,100),'coarse_dirt':(119,85,59),'dirt':(134,96,67),'leaves':(48,96,40),'log':(90,70,40),
'stone_bricks':(150,150,150),'gold_block':(250,220,60),'plant':None,'air':None}
img=np.zeros((SIZE,SIZE,3),np.uint8); hgt=np.zeros((SIZE,SIZE),np.int16); n=0; kinds=set()
for cx in range(X0>>4,(X0+SIZE>>4)):
    for cz in range(Z0>>4,(Z0+SIZE>>4)):
        try: ch=l.get_chunk(cx,cz,D)
        except Exception: continue
        n+=1
        blk=np.asarray(ch.blocks[:, -64:160, :])  # [x,y,z]
        names=np.array([ch.block_palette[i].base_name for i in range(len(ch.block_palette))])
        birch=np.array(['birch' in str(ch.block_palette[i].properties.get('material','')) for i in range(len(ch.block_palette))])
        solid=np.array([COL.get(nm,(255,0,255)) is not None for nm in names])
        kinds.update(names.tolist())
        s=solid[blk]; top=s.shape[1]-1-np.argmax(s[:,::-1,:],axis=1)
        ix,iz=np.indices((16,16)); tb=blk[ix,top,iz]
        cols=np.array([COL.get(nm) or (0,0,0) for nm in names],np.uint8)[tb]
        lb=(names[tb]=='leaves')&birch[tb]; cols[lb]=(96,140,60)
        img[cz*16-Z0:cz*16-Z0+16,cx*16-X0:cx*16-X0+16]=cols.transpose(1,0,2); hgt[cz*16-Z0:cz*16-Z0+16,cx*16-X0:cx*16-X0+16]=top.T
l.close()
gy,gx=np.gradient(hgt.astype(float)); sh=np.clip(1+(-gx-gy)*0.10,0.6,1.35)
im=Image.fromarray(np.clip(img*sh[...,None],0,255).astype(np.uint8)).resize((SIZE*2,SIZE*2),Image.NEAREST); im.save(out)
print('chunks read',n,'blocks',sorted(kinds),'height',hgt.min()-64,hgt.max()-64)
