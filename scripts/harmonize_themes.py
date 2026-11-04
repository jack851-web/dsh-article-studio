"""Re-tune every theme's palette toward print-like, editorial colours.

The catalogue shipped with screen-only hues: neon accents, loud tinted panels and
pure-black text on pure-white paper. This pass keeps each theme's hue identity but
pulls saturation and lightness into ranges that read as ink on paper:

  * body text follows its own background: dark ink on paper, paper on ink
  * surfaces stay near paper (light) or near ink (dark), tint capped
  * rules keep their weight; only the tint is capped
  * accents keep their hue at a deeper, printable saturation

Hue is preserved, so a blue theme stays blue and an orange one stays orange.
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

SURFACE_KEYS = {"background", "background_color", "bgcolor", "bg"}
BORDER_HINTS = ("border", "hr_color", "rule", "divider")
ACCENT_PARENTS = {"a", "code", "pre", "pre_code", "list_item_bullet", "ol_item_bullet",
                  "footnote_sup", "h4"}


def to_rgb(value: str):
    match = HEX.fullmatch(value)
    if match:
        digits = match.group(1)
        if len(digits) == 3:
            digits = "".join(ch * 2 for ch in digits)
        return tuple(int(digits[i : i + 2], 16) for i in (0, 2, 4)), None
    match = RGB.fullmatch(value.strip())
    if match:
        rgb = tuple(int(round(float(match.group(i)))) for i in (1, 2, 3))
        alpha = match.group(4)
        return rgb, (float(alpha) if alpha is not None else None)
    return None, None


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def to_hex(rgb) -> str:
    return "#%02x%02x%02x" % tuple(int(clamp(round(c), 0, 255)) for c in rgb)


def lightness(value: str):
    rgb, _ = to_rgb(value) if isinstance(value, str) else (None, None)
    if rgb is None and isinstance(value, str):
        found = HEX.search(value) or RGB.search(value)
        if found:
            rgb, _ = to_rgb("".join(found.groups()) if found.re is RGB else found.group(0))
    if rgb is None:
        return None
    return colorsys.rgb_to_hls(*(c / 255 for c in rgb))[1]


def background_stats(node: dict):
    """(lightness, saturation) of a node's own background, if it has one."""
    for key in ("background_color", "bgcolor", "background"):
        value = node.get(key)
        if not isinstance(value, str):
            continue
        rgb, _ = to_rgb(value) if HEX.fullmatch(value.strip()) else (None, None)
        if rgb is None:
            found = HEX.search(value) or RGB.search(value)
            rgb = to_rgb(found.group(0))[0] if found else None
        if rgb is None:
            continue
        _, light, sat = colorsys.rgb_to_hls(*(c / 255 for c in rgb))
        return light, sat
    return None


def background_lightness(node: dict):
    stats = background_stats(node)
    return stats[0] if stats else None


def role_for(path: tuple[str, ...], key: str, accent_ok: bool) -> str:
    lowered = key.lower()
    parent = path[-1] if path else ""
    if lowered == "accent" or (parent == "strong" and lowered in SURFACE_KEYS):
        return "accent"
    if parent in {"hr", "footnote_section"} and lowered in SURFACE_KEYS:
        return "border"
    if any(hint in lowered for hint in BORDER_HINTS):
        return "border"
    if lowered in SURFACE_KEYS or lowered.endswith("_bg") or "background" in lowered:
        return "surface"
    if lowered in {"color", "primary", "text"}:
        return "accent" if (accent_ok and parent in ACCENT_PARENTS) else "text"
    return "other"


def tune(rgb, role: str, on_dark: bool):
    red, green, blue = (c / 255 for c in rgb)
    hue, light, sat = colorsys.rgb_to_hls(red, green, blue)

    if role == "surface":
        if sat >= 0.40:
            # A deliberately coloured block (bauhaus bands, tinted covers): keep
            # the hue, just pull it back from neon into printed ink.
            if on_dark:
                light, sat = clamp(light, 0.26, 0.44), min(sat, 0.46)
            else:
                light, sat = clamp(light, 0.78, 0.90), min(sat, 0.30)
        elif on_dark:
            light, sat = clamp(light, 0.06, 0.15), min(sat, 0.20)
        else:
            light, sat = clamp(light, 0.94, 0.99), min(sat, 0.16)
    elif role == "accent" and sat >= 0.10:
        if on_dark:
            light, sat = clamp(light, 0.58, 0.78), clamp(sat, 0.26, 0.48)
        else:
            light, sat = clamp(light, 0.28, 0.44), clamp(sat, 0.26, 0.48)
    elif role == "border":
        sat = min(sat, 0.30)
        light = clamp(light, 0.16 if on_dark else 0.08, 0.42 if on_dark else 0.90)
    else:  # text and everything else that reads as ink
        if on_dark:
            light, sat = clamp(light, 0.78, 0.93), min(sat, 0.12)
        else:
            light, sat = clamp(light, 0.08, 0.32), min(sat, 0.10)

    red, green, blue = colorsys.hls_to_rgb(hue, clamp(light, 0.02, 0.98), sat)
    return red * 255, green * 255, blue * 255


def rewrite(value: str, role: str, on_dark: bool) -> str:
    def one(match: re.Match) -> str:
        raw = match.group(0)
        rgb, alpha = to_rgb(raw)
        if rgb is None:
            return raw
        tuned = tune(rgb, role, on_dark)
        if raw.lower().startswith("rgb"):
            head = "rgba" if alpha is not None else "rgb"
            parts = ", ".join(str(int(round(c))) for c in tuned)
            return f"{head}({parts}{', ' + format(alpha, '.3g') if alpha is not None else ''})"
        return to_hex(tuned)

    return RGB.sub(one, HEX.sub(one, value))


def convert(node, path: tuple[str, ...], on_dark: bool, theme_dark: bool = False) -> int:
    touched = 0
    if not isinstance(node, dict):
        return touched

    stats = background_stats(node)
    if stats is not None:
        light, sat = stats
        on_dark = light < 0.55
        # Inside a dark theme every neutral panel belongs to the dark canvas;
        # otherwise a light table header would keep light `strong` text on it.
        if theme_dark and (sat < 0.45 or light >= 0.55):
            on_dark = True

    for key, value in list(node.items()):
        if key == "description" or key == "font_family":
            continue
        if isinstance(value, str):
            if not (HEX.search(value) or RGB.search(value)):
                continue
            role = role_for(path, key, accent_ok=True)
            updated = rewrite(value, role, on_dark)
            if updated != value:
                node[key] = updated
                touched += 1
        else:
            touched += convert(value, path + (key,), on_dark, theme_dark)
    return touched


def theme_is_dark(data: dict) -> bool:
    for section in ("styles", "colors"):
        block = data.get(section) or {}
        light = background_lightness(block) if isinstance(block, dict) else None
        if light is None and isinstance(block, dict):
            wrapper = block.get("wrapper") or {}
            light = background_lightness(wrapper) if isinstance(wrapper, dict) else None
        if light is not None:
            return light < 0.55
    return False


def main() -> int:
    files = sorted(THEMES.glob("*.json"))
    total = 0
    for path in files:
        data = json.loads(path.read_text(encoding="utf-8"))
        base_dark = theme_is_dark(data)
        styles = data.get("styles")
        if isinstance(styles, dict):
            total += convert(styles, ("styles",), base_dark, base_dark)
        dark_mode = data.get("dark_mode")
        if isinstance(dark_mode, dict):
            total += convert(dark_mode, ("dark_mode",), True)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(files)} themes, {total} colour values retuned")
    return 0


if __name__ == "__main__":
    sys.exit(main())
