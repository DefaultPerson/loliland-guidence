import os,sys,zipfile,re,json
ROOT="/home/def/Games/loliland"; PROJ="/home/def/projects/misc/loliland-guidence"
WROOT=os.path.join(PROJ,'data')
# 1) all *.name lang entries (Russian where present) across ALL jars -> names.txt + names.json
names={}
langlines=[]
for dp,_,fs in os.walk(ROOT):
  for f in fs:
    if not f.lower().endswith('.jar'): continue
    try: z=zipfile.ZipFile(os.path.join(dp,f))
    except: continue
    for n in z.namelist():
      if not n.endswith('.lang'): continue
      try: txt=z.read(n).decode('utf-8','ignore')
      except: continue
      for line in txt.splitlines():
        if '=' in line and not line.startswith('#'):
          k,_,v=line.partition('='); k=k.strip(); v=v.strip()
          if k.endswith('.name') and v and any('А'<=c<='я' or c in 'ёЁ' for c in v):
            names.setdefault(k,v)
# also lang/assets external dir
for dp,_,fs in os.walk(os.path.join(ROOT,'clients/techno_magic_rpg/main/lang')):
  for f in fs:
    if not f.endswith(('.lang','.properties')): continue
    try: txt=open(os.path.join(dp,f),encoding='utf-8',errors='ignore').read()
    except: continue
    for line in txt.splitlines():
      if '=' in line and not line.startswith('#'):
        k,_,v=line.partition('='); k=k.strip(); v=v.strip()
        if k.endswith('.name') and v and any('А'<=c<='я' for c in v): names.setdefault(k,v)
json.dump(names,open(os.path.join(WROOT,'names.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=0)
open(os.path.join(WROOT,'names.txt'),'w',encoding='utf-8').write('\n'.join(f"{k}={v}" for k,v in sorted(names.items())))
print("name entries:",len(names))

# 2) wiki index: id, resolved name, paragraphs
def resolve(idstr):
    # 'lolienergistics:BlockMolecularFarm' -> tile.blockMolecularFarm.name
    if ':' in idstr:
        mod,rn=idstr.split(':',1)
    else: rn=idstr
    cand=rn[0].lower()+rn[1:] if rn else rn
    for key in (f"tile.{cand}.name", f"item.{cand}.name", f"tile.{rn}.name", f"item.{rn}.name",
                f"{idstr}.name"):
        if key in names: return names[key]
    return None
wiki=[]
for fn in sorted(os.listdir(os.path.join(WROOT,'wiki'))):
    if not fn.endswith('.json'): continue
    try: j=json.load(open(os.path.join(WROOT,'wiki',fn),encoding='utf-8'))
    except: continue
    di=j.get('displayItem',{}); ids=di.get('id','') if isinstance(di,dict) else ''
    paras=j.get('paragraphs') or {}
    wiki.append({"file":fn,"system":fn.split('__')[0],"id":ids,
                 "name":resolve(ids) or j.get('title') or fn.replace('.json',''),
                 "paragraphs":paras})
json.dump(wiki,open(os.path.join(WROOT,'wiki_index.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=1)
withtext=sum(1 for w in wiki if w['paragraphs'])
print(f"wiki entries: {len(wiki)} (with text {withtext})")
bysys={}
for w in wiki: bysys[w['system']]=bysys.get(w['system'],0)+1
print("by system:",bysys)

# 3) recipe scripts -> per-script readable strings from compiled cache
data=open(os.path.join(ROOT,'clients/techno_magic_rpg/main/config/scripts_cache.dat'),'rb').read().decode('latin1')
zs=[(m.start(),m.group()) for m in re.finditer(r'[A-Za-z0-9_]+\.zs',data)]
os.makedirs(os.path.join(WROOT,'recipes'),exist_ok=True)
segs={}
for i,(pos,name) in enumerate(zs):
    end=zs[i+1][0] if i+1<len(zs) else len(data)
    seg=data[pos:end]
    refs=sorted(set(re.findall(r'\b[a-z][a-zA-Z0-9_]+:[A-Za-z0-9_.]+\b',seg)))
    refs=[r for r in refs if not r.split(':')[0] in ('java','javax','net','org','com','sun','jdk','loliland','minetweaker','stanhebben','scala','kotlin')]
    segs.setdefault(name,set()).update(refs)
out={k:sorted(v) for k,v in segs.items()}
json.dump(out,open(os.path.join(WROOT,'recipes','scripts_item_refs.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=0)
print("recipe scripts indexed:",len(out))
