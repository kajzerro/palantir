#!/usr/bin/env python3
"""
Pobiera podkład satelitarny / ortofotomapę dla obiektów demo i zapisuje go tak,
żeby pokrywał się 1:1 z układem współrzędnych mapy (1000 × 620 jednostek, 1 j. = 10 m).

Źródła (w kolejności prób, wszystkie do użycia z podaniem źródła):
  1. GUGiK · ortofotomapa Polski (WMS)   – dane otwarte, najlepsza rozdzielczość dla obiektów lądowych
  2. Esri · World Imagery (REST export)  – podkład globalny, wymaga podania źródła
  3. EOX · Sentinel-2 cloudless (WMS)    – CC BY-SA 4.0, dobry dla obszarów morskich

Użycie:
    python3 tools/fetch_satellite.py              # oba obiekty
    python3 tools/fetch_satellite.py belchatow    # jeden obiekt
    python3 tools/fetch_satellite.py --source esri

Zapisuje: assets/sat-<obiekt>.jpg oraz assets/satellite.json (georeferencja + źródło).

UWAGA: wektorowy plan obiektu w js/data.js jest schematem. Po wstawieniu prawdziwego
zdjęcia trzeba przesunąć bryły, ogrodzenie i sensory tak, by leżały na rzeczywistych
obiektach ze zdjęcia – inaczej warstwa taktyczna nie będzie się zgadzać z podkładem.
Pozycje aktywów i sensorów są w js/data.js (sekcje `geo` i `sensors`).
"""
import json, math, os, sys, urllib.parse, urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS = os.path.join(ROOT, "assets")

# środek mapy każdego obiektu (WGS84) – punkt, w którym wypada środek kadru 1000 × 620 jednostek.
# Współrzędne przybliżone; do potwierdzenia z działem majątku / decyzją lokalizacyjną.
SITES = {
    "belchatow": dict(lat=51.2661, lon=19.3306, w=1000, h=620, m_per_unit=10,
                      note="PGE GiEK · Elektrownia Bełchatów (Rogowiec)"),
    "baltica":   dict(lat=55.0500, lon=17.3000, w=1000, h=620, m_per_unit=10,
                      note="PGE Baltica · obszar MFW Baltica 2 (ok. 37 km na N od Łeby)"),
}

PX_PER_UNIT = 2          # 2000 × 1240 px, czyli ok. 5 m na piksel
TIMEOUT = 90


def mercator_bbox(lat, lon, width_m, height_m):
    """Prostokąt w EPSG:3857 o zadanych wymiarach w metrach *na gruncie* wokół punktu."""
    R = 6378137.0
    x = R * math.radians(lon)
    y = R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    k = 1.0 / math.cos(math.radians(lat))      # skala odwzorowania Mercatora
    dx, dy = width_m * k / 2, height_m * k / 2
    return (x - dx, y - dy, x + dx, y + dy)


def get(url, referer=None):
    req = urllib.request.Request(url, headers={
        "User-Agent": "SPEKTRE-AIR-demo/1.0 (podklad mapowy do demonstracji)",
        **({"Referer": referer} if referer else {}),
    })
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        data = r.read()
        ctype = r.headers.get("Content-Type", "")
    if not ctype.startswith("image/"):
        raise RuntimeError(f"odpowiedź nie jest obrazem ({ctype}): {data[:200]!r}")
    return data


def src_gugik(bbox, px, py):
    q = {
        "SERVICE": "WMS", "VERSION": "1.3.0", "REQUEST": "GetMap", "LAYERS": "Raster",
        "STYLES": "", "CRS": "EPSG:3857", "FORMAT": "image/jpeg", "TRANSPARENT": "FALSE",
        "BBOX": ",".join(f"{v:.2f}" for v in bbox), "WIDTH": str(px), "HEIGHT": str(py),
    }
    url = "https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolution?" + urllib.parse.urlencode(q)
    return get(url), "GUGiK · ortofotomapa (dane otwarte, geoportal.gov.pl)"


def src_esri(bbox, px, py):
    q = {
        "bbox": ",".join(f"{v:.2f}" for v in bbox), "bboxSR": "3857", "imageSR": "3857",
        "size": f"{px},{py}", "format": "jpg", "f": "image",
    }
    url = "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export?" + urllib.parse.urlencode(q)
    return get(url), "Esri World Imagery · Maxar, Earthstar Geographics"


def src_eox(bbox, px, py):
    q = {
        "service": "WMS", "version": "1.1.1", "request": "GetMap", "layers": "s2cloudless-2020",
        "srs": "EPSG:3857", "format": "image/jpeg",
        "bbox": ",".join(f"{v:.2f}" for v in bbox), "width": str(px), "height": str(py),
    }
    url = "https://tiles.maps.eox.at/wms?" + urllib.parse.urlencode(q)
    return get(url), "Sentinel-2 cloudless (EOX IT Services, CC BY-SA 4.0) · dane Copernicus"


ORDER = {"belchatow": ["gugik", "esri", "eox"], "baltica": ["eox", "esri", "gugik"]}
SRC = {"gugik": src_gugik, "esri": src_esri, "eox": src_eox}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = None
    for a in sys.argv[1:]:
        if a.startswith("--source"):
            force = a.split("=", 1)[1] if "=" in a else sys.argv[sys.argv.index(a) + 1]
    names = args or list(SITES)
    os.makedirs(ASSETS, exist_ok=True)
    meta_path = os.path.join(ASSETS, "satellite.json")
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    blocked = []

    for name in names:
        s = SITES[name]
        bbox = mercator_bbox(s["lat"], s["lon"], s["w"] * s["m_per_unit"], s["h"] * s["m_per_unit"])
        px, py = s["w"] * PX_PER_UNIT, s["h"] * PX_PER_UNIT
        for key in ([force] if force else ORDER[name]):
            try:
                print(f"{name}: próbuję {key}…")
                data, credit = SRC[key](bbox, px, py)
                out = os.path.join(ASSETS, f"sat-{name}.jpg")
                open(out, "wb").write(data)
                meta[name] = dict(file=f"assets/sat-{name}.jpg", source=key, attribution=credit,
                                  lat=s["lat"], lon=s["lon"], bbox3857=[round(v, 2) for v in bbox],
                                  m_per_unit=s["m_per_unit"], px=[px, py], placeholder=False)
                print(f"  ✓ {out}  ({len(data) // 1024} kB)  źródło: {credit}")
                break
            except Exception as e:
                print(f"  ✗ {key}: {e}")
        else:
            blocked.append(name)

    json.dump(meta, open(meta_path, "w"), ensure_ascii=False, indent=2)
    print(f"\nGeoreferencja zapisana w {meta_path}")
    if blocked:
        print("NIE POBRANO:", ", ".join(blocked),
              "\nSprawdź dostęp sieciowy do mapy.geoportal.gov.pl / services.arcgisonline.com / tiles.maps.eox.at.")
    print("\nPamiętaj: po wstawieniu prawdziwego zdjęcia dopasuj plan wektorowy w js/data.js\n"
          "(bryły, ogrodzenie, sensory) do obiektów widocznych na podkładzie oraz uzupełnij\n"
          "podpis źródła – jest wyświetlany w rogu mapy.")


if __name__ == "__main__":
    main()
