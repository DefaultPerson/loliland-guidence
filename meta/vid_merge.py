#!/usr/bin/env python3
"""Merge per-chunk beat files -> one ordered corpus + per-section buckets.
Validates each chunk file, dedupes chunk-boundary overlap, reports coverage."""
import json, os, glob, re, sys, difflib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def P(*a): return os.path.join(ROOT, *a)

BEATS_DIR = P('research', 'youtube', 'beats')
OUT_DIR = P('research', 'youtube', 'sections')
os.makedirs(OUT_DIR, exist_ok=True)

SECTIONS = ['start','tinkers','processing','thaumcraft','botania','bloodmagic','bees',
            'ae2','energistics','mekanism','dimensions','draconic','dragons',
            'relics_elements','avaritia']
# normalize off-list tags some agents emitted to the nearest real section
ALIAS = {'server': 'start', 'boss': 'dimensions', 'navigation': 'start',
         'nav': 'start', 'goal': 'misc', 'economy': 'start'}

files = sorted(glob.glob(os.path.join(BEATS_DIR, 'chunk_*.json')))
all_beats, bad, empty = [], [], []
present_chunks = set()
for f in files:
    idx = int(re.search(r'chunk_(\d+)', f).group(1))
    try:
        d = json.load(open(f, encoding='utf-8'))
    except Exception as e:
        bad.append((idx, str(e)[:80])); continue
    if not isinstance(d, list):
        # tolerate {"beats":[...]}
        d = d.get('beats', []) if isinstance(d, dict) else []
    if not d:
        empty.append(idx); continue
    present_chunks.add(idx)
    for b in d:
        if not isinstance(b, dict) or not b.get('detail'):
            continue
        b['chunk'] = idx
        sec = (b.get('section') or 'misc').strip()
        sec = ALIAS.get(sec, sec)
        if sec not in SECTIONS and sec != 'misc':
            sec = 'misc'
        b['section'] = sec
        all_beats.append(b)

# stable global order: by chunk, then seq
def seqkey(b):
    try: return (b['chunk'], float(b.get('seq', 0)))
    except Exception: return (b['chunk'], 0)
all_beats.sort(key=seqkey)

# dedupe chunk-boundary overlap: drop a beat if its detail is >0.88 similar to a
# beat from the immediately-preceding chunk within a small window
deduped, removed = [], 0
recent = []  # (chunk, detail) sliding window
for b in all_beats:
    dt = re.sub(r'\s+', ' ', b['detail']).strip().lower()
    dup = False
    for pc, pdt in recent[-12:]:
        if pc == b['chunk']:
            continue
        if b['chunk'] - pc == 1 and difflib.SequenceMatcher(None, dt[:220], pdt[:220]).ratio() > 0.88:
            dup = True; break
    if dup:
        removed += 1; continue
    deduped.append(b)
    recent.append((b['chunk'], dt))

# assign global id
for i, b in enumerate(deduped, 1):
    b['gid'] = i

json.dump(deduped, open(P('research', 'youtube', 'all_beats.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)

# per-section buckets (misc kept separate for manual routing)
buckets = {s: [] for s in SECTIONS}
buckets['misc'] = []
for b in deduped:
    buckets[b['section']].append(b)
for s, arr in buckets.items():
    json.dump(arr, open(os.path.join(OUT_DIR, f'{s}.beats.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)

# compact index (titles only) for chaptering / review
idx_lines = [f"{b['gid']:4d} | {b.get('pct',0):>4} | {b['section']:16s} | {b.get('kind','?'):8s} | {b.get('title','')[:80]}"
             for b in deduped]
open(P('research', 'youtube', 'beats_index.txt'), 'w', encoding='utf-8').write('\n'.join(idx_lines) + '\n')

print(f"chunk files: {len(files)} | valid: {len(present_chunks)} | bad: {bad} | empty: {empty}")
missing = [i for i in range(1, 44) if i not in present_chunks]
print(f"missing chunks (need re-run): {missing}")
print(f"beats total: {len(all_beats)} -> after boundary dedupe: {len(deduped)} (removed {removed})")
print("per-section beat counts:")
for s in SECTIONS + ['misc']:
    print(f"  {s:16s} {len(buckets[s]):4d}")
words = sum(len(re.sub(r'\s+',' ',b['detail']).split()) for b in deduped)
print(f"total beat-detail words: {words}")
