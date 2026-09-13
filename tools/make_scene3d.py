#!/usr/bin/env python3
"""
Renderuje fotorealistyczny ukośny widok 3D powierzchni kopalni („z drona”)
na podstawie warstw z make_orthophoto.py:
  assets/orthophoto.jpg  – płaszczyzna gruntu
  assets/roofs.png       – dachy / wierzchy brył
  assets/site.json       – bryły (budynki, walce, hałdy, drzewa, wieża)
Wynik:
  assets/scene.jpg       – gotowy obraz sceny w układzie ekranu
  assets/scene_mask.png  – maska przezroczystości (parallelogram gruntu + bryły)

Rzut ukośny jest identyczny z funkcją P() w js/app.js:
  X = x + SH*y,  Y = FY*y − z      (SH = 0.45, FY = 0.5)

Użycie:  python3 tools/make_scene3d.py
Wymaga:  pillow, numpy
"""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "..", "assets")
SH, FY = 0.45, 0.5
PX = 3.2                                   # px na jednostkę świata (ekran)
FLAT_PX = 4                                # px na jednostkę w warstwach płaskich
model = json.load(open(os.path.join(ASSETS, "site.json")))
MAP = model["map"]
X0 = MAP["x"] + SH * MAP["y"]; X1 = MAP["x"] + MAP["w"] + SH * (MAP["y"] + MAP["h"])
Y0 = FY * MAP["y"] - 84;       Y1 = FY * (MAP["y"] + MAP["h"]) + 10
W, H = int((X1 - X0) * PX), int((Y1 - Y0) * PX)
rng = np.random.default_rng(5)

def S(x, y, z=0.0):
    return ((x + SH * y - X0) * PX, (FY * y - z - Y0) * PX)

flat = Image.open(os.path.join(ASSETS, "orthophoto.jpg")).convert("RGBA")
roofs = Image.open(os.path.join(ASSETS, "roofs.png")).convert("RGBA")
scene = Image.new("RGBA", (W, H), (0, 0, 0, 0))

# ---------------------------------------------------------------- grunt
def flat_affine(zshift=0.0):
    """Współczynniki AFFINE (piksel wyjścia → piksel warstwy płaskiej) dla płaszczyzny podniesionej o zshift."""
    a = FLAT_PX / PX
    b = -FLAT_PX * SH / (PX * FY)
    e = FLAT_PX / (PX * FY)
    c = FLAT_PX * (X0 - SH * Y0 / FY - MAP["x"])
    f = FLAT_PX * (Y0 / FY - MAP["y"])
    # podniesienie o z: piksel (X, Y) ekranu odpowiada gruntowi w (X, Y + z*PX)
    c += b * zshift * PX; f += e * zshift * PX
    return (a, b, c, 0, e, f)

ground = flat.transform((W, H), Image.AFFINE, flat_affine(0), resample=Image.BICUBIC)
# krawędź terenu (skarpa gruntu) pod przednią i prawą krawędzią
edge = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ed = ImageDraw.Draw(edge)
mx, my, mw, mh = MAP["x"], MAP["y"], MAP["w"], MAP["h"]
soil = np.asarray(Image.fromarray((rng.random((64, 256)) * 255).astype(np.uint8)).resize((W, 40), Image.BICUBIC))
ed.polygon([S(mx, my + mh, 0), S(mx + mw, my + mh, 0), S(mx + mw, my + mh, -8), S(mx, my + mh, -8)], fill=(74, 62, 50, 255))
ed.polygon([S(mx + mw, my, 0), S(mx + mw, my + mh, 0), S(mx + mw, my + mh, -8), S(mx + mw, my, -8)], fill=(58, 48, 40, 255))
scene.alpha_composite(edge)
scene.alpha_composite(ground)

# ---------------------------------------------------------------- tekstury elewacji
def noise(w, h, scale=6, seed=0, amp=1.0):
    r = np.random.default_rng(seed)
    g = r.random((max(2, h // scale) + 1, max(2, w // scale) + 1)).astype(np.float32)
    return (np.asarray(Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), np.float32) / 255 - 0.5) * amp

def facade_texture(kind, wpx, hpx, hunits, seed):
    """Zwraca RGB (hpx × wpx) z fakturą elewacji i oknami. Oś v: góra → dół."""
    wpx, hpx = max(2, int(wpx)), max(2, int(hpx))
    base = {"office": (176, 164, 148), "hall": (150, 154, 160), "plant": (156, 160, 166), "brick": (128, 84, 70), "concrete": (150, 148, 142), "metal": (196, 198, 200), "coal": (26, 26, 28)}[kind]
    img = np.zeros((hpx, wpx, 3), np.float32) + np.array(base, np.float32)
    img += noise(wpx, hpx, 5, seed, 26)[..., None]; img += noise(wpx, hpx, 40, seed + 1, 30)[..., None]
    pil = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)); d = ImageDraw.Draw(pil)
    ppu = hpx / max(hunits, 1)                    # px na jednostkę wysokości
    if kind in ("hall", "plant"):                 # blacha trapezowa: pionowe żebra
        for x in range(0, wpx, max(2, int(ppu * 0.9))):
            d.line([(x, 0), (x, hpx)], fill=tuple(max(0, c - 22) for c in base), width=1)
            d.line([(x + 1, 0), (x + 1, hpx)], fill=tuple(min(255, c + 10) for c in base), width=1)
        # cokół i pas okien świetlikowych
        d.rectangle([0, hpx - ppu * 1.2, wpx, hpx], fill=tuple(max(0, c - 40) for c in base))
        if hunits >= 12:
            d.rectangle([0, ppu * 1.5, wpx, ppu * 3.2], fill=(72, 84, 100))
            for x in range(4, wpx, max(6, int(ppu * 2.2))): d.line([(x, ppu * 1.5), (x, ppu * 3.2)], fill=(140, 150, 160), width=1)
        # brama wjazdowa
        if wpx > 60 and hunits >= 12:
            gx = int(wpx * 0.62); d.rectangle([gx, hpx - ppu * 6, gx + ppu * 5, hpx], fill=(70, 74, 80)); d.rectangle([gx + 2, hpx - ppu * 6 + 2, gx + ppu * 5 - 2, hpx - 2], fill=(96, 100, 106))
    elif kind == "office":                        # płyty + rzędy okien
        for x in range(0, wpx, max(4, int(ppu * 3))): d.line([(x, 0), (x, hpx)], fill=tuple(max(0, c - 18) for c in base), width=1)
        floors = max(1, int(hunits / 5.5))
        for fl in range(floors):
            y0 = hpx - ppu * (5.5 * fl + 4.2); y1 = hpx - ppu * (5.5 * fl + 1.6)
            if y0 < 1: continue
            for x in range(int(ppu * 0.8), wpx - int(ppu * 1.2), max(5, int(ppu * 2.4))):
                d.rectangle([x, y0, x + ppu * 1.5, y1], fill=(54, 68, 88)); d.rectangle([x + 1, y0 + 1, x + ppu * 0.7, y0 + (y1 - y0) * 0.45], fill=(120, 140, 160))
        d.rectangle([0, hpx - ppu * 0.8, wpx, hpx], fill=tuple(max(0, c - 45) for c in base))
        if wpx > 40:
            gx = int(wpx * 0.2); d.rectangle([gx, hpx - ppu * 3.2, gx + ppu * 1.6, hpx], fill=(60, 60, 64))
    elif kind == "brick":
        for y in range(0, hpx, 3): d.line([(0, y), (wpx, y)], fill=tuple(max(0, c - 22) for c in base), width=1)
        d.rectangle([0, hpx - ppu * 0.8, wpx, hpx], fill=(70, 62, 58))
    elif kind == "metal":                         # blacha zbiornika: pionowe szwy, zacieki rdzy
        for x in range(0, wpx, max(3, int(ppu * 2.5))): d.line([(x, 0), (x, hpx)], fill=(150, 152, 154), width=1)
        for y in range(int(ppu * 3), hpx, max(4, int(ppu * 3.5))): d.line([(0, y), (wpx, y)], fill=(160, 162, 164), width=1)
        r = np.random.default_rng(seed + 7)
        for _ in range(max(1, wpx // 14)):
            x = int(r.integers(0, wpx)); y = int(r.integers(0, max(1, hpx // 2)))
            d.line([(x, y), (x, min(hpx, y + int(r.integers(6, hpx // 2 + 8))))], fill=(150, 110, 80), width=1)
    elif kind == "concrete":
        for x in range(0, wpx, max(4, int(ppu * 3))): d.line([(x, 0), (x, hpx)], fill=tuple(max(0, c - 16) for c in base), width=1)
        d.rectangle([0, hpx - ppu * 0.8, wpx, hpx], fill=tuple(max(0, c - 40) for c in base))
    elif kind == "coal":
        pass
    return pil

def paste_quad(tex, quad, shade=1.0, ao=0.35):
    """Mapuje teksturę (prostokąt) na czworokąt ekranu (TL, TR, BR, BL); cieniuje i wkleja do sceny."""
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = quad
    tw, th = tex.size
    # afiniczne: tex(u,v) → ekran: E = TL + u/tw*(TR-TL) + v/th*(BL-TL)
    ax, ay = (x1 - x0) / tw, (y1 - y0) / tw
    bx, by = (x3 - x0) / th, (y3 - y0) / th
    det = ax * by - ay * bx
    if abs(det) < 1e-9: return
    ia, ib, ic, id_ = by / det, -bx / det, -ay / det, ax / det   # odwrotność
    minx, maxx = int(min(x0, x1, x2, x3)) - 1, int(max(x0, x1, x2, x3)) + 2
    miny, maxy = int(min(y0, y1, y2, y3)) - 1, int(max(y0, y1, y2, y3)) + 2
    ow, oh = max(1, maxx - minx), max(1, maxy - miny)
    # u = ia*(X-x0) + ib*(Y-y0), v = ic*(X-x0) + id*(Y-y0)  (X = minx + xo)
    data = (ia, ib, ia * (minx - x0) + ib * (miny - y0), ic, id_, ic * (minx - x0) + id_ * (miny - y0))
    piece = tex.transform((ow, oh), Image.AFFINE, data, resample=Image.BILINEAR)
    arr = np.asarray(piece).astype(np.float32)
    # cieniowanie: jasność ściany + okluzja przy podstawie
    v = np.linspace(0, 1, oh, dtype=np.float32)[:, None, None]
    yy = np.arange(oh)[:, None]
    # udział v (0 góra → 1 dół) liczony w układzie ekranu dla każdego piksela
    xs = np.arange(ow)[None, :] + minx - x0; ys = yy + miny - y0
    vv = np.clip((ic * xs + id_ * ys) / th, 0, 1)[..., None]
    arr = arr * (shade * (1.0 - ao * vv ** 2.2))
    piece = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert("RGBA")
    mask = Image.new("L", (ow, oh), 0)
    ImageDraw.Draw(mask).polygon([(x0 - minx, y0 - miny), (x1 - minx, y1 - miny), (x2 - minx, y2 - miny), (x3 - minx, y3 - miny)], fill=255)
    piece.putalpha(mask)
    scene.alpha_composite(piece, (minx, miny))

# ---------------------------------------------------------------- bryły
LIGHT = np.array([-0.6, -0.8]); LIGHT /= np.linalg.norm(LIGHT)      # słońce z NW

def face_shade(nx, ny):
    n = np.array([nx, ny]); n = n / (np.linalg.norm(n) or 1)
    lit = float(np.dot(n, LIGHT))                                    # >0 = ku słońcu
    return 0.62 + 0.30 * max(0.0, lit) - 0.12 * max(0.0, -lit) + 0.06 * n[0]

def visible(nx, ny): return nx * SH + ny * 1.0 > 0

def draw_box(o, seed):
    x, y, w, d, h, kind = o["x"], o["y"], o["w"], o["d"], o["h"], o.get("k", "concrete")
    edges = [((x, y + d), (x + w, y + d), (0, 1)), ((x + w, y), (x + w, y + d), (1, 0))]    # południowa, wschodnia
    for a, b, n in edges:
        if not visible(*n): continue
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        tex = facade_texture(kind, L * PX, h * PX, h, seed)
        paste_quad(tex, [S(*a, h), S(*b, h), S(*b, 0), S(*a, 0)], shade=face_shade(*n))
    draw_roof([(x, y), (x + w, y), (x + w, y + d), (x, y + d)], h)

def draw_roof(poly, h):
    piece = roofs.transform((W, H), Image.AFFINE, flat_affine(h), resample=Image.BICUBIC)
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).polygon([S(px, py, h) for px, py in poly], fill=255)
    a = np.asarray(piece.getchannel("A")).astype(np.uint16) * np.asarray(mask).astype(np.uint16) // 255
    piece.putalpha(Image.fromarray(a.astype(np.uint8)))
    scene.alpha_composite(piece)
    d = ImageDraw.Draw(scene)
    pts = [S(px, py, h) for px, py in poly]
    d.line(pts + [pts[0]], fill=(255, 255, 255, 70), width=1)                     # attyka / krawędź dachu
    d.line([S(poly[3][0], poly[3][1], h), S(poly[2][0], poly[2][1], h)], fill=(30, 30, 30, 120), width=1)

def draw_cyl(o, seed, kind="metal", top=True):
    cx, cy, r, h = o["x"], o["y"], o["r"], o["h"]
    n = 24
    for i in range(n):
        t0, t1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        nx, ny = math.cos((t0 + t1) / 2), math.sin((t0 + t1) / 2)
        if not visible(nx, ny): continue
        a = (cx + r * math.cos(t0), cy + r * math.sin(t0)); b = (cx + r * math.cos(t1), cy + r * math.sin(t1))
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        tex = facade_texture(kind, max(2, L * PX), h * PX, h, seed + i)
        paste_quad(tex, [S(*a, h), S(*b, h), S(*b, 0), S(*a, 0)], shade=face_shade(nx, ny) + 0.05, ao=0.3)
    if top: draw_roof([(cx + r * math.cos(2 * math.pi * i / 32), cy + r * math.sin(2 * math.pi * i / 32)) for i in range(32)], h)

def draw_cone(o, seed):
    pts = o["pts"]; h = o["h"]
    cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
    apex = S(cx, cy, h)
    d = ImageDraw.Draw(scene)
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        nx, ny = (b[1] - a[1]), -(b[0] - a[0])
        if not visible(nx, ny): continue
        sh = face_shade(nx, ny) * 0.9
        col = tuple(int(c * sh) for c in (60, 60, 62)) + (255,)
        d.polygon([apex, S(*a, 0), S(*b, 0)], fill=col)
    # ziarno węgla
    g = noise(int(40 * PX), int(20 * PX), 2, seed, 60)
    top = draw_roof(pts, h)

def draw_tree(o):
    x, y, r, v = o["x"], o["y"], o["r"], o.get("v", 0)
    col = [(52, 84, 44), (66, 100, 48), (46, 76, 40)][v]
    cx, cy = S(x, y, r * 1.1)
    R = r * PX
    layer = Image.new("RGBA", (int(R * 2.6) + 4, int(R * 2.6) + 4), (0, 0, 0, 0)); ld = ImageDraw.Draw(layer)
    c0 = (layer.size[0] / 2, layer.size[1] / 2)
    # pień
    tx, ty = S(x, y, 0)
    ImageDraw.Draw(scene).line([(tx, ty), (cx, cy)], fill=(70, 56, 40, 255), width=max(1, int(R * 0.18)))
    for k in range(6, 0, -1):
        f = k / 6
        cc = tuple(int(c * (0.55 + 0.6 * (1 - f))) for c in col)
        ld.ellipse([c0[0] - R * f * 1.15 - (1 - f) * R * 0.3, c0[1] - R * f * 1.05 - (1 - f) * R * 0.35, c0[0] + R * f * 1.15 - (1 - f) * R * 0.3, c0[1] + R * f * 0.95 - (1 - f) * R * 0.35], fill=cc + (255,))
    layer = layer.filter(ImageFilter.GaussianBlur(0.6))
    scene.alpha_composite(layer, (int(cx - layer.size[0] / 2), int(cy - layer.size[1] / 2)))

def draw_tower(o):
    x, y, w, d, h = o["x"], o["y"], o["w"], o["d"], o["h"]
    dr = ImageDraw.Draw(scene)
    ins = 4
    base = [(x, y), (x + w, y), (x + w, y + d), (x, y + d)]
    top = [(x + ins, y + ins), (x + w - ins, y + ins), (x + w - ins, y + d - ins), (x + ins, y + d - ins)]
    steel, steel_d = (176, 184, 190, 255), (96, 104, 110, 255)
    for k in range(1, 6):
        f = k / 6; z = h * f
        c = [(base[i][0] + (top[i][0] - base[i][0]) * f, base[i][1] + (top[i][1] - base[i][1]) * f) for i in range(4)]
        for i, j in [(3, 2), (1, 2), (0, 1), (0, 3)]:
            dr.line([S(c[i][0], c[i][1], z), S(c[j][0], c[j][1], z)], fill=steel_d, width=2)
        f2 = (k - 1) / 6; z2 = h * f2
        c2 = [(base[i][0] + (top[i][0] - base[i][0]) * f2, base[i][1] + (top[i][1] - base[i][1]) * f2) for i in range(4)]
        for i, j in [(3, 2), (1, 2)]:
            dr.line([S(c2[i][0], c2[i][1], z2), S(c[j][0], c[j][1], z)], fill=steel_d, width=1)
            dr.line([S(c2[j][0], c2[j][1], z2), S(c[i][0], c[i][1], z)], fill=steel_d, width=1)
    for i in range(4):
        dr.line([S(base[i][0], base[i][1], 0), S(top[i][0], top[i][1], h)], fill=steel, width=3)
    # platforma z kołami linowymi i dach maszynowni na szczycie
    plat = [S(px, py, h) for px, py in top]
    dr.polygon(plat, fill=(150, 44, 44, 255)); dr.line(plat + [plat[0]], fill=(230, 230, 230, 255), width=1)
    cx, cy = S(x + w / 2, y + d / 2, h)
    for dx in (-4.2 * PX / 3.2, 4.2 * PX / 3.2):
        dr.ellipse([cx + dx - 4.5 * PX / 3.2 * 1.5, cy - 7 * PX / 3.2 * 1.5 - 4, cx + dx + 4.5 * PX / 3.2 * 1.5, cy + 2 * PX / 3.2 * 1.5 - 4], outline=(225, 232, 236, 255), width=2)
    dr.line([(cx - 4 * PX, cy - 8), (cx + 4 * PX, cy - 8)], fill=(200, 210, 216, 255), width=2)

def draw_bridge():
    """Most przenośnikowy nadszybie → zakład przeróbczy (zamknięta galeria na podporach)."""
    dr = ImageDraw.Draw(scene)
    a, b = (281, 50), (330, 58); za, zb = 30, 24; wdt = 3.2
    # podpory
    for t in (0.3, 0.65):
        px_, py_ = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t; z = za + (zb - za) * t
        dr.line([S(px_, py_, 0), S(px_, py_, z - 3)], fill=(120, 126, 132, 255), width=3)
        dr.line([S(px_ + 2, py_ + 1, 0), S(px_ + 2, py_ + 1, z - 3)], fill=(100, 106, 112, 255), width=2)
    # ściana i dach galerii
    dr.polygon([S(a[0], a[1] + wdt, za), S(b[0], b[1] + wdt, zb), S(b[0], b[1] + wdt, zb - 3.5), S(a[0], a[1] + wdt, za - 3.5)], fill=(118, 124, 130, 255))
    dr.polygon([S(a[0], a[1], za), S(b[0], b[1], zb), S(b[0], b[1] + wdt, zb), S(a[0], a[1] + wdt, za)], fill=(176, 180, 184, 255))
    for t in np.linspace(0.05, 0.95, 9):
        px_, py_ = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t; z = za + (zb - za) * t
        dr.line([S(px_, py_ + wdt, z - 0.4), S(px_, py_ + wdt, z - 3.1)], fill=(90, 96, 102, 255), width=1)

def draw_masts():
    dr = ImageDraw.Draw(scene)
    for (x, y) in [(2, 2), (518, 2), (518, 198), (2, 198), (150, 150), (300, 150), (420, 2), (260, 2)]:
        dr.line([S(x, y, 0), S(x, y, 22)], fill=(150, 156, 162, 255), width=2)
        hx, hy = S(x, y, 22); dr.ellipse([hx - 3, hy - 2, hx + 3, hy + 2], fill=(255, 244, 200, 255))
    # słupki ogrodzenia
    for x in range(2, 519, 12):
        for y in (2, 198): dr.line([S(x, y, 0), S(x, y, 2.4)], fill=(210, 210, 205, 200), width=1)
    for y in range(2, 199, 12):
        for x in (2, 518): dr.line([S(x, y, 0), S(x, y, 2.4)], fill=(210, 210, 205, 200), width=1)
    dr.line([S(2, 198, 2.4), S(518, 198, 2.4)], fill=(215, 215, 210, 150), width=1)
    dr.line([S(518, 2, 2.4), S(518, 198, 2.4)], fill=(215, 215, 210, 150), width=1)

# kolejność: od tyłu (małe y) do przodu
items = []
for i, o in enumerate(model["objects"]):
    if o["t"] == "cyl": key = o["y"] + o["r"]
    elif o["t"] == "poly": key = max(p[1] for p in o["pts"])
    elif o["t"] == "tree": key = o["y"] + o["r"]
    else: key = o["y"] + o["d"]
    items.append((key + 0.001 * o.get("x", 0), i, o))
items.sort()
bridge_done = False
for key, i, o in items:
    if o["t"] == "box": draw_box(o, i)
    elif o["t"] == "tower": draw_tower(o)
    elif o["t"] == "cyl": draw_cyl(o, i, "metal")
    elif o["t"] == "poly": draw_cone(o, i)
    elif o["t"] == "tree": draw_tree(o)
    if not bridge_done and key > 60:
        draw_bridge(); bridge_done = True
draw_masts()

# ---------------------------------------------------------------- postprodukcja
rgb = np.asarray(scene.convert("RGB")).astype(np.float32)
alpha = np.asarray(scene.getchannel("A"))
# mgiełka atmosferyczna – dalej (góra) jaśniej i chłodniej
t = np.linspace(1, 0, H, dtype=np.float32)[:, None, None]
rgb = rgb * (1 - 0.16 * t) + np.array([196, 206, 218], np.float32) * (0.16 * t)
# lekkie ocieplenie świateł, kontrast
rgb = (rgb - 128) * 1.06 + 128 + np.array([3, 1, -2], np.float32)
rgb += rng.normal(0, 2.6, (H, W, 1)).astype(np.float32)
out = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
out = out.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
out = ImageEnhance.Color(out).enhance(0.94)
# maska: obszar gruntu + bryły (alpha > 0), lekko zmiękczona krawędź
mask = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.4))
out.save(os.path.join(ASSETS, "scene.jpg"), quality=86, optimize=True, subsampling=1)
mask.save(os.path.join(ASSETS, "scene_mask.png"), optimize=True)
with open(os.path.join(HERE, "..", "js", "site.js"), "w", encoding="utf-8") as f:
    f.write("/* wygenerowane przez tools/make_scene3d.py – geometria obrazu sceny 3D */\n")
    f.write("window.SITE_MODEL = " + json.dumps({"map": MAP, "scene": {"x": X0, "y": Y0, "w": X1 - X0, "h": Y1 - Y0}, "sh": SH, "fy": FY}) + ";\n")
print("scene", out.size, os.path.getsize(os.path.join(ASSETS, "scene.jpg")) // 1024, "KB · mask", os.path.getsize(os.path.join(ASSETS, "scene_mask.png")) // 1024, "KB")
