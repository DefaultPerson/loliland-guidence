export const meta = {
  name: 'tm-trio-coop',
  description: 'Rewrite all coop fields + stage intros for a 3-player team with asymmetric playtime (А много / Б средне / В мало)',
  phases: [
    { title: 'Rewrite', detail: 'one opus agent per stage: coop fields -> trio model', model: 'opus' },
    { title: 'Check', detail: 'consistency critic', model: 'opus' },
  ],
}

const SUM = { type:'object', additionalProperties:false, properties:{
  stage:{type:'integer'}, wrote:{type:'boolean'}, coop_rewritten:{type:'integer'}, intro_updated:{type:'boolean'},
  note:{type:'string'}}, required:['stage','wrote','coop_rewritten','intro_updated','note'] }
const CHK = { type:'object', additionalProperties:false, properties:{
  ok:{type:'boolean'}, issues:{type:'array', items:{type:'object', additionalProperties:false, properties:{
    where:{type:'string'}, what:{type:'string'}}, required:['where','what']}}, verdict:{type:'string'}},
  required:['ok','issues','verdict'] }

function prompt(n) {
  return `Ты — редактор гайда «TechnoMagic RPG» (LoliLand). Команда игроков изменилась: теперь ТРОЕ с разным онлайном. Перепиши кооп-слой этапа ${n} под эту модель.

Прочитай Read:
1. research/trio_model.md — модель ролей (А «Локомотив» много играет / Б «Маг» средне / В «Пассив и снабжение» мало) и принципы. Держись её.
2. data/sections/stage${n}.json — этап (файл большой — читай кусками, полностью).

ЗАДАЧА — отредактируй data/sections/stage${n}.json:
1. Поле coop КАЖДОГО шага перепиши под троих: кто из А/Б/В что делает в этом шаге. Формат краткий: «А: ... Б: ... В: ...» (упоминай только реально задействованные роли; если шаг сольный/каждый сам — так и пиши, напр. «Каждый сам: квест-зачётный крафт руками»). Сохрани СУТЬ текущего coop (разделение работ, предупреждения), переложив с «вдвоём» на троих. Пустые coop заполняй только там, где разделение реально полезно — иначе оставляй пустым.
2. В intro этапа замени/добавь 1-2 предложения про кооп на троих (какая роль что ведёт на ЭТОМ этапе; на этапе 1-2 В в основном собирает кейсы/экономику и делает свои квесты; пчёлы для В появляются на этапе 4 и т.д.).
3. Правила модели: критический путь не должен ждать В (и по возможности Б); квесты индивидуальны — квест-зачётные ручные крафты каждый делает сам (это уже отражено в trap-плашках — согласуй coop с ними); база/ME общие в реалме А.
4. НИЧЕГО кроме полей coop и intro не меняй (ни title, ни detail, ни другие заметки, ни порядок/количество шагов). optional/индексы не трогай.

Проверь JSON: python3 -c "import json;d=json.load(open('data/sections/stage${n}.json'));print(len(d['steps']))".
Верни (schema): stage=${n}, wrote, coop_rewritten (сколько coop-полей переписал/заполнил), intro_updated, note (1-2 фразы).`
}

log('Trio coop rewrite: 5 stages (opus)')
const res = await parallel([1,2,3,4,5].map(n => () =>
  agent(prompt(n), { label: `trio:stage${n}`, phase: 'Rewrite', schema: SUM, model: 'opus',
                     effort: (n === 3 || n === 4) ? 'xhigh' : 'high' })
))

const chk = await agent(`Ты — контролёр. Прочитай research/trio_model.md и все 5 файлов data/sections/stage1..5.json (кусками, полностью — интересуют только поля intro и coop).
Проверь: 1) в coop/intro не осталось модели «вдвоём/двоих/один ведёт—второй» без адаптации к троим; 2) роли А/Б/В используются согласованно с моделью (А — критический путь/техника, Б — магия, В — пассив/снабжение/кейсы/пчёлы) и не противоречат друг другу между этапами; 3) на В не повешено ничего, что гейтит прогресс. Bash grep -n "вдво|двоих|второй игрок" по файлам ускорит поиск.
Верни (schema): ok, issues[{where:'stageN#idx или stageN.intro', what}], verdict (1-2 фразы).`,
  { label: 'check:trio', phase: 'Check', schema: CHK, model: 'opus', effort: 'high' })

log(`trio rewrite done; check ok=${chk && chk.ok}`)
return { rewrite: res.filter(Boolean), check: chk }
