export const meta = {
  name: 'tm-lifehacks-dissolve',
  description: 'Distribute the lifehacks cheat-sheet content into the 15 target sections (patches: notes + new steps)',
  phases: [
    { title: 'Distribute', detail: 'per section: which cheat-sheet bullets/unmapped insights belong here and are not yet present', model: 'opus' },
  ],
}

const SECTIONS = ['start','tinkers','processing','thaumcraft','botania','bloodmagic','bees',
  'ae2','energistics','mekanism','dimensions','draconic','dragons','relics_elements','avaritia']

const PATCH = {
  type: 'object', additionalProperties: false,
  properties: {
    key: { type: 'string' },
    notes: { type: 'array', items: { type: 'object', additionalProperties: false,
      properties: { step: { type: 'integer' }, field: { type: 'string', enum: ['skip','trap','trick','tipv'] }, text: { type: 'string' } },
      required: ['step','field','text'] } },
    new_steps: { type: 'array', items: { type: 'object', additionalProperties: false,
      properties: { after: { type: 'integer' }, title: { type: 'string' }, detail: { type: 'string' },
        optional: { type: 'boolean' }, items: { type: 'array', items: { type: 'string' } } },
      required: ['after','title','detail','optional','items'] } },
    already_covered: { type: 'integer' },
    note: { type: 'string' },
  },
  required: ['key','notes','new_steps','already_covered','note'],
}

function prompt(key) {
  return `Ты — редактор гайда «TechnoMagic RPG» (LoliLand). Мы РАСФОРМИРОВЫВАЕМ отдельную вкладку-шпаргалку «Скипы, хитрости и грабли»: всё её содержимое должно жить прямо в целевых разделах. Твой раздел: «${key}». Повторы между разделами РАЗРЕШЕНЫ — если совет касается двух разделов, он должен быть в обоих.

Прочитай Read:
1. data/sections/${key}.json — текущий раздел. У шагов уже есть плашки-заметки в полях skip/trap/trick/tipv/opt (многое из шпаргалки УЖЕ здесь). Шаги индексируются 0..N-1 по порядку в массиве.
2. data/sections/lifehacks.json — шпаргалка (10 шагов-групп; внутри detail — маркированные пункты «•», у многих в скобках указан этап).
3. research/youtube/insights/unmapped.json — 37 инсайтов, не привязанных к шагам ранее ({section, field, text}).

ЗАДАЧА: найди ВСЁ из шпаргалки и unmapped, что относится к разделу «${key}» и ещё НЕ отражено в нём (ни в плашках, ни в detail шагов), и выдай патчи:
- notes: доклейка плашки к существующему шагу: step=индекс, field (skip|trap|trick|tipv — по смыслу: скип/短путь->skip, «не повторяй, автор зря»->trap, дюп/хитрость->trick, совет зрителей->tipv), text — короткая плашка 1-2 фразы с конкретикой (числа/цены/названия сохранить).
- new_steps: если пункт(ы) существенные и не ложатся НИ на один шаг — новый шаг: after=индекс шага, ПОСЛЕ которого вставить (-1 = в самое начало), title, detail (можно объединить несколько родственных пунктов; сохрани все конкретные факты), optional=true (справочные/необязательные), items=[] или ключевые предметы.
- already_covered: сколько релевантных пунктов уже присутствует в разделе (ничего для них не выдавай).

ОСОБО для start: главное правило шпаргалки («сначала открой дерево квестов, потом крафти: часть предметов засчитывается ТОЛЬКО ручным крафтом, а за некоторые крафты дают жирные награды — скрафтишь заранее, потеряешь») должно попасть в start как заметная плашка trap на шаг про книгу квестов, даже если частично упоминалось.
ОСОБО для разделов с квест-наградными предметами (квантовый сет, матричный сборщик, искрящее ядро, панели, легендарный спавнер и т.п.): если правило «крафть вручную ради зачёта квеста / не крафть заранее» касается конкретного предмета твоего раздела — повесь trap-плашку на соответствующий шаг.

ПРАВИЛА:
1. НИЧЕГО не выдумывай — только содержимое шпаргалки/unmapped.
2. Не дублируй то, что уже есть в разделе (сверь по смыслу, не по точной строке).
3. Плашки коротко; развёрнутое — в new_steps.
4. Лучше 3-10 точных патчей, чем 30 воды. Если всё уже покрыто — пустые массивы и честный already_covered.

Верни (schema): key, notes, new_steps, already_covered, note (1-2 фразы: что добавил).`
}

log(`Distribute: ${SECTIONS.length} sections (opus)`)
const out = await parallel(SECTIONS.map(key => () =>
  agent(prompt(key), { label: `dist:${key}`, phase: 'Distribute', schema: PATCH, model: 'opus', effort: 'high' })
))
const ok = out.filter(Boolean)
const tn = ok.reduce((a, r) => a + r.notes.length, 0), ts = ok.reduce((a, r) => a + r.new_steps.length, 0)
log(`patches: ${tn} notes + ${ts} new steps across ${ok.length} sections`)
return { patches: ok }
