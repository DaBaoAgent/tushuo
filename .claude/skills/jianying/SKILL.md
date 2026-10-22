---
name: jianying
description: tushuo「jianying」20 分钟竖版纸雕剪影历史讲解片管线（ditu 全链 + HyperFrames 纸雕剪影视觉 + dabao 配音停顿更少 + 3-5 秒/分镜）。做 20 分钟历史长片、纸雕剪影画面、长稿配音、分段渲染、封面与打包时使用。
---

# jianying · 20 分钟竖版纸雕剪影历史片

先读 `docs/jianying-制作管线.md`（完整参数、视觉规范、踩坑）。
音频/字幕/混音/质检/封面/打包整链沿用 `ditu`；`tools/jianying/` 与
`tools/ditu/` 同接口，不要改动 ditu 原管线。

## 硬规则

- 1080×1920 / 30 fps；片长 = 口播总长 + 片尾卡 5.4 s。
- 口播去标点 **6800–7200 字**；每 **3–5 秒**一个分镜，全片约 240–400 个。
- 视觉只做**纸雕剪影**：5–7 层硬边纸片、层间投影、宣纸纹理、皮影式人物，
  固定色板（宣纸米白/墨黑/朱砂/赭石/靛青/旧金），禁止写实贴图与霓虹色。
- 运镜：一个分镜只做一个连续运镜；层间视差；纸片擦除/翻页转场，硬切只做强调。
- 配音只用本机 GPT-SoVITS **dabao**（`tools\tts.cmd`），禁止 HyperFrames 内置 TTS。
- 停顿更少：`smooth_narration.py --pause-scale 0.65 --pause-cap 0.25 --pause-min 0.08 --gap-ms 10`。
- 口播 −16.0 LUFS；BGM −34.0 LUFS；总混音限幅 −1.5 dBFS。
- 交付目录 `out/<NN 主题>/` 顶层只 4 个文件 + `源文件/`。
- 发布信息：标题 **≤25 字、两段式强钩子**（问号/冒号/感叹号分隔）、数字用阿拉伯数字；
  第二行恰好 4 个 `#话题`；打包器硬校验。

## 审核节点（必须等宝哥点头）

1. 完整口播稿；
2. 1 分钟配音样音；
3. 5 个代表性分镜的渲染抽帧（**不跑样片**）；
4. 全片成片。

## 固定流程

1. **源文**：源视频全量转写 → `content/<slug>/源文全量转写.txt`；写事实底稿、
   分镜与口播、口播稿、`shots.json`、`cue-map.json`。
2. **配音**：
   ```powershell
   tools\tts.cmd --text-file content\<slug>\口播稿.txt --out output\<slug>\narration.mp3
   ```
   然后压停顿（jianying 口径）：
   ```bash
   PY="D:/@kaifa/tushuo/vendor/gpt-sovits/.venv/Scripts/python.exe"
   "$PY" tools/jianying/smooth_narration.py --raw-json output/<slug>/narration-v1.json \
     --chunks-dir output/<slug>/narration-chunks --out output/<slug>/narration-v1 \
     --pause-scale 0.65 --pause-cap 0.25 --pause-min 0.08 --gap-ms 10
   ```
3. **字幕**：
   ```bash
   "$PY" tools/jianying/build_captions.py --script content/<slug>/口播稿.txt \
     --narration-json output/<slug>/narration-v1.json --out-dir output/<slug>/review \
     --variation v1 --cue-map content/<slug>/cue-map.json \
     --js-prefix output/<slug>/review/_v1
   "$PY" tools/jianying/splice_film.py --html films/<slug>/index.html \
     --caps-js output/<slug>/review/_v1-caps.js --cue-js output/<slug>/review/_v1-cue.js \
     --cue-json output/<slug>/review/cue-v1.json \
     --voice-src output/<slug>/narration-v1.mp3 --voice-dest films/<slug>/assets/voice/narration.mp3 \
     --backup-dir output/<slug>/_backup-v1
   ```
4. **画面**：`films/<slug>/index.html` 唯一 composition；`assets/papercut.js` 按
   `shots.json` 展开纸雕层；`npx hyperframes check` 0 error；抽 30–40 帧联系表审核。
5. **渲染**：
   ```bash
   cd "D:/@kaifa/tushuo/films/<slug>"
   npx --yes hyperframes render -q high -w 3 \
     -o "D:/@kaifa/tushuo/output/<slug>/render/video-vN.mp4" \
     > "D:/@kaifa/tushuo/output/<slug>/render/render-vN.log" 2>&1
   ```
6. **BGM 床 / 混音 / 合成 / 质检 / 封面 / 打包**：同 ditu，脚本换 `tools/jianying/`。
7. 非平凡改动跑独立 verification agent，PASS 才交付。

## 当前片

- slug：`china-emperors-20min`
- 源：抖音 150 分钟《一口气看完历史上422位皇帝》全量转写
- 目标：20 分钟、约 7000 字、240–400 个纸雕分镜
