export const meta = {
  name: 'tmrpg-guide-content',
  description: 'Synthesize LoliLand TechnoMagic RPG progression guide (sections + ordered steps) from extracted local data + loliland.ru research',
  phases: [
    { title: 'Research' },
    { title: 'Sections' },
    { title: 'Assemble' },
    { title: 'Critique' },
  ],
}

const DATA = '/home/def/projects/misc/loliland-guidence/data'
const META = '/home/def/projects/misc/loliland-guidence/meta'

const STEP = {
  type: 'object', additionalProperties: false,
  properties: {
    title:   { type: 'string', description: 'Короткий императив на русском, что сделать' },
    detail:  { type: 'string', description: 'Как именно: предметы, мультиблок, механика, последовательность. 1-4 предложения, конкретно.' },
    items:   { type: 'array', items: { type: 'string' }, description: 'Ключевые предметы/блоки (русские названия)' },
    serverNote: { type: 'string', description: 'Серверная особенность: изменённый/заблокированный рецепт, кастомная машина LoliLand, гейт. Пусто если нет.' },
    coop:    { type: 'string', description: 'Как разделить работу на двоих. Пусто если неактуально.' },
    optional:{ type: 'boolean', description: 'true если шаг необязателен/побочный' },
  },
  required: ['title', 'detail', 'items', 'serverNote', 'coop', 'optional'],
}
const SECTION_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    section: {
      type: 'object', additionalProperties: false,
      properties: {
        key:    { type: 'string' },
        title:  { type: 'string', description: 'Название раздела на русском' },
        questGroupGuess: { type: 'string', description: 'Предполагаемое имя игровой группы достижений, если уместно, иначе пусто' },
        confirmed: { type: 'boolean', description: 'true только если имя группы реально подтверждено' },
        intro:  { type: 'string', description: '1-3 предложения: что это за этап и зачем' },
        estTime:{ type: 'string', description: 'Грубая оценка времени, напр. "1-2 вечера"' },
        prereqKeys: { type: 'array', items: { type: 'string' }, description: 'ключи разделов, которые желательно пройти раньше' },
        steps:  { type: 'array', items: STEP, minItems: 4 },
      },
      required: ['key','title','questGroupGuess','confirmed','intro','estTime','prereqKeys','steps'],
    },
  },
  required: ['section'],
}

const COMMON = `
Ты — эксперт по Minecraft 1.7.10 модпаку LoliLand "TechnoMagic RPG" (сервер, кооп на двоих, игроки купят premium/VIP).
Пишешь раздел интерактивного чеклиста прохождения. Требования:
- ВСЁ на русском, конкретно и по делу, шаги в ПРАВИЛЬНОМ ПОРЯДКЕ прохождения (от простого к сложному).
- Для стандартных модов используй проверенные знания механик 1.7.10.
- Для КАСТОМНЫХ систем LoliLand опирайся на извлечённые данные (имена машин, тексты вики, рефы рецептов) — Read указанные файлы. НЕ выдумывай несуществующие машины; используй реальные названия из data.
- Каждый шаг: что сделать + как + ключевые предметы. Где рецепт на сервере изменён/усложнён/заблокирован или это кастомная машина — заполни serverNote.
- coop: где есть смысл разделить труд на двоих — подскажи.
- Помни про эндшпиль: Avaritia Infinity ("Дорога к Бесконечному"), Draconic, легендарные молекулярные преобразователи, драконы, нейтроний.
Данные (Read при необходимости):
- ${DATA}/names.txt — все русские названия предметов/блоков (key=value)
- ${DATA}/wiki_index.json — встроенная вики (механизмы + тексты)
- ${DATA}/recipes/scripts_item_refs.json — серверные MineTweaker-скрипты → предметы
- ${DATA}/strings/<Мод>.txt — русские строки/описания из кастомных модов
`

const SECTIONS = [
  { key:'start', title:'Старт и обустройство на сервере', focus:`Первые часы на сервере: спавн, базовые команды (/kit, дом/телепорты), приват/клейм территории на двоих, экономика и магазин (/shop, трейды), что даёт premium/VIP (используй данные research если переданы в промпте), безопасный старт базы, первичный сбор ресурсов и еды. Заверши готовностью к Tinkers и базовой обработке.`, files:['recipes/scripts_item_refs.json'] },
  { key:'tinkers', title:"Tinkers' Construct — инструменты и броня", focus:`Стартовый инструментал: верстак инструментов, плавильня (Smeltery) как можно раньше, первые кирки/молоты, материалы и модификаторы. Что докинуть на сервере. Подготовка к автоматизации.`, files:['names.txt'] },
  { key:'processing', title:'Базовая обработка и энергия (IC2 + сингулярные машины)', focus:`IC2 EU-энергия, базовые машины (макератор, печь, компрессор, экстрактор), переход к кастомным сингулярным машинам LoliEnergistics (Расширенный/Промышленный сингулярный дробитель/компрессор/экстрактор/утилизатор x6/x12, металлоформовка, центрифуга). Тиры x1→x6→x12. Обработка ресурсов стаками.`, files:['strings/LoliEnergistics.txt','wiki_index.json','names.txt'] },
  { key:'thaumcraft', title:'Thaumcraft и магические аддоны', focus:`Thaumcraft 4: жезл, стол исследований, аспекты, сканирование, ауромантия, варп. Аддоны: Forbidden Magic, Tainted Magic, Thaumic Tinkerer, Witching Gadgets, Automagy, Gadomancy, Thaumic Exploration/Horizons. Порядок исследований до полезных предметов. Серверные изменения страниц/рецептов (см. tmrpg_thaum_craft, tmrpg_a_thaumic_page).`, files:['recipes/scripts_item_refs.json','names.txt'] },
  { key:'botania', title:'Botania и Alfheim — мана и Гайя', focus:`Botania: цветы маны, мана-пул, споры, руны, реликвии. Alfheim (эльфийские врата, элвен-ресурсы). Кастом LoliMagically/мана-фарм. Подготовка и бой со Стражем Гайи (Gaia Guardian), души Гайи (важно для эндгейма энергии). Серверные рецепты tmrpg_botania*, tmrpg_alfheim_spells.`, files:['strings/LoliMagically.txt','recipes/scripts_item_refs.json','names.txt'] },
  { key:'bloodmagic', title:'Blood Magic — алтарь, реагенты, души', focus:`Blood Magic: кровавый алтарь и тиры (T1→T6), оркестратор рун, ритуалы, инкарнация, демоническая воля. Blood Arsenal. Реагенты (фарм реагентов — есть в арке прохождения). Серверные tmrpg_blood_magic, tmrpg_blood_magic_reagents. Душа/Soul Network.`, files:['recipes/scripts_item_refs.json','names.txt'] },
  { key:'bees', title:'Пчеловодство — «Пчелиная мания»', group:'Пчелиная мания', confirmed:true, focus:`Forestry пчёлы: пасека/улей, апиарист, селекция, генетика (Gendustry мутагенератор/имприн­тер, BeeBetterAtBees), Magic Bees, Extra Bees. Кастом LoliForestry: Ядро пчелиной фабрики, Пчелиное покрытие/стекло/основа, Промышленный улей, Совершенная пасека/центрифуга. Авто-производство ресурсов пчёлами. Это подтверждённая группа достижений.`, files:['strings/LoliForestry.txt','recipes/scripts_item_refs.json','names.txt'] },
  { key:'ae2', title:'Applied Energistics + LoliAE2 — ME-система и сборка', focus:`AE2: кристаллы, процессоры, ME-контроллер, ячейки, терминал, автокрафт. Кастом LoliAE2: продвинутые молекулярные/инфузионные/лазерные/нейтрониевые/фьюжн/celestial ассемблеры и энкодеры, расширенный конденсатор, беспроводной центр подключений (бесконечные каналы), ячеечный верстак. Это ядро автоматизации эндгейма.`, files:['strings/LoliAE2.txt','wiki_index.json','recipes/scripts_item_refs.json','names.txt'] },
  { key:'energistics', title:'Молекулярные тиры и кастомная энергетика (LoliEnergistics)', focus:`Кастомная цепочка LoliEnergistics: Молекулярный преобразователь → Промышленный (x10) → Двойной → Легендарный; Молекулярная ферма; генератор нейтрония (Сингулярный/...); энергон (преобразователь/синтезатор), паровые котлы (Steam/Industrial), плазменный зарядник, гелиосферный центр зарядки, кристаллизация/охлаждение, deep storage. Тиры энергии до миллионов/миллиардов. Опирайся на wiki_index.json (lolienergistics) и lang-имена.`, files:['strings/LoliEnergistics.txt','wiki_index.json','names.txt'] },
  { key:'mekanism', title:'Mekanism — газы, обработка x5, индукция', focus:`Mekanism: металлургический инфузер, обогатительная фабрика, цепочки обработки руды (x2→x3→x4→x5), химия/газы, индукционная матрица для хранения энергии, дигитальный шахтёр. Где помогает кооперации/энергетике. Серверные tmrpg_mekanism.`, files:['recipes/scripts_item_refs.json','names.txt'] },
  { key:'draconic', title:'Draconic Evolution — ядро энергии и пробуждение', focus:`Draconic Evolution: пыль/слитки draconium, awakened draconium, энергетическое ядро (tiers), реактор (осторожно!), draconic-броня и инструменты, генератор хаоса/Chaos Guardian, посохи. Серверные tmrpg_draconic_evolution, de_souls. Связь с эндгеймом и драконами.`, files:['recipes/scripts_item_refs.json','names.txt'] },
  { key:'dragons', title:'LoliDragonMight — драконы, реактор, души драконов', focus:`Кастомная система драконов LoliDragonMight: реактор (assets/luminous/wiki/.../reactor.json), души драконов (холодный/пламенный/хаоса/демонический дракон), драконье снаряжение и сердца, слияние/мердж драконов как дюп ресурсов. Опирайся на strings/LoliDragonMight.txt и wiki.`, files:['strings/LoliDragonMight.txt','wiki_index.json','recipes/scripts_item_refs.json','names.txt'] },
  { key:'dimensions', title:'Измерения, данжи и боссы', focus:`LoliDimensions (кастомные измерения, доступ/ключи), LoliDungeons (данжи, лут, легендарные спавнеры), DivineRPG-контент, Airdrops (tmrpg_airdrops), кастомные боссы (см. арку прохождения: кастомный данж/босс, archangel hearts, star zodius). Как и когда туда идти, что фармить. Серверные tmrpg_loli_dimensions, chest_loots.`, files:['strings/LoliDimensions.txt','recipes/scripts_item_refs.json','names.txt'] },
  { key:'relics_elements', title:'Реликвии энергии и Элементы (кастом)', focus:`LoliEnergyRelics (энергетические реликвии/баблы), TechnoMagic-Elements (loli_elements_tm — стихии/элементы), LoliUtility/LoliDecorative полезные блоки и креатив-предметы поздней игры (см. "первый креатив-предмет" в арке). Что это даёт и как получить.`, files:['strings/LoliEnergyRelics.txt','strings/TechnoMagic-Elements.txt','strings/LoliUtility.txt','names.txt'] },
  { key:'avaritia', title:'Avaritia — «Дорога к Бесконечному!» (финал)', group:'Дорога к Бесконечному!', confirmed:true, focus:`Финальная цель сборки. Avaritia: сжатые сингулярности (Compressed Singularity), Crystal Matrix, Neutron Collector/Pile, Infinity Catalyst, бесконечный слиток (Infinity Ingot), Infinity-инструменты и броня (THE TRUE END). Стол крафта 9x9 (Extreme Crafting Table). Что нужно нафармить из всех предыдущих систем (нейтроний, души, энергия, мана). Серверные tmrpg_avaritia. Это подтверждённая финальная группа достижений.`, files:['recipes/scripts_item_refs.json','names.txt'] },
]

function prompt(s, serverMeta) {
  const extra = s.key === 'start' && serverMeta ? `\nДАННЫЕ ПО СЕРВЕРУ (research):\n${serverMeta}\n` : ''
  return `${COMMON}
Раздел: "${s.title}" (key=${s.key}).
${s.group ? `Подтверждённая игровая группа достижений: "${s.group}". Поставь confirmed=true и questGroupGuess="${s.group}".` : 'Если уверенно знаешь имя группы — впиши в questGroupGuess, но confirmed=false (имена групп не подтверждены).'}
Фокус: ${s.focus}
Рекомендуемые файлы для Read: ${s.files.map(f => DATA + '/' + f).join(', ')}
${extra}
Верни объект section по схеме: key="${s.key}", осмысленные intro/estTime/prereqKeys и >=6 конкретных упорядоченных шагов (для крупных систем — больше). Каждый шаг практичен: «сделай X, чтобы получить Y».`
}

// ---- Phase 1: server research ----
phase('Research')
const META_SCHEMA = {
  type:'object', additionalProperties:false,
  properties:{ summary:{type:'string'}, premiumVsVip:{type:'string'}, economy:{type:'string'},
    claims:{type:'string'}, dimensionsAccess:{type:'string'}, wipeNotes:{type:'string'}, commands:{type:'array',items:{type:'string'}} },
  required:['summary','premiumVsVip','economy','claims','dimensionsAccess','wipeNotes','commands'],
}
const serverMeta = await agent(
  `Ты — ресёрчер. Через WebSearch/WebFetch собери АКТУАЛЬНЫЕ факты про сервер LoliLand "TechnoMagic RPG" (loliland.ru). Источники: https://loliland.ru/en/servers/techno-magic-rpg , https://loliland.ru/servers/techno-magic-rpg , https://loliland.ru/bonus , https://loliland.ru/post/30 , новости вайпов (например /news/wipe-...). Нужны: краткое описание сервера и механик; различия privilege premium vs VIP (что конкретно даёт каждый, цена, бусты, киты, привилегии — это влияет на гайд для двух игроков); экономика и магазин; система привата/клейма территории; как открываются кастомные измерения; заметки последнего вайпа (версия пака 04012026, зимний). commands — список полезных игровых команд если найдёшь. Если чего-то нет — честно пиши "нет данных". Кратко, по-русски.`,
  { label:'server-meta', phase:'Research', schema: META_SCHEMA }
)

// ---- Phase 2: sections in parallel ----
phase('Sections')
const results = await parallel(SECTIONS.map((s) => () =>
  agent(prompt(s, s.key === 'start' ? JSON.stringify(serverMeta) : null),
    { label: s.key, phase: 'Sections', schema: SECTION_SCHEMA })
))
const sections = results.filter(Boolean).map(r => r.section)

// ---- Phase 3: global ordering + dependency graph ----
phase('Assemble')
const ORDER_SCHEMA = {
  type:'object', additionalProperties:false,
  properties:{
    order:{ type:'array', items:{ type:'string' }, description:'ключи разделов в оптимальном порядке прохождения' },
    rationale:{ type:'string' },
    milestones:{ type:'array', items:{ type:'object', additionalProperties:false,
      properties:{ at:{type:'string'}, label:{type:'string'} }, required:['at','label'] },
      description:'крупные вехи прогресса (после какого ключа — какая веха)'},
  },
  required:['order','rationale','milestones'],
}
const order = await agent(
  `Ты — архитектор прогрессии модпака. Вот разделы (key, title, intro, prereqKeys):\n${
    JSON.stringify(sections.map(s => ({ key:s.key, title:s.title, intro:s.intro, prereqKeys:s.prereqKeys })), null, 1)
  }\nВыстрой оптимальный порядок прохождения на сервере (кооп на двоих) от старта до финала Avaritia. Учти зависимости (мана/души Гайи и нейтроний нужны для энергетики и финала). Верни order (массив key), краткое rationale и milestones.`,
  { phase:'Assemble', schema: ORDER_SCHEMA }
)

// ---- Phase 4: completeness critic ----
phase('Critique')
const CRIT_SCHEMA = {
  type:'object', additionalProperties:false,
  properties:{
    gaps:{ type:'array', items:{ type:'string' }, description:'что упущено/неточно/нужно проверить в игре' },
    serverSpecificsToVerify:{ type:'array', items:{ type:'string' } },
    suggestedExtraSteps:{ type:'array', items:{ type:'object', additionalProperties:false,
      properties:{ sectionKey:{type:'string'}, step:{type:'string'} }, required:['sectionKey','step'] } },
  },
  required:['gaps','serverSpecificsToVerify','suggestedExtraSteps'],
}
const critique = await agent(
  `Ты — критик-комплитор. Вот собранный гайд (разделы со шагами):\n${
    JSON.stringify(sections.map(s => ({ key:s.key, title:s.title, steps:s.steps.map(x=>x.title) })), null, 0).slice(0, 16000)
  }\nНайди пробелы: упущенные кастомные системы LoliLand, неупорядоченность, шаги, которые надо подтвердить в самой игре (т.к. точное дерево квестов серверное). Что проверить по серверным рецептам. Дай конкретные suggestedExtraSteps. Кратко, по-русски.`,
  { phase:'Critique', schema: CRIT_SCHEMA }
)

return { serverMeta, sections, order, critique }
