export const meta = {
  name: 'verify-progression-vs-playlist',
  description: 'Сверка гайда LoliLand TechnoMagic против 48 серий + ep49: пропуски, порядок, тупики, критический путь к финалу',
  phases: [
    { title: 'Карта эпизодов' },
    { title: 'Финал ep49' },
    { title: 'Сверка' },
    { title: 'Оптимизация' },
    { title: 'Проверка находок' },
    { title: 'Итоговый отчёт' },
  ],
}

const DIR = '/home/def/projects/misc/loliland-guidence'
const TXT = DIR + '/research/youtube/txt'
const DIGEST = DIR + '/data/guide_digest.txt'
const FULL = DIR + '/data/workflow_result.json'

const EPISODE_MAP = {
  type: 'object', additionalProperties: false,
  required: ['episode', 'summary', 'milestones', 'bottlenecks', 'endgameRelevant'],
  properties: {
    episode: { type: 'integer' },
    title: { type: 'string' },
    primaryMods: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    milestones: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['what', 'kind'], properties: {
      what: { type: 'string' }, kind: { type: 'string', enum: ['craft', 'machine', 'quest', 'boss', 'unlock', 'resource', 'automation', 'base', 'other'] }, detail: { type: 'string' } } } },
    questGroupsMentioned: { type: 'array', items: { type: 'string' } },
    bottlenecks: { type: 'array', items: { type: 'string' } },
    optimizations: { type: 'array', items: { type: 'string' } },
    orderingSignals: { type: 'array', items: { type: 'string' } },
    endgameRelevant: { type: 'array', items: { type: 'string' } },
  },
}

const EP49_BEATS = {
  type: 'object', additionalProperties: false,
  required: ['part', 'beats', 'endgame'],
  properties: {
    part: { type: 'integer' },
    beats: { type: 'array', items: { type: 'string' } },
    endgame: { type: 'array', items: { type: 'string' } },
    notInMainEpisodes: { type: 'array', items: { type: 'string' } },
  },
}

const FINAL_GOAL = {
  type: 'object', additionalProperties: false,
  required: ['finalQuest', 'target', 'chain', 'prerequisites', 'coveredInGuide', 'missing'],
  properties: {
    finalQuest: { type: 'string' },
    target: { type: 'string' },
    chain: { type: 'array', items: { type: 'string' } },
    prerequisites: { type: 'array', items: { type: 'string' } },
    coveredInGuide: { type: 'boolean' },
    missing: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
}

const SYNTH = {
  type: 'object', additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['type', 'severity', 'section', 'title', 'evidence', 'fix'], properties: {
      type: { type: 'string', enum: ['gap', 'order-hazard', 'stuck-point', 'enrich'] },
      severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
      section: { type: 'string' },
      title: { type: 'string' },
      evidence: { type: 'string' },
      fix: { type: 'string' },
    } } },
    timeline: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['episodes', 'beat'], properties: {
      episodes: { type: 'string' }, guideSection: { type: 'string' }, beat: { type: 'string' } } } },
    note: { type: 'string' },
  },
}

const VERDICT = {
  type: 'object', additionalProperties: false,
  required: ['real', 'reason'],
  properties: {
    real: { type: 'boolean' },
    reason: { type: 'string' },
    correctedFix: { type: 'string' },
    severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
  },
}

const OPT = {
  type: 'object', additionalProperties: false,
  required: ['criticalPath', 'bottlenecks', 'optimizations', 'duoSplit'],
  properties: {
    criticalPath: { type: 'array', items: { type: 'string' } },
    bottlenecks: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['where', 'why', 'mitigation'], properties: {
      where: { type: 'string' }, why: { type: 'string' }, mitigation: { type: 'string' } } } },
    optimizations: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'detail', 'impact'], properties: {
      title: { type: 'string' }, detail: { type: 'string' }, impact: { type: 'string' }, risk: { type: 'string' } } } },
    duoSplit: { type: 'object', additionalProperties: false, required: ['playerA', 'playerB', 'syncPoints'], properties: {
      playerA: { type: 'array', items: { type: 'string' } }, playerB: { type: 'array', items: { type: 'string' } }, syncPoints: { type: 'array', items: { type: 'string' } } } },
  },
}

const REPORT = {
  type: 'object', additionalProperties: false,
  required: ['verdict', 'gaps', 'orderHazards', 'stuckPoints', 'optimizations', 'criticalPath', 'duoSplit', 'finalGoalChain', 'patches'],
  properties: {
    verdict: { type: 'object', additionalProperties: false, required: ['matchesPlaylist', 'confidence', 'summary'], properties: {
      matchesPlaylist: { type: 'string', enum: ['yes', 'mostly', 'partly', 'no'] }, confidence: { type: 'string' }, summary: { type: 'string' } } },
    gaps: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['severity', 'section', 'what', 'fix'], properties: {
      severity: { type: 'string' }, section: { type: 'string' }, what: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } } } },
    orderHazards: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['where', 'problem', 'fix'], properties: {
      where: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } } } },
    stuckPoints: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['section', 'missing', 'fix'], properties: {
      section: { type: 'string' }, missing: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } } } },
    optimizations: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'detail', 'impact'], properties: {
      title: { type: 'string' }, detail: { type: 'string' }, impact: { type: 'string' }, risk: { type: 'string' } } } },
    criticalPath: { type: 'array', items: { type: 'string' } },
    duoSplit: { type: 'object', additionalProperties: false, required: ['playerA', 'playerB', 'syncPoints'], properties: {
      playerA: { type: 'array', items: { type: 'string' } }, playerB: { type: 'array', items: { type: 'string' } }, syncPoints: { type: 'array', items: { type: 'string' } } } },
    finalGoalChain: { type: 'object', additionalProperties: false, required: ['target', 'allCovered', 'missing'], properties: {
      target: { type: 'string' }, allCovered: { type: 'boolean' }, missing: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } } },
    patches: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['action', 'section', 'detail'], properties: {
      action: { type: 'string', enum: ['add-step', 'reorder', 'add-note', 'fix', 'enrich'] }, section: { type: 'string' }, detail: { type: 'string' } } } },
  },
}

const pad = (n) => String(n).padStart(2, '0')

phase('Карта эпизодов')
const EPS = Array.from({ length: 48 }, (_, i) => i + 1)
const maps = (await parallel(EPS.map((n) => () =>
  agent(
    'Ты разбираешь стенограмму ОДНОЙ серии прохождения модпака LoliLand «TechnoMagic RPG» (Minecraft 1.7.10), сезон летнего вайпа, 48 серий + финал.\n' +
    'Прочитай файл: ' + TXT + '/' + pad(n) + '.txt (это серия №' + n + ', авто-субтитры/ASR — имена предметов могут быть искажены, ориентируйся на СМЫСЛ действий, а не на точное написание).\n\n' +
    'Извлеки ХРОНОЛОГИЧЕСКУЮ карту того, что игрок РЕАЛЬНО сделал в этой серии:\n' +
    '- summary: 1-2 фразы — главное достижение серии.\n' +
    '- milestones: конкретные вехи по порядку (скрафтил X, построил машину Y, открыл квест/группу Z, убил босса, автоматизировал W, поднял ресурс/тир). Каждой — kind и detail (числа, тиры, кол-во если названо).\n' +
    '- questGroupsMentioned: названия групп достижений если звучат («Пчелиная мания», «Дорога к Бесконечному», «Вся искрица» и т.п.).\n' +
    '- bottlenecks: где игрок застрял/гриндил/ждал/жаловался на сложность, что было гейтом ("не мог сделать X пока не было Y").\n' +
    '- optimizations: любые ускорения/шорткаты/«надо было раньше», которые игрок применил или упомянул.\n' +
    '- orderingSignals: явные сигналы порядка ("теперь когда есть X, можем Y", "для этого сначала нужно Z").\n' +
    '- endgameRelevant: всё про финал — нейтроний, сингулярности, искрящая материя, катализатор бесконечности, Infinity-броня/инструменты, драконья кровь, осколки Гайи, Draconic awakened, квест «Вся искрица».\n' +
    'Будь конкретным и опирайся ТОЛЬКО на текст серии. Не выдумывай.',
    { label: 'ep' + pad(n), phase: 'Карта эпизодов', schema: EPISODE_MAP },
  ),
))).filter(Boolean)
log('Карта эпизодов: ' + maps.length + '/48 серий разобрано')

phase('Финал ep49')
const PARTS = Array.from({ length: 8 }, (_, i) => i + 1)
const ep49 = (await parallel([
  ...PARTS.map((p) => () =>
    agent(
      'Это кусок ' + p + '/8 стенограммы 17-часового ФИНАЛЬНОГО суперката (ep49) того же прохождения LoliLand TechnoMagic RPG.\n' +
      'Прочитай: ' + DIR + '/research/youtube/ep49_chunks/part' + p + '.txt\n' +
      'Извлеки: beats — ключевые вехи прогрессии в этом куске по порядку; endgame — всё про финал сборки (нейтроний/сингулярности/искрящая материя/Infinity/катализатор/«Вся искрица»); ' +
      'notInMainEpisodes — то, что выглядит как шаг/деталь прогрессии, которого могло НЕ быть в обычных сериях (новые рецепты, обходы, нюансы сервера). Опирайся только на текст.',
      { label: 'ep49-' + p, phase: 'Финал ep49', schema: EP49_BEATS },
    ),
  ),
  () => agent(
    'Ты трассируешь ФИНАЛЬНУЮ цель сборки LoliLand TechnoMagic RPG до самого конца.\n' +
    'Прочитай: (1) ' + TXT + '/48.txt (серия «THE TRUE END», финал), (2) ' + TXT + '/47.txt, (3) дайджест гайда ' + DIGEST + ' (разделы energistics, relics_elements, avaritia, draconic, dragons).\n\n' +
    'Финальный квест называется «Вся искрица», финальная цель — собрать всё (искрящая материя / Infinity-броня и инструменты Avaritia через кастомный нейтрониевый конвейер LoliEnergistics).\n' +
    'Восстанови ПОЛНУЮ цепочку до финала: что такое «искрящая материя», из чего делается финальный сет/панель, какие под-ресурсы обязательны (нейтроний→как делается на этом сервере, AE2-сингулярности, драконья кровь, осколки Гайи, Draconic awakened core, космическая/звёздная нейтрониевая руда и т.п.).\n' +
    'Затем сверь: КАЖДОЕ звено этой цепочки покрыто ли в гайде (по дайджесту)? Что отсутствует или недо-описано? coveredInGuide + список missing.',
    { label: 'финал-цепочка', phase: 'Финал ep49', schema: FINAL_GOAL },
  ),
])).filter(Boolean)
const ep49beats = ep49.slice(0, 8)
const finalGoal = ep49[8] || null
log('Финал: ep49 разобран (' + ep49beats.length + ' кусков), цепочка финальной цели построена')

const mapsJSON = JSON.stringify(maps)
const ep49JSON = JSON.stringify(ep49beats)
const finalJSON = JSON.stringify(finalGoal)

phase('Сверка')
const lenses = [
  {
    key: 'timeline-order',
    prompt:
      'РАКУРС: ТАЙМЛАЙН и ПОРЯДОК.\n' +
      'Тебе дана реконструкция реального прохождения по сериям (JSON ниже) и дайджест гайда — прочитай ' + DIGEST + '.\n' +
      '1) Построй канонический таймлайн: какие серии → какой раздел гайда → какая веха (поле timeline).\n' +
      '2) Найди ORDER-HAZARD и STUCK-POINT: места, где ПОРЯДОК разделов гайда расходится с реальным прохождением так, что игрок на сервере застрянет (forward-reference: раздел требует то, что в гайде идёт ПОЗЖЕ; или гайд ставит этап до того как открыт его гейт).\n' +
      'Особое внимание: dimensions стоит в гайде на 6-м месте (до bloodmagic/ae2) — оправдано ли это по сериям? bees (Пчелиная мания) и draconic/dragons — на своих ли местах? thaumcraft как ранний гейт для botania — подтверждается?\n' +
      'Каждое расхождение — finding с type=order-hazard|stuck-point, severity, section, evidence (номера серий), fix.\nMAPS=' + mapsJSON,
  },
  {
    key: 'coverage-gaps',
    prompt:
      'РАКУРС: ПРОПУСКИ (что есть в видео, но НЕТ в гайде).\n' +
      'Дана карта серий (JSON) + дайджест гайда — прочитай ' + DIGEST + '.\n' +
      'Для каждого мода/системы сопоставь вехи из видео с шагами гайда и найди GAP: значимые действия/крафты/машины/автоматизации/боссы/квесты, которые игрок делал в сериях, но которых НЕТ в гайде (или они есть, но без ключевого под-шага).\n' +
      'Также enrich: где гайд есть, но без конкретных чисел/тиров/кол-в, которые названы в сериях.\n' +
      'Не пиши о том, что и так покрыто. Каждый GAP — finding (type=gap|enrich, severity, section=ключ раздела, evidence=серии, fix=что добавить). MAPS=' + mapsJSON + '\nEP49=' + ep49JSON,
  },
  {
    key: 'prereq-deadends',
    prompt:
      'РАКУРС: ТУПИКИ и ПРЕРЕКВИЗИТЫ.\n' +
      'Дана карта серий (JSON, поля bottlenecks/orderingSignals) + дайджест гайда — прочитай ' + DIGEST + '.\n' +
      'Найди места, где игрок на СЕРВЕРЕ забуксует: дорогие/долгие гриндовые гейты (мана, LP-кровь, нейтроний, AE-сингулярности, аспекты Thaumcraft, осколки Гайи), которые гайд недооценивает или не предупреждает; ресурсы, которые нужно начать копить ЗАРАНЕЕ, но гайд об этом молчит; серверные сложности рецептов.\n' +
      'Каждое — finding (type=stuck-point|enrich, severity, section, evidence=серии где виден гриндшток, fix=предупреждение/что начать заранее). MAPS=' + mapsJSON,
  },
]
const synthRaw = (await parallel(lenses.map((l) => () =>
  agent(l.prompt, { label: 'сверка:' + l.key, phase: 'Сверка', schema: SYNTH }),
))).filter(Boolean)
const timeline = (synthRaw.find((s) => s && s.timeline && s.timeline.length) || {}).timeline || []
const candidates = synthRaw.flatMap((s) => (s && s.findings) || [])
log('Сверка: ' + candidates.length + ' кандидатных находок, таймлайн ' + timeline.length + ' вех')

phase('Оптимизация')
const opts = (await parallel([
  () => agent(
    'Ты планируешь САМЫЙ БЫСТРЫЙ маршрут duo-команды (2 игрока, купят premium/VIP) к финалу сборки LoliLand TechnoMagic RPG.\n' +
    'Финал = квест «Вся искрица» / Infinity-броня и инструменты (искрящая материя) через кастомный нейтрониевый конвейер.\n' +
    'Дано: дайджест гайда (прочитай ' + DIGEST + '), карта реального прохождения (MAPS), цепочка финала (FINAL).\n' +
    '1) criticalPath: упорядоченная критическая цепочка (только то, что РЕАЛЬНО блокирует финал — без побочных веток).\n' +
    '2) bottlenecks: главные узкие места (нейтроний, мана, кровь-LP, сингулярности, осколки Гайи, аспекты) — why + mitigation (как ускорить на сервере).\n' +
    '3) optimizations: конкретные шорткаты (что делать параллельно/раньше, что копить впрок, что можно пропустить не теряя доступ к финалу, что даёт premium/VIP/магазин-боксы/монеты).\n' +
    '4) duoSplit: разделение труда playerA (техника) / playerB (магия) + syncPoints (где сходятся ветки).\n' +
    'MAPS=' + mapsJSON + '\nFINAL=' + finalJSON,
    { label: 'крит-путь', phase: 'Оптимизация', schema: OPT },
  ),
])).filter(Boolean)
const optimization = opts[0] || null
log('Оптимизация: критический путь и duo-разделение готовы')

phase('Проверка находок')
const top = candidates
  .filter((c) => c && (c.severity === 'critical' || c.severity === 'high' || c.severity === 'medium'))
  .slice(0, 40)
const verified = (await parallel(top.map((c) => () =>
  agent(
    'Скептически проверь находку о гайде LoliLand TechnoMagic. По умолчанию считай находку НЕ настоящей (real=false), пока не докажешь обратное по фактам.\n' +
    'НАХОДКА: type=' + c.type + ', severity=' + c.severity + ', section=' + c.section + '\n  title=' + c.title + '\n  evidence=' + c.evidence + '\n  fix=' + c.fix + '\n\n' +
    'Открой ПОЛНЫЙ гайд ' + FULL + ' и найди раздел с key="' + c.section + '" (или близкий). Проверь:\n' +
    '- Действительно ли это НЕ покрыто/нарушено? Может, шаг уже есть под другим названием?\n' +
    '- Подтверждается ли evidence реальным прохождением (это не выдумка)?\n' +
    'Верни real (true только если находка настоящая и полезная), reason, при необходимости correctedFix и уточнённый severity.',
    { label: 'проверка:' + c.section, phase: 'Проверка находок', schema: VERDICT },
  ).then((v) => (v ? Object.assign({}, c, { verdict: v }) : null)),
))).filter(Boolean)
const confirmed = verified.filter((f) => f.verdict && f.verdict.real)
  .map((f) => Object.assign({}, f, { severity: f.verdict.severity || f.severity, fix: f.verdict.correctedFix || f.fix }))
log('Проверка: подтверждено ' + confirmed.length + '/' + top.length + ' находок')

phase('Итоговый отчёт')
const report = await agent(
  'Ты — финальный синтезатор аудита гайда LoliLand TechnoMagic RPG против реального прохождения (48 серий + финальный суперкат).\n' +
  'Собери ИТОГОВЫЙ отчёт строго по схеме. Используй ТОЛЬКО подтверждённые находки и данные ниже; не добавляй новых непроверенных утверждений.\n\n' +
  'VERDICT: дай честную оценку matchesPlaylist (yes/mostly/partly/no) — совпадает ли прогрессия гайда с плейлистом и не забуксует ли игрок; confidence + summary (2-4 фразы).\n' +
  'Разнеси подтверждённые находки по gaps / orderHazards / stuckPoints. optimizations, duoSplit и criticalPath — возьми из OPT. finalGoalChain — из FINAL (target, allCovered, missing, notes).\n' +
  'patches: конкретные правки гайда (action: add-step/reorder/add-note/fix/enrich, section=ключ раздела, detail=что именно сделать) — приоритизируй по severity, максимум ~25 самых ценных.\n\n' +
  'CONFIRMED_FINDINGS=' + JSON.stringify(confirmed) + '\n\nTIMELINE=' + JSON.stringify(timeline) + '\n\nOPT=' + JSON.stringify(optimization) + '\n\nFINAL=' + finalJSON,
  { label: 'итог', phase: 'Итоговый отчёт', schema: REPORT, effort: 'high' },
)

return { report: report, stats: { episodes: maps.length, candidates: candidates.length, confirmed: confirmed.length }, timeline: timeline, finalGoal: finalGoal, optimization: optimization }
