# tushuo — 历史讲解视频（HyperFrames + dabao 配音）

本项目做**历史讲解视频**：画面一律由 HyperFrames 主导（HTML/CSS/JS composition →
headless Chrome 逐帧 → FFmpeg 出 MP4），旁白一律用本机 GPT-SoVITS 的 **dabao**
预设。旧 Canvas 图说管线已删除，不再维护。

## 定稿管线（2026-10-20，v1.0）

从基准片 `mongol-west-1` v4 起，流程、数据和参数已固化：

- **完整管线**：`docs/制作管线.md`（含 TTS、字幕、HyperFrames 画面参数、Windows
  渲染、FFmpeg 混音、QA 与踩坑）
- **项目技能**：`.claude/skills/tushuo-history-video/SKILL.md`；新开 Claude Code
  会话后可用 `/tushuo-history-video`
- **基准片数据**：`content/mongol-west-1/成片数据.md`
- **首支定稿片**：`output/mongol-west-1/蒙古第一次西征-讹答剌.mp4`（本地，
  gitignored）与 `output/mongol-west-1/QA.md`

硬指标：60.000 s、1080×1920、30 fps、H.264 High、AAC 48 kHz 立体声、
−16 LUFS、真峰值 ≤ −1.0 dBTP、无黑帧；另出 720p 审阅版。

## 快速开始

1. HyperFrames 已作为 Claude Code 插件装在项目里（`.claude/settings.json`）；
   新开一次 Claude Code 会话后，用 `/hyperframes` 开始做片。
2. 新片建在 `films/<slug>/`（HyperFrames composition）。先写史实底稿、分镜和
   口播稿，口播稿放在 `content/<slug>/口播稿.txt` 并先给用户审。
3. 配音（任意目录可调用；本项目用转发入口）：

   ```powershell
   tools\tts.cmd --text-file content\<slug>\口播稿.txt --out output\<slug>\narration.mp3
   ```

4. 词级转写（本机 faster-whisper，不依赖 whisper.cpp）：

   ```powershell
   tools\transcribe_dabao.cmd --audio output\<slug>\narration.mp3 --out output\<slug>\transcript.json
   ```

5. 登记到 HyperFrames 的 `audio_meta.json`：

   ```powershell
   python tools\hf_audio_meta.py --hyperframes films\<slug> `
     --audio output\<slug>\narration.mp3 --words output\<slug>\transcript.json --frame-id 1
   ```

6. 在 `films/<slug>/` 里用 `npx hyperframes preview` 预览，用 `lint` / `check`
   过画面检查，再按管线抽关键帧给用户审。到音频步骤时**不要**用 HyperFrames
   内置 TTS（Kokoro/HeyGen/ElevenLabs/Gemini），只用第 3 步生成的旁白。
7. 用户确认画面后全片渲染（Windows 固定用系统 Chrome + SwiftShader）：

   ```bash
   HYPERFRAMES_BROWSER_PATH="C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe" \
   npx --yes hyperframes render -o "renders/<slug>-v4.mp4" \
     --no-browser-gpu --workers 1 --low-memory-mode --quality delivery --quiet
   ```

8. 按 `docs/制作管线.md` 第 8–9 节混音、QA、出 720p 审阅版；具体命令和参数不要
   每次重新发明，直接沿用定稿口径（音床 volume 0.9、`loudnorm I=-16:TP=-1.5:LRA=11`、
   `-ar 48000`、`-t 60`、视频流 copy）。

## 配音：dabao 预设

- 一键入口：`D:\GPT-SoVITS\dabao_tts.cmd`（本项目的 `tools\tts.cmd` 是转发）。
- 权威参数：`D:\GPT-SoVITS\voices\dabao\preset.json`
- 参考音频与逐字稿：`D:\GPT-SoVITS\voices\dabao\ref_dabao3-1.wav` + `.txt`
- 定稿试听：`D:\GPT-SoVITS\voices\dabao\locked-sample.mp3`
- 使用说明 / HTTP 直调 / 26E 权重切换：`D:\GPT-SoVITS\voices\dabao\README.md`

定稿参数（对应试听 A 版）：

| 项 | 值 |
| --- | --- |
| 切分 / 语速 | `cut1` / `speed_factor 1.0` |
| 采样 | `temperature 1.0`、`top_p 1.0`、`top_k 15`、`seed 20261020` |
| 分段 | 每段 ≤78 字；6.2 字/秒截断守卫，重试 3 次 |
| 停顿 | >240 ms 的句间静音压到 185 ms；20 ms 段间 |
| 音频 | 44.1 kHz 单声道；mp3 192 kbps |
| 音色 | GPT-SoVITS v2 底模 + 参考音频的零样本克隆 |

当前本机没有 26E 微调权重，音色接近 tushuo 原项目的 26E 但不等同；拿到权重后
只需改中央 preset 的 `server.infer_config`。文言/历史多音字规则见
`docs/读音规范.md`（例如「不战而降」读 xiáng，「从天而降」仍读 jiàng）。

## 目录

```
films/<slug>/        HyperFrames composition
  index.html         唯一 composition（动画必须可 seek）
  assets/            本片人物抠像、地图素材
  vendor/            本地字体与 gsap.min.js
  audio_meta.json    旁白 + 词级转写登记
  captions.json      字幕定稿数据
  renders/           仅旁白原始渲染（gitignored）
  .hyperframes/      检查/渲染缓存（gitignored）
content/<slug>/      事实底稿.md、分镜与口播.md、口播稿.txt、成片数据.md
output/<slug>/       旁白、音床、审核帧、成片、QA.md（gitignored）
工具
  tools/tts.cmd                转发 D:\GPT-SoVITS\dabao_tts.cmd
  tools/transcribe_dabao.cmd   本机 faster-whisper 词级转写
  tools/transcribe_faster.py   转写实现（输出 HyperFrames 兼容 JSON）
  tools/hf_audio_meta.py       旁白 + 转写 → audio_meta.json
素材
  三国人物/            64 张人物原图
  assets/commanders/   主帅卡（由人物原图裁切生成）
  assets/maps/         历史地形/地图示意素材
  assets/brand/        品牌图
文档
  docs/制作管线.md          定稿流程、参数、QA、踩坑（先读）
  docs/读音规范.md          文言/历史多音字与专名读音
  docs/资产来源与许可.md    资产来源与公开发布前的授权检查
  三国战役选题调研.md       历史选题调研
技能
  .claude/skills/tushuo-history-video/   定稿管线技能（/tushuo-history-video）
插件
  .claude/settings.json      HyperFrames 插件启用配置（project scope）
  .hyperframes-src/          HyperFrames 插件源（稀疏克隆，gitignored，勿手改）
```

`output/<slug>/` 与 `films/<slug>/renders/` 用于旁白、转写、审核帧和渲染中间产物，
已加入 `.gitignore`；`films/<slug>/.hyperframes/` 缓存同样不进仓库。
`films/` 按片新建；一部片一个子目录。

## 说明

- HyperFrames 插件版本 0.8.180（`npx hyperframes` CLI 实测 0.8.181），来自
  heygen-com/hyperframes；升级通过插件市场，不要直接修改 `.hyperframes-src/`。
- 旁白音频、参考音色、试听样音、原始渲染和中间视频不随仓库分发；
  `.gitignore` 已排除 `*.mp3`、`*.wav`、`*.mp4`、`output/`、`renders/`、`.hyperframes/`。
- 旧 Canvas 管线（`src/`、旧 `tools/`、`index.html`）已删除；历史内容仍保留在
  `content/`、`三国人物/` 和 `assets/` 中，供 HyperFrames 直接使用。
