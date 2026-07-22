export const meta = {
  name: 'tm-restage-assemble',
  description: 'Assemble the 5 quest-stage sections from buckets, then verify progression coherence and losses',
  phases: [
    { title: 'Assemble', detail: 'one opus agent per stage -> data/stages/stageN.json', model: 'opus' },
    { title: 'Verify', detail: 'coherence critic + loss critic', model: 'opus' },
  ],
}

const STAGE_META = [
  { n: 1, title: 'Старт и обустройство', goal: 'база в реалме, киты, молот/орихалк, первая шахта по трём мирам, книга квестов, экономика', est: '1-2 вечера' },
  { n: 2, title: 'Ранняя техника и первая автоматизация', goal: 'IC2-энергия и машины, первая ME-сеть и автокрафт, руда 1:6, наносет→квант', est: '3-5 вечеров' },
  { n: 3, title: 'Развитие: техника и магия параллельно', goal: 'Таумкрафт, Ботания (Мультитеплица), Кровь T1-T6, измерения, глубокая AE2-автоматизация, молекулярные тиры', est: '1-2 недели' },
  { n: 4, title: 'Эндгейм-сборка', goal: 'Draconic, драконы и души, пчёлы, реликвии/Элементы, панели высоких тиров, нейтроний, звёзды', est: '2-4 недели' },
  { n: 5, title: 'Финал: Дорога к Бесконечному', goal: 'Катализатор и Слиток Бесконечности, творческие предметы, Infinity-сет, THE TRUE END', est: 'финишная прямая' },
]

const A_SUM = { type:'object', additionalProperties:false, properties:{
  stage:{type:'integer'}, wrote:{type:'boolean'}, steps_in:{type:'integer'}, steps_out:{type:'integer'},
  merged:{type:'integer'}, note:{type:'string'}}, required:['stage','wrote','steps_in','steps_out','merged','note'] }
const V_SUM = { type:'object', additionalProperties:false, properties:{
  ok:{type:'boolean'}, issues:{type:'array', items:{type:'object', additionalProperties:false, properties:{
    where:{type:'string'}, what:{type:'string'}, severity:{type:'string'}}, required:['where','what','severity']}},
  verdict:{type:'string'}}, required:['ok','issues','verdict'] }

function aprompt(m) {
  return `Ты — редактор гайда «TechnoMagic RPG» (LoliLand, MC 1.7.10, летний вайп 18.07.2026). Мы перестроили гайд в 5 линейных этапов-квестов. Собери ЭТАП ${m.n} «${m.title}» (цель этапа: ${m.goal}).

Прочитай Read (файл большой — читай кусками offset/limit, НО ПОЛНОСТЬЮ):
research/restage/stage${m.n}.bucket.json — шаги этапа, уже отсортированные по прогрессии (_order). У каждого: все поля шага (title/detail/items/serverNote/coop/opt/kit/skip/trap/trick/tipv/optional), _src (происхождение section#idx), возможно _folded (содержимое шагов-дублей для слияния).

Собери и Write в data/stages/stage${m.n}.json СТРОГО JSON:
{
 "key": "stage${m.n}",
 "title": "Этап ${m.n}. ${m.title}",
 "questGroupGuess": "",
 "confirmed": true,
 "intro": "<3-5 предложений: что игрок проходит на этом этапе, в каком порядке, чем этап заканчивается (критерий готовности к следующему). Пиши как вводную квеста>",
 "estTime": "${m.est}",
 "prereqKeys": ${m.n === 1 ? '[]' : `["stage${m.n - 1}"]`},
 "steps": [ { "title","detail","items",«заметки»,"optional" }, ... ]
}

ПРАВИЛА СБОРКИ:
1. НИЧЕГО не теряй: каждый шаг бакета должен быть представлен (как отдельный шаг или слит с соседним). _folded-содержимое влей в шаг (факты/заметки — в detail/поля). Все заметки (skip/trap/trick/tipv/opt/kit/serverNote/coop) переноси на итоговые шаги.
2. Порядок = _order (поправляй локально только для крафт-зависимостей: шаг не должен требовать результатов более позднего шага).
3. Сливай ЯВНЫЕ дубли и микро-шаги одной постройки (цель: ~${m.n===1?'18-25':m.n===2?'30-40':m.n===5?'22-30':'50-75'} читаемых шагов); при слиянии объединяй items и заметки (одинаковые поля через ' • '). Полнота фактов ВАЖНЕЕ целевого размера — если не влезает без потерь, делай больше шагов.
4. Пиши как ПРОХОЖДЕНИЕ: шаг = конкретное действие с критерием выполнения; в начале этапа можно 1 обзорный шаг-указатель. Внутри detail сохраняй ВСЕ конкретные числа/рецепты/имена.
5. Этап 3-4: контент двух веток (техника/магия) чередуй по реальной прогрессии, а в coop-полях сохраняй разделение ролей. Не группируй «весь мод подряд», если _order говорит о чередовании — но и не дроби бессмысленно: связные блоки по 2-4 шага одной ветки ок.
6. optional сохраняй; побочки/QoL можно сдвигать в конец связного блока, не этапа.
7. Пометки «ВАЙП 18.07.2026» сохраняй.

Проверь JSON: python3 -c "import json;d=json.load(open('data/stages/stage${m.n}.json'));print(len(d['steps']))".
Верни (schema): stage=${m.n}, wrote, steps_in (сколько в бакете), steps_out, merged (сколько слияний), note.`
}

log('Assemble: 5 stages (opus)')
const res = await parallel(STAGE_META.map(m => () =>
  agent(aprompt(m), { label: `asm:stage${m.n}`, phase: 'Assemble', schema: A_SUM, model: 'opus',
                      effort: (m.n === 3 || m.n === 4) ? 'xhigh' : 'high' })
))

const critics = await parallel([
  () => agent(`Ты — критик прогрессии. Прочитай Read все 5 файлов data/stages/stage1.json..stage5.json (кусками, полностью). Проверь:
1. ВНУТРИ этапа: ни один шаг не требует результатов более позднего шага этапа (крафт-зависимости).
2. МЕЖДУ этапами: ни один шаг этапа N не требует контента этапа >N (жёсткие гейты: мана Ботании не раньше своего появления, нейтроний не в этапе 2 и т.п.). Мягкие форвард-ссылки («пригодится позже») — ок.
3. Границы этапов осмысленны, intro соответствует содержимому, статус-кво вех (старт→техника→развитие→эндгейм→финал) читается.
Верни (schema): ok, issues[{where: 'stageN#idx', what, severity: high|med|low}], verdict (2-3 фразы). Только реальные проблемы, без вкусовщины.`,
    { label: 'critic:coherence', phase: 'Verify', schema: V_SUM, model: 'opus', effort: 'xhigh' }),
  () => agent(`Ты — критик потерь. Сверь бакеты research/restage/stage1..5.bucket.json (вход) с собранными data/stages/stage1..5.json (выход) — читай кусками, но полностью.
Для каждого бакет-шага (поле _src) проверь, что его СУТЬ (конкретика: числа, механики, заметки-плашки) присутствует в каком-то шаге соответствующего файла этапа. Также проверь research/restage/drops.json: каждый дроп должен быть «личным прохождением автора» (логи дропов/RNG/дневник), а не системной механикой — иначе флагни.
Верни (schema): ok, issues[{where: '_src или drop', what, severity}], verdict. Игнорируй перефразировки — только реальные потери фактов/заметок и неправомерные дропы.`,
    { label: 'critic:loss', phase: 'Verify', schema: V_SUM, model: 'opus', effort: 'xhigh' }),
])

log(`assembled; critics: coherence ok=${critics[0] && critics[0].ok}, loss ok=${critics[1] && critics[1].ok}`)
return { assemble: res.filter(Boolean), coherence: critics[0], loss: critics[1] }
