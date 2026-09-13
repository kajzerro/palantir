#!/usr/bin/env python3
"""
Generuje zastępcze klipy MP4 dla demo (do czasu podmiany na prawdziwe nagrania).

Każdy klip to stylizowany obraz z kamery przemysłowej: perspektywiczna podłoga,
kilka brył „wyposażenia”, ziarno, migotanie, napisy OSD (id kamery, czas)
i znak wodny „NAGRANIE ZASTĘPCZE – DEMO”. Klipy zdarzeń mają dodatkowo
animowaną sylwetkę osoby / pojazdu / dymu w miejscu, gdzie aplikacja rysuje
ramki detekcji (pole `boxes` w js/data.js).

Użycie:  python3 tools/make_placeholder_videos.py [katalog_wyjściowy]
Wymaga:  pillow, numpy oraz ffmpeg (systemowy lub z pakietu imageio-ffmpeg).
"""
import math, os, random, shutil, subprocess, sys, time
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS, SEC = 640, 360, 12, 10
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "videos")

def ffmpeg():
    p = shutil.which("ffmpeg")
    if p: return p
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        sys.exit("Brak ffmpeg. Zainstaluj ffmpeg albo `pip install imageio-ffmpeg`.")

def font(size, bold=False):
    for cand in ["/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
                 "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if os.path.exists(cand): return ImageFont.truetype(cand, size)
    return ImageFont.load_default()

F_OSD, F_BIG, F_WM = font(14, True), font(22, True), font(13)

# ---------- sceny ----------
# tone: (tło, podłoga, ściany) – powierzchnia jasna/chłodna, dół ciemny/ciepły
SURF = dict(bg=(52, 58, 64), floor=(70, 74, 78), wall=(88, 94, 100), light=(210, 215, 220), ir=False)
UG   = dict(bg=(18, 16, 14), floor=(38, 34, 30), wall=(52, 46, 40), light=(180, 170, 150), ir=True)
NIGHT= dict(bg=(20, 24, 30), floor=(34, 40, 48), wall=(46, 54, 62), light=(150, 170, 190), ir=True)

CAMS = {
    "cam-01": ("KAM-01 BRAMA GLOWNA",        SURF, "gate"),
    "cam-02": ("KAM-02 LAMPOWNIA / LAZNIA",  SURF, "hall"),
    "cam-03": ("KAM-03 NADSZYBIE SZYBU I",   SURF, "cage"),
    "cam-04": ("KAM-04 ZAKLAD PRZEROBCZY",   SURF, "plant"),
    "cam-05": ("KAM-05 STACJA WENTYLATOROW", SURF, "fan"),
    "cam-06": ("KAM-06 PODSZYBIE -300",      UG,   "cage"),
    "cam-07": ("KAM-07 SCIANA L-12",         UG,   "face"),
    "cam-08": ("KAM-08 POCHYLNIA P-2",       UG,   "belt"),
    "cam-09": ("KAM-09 PODSZYBIE -500",      UG,   "cage"),
    "cam-10": ("KAM-10 KOMORA MW",           UG,   "door"),
    "cam-11": ("KAM-11 STACJA ODMETANOWANIA",UG,   "tanks"),
    "cam-12": ("KAM-12 SCIANA W-7",          UG,   "face"),
    "cam-13": ("KAM-13 KOMORA RATUNKOWA",    UG,   "hall"),
}
# zdarzenia: (kamera bazowa, tone override, animacja)
INCS = {
    "inc-01-ppe":           ("cam-02", None,  "walker"),
    "inc-02-magazine":      ("cam-10", None,  "intruder_door"),
    "inc-03-conveyor-fire": ("cam-08", None,  "smoke"),
    "inc-04-worker-down":   ("cam-12", None,  "down"),
    "inc-05-perimeter":     ("cam-01", NIGHT, "fence"),
    "inc-06-object":        ("cam-05", None,  "bag"),
    "inc-07-loading-zone":  ("cam-06", None,  "load"),
}

def base_scene(tone, kind):
    """Statyczne tło sceny (bez ziarna) – liczone raz na klip."""
    img = Image.new("RGB", (W, H), tone["bg"])
    d = ImageDraw.Draw(img)
    hz = 150  # horyzont
    d.rectangle([0, hz, W, H], fill=tone["floor"])
    # linie perspektywy podłogi
    for i in range(-8, 9):
        d.line([(W / 2 + i * 22, hz), (W / 2 + i * 160, H)], fill=tuple(c + 10 for c in tone["floor"]), width=1)
    for k in range(1, 8):
        y = hz + int((H - hz) * (k / 8) ** 1.8)
        d.line([(0, y), (W, y)], fill=tuple(c + 8 for c in tone["floor"]), width=1)
    wall = tone["wall"]
    if kind == "gate":
        d.rectangle([40, 90, 120, hz + 40], fill=wall); d.rectangle([56, 108, 84, hz + 40], fill=tone["bg"])  # portiernia
        for x in range(150, W, 26): d.line([(x, 100), (x, hz + 20)], fill=tuple(c + 30 for c in wall), width=2)  # ogrodzenie
        d.line([(150, 100), (W, 100)], fill=tuple(c + 30 for c in wall), width=2)
        d.line([(120, hz + 10), (300, hz + 10)], fill=(200, 60, 60), width=5)  # szlaban
    elif kind == "hall":
        for x in range(30, W, 90): d.rectangle([x, 70, x + 40, hz - 4], fill=wall)  # szafki
        d.rectangle([0, 60, W, 66], fill=tuple(c + 20 for c in wall))
    elif kind == "cage":
        d.rectangle([250, 40, 390, hz + 60], outline=tuple(c + 50 for c in wall), width=4)  # klatka
        for y in range(50, hz + 60, 18): d.line([(250, y), (390, y)], fill=tuple(c + 25 for c in wall), width=1)
        d.rectangle([0, hz + 40, W, hz + 48], fill=(140, 40, 40))  # linia strefy
    elif kind == "plant":
        for x, w, h in [(60, 70, 110), (200, 50, 140), (420, 90, 100)]: d.rectangle([x, hz - h, x + w, hz + 10], fill=wall)
        d.line([(0, 120), (W, 90)], fill=tuple(c + 40 for c in wall), width=6)
    elif kind == "fan":
        d.rectangle([200, 40, 440, hz + 20], fill=wall)
        d.ellipse([260, 60, 380, 180], outline=tuple(c + 60 for c in wall), width=6)
        for a in range(0, 360, 45):
            d.line([(320, 120), (320 + 55 * math.cos(math.radians(a)), 120 + 55 * math.sin(math.radians(a)))], fill=tuple(c + 40 for c in wall), width=3)
    elif kind == "face":
        for x in range(0, W, 46): d.rectangle([x + 4, 30, x + 40, hz + 20], fill=wall)  # sekcje obudowy
        d.rectangle([0, hz + 20, W, hz + 34], fill=tuple(c + 25 for c in wall))          # przenośnik
    elif kind == "belt":
        d.polygon([(200, hz - 60), (440, hz - 60), (560, H), (80, H)], fill=tuple(c + 18 for c in wall))
        d.polygon([(240, hz - 60), (400, hz - 60), (480, H), (160, H)], fill=tuple(c - 8 for c in tone["floor"]))
        for k in range(0, 9):
            y = hz - 60 + int((H - hz + 60) * (k / 9) ** 1.5)
            d.line([(240 - k * 9, y), (400 + k * 9, y)], fill=tuple(c + 35 for c in wall), width=2)  # krążniki
    elif kind == "door":
        d.rectangle([220, 30, 420, hz + 30], fill=wall)
        d.rectangle([280, 60, 360, hz + 30], fill=tuple(c - 10 for c in tone["bg"]), outline=(180, 90, 70), width=4)  # drzwi
        d.rectangle([236, 70, 262, 84], fill=(160, 50, 50))  # tablica MW
    elif kind == "tanks":
        for x in [120, 260, 400]: d.rounded_rectangle([x, 50, x + 90, hz + 30], radius=30, fill=wall)
        d.line([(0, 70), (W, 70)], fill=tuple(c + 40 for c in wall), width=5)
    # winieta / oświetlenie
    vign = Image.new("L", (W, H), 0)
    vd = ImageDraw.Draw(vign)
    vd.ellipse([-120, -160, W + 120, H + 200], fill=255)
    vign = vign.filter(ImageFilter.GaussianBlur(90))
    dark = Image.new("RGB", (W, H), (0, 0, 0))
    img = Image.composite(img, dark, vign.point(lambda v: 70 + v * 185 // 255))
    if tone["ir"]:
        g = img.convert("L")
        img = Image.merge("RGB", (g.point(lambda v: min(255, int(v * 1.05))), g, g.point(lambda v: int(v * 0.85))))
    return img

def person(d, x, y, h, col, lying=False, t=0.0):
    """Sylwetka osoby (hełm, tułów, nogi) – x,y = środek stóp."""
    if lying:
        d.rounded_rectangle([x - h * 0.45, y - h * 0.22, x + h * 0.45, y], radius=6, fill=col)
        d.ellipse([x - h * 0.6, y - h * 0.26, x - h * 0.42, y - h * 0.08], fill=col)
        return
    sw = math.sin(t * 9) * h * 0.12
    d.line([(x, y - h * 0.45), (x - h * 0.12 + sw, y)], fill=col, width=int(h * 0.09) + 2)
    d.line([(x, y - h * 0.45), (x + h * 0.12 - sw, y)], fill=col, width=int(h * 0.09) + 2)
    d.rounded_rectangle([x - h * 0.16, y - h * 0.8, x + h * 0.16, y - h * 0.4], radius=5, fill=col)
    d.ellipse([x - h * 0.11, y - h * 1.0, x + h * 0.11, y - h * 0.8], fill=col)
    d.arc([x - h * 0.13, y - h * 1.03, x + h * 0.13, y - h * 0.82], 180, 360, fill=(230, 200, 90), width=3)  # hełm

def animate(d, img, anim, t, tone):
    """Warstwa animacji zdarzenia; t w [0,1]."""
    col = (150, 160, 170) if not tone["ir"] else (190, 185, 175)
    if anim == "walker":
        x = 120 + t * 300; y = 300 - t * 60; h = 150 - t * 40
        person(d, x, y, h, col, t=t * SEC)
    elif anim == "intruder_door":
        x = 250 + math.sin(t * 3) * 20; person(d, x, 290, 150, col, t=t * SEC)
        d.rectangle([300, 60, 370, 180], fill=(60, 40, 30))  # otwarte skrzydło drzwi
    elif anim == "down":
        person(d, 330, 300, 140, col, lying=True)
        person(d, 120 - t * 30, 280, 120, col, t=t * SEC)
        person(d, 560, 270, 110, col, t=t * SEC + 1)
    elif anim == "fence":
        for i, x0 in enumerate([90, 170]):
            climb = min(1, t * 2.2 - i * 0.3)
            y = 250 - climb * 120 if climb < 1 else 250 - 120 + (t - 0.6) * 200
            person(d, x0 + (t if climb >= 1 else 0) * 80, max(120, y), 120, col, t=t * SEC)
        d.rounded_rectangle([430, 190, 600, 260], radius=8, fill=(70, 74, 80)); d.rectangle([440, 200, 520, 230], fill=(30, 34, 40))  # van
    elif anim == "bag":
        if t < 0.35:
            person(d, 340 + t * 500, 300 - t * 30, 140, col, t=t * SEC * 2)
        d.rounded_rectangle([330, 250, 372, 285], radius=6, fill=(60, 60, 60))
    elif anim == "load":
        d.line([(320, 0), (320, 60 + math.sin(t * 6) * 6)], fill=(120, 120, 120), width=3)
        d.rectangle([270, 60 + math.sin(t * 6) * 6, 370, 130 + math.sin(t * 6) * 6], fill=(90, 90, 85))
        person(d, 320 + math.sin(t * 4) * 10, 305, 150, col, t=t * SEC)
    elif anim == "smoke":
        ov = Image.new("RGBA", (W, H), (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
        for i in range(18):
            r = 20 + i * 9 + t * 60
            cx = 300 + math.sin(i * 1.7 + t * 4) * 30 + i * 4
            cy = 200 - i * 12 - t * 90
            od.ellipse([cx - r, cy - r * 0.7, cx + r, cy + r * 0.7], fill=(150, 150, 150, 40))
        od.ellipse([280, 190, 340, 220], fill=(255, 120, 40, 160))
        od.ellipse([295, 196, 325, 214], fill=(255, 230, 120, 200))
        ov = ov.filter(ImageFilter.GaussianBlur(6))
        img.paste(Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB"))

def render(name, label, tone, kind, anim=None, out_dir=OUT):
    base = base_scene(tone, kind)
    rng = np.random.default_rng(7)
    frames_dir = os.path.join(out_dir, f".frames_{name}")
    os.makedirs(frames_dir, exist_ok=True)
    n = FPS * SEC
    start = time.time()
    for i in range(n):
        t = i / n
        img = base.copy()
        d = ImageDraw.Draw(img)
        if anim: animate(d, img, anim, t, tone); d = ImageDraw.Draw(img)
        # ziarno + migotanie
        arr = np.asarray(img).astype(np.int16)
        noise = rng.integers(-14, 14, (H, W, 1), dtype=np.int16)
        flick = int(6 * math.sin(i * 1.3))
        arr = np.clip(arr + noise + flick, 0, 255).astype(np.uint8)
        img = Image.fromarray(arr)
        d = ImageDraw.Draw(img)
        # OSD
        ts = time.strftime("%Y-%m-%d") + f" {8 + (i // (FPS * 60)) % 12:02d}:{(i // FPS) % 60 + 12:02d}:{(i % FPS) * 60 // FPS:02d}"
        d.text((12, 10), label, font=F_OSD, fill=(235, 235, 235), stroke_width=2, stroke_fill=(0, 0, 0))
        d.text((W - 210, 10), ts, font=F_OSD, fill=(235, 235, 235), stroke_width=2, stroke_fill=(0, 0, 0))
        d.ellipse([12, H - 26, 22, H - 16], fill=(230, 40, 40) if (i // 6) % 2 == 0 else (120, 30, 30))
        d.text((28, H - 30), "REC", font=F_OSD, fill=(235, 235, 235), stroke_width=2, stroke_fill=(0, 0, 0))
        d.text((W - 250, H - 30), "NAGRANIE ZASTEPCZE - DEMO", font=F_WM, fill=(200, 200, 200), stroke_width=2, stroke_fill=(0, 0, 0))
        img.save(os.path.join(frames_dir, f"{i:04d}.png"), compress_level=1)
    seq = os.path.join(frames_dir, "%04d.png")
    out = os.path.join(out_dir, f"{name}.mp4")
    subprocess.run([ffmpeg(), "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", seq,
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "30", "-preset", "veryfast", "-movflags", "+faststart", out], check=True)
    # WebM (VP9) – dla przeglądarek bez kodeka H.264 (np. Chromium z dystrybucji Linuksa)
    out2 = os.path.join(out_dir, f"{name}.webm")
    subprocess.run([ffmpeg(), "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", seq,
                    "-c:v", "libvpx-vp9", "-pix_fmt", "yuv420p", "-crf", "40", "-b:v", "0", "-deadline", "good", "-cpu-used", "3", "-row-mt", "1", out2], check=True)
    shutil.rmtree(frames_dir)
    print(f"{name}: mp4 {os.path.getsize(out) // 1024} KB · webm {os.path.getsize(out2) // 1024} KB · {time.time() - start:.1f}s")

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, (label, tone, kind) in CAMS.items():
        render(name, label, tone, kind)
    for name, (cam, tone_override, anim) in INCS.items():
        label, tone, kind = CAMS[cam]
        render(name, label, tone_override or tone, kind, anim)
