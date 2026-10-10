"""Generate the favicon/app-icon set and the Open Graph image from the logo mark.

    python scripts/make_icons.py      (needs playwright + chromium, pillow)
"""
import io
import pathlib

from PIL import Image
from playwright.sync_api import sync_playwright

PUB = pathlib.Path(__file__).resolve().parent.parent / "frontend" / "public"
PAPER, INK, SUN = "#f4eee2", "#1f1b14", "#e8890c"

# Same geometry as LogoMark in src/ui/arc.tsx (32-unit grid, sun at t=0.68 on r=11 around (16,22)).
MARK = f"""<path d="M 5 22 A 11 11 0 0 1 27 22" fill="none" stroke="{INK}" stroke-width="2.4" stroke-linecap="round"/>
<line x1="3" y1="22" x2="29" y2="22" stroke="{INK}" stroke-width="2.4" stroke-linecap="round"/>
<circle cx="21.95" cy="12.73" r="3.9" fill="{SUN}"/>"""


def icon_svg(pad):
    """Rounded paper tile with the mark; `pad` is the safe-zone inset in 32-unit space (maskable needs more)."""
    s = 32 + 2 * pad
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-pad} {-pad + 1} {s} {s}">'
            f'<rect x="{-pad}" y="{-pad + 1}" width="{s}" height="{s}" rx="{s * 0.22 if pad < 6 else 0}" fill="{PAPER}"/>{MARK}</svg>')


OG = f"""<html><body style="margin:0;width:1200px;height:630px;background:{PAPER};font-family:Georgia,serif;color:{INK};
display:flex;flex-direction:column;justify-content:center;padding:0 96px;box-sizing:border-box;position:relative;overflow:hidden">
<svg viewBox="0 0 1200 630" style="position:absolute;inset:0" width="1200" height="630">
 <path d="M 860 600 A 340 340 0 0 1 1540 600" fill="none" stroke="#d9cfbc" stroke-width="3"/>
 <path d="M 860 600 A 340 340 0 0 1 1046 297" fill="none" stroke="#b67d2c" stroke-width="14" stroke-linecap="round"/>
 <circle cx="1046" cy="297" r="30" fill="{SUN}"/><line x1="0" y1="600" x2="1200" y2="600" stroke="#d9cfbc" stroke-width="3"/></svg>
<div style="display:flex;align-items:center;gap:16px;font-size:44px"><svg width="64" height="64" viewBox="0 0 32 32">{MARK}</svg>
 <span>Surya<b>Check</b></span></div>
<h1 style="font-size:76px;line-height:1.05;margin:36px 0 20px;max-width:760px">Is dust quietly costing your rooftop solar?</h1>
<p style="font:28px/1.4 sans-serif;color:#5b5345;max-width:700px;margin:0">Actual vs what the real sunshine allowed, the cause, and the rupees lost.</p>
</body></html>"""


def main():
    (PUB / "favicon.svg").write_text(icon_svg(3), encoding="utf-8")
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()

        def render(svg, px):
            pg.set_viewport_size({"width": px, "height": px})
            pg.set_content(f'<html><body style="margin:0">{svg.replace("<svg ", f"<svg width={px} height={px} ")}</body></html>')
            return Image.open(io.BytesIO(pg.screenshot(omit_background=True)))

        for name, px, pad in [("favicon-16.png", 16, 3), ("favicon-32.png", 32, 3), ("apple-touch-icon.png", 180, 3),
                              ("icon-192.png", 192, 3), ("icon-512.png", 512, 3), ("icon-maskable-512.png", 512, 9)]:
            render(icon_svg(pad), px).save(PUB / name)
        render(icon_svg(3), 48).save(PUB / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
        pg.set_viewport_size({"width": 1200, "height": 630})
        pg.set_content(OG)
        pg.screenshot(path=str(PUB / "og.png"))
        b.close()
    print("icons written to", PUB)


if __name__ == "__main__":
    main()
