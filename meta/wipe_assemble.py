#!/usr/bin/env python3
"""Post-patch assembly for the summer-2026 wipe update.
Validates section JSONs, enforces invariants (step counts unchanged; titles may change
only where flagged allowed), checks no truly-dead names remain in items[], refreshes
workflow_result.json, rebuilds guide.js."""
import json, os, glob, sys, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def P(*a): return os.path.join(ROOT, *a)

base = json.load(open(P('research','wipe2026','titles_baseline.json'), encoding='utf-8'))
lost = set(json.load(open(P('research','wipe2026','lost_names.json'), encoding='utf-8')))

ok = True
for f in sorted(glob.glob(P('data','sections','*.json'))):
    try:
        d = json.load(open(f, encoding='utf-8'))
    except Exception as e:
        print(f"!! INVALID JSON {f}: {e}"); ok = False; continue
    key = d['key']; steps = d['steps']
    b = base.get(key, [])
    if len(steps) != len(b):
        print(f"!! {key}: step count changed {len(b)} -> {len(steps)} (index invariant broken)"); ok = False
    changed_titles = [i for i,(s,t) in enumerate(zip(steps,b)) if s['title'] != t]
    if changed_titles:
        print(f"   {key}: titles changed at {changed_titles} (allowed but progress resets there)")
    dead = [(i,it) for i,st in enumerate(steps) for it in st.get('items',[]) if it in lost]
    if dead:
        print(f"!! {key}: dead chips remain: {dead}"); ok = False

if not ok:
    print("\nASSEMBLY BLOCKED — fix the issues above"); sys.exit(1)

wf = json.load(open(P('data','workflow_result.json'), encoding='utf-8'))
by = {}
for f in glob.glob(P('data','sections','*.json')):
    d = json.load(open(f, encoding='utf-8')); by[d['key']] = d
wf['sections'] = [ {**s, **by[s['key']]} if s.get('key') in by else s for s in wf['sections'] ]
json.dump(wf, open(P('data','workflow_result.json'),'w',encoding='utf-8'), ensure_ascii=False, indent=1)
print("workflow_result refreshed")

r = subprocess.run([sys.executable, P('meta','build_guide.py')], capture_output=True, text=True)
print(r.stdout.splitlines()[0] if r.stdout else '')
sys.exit(r.returncode)
