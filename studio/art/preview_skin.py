"""Paper-doll preview of a 64x64 player-layout skin (front and back)."""
from PIL import Image
def doll(path, scale=8):
    s = Image.open(path).convert('RGBA'); out = Image.new('RGBA', (36, 34), (0, 0, 0, 0))
    def put(box, dst, flip=False):
        c = s.crop(box); out.alpha_composite(c.transpose(Image.FLIP_LEFT_RIGHT) if flip else c, dst)
    # front: head, body, right arm (viewer's left), left arm, legs
    put((8, 8, 16, 16), (4, 1)); put((20, 20, 28, 32), (4, 9)); put((44, 20, 48, 32), (0, 9)); put((36, 52, 40, 64), (12, 9))
    put((4, 20, 8, 32), (4, 21)); put((20, 52, 24, 64), (8, 21))
    # back
    put((24, 8, 32, 16), (22, 1)); put((32, 20, 40, 32), (22, 9)); put((52, 20, 56, 32), (30, 9)); put((44, 52, 48, 64), (18, 9))
    put((12, 20, 16, 32), (26, 21)); put((28, 52, 32, 64), (22, 21))
    return out.resize((36 * scale, 34 * scale), Image.NEAREST)
if __name__ == '__main__':
    import sys
    ims = [doll(p) for p in sys.argv[2:]]
    W = Image.new('RGBA', (sum(i.width for i in ims), ims[0].height), (120, 124, 132, 255)); x = 0
    for i in ims: W.alpha_composite(i, (x, 0)); x += i.width
    W.save(sys.argv[1])
