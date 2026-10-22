---
name: tushuo-history-video
description: tushuo 历史讲解片定稿管线（HyperFrames + GPT-SoVITS dabao + FFmpeg 混音 + QA）。在制作或修改 tushuo 的 60 秒 1080×1920 历史讲解片、复用证物卡/地图/字幕/渲染参数时使用。Use when creating or revising a tushuo history explainer video, when running HyperFrames render/mix/QA for this project, or when the user asks to follow the tushuo pipeline.
---

# tushuo 历史讲解片管线

做 tushuo 的新片、改画面或重出成片时，先读：

1. `docs/制作管线.md`（完整流程、参数、踩坑）
2. `CLAUDE.md`（项目硬规则）
3. `docs/读音规范.md`（文言/专名读音）
4. `content/<slug>/`（事实底稿、分镜与口播、口播稿、成片数据）

基准片与全部定稿数据：`content/mongol-west-1/成片数据.md`。

## 硬规则

- 旁白只用本机 GPT-SoVITS **dabao** 预设，入口 `tools\tts.cmd`；
  **禁止** HyperFrames 内置 TTS（Kokoro / HeyGen / ElevenLabs / Gemini）。
- 口播稿先给用户审；重大画面改动先出 `iteration-N` 抽帧给用户审；
  用户说“定稿，跑成片”后直接完成渲染、混音、QA，不再逐阶段请示。
- 成片硬指标：60.000 s、1080×1920、30 fps、H.264 High、AAC 48 kHz 立体声、
  −16 LUFS、真峰值 ≤ −1.0 dBTP、无黑帧；另出 720p 审阅版。
- 旁白、音床、原始渲染、中间视频、私人原图和参考音频不进 git。

## 固定流程

### 1. 内容

- `content/<slug>/事实底稿.md`：主张 + 来源 + 存疑边界。
- `content/<slug>/口播稿.txt`：60 秒约 280–300 个汉字；本片 289 字 → 53.70 s。
- `content/<slug>/分镜与口播.md`：时间码、画面、旁白、字幕、证物卡、不确定性。

### 2. 配音

```powershell
tools\tts.cmd --text-file content\<slug>\口播稿.txt --out output\<slug>\narration.mp3
```

- 参数以 `vendor\gpt-sovits\tts_server.py` 的 `LOCKED` 为准：cut1、speed 1.0、
  repetition_penalty 1.35、temperature 0.80、top_p 0.95、top_k 15、seed 666、
  ≤78 字、段前 30 ms、段间 20 ms、44.1 kHz 单声道 mp3 192k。
- 逐段回读 `narration.json` 的 `chunks`；整句被吞时用 `--only N` 单独重合成。
- 多音字按 `docs/读音规范.md`，改动进 `tools\dabao_batch_tts.py` 的 `SPEAK_FIXES`。

### 3. 转写与字幕

```powershell
tools\transcribe_dabao.cmd --audio output\<slug>\narration.mp3 --out output\<slug>\transcript.json
vendor\gpt-sovits\.venv\Scripts\python.exe tools\hf_audio_meta.py --hyperframes films\<slug> `
  --audio output\<slug>\narration.mp3 --words output\<slug>\transcript.json --frame-id 1
```

- ASR 只取时间；字幕文字对齐回口播稿原文（拼音 DP）。不要用 `narration.json` 当词级转写。
- 字幕：一句一条、去标点、≤15 字、白色 48px 粗体 + 黑色圆角窄框、硬切；
  `#caption-wrap { bottom: 440px; }`，框体在画面 73–77% 高度（下三分之一）。

### 4. 画面（HyperFrames）

- 1080×1920 @30；根节点 `data-width/data-height/data-fps/data-composition-id`；
  paused timeline 注册到 `window.__timelines["<slug>"]`；动画必须可 seek。
- 首帧直接进地图，不设黑场标题卡。
- 路线揭示：静态虚线 + gradient stop offset；移动用 `getPointAtLength` 48 点采样，
  普通 `tl.to(el,{x,y})`；**不要用 onUpdate 驱动逐帧画面**。
- 1218 商队用单独骆驼商队模型；1219 进攻用透明成吉思汗抠像。
- 证物卡：16:9 400×225，left 280 / top 100，中心 x≈480，钦察草原上方；
  背景 `rgba(23,21,18,.84)` + blur(2px)；来源 18px、引文 25px（证物 03 短句 34px）、
  出处 13px、标签 17px、印章 58px；引文两行减留白；退场快速淡出。
- 顶部栏 y=32，避让证物标签；卡片不得压“钦察草原”地名和路线。

### 5. 检查口

```bash
cd films/<slug>
npx --yes hyperframes lint
npx --yes hyperframes check
npx --yes hyperframes snapshot --at 0.5,3.3,6.5,17,25.8,32,34.5,45.5,50.5 --no-end --no-browser-gpu -o ../../output/<slug>/iteration-N
```

- 0 error；36/36 对比度通过；仅接受“文件过长”warning 和行军虚线 connector info。
- 出 `contact-sheet-key.jpg` + 单帧 + `review.md` 给用户审；确认后才全片渲染。

### 6. 渲染（Windows）

```bash
npx --yes hyperframes render -o "renders/<slug>-v4.mp4" \
  --no-browser-gpu --workers 1 --low-memory-mode --quality delivery --quiet
```

卡 “Checking browser” 时：精确杀掉 `hyperframes render` 子进程，删除
`~/.cache/hyperframes/.chrome.install.lock` 与 `.chrome-staging-*`，再重试。

### 7. 混音

```bash
ffmpeg -y -i "renders/<slug>-v4.mp4" -i "output/<slug>/bed.wav" \
  -filter_complex "[0:a]aresample=48000,pan=stereo|c0=c0|c1=c0[vo];[1:a]volume=0.9[bed];[vo][bed]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -ar 48000 \
  -movflags +faststart -t 60 "output/<slug>/<片名>.mp4"
```

- 视频流 copy；loudnorm 后显式 `-ar 48000`；用 `-t 60` 固定片长。

### 8. QA 与交付

```bash
F="output/<slug>/<片名>.mp4"
ffprobe -v error -show_entries format=duration,size,bit_rate \
  -show_entries stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels -of json "$F"
ffmpeg -v error -xerror -i "$F" -f null -
ffmpeg -i "$F" -vf "blackdetect=d=0.1:pix_th=0.10" -an -f null -
ffmpeg -i "$F" -af loudnorm=print_format=json -f null -
```

- 交付 1080p 主片 + 720p 审阅版 + `output/<slug>/QA.md`；QA 写 SHA256、规格、黑帧、
  响度、峰值、render revision、限制。
- 交付时必须附 `发布信息.txt`（全管线统一口径）：恰好两行。第一行标题 **≤25 字、两段式强钩子**
  （问号/冒号/感叹号分隔），数字用阿拉伯数字；第二行恰好 4 个 `#话题`。
  示例：`华夏延续170万年！有10次差点灭亡`。
- 交付前做独立 verification 复核；PASS 才交付。若代理未返回，如实写明。

## 不要做

- 不要用内置 TTS；不要把 TTS 分段 JSON 当词级转写。
- 不要用 onUpdate / left/top 动画驱动 seek 画面。
- 不要在未抽帧审核时直接全片渲染。
- 不要把 `output/`、`renders/`、`.hyperframes/`、旁白/音床/私人原图提交进 git。
