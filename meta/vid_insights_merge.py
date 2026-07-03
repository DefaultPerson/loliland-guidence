#!/usr/bin/env python3
"""Merge per-chunk insight files -> deduped, section-bucketed insights for the guide update."""
import json, os, glob, re, difflib
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def P(*a): return os.path.join(ROOT, *a)

SECTIONS = ['start','tinkers','processing','thaumcraft','botania','bloodmagic','bees',
            'ae2','energistics','mekanism','dimensions','draconic','dragons','relics_elements','avaritia']
CATS = {'skip','trap','trick','viewer_tip'}
CAT_ALIAS = {'regret':'trap','mistake':'trap','viewer':'viewer_tip','tip':'viewer_tip',
             'dupe':'trick','hack':'trick','shortcut':'skip','skips':'skip'}

files = sorted(glob.glob(P('research','youtube','insights','chunk_*.json')))
raw, bad, present = [], [], set()
for f in files:
    idx = int(re.search(r'chunk_(\d+)', f).group(1))
    try:
        d = json.load(open(f, encoding='utf-8'))
    except Exception as e:
        bad.append((idx, str(e)[:60])); continue
    if isinstance(d, dict): d = d.get('insights', [])
    present.add(idx)
    for it in (d or []):
        if not isinstance(it, dict) or not it.get('detail'): continue
        cat = (it.get('category') or '').strip().lower()
        cat = CAT_ALIAS.get(cat, cat)
        if cat not in CATS: cat = 'trick'
        sec = (it.get('section') or 'start').strip()
        if sec not in SECTIONS: sec = 'start'
        it['category'] = cat; it['section'] = sec; it['chunk'] = idx
        it['impact'] = (it.get('impact') or 'med').strip().lower()
        raw.append(it)

# dedupe near-identical (same category, detail >0.86 similar)
raw.sort(key=lambda x: (x['section'], x['category'], x['chunk']))
dedup, removed = [], 0
seen = []
for it in raw:
    key = re.sub(r'\s+',' ', it['detail']).strip().lower()
    dup = False
    for pc, pk in seen[-40:]:
        if pc == it['category'] and difflib.SequenceMatcher(None, key[:200], pk[:200]).ratio() > 0.86:
            dup = True; break
    if dup: removed += 1; continue
    dedup.append(it); seen.append((it['category'], key))

for i, it in enumerate(dedup, 1): it['gid'] = i

os.makedirs(P('research','youtube','insights','by_section'), exist_ok=True)
buckets = {s: [] for s in SECTIONS}
for it in dedup: buckets[it['section']].append(it)
for s, arr in buckets.items():
    json.dump(arr, open(P('research','youtube','insights','by_section',f'{s}.json'),'w',encoding='utf-8'),
              ensure_ascii=False, indent=1)
json.dump(dedup, open(P('research','youtube','insights','all_insights.json'),'w',encoding='utf-8'),
          ensure_ascii=False, indent=1)
# compact index for the cheat-sheet curator
lines = [f"{it['gid']:4d} | {it['category']:10s} | {it['section']:15s} | {it['impact']:4s} | {it.get('title','')[:70]} :: {it['detail'][:130]}"
         for it in dedup]
open(P('research','youtube','insights','index.txt'),'w',encoding='utf-8').write('\n'.join(lines)+'\n')

from collections import Counter
print(f"chunk files: {len(files)} valid {len(present)} bad {bad}")
print(f"insights: {len(raw)} -> deduped {len(dedup)} (removed {removed})")
print("by category:", dict(Counter(it['category'] for it in dedup)))
print("by impact:", dict(Counter(it['impact'] for it in dedup)))
print("by section:")
for s in SECTIONS:
    c = Counter(it['category'] for it in buckets[s])
    print(f"  {s:15s} {len(buckets[s]):3d}  {dict(c)}")
