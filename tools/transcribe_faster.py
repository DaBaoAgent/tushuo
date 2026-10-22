"""用本机 faster-whisper 生成 HyperFrames 兼容的词级转写。

`npx hyperframes transcribe` 依赖 whisper.cpp 运行时；本机没装，改用项目内
vendor/gpt-sovits/.venv 的 faster-whisper + vendor/faster-whisper-small 模型，
输出与 HyperFrames transcript.json 相同的扁平结构：

    [{"id":"w0","text":"建安","start":0.0,"end":0.32}, ...]

然后交给 tools/hf_audio_meta.py 写 audio_meta.json。
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
FFMPEG = ROOT / "vendor" / "gpt-sovits" / "runtime" / "ffmpeg.exe"
LOCAL_MODELS = {"small": ROOT / "vendor" / "faster-whisper-small"}


def decode_pcm16k(path: Path):
    """用 ffmpeg 解成 16k 单声道 float32，绕开本机 PyAV 版本不兼容。"""
    import numpy as np

    proc = subprocess.run(
        [str(FFMPEG), "-hide_banner", "-loglevel", "error", "-i", str(path),
         "-f", "f32le", "-ac", "1", "-ar", "16000", "pipe:1"],
        capture_output=True,
    )
    if proc.returncode != 0:
        raise SystemExit("ffmpeg 解码失败：" + proc.stderr.decode("utf-8", "replace")[:400])
    return np.frombuffer(proc.stdout, dtype=np.float32)


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

    parser = argparse.ArgumentParser(description="faster-whisper 词级转写")
    parser.add_argument("--audio", "-a", type=Path, required=True)
    parser.add_argument("--out", "-o", type=Path, help="默认 <audio>.transcript.json")
    parser.add_argument("--model", default="small", help="faster-whisper 模型，默认 small")
    parser.add_argument("--language", default="zh", help="语言代码，默认 zh")
    parser.add_argument("--initial-prompt", default="", help="给模型的历史专名提示")
    args = parser.parse_args()

    audio = args.audio.resolve()
    if not audio.exists():
        raise SystemExit(f"音频不存在：{audio}")
    out = args.out or audio.with_suffix(audio.suffix + ".transcript.json")

    from faster_whisper import WhisperModel

    model_arg = LOCAL_MODELS.get(args.model, args.model)
    if isinstance(model_arg, Path):
        model_arg = str(model_arg)
    model = WhisperModel(
        model_arg, device="cpu", compute_type="int8",
        cpu_threads=min(8, os.cpu_count() or 4),
    )
    segments, info = model.transcribe(
        decode_pcm16k(audio), language=args.language, beam_size=5,
        word_timestamps=True, vad_filter=False, condition_on_previous_text=False,
        initial_prompt=args.initial_prompt or None,
    )

    words: list[dict] = []
    duration = 0.0
    for segment in segments:
        duration = max(duration, float(segment.end or 0))
        segment_words = list(segment.words or [])
        if segment_words:
            for word in segment_words:
                text = (word.word or "").strip()
                if not text:
                    continue
                words.append({
                    "id": f"w{len(words)}",
                    "text": text,
                    "start": round(float(word.start), 3),
                    "end": round(float(word.end), 3),
                })
        else:
            text = (segment.text or "").strip()
            if text:
                words.append({
                    "id": f"w{len(words)}",
                    "text": text,
                    "start": round(float(segment.start), 3),
                    "end": round(float(segment.end), 3),
                })
    if not words:
        raise SystemExit("转写没有产出任何词；检查音频是否有声音")

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(words, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"写入 {out}：{len(words)} 个词，音频 {duration:.2f} 秒，模型 {args.model}/{args.language}")


if __name__ == "__main__":
    main()
