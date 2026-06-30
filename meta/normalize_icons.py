#!/usr/bin/env python3
"""Normalize extracted client textures for use as small static icons.

Minecraft 1.7.10 stores animated textures as vertical sprite-strips (W x W*frames)
and some block icons as horizontal sheets. Squishing a strip into a square chip
shows every frame overlapped -> looks like noise/artifacts. This crops every
non-square icon to its FIRST square frame (top-left WxW). Idempotent: square
icons are left untouched. Run after (re)extracting icons/.
"""
import glob, os
from PIL import Image

ICONS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'icons')
fixed = 0
for p in glob.glob(os.path.join(ICONS, '*.png')):
    try:
        im = Image.open(p)
    except Exception:
        continue
    w, h = im.size
    if w == h:
        continue
    s = min(w, h)
    im.convert('RGBA').crop((0, 0, s, s)).save(p)   # first frame
    fixed += 1
print(f'normalized {fixed} non-square icons to first frame')
