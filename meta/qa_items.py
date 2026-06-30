import json,re,os,glob
BASE="/home/def/projects/misc/loliland-guidence"
# load guide
t=open(f"{BASE}/guide.js",encoding='utf-8').read()
g=json.loads(t.split("window.GUIDE =",1)[1].rsplit(";",1)[0].strip())
# registry corpus: names.txt values + strings/*.txt
def norm(s):
    s=re.sub(r'§.','',s)               # color codes
    s=s.lower().replace('ё','е')
    s=re.sub(r'[^a-zа-я0-9 ]',' ',s)
    return re.sub(r'\s+',' ',s).strip()
reg=set()
for line in open(f"{BASE}/data/names.txt",encoding='utf-8'):
    if '=' in line: reg.add(norm(line.split('=',1)[1]))
for f in glob.glob(f"{BASE}/data/strings/*.txt"):
    for line in open(f,encoding='utf-8'):
        n=norm(line)
        if n: reg.add(n)
regblob=' \n '.join(reg)
def known(item):
    n=norm(item)
    if not n or len(n)<2: return True
    if n in regblob: return True            # substring in registry
    toks=[w for w in n.split() if len(w)>=4]
    # token coverage: >=1 long token that appears, and phrase mostly present
    hits=sum(1 for w in toks if w in regblob)
    if toks and hits/len(toks)>=0.8: return True
    return False
flagged={}; total=0; flag=0
for s in g['sections']:
    miss=[]
    for st in s['steps']:
        for it in st.get('items',[]):
            total+=1
            if not known(it):
                miss.append(it); flag+=1
    if miss: flagged[s['key']]=sorted(set(miss))
json.dump(flagged,open(f"{BASE}/data/qa/flagged_items.json",'w',encoding='utf-8'),ensure_ascii=False,indent=1)
print(f"items checked: {total} | flagged (нет в реестре): {flag} ({100*flag//max(total,1)}%)")
print(f"sections with flags: {len(flagged)}")
for k,v in flagged.items(): print(f"  {k}: {len(v)} -> {', '.join(v[:6])}{'...' if len(v)>6 else ''}")
