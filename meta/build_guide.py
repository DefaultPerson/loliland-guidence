#!/usr/bin/env python3
"""Собирает guide.js из результата воркфлоу (data/workflow_result.json)."""
import json, sys, os

PROJ = "/home/def/projects/misc/loliland-guidence"
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(PROJ, "data", "workflow_result.json")
res = json.load(open(src, encoding="utf-8"))

sections = res.get("sections", [])
order_obj = res.get("order", {}) or {}
order = order_obj.get("order") or [s["key"] for s in sections]
milestones = order_obj.get("milestones", [])
critique = res.get("critique", {}) or {}

# Влить предложенные критиком доп.шаги как optional
extra = {}
for it in critique.get("suggestedExtraSteps", []) or []:
    extra.setdefault(it.get("sectionKey", ""), []).append(it.get("step", ""))
for s in sections:
    for txt in extra.get(s["key"], []):
        if txt and txt.strip():
            s.setdefault("steps", []).append({
                "title": txt, "detail": "(добавлено для полноты — проверь в игре)",
                "items": [], "serverNote": "", "coop": "", "optional": True})

# --- курированная модель волн/треков/параллельности (prereqKeys агентов шумные, не используем) ---
# ae2 -> волна 2 (общий фундамент: hard-prereq для thaumcraft/bloodmagic/dimensions, в видео с ~10%);
# bees -> волна 4 (hard-prereq draconic: Драконье слияние для машин Gendustry + ~600 квантовых стёкол)
PHASE = {"start": 1, "tinkers": 2, "processing": 2, "ae2": 2, "thaumcraft": 3, "botania": 3,
         "bloodmagic": 3, "bees": 4, "mekanism": 3, "energistics": 3, "dimensions": 3,
         "draconic": 4, "dragons": 4, "relics_elements": 4, "avaritia": 5}
TRACK = {"start": "base", "tinkers": "tech", "processing": "tech", "ae2": "tech", "mekanism": "tech",
         "energistics": "tech", "thaumcraft": "magic", "botania": "magic", "bloodmagic": "magic",
         "bees": "magic", "dimensions": "explore", "draconic": "endgame", "dragons": "endgame",
         "relics_elements": "endgame", "avaritia": "endgame"}
for s in sections:
    ph = PHASE.get(s["key"], 3)
    s["phase"] = ph
    s["track"] = TRACK.get(s["key"], "tech")
    s["parallel"] = ph in (2, 3, 4)

itemIcons = {}
if os.path.exists(os.path.join(PROJ, "data", "guide_icons.json")):
    itemIcons = json.load(open(os.path.join(PROJ, "data", "guide_icons.json"), encoding="utf-8"))

GUIDE = {
    "itemIcons": itemIcons,
    "meta": {
        "title": "TechnoMagic RPG",
        "version": "18072026",
        "generatedNote": "Гайд собран из извлечённых ресурсов клиента, ресёрча и 16-часового видео-прохождения ПРЕДЫДУЩЕГО вайпа. "
                         "Точное дерево квестов хранится на сервере — сверяйся с квест-буком в игре.",
        "wipeBanner": "18.07.2026 — три новых измерения вместо верхнего мира (руды разложены по измерениям), RF-энергия удалена (всё на EU), "
                      "новые машины индустрии, орихалковые инструменты, монеты не перенесены. Гайд написан по прошлому вайпу — ядро прогрессии то же, "
                      "но раннюю игру и все числа энергии сверяй в игре. Детали — в панели «Сервер» на карте.",
    },
    "serverMeta": res.get("serverMeta", {}),
    "order": order,
    "milestones": milestones,
    "sections": sections,
}

out = os.path.join(PROJ, "guide.js")
with open(out, "w", encoding="utf-8") as f:
    f.write("/* Авто-сгенерировано build_guide.py — не редактируй вручную. */\n")
    f.write("window.GUIDE = ")
    json.dump(GUIDE, f, ensure_ascii=False, indent=1)
    f.write(";\n")

n_steps = sum(len(s.get("steps", [])) for s in sections)
print(f"guide.js: {len(sections)} разделов, {n_steps} шагов, {len(milestones)} вех")
if critique.get("gaps"):
    print("\nПРОБЕЛЫ (критик):")
    for g in critique["gaps"]:
        print("  -", g)
if critique.get("serverSpecificsToVerify"):
    print("\nПРОВЕРИТЬ В ИГРЕ:")
    for g in critique["serverSpecificsToVerify"]:
        print("  -", g)
