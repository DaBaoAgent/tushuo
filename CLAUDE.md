# tushuo — 历史讲解视频（HyperFrames）

本项目用 HyperFrames 制作历史讲解视频。HyperFrames 已作为 Claude Code 插件安装在
本项目（`.claude/settings.json` 的 `hyperframes@hyperframes`，插件源为
`.hyperframes-src/`，稀疏克隆自 heygen-com/hyperframes 0.8.180）。新会话启动后
可用 `/hyperframes` 等技能；本会话之后新开一次即可加载。

## 定稿管线（先读，必须遵守）

- **5 分钟竖版片 = `ditu` 管线（2026-10-21 定稿）**：先读 `docs/ditu-制作管线.md`，
  新会话可调用 `/ditu`（`.claude/skills/ditu/SKILL.md`）。基准片
  `mongol-west-1-5min` v3：1080×1920 / 30 fps / 305.955 s、26 个音效锚点、
  BGM −34 LUFS、成品约 −15.9 LUFS / −1.4 dBFS；字幕/停顿时长/拼装/混音/质检/打包脚本
  在 `tools/ditu/`。
  交付到 `out/<NN 主题>/`（顶层 4 文件 + `源文件/`）。
- **20 分钟横版长片 = `jianying` 管线（2026-10-23 定稿）**：先读
  `docs/jianying-制作管线.md`，新会话可调用 `/jianying`
  （`.claude/skills/jianying/SKILL.md`）。基准片 `china-emperors-20min`：
  1920×1080 / 30 fps / 1326.938 s / 39809 帧 / 370 分镜（3–5 s）/ 869 条字幕 /
  178 音效锚点 / BGM −34 LUFS / 成品 −15.8 LUFS、真峰 −1.3 dBFS；
  交付在 `out/3 两千年422位皇帝/`。纸雕剪影视觉、dabao 配音、分段续渲参数见文档。
- **60 秒片**：先读 `docs/制作管线.md`；新会话可调用项目技能
  `/tushuo-history-video`（`.claude/skills/tushuo-history-video/SKILL.md`）。
- 基准片是 `mongol-west-1` v4，全部定稿参数、文件大小、哈希和 QA 数据在
  `content/mongol-west-1/成片数据.md`。
- 成片硬指标：60.000 s、1080×1920、30 fps、H.264 High、AAC 48 kHz 立体声、
  −16 LUFS、真峰值 ≤ −1.0 dBTP、无黑帧；另出 720p 审阅版。
- 用户说“定稿，跑成片”后，直接完成渲染、混音、QA 和交付，不再逐阶段请示；
  技术问题自行修复，最终给出路径、规格、QA 和未验证项。
- 混音固定口径：音床 volume 0.9、`amix normalize=0`、
  `loudnorm I=-16:TP=-1.5:LRA=11`、AAC 192k、`-ar 48000`、`-t 60`、视频流 copy。

## 配音硬性规则

- **所有旁白只用本机 GPT-SoVITS**，入口是 `tools\tts.cmd`：它用项目内
  `vendor\gpt-sovits\.venv` 运行 `tools\dabao_batch_tts.py`，转发到本机服务
  `vendor\gpt-sovits\tts_server.py`（127.0.0.1:9880）。
- **禁止**使用 HyperFrames 内置 TTS：`npx hyperframes tts`（Kokoro）、
  HeyGen、ElevenLabs、Gemini，或 `/media-use` 里的任何 TTS 路由。
  HyperFrames 只负责吃已经生成好的音频文件。
- 音色与参数已定稿为 **dabao 26E**，权威文件是项目内
  `vendor\gpt-sovits\tts_server.py` 的 `LOCKED`：cut1、speed 1.0、
  repetition_penalty 1.35、temperature 0.80、top_p 0.95、top_k 15、seed 666；
  ≤78 字分段、44.1 kHz 单声道、192 kbps mp3；段前 30 ms、段间 20 ms。
- 参考音频与逐字文本都在项目内 `vendor\gpt-sovits\`
  （`ref_dabao3-1.wav`，对应 `tts_server.py` 的 `PROMPT`）。换参考音频时必须
  同时换逐字文本并改 `PROMPT`；否则克隆会走样。若文件缺失，停下来向用户要资产，
  **不得**改换其他音色或退到云端 TTS。
- 引擎、v2 底模权重和运行时 FFmpeg 都在 `vendor\gpt-sovits\`，当前是底模 +
  参考音频的零样本克隆，没有 26E 微调权重。若拿到 26E 权重，改 `tts_server.py`
  的模型路径即可，客户端脚本不动。

用法：

```powershell
tools\tts.cmd --text-file content\<slug>\口播稿.txt --out output\<slug>\narration.mp3
```

读音修正写在 `tools\dabao_batch_tts.py` 的 `SPEAK_FIXES`（词组级替换，字幕仍用
原文）。`--force` 会跳过本次运行的段缓存重新合成；`--max-chars` 默认 78；
`--only N` 只合成第 N 段，调试用。

**文言/历史多音字按 `docs/读音规范.md` 固定**，尤其是「不战而降」的「降」读
xiáng（`SPEAK_FIXES` 里按词组替换成「祥」，字幕仍用原文「降」）。新专名先查证读音，
再进 `SPEAK_FIXES`。

定稿后一般不动采样。若确需实验，临时改 `tts_server.py` 的 `LOCKED` 并单独测时长，
选定后同步回去；不要直接改已生成的旁白。

先启动服务（**静默启动，不弹窗**）：

```powershell
wscript "D:\@kaifa\tushuo\vendor\gpt-sovits\start-tts-server.vbs"
```

脚本幂等（9880 已在监听就直接返回），CPU 加载约 1 分钟；就绪判据是
`GET http://127.0.0.1:9880/healthz` 返回 `{"ok": true}`，日志在
`vendor\gpt-sovits\tts_server.log`。**不要**用 `python.exe ... tts_server.py`、
`cmd /c start` 或 `Start-Process` 起这个服务 —— 那些方式会给它新分配一个控制台窗口，
桌面上就多一个标题是 pythonw.exe 全路径的黑框（2026-10-22 已修）。服务起来后再跑
`tools\tts.cmd`。合成时逐段缓存到
`output\<slug>\narration-chunks\`，并写同名 `.json` 记录每段文字、
时长和起止点。这份 `.json` 只做句级校对，词级字幕必须用下面的
`transcript.json`。

## 接入 HyperFrames 音频步骤

走 `faceless-explainer` 等流程时，到它的音频步骤（Step 3.1）**不要**执行
`audio.mjs` 的 TTS / `npx hyperframes tts`。改成：

1. 用 `tools\tts.cmd`（转发中央 `dabao_tts.cmd`）生成旁白（mp3 或 wav）。
2. 词级转写。本机没有 whisper.cpp，`npx hyperframes transcribe` 会直接失败；
   改用项目内 faster-whisper 封装（项目 venv + `vendor\faster-whisper-small` 模型，
   中文默认 `zh`）：

   ```powershell
   tools\transcribe_dabao.cmd --audio output\<slug>\narration.mp3 --out output\<slug>\transcript.json
   ```

   输出是扁平的 `[{id,text,start,end}]`，与 HyperFrames 的 `transcript.json` 同形。
   以后若装了 whisper.cpp，`npx hyperframes transcribe ...` 可作为替代。

3. 把旁白和词级转写登记进 composition 根目录的 `audio_meta.json`：

   ```powershell
   python tools\hf_audio_meta.py --hyperframes films\<slug> `
     --audio output\<slug>\narration.mp3 --words output\<slug>\transcript.json --frame-id 1
   ```

   生成的 `voices[]` 同时带 `id`、数字 `frame`（对应 STORYBOARD 的 Frame 编号）、
   `path`、`duration_s`、`words`，后续 `sync-durations`、`captions.mjs build`、
   `assemble-index.mjs` 可直接消费。已有 `bgm` / `sfx` 字段会保留；
   BGM/SFX 仍可按 media-use 的 host 方式登记。
   按帧配音时对每帧文本分别合成并用 `--frame-id N` 登记；单条通讲可登记到第 1 帧。
4. **不要**把 TTS 生成的 `<narration>.json` 当词级转写传给 `--words`：它是
   分段元数据（`chunks`），里面的时间只精确到句段，`hf_audio_meta.py` 会拒绝。
   句级校对可以用它，但字幕必须用 `transcript.json` 的词级时间；不要按字数平均分配。

## 目录

- **新片**：`films\<slug>\index.html`（HyperFrames composition，`data-start` /
  `data-duration` / `class="clip"`，动画必须可 seek）。一部片一个子目录。
- **配音**：`tools\tts.cmd`（转发中央 dabao）、`tools\transcribe_dabao.cmd`、
  `tools\transcribe_faster.py`、`tools\hf_audio_meta.py`。权威音色与参数在项目内
  `vendor\gpt-sovits\`（`tts_server.py` 的 `LOCKED` + `ref_dabao3-1.wav`）。
- **历史素材**：`content\`（事实底稿、分镜、口播稿）、`三国人物\`（人物原图）、
  `assets\`（主帅卡、地图、品牌）、`三国战役选题调研.md` 保留。
  旧 Canvas 图说管线（`src/`、旧 `tools/`、`index.html`）已删除，不要恢复。
- **文档**：`docs\制作管线.md`、`docs\读音规范.md`、`docs\资产来源与许可.md`；本片数据表在 `content\<slug>\成片数据.md`。
- `.hyperframes-src/` 是 HyperFrames 插件源，升级用，不要手改。

## 历史内容规范

史实优先；演义情节只能简短对照并明确标注。地名、兵力、路线的不确定性要在
画面或字幕里标出推定范围。写完口播稿先给用户审，再合成配音。
