#!/usr/bin/env python3
"""VTT (YouTube auto-captions) -> чистый дедуплицированный текст по сериям + общий корпус."""
import os, re, glob, json

SRC = "/home/def/projects/misc/loliland-guidence/research/youtube"
OUT = os.path.join(SRC, "txt")
os.makedirs(OUT, exist_ok=True)

# карта индекс->название из плейлиста
titles = {}
pl = "/home/def/projects/misc/loliland-guidence/meta/youtube_playlist.txt"
if os.path.exists(pl):
    for line in open(pl, encoding="utf-8"):
        m = re.match(r"\s*(\d+)\s*\|\s*([\w-]+)\s*\|\s*(.+)", line)
        if m:
            titles[m.group(1).zfill(2)] = (m.group(2), m.group(3).strip())

def clean_vtt(path):
    raw = open(path, encoding="utf-8", errors="ignore").read().splitlines()
    out = []
    for ln in raw:
        s = ln.strip()
        if not s or s.startswith(("WEBVTT", "Kind:", "Language:")) or "-->" in s or re.match(r"^\d+$", s):
            continue
        s = re.sub(r"<[^>]+>", "", s)            # inline <timestamp>/<c> tags
        s = re.sub(r"&nbsp;", " ", s)
        s = s.strip()
        if s:
            out.append(s)
    ded = []
    for s in out:
        if ded:
            if s == ded[-1]:
                continue
            if s.startswith(ded[-1]) or ded[-1].startswith(s):  # rolling overlap
                if len(s) > len(ded[-1]):
                    ded[-1] = s
                continue
        ded.append(s)
    return " ".join(ded)

corpus = []
index = []
for vtt in sorted(glob.glob(os.path.join(SRC, "*.vtt"))):
    base = os.path.basename(vtt)
    idx = base[:2]
    text = clean_vtt(vtt)
    vid, title = titles.get(idx, ("", base))
    fn = os.path.join(OUT, f"{idx}.txt")
    open(fn, "w", encoding="utf-8").write(f"# {idx} {title}\n# https://youtu.be/{vid}\n\n{text}\n")
    words = len(text.split())
    index.append({"idx": idx, "id": vid, "title": title, "words": words, "file": fn})
    corpus.append(f"\n\n===== СЕРИЯ {idx}: {title} (https://youtu.be/{vid}) =====\n{text}")

open(os.path.join(SRC, "ALL_subtitles.txt"), "w", encoding="utf-8").write("".join(corpus))
json.dump(index, open(os.path.join(SRC, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

print(f"серий обработано: {len(index)}")
print(f"всего слов: {sum(x['words'] for x in index)}")
for x in index:
    print(f"  {x['idx']}  {x['words']:>6} слов  {x['title'][:60]}")
