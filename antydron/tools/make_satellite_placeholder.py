#!/usr/bin/env python3
"""
Generuje ZASTĘPCZY podkład „satelitarny” dla widoku SATELITA – do czasu pobrania
prawdziwego zdjęcia skryptem tools/fetch_satellite.py.

Obraz jest rysowany z tej samej geometrii, co plan wektorowy (js/data.js), więc
warstwa taktyczna leży na nim idealnie. Każdy kafel ma widoczny znak wodny
„PODKŁAD ZASTĘPCZY”, żeby nikt nie wziął go za zdjęcie satelitarne.

Użycie:  python3 tools/make_satellite_placeholder.py
Wymaga:  pillow, numpy, node (do odczytania geometrii z js/data.js).
"""
import json, math, os, random, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS = os.path.join(ROOT, "assets")
K = 2                      # pikseli na jednostkę planu (1 j. = 10 m → 5 m/px)
W, H = 1000 * K, 620 * K


def load_sites():
    js = "global.window={};require(%s);process.stdout.write(JSON.stringify(window.AIR_DATA.sites))" % json.dumps(
        os.path.join(ROOT, "js", "data.js"))
    return json.loads(subprocess.run(["node", "-e", js], capture_output=True, check=True).stdout)


def font(size):
    for c in ["/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if os.path.exists(c):
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


def noise(w, h, scale, seed=0):
    """Szum o zadanej ziarnistości (powiększany bilinearnie)."""
    rng = np.random.default_rng(seed)
    small = rng.random((max(2, h // scale), max(2, w // scale)))
    return np.asarray(Image.fromarray((small * 255).astype("uint8")).resize((w, h), Image.BILINEAR), dtype=float) / 255


def land_base():
    """Mozaika pól, lasów i nieużytków – tło dla obiektu lądowego."""
    rng = random.Random(11)
    img = Image.new("RGB", (W, H), (96, 104, 74))
    d = ImageDraw.Draw(img)
    palette = [(108, 118, 74), (126, 128, 86), (92, 104, 66), (138, 130, 96), (116, 110, 78),
               (84, 96, 60), (146, 140, 104), (104, 116, 72)]
    for _ in range(190):                      # działki rolne
        x, y = rng.randrange(-100, W), rng.randrange(-100, H)
        w, h = rng.randrange(60, 320), rng.randrange(40, 180)
        a = rng.choice([0, 0, 0, 12, -9])
        p = Image.new("RGBA", (w, h), rng.choice(palette) + (255,))
        img.paste(p.rotate(a, expand=True), (x, y), p.rotate(a, expand=True))
    for _ in range(26):                       # laski
        x, y = rng.randrange(0, W), rng.randrange(0, H)
        r = rng.randrange(40, 130)
        d.ellipse([x - r, y - int(r * .7), x + r, y + int(r * .7)], fill=(46, 66, 42))
    img = img.filter(ImageFilter.GaussianBlur(1.4))
    d = ImageDraw.Draw(img)
    for _ in range(40):                       # zadrzewienia śródpolne / miedze
        x, y = rng.randrange(0, W), rng.randrange(0, H)
        d.line([(x, y), (x + rng.randrange(-200, 200), y + rng.randrange(-120, 120))],
               fill=(58, 74, 48), width=rng.randrange(2, 5))
    return img


def opencast_mine(img):
    """Odkrywka na zachodnim skraju kadru – tarasy i skarpy."""
    d = ImageDraw.Draw(img, "RGBA")
    cx, cy = int(-60 * K), int(300 * K)
    for i, r in enumerate(range(int(560 * K), int(120 * K), -int(46 * K))):
        tone = 118 - i * 7
        d.ellipse([cx - r, cy - int(r * .62), cx + r, cy + int(r * .62)],
                  fill=(tone, tone - 10, tone - 24, 255), outline=(tone - 26, tone - 32, tone - 42, 255), width=3)
    return img


def sea_base():
    """Powierzchnia morza – fala, smugi wiatru, jaśniejsze grzywy."""
    y, x = np.mgrid[0:H, 0:W]
    base = (np.sin((x * .9 + y * 1.8) / 26) * .5 + .5) * .18
    base += noise(W, H, 7, 3) * .34 + noise(W, H, 29, 4) * .30 + noise(W, H, 90, 5) * .18
    streak = (np.sin((x * 1.6 - y * .7) / 150) * .5 + .5) * .10
    v = np.clip(base + streak, 0, 1)
    r = 16 + v * 46
    g = 32 + v * 62
    b = 46 + v * 74
    return Image.fromarray(np.dstack([r, g, b]).astype("uint8")).filter(ImageFilter.GaussianBlur(.6))


def draw_site(img, site):
    """Rysuje bryły, place i drogi z tej samej geometrii, co plan wektorowy."""
    d = ImageDraw.Draw(img, "RGBA")
    SH = (6, 7)   # przesunięcie cienia (słońce z NW, jak na zdjęciach lotniczych)

    def box(x, y, w, h, fill, shadow=True, outline=None):
        X, Y, Wd, Ht = x * K, y * K, w * K, h * K
        if shadow:
            d.rectangle([X + SH[0], Y + SH[1], X + Wd + SH[0], Y + Ht + SH[1]], fill=(28, 30, 28, 150))
        d.rectangle([X, Y, X + Wd, Y + Ht], fill=fill, outline=outline, width=2)

    for o in site.get("geo", []):
        t, cls = o.get("t"), (o.get("cls") or "")
        if "land" in cls or "sea" in cls:
            continue                            # tło rysuje tekstura terenu / morza
        if t == "rect":
            if "sw-yard" in cls:
                box(o["x"], o["y"], o["w"], o["h"], (150, 148, 140, 255), shadow=False)
                for i in range(1, 6):          # pola rozdzielni
                    yy = (o["y"] + i * o["h"] / 6) * K
                    d.line([(o["x"] * K + 6, yy), ((o["x"] + o["w"]) * K - 6, yy)], fill=(176, 176, 170, 255), width=3)
            elif "yard" in cls:
                box(o["x"], o["y"], o["w"], o["h"], (44, 40, 38, 255), shadow=False)
                for _ in range(90):            # pryzmy węgla
                    rx = random.uniform(o["x"], o["x"] + o["w"]) * K
                    ry = random.uniform(o["y"], o["y"] + o["h"]) * K
                    d.ellipse([rx - 9, ry - 5, rx + 9, ry + 5], fill=(34, 31, 30, 255))
            else:
                roof = (128, 132, 134, 255) if "hot" not in cls else (112, 116, 120, 255)
                box(o["x"], o["y"], o["w"], o["h"], roof, outline=(92, 96, 98, 255))
                for i in range(1, max(2, int(o["w"] / 14))):   # świetliki / żebra dachu
                    xx = (o["x"] + i * 14) * K
                    d.line([(xx, o["y"] * K + 4), (xx, (o["y"] + o["h"]) * K - 4)], fill=(142, 146, 148, 120), width=2)
        elif t == "circle":
            cx, cy, r = o["cx"] * K, o["cy"] * K, o["r"] * K
            if "tower" in cls:                 # chłodnia kominowa + pióropusz pary
                d.ellipse([cx - r + SH[0] * 2, cy - r + SH[1] * 2, cx + r + SH[0] * 2, cy + r + SH[1] * 2], fill=(30, 32, 30, 160))
                d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(148, 148, 146, 255), outline=(108, 110, 108, 255), width=3)
                d.ellipse([cx - r * .62, cy - r * .62, cx + r * .62, cy + r * .62], fill=(70, 72, 72, 255))
                for i in range(7):
                    f = 1 + i * .34
                    d.ellipse([cx - r * f + i * 11, cy - r * f - i * 13, cx + r * f + i * 11, cy + r * f - i * 13],
                              fill=(226, 228, 230, max(8, 60 - i * 8)))
            elif "stack" in cls:               # komin + długi cień
                d.polygon([(cx, cy), (cx + r * 7.5, cy + r * 5.5), (cx + r * 7.0, cy + r * 6.6), (cx - r * .5, cy + r * .7)],
                          fill=(32, 34, 32, 170))
                d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(196, 194, 190, 255), outline=(120, 118, 114, 255), width=3)
                d.ellipse([cx - r * .5, cy - r * .5, cx + r * .5, cy + r * .5], fill=(60, 60, 58, 255))
        elif t == "line":
            pts = [(p[0] * K, p[1] * K) for p in o["pts"]]
            if "road" in cls:
                d.line(pts, fill=(126, 126, 124, 255), width=int(5 * K), joint="curve")
                d.line(pts, fill=(150, 150, 148, 255), width=int(3.4 * K), joint="curve")
            elif "rail" in cls:
                d.line(pts, fill=(104, 100, 96, 255), width=int(2.4 * K), joint="curve")
            elif "conv" in cls:
                d.line(pts, fill=(92, 94, 92, 255), width=int(3 * K), joint="curve")
            elif "cable" in cls:
                pass
        elif t == "poly" and "fence" in cls:
            d.line([(p[0] * K, p[1] * K) for p in o["pts"]] + [(o["pts"][0][0] * K, o["pts"][0][1] * K)],
                   fill=(176, 176, 170, 190), width=2)
        elif t == "vessel":                    # kilwater jednostki na morzu
            cx, cy = o["cx"] * K, o["cy"] * K
            a = math.radians(o.get("dir", 0) + 180)
            for i in range(26):
                f = i * 7
                d.ellipse([cx + math.cos(a) * f - 3 - i, cy + math.sin(a) * f - 3 - i * .4,
                           cx + math.cos(a) * f + 3 + i, cy + math.sin(a) * f + 3 + i * .4],
                          fill=(200, 212, 220, max(4, 70 - i * 3)))
    return img


def finish(img, caption):
    """Ziarno, lekka nieostrość, winieta i znak wodny."""
    a = np.asarray(img).astype("int16")
    a = (a + np.random.normal(0, 4.5, a.shape[:2])[:, :, None]).clip(0, 255).astype("uint8")
    img = Image.fromarray(a).filter(ImageFilter.GaussianBlur(.5))
    y, x = np.mgrid[0:H, 0:W]
    v = 1 - .22 * (((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2)
    img = Image.fromarray((np.asarray(img) * v[:, :, None]).clip(0, 255).astype("uint8"))

    wm = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dw = ImageDraw.Draw(wm)
    f = font(26)
    for ty in range(0, H + 300, 230):
        for tx in range(-260, W, 980):
            dw.text((tx + (ty // 230 % 2) * 490, ty), "PODKŁAD ZASTĘPCZY · NIE JEST ZDJĘCIEM SATELITARNYM",
                    font=f, fill=(255, 255, 255, 34))
    dw.rectangle([0, H - 56, W, H], fill=(0, 0, 0, 150))
    dw.text((20, H - 42), caption, font=font(22), fill=(235, 238, 240, 230))
    img = Image.alpha_composite(img.convert("RGBA"), wm).convert("RGB")
    return img


def main():
    random.seed(5)
    np.random.seed(5)
    sites = load_sites()
    os.makedirs(ASSETS, exist_ok=True)
    meta_path = os.path.join(ASSETS, "satellite.json")
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}

    for name, site in sites.items():
        if site.get("kind") == "onshore":
            img = opencast_mine(land_base())
            cap = "PODKŁAD ZASTĘPCZY – wygenerowany. Pobierz ortofotomapę: python3 tools/fetch_satellite.py"
        else:
            img = sea_base()
            cap = "PODKŁAD ZASTĘPCZY – wygenerowany. Farma w budowie: zdjęcie pokaże otwarty akwen."
        img = draw_site(img, site)
        img = finish(img, cap)
        out = os.path.join(ASSETS, f"sat-{name}.jpg")
        img.save(out, quality=78, optimize=True)
        meta[name] = dict(file=f"assets/sat-{name}.jpg", source="placeholder",
                          attribution="podkład zastępczy (wygenerowany) – wstaw ortofotomapę GUGiK lub zdjęcie satelitarne",
                          m_per_unit=10, px=[W, H], placeholder=True)
        print(f"zapisano {out} ({os.path.getsize(out) // 1024} kB)")

    json.dump(meta, open(meta_path, "w"), ensure_ascii=False, indent=2)
    print("georeferencja:", meta_path)


if __name__ == "__main__":
    main()
