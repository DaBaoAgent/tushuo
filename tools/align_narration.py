"""Source-preserving subtitles for project-local GPT-SoVITS narration.

Each short TTS chunk is checked separately so a dropped sentence cannot hide
inside a good overall ASR score. Reuses the alannew alignment implementation.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parent.parent
GENERATOR = ROOT / "tools" / "generate-film-narration.py"
spec = importlib.util.spec_from_file_location("alannew_narration", GENERATOR)
pipeline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pipeline)

_ap = argparse.ArgumentParser(description="逐段 ASR 对时，生成 captions.json")
_ap.add_argument("--slug", default="chibi-full", help="content/output 下的战役目录名")
_ap.add_argument("--proper-nouns",
                 default="赤壁 周瑜 曹操 黄盖 乌林 江表传 东南风 火船 走舸",
                 help="Whisper 识别提示用的专名表；默认保留赤壁口径，官渡等战役按片覆盖")
_args = _ap.parse_args()

audio = ROOT / "output" / _args.slug / "narration.mp3"
ffmpeg = ROOT / "vendor" / "gpt-sovits" / "runtime" / "ffmpeg.exe"
model_path = ROOT / "vendor" / "faster-whisper-small"
metadata = json.loads(audio.with_suffix(".json").read_text(encoding="utf-8"))
chunks = metadata.get("chunks")
if not chunks:
    raise SystemExit("配音不是分段版，不能通过逐段漏句校验")

model = WhisperModel(str(model_path), device="cpu", compute_type="int8", cpu_threads=4)
all_lines = []
all_quality = []
for chunk in chunks:
    text = chunk["text"]
    samples = pipeline.decode_mono16k(str(ffmpeg), Path(chunk["file"]))
    outcome = None
    for attempt, prompt in enumerate(pipeline.align_prompts(
            text, _args.proper_nouns)):
        segments, _ = model.transcribe(samples, language="zh", beam_size=5,
                                       word_timestamps=True, vad_filter=False,
                                       initial_prompt=prompt)
        words = [{"word": w.word, "start": w.start, "end": w.end}
                 for segment in segments for w in (segment.words or [])]
        try:
            lines, quality = pipeline.align_source(text, words, chunk["duration"], [])
            outcome = lines, quality
            break
        except RuntimeError as error:
            print(f"第 {chunk['index']} 段对时第 {attempt+1} 次：{error}", flush=True)
    if outcome is None:
        raise SystemExit(f"第 {chunk['index']} 段字幕未通过，已停在该段")
    lines, quality = outcome
    for line in lines:
        line["t"] = round(line["t"] + chunk["start"], 3)
        line["end"] = round(line["end"] + chunk["start"], 3)
        all_lines.append(line)
    all_quality.append({"chunk": chunk["index"], **quality})
    print(f"第 {chunk['index']} 段匹配 {quality['sourceMatch']:.1%}，最长未匹配 {quality['longestUnmatched']} 字", flush=True)

source = pipeline.clean((ROOT / "content" / _args.slug / "口播稿.txt").read_text(encoding="utf-8"))
if ''.join(line['text'] for line in all_lines) != source:
    raise SystemExit('分段字幕拼接与原稿不一致')
dest = audio.parent / "captions.json"
dest.write_text(json.dumps({"duration": metadata["duration"], "quality": all_quality,
                            "lines": all_lines}, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"字幕 {len(all_lines)} 行 / {dest}", flush=True)
