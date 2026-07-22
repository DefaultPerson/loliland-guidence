#!/usr/bin/env python3
"""Apply the 5->7 stage split: split stage3/stage4 per spec, renumber to stage1..7,
fix prereq chains and titles, rebuild workflow_result (order/milestones), rebuild guide.js.
Usage: stage_split_apply.py research/restage/split_spec.json"""
import json, os, sys, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def P(*a): return os.path.join(ROOT, *a)

spec = json.load(open(sys.argv[1], encoding='utf-8'))
S3, S4 = spec['s3'], spec['s4']

def split(stage_key, sp):
    d = json.load(open(P('data','sections',f'{stage_key}.json'), encoding='utf-8'))
    steps = d['steps']
    cut = int(sp['split_at'])
    assert 10 < cut < len(steps)-10, f'{stage_key}: bad split_at {cut}/{len(steps)}'
    part1, part2 = steps[:cut], steps[cut:]
    # apply moves (idx in ORIGINAL numbering)
    for mv in sorted(sp.get('moves', []), key=lambda m: -int(m['idx'])):
        i, tp = int(mv['idx']), int(mv['to_part'])
        st = steps[i]
        if tp == 2 and i < cut:
            part1.remove(st); part2.insert(0, st)
        elif tp == 1 and i >= cut:
            part2.remove(st); part1.append(st)
    return d, part1, part2

d3, p3a, p3b = split('stage3', S3)
d4, p4a, p4b = split('stage4', S4)

old = {k: json.load(open(P('data','sections',f'{k}.json'), encoding='utf-8'))
       for k in ('stage1','stage2','stage5')}

NEW = [
  ('stage1', old['stage1']['title'].split('. ',1)[1] if '. ' in old['stage1']['title'] else old['stage1']['title'],
   old['stage1']['intro'], old['stage1']['estTime'], old['stage1']['steps'], None),
  ('stage2', old['stage2']['title'].split('. ',1)[1] if '. ' in old['stage2']['title'] else old['stage2']['title'],
   old['stage2']['intro'], old['stage2']['estTime'], old['stage2']['steps'], None),
  ('stage3', S3['part1']['title'], S3['part1']['intro'], S3['part1']['estTime'], p3a, S3['part1']['milestone']),
  ('stage4', S3['part2']['title'], S3['part2']['intro'], S3['part2']['estTime'], p3b, S3['part2']['milestone']),
  ('stage5', S4['part1']['title'], S4['part1']['intro'], S4['part1']['estTime'], p4a, S4['part1']['milestone']),
  ('stage6', S4['part2']['title'], S4['part2']['intro'], S4['part2']['estTime'], p4b, S4['part2']['milestone']),
  ('stage7', old['stage5']['title'].split('. ',1)[1] if '. ' in old['stage5']['title'] else old['stage5']['title'],
   old['stage5']['intro'], old['stage5']['estTime'], old['stage5']['steps'], None),
]

# old milestones for 1,2,7 come from workflow_result
wf = json.load(open(P('data','workflow_result.json'), encoding='utf-8'))
oldms = {m['at']: m['label'] for m in wf['order'].get('milestones', [])}
MS_FALLBACK = {'stage1': oldms.get('stage1',''), 'stage2': oldms.get('stage2',''), 'stage7': oldms.get('stage5','')}

secs, ms = [], []
for i, (key, title, intro, est, steps, mstone) in enumerate(NEW, 1):
    sec = {'key': key, 'title': f'Этап {i}. {title}', 'questGroupGuess': '', 'confirmed': True,
           'intro': intro, 'estTime': est, 'prereqKeys': [] if i == 1 else [f'stage{i-1}'],
           'steps': steps}
    secs.append(sec)
    label = mstone or MS_FALLBACK.get(key, '')
    if label: ms.append({'at': key, 'label': label})

# remove old stage5 file leftover (renamed to stage7)
for k in ('stage5','stage6','stage7'):
    fp = P('data','sections',f'{k}.json')
    if os.path.exists(fp): os.remove(fp)
for sec in secs:
    json.dump(sec, open(P('data','sections',f"{sec['key']}.json"),'w',encoding='utf-8'),
              ensure_ascii=False, indent=1)

wf['sections'] = secs
wf['order']['order'] = [s['key'] for s in secs]
wf['order']['milestones'] = ms
json.dump(wf, open(P('data','workflow_result.json'),'w',encoding='utf-8'), ensure_ascii=False, indent=1)

print('stages:', [(s['key'], len(s['steps']), s['title'][:45]) for s in secs])
print('milestones:', len(ms))
r = subprocess.run([sys.executable, P('meta','build_guide.py')], capture_output=True, text=True)
print(r.stdout.splitlines()[0] if r.stdout else '')
sys.exit(r.returncode)
