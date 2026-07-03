export const meta = {
  name: 'tm-insights-apply',
  description: 'Attach mined insights to the exact steps (inline notes) and build the "Скипы, хитрости и грабли" cheat-sheet section',
  phases: [
    { title: 'Attach', detail: 'per section: map insights -> best step as skip/trap/trick/tipv note' },
    { title: 'CheatSheet', detail: 'build data/sections/lifehacks.json from all insights' },
  ],
}

let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch (e) { A = {} } }
if (!A || typeof A !== 'object') A = {}
const SECTIONS = A.sections || ['start','tinkers','processing','thaumcraft','botania','bloodmagic','bees',
  'ae2','energistics','mekanism','dimensions','draconic','dragons','relics_elements','avaritia']

const ATTACH_SUMMARY = {
  type: 'object', additionalProperties: false,
  properties: { key:{type:'string'}, wrote:{type:'boolean'}, n_attachments:{type:'integer'},
    n_unmapped:{type:'integer'}, note:{type:'string'} },
  required: ['key','wrote','n_attachments','n_unmapped','note'],
}
const CS_SUMMARY = {
  type: 'object', additionalProperties: false,
  properties: { wrote:{type:'boolean'}, n_steps:{type:'integer'}, note:{type:'string'} },
  required: ['wrote','n_steps','note'],
}

function aprompt(key) {
  const secFile = `data/sections/${key}.json`
  const insFile = `research/youtube/insights/by_section/${key}.json`
  const out = `research/youtube/insights/attach/${key}.json`
  return `Ты — редактор гайда «TechnoMagic RPG». Задача: привязать мета-инсайты (скипы/грабли/хитрости/советы зрителей) из видео к КОНКРЕТНЫМ шагам раздела «${key}», как короткие плашки-заметки.

Прочитай Read:
1. Раздел с шагами: ${secFile}  — шаги в массиве steps идут по индексам 0,1,2,... (индекс = позиция в массиве).
2. Инсайты этого раздела: ${insFile} — объекты с полями category (skip|trap|trick|viewer_tip), topic, title, detail, impact.

Собери привязки и Write в ${out} — СТРОГО JSON:
{
 "attachments": [
   { "step": <индекс шага 0..N-1, к которому инсайт относится ПО СМЫСЛУ (по topic/detail vs title/detail шага); -1 если ни к одному шагу не подходит>,
     "field": "skip|trap|trick|tipv",     // skip<-skip, trap<-trap, trick<-trick, tipv<-viewer_tip
     "text": "<короткая плашка по-русски, 1-2 фразы, по делу, с конкретикой/числами; это подсказка ПОВЕРХ шага>" }
 ]
}

ПРАВИЛА:
1. field по category: skip→"skip", trap→"trap", trick→"trick", viewer_tip→"tipv".
2. Привязывай к самому релевантному шагу (по теме/предмету). Если инсайт общий для раздела и не ложится на конкретный шаг — step=-1 (уйдёт в общую шпаргалку).
3. text — КОРОТКО и полезно: что сделать/чего не делать и почему. Сохрани числа и названия. Не копируй detail целиком, ужми до сути.
4. Если на один шаг ложатся несколько инсайтов одного field — сделай ОТДЕЛЬНЫЕ attachments (их потом объединят).
5. Не выдумывай привязки: лучше step=-1, чем притянуть за уши. Не добавляй инсайтов, которых нет во входе.

Проверь валидность JSON. Верни (schema): key, wrote, n_attachments, n_unmapped (сколько step=-1), note.`
}

log(`Attach: ${SECTIONS.length} sections`)
const attach = await parallel(SECTIONS.map(key => () =>
  agent(aprompt(key), { label: `attach:${key}`, phase: 'Attach', schema: ATTACH_SUMMARY, effort: 'high' })
))

// cheat-sheet section from ALL insights
const cs = await agent(
  `Ты — редактор гайда «TechnoMagic RPG» (LoliLand). Построй НОВЫЙ раздел-шпаргалку «Скипы, хитрости и грабли» — выжимку всех мета-инсайтов из 16-часового прохождения, чтобы читатель не потратил 300 часов как автор.

Прочитай Read:
- research/youtube/insights/index.txt — компактный список ВСЕХ инсайтов (gid | category | section | impact | title :: detail). Может быть большим — читай весь (offset/limit при нужде).
- research/youtube/insights/all_insights.json — те же инсайты с полным detail (для точных формулировок/чисел).

Собери и Write в data/sections/lifehacks.json — СТРОГО JSON того же формата, что другие разделы:
{
 "key": "lifehacks",
 "title": "Скипы, хитрости и грабли (не повторяй за автором)",
 "questGroupGuess": "",
 "confirmed": true,
 "intro": "<2-4 предложения: это сквозная шпаргалка по всему прохождению — что можно пропустить, что автор крафтил зря (давалось/покупалось/дюпалось), какие есть дюпы и хитрости, и что подсказали зрители. Читать перед стартом и сверяться по ходу.>",
 "estTime": "читать по ходу",
 "prereqKeys": [],
 "steps": [ { "title":"...", "detail":"...", "items":[], "serverNote":"", "coop":"", "optional": true }, ... ]
}

СТРУКТУРА шагов (сгруппируй инсайты по смыслу; внутри — маркированный список конкретных пунктов в detail; каждый пункт с числами/названиями; в скобках указывай к какому этапу относится):
- «🪤 Грабли: что автор крафтил/делал зря» (все category=trap) — можно разбить на 2-3 шага по этапам (ранние/средние/поздние), если пунктов много.
- «⏭️ Скипы: что можно пропустить или сделать короче» (category=skip).
- «🔁 Дюпы и хитрости эффективности» (category=trick) — самые мощные приёмы; помечай масштаб (сколько экономит).
- «💬 Советы из комментариев зрителей» (category=viewer_tip).
Начинай каждую группу с самых impact=high пунктов. Дедуплицируй повторы. НИЧЕГО важного не потеряй, но пиши сжато и по делу. Все шаги optional:true.

Проверь JSON. Верни (schema): wrote, n_steps, note.`,
  { label: 'cheatsheet:lifehacks', phase: 'CheatSheet', schema: CS_SUMMARY, effort: 'xhigh' })

const ok = attach.filter(r => r && r.wrote)
log(`attached ${ok.length}/${SECTIONS.length}; cheat-sheet steps: ${cs && cs.n_steps}`)
return { attach: attach.filter(Boolean), cheatsheet: cs }
