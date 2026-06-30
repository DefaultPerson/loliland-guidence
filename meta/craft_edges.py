import json,re,os
BASE="/home/def/projects/misc/loliland-guidence"
idmap=json.load(open(f"{BASE}/data/idmap.json"))
names={}
for line in open(f"{BASE}/data/names.txt",encoding='utf-8'):
    if '=' in line: k,_,v=line.partition('='); names[k.strip()]=v.strip()
def rus(ref):
    if ':' not in ref: 
        for k in (f"item.{ref}.name",f"tile.{ref}.name"):
            if k in names: return names[k]
        return ''
    mod,it=ref.split(':',1)
    for c in (f"{mod}:item.{it}.name",f"{mod}:tile.{it}.name",f"item.{it}.name",f"tile.{it}.name",
              f"item.{it[0].lower()+it[1:]}.name",f"tile.{it[0].lower()+it[1:]}.name"):
        if c in names: return names[c]
    for k,v in names.items():
        if k.endswith(f"{it}.name"): return v
    return ''
data=open(f"{BASE}/config_scripts_cache.dat" if os.path.exists(f"{BASE}/config_scripts_cache.dat") else "/home/def/Games/loliland/clients/techno_magic_rpg/main/config/scripts_cache.dat",'rb').read().decode('latin1')
KW=re.compile(r'infinity|neutron|crystal_matrix|catalyst|energon|matter|molecular|draconium|gaia_soul|chaotic_core|dragon.*(heart|soul|core)|singular|legendary',re.I)
targets=[(rid,reg) for rid,reg in idmap.items() if KW.search(reg)]
edges={}
for rid,reg in targets:
    it=reg.split(':',1)[1] if ':' in reg else reg
    pos=data.find(it)
    if pos<0: continue
    seg=data[max(0,pos-600):pos+600]
    pool=[]
    for m in re.finditer(r'[A-Za-z][a-zA-Z0-9_]+:[A-Za-z0-9_.]+', seg):
        r=m.group()
        if r.split(':')[0] in ('java','javax','net','org','com','sun','jdk','scala','minetweaker','stanhebben'): continue
        if r==reg: continue
        if r not in [p['ref'] for p in pool]: pool.append({'ref':r,'ru':rus(r)})
    if pool:
        edges[reg]={'ru':rus(reg),'pool':pool[:24]}
json.dump(edges,open(f"{BASE}/data/craft/edges.json",'w',encoding='utf-8'),ensure_ascii=False,indent=0)
print("targets matched:",len(targets),"| with pool:",len(edges))
# sample
for reg in list(edges)[:5]:
    e=edges[reg]; print(f"  {e['ru'] or reg}: {', '.join(p['ru'] or p['ref'] for p in e['pool'][:6])}")
