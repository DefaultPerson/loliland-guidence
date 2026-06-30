export const meta = {
  name: 'tm-icon-resolve-3',
  description: 'Third exhaustive pass over the 108 still-unmapped items: try many name variants, prefer CLEAN flat textures',
  phases: [
    { title: 'Resolve', detail: 'exhaustive variant search; prefer items/blocks/tile/misc, reject UV models' },
    { title: 'Verify', detail: 'adversarial confirmation + clean-folder check' },
  ],
}

let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch (e) { A = {} } }
if (!A || typeof A !== 'object') A = {}
const TOTAL = A.total || 108
const BATCH = A.batch || 9

const RSCHEMA = {
  type: 'object', additionalProperties: false,
  properties: { results: { type: 'array', items: { type: 'object', additionalProperties: false,
    properties: { item: { type: 'string' }, texture_id: { type: ['string', 'null'] }, confidence: { type: 'number' }, reason: { type: 'string' } },
    required: ['item', 'texture_id', 'confidence', 'reason'] } } }, required: ['results'],
}
const VSCHEMA = {
  type: 'object', additionalProperties: false,
  properties: { verdicts: { type: 'array', items: { type: 'object', additionalProperties: false,
    properties: { item: { type: 'string' }, texture_id: { type: ['string', 'null'] }, keep: { type: 'boolean' }, confidence: { type: 'number' }, reason: { type: 'string' } },
    required: ['item', 'texture_id', 'keep', 'confidence', 'reason'] } } }, required: ['verdicts'],
}

const HINTS = `mods by section: start/tinkers->tinker,loli_utility,minecraft,appliedenergistics2,ic2 | processing->ic2,thermalexpansion,minefactoryreloaded,lolienergistics | thaumcraft->thaumcraft,taintedmagic,forbidden,ttinkerer | botania->botania,alfheim,botany,lolimagically | dimensions/dragons/draconic->lolidimensions,loli_dragon_might,draconicevolution | bloodmagic->alchemicalwizardry,bloodarsenal,lolimagically | ae2/energistics->appliedenergistics2,lolienergistics,loli_technologies | bees->forestry,gendustry,extrabees,magicbees,genetics,binniecore,magicbees | relics_elements->energyrelics,loli_elements_tm,lolienergistics | avaritia->avaritia | mekanism->ic2,lolienergistics`

function rprompt(s, e) {
  return `THIRD, EXHAUSTIVE pass. These Russian item names from "TechnoMagic RPG" (MC 1.7.10) are still unmatched. The user is confident most DO have a texture in the files — the earlier passes likely missed them due to NAME differences. Try hard with many variants. But honesty still rules: a wrong/garbled icon is worse than none.

Files (Bash grep / python3 / Read):
- meta/wf_input3.json : items. Load YOUR slice ${s}..${e - 1}:
    python3 -c 'import json;d=json.load(open("meta/wf_input3.json"));[print(json.dumps(x,ensure_ascii=False)) for x in d[${s}:${e}]]'
- meta/tex_catalog_full.txt : every texture. Line = \`<id> | <mod> | <base> | <path>\`. id=\`mod::path\`.
- meta/lang_bridge.txt : \`<RU> | <EN> | <registry_base>\`.
- data/lang/*.lang : raw per-mod lang.

${HINTS}

METHOD — be exhaustive, try MANY variants per item:
1. Bridge lookup with several RU substrings (full name, each significant word, without tier/parenthetical). \`grep -iF "<word>" meta/lang_bridge.txt\` -> collect EN names + registry bases.
2. Also translate yourself (you know RU<->EN modded terms) and grep the EN term AND likely registry spellings (camelCase, snake_case, with/without Block/Item/tile prefixes, singular/plural, tier numbers 0/1/2).
3. \`grep -iE "<variant1|variant2|...>" meta/tex_catalog_full.txt\`. Cast a wide net, then choose.
4. FOLDER PREFERENCE (critical for a clean chip):
   - PREFER: items/ , blocks/ , tile/ , misc/  (these are real flat inventory sprites / block faces).
   - AVOID: models/ , model/ , entity/ , gui/  — those are 3D UV-unwrap atlases, entity skins or GUI panels that render as GARBLED scattered junk, NOT icons. Only use one if there is literally nothing cleaner AND it is plainly a clean square sprite.
5. Disambiguate mod via sections. Prefer the base/non-emissive/non-active variant.
6. Many items legitimately have NO flat texture: Tinkers tools (composited), some Thaumcraft items rendered as .obj models (thaumometer, research table, alembic, arcane worktable, node monitor), procedural Avaritia/loli singularities (one shared faint particle strip), and pure abstractions ('Личное измерение','Монеты','Награды','Еда/Броня из кита','Книга квестов', bee-SPECIES names like 'Алмазная'/'Изумрудная'/'Цианитовая'/'Блутониевая'). For these return texture_id=null.

Copy texture_id EXACTLY from catalog col 1. Return a result for every item in your slice.`
}

function vprompt(props) {
  return `Adversarial verifier (3rd pass) for RU-item -> texture mappings, "TechnoMagic RPG". Skeptic by default.
Files: meta/tex_catalog_full.txt (\`<id> | <mod> | <base> | <path>\`), meta/lang_bridge.txt, data/lang/*.lang.
For each proposal:
1. id exists verbatim: \`grep -F "<id> |" meta/tex_catalog_full.txt\`.
2. The path must be in items/ , blocks/ , tile/ or misc/ (a clean sprite). If it is in models/ , model/ , entity/ or gui/ -> REJECT (keep=false, texture_id=null) UNLESS it is unmistakably a clean single square inventory sprite (rare).
3. Meaning matches the item (via bridge/registry); reject false friends.
4. If wrong but a correct CLEAN texture exists, return it (keep=true). Else keep=false + null.
Return a verdict per proposal.
Proposals: ${JSON.stringify(props)}`
}

const nB = Math.ceil(TOTAL / BATCH)
const batches = []
for (let i = 0; i < nB; i++) batches.push({ s: i * BATCH, e: Math.min(TOTAL, (i + 1) * BATCH) })
log(`Third pass: ${TOTAL} items in ${nB} batches`)

const out = await pipeline(
  batches,
  b => agent(rprompt(b.s, b.e), { label: `r3:${b.s}-${b.e}`, phase: 'Resolve', schema: RSCHEMA, effort: 'high' }),
  (res, b) => {
    const props = (res && res.results || []).filter(r => r && r.texture_id)
    if (!props.length) return { verdicts: [] }
    return agent(vprompt(props.map(p => ({ item: p.item, texture_id: p.texture_id, reason: p.reason }))),
      { label: `v3:${b.s}-${b.e}`, phase: 'Verify', schema: VSCHEMA, effort: 'high' })
  }
)
const mapping = {}, rejected = []
for (const v of out) { if (!v) continue; for (const d of (v.verdicts || [])) {
  if (d.keep && d.texture_id) mapping[d.item] = { id: d.texture_id, conf: d.confidence, reason: d.reason }
  else rejected.push({ item: d.item, reason: d.reason }) } }
log(`pass3 kept ${Object.keys(mapping).length}; rejected/null ${rejected.length}`)
return { mapping, rejected }
