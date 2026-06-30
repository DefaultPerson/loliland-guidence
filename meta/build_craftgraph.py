#!/usr/bin/env python3
"""Собирает craftgraph.js (window.CRAFT={nodes,edges}).
Режимы:
  python build_craftgraph.py firstcut   -> из data/craft/edges.json (черновой, шумный)
  python build_craftgraph.py curated     -> из data/craft/graph_parts.json (курировано воркфлоу)
"""
import json, sys, re, os
BASE = "/home/def/projects/misc/loliland-guidence"

def cat(s):
    s = s.lower()
    if re.search(r'drac|dragon|chaotic|gaia|wyvern|хаос|дракон|гайя|вивер', s): return 'dragons'
    if re.search(r'energon|neutron|matter|molecular|plasma|heliospher|crystal_char|материя|нейтрон|энергон|молекуляр|плазм', s): return 'energetics'
    if re.search(r'infinity|catalyst|crystal_matrix|singular|бесконечн|катализатор|сингуляр|матриц', s): return 'infinity'
    if re.search(r'blood|demon|necromancer|star_crystal|кров|демон|некромант|звёздн|звездн', s): return 'magic'
    return 'energetics'

def kind(rid, label):
    s = (rid + ' ' + label).lower()
    if re.search(r'pickaxe_ultra|infinity_(sword|pickaxe|axe|shovel|helmet|chestplate|legging|boot|hoe)|разрушител|легендарное сердце повелител', s): return 'goal'
    if re.search(r'block|tile\.|machine|farm|reactor|assembler|condenser|combiner|generator|синтезатор|преобразовател|реактор|ферма|сборщик|котёл|зарядник', s): return 'machine'
    if re.search(r'dust|nugget|ingot|пыль|самородок|слиток|осколок|эссенц|shard', s): return 'component'
    if re.search(r'ore|cobble|руда|булыжник', s): return 'raw'
    return 'intermediate'

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'firstcut'
    names_present = os.path.exists(f"{BASE}/data/names.txt")
    nodes = {}
    edges = []

    if mode == 'curated' and os.path.exists(f"{BASE}/data/craft/graph_parts.json"):
        parts = json.load(open(f"{BASE}/data/craft/graph_parts.json", encoding='utf-8'))
        for p in parts:
            for n in p.get('nodes', []):
                nodes[n['id']] = n
            edges += p.get('edges', [])
        sp = f"{BASE}/data/craft/sparkling_panel.json"
        if os.path.exists(sp):
            part = json.load(open(sp, encoding='utf-8'))
            for n in part.get('nodes', []):
                nodes[n['id']] = n
            edges += part.get('edges', [])
    else:
        ed = json.load(open(f"{BASE}/data/craft/edges.json", encoding='utf-8'))
        def add(rid, label):
            if rid not in nodes:
                nodes[rid] = {"id": rid, "label": label or rid.split(':')[-1], "category": cat(rid + ' ' + (label or '')), "kind": kind(rid, label or ''), "tier": 0}
        for prod, info in ed.items():
            add(prod, info.get('ru', ''))
            for p in info.get('pool', [])[:8]:
                add(p['ref'], p.get('ru', ''))
                edges.append({"from": p['ref'], "to": prod})

    # dedup edges
    seen = set(); ue = []
    for e in edges:
        k = (e['from'], e['to'])
        if e['from'] != e['to'] and e['from'] in nodes and e['to'] in nodes and k not in seen:
            seen.add(k); ue.append(e)
    edges = ue

    # tier = longest path from raw (ingredient depth), cycle-guarded
    ingr = {}
    for e in edges:
        ingr.setdefault(e['to'], []).append(e['from'])
    memo = {}
    def tier(n, stack):
        if n in memo: return memo[n]
        if n in stack: return 0
        ins = ingr.get(n, [])
        if not ins: memo[n] = 0; return 0
        t = 1 + max((tier(i, stack | {n}) for i in ins), default=-1)
        memo[n] = t; return t
    for nid in nodes:
        nodes[nid]['tier'] = tier(nid, set())

    # goal = kind goal OR not consumed anywhere (top), with decent depth
    consumed = {e['from'] for e in edges}
    for nid, n in nodes.items():
        if n['kind'] == 'goal': continue
        nm = (nid + ' ' + n['label']).lower()
        if re.search(r'ore|руда|cobble|булыжник|dust|пыль|ingot|слиток|nugget|самородок|эссенц|essence', nm): continue
        if nid not in consumed and n['tier'] >= 4 and n['kind'] != 'raw' and ingr.get(nid) and n['category'] in ('infinity', 'dragons', 'energetics'):
            n['kind'] = 'goal'

    # --- enrichment: station (где крафтится) / source (как добыть) / stage (этап) ---
    STATION_BY_CAT = {
        'Avaritia': 'Ужасающий верстак 9×9', 'Бесконечность': 'Ужасающий верстак 9×9', 'Панель': 'Ужасающий верстак 9×9',
        'Сингулярность': 'Молекулярный сборщик / Кодировщик',
        'matter': 'Сборщик материи', 'Материя': 'Сборщик материи', 'molecular': 'Молекулярный сборщик',
        'neutron': 'Сборщик / компрессор нейтрония', 'energon': 'Энергонный синтезатор', 'plasma': 'Плазменный зарядник',
        'heliospher': 'Гелиосферное зарядное ядро', 'crystal_charg': 'Зарядник кристаллов',
        'Кровь': 'Кровавый алтарь / Кровавый сборщик', 'Магия': 'Магический сборщик / Руническая матрица', 'Кристалл': 'Магический сборщик',
        'Катализатор': 'Молекулярный сборщик', 'Реликвии': 'Молекулярный сборщик', 'Техно': 'Молекулярный сборщик',
        'dragon': 'Внеземной дракониевый корпус создания', 'chaotic': 'Внеземной дракониевый корпус создания',
        'draconium': 'Внеземной дракониевый корпус создания', 'Драконий': 'Внеземной дракониевый корпус создания',
        'gaia_soul': 'Руническая матрица (ритуал Гайи)', 'Божественный': 'Молекулярный сборщик',
        'Botania': 'Руническая матрица / Магический сборщик', 'Forestry': 'Совершенная центрифуга / Пчелиная фабрика',
    }
    st_file = f"{BASE}/data/craft/stations.json"
    if os.path.exists(st_file):
        stmap = json.load(open(st_file, encoding='utf-8'))
        for nid, enr in stmap.items():
            if nid.startswith('_') or nid not in nodes or not isinstance(enr, dict):
                continue
            if enr.get('station'): nodes[nid]['station'] = enr['station']
            if enr.get('source'): nodes[nid]['source'] = enr['source']

    def def_station(cat):
        if not cat: return None
        for key in (cat, cat.split('/')[0]):
            if key in STATION_BY_CAT: return STATION_BY_CAT[key]
        return None

    STAGE_NAME = {1: 'Старт · сырьё', 2: 'Материя и энергия', 3: 'Драконы и души', 4: 'Звёзды и сингулярности', 5: 'Финал'}
    def stage_of(t): return 1 if t <= 2 else 2 if t <= 7 else 3 if t <= 13 else 4 if t <= 19 else 5
    for nid, n in nodes.items():
        if n.get('kind') in ('component', 'intermediate', 'goal') and not n.get('station'):
            ds = def_station(n.get('category', ''))
            if ds: n['station'] = ds
        n['stage'] = stage_of(n.get('tier', 0))
        n['stageName'] = STAGE_NAME[n['stage']]

    icons = {}
    if os.path.exists(f"{BASE}/data/icons_map.json"):
        icons = json.load(open(f"{BASE}/data/icons_map.json", encoding='utf-8'))
    out = {"nodes": list(nodes.values()), "edges": edges, "icons": icons}
    with open(f"{BASE}/craftgraph.js", "w", encoding='utf-8') as f:
        f.write("/* Авто-сгенерировано build_craftgraph.py (%s). */\n" % mode)
        f.write("window.CRAFT = ")
        json.dump(out, f, ensure_ascii=False, indent=0)
        f.write(";\n")
    goals = [n for n in nodes.values() if n['kind'] == 'goal']
    print(f"craftgraph.js [{mode}]: {len(nodes)} nodes, {len(edges)} edges, {len(goals)} goals, maxtier={max((n['tier'] for n in nodes.values()), default=0)}")
    print("goals:", [n['label'] for n in goals[:12]])

if __name__ == '__main__':
    main()
