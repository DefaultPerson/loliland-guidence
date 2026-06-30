export const meta = {
  name: 'tm-icon-resolve',
  description: 'Resolve Russian TechnoMagic RPG item names to in-game textures (verify + match), adversarially verified',
  phases: [
    { title: 'Resolve', detail: 'grep catalog+lang bridge, pick best texture id per item (or null)' },
    { title: 'Verify', detail: 'adversarial independent confirmation, correct or reject each mapping' },
  ],
}

let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch (e) { A = {} } }
if (!A || typeof A !== 'object') A = {}
const TOTAL = A.total || 395        // distinct unresolved guide items in meta/wf_input.json
const BATCH = A.batch || 14

const RESOLVE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          item: { type: 'string' },
          texture_id: { type: ['string', 'null'], description: 'exact id copied from meta/tex_catalog.txt col 1, or null' },
          confidence: { type: 'number' },
          reason: { type: 'string' },
        },
        required: ['item', 'texture_id', 'confidence', 'reason'],
      },
    },
  },
  required: ['results'],
}

const VERIFY_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          item: { type: 'string' },
          texture_id: { type: ['string', 'null'], description: 'final id (may correct the proposal), or null to reject' },
          keep: { type: 'boolean' },
          confidence: { type: 'number' },
          reason: { type: 'string' },
        },
        required: ['item', 'texture_id', 'keep', 'confidence', 'reason'],
      },
    },
  },
  required: ['verdicts'],
}

const MOD_HINTS = `section -> likely mod(s):
 start/tinkers -> tinker (Tinkers Construct: molds=pattern, hammer, part builder, stencil table); loli_utility; minecraft
 processing -> ic2, thermalexpansion, thermalfoundation, minefactoryreloaded, redpower
 thaumcraft -> thaumcraft, taintedmagic, forbidden, ttinkerer (some TC items have no flat texture -> null is OK)
 botania -> botania, alfheim, botany, extratrees
 dimensions/dragons/draconic -> lolidimensions, loli_dragon_might, draconicevolution
 bloodmagic -> alchemicalwizardry, bloodarsenal, lolimagically
 ae2/energistics -> appliedenergistics2, lolienergistics, loli_technologies
 bees -> forestry, gendustry, extrabees, magicbees, genetics, binniecore
 relics_elements -> energyrelics, loli_elements_tm, lolienergistics
 avaritia -> avaritia`

function resolvePrompt(start, end) {
  return `You map Russian item names from the Minecraft 1.7.10 modpack "TechnoMagic RPG (LoliLand)" to the EXACT in-game texture file that visually depicts each item. Output feeds an automated icon extractor, so ids must be verbatim.

Files in the current working directory (use Bash \`grep\`, \`python3\`, Read — do NOT guess from memory):
- meta/wf_input.json : array of items. Load YOUR slice (indices ${start}..${end - 1}):
    python3 -c 'import json;d=json.load(open("meta/wf_input.json"));[print(json.dumps(x,ensure_ascii=False)) for x in d[${start}:${end}]]'
  Each: {item: RU name, freq, sections: [hints], det: deterministic-guess id or null}.
- meta/tex_catalog.txt : every available texture. Line = \`<id> | <kind> | <mod> | <base> | <jar>\`. <id> is \`mod::path\`; <kind> is items|blocks.
- meta/lang_bridge.txt : translation bridge. Line = \`<RU name> | <EN name> | <registry_base>\`.
- data/lang/*ru_RU.lang , *en_US.lang : raw per-mod lang for deeper lookups.

${MOD_HINTS}

For EACH item in your slice, find the SINGLE best texture <id>:
1. Translate: \`grep -iF "<distinctive ru word>" meta/lang_bridge.txt\` -> get EN name + registry_base (the strongest key).
2. Find: \`grep -iE "<registry_base|en keyword>" meta/tex_catalog.txt\`. The texture <base> usually equals or starts with the registry_base. Disambiguate the MOD using the item's sections.
3. If a \`det\` guess exists, VERIFY it: grep its registry meaning in the bridge and confirm it matches the item. Replace it if wrong.
4. Prefer kind=items. Use kind=blocks only for machines/blocks/decoration that have no item texture.
5. HONESTY BAR: a wrong icon is worse than none. If you cannot confidently identify the depiction, set texture_id=null. Do not map a generic vanilla concept (plain Печь/Сундук/Верстак) to a random mod texture — but DO map to the correct vanilla minecraft:: texture or the clearly-correct mod machine when sections make it unambiguous.
6. Copy texture_id EXACTLY as column 1 of the catalog line (e.g. \`lolienergistics::niobium_chip\`). Never invent an id.

Return results for every item in your slice (texture_id null when unsure). Be precise; high-freq items matter most but judge all honestly.`
}

function verifyPrompt(proposals) {
  return `You are an adversarial verifier of RU-item -> texture mappings for the Minecraft modpack "TechnoMagic RPG". Your DEFAULT stance is skepticism: reject unless the texture genuinely depicts the item. A wrong icon shipping to users is the worst outcome.

Same files available (grep/python3/Read): meta/tex_catalog.txt (\`<id> | <kind> | <mod> | <base> | <jar>\`), meta/lang_bridge.txt (\`<RU> | <EN> | <registry_base>\`), data/lang/*.lang.

For each proposed mapping below:
1. Confirm the texture_id EXISTS verbatim in meta/tex_catalog.txt (\`grep -F "<id> |" meta/tex_catalog.txt\`). If not present -> reject (keep=false, texture_id=null) unless you find the correct one.
2. Confirm meaning: grep the texture's <base>/mod in the lang bridge and check the RU/EN name matches the item's meaning. Watch for false friends (e.g. an unrelated mod item that merely shares a word).
3. If the proposal is wrong but you can find the CORRECT texture id, return it in texture_id with keep=true. If wrong and no good texture exists, keep=false + texture_id=null.
4. Mod must fit the item's section context.

Be strict: when genuinely uncertain, keep=false. Return a verdict for every proposal.

Proposals (JSON):
${JSON.stringify(proposals)}`
}

const nBatches = Math.ceil(TOTAL / BATCH)
const batches = []
for (let i = 0; i < nBatches; i++) batches.push({ idx: i, start: i * BATCH, end: Math.min(TOTAL, (i + 1) * BATCH) })
log(`Resolving ${TOTAL} items in ${nBatches} batches of ${BATCH}`)

const out = await pipeline(
  batches,
  // Stage 1: resolve
  b => agent(resolvePrompt(b.start, b.end), {
    label: `resolve:${b.start}-${b.end}`, phase: 'Resolve', schema: RESOLVE_SCHEMA, effort: 'high',
  }),
  // Stage 2: verify the non-null proposals from this batch
  (res, b) => {
    const props = (res && res.results || []).filter(r => r && r.texture_id)
    if (!props.length) return { verdicts: [] }
    return agent(verifyPrompt(props.map(p => ({ item: p.item, texture_id: p.texture_id, reason: p.reason }))), {
      label: `verify:${b.start}-${b.end}`, phase: 'Verify', schema: VERIFY_SCHEMA, effort: 'high',
    })
  }
)

// collect final kept mappings + diagnostics
const mapping = {}
const rejected = []
let nullCount = 0
for (const v of out) {
  if (!v) continue
  for (const d of (v.verdicts || [])) {
    if (d.keep && d.texture_id) mapping[d.item] = { id: d.texture_id, conf: d.confidence, reason: d.reason }
    else { rejected.push({ item: d.item, reason: d.reason }); }
  }
}
log(`kept ${Object.keys(mapping).length} mappings; ${rejected.length} rejected/null`)
return { mapping, rejected }
