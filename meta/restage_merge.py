#!/usr/bin/env python3
"""Merge classify verdicts -> per-stage buckets for assembly.
Validates full coverage (every step classified exactly once), applies scrub overrides,
carries fold-content to targets, logs drops."""
import json, os, glob, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def P(*a): return os.path.join(ROOT, *a)

SECTIONS = ['start','tinkers','processing','thaumcraft','botania','bloodmagic','bees',
            'ae2','energistics','mekanism','dimensions','draconic','dragons','relics_elements','avaritia']
NOTE_FIELDS = ('serverNote','coop','opt','kit','skip','trap','trick','tipv')

secs = {k: json.load(open(P('data','sections',f'{k}.json'), encoding='utf-8')) for k in SECTIONS}
verdicts = {}
problems = []
for k in SECTIONS:
    f = P('research','restage',f'{k}.classify.json')
    if not os.path.exists(f):
        problems.append(f'missing classify: {k}'); continue
    try:
        arr = json.load(open(f, encoding='utf-8'))
    except Exception as e:
        problems.append(f'bad json {k}: {e}'); continue
    n = len(secs[k]['steps'])
    idxs = sorted(x.get('idx',-1) for x in arr)
    if idxs != list(range(n)):
        problems.append(f'{k}: coverage mismatch (steps {n}, classified {len(arr)}, idxs {idxs[:5]}...)')
    verdicts[k] = {x['idx']: x for x in arr}
if problems:
    print('PROBLEMS:'); [print(' -', p) for p in problems]
    if any('missing' in p or 'bad json' in p for p in problems): sys.exit(1)

buckets = {i: [] for i in range(1,6)}
drops, folds = [], []
for k in SECTIONS:
    for i, st in enumerate(secs[k]['steps']):
        v = verdicts[k].get(i)
        if not v: continue
        rec = dict(st)
        for fld, val in (v.get('scrub') or {}).items():
            if fld in ('title','detail','items') or fld in NOTE_FIELDS:
                rec[fld] = val
        rec['_src'] = f'{k}#{i}'
        rec['_stage'] = int(v.get('stage', 3))
        rec['_order'] = float(v.get('order', 50))
        act = v.get('action','keep')
        if act == 'drop':
            drops.append({'src': rec['_src'], 'title': st['title'], 'reason': v.get('reason','')}); continue
        if act == 'fold':
            folds.append({'src': rec['_src'], 'into': v.get('fold_into',''), 'rec': rec}); continue
        buckets[rec['_stage']].append(rec)

# attach fold-content to targets (same stage as target if target kept, else own stage)
by_src = {r['_src']: r for arr in buckets.values() for r in arr}
unresolved = 0
for f in folds:
    tgt = by_src.get(f['into'])
    if tgt is not None:
        tgt.setdefault('_folded', []).append({'src': f['src'], 'title': f['rec']['title'],
                                              'detail': f['rec'].get('detail',''),
                                              'notes': {n: f['rec'][n] for n in NOTE_FIELDS if f['rec'].get(n)}})
    else:
        f['rec'].setdefault('_note','fold target missing — kept as own step')
        buckets[f['rec']['_stage']].append(f['rec']); unresolved += 1

for i in buckets: buckets[i].sort(key=lambda r: (r['_order'], r['_src']))
os.makedirs(P('research','restage'), exist_ok=True)
for i, arr in buckets.items():
    json.dump(arr, open(P('research','restage',f'stage{i}.bucket.json'),'w',encoding='utf-8'),
              ensure_ascii=False, indent=1)
json.dump(drops, open(P('research','restage','drops.json'),'w',encoding='utf-8'), ensure_ascii=False, indent=1)

tot = sum(len(a) for a in buckets.values())
print(f'kept {tot} | dropped {len(drops)} | folded {len(folds)} (unresolved {unresolved})')
for i, arr in buckets.items():
    from collections import Counter
    src = Counter(r['_src'].split('#')[0] for r in arr)
    print(f'  stage{i}: {len(arr)} steps | {dict(src)}')
print('\nDROPS:')
for d in drops: print(f"  - {d['src']}: {d['title'][:60]} | {d['reason'][:80]}")
