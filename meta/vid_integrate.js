export const meta = {
  name: 'tm-video-integrate',
  description: 'Enrich each existing guide section with everything from the video walkthrough beats (lossless), preserving existing steps',
  phases: [
    { title: 'Integrate', detail: 'one agent per section: existing steps + video beats -> enriched section JSON' },
    { title: 'Critique', detail: 'completeness critic: any major video beat dropped?' },
  ],
}

let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch (e) { A = {} } }
if (!A || typeof A !== 'object') A = {}

const SECTIONS = A.sections || ['start','tinkers','processing','thaumcraft','botania','bloodmagic','bees',
  'ae2','energistics','mekanism','dimensions','draconic','dragons','relics_elements','avaritia']
// beat-bucket sizes (from vid_merge.py) -> drive per-section effort
const BUCKETS = A.buckets || {}
function effortFor(key) {
  const n = BUCKETS[key] || 0
  if (n >= 300) return 'max'
  if (n >= 130) return 'xhigh'
  return 'high'
}

const SUMMARY = {
  type: 'object', additionalProperties: false,
  properties: {
    key: { type: 'string' }, wrote: { type: 'boolean' },
    steps_before: { type: 'integer' }, steps_after: { type: 'integer' }, new_steps: { type: 'integer' },
    note: { type: 'string' },
  },
  required: ['key', 'wrote', 'steps_before', 'steps_after', 'new_steps', 'note'],
}

const CRIT = {
  type: 'object', additionalProperties: false,
  properties: {
    gaps: { type: 'array', items: { type: 'object', additionalProperties: false,
      properties: { section: { type: 'string' }, missing: { type: 'string' }, gids: { type: 'array', items: { type: 'integer' } } },
      required: ['section', 'missing', 'gids'] } },
    verdict: { type: 'string' },
  },
  required: ['gaps', 'verdict'],
}

function iprompt(key) {
  const secFile = `data/sections/${key}.json`
  const beatFile = `research/youtube/sections/${key}.beats.json`
  const outFile = `data/sections/${key}.enriched.json`
  const nb = BUCKETS[key] || 0
  return `Ты — редактор гайда по модпаку «TechnoMagic RPG» (Minecraft 1.7.10, сервер LoliLand). Задача: ДОПОЛНИТЬ раздел гайда «${key}» всем содержимым из 16-часового видео-прохождения, НИЧЕГО не потеряв — ни из старого гайда, ни из видео.

Прочитай инструментом Read два файла:
1. Существующий раздел (СХЕМА-ЭТАЛОН, её и держись): ${secFile}
2. Beats из видео для этого раздела (~${nb} шт., упорядочены по ходу видео; поле gid — глоб. id, pct — % видео): ${beatFile}
   ВАЖНО: файл beats может быть большим (${nb} записей). Прочитай его ПОЛНОСТЬЮ — при необходимости несколькими вызовами Read с offset/limit — и учти КАЖДУЮ запись. Ни одного beat не пропусти.

Собери ОБНОВЛЁННЫЙ раздел и запиши его инструментом Write в файл:
  ${outFile}
Строго JSON-объект той же схемы, что вход №1:
{
 "key": "${key}",
 "title": "<оставь или чуть уточни>",
 "questGroupGuess": "<оставь>",
 "confirmed": true,
 "intro": "<можно расширить: 2-5 предложений, отражающих реальный ход видео по этой теме>",
 "estTime": "<оставь или уточни>",
 "prereqKeys": [<оставь>],
 "steps": [ { "title": "...", "detail": "...", "items": ["..."], "serverNote": "...", "coop": "...", "opt": "...", "kit": "...", "optional": false }, ... ]
}

ЖЁСТКИЕ ПРАВИЛА:
1. НЕ ТЕРЯЙ существующие шаги. Каждый шаг из входа №1 должен остаться (можешь обогатить его detail конкретикой из beats: точные числа, рецепты, размеры мультиблоков, схемы ферм — но не удаляй имеющуюся информацию и не выхолащивай).
2. ДОБАВЬ новые шаги на всё, что есть в beats, но не покрыто старыми шагами. Основание каждого нового шага — только beats (ничего не выдумывай сверх сказанного в видео).
3. КОНСОЛИДИРУЙ разумно, но НЕ ЦЕНОЙ ПОТЕРЬ: объединяй родственные beats в один связный шаг (несколько фактов -> в detail одного шага). В detail ОБЯЗАТЕЛЬНО сохрани ВСЕ конкретные факты из beats: точные числа (энергия, RF/EU, температуры, HP боссов, тиры, размеры мультиблоков NxNxN, количества, % шансов), названия предметов/машин/модов, рецепты и ингредиенты, схемы ферм и автоматизации, дюп-трюки, координаты/навигацию, предупреждения. Ни одно число и ни одна постройка из beats не должны пропасть. Числа шагов не ограничивай искусственно — для большого раздела нормально 30–60 шагов; лучше насыщенный, но полный раздел, чем красивый, но потерявший факты.
4. Порядок шагов — по реальному ходу прохождения (используй pct/gid и логику прогрессии).
5. Поля-заметки используй по назначению: serverNote — серверная специфика (команды, привилегии, вайп, экономика); coop — как делить работу вдвоём; opt — оптимизации/дюп-трюки/эффективные схемы из видео; kit — что даёт кит/привилегия. optional=true для необязательных/оптимизационных/побочных шагов. Пустые поля оставляй "".
6. items — русские названия ключевых предметов/блоков/машин шага (как в игре). По возможности переиспользуй формулировки из старого гайда (для иконок).
7. Русский язык, тон — практичный гайд-чеклист, как в существующих шагах.

После записи проверь: \`python3 -c "import json;d=json.load(open('${outFile}'));print(d['key'], len(d['steps']))"\` — JSON валиден, steps непустой, ключ совпадает.

Верни сводку (schema): key, wrote, steps_before (сколько было во входе №1), steps_after, new_steps, note (1 фраза что добавил).`
}

log(`Integrate: ${SECTIONS.length} sections (efforts by bucket size)`)
const results = await parallel(SECTIONS.map(key => () =>
  agent(iprompt(key), { label: `integrate:${key}`, phase: 'Integrate', schema: SUMMARY, effort: effortFor(key) })
))

// completeness critic over the beats_index vs what got written
const crit = await agent(
  `Ты — критик полноты. Проверь, что интеграция видео в гайд ничего КРУПНОГО не потеряла.
Прочитай Read:
- research/youtube/beats_index.txt — компактный список ВСЕХ beats из видео (gid | pct | section | kind | title).
- Обогащённые разделы: data/sections/<key>.enriched.json для ключей: ${SECTIONS.join(', ')}.
Для каждого раздела бегло сверь: попали ли крупные beats (особенно kind=build/farm/recipe/boss/dupe/number/goal) в шаги раздела (по смыслу title/detail). Мелкие реплики игнорируй.
Верни (schema) gaps: список реально пропущенного крупного контента [{section, missing (что именно), gids}], и verdict (1-2 фразы). Если крупных потерь нет — gaps пустой.`,
  { label: 'critic:completeness', phase: 'Critique', schema: CRIT, effort: 'high' })

const ok = results.filter(r => r && r.wrote)
log(`integrated ${ok.length}/${SECTIONS.length}; critic gaps: ${(crit && crit.gaps || []).length}`)
return { results: results.filter(Boolean), critique: crit }
