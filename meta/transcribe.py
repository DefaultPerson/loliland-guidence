#!/usr/bin/env python3
"""ASR недостающих серий (нет субтитров на YT) через faster-whisper, затем пересборка корпуса."""
import os, glob, json, re
from faster_whisper import WhisperModel

BASE = "/home/def/projects/misc/loliland-guidence"
AUD = f"{BASE}/research/youtube/audio"
TXT = f"{BASE}/research/youtube/txt"
SRC = f"{BASE}/research/youtube"

FILES = {
    "45": ("BaLSvKG7Sr8", "LEGENDARY DRAGON HEART [+ CUSTOM BOSS] - TechnoMagic #45 • LoliLand Minecraft"),
    "46": ("_0Yhv52O-EA", "BEE FACTORY [+DEMONIC DRAGON] — TechnoMagic #46 • LoliLand Minecraft"),
}

print("loading model small/int8 ...", flush=True)
model = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=8)

for idx, (vid, title) in FILES.items():
    mp3 = f"{AUD}/{idx}.mp3"
    if not os.path.exists(mp3):
        print("skip (no audio):", idx); continue
    print(f"transcribing {idx} ...", flush=True)
    segments, info = model.transcribe(mp3, language="ru", vad_filter=True, beam_size=1)
    parts = [s.text.strip() for s in segments]
    text = re.sub(r"\s+", " ", " ".join(parts)).strip()
    open(f"{TXT}/{idx}.txt", "w", encoding="utf-8").write(
        f"# {idx} {title} [ASR faster-whisper small]\n# https://youtu.be/{vid}\n\n{text}\n")
    print(f"  {idx}: {len(text.split())} слов", flush=True)

# rebuild corpus + index from ALL txt/*.txt (vtt-derived + ASR)
corpus, index = [], []
for fn in sorted(glob.glob(f"{TXT}/*.txt")):
    idx = os.path.basename(fn)[:2]
    raw = open(fn, encoding="utf-8").read().splitlines()
    head = [l for l in raw[:2]]
    body = "\n".join(raw[2:]).strip()
    title = head[0][2:].strip() if head else idx
    url = head[1].replace("# ", "").strip() if len(head) > 1 else ""
    asr = "[ASR" in title
    index.append({"idx": idx, "title": title, "url": url, "words": len(body.split()), "asr": asr})
    corpus.append(f"\n\n===== СЕРИЯ {idx}: {title} ({url}) =====\n{body}")

open(f"{SRC}/ALL_subtitles.txt", "w", encoding="utf-8").write("".join(corpus))
json.dump(index, open(f"{SRC}/index.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"\nкорпус пересобран: {len(index)} серий, {sum(x['words'] for x in index)} слов")
print("ASR-серии:", [x['idx'] for x in index if x['asr']])
