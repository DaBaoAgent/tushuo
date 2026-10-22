# jianying 管线 · 20 分钟横版纸雕剪影历史讲解片

- 建立日期：2026-10-21
- 定稿日期：2026-10-23（《两千年422位皇帝》全片交付，参数以本片实测为准）
- 来源：由 `docs/ditu-制作管线.md` 复制改造
- 基准形态：**1920×1080 横屏、30 fps、20 分钟级历史长片**
- 视觉风格：**纸雕剪影（layered paper-cut silhouette）**
- 内容基底：抖音 150 分钟《一口气看完历史上422位皇帝》全量转写 → 重写 22 分钟口播
- 定稿基准片：`out/3 两千年422位皇帝/tushuo-china-emperors-20min.mp4`
  （1326.938 s / 39809 帧 / 370 分镜 / 869 条字幕 / −15.8 LUFS / 真峰 −1.3 dBFS）

## 0. 与 ditu 的关系

ditu 管线的音频、混音、质检、封面、打包**整链沿用**，主要改三处：

1. 片长与稿量：20 分钟级，口播去标点约 **7400–7500 字**（定稿 7465 字）；
2. 画面：**1920×1080 横屏** HyperFrames 纸雕剪影视觉系统，每 **3–5 秒**一个分镜；
3. 配音停顿：更自然、更连贯，段内长静音压缩更狠，段间几乎不留空隙。

`tools/jianying/` 是 `tools/ditu/` 的复制品，接口完全一致；ditu 管线保持原样，
两条管线互不覆盖。

## 1. 交付硬指标

| 项 | 定稿值（2026-10-23 实测） |
|---|---|
| 画幅 / 帧率 | **1920×1080 / 30 fps** |
| 片长 | 口播总长 + 片尾卡 5.4 s（总尾长 6.0 s）；定稿 1326.938 s（22:06.94），39809 帧 |
| 稿量 | 口播去标点 7400–7500 字（定稿 7465 字 / 370 段） |
| 分镜节奏 | 每 3–5 s 一个分镜，全片 330–400 个；定稿 370 个（均值 3.582 s、中位 3.594 s，330/370 在 3–5 s） |
| 字幕 | ≤16 字/条、去标点（保留《》）；52 px / 900 字重 / 微软雅黑 / 白字黑描边；底边 44 px；定稿 869 条 |
| 视频 | H.264 **High**，`-q high`，yuv420p，+faststart |
| 音频 | AAC LC，48 kHz，立体声，320 kb/s |
| 口播电平 | −16.0 LUFS，真峰值 ≤ −1.5 dBFS（实测 −16.1 / −1.4） |
| BGM 电平 | −34.0 LUFS |
| 混音限幅 | `alimiter=limit=0.8414`（−1.5 dBFS） |
| 成品电平 | −15.8 LUFS，真峰值 −1.3 dBFS，LRA 2.1 LU |
| 音效 | 178 个锚点（定稿）；开场 0.00 重击 / 0.12 鼓点 / 1.00 钟声 |
| 黑帧 | `blackdetect d=0.1 pix_th=0.10` 未检出 |
| 封面 | 2048×1536 与 1536×2048 各一张，六字金色毛笔标题由 Seedream 直接画入 |
| 发布信息 | 第一行标题 ≤25 字、两段式强钩子（问号/冒号/感叹号分隔），数字用阿拉伯数字；第二行恰好 4 个 `#话题` |

## 2. 目录

```
content/<slug>/          事实底稿.md、分镜与口播.md、口播稿.txt、
                         源文全量转写.txt、director_full.py、shots-full.json、
                         build_full_film.py、build_sfx.py、make_qa.py
content/<slug>/covers/   封面源图 jianying-4x3.jpg / jianying-3x4.jpg 与 prompt-4x3/3x4.txt
films/<slug>/            index.html（唯一 composition）、assets/（含 papercut.js）、vendor/
  renders/               HyperFrames 分段缓存（.hf-segments），交付后删
output/<slug>/           narration.*、narration-smooth.*、captions-full.json、audio/、
                         picture-render.mp4、render-full.log、build/、delivery-staging/
  audio/                 sfx/、sfx-plan.json、bgm_bed.wav、soundtrack.wav、mix-full.json、
                         mix-report.md
out/<NN 主题>/           最终交付：成片 + 两张封面 + 发布信息.txt + 源文件/
                         （2026-10-23 宝哥定：交付只放 out/，不放 output/ 下）
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
- `口播稿.txt`：20 分钟主片去标点 **7400–7500 字**（定稿 7465 字，22:06.94）；
  开头 3 秒内抛钩子；按「总—分—总」立主线，不写皇帝流水账。
- 每 3–5 秒必须有一个可执行的画面动作（人物出场、地图推进、器物特写、战场冲击、
  数字对比、印章落下），写完口播后在 `shots-full.json` 里逐条落分镜（定稿 370 个）。
- **时码约定**：`t0_i = 该句起点 − 0.02`、`t1_i = 下一句起点 − 0.01`（相邻镜留 10 ms 重叠，
  防止取整露黑）；末镜 `t1 = 片尾卡起点 = filmEnd − 5.4`；`filmEnd = 口播结尾 + 6.0`。
- 分镜节奏分布允许少量刻意插入：定稿 38 个 <2.5 s 快切、1 个 6.04 s 定帧，
  其余 330 个落在 3–5 s；不要为了卡 3–5 s 把有信息量的镜头硬拆碎。
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
- 每镜在 `shots-full.json` 写 `camera.from / camera.to`（x/y/scale/rot），渲染时走**两段式**：
  0→58% 用 `power1.inOut` 到中点，58%→100% 用 `sine.inOut` 收束；**缩放走对数空间**
  （`exp(log(a)*(1-r)+log(b)*r)`），避免速度突变；默认 `scale` 1.02→1.10；
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
  `data-width="1920" data-height="1080" data-fps="30" data-duration="<filmEnd>"`。
  **横版是定稿口径**；改画幅时必须同步改 `data-width/data-height`，并用
  `ffprobe` 确认成片不是竖版（2026-10-22 曾因正则误删根属性被渲染成 1080×1920）。
- 所有动画可 seek：GSAP 时间线 + `window.__timelines["<slug>"] = tl`；
  禁止 `onUpdate` 驱动逐帧画面。
- 分镜数据由 `build_full_film.py` 注入 `index.html` 的三个常量：
  `SHOTS`（370 个，来自 `shots-full.json`）、`CAPS`（869 条，来自 `captions-full.json`）、
  `CUE`（`{total: filmEnd-5.4, filmEnd}`）；每个 shot 至少含：
  `t0 / t1 / type / title / subtitle / camera / chars / props / layers`。
- 片尾：`endAt = total - 5.4`，0.7 s 淡出舞台与字幕，0.15 s 起片尾卡淡入；
  末镜必须结束在 `endAt`，否则片尾卡会被最后一镜盖住。
- 开场：首镜 `hook=true`，1 秒抖动（`a = 14*(1-v)^1.6`，11/7.3 Hz 双频），`v>=1` 归零。
- **注入脚本两个坑**：改根属性只能用正则替换 `data-duration` 的值，不能整段重写
  `<div id="root">`；`const CUE = {...};` 在首次注入后是单行，块查找必须用 `";\n"`，
  不能用 `"\n};"`（否则 `ValueError: substring not found`）。
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
- **停顿压紧（定稿口径）**：段内长静音按 **0.75 倍**压缩、上限 **0.35 s**、下限 **0.10 s**；
  段间 **12 ms**、段首留 **18 ms**；目标听感是连贯朗读，不是逐句播报。
  定稿实测 `1376.488 s → 1320.930 s`，省 **55.6 s**（约 4%），全片 22 分钟不显拖。

  ```bash
  PY="D:/@kaifa/tushuo/vendor/gpt-sovits/.venv/Scripts/python.exe"
  "$PY" tools/jianying/smooth_narration.py --raw-json output/<slug>/narration.json \
    --chunks-dir output/<slug>/narration-chunks --out output/<slug>/narration-smooth \
    --pause-scale 0.75 --pause-cap 0.35 --pause-min 0.10 --gap-ms 12 --lead-ms 18
  ```

  压完输出 `narration-smooth.mp3 / .json / .wav`，**后续字幕与分镜一律以 smooth 的
  json 为准**；改完必须用 1 分钟样音试听。
- 多音字按 `docs/读音规范.md`；字幕保留原文，只改送合成文本。
- **读音审计（改 `SPEAK_FIXES` 后必跑）**：`tools/audit_pronunciation.py --slug <slug>`，
  与 TTS 同一条 G2P 路径（78 字分段 + 标点切句），逐条确认「实读」为目标读音；
  不要只测孤立词或整句（分段后可能变读）。
- **1 分钟样音审核**：从定稿口播稿开头连续取约 1 分钟（约 350–380 字），
  单独合成、压停顿、混 BGM 试听，宝哥点头后再配全片。

## 6. 字幕与时间轴（定稿：build_full_film 一步注入）

```bash
"$PY" content/<slug>/build_full_film.py \
  --timing output/<slug>/narration-smooth.json --compose
```

- 旧的 `build_captions.py + splice_film.py + cue-map.json` 流程只适用于早期
  `shots.json` 短片；20 分钟长片一律用 `build_full_film.py`（同时生成
  `shots-full.json`、`captions-full.json` 并注入 composition）。

- 每行口播 = 一个 chunk；字幕按标点切句、**≤16 字**、去标点（只保留《》），
  拼接必须与原文逐字一致（定稿 869 条）。
- 字幕样式定稿：**52 px / font-weight 900 / "Microsoft YaHei" / 白色**，
  `text-shadow` 做黑色外描边（不用 `-webkit-text-stroke`，居中描边会盖住字芯）；
  容器距底 44 px、高 110 px、`white-space: nowrap`。
- 注入内容：读 `narration-smooth.json` 的 370 段生成 `shots-full.json`，
  按标点切字幕写 `build/captions-full.json`，再把 `SHOTS/CAPS/CUE` 与
  `data-duration` 写进 `index.html`；改稿/改配音后必须重跑，
  `build_sfx.py` 的锚点也依赖 `shots-full.json`。

## 7. 音轨（BGM/混音同 ditu，音效按分镜自动铺）

### 7.1 BGM 床

```bash
"$PY" tools/jianying/make_bgm_bed.py \
  --source "assets/bgm/二战 BGM_documentary.mp3" \
  --output output/<slug>/audio/bgm_bed.wav --duration <filmEnd>
```

### 7.2 混音

```bash
"$PY" tools/jianying/mix_audio.py --config output/<slug>/audio/mix-full.json
```

- 口播 −16.0 LUFS；BGM −34.0 LUFS；总混音限幅 −1.5 dBFS；48 kHz 立体声。
- 音效锚点用 `content/<slug>/build_sfx.py` 按**分镜类型**自动铺，不要手点：
  每类场景一个素材池 + 冷却时间（battle 10 s / fire 12 s / water 12 s / wind 18 s /
  horse 13 s / gong 32 s / gate 22 s / market 24 s / blade 16 s / horn 26 s），
  同类冷却期内不重复，任意两条锚点间隔 ≥1.2 s；幕标题卡单独上号角。
- 定稿 **178 个锚点**（20 分钟级 170–190 个）：开场 `0.00` 重击、`0.12` 鼓点、
  `1.00` 钟声；末锚 `1296.08` 钟声；同一秒不叠两个大动态音效。
- 输出 `audio/sfx-plan.json`（锚点清单）与 `audio/mix-full.json`（混音配置），
  再跑 `tools/jianying/mix_audio.py --config output/<slug>/audio/mix-full.json`。

## 8. 渲染

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

- **定稿基准**：39809 帧（22:06.94），8 workers + 硬编，**63 分 21 秒**跑完；
  30 秒样片实测 capture ≈ 10.3 fps。20 分钟级按 60–75 分钟排。
- `HF_SEGMENTED_CAPTURE=true` 是长片必开：每 3000 帧落一个
  `films/<slug>/renders/.hf-segments/<hash>/segment_XXXXX.mp4`，中断后加 `--resume`
  只补未完成段；`--keep-segments` 保留缓存供续渲。交付后删 `renders/` 与 `.hyperframes/`。
- 不要手动拆 composition 分段再拼——分段捕获已经解决；手动拆反而会在边界跳帧。
- 不要中途 kill；确实中断后用 `--resume` 续渲，缺 moov 的产物直接删掉重跑。
- 日志出现 `Render complete` 且 mp4 体积稳定后再合音频；合音频用 `-c:v copy`，
  帧数必须仍是 39809（`ffprobe -count_packets` 核对）。

## 9. 合成与质检

```bash
ffmpeg -y -i output/<slug>/picture-render.mp4 -i output/<slug>/audio/soundtrack.wav \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -ar 48000 -ac 2 \
  -t <filmEnd> -movflags +faststart output/<slug>/tushuo-<slug>.mp4

"$PY" tools/jianying/qa_film.py --film <成片> --duration <filmEnd> \
  --width 1920 --height 1080 \
  --cover-4x3 <封面-4比3.jpg> --cover-3x4 <封面-3比4.jpg>
```

- 门禁（定稿实测值）：
  - `ffprobe`：h264 High / 1920×1080 / 30 fps / 39809 帧 / AAC 48k 2ch / +faststart；
  - 全片解码 `ffmpeg -v error -xerror -i <成片> -f null -` 退出码 0；
    `-count_packets` 视频包 = 39809；
  - `ebur128`：I ≈ −15.8 LUFS（−16.5～−15.5 可接受），真峰 −1.3 dBFS（门禁 −3～−0.3）；
  - `blackdetect d=0.1 pix_th=0.10` 无黑帧；片尾 5.4 s 是片尾卡（亮场，不是黑场）；
  - 字幕拼接与口播稿去标点后逐字一致；字幕 ≤16 字、52 px、不被片尾卡/人物卡遮挡。
- 另抽 10–14 帧核对：开场钩子、3 个代表性大场面、人物特写、数字卡、转场、
  片尾卡；确认没有穿帮、文字遮挡、人物重复。
- 非平凡改动必须跑独立 verification agent，PASS 才交付；核验要贴命令与输出，
  不接受「应该」「大概」。

## 10. 封面与发布信息（同 ditu）

- 模型 `doubao-seedream-5-0-flash-260915`；脚本 `tools/jianying/make_covers.py`。
- 只有一个主标题，恰好 6 个汉字，金色毛笔行楷，由模型直接画进画面；
  不加副标题、不本地叠字、画面内无其它文字/字母/数字/logo/水印。
- 定稿示例：`四百二十二帝`；4:3 皇帝端坐龙椅剪影 + 左秦俑右紫禁城，
  3:4 皇帝背对镜头剪影 + 纵向层叠宫阙。
- 4:3 = 2048×1536，3:4 = 1536×2048；出图后放大标题区逐字核对（六字笔画完整、
  无多字少字）；AI 出正脸清晰人像的版本与剪影风格不符，弃用重出。
- `发布信息.txt`：恰好两行。
  1. 第一行标题 **≤25 个字（含标点）**，**两段式**：前半句钩子 + 后半句具体后果/承诺，
     用问号、冒号或感叹号分隔；兵力/数量/年份用**阿拉伯数字**；要夺人眼球、利于点击。
  2. 第二行**恰好 4 个 `#话题`**，空格分隔。
  - 定稿示例（宝哥 2026-10-22 手改）：`华夏延续170万年！有10次差点灭亡`
- 打包器会硬校验标题长度与两段式分隔符；不合格直接拒绝交付。

## 11. 打包

```bash
"$PY" tools/jianying/package_delivery.py --job output/<slug>/delivery-staging/delivery.json
```

脚本会校验：封面尺寸、成片存在，以及发布信息两行/4 话题、标题 ≤25 字且两段式并含阿拉伯数字。
不合格直接拒绝交付。

交付目录 **`D:\@kaifa\tushuo\out\<NN 主题>\`**（2026-10-23 宝哥定，编号递增）顶层只留
4 个文件 + `源文件/`：

1. `tushuo-<slug>.mp4`
2. `封面-4比3.jpg`
3. `封面-3比4.jpg`
4. `发布信息.txt`

`源文件/` 放 18 份：事实底稿、口播稿、分镜脚本、分镜时码、字幕、配音 mp3/json、
BGM、混音母带、音效计划、混音配置与报告、两个构建脚本、封面源图与提示词/说明。
打包后删除 `output/<slug>/` 整个制作工作区与 `films/<slug>/renders`、`.hyperframes`；
`content/<slug>/` 与 `films/<slug>/index.html + assets/vendor` 保留，便于重渲。

## 12. 审核节点（宝哥定）

1. **口播稿审核**：先交完整口播稿 + 分镜节奏说明，批准后才配音；
2. **1 分钟配音审核**：批准后才配全片；
3. **5 个代表性分镜抽帧审核**：从完整口播稿中选 5 个最有冲击力的分镜，
   只渲染这 5 个镜头并抽帧，**不跑样片**；批准后才铺全片；
4. 成片全片渲染 → 质检 → 打包。

## 13. 踩坑

- 20 分钟片稿量是 5 分钟片的 4 倍，**不要直接拉长句子**；按信息密度重排结构。
- 3–5 秒一个分镜意味着 330–400 个 shot，`shots-full.json` 必须先过 schema 校验，
  再进 `papercut.js`；缺字段直接报错，不静默用默认值。
- 纸雕层数多，避免每层都用大面积 `filter: blur`；投影用 `drop-shadow`，
  纸纹用一张可复用的 SVG data URI，不要每帧重绘。
- **改根节点属性只能用正则替换值**：`re.sub(r'(data-duration=")[0-9.]+(")', ...)`；
  2026-10-22 曾误用整段 `<div id="root"[^>]*>` 重写，把 width/height 等属性全删掉，
  HyperFrames 按默认竖版编译，成片变 1080×1920 且被截断。
- **`const CUE = {...};` 注入后是单行**：块查找用 `html.index(";\n", start)`，
  用 `"\n};"` 会 `ValueError: substring not found`。
- 改机位/分镜/时长后必须重渲画面，`--mux-only` 只换音轨；重渲后再跑相机/抽帧/电平。
- 相邻镜留 **10 ms 重叠**（`t1_i = 下一镜 t0 + 0.01`），末镜结束在片尾卡起点；
  末镜多留会把片尾卡盖住，少留会露黑。
- `audio_meta.json` 可能落后于新配音；以 `index.html` 的 `<audio data-duration>`
  （定稿 1320.930）和实际 smooth mp3 时长为准。
- 口播 mp3 与 wav 有 2–3 ms 差异；composition 以 mp3 为准。
- 成片容器时长会比 filmEnd 多约 0.03 s（39809 帧 = 1326.9667 s，音频 1326.938 s），
  这是帧数取整，属正常；以 `nb_frames` 与音频流时长核对。
- 分段捕获缓存（`renders/.hf-segments`，本片约 1 GB）和新版 HyperFrames 的
  `.hyperframes/` 交付后要删；不删会拖慢下一次渲染并占用磁盘。
- 交付只进 `out/<NN 主题>/`；`output/<slug>/` 是工作区，打包后整体删除，
  不要把交付包留在 `output/` 下。
