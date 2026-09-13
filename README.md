# SENTINEL-CI · demo wykrywania anomalii CCTV (kopalnia węgla)

Klikalne demo konsoli operacyjnej w stylu Palantira dla infrastruktury
krytycznej: warstwa AI obserwuje CCTV kopalni, wykrywa niebezpieczne wzorce,
alarmuje operatora ochrony i prowadzi go przez obowiązkową procedurę.

Bez kroku budowania, bez zależności – czysty HTML / CSS / JS.

## Uruchomienie

Najprościej: **dwuklik na `start.bat`** (Windows) albo `./start.sh` (macOS / Linux).
Skrypt uruchamia lokalny serwer i otwiera przeglądarkę na `http://localhost:8080`.

Ręcznie:

```bash
# dowolny serwer statyczny; z katalogu repozytorium:
python3 -m http.server 8080
# otwórz http://localhost:8080
```

Otwarcie `index.html` bezpośrednio z dysku też działa w Chrome/Edge.

## Układ

| Panel | Co robi |
|---|---|
| **Lewy – asystent ochrony** | Prosty czat dla ochroniarza, bez linii poleceń. Każda wiadomość asystenta wymagająca decyzji ma duże, klikalne przyciski w zwykłym języku („Tak, to prawdziwe zagrożenie”, „Powiedz mi więcej”, „To fałszywy alarm”, „Zrobione ✓”). Na dole stałe przyciski: *Co się dzieje?*, *Pokaż kamery*, *Co mam teraz robić?*, *Historia zdarzeń*. Sterowanie demem (NASTĘPNE ZDARZENIE, AUTO) jest w nagłówku panelu. |
| **Prawy górny – cyfrowy bliźniak** | Fotorealistyczny ukośny widok 3D jak z drona, renderowany z wygenerowanej ortofotomapy: budynki z fakturowanymi elewacjami (płyty z oknami, blacha trapezowa, cegła), cieniowane silosy, zbiorniki i komin, kratownicowa wieża szybowa z kołami linowymi, most przenośnikowy na podporach, hałdy, osadniki, tory z wagonami, parking, maszty i ogrodzenie, korony drzew, cienie od słońca, mgiełka atmosferyczna w głębi. Pod powierzchnią wiszą, jak szklane piętra, poziomy −300 m i −500 m z podświetlonymi wyrobiskami (przekopy, ściany, komory, pochylnia, rurociąg CH₄, tamy, klatka w szybie, lokomotywa, załoga), a szyby łączą je w pionie. Kamery z polami widzenia i etykiety są wektorowe na wierzchu. Przełącznik poziomów w nagłówku panelu przybliża i wyróżnia dany poziom; kółko myszy przybliża, przeciąganie przesuwa; alarm sam przełącza widok na poziom kamery. Obraz generują `tools/make_orthophoto.py` (warstwy płaskie) i `tools/make_scene3d.py` (render 3D → `assets/scene.jpg`, `assets/scene_mask.png`, `js/site.js`). |
| **Prawy dolny – podgląd na żywo** | Odtwarza wideo wybranej kamery z ramkami detekcji AI, listą detekcji, metadanymi kamery i listą ostatnich zdarzeń. Do czasu dodania pliku wideo pokazuje animowaną planszę BRAK SYGNAŁU. |

## Przebieg demo

1. Naciśnij **NASTĘPNE ZDARZENIE** – wywołuje kolejną
   zaplanowaną anomalię: punkt kamery miga na czerwono, podgląd przełącza się
   na tę kamerę z ramkami, asystent wypisuje UWAGA i pyta *co robimy?*
2. Przyciski: „Tak, to prawdziwe zagrożenie – pokaż, co robić”, „Powiedz mi więcej”,
   „Poczekaj chwilę i sprawdź jeszcze raz” (ponowny alarm po 20 s), „To fałszywy alarm”.
3. Po potwierdzeniu asystent otwiera właściwą procedurę (np.
   „Pożar przenośnika taśmowego”), pokazuje całą listę kroków
   i pyta o każdy krok po kolei (**Zrobione ✓** / **Nie mogę tego zrobić** / **Pokaż wszystkie kroki**).
   Między krokami pojawiają się zaplanowane aktualizacje (odczyty CO, potwierdzenia załogi, czas dojazdu ratowników).
4. Po potwierdzeniu ostatniego kroku zdarzenie jest zamykane, nadawany jest
   numer raportu, a kamera wraca do stanu nominalnego.
5. **AUTO** odtwarza cały scenariusz samoczynnie (kolejne zdarzenie ok. 10 s
   po zamknięciu poprzedniego).

Zaplanowane zdarzenia, w kolejności:

| # | Kamera | Poziom | Wzorzec |
|---|---|---|---|
| ZD-01 | KAM-02 Lampownia | NISKI | Pracownik bez aparatu ucieczkowego idzie na nadszybie |
| ZD-02 | KAM-10 Komora MW | WYSOKI | Osoba bez uprawnień, drzwi otwarte poza oknem strzałowym |
| ZD-03 | KAM-08 Pochylnia taśmowa | KRYTYCZNY | Dym + punkt gorący na taśmie, taśma nadal pracuje |
| ZD-04 | KAM-12 Ściana W-7 | KRYTYCZNY | Nieruchomy pracownik na trasie kombajnu, rośnie CH₄ |
| ZD-05 | KAM-01 Brama główna | WYSOKI | Naruszenie perymetru, pojazd bez tablic |
| ZD-06 | KAM-05 Wentylator główny | WYSOKI | Porzucony przedmiot przy czerpni |
| ZD-07 | KAM-06 Podszybie −300 | ŚREDNI | Osoba pod zawieszonym ładunkiem |

## Nagrania

W `videos/` są już **zastępcze klipy demo** (wygenerowane, z napisem „NAGRANIE
ZASTĘPCZE – DEMO”), więc podgląd odtwarza wideo od razu. Każdy klip jest w dwóch
wersjach: `.mp4` (H.264) i `.webm` (VP9) – odtwarzacz próbuje najpierw MP4, potem
WebM, więc działa też w przeglądarkach bez kodeka H.264.

Aby podmienić na prawdziwe nagrania, wystarczy nadpisać plik `.mp4` o tej samej
nazwie (wersję `.webm` można usunąć):

| Plik | Użycie |
|---|---|
| `videos/cam-01.mp4` … `videos/cam-29.mp4` | Pętla bezczynności każdej kamery (otwieranej z modelu 3D) |
| `videos/inc-01-ppe.mp4` | ZD-01 na KAM-02 |
| `videos/inc-02-magazine.mp4` | ZD-02 na KAM-10 |
| `videos/inc-03-conveyor-fire.mp4` | ZD-03 na KAM-08 |
| `videos/inc-04-worker-down.mp4` | ZD-04 na KAM-12 |
| `videos/inc-05-perimeter.mp4` | ZD-05 na KAM-01 |
| `videos/inc-06-object.mp4` | ZD-06 na KAM-05 |
| `videos/inc-07-loading-zone.mp4` | ZD-07 na KAM-06 |

Zastępcze klipy można wygenerować ponownie: `python3 tools/make_placeholder_videos.py`
(wymaga `pillow`, `numpy` i ffmpeg – systemowego lub `pip install imageio-ffmpeg`).

MP4 (H.264) lub WebM. Wideo odtwarza się automatycznie, wyciszone, w pętli.
Gdy brakuje klipu zdarzenia, używana jest pętla kamery; gdy brakuje i jej,
plansza BRAK SYGNAŁU podaje oczekiwaną ścieżkę.

Wszystkie ścieżki, kamery, zdarzenia, ramki detekcji (`boxes`, w % kadru),
i procedury są w `js/data.js`. Pozycje kamer
(`level`, `x`, `y`, `dir`) są we współrzędnych planu obiektu (0–520 × 0–200,
1 jednostka ≈ 1 m); rzut ukośny to X = x + 0,45·y, Y = 0,5·y − wysokość, ten sam
w `js/app.js` (funkcja `P`) i w `tools/make_scene3d.py`.
