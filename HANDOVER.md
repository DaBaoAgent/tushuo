# HANDOVER · 十次转身：二十分钟读完中国史

最后更新：2026-10-21

## 0. 一句话状态

20 分钟原创口播稿、十章时间码、大禹治水两版 16:9 风格样张已完成；下一步是用户审稿 → 分章配音 → 逐镜头分镜 → 90 秒样片 → 全片渲染与 QA。

视觉方向已经定：

- **史诗长卷**：历史主线。地图、制度、年表、证物、人物档案。
- **纸雕剪影**：传说与情绪段。大禹治水、应龙、洪水、灾荒、战争记忆。
- 两套不是二选一，而是同一部片里的两个图层。

## 1. 先读这些

1. `CLAUDE.md`：项目硬规则、配音入口、目录约定。
2. `docs/制作管线.md`：60 秒基准片的完整流程、参数、QA 和踩坑。
3. `docs/读音规范.md`：文言/历史专名读音。
4. 本文件。
5. `content/china-history-20min/口播稿.md`：审稿版；`口播稿.txt`：纯旁白版。
6. `content/china-history-20min/分镜与口播.md`：章节时间码与画面策略。
7. `content/china-history-20min/参考拆解.md`：对标视频的结构分析。
8. `style-tests/dayu/README.md`：两版样张的源文件与渲染命令。

## 2. 已完成

- 对标视频解析：作者「雪山在那里」，标题《一口气读完中国历史，弹指十二分，世间百万年》，12:25，1920×1080。仅做结构和节奏分析；转写文件在 `output/_inspect/reference-transcript.json`，**不提交公开仓库**。
- 原创口播稿：`content/china-history-20min/口播稿.md` / `.txt`。约 **5802 个汉字**，十章 + 开场/结尾。
- 章节时间码：见 `content/china-history-20min/分镜与口播.md`，总长约 20:00。
- 两版大禹治水 16:9 样张：
  - `style-tests/dayu/epic-scroll.png`（1920×1080）
  - `style-tests/dayu/paper-cut.png`（1920×1080）
  - `style-tests/dayu/compare.png`（1920×760 对比板）
  - HTML/SVG 源文件同目录，字体使用相对路径，可复现。
- 视觉分工：长卷做历史主线，纸雕做传说/情绪段。

## 3. 20 分钟结构

| 时间 | 章节 | 旁白字数 |
|---|---|---|
| 00:00–00:37 | 开场：一条河，十次转身 | 178 |
| 00:37–02:51 | 第一章 史前：火、种子与城墙 | 649 |
| 02:51–05:33 | 第二章 夏商周：青铜与文字（含大禹治水纸雕段） | 783 |
| 05:33–07:30 | 第三章 秦汉：第一次大一统 | 565 |
| 07:30–09:09 | 第四章 魏晋南北朝：大分裂，大融合 | 478 |
| 09:09–10:56 | 第五章 唐：世界性的长安 | 517 |
| 10:56–12:46 | 第六章 宋：商业与科技的加速度 | 534 |
| 12:46–14:13 | 第七章 元：草原帝国的世界连接 | 422 |
| 14:13–16:02 | 第八章 明清：白银、海洋与封闭 | 528 |
| 16:02–18:23 | 第九章 近代：三千年未有之大变 | 681 |
| 18:23–19:32 | 第十章 现代：从站起来到富起来 | 336 |
| 19:32–19:59 | 结尾：为什么是十次 | 131 |

旁白约 17.9 分钟（按 5.4 字/秒），加章节停顿、片头片尾约 20 分钟。若采用更慢的 4.8 字/秒，旁白本身约 20.1 分钟。

## 4. 下一步怎么做

### 4.1 先审稿，不要直接配音

- 让用户先看 `口播稿.md`，重点确认：主线（十次转身）、篇幅、近现代部分的措辞、是否需要增加/删减朝代。
- 审稿通过后再生成 TTS；不要先合成 20 分钟再改稿。

### 4.2 分章配音

建议按 10 章拆分，每章约 2 分钟，便于返工：

```
content/china-history-20min/chapters/ch01.txt ... ch10.txt
```

每章用：

```powershell
tools\tts.cmd --text-file content\china-history-20min\chapters\ch01.txt --out output\china-history-20min\ch01.mp3
```

- 只用本机 GPT-SoVITS 的 **dabao** 预设；禁止 HyperFrames 内置 TTS。
- 每章合成后逐 chunk 核对 `narration-chunks/*.json`，防止整句被吞。
- 分章转写用 `tools\transcribe_dabao.cmd`；专名多时优先 medium 模型。
- 分章登记到 `audio_meta.json` 时，`frame` 使用章节号（1–10），不要用字符串 id。

### 4.3 分章画面，不要做 20 分钟单时间轴

- 建议每章一个独立 composition（约 2 分钟），各自 `lint` / `check` / 渲染，再 FFmpeg 拼接。
- 这样一章返工不会影响全片，也避免一个 300 秒大 GSAP 时间轴难以维护。
- 长卷负责历史主线；纸雕负责大禹、应龙、洪水、灾荒、战争记忆等段落。
- 先做 90 秒样片（开场 + 大禹纸雕 + 二里头长卷），确认节奏后再铺满 20 分钟。

### 4.4 渲染与混音

沿用 `docs/制作管线.md` 的 Windows 渲染口径；当前目标为 **1920×1080、30 fps**（横屏）。成片指标：

- H.264 High，yuv420p
- AAC 48 kHz 立体声
- −16 LUFS，真峰值 ≤ −1.0 dBTP
- 无黑帧
- 另出 720p 审阅版
- 每章单独 QA，最终拼接后再做一次全片 QA

## 5. 文件地图

```
content/china-history-20min/
  口播稿.md              审稿版（含章节、事实边界）
  口播稿.txt             纯旁白，给 TTS
  分镜与口播.md          章节时间码、画面策略
  参考拆解.md            对标视频结构分析（不含原文）

style-tests/dayu/
  epic-scroll.html/png   史诗长卷样张
  paper-cut.html/png     纸雕剪影样张
  compare.html/png       对比板
  README.md              渲染说明

docs/制作管线.md         60 秒基准管线（音频、字幕、渲染、QA）
docs/读音规范.md         历史专名/文言读音
films/mongol-west-1/     60 秒基准片 composition 与字体
tools/                   tts / transcribe / hf_audio_meta
```

## 6. 参考视频与原创边界

- 对标视频是快速通史：12:25，约 2958 个汉字，从约五千年前一路扫到现代。
- 本稿改成「十次转身」的论证结构，并把起点提前到约一百七十万年前的元谋人。
- 本稿是原创重写，不是逐句改写；自检未发现 20 字以上与参考转写的完全重合片段。
- 转写文件只在本机 `output/_inspect/`，**不要提交到公开仓库，也不要对外分发**。
- 原始人物图、dabao 参考音频、旁白、音床、渲染中间件都不进 tushuo 公开仓库。

## 7. GPT-SoVITS 运行时交接

本机 `D:\GPT-SoVITS` 约 **5.0 GB**：`.venv` 约 2.7 GB，`GPT_SoVITS` 约 2.4 GB，`voices/dabao` 约 1.8 MB。它不能整包推 tushuo（PUBLIC 仓库，且有私人参考音频和模型权重）。

安全做法：

1. 私有仓库 `DaBaoAgent/gpt-sovits-dabao`：放 GPT-SoVITS 代码、`dabao_tts.py/.cmd`、`voices/dabao` 的 preset/参考音频/逐字稿、安装说明；**不放** `.venv`、日志、缓存。
2. 模型权重（v2 底模等）用官方安装脚本或 Hugging Face 下载，不进公开仓库。
3. 新电脑装 Python/依赖后，把 `voices/dabao` 放回 `D:\GPT-SoVITS\voices\dabao`，再检查 `preset.json` 里的 `server` 路径是否为本机路径。
4. 如果要求「零安装」，需要把完整 5 GB 打包走私有 release/网盘；不要放进 PUBLIC 仓库。

## 8. 新电脑开工清单

1. `git clone https://github.com/DaBaoAgent/tushuo.git`
2. 安装 Node 22+、FFmpeg、Chrome；确认 `npx hyperframes` 可用。
3. 拉取私有 GPT-SoVITS 仓库，按其中的 README 安装/恢复 dabao 预设。
4. 读 `CLAUDE.md`、`docs/制作管线.md`、本文件。
5. 打开 `content/china-history-20min/口播稿.md` 做用户审稿。
6. 审稿通过后按章拆分、配音、转写、分镜、90 秒样片、全片。
7. 每一步先跑 `check`/抽帧，再渲染；不要跳过画面审核。

## 9. 验证状态（如实）

- 主流程自检已完成：文件存在、脚本字数、重复段落、图片 1920×1080、样张对比板可打开。
- 独立 verification 代理本次未返回结果（输出 0 字节）；未获得独立 PASS。新电脑接手后建议补一轮独立复核，至少检查：脚本史实、图片可读性、最终渲染规格。

## 10. Git

- 远端：`https://github.com/DaBaoAgent/tushuo.git`（PUBLIC）。
- 本次提交内容：`HANDOVER.md`、`content/china-history-20min/`、`style-tests/dayu/`。
- 不提交：`output/`、旁白/音床/视频、参考转写、私人原图、GPT-SoVITS 模型与参考音频。
