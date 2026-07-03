#!/usr/bin/env python3
"""Apply mined insights: inline skip/trap/trick/tipv notes on steps + add the lifehacks cheat-sheet section.
Idempotent: clears the 4 insight note-fields before re-applying, so re-runs don't duplicate."""
import json, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def P(*a): return os.path.join(ROOT, *a)

SECTIONS = ['start','tinkers','processing','thaumcraft','botania','bloodmagic','bees',
            'ae2','energistics','mekanism','dimensions','draconic','dragons','relics_elements','avaritia']
NOTE_FIELDS = ('skip','trap','trick','tipv')
VALID = set(NOTE_FIELDS)

applied = 0; skipped_oob = 0; per_field = {f:0 for f in NOTE_FIELDS}
for key in SECTIONS:
    sec = json.load(open(P('data','sections',f'{key}.json'), encoding='utf-8'))
    steps = sec.get('steps', [])
    # idempotent reset of the 4 insight fields
    for st in steps:
        for f in NOTE_FIELDS: st.pop(f, None)
    ap = P('research','youtube','insights','attach',f'{key}.json')
    if os.path.exists(ap):
        try:
            data = json.load(open(ap, encoding='utf-8'))
            atts = data.get('attachments', data) if isinstance(data, dict) else data
        except Exception as e:
            print(f"  WARN {key}: bad attach file ({e})"); atts = []
        # group by (step, field) -> merge texts
        merged = {}
        for a in (atts or []):
            try: si = int(a.get('step', -1))
            except Exception: si = -1
            fld = (a.get('field') or '').strip()
            txt = (a.get('text') or '').strip()
            if fld not in VALID or not txt: continue
            if si < 0: continue
            if si >= len(steps): skipped_oob += 1; continue
            merged.setdefault((si, fld), []).append(txt)
        for (si, fld), texts in merged.items():
            # dedupe identical, join
            seen=[];
            for t in texts:
                if t not in seen: seen.append(t)
            steps[si][fld] = ' • '.join(seen)
            applied += 1; per_field[fld] += 1
    json.dump(sec, open(P('data','sections',f'{key}.json'),'w',encoding='utf-8'),
              ensure_ascii=False, indent=1)

print(f"inline notes applied: {applied} (by field {per_field}); out-of-range dropped: {skipped_oob}")

# ---- lifehacks cheat-sheet section ----
lh_path = P('data','sections','lifehacks.json')
STEP_FIELDS_KEEP = ('title','detail','items','serverNote','coop','opt','kit','optional')
if os.path.exists(lh_path):
    lh = json.load(open(lh_path, encoding='utf-8'))
    # normalize
    norm = {'key':'lifehacks','title':lh.get('title','Скипы, хитрости и грабли (не повторяй за автором)'),
            'questGroupGuess':lh.get('questGroupGuess',''),'confirmed':True,
            'intro':lh.get('intro',''),'estTime':lh.get('estTime','читать по ходу'),'prereqKeys':[]}
    steps=[]
    for s in lh.get('steps', []):
        if not str(s.get('title','')).strip(): continue
        st={'title':str(s.get('title','')).strip(),'detail':str(s.get('detail','')).strip(),
            'items':[str(x).strip() for x in (s.get('items') or []) if str(x).strip()],
            'serverNote':str(s.get('serverNote','') or '').strip(),'coop':str(s.get('coop','') or '').strip(),
            # required (optional:false) so this "read me first" stage has real progress and
            # doesn't leave hereSection() stuck on a 0-required section forever.
            'optional':False}
        steps.append(st)
    norm['steps']=steps
    json.dump(norm, open(lh_path,'w',encoding='utf-8'), ensure_ascii=False, indent=1)
    lh_steps=len(steps)
else:
    norm=None; lh_steps=0
    print("  WARN: data/sections/lifehacks.json missing — cheat-sheet not built")

# ---- rebuild workflow_result.json ----
wf = json.load(open(P('data','workflow_result.json'), encoding='utf-8'))
secs = [s for s in wf['sections'] if s.get('key') != 'lifehacks']  # drop old copy if any
# reload enriched sections (with the freshly applied inline notes) for the 15
by = {}
for key in SECTIONS:
    by[key] = json.load(open(P('data','sections',f'{key}.json'), encoding='utf-8'))
new_secs = ([norm] if norm else []) + [by[s['key']] if s.get('key') in by else s for s in secs]
wf['sections'] = new_secs
# order: lifehacks first
order = wf.get('order') or {}
if isinstance(order, dict):
    lst = [k for k in (order.get('order') or []) if k != 'lifehacks']
    order['order'] = (['lifehacks'] if norm else []) + lst
    wf['order'] = order
json.dump(wf, open(P('data','workflow_result.json'),'w',encoding='utf-8'), ensure_ascii=False, indent=1)

print(f"lifehacks steps: {lh_steps} | sections now: {len(new_secs)}")
print("\n=== build_guide.py ===")
r = subprocess.run([sys.executable, P('meta','build_guide.py')], capture_output=True, text=True)
print(r.stdout.splitlines()[0] if r.stdout else '', '...')
if r.returncode != 0: print("BUILD FAILED:\n", r.stderr[-1200:])
