"""Generate the favicon/app-icon set and the Open Graph image from the logo mark.

    python scripts/make_icons.py      (needs playwright + chromium, pillow)
"""
import io
import pathlib

from PIL import Image
from playwright.sync_api import sync_playwright

PUB = pathlib.Path(__file__).resolve().parent.parent / "frontend" / "public"
PAPER, INK, SUN = "#f4eee2", "#1f1b14", "#e8890c"

# The mark: the sun's path drawn as a gauge, with the sun as the needle tip (t = 0.68 of the day).
# Arc centre (16, 23), radius 11 on a 32-unit grid. Each size is drawn separately so it stays legible:
#   16 px: arc + sun only, heavy stroke; 32 px: + baseline; 180 px and up: track, filled arc, ticks, baseline.
TRACK, PAPER_DARK, INK_DARK = "#d9cfbc", "#14110c", "#f1eadc"
SUN_AT = (21.89, 13.71)
ARC = "M 5 23 A 11 11 0 0 1 27 23"
FILL = f"M 5 23 A 11 11 0 0 1 {SUN_AT[0]} {SUN_AT[1]}"
MARKS = {
    16: f'''<path class="ink" d="{ARC}" fill="none" stroke="{INK}" stroke-width="3.6" stroke-linecap="round"/>
<circle class="sun" cx="{SUN_AT[0]}" cy="{SUN_AT[1]}" r="5.2" fill="{SUN}"/>''',
    32: f'''<path class="ink" d="{ARC}" fill="none" stroke="{INK}" stroke-width="2.8" stroke-linecap="round"/>
<line class="ink" x1="2.5" y1="23" x2="29.5" y2="23" stroke="{INK}" stroke-width="2.8" stroke-linecap="round"/>
<circle class="sun" cx="{SUN_AT[0]}" cy="{SUN_AT[1]}" r="4.4" fill="{SUN}"/>''',
    180: f'''<path d="{ARC}" fill="none" stroke="{TRACK}" stroke-width="2.6" stroke-linecap="round"/>
<path class="ink" d="{FILL}" fill="none" stroke="{INK}" stroke-width="2.6" stroke-linecap="round"/>
<g class="ink" stroke="{INK}" stroke-width="1.3" stroke-linecap="round">
 <line x1="8.5" y1="23" x2="10" y2="23"/><line x1="16" y1="15.5" x2="16" y2="17"/><line x1="23.5" y1="23" x2="22" y2="23"/>
 <line x1="10.7" y1="17.7" x2="11.76" y2="18.76"/><line x1="21.3" y1="17.7" x2="20.24" y2="18.76"/></g>
<line class="ink" x1="2.5" y1="23" x2="29.5" y2="23" stroke="{INK}" stroke-width="2" stroke-linecap="round"/>
<circle class="sun" cx="{SUN_AT[0]}" cy="{SUN_AT[1]}" r="3.9" fill="{SUN}" stroke="{PAPER}" stroke-width="1.6"/>''',
}
MARK = MARKS[180]
DARK = f"""<style>@media (prefers-color-scheme: dark) {{ .tile {{ fill: {PAPER_DARK} }} .ink {{ stroke: {INK_DARK} }}
.sun {{ stroke: {PAPER_DARK} }} }}</style>"""


def icon_svg(pad, size=180, dark=False):
    """Rounded paper tile with the mark for that size; `pad` is the safe-zone inset in 32-unit space (maskable needs more)."""
    s = 32 + 2 * pad
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-pad} {-pad + 1} {s} {s}">{DARK if dark else ""}'
            f'<rect class="tile" x="{-pad}" y="{-pad + 1}" width="{s}" height="{s}" rx="{s * 0.22 if pad < 6 else 0}" fill="{PAPER}"/>'
            f'{MARKS[size]}</svg>')


# Safari pinned tab: one colour, no tile; Safari fills it with the mask-icon colour.
MASK = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="{ARC}" fill="none" stroke="#000" stroke-width="3.4" stroke-linecap="round"/>'
        f'<line x1="2.5" y1="23" x2="29.5" y2="23" stroke="#000" stroke-width="3.4" stroke-linecap="round"/>'
        f'<circle cx="{SUN_AT[0]}" cy="{SUN_AT[1]}" r="5" fill="#000"/></svg>')

OG = f"""<html><body style="margin:0;width:1200px;height:630px;background:{PAPER};font-family:Georgia,serif;color:{INK};
display:grid;grid-template-columns:1fr 440px;align-items:center;padding:0 80px;box-sizing:border-box;gap:40px">
<div><div style="display:flex;align-items:center;gap:16px;font-size:40px"><svg width="64" height="64" viewBox="0 0 32 32">{MARKS[180]}</svg>
 <span>Surya<b>Check</b></span></div>
<h1 style="font-size:66px;line-height:1.05;margin:32px 0 18px">Is dust quietly costing your rooftop solar?</h1>
<p style="font:27px/1.4 sans-serif;color:#5b5345;margin:0">What your panels made vs what the real sunshine allowed. The cause, and the rupees.</p></div>
<div style="background:#fbf8f1;border:2px solid {TRACK};border-top:8px solid #b67d2c;border-radius:28px;padding:36px 32px;text-align:center">
 <svg viewBox="0 0 200 116" width="360"><path d="M 18 100 A 82 82 0 0 1 182 100" fill="none" stroke="#ebe3d3" stroke-width="13" stroke-linecap="round"/>
  <path d="M 18 100 A 82 82 0 0 1 164.4 63.1" fill="none" stroke="#b67d2c" stroke-width="13" stroke-linecap="round"/>
  <circle cx="164.4" cy="63.1" r="9" fill="{SUN}" stroke="#fbf8f1" stroke-width="3"/><line x1="6" y1="100" x2="194" y2="100" stroke="{TRACK}" stroke-width="2"/></svg>
 <div style="font:600 64px monospace;margin-top:-34px">88<span style="font-size:28px">%</span></div>
 <div style="font:600 22px monospace;letter-spacing:3px;color:#7c5313">DUST</div>
 <div style="font:600 52px monospace;color:#7c5313;margin-top:18px">₹311<span style="font:400 24px sans-serif;color:#5b5345"> lost a month</span></div></div>
</body></html>"""


def main():
    (PUB / "favicon.svg").write_text(icon_svg(3, 32, dark=True), encoding="utf-8")
    (PUB / "safari-pinned-tab.svg").write_text(MASK, encoding="utf-8")
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()

        def render(svg, px):
            pg.set_viewport_size({"width": px, "height": px})
            pg.set_content(f'<html><body style="margin:0">{svg.replace("<svg ", f"<svg width={px} height={px} ")}</body></html>')
            return Image.open(io.BytesIO(pg.screenshot(omit_background=True)))

        for name, px, pad, size in [("favicon-16.png", 16, 2, 16), ("favicon-32.png", 32, 3, 32), ("apple-touch-icon.png", 180, 3, 180),
                                    ("icon-192.png", 192, 3, 180), ("icon-512.png", 512, 3, 180), ("icon-maskable-512.png", 512, 10, 180)]:
            render(icon_svg(pad, size), px).save(PUB / name)
        # .ico: each size from its own drawing, not one image scaled down.
        ico = [render(icon_svg(2, 16), 16), render(icon_svg(3, 32), 32), render(icon_svg(3, 32), 48)]
        ico[2].save(PUB / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)], append_images=ico[:2])
        pg.set_viewport_size({"width": 1200, "height": 630})
        pg.set_content(OG)
        pg.screenshot(path=str(PUB / "og.png"))
        b.close()
    print("icons written to", PUB)


if __name__ == "__main__":
    main()
