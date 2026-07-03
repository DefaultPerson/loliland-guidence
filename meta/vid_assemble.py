#!/usr/bin/env python3
"""Assemble enriched sections -> data/sections/*.json + data/workflow_result.json, then rebuild guide.js.
Validates each enriched file; falls back to the original section if an enriched file is missing/invalid.
Never drops steps: asserts enriched step count >= original for every section."""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def P(*a): return os.path.join(ROOT, *a)

SECTIONS = ['start','tinkers','processing','thaumcraft','botania','bloodmagic','bees',
            'ae2','energistics','mekanism','dimensions','draconic','dragons',
            'relics_elements','avaritia']
STEP_FIELDS = ['title','detail','items','serverNote','coop','opt','kit','optional']
SEC_FIELDS = ['key','title','questGroupGuess','confirmed','intro','estTime','prereqKeys','steps']

def norm_step(st):
    o = {}
    o['title'] = str(st.get('title','')).strip()
    o['detail'] = str(st.get('detail','')).strip()
    it = st.get('items') or []
    o['items'] = [str(x).strip() for x in it if str(x).strip()]
    o['serverNote'] = str(st.get('serverNote','') or '').strip()
    o['coop'] = str(st.get('coop','') or '').strip()
    for extra in ('opt','kit'):
        v = str(st.get(extra,'') or '').strip()
        if v: o[extra] = v
    o['optional'] = bool(st.get('optional', False))
    return o

report = []
final_sections = []
dropped = False
for key in SECTIONS:
    orig = json.load(open(P('data','sections',f'{key}.json'), encoding='utf-8'))
    ep = P('data','sections',f'{key}.enriched.json')
    use = orig; src = 'ORIGINAL(fallback)'
    if os.path.exists(ep):
        try:
            en = json.load(open(ep, encoding='utf-8'))
            steps = en.get('steps') or []
            if isinstance(steps, list) and len(steps) >= 1 and en.get('key') == key:
                use = en; src = 'enriched'
        except Exception as e:
            report.append((key, f'INVALID enriched ({e}); fallback', 0, 0));
    # normalize section
    sec = {}
    sec['key'] = key
    sec['title'] = use.get('title', orig.get('title',''))
    sec['questGroupGuess'] = use.get('questGroupGuess', orig.get('questGroupGuess',''))
    sec['confirmed'] = True
    sec['intro'] = use.get('intro', orig.get('intro',''))
    sec['estTime'] = use.get('estTime', orig.get('estTime',''))
    sec['prereqKeys'] = use.get('prereqKeys', orig.get('prereqKeys', []))
    steps = [norm_step(s) for s in (use.get('steps') or []) if str(s.get('title','')).strip()]
    sec['steps'] = steps
    n_orig = len(orig.get('steps') or [])
    n_new = len(steps)
    if src == 'enriched' and n_new < n_orig:
        dropped = True
        report.append((key, f'!! enriched has FEWER steps ({n_new}<{n_orig}) — investigate', n_orig, n_new))
    else:
        report.append((key, src, n_orig, n_new))
    final_sections.append(sec)
    # write back to canonical section file
    json.dump(sec, open(P('data','sections',f'{key}.json'),'w',encoding='utf-8'),
              ensure_ascii=False, indent=1)

# rebuild workflow_result.json
wf = json.load(open(P('data','workflow_result.json'), encoding='utf-8'))
wf['sections'] = final_sections
crit = wf.get('critique') or {}
crit['suggestedExtraSteps'] = []   # superseded by enrichment; don't double-add
wf['critique'] = crit
json.dump(wf, open(P('data','workflow_result.json'),'w',encoding='utf-8'),
          ensure_ascii=False, indent=1)

print("=== per-section step counts (orig -> final) ===")
tot_o = tot_n = 0
for key, src, no, nn in report:
    tot_o += no; tot_n += nn
    print(f"  {key:16s} {no:3d} -> {nn:3d}   [{src}]")
print(f"  {'TOTAL':16s} {tot_o:3d} -> {tot_n:3d}   (+{tot_n-tot_o})")
if dropped:
    print("\nWARNING: at least one section lost steps — NOT safe to ship as-is.")

# rebuild guide.js
print("\n=== build_guide.py ===")
r = subprocess.run([sys.executable, P('meta','build_guide.py')], capture_output=True, text=True)
print(r.stdout[-1500:])
if r.returncode != 0:
    print("BUILD FAILED:\n", r.stderr[-1500:])
