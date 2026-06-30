export const meta = {
  name: 'tmrpg-verify-enrich-graph',
  description: 'Verify guide items vs registry (fix hallucinations/typos), enrich steps with concrete numbers from transcripts, and build the craft-dependency graph',
  phases: [{ title: 'Verify' }, { title: 'Graph' }],
}

const DATA = '/home/def/projects/misc/loliland-guidence/data'
const YT = '/home/def/projects/misc/loliland-guidence/research/youtube/txt'

const STEP = {
  type: 'object', additionalProperties: false,
  properties: {
    title: { type: 'string' }, detail: { type: 'string' },
    items: { type: 'array', items: { type: 'string' } },
    serverNote: { type: 'string' }, coop: { type: 'string' }, optional: { type: 'boolean' },
  },
  required: ['title','detail','items','serverNote','coop','optional'],
}
const SECTION = {
  type: 'object', additionalProperties: false,
  properties: {
    key: { type: 'string' }, title: { type: 'string' },
    questGroupGuess: { type: 'string' }, confirmed: { type: 'boolean' },
    intro: { type: 'string' }, estTime: { type: 'string' },
    prereqKeys: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: STEP, minItems: 6 },
  },
  required: ['key','title','questGroupGuess','confirmed','intro','estTime','prereqKeys','steps'],
}
const VERIFY_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: { section: SECTION, issues: { type: 'array', items: { type: 'string' } } },
  required: ['section','issues'],
}

const EP = {
  start:['01'], tinkers:['01','02','03'], processing:['02','04','06'], thaumcraft:['07'],
  botania:['09','25','30','34'], bloodmagic:['14','20','21','32'], bees:['05','33','46'],
  ae2:['10','16','18'], energistics:['04','15','19','22','27','28','29','47'], mekanism:['04','05'],
  draconic:['35','36','44'], dragons:['12','23','35','36','39','45','46'], dimensions:['08','43'],
  relics_elements:['17','37','40','44'], avaritia:['27','28','38','48'],
}
const STR = {
  start:['LoliUtility','LoliMod'], processing:['LoliEnergistics'], botania:['LoliMagically'],
  bloodmagic:['LoliMagically'], bees:['LoliForestry'], ae2:['LoliAE2'], energistics:['LoliEnergistics'],
  dragons:['LoliDragonMight'], dimensions:['LoliDimensions'], relics_elements:['LoliEnergyRelics','TechnoMagic-Elements'],
}
const KEYS = Object.keys(EP)

phase('Verify')
const VPROMPT = (key) => {
  const eps = (EP[key] || []).map(e => `${YT}/${e}.txt`).join(', ')
  const strf = (STR[key] || []).map(s => `${DATA}/strings/${s}.txt`).join(', ')
  return `Ты — QA-редактор гайда прохождения LoliLand "TechnoMagic RPG" (MC 1.7.10, кооп). Дорабатываешь ОДИН раздел.
ЧИТАЙ:
- ${DATA}/sections/${key}.json — текущий раздел.
- ${DATA}/qa/flagged_items.json — возьми массив по ключу "${key}": это предметы из раздела, которых НЕТ в реестре игры. По КАЖДОМУ: сверь с ${DATA}/names.txt; если это опечатка/перефраз — поправь под реальное имя; если предмет ВЫДУМАН (нет в names.txt и strings) — замени на реальный аналог или убери из items и текста. Пример известной выдумки: "Печать Озанора/Озонора" (в реестре отсутствует).
- ${DATA}/names.txt и ${strf || '(нет)'} — реальные имена предметов/машин.
- Транскрипты прохождения (РУ; 45/46 — ASR, бери смысл): ${eps || '(нет)'}.
ЗАДАЧИ:
1) ВЕРИФИКАЦИЯ: убери выдумки, поправь названия под реестр. Items должны существовать в игре.
2) ОБОГАЩЕНИЕ ЧИСЛАМИ: добавь в detail КОНКРЕТНЫЕ цифры из транскриптов/конфигов — энергия (млн/млрд RF/EU), цены (монет), тиры/уровни модулей, множители, количества (сколько ставить машин/сколько ресурса). Каждое число — из источника, не выдумывай. Где число из видео (летний вайп) — добавь serverNote "летний вайп — проверь актуальные цифры".
3) Сохрани сильные шаги и schema. Русский. Шагов не меньше, чем сейчас.
Верни {section (исправленный+обогащённый, key="${key}"), issues (список: что было не так и как поправил)}.`
}
const vp = parallel(KEYS.map((k) => () => agent(VPROMPT(k), { label: `v:${k}`, phase: 'Verify', schema: VERIFY_SCHEMA })))

phase('Graph')
const GRAPH_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    nodes: { type: 'array', items: { type: 'object', additionalProperties: false,
      properties: {
        id: { type: 'string', description: 'регистровое имя mod:item' },
        label: { type: 'string', description: 'русское имя' },
        category: { type: 'string' },
        tier: { type: 'integer', description: '0=сырьё/база, выше=ближе к финалу' },
        kind: { type: 'string', enum: ['raw','intermediate','component','machine','goal'] },
      }, required: ['id','label','category','tier','kind'] } },
    edges: { type: 'array', items: { type: 'object', additionalProperties: false,
      properties: { from: { type: 'string', description: 'ингредиент id' }, to: { type: 'string', description: 'продукт id' } },
      required: ['from','to'] } },
  },
  required: ['nodes','edges'],
}
const GDOM = [
  { key:'dragons', kw:'дракон/драконий/хаос/Гайя', filter:'draconium, dragon, chaotic, gaia_soul, wyvern' },
  { key:'energetics', kw:'энергоний/нейтроний/материя/молекулярный/плазма/кристалл', filter:'energon, neutron, matter, molecular, plasma, heliospher, crystal_charg' },
  { key:'infinity', kw:'Бесконечность/Avaritia/сингулярности/магический апекс', filter:'infinity, catalyst, crystal_matrix, singular, blood_star, necromancer, demon' },
]
const GPROMPT = (d) => `Ты строишь КРАФТ-ГРАФ зависимостей (в духе mc-craft-tree, но БЕЗ точных количеств) для эндгейма LoliLand TechnoMagic RPG, домен: ${d.kw}.
ЧИТАЙ ${DATA}/craft/edges.json — это карта {продукт: пул ингредиентов} из серверных скриптов (с ШУМОМ: компилированный кэш, в пул попадают предметы соседних рецептов). Также ${DATA}/wiki_index.json (тиры машин) и ${DATA}/names.txt.
Отфильтруй продукты домена по ключам: ${d.filter}.
Построй чистый граф:
- nodes: предмет (id=mod:item, label=рус. имя), category (домен), tier (0=сырьё → выше к финалу), kind (raw/intermediate/component/machine/goal). Финальные предметы (Infinity-снаряжение, легендарные сердца) — kind=goal.
- edges: {from: ингредиент, to: продукт} — ТОЛЬКО правдоподобные рёбра (по смыслу и тиру). ОТБРОСЬ шум (предметы из чужих веток, явно не подходящие по тиру). Лучше меньше, но точнее.
Цель — читаемая тирная цепочка «сырьё → промежуточное → компонент → финал». Верни {nodes, edges}.`
const gp = parallel(GDOM.map((d) => () => agent(GPROMPT(d), { label: `g:${d.key}`, phase: 'Graph', schema: GRAPH_SCHEMA })))

const [verified, graphs] = await Promise.all([vp, gp])
return {
  sections: verified.filter(Boolean).map(r => r.section),
  issues: verified.filter(Boolean).flatMap(r => (r.issues || []).map(i => ({ section: r.section.key, issue: i }))),
  graphParts: graphs.filter(Boolean),
}
