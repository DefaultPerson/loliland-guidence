#!/usr/bin/env python3
"""Apply lifehacks-dissolve patches: append note texts to steps, insert new optional steps,
remove the lifehacks section from the build, rebuild guide.js.
Usage: vid_lifehacks_apply.py <patches.json>"""
import json, os, sys, subprocess, difflib, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def P(*a): return os.path.join(ROOT, *a)

patches = json.load(open(sys.argv[1], encoding='utf-8'))
if isinstance(patches, dict): patches = patches.get('patches', [])

VALID = {'skip','trap','trick','tipv'}
def similar(a, b):
    a=re.sub(r'\s+',' ',a).strip().lower(); b=re.sub(r'\s+',' ',b).strip().lower()
    if a in b or b in a: return True
    return difflib.SequenceMatcher(None, a[:180], b[:180]).ratio() > 0.8

added_notes = skipped_dup = added_steps = oob = 0
for p in patches:
    key = p['key']
    fp = P('data','sections',f'{key}.json')
    sec = json.load(open(fp, encoding='utf-8'))
    steps = sec['steps']
    # notes first (indices refer to current arrays)
    for n in p.get('notes', []):
        si, fld, txt = n['step'], n['field'], (n['text'] or '').strip()
        if fld not in VALID or not txt: continue
        if not (0 <= si < len(steps)): oob += 1; continue
        st = steps[si]
        # skip if near-duplicate of any existing note on this step or its detail
        blob = ' '.join(str(st.get(f,'')) for f in ('skip','trap','trick','tipv','opt')) + ' ' + st.get('detail','')
        if any(similar(txt, part) for part in blob.split(' • ') if part.strip()) or similar(txt, st.get(fld,'') or 'ØØ'):
            skipped_dup += 1; continue
        st[fld] = (st.get(fld,'').rstrip() + ' • ' + txt).strip(' •').strip()
        added_notes += 1
    # new steps: apply in descending 'after' so indices stay valid
    for ns in sorted(p.get('new_steps', []), key=lambda x: -int(x.get('after', len(steps)))):
        after = int(ns.get('after', len(steps)-1))
        pos = max(0, min(len(steps), after+1))
        steps.insert(pos, {
            'title': ns['title'].strip(), 'detail': ns['detail'].strip(),
            'items': [str(x).strip() for x in (ns.get('items') or []) if str(x).strip()],
            'serverNote': '', 'coop': '', 'optional': bool(ns.get('optional', True)),
        })
        added_steps += 1
    json.dump(sec, open(fp,'w',encoding='utf-8'), ensure_ascii=False, indent=1)

print(f"notes appended: {added_notes} (dup-skipped {skipped_dup}, out-of-range {oob}) | new steps: {added_steps}")

# --- remove lifehacks from the build; archive its file ---
lh = P('data','sections','lifehacks.json')
if os.path.exists(lh):
    os.replace(lh, P('research','youtube','insights','lifehacks_dissolved.json'))
    print("lifehacks.json archived to research/youtube/insights/")

wf = json.load(open(P('data','workflow_result.json'), encoding='utf-8'))
wf['sections'] = [s for s in wf['sections'] if s.get('key') != 'lifehacks']
if isinstance(wf.get('order'), dict):
    wf['order']['order'] = [k for k in wf['order']['order'] if k != 'lifehacks']
# refresh the 15 sections from files (they just changed)
by = {s['key']: s for s in wf['sections']}
for key in list(by):
    fp = P('data','sections',f'{key}.json')
    if os.path.exists(fp):
        by[key].update(json.load(open(fp, encoding='utf-8')))
json.dump(wf, open(P('data','workflow_result.json'),'w',encoding='utf-8'), ensure_ascii=False, indent=1)
print(f"sections in build: {len(wf['sections'])} | order: {len(wf['order']['order'])}")

r = subprocess.run([sys.executable, P('meta','build_guide.py')], capture_output=True, text=True)
print(r.stdout.splitlines()[0] if r.stdout else '')
if r.returncode != 0: print("BUILD FAILED:\n", r.stderr[-800:])
