export const meta = {
  name: 'tm-icon-resolve-2',
  description: 'Second, aggressive pass: resolve the 119 hard items over the FULL texture catalog (incl misc/models/gui)',
  phases: [
    { title: 'Resolve', detail: 'deep search of full catalog (items/blocks/misc/models/gui)' },
    { title: 'Verify', detail: 'adversarial confirmation, correct or reject' },
  ],
}

let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch (e) { A = {} } }
if (!A || typeof A !== 'object') A = {}
const TOTAL = A.total || 119
const BATCH = A.batch || 12

const RESOLVE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: { results: { type: 'array', items: { type: 'object', additionalProperties: false,
    properties: { item: { type: 'string' }, texture_id: { type: ['string', 'null'] }, confidence: { type: 'number' }, reason: { type: 'string' } },
    required: ['item', 'texture_id', 'confidence', 'reason'] } } },
  required: ['results'],
}
const VERIFY_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: { verdicts: { type: 'array', items: { type: 'object', additionalProperties: false,
    properties: { item: { type: 'string' }, texture_id: { type: ['string', 'null'] }, keep: { type: 'boolean' }, confidence: { type: 'number' }, reason: { type: 'string' } },
    required: ['item', 'texture_id', 'keep', 'confidence', 'reason'] } } },
  required: ['verdicts'],
}

const MOD_HINTS = `section -> likely mod(s):
 start/tinkers -> tinker, loli_utility, minecraft, appliedenergistics2 (kit items)
 processing -> ic2, thermalexpansion, thermalfoundation, minefactoryreloaded, lolienergistics
 thaumcraft -> thaumcraft (try misc/, models/, items/ subfolders!), taintedmagic, forbidden, ttinkerer
 botania -> botania, alfheim, botany; many blocks under blocks/ with numeric suffixes
 dimensions/dragons/draconic -> lolidimensions, loli_dragon_might, draconicevolution
 bloodmagic -> alchemicalwizardry, bloodarsenal, lolimagically
 ae2/energistics -> appliedenergistics2, lolienergistics, loli_technologies
 bees -> forestry, gendustry, extrabees, magicbees, genetics, binniecore
 relics_elements -> energyrelics, loli_elements_tm, lolienergistics
 avaritia -> avaritia`

function resolvePrompt(start, end) {
  return `SECOND PASS. These Russian item names from "TechnoMagic RPG" (Minecraft 1.7.10) were NOT resolved by a precise first pass. Search HARDER over the FULL texture catalog (which now also includes misc/, models/block/, gui/, armor/ subfolders), but stay honest: a wrong icon is worse than none.

Files (use Bash grep / python3 / Read):
- meta/wf_input2.json : items array. Load YOUR slice (indices ${start}..${end - 1}):
    python3 -c 'import json;d=json.load(open("meta/wf_input2.json"));[print(json.dumps(x,ensure_ascii=False)) for x in d[${start}:${end}]]'
- meta/tex_catalog_full.txt : EVERY texture. Line = \`<id> | <mod> | <base> | <path>\`. <id> = \`mod::path\`. Includes items/, blocks/, misc/, models/block/, gui/, armor/.
- meta/lang_bridge.txt : \`<RU> | <EN> | <registry_base>\`.
- data/lang/*.lang : raw per-mod lang.

${MOD_HINTS}

For EACH item, find the SINGLE best texture <id> that depicts it:
1. Translate: \`grep -iF "<ru word>" meta/lang_bridge.txt\` -> EN + registry_base.
2. Search broadly: \`grep -iE "<base|keyword>" meta/tex_catalog_full.txt\`. Try synonyms and the EN word. Disambiguate MOD via sections.
3. Preference order for which texture to pick: items/ icon > a clean blocks/ face (for a machine/block) > misc/ or models/block/ texture that clearly depicts it > a gui/ sprite ONLY if it is unmistakably the item's icon. Avoid generic gui panels.
4. For a multi-face block, pick the most identifying single face (a *_front or the main face, or *_top); the iso renderer will handle 3D.
5. HONESTY: many of these legitimately have NO flat texture (Tinkers tools are composited; some Thaumcraft items are .obj models; abstract concepts like 'Личное измерение', 'Монеты', 'Награды', 'Броня из кита', bee-type fragments like 'Алмазная'/'Изумрудная' have no icon). Return texture_id=null for those rather than forcing a match.
6. Copy texture_id EXACTLY as column 1 of the catalog. Never invent one.

Return a result for every item in your slice.`
}

function verifyPrompt(props) {
  return `Adversarial verifier (second pass) for RU-item -> texture mappings, Minecraft "TechnoMagic RPG". Default to skepticism; a wrong icon shipping is the worst outcome.

Files: meta/tex_catalog_full.txt (\`<id> | <mod> | <base> | <path>\`), meta/lang_bridge.txt (\`<RU> | <EN> | <registry_base>\`), data/lang/*.lang.

For each proposal:
1. Confirm id exists verbatim: \`grep -F "<id> |" meta/tex_catalog_full.txt\`.
2. Confirm meaning via lang bridge / registry; reject false friends and generic gui panels that don't actually depict the item.
3. If wrong but a correct texture exists, return it (keep=true). If wrong/none, keep=false + texture_id=null.
4. A gui/ sprite is acceptable ONLY if it unmistakably is the item's inventory icon.

Be strict. Return a verdict for every proposal.

Proposals (JSON):
${JSON.stringify(props)}`
}

const nB = Math.ceil(TOTAL / BATCH)
const batches = []
for (let i = 0; i < nB; i++) batches.push({ start: i * BATCH, end: Math.min(TOTAL, (i + 1) * BATCH) })
log(`Second pass: ${TOTAL} hard items in ${nB} batches of ${BATCH}`)

const out = await pipeline(
  batches,
  b => agent(resolvePrompt(b.start, b.end), { label: `resolve2:${b.start}-${b.end}`, phase: 'Resolve', schema: RESOLVE_SCHEMA, effort: 'high' }),
  (res, b) => {
    const props = (res && res.results || []).filter(r => r && r.texture_id)
    if (!props.length) return { verdicts: [] }
    return agent(verifyPrompt(props.map(p => ({ item: p.item, texture_id: p.texture_id, reason: p.reason }))),
      { label: `verify2:${b.start}-${b.end}`, phase: 'Verify', schema: VERIFY_SCHEMA, effort: 'high' })
  }
)

const mapping = {}, rejected = []
for (const v of out) {
  if (!v) continue
  for (const d of (v.verdicts || [])) {
    if (d.keep && d.texture_id) mapping[d.item] = { id: d.texture_id, conf: d.confidence, reason: d.reason }
    else rejected.push({ item: d.item, reason: d.reason })
  }
}
log(`pass2 kept ${Object.keys(mapping).length}; rejected/null ${rejected.length}`)
return { mapping, rejected }
