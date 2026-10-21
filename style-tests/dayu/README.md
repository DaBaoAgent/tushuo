# 大禹治水 · 两种 16:9 风格样张

这是《十次转身：二十分钟读完中国史》的视觉方向测试，不是最终成片帧。

| 文件 | 说明 |
|---|---|
| `epic-scroll.png` | 史诗长卷：羊皮纸、手绘地图、朱砂印章、证物注记 |
| `paper-cut.png` | 纸雕剪影：分层纸山、卷浪、暴雨、应龙、禹的剪影 |
| `compare.png` / `compare-view.jpg` | 两版并排对比板 |
| `epic-scroll.html` / `paper-cut.html` | 可复现的 HTML/SVG 源文件 |
| `compare.html` | 对比板源文件 |

## 渲染

字体在 `../../films/mongol-west-1/vendor/fonts/`，HTML 使用相对路径。Windows 下用系统 Chrome headless：

```bash
"C:/Program Files/Google/Chrome/Application/chrome.exe" \
  --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
  --window-size=1920,1080 --force-device-scale-factor=1 --virtual-time-budget=5000 \
  --screenshot="../dayu/epic-scroll.png" "epic-scroll.html"
```

把 `epic-scroll.html` 换成 `paper-cut.html` 可重出纸雕版；`compare.html` 用 1920×760 截图可重出对比板。

## 风格分工

- **史诗长卷**：历史主线、地图、制度、年表、证物、人物档案。适合解释型段落。
- **纸雕剪影**：传说、洪水、灾荒、战争记忆、诗歌意象。适合情绪型段落。
- 大禹治水属传说叙事，画面已标“应龙 · 神话层”“传说图像 · 非考古复原”；不要把画面当作考古复原或同时代实录。
