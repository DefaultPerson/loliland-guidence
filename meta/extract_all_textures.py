#!/usr/bin/env python3
"""Extract every item/block texture + lang file from all modpack jars into a
staging dir (meta/tex) and data/lang. build_item_icons.py then resolves guide
items against staging+icons and only the matched textures are copied into icons/.
Keeps icons/ lean while letting us mine the full pack for missing icons."""
import os, re, zipfile, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODS = "/home/def/Games/loliland/clients/techno_magic_rpg/main/mods"
CLIENT = "/home/def/Games/loliland/clients/techno_magic_rpg/main/client.jar"
TEX = os.path.join(ROOT, "meta", "tex")
LANG = os.path.join(ROOT, "data", "lang")
os.makedirs(TEX, exist_ok=True)
os.makedirs(LANG, exist_ok=True)

TEXRE = re.compile(r'^assets/([^/]+)/textures/(items|blocks)/(.+)\.png$')
LANGRE = re.compile(r'^assets/([^/]+)/lang/(en_US|ru_RU)\.lang$', re.I)

jars = sorted(glob.glob(os.path.join(MODS, "*.jar"))) + [CLIENT]
ntex = nlang = 0
seen = set()
for jp in jars:
    try:
        z = zipfile.ZipFile(jp)
    except Exception:
        continue
    stem = os.path.basename(jp).split('-')[0]
    for n in z.namelist():
        mt = TEXRE.match(n)
        if mt:
            ns, _, base = mt.groups()
            if '/' in base:                       # flatten subdirs (tools/x -> tools_x)
                base = base.replace('/', '_')
            out = f"{ns}_{base}.png"
            if out in seen:                       # first jar wins
                continue
            try:
                data = z.read(n)
            except Exception:
                continue
            if len(data) < 70:                    # skip empty/1px
                continue
            with open(os.path.join(TEX, out), 'wb') as f:
                f.write(data)
            seen.add(out); ntex += 1
            continue
        ml = LANGRE.match(n)
        if ml:
            ns, lang = ml.groups()
            out = f"{stem}__{ns}_{lang}.lang"
            p = os.path.join(LANG, out)
            if not os.path.exists(p):
                try:
                    with open(p, 'wb') as f:
                        f.write(z.read(n))
                    nlang += 1
                except Exception:
                    pass
print(f"extracted {ntex} textures -> meta/tex, {nlang} lang files -> data/lang")
