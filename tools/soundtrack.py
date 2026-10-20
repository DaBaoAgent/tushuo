"""原创合成配乐与音效。确定性合成；不使用影视配乐、采样、素材或第三方音频。

乐谱模式：读 `content/<slug>/score.json`，按其「环境层曲线 + cue 谱」生成。
本项目的画面直接按配音时间编排（无 WARP），所以 cue 也直接写配音时间。
若同时存在 `content/<slug>/sfx-track.json`，再在其上铺场景样本音效
（每段用 cueText 锚到口播真正说出该场景的字幕行）。
"""
from __future__ import annotations

from pathlib import Path
import argparse
import json

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, resample_poly

SR = 44100
ROOT = Path(__file__).resolve().parent.parent

_ap = argparse.ArgumentParser(description="生成原创合成配乐与音效 soundbed.wav")
_ap.add_argument("--slug", default="chibi-full", help="content/output 下的战役目录名")
_args = _ap.parse_args()
SLUG = _args.slug
OUT = ROOT / "output" / SLUG / "soundbed.wav"


# ==================== 共享合成基元 ====================
def band_noise(rng: np.random.Generator, length: int, low: float, high: float) -> np.ndarray:
    noise = rng.standard_normal(length).astype(np.float32)
    return sosfilt(butter(2, [low, high], btype="bandpass", fs=SR, output="sos"), noise).astype(np.float32)


def norm(x: np.ndarray) -> np.ndarray:
    return x / max(float(np.std(x)), 1e-6)


def pk(x: np.ndarray) -> np.ndarray:
    """离散配器按峰值归一：常数 level 直接等于该音的峰值振幅，可跨音色对比。
    连续层（水流、底噪、风）仍用 norm() 的 RMS 归一。"""
    return x / max(float(np.max(np.abs(x))), 1e-9)


def env_sin(length: int, power: float = 1.0) -> np.ndarray:
    t = np.linspace(0, 1, length, dtype=np.float32)
    return (np.clip(np.sin(np.pi * t), 0, 1) ** power).astype(np.float32)


def v_drum(rng: np.random.Generator, dur: float = 1.8) -> np.ndarray:
    """低音战鼓：音高下滑的正弦体 + 皮质敲击噪声。"""
    t = np.arange(int(dur * SR), dtype=np.float32) / SR
    phase = 2 * np.pi * (43 * t + 39 * (1 - np.exp(-t * 28)) / 28)
    body = np.sin(phase) * np.exp(-t * 7)
    tap = norm(band_noise(rng, len(t), 200, 1300)) * np.exp(-t * 25)
    return (body * 0.84 + tap * 0.12).astype(np.float32)


def v_boom(rng: np.random.Generator, dur: float = 2.6) -> np.ndarray:
    """更低更长的闷雷：用于开场数字对撞、火船撞阵、片尾落锤。"""
    t = np.arange(int(dur * SR), dtype=np.float32) / SR
    phase = 2 * np.pi * (31 * t + 26 * (1 - np.exp(-t * 16)) / 16)
    body = np.sin(phase) * np.exp(-t * 2.6)
    rumble = norm(band_noise(rng, len(t), 40, 220)) * np.exp(-t * 3.4)
    return (body * 0.80 + rumble * 0.28).astype(np.float32)


def v_pluck(freq: float, dur: float = 4.2) -> np.ndarray:
    """拨弦音：数字牌落下、地名亮起、三色块点亮用。"""
    t = np.arange(int(dur * SR), dtype=np.float32) / SR
    envelope = (1 - np.exp(-t * 35)) * np.exp(-t * 1.3)
    osc = (np.sin(2 * np.pi * freq * t) + 0.38 * np.sin(2 * np.pi * freq * 2 * t)
           + 0.14 * np.sin(2 * np.pi * freq * 3.01 * t))
    return (osc * envelope).astype(np.float32)


def v_chord(notes: list[float], dur: float = 4.6) -> np.ndarray:
    length = int(dur * SR)
    out = np.zeros(length, dtype=np.float32)
    for n in notes:
        s = v_pluck(float(n), dur)
        out[:len(s)] += s / max(len(notes), 1) ** 0.5
    return out


def v_sting(dur: float = 1.5) -> np.ndarray:
    """高处不谐和音簇：疫病图标、黄盖中箭、划掉「只败在火」。"""
    t = np.arange(int(dur * SR), dtype=np.float32) / SR
    osc = np.sin(2 * np.pi * 932 * t) + 0.9 * np.sin(2 * np.pi * 987 * t) + 0.5 * np.sin(2 * np.pi * 1244 * t)
    return (osc * np.exp(-t * 3.2) * 0.5).astype(np.float32)


def v_clash(rng: np.random.Generator, dur: float = 1.2) -> np.ndarray:
    """兵刃相击：初一交战、划掉演义桥段。"""
    t = np.arange(int(dur * SR), dtype=np.float32) / SR
    return (norm(band_noise(rng, len(t), 900, 5200)) * np.exp(-t * 9)).astype(np.float32)


def v_sword(rng: np.random.Generator, dur: float = 1.6) -> np.ndarray:
    """孙权拔刀斫案：刀刃破风 + 木案闷响。"""
    t = np.arange(int(dur * SR), dtype=np.float32) / SR
    edge = norm(band_noise(rng, len(t), 1600, 7000)) * np.exp(-t * 26)
    thud = np.sin(2 * np.pi * 58 * t) * np.exp(-t * 5.5)
    return (edge * 0.7 + thud * 0.9).astype(np.float32)


def v_paper(rng: np.random.Generator, dur: float = 3.0) -> np.ndarray:
    """纸与笔：书信特写（诈降书、曹操自辩信）、火船剖面卡。"""
    return (norm(band_noise(rng, int(dur * SR), 400, 4200)) * env_sin(int(dur * SR), 1.6)).astype(np.float32)


def v_tick(rng: np.random.Generator, dur: float = 0.09) -> np.ndarray:
    """金属轻响：战船首尾相接的缆索扣响、演义卡上的「×」。"""
    t = np.arange(int(dur * SR), dtype=np.float32) / SR
    return (norm(band_noise(rng, len(t), 2200, 8000)) * np.exp(-t * 70)).astype(np.float32)


def v_thud(rng: np.random.Generator, dur: float = 1.4) -> np.ndarray:
    """闷落：败因标签、华容道、演义卡落下。"""
    t = np.arange(int(dur * SR), dtype=np.float32) / SR
    body = np.sin(2 * np.pi * 72 * t) * np.exp(-t * 6.5)
    click = norm(band_noise(rng, len(t), 300, 2200)) * np.exp(-t * 34)
    return (body * 0.9 + click * 0.16).astype(np.float32)


def v_splash(rng: np.random.Generator, dur: float = 1.6) -> np.ndarray:
    """落水：人马烧溺堕江。"""
    t = np.arange(int(dur * SR), dtype=np.float32) / SR
    return (norm(band_noise(rng, len(t), 600, 6500)) * np.exp(-t * 4.2)).astype(np.float32)


def v_sweep(rng: np.random.Generator, dur: float = 2.4) -> np.ndarray:
    """上行的滤波气流：风向罗盘由西北转东南。"""
    n = int(dur * SR)
    lo = norm(band_noise(rng, n, 240, 900))
    hi = norm(band_noise(rng, n, 1200, 5200))
    w = np.linspace(0, 1, n, dtype=np.float32)
    return ((lo * (1 - w) + hi * w) * env_sin(n, 1.3)).astype(np.float32)


def v_rumble(rng: np.random.Generator, dur: float) -> np.ndarray:
    """低频滚动：岸上营落延烧、华容道泥泞。"""
    return (norm(band_noise(rng, int(dur * SR), 35, 180)) * env_sin(int(dur * SR), 1.2)).astype(np.float32)


def v_roll(rng: np.random.Generator, dur: float) -> np.ndarray:
    """连击战鼓：火烧连营时持续的压力。"""
    n = int(dur * SR)
    out = np.zeros(n, dtype=np.float32)
    at = 0.0
    while at < dur:
        seg = v_drum(rng, 1.2) * 0.5
        i = int(at * SR)
        if i >= n:
            break
        piece = seg[:n - i]
        out[i:i + len(piece)] += piece * float(np.exp(-at / max(dur, 1e-6) * 0.7))
        at += 0.105 + float(rng.random()) * 0.03
    return out


VOICES = {
    "drum": lambda rng, spec: pk(v_drum(rng, float(spec.get("dur", 1.8)))),
    "boom": lambda rng, spec: pk(v_boom(rng, float(spec.get("dur", 2.6)))),
    "pluck": lambda rng, spec: pk(v_pluck(float(spec["note"]), float(spec.get("dur", 4.2)))),
    "chord": lambda rng, spec: pk(v_chord([float(x) for x in spec["notes"]], float(spec.get("dur", 4.6)))),
    "sting": lambda rng, spec: pk(v_sting(float(spec.get("dur", 1.5)))),
    "clash": lambda rng, spec: pk(v_clash(rng, float(spec.get("dur", 1.2)))),
    "sword": lambda rng, spec: pk(v_sword(rng, float(spec.get("dur", 1.6)))),
    "paper": lambda rng, spec: pk(v_paper(rng, float(spec.get("dur", 3.0)))),
    "tick": lambda rng, spec: pk(v_tick(rng, float(spec.get("dur", 0.09)))),
    "thud": lambda rng, spec: pk(v_thud(rng, float(spec.get("dur", 1.4)))),
    "splash": lambda rng, spec: pk(v_splash(rng, float(spec.get("dur", 1.6)))),
    "sweep": lambda rng, spec: pk(v_sweep(rng, float(spec.get("dur", 2.4)))),
    "rumble": lambda rng, spec: pk(v_rumble(rng, float(spec.get("dur", 2.6)))),
    "roll": lambda rng, spec: pk(v_roll(rng, float(spec.get("dur", 8.0)))),
}


class Bed:
    """(N,2) 立体声混音床：所有信号按绝对时间叠加，pan 用等功率分配。"""

    def __init__(self, seconds: float):
        self.n = int(SR * seconds)
        self.mix = np.zeros((self.n, 2), np.float32)

    def add(self, signal: np.ndarray, start: float, level: float, pan: float = 0.0) -> None:
        if level <= 0:
            return
        sig = np.asarray(signal, dtype=np.float32)
        at = int(round(start * SR))
        if at < 0:
            sig = sig[-at:]
            at = 0
        if at >= self.n or not len(sig):
            return
        sig = sig[:self.n - at]
        left = float(np.sqrt((1 - pan) / 2) * level)
        right = float(np.sqrt((1 + pan) / 2) * level)
        self.mix[at:at + len(sig), 0] += sig * left
        self.mix[at:at + len(sig), 1] += sig * right

    def write(self, out: Path, cap: float = 0.4) -> float:
        peak = float(np.max(np.abs(self.mix)))
        if not np.isfinite(peak):
            raise RuntimeError("音轨包含无效样本")
        if peak > cap:
            self.mix *= cap / peak
            peak = cap
        out.parent.mkdir(parents=True, exist_ok=True)
        sf.write(out, self.mix, SR, subtype="PCM_16")
        return peak


def curve(points: list[list[float]], t: np.ndarray) -> np.ndarray:
    xs = np.array([float(p[0]) for p in points], dtype=np.float64)
    ys = np.array([float(p[1]) for p in points], dtype=np.float64)
    return np.interp(t, xs, ys).astype(np.float32)


# ==================== 模式①：乐谱（score.json） ====================
def build_cue_sheet(spec: dict) -> float:
    caps = json.loads((ROOT / "output" / SLUG / "captions.json").read_text(encoding="utf-8"))
    seconds = float(spec.get("seconds") or (float(caps["duration"]) + float(spec.get("tail", 0.0))))
    rng = np.random.default_rng(int(spec.get("seed", 1)))
    bed = Bed(seconds)
    time = np.arange(bed.n, dtype=np.float32) / SR

    amb = spec.get("ambience", {})
    water = norm(band_noise(rng, bed.n, float(amb.get("waterLow", 70)), float(amb.get("waterHigh", 480))))
    wash = norm(band_noise(rng, bed.n, float(amb.get("washLow", 700)), float(amb.get("washHigh", 2800))))
    water *= curve(amb.get("water", [[0, 0.018]]), time) * (0.72 + 0.28 * np.sin(2 * np.pi * 0.083 * time))
    wash *= curve(amb.get("wash", [[0, 0.003]]), time) * (0.68 + 0.32 * np.sin(2 * np.pi * 0.16 * time + 1.4))
    bed.mix[:, 0] += water * 0.78 + wash
    bed.mix[:, 1] += water * 0.66 + wash * 0.91

    drone = spec.get("drone")
    if drone:
        gains = [float(x) for x in drone.get("gains", [1.0] * len(drone["notes"]))]
        sig = np.zeros(bed.n, dtype=np.float32)
        for note, gain in zip(drone["notes"], gains):
            sig += np.sin(2 * np.pi * float(note) * time).astype(np.float32) * gain
        amp = curve(drone.get("level", [[0, 0.02]]), time) * (0.80 + 0.20 * np.sin(2 * np.pi * 0.043 * time))
        bed.mix[:, 0] += sig * amp * 0.92
        bed.mix[:, 1] += sig * amp

    # 风：一段连续的气流，音量随时间正弦起落
    for t0, t1, level, pan in spec.get("wind", []):
        n = int((t1 - t0) * SR)
        if n <= 0:
            continue
        s = norm(band_noise(rng, n, 130, 1200))
        s = s * env_sin(n, 1.0) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.19 * np.linspace(0, 23, n, dtype=np.float32)))
        bed.add(s, t0, level, pan)

    # 火焰嘶爆：按密度铺随机短噪
    for t0, t1, density, level in spec.get("crackle", []):
        for _ in range(int((t1 - t0) * density * 26)):
            at = t0 + float(rng.random()) * (t1 - t0)
            size = int(SR * float(rng.uniform(0.012, 0.08)))
            t = np.arange(size, dtype=np.float32) / SR
            spark = rng.standard_normal(size).astype(np.float32) * np.exp(-t * float(rng.uniform(70, 170)))
            bed.add(spark, at, float(rng.uniform(0.4, 1.0)) * level, float(rng.uniform(-0.65, 0.65)))

    # 心跳般的低鼓脉冲
    for t0, t1, bpm, level in spec.get("pulse", []):
        step = 60.0 / float(bpm)
        at = t0
        while at < t1:
            bed.add(pk(v_drum(rng, 1.6)), at, level * float(rng.uniform(0.75, 1.15)), 0.0)
            at += step

    # 规律轻响（缆索扣响等）
    for t0, t1, interval, level in spec.get("ticks", []):
        at = t0
        while at < t1:
            bed.add(pk(v_tick(rng)), at + float(rng.uniform(-0.02, 0.02)),
                    level * float(rng.uniform(0.55, 1.0)), float(rng.uniform(-0.5, 0.5)))
            at += interval

    for t0, t1, level in spec.get("rumble", []):
        bed.add(pk(v_rumble(rng, t1 - t0)), t0, level)

    for cue in spec.get("cues", []):
        voice = VOICES.get(str(cue.get("v") or cue.get("kind")))
        if voice is None:
            raise ValueError(f"未知配器：{cue.get('v') or cue.get('kind')}")
        bed.add(voice(rng, cue), float(cue["t"]), float(cue.get("level", 0.05)), float(cue.get("pan", 0.0)))

    return bed


# ==================== 段边界：与 src/scene-chibi-full.js 同一套口径 ====================
# 13 段在「去标点正文」里的累计字符位置（改口播稿时两处必须同步改）
ACT_OFFSETS = [0, 110, 239, 392, 508, 636, 738, 841, 967, 1099, 1233, 1344, 1413, 1661]
ACT_KEYS = ['曹操有二十万，为什么打不过五万人', '兵力账', '荆州 · 孙刘联盟', '南北对峙',
            '曹军的软肋', '黄盖献计', '火船与东南风', '点火 · 撞阵', '火烧连营',
            '溃退 · 华容道', '真正败因', '三分天下', '演义与真事']


def build_acts(caps: list[tuple[float, float, str]], film_end: float) -> list[dict]:
    """与 scene-chibi-full.js 的 buildActs 逐行同构：字幕累计字符切 13 段。"""

    def line_index_at(offset: int) -> int:
        pos = 0
        for i, (_, _, text) in enumerate(caps):
            if offset < pos + len(text):
                return i
            pos += len(text)
        return max(0, len(caps) - 1)

    acts = []
    for k in range(len(ACT_OFFSETS) - 1):
        i0 = line_index_at(ACT_OFFSETS[k])
        i1 = max(i0, line_index_at(ACT_OFFSETS[k + 1]) - 1)
        acts.append({"t0": 0 if i0 == 0 else caps[i0][0], "t1": caps[i1][1]})
    acts[12]["t1"] = max(acts[12]["t0"] + 1, film_end)
    for k in range(13):
        if k > 0 and acts[k]["t0"] < acts[k - 1]["t0"]:
            acts[k]["t0"] = acts[k - 1]["t0"]
        if acts[k]["t1"] <= acts[k]["t0"]:
            acts[k]["t1"] = acts[k]["t0"] + 1
    return acts


def load_sample(path: Path) -> np.ndarray:
    """读样本 wav → 44.1k 单声道 float32（已是该规格则直读）。"""
    x, sr = sf.read(str(path), dtype="float32")
    if x.ndim > 1:
        x = x.mean(axis=1)
    if sr != SR:
        x = resample_poly(x, SR, sr).astype(np.float32)
    return x


def trim_lead_silence(x: np.ndarray, pad: float = 0.03) -> np.ndarray:
    """去掉样本开头的静音：以 10ms 短窗找第一个明显有声的窗（>峰值 3% 或 -50dBFS），
    起点前留 pad 秒呼吸，避免削掉起音。"""
    if len(x) == 0:
        return x
    peak = float(np.max(np.abs(x)))
    if peak <= 0:
        return x
    thr = max(peak * 0.03, 10 ** (-50 / 20))
    win = max(1, int(0.01 * SR))
    for at in range(0, len(x), win):
        if float(np.max(np.abs(x[at:at + win]))) > thr:
            return x[max(0, at - int(pad * SR)):]
    return x


def fit_duration(x: np.ndarray, dur: float, from_start: bool = False) -> np.ndarray:
    """≥dur：默认取最响 dur 窗；from_start=True 时从样本头（已去前导静音）顺取。
    1.2–dur 原样（不足处以淡尾收）；<1.2s loop 补齐（20ms 交叉淡化防咔）。"""
    n = int(dur * SR)
    if len(x) >= n:
        if from_start or len(x) == n:
            return x[:n]
        hop = int(0.05 * SR)
        best_at, best_rms = 0, -1.0
        for at in range(0, len(x) - n + 1, hop):
            rms = float(np.sqrt(np.mean(x[at:at + n] ** 2)))
            if rms > best_rms:
                best_rms, best_at = rms, at
        return x[best_at:best_at + n]
    if len(x) >= int(1.2 * SR):
        return x
    out = np.zeros(n, dtype=np.float32)
    at = 0
    xf = int(0.02 * SR)          # loop 接缝交叉淡化长度
    while at < n:
        piece = x[:min(len(x), n - at)]
        out[at:at + len(piece)] = piece
        at += len(piece)
        if at < n and len(piece) == len(x) and xf:
            # 接缝处与下一段开头做 20ms 等功率交叉淡化
            tail = out[at - xf:at] * np.linspace(1, 0, xf, dtype=np.float32)
            head = x[:xf] * np.linspace(0, 1, xf, dtype=np.float32)
            out[at - xf:at] = tail + head
    return out


def fade_edges(x: np.ndarray, fin: float, fout: float) -> np.ndarray:
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
    if a:
        x[:a] *= np.linspace(0, 1, a, dtype=np.float32)
    if b:
        x[-b:] *= np.linspace(1, 0, b, dtype=np.float32)
    return x


def mix_sfx_track(bed: "Bed", spec_path: Path, caps: list[tuple[float, float, str]],
                  film_end: float) -> list[str]:
    """把 sfx-track.json 的场景样本铺到 bed 上（默认在锚句前 tBefore 秒起铺）。

    电平策略：淡入淡出后按「目标床峰值」TARGET_SFX_PEAK 自动归整——短样本
    （钟/重击）峰值常落在淡入区，固定增益会把它们的成片峰值压低 8dB 以上；
    归整后每段样本对床的峰值贡献一致（targetBedPeak×0.707  pan 系数，第八轮
    起 0.75 → ≈-5.5dBFS/声道），gainDb 仅作相对微调。
    目标值与床内鼓点 cue 同级或更高（宝哥第八轮「音效不够突出」要求样本压过
    BGM cue 出头），叠加局部床峰后不触发 Bed.write 的 bedPeakCap 全局再缩放
    （c01 钩子段另用 -4.5dB 微调压在 hook stack 之下）。"""
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    lib = ROOT / str(spec.get("libRoot", "音效"))
    t_before = float(spec.get("tBefore", 0.2))
    fade_in = float(spec.get("fadeIn", 0.2))
    fade_out = float(spec.get("fadeOut", 0.25))
    dur = float(spec.get("sampleDur", 2.0))
    trim_lead = bool(spec.get("trimLeadSilence", False))
    target = float(spec.get("targetBedPeak", 0.30))
    acts = build_acts(caps, film_end)
    report = []
    for seg in spec.get("segments", []):
        k = int(seg["seg"]) - 1
        if not (0 <= k < len(acts)):
            raise ValueError(f"seg {seg['seg']} 超出 13 段范围")
        rel = str(seg.get("path") or "").strip()
        if not rel or rel.startswith("<"):
            raise ValueError(f"seg {seg['seg']}（{seg.get('name')}）未填 path")
        path = Path(rel) if Path(rel).is_absolute() else lib / Path(rel).name
        if not path.exists():
            raise FileNotFoundError(f"seg {seg['seg']} 样本不存在：{path}")
        x = load_sample(path)
        if trim_lead:
            x = trim_lead_silence(x, float(spec.get("silencePad", 0.03)))
        x = fit_duration(x, dur, from_start=trim_lead)
        x = fade_edges(x, fade_in, fade_out)
        peak = float(np.max(np.abs(x)))
        if peak <= 0:
            raise ValueError(f"seg {seg['seg']} 样本全静音：{path}")
        gain = target / peak * 10 ** (float(seg.get("gainDb", 0.0)) / 20)
        cue_text = str(seg.get("cueText") or "").strip()
        if cue_text:
            hit = next((t for (t, _e, text) in caps if cue_text in text), None)
            if hit is None:
                raise ValueError(f"seg {seg['seg']} 找不到口播关键词：{cue_text}")
            t0 = max(0.0, hit - t_before)
            anchor = f"「{cue_text}」{hit:7.2f}s"
        else:
            t0 = max(0.0, acts[k]["t0"] - t_before)
            anchor = f"段{k + 1}头 {acts[k]['t0']:7.2f}s"
        bed.add(x, t0, gain, float(seg.get("pan", 0.0)))
        report.append(f"  c{seg['seg']:>2} {anchor} 铺 {path.name:<24} "
                      f"trim {float(seg.get('gainDb', 0.0)):+.0f}dB → 床内电平 {20 * np.log10(gain * peak):5.1f}dBFS")
    return report


# ==================== 入口 ====================
score_file = ROOT / "content" / SLUG / "score.json"
if score_file.exists():
    spec = json.loads(score_file.read_text(encoding="utf-8"))
    caps_json = json.loads((ROOT / "output" / SLUG / "captions.json").read_text(encoding="utf-8"))
    caps = [(float(l["t"]), float(l["end"]), str(l["text"])) for l in caps_json["lines"]]
    film_end = float(spec.get("seconds") or (float(caps_json["duration"]) + float(spec.get("tail", 0.0))))
    bed = build_cue_sheet(spec)
    mode = f"乐谱 {score_file.name}"
    sfx_file = ROOT / "content" / SLUG / "sfx-track.json"
    cap = 0.4
    if sfx_file.exists():
        lines = mix_sfx_track(bed, sfx_file, caps, film_end)
        mode += f" + {sfx_file.name}（{len(lines)} 段样本）"
        print("\n".join(lines))
        # 床封顶跟随 sfx-track 的 bedPeakCap：样本目标峰值(targetBedPeak)抬高后，
        # 若封顶仍锁 0.4，Bed.write 的全局再缩放会把刚提的音效增益按比例吃回去。
        cap = float(json.loads(sfx_file.read_text(encoding="utf-8")).get("bedPeakCap", 0.4))
    peak = bed.write(OUT, cap)
else:
    raise SystemExit(f"缺少乐谱：{score_file}（每部片必须有 score.json）")
print(f"原创配乐与音效（{mode}）：{OUT}，峰值 {20 * np.log10(max(peak, 1e-9)):.1f} dBFS，"
      f"时长 {sf.info(str(OUT)).frames / SR:.2f}s")
