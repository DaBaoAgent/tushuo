---
name: ditu
description: tushuo「ditu」5 分钟竖版历史讲解片定稿管线（HyperFrames + dabao TTS + 26 音效锚点 + BGM −34 LUFS + 两张封面 + 交付打包）。做或重出 tushuo 的 1080×1920 五分钟历史片、改 v3 时间轴、混音、出封面、打包到 out/<NN 主题>/ 时使用。Use when producing a 5-minute vertical tushuo history explainer, re-rendering the mongol film, mixing BGM/SFX, generating covers, or packaging a delivery.
---

# ditu · 5 分钟竖版历史讲解片管线

先读 `docs/ditu-制作管线.md`（完整参数与踩坑）。60 秒片仍走
`docs/制作管线.md` 与 `/tushuo-history-video`。

## 硬规则

- 配音只用本机 GPT-SoVITS **dabao**（`tools\tts.cmd`），禁止 HyperFrames 内置 TTS。
- 1080×1920 / 30 fps；片长 = 口播总长 + 片尾卡 5.4 s。
- 口播 −16.0 LUFS；**BGM −34.0 LUFS**（原 −32 再轻 20% = 振幅 ×0.8 ≈ −1.94 dB）；
  总混音限幅 −1.5 dBFS，成品约 −15.9 LUFS / −1.4 dBFS。
- 26 个音效锚点必须按**当前版口播行号**重排，素材取自 `音效/`，去开头静音、截 2 s、
  淡入淡出、分类 RMS 对齐。
- 改稿后整链重跑：字幕 → CUE → 锚点 → 片长 → 音轨 → 渲染。
- 封面只放**恰好 6 个汉字**的金色毛笔主标题，由 Seedream 直接画入；出图逐字核对。
- 交付目录 `out/<NN 主题>/` 顶层只 4 个文件 + `源文件/`。

## 固定流程

1. **内容**：`content/<slug>/` 事实底稿、分镜与口播、口播稿（约 1750 字）、
   `cue-map.json`（场景键 → 口播行号）。
2. **配音**：`tools\tts.cmd --text-file content\<slug>\口播稿.txt --out output\<slug>\narration.mp3`；
   然后用 `tools/ditu/smooth_narration.py` 压停顿（段内 0.75 倍、上限 0.35 s，段间 12 ms）：

   ```bash
   PY="D:/@kaifa/tushuo/vendor/gpt-sovits/.venv/Scripts/python.exe"
   "$PY" tools/ditu/smooth_narration.py --raw-json output/<slug>/narration-v1.json \
     --chunks-dir output/<slug>/narration-chunks --out output/<slug>/narration-v1
   ```

3. **字幕**：`tools/transcribe_dabao.cmd` 取时间；字幕文字对齐回原稿；按行号生成
   `CAPS` / `CUE`（单条 ≤14 字，拼接逐字校验）：

   ```bash
   "$PY" tools/ditu/build_captions.py --script content/<slug>/口播稿.txt \
     --narration-json output/<slug>/narration-v1.json --out-dir output/<slug>/review \
     --variation v1 --cue-map content/<slug>/cue-map.json \
     --js-prefix output/<slug>/review/_v1
   ```

   再拼进 composition（CAPS / CUE / data-duration，可选 buildTimeline）：

   ```bash
   "$PY" tools/ditu/splice_film.py --html films/<slug>/index.html \
     --caps-js output/<slug>/review/_v1-caps.js --cue-js output/<slug>/review/_v1-cue.js \
     --cue-json output/<slug>/review/cue-v1.json \
     --voice-src output/<slug>/narration-v1.mp3 --voice-dest films/<slug>/assets/voice/narration.mp3 \
     --backup-dir output/<slug>/_backup-v1
   ```

4. **画面**：`films/<slug>/index.html`，HyperFrames，可 seek；`hyperframes check` 0 error；
   抽 30–40 帧联系表给用户审，点头后才全片渲染。
5. **渲染**：

   ```bash
   cd "D:/@kaifa/tushuo/films/<slug>"
   npx --yes hyperframes render -q high -o "D:/@kaifa/tushuo/output/<slug>/render/video-vN.mp4" \
     > "D:/@kaifa/tushuo/output/<slug>/render/render-vN.log" 2>&1
   ```

   基准片 305.955 s = 9179 帧，实测约 17 分钟（3 workers）。
6. **BGM 床**：

   ```bash
   PY="D:/@kaifa/tushuo/vendor/gpt-sovits/.venv/Scripts/python.exe"
   "$PY" tools/ditu/make_bgm_bed.py --source "assets/bgm/二战 BGM_documentary.mp3" \
     --output output/<slug>/audio/bgm_bed.wav --duration <filmEnd>
   ```

7. **混音**：

   ```bash
   "$PY" tools/ditu/mix_audio.py --config output/<slug>/audio/mix-vN.json
   ```

   配置字段见 `docs/ditu-制作管线.md` 第 7.2 节；BGM 目标 `-34.0`。
8. **合成**：

   ```bash
   ffmpeg -y -i output/<slug>/render/video-vN.mp4 -i output/<slug>/audio/soundtrack-vN.wav \
     -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -ar 48000 -ac 2 \
     -t <filmEnd> -movflags +faststart output/<slug>/tushuo-<slug>-vN.mp4
   ```

9. **质检**：

   ```bash
   "$PY" tools/ditu/qa_film.py --film <成片> --duration <filmEnd> \
     --cover-4x3 <封面-4比3.jpg> --cover-3x4 <封面-3比4.jpg>
   ```

   再抽 6–10 帧核对；非平凡改动跑独立 verification agent。
10. **封面**：项目内脚本 `tools/ditu/make_covers.py`（纯标准库，读项目根 `.env`），
    模型 `doubao-seedream-5-0-flash-260915`；源图与提示词只存
    `content/<slug>/covers/`，4:3 2048×1536、3:4 1536×2048；六字标题逐字核对：

    ```bash
    "$PY" tools/ditu/make_covers.py --prompt-file content/<slug>/covers/prompt-4x3.txt \
      --size 2048x1536 --out content/<slug>/covers/<slug>-4x3.jpg
    "$PY" tools/ditu/make_covers.py --prompt-file content/<slug>/covers/prompt-3x4.txt \
      --size 1536x2048 --out content/<slug>/covers/<slug>-3x4.jpg
    ```

    脚本默认拒绝写到项目外（`--allow-external` 才放开）。
11. **发布信息**：恰好两行。第一行标题 **≤25 字、两段式强钩子**（问号/冒号/感叹号分隔），
    数字用阿拉伯数字；第二行恰好 4 个 `#话题`。示例：`华夏延续170万年！有10次差点灭亡`。
12. **打包**：

    ```bash
    "$PY" tools/ditu/package_delivery.py --job output/<slug>/delivery.json
    ```

## 基准片

`mongol-west-1-5min` v3：口播 300.555 s / 116 行 / 1750 字；成片 305.955 s / 9179 帧；
字幕 267 条；音效 26 锚点；BGM −34 LUFS；成品 −15.9 LUFS / −1.4 dBFS；
标题「成吉思汗西征」；交付 `out/1 蒙古第一次西征/`。
