import os,zipfile,re,json,shutil
ROOT="/home/def/Games/loliland/clients/techno_magic_rpg/main/mods"
BASE="/home/def/projects/misc/loliland-guidence"
ICO=f"{BASE}/icons"; os.makedirs(ICO,exist_ok=True)
# index PNG textures: (mod, basename_lower)->(jar,entry); also per-mod list for prefix match
idx={}; permod={}
for f in os.listdir(ROOT):
    if not f.endswith('.jar'): continue
    try: z=zipfile.ZipFile(os.path.join(ROOT,f))
    except: continue
    for n in z.namelist():
        m=re.match(r'assets/([^/]+)/textures/(items|blocks)/(.+)\.png$', n)
        if not m: continue
        mod=m.group(1).lower(); base=m.group(3).split('/')[-1].lower()
        idx.setdefault((mod,base),(f,n))
        permod.setdefault(mod,[]).append((base,f,n,m.group(2)))
def camel2snake(s): return re.sub(r'(?<!^)(?=[A-Z])','_',s).lower()
def cands(name):
    n=name.lower(); cs=[n, camel2snake(name)]
    for pre in ('block','tile','item'):
        for c in list(cs):
            if c.startswith(pre): cs.append(c[len(pre):].lstrip('_'))
    return [c for c in dict.fromkeys(cs) if c]
def find(mod,name):
    mod=mod.lower()
    for c in cands(name):
        if (mod,c) in idx: return idx[(mod,c)]
    # prefix match within mod (block side textures), prefer items, shortest
    pool=permod.get(mod,[])
    best=None
    for c in cands(name):
        for base,jf,ent,kind in pool:
            if base==c or base.startswith(c+'_') or base.startswith(c):
                score=(0 if kind=='items' else 1, len(base))
                if best is None or score<best[0]: best=(score,(jf,ent))
    if best: return best[1]
    # any-mod exact
    for c in cands(name):
        for (mm,bb),v in idx.items():
            if bb==c: return v
    return None

nodes=json.loads(open(f"{BASE}/craftgraph.js",encoding='utf-8').read().split("window.CRAFT =",1)[1].rsplit(";",1)[0])['nodes']
m={}; hit=0
for nd in nodes:
    rid=nd['id']
    if ':' not in rid: continue
    mod,name=rid.split(':',1)
    r=find(mod,name)
    if r:
        jf,ent=r; safe=re.sub(r'[^a-zA-Z0-9_]+','_',rid)
        try:
            data=zipfile.ZipFile(os.path.join(ROOT,jf)).read(ent)
            open(f"{ICO}/{safe}.png",'wb').write(data)
            m[rid]=f"icons/{safe}.png"; hit+=1
        except: pass
json.dump(m,open(f"{BASE}/data/icons_map.json",'w',encoding='utf-8'),ensure_ascii=False)
print(f"nodes:{len(nodes)} | icons matched:{hit} ({100*hit//max(len(nodes),1)}%)")
print("textures indexed:",len(idx))
import random
ex=[k for k in m][:10]; print("samples:",ex)
