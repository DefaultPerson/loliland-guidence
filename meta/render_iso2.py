#!/usr/bin/env python3
"""Render full-cube block icons as Minecraft-inventory isometry: one corner toward
the viewer, top + two side faces visible, with DISTINCT top/side/front textures
where the block provides them (extracted straight from the client jars).

Supersedes render_iso_blocks.py. Decides block-ness from the texture catalog
(kind == 'blocks'), not a filename substring, and skips genuine non-cubes
(conduits, pipes, frames, pedestals, altars, pools, pylons, statues, anvils,
chests, runes, panels). Repoints those items in data/item_icons.json to the iso
version and rewrites item_icons.js."""
import json, os, re, zipfile, io
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def P(*a): return os.path.join(ROOT, *a)
MODS = P('game', 'loliland', 'clients', 'techno_magic_rpg', 'main', 'mods')
CLIENT = P('game', 'loliland', 'clients', 'techno_magic_rpg', 'main', 'client.jar')
def jar_path(jn): return CLIENT if jn == 'client.jar' else os.path.join(MODS, jn)

# ---------- data ----------
ii = json.load(open(P('data', 'item_icons.json'), encoding='utf-8'))
full = json.load(open(P('meta', 'tex_catalog_full.json'), encoding='utf-8'))
by_id = {e['id']: e for e in full}
wf = {}
for f in ('wf_mapping.json', 'wf_mapping2.json'):
    p = P('meta', f)
    if os.path.exists(p):
        wf.update(json.load(open(p, encoding='utf-8')))

# same-dir sibling index: (mod, dir) -> {base_lower: entry}
dir_idx = {}
for e in full:
    d = e['path'].rsplit('/', 1)[0] if '/' in e['path'] else ''
    dir_idx.setdefault((e['mod'], d), {})[e['base']] = e

# provenance: item -> full-catalog entry
def norm(s): return re.sub(r'[^a-z0-9]', '', s.lower())
# rank: prefer real block faces, then item icons, then misc/models/gui; shorter path wins
def rank(e): return ((0 if e['path'].startswith('blocks/') else 1 if e['path'].startswith('items/') else 2), len(e['path']))
norm_idx, base_idx = {}, {}
for e in sorted(full, key=rank):
    flat = re.sub(r'[^A-Za-z0-9]+', '_', e['path'])
    flat = re.sub(r'^(items|blocks)_', '', flat)
    norm_idx.setdefault(norm(f"{e['mod']}_{flat}"), e)        # full path match
    base_idx.setdefault(norm(f"{e['mod']}_{e['base']}"), e)   # mod+base match (ignores subfolders)

prov = {}
for name, path in ii.items():
    cid = wf.get(name)
    if cid and cid in by_id:
        prov[name] = by_id[cid]; continue
    stem = re.sub(r'(?:__iso)+$', '', os.path.basename(path)[:-4])   # strip doubled __iso too
    e = norm_idx.get(norm(stem)) or base_idx.get(norm(stem))
    if e:
        prov[name] = e

# ---------- cube detection ----------
# stay flat: not full cubes / better shown flat
NON_CUBE = re.compile(r'conduit|pipe|cable|\bwire\b|fluix|pylon|pedestal|altar|pool|'
                      r'statue|anvil|chest|frame|fence|pane|slab|stair|door|spike|'
                      r'torch|lamp|rune|panel|portal|ladder|carpet|'
                      r'banner|sign|button|lever|plate|rail|wand|sword|bow|'
                      # non-cube: plants / flowers / containers / crops
                      r'jar|bottle|vial|flower|daisy|dandeli|lotus|petal|mushroom|'
                      r'sapling|bush|sprout|bloom|daybloom|vine|berry|potato|infinitato|'
                      r'банк|бутыл|флакон|цвет|маргарит|одуван|лотос|лепест|гриб|саженец|куст|ягод', re.I)
MIN_OPAQUE = 0.42   # full-cube faces are near-opaque; flowers/plants/rings-with-holes fall below

def is_cube(name, entry):
    if not (entry['path'].startswith('blocks/') or entry['path'].startswith('tile/')):  # block faces only
        return False
    blob = (entry['path'] + ' ' + name).lower()
    if NON_CUBE.search(blob):
        return False
    return True

FACE_KW = ('top', 'bottom', 'side', 'front', 'back')
def faces(entry):
    """Return (top_entry, left_entry, right_entry) extracting distinct faces when present."""
    d = entry['path'].rsplit('/', 1)[0] if '/' in entry['path'] else ''
    sibs = dir_idx.get((entry['mod'], d), {})
    bl = entry['base']
    lead = re.split(r'[_]', bl)[0]
    def pick(kw):
        cands = [b for b in sibs if kw in b and b != bl]
        if not cands:
            return None
        cands.sort(key=lambda b: (not b.startswith(lead), len(b)))
        # require it shares the leading token, else it's a different block's face
        return sibs[cands[0]] if cands[0].startswith(lead) else None
    top = entry if 'top' in bl else pick('top')
    side = entry if 'side' in bl else pick('side')
    front = entry if ('front' in bl or 'face' in bl) else pick('front')
    top_e = top or entry
    right_e = front or side or entry
    left_e = side or front or entry
    return top_e, left_e, right_e

# ---------- iso render ----------
def _square(im, T):
    im = im.convert('RGBA'); w, h = im.size
    if w != h:                      # animated strip / sheet -> first square frame
        s = min(w, h); im = im.crop((0, 0, s, s))
    return im.resize((T, T), Image.NEAREST)

def load_tex(entry, T):
    data = zipfile.ZipFile(jar_path(entry['jar'])).read(entry['entry'])
    return _square(Image.open(io.BytesIO(data)), T)

def load_file(p, T):
    return _square(Image.open(p), T)

def opaque_ok(img):
    return (np.asarray(img)[..., 3] > 16).mean() >= MIN_OPAQUE

def affine(A, B, C, T):
    (Ax, Ay), (Bx, By), (Cx, Cy) = A, B, C
    m00, m01, m10, m11 = (Bx-Ax)/T, (Cx-Ax)/T, (By-Ay)/T, (Cy-Ay)/T
    det = m00*m11 - m01*m10
    return (m11/det, -m01/det, -(m11/det*Ax - m01/det*Ay),
            -m10/det, m00/det, -(-m10/det*Ax + m00/det*Ay))

def shade(tex, k):
    a = np.asarray(tex).astype(float); a[..., :3] *= k
    return Image.fromarray(np.clip(a, 0, 255).astype('uint8'), 'RGBA')

def iso_imgs(top, left, right, T=40, COS=38, SIN=19, H=40, pad=3, out=72):
    W, Hh = 2*COS + 2*pad, 2*SIN + H + 2*pad
    ox, oy = COS + pad, H + pad
    def pt(x, y): return (x + ox, y + oy)
    canvas = Image.new('RGBA', (W, Hh), (0, 0, 0, 0))
    spec = [
        (shade(left, .80),  pt(-COS, SIN-H), pt(0, 2*SIN-H), pt(-COS, SIN)),  # left face
        (shade(right, .62), pt(COS, SIN-H),  pt(0, 2*SIN-H), pt(COS, SIN)),   # right face
        (shade(top, 1.0),   pt(0, -H),       pt(COS, SIN-H), pt(-COS, SIN-H)),# top face
    ]
    for t, A, B, C in spec:
        canvas.alpha_composite(t.transform((W, Hh), Image.AFFINE, affine(A, B, C, T),
                                           resample=Image.NEAREST, fillcolor=(0, 0, 0, 0)))
    s = max(W, Hh); sq = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    sq.alpha_composite(canvas, ((s-W)//2, (s-Hh)//2))
    return sq.resize((out, out), Image.LANCZOS)

def iso(top_e, left_e, right_e):
    return iso_imgs(*(load_tex(e, 40) for e in (top_e, left_e, right_e)))

# fallback for no-provenance items that clearly read as full-cube blocks
BLOCK_HINT = re.compile(r'block|generator|machine|assembler|controller|drive|furnace|'
                        r'smelter|chamber|reactor|brick|forge|crafter|condenser|combiner|'
                        r'fabricator|compressor|macerator|extractor|dynamo|capacitor|replicator|'
                        r'converter|transformer|farm|encoder|'
                        r'блок|генератор|машин|сборщик|контроллер|привод|печ|плавильн|камер|'
                        r'реактор|кирпич|кузн|конденсатор|объединит|компрессор|дробил|преобразоват|'
                        r'ферма|кодировщик|репликатор|конвертер', re.I)

# ---------- run ----------
done, skipped_flat, no_prov, fallback, single, multi, errors = [], [], [], [], 0, 0, []
for name in list(ii):
    # reset to flat source first so the pass is idempotent (un-iso anything not re-confirmed a cube)
    cur = os.path.basename(ii[name])[:-4]
    if '__iso' in cur:
        fp = P('icons', re.sub(r'(?:__iso)+$', '', cur) + '.png')
        if os.path.exists(fp):
            ii[name] = 'icons/' + re.sub(r'(?:__iso)+$', '', cur) + '.png'
    e = prov.get(name)
    if e and is_cube(name, e):
        try:
            t, l, r = faces(e)
            tim, lim, rim = load_tex(t, 40), load_tex(l, 40), load_tex(r, 40)
            if not opaque_ok(tim):         # not a full cube (flower/plant/hollow) -> stay flat
                skipped_flat.append(name); continue
            single += (t['id'] == l['id'] == r['id']); multi += (t['id'] != l['id'] or l['id'] != r['id'])
            flat = re.sub(r'[^A-Za-z0-9]+', '_', e['path']); flat = re.sub(r'^(items|blocks)_', '', flat)
            outname = f"{e['mod']}_{flat}__iso.png"
            iso_imgs(tim, lim, rim).save(P('icons', outname))
            ii[name] = 'icons/' + outname; done.append(name)
        except Exception as ex:
            errors.append((name, str(ex)))
        continue
    if e:                                  # has provenance but is a non-cube item/block
        skipped_flat.append(name); continue
    # no catalog provenance: single-texture iso from the existing flat icon if it reads as a block
    stem = re.sub(r'(?:__iso)+$', '', os.path.basename(ii[name])[:-4])
    flatpng = P('icons', stem + '.png')
    if BLOCK_HINT.search(stem + ' ' + name) and not NON_CUBE.search(stem + ' ' + name) and os.path.exists(flatpng):
        try:
            img = load_file(flatpng, 40)
            if not opaque_ok(img):
                no_prov.append(name); continue
            outname = stem + '__iso.png'
            iso_imgs(img, img, img).save(P('icons', outname))
            ii[name] = 'icons/' + outname; fallback.append(name); single += 1
        except Exception as ex:
            errors.append((name, str(ex)))
    else:
        no_prov.append(name)

json.dump(ii, open(P('data', 'item_icons.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=0, sort_keys=True)
with open(P('item_icons.js'), 'w', encoding='utf-8') as f:
    f.write('/* Авто-сгенерировано build_item_icons.py + apply_icons.py + render_iso2.py */\n')
    f.write('window.ITEM_ICONS = ' + json.dumps(ii, ensure_ascii=False, sort_keys=True) + ';\n')

# prune orphaned iso files (incl. broken __iso__iso) no longer referenced
refs = set(os.path.basename(v) for v in ii.values())
pruned = 0
for f in os.listdir(P('icons')):
    if '__iso' in f and f not in refs:
        os.remove(P('icons', f)); pruned += 1

print(f"iso rendered: {len(done)}  (multi-face {multi}, single-face {single}) | fallback single: {len(fallback)}")
print(f"kept flat (non-cube/item): {len(skipped_flat)} | no provenance: {len(no_prov)} | errors: {len(errors)} | pruned orphan iso: {pruned}")
if errors:
    for n, ex in errors[:15]: print("  ERR", n, ex)
if no_prov:
    print("no-provenance sample:", no_prov[:15])
