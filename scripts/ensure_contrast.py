"""Raise text/background contrast for every theme selector that needs it.

After the palette pass, a few selectors still sit close to their own background
(e.g. a dark table header that kept dark text). This pass walks each style block,
computes the effective background (its own, else the wrapper's) and nudges the
text lightness until the WCAG contrast ratio reaches the target, keeping the hue.
"""

from __future__ import annotations

import colorsys
import json
import re
import sys
from pathlib import Path

THEMES = Path(__file__).resolve().parent.parent / "vendor" / "xiaohu" / "themes"
HEX = re.compile(r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b")
RGB = re.compile(r"rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)")
TARGET = 4.5


def parse(value: str, alpha: bool = False):
    """Return rgb, or (rgb, alpha) when asked. Alpha defaults to 1."""
    if not isinstance(value, str):
        return None
    match = HEX.search(value)
    if match:
        digits = match.group(1)
        if len(digits) == 3:
            digits = "".join(ch * 2 for ch in digits)
        rgb = tuple(int(digits[i : i + 2], 16) for i in (0, 2, 4))
        return (rgb, 1.0) if alpha else rgb
    inner = RGB.search(value)
    if not inner:
        return None
    rgb = tuple(int(round(float(inner.group(i)))) for i in (1, 2, 3))
    opacity = float(inner.group(4)) if inner.group(4) is not None else 1.0
    return (rgb, opacity) if alpha else rgb


def to_hex(rgb) -> str:
    return "#%02x%02x%02x" % tuple(max(0, min(255, int(round(c)))) for c in rgb)


def luminance(rgb) -> float:
    def channel(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (channel(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b) -> float:
    la, lb = luminance(a), luminance(b)
    high, low = max(la, lb), min(la, lb)
    return (high + 0.05) / (low + 0.05)


def adjust_text(text_rgb, bg_rgb):
    if contrast(text_rgb, bg_rgb) >= TARGET:
        return text_rgb
    hue, light, sat = colorsys.rgb_to_hls(*(c / 255 for c in text_rgb))
    dark_bg = luminance(bg_rgb) < 0.4
    sat = min(sat, 0.16)
    step = 0.04
    for _ in range(40):
        light = light + step if dark_bg else light - step
        light = max(0.02, min(0.98, light))
        candidate = tuple(c * 255 for c in colorsys.hls_to_rgb(hue, light, sat))
        if contrast(candidate, bg_rgb) >= TARGET:
            return candidate
    return tuple(c * 255 for c in colorsys.hls_to_rgb(hue, 0.95 if dark_bg else 0.06, sat))


def background_of(style: dict, fallback):
    """Effective background: translucent tints are composited over the fallback."""
    for key in ("background", "background_color", "bgcolor"):
        parsed = parse(style.get(key), alpha=True)
        if not parsed:
            continue
        rgb, opacity = parsed
        if opacity >= 0.999:
            return rgb
        return tuple(rgb[i] * opacity + fallback[i] * (1 - opacity) for i in range(3))
    return fallback


def deepen_block(bg_rgb, text_rgb):
    """A coloured panel carrying light text: darken the panel, not the type."""
    hue, light, sat = colorsys.rgb_to_hls(*(c / 255 for c in bg_rgb))
    light = min(light, 0.42)
    for _ in range(40):
        candidate = tuple(c * 255 for c in colorsys.hls_to_rgb(hue, light, sat))
        if contrast(candidate, text_rgb) >= TARGET or light <= 0.18:
            return candidate
        light -= 0.02
    return tuple(c * 255 for c in colorsys.hls_to_rgb(hue, 0.22, sat))


def main() -> int:
    touched = 0
    for path in sorted(THEMES.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        styles = data.get("styles") or {}
        wrapper = styles.get("wrapper") or {}
        base_bg = background_of(wrapper, (255, 255, 255))
        dark_mode = data.get("dark_mode") or {}
        for selector, style in styles.items():
            if not isinstance(style, dict) or "color" not in style:
                continue
            text_rgb = parse(style.get("color"))
            if not text_rgb:
                continue
            bg = background_of(style, base_bg)
            fixed = adjust_text(text_rgb, bg)
            if fixed != text_rgb:
                style["color"] = to_hex(fixed)
                text_rgb = fixed
                touched += 1
            # Still short? The panel itself is a colour block — deepen it.
            if contrast(text_rgb, bg) < TARGET:
                _, _, sat = colorsys.rgb_to_hls(*(c / 255 for c in bg))
                if sat >= 0.25:
                    deeper = deepen_block(bg, text_rgb)
                    if deeper != bg:
                        for key in ("background", "background_color", "bgcolor"):
                            if parse(style.get(key)):
                                original = style[key]
                                style[key] = HEX.sub(lambda m: to_hex(deeper), original, count=1)
                                break
                        touched += 1
        for selector, style in dark_mode.items():
            if not isinstance(style, dict):
                continue
            key = "color" if "color" in style else ("bgcolor" if "bgcolor" in style else None)
            if key != "color":
                continue
            text_rgb = parse(style.get("color"))
            if not text_rgb:
                continue
            bg = parse((dark_mode.get("wrapper") or {}).get("bgcolor")) or (20, 22, 26)
            fixed = adjust_text(text_rgb, bg)
            if fixed != text_rgb:
                style["color"] = to_hex(fixed)
                touched += 1
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"contrast raised on {touched} selectors")
    return 0


if __name__ == "__main__":
    sys.exit(main())
