# 主题配色规范

85 套主题来自 `xiaohu-wechat-format`，原始色板偏屏幕风格：霓虹强调色、
饱和底色、纯黑压在纯白上、暗色主题里浅色表头配浅色加粗字。我们用两个脚本
把它们统一调到"油墨 / 纸张"的区间，**保留每套主题的色相**（蓝的仍是蓝，
橙的仍是橙），只收饱和度与明度。

## 两个脚本

```bash
python scripts/harmonize_themes.py   # 色相保留，饱和度/明度收进印刷区间
python scripts/ensure_contrast.py    # 逐选择器把对比度提到 ≥ 4.5
```

按顺序执行；`vendor/xiaohu/themes/*.json` 原地更新，git 保留原始版本。

**例外：`bauhaus`（包裹斯）保持上游原样。** 它靠红/蓝/黄三原色立住主题，
批量收饱和会把风格抹平，所以脚本里用 `KEEP_ORIGINAL` 固定跳过。

## 规则

| 角色 | 处理 |
|---|---|
| 正文/标题 | 深色底上是纸色 `L 0.78–0.93`，纸色底上是墨色 `L 0.08–0.32`，饱和度 ≤ 12% |
| 表面（背景） | 浅色主题压到 `L ≥ 0.94`、`S ≤ 16%`（保留纸色微暖）；暗色主题压到 `L ≤ 0.15` |
| 彩色块 | 饱和度 ≥ 40% 的块保留色相，明度收进 `0.26–0.44`（暗底）或 `0.78–0.90`（亮底） |
| 分隔线 | 只压饱和度（≤ 30%），深浅不动：黑线仍黑，细线仍细 |
| 强调色 | 色相不变，`S 26–48%`、`L 0.28–0.44`（亮底）或 `0.58–0.78`（暗底） |

## 暗色主题的处理

暗色主题里所有中性表面统一归入暗底（否则浅色表头会配上浅色的加粗字），
彩色块只有在饱和度足够高时才保留原明度。`dark_mode` 段固定按暗底处理。

## 改动后的自检

```bash
python - <<'PY'
import json, sys, glob, os
sys.path.insert(0, "scripts")
from ensure_contrast import parse, contrast, background_of
bad = []
for p in sorted(glob.glob("vendor/xiaohu/themes/*.json")):
    d = json.load(open(p, encoding="utf-8"))
    styles = d.get("styles") or {}
    base = background_of(styles.get("wrapper") or {}, (255, 255, 255))
    for sel, st in styles.items():
        if isinstance(st, dict) and "color" in st and parse(st["color"]):
            if contrast(parse(st["color"]), background_of(st, base)) < 3.0:
                bad.append((os.path.basename(p), sel))
print("低于 3.0 的选择器：", len(bad), bad[:5])
PY
```

当前结果：**0 个选择器低于 3.0**，4.5 以下只剩标题类大字号（AA 大字标准通过）。

## Hero 类主题的首屏面板

`hero-*` 主题的首屏默认是一块深色面板（`hero.dark_bg`）。如果不想要那块
"大黑框"，给主题加：

```json
"hero": { "panel_bg": "#ffffff", "panel_text": "#1a1a1a", "panel_muted": "#565666" }
```

`format.py` 按面板明度自动切换字色与内边距：浅色面板不再画色块，标题回到
墨色，只保留强调色横线。目前只有「英雄·靛紫」这样配置，其余 hero 变体维持原样。
