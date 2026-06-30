#!/usr/bin/env python3
"""Apply workflow-resolved item->texture mappings: extract the chosen textures from
the client jars into icons/ and merge into data/item_icons.json.

Input : meta/wf_mapping.json  = { "<item name>": "<catalog id mod::path>", ... }
        meta/tex_catalog.json  = catalog with {id, mod, kind, base, jar, entry}
Output: extracts icons/<mod>_<flatbase>.png ; updates data/item_icons.json (+ .js)

Run normalize_icons.py and render_iso_blocks.py AFTER this (this writes flat refs;
iso step repoints cube-like blocks and rewrites item_icons.js)."""
import os, re, json, zipfile, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def P(*a): return os.path.join(ROOT, *a)
MODS = P('game', 'loliland', 'clients', 'techno_magic_rpg', 'main', 'mods')
CLIENT_JAR = P('game', 'loliland', 'clients', 'techno_magic_rpg', 'main', 'client.jar')

def jar_path(jn):
    return CLIENT_JAR if jn == 'client.jar' else os.path.join(MODS, jn)

mapping = json.load(open(sys.argv[1] if len(sys.argv) > 1 else P('meta', 'wf_mapping.json'), encoding='utf-8'))
catalog = json.load(open(P('meta', 'tex_catalog.json'), encoding='utf-8'))
by_id = {e['id']: e for e in catalog}

icons_dir = P('icons')
ii = json.load(open(P('data', 'item_icons.json'), encoding='utf-8'))

added, reused, invalid, errors = 0, 0, [], []
for item, cid in mapping.items():
    e = by_id.get(cid)
    if not e:
        invalid.append((item, cid)); continue
    flat = re.sub(r'[^A-Za-z0-9]+', '_', e['entry'].split('textures/', 1)[1].rsplit('.png', 1)[0])
    flat = re.sub(r'^(items|blocks)_', '', flat)
    fn = f"{e['mod']}_{flat}.png"
    dst = os.path.join(icons_dir, fn)
    rel = f"icons/{fn}"
    if os.path.exists(dst):
        ii[item] = rel; reused += 1; continue
    try:
        data = zipfile.ZipFile(jar_path(e['jar'])).read(e['entry'])
        with open(dst, 'wb') as f:
            f.write(data)
        ii[item] = rel; added += 1
    except Exception as ex:
        errors.append((item, cid, str(ex)))

json.dump(ii, open(P('data', 'item_icons.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=0, sort_keys=True)
with open(P('item_icons.js'), 'w', encoding='utf-8') as f:
    f.write('/* Авто-сгенерировано meta/build_item_icons.py + apply_icons.py — имя предмета → текстура. */\n')
    f.write('window.ITEM_ICONS = ' + json.dumps(ii, ensure_ascii=False, sort_keys=True) + ';\n')

print(f"mapping in: {len(mapping)} | extracted: {added} | reused existing file: {reused} | invalid id: {len(invalid)} | errors: {len(errors)}")
print(f"item_icons.json now: {len(ii)} entries")
if invalid:
    print("INVALID IDS (not in catalog):")
    for it, cid in invalid[:30]:
        print(f"  {it}  ->  {cid}")
if errors:
    print("EXTRACT ERRORS:")
    for it, cid, ex in errors[:20]:
        print(f"  {it}  ->  {cid}: {ex}")
