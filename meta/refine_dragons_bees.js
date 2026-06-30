export const meta = {
  name: 'tmrpg-refine-dragons-bees',
  description: 'Targeted re-refine of dragons + bees sections using the newly ASR-transcribed episodes 45 (Dragon Heart) and 46 (Bee Factory)',
  phases: [{ title: 'Refine' }],
}

const DATA = '/home/def/projects/misc/loliland-guidence/data'
const YT = '/home/def/projects/misc/loliland-guidence/research/youtube/txt'

const STEP = {
  type: 'object', additionalProperties: false,
  properties: {
    title: { type: 'string' }, detail: { type: 'string' },
    items: { type: 'array', items: { type: 'string' } },
    serverNote: { type: 'string' }, coop: { type: 'string' }, optional: { type: 'boolean' },
  },
  required: ['title', 'detail', 'items', 'serverNote', 'coop', 'optional'],
}
const SECTION_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: { section: {
    type: 'object', additionalProperties: false,
    properties: {
      key: { type: 'string' }, title: { type: 'string' },
      questGroupGuess: { type: 'string' }, confirmed: { type: 'boolean' },
      intro: { type: 'string' }, estTime: { type: 'string' },
      prereqKeys: { type: 'array', items: { type: 'string' } },
      steps: { type: 'array', items: STEP, minItems: 6 },
    },
    required: ['key','title','questGroupGuess','confirmed','intro','estTime','prereqKeys','steps'],
  } },
  required: ['section'],
}

const COMMON = `Ты дорабатываешь раздел гайда прохождения LoliLand "TechnoMagic RPG" (MC 1.7.10, сервер, кооп на двоих).
Дан УЖЕ хороший текущий раздел (v2) — Read ${DATA}/sections/<key>.json — улучши его, ВЛИВ тактику из новых транскриптов.
ВАЖНО про источники-транскрипты 45/46: это ASR-распознавание (faster-whisper), в нём ошибки и перевранный жаргон (напр. "пырика"=вещь, "демоджа"=damage, "энергония"=энергоний, "нейтрон"≈нейтроний). Извлекай СМЫСЛ и последовательность действий, а кривые/неуверенные названия предметов сверяй с ${DATA}/names.txt и НЕ тащи дословно. Реальные имена бери из names.txt и strings/.
Задача: сохрани сильные шаги, добавь недостающую тактику/последовательность из новых видео, уточни порядок. Где рецепт мог сместиться (видео = летний вайп, пак зимний 04012026) — serverNote "летний вайп — проверь в NEI". Русский. Та же schema. Шагов не меньше, чем сейчас.`

phase('Refine')
const JOBS = [
  { key:'dragons', ep:['12','23','35','36','39','45','46'],
    note:'Новое из ASR: серия 45 "Сердце дракона / кастомный босс" (легендарное драконье сердце — много ресурсов, тёмный/красный энергоний, кастомный босс), серия 46 содержит "демонического дракона". Уточни путь: убийство 6 драконов, их души/сердца/осколки, слияние (дюп), Реактор Хаоса, легендарное драконье сердце как пред-эндгейм. Свяжи с draconic и relics.' },
  { key:'bees', ep:['05','33','46'],
    note:'Новое из ASR: серия 46 "Пчелофабрика" (Ядро пчелиной фабрики LoliForestry, промышленное авто-производство ресурсов пчёлами, выход на эндгейм-материалы; в ролике мелькает 2 млрд пыли/нейтроний — т.е. пчёлы кормят финал). Уточни путь от селекции к Совершенной/Промышленной пасеке и Пчелофабрике, что именно она даёт и куда идёт.' },
]
const out = await parallel(JOBS.map((j) => () => {
  const eps = j.ep.map(e => `${YT}/${e}.txt`).join(', ')
  return agent(
    `${COMMON}\n\nРАЗДЕЛ key="${j.key}". Read ${DATA}/sections/${j.key}.json и ${DATA}/names.txt и ${DATA}/strings/${j.key === 'dragons' ? 'LoliDragonMight' : 'LoliForestry'}.txt.\nТранскрипты (вкл. новые ASR 45/46): ${eps}\nЧто влить: ${j.note}\nВерни улучшенный section (та же schema, key="${j.key}").`,
    { label: j.key, phase: 'Refine', schema: SECTION_SCHEMA }
  )
}))
return { sections: out.filter(Boolean).map(r => r.section) }
