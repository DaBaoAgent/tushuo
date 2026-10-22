# ditu 管线 · 5 分钟竖版历史讲解片（定稿 v1.0）

- 定稿日期：2026-10-21
- 基准片：`mongol-west-1-5min` v3《蒙古第一次西征》（305.955 s）
- 适用范围：tushuo 的 **5 分钟级、1080×1920 竖屏**历史讲解片。
  60 秒基准片仍走 `docs/制作管线.md` 与 `/tushuo-history-video`。
- 配套技能：`.claude/skills/ditu/SKILL.md`（`/ditu`）
- 定稿数据：`content/mongol-west-1-5min/成片数据.md`

## 0. 交付硬指标

| 项 | 定稿值 |
|---|---|
| 画幅 / 帧率 | 1080×1920 / 30 fps |
| 片长 | 口播总长 + 片尾卡 5.4 s（基准片 300.555 + 5.400 = 305.955 s） |
| 视频 | H.264，`-q high`，yuv420p |
| 音频 | AAC LC，48 kHz，立体声，320 kb/s |
| 口播电平 | −16.0 LUFS，真峰值 ≤ −1.5 dBFS |
| BGM 电平 | **−34.0 LUFS**（2026-10-21 宝哥定：在原 −32 基础上再轻 20%） |
| 成品电平 | 约 −15.9 LUFS，真峰值 −1.4 dBFS |
| 黑帧 | `blackdetect d=0.1 pix_th=0.10` 未检出 |
| 封面 | 2048×1536 与 1536×2048 各一张，六字金色毛笔标题由 Seedream 直接画入 |
| 发布信息 | 第一行标题 ≤25 字、两段式强钩子（问号/冒号/感叹号分隔），数字用阿拉伯数字；第二行恰好 4 个 `#话题` |

## 1. 目录

```
content/<slug>/          事实底稿.md、分镜与口播.md、口播稿.txt、cue-map.json、成片数据.md
content/<slug>/covers/   封面源图 ditu-4x3.jpg / ditu-3x4.jpg 与 prompt-4x3/3x4.txt
films/<slug>/            index.html（唯一 composition）、assets/、vendor/、audio_meta.json
output/<slug>/           narration-vN.*、captions-vN.json、audio/、render/、review/
  audio/                 bgm bed、sfx/ 预处理音效、soundtrack-vN.wav、mix-report.md
  render/                video-vN.mp4、render-vN.log
  review/                contact sheet、关键帧、cue-vN.json、审阅说明
out/<NN 主题>/           最终交付：成片 + 两张封面 + 发布信息.txt + 源文件/
assets/bgm/              BGM 源曲（二战 BGM_documentary.mp3）
assets/                  其他共享素材（maps / commanders / brand / voice 参考）
tools/ditu/              本管线脚本（smooth_narration / build_captions / splice_film /
                         mix_audio / make_bgm_bed / make_covers / qa_film / package_delivery）
docs/ditu-制作管线.md    本文件
```

**素材归属**：管线的源图、源音频、源数据、脚本一律放在本项目内，不引用
`aiyouhu`、`自动剪辑` 等外部目录；只有 FFmpeg / Python / GPT-SoVITS 引擎这类
运行时可执行程序允许外部安装。

一部片一个 slug；交付目录用中文编号主题（如 `out/1 蒙古第一次西征`），不覆盖旧片。

## 2. 内容

- `事实底稿.md`：逐条列主张、来源、存疑边界；不确定的数字不写成定论。
- `分镜与口播.md`：时间码、画面、旁白、字幕、证据卡、不确定性标注。
- `口播稿.txt`：5 分钟主片约 **1700–1800 字**（基准片 1750 字 / 116 行 / 300.555 s）。
- 写推演少写形容词：几条路、每一步的代价、粮与兵力的账、换一条路会怎样。
- 定稿前过 `humanizer-zh` 与 `verification-before-completion`。

## 3. 配音（dabao）

```powershell
tools\tts.cmd --text-file content\<slug>\口播稿.txt --out output\<slug>\narration.mp3
```

- 音色源数据与锁定参数都在项目内：参考音频 `vendor/gpt-sovits/ref_dabao3-1.wav`，
  服务脚本 `vendor/gpt-sovits/tts_server.py`（`LOCKED`），入口 `tools/tts.cmd` →
  `tools/dabao_batch_tts.py`；引擎、v2 底模与 venv 同在 `vendor/gpt-sovits/`，
  不依赖项目外目录。只用本机 GPT-SoVITS，**禁止** HyperFrames 内置 TTS。
- 定稿参数：cut1、speed 1.0、repetition_penalty 1.35、temperature 0.80、
  top_p 0.95、top_k 15、seed 666；≤78 字分段、6.2 字/秒截断守卫、
  44.1 kHz 单声道 mp3 192k。
- 停顿压紧：段内长静音按 0.75 倍压缩、上限 0.35 s；段间 12 ms；整体约缩短 13 s。

  ```bash
  PY="D:/@kaifa/tushuo/vendor/gpt-sovits/.venv/Scripts/python.exe"
  "$PY" tools/ditu/smooth_narration.py --raw-json output/<slug>/narration-v1.json \
    --chunks-dir output/<slug>/narration-chunks --out output/<slug>/narration-v1
  ```

  输出 `<out>.json/.wav/.mp3`（段级时间码已回写），原始 JSON 另存 `<out>-raw.json`。
- 多音字按 `docs/读音规范.md`；字幕保留原文，只改送合成文本。
- **读音审计（改 `SPEAK_FIXES` 后必跑）**：`tools/audit_pronunciation.py --slug <slug>`，
  与 TTS 同一条 G2P 路径（78 字分段 + 标点切句），逐条确认「实读」为目标读音；
  不要只测孤立词或整句（分段后可能变读）。

## 4. 字幕与时间轴

- 用 `tools/transcribe_dabao.cmd` 做词级转写，但字幕文字必须对齐回口播稿原文。
- **行号驱动**：每行口播 = 一个 chunk，字幕按标点切句、≤14 字、去标点，
  拼接后必须与原文逐字一致（`tools/ditu/build_captions.py` 硬校验）。

  ```bash
  "$PY" tools/ditu/build_captions.py --script content/<slug>/口播稿.txt \
    --narration-json output/<slug>/narration-v1.json --out-dir output/<slug>/review \
    --variation v1 --cue-map content/<slug>/cue-map.json \
    --js-prefix output/<slug>/review/_v1
  ```

- `cue-map.json` 用行号声明场景键（默认取行起点，`"edge": "end"` 取终点）；
  `_filmEndOffset` 默认 5.4 s。`cue-vN.json` 的 `total/filmEnd` 自动算出。
- 拼进 composition（CAPS、CUE、根节点与 `<audio id="vo">` 的 data-duration）：

  ```bash
  "$PY" tools/ditu/splice_film.py --html films/<slug>/index.html \
    --caps-js output/<slug>/review/_v1-caps.js --cue-js output/<slug>/review/_v1-cue.js \
    --cue-json output/<slug>/review/cue-v1.json \
    --voice-src output/<slug>/narration-v1.mp3 --voice-dest films/<slug>/assets/voice/narration.mp3 \
    --backup-dir output/<slug>/_backup-v1
  ```

  `--timeline-js` 可选，用于整块替换 `buildTimeline()`；不传则只换字幕与时码。
  基准片最终时间线另存 `output/<slug>/review/timeline-vN.js`（改时间线时从这里改）。
- 三个工具均已用 v3 实测：`build_captions.py` 生成的 captions/cue 与定稿逐字节一致，
  `smooth_narration.py` 复现 300.553 s 与全部段级时码，`splice_film.py` 重放后
  `index.html` 逐字节不变。
- 改稿后必须重跑：字幕 → CUE → 音效锚点 → 片长 → 音轨 → 渲染。

## 5. 画面（HyperFrames）

- `films/<slug>/index.html` 是唯一 composition；根节点
  `data-width="1080" data-height="1920" data-fps="30" data-duration="<filmEnd>"`。
- 动画全部可 seek：路线用路径采样 + `tl.to(el,{x,y})`；不要用 `onUpdate` 驱动逐帧画面。
- 基准片画面结构：开场印章/钩子 → 千户网格 → 商队 → 证据卡 → 三封国书 → 山顶祈祷
  （全屏底图）→ 补给线 → 备战账 → 围讹答剌 → 熔银 → 克孜勒库姆沙漠 → 布哈拉清真寺
  （全屏底图）→ 撒马尔罕/玉龙杰赤 → 里海 → 八鲁湾 → 印度河 → 结论三卡 → 片尾。
- 两张暗场全屏底图播放时隐藏章节条、顶部信息与地图注记，避免深底上文字发灰。
- 审核口：`npx --yes hyperframes check` 必须 0 error；抽 30–40 帧做联系表，
  用户点头后才全片渲染。

## 6. 渲染（Windows）

```bash
cd "D:/@kaifa/tushuo/films/<slug>"
npx --yes hyperframes render -q high -o "D:/@kaifa/tushuo/output/<slug>/render/video-vN.mp4" \
  > "D:/@kaifa/tushuo/output/<slug>/render/render-vN.log" 2>&1
```

- 基准片 305.955 s = **9179 帧**，3 workers，实测 1034 s（约 17 分钟）。
- 不要中途 kill；中断会留下缺 moov 的半截 mp4。
- 日志末尾出现 `Render complete` 且 `video-vN.mp4` 体积稳定后再进入混音。

## 7. 音轨（ditu 固定口径）

### 7.1 BGM 床

```bash
PY="D:/@kaifa/tushuo/vendor/gpt-sovits/.venv/Scripts/python.exe"
"$PY" tools/ditu/make_bgm_bed.py \
  --source "assets/bgm/二战 BGM_documentary.mp3" \
  --output output/<slug>/audio/bgm_bed.wav --duration <filmEnd>
```

- 4 s 三角交叉淡化循环；第 2 段起从 5 s 切入；`acompressor=threshold=-20dB:ratio=2:attack=25:release=500`；
  2 s 淡入、尾 3.5 s 淡出。
- 电平不在床里归一，统一交给混音器。

### 7.2 混音

```bash
"$PY" tools/ditu/mix_audio.py --config output/<slug>/audio/mix-vN.json
```

配置（`mix-vN.json`）字段（基准片同 schema，文件名为 `audio/bgm_v3.json`）：

```json
{
  "narration": ".../narration-vN.wav",
  "bgm": ".../audio/bgm_bed_vN.wav",
  "sfx_dir": ".../audio/sfx",
  "total": 305.955,
  "narration_target_lufs": -16.0,
  "bgm_target_lufs": -34.0,
  "voice_peak_limit": 0.8414,
  "mix_peak_limit": 0.8414,
  "output": ".../audio/soundtrack-vN.wav",
  "sfx": [{"t": 0.40, "file": "01-开场音效-咚.wav"}]
}
```

- 口播：单声道复制双声道 → 迭代校准到 −16.0 LUFS → 限幅 −1.5 dBFS。
- BGM：按实测积分响度反推增益到 **−34.0 LUFS**。
  「再轻 20%」= 振幅 ×0.8 = −1.94 dB；原 −32 → **−34**。
- 音效：26 个锚点，按 **v3 行号/场景**重排；素材取自 `音效/`，预处理为
  去开头静音 + 截 2 s + 30 ms 淡入 + 250 ms 淡出 + 分类 RMS 对齐。
- 总混音 `amix normalize=0` → `atrim` 到片长 → `alimiter` −1.5 dBFS。
- 输出 48 kHz 立体声 pcm_s24le；另出 320k mp3。

### 7.3 音效锚点规则

- 每个锚点必须落在口播真正说到该场景的那一行上（±0.2 s 内），写在 `mix-vN.json`。
- 开场 0.40 s 用「开场音效-咚」；收束用「开场大气音效」；片尾卡用「钟声」。
- 同一秒不要叠两个大动态音效；水声/风声等 ambient 可以垫在台词下。

## 8. 合成

```bash
ffmpeg -y -i output/<slug>/render/video-vN.mp4 -i output/<slug>/audio/soundtrack-vN.wav \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -ar 48000 -ac 2 \
  -t <filmEnd> -movflags +faststart output/<slug>/tushuo-<slug>-vN.mp4
```

- 视频流 copy，只重编码音频；`-t` 固定片长。

## 9. 质检

```bash
"$PY" tools/ditu/qa_film.py --film <成片> --duration <filmEnd> \
  --cover-4x3 <封面-4比3.jpg> --cover-3x4 <封面-3比4.jpg>
```

- 规格、帧数、全片解码、黑帧、响度/峰值、封面尺寸一次过。
- 另抽 6–10 帧核对：开场 0–4 s、两张暗场底图、围城、印度河、结论卡、片尾。
- 非平凡改动必须跑独立 verification agent，PASS 才交付。

## 10. 封面与发布信息

- 模型：`doubao-seedream-5-0-flash-260915`（火山方舟）。项目内脚本
  `tools/ditu/make_covers.py`（纯标准库），配置读项目根 `.env` 的
  `IMG_BASE_URL / IMG_MODEL / IMG_API_KEY`；`.env` 已 gitignore。
- 生成命令（输出强制落在项目内）：

  ```bash
  PY="D:/@kaifa/tushuo/vendor/gpt-sovits/.venv/Scripts/python.exe"
  "$PY" tools/ditu/make_covers.py --prompt-file content/<slug>/covers/prompt-4x3.txt \
    --size 2048x1536 --out content/<slug>/covers/<slug>-4x3.jpg
  "$PY" tools/ditu/make_covers.py --prompt-file content/<slug>/covers/prompt-3x4.txt \
    --size 1536x2048 --out content/<slug>/covers/<slug>-3x4.jpg
  ```

- **源图只存项目内**：`content/<slug>/covers/`；交付时由打包器复制成
  `封面-4比3.jpg` / `封面-3比4.jpg`，`源文件/` 放同一份源图。
- **只有一个主标题，恰好 6 个汉字**，金色毛笔行楷，由模型直接画进画面；
  不加副标题、不本地叠字、画面内无其它文字/字母/数字/logo/水印。
- 基准片标题：`成吉思汗西征`。
- 出图后放大标题区逐字核对；错字/多字/少字/缺笔重出。
- 尺寸：4:3 = 2048×1536，3:4 = 1536×2048（JPG）。
- `发布信息.txt`：恰好两行。
  1. 第一行标题 **≤25 个字（含标点）**，**两段式**：前半句钩子 + 后半句具体后果/承诺，
     用问号、冒号或感叹号分隔；兵力/数量/年份用**阿拉伯数字**；要夺人眼球、利于点击。
  2. 第二行**恰好 4 个 `#话题`**，空格分隔。
  - 定稿示例（宝哥 2026-10-22 手改）：`华夏延续170万年！有10次差点灭亡`
- 打包器会硬校验标题长度与两段式分隔符；不合格直接拒绝交付。

## 11. 打包

```bash
"$PY" tools/ditu/package_delivery.py --job output/<slug>/delivery.json
```

job 指定 `out_dir`、成片、两张封面、发布信息与 `源文件` 清单。脚本会校验：
封面尺寸、成片存在，以及发布信息两行/4 话题、标题 ≤25 字且两段式并含阿拉伯数字。

交付目录顶层只留 4 个文件 + `源文件/`：

1. `tushuo-<slug>.mp4`
2. `封面-4比3.jpg`
3. `封面-3比4.jpg`
4. `发布信息.txt`
- `源文件/`：文稿三件套、narration、captions、soundtrack、bgm 床、音效配置、
  封面源图、封面提示词、封面说明、混音报告。

## 12. 基准片数据（mongol-west-1-5min v3）

| 项 | 值 |
|---|---|
| 口播 | 116 行 / 1750 字 / 300.555 s |
| 成片 | composition 305.955 s；9179 帧，容器 305.967 s |
| 规格 | 1080×1920 / 30 fps / H.264 High / AAC 48 kHz 立体声 |
| 字幕 | 267 条，单条 ≤14 字 |
| 音效 | 26 个锚点 |
| BGM | −34.0 LUFS（原 −32 再轻 20%） |
| 成品 | 约 −15.9 LUFS / −1.4 dBFS / LRA 2.0 |
| 渲染 | `npx hyperframes render -q high`，3 workers，实测 1034 s |
| 成片 SHA256 | `514fba463c25464b56245d033193424bcf91e5f325d01eb3dee6e7c343cce6e6` |

## 13. 踩坑

- **改稿必须整链重跑**：字幕 → CUE → 音效锚点 → 片长 → 音轨 → 渲染。只改音轨会错位。
- **`audio_meta.json` 可能落后于新配音**：以 `index.html` 的 `<audio data-duration>` 和
  实际 mp3 时长为准；渲染前用 ffprobe 核对。
- **口播 mp3 与 wav 有 2–3 ms 差异**：以 mp3 时长为准（composition 吃 mp3）。
- **BGM「轻 20%」是振幅比例，不是 LUFS 减 20**：用 `20*log10(0.8) ≈ −1.94 dB`。
- **音效锚点按行号，不按旧版秒数**：v3 比 v2 短 10 秒，旧锚点直接用会整体前移/错位。
- **封面六字**：成吉思汗西征，逐字核对；多一字少一字都重出。
- **交付结构**：`out/<NN 主题>/` 顶层只 4 个文件 + `源文件/`，不要塞分段/预览/抽帧。
