#!/usr/bin/env python3
"""
Generuje zastępcze klipy MP4/WebM dla demo SPEKTRE AIR (do czasu podmiany na
prawdziwe nagrania z głowic EO/IR).

Każdy klip to stylizowany obraz z głowicy obserwacyjnej: niebo lub morze,
sylwetka obiektu na horyzoncie, celownik, OSD (id sensora, czas, dane celu)
i znak wodny „NAGRANIE ZASTĘPCZE – DEMO”. Klipy zdarzeń mają animowane
sylwetki BSP / ptaków / jednostki w miejscach, w których aplikacja rysuje
ramki detekcji (pole `boxes` w js/data.js).

Użycie:  python3 tools/make_placeholder_videos.py [katalog_wyjściowy]
Wymaga:  pillow, numpy oraz ffmpeg (systemowy lub `pip install imageio-ffmpeg`).
"""
import math, os, random, shutil, subprocess, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS, SEC = 640, 360, 12, 8
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "videos")


def ffmpeg_bin():
    p = shutil.which("ffmpeg")
    if p:
        return p
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        sys.exit("Brak ffmpeg. Zainstaluj ffmpeg albo `pip install imageio-ffmpeg`.")


def font(size, bold=False):
    cands = ["/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
             "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
    for c in cands:
        if os.path.exists(c):
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


F_OSD, F_SM, F_WM = font(13, True), font(10), font(12)

# ---------------------------------------------------------------- palety
DUSK = dict(top=(44, 58, 78), bot=(96, 92, 86), ground=(28, 30, 28), ir=False, haze=(120, 120, 110))
DAY = dict(top=(74, 104, 134), bot=(150, 168, 180), ground=(40, 54, 48), ir=False, haze=(170, 180, 185))
IR = dict(top=(18, 18, 18), bot=(34, 34, 34), ground=(12, 12, 12), ir=True, haze=(60, 60, 60))


def sky(pal):
    img = Image.new("RGB", (W, H), pal["top"])
    d = ImageDraw.Draw(img)
    for y in range(H):
        k = y / H
        c = tuple(int(pal["top"][i] + (pal["bot"][i] - pal["top"][i]) * (k ** 1.4)) for i in range(3))
        d.line([(0, y), (W, y)], fill=c)
    return img


def plant_silhouette(d, pal, off):
    """Sylwetka elektrowni na horyzoncie."""
    hz = int(H * 0.74)
    d.rectangle([0, hz, W, H], fill=pal["ground"])
    c = tuple(max(0, v - 14) for v in pal["ground"])
    x0 = -off % 900
    for bx, bw, bh in [(40, 120, 54), (180, 60, 92), (260, 150, 44), (430, 40, 120), (500, 90, 66), (610, 130, 50), (760, 50, 110)]:
        x = bx - x0
        d.rectangle([x, hz - bh, x + bw, hz], fill=c)
        if bw < 60:  # komin / chłodnia
            d.polygon([(x, hz - bh), (x + bw * 0.3, hz - bh - 16), (x + bw * 0.7, hz - bh - 16), (x + bw, hz - bh)], fill=c)
    # linia energetyczna
    d.line([(0, hz - 30), (W, hz - 36)], fill=tuple(min(255, v + 18) for v in c), width=1)


def sea_silhouette(d, pal, off, turbines=True):
    hz = int(H * 0.62)
    d.rectangle([0, hz, W, H], fill=tuple(max(0, v - 6) for v in pal["ground"]))
    for i in range(70):
        y = hz + 4 + (i * 5) % (H - hz - 6)
        x = (i * 83 + off * 2) % W
        d.line([(x, y), (x + 14 + (i % 9), y)], fill=tuple(min(255, v + 16 + (i % 5) * 4) for v in pal["ground"]))
    if turbines:
        c = tuple(min(255, v + 40) for v in pal["ground"])
        for tx, sc in [(120, 1.0), (470, 0.7), (580, 0.5)]:
            x = tx - (off % 700)
            top = hz - int(90 * sc)
            d.line([(x, hz), (x, top)], fill=c, width=max(1, int(3 * sc)))
            for a in (0, 120, 240):
                r = math.radians(a + off * 2.4)
                d.line([(x, top), (x + math.cos(r) * 46 * sc, top + math.sin(r) * 46 * sc)], fill=c, width=max(1, int(2 * sc)))


def drone(d, cx, cy, s, pal, payload=False, fixed=False):
    c = (236, 240, 244) if pal["ir"] else (26, 28, 30)
    if fixed:   # płatowiec FPV
        d.polygon([(cx - s * 1.6, cy), (cx + s * 0.4, cy - s * 0.35), (cx + s * 1.5, cy), (cx + s * 0.4, cy + s * 0.35)], fill=c)
        d.line([(cx - s * 0.2, cy - s * 1.1), (cx - s * 0.2, cy + s * 1.1)], fill=c, width=max(1, int(s * 0.25)))
        return
    d.rectangle([cx - s * 0.5, cy - s * 0.3, cx + s * 0.5, cy + s * 0.35], fill=c)
    for dx, dy in ((-1, -0.8), (1, -0.8), (-1, 0.8), (1, 0.8)):
        ax, ay = cx + dx * s * 1.25, cy + dy * s * 0.75
        d.line([(cx, cy), (ax, ay)], fill=c, width=max(1, int(s * 0.18)))
        d.ellipse([ax - s * 0.75, ay - s * 0.16, ax + s * 0.75, ay + s * 0.16],
                  outline=c if not pal["ir"] else (200, 205, 210), width=1)
    if payload:
        d.rectangle([cx - s * 0.42, cy + s * 0.42, cx + s * 0.42, cy + s * 1.15],
                    fill=(255, 190, 140) if pal["ir"] else (40, 36, 34))


def bird(d, cx, cy, s, pal, phase):
    c = (210, 214, 220) if pal["ir"] else (40, 42, 46)
    a = math.sin(phase) * 0.6
    d.line([(cx - s, cy + a * s), (cx, cy - s * 0.3), (cx + s, cy + a * s)], fill=c, width=1)


def vessel(d, cx, cy, s, pal):
    c = (230, 234, 238) if pal["ir"] else (30, 34, 38)
    d.polygon([(cx - s, cy), (cx + s, cy), (cx + s * 0.7, cy + s * 0.28), (cx - s * 0.8, cy + s * 0.28)], fill=c)
    d.rectangle([cx - s * 0.25, cy - s * 0.36, cx + s * 0.25, cy], fill=c)
    if pal["ir"]:
        d.rectangle([cx + s * 0.3, cy - s * 0.18, cx + s * 0.5, cy], fill=(255, 210, 160))


def reticle(d, cx, cy, r=26):
    col = (120, 230, 255)
    for a in (0, 90, 180, 270):
        rr = math.radians(a)
        d.line([(cx + math.cos(rr) * r * 0.45, cy + math.sin(rr) * r * 0.45),
                (cx + math.cos(rr) * r, cy + math.sin(rr) * r)], fill=col, width=1)
    d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], outline=col)


def osd(d, title, sub, frame, pal):
    d.rectangle([0, 0, W, 22], fill=(0, 0, 0))
    d.rectangle([0, H - 20, W, H], fill=(0, 0, 0))
    col = (170, 220, 240) if not pal["ir"] else (200, 200, 200)
    d.text((8, 5), title, font=F_OSD, fill=col)
    t = 1800 + frame
    d.text((W - 150, 5), "%02d:%02d:%02d UTC" % ((t // 3600) % 24, (t // 60) % 60, t % 60), font=F_OSD, fill=col)
    d.text((8, H - 15), sub, font=F_SM, fill=col)
    d.text((W - 172, H - 15), "NAGRANIE ZASTĘPCZE – DEMO", font=F_SM, fill=(220, 170, 90))
    if (frame // 6) % 2 == 0:
        d.ellipse([W - 22, 6, W - 12, 16], fill=(220, 60, 70))


def grain(img, pal, amount=10):
    import numpy as np
    a = np.asarray(img).astype("int16")
    n = np.random.normal(0, amount, a.shape[:2])[:, :, None]
    a = (a + n).clip(0, 255).astype("uint8")
    im = Image.fromarray(a)
    if pal["ir"]:
        im = im.convert("L").convert("RGB")
    return im


# ---------------------------------------------------------------- klipy
# (plik, tytuł OSD, dolny OSD, paleta, scena, obiekty)
#   obiekty: ("drone"|"fixed"|"payload"|"bird"|"vessel", x%, y%, rozmiar)
CLIPS = [
    ("eoir-01", "EOIR-1 ROZDZIELNIA 400 kV", "DOZOR · SEKTOR E · ZOOM 1x", DUSK, "plant", []),
    ("eoir-02", "EOIR-2 HALA TURBIN", "DOZOR · SEKTOR N · ZOOM 1x", DUSK, "plant", []),
    ("eoir-03", "EOIR-3 CHLODNIE KOMINOWE", "DOZOR · SEKTOR S · ZOOM 1x", DAY, "plant", []),
    ("eoir-11", "EOIR-11 OSS BALTICA 2", "DOZOR · IR · SEKTOR NE", IR, "sea", []),
    ("eoir-12", "EOIR-12 TURBINA B-18", "DOZOR · SEKTOR SE · ZOOM 1x", DAY, "sea", []),
    ("eoir-13", "EOIR-13 TURBINA B-29", "SENSOR OFFLINE", IR, "sea", []),
    ("inc-01-recon", "EOIR-1 AUTOTRACKING TRK-1141", "BSP DJI MAVIC 3T · 95 m · 18 m/s · RID ODCZYTANY", DUSK, "plant",
     [("drone", 50, 35, 13)]),
    ("inc-02-payload", "EOIR-1 AUTOTRACKING TRK-1207", "BSP CIEZKI · LADUNEK PODWIESZONY · BRAK RID", DUSK, "plant",
     [("payload", 48, 33, 18)]),
    ("inc-03-birds", "EOIR-2 KLASYFIKACJA AUTOMATYCZNA", "PTAKI x11 · BSP AUTORYZOWANY 2025/114", DAY, "plant",
     [("bird", 30, 26, 7), ("bird", 36, 23, 6), ("bird", 41, 28, 6), ("bird", 34, 31, 5), ("drone", 68, 52, 10)]),
    ("inc-04-swarm", "EOIR-2 ROJ · 5 SLADOW", "BSP x5 · LOT AUTONOMICZNY · BRAK RC", DUSK, "plant",
     [("fixed", 21, 31, 11), ("fixed", 39, 25, 11), ("fixed", 57, 35, 12), ("fixed", 75, 27, 11)]),
    ("inc-05-vessel", "EOIR-11 AUTOTRACKING TRK-2104", "BSP · START Z JEDNOSTKI BEZ AIS · IR", IR, "sea",
     [("drone", 47, 37, 12), ("vessel", 34, 70, 34)]),
    ("inc-06-gnss", "EOIR-12 TRK-2211 · BSP INSPEKCYJNY", "ZAWIS · UTRATA GNSS · NAWIGACJA INS", DAY, "sea",
     [("drone", 52, 42, 12)]),
    ("inc-07-corridor", "EOIR-12 TRK-2250 · BSP 2025/207", "22 m OD PLASZCZYZNY OBROTU B-18", DAY, "sea",
     [("drone", 49, 41, 12)]),
]


def render(clip, frame):
    name, title, sub, pal, scene, objs = clip
    img = sky(pal)
    d = ImageDraw.Draw(img)
    off = frame * 0.6
    if scene == "plant":
        plant_silhouette(d, pal, off)
    else:
        sea_silhouette(d, pal, off)
    img = img.filter(ImageFilter.GaussianBlur(0.4))
    d = ImageDraw.Draw(img)
    ph = frame / FPS
    main = None
    for kind, px, py, s in objs:
        x = W * px / 100 + math.sin(ph * 0.9 + px) * 6
        y = H * py / 100 + math.sin(ph * 1.5 + py) * 4
        if kind == "bird":
            bird(d, x, y, s, pal, ph * 6 + px)
        elif kind == "vessel":
            vessel(d, x, y, s, pal)
        else:
            drone(d, x, y, s, pal, payload=(kind == "payload"), fixed=(kind == "fixed"))
            if main is None:
                main = (x, y)
    if main:
        reticle(d, *main)
    osd(d, title, sub, frame, pal)
    return grain(img, pal, 4 if not pal["ir"] else 7)


def encode(name, frames, ff):
    raw = b"".join(f.tobytes() for f in frames)
    base = os.path.join(OUT, name)
    common = [ff, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
              "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-"]
    subprocess.run(common + ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "32",
                             "-movflags", "+faststart", base + ".mp4"], input=raw, check=True)
    subprocess.run(common + ["-c:v", "libvpx-vp9", "-pix_fmt", "yuv420p", "-crf", "40", "-b:v", "0",
                             "-deadline", "realtime", "-cpu-used", "6", base + ".webm"], input=raw, check=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    ff = ffmpeg_bin()
    random.seed(7)
    for clip in CLIPS:
        frames = [render(clip, i) for i in range(FPS * SEC)]
        encode(clip[0], frames, ff)
        print("zapisano", clip[0] + ".mp4 / .webm")
    print("Gotowe:", os.path.abspath(OUT))


if __name__ == "__main__":
    main()
