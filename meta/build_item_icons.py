#!/usr/bin/env python3
"""Resolve guide step item names (RU/EN) to clean extracted client textures.
Precision-first: exact normalized match, then IDF-weighted high-confidence fuzzy,
plus curated overrides and a generic-name blocklist. Wrong icon > no icon, so we
err toward leaving an item text-only.

Output: data/item_icons.json  { "<item name>": "icons/<file>.png", ... }"""
import json, os, re, glob, collections, math

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def P(*a): return os.path.join(ROOT, *a)

# only real mod prefixes — drops truncated dup files (nsions_/ons_/gistics_/…)
VALID_PREFIX = {
    'lolienergistics', 'lolidimensions', 'lolimagically', 'loli', 'lolienergyrelics',
    'divinerpg', 'AWWayofTime', 'DraconicEvolution', 'Botania', 'Avaritia', 'minecraft',
    'IC2', 'uniresources', 'BloodArsenal', 'ThermalExpansion', 'alfheim', 'Forestry',
    'Thaumcraft', 'cs', 'gendustry', 'tm', 'worldgen', 'TaintedMagic',
}
import shutil
# candidate icons: curated icons/ (mangled prefixes dropped) + full staging meta/tex/
ICON_SRC = {}   # filename -> abs source path (icons/ wins on dup)
for f in sorted(os.listdir(P('icons'))):
    if f.endswith('.png') and not f.startswith('g_') and f.split('_')[0] in VALID_PREFIX:
        ICON_SRC[f] = P('icons', f)
TEXDIR = P('meta', 'tex')
if os.path.isdir(TEXDIR):
    for f in sorted(os.listdir(TEXDIR)):
        if f.endswith('.png') and f not in ICON_SRC:
            ICON_SRC[f] = os.path.join(TEXDIR, f)
ICON_FILES = sorted(ICON_SRC)

# ---------- curated overrides (highest priority) ----------
MANUAL = {
    # vanilla / common
    "Алмаз": "minecraft_diamond", "Алмазы": "minecraft_diamond",
    "Уголь": "minecraft_coal_block", "Угольный блок": "minecraft_coal_block",
    "Редстоун": "minecraft_redstone", "Красная пыль": "minecraft_redstone", "Красный камень": "minecraft_redstone",
    "Изумруд": "minecraft_emerald",
    "Земля": "minecraft_dirt",
    "Медь": "uniresources_blockCopper", "Медный блок": "uniresources_blockCopper",
    "Олово": "uniresources_blockTin", "Никель": "uniresources_blockNickel",
    "Свинец": "uniresources_ingotLead", "Мифрил": "uniresources_ingotMithril",
    "Эндериум": "uniresources_blockEnderium",
    # custom (fix common mismatches)
    "Адская звезда": "lolidimensions_hell_star", "Адская наковальня": "lolidimensions_hell_anvil",
    "Дракониевый слиток": "lolidimensions_draconium_ingot",
    "Дракониевая пыль": "lolidimensions_draconium_dust",
    "Дракониевый блок": "lolidimensions_draconium_block",
    "Сердце дракона": "lolidimensions_dragon_heart",
    "Кровь дракона": "lolidimensions_dragon_blood",
    "Нейтроний": "tm_singularity_reinforced_neutronium",
    "Ведро расплавленного нейтрония": "tm_singularity_reinforced_neutronium",
    "Звёздная пыль": "lolienergistics_star_matter",
    "Звёздная материя": "lolienergistics_star_matter",
    "Слиток звёздной материи": "lolienergistics_star_matter_ingot",
    "Кровавый кристалл": "lolimagically_blood_crystal",
    "Кровавый шар": "lolimagically_medium_magic_blood_orb",
    "Магическое око": "lolimagically_magical_eye",
    "Vajra": "lolienergistics_legendary_vajra",
    "Hopgraphite": "lolienergistics_hop_graphite_ingot",
    "Рунический алтарь": "Botania_runeAltar",
    "Бассейн маны": "Botania_pool",
    "Чёрный лотос": "Botania_blackLotus",
    # high-frequency items the fuzzy matcher misses (RU↔EN gap)
    "Слиток нейтрония": "tm_singularity_reinforced_neutronium",
    "Заряженная нейтронная звезда": "lolienergistics_charged_neutron_star",
    "Нейтронная звезда": "lolienergistics_neutron_star",
    "Дробитель": "lolienergistics_BlockMacerator",
    "Молекулярный сборщик": "lolienergistics_BlockMolecular",
    "Преобразователь энергония": "lolienergistics_energon_converter_core",
    "Дисперсионная солнечная панель": "lolienergistics_dispersion_solar_panel",
    "Каталист из нейтрония": "lolienergistics_neutronium_catalyst",
    "Катализатор нейтрония": "lolienergistics_neutronium_catalyst",
    "Сборщик нейтрония": "lolienergistics_BlockNeutronCombiner",
    "Скопление нейтрония": "lolienergistics_neutronium_accumulation",
    "Генератор красного энергона": "lolienergistics_red_energon_generator",
    "Генератор тёмного энергона": "lolienergistics_dark_energon_generator",
    "Красный Энергон": "lolienergistics_red_energon",
    "Тёмный Энергон": "lolienergistics_dark_energon",
    "Кристально-матричный слиток": "Avaritia_Crystal_Matrix",
    "Промышленная пасека": "gendustry_IndustrialApiary",
    "Энергетический объединитель нейтрония": "lolienergistics_BlockEnergyNeutronCombiner",
    # vanilla (textures extracted from client.jar into icons/minecraft_*)
    "Уголь": "minecraft_coal", "Древесный уголь": "minecraft_charcoal",
    "Угольный блок": "minecraft_coal_block", "Угольные блоки": "minecraft_coal_block",
    "Железо": "minecraft_iron_ingot", "Железный слиток": "minecraft_iron_ingot",
    "Золото": "minecraft_gold_ingot", "Золотой слиток": "minecraft_gold_ingot", "Золотой самородок": "minecraft_gold_nugget",
    "Лазурит": "minecraft_lapis", "Кожа": "minecraft_leather", "Шерсть": "minecraft_wool",
    "Бумага": "minecraft_paper", "Палка": "minecraft_stick", "Палки": "minecraft_stick",
    "Булыжник": "minecraft_cobblestone", "Камень": "minecraft_stone", "Стекло": "minecraft_glass",
    "Песок": "minecraft_sand", "Гравий": "minecraft_gravel", "Глина": "minecraft_clay_ball",
    "Кость": "minecraft_bone", "Перо": "minecraft_feather", "Кремень": "minecraft_flint",
    "Обсидиан": "minecraft_obsidian", "Лёд": "minecraft_ice", "Кирпич": "minecraft_brick",
    "Жемчуг Края": "minecraft_ender_pearl", "Жемчуг Энда": "minecraft_ender_pearl",
    "Кварц": "minecraft_quartz", "Кварц Нижнего мира": "minecraft_quartz",
    "Тростник": "minecraft_reeds", "Сахарный тростник": "minecraft_reeds",
    "Порох": "minecraft_gunpowder", "Нить": "minecraft_string", "Верёвка": "minecraft_string",
    "Звезда Нижнего мира": "minecraft_nether_star", "Незер звезда": "minecraft_nether_star", "Звезда Незера": "minecraft_nether_star",
    "Огненный стержень": "minecraft_blaze_rod", "Огненный порошок": "minecraft_blaze_powder",
    "Снежок": "minecraft_snowball", "Пшеница": "minecraft_wheat", "Ведро": "minecraft_bucket",
    "Слизь": "minecraft_slimeball", "Шарик слизи": "minecraft_slimeball",
    "Доски": "minecraft_planks_oak", "Деревянные доски": "minecraft_planks_oak",
    "Бревно": "minecraft_log_oak", "Древесина": "minecraft_log_oak",
    "Адский камень": "minecraft_netherrack", "Незеррак": "minecraft_netherrack",
    "Светящийся камень": "minecraft_glowstone", "Светокамень": "minecraft_glowstone",
    "Камень Края": "minecraft_end_stone",
}
# items that fuzzy-match a wrong icon and have no good asset → keep text-only
REJECT = {"Стабилизатор реактора", "Рамка стабилизатора реактора"}
BLOCK = set("""Печь Еда Броня Меч Кирка Лопата Топор Мотыга Ножницы Шерсть Кожа Палка Палки
Бумага Сахарный тростник Стекло Песок Гравий Вода Лава Дерево Доски Камень Булыжник
Личное измерение Player Realm Кит Киты Награда Квест Сундук Верстак""".split())

# ---------- lang tables ----------
ru, en = {}, {}
for p in glob.glob(P('data', 'lang', '*.lang')):
    tgt = ru if 'ru_RU' in p else en
    for line in open(p, encoding='utf-8', errors='ignore'):
        if '=' not in line or line.lstrip().startswith('#'):
            continue
        k, _, v = line.rstrip('\n').partition('=')
        k, v = k.strip(), v.strip()
        if k and v:
            tgt.setdefault(k, v)
for k, v in json.load(open(P('data', 'names.json'))).items():
    ru.setdefault(k, v)

def keyrest(k):
    k = re.sub(r'\.name$', '', k)
    parts = k.split('.')
    if len(parts) >= 3 and parts[0] in ('item', 'tile'):
        return parts[1].lower(), '.'.join(parts[2:]).lower()
    if len(parts) >= 2 and parts[0] in ('item', 'tile'):
        return None, parts[1].lower()
    return None, None

def langidx(table):
    idx = {}
    for k, v in table.items():
        ns, rest = keyrest(k)
        if rest is None:
            continue
        if ns:
            idx[(ns, rest)] = v
        idx.setdefault((None, rest), v)
    return idx

RU_IDX, EN_IDX = langidx(ru), langidx(en)

def icon_variants(fn):
    parts = fn[:-4].split('_')
    out = [('_'.join(parts[:i]).lower(), '_'.join(parts[i:]).lower()) for i in range(1, len(parts))]
    out.append((None, fn[:-4].lower()))
    return out

def name_for(fn, idx):
    for ns, rest in icon_variants(fn):
        if (ns, rest) in idx:
            return idx[(ns, rest)]
        if (None, rest) in idx:
            return idx[(None, rest)]
    return None

ICON_RU = {fn: name_for(fn, RU_IDX) for fn in ICON_FILES}
ICON_EN = {fn: name_for(fn, EN_IDX) for fn in ICON_FILES}

# ---------- text normalization ----------
STOP = set('и в на из с со по для до от the of a an and to ме мэ me'.split())
def norm(s):
    s = s.lower()
    s = re.sub(r'\(.*?\)', ' ', s)
    s = re.sub(r'\b[tт]\s*\d+\b', ' ', s)
    s = re.sub(r'[×x]\s*\d+', ' ', s)
    s = re.sub(r'\d+\s*(k|к|m|м|ур\.?|уровн\w*|lvl)\b', ' ', s)
    s = re.sub(r'[^0-9a-zа-яё ]+', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

def stem(t):
    return re.sub(r'(ость|ами|ями|ого|его|ыми|ими|ая|яя|ое|ее|ый|ий|ой|ом|ем|ах|ях|ов|ев|ин|ы|и|а|я|о|е|у|ю)$', '', t) if re.search(r'[а-яё]', t) else t

def stoks(s):
    return [stem(t) for t in norm(s).split() if t not in STOP and len(t) > 2]

# ---------- IDF over icon-name tokens (both langs) ----------
df = collections.Counter()
docs = 0
for nm in list(ICON_RU.values()) + list(ICON_EN.values()):
    if nm:
        docs += 1
        for t in set(stoks(nm)):
            df[t] += 1
def idf(t):
    return math.log((docs + 1) / (df.get(t, 0) + 1)) + 1.0

def invert(name_map):
    out = {}
    for fn, nm in name_map.items():
        if not nm:
            continue
        key = norm(nm)
        if key and (key not in out or len(fn) < len(out[key])):
            out[key] = fn
    return out
RU_EXACT, EN_EXACT = invert(ICON_RU), invert(ICON_EN)

def tokindex(name_map):
    idx = collections.defaultdict(set)
    for fn, nm in name_map.items():
        if nm:
            for t in set(stoks(nm)):
                idx[t].add(fn)
    return idx
RU_TOK, EN_TOK = tokindex(ICON_RU), tokindex(ICON_EN)

def fuzzy(name, name_map, tok):
    its = stoks(name)
    if not its:
        return None, 0.0
    iset = set(its)
    top = max(iset, key=idf)              # most distinctive item token
    iw = sum(idf(t) for t in iset)
    cand = set()
    for t in iset:
        cand |= tok.get(t, set())
    best, score = None, 0.0
    for fn in cand:
        cs = set(stoks(name_map[fn]))
        if not cs or top not in cs:        # must share the distinctive token
            continue
        inter = iset & cs
        cover_i = sum(idf(t) for t in inter) / iw                 # item covered
        cover_c = sum(idf(t) for t in inter) / sum(idf(t) for t in cs)  # icon covered
        sc = min(cover_i, cover_c) * 0.7 + (len(inter) / len(iset | cs)) * 0.3
        if sc > score:
            best, score = fn, sc
    return best, score

def is_cyr(s):
    return bool(re.search(r'[а-яё]', s.lower()))

MANUAL_NORM = {norm(k): v for k, v in MANUAL.items()}
def _png(fn):
    return fn if fn.endswith('.png') else fn + '.png'

def resolve(name):
    if name in REJECT:
        return None
    if name in MANUAL:
        return _png(MANUAL[name])
    base = norm(name)
    if not base:
        return None
    if base in MANUAL_NORM:            # catches "Булыжник (для починки молота)" etc.
        return _png(MANUAL_NORM[base])
    # blocklist: generic single-concept names
    words = name.replace('/', ' ').split()
    if any(w.strip('().,') in BLOCK for w in words) and len(stoks(name)) <= 1:
        return None
    order = [(RU_EXACT, RU_TOK, ICON_RU), (EN_EXACT, EN_TOK, ICON_EN)]
    if not is_cyr(name):
        order = order[::-1]
    for exact, _, _ in order:
        if base in exact:
            return exact[base]
    best, score = None, 0.0
    for _, tok, nm in order:
        fn, sc = fuzzy(name, nm, tok)
        if sc > score:
            best, score = fn, sc
    return best if score >= 0.62 else None

# ---------- resolve all step items ----------
src = open(P('guide.js')).read()
G = json.loads(src[src.index('{'):src.rfind('}') + 1])
items = collections.Counter()
for sec in G['sections']:
    for st in sec['steps']:
        for it in st.get('items', []):
            items[it] += 1

result, unresolved = {}, []
for name in items:
    fn = resolve(name)
    if fn and fn in ICON_SRC:
        result[name] = 'icons/' + fn
    else:
        unresolved.append(name)

# copy only the referenced staging textures into icons/ (keeps icons/ lean)
for path in set(result.values()):
    fn = os.path.basename(path)
    dst = P('icons', fn)
    if not os.path.exists(dst):
        shutil.copy2(ICON_SRC[fn], dst)

json.dump(result, open(P('data', 'item_icons.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=0, sort_keys=True)
# file://-safe JS global for the static app
with open(P('item_icons.js'), 'w', encoding='utf-8') as f:
    f.write('/* Авто-сгенерировано meta/build_item_icons.py — имя предмета → текстура из клиента. */\n')
    f.write('window.ITEM_ICONS = ' + json.dumps(result, ensure_ascii=False, sort_keys=True) + ';\n')
print(f"resolved {len(result)}/{len(items)} distinct ({sum(items[n] for n in result)}/{sum(items.values())} refs)")
# coverage report files for spot-check
with open(P('meta', '_item_icons_report.txt'), 'w', encoding='utf-8') as f:
    f.write("=== RESOLVED (by freq) ===\n")
    for name, c in items.most_common():
        if name in result:
            f.write(f"{c:3} {name}  ->  {result[name]}\n")
    f.write("\n=== UNRESOLVED (by freq) ===\n")
    for name, c in items.most_common():
        if name not in result:
            f.write(f"{c:3} {name}\n")
print("report -> meta/_item_icons_report.txt")
