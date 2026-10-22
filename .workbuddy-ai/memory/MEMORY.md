# tushuo 项目长期备忘

## 交付物位置（chibi-full 完整版）
- 成片：`output/chibi-full/tushuo-chibi-full.mp4`（311.33 s / 1920×1080 / 30fps / AAC 48k 立体声）。
- 旧配音备份：`output/chibi-full/审片-赤壁完整版-旧配音备份.mp4`（311.9 s，带读音 bug，仅供对照，勿交付）。
- QA 帧：`output/chibi-full/_qa/probe/`（t01–t23 冒烟 + z01–z04 路径专项 + c01–c12 主帅卡）；逐镜审核图 `output/chibi-full/review-shots/` + `审片-逐镜75.jpg`。
- 验收记录：`docs/样片验收记录.md`（按轮次追加，最新一轮为「第七轮：13 段 2 秒音效 · 配乐层补齐」，已 PASS 交付）。
- **2026-10-18 交接文档**：`HANDOVER.md`（项目根），含已完成/卡住/待办三段。

## 引擎约定
- 段（幕）边界用 `ACT_OFFSETS`（字幕字符偏移）+ `buildActs(captions,filmEnd)` 推；改口播后段边界会整体漂移，勿手抄旧时间。
- WORLD 数组分发起步有 **k-1 偏移**：`WORLD[k-1]`，即 WORLD[6]=fireWorld 服务第 8 段（155.55–178.72 s）。排查「时序错位」前先确认这个偏移。
- `range(t,a,b)` 是饱和斜坡（过 b 保持 1），淡出必须乘 `(1-range(...))`。
- 路径系统：`buildPath(pts)` → `unitAt(path,t,t0,t1,offset)`；offset 是**进度比例**（勿再除窗口时长）；间距 CAO .07/LIU .05/CLASH .12/FIRE .03。
- 工具三件套：`tools/probe.mjs`（23 帧冒烟，改 TIMES 即可）、`tools/shots.mjs`（逐镜审核图）、`tools/render.mjs`（`--slug --seconds`，整片约 2 小时，勿中途 kill；中途停不会覆盖成片，mux 在最后）；`tools/tmp-cards.mjs` 重拍 c01–c12 主帅卡审核帧。
- 同文件多处修改：逐个串行 Edit 并 grep 复核（并行 Edit 同文件会互相覆盖丢改）。
- 主帅卡面部裁切：`src/engine.js` 的 `PORTRAIT_CROP` 是单人脸方形矩形，[x, y, size]（480 宽源图），`circlePortrait` 优先用裁切框（仅 480 宽卡生效）。`assets/commanders/crops.json` 存 14 张卡，**卡发生迁移或缩放后必须重跑** `tools/make_portrait_crops.py`。
- **音效下载（2026-10-18 定论）**：BBC 反爬（429）弃用；mixkit 分类页可达但 `assets.mixkit.co` 被本机代理 502；pixabay/soundbible/wikimedia 均不通。**可用源 = freesound.org**：搜索页内嵌 `cdn.freesound.org/previews/{dir}/{id}_{user}-hq.mp3`，加 `f=license:"Creative Commons 0"` 过滤后无需账号直下。脚本在 `tools/_sfxdl/`，成品样本在 `assets/sfx/`，选源清单 `tools/_sfxdl/manifest.json`。
- **音效铺放电平**：短样本峰值易落淡入区，固定增益会压低 8dB；`soundtrack.py` 的 `mix_sfx_track` 按 `sfx-track.json` 的 `targetBedPeak`（0.41，每声道 0.29=钩子鼓点同级）自动归整，`gainDb` 只是相对微调。改音效电平只动这两个字段 + 重跑 soundtrack + `--mux-only`。
- `render.mjs --mux-only` 必须带 `--seconds`，否则 `-t` 截成默认 52s。
- 时序参数 `cmdCard(g, key, x, y, r, color, v, a, t0, t1, s0, s1)`：t0/t1 是**相对本段时间**（"a 秒淡入，b 秒淡出"），不是绝对秒也不是负秒；**与 `v`（画布时码）一起对应世界坐标**。

## 用户偏好
- OCR/读图一律用 Dabao-OCR（用户级记忆）。
- 交付时区分「已验收旧版」与「重渲新版」，旧版要显式改名备份，避免混用。
