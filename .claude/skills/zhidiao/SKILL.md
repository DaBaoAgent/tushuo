---
name: zhidiao
description: 纸雕剪影风格历史解说视频的固定制作管线（定稿参数）。当用户要求制作/修改"图说历史"类纸雕剪影视频——口播配音、分镜 fragment、组装 composition、hyperframes 渲染、抽帧质检、拼接全片、50MB 压缩交付——时使用本 skill。触发词：纸雕、剪影动画、图说历史、分镜渲染、配音对齐、成片管线、zhidiao。
agent_created: true
---

# zhidiao · 纸雕剪影视频固定管线

## Overview

将「口播文本 → 配音 + 词级对齐 → 分镜 fragment → 组装 composition → 浏览器渲染 → 质检 → 拼接压缩」封装为固定管线。所有参数均为《图说历史 · 二十分钟中国史》项目多轮迭代后**定稿**的值，直接沿用，不要重新发明。

参考实现（已验证的项目）：`D:/@kaifa/tushuo/films/china-history-20min/`（共享库 + 25 个分部）。

## 管线总览（七阶段）

1. **配音对齐** — `scripts/zhidiao_make_audio.py`：dabao TTS → faster-whisper 词级转写 → 拼音 DP 对齐，产出 `manifest.json`（scenes/captions 时间轴）+ `narration.mp3`
2. **编写 fragment** — 每分部一个 `pXX-scenes.html`（场景 `<section>` + 尾部 `<script>` 设 PART_* 常量与 PART_TIMELINE）
3. **组装** — `scripts/zhidiao_assemble.py`：fragment + manifest → 完整 `index.html` composition
4. **渲染** — hyperframes 定稿参数（见 references/pipeline.md §渲染）
5. **质检** — 审计补间 + 字幕重叠 + 成品抽帧（三道检查缺一不可）
6. **拼接交付** — ffmpeg concat 无重编码 → x264 两遍压缩 50MB 版
7. **封面与发布信息** — 按 ditu 口径（2026-10-22 同步）：Seedream 两张封面（4:3 2048×1536 / 3:4 1536×2048，恰好 6 个汉字金色毛笔标题直接画入）+ `发布信息.txt`（两行：标题 **≤25 字、两段式强钩子**、含阿拉伯数字 + 恰好 4 个话题），再用 `tools/ditu/package_delivery.py` 打包成 `out/<NN 主题>/`（顶层 4 文件 + `源文件/`）

开始前**必读** `references/pipeline.md`：包含全部定稿参数、目录契约、GSAP 动画铁律（绝对 x/y 会摧毁 SVG 基位）、封面/发布口径、以及已踩过的坑。

## 硬性契约（违反即返工）

- fragment `<section>` 数量 **必须等于** manifest scenes 数量，场景 id 从 `s1` 连续编号
- GSAP 对 SVG 元素的 x/y 一律用相对值 `"+=N"`/`"-=N"`，**禁止**在 fromTo 里写绝对 x/y
- 字幕样式唯一来源：`lib/common.css` 的 `.cap`（ch01 式内联副本须同步）；定稿 = 无底板 + 白色加粗 + 2px 黑描边 + 微软雅黑
- 出字幕静帧必须「渲染成品 → ffmpeg 抽帧」——hyperframes snapshot 通道不烧录字幕层
- 交付前必须补齐封面与发布信息（ditu 口径）：两张封面 2048×1536 / 1536×2048，主标题**恰好 6 个汉字**、金色毛笔、由模型直接画入；`发布信息.txt` 恰好两行（标题 **≤25 字、两段式强钩子**、含阿拉伯数字 + 恰好 4 个 `#话题`）；打包后 `out/<NN 主题>/` 顶层只有 4 个文件 + `源文件/`
