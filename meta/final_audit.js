export const meta = {
  name: 'tm-final-audit',
  description: 'Purge remaining author-loot logs from stages, then full loss-audit vs pre-restructure legacy sections',
  phases: [
    { title: 'Scrub', detail: 'per stage: systemic mechanics stay, personal loot-logs go', model: 'opus' },
    { title: 'Loss', detail: 'per legacy section: what valuable progression content is missing from the 5 stages', model: 'opus' },
  ],
}

const S_SUM = { type:'object', additionalProperties:false, properties:{
  stage:{type:'integer'}, wrote:{type:'boolean'}, steps_deleted:{type:'integer'}, steps_rewritten:{type:'integer'},
  note:{type:'string'}}, required:['stage','wrote','steps_deleted','steps_rewritten','note'] }

const L_SUM = { type:'object', additionalProperties:false, properties:{
  key:{type:'string'},
  missing:{type:'array', items:{type:'object', additionalProperties:false, properties:{
    what:{type:'string'}, from:{type:'string'}, suggest_stage:{type:'integer'}, severity:{type:'string'},
    evidence:{type:'string'}}, required:['what','from','suggest_stage','severity','evidence']}},
  verdict:{type:'string'}}, required:['key','missing','verdict'] }

const FLAGGED = {
  1: [7,10,11], 2: [6,24,25,28,31], 3: [21,22,38,40,62],
  4: [5,7,9,13,15,21,27,30,41,45,47,56,66,67,69,74], 5: [0,3],
}

function sprompt(n) {
  return `Ты — редактор гайда «TechnoMagic RPG». Пользователь заметил: в гайде ОСТАЛИСЬ куски «личного лута автора видео» (перечни выпавшего из коробок/кейсов/аирдропов). Дочисти этап ${n}.

Прочитай Read: data/sections/stage${n}.json (кусками, полностью).
Подозрительные шаги (лексика бокс/дроп/выпал): индексы ${JSON.stringify(FLAGGED[n])}. Но проверь ВЕСЬ этап — список не исчерпывающий.

КРИТЕРИЙ (думай критически):
- ОСТАВИТЬ (системная механика сервера): «собирай часовые кейсы, в выходные шансы выше», «спайрдропы/аирдропы падают и их стоит ловить», «квест X даёт коробку Y», «квантовые/лоли-коробки — источник панелей/ядер класса Z» (без перечня конкретного лута), цены/ориентиры.
- УБРАТЬ (личная удача автора): перечни конкретного выпавшего («панели, 64к ячейка, ускоренный сборщик», «дало половину искрящей материи», «несколько раз подряд розовое золото»), «повезло/зароллил», привязка прогрессии к конкретному дропу («благодаря выпавшему X автор…» → переформулируй маршрут без опоры на дроп, дроп упомяни как возможное ускорение).
- Шаг, который ЦЕЛИКОМ лог лута (напр. #24 этапа 2 «Лут из коробок: панели, 64к ячейка, ускоренный сборщик») — УДАЛИ как шаг; если в нём есть 1-2 системных факта — перенеси их коротко в соседний подходящий шаг (в detail или opt), затем удали.
- Механика «вскрывай коробки как источник X» может остаться отдельным optional-шагом, если она реально маршрутная (например, панели в этапе 4).

Правь detail/items/заметки; удалять шаги МОЖНО (прогресс пользователей уже сброшен реструктуризацией), но только чистые логи. Ничего не выдумывай. Проверь JSON (python3 json.load).
Верни (schema): stage=${n}, wrote, steps_deleted, steps_rewritten, note (что удалил/переписал, кратко).`
}

const LEGACY = ['start','tinkers','processing','thaumcraft','botania','bloodmagic','bees',
  'ae2','energistics','mekanism','dimensions','draconic','dragons','relics_elements','avaritia']

function lprompt(key) {
  return `Ты — аудитор потерь контента гайда «TechnoMagic RPG». Гайд реструктурировали из 15 мод-разделов в 5 этапов; проверь, что из СТАРОГО раздела «${key}» не потерялось ничего ЦЕННОГО для прогрессии.

Прочитай Read:
1. research/legacy_sections/${key}.json — старый раздел (эталон ДО реструктуризации).
2. Текущие этапы data/sections/stage1..5.json — используй Bash grep -l/-n по ключевым словам (названия машин/предметов/чисел из старого раздела), чтобы найти соответствия, вместо чтения всех файлов целиком; спорные места дочитывай Read-ом.

ЦЕННОЕ = механики, рецепты/цепочки, конкретные числа (энергия/LP/тиры/размеры), схемы ферм/автоматизации, дюпы, гейты, предупреждения-грабли, скипы, серверные заметки, вайп-пометки. НЕ ценное (потеря НЕ является проблемой): личный лут автора, RNG-логи, повторы, флейвор.

Для каждого пропавшего ценного фрагмента верни запись: what (что именно, с конкретикой), from (${key}#idx), suggest_stage (куда вставить 1-5), severity (high=гейт/механика/дюп потерян | med=полезные числа/совет | low=мелочь), evidence (цитата из старого раздела ≤25 слов).
Верни (schema): key, missing (ТОЛЬКО реальные потери; пусто — отличный результат), verdict (1-2 фразы).`
}

log('Scrub: 5 stages (opus)')
const scrub = await parallel([1,2,3,4,5].map(n => () =>
  agent(sprompt(n), { label: `scrub:stage${n}`, phase: 'Scrub', schema: S_SUM, model: 'opus', effort: 'high' })
))

log('Loss audit: 15 legacy sections (opus)')
const loss = await parallel(LEGACY.map(key => () =>
  agent(lprompt(key), { label: `loss:${key}`, phase: 'Loss', schema: L_SUM, model: 'opus', effort: 'high' })
))

const allMiss = loss.filter(Boolean).flatMap(r => r.missing.map(m => ({...m, section: r.key})))
log(`scrub done; loss audit: ${allMiss.length} missing items across ${loss.filter(r=>r&&r.missing.length).length} sections`)
return { scrub: scrub.filter(Boolean), loss: loss.filter(Boolean) }
