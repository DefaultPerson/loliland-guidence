export const meta = {
  name: 'tm-progression-audit',
  description: 'Audit the guide progression: real gates per section, order/wave correctness, nothing forgotten',
  phases: [
    { title: 'Gates', detail: 'per section: what it truly REQUIRES and UNLOCKS (evidence-based)', model: 'opus' },
    { title: 'Coverage', detail: 'anything in the pack/video not covered by any section?', model: 'opus' },
    { title: 'Judge', detail: 'synthesize: verdict on order/waves + concrete fixes', model: 'opus' },
  ],
}

const SECTIONS = ['start','tinkers','processing','thaumcraft','botania','bloodmagic','bees',
  'ae2','energistics','mekanism','dimensions','draconic','dragons','relics_elements','avaritia']

const GATE = {
  type: 'object', additionalProperties: false,
  properties: {
    key: { type: 'string' },
    requires: { type: 'array', items: { type: 'object', additionalProperties: false,
      properties: { from: { type: 'string' }, what: { type: 'string' }, hard: { type: 'boolean' }, evidence: { type: 'string' } },
      required: ['from','what','hard','evidence'] } },
    unlocks: { type: 'array', items: { type: 'object', additionalProperties: false,
      properties: { to: { type: 'string' }, what: { type: 'string' }, evidence: { type: 'string' } },
      required: ['to','what','evidence'] } },
    earliest_wave: { type: 'integer' },
    step_order_ok: { type: 'boolean' },
    step_order_issues: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['key','requires','unlocks','earliest_wave','step_order_ok','step_order_issues','notes'],
}

const COVER = {
  type: 'object', additionalProperties: false,
  properties: {
    missing_topics: { type: 'array', items: { type: 'object', additionalProperties: false,
      properties: { topic: { type: 'string' }, evidence: { type: 'string' }, where: { type: 'string' }, severity: { type: 'string' } },
      required: ['topic','evidence','where','severity'] } },
    verdict: { type: 'string' },
  },
  required: ['missing_topics','verdict'],
}

const JUDGE = {
  type: 'object', additionalProperties: false,
  properties: {
    order_ok: { type: 'boolean' },
    proposed_order: { type: 'array', items: { type: 'string' } },
    proposed_phases: { type: 'object', additionalProperties: { type: 'integer' } },
    changes: { type: 'array', items: { type: 'object', additionalProperties: false,
      properties: { what: { type: 'string' }, why: { type: 'string' }, confidence: { type: 'string' } },
      required: ['what','why','confidence'] } },
    prereq_fixes: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } },
    milestone_fixes: { type: 'array', items: { type: 'string' } },
    verdict: { type: 'string' },
  },
  required: ['order_ok','proposed_order','proposed_phases','changes','prereq_fixes','milestone_fixes','verdict'],
}

function gprompt(key) {
  return `Ты — аудитор прогрессии модпака «TechnoMagic RPG» (Minecraft 1.7.10, LoliLand). Определи РЕАЛЬНЫЕ гейты раздела «${key}» гайда — что он жёстко требует от других разделов и что открывает для них. Только по свидетельствам, не по общим знаниям о ванильных модах (тут много кастома).

Прочитай Read (большие файлы — по частям):
1. data/sections/${key}.json — шаги раздела (поле detail содержит конкретику из 16ч видео-прохождения).
2. research/youtube/sections/${key}.beats.json — сырые биты видео по этому разделу (pct = % хронометража).
3. research/youtube/progression/timing.json — когда КАЖДЫЙ раздел реально идёт в видео (перцентили pct).
Опционально для проверки рецептов/названий: grep по data/names.txt (все имена предметов), data/strings/*.txt (строки кастомных модов), data/store_kits.json (что даают киты).

Раздел-ключи для ссылок: ${SECTIONS.join(', ')}.

Верни (schema):
- requires: список зависимостей ОТ других разделов: from=ключ раздела, what=конкретный предмет/машина/ресурс (напр. 'нейтроний из energistics', 'мана из botania для реагентной кузницы'), hard=true если без этого раздел непроходим (false = удобно, но обходимо), evidence=короткая цитата/факт из шагов или битов.
- unlocks: что этот раздел даёт другим (to, what, evidence).
- earliest_wave: минимальная волна (1-5), в которой раздел РЕАЛЬНО можно начать с пользой (1=старт, 2=ранняя техника, 3=развитие, 4=эндгейм, 5=финал).
- step_order_ok + step_order_issues: внутри раздела шаги идут в проходибельном порядке? (шаг N не требует результатов шага N+5 и т.п.) Перечисли конкретные проблемы, если есть.
- notes: 1-3 фразы: самое важное про место раздела в прогрессии (напр. 'в видео открыт на 10% хронометража, сильно раньше позиции в гайде').

Будь скептичен и конкретен: 3-8 requires с evidence лучше, чем 15 расплывчатых.`
}

log('Gates: 15 sections (opus)')
const gates = await parallel(SECTIONS.map(key => () =>
  agent(gprompt(key), { label: `gates:${key}`, phase: 'Gates', schema: GATE, model: 'opus', effort: 'high' })
))

const cover = agent(
  `Ты — аудитор полноты гайда «TechnoMagic RPG» (LoliLand). Вопрос: есть ли в сборке/видео-прохождении КРУПНЫЕ системы/этапы, которые гайд вообще не покрывает?

Гайд: 16 разделов (lifehacks-шпаргалка + ${SECTIONS.join(', ')}). Прочитай Read:
- data/workflow_result.json поле sections[].title + intro (быстрый обзор что покрыто; файл большой — читай кусками или выдерни python3-ом титулы).
- research/youtube/beats_index.txt — все 1827 битов видео (gid | pct | section | kind | title).
Проверь источники на непокрытое: data/store_kits.json (системы китов/привилегий), data/wiki_index.json (все вики-страницы клиента), ls data/wiki/ (160 машин), data/strings/*.txt (кастомные моды: LoliDungeons, LoliDecorative и др.).

Ищи ИМЕННО крупное: целые механики/системы (данжи, эвенты, рынок/аукцион, кланы, квест-группы, боссы, отдельные моды с контентом), а не отдельные предметы. severity: high (целая система с прогрессией) | med (заметная механика) | low (мелочь).
where: куда это добавить (ключ существующего раздела или 'новый раздел').
Верни (schema) missing_topics + verdict (2-3 фразы).`,
  { label: 'coverage', phase: 'Coverage', schema: COVER, model: 'opus', effort: 'high' })

const coverRes = await cover
const gatesOk = gates.filter(Boolean)
log(`gates done: ${gatesOk.length}/15; coverage gaps: ${coverRes ? coverRes.missing_topics.length : '?'}`)

const judge = await agent(
  `Ты — главный судья прогрессии гайда «TechnoMagic RPG». Реши: верно ли и ОПТИМАЛЬНО ли текущее деление на этапы/волны и порядок, и что конкретно поправить.

ДАНО (всё уже собрано, файлы читать не обязательно, но можешь сверяться Read'ом):
1. Текущий порядок гайда: lifehacks(шпаргалка,волна1), start(1), tinkers(2), processing(2), thaumcraft(3), botania(3), dimensions(3), bloodmagic(3), ae2(3), energistics(3), mekanism(3), bees(3), draconic(4), dragons(4), relics_elements(4), avaritia(5). Волны: 1=Старт, 2=Ранняя техника, 3=Развитие (параллельные ветки, кооп: техника vs магия), 4=Эндгейм, 5=Финал. Порядок внутри волн = порядок в массиве order.
2. Эмпирика видео (перцентили % хронометража, когда тема реально шла): ${JSON.stringify(gatesOk.length ? undefined : null) || ''}
   tinkers med=4, processing med=10, ae2 med=23 (p25=10!), dimensions med=26, bloodmagic med=36, thaumcraft med=42 (p10=14), botania med=48 (p25=19), bees med=53 (p25=49), mekanism med=54 (p25=23), draconic med=56 (p25=35), relics_elements med=64 (p25=47), energistics med=65 (p25=41), dragons med=71 (p25=43), avaritia med=80 (p25=52).
3. Гейт-аудит всех разделов (requires/unlocks/earliest_wave/step_order, с evidence): ${JSON.stringify(gatesOk)}

ЗАДАЧА:
- Построй граф жёстких зависимостей (hard=true) и проверь текущий порядок на противоречия (раздел стоит раньше своего hard-prereq).
- Сверь волны с earliest_wave и эмпирикой. Помни: видео — маршрут ОДНОГО игрока с ошибками; гайд — оптимальный кооп-маршрут. Расхождение с видео само по себе не ошибка, но яркие сигналы (AE2 на 10-23% видео против позиции ПОСЛЕ крови/ботании в гайде) — повод передвинуть.
- Реши, менять ли порядок/волны. Меняй только с уверенной аргументацией (confidence high/med) — статус-кво тоже ответ, если он оптимален.
- prereq_fixes: для КАЖДОГО из 15 разделов дай чистый prereqKeys — список РЕАЛЬНЫХ ключей разделов (только из: ${SECTIONS.join(', ')}), только hard-зависимости, БЕЗ циклов и псевдо-ключей ('mining','power','magic' и т.п. — выкинуть).
- milestone_fixes: правки формулировок вех, если порядок изменится.

Верни (schema): order_ok, proposed_order (ПОЛНЫЙ порядок всех 16 ключей включая lifehacks первым; если менять не надо — текущий), proposed_phases (ключ->волна 1-5 для всех 16), changes (каждое отличие от текущего: what/why/confidence), prereq_fixes, milestone_fixes, verdict (3-5 фраз: главный вывод).`,
  { label: 'judge', phase: 'Judge', schema: JUDGE, model: 'opus', effort: 'xhigh' })

log(`judge: order_ok=${judge && judge.order_ok}; changes=${judge ? judge.changes.length : '?'}`)
return { gates: gatesOk, coverage: coverRes, judge }
