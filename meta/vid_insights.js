export const meta = {
  name: 'tm-video-insights',
  description: 'Mine the walkthrough transcript for skips, regrets/traps, tricks/dupes, and viewer tips',
  phases: [{ title: 'Mine', detail: 'one agent per chunk -> insight items JSON on disk' }],
}

let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch (e) { A = {} } }
if (typeof A === 'number') A = { n: A }
if (!A || typeof A !== 'object') A = {}
const N = A.n || 43

const SUMMARY = {
  type: 'object', additionalProperties: false,
  properties: {
    chunk: { type: 'integer' }, wrote: { type: 'boolean' }, n: { type: 'integer' },
    cats: { type: 'array', items: { type: 'string' } }, note: { type: 'string' },
  },
  required: ['chunk', 'wrote', 'n', 'cats', 'note'],
}

const KEYS = 'start, tinkers, processing, thaumcraft, botania, bloodmagic, bees, ae2, energistics, mekanism, dimensions, draconic, dragons, relics_elements, avaritia'

function prompt(i) {
  const file = `research/youtube/chunks/chunk_${String(i).padStart(2, '0')}.txt`
  const out = `research/youtube/insights/chunk_${String(i).padStart(2, '0')}.json`
  return `Ты — редактор гайда. Тебе дан фрагмент ${i}/${N} русских автосубтитров 16-часового прохождения «TechnoMagic RPG» (LoliLand). Автор играл 300+ часов и по ходу постоянно роняет ЦЕННЫЕ мета-ремарки: где он налажал, что можно было пропустить, какие есть дюпы/хитрости, и что ему подсказали зрители. Эти ремарки — золото для читателя (экономят десятки часов). Обычные механики/крафты НЕ нужны (они уже в гайде) — выуди ТОЛЬКО мета-инсайты 4 типов.

Прочитай Read: ${file}
Затем Write в ${out} — СТРОГО JSON-массив объектов:
{
  "category": "skip|trap|trick|viewer_tip",
  "section": "<ОДИН ключ раздела, куда это относится: ${KEYS}>",
  "topic": "<2-5 слов: о чём инсайт — чтобы привязать к нужному шагу гайда, напр. 'крафт наносета', 'алтарь крови T4', 'ядра дракона'>",
  "title": "<короткий заголовок инсайта по-русски>",
  "detail": "<суть по-русски, с конкретикой: что именно, почему, на что заменить/как пропустить. Сохрани числа и названия>",
  "impact": "high|med|low"
}

ТИПЫ (бери только явное, не выдумывай):
- "skip" — СКИП/короткий путь: автор говорит, что этап/крафт/действие можно НЕ делать, пропустить, сделать проще/быстрее/дешевле; что это необязательно; более прямой маршрут к цели. ('можно не', 'можно сразу', 'проще', 'необязательно', 'пропустить', 'зачем, если можно').
- "trap" — ГРАБЛИ/сожаление автора: он жалеет или удивляется — «зачем я это крафтил», «оказывается, это давали в ките/квесте/можно купить/дюпнуть», «зря потратил время/ресурсы», «надо было раньше/иначе», «на самом деле не нужно». Урок читателю: НЕ повторяй. ('зря', 'оказывается', 'можно было', 'не надо было', 'давали', 'зачем я').
- "trick" — ХИТРОСТЬ/дюп/лайфхак: дюп-трюк, эксплойт, неочевидная умная схема/автоматизация, крупная экономия ресурсов/времени, «имба»-приём.
- "viewer_tip" — СОВЕТ ЗРИТЕЛЕЙ: автор ссылается на комментарии/подписчиков/зрителей («мне подсказали», «в комментариях писали/советовали», «зрители подсказали», «спасибо за совет»).

ПРАВИЛА:
1. Только реально сказанное автором в этом фрагменте. Не превращай обычные крафты в «инсайты».
2. Один инсайт = один объект. Если ремарок нет — запиши пустой массив [].
3. Автосубтитры кривые — чини очевидные искажения по смыслу.
4. impact=high, если это экономит много времени/ресурсов или спасает от крупной ошибки.

Проверь валидность: \`python3 -c "import json;print(len(json.load(open('${out}'))))"\`.
Верни сводку (schema): chunk=${i}, wrote, n (кол-во инсайтов), cats (уникальные category), note (1 фраза).`
}

const items = []
for (let k = 1; k <= N; k++) items.push(k)
log(`Mine insights: ${N} chunks`)
const out = await parallel(items.map(i => () =>
  agent(prompt(i), { label: `mine:${String(i).padStart(2, '0')}`, phase: 'Mine', schema: SUMMARY, effort: 'high' })
))
const ok = out.filter(r => r && r.wrote)
const total = ok.reduce((a, r) => a + (r.n || 0), 0)
const failed = items.filter(i => !out.find(r => r && r.chunk === i && r.wrote))
log(`mined ${ok.length}/${N} chunks, ${total} insights; failed: ${failed.join(',') || 'none'}`)
return { ok: ok.length, total, failed, summaries: out.filter(Boolean) }
