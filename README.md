# tushuo — 历史图说 · 平面地图战场推演视频

以可改代码和战役数据驱动的平面地图兵棋推演视频项目。画面 1920×1080、30 fps，
历史地点以示意位置表现。当前定稿成片：赤壁之战完整版
`output/1 赤壁之战/tushuo-chibi-full.mp4`（312.04s）。

**完整制作规范、全部定稿参数、渲染/核验/交付/清理流程见技能
`C:\Users\20200\.claude\skills\tushuo-film\SKILL.md`。以后每部战役照该技能执行。**

## 目录

- **最终交付包**：`output/<NN 主题>/`，如 `output/1 赤壁之战/`（以后每部新建编号子目录）
  - 顶层只放：`tushuo-<slug>.mp4`、`封面-4比3.jpg`（2048×1536）、
    `封面-3比4.jpg`（1536×2048）、`发布信息.txt`
  - `源文件/`：文稿、配乐/音效配置、配音与字幕、音效床/BGM 母带、封面源图与封面说明
- 制作工作区：`output/<slug>/`（配音、字幕、音效床、BGM、分段渲染与成片；打包后删除）
- 战役内容：`content/<slug>/`
  - `事实底稿.md`、`分镜与口播.md`、`口播稿.txt`
  - `score.json`（原创配乐/音效谱）
  - `sfx-track.json`（场景音效铺放，`cueText` 锚定口播）
- 画面：共享引擎 `src/engine.js` + 每片场景 `src/scene-<slug>.js`
- 入口：`src/video.js`（按页面参数 `?content=<slug>` 载入场景）
- 封面：火山方舟 Seedream 5.0-flash 直接生成画面 + 一行 6 字主标题；`tools/make_covers.py` 仅作回退
- 工具：`tools/`（配音、对时、音效床、渲染、封面、质检）
- 定稿主帅卡：`assets/commanders/`；人物原图：`三国人物/`
- 音效素材：`音效/`；BGM 素材库：`D:\自动剪辑\BGM\`
- 需求/路线/许可文档：`docs/`

## 标准流程（每部照跑）

```powershell
# ① 配音（梗概：GPT-SoVITS 26E，自动去句间停顿）
vendor\gpt-sovits\.venv\Scripts\python.exe tools\narrate.py `
  --text-file content\<slug>\口播稿.txt --out output\<slug>\narration.mp3

# ② 对时 / 字幕
vendor\gpt-sovits\.venv\Scripts\python.exe tools\align_narration.py --slug <slug>

# ③ 原创音效床（读 score.json + sfx-track.json）
vendor\gpt-sovits\.venv\Scripts\python.exe tools\soundtrack.py --slug <slug>

# ④ BGM 床（选曲、4s 交叉淡化循环、loudnorm I=-40）→ output\<slug>\bgm.wav

# ⑤ 先按技能里的 6 段并行命令渲出 picture.mp4，再只混音出成片：
node tools\render.mjs --slug=<slug> --seconds=<filmEnd> --mux-only

# ⑥ 封面：火山方舟 Seedream 直接生成画面 + 一行 6 字主标题（4:3 / 3:4）
#    在 D:\@kaifa\aiyouhu 执行；配置读该目录 .env 的 IMG_*；输出落在 outputs\tushuo-cover\
D:\@kaifa\openviking\.venv\Scripts\python.exe skills\shared\scripts\ai_image.py text2img `
  --prompt "<史诗火烧战船 + 金色毛笔行楷标题「六字」；只写这六个汉字；画面无其它文字/logo/水印/现代物品/清晰人脸>" `
  --size 2048x1536 --no-watermark -o outputs\tushuo-cover\<slug>-4x3.png --format png
#    竖版同提示词改 --size 1536x2048；模型 doubao-seedream-5-0-flash-260915
#    出图后裁出标题区逐字核对六字，错字/多字/缺笔重出

# ⑦ 打包交付：成片/两张封面/发布信息.txt → output\<NN 主题>\ 顶层，
#    文稿与母带 → 源文件\，然后删除制作工作区 output\<slug>\
```

## 定稿规格（摘要，完整版见技能）

- 视频：1920×1080 / 30 fps / `h264_qsv -global_quality 20` / `yuv420p` / `+faststart`
- 音频：48 kHz 立体声 AAC 192k；旁白 `loudnorm I=-17 TP=-1.5 LRA=7`；
  音效床 `volume=0.325`；BGM `−40 LUFS`；`alimiter=0.93`
- 场景音效：14 段，去头部静音后从起音取 2 秒，按 `cueText` 锚到口播句
- 片头：第一句字幕抖动严格 1 秒
- 主帅卡：480×480，脸高 200px，脸心 (240,250)；同一帧同一人只一张
- 渲染：`renderAt(t)` 纯函数；全片 9361 帧，6 段并行约 25 分钟

## 交付

创作类改动先出静帧/短片审核，批准后再铺全片；审核包给本地文件夹路径 +
编号接触表，不发邮件除非明确要求。

每部成片按 alannew 规则打包成独立交付目录 `output/<NN 主题>/`：顶层只有
成片、`封面-4比3.jpg`、`封面-3比4.jpg`、`发布信息.txt` 四个文件，其余创作资产
全部收进 `源文件/`。封面由火山方舟 Seedream 5.0-flash 直接生成画面与一行
6 字金色主标题（不再有副标题、不再本地叠字）；出图后必须放大逐字核对，
有错字/多字/缺笔就重出；提示词与源图归档到 `源文件/`。`发布信息.txt`
第一行标题里的兵力/数量用阿拉伯数字（如 `20万` / `5万`），第二行固定 4 个话题标签。
打包完成后删除 `output/<slug>/` 制作工作区，按技能第 6 节清理中间产物。
