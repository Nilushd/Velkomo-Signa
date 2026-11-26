"""Velkomo Signa logo pack: SVG sources (lettering outlined from Inter Display, OFL).
Same symbol geometry, wordmark and tile as Velkomo; Signa uses an indigo tile with a green approval tick."""
import os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
OUT = sys.argv[1]; os.makedirs(OUT + "/svg", exist_ok=True)
C = dict(indigo="#4F46E5", deep="#1E1B4B", ink="#18172B", tick="#34D399", tickdark="#0E9F6E",
         sky="#A5B4FC", paper="#F5F5FB", white="#FFFFFF")

def text_path(txt, font_file, size, tracking=0.0):
    f = TTFont(font_file); gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f["head"].unitsPerEm
    s = size / upm; x = 0; parts = []; top = 0
    for ch in txt:
        if ch == " ":
            x += gs[cmap[32]].width * s + tracking * size; continue
        g = cmap[ord(ch)]; pen = SVGPathPen(gs); gs[g].draw(pen)
        bp = BoundsPen(gs); gs[g].draw(bp)
        if bp.bounds: top = max(top, bp.bounds[3] * s)
        parts.append(f'<path transform="translate({x:.2f} 0) scale({s:.5f} {-s:.5f})" d="{pen.getCommands()}"/>')
        x += gs[g].width * s + tracking * size
    return "".join(parts), x - tracking * size, top

BOLD = "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf"
MED = "/usr/share/fonts/opentype/inter/InterDisplay-Medium.otf"

# the Velkomo welcoming V figure; the gold spark becomes a green approval tick (a signed, approved form)
TICK = "M366 122 L394 150 L448 92"
def figure(color, tick=C["tick"], sw=58):
    return (f'<path d="M146 204 L256 360 L366 204" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<circle cx="256" cy="150" r="38" fill="{color}"/>'
            + (f'<path d="{TICK}" fill="none" stroke="{tick}" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>' if tick else ""))

def tile(inner, rx=116, light=False):
    a, b, gid = ("#7C74FF", "#4338CA", "sl") if light else ("#5B54F0", C["deep"], "sg")
    return (f'<defs><linearGradient id="{gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient></defs>'
            f'<rect width="512" height="512" rx="{rx}" fill="url(#{gid})"/>' + inner)

def svg(w, h, body, bg=None):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}">'
            + (f'<rect width="100%" height="100%" fill="{bg}"/>' if bg else "") + body + "</svg>")

def save(name, s): open(f"{OUT}/svg/{name}.svg", "w").write(s)

ICON = tile(figure(C["white"]))
ICON_ON_DARK = tile(figure(C["white"]), light=True)
save("velkomo-signa-icon", svg(512, 512, ICON))
save("velkomo-signa-icon-square", svg(512, 512, tile(figure(C["white"]), rx=0)))
save("velkomo-signa-maskable", svg(512, 512, tile(f'<g transform="translate(77 77) scale(0.7)">{figure(C["white"])}</g>', rx=0)))
save("velkomo-signa-symbol", svg(512, 512, figure(C["indigo"], tick=C["tickdark"])))
save("velkomo-signa-symbol-white", svg(512, 512, figure(C["white"])))
save("velkomo-signa-symbol-black", svg(512, 512, figure(C["ink"], tick=C["ink"])))

W1, W1W, WTOP = text_path("velkomo", BOLD, 200, -0.02)
W2, W2W, _ = text_path("signa", BOLD, 200, -0.02)
SP = 16
WW = W1W + SP + W2W
def word(c1, c2): return f'<g fill="{c1}">{W1}</g><g fill="{c2}" transform="translate({W1W + SP:.2f} 0)">{W2}</g>'
DESC = 52  # room for the g descender
pad = 12
for n, a, b in [("", C["deep"], C["indigo"]), ("-white", C["white"], C["sky"]), ("-black", C["ink"], C["ink"])]:
    save(f"velkomo-signa-wordmark{n}", svg(WW + 2 * pad, WTOP + 2 * pad + DESC, f'<g transform="translate({pad} {WTOP + pad})">{word(a, b)}</g>'))

TAG, TW, TTOP = text_path("FORMS & APPROVALS", MED, 44, 0.16)

def horizontal_parts(c1, c2, icon_body, tagline=None):
    ih = 240; gap = 50; sc = ih / 512; ws = 0.74
    wh = WTOP * ws
    if tagline:
        tk = min(WW * ws / TW, 0.62)
        block = wh + 34 + TTOP * tk; ty = (ih - block) / 2 + wh
    else:
        ty = ih / 2 + wh / 2
    w = ih + gap + WW * ws + 8
    body = (f'<g transform="scale({sc})">{icon_body}</g>'
            f'<g transform="translate({ih + gap} {ty:.1f}) scale({ws})">{word(c1, c2)}</g>')
    if tagline:
        body += f'<g transform="translate({ih + gap + 3} {ty + 34 + TTOP * tk:.1f}) scale({tk:.4f})" fill="{tagline}">{TAG}</g>'
    return w, ih, body

def horizontal(*a, **k):
    w, h, body = horizontal_parts(*a, **k); return svg(w, h, body)

save("velkomo-signa-logo-horizontal", horizontal(C["deep"], C["indigo"], ICON))
save("velkomo-signa-logo-horizontal-white", horizontal(C["white"], C["sky"], ICON_ON_DARK))
save("velkomo-signa-logo-horizontal-mono-black", horizontal(C["ink"], C["ink"], figure(C["ink"], tick=C["ink"])))
save("velkomo-signa-logo-horizontal-mono-white", horizontal(C["white"], C["white"], figure(C["white"], tick=C["white"])))
save("velkomo-signa-logo-tagline", horizontal(C["deep"], C["indigo"], ICON, tagline="#6B6A85"))
save("velkomo-signa-logo-tagline-white", horizontal(C["white"], C["sky"], ICON_ON_DARK, tagline="#C7CBFF"))

def stacked(c1, c2, icon_body):
    ih = 300; sc = ih / 512; gap = 44; w = max(WW, ih) + 24
    body = (f'<g transform="translate({(w - ih) / 2:.1f} 0) scale({sc})">{icon_body}</g>'
            f'<g transform="translate({(w - WW) / 2:.1f} {ih + gap + WTOP:.1f})">{word(c1, c2)}</g>')
    return svg(w, ih + gap + WTOP + DESC + 20, body)

save("velkomo-signa-logo-stacked", stacked(C["deep"], C["indigo"], ICON))
save("velkomo-signa-logo-stacked-white", stacked(C["white"], C["sky"], ICON_ON_DARK))

w, h, body = horizontal_parts(C["white"], C["sky"], ICON_ON_DARK, tagline="#C7CBFF")
k = 900 / w
save("velkomo-signa-social-1200x630", svg(1200, 630,
     f'<defs><linearGradient id="bgx" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{C["deep"]}"/><stop offset="1" stop-color="#2E2A8A"/></linearGradient></defs>'
     f'<rect width="1200" height="630" fill="url(#bgx)"/><circle cx="1110" cy="60" r="250" fill="#5B54F0" opacity=".25"/>'
     f'<circle cx="90" cy="640" r="190" fill="#5B54F0" opacity=".18"/>'
     f'<g transform="translate({(1200 - w * k) / 2:.1f} {(630 - h * k) / 2:.1f}) scale({k:.4f})">{body}</g>'))
save("velkomo-signa-avatar", svg(512, 512, f'<rect width="512" height="512" fill="{C["deep"]}"/><g transform="translate(76 76) scale(0.703)">{figure(C["white"])}</g>'))
print("svgs:", len(os.listdir(OUT + "/svg")))
