#!/usr/bin/env python3
"""Finalize the 5-stage restructure: validate stage files, archive old mod-sections,
rebuild workflow_result.json (sections/order/milestones), rebuild guide.js."""
import json, os, glob, shutil, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def P(*a): return os.path.join(ROOT, *a)

STAGES = [f'stage{i}' for i in range(1,6)]
NOTE_FIELDS = ('serverNote','coop','opt','kit','skip','trap','trick','tipv')

stages = []
for k in STAGES:
    f = P('data','stages',f'{k}.json')
    d = json.load(open(f, encoding='utf-8'))
    assert d.get('key') == k and d.get('steps'), f'{k}: bad file'
    # normalize steps
    steps = []
    for st in d['steps']:
        o = {'title': str(st.get('title','')).strip(), 'detail': str(st.get('detail','')).strip(),
             'items': [str(x).strip() for x in (st.get('items') or []) if str(x).strip()],
             'serverNote': str(st.get('serverNote','') or '').strip(),
             'coop': str(st.get('coop','') or '').strip(),
             'optional': bool(st.get('optional', False))}
        for fld in ('opt','kit','skip','trap','trick','tipv'):
            v = str(st.get(fld,'') or '').strip()
            if v: o[fld] = v
        if o['title'] and o['detail']: steps.append(o)
    d['steps'] = steps
    d['confirmed'] = True
    stages.append(d)

req = sum(1 for s in stages for st in s['steps'] if not st['optional'])
tot = sum(len(s['steps']) for s in stages)
print('stages:', [(s['key'], len(s['steps'])) for s in stages], f'| steps {tot} (required {req})')
assert all(len(s['steps']) >= 10 for s in stages), 'suspiciously small stage'

# archive old mod-sections
arch = P('research','legacy_sections')
os.makedirs(arch, exist_ok=True)
moved = 0
for f in glob.glob(P('data','sections','*.json')):
    base = os.path.basename(f)
    if base.replace('.json','') not in STAGES:
        shutil.move(f, os.path.join(arch, base)); moved += 1
# stage files become the canonical sections
for s in stages:
    json.dump(s, open(P('data','sections',f"{s['key']}.json"),'w',encoding='utf-8'),
              ensure_ascii=False, indent=1)
print(f'archived {moved} legacy sections -> research/legacy_sections/')

MILESTONES = [
  {'at':'stage1','label':'База готова: реалм обустроен, молот/инструменты, шахта по трём мирам открыта, стартовые квесты закрыты'},
  {'at':'stage2','label':'Техника встала: стабильная EU-энергия, первая ME-сеть с автокрафтом, руда 1:6, наносет/квант'},
  {'at':'stage3','label':'Развитие закрыто: бесконечная мана, кровь T6 на потоке, эссенция и кодировщики автоматизированы, миллионные EU'},
  {'at':'stage4','label':'Эндгейм собран: Draconic и драконы закрыты, пчёлы-хаб, панели высоких тиров, нейтроний на потоке'},
  {'at':'stage5','label':'THE TRUE END: Катализаторы и Слитки Бесконечности, творческие предметы, Infinity-сет'},
]

wf = json.load(open(P('data','workflow_result.json'), encoding='utf-8'))
wf['sections'] = stages
order = wf.get('order') if isinstance(wf.get('order'), dict) else {}
order['order'] = STAGES
order['milestones'] = MILESTONES
order.pop('rationale', None)
wf['order'] = order
crit = wf.get('critique') or {}
crit['suggestedExtraSteps'] = []
wf['critique'] = crit
json.dump(wf, open(P('data','workflow_result.json'),'w',encoding='utf-8'), ensure_ascii=False, indent=1)

r = subprocess.run([sys.executable, P('meta','build_guide.py')], capture_output=True, text=True)
print(r.stdout.splitlines()[0] if r.stdout else '')
sys.exit(r.returncode)
