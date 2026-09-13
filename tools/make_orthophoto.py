#!/usr/bin/env python3
"""
Generuje syntetyczną „ortofotomapę” terenu kopalni (jak zdjęcie satelitarne /
z drona) do panelu cyfrowego bliźniaka.

Układ współrzędnych: świat 640×300 jednostek (x od −60 do 580, y od −50 do 250),
1 jednostka ≈ 1 m; obiekt kopalni zajmuje 0..520 × 0..200 – te same współrzędne,
w których w js/data.js zdefiniowano kamery.

Użycie:  python3 tools/make_orthophoto.py [wyjście.jpg]
Wymaga:  pillow, numpy
"""
import math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageEnhance

SCALE = 4
X0, Y0, WU, HU = -60, -50, 640, 300
W, H = WU * SCALE, HU * SCALE
ASSETS = os.path.join(os.path.dirname(__file__), "..", "assets")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ASSETS, "orthophoto.jpg")      # teren bez brył (płaszczyzna gruntu)
OUT_ROOFS = os.path.join(os.path.dirname(OUT), "roofs.png")                                # dachy / wierzchy brył (RGBA)
OUT_MODEL = os.path.join(os.path.dirname(__file__), "..", "js", "site.js")                # bryły do wyciągnięcia w 3D
rng = np.random.default_rng(11)

def px(x, y): return ((x - X0) * SCALE, (y - Y0) * SCALE)
def rect(x, y, w, d): return [px(x, y), px(x + w, y + d)]

def fbm(w, h, octaves=(6, 12, 24, 48, 96, 192), gain=0.55, seed=0):
    r = np.random.default_rng(seed); acc = np.zeros((h, w), np.float32); amp = 1.0; tot = 0
    for o in octaves:
        oh = max(2, int(o * h / w))
        g = r.random((oh + 1, o + 1)).astype(np.float32)
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        acc += np.asarray(im, np.float32) / 255 * amp; tot += amp; amp *= gain
    return acc / tot

def lerp(a, b, t): return a + (b - a) * t

# ---------------------------------------------------------------- teren
def terrain():
    n1 = fbm(W, H, seed=1); n2 = fbm(W, H, octaves=(3, 6, 12, 24), seed=2); n3 = fbm(W, H, octaves=(48, 96, 192, 384), gain=0.7, seed=3)
    img = np.zeros((H, W, 3), np.float32)
    # łąki / pola (zewnątrz)
    grass_a = np.array([96, 118, 62], np.float32); grass_b = np.array([132, 142, 78], np.float32); soil = np.array([128, 108, 82], np.float32)
    base = lerp(grass_a, grass_b, n1[..., None]); base = lerp(base, soil, np.clip((n2 - 0.55) * 4, 0, 1)[..., None])
    img[:] = base + (n3[..., None] - 0.5) * 22
    # pola uprawne – pasy o różnych odcieniach i kierunkach bruzd
    yy, xx = np.mgrid[0:H, 0:W]
    ux = xx / SCALE + X0; uy = yy / SCALE + Y0
    fields = [(-60, -50, 640, 300)]
    for (fx, fy, fw, fh, hue, ang) in [(-60, -50, 120, 120, (150, 140, 90), 0.4), (-60, 70, 60, 130, (110, 128, 70), 1.2), (540, -50, 40, 140, (140, 120, 80), 0.1),
                                        (0, -50, 260, 50, (120, 132, 74), 0.0), (300, -50, 240, 50, (146, 126, 86), 0.0), (520, 90, 60, 160, (104, 122, 66), 1.5), (-60, 200, 300, 50, (138, 130, 84), 0.0)]:
        m = (ux >= fx) & (ux < fx + fw) & (uy >= fy) & (uy < fy + fh)
        stripes = (np.sin((ux * math.cos(ang) + uy * math.sin(ang)) * 2.4) * 0.5 + 0.5) * 14 - 7
        col = np.array(hue, np.float32)
        img[m] = lerp(img[m], col + stripes[m][:, None] + (n3[m][:, None] - 0.5) * 16, 0.85)
    # obszar kopalni: żwir / pył
    m = (ux >= 0) & (ux <= 520) & (uy >= 0) & (uy <= 200)
    gravel = lerp(np.array([124, 120, 112], np.float32), np.array([146, 140, 128], np.float32), n1[..., None]) + (n3[..., None] - 0.5) * 28
    img[m] = gravel[m]
    # pył węglowy przy zakładzie przeróbczym i składowisku
    dust = np.exp(-(((ux - 420) / 130) ** 2 + ((uy - 150) / 70) ** 2)) * 0.75 + np.exp(-(((ux - 385) / 80) ** 2 + ((uy - 60) / 45) ** 2)) * 0.5
    img = lerp(img, np.array([58, 56, 54], np.float32), np.clip(dust * m, 0, 0.85)[..., None])
    # ślady kół / wydeptane ścieżki
    tracks = np.clip((fbm(W, H, octaves=(8, 16, 32), seed=9) - 0.62) * 8, 0, 1) * m
    img = lerp(img, img * 0.82, tracks[..., None] * 0.6)
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))

# ---------------------------------------------------------------- warstwy
img = terrain()
shadow = Image.new("L", (W, H), 0)       # cienie (alpha)
sd = ImageDraw.Draw(shadow)
draw = ImageDraw.Draw(img)
roofs = Image.new("RGBA", (W, H), (0, 0, 0, 0))   # dachy – osobna warstwa, w JS podnoszona o wysokość bryły
rd = ImageDraw.Draw(roofs)
MODEL = []                                          # bryły: footprint + wysokość (eksport do js/site.js)
SUN = (0.42, 0.30)                        # kierunek cienia (x, y) na jednostkę wysokości

def shadow_poly(pts, h):
    dx, dy = SUN[0] * h, SUN[1] * h
    # cień = obrys przesunięty + wypełnienie między
    a = [px(x, y) for x, y in pts]; b = [px(x + dx, y + dy) for x, y in pts]
    sd.polygon(b, fill=150)
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        sd.polygon([a[i], a[j], b[j], b[i]], fill=150)

def building(x, y, w, d, h, roof, facade=None, texture=True, name=None):
    shadow_poly([(x, y), (x + w, y), (x + w, y + d), (x, y + d)], h)
    # ślad budynku na gruncie (fundament) – widoczny, gdy dach jest podniesiony w widoku 3D
    draw.rectangle(rect(x, y, w, d), fill=tuple(int(c * 0.62) for c in roof))
    rd.rectangle(rect(x, y, w, d), fill=roof + (255,))
    if texture:
        col = tuple(min(255, c + 14) for c in roof) + (255,)
        step = 3 if w > 60 else 2.5
        k = y + 2
        while k < y + d - 1:
            rd.line([px(x + 1, k), px(x + w - 1, k)], fill=col, width=1); k += step
    rd.rectangle(rect(x, y, w, d), outline=tuple(int(c * 0.75) for c in roof) + (255,), width=1)
    MODEL.append({"t": "box", "x": x, "y": y, "w": w, "d": d, "h": h, "c": list(roof)})
    return [(x, y), (x + w, y), (x + w, y + d), (x, y + d)]

def cylinder(cx, cy, r, h, col, top=None):
    shadow_poly([(cx + r * math.cos(a), cy + r * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 16, endpoint=False)], h)
    draw.ellipse(rect(cx - r, cy - r, 2 * r, 2 * r), fill=tuple(int(c * 0.6) for c in col))
    rd.ellipse(rect(cx - r, cy - r, 2 * r, 2 * r), fill=(top or col) + (255,))
    rd.ellipse(rect(cx - r * 0.55, cy - r * 0.55, r * 1.1, r * 1.1), fill=tuple(min(255, c + 12) for c in (top or col)) + (255,))
    rd.ellipse(rect(cx - r, cy - r, 2 * r, 2 * r), outline=tuple(int(c * 0.7) for c in col) + (255,), width=1)
    MODEL.append({"t": "cyl", "x": cx, "y": cy, "r": r, "h": h, "c": list(col)})

def road(pts, width, col=(62, 62, 64), dashes=False):
    p = [px(*q) for q in pts]
    draw.line(p, fill=tuple(c + 30 for c in col), width=int(width * SCALE) + 4)   # pobocze
    draw.line(p, fill=col, width=int(width * SCALE))
    if dashes:
        for i in range(len(p) - 1):
            (x1, y1), (x2, y2) = p[i], p[i + 1]; L = math.hypot(x2 - x1, y2 - y1); n = int(L / (SCALE * 6))
            for k in range(0, n, 2):
                t0, t1 = k / n, (k + 0.8) / n
                draw.line([(x1 + (x2 - x1) * t0, y1 + (y2 - y1) * t0), (x1 + (x2 - x1) * t1, y1 + (y2 - y1) * t1)], fill=(190, 190, 180), width=1)

def tree(x, y, r):
    g = int(rng.integers(0, 3))
    col = [(46, 76, 40), (58, 92, 44), (40, 68, 36)][g]
    sd.ellipse(rect(x + r * 0.4, y + r * 0.5, 2 * r, 2 * r * 0.8), fill=120)
    draw.ellipse(rect(x - r, y - r, 2 * r, 2 * r), fill=col)
    draw.ellipse(rect(x - r * 0.75, y - r * 0.8, r * 1.1, r * 1.1), fill=tuple(min(255, c + 24) for c in col))

def pile(cx, cy, rx, ry, h):
    pts = [(cx + rx * (1 + 0.12 * math.sin(a * 3.1)) * math.cos(a), cy + ry * (1 + 0.1 * math.cos(a * 2.3)) * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 40, endpoint=False)]
    shadow_poly(pts, h)
    draw.polygon([px(*p) for p in pts], fill=(30, 30, 32))
    rd.polygon([px(*p) for p in pts], fill=(24, 24, 26, 255))
    rd.ellipse(rect(cx - rx * 0.55, cy - ry * 0.55, rx * 1.1, ry * 1.1), fill=(40, 40, 42, 255))
    rd.ellipse(rect(cx - rx * 0.25, cy - ry * 0.25, rx * 0.5, ry * 0.5), fill=(56, 56, 58, 255))
    MODEL.append({"t": "poly", "pts": [[round(a, 1), round(b, 1)] for a, b in pts], "h": h, "c": [28, 28, 30]})

def car(x, y, ang=0):
    col = [(200, 200, 205), (40, 44, 52), (120, 130, 140), (150, 40, 40), (60, 90, 150)][int(rng.integers(0, 5))]
    sd.rectangle(rect(x + 0.6, y + 0.6, 4.4, 2.2), fill=110)
    draw.rectangle(rect(x, y, 4.4, 2.2), fill=col)
    draw.rectangle(rect(x + 1.2, y + 0.4, 2.0, 1.4), fill=tuple(int(c * 0.6) for c in col))

# ---- drogi i place
road([(-60, 156), (300, 156)], 11, dashes=True)
road([(296, 156), (296, 40)], 11)
road([(40, 100), (330, 100)], 7)
road([(-60, 230), (580, 230)], 12, dashes=True)      # droga główna na południe od kopalni
road([(560, -50), (560, 230)], 10, dashes=True)      # droga na wschód
road([(107, 100), (107, -50)], 6)                    # dojazd północny
draw.rectangle(rect(50, 166, 80, 24), fill=(70, 70, 72))                   # parking
for i in range(8): draw.line([px(55 + i * 9.5, 168), px(55 + i * 9.5, 188)], fill=(130, 130, 128), width=1)
draw.rectangle(rect(330, 20, 130, 80), fill=(88, 86, 84))                   # plac zakładu
draw.rectangle(rect(340, 165, 150, 30), fill=(48, 46, 44))                   # składowisko

# ---- tory
def rail(pts):
    p = [px(*q) for q in pts]
    for i in range(len(p) - 1):
        (x1, y1), (x2, y2) = p[i], p[i + 1]; L = math.hypot(x2 - x1, y2 - y1); n = int(L / (SCALE * 1.2))
        for k in range(n):
            t = k / n; cx, cy = x1 + (x2 - x1) * t, y1 + (y2 - y1) * t
            nx, ny = -(y2 - y1) / L, (x2 - x1) / L
            draw.line([(cx + nx * 5, cy + ny * 5), (cx - nx * 5, cy - ny * 5)], fill=(96, 80, 64), width=2)
    draw.line(p, fill=(70, 70, 74), width=6); draw.line(p, fill=(150, 150, 150), width=1)
    draw.line([(a[0], a[1] + 4) for a in p], fill=(150, 150, 150), width=1)
rail([(330, 190), (580, 190)]); rail([(330, 190), (300, 205), (-60, 205)])
for x in [338, 354, 370, 386, 402]:
    sd.rectangle(rect(x + 1, 187.5 + 1, 13, 6), fill=110)
    draw.rectangle(rect(x, 187.5, 13, 6), fill=(74, 62, 58)); draw.rectangle(rect(x + 1, 188.5, 11, 4), fill=(28, 28, 30))

# ---- ogrodzenie, maszty
draw.rectangle(rect(2, 2, 516, 196), outline=(190, 190, 185), width=1)
for (x, y) in [(2, 2), (518, 2), (518, 198), (2, 198), (150, 150), (300, 150), (420, 2), (260, 2)]:
    sd.line([px(x, y), px(x + 9, y + 6)], fill=90, width=1); draw.ellipse(rect(x - 0.6, y - 0.6, 1.2, 1.2), fill=(220, 220, 215))

# ---- osadniki, zbiorniki
for cx in (350, 385):
    draw.ellipse(rect(cx - 14, 112 - 14, 28, 28), fill=(170, 168, 160))
    draw.ellipse(rect(cx - 12, 112 - 12, 24, 24), fill=(38, 66, 70))
    draw.ellipse(rect(cx - 9, 112 - 10, 18, 18), fill=(46, 78, 82))
for cx in (206, 222): cylinder(cx, 118, 6, 14, (205, 208, 210))

# ---- budynki (od tyłu do przodu)
building(30, 16, 70, 28, 18, (156, 140, 122), texture=False)        # administracja
for k in range(6): rd.rectangle(rect(34 + k * 11, 20, 6, 2), fill=(90, 90, 95, 255))  # świetliki
building(115, 16, 60, 28, 12, (128, 132, 136))                       # warsztat
building(190, 16, 28, 22, 12, (120, 96, 84), texture=False)          # kotłownia
cylinder(224, 22, 4, 46, (150, 150, 150), top=(70, 70, 70))          # komin
building(160, 60, 40, 24, 8, (138, 142, 146), texture=False)         # rozdzielnia
for x in (166, 178, 190): building(x, 66, 8, 8, 6, (96, 100, 104), texture=False)
building(330, 30, 110, 60, 36, (150, 154, 158))                      # zakład przeróbczy
for k in range(5): rd.rectangle(rect(336 + k * 20, 34, 12, 4), fill=(60, 70, 90, 255))
cylinder(345, 44, 8, 50, (178, 178, 176)); cylinder(365, 44, 8, 50, (178, 178, 176))
# wieża szybowa (kratownica) – szczupła, wysoki cień; rysowana w JS jako kratownica, tu tylko zrąb i cień
shadow_poly([(258, 43), (278, 43), (278, 63), (258, 63)], 64)
building(255, 40, 26, 26, 6, (110, 114, 118), texture=False)
MODEL.append({"t": "tower", "x": 258, "y": 43, "w": 20, "d": 20, "h": 64})
draw.line([px(281, 50), px(330, 58)], fill=(150, 150, 154), width=int(3.2 * SCALE)); draw.line([px(281, 50), px(330, 58)], fill=(180, 180, 184), width=int(1.6 * SCALE))
building(285, 40, 34, 18, 14, (124, 128, 132))                       # maszyna wyciągowa
building(480, 60, 14, 14, 8, (110, 114, 118), texture=False)         # szyb II
building(430, 106, 30, 18, 8, (140, 144, 148), texture=False)        # stacja trafo
building(70, 112, 110, 36, 16, (146, 130, 112))                      # lampownia
building(448, 148, 34, 30, 14, (130, 134, 138))                      # stacja wentylatorów
cylinder(468, 142, 7, 20, (160, 162, 164), top=(50, 52, 54))
building(8, 168, 30, 20, 10, (150, 140, 128), texture=False)         # brama
draw.line([px(38, 150), px(38, 162)], fill=(220, 60, 60), width=3)   # szlaban

# ---- hałdy
pile(367, 181, 17, 8, 4); pile(412, 183, 20, 9, 5); pile(459, 180, 15, 7, 4)

# ---- samochody, drzewa
for (x, y) in [(56, 170), (66, 170), (85, 170), (95, 170), (114, 170), (57, 184), (76, 184), (105, 184), (240, 152), (150, 154)]: car(x, y)
for _ in range(180):
    x, y = rng.uniform(-60, 580), rng.uniform(-50, 250)
    if 0 <= x <= 520 and 0 <= y <= 200: continue
    if abs(y - 156) < 8 or abs(y - 230) < 9 or abs(x - 560) < 8 or abs(x - 200) < 6 and y < 0: continue
    if (x < 0 and y > 70) or (x > 520 and y > 100) or (y < -10 and 240 < x < 300) or (y > 205 and x < 300):
        tree(x, y, rng.uniform(1.4, 3.2))
for (x, y) in [(20, 60), (28, 76), (14, 92), (140, 70), (150, 78), (245, 175), (255, 185), (300, 178), (312, 190), (190, 175), (12, 130)]:
    tree(x, y, rng.uniform(1.6, 2.6))

# ---- złożenie cieni i postprocessing (ziarno, haze, winieta)
shadow = shadow.filter(ImageFilter.GaussianBlur(1.6))
dark = ImageEnhance.Brightness(img).enhance(0.45)
img = Image.composite(dark, img, shadow)
arr = np.asarray(img).astype(np.float32) + rng.normal(0, 5, (H, W, 1)).astype(np.float32)
img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.5))
img = ImageEnhance.Color(img).enhance(0.9)
img = ImageEnhance.Contrast(img).enhance(1.06)
haze = Image.new("RGB", (W, H), (190, 200, 210)); img = Image.blend(img, haze, 0.06)
img.save(OUT, quality=82, optimize=True, subsampling=1)
roofs.save(OUT_ROOFS, optimize=True)
import json
with open(OUT_MODEL, "w", encoding="utf-8") as f:
    f.write("/* wygenerowane przez tools/make_orthophoto.py – bryły powierzchni do wyciągnięcia w widoku 3D */\n")
    f.write("window.SITE_MODEL = " + json.dumps({"map": {"x": X0, "y": Y0, "w": WU, "h": HU}, "objects": MODEL}, ensure_ascii=False) + ";\n")
print(OUT, img.size, os.path.getsize(OUT) // 1024, "KB ·", OUT_ROOFS, os.path.getsize(OUT_ROOFS) // 1024, "KB ·", len(MODEL), "brył")
