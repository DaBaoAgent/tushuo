# zhidiao 管线 · 本机落地说明（2026-10-22）

## 来源

- 原始包：`D:\自动剪辑\zhidiao-skill-package.zip`
- 归档副本：`_source/zhidiao-skill-package.zip`
- SHA-256：`3dc6ad408d21c304b52c7125add528ed97f06bbb7a4a2e995a1eb7df76f7f3d9`
- 包内文件按原样解压，未改动任何脚本或文档。

## 本机依赖差异（运行前先处理）

| 包内写死的路径 | 本机现状 | 可用替代 |
|---|---|---|
| `D:/GPT-SoVITS/.venv/Scripts/python.exe`、`D:/GPT-SoVITS/dabao_tts.py`、`D:/GPT-SoVITS/voices/dabao/preset.json` | 不存在。本机有 `D:/@kaifa/GPT-SoVITS/`，但目录内没有 `dabao_tts.py` / `preset.json` | 已于 2026-10-22 改为 tushuo 自带 TTS：`vendor/gpt-sovits/.venv/Scripts/python.exe` + `tools/dabao_batch_tts.py`（服务 `127.0.0.1:9880`，参数锁定） |
| `D:/tmp_dl/chrome-win64/chrome.exe`（Chrome 131） | 不存在 | 本项目通过 `hyperframes@hyperframes` 插件渲染；`output/china-emperors-20min/render/sample-motion-v3.log` 显示浏览器走 cache/auto-detect 可正常出片 |
| 参考实现 `films/china-history-20min/` | 本机没有该目录 | 本机同管线项目为 `films/china-emperors-20min/`（含 `index.html`、`vendor/`、`.hyperframes/`） |

`D:/@kaifa/tushuo` 这个 BASE 路径与本机一致。

## 本机适配改动（2026-10-22）

`scripts/zhidiao_make_audio.py` 已改成本机 TTS 入口，其余逻辑未动：

- `PY` → `vendor/gpt-sovits/.venv/Scripts/python.exe`
- `TTS_SCRIPT` → `tools/dabao_batch_tts.py`
- 去掉 `--config` 与 `preset_parts.json`：本机 TTS 服务的采样参数锁定在 `vendor/gpt-sovits/tts_server.py`，
  不再有 `max_chars_per_second` 阈值；长句切分由 `--max-chars`（默认 78）负责。
- 时长字段兼容：`narration.json` 的 `duration_s` 与旧版 `duration` 都能读。

注意：`PARTS_DIR` / `OUT_DIR` 仍指向 `content/china-history-20min`、`output/china-history-20min`，
本机当前项目是 `china-emperors-20min`；跑新片前按实际 slug 改这两处。

## 2026-10-22 同步：封面与发布信息（ditu 口径）

- `references/pipeline.md` 新增 §7 封面与发布信息、§8 交付结构，`SKILL.md` 总览由六阶段扩为七阶段。
- 封面统一用 `tools/ditu/make_covers.py`（Seedream `doubao-seedream-5-0-flash-260915`，
  配置读项目根 `.env` 的 `IMG_BASE_URL / IMG_MODEL / IMG_API_KEY`）：
  两张 2048×1536 / 1536×2048，主标题恰好 6 个汉字、金色毛笔、由模型直接画入。
- 发布信息两行：标题 **≤25 字、两段式强钩子**、含阿拉伯数字；第二行恰好 4 个 `#话题`。
- 打包用 `tools/ditu/package_delivery.py`，交付目录顶层 4 文件 + `源文件/`。
- 首个按此口径交付的 zhidiao 片：`out/2 170万年的中国历史/`
  （标题「一百七十万年」，18 分 12 秒，1920×1080 横版）。

## 使用方式

- 作为 tushuo 项目技能加载：新开 Claude Code 会话后以 `/zhidiao` 或触发词（纸雕、剪影动画、图说历史、分镜渲染、zhidiao）调用。
- 详细定稿参数见 `references/pipeline.md`；首次运行前先按上表把脚本里的 TTS 路径改成本机入口。
