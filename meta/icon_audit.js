export const meta = {
  name: 'tm-icon-audit',
  description: 'Visual audit of all step-item icons: flag duplicated-frame / garbled / wrong-variant icons',
  phases: [{ title: 'Audit', detail: 'each agent reads one contact sheet and flags bad icons' }],
}

let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch (e) { A = {} } }
const DIR = (A && A.dir) || '.'
const SHEETS = (A && A.sheets) || 13

const FLAG_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    flags: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          idx: { type: 'integer' },
          name: { type: 'string' },
          issue: { type: 'string', enum: ['duplicated', 'garbled', 'wrong', 'ok'] },
          confidence: { type: 'number' },
          note: { type: 'string' },
        },
        required: ['idx', 'name', 'issue', 'confidence', 'note'],
      },
    },
  },
  required: ['flags'],
}

function prompt(si) {
  return `Visual QA of inventory icons for a Russian Minecraft 1.7.10 modpack guide ("TechnoMagic RPG"). Each icon should be ONE clean item/block inventory sprite.

Use the Read tool to VIEW this contact sheet image:
  ${DIR}/sheet_${String(si).padStart(2, '0')}.png
Each cell shows an icon, its index "#N", and the item's Russian name. The manifest (index -> name) for this sheet:
  python3 -c 'import json;m=json.load(open("${DIR}/manifest.json"));print(json.dumps(m["${si}"],ensure_ascii=False))'

Inspect EVERY cell. Flag a cell ONLY if it clearly has one of these problems:
- "duplicated": the cell shows the SAME thing repeated/tiled (2-3 stacked copies, an animation strip with several frames, a 2x2 grid of the same sprite) instead of one icon.
- "garbled": UV-unwrap atlas (scattered disconnected faces), random-noise texture, an obvious GUI panel fragment, or unreadable mush — not a recognizable item.
- "wrong": the picture clearly contradicts the item's name/category. Be strict but only when OBVIOUS, e.g. a fluid/liquid or a wire-line shown for a "пыль"(dust)/"слиток"(ingot); an armor piece for a clearly-non-armor item; a plain different object. Do NOT flag merely because you don't know the exact modded item — judge by broad category (dust=loose powder pile, ingot=bar, nugget=small bar, block=cube, ore=speckled cube, sliток/ingot=bar, gem/crystal=faceted, tool=tool shape, machine=device/cube).

Isometric cubes (3D blocks) are INTENTIONAL and correct — never flag those as wrong/duplicated.
Return a flag entry for every PROBLEM cell (issue != "ok"); you may omit clean cells. Default to NOT flagging when unsure (confidence < 0.6 => leave it). Give the exact idx and name and a short note.`
}

const sheets = []
for (let i = 0; i < SHEETS; i++) sheets.push(i)
log(`Auditing ${SHEETS} contact sheets`)

const out = await parallel(sheets.map(si => () =>
  agent(prompt(si), { label: `audit:sheet${si}`, phase: 'Audit', schema: FLAG_SCHEMA, effort: 'high' })
))

const flags = []
for (const r of out) {
  if (!r) continue
  for (const f of (r.flags || [])) {
    if (f.issue && f.issue !== 'ok' && f.confidence >= 0.6) flags.push(f)
  }
}
flags.sort((a, b) => a.idx - b.idx)
log(`flagged ${flags.length} icons`)
return { flags }
