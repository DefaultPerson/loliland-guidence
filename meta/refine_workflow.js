export const meta = {
  name: 'tmrpg-guide-refine',
  description: 'Refine the TechnoMagic RPG guide using the 47-episode walkthrough transcripts: fix real order, close critic gaps, add tactics',
  phases: [{ title: 'Refine' }, { title: 'Reorder' }],
}

const DATA = '/home/def/projects/misc/loliland-guidence/data'
const YT = '/home/def/projects/misc/loliland-guidence/research/youtube/txt'

const STEP = {
  type: 'object', additionalProperties: false,
  properties: {
    title:  { type: 'string' },
    detail: { type: 'string' },
    items:  { type: 'array', items: { type: 'string' } },
    serverNote: { type: 'string' },
    coop:   { type: 'string' },
    optional: { type: 'boolean' },
  },
  required: ['title', 'detail', 'items', 'serverNote', 'coop', 'optional'],
}
const SECTION_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: { section: {
    type: 'object', additionalProperties: false,
    properties: {
      key: { type: 'string' }, title: { type: 'string' },
      questGroupGuess: { type: 'string' }, confirmed: { type: 'boolean' },
      intro: { type: 'string' }, estTime: { type: 'string' },
      prereqKeys: { type: 'array', items: { type: 'string' } },
      steps: { type: 'array', items: STEP, minItems: 5 },
    },
    required: ['key','title','questGroupGuess','confirmed','intro','estTime','prereqKeys','steps'],
  } },
  required: ['section'],
}

// key -> {episodes (relevant transcript files), gaps (critic gaps to close), data (extra grounding files)}
const SECTIONS = [
  { key:'start', ep:['01'], data:[], gaps:'Серверные перки/экономика не проверяемы из файлов — оставь, но честно помечай serverNote "проверь в игре". Свяжи личное измерение (Player Realms) с кооп-инвайтом.' },
  { key:'tinkers', ep:['01','02','03'], data:['names.txt'], gaps:'Проверь, добавлены ли кастомные расплавы (дракониум/нейтроний/адамантий) в плавильню — пометь "проверь в NEI".' },
  { key:'processing', ep:['02','04','06'], data:['strings/LoliEnergistics.txt','wiki_index.json','names.txt'], gaps:'Назови точные тиры сингулярных машин x1/x6/x12 и переход. Добавь узел LoliUtility "Преобразователь удачи" (Fortune Transformer, модули удачи x1..x11) как ранний удвоитель/фортуна — это упущено.' },
  { key:'thaumcraft', ep:['07'], data:['recipes/scripts_item_refs.json','names.txt'], gaps:'Добавь аддоны ThaumicTinkerer, TaintedMagic, ForbiddenMagic (крупные по контенту) — сейчас не названы. Порядок исследований до ключевых предметов.' },
  { key:'botania', ep:['09','25','30','34'], data:['strings/LoliMagically.txt','names.txt'], gaps:'Добавь LoliMagically Мультитеплицу (multi_greenhouse: модули Умножение/Скорость маны/EU/RF/Кристаллизация) — ключевой авто-мана/ресурс-фарм (видео #9, #34). Углуби Alfheim. Осколки души Гайи → в эндгейм энергии.' },
  { key:'bloodmagic', ep:['14','20','21','32'], data:['strings/LoliMagically.txt','names.txt'], gaps:'ЯВНО свяжи апекс Blood Magic с LoliMagically: демонические кровавые кристаллы (Люцифер/Бельфегор/Вельзевул/Асмодей/Левиафан/Демон), Кровавая звезда, Кровавый осколок хаоса, Механический кровавый алтарь, Генератор крови. Реагентный фарм (видео #14).' },
  { key:'bees', ep:['05','33'], data:['strings/LoliForestry.txt','names.txt'], gaps:'Раздели Forestry-аддоны (MagicBees/ExtraBees/ExtraTrees/Botany/Gendustry). Добавь LoliForestry: Совершенная/Промышленная пасека, Ядро пчелиной фабрики, модули улья, Улучшение "Бесконечность" и пчёл, дающих Капли бесконечности (мост к финалу). #46 (Bee Factory) субтитров нет — пометь.' },
  { key:'ae2', ep:['10','16','18'], data:['strings/LoliAE2.txt','wiki_index.json','names.txt'], gaps:'Назови тиры LoliAE2: контроллеры/ячейки/беспровод Золотой→Бесконечный→Демонический; Блоки обработки созданий (9/81/729 операций); хранилища до 512M/2048M; Ускоренный молекулярный сборщик; интерфейсы X2/X3/X4; беспроводной центр (бесконечные каналы).' },
  { key:'energistics', ep:['04','15','19','22','27','28','29','47'], data:['strings/LoliEnergistics.txt','wiki_index.json','names.txt'], gaps:'Сделай явный единый узел "как делается сингулярность/нейтроний" (молекулярные x6/x12 + Глубокое хранилище + жидкостный компрессор нейтрония). Тиры молекулярного: Промышленный(x10)→Двойной→Легендарный. Энергия до миллиардов. Зимний вайп: Энтропийный реактор (энергия на чёрной дыре) — добавь как опцию.' },
  { key:'mekanism', ep:['04','05'], data:['names.txt'], gaps:'Проверь, контент это или зависимость. Обработка руды x5, индукционная матрица.' },
  { key:'draconic', ep:['35','36','44'], data:['recipes/scripts_item_refs.json','names.txt'], gaps:'Свяжи с LoliDragonMight. Энергоядро, пробуждение, реактор (осторожно), Chaos Guardian.' },
  { key:'dragons', ep:['12','23','35','36','39'], data:['strings/LoliDragonMight.txt','wiki_index.json','names.txt'], gaps:'6 драконов (холодный/пламенный/хаоса/демонический и др.), их души/сердца/осколки, слияние (дюп ресурсов, видео #12), Реактор Хаоса (зимний вайп: обычный/продвинутый режим). #45 (Legendary Dragon Heart) субтитров нет — пометь.' },
  { key:'dimensions', ep:['08','43'], data:['strings/LoliDimensions.txt','names.txt'], gaps:'СИЛЬНО расширь: DivineRPG (измерения Twilight/Iceika/Apalachia/Skythern/Mortum/Vethea, статуи-призывы боссов Ayeraco x5/Densos/Karos/Parasecta/Reyvor/Ancient Entity, тиры брони/оружия). LoliDimensions: New Hell (Hell Anvil/Chest/Epic Hell Chest), New End, Holy Lands, Player Realms, Dimension Changer. Архангельские сердца / легендарный спавнер (видео #43).' },
  { key:'relics_elements', ep:['17','37','40','44'], data:['strings/LoliEnergyRelics.txt','strings/TechnoMagic-Elements.txt','names.txt'], gaps:'Раздели реликвии: боевые/QoL (Хирайшин, Берсерк, Том опыта) vs прогрессионные (Демонический сет Бесконечности — мост к Avaritia). Золотые руны (видео #17), космические звёзды/гелиосферный зарядник (#37), первый креатив-предмет (#40).' },
  { key:'avaritia', ep:['27','28','38','48'], data:['recipes/scripts_item_refs.json','names.txt'], gaps:'Реальная цепочка из видео: нейтроний → Кристаллическая матрица → Катализатор Бесконечности (видео #28) → Слиток Бесконечности → Infinity-сет (THE TRUE END, видео #48). Учти кастомный гейт: Демонический сет/контроллер как пред-финал. Пометь "точная сетка 9x9 — в NEI".' },
]

const COMMON = `Ты дорабатываешь раздел гайда прохождения LoliLand "TechnoMagic RPG" (Minecraft 1.7.10, сервер, кооп на двоих).
Дано: (1) текущий раздел — Read ${DATA}/sections/<key>.json; (2) транскрипты реального прохождения (РУ, ЛЕТНИЙ вайп) — Read указанные файлы из ${YT}; (3) извлечённые данные клиента — Read указанные файлы из ${DATA}.
Задача:
- Выстрой РЕАЛЬНЫЙ порядок шагов так, как игрок делает в видео (от простого к сложному).
- Закрой указанные пробелы (gaps) — добавь недостающие машины/системы реальными названиями из data.
- Добавь практичную тактику и кооп-разделение из видео.
- Где рецепт/механика мог сместиться (видео = летний вайп, текущий пак — зимний 04012026), ставь serverNote с пометкой "летний вайп — проверь в NEI/квест-буке".
- Не выдумывай несуществующее; кастомные имена бери из data/lang. Русский язык. Сохрани schema. Шагов >=6, для крупных систем больше.
Подтверждённые группы достижений: "Пчелиная мания" (bees), "Дорога к Бесконечному!" (avaritia) — для них confirmed=true.`

phase('Refine')
const improved = await parallel(SECTIONS.map((s) => () => {
  const eps = s.ep.map(e => `${YT}/${e}.txt`).join(', ')
  const dataf = s.data.map(d => `${DATA}/${d}`).join(', ') || '(нет доп. файлов)'
  return agent(
    `${COMMON}\n\nРАЗДЕЛ key="${s.key}". Read ${DATA}/sections/${s.key}.json.\nТранскрипты для этого этапа: ${eps}\nДанные клиента: ${dataf}\nПробелы для закрытия: ${s.gaps}\nВерни улучшенный section (та же schema, key="${s.key}").`,
    { label: s.key, phase: 'Refine', schema: SECTION_SCHEMA }
  )
}))
const sections = improved.filter(Boolean).map(r => r.section)

phase('Reorder')
const ORDER_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    order: { type: 'array', items: { type: 'string' } },
    rationale: { type: 'string' },
    milestones: { type: 'array', items: { type: 'object', additionalProperties: false,
      properties: { at: { type: 'string' }, label: { type: 'string' } }, required: ['at','label'] } },
  },
  required: ['order','rationale','milestones'],
}
const order = await agent(
  `Ты — архитектор прогрессии. Реальная видео-арка прохождения (летний вайп) по сериям:\n` +
  `01 старт→06 апгрейд, 07 магия(тауматургия), 08 кастом измерение/данж/босс, 09 бесконечная мана-ферма, 10 коллектор/AE2, 11 бессмертие, 12 дюп драконами, 13 убийца Гайи, 14 фарм реагентов(кровь), 15 эссенция, 16 пре-крафт капов, 17 руны, 18 панели рассеивания, 19-22 нейтроний/жидкости/энергия, 23 души/ген хаоса, 24 душа Гайи, 25 первородная мана, 26 душа флюгеля, 27-28 миллиарды/Катализатор Бесконечности, 29 ген материи, 30 осколки Гайи, 31-34 топ-фермы(кровь/мана/нейтроний), 35-36 драконы(хаос/холод), 37 гелиосфера, 38 Nova/слиток, 39 пламенный дракон, 40 креатив-предмет, 41-44 фермы/Асгард, 47 легендарное молекулярное, 48 THE TRUE END.\n` +
  `Разделы (key,title,intro,prereqKeys):\n${JSON.stringify(sections.map(s => ({ key:s.key, title:s.title, intro:s.intro.slice(0,160), prereqKeys:s.prereqKeys })), null, 0)}\n` +
  `Выстрой order (массив key) под реальную арку и зависимости (мана/души Гайи и нейтроний нужны до энергетики и финала), дай rationale и milestones.`,
  { phase: 'Reorder', schema: ORDER_SCHEMA }
)

return { sections, order }
