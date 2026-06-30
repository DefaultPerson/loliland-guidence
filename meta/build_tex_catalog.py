#!/usr/bin/env python3
"""Index every item/block texture across the TechnoMagic RPG client jars and try a
deterministic name->registry->texture resolution for the guide's UNRESOLVED step items.

Outputs:
  meta/tex_catalog.json   - [{id, mod, kind, base, jar, entry}] for all textures
  meta/tex_catalog.txt    - grep-friendly: "mod | kind | base | jar :: entry"
  meta/det_resolved.json  - {item name: "<mod>::<entry>"} resolved deterministically
  meta/residual.json      - [item names still unresolved] (for the workflow)
Prints a coverage summary.
"""
import os, re, json, zipfile, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def P(*a): return os.path.join(ROOT, *a)
MODS = P('game', 'loliland', 'clients', 'techno_magic_rpg', 'main', 'mods')
CLIENT_JAR = P('game', 'loliland', 'clients', 'techno_magic_rpg', 'main', 'client.jar')

TEX_RE = re.compile(r'assets/([^/]+)/textures/(items|blocks)/(.+)\.png$')

# ---------- index all textures ----------
catalog = []          # {id, mod, kind, base, jar, entry}
idx = {}              # (mod, base) -> (jar, entry)  first wins (items before blocks via sort)
permod = collections.defaultdict(list)  # mod -> [(base, jar, entry, kind)]

jars = []
if os.path.isfile(CLIENT_JAR):
    jars.append(CLIENT_JAR)
if os.path.isdir(MODS):
    jars += [os.path.join(MODS, f) for f in sorted(os.listdir(MODS)) if f.endswith('.jar')]

seen_entry = set()
for jp in jars:
    jn = os.path.basename(jp)
    try:
        z = zipfile.ZipFile(jp)
    except Exception:
        continue
    for n in z.namelist():
        m = TEX_RE.match(n)
        if not m:
            continue
        mod, kind, rest = m.group(1).lower(), m.group(2), m.group(3)
        base = rest.split('/')[-1].lower()
        key = (mod, kind, rest, jn)
        if key in seen_entry:
            continue
        seen_entry.add(key)
        catalog.append({'id': f'{mod}::{rest}', 'mod': mod, 'kind': kind,
                        'base': base, 'jar': jn, 'entry': n})
        # items win over blocks for the (mod,base) shortcut index
        if (mod, base) not in idx or kind == 'items':
            idx.setdefault((mod, base), (jn, n))
            if kind == 'items':
                idx[(mod, base)] = (jn, n)
        permod[mod].append((base, jn, n, kind))

# ---------- lang / registry bridges ----------
def norm(s):
    s = re.sub(r'§.', '', str(s)).lower().replace('ё', 'е')
    s = re.sub(r'[^a-zа-я0-9 ]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

# registry display-name -> (mod, regname)   from names.txt (RU) + all .lang
name2reg = {}
reg_sources = []
nt = P('data', 'names.txt')
if os.path.isfile(nt):
    for line in open(nt, encoding='utf-8', errors='ignore'):
        if '=' not in line:
            continue
        k, _, v = line.partition('='); reg_sources.append((k.strip(), v.strip()))
for lf in (os.listdir(P('data', 'lang')) if os.path.isdir(P('data', 'lang')) else []):
    for line in open(P('data', 'lang', lf), encoding='utf-8', errors='ignore'):
        if '=' not in line or line.lstrip().startswith('#'):
            continue
        k, _, v = line.partition('='); reg_sources.append((k.strip(), v.strip()))

for k, v in reg_sources:
    nv = norm(v)
    if not nv or not k.endswith('.name'):
        continue
    mod = ''
    kk = k
    if ':' in kk:
        mod, kk = kk.split(':', 1)
    segs = [s for s in kk.split('.') if s not in ('name', 'item', 'tile', 'block')]
    reg = segs[-1] if segs else kk
    name2reg.setdefault(nv, (mod, reg))

def c2s(s):
    return re.sub(r'(?<!^)(?=[A-Z])', '_', s).lower()

def cands(name):
    n = name.lower(); cs = [n, c2s(name)]
    for pre in ('block', 'tile', 'item'):
        for c in list(cs):
            if c.startswith(pre):
                cs.append(c[len(pre):].lstrip('_'))
    return [c for c in dict.fromkeys(cs) if c]

def find_tex(mod, regname):
    mod = (mod or '').lower()
    for c in cands(regname):
        if (mod, c) in idx:
            return idx[(mod, c)]
    best = None
    for c in cands(regname):
        for base, jf, ent, kind in permod.get(mod, []):
            if base == c or base.startswith(c + '_'):
                sc = (0 if kind == 'items' else 1, len(base))
                if best is None or sc < best[0]:
                    best = (sc, (jf, ent))
    if best:
        return best[1]
    # cross-mod last resort: exact base in any mod
    for c in cands(regname):
        for e in catalog:
            if e['base'] == c:
                return (e['jar'], e['entry'])
    return None

# ---------- guide items ----------
G = json.loads(open(P('guide.js')).read().split('window.GUIDE =', 1)[1].rsplit(';', 1)[0])
items = collections.Counter()
for s in G['sections']:
    for st in s['steps']:
        for it in st.get('items', []):
            items[it] += 1

cur = json.load(open(P('data', 'item_icons.json')))   # already-resolved (real icons)
unresolved = [n for n in items if n not in cur]

det = {}
still = []
for it in unresolved:
    n = norm(it)
    key = n if n in name2reg else re.sub(r'\s*\(.*?\)', '', n).strip()
    mr = name2reg.get(key) or name2reg.get(n)
    if not mr:
        still.append(it); continue
    r = find_tex(mr[0], mr[1])
    if r:
        jf, ent = r
        m = TEX_RE.match(ent)
        det[it] = f'{m.group(1).lower()}::{m.group(3)}'
    else:
        still.append(it)

json.dump(catalog, open(P('meta', 'tex_catalog.json'), 'w'), ensure_ascii=False)
# grep-friendly: canonical id first so agents copy it verbatim
with open(P('meta', 'tex_catalog.txt'), 'w', encoding='utf-8') as f:
    for e in catalog:
        f.write(f"{e['id']} | {e['kind']} | {e['mod']} | {e['base']} | {e['jar']}\n")
json.dump(det, open(P('meta', 'det_resolved.json'), 'w'), ensure_ascii=False, indent=0)
json.dump({'residual': sorted(still, key=lambda x: -items[x]),
           'freq': {n: items[n] for n in still}},
          open(P('meta', 'residual.json'), 'w'), ensure_ascii=False, indent=0)

# ---------- enriched workflow input: ALL unresolved (verify det + resolve residual) ----------
sec_of = collections.defaultdict(set)
for s in G['sections']:
    for st in s['steps']:
        for it in st.get('items', []):
            sec_of[it].add(s['key'])
wf_input = []
for it in sorted(unresolved, key=lambda x: -items[x]):
    wf_input.append({'item': it, 'freq': items[it],
                     'sections': sorted(sec_of[it]),
                     'det': det.get(it)})
json.dump(wf_input, open(P('meta', 'wf_input.json'), 'w'), ensure_ascii=False, indent=0)
print(f"wf_input items: {len(wf_input)} -> meta/wf_input.json")

print(f"jars indexed: {len(jars)}  textures: {len(catalog)}  mods with tex: {len(permod)}")
print(f"guide distinct items: {len(items)}  already-resolved: {len(cur & cur if False else cur)}")
print(f"unresolved going in: {len(unresolved)}")
print(f"  deterministically resolved now: {len(det)}")
print(f"  residual for workflow: {len(still)}  (refs {sum(items[n] for n in still)})")
print("residual top 25:", [f'{items[n]}x {n}' for n in sorted(still, key=lambda x:-items[x])[:25]])
