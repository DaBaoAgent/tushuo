---
name: jianying
description: tushuo「jianying」20 分钟横版（1920×1080）纸雕剪影历史讲解片管线（ditu 全链 + HyperFrames 纸雕剪影视觉 + dabao 配音停顿更少 + 3-5 秒/分镜）。做 20 分钟历史长片、纸雕剪影画面、长稿配音、分段渲染、封面与打包时使用。定稿基准：《两千年422位皇帝》22:06.94 / 370 分镜 / 869 条字幕（2026-10-23）。
---

# jianying · 20 分钟横版纸雕剪影历史片

先读 `docs/jianying-制作管线.md`（完整参数、视觉规范、踩坑）。
音频/字幕/混音/质检/封面/打包整链沿用 `ditu`；`tools/jianying/` 与
`tools/ditu/` 同接口，不要改动 ditu 原管线。

## 硬规则

- **1920×1080（横版）/ 30 fps**；合成根 `data-duration = filmEnd`。
- 片长 = 口播总长 + 片尾卡 5.4 s（总尾长 6.0 s，`endAt = total − 5.4`；末镜结束在片尾卡起点）。
  定稿基准 **1326.938 s（22:06.94）**。
- 口播去标点 **7400–7500 字**；每 **3–5 秒**一个分镜，全片约 **330–400 个**（定稿 370 个：
  均值 3.582 s、中位 3.594 s，330/370 落在 3–5 s；允许少量 1–2 s 快切与 5.5–6 s 定帧）。
- 字幕：**≤16 字/条**，去标点（只保留《》）；52 px / 900 字重 / 微软雅黑 / 白字黑描边；
  底边 44 px；拼接必须与口播稿逐字一致（定稿 869 条）。
- 视觉只做**纸雕剪影**：5–7 层硬边纸片、层间投影、宣纸纹理、皮影式人物，
  固定色板（宣纸米白/墨黑/朱砂/赭石/靛青/旧金），禁止写实贴图与霓虹色。
- 运镜：一个分镜只做一个连续运镜（`shot.camera.from → to`）；层间视差；
  纸片擦除/翻页转场，硬切只做强调。
- 配音只用本机 GPT-SoVITS **dabao**（`tools\tts.cmd`），禁止 HyperFrames 内置 TTS。
- 停顿压紧用 `tools/jianying/smooth_narration.py` 默认口径：
  `--pause-scale 0.75 --pause-cap 0.35 --pause-min 0.10 --gap-ms 12 --lead-ms 18`
  （定稿 1376.488 s → 1320.930 s，省 55.6 s ≈ 4%）。
- 口播 −16.0 LUFS；BGM −34.0 LUFS；`alimiter=limit=0.8414`（−1.5 dBFS）；
  成品实测约 −15.8 LUFS / 真峰 −1.3 dBFS；AAC 320k / 48 kHz / 立体声。
- 交付目录 `D:\@kaifa\tushuo\out\<NN 主题>\` 顶层只 4 个文件 + `源文件/`。
- 发布信息：标题 **≤25 字、两段式强钩子**（问号/冒号/感叹号分隔）、数字用阿拉伯数字；
  第二行恰好 4 个 `#话题`；打包器硬校验。

## 审核节点（必须等宝哥点头）

1. 完整口播稿；
2. 1 分钟配音样音；
3. 5 个代表性分镜的渲染抽帧（**不跑样片**）；
4. 全片成片。

## 固定流程

1. **源文**：源视频全量转写 → `content/<slug>/源文全量转写.txt`；写事实底稿、
   分镜与口播、口播稿；分镜写在 `director_full.py`（场景库 + 370 条镜头定义），
   最终由 `build_full_film.py` 生成 `shots-full.json`。
2. **配音**：
   ```powershell
   tools\tts.cmd --text-file content\<slug>\口播稿.txt --out output\<slug>\narration.mp3
   ```
   然后压停顿（jianying 口径）：
   ```bash
   PY="D:/@kaifa/tushuo/vendor/gpt-sovits/.venv/Scripts/python.exe"
   "$PY" tools/jianying/smooth_narration.py --raw-json output/<slug>/narration.json \
     --chunks-dir output/<slug>/narration-chunks --out output/<slug>/narration-smooth \
     --pause-scale 0.75 --pause-cap 0.35 --pause-min 0.10 --gap-ms 12 --lead-ms 18
   ```
   定稿实测：`raw 1376.488s → smoothed 1320.930s（saved 55.6s）`；输出
   `narration-smooth.mp3/.json`（json 里的 chunks 就是后续分镜/字幕的时间源）。
3. **字幕 / 分镜时码 / 组装**（定稿做法，一步到位）：
   ```bash
   "$PY" content/<slug>/build_full_film.py \
     --timing output/<slug>/narration-smooth.json --compose
   ```
   生成 `content/<slug>/shots-full.json`（370 条）、
   `output/<slug>/build/captions-full.json`（869 条，≤16 字、去标点保留《》），
   并把 `SHOTS/CAPS/CUE`、`data-duration` 注入 `films/<slug>/index.html`；
   配音复制到 `films/<slug>/assets/voice/narration.mp3`。
   旧的 `build_captions.py + splice_film.py + cue-map` 流程仅用于更早的 `shots.json` 短片。
4. **画面**：`films/<slug>/index.html` 唯一 composition；`assets/papercut.js` 按
   `shots-full.json` 展开纸雕层；`npx hyperframes check` 0 error；抽 30–40 帧联系表审核。
   每镜运镜走 `camera.from → camera.to` 两段式（58% 中点、缩放对数空间）。
5. **渲染**（定稿命令，长片必须开分段续渲）：
   ```bash
   cd "D:/@kaifa/tushuo"
   NODE="D:/@kaifa/aiyouhu/.venv/Lib/site-packages/playwright/driver/node.exe"
   HF="C:/Users/20200/AppData/Local/npm-cache/_npx/702923228c2ce1e6/node_modules/hyperframes/bin/hyperframes.mjs"
   HF_SEGMENTED_CAPTURE=true PRODUCER_PUPPETEER_PROTOCOL_TIMEOUT_MS=900000 \
   nohup "$NODE" "$HF" render films/<slug> -o output/<slug>/picture-render.mp4 \
     --quality=high --workers=8 --protocol-timeout=900000 \
     --player-ready-timeout=120000 --browser-timeout=300 --resume --keep-segments \
     > output/<slug>/render-full.log 2>&1 &
   ```
   定稿基准：39809 帧 / 8 workers / 63 分 21 秒；分段缓存在
   `films/<slug>/renders/.hf-segments`，中断后用 `--resume` 续渲（别 kill 后重来）。
   合音频：`ffmpeg -i picture-render.mp4 -i audio/soundtrack.wav -map 0:v:0 -map 1:a:0
   -c:v copy -c:a aac -b:a 320k -ar 48000 -ac 2 -t <filmEnd> -movflags +faststart`。
6. **BGM / 音效 / 混音 / 质检 / 封面 / 打包**：
   - BGM 床 `tools/jianying/make_bgm_bed.py`（−34 LUFS）；
   - 场景音效 `content/<slug>/build_sfx.py`（按分镜类型自动铺、178 个锚点，
     输出 `audio/sfx-plan.json` + `audio/mix-full.json`）；
   - 混音 `tools/jianying/mix_audio.py --config output/<slug>/audio/mix-full.json`；
   - 质检 `tools/jianying/qa_film.py --width 1920 --height 1080`；
   - 封面 / 打包同 ditu，脚本换 `tools/jianying/`，交付进 `out/<NN 主题>/`。
7. 非平凡改动跑独立 verification agent，PASS 才交付。

## 质检门禁（每部必过）

1. `ffprobe`：h264 High 1920×1080 30fps / 39809 帧（按片长换算）/ AAC 48k 2ch / +faststart。
2. 全片解码 `ffmpeg -v error -xerror -i <成片> -f null -` 退出码 0；`-count_packets` 帧数一致。
3. `ebur128`：I 约 −15.8 LUFS、真峰 −1.3 dBFS（门禁 −3～−0.3）；`blackdetect` 无黑帧。
4. 字幕拼接与口播稿去标点后逐字一致；字幕 ≤16 字、52 px、不被遮挡。
5. 抽 10–14 帧核对开场钩子、大场面、人物特写、数字卡、转场、片尾卡。
6. 独立 verification agent PASS；报告要贴命令与输出。

## 定稿基准片（2026-10-23）

- slug：`china-emperors-20min`；交付：`D:\@kaifa\tushuo\out\3 两千年422位皇帝\`
- 源：抖音 150 分钟《一口气看完历史上422位皇帝》全量转写
- 成片：**1326.938 s（22:06.94）/ 39809 帧 / 1920×1080 30fps / H.264 High**
- 口播：7465 字 / 370 段；平滑后 1320.930 s；**869 条字幕**
- 分镜：370 个（均值 3.582 s，330/370 在 3–5 s）
- 音效：178 个锚点（开场 0.00 重击 / 0.12 鼓点 / 1.00 钟声；末锚 1296.08 s 钟声）
- 音频：口播 −16.1 / BGM −34.0 / 成品 −15.8 LUFS、真峰 −1.3 dBFS、AAC 320k
- 封面：`四百二十二帝` 六字；4:3 2048×1536 + 3:4 1536×2048
- 发布：`2000年422位皇帝：谁被记住，谁被忘了？` / `#中国历史 #皇帝 #历史科普 #涨知识`
