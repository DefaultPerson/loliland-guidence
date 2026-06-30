import os,zipfile,re,json
ROOT="/home/def/Games/loliland/clients/techno_magic_rpg/main/mods"
BASE="/home/def/projects/misc/loliland-guidence"
ICO=f"{BASE}/icons"; os.makedirs(ICO,exist_ok=True)
# texture index
idx={}; permod={}
for f in os.listdir(ROOT):
    if not f.endswith('.jar'): continue
    try: z=zipfile.ZipFile(os.path.join(ROOT,f))
    except: continue
    for n in z.namelist():
        m=re.match(r'assets/([^/]+)/textures/(items|blocks)/(.+)\.png$',n)
        if not m: continue
        mod=m.group(1).lower(); base=m.group(3).split('/')[-1].lower()
        idx.setdefault((mod,base),(f,n)); permod.setdefault(mod,[]).append((base,f,n,m.group(2)))
def c2s(s): return re.sub(r'(?<!^)(?=[A-Z])','_',s).lower()
def cands(name):
    n=name.lower(); cs=[n,c2s(name)]
    for pre in ('block','tile','item'):
        for c in list(cs):
            if c.startswith(pre): cs.append(c[len(pre):].lstrip('_'))
    return [c for c in dict.fromkeys(cs) if c]
def find(mod,name):
    mod=(mod or '').lower()
    for c in cands(name):
        if (mod,c) in idx: return idx[(mod,c)]
    best=None
    for c in cands(name):
        for base,jf,ent,kind in permod.get(mod,[]):
            if base==c or base.startswith(c+'_'):
                sc=(0 if kind=='items' else 1,len(base))
                if best is None or sc<best[0]: best=(sc,(jf,ent))
    if best: return best[1]
    for c in cands(name):
        for (mm,bb),v in idx.items():
            if bb==c: return v
    return None
# names.txt -> norm runame -> (mod, regname)
def norm(s):
    s=re.sub(r'§.','',s).lower().replace('ё','е'); s=re.sub(r'[^a-zа-я0-9 ]',' ',s); return re.sub(r'\s+',' ',s).strip()
name2reg={}
for line in open(f"{BASE}/data/names.txt",encoding='utf-8'):
    if '=' not in line: continue
    k,_,v=line.partition('='); k=k.strip(); v=v.strip(); nv=norm(v)
    if not nv: continue
    mod=''
    if ':' in k: mod,k=k.split(':',1)
    segs=[s for s in k.split('.') if s not in ('name','item','tile','block')]
    reg=segs[-1] if segs else k
    name2reg.setdefault(nv,(mod,reg))
# resolve guide items
G=json.loads(open(f"{BASE}/guide.js",encoding='utf-8').read().split("window.GUIDE =",1)[1].rsplit(";",1)[0])
items=set()
for s in G['sections']:
    for st in s['steps']:
        for it in st.get('items',[]): items.add(it)
gmap={}; hit=0
for it in items:
    n=norm(it)
    # try exact, then strip par/brackets
    key=n
    if key not in name2reg: key=re.sub(r'\s*\(.*?\)','',n).strip()
    mr=name2reg.get(key) or name2reg.get(n)
    if not mr: continue
    r=find(mr[0],mr[1])
    if r:
        jf,ent=r; safe=re.sub(r'[^a-zA-Z0-9]+','_',it)[:60]
        try:
            open(f"{ICO}/g_{safe}.png",'wb').write(zipfile.ZipFile(os.path.join(ROOT,jf)).read(ent))
            gmap[it]=f"icons/g_{safe}.png"; hit+=1
        except: pass
json.dump(gmap,open(f"{BASE}/data/guide_icons.json",'w',encoding='utf-8'),ensure_ascii=False)
print(f"guide items:{len(items)} | matched icons:{hit} ({100*hit//max(len(items),1)}%)")
print("samples:",[k for k in list(gmap)[:10]])
