# jianying 管线 · 20 分钟竖版纸雕剪影历史讲解片

- 建立日期：2026-10-21
- 来源：由 `docs/ditu-制作管线.md` 复制改造
- 基准形态：1080×1920 竖屏、30 fps、20 分钟级历史长片
- 视觉风格：**纸雕剪影（layered paper-cut silhouette）**
- 内容基底：抖音 150 分钟《一口气看完历史上422位皇帝》全量转写 → 重写 20 分钟口播

## 0. 与 ditu 的关系

ditu 管线的音频、字幕、混音、质检、封面、打包**整链沿用**，只改三处：

1. 片长与稿量：20 分钟级，口播去标点约 **6800–7200 字**；
2. 画面：HyperFrames 纸雕剪影视觉系统，每 **3–5 秒**一个分镜；
3. 配音停顿：更自然、更连贯，段内长静音压缩更狠，段间几乎不留空隙。

`tools/jianying/` 是 `tools/ditu/` 的复制品，接口完全一致；ditu 管线保持原样，
两条管线互不覆盖。

## 1. 交付硬指标

| 项 | 定稿值 |
|---|---|
| 画幅 / 帧率 | 1080×1920 / 30 fps |
| 片长 | 口播总长 + 片尾卡 5.4 s（20 分钟级约 1200–1260 s） |
| 分镜节奏 | 每 3–5 s 一个分镜，全片约 240–400 个 |
| 视频 | H.264，`-q high`，yuv420p |
| 音频 | AAC LC，48 kHz，立体声，320 kb/s |
| 口播电平 | −16.0 LUFS，真峰值 ≤ −1.5 dBFS |
| BGM 电平 | −34.0 LUFS |
| 成品电平 | 约 −15.9 LUFS，真峰值 −1.4 dBFS |
| 黑帧 | `blackdetect d=0.1 pix_th=0.10` 未检出 |
| 封面 | 2048×1536 与 1536×2048 各一张，六字金色毛笔标题由 Seedream 直接画入 |
| 发布信息 | 第一行标题 ≤25 字、两段式强钩子（问号/冒号/感叹号分隔），数字用阿拉伯数字；第二行恰好 4 个 `#话题` |

## 2. 目录

```
content/<slug>/          事实底稿.md、分镜与口播.md、口播稿.txt、
                         源文全量转写.txt、shots.json、cue-map.json、成片数据.md
content/<slug>/covers/   封面源图 jianying-4x3.jpg / jianying-3x4.jpg 与 prompt-4x3/3x4.txt
films/<slug>/            index.html（唯一 composition）、assets/（含 papercut.js）、vendor/
output/<slug>/           narration-vN.*、captions-vN.json、audio/、render/、review/
  audio/                 bgm bed、sfx/、soundtrack-vN.wav、mix-report.md
  render/                video-vN.mp4、render-vN.log、seg-*.mp4
  review/                contact sheet、关键帧、cue-vN.json、审阅说明
out/<NN 主题>/           最终交付：成片 + 两张封面 + 发布信息.txt + 源文件/
assets/bgm/              BGM 源曲
assets/maps/             备用地图素材
tools/jianying/          本管线脚本（与 tools/ditu 同接口）
docs/jianying-制作管线.md 本文件
```

素材归属同 ditu：源图、源音频、源数据、脚本一律在项目内；只有 FFmpeg / Python /
GPT-SoVITS / HyperFrames 这类运行时允许外部安装。

## 3. 内容规范（20 分钟）

- 先做源视频**全量转写**，保存 `content/<slug>/源文全量转写.txt`；改写必须覆盖源片
  的主线、关键人物、关键数字，不凭印象补史实。
- `事实底稿.md`：逐条列主张、来源、存疑边界；不确定的数字不写成定论。
- `口播稿.txt`：20 分钟主片去标点 **6800–7200 字**；开头 3 秒内抛钩子；
  按「总—分—总」立主线，不写皇帝流水账。
- 每 3–5 秒必须有一个可执行的画面动作（人物出场、地图推进、器物特写、战场冲击、
  数字对比、印章落下），写完口播后在 `shots.json` 里逐条落分镜。
- 定稿前过 `humanizer-zh` 与 `verification-before-completion`。

## 4. 纸雕剪影视觉系统

### 4.1 风格定义

画面像一座**多层纸雕舞台**：前后 5–7 层纸片，每层是硬边剪影，层与层之间有真实
投影；镜头在层间平移、推拉、轻微俯仰，形成纸雕景深。人物为侧身皮影式剪影，
关节可动；建筑、山川、军队、器物全部由纸片拼出，不做写实贴图。

### 4.2 固定色板

| 角色 | 色值 |
|---|---|
| 宣纸底 | `#efe6d2` |
| 暖纸阴影 | `#d9c9a8` |
| 墨黑剪影 | `#24211c` |
| 朱砂 | `#b33a2b` |
| 赭石 | `#9a6b3f` |
| 靛青 | `#2f4b57` |
| 旧金 | `#c9a24a` |

每场戏最多 3 个主色 + 纸底色；禁止高饱和霓虹色。

### 4.3 层结构（每个分镜必须齐）

1. **前景框**：深色纸雕边框/树枝/旗帜/屋脊，压住画面四角，提供纵深；
2. **动作层**：人物、军队、车马、器物，硬边剪影 + 关节动画；
3. **中景层**：城池、宫殿、山川、战场地形；
4. **远景层**：山脊、云、日轮、烟尘；
5. **天空/底纸**：宣纸纹理 + 缓慢移动的光斑；
6. **字层**：标题、数字、地名，宋体/楷体，纸片底托，不做花哨特效。

层间投影：`filter: drop-shadow(0 10px 18px rgba(36,33,28,.28))`；
纸纤维：SVG `feTurbulence` 低透明度叠加；边缘：`feDisplacementMap` 做毛边，
但幅度 ≤2px，保证剪影干净。

### 4.4 运镜

- 每个分镜 3–5 s，只做**一个连续运镜**：横移、推近、拉远、绕轴轻转、跟随人物；
- 用 `translate3d + scale + rotateX/rotateY` 在层容器上做，不同层给不同速度形成视差；
- 缓动统一 `power2.out` / `sine.inOut`，起幅落幅都要有，禁止线性硬推；
- 分镜之间优先用纸片擦除（torn-paper wipe）、纸页翻动、剪影遮挡转场；
  硬切只用于强调（鼓点、刀落、印落）。
- 全片至少每 60 s 有一次明显的景别变化（大远景 → 特写 → 中景），避免一个机位看到底。

### 4.5 动感细节

- 纸片轻微呼吸（±0.6% 缩放、±4px 位移，周期 6–9 s）；
- 人物行走/骑马用 2–3 帧循环的关节摆动（皮影步态），不追求写实；
- 烟尘、火星、雪、雨用纸屑粒子，数量 ≤40/层，避免糊屏；
- 光：一束暖光从左上扫过，`mix-blend-mode: screen`，每 8–12 s 一次；
- 字幕出现时，底部纸片轻抬 6px，字幕离去时落回。

### 4.6 HyperFrames 落地

- 唯一 composition：`films/<slug>/index.html`，根节点
  `data-width="1080" data-height="1920" data-fps="30" data-duration="<filmEnd>"`。
- 所有动画可 seek：GSAP 时间线 + `window.__timelines["<slug>"] = tl`；
  禁止 `onUpdate` 驱动逐帧画面。
- 分镜数据放 `content/<slug>/shots.json`，由 `assets/papercut.js` 展开成 DOM；
  每个 shot 至少含：`t0 / t1 / type / title / subtitle / camera / chars / props / sfx`。
- 可选增强：`npx hyperframes add torn-paper-rip`、`paper-collage-reveal`、
  `stop-motion-cadence`（纸片定格节奏）；只在转场/强调处用，不铺满全片。
- 审核口：`npx --yes hyperframes check` 必须 0 error；先抽 30–40 帧做联系表，
  宝哥点头后才全片渲染。

## 5. 配音（沿用 dabao，停顿更少）

```powershell
tools\tts.cmd --text-file content\<slug>\口播稿.txt --out output\<slug>\narration.mp3
```

- 音色与锁定参数同 ditu：dabao 26E、cut1、speed 1.0、repetition_penalty 1.35、
  temperature 0.80、top_p 0.95、top_k 15、seed 666；≤78 字分段。
- **停顿压紧（jianying 口径）**：段内长静音按 **0.65 倍**压缩、上限 **0.25 s**；
  段间 **10 ms**；目标听感是连贯朗读，不是逐句播报。

  ```bash
  PY="D:/@kaifa/tushuo/vendor/gpt-sovits/.venv/Scripts/python.exe"
  "$PY" tools/jianying/smooth_narration.py --raw-json output/<slug>/narration-v1.json \
    --chunks-dir output/<slug>/narration-chunks --out output/<slug>/narration-v1 \
    --pause-scale 0.65 --pause-cap 0.25 --pause-min 0.08 --gap-ms 10
  ```

  改完必须用 1 分钟样音试听。
- 多音字按 `docs/读音规范.md`；字幕保留原文，只改送合成文本。
- **读音审计（改 `SPEAK_FIXES` 后必跑）**：`tools/audit_pronunciation.py --slug <slug>`，
  与 TTS 同一条 G2P 路径（78 字分段 + 标点切句），逐条确认「实读」为目标读音；
  不要只测孤立词或整句（分段后可能变读）。
- **1 分钟样音审核**：从定稿口播稿开头连续取约 1 分钟（约 350–380 字），
  单独合成、压停顿、混 BGM 试听，宝哥点头后再配全片。

## 6. 字幕与时间轴（同 ditu）

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

- 每行口播 = 一个 chunk；字幕按标点切句、≤14 字、去标点，拼接必须与原文逐字一致。
- `cue-map.json` 用行号声明场景键；`shots.json` 的 `t0/t1` 必须落在字幕时间上，
  改稿后整链重算。

## 7. 音轨（同 ditu）

### 7.1 BGM 床

```bash
"$PY" tools/jianying/make_bgm_bed.py \
  --source "assets/bgm/二战 BGM_documentary.mp3" \
  --output output/<slug>/audio/bgm_bed.wav --duration <filmEnd>
```

### 7.2 混音

```bash
"$PY" tools/jianying/mix_audio.py --config output/<slug>/audio/mix-vN.json
```

- 口播 −16.0 LUFS；BGM −34.0 LUFS；总混音限幅 −1.5 dBFS；48 kHz 立体声。
- 音效锚点按当前版**口播行号**重排；20 分钟片建议 60–90 个锚点，
  开场 0.40 s「开场音效-咚」、片尾「钟声」；同一秒不叠两个大动态音效。

## 8. 渲染

```bash
cd "D:/@kaifa/tushuo/films/<slug>"
npx --yes hyperframes check
npx --yes hyperframes render -q high -w 3 \
  -o "D:/@kaifa/tushuo/output/<slug>/render/video-vN.mp4" \
  > "D:/@kaifa/tushuo/output/<slug>/render/render-vN.log" 2>&1
```

- 20 分钟 = **约 36000 帧**；基准片 305.955 s 用 3 workers 实测 1034 s，
  20 分钟预计数小时级，按机器实际情况排。
- 若单次渲染过长，按章节拆 composition 或用 `--variables` 分段渲染后无损拼接；
  分段边界必须落在纸片转场或黑场，音频最后统一混。
- 不要中途 kill；中断会留下缺 moov 的半截 mp4。
- 日志出现 `Render complete` 且体积稳定后再混音。

## 9. 合成与质检

```bash
ffmpeg -y -i output/<slug>/render/video-vN.mp4 -i output/<slug>/audio/soundtrack-vN.wav \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -ar 48000 -ac 2 \
  -t <filmEnd> -movflags +faststart output/<slug>/tushuo-<slug>-vN.mp4

"$PY" tools/jianying/qa_film.py --film <成片> --duration <filmEnd> \
  --cover-4x3 <封面-4比3.jpg> --cover-3x4 <封面-3比4.jpg>
```

- 另抽 10–14 帧核对：开场钩子、3 个代表性大场面、人物特写、数字卡、转场、
  片尾卡；确认没有穿帮、文字遮挡、人物重复。
- 非平凡改动必须跑独立 verification agent，PASS 才交付。

## 10. 封面与发布信息（同 ditu）

- 模型 `doubao-seedream-5-0-flash-260915`；脚本 `tools/jianying/make_covers.py`。
- 只有一个主标题，恰好 6 个汉字，金色毛笔行楷，由模型直接画进画面；
  不加副标题、不本地叠字、画面内无其它文字/字母/数字/logo/水印。
- 4:3 = 2048×1536，3:4 = 1536×2048；出图后放大标题区逐字核对。
- `发布信息.txt`：恰好两行。
  1. 第一行标题 **≤25 个字（含标点）**，**两段式**：前半句钩子 + 后半句具体后果/承诺，
     用问号、冒号或感叹号分隔；兵力/数量/年份用**阿拉伯数字**；要夺人眼球、利于点击。
  2. 第二行**恰好 4 个 `#话题`**，空格分隔。
  - 定稿示例（宝哥 2026-10-22 手改）：`华夏延续170万年！有10次差点灭亡`
- 打包器会硬校验标题长度与两段式分隔符；不合格直接拒绝交付。

## 11. 打包

```bash
"$PY" tools/jianying/package_delivery.py --job output/<slug>/delivery.json
```

脚本会校验：封面尺寸、成片存在，以及发布信息两行/4 话题、标题 ≤25 字且两段式并含阿拉伯数字。
不合格直接拒绝交付。

交付目录 `out/<NN 主题>/` 顶层只留 4 个文件 + `源文件/`：

1. `tushuo-<slug>.mp4`
2. `封面-4比3.jpg`
3. `封面-3比4.jpg`
4. `发布信息.txt`

## 12. 审核节点（宝哥定）

1. **口播稿审核**：先交完整口播稿 + 分镜节奏说明，批准后才配音；
2. **1 分钟配音审核**：批准后才配全片；
3. **5 个代表性分镜抽帧审核**：从完整口播稿中选 5 个最有冲击力的分镜，
   只渲染这 5 个镜头并抽帧，**不跑样片**；批准后才铺全片；
4. 成片全片渲染 → 质检 → 打包。

## 13. 踩坑

- 20 分钟片稿量是 5 分钟片的 4 倍，**不要直接拉长句子**；按信息密度重排结构。
- 3–5 秒一个分镜意味着 240–400 个 shot，`shots.json` 必须先过 schema 校验，
  再进 `papercut.js`；缺字段直接报错，不静默用默认值。
- 纸雕层数多，避免每层都用大面积 `filter: blur`；投影用 `drop-shadow`，
  纸纹用一张可复用的 SVG data URI，不要每帧重绘。
- 全片渲染时间长，分段渲染的边界要落在转场/黑场，拼接后核对总帧数。
- `audio_meta.json` 可能落后于新配音；以 `index.html` 的 `<audio data-duration>`
  和实际 mp3 时长为准。
- 口播 mp3 与 wav 有 2–3 ms 差异；composition 以 mp3 为准。
