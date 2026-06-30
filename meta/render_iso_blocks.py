#!/usr/bin/env python3
"""Render full-cube block icons isometrically (Minecraft inventory style: one
corner toward the viewer, top + two shaded side faces from a single face texture).
Reads data/item_icons.json, writes icons/<stem>__iso.png for detected cubes, and
repoints those item entries to the iso version. Items / non-cube blocks (pools,
altars, tables, panels, frames) stay flat. Run after build_item_icons + normalize."""
import json, os, numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def P(*a): return os.path.join(ROOT, *a)

VANILLA_CUBE = {f"minecraft_{x}" for x in (
    "cobblestone stone glass sand gravel planks_oak log_oak wool obsidian ice "
    "netherrack glowstone end_stone quartz_block coal_block dirt".split())}
EXCL = ('table', 'altar', 'pool', 'panel', '_frame', 'frame_', 'resonator', 'inscribe', 'workbench')

def is_cube(fn):
    n = fn[:-4]; nl = n.lower()
    if any(x in nl for x in EXCL):
        return False
    if n in VANILLA_CUBE:
        return True
    return ('block' in nl) or nl.endswith('_ore')

def affine(A, B, C, T):
    (Ax, Ay), (Bx, By), (Cx, Cy) = A, B, C
    m00, m01, m10, m11 = (Bx-Ax)/T, (Cx-Ax)/T, (By-Ay)/T, (Cy-Ay)/T
    det = m00*m11 - m01*m10
    i00, i01, i10, i11 = m11/det, -m01/det, -m10/det, m00/det
    return (i00, i01, -(i00*Ax+i01*Ay), i10, i11, -(i10*Ax+i11*Ay))

def shade(tex, k):
    a = np.asarray(tex.convert("RGBA")).astype(float)
    a[..., :3] *= k
    return Image.fromarray(np.clip(a, 0, 255).astype('uint8'), "RGBA")

def iso(texpath, T=40, COS=38, SIN=19, H=40, pad=3, out=72):
    tex = Image.open(texpath).convert("RGBA").resize((T, T), Image.NEAREST)
    W, Hh = 2*COS + 2*pad, 2*SIN + H + 2*pad
    ox, oy = COS + pad, H + pad
    def pt(x, y): return (x + ox, y + oy)
    canvas = Image.new("RGBA", (W, Hh), (0, 0, 0, 0))
    faces = [
        (shade(tex, .80), pt(-COS, SIN-H), pt(0, 2*SIN-H), pt(-COS, SIN)),   # left
        (shade(tex, .60), pt(COS, SIN-H), pt(0, 2*SIN-H), pt(COS, SIN)),     # right
        (shade(tex, 1.0), pt(0, -H), pt(COS, SIN-H), pt(-COS, SIN-H)),       # top
    ]
    for t, A, B, C in faces:
        canvas.alpha_composite(t.transform((W, Hh), Image.AFFINE, affine(A, B, C, T),
                                           resample=Image.NEAREST, fillcolor=(0, 0, 0, 0)))
    s = max(W, Hh)
    sq = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sq.alpha_composite(canvas, ((s-W)//2, (s-Hh)//2))
    return sq.resize((out, out), Image.LANCZOS)

if __name__ == '__main__':
    d = json.load(open(P('data', 'item_icons.json')))
    cubes = sorted({v for v in d.values() if is_cube(os.path.basename(v))})
    remap = {}
    for path in cubes:
        fn = os.path.basename(path)[:-4]
        src = P('icons', os.path.basename(path))
        if not os.path.exists(src):
            continue
        outname = f"{fn}__iso.png"
        iso(src).save(P('icons', outname))
        remap[path] = 'icons/' + outname
    for name, path in list(d.items()):
        if path in remap:
            d[name] = remap[path]
    json.dump(d, open(P('data', 'item_icons.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=0, sort_keys=True)
    with open(P('item_icons.js'), 'w', encoding='utf-8') as f:
        f.write('/* Авто-сгенерировано meta/build_item_icons.py + render_iso_blocks.py */\n')
        f.write('window.ITEM_ICONS = ' + json.dumps(d, ensure_ascii=False, sort_keys=True) + ';\n')
    print(f"rendered {len(remap)} isometric cube icons; repointed {sum(1 for v in d.values() if '__iso' in v)} item refs")
