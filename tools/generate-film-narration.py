"""定稿 -> 每幕配音 -> 本地识别对时 -> 实测幕长。支持断点续跑。
python tools/generate-film-narration.py --pkg packages/chibi-full --only 1
默认云端 SiliconFlow / anna；本地克隆音色用 --provider local --base-url 指向本地服务：
python tools/generate-film-narration.py --pkg packages/chibi-clone --provider local \
  --base-url http://127.0.0.1:9880/v1/audio/speech --voice dabao --label 宝哥克隆 --speed 1.0
密钥只读环境变量或本机 Hermes 密钥文件；不写入战役包或日志。本地 provider 无需密钥。
"""
import argparse
from difflib import SequenceMatcher
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
DEFAULTS = ROOT / "tools/production-defaults.json"
SILICONFLOW_URL = "https://api.siliconflow.cn/v1/audio/speech"
ALIGN_REVISION = "small-int8-silence-v4"
# 幕尾留白:旁白播完到切下一幕的呼吸,控制在半秒内(长停顿已由 pausePolicy 剪掉)
ACT_TAIL = 0.5


def read(p):
    return json.loads(p.read_text(encoding="utf-8"))


def save(p, value):
    temp = p.with_suffix(p.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(p)


def clean(text):
    return re.sub(r"[^\w\u3400-\u9fff]", "", text, flags=re.UNICODE).replace("_", "")


PROPER_NOUNS = "赤壁之战 周瑜 曹操 鲁肃 黄盖 孙权 刘备 长江 乌林 夏口 江陵 襄阳"


def align_prompts(text, nouns=PROPER_NOUNS):
    """字幕对时的识别提示，逐级重试。

    文言引文（如「彼所将中国人，不过十五六万…」）在没有上下文提示时会被
    Whisper 整段听岔，导致「最长未匹配」超阈值。把本幕开头当作条件提示能
    大幅改善，但提示词过长反而会让 Whisper 退化（只吐尾巴），所以前缀只取
    前 60 字，且放在最后一档。专名表随战役走（官渡用 --proper-nouns 覆盖）。
    """
    clipped = clean(text)
    return [nouns, f"{nouns} {clipped[:60]}", clipped[:100]]


def cue_fingerprint(text, config, pause_policy):
    payload = {"text": text, **config, "pausePolicy": pause_policy, "aligner": ALIGN_REVISION}
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def make_speak(readings):
    """配音读数修正：字幕与对时仍用定稿 text，只把送去合成（及纳入指纹）的 spoken 文本改写。
    readings = {"global": [[from,to],...], "acts": {"4": [[from,to],...]}}，如 〇→零、100→一百。
    其中 3D→三低：CosyVoice 把「3D」读成「三-D」时会在 D 内部插入约 0.35 秒静音，
    改成同音字「三低」即读成连贯的 sān-dī（听感仍是「三D」），字幕仍显示定稿的 3D。"""
    g = [tuple(p) for p in (readings or {}).get("global", [])]
    a = {str(k): [tuple(p) for p in v] for k, v in (readings or {}).get("acts", {}).items()}

    def speak(item):
        s = item["text"]
        for src, dst in g + a.get(str(item["scene"]), []):
            s = s.replace(src, dst)
        return s
    return speak


def is_local_url(url):
    return urlparse(url).hostname in {"127.0.0.1", "localhost", "::1"}


def key_from_store():
    key = os.environ.get("SILICONFLOW_API_KEY", "").strip()
    store = Path.home() / "AppData/Local/hermes/.env"
    if not key and store.exists():
        for line in store.read_text(encoding="utf-8-sig").splitlines():
            if line.strip().startswith("SILICONFLOW_API_KEY="):
                key = line.split("=", 1)[1].strip().strip('"').strip("'")
                break
    if not key:
        raise RuntimeError("本机缺少 SILICONFLOW_API_KEY；请配置现有安全存储")
    return key


def probe(ffprobe, p):
    return float(subprocess.check_output(
        [ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
        text=True).strip())


def source_ai_metadata(ffprobe, source):
    result = subprocess.check_output([ffprobe, "-v", "error", "-show_entries", "format_tags",
                                      "-of", "json", str(source)], text=True)
    tags = json.loads(result).get("format", {}).get("tags", {})
    return ["-metadata", f"AIGC={value}"] if (value := next(
        (v for k, v in tags.items() if k.upper() == "AIGC"), None)) else []


def has_ai_metadata(ffprobe, source):
    try:
        result = subprocess.check_output([ffprobe, "-v", "error", "-show_entries", "format_tags=AIGC",
                                          "-of", "json", str(source)], text=True)
        return any(k.upper() == "AIGC" for k in json.loads(result).get("format", {}).get("tags", {}))
    except (OSError, subprocess.CalledProcessError, json.JSONDecodeError):
        return False


def decode_mono16k(ffmpeg, path):
    """用 ffmpeg 解成 16kHz 单声道 float32，交给 faster-whisper 识别。
    绕开 faster-whisper 内置的 PyAV 解码路径——本机 venv 里的 av 版本不接受其
    所需的 metadata_errors 参数，直接喂 PCM 数组即可，识别结果一致。"""
    import numpy as np
    raw = subprocess.check_output([ffmpeg, "-v", "error", "-i", str(path),
        "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"])
    return np.frombuffer(raw, dtype="<f4")


def normalize_pauses(ffmpeg, ffprobe, source, dest, policy):
    import numpy as np
    rate = 24000
    decoded = subprocess.check_output([ffmpeg, "-v", "error", "-i", str(source),
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ac", "1", "-ar", str(rate),
        "-f", "f32le", "pipe:1"])
    samples = np.frombuffer(decoded, dtype="<f4")
    # 只剪内部过长静音的中间，保留两端气口；正常逗号与句号停顿保留。
    window = round(rate * .01)
    frame_count = len(samples) // window
    peak = np.max(np.abs(samples[:frame_count * window].reshape(-1, window)), axis=1)
    silent = peak < 10 ** (policy["thresholdDb"] / 20)
    changes = np.diff(np.concatenate(([False], silent, [False])).astype(np.int8))
    starts, ends = np.flatnonzero(changes == 1), np.flatnonzero(changes == -1)
    cuts, report, intervals = [], [], []
    kept = round(policy["sentencePauseSeconds"] * rate)
    for start, end in zip(starts, ends):
        first, last = int(start * window), int(end * window)
        duration = (last - first) / rate
        if first < rate * .2 or last > len(samples) - rate * .2:
            continue
        if duration > policy["maximumSeconds"]:
            cuts.append((first + kept // 2, last - (kept - kept // 2)))
            report.append({"sourceStart": round(first / rate, 3), "before": round(duration, 3),
                           "after": policy["sentencePauseSeconds"]})
    parts, cursor = [], 0
    for first, last in cuts:
        parts.append(samples[cursor:first]); cursor = last
    parts.append(samples[cursor:])
    removed = 0
    for start, end in zip(starts, ends):
        first, last = int(start * window), int(end * window)
        if first < rate * .2 or last > len(samples) - rate * .2:
            continue
        start_new = first - removed
        cut = next(((a, b) for a, b in cuts if first <= a <= b <= last), None)
        if cut:
            removed += cut[1] - cut[0]
            intervals.append([round(start_new / rate, 3),
                              round((last - removed) / rate, 3)])
        else:
            intervals.append([round(start_new / rate, 3), round((last - removed) / rate, 3)])
    pcm = np.concatenate(parts).astype("<f4").tobytes()
    metadata = source_ai_metadata(ffprobe, source)
    subprocess.run([ffmpeg, "-y", "-v", "error", "-f", "f32le", "-ar", str(rate),
                    "-ac", "1", "-i", "pipe:0", "-b:a", "128k", *metadata, str(dest)],
                    input=pcm, check=True, capture_output=True)
    return report, intervals


def request_audio(text, raw_path, metadata, config, key, proxy, base_url, split=None):
    import requests
    local = is_local_url(base_url)
    fingerprint = hashlib.sha256(json.dumps({"text": text, **config}, ensure_ascii=False,
                                           sort_keys=True).encode()).hexdigest()
    # 请求成功即缓存源音频。识别或编码失败的重跑不会再次调用计费接口。
    if raw_path.exists() and metadata.exists() and read(metadata).get("fingerprint") == fingerprint:
        return fingerprint
    # SiliconFlow 的 voice 形如 <model>:<voice>；本地服务只认音色 id。
    voice = config["voice"] if local else config["model"] + ":" + config["voice"]
    body = {"model": config["model"], "input": re.sub(r"\s*\n+\s*", "", text),
            "voice": voice, "response_format": "mp3", "speed": config["speed"]}
    # text_split_method 只作用于本地 GPT-SoVITS（切句过粗会丢句）；不进 config，
    # 避免改变其它幕的缓存指纹。缺省（None）时用服务端默认 cut1。
    if split and local:
        body["text_split_method"] = split
    try:
        # 本地 CPU 推理慢且受同机进程（如 RapidOCR 抢核）影响，读超时给足：162 字约 4~6 分钟，
        # 留到 30 分钟，避免瞬时卡顿被误判为失败而中断整轮。
        response = requests.post(base_url, headers={"Authorization": "Bearer " + key} if key else {},
                                 json=body, timeout=(20, 1800 if local else 180),
                                 proxies={"http": proxy, "https": proxy} if (proxy and not local) else None)
    except requests.RequestException as e:
        # 超时可能已在服务端完成，不自动重发计费请求，也不打印请求头。
        raise RuntimeError(f"{config['voice']} 请求结果不确定，已停止自动重发；网络错误 "
                           + type(e).__name__) from None
    if response.status_code != 200:
        raise RuntimeError(f"{config['voice']} 服务返回 HTTP {response.status_code}: "
                           + response.text[:200])
    is_mp3 = response.content.startswith(b"ID3") or (len(response.content) > 2 and
             response.content[0] == 255 and response.content[1] & 224 == 224)
    if len(response.content) < 1000 or not is_mp3:
        raise RuntimeError(f"{config['voice']} 服务未返回有效音频")
    partial = raw_path.with_suffix(".download")
    partial.write_bytes(response.content)
    partial.replace(raw_path)
    save(metadata, {"fingerprint": fingerprint, **config})
    return fingerprint


def align_source(text, words, duration, silent_intervals):
    source = clean(text)
    heard, starts, ends = "", [], []
    for w in words:
        chars = clean(w["word"])
        for i, char in enumerate(chars):
            heard += char
            starts.append(w["start"] + (w["end"] - w["start"]) * i / len(chars))
            ends.append(w["start"] + (w["end"] - w["start"]) * (i + 1) / len(chars))
    if not source or not heard:
        raise RuntimeError("配音识别为空")
    matches = SequenceMatcher(None, source, heard, autojunk=False).get_matching_blocks()
    coverage = sum(m.size for m in matches) / len(source)
    anchors = {}
    for m in matches:
        for offset in range(m.size):
            anchors[m.a + offset] = (starts[m.b + offset], ends[m.b + offset])
    longest_gap, run = 0, 0
    for i in range(len(source)):
        run = 0 if i in anchors else run + 1
        longest_gap = max(longest_gap, run)
    # Whisper 偶有整句漏识（长句里夹着的一句被整段跳过），而相邻文字对齐良好。
    # 只要全局匹配率高，允许个别稍长的未匹配段（插值仅覆盖这一小段），但以 13 字封顶；
    # 全局匹配率低于 85% 时仍严格要求每段 ≤8 字。
    if coverage < .65 or (longest_gap > 8 and coverage < .85) or longest_gap > 13:
        raise RuntimeError(f"字幕对时需检查：原稿匹配 {coverage:.1%}，最长未匹配 {longest_gap} 字；音频已缓存")
    # 少量专名字采用相邻已匹配字之间插值；字幕文本始终保留定稿。
    ordered = sorted(anchors)
    points = {}
    for i in range(len(source)):
        if i in anchors:
            points[i] = anchors[i]
            continue
        left = next((k for k in reversed(ordered) if k < i), -1)
        right = next((k for k in ordered if k > i), len(source))
        t0 = anchors[left][1] if left >= 0 else 0
        t1 = anchors[right][0] if right < len(source) else duration
        step = max(0, t1 - t0) / (right - left - 1)
        points[i] = (t0 + step * (i - left - 1), t0 + step * (i - left))
    def audible_start(t):
        # Whisper 字级点可能落在静音开始前约 0.1 秒，提前字幕会盖住句号停顿。
        return next((end for start, end in silent_intervals
                     if end - start >= .12 and start - .12 <= t <= end + .015), t)

    def audible_end(t):
        return next((start for start, end in silent_intervals
                     if end - start >= .12 and start - .025 <= t <= end + .015), t)

    for i, (start, end) in list(points.items()):
        points[i] = (audible_start(start), audible_end(end))

    lines, index = [], 0
    for clause in re.split(r"[，。；：！？…—、,.!?;:\n]", text):
        chars = clean(clause)
        for at in range(0, len(chars), 15):
            chunk = chars[at:at + 15]
            start = min(duration - .01, max(0, points[index][0]))
            if lines:
                start = max(start, lines[-1]["t"] + .001)
            end = max(start + .01, min(duration, points[index + len(chunk) - 1][1]))
            lines.append({"t": round(start, 3), "end": round(end, 3), "text": chunk})
            index += len(chunk)
    if "".join(line["text"] for line in lines) != source or any(l["end"] > duration + .02 for l in lines):
        raise RuntimeError("字幕文本或时间范围校验失败")
    return lines, {"sourceMatch": round(coverage, 4), "longestUnmatched": longest_gap,
                   "interpolatedCharacters": len(source) - len(anchors)}


def main():
    defaults = read(DEFAULTS)["narration"]
    ap = argparse.ArgumentParser()
    ap.add_argument("--pkg", required=True)
    ap.add_argument("--provider", default=defaults["provider"], help="siliconflow 或 local")
    ap.add_argument("--model", default=defaults["model"])
    ap.add_argument("--voice", default=defaults["voice"])
    ap.add_argument("--label", default=defaults["label"], help="音频/字幕里显示的音色名")
    ap.add_argument("--base-url", default=os.environ.get("BFE_TTS_BASE_URL"),
                    help="合成接口地址；本地服务如 http://127.0.0.1:9880/v1/audio/speech")
    ap.add_argument("--speed", type=float, default=defaults["speed"])
    ap.add_argument("--proxy", default=os.environ.get("BFE_TTS_PROXY"))
    ap.add_argument("--only", type=int)
    ap.add_argument("--split", default=os.environ.get("BFE_TTS_SPLIT"),
                    help="本地 TTS text_split_method（cut0..cut5）；切句过粗丢句时用它换档，仅影响请求体")
    ap.add_argument("--audio-only", action="store_true", help="仅生成可试听音频，不标记字幕对时完成")
    ap.add_argument("--align-model", default=os.environ.get("BFE_ALIGN_MODEL",
                      str(Path.home() / ".cache/battlefield-editor/faster-whisper-small")))
    ap.add_argument("--proper-nouns", default=os.environ.get("BFE_PROPER_NOUNS", PROPER_NOUNS),
                    help="字幕对时的专名提示（空格分隔）；不同战役应换成本战役的人名地名")
    args = ap.parse_args()
    if not .25 <= args.speed <= 4:
        raise ValueError("语速须在 0.25 至 4 之间")
    if not re.fullmatch(r"[A-Za-z0-9._-]+", args.voice):
        raise ValueError("音色标识只能包含字母、数字、点、下划线、连字符")
    base_url = args.base_url or (SILICONFLOW_URL if args.provider == "siliconflow" else "")
    if not base_url:
        raise ValueError("使用本地 provider 时请用 --base-url 指定合成服务地址")
    local = is_local_url(base_url)
    pkg = (ROOT / args.pkg).resolve()
    if pkg.parent != ROOT / "packages" or pkg.name == "chibi":
        raise ValueError("需指定 packages 下的独立完整版包，不允许覆盖赤壁短版")
    film = read(pkg / "film.json")
    script = read(pkg / "narration/script.json")
    if args.only is not None and args.only not in [s["scene"] for s in script]:
        raise ValueError("试听幕号不存在")
    source = (pkg / film["source"]).resolve()
    raw = (source / film.get("scriptFile", "爆款口播稿.txt")).read_text(encoding="utf-8-sig")
    if hashlib.sha256(raw.encode()).hexdigest() != film["scriptHash"]:
        raise ValueError("定稿已改变，请先重新编译完整版包")
    paragraphs = re.split(r"\n\s*\n", raw.strip())
    for item in script:
        first, last = item["sourceParagraphs"]
        if item["text"] != "\n\n".join(p.strip() for p in paragraphs[first - 1:last]):
            raise ValueError(f"第{item['scene']}幕配音稿与原始定稿不一致")
    if film.get("audioReady") and (film.get("voice") != args.voice or film.get("speed") != args.speed or
                                  film.get("pausePolicy") != defaults["pausePolicy"]):
        raise ValueError("已完成的配音包如需改音色或语速，请生成新包")
    if args.audio_only and film.get("audioReady"):
        print(f"此包已完成 {args.label} 配音，请直接播放现有音频", flush=True)
        return
    ffprobe = os.environ.get("FFPROBE") or shutil.which("ffprobe") or str(Path.home() / "bin/ffprobe.exe")
    ffmpeg = os.environ.get("FFMPEG") or shutil.which("ffmpeg") or str(Path.home() / "bin/ffmpeg.exe")
    config = {"provider": args.provider, "model": args.model,
              "voice": args.voice, "speed": args.speed}
    # 只有非默认端点才写进 config；这样云端 anna 的既有指纹与缓存不受影响。
    if base_url != SILICONFLOW_URL:
        config["baseUrl"] = base_url
    pause_policy = defaults["pausePolicy"]
    speak_of = make_speak(defaults.get("speakFixes"))
    cues = read(pkg / "narration/cues.json")
    output = pkg / "assets/narration" / args.voice
    output.mkdir(parents=True, exist_ok=True)
    cache = pkg / ".narration-cache" / args.voice
    cache.mkdir(parents=True, exist_ok=True)
    key, model = None, None
    failed_acts = []
    for item in script:
        n = item["scene"]
        if args.only and n != args.only:
            continue
        fingerprint = cue_fingerprint(speak_of(item), config, pause_policy)
        audio_path = output / f"scene{n}.mp3"
        cached = cues.get(str(n), {}).get(args.voice)
        if cached and audio_path.exists() and cached.get("fingerprint") == fingerprint:
            source_audio = cache / f"scene{n}.mp3"
            if source_audio.exists() and source_audio != audio_path and not has_ai_metadata(ffprobe, audio_path):
                repaired = output / f"scene{n}.tagged.mp3"
                normalize_pauses(ffmpeg, ffprobe, source_audio, repaired, pause_policy)
                repaired.replace(audio_path)
                print(f"第 {n} 幕 保留 {args.label} 音频生成标记", flush=True)
            else:
                print(f"第 {n} 幕 已有 {args.label} 配音与对时", flush=True)
            continue
        if model is None and not args.audio_only:
            model_path = Path(args.align_model)
            if not (model_path / "model.bin").exists():
                raise RuntimeError("本地字幕对时模型尚未安装，请用 --align-model 指定完整 faster-whisper 模型目录")
            from faster_whisper import WhisperModel
            print("加载本地字幕对时模型 small / CPU int8", flush=True)
            model = WhisperModel(str(model_path), device="cpu", compute_type="int8", cpu_threads=4)
        if key is None:
            key = "" if local else key_from_store()
        source_audio = cache / f"scene{n}.mp3"
        print(f"第 {n}/{len(script)} 幕 生成 {args.label}", flush=True)
        request_audio(speak_of(item), source_audio, cache / f"scene{n}.json", config, key, args.proxy, base_url,
                      args.split)
        final_temp = output / f"scene{n}.normalized.mp3"
        pause_edits, silent_intervals = normalize_pauses(ffmpeg, ffprobe, source_audio, final_temp, pause_policy)
        duration = probe(ffprobe, final_temp)
        if args.audio_only:
            final_temp.replace(audio_path)
            print(f"第 {n} 幕 {args.label} 试听 {duration:.1f} 秒；修正 {len(pause_edits)} 处长停顿；字幕尚未对时", flush=True)
            save(cache / f"scene{n}.pauses.json", {"policy": pause_policy, "edits": pause_edits,
                                                     "silentIntervals": silent_intervals})
            continue
        timing_cache = cache / f"scene{n}.words.json"
        words = (read(timing_cache).get("words")
                 if timing_cache.exists() and read(timing_cache).get("fingerprint") == fingerprint else None)
        lines, quality, failure = None, None, None
        for attempt, prompt in enumerate(align_prompts(item["text"], args.proper_nouns)):
            # 第 0 档若已有缓存转写就直接用，不必重跑识别。
            if attempt or words is None:
                segments, _ = model.transcribe(decode_mono16k(ffmpeg, final_temp), language="zh", beam_size=5,
                                                word_timestamps=True, vad_filter=False,
                                                initial_prompt=prompt)
                words = [{"word": w.word, "start": w.start, "end": w.end}
                         for segment in segments for w in (segment.words or [])]
            try:
                lines, quality = align_source(item["text"], words, duration, silent_intervals)
                break
            except RuntimeError as e:
                # 换更贴合的提示重认一次；三档都过不了才判定该幕对时未通过。
                lines, quality, failure = None, None, e
        final_temp.replace(audio_path)  # 音频先就位：对时是字幕的事，不该挡住试听
        if lines is None:
            failed_acts.append(n)
            print(f"第 {n}/{len(script)} 幕 {duration:.1f} 秒 字幕对时未通过（音频已就位）：{failure}", flush=True)
            continue
        save(timing_cache, {"fingerprint": fingerprint, "words": words, "prompt": prompt})
        cues[str(n)] = {"title": item["title"], "text": item["text"], args.voice: {
            "dur": duration, **config, "fingerprint": fingerprint, "aligner": ALIGN_REVISION,
            "pausePolicy": pause_policy, "pauseEdits": pause_edits,
            "timing": "local-asr-aligned", "quality": quality, "lines": lines}}
        save(pkg / "narration/cues.json", cues)
        print(f"第 {n}/{len(script)} 幕 {duration:.1f} 秒 字幕 {len(lines)} 行 匹配 {quality['sourceMatch']:.1%}", flush=True)
    ready = not args.audio_only and all(cues.get(str(s["scene"]), {}).get(args.voice, {}).get("fingerprint") ==
                cue_fingerprint(speak_of(s), config, pause_policy) and
                (output / f"scene{s['scene']}.mp3").exists() for s in script)
    film.update(voice=args.voice, provider=config["provider"], model=config["model"], speed=args.speed,
                pausePolicy=pause_policy)
    if not ready:
        film["audioReady"] = False
        save(pkg / "film.json", film)
        if failed_acts:
            print("以下幕字幕对时未通过，需重跑（音频已就位）："
                  + "、".join(f"第{n}幕" for n in failed_acts), flush=True)
        print(f"已保存 {args.label} 试听；全部幕生成后自动启用完整音轨", flush=True)
        return
    scenes = read(pkg / "scene.json")
    for i, act in enumerate(scenes["acts"]):
        dur = cues[str(i + 1)][args.voice]["dur"]
        act["dur"] = round(dur + ACT_TAIL, 3)
        for shot in act["shots"]:
            shot["dur"] = act["dur"] / len(act["shots"])
        if "finale" in act:
            act["finale"] = dur + min(ACT_TAIL, .5)
    audio = read(pkg / "audio.json")
    audio["narration"].update(voices=[args.voice], default=args.voice,
                              voiceLabels={args.voice: args.label})
    film.update(audioReady=True, subtitleTiming="local-asr-aligned",
                actualSeconds=round(sum(a["dur"] for a in scenes["acts"]), 3))
    save(pkg / "scene.json", scenes)
    save(pkg / "audio.json", audio)
    save(pkg / "film.json", film)
    bf = read(pkg / "battlefield.json")
    bf["meta"]["intro"]["footHtml"] = f"{args.label} 配音按定稿与实测音长对齐；史载、演义与文化解读分别说明。"
    save(pkg / "battlefield.json", bf)
    print(f"{args.label} 完整配音就绪 {film['actualSeconds'] / 60:.1f} 分钟", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"配音失败：{type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(1)
